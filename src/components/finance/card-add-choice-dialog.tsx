'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Zap, FolderPlus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean
  cardName: string
  onOpenChange: (open: boolean) => void
  onAddItemWithValue: () => void
  onCreateSubgroup: () => void
}

export function CardAddChoiceDialog({
  open, cardName, onOpenChange, onAddItemWithValue, onCreateSubgroup,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar em {cardName}</DialogTitle>
          <DialogDescription className="sr-only">
            Escolha entre adicionar um item com valor direto ou criar um subgrupo para organizar vários itens.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 py-2">
          {/* Opção 1: Adicionar item com valor */}
          <button
            onClick={() => {
              onAddItemWithValue()
              onOpenChange(false)
            }}
            className={cn(
              'flex items-start gap-3 p-4 rounded-lg border-2 text-left transition-all touch-manipulation',
              'border-primary/30 hover:border-primary hover:bg-primary/5'
            )}
          >
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold">Adicionar item com valor</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Cria um item (ex.: Salário Breno, Aluguel) e já informa o valor, moeda, recorrência, etc. Pode ficar solto no card ou dentro de um subgrupo.
              </div>
            </div>
          </button>

          {/* Opção 2: Criar subgrupo */}
          <button
            onClick={() => {
              onCreateSubgroup()
              onOpenChange(false)
            }}
            className={cn(
              'flex items-start gap-3 p-4 rounded-lg border-2 text-left transition-all touch-manipulation',
              'border-border hover:border-primary/50 hover:bg-muted/50'
            )}
          >
            <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
              <FolderPlus className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold">Criar subgrupo</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Cria uma pasta dentro do card (ex.: Cartões BR, Contas casa) para organizar vários itens depois.
              </div>
            </div>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
