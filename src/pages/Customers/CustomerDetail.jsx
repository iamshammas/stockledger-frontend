import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAxios } from '../../hooks/useAxios';
import { API_ENDPOINTS } from '../../config/api';

// Backend page size (DRF PAGE_SIZE = 10). Used to walk paginated lists.
const PAGE_SIZE = 10;

const fmt = (val) => {
  const num = parseFloat(val);
  if (isNaN(num)) return '₹0.00';
  return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const num = (val) => {
  const n = parseFloat(val);
  return Number.isFinite(n) ? n : 0;
};

// Fetches every row of a list endpoint by walking DRF's ?page= param.
// Never follows `next` because it points at the backend host.
async function fetchAll(api, endpoint) {
  const first = await api.get(endpoint, { params: { page: 1 } });

  if (Array.isArray(first.data)) return first.data;

  const results = first.data?.results ?? [];
  const count = first.data?.count ?? results.length;
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  if (totalPages === 1) return results;

  const rest = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, i) =>
      api.get(endpoint, { params: { page: i + 2 } })
    )
  );

  return [...results, ...rest.flatMap((r) => r.data?.results ?? [])];
}

function StatusBadge({ status }) {
  const s = (status || '').toLowerCase();
  let cls = 'bg-slate-100 text-slate-600 border-slate-200';
  if (s === 'paid') cls = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  else if (s === 'partial') cls = 'bg-amber-50 text-amber-700 border-amber-200';
  else if (s === 'unpaid') cls = 'bg-red-50 text-red-700 border-red-200';

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize ${cls}`}>
      {(status || '—').replace(/_/g, ' ')}
    </span>
  );
}

function SectionCard({ title, action, children }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between gap-3">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

function EmptyState({ icon, title, hint }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center text-slate-300">
        {icon}
      </div>
      <p className="text-sm font-medium text-slate-600">{title}</p>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-9 w-72 bg-slate-100 rounded mb-6" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="h-56 bg-white border border-slate-200 rounded-xl shadow-sm" />
          <div className="h-64 bg-white border border-slate-200 rounded-xl shadow-sm" />
        </div>
        <div className="space-y-6">
          <div className="h-52 bg-white border border-slate-200 rounded-xl shadow-sm" />
          <div className="h-56 bg-white border border-slate-200 rounded-xl shadow-sm" />
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════
export default function CustomerDetail() {
  const { id } = useParams();
  const api = useAxios();
  const navigate = useNavigate();

  const [customer, setCustomer] = useState(null);
  const [sales, setSales] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [historyError, setHistoryError] = useState('');

  const fetchData = useCallback(async () => {
    const [customerRes, salesRes, paymentsRes] = await Promise.allSettled([
      api.get(API_ENDPOINTS.RETAILER_DETAIL(id)),
      fetchAll(api, API_ENDPOINTS.SALES_LIST),
      fetchAll(api, API_ENDPOINTS.PAYMENTS_LIST),
    ]);

    // Reset status flags only after the request settles, so the effect does
    // not trigger a synchronous state update on mount.
    setError('');
    setNotFound(false);
    setHistoryError('');

    if (customerRes.status === 'rejected') {
      const status = customerRes.reason?.response?.status;
      if (status === 401) return; // interceptor logs the user out
      if (status === 404) setNotFound(true);
      else setError(customerRes.reason?.response?.data?.detail || 'Failed to load customer');
      setLoading(false);
      return;
    }

    setCustomer(customerRes.value.data);

    // Client-side joins: the API has no ?retailer= filter on sales/payments.
    const allSales = salesRes.status === 'fulfilled' ? salesRes.value : [];
    const allPayments = paymentsRes.status === 'fulfilled' ? paymentsRes.value : [];

    const customerSales = allSales
      .filter((s) => String(s.retailer) === String(id))
      .sort((a, b) => String(b.invoice_date).localeCompare(String(a.invoice_date)));

    const saleIds = new Set(customerSales.map((s) => s.id));

    const customerPayments = allPayments
      .filter((p) => saleIds.has(p.sale))
      .sort((a, b) => String(b.payment_date).localeCompare(String(a.payment_date)));

    setSales(customerSales);
    setPayments(customerPayments);

    if (salesRes.status === 'rejected' || paymentsRes.status === 'rejected') {
      setHistoryError('Some history could not be loaded. Try refreshing.');
    }

    setLoading(false);
  }, [api, id]);

  useEffect(() => {
    // Deferred so the initial fetch does not cascade a synchronous render.
    const timer = setTimeout(() => {
      fetchData();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchData]);

  const handleRetry = () => {
    setError('');
    setNotFound(false);
    setHistoryError('');
    setLoading(true);
    fetchData();
  };

  if (loading) return <DetailSkeleton />;

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

  if (error) {
    return (
      <div className="max-w-lg mx-auto mt-16">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-8 text-center">
          <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-slate-900">Could not load customer</h1>
          <p className="text-sm text-slate-500 mt-1">{error}</p>
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

  const displayName = customer.shop_name || customer.retailer_name || 'Customer';
  const initial = displayName.charAt(0).toUpperCase();

  const totals = sales.reduce(
    (acc, s) => ({
      billed: acc.billed + num(s.total_amount),
      paid: acc.paid + num(s.amount_paid),
      due: acc.due + num(s.amount_due),
    }),
    { billed: 0, paid: 0, due: 0 }
  );
  const credit = num(customer.credit_balance);
  const recentSales = sales.slice(0, 10);
  const recentPayments = payments.slice(0, 5);

  const contactRows = [
    { label: 'Retailer Name', value: customer.retailer_name || '—' },
    { label: 'Shop / Business', value: customer.shop_name || '—' },
    {
      label: 'Phone',
      value: customer.phone ? (
        <a href={`tel:${customer.phone}`} className="text-blue-600 hover:text-blue-700 hover:underline">
          {customer.phone}
        </a>
      ) : (
        '—'
      ),
    },
    {
      label: 'Email',
      value: customer.email ? (
        <a href={`mailto:${customer.email}`} className="text-blue-600 hover:text-blue-700 hover:underline break-all">
          {customer.email}
        </a>
      ) : (
        '—'
      ),
    },
  ];

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div className="flex items-start gap-3">
          <button
            onClick={() => navigate('/customers')}
            className="mt-1 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title="Back to customers"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-orange-50 rounded-full flex items-center justify-center text-orange-600 font-bold text-lg shrink-0">
              {initial}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-slate-900">{displayName}</h1>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                    customer.is_active
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-slate-100 text-slate-500 border-slate-200'
                  }`}
                >
                  {customer.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-0.5">
                {customer.retailer_name}
                {customer.phone ? ` · ${customer.phone}` : ''}
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => navigate(`/customers/${id}/edit`)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium border border-slate-200 rounded-lg text-slate-700 bg-white hover:bg-slate-50 transition-colors cursor-pointer self-start"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
          </svg>
          Edit
        </button>
      </div>

      {historyError && (
        <div className="mb-4 flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-3 rounded-lg">
          <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          {historyError}
        </div>
      )}

      {/* ── Two-column layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* LEFT — profile + invoices */}
        <div className="lg:col-span-2 space-y-6">
          <SectionCard title="Contact Information">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 px-5 py-4">
              {contactRows.map((row) => (
                <div key={row.label}>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{row.label}</p>
                  <p className="text-sm text-slate-900 mt-0.5">{row.value}</p>
                </div>
              ))}
              <div className="sm:col-span-2">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Address</p>
                <p className="text-sm text-slate-900 mt-0.5 whitespace-pre-line">
                  {customer.address || '—'}
                </p>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Recent Invoices"
            action={
              sales.length > 0 ? (
                <span className="text-xs text-slate-400">
                  Showing {recentSales.length} of {sales.length}
                </span>
              ) : null
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    <th className="px-4 py-2.5">Invoice #</th>
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-4 py-2.5 text-right">Amount</th>
                    <th className="px-4 py-2.5 text-right">Due</th>
                    <th className="px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentSales.length === 0 ? (
                    <tr>
                      <td colSpan={5}>
                        <EmptyState
                          title="No invoices yet"
                          hint="Invoices raised for this customer will appear here"
                          icon={
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                            </svg>
                          }
                        />
                      </td>
                    </tr>
                  ) : (
                    recentSales.map((s) => (
                      <tr
                        key={s.id}
                        onClick={() => navigate(`/sales/${s.id}`)}
                        className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3 font-medium text-slate-900">{s.invoice_number || `#${s.id}`}</td>
                        <td className="px-4 py-3 text-slate-600">{fmtDate(s.invoice_date)}</td>
                        <td className="px-4 py-3 text-right text-slate-900">{fmt(s.total_amount)}</td>
                        <td className={`px-4 py-3 text-right ${num(s.amount_due) > 0 ? 'text-red-600 font-medium' : 'text-slate-400'}`}>
                          {fmt(s.amount_due)}
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>

        {/* RIGHT — balance + payments */}
        <div className="space-y-6">
          <SectionCard title="Balance">
            <div className="px-5 py-4">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Outstanding Due</p>
              <p className={`text-2xl font-bold mt-0.5 ${totals.due > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {fmt(totals.due)}
              </p>

              <div className="mt-4 space-y-2.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Total billed</span>
                  <span className="font-medium text-slate-900">{fmt(totals.billed)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Total paid</span>
                  <span className="font-medium text-emerald-700">{fmt(totals.paid)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Invoices</span>
                  <span className="font-medium text-slate-900">{sales.length}</span>
                </div>
              </div>

              {credit > 0 && (
                <div className="mt-4 flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                  <span className="text-xs font-medium text-emerald-700">Credit balance</span>
                  <span className="text-sm font-semibold text-emerald-700">{fmt(credit)}</span>
                </div>
              )}
            </div>
          </SectionCard>

          <SectionCard
            title="Recent Payments"
            action={
              payments.length > 0 ? (
                <span className="text-xs text-slate-400">
                  Showing {recentPayments.length} of {payments.length}
                </span>
              ) : null
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-4 py-2.5">Invoice #</th>
                    <th className="px-4 py-2.5 text-right">Amount</th>
                    <th className="px-4 py-2.5">Method</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentPayments.length === 0 ? (
                    <tr>
                      <td colSpan={4}>
                        <EmptyState
                          title="No payments yet"
                          hint="Payments recorded against this customer's invoices will appear here"
                          icon={
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                            </svg>
                          }
                        />
                      </td>
                    </tr>
                  ) : (
                    recentPayments.map((p) => (
                      <tr
                        key={p.id}
                        onClick={() => navigate(`/payments/${p.id}`)}
                        className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3 text-slate-600">
                          <div>{fmtDate(p.payment_date)}</div>
                          {p.note && (
                            <div className="text-[11px] text-slate-400 truncate max-w-[140px]" title={p.note}>
                              {p.note}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-700">{p.invoice_number || '—'}</td>
                        <td className="px-4 py-3 text-right font-medium text-emerald-700">{fmt(p.amount)}</td>
                        <td className="px-4 py-3 text-slate-600 capitalize">{p.payment_method || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
