import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [subscription, setSubscription] = useState(null); // { status, plan, hours_left, expires_at }
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const savedToken = localStorage.getItem('coastguard_token');
    const savedUser = localStorage.getItem('coastguard_user');
    const savedSub = localStorage.getItem('coastguard_subscription');

    if (savedToken && savedUser) {
      setToken(savedToken);
      try { setUser(JSON.parse(savedUser)); } catch {}
      try { setSubscription(JSON.parse(savedSub)); } catch {}
    }
    setIsLoading(false);
  }, []);

  const login = (accessToken, userData, subscriptionData) => {
    setToken(accessToken);
    setUser(userData);
    setSubscription(subscriptionData || null);
    localStorage.setItem('coastguard_token', accessToken);
    localStorage.setItem('coastguard_user', JSON.stringify(userData));
    localStorage.setItem('coastguard_subscription', JSON.stringify(subscriptionData || null));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setSubscription(null);
    localStorage.removeItem('coastguard_token');
    localStorage.removeItem('coastguard_user');
    localStorage.removeItem('coastguard_subscription');
    navigate('/login');
  };

  // Refresh subscription from server (called on dashboard load)
  const refreshSubscription = async () => {
    if (!token) return;
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'}/api/v2/auth/me`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setSubscription(data.subscription);
        localStorage.setItem('coastguard_subscription', JSON.stringify(data.subscription));
      }
    } catch {}
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      subscription,
      isAuthenticated: !!token,
      isLoading,
      login,
      logout,
      refreshSubscription,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
