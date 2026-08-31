import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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

export default function PaymentDetail() {
  const { id } = useParams();
  const api = useAxios();
  const navigate = useNavigate();

  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(API_ENDPOINTS.PAYMENT_DETAIL(id));
        setPayment(res.data);
      } catch (err) {
        setError(err.response?.status === 404 ? 'Payment not found' : 'Failed to load payment');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // Loading
  if (loading) {
    return (
      <div className="max-w-2xl animate-pulse space-y-5">
        <div className="h-7 w-48 bg-slate-200 rounded" />
        <div className="h-28 bg-emerald-100 rounded-xl" />
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-5 bg-slate-100 rounded w-full" />)}
        </div>
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="text-center py-16">
        <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.4} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <p className="text-slate-700 font-medium">{error}</p>
        <button onClick={() => navigate('/payments')} className="mt-3 text-sm text-emerald-600 hover:text-emerald-700 font-medium cursor-pointer">
          ← Back to Payments
        </button>
      </div>
    );
  }

  if (!payment) return null;

  const customer = payment.retailer || {};
  const customerName = customer.shop_name || customer.name || payment.retailer_name || '—';
  const invoiceRef = payment.invoice_number || payment.sale?.invoice_number || null;
  const saleId = payment.sale?.id || payment.sale || null;

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/payments')} className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer" title="Back">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Payment #{payment.id}</h1>
          <p className="text-sm text-slate-500">Recorded {fmtDate(payment.created_at)}</p>
        </div>
      </div>

      {/* Amount card */}
      <div className="bg-gradient-to-r from-emerald-500 to-green-600 rounded-xl p-6 mb-5 text-white shadow-lg shadow-emerald-200">
        <p className="text-sm text-emerald-100 font-medium">Amount Received</p>
        <p className="text-4xl font-bold mt-1">{fmt(payment.amount)}</p>
        {payment.payment_method && (
          <span className="inline-flex items-center mt-3 px-2.5 py-0.5 bg-white/20 text-white text-xs font-medium rounded-full capitalize backdrop-blur-sm">
            {payment.payment_method.replace(/_/g, ' ')}
          </span>
        )}
      </div>

      {/* Details card */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Payment Details</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {/* Customer */}
          <div className="px-5 py-3.5 flex items-center justify-between">
            <span className="text-sm text-slate-500">Customer</span>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 font-bold text-xs">
                {customerName.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm font-medium text-slate-900">{customerName}</span>
            </div>
          </div>

          {/* Date */}
          <div className="px-5 py-3.5 flex items-center justify-between">
            <span className="text-sm text-slate-500">Payment Date</span>
            <span className="text-sm font-medium text-slate-900">
              {fmtDate(payment.payment_date || payment.date || payment.created_at)}
            </span>
          </div>

          {/* Method */}
          <div className="px-5 py-3.5 flex items-center justify-between">
            <span className="text-sm text-slate-500">Method</span>
            <span className="text-sm font-medium text-slate-900 capitalize">
              {(payment.payment_method || '—').replace(/_/g, ' ')}
            </span>
          </div>

          {/* Invoice reference */}
          <div className="px-5 py-3.5 flex items-center justify-between">
            <span className="text-sm text-slate-500">Invoice</span>
            {invoiceRef && saleId ? (
              <button
                onClick={() => navigate(`/sales/${saleId}`)}
                className="text-sm font-medium text-blue-600 hover:text-blue-700 cursor-pointer"
              >
                {invoiceRef} →
              </button>
            ) : saleId ? (
              <button
                onClick={() => navigate(`/sales/${saleId}`)}
                className="text-sm font-medium text-blue-600 hover:text-blue-700 cursor-pointer"
              >
                View Invoice →
              </button>
            ) : (
              <span className="text-sm text-slate-400">—</span>
            )}
          </div>

          {/* Notes */}
          {payment.notes && (
            <div className="px-5 py-3.5">
              <p className="text-sm text-slate-500 mb-1">Notes</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{payment.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
