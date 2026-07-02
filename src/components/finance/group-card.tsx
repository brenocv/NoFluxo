'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  Category,
  formatMoney,
  formatDualCompact,
  GROUP_LABELS,
  Transaction,
} from '@/lib/finance'
import { Plus, Trash2, ChevronDown, Clock } from 'lucide-react'

interface Props {
  group: string
  categories: Category[]
  transactionsByCat: Record<string, Transaction | undefined>
  euroRate: number
  onEdit: (category: Category, current: Transaction | undefined) => void
  onAddCategory: (group: string) => void
  onDeleteCategory: (cat: Category) => void
}

export function GroupCard({
  group,
  categories,
  transactionsByCat,
  euroRate,
  onEdit,
  onAddCategory,
  onDeleteCategory,
}: Props) {
  const [open, setOpen] = useState(true)

  const cats = categories.filter((c) => c.group === group)
  if (cats.length === 0) return null

  const total = cats.reduce((acc, c) => {
    const tx = transactionsByCat[c.id]
    if (!tx) return acc
    if (c.currency === 'EUR') return acc + tx.value * euroRate
    return acc + tx.value
  }, 0)

  const isIncome = group.startsWith('rendimentos')
  const isReserve = group === 'reservas'
  const isReceivable = group === 'valores_a_receber'

  // Group total is always shown in BRL with EUR equivalent
  const totalSign =
    isReserve || isReceivable
      ? ''
      : isIncome
        ? (total >= 0 ? '+' : '−')
        : (total >= 0 ? '−' : '+')

  return (
    <Card className="overflow-hidden shadow-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors touch-manipulation"
      >
        <div className="flex items-center gap-2">
          <ChevronDown
            className={cn(
              'h-4 w-4 text-muted-foreground transition-transform',
              !open && '-rotate-90'
            )}
          />
          <span className="font-semibold text-sm">
            {GROUP_LABELS[group as keyof typeof GROUP_LABELS] || group}
          </span>
          {isReceivable && (
            <Badge variant="outline" className="h-5 px-1 text-[10px] gap-0.5 border-amber-300 bg-amber-50 text-amber-700">
              <Clock className="h-2.5 w-2.5" />
              a receber
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">({cats.length})</span>
        </div>
        <span
          className={cn(
            'text-sm font-semibold tabular-nums',
            isIncome
              ? 'text-emerald-600'
              : isReserve || isReceivable
                ? 'text-amber-600'
                : 'text-rose-600'
          )}
        >
          {totalSign}
          {formatDualCompact(Math.abs(total), 'BRL', euroRate)}
        </span>
      </button>

      {open && (
        <div className="divide-y divide-border">
          {cats.map((cat) => {
            const tx = transactionsByCat[cat.id]
            const value = tx?.value ?? null
            const sign =
              value === null
                ? ''
                : cat.type === 'RESERVE' || cat.group === 'valores_a_receber'
                  ? (value < 0 ? '−' : '')
                  : cat.type === 'INCOME'
                    ? (value >= 0 ? '+' : '−')
                    : /* EXPENSE */ (value >= 0 ? '−' : '+')
            return (
              <div
                key={cat.id}
                className="flex items-center justify-between px-3 py-2.5 group"
              >
                <button
                  onClick={() => onEdit(cat, tx)}
                  className="flex-1 flex flex-col items-start text-left touch-manipulation"
                >
                  <span className="text-sm font-medium text-foreground">{cat.name}</span>
                  {cat.note && (
                    <span className="text-xs text-muted-foreground">{cat.note}</span>
                  )}
                </button>
                <div className="flex items-center gap-1">
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
                              : cat.type === 'RESERVE' || cat.group === 'valores_a_receber'
                                ? 'text-amber-600'
                                : 'text-rose-600'
                          )}
                        >
                          {sign}
                          {formatMoney(Math.abs(value), cat.currency)}
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
                    onClick={() => onDeleteCategory(cat)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-destructive/10 hover:text-destructive transition-all touch-manipulation"
                    aria-label="Remover categoria"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
          <button
            onClick={() => onAddCategory(group)}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs text-muted-foreground hover:bg-muted/50 transition-colors touch-manipulation"
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar categoria
          </button>
        </div>
      )}
    </Card>
  )
}
