import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Store, Phone, Mail, FileText, Upload, Sun, Moon, Languages, Check, Image as ImageIcon, KeyRound, LockKeyhole, Eye, EyeOff } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Input, TextArea } from '../components/common/Input';
import { Modal } from '../components/common/Modal';
import { DEFAULT_ACCENT_COLOR } from '../utils/theme';
import type { StoreSettings } from '../types';
import { requireSupabase } from '../lib/supabase';
import { SubscriptionPanel } from '../components/subscriptions/SubscriptionPanel';
import { SupportChat } from '../components/support/SupportChat';

const ACCENT_PRESETS = [
  { value: DEFAULT_ACCENT_COLOR, label: 'colorOrange' },
  { value: '#2563eb', label: 'colorBlue' },
  { value: '#16a34a', label: 'colorGreen' },
  { value: '#9333ea', label: 'colorPurple' },
  { value: '#e11d48', label: 'colorRose' },
  { value: '#0f9f9a', label: 'colorTeal' },
] as const;

export function SettingsPage() {
  const { t } = useTranslation();
  const { settings, updateStoreSettings, theme, setTheme, language, setLanguage, appPinConfigured, changeAppPin } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<StoreSettings | null>(null);
  const [formDirty, setFormDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [showSaved, setShowSaved] = useState(false);
  const [logoError, setLogoError] = useState('');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [currentAppPin, setCurrentAppPin] = useState('');
  const [newAppPin, setNewAppPin] = useState('');
  const [confirmAppPin, setConfirmAppPin] = useState('');
  const [appPinMessage, setAppPinMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [appPinLoading, setAppPinLoading] = useState(false);

  useEffect(() => {
    if (settings && !formDirty) setForm(settings);
  }, [settings, formDirty]);

  if (!form) {
    return (
      <div className="max-w-3xl mx-auto p-4">
        <p className="text-muted">{t('common.loading')}</p>
      </div>
    );
  }

  const update = (field: keyof StoreSettings, value: string | number) => {
    setForm((prev) => (prev ? { ...prev, [field]: value } : prev));
    setFormDirty(true);
    setSaveError('');
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 500 * 1024) {
      setLogoError(t('settings.logoHint'));
      return;
    }

    if (!file.type.startsWith('image/')) {
      setLogoError('Invalid file type');
      return;
    }

    setLogoError('');
    const reader = new FileReader();
    reader.onload = () => {
      update('logo', reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!form || saving) return;
    setSaving(true);
    setSaveError('');
    try {
      await updateStoreSettings({
        storeName: form.storeName,
        storeNameKn: form.storeNameKn,
        address: form.address,
        addressKn: form.addressKn,
        phone: form.phone,
        email: form.email,
        gstNumber: form.gstNumber,
        logo: form.logo,
        defaultGstRate: form.defaultGstRate,
        accentColor: form.accentColor || DEFAULT_ACCENT_COLOR,
      });
      setFormDirty(false);
      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 2500);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not save shop settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 8) {
      setPasswordMessage({ type: 'error', text: 'Use at least 8 characters for the new password.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'The passwords do not match.' });
      return;
    }
    setPasswordLoading(true);
    const { error } = await requireSupabase().auth.updateUser({ password: newPassword });
    setPasswordLoading(false);
    if (error) {
      setPasswordMessage({ type: 'error', text: error.message });
    } else {
      setNewPassword('');
      setConfirmPassword('');
      setPasswordMessage({ type: 'success', text: 'Password updated.' });
    }
    setTimeout(() => setPasswordMessage(null), 3500);
  };

  const handleChangeAppPin = async () => {
    setAppPinMessage(null);
    if (!/^\d{4,6}$/.test(newAppPin)) {
      setAppPinMessage({ type: 'error', text: 'Choose a PIN with 4 to 6 digits.' });
      return;
    }
    if (newAppPin !== confirmAppPin) {
      setAppPinMessage({ type: 'error', text: 'The new PINs do not match.' });
      return;
    }

    setAppPinLoading(true);
    try {
      const changed = await changeAppPin(currentAppPin, newAppPin);
      if (!changed) {
        setAppPinMessage({ type: 'error', text: 'The current PIN is incorrect.' });
        return;
      }
      setCurrentAppPin('');
      setNewAppPin('');
      setConfirmAppPin('');
      setAppPinMessage({ type: 'success', text: 'App PIN updated.' });
    } catch (error) {
      setAppPinMessage({ type: 'error', text: error instanceof Error ? error.message : 'Could not update the app PIN.' });
    } finally {
      setAppPinLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4 pb-24 md:pb-8">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-primary">{t('settings.title')}</h2>
        <button className="btn-primary shrink-0" onClick={() => void handleSave()} disabled={saving}>
          {saving ? t('common.loading') : t('settings.save')}
        </button>
      </div>
      {saveError && <p role="alert" className="rounded-lg bg-red-500/10 p-3 text-sm text-red-600">{saveError}</p>}

      <SubscriptionPanel />
      <SupportChat />

      {/* Store Information */}
      <div className="card p-4 space-y-4">
        <h3 className="font-semibold text-primary flex items-center gap-2">
          <Store size={18} />
          {t('settings.storeInfo')}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label={t('settings.storeName')}
            value={form.storeName}
            onChange={(e) => update('storeName', e.target.value)}
            icon={<Store size={16} />}
          />
          <Input
            label={t('settings.storeNameKn')}
            value={form.storeNameKn || ''}
            onChange={(e) => update('storeNameKn', e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <TextArea
            label={t('settings.address')}
            value={form.address}
            onChange={(e) => update('address', e.target.value)}
            rows={2}
          />
          <TextArea
            label={t('settings.addressKn')}
            value={form.addressKn || ''}
            onChange={(e) => update('addressKn', e.target.value)}
            rows={2}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label={t('settings.phone')}
            value={form.phone}
            onChange={(e) => update('phone', e.target.value)}
            icon={<Phone size={16} />}
            placeholder="9876543210"
          />
          <Input
            label={t('settings.email')}
            value={form.email || ''}
            onChange={(e) => update('email', e.target.value)}
            icon={<Mail size={16} />}
            type="email"
          />
        </div>

        <Input
          label={t('settings.gstNumber')}
          value={form.gstNumber || ''}
          onChange={(e) => update('gstNumber', e.target.value)}
          icon={<FileText size={16} />}
          placeholder="29ABCDE1234F1Z5"
        />

        {/* Default GST rate */}
        <Input
          label={t('settings.defaultGstRate')}
          type="number"
          value={form.defaultGstRate || 0}
          onChange={(e) => update('defaultGstRate', parseFloat(e.target.value) || 0)}
          min="0"
          max="28"
          step="0.5"
        />
      </div>

      {/* Logo upload */}
      <div className="card p-4 space-y-3">
        <h3 className="font-semibold text-primary flex items-center gap-2">
          <ImageIcon size={18} />
          {t('settings.logo')}
        </h3>
        <div className="flex items-center gap-4">
          {form.logo ? (
            <img
              src={form.logo}
              alt="Store logo"
              className="w-20 h-20 rounded-lg object-cover border border-default"
            />
          ) : (
            <div className="w-20 h-20 rounded-lg bg-secondary flex items-center justify-center border border-default">
              <ImageIcon size={28} className="text-muted" />
            </div>
          )}
          <div className="flex-1">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg"
              onChange={handleLogoUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn-secondary flex items-center gap-2"
            >
              <Upload size={18} />
              {t('settings.uploadLogo')}
            </button>
            <p className="text-xs text-muted mt-2">{t('settings.logoHint')}</p>
            {logoError && <p className="text-xs text-red-500 mt-1">{logoError}</p>}
            {form.logo && (
              <button
                onClick={() => update('logo', '')}
                className="text-xs text-red-500 mt-2 hover:underline"
              >
                {t('common.delete')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Appearance */}
      <div className="card p-4 space-y-4">
        <h3 className="font-semibold text-primary">{t('settings.appearance')}</h3>

        {/* Theme */}
        <div>
          <p className="text-sm font-medium text-secondary mb-2">{t('settings.theme')}</p>
          <div className="flex gap-3">
            <button
              onClick={() => setTheme('light')}
              className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border transition-all ${
                theme === 'light'
                  ? 'border-accent bg-accent/5 text-accent'
                  : 'border-default text-secondary'
              }`}
            >
              <Sun size={20} />
              <span className="font-medium">{t('settings.light')}</span>
            </button>
            <button
              onClick={() => setTheme('dark')}
              className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border transition-all ${
                theme === 'dark'
                  ? 'border-accent bg-accent/5 text-accent'
                  : 'border-default text-secondary'
              }`}
            >
              <Moon size={20} />
              <span className="font-medium">{t('settings.dark')}</span>
            </button>
          </div>
        </div>

        {/* Accent color */}
        <div>
          <p className="text-sm font-medium text-secondary mb-2">{t('settings.accentColor')}</p>
          <div className="flex flex-wrap items-center gap-2">
            {ACCENT_PRESETS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => update('accentColor', value)}
                aria-label={t(`settings.${label}`)}
                aria-pressed={(form.accentColor || DEFAULT_ACCENT_COLOR).toLowerCase() === value}
                title={t(`settings.${label}`)}
                className={`w-9 h-9 rounded-full border-2 transition-transform hover:scale-110 ${
                  (form.accentColor || DEFAULT_ACCENT_COLOR).toLowerCase() === value
                    ? 'border-accent ring-2 ring-accent'
                    : 'border-transparent'
                }`}
                style={{ backgroundColor: value }}
              >
                {(form.accentColor || DEFAULT_ACCENT_COLOR).toLowerCase() === value && (
                  <Check size={16} className="mx-auto text-white drop-shadow" />
                )}
              </button>
            ))}
            <label className="flex items-center gap-2 rounded-lg border border-default px-3 py-1.5 text-sm text-secondary">
              <span>{t('settings.customColor')}</span>
              <input
                type="color"
                value={form.accentColor || DEFAULT_ACCENT_COLOR}
                onChange={(event) => update('accentColor', event.target.value)}
                aria-label={t('settings.customColor')}
                className="h-8 w-9 cursor-pointer rounded border-0 bg-transparent p-0"
              />
            </label>
          </div>
          <p className="text-xs text-muted mt-2">{t('settings.accentColorHint')}</p>
        </div>

        {/* Language */}
        <div>
          <p className="text-sm font-medium text-secondary mb-2 flex items-center gap-2">
            <Languages size={16} />
            {t('settings.language')}
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setLanguage('en')}
              className={`flex-1 p-3 rounded-lg border transition-all ${
                language === 'en'
                  ? 'border-accent bg-accent/5 text-accent'
                  : 'border-default text-secondary'
              }`}
            >
              <span className="font-medium">{t('settings.english')}</span>
            </button>
            <button
              onClick={() => setLanguage('kn')}
              className={`flex-1 p-3 rounded-lg border transition-all ${
                language === 'kn'
                  ? 'border-accent bg-accent/5 text-accent'
                  : 'border-default text-secondary'
              }`}
            >
              <span className="font-medium">{t('settings.kannada')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* App lock PIN */}
      <div className="card space-y-4 p-4">
        <h3 className="flex items-center gap-2 font-semibold text-primary">
          <LockKeyhole size={18} /> App lock PIN
        </h3>
        <p className="text-sm text-muted">
          {appPinConfigured
            ? 'Change the PIN used to unlock this device. Your account remains signed in while the app is locked.'
            : 'Set a 4 to 6 digit PIN. You can also set it the first time you lock the app.'}
        </p>
        {appPinConfigured && (
          <PinSettingsInput label="Current PIN" value={currentAppPin} onChange={setCurrentAppPin} />
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <PinSettingsInput label="New PIN" value={newAppPin} onChange={setNewAppPin} />
          <PinSettingsInput label="Confirm new PIN" value={confirmAppPin} onChange={setConfirmAppPin} />
        </div>
        {appPinMessage && (
          <p role={appPinMessage.type === 'error' ? 'alert' : 'status'} className={`text-sm ${appPinMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
            {appPinMessage.text}
          </p>
        )}
        <button
          className="btn-secondary w-full"
          onClick={() => void handleChangeAppPin()}
          disabled={appPinLoading || !newAppPin || !confirmAppPin || (appPinConfigured && !currentAppPin)}
        >
          {appPinLoading ? t('common.loading') : appPinConfigured ? 'Update app PIN' : 'Set app PIN'}
        </button>
      </div>

      {/* Change password */}
      <div className="card p-4 space-y-4">
        <h3 className="font-semibold text-primary flex items-center gap-2">
          <KeyRound size={18} />
          Change password
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="relative">
            <Input
              label="New password"
              type={showPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-9 text-muted hover:text-primary"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <div className="relative">
            <Input
              label="Confirm new password"
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((v) => !v)}
              className="absolute right-3 top-9 text-muted hover:text-primary"
              aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
            >
              {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        {passwordMessage && (
          <p className={`text-sm ${passwordMessage.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>
            {passwordMessage.text}
          </p>
        )}
        <button
          className="btn-secondary w-full"
          onClick={handleChangePassword}
          disabled={passwordLoading || !newPassword || !confirmPassword}
        >
          {passwordLoading ? t('common.loading') : 'Update password'}
        </button>
      </div>

      {/* Saved confirmation */}
      <Modal isOpen={showSaved} onClose={() => setShowSaved(false)}>
        <div className="flex flex-col items-center gap-3 text-center py-2">
          <div className="w-14 h-14 rounded-full bg-accent2/10 flex items-center justify-center">
            <Check size={28} className="text-accent2" />
          </div>
          <p className="text-primary font-medium">{t('settings.saved')}</p>
        </div>
      </Modal>
    </div>
  );
}

function PinSettingsInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-secondary">{label}</span>
      <input
        type="password"
        inputMode="numeric"
        pattern="[0-9]{4,6}"
        autoComplete="one-time-code"
        minLength={4}
        maxLength={6}
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, 6))}
        className="input-field text-center tracking-[0.4em]"
        placeholder="4–6 digits"
      />
    </label>
  );
}
