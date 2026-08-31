import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAxios } from '../../hooks/useAxios';
import { API_ENDPOINTS } from '../../config/api';

const fmt = (val) => {
  const num = parseFloat(val);
  if (isNaN(num)) return '₹0.00';
  return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {[...Array(6)].map((_, i) => (
        <td key={i} className="px-4 py-3.5">
          <div className={`h-4 bg-slate-100 rounded ${i === 0 ? 'w-24' : 'w-full'}`} />
        </td>
      ))}
    </tr>
  );
}

// ════════════════════════════════════════
export default function PaymentList() {
  const api = useAxios();
  const navigate = useNavigate();

  const [payments, setPayments] = useState([]);
  const [retailers, setRetailers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [retailerFilter, setRetailerFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');

  // Pagination
  const limit = 20;
  const [offset, setOffset] = useState(0);
  const totalPages = Math.ceil(totalCount / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  // Fetch retailers for filter dropdown
  useEffect(() => {
    api.get(API_ENDPOINTS.RETAILERS_LIST, { params: { limit: 200 } }).then((r) => {
      const data = Array.isArray(r.data) ? r.data : r.data?.results ?? [];
      setRetailers(data);
    }).catch(() => {});
  }, []);

  // Fetch payments
  const fetchPayments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { limit, offset };
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      if (retailerFilter) params.retailer = retailerFilter;
      if (methodFilter) params.payment_method = methodFilter;

      const res = await api.get(API_ENDPOINTS.PAYMENTS_LIST, { params });

      if (Array.isArray(res.data)) {
        setPayments(res.data);
        setTotalCount(res.data.length);
      } else {
        setPayments(res.data?.results ?? []);
        setTotalCount(res.data?.count ?? 0);
      }
    } catch (err) {
      if (err.response?.status !== 401) {
        setError(err.response?.data?.detail || 'Failed to load payments');
      }
    } finally {
      setLoading(false);
    }
  }, [api, offset, dateFrom, dateTo, retailerFilter, methodFilter]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const applyFilters = () => setOffset(0);

  // Sum of visible payments
  const visibleTotal = payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Payments</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {totalCount} payment{totalCount !== 1 ? 's' : ''} recorded
          </p>
        </div>
        <button
          id="record-payment-btn"
          onClick={() => navigate('/payments/create')}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white text-sm font-semibold rounded-lg shadow-md shadow-emerald-500/25 transition-all cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Record Payment
        </button>
      </div>

      {/* Summary card */}
      {!loading && payments.length > 0 && (
        <div className="bg-gradient-to-r from-emerald-500 to-green-600 rounded-xl p-5 mb-5 text-white shadow-lg shadow-emerald-200">
          <p className="text-sm text-emerald-100 font-medium">Total Received (this page)</p>
          <p className="text-3xl font-bold mt-1">{fmt(visibleTotal)}</p>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-5 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Retailer */}
          <select
            id="payment-retailer-filter"
            value={retailerFilter}
            onChange={(e) => { setRetailerFilter(e.target.value); applyFilters(); }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all cursor-pointer"
          >
            <option value="">All Customers</option>
            {retailers.map((r) => (
              <option key={r.id} value={r.id}>
                {r.shop_name || r.name}
              </option>
            ))}
          </select>

          {/* Payment method */}
          <select
            id="payment-method-filter"
            value={methodFilter}
            onChange={(e) => { setMethodFilter(e.target.value); applyFilters(); }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all cursor-pointer"
          >
            <option value="">All Methods</option>
            <option value="cash">Cash</option>
            <option value="cheque">Cheque</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="upi">UPI</option>
            <option value="other">Other</option>
          </select>

          {/* Date from */}
          <input
            id="payment-date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); applyFilters(); }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all"
            title="From date"
          />

          {/* Date to */}
          <input
            id="payment-date-to"
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); applyFilters(); }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all"
            title="To date"
          />
        </div>

        {/* Active filter chips */}
        {(retailerFilter || methodFilter || dateFrom || dateTo) && (
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className="text-xs text-slate-500">Active filters:</span>
            {retailerFilter && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs rounded-full border border-emerald-200">
                {retailers.find((r) => String(r.id) === retailerFilter)?.shop_name || retailers.find((r) => String(r.id) === retailerFilter)?.name || 'Customer'}
                <button onClick={() => setRetailerFilter('')} className="hover:text-emerald-900 cursor-pointer">×</button>
              </span>
            )}
            {methodFilter && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs rounded-full border border-emerald-200 capitalize">
                {methodFilter.replace(/_/g, ' ')}
                <button onClick={() => setMethodFilter('')} className="hover:text-emerald-900 cursor-pointer">×</button>
              </span>
            )}
            {(dateFrom || dateTo) && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs rounded-full border border-emerald-200">
                {dateFrom || '...'} → {dateTo || '...'}
                <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="hover:text-emerald-900 cursor-pointer">×</button>
              </span>
            )}
            <button
              onClick={() => { setRetailerFilter(''); setMethodFilter(''); setDateFrom(''); setDateTo(''); applyFilters(); }}
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
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Invoice Ref</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.4} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-600">No payments found</p>
                        <p className="text-xs text-slate-400 mt-0.5">Record one to get started</p>
                      </div>
                      <button
                        onClick={() => navigate('/payments/create')}
                        className="mt-1 text-sm font-medium text-emerald-600 hover:text-emerald-700 cursor-pointer"
                      >
                        + Record Payment
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => navigate(`/payments/${p.id}`)}
                    className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
                  >
                    <td className="px-4 py-3.5 text-slate-500">
                      {fmtDate(p.date || p.payment_date || p.created_at)}
                    </td>
                    <td className="px-4 py-3.5 text-slate-700 font-medium">
                      {p.retailer_name || p.retailer?.shop_name || p.retailer?.name || '—'}
                    </td>
                    <td className="px-4 py-3.5">
                      {p.invoice_number || p.sale?.invoice_number ? (
                        <span className="text-blue-600 group-hover:text-blue-700 font-medium">
                          {p.invoice_number || p.sale?.invoice_number}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right font-semibold text-emerald-700">
                      {fmt(p.amount)}
                    </td>
                    <td className="px-4 py-3.5">
                      {p.payment_method ? (
                        <span className="inline-flex items-center px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-medium rounded-full capitalize">
                          {p.payment_method.replace(/_/g, ' ')}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-slate-500 text-xs max-w-[150px] truncate">
                      {p.notes || '—'}
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
