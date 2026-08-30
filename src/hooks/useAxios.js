import { useMemo } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import { useAuth } from './useAuth';

/**
 * Returns an Axios instance pre-configured with:
 * - baseURL from API config
 * - Authorization header from current auth token
 * - 401 interceptor that triggers logout on expired tokens
 */
export function useAxios() {
  const { token, logout } = useAuth();

  const axiosInstance = useMemo(() => {
    const instance = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor: attach JWT token
    instance.interceptors.request.use(
      (config) => {
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor: handle 401 (expired token)
    instance.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          logout();
        }
        return Promise.reject(error);
      }
    );

    return instance;
  }, [token, logout]);

  return axiosInstance;
}
