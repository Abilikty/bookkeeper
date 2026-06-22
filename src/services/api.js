/**
 * API 服务层 — 与后端通信
 *
 * 默认定向到 localhost:3000 (开发时)
 * 真机测试时改成电脑的局域网IP，如: http://192.168.1.100:3000
 */

// ⚠ 真机测试时修改为你的电脑IP
const BASE_URL = 'http://10.150.200.97:3000';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const config = {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `请求失败 (${response.status})`);
    }

    return data;
  } catch (err) {
    if (err.message === 'Network request failed') {
      throw new Error('无法连接服务器，请检查网络和后端是否启动');
    }
    throw err;
  }
}

/** AI解析 — 发送文字，返回识别结果 */
export async function parseExpense(text) {
  const result = await request('/api/expenses/parse', {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
  return result.data;
}

/** 确认并保存账单 */
export async function saveExpense(expenseData) {
  const result = await request('/api/expenses', {
    method: 'POST',
    body: JSON.stringify(expenseData),
  });
  return result;
}

/** 编辑已保存的账单 */
export async function updateExpense(id, expenseData) {
  const result = await request(`/api/expenses/${id}`, {
    method: 'PUT',
    body: JSON.stringify(expenseData),
  });
  return result;
}

/** 获取账单列表 */
export async function getExpenses({ page = 1, limit = 20, category } = {}) {
  let query = `?page=${page}&limit=${limit}`;
  if (category) query += `&category=${encodeURIComponent(category)}`;
  return await request(`/api/expenses${query}`);
}

/** 获取单条账单 */
export async function getExpenseById(id) {
  const result = await request(`/api/expenses/${id}`);
  return result.data;
}

/** 删除账单 */
export async function deleteExpense(id) {
  return await request(`/api/expenses/${id}`, { method: 'DELETE' });
}

/** 月度统计 */
export async function getMonthlyStats(year, month) {
  const result = await request(
    `/api/expenses/stats/monthly?year=${year}&month=${month}`
  );
  return result.data;
}

/** 每日统计 (日历) */
export async function getDailyStats(year, month, currency) {
  const ccy = currency || 'CNY';
  const result = await request(
    `/api/expenses/stats/daily?year=${year}&month=${month}&currency=${ccy}`
  );
  return result.data;
}
