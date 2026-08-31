import { useEffect, useMemo, useState } from 'react';
import { useAxios } from '../../hooks/useAxios';
import { API_ENDPOINTS } from '../../config/api';

const fmt = (val) => {
  const num = parseFloat(val);
  if (isNaN(num)) return '₹0.00';
  return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const getCustomerName = (customer) => customer.shop_name || customer.name || '—';

export default function CustomerList() {
  const api = useAxios();

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [balanceFilter, setBalanceFilter] = useState('all');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await api.get(API_ENDPOINTS.RETAILERS_LIST, { params: { limit: 200 } });
        if (cancelled) return;

        const data = Array.isArray(res.data) ? res.data : res.data?.results ?? [];
        setCustomers(data);
      } catch (err) {
        if (cancelled) return;
        setError(err.response?.data?.detail || 'Failed to load customers');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [api]);

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();

    return customers.filter((customer) => {
      const name = getCustomerName(customer).toLowerCase();
      const contact = (customer.contact_person || '').toLowerCase();
      const phone = (customer.phone || '').toLowerCase();
      const address = (customer.address || '').toLowerCase();
      const creditBalance = parseFloat(customer.credit_balance || 0);

      const matchesSearch = !q || [name, contact, phone, address].some((value) => value.includes(q));
      const matchesBalance =
        balanceFilter === 'all' ||
        (balanceFilter === 'due' && creditBalance > 0) ||
        (balanceFilter === 'clear' && creditBalance <= 0);

      return matchesSearch && matchesBalance;
    });
  }, [customers, search, balanceFilter]);

  const totalCustomers = customers.length;
  const customersWithDue = customers.filter((customer) => parseFloat(customer.credit_balance || 0) > 0).length;
  const totalCredit = customers.reduce((sum, customer) => sum + Math.max(0, parseFloat(customer.credit_balance || 0)), 0);

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Customers</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {totalCustomers} customer{totalCustomers !== 1 ? 's' : ''} in your ledger
          </p>
        </div>

        <button
          type="button"
          disabled
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-lg shadow-md shadow-blue-500/25 transition-all cursor-not-allowed opacity-70"
          title="Customer creation is not wired yet"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Customer
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <p className="text-sm text-slate-500">Total Customers</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{totalCustomers}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <p className="text-sm text-slate-500">Customers With Due</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">{customersWithDue}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <p className="text-sm text-slate-500">Total Credit Balance</p>
          <p className="mt-1 text-2xl font-bold text-blue-700">{fmt(totalCredit)}</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-5 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customer, contact, phone, address..."
              className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 focus:bg-white transition-all"
            />
          </div>

          <select
            value={balanceFilter}
            onChange={(e) => setBalanceFilter(e.target.value)}
            className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all cursor-pointer"
          >
            <option value="all">All Customers</option>
            <option value="due">With Outstanding Due</option>
            <option value="clear">No Due Balance</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-5 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg" role="alert">
          {error}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Customer List</h2>
          <span className="text-xs text-slate-400">{filteredCustomers.length} shown</span>
        </div>

        {loading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="h-16 rounded-lg bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-slate-600">No customers found</p>
            <p className="text-xs text-slate-400 mt-0.5">Try a different search or filter</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Contact</th>
                  <th className="px-5 py-3">Phone</th>
                  <th className="px-5 py-3">Address</th>
                  <th className="px-5 py-3 text-right">Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCustomers.map((customer) => {
                  const creditBalance = parseFloat(customer.credit_balance || 0);
                  const hasCredit = creditBalance > 0;

                  return (
                    <tr key={customer.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-700 font-bold">
                            {getCustomerName(customer).charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{getCustomerName(customer)}</p>
                            {customer.email && <p className="text-xs text-slate-400">{customer.email}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-700">
                        {customer.contact_person || '—'}
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {customer.phone || '—'}
                      </td>
                      <td className="px-5 py-4 text-slate-600 max-w-xs">
                        <span className="block truncate" title={customer.address || ''}>
                          {customer.address || '—'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="inline-flex flex-col items-end">
                          <span className={`font-semibold ${hasCredit ? 'text-amber-700' : 'text-emerald-700'}`}>
                            {fmt(creditBalance)}
                          </span>
                          <span className="text-xs text-slate-400">
                            {hasCredit ? 'Outstanding due' : 'Clear'}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}