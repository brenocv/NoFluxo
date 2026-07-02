'use client'

import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, PiggyBank, Clock } from 'lucide-react'
import { formatBRL, formatEUR } from '@/lib/finance'

interface Props {
  entradasBRL: number
  saidasBRL: number
  entradasEUR: number
  saidasEUR: number
  reservasBRL: number
  receivablesBRL: number
  receivablesEUR: number
  includeReceivables: boolean
  onToggleReceivables: (v: boolean) => void
  euroRate: number
  onEntradasClick: () => void
  onSaidasClick: () => void
}

export function SummaryCard({
  entradasBRL, saidasBRL, entradasEUR, saidasEUR,
  reservasBRL, receivablesBRL, receivablesEUR,
  includeReceivables, onToggleReceivables, euroRate,
  onEntradasClick, onSaidasClick,
}: Props) {
  const totalEntradasBRL = entradasBRL + entradasEUR * euroRate
  const totalSaidasBRL = saidasBRL + saidasEUR * euroRate
  let saldoTotalBRL = totalEntradasBRL - totalSaidasBRL

  if (includeReceivables) {
    saldoTotalBRL += receivablesBRL + receivablesEUR * euroRate
  }
  const saldoTotalEUR = saldoTotalBRL / euroRate

  return (
    <Card className="p-4 space-y-3 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Resumo do mês
        </span>
        <span className="text-xs text-muted-foreground">
          €1 = R$ {euroRate.toFixed(2).replace('.', ',')}
        </span>
      </div>

      <div className="space-y-1">
        <div className="flex items-baseline gap-2">
          <span className="text-xs text-muted-foreground">Saldo total</span>
          {receivablesBRL + receivablesEUR > 0 && (
            <span className="text-[10px] text-muted-foreground">
              {includeReceivables ? '(com valores a receber)' : '(sem valores a receber)'}
            </span>
          )}
        </div>
        <div className={cn('text-3xl font-bold tabular-nums', saldoTotalBRL >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
          {formatBRL(saldoTotalBRL)}
        </div>
        <div className={cn('text-sm font-medium tabular-nums', saldoTotalEUR >= 0 ? 'text-emerald-600/80' : 'text-rose-600/80')}>
          ≈ {formatEUR(saldoTotalEUR)}
        </div>
      </div>

      {/* Entradas / Saídas — clickable to scroll to the corresponding group */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <button
          onClick={onEntradasClick}
          className="text-left rounded-lg bg-muted/50 p-2.5 hover:bg-muted transition-colors touch-manipulation active:scale-[0.98]"
          aria-label="Ver rendimentos"
        >
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5" />
            <span className="text-[10px] uppercase tracking-wider font-medium">Entradas →</span>
          </div>
          <div className="mt-1 space-y-0.5">
            <div className="text-sm font-semibold tabular-nums text-emerald-600">
              {formatBRL(totalEntradasBRL)}
            </div>
            <div className="text-[10px] text-muted-foreground tabular-nums">
              ≈ {formatEUR(totalEntradasBRL / euroRate)}
            </div>
          </div>
        </button>
        <button
          onClick={onSaidasClick}
          className="text-left rounded-lg bg-muted/50 p-2.5 hover:bg-muted transition-colors touch-manipulation active:scale-[0.98]"
          aria-label="Ver despesas"
        >
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <TrendingDown className="h-3.5 w-3.5" />
            <span className="text-[10px] uppercase tracking-wider font-medium">Saídas →</span>
          </div>
          <div className="mt-1 space-y-0.5">
            <div className="text-sm font-semibold tabular-nums text-rose-600">
              {formatBRL(totalSaidasBRL)}
            </div>
            <div className="text-[10px] text-muted-foreground tabular-nums">
              ≈ {formatEUR(totalSaidasBRL / euroRate)}
            </div>
          </div>
        </button>
      </div>

      {reservasBRL > 0 && (
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <PiggyBank className="h-3 w-3" />
            Reservas (mês)
          </span>
          <span className="text-xs font-semibold text-foreground tabular-nums">
            {formatBRL(reservasBRL)}
            <span className="text-[10px] text-muted-foreground ml-1 font-normal">
              ({formatEUR(reservasBRL / euroRate)})
            </span>
          </span>
        </div>
      )}

      {(receivablesBRL > 0 || receivablesEUR > 0) && (
        <div className="flex items-center justify-between pt-2 border-t border-border gap-3">
          <div className="flex-1 min-w-0">
            <Label htmlFor="include-receivables" className="text-xs font-medium cursor-pointer flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Incluir valores a receber
            </Label>
            <p className="text-[10px] text-muted-foreground truncate tabular-nums">
              {formatBRL(receivablesBRL + receivablesEUR * euroRate)} pendente
            </p>
          </div>
          <Switch
            id="include-receivables"
            checked={includeReceivables}
            onCheckedChange={onToggleReceivables}
          />
        </div>
      )}
    </Card>
  )
}
