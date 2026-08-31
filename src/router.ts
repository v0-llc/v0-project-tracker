import { createRouter, createWebHistory } from 'vue-router'
import { watch } from 'vue'
import { useAuthStore } from './stores/auth'
import HoursGrid from './components/HoursGrid.vue'
import ContactsView from './components/ContactsView.vue'
import KanbanBoard from './components/KanbanBoard.vue'
import LoginView from './views/LoginView.vue'
import WorkspaceView from './views/WorkspaceView.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: LoginView,
    },
    {
      path: '/',
      component: WorkspaceView,
      meta: { requiresAuth: true },
      children: [
        { path: '', name: 'board', component: KanbanBoard },
        { path: 'hours', name: 'hours', component: HoursGrid },
        { path: 'contacts', name: 'contacts', component: ContactsView },
      ],
    },
  ],
})

function whenAuthReady() {
  const auth = useAuthStore()
  if (auth.ready) return Promise.resolve()
  return new Promise<void>((resolve) => {
    const stop = watch(
      () => auth.ready,
      (ready) => {
        if (ready) {
          stop()
          resolve()
        }
      },
    )
  })
}

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  await whenAuthReady()
  if (to.meta.requiresAuth && !auth.isSignedIn) {
    return { name: 'login' }
  }
  if (to.name === 'login' && auth.isSignedIn) {
    return { name: 'board' }
  }
  return true
})
