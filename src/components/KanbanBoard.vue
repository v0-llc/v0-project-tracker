<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import draggable from 'vuedraggable'
import { columnKind } from '../lib/columns'
import { effectiveRate, formatHours, formatMoney, formatRate, hoursInMonth, totalHours } from '../lib/format'
import { useBoardStore } from '../stores/board'
import type { Column, Project } from '../types'
import ColumnDensity from './ColumnDensity.vue'
import ColumnTint from './ColumnTint.vue'
import ProjectCard from './ProjectCard.vue'
import ProjectModal from './ProjectModal.vue'

const board = useBoardStore()
const scrollerEl = ref<HTMLElement | null>(null)
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

function onInactiveRailClick(event: MouseEvent) {
  if (inactiveOpen.value) return
  const target = event.target as HTMLElement
  if (target.closest('.column-tint, .column-density')) return
  toggleInactive()
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

function onDragStart() {
  dragging.value = true
  window.getSelection()?.removeAllRanges()
}

function onDragEnd() {
  dragging.value = false
}

function onBoardWheel(event: WheelEvent) {
  const el = scrollerEl.value
  if (!el) return
  const dx = event.shiftKey && !event.deltaX ? event.deltaY : event.deltaX
  const dy = event.shiftKey && !event.deltaX ? 0 : event.deltaY
  if (Math.abs(dx) <= Math.abs(dy)) return
  const max = el.scrollWidth - el.clientWidth
  if (max <= 1) return
  const next = Math.min(max, Math.max(0, el.scrollLeft + dx))
  if (next === el.scrollLeft) return
  event.preventDefault()
  el.scrollLeft = next
}

onMounted(() => {
  scrollerEl.value?.addEventListener('wheel', onBoardWheel, { passive: false })
})

onUnmounted(() => {
  scrollerEl.value?.removeEventListener('wheel', onBoardWheel)
})

function monthHours(project: Project) {
  return hoursInMonth(project, now.getFullYear(), now.getMonth())
}

function columnClass(column: Column) {
  const kind = columnKind(column)
  return {
    'column-retainer': kind === 'retainer',
    'column-inactive': kind === 'inactive',
    tinted: Boolean(column.color),
    condensed: Boolean(column.condensed),
    collapsed: kind === 'inactive' && !inactiveOpen.value,
  }
}

function columnStyle(column: Column) {
  return column.color ? { '--column-tint': column.color } : undefined
}
</script>

<template>
  <section class="board-wrap">
    <div class="hours-toolbar board-toolbar">
      <button class="ghost-btn" type="button" @click="board.addColumn()">
        Add column
      </button>
    </div>
    <div ref="scrollerEl" class="board-scroller">
    <div class="board" :class="{ 'is-dragging': dragging }">
    <article
      v-for="column in board.workflowColumns"
      :key="column.id"
      class="column"
      :class="columnClass(column)"
      :style="columnStyle(column)"
    >
      <header class="column-head">
        <div class="column-title">
          <div class="column-meta">
            <span class="column-count">{{ lists[column.id]?.length ?? 0 }}</span>
            <ColumnTint :column-id="column.id" :color="column.color" />
            <ColumnDensity :column-id="column.id" :condensed="column.condensed" />
          </div>
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
        @start="onDragStart"
        @end="onDragEnd"
      >
        <template #item="{ element }: { element: Project }">
          <ProjectCard :project="element" :condensed="column.condensed" @open="openProject(element)">
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
      :style="columnStyle(board.retainerColumn)"
    >
      <header class="column-head">
        <div class="column-title">
          <div class="column-meta">
            <span class="column-count">Retainer · {{ lists[board.retainerColumn.id]?.length ?? 0 }}</span>
            <ColumnTint :column-id="board.retainerColumn.id" :color="board.retainerColumn.color" />
            <ColumnDensity :column-id="board.retainerColumn.id" :condensed="board.retainerColumn.condensed" />
          </div>
          <strong class="column-lock">Retainers</strong>
        </div>
        <div class="header-cluster">
          <button class="icon-btn" type="button" aria-label="Add retainer" @click="openCreate(board.retainerColumn.id)">+</button>
        </div>
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
        @start="onDragStart"
        @end="onDragEnd"
      >
        <template #item="{ element }: { element: Project }">
          <ProjectCard :project="element" :condensed="board.retainerColumn.condensed" @open="openProject(element)">
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
      :style="columnStyle(board.inactiveColumn)"
      @click="onInactiveRailClick"
    >
      <header class="column-head">
        <div class="column-title">
          <div class="column-meta">
            <span class="column-count">{{ lists[board.inactiveColumn.id]?.length ?? 0 }} paid up</span>
            <ColumnTint :column-id="board.inactiveColumn.id" :color="board.inactiveColumn.color" />
            <ColumnDensity :column-id="board.inactiveColumn.id" :condensed="board.inactiveColumn.condensed" />
          </div>
          <button
            class="inactive-toggle"
            type="button"
            :aria-expanded="inactiveOpen"
            @click.stop="toggleInactive"
          >
            <strong class="column-lock">Inactive</strong>
          </button>
        </div>
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
          @start="onDragStart"
          @end="onDragEnd"
        >
          <template #item="{ element }: { element: Project }">
            <ProjectCard :project="element" muted :condensed="board.inactiveColumn.condensed" @open="openProject(element)">
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
        @start="onDragStart"
        @end="onDragEnd"
      >
        <template #item="{ element }: { element: Project }">
          <span class="sr-only">{{ element.name }}</span>
        </template>
      </draggable>
    </article>
    </div>
    </div>

    <ProjectModal
      v-if="modalOpen"
      :project="activeProject"
      :column-id="activeColumnId"
      @close="modalOpen = false"
    />
  </section>
</template>
