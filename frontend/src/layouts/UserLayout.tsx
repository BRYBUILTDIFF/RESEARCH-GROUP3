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
    <div className="user-theme min-h-screen bg-dark-bg text-white">
      <div className="landing-gradient pointer-events-none fixed inset-0" />

      <nav className="relative z-40 sticky top-0 border-b border-white/10 bg-dark-bg/80 backdrop-blur-lg">
        <div className="flex w-full items-center justify-between gap-3 px-4 py-3 md:px-8">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-brand-600 p-2 text-white shadow-lg shadow-brand-500/20">
              <BookOpenCheck size={20} />
            </div>
            <h1 className="text-sm font-bold text-white">
              HelpDesk <span className="text-brand-400">Academy</span>
            </h1>
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
                    `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                      isActive
                        ? 'border border-brand-500/20 bg-brand-500/10 text-brand-300'
                        : 'text-slate-300 hover:bg-white/10 hover:text-white'
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
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-slate-900/70 px-2 py-1.5 text-sm font-semibold text-slate-200 hover:bg-white/10"
              aria-haspopup="menu"
              aria-expanded={isMenuOpen}
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-xs font-bold uppercase text-white">
                {avatarText}
              </span>
              <ChevronDown size={14} className={`${isMenuOpen ? 'rotate-180' : ''} transition-transform`} />
            </button>

            {isMenuOpen ? (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-64 rounded-2xl border border-white/10 bg-slate-900/95 p-3 shadow-2xl"
              >
                <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
                  <UserCircle2 size={30} className="text-slate-300" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Signed in as</p>
                    <p className="truncate text-sm font-semibold text-white">{user?.email ?? 'Unknown user'}</p>
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
                          ? 'border border-brand-500/20 bg-brand-500/10 text-brand-300'
                          : 'text-slate-200 hover:bg-white/10'
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
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-500"
                >
                  <LogOut size={16} />
                  Sign out
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </nav>

      <main className="user-content relative z-10 w-full p-4 md:p-8">
        <Outlet />
      </main>
    </div>
  );
}
