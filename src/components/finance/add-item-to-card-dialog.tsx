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
import { Subgroup, TopGroup, MONTHS_PT_LONG } from '@/lib/finance'
import { cn } from '@/lib/utils'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { RefreshCw, FolderPlus, Plus } from 'lucide-react'
import { PREDEFINED_CURRENCIES } from '@/lib/currencies'

type ItemType = 'EXPENSE' | 'INCOME' | 'RESERVE'

interface Props {
  open: boolean
  month: number
  year: number
  cardKey: string
  cardName: string
  cardType: ItemType
  subgroups: Subgroup[]
  labels: Record<string, string>
  customCurrencies?: { code: string; rate: number }[]
  onOpenChange: (open: boolean) => void
  onCreate: (args: {
    name: string
    value: number
    currency: string
    type: ItemType
    group: string
    note?: string
    isRecurring: boolean
    installmentsTotal?: number | null
    newSubgroupName?: string
  }) => Promise<void>
}

export function AddItemToCardDialog({
  open, month, year, cardKey, cardName, cardType,
  subgroups, labels, customCurrencies = [], onOpenChange, onCreate,
}: Props) {
  const [name, setName] = useState('')
  const [raw, setRaw] = useState('')
  const [currency, setCurrency] = useState<string>('BRL')
  const [group, setGroup] = useState<string>('__root__') // default: card root
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
      // Default currency based on card type
      const defaultCurrency = cardType === 'INCOME' && cardKey === 'rendimentos' ? 'BRL' : 'BRL'
      setCurrency(defaultCurrency)
      setGroup('__root__') // item directly on the card (no subgroup)
      setNote('')
      setIsRecurring(false)
      setInstallmentsTotal('')
      setCreateNewSubgroup(false)
      setNewSubgroupName('')
    }
  }, [open, cardKey, cardType])

  // Available subgroups inside this card (only direct children)
  const childSubgroups = subgroups
    .filter((s) => s.parentKey === cardKey)
    .sort((a, b) => a.sortOrder - b.sortOrder)

  // Available currency options: BRL + EUR + custom currencies
  const currencyOptions = [
    PREDEFINED_CURRENCIES.find(p => p.code === 'BRL')!,
    PREDEFINED_CURRENCIES.find(p => p.code === 'EUR')!,
    ...customCurrencies.map(c => PREDEFINED_CURRENCIES.find(p => p.code === c.code)!).filter(Boolean),
  ].filter(c => c && c.symbol)

  const parsed = parseFloat(raw.replace(',', '.'))
  const valid = !isNaN(parsed) && parsed >= 0 &&
    name.trim().length > 0 &&
    (!createNewSubgroup || newSubgroupName.trim().length > 0)

  const monthLabel = `${MONTHS_PT_LONG[month - 1]}/${year}`

  async function handleSave() {
    if (!valid) return
    setSaving(true)
    try {
      const inst = installmentsTotal === '' ? null : parseInt(installmentsTotal, 10)
      const finalGroup = createNewSubgroup
        ? newSubgroupName.trim() // marker: handler will create the subgroup first
        : (group === '__root__' ? cardKey : group)

      await onCreate({
        name: name.trim(),
        value: parsed,
        currency,
        type: cardType, // inherit from card
        group: finalGroup,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md max-h-[90vh] overflow-y-auto"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" />
            Novo item em {cardName}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">{monthLabel}</p>
          <DialogDescription className="sr-only">
            Crie um item com valor direto no card {cardName}. Pode ficar solto ou dentro de um subgrupo existente/novo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Nome do item */}
          <div className="space-y-1.5">
            <Label htmlFor="ai-name">Nome do item</Label>
            <Input
              id="ai-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Salário Breno, Aluguel, Mercado…"
              autoComplete="off"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter' && valid) handleSave() }}
            />
          </div>

          {/* Onde colocar? (subgrupo dentro do card, ou direto no card) */}
          <div className="space-y-1.5">
            <Label className="text-xs">Onde colocar?</Label>
            {!createNewSubgroup ? (
              <Select value={group} onValueChange={setGroup}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-60">
                  <SelectItem value="__root__" className="font-medium">
                    ⬆ Direto em {cardName} (sem subgrupo)
                  </SelectItem>
                  {childSubgroups.length > 0 && (
                    <>
                      {childSubgroups.map((sg) => (
                        <SelectItem key={sg.key} value={sg.key} className="text-xs">
                          ↳ {sg.name}
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            ) : (
              <Input
                type="text"
                value={newSubgroupName}
                onChange={(e) => setNewSubgroupName(e.target.value)}
                placeholder="Nome do novo subgrupo (ex.: Cartões BR, Extras…)"
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter' && valid) handleSave() }}
              />
            )}

            <button
              type="button"
              onClick={() => setCreateNewSubgroup(!createNewSubgroup)}
              className={cn(
                'flex items-center gap-1 text-[11px] px-2 py-1 rounded-md transition-colors touch-manipulation w-full justify-center',
                createNewSubgroup
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted border border-dashed border-border'
              )}
            >
              <FolderPlus className="h-3 w-3" />
              {createNewSubgroup ? 'Cancelar novo subgrupo' : 'Criar em novo subgrupo'}
            </button>
          </div>

          {/* Valor + Moeda */}
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="ai-value">Valor</Label>
              <Input
                id="ai-value"
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
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="h-12 w-24"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {currencyOptions.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.flag} {c.symbol}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Nota */}
          <div className="space-y-1.5">
            <Label htmlFor="ai-note" className="text-xs">Nota (opcional)</Label>
            <Input
              id="ai-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex.: dia 11, parcela 2/8…"
              onKeyDown={(e) => { if (e.key === 'Enter' && valid) handleSave() }}
            />
          </div>

          {/* Recorrência */}
          <div className="space-y-2 rounded-lg bg-muted/40 p-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="ai-recurring" className="text-sm font-medium flex items-center gap-1.5 cursor-pointer">
                <RefreshCw className="h-3.5 w-3.5 text-cyan-600" />
                Recorrente
              </Label>
              <Switch
                id="ai-recurring"
                checked={isRecurring}
                onCheckedChange={setIsRecurring}
              />
            </div>
            {isRecurring && (
              <div className="space-y-1.5">
                <Label htmlFor="ai-installments" className="text-xs text-muted-foreground">
                  Nº de parcelas (vazio = infinita)
                </Label>
                <Input
                  id="ai-installments"
                  type="number"
                  min="1"
                  inputMode="numeric"
                  value={installmentsTotal}
                  onChange={(e) => setInstallmentsTotal(e.target.value)}
                  placeholder="Ex.: 48, 12…"
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
