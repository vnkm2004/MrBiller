import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, LifeBuoy, MapPin, MessageCircle, Send, ShieldCheck, Store } from 'lucide-react';
import { MessageList } from '../components/support/MessageList';
import { supportCall, type SupportConversation, type SupportMessage } from '../components/support/supportApi';

const SESSION_KEY = 'biller-public-support-session';
type VisitorSession = { conversationId: string; token: string; name: string };

function readSavedSession(): VisitorSession | null {
  try {
    const value = localStorage.getItem(SESSION_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value) as VisitorSession;
    return parsed.conversationId && parsed.token && parsed.name ? parsed : null;
  } catch {
    return null;
  }
}

export function PublicContactPage({ onBack }: { onBack: () => void }) {
  const [session, setSession] = useState<VisitorSession | null>(() => readSavedSession());
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [firstMessage, setFirstMessage] = useState('');
  const [conversation, setConversation] = useState<SupportConversation | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [syncError, setSyncError] = useState('');

  useEffect(() => {
    if (!session) return;
    let alive = true;
    let syncedOnce = false;
    const refresh = async () => {
      try {
        const result = await supportCall<{ conversation: SupportConversation; messages: SupportMessage[] }>('list_messages', {
          conversation_id: session.conversationId,
          visitor_token: session.token,
        });
        if (alive) {
          syncedOnce = true;
          setConversation(result.conversation);
          setMessages(result.messages || []);
          setSyncError('');
        }
      } catch (reason) {
        if (!alive) return;
        if (!syncedOnce) setSyncError(reason instanceof Error ? reason.message : 'Reconnecting to your chat…');
      }
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(), 10_000);
    return () => { alive = false; window.clearInterval(interval); };
  }, [session]);

  const startChat = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await supportCall<{ conversation: SupportConversation; visitor_token: string; messages: SupportMessage[] }>('create_public_contact', {
        name, email, phone, location, message: firstMessage,
      });
      const next = { conversationId: result.conversation.id, token: result.visitor_token, name: result.conversation.contact_name };
      localStorage.setItem(SESSION_KEY, JSON.stringify(next));
      setSession(next);
      setConversation(result.conversation);
      setMessages(result.messages || []);
      setFirstMessage('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not send your message. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const sendReply = async (event: FormEvent) => {
    event.preventDefault();
    if (!session || !reply.trim() || busy || conversation?.status === 'closed') return;
    setBusy(true);
    setError('');
    try {
      await supportCall('send_message', { conversation_id: session.conversationId, visitor_token: session.token, message: reply });
      setReply('');
      const result = await supportCall<{ conversation: SupportConversation; messages: SupportMessage[] }>('list_messages', {
        conversation_id: session.conversationId, visitor_token: session.token,
      });
      setConversation(result.conversation);
      setMessages(result.messages || []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not send this reply.');
    } finally {
      setBusy(false);
    }
  };

  const startOver = () => {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
    setConversation(null);
    setMessages([]);
    setError('');
    setSyncError('');
  };

  return (
    <div className="public-contact-page relative min-h-screen overflow-hidden bg-[#fff8f1] text-slate-950">
      <div aria-hidden="true" className="pointer-events-none absolute -right-32 -top-40 h-[28rem] w-[28rem] rounded-full bg-orange-200/45 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-40 -left-40 h-[30rem] w-[30rem] rounded-full bg-amber-100/75 blur-3xl" />
      <header className="relative z-10 border-b border-orange-100/80 bg-white/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3.5 sm:px-8 sm:py-4">
          <button onClick={onBack} className="inline-flex min-h-10 items-center gap-2 rounded-xl px-2 text-sm font-medium text-slate-600 transition hover:bg-orange-50 hover:text-orange-700"><ArrowLeft size={17} /> Back to MrBiller.online</button>
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-100 text-orange-700"><Store size={21} /></span>
            <span className="font-bold tracking-tight text-slate-900">MrBiller.online <span className="text-orange-600">Support</span></span>
          </div>
        </div>
      </header>
      <main className="relative z-[1] mx-auto grid max-w-7xl items-start gap-8 px-4 py-8 sm:gap-10 sm:px-8 sm:py-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16 lg:py-16">
        <div className="contact-page-enter space-y-6 lg:sticky lg:top-10 lg:pt-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white/85 px-3.5 py-2 text-sm font-semibold text-orange-700 shadow-sm"><LifeBuoy size={16} /> Here to help your shop</div>
          <div>
            <h1 className="max-w-xl text-4xl font-bold leading-[1.08] tracking-tight text-slate-950 sm:text-5xl lg:text-[3.6rem]">Let’s get your shop <span className="text-orange-600">moving.</span></h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-slate-600 sm:text-lg">Tell us a little about yourself and what you need. Our team will continue the conversation here.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <div className="flex items-start gap-3 rounded-2xl border border-orange-100 bg-white/80 p-4 shadow-sm"><span className="rounded-xl bg-orange-50 p-2.5 text-orange-600"><MessageCircle size={18} /></span><div><p className="text-sm font-semibold text-slate-900">A conversation that stays here</p><p className="mt-1 text-sm leading-5 text-slate-500">Return in this browser to read and reply to your chat.</p></div></div>
            <div className="flex items-start gap-3 rounded-2xl border border-orange-100 bg-white/80 p-4 shadow-sm"><span className="rounded-xl bg-orange-50 p-2.5 text-orange-600"><MapPin size={18} /></span><div><p className="text-sm font-semibold text-slate-900">Help shaped around your shop</p><p className="mt-1 text-sm leading-5 text-slate-500">Your location helps us understand what your business needs.</p></div></div>
          </div>
          <p className="flex items-center gap-2 text-xs leading-5 text-slate-500"><ShieldCheck size={15} className="shrink-0 text-emerald-600" /> Your contact details are used to respond to your support request.</p>
        </div>

        <section className="contact-page-enter contact-page-enter-delay overflow-hidden rounded-[1.75rem] border border-orange-100 bg-white shadow-[0_24px_70px_-32px_rgba(124,45,18,0.28)] sm:rounded-[2rem]">
          <div className="flex items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-orange-50/80 to-white px-5 py-5 sm:px-7">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-100 text-orange-700"><MessageCircle size={21} /></span>
            <div><h2 className="text-lg font-bold text-slate-900">{session ? 'Your support chat' : 'How can we help?'}</h2><p className="mt-0.5 text-sm text-slate-500">{session ? `We’ll reply here, ${session.name}.` : 'Share your details to start a conversation with our team.'}</p></div>
          </div>
          <div className="p-5 sm:p-7">
          {!session ? (
            <>
              <form onSubmit={(event) => void startChat(event)} className="space-y-4">
                <ContactInput label="Your name" value={name} onChange={setName} placeholder="Name" required autoComplete="name" />
                <div className="grid sm:grid-cols-2 gap-4">
                  <ContactInput label="Email address" value={email} onChange={setEmail} placeholder="you@example.com" type="email" required autoComplete="email" />
                  <ContactInput label="Phone number" value={phone} onChange={setPhone} placeholder="Your phone number" type="tel" required autoComplete="tel" />
                </div>
                <ContactInput label="City or location" value={location} onChange={setLocation} placeholder="Your city" required autoComplete="address-level2" />
                <label className="block space-y-1.5">
                  <span className="text-sm font-semibold text-slate-700">Your message</span>
                  <textarea value={firstMessage} onChange={(event) => setFirstMessage(event.target.value)} className="min-h-32 w-full resize-y rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100" placeholder="Tell us what you need help with…" minLength={4} maxLength={4000} required />
                </label>
                {error && <p role="alert" className="rounded-xl border border-red-100 bg-red-50 px-3.5 py-3 text-sm text-red-700">{error}</p>}
                <button disabled={busy} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 py-3 font-semibold text-white shadow-md shadow-orange-600/15 transition hover:bg-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-200 disabled:cursor-not-allowed disabled:opacity-60">
                  {busy ? 'Opening chat…' : <>Send and open chat <ArrowRight size={17} /></>}
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-600"><span className={`h-2 w-2 rounded-full ${conversation?.status === 'closed' ? 'bg-slate-400' : 'bg-emerald-500'}`} />{conversation?.status === 'closed' ? 'Conversation closed' : 'Conversation open'}</span>
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-400"><CheckCircle2 size={14} /> Messages saved in this browser</span>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-[#fbfaf8] px-3 sm:px-4"><MessageList messages={messages} appearance="light" /></div>
              {(error || syncError) && <p role="alert" className="mt-3 rounded-xl border border-red-100 bg-red-50 px-3.5 py-3 text-sm text-red-700">{error || syncError}</p>}
              {(error || syncError) && /support link.*invalid|no longer available|conversation is closed/i.test(error || syncError) && <button type="button" onClick={startOver} className="mt-3 text-sm font-medium text-orange-700 hover:text-orange-800">Start a new conversation</button>}
              {conversation?.status === 'closed' ? (
                <button className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-orange-50 px-4 text-sm font-semibold text-orange-700 transition hover:bg-orange-100" onClick={startOver}>Start a new conversation <ArrowRight size={16} /></button>
              ) : (
                <form onSubmit={(event) => void sendReply(event)} className="mt-4 flex gap-2 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm focus-within:border-orange-300 focus-within:ring-4 focus-within:ring-orange-100">
                  <input value={reply} onChange={(event) => setReply(event.target.value)} className="min-h-11 min-w-0 flex-1 rounded-xl bg-transparent px-3 text-base text-slate-900 outline-none placeholder:text-slate-400 sm:text-sm" placeholder="Write a message…" maxLength={4000} />
                  <button className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-600 text-white transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-40" disabled={busy || !reply.trim()} aria-label="Send message"><Send size={17} /></button>
                </form>
              )}
            </>
          )}
          </div>
        </section>
      </main>
      <footer className="relative z-[1] border-t border-orange-100 bg-white/60 px-4 py-5 text-center text-xs text-slate-500">Powered by MrBiller.online</footer>
    </div>
  );
}

function ContactInput({ label, value, onChange, ...props }: {
  label: string; value: string; onChange: (value: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-2.5 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100 sm:text-sm" {...props} />
    </label>
  );
}
