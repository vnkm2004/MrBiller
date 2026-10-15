import { ArrowLeft, Database, LifeBuoy, LockKeyhole, ShieldCheck } from 'lucide-react';

const sections = [
  {
    title: '1. Who this policy covers',
    text: 'This policy describes information handled by MrBiller.online, the billing and inventory service available through biller.website. It covers shop owners, shop team members, and people who contact us through the public support page. It does not replace a shop’s own privacy notice or obligations to its customers.',
  },
  {
    title: '2. Information a shop enters',
    text: 'Shop records can include shop name, address, phone number, email, tax number, logo, product names, categories, prices, units, stock quantities, custom units, receipts, dates, totals, tax, payment method, and sales summaries. If a shop adds a buyer to a receipt, that receipt may also contain the buyer’s name or phone number. Shop users choose what to enter and should avoid adding sensitive information that is not needed for billing.',
  },
  {
    title: '3. Login and account information',
    text: 'The service uses Supabase authentication for sign-in and keeps an authentication session in the browser so a user can remain signed in. The app receives account and shop membership identifiers, user ID, role, and shop ID to decide which shop records the account may use. Passwords are handled by the authentication service; do not share them or send them to support.',
  },
  {
    title: '4. Support enquiries and chats',
    text: 'If you start a website enquiry, we collect the name, email address, phone number, location, and message you provide, along with chat messages and their times. Shop support chats are associated with the signed-in shop and account. To let a visitor return to a public chat in the same browser, the app stores a conversation reference and access token in that browser’s local storage. Anyone with access to that browser profile may be able to reopen the chat, so use a private device and clear site data when appropriate.',
  },
  {
    title: '5. Browser storage and the installed app',
    text: 'MrBiller.online uses browser storage for the login session, shop settings, and a local cache of shop products, receipts, and custom units. This local cache lets the app display the current shop’s data efficiently; changes are saved to the cloud through the app. The app may also cache its program files for installation or faster loading. Clearing browser storage can sign you out, remove the local cache, or remove the saved link to a public support chat. It does not by itself delete records already saved in the cloud.',
  },
  {
    title: '6. Why we use information',
    text: 'We use account and shop information to sign users in, separate shop workspaces, provide billing and inventory features, calculate displayed totals, generate receipts, apply access limits, and show shop-level reports. We use support details to answer questions and continue conversations. We may use technical information needed to maintain security, troubleshoot errors, prevent misuse, and keep the service working. We do not currently use invoice or support records for third-party ad targeting.',
  },
  {
    title: '7. Shop access and sharing',
    text: 'Members of the same shop share that shop’s business records according to their account access. Authorized MrBiller.online administrators can manage shop accounts and subscriptions and may access shop-level operational information needed for administration and support. Shop records are designed to be scoped by shop ID so one shop’s ordinary user account cannot view another shop’s records. We do not publish shop records publicly.',
  },
  {
    title: '8. Service providers',
    text: 'The app uses Supabase for authentication, database services, and server-side functions. Information needed to provide those features is sent to and processed by Supabase for this project. The project’s configured hosting region and the provider’s own privacy and security terms determine where and how that cloud processing occurs. We do not sell personal information.',
  },
  {
    title: '9. Retention and deletion requests',
    text: 'Cloud records are kept while needed to operate the shop account, provide support, administer subscriptions, resolve disputes, and meet applicable record-keeping obligations. The app does not currently publish a fixed automatic deletion timetable. A shop owner or contact may ask us to review an access, correction, or deletion request through the Support page. We may need to verify the request and retain some information where law or legitimate business records require it. Deleting a browser cache is separate from deleting cloud data.',
  },
  {
    title: '10. Security',
    text: 'We use account access controls and shop-scoped data handling to reduce the chance of unauthorized access. Keep each user’s credentials private, sign out on shared devices, and tell us promptly through support if an account may be compromised. No internet service, browser, or storage method can be guaranteed completely secure; please do not send passwords, authentication codes, or payment card details in chat.',
  },
  {
    title: '11. Your choices and privacy requests',
    text: 'You can choose whether to enter optional buyer details on a receipt and can contact us to request access to, correction of, or deletion of information where applicable law provides that right. A shop user should first contact their shop owner for records managed by the shop. You can remove the public support chat link from the current browser using “Start a new conversation” or by clearing site storage; this removes the local link, not necessarily the conversation stored in the cloud.',
  },
  {
    title: '12. Children and business use',
    text: 'MrBiller.online is intended for business owners and their shop teams, not for children to use independently. Shop users must only enter customer details that they are authorized to provide and use for the receipt or support purpose.',
  },
  {
    title: '13. Updates and contact',
    text: 'We may update this policy when the product or applicable requirements change. The “Last updated” date shows the latest revision. To ask a privacy question or submit a request, open Contact / support on biller.website and include enough information for us to identify the relevant shop or conversation. Do not include passwords or authentication codes.',
  },
];

export function PrivacyPage({ onBack, onContact, onTerms }: { onBack: () => void; onContact: () => void; onTerms: () => void }) {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f5fbff_0%,#ffffff_45%,#fffaf5_100%)] text-slate-900">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-8 sm:py-6">
        <button onClick={onBack} className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-medium text-slate-600 transition hover:bg-white hover:text-orange-700"><ArrowLeft size={16} /> Back to MrBiller.online</button>
        <button onClick={onContact} className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-orange-700 transition hover:bg-orange-50"><LifeBuoy size={16} /> Privacy questions</button>
      </header>
      <div className="mx-auto grid max-w-6xl gap-6 px-4 pb-14 sm:px-8 lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-10">
        <aside className="h-fit rounded-2xl border border-sky-100 bg-white/85 p-5 shadow-sm lg:sticky lg:top-5">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-700"><LockKeyhole size={21} /></span>
          <p className="mt-4 text-sm font-bold text-slate-900">Your information</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">What MrBiller.online stores, why it is used, and how to contact us.</p>
          <button onClick={onTerms} className="mt-4 block text-left text-sm text-slate-600 hover:text-orange-700">Terms & conditions →</button>
          <button onClick={onContact} className="mt-3 block text-left text-sm text-slate-600 hover:text-orange-700">Contact support →</button>
        </aside>
        <article className="min-w-0 rounded-[1.75rem] border border-sky-100 bg-white p-5 shadow-[0_24px_70px_-42px_rgba(15,83,110,0.23)] sm:p-8 lg:p-10">
          <span className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-800"><ShieldCheck size={15} /> Privacy and data</span>
          <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">Privacy policy</h1>
          <p className="mt-3 text-sm text-slate-500">Last updated: 15 October 2026</p>
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-sky-100 bg-sky-50/70 p-4"><Database size={18} className="mt-0.5 shrink-0 text-sky-700" /><p className="text-sm leading-6 text-sky-950">Shop records are shared with authorized members of that shop. Public support chats are linked to the browser used to start them.</p></div>
          <div className="mt-8 space-y-7 sm:mt-10">
            {sections.map(({ title, text }) => <section key={title} className="border-t border-slate-100 pt-6"><h2 className="text-lg font-semibold tracking-tight">{title}</h2><p className="mt-2 leading-7 text-slate-600">{text}</p></section>)}
          </div>
          <div className="mt-9 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950"><span className="font-semibold">Policy review</span><p className="mt-1">This policy is based on the app’s current features and storage behavior. Before public launch, the service operator should confirm the Supabase hosting region, retention schedule, and formal contact details, then have the policy reviewed for the laws that apply to its business.</p></div>
          <button onClick={onContact} className="mt-5 min-h-11 rounded-xl bg-orange-600 px-5 py-3 font-semibold text-white transition hover:bg-orange-500">Contact us about privacy</button>
        </article>
      </div>
      <footer className="border-t border-sky-100 bg-white px-4 py-5 text-center text-xs text-slate-500">© {new Date().getFullYear()} MrBiller.online · Powered by MrBiller.online</footer>
    </main>
  );
}
