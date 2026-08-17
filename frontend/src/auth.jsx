import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, clearAuth, onTokenRefreshed, readStoredAuth, storeAuth } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const stored = readStoredAuth();
  const [token, setToken] = useState(stored.token);
  const [refreshToken, setRefreshTokenState] = useState(stored.refreshToken);
  const [user, setUser] = useState(stored.user);
  const [profile, setProfile] = useState(null);

  const login = (nextToken, nextUser, nextRefreshToken) => {
    storeAuth(nextToken, nextUser, nextRefreshToken);
    setToken(nextToken);
    setRefreshTokenState(nextRefreshToken || null);
    setUser(nextUser);
  };

  const logout = () => {
    // Best-effort server-side revocation of the refresh token; local state
    // is cleared regardless of whether this call succeeds.
    if (refreshToken) {
      api('/auth/logout', { method: 'POST', body: { refreshToken } }).catch(() => {});
    }
    clearAuth();
    setToken(null);
    setRefreshTokenState(null);
    setUser(null);
    setProfile(null);
  };

  // When api.js silently exchanges an expired access token for a new one,
  // keep React state in sync so subsequent renders/requests use it too.
  useEffect(() => {
    onTokenRefreshed((nextToken, nextRefreshToken) => {
      setToken(nextToken);
      setRefreshTokenState(nextRefreshToken);
    });
  }, []);

  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    api('/auth/me', { token })
      .then((data) => {
        if (cancelled) return;
        setUser((prev) => ({ ...prev, ...data.user }));
        setProfile(data.responderProfile || null);
      })
      .catch(() => {
        if (!cancelled) logout();
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const value = useMemo(
    () => ({ token, user, profile, setProfile, login, logout, isAuthed: Boolean(token && user) }),
    [token, user, profile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
