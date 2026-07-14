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
import { Plus, Trash2, Coins } from 'lucide-react'
import { PREDEFINED_CURRENCIES } from '@/lib/currencies'

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
}

export function CurrenciesDialog({
  open,
  onOpenChange,
  euroRate,
  onSaveEuroRate,
  currencies = [],
  onSaveCurrencies,
}: Props) {
  const [rate, setRate] = useState(String(euroRate))
  const [saving, setSaving] = useState(false)
  const [activeCurrencies, setActiveCurrencies] = useState<ActiveCurrency[]>(currencies)
  const [newCurrencyCode, setNewCurrencyCode] = useState('')
  const [newCurrencyRate, setNewCurrencyRate] = useState('')

  useEffect(() => {
    setActiveCurrencies(currencies)
  }, [currencies])

  useEffect(() => {
    if (open) setRate(String(euroRate))
  }, [open, euroRate])

  const availableCurrencies = PREDEFINED_CURRENCIES.filter(c =>
    !activeCurrencies.find(a => a.code === c.code) && c.code !== 'BRL' && c.code !== 'EUR'
  )

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
    const updated = activeCurrencies.filter(c => c.code !== code)
    setActiveCurrencies(updated)
    if (onSaveCurrencies) {
      setSaving(true)
      try { await onSaveCurrencies(updated) } finally { setSaving(false) }
    }
  }

  async function handleUpdateCurrencyRate(code: string, newRate: string) {
    const r = parseFloat(newRate.replace(',', '.'))
    if (isNaN(r) || r <= 0) return
    const updated = activeCurrencies.map(c => c.code === code ? { ...c, rate: r } : c)
    setActiveCurrencies(updated)
    if (onSaveCurrencies) {
      setSaving(true)
      try { await onSaveCurrencies(updated) } finally { setSaving(false) }
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
            Defina a cotação do Euro e de outras moedas usadas nos cálculos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Euro rate — always present */}
          <div className="space-y-2">
            <Label htmlFor="euro-rate">
              🇪🇺 Euro (€) — cotação em R$
            </Label>
            <div className="flex gap-2">
              <Input
                id="euro-rate"
                type="number"
                step="0.01"
                inputMode="decimal"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                className="flex-1"
              />
              <Button
                onClick={async () => {
                  const v = parseFloat(rate.replace(',', '.'))
                  if (isNaN(v) || v <= 0) return
                  setSaving(true)
                  try { await onSaveEuroRate(v) } finally { setSaving(false) }
                }}
                disabled={saving}
              >
                {saving ? 'Salvando…' : 'Salvar'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              O Real (R$) é a moeda principal. Todas as outras cotações são em relação a ele.
            </p>
          </div>

          {/* Other currencies */}
          {onSaveCurrencies && (
            <div className="space-y-3 pt-4 border-t border-border">
              <Label>Outras moedas</Label>
              <p className="text-xs text-muted-foreground">
                Escolha moedas da lista. A cotação é em relação ao Real (R$).
              </p>

              {activeCurrencies.length > 0 && (
                <div className="space-y-2">
                  {activeCurrencies.map((c) => {
                    const def = PREDEFINED_CURRENCIES.find(p => p.code === c.code)
                    return (
                      <div key={c.code} className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
                        <span className="text-lg">{def?.flag}</span>
                        <span className="text-sm font-medium flex-1">{def?.symbol} {def?.name}</span>
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
                        <button
                          onClick={() => handleRemoveCurrency(c.code)}
                          className="p-1 rounded hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              {availableCurrencies.length > 0 && (
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
                  <Button onClick={handleAddCurrency} disabled={!newCurrencyCode || !newCurrencyRate} size="icon">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              )}
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
