'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Download, Trash2, Upload, LogOut, Coins } from 'lucide-react'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onExportExcel?: () => void
  onOpenCurrencies?: () => void
  onDeleteAccount?: () => void
  onLogout?: () => void
  onBackup?: () => void
  onRestore?: () => void
  onResetValues?: () => void
  accountName?: string
}

export function SettingsDialog({
  open,
  onOpenChange,
  onExportExcel,
  onOpenCurrencies,
  onDeleteAccount,
  onLogout,
  onBackup,
  onRestore,
  onResetValues,
  accountName,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurações</DialogTitle>
          <DialogDescription className="sr-only">
            Acesse moedas, exportação, backup e gerenciamento de conta.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Currencies — opens the dedicated CurrenciesDialog */}
          {onOpenCurrencies && (
            <div className="space-y-2">
              <Label>Moedas</Label>
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => { onOpenCurrencies(); onOpenChange(false) }}
              >
                <Coins className="h-4 w-4" />
                Gerenciar moedas e cotações
              </Button>
              <p className="text-xs text-muted-foreground">
                Real (primária), Euro (secundária) e outras moedas. Escolha qual aparece ao lado do Real.
              </p>
            </div>
          )}

          {/* Excel export */}
          {onExportExcel && (
            <div className="space-y-2 pt-4 border-t border-border">
              <Label>Exportar planilha</Label>
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => { onExportExcel(); onOpenChange(false) }}
              >
                <Download className="h-4 w-4" />
                Exportar Excel do ano atual
              </Button>
            </div>
          )}

          {/* Backup / Restore / Reset */}
          <div className="space-y-2 pt-4 border-t border-border">
            <Label>Dados da planilha</Label>
            {onBackup && (
              <Button variant="outline" className="w-full justify-start gap-2" onClick={() => { onBackup(); onOpenChange(false) }}>
                <Download className="h-4 w-4" /> Exportar backup (JSON)
              </Button>
            )}
            {onRestore && (
              <Button variant="outline" className="w-full justify-start gap-2" onClick={() => { onRestore(); onOpenChange(false) }}>
                <Upload className="h-4 w-4" /> Restaurar backup
              </Button>
            )}
            {onResetValues && (
              <Button variant="outline" className="w-full justify-start gap-2 text-rose-500 border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-950/30" onClick={() => { onResetValues(); onOpenChange(false) }}>
                <Trash2 className="h-4 w-4" /> Zerar / Resetar planilha
              </Button>
            )}
          </div>

          {/* Logout */}
          {onLogout && (
            <div className="space-y-2 pt-4 border-t border-border">
              <Button variant="outline" className="w-full justify-start gap-2" onClick={() => { onLogout(); onOpenChange(false) }}>
                <LogOut className="h-4 w-4" /> Sair da conta
              </Button>
            </div>
          )}

          {/* Delete account */}
          {onDeleteAccount && (
            <div className="space-y-2 pt-4 border-t border-border">
              <Label>Conta: {accountName}</Label>
              <Button
                variant="outline"
                className="w-full justify-start gap-2 text-rose-500 border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                onClick={() => {
                  if (confirm(`Apagar a conta "${accountName}" e todos os seus dados? Esta ação não pode ser desfeita.`)) {
                    onDeleteAccount()
                  }
                }}
              >
                <Trash2 className="h-4 w-4" />
                Apagar esta conta
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
