'use client'

import { useState } from 'react'
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
  AlertTriangle, RefreshCw, Check, FolderPlus, Move,
  TrendingUp, TrendingDown, PiggyBank, ArrowUp, ArrowDown,
} from 'lucide-react'

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
  onReorder?: (catId: string, direction: 'up' | 'down') => void
  onColorChange?: (node: GroupTreeNode, color: string) => void
  onDeleteTopGroup?: (node: GroupTreeNode) => void
  onReorderTopGroup?: (key: string, direction: 'up' | 'down') => void
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

export function GroupNode(props: Props) {
  const { node, transactionsByCat, euroRate, allCategories } = props
  const [userOpen, setUserOpen] = useState(true)
  // Auto-expand when there's a search with highlighted items inside
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

  // Color: top-level uses its own color, children inherit parent's color
  const color = isTopLevel
    ? (node.color || BLOCK_COLORS[groupType as keyof typeof BLOCK_COLORS] || '#64748b')
    : props.node.color || BLOCK_COLORS[groupType as keyof typeof BLOCK_COLORS] || '#64748b'

  const totalSign = isReserve || isReceivable ? '' : isIncome ? (total >= 0 ? '+' : '-') : (total >= 0 ? '-' : '+')
  const categoryTree = buildCategoryTree(node.categories, null)

  // Icon per block type
  const BlockIcon = isIncome ? TrendingUp : isReserve ? PiggyBank : TrendingDown

  return (
    <Card
      className="overflow-hidden shadow-sm"
      id={isTopLevel ? 'group-' + node.key : undefined}
      style={{
        marginLeft: !isTopLevel ? (node.depth - 1) * 24 + 8 : 0,
        borderLeft: '4px solid ' + color,
        background: alpha(color, 0.04),
      }}
    >
      {/* Header */}
      <div
        className="w-full flex items-center justify-between p-2.5 transition-colors"
        style={{ background: alpha(color, isTopLevel ? 0.14 : 0.06) }}
      >
        <button
          onClick={() => setUserOpen(!userOpen)}
          className="flex items-center gap-2 flex-1 touch-manipulation min-w-0"
        >
          {/* Expand/collapse chevron */}
          {open
            ? <ChevronDown className="h-4 w-4 flex-shrink-0" style={{ color }} />
            : <ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color }} />
          }
          {/* Block icon (arrow up/down/piggy) */}
          <BlockIcon className={cn('flex-shrink-0', isTopLevel ? 'h-4 w-4' : 'h-3.5 w-3.5')} style={{ color }} />
          {/* Label */}
          <span
            className={cn('truncate', isTopLevel ? 'font-bold text-sm' : 'font-medium text-[13px]')}
            style={{ color }}
          >
            {node.label}
          </span>
          {isReceivable && (
            <Badge variant="outline" className="h-5 px-1 text-[10px] gap-0.5 border-amber-300 bg-amber-50 text-amber-700 flex-shrink-0">
              <Clock className="h-2.5 w-2.5" />a receber
            </Badge>
          )}
          <span className="text-xs text-muted-foreground flex-shrink-0">({countAll(node, allCategories)})</span>
        </button>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {isTopLevel && props.onColorChange && (
            <ColorButton currentColor={color} onColorChange={(c) => props.onColorChange!(node, c)} />
          )}
          <RenameButton
            currentLabel={node.label}
            onRename={(v) => props.onRename(isTopLevel ? 'group:' + node.key : 'subgroup:' + node.key, v)}
            small={!isTopLevel}
          />
          {/* + button: top-level creates subgroup (card), subgroup creates category (row) */}
          <button
            onClick={(e) => { e.stopPropagation(); if (isTopLevel) { props.onAddSubgroup(node.key) } else { props.onAddCategory(node.key, null) } }}
            className="p-1.5 rounded-md hover:bg-black/10 transition-colors touch-manipulation"
            aria-label={isTopLevel ? 'Novo grupo' : 'Nova categoria'}
            title={isTopLevel ? 'Criar grupo aqui (como Cartões BR)' : 'Adicionar categoria aqui'}
            style={{ color }}
          >
            <Plus className="h-4 w-4" />
          </button>
          {!isTopLevel && (
            <button
              onClick={(e) => { e.stopPropagation(); props.onDeleteSubgroup(node) }}
              className="p-1.5 rounded-md hover:bg-destructive/10 hover:text-destructive transition-colors touch-manipulation"
              aria-label="Remover"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          {isTopLevel && !node.isDefaultTop && props.onDeleteTopGroup && (
            <button
              onClick={(e) => { e.stopPropagation(); props.onDeleteTopGroup!(node) }}
              className="p-1.5 rounded-md hover:bg-destructive/10 hover:text-destructive transition-colors touch-manipulation"
              aria-label="Remover card"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          {isTopLevel && props.onReorderTopGroup && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); props.onReorderTopGroup!(node.key, 'up') }}
                className="p-1 rounded-md hover:bg-black/10 transition-colors touch-manipulation"
                aria-label="Subir card"
                title="Mover card para cima"
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); props.onReorderTopGroup!(node.key, 'down') }}
                className="p-1 rounded-md hover:bg-black/10 transition-colors touch-manipulation"
                aria-label="Descer card"
                title="Mover card para baixo"
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          <span className="text-sm font-semibold tabular-nums ml-1" style={{ color }}>
            {totalSign}{formatMoney(Math.abs(total), 'BRL')}
            <span className="text-[10px] text-muted-foreground ml-1 font-normal">
              ({formatMoney(Math.abs(total) / euroRate, 'EUR')})
            </span>
          </span>
        </div>
      </div>

      {/* Body */}
      {open && (
        <div>
          {/* Direct categories */}
          {categoryTree.length > 0 && (
            <div className="divide-y divide-border/30">
              {categoryTree.map((catNode) => (
                <CategoryNodeRow key={catNode.category.id} catNode={catNode} depth={0} allProps={props} color={color} />
              ))}
            </div>
          )}

          {/* Child subgroups — indented with connector line */}
          {node.children.map((child) => (
            <div key={child.key} className="border-t border-border/30">
              <GroupNode {...props} node={child} />
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function countAll(node: GroupTreeNode, allCategories: Category[]): number {
  return node.categories.length + node.children.reduce((acc, c) => acc + countAll(c, allCategories), 0)
}

// ---- Recursive category row (like file tree) ----

function CategoryNodeRow({ catNode, depth, allProps, color }: {
  catNode: ReturnType<typeof buildCategoryTree>[0]
  depth: number
  allProps: Props
  color: string
}) {
  const { category, children } = catNode
  const { transactionsByCat, euroRate } = allProps
  const [userOpen, setUserOpen] = useState(false)

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

  // Indentation: each depth level adds 20px
  const indent = 16 + depth * 20

  return (
    <>
      <div
        className={cn(
          'flex items-center justify-between py-2 pr-3 group transition-colors',
          hasSearch && !isHighlighted && 'opacity-20',
          isHighlighted && 'ring-2 ring-yellow-500 ring-inset z-10 relative',
          !hasSearch && 'hover:bg-black/5'
        )}
        style={{
          paddingLeft: indent + 'px',
          borderLeft: '2px solid ' + alpha(color, 0.15),
          background: isHighlighted ? 'rgba(250, 204, 21, 0.25)' : undefined,
        }}
      >
        {/* Left: chevron + colored dot + name */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {hasChildren ? (
            <button onClick={() => setUserOpen(!userOpen)} className="p-0.5 rounded hover:bg-muted text-muted-foreground touch-manipulation flex-shrink-0" aria-label={open ? 'Recolher' : 'Expandir'}>
              {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
          ) : (
            <span className="w-5 flex-shrink-0" />
          )}
          {/* Colored dot — inherits block color */}
          <span
            className="h-2.5 w-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: category.color || color }}
          />
          <button
            onClick={() => { if (isHighlighted) allProps.onClearSearch(); allProps.onEdit(category, tx) }}
            className="flex flex-col items-start text-left touch-manipulation min-w-0"
          >
            <span className="text-[13px] font-medium text-foreground flex items-center gap-1 truncate">
              {category.name}
              {isRecurring && (
                <span className="inline-flex items-center gap-0.5 text-[9px] text-cyan-600 bg-cyan-50 px-1 py-0.5 rounded">
                  <RefreshCw className="h-2 w-2" />{installmentsTotal ? installmentNumber + '/' + installmentsTotal : 'recorrente'}
                </span>
              )}
              {goalExceeded && (
                <span className="inline-flex items-center gap-0.5 text-[9px] text-rose-600 bg-rose-50 px-1 py-0.5 rounded">
                  <AlertTriangle className="h-2 w-2" />meta
                </span>
              )}
              {hasChildren && <span className="text-[9px] text-muted-foreground">({children.length})</span>}
            </span>
            {category.note && <span className="text-xs text-muted-foreground truncate">{category.note}</span>}
          </button>
        </div>
        {/* Right: actions + value */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button onClick={(e) => { e.stopPropagation(); allProps.onAddCategory(category.group, category.id) }} className="p-1.5 rounded-md hover:bg-black/5 transition-all touch-manipulation" aria-label="Adicionar sub-item" title="Adicionar sub-item">
            <Plus className="h-3 w-3" style={{ color }} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); allProps.onMoveCategory(category) }} className="p-1.5 rounded-md hover:bg-black/5 transition-all touch-manipulation" aria-label="Mover" title="Mover para outro grupo">
            <Move className="h-3 w-3" />
          </button>
          {allProps.onReorder && (
            <>
              <button onClick={(e) => { e.stopPropagation(); allProps.onReorder!(category.id, 'up') }} className="p-1 rounded-md hover:bg-black/5 transition-all touch-manipulation" aria-label="Subir" title="Mover para cima">
                <ArrowUp className="h-3 w-3" />
              </button>
              <button onClick={(e) => { e.stopPropagation(); allProps.onReorder!(category.id, 'down') }} className="p-1 rounded-md hover:bg-black/5 transition-all touch-manipulation" aria-label="Descer" title="Mover para baixo">
                <ArrowDown className="h-3 w-3" />
              </button>
            </>
          )}
          {isRecurring && (
            <button onClick={() => tx && tx.seriesId && allProps.onStopRecurring(tx.seriesId, tx.month)} className="p-1.5 rounded-md hover:bg-cyan-50 hover:text-cyan-600 transition-all touch-manipulation" aria-label="Parar recorrência" title="Parar recorrência">
              <RefreshCw className="h-3 w-3" />
            </button>
          )}
          <button onClick={() => { if (isHighlighted) allProps.onClearSearch(); allProps.onEdit(category, tx) }} className="px-2.5 py-1.5 rounded-md hover:bg-black/5 transition-colors touch-manipulation text-right">
            {displayValue === null ? (
              <span className="text-sm font-normal text-muted-foreground italic">--</span>
            ) : (
              <div className="flex flex-col items-end leading-tight">
                <span className="text-[13px] font-semibold tabular-nums" style={{ color }}>
                  {sign}{formatMoney(Math.abs(displayValue), category.currency)}
                </span>
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {category.currency === 'BRL' ? formatMoney(Math.abs(displayValue) / euroRate, 'EUR') : formatMoney(Math.abs(displayValue) * euroRate, 'BRL')}
                </span>
              </div>
            )}
          </button>
          <button onClick={() => allProps.onDeleteCategory(category)} className="p-1.5 rounded-md hover:bg-destructive/10 hover:text-destructive transition-all touch-manipulation" aria-label="Remover">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Children — indented with left border connector (tree style) */}
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
