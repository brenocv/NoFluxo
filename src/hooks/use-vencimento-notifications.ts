'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSyncExternalStore } from 'react'

// Parse "vence dia 11", "dia 5", "vence 11" from a note
function parseVencimentoDay(note: string | null): number | null {
  if (!note) return null
  const m = note.match(/(?:vence\s+)?dia?\s*(\d{1,2})/i)
  if (!m) return null
  const day = parseInt(m[1], 10)
  if (day < 1 || day > 31) return null
  return day
}

interface Vencimento {
  name: string
  day: number
  daysUntil: number
}

// Read initial permission/enabled state lazily to avoid setState-in-effect
function getInitialPermission(): NotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'default'
  return Notification.permission
}

function getInitialEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem('porto_notifications_enabled') === '1' &&
      typeof Notification !== 'undefined' &&
      Notification.permission === 'granted'
  } catch {
    return false
  }
}

export function useVencimentoNotifications(
  categories: { name: string; note: string | null; type: string }[]
) {
  const [permission, setPermission] = useState<NotificationPermission>(getInitialPermission)
  const [enabled, setEnabled] = useState<boolean>(getInitialEnabled)

  // Request permission
  const requestPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    const result = await Notification.requestPermission()
    setPermission(result)
    if (result === 'granted') {
      setEnabled(true)
      localStorage.setItem('porto_notifications_enabled', '1')
    }
  }, [])

  // Disable notifications
  const disable = useCallback(() => {
    setEnabled(false)
    localStorage.setItem('porto_notifications_enabled', '0')
  }, [])

  // Compute vencimentos for today
  const computeVencimentos = useCallback((): Vencimento[] => {
    const now = new Date()
    const currentDay = now.getDate()
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const result: Vencimento[] = []
    for (const c of categories) {
      if (c.type !== 'EXPENSE') continue
      const day = parseVencimentoDay(c.note)
      if (day === null) continue
      const adjustedDay = Math.min(day, daysInMonth)
      const daysUntil = adjustedDay - currentDay
      result.push({ name: c.name, day: adjustedDay, daysUntil })
    }
    return result
  }, [categories])

  // Check and fire notifications
  useEffect(() => {
    if (!enabled || permission !== 'granted') return
    if (typeof window === 'undefined' || !('Notification' in window)) return

    const check = () => {
      const vencs = computeVencimentos()
      const todayKey = new Date().toISOString().slice(0, 10)

      for (const v of vencs) {
        // Notify 3 days before, 1 day before, and on the day
        if ([0, 1, 3].includes(v.daysUntil)) {
          const notifKey = `porto_notif_${v.name}_${v.daysUntil}_${todayKey}`
          if (localStorage.getItem(notifKey)) continue // Already notified today

          const msg = v.daysUntil === 0
            ? `"${v.name}" vence HOJE (dia ${v.day})`
            : v.daysUntil === 1
              ? `"${v.name}" vence AMANHÃ (dia ${v.day})`
              : `"${v.name}" vence em ${v.daysUntil} dias (dia ${v.day})`

          try {
            new Notification('Vencimento próximo', {
              body: msg,
              icon: '/logo.svg',
              tag: notifKey,
            })
            localStorage.setItem(notifKey, '1')
          } catch {
            // ignore
          }
        }
      }
    }

    // Check immediately
    check()
    // Check every 30 minutes
    const interval = setInterval(check, 30 * 60 * 1000)
    return () => clearInterval(interval)
  }, [enabled, permission, computeVencimentos])

  return {
    permission,
    enabled,
    requestPermission,
    disable,
    supported: typeof window !== 'undefined' && 'Notification' in window,
  }
}
