'use client'

import { useRef, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Download, Upload, AlertTriangle, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onExport: () => Promise<void>
  onImport: (file: File, mode: 'replace' | 'merge') => Promise<void>
}

export function BackupDialog({ open, onOpenChange, onExport, onImport }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('replace')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleExport() {
    setBusy(true)
    try {
      await onExport()
    } finally {
      setBusy(false)
    }
  }

  async function handleImport() {
    if (!selectedFile) return
    setBusy(true)
    try {
      await onImport(selectedFile, importMode)
      setSelectedFile(null)
      if (fileRef.current) fileRef.current.value = ''
      onOpenChange(false)
    } finally {
      setBusy(false)
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) setSelectedFile(f)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Backup & Restauração</DialogTitle>
          <DialogDescription className="sr-only">
            Exporte ou importe um backup completo em JSON.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Export */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Exportar backup</h3>
            <p className="text-xs text-muted-foreground">
              Baixa um arquivo JSON com todas as categorias, transações, anotações e configurações de todos os anos.
            </p>
            <Button onClick={handleExport} disabled={busy} className="w-full" variant="outline">
              <Download className="h-4 w-4 mr-2" />
              {busy ? 'Exportando…' : 'Baixar backup JSON'}
            </Button>
          </div>

          {/* Separator */}
          <div className="border-t border-border" />

          {/* Import */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Restaurar backup</h3>
            <p className="text-xs text-muted-foreground">
              Selecione um arquivo JSON de backup previamente exportado.
            </p>

            {/* Mode selector */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setImportMode('replace')}
                className={cn(
                  'p-2.5 rounded-lg border-2 text-left transition-all touch-manipulation',
                  importMode === 'replace'
                    ? 'border-rose-400 bg-rose-50 dark:bg-rose-950/30'
                    : 'border-border bg-muted/50'
                )}
              >
                <div className="text-xs font-semibold flex items-center gap-1">
                  {importMode === 'replace' && <Check className="h-3 w-3" />}
                  Substituir tudo
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  Apaga tudo e restaura do backup
                </div>
              </button>
              <button
                onClick={() => setImportMode('merge')}
                className={cn(
                  'p-2.5 rounded-lg border-2 text-left transition-all touch-manipulation',
                  importMode === 'merge'
                    ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30'
                    : 'border-border bg-muted/50'
                )}
              >
                <div className="text-xs font-semibold flex items-center gap-1">
                  {importMode === 'merge' && <Check className="h-3 w-3" />}
                  Mesclar
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  Adiciona só o que falta
                </div>
              </button>
            </div>

            {importMode === 'replace' && (
              <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 p-2 flex gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-amber-800 dark:text-amber-300">
                  <strong>Atenção:</strong> o modo "Substituir tudo" apaga TODOS os dados atuais antes de restaurar. Esta ação não pode ser desfeita.
                </p>
              </div>
            )}

            {/* File picker */}
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button
              onClick={() => fileRef.current?.click()}
              variant="outline"
              className="w-full"
              disabled={busy}
            >
              <Upload className="h-4 w-4 mr-2" />
              {selectedFile ? selectedFile.name : 'Selecionar arquivo JSON…'}
            </Button>

            {selectedFile && (
              <Button
                onClick={handleImport}
                disabled={busy}
                className="w-full"
                variant={importMode === 'replace' ? 'destructive' : 'default'}
              >
                {busy ? 'Importando…' : importMode === 'replace' ? 'Substituir tudo' : 'Mesclar dados'}
              </Button>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
