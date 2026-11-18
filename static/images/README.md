# Q式小管家｜暖系手绘 UI 素材包

本素材包按当前确认的暖色手绘方向整理，包含粉色外套女孩、黄色毛衣交叠坐姿小熊、页面背景、心情/天气图标、日记元素和装饰贴纸。所有 PNG 均已单独导出，无设计板水印。

> 说明：原 UI 设计板是一张扁平合成图，并非分层源文件，因此无法从设计板中无损取回原始图层。本包中的角色和图标是依据当前设计风格重新整理/重绘后裁切的独立素材，不是从整张手机截图里粗暴截取；背景图来自配套背景素材板并已放大整理。

## 目录

- `characters/`：女孩、小熊角色透明 PNG。
- `backgrounds/`：首页、好友、心情小屋、日记、转盘、我的/设置、年度周报等背景。
- `icons/`：三种心情、天气、礼物、文件夹、日历、书本等图标。
- `diary/`：日记本打开框、封面、便签。
- `decorations/`：花草、窗户、台灯、地毯、云朵、书签等装饰。

## 页面背景建议映射

| 页面 | 建议素材 |
|---|---|
| 首页 / 心情助手 | `backgrounds/bg-home.png` |
| 年度心情周报 / 历史周报 | `backgrounds/bg-annual-report.png` |
| 好友互动 | `backgrounds/bg-friends.png` |
| 日记日期桌面 | `backgrounds/bg-diary-desktop.png` |
| 日记本阅读 | `backgrounds/bg-diary-paper.png` + `diary/open-book-frame.png` |
| 单格日记编辑 | `backgrounds/bg-diary-editor.png` |
| 心情小屋 | `backgrounds/bg-mood-room.png` |
| 幸运转盘 | `backgrounds/bg-roulette.png` |
| 我的 / 编辑资料 / 设置 | `backgrounds/bg-profile-settings.png` |

## uni-app 使用示例

将本目录复制到项目 `static/assets/` 下，然后：

```vue
<template>
  <view class="page mood-page">
    <image class="character" src="/static/assets/characters/girl-main.png" mode="widthFix" />
    <image class="teddy" src="/static/assets/characters/teddy-yellow-cross-legged.png" mode="widthFix" />
  </view>
</template>

<style lang="scss" scoped>
.mood-page {
  min-height: 100vh;
  background: #fff4ee url('/static/assets/backgrounds/bg-common-warm.png') center / cover no-repeat;
}
.character { width: 220rpx; }
.teddy { width: 190rpx; }
</style>
```

## 不建议做成图片的内容

按钮文字、标题、输入框、卡片、圆角、分割线、滚动容器、底部导航的点击状态，以及年度周报的文字列表，建议用 Vue + SCSS 实现。导航与常规操作图标也可用项目已有的 `uni-icons` / uview-plus 图标，避免把文字和交互烘焙进 PNG。

## 注意

- 透明角色和装饰为 PNG，可直接叠加在页面上。
- 背景图是氛围图，不包含页面标题、业务数据或可交互控件。
- 小程序中建议按实际设备比例设置 `background-size: cover`，并在 `background-color` 设置相近底色。
- 素材是为本项目视觉方向制作的 AI 生成插画资源；公开发布前仍建议检查微信小程序内容规范和项目自身的素材授权要求。
