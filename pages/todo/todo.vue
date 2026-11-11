<template>
  <view class="page">
    <!-- 顶部统计 -->
    <view class="status-bar">
      <view class="status-item" @click="switchTab('pending')">
        <text class="status-num" :class="{ active: currentTab === 'pending' }">{{ pendingList.length }}</text>
        <text class="status-label">待完成</text>
      </view>
      <view class="status-item" @click="switchTab('done')">
        <text class="status-num" :class="{ active: currentTab === 'done' }">{{ completedList.length }}</text>
        <text class="status-label">已完成</text>
      </view>
      <view class="status-item" @click="switchTab('all')">
        <text class="status-num" :class="{ active: currentTab === 'all' }">{{ taskList.length }}</text>
        <text class="status-label">全部</text>
      </view>
    </view>

    <!-- 分类 Tabs (uview-plus) -->
    <up-tabs
      :list="tabs"
      :current="tabIndex"
      :scrollable="false"
      @change="onTabChange"
    />

    <!-- 空状态 (uview-plus) -->
    <up-empty
      v-if="filteredList.length === 0"
      mode="list"
      :text="'暂无' + currentTabLabel + '任务'"
      marginTop="200"
    />

    <!-- 任务列表 (uview-plus: swipe-action + cell) -->
    <view v-else class="list-wrap">
      <up-swipe-action v-for="task in filteredList" :key="task.id">
        <up-cell
          :border="true"
          @click="openEdit(task)"
        >
          <template #icon>
            <up-checkbox
              usedAlone
              shape="circle"
              :checked="task.completed"
              activeColor="#52c41a"
              @change="(checked) => toggleTask(task, checked)"
            />
          </template>
          <template #title>
            <text
              class="task-title"
              :class="{ 'task-done': task.completed }"
            >{{ task.title }}</text>
          </template>
          <template #label>
            <view class="task-meta" v-if="task.deadline">
              <up-icon name="clock" size="13" color="#1677ff"></up-icon>
              <text
                class="deadline-text"
                :class="{ overdue: !task.completed && isOverdue(task.deadline) }"
              >{{ formatDeadline(task.deadline) }}</text>
            </view>
            <view class="task-tags">
              <up-tag
                v-if="task.reminderOffset"
                :text="getReminderLabel(task.reminderOffset)"
                type="warning"
                size="mini"
                shape="circle"
                plain
              />
              <up-tag
                :text="task.reminderMethod === 'wechat' ? '微信通知' : '音乐提醒'"
                :type="task.reminderMethod === 'wechat' ? 'primary' : 'success'"
                size="mini"
                shape="circle"
                plain
              />
            </view>
          </template>
          <template #right-icon>
            <up-icon name="arrow-right" color="#ccc" size="14"></up-icon>
          </template>
        </up-cell>
        <template #right>
          <view class="swipe-delete" @click.stop="confirmDelete(task)">
            <up-icon name="trash" color="#fff" size="20"></up-icon>
            <text class="swipe-delete-text">删除</text>
          </view>
        </template>
      </up-swipe-action>
    </view>

    <!-- FAB 添加按钮 -->
    <view class="fab" @click="openAdd">
      <up-icon name="plus" color="#fff" size="20"></up-icon>
    </view>

    <!-- 添加/编辑弹窗 (uview-plus: popup) -->
    <up-popup
      v-model:show="showPopup"
      mode="bottom"
      :round="20"
      :safeAreaInsetBottom="true"
      :closeOnClickOverlay="false"
    >
      <view class="popup-inner">
        <view class="popup-header">
          <text class="popup-title">{{ editingTask ? '编辑任务' : '添加任务' }}</text>
          <up-icon name="close" color="#999" size="18" @click="closePopup"></up-icon>
        </view>

        <scroll-view scroll-y class="popup-body">
          <!-- 任务名称 -->
          <up-input
            v-model="form.title"
            placeholder="请输入任务名称"
            border="surround"
            clearable
            maxlength="50"
          />

          <!-- 截止时间 -->
          <view class="form-section">
            <text class="form-label">截止时间</text>
            <up-datetime-picker
              hasInput
              v-model="form.deadline"
              mode="datetime"
              placeholder="点此选择截止时间（可选）"
              :minDate="minDate"
            />
          </view>

          <!-- 提醒提前量 -->
          <view class="form-section">
            <text class="form-label">提前提醒</text>
            <up-cell
              :title="'选择提前时间'"
              :value="reminderLabels[form.reminderIndex]"
              isLink
              @click="showReminderPicker = true"
            />
            <up-picker
              v-model:show="showReminderPicker"
              :columns="[reminderLabels]"
              :defaultIndex="[form.reminderIndex]"
              keyName="label"
              @confirm="onReminderConfirm"
            />
          </view>

          <!-- 提醒方式 -->
          <view class="form-section">
            <text class="form-label">提醒方式</text>
            <up-radio-group v-model="form.reminderMethod" placement="row" iconPlacement="right">
              <up-radio label="微信服务通知" name="wechat" />
              <up-radio label="音乐提示" name="music" />
            </up-radio-group>
          </view>
        </scroll-view>

        <!-- 底部按钮 -->
        <view class="popup-footer">
          <view v-if="editingTask" class="footer-left">
            <up-button
              text="删除任务"
              type="error"
              shape="circle"
              plain
              @click="confirmDeleteCurrent"
            />
          </view>
          <up-button
            class="footer-save"
            :text="editingTask ? '保存修改' : '添加任务'"
            type="primary"
            shape="circle"
            @click="saveTask"
          />
        </view>
      </view>
    </up-popup>
  </view>
</template>

<script>
import { syncTasksToCloud } from '@/utils/cloud.js'

const STORAGE_KEY = 'todoTasks'
const REMINDER_OPTIONS = [
  { label: '不提醒', value: 0 },
  { label: '提前15分钟', value: 15 * 60 * 1000 },
  { label: '提前30分钟', value: 30 * 60 * 1000 },
  { label: '提前1小时', value: 60 * 60 * 1000 },
  { label: '提前2小时', value: 2 * 60 * 60 * 1000 },
  { label: '提前1天', value: 24 * 60 * 60 * 1000 },
  { label: '提前3天', value: 3 * 24 * 60 * 60 * 1000 },
  { label: '提前1周', value: 7 * 24 * 60 * 60 * 1000 }
]

function pad(n) {
  return n.toString().padStart(2, '0')
}

export default {
  data() {
    return {
      taskList: [],
      currentTab: 'all',
      showPopup: false,
      showReminderPicker: false,
      editingTask: null,
      form: {
        title: '',
        deadline: null,
        reminderIndex: 0,
        reminderMethod: 'wechat'
      }
    }
  },
  computed: {
    minDate() {
      return Date.now()
    },
    tabs() {
      return [
        { name: '待完成', badge: { value: this.pendingList.length } },
        { name: '已完成', badge: { value: this.completedList.length } },
        { name: '全部', badge: { value: this.taskList.length } }
      ]
    },
    tabIndex() {
      return this.currentTab === 'pending' ? 0 : this.currentTab === 'done' ? 1 : 2
    },
    reminderLabels() {
      return REMINDER_OPTIONS.map(o => o.label)
    },
    pendingList() {
      return this.taskList.filter(t => !t.completed)
    },
    completedList() {
      return this.taskList.filter(t => t.completed)
    },
    filteredList() {
      if (this.currentTab === 'pending') return this.pendingList
      if (this.currentTab === 'done') return this.completedList
      return this.taskList
    },
    currentTabLabel() {
      return this.currentTab === 'all' ? '全部' : this.currentTab === 'pending' ? '待完成' : '已完成'
    }
  },
  onShow() {
    this.loadTasks()
  },
  methods: {
    onTabChange(tabItem) {
      const map = { 0: 'pending', 1: 'done', 2: 'all' }
      this.currentTab = map[tabItem.index] || 'pending'
    },
    switchTab(key) {
      this.currentTab = key
    },
    loadTasks() {
      const saved = uni.getStorageSync(STORAGE_KEY)
      if (saved && saved.length > 0) {
        this.taskList = saved.map(t => ({
          ...t,
          createTime: t.createTime || t.updateTime || Date.now(),
          updateTime: t.updateTime || t.createTime || Date.now()
        }))
      } else {
        this.taskList = []
      }
    },
    saveTasksToStorage() {
      uni.setStorageSync(STORAGE_KEY, this.taskList)
      this.syncToCloud()
    },
    syncToCloud() {
      syncTasksToCloud().then(() => {}).catch(() => {})
    },
    toggleTask(task, checked) {
      task.completed = checked
      task.updateTime = Date.now()
      this.saveTasksToStorage()
    },
    openAdd() {
      this.editingTask = null
      this.form = {
        title: '',
        deadline: null,
        reminderIndex: 0,
        reminderMethod: 'wechat'
      }
      this.showPopup = true
    },
    openEdit(task) {
      this.editingTask = task
      const ri = REMINDER_OPTIONS.findIndex(o => o.value === task.reminderOffset)
      this.form = {
        title: task.title,
        deadline: task.deadline || null,
        reminderIndex: ri >= 0 ? ri : 0,
        reminderMethod: task.reminderMethod || 'wechat'
      }
      this.showPopup = true
    },
    closePopup() {
      this.showPopup = false
      this.editingTask = null
    },
    onReminderConfirm(e) {
      this.form.reminderIndex = e.indexs[0]
    },
    saveTask() {
      const title = this.form.title.trim()
      if (!title) {
        uni.$u.toast('请输入任务名称')
        return
      }

      if (this.editingTask) {
        const task = this.editingTask
        task.title = title
        task.deadline = this.form.deadline
        task.reminderOffset = REMINDER_OPTIONS[this.form.reminderIndex].value
        task.reminderMethod = this.form.reminderMethod
        task.updateTime = Date.now()
        uni.$u.toast('任务已更新')
      } else {
        this.taskList.unshift({
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          title: title,
          completed: false,
          deadline: this.form.deadline,
          reminderOffset: REMINDER_OPTIONS[this.form.reminderIndex].value,
          reminderMethod: this.form.reminderMethod,
          createTime: Date.now(),
          updateTime: Date.now()
        })
        uni.$u.toast('任务已添加')
      }
      this.saveTasksToStorage()
      this.closePopup()
    },
    confirmDelete(task) {
      uni.showModal({
        title: '确认删除',
        content: `确定要删除「${task.title}」吗？`,
        success: (res) => {
          if (res.confirm) {
            this.taskList = this.taskList.filter(t => t.id !== task.id)
            this.saveTasksToStorage()
            uni.$u.toast('任务已删除')
          }
        }
      })
    },
    confirmDeleteCurrent() {
      if (this.editingTask) {
        this.confirmDelete(this.editingTask)
        this.closePopup()
      }
    },
    formatDeadline(ts) {
      if (!ts) return ''
      const d = new Date(ts)
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
    },
    getReminderLabel(offset) {
      const item = REMINDER_OPTIONS.find(o => o.value === offset)
      return item ? item.label : ''
    },
    isOverdue(ts) {
      return ts && ts < Date.now()
    }
  }
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 160rpx;
}

.status-bar {
  display: flex;
  justify-content: space-around;
  background: #fff;
  padding: 30rpx 20rpx;
  box-shadow: 0 2rpx 10rpx rgba(0, 0, 0, 0.04);
}

.status-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.status-num {
  font-size: 48rpx;
  font-weight: bold;
  color: #606266;
}

.status-num.active {
  color: #3c9cff;
}

.status-num.done {
  color: #52c41a;
}

.status-label {
  font-size: 24rpx;
  color: #999;
  margin-top: 4rpx;
}

.list-wrap {
  padding: 0 20rpx;
}

.task-title {
  font-size: 30rpx;
  color: #303133;
  font-weight: 500;
}

.task-title.task-done {
  color: #bbb;
  text-decoration: line-through;
}

.task-meta {
  display: flex;
  align-items: center;
  margin-bottom: 8rpx;
}

.deadline-text {
  font-size: 24rpx;
  color: #3c9cff;
  margin-left: 8rpx;
}

.deadline-text.overdue {
  color: #dd524d;
}

.task-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
}

.swipe-delete {
  height: 100%;
  background: #dd524d;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0 30rpx;
}

.swipe-delete-text {
  color: #fff;
  font-size: 22rpx;
  margin-top: 6rpx;
}

.fab {
  position: fixed;
  right: 40rpx;
  bottom: 140rpx;
  width: 100rpx;
  height: 100rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #3c9cff 0%, #5cadff 100%);
  box-shadow: 0 8rpx 24rpx rgba(60, 156, 255, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.fab:active {
  transform: scale(0.9);
}

.popup-inner {
  background: #fff;
}

.popup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 32rpx 32rpx 20rpx;
  border-bottom: 1rpx solid #f0f0f0;
}

.popup-title {
  font-size: 34rpx;
  font-weight: bold;
  color: #303133;
}

.popup-body {
  padding: 32rpx;
  max-height: 65vh;
}

.form-section {
  margin-top: 32rpx;
}

.form-label {
  display: block;
  font-size: 28rpx;
  font-weight: 500;
  color: #303133;
  margin-bottom: 16rpx;
}

.popup-footer {
  display: flex;
  align-items: center;
  padding: 20rpx 32rpx 50rpx;
  gap: 20rpx;
}

.footer-left {
  flex-shrink: 0;
}

.footer-save {
  flex: 1;
}
</style>