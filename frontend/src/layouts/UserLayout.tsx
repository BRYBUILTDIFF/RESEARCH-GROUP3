import { BookOpen, BookOpenCheck, CheckCircle2, ChevronDown, LayoutDashboard, LogOut, Palette, UserCircle2 } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { getMyProfile, updateMyPassword } from '../lib/api';
import { clearAuthSession, getCurrentUser, saveCurrentUser } from '../lib/auth';
import { resolveInitialTheme, setTheme, themeStorageKey, type ThemeMode } from '../lib/theme';
import type { AuthUser } from '../types/auth';

export type UserThemeMode = ThemeMode;

export function UserLayout() {
  const [user, setUser] = useState<AuthUser | null>(() => getCurrentUser());
  const [themeMode, setThemeModeState] = useState<UserThemeMode>(() => resolveInitialTheme());
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [modalCurrentPassword, setModalCurrentPassword] = useState('');
  const [modalNewPassword, setModalNewPassword] = useState('');
  const [modalConfirmPassword, setModalConfirmPassword] = useState('');
  const [modalError, setModalError] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
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

  const handleThemeModeChange = (mode: UserThemeMode) => {
    setThemeModeState(mode);
    setTheme(mode);
  };

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== themeStorageKey) return;
      setThemeModeState(resolveInitialTheme());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    const syncProfile = async () => {
      try {
        const profile = await getMyProfile();
        setUser((previous) => {
          if (!previous) return previous;
          const nextUser: AuthUser = {
            ...previous,
            fullName: profile.full_name,
            mustChangePassword: profile.must_change_password,
            passwordChanged: Boolean(profile.password_changed_at) && !profile.must_change_password,
          };
          saveCurrentUser(nextUser);
          return nextUser;
        });
      } catch {
        // Session guards handle invalid auth; ignore transient fetch errors here.
      }
    };
    void syncProfile();
  }, []);

  const handleRequiredPasswordChange = async (event: FormEvent) => {
    event.preventDefault();
    setModalError('');

    if (!modalCurrentPassword || !modalNewPassword || !modalConfirmPassword) {
      setModalError('All fields are required.');
      return;
    }
    if (modalNewPassword.length < 6) {
      setModalError('New password must be at least 6 characters.');
      return;
    }
    if (modalNewPassword !== modalConfirmPassword) {
      setModalError('New password and confirmation do not match.');
      return;
    }

    setIsChangingPassword(true);
    try {
      const updatedProfile = await updateMyPassword(modalCurrentPassword, modalNewPassword);
      setModalCurrentPassword('');
      setModalNewPassword('');
      setModalConfirmPassword('');
      setUser((previous) => {
        if (!previous) return previous;
        const nextUser: AuthUser = {
          ...previous,
          mustChangePassword: updatedProfile.must_change_password,
          passwordChanged: Boolean(updatedProfile.password_changed_at) && !updatedProfile.must_change_password,
        };
        saveCurrentUser(nextUser);
        return nextUser;
      });
      navigate('/user/profile', { replace: true });
    } catch (changeError) {
      setModalError(changeError instanceof Error ? changeError.message : 'Failed to update password.');
    } finally {
      setIsChangingPassword(false);
    }
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
    <div className="min-h-screen bg-dark-bg text-slate-100">
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
                  <button
                    type="button"
                    onClick={() => {
                      navigate('/user/profile');
                      setIsMenuOpen(false);
                    }}
                    className={`inline-flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${
                      location.pathname.startsWith('/user/profile')
                        ? 'border border-brand-500/20 bg-brand-500/10 text-brand-300'
                        : 'text-slate-200 hover:bg-white/10'
                    }`}
                  >
                    <UserCircle2 size={16} />
                    User Profile
                  </button>
                </div>

                <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    <Palette size={12} />
                    Theme
                  </p>
                  <div className="space-y-1.5">
                    {[
                      { value: 'default' as UserThemeMode, label: 'Default Mode' },
                      { value: 'dark' as UserThemeMode, label: 'Dark Mode' },
                      { value: 'light' as UserThemeMode, label: 'Light Mode' },
                    ].map((option) => (
                      <label
                        key={option.value}
                        className={`flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-sm transition ${
                          themeMode === option.value
                            ? 'border-brand-500/30 bg-brand-500/10 text-brand-300'
                            : 'border-white/10 text-slate-200 hover:bg-white/10'
                        }`}
                      >
                        <input
                          type="radio"
                          name="user-theme-mode"
                          checked={themeMode === option.value}
                          onChange={() => handleThemeModeChange(option.value)}
                          className="h-3.5 w-3.5 accent-sky-500"
                        />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>
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
        {!user?.mustChangePassword ? (
          <Outlet
            context={{
              themeMode,
              setThemeMode: handleThemeModeChange,
            }}
          />
        ) : null}
      </main>

      {user?.mustChangePassword ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleRequiredPasswordChange}
            className="w-full max-w-md rounded-xl border border-white/10 bg-slate-900/95 p-5 shadow-2xl"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-300">Security Required</p>
            <h3 className="mt-1 text-xl font-bold text-white">Change Your Password</h3>
            <p className="mt-2 text-sm text-slate-300">
              Your account is using the default password. You must set a new password before continuing.
            </p>

            {modalError ? (
              <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">{modalError}</p>
            ) : null}

            <div className="mt-4 space-y-3">
              <input
                type="password"
                value={modalCurrentPassword}
                onChange={(event) => setModalCurrentPassword(event.target.value)}
                className="w-full rounded-md border border-white/20 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
                placeholder="Current password"
                required
              />
              <input
                type="password"
                value={modalNewPassword}
                onChange={(event) => setModalNewPassword(event.target.value)}
                className="w-full rounded-md border border-white/20 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
                placeholder="New password"
                minLength={6}
                required
              />
              <input
                type="password"
                value={modalConfirmPassword}
                onChange={(event) => setModalConfirmPassword(event.target.value)}
                className="w-full rounded-md border border-white/20 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
                placeholder="Confirm new password"
                minLength={6}
                required
              />
            </div>

            <button
              type="submit"
              disabled={isChangingPassword}
              className="mt-4 w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isChangingPassword ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
