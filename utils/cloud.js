import { CLOUD_ENV_ID, USERS_COLLECTION, TASKS_COLLECTION } from '@/config/cloud.js'

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

let cachedOpenId = null

export async function getCloudUserId() {
    if (cachedOpenId) return cachedOpenId
    const stored = uni.getStorageSync('cloudUserId')
    if (stored) {
        cachedOpenId = stored
        return stored
    }
    try {
        await initCloud()
        const res = await wx.cloud.callFunction({ name: 'getOpenId' })
        const id = res?.result?.openid
        if (id) {
            cachedOpenId = id
            uni.setStorageSync('cloudUserId', id)
            return id
        }
    } catch (_) {}
    const user = uni.getStorageSync('currentUser')
    if (user?._id) {
        cachedOpenId = user._id
        return user._id
    }
    return null
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
    db = wx.cloud.database()
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

    const duplicate = await database.collection(USERS_COLLECTION).where({ username: name }).count()
    if (duplicate.total > 0) {
        throw new Error('用户名已被占用，请换一个')
    }

    const mine = await database.collection(USERS_COLLECTION).get()
    if (mine.data.length > 0) {
        const user = {
            _id: mine.data[0]._id,
            username: mine.data[0].username
        }
        uni.setStorageSync('currentUser', user)
        throw new Error(`当前微信已注册为「${user.username}」`)
    }

    const res = await database.collection(USERS_COLLECTION).add({
        data: {
            username: name,
            avatar: '',
            swiperImages: ['', '', ''],
            weeklyHistory: [],
            dailyRecords: [],
            updateTime: Date.now()
        }
    })

    const user = { _id: res._id, username: name, avatar: '', swiperImages: ['', '', ''] }
    uni.setStorageSync('currentUser', user)
    return user
}

export async function loginUser(username) {
    await initCloud()
    const name = validateUsername(username)
    const database = getDb()

    // 权限模型下 .get() 只返回当前微信号自己的记录
    const res = await database.collection(USERS_COLLECTION).get()

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
        swiperImages: (record.swiperImages && record.swiperImages.slice()) || ['', '', '']
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
    const database = getDb()
    const res = await database.collection(USERS_COLLECTION).get()

    if (res.data.length === 0) {
        uni.removeStorageSync('currentUser')
        return null
    }

    const user = {
        _id: res.data[0]._id,
        username: res.data[0].username,
        avatar: res.data[0].avatar || '',
        swiperImages: (res.data[0].swiperImages && res.data[0].swiperImages.slice()) || ['', '', '']
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

export async function uploadSwiperToCloud(tempPath, index) {
    const user = uni.getStorageSync('currentUser')
    const uid = (user && user._id) || null
    if (!uid) return null
    await initCloud()
    const res = await wx.cloud.uploadFile({
        cloudPath: `user_bg/${uid}/home_${index + 1}_${Date.now()}.png`,
        filePath: tempPath
    })
    return res.fileID
}

export async function deleteSwiperFile(fileId) {
    if (!fileId || !isCloudAvailable() || !CLOUD_ENV_ID) return
    try {
        await initCloud()
        await wx.cloud.deleteFile({ fileList: [fileId] })
    } catch (_) {}
}

export async function saveSwiperImagesToCloud(swiperList) {
    const user = uni.getStorageSync('currentUser')
    if (!user || !user._id || !isCloudAvailable() || !CLOUD_ENV_ID) {
        return false
    }
    await initCloud()
    await getDb().collection(USERS_COLLECTION).doc(user._id).update({
        data: {
            swiperImages: swiperList,
            updateTime: Date.now()
        }
    })
    return true
}

export async function saveAvatarToCloud(fileId) {
    const user = uni.getStorageSync('currentUser')
    if (!user || !user._id || !isCloudAvailable() || !CLOUD_ENV_ID) {
        return false
    }
    await initCloud()
    await getDb().collection(USERS_COLLECTION).doc(user._id).update({
        data: {
            avatar: fileId,
            updateTime: Date.now()
        }
    })
    return true
}

export async function syncMoodToCloud(dailyRecords = [], weeklyHistory = []) {
    const user = uni.getStorageSync('currentUser')
    if (!user || !user._id || !isCloudAvailable() || !CLOUD_ENV_ID) {
        return false
    }

    await initCloud()
    const database = getDb()

    await database.collection(USERS_COLLECTION).doc(user._id).update({
        data: {
            weeklyHistory,
            dailyRecords,
            updateTime: Date.now()
        }
    })
    return true
}

export async function fetchMoodData() {
    const user = uni.getStorageSync('currentUser')
    if (!user || !user._id || !isCloudAvailable() || !CLOUD_ENV_ID) {
        return null
    }

    await initCloud()
    const database = getDb()
    const res = await database.collection(USERS_COLLECTION).doc(user._id).get()

    if (res.data) {
        return {
            dailyRecords: res.data.dailyRecords || [],
            weeklyHistory: res.data.weeklyHistory || []
        }
    }
    return null
}

export async function fetchFriendMood(username) {
    await initCloud()
    const name = validateUsername(username)
    const currentUser = uni.getStorageSync('currentUser')

    if (currentUser && currentUser.username === name) {
        throw new Error('不能查看自己的账号')
    }

    const database = getDb()
    const res = await database.collection(USERS_COLLECTION)
        .where({ username: name })
        .field({
            username: true,
            weeklyHistory: true,
            updateTime: true
        })
        .get()

    if (res.data.length === 0) {
        throw new Error('未找到该用户，请确认用户名是否正确')
    }

    return res.data[0]
}
