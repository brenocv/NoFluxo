'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  Category,
  formatMoney,
  GROUP_LABELS,
  Transaction,
} from '@/lib/finance'
import { Plus, Trash2, ChevronDown } from 'lucide-react'

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

  // Choose sign for the group total:
  //   INCOME: + if total >= 0, − if total < 0
  //   EXPENSE: − if total >= 0, + if total < 0
  //   RESERVE: no sign prefix (the number's own sign is enough)
  const totalSign =
    isReserve
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
          <span className="font-semibold text-sm">{GROUP_LABELS[group as keyof typeof GROUP_LABELS] || group}</span>
          <span className="text-xs text-muted-foreground">({cats.length})</span>
        </div>
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
          {totalSign}
          {formatMoney(Math.abs(total), 'BRL')}
        </span>
      </button>

      {open && (
        <div className="divide-y divide-border">
          {cats.map((cat) => {
            const tx = transactionsByCat[cat.id]
            const value = tx?.value ?? null
            // Build the displayed sign based on type AND actual value (so a
            // negative income like "Cheque especial −217" shows "−R$ 217"
            // rather than "+−R$ 217").
            const sign =
              value === null
                ? ''
                : cat.type === 'RESERVE'
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
                    className="px-3 py-1.5 rounded-md hover:bg-muted transition-colors touch-manipulation"
                  >
                    <span
                      className={cn(
                        'text-sm font-semibold tabular-nums',
                        value === null
                          ? 'text-muted-foreground italic font-normal'
                          : cat.type === 'INCOME'
                            ? 'text-emerald-600'
                            : cat.type === 'RESERVE'
                              ? 'text-amber-600'
                              : 'text-rose-600'
                      )}
                    >
                      {value === null
                        ? '—'
                        : sign + formatMoney(Math.abs(value), cat.currency)}
                    </span>
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
