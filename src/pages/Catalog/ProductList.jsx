import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAxios } from '../../hooks/useAxios';
import { API_ENDPOINTS } from '../../config/api';
import LookupFormModal from '../../components/catalog/LookupFormModal';
import ProductFormModal from '../../components/catalog/ProductFormModal';
import { QUICK_ADD_META, errorMessage, fieldBase } from '../../components/catalog/lookups';

// The backend paginates every list endpoint at 10 rows per page.
const SERVER_PAGE_SIZE = 10;
const ROWS_PER_PAGE = 20;

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

// ── Delete a lookup (blocked while products reference it) ──
function LookupDeleteModal({ api, type, item, usedBy, onClose, onDeleted }) {
  const meta = QUICK_ADD_META[type];
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState('');
  const blocked = usedBy > 0;

  const confirm = async () => {
    if (blocked) return;

    setBusy(true);
    setServerError('');

    try {
      await api.delete(`${meta.endpoint}${item.id}/`);
      onDeleted(item.id);
    } catch (err) {
      const res = err.response;

      if (!res) {
        setServerError('Unable to connect to the server. Please try again.');
        return;
      }
      if (res.status === 401) return; // interceptor handles logout
      if (res.status === 403) {
        setServerError(`You do not have permission to delete this ${meta.singular}.`);
        return;
      }

      setServerError(
        errorMessage(res.data?.detail) ||
          `This ${meta.singular} could not be deleted. It may still be in use.`
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50"
      onClick={busy ? undefined : onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lookup-delete-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-5">
          <div className="flex items-start gap-3">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                blocked ? 'bg-amber-50' : 'bg-red-50'
              }`}
            >
              <svg
                className={`w-5 h-5 ${blocked ? 'text-amber-500' : 'text-red-500'}`}
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.8}
                stroke="currentColor"
              >
                {blocked ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                  />
                )}
              </svg>
            </div>
            <div className="min-w-0">
              <h2 id="lookup-delete-title" className="text-base font-semibold text-slate-900">
                {blocked ? `Cannot delete ${meta.singular}` : `Delete ${meta.singular}`}
              </h2>
              {blocked ? (
                <p className="text-sm text-slate-600 mt-1">
                  <span className="font-medium text-slate-900">{item.name}</span> is used by{' '}
                  {usedBy} product{usedBy !== 1 ? 's' : ''}. Reassign or delete those products
                  before removing this {meta.singular}.
                </p>
              ) : (
                <p className="text-sm text-slate-600 mt-1">
                  <span className="font-medium text-slate-900">{item.name}</span> will be
                  permanently deleted. This cannot be undone.
                </p>
              )}
            </div>
          </div>

          {serverError && (
            <div
              className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg"
              role="alert"
            >
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
              {blocked ? 'Close' : 'Cancel'}
            </button>
            {!blocked && (
              <button
                type="button"
                onClick={confirm}
                disabled={busy}
                className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 rounded-lg shadow-md shadow-red-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                {busy ? 'Deleting...' : 'Delete'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Manage one lookup type (categories / brands / units) ──
function LookupManager({ api, type, rows, products, onSaved, onDeleted }) {
  const meta = QUICK_ADD_META[type];
  const [search, setSearch] = useState('');
  const [formState, setFormState] = useState(null); // null | { item: row | null }
  const [deleteTarget, setDeleteTarget] = useState(null);

  // How many products reference each lookup row, derived client-side.
  const usageById = useMemo(() => {
    const counts = new Map();
    products.forEach((p) => {
      const id = p[type];
      if (id === null || id === undefined) return;
      counts.set(id, (counts.get(id) || 0) + 1);
    });
    return counts;
  }, [products, type]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = query
      ? rows.filter((row) => (row.name || '').toLowerCase().includes(query))
      : rows;
    return [...list].sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
    );
  }, [rows, search]);

  const handleSaved = (item, isEdit) => {
    onSaved(type, item, isEdit);
    setFormState(null);
  };

  const handleDeleted = (id) => {
    onDeleted(type, id);
    setDeleteTarget(null);
  };

  const pluralLower = meta.plural.toLowerCase();

  return (
    <div>
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">{meta.plural}</h2>
            <p className="text-xs text-slate-500">
              {rows.length} {pluralLower} · used across your products
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.6}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${pluralLower}...`}
                className="w-full sm:w-56 pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 focus:bg-white transition-all"
                aria-label={`Search ${pluralLower}`}
              />
            </div>
            <button
              type="button"
              onClick={() => setFormState({ item: null })}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white text-sm font-semibold rounded-lg shadow-md shadow-blue-500/25 transition-all cursor-pointer whitespace-nowrap"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add {meta.singular}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                <th className="px-4 py-3">Name</th>
                {meta.hasShortCode && <th className="px-4 py-3">Short code</th>}
                <th className="px-4 py-3 text-right">Products</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={meta.hasShortCode ? 4 : 3} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.4} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-600">
                          {search ? `No ${pluralLower} match your search` : `No ${pluralLower} yet`}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {search
                            ? 'Try a different search term'
                            : `Add your first ${meta.singular} to organise your catalog`}
                        </p>
                      </div>
                      {!search && (
                        <button
                          type="button"
                          onClick={() => setFormState({ item: null })}
                          className="text-sm font-medium text-blue-600 hover:text-blue-700 cursor-pointer"
                        >
                          + Add {meta.singular}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                visible.map((row) => {
                  const usedBy = usageById.get(row.id) || 0;

                  return (
                    <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 font-bold text-sm shrink-0">
                            {(row.name || '?').charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-slate-900">{row.name || '—'}</span>
                        </div>
                      </td>
                      {meta.hasShortCode && (
                        <td className="px-4 py-3.5 text-slate-600">{row.short_code || '—'}</td>
                      )}
                      <td className="px-4 py-3.5 text-right">
                        {usedBy > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                            {usedBy} product{usedBy !== 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">Unused</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setFormState({ item: row })}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title={`Edit ${meta.singular}`}
                            aria-label={`Edit ${row.name}`}
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(row)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title={`Delete ${meta.singular}`}
                            aria-label={`Delete ${row.name}`}
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
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
      </div>

      {formState && (
        <LookupFormModal
          api={api}
          type={type}
          item={formState.item}
          onClose={() => setFormState(null)}
          onSaved={handleSaved}
        />
      )}

      {deleteTarget && (
        <LookupDeleteModal
          api={api}
          type={type}
          item={deleteTarget}
          usedBy={usageById.get(deleteTarget.id) || 0}
          onClose={() => setDeleteTarget(null)}
          onDeleted={handleDeleted}
        />
      )}
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
  const [tab, setTab] = useState('products'); // products | category | brand | unit

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

  const handleLookupSaved = useCallback((type, item, isEdit) => {
    const apply = (prev) =>
      isEdit ? prev.map((row) => (row.id === item.id ? item : row)) : [...prev, item];

    if (type === 'category') setCategories(apply);
    else if (type === 'brand') setBrands(apply);
    else if (type === 'unit') setUnits(apply);

    const meta = QUICK_ADD_META[type];
    const label = meta.singular.charAt(0).toUpperCase() + meta.singular.slice(1);
    setNotice(`${label} "${item.name}" ${isEdit ? 'updated' : 'created'}.`);
  }, []);

  const handleLookupDeleted = useCallback((type, id) => {
    const meta = QUICK_ADD_META[type];
    const label = meta.singular.charAt(0).toUpperCase() + meta.singular.slice(1);

    if (type === 'category') {
      setCategories((prev) => prev.filter((row) => row.id !== id));
      setCategoryFilter((prev) => (prev === String(id) ? 'all' : prev));
    } else if (type === 'brand') {
      setBrands((prev) => prev.filter((row) => row.id !== id));
      setBrandFilter((prev) => (prev === String(id) ? 'all' : prev));
    } else if (type === 'unit') {
      setUnits((prev) => prev.filter((row) => row.id !== id));
    }

    setNotice(`${label} deleted.`);
  }, []);

  const tabs = [
    { key: 'products', label: 'Products', count: products.length },
    { key: 'category', label: 'Categories', count: categories.length },
    { key: 'brand', label: 'Brands', count: brands.length },
    { key: 'unit', label: 'Units', count: units.length },
  ];
  const activeTab = tabs.find((t) => t.key === tab) ?? tabs[0];

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Catalog</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {tab === 'products'
              ? `${visibleProducts.length} product${visibleProducts.length !== 1 ? 's' : ''}${
                  hasFilters && products.length !== visibleProducts.length
                    ? ` matching filters (of ${products.length})`
                    : ' in your catalog'
                }`
              : `${activeTab.count} ${activeTab.label.toLowerCase()}`}
          </p>
        </div>
        {tab === 'products' && (
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
        )}
      </div>

      {/* Section tabs */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-xl mb-5 w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            aria-pressed={tab === t.key}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
              tab === t.key
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.label}
            <span
              className={`text-[11px] px-1.5 py-0.5 rounded-full ${
                tab === t.key ? 'bg-blue-50 text-blue-600' : 'bg-slate-200 text-slate-500'
              }`}
            >
              {t.count}
            </span>
          </button>
        ))}
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

      {tab === 'products' && (
        <>
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
        </>
      )}

      {tab !== 'products' && (
        <LookupManager
          api={api}
          type={tab}
          rows={tab === 'category' ? categories : tab === 'brand' ? brands : units}
          products={products}
          onSaved={handleLookupSaved}
          onDeleted={handleLookupDeleted}
        />
      )}

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
