import { measureFolder, placeFlap } from '@/utils/folderMotion'

// 固定逻辑像素。修改这里即可调整文件夹、纸张和网格，scale 同时作用于两者。
export const diaryFolder = {
    width: 130,
    height: 130,
    paperWidth: 55,
    paperHeight: 100,
    scale: 0.8,
    color: '#FFBD2E',
    gap: 15,
    // 日期文字的预留宽度，以及每侧曲线在标签顶缘占用的宽度。
    tabLabelWidth: 60,
    tabShoulder: 6
}

export function diaryGeometry(availableWidth: number) {
    const scale = Math.min(diaryFolder.scale, availableWidth / diaryFolder.width)
    return measureFolder(false, scale, diaryFolder.tabLabelWidth * scale, true, 'center', diaryFolder)
}

// 保留原版 Spread 的倾角和纵向起伏，空间不足时只重新分行。
export function spreadLayout(count: number, viewport: {width: number; height: number}, g: ReturnType<typeof diaryGeometry>) {
    const pad = 10
    const gap = 12 * g.scale
    const paperW = g.docW + g.docH * .06
    const paperH = g.docH + g.docW * .06
    const columns = Math.min(count || 1, Math.max(1, Math.floor((viewport.width - 2 * pad + gap) / (paperW + gap))))
    const rows = Math.ceil(count / columns)
    const deckHeight = Math.min(rows * (paperH + gap) - gap, Math.max(paperH, viewport.height - g.h * .64 - 70))
    const rowStep = rows > 1 ? (deckHeight - paperH) / (rows - 1) : 0
    const top = Math.max(pad, (viewport.height - deckHeight - g.h * .64 - 40) / 2)
    const stageTop = Math.min(viewport.height - g.tabH - g.h - pad, top + deckHeight - g.tabH - g.h * .36)
    const stageLeft = (viewport.width - g.w) / 2
    const slots = Array.from({length: count}, (_, index) => {
        const original = placeFlap(index, count, 'open', 'spread', g, null)
        const row = Math.floor(index / columns)
        const rowCount = Math.min(columns, count - row * columns)
        const x = g.w / 2 + (index % columns - (rowCount - 1) / 2) * (paperW + gap)
        const y = top + paperH / 2 + row * rowStep - stageTop
        const lift = original.y - (g.tabH - g.h * .02)
        const minY = pad + paperH / 2
        const maxY = Math.max(minY, viewport.height - pad - paperH / 2)
        return {...original, x, y: Math.max(minY, Math.min(maxY, stageTop + y + lift)) - stageTop, s: 1}
    })
    return { stageTop, stageLeft, slots }
}
