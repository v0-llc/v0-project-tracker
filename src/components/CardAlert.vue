<script setup lang="ts">
import { useBoardStore } from '../stores/board'
import type { Project } from '../types'

const props = defineProps<{
  project: Project
}>()

const board = useBoardStore()

async function toggle(event: Event) {
  event.preventDefault()
  event.stopPropagation()
  await board.setAlerted(props.project.id, !props.project.alerted)
}
</script>

<template>
  <button
    class="card-alert"
    type="button"
    :class="{ on: project.alerted }"
    :aria-pressed="project.alerted"
    :aria-label="project.alerted ? `Clear alert on ${project.name}` : `Mark ${project.name} as alert`"
    @pointerdown.stop
    @mousedown.stop
    @click="toggle"
  >
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path class="tri" d="M8 1.8 14.7 14.1H1.3L8 1.8Z" />
      <path class="bang" d="M8 6.2v3.4M8 11.6v.15" />
    </svg>
  </button>
</template>
