<script setup lang="ts">
import { useBoardStore } from '../stores/board'

const props = defineProps<{
  columnId: string
  condensed?: boolean
}>()

const board = useBoardStore()

async function toggle() {
  await board.setColumnCondensed(props.columnId, !props.condensed)
}
</script>

<template>
  <button
    class="column-density"
    type="button"
    :class="{ on: condensed }"
    :aria-pressed="Boolean(condensed)"
    :aria-label="condensed ? 'Show full cards' : 'Condense cards'"
    @click.stop="toggle"
  >
    <svg v-if="condensed" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 4.5h10M3 8h10M3 11.5h10" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
    </svg>
    <svg v-else viewBox="0 0 16 16" aria-hidden="true">
      <rect x="3" y="2.5" width="10" height="11" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.3" />
      <path d="M5.2 6h5.6M5.2 9h3.4" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
    </svg>
  </button>
</template>
