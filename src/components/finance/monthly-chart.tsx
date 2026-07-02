'use client'

import { Card } from '@/components/ui/card'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { MONTHS_PT, formatBRL } from '@/lib/finance'
import { cn } from '@/lib/utils'

interface MonthPoint {
  month: string
  monthIdx: number
  entradas: number // in BRL (EUR converted)
  saidas: number   // in BRL (EUR converted)
  saldo: number
}

interface Props {
  data: MonthPoint[]
  selectedMonth: number
  onSelectMonth: (m: number) => void
  euroRate: number
}

export function MonthlyChart({ data, selectedMonth, onSelectMonth, euroRate }: Props) {
  return (
    <Card className="p-3 space-y-2 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Entradas x Saídas (2026)
        </span>
        <span className="text-xs text-muted-foreground">em R$</span>
      </div>
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
            barGap={2}
            barCategoryGap="18%"
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="oklch(0.92 0 0)" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 10, fill: 'oklch(0.55 0 0)' }}
              tickLine={false}
              axisLine={false}
              interval={0}
            />
            <YAxis
              tick={{ fontSize: 9, fill: 'oklch(0.55 0 0)' }}
              tickLine={false}
              axisLine={false}
              width={45}
              tickFormatter={(v) => {
                if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(0)}k`
                return String(v)
              }}
            />
            <Tooltip
              cursor={{ fill: 'oklch(0.97 0 0 / 0.5)' }}
              content={<ChartTooltip euroRate={euroRate} />}
            />
            <Legend
              iconType="circle"
              wrapperStyle={{ fontSize: 10, paddingTop: 4 }}
            />
            <Bar
              dataKey="entradas"
              name="Entradas"
              fill="oklch(0.65 0.18 145)"
              radius={[3, 3, 0, 0]}
              maxBarSize={18}
            />
            <Bar
              dataKey="saidas"
              name="Saídas"
              fill="oklch(0.62 0.22 25)"
              radius={[3, 3, 0, 0]}
              maxBarSize={18}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* Clickable month strip below the chart */}
      <div className="flex gap-0.5 overflow-x-auto scrollbar-hide -mx-1 px-1">
        {data.map((d) => {
          const active = d.monthIdx === selectedMonth
          return (
            <button
              key={d.monthIdx}
              onClick={() => onSelectMonth(d.monthIdx)}
              className={cn(
                'flex-1 min-w-[28px] h-7 rounded text-[10px] font-medium transition-all touch-manipulation',
                'flex items-center justify-center',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
              aria-label={`Ver ${d.month}`}
              aria-pressed={active}
            >
              {d.month[0]}
            </button>
          )
        })}
      </div>
    </Card>
  )
}

function ChartTooltip({ active, payload, label, euroRate }: any) {
  if (!active || !payload || payload.length === 0) return null
  const entradas = payload.find((p: any) => p.dataKey === 'entradas')?.value ?? 0
  const saidas = payload.find((p: any) => p.dataKey === 'saidas')?.value ?? 0
  const saldo = entradas - saidas
  return (
    <div className="bg-background border border-border rounded-lg p-2.5 shadow-md text-xs space-y-1 min-w-[140px]">
      <div className="font-semibold text-foreground">{label}/2026</div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-emerald-600 flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Entradas
        </span>
        <span className="font-medium tabular-nums">{formatBRL(entradas)}</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-rose-600 flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-rose-500" />
          Saídas
        </span>
        <span className="font-medium tabular-nums">{formatBRL(saidas)}</span>
      </div>
      <div className="pt-1 border-t border-border flex items-center justify-between gap-3">
        <span className="text-muted-foreground">Saldo</span>
        <span
          className={cn(
            'font-semibold tabular-nums',
            saldo >= 0 ? 'text-emerald-600' : 'text-rose-600'
          )}
        >
          {formatBRL(saldo)}
        </span>
      </div>
      <div className="text-[10px] text-muted-foreground tabular-nums">
        ≈ € {(saldo / euroRate).toFixed(2)}
      </div>
    </div>
  )
}
