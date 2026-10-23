/**
 * Universal Currency & Coin Formatter
 * - Converts coins >= 1,000,000 to M (e.g. 1M, 1.2M, 5M)
 * - Converts coins >= 1,000 to K (e.g. 1K, 1.5K, 5K, 50K)
 * - Formats smaller numbers with commas (e.g. 999, 500, 100)
 */
export function formatCoins(amount) {
  if (amount === undefined || amount === null || isNaN(Number(amount))) {
    return '0';
  }

  const num = Number(amount);
  const isNegative = num < 0;
  const abs = Math.abs(num);

  if (abs >= 1000000) {
    const formatted = (abs / 1000000).toFixed(1).replace(/\.0$/, '');
    return `${isNegative ? '-' : ''}${formatted}M`;
  }

  if (abs >= 1000) {
    const formatted = (abs / 1000).toFixed(1).replace(/\.0$/, '');
    return `${isNegative ? '-' : ''}${formatted}K`;
  }

  return `${isNegative ? '-' : ''}${abs.toLocaleString()}`;
}
