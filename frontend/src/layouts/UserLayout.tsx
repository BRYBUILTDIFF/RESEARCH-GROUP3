import { BookOpen, BookOpenCheck, CheckCircle2, ChevronDown, LayoutDashboard, LogOut, UserCircle2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { clearAuthSession, getCurrentUser } from '../lib/auth';

export function UserLayout() {
  const user = getCurrentUser();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const isModuleDetailRoute = /^\/user\/modules\/[^/]+$/.test(location.pathname);

  const avatarText = useMemo(() => {
    const email = user?.email ?? '';
    if (!email) return 'U';
    const [left] = email.split('@');
    const parts = left.split(/[._-]/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
    }
    return left.slice(0, 2).toUpperCase();
  }, [user?.email]);

  const handleSignOut = () => {
    clearAuthSession();
    navigate('/login', { replace: true });
  };

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMenuOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="flex w-full items-center justify-between gap-3 px-4 py-3 md:px-8">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-600 p-2 text-white">
              <BookOpenCheck size={20} />
            </div>
            <h1 className="text-sm font-bold text-slate-900">HelpDesk Academy</h1>
          </div>

          {!isModuleDetailRoute ? (
            <div className="flex items-center gap-1 md:gap-2">
              {[
                { to: '/user/dashboard', label: 'Dashboard', icon: LayoutDashboard },
                { to: '/user/modules', label: 'Modules', icon: BookOpen },
                { to: '/user/progress', label: 'Progress', icon: CheckCircle2 },
              ].map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${
                      isActive ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`
                  }
                >
                  <item.icon size={16} />
                  <span className="hidden md:inline">{item.label}</span>
                </NavLink>
              ))}
            </div>
          ) : (
            <div />
          )}

          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              aria-haspopup="menu"
              aria-expanded={isMenuOpen}
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold uppercase text-white">
                {avatarText}
              </span>
              <ChevronDown size={14} className={`${isMenuOpen ? 'rotate-180' : ''} transition-transform`} />
            </button>

            {isMenuOpen ? (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-lg"
              >
                <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
                  <UserCircle2 size={30} className="text-slate-500" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Signed in as</p>
                    <p className="truncate text-sm font-semibold text-slate-900">{user?.email ?? 'Unknown user'}</p>
                  </div>
                </div>

                <div className="mt-3 space-y-1">
                  {[
                    { to: '/user/dashboard', label: 'Dashboard', icon: LayoutDashboard },
                    { to: '/user/modules', label: 'Modules', icon: BookOpen },
                    { to: '/user/progress', label: 'Progress', icon: CheckCircle2 },
                  ].map((item) => (
                    <button
                      key={item.to}
                      type="button"
                      onClick={() => {
                        navigate(item.to);
                        setIsMenuOpen(false);
                      }}
                      className={`inline-flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${
                        location.pathname.startsWith(item.to)
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <item.icon size={16} />
                      {item.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsMenuOpen(false);
                    handleSignOut();
                  }}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700"
                >
                  <LogOut size={16} />
                  Sign out
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </nav>

      <main className="w-full p-4 md:p-8">
        <Outlet />
      </main>
    </div>
  );
}
