import { FormEvent, useState } from 'react';
import { LogOut, ShieldCheck } from 'lucide-react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { login } from '../../lib/api';
import { getCurrentUser, getToken, saveAuthSession } from '../../lib/auth';

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const existingToken = getToken();
  const existingUser = getCurrentUser();
  if (existingToken && existingUser) {
    const redirect = existingUser.role === 'admin' ? '/admin/dashboard' : '/user/dashboard';
    return <Navigate to={redirect} replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const payload = await login(email, password);
      saveAuthSession(payload);
      navigate(payload.user.role === 'admin' ? '/admin/dashboard' : '/user/dashboard', { replace: true });
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Unable to sign in.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-bg text-white">
      <div className="landing-gradient pointer-events-none fixed inset-0" />
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-16">
        <div className="grid w-full gap-10 lg:grid-cols-2">
          <section className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-500/20 bg-brand-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-400">
              <ShieldCheck size={12} />
              HelpDesk Academy
            </div>
            <h1 className="text-4xl font-black leading-tight md:text-5xl">
              Welcome back to
              <span className="text-brand-400"> HelpDesk Academy</span>
            </h1>
            <p className="max-w-xl text-slate-300">
              Sign in to continue your simulation training and access role-based dashboards.
            </p>

            <div className="dark-glass-card max-w-md p-4 text-xs text-slate-300">
              <p className="mb-2 font-semibold text-white">Default seeded users</p>
              <p>admin@helpdesk.local / admin123</p>
              <p>user@helpdesk.local / user123</p>
            </div>
          </section>

          <section className="dark-glass-card border-white/10 p-8">
            <h2 className="text-2xl font-bold text-white">Sign In</h2>
            <p className="mt-2 text-sm text-slate-400">Use your account credentials to continue.</p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              <div>
                <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-200">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-slate-900/80 px-3 py-2 text-white placeholder:text-slate-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  placeholder="admin@helpdesk.local"
                />
              </div>

              <div>
                <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-200">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-slate-900/80 px-3 py-2 text-white placeholder:text-slate-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  placeholder="Enter password"
                />
              </div>

              {error ? (
                <p className="rounded-md border border-rose-300/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{error}</p>
              ) : null}

              <button
                type="submit"
                disabled={isLoading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 font-semibold text-white transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <LogOut size={16} className="rotate-180" />
                {isLoading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>

            <div className="mt-6 flex items-center justify-between">
              <Link to="/" className="inline-flex text-sm font-medium text-brand-300 hover:underline">
                Back to landing page
              </Link>
              <Link to="/register" className="inline-flex text-sm font-medium text-brand-300 hover:underline">
                Create account
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
