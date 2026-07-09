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
import { Switch } from '@/components/ui/switch'
import { Category, formatMoney, MONTHS_PT_LONG, Transaction } from '@/lib/finance'
import { cn } from '@/lib/utils'
import { Trash2, RefreshCw, AlertTriangle } from 'lucide-react'

const PRESET_COLORS = [
  '#dc2626', '#ea580c', '#d97706', '#ca8a04', '#65a30d',
  '#16a34a', '#0891b2', '#0284c7', '#4f46e5', '#7c3aed',
  '#c026d3', '#db2777', '#e11d48', '#f97316', '#facc15',
]

interface Props {
  open: boolean
  category: Category | null
  transaction: Transaction | null
  month: number
  year: number
  euroRate: number
  onOpenChange: (open: boolean) => void
  onSave: (args: {
    value: number | null
    note: string | null
    isRecurring: boolean
    installmentsTotal: number | null
  }) => Promise<void>
  onClear: () => Promise<void>
  onStopRecurring: () => Promise<void>
  onUpdateCategory: (fields: {
    name?: string
    note?: string | null
    monthlyGoal?: number | null
    currency?: 'BRL' | 'EUR'
    color?: string | null
  }) => Promise<void>
}

export function TransactionEditor({
  open, category, transaction, month, year, euroRate,
  onOpenChange, onSave, onClear, onStopRecurring, onUpdateCategory,
}: Props) {
  const [raw, setRaw] = useState('')
  const [note, setNote] = useState('')
  const [isRecurring, setIsRecurring] = useState(false)
  const [installmentsTotal, setInstallmentsTotal] = useState('')
  const [saving, setSaving] = useState(false)

  // Category rename + goal
  const [catName, setCatName] = useState('')
  const [catNote, setCatNote] = useState('')
  const [goalValue, setGoalValue] = useState('')
  const [catCurrency, setCatCurrency] = useState<'BRL' | 'EUR'>('BRL')
  const [catColor, setCatColor] = useState<string>('')

  useEffect(() => {
    if (open && category) {
      setRaw(transaction?.value != null ? String(transaction.value) : '')
      setNote(transaction?.note ?? '')
      setIsRecurring(transaction?.isRecurring ?? false)
      setInstallmentsTotal(
        transaction?.installmentsTotal != null ? String(transaction.installmentsTotal) : ''
      )
      setCatName(category.name)
      setCatNote(category.note ?? '')
      setGoalValue(category.monthlyGoal != null ? String(category.monthlyGoal) : '')
      setCatCurrency(category.currency)
      setCatColor(category.color ?? '')
    }
  }, [open, transaction, category])

  if (!category) return null

  const monthLabel = MONTHS_PT_LONG[month - 1]
  const isIncome = category.type === 'INCOME'
  const isReserve = category.type === 'RESERVE'
  const isReceivable = category.group === 'rendimentos.valores_a_receber'

  const parsed = parseFloat(raw.replace(',', '.'))
  const valid = !isNaN(parsed) && parsed >= 0

  const parsedGoal = parseFloat(goalValue.replace(',', '.'))
  const goalValid = goalValue === '' || (!isNaN(parsedGoal) && parsedGoal >= 0)
  const goalExceeded = goalValid && goalValue !== '' && valid && parsed > parsedGoal && category.type === 'EXPENSE'

  // Check if editing an existing recurring transaction
  const editingRecurring = transaction?.isRecurring === true

  async function handleSave() {
    if (!valid) return
    setSaving(true)
    try {
      // Save category fields if changed
      const catFields: any = {}
      if (catName.trim() && catName !== category!.name) catFields.name = catName.trim()
      if (catNote !== (category!.note ?? '')) catFields.note = catNote.trim() || null
      const newGoal = goalValue === '' ? null : parsedGoal
      if (newGoal !== category!.monthlyGoal) catFields.monthlyGoal = newGoal
      if (catCurrency !== category!.currency) catFields.currency = catCurrency
      if (catColor !== (category!.color ?? '')) catFields.color = catColor || null
      if (Object.keys(catFields).length > 0) {
        await onUpdateCategory(catFields)
      }

      // Save transaction
      const inst = installmentsTotal === '' ? null : parseInt(installmentsTotal, 10)
      await onSave({
        value: parsed,
        note: note.trim() || null,
        isRecurring,
        installmentsTotal: isRecurring ? inst : null,
      })
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

  async function handleStopRecurring() {
    if (!confirm('Parar recorrência? As parcelas futuras serão removidas. A parcela atual será mantida.')) return
    setSaving(true)
    try {
      await onStopRecurring()
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md max-h-[90vh] overflow-y-auto"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex flex-col gap-1">
            <span className="text-base">{category.name}</span>
            <span className="text-xs font-normal text-muted-foreground">
              {monthLabel} / {year} • {category.currency}
              {category.note ? ` • ${category.note}` : ''}
            </span>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Edite o valor, nota, recorrência e meta desta categoria para {monthLabel} de {year}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Value */}
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
              placeholder="Toque aqui para digitar o valor..."
              className={cn(
                'text-2xl font-semibold tabular-nums h-14',
                isIncome && valid && 'text-emerald-600',
                !isIncome && !isReserve && !isReceivable && valid && 'text-rose-600',
                (isReserve || isReceivable) && valid && 'text-amber-600'
              )}
              onKeyDown={(e) => { if (e.key === 'Enter' && valid) handleSave() }}
            />
            {valid && (
              <p className="text-xs text-muted-foreground tabular-nums">
                {isIncome ? '+' : isReserve || isReceivable ? '' : '−'}
                {formatMoney(parsed, category.currency)}
                <span className="ml-1.5">
                  ≈ {category.currency === 'BRL'
                    ? formatMoney(parsed / euroRate, 'EUR')
                    : formatMoney(parsed * euroRate, 'BRL')}
                </span>
              </p>
            )}
          </div>

          {/* Note */}
          <div className="space-y-1.5">
            <Label htmlFor="tx-note">Nota (opcional)</Label>
            <Input
              id="tx-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex.: dia 11, parcela 3/8…"
              onKeyDown={(e) => { if (e.key === 'Enter' && valid) handleSave() }}
            />
          </div>

          {/* Recurrence */}
          <div className="space-y-2 rounded-lg bg-muted/40 p-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="tx-recurring" className="text-sm font-medium flex items-center gap-1.5 cursor-pointer">
                <RefreshCw className="h-3.5 w-3.5 text-cyan-600" />
                Recorrente
              </Label>
              <Switch
                id="tx-recurring"
                checked={isRecurring}
                onCheckedChange={setIsRecurring}
                disabled={editingRecurring}
              />
            </div>
            {isRecurring && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="tx-installments" className="text-xs text-muted-foreground">
                    Nº de parcelas (deixe vazio para recorrência infinita)
                  </Label>
                  <Input
                    id="tx-installments"
                    type="number"
                    min="1"
                    inputMode="numeric"
                    value={installmentsTotal}
                    onChange={(e) => setInstallmentsTotal(e.target.value)}
                    placeholder="Ex.: 48 (empréstimo 48x), 8, 12…"
                    disabled={editingRecurring}
                  />
                </div>
                {!editingRecurring && (
                  <p className="text-[10px] text-muted-foreground">
                    {(() => {
                      const n = installmentsTotal ? parseInt(installmentsTotal, 10) : 0
                      if (isNaN(n) || n <= 0) {
                        // Infinite — 120 months = 10 years
                        const endAbs = (month - 1) + 120 - 1
                        const endMonthIdx = (endAbs % 12)
                        const endYear = year + Math.floor(endAbs / 12)
                        return `Recorrência infinita • criará lançamentos de ${monthLabel}/${year} até ${MONTHS_PT_LONG[endMonthIdx]}/${endYear} (10 anos). Continue criando nova série se precisar de mais.`
                      }
                      const endAbs = (month - 1) + n - 1
                      const endMonthIdx = (endAbs % 12)
                      const endYear = year + Math.floor(endAbs / 12)
                      return `Criará ${n} lançamento${n > 1 ? 's' : ''} de ${monthLabel}/${year} até ${MONTHS_PT_LONG[endMonthIdx]}/${endYear}.`
                    })()}
                  </p>
                )}
                {editingRecurring && (
                  <p className="text-[10px] text-cyan-600 flex items-center gap-1">
                    <RefreshCw className="h-2.5 w-2.5" />
                    Este é um lançamento recorrente
                    {transaction?.installmentsTotal
                      ? ` (parcela ${transaction.installmentNumber}/${transaction.installmentsTotal})`
                      : ' (infinito)'}
                    . Edite o valor apenas desta parcela.
                  </p>
                )}
                {editingRecurring && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleStopRecurring}
                    disabled={saving}
                    className="w-full text-cyan-600 border-cyan-200 hover:bg-cyan-50"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Parar recorrência (remove parcelas futuras)
                  </Button>
                )}
              </>
            )}
          </div>

          {/* Category settings (rename + goal) */}
          <details className="rounded-lg bg-muted/30 p-3">
            <summary className="text-xs font-medium text-muted-foreground cursor-pointer">
              Editar categoria e meta
            </summary>
            <div className="space-y-3 mt-3">
              <div className="space-y-1.5">
                <Label htmlFor="cat-name" className="text-xs">Nome da categoria</Label>
                <Input
                  id="cat-name"
                  type="text"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  placeholder={category.name}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cat-note" className="text-xs">Nota da categoria</Label>
                <Input
                  id="cat-note"
                  type="text"
                  value={catNote}
                  onChange={(e) => setCatNote(e.target.value)}
                  placeholder="Ex.: vence dia 11"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cat-goal" className="text-xs">
                  Meta mensal ({catCurrency === 'BRL' ? 'R$' : '€'})
                  <span className="ml-1 text-muted-foreground">
                    {category.type === 'EXPENSE' ? '(gasto máx.)' : '(mín. desejado)'}
                  </span>
                </Label>
                <Input
                  id="cat-goal"
                  type="text"
                  inputMode="decimal"
                  value={goalValue}
                  onChange={(e) => setGoalValue(e.target.value)}
                  placeholder="Ex.: 250"
                  className={cn(!goalValid && 'border-rose-400')}
                />
                {goalExceeded && (
                  <p className="text-[10px] text-rose-600 flex items-center gap-1">
                    <AlertTriangle className="h-2.5 w-2.5" />
                    Valor ultrapassa a meta definida
                  </p>
                )}
              </div>

              {/* Currency selector */}
              <div className="space-y-1.5">
                <Label className="text-xs">Moeda da categoria</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCatCurrency('BRL')}
                    className={cn('h-9 rounded-md text-sm font-medium border-2 transition-all', catCurrency === 'BRL' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300' : 'border-border bg-muted/50 text-muted-foreground')}
                  >R$ Real</button>
                  <button
                    type="button"
                    onClick={() => setCatCurrency('EUR')}
                    className={cn('h-9 rounded-md text-sm font-medium border-2 transition-all', catCurrency === 'EUR' ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300' : 'border-border bg-muted/50 text-muted-foreground')}
                  >€ Euro</button>
                </div>
              </div>

              {/* Color picker */}
              <div className="space-y-1.5">
                <Label className="text-xs">Cor da categoria</Label>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setCatColor('')}
                    className={cn('h-7 w-7 rounded-full border-2 flex items-center justify-center text-[10px] font-bold transition-all', !catColor ? 'border-primary ring-2 ring-primary/20' : 'border-border')}
                    title="Cor padrão"
                  >A</button>
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCatColor(c)}
                      className={cn('h-7 w-7 rounded-full border-2 transition-all', catColor === c ? 'border-primary ring-2 ring-primary/20 scale-110' : 'border-transparent')}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </details>
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
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={!valid || saving || !goalValid}>
              {saving ? 'Salvando…' : 'Salvar'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
