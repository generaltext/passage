// JSONL helpers: parse tolerantly (a corrupt line never sinks the file), and
// serialise deterministically (stable key order, trailing newline) so hand
// edits and app writes produce minimal, merge-friendly diffs.

/** Parse JSONL into objects, skipping blank and unparseable lines. */
export function parseJsonl<T>(text: string): T[] {
  const out: T[] = []
  for (const line of text.split('\n')) {
    const t = line.trim()
    if (!t) continue
    try {
      out.push(JSON.parse(t) as T)
    } catch {
      /* tolerate a bad line rather than lose the whole file */
    }
  }
  return out
}

/** Serialise objects to JSONL. `keyOrder` pins the leading keys so diffs stay
 *  small and files stay readable; remaining keys follow in insertion order.
 *  Undefined/empty-string/empty-array values are dropped to keep lines terse. */
export function toJsonl(rows: object[], keyOrder: string[]): string {
  return rows.map((r) => stableLine(r as Record<string, unknown>, keyOrder)).join('\n') + (rows.length ? '\n' : '')
}

function stableLine(row: Record<string, unknown>, keyOrder: string[]): string {
  const keys = [...keyOrder.filter((k) => k in row), ...Object.keys(row).filter((k) => !keyOrder.includes(k))]
  const obj: Record<string, unknown> = {}
  for (const k of keys) {
    const v = row[k]
    if (v === undefined || v === null || v === '') continue
    if (Array.isArray(v) && v.length === 0) continue
    obj[k] = v
  }
  return JSON.stringify(obj)
}

/** Parse a `places/<person>.txt` file: one token per line, `#` comments and
 *  blank lines ignored. Returns the raw tokens in order. */
export function parsePlacesTxt(text: string): string[] {
  const out: string[] = []
  for (const raw of text.split('\n')) {
    const line = raw.replace(/#.*$/, '').trim()
    if (line) out.push(line)
  }
  return out
}

/** A short, URL-safe id. */
export function newId(): string {
  const c = globalThis.crypto
  if (c?.randomUUID) return c.randomUUID().slice(0, 8)
  return Math.abs(Date.now() ^ (Math.random() * 1e9)).toString(36)
}

/** Deterministic id from a string (FNV-1a) — used to give a stable identity to
 *  records an agent or hand-edit appended without one, without churning the file
 *  on read. */
export function hashId(s: string): string {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return 'x' + (h >>> 0).toString(36)
}

/** Parse a record file, guaranteeing every row has an `id` (synthesised from the
 *  raw line when absent, so external lines get a stable key without a rewrite). */
export function parseRecords<T extends { id?: string }>(text: string): (T & { id: string })[] {
  const out: (T & { id: string })[] = []
  for (const line of text.split('\n')) {
    const t = line.trim()
    if (!t) continue
    try {
      const obj = JSON.parse(t) as T & { id?: string }
      if (!obj.id) obj.id = hashId(t)
      out.push(obj as T & { id: string })
    } catch {
      /* tolerate a bad line */
    }
  }
  return out
}
