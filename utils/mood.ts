// 所有业务日期统一使用北京时间；日期字符串也可直接用于数据库范围查询。
import type { DailyMoodRecord } from '@/types/domain'

const DAY = 86400000
export function beijingDate(time = Date.now()): string {
  return new Date(time + 8 * 3600000).toISOString().slice(0, 10)
}

export function shiftDate(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10)
}

// 近一年采用今天往前一个公历年；闰年 2 月 29 日对齐到 2 月末。
export function recentYearRange(today = beijingDate()): { start: string; end: string } {
  const [year, month, day] = today.split('-').map(Number)
  const lastDay = new Date(Date.UTC(year - 1, month, 0)).getUTCDate()
  const anniversary = `${year - 1}-${String(month).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`
  return { start: shiftDate(anniversary, 1), end: today }
}

// 周报由原始记录计算，不再把可重建摘要重复存入 users。
export function buildCompletedWeeks(records: DailyMoodRecord[]) {
  const groups = new Map<string, Map<string, DailyMoodRecord>>()
  for (const record of records) {
    const day = new Date(`${record.date}T00:00:00Z`).getUTCDay() || 7
    const monday = shiftDate(record.date, 1 - day)
    if (!groups.has(monday)) groups.set(monday, new Map())
    groups.get(monday)!.set(record.date, record)
  }
  const moods = ['很开心', '就这样', '不高兴'] as const
  return [...groups.entries()].filter(([, days]) => days.size === 7)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([start, days], index) => {
      const counts = moods.map(mood => [...days.values()].filter(record => record.mood === mood).length)
      const finalMood = moods[counts.indexOf(Math.max(...counts))]
      return { weekLabel: `第${index + 1}周`, dateRange: `${start} 至 ${shiftDate(start, 6)}`, finalMood }
    })
}
