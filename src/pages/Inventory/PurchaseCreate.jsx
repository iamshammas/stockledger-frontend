import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { useAxios } from '../../hooks/useAxios';
import { API_ENDPOINTS } from '../../config/api';

// DRF PageNumberPagination returns PAGE_SIZE = 10 rows per page.
const SERVER_PAGE_SIZE = 10;

const todayISO = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const emptyItem = () => ({ product: '', quantity: '', buying_price: '', selling_price: '' });

// ── Formatting ──
const fmtCurrency = (val) => {
  const n = parseFloat(val);
  if (!Number.isFinite(n)) return '₹0.00';
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const fmtQty = (val) => {
  const n = parseFloat(val);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('en-IN', { maximumFractionDigits: 3 });
};

const fmtDate = (d) => {
  if (!d) return '—';
  const date = new Date(`${d}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

// ── Data helpers ──
// Walks every server page by ?page=N. Never follows `next`, because the Vite
// proxy (changeOrigin) makes it an absolute backend URL.
async function fetchAll(api, endpoint) {
  const first = await api.get(endpoint, { params: { page: 1 } });
  const firstData = first.data;

  if (Array.isArray(firstData)) return firstData;

  const results = Array.isArray(firstData?.results) ? [...firstData.results] : [];
  const count = Number(firstData?.count) || results.length;
  const totalPages = Math.max(1, Math.ceil(count / SERVER_PAGE_SIZE));

  if (totalPages > 1) {
    const pageNumbers = [];
    for (let page = 2; page <= totalPages; page += 1) pageNumbers.push(page);

    const responses = await Promise.all(
      pageNumbers.map((page) => api.get(endpoint, { params: { page } }))
    );

    responses.forEach((res) => {
      if (Array.isArray(res.data?.results)) results.push(...res.data.results);
    });
  }

  return results;
}

const errorMessage = (value) => {
  if (!value) return '';
  if (Array.isArray(value)) return String(value[0]);
  if (typeof value === 'object') return 'Invalid value';
  return String(value);
};

// ── Inline supplier creation ──
function SupplierModal({ api, onClose, onCreated }) {
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { name: '', phone: '' } });

  const submit = async (data) => {
    setServerError('');

    const payload = { name: data.name.trim() };
    const phone = data.phone.trim();
    if (phone) payload.phone = phone;

    try {
      const res = await api.post(API_ENDPOINTS.SUPPLIERS_LIST, payload);
      onCreated(res.data);
    } catch (err) {
      const res = err.response;

      if (!res) {
        setServerError('Unable to connect to the server. Please try again.');
        return;
      }
      if (res.status === 401) return; // interceptor handles logout

      if (res.status === 400 && res.data && typeof res.data === 'object') {
        ['name', 'phone'].forEach((field) => {
          if (res.data[field]) {
            setError(field, { type: 'server', message: errorMessage(res.data[field]) });
          }
        });

        const banner = errorMessage(res.data.detail) || errorMessage(res.data.non_field_errors);
        if (banner) setServerError(banner);
        return;
      }

      setServerError(errorMessage(res.data?.detail) || 'Failed to add supplier.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md"
        role="dialog"
        aria-modal="true"
        aria-labelledby="supplier-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-100 flex items-start justify-between gap-4">
          <div>
            <h2 id="supplier-modal-title" className="text-base font-semibold text-slate-900">
              Add new supplier
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Saved to your tenant and selected for this purchase.
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
            <label htmlFor="supplier-name" className="block text-sm font-medium text-slate-700 mb-1">
              Supplier name <span className="text-red-500">*</span>
            </label>
            <input
              id="supplier-name"
              type="text"
              autoFocus
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 ${
                errors.name ? 'border-red-300 bg-red-50' : 'border-slate-300'
              }`}
              placeholder="e.g. Sri Balaji Distributors"
              {...register('name', { required: 'Supplier name is required' })}
            />
            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
          </div>

          <div>
            <label htmlFor="supplier-phone" className="block text-sm font-medium text-slate-700 mb-1">
              Phone
            </label>
            <input
              id="supplier-phone"
              type="tel"
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 ${
                errors.phone ? 'border-red-300 bg-red-50' : 'border-slate-300'
              }`}
              placeholder="10-digit mobile number"
              {...register('phone')}
            />
            {errors.phone && <p className="mt-1 text-xs text-red-500">{errors.phone.message}</p>}
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 rounded-lg shadow-md shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              {isSubmitting ? 'Adding...' : 'Add supplier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function PurchaseCreate() {
  const api = useAxios();
  const navigate = useNavigate();

  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [lastPurchase, setLastPurchase] = useState(new Map());
  const [stockByProduct, setStockByProduct] = useState(new Map());

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [apiError, setApiError] = useState('');
  const [createdPurchase, setCreatedPurchase] = useState(null);
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    reset,
    setError,
    clearErrors,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({
    defaultValues: {
      supplier: '',
      purchase_date: todayISO(),
      notes: '',
      items: [emptyItem()],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const items = useWatch({ control, name: 'items' });

  // ── Load suppliers, products, purchase history, current stock ──
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    const [suppliersRes, productsRes, purchasesRes, stockRes] = await Promise.allSettled([
      fetchAll(api, API_ENDPOINTS.SUPPLIERS_LIST),
      fetchAll(api, API_ENDPOINTS.PRODUCTS_LIST),
      fetchAll(api, API_ENDPOINTS.PURCHASES_LIST),
      fetchAll(api, API_ENDPOINTS.REPORTS_CURRENT_STOCK),
    ]);

    // Products are required to build a purchase; everything else is optional.
    if (productsRes.status === 'rejected') {
      const err = productsRes.reason;
      if (err?.response?.status !== 401) {
        setLoadError(
          err?.response?.data?.detail ||
            'Failed to load products. A purchase needs at least one product.'
        );
      }
      setLoading(false);
      return;
    }

    setProducts(productsRes.value);
    setSuppliers(suppliersRes.status === 'fulfilled' ? suppliersRes.value : []);

    // Most recent buying price per product, used to prefill new line items.
    const priceMap = new Map();
    if (purchasesRes.status === 'fulfilled') {
      const sorted = [...purchasesRes.value].sort((a, b) => {
        const da = a.purchase_date || '';
        const db = b.purchase_date || '';
        if (da === db) return b.id - a.id;
        return db.localeCompare(da);
      });

      sorted.forEach((purchase) => {
        (purchase.items || []).forEach((item) => {
          if (!priceMap.has(item.product)) {
            priceMap.set(item.product, {
              price: parseFloat(item.buying_price) || 0,
              date: purchase.purchase_date,
            });
          }
        });
      });
    }
    setLastPurchase(priceMap);

    // Read-only stock hint, keyed by product_id from the report endpoint.
    const stockMap = new Map();
    if (stockRes.status === 'fulfilled') {
      stockRes.value.forEach((row) => {
        stockMap.set(row.product_id, parseFloat(row.current_stock) || 0);
      });
    }
    setStockByProduct(stockMap);

    setLoading(false);
  }, [api]);

  useEffect(() => {
    // Deferred so the initial fetch does not cascade a synchronous render.
    const timer = setTimeout(() => {
      load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  // A product may only appear once: each row becomes its own FIFO layer.
  const duplicateProducts = useMemo(() => {
    const counts = new Map();
    (items || []).forEach((item) => {
      const id = Number(item.product);
      if (id) counts.set(id, (counts.get(id) || 0) + 1);
    });
    return new Set(
      [...counts.entries()].filter(([, count]) => count > 1).map(([id]) => id)
    );
  }, [items]);

  const totals = useMemo(() => {
    return (items || []).reduce(
      (acc, item) => {
        const quantity = parseFloat(item.quantity) || 0;
        const buying = parseFloat(item.buying_price) || 0;
        const selling = parseFloat(item.selling_price) || 0;
        acc.quantity += quantity;
        acc.cost += quantity * buying;
        acc.revenue += quantity * selling;
        return acc;
      },
      { quantity: 0, cost: 0, revenue: 0 }
    );
  }, [items]);

  const margin = totals.revenue - totals.cost;

  const handleProductChange = (index, rawValue) => {
    const productId = Number(rawValue);
    const product = productById.get(productId);
    const last = lastPurchase.get(productId);

    if (product && product.current_selling_price !== null && product.current_selling_price !== undefined) {
      setValue(`items.${index}.selling_price`, String(product.current_selling_price), {
        shouldDirty: true,
        shouldValidate: true,
      });
    }

    if (last) {
      setValue(`items.${index}.buying_price`, String(last.price), {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  };

  const handleApiError = (err) => {
    const res = err.response;

    if (!res) {
      setApiError('Unable to connect to the server. Please try again.');
      return;
    }
    if (res.status === 401) return; // interceptor handles logout

    if (res.status === 400 && res.data && typeof res.data === 'object') {
      let handled = false;

      ['supplier', 'purchase_date', 'notes', 'items'].forEach((field) => {
        if (!res.data[field] || field === 'items') return;
        setError(field, { type: 'server', message: errorMessage(res.data[field]) });
        handled = true;
      });

      if (Array.isArray(res.data.items)) {
        res.data.items.forEach((rowErrors, index) => {
          if (!rowErrors || typeof rowErrors !== 'object') return;
          Object.entries(rowErrors).forEach(([field, message]) => {
            setError(`items.${index}.${field}`, {
              type: 'server',
              message: errorMessage(message),
            });
          });
          handled = true;
        });
      } else if (res.data.items) {
        setApiError(errorMessage(res.data.items));
        handled = true;
      }

      const banner = errorMessage(res.data.detail) || errorMessage(res.data.non_field_errors);
      if (banner) {
        setApiError(banner);
        handled = true;
      }

      if (!handled) setApiError('Please check the purchase details and try again.');
      return;
    }

    setApiError(errorMessage(res.data?.detail) || 'Failed to create purchase.');
  };

  const onSubmit = async (data) => {
    setApiError('');
    clearErrors();

    const rows = data.items || [];

    if (rows.length === 0) {
      setApiError('Add at least one line item before saving.');
      return;
    }

    if (duplicateProducts.size > 0) {
      setApiError(
        'Each product can only appear once per purchase. Combine the quantities into a single row — each row becomes its own FIFO batch.'
      );
      return;
    }

    const payload = {
      supplier: data.supplier ? Number(data.supplier) : null,
      purchase_date: data.purchase_date,
      notes: data.notes.trim(),
      items: rows.map((row) => ({
        product: Number(row.product),
        quantity: row.quantity,
        buying_price: row.buying_price,
        selling_price: row.selling_price,
      })),
    };

    try {
      const res = await api.post(API_ENDPOINTS.PURCHASES_LIST, payload);
      const created = res.data;
      setCreatedPurchase(created);

      // Keep autofill and the stock hint accurate for the next purchase.
      setLastPurchase((current) => {
        const next = new Map(current);
        (created.items || []).forEach((item) => {
          next.set(item.product, {
            price: parseFloat(item.buying_price) || 0,
            date: created.purchase_date,
          });
        });
        return next;
      });

      setStockByProduct((current) => {
        const next = new Map(current);
        (created.items || []).forEach((item) => {
          const id = item.product;
          next.set(id, (next.get(id) || 0) + (parseFloat(item.quantity) || 0));
        });
        return next;
      });
    } catch (err) {
      handleApiError(err);
    }
  };

  const handleCancel = () => {
    if (!isDirty || window.confirm('Discard this purchase and leave?')) {
      navigate('/inventory/purchases');
    }
  };

  const handleAddAnother = () => {
    setCreatedPurchase(null);
    setApiError('');
    reset({
      supplier: '',
      purchase_date: todayISO(),
      notes: '',
      items: [emptyItem()],
    });
  };

  const handleSupplierCreated = (supplier) => {
    setSuppliers((current) => [...current, supplier]);
    setValue('supplier', String(supplier.id), { shouldDirty: true, shouldValidate: true });
    setSupplierModalOpen(false);
  };

  // ── Loading ──
  if (loading) {
    return (
      <div className="max-w-5xl mx-auto animate-pulse">
        <div className="h-9 w-56 bg-slate-100 rounded mb-2" />
        <div className="h-4 w-80 bg-slate-100 rounded mb-6" />
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-10 bg-slate-100 rounded-lg" />
            ))}
          </div>
          <div className="h-36 bg-slate-100 rounded-lg" />
        </div>
      </div>
    );
  }

  // ── Load error ──
  if (loadError) {
    return (
      <div className="max-w-lg mx-auto mt-16">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-8 text-center">
          <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-500" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-slate-900">Could not load the purchase form</h1>
          <p className="text-sm text-slate-500 mt-1">{loadError}</p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <button
              onClick={() => navigate('/inventory/purchases')}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Back
            </button>
            <button
              onClick={load}
              className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 rounded-lg shadow-md shadow-blue-500/25 transition-all cursor-pointer"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Success ──
  if (createdPurchase) {
    const createdItems = createdPurchase.items || [];

    return (
      <div className="max-w-lg mx-auto mt-16">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-8 text-center">
          <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-slate-900">
            Purchase #{createdPurchase.id} recorded
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {fmtDate(createdPurchase.purchase_date)} · {createdItems.length} line item
            {createdItems.length === 1 ? '' : 's'} · {fmtCurrency(createdPurchase.total_amount)}
          </p>
          <p className="text-xs text-slate-400 mt-3">
            Stock batches were created for each line and will be consumed in FIFO order when sold.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              onClick={handleAddAnother}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Add another purchase
            </button>
            <button
              onClick={() => navigate('/inventory/purchases')}
              className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 rounded-lg shadow-md shadow-blue-500/25 transition-all cursor-pointer"
            >
              View purchases
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          type="button"
          onClick={handleCancel}
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          title="Back to purchases"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
        </button>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-900">New Purchase</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Record incoming stock. Each line item becomes its own FIFO batch.
          </p>
        </div>
      </div>

      {apiError && (
        <div
          className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-start gap-3"
          role="alert"
        >
          <svg className="w-5 h-5 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <div>
            <p className="font-semibold">Could not save this purchase</p>
            <p>{apiError}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
        {/* Purchase details */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Purchase details</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="supplier" className="block text-sm font-medium text-slate-700">
                  Supplier
                </label>
                <button
                  type="button"
                  onClick={() => setSupplierModalOpen(true)}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700 cursor-pointer"
                >
                  + Add new supplier
                </button>
              </div>
              <select
                id="supplier"
                className={`w-full px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 ${
                  errors.supplier ? 'border-red-300 bg-red-50' : 'border-slate-300'
                }`}
                {...register('supplier')}
              >
                <option value="">No supplier</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                    {supplier.phone ? ` · ${supplier.phone}` : ''}
                  </option>
                ))}
              </select>
              {errors.supplier ? (
                <p className="mt-1 text-xs text-red-500">{errors.supplier.message}</p>
              ) : (
                <p className="mt-1 text-xs text-slate-400">
                  Optional. Suppliers are saved per tenant and reused on future purchases.
                </p>
              )}
            </div>

            <div>
              <label htmlFor="purchase_date" className="block text-sm font-medium text-slate-700 mb-1">
                Purchase date <span className="text-red-500">*</span>
              </label>
              <input
                id="purchase_date"
                type="date"
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 ${
                  errors.purchase_date ? 'border-red-300 bg-red-50' : 'border-slate-300'
                }`}
                {...register('purchase_date', { required: 'Purchase date is required' })}
              />
              {errors.purchase_date && (
                <p className="mt-1 text-xs text-red-500">{errors.purchase_date.message}</p>
              )}
            </div>

            <div className="md:col-span-3">
              <label htmlFor="notes" className="block text-sm font-medium text-slate-700 mb-1">
                Notes
              </label>
              <textarea
                id="notes"
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 resize-none"
                placeholder="Invoice reference, delivery details, remarks..."
                {...register('notes')}
              />
              {errors.notes && <p className="mt-1 text-xs text-red-500">{errors.notes.message}</p>}
            </div>
          </div>
        </div>

        {/* Line items */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Line items</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Both buying and selling price are required for each product.
              </p>
            </div>
            <button
              type="button"
              onClick={() => append(emptyItem())}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add line item
            </button>
          </div>

          {products.length === 0 && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg">
              No products found for this tenant. Create products first, then record a purchase.
            </div>
          )}

          <div className="space-y-4">
            {fields.map((field, index) => {
              const row = items?.[index] || {};
              const productId = Number(row.product);
              const product = productById.get(productId);
              const last = lastPurchase.get(productId);
              const stock = stockByProduct.get(productId);
              const quantity = parseFloat(row.quantity) || 0;
              const buying = parseFloat(row.buying_price) || 0;
              const rowErrors = errors.items?.[index] || {};
              const isDuplicate = productId ? duplicateProducts.has(productId) : false;

              return (
                <div
                  key={field.id}
                  className={`p-4 border rounded-xl ${
                    isDuplicate ? 'border-red-200 bg-red-50/40' : 'border-slate-200 bg-slate-50/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Item {index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      disabled={fields.length === 1}
                      className="px-2 py-1 text-xs font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-4">
                      <label
                        htmlFor={`item-${index}-product`}
                        className="block text-xs font-medium text-slate-600 mb-1"
                      >
                        Product <span className="text-red-500">*</span>
                      </label>
                      <select
                        id={`item-${index}-product`}
                        className={`w-full px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 ${
                          rowErrors.product ? 'border-red-300 bg-red-50' : 'border-slate-300'
                        }`}
                        {...register(`items.${index}.product`, {
                          required: 'Select a product',
                          onChange: (e) => handleProductChange(index, e.target.value),
                        })}
                      >
                        <option value="">Select product</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                            {p.sku ? ` · ${p.sku}` : ''}
                          </option>
                        ))}
                      </select>

                      {rowErrors.product ? (
                        <p className="mt-1 text-xs text-red-500">{rowErrors.product.message}</p>
                      ) : isDuplicate ? (
                        <p className="mt-1 text-xs text-red-500">
                          Already on this purchase — combine the quantities into one row.
                        </p>
                      ) : product ? (
                        <p className="mt-1 text-xs text-slate-400">
                          {last
                            ? `Last bought ${fmtCurrency(last.price)} on ${fmtDate(last.date)}`
                            : 'Never purchased before'}
                          {stock !== undefined ? ` · In stock: ${fmtQty(stock)}` : ''}
                        </p>
                      ) : null}
                    </div>

                    <div className="md:col-span-2">
                      <label
                        htmlFor={`item-${index}-quantity`}
                        className="block text-xs font-medium text-slate-600 mb-1"
                      >
                        Quantity <span className="text-red-500">*</span>
                      </label>
                      <input
                        id={`item-${index}-quantity`}
                        type="number"
                        min="0"
                        step="any"
                        className={`w-full px-3 py-2 border rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 ${
                          rowErrors.quantity ? 'border-red-300 bg-red-50' : 'border-slate-300'
                        }`}
                        placeholder="0"
                        {...register(`items.${index}.quantity`, {
                          required: 'Required',
                          validate: (value) =>
                            parseFloat(value) > 0 || 'Enter a quantity greater than 0',
                        })}
                      />
                      {rowErrors.quantity && (
                        <p className="mt-1 text-xs text-red-500">{rowErrors.quantity.message}</p>
                      )}
                    </div>

                    <div className="md:col-span-2">
                      <label
                        htmlFor={`item-${index}-buying`}
                        className="block text-xs font-medium text-slate-600 mb-1"
                      >
                        Buying price <span className="text-red-500">*</span>
                      </label>
                      <input
                        id={`item-${index}-buying`}
                        type="number"
                        min="0"
                        step="0.01"
                        className={`w-full px-3 py-2 border rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 ${
                          rowErrors.buying_price ? 'border-red-300 bg-red-50' : 'border-slate-300'
                        }`}
                        placeholder="0.00"
                        {...register(`items.${index}.buying_price`, {
                          required: 'Required',
                          validate: (value) => {
                            const n = parseFloat(value);
                            return (Number.isFinite(n) && n >= 0) || 'Must be 0 or more';
                          },
                        })}
                      />
                      {rowErrors.buying_price && (
                        <p className="mt-1 text-xs text-red-500">{rowErrors.buying_price.message}</p>
                      )}
                    </div>

                    <div className="md:col-span-2">
                      <label
                        htmlFor={`item-${index}-selling`}
                        className="block text-xs font-medium text-slate-600 mb-1"
                      >
                        Selling price <span className="text-red-500">*</span>
                      </label>
                      <input
                        id={`item-${index}-selling`}
                        type="number"
                        min="0"
                        step="0.01"
                        className={`w-full px-3 py-2 border rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 ${
                          rowErrors.selling_price ? 'border-red-300 bg-red-50' : 'border-slate-300'
                        }`}
                        placeholder="0.00"
                        {...register(`items.${index}.selling_price`, {
                          required: 'Required',
                          validate: (value) => {
                            const n = parseFloat(value);
                            return (Number.isFinite(n) && n >= 0) || 'Must be 0 or more';
                          },
                        })}
                      />
                      {rowErrors.selling_price && (
                        <p className="mt-1 text-xs text-red-500">{rowErrors.selling_price.message}</p>
                      )}
                    </div>

                    <div className="md:col-span-2">
                      <span className="block text-xs font-medium text-slate-600 mb-1">Line total</span>
                      <div className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-sm text-right font-semibold text-slate-900">
                        {fmtCurrency(quantity * buying)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {typeof errors.items?.message === 'string' && (
            <p className="mt-3 text-xs text-red-500">{errors.items.message}</p>
          )}
        </div>

        {/* Summary + actions */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="grid grid-cols-3 gap-6">
            <div>
              <p className="text-xs text-slate-500">Total quantity</p>
              <p className="text-sm font-semibold text-slate-900">{fmtQty(totals.quantity)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Total cost</p>
              <p className="text-sm font-semibold text-slate-900">{fmtCurrency(totals.cost)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Projected margin</p>
              <p
                className={`text-sm font-semibold ${
                  margin < 0 ? 'text-red-600' : 'text-emerald-600'
                }`}
              >
                {fmtCurrency(margin)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 lg:justify-end">
            <button
              type="button"
              onClick={handleCancel}
              className="px-5 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || duplicateProducts.size > 0}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 rounded-lg shadow-md shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              {isSubmitting ? 'Saving...' : 'Save Purchase'}
            </button>
          </div>
        </div>
      </form>

      {supplierModalOpen && (
        <SupplierModal
          api={api}
          onClose={() => setSupplierModalOpen(false)}
          onCreated={handleSupplierCreated}
        />
      )}
    </div>
  );
}
