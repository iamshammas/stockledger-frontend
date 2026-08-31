import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAxios } from '../../hooks/useAxios';
import { API_ENDPOINTS } from '../../config/api';

const fmt = (val) => {
  const num = parseFloat(val);
  if (isNaN(num)) return '₹0.00';
  return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const getRetailerId = (sale, fallback = '') => sale?.retailer?.id || sale?.retailer_id || sale?.retailer || fallback;

const getRetailerName = (sale) => sale?.retailer?.shop_name || sale?.retailer?.name || sale?.retailer_name || '—';

export default function PaymentCreate() {
  const api = useAxios();
  const navigate = useNavigate();
  const location = useLocation();

  // Pre-fill from SaleDetail "Record Payment" button
  const prefill = location.state || {};
  const lockedFromSale = Boolean(prefill.saleId);

  const { register, handleSubmit, formState: { errors }, watch, setValue, reset } = useForm({
    defaultValues: {
      retailer: prefill.retailerId ? String(prefill.retailerId) : '',
      sale: prefill.saleId ? String(prefill.saleId) : '',
      amount: prefill.amount ? String(prefill.amount) : '',
      payment_method: 'cash',
      payment_date: new Date().toISOString().split('T')[0],
      notes: '',
    },
  });

  const [retailers, setRetailers] = useState([]);
  const [sales, setSales] = useState([]);
  const [lockedSale, setLockedSale] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState('');

  const selectedRetailer = watch('retailer');
  const selectedSale = watch('sale');

  // Fetch retailers on mount
  useEffect(() => {
    api.get(API_ENDPOINTS.RETAILERS_LIST, { params: { limit: 200 } }).then((r) => {
      const data = Array.isArray(r.data) ? r.data : r.data?.results ?? [];
      setRetailers(data);
    }).catch(() => {});
  }, []);

  // Lock the form to a specific sale when opened from SaleDetail.
  useEffect(() => {
    if (!lockedFromSale || !prefill.saleId) {
      setLockedSale(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const [saleRes, paymentRes] = await Promise.all([
          api.get(API_ENDPOINTS.SALE_DETAIL(prefill.saleId)),
          api.get(API_ENDPOINTS.SALE_PAYMENTS(prefill.saleId)),
        ]);

        if (cancelled) return;

        const sale = saleRes.data || {};
        const paymentsData = Array.isArray(paymentRes.data) ? paymentRes.data : paymentRes.data?.results ?? [];
        const totalAmount = parseFloat(sale.total_amount || sale.total || 0);
        const paidAmount = paymentsData.reduce((sum, payment) => sum + parseFloat(payment.amount || 0), 0);
        const remainingDue = Math.max(0, totalAmount - paidAmount);
        const retailerId = getRetailerId(sale, prefill.retailerId || '');

        setLockedSale({
          saleId: String(sale.id || prefill.saleId),
          invoiceNumber: sale.invoice_number || `#${sale.id}`,
          retailerId: retailerId ? String(retailerId) : '',
          retailerName: getRetailerName(sale),
          totalAmount,
          paidAmount,
          remainingDue,
        });

        reset((currentValues) => ({
          ...currentValues,
          retailer: retailerId ? String(retailerId) : '',
          sale: String(sale.id || prefill.saleId),
          amount: String(prefill.amount || remainingDue || ''),
        }));

        if (!prefill.amount) {
          setValue('amount', String(remainingDue || ''), { shouldValidate: true });
        }
      } catch {
        if (cancelled) return;
        setApiError('Failed to load invoice details for payment');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [api, lockedFromSale, prefill.saleId, prefill.retailerId, prefill.amount, reset, setValue]);

  // Fetch unpaid/partially-paid sales for the selected retailer
  useEffect(() => {
    if (lockedFromSale) {
      return;
    }

    if (!selectedRetailer) { setSales([]); return; }
    api.get(API_ENDPOINTS.SALES_LIST, {
      params: { retailer: selectedRetailer, limit: 50 },
    }).then((r) => {
      const data = Array.isArray(r.data) ? r.data : r.data?.results ?? [];
      // Filter to show only unpaid/partial invoices
      const unpaid = data.filter((s) => {
        const st = (s.payment_status || '').toLowerCase();
        return st !== 'paid' && st !== 'completed';
      });
      setSales(unpaid.length > 0 ? unpaid : data); // fallback to all if none unpaid
    }).catch(() => setSales([]));
  }, [lockedFromSale, selectedRetailer]);

  useEffect(() => {
    if (lockedFromSale && lockedSale) {
      setValue('retailer', lockedSale.retailerId);
      setValue('sale', lockedSale.saleId);
    }
  }, [lockedFromSale, lockedSale, setValue]);

  // Find selected sale to show remaining due
  const currentSale = lockedSale
    ? {
        id: lockedSale.saleId,
        invoice_number: lockedSale.invoiceNumber,
        total_amount: lockedSale.totalAmount,
        paid_amount: lockedSale.paidAmount,
        remaining_due: lockedSale.remainingDue,
        retailer: { id: lockedSale.retailerId, shop_name: lockedSale.retailerName },
      }
    : sales.find((s) => String(s.id) === String(selectedSale));
  const saleTotal = parseFloat(currentSale?.total_amount || currentSale?.total || 0);
  const salePaid = parseFloat(currentSale?.paid_amount || currentSale?.amount_paid || 0);
  const saleRemaining = saleTotal - salePaid;

  // Submit — POST to /api/sales/{saleId}/payment/
  const onSubmit = async (data) => {
    setApiError('');

    if (!data.sale) {
      setApiError('Please select an invoice to record payment against');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        amount: parseFloat(data.amount),
        payment_method: data.payment_method,
        payment_date: data.payment_date,
        notes: data.notes || '',
      };

      // POST to /api/sales/{saleId}/payment/
      await api.post(API_ENDPOINTS.SALE_PAYMENTS(data.sale), payload);
      navigate(`/sales/${data.sale}`, { replace: true });
    } catch (err) {
      if (!err.response) {
        setApiError('Unable to connect to server');
      } else if (err.response.status === 400) {
        const d = err.response.data;
        if (typeof d === 'string') setApiError(d);
        else if (d?.detail) setApiError(d.detail);
        else if (d?.non_field_errors) setApiError(d.non_field_errors.join(', '));
        else {
          const msgs = Object.entries(d).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('; ');
          setApiError(msgs || 'Validation error');
        }
      } else {
        setApiError('Failed to record payment');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Record Payment</h1>
          <p className="text-sm text-slate-500 mt-0.5">Record a payment against an invoice</p>
        </div>
        <button
          onClick={() => navigate('/payments')}
          className="px-4 py-2 text-sm font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
        >
          Cancel
        </button>
      </div>

      {/* API Error */}
      {apiError && (
        <div className="mb-5 flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg" role="alert">
          <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span>{apiError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 mb-5 space-y-5">
          {/* Customer — to filter invoices */}
          <div>
            <label htmlFor="payment-retailer" className="block text-sm font-medium text-slate-700 mb-1.5">
              Customer <span className="text-red-500">*</span>
            </label>
            <input type="hidden" {...register('retailer', { required: 'Customer is required' })} />
            {lockedFromSale && lockedSale ? (
              <div className="w-full px-3 py-2.5 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-900">
                {lockedSale.retailerName}
              </div>
            ) : (
              <select
                id="payment-retailer"
                {...register('retailer', { required: 'Customer is required' })}
                className={`w-full px-3 py-2.5 bg-slate-50 border rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 focus:bg-white transition-all cursor-pointer ${errors.retailer ? 'border-red-400' : 'border-slate-200'}`}
              >
                <option value="">Select customer...</option>
                {retailers.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.shop_name || r.name} {r.contact_person ? `(${r.contact_person})` : ''}
                  </option>
                ))}
              </select>
            )}
            {errors.retailer && <p className="mt-1.5 text-xs text-red-600">{errors.retailer.message}</p>}
          </div>

          {/* Invoice — REQUIRED */}
          <div>
            <label htmlFor="payment-sale" className="block text-sm font-medium text-slate-700 mb-1.5">
              Invoice <span className="text-red-500">*</span>
            </label>
            <input type="hidden" {...register('sale', { required: 'Invoice is required — payments must be linked to an invoice' })} />
            {lockedFromSale && lockedSale ? (
              <div className="w-full px-3 py-2.5 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-900">
                {lockedSale.invoiceNumber}
              </div>
            ) : (
              <select
                id="payment-sale"
                {...register('sale', { required: 'Invoice is required — payments must be linked to an invoice' })}
                disabled={!selectedRetailer}
                className={`w-full px-3 py-2.5 bg-slate-50 border rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 focus:bg-white transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${errors.sale ? 'border-red-400' : 'border-slate-200'}`}
              >
                <option value="">Select invoice...</option>
                {sales.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.invoice_number || `#${s.id}`} — Total: {fmt(s.total_amount || s.total)} ({(s.payment_status || 'unpaid').replace(/_/g, ' ')})
                  </option>
                ))}
              </select>
            )}
            {errors.sale && <p className="mt-1.5 text-xs text-red-600">{errors.sale.message}</p>}
            {!lockedFromSale && !selectedRetailer && (
              <p className="mt-1.5 text-xs text-slate-400">Select a customer first to see their invoices</p>
            )}
            {!lockedFromSale && selectedRetailer && sales.length === 0 && (
              <p className="mt-1.5 text-xs text-slate-400">No invoices found for this customer</p>
            )}
          </div>

          {/* Invoice summary — show remaining due */}
          {currentSale && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Invoice Total</p>
                  <p className="text-sm font-bold text-slate-900">{fmt(saleTotal)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Already Paid</p>
                  <p className="text-sm font-bold text-emerald-600">{fmt(salePaid)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Remaining Due</p>
                  <p className={`text-sm font-bold ${saleRemaining > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {fmt(Math.max(0, saleRemaining))}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Amount */}
            <div>
              <label htmlFor="payment-amount" className="block text-sm font-medium text-slate-700 mb-1.5">
                Amount <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium">₹</span>
                <input
                  id="payment-amount"
                  type="number"
                  min="0.01"
                  step="any"
                  placeholder="0.00"
                  defaultValue={prefill.amount ? String(prefill.amount) : ''}
                  {...register('amount', {
                    required: 'Amount is required',
                    validate: (v) => parseFloat(v) > 0 || 'Amount must be greater than 0',
                  })}
                  className={`w-full pl-7 pr-3 py-2.5 bg-slate-50 border rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 focus:bg-white transition-all ${errors.amount ? 'border-red-400' : 'border-slate-200'}`}
                />
              </div>
              {errors.amount && <p className="mt-1.5 text-xs text-red-600">{errors.amount.message}</p>}
            </div>

            {/* Payment Date */}
            <div>
              <label htmlFor="payment-date" className="block text-sm font-medium text-slate-700 mb-1.5">
                Payment Date <span className="text-red-500">*</span>
              </label>
              <input
                id="payment-date"
                type="date"
                {...register('payment_date', { required: 'Date is required' })}
                className={`w-full px-3 py-2.5 bg-slate-50 border rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 focus:bg-white transition-all ${errors.payment_date ? 'border-red-400' : 'border-slate-200'}`}
              />
              {errors.payment_date && <p className="mt-1.5 text-xs text-red-600">{errors.payment_date.message}</p>}
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <label htmlFor="payment-method" className="block text-sm font-medium text-slate-700 mb-1.5">
              Payment Method
            </label>
            <select
              id="payment-method"
              {...register('payment_method')}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 focus:bg-white transition-all cursor-pointer"
            >
              <option value="cash">Cash</option>
              <option value="cheque">Cheque</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="upi">UPI</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="payment-notes" className="block text-sm font-medium text-slate-700 mb-1.5">
              Notes <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              id="payment-notes"
              rows={3}
              {...register('notes')}
              placeholder="e.g. Cheque #1234, partial payment..."
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 focus:bg-white transition-all resize-none"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/payments')}
            className="px-5 py-2.5 text-sm font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            id="submit-payment-btn"
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white text-sm font-semibold rounded-lg shadow-md shadow-emerald-500/25 transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Recording...
              </>
            ) : (
              'Record Payment'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
