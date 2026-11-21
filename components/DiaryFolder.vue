<template>
    <!-- 原版 Flap + Spread 分层：背板、纸片、盖板，触摸代替 Pointer Events。 -->
    <view class="folder-root" @click="toggle">
        <view class="folder-stage" :style="stageStyle">
            <view class="folder-ground" :style="groundStyle"></view>
            <image class="folder-back" :src="backImage" mode="aspectFit" :style="backStyle" />
            <text class="folder-tab-text" :style="tabStyle">{{ date }}</text>
            <view v-for="(item, index) in visibleItems" :key="item.key" class="folder-item" :style="paperStyles[index]"
                @click.stop="activate(index)" @touchstart="touchStart(index, $event)" @touchmove.stop.prevent="touchMove" @touchend="touchEnd" @touchcancel="touchCancel">
                <text class="folder-doc-title">{{ item.label }}</text>
                <text v-if="item.description" class="folder-doc-text">{{ item.description }}</text>
                <view class="folder-doc-line line-one"></view>
                <view class="folder-doc-line line-two"></view>
                <view class="folder-doc-line line-three"></view>
                <view class="folder-doc-block"></view>
                <view class="folder-doc-line line-two"></view>
            </view>
            <view class="folder-front" :style="frontStyle"></view>
        </view>
    </view>
</template>

<script setup lang="ts">
// 几何与运动数学来自附件原版；仅替换测量、帧调度和视图写入平台层。
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { MAX_ITEMS, backPath, placeFlap, chain, move, turnX, turnZ, stretch, toCss, integrate, type Geometry, type Slot, type Spring } from '@/utils/folderMotion'
interface Item { key: string; label: string; description?: string }
const props = defineProps<{
    items: Item[]
    date: string
    color: string
    geometry: Geometry
    open: boolean
    reducedMotion?: boolean
    spread?: Slot[]
    bounds?: { left: number; top: number; width: number; height: number }
}>()
const emit = defineEmits<{
    select: [item: Item]
    'open-change': [open: boolean]
    settled: []
}>()
const visibleItems = computed(() => props.items.slice(0, MAX_ITEMS))
const g = props.geometry
const total = g.tabH + g.h
const stageStyle = { width: `${g.w}px`, height: `${total}px`, perspective: `${Math.round(g.w * 5)}px`, perspectiveOrigin: `${g.w / 2}px ${g.tabH + g.h / 2}px` }
// 用原版 backPath 生成内嵌 SVG 图片，替换小程序不支持的内联 SVG/clip-path:path。
function mix(amount: number, target: number) {
    const hex = /^#[\da-f]{6}$/i.test(props.color) ? props.color.slice(1) : 'eab308'
    return `rgb(${[0, 2, 4].map(i => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - amount) + target * amount)).join(',')})`
}
const backImage = computed(() => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${g.w}" height="${total}" viewBox="0 0 ${g.w} ${total}"><defs><linearGradient id="b" x2="0" y2="1"><stop stop-color="${mix(.08, 0)}"/><stop offset="1" stop-color="${mix(.16, 0)}"/></linearGradient></defs><path d="${backPath(g)}" fill="url(#b)"/></svg>`))
const backStyle = { width: `${g.w}px`, height: `${total}px` }
const tabStyle = { left: `${g.tabX}px`, width: `${g.tabW}px`, height: `${g.tabH}px`, fontSize: `${10.5 * g.scale}px` }
const groundStyle = { top: `${total}px`, width: `${g.w}px`, height: `${g.h * .14}px`, filter: `blur(${g.h * .05}px)` }
const frontStyle = ref<Record<string, string>>({})
const paperStyles = ref<Record<string, string>[]>([])
const fields: (keyof Slot)[] = ['x', 'y', 'z', 'r', 'ry', 's']
let states: Record<keyof Slot, Spring>[] = []
const front: Spring = { value: 0, velocity: 0 }
let timer: ReturnType<typeof setTimeout> | undefined
let changedAt = 0
let last = 0
let disposed = false
let drag: { index: number; x: number; y: number; start: Slot; moved: boolean } | null = null
let suppressUntil = 0
// 文件夹内的纸张继续使用原版展开与回弹坐标。
function pose(index: number): Slot {
    return props.open && props.spread?.[index]
        ? props.spread[index]
        : placeFlap(index, visibleItems.value.length, 'rest', 'spread', g, null)
}
function write() {
    const theta = front.value
    const light = (Math.sin(theta * Math.PI / 180) * .5 + Math.cos(theta * Math.PI / 180) * .86) / .86
    frontStyle.value = {
        width: `${g.w}px`, height: `${g.frontH}px`, borderRadius: `${g.r}px`,
        transform: toCss(chain(move(0, total, 2 * g.scale), turnX(theta), move(0, -g.frontH))),
        background: `linear-gradient(rgba(0,0,0,${Math.min(.5, Math.max(0, (1-light)*.22))}),rgba(0,0,0,${Math.min(.5, Math.max(0, (1-light)*.22))})),linear-gradient(160deg,${mix(.12,255)},${props.color} 48%,${mix(.06,0)})`
    }
    paperStyles.value = states.map((state, index) => {
        const angle = state.r.value * Math.PI / 180
        const size = Math.max(.01, state.s.value)
        let x = state.x.value
        let y = state.y.value
        if (props.bounds) {
            const { left, top, width, height } = props.bounds
            const rx = size * (g.docW * Math.abs(Math.cos(angle)) + g.docH * Math.abs(Math.sin(angle))) / 2
            const ry = size * (g.docW * Math.abs(Math.sin(angle)) + g.docH * Math.abs(Math.cos(angle))) / 2
            x = Math.max(rx, Math.min(width - rx, x + left)) - left
            y = Math.max(ry, Math.min(height - ry, y + top)) - top
        }
        return {
            width: `${g.docW}px`,
            height: `${g.docH}px`,
            zIndex: String(drag?.index === index && drag.moved ? 80 : 10 + states.length - index),
            transform: toCss(chain(move(x, y, 3 * g.scale), turnZ(state.r.value), stretch(size, size), move(-g.docW / 2, -g.docH / 2)))
        }
    })
}
function frame() {
    timer = undefined
    if (disposed) return
    const now = Date.now()
    const dt = last ? Math.min(.05, (now-last)/1000) : 1/30
    last = now
    let busy = false
    // 原版 Flap 关闭时等待纸片归位，盖板延时 0.06 + 0.035 * count 秒。
    const closingDelay = !props.open && now-changedAt < (0.06 + .035*states.length)*1000
    const target = props.open || closingDelay ? -64 : 0
    busy = integrate(front, target, Math.PI*4, .784, dt) || busy
    states.forEach((state, index) => {
        if (drag?.index === index) return
        const slot = pose(index)
        fields.forEach(key => { busy = integrate(state[key], slot[key], Math.PI*4.2, .784, dt) || busy })
        // 原版纸片底部碰撞约束，避免闭合时穿透文件夹底部。
        const tilt = state.r.value*Math.PI/180
        const reach = (g.docW*Math.abs(Math.sin(tilt))+g.docH*Math.abs(Math.cos(tilt)))*state.s.value/2
        const floor = Math.max(slot.y, total - 2 * g.scale - reach)
        if (!props.open && state.y.value > floor) { state.y.value=floor; if(state.y.velocity>0) state.y.velocity *= -.25 }
    })
    write()
    if (busy || closingDelay) timer = setTimeout(frame, 33)
    else { last = 0; emit('settled') }
}
function wake() { if (timer === undefined) frame() }
function toggle() { if(Date.now() >= suppressUntil) emit('open-change', !props.open) }
function activate(index: number) {
    if(Date.now() < suppressUntil) return
    if (!props.open) { emit('open-change', true); return }
    emit('select', visibleItems.value[index])
}
// Touch 坐标直接以 px 进入原版纸片坐标系统；拖动结束弹簧回位。
type TouchEvent = { touches: { clientX: number; clientY: number }[] }
function touchStart(index: number, event: TouchEvent) {
    if(!props.open || !states[index] || !event.touches[0]) return
    const t = event.touches[0]
    const state = states[index]
    drag = { index, x:t.clientX, y:t.clientY, start: Object.fromEntries(fields.map(k=>[k,state[k].value])) as unknown as Slot, moved:false }
}
function touchMove(event: TouchEvent) {
    if(!drag || !event.touches[0]) return
    const t = event.touches[0], dx=t.clientX-drag.x, dy=t.clientY-drag.y
    if(Math.abs(dx)+Math.abs(dy)>6) drag.moved=true
    if (!drag.moved) return
    states[drag.index].x.value=drag.start.x+dx
    states[drag.index].y.value=drag.start.y+dy
    write()
}
function touchEnd() { if(drag?.moved) suppressUntil=Date.now()+350; drag=null; wake() }
function touchCancel() { touchEnd() }
watch(() => props.open, () => {
    changedAt=Date.now()
    if(props.reducedMotion) {
        front.value=props.open?-64:0
        states.forEach((state,i)=>fields.forEach(k=>{state[k]={value:pose(i)[k],velocity:0}}))
        write()
    } else wake()
})
watch(() => props.spread, wake)
watch(() => visibleItems.value.map(item => item.key).join(','), () => {
    states=visibleItems.value.map((_,index)=>Object.fromEntries(fields.map(k=>[k,{value:pose(index)[k],velocity:0}])) as Record<keyof Slot,Spring>)
    write()
}, { immediate:true })
onBeforeUnmount(()=>{disposed=true; if(timer!==undefined) clearTimeout(timer)})
</script>

<style lang="scss" scoped>
// 原版 Solid 外观与图层次序；尺寸由原版 Geometry 计算，避免 CSS 单独偏离。
.folder-root {
    position: relative;
    display: grid;
    justify-items: center;

    .folder-stage {
        position: relative;
        isolation: isolate;
    }
    .folder-ground {
        position: absolute;
        left: 0;
        z-index: 1;
        margin-top: -7%;
        border-radius: 50%;
        background: rgba(22,24,22,.16);
        pointer-events: none;
    }
    .folder-back {
        position: absolute;
        top: 0;
        left: 0;
        z-index: 4;
    }
    .folder-tab-text {
        position: absolute;
        top: 0;
        z-index: 5;
        display: grid;
        place-items: center;
        color: rgba(255,255,255,.92);
        font-weight: 600;
        white-space: nowrap;
    }
    .folder-item {
        position: absolute;
        top: 0;
        left: 0;
        transform-origin: 0 0;
        overflow: hidden;
        border-radius: 7px;
        background: #fff;
        box-shadow: 0 0 0 .5px rgba(0,0,0,.06),0 1px 2px rgba(0,0,0,.12),0 2px 5px rgba(0,0,0,.1);
        padding: 14rpx 13rpx;
        box-sizing: border-box;
        .folder-doc-title {
            display: block;
            margin-bottom: 8rpx;
            font-size: $q-font-size-small;
            font-weight: 600;
            color: #474747;
        }
        .folder-doc-text {
            display: block;
            margin-bottom: 6rpx;
            font-size: 18rpx;
            color: #999;
            max-height: 44rpx;
            overflow: hidden;
        }
        .folder-doc-line {
            height: 4rpx;
            margin-bottom: 6rpx;
            border-radius: 999px;
            background: #e3e3e3;
        }
        .line-one {
            width: 92%;
        }
        .line-two {
            width: 84%;
        }
        .line-three {
            width: 88%;
        }
        .folder-doc-block {
            height: 40rpx;
            margin: 6rpx 0;
            border-radius: 5rpx;
            background: #e3e3e3;
            opacity: .75;
        }
    }
    .folder-front {
        position: absolute;
        top: 0;
        left: 0;
        z-index: 40;
        transform-origin: 0 0;
        box-shadow: inset 0 1px 0 rgba(255,255,255,.28),inset 0 0 0 1px rgba(255,255,255,.05);
    }
}
</style>
