import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { User } from '@supabase/supabase-js';
import {
  archiveLegacyLocalData,
  clearLocalShopCache,
  hydrateShopCache,
  setActiveShopId,
  updateSettings as saveShopSettings,
} from '../db';
import type { StoreSettings, Theme, Language } from '../types';
import { applyAccentColor } from '../utils/theme';
import {
  clearStoredAppPin,
  consumePinRecoveryRequest,
  hasStoredAppPin,
  requestPinRecovery,
  saveStoredAppPin,
  verifyStoredAppPin,
} from '../utils/appLock';
import { isSupabaseConfigured, requireSupabase, supabase } from '../lib/supabase';

export type AppLockScreen = 'none' | 'locked' | 'setup' | 'setup-required';

export interface AppUser {
  id: string;
  username?: string;
  role: 'admin' | 'owner' | 'staff';
  shopId?: string;
  shopCode?: string;
  shopName?: string;
}

export interface ShopSubscription {
  planId: string | null;
  startsAt: string;
  expiresAt: string;
  maxUsers: number;
}

export interface AdminMfaPrompt {
  factorId: string;
  needsSetup: boolean;
  qrCode?: string;
  secret?: string;
}

interface AppContextValue {
  settings: StoreSettings | null;
  loading: boolean;
  sessionRestoreError: string | null;
  configured: boolean;
  theme: Theme;
  language: Language;
  user: AppUser | null;
  subscription: ShopSubscription | null;
  subscriptionActive: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  appLockScreen: AppLockScreen;
  appPinConfigured: boolean;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  setLanguage: (lang: Language) => void;
  updateStoreSettings: (updates: Partial<StoreSettings>) => Promise<void>;
  refreshSubscription: () => Promise<void>;
  loginShop: (shopCode: string, username: string, password: string) => Promise<void>;
  loginAdmin: (email: string, password: string) => Promise<AdminMfaPrompt>;
  completeAdminLogin: (factorId: string, code: string) => Promise<void>;
  lockApp: () => void;
  unlockApp: (pin: string) => Promise<boolean>;
  saveAppPin: (pin: string) => Promise<void>;
  changeAppPin: (currentPin: string, newPin: string) => Promise<boolean>;
  recoverForgottenPin: () => void;
  retrySessionRestore: () => Promise<void>;
  logout: () => void;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

class AccessDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AccessDeniedError';
  }
}

function makeLoginEmail(shopCode: string, username: string) {
  return `user-${username.trim().toLowerCase()}-${shopCode.trim().toLowerCase()}@accounts.biller.invalid`;
}

async function activateUser(authUser: User, expectedShopCode?: string): Promise<{
  user: AppUser;
  settings: StoreSettings | null;
  subscription: ShopSubscription | null;
}> {
  const client = requireSupabase();
  const { data: admin, error: adminError } = await client
    .from('app_admins')
    .select('user_id')
    .eq('user_id', authUser.id)
    .maybeSingle();
  if (adminError) throw adminError;

  await clearLocalShopCache();
  if (admin) {
    if (expectedShopCode) throw new AccessDeniedError('This is an administrator account. Choose administrator login.');
    const { data: assurance, error: assuranceError } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assuranceError) throw assuranceError;
    if (assurance.currentLevel !== 'aal2') {
      throw new AccessDeniedError('Complete administrator verification with your authenticator app.');
    }
    return { user: { id: authUser.id, role: 'admin' }, settings: null, subscription: null };
  }

  const { data: membership, error: membershipError } = await client
    .from('shop_memberships')
    .select('shop_id, username, role, active')
    .eq('user_id', authUser.id)
    .maybeSingle();
  if (membershipError) throw membershipError;
  if (!membership || !membership.active) throw new AccessDeniedError('This shop login is disabled. Contact your MrBiller.online administrator.');

  const { data: shop, error: shopError } = await client
    .from('shops')
    .select('id, code, name, active')
    .eq('id', membership.shop_id)
    .maybeSingle();
  if (shopError) throw shopError;
  if (!shop || !shop.active) throw new AccessDeniedError('This shop is disabled. Contact your MrBiller.online administrator.');
  if (expectedShopCode && shop.code !== expectedShopCode.trim().toLowerCase()) {
    throw new AccessDeniedError('The shop ID or login ID is incorrect.');
  }

  const { data: shopSubscription, error: subscriptionError } = await client
    .from('shop_subscriptions')
    .select('plan_id, starts_at, expires_at, max_users')
    .eq('shop_id', shop.id)
    .maybeSingle();
  if (subscriptionError) throw subscriptionError;

  const subscription: ShopSubscription | null = shopSubscription ? {
    planId: shopSubscription.plan_id,
    startsAt: shopSubscription.starts_at,
    expiresAt: shopSubscription.expires_at,
    maxUsers: shopSubscription.max_users,
  } : null;
  const subscriptionActive = Boolean(subscription && Date.parse(subscription.expiresAt) > Date.now());
  let settings: StoreSettings | null = null;
  if (subscriptionActive) {
    setActiveShopId(shop.id);
    settings = await hydrateShopCache(shop.id);
  } else {
    setActiveShopId(null);
    await clearLocalShopCache();
  }
  return {
    user: {
      id: authUser.id,
      username: membership.username,
      role: membership.role,
      shopId: shop.id,
      shopCode: shop.code,
      shopName: shop.name,
    },
    settings,
    subscription,
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionRestoreError, setSessionRestoreError] = useState<string | null>(null);
  const [theme, setThemeState] = useState<Theme>('light');
  const [language, setLanguageState] = useState<Language>('en');
  const [user, setUser] = useState<AppUser | null>(null);
  const [subscription, setSubscription] = useState<ShopSubscription | null>(null);
  const [appLockScreen, setAppLockScreen] = useState<AppLockScreen>('none');
  const [appPinConfigured, setAppPinConfigured] = useState(false);

  const subscriptionActive = Boolean(subscription && Date.parse(subscription.expiresAt) > Date.now());

  const refreshSubscription = useCallback(async () => {
    const shopId = user?.shopId;
    if (!shopId) return;
    const client = requireSupabase();
    const { data, error } = await client
      .from('shop_subscriptions')
      .select('plan_id, starts_at, expires_at, max_users')
      .eq('shop_id', shopId)
      .maybeSingle();
    if (error) throw error;
    const next: ShopSubscription | null = data ? {
      planId: data.plan_id,
      startsAt: data.starts_at,
      expiresAt: data.expires_at,
      maxUsers: data.max_users,
    } : null;
    setSubscription(next);
    if (next && Date.parse(next.expiresAt) > Date.now()) {
      setActiveShopId(shopId);
      const nextSettings = await hydrateShopCache(shopId);
      setSettings(nextSettings);
      setThemeState(nextSettings.theme);
      setLanguageState(nextSettings.language);
      applyAccentColor(nextSettings.accentColor);
    } else {
      setActiveShopId(null);
      await clearLocalShopCache();
      setSettings(null);
    }
  }, [user?.shopId]);

  const restoreSession = useCallback(async (isCurrent: () => boolean = () => true) => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setSessionRestoreError(null);
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      if (!session) {
        await clearLocalShopCache();
        setActiveShopId(null);
        if (isCurrent()) {
          setUser(null);
          setSettings(null);
          setSubscription(null);
        }
        return;
      }

      const activated = await activateUser(session.user);
      if (isCurrent()) {
        setUser(activated.user);
        setSettings(activated.settings);
        setSubscription(activated.subscription);
        const hasPin = activated.user.role !== 'admin' && hasStoredAppPin(activated.user.id);
        setAppPinConfigured(hasPin);
        setAppLockScreen(hasPin ? 'locked' : 'none');
        if (activated.settings) {
          setThemeState(activated.settings.theme);
          setLanguageState(activated.settings.language);
          applyAccentColor(activated.settings.accentColor);
        }
      }
    } catch (error) {
      console.error('Could not restore the Supabase session:', error);
      if (error instanceof AccessDeniedError) {
        await supabase.auth.signOut();
      } else if (isCurrent()) {
        setSessionRestoreError('Could not reconnect to your saved session. Check your connection and retry.');
      }
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' && mounted) {
        setUser(null);
        setSettings(null);
        setSubscription(null);
        setAppLockScreen('none');
        setAppPinConfigured(false);
        setSessionRestoreError(null);
        setActiveShopId(null);
        void clearLocalShopCache();
      }
    });

    void (async () => {
      try {
        await archiveLegacyLocalData();
      } catch (archiveError) {
        console.error('Could not archive existing local shop data:', archiveError);
      }
      await restoreSession(() => mounted);
    })();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [restoreSession]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
  }, [theme]);

  // Shop staff share the same cloud data. Refresh the IndexedDB view while the
  // app is active, and re-check access when a suspended shop/login returns.
  useEffect(() => {
    const shopId = user?.shopId;
    const userId = user?.id;
    if (!shopId || !userId) return;

    let mounted = true;
    let syncing = false;
    const refreshShop = async () => {
      if (syncing || document.visibilityState === 'hidden') return;
      syncing = true;
      try {
        const client = requireSupabase();
        const { data: membership, error: membershipError } = await client
          .from('shop_memberships')
          .select('active')
          .eq('user_id', userId)
          .maybeSingle();
        if (membershipError) throw membershipError;
        if (!membership?.active) {
          await client.auth.signOut();
          return;
        }

        const { data: shop, error: shopError } = await client
          .from('shops')
          .select('active')
          .eq('id', shopId)
          .maybeSingle();
        if (shopError) throw shopError;
        if (!shop?.active) {
          await client.auth.signOut();
          return;
        }

        const { data: shopSubscription, error: subscriptionError } = await client
          .from('shop_subscriptions')
          .select('plan_id, starts_at, expires_at, max_users')
          .eq('shop_id', shopId)
          .maybeSingle();
        if (subscriptionError) throw subscriptionError;
        const nextSubscription: ShopSubscription | null = shopSubscription ? {
          planId: shopSubscription.plan_id,
          startsAt: shopSubscription.starts_at,
          expiresAt: shopSubscription.expires_at,
          maxUsers: shopSubscription.max_users,
        } : null;
        if (!nextSubscription || Date.parse(nextSubscription.expiresAt) <= Date.now()) {
          if (mounted) {
            setSubscription(nextSubscription);
            setSettings(null);
            setActiveShopId(null);
          }
          await clearLocalShopCache();
          return;
        }

        const nextSettings = await hydrateShopCache(shopId);
        if (mounted) {
          setSubscription(nextSubscription);
          setSettings(nextSettings);
          setThemeState(nextSettings.theme);
          setLanguageState(nextSettings.language);
          applyAccentColor(nextSettings.accentColor);
        }
      } catch (error) {
        console.error('Could not refresh this shop:', error);
      } finally {
        syncing = false;
      }
    };

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refreshShop();
    };
    const interval = window.setInterval(() => void refreshShop(), 30_000);
    window.addEventListener('focus', refreshShop);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      mounted = false;
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshShop);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [user?.id, user?.shopId]);

  useEffect(() => {
    i18n.changeLanguage(language);
    document.documentElement.lang = language;
  }, [language, i18n]);

  const updateStoreSettings = async (updates: Partial<StoreSettings>) => {
    if (!user?.shopId) throw new Error('Shop settings are only available to a shop login.');
    const next = await saveShopSettings(updates);
    setSettings(next);
    if (updates.theme !== undefined) setThemeState(next.theme);
    if (updates.language !== undefined) setLanguageState(next.language);
    if (updates.accentColor !== undefined) applyAccentColor(next.accentColor);
  };

  const loginShop = async (shopCode: string, username: string, password: string) => {
    const client = requireSupabase();
    setSessionRestoreError(null);
    const { data, error } = await client.auth.signInWithPassword({
      email: makeLoginEmail(shopCode, username),
      password,
    });
    if (error) throw error;
    try {
      const activated = await activateUser(data.user, shopCode);
      const pinRecoveryRequested = consumePinRecoveryRequest(activated.user.id);
      if (pinRecoveryRequested) clearStoredAppPin(activated.user.id);
      setUser(activated.user);
      setSettings(activated.settings);
      setSubscription(activated.subscription);
      setAppPinConfigured(!pinRecoveryRequested && hasStoredAppPin(activated.user.id));
      setAppLockScreen(pinRecoveryRequested ? 'setup-required' : 'none');
      if (activated.settings) {
        setThemeState(activated.settings.theme);
        setLanguageState(activated.settings.language);
        applyAccentColor(activated.settings.accentColor);
      }
    } catch (error) {
      if (error instanceof AccessDeniedError) await client.auth.signOut();
      throw error;
    }
  };

  const loginAdmin = async (email: string, password: string) => {
    const client = requireSupabase();
    setSessionRestoreError(null);
    const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
    try {
      const { data: admin, error: adminError } = await client
        .from('app_admins')
        .select('user_id')
        .eq('user_id', data.user.id)
        .maybeSingle();
      if (adminError) throw adminError;
      if (!admin) throw new AccessDeniedError('This account is not an administrator.');

      const { data: factors, error: factorsError } = await client.auth.mfa.listFactors();
      if (factorsError) throw factorsError;
      const verifiedTotp = factors.totp.find((factor) => factor.status === 'verified');
      if (verifiedTotp) return { factorId: verifiedTotp.id, needsSetup: false };

      // An interrupted setup leaves an unverified factor behind. It cannot be
      // used to sign in and Supabase rejects another enrollment with the same
      // friendly name, so remove only this app's unfinished factor before retrying.
      // Supabase puts only verified factors in the per-type arrays; pending
      // enrollments are exposed through `all`.
      const unfinishedAdminFactors = factors.all.filter(
        (factor) =>
          factor.factor_type === 'totp' &&
          factor.status === 'unverified' &&
          factor.friendly_name === 'Biller administrator',
      );
      for (const factor of unfinishedAdminFactors) {
        const { error: unenrollError } = await client.auth.mfa.unenroll({ factorId: factor.id });
        if (unenrollError) throw unenrollError;
      }

      const { data: enrollment, error: enrollmentError } = await client.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Biller administrator',
      });
      if (enrollmentError) throw enrollmentError;
      return {
        factorId: enrollment.id,
        needsSetup: true,
        qrCode: enrollment.totp.qr_code,
        secret: enrollment.totp.secret,
      };
    } catch (error) {
      if (error instanceof AccessDeniedError) await client.auth.signOut();
      throw error;
    }
  };

  const completeAdminLogin = async (factorId: string, code: string) => {
    const client = requireSupabase();
    setSessionRestoreError(null);
    const { data: authData, error: authError } = await client.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error('Sign in with your administrator email and password first.');

    const { data: admin, error: adminError } = await client
      .from('app_admins')
      .select('user_id')
      .eq('user_id', authData.user.id)
      .maybeSingle();
    if (adminError) throw adminError;
    if (!admin) throw new Error('This account is not an administrator.');

    const { data: challenge, error: challengeError } = await client.auth.mfa.challenge({ factorId });
    if (challengeError) throw challengeError;
    const { error: verifyError } = await client.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: code.trim(),
    });
    if (verifyError) throw verifyError;

    const activated = await activateUser(authData.user);
    if (activated.user.role !== 'admin') throw new Error('This account is not an administrator.');
    setUser(activated.user);
    setSettings(null);
    setSubscription(null);
    setAppLockScreen('none');
    setAppPinConfigured(false);
  };

  const lockApp = () => {
    if (!user || user.role === 'admin') return;
    const hasPin = hasStoredAppPin(user.id);
    setAppPinConfigured(hasPin);
    setAppLockScreen(hasPin ? 'locked' : 'setup');
  };

  const unlockApp = async (pin: string) => {
    if (!user || user.role === 'admin') return false;
    const verified = await verifyStoredAppPin(user.id, pin);
    if (verified) setAppLockScreen('none');
    return verified;
  };

  const saveAppPin = async (pin: string) => {
    if (!user || user.role === 'admin') throw new Error('Sign in to a shop account to set an app PIN.');
    if (!/^\d{4,6}$/.test(pin)) throw new Error('Choose a PIN with 4 to 6 digits.');
    await saveStoredAppPin(user.id, pin);
    setAppPinConfigured(true);
    setAppLockScreen('none');
  };

  const changeAppPin = async (currentPin: string, newPin: string) => {
    if (!user || user.role === 'admin') return false;
    if (!/^\d{4,6}$/.test(newPin)) throw new Error('Choose a PIN with 4 to 6 digits.');
    if (appPinConfigured && !(await verifyStoredAppPin(user.id, currentPin))) return false;
    await saveStoredAppPin(user.id, newPin);
    setAppPinConfigured(true);
    return true;
  };

  const recoverForgottenPin = () => {
    if (!user || user.role === 'admin') return;
    requestPinRecovery(user.id);
    logout();
  };

  const logout = () => {
    setSessionRestoreError(null);
    setUser(null);
    setSettings(null);
    setSubscription(null);
    setAppLockScreen('none');
    setAppPinConfigured(false);
    setActiveShopId(null);
    void clearLocalShopCache();
    void supabase?.auth.signOut();
  };

  const setTheme = (nextTheme: Theme) => {
    setThemeState(nextTheme);
    if (user?.shopId) void updateStoreSettings({ theme: nextTheme }).catch(console.error);
  };

  const setLanguage = (nextLanguage: Language) => {
    setLanguageState(nextLanguage);
    if (user?.shopId) void updateStoreSettings({ language: nextLanguage }).catch(console.error);
  };

  const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light');

  return (
    <AppContext.Provider value={{
      settings,
      loading,
      sessionRestoreError,
      configured: isSupabaseConfigured,
      theme,
      language,
      user,
      subscription,
      subscriptionActive,
      isAuthenticated: Boolean(user),
      isAdmin: user?.role === 'admin',
      appLockScreen,
      appPinConfigured,
      toggleTheme,
      setTheme,
      setLanguage,
      updateStoreSettings,
      refreshSubscription,
      loginShop,
      loginAdmin,
      completeAdminLogin,
      lockApp,
      unlockApp,
      saveAppPin,
      changeAppPin,
      recoverForgottenPin,
      retrySessionRestore: () => restoreSession(),
      logout,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
