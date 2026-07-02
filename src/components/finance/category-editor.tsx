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
  CategoryGroup,
  CategoryType,
  Currency,
} from '@/lib/finance'

interface Props {
  open: boolean
  group: CategoryGroup | null
  labels: Record<string, string>
  onOpenChange: (open: boolean) => void
  onCreate: (args: {
    name: string
    group: CategoryGroup
    type: CategoryType
    currency: Currency
    note?: string
    excludeFromTotal?: boolean
    monthlyGoal?: number | null
  }) => Promise<void>
}

export function CategoryEditor({ open, group, labels, onOpenChange, onCreate }: Props) {
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [groupVal, setGroupVal] = useState<string>('')
  const [type, setType] = useState<CategoryType>('EXPENSE')
  const [currency, setCurrency] = useState<Currency>('BRL')
  const [goal, setGoal] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!group) return
    setGroupVal(group)
    if (group === 'rendimentos.brl') { setType('INCOME'); setCurrency('BRL') }
    else if (group === 'rendimentos.eur') { setType('INCOME'); setCurrency('EUR') }
    else if (group === 'rendimentos.valores_a_receber') { setType('INCOME'); setCurrency('BRL') }
    else if (group === 'reservas') { setType('RESERVE'); setCurrency('BRL') }
    else if (group === 'despesas.contas_casa') { setType('EXPENSE'); setCurrency('EUR') }
    else { setType('EXPENSE'); setCurrency('BRL') }
  }, [group])

  useEffect(() => {
    if (open) {
      setName('')
      setNote('')
      setGoal('')
    }
  }, [open])

  // When group changes via the select, update type/currency defaults
  useEffect(() => {
    if (groupVal === 'rendimentos.brl') { setType('INCOME'); setCurrency('BRL') }
    else if (groupVal === 'rendimentos.eur') { setType('INCOME'); setCurrency('EUR') }
    else if (groupVal === 'rendimentos.valores_a_receber') { setType('INCOME'); setCurrency('BRL') }
    else if (groupVal === 'reservas') { setType('RESERVE'); setCurrency('BRL') }
    else if (groupVal === 'despesas.contas_casa') { setType('EXPENSE'); setCurrency('EUR') }
  }, [groupVal])

  if (!group) return null

  async function handleCreate() {
    if (!name.trim()) return
    setSaving(true)
    try {
      const parsedGoal = goal.trim() === '' ? null : parseFloat(goal.replace(',', '.'))
      await onCreate({
        name: name.trim(),
        group: groupVal as CategoryGroup,
        type,
        currency,
        note: note.trim() || undefined,
        excludeFromTotal: groupVal === 'rendimentos.valores_a_receber',
        monthlyGoal: parsedGoal,
      })
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  // Build select options from GROUP_STRUCTURE
  const groupOptions: { value: string; label: string }[] = []
  for (const top of GROUP_STRUCTURE) {
    const topLabel = getTopGroupLabel(top.key, labels)
    if (top.subgroups.length === 0) {
      groupOptions.push({ value: top.key, label: topLabel })
    } else {
      for (const sub of top.subgroups) {
        groupOptions.push({ value: sub.key, label: `${topLabel} › ${getGroupLabel(sub.key, labels)}` })
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova categoria</DialogTitle>
          <p className="text-xs text-muted-foreground">
            em {getGroupLabel(group, labels)}
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
              <SelectContent>
                {groupOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
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
              <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BRL">Real (R$)</SelectItem>
                  <SelectItem value="EUR">Euro (€)</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
