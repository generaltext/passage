// Ambient types for the platform-injected `window.gt` runtime. General Text
// injects the runtime at serve time (and a dev vite plugin injects it locally),
// so this app bundles NO sync client and no yjs — these are types only.
//
// This is the subset of the contract Passage uses. The full surface is
// documented at generaltext.org/docs/building-apps.

/** The live CRDT text for a file — methods ride on the object the runtime hands
 *  back; we never construct one, so no yjs import is needed. */
interface GtText {
  toString(): string
  readonly length: number
  observe(fn: () => void): void
  unobserve(fn: () => void): void
}

interface GtApi {
  /** Resolves once connected to the workspace. */
  readonly ready: Promise<void>
  readonly version: string
  readonly connected: boolean
  /** 'demo' in the gallery "Try it live" demo (and the App Builder preview),
   *  'live' in a normal workspace. */
  readonly mode?: 'demo' | 'live'

  /** The shell's current light/dark theme (runtime 1.8+). The platform applies
   *  it to <html> automatically (the `dark` class + `color-scheme`) and fires
   *  `theme-changed` on every toggle. Absent on older runtimes and standalone. */
  readonly theme?: { mode: 'light' | 'dark'; vars: Record<string, string> }

  // Reactive reads: subscribe to a file's live text, observe changes.
  subscribeFile(path: string): GtText
  unsubscribeFile(path: string): void

  // Whole-file ops (writeFile diffs internally — merge-friendly).
  readFile(path: string): Promise<string>
  writeFile(path: string, content: string): Promise<void>
  deleteFile(path: string): Promise<void>
  listFiles(): Promise<{ path: string; sizeBytes: number }[]>

  // File list + connection.
  files(): string[]
  watchFiles(cb: (paths: string[]) => void): () => void
  on(
    event: 'connected' | 'disconnected' | 'mode-changed' | 'error' | 'theme-changed',
    cb: (...args: unknown[]) => void,
  ): () => void

  /** Escape hatch to the underlying client (dev-only `isLocal`). */
  readonly sync: {
    readonly isLocal: boolean
  }
}

interface Window {
  gt: GtApi
}
