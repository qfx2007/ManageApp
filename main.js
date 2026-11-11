import App from './App'

// #ifndef VUE3
import Vue from 'vue'
import './uni.promisify.adaptor'
Vue.config.productionTip = false
App.mpType = 'app'
const app = new Vue({
  ...App
})
app.$mount()
// #endif

// #ifdef VUE3
import { createSSRApp } from 'vue'
import { mount$u, mixin } from 'uview-plus'

// #ifdef H5
import UpTabs from 'uview-plus/components/u-tabs/u-tabs.vue'
import UpEmpty from 'uview-plus/components/u-empty/u-empty.vue'
import UpCheckbox from 'uview-plus/components/u-checkbox/u-checkbox.vue'
import UpIcon from 'uview-plus/components/u-icon/u-icon.vue'
import UpTag from 'uview-plus/components/u-tag/u-tag.vue'
import UpCell from 'uview-plus/components/u-cell/u-cell.vue'
import UpSwipeAction from 'uview-plus/components/u-swipe-action/u-swipe-action.vue'
import UpInput from 'uview-plus/components/u-input/u-input.vue'
import UpDatetimePicker from 'uview-plus/components/u-datetime-picker/u-datetime-picker.vue'
import UpPicker from 'uview-plus/components/u-picker/u-picker.vue'
import UpRadioGroup from 'uview-plus/components/u-radio-group/u-radio-group.vue'
import UpRadio from 'uview-plus/components/u-radio/u-radio.vue'
import UpButton from 'uview-plus/components/u-button/u-button.vue'
import UpPopup from 'uview-plus/components/u-popup/u-popup.vue'
// #endif

export function createApp() {
  const app = createSSRApp(App)

  // #ifdef H5
  app.component('up-tabs', UpTabs)
  app.component('up-empty', UpEmpty)
  app.component('up-checkbox', UpCheckbox)
  app.component('up-icon', UpIcon)
  app.component('up-tag', UpTag)
  app.component('up-cell', UpCell)
  app.component('up-swipe-action', UpSwipeAction)
  app.component('up-input', UpInput)
  app.component('up-datetime-picker', UpDatetimePicker)
  app.component('up-picker', UpPicker)
  app.component('up-radio-group', UpRadioGroup)
  app.component('up-radio', UpRadio)
  app.component('up-button', UpButton)
  app.component('up-popup', UpPopup)
  // #endif

  mount$u()
  app.mixin(mixin)

  return { app }
}
// #endif