'use client'

import { useCallback, useState } from 'react'

export interface HistoryAction {
  description: string
  undo: () => Promise<void>
  redo: () => Promise<void>
}

const MAX_HISTORY = 25

export function useActionHistory() {
  const [undoStack, setUndoStack] = useState<HistoryAction[]>([])
  const [redoStack, setRedoStack] = useState<HistoryAction[]>([])

  const push = useCallback((action: HistoryAction) => {
    setUndoStack((prev) => {
      const next = [...prev, action]
      if (next.length > MAX_HISTORY) next.shift()
      return next
    })
    setRedoStack([])
  }, [])

  const undo = useCallback(async () => {
    let undoneAction: HistoryAction | null = null
    setUndoStack((prev) => {
      if (prev.length === 0) return prev
      undoneAction = prev[prev.length - 1]
      return prev.slice(0, -1)
    })
    await new Promise((r) => setTimeout(r, 0))
    if (!undoneAction) return
    try {
      await undoneAction.undo()
      setRedoStack((prev) => {
        const next = [...prev, undoneAction!]
        if (next.length > MAX_HISTORY) next.shift()
        return next
      })
    } catch (e) {
      setUndoStack((prev) => [...prev, undoneAction!])
      throw e
    }
  }, [])

  const redo = useCallback(async () => {
    let redoneAction: HistoryAction | null = null
    setRedoStack((prev) => {
      if (prev.length === 0) return prev
      redoneAction = prev[prev.length - 1]
      return prev.slice(0, -1)
    })
    await new Promise((r) => setTimeout(r, 0))
    if (!redoneAction) return
    try {
      await redoneAction.redo()
      setUndoStack((prev) => {
        const next = [...prev, redoneAction!]
        if (next.length > MAX_HISTORY) next.shift()
        return next
      })
    } catch (e) {
      setRedoStack((prev) => [...prev, redoneAction!])
      throw e
    }
  }, [])

  return {
    push, undo, redo,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    undoCount: undoStack.length,
    redoCount: redoStack.length,
    nextUndo: undoStack[undoStack.length - 1]?.description ?? null,
    nextRedo: redoStack[redoStack.length - 1]?.description ?? null,
  }
}
