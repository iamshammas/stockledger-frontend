import { createContext, useReducer, useEffect } from 'react';

// Action types
const AUTH_ACTIONS = {
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGOUT: 'LOGOUT',
  SET_LOADING: 'SET_LOADING',
};

// Initial state — rehydrate from localStorage if available
const getInitialState = () => {
  const token = localStorage.getItem('token');
  const refreshToken = localStorage.getItem('refreshToken');
  const userStr = localStorage.getItem('user');

  let user = null;
  if (userStr) {
    try {
      user = JSON.parse(userStr);
    } catch {
      // Corrupted data — clear it
      localStorage.removeItem('user');
    }
  }

  return {
    user,
    token: token || null,
    refreshToken: refreshToken || null,
    isAuthenticated: !!token,
    loading: true,
  };
};

// Reducer
const authReducer = (state, action) => {
  switch (action.type) {
    case AUTH_ACTIONS.LOGIN_SUCCESS:
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        refreshToken: action.payload.refreshToken,
        isAuthenticated: true,
        loading: false,
      };
    case AUTH_ACTIONS.LOGOUT:
      return {
        ...state,
        user: null,
        token: null,
        refreshToken: null,
        isAuthenticated: false,
        loading: false,
      };
    case AUTH_ACTIONS.SET_LOADING:
      return {
        ...state,
        loading: action.payload,
      };
    default:
      return state;
  }
};

// Context
export const AuthContext = createContext(null);

// Provider
export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, null, getInitialState);

  // On mount, check if stored token is still valid by marking loading as done
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      dispatch({ type: AUTH_ACTIONS.LOGOUT });
    } else {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false });
    }
  }, []);

  // Login: persist to localStorage + dispatch
  const login = ({ access, refresh, user }) => {
    localStorage.setItem('token', access);
    localStorage.setItem('refreshToken', refresh);
    localStorage.setItem('user', JSON.stringify(user));

    dispatch({
      type: AUTH_ACTIONS.LOGIN_SUCCESS,
      payload: {
        user,
        token: access,
        refreshToken: refresh,
      },
    });
  };

  // Logout: clear everything
  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    dispatch({ type: AUTH_ACTIONS.LOGOUT });
  };

  const isSuperAdmin = state.user?.role === 'SUPER_ADMIN';
  const getDashboardPath = () => isSuperAdmin ? '/dashboard/admin' : '/dashboard/seller';

  const value = {
    user: state.user,
    token: state.token,
    isAuthenticated: state.isAuthenticated,
    loading: state.loading,
    isSuperAdmin,
    getDashboardPath,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
