<script setup lang="ts">
import { computed, ref } from 'vue'
import { columnKind } from '../lib/columns'
import { effectiveRate, formatHours, formatMoney, formatRate, totalHours } from '../lib/format'
import { useBoardStore } from '../stores/board'
import type { Project } from '../types'
import ProjectModal from './ProjectModal.vue'

const board = useBoardStore()
const activeProject = ref<Project | null>(null)

const items = computed(() => board.archivedProjects)

function columnLabel(project: Project) {
  const column = board.sortedColumns.find((item) => item.id === project.columnId)
  if (!column) return ''
  const kind = columnKind(column)
  if (kind === 'retainer') return 'Retainers'
  if (kind === 'inactive') return 'Inactive'
  return column.name
}

function lastLogged(project: Project) {
  const dates = Object.keys(project.hoursByDate)
    .filter((date) => project.hoursByDate[date])
    .sort()
  return dates.at(-1) ?? ''
}

function open(project: Project) {
  activeProject.value = project
}
</script>

<template>
  <section class="hours-wrap">
    <div class="hours-toolbar">
      <div>
        <p class="label">Held aside</p>
        <strong class="contacts-title">{{ items.length }} archived</strong>
      </div>
    </div>

    <div v-if="!items.length" class="empty">
      Archive a job from its project sheet. Hours, notes, and money stay on the record.
    </div>

    <div v-else class="archive-ledger">
      <div class="archive-head">
        <span>Job</span>
        <span>Client</span>
        <span>Hours</span>
        <span>Budget</span>
        <span>Rate</span>
      </div>
      <button
        v-for="project in items"
        :key="project.id"
        class="archive-row"
        type="button"
        @click="open(project)"
      >
        <span class="archive-job">
          <b>{{ project.name }}</b>
          <small>{{ columnLabel(project) }}{{ lastLogged(project) ? ` · ${lastLogged(project)}` : '' }}</small>
        </span>
        <span>{{ board.clientName(project.clientId) || '—' }}</span>
        <span>{{ formatHours(totalHours(project)) }}</span>
        <span>{{ formatMoney(project.budget) }}</span>
        <span>{{ formatRate(effectiveRate(project)) }}</span>
      </button>
    </div>

    <ProjectModal
      v-if="activeProject"
      :project="activeProject"
      :column-id="activeProject.columnId"
      @close="activeProject = null"
    />
  </section>
</template>
