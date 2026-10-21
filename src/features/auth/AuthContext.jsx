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

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [needsTelegram, setNeedsTelegram] = useState(false);

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
      if (tg.themeParams?.bg_color) {
        document.documentElement.style.setProperty('--tg-bg', tg.themeParams.bg_color);
      }

      const initData = tg.initData;
      if (!initData) {
        // Opened in Telegram shell but initData empty (e.g. opened as plain link inside TG)
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
    } catch (err) {
      console.error('Auth error:', err);
      setError(err.message || 'Gagal masuk');
      // Keep needsTelegram true only when clearly outside Telegram
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
      // ignore
    }
    setUser(null);
  }, []);

  useEffect(() => {
    (async () => {
      // 1) Existing session cookie
      try {
        const data = await api.me();
        if (data?.user) {
          setUser(data.user);
          setLoading(false);
          window.Telegram?.WebApp?.ready?.();
          window.Telegram?.WebApp?.expand?.();
          return;
        }
      } catch {
        // no session — continue
      }

      // 2) Telegram initData login
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
