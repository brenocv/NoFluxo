'use client'

import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'porto_workbook_id'

function subscribe(cb: () => void) {
  window.addEventListener('storage', cb)
  window.addEventListener('porto:workbook-change', cb)
  return () => {
    window.removeEventListener('storage', cb)
    window.removeEventListener('porto:workbook-change', cb)
  }
}

function getSnapshot(): string {
  try { return window.localStorage.getItem(STORAGE_KEY) ?? '' } catch { return '' }
}

function getServerSnapshot(): string {
  return ''
}

export function useCurrentWorkbook() {
  const workbookId = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const setWorkbook = (id: string) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, id)
      window.dispatchEvent(new Event('porto:workbook-change'))
    } catch {}
  }

  return { workbookId, setWorkbook }
}
