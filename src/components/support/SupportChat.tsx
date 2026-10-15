import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { LifeBuoy, MessageCircle, Plus, Send } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { MessageList } from './MessageList';
import { supportCall, type SupportConversation, type SupportMessage } from './supportApi';

export function SupportChat() {
  const { user } = useApp();
  const [conversations, setConversations] = useState<SupportConversation[]>([]);
  const [conversation, setConversation] = useState<SupportConversation | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [firstMessage, setFirstMessage] = useState('');
  const [startNew, setStartNew] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const loadConversations = useCallback(async () => {
    try {
      const result = await supportCall<{ conversations: SupportConversation[] }>('list_shop_conversations');
      const rows = result.conversations || [];
      setConversations(rows);
      setConversation((current) => startNew ? null : rows.find((item) => item.id === current?.id) || rows[0] || null);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load support chat.');
    } finally {
      setLoading(false);
    }
  }, [startNew]);

  const loadMessages = useCallback(async (id: string) => {
    const result = await supportCall<{ conversation: SupportConversation; messages: SupportMessage[] }>('list_messages', { conversation_id: id });
    setConversation((current) => current?.id === id ? { ...current, ...result.conversation } : current);
    setMessages(result.messages || []);
  }, []);

  useEffect(() => {
    void loadConversations();
    const interval = window.setInterval(() => void loadConversations(), 15_000);
    return () => window.clearInterval(interval);
  }, [loadConversations]);

  useEffect(() => {
    if (!conversation?.id) { setMessages([]); return; }
    let alive = true;
    const refresh = async () => {
      try {
        const result = await supportCall<{ conversation: SupportConversation; messages: SupportMessage[] }>('list_messages', { conversation_id: conversation.id });
        if (alive) {
          setMessages(result.messages || []);
          setConversation((current) => current?.id === conversation.id ? { ...current, ...result.conversation } : current);
          setError('');
        }
      } catch (reason) {
        if (alive) setError(reason instanceof Error ? reason.message : 'Could not refresh the chat.');
      }
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(), 10_000);
    return () => { alive = false; window.clearInterval(interval); };
  }, [conversation?.id]);

  const startConversation = async (event: FormEvent) => {
    event.preventDefault();
    if (!firstMessage.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await supportCall<{ conversation: SupportConversation; messages: SupportMessage[] }>('start_shop_conversation', { message: firstMessage });
      setConversations((items) => [result.conversation, ...items]);
      setConversation(result.conversation);
      setMessages(result.messages || []);
      setFirstMessage('');
      setStartNew(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not start a support chat.');
    } finally {
      setBusy(false);
    }
  };

  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (!conversation || !draft.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      await supportCall('send_message', { conversation_id: conversation.id, message: draft });
      setDraft('');
      await loadMessages(conversation.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not send this message.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-default p-4">
        <div>
          <h3 className="font-semibold text-primary flex items-center gap-2"><LifeBuoy size={18} className="text-accent" /> Support chat</h3>
          <p className="mt-1 text-sm text-muted">Send a message to the MrBiller.online team for {user?.shopName || 'your shop'}.</p>
        </div>
        <button type="button" onClick={() => { setStartNew(true); setConversation(null); setMessages([]); }} className="btn-secondary flex items-center gap-1.5 text-sm">
          <Plus size={15} /> New chat
        </button>
      </div>
      {error && <p role="alert" className="mx-4 mt-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-600">{error}</p>}
      <div className="p-4">
        {loading ? <p className="text-sm text-muted">Loading support…</p> : startNew || (!conversation && conversations.length === 0) ? (
          <form onSubmit={(event) => void startConversation(event)} className="space-y-3">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-secondary">What do you need help with?</span>
              <textarea value={firstMessage} onChange={(event) => setFirstMessage(event.target.value)} className="input-field min-h-24" placeholder="Write a message to MrBiller.online support…" minLength={4} maxLength={4000} required />
            </label>
            <button className="btn-primary inline-flex items-center gap-2" disabled={busy || firstMessage.trim().length < 4}>{busy ? 'Opening chat…' : 'Start support chat'} <Send size={15} /></button>
          </form>
        ) : conversation ? (
          <>
            {conversations.length > 1 && (
              <label className="mb-3 flex items-center gap-2 text-sm text-secondary">
                <MessageCircle size={15} />
                <select className="input-field max-w-sm" value={conversation.id} onChange={(event) => setConversation(conversations.find((item) => item.id === event.target.value) || null)}>
                  {conversations.map((item) => <option key={item.id} value={item.id}>{new Date(item.created_at).toLocaleDateString('en-IN')} · {item.status}</option>)}
                </select>
              </label>
            )}
            <div className="flex items-center justify-between text-xs text-muted">
              <span>Conversation with MrBiller.online support</span>
              <span className={conversation.status === 'open' ? 'text-green-600' : 'text-muted'}>{conversation.status}</span>
            </div>
            <MessageList messages={messages} currentRole="shop_user" />
            {conversation.status === 'closed' ? <p className="text-sm text-muted">This conversation is closed. Start a new chat if you need more help.</p> : (
              <form onSubmit={(event) => void send(event)} className="flex gap-2">
                <input className="input-field min-w-0 flex-1" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={4000} placeholder="Write a message…" />
                <button className="btn-primary px-4" disabled={busy || !draft.trim()} aria-label="Send message"><Send size={17} /></button>
              </form>
            )}
          </>
        ) : <p className="text-sm text-muted">Choose “New chat” to contact support.</p>}
      </div>
    </section>
  );
}
