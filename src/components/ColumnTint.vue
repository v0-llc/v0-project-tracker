<script setup lang="ts">
import { onClickOutside } from '@vueuse/core'
import { computed, nextTick, onUnmounted, ref } from 'vue'
import { useBoardStore } from '../stores/board'

const TINTS = [
  { name: 'Clay', value: '#c45c3e' },
  { name: 'Ochre', value: '#c4923a' },
  { name: 'Moss', value: '#5a7a4e' },
  { name: 'Sea', value: '#3d6e72' },
  { name: 'Ink', value: '#3a4a6b' },
  { name: 'Plum', value: '#6b4560' },
  { name: 'Rose', value: '#a85a62' },
  { name: 'Charcoal', value: '#5c574e' },
] as const

const props = defineProps<{
  columnId: string
  color?: string
}>()

const board = useBoardStore()
const open = ref(false)
const root = ref<HTMLElement | null>(null)
const menu = ref<HTMLElement | null>(null)
const menuStyle = ref<Record<string, string>>({})

onClickOutside(root, () => {
  open.value = false
}, { ignore: [menu] })

const current = computed(() => props.color?.trim() ?? '')
const customValue = computed(() => current.value || '#b5441a')

function placeMenu() {
  const trigger = root.value?.querySelector('button')
  const panel = menu.value
  if (!trigger || !panel) return
  const box = trigger.getBoundingClientRect()
  const width = panel.offsetWidth
  const height = panel.offsetHeight
  const left = Math.min(Math.max(8, box.right - width), window.innerWidth - width - 8)
  let top = box.bottom + 8
  if (top + height > window.innerHeight - 8) {
    top = Math.max(8, box.top - height - 8)
  }
  menuStyle.value = {
    left: `${left}px`,
    top: `${top}px`,
  }
}

async function toggle() {
  open.value = !open.value
  if (open.value) {
    await nextTick()
    placeMenu()
  }
}

async function pick(color: string) {
  await board.setColumnColor(props.columnId, color)
  open.value = false
}

async function onCustom(event: Event) {
  const value = (event.target as HTMLInputElement).value
  await board.setColumnColor(props.columnId, value)
}

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') open.value = false
}

function onScroll() {
  if (open.value) open.value = false
}

window.addEventListener('keydown', onKey)
window.addEventListener('resize', onScroll)
document.addEventListener('scroll', onScroll, true)

onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('resize', onScroll)
  document.removeEventListener('scroll', onScroll, true)
})
</script>

<template>
  <div ref="root" class="column-tint" :class="{ open }">
    <button
      class="column-tint-swatch"
      type="button"
      :aria-expanded="open"
      :aria-label="current ? `Column color ${current}` : 'Choose column color'"
      :class="{ open }"
      @click.stop="toggle"
    >
      <i v-if="current" class="column-tint-disc" :style="{ background: current }" />
      <svg v-else class="column-tint-disc" viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.25" />
        <path d="M4.2 11.8 11.8 4.2" fill="none" stroke="currentColor" stroke-width="1.25" />
      </svg>
    </button>
    <Teleport to="body">
      <div
        v-if="open"
        ref="menu"
        class="column-tint-menu"
        role="dialog"
        aria-label="Column color"
        :style="menuStyle"
        @click.stop
      >
        <p class="label">Wash</p>
        <div class="column-tint-grid">
          <button
            class="column-tint-choice"
            type="button"
            :aria-pressed="!current"
            aria-label="No color"
            @click="pick('')"
          >
            <svg class="column-tint-disc" viewBox="0 0 16 16" aria-hidden="true">
              <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.25" />
              <path d="M4.2 11.8 11.8 4.2" fill="none" stroke="currentColor" stroke-width="1.25" />
            </svg>
          </button>
          <button
            v-for="tint in TINTS"
            :key="tint.value"
            class="column-tint-choice"
            type="button"
            :aria-label="tint.name"
            :aria-pressed="current.toLowerCase() === tint.value"
            @click="pick(tint.value)"
          >
            <i class="column-tint-disc" :style="{ background: tint.value }" />
          </button>
        </div>
        <label class="column-tint-custom">
          <input type="color" :value="customValue" @input="onCustom" />
          <span>Custom</span>
        </label>
      </div>
    </Teleport>
  </div>
</template>
