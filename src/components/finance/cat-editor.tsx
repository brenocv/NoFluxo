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
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import {
  GROUP_STRUCTURE,
  getTopGroupLabel,
  getGroupLabel,
  collectGroupPaths,
  CategoryGroup,
  CategoryType,
  Subgroup,
  TopGroup,
} from '@/lib/finance'
import { cn } from '@/lib/utils'
import { PREDEFINED_CURRENCIES } from '@/lib/currencies'

const PRESET_COLORS = [
  '#dc2626', '#ea580c', '#d97706', '#ca8a04', '#65a30d',
  '#16a34a', '#0891b2', '#0284c7', '#4f46e5', '#7c3aed',
  '#c026d3', '#db2777', '#e11d48', '#f97316', '#facc15',
]

interface Props {
  open: boolean
  group: CategoryGroup | null
  labels: Record<string, string>
  subgroups: Subgroup[]
  topGroups: TopGroup[]
  customCurrencies?: { code: string; rate: number }[]
  onOpenChange: (open: boolean) => void
  onCreate: (args: {
    name: string
    group: CategoryGroup
    type: CategoryType
    currency: string
    note?: string
    excludeFromTotal?: boolean
    monthlyGoal?: number | null
    color?: string | null
    value?: number | null
  }) => Promise<void>
}

export function CategoryEditor({ open, group, labels, subgroups, topGroups, customCurrencies, onOpenChange, onCreate }: Props) {
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [groupVal, setGroupVal] = useState<string>('')
  const [type, setType] = useState<CategoryType>('EXPENSE')
  const [currency, setCurrency] = useState<string>('BRL')
  const [value, setValue] = useState('')
  const [goal, setGoal] = useState('')
  const [color, setColor] = useState<string>('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!group) return
    setGroupVal(group)
    applyDefaults(group)
  }, [group])

  useEffect(() => {
    if (open) {
      setName('')
      setNote('')
      setValue('')
      setGoal('')
      setColor('')
    }
  }, [open])

  // When group changes via the select, update type/currency defaults
  useEffect(() => {
    if (groupVal) applyDefaults(groupVal)
  }, [groupVal])

  function applyDefaults(g: string) {
    if (g === 'rendimentos.brl') { setType('INCOME'); setCurrency('BRL') }
    else if (g === 'rendimentos.eur') { setType('INCOME'); setCurrency('EUR') }
    else if (g === 'rendimentos.valores_a_receber') { setType('INCOME'); setCurrency('BRL') }
    else if (g === 'reservas') { setType('RESERVE'); setCurrency('BRL') }
    else if (g === 'despesas.contas_casa') { setType('EXPENSE'); setCurrency('EUR') }
    // For user-created subgroups, inherit from parent top-level
    else if (g.startsWith('despesas')) { setType('EXPENSE'); setCurrency('BRL') }
    else if (g.startsWith('rendimentos')) { setType('INCOME'); setCurrency('BRL') }
    else if (g.startsWith('reservas')) { setType('RESERVE'); setCurrency('BRL') }
  }

  if (!group) return null

  async function handleCreate() {
    if (!name.trim()) return
    setSaving(true)
    try {
      const parsedGoal = goal.trim() === '' ? null : parseFloat(goal.replace(',', '.'))
      const parsedValue = value.trim() === '' ? null : parseFloat(value.replace(',', '.'))
      await onCreate({
        name: name.trim(),
        group: groupVal as CategoryGroup,
        type,
        currency,
        note: note.trim() || undefined,
        excludeFromTotal: groupVal === 'rendimentos.valores_a_receber',
        monthlyGoal: parsedGoal,
        value: parsedValue,
        color: color || null,
      })
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  // Build select options dynamically from the tree (including user-created subgroups at any depth)
  const groupOptions = collectGroupPaths(subgroups, labels, topGroups)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova categoria</DialogTitle>
          <p className="text-xs text-muted-foreground">
            em {getGroupLabel(group, labels, subgroups)}
          </p>
          <DialogDescription className="sr-only">
            Crie uma nova categoria com nome, nota, tipo, moeda e meta opcional.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="cat-name">Nome</Label>
            <Input
              id="cat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Nubank, Supermercado, Freela…"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cat-note">Nota (opcional)</Label>
            <Input
              id="cat-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex.: vence dia 11, débito direto…"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Grupo</Label>
            <Select value={groupVal} onValueChange={setGroupVal}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-60">
                {groupOptions.map((opt) => {
                  const parts = opt.label.split(' › ')
                  const lastPart = parts[parts.length - 1]
                  const isTopLevel = opt.depth === 0
                  const isSubgroup = opt.depth === 1
                  return (
                    <SelectItem
                      key={opt.value}
                      value={opt.value}
                      className={cn(
                        isTopLevel ? 'font-bold text-sm border-b border-border/50' : '',
                        isSubgroup ? 'text-[13px] font-medium' : '',
                        opt.depth > 1 ? 'text-xs' : ''
                      )}
                    >
                      {isTopLevel && '🔷 '}
                      {isSubgroup && '  📁 '}
                      {opt.depth > 1 && '    • '}
                      {lastPart}
                      {opt.depth > 0 && <span className="text-muted-foreground/60 ml-1 text-[10px]">({parts.slice(0, -1).join(' › ')})</span>}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={(v) => setType(v as CategoryType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EXPENSE">Despesa</SelectItem>
                  <SelectItem value="INCOME">Rendimento</SelectItem>
                  <SelectItem value="RESERVE">Reserva</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Moeda</Label>
              <Select value={currency} onValueChange={(v) => setCurrency(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BRL">Real (R$)</SelectItem>
                  <SelectItem value="EUR">Euro (€)</SelectItem>
                  {(customCurrencies ?? []).map((c) => {
                    const def = PREDEFINED_CURRENCIES.find(p => p.code === c.code)
                    return (
                      <SelectItem key={c.code} value={c.code}>{def?.flag} {def?.symbol} {def?.name}</SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cat-value">
              Valor ({currency === 'BRL' ? 'R$' : '€'})
              <span className="ml-1 text-xs text-muted-foreground">(opcional)</span>
            </Label>
            <Input
              id="cat-value"
              type="text"
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Ex.: 1500,00"
              className="text-lg font-semibold tabular-nums h-12"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cat-goal">
              Meta mensal ({currency})
              <span className="ml-1 text-xs text-muted-foreground">
                {type === 'EXPENSE' ? '(gasto máx.)' : type === 'INCOME' ? '(mín. desejado)' : '(opcional)'}
              </span>
            </Label>
            <Input
              id="cat-goal"
              type="text"
              inputMode="decimal"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Ex.: 250"
            />
          </div>

          {/* Color picker */}
          <div className="space-y-1.5">
            <Label className="text-xs">Cor (opcional)</Label>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setColor('')}
                className={cn(
                  'h-7 w-7 rounded-full border-2 flex items-center justify-center text-[10px] font-bold transition-all',
                  !color ? 'border-primary ring-2 ring-primary/20' : 'border-border'
                )}
                title="Cor padrão do grupo"
              >
                A
              </button>
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    'h-7 w-7 rounded-full border-2 transition-all',
                    color === c ? 'border-primary ring-2 ring-primary/20 scale-110' : 'border-transparent'
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={!name.trim() || saving}>
            {saving ? 'Criando…' : 'Criar categoria'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
