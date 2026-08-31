import { computed, ref, type Ref } from 'vue'
import { isLeadsColumn } from '../lib/columns'
import type { Column, Project } from '../types'

const META_KEY = 'slate.card-meta-open'

function readOverrides(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(META_KEY)
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {}
  } catch {
    return {}
  }
}

const overrides: Ref<Record<string, boolean>> = ref(readOverrides())

export function isCardMetaOpen(project: Project, columns: Column[]) {
  const stored = overrides.value[project.id]
  if (stored !== undefined) return stored
  const column = columns.find((item) => item.id === project.columnId)
  if (!column) return true
  return !isLeadsColumn(column)
}

export function toggleCardMeta(project: Project, columns: Column[]) {
  const next = { ...overrides.value, [project.id]: !isCardMetaOpen(project, columns) }
  overrides.value = next
  localStorage.setItem(META_KEY, JSON.stringify(next))
}

export function useCardMeta(project: () => Project, columns: () => Column[]) {
  const metaOpen = computed(() => isCardMetaOpen(project(), columns()))
  function toggle(event: Event) {
    event.preventDefault()
    event.stopPropagation()
    toggleCardMeta(project(), columns())
  }
  return { metaOpen, toggle }
}
