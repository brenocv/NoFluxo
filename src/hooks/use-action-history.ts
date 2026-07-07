'use client'

import { useCallback, useSyncExternalStore } from 'react'

export interface HistoryAction {
  description: string
  undo: () => Promise<void>
  redo: () => Promise<void>
}

const MAX_HISTORY = 25

// We use a simple external store pattern so we can read the current stacks
// synchronously without triggering the "refs during render" lint error.
let undoStack: HistoryAction[] = []
let redoStack: HistoryAction[] = []
const listeners = new Set<() => void>()

function emit() { listeners.forEach((l) => l()) }
function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}
function getSnapshot() { return undoStack.length + ':' + redoStack.length }

export function useActionHistory() {
  // This hook subscribes to the external store so it re-renders when stacks change
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  const push = useCallback((action: HistoryAction) => {
    undoStack = [...undoStack, action]
    if (undoStack.length > MAX_HISTORY) undoStack.shift()
    redoStack = []
    emit()
  }, [])

  const undo = useCallback(async () => {
    if (undoStack.length === 0) return
    const action = undoStack[undoStack.length - 1]
    undoStack = undoStack.slice(0, -1)
    try {
      await action.undo()
      redoStack = [...redoStack, action]
      if (redoStack.length > MAX_HISTORY) redoStack.shift()
    } catch (e) {
      undoStack = [...undoStack, action]
      throw e
    }
    emit()
  }, [])

  const redo = useCallback(async () => {
    if (redoStack.length === 0) return
    const action = redoStack[redoStack.length - 1]
    redoStack = redoStack.slice(0, -1)
    try {
      await action.redo()
      undoStack = [...undoStack, action]
      if (undoStack.length > MAX_HISTORY) undoStack.shift()
    } catch (e) {
      redoStack = [...redoStack, action]
      throw e
    }
    emit()
  }, [])

  return {
    push,
    undo,
    redo,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    undoCount: undoStack.length,
    redoCount: redoStack.length,
    nextUndo: undoStack[undoStack.length - 1]?.description ?? null,
    nextRedo: redoStack[redoStack.length - 1]?.description ?? null,
  }
}
