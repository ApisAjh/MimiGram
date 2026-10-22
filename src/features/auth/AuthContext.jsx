import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';

const AuthContext = createContext(null);

function isInsideTelegram() {
  try {
    const tg = window.Telegram?.WebApp;
    return Boolean(tg && (tg.initData || tg.initDataUnsafe?.user));
  } catch {
    return false;
  }
}

function applyTheme(theme) {
  const t = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', t);
  try {
    localStorage.setItem('mg_theme', t);
  } catch {
    /* ignore */
  }
}

function loadTheme() {
  try {
    const t = localStorage.getItem('mg_theme');
    if (t === 'dark' || t === 'light') {
      document.documentElement.setAttribute('data-theme', t);
      return t;
    }
  } catch {
    /* ignore */
  }
  document.documentElement.setAttribute('data-theme', 'light');
  return 'light';
}

function isOnboarded(userId) {
  try {
    return localStorage.getItem(`mg_onboard_${userId}`) === '1';
  } catch {
    return false;
  }
}

function markOnboarded(userId) {
  try {
    localStorage.setItem(`mg_onboard_${userId}`, '1');
  } catch {
    /* ignore */
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [needsTelegram, setNeedsTelegram] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [theme, setThemeState] = useState('light');

  useEffect(() => {
    setThemeState(loadTheme());
  }, []);

  const setTheme = useCallback((t) => {
    applyTheme(t);
    setThemeState(t === 'dark' ? 'dark' : 'light');
  }, []);

  const loginWithTelegram = useCallback(async () => {
    setError(null);
    try {
      const tg = window.Telegram?.WebApp;
      if (!tg) {
        setNeedsTelegram(true);
        setError(null);
        setLoading(false);
        return;
      }

      tg.ready?.();
      tg.expand?.();

      const initData = tg.initData;
      if (!initData) {
        setNeedsTelegram(true);
        setError(
          'initData kosong. Buka Mini App lewat tombol bot (Menu Button / web_app), bukan lewat link biasa.'
        );
        setLoading(false);
        return;
      }

      const data = await api.authTelegram(initData);
      if (!data?.user) {
        setError('Response login tidak valid');
        setLoading(false);
        return;
      }

      setUser(data.user);
      setNeedsTelegram(false);
      setError(null);
      // Onboarding only if never completed for this user id
      setNeedsOnboarding(!isOnboarded(data.user.id));
    } catch (err) {
      console.error('Auth error:', err);
      setError(err.message || 'Gagal masuk');
      if (!isInsideTelegram()) {
        setNeedsTelegram(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const data = await api.me();
      setUser(data.user);
      return data.user;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      /* ignore */
    }
    setUser(null);
    setNeedsOnboarding(false);
  }, []);

  const completeOnboarding = useCallback(() => {
    if (user?.id) markOnboarded(user.id);
    setNeedsOnboarding(false);
  }, [user?.id]);

  useEffect(() => {
    (async () => {
      const tg = window.Telegram?.WebApp;
      const initData = tg?.initData;
      const tgId = tg?.initDataUnsafe?.user?.id;

      // Always re-auth with Telegram when initData exists → ganti akun otomatis
      if (initData) {
        // If cookie session is different telegram user, overwrite via authTelegram
        try {
          const data = await api.me();
          if (data?.user && tgId && String(data.user.telegram_id) !== String(tgId)) {
            try {
              await api.logout();
            } catch {
              /* ignore */
            }
          }
        } catch {
          /* no session */
        }
        await loginWithTelegram();
        return;
      }

      // No initData: try existing cookie (dev / rare)
      try {
        const data = await api.me();
        if (data?.user) {
          setUser(data.user);
          setNeedsOnboarding(!isOnboarded(data.user.id));
          setLoading(false);
          tg?.ready?.();
          tg?.expand?.();
          return;
        }
      } catch {
        /* no session */
      }

      await loginWithTelegram();
    })();
  }, [loginWithTelegram]);

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        loading,
        error,
        needsTelegram,
        needsOnboarding,
        completeOnboarding,
        theme,
        setTheme,
        loginWithTelegram,
        refreshUser,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
