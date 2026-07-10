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
import { Category, Currency, collectGroupPaths, Subgroup, TopGroup, MONTHS_PT_LONG } from '@/lib/finance'
import { cn } from '@/lib/utils'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Zap, RefreshCw, TrendingDown, TrendingUp, PiggyBank, FolderPlus } from 'lucide-react'

type QuickType = 'EXPENSE' | 'INCOME' | 'RESERVE'

interface Props {
  open: boolean
  month: number
  year: number
  categories: Category[]
  subgroups: Subgroup[]
  topGroups: TopGroup[]
  labels: Record<string, string>
  initialGroup?: string
  onOpenChange: (open: boolean) => void
  onCreate: (args: {
    name: string
    value: number
    currency: Currency
    type: QuickType
    group: string
    note?: string
    isRecurring: boolean
    installmentsTotal?: number | null
    newSubgroupName?: string
  }) => Promise<void>
}

const TYPE_OPTIONS: { value: QuickType; label: string; icon: typeof TrendingDown; color: string }[] = [
  { value: 'EXPENSE', label: 'Despesa', icon: TrendingDown, color: '#dc2626' },
  { value: 'INCOME', label: 'Rendimento', icon: TrendingUp, color: '#16a34a' },
  { value: 'RESERVE', label: 'Reserva', icon: PiggyBank, color: '#d97706' },
]

export function QuickAddDialog({
  open, month, year, categories, subgroups, topGroups, labels, initialGroup, onOpenChange, onCreate,
}: Props) {
  const [name, setName] = useState('')
  const [raw, setRaw] = useState('')
  const [currency, setCurrency] = useState<Currency>('BRL')
  const [type, setType] = useState<QuickType>('EXPENSE')
  const [group, setGroup] = useState<string>('')
  const [note, setNote] = useState('')
  const [isRecurring, setIsRecurring] = useState(false)
  const [installmentsTotal, setInstallmentsTotal] = useState('')
  const [saving, setSaving] = useState(false)
  const [createNewSubgroup, setCreateNewSubgroup] = useState(false)
  const [newSubgroupName, setNewSubgroupName] = useState('')

  useEffect(() => {
    if (open) {
      setName('')
      setRaw('')
      setCurrency('BRL')
      setType('EXPENSE')
      setGroup(initialGroup || '')
      setNote('')
      setIsRecurring(false)
      setInstallmentsTotal('')
      setCreateNewSubgroup(false)
      setNewSubgroupName('')
    }
  }, [open, initialGroup])

  const groupOptions = collectGroupPaths(subgroups, labels, topGroups)
  const parsed = parseFloat(raw.replace(',', '.'))
  const valid = !isNaN(parsed) && parsed >= 0 && name.trim().length > 0 &&
    (!createNewSubgroup || newSubgroupName.trim().length > 0)

  // Default group based on type (only if no initialGroup and no manual selection)
  useEffect(() => {
    if (open && !group && !initialGroup) {
      if (type === 'EXPENSE') {
        const opt = groupOptions.find((g) => g.value === 'despesas.cartoes') || groupOptions.find((g) => g.depth === 1 && g.value.startsWith('despesas'))
        if (opt) setGroup(opt.value)
      } else if (type === 'INCOME') {
        const opt = groupOptions.find((g) => g.value === 'rendimentos.brl') || groupOptions.find((g) => g.depth === 1 && g.value.startsWith('rendimentos'))
        if (opt) setGroup(opt.value)
      } else if (type === 'RESERVE') {
        const opt = groupOptions.find((g) => g.value === 'reservas')
        if (opt) setGroup(opt.value)
      }
    }
  }, [open, type])

  async function handleSave() {
    if (!valid) return
    setSaving(true)
    try {
      const inst = installmentsTotal === '' ? null : parseInt(installmentsTotal, 10)
      await onCreate({
        name: name.trim(),
        value: parsed,
        currency,
        type,
        group: group || (type === 'EXPENSE' ? 'despesas.cartoes' : type === 'INCOME' ? 'rendimentos.brl' : 'reservas'),
        note: note.trim() || undefined,
        isRecurring,
        installmentsTotal: isRecurring ? inst : null,
        newSubgroupName: createNewSubgroup ? newSubgroupName.trim() : undefined,
      })
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  const monthLabel = `${MONTHS_PT_LONG[month - 1]}/${year}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            Adicionar valor rápido
          </DialogTitle>
          <p className="text-xs text-muted-foreground">{monthLabel}</p>
          <DialogDescription className="sr-only">
            Crie uma categoria e um valor rapidamente. Escolha o tipo (despesa, rendimento ou reserva), a moeda e o grupo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Type selector */}
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo</Label>
            <div className="grid grid-cols-3 gap-2">
              {TYPE_OPTIONS.map((opt) => {
                const Icon = opt.icon
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setType(opt.value)}
                    className={cn(
                      'flex flex-col items-center gap-1 p-2.5 rounded-lg border-2 transition-all touch-manipulation',
                      type === opt.value
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-muted/50 text-muted-foreground'
                    )}
                    style={type === opt.value ? { borderColor: opt.color, color: opt.color } : undefined}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-[11px] font-medium">{opt.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="qa-name">Nome</Label>
            <Input
              id="qa-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Salário Breno, Almoço, Mercado..."
              autoComplete="off"
              onKeyDown={(e) => { if (e.key === 'Enter' && valid) handleSave() }}
            />
          </div>

          {/* Value + Currency */}
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="qa-value">Valor</Label>
              <Input
                id="qa-value"
                type="text"
                inputMode="decimal"
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                placeholder="0,00"
                autoComplete="off"
                className="text-xl font-semibold tabular-nums h-12"
                onKeyDown={(e) => { if (e.key === 'Enter' && valid) handleSave() }}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Moeda</Label>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setCurrency('BRL')}
                  className={cn('h-12 px-3 rounded-md text-sm font-bold border-2 transition-all', currency === 'BRL' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300' : 'border-border bg-muted/50 text-muted-foreground')}
                >R$</button>
                <button
                  type="button"
                  onClick={() => setCurrency('EUR')}
                  className={cn('h-12 px-3 rounded-md text-sm font-bold border-2 transition-all', currency === 'EUR' ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300' : 'border-border bg-muted/50 text-muted-foreground')}
                >€</button>
              </div>
            </div>
          </div>

          {/* Group selector */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Grupo (opcional)</Label>
              <button
                type="button"
                onClick={() => setCreateNewSubgroup(!createNewSubgroup)}
                className={cn(
                  'flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md transition-colors touch-manipulation',
                  createNewSubgroup
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                )}
              >
                <FolderPlus className="h-3 w-3" />
                {createNewSubgroup ? 'Cancelando novo subgrupo' : 'Novo subgrupo'}
              </button>
            </div>
            {!createNewSubgroup ? (
              <Select value={group} onValueChange={setGroup}>
                <SelectTrigger><SelectValue placeholder="Selecionar grupo..." /></SelectTrigger>
                <SelectContent className="max-h-60">
                  {groupOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className={opt.depth > 0 ? 'text-xs' : 'font-medium'}>
                      {opt.depth > 0 ? '  '.repeat(opt.depth) + '↳ ' : ''}{opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="space-y-2">
                <Input
                  type="text"
                  value={newSubgroupName}
                  onChange={(e) => setNewSubgroupName(e.target.value)}
                  placeholder="Nome do novo subgrupo (ex.: Mercado, Extras...)"
                  onKeyDown={(e) => { if (e.key === 'Enter' && valid) handleSave() }}
                />
                <Select value={group} onValueChange={setGroup}>
                  <SelectTrigger><SelectValue placeholder="Dentro de qual grupo pai?" /></SelectTrigger>
                  <SelectContent className="max-h-60">
                    {groupOptions.filter((opt) => opt.depth === 0).map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="font-medium">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  O novo subgrupo será criado dentro do grupo pai selecionado, e a categoria será adicionada nele.
                </p>
              </div>
            )}
          </div>

          {/* Note */}
          <div className="space-y-1.5">
            <Label htmlFor="qa-note" className="text-xs">Nota (opcional)</Label>
            <Input
              id="qa-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex.: dia 11, parcela 2/8..."
              onKeyDown={(e) => { if (e.key === 'Enter' && valid) handleSave() }}
            />
          </div>

          {/* Recurrence */}
          <div className="space-y-2 rounded-lg bg-muted/40 p-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="qa-recurring" className="text-sm font-medium flex items-center gap-1.5 cursor-pointer">
                <RefreshCw className="h-3.5 w-3.5 text-cyan-600" />
                Recorrente
              </Label>
              <Switch
                id="qa-recurring"
                checked={isRecurring}
                onCheckedChange={setIsRecurring}
              />
            </div>
            {isRecurring && (
              <div className="space-y-1.5">
                <Label htmlFor="qa-installments" className="text-xs text-muted-foreground">
                  Nº de parcelas (vazio = infinita)
                </Label>
                <Input
                  id="qa-installments"
                  type="number"
                  min="1"
                  inputMode="numeric"
                  value={installmentsTotal}
                  onChange={(e) => setInstallmentsTotal(e.target.value)}
                  placeholder="Ex.: 48, 12..."
                />
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!valid || saving}>
            {saving ? 'Salvando…' : 'Adicionar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
