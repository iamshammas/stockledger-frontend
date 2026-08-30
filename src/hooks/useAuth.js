import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

/**
 * Shorthand hook for accessing the AuthContext.
 * Usage: const { user, token, isAuthenticated, login, logout } = useAuth();
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
