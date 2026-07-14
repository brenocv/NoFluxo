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
import { Download, Trash2, Upload, LogOut } from 'lucide-react'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  euroRate: number
  secondaryCurrencyName?: string
  secondaryCurrencySymbol?: string
  onSaveEuroRate: (v: number) => Promise<void>
  onSaveSecondaryCurrency?: (name: string, symbol: string) => Promise<void>
  onExportExcel?: () => void
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
  secondaryCurrencyName = 'Euro',
  secondaryCurrencySymbol = '€',
  onSaveEuroRate,
  onSaveSecondaryCurrency,
  onExportExcel,
  onDeleteAccount,
  onLogout,
  onBackup,
  onRestore,
  onResetValues,
  accountName,
}: Props) {
  const [rate, setRate] = useState(String(euroRate))
  const [currencyName, setCurrencyName] = useState(secondaryCurrencyName)
  const [currencySymbol, setCurrencySymbol] = useState(secondaryCurrencySymbol)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setRate(String(euroRate))
    setCurrencyName(secondaryCurrencyName)
    setCurrencySymbol(secondaryCurrencySymbol)
  }, [euroRate, secondaryCurrencyName, secondaryCurrencySymbol])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Configurações</DialogTitle>
          <DialogDescription className="sr-only">
            Defina a moeda secundária e gerencie a planilha.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Secondary currency */}
          <div className="space-y-3">
            <Label>Moeda secundária</Label>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Nome</label>
                <Input
                  value={currencyName}
                  onChange={(e) => setCurrencyName(e.target.value)}
                  placeholder="Euro, Dólar..."
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Símbolo</label>
                <Input
                  value={currencySymbol}
                  onChange={(e) => setCurrencySymbol(e.target.value)}
                  placeholder="€, $, £..."
                  className="w-20"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Cotação (em R$)</label>
              <div className="flex gap-2">
                <Input
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
                    try {
                      await onSaveEuroRate(v)
                      if (onSaveSecondaryCurrency) {
                        await onSaveSecondaryCurrency(currencyName.trim() || 'Euro', currencySymbol.trim() || '€')
                      }
                    } finally { setSaving(false) }
                  }}
                  disabled={saving}
                >
                  {saving ? 'Salvando…' : 'Salvar'}
                </Button>
              </div>
            </div>
          </div>

          {/* Excel export */}
          {onExportExcel && (
            <div className="space-y-2 pt-4 border-t border-border">
              <Label>Exportar</Label>
              <Button variant="outline" className="w-full justify-start gap-2" onClick={() => { onExportExcel(); onOpenChange(false) }}>
                <Download className="h-4 w-4" /> Exportar Excel
              </Button>
            </div>
          )}

          {/* Backup / Restore / Reset */}
          <div className="space-y-2 pt-4 border-t border-border">
            <Label>Dados da planilha</Label>
            {onBackup && (
              <Button variant="outline" className="w-full justify-start gap-2" onClick={() => { onBackup(); onOpenChange(false) }}>
                <Download className="h-4 w-4" /> Backup (JSON)
              </Button>
            )}
            {onRestore && (
              <Button variant="outline" className="w-full justify-start gap-2" onClick={() => { onRestore(); onOpenChange(false) }}>
                <Upload className="h-4 w-4" /> Restaurar backup
              </Button>
            )}
            {onResetValues && (
              <Button variant="outline" className="w-full justify-start gap-2 text-rose-500 border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-950/30" onClick={() => { onResetValues(); onOpenChange(false) }}>
                <Trash2 className="h-4 w-4" /> Zerar valores
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
                  if (confirm(`Apagar a conta "${accountName}" e todos os dados?`)) {
                    onDeleteAccount()
                  }
                }}
              >
                <Trash2 className="h-4 w-4" /> Apagar esta conta
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
