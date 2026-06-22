/**
 * 均摊计算器 —— 纯数学逻辑
 */
export function calculate(amount, people, splitType, ratios) {
  switch (splitType) {
    case 'equal': {
      const share = Math.round((amount / people.length) * 100) / 100;
      return people.map(p => ({ person: p, share_amount: share }));
    }
    case 'single':
      return [{ person: people[0] || '我', share_amount: Math.round(amount * 100) / 100 }];
    case 'ratio':
      return people.map((p, i) => ({
        person: p,
        share_amount: Math.round(amount * (ratios?.[i] || 0) * 100) / 100,
      }));
    default:
      return [{ person: '我', share_amount: Math.round(amount * 100) / 100 }];
  }
}

export function verify(splits, totalAmount) {
  const sum = splits.reduce((s, x) => s + x.share_amount, 0);
  return Math.abs(sum - totalAmount) < 0.02 * splits.length;
}

export function format(splits, totalAmount) {
  return splits.map(s => `${s.person}: ¥${s.share_amount.toFixed(2)}`).join(', ');
}
