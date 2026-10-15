import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Check, LifeBuoy, RefreshCw, Send } from 'lucide-react';
import { MessageList } from './MessageList';
import { supportCall, type SupportConversation, type SupportMessage } from './supportApi';

export function AdminSupportInbox() {
  const [conversations, setConversations] = useState<SupportConversation[]>([]);
  const [selected, setSelected] = useState<SupportConversation | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const result = await supportCall<{ conversations: SupportConversation[] }>('list_admin_conversations');
      const rows = result.conversations || [];
      setConversations(rows);
      setSelected((current) => rows.find((item) => item.id === current?.id) || current || rows[0] || null);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load the support inbox.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMessages = useCallback(async (id: string) => {
    const result = await supportCall<{ messages: SupportMessage[] }>('list_messages', { conversation_id: id });
    setMessages(result.messages || []);
  }, []);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 10_000);
    return () => window.clearInterval(interval);
  }, [load]);

  useEffect(() => {
    if (!selected?.id) { setMessages([]); return; }
    let alive = true;
    const refresh = async () => {
      try {
        const result = await supportCall<{ messages: SupportMessage[] }>('list_messages', { conversation_id: selected.id });
        if (alive) { setMessages(result.messages || []); setError(''); }
      } catch (reason) {
        if (alive) setError(reason instanceof Error ? reason.message : 'Could not refresh this conversation.');
      }
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(), 10_000);
    return () => { alive = false; window.clearInterval(interval); };
  }, [selected?.id]);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected || !reply.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      await supportCall('send_message', { conversation_id: selected.id, message: reply });
      setReply('');
      await loadMessages(selected.id);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not send this reply.');
    } finally {
      setBusy(false);
    }
  };

  const toggleStatus = async () => {
    if (!selected || busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await supportCall<{ conversation: { status: 'open' | 'closed' } }>('set_conversation_status', {
        conversation_id: selected.id,
        status: selected.status === 'open' ? 'closed' : 'open',
      });
      setSelected({ ...selected, status: result.conversation.status });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not update the conversation.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-default p-4">
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-primary flex items-center gap-2"><LifeBuoy size={18} className="text-accent" /> Support inbox</h2>
          <p className="text-sm text-muted mt-1">Reply to landing-page enquiries and shop chats.</p>
        </div>
        <button className="btn-secondary flex shrink-0 items-center gap-2" onClick={() => void load()} disabled={loading}><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh</button>
      </div>
      {error && <p role="alert" className="mx-4 mt-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-600">{error}</p>}
      <div className="grid min-h-[22rem] lg:grid-cols-[minmax(15rem,0.8fr)_minmax(0,1.2fr)]">
        <div className="divide-y divide-default border-b border-default lg:border-b-0 lg:border-r">
          {conversations.length === 0 ? <p className="p-4 text-sm text-muted">{loading ? 'Loading enquiries…' : 'No support conversations yet.'}</p> : conversations.map((item) => (
            <button key={item.id} onClick={() => setSelected(item)} className={`w-full p-4 text-left transition hover:bg-secondary ${selected?.id === item.id ? 'bg-accent/5' : ''}`}>
              <span className="flex items-center justify-between gap-2">
                <span className="font-medium text-primary truncate">{item.contact_name}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] ${item.status === 'open' ? 'bg-green-500/10 text-green-600' : 'bg-secondary text-muted'}`}>{item.status}</span>
              </span>
              <span className="mt-1 block text-xs text-muted">{item.source === 'landing' ? 'Website enquiry' : 'Shop support'} · {new Date(item.last_message_at).toLocaleString('en-IN')}</span>
            </button>
          ))}
        </div>
        <div className="min-w-0 p-4">
          {!selected ? <div className="h-full flex items-center justify-center text-sm text-muted">Choose a conversation to read it.</div> : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-default pb-3">
                <div className="min-w-0">
                  <h3 className="font-semibold text-primary">{selected.contact_name}</h3>
                  <p className="mt-1 text-xs text-muted">{selected.source === 'landing' ? 'Website contact' : 'Shop support'}</p>
                  <p className="mt-2 break-all text-xs text-secondary">{[selected.contact_email, selected.contact_phone, selected.location].filter(Boolean).join(' · ') || `Shop ${selected.shop_id || ''}`}</p>
                </div>
                <button className="btn-secondary flex items-center gap-1.5 text-sm" onClick={() => void toggleStatus()} disabled={busy}>
                  <Check size={14} /> {selected.status === 'open' ? 'Close chat' : 'Reopen chat'}
                </button>
              </div>
              <MessageList messages={messages} currentRole="admin" />
              <form onSubmit={(event) => void send(event)} className="flex gap-2">
                <input className="input-field min-w-0 flex-1" value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Write a reply…" maxLength={4000} />
                <button className="btn-primary px-4" disabled={busy || !reply.trim()} aria-label="Send reply"><Send size={16} /></button>
              </form>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
