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
  await board.setStarred(props.project.id, !props.project.starred)
}
</script>

<template>
  <button
    class="card-star"
    type="button"
    :class="{ on: project.starred }"
    :aria-pressed="project.starred"
    :aria-label="project.starred ? `Unstar ${project.name}` : `Star ${project.name}`"
    @pointerdown.stop
    @mousedown.stop
    @click="toggle"
  >
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M8 1.4 9.7 5.6l4.5.4-3.4 2.9 1 4.4L8 11.2 4.2 13.3l1-4.4L1.8 6l4.5-.4L8 1.4Z"
      />
    </svg>
  </button>
</template>
