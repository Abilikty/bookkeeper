/**
 * 本地数据服务层 —— 替换远程 API 调用
 *
 * 所有功能离线运行：
 * - AI 解析由本地规则引擎完成
 * - 数据存储于手机 SQLite
 * - 汇率换算本地计算
 *
 * 接口签名与之前完全一致，屏幕代码无需改动
 */

import { parseExpenseText } from './parser';
import { calculate, verify } from './splitter';
import { convert } from './rates';
import {
  createExpense as dbCreate,
  updateExpense as dbUpdate,
  getExpenseById as dbGetById,
  getExpenses as dbGetList,
  deleteExpense as dbDelete,
  getMonthlyStats as dbMonthlyStats,
  getDailyStats as dbDailyStats,
} from './db';

/** AI解析 — 本地规则引擎（毫秒级响应） */
export async function parseExpense(text) {
  if (!text || !text.trim()) throw new Error('请输入消费描述');
  const result = parseExpenseText(text.trim());
  return result;
}

/** 确认并保存账单 */
export async function saveExpense(expenseData) {
  const { raw_text, amount, item, category, split_type, splits } = expenseData;
  if (!amount || amount <= 0) throw new Error('金额必须大于0');
  if (!splits || splits.length === 0) throw new Error('请提供分摊明细');
  if (!verify(splits, amount)) throw new Error('分摊金额与总金额不符');

  const currency = expenseData.currency || 'CNY';

  // 外币 → CNY 换算
  let cnyAmount = amount;
  let cnySplits = splits;
  let originalAmount = null;
  let originalCurrency = null;

  if (currency !== 'CNY') {
    cnyAmount = convert(amount, currency, 'CNY');
    cnySplits = splits.map(s => ({
      ...s,
      share_amount: convert(s.share_amount, currency, 'CNY'),
    }));
    originalAmount = amount;
    originalCurrency = currency;
  }

  const expense = await dbCreate({
    raw_text: raw_text || '', amount: cnyAmount, item: item || '未知',
    category: category || '其他', split_type: split_type || 'equal',
    splits: cnySplits, currency: 'CNY',
    original_amount: originalAmount, original_currency: originalCurrency,
  });

  return { success: true, data: expense };
}

/** 编辑已保存的账单 */
export async function updateExpense(id, expenseData) {
  const { raw_text, amount, item, category, split_type, splits } = expenseData;
  if (!amount || amount <= 0) throw new Error('金额必须大于0');
  if (!splits || splits.length === 0) throw new Error('请提供分摊明细');
  if (!verify(splits, amount)) throw new Error('分摊金额与总金额不符');

  const updated = await dbUpdate(id, {
    raw_text, amount, item: item || '未知',
    category: category || '其他', split_type: split_type || 'equal',
    splits, currency: 'CNY',
    original_amount: null, original_currency: null,
  });

  return { success: true, data: updated };
}

/** 获取账单列表 */
export async function getExpenses({ page = 1, limit = 20, category } = {}) {
  return await dbGetList({ page, limit, category });
}

/** 获取单条账单 */
export async function getExpenseById(id) {
  return await dbGetById(id);
}

/** 删除账单 */
export async function deleteExpense(id) {
  const ok = await dbDelete(id);
  if (!ok) throw new Error('账单不存在或已删除');
  return { success: true, message: '已删除' };
}

/** 月度统计 */
export async function getMonthlyStats(year, month) {
  return await dbMonthlyStats(year, month);
}

/** 每日统计 (日历) */
export async function getDailyStats(year, month, currency) {
  const data = await dbDailyStats(year, month);
  // 按目标货币换算
  if (currency && currency !== 'CNY') {
    const conv = v => convert(v, 'CNY', currency);
    data.daily = data.daily.map(d => ({ ...d, total: conv(d.total) }));
    data.monthTotal = conv(data.monthTotal);
  }
  data.displayCurrency = currency || 'CNY';
  return data;
}
