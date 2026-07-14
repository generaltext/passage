import { ExternalLink, Play } from 'lucide-react'
import { PassageMark } from '~/components/PassageMark'

// Shown when Passage is opened outside General Text — no injected `window.gt`
// (visiting the deployed site directly rather than launching from a workspace).
// Point the visitor at how to install it, and let them try the local demo.
export default function MissingRuntime({ onTryDemo }: { onTryDemo: () => void }) {
  const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://passage.generaltext.org'

  return (
    <div className="flex min-h-full items-center justify-center bg-bg px-6 py-12 text-fg">
      <div className="w-full max-w-md space-y-5 rounded-xl border border-line bg-panel p-7 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-accent">
            <PassageMark size={26} />
          </span>
          <div>
            <h1 className="font-serif text-xl font-semibold leading-tight">Passage</h1>
            <p className="text-xs text-fg3">A General Text app</p>
          </div>
        </div>

        <p className="text-sm leading-relaxed text-fg2">
          Passage is a lifelong, private log of everywhere you've been — flights, places, and stays,
          painted on a map. It runs{' '}
          <span className="font-medium text-fg">inside General Text</span>, a workspace for
          plain-text files that sync across your devices, so your travel history lives as files you
          own.
        </p>

        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-fg3">
            To install Passage
          </p>
          <ol className="space-y-1.5 text-sm text-fg2">
            <Step n={1}>
              Open <Link href="https://www.generaltext.org">General Text</Link> and create or open a
              workspace.
            </Step>
            <Step n={2}>
              Go to <span className="text-fg">Settings → Apps → Install by URL</span>.
            </Step>
            <Step n={3}>
              Paste this app's address:
              <code className="mt-1 block rounded bg-panel-2 px-2 py-1 font-mono text-xs text-fg">
                {appUrl}
              </code>
            </Step>
            <Step n={4}>Launch Passage from your workspace.</Step>
          </ol>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href="https://www.generaltext.org"
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3.5 py-2 text-sm font-medium text-accent-fg transition-opacity hover:opacity-90"
          >
            Open General Text
            <ExternalLink size={14} />
          </a>
          <a
            href="/demo"
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
              e.preventDefault()
              onTryDemo()
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-line2 px-3.5 py-2 text-sm font-medium text-fg2 transition-colors hover:bg-panel-2"
          >
            <Play size={14} />
            Try the demo
          </a>
        </div>
        <p className="-mt-2 text-xs text-fg4">
          The demo runs entirely in your browser — nothing is saved to an account, and changes stay
          on this device.
        </p>

        <p className="text-xs text-fg4">
          Building your own app?{' '}
          <Link href="https://www.generaltext.org/docs/building-apps">Read the developer guide</Link>.
        </p>
      </div>
    </div>
  )
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-panel-2 text-[11px] font-medium text-fg3">
        {n}
      </span>
      <span className="min-w-0 flex-1">{children}</span>
    </li>
  )
}

function Link({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
    >
      {children}
    </a>
  )
}
