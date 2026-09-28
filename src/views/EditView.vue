<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { createMemo, getMemo, updateMemo } from '../api/remind'
import { LUNAR_DAYS, LUNAR_MONTHS, normalizeOffsets } from '../utils/memo'

const route = useRoute()
const router = useRouter()

const isNew = computed(() => route.name === 'memo-new')

const REPEATS = [
  { v: 'yearly', t: '每年' },
  { v: 'monthly', t: '每月' },
  { v: 'daily', t: '每日' },
  { v: 'once', t: '单次' },
]

/** 固定档位之外的都算「自定义 N 天」 */
const FIXED_OFFSETS = [0, 1, 3, 7]

const loading = ref(false)
const pageError = ref('')
const error = ref('')
const saving = ref(false)

const form = reactive({
  title: '',
  content: '',
  date_type: 'solar',
  repeat: 'yearly',
  month: 1,
  day: 1,
  lunar_month: 1,
  lunar_day: 1,
  once_date: '',
})

const leapOn = ref(false)
const enableOn = ref(true)
const offsets = ref([0])
const customText = ref('')
const customEl = ref(null)

/* ---------- 编辑模式：单查接口回填 ---------- */

async function loadMemo() {
  loading.value = true
  pageError.value = ''
  try {
    const memo = await getMemo(route.params.id)
    if (!memo) {
      pageError.value = '未找到这条备忘，可能已被删除'
      return
    }
    form.title = memo.title || ''
    form.content = memo.content || ''
    form.date_type = memo.date_type === 'lunar' ? 'lunar' : 'solar'
    form.repeat = ['yearly', 'monthly', 'daily', 'once'].includes(memo.repeat) ? memo.repeat : 'yearly'
    form.month = Number(memo.month) || 1
    form.day = Number(memo.day) || 1
    form.lunar_month = Number(memo.lunar_month) || 1
    form.lunar_day = Number(memo.lunar_day) || 1
    form.once_date = memo.once_date || ''
    leapOn.value = !!memo.lunar_leap
    enableOn.value = !!memo.enabled
    customText.value = ''
    offsets.value = normalizeOffsets(memo.advance_offsets)
    const custom = offsets.value.find((o) => !FIXED_OFFSETS.includes(o))
    if (custom !== undefined) customText.value = String(custom)
  } catch (e) {
    pageError.value = e?.message || '加载失败，请稍后再试'
  } finally {
    loading.value = false
  }
}

function resetForm() {
  form.title = ''
  form.content = ''
  form.date_type = 'solar'
  form.repeat = 'yearly'
  form.month = 1
  form.day = 1
  form.lunar_month = 1
  form.lunar_day = 1
  form.once_date = ''
  leapOn.value = false
  enableOn.value = true
  offsets.value = [0]
  customText.value = ''
  error.value = ''
  pageError.value = ''
}

if (route.name === 'memo-edit') loadMemo()

// 组件被 new / edit 两条路由复用：路由变化时重置或重新回填
watch(
  () => [route.name, route.params.id],
  ([name]) => {
    if (name !== 'memo-new' && name !== 'memo-edit') return
    if (name === 'memo-new') resetForm()
    else loadMemo()
  }
)

/* ---------- 提前提醒 chips ---------- */

function hasOffset(o) {
  return offsets.value.includes(o)
}

function toggleOffset(o) {
  offsets.value = hasOffset(o)
    ? offsets.value.filter((x) => x !== o)
    : normalizeOffsets([...offsets.value, o])
}

const customOn = computed(
  () => customText.value.trim() !== '' || offsets.value.some((o) => !FIXED_OFFSETS.includes(o))
)

// 自定义输入非空即生效：替换掉旧的自定义值
watch(customText, (text) => {
  const fixed = offsets.value.filter((o) => FIXED_OFFSETS.includes(o))
  const n = Number(text.trim())
  if (text.trim() !== '' && Number.isInteger(n) && n >= 0) fixed.push(n)
  offsets.value = normalizeOffsets(fixed)
})

function focusCustom() {
  customEl.value?.focus()
}

/* ---------- 保存 ---------- */

function validate() {
  if (!form.title.trim()) return '请填写标题'
  if (form.repeat === 'once' && !form.once_date) return '请选择单次日期'
  return ''
}

async function save() {
  if (saving.value) return
  error.value = validate()
  if (error.value) return

  const payload = {
    title: form.title.trim(),
    content: form.content.trim(),
    date_type: form.date_type,
    repeat: form.repeat,
    month: Number(form.month) || 1,
    day: Number(form.day) || 1,
    lunar_month: Number(form.lunar_month) || 1,
    lunar_day: Number(form.lunar_day) || 1,
    lunar_leap: leapOn.value,
    advance_offsets: offsets.value,
    once_date: form.repeat === 'once' ? form.once_date : '',
    enabled: enableOn.value,
  }

  saving.value = true
  try {
    if (isNew.value) await createMemo(payload)
    else await updateMemo(route.params.id, payload)
    router.push('/')
  } catch (e) {
    error.value = e?.message || '保存失败，请稍后再试'
  } finally {
    saving.value = false
  }
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
    </header>

    <main>
      <span class="crumb" @click="router.push('/')">← 返回列表</span>

      <div class="edit-card">
        <h2 class="disp">{{ isNew ? '记一笔' : '编辑备忘' }}</h2>

        <div v-if="loading" class="state-tip">正在载入这条备忘…</div>

        <template v-else>
          <p v-if="pageError" class="form-error">{{ pageError }}</p>
          <p v-if="error" class="form-error">{{ error }}</p>

          <form @submit.prevent="save">
            <div class="grid2">
              <div class="field full">
                <label>标题</label>
                <input v-model="form.title" type="text" placeholder="例如：妈妈生日" maxlength="60">
              </div>

              <div class="field full">
                <label>日期类型</label>
                <div class="seg">
                  <button
                    type="button"
                    :class="{ on: form.date_type === 'lunar' }"
                    @click="form.date_type = 'lunar'"
                  >农历</button>
                  <button
                    type="button"
                    :class="{ on: form.date_type === 'solar' }"
                    @click="form.date_type = 'solar'"
                  >阳历</button>
                </div>
              </div>

              <div v-if="form.date_type === 'lunar'" class="field">
                <label>农历日期</label>
                <div class="pick-row">
                  <select v-model.number="form.lunar_month">
                    <option v-for="(name, idx) in LUNAR_MONTHS" :key="name" :value="idx + 1">{{ name }}</option>
                  </select>
                  <select v-model.number="form.lunar_day">
                    <option v-for="(name, idx) in LUNAR_DAYS" :key="name" :value="idx + 1">{{ name }}</option>
                  </select>
                </div>
                <label class="leap">
                  <input v-model="leapOn" type="checkbox"> 闰月（当年没有时按普通月算）
                </label>
              </div>

              <div v-else class="field">
                <label>阳历日期</label>
                <div class="pick-row">
                  <select v-model.number="form.month">
                    <option v-for="n in 12" :key="n" :value="n">{{ n }}月</option>
                  </select>
                  <select v-model.number="form.day">
                    <option v-for="n in 31" :key="n" :value="n">{{ n }}日</option>
                  </select>
                </div>
              </div>

              <div class="field">
                <label>重复方式</label>
                <div class="seg">
                  <button
                    v-for="r in REPEATS"
                    :key="r.v"
                    type="button"
                    :class="{ on: form.repeat === r.v }"
                    @click="form.repeat = r.v"
                  >{{ r.t }}</button>
                </div>
              </div>

              <div v-if="form.repeat === 'once'" class="field">
                <label>单次日期</label>
                <input v-model="form.once_date" type="date" class="date-input">
              </div>

              <div class="field full">
                <label>提前提醒 · 可多选</label>
                <div class="chips2">
                  <span class="chip" :class="{ on: hasOffset(0) }" @click="toggleOffset(0)">当天</span>
                  <span class="chip" :class="{ on: hasOffset(1) }" @click="toggleOffset(1)">提前 1 天</span>
                  <span class="chip" :class="{ on: hasOffset(3) }" @click="toggleOffset(3)">提前 3 天</span>
                  <span class="chip" :class="{ on: hasOffset(7) }" @click="toggleOffset(7)">提前 7 天</span>
                  <span class="chip" :class="{ on: customOn }" @click="focusCustom">
                    自定义
                    <input
                      ref="customEl"
                      v-model="customText"
                      type="text"
                      placeholder="N"
                      inputmode="numeric"
                    >
                    天
                  </span>
                </div>
              </div>

              <div class="field full">
                <label>备注</label>
                <input v-model="form.content" type="text" placeholder="选填" maxlength="120">
              </div>

              <div class="field full">
                <label>启用</label>
                <label class="leap">
                  <input v-model="enableOn" type="checkbox"> 关闭后将不再发送这条提醒
                </label>
              </div>
            </div>

            <div class="edit-acts">
              <button class="btn btn-sage" type="submit" :disabled="saving">
                {{ saving ? '保存中…' : '保存' }}
              </button>
              <button class="btn btn-plain" type="button" :disabled="saving" @click="router.push('/')">取消</button>
            </div>
          </form>
        </template>
      </div>
    </main>
  </div>
</template>

<style scoped>
.crumb {
  display: block;
  max-width: 720px;
  margin: 16px auto 0;
  font-size: 12.5px;
  color: var(--ink-soft);
  cursor: pointer;
  letter-spacing: 1px;
}

.crumb:hover { color: var(--rose); }

.edit-card {
  background: var(--card);
  border-radius: 26px;
  padding: clamp(24px, 3.5vw, 40px);
  box-shadow: 0 18px 50px -24px rgba(74, 66, 56, .25);
  border: 2px dashed var(--line);
  max-width: 720px;
  margin: 14px auto 0;
  animation: pop .45s cubic-bezier(.34, 1.4, .44, 1) both;
}

.edit-card h2 {
  font-size: 24px;
  letter-spacing: 4px;
  margin-bottom: 26px;
  font-weight: 400;
}

.state-tip {
  text-align: center;
  color: var(--ink-soft);
  font-size: 13.5px;
  padding: 36px 0;
}

.form-error {
  background: var(--rose-soft);
  color: #c05e6d;
  font-size: 12.5px;
  border-radius: 12px;
  padding: 9px 14px;
  margin-bottom: 16px;
  text-align: center;
}

.grid2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 19px 24px;
}

.grid2 .full { grid-column: 1 / -1; }

/* 分段选择 */
.seg {
  display: flex;
  background: var(--cream);
  border-radius: 999px;
  padding: 4px;
  gap: 4px;
}

.seg button {
  flex: 1;
  padding: 10px 0;
  border: none;
  border-radius: 999px;
  background: none;
  cursor: pointer;
  font-family: inherit;
  font-size: 13.5px;
  color: var(--ink-soft);
  transition: .2s;
  letter-spacing: 1px;
}

.seg button.on {
  background: #fff;
  color: var(--ink);
  box-shadow: 0 3px 8px rgba(74, 66, 56, .14);
  font-weight: 700;
}

/* 月 / 日下拉 */
.pick-row { display: flex; gap: 10px; }

.pick-row select {
  flex: 1;
  padding: 11px 13px;
  font-size: 14px;
  font-family: inherit;
  color: var(--ink);
  background: var(--cream);
  border: 2px solid transparent;
  border-radius: 14px;
  outline: none;
  transition: .2s;
  appearance: none;
  -webkit-appearance: none;
}

.pick-row select:focus {
  border-color: var(--sage);
  background: #fff;
}

/* 单次日期输入 */
.date-input {
  width: 100%;
  padding: 11px 13px;
  font-family: inherit;
  font-size: 14px;
  color: var(--ink);
  background: var(--cream);
  border: 2px solid transparent;
  border-radius: 14px;
  outline: none;
  transition: .2s;
}

.date-input:focus {
  border-color: var(--sage);
  background: #fff;
}

/* 闰月 / 启用复选 */
.leap {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 11px;
  font-size: 12.5px;
  color: var(--ink-soft);
  cursor: pointer;
}

.leap input {
  accent-color: var(--sage);
  width: 16px;
  height: 16px;
  cursor: pointer;
  flex-shrink: 0;
}

/* 提前提醒 chips */
.chips2 {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
}

.chip {
  padding: 9px 18px;
  border-radius: 999px;
  background: var(--cream);
  border: 2px solid transparent;
  font-size: 13px;
  color: var(--ink-soft);
  cursor: pointer;
  transition: .18s;
  user-select: none;
  letter-spacing: 1px;
  display: inline-flex;
  align-items: center;
}

.chip:hover { border-color: #e3d5bb; }

.chip.on {
  background: var(--sage-soft);
  border-color: var(--sage);
  color: #4c6b4b;
  font-weight: 600;
}

.chip input {
  border: none;
  background: transparent;
  outline: none;
  font: inherit;
  color: inherit;
  width: 30px;
  text-align: center;
}

/* 底部操作 */
.edit-acts {
  display: flex;
  gap: 12px;
  margin-top: 30px;
  padding-top: 22px;
  border-top: 2px dashed var(--line);
}

.edit-acts .btn-sage { width: auto; }

@media (max-width: 640px) {
  .grid2 { grid-template-columns: 1fr; gap: 15px; }
  .edit-card { padding: 22px 18px; }
  .edit-card h2 { font-size: 20px; margin-bottom: 18px; }
  .crumb { text-align: center; }

  /* 16px 防 iOS 聚焦缩放 */
  .pick-row select,
  .date-input,
  .chip input { font-size: 16px; }
  .pick-row select { padding: 12px 11px; }
  .chip input { width: 26px; margin: -2px 0; }

  /* 提前提醒胶囊：单行横滑不换行，紧凑一致 */
  .chips2 { flex-wrap: nowrap; overflow-x: auto; gap: 7px; padding-bottom: 3px; }
  .chip { padding: 8px 12px; font-size: 12.5px; flex-shrink: 0; white-space: nowrap; }

  .edit-acts { flex-direction: column-reverse; }
  .edit-acts .btn { width: 100%; }
}
</style>
