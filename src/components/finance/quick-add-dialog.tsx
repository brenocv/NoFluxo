'use client'

import { useEffect, useMemo, useState } from 'react'
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
import {
  Category, collectAllPaths, Subgroup, TopGroup, MONTHS_PT_LONG, getTopGroup,
} from '@/lib/finance'
import { cn } from '@/lib/utils'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Zap, RefreshCw, FolderPlus, TrendingDown, TrendingUp, PiggyBank, Coins } from 'lucide-react'
import { PREDEFINED_CURRENCIES } from '@/lib/currencies'

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
  customCurrencies?: { code: string; rate: number }[]
  onOpenChange: (open: boolean) => void
  onCreate: (args: {
    name: string
    value: number
    currency: string
    type: QuickType
    group: string
    note?: string
    isRecurring: boolean
    installmentsTotal?: number | null
    newSubgroupName?: string
    existingCategoryId?: string
  }) => Promise<void>
}

// Map a topGroup key → its type. Used to derive the Tipo from the "Onde adicionar?" selection.
function deriveTypeFromGroup(group: string, topGroups: TopGroup[]): QuickType {
  const topKey = getTopGroup(group)
  const tg = topGroups.find((t) => t.key === topKey)
  if (tg) {
    if (tg.type === 'INCOME') return 'INCOME'
    if (tg.type === 'RESERVE') return 'RESERVE'
    return 'EXPENSE'
  }
  // Fallback to known default keys
  if (topKey === 'rendimentos') return 'INCOME'
  if (topKey === 'reservas') return 'RESERVE'
  return 'EXPENSE'
}

const TYPE_ICON: Record<QuickType, typeof TrendingDown> = {
  EXPENSE: TrendingDown,
  INCOME: TrendingUp,
  RESERVE: PiggyBank,
}

const TYPE_LABEL: Record<QuickType, string> = {
  EXPENSE: 'Despesa',
  INCOME: 'Rendimento',
  RESERVE: 'Reserva',
}

const TYPE_COLOR: Record<QuickType, string> = {
  EXPENSE: '#dc2626',
  INCOME: '#16a34a',
  RESERVE: '#d97706',
}

export function QuickAddDialog({
  open, month, year, categories, subgroups, topGroups, labels, initialGroup, customCurrencies, onOpenChange, onCreate,
}: Props) {
  const [name, setName] = useState('')
  const [raw, setRaw] = useState('')
  const [currency, setCurrency] = useState<string>('BRL')
  const [group, setGroup] = useState<string>('')
  const [note, setNote] = useState('')
  const [isRecurring, setIsRecurring] = useState(false)
  const [installmentsTotal, setInstallmentsTotal] = useState('')
  const [saving, setSaving] = useState(false)
  const [createNewSubgroup, setCreateNewSubgroup] = useState(false)
  const [newSubgroupName, setNewSubgroupName] = useState('')

  const groupOptions = useMemo(
    () => collectAllPaths(subgroups, labels, topGroups, categories),
    [subgroups, labels, topGroups, categories]
  )

  // When the dialog opens, pick a sensible default group:
  // - If initialGroup is given (e.g., user clicked "+" on a card), use it.
  // - Otherwise, pick the first subgroup of the first EXPENSE card.
  useEffect(() => {
    if (open) {
      setName('')
      setRaw('')
      setCurrency('BRL')
      setNote('')
      setIsRecurring(false)
      setInstallmentsTotal('')
      setCreateNewSubgroup(false)
      setNewSubgroupName('')

      let startGroup = initialGroup || ''
      if (!startGroup) {
        // Default: first subgroup inside the first EXPENSE topGroup
        const firstExpense = topGroups.find((t) => t.type === 'EXPENSE')
        if (firstExpense) {
          const firstSub = subgroups
            .filter((s) => s.parentKey === firstExpense.key)
            .sort((a, b) => a.sortOrder - b.sortOrder)[0]
          startGroup = firstSub?.key ?? firstExpense.key
        } else if (groupOptions.length > 0) {
          // Fallback: first available option that's not a category
          const firstNonCat = groupOptions.find((o) => !o.value.startsWith('cat:'))
          startGroup = firstNonCat?.value ?? ''
        }
      }
      setGroup(startGroup)
    }
  }, [open, initialGroup, topGroups, subgroups, groupOptions])

  // Derive the type from the selected group's parent card
  const isExistingCategory = group.startsWith('cat:')
  const type: QuickType = useMemo(() => {
    if (isExistingCategory) {
      // Use the existing category's type
      const catId = group.slice(4)
      const cat = categories.find((c) => c.id === catId)
      if (cat) return cat.type as QuickType
    }
    return deriveTypeFromGroup(group, topGroups)
  }, [group, isExistingCategory, categories, topGroups])

  const parsed = parseFloat(raw.replace(',', '.'))
  const valid = !isNaN(parsed) && parsed >= 0 &&
    group.length > 0 &&
    (isExistingCategory || name.trim().length > 0) &&
    (!createNewSubgroup || newSubgroupName.trim().length > 0)

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
        // Use the selected group (or its parent if creating a new subgroup)
        group: createNewSubgroup ? group : group,
        note: note.trim() || undefined,
        isRecurring,
        installmentsTotal: isRecurring ? inst : null,
        newSubgroupName: createNewSubgroup ? newSubgroupName.trim() : undefined,
        existingCategoryId: isExistingCategory ? group.slice(4) : undefined,
      })
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  const monthLabel = `${MONTHS_PT_LONG[month - 1]}/${year}`
  const TypeIcon = TYPE_ICON[type]
  const typeColor = TYPE_COLOR[type]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md max-h-[90dvh] overflow-y-auto"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            Adicionar valor rápido
          </DialogTitle>
          <p className="text-xs text-muted-foreground">{monthLabel}</p>
          <DialogDescription className="sr-only">
            Adicione um valor a um item existente ou crie um novo. O tipo é determinado automaticamente pelo card onde você adiciona.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Group/item selector — shows ALL levels with visual distinction */}
          <div className="space-y-1.5">
            <Label className="text-xs">Onde adicionar?</Label>
            <Select value={group} onValueChange={setGroup}>
              <SelectTrigger><SelectValue placeholder="Selecionar grupo ou item existente..." /></SelectTrigger>
              <SelectContent className="max-h-60">
                {groupOptions.map((opt) => {
                  const parts = opt.label.split(' › ')
                  const lastPart = parts[parts.length - 1]
                  const isTopLevel = opt.depth === 0
                  const isSubgroup = opt.depth === 1
                  const isCategory = opt.value.startsWith('cat:')
                  return (
                    <SelectItem
                      key={opt.value}
                      value={opt.value}
                      className={cn(
                        isTopLevel ? 'font-bold text-sm border-b border-border/50' : '',
                        isSubgroup ? 'text-[13px] font-medium' : '',
                        isCategory ? 'text-[13px] text-foreground' : '',
                        opt.depth > 1 ? 'text-xs' : ''
                      )}
                    >
                      {isTopLevel && '🔷 '}
                      {isSubgroup && '  📁 '}
                      {isCategory && '  '.repeat(Math.min(opt.depth, 3)) + '• '}
                      {lastPart}
                      {opt.depth > 0 && <span className="text-muted-foreground/60 ml-1 text-[10px]">({parts.slice(0, -1).join(' › ')})</span>}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
            {isExistingCategory && (
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
                ✓ Adicionando valor a um item existente
              </p>
            )}
          </div>

          {/* Type indicator (read-only — derived from the selected card) */}
          {!createNewSubgroup && (
            <div
              className="flex items-center gap-2 p-2.5 rounded-lg border-2 text-sm font-medium"
              style={{ borderColor: typeColor, color: typeColor, backgroundColor: typeColor + '0d' }}
            >
              <TypeIcon className="h-4 w-4" />
              <span>Tipo: {TYPE_LABEL[type]}</span>
              <span className="text-xs text-muted-foreground ml-auto">
                {isExistingCategory ? '(da categoria existente)' : '(do card selecionado)'}
              </span>
            </div>
          )}

          {/* Name — hidden when existing category or creating new subgroup */}
          {!isExistingCategory && !createNewSubgroup && (
            <div className="space-y-1.5">
              <Label htmlFor="qa-name">Nome do novo item</Label>
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
          )}

          {/* Value + Currency — currency hidden when existing category (uses its currency) */}
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
              <div className="flex gap-1 flex-wrap">
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
                {(customCurrencies ?? []).map((c) => {
                  const def = PREDEFINED_CURRENCIES.find(p => p.code === c.code)
                  return (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => setCurrency(c.code)}
                      className={cn('h-12 px-3 rounded-md text-xs font-bold border-2 transition-all', currency === c.code ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300' : 'border-border bg-muted/50 text-muted-foreground')}
                    >{def?.symbol ?? c.code}</button>
                  )
                })}
              </div>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground leading-snug -mt-2">
            Quer outra moeda? Toque no ícone <Coins className="h-3 w-3 inline align-text-bottom" /> no topo da tela para adicionar.
          </p>

          {/* New subgroup toggle — only when not selecting existing category */}
          {!isExistingCategory && (
            <div className="space-y-1.5">
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
              {createNewSubgroup && (
                <div className="space-y-2">
                  <Input
                    type="text"
                    value={newSubgroupName}
                    onChange={(e) => setNewSubgroupName(e.target.value)}
                    placeholder="Nome do novo subgrupo (ex.: Mercado, Extras...)"
                    onKeyDown={(e) => { if (e.key === 'Enter' && valid) handleSave() }}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    O novo subgrupo será criado dentro do card selecionado em &quot;Onde adicionar?&quot; acima.
                  </p>
                </div>
              )}
            </div>
          )}

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
