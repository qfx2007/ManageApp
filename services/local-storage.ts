import type { CurrentUserCache, DiaryNote } from '@/types/domain'

export const STORAGE_KEYS = {
  currentUser: 'currentUser',
  diary: 'fourPartDiaries',
  tasks: 'todoTasks'
} as const

export function readCurrentUser(): CurrentUserCache | null {
  const user = uni.getStorageSync(STORAGE_KEYS.currentUser)
  return user && typeof user._id === 'string' ? user as CurrentUserCache : null
}

export function readDiary(date: string): DiaryNote | null {
  const all = uni.getStorageSync(STORAGE_KEYS.diary) || {}
  return all[date] ? all[date] as DiaryNote : null
}
