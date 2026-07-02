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
import { GROUP_LABELS, CategoryGroup, CategoryType, Currency } from '@/lib/finance'

interface Props {
  open: boolean
  group: CategoryGroup | null
  onOpenChange: (open: boolean) => void
  onCreate: (args: {
    name: string
    group: CategoryGroup
    type: CategoryType
    currency: Currency
    note?: string
  }) => Promise<void>
}

export function CategoryEditor({ open, group, onOpenChange, onCreate }: Props) {
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [type, setType] = useState<CategoryType>('EXPENSE')
  const [currency, setCurrency] = useState<Currency>('BRL')
  const [saving, setSaving] = useState(false)

  // Sensible defaults based on the group
  useEffect(() => {
    if (!group) return
    if (group === 'rendimentos_brl') {
      setType('INCOME'); setCurrency('BRL')
    } else if (group === 'rendimentos_eur') {
      setType('INCOME'); setCurrency('EUR')
    } else if (group === 'valores_a_receber') {
      setType('INCOME'); setCurrency('BRL')
    } else if (group === 'reservas') {
      setType('RESERVE'); setCurrency('BRL')
    } else if (group === 'contas_casa') {
      setType('EXPENSE'); setCurrency('EUR')
    } else {
      setType('EXPENSE'); setCurrency('BRL')
    }
  }, [group])

  // Reset name/note when opening
  useEffect(() => {
    if (open) {
      setName('')
      setNote('')
    }
  }, [open])

  if (!group) return null

  async function handleCreate() {
    if (!name.trim()) return
    setSaving(true)
    try {
      await onCreate({
        name: name.trim(),
        group,
        type,
        currency,
        note: note.trim() || undefined,
        // Categorias criadas no grupo "valores_a_receber" são automaticamente
        // marcadas como excludeFromTotal para não inflar o saldo do mês.
        excludeFromTotal: group === 'valores_a_receber',
      })
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova categoria</DialogTitle>
          <p className="text-xs text-muted-foreground">
            em {GROUP_LABELS[group]}
          </p>
          <DialogDescription className="sr-only">
            Crie uma nova categoria em {GROUP_LABELS[group]} com nome, nota, tipo e moeda.
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

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as CategoryType)}
              >
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
              <Select
                value={currency}
                onValueChange={(v) => setCurrency(v as Currency)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BRL">Real (R$)</SelectItem>
                  <SelectItem value="EUR">Euro (€)</SelectItem>
                </SelectContent>
              </Select>
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
