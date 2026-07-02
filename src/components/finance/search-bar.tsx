'use client'

import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface Props {
  value: string
  onChange: (v: string) => void
  resultsCount?: number
}

export function SearchBar({ value, onChange, resultsCount }: Props) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Buscar categoria (ex.: Nubank, aluguel, reserva…)"
        className={cn(
          'pl-9 pr-9 h-10 bg-background',
          value && 'pr-20'
        )}
        autoComplete="off"
      />
      {value && (
        <>
          {resultsCount !== undefined && (
            <span className="absolute right-9 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground tabular-nums">
              {resultsCount} {resultsCount === 1 ? 'resultado' : 'resultados'}
            </span>
          )}
          <button
            onClick={() => onChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors touch-manipulation"
            aria-label="Limpar busca"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </>
      )}
    </div>
  )
}
