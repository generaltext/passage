// demo-runtime.ts — a self-contained, in-browser stand-in for the platform's
// `window.gt`, so Passage runs when opened outside General Text (no real runtime
// injected): the gallery "Try it live" demo and standalone `pnpm dev`.
//
// It implements just the GtApi surface Passage uses (see src/gt.d.ts), backed by
// plain strings in memory and mirrored to localStorage so a refresh keeps your
// data. No CRDT, no network — single-user, local, throwaway. `mode: 'demo'` lets
// the app seed sample data. Inert under a real host (only installs when
// window.gt is absent).

const PREFIX = 'passage-demo:'

export function installDemoRuntime(): void {
  if (typeof window === 'undefined' || window.gt) return
  window.gt = createDemoRuntime()
}

function createDemoRuntime(): GtApi {
  const files = new Map<string, string>()
  const observers = new Map<string, Set<() => void>>()
  const texts = new Map<string, GtText>()
  const fileListeners = new Set<(paths: string[]) => void>()

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(PREFIX)) files.set(key.slice(PREFIX.length), localStorage.getItem(key) ?? '')
    }
  } catch {
    /* localStorage unavailable — in-memory only */
  }

  const persist = (path: string) => {
    try {
      localStorage.setItem(PREFIX + path, files.get(path) ?? '')
    } catch {
      /* ignore */
    }
  }
  const obs = (path: string) => {
    let set = observers.get(path)
    if (!set) observers.set(path, (set = new Set()))
    return set
  }
  const notify = (path: string) => obs(path).forEach((fn) => fn())
  const notifyFiles = () => {
    const paths = [...files.keys()]
    fileListeners.forEach((fn) => fn(paths))
  }

  function makeText(path: string): GtText {
    const existing = texts.get(path)
    if (existing) return existing
    const text: GtText = {
      toString: () => files.get(path) ?? '',
      get length() {
        return (files.get(path) ?? '').length
      },
      observe: (fn) => void obs(path).add(fn),
      unobserve: (fn) => void obs(path).delete(fn),
    }
    texts.set(path, text)
    return text
  }

  return {
    ready: Promise.resolve(),
    version: 'demo',
    mode: 'demo',
    connected: true,

    subscribeFile: (path) => makeText(path),
    unsubscribeFile: () => {},

    async readFile(path) {
      return files.get(path) ?? ''
    },
    async writeFile(path, content) {
      const isNew = !files.has(path)
      files.set(path, content)
      persist(path)
      notify(path)
      if (isNew) notifyFiles()
    },
    async deleteFile(path) {
      files.delete(path)
      try {
        localStorage.removeItem(PREFIX + path)
      } catch {
        /* ignore */
      }
      notify(path)
      notifyFiles()
    },
    async listFiles() {
      return [...files].map(([path, content]) => ({ path, sizeBytes: content.length }))
    },

    files: () => [...files.keys()],
    watchFiles(cb) {
      fileListeners.add(cb)
      cb([...files.keys()])
      return () => void fileListeners.delete(cb)
    },
    on: () => () => {},

    sync: { isLocal: true },
  }
}
