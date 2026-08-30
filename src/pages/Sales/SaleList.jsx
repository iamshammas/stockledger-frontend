import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAxios } from '../../hooks/useAxios';
import { API_ENDPOINTS, API_BASE_URL } from '../../config/api';

// ── Helpers ──
const fmt = (val) => {
  const num = parseFloat(val);
  if (isNaN(num)) return '₹0.00';
  return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

// ── Status Badge ──
function StatusBadge({ status }) {
  const s = (status || '').toLowerCase();
  let cls = 'bg-slate-100 text-slate-600';
  if (s === 'paid' || s === 'completed') cls = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  else if (s === 'partial' || s === 'partially_paid') cls = 'bg-amber-50 text-amber-700 border-amber-200';
  else if (s === 'unpaid' || s === 'pending') cls = 'bg-red-50 text-red-700 border-red-200';
  else if (s === 'overdue') cls = 'bg-rose-50 text-rose-700 border-rose-200';
  else if (s === 'cancelled') cls = 'bg-slate-100 text-slate-500 border-slate-200';

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize ${cls}`}>
      {(status || '—').replace(/_/g, ' ')}
    </span>
  );
}

// ── Skeleton Row ──
function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {[...Array(6)].map((_, i) => (
        <td key={i} className="px-4 py-3.5">
          <div className={`h-4 bg-slate-100 rounded ${i === 0 ? 'w-28' : i === 5 ? 'w-20' : 'w-full'}`} />
        </td>
      ))}
    </tr>
  );
}

// ════════════════════════════════════════
export default function SaleList() {
  const api = useAxios();
  const navigate = useNavigate();

  // State
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Pagination
  const limit = 20;
  const [offset, setOffset] = useState(0);

  const totalPages = Math.ceil(totalCount / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  // Fetch
  const fetchSales = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { limit, offset };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;

      const res = await api.get(API_ENDPOINTS.SALES_LIST, { params });

      if (Array.isArray(res.data)) {
        setSales(res.data);
        setTotalCount(res.data.length);
      } else {
        setSales(res.data?.results ?? []);
        setTotalCount(res.data?.count ?? 0);
      }
    } catch (err) {
      if (err.response?.status !== 401) {
        setError(err.response?.data?.detail || 'Failed to load sales');
      }
    } finally {
      setLoading(false);
    }
  }, [api, offset, search, statusFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  // Reset to page 1 when filters change
  const applyFilters = () => setOffset(0);

  // PDF download
  const handleDownloadPdf = async (e, saleId) => {
    e.stopPropagation();
    try {
      const res = await api.get(API_ENDPOINTS.SALE_PDF(saleId), { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${saleId}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      alert('Failed to download PDF');
    }
  };

  return (
    <div>
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sales</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {totalCount} invoice{totalCount !== 1 ? 's' : ''} total
          </p>
        </div>
        <button
          id="create-invoice-btn"
          onClick={() => navigate('/sales/create')}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-semibold rounded-lg shadow-md shadow-blue-500/25 transition-all cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Create Invoice
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-5 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search */}
          <div className="lg:col-span-2">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                id="sale-search"
                type="text"
                placeholder="Search invoice # or customer..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); applyFilters(); }}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 focus:bg-white transition-all"
              />
            </div>
          </div>

          {/* Status filter */}
          <select
            id="sale-status-filter"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); applyFilters(); }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="unpaid">Unpaid</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
          </select>

          {/* Date from */}
          <input
            id="sale-date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); applyFilters(); }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all"
            title="From date"
          />

          {/* Date to */}
          <input
            id="sale-date-to"
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); applyFilters(); }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all"
            title="To date"
          />
        </div>

        {/* Active filter chips */}
        {(search || statusFilter || dateFrom || dateTo) && (
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className="text-xs text-slate-500">Active filters:</span>
            {search && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-200">
                "{search}"
                <button onClick={() => setSearch('')} className="hover:text-blue-900 cursor-pointer">×</button>
              </span>
            )}
            {statusFilter && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-200 capitalize">
                {statusFilter}
                <button onClick={() => setStatusFilter('')} className="hover:text-blue-900 cursor-pointer">×</button>
              </span>
            )}
            {(dateFrom || dateTo) && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-200">
                {dateFrom || '...'} → {dateTo || '...'}
                <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="hover:text-blue-900 cursor-pointer">×</button>
              </span>
            )}
            <button
              onClick={() => { setSearch(''); setStatusFilter(''); setDateFrom(''); setDateTo(''); applyFilters(); }}
              className="text-xs text-slate-500 hover:text-slate-700 underline cursor-pointer"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                <th className="px-4 py-3">Invoice #</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.4} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-600">No invoices found</p>
                        <p className="text-xs text-slate-400 mt-0.5">Create one to get started</p>
                      </div>
                      <button
                        onClick={() => navigate('/sales/create')}
                        className="mt-1 text-sm font-medium text-blue-600 hover:text-blue-700 cursor-pointer"
                      >
                        + Create Invoice
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                sales.map((sale) => (
                  <tr
                    key={sale.id}
                    onClick={() => navigate(`/sales/${sale.id}`)}
                    className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
                  >
                    <td className="px-4 py-3.5 font-medium text-blue-600 group-hover:text-blue-700">
                      {sale.invoice_number || `#${sale.id}`}
                    </td>
                    <td className="px-4 py-3.5 text-slate-700">
                      {sale.retailer_name || sale.retailer?.name || '—'}
                    </td>
                    <td className="px-4 py-3.5 text-slate-500">
                      {fmtDate(sale.date || sale.created_at)}
                    </td>
                    <td className="px-4 py-3.5 text-right font-semibold text-slate-900">
                      {fmt(sale.total_amount || sale.total)}
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={sale.payment_status || sale.status} />
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/sales/${sale.id}`); }}
                          className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                          title="View"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.64 0 8.577 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.64 0-8.577-3.007-9.963-7.178z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => handleDownloadPdf(e, sale.id)}
                          className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer"
                          title="Download PDF"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && totalCount > limit && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50">
            <p className="text-xs text-slate-500">
              Showing {offset + 1}–{Math.min(offset + limit, totalCount)} of {totalCount}
            </p>
            <div className="flex items-center gap-2">
              <button
                id="sale-prev-page"
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0}
                className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                ← Previous
              </button>
              <span className="text-xs text-slate-600 font-medium">
                Page {currentPage} of {totalPages}
              </span>
              <button
                id="sale-next-page"
                onClick={() => setOffset(offset + limit)}
                disabled={offset + limit >= totalCount}
                className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
