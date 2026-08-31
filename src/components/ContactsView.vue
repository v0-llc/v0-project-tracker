<script setup lang="ts">
import { computed, ref } from 'vue'
import { useBoardStore } from '../stores/board'
import type { Contact } from '../types'
import ContactModal from './ContactModal.vue'

const board = useBoardStore()
const activeContact = ref<Contact | null>(null)
const modalOpen = ref(false)
const occupationFilter = ref('')

const occupationsInUse = computed(() => {
  const names = new Set(
    board.sortedContacts.map((contact) => contact.occupation.trim()).filter(Boolean),
  )
  return [...names].sort((a, b) => a.localeCompare(b))
})

const visibleContacts = computed(() => {
  if (!occupationFilter.value) return board.sortedContacts
  return board.sortedContacts.filter(
    (contact) => contact.occupation.trim().toLowerCase() === occupationFilter.value.toLowerCase(),
  )
})

const groups = computed(() => {
  const byOccupation = new Map<string, Contact[]>()
  for (const contact of visibleContacts.value) {
    const key = contact.occupation.trim() || 'Unlisted'
    const list = byOccupation.get(key) ?? []
    list.push(contact)
    byOccupation.set(key, list)
  }
  return [...byOccupation.entries()].sort(([a], [b]) => {
    if (a === 'Unlisted') return 1
    if (b === 'Unlisted') return -1
    return a.localeCompare(b)
  })
})

function openCreate() {
  activeContact.value = null
  modalOpen.value = true
}

function openContact(contact: Contact) {
  activeContact.value = contact
  modalOpen.value = true
}
</script>

<template>
  <section class="hours-wrap">
    <div class="hours-toolbar">
      <div>
        <p class="label">People</p>
        <strong class="contacts-title">{{ board.sortedContacts.length }} contacts</strong>
      </div>
      <div class="header-cluster">
        <button class="primary-btn" type="button" @click="openCreate">Add contact</button>
      </div>
    </div>

    <div v-if="occupationsInUse.length" class="occupation-filters" role="tablist" aria-label="Filter by occupation">
      <button
        class="ghost-btn"
        type="button"
        role="tab"
        :aria-selected="!occupationFilter"
        :class="{ on: !occupationFilter }"
        @click="occupationFilter = ''"
      >
        All
      </button>
      <button
        v-for="name in occupationsInUse"
        :key="name"
        class="ghost-btn"
        type="button"
        role="tab"
        :aria-selected="occupationFilter === name"
        :class="{ on: occupationFilter === name }"
        @click="occupationFilter = occupationFilter === name ? '' : name"
      >
        {{ name }}
      </button>
    </div>

    <div v-if="!board.sortedContacts.length" class="empty">
      No contacts yet. Add the people who aren’t a job.
    </div>

    <div v-else-if="!visibleContacts.length" class="empty">
      No one listed as {{ occupationFilter }}.
    </div>

    <div v-else class="contact-groups">
      <section v-for="[occupation, people] in groups" :key="occupation" class="contact-group">
        <header class="contact-group-head">
          <span class="column-count">{{ String(people.length).padStart(2, '0') }}</span>
          <h2>{{ occupation }}</h2>
        </header>
        <div class="contact-grid">
          <article
            v-for="contact in people"
            :key="contact.id"
            class="project-card contact-card"
            role="button"
            tabindex="0"
            @click="openContact(contact)"
            @keydown.enter="openContact(contact)"
          >
            <h3>{{ contact.name }}</h3>
            <p v-if="contact.email" class="contact-email">{{ contact.email }}</p>
            <p v-if="contact.notes" class="contact-notes">{{ contact.notes }}</p>
          </article>
        </div>
      </section>
    </div>

    <ContactModal
      v-if="modalOpen"
      :contact="activeContact"
      @close="modalOpen = false"
    />
  </section>
</template>
