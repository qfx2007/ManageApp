// 在内存中模拟微信数据库验证持久化流程，不写入线上测试数据。
const fs = require('node:fs')
const vm = require('node:vm')
const assert = require('node:assert/strict')
const path = require('node:path')
const compilerRoot = process.env.UNI_COMPILER_ROOT
const esbuild = require(compilerRoot ? path.join(compilerRoot, 'esbuild') : 'esbuild')

function loadModule(file, globals = {}, imports = {}) {
    const module = { exports: {} }
    const source = esbuild.transformSync(fs.readFileSync(file, 'utf8'), { loader: file.endsWith('.ts') ? 'ts' : 'js', format: 'cjs', target: 'es2020' }).code
    vm.runInNewContext(source, { module, exports: module.exports, require: id => {
        if (!(id in imports)) throw new Error('未声明的导入：' + id)
        return imports[id]
    }, ...globals }, { filename: file })
    return module.exports
}

const mood = loadModule('utils/mood.ts')
assert.equal(mood.beijingDate(Date.parse('2026-11-20T16:00:00Z')), '2026-11-21')
assert.equal(mood.beijingDate(Date.parse('2026-11-20T15:59:59Z')), '2026-11-20')
assert.equal(mood.shiftDate('2024-03-01', -1), '2024-02-29')
assert.equal(mood.recentYearRange('2026-11-21').start, '2025-11-22')
assert.equal(mood.recentYearRange('2024-02-29').start, '2023-03-01')
const week = Array.from({ length: 7 }, (_, index) => ({ date: mood.shiftDate('2026-11-16', index), mood: '很开心' }))
assert.equal(mood.buildCompletedWeeks(week).length, 1)
assert.equal(mood.buildCompletedWeeks(week.slice(0, 6)).length, 0)
assert.equal(mood.buildCompletedWeeks([...week.slice(0, 6), week[0]]).length, 0)

let openid = 'owner-a'
let failWrite = false
let sequence = 0
const stores = { users: [{ _id: 'profile-a', _openid: openid, username: '用户甲', avatar: '' },
    { _id: 'profile-b', _openid: 'owner-b', username: '用户乙', avatar: '' }], moods: [], diaries: [], tasks: [] }
const local = new Map([['currentUser', { _id: 'profile-a' }]])
const clone = value => JSON.parse(JSON.stringify(value))
const queryLog = []
const command = {
    gte: value => ({ lower: value, and(other) { return { lower: value, ...other } } }),
    lt: value => ({ upper: value }), set: value => ({ replace: clone(value) })
}
function matches(record, condition) {
    return Object.entries(condition).every(([key, value]) => {
        if (value === '{openid}') return record[key] === openid
        if (typeof value === 'object') return (!value.lower || record[key] >= value.lower) && (!value.upper || record[key] < value.upper)
        return record[key] === value
    })
}
function materialize(data) {
    return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, value && typeof value === 'object' && 'replace' in value ? clone(value.replace) : value]))
}
function collection(name, condition = {}, max = Infinity) {
    return {
        where(next) { return collection(name, next, max) },
        field() { return this }, orderBy() { return this }, limit(value) { return collection(name, condition, value) },
        async get() {
            queryLog.push({ name, condition: clone(condition) })
            assert.equal(condition._openid, '{openid}', '所有读取必须显式限制微信归属')
            return { data: clone(stores[name].filter(row => matches(row, condition)).sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, max)) }
        },
        async add({ data }) {
            if (failWrite) throw new Error('网络断开')
            assert.ok(!('_openid' in data), '客户端不能提交归属身份')
            if (stores[name].some(row => row._openid === openid && row.date === data.date)) throw new Error('E11000 duplicate')
            const record = { ...clone(data), _id: String(++sequence), _openid: openid }
            stores[name].push(record)
            return { _id: record._id }
        },
        doc(id) { return {
            async update({ data }) {
                if (failWrite) throw new Error('网络断开')
                const record = stores[name].find(row => row._id === id && row._openid === openid)
                if (record) Object.assign(record, materialize(data))
                return { stats: { updated: record ? 1 : 0 } }
            },
            async remove() {
                const index = stores[name].findIndex(row => row._id === id && row._openid === openid)
                if (index >= 0) stores[name].splice(index, 1)
                return { stats: { removed: index >= 0 ? 1 : 0 } }
            }
        } }
    }
}
const database = { command, serverDate: () => 'server-time', collection }
const globals = {
    wx: { cloud: { init() {}, database: () => database } },
    uni: { getStorageSync: key => local.get(key), setStorageSync: (key, value) => local.set(key, clone(value)), removeStorageSync: key => local.delete(key) }
}
const cloud = loadModule('utils/cloud.js', globals, {
    '@/utils/mood': mood,
    '@/config/cloud.js': { CLOUD_ENV_ID: 'test-env', USERS_COLLECTION: 'users', TASKS_COLLECTION: 'tasks', MOODS_COLLECTION: 'moods', DIARIES_COLLECTION: 'diaries' }
})

async function verify() {
    assert.equal((await cloud.loadCurrentUser())._id, 'profile-a')
    assert.equal(await cloud.loginUser('用户乙'), null)
    const today = mood.beijingDate()
    await cloud.saveMoodToCloud(today, '很开心')
    await cloud.saveMoodToCloud(today, '不高兴')
    assert.equal(stores.moods.length, 1)
    assert.equal((await cloud.fetchMoodData()).dailyRecords[0].mood, '不高兴')
    failWrite = true
    await assert.rejects(cloud.saveMoodToCloud(today, '就这样'), /网络断开/)
    assert.equal(stores.moods[0].mood, '不高兴')
    failWrite = false
    // 超过默认页数的数据，验证范围边界及游标不漏、不重复。
    for (let offset = 1; offset < 65; offset++) stores.moods.push({ _id: 'history-' + offset, _openid: openid, date: mood.shiftDate(today, -offset), mood: '很开心' })
    const history = (await cloud.fetchMoodData(mood.shiftDate(today, -59), today)).dailyRecords
    assert.equal(history.length, 60)
    assert.equal(new Set(history.map(row => row.date)).size, 60)
    assert.ok(history.every(row => row.date >= mood.shiftDate(today, -59) && row.date <= today))
    await cloud.saveDiaryToCloud(today, { food: '原始内容', thoughts: '长内容'.repeat(2000), deletedPapers: ['gratitude'] })
    await cloud.saveDiaryToCloud(today, { food: '', timelineNodes: [{ id: 'one', text: '时间轴', showTime: false, time: '09:00' }] })
    const note = (await cloud.fetchDiaryPage()).entries[0].note
    assert.equal(note.food, '')
    assert.equal(note.thoughts, undefined, '整篇更新必须移除已经删除的旧内容')
    assert.equal(note.timelineNodes[0].text, '时间轴')
    const imported = await cloud.importLocalDiaries({ [today]: { food: '不可覆盖' }, '2026-01-01': { gratitude: '旧数据' } })
    assert.equal(imported.imported, 1)
    assert.equal(imported.skipped, 1)
    assert.equal((await cloud.fetchDiaryPage()).entries.find(row => row.date === today).note.food, '')
    await cloud.deleteDiaryFromCloud(today)
    await cloud.deleteDiaryFromCloud(today)
    assert.equal(stores.diaries.length, 1)
    openid = 'owner-b'
    local.set('currentUser', { _id: 'profile-b' })
    assert.equal((await cloud.loadCurrentUser())._id, 'profile-b')
    assert.equal((await cloud.fetchMoodData()).dailyRecords.length, 0)
    assert.equal((await cloud.fetchDiaryPage()).entries.length, 0)
    await cloud.saveMoodToCloud(today, '就这样')
    assert.equal(stores.moods.filter(row => row.date === today).length, 2)
    local.set('isLoggedOut', true)
    await assert.rejects(cloud.saveDiaryToCloud(today, {}), /登录/)
    console.log('PASS: 北京日期、闰年、年度范围、周报去重、本人查询、同日更新、失败保留、范围分页、日记新增编辑删除导入、账号隔离和退出限制')
}
verify().catch(error => { console.error(error); process.exitCode = 1 })
