'use client'

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Wallet, ArrowRightLeft } from 'lucide-react'
import { formatBRL, formatEUR } from '@/lib/finance'

interface Props {
  entradasBRL: number
  saidasBRL: number
  entradasEUR: number
  saidasEUR: number
  reservasBRL: number
  euroRate: number
}

export function SummaryCard({
  entradasBRL,
  saidasBRL,
  entradasEUR,
  saidasEUR,
  reservasBRL,
  euroRate,
}: Props) {
  const saldoBRL = entradasBRL - saidasBRL
  const saldoEUR = entradasEUR - saidasEUR

  const totalEntradasBRL = entradasBRL + entradasEUR * euroRate
  const totalSaidasBRL = saidasBRL + saidasEUR * euroRate
  const saldoTotalBRL = totalEntradasBRL - totalSaidasBRL

  return (
    <Card className="p-4 space-y-3 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Resumo do mês
        </span>
        <span className="text-xs text-muted-foreground">
          €1 = R$ {euroRate.toFixed(2)}
        </span>
      </div>

      <div className="space-y-1">
        <div className="flex items-baseline gap-2">
          <span className="text-xs text-muted-foreground">Saldo total</span>
        </div>
        <div
          className={cn(
            'text-3xl font-bold tabular-nums',
            saldoTotalBRL >= 0 ? 'text-emerald-600' : 'text-rose-600'
          )}
        >
          {formatBRL(saldoTotalBRL)}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 pt-1">
        <Flow
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          label="Entradas"
          brl={entradasBRL}
          eur={entradasEUR}
          tone="positive"
        />
        <Flow
          icon={<TrendingDown className="h-3.5 w-3.5" />}
          label="Saídas"
          brl={saidasBRL}
          eur={saidasEUR}
          tone="negative"
        />
        <Flow
          icon={<Wallet className="h-3.5 w-3.5" />}
          label="Saldo BRL"
          brl={saldoBRL}
          eur={null}
          tone={saldoBRL >= 0 ? 'positive' : 'negative'}
        />
        <Flow
          icon={<ArrowRightLeft className="h-3.5 w-3.5" />}
          label="Saldo EUR"
          brl={null}
          eur={saldoEUR}
          tone={saldoEUR >= 0 ? 'positive' : 'negative'}
        />
      </div>

      {reservasBRL > 0 && (
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <span className="text-xs text-muted-foreground">Reservas (mês)</span>
          <span className="text-sm font-semibold text-foreground tabular-nums">
            {formatBRL(reservasBRL)}
          </span>
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
  tone,
}: {
  icon: React.ReactNode
  label: string
  brl: number | null
  eur: number | null
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
          </div>
        )}
      </div>
    </div>
  )
}
