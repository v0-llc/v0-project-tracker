<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useBoardStore } from '../stores/board'
import type { Contact, ContactDraft } from '../types'

const props = defineProps<{
  contact: Contact | null
}>()

const emit = defineEmits<{
  close: []
}>()

const board = useBoardStore()
const dialog = ref<HTMLDialogElement | null>(null)
const draft = reactive<ContactDraft>(board.emptyContactDraft())
const saving = ref(false)
const occupationOpen = ref(false)

const isEdit = computed(() => Boolean(props.contact))

const occupationChoices = computed(() => {
  const query = draft.occupation.trim().toLowerCase()
  const names = board.sortedOccupations
  if (!query) return names
  return names.filter((name) => name.toLowerCase().includes(query))
})

const showNewOccupation = computed(() => {
  const query = draft.occupation.trim()
  if (!query) return false
  return !board.sortedOccupations.some((name) => name.toLowerCase() === query.toLowerCase())
})

watch(
  () => props.contact,
  (contact) => {
    Object.assign(draft, contact ? {
      name: contact.name,
      email: contact.email,
      occupation: contact.occupation,
      notes: contact.notes,
    } : board.emptyContactDraft())
  },
  { immediate: true },
)

watch(dialog, (el) => {
  el?.showModal()
})

async function save() {
  if (!draft.name.trim()) return
  saving.value = true
  try {
    if (props.contact) {
      await board.updateContact(props.contact.id, draft)
    } else {
      await board.createContact(draft)
    }
    emit('close')
  } finally {
    saving.value = false
  }
}

async function remove() {
  if (!props.contact) return
  if (!window.confirm(`Delete “${props.contact.name}”? This cannot be undone.`)) return
  await board.deleteContact(props.contact.id)
  emit('close')
}

function chooseOccupation(name: string) {
  draft.occupation = name
  occupationOpen.value = false
}

function onDialogClick(event: MouseEvent) {
  if (event.target === dialog.value) emit('close')
}

const canSave = computed(() => Boolean(draft.name.trim()) && !saving.value)
</script>

<template>
  <dialog ref="dialog" class="modal-backdrop" @close="emit('close')" @click="onDialogClick">
    <div class="modal" @click.stop>
      <header>
        <div>
          <p class="label">{{ isEdit ? 'Contact' : 'New contact' }}</p>
          <h2>{{ isEdit ? draft.name || 'Untitled' : 'Add a person' }}</h2>
        </div>
        <button class="icon-btn" type="button" aria-label="Close" @click="emit('close')">✕</button>
      </header>

      <form @submit.prevent="save">
        <label class="field">
          <span class="label">Name</span>
          <input v-model="draft.name" required placeholder="Soleil Singh" />
        </label>

        <div class="field-row">
          <label class="field">
            <span class="label">Email</span>
            <input v-model="draft.email" type="email" placeholder="name@studio.com" />
          </label>
          <label class="field occupation-field">
            <span class="label">Occupation</span>
            <input
              v-model="draft.occupation"
              placeholder="Designer, producer…"
              autocomplete="off"
              @focus="occupationOpen = true"
              @blur="occupationOpen = false"
            />
            <ul v-if="occupationOpen && (occupationChoices.length || showNewOccupation)" class="occupation-menu">
              <li v-if="showNewOccupation">
                <button type="button" @mousedown.prevent="chooseOccupation(draft.occupation.trim())">
                  Add “{{ draft.occupation.trim() }}”
                </button>
              </li>
              <li v-for="name in occupationChoices" :key="name">
                <button type="button" @mousedown.prevent="chooseOccupation(name)">{{ name }}</button>
              </li>
            </ul>
          </label>
        </div>

        <label class="field">
          <span class="label">Notes</span>
          <textarea v-model="draft.notes" placeholder="How you met, what they need, follow-up" />
        </label>
      </form>

      <footer>
        <button v-if="contact" class="text-btn danger-btn" type="button" @click="remove">
          Delete
        </button>
        <span v-else></span>
        <div class="header-cluster">
          <button class="ghost-btn" type="button" @click="emit('close')">Cancel</button>
          <button class="primary-btn" type="button" :disabled="!canSave" @click="save">
            {{ isEdit ? 'Save contact' : 'Add contact' }}
          </button>
        </div>
      </footer>
    </div>
  </dialog>
</template>
