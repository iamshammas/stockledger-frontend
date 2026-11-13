import { Fragment, useState, useEffect, useMemo, useCallback } from 'react';
import { useAxios } from '../../hooks/useAxios';
import { API_ENDPOINTS } from '../../config/api';
import { useNavigate } from 'react-router-dom';
import SupplierFormModal from '../../components/inventory/SupplierFormModal';
import { buildPoNumbers } from '../../utils/poNumber';

// DRF PageNumberPagination returns PAGE_SIZE = 10 rows per page.
const SERVER_PAGE_SIZE = 10;
// Browser-side page size for the purchases table.
const ROWS_PER_PAGE = 20;

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

const qtyOf = (purchase) =>
  (purchase.items || []).reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);

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

// ── Small presentational pieces ──
function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {[16, 24, 40, 12, 12, 20, 32, 8].map((w, i) => (
        <td key={i} className="px-4 py-4">
          <div className="h-4 bg-slate-100 rounded" style={{ width: `${w * 4}px` }} />
        </td>
      ))}
    </tr>
  );
}

function EmptyState({ filtered, onClear }) {
  return (
    <div className="px-5 py-16 text-center">
      <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
        </svg>
      </div>
      <h3 className="text-sm font-semibold text-slate-900">
        {filtered ? 'No purchases match your filters' : 'No purchases yet'}
      </h3>
      <p className="text-sm text-slate-500 mt-1">
        {filtered
          ? 'Try a different supplier, PO number, or date range.'
          : 'Purchases you record will appear here as incoming stock batches.'}
      </p>
      {filtered && (
        <button
          onClick={onClear}
          className="mt-5 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

// ── Supplier delete (blocked while purchases reference it) ──
function SupplierDeleteModal({ api, supplier, usedBy, onClose, onDeleted }) {
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState('');
  const blocked = usedBy > 0;

  const confirm = async () => {
    if (blocked) return;

    setBusy(true);
    setServerError('');

    try {
      await api.delete(`${API_ENDPOINTS.SUPPLIERS_LIST}${supplier.id}/`);
      onDeleted(supplier.id);
    } catch (err) {
      const res = err.response;

      if (!res) {
        setServerError('Unable to connect to the server. Please try again.');
        return;
      }
      if (res.status === 401) return; // interceptor handles logout
      if (res.status === 403) {
        setServerError('You do not have permission to delete this supplier.');
        return;
      }

      setServerError(
        res.data?.detail || 'This supplier could not be deleted. It may still be in use.'
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
        aria-labelledby="supplier-delete-title"
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
              <h2 id="supplier-delete-title" className="text-base font-semibold text-slate-900">
                {blocked ? 'Cannot delete supplier' : 'Delete supplier'}
              </h2>
              {blocked ? (
                <p className="text-sm text-slate-600 mt-1">
                  <span className="font-medium text-slate-900">{supplier.name}</span> is used by{' '}
                  {usedBy} purchase{usedBy !== 1 ? 's' : ''}. Reassign those purchases before
                  removing this supplier.
                </p>
              ) : (
                <p className="text-sm text-slate-600 mt-1">
                  <span className="font-medium text-slate-900">{supplier.name}</span> will be
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

// ── Suppliers tab: list + create / edit / delete ──
function SuppliersTab({ api, suppliers, purchases, onSaved, onDeleted }) {
  const [search, setSearch] = useState('');
  const [formState, setFormState] = useState(null); // null | { item: supplier | null }
  const [deleteTarget, setDeleteTarget] = useState(null);

  // How many purchases reference each supplier, derived client-side.
  const usageById = useMemo(() => {
    const counts = new Map();
    purchases.forEach((purchase) => {
      const id = purchase.supplier;
      if (id === null || id === undefined) return;
      counts.set(id, (counts.get(id) || 0) + 1);
    });
    return counts;
  }, [purchases]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = query
      ? suppliers.filter(
          (row) =>
            (row.name || '').toLowerCase().includes(query) ||
            (row.phone || '').toLowerCase().includes(query)
        )
      : suppliers;
    return [...list].sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
    );
  }, [suppliers, search]);

  const handleSaved = (item, isEdit) => {
    onSaved(item, isEdit);
    setFormState(null);
  };

  const handleDeleted = (id) => {
    onDeleted(id);
    setDeleteTarget(null);
  };

  return (
    <div>
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Suppliers</h2>
            <p className="text-xs text-slate-500">
              {suppliers.length} supplier{suppliers.length === 1 ? '' : 's'} · reused on purchases
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
                placeholder="Search suppliers..."
                className="w-full sm:w-56 pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 focus:bg-white transition-all"
                aria-label="Search suppliers"
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
              Add supplier
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3 text-right">Purchases</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.4} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-600">
                          {search ? 'No suppliers match your search' : 'No suppliers yet'}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {search
                            ? 'Try a different search term'
                            : 'Add your first supplier to reuse it on purchases'}
                        </p>
                      </div>
                      {!search && (
                        <button
                          type="button"
                          onClick={() => setFormState({ item: null })}
                          className="text-sm font-medium text-blue-600 hover:text-blue-700 cursor-pointer"
                        >
                          + Add supplier
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
                      <td className="px-4 py-3.5 text-slate-600">{row.phone || '—'}</td>
                      <td className="px-4 py-3.5 text-right">
                        {usedBy > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                            {usedBy} purchase{usedBy !== 1 ? 's' : ''}
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
                            title="Edit supplier"
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
                            title="Delete supplier"
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
        <SupplierFormModal
          api={api}
          item={formState.item}
          onClose={() => setFormState(null)}
          onSaved={handleSaved}
        />
      )}

      {deleteTarget && (
        <SupplierDeleteModal
          api={api}
          supplier={deleteTarget}
          usedBy={usageById.get(deleteTarget.id) || 0}
          onClose={() => setDeleteTarget(null)}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}

export default function PurchaseList() {
  const api = useAxios();

  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lookupWarning, setLookupWarning] = useState('');

  const [activeTab, setActiveTab] = useState('purchases');
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [sortDesc, setSortDesc] = useState(true);
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState(null);

  const navigate = useNavigate()

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setLookupWarning('');

    const [purchasesRes, suppliersRes, productsRes] = await Promise.allSettled([
      fetchAll(api, API_ENDPOINTS.PURCHASES_LIST),
      fetchAll(api, API_ENDPOINTS.SUPPLIERS_LIST),
      fetchAll(api, API_ENDPOINTS.PRODUCTS_LIST),
    ]);

    if (purchasesRes.status === 'rejected') {
      const err = purchasesRes.reason;
      if (err?.response?.status !== 401) {
        setError(err?.response?.data?.detail || 'Failed to load purchases. Please try again.');
      }
      setLoading(false);
      return;
    }

    const suppliersOk = suppliersRes.status === 'fulfilled';
    const productsOk = productsRes.status === 'fulfilled';

    setPurchases(purchasesRes.value);
    setSuppliers(suppliersOk ? suppliersRes.value : []);
    setProducts(productsOk ? productsRes.value : []);

    if (!suppliersOk || !productsOk) {
      const label = !suppliersOk && !productsOk ? 'Supplier and product' : !suppliersOk ? 'Supplier' : 'Product';
      setLookupWarning(
        `${label} lookup failed — some names will show as “—”. Purchase totals are still accurate.`
      );
    }

    setLoading(false);
  }, [api]);

  useEffect(() => {
    // Deferred so the initial fetch does not cascade a synchronous render.
    const timer = setTimeout(() => {
      load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  // ── Lookup maps (client-side joins) ──
  const supplierById = useMemo(() => new Map(suppliers.map((s) => [s.id, s])), [suppliers]);
  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  // Frontend PO labels: chronological sequence over all purchases.
  const poNumberById = useMemo(() => buildPoNumbers(purchases), [purchases]);

  // ── Filter + sort (all client-side) ──
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const from = fromDate ? new Date(`${fromDate}T00:00:00`) : null;
    const to = toDate ? new Date(`${toDate}T23:59:59`) : null;

    const rows = purchases.filter((purchase) => {
      const supplierName = (supplierById.get(purchase.supplier)?.name || '').toLowerCase();
      const notes = (purchase.notes || '').toLowerCase();
      const poLabel = (poNumberById.get(purchase.id) || '').toLowerCase();
      const matchesTerm =
        !term ||
        supplierName.includes(term) ||
        notes.includes(term) ||
        poLabel.includes(term) ||
        `#${purchase.id}`.includes(term) ||
        String(purchase.id).includes(term);

      if (!matchesTerm) return false;

      if (from || to) {
        const date = purchase.purchase_date ? new Date(`${purchase.purchase_date}T00:00:00`) : null;
        if (!date || Number.isNaN(date.getTime())) return false;
        if (from && date < from) return false;
        if (to && date > to) return false;
      }

      return true;
    });

    rows.sort((a, b) => {
      const da = a.purchase_date || '';
      const db = b.purchase_date || '';
      if (da === db) return sortDesc ? b.id - a.id : a.id - b.id;
      return sortDesc ? db.localeCompare(da) : da.localeCompare(db);
    });

    return rows;
  }, [purchases, supplierById, poNumberById, search, fromDate, toDate, sortDesc]);

  const totalAmount = useMemo(
    () => filtered.reduce((sum, p) => sum + (parseFloat(p.total_amount) || 0), 0),
    [filtered]
  );

  const totalQty = useMemo(() => filtered.reduce((sum, p) => sum + qtyOf(p), 0), [filtered]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);

  // ── FIFO batches, derived from purchase history ──
  // Each purchase line is stored as a FIFO layer on the backend
  // (PurchaseItem.remaining_quantity), but that field is not exposed by the
  // API. So: group every purchased line by product, oldest purchase first.
  const batchGroups = useMemo(() => {
    const groups = new Map();

    purchases.forEach((purchase) => {
      const supplierName = supplierById.get(purchase.supplier)?.name || '—';

      (purchase.items || []).forEach((item) => {
        const key = item.product;
        const quantity = parseFloat(item.quantity) || 0;
        const buyingPrice = parseFloat(item.buying_price) || 0;
        const sellingPrice = parseFloat(item.selling_price) || 0;
        const product = productById.get(key);

        const group = groups.get(key) || {
          productId: key,
          productName: product?.name || `Product #${key}`,
          sku: product?.sku || '',
          batches: [],
          totalQty: 0,
          totalValue: 0,
        };

        group.batches.push({
          purchaseId: purchase.id,
          date: purchase.purchase_date,
          supplierName,
          quantity,
          buyingPrice,
          sellingPrice,
          value: quantity * buyingPrice,
        });
        group.totalQty += quantity;
        group.totalValue += quantity * buyingPrice;

        groups.set(key, group);
      });
    });

    const list = [...groups.values()];

    list.forEach((group) => {
      group.batches.sort((a, b) => {
        const da = a.date || '';
        const db = b.date || '';
        if (da === db) return a.purchaseId - b.purchaseId;
        return da.localeCompare(db);
      });
      group.avgCost = group.totalQty > 0 ? group.totalValue / group.totalQty : 0;
    });

    list.sort((a, b) => a.productName.localeCompare(b.productName));
    return list;
  }, [purchases, supplierById, productById]);

  const hasFilters = Boolean(search || fromDate || toDate);

  const clearFilters = () => {
    setSearch('');
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  const handleSearch = (value) => {
    setSearch(value);
    setPage(1);
  };

  const toggleRow = (id) => {
    setExpandedId((current) => (current === id ? null : id));
  };

  const handleSupplierSaved = (item, isEdit) => {
    setSuppliers((current) =>
      isEdit
        ? current.map((row) => (row.id === item.id ? item : row))
        : current.some((row) => row.id === item.id)
          ? current
          : [...current, item]
    );
  };

  const handleSupplierDeleted = (id) => {
    setSuppliers((current) => current.filter((row) => row.id !== id));
  };

  // ── Loading ──
  if (loading) {
    return (
      <div>
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="h-8 w-40 bg-slate-100 rounded animate-pulse" />
            <div className="h-4 w-64 bg-slate-100 rounded mt-2 animate-pulse" />
          </div>
          <div className="h-10 w-36 bg-slate-100 rounded-lg animate-pulse" />
        </div>
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="h-16 border-b border-slate-100 bg-slate-50/60 animate-pulse" />
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {[...Array(6)].map((_, i) => (
                <SkeletonRow key={i} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <div className="max-w-lg mx-auto mt-16">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-8 text-center">
          <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-slate-900">Could not load purchases</h1>
          <p className="text-sm text-slate-500 mt-1">{error}</p>
          <button
            onClick={load}
            className="mt-5 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 rounded-lg shadow-md shadow-blue-500/25 transition-all cursor-pointer"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {activeTab === 'suppliers' ? 'Suppliers' : 'Purchases'}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {activeTab === 'suppliers'
              ? `${suppliers.length} supplier${suppliers.length === 1 ? '' : 's'} · reused across purchases`
              : `${filtered.length} purchase${filtered.length === 1 ? '' : 's'} · ${fmtQty(totalQty)} units · ${fmtCurrency(totalAmount)} total`}
          </p>
        </div>
        <button
          type="button"
          title="Create a new Purchase"
          onClick={() => navigate('/inventory/create')}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg shadow-md shadow-blue-500/25 cursor-pointer transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Purchase
        </button>
      </div>

      {lookupWarning && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg" role="status">
          {lookupWarning}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg w-fit mb-4">
        <button
          onClick={() => setActiveTab('purchases')}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors cursor-pointer ${
            activeTab === 'purchases'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Purchases
          <span className="ml-2 text-xs text-slate-400">{purchases.length}</span>
        </button>
        <button
          onClick={() => setActiveTab('fifo')}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors cursor-pointer ${
            activeTab === 'fifo'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Batches (FIFO)
          <span className="ml-2 text-xs text-slate-400">{batchGroups.length}</span>
        </button>
        <button
          onClick={() => setActiveTab('suppliers')}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors cursor-pointer ${
            activeTab === 'suppliers'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Suppliers
          <span className="ml-2 text-xs text-slate-400">{suppliers.length}</span>
        </button>
      </div>

      {activeTab === 'purchases' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          {/* Filters */}
          <div className="p-4 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="relative flex-1 min-w-0">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search supplier, PO number, or notes..."
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="date"
                value={fromDate}
                max={toDate || undefined}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
                title="From date"
              />
              <span className="text-slate-400 text-sm">to</span>
              <input
                type="date"
                value={toDate}
                min={fromDate || undefined}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
                title="To date"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setSortDesc((d) => !d);
                  setPage(1);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 4.5h13.5M3 9.75h9M3 15h4.5" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9v10.5m0 0l3-3m-3 3l-3-3" />
                </svg>
                {sortDesc ? 'Newest first' : 'Oldest first'}
              </button>
              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="px-3 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState filtered={hasFilters || purchases.length > 0} onClear={clearFilters} />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-3 w-8" />
                      <th className="px-4 py-3">PO</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Supplier</th>
                      <th className="px-4 py-3 text-right">Items</th>
                      <th className="px-4 py-3 text-right">Qty</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                      <th className="px-4 py-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pageRows.map((purchase) => {
                      const supplier = supplierById.get(purchase.supplier);
                      const isOpen = expandedId === purchase.id;

                      return (
                        <Fragment key={purchase.id}>
                          <tr
                            onClick={() => toggleRow(purchase.id)}
                            className={`cursor-pointer transition-colors ${isOpen ? 'bg-blue-50/40' : 'hover:bg-slate-50'}`}
                          >
                            <td className="px-4 py-3">
                              <svg
                                className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth={2}
                                stroke="currentColor"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                              </svg>
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-900">
                              {poNumberById.get(purchase.id) ?? `#${purchase.id}`}
                            </td>
                            <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{fmtDate(purchase.purchase_date)}</td>
                            <td className="px-4 py-3 text-slate-700">
                              {purchase.supplier ? supplier?.name || `Supplier #${purchase.supplier}` : '—'}
                            </td>
                            <td className="px-4 py-3 text-right text-slate-600">{(purchase.items || []).length}</td>
                            <td className="px-4 py-3 text-right text-slate-600">{fmtQty(qtyOf(purchase))}</td>
                            <td className="px-4 py-3 text-right font-medium text-slate-900 whitespace-nowrap">
                              {fmtCurrency(purchase.total_amount)}
                            </td>
                            <td className="px-4 py-3 text-slate-500 max-w-[16rem] truncate" title={purchase.notes || ''}>
                              {purchase.notes || '—'}
                            </td>
                          </tr>

                          {isOpen && (
                            <tr className="bg-slate-50/60">
                              <td colSpan={8} className="px-4 py-4">
                                <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                                  <table className="w-full text-sm">
                                    <thead className="bg-slate-50 border-b border-slate-100">
                                      <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        <th className="px-4 py-2.5">Product</th>
                                        <th className="px-4 py-2.5 text-right">Quantity</th>
                                        <th className="px-4 py-2.5 text-right">Buying Price</th>
                                        <th className="px-4 py-2.5 text-right">Selling Price</th>
                                        <th className="px-4 py-2.5 text-right">Line Total</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {(purchase.items || []).length === 0 ? (
                                        <tr>
                                          <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                                            No line items on this purchase.
                                          </td>
                                        </tr>
                                      ) : (
                                        purchase.items.map((item, index) => {
                                          const product = productById.get(item.product);
                                          const quantity = parseFloat(item.quantity) || 0;
                                          const buyingPrice = parseFloat(item.buying_price) || 0;

                                          return (
                                            <tr key={`${purchase.id}-${item.product}-${index}`}>
                                              <td className="px-4 py-2.5">
                                                <span className="text-slate-900">
                                                  {product?.name || `Product #${item.product}`}
                                                </span>
                                                {product?.sku && (
                                                  <span className="ml-2 text-xs text-slate-400">{product.sku}</span>
                                                )}
                                              </td>
                                              <td className="px-4 py-2.5 text-right text-slate-600">{fmtQty(quantity)}</td>
                                              <td className="px-4 py-2.5 text-right text-slate-600">{fmtCurrency(buyingPrice)}</td>
                                              <td className="px-4 py-2.5 text-right text-slate-600">
                                                {fmtCurrency(item.selling_price)}
                                              </td>
                                              <td className="px-4 py-2.5 text-right font-medium text-slate-900">
                                                {fmtCurrency(quantity * buyingPrice)}
                                              </td>
                                            </tr>
                                          );
                                        })
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                                <p className="mt-2 text-xs text-slate-400">
                                  This purchase is recorded as an incoming stock batch (FIFO layer) on the backend.
                                </p>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="px-4 py-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <p className="text-sm text-slate-500">
                  Showing {(currentPage - 1) * ROWS_PER_PAGE + 1}–
                  {Math.min(currentPage * ROWS_PER_PAGE, filtered.length)} of {filtered.length}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-slate-600">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'fifo' && (
        /* ── FIFO batches ── */
        <div className="space-y-4">
          <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 text-sm rounded-lg" role="note">
            Batches are derived from purchase history, oldest first. Remaining quantity per batch is managed by the
            backend FIFO allocation and is not exposed by the API.
          </div>

          {batchGroups.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
              <EmptyState filtered={false} onClear={clearFilters} />
            </div>
          ) : (
            batchGroups.map((group) => (
              <div key={group.productId} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-slate-900 truncate">{group.productName}</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {group.sku ? `${group.sku} · ` : ''}
                      {group.batches.length} batch{group.batches.length === 1 ? '' : 'es'} · {fmtQty(group.totalQty)} units
                      purchased
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400">Weighted avg. cost</p>
                    <p className="text-sm font-semibold text-slate-900">{fmtCurrency(group.avgCost)}</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <th className="px-5 py-2.5">FIFO Order</th>
                        <th className="px-4 py-2.5">PO</th>
                        <th className="px-4 py-2.5">Purchased</th>
                        <th className="px-4 py-2.5">Supplier</th>
                        <th className="px-4 py-2.5 text-right">Quantity</th>
                        <th className="px-4 py-2.5 text-right">Buying Price</th>
                        <th className="px-4 py-2.5 text-right">Selling Price</th>
                        <th className="px-4 py-2.5 text-right">Batch Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {group.batches.map((batch, index) => (
                        <tr key={`${group.productId}-${batch.purchaseId}-${index}`} className="hover:bg-slate-50">
                          <td className="px-5 py-2.5 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                                index === 0
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-slate-100 text-slate-600 border-slate-200'
                              }`}
                            >
                              {index === 0 ? 'Oldest · sold first' : `#${index + 1}`}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 font-medium text-slate-900">
                            {poNumberById.get(batch.purchaseId) ?? `#${batch.purchaseId}`}
                          </td>
                          <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{fmtDate(batch.date)}</td>
                          <td className="px-4 py-2.5 text-slate-700">{batch.supplierName}</td>
                          <td className="px-4 py-2.5 text-right text-slate-600">{fmtQty(batch.quantity)}</td>
                          <td className="px-4 py-2.5 text-right text-slate-600">{fmtCurrency(batch.buyingPrice)}</td>
                          <td className="px-4 py-2.5 text-right text-slate-600">{fmtCurrency(batch.sellingPrice)}</td>
                          <td className="px-4 py-2.5 text-right font-medium text-slate-900">{fmtCurrency(batch.value)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t border-slate-100">
                      <tr>
                        <td colSpan={4} className="px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Total purchased
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold text-slate-900">{fmtQty(group.totalQty)}</td>
                        <td className="px-4 py-2.5" />
                        <td className="px-4 py-2.5" />
                        <td className="px-4 py-2.5 text-right font-semibold text-slate-900">
                          {fmtCurrency(group.totalValue)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'suppliers' && (
        <SuppliersTab
          api={api}
          suppliers={suppliers}
          purchases={purchases}
          onSaved={handleSupplierSaved}
          onDeleted={handleSupplierDeleted}
        />
      )}
    </div>
  );
}
