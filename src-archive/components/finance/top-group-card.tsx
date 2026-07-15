'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  Category,
  formatMoney,
  getTopGroupLabel,
  getGroupLabel,
  Transaction,
  GROUP_STRUCTURE,
  CategoryGroup,
} from '@/lib/finance'
import {
  Plus, Trash2, ChevronDown, Pencil, Clock, AlertTriangle, RefreshCw, Check,
} from 'lucide-react'

interface Props {
  topGroupKey: string
  labels: Record<string, string>
  categories: Category[]
  transactionsByCat: Record<string, Transaction | undefined>
  euroRate: number
  onEdit: (category: Category, current: Transaction | undefined) => void
  onAddCategory: (group: CategoryGroup) => void
  onDeleteCategory: (cat: Category) => void
  onRename: (key: string, value: string) => void
  onStopRecurring: (seriesId: string, currentMonth: number) => void
}

export function TopGroupCard({
  topGroupKey, labels, categories, transactionsByCat, euroRate,
  onEdit, onAddCategory, onDeleteCategory, onRename, onStopRecurring,
}: Props) {
  const [open, setOpen] = useState(true)
  const topDef = GROUP_STRUCTURE.find((g) => g.key === topGroupKey)
  if (!topDef) return null

  const topLabel = getTopGroupLabel(topGroupKey, labels)

  // All categories in this top-level group
  const topCats = categories.filter((c) => {
    const catTop = c.group.includes('.') ? c.group.split('.')[0] : c.group
    return catTop === topGroupKey
  })
  if (topCats.length === 0) return null

  // Total for the whole top-level group
  const total = topCats.reduce((acc, c) => {
    const tx = transactionsByCat[c.id]
    if (!tx) return acc
    if (c.currency === 'EUR') return acc + tx.value * euroRate
    return acc + tx.value
  }, 0)

  const isIncome = topGroupKey === 'rendimentos'
  const isReserve = topGroupKey === 'reservas'

  // Determine subgroups to render
  const subgroups = topDef.subgroups

  return (
    <Card className="overflow-hidden shadow-sm" id={`group-${topGroupKey}`}>
      {/* Top-level header */}
      <div className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 flex-1 touch-manipulation min-w-0"
        >
          <ChevronDown
            className={cn(
              'h-4 w-4 text-muted-foreground transition-transform flex-shrink-0',
              !open && '-rotate-90'
            )}
          />
          <span className="font-semibold text-sm truncate">{topLabel}</span>
          <span className="text-xs text-muted-foreground flex-shrink-0">({topCats.length})</span>
        </button>
        <div className="flex items-center gap-1 flex-shrink-0">
          <RenameButton
            currentLabel={topLabel}
            onRename={(v) => onRename(`group:${topGroupKey}`, v)}
          />
          <span
            className={cn(
              'text-sm font-semibold tabular-nums',
              isIncome
                ? 'text-emerald-600'
                : isReserve
                  ? 'text-amber-600'
                  : 'text-rose-600'
            )}
          >
            {(isIncome ? '+' : isReserve ? '' : '−')}
            {formatMoney(Math.abs(total), 'BRL')}
            <span className="text-[10px] text-muted-foreground ml-1 font-normal">
              ({formatMoney(Math.abs(total) / euroRate, 'EUR')})
            </span>
          </span>
        </div>
      </div>

      {open && (
        <div>
          {subgroups.length > 0 ? (
            // Render each subgroup as a nested section
            subgroups.map((subDef) => {
              const subCats = categories.filter((c) => c.group === subDef.key)
              if (subCats.length === 0) return null
              const subLabel = getGroupLabel(subDef.key, labels)
              const subTotal = subCats.reduce((acc, c) => {
                const tx = transactionsByCat[c.id]
                if (!tx) return acc
                if (c.currency === 'EUR') return acc + tx.value * euroRate
                return acc + tx.value
              }, 0)
              const isReceivableSub = subDef.key === 'rendimentos.valores_a_receber'

              return (
                <SubgroupSection
                  key={subDef.key}
                  subKey={subDef.key}
                  subLabel={subLabel}
                  cats={subCats}
                  transactionsByCat={transactionsByCat}
                  euroRate={euroRate}
                  isReceivable={isReceivableSub}
                  onEdit={onEdit}
                  onAddCategory={onAddCategory}
                  onDeleteCategory={onDeleteCategory}
                  onRename={onRename}
                  onStopRecurring={onStopRecurring}
                  subTotal={subTotal}
                />
              )
            })
          ) : (
            // No subgroups — render categories directly
            <div className="divide-y divide-border border-t border-border">
              {topCats.map((cat) => (
                <CategoryRow
                  key={cat.id}
                  cat={cat}
                  tx={transactionsByCat[cat.id]}
                  euroRate={euroRate}
                  onEdit={onEdit}
                  onDelete={onDeleteCategory}
                  onStopRecurring={onStopRecurring}
                />
              ))}
              <AddCategoryButton group={topGroupKey as CategoryGroup} onAdd={onAddCategory} />
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

function SubgroupSection({
  subKey, subLabel, cats, transactionsByCat, euroRate, isReceivable,
  onEdit, onAddCategory, onDeleteCategory, onRename, onStopRecurring, subTotal,
}: {
  subKey: string
  subLabel: string
  cats: Category[]
  transactionsByCat: Record<string, Transaction | undefined>
  euroRate: number
  isReceivable: boolean
  onEdit: (c: Category, t: Transaction | undefined) => void
  onAddCategory: (g: CategoryGroup) => void
  onDeleteCategory: (c: Category) => void
  onRename: (k: string, v: string) => void
  onStopRecurring: (s: string, m: number) => void
  subTotal: number
}) {
  const [open, setOpen] = useState(true)

  return (
    <div className="border-t border-border">
      <div className="w-full flex items-center justify-between px-3 py-2 bg-muted/30">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1.5 flex-1 touch-manipulation"
        >
          <ChevronDown
            className={cn('h-3 w-3 text-muted-foreground transition-transform', !open && '-rotate-90')}
          />
          <span className="text-xs font-semibold text-muted-foreground">{subLabel}</span>
          {isReceivable && (
            <Badge variant="outline" className="h-4 px-1 text-[9px] gap-0.5 border-amber-300 bg-amber-50 text-amber-700">
              <Clock className="h-2 w-2" />
              a receber
            </Badge>
          )}
          <span className="text-[10px] text-muted-foreground">({cats.length})</span>
        </button>
        <div className="flex items-center gap-1">
          <RenameButton
            currentLabel={subLabel}
            onRename={(v) => onRename(`subgroup:${subKey}`, v)}
            small
          />
          <span className="text-xs font-semibold tabular-nums text-muted-foreground">
            {formatMoney(Math.abs(subTotal), 'BRL')}
            <span className="text-[9px] ml-0.5">({formatMoney(Math.abs(subTotal) / euroRate, 'EUR')})</span>
          </span>
        </div>
      </div>
      {open && (
        <div className="divide-y divide-border">
          {cats.map((cat) => (
            <CategoryRow
              key={cat.id}
              cat={cat}
              tx={transactionsByCat[cat.id]}
              euroRate={euroRate}
              onEdit={onEdit}
              onDelete={onDeleteCategory}
              onStopRecurring={onStopRecurring}
            />
          ))}
          <AddCategoryButton group={subKey as CategoryGroup} onAdd={onAddCategory} />
        </div>
      )}
    </div>
  )
}

function CategoryRow({
  cat, tx, euroRate, onEdit, onDelete, onStopRecurring,
}: {
  cat: Category
  tx: Transaction | undefined
  euroRate: number
  onEdit: (c: Category, t: Transaction | undefined) => void
  onDelete: (c: Category) => void
  onStopRecurring: (s: string, m: number) => void
}) {
  const value = tx?.value ?? null
  const isRecurring = tx?.isRecurring ?? false
  const installmentNumber = tx?.installmentNumber ?? null
  const installmentsTotal = tx?.installmentsTotal ?? null

  // Goal check
  const goalExceeded = cat.monthlyGoal !== null && value !== null && cat.type === 'EXPENSE' && value > cat.monthlyGoal
  const goalMet = cat.monthlyGoal !== null && value !== null && cat.type === 'INCOME' && value < cat.monthlyGoal

  const sign =
    value === null
      ? ''
      : cat.type === 'RESERVE' || cat.group === 'rendimentos.valores_a_receber'
        ? (value < 0 ? '−' : '')
        : cat.type === 'INCOME'
          ? (value >= 0 ? '+' : '−')
          : (value >= 0 ? '−' : '+')

  return (
    <div className="flex items-center justify-between px-3 py-2.5 group">
      <button
        onClick={() => onEdit(cat, tx)}
        className="flex-1 flex flex-col items-start text-left touch-manipulation min-w-0"
      >
        <span className="text-sm font-medium text-foreground flex items-center gap-1">
          {cat.name}
          {isRecurring && (
            <span className="inline-flex items-center gap-0.5 text-[9px] text-cyan-600 bg-cyan-50 px-1 py-0.5 rounded">
              <RefreshCw className="h-2 w-2" />
              {installmentsTotal ? `${installmentNumber}/${installmentsTotal}` : 'recorrente'}
            </span>
          )}
          {goalExceeded && (
            <span className="inline-flex items-center gap-0.5 text-[9px] text-rose-600 bg-rose-50 px-1 py-0.5 rounded">
              <AlertTriangle className="h-2 w-2" />
              meta
            </span>
          )}
        </span>
        {cat.note && (
          <span className="text-xs text-muted-foreground truncate">{cat.note}</span>
        )}
      </button>
      <div className="flex items-center gap-1">
        {/* Stop recurring button */}
        {isRecurring && (
          <button
            onClick={() => tx?.seriesId && onStopRecurring(tx.seriesId, tx.month)}
            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-cyan-50 hover:text-cyan-600 transition-all touch-manipulation"
            aria-label="Parar recorrência"
            title="Parar recorrência (remove parcelas futuras)"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
        )}
        <button
          onClick={() => onEdit(cat, tx)}
          className="px-3 py-1.5 rounded-md hover:bg-muted transition-colors touch-manipulation text-right"
        >
          {value === null ? (
            <span className="text-sm font-normal text-muted-foreground italic">—</span>
          ) : (
            <div className="flex flex-col items-end leading-tight">
              <span
                className={cn(
                  'text-sm font-semibold tabular-nums',
                  cat.type === 'INCOME'
                    ? 'text-emerald-600'
                    : cat.type === 'RESERVE' || cat.group === 'rendimentos.valores_a_receber'
                      ? 'text-amber-600'
                      : 'text-rose-600'
                )}
              >
                {sign}{formatMoney(Math.abs(value), cat.currency)}
              </span>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {cat.currency === 'BRL'
                  ? formatMoney(Math.abs(value) / euroRate, 'EUR')
                  : formatMoney(Math.abs(value) * euroRate, 'BRL')}
              </span>
            </div>
          )}
        </button>
        <button
          onClick={() => onDelete(cat)}
          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-destructive/10 hover:text-destructive transition-all touch-manipulation"
          aria-label="Remover categoria"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

function AddCategoryButton({ group, onAdd }: { group: CategoryGroup; onAdd: (g: CategoryGroup) => void }) {
  return (
    <button
      onClick={() => onAdd(group)}
      className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs text-muted-foreground hover:bg-muted/50 transition-colors touch-manipulation"
    >
      <Plus className="h-3.5 w-3.5" />
      Adicionar categoria
    </button>
  )
}

function RenameButton({
  currentLabel, onRename, small,
}: {
  currentLabel: string
  onRename: (v: string) => void
  small?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(currentLabel)

  return (
    <Popover open={open} onOpenChange={(o) => {
      setOpen(o)
      if (o) setValue(currentLabel)
    }}>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'p-1 rounded-md hover:bg-muted text-muted-foreground/50 hover:text-foreground transition-colors touch-manipulation',
            // Always visible (not hover-only) so it works on touch devices
          )}
          aria-label="Renomear"
        >
          <Pencil className={small ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Renomear</label>
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={currentLabel}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onRename(value.trim())
                setOpen(false)
              }
            }}
          />
          <div className="flex gap-2 justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={() => {
                onRename(value.trim())
                setOpen(false)
              }}
            >
              <Check className="h-3 w-3 mr-1" />
              Salvar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
