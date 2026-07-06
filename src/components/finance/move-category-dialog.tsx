'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Category, collectGroupPaths, Subgroup } from '@/lib/finance'
import { Move } from 'lucide-react'

interface Props {
  open: boolean
  category: Category | null
  labels: Record<string, string>
  subgroups: Subgroup[]
  onOpenChange: (open: boolean) => void
  onMove: (newGroup: string, newParentCategoryId: string | null) => Promise<void>
}

export function MoveCategoryDialog({ open, category, labels, subgroups, onOpenChange, onMove }: Props) {
  const [targetGroup, setTargetGroup] = useState<string>('')
  const [saving, setSaving] = useState(false)
  if (!category) return null
  const groupOptions = collectGroupPaths(subgroups, labels)

  async function handleMove() {
    if (!targetGroup) return
    setSaving(true)
    try { await onMove(targetGroup, null); onOpenChange(false) }
    finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Move className="h-4 w-4" />Mover categoria</DialogTitle>
          <p className="text-xs text-muted-foreground">Mover <strong>{category.name}</strong> para outro grupo</p>
          <DialogDescription className="sr-only">Escolha o grupo de destino.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Grupo atual</label>
            <div className="text-sm bg-muted/50 rounded-md px-3 py-2">{category.group}</div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Novo grupo</label>
            <Select value={targetGroup} onValueChange={setTargetGroup}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-60">
                {groupOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className={opt.depth > 0 ? 'text-xs' : 'font-medium'}>
                    {opt.depth > 0 ? '  '.repeat(opt.depth) + '↳ ' : ''}{opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleMove} disabled={!targetGroup || saving || targetGroup === category.group}>{saving ? 'Movendo…' : 'Mover categoria'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
