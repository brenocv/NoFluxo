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
import { cn } from '@/lib/utils'
import { Plus, Trash2, Coins, Star } from 'lucide-react'
import { PREDEFINED_CURRENCIES, getCurrencyDef } from '@/lib/currencies'

interface ActiveCurrency {
  code: string
  rate: number
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  euroRate: number
  onSaveEuroRate: (v: number) => Promise<void>
  currencies?: ActiveCurrency[]
  onSaveCurrencies?: (currencies: ActiveCurrency[]) => Promise<void>
  secondaryCurrency?: string
  onSaveSecondaryCurrency?: (code: string) => Promise<void>
}

export function CurrenciesDialog({
  open,
  onOpenChange,
  euroRate,
  onSaveEuroRate,
  currencies = [],
  onSaveCurrencies,
  secondaryCurrency = 'EUR',
  onSaveSecondaryCurrency,
}: Props) {
  const [saving, setSaving] = useState(false)
  // The "active" list always includes EUR (uses euroRate) + any custom currencies.
  // We display EUR as just another row in the list, not as a separate section.
  const [activeCurrencies, setActiveCurrencies] = useState<ActiveCurrency[]>(currencies)
  const [newCurrencyCode, setNewCurrencyCode] = useState('')
  const [newCurrencyRate, setNewCurrencyRate] = useState('')

  useEffect(() => {
    setActiveCurrencies(currencies)
  }, [currencies])

  // The full list of currencies to display: EUR first (always present, uses euroRate),
  // then any custom currencies the user has added.
  const displayList: ActiveCurrency[] = [
    { code: 'EUR', rate: euroRate },
    ...activeCurrencies.filter((c) => c.code !== 'EUR'),
  ]

  // Available currencies to add: all predefined except BRL (primary) and those already active.
  const availableCurrencies = PREDEFINED_CURRENCIES.filter(
    (c) => c.code !== 'BRL' && !displayList.find((d) => d.code === c.code)
  )

  // Currencies eligible to be the secondary one (shown alongside BRL).
  // EUR is always eligible. Other currencies are eligible if they're in the display list.
  const secondaryOptions = displayList.map((c) => ({
    code: c.code,
    ...getCurrencyDef(c.code)!,
  })).filter((o) => o.symbol)

  async function handleAddCurrency() {
    if (!newCurrencyCode || !newCurrencyRate) return
    const r = parseFloat(newCurrencyRate.replace(',', '.'))
    if (isNaN(r) || r <= 0) return
    const updated = [...activeCurrencies, { code: newCurrencyCode, rate: r }]
    setActiveCurrencies(updated)
    setNewCurrencyCode('')
    setNewCurrencyRate('')
    if (onSaveCurrencies) {
      setSaving(true)
      try { await onSaveCurrencies(updated) } finally { setSaving(false) }
    }
  }

  async function handleRemoveCurrency(code: string) {
    // EUR cannot be removed (it's the default secondary)
    if (code === 'EUR') return
    const updated = activeCurrencies.filter((c) => c.code !== code)
    setActiveCurrencies(updated)
    // If the removed currency was the secondary, switch back to EUR
    if (secondaryCurrency === code && onSaveSecondaryCurrency) {
      await onSaveSecondaryCurrency('EUR')
    }
    if (onSaveCurrencies) {
      setSaving(true)
      try { await onSaveCurrencies(updated) } finally { setSaving(false) }
    }
  }

  async function handleUpdateCurrencyRate(code: string, newRate: string) {
    const r = parseFloat(newRate.replace(',', '.'))
    if (isNaN(r) || r <= 0) return
    if (code === 'EUR') {
      // EUR rate is stored in config.euroToBrl
      if (onSaveEuroRate) {
        setSaving(true)
        try { await onSaveEuroRate(r) } finally { setSaving(false) }
      }
    } else {
      const updated = activeCurrencies.map((c) => c.code === code ? { ...c, rate: r } : c)
      setActiveCurrencies(updated)
      if (onSaveCurrencies) {
        setSaving(true)
        try { await onSaveCurrencies(updated) } finally { setSaving(false) }
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-primary" />
            Moedas
          </DialogTitle>
          <DialogDescription className="sr-only">
            Escolha a moeda secundária e gerencie as cotações. O Real (R$) é sempre a moeda principal.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Secondary currency selector — the one shown alongside BRL */}
          {onSaveSecondaryCurrency && (
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Star className="h-3.5 w-3.5 text-amber-500" />
                Moeda secundária
              </Label>
              <p className="text-xs text-muted-foreground">
                Aparece ao lado do Real nos valores (ex.: R$ 100 ({getCurrencyDef(secondaryCurrency)?.symbol ?? '?'} 16,67)).
              </p>
              <div className="grid grid-cols-2 gap-2">
                {secondaryOptions.map((opt) => (
                  <button
                    key={opt.code}
                    type="button"
                    onClick={async () => {
                      setSaving(true)
                      try { await onSaveSecondaryCurrency(opt.code) } finally { setSaving(false) }
                    }}
                    disabled={saving}
                    className={cn(
                      'flex items-center gap-2 h-10 px-3 rounded-md border-2 text-sm font-medium transition-all touch-manipulation',
                      secondaryCurrency === opt.code
                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300'
                        : 'border-border bg-muted/50 text-muted-foreground hover:bg-muted'
                    )}
                  >
                    <span className="text-base">{opt.flag}</span>
                    <span>{opt.symbol}</span>
                    <span className="text-xs font-normal">{opt.name}</span>
                    {secondaryCurrency === opt.code && <Star className="h-3 w-3 ml-auto fill-amber-500 text-amber-500" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Currency list — EUR + custom currencies, all in one list */}
          <div className="space-y-2 pt-4 border-t border-border">
            <Label>Cotações</Label>
            <p className="text-xs text-muted-foreground">
              O Real (R$) é a moeda principal. Todas as cotações são em relação a ele.
            </p>
            <div className="space-y-2">
              {displayList.map((c) => {
                const def = getCurrencyDef(c.code)
                const isSecondary = secondaryCurrency === c.code
                return (
                  <div
                    key={c.code}
                    className={cn(
                      'flex items-center gap-2 p-2 rounded-md',
                      isSecondary ? 'bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/30' : 'bg-muted/50'
                    )}
                  >
                    <span className="text-lg">{def?.flag ?? '💱'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium flex items-center gap-1">
                        {def?.symbol ?? c.code} {def?.name ?? c.code}
                        {isSecondary && <Star className="h-3 w-3 fill-amber-500 text-amber-500" />}
                      </div>
                      {c.code === 'EUR' && (
                        <div className="text-[10px] text-muted-foreground">Moeda padrão</div>
                      )}
                    </div>
                    <Input
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      defaultValue={String(c.rate)}
                      onBlur={(e) => handleUpdateCurrencyRate(c.code, e.target.value)}
                      className="w-24 h-8 text-xs"
                      title="Cotação em R$"
                    />
                    <span className="text-xs text-muted-foreground">R$</span>
                    {c.code !== 'EUR' && (
                      <button
                        onClick={() => handleRemoveCurrency(c.code)}
                        className="p-1 rounded hover:bg-destructive/10 hover:text-destructive"
                        title="Remover moeda"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Add currency — full predefined list (USD, CAD, GBP, DKK, HUF, CZK) */}
          {availableCurrencies.length > 0 && (
            <div className="space-y-2 pt-4 border-t border-border">
              <Label>Adicionar moeda</Label>
              <div className="flex gap-2">
                <select
                  value={newCurrencyCode}
                  onChange={(e) => setNewCurrencyCode(e.target.value)}
                  className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Escolher moeda...</option>
                  {availableCurrencies.map((c) => (
                    <option key={c.code} value={c.code}>{c.flag} {c.symbol} {c.name}</option>
                  ))}
                </select>
                <Input
                  value={newCurrencyRate}
                  onChange={(e) => setNewCurrencyRate(e.target.value)}
                  placeholder="Valor em R$"
                  inputMode="decimal"
                  className="w-28"
                  title="Cotação em Real (ex: 5.50)"
                />
                <Button onClick={handleAddCurrency} disabled={!newCurrencyCode || !newCurrencyRate || saving} size="icon">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
