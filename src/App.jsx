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
            <Route path="/catalog" element={<Placeholder title="Catalog" />} />
            <Route path="/inventory" element={<Placeholder title="Inventory" />} />
            <Route path="/customers" element={<Placeholder title="Customers" />} />
            <Route path="/sales" element={<SaleList />} />
            <Route path="/sales/create" element={<SaleCreate />} />
            <Route path="/sales/:id/edit" element={<SaleEdit />} />
            <Route path="/sales/:id" element={<SaleDetail />} />
            <Route path="/payments" element={<Placeholder title="Payments" />} />
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
