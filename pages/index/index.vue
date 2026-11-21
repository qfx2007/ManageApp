<template>
    <view class="home-page">
		<!-- 首页静态背景 -->
		<image
			class="home-background"
			src="/static/images/backgrounds/bg-home.jpg"
			mode="widthFix"
		/>
        <view class="hero-card">
            <view class="hero-hit" @click="selectMood"></view>
        </view>

		<!-- 3种心情 -->
        <view class="mood-row">
            <view v-for="item in moodCards" :key="item.mood" class="mood-card" :class="item.className" @click="quickMood(item.mood)">
                <image :src="item.icon" mode="aspectFit" /><text>{{ item.mood }}</text>
            </view>
        </view>

		<!-- 心情分析模块 -->
        <view class="section-head"><text>近7天心情分析</text><text class="muted">今日：{{ todayMoodLabel }}</text></view>
        <view class="chart-card">
            <view class="mood-scale" aria-hidden="true">
                <view class="scale-mark scale-happy"></view>
                <view class="scale-mark scale-neutral"></view>
                <view class="scale-mark scale-sad"></view>
            </view>
            <view class="bars-grid">
                <view v-for="day in chartDays" :key="day.date" class="bar-item">
                    <view class="bar-track"><view class="bar" :class="day.moodClass" :style="{ height: day.height + 'rpx' }"></view></view>
                    <text>{{ day.label }}</text>
                </view>
            </view>
        </view>
        <view class="report-entry" @click="showReportPreview">
			<image src="/static/images/icons/calendar.png" mode="aspectFit" />
			<view>
				<text>年度心情周报</text>
				<text>查看近一年（52周）的心情统计</text>
			</view>
			<up-icon name="arrow-right" color="#ce8b70" size="20" class="arrow" />
		</view>

		<!-- 心情选择弹窗 -->
        <up-popup :show="showPopup" mode="center" @close="closePopup">
            <view class="popup-content" @click.stop>
                <view class="popup-title">选择今日心情</view>
                <view class="mood-options">
                    <up-button
                        v-for="mood in moodOptions"
                        :key="mood"
                        :disabled="savingMood"
                        @click="saveMood(mood)"
                        class="mood-btn"
                    >{{ mood }}</up-button>
                </view>
            </view>
        </up-popup>

        <!-- 登录弹框 -->
        <up-popup :show="showLoginPopup" mode="center" @close="closeLoginPopup">
            <view class="popup-content" @click.stop>
                <view class="popup-title">登录/注册</view>
                <view class="login-option" @click="goToRegister">
                    <text class="option-label">没有账号？去注册</text>
                    <text class="option-arrow">›</text>
                </view>
                <view class="popup-divider"></view>
                <view class="login-option" @click="goToLogin">
                    <text class="option-label">我已注册，去登录</text>
                    <text class="option-arrow">›</text>
                </view>
                <up-button type="default" size="small" @click="closeLoginPopup">取消</up-button>
            </view>
        </up-popup>

        <!-- 注册/登录弹框 -->
        <up-popup :show="showRegisterPopup" mode="center" @close="closeRegisterPopup">
            <view class="popup-content" @click.stop>
                <view class="popup-title">{{ isRegisterMode ? '注册' : '登录' }}</view>
                <up-input
                    class="login-input"
                    v-model="inputUsername"
                    placeholder="请输入用户名（2-20字符）"
                    maxlength="20"
                    confirm-type="done"
                    @confirm="handleLoginSubmit"
                />
                <view class="popup-actions">
                    <up-button type="default" @click="closeRegisterPopup">取消</up-button>
                    <up-button type="primary" :loading="loading" @click="handleLoginSubmit">{{ isRegisterMode ? '注册' : '登录' }}</up-button>
                </view>
            </view>
        </up-popup>
    </view>
</template>

<script setup>
// 首页使用 Composition API 管理心情记录、账户状态和云端同步。
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import {
    saveMoodToCloud,
    fetchMoodData,
    initCloud,
    loadCurrentUser,
    loginUser,
    registerUser
} from '@/utils/cloud.js'
import { beijingDate, shiftDate } from '@/utils/mood'

const moodOptions = ['很开心', '不高兴', '就这样']
const dailyRecords = ref([])
const todayMoodLabel = ref('暂无数据')
const showPopup = ref(false)
const currentUser = ref(null)
const showLoginPopup = ref(false)
const showRegisterPopup = ref(false)
const isRegisterMode = ref(true)
const inputUsername = ref('')
const loading = ref(false)
// 上传期间阻止连点，成功提示以云端确认为准。
const savingMood = ref(false)
// 防止进入页面时较慢的旧请求覆盖刚刚保存的心情。
let moodLoadSequence = 0

const moodCards = computed(() => [
    { mood: '很开心', icon: '/static/images/icons/mood-happy.png', className: 'happy' },
    { mood: '就这样', icon: '/static/images/icons/mood-neutral.png', className: 'neutral' },
    { mood: '不高兴', icon: '/static/images/icons/mood-sad.png', className: 'sad' }
])

const chartDays = computed(() => {
    const result = []
    const moodMeta = {
        // 三种心情使用不同高度，与左侧三色刻度从高到低对应。
        '很开心': { className: 'bar-happy', height: 100 },
        '就这样': { className: 'bar-neutral', height: 64 },
        '不高兴': { className: 'bar-sad', height: 32 }
    }
    for (let offset = 6; offset >= 0; offset -= 1) {
        const dateString = shiftDate(beijingDate(), -offset)
        const record = dailyRecords.value.find((item) => item.date === dateString)
        const meta = record ? moodMeta[record.mood] : null
        result.push({
            date: dateString,
            label: ['日', '一', '二', '三', '四', '五', '六'][new Date(`${dateString}T00:00:00Z`).getUTCDay()],
            height: meta ? meta.height : 12,
            moodClass: meta ? meta.className : 'bar-empty',
        })
    }
    return result
})

// 页面显示时重新读取账户和云端心情数据。
onShow(async () => {
    await refreshUser()
    await initData()
})

function quickMood(mood) {
    if (!currentUser.value) {
        showLoginPopup.value = true
        return
    }
    saveMood(mood)
}

function showReportPreview() {
    uni.navigateTo({ url: '/pages/report/index' })
}

async function refreshUser() {
    try {
        currentUser.value = await loadCurrentUser()
    } catch (error) {
        currentUser.value = uni.getStorageSync('currentUser') || null
    }
}

function closeLoginPopup() {
    showLoginPopup.value = false
}

function goToRegister() {
    isRegisterMode.value = true
    showLoginPopup.value = false
    showRegisterPopup.value = true
}

function goToLogin() {
    isRegisterMode.value = false
    showLoginPopup.value = false
    showRegisterPopup.value = true
}

function closeRegisterPopup() {
    showRegisterPopup.value = false
    inputUsername.value = ''
}

async function handleLoginSubmit() {
    if (!inputUsername.value.trim()) {
        uni.showToast({ title: '请输入用户名', icon: 'none' })
        return
    }
    loading.value = true
    try {
        await initCloud()
        uni.removeStorageSync('isLoggedOut')
        if (isRegisterMode.value) {
            currentUser.value = await registerUser(inputUsername.value)
            closeRegisterPopup()
            await initData()
            uni.showToast({ title: '注册成功', icon: 'success' })
            return
        }
        const user = await loginUser(inputUsername.value)
        if (!user) {
            uni.showToast({ title: '未找到该昵称，请输入正确的昵称', icon: 'none' })
            return
        }
        currentUser.value = user
        closeRegisterPopup()
        await initData()
        uni.showToast({ title: '登录成功', icon: 'success' })
    } catch (error) {
        uni.showToast({ title: error.message || '操作失败', icon: 'none' })
    } finally {
        loading.value = false
    }
}

// 首页仅加载近 7 天；加载失败不伪装成无记录。
async function initData() {
    const sequence = ++moodLoadSequence
    if (!currentUser.value) {
        dailyRecords.value = []
        todayMoodLabel.value = '暂无数据'
        return
    }
    try {
        const data = await fetchMoodData()
        if (sequence !== moodLoadSequence) return
        dailyRecords.value = data.dailyRecords
        todayMoodLabel.value = dailyRecords.value.find(item => item.date === beijingDate())?.mood || '暂无数据'
    } catch (error) {
        if (sequence !== moodLoadSequence) return
        todayMoodLabel.value = '读取失败'
        uni.showToast({ title: '心情读取失败，请重新进入重试', icon: 'none' })
    }
}

function selectMood() {
    if (!currentUser.value) {
        showLoginPopup.value = true
        return
    }
    showPopup.value = true
}

function closePopup() {
    showPopup.value = false
}

// 先等待数据库保存，失败保留原显示及弹窗，允许用户重试。
async function saveMood(mood) {
    if (savingMood.value) return
    savingMood.value = true
    try {
        const date = beijingDate()
        await saveMoodToCloud(date, mood)
        moodLoadSequence += 1
        dailyRecords.value = [{ date, mood }, ...dailyRecords.value.filter(item => item.date !== date)]
        todayMoodLabel.value = mood
        uni.showToast({ title: '今日心情已更新', icon: 'success' })
        closePopup()
    } catch (error) {
        uni.showToast({ title: error.message || '保存失败，请重试', icon: 'none' })
    } finally {
        savingMood.value = false
    }
}
</script>

<style lang="scss" scoped>
.home-page {
    position: relative;
    min-height: 100vh;
    padding: 0 30rpx 40rpx;
    box-sizing: border-box;
    color: #5b302c;
    background-color: #fff;
    font-family: $q-font-family;

    // 首页静态背景：铺满页面宽度并置于内容层之下。
    .home-background {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        z-index: 0;
        pointer-events: none;
    }

    .hero-card {
        position: relative;
        z-index: 1;
        height: 450rpx;
        overflow: hidden;
        border-radius: 0;
    }

    .hero-hit {
        position: absolute;
        top: 24%;
        right: 20%;
        bottom: 0;
        left: 20%;
        z-index: 1;
    }

    .mood-row {
        position: relative;
        z-index: 1;
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 30rpx;
        margin: 24rpx 0 30rpx;
    }

    .mood-card {
        display: grid;
        min-height: 180rpx;
        place-items: center;
        align-content: center;
        border-radius: 24rpx;
        font-size: $q-font-size-large;
        font-weight: 600;
        box-shadow: 0 8rpx 18rpx rgba(185, 108, 93, 0.1);
        transition: transform 0.16s ease;

        &:active {
            transform: scale(0.96);
        }

        image {
            width: 90rpx;
            height: 90rpx;
            margin-bottom: 6rpx;
        }

        &.happy {
            background: $q-mood-happy-surface;
        }

        &.neutral {
            background: $q-mood-neutral-surface;
        }

        &.sad {
            background: $q-mood-sad-surface;
        }
    }

    .section-head {
        position: relative;
        z-index: 1;
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin: 70rpx 4rpx 14rpx;
        font-size: $q-font-size-large;
        font-weight: 700;
    }

    .muted {
        color: #aa8078;
        font-size: $q-font-size-small;
        font-weight: 400;
    }

    .chart-card {
        position: relative;
        z-index: 1;
        display: grid;
        grid-template-columns: 18rpx 1fr;
        gap: 16rpx;
        align-items: end;
        height: 200rpx;
        padding: 30rpx 22rpx;
        border-radius: 26rpx;
        background: #fffdfb;
        box-shadow: 0 8rpx 22rpx rgba(185, 108, 93, 0.1);
        box-sizing: border-box;
    }

    .mood-scale {
        display: grid;
        height: 108rpx;
        grid-template-rows: repeat(3, 1fr);
        align-items: center;
    }

    .scale-mark {
        width: 12rpx;
        height: 8rpx;
        border-radius: 4rpx;

        &.scale-happy {
            background: $q-mood-happy;
        }

        &.scale-neutral {
            background: $q-mood-neutral;
        }

        &.scale-sad {
            background: $q-mood-sad;
        }
    }

    .bars-grid {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 8rpx;
        align-items: end;
		font-size: $q-font-size-small;
		font-weight: 600;
    }

    .bar-item {
        display: grid;
        height: 150rpx;
        align-content: end;
        justify-items: center;
        color: #9b716a;
        font-size: 20rpx;
		gap: 8rpx; 
    }

    .bar-track {
        display: flex;
        width: 30rpx;
        height: 108rpx;
        align-items: flex-end;
        overflow: hidden;
        border-radius: 18rpx;
        background: #fff1de;
    }

    .bar {
        width: 100%;
        min-height: 10rpx;
        border-radius: 18rpx;
        transition: height 0.2s ease, background-color 0.2s ease;

        &.bar-happy {
            background: $q-mood-happy;
        }

        &.bar-neutral {
            background: $q-mood-neutral;
        }

        &.bar-sad {
            background: $q-mood-sad;
        }

        &.bar-empty {
            background: $q-mood-empty;
        }
    }
    .report-entry {
        position: relative;
        z-index: 1;
        display: grid;
        grid-template-columns: 68rpx 1fr auto;
        gap: 30rpx;
        align-items: center;
        margin-top: 24rpx;
        padding: 22rpx;
        border-radius: 24rpx;
        background: linear-gradient(100deg, #fff0df, #fffaf4);
        box-shadow: 0 8rpx 18rpx rgba(185, 108, 93, 0.08);

        image {
            width: 68rpx;
            height: 68rpx;
        }

        view {
            min-width: 0;

            text {
                display: block;

                &:first-child {
                    font-size: $q-font-size-large;
                    font-weight: 700;
                }

                &:last-child {
                    margin-top: 12rpx;
                    color: #a27b72;
                    font-size: $q-font-size-small;
                }
            }
        }

        // 年度周报入口使用 uview-plus 的 arrow-right 图标。
        .arrow {
            flex-shrink: 0;
        }
    }

    .popup-content {
        position: relative;
        z-index: 1;
        display: grid;
        width: 560rpx;
        max-width: calc(100vw - 96rpx);
        gap: 24rpx;
        padding: 34rpx 28rpx 24rpx;
        border-radius: 24rpx;
        background-color: #fff;
        box-sizing: border-box;
    }

    .popup-title {
        margin-bottom: 16rpx;
        color: #333;
        font-size: 36rpx;
        font-weight: bold;
        text-align: center;
    }

    .mood-options {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 12rpx;
    }

    .mood-btn {
        width: 100%;
        height: 80rpx;
        padding: 0;
        border: none;
        border-radius: 40rpx;
        color: #fff;
        font-size: 28rpx;

        &:nth-child(1) {
            background-color: $q-mood-happy;
        }

        &:nth-child(2) {
            background-color: $q-mood-sad;
        }

        &:nth-child(3) {
            background-color: $q-mood-neutral;
        }
    }

    .login-option {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        padding: 28rpx 20rpx;
        box-sizing: border-box;

        &:active {
            background: #f5f5f5;
        }
    }

    .option-label {
        color: #333;
        font-size: $q-font-size-medium;
    }

    .option-arrow {
        color: #ccc;
        font-size: 36rpx;
    }

    .popup-divider {
        width: 100%;
        height: 1rpx;
        background: #f0f0f0;
    }

    .login-input {
        width: 100%;
        height: 80rpx;
        margin-bottom: 0;
        padding: 0 24rpx;
        border-radius: 12rpx;
        background: #f5f5f5;
        box-sizing: border-box;
        font-size: 28rpx;
    }

    .popup-actions {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 24rpx;
        width: 100%;
    }
}
</style>
