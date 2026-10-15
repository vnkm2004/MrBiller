import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, Store, Users, IndianRupee, ReceiptIndianRupee, UserPlus, Power, KeyRound, CalendarDays, TicketCheck, Pencil, Check, LayoutDashboard, MessageCircle } from 'lucide-react';
import { requireSupabase } from '../lib/supabase';
import { formatCurrency } from '../utils/format';
import { getSalesPeriodRange, SALES_PERIOD_LABELS, SALES_PERIODS, type SalesPeriod } from '../utils/salesPeriod';
import { clearLegacyShopData, getLegacyShopData } from '../db';
import type { CustomUnit, Invoice as AppInvoice, Product, StoreSettings } from '../types';
import { AdminSupportInbox } from '../components/support/AdminSupportInbox';

type Shop = { id: string; code: string; name: string; active: boolean; created_at: string };
type Member = { id: number; user_id: string; shop_id: string; username: string; role: 'owner' | 'staff'; active: boolean };
type Invoice = { shop_id: string; total: number | string; date_ms: number | string; status: string };
type SubscriptionPlan = { id: string; name: string; description: string | null; months: number; price: number | string | null; max_users: number; active: boolean };
type ShopSubscription = { shop_id: string; plan_id: string | null; starts_at: string; expires_at: string; max_users: number };
type Coupon = { id: string; code: string; plan_id: string | null; months: number; max_redemptions: number; redeemed_count: number; expires_at: string | null; active: boolean };
type PlanRequest = { id: string; shop_id: string; plan_name: string; months: number; price: number | string | null; created_at: string };
type AdminSection = 'overview' | 'shops' | 'plans' | 'support';

type AdminData = {
  shops: Shop[];
  members: Member[];
  invoices: Invoice[];
  totalBills: number;
  plans: SubscriptionPlan[];
  subscriptions: ShopSubscription[];
  coupons: Coupon[];
  requests: PlanRequest[];
};

type LegacyData = {
  products: Product[];
  invoices: AppInvoice[];
  customUnits: CustomUnit[];
  settings: StoreSettings | null;
};

const EMPTY_DATA: AdminData = { shops: [], members: [], invoices: [], totalBills: 0, plans: [], subscriptions: [], coupons: [], requests: [] };

async function loadAllInvoices(client: ReturnType<typeof requireSupabase>) {
  const invoices: Invoice[] = [];
  const pageSize = 1000;

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client
      .from('invoices')
      .select('shop_id, total, date_ms, status')
      .order('date_ms', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) return { data: null, error };

    const page = (data || []) as Invoice[];
    invoices.push(...page);
    if (page.length < pageSize) return { data: invoices, error: null };
  }
}

async function callAdmin(action: string, payload: Record<string, unknown>) {
  const { data, error } = await requireSupabase().functions.invoke('admin-manage', {
    body: { action, ...payload },
  });
  if (error) {
    const response = (error as { context?: unknown }).context;
    if (response instanceof Response) {
      const details = await response.clone().json().catch(() => null) as { error?: unknown } | null;
      if (typeof details?.error === 'string') throw new Error(details.error);
    }
    throw error;
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export function AdminPage() {
  const [data, setData] = useState<AdminData>(EMPTY_DATA);
  const [adminSection, setAdminSection] = useState<AdminSection>('overview');
  const [salesPeriod, setSalesPeriod] = useState<SalesPeriod>('today');
  const [legacyData, setLegacyData] = useState<LegacyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [shopName, setShopName] = useState('');
  const [shopCode, setShopCode] = useState('');
  const [ownerUsername, setOwnerUsername] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [creatingShop, setCreatingShop] = useState(false);
  const [addUserFor, setAddUserFor] = useState<string | null>(null);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetUser, setResetUser] = useState<Member | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [grantFor, setGrantFor] = useState<string | null>(null);
  const [grantMonths, setGrantMonths] = useState('1');
  const [grantPlanId, setGrantPlanId] = useState('');
  const [planId, setPlanId] = useState<string | null>(null);
  const [planName, setPlanName] = useState('');
  const [planDescription, setPlanDescription] = useState('');
  const [planMonths, setPlanMonths] = useState('1');
  const [planPrice, setPlanPrice] = useState('');
  const [planMaxUsers, setPlanMaxUsers] = useState('2');
  const [planActive, setPlanActive] = useState(true);
  const [couponId, setCouponId] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [couponPlanId, setCouponPlanId] = useState('');
  const [couponMonths, setCouponMonths] = useState('1');
  const [couponMaxUses, setCouponMaxUses] = useState('1');
  const [couponExpiry, setCouponExpiry] = useState('');
  const [couponActive, setCouponActive] = useState(true);

  const load = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    else setRefreshing(true);
    setError('');
    const client = requireSupabase();
    const [shops, members, invoices, billCount, plans, subscriptions, coupons, requests] = await Promise.all([
      client.from('shops').select('id, code, name, active, created_at').order('created_at', { ascending: false }),
      client.from('shop_memberships').select('id, user_id, shop_id, username, role, active').order('created_at', { ascending: true }),
      loadAllInvoices(client),
      client.from('invoices').select('*', { count: 'exact', head: true }),
      client.from('subscription_plans').select('id, name, description, months, price, max_users, active').order('price', { ascending: true }),
      client.from('shop_subscriptions').select('shop_id, plan_id, starts_at, expires_at, max_users'),
      client.from('subscription_coupons').select('id, code, plan_id, months, max_redemptions, redeemed_count, expires_at, active').order('created_at', { ascending: false }),
      client.from('subscription_requests').select('id, shop_id, plan_name, months, price, created_at').eq('status', 'pending').order('created_at', { ascending: true }),
    ]);
    const failure = shops.error || members.error || invoices.error || billCount.error || plans.error || subscriptions.error || coupons.error || requests.error;
    if (failure) {
      setError(failure.message);
      setData(EMPTY_DATA);
    } else {
      setData({
        shops: (shops.data || []) as Shop[],
        members: (members.data || []) as Member[],
        invoices: invoices.data || [],
        totalBills: billCount.count ?? 0,
        plans: (plans.data || []) as SubscriptionPlan[],
        subscriptions: (subscriptions.data || []) as ShopSubscription[],
        coupons: (coupons.data || []) as Coupon[],
        requests: (requests.data || []) as PlanRequest[],
      });
    }
    try {
      setLegacyData(await getLegacyShopData());
    } catch (legacyError) {
      console.error('Could not read the old device data archive:', legacyError);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void load(true);
    const refresh = () => {
      if (document.visibilityState === 'visible') void load();
    };
    const interval = window.setInterval(refresh, 30_000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [load]);

  const activeUsers = data.members.filter((member) => member.active).length;
  const salesRange = getSalesPeriodRange(salesPeriod);
  const periodInvoices = data.invoices.filter((invoice) => {
    const date = Number(invoice.date_ms);
    return invoice.status === 'completed' && date >= salesRange.start && date < salesRange.end;
  });
  const periodSales = periodInvoices.reduce((sum, invoice) => sum + Number(invoice.total), 0);
  const shopTotals = useMemo(() => {
    const totals = new Map<string, { bills: number; sales: number }>();
    data.invoices.forEach((invoice) => {
      if (invoice.status !== 'completed') return;
      const total = totals.get(invoice.shop_id) || { bills: 0, sales: 0 };
      total.bills += 1;
      total.sales += Number(invoice.total);
      totals.set(invoice.shop_id, total);
    });
    return totals;
  }, [data.invoices]);

  const showNotice = (message: string) => {
    setNotice(message);
    setError('');
    window.setTimeout(() => setNotice(''), 6000);
  };

  const handleCreateShop = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreatingShop(true);
    setError('');
    try {
      await callAdmin('create_shop', {
        name: shopName.trim(),
        code: shopCode.trim().toLowerCase(),
        username: ownerUsername.trim().toLowerCase(),
        password: ownerPassword,
      });
      showNotice(`Created ${shopName.trim()} (${shopCode.trim().toLowerCase()}) with owner login ${ownerUsername.trim().toLowerCase()}. Share the password you entered with that shop securely.`);
      setShopName('');
      setShopCode('');
      setOwnerUsername('');
      setOwnerPassword('');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not create the shop.');
    } finally {
      setCreatingShop(false);
    }
  };

  const handleAddUser = async (shop: Shop) => {
    setBusy(`add:${shop.id}`);
    setError('');
    try {
      await callAdmin('create_user', {
        shop_id: shop.id,
        username: newUsername.trim().toLowerCase(),
        password: newPassword,
      });
      showNotice(`Created user ${newUsername.trim().toLowerCase()} for ${shop.name}. Share the password you entered securely.`);
      setNewUsername('');
      setNewPassword('');
      setAddUserFor(null);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not create the login.');
    } finally {
      setBusy(null);
    }
  };

  const handleShopStatus = async (shop: Shop) => {
    setBusy(`shop:${shop.id}`);
    setError('');
    try {
      await callAdmin('set_shop_active', { shop_id: shop.id, active: !shop.active });
      showNotice(`${shop.name} ${shop.active ? 'suspended' : 'reactivated'}.`);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not update the shop.');
    } finally {
      setBusy(null);
    }
  };

  const handleImportLegacy = async (shop: Shop) => {
    if (!legacyData) return;
    const hasRows = legacyData.products.length + legacyData.invoices.length + legacyData.customUnits.length > 0;
    if (!hasRows && !legacyData.settings) return;
    const confirmation = window.confirm(
      `Copy this device's old data into ${shop.name} (${shop.code})? This can only be imported into an empty shop.`,
    );
    if (!confirmation) return;
    setBusy(`import:${shop.id}`);
    setError('');
    try {
      await callAdmin('import_shop_data', { shop_id: shop.id, legacy: legacyData });
      await clearLegacyShopData();
      setLegacyData(null);
      showNotice(`Imported this device's saved data into ${shop.name}.`);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not import the saved data.');
    } finally {
      setBusy(null);
    }
  };

  const handleMemberStatus = async (member: Member) => {
    setBusy(`member:${member.id}`);
    setError('');
    try {
      await callAdmin('set_user_active', { user_id: member.user_id, active: !member.active });
      showNotice(`Login ${member.username} ${member.active ? 'disabled' : 'enabled'}.`);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not update the login.');
    } finally {
      setBusy(null);
    }
  };

  const handleResetPassword = async () => {
    if (!resetUser) return;
    setBusy(`reset:${resetUser.id}`);
    setError('');
    try {
      await callAdmin('reset_password', { user_id: resetUser.user_id, password: resetPassword });
      showNotice(`Password reset for ${resetUser.username}.`);
      setResetUser(null);
      setResetPassword('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not reset the password.');
    } finally {
      setBusy(null);
    }
  };

  const handleGrantSubscription = async (shop: Shop) => {
    const plan = data.plans.find((item) => item.id === grantPlanId);
    const months = plan?.months ?? Number(grantMonths);
    if (!Number.isInteger(months) || months < 1 || months > 120) {
      setError('Choose a duration from 1 to 120 months.');
      return;
    }
    setBusy(`grant:${shop.id}`);
    setError('');
    try {
      await callAdmin('grant_subscription', {
        shop_id: shop.id,
        months,
        plan_id: plan?.id || null,
      });
      setGrantFor(null);
      setGrantMonths('1');
      setGrantPlanId('');
      showNotice(`Subscription access updated for ${shop.name} for ${months} ${months === 1 ? 'month' : 'months'}.`);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not update the shop subscription.');
    } finally {
      setBusy(null);
    }
  };

  const handleSavePlan = async (event: React.FormEvent) => {
    event.preventDefault();
    const months = Number(planMonths);
    const price = planPrice.trim() ? Number(planPrice) : null;
    const maxUsers = Number(planMaxUsers);
    if (!Number.isInteger(months) || months < 1 || months > 120 || (price !== null && (!Number.isFinite(price) || price < 0)) || !Number.isInteger(maxUsers) || maxUsers < 1 || maxUsers > 60) {
      setError('Enter a valid plan duration, price, and user ID limit (1–60).');
      return;
    }
    setBusy('save-plan');
    setError('');
    try {
      await callAdmin('save_subscription_plan', {
        plan_id: planId,
        name: planName.trim(),
        description: planDescription.trim() || null,
        months,
        price,
        max_users: maxUsers,
        active: planActive,
      });
      setPlanId(null);
      setPlanName('');
      setPlanDescription('');
      setPlanMonths('1');
      setPlanPrice('');
      setPlanMaxUsers('2');
      setPlanActive(true);
      showNotice('Subscription plan saved.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save the plan.');
    } finally {
      setBusy(null);
    }
  };

  const editPlan = (plan: SubscriptionPlan) => {
    setPlanId(plan.id);
    setPlanName(plan.name);
    setPlanDescription(plan.description || '');
    setPlanMonths(String(plan.months));
    setPlanPrice(plan.price === null ? '' : String(plan.price));
    setPlanMaxUsers(String(plan.max_users));
    setPlanActive(plan.active);
  };

  const handlePlanStatus = async (plan: SubscriptionPlan) => {
    setBusy(`plan:${plan.id}`);
    setError('');
    try {
      await callAdmin('save_subscription_plan', {
        plan_id: plan.id,
        name: plan.name,
        description: plan.description,
        months: plan.months,
        price: plan.price,
        max_users: plan.max_users,
        active: !plan.active,
      });
      showNotice(`${plan.name} ${plan.active ? 'hidden from users' : 'made available'}.`);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not update the plan.');
    } finally {
      setBusy(null);
    }
  };

  const handleSaveCoupon = async (event: React.FormEvent) => {
    event.preventDefault();
    const months = Number(couponMonths);
    const maxRedemptions = Number(couponMaxUses);
    if (!Number.isInteger(months) || months < 1 || months > 120 || !Number.isInteger(maxRedemptions) || maxRedemptions < 1) {
      setError('Enter valid coupon duration and redemption limit.');
      return;
    }
    setBusy('save-coupon');
    setError('');
    try {
      await callAdmin('save_subscription_coupon', {
        coupon_id: couponId,
        code: couponCode.trim().toUpperCase(),
        plan_id: couponPlanId || null,
        months,
        max_redemptions: maxRedemptions,
        expires_at: couponExpiry ? new Date(couponExpiry).toISOString() : null,
        active: couponActive,
      });
      setCouponId(null);
      setCouponCode('');
      setCouponPlanId('');
      setCouponMonths('1');
      setCouponMaxUses('1');
      setCouponExpiry('');
      setCouponActive(true);
      showNotice('Coupon saved. Share the code with the shop after confirming payment.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save the coupon.');
    } finally {
      setBusy(null);
    }
  };

  const editCoupon = (coupon: Coupon) => {
    setCouponId(coupon.id);
    setCouponCode(coupon.code);
    setCouponPlanId(coupon.plan_id || '');
    setCouponMonths(String(coupon.months));
    setCouponMaxUses(String(coupon.max_redemptions));
    setCouponExpiry(coupon.expires_at ? new Date(new Date(coupon.expires_at).getTime() - new Date(coupon.expires_at).getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : '');
    setCouponActive(coupon.active);
  };

  const generateCouponCode = () => {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const random = crypto.getRandomValues(new Uint8Array(12));
    setCouponCode(`BILL-${Array.from(random, (value) => alphabet[value % alphabet.length]).join('')}`);
  };

  const handleCouponStatus = async (coupon: Coupon) => {
    setBusy(`coupon:${coupon.id}`);
    setError('');
    try {
      await callAdmin('save_subscription_coupon', {
        coupon_id: coupon.id,
        code: coupon.code,
        plan_id: coupon.plan_id,
        months: coupon.months,
        max_redemptions: coupon.max_redemptions,
        expires_at: coupon.expires_at,
        active: !coupon.active,
      });
      showNotice(`${coupon.code} ${coupon.active ? 'disabled' : 'enabled'}.`);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not update the coupon.');
    } finally {
      setBusy(null);
    }
  };

  const handleResolveRequest = async (request: PlanRequest, approve: boolean) => {
    setBusy(`request:${request.id}`);
    setError('');
    try {
      await callAdmin('resolve_subscription_request', { request_id: request.id, approve });
      showNotice(approve ? 'Plan request approved and shop access activated.' : 'Plan request declined.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not resolve the plan request.');
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <div className="max-w-7xl mx-auto p-6 text-muted">Loading administration…</div>;

  return (
    <main className="max-w-7xl mx-auto p-4 md:p-6 space-y-6 pb-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">Administration</h1>
          <p className="mt-1 text-sm text-muted">Manage shop accounts, subscriptions, and support from one place.</p>
        </div>
        {adminSection === 'overview' && (
          <label className="flex items-center gap-3 text-sm font-medium text-secondary">
            <span>Sales period</span>
            <select className="input-field min-w-44" value={salesPeriod} onChange={(event) => setSalesPeriod(event.target.value as SalesPeriod)}>
              {SALES_PERIODS.map((period) => <option key={period} value={period}>{SALES_PERIOD_LABELS[period]}</option>)}
            </select>
          </label>
        )}
      </header>

      <nav aria-label="Administration sections" className="flex gap-2 overflow-x-auto border-b border-default pb-2">
        {([
          { id: 'overview', label: 'Overview', icon: LayoutDashboard },
          { id: 'shops', label: 'Shops', icon: Store },
          { id: 'plans', label: 'Plans', icon: CalendarDays },
          { id: 'support', label: 'Support', icon: MessageCircle },
        ] as const).map(({ id, label, icon: Icon }) => {
          const count = id === 'shops' ? data.shops.length : id === 'plans' ? data.requests.length : undefined;
          return (
          <button
            key={id}
            type="button"
            aria-pressed={adminSection === id}
            onClick={() => setAdminSection(id)}
            className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${adminSection === id ? 'bg-accent text-white' : 'text-secondary hover:opacity-80'}`}
          >
              <Icon size={17} />
              {label}
              {count !== undefined && count > 0 && <span className={`rounded-full px-2 py-0.5 text-xs ${adminSection === id ? 'bg-white/20' : 'bg-secondary'}`}>{count}</span>}
            </button>
          );
        })}
      </nav>

      {error && <p role="alert" className="rounded-lg bg-red-500/10 text-red-600 p-3 text-sm">{error}</p>}
      {notice && <p role="status" className="rounded-lg bg-green-500/10 text-green-700 p-3 text-sm">{notice}</p>}

      {adminSection === 'overview' && (
        <div className="space-y-6">
          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <SummaryCard icon={<Store size={20} />} label="Shops" value={String(data.shops.length)} />
            <SummaryCard icon={<Users size={20} />} label="Active logins" value={String(activeUsers)} />
            <SummaryCard icon={<ReceiptIndianRupee size={20} />} label="Bills generated" value={String(data.totalBills)} />
            <SummaryCard icon={<IndianRupee size={20} />} label={salesPeriod === 'allTime' ? 'Total sales' : `${SALES_PERIOD_LABELS[salesPeriod]} sales`} value={formatCurrency(periodSales, 'en')} />
          </section>

          <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button type="button" onClick={() => setAdminSection('shops')} className="card p-4 text-left transition-colors hover:border-accent/50">
              <p className="font-semibold text-primary">Shop accounts</p>
              <p className="mt-1 text-sm text-muted">Add a company, manage logins, and review each shop’s plan and expiry date.</p>
            </button>
            <button type="button" onClick={() => setAdminSection('plans')} className="card p-4 text-left transition-colors hover:border-accent/50">
              <p className="font-semibold text-primary">Subscriptions</p>
              <p className="mt-1 text-sm text-muted">{data.requests.length} pending plan {data.requests.length === 1 ? 'request' : 'requests'} · manage plans and coupons.</p>
            </button>
            <button type="button" onClick={() => setAdminSection('support')} className="card p-4 text-left transition-colors hover:border-accent/50">
              <p className="font-semibold text-primary">Support inbox</p>
              <p className="mt-1 text-sm text-muted">Open customer conversations and reply to shop questions.</p>
            </button>
          </section>
        </div>
      )}

      {adminSection === 'support' && <AdminSupportInbox />}

      {adminSection === 'shops' && legacyData && (legacyData.products.length + legacyData.invoices.length + legacyData.customUnits.length > 0 || legacyData.settings) && (
        <section className="rounded-xl border border-accent/30 bg-accent/5 p-4 space-y-1">
          <h2 className="font-semibold text-primary">Old data saved on this device</h2>
          <p className="text-sm text-secondary">
            {legacyData.products.length} products · {legacyData.invoices.length} bills · {legacyData.customUnits.length} custom units.
            Choose the shop that owns these records, then use its import button. Import copies the archive and clears it after success.
          </p>
        </section>
      )}

      {adminSection === 'shops' && <section className="card p-4 md:p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-primary">Add a shop</h2>
            <p className="text-sm text-muted">Create a shop and owner login with one complimentary month.</p>
          </div>
          <Plus size={21} className="text-accent" />
        </div>
        <form onSubmit={handleCreateShop} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <AdminInput label="Shop name" value={shopName} onChange={setShopName} placeholder="Main Street Store" required />
          <AdminInput label="Shop ID" value={shopCode} onChange={(value) => setShopCode(value.toLowerCase().replace(/\s/g, '-'))} placeholder="main-street" pattern="[a-z0-9]([a-z0-9]|-){1,19}" required />
          <AdminInput label="Owner user ID" value={ownerUsername} onChange={(value) => setOwnerUsername(value.toLowerCase().replace(/\s/g, ''))} placeholder="owner1" pattern="[a-z0-9]([a-z0-9._]|-){2,31}" required />
          <AdminInput label="Initial password" value={ownerPassword} onChange={setOwnerPassword} type="password" minLength={8} autoComplete="new-password" required />
          <button className="btn-primary" disabled={creatingShop}>{creatingShop ? 'Creating…' : 'Create shop'}</button>
        </form>
        <p className="text-xs text-muted">Shop IDs use 2–20 lowercase letters, numbers, or hyphens. User IDs use 3–32 lowercase letters, numbers, dots, underscores, or hyphens.</p>
      </section>}

      {adminSection === 'plans' && <section className="card p-4 md:p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-primary">Plan requests</h2>
            <p className="text-sm text-muted">Approve a request after confirming the shop's payment.</p>
          </div>
          <CalendarDays size={20} className="text-accent" />
        </div>
        {data.requests.length === 0 ? <p className="text-sm text-muted">No pending plan requests.</p> : (
          <div className="divide-y divide-default border-y border-default">
            {data.requests.map((request) => {
              const shop = data.shops.find((item) => item.id === request.shop_id);
              return (
                <div key={request.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-primary">{shop?.name || 'Unknown shop'} <span className="text-muted font-normal">· {request.plan_name}</span></p>
                    <p className="text-sm text-muted">{request.months} {request.months === 1 ? 'month' : 'months'} · {request.price === null ? 'Price not set' : formatCurrency(Number(request.price), 'en')} · {new Date(request.created_at).toLocaleDateString('en-IN')}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button className="btn-primary flex items-center gap-1.5" onClick={() => void handleResolveRequest(request, true)} disabled={busy === `request:${request.id}`}>
                      <Check size={15} /> {busy === `request:${request.id}` ? 'Saving…' : 'Approve & activate'}
                    </button>
                    <button className="btn-secondary" onClick={() => void handleResolveRequest(request, false)} disabled={busy === `request:${request.id}`}>Decline</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>}

      {adminSection === 'plans' && <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="card p-4 md:p-5 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-primary">Subscription plans</h2>
            <p className="text-sm text-muted">Set the duration and price users see when requesting access.</p>
          </div>
          <form onSubmit={(event) => void handleSavePlan(event)} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <AdminInput label="Plan name" value={planName} onChange={setPlanName} placeholder="Starter" maxLength={60} required />
              <AdminInput label="Duration (months)" value={planMonths} onChange={setPlanMonths} type="number" min={1} max={120} required />
              <AdminInput label="Price (₹)" value={planPrice} onChange={setPlanPrice} type="number" min={0} step="0.01" placeholder="Leave blank if not set" />
              <AdminInput label="Maximum user IDs" value={planMaxUsers} onChange={setPlanMaxUsers} type="number" min={1} max={60} required />
              <AdminInput label="Description" value={planDescription} onChange={setPlanDescription} placeholder="Access for one month" maxLength={160} />
            </div>
            <label className="flex items-center gap-2 text-sm text-secondary">
              <input type="checkbox" checked={planActive} onChange={(event) => setPlanActive(event.target.checked)} /> Available to users
            </label>
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary" disabled={busy === 'save-plan'}>{busy === 'save-plan' ? 'Saving…' : planId ? 'Update plan' : 'Create plan'}</button>
              {planId && <button type="button" className="btn-secondary" onClick={() => { setPlanId(null); setPlanName(''); setPlanDescription(''); setPlanMonths('1'); setPlanPrice(''); setPlanMaxUsers('2'); setPlanActive(true); }}>Cancel edit</button>}
            </div>
          </form>
          <div className="divide-y divide-default border-y border-default">
            {data.plans.map((plan) => (
              <div key={plan.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-primary">{plan.name} <span className="text-xs text-muted">· {plan.months} {plan.months === 1 ? 'month' : 'months'}</span></p>
                  <p className="text-xs text-muted">{plan.price === null ? 'Price not set' : formatCurrency(Number(plan.price), 'en')} · up to {plan.max_users} user IDs · {plan.active ? 'Available' : 'Hidden'}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="btn-secondary text-sm flex items-center gap-1.5" onClick={() => editPlan(plan)}><Pencil size={14} /> Edit</button>
                  <button className="btn-secondary text-sm" onClick={() => void handlePlanStatus(plan)} disabled={busy === `plan:${plan.id}`}>{plan.active ? 'Hide' : 'Enable'}</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-4 md:p-5 space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-primary">Subscription coupons</h2>
              <p className="text-sm text-muted">Issue a code after receiving payment, then share it with the shop.</p>
            </div>
            <TicketCheck size={20} className="text-accent" />
          </div>
          <form onSubmit={(event) => void handleSaveCoupon(event)} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block space-y-1.5 sm:col-span-2">
                <span className="text-sm font-medium text-secondary">Coupon code</span>
                <div className="flex gap-2">
                  <input className="input-field min-w-0 flex-1" value={couponCode} onChange={(event) => setCouponCode(event.target.value.toUpperCase())} pattern="([A-Z0-9]|-){4,32}" maxLength={32} required />
                  <button type="button" className="btn-secondary shrink-0" onClick={generateCouponCode}>Generate</button>
                </div>
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-secondary">Plan (optional)</span>
                <select className="input-field" value={couponPlanId} onChange={(event) => setCouponPlanId(event.target.value)}>
                  <option value="">Custom duration</option>
                  {data.plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} · {plan.months} mo.</option>)}
                </select>
              </label>
              <AdminInput label="Duration (months)" value={couponMonths} onChange={setCouponMonths} type="number" min={1} max={120} required />
              <AdminInput label="Maximum redemptions" value={couponMaxUses} onChange={setCouponMaxUses} type="number" min={1} max={100000} required />
              <AdminInput label="Expires (optional)" value={couponExpiry} onChange={setCouponExpiry} type="datetime-local" />
            </div>
            <label className="flex items-center gap-2 text-sm text-secondary">
              <input type="checkbox" checked={couponActive} onChange={(event) => setCouponActive(event.target.checked)} /> Coupon can be redeemed
            </label>
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary" disabled={busy === 'save-coupon'}>{busy === 'save-coupon' ? 'Saving…' : couponId ? 'Update coupon' : 'Create coupon'}</button>
              {couponId && <button type="button" className="btn-secondary" onClick={() => { setCouponId(null); setCouponCode(''); setCouponPlanId(''); setCouponMonths('1'); setCouponMaxUses('1'); setCouponExpiry(''); setCouponActive(true); }}>Cancel edit</button>}
            </div>
          </form>
          <div className="divide-y divide-default border-y border-default">
            {data.coupons.length === 0 ? <p className="py-3 text-sm text-muted">No coupons created.</p> : data.coupons.map((coupon) => (
              <div key={coupon.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-mono font-medium text-primary">{coupon.code}</p>
                  <p className="text-xs text-muted">{coupon.months} {coupon.months === 1 ? 'month' : 'months'} · {coupon.redeemed_count}/{coupon.max_redemptions} used · {coupon.active ? 'Active' : 'Disabled'}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="btn-secondary text-sm flex items-center gap-1.5" onClick={() => editCoupon(coupon)}><Pencil size={14} /> Edit</button>
                  <button className="btn-secondary text-sm" onClick={() => void handleCouponStatus(coupon)} disabled={busy === `coupon:${coupon.id}`}>{coupon.active ? 'Disable' : 'Enable'}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>}

      {adminSection === 'shops' && <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-primary">Shops and access</h2>
          <button className="btn-secondary flex items-center gap-2" onClick={() => void load()} disabled={refreshing}>
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {data.shops.length === 0 ? (
          <div className="card p-8 text-center text-muted">No shops have been created yet.</div>
        ) : data.shops.map((shop) => {
          const members = data.members.filter((member) => member.shop_id === shop.id);
          const totals = shopTotals.get(shop.id) || { bills: 0, sales: 0 };
          const subscription = data.subscriptions.find((item) => item.shop_id === shop.id);
          const isSubscribed = Boolean(subscription && Date.parse(subscription.expires_at) > Date.now());
          const currentPlan = data.plans.find((plan) => plan.id === subscription?.plan_id);
          const activeMemberCount = members.filter((member) => member.active).length;
          const userLimit = subscription?.max_users ?? currentPlan?.max_users ?? 2;
          return (
            <article key={shop.id} className="card p-4 md:p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-primary text-lg">{shop.name}</h3>
                    <span className="rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary">{shop.code}</span>
                    <span className={`rounded-full px-2.5 py-1 text-xs ${shop.active ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
                      {shop.active ? 'Active' : 'Suspended'}
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-xs ${isSubscribed ? 'bg-green-500/10 text-green-600' : 'bg-amber-500/10 text-amber-700'}`}>
                      {isSubscribed ? 'Subscription active' : 'Subscription expired'}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 xl:grid-cols-5">
                    <ShopFact label="User IDs" value={`${activeMemberCount} active / ${userLimit} allowed`} detail={`${members.length} login${members.length === 1 ? '' : 's'} total`} />
                    <ShopFact label="Current plan" value={currentPlan?.name || (subscription ? 'Custom access' : 'No plan')} detail={subscription ? (isSubscribed ? 'Subscription active' : 'Subscription expired') : 'No subscription assigned'} />
                    <ShopFact label="Plan started" value={subscription ? formatSubscriptionDate(subscription.starts_at) : '—'} detail={subscription ? 'Local shop access' : 'Not started'} />
                    <ShopFact label="Access ends" value={subscription ? formatSubscriptionExpiry(subscription.expires_at) : '—'} detail={subscription ? 'End of the final subscription day' : 'No expiry date'} />
                    <ShopFact label="Sales & receipts" value={formatCurrency(totals.sales, 'en')} detail={`${totals.bills} receipts generated`} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {legacyData && (legacyData.products.length + legacyData.invoices.length + legacyData.customUnits.length > 0 || legacyData.settings) && (
                    <button className="btn-secondary" onClick={() => void handleImportLegacy(shop)} disabled={busy === `import:${shop.id}`}>
                      {busy === `import:${shop.id}` ? 'Importing…' : 'Import old device data'}
                    </button>
                  )}
                  <button className="btn-secondary flex items-center gap-2" onClick={() => { setAddUserFor(addUserFor === shop.id ? null : shop.id); setResetUser(null); }} disabled={activeMemberCount >= userLimit} title={activeMemberCount >= userLimit ? 'Upgrade the plan or disable an existing login to add another user ID.' : undefined}>
                    <UserPlus size={16} /> Add login
                  </button>
                  <button className="btn-secondary flex items-center gap-2" onClick={() => { setGrantFor(grantFor === shop.id ? null : shop.id); setGrantPlanId(''); setGrantMonths('1'); }}>
                    <CalendarDays size={16} /> {isSubscribed ? 'Extend subscription' : 'Activate subscription'}
                  </button>
                  <button className="btn-secondary flex items-center gap-2" onClick={() => void handleShopStatus(shop)} disabled={busy === `shop:${shop.id}`}>
                    <Power size={16} /> {shop.active ? 'Suspend' : 'Reactivate'}
                  </button>
                </div>
              </div>

              {addUserFor === shop.id && (
                <div className="rounded-lg bg-secondary p-3 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                    <AdminInput label="User ID" value={newUsername} onChange={(value) => setNewUsername(value.toLowerCase().replace(/\s/g, ''))} placeholder="cashier2" pattern="[a-z0-9]([a-z0-9._]|-){2,31}" required />
                    <AdminInput label="Initial password" value={newPassword} onChange={setNewPassword} type="password" minLength={8} autoComplete="new-password" required />
                    <button className="btn-primary" onClick={() => void handleAddUser(shop)} disabled={busy === `add:${shop.id}` || newUsername.length < 3 || newPassword.length < 8}>
                      {busy === `add:${shop.id}` ? 'Creating…' : 'Create login'}
                    </button>
                  </div>
                  <p className="text-xs text-muted">This login can access only {shop.name}. {activeMemberCount}/{userLimit} active user IDs are in use; plan limits include the owner login.</p>
                </div>
              )}

              {grantFor === shop.id && (
                <div className="rounded-lg bg-secondary p-3 space-y-3">
                  <p className="text-sm font-medium text-primary">Grant or extend access for {shop.name}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                    <label className="block space-y-1.5">
                      <span className="text-sm font-medium text-secondary">Plan (optional)</span>
                      <select className="input-field" value={grantPlanId} onChange={(event) => setGrantPlanId(event.target.value)}>
                        <option value="">Custom duration</option>
                        {data.plans.filter((plan) => plan.active).map((plan) => <option key={plan.id} value={plan.id}>{plan.name} · {plan.months} mo.</option>)}
                      </select>
                    </label>
                    {!grantPlanId && <AdminInput label="Duration (months)" value={grantMonths} onChange={setGrantMonths} type="number" min={1} max={120} required />}
                    <button className="btn-primary" onClick={() => void handleGrantSubscription(shop)} disabled={busy === `grant:${shop.id}`}>
                      {busy === `grant:${shop.id}` ? 'Saving…' : 'Grant access'}
                    </button>
                  </div>
                  <p className="text-xs text-muted">If the shop already has active time, the new months are added after its current expiry.</p>
                </div>
              )}

              <div className="divide-y divide-default border-y border-default">
                {members.length === 0 ? <p className="py-3 text-sm text-muted">No user logins.</p> : members.map((member) => (
                  <div key={member.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-primary">{member.username} <span className="text-xs text-muted">· {member.role}</span></p>
                      <p className={`text-xs ${member.active ? 'text-green-600' : 'text-red-600'}`}>{member.active ? 'Enabled' : 'Disabled'}</p>
                    </div>
                    <div className="flex gap-2">
                      <button className="btn-secondary text-sm flex items-center gap-1.5" onClick={() => { setResetUser(resetUser?.id === member.id ? null : member); setResetPassword(''); setAddUserFor(null); }}>
                        <KeyRound size={15} /> Reset password
                      </button>
                      <button className="btn-secondary text-sm" onClick={() => void handleMemberStatus(member)} disabled={busy === `member:${member.id}`}>
                        {member.active ? 'Disable' : 'Enable'}
                      </button>
                    </div>
                    {resetUser?.id === member.id && (
                      <div className="w-full flex flex-col sm:flex-row gap-2">
                        <p className="w-full text-xs text-muted">After resetting the login password, the user can sign in and create a new app PIN if they forgot it.</p>
                        <input aria-label={`New password for ${member.username}`} className="input-field flex-1" type="password" minLength={8} autoComplete="new-password" placeholder="New password (8+ characters)" value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} />
                        <button className="btn-primary" onClick={() => void handleResetPassword()} disabled={resetPassword.length < 8 || busy === `reset:${member.id}`}>
                          {busy === `reset:${member.id}` ? 'Saving…' : 'Save password'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </section>}

    </main>
  );
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="card p-4 flex items-center gap-3">
      <div className="rounded-lg bg-accent/10 p-2 text-accent">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-muted">{label}</p>
        <p className="text-lg font-bold text-primary truncate">{value}</p>
      </div>
    </div>
  );
}

function ShopFact({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-secondary px-3 py-2.5">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-primary" title={value}>{value}</p>
      <p className="mt-0.5 truncate text-xs text-muted" title={detail}>{detail}</p>
    </div>
  );
}

function AdminInput({
  label, value, onChange, type = 'text', ...inputProps
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'>) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-secondary">{label}</span>
      <input className="input-field" type={type} value={value} onChange={(event) => onChange(event.target.value)} {...inputProps} />
    </label>
  );
}

function formatSubscriptionExpiry(expiresAt: string) {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(Date.parse(expiresAt) - 60_000));
}

function formatSubscriptionDate(date: string) {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(date));
}
