'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { Plus, Pencil, Trash2, Check, FileSpreadsheet, Copy } from 'lucide-react'

interface Workbook {
  id: string
  name: string
  sortOrder: number
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentWorkbookId: string
  onSelect: (id: string) => void
  onCreate: (name: string, copyFrom?: string) => Promise<void>
  onRename: (id: string, name: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export function WorkbookSwitcher({
  open, onOpenChange, currentWorkbookId, onSelect, onCreate, onRename, onDelete,
}: Props) {
  const [workbooks, setWorkbooks] = useState<Workbook[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [copyFrom, setCopyFrom] = useState(true)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const r = await fetch('/api/workbooks')
        if (!r.ok) throw new Error('fail')
        const data = await r.json()
        if (cancelled) return
        setWorkbooks(data.workbooks)
      } catch {
        if (cancelled) return
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [open])

  async function handleCreate() {
    if (!newName.trim()) return
    setCreating(true)
    try {
      await onCreate(newName.trim(), copyFrom ? currentWorkbookId : undefined)
      setNewName('')
      setCreating(false)
      // Refresh list
      const r = await fetch('/api/workbooks')
      const data = await r.json()
      setWorkbooks(data.workbooks)
    } finally {
      setCreating(false)
    }
  }

  async function handleRename(id: string) {
    if (!editName.trim()) return
    await onRename(id, editName.trim())
    setEditingId(null)
    const r = await fetch('/api/workbooks')
    const data = await r.json()
    setWorkbooks(data.workbooks)
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Remover a planilha "${name}"? Todas as categorias e transações serão perdidas.`)) return
    await onDelete(id)
    const r = await fetch('/api/workbooks')
    const data = await r.json()
    setWorkbooks(data.workbooks)
    // If we deleted the current one, switch to the first available
    if (id === currentWorkbookId && data.workbooks.length > 0) {
      onSelect(data.workbooks[0].id)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Planilhas
          </DialogTitle>
          <DialogDescription className="sr-only">
            Selecione, crie ou renomeie planilhas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          {/* List of workbooks */}
          {loading ? (
            <div className="text-center py-8 text-sm text-muted-foreground">Carregando…</div>
          ) : (
            workbooks.map((wb) => (
              <div
                key={wb.id}
                className={cn(
                  'flex items-center justify-between rounded-lg border-2 p-2.5 transition-all',
                  wb.id === currentWorkbookId
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-muted/50'
                )}
              >
                {editingId === wb.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && handleRename(wb.id)}
                      className="h-8 text-sm"
                    />
                    <Button size="sm" className="h-8 px-2" onClick={() => handleRename(wb.id)}>
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        onSelect(wb.id)
                        onOpenChange(false)
                      }}
                      className="flex items-center gap-2 flex-1 text-left min-w-0 touch-manipulation"
                    >
                      <FileSpreadsheet className={cn('h-4 w-4 flex-shrink-0', wb.id === currentWorkbookId ? 'text-primary' : 'text-muted-foreground')} />
                      <span className={cn('text-sm font-medium truncate', wb.id === currentWorkbookId && 'text-primary')}>
                        {wb.name}
                      </span>
                      {wb.id === currentWorkbookId && (
                        <span className="text-[9px] text-primary bg-primary/10 px-1.5 py-0.5 rounded">atual</span>
                      )}
                    </button>
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      <button
                        onClick={() => { setEditingId(wb.id); setEditName(wb.name) }}
                        className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors touch-manipulation"
                        aria-label="Renomear"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      {workbooks.length > 1 && (
                        <button
                          onClick={() => handleDelete(wb.id, wb.name)}
                          className="p-1.5 rounded-md hover:bg-destructive/10 hover:text-destructive transition-colors touch-manipulation"
                          aria-label="Remover"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))
          )}

          {/* Separator */}
          <div className="border-t border-border my-2" />

          {/* Create new */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Plus className="h-3 w-3" />
              Nova planilha
            </Label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ex.: Vitória 2026, Viagem Europa…"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={copyFrom}
                onChange={(e) => setCopyFrom(e.target.checked)}
                className="h-3.5 w-3.5"
              />
              <Copy className="h-3 w-3" />
              Copiar estrutura da planilha atual (categorias e subgrupos, sem valores)
            </label>
            <Button
              onClick={handleCreate}
              disabled={!newName.trim() || creating}
              size="sm"
              className="w-full"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              {creating ? 'Criando…' : 'Criar planilha'}
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
