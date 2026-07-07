'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  ActivityEntry,
  Category,
  ChangeMessage,
  PresenceUser,
  Subgroup,
  Transaction,
} from '@/lib/finance'
import { getSocket } from '@/lib/socket'

interface State {
  categories: Category[]
  transactions: Transaction[]
  config: Record<string, string>
  labels: Record<string, string>
  subgroups: Subgroup[]
  activity: ActivityEntry[]
  loading: boolean
  error: string | null
}

interface LiveMeta {
  connected: boolean
  presences: PresenceUser[]
  lastChange: { by: string; detail: string; at: number } | null
}

export function useFinanceData(currentUser: string, year: number, workbookId: string) {
  const [state, setState] = useState<State>({
    categories: [],
    transactions: [],
    config: {},
    labels: {},
    subgroups: [],
    activity: [],
    loading: true,
    error: null,
  })
  const [live, setLive] = useState<LiveMeta>({
    connected: false,
    presences: [],
    lastChange: null,
  })

  // Initial load — re-fetches whenever the year changes
  useEffect(() => {
    let cancelled = false
    setState((s) => ({ ...s, loading: true, error: null }))
    ;(async () => {
      try {
        const r = await fetch(`/api/data?year=${year}&workbookId=${workbookId}`)
        if (!r.ok) throw new Error('Falha ao carregar dados')
        const data = await r.json()
        if (cancelled) return
        setState({
          categories: data.categories,
          transactions: data.transactions,
          config: data.config,
          labels: data.labels ?? {},
          subgroups: data.subgroups ?? [],
          activity: data.activity,
          loading: false,
          error: null,
        })
      } catch (e: any) {
        if (cancelled) return
        setState((s) => ({ ...s, loading: false, error: e.message || 'Erro' }))
      }
    })()
    return () => { cancelled = true }
  }, [year, workbookId])

  // Socket.io connection (does not depend on year)
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
      setState((s) => {
        switch (msg.type) {
          case 'transaction': {
            const t = msg.payload.transaction
            if (msg.action === 'delete') {
              if (msg.payload.ids) {
                const idSet = new Set(msg.payload.ids)
                return { ...s, transactions: s.transactions.filter((x) => !idSet.has(x.id)) }
              }
              if (msg.payload.id) {
                return { ...s, transactions: s.transactions.filter((x) => x.id !== msg.payload.id) }
              }
              if (msg.payload.seriesId && msg.payload.afterMonth) {
                return {
                  ...s,
                  transactions: s.transactions.filter((x) =>
                    !(x.seriesId === msg.payload.seriesId && x.month > msg.payload.afterMonth)
                  ),
                }
              }
              // Bulk delete (e.g. reset month/year): delete by year [+month]
              if (msg.payload.deleteYear) {
                return {
                  ...s,
                  transactions: s.transactions.filter((x) => {
                    if (x.year !== msg.payload.deleteYear) return true
                    if (msg.payload.deleteMonth && x.month !== msg.payload.deleteMonth) return true
                    return false
                  }),
                }
              }
              return s
            }
            // create or update
            if (msg.payload.transactions) {
              const txs = msg.payload.transactions as Transaction[]
              const ids = new Set(txs.map((t) => t.id))
              return {
                ...s,
                transactions: [
                  ...s.transactions.filter((x) => !ids.has(x.id)),
                  ...txs,
                ],
              }
            }
            if (t) {
              const exists = s.transactions.some((x) => x.id === t.id)
              const txs = exists
                ? s.transactions.map((x) => (x.id === t.id ? t : x))
                : [...s.transactions, t]
              return { ...s, transactions: txs }
            }
            return s
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
            return { ...s, config: { ...s.config, [msg.payload.key]: msg.payload.value } }
          }
          case 'label': {
            const labels = { ...s.labels }
            if (msg.payload.value === '' || msg.payload.value === undefined) {
              delete labels[msg.payload.key]
            } else {
              labels[msg.payload.key] = msg.payload.value
            }
            return { ...s, labels }
          }
          case 'subgroup': {
            if (msg.action === 'delete') {
              // Move categories from deleted subgroup (and descendants) to parent
              const deletedKeys = new Set(msg.payload.deletedKeys as string[] ?? [msg.payload.key])
              const parentKey = msg.payload.parentKey as string
              return {
                ...s,
                subgroups: s.subgroups.filter((sg) => !deletedKeys.has(sg.key)),
                categories: s.categories.map((c) =>
                  deletedKeys.has(c.group) ? { ...c, group: parentKey } : c
                ),
              }
            }
            // create
            const sg = msg.payload.subgroup as Subgroup
            const exists = s.subgroups.some((x) => x.key === sg.key)
            const subgroups = exists
              ? s.subgroups.map((x) => (x.key === sg.key ? sg : x))
              : [...s.subgroups, sg]
            return { ...s, subgroups }
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

    const onLocalPatch = (e: Event) => {
      const detail = (e as CustomEvent).detail as ChangeMessage
      onChange(detail)
      if (detail.detail) {
        setLive((l) => ({
          ...l,
          lastChange: {
            by: detail.by?.name ?? 'Anônimo',
            detail: detail.detail,
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

  const broadcast = useCallback((msg: Omit<ChangeMessage, 'by' | 'at'>) => {
    const socket = getSocket()
    if (socket.connected) socket.emit('change', msg)
  }, [])

  return { ...state, live, broadcast }
}
