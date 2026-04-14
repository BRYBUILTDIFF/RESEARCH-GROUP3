import { FormEvent, useEffect, useMemo, useState } from 'react';
import { createUser, deleteUser, getUsers, updateUserDetails } from '../../lib/api';

interface UserRow {
  id: number;
  email: string;
  full_name: string;
  role: 'admin' | 'user';
  is_active: boolean;
}

type ViewMode = 'list' | 'grid';

export function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  const [newTrainee, setNewTrainee] = useState({
    fullName: '',
    email: '',
    password: '',
    isActive: true,
  });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    fullName: '',
    email: '',
    password: '',
    isActive: true,
  });

  const loadUsers = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await getUsers();
      setUsers(response.filter((user) => user.role === 'user'));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load trainees.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const withSave = async (action: () => Promise<void>) => {
    setIsSaving(true);
    setError('');
    try {
      await action();
      await loadUsers();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Action failed.');
    } finally {
      setIsSaving(false);
    }
  };

  const startEdit = (user: UserRow) => {
    setEditingId(user.id);
    setEditForm({
      fullName: user.full_name,
      email: user.email,
      password: '',
      isActive: user.is_active,
    });
  };

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    await withSave(async () => {
      await createUser({
        fullName: newTrainee.fullName,
        email: newTrainee.email,
        password: newTrainee.password,
        role: 'user',
        isActive: newTrainee.isActive,
      });
      setNewTrainee({ fullName: '', email: '', password: '', isActive: true });
    });
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    await withSave(async () => {
      await updateUserDetails(editingId, {
        fullName: editForm.fullName,
        email: editForm.email,
        password: editForm.password.trim() ? editForm.password : undefined,
        role: 'user',
        isActive: editForm.isActive,
      });
      setEditingId(null);
      setEditForm({ fullName: '', email: '', password: '', isActive: true });
    });
  };

  const handleToggleStatus = async (user: UserRow) => {
    await withSave(async () => {
      await updateUserDetails(user.id, {
        role: 'user',
        isActive: !user.is_active,
      });
    });
  };

  const handleDelete = async (user: UserRow) => {
    const approved = window.confirm(`Delete trainee "${user.full_name}"? This cannot be undone.`);
    if (!approved) return;
    await withSave(async () => {
      await deleteUser(user.id);
    });
  };

  const traineeCount = useMemo(() => users.length, [users]);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Trainee Management</h2>
          <p className="text-slate-600">CRUD for trainees only. Administrator accounts are excluded from this tab.</p>
        </div>
        <div className="inline-flex rounded-md border border-slate-200 bg-white p-1 text-sm shadow-sm">
          <button
            onClick={() => setViewMode('list')}
            className={`rounded px-3 py-1.5 font-semibold ${viewMode === 'list' ? 'bg-sky-600 text-white' : 'text-slate-700'}`}
          >
            List
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`rounded px-3 py-1.5 font-semibold ${viewMode === 'grid' ? 'bg-sky-600 text-white' : 'text-slate-700'}`}
          >
            Grid
          </button>
        </div>
      </div>

      <form onSubmit={handleCreate} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-4">
        <input
          required
          value={newTrainee.fullName}
          onChange={(event) => setNewTrainee((previous) => ({ ...previous, fullName: event.target.value }))}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="Full name"
        />
        <input
          required
          type="email"
          value={newTrainee.email}
          onChange={(event) => setNewTrainee((previous) => ({ ...previous, email: event.target.value }))}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="Email"
        />
        <input
          required
          minLength={6}
          type="password"
          value={newTrainee.password}
          onChange={(event) => setNewTrainee((previous) => ({ ...previous, password: event.target.value }))}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="Temporary password"
        />
        <div className="flex items-center justify-between gap-2">
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={newTrainee.isActive}
              onChange={(event) => setNewTrainee((previous) => ({ ...previous, isActive: event.target.checked }))}
            />
            Active
          </label>
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            Create Trainee
          </button>
        </div>
      </form>

      {error ? <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
      {isLoading ? <p className="text-sm text-slate-500">Loading trainees...</p> : null}

      {!isLoading ? (
        <>
          <p className="text-sm text-slate-600">Total trainees: {traineeCount}</p>

          {viewMode === 'list' ? (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full min-w-[860px] text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Edit</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-slate-100 text-sm">
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {editingId === user.id ? (
                          <input
                            value={editForm.fullName}
                            onChange={(event) => setEditForm((previous) => ({ ...previous, fullName: event.target.value }))}
                            className="w-full rounded-md border border-slate-300 px-2 py-1"
                          />
                        ) : (
                          user.full_name
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {editingId === user.id ? (
                          <input
                            type="email"
                            value={editForm.email}
                            onChange={(event) => setEditForm((previous) => ({ ...previous, email: event.target.value }))}
                            className="w-full rounded-md border border-slate-300 px-2 py-1"
                          />
                        ) : (
                          user.email
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editingId === user.id ? (
                          <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                            <input
                              type="checkbox"
                              checked={editForm.isActive}
                              onChange={(event) => setEditForm((previous) => ({ ...previous, isActive: event.target.checked }))}
                            />
                            Active
                          </label>
                        ) : (
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                              user.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {user.is_active ? 'Active' : 'Inactive'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editingId === user.id ? (
                          <input
                            type="password"
                            value={editForm.password}
                            onChange={(event) => setEditForm((previous) => ({ ...previous, password: event.target.value }))}
                            className="w-full rounded-md border border-slate-300 px-2 py-1"
                            placeholder="New password (optional)"
                          />
                        ) : (
                          <span className="text-xs text-slate-500">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {editingId === user.id ? (
                            <>
                              <button
                                onClick={() => void handleSaveEdit()}
                                disabled={isSaving}
                                className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                disabled={isSaving}
                                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-60"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => startEdit(user)}
                                disabled={isSaving}
                                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-60"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => void handleToggleStatus(user)}
                                disabled={isSaving}
                                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-60"
                              >
                                {user.is_active ? 'Deactivate' : 'Activate'}
                              </button>
                              <button
                                onClick={() => void handleDelete(user)}
                                disabled={isSaving}
                                className="rounded-md border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-700 disabled:opacity-60"
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {users.map((user) => (
                <article key={user.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">{user.full_name}</h3>
                      <p className="text-sm text-slate-600">{user.email}</p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        user.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={() => startEdit(user)}
                      disabled={isSaving}
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-60"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => void handleToggleStatus(user)}
                      disabled={isSaving}
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-60"
                    >
                      {user.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => void handleDelete(user)}
                      disabled={isSaving}
                      className="rounded-md border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-700 disabled:opacity-60"
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}

          {editingId !== null ? (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-bold text-slate-900">Edit Trainee</h3>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <input
                  value={editForm.fullName}
                  onChange={(event) => setEditForm((previous) => ({ ...previous, fullName: event.target.value }))}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Full name"
                />
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(event) => setEditForm((previous) => ({ ...previous, email: event.target.value }))}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Email"
                />
                <input
                  type="password"
                  value={editForm.password}
                  onChange={(event) => setEditForm((previous) => ({ ...previous, password: event.target.value }))}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                  placeholder="New password (optional)"
                />
                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={editForm.isActive}
                    onChange={(event) => setEditForm((previous) => ({ ...previous, isActive: event.target.checked }))}
                  />
                  Active account
                </label>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => void handleSaveEdit()}
                  disabled={isSaving}
                  className="rounded-md bg-sky-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  Save Changes
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  disabled={isSaving}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
