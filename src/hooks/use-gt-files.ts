// Reactive reads over window.gt: subscribe to a file's live text and re-render
// on every change (local or remote). Writes go through the store's writeFile.

import { useEffect, useState } from 'react'

/** Live text of a single file. */
export function useGtText(path: string): string {
  const gt = window.gt
  const [text, setText] = useState<string>(() => gt.subscribeFile(path).toString())

  useEffect(() => {
    const t = gt.subscribeFile(path)
    const update = () => setText(t.toString())
    update()
    t.observe(update)
    return () => {
      t.unobserve(update)
      gt.unsubscribeFile(path)
    }
  }, [gt, path])

  return text
}

/** Live text of a dynamic set of files (e.g. one places file per person). */
export function useGtTexts(paths: string[]): Record<string, string> {
  const gt = window.gt
  const [texts, setTexts] = useState<Record<string, string>>({})
  const key = paths.join('\n')

  useEffect(() => {
    const list = key ? key.split('\n') : []
    const subs = list.map((p) => {
      const t = gt.subscribeFile(p)
      const update = () => setTexts((prev) => (prev[p] === t.toString() ? prev : { ...prev, [p]: t.toString() }))
      update()
      t.observe(update)
      return { p, t, update }
    })
    return () => {
      for (const { p, t, update } of subs) {
        t.unobserve(update)
        gt.unsubscribeFile(p)
      }
    }
  }, [gt, key])

  return texts
}
