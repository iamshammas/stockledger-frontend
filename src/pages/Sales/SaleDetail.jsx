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

function StatusBadge({ status, large }) {
  const s = (status || '').toLowerCase();
  let cls = 'bg-slate-100 text-slate-600 border-slate-200';
  if (s === 'paid' || s === 'completed') cls = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  else if (s === 'partial' || s === 'partially_paid') cls = 'bg-amber-50 text-amber-700 border-amber-200';
  else if (s === 'unpaid' || s === 'pending') cls = 'bg-red-50 text-red-700 border-red-200';
  else if (s === 'overdue') cls = 'bg-rose-50 text-rose-700 border-rose-200';

  return (
    <span className={`inline-flex items-center rounded-full border font-medium capitalize ${cls} ${large ? 'px-3 py-1 text-sm' : 'px-2.5 py-0.5 text-xs'}`}>
      {(status || '—').replace(/_/g, ' ')}
    </span>
  );
}

// ════════════════════════════════════════
export default function SaleDetail() {
  const { id } = useParams();
  const api = useAxios();
  const navigate = useNavigate();

  const [sale, setSale] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    fetchData();
  }, [id]);

  async function fetchData() {
    setLoading(true);
    setError('');
    try {
      const [saleRes, payRes] = await Promise.allSettled([
        api.get(API_ENDPOINTS.SALE_DETAIL(id)),
        api.get(API_ENDPOINTS.SALE_PAYMENTS(id)),
      ]);

      if (saleRes.status === 'fulfilled') {
        setSale(saleRes.value.data);
      } else {
        setError(saleRes.reason?.response?.status === 404 ? 'Invoice not found' : 'Failed to load invoice');
      }

      if (payRes.status === 'fulfilled') {
        const data = Array.isArray(payRes.value.data) ? payRes.value.data : payRes.value.data?.results ?? [];
        setPayments(data);
      }
    } finally {
      setLoading(false);
    }
  }

  // PDF download
  async function handleDownloadPdf() {
    try {
      const res = await api.get(API_ENDPOINTS.SALE_PDF(id), { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${sale?.invoice_number || id}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      alert('Failed to download PDF');
    }
  }

  // Delete
  async function handleDelete() {
    setDeleting(true);
    try {
      await api.delete(API_ENDPOINTS.SALE_DETAIL(id));
      navigate('/sales', { replace: true });
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to delete invoice');
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  // Calculations
  const totalAmount = parseFloat(sale?.total_amount || sale?.total || 0);
  const paidAmount = payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
  const remainingDue = totalAmount - paidAmount;

  // Loading
  if (loading) {
    return (
      <div className="animate-pulse space-y-5">
        <div className="flex justify-between">
          <div className="space-y-2">
            <div className="h-7 w-56 bg-slate-200 rounded" />
            <div className="h-4 w-32 bg-slate-100 rounded" />
          </div>
          <div className="flex gap-2">
            <div className="h-9 w-20 bg-slate-100 rounded-lg" />
            <div className="h-9 w-20 bg-slate-100 rounded-lg" />
          </div>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          <div className="xl:col-span-3 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-5 bg-slate-100 rounded w-full" />)}
          </div>
          <div className="xl:col-span-2 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            {[1, 2, 3].map((i) => <div key={i} className="h-5 bg-slate-100 rounded w-full" />)}
          </div>
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
        <button onClick={() => navigate('/sales')} className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium cursor-pointer">
          ← Back to Sales
        </button>
      </div>
    );
  }

  if (!sale) return null;

  const customer = sale.retailer || {};
  const items = sale.items || [];

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <button onClick={() => navigate('/sales')} className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer" title="Back to sales">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
            </button>
            <h1 className="text-2xl font-bold text-slate-900">
              {sale.invoice_number || `Invoice #${sale.id}`}
            </h1>
            <StatusBadge status={sale.payment_status || sale.status} large />
          </div>
          <p className="text-sm text-slate-500 ml-8">
            Created {fmtDate(sale.date || sale.created_at)}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => navigate(`/sales/${id}/edit`)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
            </svg>
            Edit
          </button>
          <button
            onClick={handleDownloadPdf}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            PDF
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium border border-red-200 rounded-lg text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
            Delete
          </button>
        </div>
      </div>

      {/* ── Two-column layout ── */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">

        {/* LEFT — Invoice details (60%) */}
        <div className="xl:col-span-3 space-y-5">
          {/* Customer info */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Customer</h2>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 font-bold text-sm shrink-0">
                {(customer.shop_name || customer.name || 'C').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">{customer.shop_name || customer.name || sale.retailer_name || '—'}</p>
                {customer.contact_person && <p className="text-sm text-slate-600">{customer.contact_person}</p>}
                {customer.phone && <p className="text-sm text-slate-500">{customer.phone}</p>}
                {customer.address && <p className="text-sm text-slate-400 mt-0.5">{customer.address}</p>}
              </div>
            </div>
          </div>

          {/* Line items */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100">
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Line Items</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    <th className="px-4 py-2.5">#</th>
                    <th className="px-4 py-2.5">Product</th>
                    <th className="px-4 py-2.5 text-right">Qty</th>
                    <th className="px-4 py-2.5 text-right">Unit Price</th>
                    <th className="px-4 py-2.5 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No line items</td></tr>
                  ) : (
                    items.map((item, idx) => {
                      const qty = parseFloat(item.quantity || 0);
                      const price = parseFloat(item.unit_price || item.price || 0);
                      const sub = qty * price;
                      return (
                        <tr key={item.id || idx}>
                          <td className="px-4 py-3 text-slate-400 text-xs">{idx + 1}</td>
                          <td className="px-4 py-3 font-medium text-slate-900">
                            {item.product?.name || item.product_name || `Product #${item.product}`}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-700">{qty}</td>
                          <td className="px-4 py-3 text-right text-slate-600">{fmt(price)}</td>
                          <td className="px-4 py-3 text-right font-medium text-slate-900">{fmt(sub)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="border-t border-slate-200 px-5 py-4 bg-slate-50/50">
              <div className="flex justify-end">
                <div className="w-64 space-y-1.5">
                  {sale.subtotal && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Subtotal</span>
                      <span className="text-slate-700">{fmt(sale.subtotal)}</span>
                    </div>
                  )}
                  {(sale.tax || sale.tax_amount) && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Tax</span>
                      <span className="text-slate-700">{fmt(sale.tax || sale.tax_amount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-bold border-t border-slate-200 pt-2">
                    <span className="text-slate-900">Total</span>
                    <span className="text-slate-900">{fmt(totalAmount)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          {sale.notes && (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Notes</h2>
              <p className="text-sm text-slate-600 whitespace-pre-wrap">{sale.notes}</p>
            </div>
          )}
        </div>

        {/* RIGHT — Payments & credit (40%) */}
        <div className="xl:col-span-2 space-y-5">
          {/* Remaining due */}
          <div className={`rounded-xl border p-5 shadow-sm ${
            remainingDue <= 0
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-red-50 border-red-200'
          }`}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-1 ${remainingDue <= 0 ? 'text-emerald-600' : 'text-red-600'}">
              {remainingDue <= 0 ? 'Fully Paid' : 'Remaining Due'}
            </p>
            <p className={`text-3xl font-bold ${remainingDue <= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
              {fmt(Math.max(0, remainingDue))}
            </p>
            <div className="flex items-center gap-4 mt-3 text-sm">
              <span className={remainingDue <= 0 ? 'text-emerald-600' : 'text-red-600'}>
                Paid: {fmt(paidAmount)}
              </span>
              <span className="text-slate-400">of {fmt(totalAmount)}</span>
            </div>
          </div>

          {/* Record payment button */}
          {remainingDue > 0 && (
            <button
              onClick={() => navigate('/payments/create', { state: {
                saleId: id,
                retailerId: customer.id || sale.retailer?.id || sale.retailer_id || sale.retailer,
                customerName: customer.shop_name || customer.name || sale.retailer_name || '—',
                invoiceNumber: sale.invoice_number || `#${sale.id}`,
                remainingDue: remainingDue,
                fromSale: true,
              } })}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white text-sm font-semibold rounded-lg shadow-md shadow-emerald-500/25 transition-all cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Record Payment
            </button>
          )}

          {/* Payment history */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100">
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Payment History</h2>
            </div>
            {payments.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <svg className="w-8 h-8 text-slate-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" strokeWidth={1.4} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                </svg>
                <p className="text-sm text-slate-400">No payments recorded</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {payments.map((p) => (
                  <div key={p.id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{fmt(p.amount)}</p>
                      <p className="text-xs text-slate-500">{fmtDate(p.date || p.created_at)}</p>
                    </div>
                    <div className="text-right">
                      {p.payment_method && (
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full capitalize">
                          {p.payment_method.replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Credit balance (if available) */}
          {(customer.credit_balance != null && parseFloat(customer.credit_balance) > 0) && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-0.5">Customer Credit Balance</p>
              <p className="text-xl font-bold text-blue-700">{fmt(customer.credit_balance)}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Delete confirmation modal ── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">Delete Invoice</h3>
                <p className="text-sm text-slate-500">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-5">
              Are you sure you want to delete <span className="font-medium">{sale.invoice_number || `#${sale.id}`}</span>? 
              All associated data will be permanently removed.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60 cursor-pointer"
              >
                {deleting ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Deleting...
                  </>
                ) : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
