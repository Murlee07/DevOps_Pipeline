import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, tokenStore } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() => Boolean(tokenStore.get()));

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  useEffect(() => {
    if (!tokenStore.get()) return undefined;
    let cancelled = false;
    api
      .me()
      .then((d) => !cancelled && setUser(d.user))
      .catch(() => !cancelled && logout())
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [logout]);

  useEffect(() => {
    const onUnauthorized = () => logout();
    window.addEventListener('shieldboard:unauthorized', onUnauthorized);
    return () => window.removeEventListener('shieldboard:unauthorized', onUnauthorized);
  }, [logout]);

  const handleAuth = useCallback(({ token, user: u }) => {
    tokenStore.set(token);
    setUser(u);
  }, []);

  const login = useCallback(async (email, password) => handleAuth(await api.login({ email, password })), [handleAuth]);
  const register = useCallback(
    async (name, email, password) => handleAuth(await api.register({ name, email, password })),
    [handleAuth],
  );

  const value = useMemo(() => ({ user, loading, login, register, logout }), [user, loading, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
