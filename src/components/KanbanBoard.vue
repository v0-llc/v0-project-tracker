<script setup lang="ts">
import { computed, ref } from 'vue'
import draggable from 'vuedraggable'
import { columnKind } from '../lib/columns'
import { effectiveRate, formatHours, formatMoney, formatRate, hoursInMonth, totalHours } from '../lib/format'
import { useBoardStore } from '../stores/board'
import type { Column, Project } from '../types'
import ProjectCard from './ProjectCard.vue'
import ProjectModal from './ProjectModal.vue'

const board = useBoardStore()
const dragging = ref(false)
const modalOpen = ref(false)
const activeProject = ref<Project | null>(null)
const activeColumnId = ref('')
const inactiveOpen = ref(localStorage.getItem('slate.inactive-open') === '1')

const lists = computed(() => {
  const next: Record<string, Project[]> = {}
  for (const column of board.sortedColumns) {
    next[column.id] = board.projectsInColumn(column.id)
  }
  return next
})

const now = new Date()

function toggleInactive() {
  inactiveOpen.value = !inactiveOpen.value
  localStorage.setItem('slate.inactive-open', inactiveOpen.value ? '1' : '0')
}

function openCreate(columnId: string) {
  if (dragging.value) return
  activeProject.value = null
  activeColumnId.value = columnId
  modalOpen.value = true
}

function openProject(project: Project) {
  if (dragging.value) return
  activeProject.value = project
  activeColumnId.value = project.columnId
  modalOpen.value = true
}

async function onListChange(columnId: string, next: Project[]) {
  await board.reorderProjects(columnId, next.map((project) => project.id))
}

function onRename(columnId: string, event: Event) {
  const value = (event.target as HTMLInputElement).value
  void board.renameColumn(columnId, value)
}

async function removeColumn(columnId: string, name: string) {
  if (!window.confirm(`Remove the “${name}” column? Projects will move to the first remaining column.`)) {
    return
  }
  await board.removeColumn(columnId)
}

function monthHours(project: Project) {
  return hoursInMonth(project, now.getFullYear(), now.getMonth())
}

function columnClass(column: Column) {
  const kind = columnKind(column)
  return {
    'column-retainer': kind === 'retainer',
    'column-inactive': kind === 'inactive',
    collapsed: kind === 'inactive' && !inactiveOpen.value,
  }
}
</script>

<template>
  <section class="board-wrap">
    <div class="hours-toolbar board-toolbar">
      <button class="ghost-btn" type="button" @click="board.addColumn()">
        Add column
      </button>
    </div>
    <div class="board">
    <article
      v-for="column in board.workflowColumns"
      :key="column.id"
      class="column"
    >
      <header class="column-head">
        <div class="column-title">
          <span class="column-count">{{ lists[column.id]?.length ?? 0 }}</span>
          <input
            :value="column.name"
            :aria-label="`Rename ${column.name}`"
            @change="onRename(column.id, $event)"
          />
        </div>
        <div class="header-cluster">
          <button class="icon-btn" type="button" aria-label="Add project" @click="openCreate(column.id)">+</button>
          <button
            class="icon-btn"
            type="button"
            aria-label="Remove column"
            :disabled="board.workflowColumns.length <= 1"
            @click="removeColumn(column.id, column.name)"
          >
            −
          </button>
        </div>
      </header>

      <draggable
        class="card-list"
        :model-value="lists[column.id] ?? []"
        group="projects"
        item-key="id"
        :animation="180"
        :force-fallback="true"
        ghost-class="card-ghost"
        drag-class="card-drag"
        @update:model-value="(next: Project[]) => onListChange(column.id, next)"
        @start="dragging = true"
        @end="dragging = false"
      >
        <template #item="{ element }: { element: Project }">
          <ProjectCard :project="element" @open="openProject(element)">
            <div class="card-meta">
              <div>
                <span class="label">Hours</span>
                <b>{{ formatHours(totalHours(element)) }}</b>
              </div>
              <div>
                <span class="label">Budget</span>
                <b>{{ formatMoney(element.budget) }}</b>
              </div>
              <div>
                <span class="label">Rate</span>
                <b>{{ formatRate(effectiveRate(element)) }}</b>
              </div>
            </div>
          </ProjectCard>
        </template>
      </draggable>

      <p v-if="!(lists[column.id]?.length)" class="empty">Drop a card here, or add one.</p>
    </article>

    <article
      v-if="board.retainerColumn"
      :key="board.retainerColumn.id"
      class="column"
      :class="columnClass(board.retainerColumn)"
    >
      <header class="column-head">
        <div class="column-title">
          <span class="column-count">Retainer · {{ lists[board.retainerColumn.id]?.length ?? 0 }}</span>
          <strong class="column-lock">Retainers</strong>
        </div>
        <button class="icon-btn" type="button" aria-label="Add retainer" @click="openCreate(board.retainerColumn.id)">+</button>
      </header>

      <draggable
        class="card-list"
        :model-value="lists[board.retainerColumn.id] ?? []"
        group="projects"
        item-key="id"
        :animation="180"
        :force-fallback="true"
        ghost-class="card-ghost"
        drag-class="card-drag"
        @update:model-value="(next: Project[]) => onListChange(board.retainerColumn!.id, next)"
        @start="dragging = true"
        @end="dragging = false"
      >
        <template #item="{ element }: { element: Project }">
          <ProjectCard :project="element" @open="openProject(element)">
            <div
              class="pace"
              :class="{
                short: element.retainerHoursPerMonth > 0 && monthHours(element) < element.retainerHoursPerMonth,
                met: element.retainerHoursPerMonth > 0 && monthHours(element) >= element.retainerHoursPerMonth,
              }"
            >
              <span>{{ formatHours(monthHours(element)) }} / {{ formatHours(element.retainerHoursPerMonth) }} this month</span>
              <i
                v-if="element.retainerHoursPerMonth"
                :style="{
                  width: `${Math.min(100, (monthHours(element) / element.retainerHoursPerMonth) * 100)}%`,
                }"
              />
            </div>
            <div class="card-meta">
              <div>
                <span class="label">Lifetime</span>
                <b>{{ formatHours(totalHours(element)) }}</b>
              </div>
              <div>
                <span class="label">Budget / mo</span>
                <b>{{ formatMoney(element.budget) }}</b>
              </div>
              <div>
                <span class="label">Rate</span>
                <b>{{ formatRate(effectiveRate(element)) }}</b>
              </div>
            </div>
          </ProjectCard>
        </template>
      </draggable>

      <p v-if="!(lists[board.retainerColumn.id]?.length)" class="empty">Mark a job as a retainer, or drop it here.</p>
    </article>

    <article
      v-if="board.inactiveColumn"
      :key="board.inactiveColumn.id"
      class="column"
      :class="columnClass(board.inactiveColumn)"
    >
      <header class="column-head">
        <button
          class="inactive-toggle"
          type="button"
          :aria-expanded="inactiveOpen"
          @click="toggleInactive"
        >
          <span class="column-count">{{ lists[board.inactiveColumn.id]?.length ?? 0 }} paid up</span>
          <strong class="column-lock">Inactive</strong>
        </button>
      </header>

      <template v-if="inactiveOpen">
        <draggable
          class="card-list"
          :model-value="lists[board.inactiveColumn.id] ?? []"
          group="projects"
          item-key="id"
          :animation="180"
          :force-fallback="true"
          ghost-class="card-ghost"
          drag-class="card-drag"
          @update:model-value="(next: Project[]) => onListChange(board.inactiveColumn!.id, next)"
          @start="dragging = true"
          @end="dragging = false"
        >
          <template #item="{ element }: { element: Project }">
            <ProjectCard :project="element" muted @open="openProject(element)">
              <div class="card-meta">
                <div>
                  <span class="label">Hours</span>
                  <b>{{ formatHours(totalHours(element)) }}</b>
                </div>
                <div>
                  <span class="label">Paid</span>
                  <b>{{ formatMoney(element.paid) }}</b>
                </div>
                <div>
                  <span class="label">Rate</span>
                  <b>{{ formatRate(effectiveRate(element)) }}</b>
                </div>
              </div>
            </ProjectCard>
          </template>
        </draggable>
        <p v-if="!(lists[board.inactiveColumn.id]?.length)" class="empty">Finished and paid jobs land here.</p>
      </template>
      <draggable
        v-else
        class="card-list collapsed-drop"
        :model-value="lists[board.inactiveColumn.id] ?? []"
        group="projects"
        item-key="id"
        :force-fallback="true"
        ghost-class="card-ghost"
        @update:model-value="(next: Project[]) => onListChange(board.inactiveColumn!.id, next)"
        @start="dragging = true"
        @end="dragging = false"
      >
        <template #item="{ element }: { element: Project }">
          <span class="sr-only">{{ element.name }}</span>
        </template>
      </draggable>
    </article>
    </div>

    <ProjectModal
      v-if="modalOpen"
      :project="activeProject"
      :column-id="activeColumnId"
      @close="modalOpen = false"
    />
  </section>
</template>
