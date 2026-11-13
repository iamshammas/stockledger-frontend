import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { API_ENDPOINTS } from '../../config/api';
import LookupFormModal from './LookupFormModal';
import { errorMessage, fieldBase } from './lookups';

const PRODUCT_FIELDS = [
  'name',
  'category',
  'brand',
  'unit',
  'sku',
  'current_selling_price',
  'low_stock_threshold',
];

const amountRule = (label) => ({
  validate: (value) => {
    if (value === '' || value === null || value === undefined) return true;
    const num = Number(value);
    if (Number.isNaN(num)) return `Enter a valid ${label}`;
    if (num < 0) return `${label} cannot be negative`;
    return true;
  },
});

// Create or edit a product. Quick-adds category / brand / unit inline.
export default function ProductFormModal({
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

  // Quick-added lookups are merged into this modal's own option lists so the
  // new <option> and the selected value land in the same React commit. Writing
  // the value while the option is still missing lets the browser clamp the
  // select back to "", which is what kept "Category is required" on screen.
  const [quickAddItems, setQuickAddItems] = useState({
    category: null,
    brand: null,
    unit: null,
  });

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    clearErrors,
    control,
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

  // Lookup selects render through <Controller> so the value is applied by
  // React, and the option list includes anything just quick-added.
  const optionRows = (type, list) => {
    const extra = quickAddItems[type];
    return extra && !list.some((row) => row.id === extra.id) ? [...list, extra] : list;
  };

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
    const field = quickAdd;
    if (!field) return;

    onLookupCreated(field, item);
    setQuickAddItems((prev) => ({ ...prev, [field]: item }));
    setValue(field, String(item.id), { shouldDirty: true });
    clearErrors(field);
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
                <Controller
                  control={control}
                  name="category"
                  rules={{ required: 'Category is required' }}
                  render={({ field }) => (
                    <select
                      id="product-category"
                      {...field}
                      className={`${fieldBase} ${errors.category ? 'border-red-300 bg-red-50' : 'border-slate-300'}`}
                    >
                      <option value="">Select category</option>
                      {optionRows('category', categories).map((c) => (
                        <option key={c.id} value={String(c.id)}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  )}
                />
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
                <Controller
                  control={control}
                  name="brand"
                  render={({ field }) => (
                    <select
                      id="product-brand"
                      {...field}
                      className={`${fieldBase} ${errors.brand ? 'border-red-300 bg-red-50' : 'border-slate-300'}`}
                    >
                      <option value="">No brand</option>
                      {optionRows('brand', brands).map((b) => (
                        <option key={b.id} value={String(b.id)}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  )}
                />
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
                <Controller
                  control={control}
                  name="unit"
                  rules={{ required: 'Unit is required' }}
                  render={({ field }) => (
                    <select
                      id="product-unit"
                      {...field}
                      className={`${fieldBase} ${errors.unit ? 'border-red-300 bg-red-50' : 'border-slate-300'}`}
                    >
                      <option value="">Select unit</option>
                      {optionRows('unit', units).map((u) => (
                        <option key={u.id} value={String(u.id)}>
                          {u.short_code ? `${u.name} (${u.short_code})` : u.name}
                        </option>
                      ))}
                    </select>
                  )}
                />
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
        <LookupFormModal
          api={api}
          type={quickAdd}
          subtitle="Saved to your catalog and selected for this product."
          onClose={() => setQuickAdd(null)}
          onSaved={handleQuickAddCreated}
        />
      )}
    </>
  );
}
