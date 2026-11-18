<script>
export default {
    onLaunch: function() {
        console.log('App Launch');
        // 初始化本地存储，防止后续调用报错
        if (!uni.getStorageSync('moodRecords')) {
            uni.setStorageSync('moodRecords', []);
        }
        if (!uni.getStorageSync('remindTime')) {
            uni.setStorageSync('remindTime', '08:00');
        }
        if (!uni.getStorageSync('isRemindOpen')) {
            uni.setStorageSync('isRemindOpen', false);
        }
    },
    onShow: function() {
        console.log('App Show');
    },
    onHide: function() {
        console.log('App Hide');
    }
}
</script>

<style lang="scss">
@import "uview-plus/index.scss";

page {
    background-color: $q-color-cream;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    color: $q-color-text;
    padding-bottom: env(safe-area-inset-bottom);
}

view, text, button {
    box-sizing: border-box;
}
</style>
