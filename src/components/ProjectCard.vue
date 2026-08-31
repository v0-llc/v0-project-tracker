<script setup lang="ts">
import { computed } from 'vue'
import { useCardMeta } from '../composables/useCardMeta'
import { useBoardStore } from '../stores/board'
import type { Project } from '../types'
import CardStar from './CardStar.vue'

const props = defineProps<{
  project: Project
  muted?: boolean
  condensed?: boolean
}>()

const emit = defineEmits<{
  open: []
}>()

const board = useBoardStore()
const { metaOpen, toggle } = useCardMeta(
  () => props.project,
  () => board.sortedColumns,
)

const clientLabel = computed(() => board.clientName(props.project.clientId))
</script>

<template>
  <article
    class="project-card"
    :class="{ muted, condensed, 'meta-open': metaOpen && !condensed, starred: project.starred }"
    role="button"
    tabindex="0"
    @click="emit('open')"
    @keydown.enter="emit('open')"
  >
    <div class="card-copy">
      <h3>{{ project.name }}</h3>
      <p v-if="!condensed && clientLabel">{{ clientLabel }}</p>
    </div>
    <CardStar :project="project" />
    <template v-if="!condensed">
      <button
        class="card-fold"
        type="button"
        :aria-expanded="metaOpen"
        :aria-label="metaOpen ? 'Hide figures' : 'Show figures'"
        @pointerdown.stop
        @mousedown.stop
        @click="toggle"
      >
        <span class="card-fold-mark" :class="{ open: metaOpen }"></span>
      </button>
      <div class="card-rule" aria-hidden="true"></div>
      <div v-if="metaOpen" class="card-fold-body">
        <slot />
      </div>
    </template>
  </article>
</template>
