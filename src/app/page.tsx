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
  reorderSubgroups,
  reorderTopGroups,
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
import { GroupNode } from '@/components/finance/gn6'
import { TransactionEditor } from '@/components/finance/transaction-editor'
import { CategoryEditor } from '@/components/finance/cat-editor'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { User, LogOut } from 'lucide-react'
import { Input as UiInput } from '@/components/ui/input'

// Switch User component (inline)
function SwitchUserContent({ accountName, currentUser, onSelectUser, onLogout }: {
  accountName: string
  currentUser: string
  onSelectUser: (name: string) => void
  onLogout: () => void
}) {
  const [newUserName, setNewUserName] = useState('')
  const [users, setUsers] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(`nofluxo_users_${accountName}`)
      return stored ? JSON.parse(stored) : []
    } catch { return [] }
  })

  function handleCreate() {
    if (!newUserName.trim()) return
    const updated = [...users, newUserName.trim()]
    setUsers(updated)
    localStorage.setItem(`nofluxo_users_${accountName}`, JSON.stringify(updated))
    onSelectUser(newUserName.trim())
    setNewUserName('')
  }

  return (
    <div className="space-y-3 py-2">
      {users.map((u) => (
        <button
          key={u}
          onClick={() => onSelectUser(u)}
          className={cn(
            'w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all touch-manipulation',
            u === currentUser ? 'border-primary bg-primary/5' : 'border-border bg-background hover:bg-muted/50'
          )}
        >
          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <User className="h-4 w-4 text-primary" />
          </div>
          <span className="font-medium text-foreground">{u}</span>
          {u === currentUser && <span className="text-xs text-primary ml-auto">atual</span>}
        </button>
      ))}

      <div className="flex gap-2 pt-2">
        <UiInput
          value={newUserName}
          onChange={(e) => setNewUserName(e.target.value)}
          placeholder="Novo usuário..."
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          className="flex-1"
        />
        <Button onClick={handleCreate} disabled={!newUserName.trim()} size="icon">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
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
import { DeleteSubgroupDialog } from '@/components/finance/delete-subgroup-dialog'
import { QuickAddDialog } from '@/components/finance/quick-add-dialog'
import { MergeSubgroupsDialog } from '@/components/finance/merge-subgroups-dialog'
import { SubItemEditor } from '@/components/finance/sub-item-editor'
import { BackupDialog } from '@/components/finance/backup-dialog'
import { ImportStatementDialog } from '@/components/finance/import-dialog'
import { BudgetCard } from '@/components/finance/budget-card'
import { WorkbookSwitcher } from '@/components/finance/workbook-switcher'
import { NewCardDialog } from '@/components/finance/new-card-dialog'
import { PrevBalanceCard } from '@/components/finance/prev-balance-card'
import { useVencimentoNotifications } from '@/hooks/use-vencimento-notifications'
import { LoginScreen } from '@/components/finance/login-screen'
import { CurrenciesDialog } from '@/components/finance/currencies-dialog'
import { CardAddChoiceDialog } from '@/components/finance/card-add-choice-dialog'
import { AddItemToCardDialog } from '@/components/finance/add-item-to-card-dialog'
import { getSecondaryCurrency } from '@/lib/currencies'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Settings, Plus, Eye, EyeOff, Copy, Eraser,
  Database, Bell, BellOff, Upload, Zap, Download, Coins,
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
  const [accountName, setAccountName] = useState('')
  const {
    categories, transactions, config, labels, subgroups, topGroups, activity,
    loading, error, live, broadcast,
  } = useFinanceData(user, year, workbookId, accountName)

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
  const [pendingDeleteSubgroup, setPendingDeleteSubgroup] = useState<GroupTreeNode | null>(null)
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [quickAddInitialGroup, setQuickAddInitialGroup] = useState<string | undefined>(undefined)
  const [mergeTarget, setMergeTarget] = useState<{
    draggedKey: string; targetKey: string; draggedLabel: string; targetLabel: string
    parentKey: string; parentLabel: string
  } | null>(null)
  const [newSubItemParent, setNewSubItemParent] = useState<{ id: string; name: string; group: string; type: string; currency: string } | null>(null)
  const [backupOpen, setBackupOpen] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [switchUserOpen, setSwitchUserOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [newCardOpen, setNewCardOpen] = useState(false)
  const [currenciesOpen, setCurrenciesOpen] = useState(false)
  // When user clicks the "+" button on a top-level CARD (Despesas/Rendimentos/Reservas),
  // we open a choice dialog: "adicionar item com valor" or "criar subgrupo".
  const [cardAddChoiceTarget, setCardAddChoiceTarget] = useState<{ key: string; name: string; type: 'EXPENSE' | 'INCOME' | 'RESERVE' } | null>(null)
  // When user chooses "adicionar item com valor", we open AddItemToCardDialog scoped to that card.
  const [addItemToCardTarget, setAddItemToCardTarget] = useState<{ key: string; name: string; type: 'EXPENSE' | 'INCOME' | 'RESERVE' } | null>(null)
  const history = useActionHistory()
  const notifications = useVencimentoNotifications(categories)
  const [includeReceivables, setIncludeReceivables] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    try { return window.localStorage.getItem(RECEIVABLES_TOGGLE_KEY) === '1' } catch { return false }
  })
  const [prevMonthBalance, setPrevMonthBalance] = useState<number | null>(null)
  const [prevMonthLabel, setPrevMonthLabel] = useState<string>('')

  const euroRate = parseFloat(config.euroToBrl ?? '6') || 6
  // The "secondary" currency is the one shown alongside BRL in values.
  // Default is EUR. User can pick another via CurrenciesDialog.
  const customCurrenciesList = (() => {
    try { return config.customCurrencies ? JSON.parse(config.customCurrencies) : [] } catch { return [] }
  })()
  const secondaryCurrencyInfo = getSecondaryCurrency(config, customCurrenciesList)

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
  // Only filter for showOnlyFilled, NOT for search (search uses highlight instead)
  const filteredCategoryIds = useMemo(() => {
    if (!showOnlyFilled) return undefined
    const ids = new Set<string>()
    for (const c of categories) {
      if (txByCat[c.id]) ids.add(c.id)
    }
    return ids
  }, [categories, search, showOnlyFilled, txByCat])

  // Build the recursive group tree (filtered by search)
  const groupTree = useMemo(() => {
    const filterSet = showOnlyFilled ? filteredCategoryIds : undefined
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
      const headerEl = document.querySelector('header')
      const headerHeight = headerEl ? headerEl.getBoundingClientRect().height : 0
      const top = el.getBoundingClientRect().top + window.scrollY - headerHeight - 12
      window.scrollTo({ top, behavior: 'smooth' })
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

      // Record undo/redo — use mutable ref to track the latest tx IDs across cycles
      const newTxs = txs
      const txIdsRef = { current: newTxs.map((t: any) => t.id) }
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
            dispatchChange('transaction', 'delete', { ids: txIdsRef.current }, `Desfez: ${detail}`,
              { user, action: 'delete', entity: 'transaction', detail: `Desfez: ${detail}`, createdAt: new Date().toISOString() })
          }
        },
        redo: async () => {
          const r = await saveTransaction({ categoryId: cat.id, month, year, value: args.value, note: args.note, user, isRecurring: args.isRecurring, installmentsTotal: args.installmentsTotal })
          const rTxs = r.transactions ?? (r.transaction ? [r.transaction] : [])
          txIdsRef.current = rTxs.map((t: any) => t.id)
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
    name?: string; note?: string | null; monthlyGoal?: number | null; interestRate?: number | null
    currency?: 'BRL' | 'EUR'; color?: string | null; excludeFromTotal?: boolean
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
            excludeFromTotal: prevCat.excludeFromTotal,
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
    name: string; group: CategoryGroup; type: CategoryType; currency: string
    note?: string; excludeFromTotal?: boolean; monthlyGoal?: number | null; interestRate?: number | null; color?: string | null
    value?: number | null
  }) {
    try {
      const r = await createCategory({ ...args, currency: args.currency as Currency, parentCategoryId: newCatParent, workbookId, user })
      const detail = newCatParent
        ? `Criou sub-item "${r.category.name}"`
        : `Criou categoria "${r.category.name}"`
      dispatchChange('category', 'create', { category: r.category }, detail, {
        user, action: 'create', entity: 'category', detail, createdAt: new Date().toISOString(),
      })

      // If a value was provided, create a transaction for the current month
      if (args.value !== null && args.value !== undefined && args.value > 0) {
        const txRes = await saveTransaction({
          categoryId: r.category.id,
          month,
          year,
          value: args.value,
          note: args.note ?? null,
          user,
        })
        const txs = txRes.transactions ?? (txRes.transaction ? [txRes.transaction] : [])
        if (txs.length > 0) {
          dispatchChange('transaction', txRes.action as any, { transactions: txs }, `Adicionou valor em "${r.category.name}"`, {
            user, action: 'create', entity: 'transaction', detail: `Adicionou valor em "${r.category.name}"`, createdAt: new Date().toISOString(),
          })
        }
      }

      const createdCat = r.category
      const idRef = { current: createdCat.id }
      history.push({
        description: detail,
        undo: async () => {
          await deleteCategory(idRef.current, user)
          dispatchChange('category', 'delete', { id: idRef.current }, `Desfez: ${detail}`, {
            user, action: 'delete', entity: 'category', detail: `Desfez: ${detail}`, createdAt: new Date().toISOString(),
          })
        },
        redo: async () => {
          const rr = await createCategory({ ...args, currency: args.currency as Currency, parentCategoryId: newCatParent, workbookId, user })
          idRef.current = rr.category.id
          dispatchChange('category', 'create', { category: rr.category }, `Refazendo: ${detail}`, {
            user, action: 'create', entity: 'category', detail: `Refazendo: ${detail}`, createdAt: new Date().toISOString(),
          })
          if (args.value !== null && args.value !== undefined && args.value > 0) {
            const txRes = await saveTransaction({
              categoryId: rr.category.id, month, year, value: args.value, note: args.note ?? null, user,
            })
            const txs = txRes.transactions ?? (txRes.transaction ? [txRes.transaction] : [])
            if (txs.length > 0) {
              dispatchChange('transaction', txRes.action as any, { transactions: txs }, `Refazendo: valor em "${rr.category.name}"`, {
                user, action: 'create', entity: 'transaction', detail: `Refazendo: valor`, createdAt: new Date().toISOString(),
              })
            }
          }
        },
      })
      toast.success(newCatParent ? `Sub-item "${r.category.name}" criado` : `Categoria "${r.category.name}" criada`)
    } catch (e: any) {
      toast.error(e.message || 'Erro ao criar categoria')
    }
  }

  async function handleQuickAdd(args: {
    name: string; value: number; currency: string; type: 'EXPENSE' | 'INCOME' | 'RESERVE'
    group: string; note?: string; isRecurring: boolean; installmentsTotal?: number | null
    newSubgroupName?: string; existingCategoryId?: string
  }) {
    try {
      // 0. If adding to an existing category, skip category creation
      if (args.existingCategoryId) {
        const txRes = await saveTransaction({
          categoryId: args.existingCategoryId,
          month, year,
          value: args.value,
          note: args.note ?? null,
          user,
          isRecurring: args.isRecurring,
          installmentsTotal: args.installmentsTotal ?? null,
        })
        const txs = txRes.transactions ?? (txRes.transaction ? [txRes.transaction] : [])
        if (txs.length > 0) {
          dispatchChange('transaction', txRes.action as any, { transactions: txs }, `Adicionou valor`, {
            user, action: 'create', entity: 'transaction', detail: `Adicionou valor`, createdAt: new Date().toISOString(),
          })
        }
        toast.success('Valor adicionado')
        return
      }

      // 0. If creating a new subgroup, create it first
      let finalGroup = args.group
      if (args.newSubgroupName) {
        const sgRes = await createSubgroup(args.group, args.newSubgroupName, user, workbookId)
        dispatchChange('subgroup', 'create', { subgroup: sgRes.subgroup }, `Criou subgrupo "${args.newSubgroupName}"`, {
          user, action: 'create', entity: 'subgroup', detail: `Criou subgrupo "${args.newSubgroupName}"`, createdAt: new Date().toISOString(),
        })
        finalGroup = sgRes.subgroup.key
      }

      // 1. Create the category
      const catRes = await createCategory({
        name: args.name,
        group: finalGroup,
        type: args.type as any,
        currency: args.currency as Currency,
        note: args.note,
        workbookId,
        user,
      })
      dispatchChange('category', 'create', { category: catRes.category }, `Criou categoria "${args.name}"`, {
        user, action: 'create', entity: 'category', detail: `Criou categoria "${args.name}"`, createdAt: new Date().toISOString(),
      })

      // 2. Create the transaction (with recurrence if applicable)
      const txRes = await saveTransaction({
        categoryId: catRes.category.id,
        month,
        year,
        value: args.value,
        note: args.note ?? null,
        user,
        isRecurring: args.isRecurring,
        installmentsTotal: args.installmentsTotal ?? null,
      })
      const txs = txRes.transactions ?? (txRes.transaction ? [txRes.transaction] : [])
      if (txs.length > 0) {
        dispatchChange('transaction', txRes.action as any, { transactions: txs }, `Adicionou ${args.name}`, {
          user, action: 'create', entity: 'transaction', detail: `Adicionou ${args.name}`, createdAt: new Date().toISOString(),
        })
      }

      const idRef = { current: catRes.category.id }
      const txIdsRef = { current: txs.map((t: any) => t.id) }
      history.push({
        description: `Adicionou ${args.name} • ${args.currency === 'BRL' ? 'R$' : '€'} ${args.value.toFixed(2)}`,
        undo: async () => {
          // Delete transactions
          for (const t of txs) {
            await saveTransaction({ categoryId: catRes.category.id, month: t.month, year: t.year, value: null, note: null, user })
          }
          // Delete category
          await deleteCategory(idRef.current, user)
          dispatchChange('category', 'delete', { id: idRef.current }, `Desfez: adicionou ${args.name}`, {
            user, action: 'delete', entity: 'category', detail: `Desfez: adicionou ${args.name}`, createdAt: new Date().toISOString(),
          })
        },
        redo: async () => {
          const rr = await createCategory({
            name: args.name, group: args.group, type: args.type as any,
            currency: args.currency as Currency, note: args.note, workbookId, user,
          })
          idRef.current = rr.category.id
          dispatchChange('category', 'create', { category: rr.category }, `Refazendo: adicionou ${args.name}`, {
            user, action: 'create', entity: 'category', detail: `Refazendo: adicionou ${args.name}`, createdAt: new Date().toISOString(),
          })
          const rt = await saveTransaction({
            categoryId: rr.category.id, month, year, value: args.value, note: args.note ?? null, user,
            isRecurring: args.isRecurring, installmentsTotal: args.installmentsTotal ?? null,
          })
          const rTxs = rt.transactions ?? (rt.transaction ? [rt.transaction] : [])
          txIdsRef.current = rTxs.map((t: any) => t.id)
          if (rTxs.length > 0) {
            dispatchChange('transaction', rt.action as any, { transactions: rTxs }, `Refazendo: adicionou ${args.name}`, {
              user, action: 'create', entity: 'transaction', detail: `Refazendo: adicionou ${args.name}`, createdAt: new Date().toISOString(),
            })
          }
        },
      })

      toast.success(`"${args.name}" adicionado`)
    } catch (e: any) {
      toast.error(e.message || 'Erro ao adicionar')
    }
  }

  // Add item with value directly to a CARD (no card chooser — comes from the
  // "+" button on the card itself). Similar to handleQuickAdd but always
  // scoped to the clicked card.
  async function handleAddItemToCard(
    cardKey: string,
    cardType: 'EXPENSE' | 'INCOME' | 'RESERVE',
    args: {
      name: string; value: number; currency: string; type: 'EXPENSE' | 'INCOME' | 'RESERVE'
      group: string; note?: string; isRecurring: boolean; installmentsTotal?: number | null
      newSubgroupName?: string
    }
  ) {
    try {
      // 1. If creating a new subgroup inside the card, create it first
      let finalGroup = args.group
      if (args.newSubgroupName) {
        const sgRes = await createSubgroup(cardKey, args.newSubgroupName, user, workbookId)
        dispatchChange('subgroup', 'create', { subgroup: sgRes.subgroup }, `Criou subgrupo "${args.newSubgroupName}"`, {
          user, action: 'create', entity: 'subgroup', detail: `Criou subgrupo "${args.newSubgroupName}"`, createdAt: new Date().toISOString(),
        })
        finalGroup = sgRes.subgroup.key
      }

      // 2. Create the category inside the card (or its new subgroup)
      const catRes = await createCategory({
        name: args.name,
        group: finalGroup,
        type: args.type as any,
        currency: args.currency as Currency,
        note: args.note,
        workbookId,
        user,
      })
      dispatchChange('category', 'create', { category: catRes.category }, `Criou categoria "${args.name}"`, {
        user, action: 'create', entity: 'category', detail: `Criou categoria "${args.name}"`, createdAt: new Date().toISOString(),
      })

      // 3. Create the transaction
      const txRes = await saveTransaction({
        categoryId: catRes.category.id,
        month,
        year,
        value: args.value,
        note: args.note ?? null,
        user,
        isRecurring: args.isRecurring,
        installmentsTotal: args.installmentsTotal ?? null,
      })
      const txs = txRes.transactions ?? (txRes.transaction ? [txRes.transaction] : [])
      if (txs.length > 0) {
        dispatchChange('transaction', txRes.action as any, { transactions: txs }, `Adicionou ${args.name}`, {
          user, action: 'create', entity: 'transaction', detail: `Adicionou ${args.name}`, createdAt: new Date().toISOString(),
        })
      }

      toast.success(`"${args.name}" adicionado`)
    } catch (e: any) {
      toast.error(e.message || 'Erro ao adicionar')
    }
  }

  async function handleMergeSubgroups(newSubgroupName: string) {
    if (!mergeTarget) return
    const { draggedKey, targetKey, parentKey } = mergeTarget
    try {
      // 1. Create the new parent subgroup
      const sgRes = await createSubgroup(parentKey, newSubgroupName, user, workbookId)
      dispatchChange('subgroup', 'create', { subgroup: sgRes.subgroup }, `Criou subgrupo "${newSubgroupName}"`, {
        user, action: 'create', entity: 'subgroup', detail: `Criou subgrupo "${newSubgroupName}"`, createdAt: new Date().toISOString(),
      })
      const newParentKey = sgRes.subgroup.key

      // 2. Move both dragged and target subgroups inside the new parent
      // Update each subgroup's parentKey via the API
      for (const key of [draggedKey, targetKey]) {
        const sg = subgroups.find((s) => s.key === key)
        if (!sg) continue
        // Update parentKey by calling the subgroups API PATCH (or a direct update)
        // Since there's no PATCH endpoint for subgroups, we'll use a direct approach:
        // Delete + recreate with new parentKey. But that changes the key.
        // Better: add a PATCH endpoint. For now, use the reorder approach with a custom call.
        await fetch('/api/subgroups', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, parentKey: newParentKey, workbookId, user }),
        })
      }

      // 3. Reload to get the updated tree
      window.dispatchEvent(new CustomEvent('finance:patch', {
        detail: { type: 'reload', action: 'update', payload: {}, by: { name: user, color: USER_COLOR }, at: Date.now() }
      }))
      broadcast({
        type: 'reload', action: 'update', payload: {},
        detail: `Agrupou subgrupos em "${newSubgroupName}"`,
      })

      toast.success(`Subgrupos agrupados em "${newSubgroupName}"`)
    } catch (e: any) {
      toast.error(e.message || 'Erro ao agrupar subgrupos')
    }
  }

  async function handleCreateSubItem(name: string) {
    if (!newSubItemParent) return
    try {
      const r = await createCategory({
        name,
        group: newSubItemParent.group,
        type: newSubItemParent.type as any,
        currency: newSubItemParent.currency as Currency,
        parentCategoryId: newSubItemParent.id,
        workbookId,
        user,
      })
      const detail = `Criou sub-item "${r.category.name}"`
      dispatchChange('category', 'create', { category: r.category }, detail, {
        user, action: 'create', entity: 'category', detail, createdAt: new Date().toISOString(),
      })
      toast.success(`Sub-item "${r.category.name}" criado`)
    } catch (e: any) {
      toast.error(e.message || 'Erro ao criar sub-item')
    }
  }

  async function handleDeleteCategory(cat: Category) {
    const hasTx = transactions.some((t) => t.categoryId === cat.id)
    let msg = `Remover a categoria "${cat.name}"?`
    if (hasTx) {
      msg += `\n\nEsta categoria tem transações associadas.\nDeseja remover também todos os valores?`
      if (!confirm(msg)) return
    } else {
      if (!confirm(msg)) return
    }
    const prevCat = { ...cat }
    const idRef = { current: prevCat.id }
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
          idRef.current = r.category.id
          dispatchChange('category', 'create', { category: r.category }, `Desfez: ${detail}`, {
            user, action: 'create', entity: 'category', detail: `Desfez: ${detail}`, createdAt: new Date().toISOString(),
          })
        },
        redo: async () => {
          await deleteCategory(idRef.current, user)
          dispatchChange('category', 'delete', { id: idRef.current }, `Refazendo: ${detail}`, {
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
      await updateConfig('euroToBrl', String(v), user, workbookId)
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
      const keyRef = { current: createdSg.key }
      history.push({
        description: detail,
        undo: async () => {
          await deleteSubgroup(keyRef.current, user, workbookId, 'move')
          dispatchChange('subgroup', 'delete', { key: keyRef.current, deletedKeys: [keyRef.current], parentKey: createdSg.parentKey }, `Desfez: ${detail}`, {
            user, action: 'delete', entity: 'subgroup', detail: `Desfez: ${detail}`, createdAt: new Date().toISOString(),
          })
        },
        redo: async () => {
          const rr = await createSubgroup(newSubgroupParent.key, name, user, workbookId)
          keyRef.current = rr.subgroup.key
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

  // Subgroup deletion now uses a dialog (pendingDeleteSubgroup) so the user can
  // choose between moving categories to parent OR deleting everything.
  async function handleDeleteSubgroupConfirm(mode: 'move' | 'delete') {
    if (!pendingDeleteSubgroup) return
    const node = pendingDeleteSubgroup

    // Snapshot for undo — capture all subgroups + categories that will be affected
    const allKeysToDelete = collectDescendantKeys(node)
    const snapshotSubgroups = subgroups
      .filter((s) => allKeysToDelete.includes(s.key))
      .map((s) => ({ ...s }))
    const snapshotCategories = categories
      .filter((c) => allKeysToDelete.includes(c.group))
      .map((c) => ({ ...c }))
    // Also capture all transactions of those categories (for mode='delete')
    const snapshotCatIds = new Set(snapshotCategories.map((c) => c.id))
    const snapshotTransactions = transactions
      .filter((t) => snapshotCatIds.has(t.categoryId))
      .map((t) => ({ ...t }))
    const parentKey = node.key.split('.').slice(0, -1).join('.') || node.key

    try {
      const r = await deleteSubgroup(node.key, user, workbookId, mode)
      const deletedKeys = allKeysToDelete
      const detail = mode === 'delete'
        ? `Removeu subgrupo "${node.label}" (categorias excluídas)`
        : `Removeu subgrupo "${node.label}" (categorias movidas)`
      dispatchChange('subgroup', 'delete',
        {
          key: node.key,
          deletedKeys,
          parentKey: r.movedToParent || node.key,
          mode,
          deletedCategoryIds: r.deletedCategoryIds ?? [],
        },
        detail,
        { user, action: 'delete', entity: 'subgroup', detail, createdAt: new Date().toISOString() }
      )
      // If mode === 'delete', also dispatch a category delete for each affected category
      if (mode === 'delete' && r.deletedCategoryIds && r.deletedCategoryIds.length > 0) {
        for (const catId of r.deletedCategoryIds) {
          window.dispatchEvent(new CustomEvent('finance:patch', {
            detail: {
              type: 'category', action: 'delete', payload: { id: catId },
              by: { name: user, color: USER_COLOR }, at: Date.now(),
            }
          }))
        }
      }

      // Record undo/redo
      history.push({
        description: detail,
        undo: async () => {
          // Re-create subgroups with their original keys
          // Sort by depth ascending (parents first) so parent validation passes
          const sortedSgs = [...snapshotSubgroups].sort((a, b) =>
            a.key.split('.').length - b.key.split('.').length
          )
          for (const sg of sortedSgs) {
            try {
              const r = await fetch('/api/subgroups', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  parentKey: sg.parentKey,
                  name: sg.name,
                  key: sg.key,
                  sortOrder: sg.sortOrder,
                  user,
                  workbookId,
                }),
              })
              if (r.ok) {
                const data = await r.json()
                window.dispatchEvent(new CustomEvent('finance:patch', {
                  detail: {
                    type: 'subgroup', action: 'create', payload: { subgroup: data.subgroup },
                    by: { name: user, color: USER_COLOR }, at: Date.now(),
                  }
                }))
              }
            } catch {}
          }
          // Re-create categories (only for mode='delete'; for mode='move' the categories
          // still exist, just moved to parent — we need to move them back to the restored subgroups)
          if (mode === 'delete') {
            for (const cat of snapshotCategories) {
              try {
                const r = await fetch('/api/categories', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    id: cat.id,
                    name: cat.name,
                    group: cat.group,
                    type: cat.type,
                    currency: cat.currency,
                    note: cat.note,
                    sortOrder: cat.sortOrder,
                    excludeFromTotal: cat.excludeFromTotal,
                    monthlyGoal: cat.monthlyGoal,
                    color: cat.color,
                    parentCategoryId: cat.parentCategoryId,
                    workbookId,
                    user,
                  }),
                })
                if (r.ok) {
                  const data = await r.json()
                  window.dispatchEvent(new CustomEvent('finance:patch', {
                    detail: {
                      type: 'category', action: 'create', payload: { category: data.category },
                      by: { name: user, color: USER_COLOR }, at: Date.now(),
                    }
                  }))
                }
              } catch {}
            }
            // Restore transactions
            for (const tx of snapshotTransactions) {
              try {
                await fetch('/api/transactions', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    categoryId: tx.categoryId,
                    month: tx.month,
                    year: tx.year,
                    value: tx.value,
                    note: tx.note,
                    user,
                  }),
                })
              } catch {}
            }
          } else {
            // mode === 'move' — categories still exist but their group was changed to parent.
            // Move them back to the original subgroup.
            for (const cat of snapshotCategories) {
              try {
                await updateCategory(cat.id, { group: cat.group, parentCategoryId: cat.parentCategoryId }, user)
                window.dispatchEvent(new CustomEvent('finance:patch', {
                  detail: {
                    type: 'category', action: 'update',
                    payload: { category: { ...cat } },
                    by: { name: user, color: USER_COLOR }, at: Date.now(),
                  }
                }))
              } catch {}
            }
          }
          // Reload to ensure consistent state
          window.dispatchEvent(new CustomEvent('finance:patch', {
            detail: { type: 'reload', action: 'update', payload: {}, by: { name: user, color: USER_COLOR }, at: Date.now() }
          }))
        },
        redo: async () => {
          await deleteSubgroup(node.key, user, workbookId, mode)
          window.dispatchEvent(new CustomEvent('finance:patch', {
            detail: { type: 'reload', action: 'update', payload: {}, by: { name: user, color: USER_COLOR }, at: Date.now() }
          }))
        },
      })

      toast.success(`Subgrupo "${node.label}" removido`)
    } catch (e: any) {
      toast.error(e.message || 'Erro ao remover subgrupo')
    }
  }

  // Old name kept for compatibility — now just opens the dialog
  function handleDeleteSubgroup(node: GroupTreeNode) {
    setPendingDeleteSubgroup(node)
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
      const r = await copyMonth({ fromYear: year, fromMonth: month, toYear, toMonth, workbookId, user })
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
          const rr = await copyMonth({ fromYear: year, fromMonth: month, toYear, toMonth, workbookId, user })
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

  async function handleReset(scope: 'month' | 'year' | 'factory') {
    if (scope === 'factory') {
      // Factory reset: wipe everything back to default state. Cannot be undone.
      try {
        const r = await resetValues({ scope: 'factory', workbookId, user }) as any
        // Reload all data from server
        window.dispatchEvent(new CustomEvent('finance:patch', {
          detail: { type: 'reload' as any, action: 'update' as any, payload: {}, by: { name: user, color: USER_COLOR }, at: Date.now() }
        }))
        toast.success(`Planilha resetada: ${r.deletedCount} valor(es), ${r.deletedCategories} itens, ${r.deletedSubgroups} subgrupos, ${r.deletedTopGroups} cards removidos`)
      } catch (e: any) {
        toast.error(e.message || 'Erro ao resetar planilha')
      }
      return
    }

    const txsToDelete = transactions.filter((t) => {
      if (t.year !== year) return false
      if (scope === 'month' && t.month !== month) return false
      return true
    })
    try {
      const r = await resetValues({ scope, year, month, workbookId, user })
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
          await resetValues({ scope, year, month, workbookId, user })
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
      // Trigger a full data reload via the hook
      window.dispatchEvent(new CustomEvent('finance:patch', {
        detail: { type: 'reload', action: 'update', payload: {}, by: { name: user, color: USER_COLOR }, at: Date.now() }
      }))
    } catch (e: any) { toast.error(e.message || 'Erro ao desfazer') }
  }

  async function handleRedo() {
    try {
      await history.redo()
      toast.success('Ação refeita')
      window.dispatchEvent(new CustomEvent('finance:patch', {
        detail: { type: 'reload', action: 'update', payload: {}, by: { name: user, color: USER_COLOR }, at: Date.now() }
      }))
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
      const r = await fetch(`/api/backup?workbookId=${encodeURIComponent(workbookId)}`)
      if (!r.ok) throw new Error('Falha')
      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `nofluxo-backup-${new Date().toISOString().slice(0, 10)}.json`
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
        body: JSON.stringify({ backup, mode, workbookId, user }),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err.error || 'Falha ao importar. Nada foi alterado.')
      }
      const data = await r.json()
      toast.success(`Backup importado: ${data.imported.transactions} transações`)
      // Refresh data in place — a full page reload would also reset the
      // logged-in session, forcing the user to log in again right after
      // restoring their data. Also let other connected devices know to
      // refresh, since a restore can change basically everything.
      window.dispatchEvent(new CustomEvent('finance:patch', {
        detail: { type: 'reload', action: 'update', payload: {}, by: { name: user, color: '#16a34a' }, at: Date.now() }
      }))
      broadcast({ type: 'reload', action: 'update', payload: {}, detail: 'Restaurou um backup' })
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

  const editTargetPreviousValue = useMemo(() => {
    if (!editTarget) return null
    const prevMonth = month === 1 ? 12 : month - 1
    const prevYear = month === 1 ? year - 1 : year
    const prevTx = transactions.find(
      (t) => t.categoryId === editTarget.category.id && t.month === prevMonth && t.year === prevYear
    )
    return prevTx ? prevTx.value : null
  }, [editTarget, transactions, month, year])

  // ---- Render ----

  // Show login screen first
  if (!isLoggedIn || !hydrated) {
    return <LoginScreen onLogin={(accName, userName, wbId) => {
      localStorage.setItem('porto_finance_user', userName)
      setUser(userName)
      setAccountName(accName)
      // If a workbookId was provided (newly created), use it; otherwise clear
      // any stale workbookId from a previous account so the app doesn't load
      // another account's data.
      if (wbId) {
        setWorkbook(wbId)
      } else {
        // Clear stale workbook selection so the app creates/loads the right one
        try {
          localStorage.removeItem('porto_workbook_id')
          localStorage.removeItem('nofluxo_workbook')
        } catch {}
      }
      setIsLoggedIn(true)
    }} />
  }

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
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border shadow-soft">
        <div className="max-w-3xl mx-auto px-3 py-2 space-y-2">
          {/* Top row: Logo+NoFluxo (left) | Workbook name (right) */}
          <div className="flex items-center justify-between gap-2">
            {/* Left: Logo + NoFluxo */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <img src="/logo-nofluxo-mark.png" alt="NoFluxo" className="h-7 w-7 rounded-lg" />
              <span className="text-base font-bold tracking-tight"><span className="text-foreground">No</span><span className="text-[#FAB80B]">Fluxo</span></span>
            </div>

            {/* Right: Workbook name → click to switch */}
            <button
              onClick={() => setWorkbookOpen(true)}
              className="text-xs font-medium text-muted-foreground hover:text-foreground truncate max-w-[40%] text-right touch-manipulation"
              title="Trocar planilha"
            >
              <span className="text-muted-foreground/70">Planilha </span>
              <span className="text-foreground font-semibold">"{workbookName || 'Porto 2026'}"</span>
            </button>
          </div>

          {/* Icons row — centered */}
          <div className="flex items-center justify-center gap-1 flex-wrap">
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
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrenciesOpen(true)} aria-label="Moedas" title="Criar e editar moedas">
              <Coins className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleExportExcel} aria-label="Exportar Excel" title="Exportar Excel do ano atual">
              <Download className="h-4 w-4" />
            </Button>
            {notifications.supported && (
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => notifications.enabled ? notifications.disable() : notifications.requestPermission()} aria-label="Notificações" title={notifications.enabled ? 'Desativar notificações' : 'Ativar notificações de vencimento'}>
                {notifications.enabled ? <Bell className="h-4 w-4 text-primary" /> : <BellOff className="h-4 w-4" />}
              </Button>
            )}
            <ThemeToggle />
            {/* Online/Offline status */}
            <Badge variant="outline" className={cn(
              'gap-1.5 px-2 h-8 text-[10px] flex-shrink-0 font-medium',
              live.connected ? 'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400'
            )}>
              <span className={cn('h-1.5 w-1.5 rounded-full', live.connected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500')} />
              {live.connected ? 'Online' : 'Offline'}
            </Badge>
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
          workbookId={workbookId}
          secondaryCurrency={secondaryCurrencyInfo}
          customCurrencies={(() => {
            try { return config.customCurrencies ? JSON.parse(config.customCurrencies) : [] } catch { return [] }
          })()}
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
              secondaryCurrency={secondaryCurrencyInfo}
              highlightedCategoryIds={highlightedCategoryIds}
              onClearSearch={() => setSearch('')}
              onEdit={(cat, tx) => setEditTarget({ category: cat, tx: tx ?? null })}
              onAddCategory={(grp, parentCategoryId) => {
                if (parentCategoryId) {
                  // Clicking "+" on a CATEGORY → open SubItemEditor (simple name dialog)
                  const parentCat = categories.find((c) => c.id === parentCategoryId)
                  if (parentCat) {
                    setNewSubItemParent({
                      id: parentCat.id,
                      name: parentCat.name,
                      group: parentCat.group,
                      type: parentCat.type,
                      currency: parentCat.currency,
                    })
                  }
                } else {
                  // Clicking "+" on a SUBGROUP → open CategoryEditor (full form, scoped to subgroup)
                  setNewCatGroup(grp as CategoryGroup)
                  setNewCatParent(null)
                }
              }}
              onAddToCard={(cardKey, cardName, cardType) => {
                // Clicking "+" on a TOP-LEVEL CARD (Despesas/Rendimentos/Reservas)
                // opens a choice dialog: "adicionar item com valor" or "criar subgrupo"
                setCardAddChoiceTarget({ key: cardKey, name: cardName, type: cardType })
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
              onDropCategory={async (draggedId, targetId, position) => {
                const dragged = categories.find((c) => c.id === draggedId)
                const target = categories.find((c) => c.id === targetId)
                if (!dragged || !target) return
                if (draggedId === targetId) return

                const targetParent = target.parentCategoryId ?? null
                const targetGroup = target.group
                const siblings = categories
                  .filter((c) =>
                    c.group === targetGroup &&
                    (c.parentCategoryId ?? null) === targetParent &&
                    c.id !== draggedId
                  )
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                const targetIdx = siblings.findIndex((c) => c.id === targetId)
                if (targetIdx === -1) return
                const insertIdx = position === 'before' ? targetIdx : targetIdx + 1
                siblings.splice(insertIdx, 0, dragged)
                const items = siblings.map((c, i) => ({ id: c.id, sortOrder: i + 1 }))

                try {
                  // Save original state for undo
                  const prevSortOrders = siblings.map((c) => ({ id: c.id, sortOrder: c.sortOrder }))
                  const prevDragged = { ...dragged }
                  const crossParent = (dragged.parentCategoryId ?? null) !== targetParent
                  const crossGroup = dragged.group !== targetGroup

                  if (crossParent || crossGroup) {
                    await updateCategory(draggedId, {
                      group: targetGroup,
                      parentCategoryId: targetParent,
                    }, user)
                  }
                  await reorderCategories(items)

                  // Build the new categories array locally (no reload)
                  const newSortOrderMap = new Map(items.map((it) => [it.id, it.sortOrder]))
                  const updatedCategories = categories.map((c) => {
                    if (c.id === draggedId) {
                      return {
                        ...c,
                        group: targetGroup,
                        parentCategoryId: targetParent,
                        sortOrder: newSortOrderMap.get(c.id) ?? c.sortOrder,
                      }
                    }
                    if (newSortOrderMap.has(c.id)) {
                      return { ...c, sortOrder: newSortOrderMap.get(c.id)! }
                    }
                    return c
                  })

                  // Dispatch each updated category to local state + broadcast
                  const affectedCats = updatedCategories.filter((c) =>
                    c.id === draggedId || newSortOrderMap.has(c.id)
                  )
                  for (const cat of affectedCats) {
                    window.dispatchEvent(new CustomEvent('finance:patch', {
                      detail: {
                        type: 'category', action: 'update', payload: { category: cat },
                        by: { name: user, color: USER_COLOR }, at: Date.now(),
                      }
                    }))
                  }
                  broadcast({
                    type: 'category', action: 'update',
                    payload: { category: { ...dragged, group: targetGroup, parentCategoryId: targetParent, sortOrder: newSortOrderMap.get(draggedId) ?? dragged.sortOrder } },
                    detail: `Reordenou categoria "${dragged.name}"`,
                  })

                  // Record undo/redo
                  history.push({
                    description: `Moveu categoria "${dragged.name}"`,
                    undo: async () => {
                      if (crossParent || crossGroup) {
                        await updateCategory(draggedId, {
                          group: prevDragged.group,
                          parentCategoryId: prevDragged.parentCategoryId,
                        }, user)
                      }
                      await reorderCategories(prevSortOrders)
                      const restoredCats = categories.map((c) => {
                        if (c.id === draggedId) return { ...prevDragged }
                        const prev = prevSortOrders.find((p) => p.id === c.id)
                        return prev ? { ...c, sortOrder: prev.sortOrder } : c
                      })
                      for (const cat of restoredCats.filter((c) =>
                        c.id === draggedId || prevSortOrders.some((p) => p.id === c.id)
                      )) {
                        window.dispatchEvent(new CustomEvent('finance:patch', {
                          detail: {
                            type: 'category', action: 'update', payload: { category: cat },
                            by: { name: user, color: USER_COLOR }, at: Date.now(),
                          }
                        }))
                      }
                    },
                    redo: async () => {
                      if (crossParent || crossGroup) {
                        await updateCategory(draggedId, {
                          group: targetGroup,
                          parentCategoryId: targetParent,
                        }, user)
                      }
                      await reorderCategories(items)
                      const redoCats = categories.map((c) => {
                        if (c.id === draggedId) {
                          return { ...c, group: targetGroup, parentCategoryId: targetParent, sortOrder: newSortOrderMap.get(c.id) ?? c.sortOrder }
                        }
                        if (newSortOrderMap.has(c.id)) return { ...c, sortOrder: newSortOrderMap.get(c.id)! }
                        return c
                      })
                      for (const cat of redoCats.filter((c) =>
                        c.id === draggedId || newSortOrderMap.has(c.id)
                      )) {
                        window.dispatchEvent(new CustomEvent('finance:patch', {
                          detail: {
                            type: 'category', action: 'update', payload: { category: cat },
                            by: { name: user, color: USER_COLOR }, at: Date.now(),
                          }
                        }))
                      }
                    },
                  })

                  toast.success('Categoria movida')
                } catch (e: any) {
                  toast.error(e.message || 'Erro ao mover categoria')
                }
              }}
              onDropSubgroup={async (draggedKey, targetKey, position) => {
                if (draggedKey === targetKey) return
                const dragged = subgroups.find((s) => s.key === draggedKey)
                const target = subgroups.find((s) => s.key === targetKey)
                if (!dragged || !target) return
                if (dragged.parentKey !== target.parentKey) {
                  toast.error('Só é possível reordenar subgrupos dentro do mesmo grupo pai')
                  return
                }
                const siblings = subgroups
                  .filter((s) => s.parentKey === target.parentKey && s.key !== draggedKey)
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                const targetIdx = siblings.findIndex((s) => s.key === targetKey)
                if (targetIdx === -1) return
                const insertIdx = position === 'before' ? targetIdx : targetIdx + 1
                siblings.splice(insertIdx, 0, dragged)
                const items = siblings.map((s, i) => ({ id: s.id, sortOrder: i + 1 }))
                const prevSortOrders = siblings.map((s) => ({ id: s.id, sortOrder: s.sortOrder }))

                try {
                  await reorderSubgroups(items)
                  // Update local state without reload
                  const newSortOrderMap = new Map(items.map((it) => [it.id, it.sortOrder]))
                  const updatedSubgroups = subgroups.map((s) =>
                    newSortOrderMap.has(s.id) ? { ...s, sortOrder: newSortOrderMap.get(s.id)! } : s
                  )
                  for (const sg of updatedSubgroups.filter((s) => newSortOrderMap.has(s.id))) {
                    window.dispatchEvent(new CustomEvent('finance:patch', {
                      detail: {
                        type: 'subgroup', action: 'update', payload: { subgroup: sg },
                        by: { name: user, color: USER_COLOR }, at: Date.now(),
                      }
                    }))
                  }
                  broadcast({
                    type: 'subgroup', action: 'update',
                    payload: { subgroup: { ...dragged, sortOrder: newSortOrderMap.get(dragged.id) ?? dragged.sortOrder } },
                    detail: `Reordenou subgrupo "${dragged.name}"`,
                  })

                  history.push({
                    description: `Moveu subgrupo "${dragged.name}"`,
                    undo: async () => {
                      await reorderSubgroups(prevSortOrders)
                      for (const sg of subgroups) {
                        const prev = prevSortOrders.find((p) => p.id === sg.id)
                        if (prev) {
                          window.dispatchEvent(new CustomEvent('finance:patch', {
                            detail: {
                              type: 'subgroup', action: 'update', payload: { subgroup: { ...sg, sortOrder: prev.sortOrder } },
                              by: { name: user, color: USER_COLOR }, at: Date.now(),
                            }
                          }))
                        }
                      }
                    },
                    redo: async () => {
                      await reorderSubgroups(items)
                      for (const sg of subgroups) {
                        if (newSortOrderMap.has(sg.id)) {
                          window.dispatchEvent(new CustomEvent('finance:patch', {
                            detail: {
                              type: 'subgroup', action: 'update', payload: { subgroup: { ...sg, sortOrder: newSortOrderMap.get(sg.id)! } },
                              by: { name: user, color: USER_COLOR }, at: Date.now(),
                            }
                          }))
                        }
                      }
                    },
                  })

                  toast.success('Subgrupo movido')
                } catch (e: any) {
                  toast.error(e.message || 'Erro ao mover subgrupo')
                }
              }}
              onDropTopGroup={async (draggedKey, targetKey, position) => {
                if (draggedKey === targetKey) return
                const sorted = [...topGroups].sort((a, b) => a.sortOrder - b.sortOrder)
                const draggedIdx = sorted.findIndex((t) => t.key === draggedKey)
                if (draggedIdx === -1) return
                // Remove the dragged item, then insert it at the right position
                const filtered = sorted.filter((t) => t.key !== draggedKey)
                const targetIdxInFiltered = filtered.findIndex((t) => t.key === targetKey)
                if (targetIdxInFiltered === -1) return
                const insertIdx = position === 'before' ? targetIdxInFiltered : targetIdxInFiltered + 1
                filtered.splice(insertIdx, 0, sorted[draggedIdx])
                const items = filtered.map((t, i) => ({ id: t.id, sortOrder: i + 1 }))
                const prevSortOrders = sorted.map((t) => ({ id: t.id, sortOrder: t.sortOrder }))

                try {
                  await reorderTopGroups(items)
                  // Dispatch a full data reload so topGroups re-render with new sortOrder.
                  // (topGroups don't have a per-item dispatch path like categories/subgroups do.)
                  window.dispatchEvent(new CustomEvent('finance:patch', {
                    detail: { type: 'reload' as any, action: 'update' as any, payload: {}, by: { name: user, color: USER_COLOR }, at: Date.now() }
                  }))
                  broadcast({
                    type: 'config', action: 'update',
                    payload: { key: 'topGroups', value: '' },
                    detail: `Reordenou card`,
                  })

                  history.push({
                    description: `Moveu card`,
                    undo: async () => {
                      await reorderTopGroups(prevSortOrders)
                      window.dispatchEvent(new CustomEvent('finance:patch', {
                        detail: { type: 'reload' as any, action: 'update' as any, payload: {}, by: { name: user, color: USER_COLOR }, at: Date.now() }
                      }))
                    },
                    redo: async () => {
                      await reorderTopGroups(items)
                      window.dispatchEvent(new CustomEvent('finance:patch', {
                        detail: { type: 'reload' as any, action: 'update' as any, payload: {}, by: { name: user, color: USER_COLOR }, at: Date.now() }
                      }))
                    },
                  })

                  toast.success('Card movido')
                } catch (e: any) {
                  toast.error(e.message || 'Erro ao mover card')
                }
              }}
              onQuickAdd={(group) => {
                setQuickAddInitialGroup(group)
                setQuickAddOpen(true)
              }}
              onMergeSubgroups={(draggedKey, targetKey) => {
                const dragged = subgroups.find((s) => s.key === draggedKey)
                const target = subgroups.find((s) => s.key === targetKey)
                if (!dragged || !target) return
                const parentKey = dragged.parentKey
                const parentLabel = getGroupLabel(parentKey, labels, subgroups)
                setMergeTarget({
                  draggedKey,
                  targetKey,
                  draggedLabel: getGroupLabel(draggedKey, labels, subgroups),
                  targetLabel: getGroupLabel(targetKey, labels, subgroups),
                  parentKey,
                  parentLabel,
                })
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
                  toast.success("Cor atualizada"); window.dispatchEvent(new CustomEvent("finance:patch", { detail: { type: "reload", action: "update", payload: {}, by: { name: user, color: USER_COLOR }, at: Date.now() } }))
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
                  toast.success(`Card "${node.label}" removido`); window.dispatchEvent(new CustomEvent("finance:patch", { detail: { type: "reload", action: "update", payload: {}, by: { name: user, color: USER_COLOR }, at: Date.now() } }))
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
          {/* Left: user name (click to switch) + settings + refresh */}
          <div className="flex items-center gap-1.5 text-xs flex-1">
            <button
              onClick={() => setSwitchUserOpen(true)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted hover:bg-muted/80 font-medium touch-manipulation"
              title={`Trocar de usuário (atual: ${user})`}
            >
              <span className="text-muted-foreground">👤</span>
              <span>{user}</span>
            </button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setSettingsOpen(true)}
              aria-label="Configurações"
              title="Configurações (moeda, conta, planilha)"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
          {/* Center: Undo/Redo */}
          <div className="flex items-center justify-center">
            <UndoRedoButtons
              canUndo={history.canUndo}
              canRedo={history.canRedo}
              nextUndo={history.nextUndo}
              nextRedo={history.nextRedo}
              onUndo={handleUndo}
              onRedo={handleRedo}
            />
          </div>
          {/* Right: Quick add */}
          <div className="flex items-center gap-1.5 flex-1 justify-end">
            <Button
              size="sm"
              variant="default"
              onClick={() => { setQuickAddInitialGroup(undefined); setQuickAddOpen(true) }}
              className="h-9 rounded-full px-3 shadow-sm"
              aria-label="Adicionar valor rápido"
              title="Adicionar valor rápido (despesa, rendimento ou reserva)"
            >
              <Zap className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Valor rápido</span>
              <span className="sm:hidden">Rápido</span>
            </Button>
          </div>
        </div>
      </footer>

      {/* Switch User Dialog */}
      <Dialog open={switchUserOpen} onOpenChange={setSwitchUserOpen}>
        <DialogContent className="max-w-sm" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Trocar usuário</DialogTitle>
            <DialogDescription className="sr-only">Selecione ou crie um usuário</DialogDescription>
          </DialogHeader>
          <SwitchUserContent
            accountName={accountName}
            currentUser={user}
            onSelectUser={(name) => {
              localStorage.setItem('porto_finance_user', name)
              setUser(name)
              setSwitchUserOpen(false)
            }}
            onLogout={() => {
              setSwitchUserOpen(false)
              setIsLoggedIn(false)
            }}
          />
        </DialogContent>
      </Dialog>

      <TransactionEditor
        open={!!editTarget}
        category={editTarget?.category ?? null}
        transaction={editTarget?.tx ?? null}
        previousMonthValue={editTargetPreviousValue}
        month={month}
        year={year}
        euroRate={euroRate}
        secondaryCurrency={secondaryCurrencyInfo}
        customCurrencies={(() => {
          try { return config.customCurrencies ? JSON.parse(config.customCurrencies) : [] } catch { return [] }
        })()}
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
        customCurrencies={(() => {
          try { return config.customCurrencies ? JSON.parse(config.customCurrencies) : [] } catch { return [] }
        })()}
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

      <SubItemEditor
        open={!!newSubItemParent}
        parentLabel={newSubItemParent?.name ?? ''}
        onOpenChange={(o) => !o && setNewSubItemParent(null)}
        onCreate={handleCreateSubItem}
      />

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onExportExcel={handleExportExcel}
        onOpenCurrencies={() => setCurrenciesOpen(true)}
        accountName={accountName}
        onDeleteAccount={async (password) => {
          try {
            const r = await fetch('/api/accounts', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: accountName, password }),
            })
            const data = await r.json().catch(() => ({}))
            if (!r.ok) {
              toast.error(data.error || 'Erro ao apagar conta')
              return
            }
          } catch {
            toast.error('Erro de conexão ao apagar conta')
            return
          }
          // Clear any locally-cached session data for this device too
          try {
            const keys = Object.keys(localStorage).filter(k => k.startsWith('nofluxo_') || k.startsWith('porto_'))
            for (const k of keys) localStorage.removeItem(k)
          } catch {}
          setIsLoggedIn(false)
          setSettingsOpen(false)
          window.location.reload()
        }}
        onLogout={() => {
          setIsLoggedIn(false)
        }}
        onBackup={() => setBackupOpen(true)}
        onRestore={() => setBackupOpen(true)}
        onResetValues={() => setResetOpen(true)}
      />

      <CurrenciesDialog
        open={currenciesOpen}
        onOpenChange={setCurrenciesOpen}
        euroRate={euroRate}
        euroRemoved={config.euroRemoved === '1'}
        onSetEuroRemoved={async (removed) => {
          await updateConfig('euroRemoved', removed ? '1' : '0', user, workbookId)
          window.dispatchEvent(new CustomEvent('finance:patch', {
            detail: { type: 'config', action: 'update', payload: { key: 'euroRemoved', value: removed ? '1' : '0' }, by: { name: user, color: USER_COLOR }, at: Date.now() }
          }))
          toast.success(removed ? 'Euro removido' : 'Euro adicionado')
        }}
        onSaveEuroRate={handleSaveEuroRate}
        currencies={(() => {
          try {
            const stored = config.customCurrencies
            return stored ? JSON.parse(stored) : []
          } catch { return [] }
        })()}
        onSaveCurrencies={async (currencies) => {
          await updateConfig('customCurrencies', JSON.stringify(currencies), user, workbookId)
          window.dispatchEvent(new CustomEvent('finance:patch', {
            detail: { type: 'config', action: 'update', payload: { key: 'customCurrencies', value: JSON.stringify(currencies) }, by: { name: user, color: USER_COLOR }, at: Date.now() }
          }))
        }}
        secondaryCurrency={secondaryCurrencyInfo.code}
        onSaveSecondaryCurrency={async (code) => {
          await updateConfig('secondaryCurrency', code, user, workbookId)
          window.dispatchEvent(new CustomEvent('finance:patch', {
            detail: { type: 'config', action: 'update', payload: { key: 'secondaryCurrency', value: code }, by: { name: user, color: USER_COLOR }, at: Date.now() }
          }))
          toast.success(`Moeda secundária alterada para ${code}`)
        }}
      />

      {/* Choice dialog: when user clicks "+" on a top-level card, choose
          between "adicionar item com valor" or "criar subgrupo". */}
      <CardAddChoiceDialog
        open={!!cardAddChoiceTarget}
        cardName={cardAddChoiceTarget?.name ?? ''}
        onOpenChange={(o) => !o && setCardAddChoiceTarget(null)}
        onAddItemWithValue={() => {
          // Move from choice dialog to the actual add-item dialog
          if (cardAddChoiceTarget) {
            setAddItemToCardTarget(cardAddChoiceTarget)
          }
        }}
        onCreateSubgroup={() => {
          // Reuse existing SubgroupEditor by setting newSubgroupParent
          if (cardAddChoiceTarget) {
            setNewSubgroupParent({
              key: cardAddChoiceTarget.key,
              label: cardAddChoiceTarget.name,
            })
          }
        }}
      />

      {/* Add item with value directly to the card */}
      <AddItemToCardDialog
        open={!!addItemToCardTarget}
        month={month}
        year={year}
        cardKey={addItemToCardTarget?.key ?? ''}
        cardName={addItemToCardTarget?.name ?? ''}
        cardType={addItemToCardTarget?.type ?? 'EXPENSE'}
        subgroups={subgroups}
        labels={labels}
        customCurrencies={(() => {
          try {
            const stored = config.customCurrencies
            return stored ? JSON.parse(stored) : []
          } catch { return [] }
        })()}
        onOpenChange={(o) => !o && setAddItemToCardTarget(null)}
        onCreate={async (args) => {
          if (!addItemToCardTarget) return
          await handleAddItemToCard(
            addItemToCardTarget.key,
            addItemToCardTarget.type,
            args
          )
        }}
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
        allCategories={categories}
        onOpenChange={(o) => !o && setMoveTarget(null)}
        onMove={handleMoveCategory}
      />

      <DeleteSubgroupDialog
        open={!!pendingDeleteSubgroup}
        node={pendingDeleteSubgroup}
        parentLabel={pendingDeleteSubgroup ? getGroupLabel(
          pendingDeleteSubgroup.key.split('.').slice(0, -1).join('.') || pendingDeleteSubgroup.key,
          labels, subgroups
        ) : ''}
        onOpenChange={(o) => !o && setPendingDeleteSubgroup(null)}
        onConfirm={handleDeleteSubgroupConfirm}
      />

      <QuickAddDialog
        open={quickAddOpen}
        month={month}
        year={year}
        categories={categories}
        subgroups={subgroups}
        topGroups={topGroups}
        labels={labels}
        initialGroup={quickAddInitialGroup}
        customCurrencies={(() => {
          try { return config.customCurrencies ? JSON.parse(config.customCurrencies) : [] } catch { return [] }
        })()}
        onOpenChange={setQuickAddOpen}
        onCreate={handleQuickAdd}
      />

      <MergeSubgroupsDialog
        open={!!mergeTarget}
        draggedKey={mergeTarget?.draggedKey ?? null}
        targetKey={mergeTarget?.targetKey ?? null}
        draggedLabel={mergeTarget?.draggedLabel ?? ''}
        targetLabel={mergeTarget?.targetLabel ?? ''}
        parentLabel={mergeTarget?.parentLabel ?? ''}
        onOpenChange={(o) => !o && setMergeTarget(null)}
        onConfirm={handleMergeSubgroups}
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
        accountName={accountName}
        onSelect={(id) => setWorkbook(id)}
        onCreate={async (name, copyFrom) => {
          try {
            const r = await fetch('/api/workbooks', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name, user, copyFrom, accountName }),
            })
            if (!r.ok) throw new Error('Falha')
            const data = await r.json()
            setWorkbook(data.workbook.id)
            // Save the new workbook ID scoped to this account
            try { localStorage.setItem(`nofluxo_wb_${accountName}`, data.workbook.id) } catch {}
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
            window.dispatchEvent(new CustomEvent("finance:patch", { detail: { type: "reload", action: "update", payload: {}, by: { name: user, color: USER_COLOR }, at: Date.now() } }))
          } catch (e: any) {
            toast.error(e.message || 'Erro ao criar card')
          }
        }}
      />
    </div>
  )
}
