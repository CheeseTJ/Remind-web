<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { login } from '../api/ucenter'

const router = useRouter()
const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function submit() {
  if (loading.value) return
  error.value = ''
  if (!email.value.trim() || !password.value) {
    error.value = '请输入邮箱和密码'
    return
  }
  loading.value = true
  try {
    await login(email.value.trim(), password.value)
    router.push('/')
  } catch (e) {
    error.value = e?.message || '登录失败，请稍后再试'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <section class="login-wrap">
    <div class="login-card">
      <h2 class="disp">欢 迎 回 来</h2>
      <p class="login-sub">使用 Ucenter 账号登录</p>
      <form @submit.prevent="submit">
        <div class="field">
          <label>邮箱</label>
          <input v-model="email" type="email" placeholder="you@example.com" autocomplete="email" required>
        </div>
        <div class="field">
          <label>密码</label>
          <input v-model="password" type="password" placeholder="••••••••" autocomplete="current-password" required>
        </div>
        <p v-if="error" class="login-error">{{ error }}</p>
        <button class="btn btn-sage" type="submit" :disabled="loading">
          {{ loading ? '进 入 中 …' : '进 入' }}
        </button>
      </form>
      <p class="login-hint">登录状态由 Ucenter 统一管理</p>
    </div>
  </section>
</template>

<style scoped>
.login-wrap {
  max-width: 400px;
  margin: 8vh auto 0;
  padding: 0 18px;
}

.login-card {
  background: var(--card);
  border-radius: 26px;
  padding: 44px 38px 36px;
  box-shadow: 0 18px 50px -24px rgba(74, 66, 56, .25);
  border: 2px dashed var(--line);
  position: relative;
  animation: pop .45s cubic-bezier(.34, 1.4, .44, 1) both;
}

/* 和纸胶带 ×2 */
.login-card::before,
.login-card::after {
  content: "";
  position: absolute;
  width: 86px;
  height: 20px;
  top: -9px;
  border-radius: 4px;
  opacity: .85;
}

.login-card::before {
  left: 26px;
  background: repeating-linear-gradient(45deg, var(--peach) 0 6px, #f8c79a 6px 12px);
  transform: rotate(-4deg);
}

.login-card::after {
  right: 26px;
  background: repeating-linear-gradient(45deg, var(--sage) 0 6px, #b7cbb6 6px 12px);
  transform: rotate(3deg);
}

.login-card h2 {
  font-size: 30px;
  text-align: center;
  letter-spacing: 6px;
  font-weight: 400;
}

.login-sub {
  text-align: center;
  color: var(--ink-soft);
  font-size: 13px;
  margin: 8px 0 28px;
}

.login-card form { margin-top: 0; }

.login-card .btn {
  width: 100%;
  margin-top: 6px;
}

.login-error {
  background: var(--rose-soft);
  color: #c05e6d;
  font-size: 12.5px;
  border-radius: 12px;
  padding: 9px 14px;
  margin-bottom: 14px;
  text-align: center;
}

.login-hint {
  margin-top: 16px;
  text-align: center;
  font-size: 12px;
  color: var(--ink-soft);
}

@media (max-width: 640px) {
  .login-card { padding: 34px 24px 28px; }
  .login-card h2 { font-size: 25px; letter-spacing: 4px; }
  .field input { font-size: 16px; } /* 防 iOS 聚焦自动放大 */
}
</style>
