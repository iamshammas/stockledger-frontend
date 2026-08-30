import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL, API_ENDPOINTS } from '../config/api';
import { useAuth } from '../hooks/useAuth';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [apiError, setApiError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();

  const onSubmit = async (data) => {
    setApiError('');
    setIsSubmitting(true);

    try {
      const response = await axios.post(
        `${API_BASE_URL}${API_ENDPOINTS.LOGIN}`,
        {
          username: data.username,
          password: data.password,
        }
      );

      // Store JWT + user in context & localStorage
      login({
        access: response.data.access,
        refresh: response.data.refresh,
        user: response.data.user,
      });

      // Redirect based on role
      const role = response.data.user?.role;
      const dashPath = role === 'SUPER_ADMIN' ? '/dashboard/admin' : '/dashboard/seller';
      navigate(dashPath, { replace: true });
    } catch (error) {
      if (!error.response) {
        setApiError('Unable to connect to server');
      } else if (error.response.status === 401) {
        setApiError('Invalid username or password');
      } else if (error.response.status === 400) {
        setApiError(
          error.response.data?.detail ||
            error.response.data?.non_field_errors?.[0] ||
            'Invalid request. Please check your inputs.'
        );
      } else {
        setApiError('Something went wrong. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 px-4">
      {/* Subtle background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-200/30 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-200/30 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-[400px]">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/25 mb-4">
            <svg
              className="w-7 h-7 text-white"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.8}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            StockLedger
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Sign in to your account
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white/80 backdrop-blur-sm border border-white/60 rounded-2xl shadow-xl shadow-slate-200/50 p-8">
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            {/* API Error */}
            {apiError && (
              <div
                id="login-api-error"
                className="mb-5 flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg"
                role="alert"
              >
                <svg
                  className="w-4 h-4 mt-0.5 shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>{apiError}</span>
              </div>
            )}

            {/* Username Field */}
            <div className="mb-5">
              <label
                htmlFor="login-username"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Username
              </label>
              <input
                id="login-username"
                type="text"
                autoComplete="username"
                placeholder="Enter your username"
                className={`block w-full px-3.5 py-2.5 bg-slate-50 border rounded-lg text-slate-900 text-sm placeholder-slate-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 focus:bg-white ${
                  errors.username
                    ? 'border-red-400 focus:ring-red-500/40 focus:border-red-500'
                    : 'border-slate-200'
                }`}
                {...register('username', {
                  required: 'Username is required',
                })}
              />
              {errors.username && (
                <p className="mt-1.5 text-xs text-red-600">
                  {errors.username.message}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div className="mb-6">
              <label
                htmlFor="login-password"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Password
              </label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                className={`block w-full px-3.5 py-2.5 bg-slate-50 border rounded-lg text-slate-900 text-sm placeholder-slate-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 focus:bg-white ${
                  errors.password
                    ? 'border-red-400 focus:ring-red-500/40 focus:border-red-500'
                    : 'border-slate-200'
                }`}
                {...register('password', {
                  required: 'Password is required',
                })}
              />
              {errors.password && (
                <p className="mt-1.5 text-xs text-red-600">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              id="login-submit-btn"
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-semibold rounded-lg shadow-md shadow-blue-500/25 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>
        </div>

        {/* Footer hint */}
        <p className="text-center text-xs text-slate-400 mt-6">
          StockLedger — Inventory & Billing Platform
        </p>
      </div>
    </div>
  );
}
