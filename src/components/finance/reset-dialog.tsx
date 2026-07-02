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
import { MONTHS_PT_LONG } from '@/lib/finance'
import { Trash2, AlertTriangle } from 'lucide-react'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  year: number
  month: number
  onReset: (scope: 'month' | 'year') => Promise<void>
}

export function ResetDialog({ open, onOpenChange, year, month, onReset }: Props) {
  const [scope, setScope] = useState<'month' | 'year'>('month')
  const [resetting, setResetting] = useState(false)
  const [confirmText, setConfirmText] = useState('')

  const monthLabel = `${MONTHS_PT_LONG[month - 1]}/${year}`
  const isConfirmed = confirmText.toUpperCase() === 'ZERAR'

  async function handleReset() {
    if (!isConfirmed) return
    setResetting(true)
    try {
      await onReset(scope)
      onOpenChange(false)
      setConfirmText('')
    } finally {
      setResetting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setConfirmText('') }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-rose-600">
            <Trash2 className="h-4 w-4" />
            Zerar valores
          </DialogTitle>
          <DialogDescription className="sr-only">
            Escolha o escopo do reset e confirme digitando ZERAR.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Scope selector */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setScope('month')}
              className={cn(
                'p-3 rounded-lg border-2 text-left transition-all touch-manipulation',
                scope === 'month'
                  ? 'border-rose-400 bg-rose-50'
                  : 'border-border bg-muted/50 hover:bg-muted'
              )}
            >
              <div className="text-sm font-semibold">Este mês</div>
              <div className="text-xs text-muted-foreground">{monthLabel}</div>
            </button>
            <button
              onClick={() => setScope('year')}
              className={cn(
                'p-3 rounded-lg border-2 text-left transition-all touch-manipulation',
                scope === 'year'
                  ? 'border-rose-400 bg-rose-50'
                  : 'border-border bg-muted/50 hover:bg-muted'
              )}
            >
              <div className="text-sm font-semibold">Ano todo</div>
              <div className="text-xs text-muted-foreground">{year}</div>
            </button>
          </div>

          {/* Warning */}
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 flex gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">
              {scope === 'month'
                ? `Todos os valores de ${monthLabel} serão removidos permanentemente. As categorias e configurações não serão afetadas.`
                : `Todos os valores de ${year} (todos os 12 meses) serão removidos permanentemente. As categorias e configurações não serão afetadas.`}
            </p>
          </div>

          {/* Confirmation input */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              Para confirmar, digite <strong className="text-foreground">ZERAR</strong>:
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="ZERAR"
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm uppercase tracking-wider"
              autoComplete="off"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={resetting}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleReset}
            disabled={!isConfirmed || resetting}
          >
            {resetting ? 'Zerando…' : 'Zerar valores'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
