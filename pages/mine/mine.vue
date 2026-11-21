<template>
    <view class="page">
        <!-- 蓝色头部区域 -->
        <view class="header">
            <view class="avatar-wrap" @click="chooseAvatar">
                <image
                    v-if="avatarSrc"
                    :src="avatarSrc"
                    mode="aspectFill"
                    class="avatar-img"
                />
                <text v-else class="avatar-text">{{ avatarText }}</text>
                <view class="avatar-edit">
                    <text class="edit-icon">+</text>
                </view>
            </view>
            <text class="username">{{ currentUser ? currentUser.username : '未登录' }}</text>
            <text class="user-desc">{{ currentUser ? '点击头像可更换' : '登录后可同步数据' }}</text>
        </view>

        <!-- 功能列表 -->
        <view class="menu-list">
            <view class="menu-item" @click="goToRotate">
                <uni-icons type="gear" size="30" class="list-icons"></uni-icons>
                <text class="menu-label"> 转转盘</text>
                <up-icon name="arrow-right" color="#c8c9cc" size="16"></up-icon>
            </view>
            <view class="menu-item" @click="handleLoginOrLogout">
                <up-icon name="account" color="#333333" size="30" class="list-icons"></up-icon>
                <text class="menu-label">{{ currentUser ? '退出登录' : '登录/注册' }}</text>
                <up-icon name="arrow-right" color="#c8c9cc" size="16"></up-icon>
            </view>
        </view>

        <!-- 登录弹框 -->
        <view v-if="showLoginPopup" class="popup-mask" @click="closeLoginPopup">
            <view class="popup-content" @click.stop>
                <view class="popup-title">登录/注册</view>
                <view class="popup-option" @click="goToRegister">
                    <text class="option-label">没有账号？去注册</text>
                    <text class="option-arrow">›</text>
                </view>
                <view class="popup-divider"></view>
                <view class="popup-option" @click="goToLogin">
                    <text class="option-label">我已注册，去登录</text>
                    <text class="option-arrow">›</text>
                </view>
                <view class="popup-cancel" @click="closeLoginPopup">
                    <text>取消</text>
                </view>
            </view>
        </view>

        <!-- 注册/登录弹框 -->
        <view v-if="showRegisterPopup" class="popup-mask" @click="closeRegisterPopup">
            <view class="popup-content" @click.stop>
                <view class="popup-title">{{ isRegisterMode ? '注册' : '登录' }}</view>
                <input
                    class="popup-input"
                    v-model="inputUsername"
                    placeholder="请输入用户名（2-20字符）"
                    maxlength="20"
                    confirm-type="done"
                    @confirm="handleSubmit"
                />
                <view class="popup-actions">
                    <view class="popup-btn cancel" @click="closeRegisterPopup">取消</view>
                    <view class="popup-btn confirm" :loading="loading" @click="handleSubmit">
                        {{ isRegisterMode ? '注册' : '登录' }}
                    </view>
                </view>
            </view>
        </view>

        <!-- 退出登录确认弹框 -->
        <view v-if="showLogoutPopup" class="popup-mask" @click="closeLogoutPopup">
            <view class="popup-content" @click.stop>
                <view class="popup-title">退出登录</view>
                <view class="popup-desc">确定要退出当前账号吗？</view>
                <view class="popup-actions">
                    <view class="popup-btn cancel" @click="closeLogoutPopup">取消</view>
                    <view class="popup-btn confirm" @click="confirmLogout">确定</view>
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
    registerUser,
    loginUser,
    loadCurrentUser,
    uploadAvatarToCloud,
    saveAvatarToCloud,
    deleteAvatarFile
} from '@/utils/cloud.js'

export default {
    data() {
        return {
            currentUser: null,
            avatarSrc: '',
            inputUsername: '',
            loading: false,
            showLoginPopup: false,
            showRegisterPopup: false,
            showLogoutPopup: false,
            isRegisterMode: true
        }
    },
    computed: {
        avatarText() {
            if (!this.currentUser || !this.currentUser.username) return '?'
            return this.currentUser.username.slice(0, 1)
        }
    },
    onShow() {
        this.refreshUser()
    },
    methods: {
        chooseAvatar() {
            if (!this.currentUser) {
                this.showLoginPopup = true
                return
            }
            uni.chooseImage({
                count: 1,
                sourceType: ['album'],
                success: async (res) => {
                    const tempPath = res.tempFilePaths[0]
                    try {
                        uni.showLoading({ title: '上传中...' })
                        const oldFileId = (this.currentUser && this.currentUser.avatar) || ''
                        const fileId = await uploadAvatarToCloud(tempPath)
                        if (!fileId) {
                            throw new Error('上传失败')
                        }
                        await saveAvatarToCloud(fileId)
                        await deleteAvatarFile(oldFileId)
                        this.avatarSrc = fileId
                        if (this.currentUser) {
                            this.currentUser.avatar = fileId
                            uni.setStorageSync('currentUser', this.currentUser)
                        }
                        uni.showToast({ title: '头像已更新', icon: 'success' })
                    } catch (e) {
                        uni.showToast({ title: e.message || '上传失败', icon: 'none' })
                    } finally {
                        uni.hideLoading()
                    }
                }
            })
        },
        async refreshUser() {
            try {
                this.currentUser = await loadCurrentUser()
                this.avatarSrc = (this.currentUser && this.currentUser.avatar) || ''
            } catch (e) {
                this.currentUser = uni.getStorageSync('currentUser') || null
                this.avatarSrc = (this.currentUser && this.currentUser.avatar) || ''
            }
        },
        goToRotate() {
            uni.navigateTo({ url: '/pages/rotate/rotate' })
        },
        handleLoginOrLogout() {
            if (this.currentUser) {
                this.showLogoutPopup = true
            } else {
                this.showLoginPopup = true
            }
        },
        closeLoginPopup() {
            this.showLoginPopup = false
        },
        goToRegister() {
            this.isRegisterMode = true
            this.showLoginPopup = false
            this.showRegisterPopup = true
        },
        goToLogin() {
            this.isRegisterMode = false
            this.showLoginPopup = false
            this.showRegisterPopup = true
        },
        closeRegisterPopup() {
            this.showRegisterPopup = false
            this.inputUsername = ''
        },
        async handleSubmit() {
            if (!this.inputUsername.trim()) {
                uni.showToast({ title: '请输入用户名', icon: 'none' })
                return
            }
            this.loading = true
            try {
                await initCloud()
                uni.removeStorageSync('isLoggedOut')
                if (this.isRegisterMode) {
                    const user = await registerUser(this.inputUsername)
                    this.currentUser = user
                    this.avatarSrc = ''
                    this.inputUsername = ''
                    this.closeRegisterPopup()
                    uni.showToast({ title: '注册成功', icon: 'success' })
                } else {
                    const user = await loginUser(this.inputUsername)
                    if (user) {
                        this.currentUser = user
                        this.avatarSrc = user.avatar || ''
                        this.closeRegisterPopup()
                        uni.showToast({ title: '登录成功', icon: 'success' })
                    } else {
                        uni.showToast({ title: '未找到该昵称，请输入正确的昵称', icon: 'none' })
                    }
                }
            } catch (e) {
                uni.showToast({ title: e.message || '操作失败', icon: 'none' })
            } finally {
                this.loading = false
            }
        },
        closeLogoutPopup() {
            this.showLogoutPopup = false
        },
        confirmLogout() {
            uni.removeStorageSync('currentUser')
            uni.removeStorageSync('cloudUserId')
            uni.removeStorageSync('lastMoodSyncTime')
            uni.setStorageSync('isLoggedOut', true)
            this.currentUser = null
            this.avatarSrc = ''
            this.showLogoutPopup = false
            uni.showToast({ title: '已退出登录', icon: 'success' })
        }
    }
}
</script>

<style lang="scss" scoped>
.page {
    min-height: 100vh;
    background: #f5f5f5;
}

.header {
    background: linear-gradient(135deg, #1677ff, #69b1ff);
    padding: 80rpx 0 60rpx;
    display: flex;
    flex-direction: column;
    align-items: center;
}

.avatar-wrap {
    width: 160rpx;
    height: 160rpx;
    border-radius: 50%;
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
    margin-bottom: 24rpx;
}

.avatar-img {
    width: 100%;
    height: 100%;
}

.avatar-text {
    font-size: 64rpx;
    color: #1677ff;
    font-weight: bold;
}

.avatar-edit {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background: rgba(0, 0, 0, 0.5);
    padding: 8rpx 0;
    display: flex;
    justify-content: center;
}

.edit-icon {
    font-size: 28rpx;
    color: #fff;
}

.username {
    font-size: 36rpx;
    font-weight: bold;
    color: #fff;
    margin-bottom: 8rpx;
}

.user-desc {
    font-size: 24rpx;
    color: rgba(255, 255, 255, 0.8);
}

.menu-list {
    background: #fff;
    margin-top: 24rpx;
	.list-icons{
		margin-right: 8rpx;
	}
}

.menu-item {
    display: flex;
    align-items: center;
    padding: 30rpx 32rpx;
    border-bottom: 1rpx solid #f0f0f0;
}

.menu-item:last-child {
    border-bottom: none;
}

.menu-icon {
    font-size: 40rpx;
    margin-right: 24rpx;
}

.menu-label {
    flex: 1;
    font-size: 30rpx;
    color: #333;
}

.menu-arrow {
    font-size: 36rpx;
    color: #ccc;
}

.popup-mask {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 999;
}

.popup-content {
    width: 600rpx;
    background: #fff;
    border-radius: 20rpx;
    overflow: hidden;
}

.popup-title {
    font-size: 32rpx;
    font-weight: bold;
    color: #333;
    padding: 32rpx;
    text-align: center;
    border-bottom: 1rpx solid #f0f0f0;
}

.popup-option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 30rpx 32rpx;
}

.popup-option:active {
    background: #f5f5f5;
}

.option-label {
    font-size: 30rpx;
    color: #333;
}

.option-arrow {
    font-size: 36rpx;
    color: #ccc;
}

.popup-divider {
    height: 1rpx;
    background: #f0f0f0;
}

.popup-cancel {
    padding: 30rpx;
    text-align: center;
    font-size: 30rpx;
    color: #999;
    border-top: 1rpx solid #f0f0f0;
}

.popup-cancel:active {
    background: #f5f5f5;
}

.popup-desc {
    font-size: 28rpx;
	text-align: center;
	margin-bottom: 20rpx;
    color: #666;
    padding: 24rpx 32rpx 0;
}

.popup-input {
    height: 80rpx;
    background: #f5f5f5;
    border-radius: 12rpx;
    padding: 0 24rpx;
    font-size: 28rpx;
    margin: 24rpx 32rpx;
}

.popup-actions {
    display: flex;
    padding: 0 32rpx 32rpx;
    gap: 24rpx;
}

.popup-btn {
    flex: 1;
    height: 72rpx;
    border-radius: 36rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 30rpx;
}

.popup-btn.cancel {
    background: #f5f5f5;
    color: #666;
}

.popup-btn.confirm {
    background: #1677ff;
    color: #fff;
}

.popup-btn:active {
    opacity: 0.8;
}
</style>
