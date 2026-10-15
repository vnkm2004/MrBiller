import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  TrendingUp,
  ShoppingCart,
  ReceiptIndianRupee,
  IndianRupee,
  Package,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { db } from '../db';
import { formatCurrency } from '../utils/format';
import { getSalesPeriodRange, type SalesPeriod } from '../utils/salesPeriod';
import { useApp } from '../context/AppContext';
import type { Invoice, InvoiceItem } from '../types';

export function DashboardPage() {
  const { t } = useTranslation();
  const { language } = useApp();
  const [salesPeriod, setSalesPeriod] = useState<SalesPeriod>('last7Days');

  const invoices = useLiveQuery(() => db.invoices.toArray(), []);
  const products = useLiveQuery(() => db.products.toArray(), []);
  const salesRange = getSalesPeriodRange(salesPeriod);
  const completedPeriodInvoices = useMemo(() => (
    invoices?.filter((invoice) => (
      invoice.status === 'completed'
      && invoice.date >= salesRange.start
      && invoice.date < salesRange.end
    )) || []
  ), [invoices, salesRange.start, salesRange.end]);
  const productUnitById = useMemo(
    () => new Map<number, string>((products || []).flatMap((product) => (
      product.id === undefined ? [] : [[product.id, product.unit || 'pcs'] as const]
    ))),
    [products],
  );

  const periodStats = useMemo(() => ({
    total: completedPeriodInvoices.reduce((sum, invoice) => sum + invoice.total, 0),
    count: completedPeriodInvoices.length,
    gst: completedPeriodInvoices.reduce((sum, invoice) => sum + invoice.gstAmount, 0),
  }), [completedPeriodInvoices]);

  // Bucket the trend at a useful granularity for the selected period.
  const salesTrend = useMemo(() => {
    if (!invoices) return [];
    const now = new Date();
    const locale = language === 'kn' ? 'kn-IN' : 'en-IN';
    const totalsByBucket = new Map<number, { revenue: number; bills: number }>();

    for (const invoice of completedPeriodInvoices) {
      const bucket = new Date(invoice.date);
      if (salesPeriod === 'today') {
        bucket.setMinutes(0, 0, 0);
      } else if (salesPeriod === 'last7Days' || salesPeriod === 'last30Days') {
        bucket.setHours(0, 0, 0, 0);
      } else if (salesPeriod === 'lastYear') {
        bucket.setDate(1);
        bucket.setHours(0, 0, 0, 0);
      } else {
        bucket.setMonth(0, 1);
        bucket.setHours(0, 0, 0, 0);
      }
      const key = bucket.getTime();
      const current = totalsByBucket.get(key) || { revenue: 0, bills: 0 };
      current.revenue += invoice.total;
      current.bills += 1;
      totalsByBucket.set(key, current);
    }

    const bucketStarts: Date[] = [];
    if (salesPeriod === 'today') {
      const firstHour = new Date(now);
      firstHour.setHours(0, 0, 0, 0);
      for (let hour = 0; hour <= now.getHours(); hour += 1) {
        const bucket = new Date(firstHour);
        bucket.setHours(hour);
        bucketStarts.push(bucket);
      }
    } else if (salesPeriod === 'last7Days' || salesPeriod === 'last30Days') {
      const dayCount = salesPeriod === 'last7Days' ? 7 : 30;
      const firstDay = new Date(salesRange.start);
      for (let day = 0; day < dayCount; day += 1) {
        const bucket = new Date(firstDay);
        bucket.setDate(firstDay.getDate() + day);
        bucketStarts.push(bucket);
      }
    } else if (salesPeriod === 'lastYear') {
      const firstMonth = new Date(salesRange.start);
      firstMonth.setDate(1);
      firstMonth.setHours(0, 0, 0, 0);
      const lastMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      for (const bucket = firstMonth; bucket <= lastMonth; bucket.setMonth(bucket.getMonth() + 1)) {
        bucketStarts.push(new Date(bucket));
      }
    } else {
      const firstYear = completedPeriodInvoices.length
        ? completedPeriodInvoices.reduce(
          (earliest, invoice) => Math.min(earliest, new Date(invoice.date).getFullYear()),
          now.getFullYear(),
        )
        : now.getFullYear();
      for (let year = firstYear; year <= now.getFullYear(); year += 1) {
        bucketStarts.push(new Date(year, 0, 1));
      }
    }

    return bucketStarts.map((bucket) => {
      let label: string;
      if (salesPeriod === 'today') {
        label = bucket.toLocaleTimeString(locale, { hour: 'numeric' });
      } else if (salesPeriod === 'last7Days') {
        label = bucket.toLocaleDateString(locale, { weekday: 'short', day: 'numeric' });
      } else if (salesPeriod === 'last30Days') {
        label = bucket.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
      } else if (salesPeriod === 'lastYear') {
        label = bucket.toLocaleDateString(locale, { month: 'short', year: '2-digit' });
      } else {
        label = String(bucket.getFullYear());
      }
      const totals = totalsByBucket.get(bucket.getTime());
      return {
        label,
        revenue: Math.round((totals?.revenue || 0) * 100) / 100,
        bills: totals?.bills || 0,
      };
    });
  }, [invoices, completedPeriodInvoices, language, salesPeriod, salesRange.start]);

  // Top products (by revenue)
  const topProducts = useMemo(() => {
    if (!invoices) return [];
    const productMap = new Map<string, { name: string; quantity: number; unit?: string; revenue: number }>();

    completedPeriodInvoices.forEach((inv: Invoice) => {
      inv.items.forEach((item: InvoiceItem) => {
        const unit = item.stockUnit ?? item.unit ?? (
          item.productId === undefined ? undefined : productUnitById.get(item.productId)
        );
        const key = `${item.productId ?? item.name}|${unit ?? ''}`;
        const quantity = item.stockQuantity ?? item.quantity;
        const existing = productMap.get(key);
        if (existing) {
          existing.quantity += quantity;
          existing.revenue += item.total;
        } else {
          productMap.set(key, {
            name: item.name,
            quantity,
            unit,
            revenue: item.total,
          });
        }
      });
    });

    return Array.from(productMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [completedPeriodInvoices, productUnitById]);

  const periodLabel = {
    today: t('dashboard.periodToday'),
    last7Days: t('dashboard.periodLast7Days'),
    last30Days: t('dashboard.periodLast30Days'),
    lastYear: t('dashboard.periodLastYear'),
    allTime: t('dashboard.periodAllTime'),
  }[salesPeriod];

  if (invoices && invoices.length === 0) {
    return (
      <div className="max-w-5xl mx-auto p-4">
        <h2 className="text-2xl font-bold text-primary mb-6">{t('dashboard.title')}</h2>
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-muted">
          <Package size={48} />
          <p className="text-center">{t('dashboard.noData')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4 pb-24 md:pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-primary">{t('dashboard.title')}</h2>
        <label className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 text-sm font-medium text-secondary">
          <span>{t('dashboard.salesPeriod')}</span>
          <select className="input-field min-w-44" value={salesPeriod} onChange={(event) => setSalesPeriod(event.target.value as SalesPeriod)}>
            <option value="today">{t('dashboard.periodToday')}</option>
            <option value="last7Days">{t('dashboard.periodLast7Days')}</option>
            <option value="last30Days">{t('dashboard.periodLast30Days')}</option>
            <option value="lastYear">{t('dashboard.periodLastYear')}</option>
            <option value="allTime">{t('dashboard.periodAllTime')}</option>
          </select>
        </label>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={<IndianRupee size={22} />}
          label={salesPeriod === 'allTime'
            ? t('dashboard.totalSales')
            : t('dashboard.salesForPeriod', { period: periodLabel })}
          value={formatCurrency(periodStats.total, language)}
          color="accent"
        />
        <StatCard
          icon={<ShoppingCart size={22} />}
          label={t('dashboard.periodBills')}
          value={String(periodStats.count)}
          color="accent2"
        />
        <StatCard
          icon={<ReceiptIndianRupee size={22} />}
          label={t('dashboard.periodGst')}
          value={formatCurrency(periodStats.gst, language)}
          color="accent"
        />
        <StatCard
          icon={<TrendingUp size={22} />}
          label={t('dashboard.averageBill')}
          value={formatCurrency(periodStats.count ? periodStats.total / periodStats.count : 0, language)}
          color="accent2"
        />
      </div>

      {/* Sales trend chart */}
      <div className="card p-4">
        <h3 className="font-semibold text-primary mb-4">{t('dashboard.salesTrendFor', { period: periodLabel })}</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={salesTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
            <XAxis
              dataKey="label"
              stroke="var(--text-muted)"
              fontSize={12}
              interval={salesPeriod === 'last30Days' ? 4 : salesPeriod === 'today' ? 2 : 0}
            />
            <YAxis stroke="var(--text-muted)" fontSize={12} />
            <Tooltip
              contentStyle={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                color: 'var(--text-primary)',
              }}
              itemStyle={{ color: 'rgb(var(--accent-color))' }}
              formatter={(value: number) => [formatCurrency(value, language), t('dashboard.weekRevenue')]}
            />
            <Bar dataKey="revenue" fill="rgb(var(--accent-color))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Top products */}
      <div className="card p-4">
        <h3 className="font-semibold text-primary mb-4">{t('dashboard.topProducts')}</h3>
        {topProducts.length === 0 ? (
          <p className="text-sm text-muted text-center py-4">{t('dashboard.noData')}</p>
        ) : (
          <div className="space-y-2">
            {topProducts.map((product, index) => (
              <div
                key={`${product.name}:${product.unit ?? ''}`}
                className="flex items-center gap-3 p-3 rounded-lg bg-secondary"
              >
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-accent/10 text-accent flex items-center justify-center text-sm font-bold">
                  {index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-primary truncate">{product.name}</p>
                  <p className="text-xs text-muted">
                    {t('billing.quantity')}: {product.quantity} {product.unit ?? ''}
                  </p>
                </div>
                <p className="font-semibold text-primary text-sm">
                  {formatCurrency(product.revenue, language)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: 'accent' | 'accent2';
}) {
  return (
    <div className="card p-4 flex flex-col gap-2">
      <div className={`p-2 rounded-lg w-fit ${color === 'accent' ? 'bg-accent/10 text-accent' : 'bg-accent2/10 text-accent2'}`}>
        {icon}
      </div>
      <p className="text-xs text-muted">{label}</p>
      <p className="text-lg font-bold text-primary truncate">{value}</p>
    </div>
  );
}
