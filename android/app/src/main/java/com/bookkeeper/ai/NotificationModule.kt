package com.bookkeeper.ai

import com.facebook.react.bridge.*

class NotificationModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "NotificationModule"

    override fun initialize() {
        super.initialize()
        PaymentNotificationService.reactContext = reactApplicationContext
    }

    @ReactMethod
    fun isNotificationListenerEnabled(promise: Promise) {
        try {
            val enabled = PaymentNotificationService.isConnected
            promise.resolve(enabled)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun openNotificationSettings(promise: Promise) {
        try {
            val intent = android.content.Intent("android.settings.NOTIFICATION_LISTENER_SETTINGS")
            intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
            reactApplicationContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }
}
