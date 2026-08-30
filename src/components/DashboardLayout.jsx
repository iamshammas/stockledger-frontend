import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAuth } from '../hooks/useAuth';

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const displayName = user?.username || user?.email || 'User';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen flex bg-slate-50">
      <Sidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top header */}
        <header className="sticky top-0 z-30 h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-4 lg:px-6 shrink-0">
          <button
            id="sidebar-toggle"
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
            aria-label="Open sidebar"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <div className="flex-1" />

          {/* User menu */}
          <div className="relative">
            <button
              id="user-menu-btn"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                {initial}
              </div>
              <span className="hidden sm:block text-sm font-medium text-slate-700">{displayName}</span>
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>

            {userMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-50">
                  <div className="px-4 py-2 border-b border-slate-100">
                    <p className="text-sm font-medium text-slate-900 truncate">{displayName}</p>
                    <p className="text-xs text-slate-400 truncate">{user?.role || 'Seller'}</p>
                  </div>
                  <button
                    id="logout-btn"
                    onClick={logout}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                    </svg>
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Page content via Outlet */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
