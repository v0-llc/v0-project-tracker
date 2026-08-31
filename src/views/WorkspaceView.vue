<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, RouterView, useRouter } from 'vue-router'
import ThemeToggle from '../components/ThemeToggle.vue'
import { useAuthStore } from '../stores/auth'
import { useBoardStore } from '../stores/board'

const auth = useAuthStore()
const board = useBoardStore()
const router = useRouter()

async function signOut() {
  await auth.signOutUser()
  await router.push({ name: 'login' })
}

const photoFailed = ref(false)

const initials = computed(() =>
  (auth.user?.displayName || 'You')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase(),
)

const photoURL = computed(() => auth.user?.photoURL || '')

watch(photoURL, () => {
  photoFailed.value = false
})
</script>

<template>
  <div class="app-shell">
    <header class="app-header" @wheel.prevent>
      <RouterLink class="brand" to="/">
        <strong>Slate</strong>
        <span>Studio ledger</span>
      </RouterLink>

      <nav class="view-switch" aria-label="Workspace views">
        <RouterLink to="/">Board</RouterLink>
        <RouterLink to="/hours">Hours</RouterLink>
        <RouterLink to="/contacts">Contacts</RouterLink>
        <RouterLink to="/archive">Archive</RouterLink>
      </nav>

      <div class="header-cluster">
        <p v-if="auth.isLocal" class="local-note">Local</p>
        <p v-if="board.error" class="error-banner" style="margin: 0">{{ board.error }}</p>
        <ThemeToggle />
        <div class="user-chip">
          <img
            v-if="photoURL && !photoFailed"
            :src="photoURL"
            alt=""
            referrerpolicy="no-referrer"
            @error="photoFailed = true"
          />
          <span v-else class="user-fallback">{{ initials }}</span>
          <button class="text-btn" type="button" @click="signOut()">Sign out</button>
        </div>
      </div>
    </header>

    <main class="workspace">
      <RouterView />
    </main>
  </div>
</template>
