import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAxios } from '../../hooks/useAxios';
import { API_ENDPOINTS } from '../../config/api';

const EDITABLE_FIELDS = ['retailer_name', 'shop_name', 'phone', 'email', 'address'];

function EditSkeleton() {
  return (
    <div className="max-w-3xl mx-auto animate-pulse">
      <div className="h-9 w-56 bg-slate-100 rounded mb-2" />
      <div className="h-4 w-72 bg-slate-100 rounded mb-6" />
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-6">
        <div className="h-10 bg-slate-100 rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-10 bg-slate-100 rounded-lg" />
          ))}
        </div>
        <div className="h-24 bg-slate-100 rounded-lg" />
      </div>
    </div>
  );
}

export default function CustomerEdit() {
  const { id } = useParams();
  const api = useAxios();
  const navigate = useNavigate();

  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [apiError, setApiError] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    setError,
    clearErrors,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({
    defaultValues: {
      retailer_name: '',
      shop_name: '',
      phone: '',
      email: '',
      address: '',
    },
  });

  const fetchCustomer = useCallback(async () => {
    try {
      const res = await api.get(API_ENDPOINTS.RETAILER_DETAIL(id));
      const data = res.data;

      setCustomer(data);
      setNotFound(false);
      setLoadError('');
      reset({
        retailer_name: data.retailer_name ?? '',
        shop_name: data.shop_name ?? '',
        phone: data.phone ?? '',
        email: data.email ?? '',
        address: data.address ?? '',
      });
    } catch (err) {
      const status = err.response?.status;
      if (status === 401) return; // interceptor handles logout
      if (status === 404) {
        setNotFound(true);
      } else {
        setLoadError(err.response?.data?.detail || 'Failed to load customer');
      }
    } finally {
      setLoading(false);
    }
  }, [api, id, reset]);

  useEffect(() => {
    // Deferred so the initial fetch does not cascade a synchronous render.
    const timer = setTimeout(() => {
      fetchCustomer();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchCustomer]);

  const onSubmit = async (data) => {
    setApiError('');
    clearErrors();

    const payload = {
      retailer_name: data.retailer_name.trim(),
      shop_name: data.shop_name.trim(),
      phone: data.phone.trim(),
      email: data.email.trim(),
      address: data.address.trim(),
    };

    try {
      await api.patch(API_ENDPOINTS.RETAILER_DETAIL(id), payload);
      navigate(`/customers/${id}`, { replace: true });
    } catch (err) {
      const res = err.response;

      if (!res) {
        setApiError('Unable to connect to the server. Please try again.');
        return;
      }

      if (res.status === 400 && res.data && typeof res.data === 'object') {
        let handled = false;

        EDITABLE_FIELDS.forEach((field) => {
          const message = res.data[field];
          if (message) {
            setError(field, {
              type: 'server',
              message: Array.isArray(message) ? message[0] : String(message),
            });
            handled = true;
          }
        });

        if (res.data.detail) {
          setApiError(Array.isArray(res.data.detail) ? res.data.detail[0] : res.data.detail);
          handled = true;
        }

        if (res.data.non_field_errors) {
          const msg = res.data.non_field_errors;
          setApiError(Array.isArray(msg) ? msg.join(' ') : String(msg));
          handled = true;
        }

        if (!handled) {
          setApiError('Please check your inputs and try again.');
        }
        return;
      }

      if (res.status === 404) {
        setNotFound(true);
        return;
      }

      setApiError(res.data?.detail || 'Failed to update customer');
    }
  };

  const handleRetry = () => {
    setLoadError('');
    setNotFound(false);
    setLoading(true);
    fetchCustomer();
  };

  if (loading) return <EditSkeleton />;

  if (notFound) {
    return (
      <div className="max-w-lg mx-auto mt-16 bg-white border border-slate-200 rounded-xl shadow-sm p-10 text-center">
        <div className="w-12 h-12 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-orange-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
          </svg>
        </div>
        <h1 className="text-lg font-semibold text-slate-900">Customer not found</h1>
        <p className="text-sm text-slate-500 mt-1">This customer may have been deleted.</p>
        <button
          onClick={() => navigate('/customers')}
          className="mt-5 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 rounded-lg shadow-md shadow-orange-500/25 transition-all cursor-pointer"
        >
          Back to customers
        </button>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-lg mx-auto mt-16">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-8 text-center">
          <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-slate-900">Could not load customer</h1>
          <p className="text-sm text-slate-500 mt-1">{loadError}</p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <button
              onClick={() => navigate('/customers')}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Back
            </button>
            <button
              onClick={handleRetry}
              className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 rounded-lg shadow-md shadow-orange-500/25 transition-all cursor-pointer"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const displayName = customer?.retailer_name || customer?.shop_name || 'Customer';

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate(`/customers/${id}`)}
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          title="Back to customer"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
        </button>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-900">Edit Customer</h1>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                customer?.is_active
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-slate-100 text-slate-500 border-slate-200'
              }`}
            >
              {customer?.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5 truncate">
            Update the details for {displayName}
          </p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
        {apiError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-start gap-3" role="alert">
            <svg className="w-5 h-5 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="font-semibold">Error saving customer</p>
              <p>{apiError}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Retailer Name */}
            <div className="md:col-span-2">
              <label htmlFor="retailer_name" className="block text-sm font-medium text-slate-700 mb-1">
                Retailer Name <span className="text-red-500">*</span>
              </label>
              <input
                id="retailer_name"
                type="text"
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 ${
                  errors.retailer_name ? 'border-red-300 bg-red-50' : 'border-slate-300'
                }`}
                placeholder="e.g. Acme Retailers"
                {...register('retailer_name', { required: 'Retailer name is required' })}
              />
              {errors.retailer_name && (
                <p className="mt-1 text-xs text-red-500">{errors.retailer_name.message}</p>
              )}
            </div>

            {/* Shop Name */}
            <div>
              <label htmlFor="shop_name" className="block text-sm font-medium text-slate-700 mb-1">
                Shop / Business Name
              </label>
              <input
                id="shop_name"
                type="text"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500"
                placeholder="e.g. Acme Electronics"
                {...register('shop_name')}
              />
              {errors.shop_name && (
                <p className="mt-1 text-xs text-red-500">{errors.shop_name.message}</p>
              )}
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-slate-700 mb-1">
                Phone Number <span className="text-red-500">*</span>
              </label>
              <input
                id="phone"
                type="tel"
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 ${
                  errors.phone ? 'border-red-300 bg-red-50' : 'border-slate-300'
                }`}
                placeholder="10-digit mobile number"
                {...register('phone', { required: 'Phone number is required' })}
              />
              {errors.phone && (
                <p className="mt-1 text-xs text-red-500">{errors.phone.message}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 ${
                  errors.email ? 'border-red-300 bg-red-50' : 'border-slate-300'
                }`}
                placeholder="contact@business.com"
                {...register('email', {
                  pattern: {
                    value: /^\S+@\S+\.\S+$/,
                    message: 'Invalid email address',
                  },
                })}
              />
              {errors.email && (
                <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>
              )}
            </div>

            {/* Address */}
            <div className="md:col-span-2">
              <label htmlFor="address" className="block text-sm font-medium text-slate-700 mb-1">
                Street Address
              </label>
              <textarea
                id="address"
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 resize-none"
                placeholder="Complete address including building, street, area..."
                {...register('address')}
              />
              {errors.address && (
                <p className="mt-1 text-xs text-red-500">{errors.address.message}</p>
              )}
            </div>
          </div>

          <p className="text-xs text-slate-400">
            Credit balance and account status are managed by the system and cannot be edited here.
          </p>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate(`/customers/${id}`)}
              className="px-5 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !isDirty}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 rounded-lg shadow-md shadow-orange-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
