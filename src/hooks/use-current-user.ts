'use client'

// useSyncExternalStore is the React-recommended way to subscribe to an
// external store (localStorage in this case). It handles SSR/hydration
// automatically without triggering setState-in-effect lint errors.
import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'porto_finance_user'

function subscribe(cb: () => void) {
  window.addEventListener('storage', cb)
  window.addEventListener('porto:user-change', cb)
  return () => {
    window.removeEventListener('storage', cb)
    window.removeEventListener('porto:user-change', cb)
  }
}

function getSnapshot(): string {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored) return stored
  } catch {}
  return 'Usuário'
}

function getServerSnapshot(): string {
  return 'Usuário'
}

export function useCurrentUser() {
  const user = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const setUser = (name: string) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, name)
      window.dispatchEvent(new Event('porto:user-change'))
    } catch {}
  }

  return { user, setUser, hydrated: true }
}
