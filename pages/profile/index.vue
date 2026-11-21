<template>
    <view class="profile-page">
        <!-- 头像可预览，实际上传和资料更新统一在保存时执行。 -->
        <view class="avatar-section" @click="chooseAvatar">
            <view class="avatar-ring">
                <image v-if="avatarPreview" :src="avatarPreview" mode="aspectFit" class="avatar-image" />
                <text v-else class="avatar-fallback">{{ avatarText }}</text>
                <view class="camera-badge">
                    <up-icon name="camera" color="#ffffff" size="17"></up-icon>
                </view>
            </view>
            <text class="avatar-tip">点击更换头像</text>
        </view>

        <!-- 资料表单参考设计稿采用暖色卡片，并提供明确的输入边界提示。 -->
        <view class="form-card">
            <view class="field-group">
                <text class="field-label">昵称</text>
                <input v-model="form.username" class="field-input" maxlength="20" placeholder="请输入 2-20 个字符" />
            </view>
            <view class="field-divider"></view>
            <view class="field-group signature-field">
                <text class="field-label">个性签名</text>
                <textarea
                    v-model="form.signature"
                    class="signature-input"
                    maxlength="30"
                    auto-height
                    placeholder="写一句想对今天说的话"
                />
                <text class="length-tip">{{ signatureLength }}/30</text>
            </view>
        </view>

        <!-- 保存按钮包含提交中状态，防止重复写入。 -->
        <button class="save-button" :disabled="saving" @click="saveProfile">
            {{ saving ? '保存中...' : '保存' }}
        </button>
        <text class="privacy-tip">资料仅用于你的个人展示</text>
    </view>
</template>

<script>
import {
    loadCurrentUser,
    uploadAvatarToCloud,
    deleteAvatarFile,
    updateUserProfile
} from '@/utils/cloud.js'

export default {
    data() {
        return {
            form: { username: '', signature: '' },
            currentUser: null,
            avatarPreview: '',
            pendingAvatarPath: '',
            saving: false
        }
    },
    computed: {
        avatarText() {
            return (this.form.username || '?').slice(0, 1)
        },
        signatureLength() {
            return this.form.signature.length
        }
    },
    async onLoad() {
        await this.loadProfile()
    },
    methods: {
        async loadProfile() {
            try {
                const user = await loadCurrentUser()
                if (!user) {
                    uni.showToast({ title: '请先登录', icon: 'none' })
                    setTimeout(() => uni.navigateBack(), 600)
                    return
                }
                this.currentUser = user
                this.form.username = user.username || ''
                this.form.signature = user.signature || ''
                this.avatarPreview = user.avatar || ''
            } catch (error) {
                uni.showToast({ title: error.message || '资料加载失败', icon: 'none' })
            }
        },
        chooseAvatar() {
            uni.chooseImage({
                count: 1,
                sourceType: ['album'],
                success: ({ tempFilePaths }) => {
                    this.pendingAvatarPath = tempFilePaths[0]
                    this.avatarPreview = tempFilePaths[0]
                }
            })
        },
        async saveProfile() {
            if (this.saving) return
            const username = this.form.username.trim()
            if (username.length < 2 || username.length > 20) {
                uni.showToast({ title: '昵称需为 2-20 个字符', icon: 'none' })
                return
            }
            this.saving = true
            let uploadedAvatar = ''
            try {
                uploadedAvatar = this.pendingAvatarPath
                    ? await uploadAvatarToCloud(this.pendingAvatarPath)
                    : (this.currentUser.avatar || '')
                const updatedUser = await updateUserProfile({
                    username,
                    signature: this.form.signature,
                    avatar: uploadedAvatar
                })
                if (this.pendingAvatarPath) {
                    await deleteAvatarFile(this.currentUser.avatar || '')
                }
                this.currentUser = updatedUser
                this.avatarPreview = updatedUser.avatar
                this.pendingAvatarPath = ''
                uni.showToast({ title: '资料已保存', icon: 'success' })
                setTimeout(() => uni.navigateBack(), 500)
            } catch (error) {
                // 新头像若未能写入资料则回收，避免云存储留下孤立文件。
                if (this.pendingAvatarPath && uploadedAvatar) {
                    await deleteAvatarFile(uploadedAvatar)
                }
                uni.showToast({ title: error.message || '保存失败，请重试', icon: 'none' })
            } finally {
                this.saving = false
            }
        }
    }
}
</script>

<style lang="scss" scoped>
.profile-page {
    min-height: 100vh;
    box-sizing: border-box;
    padding: 52rpx $q-space-4 calc(48rpx + env(safe-area-inset-bottom));
    background: radial-gradient(circle at 15% 8%, #ffe0d4 0, transparent 32%),
        linear-gradient(180deg, $q-color-cream 0, #fff9f2 100%);

    .avatar-section {
        display: flex;
        flex-direction: column;
        align-items: center;

        .avatar-ring {
            position: relative;
            width: 176rpx;
            height: 176rpx;
            border: 7rpx solid #f6a24b;
            border-radius: 50%;
            background: #fff;
            box-shadow: 0 10rpx 24rpx rgba(196, 95, 62, .18);
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: visible;

            .avatar-image { width: 100%; height: 100%; border-radius: 50%; }
            .avatar-fallback { font-size: 68rpx; font-weight: 700; color: $q-color-primary; }
            .camera-badge {
                position: absolute;
                right: -4rpx;
                bottom: 6rpx;
                width: 50rpx;
                height: 50rpx;
                border: 5rpx solid #fff;
                border-radius: 50%;
                background: $q-color-primary;
                display: flex;
                align-items: center;
                justify-content: center;
            }
        }

        .avatar-tip { margin-top: $q-space-2; font-size: $q-font-size-small; color: $q-color-text-muted; }
    }

    .form-card {
        margin-top: 44rpx;
        padding: 8rpx $q-space-4;
        border: 2rpx solid rgba(255, 152, 112, .28);
        border-radius: $q-radius-lg;
        background: rgba(255, 255, 255, .88);
        box-shadow: $q-shadow-soft;

        .field-group {
            position: relative;
            padding: 24rpx 0;

            .field-label { display: block; margin-bottom: 12rpx; font-size: $q-font-size-small; font-weight: 700; color: #a4483f; }
            .field-input { height: 56rpx; font-size: $q-font-size-medium; color: $q-color-text; }
            .signature-input { width: 100%; min-height: 96rpx; padding-right: 72rpx; box-sizing: border-box; font-size: $q-font-size-medium; color: $q-color-text; line-height: 1.55; }
            .length-tip { position: absolute; right: 0; bottom: 22rpx; font-size: 23rpx; color: $q-color-text-muted; }
        }

        .field-divider { height: 1rpx; background: #f1ded5; }
    }

    .save-button {
        height: 92rpx;
        margin-top: 32rpx;
        border: 3rpx solid rgba(255, 154, 53, .7);
        border-radius: 46rpx;
        background: linear-gradient(180deg, #fff0a8 0, #ffd466 100%);
        box-shadow: 0 9rpx 18rpx rgba(226, 149, 46, .22);
        color: $q-color-text;
        font-size: $q-font-size-medium;
        font-weight: 700;

        &::after { border: none; }
        &:active { transform: scale(.985); }
        &[disabled] { opacity: .65; }
    }

    .privacy-tip { display: block; margin-top: $q-space-2; text-align: center; font-size: 22rpx; color: $q-color-text-muted; }
}
</style>
