package com.bookkeeper.ai

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import com.facebook.react.bridge.ReactContext
import com.facebook.react.modules.core.DeviceEventManagerModule

class PaymentAccessibilityService : AccessibilityService() {

    companion object {
        var reactContext: ReactContext? = null
        var instance: PaymentAccessibilityService? = null

        // 微信/支付宝支付成功页面特征
        private val PAYMENT_REGEX = listOf(
            Regex("""支付成功[.\s]*[¥￥]\s*(\d+\.?\d*)"""),
            Regex("""付款成功[.\s]*[¥￥]\s*(\d+\.?\d*)"""),
            Regex("""[¥￥]\s*(\d+\.?\d*)"""),
            Regex("""微信支付[.\s]*[¥￥]\s*(\d+\.?\d*)"""),
        )

        private val RECEIVER_REGEX = listOf(
            Regex("""收款方[：:\s]*(.+)"""),
            Regex("""商户[：:\s]*(.+)"""),
            Regex("""商品说明[：:\s]*(.+)"""),
        )
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return
        instance = this

        // 只关注窗口内容变化和文字变化
        if (event.eventType != AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED
            && event.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return

        val text = captureScreenText(event)
        if (text.isBlank()) return

        Log.d("PaymentA11y", "检测屏幕文字: ${text.take(100)}")

        // 检查是否包含支付相关关键词
        if (!text.contains("支付") && !text.contains("付款")) return

        val amount = extractAmount(text)
        if (amount <= 0) return

        val receiver = extractReceiver(text)

        Log.d("PaymentA11y", "💳 检测到支付: ¥$amount, $receiver")

        // 防重复：同一笔支付5秒内不重复触发
        val now = System.currentTimeMillis()
        if (now - lastDetected < 5000 && lastAmount == amount) return
        lastDetected = now
        lastAmount = amount

        sendEvent("onPaymentDetected", mapOf(
            "amount" to amount,
            "receiver" to receiver,
            "raw" to text.take(200)
        ))
    }

    override fun onInterrupt() {}

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
        Log.d("PaymentA11y", "✅ 无障碍服务已连接")

        // 配置：只监听微信和支付宝
        val info = AccessibilityServiceInfo().apply {
            eventTypes = AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED or
                        AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED
            feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC
            notificationTimeout = 100
            // 可以在这里限制只监听特定App，但为了兼容性先监听所有
        }
        serviceInfo = info
    }

    override fun onDestroy() {
        super.onDestroy()
        instance = null
    }

    private fun captureScreenText(event: AccessibilityEvent): String {
        val sb = StringBuilder()
        val source = event.source ?: return ""
        try {
            // 遍历节点树收集文字
            collectText(source, sb, 0, 20)
        } catch (e: Exception) {
            Log.e("PaymentA11y", "读取屏幕文字失败", e)
        } finally {
            source.recycle()
        }
        return sb.toString()
    }

    private fun collectText(node: android.view.accessibility.AccessibilityNodeInfo, sb: StringBuilder, depth: Int, maxDepth: Int) {
        if (depth > maxDepth) return
        val text = node.text?.toString() ?: ""
        val contentDesc = node.contentDescription?.toString() ?: ""
        if (text.isNotBlank()) sb.append(text).append(" ")
        if (contentDesc.isNotBlank()) sb.append(contentDesc).append(" ")

        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            collectText(child, sb, depth + 1, maxDepth)
            child.recycle()
        }
    }

    private fun extractAmount(text: String): Double {
        // 优先匹配 "支付成功 ¥XX.XX"
        for (regex in PAYMENT_REGEX) {
            val match = regex.find(text)
            if (match != null) {
                val amt = match.groupValues[1].toDoubleOrNull()
                if (amt != null && amt > 0) return amt
            }
        }
        return 0.0
    }

    private fun extractReceiver(text: String): String {
        for (regex in RECEIVER_REGEX) {
            val match = regex.find(text)
            if (match != null) {
                return match.groupValues[1].trim().take(30)
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
            Log.e("PaymentA11y", "发送事件失败", e)
        }
    }

    private var lastDetected: Long = 0
    private var lastAmount: Double = 0.0
}
