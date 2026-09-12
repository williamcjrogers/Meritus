const dateFormatter = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Europe/London' })
const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })
const numberFormatter = new Intl.NumberFormat('en-GB')
const windowDateFormatter = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' })

export function formatDate(value?: string | null): string {
  if (!value) return 'Not recorded'
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (dateOnly) return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]}`
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date)
}
export function formatDateTime(value?: string | null): string {
  if (!value) return 'Not recorded'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : dateTimeFormatter.format(date)
}

export function formatNumber(value?: number | null): string { return value == null ? 'Not recorded' : numberFormatter.format(value) }
export function sentence(value?: string | null): string { return value ? value.replaceAll('_', ' ').replace(/^./, c => c.toUpperCase()) : 'Not recorded' }
export function formatIndexLabel(value?: string | null): string { return sentence(value).replace(/\bhrbs\b/gi, 'HRBs').replace(/\b(?:bsr|bsa|hrb|nhs)\b/gi, match => match.toUpperCase()) }
export function formatReportingWindow(value?: string | null): string {
  if (!value) return 'Not recorded'
  const match = /^(\d{4}-\d{2}-\d{2})(?:T[\d:.+-]+Z?)?$/.exec(value)
  if (!match || Number.isNaN(new Date(value).getTime())) return value
  const day = new Date(`${match[1]}T00:00:00Z`)
  return day.toISOString().startsWith(match[1]) ? windowDateFormatter.format(day) : value
}

export function parseUkDate(value: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim())
  if (!match) return null
  const day = Number(match[1]); const month = Number(match[2]); const year = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return `${match[3]}-${match[2]}-${match[1]}`
}
