import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, setToken, clearToken } from '../services/api';
import { getSocket, disconnectSocket } from '../services/socket';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On a hard refresh the token is already in localStorage, so re-validate it
  // against the server rather than trusting it blindly.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { user: me } = await api.me();
        if (!cancelled) setUser(me);
      } catch {
        clearToken();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (credentials) => {
    const { token, user: loggedIn } = await api.login(credentials);
    setToken(token);
    setUser(loggedIn);
    return loggedIn;
  };

  const register = async (details) => {
    const { token, user: created } = await api.register(details);
    setToken(token);
    setUser(created);
    return created;
  };

  const logout = () => {
    clearToken();
    disconnectSocket();
    setUser(null);
  };

  const value = useMemo(
    () => ({ user, loading, login, register, logout, socket: getSocket }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an AuthProvider');
  return context;
};
