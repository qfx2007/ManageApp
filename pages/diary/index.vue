<template>
    <view class="diary-page">
        <!-- 日记桌面：月份文件夹和日期文件入口。 -->
        <view class="page-intro">
            <text class="eyebrow">MY LITTLE DESK</text>
            <text class="page-title">我的日记</text>
            <button class="write-button" @click="openToday">＋ 写今天</button>
        </view>
        <text class="page-tip">点击文件夹打开日记本，记录今天值得记住的事情</text>

        <scroll-view scroll-y class="folder-list">
            <view v-for="group in monthGroups" :key="group.month" class="month-folder">
                <view class="folder-tab"></view>
                <view class="folder-head" @click="toggleMonth(group.month)">
                    <text class="month-name">{{ group.label }}</text>
                    <text class="month-count">{{ group.items.length }} 篇　{{ folded[group.month] ? '展开' : '收起' }}⌄</text>
                </view>
                <view v-if="!folded[group.month]" class="file-grid">
                    <view v-for="item in group.items" :key="item.date" class="diary-file" @click="openEntry(item.date)">
                        <view class="file-paper">
                            <text class="file-date">{{ item.date.slice(8) }}</text>
                            <text class="file-mark">{{ item.hasContent ? '✦' : '·' }}</text>
                        </view>
                        <text class="file-state">{{ item.hasContent ? '已记录' : '空白页' }}</text>
                    </view>
                    <view class="new-file" @click="openToday">＋<text>新建日记</text></view>
                </view>
            </view>
            <view v-if="!monthGroups.length" class="empty-state">还没有日记，先写下今天吧</view>
        </scroll-view>

        <!-- 四宫格日记本：保留设计图中的吃饭、时间轴、碎碎念和感恩入口。 -->
        <view v-if="showBook" class="mask" @click="closeBook">
            <view class="book" @click.stop>
                <view class="book-head"><text>{{ activeDate }}</text><text @click="closeBook">合上</text></view>
                <view class="quad-grid">
                    <view v-for="section in sections" :key="section.key" class="quad-card" @click="editSection(section.key)">
                        <text class="quad-title">{{ section.title }}</text>
                        <text class="quad-preview">{{ currentNote[section.key] || '点击写下今天的记录…' }}</text>
                        <text class="pen">✎</text>
                    </view>
                </view>
                <button class="save-button" @click="saveNote">{{ saved ? '已保存' : '保存今天' }}</button>
            </view>
        </view>

        <view v-if="editingKey" class="mask" @click="editingKey = ''">
            <view class="editor" @click.stop>
                <text class="editor-title">{{ sectionTitle }}</text>
                <textarea v-model="draftValue" maxlength="1000" placeholder="写下你想记住的事情…" />
                <view class="editor-actions"><text @click="editingKey = ''">取消</text><text class="done" @click="finishEdit">完成</text></view>
            </view>
        </view>
    </view>
</template>

<script setup>
// 日记页面使用本地存储，避免新增云端数据结构。
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'

const storageKey = 'fourPartDiaries'
const blankNote = () => ({ food: '', timeline: '', thoughts: '', gratitude: '' })
const entries = ref([])
const folded = ref({})
const activeDate = ref('')
const currentNote = ref(blankNote())
const showBook = ref(false)
const editingKey = ref('')
const draftValue = ref('')
const saved = ref(false)
const sections = [
    { key: 'food', title: '吃了什么' },
    { key: 'timeline', title: '时间轴' },
    { key: 'thoughts', title: '碎碎念' },
    { key: 'gratitude', title: '感恩' }
]

const monthGroups = computed(() => {
    const groups = {}
    entries.value.forEach((item) => {
        const month = item.date.slice(0, 7)
        if (!groups[month]) groups[month] = { month, label: `${month.slice(0, 4)}年${month.slice(5)}月`, items: [] }
        groups[month].items.push(item)
    })
    return Object.values(groups)
})
const sectionTitle = computed(() => sections.find((item) => item.key === editingKey.value)?.title || '')

onShow(loadEntries)

function formatDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
function loadEntries() {
    const all = uni.getStorageSync(storageKey) || {}
    entries.value = Object.keys(all).filter((key) => /^\d{4}-\d{2}-\d{2}$/.test(key)).sort().reverse().map((date) => ({
        date,
        hasContent: Object.values(all[date] || {}).some((value) => typeof value === 'string' && value)
    }))
}
function toggleMonth(month) { folded.value[month] = !folded.value[month] }
function openToday() { openEntry(formatDate(new Date())) }
function openEntry(date) {
    const all = uni.getStorageSync(storageKey) || {}
    activeDate.value = date
    currentNote.value = { ...blankNote(), ...(all[date] || {}) }
    saved.value = false
    showBook.value = true
}
function closeBook() { showBook.value = false; editingKey.value = ''; loadEntries() }
function editSection(key) { editingKey.value = key; draftValue.value = currentNote.value[key] || '' }
function finishEdit() { currentNote.value[editingKey.value] = draftValue.value; editingKey.value = ''; saved.value = false }
function saveNote() {
    const all = uni.getStorageSync(storageKey) || {}
    all[activeDate.value] = { ...(all[activeDate.value] || {}), ...currentNote.value, updatedAt: Date.now() }
    uni.setStorageSync(storageKey, all)
    saved.value = true
    loadEntries()
}
</script>

<style lang="scss" scoped>
.diary-page {
    min-height: 100vh;
    padding: 42rpx 28rpx 48rpx;
    color: $q-color-text;
    background: linear-gradient(180deg, #fff2ec 0%, #fffaf5 60%, #fff4e7 100%);
    box-sizing: border-box;

    .page-intro { display: grid; grid-template-columns: 1fr auto; align-items: end; gap: 18rpx; }
    .eyebrow { grid-column: 1 / -1; color: #c38a7e; font-size: $q-font-size-small; letter-spacing: 4rpx; }
    .page-title { font-size: $q-font-size-large; font-weight: 700; }
    .write-button { margin: 0; padding: 12rpx 20rpx; border: 2rpx solid #f3b7a5; border-radius: 28rpx; color: #b85f4d; background: #fffaf5; font-size: $q-font-size-small; line-height: 1.4; }
    .page-tip { display: block; margin: 18rpx 0 26rpx; color: $q-color-text-muted; font-size: $q-font-size-small; }
    .folder-list { height: calc(100vh - 230rpx); }
    .month-folder { position: relative; margin: 22rpx 0 30rpx; padding: 20rpx 16rpx 18rpx; border-radius: 24rpx; background: #ffd98c; box-shadow: $q-shadow-soft; }
    .folder-tab { position: absolute; top: -16rpx; left: 22rpx; width: 170rpx; height: 28rpx; border-radius: 16rpx 16rpx 0 0; background: #ffe6a9; }
    .folder-head { display: flex; align-items: center; justify-content: space-between; padding: 8rpx 12rpx 20rpx; }
    .month-name { font-size: $q-font-size-medium; font-weight: 700; }
    .month-count { color: #8c6548; font-size: $q-font-size-small; }
    .file-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20rpx 14rpx; padding: 22rpx 16rpx; border-radius: 18rpx; background: rgba(235, 174, 77, .32); }
    .diary-file { text-align: center; &:active { transform: scale(.96); } }
    .file-paper { position: relative; height: 112rpx; overflow: hidden; border-radius: 12rpx; background: #fffdf8; box-shadow: 0 8rpx 12rpx rgba(117, 67, 31, .18); }
    .file-paper::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 22rpx; background: #d9eff7; }
    .file-date { position: relative; display: block; padding-top: 8rpx; color: #28638d; font-size: $q-font-size-small; font-weight: 700; }
    .file-mark { display: block; color: #efbd55; font-size: 42rpx; line-height: 70rpx; }
    .file-state { display: block; margin-top: 6rpx; color: #754b32; font-size: 20rpx; }
    .new-file { display: grid; min-height: 112rpx; place-content: center; border: 2rpx dashed rgba(255, 255, 255, .75); border-radius: 12rpx; color: #fff; font-size: 42rpx; text-align: center; text { display: block; font-size: 20rpx; } }
    .empty-state { padding: 100rpx 20rpx; color: $q-color-text-muted; font-size: $q-font-size-medium; text-align: center; }
    .mask { position: fixed; inset: 0; z-index: 20; display: grid; place-items: center; padding: 28rpx; background: rgba(81, 43, 34, .56); }
    .book, .editor { width: 100%; border-radius: 24rpx; background: #fffaf1; box-shadow: 0 24rpx 70rpx rgba(0, 0, 0, .28); }
    .book { padding: 28rpx; }
    .book-head { display: flex; justify-content: space-between; color: $q-color-text; font-size: $q-font-size-medium; font-weight: 700; }
    .quad-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16rpx; margin-top: 26rpx; }
    .quad-card { position: relative; min-height: 230rpx; padding: 22rpx; border: 2rpx solid #efd9bd; border-radius: 16rpx; background: #fffdf8; }
    .quad-title { display: block; padding-bottom: 12rpx; border-bottom: 2rpx solid #f0dfca; color: #98684f; font-size: $q-font-size-medium; font-weight: 700; }
    .quad-preview { display: block; margin-top: 16rpx; color: #66574e; font-size: $q-font-size-small; line-height: 1.6; }
    .pen { position: absolute; right: 16rpx; bottom: 10rpx; color: #c28a68; }
    .save-button { margin: 24rpx auto 0; padding: 12rpx 34rpx; border-radius: 28rpx; color: #fff; background: $q-color-primary; font-size: $q-font-size-medium; }
    .editor { padding: 34rpx; }
    .editor-title { display: block; margin-bottom: 22rpx; font-size: $q-font-size-large; font-weight: 700; }
    textarea { width: 100%; min-height: 300rpx; padding: 22rpx; border-radius: 16rpx; background: #fff; box-sizing: border-box; font-size: $q-font-size-medium; }
    .editor-actions { display: flex; justify-content: flex-end; gap: 28rpx; margin-top: 26rpx; color: #986b53; font-size: $q-font-size-medium; }
    .done { padding: 14rpx 28rpx; border-radius: 28rpx; color: #fff; background: $q-color-primary; }
}
</style>

