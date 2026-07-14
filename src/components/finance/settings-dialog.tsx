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
import { Download } from 'lucide-react'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentUser: string
  onSetUser: (name: string) => void
  euroRate: number
  onSaveEuroRate: (v: number) => Promise<void>
  euroName: string
  onSaveEuroName: (name: string) => Promise<void>
  onExportExcel?: () => void
}

const USERS = ['Breno', 'Kiki', 'Visita']

export function SettingsDialog({
  open,
  onOpenChange,
  currentUser,
  onSetUser,
  euroRate,
  onSaveEuroRate,
  euroName,
  onSaveEuroName,
  onExportExcel,
}: Props) {
  const [rate, setRate] = useState(String(euroRate))
  const [name, setName] = useState(euroName)
  const [savingRate, setSavingRate] = useState(false)
  const [savingName, setSavingName] = useState(false)

  // Sync local state when dialog opens or props change
  useEffect(() => {
    if (open) {
      setRate(String(euroRate))
      setName(euroName)
    }
  }, [open, euroRate, euroName])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurações</DialogTitle>
          <DialogDescription className="sr-only">
            Defina quem está usando este dispositivo, o nome da moeda alternativa e a cotação usada nos cálculos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* User identity */}
          <div className="space-y-2">
            <Label>Quem está usando?</Label>
            <div className="grid grid-cols-3 gap-2">
              {USERS.map((u) => (
                <button
                  key={u}
                  onClick={() => onSetUser(u)}
                  className={cn(
                    'h-10 rounded-lg text-sm font-medium transition-all touch-manipulation',
                    currentUser === u
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  )}
                >
                  {u}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Cada dispositivo escolhe quem está usando — assim o histórico mostra quem editou o quê.
            </p>
          </div>

          {/* Euro name (editable) */}
          <div className="space-y-2">
            <Label htmlFor="euro-name">Nome da moeda alternativa</Label>
            <div className="flex gap-2">
              <Input
                id="euro-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Euro"
                className="flex-1"
                autoComplete="off"
              />
              <Button
                onClick={async () => {
                  const v = name.trim() || 'Euro'
                  setSavingName(true)
                  try {
                    await onSaveEuroName(v)
                  } finally {
                    setSavingName(false)
                  }
                }}
                disabled={savingName || (name.trim() || 'Euro') === euroName}
              >
                {savingName ? 'Salvando…' : 'Salvar'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Você pode renomear a moeda alternativa para &quot;Euro PT&quot;, &quot;Dólar&quot;, etc.
              O símbolo (€) continua o mesmo.
            </p>
          </div>

          {/* Exchange rate */}
          <div className="space-y-2">
            <Label htmlFor="rate">
              Cotação do {euroName} (em R$)
            </Label>
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
                  setSavingRate(true)
                  try {
                    await onSaveEuroRate(v)
                  } finally {
                    setSavingRate(false)
                  }
                }}
                disabled={savingRate}
              >
                {savingRate ? 'Salvando…' : 'Salvar'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Usado para mostrar o saldo total consolidado em Reais.
            </p>
          </div>

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
              <p className="text-xs text-muted-foreground">
                Gera um arquivo .xlsx com todas as categorias e valores do ano.
              </p>
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
