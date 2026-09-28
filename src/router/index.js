import { createRouter, createWebHistory } from 'vue-router'
import { getToken } from '../api/ucenter'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: () => import('../views/LoginView.vue') },
    { path: '/', name: 'list', component: () => import('../views/ListView.vue') },
    { path: '/memo/new', name: 'memo-new', component: () => import('../views/EditView.vue') },
    { path: '/memo/:id/edit', name: 'memo-edit', component: () => import('../views/EditView.vue') },
  ],
})

// 全局前置守卫：无 access_token 且目标不是登录页时，一律带回 /login
router.beforeEach((to) => {
  if (!getToken() && to.path !== '/login') {
    return { path: '/login' }
  }
})

export default router
