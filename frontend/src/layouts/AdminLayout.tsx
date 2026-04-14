import { BarChart3, Bell, BookOpen, LayoutDashboard, LogOut, Search, ShieldCheck, Users } from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { clearAuthSession, getCurrentUser } from '../lib/auth';

export function AdminLayout() {
  const user = getCurrentUser();
  const navigate = useNavigate();

  const handleSignOut = () => {
    clearAuthSession();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="w-20 shrink-0 border-r border-slate-200 bg-white px-3 py-5 md:w-64 md:px-4">
        <div className="mb-8 flex items-center justify-center gap-3 md:justify-start">
          <div className="rounded-lg bg-sky-600 p-2 text-white">
            <ShieldCheck size={20} />
          </div>
          <div className="hidden md:block">
            <p className="text-xs font-semibold uppercase tracking-wider text-sky-700">Admin</p>
            <h1 className="text-sm font-bold text-slate-900">HelpDesk Academy</h1>
          </div>
        </div>

        <nav className="space-y-1">
          {[
            { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { to: '/admin/trainees', label: 'Trainees', icon: Users },
            { to: '/admin/modules', label: 'Modules', icon: BookOpen },
            { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
          ].map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center justify-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition md:justify-start ${
                  isActive ? 'bg-sky-50 text-sky-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              <item.icon size={18} />
              <span className="hidden md:inline">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto border-t border-slate-200 pt-4">
          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-rose-600 transition hover:bg-rose-50 md:justify-start"
          >
            <LogOut size={18} />
            <span className="hidden md:inline">Sign out</span>
          </button>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 md:px-8">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search modules, trainees, reports..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm focus:border-sky-500 focus:outline-none"
            />
          </div>
          <div className="ml-4 flex items-center gap-4">
            <button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700">
              <Bell size={18} />
            </button>
            <span className="hidden text-sm text-slate-600 md:inline">{user?.email}</span>
            <button
              type="button"
              onClick={handleSignOut}
              className="hidden rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700 md:inline-flex"
            >
              Sign out
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
