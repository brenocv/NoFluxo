'use client'

// React hook that loads the initial app state from /api/data, keeps it in
// local React state, and applies live updates from the socket.io service
// so two devices (e.g. Breno and Kiki) always see the same numbers.
import { useCallback, useEffect, useState } from 'react'
import {
  ActivityEntry,
  Category,
  ChangeMessage,
  PresenceUser,
  Transaction,
} from '@/lib/finance'
import { getSocket } from '@/lib/socket'

interface State {
  categories: Category[]
  transactions: Transaction[]
  config: Record<string, string>
  activity: ActivityEntry[]
  loading: boolean
  error: string | null
}

interface LiveMeta {
  connected: boolean
  presences: PresenceUser[]
  lastChange: { by: string; detail: string; at: number } | null
}

export function useFinanceData(currentUser: string) {
  const [state, setState] = useState<State>({
    categories: [],
    transactions: [],
    config: {},
    activity: [],
    loading: true,
    error: null,
  })
  const [live, setLive] = useState<LiveMeta>({
    connected: false,
    presences: [],
    lastChange: null,
  })

  // Initial load
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch('/api/data')
        if (!r.ok) throw new Error('Falha ao carregar dados')
        const data = await r.json()
        if (cancelled) return
        setState({
          categories: data.categories,
          transactions: data.transactions,
          config: data.config,
          activity: data.activity,
          loading: false,
          error: null,
        })
      } catch (e: any) {
        if (cancelled) return
        setState((s) => ({ ...s, loading: false, error: e.message || 'Erro' }))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Socket.io connection
  useEffect(() => {
    const socket = getSocket()

    const onConnect = () => {
      setLive((l) => ({ ...l, connected: true }))
      socket.emit('identify', { name: currentUser })
    }
    const onDisconnect = () => setLive((l) => ({ ...l, connected: false }))

    const onPresenceList = (users: PresenceUser[]) => {
      setLive((l) => ({ ...l, presences: users }))
    }
    const onPresenceJoined = (u: PresenceUser) => {
      setLive((l) => ({
        ...l,
        presences: l.presences.find((p) => p.id === u.id) ? l.presences : [...l.presences, u],
      }))
    }
    const onPresenceLeft = (u: PresenceUser) => {
      setLive((l) => ({ ...l, presences: l.presences.filter((p) => p.id !== u.id) }))
    }

    const onChange = (msg: ChangeMessage) => {
      // Apply the change to local state
      setState((s) => {
        switch (msg.type) {
          case 'transaction': {
            const t = msg.payload.transaction
            const category = msg.payload.category
            if (msg.action === 'delete') {
              return {
                ...s,
                transactions: s.transactions.filter((x) => x.id !== msg.payload.id),
              }
            }
            // create or update
            const exists = s.transactions.some((x) => x.id === t.id)
            const txs = exists
              ? s.transactions.map((x) => (x.id === t.id ? t : x))
              : [...s.transactions, t]
            return { ...s, transactions: txs }
          }
          case 'category': {
            if (msg.action === 'delete') {
              const id = msg.payload.id
              return {
                ...s,
                categories: s.categories.filter((c) => c.id !== id),
                transactions: s.transactions.filter((t) => t.categoryId !== id),
              }
            }
            const cat = msg.payload.category
            const exists = s.categories.some((c) => c.id === cat.id)
            const cats = exists
              ? s.categories.map((c) => (c.id === cat.id ? cat : c))
              : [...s.categories, cat]
            return { ...s, categories: cats }
          }
          case 'config': {
            return {
              ...s,
              config: { ...s.config, [msg.payload.key]: msg.payload.value },
            }
          }
          case 'activity': {
            return { ...s, activity: [msg.payload, ...s.activity].slice(0, 30) }
          }
          default:
            return s
        }
      })

      if (msg.detail) {
        setLive((l) => ({
          ...l,
          lastChange: {
            by: msg.by?.name ?? 'Anônimo',
            detail: msg.detail,
            at: msg.at,
          },
        }))
      }
    }

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('presence:list', onPresenceList)
    socket.on('presence:joined', onPresenceJoined)
    socket.on('presence:left', onPresenceLeft)
    socket.on('change', onChange)

    if (socket.connected) onConnect()

    // Local patch listener: when the local user performs a save, the page
    // dispatches a 'finance:patch' CustomEvent with the same shape as a
    // socket 'change' message, so we apply the update locally without waiting
    // for a round-trip through the server.
    const onLocalPatch = (e: Event) => {
      const detail = (e as CustomEvent).detail as ChangeMessage
      // Reuse the same handler as socket 'change' events
      onChange(detail)
      // Also surface the detail in the "last change" banner
      if (detail.detail) {
        setLive((l) => ({
          ...l,
          lastChange: {
            by: detail.by?.name ?? 'Anônimo',
            detail: detail.detail!,
            at: detail.at,
          },
        }))
      }
    }
    window.addEventListener('finance:patch', onLocalPatch as EventListener)

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('presence:list', onPresenceList)
      socket.off('presence:joined', onPresenceJoined)
      socket.off('presence:left', onPresenceLeft)
      socket.off('change', onChange)
      window.removeEventListener('finance:patch', onLocalPatch as EventListener)
    }
  }, [currentUser])

  // Broadcast a change to other clients (called after we successfully persist
  // to the server).
  const broadcast = useCallback((msg: Omit<ChangeMessage, 'by' | 'at'>) => {
    const socket = getSocket()
    if (socket.connected) socket.emit('change', msg)
  }, [])

  return { ...state, live, broadcast }
}
