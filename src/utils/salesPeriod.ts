export const SALES_PERIODS = ['today', 'last7Days', 'last30Days', 'lastYear', 'allTime'] as const;

export type SalesPeriod = typeof SALES_PERIODS[number];

export const SALES_PERIOD_LABELS: Record<SalesPeriod, string> = {
  today: 'Today',
  last7Days: 'Last 7 days',
  last30Days: 'Last 30 days',
  lastYear: 'Last 1 year',
  allTime: 'Total sales',
};

export function getSalesPeriodRange(period: SalesPeriod, now = new Date()) {
  if (period === 'allTime') {
    return { start: Number.NEGATIVE_INFINITY, end: Number.POSITIVE_INFINITY };
  }

  const end = new Date(now);
  end.setHours(24, 0, 0, 0);

  const start = new Date(end);
  if (period === 'today') {
    start.setDate(start.getDate() - 1);
  } else if (period === 'last7Days') {
    start.setDate(start.getDate() - 7);
  } else if (period === 'last30Days') {
    start.setDate(start.getDate() - 30);
  } else {
    start.setFullYear(start.getFullYear() - 1);
  }

  return { start: start.getTime(), end: end.getTime() };
}
