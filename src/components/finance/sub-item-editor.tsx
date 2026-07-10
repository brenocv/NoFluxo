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
import { FolderPlus } from 'lucide-react'

interface Props {
  open: boolean
  parentLabel: string
  onOpenChange: (open: boolean) => void
  onCreate: (name: string) => Promise<void>
}

export function SubItemEditor({
  open, parentLabel, onOpenChange, onCreate,
}: Props) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setName('')
  }, [open])

  async function handleCreate() {
    if (!name.trim()) return
    setSaving(true)
    try {
      await onCreate(name.trim())
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
            <FolderPlus className="h-4 w-4" />
            Novo sub-item
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            dentro de <strong>{parentLabel}</strong>
          </p>
          <DialogDescription className="sr-only">
            Crie um novo sub-item dentro de {parentLabel}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="si-name">Nome do sub-item</Label>
            <Input
              id="si-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Comercio, Mercado, Extras…"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            O sub-item herdará o tipo e a moeda do item pai.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={!name.trim() || saving}>
            {saving ? 'Criando…' : 'Criar sub-item'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
