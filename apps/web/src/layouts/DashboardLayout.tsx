import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { getUser, logout } from '../lib/auth';

const navItems = [
  { to: '/', label: 'Dashboard', icon: '📊' },
  { to: '/products', label: 'Produtos', icon: '📦' },
  { to: '/tenants', label: 'Clientes', icon: '🏢' },
  { to: '/railway', label: 'Railway', icon: '🚂' },
  { to: '/monitoring', label: 'Monitoramento', icon: '📡' },
];

export function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const user = getUser();

  return (
    <div className="min-h-screen flex bg-gray-50">
      <aside
        className={`${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } fixed inset-y-0 left-0 z-30 w-64 bg-blue-900 text-white transform transition-transform lg:translate-x-0 lg:static lg:inset-auto`}
      >
        <div className="flex items-center justify-between h-16 px-6 border-b border-blue-800">
          <span
            className="text-xl font-bold cursor-pointer"
            onClick={() => navigate('/')}
          >
            Gestão <span className="text-amber-400">Prime</span>
          </span>
          <button
            className="lg:hidden text-white"
            onClick={() => setSidebarOpen(false)}
          >
            ✕
          </button>
        </div>

        <nav className="mt-4 px-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-800 text-amber-400'
                    : 'text-blue-100 hover:bg-blue-800/50'
                }`
              }
            >
              <span>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-blue-800">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <p className="font-medium text-white truncate">{user?.name}</p>
              <p className="text-blue-300 text-xs truncate">{user?.email}</p>
            </div>
            <button
              onClick={logout}
              className="text-blue-300 hover:text-white text-sm"
              title="Sair"
            >
              ⏻
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b flex items-center px-6 gap-4 lg:px-8">
          <button
            className="lg:hidden text-gray-600"
            onClick={() => setSidebarOpen(true)}
          >
            ☰
          </button>
          <h2 className="text-lg font-semibold text-gray-800">Gestão Prime</h2>
        </header>

        <main className="flex-1 p-6 lg:p-8 overflow-auto">
          <Outlet />
        </main>
      </div>

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
