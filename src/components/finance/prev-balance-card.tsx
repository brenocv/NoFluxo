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

  return (
    <Card
      className={cn(
        'p-3 shadow-sm cursor-pointer transition-all touch-manipulation active:scale-[0.99]',
        'border-l-4',
        isExpense ? 'border-l-rose-500 dark:border-l-rose-600' : 'border-l-emerald-500 dark:border-l-emerald-600'
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={cn(
            'h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0',
            isExpense
              ? 'bg-rose-100 dark:bg-rose-950/50'
              : 'bg-emerald-100 dark:bg-emerald-950/50'
          )}>
            <ArrowLeftRight className={cn(
              'h-4 w-4',
              isExpense ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
            )} />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-foreground">
                Saldo do mês anterior
              </span>
              <Badge variant="outline" className={cn(
                'h-5 px-1.5 text-[9px] flex-shrink-0',
                isExpense
                  ? 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300'
                  : 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
              )}>
                {prevMonthLabel}
              </Badge>
            </div>
            <span className="text-[10px] text-muted-foreground">
              {isExpense ? 'déficit do mês anterior (entra nas saídas)' : 'sobra do mês anterior (entra nas entradas)'}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end leading-tight flex-shrink-0">
          <span className={cn(
            'text-base font-bold tabular-nums',
            isExpense ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
          )}>
            {sign}{formatBRL(absValue)}
          </span>
          <span className="text-[10px] text-muted-foreground tabular-nums">
            ≈ {formatEUR(absValue / euroRate)}
          </span>
        </div>
      </div>
    </Card>
  )
}
