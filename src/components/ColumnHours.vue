<script setup lang="ts">
import { computed } from 'vue'
import { tracksHours } from '../lib/columns'
import { useBoardStore } from '../stores/board'
import type { Column } from '../types'

const props = defineProps<{
  column: Column
}>()

const board = useBoardStore()
const tracking = computed(() => tracksHours(props.column))

async function toggle() {
  await board.setColumnTrackHours(props.column.id, !tracking.value)
}
</script>

<template>
  <button
    class="column-hours"
    type="button"
    :class="{ on: tracking }"
    :aria-pressed="tracking"
    :aria-label="tracking ? 'Hide this column from hours' : 'Show this column in hours'"
    @click.stop="toggle"
  >
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <rect x="6.35" y="1" width="3.3" height="1.85" rx="0.45" fill="currentColor" />
      <path d="M5.35 3.55 7 2.15M10.65 3.55 9 2.15" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" />
      <circle cx="8" cy="9.15" r="5.05" fill="none" stroke="currentColor" stroke-width="1.3" />
      <path d="M8 6.7v2.7l1.85 1.1" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  </button>
</template>
