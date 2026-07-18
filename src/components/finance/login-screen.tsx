'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { User, Plus, ArrowLeft, Eye, EyeOff, Trash2 } from 'lucide-react'

interface Props {
  onLogin: (accountName: string, userName: string, workbookId?: string) => void
}

export function LoginScreen({ onLogin }: Props) {
  const [mode, setMode] = useState<'login' | 'register' | 'select-user' | 'create-workbook'>('login')
  const [accountName, setAccountName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [workbookName, setWorkbookName] = useState('')
  const [error, setError] = useState('')
  const [selectedAccount, setSelectedAccount] = useState('')
  const [selectedUser, setSelectedUser] = useState('')
  const [accountUsers, setAccountUsers] = useState<string[]>([])
  const [newUser, setNewUser] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [busy, setBusy] = useState(false)

  async function handleResetAll() {
    if (!confirm('Apagar TODAS as contas, usuários e planilhas? Esta ação não pode ser desfeita.')) return
    // Clear database: delete all workbooks (cascade deletes everything) and all accounts
    try {
      const r = await fetch('/api/workbooks')
      if (r.ok) {
        const data = await r.json()
        for (const wb of data.workbooks) {
          await fetch('/api/workbooks', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: wb.id, user: 'reset' }),
          })
        }
      }
      await fetch('/api/accounts', { method: 'DELETE' })
    } catch {}
    // Clear any locally-cached data too
    const keys = Object.keys(localStorage).filter(k => k.startsWith('nofluxo_') || k.startsWith('porto_'))
    for (const k of keys) localStorage.removeItem(k)
    // Reset state
    setAccountName('')
    setPassword('')
    setConfirmPassword('')
    setWorkbookName('')
    setSelectedAccount('')
    setSelectedUser('')
    setAccountUsers([])
    setNewUser('')
    setError('')
    setMode('login')
    window.location.reload()
  }

  async function createEmptyWorkbook(name: string) {
    try {
      // POST /api/workbooks creates the 3 default TopGroups (Despesas/Receitas/Reservas)
      // on the server side. We just need to create the workbook and get its ID.
      // We pass accountName so the workbook is scoped to this account (won't show
      // up in other accounts' workbook lists).
      const r = await fetch('/api/workbooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, accountName: selectedAccount }),
      })
      if (!r.ok) return
      const data = await r.json()
      const wbId = data.workbook.id
      return wbId
    } catch (e) {
      console.error('Erro ao criar planilha:', e)
    }
  }

  // Looks up this account's existing workbook(s) on the SERVER (not
  // localStorage) — this is what makes login work from any browser/device,
  // not just the one that originally created the account.
  async function findAccountWorkbookId(account: string): Promise<string | undefined> {
    try {
      const r = await fetch(`/api/workbooks?accountName=${encodeURIComponent(account)}`)
      if (!r.ok) return undefined
      const data = await r.json()
      const wb = data.workbooks?.[0]
      return wb?.id
    } catch {
      return undefined
    }
  }

  async function handleLogin() {
    if (!accountName.trim() || !password) {
      setError('Preencha conta e senha')
      return
    }
    setBusy(true)
    setError('')
    try {
      const r = await fetch('/api/accounts/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: accountName.trim(), password }),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) {
        setError(data.error || 'Erro ao entrar')
        return
      }
      setSelectedAccount(data.account.name)
      setAccountUsers(data.account.users ?? [])
      setMode('select-user')
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setBusy(false)
    }
  }

  async function handleRegister() {
    if (!accountName.trim() || !password) {
      setError('Preencha conta e senha')
      return
    }
    if (password !== confirmPassword) {
      setError('As senhas não coincidem')
      return
    }
    setBusy(true)
    setError('')
    try {
      const r = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: accountName.trim(), password }),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) {
        setError(data.error || 'Erro ao criar conta')
        return
      }
      setSelectedAccount(data.account.name)
      setAccountUsers([])
      setMode('select-user')
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setBusy(false)
    }
  }

  async function handleSelectUser(name: string) {
    setSelectedUser(name)
    setBusy(true)
    try {
      const wbId = await findAccountWorkbookId(selectedAccount)
      if (wbId) {
        onLogin(selectedAccount, name, wbId)
      } else {
        // No workbook for this account yet — create one
        setMode('create-workbook')
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleCreateUser() {
    if (!newUser.trim()) return
    setBusy(true)
    try {
      const r = await fetch('/api/accounts/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountName: selectedAccount, userName: newUser.trim() }),
      })
      const data = await r.json().catch(() => ({}))
      if (r.ok) setAccountUsers(data.users ?? [])
    } catch {}
    setBusy(false)
    await handleSelectUser(newUser.trim())
  }

  async function handleCreateWorkbook() {
    if (!workbookName.trim()) return
    const wbId = await createEmptyWorkbook(workbookName.trim())
    onLogin(selectedAccount, selectedUser, wbId)
  }

  // ---- Create workbook mode ----
  if (mode === 'create-workbook') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-emerald-50 to-background dark:from-emerald-950/30 dark:to-background p-4">
        <div className="mb-8 text-center">
          <img src="/logo-nofluxo-mark.png" alt="NoFluxo" className="h-20 w-20 mx-auto mb-3 rounded-2xl shadow-elevated" />
          <h1 className="text-3xl font-bold"><span className="text-foreground">No</span><span className="text-[#FAB80B]">Fluxo</span></h1>
          <p className="text-sm text-muted-foreground mt-1">Criar primeira planilha</p>
        </div>
        <div className="w-full max-w-sm space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="wb-name">Nome da planilha</Label>
            <Input
              id="wb-name"
              value={workbookName}
              onChange={(e) => setWorkbookName(e.target.value)}
              placeholder="Ex.: Porto 2026, Família 2026..."
              onKeyDown={(e) => e.key === 'Enter' && handleCreateWorkbook()}
            />
            <p className="text-xs text-muted-foreground">
              Será criada com Despesas, Receitas e Reservas (vazia)
            </p>
          </div>
          {error && <p className="text-sm text-rose-500">{error}</p>}
          <Button onClick={handleCreateWorkbook} className="w-full" disabled={!workbookName.trim()}>
            Criar planilha
          </Button>
        </div>
      </div>
    )
  }

  // ---- Register mode ----
  if (mode === 'register') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-emerald-50 to-background dark:from-emerald-950/30 dark:to-background p-4">
        <div className="mb-8 text-center">
          <img src="/logo-nofluxo-mark.png" alt="NoFluxo" className="h-20 w-20 mx-auto mb-3 rounded-2xl shadow-elevated" />
          <h1 className="text-3xl font-bold"><span className="text-foreground">No</span><span className="text-[#FAB80B]">Fluxo</span></h1>
          <p className="text-sm text-muted-foreground mt-1">Criar nova conta</p>
        </div>
        <div className="w-full max-w-sm space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="reg-account">Nome da conta</Label>
            <Input
              id="reg-account"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="Ex.: Família, Empresa, Pessoal..."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reg-pass">Senha</Label>
            <div className="relative">
              <Input
                id="reg-pass"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Crie uma senha"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reg-pass2">Confirmar senha</Label>
            <div className="relative">
              <Input
                id="reg-pass2"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a senha"
                className="pr-10"
                onKeyDown={(e) => e.key === 'Enter' && handleRegister()}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          {error && <p className="text-sm text-rose-500">{error}</p>}
          <Button onClick={handleRegister} className="w-full" disabled={!accountName.trim() || !password || busy}>
            {busy ? 'Criando...' : 'Criar conta'}
          </Button>
          <button
            onClick={() => { setMode('login'); setError(''); setPassword(''); setConfirmPassword('') }}
            className="w-full text-sm text-muted-foreground hover:text-foreground flex items-center justify-center gap-1"
          >
            <ArrowLeft className="h-3 w-3" /> Voltar para login
          </button>
        </div>
      </div>
    )
  }

  // ---- Select user mode ----
  if (mode === 'select-user') {
    const users = accountUsers
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-emerald-50 to-background dark:from-emerald-950/30 dark:to-background p-4">
        <div className="mb-6 text-center">
          <img src="/logo-nofluxo-mark.png" alt="NoFluxo" className="h-16 w-16 mx-auto mb-2 rounded-xl shadow-soft" />
          <h1 className="text-2xl font-bold"><span className="text-foreground">No</span><span className="text-[#FAB80B]">Fluxo</span></h1>
          <p className="text-sm text-muted-foreground">Conta: <strong>{selectedAccount}</strong></p>
        </div>
        <div className="w-full max-w-sm space-y-3">
          <p className="text-center text-sm text-muted-foreground mb-4">Quem está usando?</p>
          {users.map((u) => (
            <button
              key={u}
              onClick={() => handleSelectUser(u)}
              disabled={busy}
              className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-border bg-background hover:border-primary hover:bg-muted/50 transition-all touch-manipulation disabled:opacity-50"
            >
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <User className="h-5 w-5 text-primary" />
              </div>
              <span className="font-medium text-foreground">{u}</span>
            </button>
          ))}
          <div className="flex gap-2 pt-2">
            <Input
              value={newUser}
              onChange={(e) => setNewUser(e.target.value)}
              placeholder="Novo usuário..."
              onKeyDown={(e) => e.key === 'Enter' && handleCreateUser()}
              className="flex-1"
            />
            <Button onClick={handleCreateUser} disabled={!newUser.trim() || busy} size="icon">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {users.length === 0 && (
            <p className="text-xs text-muted-foreground text-center">
              Crie seu primeiro usuário para começar
            </p>
          )}
          <button
            onClick={() => { setMode('login'); setSelectedAccount(''); setError('') }}
            className="w-full text-sm text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 pt-4"
          >
            <ArrowLeft className="h-3 w-3" /> Voltar para login
          </button>
        </div>
      </div>
    )
  }

  // ---- Login mode (default) ----
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-emerald-50 to-background dark:from-emerald-950/30 dark:to-background p-4">
      <div className="mb-8 text-center">
        <img src="/logo-nofluxo-mark.png" alt="NoFluxo" className="h-20 w-20 mx-auto mb-3 rounded-2xl shadow-elevated" />
        <h1 className="text-3xl font-bold"><span className="text-foreground">No</span><span className="text-[#FAB80B]">Fluxo</span></h1>
        <p className="text-sm text-muted-foreground mt-1">Seu controle financeiro em fluxo</p>
      </div>
      <div className="w-full max-w-sm space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="login-account">Conta</Label>
          <Input
            id="login-account"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            placeholder="Digite o nome da sua conta"
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="login-pass">Senha</Label>
          <div className="relative">
            <Input
              id="login-pass"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Digite sua senha"
              className="pr-10"
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        {error && <p className="text-sm text-rose-500">{error}</p>}
        <Button onClick={handleLogin} className="w-full" disabled={!accountName.trim() || !password || busy}>
          {busy ? 'Entrando...' : 'Entrar'}
        </Button>
        <div className="flex items-center gap-2 my-4">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">ou</span>
          <div className="flex-1 h-px bg-border" />
        </div>
        <Button
          variant="outline"
          onClick={() => { setMode('register'); setError(''); setPassword(''); setConfirmPassword('') }}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-1" /> Criar nova conta
        </Button>
      </div>
    </div>
  )
}
