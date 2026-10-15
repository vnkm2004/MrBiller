import { useTranslation } from 'react-i18next';
import { Sun, Moon, Languages, Store, LockKeyhole, LogOut } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export function Header({ onLock }: { onLock: () => void }) {
  const { t } = useTranslation();
  const { theme, toggleTheme, language, setLanguage, settings, logout } = useApp();

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'kn' : 'en');
  };

  return (
    <header className="sticky top-0 z-30 bg-card border-b border-default safe-top">
      <div className="flex items-center justify-between px-4 py-3">
        {/* Left: logo + store name */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {settings?.logo ? (
            <img
              src={settings.logo}
              alt={settings.storeName}
              className="h-9 w-9 shrink-0 rounded-lg bg-transparent object-contain"
            />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10">
              <Store size={20} className="text-accent" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="max-w-[36vw] truncate text-base font-bold text-primary leading-tight sm:max-w-[50vw] lg:max-w-none">
              {settings?.storeName || t('appName')}
            </h1>
            {language === 'kn' && settings?.storeNameKn && (
              <p className="text-xs text-muted">{settings.storeNameKn}</p>
            )}
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-1">
          {/* Language toggle */}
          <button
            onClick={toggleLanguage}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-secondary transition-colors hover:opacity-75"
            title={t('settings.language')}
            aria-label={t('settings.language')}
          >
            <Languages size={20} />
          </button>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-secondary transition-colors hover:opacity-75"
            title={t('settings.theme')}
            aria-label={t('settings.theme')}
          >
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </button>

          {/* App lock */}
          <button
            onClick={onLock}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-secondary transition-colors hover:opacity-75"
            title="Lock app"
            aria-label="Lock app"
          >
            <LockKeyhole size={20} />
          </button>

          {/* Sign out remains separate from the privacy lock. */}
          <button
            onClick={logout}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-secondary transition-colors hover:opacity-75"
            title={t('auth.logout')}
            aria-label={t('auth.logout')}
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>
    </header>
  );
}
