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
  Transaction,
} from '@/lib/finance'
import {
  Plus, Trash2, ChevronDown, Pencil, Clock, AlertTriangle, RefreshCw, Check,
  FolderPlus,
} from 'lucide-react'

interface Props {
  node: GroupTreeNode
  labels: Record<string, string>
  transactionsByCat: Record<string, Transaction | undefined>
  euroRate: number
  onEdit: (category: Category, current: Transaction | undefined) => void
  onAddCategory: (group: string) => void
  onDeleteCategory: (cat: Category) => void
  onRename: (key: string, value: string) => void
  onStopRecurring: (seriesId: string, currentMonth: number) => void
  onAddSubgroup: (parentKey: string) => void
  onDeleteSubgroup: (node: GroupTreeNode) => void
}

export function GroupNode(props: Props) {
  const { node, labels, transactionsByCat, euroRate } = props
  const [open, setOpen] = useState(true)

  const total = computeNodeTotal(node, transactionsByCat, euroRate)
  const isTopLevel = node.isTopLevel
  const isIncome = node.key.startsWith('rendimentos')
  const isReserve = node.key === 'reservas'
  const isReceivable = node.isReceivable

  // Sign for the total
  const totalSign =
    isReserve || isReceivable
      ? ''
      : isIncome
        ? (total >= 0 ? '+' : '−')
        : (total >= 0 ? '−' : '+')

  // Color
  const totalColor =
    isIncome
      ? 'text-emerald-600'
      : (isReserve || isReceivable)
        ? 'text-amber-600'
        : 'text-rose-600'

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
            ({countAll(node)})
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
          {/* Add subgroup button */}
          <button
            onClick={(e) => { e.stopPropagation(); props.onAddSubgroup(node.key) }}
            className="p-1 rounded-md hover:bg-muted text-muted-foreground/50 hover:text-foreground transition-colors touch-manipulation"
            aria-label="Novo subgrupo"
            title="Criar subgrupo aqui"
          >
            <FolderPlus className="h-3.5 w-3.5" />
          </button>
          {/* Delete user-created subgroup */}
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
          {/* Direct categories */}
          {node.categories.length > 0 && (
            <div className="divide-y divide-border border-t border-border">
              {node.categories.map((cat) => (
                <CategoryRow
                  key={cat.id}
                  cat={cat}
                  tx={transactionsByCat[cat.id]}
                  euroRate={euroRate}
                  onEdit={props.onEdit}
                  onDelete={props.onDeleteCategory}
                  onStopRecurring={props.onStopRecurring}
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
            onClick={() => props.onAddCategory(node.key)}
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

function countAll(node: GroupTreeNode): number {
  return node.categories.length + node.children.reduce((acc, c) => acc + countAll(c), 0)
}

function CategoryRow({
  cat, tx, euroRate, onEdit, onDelete, onStopRecurring,
}: {
  cat: Category
  tx: Transaction | undefined
  euroRate: number
  onEdit: (c: Category, t: Transaction | undefined) => void
  onDelete: (c: Category) => void
  onStopRecurring: (s: string, m: number) => void
}) {
  const value = tx?.value ?? null
  const isRecurring = tx?.isRecurring ?? false
  const installmentNumber = tx?.installmentNumber ?? null
  const installmentsTotal = tx?.installmentsTotal ?? null

  const goalExceeded = cat.monthlyGoal !== null && value !== null && cat.type === 'EXPENSE' && value > cat.monthlyGoal

  const sign =
    value === null
      ? ''
      : cat.type === 'RESERVE' || cat.group === 'rendimentos.valores_a_receber'
        ? (value < 0 ? '−' : '')
        : cat.type === 'INCOME'
          ? (value >= 0 ? '+' : '−')
          : (value >= 0 ? '−' : '+')

  return (
    <div className="flex items-center justify-between px-3 py-2.5 group">
      <button
        onClick={() => onEdit(cat, tx)}
        className="flex-1 flex flex-col items-start text-left touch-manipulation min-w-0"
      >
        <span className="text-sm font-medium text-foreground flex items-center gap-1">
          {cat.name}
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
        </span>
        {cat.note && (
          <span className="text-xs text-muted-foreground truncate">{cat.note}</span>
        )}
      </button>
      <div className="flex items-center gap-1">
        {isRecurring && (
          <button
            onClick={() => tx?.seriesId && onStopRecurring(tx.seriesId, tx.month)}
            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-cyan-50 hover:text-cyan-600 transition-all touch-manipulation"
            aria-label="Parar recorrência"
            title="Parar recorrência (remove parcelas futuras)"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
        )}
        <button
          onClick={() => onEdit(cat, tx)}
          className="px-3 py-1.5 rounded-md hover:bg-muted transition-colors touch-manipulation text-right"
        >
          {value === null ? (
            <span className="text-sm font-normal text-muted-foreground italic">—</span>
          ) : (
            <div className="flex flex-col items-end leading-tight">
              <span
                className={cn(
                  'text-sm font-semibold tabular-nums',
                  cat.type === 'INCOME'
                    ? 'text-emerald-600'
                    : cat.type === 'RESERVE' || cat.group === 'rendimentos.valores_a_receber'
                      ? 'text-amber-600'
                      : 'text-rose-600'
                )}
              >
                {sign}{formatMoney(Math.abs(value), cat.currency)}
              </span>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {cat.currency === 'BRL'
                  ? formatMoney(Math.abs(value) / euroRate, 'EUR')
                  : formatMoney(Math.abs(value) * euroRate, 'BRL')}
              </span>
            </div>
          )}
        </button>
        <button
          onClick={() => onDelete(cat)}
          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-destructive/10 hover:text-destructive transition-all touch-manipulation"
          aria-label="Remover categoria"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
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
