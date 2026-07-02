'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Category, formatMoney, MONTHS_PT_LONG, Transaction } from '@/lib/finance'
import { cn } from '@/lib/utils'
import { Trash2 } from 'lucide-react'

interface Props {
  open: boolean
  category: Category | null
  transaction: Transaction | null
  month: number
  euroRate: number
  onOpenChange: (open: boolean) => void
  onSave: (value: number | null, note: string | null) => Promise<void>
  onClear: () => Promise<void>
}

export function TransactionEditor({
  open,
  category,
  transaction,
  month,
  euroRate,
  onOpenChange,
  onSave,
  onClear,
}: Props) {
  const [raw, setRaw] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setRaw(transaction?.value != null ? String(transaction.value) : '')
      setNote(transaction?.note ?? '')
    }
  }, [open, transaction])

  if (!category) return null

  const monthLabel = MONTHS_PT_LONG[month - 1]
  const isIncome = category.type === 'INCOME'
  const isReserve = category.type === 'RESERVE'

  const parsed = parseFloat(raw.replace(',', '.'))
  const valid = !isNaN(parsed) && parsed >= 0

  async function handleSave() {
    if (!valid) return
    setSaving(true)
    try {
      await onSave(parsed, note.trim() || null)
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleClear() {
    setSaving(true)
    try {
      await onClear()
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex flex-col gap-1">
            <span className="text-base">{category.name}</span>
            <span className="text-xs font-normal text-muted-foreground">
              {monthLabel} / 2026 • {category.currency}
              {category.note ? ` • ${category.note}` : ''}
            </span>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Edite o valor e a nota desta categoria para {monthLabel} de 2026.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="tx-value">
              Valor{' '}
              <span className="text-xs text-muted-foreground">
                ({category.currency === 'BRL' ? 'R$' : '€'})
              </span>
            </Label>
            <Input
              id="tx-value"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder="0,00"
              className={cn(
                'text-2xl font-semibold tabular-nums h-14',
                isIncome && valid && 'text-emerald-600',
                !isIncome && !isReserve && valid && 'text-rose-600',
                isReserve && valid && 'text-amber-600'
              )}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && valid) handleSave()
              }}
            />
            {valid && (
              <p className="text-xs text-muted-foreground">
                {isIncome ? '+' : isReserve ? '' : '−'}
                {formatMoney(parsed, category.currency)}
                {category.currency === 'EUR' && (
                  <span className="ml-1">≈ {formatMoney(parsed * euroRate, 'BRL')}</span>
                )}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tx-note">Nota (opcional)</Label>
            <Input
              id="tx-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex.: dia 11, parcela 3/8…"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && valid) handleSave()
              }}
            />
          </div>
        </div>

        <DialogFooter className="flex-row gap-2 sm:justify-between">
          {transaction ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              disabled={saving}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Limpar
            </Button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={!valid || saving}>
              {saving ? 'Salvando…' : 'Salvar'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
