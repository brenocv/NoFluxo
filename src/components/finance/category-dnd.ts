'use client'

import { useSyncExternalStore } from 'react'

// Singleton drag-and-drop state shared across all rows/cards (categories, subgroups, top-groups).
// We use useSyncExternalStore so any row can read the current drag state
// without prop drilling and without re-rendering the whole tree.

export type DnDType = 'category' | 'subgroup' | 'topgroup'

export interface DnDState {
  type: DnDType | null
  draggedId: string | null        // category id, subgroup key, or topgroup key
  draggedName: string
  draggedColor: string
  pointerX: number
  pointerY: number
  offsetX: number
  offsetY: number
  targetId: string | null
  targetPosition: 'before' | 'after' | null
  rowWidth: number
  startedAt: number
}

const IDLE: DnDState = {
  type: null,
  draggedId: null,
  draggedName: '',
  draggedColor: '#888',
  pointerX: 0,
  pointerY: 0,
  offsetX: 0,
  offsetY: 0,
  targetId: null,
  targetPosition: null,
  rowWidth: 0,
  startedAt: 0,
}

let state: DnDState = IDLE

const listeners = new Set<() => void>()
function emit() { listeners.forEach((l) => l()) }
function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}
function getSnapshot() { return state }

export function useCategoryDnd() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export const dnd = {
  start(opts: {
    type: DnDType
    id: string
    name: string
    color: string
    pointerX: number
    pointerY: number
    offsetX: number
    offsetY: number
    rowWidth: number
  }) {
    state = {
      type: opts.type,
      draggedId: opts.id,
      draggedName: opts.name,
      draggedColor: opts.color,
      pointerX: opts.pointerX,
      pointerY: opts.pointerY,
      offsetX: opts.offsetX,
      offsetY: opts.offsetY,
      targetId: null,
      targetPosition: null,
      rowWidth: opts.rowWidth,
      startedAt: Date.now(),
    }
    emit()
  },
  move(pointerX: number, pointerY: number) {
    state = { ...state, pointerX, pointerY }
    emit()
  },
  setTarget(targetId: string | null, position: 'before' | 'after' | null) {
    if (state.targetId === targetId && state.targetPosition === position) return
    state = { ...state, targetId, targetPosition: position }
    emit()
  },
  end(): { type: DnDType; targetId: string; position: 'before' | 'after' } | null {
    const result =
      state.targetId && state.targetPosition && state.targetId !== state.draggedId && state.type
        ? { type: state.type, targetId: state.targetId, position: state.targetPosition }
        : null
    state = IDLE
    emit()
    return result
  },
  cancel() {
    state = IDLE
    emit()
  },
  isDragging() {
    return state.draggedId !== null
  },
}

// Distance threshold (px) to differentiate a click from a drag
export const DRAG_THRESHOLD = 5

// Finds the closest drop-target element (by attribute + vertical distance to the
// pointer) among all elements matching the attribute in the document.
// This is far more forgiving than exact pixel hit-testing via elementFromPoint,
// which silently finds nothing when the pointer is over the small gap/padding
// between two rows — the #1 cause of "drop did nothing" bugs in hand-rolled DnD.
export function findClosestDropTarget(
  attrName: string,
  excludeId: string,
  pointerY: number
): { id: string; position: 'before' | 'after' } | null {
  const rows = Array.from(document.querySelectorAll<HTMLElement>(`[${attrName}]`))
  let best: { id: string; position: 'before' | 'after'; dist: number } | null = null
  for (const row of rows) {
    const id = row.getAttribute(attrName)
    if (!id || id === excludeId) continue
    const rect = row.getBoundingClientRect()
    if (rect.height === 0) continue // hidden/collapsed, skip
    const mid = rect.top + rect.height / 2
    const dist = Math.abs(pointerY - mid)
    if (!best || dist < best.dist) {
      best = { id, position: pointerY < mid ? 'before' : 'after', dist }
    }
  }
  return best ? { id: best.id, position: best.position } : null
}
