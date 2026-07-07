'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { Plus } from 'lucide-react'

const CARD_COLORS = [
  '#dc2626', '#ea580c', '#d97706', '#ca8a04', '#65a30d',
  '#16a34a', '#0891b2', '#0284c7', '#4f46e5', '#7c3aed',
  '#c026d3', '#db2777', '#64748b', '#0f172a',
]

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (name: string, type: string, color: string) => Promise<void>
}

export function NewCardDialog({ open, onOpenChange, onCreate }: Props) {
  const [name, setName] = useState('')
  const [type, setType] = useState('EXPENSE')
  const [color, setColor] = useState('#64748b')
  const [saving, setSaving] = useState(false)

  async function handleCreate() {
    if (!name.trim()) return
    setSaving(true)
    try {
      await onCreate(name.trim(), type, color)
      setName('')
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> Novo card
          </DialogTitle>
          <DialogDescription className="sr-only">
            Crie um novo card (grupo principal) com nome, tipo e cor.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="card-name">Nome do card</Label>
            <Input id="card-name" value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Investimentos, Viagens, Projetos..." autoFocus onKeyDown={e => e.key === 'Enter' && handleCreate()} />
          </div>

          {/* Type selector */}
          <div className="space-y-1.5">
            <Label>Tipo (onde os valores aparecem)</Label>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => { setType('EXPENSE'); setColor('#dc2626') }} className={cn('p-2.5 rounded-lg border-2 text-center transition-all touch-manipulation', type === 'EXPENSE' ? 'border-rose-400 bg-rose-50 dark:bg-rose-950/30' : 'border-border bg-muted/50')}>
                <div className="text-xs font-semibold text-rose-600">Saídas</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">despesas</div>
              </button>
              <button onClick={() => { setType('INCOME'); setColor('#16a34a') }} className={cn('p-2.5 rounded-lg border-2 text-center transition-all touch-manipulation', type === 'INCOME' ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30' : 'border-border bg-muted/50')}>
                <div className="text-xs font-semibold text-emerald-600">Entradas</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">rendimentos</div>
              </button>
              <button onClick={() => { setType('RESERVE'); setColor('#d97706') }} className={cn('p-2.5 rounded-lg border-2 text-center transition-all touch-manipulation', type === 'RESERVE' ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/30' : 'border-border bg-muted/50')}>
                <div className="text-xs font-semibold text-amber-600">Reservas</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">poupança</div>
              </button>
            </div>
          </div>

          {/* Color picker */}
          <div className="space-y-1.5">
            <Label>Cor do card</Label>
            <div className="flex items-center gap-2 flex-wrap">
              {CARD_COLORS.map(c => (
                <button key={c} type="button" onClick={() => setColor(c)} className={cn('h-7 w-7 rounded-full border-2 transition-all', color === c ? 'border-primary ring-2 ring-primary/20 scale-110' : 'border-transparent')} style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleCreate} disabled={!name.trim() || saving}>{saving ? 'Criando...' : 'Criar card'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
