'use client'

import { Button } from '@/components/ui/button'
import { Undo2, Redo2 } from 'lucide-react'

interface Props {
  canUndo: boolean
  canRedo: boolean
  nextUndo: string | null
  nextRedo: string | null
  onUndo: () => void
  onRedo: () => void
}

export function UndoRedoButtons({ canUndo, canRedo, nextUndo, nextRedo, onUndo, onRedo }: Props) {
  return (
    <div className="flex items-center gap-0.5">
      <Button variant="outline" size="icon" className="h-8 w-8" onClick={onUndo} disabled={!canUndo} aria-label="Desfazer" title={canUndo ? `Desfazer: ${nextUndo}` : 'Nada para desfazer'}>
        <Undo2 className="h-4 w-4" />
      </Button>
      <Button variant="outline" size="icon" className="h-8 w-8" onClick={onRedo} disabled={!canRedo} aria-label="Refazer" title={canRedo ? `Refazer: ${nextRedo}` : 'Nada para refazer'}>
        <Redo2 className="h-4 w-4" />
      </Button>
    </div>
  )
}
