import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [needsTelegram, setNeedsTelegram] = useState(false);

  const loginWithTelegram = useCallback(async () => {
    setError(null);
    try {
      const tg = window.Telegram?.WebApp;
      if (!tg || !tg.initData) {
        setNeedsTelegram(true);
        setLoading(false);
        return;
      }

      tg.ready();
      tg.expand();
      // Apply theme if available
      if (tg.themeParams?.bg_color) {
        document.documentElement.style.setProperty('--tg-bg', tg.themeParams.bg_color);
      }

      const data = await api.authTelegram(tg.initData);
      setUser(data.user);
      setNeedsTelegram(false);
    } catch (err) {
      console.error('Auth error:', err);
      if (err.status === 401) {
        setNeedsTelegram(true);
        setError(err.message);
      } else {
        setError(err.message || 'Gagal masuk');
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
    // Try session first, then Telegram initData
    (async () => {
      try {
        const data = await api.me();
        setUser(data.user);
        setLoading(false);
        // Still expand Telegram if present
        window.Telegram?.WebApp?.ready?.();
        window.Telegram?.WebApp?.expand?.();
      } catch {
        await loginWithTelegram();
      }
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
