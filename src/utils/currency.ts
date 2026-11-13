const brazilianCurrency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})
const brazilianInteger = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })
const currencySymbol = brazilianCurrency.formatToParts(0).find((part) => part.type === 'currency')?.value ?? 'R$'

export function formatBRLFromCents(amountCents: number): string {
  const cents = BigInt(amountCents)
  const reais = cents / 100n
  const remainder = (cents % 100n).toString().padStart(2, '0')
  return `${currencySymbol}\u00a0${brazilianInteger.format(reais)},${remainder}`
}

export function parseBrazilianDecimalToInteger(value: string, scale: number): number {
  const trimmed = value.trim()
  if (!/^\d+(?:,\d{1,2})?$/.test(trimmed)) throw new Error('Informe um valor numérico válido.')
  const [whole, fraction = ''] = trimmed.split(',')
  const parsed = Number(whole) * (10 ** scale) + Number(fraction.padEnd(scale, '0'))
  if (!Number.isSafeInteger(parsed)) throw new Error('O valor informado é muito alto.')
  return parsed
}

export function calculateCommissionCents(amountCents: number, commissionRateBps: number): number {
  const amount = BigInt(amountCents)
  const rate = BigInt(commissionRateBps)
  const result = (amount * rate + 5000n) / 10000n
  if (result > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('A comissão calculada excede o limite permitido.')
  return Number(result)
}

export function toLocalDateInputValue(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function dateWithCurrentLocalTime(dateValue: string, now = new Date()): Date {
  return dateWithLocalTime(dateValue, `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`)
}

export function dateWithLocalTime(dateValue: string, timeValue: string): Date {
  const [year, month, day] = dateValue.split('-').map(Number)
  const [hours, minutes] = timeValue.split(':').map(Number)
  return new Date(year, month - 1, day, hours, minutes)
}

export function parseLocalDateStart(value: string): Date {
  return new Date(`${value}T00:00:00`)
}

export function parseLocalDateAfterEnd(value: string): Date {
  const date = parseLocalDateStart(value)
  date.setDate(date.getDate() + 1)
  return date
}
