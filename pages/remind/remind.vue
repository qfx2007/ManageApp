<template>
    <view class="page">
        <view class="header-card">
            <view class="header-title">好友心情</view>
            <view class="header-desc">暗中查看好友的历史心情周报</view>
        </view>

        <view v-if="boundFriend" class="friend-card">
            <view class="friend-info">
                <text class="friend-label">当前关注</text>
                <text class="friend-name">{{ boundFriend }}</text>
            </view>
            <view class="friend-actions">
                <button class="action-btn refresh" :loading="loading" @click="loadFriendData">刷新</button>
                <button class="action-btn unlink" @click="unbindFriend">取消关注</button>
            </view>
        </view>

        <view v-else class="empty-card">
            <text class="empty-text">尚未绑定好友</text>
            <button class="primary-btn" @click="openBindPopup">绑定好友用户名</button>
        </view>

        <view class="history-section">
            <view class="section-title">
                {{ boundFriend ? `「${boundFriend}」的历史周报` : '历史周报' }}
            </view>
            <scroll-view scroll-y class="scroll-view">
                <view class="record-list">
                    <view
                        class="record-item"
                        v-for="(week, index) in friendHistory"
                        :key="index"
                    >
                        <view class="record-info">
                            <view class="record-week">{{ week.weekLabel }}</view>
                            <view class="record-date-range">{{ week.dateRange }}</view>
                        </view>
                        <view class="record-mood" :class="getMoodClass(week.finalMood)">
                            {{ week.finalMood }}
                        </view>
                    </view>
                    <view v-if="friendHistory.length === 0" class="empty-tip">
                        {{ boundFriend ? '好友暂无周报数据' : '绑定好友后可查看对方周报' }}
                    </view>
                </view>
            </scroll-view>
        </view>

        <!-- 首次进入：是否暗中查看好友 -->
        <view class="popup-mask" v-if="showAskPopup" @click.stop>
            <view class="popup-content" @click.stop>
                <view class="popup-title">是否需要暗中查看好友？</view>
                <view class="popup-desc">输入好友注册时的用户名，即可查看对方的心情历史周报</view>
                <view class="popup-actions">
                    <button class="popup-btn cancel" @click="declineFriend">暂不需要</button>
                    <button class="popup-btn confirm" @click="acceptFriend">需要</button>
                </view>
            </view>
        </view>

        <!-- 输入好友用户名 -->
        <view class="popup-mask" v-if="showBindPopup" @click="closeBindPopup">
            <view class="popup-content" @click.stop>
                <view class="popup-title">输入好友用户名</view>
                <input
                    class="friend-input"
                    v-model="friendUsername"
                    placeholder="请输入好友的用户名"
                    maxlength="20"
                    confirm-type="done"
                    @confirm="bindFriend"
                />
                <view class="popup-actions">
                    <button class="popup-btn cancel" @click="closeBindPopup">取消</button>
                    <button class="popup-btn confirm" :loading="loading" @click="bindFriend">确认</button>
                </view>
            </view>
        </view>
    </view>
</template>

<script>
import {
    isCloudAvailable,
    getCloudEnvId,
    initCloud,
    loadCurrentUser,
    fetchFriendMood
} from '@/utils/cloud.js'

const BOUND_FRIEND_KEY = 'boundFriendUsername'
const FRIEND_POPUP_DISMISSED_KEY = 'friendPopupDismissed'

export default {
    data() {
        return {
            boundFriend: '',
            friendHistory: [],
            friendUsername: '',
            loading: false,
            showAskPopup: false,
            showBindPopup: false,
            currentUser: null
        }
    },
    onShow() {
        this.initPage()
    },
    methods: {
        async initPage() {
            this.boundFriend = uni.getStorageSync(BOUND_FRIEND_KEY) || ''
            const dismissed = uni.getStorageSync(FRIEND_POPUP_DISMISSED_KEY)

            try {
                this.currentUser = await loadCurrentUser()
            } catch (e) {
                this.currentUser = uni.getStorageSync('currentUser') || null
            }

            if (this.boundFriend) {
                await this.loadFriendData(false)
                return
            }

            if (!dismissed) {
                this.showAskPopup = true
            }
        },
        ensureCloudReady() {
            if (!isCloudAvailable()) {
                uni.showToast({ title: '请在微信小程序中使用', icon: 'none' })
                return false
            }
            if (!getCloudEnvId()) {
                uni.showToast({ title: '请先配置云开发环境 ID', icon: 'none' })
                return false
            }
            if (!this.currentUser) {
                uni.showModal({
                    title: '请先注册',
                    content: '请先在「我的」页面注册唯一用户名',
                    confirmText: '去注册',
                    success: (res) => {
                        if (res.confirm) {
                            uni.switchTab({ url: '/pages/mine/mine' })
                        }
                    }
                })
                return false
            }
            return true
        },
        declineFriend() {
            this.showAskPopup = false
            uni.setStorageSync(FRIEND_POPUP_DISMISSED_KEY, true)
        },
        acceptFriend() {
            this.showAskPopup = false
            uni.setStorageSync(FRIEND_POPUP_DISMISSED_KEY, true)
            if (!this.ensureCloudReady()) return
            this.showBindPopup = true
        },
        openBindPopup() {
            if (!this.ensureCloudReady()) return
            this.friendUsername = ''
            this.showBindPopup = true
        },
        closeBindPopup() {
            this.showBindPopup = false
        },
        async bindFriend() {
            if (!this.ensureCloudReady()) return
            if (!this.currentUser) {
                uni.showToast({ title: '请先登录', icon: 'none' })
                return
            }

            const name = this.friendUsername.trim()
            if (!name) {
                uni.showToast({ title: '请输入好友用户名', icon: 'none' })
                return
            }

            this.loading = true
            try {
                await initCloud()
                const friend = await fetchFriendMood(name)
                uni.setStorageSync(BOUND_FRIEND_KEY, friend.username)
                this.boundFriend = friend.username
                this.friendHistory = friend.weeklyHistory || []
                this.showBindPopup = false
                uni.showToast({ title: '绑定成功', icon: 'success' })
            } catch (e) {
                uni.showToast({ title: e.message || '绑定失败', icon: 'none' })
            } finally {
                this.loading = false
            }
        },
        async loadFriendData(showToast = true) {
            if (!this.boundFriend || !this.ensureCloudReady()) return

            this.loading = true
            try {
                await initCloud()
                const friend = await fetchFriendMood(this.boundFriend)
                this.friendHistory = friend.weeklyHistory || []
                if (showToast) {
                    uni.showToast({ title: '已刷新', icon: 'success' })
                }
            } catch (e) {
                if (showToast) {
                    uni.showToast({ title: e.message || '加载失败', icon: 'none' })
                }
            } finally {
                this.loading = false
            }
        },
        unbindFriend() {
            uni.showModal({
                title: '取消关注',
                content: `确定不再关注「${this.boundFriend}」吗？`,
                success: (res) => {
                    if (res.confirm) {
                        uni.removeStorageSync(BOUND_FRIEND_KEY)
                        this.boundFriend = ''
                        this.friendHistory = []
                        uni.showToast({ title: '已取消关注', icon: 'none' })
                    }
                }
            })
        },
        getMoodClass(mood) {
            if (mood === '很开心') return 'mood-happy'
            if (mood === '不高兴') return 'mood-sad'
            return 'mood-normal'
        }
    }
}
</script>

<style lang="scss" scoped>
.page {
    min-height: 100vh;
    padding: 24rpx;
    box-sizing: border-box;
}

.header-card,
.friend-card,
.empty-card,
.history-section {
    background: #fff;
    border-radius: 20rpx;
    padding: 30rpx;
    margin-bottom: 24rpx;
    box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.05);
}

.header-title,
.section-title {
    font-size: 32rpx;
    font-weight: bold;
    color: #333;
}

.header-desc {
    font-size: 24rpx;
    color: #999;
    margin-top: 8rpx;
}

.friend-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 20rpx;
}

.friend-info {
    display: flex;
    flex-direction: column;
    gap: 8rpx;
}

.friend-label {
    font-size: 24rpx;
    color: #999;
}

.friend-name {
    font-size: 34rpx;
    font-weight: bold;
    color: #1677ff;
}

.friend-actions {
    display: flex;
    gap: 12rpx;
}

.action-btn {
    font-size: 24rpx;
    padding: 0 24rpx;
    height: 60rpx;
    line-height: 60rpx;
    border-radius: 30rpx;
    border: none;
}

.action-btn.refresh {
    background: #e6f4ff;
    color: #1677ff;
}

.action-btn.unlink {
    background: #fff1f0;
    color: #ff4d4f;
}

.empty-card {
    text-align: center;
}

.empty-text {
    display: block;
    font-size: 28rpx;
    color: #999;
    margin-bottom: 24rpx;
}

.primary-btn {
    background: linear-gradient(135deg, #1677ff, #4096ff);
    color: #fff;
    border: none;
    border-radius: 40rpx;
    font-size: 28rpx;
}

.history-section {
    padding-bottom: 20rpx;
}

.scroll-view {
    height: 700rpx;
    margin-top: 20rpx;
}

.record-list {
    display: flex;
    flex-direction: column;
}

.record-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20rpx 0;
    border-bottom: 1rpx solid #f0f0f0;
}

.record-info {
    display: flex;
    flex-direction: column;
}

.record-week {
    font-size: 30rpx;
    font-weight: bold;
    color: #333;
}

.record-date-range {
    font-size: 24rpx;
    color: #999;
    margin-top: 5rpx;
}

.record-mood {
    font-weight: bold;
    font-size: 28rpx;
    padding: 5rpx 15rpx;
    border-radius: 20rpx;
    color: #fff;
}

.mood-happy { background-color: #FFD700; }
.mood-sad { background-color: #87CEEB; }
.mood-normal { background-color: #A9A9A9; }

.empty-tip {
    text-align: center;
    color: #999;
    font-size: 28rpx;
    padding: 60rpx 0;
}

.popup-mask {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
}

.popup-content {
    width: 80%;
    background: #fff;
    border-radius: 20rpx;
    padding: 40rpx 30rpx;
}

.popup-title {
    font-size: 34rpx;
    font-weight: bold;
    color: #333;
    text-align: center;
    margin-bottom: 16rpx;
}

.popup-desc {
    font-size: 26rpx;
    color: #666;
    text-align: center;
    line-height: 1.6;
    margin-bottom: 30rpx;
}

.friend-input {
    height: 80rpx;
    background: #f5f5f5;
    border-radius: 12rpx;
    padding: 0 24rpx;
    font-size: 28rpx;
    margin-bottom: 30rpx;
}

.popup-actions {
    display: flex;
    gap: 20rpx;
}

.popup-btn {
    flex: 1;
    height: 80rpx;
    line-height: 80rpx;
    border-radius: 40rpx;
    font-size: 28rpx;
    border: none;
}

.popup-btn.cancel {
    background: #f5f5f5;
    color: #666;
}

.popup-btn.confirm {
    background: #1677ff;
    color: #fff;
}
</style>
