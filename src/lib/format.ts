import { withPinnedColumns } from './columns'
import { DEFAULT_COLUMN_NAMES, type Project } from '../types'

export function totalHours(project: Project): number {
  return Object.values(project.hoursByDate).reduce((sum, hours) => sum + hours, 0)
}

export function hoursInMonth(
  project: Project,
  year: number,
  month: number,
): number {
  const prefix = `${year}-${pad(month + 1)}-`
  return Object.entries(project.hoursByDate).reduce((sum, [date, hours]) => {
    return date.startsWith(prefix) ? sum + hours : sum
  }, 0)
}

export function effectiveRate(project: Project): number | null {
  const hours = totalHours(project)
  if (hours <= 0 || project.budget <= 0) return null
  return project.budget / hours
}

export function formatHours(value: number): string {
  if (!value) return '0'
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

export function formatMoney(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 1000 && Number.isInteger(value) ? 0 : 2,
  }).format(value || 0)
}

export function formatRate(value: number | null): string {
  if (value === null) return '—'
  return `${formatMoney(value)}/hr`
}

export function pad(value: number): string {
  return String(value).padStart(2, '0')
}

export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function daysInMonth(year: number, month: number): Date[] {
  const count = new Date(year, month + 1, 0).getDate()
  return Array.from({ length: count }, (_, index) => new Date(year, month, index + 1))
}

export function monthLabel(year: number, month: number): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month, 1))
}

export function weekdayLabel(date: Date): string {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date)
}

export function isWeekend(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function createId(): string {
  return crypto.randomUUID()
}

export function defaultColumns() {
  return withPinnedColumns(
    DEFAULT_COLUMN_NAMES.map((name, order) => ({
      id: createId(),
      name,
      order,
      kind: 'workflow' as const,
    })),
  )
}
