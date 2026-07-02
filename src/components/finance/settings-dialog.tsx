'use client'

import { useState } from 'react'
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

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentUser: string
  onSetUser: (name: string) => void
  euroRate: number
  onSaveEuroRate: (v: number) => Promise<void>
}

const USERS = ['Breno', 'Kiki', 'Visita']

export function SettingsDialog({
  open,
  onOpenChange,
  currentUser,
  onSetUser,
  euroRate,
  onSaveEuroRate,
}: Props) {
  const [rate, setRate] = useState(String(euroRate))
  const [saving, setSaving] = useState(false)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Configurações</DialogTitle>
          <DialogDescription className="sr-only">
            Defina quem está usando este dispositivo e a cotação do Euro usada nos cálculos.
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

          {/* Exchange rate */}
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
                  try {
                    await onSaveEuroRate(v)
                  } finally {
                    setSaving(false)
                  }
                }}
                disabled={saving}
              >
                {saving ? 'Salvando…' : 'Salvar'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Usado para mostrar o saldo total consolidado em Reais.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
