'use client'

import { cn } from '@/lib/utils'
import { MONTHS_PT, MONTHS_PT_LONG } from '@/lib/finance'

interface Props {
  selected: number
  onSelect: (m: number) => void
}

export function MonthSelector({ selected, onSelect }: Props) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Mês
        </span>
        <span className="text-sm font-semibold text-foreground">
          {MONTHS_PT_LONG[selected - 1]} / 2026
        </span>
      </div>
      <div className="flex gap-1 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
        {MONTHS_PT.map((label, idx) => {
          const m = idx + 1
          const active = m === selected
          return (
            <button
              key={m}
              onClick={() => onSelect(m)}
              className={cn(
                'flex-shrink-0 h-10 min-w-[44px] px-3 rounded-lg text-sm font-medium transition-all',
                'flex items-center justify-center touch-manipulation',
                active
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
              aria-label={`Selecionar ${MONTHS_PT_LONG[idx]}`}
              aria-pressed={active}
            >
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
