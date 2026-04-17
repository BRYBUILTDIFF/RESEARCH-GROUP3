import { FormEvent, useEffect, useMemo, useState } from 'react';
import { createUser, deleteUser, getEnrollments, getResults, getUserById, getUsers, updateUserDetails } from '../../lib/api';
import type { Enrollment, QuizResult } from '../../types/lms';

interface UserRow {
  id: number;
  email: string;
  full_name: string;
  role: 'admin' | 'user';
  is_active: boolean;
}

interface UserProfile extends UserRow {
  created_at: string;
  updated_at: string;
}

type ViewMode = 'list' | 'grid';

export function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(8);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<UserProfile | null>(null);
  const [profileEnrollments, setProfileEnrollments] = useState<Enrollment[]>([]);
  const [profileResults, setProfileResults] = useState<QuizResult[]>([]);

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
      setIsCreateModalOpen(false);
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

  const openProfile = async (userId: number) => {
    setIsProfileOpen(true);
    setIsProfileLoading(true);
    setError('');
    try {
      const [profile, allEnrollments, allResults] = await Promise.all([getUserById(userId), getEnrollments(), getResults()]);
      setSelectedProfile(profile);
      setProfileEnrollments(allEnrollments.filter((enrollment) => enrollment.user_id === userId));
      setProfileResults(allResults.filter((result) => result.user_id === userId));
    } catch (profileError) {
      setError(profileError instanceof Error ? profileError.message : 'Failed to load profile.');
      setIsProfileOpen(false);
    } finally {
      setIsProfileLoading(false);
    }
  };

  const traineeCount = useMemo(() => users.length, [users]);
  const filteredUsers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return users;
    return users.filter(
      (user) => user.full_name.toLowerCase().includes(query) || user.email.toLowerCase().includes(query)
    );
  }, [users, searchTerm]);
  const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredUsers.length / rowsPerPage)), [filteredUsers.length, rowsPerPage]);
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredUsers.slice(start, start + rowsPerPage);
  }, [filteredUsers, currentPage, rowsPerPage]);
  const pageStart = filteredUsers.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
  const pageEnd = Math.min(currentPage * rowsPerPage, filteredUsers.length);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, rowsPerPage, users.length]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const profilePassRate = useMemo(() => {
    if (profileResults.length === 0) return 0;
    const passed = profileResults.filter((result) => result.passed).length;
    return Number(((passed / profileResults.length) * 100).toFixed(1));
  }, [profileResults]);
  const profileAverageScore = useMemo(() => {
    if (profileResults.length === 0) return 0;
    const total = profileResults.reduce((sum, result) => sum + Number(result.score), 0);
    return Number((total / profileResults.length).toFixed(1));
  }, [profileResults]);
  const completedEnrollments = useMemo(
    () => profileEnrollments.filter((enrollment) => enrollment.status === 'completed').length,
    [profileEnrollments]
  );

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-300">User Admin</p>
          <h2 className="text-2xl font-bold text-white">Trainee Management</h2>
          <p className="text-slate-400">CRUD for trainees only. Administrator accounts are excluded from this tab.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-white/15 bg-slate-900/70 p-1 text-sm shadow-sm">
            <button
              onClick={() => setViewMode('list')}
              className={`rounded-lg px-3 py-1.5 font-semibold ${
                viewMode === 'list' ? 'bg-brand-600 text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              List
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`rounded-lg px-3 py-1.5 font-semibold ${
                viewMode === 'grid' ? 'bg-brand-600 text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              Grid
            </button>
          </div>
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-500"
          >
            + Create Trainee
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-900/55 p-4 shadow-sm">
        <div className="w-full max-w-md">
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search trainee by name or email..."
            className="w-full rounded-lg border border-white/15 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-brand-400 focus:outline-none"
          />
        </div>
        <div className="text-sm text-slate-300">
          Showing <span className="font-semibold text-white">{filteredUsers.length}</span> of{' '}
          <span className="font-semibold text-white">{traineeCount}</span> trainees
        </div>
      </div>

      {error ? <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
      {isLoading ? <p className="text-sm text-slate-400">Loading trainees...</p> : null}

      {!isLoading ? (
        <>
          <p className="text-sm text-slate-400">Total trainees: {traineeCount}</p>

          {viewMode === 'list' ? (
            <div className="overflow-x-auto rounded-xl border border-white/10 bg-slate-900/55 shadow-sm">
              <table className="w-full min-w-[920px] table-fixed text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5 text-xs uppercase tracking-wider text-slate-400">
                    <th className="w-[24%] px-4 py-3 text-left">Name</th>
                    <th className="w-[28%] px-4 py-3 text-left">Email</th>
                    <th className="w-[12%] px-4 py-3 text-center">Status</th>
                    <th className="w-[22%] px-4 py-3 text-center">Password</th>
                    <th className="w-[24%] px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedUsers.map((user) => (
                    <tr key={user.id} className="border-b border-white/5 align-middle hover:bg-white/[0.03]">
                      <td className="px-4 py-3 font-semibold text-slate-100">
                        {editingId === user.id ? (
                          <input
                            value={editForm.fullName}
                            onChange={(event) => setEditForm((previous) => ({ ...previous, fullName: event.target.value }))}
                            className="w-full rounded-md border border-white/20 bg-slate-950/70 px-2 py-1 text-sm text-slate-100"
                          />
                        ) : (
                          <span className="line-clamp-2">{user.full_name}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {editingId === user.id ? (
                          <input
                            type="email"
                            value={editForm.email}
                            onChange={(event) => setEditForm((previous) => ({ ...previous, email: event.target.value }))}
                            className="w-full rounded-md border border-white/20 bg-slate-950/70 px-2 py-1 text-sm text-slate-100"
                          />
                        ) : (
                          <span className="line-clamp-2">{user.email}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {editingId === user.id ? (
                          <label className="inline-flex items-center gap-2 text-xs text-slate-300">
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
                              user.is_active ? 'bg-emerald-500/15 text-emerald-200' : 'bg-slate-500/15 text-slate-300'
                            }`}
                          >
                            {user.is_active ? 'Active' : 'Inactive'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {editingId === user.id ? (
                          <input
                            type="password"
                            value={editForm.password}
                            onChange={(event) => setEditForm((previous) => ({ ...previous, password: event.target.value }))}
                            className="w-full rounded-md border border-white/20 bg-slate-950/70 px-2 py-1 text-sm text-slate-100"
                            placeholder="New password (optional)"
                          />
                        ) : (
                          <span className="text-xs text-slate-500">No change</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap justify-end gap-2">
                          {editingId === user.id ? (
                            <>
                              <button
                                onClick={() => void handleSaveEdit()}
                                disabled={isSaving}
                                className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-60"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                disabled={isSaving}
                                className="rounded-md border border-white/20 px-3 py-1.5 text-xs font-semibold text-slate-200 disabled:opacity-60"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => startEdit(user)}
                                disabled={isSaving}
                                className="rounded-md border border-white/20 px-3 py-1.5 text-xs font-semibold text-slate-200 disabled:opacity-60"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => void openProfile(user.id)}
                                disabled={isSaving}
                                className="rounded-md border border-brand-500/40 px-3 py-1.5 text-xs font-semibold text-brand-300 disabled:opacity-60"
                              >
                                View Profile
                              </button>
                              <button
                                onClick={() => void handleToggleStatus(user)}
                                disabled={isSaving}
                                className="rounded-md border border-white/20 px-3 py-1.5 text-xs font-semibold text-slate-200 disabled:opacity-60"
                              >
                                {user.is_active ? 'Deactivate' : 'Activate'}
                              </button>
                              <button
                                onClick={() => void handleDelete(user)}
                                disabled={isSaving}
                                className="rounded-md border border-rose-300/60 px-3 py-1.5 text-xs font-semibold text-rose-200 disabled:opacity-60"
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {paginatedUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-400">
                        No trainees found.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-4 py-3 text-sm">
                <div className="flex items-center gap-2 text-slate-300">
                  <span>Rows:</span>
                  <select
                    value={rowsPerPage}
                    onChange={(event) => setRowsPerPage(Number(event.target.value))}
                    className="rounded-md border border-white/20 bg-slate-950/70 px-2 py-1 text-sm text-slate-100"
                  >
                    <option value={5}>5</option>
                    <option value={8}>8</option>
                    <option value={10}>10</option>
                    <option value={15}>15</option>
                  </select>
                </div>

                <p className="text-slate-300">
                  Showing {pageStart}-{pageEnd} of {filteredUsers.length}
                </p>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((previous) => Math.max(1, previous - 1))}
                    disabled={currentPage === 1}
                    className="rounded-md border border-white/20 px-3 py-1.5 text-xs font-semibold text-slate-200 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Page {currentPage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((previous) => Math.min(totalPages, previous + 1))}
                    disabled={currentPage >= totalPages}
                    className="rounded-md border border-white/20 px-3 py-1.5 text-xs font-semibold text-slate-200 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredUsers.map((user) => (
                <article key={user.id} className="rounded-xl border border-white/10 bg-slate-900/55 p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-bold text-slate-100">{user.full_name}</h3>
                      <p className="text-sm text-slate-300">{user.email}</p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        user.is_active ? 'bg-emerald-500/15 text-emerald-200' : 'bg-slate-500/15 text-slate-300'
                      }`}
                    >
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={() => startEdit(user)}
                      disabled={isSaving}
                      className="rounded-md border border-white/20 px-3 py-1.5 text-xs font-semibold text-slate-200 disabled:opacity-60"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => void openProfile(user.id)}
                      disabled={isSaving}
                      className="rounded-md border border-brand-500/40 px-3 py-1.5 text-xs font-semibold text-brand-300 disabled:opacity-60"
                    >
                      View Profile
                    </button>
                    <button
                      onClick={() => void handleToggleStatus(user)}
                      disabled={isSaving}
                      className="rounded-md border border-white/20 px-3 py-1.5 text-xs font-semibold text-slate-200 disabled:opacity-60"
                    >
                      {user.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => void handleDelete(user)}
                      disabled={isSaving}
                      className="rounded-md border border-rose-300/60 px-3 py-1.5 text-xs font-semibold text-rose-200 disabled:opacity-60"
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}
              {filteredUsers.length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-slate-900/55 p-6 text-sm text-slate-400 md:col-span-2 xl:col-span-3">
                  No trainees found.
                </div>
              ) : null}
            </div>
          )}

          {isCreateModalOpen ? (
            <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
              <form
                onSubmit={handleCreate}
                className="w-full max-w-xl rounded-xl border border-white/10 bg-slate-900/95 p-5 shadow-2xl"
              >
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-300">Create Account</p>
                    <h3 className="text-xl font-bold text-white">New Trainee</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="rounded-md border border-white/20 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10"
                  >
                    Close
                  </button>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    required
                    value={newTrainee.fullName}
                    onChange={(event) => setNewTrainee((previous) => ({ ...previous, fullName: event.target.value }))}
                    className="rounded-md border border-white/20 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
                    placeholder="Full name"
                  />
                  <input
                    required
                    type="email"
                    value={newTrainee.email}
                    onChange={(event) => setNewTrainee((previous) => ({ ...previous, email: event.target.value }))}
                    className="rounded-md border border-white/20 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
                    placeholder="Email"
                  />
                  <input
                    required
                    minLength={6}
                    type="password"
                    value={newTrainee.password}
                    onChange={(event) => setNewTrainee((previous) => ({ ...previous, password: event.target.value }))}
                    className="rounded-md border border-white/20 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 md:col-span-2"
                    placeholder="Temporary password"
                  />
                  <label className="inline-flex items-center gap-2 text-sm text-slate-300 md:col-span-2">
                    <input
                      type="checkbox"
                      checked={newTrainee.isActive}
                      onChange={(event) => setNewTrainee((previous) => ({ ...previous, isActive: event.target.checked }))}
                    />
                    Active account
                  </label>
                </div>

                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    disabled={isSaving}
                    className="rounded-md border border-white/20 px-4 py-2 text-sm font-semibold text-slate-200 disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-60"
                  >
                    {isSaving ? 'Creating...' : 'Create Trainee'}
                  </button>
                </div>
              </form>
            </div>
          ) : null}

          {editingId !== null ? (
            <div className="rounded-xl border border-white/10 bg-slate-900/55 p-5 shadow-sm">
              <h3 className="text-base font-bold text-white">Edit Trainee</h3>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <input
                  value={editForm.fullName}
                  onChange={(event) => setEditForm((previous) => ({ ...previous, fullName: event.target.value }))}
                  className="rounded-md border border-white/20 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
                  placeholder="Full name"
                />
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(event) => setEditForm((previous) => ({ ...previous, email: event.target.value }))}
                  className="rounded-md border border-white/20 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
                  placeholder="Email"
                />
                <input
                  type="password"
                  value={editForm.password}
                  onChange={(event) => setEditForm((previous) => ({ ...previous, password: event.target.value }))}
                  className="rounded-md border border-white/20 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
                  placeholder="New password (optional)"
                />
                <label className="inline-flex items-center gap-2 text-sm text-slate-300">
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
                  className="rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-60"
                >
                  Save Changes
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  disabled={isSaving}
                  className="rounded-md border border-white/20 px-3 py-2 text-sm font-semibold text-slate-200 disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}

          {isProfileOpen ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
              <div className="w-full max-w-4xl rounded-xl border border-white/10 bg-slate-900/90 p-5 shadow-2xl">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-300">Trainee Profile</p>
                    <h3 className="text-xl font-bold text-white">{selectedProfile?.full_name ?? 'Loading profile...'}</h3>
                    <p className="text-sm text-slate-300">{selectedProfile?.email ?? ''}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsProfileOpen(false)}
                    className="rounded-md border border-white/20 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10"
                  >
                    Close
                  </button>
                </div>

                {isProfileLoading ? (
                  <p className="text-sm text-slate-300">Loading trainee profile...</p>
                ) : (
                  <div className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-4">
                      <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Enrollments</p>
                        <p className="mt-1 text-xl font-bold text-white">{profileEnrollments.length}</p>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Completed</p>
                        <p className="mt-1 text-xl font-bold text-white">{completedEnrollments}</p>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Avg Score</p>
                        <p className="mt-1 text-xl font-bold text-white">{profileAverageScore}%</p>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Pass Rate</p>
                        <p className="mt-1 text-xl font-bold text-white">{profilePassRate}%</p>
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <article className="rounded-lg border border-white/10 bg-slate-900/70 p-4">
                        <h4 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-300">Module Enrollments</h4>
                        <div className="mt-3 space-y-2">
                          {profileEnrollments.map((enrollment) => (
                            <div key={`profile-enrollment-${enrollment.id}`} className="rounded-md border border-white/10 bg-white/5 p-2 text-xs">
                              <p className="font-semibold text-white">{enrollment.module_title ?? `Module #${enrollment.module_id}`}</p>
                              <p className="text-slate-300">
                                Status: <span className="font-semibold">{enrollment.status}</span>
                              </p>
                              <p className="text-slate-400">Enrolled: {new Date(enrollment.enrolled_at).toLocaleString()}</p>
                            </div>
                          ))}
                          {profileEnrollments.length === 0 ? <p className="text-xs text-slate-400">No enrollments found.</p> : null}
                        </div>
                      </article>

                      <article className="rounded-lg border border-white/10 bg-slate-900/70 p-4">
                        <h4 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-300">Recent Assessment Results</h4>
                        <div className="mt-3 space-y-2">
                          {[...profileResults]
                            .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())
                            .slice(0, 8)
                            .map((result) => (
                              <div key={`profile-result-${result.id}`} className="rounded-md border border-white/10 bg-white/5 p-2 text-xs">
                                <p className="font-semibold text-white">{result.module_title ?? '-'}</p>
                                <p className="text-slate-300">{result.quiz_title ?? '-'}</p>
                                <div className="mt-1 flex items-center justify-between">
                                  <span className="text-brand-300">{Number(result.score).toFixed(0)}%</span>
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                                      result.passed ? 'bg-emerald-500/15 text-emerald-200' : 'bg-rose-500/15 text-rose-200'
                                    }`}
                                  >
                                    {result.passed ? 'Passed' : 'Failed'}
                                  </span>
                                </div>
                              </div>
                            ))}
                          {profileResults.length === 0 ? <p className="text-xs text-slate-400">No assessment results found.</p> : null}
                        </div>
                      </article>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
