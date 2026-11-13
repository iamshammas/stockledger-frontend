import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { API_ENDPOINTS } from '../../config/api';

const fieldBase =
  'w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500';

const errorMessage = (value) => {
  if (!value) return '';
  if (Array.isArray(value)) return String(value[0]);
  if (typeof value === 'object') return 'Invalid value';
  return String(value);
};

// Create or edit a supplier. `item` switches the modal to edit.
export default function SupplierFormModal({ api, item, subtitle, onClose, onSaved }) {
  const isEdit = Boolean(item);
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      name: item?.name ?? '',
      phone: item?.phone ?? '',
    },
  });

  const submit = async (data) => {
    setServerError('');

    const payload = {
      name: data.name.trim(),
      phone: data.phone.trim(),
    };

    try {
      const res = isEdit
        ? await api.patch(`${API_ENDPOINTS.SUPPLIERS_LIST}${item.id}/`, payload)
        : await api.post(API_ENDPOINTS.SUPPLIERS_LIST, payload);
      onSaved(res.data, isEdit);
    } catch (err) {
      const res = err.response;

      if (!res) {
        setServerError('Unable to connect to the server. Please try again.');
        return;
      }
      if (res.status === 401) return; // interceptor handles logout
      if (res.status === 403) {
        setServerError('You do not have permission to save this supplier.');
        return;
      }

      if (res.status === 400 && res.data && typeof res.data === 'object') {
        let mapped = false;
        ['name', 'phone'].forEach((field) => {
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

      setServerError(errorMessage(res.data?.detail) || 'Failed to save supplier.');
    }
  };

  const helper =
    subtitle ??
    (isEdit ? 'Update this supplier.' : 'Saved to your tenant and reused on future purchases.');

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50"
      onClick={isSubmitting ? undefined : onClose}
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
              {isEdit ? 'Edit supplier' : 'Add new supplier'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">{helper}</p>
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
              maxLength={255}
              className={`${fieldBase} ${errors.name ? 'border-red-300 bg-red-50' : 'border-slate-300'}`}
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
              maxLength={20}
              className={`${fieldBase} ${errors.phone ? 'border-red-300 bg-red-50' : 'border-slate-300'}`}
              placeholder="10-digit mobile number"
              {...register('phone')}
            />
            {errors.phone && <p className="mt-1 text-xs text-red-500">{errors.phone.message}</p>}
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 rounded-lg shadow-md shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              {isSubmitting ? 'Saving...' : isEdit ? 'Save changes' : 'Add supplier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
