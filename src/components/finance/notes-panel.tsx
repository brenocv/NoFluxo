'use client'

import { useEffect, useRef, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { NotebookPen, Loader2, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  year: number
  month: number
  user: string
  workbookId: string
}

export function NotesPanel({ year, month, user, workbookId }: Props) {
  const [text, setText] = useState('')
  const [isRecurring, setIsRecurring] = useState(false)
  const [isRecurringFrom, setIsRecurringFrom] = useState(false)
  const [sourceLabel, setSourceLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSaved = useRef<{ text: string; isRecurring: boolean }>({ text: '', isRecurring: false })

  useEffect(() => {
    let cancelled = false
    setLoaded(false)
    ;(async () => {
      try {
        const r = await fetch(`/api/notes?year=${year}&month=${month}&workbookId=${workbookId}`)
        if (!r.ok) throw new Error('fail')
        const data = await r.json()
        if (cancelled) return
        const t = data.note?.text ?? ''
        const recurring = data.note?.isRecurring ?? false
        setText(t)
        setIsRecurring(recurring)
        setIsRecurringFrom(data.isRecurringFrom ?? false)
        setSourceLabel(data.isRecurringFrom ? `${monthName(data.sourceMonth)}/${data.sourceYear}` : '')
        lastSaved.current = { text: t, isRecurring: recurring }
      } catch {
        if (cancelled) return
        setText(''); setIsRecurring(false); setIsRecurringFrom(false); setSourceLabel('')
        lastSaved.current = { text: '', isRecurring: false }
      } finally {
        if (!cancelled) setLoaded(true)
      }
    })()
    return () => { cancelled = true }
  }, [year, month])

  useEffect(() => {
    if (!loaded) return
    if (text === lastSaved.current.text && isRecurring === lastSaved.current.isRecurring) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaving(true)
      try {
        const r = await fetch('/api/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ year, month, text, user, isRecurring, workbookId }) })
        if (r.ok) { lastSaved.current = { text, isRecurring }; setIsRecurringFrom(false) }
      } catch {} finally { setSaving(false) }
    }, 800)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [text, isRecurring, loaded, year, month, user])

  return (
    <Card className="overflow-hidden shadow-sm border-amber-200/60 dark:border-amber-900/40">
      <div className="flex items-center justify-between px-3 py-2 bg-amber-50/80 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900/50">
        <div className="flex items-center gap-1.5 min-w-0">
          <NotebookPen className="h-3.5 w-3.5 text-amber-700 dark:text-amber-400 flex-shrink-0" />
          <span className="text-xs font-semibold text-amber-900 dark:text-amber-200">Caderninho</span>
          <span className="text-[10px] text-amber-700/70 dark:text-amber-400/60 truncate">{monthName(month)}/{year}</span>
          {isRecurringFrom && (
            <span className="inline-flex items-center gap-0.5 text-[9px] text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950/50 px-1 py-0.5 rounded flex-shrink-0">
              <RefreshCw className="h-2 w-2" />de {sourceLabel}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {saving && <Loader2 className="h-3 w-3 text-amber-700 dark:text-amber-400 animate-spin" />}
          <div className="flex items-center gap-1">
            <Label htmlFor="note-recurring" className="text-[10px] text-amber-800 dark:text-amber-300 cursor-pointer flex items-center gap-0.5">
              <RefreshCw className="h-2.5 w-2.5" />Recorrente
            </Label>
            <Switch id="note-recurring" checked={isRecurring} onCheckedChange={setIsRecurring} className="scale-75" />
          </div>
        </div>
      </div>
      <div className="relative bg-amber-50/20 dark:bg-amber-950/10" style={{ backgroundImage: `linear-gradient(to bottom, transparent 27px, oklch(0.85 0.05 90 / 0.5) 27px, oklch(0.85 0.05 90 / 0.5) 28px, transparent 28px)`, backgroundSize: '100% 28px', backgroundPosition: '0 6px' }}>
        <div className="absolute left-8 top-0 bottom-0 w-px bg-rose-300/60 dark:bg-rose-700/40" />
        <div className="absolute left-9 top-0 bottom-0 w-px bg-rose-200/40 dark:bg-rose-800/30" />
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Escreva aqui suas anotações do mês…&#10;Ex.: Nubank Kiki vence dia 11, lembrar de pagar o aluguel…" className={cn('relative w-full min-h-[120px] resize-y bg-transparent pl-12 pr-3 py-2 text-sm text-foreground leading-7 border-0 outline-none focus:outline-none placeholder:text-muted-foreground/60 placeholder:italic', isRecurringFrom && 'text-cyan-900 dark:text-cyan-200')} style={{ lineHeight: '28px' }} spellCheck={false} />
      </div>
      <div className="px-3 py-1.5 bg-amber-50/30 dark:bg-amber-950/20 border-t border-amber-200/50 dark:border-amber-900/30">
        <p className="text-[10px] text-amber-700/70 dark:text-amber-400/60">
          {saving ? 'Salvando…' : isRecurring ? 'Recorrente — aparece nos próximos meses' : isRecurringFrom ? `Editando cria nova anotação para ${monthName(month)}/${year}` : text.trim() ? 'Salvo automaticamente' : 'As anotações são salvas por mês e compartilhadas entre dispositivos'}
        </p>
      </div>
    </Card>
  )
}

function monthName(m: number) {
  return ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'][m - 1] ?? ''
}
