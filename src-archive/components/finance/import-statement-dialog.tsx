'use client'

import { useState, useRef } from 'react'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select'
import { Upload, AlertCircle, FileText, CheckCircle2, Loader2, MoreVertical, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatBRL, MONTHS_PT, MONTHS_PT_LONG } from '@/lib/finance'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  workbookId: string
  year: number
  month: number
  user: string
  onImported: () => void
}

interface ParsedTx {
  description: string
  amount: number
  date: string
}

interface MatchedTx extends ParsedTx {
  suggestedCategoryId: string | null
  suggestedCategoryName: string | null
  matched: boolean
  selectedCategoryId: string | null
}

interface CategoryOption {
  id: string
  name: string
  group: string
  type: string
  currency: string
}

export function ImportStatementDialog({ open, onOpenChange, workbookId, year, month, user, onImported }: Props) {
  const [step, setStep] = useState<'upload' | 'matching' | 'done'>('upload')
  const [parsedTxs, setParsedTxs] = useState<MatchedTx[]>([])
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [fileName, setFileName] = useState('')
  const [selectedMonth, setSelectedMonth] = useState(month)
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function reset() {
    setStep('upload')
    setParsedTxs([])
    setCategories([])
    setError('')
    setFileName('')
    setExpandedIdx(null)
    setSelectedMonth(month)
    if (fileRef.current) fileRef.current.value = ''
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setError('')

    const reader = new FileReader()
    reader.onload = (ev) => {
      const content = String(ev.target?.result || '')
      try {
        let txs: ParsedTx[] = []

        if (file.name.toLowerCase().endsWith('.csv') || content.includes(';') || content.includes(',')) {
          txs = parseCSV(content)
        } else if (content.includes('<OFX>') || content.includes('<BANKTRANLIST>') || content.includes('<STMTTRN>')) {
          txs = parseOFX(content)
        } else {
          txs = parseCSV(content)
        }

        if (txs.length === 0) {
          setError('Nenhuma transação encontrada no arquivo. Verifique o formato.')
          return
        }

        setLoading(true)
        fetch('/api/import-statement', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workbookId, year, month: selectedMonth, transactions: txs }),
        })
          .then((r) => r.json())
          .then((data) => {
            if (data.error) {
              setError(data.error)
              return
            }
            setCategories(data.categories || [])
            const matched = (data.transactions || []).map((tx: any) => ({
              ...tx,
              selectedCategoryId: tx.suggestedCategoryId,
            }))
            setParsedTxs(matched)
            setStep('matching')
          })
          .catch(() => setError('Erro ao processar arquivo'))
          .finally(() => setLoading(false))
      } catch (err: any) {
        setError('Erro ao ler arquivo: ' + (err.message || 'formato inválido'))
      }
    }
    reader.readAsText(file)
  }

  function handleCategoryChange(idx: number, categoryId: string) {
    setParsedTxs((prev) => prev.map((tx, i) => i === idx ? { ...tx, selectedCategoryId: categoryId || null } : tx))
  }

  async function handleImport() {
    const items = parsedTxs
      .filter((tx) => tx.selectedCategoryId)
      .map((tx) => ({
        categoryId: tx.selectedCategoryId!,
        amount: tx.amount,
        description: tx.description,
      }))

    if (items.length === 0) {
      setError('Selecione ao menos uma categoria para importar')
      return
    }

    setSaving(true)
    setError('')
    try {
      const r = await fetch('/api/import-statement', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workbookId, year, month: selectedMonth, user, items }),
      })
      if (!r.ok) throw new Error('Falha')
      setStep('done')
      onImported()
    } catch (e: any) {
      setError(e.message || 'Erro ao importar')
    } finally {
      setSaving(false)
    }
  }

  const matchedCount = parsedTxs.filter((tx) => tx.selectedCategoryId).length

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o) }}>
      <DialogContent className="max-w-[95vw] w-full max-h-[95vh] p-4 sm:p-6 overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Importar extrato
          </DialogTitle>
          <DialogDescription className="sr-only">
            Faça upload de um extrato em formato OFX ou CSV para importar transações.
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4 py-2 overflow-y-auto">
            {/* Month selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Mês de destino</Label>
              <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS_PT_LONG.map((m, i) => (
                    <SelectItem key={i} value={String(i + 1)}>
                      {m} / {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-lg bg-muted/50 p-3 space-y-1.5">
              <p className="text-xs font-medium">Como usar:</p>
              <ol className="text-[11px] text-muted-foreground space-y-0.5 list-decimal list-inside">
                <li>Baixe o extrato do banco em <strong>OFX</strong> ou <strong>CSV</strong></li>
                <li>O app tenta casar cada transação com uma categoria</li>
                <li>Confirme ou ajuste as categorias antes de importar</li>
              </ol>
            </div>

            <input ref={fileRef} type="file" accept=".ofx,.csv,.txt" onChange={handleFileChange} className="hidden" />
            <Button onClick={() => fileRef.current?.click()} variant="outline" className="w-full" disabled={loading}>
              {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processando…</> : <><Upload className="h-4 w-4 mr-2" />Selecionar arquivo OFX/CSV</>}
            </Button>

            {fileName && !loading && !error && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground truncate">
                <FileText className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{fileName}</span>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/30 p-2.5 rounded-lg">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}
          </div>
        )}

        {step === 'matching' && (
          <div className="flex flex-col flex-1 overflow-hidden py-2">
            <div className="flex items-center justify-between flex-shrink-0 mb-2">
              <span className="text-xs font-medium">
                {parsedTxs.length} transações → {MONTHS_PT[selectedMonth - 1]}/{year}
              </span>
              <span className={cn(
                'text-[10px] px-2 py-0.5 rounded-full flex-shrink-0',
                matchedCount === parsedTxs.length ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
              )}>
                {matchedCount}/{parsedTxs.length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1 pr-1 -mr-1">
              {parsedTxs.map((tx, idx) => {
                const isExpanded = expandedIdx === idx
                return (
                  <div
                    key={idx}
                    className={cn(
                      'rounded-lg border p-2',
                      tx.selectedCategoryId ? 'border-border bg-card' : 'border-amber-300 bg-amber-50/50 dark:bg-amber-950/20'
                    )}
                  >
                    {/* Main row — everything fits, no horizontal scroll */}
                    <div className="flex items-center gap-1.5">
                      {/* Three dots to expand/collapse full description */}
                      <button
                        onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                        className="p-0.5 rounded hover:bg-muted flex-shrink-0 touch-manipulation"
                        aria-label={isExpanded ? 'Recolher' : 'Expandir descrição'}
                      >
                        <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>

                      {/* Description — truncated with "..." */}
                      <div className="flex-1 min-w-0">
                        {isExpanded ? (
                          <div className="text-xs font-medium break-words">{tx.description}</div>
                        ) : (
                          <div className="text-xs font-medium truncate">{tx.description}</div>
                        )}
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <span className="flex-shrink-0">{tx.date}</span>
                          <span className="flex-shrink-0">•</span>
                          <span className={cn('flex-shrink-0 font-medium', tx.amount < 0 ? 'text-rose-600' : 'text-emerald-600')}>
                            {formatBRL(Math.abs(tx.amount))}
                          </span>
                          <span className="text-muted-foreground">{tx.amount < 0 ? '↓' : '↑'}</span>
                        </div>
                      </div>

                      {/* Category selector — compact */}
                      <Select
                        value={tx.selectedCategoryId || ''}
                        onValueChange={(v) => handleCategoryChange(idx, v)}
                      >
                        <SelectTrigger className="w-32 sm:w-40 h-7 text-[11px] flex-shrink-0">
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                          {categories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id} className="text-xs">
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )
              })}
            </div>

            {error && (
              <div className="flex items-center gap-2 text-xs text-rose-600 flex-shrink-0 mt-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />{error}
              </div>
            )}
          </div>
        )}

        {step === 'done' && (
          <div className="py-8 text-center space-y-3">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
            <p className="text-base font-medium">Importação concluída!</p>
            <p className="text-sm text-muted-foreground">
              {matchedCount} transações importadas para {MONTHS_PT[selectedMonth - 1]}/{year}
            </p>
          </div>
        )}

        <DialogFooter className="flex-shrink-0">
          {step === 'upload' && (
            <Button variant="outline" onClick={() => { reset(); onOpenChange(false) }}>Cancelar</Button>
          )}
          {step === 'matching' && (
            <>
              <Button variant="outline" onClick={() => { reset(); onOpenChange(false) }}>Cancelar</Button>
              <Button onClick={handleImport} disabled={saving || matchedCount === 0} size="sm">
                {saving ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />…</> : <>Importar ({matchedCount})</>}
              </Button>
            </>
          )}
          {step === 'done' && (
            <Button onClick={() => { reset(); onOpenChange(false) }}>Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---- OFX Parser ----
function parseOFX(content: string): ParsedTx[] {
  const txs: ParsedTx[] = []
  const regex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi
  let match: RegExpExecArray | null

  while ((match = regex.exec(content)) !== null) {
    const block = match[1]
    const name = block.match(/<NAME>([^<]+)/i)?.[1]?.trim() || ''
    const amount = parseFloat(block.match(/<TRNAMT>([^<]+)/i)?.[1] || '0') || 0
    const dateRaw = block.match(/<DTPOSTED>([^<]+)/i)?.[1]?.trim() || ''

    let date = dateRaw
    if (dateRaw.length >= 8) {
      date = dateRaw.substring(6, 8) + '/' + dateRaw.substring(4, 6) + '/' + dateRaw.substring(0, 4)
    }

    if (name) {
      txs.push({ description: name, amount, date })
    }
  }

  return txs
}

// ---- CSV Parser ----
function parseCSV(content: string): ParsedTx[] {
  const txs: ParsedTx[] = []
  const lines = content.split('\n').filter((l) => l.trim())

  if (lines.length === 0) return txs

  const delimiter = lines[0].includes(';') ? ';' : ','

  const header = lines[0].toLowerCase().split(delimiter).map((h) => h.trim().replace(/"/g, ''))

  let descIdx = -1, amountIdx = -1, dateIdx = -1

  for (let i = 0; i < header.length; i++) {
    const h = header[i]
    if (h.includes('descricao') || h.includes('descrição') || h.includes('description') || h.includes('memo') || h.includes('historico') || h.includes('histórico')) {
      descIdx = i
    }
    if (h.includes('valor') || h.includes('amount') || h.includes('montant')) {
      amountIdx = i
    }
    if (h.includes('data') || h.includes('date')) {
      dateIdx = i
    }
  }

  if (descIdx === -1 || amountIdx === -1) {
    const firstLine = lines[0].split(delimiter)
    if (firstLine.length >= 3) {
      dateIdx = 0
      descIdx = 1
      amountIdx = 2
    } else if (firstLine.length >= 2) {
      descIdx = 0
      amountIdx = 1
    }
    for (let i = 0; i < lines.length; i++) {
      const parts = lines[i].split(delimiter).map((p) => p.trim().replace(/"/g, ''))
      if (descIdx >= 0 && amountIdx >= 0 && parts[descIdx] && parts[amountIdx]) {
        const amount = parseAmount(parts[amountIdx])
        if (!isNaN(amount)) {
          txs.push({
            description: parts[descIdx],
            amount,
            date: dateIdx >= 0 ? parts[dateIdx] : '',
          })
        }
      }
    }
    return txs
  }

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(delimiter).map((p) => p.trim().replace(/"/g, ''))
    if (parts.length <= Math.max(descIdx, amountIdx)) continue

    const description = parts[descIdx] || ''
    const amount = parseAmount(parts[amountIdx] || '0')
    const date = dateIdx >= 0 ? parts[dateIdx] : ''

    if (description && !isNaN(amount)) {
      txs.push({ description, amount, date })
    }
  }

  return txs
}

function parseAmount(s: string): number {
  s = s.trim().replace(/\s/g, '').replace(/R\$/i, '').replace(/€/i, '')

  if (s.includes(',') && s.includes('.')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.')
    } else {
      s = s.replace(/,/g, '')
    }
  } else if (s.includes(',')) {
    s = s.replace(',', '.')
  }

  return parseFloat(s) || 0
}
