// Currency formatting helpers
// Two currencies only: BRL (always main) + one secondary (editable name/symbol)

export function formatMoney(v: number, currency: string, secondarySymbol: string = '€'): string {
  const sign = v < 0 ? '-' : ''
  const abs = Math.abs(v)
  const formatted = abs.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (currency === 'BRL') return `${sign}R$ ${formatted}`
  // Secondary currency — use the custom symbol
  return `${sign}${secondarySymbol} ${formatted}`
}

export function formatBRL(v: number): string {
  const sign = v < 0 ? '-' : ''
  return `${sign}R$ ${Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
