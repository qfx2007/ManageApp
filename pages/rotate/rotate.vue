<template>
  <view class="page">
    <!-- 转盘区域 -->
    <view class="wheel-section">
      <view class="section-header">
        <!-- <text class="section-title">幸运转盘</text> -->
        <text class="section-sub">纠结的时候，就交给幸运转盘吧！</text>
      </view>

      <view class="wheel-wrapper">
        <view class="pointer"></view>
        <view
          class="wheel"
          :class="{ spinning: isSpinning }"
          :style="wheelStyle"
        >
          <view
            v-for="(item, index) in options"
            :key="'label-' + index"
            class="wheel-label"
            :style="getLabelStyle(index)"
          >
            <text class="wheel-label-text">{{ item }}</text>
          </view>
          <view class="wheel-center">
            <text class="wheel-center-text">{{ isSpinning ? '...' : 'GO' }}</text>
          </view>
        </view>
      </view>

      <view class="result-card" :class="{ show: result && !isSpinning }">
        <text class="result-label">本次选择</text>
        <text class="result-text">{{ result }}</text>
      </view>

      <button
        class="spin-btn"
        :class="{ disabled: !canSpin }"
        :disabled="!canSpin"
        @click="spin"
      >
        {{ isSpinning ? '转动中...' : '开始转转盘' }}
      </button>
    </view>

    <!-- 选项管理 -->
    <view class="options-section">
      <view class="options-header">
        <text class="options-title">选项管理</text>
        <text class="options-count">共 {{ options.length }} 项</text>
      </view>

      <view class="add-bar">
        <input
          class="add-input"
          v-model="newOption"
          placeholder="输入新选项，如：火锅"
          maxlength="20"
          confirm-type="done"
          @confirm="addOption"
        />
        <button class="add-btn" @click="addOption">添加</button>
      </view>

      <scroll-view scroll-y class="options-list" v-if="options.length > 0">
        <view
          class="option-item"
          v-for="(item, index) in options"
          :key="'opt-' + index"
        >
          <view class="option-index">{{ index + 1 }}</view>
          <input
            v-if="editingIndex === index"
            class="option-edit-input"
            v-model="editingText"
            focus
            maxlength="20"
            @blur="saveEdit(index)"
            @confirm="saveEdit(index)"
          />
          <text
            v-else
            class="option-text"
            @click="startEdit(index)"
          >{{ item }}</text>
          <view
            class="delete-btn"
            :class="{ disabled: options.length <= 2 }"
            @click="removeOption(index)"
          >
            <text class="delete-icon">×</text>
          </view>
        </view>
      </scroll-view>

      <view v-else class="empty-options">
        <text>还没有选项，快添加一些吧</text>
      </view>

      <text class="options-tip">点击选项文字可修改 · 至少保留 2 项才能转动</text>
    </view>
  </view>
</template>

<script>
const STORAGE_KEY = 'rotateOptions'
const DEFAULT_OPTIONS = ['吃火锅', '吃米饭', '吃面', '外卖', '烧烤', '汉堡']
const WHEEL_COLORS = [
  '#1677ff', '#36cfc9', '#ffc53d', '#ff7a45',
  '#9254de', '#f759ab', '#73d13d', '#597ef7',
  '#ff85c0', '#5cdbd3', '#ffd666', '#b37feb'
]

export default {
  data() {
    return {
      options: [],
      newOption: '',
      result: '',
      rotation: 0,
      isSpinning: false,
      editingIndex: -1,
      editingText: ''
    }
  },
  computed: {
    canSpin() {
      return this.options.length >= 2 && !this.isSpinning
    },
    wheelStyle() {
      const n = this.options.length
      if (n === 0) {
        return {
          background: '#e8e8e8',
          transform: `rotate(${this.rotation}deg)`
        }
      }
      const slice = 360 / n
      const parts = this.options.map((_, i) => {
        const color = WHEEL_COLORS[i % WHEEL_COLORS.length]
        const start = i * slice
        const end = (i + 1) * slice
        return `${color} ${start}deg ${end}deg`
      })
      return {
        background: `conic-gradient(${parts.join(', ')})`,
        transform: `rotate(${this.rotation}deg)`,
        transition: this.isSpinning
          ? 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)'
          : 'none'
      }
    }
  },
  onShow() {
    this.loadOptions()
  },
  methods: {
    loadOptions() {
      const saved = uni.getStorageSync(STORAGE_KEY)
      if (saved && saved.length > 0) {
        this.options = saved
      } else {
        this.options = [...DEFAULT_OPTIONS]
        this.saveOptions()
      }
    },
    saveOptions() {
      uni.setStorageSync(STORAGE_KEY, this.options)
    },
    getLabelStyle(index) {
      const n = this.options.length
      if (n === 0) return {}
      const slice = 360 / n
      const angle = index * slice + slice / 2
      return {
        transform: `rotate(${angle}deg) translateY(-170rpx)`
      }
    },
    addOption() {
      const text = this.newOption.trim()
      if (!text) {
        uni.showToast({ title: '请输入选项内容', icon: 'none' })
        return
      }
      if (this.options.includes(text)) {
        uni.showToast({ title: '该选项已存在', icon: 'none' })
        return
      }
      this.options.push(text)
      this.newOption = ''
      this.saveOptions()
      uni.showToast({ title: '添加成功', icon: 'success' })
    },
    removeOption(index) {
      if (this.options.length <= 2) {
        uni.showToast({ title: '至少保留 2 个选项', icon: 'none' })
        return
      }
      uni.showModal({
        title: '确认删除',
        content: `确定删除「${this.options[index]}」吗？`,
        success: (res) => {
          if (res.confirm) {
            const removed = this.options[index]
            this.options.splice(index, 1)
            if (this.result === removed) this.result = ''
            this.saveOptions()
          }
        }
      })
    },
    startEdit(index) {
      if (this.isSpinning) return
      this.editingIndex = index
      this.editingText = this.options[index]
    },
    saveEdit(index) {
      const text = this.editingText.trim()
      if (!text) {
        uni.showToast({ title: '选项不能为空', icon: 'none' })
        this.editingText = this.options[index]
        this.editingIndex = -1
        return
      }
      const duplicate = this.options.findIndex((item, i) => i !== index && item === text)
      if (duplicate !== -1) {
        uni.showToast({ title: '该选项已存在', icon: 'none' })
        return
      }
      this.options[index] = text
      this.editingIndex = -1
      this.saveOptions()
    },
    spin() {
      if (!this.canSpin) return

      const n = this.options.length
      const slice = 360 / n
      const idx = Math.floor(Math.random() * n)

      const extraSpins = 5 + Math.floor(Math.random() * 3)
      const targetOffset = 360 - (idx * slice + slice / 2)
      const currentMod = ((this.rotation % 360) + 360) % 360
      const delta = extraSpins * 360 + targetOffset - currentMod

      this.isSpinning = true
      this.result = ''
      this.rotation += delta

      setTimeout(() => {
        this.isSpinning = false
        this.result = this.options[idx]
        uni.vibrateShort()
      }, 4000)
    }
  }
}
</script>

<style>
.page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: linear-gradient(180deg, #f0f5ff 0%, #f5f5f5 40%);
}

/* 转盘区域 */
.wheel-section {
  flex-shrink: 0;
  padding: 30rpx 30rpx 20rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.section-header {
  text-align: center;
  margin-bottom: 30rpx;
}

.section-title {
  display: block;
  font-size: 40rpx;
  font-weight: bold;
  color: #333;
}

.section-sub {
  display: block;
  font-size: 24rpx;
  color: #999;
  margin-top: 8rpx;
}

.wheel-wrapper {
  position: relative;
  width: 520rpx;
  height: 520rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pointer {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  width: 0;
  height: 0;
  border-left: 20rpx solid transparent;
  border-right: 20rpx solid transparent;
  border-top: 44rpx solid #ff4d4f;
  filter: drop-shadow(0 4rpx 6rpx rgba(0, 0, 0, 0.2));
}

.wheel {
  width: 480rpx;
  height: 480rpx;
  border-radius: 50%;
  position: relative;
  box-shadow: 0 8rpx 30rpx rgba(22, 119, 255, 0.25),
              inset 0 0 0 6rpx #fff;
}

.wheel-label {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  display: flex;
  justify-content: center;
}

.wheel-label-text {
  font-size: 22rpx;
  color: #fff;
  font-weight: bold;
  text-shadow: 0 1rpx 4rpx rgba(0, 0, 0, 0.3);
  white-space: nowrap;
  max-width: 120rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
  transform: translateX(-50%);
}

.wheel-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 100rpx;
  height: 100rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #fff 0%, #f0f0f0 100%);
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 5;
}

.wheel-center-text {
  font-size: 28rpx;
  font-weight: bold;
  color: #1677ff;
}

.result-card {
  margin-top: 30rpx;
  padding: 24rpx 60rpx;
  background: #fff;
  border-radius: 16rpx;
  box-shadow: 0 4rpx 20rpx rgba(22, 119, 255, 0.12);
  text-align: center;
  opacity: 0;
  transform: translateY(10rpx);
  transition: all 0.4s ease;
}

.result-card.show {
  opacity: 1;
  transform: translateY(0);
}

.result-label {
  display: block;
  font-size: 24rpx;
  color: #999;
  margin-bottom: 8rpx;
}

.result-text {
  display: block;
  font-size: 40rpx;
  font-weight: bold;
  color: #1677ff;
}

.spin-btn {
  margin-top: 30rpx;
  width: 400rpx;
  height: 88rpx;
  line-height: 88rpx;
  background: linear-gradient(135deg, #1677ff 0%, #4096ff 100%);
  color: #fff;
  font-size: 32rpx;
  font-weight: bold;
  border-radius: 44rpx;
  border: none;
  box-shadow: 0 8rpx 24rpx rgba(22, 119, 255, 0.35);
}

.spin-btn.disabled {
  background: #d9d9d9;
  box-shadow: none;
  color: #999;
}

/* 选项管理 */
.options-section {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  margin: 20rpx 24rpx;
  padding: 30rpx;
  background: #fff;
  border-radius: 20rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.06);
  overflow: hidden;
}

.options-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24rpx;
}

.options-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
}

.options-count {
  font-size: 24rpx;
  color: #1677ff;
  background: #e6f4ff;
  padding: 6rpx 16rpx;
  border-radius: 20rpx;
}

.add-bar {
  display: flex;
  gap: 16rpx;
  margin-bottom: 24rpx;
}

.add-input {
  flex: 1;
  height: 72rpx;
  padding: 0 24rpx;
  background: #f5f5f5;
  border-radius: 12rpx;
  font-size: 28rpx;
  color: #333;
}

.add-btn {
  width: 140rpx;
  height: 72rpx;
  line-height: 72rpx;
  background: #1677ff;
  color: #fff;
  font-size: 28rpx;
  border-radius: 12rpx;
  border: none;
  padding: 0;
}

.options-list {
  flex: 1;
  min-height: 0;
}

.option-item {
  display: flex;
  align-items: center;
  padding: 20rpx 16rpx;
  border-bottom: 1rpx solid #f0f0f0;
  gap: 16rpx;
}

.option-item:last-child {
  border-bottom: none;
}

.option-index {
  width: 44rpx;
  height: 44rpx;
  line-height: 44rpx;
  text-align: center;
  background: #e6f4ff;
  color: #1677ff;
  font-size: 24rpx;
  font-weight: bold;
  border-radius: 50%;
  flex-shrink: 0;
}

.option-text {
  flex: 1;
  font-size: 28rpx;
  color: #333;
  padding: 8rpx 0;
}

.option-edit-input {
  flex: 1;
  height: 60rpx;
  padding: 0 16rpx;
  background: #f0f7ff;
  border: 2rpx solid #1677ff;
  border-radius: 8rpx;
  font-size: 28rpx;
  color: #333;
}

.delete-btn {
  width: 52rpx;
  height: 52rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff1f0;
  border-radius: 50%;
  flex-shrink: 0;
}

.delete-btn.disabled {
  background: #f5f5f5;
}

.delete-icon {
  font-size: 36rpx;
  color: #ff4d4f;
  line-height: 1;
}

.delete-btn.disabled .delete-icon {
  color: #d9d9d9;
}

.empty-options {
  text-align: center;
  padding: 60rpx 0;
  color: #999;
  font-size: 28rpx;
}

.options-tip {
  display: block;
  margin-top: 20rpx;
  font-size: 22rpx;
  color: #bbb;
  text-align: center;
}
</style>
