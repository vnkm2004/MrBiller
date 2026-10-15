import { useEffect, useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/layout/Header';
import { SidebarNav, BottomNav } from './components/layout/Navigation';
import { BillingPage } from './pages/BillingPage';
import { InventoryPage } from './pages/InventoryPage';
import { DashboardPage } from './pages/DashboardPage';
import { HistoryPage } from './pages/HistoryPage';
import { SettingsPage } from './pages/SettingsPage';
import { LoginPage } from './pages/LoginPage';
import { AdminPage } from './pages/AdminPage';
import { SubscriptionPanel } from './components/subscriptions/SubscriptionPanel';
import { LandingPage } from './pages/LandingPage';
import { PublicContactPage } from './pages/PublicContactPage';
import { TermsPage } from './pages/TermsPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { SupportChat } from './components/support/SupportChat';
import { AppLockScreen } from './components/auth/AppLockScreen';
import type { Page } from './types';

type PublicPage = 'landing' | 'login' | 'contact' | 'terms' | 'privacy';

function AppContent() {
  const {
    loading,
    isAuthenticated,
    user,
    subscriptionActive,
    logout,
    appLockScreen,
    lockApp,
    unlockApp,
    saveAppPin,
    recoverForgottenPin,
    sessionRestoreError,
    retrySessionRestore,
  } = useApp();
  const [currentPage, setCurrentPage] = useState<Page>('billing');
  const [publicPage, setPublicPage] = useState<PublicPage>('landing');

  useEffect(() => {
    if (isAuthenticated) setPublicPage('landing');
  }, [isAuthenticated]);

  // Show loading splash while DB settings are hydrating
  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-primary">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center animate-pulse">
            <span className="text-2xl font-bold text-accent">B</span>
          </div>
          <p className="text-sm text-muted">MrBiller.online</p>
        </div>
      </div>
    );
  }

  // Show login / PIN-setup screen when not authenticated
  if (!isAuthenticated) {
    if (publicPage === 'login') {
      return <LoginPage
        sessionRestoreError={sessionRestoreError}
        onRetrySessionRestore={retrySessionRestore}
        onBackToLanding={() => setPublicPage('landing')}
        onContactSupport={() => setPublicPage('contact')}
      />;
    }
    if (publicPage === 'contact') return <PublicContactPage onBack={() => setPublicPage('landing')} />;
    if (publicPage === 'terms') return <TermsPage onBack={() => setPublicPage('landing')} onContact={() => setPublicPage('contact')} onPrivacy={() => setPublicPage('privacy')} />;
    if (publicPage === 'privacy') return <PrivacyPage onBack={() => setPublicPage('landing')} onContact={() => setPublicPage('contact')} onTerms={() => setPublicPage('terms')} />;
    return <LandingPage
      onSignIn={() => setPublicPage('login')}
      onContact={() => setPublicPage('contact')}
      onTerms={() => setPublicPage('terms')}
      onPrivacy={() => setPublicPage('privacy')}
    />;
  }

  if (user?.role === 'admin') {
    return (
      <div className="min-h-[100dvh] bg-primary">
        <header className="sticky top-0 z-30 bg-card border-b border-default">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold text-primary">MrBiller.online administration</h1>
              <p className="text-xs text-muted">Shops, access, and billing activity</p>
            </div>
            <button className="btn-secondary" onClick={logout}>Sign out</button>
          </div>
        </header>
        <AdminPage />
      </div>
    );
  }

  if (user && appLockScreen !== 'none') {
    return (
      <AppLockScreen
        mode={appLockScreen}
        shopName={user.shopName}
        onUnlock={unlockApp}
        onSetPin={saveAppPin}
        onForgotPin={recoverForgottenPin}
        onSignOut={logout}
      />
    );
  }

  if (user?.shopId && !subscriptionActive) {
    return (
      <div className="min-h-[100dvh] bg-primary">
        <header className="border-b border-default bg-card">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-3 px-4 py-4">
            <div>
              <h1 className="text-lg font-bold text-primary">{user.shopName || 'MrBiller.online'}</h1>
              <p className="text-sm text-muted">Subscription required to continue</p>
            </div>
            <button className="btn-secondary" onClick={logout}>Sign out</button>
          </div>
        </header>
        <main className="max-w-4xl mx-auto p-4 md:p-6">
          <SubscriptionPanel compact />
          <div className="mt-4"><SupportChat /></div>
        </main>
      </div>
    );
  }

  return (
      <div className="flex min-h-[100dvh] bg-primary">
      {/* Desktop sidebar */}
      <SidebarNav currentPage={currentPage} onNavigate={setCurrentPage} />

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Header onLock={lockApp} />
        <main className="min-w-0 flex-1 overflow-x-hidden">
          <div key={currentPage} className={`app-page-enter app-page-enter-${currentPage}`}>
            {currentPage === 'billing' && <BillingPage />}
            {currentPage === 'inventory' && <InventoryPage />}
            {currentPage === 'dashboard' && <DashboardPage />}
            {currentPage === 'history' && <HistoryPage />}
            {currentPage === 'settings' && <SettingsPage />}
          </div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <BottomNav currentPage={currentPage} onNavigate={setCurrentPage} />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
