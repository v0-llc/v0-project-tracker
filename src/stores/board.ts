import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore'
import {
  columnIdForStatus,
  columnKind,
  columnsChanged,
  isPinnedColumn,
  statusFromColumn,
  withPinnedColumns,
} from '../lib/columns'
import { createId, defaultColumns } from '../lib/format'
import { isFirebaseConfigured, requireDb } from '../firebase'
import type {
  Client,
  ClientDraft,
  Column,
  Contact,
  ContactDraft,
  Project,
  ProjectDraft,
} from '../types'
import { useAuthStore } from './auth'

const LOCAL_COLUMNS_KEY = 'slate.columns'
const LOCAL_PROJECTS_KEY = 'slate.projects'
const LOCAL_CLIENTS_KEY = 'slate.clients'
const LOCAL_CONTACTS_KEY = 'slate.contacts'
const LOCAL_OCCUPATIONS_KEY = 'slate.occupations'

function emptyDraft(columnId = ''): ProjectDraft {
  return {
    name: '',
    clientId: '',
    notes: '',
    columnId,
    budget: 0,
    paid: 0,
    retainer: false,
    retainerHoursPerMonth: 0,
    inactive: false,
  }
}

function emptyClientDraft(): ClientDraft {
  return {
    name: '',
    contact: '',
    notes: '',
  }
}

function emptyContactDraft(): ContactDraft {
  return {
    name: '',
    email: '',
    occupation: '',
    notes: '',
  }
}

function toMillis(value: unknown): number {
  if (typeof value === 'number') return value
  if (value && typeof value === 'object' && 'toMillis' in value) {
    return (value as { toMillis: () => number }).toMillis()
  }
  return Date.now()
}

function parseProject(id: string, data: Record<string, unknown>): Project {
  return {
    id,
    name: String(data.name ?? ''),
    clientId: String(data.clientId ?? ''),
    notes: String(data.notes ?? ''),
    columnId: String(data.columnId ?? ''),
    order: Number(data.order ?? 0),
    budget: Number(data.budget ?? 0),
    paid: Number(data.paid ?? 0),
    hoursByDate: (data.hoursByDate as Record<string, number>) ?? {},
    retainer: Boolean(data.retainer),
    retainerHoursPerMonth: Number(data.retainerHoursPerMonth) || 0,
    inactive: Boolean(data.inactive),
    starred: Boolean(data.starred),
    createdAt: toMillis(data.createdAt),
    updatedAt: toMillis(data.updatedAt),
  }
}

function parseClient(id: string, data: Record<string, unknown>): Client {
  return {
    id,
    name: String(data.name ?? ''),
    contact: String(data.contact ?? ''),
    notes: String(data.notes ?? ''),
    createdAt: toMillis(data.createdAt),
    updatedAt: toMillis(data.updatedAt),
  }
}

function parseContact(id: string, data: Record<string, unknown>): Contact {
  return {
    id,
    name: String(data.name ?? ''),
    email: String(data.email ?? ''),
    occupation: String(data.occupation ?? ''),
    notes: String(data.notes ?? ''),
    createdAt: toMillis(data.createdAt),
    updatedAt: toMillis(data.updatedAt),
  }
}

function migrateLegacyClients(projects: Project[], clients: Client[]) {
  const nextClients = [...clients]
  const nextProjects = projects.map((project) => {
    const raw = project as Project & { client?: string }
    const legacyName = raw.client?.trim() ?? ''
    if (raw.clientId || !legacyName) {
      return { ...project, clientId: raw.clientId || '' }
    }
    let match = nextClients.find(
      (client) => client.name.toLowerCase() === legacyName.toLowerCase(),
    )
    if (!match) {
      match = {
        id: createId(),
        name: legacyName,
        contact: '',
        notes: '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      nextClients.push(match)
    }
    return { ...project, clientId: match.id }
  })
  return { projects: nextProjects, clients: nextClients }
}

export const useBoardStore = defineStore('board', () => {
  const auth = useAuthStore()
  const columns = ref<Column[]>([])
  const projects = ref<Project[]>([])
  const clients = ref<Client[]>([])
  const contacts = ref<Contact[]>([])
  const occupations = ref<string[]>([])
  const loading = ref(false)
  const ready = ref(false)
  const error = ref('')

  const sortedColumns = computed(() =>
    [...columns.value].sort((a, b) => a.order - b.order),
  )

  const sortedProjects = computed(() =>
    [...projects.value].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)),
  )

  const sortedClients = computed(() =>
    [...clients.value].sort((a, b) => a.name.localeCompare(b.name)),
  )

  const workflowColumns = computed(() =>
    sortedColumns.value.filter((column) => columnKind(column) === 'workflow'),
  )

  const retainerColumn = computed(() =>
    sortedColumns.value.find((column) => columnKind(column) === 'retainer'),
  )

  const inactiveColumn = computed(() =>
    sortedColumns.value.find((column) => columnKind(column) === 'inactive'),
  )

  const sortedContacts = computed(() =>
    [...contacts.value].sort((a, b) => a.name.localeCompare(b.name) || a.occupation.localeCompare(b.occupation)),
  )

  const sortedOccupations = computed(() =>
    [...occupations.value].sort((a, b) => a.localeCompare(b)),
  )

  let reconciledUid = ''

  let unsubBoard: Unsubscribe | null = null
  let unsubProjects: Unsubscribe | null = null
  let unsubClients: Unsubscribe | null = null
  let unsubContacts: Unsubscribe | null = null
  let unsubOccupations: Unsubscribe | null = null

  function userPath() {
    const uid = auth.user?.uid
    if (!uid) throw new Error('Not signed in')
    return uid
  }

  function boardRef() {
    return doc(requireDb(), 'users', userPath(), 'settings', 'board')
  }

  function projectRef(id: string) {
    return doc(requireDb(), 'users', userPath(), 'projects', id)
  }

  function clientRef(id: string) {
    return doc(requireDb(), 'users', userPath(), 'clients', id)
  }

  function contactRef(id: string) {
    return doc(requireDb(), 'users', userPath(), 'contacts', id)
  }

  function occupationsRef() {
    return doc(requireDb(), 'users', userPath(), 'settings', 'occupations')
  }

  function stop() {
    unsubBoard?.()
    unsubProjects?.()
    unsubClients?.()
    unsubContacts?.()
    unsubOccupations?.()
    unsubBoard = null
    unsubProjects = null
    unsubClients = null
    unsubContacts = null
    unsubOccupations = null
  }

  function loadLocal() {
    try {
      const storedColumns = localStorage.getItem(LOCAL_COLUMNS_KEY)
      const storedProjects = localStorage.getItem(LOCAL_PROJECTS_KEY)
      const storedClients = localStorage.getItem(LOCAL_CLIENTS_KEY)
      const storedContacts = localStorage.getItem(LOCAL_CONTACTS_KEY)
      const storedOccupations = localStorage.getItem(LOCAL_OCCUPATIONS_KEY)
      columns.value = storedColumns
        ? (JSON.parse(storedColumns) as Column[])
        : defaultColumns()
      const loadedProjects = storedProjects
        ? (JSON.parse(storedProjects) as Project[])
        : []
      const loadedClients = storedClients
        ? (JSON.parse(storedClients) as Client[])
        : []
      const migrated = migrateLegacyClients(loadedProjects, loadedClients)
      projects.value = migrated.projects.map((project) => ({
        ...project,
        retainer: Boolean(project.retainer),
        retainerHoursPerMonth: Number(project.retainerHoursPerMonth) || 0,
        inactive: Boolean(project.inactive),
        starred: Boolean(project.starred),
      }))
      clients.value = migrated.clients
      contacts.value = storedContacts ? (JSON.parse(storedContacts) as Contact[]) : []
      occupations.value = storedOccupations ? (JSON.parse(storedOccupations) as string[]) : []
      columns.value = withPinnedColumns(columns.value)
      saveLocal()
    } catch {
      columns.value = defaultColumns()
      projects.value = []
      clients.value = []
      contacts.value = []
      occupations.value = []
    }
    loading.value = false
    ready.value = true
  }

  function saveLocal() {
    localStorage.setItem(LOCAL_COLUMNS_KEY, JSON.stringify(columns.value))
    localStorage.setItem(LOCAL_PROJECTS_KEY, JSON.stringify(projects.value))
    localStorage.setItem(LOCAL_CLIENTS_KEY, JSON.stringify(clients.value))
    localStorage.setItem(LOCAL_CONTACTS_KEY, JSON.stringify(contacts.value))
    localStorage.setItem(LOCAL_OCCUPATIONS_KEY, JSON.stringify(occupations.value))
  }

  async function seedRemoteBoard() {
    const next = defaultColumns()
    await setDoc(boardRef(), { columns: next })
    columns.value = next
  }

  function listen(uid: string) {
    stop()
    loading.value = true
    ready.value = false
    error.value = ''
    let boardReady = false
    let projectsReady = false
    let clientsReady = false
    let contactsReady = false
    let occupationsReady = false

    function markHydrated() {
      if (!boardReady || !projectsReady || !clientsReady || !contactsReady || !occupationsReady) {
        return
      }
      loading.value = false
      ready.value = true
    }

    unsubBoard = onSnapshot(
      doc(requireDb(), 'users', uid, 'settings', 'board'),
      async (snap) => {
        if (!snap.exists()) {
          await seedRemoteBoard()
          return
        }
        const data = snap.data()
        columns.value = Array.isArray(data.columns) ? data.columns : defaultColumns()
        boardReady = true
        markHydrated()
      },
      (err) => {
        error.value = err.message
        loading.value = false
        ready.value = true
      },
    )

    unsubProjects = onSnapshot(
      collection(requireDb(), 'users', uid, 'projects'),
      (snap) => {
        const next = snap.docs.map((item) => {
          const data = item.data() as Record<string, unknown>
          return parseProject(item.id, {
            ...data,
            clientId: data.clientId || '',
          })
        })
        projects.value = next
        projectsReady = true
        markHydrated()
      },
      (err) => {
        error.value = err.message
      },
    )

    unsubClients = onSnapshot(
      collection(requireDb(), 'users', uid, 'clients'),
      (snap) => {
        clients.value = snap.docs.map((item) =>
          parseClient(item.id, item.data() as Record<string, unknown>),
        )
        clientsReady = true
        markHydrated()
      },
      (err) => {
        error.value = err.message
      },
    )

    unsubContacts = onSnapshot(
      collection(requireDb(), 'users', uid, 'contacts'),
      (snap) => {
        contacts.value = snap.docs.map((item) =>
          parseContact(item.id, item.data() as Record<string, unknown>),
        )
        contactsReady = true
        markHydrated()
      },
      (err) => {
        error.value = err.message
      },
    )

    unsubOccupations = onSnapshot(
      occupationsRef(),
      (snap) => {
        const names = snap.exists() ? snap.data().names : []
        occupations.value = Array.isArray(names) ? names.map(String) : []
        occupationsReady = true
        markHydrated()
      },
      (err) => {
        error.value = err.message
      },
    )
  }

  watch(
    () => auth.user?.uid,
    (uid) => {
      stop()
      if (!uid) {
        columns.value = []
        projects.value = []
        clients.value = []
        contacts.value = []
        occupations.value = []
        loading.value = false
        ready.value = false
        reconciledUid = ''
        return
      }
      if (auth.isLocal || !isFirebaseConfigured) {
        loadLocal()
        return
      }
      listen(uid)
    },
    { immediate: true },
  )

  async function ensurePinnedColumns() {
    const next = withPinnedColumns(columns.value)
    if (!columnsChanged(columns.value, next)) return
    await persistColumns(next)
  }

  function applyPlacement(
    project: Project,
    next: { inactive?: boolean; retainer?: boolean; columnId?: string; retainerHoursPerMonth?: number },
  ): Project {
    const column = sortedColumns.value.find((item) => item.id === (next.columnId ?? project.columnId))
    const fromColumn = next.inactive === undefined && next.retainer === undefined
    const status = fromColumn
      ? statusFromColumn(column)
      : {
          inactive: Boolean(next.inactive),
          retainer: Boolean(next.retainer) && !next.inactive,
        }
    const columnId = columnIdForStatus(
      sortedColumns.value,
      status.inactive,
      status.retainer,
      next.columnId ?? project.columnId,
    )
    const hours =
      next.retainerHoursPerMonth === undefined
        ? project.retainerHoursPerMonth
        : Number(next.retainerHoursPerMonth) || 0
    return {
      ...project,
      ...status,
      columnId,
      retainerHoursPerMonth: status.retainer || project.retainer ? hours : project.retainerHoursPerMonth,
      updatedAt: Date.now(),
    }
  }

  async function persistProjects(next: Project[], writes: Project[]) {
    projects.value = next
    if (auth.isLocal || !isFirebaseConfigured) {
      saveLocal()
      return
    }
    for (let index = 0; index < writes.length; index += 400) {
      const batch = writeBatch(requireDb())
      writes.slice(index, index + 400).forEach((project) => {
        batch.set(
          projectRef(project.id),
          { ...project, updatedAt: serverTimestamp() },
          { merge: true },
        )
      })
      await batch.commit()
    }
  }

  async function reconcileProjectStatus() {
    const writes: Project[] = []
    const next = projects.value.map((project) => {
      const column = sortedColumns.value.find((item) => item.id === project.columnId)
      const inferred = !project.inactive && !project.retainer ? statusFromColumn(column) : project
      const placed = applyPlacement(project, {
        inactive: inferred.inactive,
        retainer: inferred.retainer,
        retainerHoursPerMonth: project.retainerHoursPerMonth,
      })
      if (
        placed.inactive === project.inactive &&
        placed.retainer === project.retainer &&
        placed.columnId === project.columnId
      ) {
        return project
      }
      writes.push(placed)
      return placed
    })
    if (writes.length) await persistProjects(next, writes)
  }

  watch(
    () => [auth.user?.uid, ready.value] as const,
    async ([uid, isReady]) => {
      if (!uid || !isReady) return
      if (reconciledUid === uid) return
      reconciledUid = uid
      await ensurePinnedColumns()
      await reconcileProjectStatus()
    },
  )

  function projectsInColumn(columnId: string): Project[] {
    return sortedProjects.value.filter((project) => project.columnId === columnId)
  }

  function clientById(id: string) {
    return clients.value.find((client) => client.id === id)
  }

  function clientName(id: string) {
    return clientById(id)?.name ?? ''
  }

  async function persistColumns(next: Column[]) {
    columns.value = withPinnedColumns([
      ...next,
      ...columns.value.filter(isPinnedColumn),
    ])
    if (auth.isLocal || !isFirebaseConfigured) {
      saveLocal()
      return
    }
    await setDoc(boardRef(), { columns: columns.value }, { merge: true })
  }

  async function renameColumn(id: string, name: string) {
    const current = columns.value.find((column) => column.id === id)
    if (!current || isPinnedColumn(current)) return
    const next = columns.value.map((column) =>
      column.id === id ? { ...column, name: name.trim() || column.name } : column,
    )
    await persistColumns(next)
  }

  async function addColumn() {
    await persistColumns([
      ...workflowColumns.value,
      { id: createId(), name: 'New column', order: workflowColumns.value.length, kind: 'workflow' },
      ...sortedColumns.value.filter(isPinnedColumn),
    ])
  }

  async function removeColumn(id: string) {
    const current = sortedColumns.value.find((column) => column.id === id)
    if (!current || isPinnedColumn(current)) return
    const remaining = sortedColumns.value.filter((column) => column.id !== id)
    if (remaining.length === 0) return
    const fallback =
      remaining.find((column) => columnKind(column) === 'workflow') ?? remaining[0]
    const moved = projects.value.map((project) =>
      project.columnId === id ? { ...project, columnId: fallback.id } : project,
    )
    projects.value = moved
    if (auth.isLocal || !isFirebaseConfigured) {
      await persistColumns(remaining)
      return
    }
    const batch = writeBatch(requireDb())
    moved
      .filter((project) => project.columnId === fallback.id)
      .forEach((project) => {
        batch.update(projectRef(project.id), {
          columnId: fallback.id,
          updatedAt: Date.now(),
        })
      })
    await batch.commit()
    await persistColumns(remaining)
  }

  async function createClient(draft: ClientDraft) {
    const client: Client = {
      id: createId(),
      name: draft.name.trim(),
      contact: draft.contact.trim(),
      notes: draft.notes.trim(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    clients.value = [...clients.value, client]
    if (auth.isLocal || !isFirebaseConfigured) {
      saveLocal()
      return client
    }
    await setDoc(clientRef(client.id), {
      ...client,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return client
  }

  async function persistOccupations(next: string[]) {
    const unique: string[] = []
    for (const name of next) {
      const trimmed = name.trim()
      if (!trimmed) continue
      if (unique.some((item) => item.toLowerCase() === trimmed.toLowerCase())) continue
      unique.push(trimmed)
    }
    occupations.value = unique
    if (auth.isLocal || !isFirebaseConfigured) {
      saveLocal()
      return
    }
    await setDoc(occupationsRef(), { names: unique }, { merge: true })
  }

  async function addOccupation(name: string) {
    const trimmed = name.trim()
    if (!trimmed) return
    if (occupations.value.some((item) => item.toLowerCase() === trimmed.toLowerCase())) return
    await persistOccupations([...occupations.value, trimmed])
  }

  async function createContact(draft: ContactDraft) {
    const contact: Contact = {
      id: createId(),
      name: draft.name.trim(),
      email: draft.email.trim(),
      occupation: draft.occupation.trim(),
      notes: draft.notes.trim(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    contacts.value = [...contacts.value, contact]
    await addOccupation(contact.occupation)
    if (auth.isLocal || !isFirebaseConfigured) {
      saveLocal()
      return contact
    }
    await setDoc(contactRef(contact.id), {
      ...contact,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return contact
  }

  async function updateContact(id: string, draft: ContactDraft) {
    const index = contacts.value.findIndex((contact) => contact.id === id)
    if (index === -1) return
    const next: Contact = {
      ...contacts.value[index],
      name: draft.name.trim(),
      email: draft.email.trim(),
      occupation: draft.occupation.trim(),
      notes: draft.notes.trim(),
      updatedAt: Date.now(),
    }
    contacts.value[index] = next
    await addOccupation(next.occupation)
    if (auth.isLocal || !isFirebaseConfigured) {
      saveLocal()
      return
    }
    await updateDoc(contactRef(id), {
      name: next.name,
      email: next.email,
      occupation: next.occupation,
      notes: next.notes,
      updatedAt: serverTimestamp(),
    })
  }

  async function deleteContact(id: string) {
    contacts.value = contacts.value.filter((contact) => contact.id !== id)
    if (auth.isLocal || !isFirebaseConfigured) {
      saveLocal()
      return
    }
    await deleteDoc(contactRef(id))
  }

  async function createProject(draft: ProjectDraft) {
    const placed = applyPlacement(
      {
        id: createId(),
        name: draft.name.trim(),
        clientId: draft.clientId,
        notes: draft.notes.trim(),
        columnId: draft.columnId,
        order: 0,
        budget: Number(draft.budget) || 0,
        paid: Number(draft.paid) || 0,
        hoursByDate: {},
        retainer: draft.retainer,
        retainerHoursPerMonth: Number(draft.retainerHoursPerMonth) || 0,
        inactive: draft.inactive,
        starred: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      draft,
    )
    const project: Project = {
      ...placed,
      order: projectsInColumn(placed.columnId).length,
    }
    projects.value = [...projects.value, project]
    if (auth.isLocal || !isFirebaseConfigured) {
      saveLocal()
      return project
    }
    await setDoc(projectRef(project.id), {
      ...project,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return project
  }

  async function updateProject(id: string, draft: Partial<ProjectDraft>) {
    const index = projects.value.findIndex((project) => project.id === id)
    if (index === -1) return
    const current = projects.value[index]
    const next = applyPlacement(
      {
        ...current,
        name: (draft.name ?? current.name).trim(),
        clientId: draft.clientId ?? current.clientId,
        notes: (draft.notes ?? current.notes).trim(),
        budget: draft.budget === undefined ? current.budget : Number(draft.budget) || 0,
        paid: draft.paid === undefined ? current.paid : Number(draft.paid) || 0,
      },
      {
        inactive: draft.inactive ?? current.inactive,
        retainer: draft.retainer ?? current.retainer,
        columnId: draft.columnId ?? current.columnId,
        retainerHoursPerMonth:
          draft.retainerHoursPerMonth ?? current.retainerHoursPerMonth,
      },
    )
    projects.value[index] = next
    if (auth.isLocal || !isFirebaseConfigured) {
      saveLocal()
      return
    }
    await updateDoc(projectRef(id), {
      name: next.name,
      clientId: next.clientId,
      notes: next.notes,
      columnId: next.columnId,
      budget: next.budget,
      paid: next.paid,
      retainer: next.retainer,
      retainerHoursPerMonth: next.retainerHoursPerMonth,
      inactive: next.inactive,
      updatedAt: serverTimestamp(),
    })
  }

  async function setStarred(id: string, starred: boolean) {
    const index = projects.value.findIndex((project) => project.id === id)
    if (index === -1) return
    const next = { ...projects.value[index], starred, updatedAt: Date.now() }
    projects.value[index] = next
    if (auth.isLocal || !isFirebaseConfigured) {
      saveLocal()
      return
    }
    await updateDoc(projectRef(id), {
      starred,
      updatedAt: serverTimestamp(),
    })
  }

  async function deleteProject(id: string) {
    projects.value = projects.value.filter((project) => project.id !== id)
    if (auth.isLocal || !isFirebaseConfigured) {
      saveLocal()
      return
    }
    await deleteDoc(projectRef(id))
  }

  async function reorderProjects(columnId: string, ids: string[]) {
    const column = sortedColumns.value.find((item) => item.id === columnId)
    const status = statusFromColumn(column)
    projects.value = projects.value.map((project) => {
      const order = ids.indexOf(project.id)
      if (order === -1) return project
      return applyPlacement(
        { ...project, order },
        { ...status, columnId },
      )
    })
    if (auth.isLocal || !isFirebaseConfigured) {
      saveLocal()
      return
    }
    const batch = writeBatch(requireDb())
    ids.forEach((id, order) => {
      const project = projects.value.find((item) => item.id === id)
      if (!project) return
      batch.update(projectRef(id), {
        columnId: project.columnId,
        order,
        retainer: project.retainer,
        inactive: project.inactive,
        updatedAt: Date.now(),
      })
    })
    await batch.commit()
  }

  async function setHours(projectId: string, date: string, hours: number) {
    const project = projects.value.find((item) => item.id === projectId)
    if (!project) return
    const nextHours = { ...project.hoursByDate }
    if (!hours) {
      delete nextHours[date]
    } else {
      nextHours[date] = hours
    }
    projects.value = projects.value.map((item) =>
      item.id === projectId
        ? { ...item, hoursByDate: nextHours, updatedAt: Date.now() }
        : item,
    )
    if (auth.isLocal || !isFirebaseConfigured) {
      saveLocal()
      return
    }
    await updateDoc(projectRef(projectId), {
      [`hoursByDate.${date}`]: hours ? hours : deleteField(),
      updatedAt: serverTimestamp(),
    })
  }

  return {
    columns,
    projects,
    clients,
    contacts,
    occupations,
    loading,
    ready,
    error,
    sortedColumns,
    workflowColumns,
    retainerColumn,
    inactiveColumn,
    sortedProjects,
    sortedClients,
    sortedContacts,
    sortedOccupations,
    emptyDraft,
    emptyClientDraft,
    emptyContactDraft,
    projectsInColumn,
    clientById,
    clientName,
    renameColumn,
    addColumn,
    removeColumn,
    createClient,
    createContact,
    updateContact,
    deleteContact,
    createProject,
    updateProject,
    setStarred,
    deleteProject,
    reorderProjects,
    setHours,
  }
})
