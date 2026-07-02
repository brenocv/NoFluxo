'use client'

import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Wallet, ArrowRightLeft, PiggyBank } from 'lucide-react'
import { formatBRL, formatEUR, formatDualCompact } from '@/lib/finance'

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
}

export function SummaryCard({
  entradasBRL,
  saidasBRL,
  entradasEUR,
  saidasEUR,
  reservasBRL,
  receivablesBRL,
  receivablesEUR,
  includeReceivables,
  onToggleReceivables,
  euroRate,
}: Props) {
  const saldoBRL = entradasBRL - saidasBRL
  const saldoEUR = entradasEUR - saidasEUR

  // Combined total in BRL
  const totalEntradasBRL = entradasBRL + entradasEUR * euroRate
  const totalSaidasBRL = saidasBRL + saidasEUR * euroRate
  let saldoTotalBRL = totalEntradasBRL - totalSaidasBRL
  let saldoTotalEUR = saldoTotalBRL / euroRate

  if (includeReceivables) {
    saldoTotalBRL += receivablesBRL + receivablesEUR * euroRate
    saldoTotalEUR = saldoTotalBRL / euroRate
  }

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

      {/* Big balance — dual currency */}
      <div className="space-y-1">
        <div className="flex items-baseline gap-2">
          <span className="text-xs text-muted-foreground">Saldo total</span>
          {receivablesBRL + receivablesEUR > 0 && (
            <span className="text-[10px] text-muted-foreground">
              {includeReceivables ? '(com valores a receber)' : '(sem valores a receber)'}
            </span>
          )}
        </div>
        <div
          className={cn(
            'text-3xl font-bold tabular-nums',
            saldoTotalBRL >= 0 ? 'text-emerald-600' : 'text-rose-600'
          )}
        >
          {formatBRL(saldoTotalBRL)}
        </div>
        <div
          className={cn(
            'text-sm font-medium tabular-nums',
            saldoTotalEUR >= 0 ? 'text-emerald-600/80' : 'text-rose-600/80'
          )}
        >
          ≈ {formatEUR(saldoTotalEUR)}
        </div>
      </div>

      {/* Detailed flows — each shows dual currency */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <Flow
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          label="Entradas"
          brl={entradasBRL}
          eur={entradasEUR}
          euroRate={euroRate}
          tone="positive"
        />
        <Flow
          icon={<TrendingDown className="h-3.5 w-3.5" />}
          label="Saídas"
          brl={saidasBRL}
          eur={saidasEUR}
          euroRate={euroRate}
          tone="negative"
        />
        <Flow
          icon={<Wallet className="h-3.5 w-3.5" />}
          label="Saldo BRL"
          brl={saldoBRL}
          eur={null}
          euroRate={euroRate}
          tone={saldoBRL >= 0 ? 'positive' : 'negative'}
        />
        <Flow
          icon={<ArrowRightLeft className="h-3.5 w-3.5" />}
          label="Saldo EUR"
          brl={null}
          eur={saldoEUR}
          euroRate={euroRate}
          tone={saldoEUR >= 0 ? 'positive' : 'negative'}
        />
      </div>

      {reservasBRL > 0 && (
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <PiggyBank className="h-3 w-3" />
            Reservas (mês)
          </span>
          <span className="text-xs font-semibold text-foreground tabular-nums">
            {formatDualCompact(reservasBRL, 'BRL', euroRate)}
          </span>
        </div>
      )}

      {/* Toggle for valores a receber */}
      {(receivablesBRL > 0 || receivablesEUR > 0) && (
        <div className="flex items-center justify-between pt-2 border-t border-border gap-3">
          <div className="flex-1 min-w-0">
            <Label htmlFor="include-receivables" className="text-xs font-medium cursor-pointer">
              Incluir valores a receber
            </Label>
            <p className="text-[10px] text-muted-foreground truncate">
              {formatDualCompact(receivablesBRL + receivablesEUR * euroRate, 'BRL', euroRate)} pendente
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

function Flow({
  icon,
  label,
  brl,
  eur,
  euroRate,
  tone,
}: {
  icon: React.ReactNode
  label: string
  brl: number | null
  eur: number | null
  euroRate: number
  tone: 'positive' | 'negative'
}) {
  return (
    <div className="rounded-lg bg-muted/50 p-2.5">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-[10px] uppercase tracking-wider font-medium">{label}</span>
      </div>
      <div className="mt-1 space-y-0.5">
        {brl !== null && (
          <div
            className={cn(
              'text-sm font-semibold tabular-nums',
              tone === 'positive' ? 'text-emerald-600' : 'text-rose-600'
            )}
          >
            {formatBRL(brl)}
            <span className="text-[10px] text-muted-foreground ml-1 font-normal">
              ({formatEUR(brl / euroRate)})
            </span>
          </div>
        )}
        {eur !== null && (
          <div
            className={cn(
              'text-sm font-semibold tabular-nums',
              tone === 'positive' ? 'text-emerald-600' : 'text-rose-600'
            )}
          >
            {formatEUR(eur)}
            <span className="text-[10px] text-muted-foreground ml-1 font-normal">
              ({formatBRL(eur * euroRate)})
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
