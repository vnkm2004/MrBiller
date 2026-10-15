import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, BadgeCheck, BarChart3, Check, ChevronLeft, ChevronRight, FileText, LifeBuoy, MessageSquareQuote, PackageCheck, Printer, ReceiptText, ShieldCheck, Sparkles, Star, Store, TrendingUp, Users } from 'lucide-react';
import { requireSupabase } from '../lib/supabase';
import { formatCurrency } from '../utils/format';

type Plan = { id: string; name: string; description: string | null; months: number; price: number | string | null; max_users: number };
type CustomerReview = { id: string; quote: string; name: string; shop?: string; rating: number };

const customerReviews: CustomerReview[] = [
  { id: 'kiran-s', quote: 'I was looking for a simple billing software for my shop, and MrBiller seems like a good option. I like the idea of making bills and keeping track of sales in one place instead of doing everything manually.', name: 'Kiran S.', shop: 'Kirana Store Owner · Bengaluru', rating: 5 },
  { id: 'ramesh-gowda', quote: 'For a small business like mine, having an easy billing system is important. MrBiller has a simple approach, and I like that billing software is becoming more accessible for local shop owners like us.', name: 'Ramesh Gowda', shop: 'General Store Owner · Yelahanka', rating: 5 },
  { id: 'manjunath-k', quote: 'I prefer software that does not make daily work complicated. MrBiller looks clean and straightforward for handling shop billing. A useful option for small retailers who want to move away from handwritten bills.', name: 'Manjunath K.', shop: 'Clothing Shop Owner · Rajajinagar', rating: 5 },
  { id: 'suresh-b', quote: 'Small shops need affordable and easy-to-use billing tools. MrBiller is worth exploring if you want to manage your billing digitally without dealing with an unnecessarily complicated interface.', name: 'Suresh B.', shop: 'Mobile Accessories Shop Owner · Bengaluru', rating: 5 },
  { id: 'prakash-m', quote: 'When you run a small shop, you need something simple that helps with everyday billing. MrBiller looks like it could be useful for local businesses that want a more organized way to manage sales.', name: 'Prakash M.', shop: 'Tea & Snacks Shop Owner · Bengaluru', rating: 5 },
];

export function LandingPage({ onSignIn, onContact, onTerms, onPrivacy }: { onSignIn: () => void; onContact: () => void; onTerms: () => void; onPrivacy: () => void }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState(false);
  const planRequestPending = useRef(false);

  const refreshPlans = useCallback(async () => {
    if (planRequestPending.current) return;
    planRequestPending.current = true;
    setPlansError(false);
    try {
      const { data, error } = await requireSupabase()
        .from('subscription_plans')
        .select('id, name, description, months, price, max_users')
        .eq('active', true)
        .order('price', { ascending: true });
      if (error) throw error;
      setPlans((data || []) as Plan[]);
    } catch {
      // Never show hardcoded prices when the database cannot be reached.
      setPlans([]);
      setPlansError(true);
    } finally {
      setPlansLoading(false);
      planRequestPending.current = false;
    }
  }, []);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refreshPlans();
    };
    void refreshPlans();
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    const refreshTimer = window.setInterval(refreshWhenVisible, 30_000);
    return () => {
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.clearInterval(refreshTimer);
    };
  }, [refreshPlans]);

  useEffect(() => {
    const revealItems = Array.from(document.querySelectorAll<HTMLElement>('.landing-reveal'));
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion || !('IntersectionObserver' in window)) {
      revealItems.forEach((item) => item.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -32px 0px' });

    revealItems.forEach((item) => {
      if (!item.classList.contains('is-visible')) observer.observe(item);
    });
    return () => observer.disconnect();
  }, [plansLoading, plans]);

  return (
    <div className="landing-page-shell relative isolate min-h-screen overflow-hidden bg-[linear-gradient(180deg,#fff8f1_0%,#ffffff_42%,#fffaf5_100%)] text-slate-950">
      <div className="landing-backdrop pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
        <div className="landing-backdrop-grid absolute inset-0" />
        <span className="landing-bg-blob landing-bg-blob-one" />
        <span className="landing-bg-blob landing-bg-blob-two" />
        <span className="landing-bg-blob landing-bg-blob-three" />
      </div>
      <header className="sticky top-0 z-20 border-b border-orange-100/80 bg-[#fffaf5]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-8 sm:py-4">
        <a href="#home" className="flex items-center gap-3" aria-label="MrBiller.online home">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-100 to-amber-50 text-orange-600 shadow-sm ring-1 ring-orange-100"><Store size={23} /></span>
          <span className="min-w-0"><strong className="block text-lg leading-tight">MrBiller.online</strong><small className="block max-w-[40vw] truncate text-xs text-slate-500 sm:max-w-none">Shop billing made simple</small></span>
        </a>
        <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex">
          <a href="#features" className="transition hover:text-orange-600">Features</a>
          <a href="#workflow" className="transition hover:text-orange-600">How it works</a>
          <a href="#reviews" className="transition hover:text-orange-600">Reviews</a>
          <a href="#plans" className="transition hover:text-orange-600">Plans</a>
          <button onClick={onContact} className="transition hover:text-orange-600">Contact</button>
        </nav>
        <button onClick={onSignIn} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600 focus:outline-none focus:ring-4 focus:ring-orange-200">Sign in <span className="ml-1">→</span></button>
        </div>
      </header>

      <nav aria-label="Page sections" className="relative z-10 mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto px-4 pb-3 text-sm font-medium text-slate-600 sm:px-8 md:hidden">
        <a href="#features" className="shrink-0 rounded-full bg-white px-3.5 py-2 shadow-sm">Features</a>
        <a href="#workflow" className="shrink-0 rounded-full bg-white px-3.5 py-2 shadow-sm">How it works</a>
        <a href="#reviews" className="shrink-0 rounded-full bg-white px-3.5 py-2 shadow-sm">Reviews</a>
        <a href="#plans" className="shrink-0 rounded-full bg-white px-3.5 py-2 shadow-sm">Plans</a>
        <button onClick={onContact} className="shrink-0 rounded-full bg-white px-3.5 py-2 shadow-sm">Contact</button>
      </nav>

      <main id="home" className="relative z-10">
        <section className="relative mx-3 mt-5 grid items-center gap-8 overflow-hidden rounded-[2rem] border border-orange-100/80 bg-white/75 px-4 py-8 shadow-[0_30px_90px_-48px_rgba(124,45,18,0.32)] sm:mx-8 sm:mt-8 sm:gap-12 sm:rounded-[2.5rem] sm:px-8 sm:py-12 lg:mx-auto lg:max-w-7xl lg:grid-cols-[1.03fr_0.97fr] lg:px-12 lg:py-14">
          <div className="landing-glow absolute -left-36 top-16 h-96 w-96 rounded-full bg-orange-200/40 blur-3xl" />
          <div className="landing-glow landing-glow-delay absolute -right-40 bottom-0 h-80 w-80 rounded-full bg-amber-100/65 blur-3xl" />
          <div className="landing-reveal relative z-[1]">
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white/90 px-3.5 py-2 text-xs font-semibold text-orange-700 shadow-sm sm:text-sm">
              <Sparkles size={15} className="text-orange-500" /> Made for the everyday shop counter
            </div>
            <h1 className="mt-6 max-w-2xl text-4xl font-bold leading-[1.06] tracking-tight sm:text-6xl lg:text-[4.1rem]">A simpler way to run your <span className="text-orange-600">shop.</span></h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">Create clear receipts, keep stock in view, and see how your shop is doing—all in one easy billing app.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button onClick={onContact} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-orange-600 px-5 py-3 font-semibold text-white shadow-lg shadow-orange-600/20 transition hover:-translate-y-0.5 hover:bg-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-200">Talk to our team <ArrowRight size={17} /></button>
              <a href="#plans" className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 font-semibold text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-300 hover:text-orange-700">View plans <ChevronRight size={16} /></a>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500">
              <span className="inline-flex items-center gap-1.5"><Check size={15} className="text-emerald-600" /> Easy receipts</span>
              <span className="inline-flex items-center gap-1.5"><Check size={15} className="text-emerald-600" /> Shared shop logins</span>
              <span className="inline-flex items-center gap-1.5"><Check size={15} className="text-emerald-600" /> Prepaid monthly plans</span>
            </div>
          </div>

          <div className="landing-reveal landing-reveal-delay relative mx-auto w-full max-w-[590px]">
            <div className="landing-glow absolute -right-5 -top-6 h-32 w-32 rounded-full bg-amber-200/70 blur-2xl" />
            <div className="landing-glow landing-glow-delay absolute -bottom-8 -left-4 h-36 w-36 rounded-full bg-orange-300/45 blur-3xl" />
            <BillingIllustration />
            <div className="landing-float absolute -bottom-5 left-2 rounded-2xl border border-white bg-white px-3 py-2.5 shadow-xl sm:left-0 sm:px-4 sm:py-3">
              <div className="flex items-center gap-3"><span className="rounded-xl bg-emerald-50 p-2 text-emerald-600"><BarChart3 size={19} /></span><div><p className="text-xs text-slate-500">Shop overview</p><p className="text-sm font-semibold">Sales at a glance</p></div></div>
            </div>
            <div className="landing-float landing-float-delay absolute right-0 top-8 rounded-2xl border border-white bg-white px-3 py-2.5 shadow-xl sm:-right-5 sm:top-10 sm:px-4 sm:py-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800"><BadgeCheck size={18} className="text-orange-500" /> Ready to print</div>
              <p className="mt-1 text-xs text-slate-500">A4 and 80 mm receipt layouts</p>
            </div>
          </div>
        </section>

        <section id="features" className="landing-reveal border-y border-orange-100 bg-white/75 py-14 sm:py-20">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-bold uppercase tracking-[0.17em] text-orange-600">Made for real shop work</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Everything at your counter, in one place.</h2>
              <p className="mt-4 text-slate-600">Keep the daily work clear for the owner and the whole team.</p>
            </div>
            <div className="mt-9 grid gap-4 sm:grid-cols-2 md:mt-11 xl:grid-cols-4">
              <FeatureCard icon={<ReceiptText size={21} />} title="Create clear receipts" text="Add products, quantities, discounts, tax, and payment method, then print or download in A4 or 80 mm formats." />
              <FeatureCard icon={<PackageCheck size={21} />} title="Keep stock in view" text="Track available quantities, update prices, and bill from the same shop inventory." />
              <FeatureCard icon={<TrendingUp size={21} />} title="See how you’re doing" text="Review sales totals, bill counts, and best-selling items across the shop team." />
              <FeatureCard icon={<Users size={21} />} title="One team, one shop" text="Give each teammate a login while the shop shares its products, receipts, and reports." />
            </div>
          </div>
        </section>

        <section id="workflow" className="landing-reveal mx-3 my-7 overflow-hidden rounded-[2rem] bg-[#101827] text-white shadow-[0_28px_80px_-42px_rgba(15,23,42,0.7)] sm:mx-8 sm:my-12 lg:mx-auto lg:max-w-7xl">
          <div className="grid items-center gap-5 px-5 py-8 sm:px-9 sm:py-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-10 lg:px-12">
            <div className="relative z-[1]">
              <p className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.15em] text-orange-300"><Sparkles size={15} /> Your shop, in rhythm</p>
              <h2 className="mt-4 max-w-xl text-3xl font-bold leading-tight tracking-tight sm:text-4xl">From the stock shelf to a receipt in a few steps.</h2>
              <p className="mt-4 max-w-xl leading-7 text-slate-300">MrBiller.online keeps the everyday flow together, so your team can spend less time switching between lists and more time serving customers.</p>
              <div className="mt-7 grid gap-4 sm:grid-cols-2">
                <WorkflowPoint icon={<PackageCheck size={18} />} title="Add your products" text="Save units, selling prices, and available stock." />
                <WorkflowPoint icon={<ReceiptText size={18} />} title="Build a receipt" text="Search items, set quantities, and include buyer details when needed." />
                <WorkflowPoint icon={<Printer size={18} />} title="Print your way" text="Download a receipt or print with A4 and 80 mm layouts." />
                <WorkflowPoint icon={<ShieldCheck size={18} />} title="Keep work together" text="The shop team shares its records through individual logins." />
              </div>
              <a href="#plans" className="mt-8 inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 py-2.5 font-semibold text-slate-900 transition hover:-translate-y-0.5 hover:bg-orange-50">Explore plans <ArrowRight size={16} /></a>
            </div>
            <div className="landing-reveal landing-reveal-delay relative mx-auto w-full max-w-[560px] lg:py-3">
              <ShopFlowIllustration />
              <div className="landing-float absolute -left-1 top-8 hidden rounded-2xl border border-white/70 bg-white px-4 py-3 text-slate-900 shadow-xl sm:block lg:-left-4"><span className="flex items-center gap-2 text-sm font-semibold"><Check size={16} className="text-emerald-600" /> Stock updated</span><span className="mt-1 block text-xs text-slate-500">Available to the whole team</span></div>
              <div className="landing-float landing-float-delay absolute -bottom-1 right-0 rounded-2xl border border-white/70 bg-white px-4 py-3 text-slate-900 shadow-xl sm:right-2"><span className="flex items-center gap-2 text-sm font-semibold"><Printer size={16} className="text-orange-600" /> Receipt ready</span><span className="mt-1 block text-xs text-slate-500">A4 or 80 mm</span></div>
            </div>
          </div>
        </section>

        <section className="landing-reveal mx-3 mb-8 rounded-[2rem] border border-orange-100 bg-white/75 px-5 py-8 sm:mx-8 sm:mb-12 sm:px-9 sm:py-11 lg:mx-auto lg:max-w-7xl">
          <div className="mx-auto max-w-2xl text-center"><p className="text-sm font-bold uppercase tracking-[0.17em] text-orange-600">Easy to get started</p><h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">A simple start for your whole shop.</h2><p className="mt-4 leading-7 text-slate-600">Set up your shop, add your team, and keep the day’s work in one shared place.</p></div>
          <div className="relative mt-8 grid gap-4 md:grid-cols-3">
            <HowStep number="01" title="Set up your shop" text="Choose a plan and share your shop details with our team. Your shop’s access is activated after confirmation." />
            <HowStep number="02" title="Add your team and stock" text="Create the shop’s user logins, enter products, and set the quantities you want to track." />
            <HowStep number="03" title="Bill and keep moving" text="Create receipts, print them, and follow sales from the shared shop dashboard." />
          </div>
        </section>

        <ReviewCarousel reviews={customerReviews} onContact={onContact} />

        <section id="plans" className="landing-reveal mx-3 my-6 rounded-[2rem] border border-orange-100/80 bg-white/65 px-4 py-8 sm:mx-8 sm:my-10 sm:px-8 sm:py-12 lg:mx-auto lg:max-w-7xl">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.17em] text-orange-600">Clear monthly pricing</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Choose the team size that fits.</h2>
              <p className="mt-3 text-slate-600">Prepaid access, shared by the whole shop. No automatic renewal.</p>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2 self-start sm:self-auto">
              <button onClick={onTerms} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-orange-600"><FileText size={16} /> Read the terms</button>
              <button onClick={onPrivacy} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-orange-600"><ShieldCheck size={16} /> Privacy policy</button>
            </div>
          </div>
          <div className="mt-9 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {plansLoading && <p className="col-span-full rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500" role="status">Loading current plans…</p>}
            {!plansLoading && plansError && <div className="col-span-full flex flex-col items-start gap-3 rounded-2xl border border-orange-200 bg-white p-6 text-sm text-slate-600"><p>We couldn’t load current prices. Please retry or contact us for the latest plans.</p><button onClick={() => void refreshPlans()} className="rounded-xl bg-orange-600 px-4 py-2 font-semibold text-white hover:bg-orange-500">Retry</button></div>}
            {!plansLoading && !plansError && plans.length === 0 && <p className="col-span-full rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">No plans are currently available. Contact us and we’ll help you choose a plan.</p>}
            {!plansLoading && !plansError && plans.map((plan, index) => (
              <article key={plan.id} className={`landing-reveal relative flex flex-col rounded-2xl border p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg ${index === 2 ? 'border-orange-300 bg-gradient-to-b from-orange-50/80 to-white shadow-orange-100' : 'border-slate-200/90 bg-white'}`}>
                {index === 2 && <span className="absolute -top-3 left-5 rounded-full bg-orange-600 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">Popular</span>}
                <div className="min-h-20">
                  <h3 className="font-semibold text-slate-900">{plan.name}</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{plan.description || 'Monthly shop access'}</p>
                </div>
                <p className="mt-3 flex items-baseline gap-1"><span className="text-3xl font-bold tracking-tight">{plan.price === null ? 'Contact' : formatCurrency(Number(plan.price), 'en')}</span><span className="text-sm text-slate-500">{plan.months === 1 ? '/month' : `/${plan.months} months`}</span></p>
                <p className="mt-4 flex items-center gap-2 text-sm text-slate-700"><Users size={16} className="text-orange-600" /> Up to {plan.max_users} user IDs</p>
                <button onClick={onContact} className={`mt-6 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${index === 2 ? 'bg-orange-600 text-white hover:bg-orange-500' : 'bg-orange-50 text-orange-700 hover:bg-orange-100'}`}>Ask about this plan</button>
              </article>
            ))}
          </div>
          <p className="mt-4 text-xs text-slate-500">User ID limits include the owner login. Every shop receives one complimentary first month. Payment is collected before activation.</p>
        </section>

        <section className="landing-reveal relative mx-3 mb-12 overflow-hidden rounded-[2rem] bg-gradient-to-br from-orange-600 via-orange-600 to-amber-500 px-5 py-9 text-white shadow-[0_24px_65px_-32px_rgba(234,88,12,0.65)] sm:mx-8 sm:mb-16 sm:px-12 sm:py-14">
          <div aria-hidden="true" className="absolute -right-20 -top-32 h-80 w-80 rounded-full border-[36px] border-white/10" />
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-5 sm:flex-row sm:items-center sm:gap-7">
            <div className="relative max-w-2xl"><p className="text-sm font-semibold text-orange-100">Want to see how it works?</p><h2 className="mt-2 text-2xl font-bold sm:text-3xl">Let’s find the right setup for your shop.</h2><p className="mt-3 text-orange-50">Send your details and a message. We’ll continue the conversation right here.</p></div>
            <button onClick={onContact} className="relative inline-flex min-h-12 shrink-0 items-center gap-2 rounded-xl bg-white px-5 py-3 font-semibold text-orange-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-orange-50">Contact us <ArrowRight size={17} /></button>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-orange-100 bg-white px-5 py-6 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 text-center text-sm text-slate-500 sm:flex-row sm:text-left">
          <p>© {new Date().getFullYear()} MrBiller.online · Powered by MrBiller.online</p>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3 sm:justify-end"><button onClick={onPrivacy} className="hover:text-orange-600">Privacy policy</button><button onClick={onTerms} className="hover:text-orange-600">Terms & conditions</button><button onClick={onContact} className="inline-flex items-center gap-1 hover:text-orange-600"><LifeBuoy size={15} /> Contact / support</button><button onClick={onSignIn} className="hover:text-orange-600">Sign in</button></div>
        </div>
      </footer>
    </div>
  );
}

function ReviewCarousel({ reviews, onContact }: { reviews: CustomerReview[]; onContact: () => void }) {
  const [activeReview, setActiveReview] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (reviews.length < 2 || paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => {
      setActiveReview((current) => (current + 1) % reviews.length);
    }, 5500);
    return () => window.clearInterval(timer);
  }, [paused, reviews.length]);

  const showReview = (index: number) => setActiveReview((index + reviews.length) % reviews.length);

  return (
    <section id="reviews" aria-labelledby="reviews-heading" className="landing-reveal mx-3 my-8 rounded-[2rem] border border-orange-100 bg-gradient-to-br from-white/95 via-orange-50/75 to-amber-50/90 px-5 py-9 shadow-[0_24px_70px_-48px_rgba(124,45,18,0.35)] sm:mx-8 sm:my-12 sm:px-9 sm:py-12 lg:mx-auto lg:max-w-7xl">
      <div className="mx-auto max-w-3xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.13em] text-orange-700"><MessageSquareQuote size={15} /> From local shop owners</span>
        <h2 id="reviews-heading" className="mt-4 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Reviews from shop owners</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">Hear how shop owners see MrBiller.online fitting into their day-to-day work.</p>
      </div>

      {reviews.length === 0 ? (
        <div className="mx-auto mt-8 max-w-3xl rounded-3xl border border-orange-100 bg-white/90 px-6 py-8 text-center shadow-sm sm:px-10 sm:py-10">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100 text-orange-600"><MessageSquareQuote size={22} /></span>
          <p className="mt-4 text-lg font-semibold text-slate-900">Customer reviews are coming soon</p>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-600">We’ll share feedback here once shop owners have given permission to feature their words. Have you used MrBiller.online? We’d love to hear from you.</p>
          <button onClick={onContact} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-200">Share your feedback <ArrowRight size={16} /></button>
        </div>
      ) : (
        <div className="mx-auto mt-8 max-w-4xl" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocusCapture={() => setPaused(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false); }}>
          <div className="relative overflow-hidden rounded-3xl border border-orange-100 bg-white/95 p-6 shadow-sm sm:p-10" role="region" aria-roledescription="carousel" aria-label="Customer reviews">
            {reviews.map((review, index) => index === activeReview && (
              <article key={review.id} className="landing-review-slide min-h-52" role="group" aria-roledescription="slide" aria-label={`${index + 1} of ${reviews.length}`}>
                <div className="flex justify-center gap-1 text-amber-500" aria-label={`${review.rating} out of 5 stars`}>
                  {Array.from({ length: 5 }, (_, starIndex) => <Star key={starIndex} size={17} fill={starIndex < review.rating ? 'currentColor' : 'none'} aria-hidden="true" />)}
                </div>
                <blockquote className="mx-auto mt-5 max-w-3xl text-center text-xl font-medium leading-8 tracking-tight text-slate-800 sm:text-2xl sm:leading-9">“{review.quote}”</blockquote>
                <div className="mt-6 text-center"><p className="font-semibold text-slate-950">{review.name}</p>{review.shop && <p className="mt-1 text-sm text-slate-500">{review.shop}</p>}</div>
              </article>
            ))}
          </div>
          <div className="mt-5 flex items-center justify-center gap-4">
            <button type="button" onClick={() => showReview(activeReview - 1)} disabled={reviews.length < 2} aria-label="Previous review" className="flex h-10 w-10 items-center justify-center rounded-full border border-orange-200 bg-white text-slate-700 transition hover:border-orange-400 hover:text-orange-700 disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft size={18} /></button>
            <div className="flex items-center gap-2" aria-label="Choose a review">
              {reviews.map((review, index) => <button type="button" key={review.id} onClick={() => showReview(index)} aria-label={`Show review ${index + 1}`} aria-current={index === activeReview ? 'true' : undefined} className={`h-2.5 rounded-full transition-all ${index === activeReview ? 'w-7 bg-orange-600' : 'w-2.5 bg-orange-200 hover:bg-orange-300'}`} />)}
            </div>
            <button type="button" onClick={() => showReview(activeReview + 1)} disabled={reviews.length < 2} aria-label="Next review" className="flex h-10 w-10 items-center justify-center rounded-full border border-orange-200 bg-white text-slate-700 transition hover:border-orange-400 hover:text-orange-700 disabled:cursor-not-allowed disabled:opacity-40"><ChevronRight size={18} /></button>
          </div>
        </div>
      )}
    </section>
  );
}

function FeatureCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <article className="landing-reveal rounded-2xl border border-slate-200 bg-[#fffdfa] p-5 transition duration-300 hover:-translate-y-1 hover:border-orange-200 hover:shadow-lg sm:p-6"><span className="inline-flex rounded-xl bg-orange-100 p-3 text-orange-700">{icon}</span><h3 className="mt-5 font-semibold text-slate-950">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></article>;
}

function WorkflowPoint({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="flex items-start gap-3"><span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-500/15 text-orange-300 ring-1 ring-orange-300/20">{icon}</span><div><h3 className="text-sm font-semibold text-white">{title}</h3><p className="mt-1 text-sm leading-5 text-slate-400">{text}</p></div></div>;
}

function HowStep({ number, title, text }: { number: string; title: string; text: string }) {
  return <article className="group landing-reveal rounded-2xl border border-slate-200 bg-[#fffdfa] p-5 transition duration-300 hover:-translate-y-1 hover:border-orange-200 hover:shadow-lg sm:p-6"><span className="inline-flex h-10 min-w-10 items-center justify-center rounded-xl bg-orange-100 px-2 text-sm font-bold text-orange-700 transition group-hover:bg-orange-600 group-hover:text-white">{number}</span><h3 className="mt-4 font-semibold text-slate-950">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></article>;
}

function ShopFlowIllustration() {
  return (
    <svg viewBox="0 0 560 420" role="img" aria-label="Illustration showing inventory, billing, and a printed receipt working together" className="relative z-0 w-full drop-shadow-[0_28px_45px_rgba(0,0,0,0.28)]">
      <defs><linearGradient id="flow-glass" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#263247"/><stop offset="1" stopColor="#172033"/></linearGradient><linearGradient id="flow-paper" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#fff"/><stop offset="1" stopColor="#f8fafc"/></linearGradient></defs>
      <circle cx="280" cy="210" r="172" fill="#fb923c" opacity=".08"/><circle className="landing-orbit" cx="280" cy="210" r="154" fill="none" stroke="#fdba74" strokeOpacity=".24" strokeDasharray="4 9"/><circle className="landing-orbit landing-orbit-reverse" cx="280" cy="210" r="190" fill="none" stroke="#fff" strokeOpacity=".09" strokeDasharray="3 12"/>
      <g className="landing-art-card"><rect x="39" y="84" width="306" height="248" rx="24" fill="url(#flow-glass)" stroke="#ffffff" strokeOpacity=".15"/><rect x="39" y="84" width="306" height="52" rx="24" fill="#1c283b"/><path d="M39 112v24h306v-24" fill="#1c283b"/><circle cx="64" cy="110" r="5" fill="#fb923c"/><circle cx="81" cy="110" r="5" fill="#fbbf24"/><circle cx="98" cy="110" r="5" fill="#4ade80"/><rect x="65" y="158" width="107" height="8" rx="4" fill="#e2e8f0"/><rect x="65" y="175" width="162" height="6" rx="3" fill="#64748b"/><rect x="65" y="205" width="252" height="1" fill="#ffffff" opacity=".12"/>
      <rect x="65" y="222" width="252" height="42" rx="12" fill="#ffffff" opacity=".06"/><circle cx="87" cy="243" r="11" fill="#fed7aa"/><path d="M81 245h12m-6-7v10" stroke="#c2410c" strokeWidth="1.5"/><rect x="107" y="235" width="79" height="6" rx="3" fill="#e2e8f0"/><rect x="107" y="246" width="45" height="5" rx="2.5" fill="#64748b"/><rect x="270" y="237" width="27" height="9" rx="4.5" fill="#4ade80" opacity=".8"/>
      <rect x="65" y="275" width="252" height="42" rx="12" fill="#ffffff" opacity=".06"/><circle cx="87" cy="296" r="11" fill="#bfdbfe"/><path d="M82 296h10m-5-5v10" stroke="#2563eb" strokeWidth="1.5"/><rect x="107" y="288" width="91" height="6" rx="3" fill="#e2e8f0"/><rect x="107" y="299" width="53" height="5" rx="2.5" fill="#64748b"/><rect x="270" y="290" width="27" height="9" rx="4.5" fill="#fdba74" opacity=".9"/></g>
      <g className="landing-art-receipt"><rect x="371" y="116" width="149" height="248" rx="19" fill="#0b1220" opacity=".5"/><rect x="383" y="103" width="149" height="248" rx="19" fill="url(#flow-paper)"/><circle cx="407" cy="128" r="11" fill="#ffedd5"/><path d="M400 131h14l-2-5h-10l-2 5Zm1 1v6h4v-4h4v4h4v-6" fill="none" stroke="#ea580c" strokeWidth="1.5"/><rect x="427" y="124" width="68" height="7" rx="3.5" fill="#0f172a"/><rect x="427" y="137" width="49" height="5" rx="2.5" fill="#94a3b8"/><path d="M400 161h116" stroke="#fdba74" strokeWidth="2"/><rect x="400" y="180" width="58" height="5" rx="2.5" fill="#64748b"/><rect x="483" y="180" width="33" height="5" rx="2.5" fill="#0f172a"/><rect x="400" y="199" width="72" height="5" rx="2.5" fill="#64748b"/><rect x="483" y="199" width="33" height="5" rx="2.5" fill="#0f172a"/><rect x="400" y="218" width="50" height="5" rx="2.5" fill="#64748b"/><rect x="483" y="218" width="33" height="5" rx="2.5" fill="#0f172a"/><path d="M400 241h116" stroke="#e2e8f0"/><rect x="400" y="258" width="45" height="6" rx="3" fill="#475569"/><rect x="473" y="256" width="43" height="10" rx="5" fill="#ea580c"/><rect x="400" y="284" width="116" height="35" rx="10" fill="#fff7ed"/><path d="m411 302 5 5 10-11" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><rect x="435" y="297" width="55" height="5" rx="2.5" fill="#cbd5e1"/><rect x="435" y="307" width="39" height="4" rx="2" fill="#e2e8f0"/></g>
      <g className="landing-art-spark"><circle cx="359" cy="75" r="18" fill="#fb923c" opacity=".18"/><path d="M359 66v18m-9-9h18" stroke="#fdba74" strokeWidth="2" strokeLinecap="round"/><circle cx="57" cy="364" r="14" fill="#4ade80" opacity=".12"/><path d="m52 364 4 4 7-9" fill="none" stroke="#86efac" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></g>
    </svg>
  );
}

function BillingIllustration() {
  return (
    <svg viewBox="0 0 620 485" role="img" aria-label="Illustration of a shop billing dashboard and receipt" className="relative z-0 w-full drop-shadow-[0_28px_45px_rgba(87,43,14,0.18)]">
      <defs><linearGradient id="hero-bg" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#ffedd5"/><stop offset="1" stopColor="#fed7aa"/></linearGradient><linearGradient id="card-bg" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff"/><stop offset="1" stopColor="#fffaf5"/></linearGradient></defs>
      <rect x="35" y="28" width="550" height="424" rx="36" fill="url(#hero-bg)" />
      <circle cx="515" cy="84" r="22" fill="#fb923c" opacity=".24"/><circle cx="97" cy="389" r="35" fill="#f97316" opacity=".14"/>
      <rect x="71" y="67" width="348" height="325" rx="24" fill="url(#card-bg)" stroke="#f1f5f9" strokeWidth="2" />
      <rect x="71" y="67" width="348" height="58" rx="24" fill="#fff"/><path d="M71 105v20h348v-20" fill="#fff"/>
      <rect x="91" y="83" width="28" height="28" rx="9" fill="#ffedd5"/><path d="M97 97h16l-2-6h-12l-2 6Zm1 1v8h5v-5h4v5h5v-8" stroke="#ea580c" strokeWidth="2" fill="none" strokeLinejoin="round"/>
      <rect x="130" y="87" width="90" height="9" rx="4.5" fill="#0f172a"/><rect x="130" y="102" width="53" height="6" rx="3" fill="#cbd5e1"/>
      <circle cx="382" cy="97" r="14" fill="#fff7ed"/><path d="M377 97h10m-5-5v10" stroke="#ea580c" strokeWidth="2" strokeLinecap="round"/>
      <text x="94" y="157" fill="#475569" fontSize="13" fontFamily="Inter, sans-serif">Today’s sales</text><text x="94" y="187" fill="#0f172a" fontSize="26" fontWeight="700" fontFamily="Inter, sans-serif">₹ 18,450</text>
      <rect x="315" y="144" width="79" height="51" rx="14" fill="#fff7ed"/><path d="M330 177l13-12 10 7 15-15" fill="none" stroke="#ea580c" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/><path d="M363 157h5v5" fill="none" stroke="#ea580c" strokeWidth="2"/>
      <rect x="92" y="209" width="306" height="1" fill="#e2e8f0"/><text x="94" y="234" fill="#64748b" fontSize="12" fontFamily="Inter, sans-serif">Recent receipts</text>
      <rect x="92" y="248" width="306" height="54" rx="13" fill="#fff" stroke="#f1f5f9"/><circle cx="116" cy="275" r="14" fill="#ffedd5"/><path d="M111 269h10v13h-10zM113 272h6m-6 3h6m-6 3h4" fill="none" stroke="#ea580c" strokeWidth="1.5"/><text x="140" y="271" fill="#0f172a" fontSize="12" fontWeight="600" fontFamily="Inter, sans-serif">Fresh Market</text><text x="140" y="287" fill="#94a3b8" fontSize="10" fontFamily="Inter, sans-serif">3 items · just now</text><text x="370" y="280" textAnchor="end" fill="#0f172a" fontSize="12" fontWeight="700" fontFamily="Inter, sans-serif">₹ 890</text>
      <rect x="92" y="311" width="306" height="54" rx="13" fill="#fff" stroke="#f1f5f9"/><circle cx="116" cy="338" r="14" fill="#dcfce7"/><path d="M109 338h14m-7-7v14" stroke="#16a34a" strokeWidth="1.7" strokeLinecap="round"/><text x="140" y="334" fill="#0f172a" fontSize="12" fontWeight="600" fontFamily="Inter, sans-serif">Sunrise Stores</text><text x="140" y="350" fill="#94a3b8" fontSize="10" fontFamily="Inter, sans-serif">5 items · 8 min ago</text><text x="370" y="343" textAnchor="end" fill="#0f172a" fontSize="12" fontWeight="700" fontFamily="Inter, sans-serif">₹ 1,240</text>
      <rect x="445" y="139" width="116" height="245" rx="18" fill="#0f172a"/><rect x="454" y="152" width="98" height="217" rx="12" fill="#fff"/>
      <rect x="464" y="166" width="24" height="24" rx="7" fill="#ffedd5"/><path d="M469 177h14l-2-5h-10l-2 5Zm1 1v6h4v-4h4v4h4v-6" stroke="#ea580c" strokeWidth="1.5" fill="none"/><rect x="495" y="171" width="46" height="6" rx="3" fill="#0f172a"/><rect x="495" y="181" width="36" height="4" rx="2" fill="#94a3b8"/>
      <path d="M463 204h80" stroke="#fdba74" strokeWidth="2"/><text x="463" y="221" fill="#0f172a" fontSize="8" fontWeight="700" fontFamily="Inter, sans-serif">RECEIPT</text>
      <text x="463" y="240" fill="#475569" fontSize="7" fontFamily="Inter, sans-serif">Rice · 2 kg</text><text x="543" y="240" textAnchor="end" fill="#0f172a" fontSize="7" fontFamily="Inter, sans-serif">₹ 180</text>
      <path d="M463 247h80" stroke="#e2e8f0"/><text x="463" y="262" fill="#475569" fontSize="7" fontFamily="Inter, sans-serif">Milk · 1 L</text><text x="543" y="262" textAnchor="end" fill="#0f172a" fontSize="7" fontFamily="Inter, sans-serif">₹ 60</text>
      <path d="M463 270h80" stroke="#e2e8f0"/><text x="463" y="286" fill="#0f172a" fontSize="8" fontWeight="700" fontFamily="Inter, sans-serif">TOTAL</text><text x="543" y="286" textAnchor="end" fill="#0f172a" fontSize="8" fontWeight="700" fontFamily="Inter, sans-serif">₹ 240</text>
      <rect x="463" y="303" width="80" height="25" rx="7" fill="#ea580c"/><text x="503" y="319" textAnchor="middle" fill="#fff" fontSize="8" fontWeight="600" fontFamily="Inter, sans-serif">PRINT RECEIPT</text>
      <rect x="458" y="394" width="90" height="36" rx="12" fill="#fff" stroke="#fed7aa"/><circle cx="476" cy="412" r="8" fill="#dcfce7"/><path d="m472 412 3 3 5-6" fill="none" stroke="#16a34a" strokeWidth="1.5"/><rect x="491" y="407" width="45" height="5" rx="2.5" fill="#cbd5e1"/><rect x="491" y="416" width="31" height="4" rx="2" fill="#e2e8f0"/>
    </svg>
  );
}
