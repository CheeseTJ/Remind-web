<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { logout } from '../api/ucenter'
import { getMeta, listMemos, removeMemo, updateMemo } from '../api/remind'
import {
  bigDateText,
  daysUntil,
  formatCNDay,
  formatUpdatedAt,
  kindText,
  toPayload,
} from '../utils/memo'

const router = useRouter()

const memos = ref([])
const loading = ref(true)
const loadError = ref('')
const sendTime = ref('08:00')
const userEmail = ref('')
const toast = ref('')
const confirmId = ref(null)

let toastTimer = null
let confirmTimer = null

const total = computed(() => memos.value.length)
const activeCount = computed(() => memos.value.filter((m) => m.enabled).length)

function showToast(text) {
  toast.value = text
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toast.value = ''
  }, 2600)
}

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const data = await listMemos()
    memos.value = data.memos || []
    userEmail.value = memos.value[0]?.user_email || ''
  } catch (e) {
    loadError.value = e?.message || '加载失败，请稍后再试'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  load()
  getMeta()
    .then((meta) => {
      if (meta?.daily_send_time) sendTime.value = meta.daily_send_time
    })
    .catch(() => {})
})

onBeforeUnmount(() => {
  clearTimeout(toastTimer)
  clearTimeout(confirmTimer)
})

/* ---------- 启用开关：乐观更新，失败回滚 ---------- */

async function onToggle(memo, event) {
  const prev = memo.enabled
  memo.enabled = event.target.checked
  try {
    await updateMemo(memo.id, toPayload(memo))
  } catch (e) {
    memo.enabled = prev
    event.target.checked = !!prev
    showToast(e?.message || '更新失败')
  }
}

/* ---------- 删除：两段确认，3 秒未确认自动复原 ---------- */

function onDelete(memo) {
  if (confirmId.value !== memo.id) {
    confirmId.value = memo.id
    clearTimeout(confirmTimer)
    confirmTimer = setTimeout(() => {
      confirmId.value = null
    }, 3000)
    return
  }
  clearTimeout(confirmTimer)
  confirmId.value = null
  removeMemo(memo.id)
    .then(() => {
      memos.value = memos.value.filter((m) => m.id !== memo.id)
      showToast('已删除')
    })
    .catch((e) => showToast(e?.message || '删除失败'))
}

async function onLogout() {
  await logout()
  router.replace('/login')
}

/** 卡片 next 行：{ text, date, days } 或纯文本态 */
function nextInfo(memo) {
  if (!memo.enabled) return { mode: 'plain', text: '已停用' }
  if (!memo.next_date) return { mode: 'plain', text: '—' }
  const days = daysUntil(memo.next_date)
  if (memo.repeat === 'once' && days !== null && days < 0) {
    return { mode: 'plain', text: '已结束' }
  }
  return { mode: 'full', date: formatCNDay(memo.next_date), days }
}
</script>

<template>
  <div>
    <header class="top">
      <div class="brand">
        <div class="blob">念</div>
        <div>
          <h1>念念</h1>
          <small>农历阳历 · 都帮你记着</small>
        </div>
      </div>
      <div class="me">
        <template v-if="userEmail">
          <span class="avatar" title="当前账号">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
              <path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5zm0 2c-3.9 0-8 2-8 5.3V21a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-1.7c0-3.3-4.1-5.3-8-5.3z"/>
            </svg>
          </span>
          <span class="mail">{{ userEmail }}</span>
        </template>
        <button class="logout" type="button" @click="onLogout">退出</button>
      </div>
    </header>

    <main>
      <div class="list-head">
        <div>
          <h2 class="disp"><span class="mini">记</span>我的备忘</h2>
          <div class="count">共 {{ total }} 条 · {{ activeCount }} 条提醒中</div>
        </div>
        <div class="send-tag">每天 <b class="disp">{{ sendTime }}</b>（北京时间）统一发送</div>
      </div>

      <div v-if="loading" class="state-tip">正在翻看手账…</div>

      <div v-else-if="loadError" class="state-tip">
        {{ loadError }}
        <button class="btn btn-plain retry" type="button" @click="load">重试</button>
      </div>

      <div v-else-if="total === 0" class="empty-card">
        <span class="tape"></span>
        <h3 class="disp">还没有备忘</h3>
        <p>生日、纪念日、待办小事……都帮你记着</p>
        <button class="btn-add disp" type="button" @click="router.push('/memo/new')">＋ 记一笔吧</button>
      </div>

      <div v-else class="cards">
        <article
          v-for="(memo, i) in memos"
          :key="memo.id"
          class="memo"
          :class="[`tone${i % 4}`, { off: !memo.enabled }]"
        >
          <span class="tape"></span>
          <div class="memo-top">
            <div class="memo-title">
              <h3 class="disp">{{ memo.title }}</h3>
              <p v-if="memo.content" class="note">{{ memo.content }}</p>
            </div>
            <label class="tgl">
              <input type="checkbox" :checked="!!memo.enabled" @change="onToggle(memo, $event)">
              <i></i>
            </label>
          </div>
          <div class="date">
            <span class="big disp">{{ bigDateText(memo) }}</span>
            <span class="kind" :class="memo.date_type === 'lunar' ? 'kind-lunar' : 'kind-solar'">
              {{ kindText(memo) }}
            </span>
          </div>
          <p class="next">
            <template v-if="nextInfo(memo).mode === 'plain'">{{ nextInfo(memo).text }}</template>
            <template v-else>
              下次 <b>{{ nextInfo(memo).date }}</b> · 还有 {{ nextInfo(memo).days }} 天
            </template>
          </p>
          <div class="chips">
            <span
              v-for="(offset, idx) in memo.advance_offsets"
              :key="idx"
              class="tag"
              :class="offset === 0 ? 'hot' : 'cool'"
            >
              {{ offset === 0 ? '当天提醒' : `提前 ${offset} 天` }}
            </span>
          </div>
          <div class="memo-foot">
            <span class="sent">更新于 {{ formatUpdatedAt(memo.updated_at) }}</span>
            <div class="foot-acts">
              <button
                class="icon-btn"
                type="button"
                title="编辑"
                @click="router.push(`/memo/${memo.id}/edit`)"
              >✎</button>
              <button
                class="icon-btn danger"
                :class="{ confirming: confirmId === memo.id }"
                type="button"
                @click="onDelete(memo)"
              >{{ confirmId === memo.id ? '确认删除?' : '✕' }}</button>
            </div>
          </div>
        </article>
      </div>
    </main>

    <!-- 悬浮新建按钮 -->
    <button class="fab" type="button" title="记一笔" @click="router.push('/memo/new')">
      <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true">
        <path d="M12 5v14M5 12h14"/>
      </svg>
    </button>

    <transition name="toast">
      <div v-if="toast" class="toast">{{ toast }}</div>
    </transition>
  </div>
</template>

<style scoped>
.send-tag {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  align-self: center;
  background: #fff;
  border: 2px dashed #e3d5bb;
  border-radius: 999px;
  padding: 8px 17px;
  font-size: 12.5px;
  color: var(--ink-soft);
}

.send-tag b {
  color: var(--peach);
  font-size: 14px;
}

.me {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  color: var(--ink-soft);
}

.me .avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--sage);
  color: #fff;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.me .mail { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.me .logout {
  background: none;
  border: none;
  color: var(--ink-soft);
  cursor: pointer;
  font-size: 12px;
  text-decoration: underline dotted;
  text-underline-offset: 3px;
  font-family: inherit;
}

.me .logout:hover { color: var(--rose); }

/* ===== 列表头 ===== */
.list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin: 16px 0 22px;
  flex-wrap: wrap;
}

.list-head h2 {
  font-size: 26px;
  letter-spacing: 3px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 400;
}

.list-head h2 .mini {
  width: 30px;
  height: 30px;
  border-radius: 40% 60% 55% 45% / 50% 45% 55% 50%;
  background: var(--peach);
  display: inline-grid;
  place-items: center;
  color: #fff;
  font-size: 14px;
  transform: rotate(8deg);
  flex-shrink: 0;
}

.list-head .count {
  color: var(--ink-soft);
  font-size: 12.5px;
  margin-top: 3px;
}

/* ===== 悬浮新建按钮 ===== */
.fab {
  position: fixed;
  right: clamp(16px, 4vw, 32px);
  bottom: calc(26px + env(safe-area-inset-bottom));
  width: 58px;
  height: 58px;
  border-radius: 50%;
  border: none;
  background: var(--rose);
  color: #fff;
  font-size: 26px;
  cursor: pointer;
  display: grid;
  place-items: center;
  box-shadow: 0 10px 24px -6px rgba(229, 143, 156, .75);
  transition: .2s;
  z-index: 50;
}

.fab:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 28px -8px rgba(229, 143, 156, .85);
}

.fab:active { transform: scale(.94); }

.btn-add {
  background: var(--rose);
  color: #fff;
  border-radius: 999px;
  padding: 12px 26px;
  font-size: 14.5px;
  letter-spacing: 2px;
  border: none;
  cursor: pointer;
  box-shadow: 0 6px 16px -6px rgba(229, 143, 156, .7);
  transition: .2s;
}

.btn-add:hover {
  transform: translateY(-2px) rotate(-1deg);
  box-shadow: 0 10px 22px -8px rgba(229, 143, 156, .8);
}

/* ===== 加载 / 错误 / 空状态 ===== */
.state-tip {
  padding: 46px 20px;
  text-align: center;
  color: var(--ink-soft);
  font-size: 13.5px;
  background: #fff;
  border: 2px dashed var(--line);
  border-radius: 22px;
}

.state-tip .retry { margin-left: 12px; padding: 8px 18px; font-size: 12.5px; }

.empty-card {
  position: relative;
  max-width: 460px;
  margin: 6vh auto 0;
  text-align: center;
  background: #fff;
  border: 2px dashed var(--line);
  border-radius: 26px;
  padding: 52px 34px 44px;
  box-shadow: 0 18px 50px -24px rgba(74, 66, 56, .25);
  animation: pop .45s cubic-bezier(.34, 1.4, .44, 1) both;
}

.empty-card .tape {
  position: absolute;
  top: -9px;
  left: 50%;
  transform: translateX(-50%) rotate(-2deg);
  width: 92px;
  height: 19px;
  border-radius: 3px;
  opacity: .9;
  background: repeating-linear-gradient(45deg, rgba(127, 156, 126, .7) 0 6px, rgba(183, 203, 182, .7) 6px 12px);
}

.empty-card h3 { font-size: 24px; letter-spacing: 3px; font-weight: 400; }
.empty-card p { color: var(--ink-soft); font-size: 13px; margin: 10px 0 24px; }

/* ===== 便签卡片 ===== */
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
  gap: 17px;
}

.memo {
  border-radius: 22px;
  padding: 22px 22px 16px;
  position: relative;
  border: none;
  box-shadow: 0 10px 26px -16px rgba(74, 66, 56, .28);
  transition: .25s cubic-bezier(.34, 1.3, .44, 1);
  animation: pop .5s cubic-bezier(.34, 1.4, .44, 1) both;
}

/* 四色循环：胶带与卡片渐变同步轮换 */
.memo.tone0 { background: linear-gradient(150deg, #fff 55%, var(--peach-soft)); animation-delay: .04s; }
.memo.tone1 { background: linear-gradient(150deg, #fff 55%, var(--sage-soft)); animation-delay: .1s; }
.memo.tone2 { background: linear-gradient(150deg, #fff 55%, var(--rose-soft)); animation-delay: .16s; }
.memo.tone3 { background: linear-gradient(150deg, #fff 55%, var(--sky-soft)); animation-delay: .22s; }

.memo .tape {
  position: absolute;
  top: -9px;
  left: 50%;
  transform: translateX(-50%) rotate(-2deg);
  width: 92px;
  height: 19px;
  border-radius: 3px;
  opacity: .9;
  background: repeating-linear-gradient(45deg, rgba(240, 163, 94, .75) 0 6px, rgba(248, 199, 154, .75) 6px 12px);
}

.memo.tone1 .tape { background: repeating-linear-gradient(45deg, rgba(127, 156, 126, .7) 0 6px, rgba(183, 203, 182, .7) 6px 12px); }
.memo.tone2 .tape { background: repeating-linear-gradient(45deg, rgba(229, 143, 156, .7) 0 6px, rgba(243, 187, 194, .7) 6px 12px); }
.memo.tone3 .tape { background: repeating-linear-gradient(45deg, rgba(127, 181, 201, .7) 0 6px, rgba(184, 214, 226, .7) 6px 12px); }

.memo:hover {
  transform: translateY(-5px) rotate(-.6deg);
  box-shadow: 0 18px 34px -16px rgba(74, 66, 56, .35);
}

.memo.off { opacity: .55; }

.memo-top {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: flex-start;
  margin-top: 6px;
}

.memo h3 { font-size: 19px; letter-spacing: 1px; font-weight: 400; }

.memo .note {
  color: var(--ink-soft);
  font-size: 12px;
  margin-top: 4px;
  line-height: 1.6;
}

/* 启用开关（照搬原型 tgl） */
.tgl {
  position: relative;
  width: 40px;
  height: 22px;
  flex-shrink: 0;
  cursor: pointer;
  display: inline-block;
}

.tgl input { opacity: 0; width: 0; height: 0; position: absolute; }

.tgl i {
  position: absolute;
  inset: 0;
  background: #e6ddcc;
  border-radius: 999px;
  transition: .25s;
}

.tgl i::after {
  content: "";
  position: absolute;
  top: 3px;
  left: 3px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  transition: .25s cubic-bezier(.34, 1.4, .44, 1);
  box-shadow: 0 1px 3px rgba(0, 0, 0, .2);
}

.tgl input:checked + i { background: var(--sage); }
.tgl input:checked + i::after { transform: translateX(18px); }

/* 日期行 */
.memo .date {
  display: flex;
  align-items: baseline;
  gap: 9px;
  margin: 15px 0 3px;
  flex-wrap: wrap;
}

.memo .date .big { font-size: 27px; letter-spacing: 1px; }

.memo .date .kind {
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 999px;
  letter-spacing: 1px;
}

.kind-lunar { background: var(--rose-soft); color: #c05e6d; }
.kind-solar { background: var(--sky-soft); color: #4c88a0; }

.next { font-size: 12px; color: var(--ink-soft); }
.next b { color: var(--sage); font-weight: 700; }

/* 徽标 chips */
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 13px;
}

.tag {
  font-size: 11px;
  letter-spacing: 1px;
  padding: 4px 11px;
  border-radius: 999px;
  background: #fff;
  border: 1.5px solid var(--line);
  color: var(--ink-soft);
}

.tag.hot { background: var(--peach-soft); border-color: #f5cda2; color: #c07a34; }
.tag.cool { background: var(--sage-soft); border-color: #c9dcc8; color: #5c7d5b; }

/* 卡片底部 */
.memo-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-top: 15px;
  padding-top: 11px;
  border-top: 2px dashed var(--line);
}

.memo-foot .sent { font-size: 11px; color: #b3a88f; }

.foot-acts { display: flex; gap: 6px; }

.icon-btn {
  min-width: 32px;
  height: 32px;
  border-radius: 999px;
  border: none;
  background: var(--cream);
  cursor: pointer;
  color: var(--ink-soft);
  display: grid;
  place-items: center;
  font-size: 13px;
  transition: .2s;
  padding: 0 10px;
  font-family: inherit;
}

.icon-btn:hover {
  background: var(--peach-soft);
  color: #c07a34;
  transform: rotate(-8deg);
}

.icon-btn.danger:hover {
  background: var(--rose-soft);
  color: #c05e6d;
}

.icon-btn.confirming,
.icon-btn.danger.confirming:hover {
  background: var(--rose);
  color: #fff;
  font-size: 11.5px;
  letter-spacing: 1px;
  transform: none;
  white-space: nowrap;
}

/* ===== Toast ===== */
.toast {
  position: fixed;
  left: 50%;
  bottom: 30px;
  transform: translateX(-50%);
  background: rgba(74, 66, 56, .92);
  color: #fff;
  font-size: 13px;
  letter-spacing: 1px;
  padding: 11px 24px;
  border-radius: 999px;
  box-shadow: 0 10px 26px -8px rgba(74, 66, 56, .5);
  z-index: 60;
}

.toast-enter-active,
.toast-leave-active { transition: .25s ease; }

.toast-enter-from,
.toast-leave-to { opacity: 0; transform: translateX(-50%) translateY(8px); }

@media (max-width: 640px) {
  .send-tag { padding: 7px 13px; font-size: 11.5px; align-self: flex-start; margin-top: 2px; }
  .send-tag b { font-size: 13px; }
  .me { gap: 6px; }
  .me .mail { max-width: 96px; }

  .list-head { margin: 12px 0 14px; }
  .list-head h2 { font-size: 22px; }

  /* 手机端卡片每行两个；行距加大给和纸胶带留出空间 */
  .cards { grid-template-columns: repeat(2, 1fr); gap: 18px 10px; }
  .memo { padding: 14px 12px 10px; }
  .memo h3 { font-size: 15px; }
  .memo .note { font-size: 11px; }
  .memo .date { gap: 5px; margin: 10px 0 2px; }
  .memo .date .big { font-size: 19px; }
  .memo .date .kind { font-size: 10px; padding: 2px 7px; }
  .chips { margin-top: 8px; gap: 4px; }
  .tag { font-size: 10px; padding: 3px 8px; }
  .memo-foot { margin-top: 10px; padding-top: 8px; flex-wrap: wrap; }
  .memo-foot .sent { font-size: 10px; }
  .icon-btn { min-width: 28px; height: 28px; font-size: 12px; }

  .fab { width: 50px; height: 50px; font-size: 23px; right: 14px; bottom: calc(18px + env(safe-area-inset-bottom)); }

  .toast { max-width: 86vw; text-align: center; }
}
</style>
