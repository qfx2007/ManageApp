<template>
    <view class="diary-page">
        <!-- 固定网格占位，打开的文件夹在独立交互层播放。 -->
        <view class="page-intro">
            <text class="page-title">我的日记</text>
            <button size="mini" @click="openToday">＋ 写今天</button>
        </view>
        <!-- 私人云数据状态与旧日记导入入口，失败可重试且保留编辑草稿。 -->
        <view v-if="statusText" class="empty-state" @click="loadDiaries">{{ statusText }}</view>
        <button v-if="userId && hasLegacy" size="mini" :disabled="saving || loadingNotes" @click="importLegacy">导入本机旧日记</button>
        <view class="folder-grid" :style="gridStyle">
            <view v-for="entry in visibleEntries" :key="entry.id" class="folder-cell">
                <DiaryFolder v-if="entry.id !== activeId" :key="geometry.scale" :geometry="geometry"
                    :color="diaryFolder.color" :date="entry.date" :items="papers(entry.note)" :open="false"
                    @open-change="openFolder(entry.id)" />
                    </view>
        </view>
        <button v-if="visibleEntries.length < entries.length || hasMore" size="mini" :loading="loadingNotes" :disabled="loadingNotes || saving" @click="loadMore">查看更多</button>
        <text v-if="!entries.length && !loadingNotes && !loadFailed" class="empty-state">还没有日记，先写下今天吧</text>

        <view v-if="active" class="folder-layer">
            <!-- 阅读时隐藏文件夹操作区，放回后恢复同一个展开状态。 -->
            <view v-if="!focused" class="folder-controls">
                <button size="mini" @click="closeFolder">关闭文件夹</button>
                <button size="mini" @click="deleteDiary">删除日记</button>
            </view>
            <view v-show="!focused" class="folder-position" :style="positionStyle">
                <DiaryFolder :key="geometry.scale" :geometry="geometry" :color="diaryFolder.color"
                    :date="active.date" :items="activePapers" :open="folderOpen" :spread="layout.slots"
                    :bounds="bounds" @select="readPaper" @open-change="closeFolder"
                    @settled="onMotionSettled" />
            </view>

            <!-- 阅读与编辑共用同一张白色纸张，关闭后纸张弹回原位。 -->
            <view v-if="focused" class="reader-mask">
                <view class="reader">
                    <view class="reader-head">
                        <text>{{ paperTitle }}</text>
                        <button size="mini" @click.stop="closePaper">放回</button>
                    </view>
                    <!-- 标题和操作栏固定，长文本及编辑节点只滚动正文。 -->
                    <scroll-view scroll-y class="reader-body">
                        <view class="reader-content">
                            <view v-if="focused === 'timeline'" class="timeline">
                                <view v-for="(node, index) in shownNodes" :key="node.id" class="timeline-node">
                                    <view v-if="editing" class="node-tools">
                                        <checkbox-group @change="toggleTime(index, $event)">
                                            <label><checkbox value="time" :checked="node.showTime" />显示时间</label>
                                        </checkbox-group>
                                        <button v-if="node.showTime" size="mini" @click="openTimePicker(node)">{{ node.time }}</button>
                                        <button size="mini" :disabled="index === 0" @click="moveNode(index, -1)">上移</button>
                                        <button size="mini" :disabled="index === shownNodes.length - 1" @click="moveNode(index, 1)">下移</button>
                                        <button size="mini" @click="removeNode(index)">删除节点</button>
                                    </view>
                                    <text v-else-if="node.showTime" class="node-time">{{ node.time }}</text>
                                    <textarea v-if="editing" v-model="node.text" :disabled="saving" auto-height maxlength="1000" placeholder="写下这一刻" />
                                    <text v-else class="paper-text">{{ node.text }}</text>
                                </view>
                                <text v-if="!editing && !shownNodes.length" class="paper-text">还没有时间轴记录</text>
                                <button v-if="editing" size="mini" @click="addNode">＋ 新增节点</button>
                            </view>
                            <textarea v-else-if="editing" v-model="draftText" :disabled="saving" auto-height maxlength="1000" placeholder="写下你的日记" />
                            <text v-else class="paper-text">{{ active.note[focused] || '这张纸还是空白的' }}</text>
                        </view>
                    </scroll-view>
                    <view class="reader-actions">
                        <template v-if="editing">
                            <button size="mini" :disabled="saving" @click="editing = false">取消</button>
                            <button size="mini" :loading="saving" :disabled="saving" @click="savePaper">保存</button>
                        </template>
                        <template v-else>
                            <button size="mini" @click="deletePaper">删除纸张</button>
                            <button size="mini" @click="editPaper">编辑</button>
                        </template>
                    </view>
                </view>
            </view>
            <!-- 共用一个时间选择器，确认后只更新所选节点的草稿。 -->
            <up-datetime-picker v-if="timeTarget" :show="true" mode="time" :model-value="pickerTime"
                @confirm="confirmTime" @cancel="dismissTimePicker" @close="dismissTimePicker" />
        </view>
    </view>
</template>

<script setup lang="ts">
// 已登录日记以云数据库为准；旧本地数据仅在本人确认后导入。
import { computed, nextTick, ref, onMounted, onBeforeUnmount } from 'vue'
import { onShow, onBackPress } from '@dcloudio/uni-app'
import DiaryFolder from '@/components/DiaryFolder.vue'
import { diaryFolder, diaryGeometry, spreadLayout } from '@/config/diary-folder'

import { STORAGE_KEYS } from '@/services/local-storage'
import { loadCurrentUser, fetchDiaryPage, saveDiaryToCloud, deleteDiaryFromCloud, importLocalDiaries } from '@/utils/cloud.js'
import { beijingDate } from '@/utils/mood'

const storageKey = STORAGE_KEYS.diary
const sections = [
    { key: 'food', label: '吃了什么' },
    { key: 'timeline', label: '时间轴' },
    { key: 'thoughts', label: '碎碎念' },
    { key: 'gratitude', label: '感恩' }
] as const
type PaperKey = typeof sections[number]['key']
type Node = { id: string; text: string; showTime: boolean; time: string }
type Note = Partial<Record<PaperKey, string>> & {
    deletedPapers?: PaperKey[]
    timelineNodes?: Node[]
    timelineTime?: string
    timelineEnabled?: boolean
    updatedAt?: number
}
type Entry = { id: string; date: string; note: Note }
const notes = ref<Record<string, Note>>({})
// 云端按日期游标读取，页面不一次加载全部历史。
const userId = ref('')
const loadingNotes = ref(false)
const saving = ref(false)
const hasMore = ref(false)
const cursor = ref('')
const statusText = ref('')
const loadFailed = ref(false)
const hasLegacy = ref(false)
const activeId = ref('')
const folderOpen = ref(false)
const focused = ref<PaperKey | ''>('')
const editing = ref(false)
const draftText = ref('')
const draftNodes = ref<Node[]>([])
const timeTarget = ref('')
const pickerTime = ref('09:00')
let nodeSequence = 0
const visibleCount = ref(24)
const viewport = ref({ width: 375, height: 650 })
function updateViewport() {
    const info = uni.getWindowInfo()
    viewport.value = { width: info.windowWidth, height: info.windowHeight }
}
updateViewport()
onMounted(() => uni.onWindowResize(updateViewport))
onBeforeUnmount(() => uni.offWindowResize(updateViewport))

const geometry = computed(() => diaryGeometry(Math.max(1, viewport.value.width)))
const gridStyle = computed(() => {
    const available = viewport.value.width
    const columns = Math.max(1, Math.floor((available + diaryFolder.gap) / (geometry.value.w + diaryFolder.gap)))
    return {
        gridTemplateColumns: `repeat(${columns}, ${geometry.value.w}px)`,
        gridAutoRows: `${geometry.value.tabH + geometry.value.h}px`,
        gap: `${diaryFolder.gap}px`
    }
})

const entries = computed<Entry[]>(() => Object.keys(notes.value)
    .filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date) && notes.value[date])
    .sort((a, b) => b.localeCompare(a))
    .map(date => ({ id: date, date, note: notes.value[date] })))
const visibleEntries = computed(() => entries.value.slice(0, visibleCount.value))
const active = computed(() => entries.value.find(entry => entry.id === activeId.value))
function papers(note: Note) { return sections.filter(section => !note.deletedPapers?.includes(section.key)) }
const activePapers = computed(() => active.value ? papers(active.value.note) : [])
const layout = computed(() => spreadLayout(activePapers.value.length, viewport.value, geometry.value))
const positionStyle = computed(() => ({ left: `${layout.value.stageLeft}px`, top: `${layout.value.stageTop}px` }))
const bounds = computed(() => ({ left: layout.value.stageLeft, top: layout.value.stageTop, ...viewport.value }))
const paperTitle = computed(() => sections.find(section => section.key === focused.value)?.label)
const shownNodes = computed(() => editing.value ? draftNodes.value : readNodes(active.value?.note || {}))

onShow(loadDiaries)
onBackPress(() => {
    if (timeTarget.value) { dismissTimePicker(); return true }
    if (focused.value) { closePaper(); return true }
    if (activeId.value) { closeFolder(); return true }
    return false
})

// 切换账号先清空旧页面内容，读取失败不回退到其他账号的缓存。
async function loadDiaries() {
    if (loadingNotes.value || saving.value) return
    loadingNotes.value = true
    statusText.value = '正在读取日记…'
    loadFailed.value = false
    try {
        const user = await loadCurrentUser()
        const nextId = user?._id || ''
        if (nextId !== userId.value) {
            notes.value = {}
            activeId.value = ''
            folderOpen.value = false
            focused.value = ''
            editing.value = false
        }
        userId.value = nextId
        if (editing.value) { statusText.value = ''; return }
        hasLegacy.value = Object.keys(uni.getStorageSync(storageKey) || {}).length > 0
        if (!userId.value) {
            notes.value = uni.getStorageSync(storageKey) || {}
            hasMore.value = false
            statusText.value = '尚未登录，日记仅保存在本机；登录后可导入云端'
            return
        }
        const page = await fetchDiaryPage()
        notes.value = Object.fromEntries(page.entries.map((item: { date: string; note: Note }) => [item.date, item.note]))
        cursor.value = page.cursor
        hasMore.value = page.hasMore
        visibleCount.value = 24
        statusText.value = ''
    } catch {
        loadFailed.value = true
        statusText.value = '读取日记失败，点击重试'
    } finally {
        loadingNotes.value = false
    }
}

async function loadMore() {
    if (loadingNotes.value || saving.value) return
    if (visibleCount.value < entries.value.length) { visibleCount.value += 24; return }
    if (!userId.value || !hasMore.value) return
    loadingNotes.value = true
    try {
        const page = await fetchDiaryPage(cursor.value)
        for (const item of page.entries) notes.value[item.date] = item.note
        cursor.value = page.cursor
        hasMore.value = page.hasMore
        visibleCount.value += 24
    } catch {
        uni.showToast({ title: '读取失败，请再次点击查看更多', icon: 'none' })
    } finally { loadingNotes.value = false }
}

async function importLegacy() {
    if (saving.value || loadingNotes.value) return
    const result = await new Promise<boolean>(resolve => uni.showModal({
        title: '导入本机日记', content: '确认这些日记属于当前账号？已有云端日期会跳过，本机原件会保留。',
        success: result => resolve(result.confirm), fail: () => resolve(false)
    }))
    if (!result) return
    saving.value = true
    try {
        const result = await importLocalDiaries(uni.getStorageSync(storageKey) || {})
        uni.showModal({ title: '导入完成', content: `新增 ${result.imported} 天，跳过已有 ${result.skipped} 天；本机原件已保留。`, showCancel: false })
    } catch {
        uni.showToast({ title: '导入未完成，原件保留，可重试', icon: 'none' })
    } finally { saving.value = false }
    await loadDiaries()
}

// 云端确认后才更新界面；失败不退出编辑状态、不丢弃草稿。
async function commit(entry: Entry, note?: Note) {
    if (saving.value || loadingNotes.value || loadFailed.value) return false
    saving.value = true
    try {
        if (userId.value) {
            if (uni.getStorageSync(STORAGE_KEYS.currentUser)?._id !== userId.value) throw new Error('账号已变化，请重新进入日记')
            if (note) await saveDiaryToCloud(entry.date, note)
            else await deleteDiaryFromCloud(entry.date)
        }
        const next = { ...notes.value }
        if (note) next[entry.date] = note
        else delete next[entry.date]
        if (!userId.value) uni.setStorageSync(storageKey, next)
        notes.value = next
        uni.showToast({ title: userId.value ? '已保存到云端' : '已保存到本机', icon: 'success' })
        return true
    } catch {
        uni.showToast({ title: '保存失败，请重试', icon: 'none' })
        return false
    } finally { saving.value = false }
}

async function openFolder(id: string) {
    if (activeId.value) return
    activeId.value = id
    await nextTick()
    if (activeId.value === id) folderOpen.value = true
}
async function openToday() {
    const date = beijingDate()
    if (notes.value[date] || await commit({ id: date, date, note: {} }, {})) void openFolder(date)
}
function closeFolder() {
    if (focused.value || saving.value) return
    folderOpen.value = false
}
function onMotionSettled() {
    if (!folderOpen.value) activeId.value = ''
}
function readPaper(item: { key: string }) {
    if (!folderOpen.value || focused.value) return
    const paper = activePapers.value.find(section => section.key === item.key)
    if (paper) focused.value = paper.key
}
function closePaper() {
    if (saving.value) return
    editing.value = false
    dismissTimePicker()
    focused.value = ''
}

// 旧版单条日记延迟转换，首次保存时间轴时才写入节点数组。
function readNodes(note: Note): Node[] {
    if (Array.isArray(note.timelineNodes)) return note.timelineNodes
    if (!note.timeline) return []
    const legacy = /^([01]\d|2[0-3]):([0-5]\d) {2}([\s\S]*)$/.exec(note.timeline)
    const usePrefix = !note.timelineTime && legacy
    return [{
        id: 'legacy', text: usePrefix ? legacy[3] : note.timeline,
        showTime: note.timelineEnabled !== false,
        time: note.timelineTime || (legacy ? `${legacy[1]}:${legacy[2]}` : '09:00')
    }]
}
function editPaper() {
    if (!active.value || !focused.value) return
    draftText.value = active.value.note[focused.value] || ''
    draftNodes.value = readNodes(active.value.note).map(node => ({ ...node }))
    editing.value = true
}
function addNode() {
    if (saving.value) return
    draftNodes.value.push({ id: `node-${Date.now()}-${nodeSequence++}`, text: '', showTime: true, time: '09:00' })
}
function moveNode(index: number, step: number) {
    if (saving.value) return
    const target = index + step
    if (target < 0 || target >= draftNodes.value.length) return
    const [node] = draftNodes.value.splice(index, 1)
    draftNodes.value.splice(target, 0, node)
}
function toggleTime(index: number, event: { detail: { value: string[] } }) {
    if (saving.value) return
    draftNodes.value[index].showTime = event.detail.value.includes('time')
}
// 节点按 ID 定位，取消选择时不修改原草稿。
function openTimePicker(node: Node) {
    pickerTime.value = node.time
    timeTarget.value = node.id
}
function dismissTimePicker() {
    timeTarget.value = ''
}
function confirmTime(event: { value: string }) {
    const node = draftNodes.value.find(item => item.id === timeTarget.value)
    if (node && /^([01]\d|2[0-3]):[0-5]\d$/.test(event.value)) node.time = event.value
    dismissTimePicker()
}
function confirmDelete(content: string): Promise<boolean> {
    return new Promise(resolve => uni.showModal({
        title: '确认删除', content, confirmText: '删除', confirmColor: '#bd4747',
        success: result => resolve(result.confirm), fail: () => resolve(false)
    }))
}
async function removeNode(index: number) {
    if (saving.value) return
    if (await confirmDelete('删除这个时间轴节点？保存后生效。')) draftNodes.value.splice(index, 1)
}
async function savePaper() {
    const entry = active.value
    const key = focused.value
    if (!entry || !key) return
    const note = { ...entry.note, updatedAt: Date.now() }
    if (key === 'timeline') {
        note.timelineNodes = draftNodes.value.map(node => ({ ...node }))
        delete note.timeline
        delete note.timelineTime
        delete note.timelineEnabled
    } else note[key] = draftText.value
    if (await commit(entry, note)) editing.value = false
}
async function deletePaper() {
    const entry = active.value
    const key = focused.value
    if (!entry || !key) return
    if (papers(entry.note).length <= 1) {
        uni.showToast({ title: '至少保留一张纸', icon: 'none' })
        return
    }
    if (!await confirmDelete(`删除「${paperTitle.value}」及其内容？`)) return
    const latest = active.value
    if (latest?.id !== entry.id || papers(latest.note).length <= 1 || !papers(latest.note).some(paper => paper.key === key)) return
    const note = { ...latest.note, deletedPapers: [...(latest.note.deletedPapers || []), key], updatedAt: Date.now() }
    delete note[key]
    if (key === 'timeline') {
        delete note.timelineNodes
        delete note.timelineTime
        delete note.timelineEnabled
    }
    if (await commit(latest, note)) closePaper()
}
async function deleteDiary() {
    const entry = active.value
    if (!entry || !await confirmDelete(`删除 ${entry.date} 的整篇日记？`)) return
    if (await commit(entry)) {
        closePaper()
        folderOpen.value = false
        activeId.value = ''
    }
}
</script>

<style lang="scss" scoped>
.diary-page {
    min-height: 100vh;
    padding: 22px 0 40px;
    box-sizing: border-box;
    background: linear-gradient(180deg, #fff2ec, #fffaf5 60%, #fff4e7);
    color: $q-color-text;

    .page-intro {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin: 0 15px 20px;
        button { margin: 0; }
    }

    .page-title { font-size: $q-font-size-large; font-weight: 700; }
    // 固定列宽组成整块网格，剩余宽度平分在两侧。
    .folder-grid {
        display: grid;
        justify-content: center;
    }
    .folder-cell { position: relative; }
    .empty-state {
        display: block;
        padding: 80rpx 0;
        text-align: center;
        color: $q-color-text-muted;
    }

    // 独立固定层避免网格移位，纸张样式由弹簧矩阵更新。
    .folder-layer {
        position: fixed;
        inset: 0;
        z-index: 20;
        background: rgba(81, 43, 34, .42);
        .folder-position { position: absolute; }
        .folder-controls {
            position: absolute;
            right: 12px;
            bottom: 10px;
            left: 12px;
            z-index: 1;
            display: flex;
            justify-content: center;
            gap: 12px;
            button { margin: 0; }
        }
    }

    .reader-mask {
        position: absolute;
        inset: 0;
        z-index: 2;
        display: grid;
        place-items: center;
        padding: 16px;
        box-sizing: border-box;
        background: rgba(81, 43, 34, .22);
        .reader {
            display: flex;
            flex-direction: column;
            min-height: 0;
            overflow: hidden;
            gap: 12px;
            width: 100%;
            max-width: 540px;
            height: 100%;
            max-height: 740px;
            padding: 16px;
            box-sizing: border-box;
            border-radius: $q-radius-sm;
            background: #fff;
        }
        .reader-head,
        .reader-actions {
            flex: 0 0 auto;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 12px;
            button { margin: 0; }
        }
        .reader-head { font-size: $q-font-size-large; font-weight: 700; }
        // 小程序 scroll-view 需要可计算的高度，剩余空间由 flex 分配。
        .reader-body {
            flex: 1 1 0;
            width: 100%;
            height: 0;
            min-height: 0;
        }
        .reader-content {
            width: 100%;
            min-width: 0;
        }
        .paper-text {
            display: block;
            white-space: pre-wrap;
            overflow-wrap: break-word;
            word-break: break-word;
        }
        textarea {
            width: 100%;
            min-height: 80px;
            box-sizing: border-box;
            padding: 8px;
            background: $q-color-cream;
            border-radius: $q-radius-sm;
            font-size: $q-font-size-medium;
            line-height: 1.55;
        }
        // 时间轴的竖线和圆点不依赖时间是否显示。
        .timeline {
            padding: 4px 0 4px 8px;
            .timeline-node {
                position: relative;
                padding: 0 0 20px 14px;
                border-left: 1px solid #e7ad78;
                &::before {
                    position: absolute;
                    top: 4px;
                    left: -4px;
                    width: 7px;
                    height: 7px;
                    border-radius: 50%;
                    background: #e7ad78;
                    content: '';
                }
            }
            .node-time { display: block; color: $q-color-text-muted; font-size: $q-font-size-small; }
            .node-tools {
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                gap: 6px;
                margin-bottom: 6px;
                font-size: $q-font-size-small;
                button { margin: 0; }
            }
        }
    }
}
</style>
