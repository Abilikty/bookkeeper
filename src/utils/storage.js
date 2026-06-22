/**
 * 本地缓存工具 — 基于 AsyncStorage
 * 用于缓存最近账单、用户设置等
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  RECENT_EXPENSES: '@bk_recent_expenses',
  SERVER_URL: '@bk_server_url',
  USER_SETTINGS: '@bk_user_settings',
};

/** 缓存最近账单 (最多50条) */
export async function cacheRecentExpenses(expenses) {
  try {
    await AsyncStorage.setItem(KEYS.RECENT_EXPENSES, JSON.stringify(expenses));
  } catch (e) {
    console.warn('缓存失败:', e);
  }
}

/** 读取缓存的最近账单 */
export async function getCachedExpenses() {
  try {
    const data = await AsyncStorage.getItem(KEYS.RECENT_EXPENSES);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

/** 保存服务器地址 */
export async function setServerUrl(url) {
  await AsyncStorage.setItem(KEYS.SERVER_URL, url);
}

/** 读取服务器地址 */
export async function getServerUrl() {
  return await AsyncStorage.getItem(KEYS.SERVER_URL);
}

/** 清除所有缓存 */
export async function clearCache() {
  const keys = await AsyncStorage.getAllKeys();
  const ourKeys = keys.filter(k => k.startsWith('@bk_'));
  await AsyncStorage.multiRemove(ourKeys);
}
