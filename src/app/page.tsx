'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useFinanceData } from '@/hooks/use-finance-data'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useActionHistory } from '@/hooks/use-action-history'
import { useCurrentWorkbook } from '@/hooks/use-current-workbook'
import {
  saveTransaction,
  stopRecurringSeries,
  copyMonth,
  resetValues,
  createCategory,
  deleteCategory,
  updateCategory,
  updateConfig,
  updateLabel,
  createSubgroup,
  deleteSubgroup,
  reorderCategories,
} from '@/lib/actions'
import {
  ActivityEntry,
  Category,
  CategoryGroup,
  CategoryType,
  Currency,
  GroupTreeNode,
  buildGroupTree,
  getGroupLabel,
  MONTHS_PT,
  Transaction,
} from '@/lib/finance'
import { MonthSelector } from '@/components/finance/month-selector'
import { SummaryCard } from '@/components/finance/summary-card'
import { GroupNode } from '@/components/finance/gnode'
import { TransactionEditor } from '@/components/finance/transaction-editor'
import { CategoryEditor } from '@/components/finance/cat-editor'
import { SubgroupEditor } from '@/components/finance/subgroup-editor'
import { ActivityPanel } from '@/components/finance/activity-panel'
import { SettingsDialog } from '@/components/finance/settings-dialog'
import { SearchBar } from '@/components/finance/search-bar'
import { MonthlyChart } from '@/components/finance/monthly-chart'
import { ExpensePieChart } from '@/components/finance/expense-pie-chart'
import { CopyMonthDialog } from '@/components/finance/copy-month-dialog'
import { ResetDialog } from '@/components/finance/reset-dialog'
import { NotesPanel } from '@/components/finance/notes-panel'
import { ThemeToggle } from '@/components/theme-toggle'
import { UndoRedoButtons } from '@/components/finance/undo-redo-buttons'
import { VencimentoAlerts } from '@/components/finance/vencimento-alerts'
import { AnnualDashboard } from '@/components/finance/annual-dashboard'
import { MoveCategoryDialog } from '@/components/finance/move-category-dialog'
import { BackupDialog } from '@/components/finance/backup-dialog'
import { ImportStatementDialog } from '@/components/finance/import-dialog'
import { BudgetCard } from '@/components/finance/budget-card'
import { WorkbookSwitcher } from '@/components/finance/workbook-switcher'
import { NewCardDialog } from '@/components/finance/new-card-dialog'
import { PrevBalanceCard } from '@/components/finance/prev-balance-card'
import { useVencimentoNotifications } from '@/hooks/use-vencimento-notifications'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Wifi, WifiOff, Settings, Plus, Eye, EyeOff, Download, Copy, Eraser,
  Database, Bell, BellOff, Upload,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const USER_COLOR = '#16a34a'
const RECEIVABLES_TOGGLE_KEY = 'porto_finance_include_receivables'

export default function Home() {
  const { user, setUser, hydrated } = useCurrentUser()
  const { workbookId, setWorkbook } = useCurrentWorkbook()
  const [year, setYear] = useState<number>(2026)
  const [workbookOpen, setWorkbookOpen] = useState(false)
  const [workbookName, setWorkbookName] = useState<string>('')
  const {
    categories, transactions, config, labels, subgroups, topGroups, activity,
    loading, error, live, broadcast,
  } = useFinanceData(user, year, workbookId)

  const [month, setMonth] = useState<number>(() => new Date().getMonth() + 1)
  const [editTarget, setEditTarget] = useState<{ category: Category; tx: Transaction | null } | null>(null)
  const [newCatGroup, setNewCatGroup] = useState<CategoryGroup | null>(null)
  const [newCatParent, setNewCatParent] = useState<string | null>(null)
  const [newSubgroupParent, setNewSubgroupParent] = useState<{ key: string; label: string } | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [showOnlyFilled, setShowOnlyFilled] = useState(false)
  const [copyOpen, setCopyOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [moveTarget, setMoveTarget] = useState<Category | null>(null)
  const [backupOpen, setBackupOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [newCardOpen, setNewCardOpen] = useState(false)
  const history = useActionHistory()
  const notifications = useVencimentoNotifications(categories)
  const [includeReceivables, setIncludeReceivables] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    try { return window.localStorage.getItem(RECEIVABLES_TOGGLE_KEY) === '1' } catch { return false }
  })
  const [prevMonthBalance, setPrevMonthBalance] = useState<number | null>(null)
  const [prevMonthLabel, setPrevMonthLabel] = useState<string>('')

  const euroRate = parseFloat(config.euroToBrl ?? '6') || 6

  // Fetch workbook name when workbookId changes — also sets a default workbook if none is selected
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch('/api/workbooks')
        if (!r.ok) return
        const data = await r.json()
        if (cancelled) return
        const wb = data.workbooks.find((w: any) => w.id === workbookId)
        if (wb) {
          setWorkbookName(wb.name)
        } else if (data.workbooks.length > 0) {
          // Current workbook not found or empty — switch to first available
          setWorkbook(data.workbooks[0].id)
          setWorkbookName(data.workbooks[0].name)
        }
      } catch {}
    })()
    return () => { cancelled = true }
  }, [workbookId, setWorkbook])

  // Fetch previous month's closing balance whenever month or year changes
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch(`/api/previous-month-balance?year=${year}&month=${month}&workbookId=${workbookId}`)
        if (!r.ok) throw new Error('Falha')
        const data = await r.json()
        if (cancelled) return
        setPrevMonthBalance(data.balance)
        setPrevMonthLabel(data.prevMonthLabel)
      } catch {
        if (cancelled) return
        setPrevMonthBalance(null)
      }
    })()
    return () => { cancelled = true }
  }, [year, month])

  const handleToggleReceivables = useCallback((v: boolean) => {
    setIncludeReceivables(v)
    try { window.localStorage.setItem(RECEIVABLES_TOGGLE_KEY, v ? '1' : '0') } catch {}
  }, [])

  const dispatchChange = useCallback((
    type: 'transaction' | 'category' | 'config' | 'label' | 'activity' | 'subgroup',
    action: 'create' | 'update' | 'delete',
    payload: any,
    detail: string,
    activityEntry: Omit<ActivityEntry, 'id'>
  ) => {
    const envelope = { type, action, payload, by: { name: user, color: USER_COLOR }, at: Date.now(), detail }
    window.dispatchEvent(new CustomEvent('finance:patch', { detail: envelope }))
    window.dispatchEvent(new CustomEvent('finance:patch', {
      detail: { type: 'activity', action: 'create', payload: { ...activityEntry, id: `local-${Date.now()}` }, by: { name: user, color: USER_COLOR }, at: Date.now() },
    }))
    broadcast({ type, action, payload, detail })
    broadcast({ type: 'activity', action: 'create', payload: { ...activityEntry, id: `local-${Date.now()}` } })
  }, [user, broadcast])

  const txByCat = useMemo(() => {
    const m: Record<string, Transaction | undefined> = {}
    for (const t of transactions) {
      if (t.month === month && t.year === year) m[t.categoryId] = t
    }
    return m
  }, [transactions, month, year])

  // Highlighted category IDs for search (does NOT filter — all remain visible)
  const highlightedCategoryIds = useMemo(() => {
    const q = search.trim().toLowerCase()
    const ids = new Set<string>()
    if (!q) return ids
    for (const c of categories) {
      if (c.name.toLowerCase().includes(q) || (c.note?.toLowerCase().includes(q) ?? false)) {
        ids.add(c.id)
      }
    }
    return ids
  }, [categories, search])

  // Filter category IDs based on showOnlyFilled only (not search)
  const filteredCategoryIds = useMemo(() => {
    const q = search.trim().toLowerCase()
    const ids = new Set<string>()
    for (const c of categories) {
      let pass = true
      if (q) {
        const nameMatch = c.name.toLowerCase().includes(q)
        const noteMatch = c.note?.toLowerCase().includes(q) ?? false
        if (!nameMatch && !noteMatch) pass = false
      }
      if (pass) ids.add(c.id)
    }
    if (showOnlyFilled) {
      const filled = new Set<string>()
      for (const id of ids) {
        if (txByCat[id]) filled.add(id)
      }
      return filled
    }
    return ids
  }, [categories, search, showOnlyFilled, txByCat])

  // Build the recursive group tree (filtered by search)
  const groupTree = useMemo(() => {
    const filterSet = (search.trim() || showOnlyFilled) ? filteredCategoryIds : undefined
    return buildGroupTree(categories, subgroups, labels, topGroups, filterSet)
  }, [categories, subgroups, labels, filteredCategoryIds, search, showOnlyFilled])

  const totals = useMemo(() => {
    let entradasBRL = 0, saidasBRL = 0, entradasEUR = 0, saidasEUR = 0
    let reservasBRL = 0, receivablesBRL = 0, receivablesEUR = 0
    for (const c of categories) {
      const tx = txByCat[c.id]
      if (!tx) continue
      const v = tx.value
      if (c.excludeFromTotal) {
        if (c.currency === 'BRL') receivablesBRL += v
        else receivablesEUR += v
        continue
      }
      if (c.type === 'INCOME') {
        if (c.currency === 'BRL') entradasBRL += v
        else entradasEUR += v
      } else if (c.type === 'EXPENSE') {
        if (c.currency === 'BRL') saidasBRL += v
        else saidasEUR += v
      } else if (c.type === 'RESERVE') {
        reservasBRL += v
      }
    }
    // Integrate the previous month's closing balance into the current month
    if (prevMonthBalance !== null && prevMonthBalance !== 0) {
      if (prevMonthBalance < 0) {
        saidasBRL += Math.abs(prevMonthBalance)
      } else {
        entradasBRL += prevMonthBalance
      }
    }
    return { entradasBRL, saidasBRL, entradasEUR, saidasEUR, reservasBRL, receivablesBRL, receivablesEUR }
  }, [categories, txByCat, prevMonthBalance])

  const chartData = useMemo(() => {
    const months: { month: string; monthIdx: number; entradas: number; saidas: number; saldo: number }[] = []
    for (let m = 1; m <= 12; m++) {
      let entradas = 0, saidas = 0
      for (const c of categories) {
        if (c.excludeFromTotal) continue
        const tx = transactions.find((t) => t.categoryId === c.id && t.month === m && t.year === year)
        if (!tx) continue
        const vBRL = c.currency === 'BRL' ? tx.value : tx.value * euroRate
        if (c.type === 'INCOME') entradas += vBRL
        else if (c.type === 'EXPENSE') saidas += vBRL
      }
      months.push({ month: MONTHS_PT[m - 1], monthIdx: m, entradas, saidas, saldo: entradas - saidas })
    }
    return months
  }, [categories, transactions, euroRate, year])

  // ---- Scroll helpers ----
  const scrollToGroup = useCallback((topKey: string) => {
    const el = document.getElementById(`group-${topKey}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      el.classList.add('ring-2', 'ring-primary', 'ring-offset-2')
      setTimeout(() => { el.classList.remove('ring-2', 'ring-primary', 'ring-offset-2') }, 1500)
    }
  }, [])

  // ---- Handlers ----

  async function handleSaveTransaction(args: {
    value: number | null; note: string | null
    isRecurring: boolean; installmentsTotal: number | null
  }) {
    if (!editTarget) return
    const cat = editTarget.category
    const prevTx = editTarget.tx ? { ...editTarget.tx } : null
    try {
      const result = await saveTransaction({
        categoryId: cat.id, month, year,
        value: args.value, note: args.note, user,
        isRecurring: args.isRecurring,
        installmentsTotal: args.installmentsTotal,
      })
      if (result.action === 'noop') return

      const monthLabel = MONTHS_PT[month - 1]
      const actionVerb = result.action === 'create' ? 'Adicionou' : result.action === 'update' ? 'Atualizou' : 'Removeu'
      const valueStr = args.value !== null ? ` • ${cat.currency === 'BRL' ? 'R$' : '€'} ${args.value.toFixed(2)}` : ''
      const recurringStr = args.isRecurring && args.value !== null
        ? args.installmentsTotal ? ` (${args.installmentsTotal}x)` : ' (recorrente)'
        : ''
      const detail = `${actionVerb} ${cat.name} • ${monthLabel}/${year}${valueStr}${recurringStr}`

      const txs = result.transactions ?? (result.transaction ? [result.transaction] : [])
      dispatchChange('transaction', result.action as 'create' | 'update' | 'delete',
        txs.length > 0 ? { transactions: txs } : { id: editTarget.tx?.id },
        detail,
        { user, action: result.action, entity: 'transaction', detail, createdAt: new Date().toISOString() }
      )

      // Record undo/redo
      const newTxs = txs
      history.push({
        description: detail,
        undo: async () => {
          if (prevTx) {
            await saveTransaction({ categoryId: cat.id, month: prevTx.month, year: prevTx.year, value: prevTx.value, note: prevTx.note, user })
            dispatchChange('transaction', 'update', { transactions: [prevTx] }, `Desfez: ${detail}`,
              { user, action: 'update', entity: 'transaction', detail: `Desfez: ${detail}`, createdAt: new Date().toISOString() })
          } else {
            for (const t of newTxs) {
              await saveTransaction({ categoryId: cat.id, month: t.month, year: t.year, value: null, note: null, user })
            }
            dispatchChange('transaction', 'delete', { ids: newTxs.map((t: any) => t.id) }, `Desfez: ${detail}`,
              { user, action: 'delete', entity: 'transaction', detail: `Desfez: ${detail}`, createdAt: new Date().toISOString() })
          }
        },
        redo: async () => {
          const r = await saveTransaction({ categoryId: cat.id, month, year, value: args.value, note: args.note, user, isRecurring: args.isRecurring, installmentsTotal: args.installmentsTotal })
          const rTxs = r.transactions ?? (r.transaction ? [r.transaction] : [])
          dispatchChange('transaction', r.action as 'create' | 'update' | 'delete',
            rTxs.length > 0 ? { transactions: rTxs } : { id: prevTx?.id },
            `Refazendo: ${detail}`,
            { user, action: r.action, entity: 'transaction', detail: `Refazendo: ${detail}`, createdAt: new Date().toISOString() })
        },
      })

      toast.success(args.value === null ? `${cat.name} removido` : args.isRecurring ? `${cat.name} recorrente criado` : `${cat.name} atualizado`)
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar')
    }
  }

  async function handleClearTransaction() {
    await handleSaveTransaction({ value: null, note: null, isRecurring: false, installmentsTotal: null })
  }

  async function handleStopRecurring() {
    if (!editTarget?.tx?.seriesId) return
    try {
      const r = await stopRecurringSeries(editTarget.tx.seriesId, month, year, user)
      const detail = `Parou recorrência de ${editTarget.category.name} • ${r.deletedCount} parcela(s) futura(s) removida(s)`
      dispatchChange('transaction', 'delete',
        { seriesId: editTarget.tx.seriesId, afterMonth: month },
        detail,
        { user, action: 'delete', entity: 'transaction', detail, createdAt: new Date().toISOString() }
      )
      toast.success(`Recorrência parada • ${r.deletedCount} parcela(s) removida(s)`)
    } catch (e: any) {
      toast.error(e.message || 'Erro ao parar recorrência')
    }
  }

  async function handleStopRecurringFromList(seriesId: string, currentMonth: number) {
    try {
      const r = await stopRecurringSeries(seriesId, currentMonth, year, user)
      const tx = transactions.find((t) => t.seriesId === seriesId)
      const cat = tx ? categories.find((c) => c.id === tx.categoryId) : null
      const detail = `Parou recorrência${cat ? ` de ${cat.name}` : ''} • ${r.deletedCount} parcela(s) futura(s) removida(s)`
      dispatchChange('transaction', 'delete', { seriesId, afterMonth: currentMonth }, detail,
        { user, action: 'delete', entity: 'transaction', detail, createdAt: new Date().toISOString() })
      toast.success(`Recorrência parada • ${r.deletedCount} parcela(s) removida(s)`)
    } catch (e: any) {
      toast.error(e.message || 'Erro ao parar recorrência')
    }
  }

  async function handleUpdateCategory(fields: {
    name?: string; note?: string | null; monthlyGoal?: number | null
    currency?: 'BRL' | 'EUR'; color?: string | null
  }) {
    if (!editTarget) return
    const prevCat = { ...editTarget.category }
    try {
      const r = await updateCategory(editTarget.category.id, fields, user)
      const detail = `Editou categoria "${r.category.name}"`
      dispatchChange('category', 'update', { category: r.category }, detail, {
        user, action: 'update', entity: 'category', detail, createdAt: new Date().toISOString(),
      })
      history.push({
        description: detail,
        undo: async () => {
          const rr = await updateCategory(prevCat.id, {
            name: prevCat.name, note: prevCat.note, monthlyGoal: prevCat.monthlyGoal,
            currency: prevCat.currency, color: prevCat.color,
          }, user)
          dispatchChange('category', 'update', { category: rr.category }, `Desfez: ${detail}`, {
            user, action: 'update', entity: 'category', detail: `Desfez: ${detail}`, createdAt: new Date().toISOString(),
          })
        },
        redo: async () => {
          const rr = await updateCategory(prevCat.id, fields, user)
          dispatchChange('category', 'update', { category: rr.category }, `Refazendo: ${detail}`, {
            user, action: 'update', entity: 'category', detail: `Refazendo: ${detail}`, createdAt: new Date().toISOString(),
          })
        },
      })
    } catch (e: any) {
      toast.error(e.message || 'Erro ao atualizar categoria')
    }
  }

  async function handleCreateCategory(args: {
    name: string; group: CategoryGroup; type: CategoryType; currency: Currency
    note?: string; excludeFromTotal?: boolean; monthlyGoal?: number | null; color?: string | null
  }) {
    try {
      const r = await createCategory({ ...args, parentCategoryId: newCatParent, workbookId, user })
      const detail = newCatParent
        ? `Criou sub-item "${r.category.name}"`
        : `Criou categoria "${r.category.name}"`
      dispatchChange('category', 'create', { category: r.category }, detail, {
        user, action: 'create', entity: 'category', detail, createdAt: new Date().toISOString(),
      })
      const createdCat = r.category
      history.push({
        description: detail,
        undo: async () => {
          await deleteCategory(createdCat.id, user)
          dispatchChange('category', 'delete', { id: createdCat.id }, `Desfez: ${detail}`, {
            user, action: 'delete', entity: 'category', detail: `Desfez: ${detail}`, createdAt: new Date().toISOString(),
          })
        },
        redo: async () => {
          const rr = await createCategory({ ...args, parentCategoryId: newCatParent, workbookId, user })
          dispatchChange('category', 'create', { category: rr.category }, `Refazendo: ${detail}`, {
            user, action: 'create', entity: 'category', detail: `Refazendo: ${detail}`, createdAt: new Date().toISOString(),
          })
        },
      })
      toast.success(newCatParent ? `Sub-item "${r.category.name}" criado` : `Categoria "${r.category.name}" criada`)
    } catch (e: any) {
      toast.error(e.message || 'Erro ao criar categoria')
    }
  }

  async function handleDeleteCategory(cat: Category) {
    if (!confirm(`Remover a categoria "${cat.name}"? Todas as transações associadas também serão removidas.`)) return
    const prevCat = { ...cat }
    try {
      await deleteCategory(cat.id, user)
      const detail = `Removeu categoria "${cat.name}"`
      dispatchChange('category', 'delete', { id: cat.id }, detail, {
        user, action: 'delete', entity: 'category', detail, createdAt: new Date().toISOString(),
      })
      history.push({
        description: detail,
        undo: async () => {
          const r = await createCategory({
            name: prevCat.name, group: prevCat.group, type: prevCat.type as any,
            currency: prevCat.currency, note: prevCat.note ?? undefined,
            excludeFromTotal: prevCat.excludeFromTotal, monthlyGoal: prevCat.monthlyGoal,
            color: prevCat.color, parentCategoryId: prevCat.parentCategoryId,
            workbookId, user,
          })
          dispatchChange('category', 'create', { category: r.category }, `Desfez: ${detail}`, {
            user, action: 'create', entity: 'category', detail: `Desfez: ${detail}`, createdAt: new Date().toISOString(),
          })
        },
        redo: async () => {
          await deleteCategory(prevCat.id, user)
          dispatchChange('category', 'delete', { id: prevCat.id }, `Refazendo: ${detail}`, {
            user, action: 'delete', entity: 'category', detail: `Refazendo: ${detail}`, createdAt: new Date().toISOString(),
          })
        },
      })
      toast.success(`Categoria "${cat.name}" removida`)
    } catch (e: any) {
      toast.error(e.message || 'Erro ao remover categoria')
    }
  }

  async function handleSaveEuroRate(v: number) {
    try {
      await updateConfig('euroToBrl', String(v), user)
      const detail = `Atualizou câmbio Euro → R$ ${v.toFixed(2)}`
      dispatchChange('config', 'update', { key: 'euroToBrl', value: String(v) }, detail, {
        user, action: 'update', entity: 'config', detail, createdAt: new Date().toISOString(),
      })
      toast.success('Cotação atualizada')
    } catch (e: any) {
      toast.error(e.message || 'Erro ao atualizar cotação')
    }
  }

  async function handleRename(key: string, value: string) {
    try {
      await updateLabel(key, value, user, workbookId)
      const detail = value === '' ? `Resetou rótulo` : `Renomeou para "${value}"`
      dispatchChange('label', 'update', { key, value }, detail, {
        user, action: 'update', entity: 'label', detail, createdAt: new Date().toISOString(),
      })
      history.push({
        description: detail,
        undo: async () => {
          // Can't easily undo rename without knowing the previous value
          // So we reload the page as a fallback
          window.location.reload()
        },
        redo: async () => {
          await updateLabel(key, value, user, workbookId)
          dispatchChange('label', 'update', { key, value }, `Refazendo: ${detail}`, {
            user, action: 'update', entity: 'label', detail: `Refazendo: ${detail}`, createdAt: new Date().toISOString(),
          })
        },
      })
      toast.success(value === '' ? 'Rótulo resetado' : 'Renomeado')
    } catch (e: any) {
      toast.error(e.message || 'Erro ao renomear')
    }
  }

  async function handleCreateSubgroup(name: string) {
    if (!newSubgroupParent) return
    try {
      const r = await createSubgroup(newSubgroupParent.key, name, user, workbookId)
      const detail = `Criou subgrupo "${r.subgroup.name}" dentro de ${newSubgroupParent.label}`
      dispatchChange('subgroup', 'create', { subgroup: r.subgroup }, detail, {
        user, action: 'create', entity: 'subgroup', detail, createdAt: new Date().toISOString(),
      })
      const createdSg = r.subgroup
      history.push({
        description: detail,
        undo: async () => {
          await deleteSubgroup(createdSg.key, user, workbookId)
          dispatchChange('subgroup', 'delete', { key: createdSg.key, deletedKeys: [createdSg.key], parentKey: createdSg.parentKey }, `Desfez: ${detail}`, {
            user, action: 'delete', entity: 'subgroup', detail: `Desfez: ${detail}`, createdAt: new Date().toISOString(),
          })
        },
        redo: async () => {
          const rr = await createSubgroup(newSubgroupParent.key, name, user, workbookId)
          dispatchChange('subgroup', 'create', { subgroup: rr.subgroup }, `Refazendo: ${detail}`, {
            user, action: 'create', entity: 'subgroup', detail: `Refazendo: ${detail}`, createdAt: new Date().toISOString(),
          })
        },
      })
      toast.success(`Subgrupo "${r.subgroup.name}" criado`)
    } catch (e: any) {
      toast.error(e.message || 'Erro ao criar subgrupo')
    }
  }

  async function handleDeleteSubgroup(node: GroupTreeNode) {
    if (!confirm(`Remover o subgrupo "${node.label}"? As categorias dentro dele serão movidas para o grupo pai.`)) return
    try {
      const r = await deleteSubgroup(node.key, user, workbookId)
      // Collect all descendant keys for local state update
      const deletedKeys = collectDescendantKeys(node)
      const detail = `Removeu subgrupo "${node.label}"`
      dispatchChange('subgroup', 'delete',
        { key: node.key, deletedKeys, parentKey: r.movedToParent },
        detail,
        { user, action: 'delete', entity: 'subgroup', detail, createdAt: new Date().toISOString() }
      )
      toast.success(`Subgrupo "${node.label}" removido`)
    } catch (e: any) {
      toast.error(e.message || 'Erro ao remover subgrupo')
    }
  }

  function collectDescendantKeys(node: GroupTreeNode): string[] {
    const keys = [node.key]
    for (const child of node.children) {
      if (child.isUserCreated) {
        keys.push(...collectDescendantKeys(child))
      }
    }
    return keys
  }

  async function handleCopyMonth(toYear: number, toMonth: number) {
    try {
      const r = await copyMonth({ fromYear: year, fromMonth: month, toYear, toMonth, user })
      const fromLabel = `${MONTHS_PT[month - 1]}/${year}`
      const toLabel = `${MONTHS_PT[toMonth - 1]}/${toYear}`
      const detail = `Copiou ${r.total} valor(es) de ${fromLabel} para ${toLabel}`
      if (toYear === year) {
        dispatchChange('transaction', 'create', { transactions: r.transactions }, detail, {
          user, action: 'create', entity: 'transaction', detail, createdAt: new Date().toISOString(),
        })
      } else {
        dispatchChange('activity', 'create', {
          id: `local-${Date.now()}`,
          user, action: 'create', entity: 'transaction',
          detail, createdAt: new Date().toISOString(),
        }, detail, {
          user, action: 'create', entity: 'transaction',
          detail, createdAt: new Date().toISOString(),
        })
      }
      toast.success(`${r.total} valor(es) copiado(s) para ${toLabel}`)
      const copiedTxs = r.transactions
      history.push({
        description: detail,
        undo: async () => {
          // Delete the copied transactions
          for (const t of copiedTxs) {
            await saveTransaction({ categoryId: t.categoryId, month: t.month, year: t.year, value: null, note: null, user })
          }
          if (toYear === year) {
            dispatchChange('transaction', 'delete', { ids: copiedTxs.map((t: any) => t.id) }, `Desfez: ${detail}`, {
              user, action: 'delete', entity: 'transaction', detail: `Desfez: ${detail}`, createdAt: new Date().toISOString(),
            })
          }
        },
        redo: async () => {
          const rr = await copyMonth({ fromYear: year, fromMonth: month, toYear, toMonth, user })
          if (toYear === year) {
            dispatchChange('transaction', 'create', { transactions: rr.transactions }, `Refazendo: ${detail}`, {
              user, action: 'create', entity: 'transaction', detail: `Refazendo: ${detail}`, createdAt: new Date().toISOString(),
            })
          }
        },
      })
    } catch (e: any) {
      toast.error(e.message || 'Erro ao copiar mês')
    }
  }

  async function handleReset(scope: 'month' | 'year') {
    const txsToDelete = transactions.filter((t) => {
      if (t.year !== year) return false
      if (scope === 'month' && t.month !== month) return false
      return true
    })
    try {
      const r = await resetValues({ scope, year, month, user })
      const detail = scope === 'month'
        ? `Zerou todos os valores de ${MONTHS_PT[month - 1]}/${year}`
        : `Zerou todos os valores de ${year}`
      dispatchChange('transaction', 'delete',
        scope === 'month' ? { deleteYear: year, deleteMonth: month } : { deleteYear: year },
        detail,
        { user, action: 'delete', entity: 'transaction', detail, createdAt: new Date().toISOString() }
      )
      const snapshot = txsToDelete.map((t) => ({
        categoryId: t.categoryId, year: t.year, month: t.month,
        value: t.value, note: t.note,
      }))
      history.push({
        description: detail,
        undo: async () => {
          for (const t of snapshot) {
            await saveTransaction({ categoryId: t.categoryId, month: t.month, year: t.year, value: t.value, note: t.note, user })
          }
          const refreshed = await fetch(`/api/data?year=${year}`).then((r) => r.json())
          if (refreshed.transactions) {
            dispatchChange('transaction', 'create', { transactions: refreshed.transactions }, `Desfez: ${detail}`,
              { user, action: 'create', entity: 'transaction', detail: `Desfez: ${detail}`, createdAt: new Date().toISOString() })
          }
        },
        redo: async () => {
          await resetValues({ scope, year, month, user })
          dispatchChange('transaction', 'delete',
            scope === 'month' ? { deleteYear: year, deleteMonth: month } : { deleteYear: year },
            `Refazendo: ${detail}`,
            { user, action: 'delete', entity: 'transaction', detail: `Refazendo: ${detail}`, createdAt: new Date().toISOString() })
        },
      })
      toast.success(`${r.deletedCount} valor(es) removido(s)`)
    } catch (e: any) {
      toast.error(e.message || 'Erro ao zerar valores')
    }
  }

  async function handleUndo() {
    try {
      await history.undo()
      toast.success('Ação desfeita')
      // Reload to ensure UI is in sync with DB after undo
      setTimeout(() => location.reload(), 500)
    } catch (e: any) { toast.error(e.message || 'Erro ao desfazer') }
  }

  async function handleRedo() {
    try {
      await history.redo()
      toast.success('Ação refeita')
      setTimeout(() => location.reload(), 500)
    } catch (e: any) { toast.error(e.message || 'Erro ao refazer') }
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); handleUndo() }
      else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); handleRedo() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [history])

  async function handleMoveCategory(newGroup: string, newParentCategoryId: string | null) {
    if (!moveTarget) return
    const prevGroup = moveTarget.group
    const prevParent = moveTarget.parentCategoryId
    try {
      const r = await updateCategory(moveTarget.id, { group: newGroup, parentCategoryId: newParentCategoryId }, user)
      const detail = `Moveu categoria "${r.category.name}"`
      dispatchChange('category', 'update', { category: r.category }, detail, {
        user, action: 'update', entity: 'category', detail, createdAt: new Date().toISOString(),
      })
      history.push({
        description: detail,
        undo: async () => {
          const rr = await updateCategory(moveTarget.id, { group: prevGroup, parentCategoryId: prevParent }, user)
          dispatchChange('category', 'update', { category: rr.category }, `Desfez: ${detail}`, {
            user, action: 'update', entity: 'category', detail: `Desfez: ${detail}`, createdAt: new Date().toISOString(),
          })
        },
        redo: async () => {
          const rr = await updateCategory(moveTarget.id, { group: newGroup, parentCategoryId: newParentCategoryId }, user)
          dispatchChange('category', 'update', { category: rr.category }, `Refazendo: ${detail}`, {
            user, action: 'update', entity: 'category', detail: `Refazendo: ${detail}`, createdAt: new Date().toISOString(),
          })
        },
      })
      toast.success('Categoria movida')
    } catch (e: any) {
      toast.error(e.message || 'Erro ao mover categoria')
    }
  }

  async function handleExportBackup() {
    try {
      toast.info('Gerando backup…')
      const r = await fetch('/api/backup')
      if (!r.ok) throw new Error('Falha')
      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `porto-backup-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Backup exportado')
    } catch (e: any) {
      toast.error(e.message || 'Erro ao exportar backup')
    }
  }

  async function handleImportBackup(file: File, mode: 'replace' | 'merge') {
    try {
      toast.info('Importando backup…')
      const text = await file.text()
      const backup = JSON.parse(text)
      const r = await fetch('/api/backup/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backup, mode, user }),
      })
      if (!r.ok) throw new Error('Falha')
      const data = await r.json()
      toast.success(`Backup importado: ${data.imported.transactions} transações`)
      // Reload to refresh all data
      setTimeout(() => location.reload(), 1000)
    } catch (e: any) {
      toast.error(e.message || 'Erro ao importar backup')
    }
  }

  async function handleExportExcel() {
    try {
      toast.info('Gerando Excel…')
      const r = await fetch(`/api/export?euroRate=${euroRate}&year=${year}`)
      if (!r.ok) throw new Error('Falha ao exportar')
      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Porto-${year}-${new Date().toISOString().slice(0, 10)}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Excel exportado')
    } catch (e: any) {
      toast.error(e.message || 'Erro ao exportar')
    }
  }

  // ---- Render ----

  if (!hydrated || loading || !workbookId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="h-10 w-10 mx-auto rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">Carregando suas finanças…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-2 max-w-md">
          <p className="text-base font-medium text-rose-600">Erro ao carregar</p>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button onClick={() => location.reload()} className="mt-2">Tentar novamente</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border">
        <div className="max-w-3xl mx-auto px-3 py-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
              €
            </div>
            <button
              onClick={() => setWorkbookOpen(true)}
              className="text-left touch-manipulation hover:opacity-80 transition-opacity"
            >
              <h1 className="text-sm font-semibold leading-none">{workbookName || 'Porto 2026'}</h1>
              <p className="text-[10px] text-muted-foreground">Controle financeiro • {year}</p>
            </button>
          </div>
          <div className="flex items-center gap-1">
            <Badge variant="outline" className={cn(
              'gap-1 px-1.5 py-0 h-7 text-[10px] hidden sm:flex',
              live.connected ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'
            )}>
              {live.connected ? <><Wifi className="h-3 w-3" /><span>Sincronizando</span></>
                : <><WifiOff className="h-3 w-3" /><span>Offline</span></>}
            </Badge>
            <UndoRedoButtons
              canUndo={history.canUndo}
              canRedo={history.canRedo}
              nextUndo={history.nextUndo}
              nextRedo={history.nextRedo}
              onUndo={handleUndo}
              onRedo={handleRedo}
            />
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCopyOpen(true)} aria-label="Copiar mês" title="Copiar valores para outro mês">
              <Copy className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setResetOpen(true)} aria-label="Zerar valores" title="Zerar valores do mês ou ano">
              <Eraser className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setImportOpen(true)} aria-label="Importar extrato" title="Importar extrato bancário (OFX/CSV)">
              <Upload className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setBackupOpen(true)} aria-label="Backup" title="Backup e restauração">
              <Database className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleExportExcel} aria-label="Exportar Excel">
              <Download className="h-4 w-4" />
            </Button>
            {notifications.supported && (
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => notifications.enabled ? notifications.disable() : notifications.requestPermission()}
                aria-label="Notificações"
                title={notifications.enabled ? 'Desativar notificações' : 'Ativar notificações de vencimento'}
              >
                {notifications.enabled ? <Bell className="h-4 w-4 text-emerald-600" /> : <BellOff className="h-4 w-4" />}
              </Button>
            )}
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setSettingsOpen(true)} aria-label="Configurações">
              <Settings className="h-4 w-4" />
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-3 py-3 space-y-3 pb-24">
        <MonthSelector selected={month} year={year} onSelect={setMonth} onYearChange={setYear} />

        <SummaryCard
          entradasBRL={totals.entradasBRL}
          saidasBRL={totals.saidasBRL}
          entradasEUR={totals.entradasEUR}
          saidasEUR={totals.saidasEUR}
          reservasBRL={totals.reservasBRL}
          receivablesBRL={totals.receivablesBRL}
          receivablesEUR={totals.receivablesEUR}
          includeReceivables={includeReceivables}
          onToggleReceivables={handleToggleReceivables}
          euroRate={euroRate}
          onEntradasClick={() => scrollToGroup('rendimentos')}
          onSaidasClick={() => scrollToGroup('despesas')}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <MonthlyChart data={chartData} selectedMonth={month} onSelectMonth={setMonth} euroRate={euroRate} />
          <ExpensePieChart categories={categories} transactionsByCat={txByCat} euroRate={euroRate} />
        </div>

        {/* Annual dashboard */}
        <AnnualDashboard
          data={chartData}
          selectedMonth={month}
          onSelectMonth={setMonth}
          euroRate={euroRate}
        />

        {/* Budget card — meta de poupança */}
        <BudgetCard year={year} user={user} workbookId={workbookId} />

        {/* Vencimento alerts */}
        <VencimentoAlerts
          categories={categories}
          currentDay={new Date().getDate()}
          daysInMonth={new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()}
        />

        <div className="space-y-2">
          <SearchBar value={search} onChange={setSearch} resultsCount={search.trim() ? highlightedCategoryIds.size : undefined} />
          <div className="flex items-center justify-between px-1">
            <Label htmlFor="only-filled" className="text-xs text-muted-foreground flex items-center gap-1.5 cursor-pointer">
              {showOnlyFilled ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              Mostrar só preenchidos
            </Label>
            <Switch id="only-filled" checked={showOnlyFilled} onCheckedChange={setShowOnlyFilled} />
          </div>
        </div>

        {/* Saldo do mês anterior — card separado, acima dos grupos */}
        <PrevBalanceCard
          balance={prevMonthBalance}
          prevMonthLabel={prevMonthLabel}
          euroRate={euroRate}
          onClick={() => {
            if (month === 1) { setYear(year - 1); setMonth(12) }
            else setMonth(month - 1)
          }}
        />

        {groupTree.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">
            Nenhuma categoria encontrada{search.trim() ? ` para "${search}"` : ''}.
          </div>
        ) : (
          groupTree.map((node) => (
            <GroupNode
              key={node.key}
              node={node}
              labels={labels}
              transactionsByCat={txByCat}
              allCategories={categories}
              euroRate={euroRate}
              highlightedCategoryIds={highlightedCategoryIds}
              onClearSearch={() => setSearch('')}
              onEdit={(cat, tx) => setEditTarget({ category: cat, tx: tx ?? null })}
              onAddCategory={(grp, parentCategoryId) => {
                // Always open the CategoryEditor — the + button creates a category
                setNewCatGroup(grp as CategoryGroup)
                setNewCatParent(parentCategoryId ?? null)
              }}
              onDeleteCategory={handleDeleteCategory}
              onRename={handleRename}
              onStopRecurring={handleStopRecurringFromList}
              onAddSubgroup={(parentKey) => setNewSubgroupParent({
                key: parentKey,
                label: getGroupLabel(parentKey, labels, subgroups),
              })}
              onDeleteSubgroup={handleDeleteSubgroup}
              onMoveCategory={(cat) => setMoveTarget(cat)}
              onReorder={async (catId, direction) => {
                // Find the category and its siblings
                const cat = categories.find((c) => c.id === catId)
                if (!cat) return
                const siblings = categories
                  .filter((c) => c.group === cat.group && (!c.parentCategoryId || c.parentCategoryId === cat.parentCategoryId))
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                const idx = siblings.findIndex((c) => c.id === catId)
                if (idx === -1) return
                const swapIdx = direction === 'up' ? idx - 1 : idx + 1
                if (swapIdx < 0 || swapIdx >= siblings.length) return
                const swapCat = siblings[swapIdx]
                // Swap sortOrder
                const items = [
                  { id: catId, sortOrder: swapCat.sortOrder },
                  { id: swapCat.id, sortOrder: cat.sortOrder },
                ]
                try {
                  await reorderCategories(items)
                  // Reload to reflect changes
                  setTimeout(() => location.reload(), 300)
                } catch (e: any) {
                  toast.error(e.message || 'Erro ao reordenar')
                }
              }}
              onColorChange={async (node, color) => {
                try {
                  const tg = topGroups.find((t) => t.key === node.key)
                  if (!tg) return
                  await fetch('/api/topgroups', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: tg.id, color, user }),
                  })
                  // Update local state
                  const updated = topGroups.map((t) => t.id === tg.id ? { ...t, color } : t)
                  // Trigger re-render by dispatching a change
                  dispatchChange('config', 'update', { key: 'topGroups', value: '' }, `Mudou cor do card "${node.label}"`, {
                    user, action: 'update', entity: 'config', detail: `Mudou cor do card "${node.label}"`, createdAt: new Date().toISOString(),
                  })
                  // Force reload of data
                  const r = await fetch(`/api/data?year=${year}&workbookId=${workbookId}`)
                  const data = await r.json()
                  if (data.topGroups) {
                    // The hook will re-render with new topGroups
                  }
                  toast.success("Cor atualizada"); setTimeout(() => location.reload(), 500)
                } catch (e: any) {
                  toast.error(e.message || 'Erro ao mudar cor')
                }
              }}
              onDeleteTopGroup={async (node) => {
                if (!confirm(`Remover o card "${node.label}"? As categorias serão movidas para o primeiro card.`)) return
                try {
                  const tg = topGroups.find((t) => t.key === node.key)
                  if (!tg) return
                  await fetch('/api/topgroups', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: tg.id, user }),
                  })
                  toast.success(`Card "${node.label}" removido`); setTimeout(() => location.reload(), 500)
                  // Reload data
                  const r = await fetch(`/api/data?year=${year}&workbookId=${workbookId}`)
                  const data = await r.json()
                  if (data.topGroups) {
                    dispatchChange('config', 'update', { key: 'topGroups', value: '' }, `Removeu card "${node.label}"`, {
                      user, action: 'delete', entity: 'config', detail: `Removeu card "${node.label}"`, createdAt: new Date().toISOString(),
                    })
                  }
                } catch (e: any) {
                  toast.error(e.message || 'Erro ao remover card')
                }
              }}
            />
          ))
        )}

        {/* New card button */}
        <button
          onClick={() => setNewCardOpen(true)}
          className="w-full flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground border-2 border-dashed border-border rounded-lg hover:bg-muted/30 hover:border-primary/50 transition-all touch-manipulation"
        >
          <Plus className="h-4 w-4" />
          Novo card
        </button>

        {/* Caderninho — lined-paper notes for the current month (above activity) */}
        <NotesPanel year={year} month={month} user={user} workbookId={workbookId} />

        <ActivityPanel activity={activity} presences={live.presences} currentUser={user} />

        {live.lastChange && Date.now() - live.lastChange.at < 5000 && (
          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 max-w-md w-[calc(100%-1.5rem)]">
            <div className="bg-foreground/95 text-background text-xs px-3 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
              <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: USER_COLOR }} />
              <span className="flex-1 truncate"><strong>{live.lastChange.by}</strong> {live.lastChange.detail}</span>
            </div>
          </div>
        )}
      </main>

      <footer className="sticky bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="max-w-3xl mx-auto px-3 py-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Você é</span>
            <button onClick={() => setSettingsOpen(true)} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted hover:bg-muted/80 font-medium touch-manipulation">
              {user}
            </button>
          </div>
          <Button size="sm" onClick={() => { setNewCatGroup('despesas.cartoes'); setNewCatParent(null) }} className="h-8">
            <Plus className="h-4 w-4 mr-1" />
            Nova categoria
          </Button>
        </div>
      </footer>

      <TransactionEditor
        open={!!editTarget}
        category={editTarget?.category ?? null}
        transaction={editTarget?.tx ?? null}
        month={month}
        year={year}
        euroRate={euroRate}
        onOpenChange={(o) => !o && setEditTarget(null)}
        onSave={handleSaveTransaction}
        onClear={handleClearTransaction}
        onStopRecurring={handleStopRecurring}
        onUpdateCategory={handleUpdateCategory}
      />

      <CategoryEditor
        open={!!newCatGroup}
        group={newCatGroup}
        labels={labels}
        subgroups={subgroups}
        topGroups={topGroups}
        onOpenChange={(o) => !o && setNewCatGroup(null)}
        onCreate={handleCreateCategory}
      />

      <SubgroupEditor
        open={!!newSubgroupParent}
        parentKey={newSubgroupParent?.key ?? null}
        parentLabel={newSubgroupParent?.label ?? ''}
        onOpenChange={(o) => !o && setNewSubgroupParent(null)}
        onCreate={handleCreateSubgroup}
      />

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        currentUser={user}
        onSetUser={setUser}
        euroRate={euroRate}
        onSaveEuroRate={handleSaveEuroRate}
      />

      <CopyMonthDialog
        open={copyOpen}
        onOpenChange={setCopyOpen}
        fromYear={year}
        fromMonth={month}
        onCopy={handleCopyMonth}
      />

      <ResetDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        year={year}
        month={month}
        onReset={handleReset}
      />

      <MoveCategoryDialog
        open={!!moveTarget}
        category={moveTarget}
        labels={labels}
        subgroups={subgroups}
        topGroups={topGroups}
        onOpenChange={(o) => !o && setMoveTarget(null)}
        onMove={handleMoveCategory}
      />

      <BackupDialog
        open={backupOpen}
        onOpenChange={setBackupOpen}
        onExport={handleExportBackup}
        onImport={handleImportBackup}
      />

      <ImportStatementDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        workbookId={workbookId}
        year={year}
        month={month}
        user={user}
        onImported={() => {
          // Reload data after import
          dispatchChange('config', 'update', { key: 'reload', value: '' }, 'Importou extrato', {
            user, action: 'create', entity: 'transaction', detail: 'Importou extrato', createdAt: new Date().toISOString(),
          })
        }}
      />

      <WorkbookSwitcher
        open={workbookOpen}
        onOpenChange={setWorkbookOpen}
        currentWorkbookId={workbookId}
        onSelect={(id) => setWorkbook(id)}
        onCreate={async (name, copyFrom) => {
          try {
            const r = await fetch('/api/workbooks', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name, user, copyFrom }),
            })
            if (!r.ok) throw new Error('Falha')
            const data = await r.json()
            setWorkbook(data.workbook.id)
            setWorkbookName(data.workbook.name)
            toast.success(`Planilha "${name}" criada`)
          } catch (e: any) {
            toast.error(e.message || 'Erro ao criar planilha')
          }
        }}
        onRename={async (id, name) => {
          try {
            const r = await fetch('/api/workbooks', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id, name, user }),
            })
            if (!r.ok) throw new Error('Falha')
            if (id === workbookId) setWorkbookName(name)
            toast.success('Planilha renomeada')
          } catch (e: any) {
            toast.error(e.message || 'Erro ao renomear')
          }
        }}
        onDelete={async (id) => {
          try {
            const r = await fetch('/api/workbooks', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id, user }),
            })
            if (!r.ok) {
              const err = await r.json().catch(() => ({}))
              throw new Error(err.error || 'Falha')
            }
            toast.success('Planilha removida')
          } catch (e: any) {
            toast.error(e.message || 'Erro ao remover planilha')
          }
        }}
      />

      <NewCardDialog
        open={newCardOpen}
        onOpenChange={setNewCardOpen}
        onCreate={async (name, type, color) => {
          try {
            const r = await fetch('/api/topgroups', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ workbookId, name, color, type, user }),
            })
            if (!r.ok) throw new Error('Falha')
            toast.success(`Card "${name}" criado`)
            setTimeout(() => location.reload(), 500)
          } catch (e: any) {
            toast.error(e.message || 'Erro ao criar card')
          }
        }}
      />
    </div>
  )
}
