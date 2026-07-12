// use-theme.ts — follow the shell's light/dark theme.
//
// The shell owns the theme. In a real install (runtime 1.8+) the platform sets
// `gt.theme`, fires `theme-changed` on every toggle, and applies the `dark`
// class to <html> itself — so we mirror its `mode` into state and never decide
// for ourselves. Outside the shell (standalone `pnpm dev`, the "Try it live"
// demo) there's no theme to inherit, so we fall back to a local manual toggle
// and own the `dark` class.

import { useEffect, useState } from 'react'

type Mode = 'light' | 'dark'

export function useTheme() {
  const gt = window.gt
  const hasShellTheme = !!gt.theme
  const [mode, setMode] = useState<Mode>(() => gt.theme?.mode ?? 'light')

  // Live install: follow the shell. The runtime already toggles the `dark` class
  // (synchronously, before first paint), so we only track `mode` for JS readers.
  useEffect(() => {
    if (!gt.theme) return
    setMode(gt.theme.mode)
    return gt.on('theme-changed', (t) => setMode((t as { mode: Mode }).mode))
  }, [gt])

  // No shell to follow: we own the `dark` class on <html>.
  useEffect(() => {
    if (hasShellTheme) return
    document.documentElement.classList.toggle('dark', mode === 'dark')
  }, [hasShellTheme, mode])

  return {
    dark: mode === 'dark',
    canToggle: !hasShellTheme,
    toggle: () => setMode((m) => (m === 'dark' ? 'light' : 'dark')),
  }
}
