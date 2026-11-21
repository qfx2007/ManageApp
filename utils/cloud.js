import { CLOUD_ENV_ID, USERS_COLLECTION, TASKS_COLLECTION, MOODS_COLLECTION, DIARIES_COLLECTION } from '@/config/cloud.js'
import { beijingDate, shiftDate } from '@/utils/mood'

let db = null
let inited = false

export function isCloudAvailable() {
    // #ifdef MP-WEIXIN
    return typeof wx !== 'undefined' && !!wx.cloud
    // #endif
    // #ifndef MP-WEIXIN
    return false
    // #endif
}

export function getCloudEnvId() {
    return CLOUD_ENV_ID
}

// 归属由微信 SDK 注入，身份查询不再将用户文档 ID 当成 OPENID。
const ownerCondition = { _openid: '{openid}' }
function requireUser() {
    const user = uni.getStorageSync('currentUser')
    if (uni.getStorageSync('isLoggedOut') || !user?._id) throw new Error('请先在“我的”中登录')
    return user
}

function ownProfiles() {
    return getDb().collection(USERS_COLLECTION).where(ownerCondition)
        .field({ _id: true, username: true, avatar: true, signature: true })
}

export async function syncTasksToCloud() {
    const user = uni.getStorageSync('currentUser')
    if (!user || !user._id || !isCloudAvailable() || !CLOUD_ENV_ID) {
        return false
    }
    await initCloud()
    const database = getDb()
    const tasks = uni.getStorageSync('todoTasks') || []

    const existing = await database.collection(TASKS_COLLECTION).where({
        _openid: '{openid}'
    }).get()

    if (existing.data.length === 0) {
        await database.collection(TASKS_COLLECTION).add({
            data: {
                tasks: tasks,
                updateTime: Date.now()
            }
        })
    } else {
        await database.collection(TASKS_COLLECTION).doc(existing.data[0]._id).update({
            data: {
                tasks: tasks,
                updateTime: Date.now()
            }
        })
    }
    return true
}

export async function fetchTasksFromCloud() {
    const user = uni.getStorageSync('currentUser')
    if (!user || !user._id || !isCloudAvailable() || !CLOUD_ENV_ID) {
        return null
    }
    await initCloud()
    const database = getDb()
    const res = await database.collection(TASKS_COLLECTION).where({
        _openid: '{openid}'
    }).get()

    if (res.data.length > 0 && res.data[0].tasks) {
        uni.setStorageSync('todoTasks', res.data[0].tasks)
        return res.data[0].tasks
    }
    return null
}

export function initCloud() {
    if (!isCloudAvailable()) {
        return Promise.reject(new Error('仅支持微信小程序云开发'))
    }
    if (!CLOUD_ENV_ID) {
        return Promise.reject(new Error('请先在 config/cloud.js 中配置云开发环境 ID'))
    }
    if (inited) {
        return Promise.resolve()
    }
    // #ifdef MP-WEIXIN
    wx.cloud.init({
        env: CLOUD_ENV_ID,
        traceUser: true
    })
    db = wx.cloud.database({ env: CLOUD_ENV_ID })
    inited = true
    return Promise.resolve()
    // #endif
}

function getDb() {
    if (!db) {
        throw new Error('云开发尚未初始化')
    }
    return db
}

function validateUsername(username) {
    const name = (username || '').trim()
    if (!name) {
        throw new Error('用户名不能为空')
    }
    if (name.length < 2 || name.length > 20) {
        throw new Error('用户名需为 2-20 个字符')
    }
    if (!/^[\u4e00-\u9fa5a-zA-Z0-9_]+$/.test(name)) {
        throw new Error('用户名仅支持中文、字母、数字和下划线')
    }
    return name
}

export async function registerUser(username) {
    await initCloud()
    const name = validateUsername(username)
    const database = getDb()

    // 昵称仅作显示和本人确认，私人集合不跨用户枚举昵称。
    const mine = await ownProfiles().get()
    if (mine.data.length > 0) {
        const user = {
            _id: mine.data[0]._id,
            username: mine.data[0].username,
            avatar: mine.data[0].avatar || '',
            signature: mine.data[0].signature || ''
        }
        uni.setStorageSync('currentUser', user)
        throw new Error(`当前微信已注册为「${user.username}」`)
    }

    const res = await database.collection(USERS_COLLECTION).add({
        data: {
            username: name,
            avatar: '',
            createdAt: database.serverDate(),
            updateTime: Date.now()
        }
    })

    const user = { _id: res._id, username: name, avatar: '', signature: '' }
    uni.setStorageSync('currentUser', user)
    return user
}

export async function loginUser(username) {
    await initCloud()
    const name = validateUsername(username)

    // 查询显式携带归属条件，配合服务端 PRIVATE 权限隔离用户。
    const res = await ownProfiles().get()

    if (res.data.length === 0) {
        return null   // 当前微信号未注册
    }

    const record = res.data[0]
    if (record.username !== name) {
        return null   // 昵称与当前微信号绑定的账号不匹配
    }

    const user = {
        _id: record._id,
        username: record.username,
        avatar: record.avatar || '',
        signature: record.signature || ''
    }
    uni.setStorageSync('currentUser', user)
    return user
}

export async function loadCurrentUser() {
    if (uni.getStorageSync('isLoggedOut')) {
        return null
    }
    if (!isCloudAvailable() || !CLOUD_ENV_ID) {
        return uni.getStorageSync('currentUser') || null
    }

    await initCloud()
    const res = await ownProfiles().get()

    if (res.data.length === 0) {
        uni.removeStorageSync('currentUser')
        return null
    }

    const user = {
        _id: res.data[0]._id,
        username: res.data[0].username,
        avatar: res.data[0].avatar || '',
        signature: res.data[0].signature || ''
    }
    uni.setStorageSync('currentUser', user)
    return user
}

export async function uploadAvatarToCloud(tempPath) {
    const user = uni.getStorageSync('currentUser')
    const uid = (user && user._id) || null
    if (!uid) return null
    await initCloud()
    const res = await wx.cloud.uploadFile({
        cloudPath: `avatar/${uid}_${Date.now()}.png`,
        filePath: tempPath
    })
    return res.fileID
}

export async function deleteAvatarFile(fileId) {
    if (!fileId || !isCloudAvailable() || !CLOUD_ENV_ID) return
    try {
        await initCloud()
        await wx.cloud.deleteFile({ fileList: [fileId] })
    } catch (_) {}
}

// 统一保存编辑资料页的字段，避免昵称、签名和头像分别更新造成界面状态不一致。
export async function updateUserProfile({ username, signature = '', avatar = '' }) {
    const user = requireUser()
    const name = validateUsername(username)
    const normalizedSignature = signature.trim()
    if (normalizedSignature.length > 30) {
        throw new Error('个性签名不能超过 30 个字符')
    }
    await initCloud()
    const result = await getDb().collection(USERS_COLLECTION).doc(user._id).update({
        data: {
            username: name,
            signature: normalizedSignature,
            avatar,
            updateTime: Date.now()
        }
    })
    if (result.stats.updated !== 1) {
        throw new Error('资料已变化，请重新加载')
    }
    const updatedUser = { ...user, username: name, signature: normalizedSignature, avatar }
    uni.setStorageSync('currentUser', updatedUser)
    return updatedUser
}

// 每次只保存当天心情；联合唯一索引阻止并发产生同日重复记录。
export async function saveMoodToCloud(date, mood) {
    requireUser()
    if (date !== beijingDate() || !['很开心', '就这样', '不高兴'].includes(mood)) throw new Error('心情或日期不正确')
    await initCloud()
    await saveDailyDocument(MOODS_COLLECTION, date, { mood })
    moodVersion += 1
    moodCache.clear()
}

function validateDate(date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) {
        throw new Error('日期格式不正确')
    }
}

// SDK 写入不传 _openid；重复插入只在确认同日记录已存在后改为更新。
async function saveDailyDocument(collectionName, date, content) {
    validateDate(date)
    const database = getDb()
    const collection = database.collection(collectionName)
    const query = { ...ownerCondition, date }
    const existing = await collection.where(query).limit(1).get()
    const data = { ...content, updatedAt: database.serverDate() }
    const updateData = content.note ? { ...data, note: database.command.set(content.note) } : data
    if (existing.data.length) {
        const result = await collection.doc(existing.data[0]._id).update({ data: updateData })
        if (result.stats.updated !== 1) throw new Error('记录已变化，请重新加载')
        return
    }
    try {
        await collection.add({ data: { ...data, date, createdAt: database.serverDate() } })
    } catch (error) {
        // 仅处理唯一索引竞争，网络异常保留给界面提示重试。
        if (!/duplicate|E11000/i.test(error.errMsg || error.message || '')) throw error
        const concurrent = await collection.where(query).limit(1).get()
        if (!concurrent.data.length) throw error
        const result = await collection.doc(concurrent.data[0]._id).update({ data: updateData })
        if (result.stats.updated !== 1) throw new Error('记录已变化，请重新加载')
    }
}

// 范围与用户共同组成短时缓存键；首页读 7 天，周报只读近一年。
const moodCache = new Map()
let moodVersion = 0
export async function fetchMoodData(start = shiftDate(beijingDate(), -6), end = beijingDate()) {
    const user = requireUser()
    validateDate(start)
    validateDate(end)
    if (start > end) throw new Error('日期范围不正确')
    const key = `${user._id}:${start}:${end}`
    const cached = moodCache.get(key)
    if (cached && Date.now() - cached.time < 60000) return { dailyRecords: cached.records }
    await initCloud()
    const version = moodVersion
    const database = getDb()
    const records = []
    let cursor = shiftDate(end, 1)
    while (true) {
        const result = await database.collection(MOODS_COLLECTION).where({ ...ownerCondition,
            date: database.command.gte(start).and(database.command.lt(cursor))
        }).orderBy('date', 'desc').field({ date: true, mood: true }).limit(20).get()
        records.push(...result.data.map(({ date, mood }) => ({ date, mood })))
        if (result.data.length < 20) break
        cursor = result.data[result.data.length - 1].date
    }
    if (version === moodVersion) {
        if (moodCache.size >= 8) moodCache.delete(moodCache.keys().next().value)
        moodCache.set(key, { time: Date.now(), records })
    }
    return { dailyRecords: records }
}

// 日记使用日期游标分页，保留现有四张纸内容，整篇删除直接删除云文档。
export async function fetchDiaryPage(before = '') {
    requireUser()
    await initCloud()
    const condition = { ...ownerCondition }
    if (before) { validateDate(before); condition.date = getDb().command.lt(before) }
    const result = await getDb().collection(DIARIES_COLLECTION).where(condition).orderBy('date', 'desc').limit(20).get()
    return { entries: result.data.map(({ date, note }) => ({ date, note: note || {} })),
        hasMore: result.data.length === 20, cursor: result.data[result.data.length - 1]?.date || '' }
}

export async function saveDiaryToCloud(date, note) {
    requireUser()
    await initCloud()
    await saveDailyDocument(DIARIES_COLLECTION, date, { note })
}

export async function deleteDiaryFromCloud(date) {
    requireUser()
    validateDate(date)
    await initCloud()
    const collection = getDb().collection(DIARIES_COLLECTION)
    const existing = await collection.where({ ...ownerCondition, date }).limit(1).get()
    if (existing.data.length) {
        const result = await collection.doc(existing.data[0]._id).remove()
        if (result.stats.removed !== 1) throw new Error('记录已变化，请重新加载')
    }
}

// 旧本地日记不含用户归属，必须由使用者确认后导入，已有云端日期不覆盖。
export async function importLocalDiaries(notes) {
    requireUser()
    await initCloud()
    let imported = 0
    let skipped = 0
    for (const [date, note] of Object.entries(notes)) {
        validateDate(date)
        const collection = getDb().collection(DIARIES_COLLECTION)
        const existing = await collection.where({ ...ownerCondition, date }).limit(1).get()
        if (existing.data.length) { skipped += 1; continue }
        try {
            await collection.add({ data: { date, note, createdAt: getDb().serverDate(), updatedAt: getDb().serverDate() } })
            imported += 1
        } catch (error) {
            if (!/duplicate|E11000/i.test(error.errMsg || error.message || '')) throw error
            skipped += 1
        }
    }
    return { imported, skipped }
}
