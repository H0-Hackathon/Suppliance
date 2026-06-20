import { useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import api from '../services/api';

export function AuthInterceptor({ children }) {
  const { getAccessTokenSilently } = useAuth0();

  useEffect(() => {
    const requestInterceptor = api.interceptors.request.use(
      async (config) => {
        try {
          const token = await getAccessTokenSilently();
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        } catch (error) {
          console.error("Error getting access token silently:", error);
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    return () => {
      api.interceptors.request.eject(requestInterceptor);
    };
  }, [getAccessTokenSilently]);

  return children;
}
