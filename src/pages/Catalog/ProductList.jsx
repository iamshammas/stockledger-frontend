import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useAxios } from '../../hooks/useAxios';
import { API_ENDPOINTS } from '../../config/api';

// The backend paginates every list endpoint at 10 rows per page.
const SERVER_PAGE_SIZE = 10;
const ROWS_PER_PAGE = 20;

const PRODUCT_FIELDS = [
  'name',
  'category',
  'brand',
  'unit',
  'sku',
  'current_selling_price',
  'low_stock_threshold',
];

const fieldBase =
  'w-full px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500';

const fmtCurrency = (value) => {
  const num = parseFloat(value);
  if (Number.isNaN(num)) return '—';
  return (
    '₹' +
    num.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
};

const fmtQty = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  const num = parseFloat(value);
  if (Number.isNaN(num)) return '—';
  return num.toLocaleString('en-IN', { maximumFractionDigits: 3 });
};

const errorMessage = (value) => {
  if (!value) return '';
  if (Array.isArray(value)) return String(value[0]);
  if (typeof value === 'object') return 'Invalid value';
  return String(value);
};

const amountRule = (label) => ({
  validate: (value) => {
    if (value === '' || value === null || value === undefined) return true;
    const num = Number(value);
    if (Number.isNaN(num)) return `Enter a valid ${label}`;
    if (num < 0) return `${label} cannot be negative`;
    return true;
  },
});

/**
 * Fetches every row of a DRF list endpoint.
 * - Plain arrays (reports) are returned as-is.
 * - Paginated responses are walked with relative ?page=N requests.
 *   Never follows `next`, which points at the backend host.
 */
async function fetchAll(api, endpoint) {
  const first = await api.get(endpoint, { params: { page: 1 } });
  if (Array.isArray(first.data)) return first.data;

  const rows = [...(first.data?.results ?? [])];
  const count = Number(first.data?.count ?? rows.length);
  const totalPages = Math.ceil(count / SERVER_PAGE_SIZE);

  if (totalPages > 1) {
    const pages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
    const responses = await Promise.all(
      pages.map((page) => api.get(endpoint, { params: { page } }))
    );
    responses.forEach((res) => rows.push(...(res.data?.results ?? [])));
  }

  return rows;
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {[...Array(8)].map((_, i) => (
        <td key={i} className="px-4 py-4">
          <div className={`h-4 bg-slate-100 rounded ${i === 0 ? 'w-32' : 'w-full'}`} />
        </td>
      ))}
    </tr>
  );
}

// ── Quick-add for category / brand / unit ──
const QUICK_ADD_META = {
  category: {
    title: 'Add new category',
    endpoint: API_ENDPOINTS.CATEGORIES_LIST,
    placeholder: 'e.g. Electronics',
    hasShortCode: false,
  },
  brand: {
    title: 'Add new brand',
    endpoint: API_ENDPOINTS.BRANDS_LIST,
    placeholder: 'e.g. Samsung',
    hasShortCode: false,
  },
  unit: {
    title: 'Add new unit',
    endpoint: API_ENDPOINTS.UNITS_LIST,
    placeholder: 'e.g. Pieces',
    hasShortCode: true,
  },
};

function QuickAddModal({ api, type, onClose, onCreated }) {
  const meta = QUICK_ADD_META[type];
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { name: '', short_code: '' } });

  const submit = async (data) => {
    setServerError('');

    const payload = { name: data.name.trim() };
    if (meta.hasShortCode && data.short_code.trim()) {
      payload.short_code = data.short_code.trim();
    }

    try {
      const res = await api.post(meta.endpoint, payload);
      onCreated(res.data);
    } catch (err) {
      const res = err.response;

      if (!res) {
        setServerError('Unable to connect to the server. Please try again.');
        return;
      }
      if (res.status === 401) return; // interceptor handles logout

      if (res.status === 400 && res.data && typeof res.data === 'object') {
        ['name', 'short_code'].forEach((field) => {
          if (res.data[field]) {
            setError(field, { type: 'server', message: errorMessage(res.data[field]) });
          }
        });

        const banner =
          errorMessage(res.data.detail) || errorMessage(res.data.non_field_errors);
        if (banner) setServerError(banner);
        return;
      }

      setServerError(errorMessage(res.data?.detail) || `Failed to add ${type}.`);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-add-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-100 flex items-start justify-between gap-4">
          <div>
            <h2 id="quick-add-title" className="text-base font-semibold text-slate-900">
              {meta.title}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Saved to your catalog and selected for this product.
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
            <label htmlFor="quick-add-name" className="block text-sm font-medium text-slate-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              id="quick-add-name"
              type="text"
              autoFocus
              className={`${fieldBase} ${errors.name ? 'border-red-300 bg-red-50' : 'border-slate-300'}`}
              placeholder={meta.placeholder}
              {...register('name', { required: 'Name is required' })}
            />
            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
          </div>

          {meta.hasShortCode && (
            <div>
              <label htmlFor="quick-add-short-code" className="block text-sm font-medium text-slate-700 mb-1">
                Short code
              </label>
              <input
                id="quick-add-short-code"
                type="text"
                maxLength={10}
                className={`${fieldBase} ${errors.short_code ? 'border-red-300 bg-red-50' : 'border-slate-300'}`}
                placeholder="e.g. pcs"
                {...register('short_code')}
              />
              {errors.short_code && (
                <p className="mt-1 text-xs text-red-500">{errors.short_code.message}</p>
              )}
            </div>
          )}

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
              {isSubmitting ? 'Adding...' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Create / edit product ──
function ProductFormModal({
  api,
  mode,
  product,
  categories,
  brands,
  units,
  onClose,
  onSaved,
  onLookupCreated,
}) {
  const isEdit = mode === 'edit';
  const [serverError, setServerError] = useState('');
  const [quickAdd, setQuickAdd] = useState(null);

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      name: product?.name ?? '',
      category: product?.category ? String(product.category) : '',
      brand: product?.brand ? String(product.brand) : '',
      unit: product?.unit ? String(product.unit) : '',
      sku: product?.sku ?? '',
      current_selling_price: product?.current_selling_price ?? '',
      low_stock_threshold: product?.low_stock_threshold ?? '',
    },
  });

  const submit = async (data) => {
    setServerError('');

    const payload = {
      name: data.name.trim(),
      category: Number(data.category),
      unit: Number(data.unit),
      brand: data.brand ? Number(data.brand) : null,
      sku: data.sku ? data.sku.trim() : '',
      current_selling_price: data.current_selling_price === '' ? null : data.current_selling_price,
      low_stock_threshold: data.low_stock_threshold === '' ? null : data.low_stock_threshold,
    };

    try {
      const res = isEdit
        ? await api.patch(API_ENDPOINTS.PRODUCT_DETAIL(product.id), payload)
        : await api.post(API_ENDPOINTS.PRODUCTS_LIST, payload);

      onSaved(res.data, isEdit);
    } catch (err) {
      const res = err.response;

      if (!res) {
        setServerError('Unable to connect to the server. Please try again.');
        return;
      }
      if (res.status === 401) return; // interceptor handles logout

      if (res.status === 400 && res.data && typeof res.data === 'object') {
        let mapped = false;
        PRODUCT_FIELDS.forEach((field) => {
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
        errorMessage(res.data?.detail) || 'Failed to save product. Please try again.'
      );
    }
  };

  const handleQuickAddCreated = (item) => {
    onLookupCreated(quickAdd, item);
    setValue(quickAdd, String(item.id), { shouldValidate: true, shouldDirty: true });
    setQuickAdd(null);
  };

  const quickAddButton = (type, label) => (
    <button
      type="button"
      onClick={() => setQuickAdd(type)}
      className="text-xs font-medium text-blue-600 hover:text-blue-700 cursor-pointer"
    >
      + {label}
    </button>
  );

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="product-modal-title"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-6 py-4 border-b border-slate-100 flex items-start justify-between gap-4">
            <div>
              <h2 id="product-modal-title" className="text-base font-semibold text-slate-900">
                {isEdit ? 'Edit product' : 'Add new product'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {isEdit
                  ? 'Update the catalog details for this product.'
                  : 'Create a product so it can be purchased and sold.'}
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

          <form onSubmit={handleSubmit(submit)} className="px-6 py-5 space-y-5" noValidate>
            {serverError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg" role="alert">
                {serverError}
              </div>
            )}

            <div>
              <label htmlFor="product-name" className="block text-sm font-medium text-slate-700 mb-1">
                Product name <span className="text-red-500">*</span>
              </label>
              <input
                id="product-name"
                type="text"
                autoFocus
                className={`${fieldBase} ${errors.name ? 'border-red-300 bg-red-50' : 'border-slate-300'}`}
                placeholder="e.g. LED Bulb 9W"
                {...register('name', { required: 'Product name is required' })}
              />
              {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="product-category" className="block text-sm font-medium text-slate-700">
                    Category <span className="text-red-500">*</span>
                  </label>
                  {quickAddButton('category', 'New')}
                </div>
                <select
                  id="product-category"
                  className={`${fieldBase} ${errors.category ? 'border-red-300 bg-red-50' : 'border-slate-300'}`}
                  {...register('category', { required: 'Category is required' })}
                >
                  <option value="">Select category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {errors.category && (
                  <p className="mt-1 text-xs text-red-500">{errors.category.message}</p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="product-brand" className="block text-sm font-medium text-slate-700">
                    Brand
                  </label>
                  {quickAddButton('brand', 'New')}
                </div>
                <select
                  id="product-brand"
                  className={`${fieldBase} ${errors.brand ? 'border-red-300 bg-red-50' : 'border-slate-300'}`}
                  {...register('brand')}
                >
                  <option value="">No brand</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
                {errors.brand && (
                  <p className="mt-1 text-xs text-red-500">{errors.brand.message}</p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="product-unit" className="block text-sm font-medium text-slate-700">
                    Unit <span className="text-red-500">*</span>
                  </label>
                  {quickAddButton('unit', 'New')}
                </div>
                <select
                  id="product-unit"
                  className={`${fieldBase} ${errors.unit ? 'border-red-300 bg-red-50' : 'border-slate-300'}`}
                  {...register('unit', { required: 'Unit is required' })}
                >
                  <option value="">Select unit</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.short_code ? `${u.name} (${u.short_code})` : u.name}
                    </option>
                  ))}
                </select>
                {errors.unit && (
                  <p className="mt-1 text-xs text-red-500">{errors.unit.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="product-sku" className="block text-sm font-medium text-slate-700 mb-1">
                  SKU
                </label>
                <input
                  id="product-sku"
                  type="text"
                  maxLength={64}
                  className={`${fieldBase} ${errors.sku ? 'border-red-300 bg-red-50' : 'border-slate-300'}`}
                  placeholder="e.g. BULB-9W-01"
                  {...register('sku')}
                />
                {errors.sku && <p className="mt-1 text-xs text-red-500">{errors.sku.message}</p>}
              </div>

              <div>
                <label htmlFor="product-price" className="block text-sm font-medium text-slate-700 mb-1">
                  Selling price (₹)
                </label>
                <input
                  id="product-price"
                  type="number"
                  min="0"
                  step="0.01"
                  className={`${fieldBase} ${errors.current_selling_price ? 'border-red-300 bg-red-50' : 'border-slate-300'}`}
                  placeholder="0.00"
                  {...register('current_selling_price', amountRule('selling price'))}
                />
                {errors.current_selling_price && (
                  <p className="mt-1 text-xs text-red-500">{errors.current_selling_price.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="product-threshold" className="block text-sm font-medium text-slate-700 mb-1">
                  Low stock threshold
                </label>
                <input
                  id="product-threshold"
                  type="number"
                  min="0"
                  step="0.001"
                  className={`${fieldBase} ${errors.low_stock_threshold ? 'border-red-300 bg-red-50' : 'border-slate-300'}`}
                  placeholder="e.g. 10"
                  {...register('low_stock_threshold', amountRule('threshold'))}
                />
                {errors.low_stock_threshold && (
                  <p className="mt-1 text-xs text-red-500">{errors.low_stock_threshold.message}</p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
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
                {isSubmitting
                  ? 'Saving...'
                  : isEdit
                    ? 'Save changes'
                    : 'Create product'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {quickAdd && (
        <QuickAddModal
          api={api}
          type={quickAdd}
          onClose={() => setQuickAdd(null)}
          onCreated={handleQuickAddCreated}
        />
      )}
    </>
  );
}

// ── Deactivate confirmation ──
function DeactivateModal({ api, product, onClose, onDeactivated }) {
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState('');

  const confirm = async () => {
    setBusy(true);
    setServerError('');

    try {
      await api.patch(API_ENDPOINTS.PRODUCT_DETAIL(product.id), { is_active: false });
      onDeactivated(product.id);
    } catch (err) {
      const res = err.response;

      if (!res) {
        setServerError('Unable to connect to the server. Please try again.');
        return;
      }
      if (res.status === 401) return; // interceptor handles logout

      setServerError(
        errorMessage(res.data?.detail) || 'Failed to deactivate product. Please try again.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50"
      onClick={busy ? undefined : onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md"
        role="dialog"
        aria-modal="true"
        aria-labelledby="deactivate-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </div>
            <div className="min-w-0">
              <h2 id="deactivate-modal-title" className="text-base font-semibold text-slate-900">
                Deactivate product
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                <span className="font-medium text-slate-900">{product.name}</span> will be marked
                inactive and hidden from this list.
              </p>
            </div>
          </div>

          {serverError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg" role="alert">
              {serverError}
            </div>
          )}

          <div className="mt-5 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={busy}
              className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 rounded-lg shadow-md shadow-red-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              {busy ? 'Deactivating...' : 'Deactivate'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProductList() {
  const api = useAxios();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [units, setUnits] = useState([]);
  const [stockById, setStockById] = useState(() => new Map());

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [brandFilter, setBrandFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name-asc');

  const [page, setPage] = useState(1);
  const [hiddenIds, setHiddenIds] = useState(() => new Set());

  const [modal, setModal] = useState(null); // { mode, product }
  const [deactivateTarget, setDeactivateTarget] = useState(null);

  // Debounce search; any new query starts back at page 1
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Load products + lookups + stock
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError('');

      try {
        const [productRows, categoryRows, brandRows, unitRows, stockRows] = await Promise.all([
          fetchAll(api, API_ENDPOINTS.PRODUCTS_LIST),
          fetchAll(api, API_ENDPOINTS.CATEGORIES_LIST).catch(() => []),
          fetchAll(api, API_ENDPOINTS.BRANDS_LIST).catch(() => []),
          fetchAll(api, API_ENDPOINTS.UNITS_LIST).catch(() => []),
          fetchAll(api, API_ENDPOINTS.REPORTS_CURRENT_STOCK).catch(() => []),
        ]);

        if (cancelled) return;

        setProducts(productRows);
        setCategories(categoryRows);
        setBrands(brandRows);
        setUnits(unitRows);

        const map = new Map();
        stockRows.forEach((row) => {
          const id = row.product_id ?? row.id;
          if (id !== undefined) map.set(id, row.current_stock);
        });
        setStockById(map);
      } catch (err) {
        if (cancelled) return;
        if (err.response?.status !== 401) {
          setError(err.response?.data?.detail || 'Failed to load products.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [api]);

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories]
  );
  const brandMap = useMemo(() => new Map(brands.map((b) => [b.id, b.name])), [brands]);
  const unitMap = useMemo(() => new Map(units.map((u) => [u.id, u])), [units]);

  const visibleProducts = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();

    const rows = products
      .filter((p) => p.is_active !== false && !hiddenIds.has(p.id))
      .filter((p) => categoryFilter === 'all' || String(p.category) === categoryFilter)
      .filter((p) => brandFilter === 'all' || String(p.brand) === brandFilter)
      .filter((p) => {
        if (!query) return true;
        const haystack = [
          p.name,
          p.sku,
          categoryMap.get(p.category),
          brandMap.get(p.brand),
          unitMap.get(p.unit)?.name,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(query);
      });

    const byName = (a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
    const price = (p) => {
      const num = parseFloat(p.current_selling_price);
      return Number.isNaN(num) ? -1 : num;
    };

    switch (sortBy) {
      case 'name-desc':
        return rows.sort((a, b) => byName(b, a));
      case 'price-asc':
        return rows.sort((a, b) => price(a) - price(b));
      case 'price-desc':
        return rows.sort((a, b) => price(b) - price(a));
      default:
        return rows.sort(byName);
    }
  }, [products, hiddenIds, categoryFilter, brandFilter, debouncedSearch, sortBy, categoryMap, brandMap, unitMap]);

  const totalPages = Math.max(1, Math.ceil(visibleProducts.length / ROWS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pageRows = visibleProducts.slice((safePage - 1) * ROWS_PER_PAGE, safePage * ROWS_PER_PAGE);
  const hasFilters = Boolean(debouncedSearch) || categoryFilter !== 'all' || brandFilter !== 'all';

  const handleSaved = useCallback((saved, isEdit) => {
    setProducts((prev) => {
      if (isEdit) return prev.map((p) => (p.id === saved.id ? saved : p));
      return prev.some((p) => p.id === saved.id) ? prev : [saved, ...prev];
    });
    setModal(null);
    setNotice(isEdit ? `Product "${saved.name}" updated.` : `Product "${saved.name}" created.`);
  }, []);

  const handleLookupCreated = useCallback((type, item) => {
    if (type === 'category') setCategories((prev) => [...prev, item]);
    else if (type === 'brand') setBrands((prev) => [...prev, item]);
    else if (type === 'unit') setUnits((prev) => [...prev, item]);
  }, []);

  const handleDeactivated = useCallback((id) => {
    setHiddenIds((prev) => new Set(prev).add(id));
    setDeactivateTarget(null);
    setNotice('Product deactivated.');
  }, []);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Products</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {visibleProducts.length} product{visibleProducts.length !== 1 ? 's' : ''}
            {hasFilters && products.length !== visibleProducts.length
              ? ` matching filters (of ${products.length})`
              : ' in your catalog'}
          </p>
        </div>
        <button
          id="add-product-btn"
          onClick={() => setModal({ mode: 'create', product: null })}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white text-sm font-semibold rounded-lg shadow-md shadow-blue-500/25 transition-all cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Product
        </button>
      </div>

      {/* Notice */}
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

      {/* Search + filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-5 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <div className="relative md:col-span-2 xl:col-span-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              id="product-search"
              type="text"
              placeholder="Search by name, SKU, category, brand..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 focus:bg-white transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                aria-label="Clear search"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          <select
            id="product-category-filter"
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
            className={`${fieldBase} border-slate-200 bg-slate-50 py-2.5`}
            aria-label="Filter by category"
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            id="product-brand-filter"
            value={brandFilter}
            onChange={(e) => {
              setBrandFilter(e.target.value);
              setPage(1);
            }}
            className={`${fieldBase} border-slate-200 bg-slate-50 py-2.5`}
            aria-label="Filter by brand"
          >
            <option value="all">All brands</option>
            {brands.map((b) => (
              <option key={b.id} value={String(b.id)}>
                {b.name}
              </option>
            ))}
          </select>

          <select
            id="product-sort"
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value);
              setPage(1);
            }}
            className={`${fieldBase} border-slate-200 bg-slate-50 py-2.5`}
            aria-label="Sort products"
          >
            <option value="name-asc">Name A–Z</option>
            <option value="name-desc">Name Z–A</option>
            <option value="price-asc">Price low → high</option>
            <option value="price-desc">Price high → low</option>
          </select>
        </div>
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
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Brand</th>
                <th className="px-4 py-3">Unit</th>
                <th className="px-4 py-3 text-right">Selling Price</th>
                <th className="px-4 py-3 text-right">Low Stock</th>
                <th className="px-4 py-3 text-right">Stock</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.4} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-600">
                          {hasFilters ? 'No products match your filters' : 'No products yet'}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {hasFilters
                            ? 'Try a different search term or clear the filters'
                            : 'Add your first product to start building your catalog'}
                        </p>
                      </div>
                      {!hasFilters && (
                        <button
                          type="button"
                          onClick={() => setModal({ mode: 'create', product: null })}
                          className="mt-1 text-sm font-medium text-blue-600 hover:text-blue-700 cursor-pointer"
                        >
                          + Add Product
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                pageRows.map((p) => {
                  const stock = stockById.get(p.id);
                  const hasStock = stock !== undefined && stock !== null;
                  const threshold = p.low_stock_threshold;
                  const isLow =
                    hasStock &&
                    threshold !== null &&
                    threshold !== undefined &&
                    parseFloat(stock) <= parseFloat(threshold);
                  const unit = unitMap.get(p.unit);

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 font-bold text-sm shrink-0">
                            {(p.name || '?').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 truncate">{p.name || '—'}</p>
                            <p className="text-xs text-slate-400 truncate">{p.sku || 'No SKU'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">
                        {categoryMap.get(p.category) || '—'}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">
                        {brandMap.get(p.brand) || '—'}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">
                        {unit ? unit.short_code || unit.name : '—'}
                      </td>
                      <td className="px-4 py-3.5 text-right text-slate-700 font-medium whitespace-nowrap">
                        {fmtCurrency(p.current_selling_price)}
                      </td>
                      <td className="px-4 py-3.5 text-right text-slate-500 whitespace-nowrap">
                        {fmtQty(p.low_stock_threshold)}
                      </td>
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        {hasStock ? (
                          <span className="inline-flex items-center gap-2">
                            <span className={isLow ? 'text-red-600 font-semibold' : 'text-slate-700 font-medium'}>
                              {fmtQty(stock)}
                            </span>
                            {isLow && (
                              <span className="text-[10px] uppercase tracking-wide font-semibold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">
                                Low
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setModal({ mode: 'edit', product: p })}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="Edit product"
                            aria-label={`Edit ${p.name}`}
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeactivateTarget(p)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Deactivate product"
                            aria-label={`Deactivate ${p.name}`}
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && visibleProducts.length > ROWS_PER_PAGE && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50">
            <p className="text-xs text-slate-500">
              Showing {(safePage - 1) * ROWS_PER_PAGE + 1}–
              {Math.min(safePage * ROWS_PER_PAGE, visibleProducts.length)} of {visibleProducts.length}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage(Math.max(1, safePage - 1))}
                disabled={safePage === 1}
                className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                ← Previous
              </button>
              <span className="text-xs text-slate-600 font-medium">
                Page {safePage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage(Math.min(totalPages, safePage + 1))}
                disabled={safePage === totalPages}
                className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {modal && (
        <ProductFormModal
          key={`${modal.mode}-${modal.product?.id ?? 'new'}`}
          api={api}
          mode={modal.mode}
          product={modal.product}
          categories={categories}
          brands={brands}
          units={units}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
          onLookupCreated={handleLookupCreated}
        />
      )}

      {deactivateTarget && (
        <DeactivateModal
          api={api}
          product={deactivateTarget}
          onClose={() => setDeactivateTarget(null)}
          onDeactivated={handleDeactivated}
        />
      )}
    </div>
  );
}
