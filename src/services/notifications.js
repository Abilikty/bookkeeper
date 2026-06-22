/**
 * 通知监听桥接 — 连接原生 PaymentNotificationService 到 JS
 *
 * 用法：
 *   import { startNotificationListener, onPaymentDetected } from './notifications';
 *   onPaymentDetected(({ amount, receiver, raw }) => { ... });
 */

import { NativeModules, NativeEventEmitter, Platform, Alert } from 'react-native';

const { NotificationModule } = NativeModules;
const emitter = NotificationModule
  ? new NativeEventEmitter(NotificationModule)
  : null;

/**
 * 监听支付通知
 * @param {function} callback - ({ amount, receiver, raw }) => {}
 * @returns {function} unsubscribe
 */
export function onPaymentDetected(callback) {
  if (!emitter || Platform.OS !== 'android') {
    console.warn('通知监听仅支持 Android');
    return () => {};
  }

  const subscription = emitter.addListener('onPaymentNotification', callback);
  return () => subscription.remove();
}

/**
 * 检查通知监听权限是否已开启
 */
export async function isNotificationEnabled() {
  if (!NotificationModule) return false;
  try {
    return await NotificationModule.isNotificationListenerEnabled();
  } catch {
    return false;
  }
}

/**
 * 打开系统通知监听设置页面
 */
export async function openNotificationSettings() {
  if (!NotificationModule) {
    Alert.alert('提示', '当前设备不支持通知监听');
    return;
  }
  try {
    await NotificationModule.openNotificationSettings();
  } catch (e) {
    Alert.alert('提示', '请前往 设置 → 辅助功能 → 通知使用权 开启 AI记账');
  }
}
