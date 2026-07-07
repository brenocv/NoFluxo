'use client'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeftRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatBRL, formatEUR } from '@/lib/finance'

interface Props {
  balance: number | null
  prevMonthLabel: string
  euroRate: number
  onClick: () => void
}

export function PrevBalanceCard({ balance, prevMonthLabel, euroRate, onClick }: Props) {
  if (balance === null || balance === 0) return null

  const absValue = Math.abs(balance)
  const isExpense = balance < 0
  const sign = isExpense ? '−' : '+'
  const color = isExpense ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'

  return (
    <Card
      className={cn(
        'p-3 shadow-sm cursor-pointer touch-manipulation transition-all active:scale-[0.99]',
        'bg-amber-50/80 dark:bg-amber-950/40',
        'border-amber-300 dark:border-amber-800/60',
        'border-l-4 border-l-amber-500 dark:border-l-amber-600'
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-between gap-3">
        {/* Left: icon + labels */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-9 w-9 rounded-full bg-amber-100 dark:bg-amber-900/60 flex items-center justify-center flex-shrink-0">
            <ArrowLeftRight className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold text-amber-900 dark:text-amber-100 flex items-center gap-1.5">
              Saldo mês anterior
              <Badge variant="outline" className="h-4 px-1 text-[9px] border-amber-400 dark:border-amber-700 bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300">
                {prevMonthLabel}
              </Badge>
            </span>
            <span className="text-[10px] text-amber-700 dark:text-amber-400/80">
              {isExpense ? 'déficit do mês anterior' : 'sobra do mês anterior'}
            </span>
          </div>
        </div>

        {/* Right: value */}
        <div className="flex flex-col items-end leading-tight flex-shrink-0">
          <span className={cn('text-base font-bold tabular-nums', color)}>
            {sign}{formatBRL(absValue)}
          </span>
          <span className="text-[10px] text-muted-foreground dark:text-amber-400/60 tabular-nums">
            ≈ {formatEUR(absValue / euroRate)}
          </span>
        </div>
      </div>
    </Card>
  )
}
