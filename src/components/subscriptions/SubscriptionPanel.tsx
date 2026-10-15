import { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronUp, Clock3, TicketCheck } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { requireSupabase } from '../../lib/supabase';
import { formatCurrency } from '../../utils/format';

type SubscriptionPlan = {
  id: string;
  name: string;
  description: string | null;
  months: number;
  price: number | string | null;
  max_users: number;
};

type SubscriptionRequest = {
  id: string;
  plan_name: string;
  months: number;
  status: 'pending' | 'approved' | 'declined';
  created_at: string;
};

async function callSubscription(action: string, payload: Record<string, unknown> = {}) {
  const { data, error } = await requireSupabase().functions.invoke('subscription-manage', {
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

function expiryLabel(expiresAt: string) {
  const lastMinute = new Date(Date.parse(expiresAt) - 60_000);
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(lastMinute);
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(value));
}

export function SubscriptionPanel({ compact = false }: { compact?: boolean }) {
  const { user, subscription, subscriptionActive, refreshSubscription } = useApp();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [request, setRequest] = useState<SubscriptionRequest | null>(null);
  const [coupon, setCoupon] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [sentPlan, setSentPlan] = useState<SubscriptionPlan | null>(null);

  const loadOptions = useCallback(async () => {
    if (!user?.shopId) return;
    setError('');
    try {
      const client = requireSupabase();
      const [planResult, requestResult] = await Promise.all([
        client.from('subscription_plans')
          .select('id, name, description, months, price, max_users')
          .eq('active', true)
          .order('months', { ascending: true }),
        client.from('subscription_requests')
          .select('id, plan_name, months, status, created_at')
          .eq('shop_id', user.shopId)
          .order('created_at', { ascending: false })
          .limit(1),
      ]);
      if (planResult.error) throw planResult.error;
      if (requestResult.error) throw requestResult.error;
      setPlans((planResult.data || []) as SubscriptionPlan[]);
      setRequest((requestResult.data?.[0] || null) as SubscriptionRequest | null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load subscription options.');
    } finally {
      setLoading(false);
    }
  }, [user?.shopId]);

  useEffect(() => {
    void loadOptions();
    const interval = window.setInterval(() => void loadOptions(), 30_000);
    return () => window.clearInterval(interval);
  }, [loadOptions]);

  const redeemCoupon = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!coupon.trim() || working) return;
    setWorking('coupon');
    setError('');
    setNotice('');
    try {
      await callSubscription('redeem_coupon', { code: coupon.trim().toUpperCase() });
      await refreshSubscription();
      await loadOptions();
      setCoupon('');
      setNotice('Coupon applied. Your shop subscription has been updated.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not redeem this coupon.');
    } finally {
      setWorking('');
    }
  };

  const openPlanConfirmation = (plan: SubscriptionPlan) => {
    setError('');
    setNotice('');
    setSentPlan(null);
    setSelectedPlan(plan);
  };

  const confirmPlanRequest = async () => {
    const plan = selectedPlan;
    if (!plan || working) return;
    setWorking(plan.id);
    setError('');
    setNotice('');
    try {
      await callSubscription('request_plan', { plan_id: plan.id });
      await loadOptions();
      setSelectedPlan(null);
      setSentPlan(plan);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not send the plan request.');
    } finally {
      setWorking('');
    }
  };

  const title = 'Subscription';
  const hasPendingRequest = request?.status === 'pending';
  const currentPlan = plans.find((plan) => plan.id === subscription?.planId);

  return (
    <section className="card overflow-hidden">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => { setExpanded((open) => !open); setSelectedPlan(null); setSentPlan(null); }}
        className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-secondary/60 md:p-5"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent"><BadgeCheck size={20} /></span>
          <span className="min-w-0">
            <span className="block font-semibold text-primary">{title}</span>
            <span className="mt-0.5 block truncate text-sm text-muted">
              {compact ? 'View plans, coupons, and access dates' : `Manage plans and access for ${user?.shopName || 'this shop'}`}
            </span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className={`hidden rounded-full px-3 py-1 text-xs font-medium sm:inline-flex ${subscriptionActive ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
            {subscriptionActive ? 'Active' : 'Access required'}
          </span>
          {expanded ? <ChevronUp size={20} className="text-muted" /> : <ChevronDown size={20} className="text-muted" />}
        </span>
      </button>

      {expanded && (
        <div className="space-y-4 border-t border-default p-4 md:p-5">
          {error && <p role="alert" className="rounded-lg bg-red-500/10 p-3 text-sm text-red-600">{error}</p>}

          {selectedPlan ? (
            <div className="mx-auto max-w-xl space-y-4 rounded-xl border border-accent/30 bg-accent/5 p-4 md:p-6">
              <button type="button" className="inline-flex items-center gap-1 text-sm font-medium text-secondary hover:text-primary" onClick={() => setSelectedPlan(null)}>
                <ChevronLeft size={17} /> Back to plans
              </button>
              <div>
                <h4 className="text-xl font-bold text-primary">Confirm your plan request</h4>
                <p className="mt-1 text-sm text-muted">Review the subscription details before sending this request to the administrator.</p>
              </div>
              <div className="rounded-lg bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-primary">{selectedPlan.name}</p>
                    {selectedPlan.description && <p className="mt-1 text-sm text-muted">{selectedPlan.description}</p>}
                  </div>
                  <p className="shrink-0 font-bold text-accent">
                    {selectedPlan.price === null ? 'Contact admin' : formatCurrency(Number(selectedPlan.price), 'en')}
                  </p>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-default pt-3 text-sm">
                  <p className="text-secondary">Duration <span className="mt-0.5 block font-medium text-primary">{selectedPlan.months} {selectedPlan.months === 1 ? 'month' : 'months'}</span></p>
                  <p className="text-secondary">User IDs <span className="mt-0.5 block font-medium text-primary">Up to {selectedPlan.max_users}</span></p>
                </div>
              </div>
              <p className="text-xs leading-5 text-muted">Payment is prepaid and handled by the administrator. Your plan starts after payment is confirmed and activated.</p>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" className="btn-secondary" onClick={() => setSelectedPlan(null)} disabled={Boolean(working)}>Go back</button>
                <button type="button" className="btn-primary" onClick={() => void confirmPlanRequest()} disabled={Boolean(working)}>
                  {working === selectedPlan.id ? 'Sending request…' : 'Confirm and send request'}
                </button>
              </div>
            </div>
          ) : sentPlan ? (
            <div className="mx-auto max-w-xl space-y-4 rounded-xl border border-green-500/20 bg-green-500/5 p-5 text-center md:p-7">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-500/10 text-green-600"><Check size={28} /></span>
              <div>
                <h4 className="text-xl font-bold text-primary">Plan request sent</h4>
                <p className="mt-1 text-sm text-secondary">Your request for {sentPlan.name} has been received.</p>
              </div>
              <div className="rounded-lg bg-card p-4 text-left text-sm">
                <p className="flex justify-between gap-3"><span className="text-muted">Plan</span><span className="font-medium text-primary">{sentPlan.name}</span></p>
                <p className="mt-2 flex justify-between gap-3"><span className="text-muted">Price</span><span className="font-medium text-primary">{sentPlan.price === null ? 'Contact admin' : formatCurrency(Number(sentPlan.price), 'en')}</span></p>
                <p className="mt-2 flex justify-between gap-3"><span className="text-muted">Duration</span><span className="font-medium text-primary">{sentPlan.months} {sentPlan.months === 1 ? 'month' : 'months'}</span></p>
              </div>
              <p className="text-sm text-muted">An administrator will confirm payment and activate your prepaid access.</p>
              <button type="button" className="btn-primary w-full" onClick={() => setSentPlan(null)}>Done</button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-secondary p-3">
                  <p className="flex items-center gap-1.5 text-xs text-muted"><CalendarDays size={14} /> Current plan</p>
                  <p className="mt-1 font-medium text-primary">{subscriptionActive ? currentPlan?.name || 'Active plan' : 'No active plan'}
                    {subscriptionActive && <span className="block text-xs font-normal text-muted">Up to {subscription?.maxUsers || currentPlan?.max_users || 2} user IDs</span>}
                  </p>
                </div>
                <div className="rounded-lg bg-secondary p-3">
                  <p className="flex items-center gap-1.5 text-xs text-muted"><CalendarDays size={14} /> Started</p>
                  <p className="mt-1 font-medium text-primary">{subscription ? dateLabel(subscription.startsAt) : 'Not activated'}</p>
                </div>
                <div className="rounded-lg bg-secondary p-3">
                  <p className="flex items-center gap-1.5 text-xs text-muted"><Clock3 size={14} /> Access through</p>
                  <p className="mt-1 font-medium text-primary">{subscription ? expiryLabel(subscription.expiresAt) : 'Not activated'}</p>
                </div>
              </div>

              {request && (
                <p className="rounded-lg bg-secondary p-3 text-sm text-secondary">
                  Latest request: <span className="font-medium text-primary">{request.plan_name}</span> · {request.months} {request.months === 1 ? 'month' : 'months'} ·{' '}
                  <span className={request.status === 'pending' ? 'text-amber-600' : request.status === 'approved' ? 'text-green-600' : 'text-muted'}>
                    {request.status === 'pending' ? 'Waiting for admin' : request.status === 'approved' ? 'Activated' : 'Declined'}
                  </span>
                </p>
              )}
              {notice && <p role="status" className="rounded-lg bg-green-500/10 p-3 text-sm text-green-700">{notice}</p>}

              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-primary">Available plans</h4>
                {loading ? <p className="text-sm text-muted">Loading plans…</p> : plans.length === 0 ? (
                  <p className="text-sm text-muted">No plans are available yet. Contact the administrator.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {plans.map((plan) => (
                      <article key={plan.id} className="space-y-2 rounded-lg border border-default p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h5 className="font-medium text-primary">{plan.name}</h5>
                            {plan.description && <p className="mt-0.5 text-xs text-muted">{plan.description}</p>}
                          </div>
                          <span className="shrink-0 text-sm font-semibold text-accent">{plan.price === null ? 'Contact admin' : formatCurrency(Number(plan.price), 'en')}</span>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs text-muted">{plan.months} {plan.months === 1 ? 'month' : 'months'} · up to {plan.max_users} user IDs</span>
                          <button className="btn-secondary text-sm" onClick={() => openPlanConfirmation(plan)} disabled={loading || Boolean(working) || hasPendingRequest}>
                            {hasPendingRequest ? 'Request pending' : 'Request this plan'}
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted">Payment is handled by the administrator for now. Access starts when a plan is activated and lasts through 11:59 PM on the day before renewal.</p>
              </div>

              <form onSubmit={(event) => void redeemCoupon(event)} className="space-y-2 border-t border-default pt-4">
                <label className="flex items-center gap-2 text-sm font-semibold text-primary" htmlFor="subscription-coupon">
                  <TicketCheck size={17} className="text-accent" /> Have a coupon?
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input id="subscription-coupon" className="input-field flex-1" value={coupon} onChange={(event) => setCoupon(event.target.value.toUpperCase())} placeholder="Enter coupon code" autoComplete="off" />
                  <button className="btn-primary" disabled={!coupon.trim() || Boolean(working)}>{working === 'coupon' ? 'Applying…' : 'Apply coupon'}</button>
                </div>
              </form>
            </>
          )}
        </div>
      )}
    </section>
  );
}
