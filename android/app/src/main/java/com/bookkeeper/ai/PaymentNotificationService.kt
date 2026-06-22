package com.bookkeeper.ai

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.bridge.ReactContext

class PaymentNotificationService : NotificationListenerService() {

    companion object {
        var reactContext: ReactContext? = null
        var isConnected = false

        // 微信/支付宝支付通知特征
        private val PAYMENT_PATTERNS = listOf(
            Regex("""微信支付\s*[¥￥]?\s*(\d+\.?\d*)"""),
            Regex("""支付成功\s*[¥￥]?\s*(\d+\.?\d*)"""),
            Regex("""支付宝.*[¥￥]?\s*(\d+\.?\d*)"""),
            Regex("""消费\s*[¥￥]?\s*(\d+\.?\d*)"""),
            Regex("""付款\s*[¥￥]?\s*(\d+\.?\d*)"""),
        )

        private val RECEIVER_PATTERNS = listOf(
            Regex("""收款方[：:]\s*(.+)"""),
            Regex("""商户[：:]\s*(.+)"""),
            Regex("""(.+)收款\s*[¥￥]?"""),
        )
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        super.onNotificationPosted(sbn)
        if (sbn == null) return

        try {
            val extras = sbn.notification.extras
            val title = extras.getString("android.title") ?: ""
            val text = extras.getString("android.text") ?: ""
            val ticker = extras.getString("android.tickerText") ?: ""
            val fullText = "$title $text $ticker"

            // 尝试匹配支付信息
            val amount = extractAmount(fullText)
            if (amount > 0) {
                val receiver = extractReceiver(fullText)
                Log.d("PaymentNotif", "检测到支付: ¥$amount, 收款方: $receiver")

                // 发送事件到 React Native
                sendEvent("onPaymentNotification", mapOf(
                    "amount" to amount,
                    "receiver" to receiver,
                    "raw" to "$title $text"
                ))
            }
        } catch (e: Exception) {
            Log.e("PaymentNotif", "处理通知失败", e)
        }
    }

    override fun onNotificationRemoved(sbn: StatusBarNotification?) {
        super.onNotificationRemoved(sbn)
    }

    override fun onListenerConnected() {
        super.onListenerConnected()
        isConnected = true
        Log.d("PaymentNotif", "通知监听服务已连接")
    }

    override fun onListenerDisconnected() {
        super.onListenerDisconnected()
        isConnected = false
    }

    private fun extractAmount(text: String): Double {
        for (pattern in PAYMENT_PATTERNS) {
            val match = pattern.find(text)
            if (match != null) {
                return match.groupValues[1].toDoubleOrNull() ?: 0.0
            }
        }
        return 0.0
    }

    private fun extractReceiver(text: String): String {
        for (pattern in RECEIVER_PATTERNS) {
            val match = pattern.find(text)
            if (match != null) {
                return match.groupValues[1].trim().take(20)
            }
        }
        return "未知商户"
    }

    private fun sendEvent(eventName: String, params: Map<String, Any>) {
        val ctx = reactContext ?: return
        try {
            ctx.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, params)
        } catch (e: Exception) {
            Log.e("PaymentNotif", "发送事件失败", e)
        }
    }
}
