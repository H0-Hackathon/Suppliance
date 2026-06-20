import React, { useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

/**
 * CoastGuard — Auth Interceptor
 *
 * Wraps the app to inject the Custom JWT Bearer token into every Axios request.
 * If API calls fail with 401, it logs the user out.
 */
export function AuthInterceptor({ children }) {
  const { token, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // 1. Add token to outgoing requests
    const requestInterceptor = api.interceptors.request.use(
      (config) => {
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // 2. Handle 401 Unauthorized responses
    const responseInterceptor = api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          console.warn("API returned 401 Unauthorized. Logging out.");
          logout();
          navigate('/login');
        }
        return Promise.reject(error);
      }
    );

    // Cleanup interceptors on unmount or token change
    return () => {
      api.interceptors.request.eject(requestInterceptor);
      api.interceptors.response.eject(responseInterceptor);
    };
  }, [token, logout, navigate]);

  return <>{children}</>;
}
