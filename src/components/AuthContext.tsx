import React, { createContext, useContext, useState, useEffect } from 'react';

const API_BASE = 'http://localhost:8787';

interface User {
  id: number;
  name: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signup: (name: string, email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [checked, setChecked] = useState(false);

  // On mount, verify stored token with the server
  useEffect(() => {
    const token = localStorage.getItem('persona_token');
    if (!token) { setChecked(true); return; }

    fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setUser(data.user))
      .catch(() => { localStorage.removeItem('persona_token'); })
      .finally(() => setChecked(true));
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, error: data.error || 'Login failed' };
      localStorage.setItem('persona_token', data.token);
      setUser(data.user);
      return { ok: true };
    } catch {
      return { ok: false, error: 'Network error. Is the server running?' };
    }
  };

  const signup = async (name: string, email: string, password: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, error: data.error || 'Signup failed' };
      localStorage.setItem('persona_token', data.token);
      setUser(data.user);
      return { ok: true };
    } catch {
      return { ok: false, error: 'Network error. Is the server running?' };
    }
  };

  const logout = () => {
    localStorage.removeItem('persona_token');
    setUser(null);
  };

  if (!checked) return null; // avoid flash while verifying token

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
