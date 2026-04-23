import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { getMyProfile, updateMyPassword, type UserProfileResponse } from '../../lib/api';
import { getCurrentUser, saveCurrentUser } from '../../lib/auth';
import type { ThemeMode } from '../../lib/theme';

type UserLayoutOutletContext = {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
};

function toAuthStatus(profile: UserProfileResponse) {
  return {
    mustChangePassword: profile.must_change_password,
    passwordChanged: Boolean(profile.password_changed_at) && !profile.must_change_password,
  };
}

export function UserProfilePage() {
  const { themeMode, setThemeMode } = useOutletContext<UserLayoutOutletContext>();
  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError('');
      try {
        const response = await getMyProfile();
        setProfile(response);

        const current = getCurrentUser();
        if (current) {
          saveCurrentUser({
            ...current,
            ...toAuthStatus(response),
          });
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load profile.');
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, []);

  const passwordStatus = useMemo(() => {
    if (!profile) return 'Unknown';
    if (profile.must_change_password) return 'Required to change now';
    if (profile.password_changed_at) return 'Changed';
    return 'Not changed yet';
  }, [profile]);

  const handleChangePassword = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('All password fields are required.');
      return;
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    setIsSaving(true);
    try {
      const updatedProfile = await updateMyPassword(currentPassword, newPassword);
      setProfile(updatedProfile);
      setSuccess('Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      const current = getCurrentUser();
      if (current) {
        saveCurrentUser({
          ...current,
          ...toAuthStatus(updatedProfile),
        });
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to update password.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="space-y-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-300">Account</p>
        <h2 className="text-2xl font-bold text-white">User Profile</h2>
        <p className="text-sm text-slate-400">Manage your account security and layout preference.</p>
      </div>

      {error ? <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
      {success ? (
        <p className="rounded-md border border-emerald-300/40 bg-emerald-500/10 p-3 text-sm text-emerald-200">{success}</p>
      ) : null}
      {isLoading ? <p className="text-sm text-slate-300">Loading profile...</p> : null}

      {!isLoading && profile ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <article className="rounded-xl border border-white/10 bg-slate-900/70 p-5 shadow-sm">
            <div className="mx-auto max-w-sm text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-300">Security</p>
              <h3 className="mt-1 text-lg font-semibold text-white">Change Password</h3>
              <p className="mt-1 text-sm text-slate-400">{profile.email}</p>
            </div>

            <form onSubmit={handleChangePassword} className="mx-auto mt-5 w-full max-w-sm space-y-3">
              <input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                className="w-full rounded-md border border-white/20 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
                placeholder="Current password"
                required
              />
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="w-full rounded-md border border-white/20 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
                placeholder="New password"
                minLength={6}
                required
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full rounded-md border border-white/20 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
                placeholder="Confirm new password"
                minLength={6}
                required
              />
              <button
                type="submit"
                disabled={isSaving}
                className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? 'Updating...' : 'Update Password'}
              </button>
            </form>

            <div className="mx-auto mt-4 w-full max-w-sm rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-slate-300">
              <p>
                Password status: <span className="font-semibold text-white">{passwordStatus}</span>
              </p>
              <p className="mt-1">
                Last changed:{' '}
                <span className="font-semibold text-white">
                  {profile.password_changed_at ? new Date(profile.password_changed_at).toLocaleString() : 'Not yet'}
                </span>
              </p>
            </div>
          </article>

          <article className="rounded-xl border border-white/10 bg-slate-900/70 p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-300">Preference Layout</p>
            <h3 className="mt-1 text-lg font-semibold text-white">Theme Mode</h3>
            <p className="mt-1 text-sm text-slate-400">Choose how the user interface looks for your account.</p>

            <div className="mt-4 space-y-2">
              {[
                {
                  value: 'default' as ThemeMode,
                  label: 'Default Mode',
                  description: 'Current blue HelpDesk style.',
                },
                {
                  value: 'dark' as ThemeMode,
                  label: 'Dark Mode',
                  description: 'Darker contrast interface.',
                },
                {
                  value: 'light' as ThemeMode,
                  label: 'Light Mode',
                  description: 'Light background interface.',
                },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setThemeMode(option.value)}
                  className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                    themeMode === option.value
                      ? 'border-brand-400/50 bg-brand-500/10'
                      : 'border-white/10 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <p className="text-sm font-semibold text-white">{option.label}</p>
                  <p className="text-xs text-slate-400">{option.description}</p>
                </button>
              ))}
            </div>
          </article>
        </div>
      ) : null}
    </section>
  );
}
