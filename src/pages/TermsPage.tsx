import { ArrowLeft, BadgeCheck, FileText, LifeBuoy, ShieldCheck } from 'lucide-react';

const sections = [
  {
    title: '1. About these terms',
    text: 'These terms explain how shops and their team members may use MrBiller.online, the shop billing and inventory service available through biller.website. By signing in or using the service, you agree to these terms on behalf of yourself and, where applicable, the shop you represent. If you do not have authority to act for a shop, do not create or manage its account.',
  },
  {
    title: '2. Shop accounts and access',
    text: 'A shop owner or administrator is responsible for inviting the right team members, assigning individual user IDs, and removing access when a person leaves. Keep passwords and authentication codes private. You are responsible for activity performed with your login and should contact support promptly if you suspect unauthorized access. Team members in the same shop can work with that shop’s shared products, inventory, settings, receipts, and sales summaries. Separate shops have separate records.',
  },
  {
    title: '3. Plans, user limits, and access dates',
    text: 'Current prices, plan durations, and user ID limits are shown on the Plans page and are loaded from the current plan list. A plan’s user limit includes the owner login. Shop access starts when an administrator activates or grants the plan. For a monthly term, access ends at 11:59 PM India time on the day before the corresponding date in the next month; the date shown in the app is the effective expiry. If a shop already has active time, a new grant may extend that period instead of replacing it.',
  },
  {
    title: '4. Prepaid payments, renewals, and requests',
    text: 'Plans are prepaid. A request or conversation about a plan does not itself activate paid access; activation follows the payment confirmation and administrator action. There is no automatic recurring charge or renewal. To continue after expiry, contact support and arrange another prepaid period. Keep payment confirmations until access is active and check the plan and expiry displayed for your shop.',
  },
  {
    title: '5. Complimentary access and coupons',
    text: 'Each eligible shop is currently offered one complimentary first month, subject to the Starter plan’s user ID limit and the activation shown in the app. Coupons are governed by their displayed or communicated plan, duration, expiry date, and redemption limit. A coupon can be rejected if it is expired, disabled, already used beyond its limit, or entered for an ineligible shop. Do not sell or publicly post a coupon intended for a specific recipient.',
  },
  {
    title: '6. Your shop data and business decisions',
    text: 'Your shop remains responsible for the products, prices, stock quantities, taxes, customer details, payment methods, and receipt contents entered by its team. MrBiller.online is a record-keeping and billing tool; it does not decide whether a tax rate, invoice, or business practice satisfies rules applicable to your shop. Review each receipt before sharing it, maintain any independent records or backups your business needs, and only enter customer information you are allowed to use.',
  },
  {
    title: '7. Acceptable use',
    text: 'Use the service for lawful shop operations. Do not probe or bypass access controls, access another shop’s records, disrupt the service, upload malicious content, or use the app to violate another person’s rights. Do not share a login where an individual login has been provided. We may investigate misuse and restrict access when reasonably necessary to protect shops, users, or the service.',
  },
  {
    title: '8. Data syncing, devices, and availability',
    text: 'The app stores shop records in its cloud database and keeps a browser-side cache to support the interface. A device can be lost, cleared, offline, or unable to sync; do not treat a local display as proof that an unsynced change was saved. Confirm important changes and receipts appear in the app, and keep separate copies of records where needed. We work to keep MrBiller.online available but do not promise uninterrupted access. Maintenance, connectivity failures, device or browser issues, and events outside our reasonable control can interrupt service.',
  },
  {
    title: '9. Support and communications',
    text: 'You can contact the MrBiller.online team through the support chat. Public enquiries ask for your name, email address, phone number, location, and message so the team can respond. Shop users may also start an in-app support conversation. Please do not send passwords, payment card details, or other sensitive information in chat.',
  },
  {
    title: '10. Expiry, suspension, and ending use',
    text: 'When a subscription expires, shop access to subscription-protected features may be paused until a new period is activated. An administrator may also suspend a shop or login. We may restrict access where needed to address suspected fraud, security risks, unlawful use, or a serious breach of these terms. A shop administrator can stop using the service and should contact support about account closure and data handling. Expiry or closure does not remove the shop’s responsibility for its prior transactions or legal record-keeping.',
  },
  {
    title: '11. Refund questions and billing corrections',
    text: 'If you believe a payment was incorrect, a plan was activated in error, or an agreed access period is missing, contact support with the shop ID and relevant payment reference. We will review the request and any refund or correction under applicable law and the facts of the transaction. These terms do not remove rights that cannot legally be waived.',
  },
  {
    title: '12. Changes to the service or these terms',
    text: 'We may update features, supported devices, plans, or these terms as the service develops. Current plan details are shown before a new plan request. We will update the date on this page when the terms change. A change to future prices or features does not by itself change the expiry date of an already activated subscription. Continued use after updated terms are published means you accept them, to the extent permitted by law.',
  },
  {
    title: '13. Service limits and responsibility',
    text: 'We provide tools to help shops prepare receipts and review records, but the shop must verify its own entries and keep records required for its business. To the extent permitted by law, MrBiller.online is not responsible for losses caused by incorrect data entered by a shop, a user sharing credentials, an unsupported device, or an outage outside our reasonable control. Nothing here excludes liability that applicable law does not allow us to exclude.',
  },
  {
    title: '14. Governing law and questions',
    text: 'These terms are subject to applicable law. Any mandatory consumer or other legal protections continue to apply. Contact the MrBiller.online team through the Support page first so we can try to resolve a concern. The service operator should complete a legal review of its formal business identity and dispute forum before treating this draft as final.',
  },
];

export function TermsPage({ onBack, onContact, onPrivacy }: { onBack: () => void; onContact: () => void; onPrivacy: () => void }) {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#fff8f1_0%,#ffffff_45%,#fffaf5_100%)] text-slate-900">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-8 sm:py-6">
        <button onClick={onBack} className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-medium text-slate-600 transition hover:bg-white hover:text-orange-700"><ArrowLeft size={16} /> Back to MrBiller.online</button>
        <button onClick={onContact} className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-orange-700 transition hover:bg-orange-50"><LifeBuoy size={16} /> Contact support</button>
      </header>
      <div className="mx-auto grid max-w-6xl gap-6 px-4 pb-14 sm:px-8 lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-10">
        <aside className="h-fit rounded-2xl border border-orange-100 bg-white/80 p-5 shadow-sm lg:sticky lg:top-5">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-100 text-orange-700"><FileText size={21} /></span>
          <p className="mt-4 text-sm font-bold text-slate-900">MrBiller.online policies</p>
          <button onClick={onPrivacy} className="mt-3 block text-left text-sm text-slate-600 hover:text-orange-700">Privacy policy →</button>
          <button onClick={onContact} className="mt-3 block text-left text-sm text-slate-600 hover:text-orange-700">Ask a question →</button>
        </aside>
        <article className="min-w-0 rounded-[1.75rem] border border-orange-100 bg-white p-5 shadow-[0_24px_70px_-42px_rgba(124,45,18,0.3)] sm:p-8 lg:p-10">
          <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800"><BadgeCheck size={15} /> Service terms</span>
          <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">Terms & conditions</h1>
          <p className="mt-3 text-sm text-slate-500">Last updated: 15 October 2026</p>
          <p className="mt-6 max-w-3xl leading-7 text-slate-600">These terms cover shop accounts, team access, subscriptions, and the records created in MrBiller.online. Please read them with the <button onClick={onPrivacy} className="font-semibold text-orange-700 underline decoration-orange-200 underline-offset-2 hover:text-orange-600">Privacy Policy</button>.</p>
          <div className="mt-8 space-y-7 sm:mt-10">
            {sections.map(({ title, text }) => <section key={title} className="scroll-mt-5 border-t border-slate-100 pt-6"><h2 className="text-lg font-semibold tracking-tight">{title}</h2><p className="mt-2 leading-7 text-slate-600">{text}</p></section>)}
          </div>
          <div className="mt-9 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950"><span className="flex items-center gap-2 font-semibold"><ShieldCheck size={16} /> Please review before launch</span><p className="mt-1">This detailed draft reflects the current product flow. The service operator should have a qualified Indian legal professional review it, especially the operator identity, refunds, data retention, and dispute contact details.</p></div>
          <button onClick={onContact} className="mt-5 min-h-11 rounded-xl bg-orange-600 px-5 py-3 font-semibold text-white transition hover:bg-orange-500">Contact us about these terms</button>
        </article>
      </div>
      <footer className="border-t border-orange-100 bg-white px-4 py-5 text-center text-xs text-slate-500">© {new Date().getFullYear()} MrBiller.online · Powered by MrBiller.online</footer>
    </main>
  );
}
