'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { MONTHS_PT, MONTHS_PT_LONG } from '@/lib/finance'
import { Copy, Check, AlertTriangle } from 'lucide-react'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  fromYear: number
  fromMonth: number
  onCopy: (toYear: number, toMonth: number) => Promise<void>
}

export function CopyMonthDialog({
  open, onOpenChange, fromYear, fromMonth, onCopy,
}: Props) {
  const [targetYear, setTargetYear] = useState(fromYear)
  const [targetMonth, setTargetMonth] = useState<number | null>(null)
  const [copying, setCopying] = useState(false)

  const fromLabel = `${MONTHS_PT_LONG[fromMonth - 1]}/${fromYear}`

  async function handleCopy() {
    if (targetMonth === null) return
    setCopying(true)
    try {
      await onCopy(targetYear, targetMonth)
      onOpenChange(false)
      setTargetMonth(null)
    } finally {
      setCopying(false)
    }
  }

  // Same month/year warning
  const isSame = targetMonth === fromMonth && targetYear === fromYear

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setTargetMonth(null) }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-4 w-4" />
            Copiar mês
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Copiar todos os valores de <strong>{fromLabel}</strong> para:
          </p>
          <DialogDescription className="sr-only">
            Escolha o mês e ano de destino para copiar os valores.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* Year selector */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Ano de destino</span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setTargetYear(targetYear - 1)}
              >
                −
              </Button>
              <span className="text-sm font-semibold tabular-nums w-12 text-center">{targetYear}</span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setTargetYear(targetYear + 1)}
              >
                +
              </Button>
            </div>
          </div>

          {/* Month grid */}
          <div className="grid grid-cols-4 gap-1.5">
            {MONTHS_PT.map((label, idx) => {
              const m = idx + 1
              const active = targetMonth === m
              const isFromSame = m === fromMonth && targetYear === fromYear
              return (
                <button
                  key={m}
                  onClick={() => setTargetMonth(m)}
                  className={cn(
                    'h-10 rounded-lg text-sm font-medium transition-all touch-manipulation',
                    'flex flex-col items-center justify-center',
                    active
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : isFromSame
                        ? 'bg-muted text-muted-foreground opacity-50'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  )}
                >
                  {label}
                  {isFromSame && (
                    <span className="text-[8px] opacity-70">origem</span>
                  )}
                </button>
              )
            })}
          </div>

          {isSame && (
            <p className="text-xs text-amber-600 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              O mês de destino é igual ao de origem.
            </p>
          )}

          {targetMonth !== null && !isSame && (
            <p className="text-xs text-muted-foreground">
              Os valores existentes em <strong>{MONTHS_PT_LONG[targetMonth - 1]}/{targetYear}</strong> serão
              substituídos pelos valores de <strong>{fromLabel}</strong>.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={copying}>
            Cancelar
          </Button>
          <Button
            onClick={handleCopy}
            disabled={targetMonth === null || isSame || copying}
          >
            {copying ? (
              'Copiando…'
            ) : (
              <>
                <Copy className="h-3.5 w-3.5 mr-1" />
                Copiar para {targetMonth !== null ? MONTHS_PT[targetMonth - 1] : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
