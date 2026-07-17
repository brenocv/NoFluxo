'use client'

import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { TrendingUp, TrendingDown, PiggyBank, Clock } from 'lucide-react'
import { formatBRL } from '@/lib/finance'
import { PREDEFINED_CURRENCIES, SecondaryCurrencyInfo } from '@/lib/currencies'

interface ActiveCurrency {
  code: string
  rate: number
}

interface Props {
  entradasBRL: number
  saidasBRL: number
  entradasEUR: number
  saidasEUR: number
  reservasBRL: number
  receivablesBRL: number
  receivablesEUR: number
  includeReceivables: boolean
  onToggleReceivables: (v: boolean) => void
  euroRate: number
  workbookId?: string
  secondaryCurrency?: SecondaryCurrencyInfo
  customCurrencies?: ActiveCurrency[]
  onEntradasClick: () => void
  onSaidasClick: () => void
}

function formatSecondary(v: number, sec: SecondaryCurrencyInfo): string {
  const sign = v < 0 ? '-' : ''
  const abs = Math.abs(v)
  const formatted = abs.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${sign}${sec.symbol} ${formatted}`
}

export function SummaryCard({
  entradasBRL, saidasBRL, entradasEUR, saidasEUR,
  reservasBRL, receivablesBRL, receivablesEUR,
  includeReceivables, onToggleReceivables, euroRate,
  workbookId,
  secondaryCurrency,
  customCurrencies,
  onEntradasClick, onSaidasClick,
}: Props) {
  // Default to EUR if no secondary currency is provided (backwards compat)
  const sec: SecondaryCurrencyInfo = secondaryCurrency ?? {
    code: 'EUR', rate: euroRate, symbol: '€', name: 'Euro', flag: '🇪🇺', available: true,
  }
  const secRate = sec.rate || euroRate
  // If the secondary currency is not available (e.g., EUR was removed and no
  // other currency is set as secondary), hide the secondary displays.
  const showSecondary = sec.available && sec.code !== 'BRL'

  const totalEntradasBRL = entradasBRL + entradasEUR * euroRate
  const totalSaidasBRL = saidasBRL + saidasEUR * euroRate
  let saldoTotalBRL = totalEntradasBRL - totalSaidasBRL

  if (includeReceivables) {
    saldoTotalBRL += receivablesBRL + receivablesEUR * euroRate
  }
  const saldoTotalSec = saldoTotalBRL / secRate

  return (
    <Card className="p-0 overflow-hidden shadow-elevated border-border/60 gap-0">
      <div className="bg-gradient-brand px-4 pt-4 pb-5 text-white">
        <div className="flex items-center justify-between flex-wrap gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white/80">
            Resumo do mês
          </span>
          {showSecondary && (
            <div className="flex items-center gap-2 text-[11px] text-white/80 flex-wrap">
              <span>
                {sec.symbol}1 = R$ {secRate.toFixed(2).replace('.', ',')}
                {' '}<button onClick={() => {
                  const newRate = window.prompt(`Nova cotação de ${sec.name} (em R$):`, String(secRate))
                  if (newRate !== null) {
                    const parsed = parseFloat(newRate.replace(',', '.'))
                    if (!isNaN(parsed) && parsed > 0) {
                      // If secondary is EUR, save to euroToBrl; otherwise save to customCurrencies
                      if (sec.code === 'EUR') {
                        fetch('/api/config', {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ key: 'euroToBrl', value: String(parsed), user: 'user', workbookId }),
                        }).then(() => {
                          // Update state in-place via the finance:patch event (NO page reload)
                          window.dispatchEvent(new CustomEvent('finance:patch', {
                            detail: { type: 'config', action: 'update', payload: { key: 'euroToBrl', value: String(parsed) }, by: { name: 'user', color: '#16a34a' }, at: Date.now() }
                          }))
                        })
                      } else {
                        const updated = (customCurrencies ?? []).map((cur: any) =>
                          cur.code === sec.code ? { ...cur, rate: parsed } : cur
                        )
                        fetch('/api/config', {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ key: 'customCurrencies', value: JSON.stringify(updated), user: 'user', workbookId }),
                        }).then(() => {
                          window.dispatchEvent(new CustomEvent('finance:patch', {
                            detail: { type: 'config', action: 'update', payload: { key: 'customCurrencies', value: JSON.stringify(updated) }, by: { name: 'user', color: '#16a34a' }, at: Date.now() }
                          }))
                        })
                      }
                    }
                  }
                }} className="underline decoration-white/40 underline-offset-2 hover:decoration-white" tabIndex={-1}>editar</button>
              </span>
              {(customCurrencies ?? []).filter(c => c.code !== sec.code).map((c) => {
                const def = PREDEFINED_CURRENCIES.find(p => p.code === c.code)
                return (
                  <span key={c.code}>
                    {def?.symbol ?? c.code}1 = R$ {c.rate.toFixed(2).replace('.', ',')}
                    {' '}<button onClick={() => {
                      const newRate = window.prompt(`Nova cotação de ${def?.name ?? c.code} (em R$):`, String(c.rate))
                      if (newRate !== null) {
                        const parsed = parseFloat(newRate.replace(',', '.'))
                        if (!isNaN(parsed) && parsed > 0) {
                          const updated = (customCurrencies ?? []).map((cur: any) =>
                            cur.code === c.code ? { ...cur, rate: parsed } : cur
                          )
                          fetch('/api/config', {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ key: 'customCurrencies', value: JSON.stringify(updated), user: 'user', workbookId }),
                          }).then(() => {
                            window.dispatchEvent(new CustomEvent('finance:patch', {
                              detail: { type: 'config', action: 'update', payload: { key: 'customCurrencies', value: JSON.stringify(updated) }, by: { name: 'user', color: '#16a34a' }, at: Date.now() }
                            }))
                          })
                        }
                      }
                    }} className="underline decoration-white/40 underline-offset-2 hover:decoration-white" tabIndex={-1}>editar</button>
                  </span>
                )
              })}
            </div>
          )}
        </div>

        <div className="mt-2 space-y-0.5">
          <div className="flex items-baseline gap-2">
            <span className="text-[11px] text-white/70">Saldo total</span>
            {receivablesBRL + receivablesEUR > 0 && (
              <span className="text-[10px] text-white/60">
                {includeReceivables ? '(com valores a receber)' : '(sem valores a receber)'}
              </span>
            )}
          </div>
          <div className="text-4xl font-bold tabular-nums tracking-tight">
            {formatBRL(saldoTotalBRL)}
          </div>
          {showSecondary && (
            <div className="text-sm font-medium tabular-nums text-white/75">
              ≈ {formatSecondary(saldoTotalSec, sec)}
            </div>
          )}
        </div>
      </div>

      <div className="p-4 space-y-3">
      {/* Entradas / Saídas — clickable to scroll to the corresponding group */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onEntradasClick}
          className="text-left rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 p-3 hover:bg-emerald-100 dark:hover:bg-emerald-500/15 transition-colors touch-manipulation active:scale-[0.98]"
          aria-label="Ver receitas"
        >
          <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
            <TrendingUp className="h-3.5 w-3.5" />
            <span className="text-[10px] uppercase tracking-wider font-semibold">Entradas →</span>
          </div>
          <div className="mt-1 space-y-0.5">
            <div className="text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
              {formatBRL(totalEntradasBRL)}
            </div>
            {showSecondary && (
              <div className="text-[10px] text-emerald-700/60 dark:text-emerald-400/60 tabular-nums">
                ≈ {formatSecondary(totalEntradasBRL / secRate, sec)}
              </div>
            )}
          </div>
        </button>
        <button
          onClick={onSaidasClick}
          className="text-left rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 p-3 hover:bg-rose-100 dark:hover:bg-rose-500/15 transition-colors touch-manipulation active:scale-[0.98]"
          aria-label="Ver despesas"
        >
          <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-400">
            <TrendingDown className="h-3.5 w-3.5" />
            <span className="text-[10px] uppercase tracking-wider font-semibold">Saídas →</span>
          </div>
          <div className="mt-1 space-y-0.5">
            <div className="text-sm font-semibold tabular-nums text-rose-700 dark:text-rose-400">
              {formatBRL(totalSaidasBRL)}
            </div>
            {showSecondary && (
              <div className="text-[10px] text-rose-700/60 dark:text-rose-400/60 tabular-nums">
                ≈ {formatSecondary(totalSaidasBRL / secRate, sec)}
              </div>
            )}
          </div>
        </button>
      </div>

      {reservasBRL > 0 && (
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <PiggyBank className="h-3 w-3" />
            Reservas (mês)
          </span>
          <span className="text-xs font-semibold text-foreground tabular-nums">
            {formatBRL(reservasBRL)}
            {showSecondary && (
              <span className="text-[10px] text-muted-foreground ml-1 font-normal">
                ({formatSecondary(reservasBRL / secRate, sec)})
              </span>
            )}
          </span>
        </div>
      )}

      {/* "Incluir valores a receber" toggle — always visible so the user can
          toggle it even when there are no receivables yet. Shows the pending
          amount when there are receivables; otherwise shows "0 pendente". */}
      <div className="flex items-center justify-between pt-2 border-t border-border gap-3">
        <div className="flex-1 min-w-0">
          <Label htmlFor="include-receivables" className="text-xs font-medium cursor-pointer flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Incluir valores a receber
          </Label>
          <p className="text-[10px] text-muted-foreground truncate tabular-nums">
            {formatBRL(receivablesBRL + receivablesEUR * euroRate)} pendente
          </p>
        </div>
        <Switch
          id="include-receivables"
          checked={includeReceivables}
          onCheckedChange={onToggleReceivables}
        />
      </div>
      </div>
    </Card>
  )
}
