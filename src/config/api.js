// This is the ONLY place BASE_URL is set
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const API_ENDPOINTS = {
  // Auth
  LOGIN: '/api/auth/login/',
  REFRESH: '/api/auth/refresh/',
  ME: '/api/auth/me/',
  REGISTER_SELLER: '/api/auth/accounts/sellers/',

  // Catalog
  PRODUCTS_LIST: '/api/catalog/products/',
  PRODUCT_DETAIL: (id) => `/api/catalog/products/${id}/`,
  CATEGORIES_LIST: '/api/catalog/categories/',
  BRANDS_LIST: '/api/catalog/brands/',
  UNITS_LIST: '/api/catalog/units/',

  // Inventory
  SUPPLIERS_LIST: '/api/inventory/suppliers/',
  PURCHASES_LIST: '/api/inventory/purchases/',
  PURCHASE_DETAIL: (id) => `/api/inventory/purchases/${id}/`,
  STOCK_MOVEMENTS: '/api/inventory/stock-movements/',

  // Customers
  RETAILERS_LIST: '/api/customers/retailers/',
  RETAILER_DETAIL: (id) => `/api/customers/retailers/${id}/`,

  // Sales & Invoicing
  SALES_LIST: '/api/sales/',
  SALE_DETAIL: (id) => `/api/sales/${id}/`,
  SALE_PAYMENTS: (id) => `/api/sales/${id}/payments/`,
  SALE_PDF: (id) => `/api/sales/${id}/pdf/`,

  // Payments
  PAYMENTS_LIST: '/api/payments/',
  PAYMENT_DETAIL: (id) => `/api/payments/${id}/`,

  // Reports
  REPORTS_CURRENT_STOCK: '/api/reports/current-stock/',
  REPORTS_STOCK_VALUATION: '/api/reports/stock-valuation/',
  REPORTS_DAILY_SALES: (date) => `/api/reports/daily-sales/?date=${date}`,
  REPORTS_MONTHLY_SALES: (year) => `/api/reports/monthly-sales/?year=${year}`,
  REPORTS_RETAILER_DUES: '/api/reports/retailer-dues/',
  REPORTS_PURCHASE_HISTORY: '/api/reports/purchase-history/',
  REPORTS_LOW_STOCK: '/api/reports/low-stock/',

  // Tenant Management (Super Admin only)
  TENANTS_LIST: '/api/tenants/',
};

export const getFullUrl = (endpoint) => `${API_BASE_URL}${endpoint}`;
