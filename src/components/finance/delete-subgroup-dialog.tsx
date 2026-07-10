'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { FolderInput, Trash2, AlertTriangle } from 'lucide-react'
import { GroupTreeNode } from '@/lib/finance'
import { useMemo } from 'react'

interface Props {
  open: boolean
  node: GroupTreeNode | null
  parentLabel: string
  onOpenChange: (open: boolean) => void
  onConfirm: (mode: 'move' | 'delete') => Promise<void>
}

export function DeleteSubgroupDialog({ open, node, parentLabel, onOpenChange, onConfirm }: Props) {
  const categoryCount = useMemo(() => {
    if (!node) return 0
    return countAll(node)
  }, [node])

  if (!node) return null

  async function handle(mode: 'move' | 'delete') {
    await onConfirm(mode)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Remover subgrupo &ldquo;{node.label}&rdquo;?
          </DialogTitle>
          <DialogDescription className="sr-only">
            Escolha o que fazer com as categorias dentro deste subgrupo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">
            Este subgrupo contém <strong>{categoryCount}</strong> categoria(s) (incluindo subgrupos aninhados).
            O que você deseja fazer com elas?
          </p>

          <div className="grid grid-cols-1 gap-2">
            <button
              onClick={() => handle('move')}
              className="flex items-start gap-3 p-3 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors text-left touch-manipulation"
            >
              <FolderInput className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">Mover para o grupo pai</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  As categorias serão movidas para <strong>{parentLabel}</strong> e mantêm seus valores.
                </div>
              </div>
            </button>

            <button
              onClick={() => handle('delete')}
              className="flex items-start gap-3 p-3 rounded-lg border border-destructive/30 hover:border-destructive hover:bg-destructive/5 transition-colors text-left touch-manipulation"
            >
              <Trash2 className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-destructive">Excluir tudo</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  As categorias e <strong>todos os valores</strong> dentro deste subgrupo serão apagados permanentemente.
                </div>
              </div>
            </button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function countAll(node: GroupTreeNode): number {
  return node.categories.length + node.children.reduce((acc, c) => acc + countAll(c), 0)
}
