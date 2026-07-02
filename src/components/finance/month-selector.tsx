'use client'

import { cn } from '@/lib/utils'
import { MONTHS_PT, MONTHS_PT_LONG } from '@/lib/finance'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  selected: number
  year: number
  onSelect: (m: number) => void
  onYearChange: (y: number) => void
}

export function MonthSelector({ selected, year, onSelect, onYearChange }: Props) {
  return (
    <div className="w-full">
      {/* Year navigation */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => onYearChange(year - 1)}
          className="h-8 w-8 flex items-center justify-center rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground touch-manipulation"
          aria-label="Ano anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-center">
          <div className="text-lg font-bold tabular-nums leading-none">{year}</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
            {MONTHS_PT_LONG[selected - 1]}
          </div>
        </div>
        <button
          onClick={() => onYearChange(year + 1)}
          className="h-8 w-8 flex items-center justify-center rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground touch-manipulation"
          aria-label="Próximo ano"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      {/* Month strip */}
      <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
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
