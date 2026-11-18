# services

服务层按数据来源拆分：`local-storage.ts` 负责兼容现有本地键，云端服务应继续通过 `utils/cloud.js` 访问。

后续新增云数据服务时，先在 `utils/cloud.js` 暴露稳定的 JS API，再由这里以 `.ts` 做类型化适配；本次不迁移既有云调用，也不改变云函数运行环境。
