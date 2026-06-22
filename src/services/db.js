/**
 * 本地 SQLite 数据库 — 基于 expo-sqlite
 * 数据完全存储在手机上，无需网络
 */
import * as SQLite from 'expo-sqlite';

let db = null;

async function getDB() {
  if (db) return db;
  db = await SQLite.openDatabaseAsync('bookkeeper.db');
  await db.execAsync('PRAGMA foreign_keys = ON');
  await initTables();
  return db;
}

async function initTables() {
  const d = await getDB();
  await d.execAsync(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      raw_text TEXT NOT NULL,
      amount REAL NOT NULL,
      item TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT '其他',
      split_type TEXT NOT NULL DEFAULT 'equal',
      currency TEXT NOT NULL DEFAULT 'CNY',
      original_amount REAL,
      original_currency TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
    CREATE TABLE IF NOT EXISTS expense_splits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      expense_id INTEGER NOT NULL,
      person TEXT NOT NULL,
      share_amount REAL NOT NULL,
      share_ratio REAL
    );
  `);
}

export async function createExpense({ raw_text, amount, item, category, split_type, splits, currency, original_amount, original_currency }) {
  const d = await getDB();
  const result = await d.runAsync(
    `INSERT INTO expenses (raw_text, amount, item, category, split_type, currency, original_amount, original_currency)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [raw_text, amount, item, category, split_type, currency || 'CNY', original_amount || null, original_currency || null]
  );
  const expenseId = result.lastInsertRowId;
  for (const split of splits) {
    await d.runAsync(
      `INSERT INTO expense_splits (expense_id, person, share_amount, share_ratio) VALUES (?, ?, ?, ?)`,
      [expenseId, split.person, split.share_amount, split.share_ratio || null]
    );
  }
  return getExpenseById(expenseId);
}

export async function updateExpense(id, { raw_text, amount, item, category, split_type, splits, currency, original_amount, original_currency }) {
  const d = await getDB();
  await d.runAsync(
    `UPDATE expenses SET raw_text=?, amount=?, item=?, category=?, split_type=?, currency=?, original_amount=?, original_currency=?,
     updated_at=datetime('now','localtime') WHERE id=?`,
    [raw_text, amount, item, category, split_type, currency || 'CNY', original_amount || null, original_currency || null, id]
  );
  await d.runAsync('DELETE FROM expense_splits WHERE expense_id = ?', [id]);
  for (const split of splits) {
    await d.runAsync(
      `INSERT INTO expense_splits (expense_id, person, share_amount, share_ratio) VALUES (?, ?, ?, ?)`,
      [id, split.person, split.share_amount, split.share_ratio || null]
    );
  }
  return getExpenseById(id);
}

export async function getExpenseById(id) {
  const d = await getDB();
  const expense = await d.getFirstAsync('SELECT * FROM expenses WHERE id = ?', [id]);
  if (!expense) return null;
  const splits = await d.getAllAsync('SELECT * FROM expense_splits WHERE expense_id = ?', [id]);
  return { ...expense, splits };
}

export async function getExpenses({ page = 1, limit = 20, category } = {}) {
  const d = await getDB();
  const offset = (page - 1) * limit;
  let whereSQL = '';
  const args = [];
  if (category) { whereSQL = 'WHERE category = ?'; args.push(category); }

  const totalRow = await d.getFirstAsync(`SELECT COUNT(*) as total FROM expenses ${whereSQL}`, args);
  const total = totalRow?.total || 0;

  const rows = await d.getAllAsync(
    `SELECT * FROM expenses ${whereSQL} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...args, limit, offset]
  );

  const expenses = [];
  for (const row of rows) {
    const splits = await d.getAllAsync('SELECT * FROM expense_splits WHERE expense_id = ?', [row.id]);
    expenses.push({ ...row, splits });
  }
  return { data: expenses, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function deleteExpense(id) {
  const d = await getDB();
  await d.runAsync('DELETE FROM expense_splits WHERE expense_id = ?', [id]);
  const result = await d.runAsync('DELETE FROM expenses WHERE id = ?', [id]);
  return result.changes > 0;
}

export async function getMonthlyStats(year, month) {
  const d = await getDB();
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = `${year}-${String(month).padStart(2, '0')}-31`;

  const catRows = await d.getAllAsync(
    `SELECT e.category, COALESCE(SUM(s.share_amount),0) as total, COUNT(DISTINCT e.id) as count
     FROM expenses e JOIN expense_splits s ON s.expense_id=e.id AND s.person='我'
     WHERE e.created_at>=? AND e.created_at<=? GROUP BY e.category ORDER BY total DESC`,
    [startDate, endDate]
  );

  const totalRow = await d.getFirstAsync(
    `SELECT COALESCE(SUM(s.share_amount),0) as total, COUNT(DISTINCT e.id) as count
     FROM expenses e JOIN expense_splits s ON s.expense_id=e.id AND s.person='我'
     WHERE e.created_at>=? AND e.created_at<=?`,
    [startDate, endDate]
  );

  const today = new Date();
  const daysInMonth = new Date(year, month, 0).getDate();
  let daysElapsed = daysInMonth;
  if (today.getFullYear() === year && today.getMonth() + 1 === month) daysElapsed = today.getDate();

  return {
    year, month,
    totalAmount: totalRow?.total || 0,
    totalCount: totalRow?.count || 0,
    dailyAverage: daysElapsed > 0 ? (totalRow?.total || 0) / daysElapsed : 0,
    categories: catRows,
  };
}

export async function getDailyStats(year, month) {
  const d = await getDB();
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = `${year}-${String(month).padStart(2, '0')}-31`;
  const daysInMonth = new Date(year, month, 0).getDate();

  const rows = await d.getAllAsync(
    `SELECT date(e.created_at) as day, COALESCE(SUM(s.share_amount),0) as total, COUNT(DISTINCT e.id) as count
     FROM expenses e JOIN expense_splits s ON s.expense_id=e.id AND s.person='我'
     WHERE e.created_at>=? AND e.created_at<=? GROUP BY day ORDER BY day`,
    [startDate, endDate]
  );

  const dayMap = {};
  for (const row of rows) dayMap[row.day] = { total: row.total, count: row.count };

  const daily = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    daily.push({ day: key, total: dayMap[key]?.total || 0, count: dayMap[key]?.count || 0 });
  }

  const monthTotal = daily.reduce((s, x) => s + x.total, 0);
  return { year, month, daily, monthTotal };
}
