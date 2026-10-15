import { useState, type FormEvent } from 'react';
import { KeyRound, LockKeyhole, LogOut, ShieldCheck } from 'lucide-react';
import type { AppLockScreen as AppLockMode } from '../../context/AppContext';

interface AppLockScreenProps {
  mode: Exclude<AppLockMode, 'none'>;
  shopName?: string;
  onUnlock: (pin: string) => Promise<boolean>;
  onSetPin: (pin: string) => Promise<void>;
  onForgotPin: () => void;
  onSignOut: () => void;
}

export function AppLockScreen({ mode, shopName, onUnlock, onSetPin, onForgotPin, onSignOut }: AppLockScreenProps) {
  const [pin, setPin] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const isSetup = mode === 'setup' || mode === 'setup-required';

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (!/^\d{4,6}$/.test(pin)) {
      setError('Enter a PIN with 4 to 6 digits.');
      return;
    }
    if (isSetup && pin !== confirmation) {
      setError('The PINs do not match.');
      return;
    }

    setBusy(true);
    try {
      if (isSetup) {
        await onSetPin(pin);
      } else if (!(await onUnlock(pin))) {
        setError('That PIN is incorrect. Try again or use PIN recovery.');
        setPin('');
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save the PIN. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-primary p-4">
      <section className="card w-full max-w-sm space-y-5 p-6 shadow-xl">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 text-accent">
            {isSetup ? <KeyRound size={27} /> : <LockKeyhole size={27} />}
          </div>
          <div>
            <h1 className="text-xl font-bold text-primary">
              {mode === 'setup-required' ? 'Set a new app PIN' : isSetup ? 'Create your app PIN' : 'App locked'}
            </h1>
            {shopName && <p className="mt-1 text-sm text-muted">{shopName}</p>}
          </div>
          <p className="text-sm text-secondary">
            {isSetup
              ? 'Choose 4 to 6 digits. You can change this PIN later in Settings.'
              : 'Enter your PIN to continue. Your account stays signed in on this device.'}
          </p>
        </div>

        <form onSubmit={(event) => void submit(event)} className="space-y-4">
          <PinInput label={isSetup ? 'New PIN' : 'PIN'} value={pin} onChange={setPin} autoFocus />
          {isSetup && <PinInput label="Confirm PIN" value={confirmation} onChange={setConfirmation} />}
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <button type="submit" className="btn-primary inline-flex w-full items-center justify-center gap-2" disabled={busy}>
            {isSetup ? <ShieldCheck size={17} /> : <LockKeyhole size={17} />}
            {busy ? 'Please wait…' : isSetup ? 'Save PIN' : 'Unlock'}
          </button>
        </form>

        {!isSetup && (
          <div className="space-y-3 border-t border-default pt-4 text-center">
            <p className="text-xs leading-5 text-muted">
              Forgot your PIN? Sign out and ask your administrator to reset your login password. After signing in again, you can create a new PIN.
            </p>
            <button type="button" onClick={onForgotPin} className="text-sm font-medium text-accent hover:underline">
              Forgot PIN? Sign out to recover
            </button>
          </div>
        )}

        <button type="button" onClick={onSignOut} className="btn-secondary inline-flex w-full items-center justify-center gap-2">
          <LogOut size={16} /> Sign out
        </button>
      </section>
    </main>
  );
}

function PinInput({ label, value, onChange, autoFocus = false }: { label: string; value: string; onChange: (value: string) => void; autoFocus?: boolean }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-secondary">{label}</span>
      <input
        type="password"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{4,6}"
        minLength={4}
        maxLength={6}
        autoFocus={autoFocus}
        required
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, 6))}
        className="input-field text-center text-2xl tracking-[0.5em]"
        placeholder="••••"
      />
    </label>
  );
}
