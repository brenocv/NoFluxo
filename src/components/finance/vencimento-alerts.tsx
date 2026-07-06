'use client'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CalendarClock, AlertCircle } from 'lucide-react'
import { Category } from '@/lib/finance'
import { cn } from '@/lib/utils'

interface Props {
  categories: Category[]
  currentDay: number
  daysInMonth: number
}

function parseVencimentoDay(note: string | null): number | null {
  if (!note) return null
  const m = note.match(/(?:vence\s+)?dia?\s*(\d{1,2})/i)
  if (!m) return null
  const day = parseInt(m[1], 10)
  if (day < 1 || day > 31) return null
  return day
}

export function VencimentoAlerts({ categories, currentDay, daysInMonth }: Props) {
  const vencimentos = []
  for (const c of categories) {
    if (c.type !== 'EXPENSE') continue
    const day = parseVencimentoDay(c.note)
    if (day === null) continue
    const adjustedDay = Math.min(day, daysInMonth)
    vencimentos.push({ category: c, day: adjustedDay, daysUntil: adjustedDay - currentDay })
  }
  vencimentos.sort((a, b) => a.daysUntil - b.daysUntil)
  const upcoming = vencimentos.filter((v) => v.daysUntil <= 10)
  if (upcoming.length === 0) return null

  return (
    <Card className="p-3 space-y-2 shadow-sm">
      <div className="flex items-center gap-1.5">
        <CalendarClock className="h-3.5 w-3.5 text-amber-600" />
        <span className="text-xs font-semibold text-amber-900 dark:text-amber-200">Vencimentos próximos</span>
        <Badge variant="outline" className="h-4 px-1 text-[9px] border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300">{upcoming.length}</Badge>
      </div>
      <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1 pb-1">
        {upcoming.map((v) => <VencimentoChip key={v.category.id} v={v} />)}
      </div>
    </Card>
  )
}

function VencimentoChip({ v }: { v: { category: Category; day: number; daysUntil: number } }) {
  const isOverdue = v.daysUntil < 0
  const isToday = v.daysUntil === 0
  const label = isOverdue ? `${Math.abs(v.daysUntil)}d atrás` : isToday ? 'hoje' : v.daysUntil === 1 ? 'amanhã' : `${v.daysUntil}d`
  const color = isOverdue ? 'border-rose-400 bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
    : isToday ? 'border-orange-400 bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300'
    : v.daysUntil <= 3 ? 'border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
    : 'border-sky-300 bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300'
  return (
    <div className={cn('flex-shrink-0 rounded-lg border-2 px-2.5 py-1.5 min-w-[120px]', color)}>
      <div className="flex items-center gap-1">
        {isOverdue && <AlertCircle className="h-3 w-3 flex-shrink-0" />}
        <span className="text-xs font-semibold truncate">{v.category.name}</span>
      </div>
      <div className="text-[10px] mt-0.5 flex items-center justify-between">
        <span>dia {v.day}</span>
        <span className="font-bold">{label}</span>
      </div>
    </div>
  )
}
