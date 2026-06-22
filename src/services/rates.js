/**
 * 汇率换算 —— 静态汇率表
 */

const RATES = {
  CNY: 1,
  USD: 7.25,
  EUR: 7.88,
  GBP: 9.20,
  JPY: 0.048,
  HKD: 0.93,
  KRW: 0.0054,
};

export function convert(amount, fromCurrency, toCurrency) {
  if (fromCurrency === toCurrency) return amount;
  const inCNY = amount * RATES[fromCurrency];
  return inCNY / RATES[toCurrency];
}

export { RATES };
