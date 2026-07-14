'use client'

import { useState, useEffect } from 'react'
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
import { Download, Plus, Trash2, Upload, LogOut } from 'lucide-react'
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
  onExportExcel?: () => void
  currencies?: ActiveCurrency[]
  onSaveCurrencies?: (currencies: ActiveCurrency[]) => Promise<void>
  onDeleteAccount?: () => void
  onLogout?: () => void
  onBackup?: () => void
  onRestore?: () => void
  onResetValues?: () => void
  accountName?: string
}

export function SettingsDialog({
  open,
  onOpenChange,
  euroRate,
  onSaveEuroRate,
  onExportExcel,
  currencies = [],
  onSaveCurrencies,
  onDeleteAccount,
  onLogout,
  onBackup,
  onRestore,
  onResetValues,
  accountName,
}: Props) {
  const [rate, setRate] = useState(String(euroRate))
  const [saving, setSaving] = useState(false)
  const [activeCurrencies, setActiveCurrencies] = useState<ActiveCurrency[]>(currencies)
  const [newCurrencyCode, setNewCurrencyCode] = useState('')
  const [newCurrencyRate, setNewCurrencyRate] = useState('')

  useEffect(() => {
    setActiveCurrencies(currencies)
  }, [currencies])

  // Available currencies = predefined minus already active
  const availableCurrencies = PREDEFINED_CURRENCIES.filter(c => 
    !activeCurrencies.find(a => a.code === c.code) && c.code !== 'BRL' // BRL is always main, don't add
  )

  async function handleAddCurrency() {
    if (!newCurrencyCode || !newCurrencyRate) return
    const rate = parseFloat(newCurrencyRate.replace(',', '.'))
    if (isNaN(rate) || rate <= 0) return
    const updated = [...activeCurrencies, { code: newCurrencyCode, rate }]
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
    const rate = parseFloat(newRate.replace(',', '.'))
    if (isNaN(rate) || rate <= 0) return
    const updated = activeCurrencies.map(c => c.code === code ? { ...c, rate } : c)
    setActiveCurrencies(updated)
    if (onSaveCurrencies) {
      setSaving(true)
      try { await onSaveCurrencies(updated) } finally { setSaving(false) }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Configurações</DialogTitle>
          <DialogDescription className="sr-only">
            Defina cotações de moedas e gerencie a planilha.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Exchange rate (Euro) */}
          <div className="space-y-2">
            <Label htmlFor="rate">Cotação do Euro (em R$)</Label>
            <div className="flex gap-2">
              <Input
                id="rate"
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
          </div>

          {/* Custom currencies (from predefined list) */}
          {onSaveCurrencies && (
            <div className="space-y-3">
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

              {/* Add from predefined list */}
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

          {/* Excel export */}
          {onExportExcel && (
            <div className="space-y-2">
              <Label>Exportar planilha</Label>
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => { onExportExcel(); onOpenChange(false) }}
              >
                <Download className="h-4 w-4" />
                Exportar Excel do ano atual
              </Button>
            </div>
          )}

          {/* Backup / Restore / Reset */}
          <div className="space-y-2 pt-4 border-t border-border">
            <Label>Dados da planilha</Label>
            {onBackup && (
              <Button variant="outline" className="w-full justify-start gap-2" onClick={() => { onBackup(); onOpenChange(false) }}>
                <Download className="h-4 w-4" /> Exportar backup (JSON)
              </Button>
            )}
            {onRestore && (
              <Button variant="outline" className="w-full justify-start gap-2" onClick={() => { onRestore(); onOpenChange(false) }}>
                <Upload className="h-4 w-4" /> Restaurar backup
              </Button>
            )}
            {onResetValues && (
              <Button variant="outline" className="w-full justify-start gap-2 text-rose-500 border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-950/30" onClick={() => { onResetValues(); onOpenChange(false) }}>
                <Trash2 className="h-4 w-4" /> Zerar valores da planilha
              </Button>
            )}
          </div>

          {/* Logout */}
          {onLogout && (
            <div className="space-y-2 pt-4 border-t border-border">
              <Button variant="outline" className="w-full justify-start gap-2" onClick={() => { onLogout(); onOpenChange(false) }}>
                <LogOut className="h-4 w-4" /> Sair da conta
              </Button>
            </div>
          )}

          {/* Delete account */}
          {onDeleteAccount && (
            <div className="space-y-2 pt-4 border-t border-border">
              <Label>Conta: {accountName}</Label>
              <Button
                variant="outline"
                className="w-full justify-start gap-2 text-rose-500 border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                onClick={() => {
                  if (confirm(`Apagar a conta "${accountName}" e todos os seus dados? Esta ação não pode ser desfeita.`)) {
                    onDeleteAccount()
                  }
                }}
              >
                <Trash2 className="h-4 w-4" />
                Apagar esta conta
              </Button>
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
