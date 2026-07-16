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
  draggedKey: string | null
  targetKey: string | null
  draggedLabel: string
  targetLabel: string
  parentLabel: string
  onOpenChange: (open: boolean) => void
  onConfirm: (newSubgroupName: string) => Promise<void>
}

export function MergeSubgroupsDialog({
  open, draggedKey, targetKey, draggedLabel, targetLabel, parentLabel, onOpenChange, onConfirm,
}: Props) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setName('')
  }, [open])

  if (!draggedKey || !targetKey) return null

  async function handleConfirm() {
    if (!name.trim()) return
    setSaving(true)
    try {
      await onConfirm(name.trim())
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
            <FolderPlus className="h-4 w-4 text-primary" />
            Agrupar subgrupos
          </DialogTitle>
          <DialogDescription className="sr-only">
            Crie um novo subgrupo que conterá "{draggedLabel}" e "{targetLabel}".
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">
            Os subgrupos <strong className="text-foreground">{draggedLabel}</strong> e{' '}
            <strong className="text-foreground">{targetLabel}</strong> serão agrupados dentro de um novo subgrupo em{' '}
            <strong className="text-foreground">{parentLabel}</strong>.
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="merge-name">Nome do novo grupo</Label>
            <Input
              id="merge-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Cartões, Mercado, Extras..."
              onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) handleConfirm() }}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!name.trim() || saving}>
            {saving ? 'Agrupando…' : 'Agrupar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
