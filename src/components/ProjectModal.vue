<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { statusFromColumn } from '../lib/columns'
import { effectiveRate, formatHours, formatMoney, formatRate, hoursInMonth, toDateKey, totalHours } from '../lib/format'
import { useBoardStore } from '../stores/board'
import { NEW_CLIENT_VALUE, type Project, type ProjectDraft } from '../types'

const props = defineProps<{
  project: Project | null
  columnId: string
}>()

const emit = defineEmits<{
  close: []
}>()

const board = useBoardStore()
const dialog = ref<HTMLDialogElement | null>(null)
const draft = reactive<ProjectDraft>(board.emptyDraft())
const newClient = reactive(board.emptyClientDraft())
const logDate = ref(toDateKey(new Date()))
const logAmount = ref('')
const saving = ref(false)

const isEdit = computed(() => Boolean(props.project))
const creatingClient = computed(() => draft.clientId === NEW_CLIENT_VALUE)
const previewHours = computed(() => (props.project ? totalHours(props.project) : 0))
const previewRate = computed(() => {
  if (!props.project) return null
  return effectiveRate({ ...props.project, budget: Number(draft.budget) || 0 })
})
const selectedClient = computed(() =>
  creatingClient.value ? null : board.clientById(draft.clientId),
)

watch(
  () => [props.project, props.columnId] as const,
  ([project, columnId]) => {
    Object.assign(
      draft,
      project
        ? {
            name: project.name,
            clientId: project.clientId,
            notes: project.notes,
            columnId: project.columnId,
            budget: project.budget,
            paid: project.paid,
            retainer: project.retainer,
            retainerHoursPerMonth: project.retainerHoursPerMonth,
            inactive: project.inactive,
          }
        : {
            ...board.emptyDraft(columnId || board.workflowColumns[0]?.id || ''),
            ...statusFromColumn(board.sortedColumns.find((column) => column.id === columnId)),
          },
    )
    Object.assign(newClient, board.emptyClientDraft())
    logAmount.value = ''
    logDate.value = toDateKey(new Date())
  },
  { immediate: true },
)

watch(dialog, (el) => {
  el?.showModal()
})

async function resolveClientId() {
  if (draft.clientId !== NEW_CLIENT_VALUE) return draft.clientId
  if (!newClient.name.trim()) return ''
  const created = await board.createClient({ ...newClient })
  return created.id
}

async function save() {
  if (!draft.name.trim()) return
  if (creatingClient.value && !newClient.name.trim()) return
  saving.value = true
  try {
    const clientId = await resolveClientId()
    const payload = { ...draft, clientId }
    if (props.project) {
      await board.updateProject(props.project.id, payload)
    } else {
      await board.createProject(payload)
    }
    emit('close')
  } finally {
    saving.value = false
  }
}

async function addHours() {
  if (!props.project) return
  const hours = Number(logAmount.value)
  if (!hours) return
  await board.setHours(props.project.id, logDate.value, hours)
  logAmount.value = ''
}

async function remove() {
  if (!props.project) return
  if (!window.confirm(`Delete “${props.project.name}”? This cannot be undone.`)) return
  await board.deleteProject(props.project.id)
  emit('close')
}

function onDialogClick(event: MouseEvent) {
  if (event.target === dialog.value) emit('close')
}

const canSave = computed(() => {
  if (!draft.name.trim()) return false
  if (creatingClient.value && !newClient.name.trim()) return false
  return !saving.value
})

const workflowColumns = computed(() => board.workflowColumns)

const thisMonthHours = computed(() => {
  if (!props.project) return 0
  const today = new Date()
  return hoursInMonth(props.project, today.getFullYear(), today.getMonth())
})

function setRetainer(on: boolean) {
  draft.retainer = on
  if (on) draft.inactive = false
}

function setInactive(on: boolean) {
  draft.inactive = on
  if (on) draft.retainer = false
}
</script>

<template>
  <dialog ref="dialog" class="modal-backdrop" @close="emit('close')" @click="onDialogClick">
    <div class="modal" @click.stop>
      <header>
        <div>
          <p class="label">{{ isEdit ? 'Project' : 'New project' }}</p>
          <h2>{{ isEdit ? draft.name || 'Untitled' : 'Open a job' }}</h2>
        </div>
        <button class="icon-btn" type="button" aria-label="Close" @click="emit('close')">✕</button>
      </header>

      <form @submit.prevent="save">
        <label class="field">
          <span class="label">Name</span>
          <input v-model="draft.name" required placeholder="Festival open, brand film…" />
        </label>

        <div class="field-row">
          <label class="field">
            <span class="label">Client</span>
            <select v-model="draft.clientId">
              <option value="">No client</option>
              <option
                v-for="client in board.sortedClients"
                :key="client.id"
                :value="client.id"
              >
                {{ client.name }}
              </option>
              <option :value="NEW_CLIENT_VALUE">+ New client</option>
            </select>
          </label>
          <label class="field">
            <span class="label">Column</span>
            <select v-model="draft.columnId" :disabled="draft.retainer || draft.inactive">
              <option v-for="column in workflowColumns" :key="column.id" :value="column.id">
                {{ column.name }}
              </option>
            </select>
          </label>
        </div>

        <div v-if="creatingClient" class="client-create">
          <p class="label">New client</p>
          <label class="field">
            <span class="label">Name</span>
            <input v-model="newClient.name" required placeholder="Northlight, studio, brand" />
          </label>
          <label class="field">
            <span class="label">Primary contact</span>
            <input v-model="newClient.contact" placeholder="Name, email, or both" />
          </label>
          <label class="field">
            <span class="label">Notes</span>
            <textarea v-model="newClient.notes" placeholder="Billing, preferences, relationships" />
          </label>
        </div>

        <p v-else-if="selectedClient?.contact || selectedClient?.notes" class="empty" style="padding: 0">
          <span v-if="selectedClient.contact">{{ selectedClient.contact }}</span>
          <span v-if="selectedClient.contact && selectedClient.notes"> · </span>
          <span v-if="selectedClient.notes">{{ selectedClient.notes }}</span>
        </p>

        <div class="status-row">
          <button
            class="stamp"
            type="button"
            :aria-pressed="draft.retainer"
            :class="{ on: draft.retainer }"
            @click="setRetainer(!draft.retainer)"
          >
            Retainer
          </button>
          <button
            class="stamp stamp-quiet"
            type="button"
            :aria-pressed="draft.inactive"
            :class="{ on: draft.inactive }"
            @click="setInactive(!draft.inactive)"
          >
            Inactive
          </button>
        </div>
        <p class="status-hint">
          <template v-if="draft.inactive">Complete and paid — hidden in the collapsed column at the end.</template>
          <template v-else-if="draft.retainer">Stays in Retainers. Set the hours you expect each month.</template>
          <template v-else>Ordinary job. It lives in the workflow column above.</template>
        </p>

        <label v-if="draft.retainer" class="field">
          <span class="label">Hours / month</span>
          <input v-model.number="draft.retainerHoursPerMonth" type="number" min="0" step="0.5" />
          <span v-if="project" class="status-hint">
            {{ formatHours(thisMonthHours) }} logged this month
          </span>
        </label>

        <div class="field-row">
          <label class="field">
            <span class="label">Budget</span>
            <input v-model.number="draft.budget" type="number" min="0" step="50" />
          </label>
          <label class="field">
            <span class="label">Paid</span>
            <input v-model.number="draft.paid" type="number" min="0" step="50" />
          </label>
        </div>

        <label class="field">
          <span class="label">Notes</span>
          <textarea v-model="draft.notes" placeholder="Scope, deliverables, invoice notes" />
        </label>

        <div class="rate-strip">
          <div>
            <span>Hours</span>
            <b>{{ formatHours(previewHours) }}</b>
          </div>
          <div>
            <span>Budget</span>
            <b>{{ formatMoney(Number(draft.budget) || 0) }}</b>
          </div>
          <div>
            <span>Effective rate</span>
            <b>{{ formatRate(previewRate) }}</b>
          </div>
        </div>

        <div v-if="project" class="field-row">
          <label class="field">
            <span class="label">Log hours</span>
            <input v-model="logDate" type="date" />
          </label>
          <label class="field">
            <span class="label">Hours that day</span>
            <input
              v-model="logAmount"
              inputmode="decimal"
              placeholder="2.5"
              @keydown.enter.prevent="addHours"
            />
          </label>
        </div>
        <button v-if="project" class="ghost-btn" type="button" @click="addHours">
          Save hours for that day
        </button>
      </form>

      <footer>
        <button v-if="project" class="text-btn danger-btn" type="button" @click="remove">
          Delete
        </button>
        <span v-else></span>
        <div class="header-cluster">
          <button class="ghost-btn" type="button" @click="emit('close')">Cancel</button>
          <button class="primary-btn" type="button" :disabled="!canSave" @click="save">
            {{ isEdit ? 'Save project' : 'Create project' }}
          </button>
        </div>
      </footer>
    </div>
  </dialog>
</template>
