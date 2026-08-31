import type { Column, ColumnKind, Project } from '../types'

export const RETAINER_COLUMN_NAME = 'Retainers'
export const INACTIVE_COLUMN_NAME = 'Inactive'

export function columnKind(column: Column | undefined): ColumnKind {
  if (!column) return 'workflow'
  if (column.kind === 'retainer' || column.kind === 'inactive') return column.kind
  const name = column.name.replace(/\s+/g, ' ').trim().toLowerCase()
  if (name === 'retainers') return 'retainer'
  if (name.startsWith('inactive')) return 'inactive'
  return 'workflow'
}

export function isPinnedColumn(column: Column) {
  return columnKind(column) !== 'workflow'
}

export function isLeadsColumn(column: Column) {
  return columnKind(column) === 'workflow' && column.name.replace(/\s+/g, ' ').trim().toLowerCase() === 'leads'
}

export function withPinnedColumns(columns: Column[]): Column[] {
  const workflow = columns.filter((column) => columnKind(column) === 'workflow')
  const retainer =
    columns.find((column) => columnKind(column) === 'retainer') ?? {
      id: crypto.randomUUID(),
      name: RETAINER_COLUMN_NAME,
      order: 0,
      kind: 'retainer' as const,
    }
  const inactive =
    columns.find((column) => columnKind(column) === 'inactive') ?? {
      id: crypto.randomUUID(),
      name: INACTIVE_COLUMN_NAME,
      order: 0,
      kind: 'inactive' as const,
    }

  return [
    ...workflow.map((column) => ({ ...column, kind: 'workflow' as const })),
    { ...retainer, name: RETAINER_COLUMN_NAME, kind: 'retainer' as const },
    { ...inactive, name: INACTIVE_COLUMN_NAME, kind: 'inactive' as const },
  ].map((column, order) => ({ ...column, order }))
}

export function columnsChanged(before: Column[], after: Column[]) {
  if (before.length !== after.length) return true
  return before.some((column, index) => {
    const next = after[index]
    return (
      column.id !== next.id ||
      column.name !== next.name ||
      column.order !== next.order ||
      column.color !== next.color ||
      columnKind(column) !== columnKind(next)
    )
  })
}

export function columnIdForStatus(
  columns: Column[],
  inactive: boolean,
  retainer: boolean,
  fallbackId: string,
) {
  if (inactive) {
    return columns.find((column) => columnKind(column) === 'inactive')?.id ?? fallbackId
  }
  if (retainer) {
    return columns.find((column) => columnKind(column) === 'retainer')?.id ?? fallbackId
  }
  const current = columns.find((column) => column.id === fallbackId)
  if (current && columnKind(current) === 'workflow') return fallbackId
  return (
    columns.find((column) => column.name === 'Complete' && columnKind(column) === 'workflow')?.id ??
    columns.find((column) => columnKind(column) === 'workflow')?.id ??
    fallbackId
  )
}

export function statusFromColumn(column: Column | undefined): Pick<Project, 'retainer' | 'inactive'> {
  const kind = columnKind(column)
  return {
    retainer: kind === 'retainer',
    inactive: kind === 'inactive',
  }
}
