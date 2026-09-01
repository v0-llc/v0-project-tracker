<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  daysInMonth,
  formatHours,
  hoursInMonth,
  isSameDay,
  isWeekend,
  monthLabel,
  toDateKey,
  weekdayLabel,
} from '../lib/format'
import { tracksHours } from '../lib/columns'
import { useBoardStore } from '../stores/board'
import type { Project } from '../types'
import ProjectModal from './ProjectModal.vue'

const board = useBoardStore()
const today = new Date()
const year = ref(today.getFullYear())
const month = ref(today.getMonth())
const activeProject = ref<Project | null>(null)

const days = computed(() => daysInMonth(year.value, month.value))
const hideIdle = ref(localStorage.getItem('slate.hours-hide-idle') === '1')
const projects = computed(() => {
  const hiddenColumns = new Set(
    board.sortedColumns.filter((column) => !tracksHours(column)).map((column) => column.id),
  )
  return board.sortedProjects.filter((project) => {
    if (project.archived) return false
    if (hiddenColumns.has(project.columnId)) return false
    if (hideIdle.value && hoursInMonth(project, year.value, month.value) <= 0) return false
    return true
  })
})

function toggleHideIdle() {
  hideIdle.value = !hideIdle.value
  localStorage.setItem('slate.hours-hide-idle', hideIdle.value ? '1' : '0')
}

function cellHours(project: Project, date: string) {
  const hours = project.hoursByDate[date]
  return hours ? formatHours(hours) : ''
}

async function onHoursChange(project: Project, date: string, event: Event) {
  const input = event.target as HTMLInputElement
  const raw = input.value.trim()
  const hours = raw === '' ? 0 : Number(raw)
  if (Number.isNaN(hours) || hours < 0) {
    input.value = cellHours(project, date)
    return
  }
  await board.setHours(project.id, date, hours)
}

function shiftMonth(delta: number) {
  const next = new Date(year.value, month.value + delta, 1)
  year.value = next.getFullYear()
  month.value = next.getMonth()
}

function jumpToday() {
  year.value = today.getFullYear()
  month.value = today.getMonth()
}

function monthTotal(project: Project) {
  return hoursInMonth(project, year.value, month.value)
}

const grandTotal = computed(() =>
  projects.value.reduce((sum, project) => sum + monthTotal(project), 0),
)
</script>

<template>
  <section class="hours-wrap">
    <div class="hours-toolbar">
      <div class="month-nav">
        <button class="icon-btn" type="button" aria-label="Previous month" @click="shiftMonth(-1)">←</button>
        <strong>{{ monthLabel(year, month) }}</strong>
        <button class="icon-btn" type="button" aria-label="Next month" @click="shiftMonth(1)">→</button>
      </div>
      <div class="header-cluster">
        <button
          class="ghost-btn"
          type="button"
          :aria-pressed="hideIdle"
          @click="toggleHideIdle"
        >
          {{ hideIdle ? 'Show idle' : 'Hide idle' }}
        </button>
        <button class="ghost-btn" type="button" @click="jumpToday">Today</button>
      </div>
    </div>

    <div v-if="!board.liveProjects.length" class="empty">
      Add a project on the board before logging hours.
    </div>
    <div v-else-if="!projects.length" class="empty">
      No visible projects this month. Show idle, or turn on hours for a column.
    </div>

    <div v-else class="hours-scroller">
      <table class="hours-table">
        <thead>
          <tr>
            <th class="sticky-col">
              <div class="hours-head">
                Date
                <small>{{ formatHours(grandTotal) }} hrs</small>
              </div>
            </th>
            <th v-for="project in projects" :key="project.id">
              <button class="hours-head" type="button" @click="activeProject = project">
                {{ project.name }}
                <small v-if="project.retainer && project.retainerHoursPerMonth">
                  {{ formatHours(monthTotal(project)) }} / {{ formatHours(project.retainerHoursPerMonth) }} hrs
                </small>
                <small v-else>{{ formatHours(monthTotal(project)) }} hrs</small>
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="day in days"
            :key="toDateKey(day)"
            :class="{ weekend: isWeekend(day), today: isSameDay(day, today) }"
          >
            <th class="sticky-col">
              <div class="date-cell">
                <span>{{ weekdayLabel(day) }}</span>
                <span>{{ day.getDate() }}</span>
              </div>
            </th>
            <td v-for="project in projects" :key="project.id">
              <input
                class="hour-input"
                inputmode="decimal"
                :aria-label="`Hours for ${project.name} on ${toDateKey(day)}`"
                :value="cellHours(project, toDateKey(day))"
                @change="onHoursChange(project, toDateKey(day), $event)"
              />
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td class="sticky-col">Total</td>
            <td v-for="project in projects" :key="project.id">
              {{ formatHours(monthTotal(project)) }}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>

    <ProjectModal
      v-if="activeProject"
      :project="activeProject"
      :column-id="activeProject.columnId"
      @close="activeProject = null"
    />
  </section>
</template>
