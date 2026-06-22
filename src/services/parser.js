/**
 * 本地 AI 记账解析引擎
 * 从服务器 coze.js 移植 —— 完全离线可用
 */
import { calculate } from './splitter';

const CURRENCY_MAP = [
  { code: 'CNY', keys: ['元', '块', '¥', 'yuan', 'rmb', '人民币'] },
  { code: 'USD', keys: ['$', 'usd', 'dollar', 'dollars', '美元', '美金'] },
  { code: 'EUR', keys: ['€', 'eur', 'euro', 'euros', '欧元'] },
  { code: 'GBP', keys: ['£', 'gbp', 'pound', 'pounds', '英镑'] },
  { code: 'JPY', keys: ['jpy', 'yen', '日元', '円'] },
  { code: 'HKD', keys: ['hkd', '港币', '港元'] },
  { code: 'KRW', keys: ['krw', 'won', '韩元'] },
];

function detectCurrency(text) {
  const lower = text.toLowerCase();
  let best = null, bestLen = 0;
  for (const c of CURRENCY_MAP) {
    for (const k of c.keys) {
      if (lower.includes(k.toLowerCase()) && k.length > bestLen) {
        best = c.code;
        bestLen = k.length;
      }
    }
  }
  return best || 'CNY';
}

function extractAmount(text) {
  const allKeys = CURRENCY_MAP.flatMap(c => c.keys);

  // 策略1: 符号在前
  for (const kw of allKeys) {
    const re = new RegExp(kw.replace(/[.*+?^${}()|[\]\\$]/g, '\\$&') + '\\s*(\\d+(?:\\.\\d+)?)', 'gi');
    const m = [...text.matchAll(re)];
    if (m.length > 0) return parseFloat(m[m.length - 1][1]);
  }

  // 策略2: 数字后跟货币关键字
  for (const kw of allKeys) {
    const re = new RegExp('(\\d+(?:\\.\\d+)?)\\s*' + kw.replace(/[.*+?^${}()|[\]\\$]/g, '\\$&'), 'gi');
    const m = [...text.matchAll(re)];
    if (m.length > 0) return parseFloat(m[m.length - 1][1]);
  }

  // 策略3: 取最大数字
  const allNums = [...text.matchAll(/\d+(?:\.\d+)?/g)].map(m => parseFloat(m[0]));
  if (allNums.length > 0) {
    const candidates = allNums.filter(n => n > 10);
    return candidates.length > 0 ? Math.max(...candidates) : Math.max(...allNums);
  }

  return 0;
}

function extractPeople(text) {
  let people = ['我'];
  let splitType = 'single';

  // AA模式
  if (/AA|aa|均摊|分摊|平分|一人一半|对半/.test(text)) {
    splitType = 'equal';
    const numPeopleMatch = text.match(/([两二三四五六七八九十\d]+)\s*人/);
    if (numPeopleMatch) {
      const count = parseChineseNumber(numPeopleMatch[1]);
      people = Array.from({ length: count }, (_, i) => i === 0 ? '我' : `成员${i + 1}`);
    } else {
      people = ['我', '同伴'];
    }
  }

  // 提取人名
  const nameMatches = text.matchAll(/(?:我[和跟与]?|[和跟与])([^\s，。,.\d]{1,4})/g);
  const names = [];
  for (const m of nameMatches) {
    const name = m[1]?.trim();
    if (name && !/[花费买付]/.test(name) && name.length <= 4) names.push(name);
  }
  if (names.length > 0) {
    people = ['我', ...names];
    if (splitType === 'single') splitType = 'equal';
  }

  return { people, splitType };
}

function extractItem(text) {
  let item = text
    .replace(/\d+(?:\.\d+)?\s*元?/g, '')
    .replace(/[两二三四五六七八九十\d]+\s*人/g, '')
    .replace(/AA|aa|均摊|分摊|平分|一人一半|对半/g, '')
    .replace(/我[自己]*[付花买出]|我[和跟与][^\s，。,.\d]{1,4}/g, '')
    .replace(/[，。,.\s!！]/g, '')
    .trim();
  return item || '未知消费';
}

function guessCategory(text, item) {
  const rules = [
    { cat: '餐饮', keys: ['饭', '菜', '餐', '奶茶', '咖啡', '外卖', '火锅', '烧烤', '早餐', '午', '晚', '吃', '喝', '饮'] },
    { cat: '交通', keys: ['打车', '滴滴', '地铁', '公交', '高铁', '火车', '飞机', '油', '停车', '出行'] },
    { cat: '购物', keys: ['超市', '买菜', '衣服', '鞋', '包', '淘宝', '京东', '拼多多', '电商', '买'] },
    { cat: '娱乐', keys: ['电影', 'KTV', '唱歌', '游戏', '门票', '旅游', '酒店', '密室', '剧本'] },
    { cat: '居住', keys: ['房租', '水电', '物业', '网费', '燃气', '维修'] },
  ];
  const combined = text + item;
  for (const rule of rules) {
    if (rule.keys.some(k => combined.includes(k))) return rule.cat;
  }
  return '其他';
}

function parseChineseNumber(str) {
  const map = { '两': 2, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10 };
  if (map[str]) return map[str];
  const num = parseInt(str);
  return isNaN(num) ? 2 : num;
}

/**
 * 主入口：解析记账文本
 * @param {string} text - "晚饭三人AA 120元"
 * @returns {object} 结构化结果
 */
export function parseExpenseText(text) {
  const currency = detectCurrency(text);
  const amount = extractAmount(text);
  const { people, splitType } = extractPeople(text);
  const item = extractItem(text);
  const category = guessCategory(text, item);
  const splits = calculate(amount, people, splitType);

  return {
    amount, item, people, splitType, category,
    splits, currency,
    rawText: text,
    source: 'local',
  };
}

export { detectCurrency };
