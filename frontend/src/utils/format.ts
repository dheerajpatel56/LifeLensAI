import type { CorrelationPair } from '../types/api'

export function formatNumber(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return value.toFixed(digits)
}

export function formatUnitValue(value: number | null, unit: string | null): string {
  if (value === null || value === undefined) return '—'
  if (unit === '/10') return `${value.toFixed(1)}`
  if (unit === 'minutes') return `${Math.round(value)}`
  return value.toFixed(1)
}

export function formatPercent(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return `${(value * 100).toFixed(digits)}%`
}

export function formatSigned(value: number, digits = 2): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(digits)}`
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatShortDate(value: string): string {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

export function todayIso(): string {
  const now = new Date()
  const offset = now.getTimezoneOffset()
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10)
}

/** Colour role for a correlation coefficient. Direction, not judgement. */
export function correlationTone(pair: Pick<CorrelationPair, 'coefficient' | 'strength'>) {
  if (pair.strength === 'negligible') return 'neutral' as const
  return pair.coefficient > 0 ? ('positive' as const) : ('negative' as const)
}

export function evidenceLabel(evidence: CorrelationPair['evidence']): string {
  switch (evidence) {
    case 'reasonable':
      return 'Reasonable sample'
    case 'limited':
      return 'Small sample'
    default:
      return 'Insufficient'
  }
}
