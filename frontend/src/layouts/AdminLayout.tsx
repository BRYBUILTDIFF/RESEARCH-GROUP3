import { BarChart3, BookOpen, LayoutDashboard, LogOut, ShieldCheck, Users } from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { clearAuthSession, getCurrentUser } from '../lib/auth';

export function AdminLayout() {
  const user = getCurrentUser();
  const navigate = useNavigate();

  const navItems = [
    { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/admin/trainees', label: 'Trainees', icon: Users },
    { to: '/admin/modules', label: 'Modules', icon: BookOpen },
    { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  ];

  const handleSignOut = () => {
    clearAuthSession();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-dark-bg text-slate-100">
      <div className="landing-gradient pointer-events-none fixed inset-0" />

      <div className="relative z-10 flex min-h-screen">
        <aside className="sticky top-0 flex h-screen w-20 shrink-0 flex-col border-r border-white/10 bg-slate-950/80 px-3 py-5 backdrop-blur-xl md:w-[268px] md:px-4">
          <div className="mb-8 flex items-center justify-center gap-3 md:justify-start">
            <div className="rounded-xl bg-brand-600 p-2.5 text-white shadow-lg shadow-brand-500/20">
              <ShieldCheck size={20} />
            </div>
            <div className="hidden md:block">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-300">Admin Panel</p>
              <h1 className="text-sm font-bold text-white">
                HelpDesk <span className="text-brand-400">Academy</span>
              </h1>
            </div>
          </div>

          <p className="mb-3 hidden px-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 md:block">
            Workspace
          </p>
          <nav className="space-y-1.5">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `group flex items-center justify-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition md:justify-start ${
                    isActive
                      ? 'border border-brand-500/30 bg-brand-500/10 text-brand-300'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                <item.icon size={18} className="shrink-0" />
                <span className="hidden md:inline">{item.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="mt-auto space-y-3 border-t border-white/10 pt-4">
            <div className="hidden rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 md:block">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Signed In</p>
              <p className="truncate text-sm font-medium text-slate-200">{user?.email ?? 'Unknown user'}</p>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2.5 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/20 md:justify-start"
            >
              <LogOut size={18} />
              <span className="hidden md:inline">Sign out</span>
            </button>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto p-4 md:p-8">
            <div className="mx-auto w-full max-w-[1600px]">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
