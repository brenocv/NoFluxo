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
import { Trash2, AlertTriangle, RotateCcw } from 'lucide-react'

type Scope = 'month' | 'year' | 'factory'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  year: number
  month: number
  onReset: (scope: Scope) => Promise<void>
}

export function ResetDialog({ open, onOpenChange, year, month, onReset }: Props) {
  const [scope, setScope] = useState<Scope>('month')
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
      <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
            <Trash2 className="h-4 w-4" />
            Zerar
          </DialogTitle>
          <DialogDescription className="sr-only">
            Escolha o escopo do reset e confirme digitando ZERAR.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Scope selector — 3 options */}
          <div className="space-y-2">
            <button
              onClick={() => setScope('month')}
              className={cn(
                'w-full p-3 rounded-lg border-2 text-left transition-all touch-manipulation',
                scope === 'month'
                  ? 'border-rose-400 dark:border-rose-500 bg-rose-50 dark:bg-rose-950/40'
                  : 'border-border bg-muted/50 hover:bg-muted'
              )}
            >
              <div className="text-sm font-semibold">Zerar valores deste mês</div>
              <div className="text-xs text-muted-foreground">{monthLabel}</div>
              <div className="text-[11px] text-muted-foreground mt-1">
                Remove apenas os valores do mês. Categorias, subgrupos e configurações continuam.
              </div>
            </button>
            <button
              onClick={() => setScope('year')}
              className={cn(
                'w-full p-3 rounded-lg border-2 text-left transition-all touch-manipulation',
                scope === 'year'
                  ? 'border-rose-400 dark:border-rose-500 bg-rose-50 dark:bg-rose-950/40'
                  : 'border-border bg-muted/50 hover:bg-muted'
              )}
            >
              <div className="text-sm font-semibold">Zerar valores do ano</div>
              <div className="text-xs text-muted-foreground">{year}</div>
              <div className="text-[11px] text-muted-foreground mt-1">
                Remove os valores dos 12 meses. Categorias, subgrupos e configurações continuam.
              </div>
            </button>
            <button
              onClick={() => setScope('factory')}
              className={cn(
                'w-full p-3 rounded-lg border-2 text-left transition-all touch-manipulation',
                scope === 'factory'
                  ? 'border-rose-500 dark:border-rose-600 bg-rose-100 dark:bg-rose-950/60'
                  : 'border-rose-200 dark:border-rose-900 bg-rose-50/40 dark:bg-rose-950/20 hover:bg-rose-50 dark:hover:bg-rose-950/40'
              )}
            >
              <div className="text-sm font-semibold flex items-center gap-1.5 text-rose-700 dark:text-rose-300">
                <RotateCcw className="h-3.5 w-3.5" />
                Resetar planilha para o estado inicial
              </div>
              <div className="text-xs text-muted-foreground">Volta para Despesas, Rendimentos e Reservas vazios</div>
              <div className="text-[11px] text-rose-700/80 dark:text-rose-300/80 mt-1">
                Remove TODOS os valores, TODOS os itens criados, TODOS os subgrupos extras e TODOS os cards extras. Mantém apenas os 3 cards padrão + 5 subgrupos padrão + configurações de moeda.
              </div>
            </button>
          </div>

          {/* Warning */}
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 flex gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 dark:text-amber-200">
              {scope === 'month' && `Todos os valores de ${monthLabel} serão removidos. As categorias e configurações não serão afetadas.`}
              {scope === 'year' && `Todos os valores de ${year} (todos os 12 meses) serão removidos. As categorias e configurações não serão afetadas.`}
              {scope === 'factory' && `A planilha voltará ao estado de "recém-criada": apenas Despesas, Rendimentos e Reservas vazios. Todos os itens, subgrupos extras e cards extras serão APAGADOS. As configurações de moeda e a cotação do Euro serão mantidas. Esta ação NÃO pode ser desfeita com o botão Desfazer.`}
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
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground text-sm uppercase tracking-wider placeholder:text-muted-foreground/60"
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
            {resetting ? 'Zerando…' : scope === 'factory' ? 'Resetar planilha' : 'Zerar valores'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
