'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Category, collectAllPaths, Subgroup, TopGroup } from '@/lib/finance'
import { Move, Folder, Tag } from 'lucide-react'

interface Props {
  open: boolean
  category: Category | null
  labels: Record<string, string>
  subgroups: Subgroup[]
  topGroups: TopGroup[]
  allCategories: Category[]
  onOpenChange: (open: boolean) => void
  onMove: (newGroup: string, newParentCategoryId: string | null) => Promise<void>
}

// Every id that is `category` itself or a descendant of it — these can never
// be valid move targets, or the category would become its own ancestor.
function collectExcludedIds(categoryId: string, allCategories: Category[]): Set<string> {
  const excluded = new Set<string>([categoryId])
  let addedAny = true
  while (addedAny) {
    addedAny = false
    for (const c of allCategories) {
      if (c.parentCategoryId && excluded.has(c.parentCategoryId) && !excluded.has(c.id)) {
        excluded.add(c.id)
        addedAny = true
      }
    }
  }
  return excluded
}

export function MoveCategoryDialog({ open, category, labels, subgroups, topGroups, allCategories, onOpenChange, onMove }: Props) {
  const [target, setTarget] = useState<string>('')
  const [saving, setSaving] = useState(false)
  if (!category) return null

  const excluded = collectExcludedIds(category.id, allCategories)
  // Groups AND items, any depth — items appear as "cat:<id>" values. Moving
  // onto an item makes this category a CHILD of it (a sub-item), not just a
  // sibling within the same group.
  const options = collectAllPaths(subgroups, labels, topGroups, allCategories)
    .filter((opt) => !opt.value.startsWith('cat:') || !excluded.has(opt.value.slice(4)))

  const isCurrentTarget = target
    ? (target.startsWith('cat:') ? target.slice(4) === category.parentCategoryId : (target === category.group && !category.parentCategoryId))
    : false

  async function handleMove() {
    if (!target) return
    setSaving(true)
    try {
      if (target.startsWith('cat:')) {
        const targetId = target.slice(4)
        const targetCat = allCategories.find((c) => c.id === targetId)
        if (!targetCat) return
        await onMove(targetCat.group, targetCat.id)
      } else {
        await onMove(target, null)
      }
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Move className="h-4 w-4" />Mover categoria</DialogTitle>
          <p className="text-xs text-muted-foreground">Mover <strong>{category.name}</strong> para outro grupo ou item</p>
          <DialogDescription className="sr-only">Escolha o grupo ou item de destino.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Local atual</label>
            <div className="text-sm bg-muted/50 rounded-md px-3 py-2">{category.group}</div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Novo local</label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger><SelectValue placeholder="Escolher grupo ou item…" /></SelectTrigger>
              <SelectContent className="max-h-72">
                {options.map((opt) => {
                  const isItem = opt.value.startsWith('cat:')
                  return (
                    <SelectItem key={opt.value} value={opt.value} className={opt.depth > 0 ? 'text-xs' : 'font-medium'}>
                      <span className="flex items-center gap-1.5">
                        {opt.depth > 0 && <span className="text-muted-foreground">{'  '.repeat(opt.depth - 1)}↳</span>}
                        {isItem
                          ? <Tag className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          : <Folder className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
                        {opt.label}
                      </span>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground leading-snug">
              <Tag className="h-2.5 w-2.5 inline align-text-bottom mr-0.5" />
              indica um item — mover para dentro dele o transforma num sub-item.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleMove} disabled={!target || saving || isCurrentTarget}>{saving ? 'Movendo…' : 'Mover categoria'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
