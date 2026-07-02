'use client'

import { Card } from '@/components/ui/card'
import { Pie, PieChart, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { Category, Transaction, formatMoney } from '@/lib/finance'
import { cn } from '@/lib/utils'

interface Props {
  categories: Category[]
  transactionsByCat: Record<string, Transaction | undefined>
  euroRate: number
}

const COLORS = [
  '#dc2626', '#ea580c', '#d97706', '#ca8a04', '#65a30d',
  '#16a34a', '#0891b2', '#0284c7', '#4f46e5', '#7c3aed',
  '#c026d3', '#db2777', '#e11d48', '#f97316', '#facc15',
  '#84cc16', '#22c55e', '#06b6d4', '#3b82f6', '#6366f1',
  '#a855f7', '#ec4899', '#f43f5e', '#fb923c', '#fde047',
]

export function ExpensePieChart({ categories, transactionsByCat, euroRate }: Props) {
  // Only EXPENSE categories with values this month, consolidated in BRL
  const data = categories
    .filter((c) => c.type === 'EXPENSE' && !c.excludeFromTotal)
    .map((c) => {
      const tx = transactionsByCat[c.id]
      if (!tx) return null
      const vBRL = c.currency === 'BRL' ? tx.value : tx.value * euroRate
      return { name: c.name, value: vBRL, currency: c.currency, originalValue: tx.value }
    })
    .filter((d): d is { name: string; value: number; currency: 'BRL' | 'EUR'; originalValue: number } => d !== null && d.value > 0)
    .sort((a, b) => b.value - a.value)

  const total = data.reduce((acc, d) => acc + d.value, 0)

  return (
    <Card className="p-3 space-y-2 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Distribuição de gastos
        </span>
        <span className="text-xs text-muted-foreground">em R$</span>
      </div>
      {data.length === 0 ? (
        <div className="h-40 flex items-center justify-center text-xs text-muted-foreground">
          Nenhum gasto neste mês
        </div>
      ) : (
        <>
          <div className="h-40 w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={1}
                  stroke="none"
                >
                  {data.map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip euroRate={euroRate} />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[10px] text-muted-foreground">Total</span>
              <span className="text-sm font-bold tabular-nums">{formatMoney(total, 'BRL')}</span>
              <span className="text-[9px] text-muted-foreground tabular-nums">
                ≈ {formatMoney(total / euroRate, 'EUR')}
              </span>
            </div>
          </div>
          {/* Legend */}
          <div className="space-y-1 max-h-32 overflow-y-auto scrollbar-thin pr-1">
            {data.slice(0, 8).map((d, idx) => (
              <div key={d.name} className="flex items-center justify-between text-[10px]">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="h-2 w-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                  />
                  <span className="truncate text-foreground">{d.name}</span>
                </div>
                <span className="tabular-nums text-muted-foreground flex-shrink-0 ml-2">
                  {formatMoney(d.value, 'BRL')}
                  <span className="ml-1 text-[9px]">
                    ({Math.round((d.value / total) * 100)}%)
                  </span>
                </span>
              </div>
            ))}
            {data.length > 8 && (
              <div className="text-[10px] text-muted-foreground text-center pt-1">
                + {data.length - 8} categoria(s)
              </div>
            )}
          </div>
        </>
      )}
    </Card>
  )
}

function PieTooltip({ active, payload, euroRate }: any) {
  if (!active || !payload || payload.length === 0) return null
  const d = payload[0].payload
  return (
    <div className="bg-background border border-border rounded-lg p-2 shadow-md text-xs space-y-0.5">
      <div className="font-medium text-foreground">{d.name}</div>
      <div className="tabular-nums text-rose-600">{formatMoney(d.value, 'BRL')}</div>
      <div className="text-[10px] text-muted-foreground tabular-nums">
        ≈ {formatMoney(d.value / euroRate, 'EUR')}
        {' '}({Math.round((d.value / (active?.payload?.percent ?? 1)) * 100)}%)
      </div>
    </div>
  )
}
