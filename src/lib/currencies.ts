// Predefined currencies with standard symbols
export interface CurrencyDef {
  code: string
  name: string
  symbol: string
  flag: string
}

export const PREDEFINED_CURRENCIES: CurrencyDef[] = [
  { code: 'BRL', name: 'Real', symbol: 'R$', flag: '🇧🇷' },
  { code: 'USD', name: 'Dólar', symbol: '$', flag: '🇺🇸' },
  { code: 'CAD', name: 'Dólar Canadense', symbol: 'C$', flag: '🇨🇦' },
  { code: 'EUR', name: 'Euro', symbol: '€', flag: '🇪🇺' },
  { code: 'GBP', name: 'Libra Esterlina', symbol: '£', flag: '🇬🇧' },
  { code: 'DKK', name: 'Coroa Dinamarquesa', symbol: 'kr', flag: '🇩🇰' },
  { code: 'HUF', name: 'Florin Húngaro', symbol: 'Ft', flag: '🇭🇺' },
  { code: 'CZK', name: 'Coroa Tcheca', symbol: 'Kč', flag: '🇨🇿' },
]

export function getCurrencySymbol(code: string): string {
  const c = PREDEFINED_CURRENCIES.find(c => c.code === code)
  return c?.symbol ?? code
}

export function getCurrencyName(code: string): string {
  const c = PREDEFINED_CURRENCIES.find(c => c.code === code)
  return c?.name ?? code
}

export function formatMoney(v: number, currencyCode: string): string {
  const sign = v < 0 ? '-' : ''
  const abs = Math.abs(v)
  const formatted = abs.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const symbol = getCurrencySymbol(currencyCode)
  return `${sign}${symbol} ${formatted}`
}
