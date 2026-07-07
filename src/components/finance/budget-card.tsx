'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { PiggyBank, Target, TrendingUp, TrendingDown, Pencil, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatBRL } from '@/lib/finance'

interface Props {
  year: number
  user: string
  workbookId: string
}

interface BudgetData {
  year: number
  goal: number
  current: number
  progress: number
}

export function BudgetCard({ year, user, workbookId }: Props) {
  const [data, setData] = useState<BudgetData | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [goalInput, setGoalInput] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const r = await fetch(`/api/budget?year=${year}&workbookId=${workbookId}`)
        if (!r.ok) throw new Error('fail')
        const d = await r.json()
        if (cancelled) return
        setData(d)
        setGoalInput(d.goal ? String(d.goal) : '')
      } catch {
        if (cancelled) return
        setData({ year, goal: 0, current: 0, progress: 0 })
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [year])

  async function saveGoal() {
    const goal = parseFloat(goalInput.replace(',', '.')) || 0
    try {
      const r = await fetch('/api/budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, goal, user, workbookId }),
      })
      if (!r.ok) throw new Error('fail')
      const d = await r.json()
      setData((prev) => prev ? { ...prev, goal: d.goal } : prev)
      setEditing(false)
    } catch {
      // ignore
    }
  }

  if (loading || !data) {
    return (
      <Card className="p-3 space-y-2 shadow-sm">
        <div className="h-4 w-32 bg-muted animate-pulse rounded" />
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
      </Card>
    )
  }

  const remaining = data.goal - data.current
  const onTrack = data.current >= data.goal
  const hasGoal = data.goal > 0

  return (
    <Card className="p-4 space-y-3 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <PiggyBank className="h-4 w-4 text-emerald-600" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Meta de poupança {year}
          </span>
        </div>
        <Popover open={editing} onOpenChange={setEditing}>
          <PopoverTrigger asChild>
            <button
              className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors touch-manipulation"
              aria-label="Editar meta"
            >
              <Pencil className="h-3 w-3" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-56">
            <div className="space-y-2">
              <Label className="text-xs">Meta de poupança (R$)</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
                placeholder="Ex.: 12000"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && saveGoal()}
              />
              <p className="text-[10px] text-muted-foreground">
                Deixe vazio ou 0 para remover a meta.
              </p>
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={saveGoal}>
                  <Check className="h-3 w-3 mr-1" />
                  Salvar
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {!hasGoal ? (
        <div className="text-center py-2">
          <Target className="h-6 w-6 text-muted-foreground/40 mx-auto mb-1" />
          <p className="text-xs text-muted-foreground">
            Clique no lápis para definir uma meta de poupança para {year}.
          </p>
        </div>
      ) : (
        <>
          {/* Big numbers */}
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center">
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Poupado</div>
              <div className={cn(
                'text-sm font-bold tabular-nums',
                data.current >= 0 ? 'text-emerald-600' : 'text-rose-600'
              )}>
                {formatBRL(data.current)}
              </div>
            </div>
            <div className="text-center border-x border-border">
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Meta</div>
              <div className="text-sm font-bold tabular-nums text-foreground">
                {formatBRL(data.goal)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Faltam</div>
              <div className={cn(
                'text-sm font-bold tabular-nums',
                remaining > 0 ? 'text-amber-600' : 'text-emerald-600'
              )}>
                {remaining > 0 ? formatBRL(remaining) : '✓ Meta atingida'}
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Progresso</span>
              <span className="tabular-nums font-medium">
                {data.progress.toFixed(1)}%
              </span>
            </div>
            <div className="h-3 rounded-full bg-muted overflow-hidden relative">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  onTrack
                    ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                    : data.progress >= 50
                      ? 'bg-gradient-to-r from-amber-500 to-amber-400'
                      : 'bg-gradient-to-r from-rose-500 to-rose-400'
                )}
                style={{ width: `${Math.min(data.progress, 100)}%` }}
              />
              {onTrack && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <Check className="h-3 w-3 text-white" />
                </div>
              )}
            </div>
          </div>

          {/* Status */}
          <div className={cn(
            'flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-md',
            onTrack
              ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300'
              : 'bg-muted/50 text-muted-foreground'
          )}>
            {onTrack ? (
              <>
                <TrendingUp className="h-3 w-3" />
                <span className="font-medium">Meta atingida! Continue poupando.</span>
              </>
            ) : (
              <>
                <TrendingDown className="h-3 w-3" />
                <span>
                  Você poupou <strong className="tabular-nums">{formatBRL(Math.max(data.current, 0))}</strong> de <strong className="tabular-nums">{formatBRL(data.goal)}</strong>
                </span>
              </>
            )}
          </div>
        </>
      )}
    </Card>
  )
}
