import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useAxios } from '../hooks/useAxios';
import { API_ENDPOINTS } from '../config/api';

const fmt = (val) => {
  const num = parseFloat(val);
  if (isNaN(num)) return '₹0.00';
  return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const errorMessage = (value) => {
  if (!value) return '';
  if (Array.isArray(value)) return String(value[0]);
  if (typeof value === 'object') return 'Invalid value';
  return String(value);
};

const inputBase =
  'w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500';

async function fetchTenantRows(api) {
  const res = await api.get(API_ENDPOINTS.TENANTS_LIST);
  return Array.isArray(res.data) ? res.data : res.data?.results ?? [];
}

async function loadTenantData(api, tenantId) {
  const params = { tenant_id: tenantId };
  const [valRes, salesRes, lowRes] = await Promise.allSettled([
    api.get(API_ENDPOINTS.REPORTS_STOCK_VALUATION, { params }),
    api.get(API_ENDPOINTS.SALES_LIST, { params: { ...params, limit: 5 } }),
    api.get(API_ENDPOINTS.REPORTS_LOW_STOCK, { params }),
  ]);

  const stockValue = valRes.status === 'fulfilled'
    ? valRes.value.data?.total_value ?? 0 : 0;
  const salesData = salesRes.status === 'fulfilled'
    ? (Array.isArray(salesRes.value.data) ? salesRes.value.data : salesRes.value.data?.results ?? []) : [];
  const salesCount = salesRes.status === 'fulfilled'
    ? salesRes.value.data?.count ?? salesData.length : 0;
  const lowCount = lowRes.status === 'fulfilled'
    ? lowRes.value.data?.count ?? (Array.isArray(lowRes.value.data) ? lowRes.value.data.length : lowRes.value.data?.results?.length ?? 0) : 0;

  return {
    stats: { stockValue, salesCount, lowStock: lowCount },
    sales: salesData.slice(0, 5),
  };
}

function StatusBadge({ status }) {
  const s = (status || '').toLowerCase();
  let cls = 'bg-slate-100 text-slate-600';
  if (s === 'paid' || s === 'completed') cls = 'bg-emerald-50 text-emerald-700';
  else if (s === 'pending' || s === 'partial') cls = 'bg-amber-50 text-amber-700';
  else if (s === 'overdue' || s === 'cancelled') cls = 'bg-red-50 text-red-700';
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize ${cls}`}>
      {status || '—'}
    </span>
  );
}

// ── Tenant card ──
function TenantCard({ tenant, selected, onSelect }) {
  const isActive = selected?.id === tenant.id;
  return (
    <button
      onClick={() => onSelect(tenant)}
      className={`w-full text-left p-4 rounded-xl border-2 transition-all cursor-pointer ${
        isActive
          ? 'border-violet-500 bg-violet-50 shadow-md shadow-violet-100'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
          isActive ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600'
        }`}>
          {(tenant.name || 'T').charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-semibold truncate ${isActive ? 'text-violet-900' : 'text-slate-900'}`}>
            {tenant.name || `Tenant #${tenant.id}`}
          </p>
          <p className="text-xs text-slate-500 truncate">
            {tenant.owner_username ? `@${tenant.owner_username}` : `ID: ${tenant.id}`}
          </p>
        </div>
        {isActive && (
          <svg className="w-5 h-5 text-violet-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
          </svg>
        )}
      </div>
      {Array.isArray(tenant.sellers) && tenant.sellers.length > 0 && (
        <p className="mt-2 text-[11px] text-slate-400">
          {tenant.sellers.length} seller{tenant.sellers.length !== 1 ? 's' : ''}
        </p>
      )}
    </button>
  );
}

// ── Skeleton ──
function SkeletonRow({ cols }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>
      ))}
    </tr>
  );
}

// ── Create seller (user + tenant) ──
function CreateSellerModal({ api, onClose, onCreated }) {
  const [serverError, setServerError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: { username: '', password: '', tenant_name: '', phone_number: '' },
  });

  const submit = async (data) => {
    setServerError('');

    const payload = {
      username: data.username.trim(),
      password: data.password,
      tenant_name: data.tenant_name.trim(),
      phone_number: data.phone_number.trim(),
    };

    try {
      const res = await api.post(API_ENDPOINTS.REGISTER_SELLER, payload);
      onCreated(res.data);
    } catch (err) {
      const res = err.response;

      if (!res) {
        setServerError('Unable to connect to the server. Please try again.');
        return;
      }
      if (res.status === 401) return; // interceptor handles logout
      if (res.status === 403) {
        setServerError('Only a Super Admin can create sellers.');
        return;
      }

      if (res.status === 400 && res.data && typeof res.data === 'object') {
        let mapped = false;
        ['username', 'password', 'tenant_name', 'phone_number'].forEach((field) => {
          if (res.data[field]) {
            mapped = true;
            setError(field, { type: 'server', message: errorMessage(res.data[field]) });
          }
        });

        const banner =
          errorMessage(res.data.detail) || errorMessage(res.data.non_field_errors);
        if (banner) setServerError(banner);
        else if (!mapped) setServerError('Please check the highlighted fields.');
        return;
      }

      setServerError(
        errorMessage(res.data?.detail) || 'Failed to create seller. Please try again.'
      );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50"
      onClick={isSubmitting ? undefined : onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-seller-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-100 flex items-start justify-between gap-4">
          <div>
            <h2 id="create-seller-title" className="text-base font-semibold text-slate-900">
              Create seller
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Creates the login, tenant, and seller profile in one step.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit(submit)} className="px-6 py-5 space-y-4" noValidate>
          {serverError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg" role="alert">
              {serverError}
            </div>
          )}

          <div>
            <label htmlFor="seller-username" className="block text-sm font-medium text-slate-700 mb-1">
              Username <span className="text-red-500">*</span>
            </label>
            <input
              id="seller-username"
              type="text"
              autoFocus
              autoComplete="off"
              maxLength={150}
              className={`${inputBase} ${errors.username ? 'border-red-300 bg-red-50' : 'border-slate-300'}`}
              placeholder="e.g. acme_seller"
              {...register('username', { required: 'Username is required' })}
            />
            {errors.username && <p className="mt-1 text-xs text-red-500">{errors.username.message}</p>}
          </div>

          <div>
            <label htmlFor="seller-password" className="block text-sm font-medium text-slate-700 mb-1">
              Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                id="seller-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                className={`${inputBase} pr-10 ${errors.password ? 'border-red-300 bg-red-50' : 'border-slate-300'}`}
                placeholder="At least 8 characters"
                {...register('password', {
                  required: 'Password is required',
                  minLength: { value: 8, message: 'Password must be at least 8 characters long' },
                  validate: {
                    hasUpper: (v) =>
                      /[A-Z]/.test(v) || 'Password must contain at least one uppercase letter',
                    hasLower: (v) =>
                      /[a-z]/.test(v) || 'Password must contain at least one lowercase letter',
                    hasDigit: (v) => /\d/.test(v) || 'Password must contain at least one digit',
                  },
                })}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
            </div>
            {errors.password ? (
              <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>
            ) : (
              <p className="mt-1 text-xs text-slate-400">
                Min 8 characters with an uppercase letter, a lowercase letter, and a digit.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="seller-tenant" className="block text-sm font-medium text-slate-700 mb-1">
              Tenant / business name <span className="text-red-500">*</span>
            </label>
            <input
              id="seller-tenant"
              type="text"
              maxLength={255}
              className={`${inputBase} ${errors.tenant_name ? 'border-red-300 bg-red-50' : 'border-slate-300'}`}
              placeholder="e.g. Acme Traders"
              {...register('tenant_name', {
                required: 'Tenant name is required',
                validate: (v) => v.trim().length > 0 || 'Tenant name cannot be blank',
              })}
            />
            {errors.tenant_name && (
              <p className="mt-1 text-xs text-red-500">{errors.tenant_name.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="seller-phone" className="block text-sm font-medium text-slate-700 mb-1">
              Phone number <span className="text-red-500">*</span>
            </label>
            <input
              id="seller-phone"
              type="tel"
              maxLength={10}
              className={`${inputBase} ${errors.phone_number ? 'border-red-300 bg-red-50' : 'border-slate-300'}`}
              placeholder="10-digit mobile number"
              {...register('phone_number', {
                required: 'Phone number is required',
                pattern: { value: /^\d{10}$/, message: 'Phone number must be exactly 10 digits' },
              })}
            />
            {errors.phone_number && (
              <p className="mt-1 text-xs text-red-500">{errors.phone_number.message}</p>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 rounded-lg shadow-md shadow-violet-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              {isSubmitting ? 'Creating...' : 'Create seller'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ════════════════════════════════════════
export default function SuperAdminDashboard() {
  const api = useAxios();

  // Tenants
  const [tenants, setTenants] = useState([]);
  const [tenantsLoading, setTenantsLoading] = useState(true);
  const [tenantsError, setTenantsError] = useState('');
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [searchTenant, setSearchTenant] = useState('');

  // Seller creation
  const [createOpen, setCreateOpen] = useState(false);
  const [notice, setNotice] = useState('');

  // Selected tenant data
  const [stats, setStats] = useState({ stockValue: 0, salesCount: 0, lowStock: 0 });
  const [sales, setSales] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState('');

  // Load tenants on mount
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const rows = await fetchTenantRows(api);
        if (!cancelled) {
          setTenants(rows);
          setTenantsError('');
        }
      } catch (err) {
        if (!cancelled && err.response?.status !== 401) {
          setTenantsError(
            err.response?.status === 403
              ? 'Only a Super Admin can view tenants.'
              : 'Failed to load tenants'
          );
        }
      } finally {
        if (!cancelled) setTenantsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [api]);

  const handleSelectTenant = (tenant) => {
    setDataLoading(true);
    setDataError('');
    setSelectedTenant(tenant);
  };

  const handleSellerCreated = async (created) => {
    setCreateOpen(false);
    setNotice(`Seller "${created.username}" created for "${created.tenant_name}".`);

    setTenantsLoading(true);
    try {
      const rows = await fetchTenantRows(api);
      setTenants(rows);
      setTenantsError('');
      const match = created.tenant ? rows.find((t) => t.id === created.tenant) : null;
      if (match) handleSelectTenant(match);
    } catch (err) {
      if (err.response?.status !== 401) {
        setTenantsError(
          err.response?.status === 403
            ? 'Only a Super Admin can view tenants.'
            : 'Failed to load tenants'
        );
      }
    } finally {
      setTenantsLoading(false);
    }
  };

  // Fetch data when tenant is selected
  useEffect(() => {
    if (!selectedTenant) return;
    let cancelled = false;

    (async () => {
      try {
        const data = await loadTenantData(api, selectedTenant.id);
        if (!cancelled) {
          setStats(data.stats);
          setSales(data.sales);
          setDataError('');
        }
      } catch {
        if (!cancelled) setDataError('Failed to load tenant data');
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedTenant, api]);

  const filteredTenants = searchTenant
    ? tenants.filter((t) => {
        const q = searchTenant.toLowerCase();
        return (t.name || '').toLowerCase().includes(q)
          || (t.owner_username || '').toLowerCase().includes(q);
      })
    : tenants;

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">Create sellers and inspect their dashboards</p>
        </div>
        <button
          id="create-seller-btn"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white text-sm font-semibold rounded-lg shadow-md shadow-violet-500/25 transition-all cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Create Seller
        </button>
      </div>

      {notice && (
        <div className="mb-4 flex items-center justify-between gap-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-4 py-3 rounded-lg">
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            {notice}
          </span>
          <button
            type="button"
            onClick={() => setNotice('')}
            className="text-emerald-600 hover:text-emerald-800 cursor-pointer"
            aria-label="Dismiss"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* ── Left: Tenant selector ── */}
        <div className="xl:col-span-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
            <div className="px-4 py-3.5 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-900 mb-2.5">Sellers / Tenants</h2>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search sellers..."
                  value={searchTenant}
                  onChange={(e) => setSearchTenant(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 transition-all"
                />
              </div>
            </div>

            <div className="p-3 space-y-2 max-h-[60vh] overflow-y-auto">
              {tenantsLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="p-4 rounded-xl border border-slate-200 animate-pulse">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-100" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-slate-100 rounded w-3/4" />
                        <div className="h-3 bg-slate-100 rounded w-1/2" />
                      </div>
                    </div>
                  </div>
                ))
              ) : tenantsError ? (
                <div className="text-sm text-red-600 px-2 py-4">{tenantsError}</div>
              ) : filteredTenants.length === 0 ? (
                <div className="text-sm text-slate-400 px-2 py-4 text-center">No tenants found</div>
              ) : (
                filteredTenants.map((t) => (
                  <TenantCard key={t.id} tenant={t} selected={selectedTenant} onSelect={handleSelectTenant} />
                ))
              )}
            </div>

            {!tenantsLoading && tenants.length > 0 && (
              <div className="px-4 py-2.5 border-t border-slate-100 text-xs text-slate-400">
                {tenants.length} seller{tenants.length !== 1 ? 's' : ''} total
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Selected tenant dashboard ── */}
        <div className="xl:col-span-8">
          {!selectedTenant ? (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex items-center justify-center py-24">
              <div className="text-center">
                <div className="w-16 h-16 bg-violet-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-violet-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.4} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
                  </svg>
                </div>
                <p className="text-slate-600 font-medium">Select a seller to view dashboard</p>
                <p className="text-sm text-slate-400 mt-1">Click on a tenant from the list</p>
              </div>
            </div>
          ) : (
            <div>
              {/* Tenant header */}
              <div className="bg-gradient-to-r from-violet-600 to-purple-600 rounded-xl p-5 mb-5 text-white shadow-lg shadow-violet-200">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-lg font-bold backdrop-blur-sm">
                    {(selectedTenant.name || 'T').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">{selectedTenant.name}</h2>
                    <p className="text-sm text-violet-200">
                      {selectedTenant.owner_username
                        ? `@${selectedTenant.owner_username}`
                        : `Tenant #${selectedTenant.id}`}
                    </p>
                  </div>
                </div>
              </div>

              {dataError && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{dataError}</div>
              )}

              {/* Stat cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
                {[
                  { title: 'Stock Value', value: fmt(stats.stockValue), color: 'from-blue-500 to-blue-600' },
                  { title: 'Total Sales', value: stats.salesCount, color: 'from-emerald-500 to-emerald-600' },
                  { title: 'Low Stock', value: stats.lowStock, color: 'from-rose-500 to-red-500' },
                ].map((card) => (
                  <div key={card.title} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                    <p className="text-xs font-medium text-slate-500 mb-1">{card.title}</p>
                    {dataLoading ? (
                      <div className="h-7 w-20 bg-slate-100 rounded animate-pulse" />
                    ) : (
                      <p className="text-xl font-bold text-slate-900">{card.value}</p>
                    )}
                  </div>
                ))}
              </div>

              {/* Recent sales */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-100">
                  <h3 className="text-sm font-semibold text-slate-900">Recent Sales</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        <th className="px-4 py-2.5">Invoice #</th>
                        <th className="px-4 py-2.5">Customer</th>
                        <th className="px-4 py-2.5">Date</th>
                        <th className="px-4 py-2.5 text-right">Total</th>
                        <th className="px-4 py-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {dataLoading ? (
                        Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} cols={5} />)
                      ) : sales.length === 0 ? (
                        <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No sales data</td></tr>
                      ) : (
                        sales.map((s) => (
                          <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3 font-medium text-slate-900">{s.invoice_number || `#${s.id}`}</td>
                            <td className="px-4 py-3 text-slate-600">{s.retailer_name || s.retailer?.name || '—'}</td>
                            <td className="px-4 py-3 text-slate-500">{fmtDate(s.date || s.created_at)}</td>
                            <td className="px-4 py-3 text-right font-medium text-slate-900">{fmt(s.total_amount || s.total)}</td>
                            <td className="px-4 py-3"><StatusBadge status={s.payment_status || s.status} /></td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {createOpen && (
        <CreateSellerModal
          api={api}
          onClose={() => setCreateOpen(false)}
          onCreated={handleSellerCreated}
        />
      )}
    </div>
  );
}
