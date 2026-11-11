<template>
    <view class="container">
        <!-- 轮播图区域 -->
        <swiper
            class="swiper"
            :indicator-dots="true"
            :autoplay="true"
            :interval="3000"
            :duration="1000"
        >
            <swiper-item
                v-for="(item, index) in swiperList"
                :key="index"
                @click="chooseSwiperImage(index)"
            >
                <image v-if="item" :src="item" mode="aspectFill" class="swiper-img"></image>
                <view v-else class="swiper-placeholder-img"></view>
                <view class="swiper-edit-hint">
                    <text class="swiper-edit-text">点击从相册选择</text>
                </view>
            </swiper-item>
        </swiper>

        <!-- 本周心情统计区域 -->
        <view class="weekly-summary">
            <view class="summary-title">本周心情概览</view>
            <view v-if="currentUser" class="summary-content">
                <view class="summary-item" v-for="(item, key) in weeklyStats" :key="key">
                    <text class="label">{{ key }}:</text>
                    <text class="value">{{ item }}次</text>
                </view>
                <view class="final-mood">
                    <text>本周最终心情: {{ weeklyFinalMood }}</text>
                </view>
            </view>
            <view v-else class="empty-tip">暂无数据</view>
        </view>

        <!-- 历史记录 + 底部小人 -->
        <view class="history-section">
            <view class="section-title">历史周报 (近半年)</view>
            <view class="history-body">
                <view class="boy-container" @click="selectMood">
                    <image :src="boyImageSrc" mode="aspectFit" class="boy-img waving-hand"></image>
                </view>
                <scroll-view v-if="currentUser" scroll-y class="scroll-view">
                    <view class="record-list">
                        <view class="record-item" v-for="(week, index) in weeklyHistory" :key="index">
                            <view class="record-info">
                                <view class="record-week">{{ week.weekLabel }}</view>
                                <view class="record-date-range">{{ week.dateRange }}</view>
                            </view>
                            <view class="record-mood" :class="getMoodClass(week.finalMood)">
                                {{ week.finalMood }}
                            </view>
                        </view>
                        <view v-if="weeklyHistory.length === 0" class="empty-tip">暂无周报数据</view>
                    </view>
                </scroll-view>
                <view v-else class="empty-tip">暂无数据</view>
            </view>
        </view>

        <!-- 心情选择弹窗 -->
        <view class="popup-mask" v-if="showPopup" @click="closePopup">
            <view class="popup-content" @click.stop>
                <view class="popup-title">选择今日心情</view>
                <view class="mood-options">
                    <button 
                        v-for="mood in moodOptions" 
                        :key="mood" 
                        @click="saveMood(mood)"
                        class="mood-btn"
                    >
                        {{ mood }}
                    </button>
                </view>
            </view>
        </view>

        <!-- 登录弹框 -->
        <view v-if="showLoginPopup" class="popup-mask" @click="closeLoginPopup">
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
                <view class="login-cancel" @click="closeLoginPopup">
                    <text>取消</text>
                </view>
            </view>
        </view>

        <!-- 注册/登录弹框 -->
        <view v-if="showRegisterPopup" class="popup-mask" @click="closeRegisterPopup">
            <view class="popup-content" @click.stop>
                <view class="popup-title">{{ isRegisterMode ? '注册' : '登录' }}</view>
                <input
                    class="login-input"
                    v-model="inputUsername"
                    placeholder="请输入用户名（2-20字符）"
                    maxlength="20"
                    confirm-type="done"
                    @confirm="handleLoginSubmit"
                />
                <view class="popup-actions">
                    <view class="popup-btn cancel" @click="closeRegisterPopup">取消</view>
                    <view class="popup-btn confirm" :loading="loading" @click="handleLoginSubmit">
                        {{ isRegisterMode ? '注册' : '登录' }}
                    </view>
                </view>
            </view>
        </view>
    </view>
</template>

<script>
import { syncMoodToCloud, fetchMoodData, isCloudAvailable, initCloud, loadCurrentUser, loginUser, registerUser, uploadSwiperToCloud, deleteSwiperFile, saveSwiperImagesToCloud } from '@/utils/cloud.js'

const DEFAULT_SWIPER = ['', '', '']
const SWIPER_STORAGE_KEY = 'moodSwiperImages'

export default {
    data() {
        return {
            swiperList: [...DEFAULT_SWIPER],
            moodOptions: ['很开心', '不高兴', '就这样'],
            dailyRecords: [],
            weeklyHistory: [],
            weeklyStats: {
                '很开心': 0,
                '不高兴': 0,
                '就这样': 0
            },
            weeklyFinalMood: '暂无数据',
            showPopup: false,
            currentUser: null,
            showLoginPopup: false,
            showRegisterPopup: false,
            isRegisterMode: true,
            inputUsername: '',
            loading: false
        }
    },
    computed: {
        boyImageSrc() {
            return '/static/boy.png'
        }
    },
    onShow() {
        this.refreshUser().then(() => {
            this.loadSwiperImages();
            this.initData();
        });
    },
    methods: {
        async refreshUser() {
            try {
                this.currentUser = await loadCurrentUser()
            } catch (e) {
                this.currentUser = uni.getStorageSync('currentUser') || null
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
        async handleLoginSubmit() {
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
                    this.closeRegisterPopup()
                    this.loadSwiperImages()
                    uni.showToast({ title: '注册成功', icon: 'success' })
                } else {
                    const user = await loginUser(this.inputUsername)
                    if (user) {
                        this.currentUser = user
                        this.closeRegisterPopup()
                        this.loadSwiperImages()
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
        loadSwiperImages() {
            if (isCloudAvailable()) {
                this.loadSwiperFromCloud();
            } else {
                const saved = uni.getStorageSync(SWIPER_STORAGE_KEY);
                if (saved && saved.length === 3) {
                    this.swiperList = saved;
                }
            }
        },
        async loadSwiperFromCloud() {
            try {
                if (!this.currentUser) {
                    this.swiperList = [...DEFAULT_SWIPER];
                    return
                }
                await initCloud();
                const user = uni.getStorageSync('currentUser');
                const saved = (user && user.swiperImages && user.swiperImages.length === 3)
                    ? user.swiperImages
                    : uni.getStorageSync(SWIPER_STORAGE_KEY);
                if (saved && saved.length === 3) {
                    this.swiperList = saved;
                    return
                }
            } catch (_) {}
        },
        saveSwiperImages() {
            uni.setStorageSync(SWIPER_STORAGE_KEY, this.swiperList);
        },
        chooseSwiperImage(index) {
            if (!this.currentUser) {
                this.showLoginPopup = true
                return
            }
            uni.chooseImage({
                count: 1,
                sourceType: ['album'],
                success: (res) => {
                    const tempPath = res.tempFilePaths[0];
                    if (isCloudAvailable()) {
                        this.uploadSwiperToCloud(index, tempPath);
                    } else {
                        uni.saveFile({
                            tempFilePath: tempPath,
                            success: (saveRes) => {
                                this.updateSwiperImage(index, saveRes.savedFilePath);
                            },
                            fail: () => {
                                this.updateSwiperImage(index, tempPath);
                            }
                        });
                    }
                }
            });
        },
        async uploadSwiperToCloud(index, tempPath) {
            if (!this.currentUser) {
                uni.showToast({ title: '请先登录后再设置图片', icon: 'none' })
                return
            }
            try {
                uni.showLoading({ title: '上传中...' })
                const oldFileId = this.swiperList[index] || ''
                const fileId = await uploadSwiperToCloud(tempPath, index)
                if (!fileId) {
                    throw new Error('上传失败')
                }
                this.swiperList = this.swiperList.map((item, i) => (i === index ? fileId : item));
                await saveSwiperImagesToCloud(this.swiperList)
                await deleteSwiperFile(oldFileId)
                this.saveSwiperImages();
                uni.showToast({ title: '图片已更新', icon: 'success' })
            } catch (e) {
                uni.showToast({ title: e.message || '上传失败', icon: 'none' })
            } finally {
                uni.hideLoading()
            }
        },
        updateSwiperImage(index, path) {
            this.swiperList = this.swiperList.map((item, i) => (i === index ? path : item));
            this.saveSwiperImages();
            uni.showToast({ title: '图片已更新', icon: 'success' });
        },
        async initData() {
            // 1. 从云端加载每日记录与历史周报
            let daily = [];
            let weekly = null;
            if (isCloudAvailable()) {
                try {
                    const data = await fetchMoodData();
                    if (data) {
                        daily = data.dailyRecords || [];
                        weekly = data.weeklyHistory || null;
                    }
                } catch (_) {}
            }
            this.dailyRecords = daily;

            // 2. 如果云端没有历史周报，则根据每日记录生成一次
            if (!weekly || weekly.length === 0) {
                this.weeklyHistory = [];
                if (daily.length > 0) {
                    this.generateWeeklyHistory();
                }
            } else {
                // 如果有，直接使用云端数据
                this.weeklyHistory = weekly;
            }

            // 3. 无论如何，都重新计算一下“本周”的实时统计
            // 这样可以保证如果用户今天刚记录了心情，顶部的概览能立即更新
            this.calculateWeeklyStats();
        },

        // 计算本周心情统计（仅用于顶部概览，不修改历史周报列表）
        calculateWeeklyStats() {
            const now = new Date();
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(now.getDate() - 7);

            const stats = {
                '很开心': 0,
                '不高兴': 0,
                '就这样': 0
            };

            const currentWeekRecords = this.dailyRecords.filter(record => {
                const recordDate = new Date(record.date);
                return recordDate >= oneWeekAgo && recordDate <= now;
            });

            currentWeekRecords.forEach(record => {
                if (stats[record.mood] !== undefined) {
                    stats[record.mood]++;
                }
            });

            this.weeklyStats = stats;

            if (currentWeekRecords.length === 0) {
                this.weeklyFinalMood = '暂无数据';
            } else {
                let maxCount = -1;
                let finalMood = '';
                for (const mood in stats) {
                    if (stats[mood] > maxCount) {
                        maxCount = stats[mood];
                        finalMood = mood;
                    }
                }
                this.weeklyFinalMood = finalMood;
            }
        },

        // 生成历史周报（仅在本地存储为空时调用一次）
        generateWeeklyHistory() {
            if (this.dailyRecords.length === 0) return;

            const dates = [...new Set(this.dailyRecords.map(r => r.date))].sort((a, b) => new Date(b) - new Date(a));
            
            const newWeeklyHistory = [];
            let tempWeekRecords = [];
            // 初始化周结束时间为今天
            let weekEndDate = new Date(); 

            // 按日期倒序遍历
            for (let i = 0; i < dates.length; i++) {
                const currentDate = new Date(dates[i]);
                
                // 如果是第一条记录，重置周结束时间为该记录日期
                if (tempWeekRecords.length === 0) {
                    weekEndDate = currentDate;
                }

                const diffTime = Math.abs(weekEndDate - currentDate);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

                if (diffDays < 7) {
                    tempWeekRecords.push(this.dailyRecords.find(r => r.date === dates[i]));
                } else {
                    if (tempWeekRecords.length > 0) {
                        this.settleWeek(tempWeekRecords, weekEndDate, newWeeklyHistory);
                    }
                    tempWeekRecords = [this.dailyRecords.find(r => r.date === dates[i])];
                    weekEndDate = currentDate;
                }
            }

            if (tempWeekRecords.length > 0) {
                this.settleWeek(tempWeekRecords, weekEndDate, newWeeklyHistory);
            }

            this.weeklyHistory = newWeeklyHistory;
        },

        // 结算一周的数据
        settleWeek(records, endDate, historyList) {
            const stats = { '很开心': 0, '不高兴': 0, '就这样': 0 };
            records.forEach(r => {
                if (stats[r.mood] !== undefined) stats[r.mood]++;
            });

            let maxCount = -1;
            let finalMood = '就这样';
            for (const mood in stats) {
                if (stats[mood] > maxCount) {
                    maxCount = stats[mood];
                    finalMood = mood;
                } else if (stats[mood] === maxCount) {
                    if (mood === '很开心') finalMood = mood;
                    else if (finalMood === '不高兴' && mood === '就这样') finalMood = mood;
                }
            }

            const startDate = new Date(endDate);
            startDate.setDate(endDate.getDate() - 6);

            historyList.push({
                weekLabel: `第${historyList.length + 1}周`,
                dateRange: `${this.formatDate(startDate)} 至 ${this.formatDate(endDate)}`,
                finalMood: finalMood
            });
        },

        selectMood() {
            if (!this.currentUser) {
                this.showLoginPopup = true
                return
            }
            this.showPopup = true;
        },
        closePopup() {
            this.showPopup = false;
        },
        saveMood(mood) {
            const now = new Date();
            const dateStr = this.formatDate(now);
            
            const records = this.dailyRecords.slice();
            const existingIndex = records.findIndex(r => r.date === dateStr);

            if (existingIndex !== -1) {
                records[existingIndex].mood = mood;
                uni.showToast({ title: '今日心情已更新', icon: 'success' });
            } else {
                records.unshift({ date: dateStr, mood: mood });
                uni.showToast({ title: '心情记录成功', icon: 'success' });
            }

            this.dailyRecords = records;

            // 重新计算本周统计
            this.calculateWeeklyStats();
            
            // --- 核心修改：更新历史周报 ---
            // 既然用户记录了新心情，我们需要检查历史周报的第一项（即当前周）是否需要更新
            // 如果历史周报为空，或者第一项的日期范围不包含今天，则说明需要新增或更新当前周
            this.updateCurrentWeekInHistory(dateStr);
            this.uploadMoodData();

            this.closePopup();
        },

        // 新增方法：专门用于更新历史周报中的“当前周”
        updateCurrentWeekInHistory(currentDateStr) {
            const currentHistory = this.weeklyHistory.slice();
            const now = new Date(currentDateStr);
            
            // 如果历史为空，或者历史第一项的结束日期早于今天（说明跨周了），需要生成新的一周
            if (currentHistory.length === 0) {
                this.generateWeeklyHistory();
                return;
            }

            const lastWeek = currentHistory[0];
            // 解析最后一周的结束日期 (假设格式为 "YYYY-MM-DD 至 YYYY-MM-DD")
            const lastEndDateStr = lastWeek.dateRange.split(' 至 ')[1];
            const lastEndDate = new Date(lastEndDateStr);

            // 如果今天距离上一周结束日期已经超过一定天数（比如超过7天，或者简单判断日期），则视为新的一周
            // 这里我们用简单的逻辑：如果今天不在上一周的日期范围内，就新增一周
            // 为了简化，我们直接重新生成一次历史（因为数据量不大），或者更精细地只更新第一周
            
            // 方案：为了确保数据绝对准确且持久化，这里采用"重新生成并保存"的策略
            // 但为了保持"第N周"的标签不变，我们需要小心处理。
            // 实际上，最稳妥的方式是：只更新第一周的数据，如果跨周了，就插入新的一周。
            
            // 简单处理：如果今天不在上一周的范围内，重新生成整个历史（会重置周次标签，但数据是最新的）
            // 为了满足用户"数据不消失"的需求，我们尽量保留周次标签。
            // 这里我们选择：如果历史记录存在，我们只更新第一周的数据，或者新增一周。
            
            // 判断今天是否属于历史记录中的第一周
            // 这里我们简化处理：直接调用 generateWeeklyHistory，它会根据 dailyRecords 重新生成所有历史。
            // 虽然这会重置"第X周"的序号，但能保证数据绝对正确和持久。
            // 如果用户非常在意"第X周"的序号保持不变，逻辑会非常复杂（需要判断是修改旧数据还是新增数据）。
            // 考虑到这是一个心情记录APP，重新生成历史周报的序号通常是可以接受的。
            
            this.generateWeeklyHistory();
            this.uploadMoodData();
        },

        uploadMoodData() {
            syncMoodToCloud(this.dailyRecords, this.weeklyHistory).then((ok) => {
                if (ok) {
                    uni.setStorageSync('lastMoodSyncTime', Date.now());
                }
            }).catch(() => {});
        },

        formatDate(date) {
            const year = date.getFullYear();
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');
            return `${year}-${month}-${day}`;
        },
        getMoodClass(mood) {
            if (mood === '很开心') return 'mood-happy';
            if (mood === '不高兴') return 'mood-sad';
            return 'mood-normal';
        }
    }
}
</script>

<style lang="scss" scoped>
.container {
    width: 100%;
    min-height: 100vh;
    background-color: #f5f5f5;
    padding-bottom: 20rpx;
}

.swiper {
    height: 300rpx;
    width: 100%;
    margin-bottom: 20rpx;
}

swiper-item {
    position: relative;
}

.swiper-img {
    width: 100%;
    height: 100%;
}

.swiper-edit-hint {
    position: absolute;
    right: 16rpx;
    bottom: 16rpx;
    background: rgba(0, 0, 0, 0.45);
    padding: 8rpx 16rpx;
    border-radius: 20rpx;
}

.swiper-edit-text {
    font-size: 22rpx;
    color: #fff;
}

.weekly-summary {
    background-color: #fff;
    margin: 20rpx;
    padding: 20rpx;
    border-radius: 16rpx;
    box-shadow: 0 2rpx 10rpx rgba(0,0,0,0.05);
}

.summary-title {
    font-size: 32rpx;
    font-weight: bold;
    margin-bottom: 15rpx;
    color: #333;
    border-bottom: 1rpx solid #eee;
    padding-bottom: 10rpx;
}

.summary-content {
    display: flex;
    flex-direction: column;
    gap: 10rpx;
}

.summary-item {
    display: flex;
    justify-content: space-between;
    font-size: 28rpx;
    color: #666;
}

.final-mood {
    margin-top: 10rpx;
    font-size: 30rpx;
    font-weight: bold;
    color: #007AFF;
    text-align: center;
    background-color: #f0f7ff;
    padding: 10rpx;
    border-radius: 8rpx;
}

.history-section {
    background-color: #fff;
    margin: 20rpx;
    padding: 20rpx;
    border-radius: 16rpx;
    box-shadow: 0 2rpx 10rpx rgba(0,0,0,0.05);
    overflow: hidden;
}

.section-title {
    font-size: 32rpx;
    font-weight: bold;
    margin-bottom: 15rpx;
    color: #333;
}

.history-body {
    display: flex;
    align-items: stretch;
    min-height: 560rpx;
}

.scroll-view {
    flex: 1;
    height: 560rpx;
    min-width: 0;
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
    padding: 40rpx 0;
}

.boy-container {
    flex-shrink: 0;
    width: 200rpx;
    height: 220rpx;
    align-self: flex-end;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    background-color: rgba(255, 255, 255, 0.5);
    border-top-right-radius: 50%;
    overflow: hidden;
}

.boy-img {
    width: 100%;
    height: 100%;
    animation: wave 2s infinite ease-in-out;
    transform-origin: bottom center;
}

@keyframes wave {
    0% { transform: rotate(0deg); }
    25% { transform: rotate(10deg); }
    50% { transform: rotate(0deg); }
    75% { transform: rotate(-10deg); }
    100% { transform: rotate(0deg); }
}

.swiper-placeholder-img {
    width: 100%;
    height: 100%;
    background-color: #e8e8e8;
}

.popup-mask {
    position: fixed;
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;
    background-color: rgba(0, 0, 0, 0.5);
    z-index: 1000;
    display: flex;
    justify-content: center;
    align-items: center;
}

.popup-content {
    background-color: #fff;
    width: 80%;
    padding: 40rpx 20rpx;
    border-radius: 20rpx;
    display: flex;
    flex-direction: column;
    align-items: center;
}

.popup-title {
    font-size: 36rpx;
    font-weight: bold;
    margin-bottom: 40rpx;
    color: #333;
}

.mood-options {
    display: flex;
    justify-content: space-around;
    width: 100%;
}

.mood-btn {
    width: 30%;
    height: 80rpx;
    line-height: 80rpx;
    border-radius: 40rpx;
    font-size: 28rpx;
    color: #fff;
    border: none;
}

.mood-btn:nth-child(1) { background-color: #FFD700; }
.mood-btn:nth-child(2) { background-color: #87CEEB; }
.mood-btn:nth-child(3) { background-color: #A9A9A9; }

.login-option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 28rpx 20rpx;
}

.login-option:active {
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
    width: 100%;
    height: 1rpx;
    background: #f0f0f0;
}

.login-cancel {
    width: 100%;
    padding: 28rpx;
    text-align: center;
    font-size: 30rpx;
    color: #999;
    border-top: 1rpx solid #f0f0f0;
    margin-top: 16rpx;
}

.login-cancel:active {
    background: #f5f5f5;
}

.login-input {
    width: 100%;
    height: 80rpx;
    background: #f5f5f5;
    border-radius: 12rpx;
    padding: 0 24rpx;
    font-size: 28rpx;
    box-sizing: border-box;
    margin-bottom: 24rpx;
}

.popup-actions {
    display: flex;
    width: 100%;
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