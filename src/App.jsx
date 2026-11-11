import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './hooks/useAuth';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './components/DashboardLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import SaleList from './pages/Sales/SaleList';
import SaleCreate from './pages/Sales/SaleCreate';
import SaleEdit from './pages/Sales/SaleEdit';
import SaleDetail from './pages/Sales/SaleDetail';
import PaymentList from './pages/Payments/PaymentList';
import PaymentCreate from './pages/Payments/PaymentCreate';
import PaymentDetail from './pages/Payments/PaymentDetail';
import CustomerList from './pages/Customers/CustomerList';
import CustomerCreate from './pages/Customers/CustomerCreate';
import CustomerDetail from './pages/Customers/CustomerDetail';
import CustomerEdit from './pages/Customers/CustomerEdit';
import PurchaseList from './pages/Inventory/PurchaseList';
import PurchaseCreate from './pages/Inventory/PurchaseCreate';
import ProductList from './pages/Catalog/ProductList';

function Placeholder({ title }) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-1">{title}</h1>
      <p className="text-sm text-slate-500">Coming soon</p>
    </div>
  );
}

// Redirects "/" and "/dashboard" to the correct role-based dashboard
function RoleRedirect() {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  const path = user?.role === 'SUPER_ADMIN' ? '/dashboard/admin' : '/dashboard/seller';
  return <Navigate to={path} replace />;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />

          {/* Role-based redirects */}
          <Route path="/" element={<RoleRedirect />} />
          <Route path="/dashboard" element={<RoleRedirect />} />

          {/* Protected — all inside DashboardLayout */}
          <Route
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            {/* Seller dashboard */}
            <Route path="/dashboard/seller" element={<Dashboard />} />

            {/* Admin dashboard */}
            <Route path="/dashboard/admin" element={<SuperAdminDashboard />} />

            {/* Seller modules */}
            <Route path="/catalog" element={<ProductList />} />
            <Route path="/inventory" element={<PurchaseList />} />
            <Route path="/inventory/create" element={<PurchaseCreate />} />
            <Route path="/customers" element={<CustomerList />} />
            <Route path="/customers/create" element={<CustomerCreate />} />
            <Route path="/customers/:id" element={<CustomerDetail />} />
            <Route path="/customers/:id/edit" element={<CustomerEdit />} />
            <Route path="/sales" element={<SaleList />} />
            <Route path="/sales/create" element={<SaleCreate />} />
            <Route path="/sales/:id/edit" element={<SaleEdit />} />
            <Route path="/sales/:id" element={<SaleDetail />} />
            <Route path="/payments" element={<PaymentList />} />
            <Route path="/payments/create" element={<PaymentCreate />} />
            <Route path="/payments/:id" element={<PaymentDetail />} />
            <Route path="/reports" element={<Placeholder title="Reports" />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<RoleRedirect />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
