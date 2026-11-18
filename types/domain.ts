/** 心情枚举，和现有页面持久化文案保持一致。 */
export type Mood = '很开心' | '就这样' | '不高兴'

export interface DailyMoodRecord {
  date: string
  mood: Mood
  updatedAt?: number
}

export interface CurrentUserCache {
  _id: string
  username?: string
  avatar?: string
  swiperImages?: string[]
}

export interface DiaryNote {
  food: string
  timeline: string
  thoughts: string
  gratitude: string
  updatedAt?: number
  x?: number
  y?: number
}
