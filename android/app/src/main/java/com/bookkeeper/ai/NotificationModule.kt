package com.bookkeeper.ai

import android.content.Intent
import android.provider.Settings
import com.facebook.react.bridge.*

class NotificationModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "NotificationModule"

    override fun initialize() {
        super.initialize()
        PaymentAccessibilityService.reactContext = reactApplicationContext
    }

    @ReactMethod
    fun isNotificationListenerEnabled(promise: Promise) {
        try {
            val enabled = isAccessibilityServiceEnabled()
            promise.resolve(enabled)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun openNotificationSettings(promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactApplicationContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    private fun isAccessibilityServiceEnabled(): Boolean {
        val service = "${reactApplicationContext.packageName}/.PaymentAccessibilityService"
        val enabledServices = Settings.Secure.getString(
            reactApplicationContext.contentResolver,
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        ) ?: return false
        return enabledServices.contains(service) || enabledServices.contains("PaymentAccessibilityService")
    }
}
