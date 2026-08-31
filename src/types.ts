export type ColumnKind = 'workflow' | 'retainer' | 'inactive'

export interface Column {
  id: string
  name: string
  order: number
  kind?: ColumnKind
}

export interface Client {
  id: string
  name: string
  contact: string
  notes: string
  createdAt: number
  updatedAt: number
}

export interface Project {
  id: string
  name: string
  clientId: string
  notes: string
  columnId: string
  order: number
  budget: number
  paid: number
  hoursByDate: Record<string, number>
  retainer: boolean
  retainerHoursPerMonth: number
  inactive: boolean
  starred: boolean
  createdAt: number
  updatedAt: number
}

export interface BoardSettings {
  columns: Column[]
}

export interface Contact {
  id: string
  name: string
  email: string
  occupation: string
  notes: string
  createdAt: number
  updatedAt: number
}

export interface ClientDraft {
  name: string
  contact: string
  notes: string
}

export interface ContactDraft {
  name: string
  email: string
  occupation: string
  notes: string
}

export interface ProjectDraft {
  name: string
  clientId: string
  notes: string
  columnId: string
  budget: number
  paid: number
  retainer: boolean
  retainerHoursPerMonth: number
  inactive: boolean
}

export const NEW_CLIENT_VALUE = '__new__'

export const DEFAULT_COLUMN_NAMES = [
  'Leads',
  'Scope & Proposal',
  'Design & Preproduction',
  'In Production',
  'Post Production',
  'Complete',
] as const
