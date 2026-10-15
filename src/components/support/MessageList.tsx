import type { SupportMessage } from './supportApi';

export function MessageList({ messages, currentRole = 'customer', appearance = 'app' }: {
  messages: SupportMessage[];
  currentRole?: 'customer' | 'shop_user' | 'admin';
  appearance?: 'app' | 'light';
}) {
  if (messages.length === 0) return <p className={`py-8 text-center text-sm ${appearance === 'light' ? 'text-slate-500' : 'text-muted'}`}>No messages yet.</p>;
  return (
    <ol className="space-y-3 max-h-[24rem] overflow-y-auto px-1 py-3" aria-live="polite" aria-label="Conversation messages">
      {messages.map((message) => {
        const own = message.sender_role === currentRole;
        return (
          <li key={message.id} className={`flex ${own ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 ${appearance === 'light'
              ? own ? 'rounded-br-sm bg-orange-600 text-white shadow-sm' : 'rounded-bl-sm border border-slate-200 bg-white text-slate-800 shadow-sm'
              : own ? 'bg-accent text-white rounded-br-sm' : 'bg-secondary text-primary rounded-bl-sm'}`}>
              <p className={`mb-1 text-[11px] ${own ? 'text-white/75' : appearance === 'light' ? 'text-slate-500' : 'text-muted'}`}>{own ? 'You' : message.sender_role === 'admin' ? 'MrBiller.online support' : message.sender_name}</p>
              <p className="text-sm whitespace-pre-wrap break-words">{message.body}</p>
              <time className={`mt-1 block text-[10px] ${own ? 'text-white/70' : appearance === 'light' ? 'text-slate-400' : 'text-muted'}`} dateTime={message.created_at}>
                {new Intl.DateTimeFormat('en-IN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(message.created_at))}
              </time>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
