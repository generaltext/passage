// Small shared UI primitives, all token-styled so they follow the shell theme.

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  footer?: React.ReactNode
  wide?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dlg = ref.current
    if (!dlg) return
    if (open && !dlg.open) dlg.showModal()
    if (!open && dlg.open) dlg.close()
  }, [open])

  if (!open) return null
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      className={`m-auto w-[calc(100vw-2rem)] rounded-2xl border border-line bg-panel p-0 text-fg shadow-xl backdrop:bg-black/40 ${
        wide ? 'max-w-2xl' : 'max-w-lg'
      }`}
    >
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <h2 className="font-serif text-lg font-semibold">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-md p-1 text-fg3 hover:bg-panel-2 hover:text-fg"
        >
          <X size={18} />
        </button>
      </div>
      <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
      {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
    </dialog>
  )
}

/** Header row for a floating side panel: title (+ optional right slot) + close. */
export function PanelHeader({ title, sub, right, onClose }: { title: string; sub?: string; right?: React.ReactNode; onClose: () => void }) {
  return (
    <div className="flex items-center gap-2 border-b border-glass-line px-3.5 py-2.5">
      <div className="min-w-0 flex-1">
        <h2 className="truncate font-serif text-[17px] font-semibold leading-tight">{title}</h2>
        {sub && <p className="truncate text-xs text-fg3">{sub}</p>}
      </div>
      {right}
      <button type="button" onClick={onClose} aria-label="Close panel" className="rounded-lg p-1 text-fg3 hover:bg-accent-tint hover:text-accent">
        <X size={17} />
      </button>
    </div>
  )
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-fg3">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-fg4">{hint}</span>}
    </label>
  )
}

export const inputClass =
  'w-full rounded-lg border border-line2 bg-panel-2 px-3 py-2 text-sm text-fg placeholder:text-fg4 focus:border-accent focus:outline-none'

export function Button({
  variant = 'default',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'primary' | 'ghost' | 'danger' }) {
  const styles = {
    default: 'border border-line2 bg-panel text-fg hover:bg-panel-2',
    primary: 'bg-accent text-accent-fg hover:opacity-90',
    ghost: 'text-fg2 hover:bg-panel-2',
    danger: 'border border-bad/40 text-bad hover:bg-bad/10',
  }[variant]
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${styles} ${className}`}
      {...props}
    />
  )
}

/** A row of toggleable person chips (for who[] selection and layer filters). */
export function PersonChips({
  people,
  selected,
  onToggle,
  size = 'md',
}: {
  people: { id: string; name: string; color: string }[]
  selected: Set<string> | null
  onToggle: (id: string) => void
  size?: 'sm' | 'md'
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {people.map((p) => {
        const on = selected ? selected.has(p.id) : true
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onToggle(p.id)}
            aria-pressed={on}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 ${
              size === 'sm' ? 'py-0.5 text-xs' : 'py-1 text-[13px]'
            } font-medium transition-colors ${
              on ? 'border-transparent text-white' : 'border-line2 bg-panel text-fg3 hover:text-fg2'
            }`}
            style={on ? { backgroundColor: p.color } : undefined}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: on ? 'rgba(255,255,255,0.85)' : p.color }}
            />
            {p.name}
          </button>
        )
      })}
    </div>
  )
}
