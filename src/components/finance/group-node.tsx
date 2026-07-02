'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  Category,
  formatMoney,
  GroupTreeNode,
  computeNodeTotal,
  buildCategoryTree,
  computeCategoryNodeTotal,
  Transaction,
} from '@/lib/finance'
import {
  Plus, Trash2, ChevronDown, ChevronRight, Pencil, Clock, AlertTriangle, RefreshCw, Check,
  FolderPlus,
} from 'lucide-react'

interface Props {
  node: GroupTreeNode
  labels: Record<string, string>
  transactionsByCat: Record<string, Transaction | undefined>
  allCategories: Category[]
  euroRate: number
  onEdit: (category: Category, current: Transaction | undefined) => void
  onAddCategory: (group: string, parentCategoryId?: string | null) => void
  onDeleteCategory: (cat: Category) => void
  onRename: (key: string, value: string) => void
  onStopRecurring: (seriesId: string, currentMonth: number) => void
  onAddSubgroup: (parentKey: string) => void
  onDeleteSubgroup: (node: GroupTreeNode) => void
}

export function GroupNode(props: Props) {
  const { node, labels, transactionsByCat, euroRate, allCategories } = props
  const [open, setOpen] = useState(true)

  const total = computeNodeTotal(node, transactionsByCat, euroRate)
  const isTopLevel = node.isTopLevel
  const isIncome = node.key.startsWith('rendimentos')
  const isReserve = node.key === 'reservas'
  const isReceivable = node.isReceivable

  const totalSign =
    isReserve || isReceivable
      ? ''
      : isIncome
        ? (total >= 0 ? '+' : '−')
        : (total >= 0 ? '−' : '+')

  const totalColor =
    isIncome
      ? 'text-emerald-600'
      : (isReserve || isReceivable)
        ? 'text-amber-600'
        : 'text-rose-600'

  // Build category tree for direct categories in this group node
  const categoryTree = buildCategoryTree(node.categories, null)

  return (
    <Card
      className={cn('overflow-hidden shadow-sm', !isTopLevel && 'border-l-2 border-l-muted-foreground/20')}
      id={isTopLevel ? `group-${node.key}` : undefined}
      style={!isTopLevel ? { marginLeft: `${(node.depth - 1) * 8}px` } : undefined}
    >
      {/* Header */}
      <div className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 flex-1 touch-manipulation min-w-0"
        >
          <ChevronDown
            className={cn(
              'h-4 w-4 text-muted-foreground transition-transform flex-shrink-0',
              !open && '-rotate-90'
            )}
          />
          <span className={cn('truncate', isTopLevel ? 'font-semibold text-sm' : 'font-medium text-sm')}>
            {node.label}
          </span>
          {isReceivable && (
            <Badge variant="outline" className="h-5 px-1 text-[10px] gap-0.5 border-amber-300 bg-amber-50 text-amber-700 flex-shrink-0">
              <Clock className="h-2.5 w-2.5" />
              a receber
            </Badge>
          )}
          <span className="text-xs text-muted-foreground flex-shrink-0">
            ({countAll(node, allCategories)})
          </span>
        </button>
        <div className="flex items-center gap-1 flex-shrink-0">
          <RenameButton
            currentLabel={node.label}
            onRename={(v) => props.onRename(
              isTopLevel ? `group:${node.key}` : `subgroup:${node.key}`,
              v
            )}
            small={!isTopLevel}
          />
          <button
            onClick={(e) => { e.stopPropagation(); props.onAddSubgroup(node.key) }}
            className="p-1 rounded-md hover:bg-muted text-muted-foreground/50 hover:text-foreground transition-colors touch-manipulation"
            aria-label="Novo subgrupo"
            title="Criar subgrupo aqui"
          >
            <FolderPlus className="h-3.5 w-3.5" />
          </button>
          {!isTopLevel && (
            <button
              onClick={(e) => { e.stopPropagation(); props.onDeleteSubgroup(node) }}
              className="p-1 rounded-md hover:bg-destructive/10 hover:text-destructive transition-colors touch-manipulation"
              aria-label="Remover subgrupo"
              title="Remover subgrupo (categorias movidas para o grupo pai)"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          <span className={cn('text-sm font-semibold tabular-nums', totalColor)}>
            {totalSign}
            {formatMoney(Math.abs(total), 'BRL')}
            <span className="text-[10px] text-muted-foreground ml-1 font-normal">
              ({formatMoney(Math.abs(total) / euroRate, 'EUR')})
            </span>
          </span>
        </div>
      </div>

      {/* Body */}
      {open && (
        <div>
          {/* Direct categories (recursive tree) */}
          {categoryTree.length > 0 && (
            <div className="divide-y divide-border border-t border-border">
              {categoryTree.map((catNode) => (
                <CategoryNodeRow
                  key={catNode.category.id}
                  catNode={catNode}
                  depth={0}
                  allProps={props}
                />
              ))}
            </div>
          )}

          {/* Child subgroups (recursive) */}
          {node.children.map((child) => (
            <div key={child.key} className="border-t border-border">
              <GroupNode
                {...props}
                node={child}
              />
            </div>
          ))}

          {/* Add category button */}
          <button
            onClick={() => props.onAddCategory(node.key, null)}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs text-muted-foreground hover:bg-muted/50 transition-colors touch-manipulation border-t border-border"
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar categoria
          </button>
        </div>
      )}
    </Card>
  )
}

function countAll(node: GroupTreeNode, allCategories: Category[]): number {
  // Count direct categories (including nested children) in this group
  const directCount = node.categories.length
  const childCount = node.children.reduce((acc, c) => acc + countAll(c, allCategories), 0)
  return directCount + childCount
}

// ---- Recursive category node ----

function CategoryNodeRow({
  catNode,
  depth,
  allProps,
}: {
  catNode: import('@/lib/finance').CategoryNode
  depth: number
  allProps: Props
}) {
  const { category, children } = catNode
  const [open, setOpen] = useState(false) // collapsed by default
  const { transactionsByCat, euroRate } = allProps

  const tx = transactionsByCat[category.id]
  const value = tx?.value ?? null
  const isRecurring = tx?.isRecurring ?? false
  const installmentNumber = tx?.installmentNumber ?? null
  const installmentsTotal = tx?.installmentsTotal ?? null
  const hasChildren = children.length > 0

  const goalExceeded = category.monthlyGoal !== null && value !== null && category.type === 'EXPENSE' && value > category.monthlyGoal

  // Total including children
  const totalWithChildren = hasChildren
    ? computeCategoryNodeTotal(catNode, transactionsByCat, euroRate)
    : null

  const sign =
    value === null && totalWithChildren === null
      ? ''
      : category.type === 'RESERVE' || category.group === 'rendimentos.valores_a_receber'
        ? ((value ?? totalWithChildren ?? 0) < 0 ? '−' : '')
        : category.type === 'INCOME'
          ? ((value ?? totalWithChildren ?? 0) >= 0 ? '+' : '−')
          : ((value ?? totalWithChildren ?? 0) >= 0 ? '−' : '+')

  const displayValue = totalWithChildren !== null ? totalWithChildren : value
  const displayCurrency = category.currency

  return (
    <>
      <div
        className="flex items-center justify-between px-3 py-2.5 group hover:bg-muted/30 transition-colors"
        style={depth > 0 ? { paddingLeft: `${12 + depth * 20}px` } : undefined}
      >
        {/* Left: chevron (if has children) + name */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {hasChildren ? (
            <button
              onClick={() => setOpen((o) => !o)}
              className="p-0.5 rounded hover:bg-muted text-muted-foreground touch-manipulation flex-shrink-0"
              aria-label={open ? 'Recolher' : 'Expandir'}
            >
              {open
                ? <ChevronDown className="h-3.5 w-3.5" />
                : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
          ) : (
            <span className="w-5 flex-shrink-0" />
          )}
          <button
            onClick={() => allProps.onEdit(category, tx)}
            className="flex flex-col items-start text-left touch-manipulation min-w-0"
          >
            <span className="text-sm font-medium text-foreground flex items-center gap-1 truncate">
              {category.name}
              {isRecurring && (
                <span className="inline-flex items-center gap-0.5 text-[9px] text-cyan-600 bg-cyan-50 px-1 py-0.5 rounded">
                  <RefreshCw className="h-2 w-2" />
                  {installmentsTotal ? `${installmentNumber}/${installmentsTotal}` : 'recorrente'}
                </span>
              )}
              {goalExceeded && (
                <span className="inline-flex items-center gap-0.5 text-[9px] text-rose-600 bg-rose-50 px-1 py-0.5 rounded">
                  <AlertTriangle className="h-2 w-2" />
                  meta
                </span>
              )}
              {hasChildren && (
                <span className="text-[9px] text-muted-foreground">
                  ({children.length})
                </span>
              )}
            </span>
            {category.note && (
              <span className="text-xs text-muted-foreground truncate">{category.note}</span>
            )}
          </button>
        </div>

        {/* Right: value + actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Add sub-item button */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              allProps.onAddCategory(category.group, category.id)
            }}
            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-all touch-manipulation"
            aria-label="Adicionar sub-item"
            title="Adicionar sub-item dentro desta categoria"
          >
            <Plus className="h-3 w-3" />
          </button>
          {isRecurring && (
            <button
              onClick={() => tx?.seriesId && allProps.onStopRecurring(tx.seriesId, tx.month)}
              className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-cyan-50 hover:text-cyan-600 transition-all touch-manipulation"
              aria-label="Parar recorrência"
              title="Parar recorrência (remove parcelas futuras)"
            >
              <RefreshCw className="h-3 w-3" />
            </button>
          )}
          <button
            onClick={() => allProps.onEdit(category, tx)}
            className="px-3 py-1.5 rounded-md hover:bg-muted transition-colors touch-manipulation text-right"
          >
            {displayValue === null ? (
              <span className="text-sm font-normal text-muted-foreground italic">—</span>
            ) : (
              <div className="flex flex-col items-end leading-tight">
                <span
                  className={cn(
                    'text-sm font-semibold tabular-nums',
                    category.type === 'INCOME'
                      ? 'text-emerald-600'
                      : category.type === 'RESERVE' || category.group === 'rendimentos.valores_a_receber'
                        ? 'text-amber-600'
                        : 'text-rose-600'
                  )}
                >
                  {sign}{formatMoney(Math.abs(displayValue), displayCurrency)}
                  {hasChildren && totalWithChildren !== null && value !== null && (
                    <span className="text-[9px] text-muted-foreground ml-1 font-normal">
                      (com sub)
                    </span>
                  )}
                </span>
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {displayCurrency === 'BRL'
                    ? formatMoney(Math.abs(displayValue) / euroRate, 'EUR')
                    : formatMoney(Math.abs(displayValue) * euroRate, 'BRL')}
                </span>
              </div>
            )}
          </button>
          <button
            onClick={() => allProps.onDeleteCategory(category)}
            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-destructive/10 hover:text-destructive transition-all touch-manipulation"
            aria-label="Remover categoria"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Children — indented with left border (travessão visual) */}
      {hasChildren && open && (
        <div
          className="border-l-2 border-l-muted-foreground/15 ml-4 bg-muted/10"
        >
          {children.map((child) => (
            <CategoryNodeRow
              key={child.category.id}
              catNode={child}
              depth={depth + 1}
              allProps={allProps}
            />
          ))}
          {/* Add sub-item at the bottom of expanded children */}
          <button
            onClick={() => allProps.onAddCategory(category.group, category.id)}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] text-muted-foreground hover:bg-muted/30 transition-colors touch-manipulation"
            style={{ paddingLeft: `${12 + (depth + 1) * 20}px` }}
          >
            <Plus className="h-3 w-3" />
            Adicionar sub-item em {category.name}
          </button>
        </div>
      )}
    </>
  )
}

function RenameButton({
  currentLabel, onRename, small,
}: {
  currentLabel: string
  onRename: (v: string) => void
  small?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(currentLabel)

  return (
    <Popover open={open} onOpenChange={(o) => {
      setOpen(o)
      if (o) setValue(currentLabel)
    }}>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className="p-1 rounded-md hover:bg-muted text-muted-foreground/50 hover:text-foreground transition-colors touch-manipulation"
          aria-label="Renomear"
        >
          <Pencil className={small ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Renomear</label>
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={currentLabel}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onRename(value.trim())
                setOpen(false)
              }
            }}
          />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={() => {
                onRename(value.trim())
                setOpen(false)
              }}
            >
              <Check className="h-3 w-3 mr-1" />
              Salvar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
