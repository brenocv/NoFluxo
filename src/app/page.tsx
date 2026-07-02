'use client'

import { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useFinanceData } from '@/hooks/use-finance-data'
import { useCurrentUser } from '@/hooks/use-current-user'
import { saveTransaction, createCategory, deleteCategory, updateConfig } from '@/lib/actions'
import {
  ActivityEntry,
  Category,
  CategoryGroup,
  CategoryType,
  Currency,
  GROUP_ORDER,
  Transaction,
} from '@/lib/finance'
import { MonthSelector } from '@/components/finance/month-selector'
import { SummaryCard } from '@/components/finance/summary-card'
import { GroupCard } from '@/components/finance/group-card'
import { TransactionEditor } from '@/components/finance/transaction-editor'
import { CategoryEditor } from '@/components/finance/category-editor'
import { ActivityPanel } from '@/components/finance/activity-panel'
import { SettingsDialog } from '@/components/finance/settings-dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Wifi, WifiOff, Settings, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const USER_COLOR = '#16a34a'

export default function Home() {
  const { user, setUser, hydrated } = useCurrentUser()
  const {
    categories,
    transactions,
    config,
    activity,
    loading,
    error,
    live,
    broadcast,
  } = useFinanceData(user)

  const [month, setMonth] = useState<number>(() => new Date().getMonth() + 1)
  const [editTarget, setEditTarget] = useState<{
    category: Category
    tx: Transaction | null
  } | null>(null)
  const [newCatGroup, setNewCatGroup] = useState<CategoryGroup | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const euroRate = parseFloat(config.euroToBrl ?? '6.4') || 6.4

  // Dispatch a local patch (applied to local state immediately) AND broadcast
  // the same change to other connected devices.
  const dispatchChange = useCallback(
    (
      type: 'transaction' | 'category' | 'config',
      action: 'create' | 'update' | 'delete',
      payload: any,
      detail: string,
      activityEntry: Omit<ActivityEntry, 'id'>
    ) => {
      const envelope = {
        type,
        action,
        payload,
        by: { name: user, color: USER_COLOR },
        at: Date.now(),
        detail,
      }
      // Local patch (so the local UI updates instantly)
      window.dispatchEvent(
        new CustomEvent('finance:patch', { detail: envelope })
      )
      // Also push an activity entry to the local feed
      window.dispatchEvent(
        new CustomEvent('finance:patch', {
          detail: {
            type: 'activity',
            action: 'create',
            payload: { ...activityEntry, id: `local-${Date.now()}` },
            by: { name: user, color: USER_COLOR },
            at: Date.now(),
          },
        })
      )
      // Broadcast to other devices
      broadcast({ type, action, payload, detail })
      broadcast({
        type: 'activity',
        action: 'create',
        payload: { ...activityEntry, id: `local-${Date.now()}` },
      })
    },
    [user, broadcast]
  )

  const txByCat = useMemo(() => {
    const m: Record<string, Transaction | undefined> = {}
    for (const t of transactions) {
      if (t.month === month && t.year === 2026) {
        m[t.categoryId] = t
      }
    }
    return m
  }, [transactions, month])

  const totals = useMemo(() => {
    let entradasBRL = 0, saidasBRL = 0
    let entradasEUR = 0, saidasEUR = 0
    let reservasBRL = 0

    for (const c of categories) {
      const tx = txByCat[c.id]
      if (!tx) continue
      const v = tx.value
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
    return { entradasBRL, saidasBRL, entradasEUR, saidasEUR, reservasBRL }
  }, [categories, txByCat])

  async function handleSaveTransaction(value: number | null, note: string | null) {
    if (!editTarget) return
    const cat = editTarget.category
    try {
      const result = await saveTransaction({
        categoryId: cat.id,
        month,
        year: 2026,
        value,
        note,
        user,
      })
      if (result.action === 'noop') return

      const monthLabel = MONTHS_SHORT[month - 1]
      const actionVerb =
        result.action === 'create'
          ? 'Adicionou'
          : result.action === 'update'
            ? 'Atualizou'
            : 'Removeu'
      const valueStr =
        value !== null
          ? ` • ${cat.currency === 'BRL' ? 'R$' : '€'} ${value.toFixed(2)}`
          : ''
      const detail = `${actionVerb} ${cat.name} • ${monthLabel}/2026${valueStr}`

      dispatchChange(
        'transaction',
        result.action,
        result.transaction
          ? { transaction: result.transaction, category: cat }
          : { id: editTarget.tx?.id },
        detail,
        {
          user,
          action: result.action,
          entity: 'transaction',
          detail,
          createdAt: new Date().toISOString(),
        }
      )

      toast.success(
        value === null ? `${cat.name} removido` : `${cat.name} atualizado`
      )
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar')
    }
  }

  async function handleClearTransaction() {
    if (!editTarget || !editTarget.tx) return
    await handleSaveTransaction(null, null)
  }

  async function handleCreateCategory(args: {
    name: string
    group: CategoryGroup
    type: CategoryType
    currency: Currency
    note?: string
  }) {
    try {
      const r = await createCategory({ ...args, user })
      const detail = `Criou categoria "${r.category.name}"`
      dispatchChange('category', 'create', { category: r.category }, detail, {
        user,
        action: 'create',
        entity: 'category',
        detail,
        createdAt: new Date().toISOString(),
      })
      toast.success(`Categoria "${r.category.name}" criada`)
    } catch (e: any) {
      toast.error(e.message || 'Erro ao criar categoria')
    }
  }

  async function handleDeleteCategory(cat: Category) {
    if (!confirm(`Remover a categoria "${cat.name}"? Todas as transações associadas também serão removidas.`)) return
    try {
      await deleteCategory(cat.id, user)
      const detail = `Removeu categoria "${cat.name}"`
      dispatchChange('category', 'delete', { id: cat.id }, detail, {
        user,
        action: 'delete',
        entity: 'category',
        detail,
        createdAt: new Date().toISOString(),
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
      dispatchChange(
        'config',
        'update',
        { key: 'euroToBrl', value: String(v) },
        detail,
        {
          user,
          action: 'update',
          entity: 'config',
          detail,
          createdAt: new Date().toISOString(),
        }
      )
      toast.success('Cotação atualizada')
    } catch (e: any) {
      toast.error(e.message || 'Erro ao atualizar cotação')
    }
  }

  if (!hydrated || loading) {
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
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border">
        <div className="max-w-3xl mx-auto px-3 py-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
              €
            </div>
            <div>
              <h1 className="text-sm font-semibold leading-none">Porto 2026</h1>
              <p className="text-[10px] text-muted-foreground">Controle financeiro</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge
              variant="outline"
              className={cn(
                'gap-1 px-1.5 py-0 h-7 text-[10px]',
                live.connected
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-rose-200 bg-rose-50 text-rose-700'
              )}
            >
              {live.connected ? (
                <>
                  <Wifi className="h-3 w-3" />
                  <span className="hidden sm:inline">Sincronizando</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-3 w-3" />
                  <span className="hidden sm:inline">Offline</span>
                </>
              )}
            </Badge>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setSettingsOpen(true)}
              aria-label="Configurações"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-3 py-3 space-y-3 pb-24">
        <MonthSelector selected={month} onSelect={setMonth} />

        <SummaryCard
          entradasBRL={totals.entradasBRL}
          saidasBRL={totals.saidasBRL}
          entradasEUR={totals.entradasEUR}
          saidasEUR={totals.saidasEUR}
          reservasBRL={totals.reservasBRL}
          euroRate={euroRate}
        />

        {GROUP_ORDER.map((g) => (
          <GroupCard
            key={g}
            group={g}
            categories={categories}
            transactionsByCat={txByCat}
            euroRate={euroRate}
            onEdit={(cat, tx) => setEditTarget({ category: cat, tx: tx ?? null })}
            onAddCategory={(grp) => setNewCatGroup(grp as CategoryGroup)}
            onDeleteCategory={handleDeleteCategory}
          />
        ))}

        <ActivityPanel
          activity={activity}
          presences={live.presences}
          currentUser={user}
        />

        {live.lastChange && Date.now() - live.lastChange.at < 5000 && (
          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 max-w-md w-[calc(100%-1.5rem)]">
            <div className="bg-foreground/95 text-background text-xs px-3 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
              <span
                className="h-2 w-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: USER_COLOR }}
              />
              <span className="flex-1 truncate">
                <strong>{live.lastChange.by}</strong> {live.lastChange.detail}
              </span>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="sticky bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="max-w-3xl mx-auto px-3 py-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Você é</span>
            <button
              onClick={() => setSettingsOpen(true)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted hover:bg-muted/80 font-medium touch-manipulation"
            >
              {user}
            </button>
          </div>
          <Button
            size="sm"
            onClick={() => setNewCatGroup('despesas')}
            className="h-8"
          >
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
        euroRate={euroRate}
        onOpenChange={(o) => !o && setEditTarget(null)}
        onSave={handleSaveTransaction}
        onClear={handleClearTransaction}
      />

      <CategoryEditor
        open={!!newCatGroup}
        group={newCatGroup}
        onOpenChange={(o) => !o && setNewCatGroup(null)}
        onCreate={handleCreateCategory}
      />

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        currentUser={user}
        onSetUser={setUser}
        euroRate={euroRate}
        onSaveEuroRate={handleSaveEuroRate}
      />
    </div>
  )
}
