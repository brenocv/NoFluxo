'use client'

import { Card } from '@/components/ui/card'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from 'recharts'
import { MONTHS_PT, formatBRL } from '@/lib/finance'
import { cn } from '@/lib/utils'

interface Props {
  data: { month: string; monthIdx: number; entradas: number; saidas: number; saldo: number }[]
  selectedMonth: number
  onSelectMonth: (m: number) => void
  euroRate: number
}

export function AnnualDashboard({ data, selectedMonth, onSelectMonth, euroRate }: Props) {
  const cumulativeData = data.reduce(
    (acc: (typeof data)[number] & { cumulative: number }[], d) => {
      const prev = acc.length > 0 ? acc[acc.length - 1].cumulative : 0
      return [...acc, { ...d, cumulative: prev + d.saldo }]
    },
    []
  )
  const totalSaldo = cumulativeData[cumulativeData.length - 1]?.cumulative ?? 0
  const bestMonth = data.reduce((best, d) => d.saldo > best.saldo ? d : best, data[0])
  const worstMonth = data.reduce((worst, d) => d.saldo < worst.saldo ? d : worst, data[0])

  return (
    <Card className="p-3 space-y-3 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Evolução anual</span>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />Saldo mensal</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500" />Acumulado</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <StatBox label="Saldo acumulado" value={formatBRL(totalSaldo)} tone={totalSaldo >= 0 ? 'positive' : 'negative'} />
        <StatBox label="Melhor mês" value={bestMonth?.month ?? '—'} sub={bestMonth ? formatBRL(bestMonth.saldo) : ''} tone="positive" />
        <StatBox label="Pior mês" value={worstMonth?.month ?? '—'} sub={worstMonth ? formatBRL(worstMonth.saldo) : ''} tone="negative" />
      </div>
      <div className="h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={cumulativeData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="saldoGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="oklch(0.65 0.18 145)" stopOpacity={0.4} />
                <stop offset="95%" stopColor="oklch(0.65 0.18 145)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="cumGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="oklch(0.55 0.20 250)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="oklch(0.55 0.20 250)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="oklch(0.92 0 0)" />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'oklch(0.55 0 0)' }} tickLine={false} axisLine={false} interval={0} />
            <YAxis tick={{ fontSize: 9, fill: 'oklch(0.55 0 0)' }} tickLine={false} axisLine={false} width={45} tickFormatter={(v) => Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
            <Tooltip content={<DashboardTooltip euroRate={euroRate} />} />
            <ReferenceLine y={0} stroke="oklch(0.70 0 0)" strokeDasharray="2 2" />
            <Area type="monotone" dataKey="saldo" name="Saldo mensal" stroke="oklch(0.55 0.18 145)" strokeWidth={2} fill="url(#saldoGrad)" />
            <Area type="monotone" dataKey="cumulative" name="Acumulado" stroke="oklch(0.50 0.20 250)" strokeWidth={2} fill="url(#cumGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="flex gap-0.5 overflow-x-auto scrollbar-hide -mx-1 px-1">
        {cumulativeData.map((d) => {
          const active = d.monthIdx === selectedMonth
          return (
            <button key={d.monthIdx} onClick={() => onSelectMonth(d.monthIdx)} className={cn('flex-1 min-w-[28px] h-7 rounded text-[10px] font-medium transition-all touch-manipulation flex items-center justify-center', active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80')} aria-label={`Ver ${d.month}`} aria-pressed={active}>{d.month[0]}</button>
          )
        })}
      </div>
    </Card>
  )
}

function StatBox({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: 'positive' | 'negative' }) {
  return (
    <div className="rounded-lg bg-muted/50 p-2">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn('text-xs font-bold tabular-nums mt-0.5', tone === 'positive' ? 'text-emerald-600' : 'text-rose-600')}>{value}</div>
      {sub && <div className="text-[9px] text-muted-foreground tabular-nums">{sub}</div>}
    </div>
  )
}

function DashboardTooltip({ active, payload, label, euroRate }: any) {
  if (!active || !payload || payload.length === 0) return null
  const saldo = payload.find((p: any) => p.dataKey === 'saldo')?.value ?? 0
  const cumulative = payload.find((p: any) => p.dataKey === 'cumulative')?.value ?? 0
  return (
    <div className="bg-background border border-border rounded-lg p-2.5 shadow-md text-xs space-y-1 min-w-[140px]">
      <div className="font-semibold text-foreground">{label}/2026</div>
      <div className="flex items-center justify-between gap-3"><span className="text-emerald-600">Saldo do mês</span><span className="font-medium tabular-nums">{formatBRL(saldo)}</span></div>
      <div className="flex items-center justify-between gap-3"><span className="text-blue-600">Acumulado</span><span className="font-medium tabular-nums">{formatBRL(cumulative)}</span></div>
    </div>
  )
}
