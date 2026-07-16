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
  parentKey: string | null
  parentLabel: string
  onOpenChange: (open: boolean) => void
  onCreate: (name: string) => Promise<void>
}

export function SubgroupEditor({
  open, parentKey, parentLabel, onOpenChange, onCreate,
}: Props) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setName('')
  }, [open])

  if (!parentKey) return null

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
      <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderPlus className="h-4 w-4" />
            Novo subgrupo
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            dentro de <strong>{parentLabel}</strong>
          </p>
          <DialogDescription className="sr-only">
            Crie um novo subgrupo para organizar categorias dentro de {parentLabel}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="sg-name">Nome do subgrupo</Label>
            <Input
              id="sg-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Mesada Breno, Gastos escolares, Extras…"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Você poderá criar categorias e até outros subgrupos dentro dele.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={!name.trim() || saving}>
            {saving ? 'Criando…' : 'Criar subgrupo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
