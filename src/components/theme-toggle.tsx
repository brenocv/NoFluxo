'use client'

import { useSyncExternalStore } from 'react'
import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'

function useMounted() {
  return useSyncExternalStore(() => () => {}, () => true, () => false)
}

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme()
  const mounted = useMounted()
  const isDark = (mounted ? resolvedTheme : 'light') === 'dark'
  return (
    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setTheme(isDark ? 'light' : 'dark')} aria-label={isDark ? 'Modo claro' : 'Modo escuro'} title={isDark ? 'Modo claro' : 'Modo escuro'}>
      {mounted && isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  )
}
