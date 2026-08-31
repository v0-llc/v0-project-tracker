import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth'
import { isFirebaseConfigured, requireAuth } from '../firebase'

const LOCAL_SESSION_KEY = 'slate.local-session'

export const LOCAL_USER: User = {
  uid: 'local',
  displayName: 'Local studio',
  email: null,
  photoURL: null,
} as User

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const ready = ref(false)
  const error = ref('')
  const pending = ref(false)

  const isLocal = computed(() => user.value?.uid === LOCAL_USER.uid)
  const isSignedIn = computed(() => Boolean(user.value))

  function restoreLocalSession() {
    if (isFirebaseConfigured) return
    if (localStorage.getItem(LOCAL_SESSION_KEY) === '1') {
      user.value = LOCAL_USER
    }
  }

  if (isFirebaseConfigured) {
    onAuthStateChanged(requireAuth(), (next) => {
      user.value = next
      ready.value = true
    })
  } else {
    restoreLocalSession()
    ready.value = true
  }

  async function signInWithGoogle() {
    error.value = ''
    pending.value = true
    try {
      await signInWithPopup(requireAuth(), new GoogleAuthProvider())
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : 'Google sign-in failed'
      throw err
    } finally {
      pending.value = false
    }
  }

  function continueLocally() {
    user.value = LOCAL_USER
    localStorage.setItem(LOCAL_SESSION_KEY, '1')
  }

  async function signOutUser() {
    error.value = ''
    if (isFirebaseConfigured && !isLocal.value) {
      await signOut(requireAuth())
    }
    localStorage.removeItem(LOCAL_SESSION_KEY)
    user.value = null
  }

  return {
    user,
    ready,
    error,
    pending,
    isLocal,
    isSignedIn,
    signInWithGoogle,
    continueLocally,
    signOutUser,
  }
})
