import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAxios } from '../hooks/useAxios';
import { API_ENDPOINTS } from '../config/api';

// ── Stat Card ──
function StatCard({ title, value, icon, color, loading }) {
  const colors = {
    blue: 'from-blue-500 to-blue-600',
    amber: 'from-amber-500 to-orange-500',
    red: 'from-rose-500 to-red-500',
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
          {loading ? (
            <div className="h-8 w-24 bg-slate-100 rounded animate-pulse" />
          ) : (
            <p className="text-2xl font-bold text-slate-900 truncate">{value}</p>
          )}
        </div>
        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${colors[color]} flex items-center justify-center shrink-0 ml-3`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

// ── Loading skeleton row ──
function SkeletonRow({ cols }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-slate-100 rounded animate-pulse" />
        </td>
      ))}
    </tr>
  );
}

// ── Format currency ──
const fmt = (val) => {
  const num = parseFloat(val);
  if (isNaN(num)) return '₹0.00';
  return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// ── Format date ──
const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

// ── Status badge ──
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

// ════════════════════════════════════════════
export default function Dashboard() {
  const api = useAxios();
  const navigate = useNavigate();

  const [stats, setStats] = useState({ stockValue: null, pendingInvoices: null, lowStock: null });
  const [sales, setSales] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState({ stats: true, sales: true, purchases: true });
  const [errors, setErrors] = useState({ stats: '', sales: '', purchases: '' });

  useEffect(() => {
    fetchStats();
    fetchSales();
    fetchPurchases();
  }, []);

  // ── Fetch stat cards ──
  async function fetchStats() {
    try {
      const [valRes, lowRes, salesRes] = await Promise.allSettled([
        api.get(API_ENDPOINTS.REPORTS_STOCK_VALUATION),
        api.get(API_ENDPOINTS.REPORTS_LOW_STOCK),
        api.get(API_ENDPOINTS.SALES_LIST, { params: { status: 'pending' } }),
      ]);

      const stockValue =
        valRes.status === 'fulfilled'
          ? valRes.value.data?.total_value ?? valRes.value.data?.results?.[0]?.total_value ?? 0
          : 0;

      const lowCount =
        lowRes.status === 'fulfilled'
          ? lowRes.value.data?.count ?? (Array.isArray(lowRes.value.data) ? lowRes.value.data.length : lowRes.value.data?.results?.length ?? 0)
          : 0;

      const pendingCount =
        salesRes.status === 'fulfilled'
          ? salesRes.value.data?.count ?? (Array.isArray(salesRes.value.data) ? salesRes.value.data.length : salesRes.value.data?.results?.length ?? 0)
          : 0;

      setStats({ stockValue, pendingInvoices: pendingCount, lowStock: lowCount });
    } catch {
      setErrors((e) => ({ ...e, stats: 'Failed to load stats' }));
    } finally {
      setLoading((l) => ({ ...l, stats: false }));
    }
  }

  // ── Fetch recent sales ──
  async function fetchSales() {
    try {
      const res = await api.get(API_ENDPOINTS.SALES_LIST, { params: { limit: 5 } });
      const data = Array.isArray(res.data) ? res.data : res.data?.results ?? [];
      setSales(data.slice(0, 5));
    } catch {
      setErrors((e) => ({ ...e, sales: 'Failed to load recent sales' }));
    } finally {
      setLoading((l) => ({ ...l, sales: false }));
    }
  }

  // ── Fetch recent purchases ──
  async function fetchPurchases() {
    try {
      const res = await api.get(API_ENDPOINTS.PURCHASES_LIST, { params: { limit: 5 } });
      const data = Array.isArray(res.data) ? res.data : res.data?.results ?? [];
      setPurchases(data.slice(0, 5));
    } catch {
      setErrors((e) => ({ ...e, purchases: 'Failed to load recent purchases' }));
    } finally {
      setLoading((l) => ({ ...l, purchases: false }));
    }
  }

  return (
    <div>
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">Overview of your business</p>
      </div>

      {/* Error banner */}
      {errors.stats && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{errors.stats}</div>
      )}

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <StatCard
          title="Total Stock Value"
          value={fmt(stats.stockValue)}
          color="blue"
          loading={loading.stats}
          icon={<svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375" /></svg>}
        />
        <StatCard
          title="Pending Invoices"
          value={stats.pendingInvoices ?? 0}
          color="amber"
          loading={loading.stats}
          icon={<svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <StatCard
          title="Low Stock Items"
          value={stats.lowStock ?? 0}
          color="red"
          loading={loading.stats}
          icon={<svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>}
        />
      </div>

      {/* ── Tables grid ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Recent Sales */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Recent Sales</h2>
            <button onClick={() => navigate('/sales')} className="text-xs font-medium text-blue-600 hover:text-blue-700 cursor-pointer">
              View all →
            </button>
          </div>
          {errors.sales ? (
            <div className="px-5 py-4 text-sm text-red-600">{errors.sales}</div>
          ) : (
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
                  {loading.sales ? (
                    Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} cols={5} />)
                  ) : sales.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No sales found</td></tr>
                  ) : (
                    sales.map((s) => (
                      <tr
                        key={s.id}
                        onClick={() => navigate(`/sales/${s.id}`)}
                        className="hover:bg-slate-50 cursor-pointer transition-colors"
                      >
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
          )}
        </div>

        {/* Recent Purchases */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Recent Purchases</h2>
            <button onClick={() => navigate('/inventory/purchases')} className="text-xs font-medium text-blue-600 hover:text-blue-700 cursor-pointer">
              View all →
            </button>
          </div>
          {errors.purchases ? (
            <div className="px-5 py-4 text-sm text-red-600">{errors.purchases}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    <th className="px-4 py-2.5">PO #</th>
                    <th className="px-4 py-2.5">Supplier</th>
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-4 py-2.5 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading.purchases ? (
                    Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} cols={4} />)
                  ) : purchases.length === 0 ? (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">No purchases found</td></tr>
                  ) : (
                    purchases.map((p) => (
                      <tr
                        key={p.id}
                        onClick={() => navigate(`/inventory/purchases/${p.id}`)}
                        className="hover:bg-slate-50 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3 font-medium text-slate-900">{p.po_number || `PO-${p.id}`}</td>
                        <td className="px-4 py-3 text-slate-600">{p.supplier_name || p.supplier?.name || '—'}</td>
                        <td className="px-4 py-3 text-slate-500">{fmtDate(p.date || p.created_at)}</td>
                        <td className="px-4 py-3 text-right font-medium text-slate-900">{fmt(p.total_amount || p.total)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
