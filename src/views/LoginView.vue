<script setup lang="ts">
import { useRouter } from 'vue-router'
import ThemeToggle from '../components/ThemeToggle.vue'
import { isFirebaseConfigured } from '../firebase'
import { useAuthStore } from '../stores/auth'
import { DEFAULT_COLUMN_NAMES } from '../types'

const auth = useAuthStore()
const router = useRouter()

async function signIn() {
  await auth.signInWithGoogle()
  await router.push({ name: 'board' })
}

async function tryLocal() {
  auth.continueLocally()
  await router.push({ name: 'board' })
}</script>

<template>
  <main class="login">
    <section class="login-main">
      <div>
        <div class="header-cluster" style="justify-content: space-between">
          <p class="label">Freelance production ledger</p>
          <ThemeToggle />
        </div>
        <h1>Slate</h1>
        <p class="lede">Keep every job, hour, and invoice in one quiet place.</p>

        <div class="login-actions">
          <button
            class="primary-btn"
            type="button"
            :disabled="!isFirebaseConfigured || auth.pending"
            @click="signIn()"
          >
            Continue with Google
          </button>
          <button
            v-if="!isFirebaseConfigured"
            class="ghost-btn"
            type="button"
            @click="tryLocal()"
          >
            Try the workspace locally
          </button>
        </div>

        <p v-if="auth.error" class="error-banner">{{ auth.error }}</p>

        <div v-if="!isFirebaseConfigured" class="setup-card">
          <p class="label">Connect Firebase</p>
          <ol>
            <li>Copy <code>.env.example</code> to <code>.env</code>.</li>
            <li>Paste your Firebase web app keys from Project settings.</li>
            <li>Enable Google sign-in and create a Firestore database.</li>
            <li>Publish the rules in <code>firestore.rules</code>, then restart the dev server.</li>
          </ol>
        </div>
      </div>

      <p class="label">Leads through complete, with the rate that actually landed.</p>
    </section>

    <aside class="login-aside">
      <p class="label">Default stages</p>
      <ol class="stage-list">
        <li v-for="(name, index) in DEFAULT_COLUMN_NAMES" :key="name">
          <b>{{ String(index + 1).padStart(2, '0') }}</b>
          <span>{{ name }}</span>
        </li>
      </ol>
    </aside>
  </main>
</template>
