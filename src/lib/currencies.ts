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

export function getCurrencyDef(code: string): CurrencyDef | undefined {
  return PREDEFINED_CURRENCIES.find(c => c.code === code)
}

export function formatMoney(v: number, currencyCode: string): string {
  const sign = v < 0 ? '-' : ''
  const abs = Math.abs(v)
  const formatted = abs.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const symbol = getCurrencySymbol(currencyCode)
  return `${sign}${symbol} ${formatted}`
}

// ---- Secondary currency (the one shown alongside BRL in parentheses) ----
//
// BRL is always the primary currency. The "secondary" currency is shown next
// to BRL in the summary card and transaction editor (e.g., "R$ 100 (€ 16,67)").
//
// - Default secondary: EUR (uses `config.euroToBrl` for its rate)
// - User can pick any other currency as secondary. The rate for non-EUR
//   currencies comes from `config.customCurrencies` (array of { code, rate }).
//
// Returns the secondary currency's code, rate (in BRL), symbol, and name.
export interface SecondaryCurrencyInfo {
  code: string       // e.g. 'EUR', 'USD'
  rate: number       // 1 unit of this currency = rate BRL
  symbol: string     // e.g. '€', '$'
  name: string       // e.g. 'Euro', 'Dólar'
  flag: string       // e.g. '🇪🇺'
}

export function getSecondaryCurrency(
  config: Record<string, string>,
  customCurrencies: { code: string; rate: number }[] = []
): SecondaryCurrencyInfo {
  const code = config.secondaryCurrency || 'EUR'

  // EUR is special — its rate lives in `config.euroToBrl` for backwards compat
  let rate: number
  if (code === 'EUR') {
    rate = parseFloat(config.euroToBrl ?? '6') || 6
  } else {
    const found = customCurrencies.find((c) => c.code === code)
    rate = found?.rate ?? 1
  }

  const def = getCurrencyDef(code)
  return {
    code,
    rate,
    symbol: def?.symbol ?? code,
    name: def?.name ?? code,
    flag: def?.flag ?? '',
  }
}
