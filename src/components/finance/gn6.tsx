'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import {
  Category, formatMoney, GroupTreeNode, computeNodeTotal,
  buildCategoryTree, computeCategoryNodeTotal, Transaction,
} from '@/lib/finance'
import {
  Plus, Trash2, ChevronDown, ChevronRight, Pencil, Clock,
  AlertTriangle, RefreshCw, Check, FolderPlus,
  TrendingUp, TrendingDown, PiggyBank, GripVertical,
} from 'lucide-react'
import { useCategoryDnd, dnd, DRAG_THRESHOLD, DnDType } from './category-dnd'

interface Props {
  node: GroupTreeNode
  labels: Record<string, string>
  transactionsByCat: Record<string, Transaction | undefined>
  allCategories: Category[]
  euroRate: number
  highlightedCategoryIds: Set<string>
  onClearSearch: () => void
  onEdit: (category: Category, current: Transaction | undefined) => void
  onAddCategory: (group: string, parentCategoryId?: string | null) => void
  onDeleteCategory: (cat: Category) => void
  onRename: (key: string, value: string) => void
  onStopRecurring: (seriesId: string, currentMonth: number) => void
  onAddSubgroup: (parentKey: string) => void
  onDeleteSubgroup: (node: GroupTreeNode) => void
  onMoveCategory: (cat: Category) => void
  onDropCategory?: (draggedId: string, targetId: string, position: 'before' | 'after') => void
  onDropSubgroup?: (draggedKey: string, targetKey: string, position: 'before' | 'after') => void
  onDropTopGroup?: (draggedKey: string, targetKey: string, position: 'before' | 'after') => void
  onColorChange?: (node: GroupTreeNode, color: string) => void
  onDeleteTopGroup?: (node: GroupTreeNode) => void
  onQuickAdd?: (group: string) => void
  onMergeSubgroups?: (draggedKey: string, targetKey: string) => void
}

// Fixed colors per block type
const BLOCK_COLORS = {
  INCOME: '#16a34a',   // green
  EXPENSE: '#dc2626',  // red
  RESERVE: '#d97706',  // amber/yellow
}

const CARD_COLORS = [
  '#dc2626', '#ea580c', '#d97706', '#ca8a04', '#65a30d',
  '#16a34a', '#0891b2', '#0284c7', '#4f46e5', '#7c3aed',
  '#c026d3', '#db2777', '#64748b', '#0f172a',
]

// Convert hex to rgba with alpha
function alpha(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

// Data attribute used for hit-testing during drag.
// We use a single attribute name per type to keep elementFromPoint lookups simple.
const ATTR_BY_TYPE: Record<DnDType, string> = {
  category: 'data-cat-id',
  subgroup: 'data-sg-key',
  topgroup: 'data-tg-key',
}

export function GroupNode(props: Props) {
  const { node, transactionsByCat, euroRate, allCategories } = props
  const [userOpen, setUserOpen] = useState(true)
  const hasSearch = props.highlightedCategoryIds.size > 0
  const hasHighlightedInTree = (n: GroupTreeNode): boolean => {
    if (n.categories.some((c) => props.highlightedCategoryIds.has(c.id))) return true
    return n.children.some(hasHighlightedInTree)
  }
  const open = hasSearch ? true : userOpen

  const total = computeNodeTotal(node, transactionsByCat, euroRate)
  const isTopLevel = node.isTopLevel
  const groupType = node.groupType || 'EXPENSE'
  const isIncome = groupType === 'INCOME'
  const isReserve = groupType === 'RESERVE'
  const isReceivable = node.isReceivable

  const color = isTopLevel
    ? (node.color || BLOCK_COLORS[groupType as keyof typeof BLOCK_COLORS] || '#64748b')
    : props.node.color || BLOCK_COLORS[groupType as keyof typeof BLOCK_COLORS] || '#64748b'

  const totalSign = isReserve || isReceivable ? '' : isIncome ? (total >= 0 ? '+' : '-') : (total >= 0 ? '-' : '+')
  const categoryTree = buildCategoryTree(node.categories, null)

  const BlockIcon = isIncome ? TrendingUp : isReserve ? PiggyBank : TrendingDown

  // Drag state for THIS row (header)
  const dndState = useCategoryDnd()
  const dragType: DnDType = isTopLevel ? 'topgroup' : 'subgroup'
  const dragId = isTopLevel ? node.key : node.key
  const isBeingDragged = dndState.type === dragType && dndState.draggedId === dragId
  const isDropTarget = dndState.type === dragType && dndState.targetId === dragId
  const dropPosition = isDropTarget ? dndState.targetPosition : null

  function handleHeaderPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement
    if (!target.closest('[data-drag-handle]')) return
    if (e.pointerType === 'mouse' && e.button !== 0) return

    const startX = e.clientX
    const startY = e.clientY
    const rowEl = e.currentTarget
    const cardEl = rowEl.closest('[class*="overflow-hidden"]') as HTMLElement | null
    const rect = rowEl.getBoundingClientRect()
    let dragging = false
    let mergeTimer: ReturnType<typeof setTimeout> | null = null
    let lastMergeTarget: string | null = null

    const clearMergeTimer = () => {
      if (mergeTimer) {
        clearTimeout(mergeTimer)
        mergeTimer = null
      }
      lastMergeTarget = null
    }

    const handleMove = (ev: PointerEvent) => {
      const dx = Math.abs(ev.clientX - startX)
      const dy = Math.abs(ev.clientY - startY)
      if (!dragging && (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD)) {
        dragging = true
        dnd.start({
          type: dragType,
          id: dragId,
          name: node.label,
          color,
          pointerX: ev.clientX,
          pointerY: ev.clientY,
          offsetX: startX - rect.left,
          offsetY: startY - rect.top,
          rowWidth: rect.width,
        })
        document.body.style.overflow = 'hidden'
        document.body.style.touchAction = 'none'
      }
      if (dragging) {
        ev.preventDefault()
        dnd.move(ev.clientX, ev.clientY)
        if (cardEl) cardEl.style.pointerEvents = 'none'
        const el = document.elementFromPoint(ev.clientX, ev.clientY)
        if (cardEl) cardEl.style.pointerEvents = ''
        const attrName = ATTR_BY_TYPE[dragType]
        const targetEl = el?.closest(`[${attrName}]`) as HTMLElement | null
        if (targetEl && targetEl.getAttribute(attrName) !== dragId) {
          const targetKey = targetEl.getAttribute(attrName)!
          const targetRect = targetEl.getBoundingClientRect()
          const isAbove = ev.clientY < targetRect.top + targetRect.height / 2
          dnd.setTarget(targetKey, isAbove ? 'before' : 'after')

          // Merge detection: if hovering over the SAME subgroup target for 2 seconds,
          // trigger the merge dialog. Only for subgroups (not topgroups).
          if (dragType === 'subgroup' && props.onMergeSubgroups) {
            if (targetKey !== lastMergeTarget) {
              clearMergeTimer()
              lastMergeTarget = targetKey
              mergeTimer = setTimeout(() => {
                // Trigger merge
                const result = dnd.end()
                clearMergeTimer()
                document.body.style.overflow = ''
                document.body.style.touchAction = ''
                window.removeEventListener('pointermove', handleMove)
                window.removeEventListener('pointerup', handleUp)
                window.removeEventListener('pointercancel', handleUp)
                if (result) {
                  props.onMergeSubgroups!(dragId, targetKey)
                }
              }, 2000)
            }
          }
        } else {
          dnd.setTarget(null, null)
          clearMergeTimer()
        }
      }
    }

    const handleUp = (ev?: PointerEvent) => {
      clearMergeTimer()
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      window.removeEventListener('pointercancel', handleUp)
      document.body.style.overflow = ''
      document.body.style.touchAction = ''
      if (dragging) {
        const result = dnd.end()
        if (result) {
          if (result.type === 'category' && props.onDropCategory) {
            props.onDropCategory(dragId, result.targetId, result.position)
          } else if (result.type === 'subgroup' && props.onDropSubgroup) {
            props.onDropSubgroup(dragId, result.targetId, result.position)
          } else if (result.type === 'topgroup' && props.onDropTopGroup) {
            props.onDropTopGroup(dragId, result.targetId, result.position)
          }
        }
      }
    }

    window.addEventListener('pointermove', handleMove, { passive: false })
    window.addEventListener('pointerup', handleUp)
    window.addEventListener('pointercancel', handleUp)
  }

  const headerAttr = isTopLevel ? { 'data-tg-key': node.key } : { 'data-sg-key': node.key }

  // Common header content — used for both top-level Card and flat subgroup sections
  const headerContent = (
    <>
      {/* Drop indicators */}
      {dropPosition === 'before' && (
        <div className="absolute left-0 right-0 top-0 h-0.5 bg-primary z-20" />
      )}
      {dropPosition === 'after' && (
        <div className="absolute left-0 right-0 bottom-0 h-0.5 bg-primary z-20" />
      )}

      {/* Drag handle (6 dots) — only this area starts a drag */}
      <span
        className="text-muted-foreground/40 hover:text-muted-foreground flex-shrink-0 cursor-grab active:cursor-grabbing touch-none py-1"
        data-drag-handle
        aria-hidden="true"
      >
        <GripVertical className={isTopLevel ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
      </span>
      <button
        onClick={() => setUserOpen(!userOpen)}
        className="flex items-center gap-1.5 sm:gap-2 flex-1 touch-manipulation min-w-0"
      >
        {/* Expand/collapse chevron */}
        {open
          ? <ChevronDown className={cn('flex-shrink-0', isTopLevel ? 'h-4 w-4' : 'h-3.5 w-3.5')} style={{ color }} />
          : <ChevronRight className={cn('flex-shrink-0', isTopLevel ? 'h-4 w-4' : 'h-3.5 w-3.5')} style={{ color }} />
        }
        {/* Colored dot — the only color indicator for subgroups (Nubank style) */}
        {isTopLevel ? (
          <BlockIcon className="flex-shrink-0 h-4 w-4" style={{ color }} />
        ) : (
          <span
            className="h-2.5 w-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: color }}
          />
        )}
        {/* Label — wraps naturally on small screens */}
        <div
          className={cn('flex-1 min-w-0 break-words leading-tight', isTopLevel ? 'font-bold text-sm' : 'font-semibold text-[13px]')}
          style={{ color: isTopLevel ? color : undefined }}
        >
          {node.label}
        </div>
        {isReceivable && (
          <Badge variant="outline" className="h-5 px-1 text-[10px] gap-0.5 border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 flex-shrink-0">
            <Clock className="h-2.5 w-2.5" />a receber
          </Badge>
        )}
        <span className="text-xs text-muted-foreground flex-shrink-0">({countAll(node, allCategories)})</span>
      </button>
      <div className="flex items-center gap-0.5 flex-shrink-0">
        {isTopLevel && props.onColorChange && (
          <div className="hidden sm:block">
            <ColorButton currentColor={color} onColorChange={(c) => props.onColorChange!(node, c)} />
          </div>
        )}
        <RenameButton
          currentLabel={node.label}
          onRename={(v) => props.onRename(isTopLevel ? 'group:' + node.key : 'subgroup:' + node.key, v)}
          small={!isTopLevel}
        />
        {/* + button: creates a new subgroup inside (FolderPlus for both top-level and subgroups) */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            props.onAddSubgroup(node.key)
          }}
          className="p-1 sm:p-1.5 rounded-md hover:bg-black/10 dark:hover:bg-white/10 transition-colors touch-manipulation"
          aria-label="Novo subgrupo"
          title="Criar subgrupo aqui"
          style={{ color }}
        >
          <FolderPlus className={isTopLevel ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
        </button>
        {!isTopLevel && (
          <button
            onClick={(e) => { e.stopPropagation(); props.onDeleteSubgroup(node) }}
            className="p-1 sm:p-1.5 rounded-md hover:bg-destructive/10 hover:text-destructive transition-colors touch-manipulation"
            aria-label="Remover"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
        {isTopLevel && !node.isDefaultTop && props.onDeleteTopGroup && (
          <button
            onClick={(e) => { e.stopPropagation(); props.onDeleteTopGroup!(node) }}
            className="p-1 sm:p-1.5 rounded-md hover:bg-destructive/10 hover:text-destructive transition-colors touch-manipulation"
            aria-label="Remover card"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
        {/* Total value — inside actions div so the whole group is flex-shrink-0 */}
        <span className="text-xs sm:text-sm font-semibold tabular-nums ml-0.5 sm:ml-1 text-right" style={{ color }}>
          {totalSign}{formatMoney(Math.abs(total), 'BRL')}
          <span className="text-[10px] text-muted-foreground ml-1 font-normal hidden sm:inline">
            ({formatMoney(Math.abs(total) / euroRate, 'EUR')})
          </span>
        </span>
      </div>
    </>
  )

  // Body content — shared between top-level and subgroup
  const bodyContent = open ? (
    <div>
      {/* Direct categories */}
      {categoryTree.length > 0 && (
        <div>
          {categoryTree.map((catNode) => (
            <CategoryNodeRow key={catNode.category.id} catNode={catNode} depth={0} allProps={props} color={color} />
          ))}
        </div>
      )}
      {/* Child subgroups — rendered as flat sections inside the same card */}
      {node.children.map((child) => (
        <GroupNode key={child.key} {...props} node={child} />
      ))}
    </div>
  ) : null

  // Subgroups: flat section inside the parent card (no Card wrapper, no border)
  if (!isTopLevel) {
    return (
      <div
        className="relative"
        style={{ marginLeft: 0 }}
      >
        {/* Subtle separator line + colored accent */}
        <div
          {...headerAttr}
          onPointerDown={handleHeaderPointerDown}
          className={cn(
            'w-full flex items-center gap-1 px-2.5 py-2 transition-colors relative border-t border-border/40',
            isBeingDragged && 'opacity-40',
          )}
        >
          {headerContent}
        </div>
        {bodyContent}
        <DragGhost />
      </div>
    )
  }

  // Top-level: keep the Card with soft shadow (Nubank style)
  return (
    <Card
      className="overflow-hidden shadow-sm relative rounded-xl"
      id={'group-' + node.key}
      style={{
        borderLeft: '4px solid ' + color,
      }}
    >
      <div
        {...headerAttr}
        onPointerDown={handleHeaderPointerDown}
        className={cn(
          'w-full flex items-center gap-1 p-2.5 transition-colors relative',
          isBeingDragged && 'opacity-40',
        )}
        style={{
          background: alpha(color, 0.08),
        }}
      >
        {headerContent}
      </div>
      {bodyContent}
      <DragGhost />
    </Card>
  )
}

function countAll(node: GroupTreeNode, allCategories: Category[]): number {
  return node.categories.length + node.children.reduce((acc, c) => acc + countAll(c, allCategories), 0)
}

// ---- Drag ghost (portal, follows pointer) ----

function DragGhost() {
  const dndState = useCategoryDnd()
  if (!dndState.draggedId) return null
  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed pointer-events-none z-[100] shadow-2xl rounded-md border-2 border-primary/60 bg-background"
      style={{
        left: dndState.pointerX - dndState.offsetX,
        top: dndState.pointerY - dndState.offsetY,
        width: dndState.rowWidth,
        padding: '8px 12px',
        transform: 'rotate(-1deg) scale(1.02)',
        opacity: 0.95,
      }}
    >
      <div className="flex items-center gap-2">
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        <span
          className="h-2.5 w-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: dndState.draggedColor }}
        />
        <span className="text-[13px] font-medium text-foreground truncate">
          {dndState.draggedName}
        </span>
      </div>
    </div>,
    document.body
  )
}

// ---- Recursive category row ----

function CategoryNodeRow({ catNode, depth, allProps, color }: {
  catNode: ReturnType<typeof buildCategoryTree>[0]
  depth: number
  allProps: Props
  color: string
}) {
  const { category, children } = catNode
  const { transactionsByCat, euroRate } = allProps
  const [userOpen, setUserOpen] = useState(false)

  const dndState = useCategoryDnd()
  const isBeingDragged = dndState.type === 'category' && dndState.draggedId === category.id
  const isDropTarget = dndState.type === 'category' && dndState.targetId === category.id
  const dropPosition = isDropTarget ? dndState.targetPosition : null

  const hasSearch = allProps.highlightedCategoryIds.size > 0
  const hasHighlightedDescendant = (n: typeof catNode): boolean => {
    if (allProps.highlightedCategoryIds.has(n.category.id)) return true
    return n.children.some(hasHighlightedDescendant)
  }
  const shouldAutoExpand = hasSearch && hasHighlightedDescendant(catNode)
  const open = shouldAutoExpand ? true : userOpen

  const tx = transactionsByCat[category.id]
  const value = tx ? tx.value : null
  const isRecurring = tx ? tx.isRecurring : false
  const installmentNumber = tx ? tx.installmentNumber : null
  const installmentsTotal = tx ? tx.installmentsTotal : null
  const hasChildren = children.length > 0
  const isHighlighted = allProps.highlightedCategoryIds.has(category.id)
  const goalExceeded = category.monthlyGoal !== null && value !== null && category.type === 'EXPENSE' && value > category.monthlyGoal

  const totalWithChildren = hasChildren ? computeCategoryNodeTotal(catNode, transactionsByCat, euroRate) : null
  const displayValue = totalWithChildren !== null ? totalWithChildren : value
  const sign = displayValue === null ? '' : category.type === 'RESERVE' || category.group === 'rendimentos.valores_a_receber' ? (displayValue < 0 ? '-' : '') : category.type === 'INCOME' ? (displayValue >= 0 ? '+' : '-') : (displayValue >= 0 ? '-' : '+')

  const indent = 16 + depth * 20

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement
    // Drag starts ONLY when the user presses on the grip handle (6 dots on the left).
    if (!target.closest('[data-drag-handle]')) return
    if (e.pointerType === 'mouse' && e.button !== 0) return

    const startX = e.clientX
    const startY = e.clientY
    const rowEl = e.currentTarget
    const rect = rowEl.getBoundingClientRect()
    let dragging = false

    const handleMove = (ev: PointerEvent) => {
      const dx = Math.abs(ev.clientX - startX)
      const dy = Math.abs(ev.clientY - startY)
      if (!dragging && (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD)) {
        dragging = true
        dnd.start({
          type: 'category',
          id: category.id,
          name: category.name,
          color: category.color || color,
          pointerX: ev.clientX,
          pointerY: ev.clientY,
          offsetX: startX - rect.left,
          offsetY: startY - rect.top,
          rowWidth: rect.width,
        })
        document.body.style.overflow = 'hidden'
        document.body.style.touchAction = 'none'
      }
      if (dragging) {
        ev.preventDefault()
        dnd.move(ev.clientX, ev.clientY)
        rowEl.style.pointerEvents = 'none'
        const el = document.elementFromPoint(ev.clientX, ev.clientY)
        rowEl.style.pointerEvents = ''
        const targetRow = el?.closest('[data-cat-id]') as HTMLElement | null
        if (targetRow && targetRow.dataset.catId !== category.id) {
          const targetRect = targetRow.getBoundingClientRect()
          const isAbove = ev.clientY < targetRect.top + targetRect.height / 2
          dnd.setTarget(targetRow.dataset.catId ?? null, isAbove ? 'before' : 'after')
        } else {
          dnd.setTarget(null, null)
        }
      }
    }

    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      window.removeEventListener('pointercancel', handleUp)
      document.body.style.overflow = ''
      document.body.style.touchAction = ''
      if (dragging) {
        const result = dnd.end()
        if (result && allProps.onDropCategory) {
          allProps.onDropCategory(category.id, result.targetId, result.position)
        }
      }
    }

    window.addEventListener('pointermove', handleMove, { passive: false })
    window.addEventListener('pointerup', handleUp)
    window.addEventListener('pointercancel', handleUp)
  }

  return (
    <>
      <div
        data-cat-id={category.id}
        onPointerDown={handlePointerDown}
        className={cn(
          'flex items-center justify-between py-2 pr-3 group transition-all relative',
          hasSearch && !isHighlighted && 'opacity-20',
          isHighlighted && 'ring-2 ring-yellow-500 ring-inset z-10',
          !hasSearch && 'hover:bg-muted/50',
          isBeingDragged && 'opacity-30',
        )}
        style={{
          paddingLeft: indent + 'px',
          background: isHighlighted ? 'rgba(250, 204, 21, 0.18)' : isBeingDragged ? 'rgba(0,0,0,0.04)' : undefined,
        }}
      >
        {dropPosition === 'before' && (
          <div className="absolute left-0 right-0 top-0 h-0.5 bg-primary z-20" />
        )}
        {dropPosition === 'after' && (
          <div className="absolute left-0 right-0 bottom-0 h-0.5 bg-primary z-20" />
        )}

        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <span
            className="text-muted-foreground/40 group-hover:text-muted-foreground flex-shrink-0 cursor-grab active:cursor-grabbing touch-none"
            data-drag-handle
            aria-hidden="true"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </span>
          {hasChildren ? (
            <button onClick={(e) => { e.stopPropagation(); setUserOpen(!userOpen) }} className="p-0.5 rounded hover:bg-muted text-muted-foreground touch-manipulation flex-shrink-0" aria-label={open ? 'Recolher' : 'Expandir'}>
              {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
          ) : (
            <span className="w-5 flex-shrink-0" />
          )}
          <span
            className="h-2.5 w-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: category.color || color }}
          />
          <button
            onClick={() => { if (isHighlighted) allProps.onClearSearch(); allProps.onEdit(category, tx) }}
            className="flex flex-col items-start text-left touch-manipulation min-w-0 flex-1"
          >
            <span className="text-[13px] font-medium text-foreground flex items-start gap-1 flex-wrap min-w-0 w-full">
              {/* Hide name for receivables — show only the "a receber" badge */}
              {category.group !== 'rendimentos.valores_a_receber' && (
                <div className="break-words leading-tight flex-1 min-w-0">{category.name}</div>
              )}
              {category.group === 'rendimentos.valores_a_receber' && (
                <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                  <Clock className="h-2.5 w-2.5" />a receber
                </span>
              )}
              {isRecurring && (
                <span className="inline-flex items-center gap-0.5 text-[9px] text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/40 px-1 py-0.5 rounded flex-shrink-0">
                  <RefreshCw className="h-2 w-2" />{installmentsTotal ? installmentNumber + '/' + installmentsTotal : 'recorrente'}
                </span>
              )}
              {goalExceeded && (
                <span className="inline-flex items-center gap-0.5 text-[9px] text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-1 py-0.5 rounded flex-shrink-0">
                  <AlertTriangle className="h-2 w-2" />meta
                </span>
              )}
              {hasChildren && <span className="text-[9px] text-muted-foreground flex-shrink-0">({children.length})</span>}
            </span>
            {category.note && category.group !== 'rendimentos.valores_a_receber' && <span className="text-xs text-muted-foreground truncate max-w-[180px]">{category.note}</span>}
          </button>
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); allProps.onAddCategory(category.group, category.id) }}
            className="p-1 sm:p-1.5 rounded-md hover:bg-muted transition-all touch-manipulation"
            aria-label="Adicionar sub-item"
            title="Adicionar sub-item"
          >
            <FolderPlus className="h-3 w-3" style={{ color }} />
          </button>
          {isRecurring && (
            <button onClick={(e) => { e.stopPropagation(); if (tx && tx.seriesId) allProps.onStopRecurring(tx.seriesId, tx.month) }} className="p-1 sm:p-1.5 rounded-md hover:bg-cyan-50 dark:hover:bg-cyan-950/40 hover:text-cyan-600 dark:hover:text-cyan-400 transition-all touch-manipulation" aria-label="Parar recorrência" title="Parar recorrência">
              <RefreshCw className="h-3 w-3" />
            </button>
          )}
          <button onClick={() => { if (isHighlighted) allProps.onClearSearch(); allProps.onEdit(category, tx) }} className="px-1.5 sm:px-2.5 py-1 sm:py-1.5 rounded-md hover:bg-muted transition-colors touch-manipulation text-right">
            {displayValue === null ? (
              <Plus className="h-4 w-4 text-muted-foreground/60 mx-auto" />
            ) : (
              <div className="flex flex-col items-end leading-tight">
                <span className="text-[13px] font-semibold tabular-nums whitespace-nowrap" style={{ color }}>
                  {sign}{formatMoney(Math.abs(displayValue), category.currency)}
                </span>
                <span className="text-[10px] text-muted-foreground tabular-nums whitespace-nowrap hidden sm:block">
                  {category.currency === 'BRL' ? formatMoney(Math.abs(displayValue) / euroRate, 'EUR') : formatMoney(Math.abs(displayValue) * euroRate, 'BRL')}
                </span>
              </div>
            )}
          </button>
          <button onClick={(e) => { e.stopPropagation(); allProps.onDeleteCategory(category) }} className="p-1 sm:p-1.5 rounded-md hover:bg-destructive/10 hover:text-destructive transition-all touch-manipulation" aria-label="Remover">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {hasChildren && open && (
        <div style={{ borderLeft: '2px solid ' + alpha(color, 0.15), marginLeft: (indent + 8) + 'px' }}>
          {children.map((child) => (
            <CategoryNodeRow key={child.category.id} catNode={child} depth={depth + 1} allProps={allProps} color={color} />
          ))}
          <button
            onClick={() => allProps.onAddCategory(category.group, category.id)}
            className="w-full flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-muted-foreground hover:bg-black/5 transition-colors touch-manipulation"
            style={{ paddingLeft: '8px' }}
          >
            <Plus className="h-3 w-3" />Adicionar em {category.name}
          </button>
        </div>
      )}
    </>
  )
}

// ---- Color button ----

function ColorButton({ currentColor, onColorChange }: { currentColor: string; onColorChange: (color: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button onClick={(e) => e.stopPropagation()} className="p-1.5 rounded-md hover:bg-black/10 transition-colors touch-manipulation" aria-label="Mudar cor" title="Mudar cor do bloco">
          <span className="block h-4 w-4 rounded-full border border-black/10" style={{ backgroundColor: currentColor }} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48" onClick={(e) => e.stopPropagation()}>
        <div className="grid grid-cols-7 gap-1.5">
          {CARD_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => { onColorChange(c); setOpen(false) }}
              className={cn('h-6 w-6 rounded-full border-2 transition-all touch-manipulation', currentColor === c ? 'border-primary ring-2 ring-primary/20 scale-110' : 'border-transparent')}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ---- Rename button ----

function RenameButton({ currentLabel, onRename, small }: { currentLabel: string; onRename: (v: string) => void; small?: boolean }) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(currentLabel)
  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setValue(currentLabel) }}>
      <PopoverTrigger asChild>
        <button onClick={(e) => e.stopPropagation()} className="p-1.5 rounded-md hover:bg-black/10 transition-colors touch-manipulation" aria-label="Renomear">
          <Pencil className={small ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Renomear</label>
          <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder={currentLabel} autoFocus onKeyDown={(e) => { if (e.key === 'Enter') { onRename(value.trim()); setOpen(false) } }} />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={() => { onRename(value.trim()); setOpen(false) }}><Check className="h-3 w-3 mr-1" />Salvar</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
