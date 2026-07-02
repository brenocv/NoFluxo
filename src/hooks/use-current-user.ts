'use client'

// useSyncExternalStore is the React-recommended way to subscribe to an
// external store (localStorage in this case). It handles SSR/hydration
// automatically without triggering setState-in-effect lint errors.
import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'porto_finance_user'
const NAMES = ['Breno', 'Kiki', 'Visita']

function subscribe(cb: () => void) {
  window.addEventListener('storage', cb)
  // Custom event so same-tab writes also trigger updates
  window.addEventListener('porto:user-change', cb)
  return () => {
    window.removeEventListener('storage', cb)
    window.removeEventListener('porto:user-change', cb)
  }
}

function getSnapshot(): string {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored && NAMES.includes(stored)) return stored
  } catch {}
  return 'Breno'
}

function getServerSnapshot(): string {
  return 'Breno'
}

export function useCurrentUser() {
  const user = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const setUser = (name: string) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, name)
      // The native 'storage' event only fires for OTHER tabs — dispatch a
      // custom event so this tab's hook re-renders too.
      window.dispatchEvent(new Event('porto:user-change'))
    } catch {}
  }

  // Since useSyncExternalStore handles SSR/hydration, we consider the user
  // "hydrated" as soon as the component is mounted on the client.
  return { user, setUser, hydrated: true }
}
