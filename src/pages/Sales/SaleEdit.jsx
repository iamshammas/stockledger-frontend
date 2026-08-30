import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAxios } from '../../hooks/useAxios';
import { API_ENDPOINTS } from '../../config/api';

const fmt = (val) => {
  const num = parseFloat(val);
  if (isNaN(num)) return '₹0.00';
  return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const EMPTY_ITEM = { product_id: '', product_name: '', quantity: '', unit_price: '', subtotal: 0 };

export default function SaleEdit() {
  const { id } = useParams();
  const api = useAxios();
  const navigate = useNavigate();

  const { register, handleSubmit, formState: { errors }, setValue } = useForm({
    defaultValues: { retailer_id: '', notes: '' },
  });

  const [retailers, setRetailers] = useState([]);
  const [products, setProducts] = useState([]);
  const [items, setItems] = useState([{ ...EMPTY_ITEM }]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [apiError, setApiError] = useState('');
  const [itemErrors, setItemErrors] = useState('');
  const [originalTotal, setOriginalTotal] = useState(0);
  const [invoiceNumber, setInvoiceNumber] = useState('');

  // Fetch retailers, products, and existing sale
  useEffect(() => {
    Promise.all([
      api.get(API_ENDPOINTS.RETAILERS_LIST).then((r) => {
        const data = Array.isArray(r.data) ? r.data : r.data?.results ?? [];
        setRetailers(data);
      }),
      api.get(API_ENDPOINTS.PRODUCTS_LIST, { params: { limit: 200 } }).then((r) => {
        const data = Array.isArray(r.data) ? r.data : r.data?.results ?? [];
        setProducts(data);
      }),
    ])
      .then(() => fetchSale())
      .catch(() => setPageLoading(false));
  }, []);

  async function fetchSale() {
    try {
      const res = await api.get(API_ENDPOINTS.SALE_DETAIL(id));
      const sale = res.data;

      setValue('retailer_id', String(sale.retailer?.id || sale.retailer || ''));
      setValue('notes', sale.notes || '');
      setInvoiceNumber(sale.invoice_number || `#${sale.id}`);
      setOriginalTotal(parseFloat(sale.total_amount || sale.total || 0));

      // Map existing line items
      const saleItems = (sale.items || []).map((item) => ({
        product_id: String(item.product?.id || item.product || ''),
        product_name: item.product?.name || item.product_name || '',
        quantity: String(item.quantity || ''),
        unit_price: String(item.unit_price || item.price || ''),
        subtotal: (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price || item.price) || 0),
      }));

      setItems(saleItems.length > 0 ? saleItems : [{ ...EMPTY_ITEM }]);
    } catch (err) {
      setApiError(err.response?.status === 404 ? 'Invoice not found' : 'Failed to load invoice');
    } finally {
      setPageLoading(false);
    }
  }

  // Line item helpers
  const updateItem = (index, field, value) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };

      if (field === 'product_id' && value) {
        const product = products.find((p) => String(p.id) === String(value));
        if (product) {
          updated[index].product_name = product.name;
          updated[index].unit_price = product.selling_price || product.price || '';
        }
      }

      const qty = parseFloat(updated[index].quantity) || 0;
      const price = parseFloat(updated[index].unit_price) || 0;
      updated[index].subtotal = qty * price;
      return updated;
    });
  };

  const addItem = () => setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  const removeItem = (index) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const subtotal = items.reduce((sum, item) => sum + (item.subtotal || 0), 0);
  const total = subtotal;
  const totalDiff = total - originalTotal;

  // Submit
  const onSubmit = async (data) => {
    const validItems = items.filter((i) => i.product_id && parseFloat(i.quantity) > 0);
    if (validItems.length === 0) {
      setItemErrors('Add at least one line item with a product and quantity');
      return;
    }
    setItemErrors('');
    setApiError('');
    setIsSubmitting(true);

    try {
      const payload = {
        retailer: parseInt(data.retailer_id),
        notes: data.notes || '',
        items: validItems.map((i) => ({
          product: parseInt(i.product_id),
          quantity: parseFloat(i.quantity),
          unit_price: parseFloat(i.unit_price),
        })),
      };

      await api.patch(API_ENDPOINTS.SALE_DETAIL(id), payload);
      navigate(`/sales/${id}`, { replace: true });
    } catch (err) {
      if (!err.response) {
        setApiError('Unable to connect to server');
      } else if (err.response.status === 400) {
        const d = err.response.data;
        if (typeof d === 'string') setApiError(d);
        else if (d?.detail) setApiError(d.detail);
        else if (d?.non_field_errors) setApiError(d.non_field_errors.join(', '));
        else if (d?.items) {
          const msgs = Array.isArray(d.items)
            ? d.items.map((e, i) => {
                if (typeof e === 'string') return `Item ${i + 1}: ${e}`;
                return Object.entries(e).map(([k, v]) => `Item ${i + 1} ${k}: ${v}`).join(', ');
              }).filter(Boolean).join('; ')
            : JSON.stringify(d.items);
          setApiError(msgs || 'Validation error in line items');
        } else {
          const msgs = Object.entries(d).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('; ');
          setApiError(msgs || 'Validation error');
        }
      } else {
        setApiError('Failed to update invoice');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading state
  if (pageLoading) {
    return (
      <div className="max-w-4xl">
        <div className="animate-pulse space-y-5">
          <div className="h-8 w-48 bg-slate-200 rounded" />
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="h-5 w-32 bg-slate-100 rounded" />
            <div className="grid grid-cols-2 gap-4">
              <div className="h-10 bg-slate-100 rounded-lg" />
              <div className="h-10 bg-slate-100 rounded-lg" />
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-slate-100 rounded-lg" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Edit Invoice</h1>
          <p className="text-sm text-slate-500 mt-0.5">{invoiceNumber}</p>
        </div>
        <button
          onClick={() => navigate(`/sales/${id}`)}
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
        {/* Customer + Notes */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 mb-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Invoice Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="retailer_id" className="block text-sm font-medium text-slate-700 mb-1.5">
                Customer <span className="text-red-500">*</span>
              </label>
              <select
                id="retailer_id"
                {...register('retailer_id', { required: 'Customer is required' })}
                className={`w-full px-3 py-2.5 bg-slate-50 border rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 focus:bg-white transition-all cursor-pointer ${errors.retailer_id ? 'border-red-400' : 'border-slate-200'}`}
              >
                <option value="">Select customer...</option>
                {retailers.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.shop_name || r.name} {r.contact_person ? `(${r.contact_person})` : ''}
                  </option>
                ))}
              </select>
              {errors.retailer_id && (
                <p className="mt-1.5 text-xs text-red-600">{errors.retailer_id.message}</p>
              )}
            </div>
            <div>
              <label htmlFor="sale-notes" className="block text-sm font-medium text-slate-700 mb-1.5">
                Notes <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <textarea
                id="sale-notes"
                rows={2}
                {...register('notes')}
                placeholder="Any notes for this invoice..."
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 focus:bg-white transition-all resize-none"
              />
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mb-5">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Line Items</h2>
            <button
              type="button"
              onClick={addItem}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add Item
            </button>
          </div>

          {itemErrors && (
            <div className="mx-5 mt-4 text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{itemErrors}</div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  <th className="px-4 py-2.5 w-[35%]">Product</th>
                  <th className="px-4 py-2.5 w-[15%]">Qty</th>
                  <th className="px-4 py-2.5 w-[18%]">Unit Price</th>
                  <th className="px-4 py-2.5 w-[18%] text-right">Subtotal</th>
                  <th className="px-4 py-2.5 w-[14%]"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item, index) => (
                  <tr key={index} className="group">
                    <td className="px-4 py-3">
                      <select
                        value={item.product_id}
                        onChange={(e) => updateItem(index, 'product_id', e.target.value)}
                        className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 focus:bg-white transition-all cursor-pointer"
                      >
                        <option value="">Select product...</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} {p.sku ? `(${p.sku})` : ''}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number" min="0" step="any"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                        placeholder="0"
                        className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 focus:bg-white transition-all"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number" min="0" step="any"
                        value={item.unit_price}
                        onChange={(e) => updateItem(index, 'unit_price', e.target.value)}
                        placeholder="0.00"
                        className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 focus:bg-white transition-all"
                      />
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-900">
                      {fmt(item.subtotal)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        disabled={items.length <= 1}
                        className="p-1.5 rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                        title="Remove"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals with comparison */}
          <div className="border-t border-slate-100 px-5 py-4">
            <div className="flex justify-end">
              <div className="w-72 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Original Total</span>
                  <span className="font-medium text-slate-400 line-through">{fmt(originalTotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">New Subtotal</span>
                  <span className="font-medium text-slate-700">{fmt(subtotal)}</span>
                </div>
                <div className="flex justify-between text-base font-bold border-t border-slate-200 pt-2">
                  <span className="text-slate-900">New Total</span>
                  <span className="text-slate-900">{fmt(total)}</span>
                </div>
                {totalDiff !== 0 && (
                  <div className={`flex justify-between text-xs ${totalDiff > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    <span>Difference</span>
                    <span className="font-medium">{totalDiff > 0 ? '+' : ''}{fmt(totalDiff)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate(`/sales/${id}`)}
            className="px-5 py-2.5 text-sm font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            id="update-invoice-btn"
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-semibold rounded-lg shadow-md shadow-blue-500/25 transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Updating...
              </>
            ) : (
              'Update Invoice'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
