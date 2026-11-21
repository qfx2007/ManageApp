<template>
    <view class="report-page">
        <view class="year-card">
            <view class="year-icon"><image src="/static/images/icons/calendar.png" mode="aspectFit" /></view>
            <view>
                <text class="year-title">近一年 · 按周统计</text>
                <text class="year-caption">已记录 {{ records.length }} 天 · {{ weekCount }} 个完整周报</text>
            </view>
        </view>

        <!-- 明确区分读取中、失败、未登录和真实空记录。 -->
        <view v-if="statusText" class="empty-tip" @click="loadReport">{{ statusText }}</view>
        <view class="distribution-card">
            <text class="card-title">年度心情分布</text>
            <view class="distribution-grid">
                <view v-for="item in distribution" :key="item.mood" class="distribution-item">
                    <image class="distribution-icon" :src="item.icon" mode="aspectFit" />
                    <text class="distribution-mood">{{ item.mood }}</text>
                    <text class="distribution-percent">{{ item.percent }}%</text>
                </view>
            </view>
        </view>

        <view class="history-card">
            <text class="card-title">历史周报</text>
            <view v-if="history.length" class="history-list">
                <view v-for="item in history" :key="item.weekLabel + item.dateRange" class="history-item">
                    <view class="history-index"></view>
                    <text>{{ item.weekLabel }}：{{ item.finalMood }}</text>
                </view>
            </view>
            <text v-else class="empty-tip">还没有足够的记录生成周报</text>
        </view>

        <view class="report-note">这一年，你记录下的每一种心情都值得被认真收藏。</view>
    </view>
</template>

<script setup>
// 年度周报复用首页云端心情数据，只负责统计展示。
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { fetchMoodData, loadCurrentUser } from '@/utils/cloud.js'
import { buildCompletedWeeks, recentYearRange } from '@/utils/mood'

const records = ref([])
const history = ref([])
const statusText = ref('')
const moods = ['很开心', '就这样', '不高兴']

const weekCount = computed(() => history.value.length)
const distribution = computed(() => {
    const counts = moods.map((mood) => records.value.filter((record) => record.mood === mood).length)
    const total = counts.reduce((sum, count) => sum + count, 0)
    return moods.map((mood, index) => ({
        mood,
        percent: total ? Math.round((counts[index] / total) * 100) : 0,
        className: ['happy', 'neutral', 'sad'][index],
        icon: ['/static/images/icons/mood-happy.png', '/static/images/icons/mood-neutral.png', '/static/images/icons/mood-sad.png'][index]
    }))
})

onShow(loadReport)

async function loadReport() {
    statusText.value = '正在读取心情…'
    try {
        if (!await loadCurrentUser()) {
            records.value = []
            history.value = []
            statusText.value = '请先在“我的”中登录'
            return
        }
        const range = recentYearRange()
        const data = await fetchMoodData(range.start, range.end)
        records.value = data?.dailyRecords || []
        // 只按实际满 7 天的记录生成周报，避免未满一周时提前显示第 1 周。
        history.value = buildCompletedWeeks(records.value)
        statusText.value = records.value.length ? '' : '近一年还没有心情记录'
    } catch (error) {
        records.value = []
        history.value = []
        statusText.value = '读取失败，点击重试'
    }
}

</script>

<style lang="scss" scoped>
.report-page {
    min-height: 100vh;
    padding: 54rpx 28rpx 48rpx;
    color: $q-color-text;
    background: linear-gradient(180deg, #fff0ea 0%, #fffaf5 42%, #fff6ed 100%);
    box-sizing: border-box;

    .year-card,
    .distribution-card,
    .history-card {
        margin-bottom: 20rpx;
        padding: 26rpx;
        border: 2rpx solid #f6d6c8;
        border-radius: $q-radius-md;
        background: rgba(255, 250, 245, 0.9);
        box-shadow: $q-shadow-soft;
    }

    .year-card {
        display: grid;
        grid-template-columns: 82rpx 1fr;
        gap: 18rpx;
        align-items: center;
    }

    .year-icon {
        display: grid;
        width: 82rpx;
        height: 82rpx;
        place-items: center;
        border-radius: 24rpx;
        color: #fff;
        background: $q-color-primary;

        image {
            width: 66rpx;
            height: 66rpx;
        }
    }

    .year-title,
    .year-caption,
    .distribution-mood,
    .distribution-percent,
    .history-item,
    .empty-tip {
        display: block;
    }

    .year-title {
        font-size: $q-font-size-medium;
        font-weight: 700;
    }

    .year-caption,
    .empty-tip {
        margin-top: 8rpx;
        color: $q-color-text-muted;
        font-size: $q-font-size-small;
    }

    .card-title {
        display: block;
        margin-bottom: 22rpx;
        font-size: $q-font-size-medium;
        font-weight: 700;
    }

    .distribution-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 12rpx;
    }

    .distribution-item {
        display: grid;
        justify-items: center;
        gap: 6rpx;
    }

    .distribution-icon {
        width: 78rpx;
        height: 78rpx;
    }

    .distribution-mood,
    .distribution-percent {
        font-size: $q-font-size-small;
        font-weight: 700;
    }

    .history-item {
        display: grid;
        grid-template-columns: 12rpx 1fr;
        gap: 14rpx;
        align-items: center;
        min-height: 58rpx;
        font-size: $q-font-size-medium;
    }

    .history-index {
        width: 12rpx;
        height: 44rpx;
        border-radius: 8rpx;
        background: $q-color-primary;
    }

    .report-note {
        padding: 24rpx;
        color: $q-color-text-muted;
        font-size: $q-font-size-small;
        line-height: 1.6;
        text-align: center;
    }
}
</style>
