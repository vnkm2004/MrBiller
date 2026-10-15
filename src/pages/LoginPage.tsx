import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, KeyRound, ShieldCheck, Store } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { AdminMfaPrompt } from '../context/AppContext';

export function LoginPage({
  sessionRestoreError,
  onRetrySessionRestore,
  onBackToLanding,
  onContactSupport,
}: {
  sessionRestoreError?: string | null;
  onRetrySessionRestore?: () => Promise<void>;
  onBackToLanding?: () => void;
  onContactSupport?: () => void;
}) {
  const { configured, loginShop, loginAdmin, completeAdminLogin } = useApp();
  const [shopCode, setShopCode] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [adminMfa, setAdminMfa] = useState<AdminMfaPrompt | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isAdminEmail = username.includes('@');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (!adminMfa && isAdminEmail) {
        const prompt = await loginAdmin(username.trim(), password);
        setAdminMfa(prompt);
        setPassword('');
        setMfaCode('');
      } else if (!adminMfa) {
        await loginShop(shopCode, username, password);
      } else {
        if (!/^\d{6}$/.test(mfaCode)) throw new Error('Enter the six-digit code from your authenticator app.');
        await completeAdminLogin(adminMfa.factorId, mfaCode);
      }
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Could not sign in. Check your details and try again.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-primary flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center shadow-sm">
            <Store size={28} className="text-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-primary">MrBiller.online</h1>
            <p className="text-sm text-muted">Shop billing and inventory</p>
          </div>
        </div>

        <section className="card p-6 shadow-xl space-y-5">
          <div>
            <h2 className="text-xl font-bold text-primary">
              {adminMfa ? (adminMfa.needsSetup ? 'Set up your authenticator' : 'Authenticator verification') : 'User login'}
            </h2>
            <p className="text-sm text-muted mt-1">
              {adminMfa
                ? adminMfa.needsSetup
                  ? 'Scan this QR code with Google Authenticator, then enter its six-digit code.'
                  : 'Enter the six-digit code from Google Authenticator to continue.'
                : 'Sign in with your account details.'}
            </p>
          </div>

          {sessionRestoreError && (
            <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 space-y-2">
              <p>{sessionRestoreError}</p>
              <button
                type="button"
                className="font-semibold text-accent hover:underline"
                onClick={() => void onRetrySessionRestore?.()}
              >
                Retry saved session
              </button>
            </div>
          )}

          {!configured ? (
            <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
              Supabase is not configured. Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> to <code>.env.local</code>, then restart the app.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {!adminMfa && (
                <>
                  <LoginInput label="shopID" value={shopCode} onChange={(value) => setShopCode(value.toLowerCase().replace(/\s/g, ''))} placeholder="shop-001" autoComplete="organization" required={!isAdminEmail} />
                  <LoginInput label="User ID" value={username} onChange={(value) => setUsername(value.toLowerCase().replace(/\s/g, ''))} placeholder="Enter your User ID" autoComplete="username" />
                </>
              )}

              {!adminMfa && (
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-secondary">Password</span>
                  <span className="relative block">
                    <input
                      required
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="input-field pr-11"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((visible) => !visible)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-primary"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </span>
                </label>
              )}

              {adminMfa?.needsSetup && adminMfa.qrCode && (
                <div className="rounded-xl border border-default bg-white p-4 text-center space-y-3">
                  <img src={adminMfa.qrCode} alt="Authenticator setup QR code" className="mx-auto h-44 w-44" />
                  {adminMfa.secret && (
                    <p className="text-xs text-secondary break-all">
                      Can’t scan it? Enter this setup key in your authenticator app: <code className="font-mono select-all">{adminMfa.secret}</code>
                    </p>
                  )}
                </div>
              )}

              {adminMfa && (
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-secondary">Authenticator code</span>
                  <input
                    required
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    pattern="[0-9]{6}"
                    value={mfaCode}
                    onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="input-field text-center text-xl tracking-[0.4em]"
                    placeholder="000000"
                    autoFocus
                  />
                </label>
              )}

              {error && <p role="alert" className="text-sm text-red-500">{error}</p>}

              <button className="btn-primary w-full flex items-center justify-center gap-2" type="submit" disabled={submitting}>
                {adminMfa ? <ShieldCheck size={17} /> : <KeyRound size={17} />}
                {submitting
                  ? 'Please wait…'
                  : adminMfa?.needsSetup
                    ? 'Verify and enable authenticator'
                    : adminMfa
                      ? 'Verify and sign in'
                      : 'Sign in'}
              </button>
            </form>
          )}

        </section>

        <div className="flex flex-col items-center gap-2 text-xs text-muted">
          {onContactSupport && <button type="button" onClick={onContactSupport} className="font-medium text-accent hover:underline">Contact support</button>}
          {onBackToLanding && <button type="button" onClick={onBackToLanding} className="hover:text-primary">Back to MrBiller.online</button>}
          <span>Powered by MrBiller.online</span>
        </div>
      </div>
    </div>
  );
}

function LoginInput({
  label, value, onChange, ...props
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-secondary">{label}</span>
      <input
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="input-field"
        {...props}
      />
    </label>
  );
}
