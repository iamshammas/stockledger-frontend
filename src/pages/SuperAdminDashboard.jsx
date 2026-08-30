import { useState, useEffect } from 'react';
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
          {(tenant.business_name || tenant.name || 'T').charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-semibold truncate ${isActive ? 'text-violet-900' : 'text-slate-900'}`}>
            {tenant.business_name || tenant.name || `Tenant #${tenant.id}`}
          </p>
          <p className="text-xs text-slate-500 truncate">
            {tenant.owner_email || tenant.email || `ID: ${tenant.id}`}
          </p>
        </div>
        {isActive && (
          <svg className="w-5 h-5 text-violet-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
          </svg>
        )}
      </div>
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

// ════════════════════════════════════════
export default function SuperAdminDashboard() {
  const api = useAxios();

  // Tenants
  const [tenants, setTenants] = useState([]);
  const [tenantsLoading, setTenantsLoading] = useState(true);
  const [tenantsError, setTenantsError] = useState('');
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [searchTenant, setSearchTenant] = useState('');

  // Selected tenant data
  const [stats, setStats] = useState({ stockValue: 0, salesCount: 0, lowStock: 0 });
  const [sales, setSales] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState('');

  // Fetch tenants on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(API_ENDPOINTS.TENANTS_LIST);
        const data = Array.isArray(res.data) ? res.data : res.data?.results ?? [];
        setTenants(data);
      } catch {
        setTenantsError('Failed to load tenants');
      } finally {
        setTenantsLoading(false);
      }
    })();
  }, []);

  // Fetch data when tenant is selected
  useEffect(() => {
    if (!selectedTenant) return;
    fetchTenantData(selectedTenant.id);
  }, [selectedTenant]);

  async function fetchTenantData(tenantId) {
    setDataLoading(true);
    setDataError('');
    try {
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

      setStats({ stockValue, salesCount, lowStock: lowCount });
      setSales(salesData.slice(0, 5));
    } catch {
      setDataError('Failed to load tenant data');
    } finally {
      setDataLoading(false);
    }
  }

  const filteredTenants = searchTenant
    ? tenants.filter((t) => {
        const q = searchTenant.toLowerCase();
        return (t.business_name || t.name || '').toLowerCase().includes(q)
          || (t.owner_email || t.email || '').toLowerCase().includes(q);
      })
    : tenants;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">Select a seller to view their dashboard</p>
      </div>

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
                  <TenantCard key={t.id} tenant={t} selected={selectedTenant} onSelect={setSelectedTenant} />
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
                    {(selectedTenant.business_name || selectedTenant.name || 'T').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">{selectedTenant.business_name || selectedTenant.name}</h2>
                    <p className="text-sm text-violet-200">{selectedTenant.owner_email || selectedTenant.email || `Tenant #${selectedTenant.id}`}</p>
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
    </div>
  );
}
