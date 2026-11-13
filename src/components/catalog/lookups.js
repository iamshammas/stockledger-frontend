import { API_ENDPOINTS } from '../../config/api';

// Shared styles / helpers for catalog forms.
export const fieldBase =
  'w-full px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500';

export const errorMessage = (value) => {
  if (!value) return '';
  if (Array.isArray(value)) return String(value[0]);
  if (typeof value === 'object') return 'Invalid value';
  return String(value);
};

// ── Quick-add for category / brand / unit ──
export const QUICK_ADD_META = {
  category: {
    title: 'Add new category',
    singular: 'category',
    plural: 'Categories',
    endpoint: API_ENDPOINTS.CATEGORIES_LIST,
    placeholder: 'e.g. Electronics',
    hasShortCode: false,
  },
  brand: {
    title: 'Add new brand',
    singular: 'brand',
    plural: 'Brands',
    endpoint: API_ENDPOINTS.BRANDS_LIST,
    placeholder: 'e.g. Samsung',
    hasShortCode: false,
  },
  unit: {
    title: 'Add new unit',
    singular: 'unit',
    plural: 'Units',
    endpoint: API_ENDPOINTS.UNITS_LIST,
    placeholder: 'e.g. Pieces',
    hasShortCode: true,
  },
};
