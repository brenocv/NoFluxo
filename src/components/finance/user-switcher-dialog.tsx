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
import { UserPlus, Check, X } from 'lucide-react'

interface Props {
  open: boolean
  currentUser: string
  knownUsers: string[]
  onOpenChange: (open: boolean) => void
  onSelect: (name: string) => void
  onCreate: (name: string) => void
  onLogout: () => void
}

export function UserSwitcherDialog({
  open, currentUser, knownUsers, onOpenChange, onSelect, onCreate, onLogout,
}: Props) {
  const [mode, setMode] = useState<'select' | 'create'>('select')
  const [newName, setNewName] = useState('')

  useEffect(() => {
    if (open) {
      setMode('select')
      setNewName('')
    }
  }, [open])

  function handleCreate() {
    const name = newName.trim()
    if (!name) return
    onCreate(name)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Você é {currentUser}</DialogTitle>
          <DialogDescription className="sr-only">
            Troque de usuário, crie um novo ou saia da conta.
          </DialogDescription>
        </DialogHeader>

        {mode === 'select' ? (
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Trocar de usuário</Label>
              <div className="grid grid-cols-2 gap-2">
                {knownUsers.map((u) => (
                  <button
                    key={u}
                    onClick={() => {
                      onSelect(u)
                      onOpenChange(false)
                    }}
                    className={cn(
                      'h-11 rounded-lg text-sm font-medium transition-all touch-manipulation flex items-center justify-center gap-1.5',
                      currentUser === u
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    )}
                  >
                    {currentUser === u && <Check className="h-3.5 w-3.5" />}
                    {u}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setMode('create')}
              className="w-full flex items-center justify-center gap-2 h-11 rounded-lg border-2 border-dashed border-border text-sm font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-all touch-manipulation"
            >
              <UserPlus className="h-4 w-4" />
              Criar novo usuário
            </button>
          </div>
        ) : (
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="new-user-name">Nome do novo usuário</Label>
              <Input
                id="new-user-name"
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ex.: Maria, João, Visita…"
                autoFocus
                autoComplete="off"
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                maxLength={30}
              />
              <p className="text-xs text-muted-foreground">
                O nome aparecerá no histórico de atividades para indicar quem fez cada alteração.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMode('select')}
                className="flex-1"
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Voltar
              </Button>
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={!newName.trim()}
                className="flex-1"
              >
                <UserPlus className="h-3.5 w-3.5 mr-1" />
                Criar e entrar
              </Button>
            </div>
          </div>
        )}

        <DialogFooter className="flex-row sm:justify-between items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onLogout()
              onOpenChange(false)
            }}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            Sair da conta
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
