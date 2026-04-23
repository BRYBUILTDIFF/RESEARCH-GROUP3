import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { Check, Download, Eye, LayoutGrid, List, Pencil, Plus, Search, Trash2, Upload, UserCheck, UserX, X } from 'lucide-react';
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
type FileFormat = 'csv' | 'xlsx';

interface ImportPreviewRow {
  rowNumber: number;
  fullName: string;
  email: string;
  isActive: boolean;
  role: 'user';
  errors: string[];
}

type SpreadsheetRow = Record<string, unknown>;

const IMPORT_HEADERS = ['fullName', 'email', 'isActive', 'role'] as const;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const TEMPLATE_ROWS: Array<Record<(typeof IMPORT_HEADERS)[number], string>> = [
  {
    fullName: 'Juan Dela Cruz',
    email: 'juan.delacruz@example.com',
    isActive: 'TRUE',
    role: 'user',
  },
];

export function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [existingEmails, setExistingEmails] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importRows, setImportRows] = useState<ImportPreviewRow[]>([]);
  const [importFileName, setImportFileName] = useState('');
  const [importError, setImportError] = useState('');
  const [importStatusMessage, setImportStatusMessage] = useState('');
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
      setExistingEmails(response.map((user) => user.email.trim().toLowerCase()));
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
        role: 'user',
        isActive: newTrainee.isActive,
      });
      setNewTrainee({ fullName: '', email: '', isActive: true });
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

  const toHeaderKey = (value: string) => value.trim().toLowerCase().replace(/[\s_-]+/g, '');

  const toText = (value: unknown) => String(value ?? '').trim();

  const parseBooleanLike = (value: unknown): boolean | null => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1 ? true : value === 0 ? false : null;

    const normalized = toText(value).toLowerCase();
    if (!normalized) return null;
    if (['true', '1', 'yes', 'y', 'active'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n', 'inactive'].includes(normalized)) return false;
    return null;
  };

  const getCellByAlias = (row: SpreadsheetRow, aliases: string[]) => {
    const entries = Object.entries(row);
    for (const alias of aliases) {
      const found = entries.find(([key]) => toHeaderKey(key) === alias);
      if (found) return found[1];
    }
    return '';
  };

  const loadSpreadsheetTools = async () => import('xlsx');

  const buildImportPreviewRows = (rawRows: SpreadsheetRow[]) => {
    const normalizedExistingEmails = new Set(existingEmails);

    const parsedRows = rawRows.map((rawRow, index) => {
      const fullName = toText(getCellByAlias(rawRow, ['fullname', 'name']));
      const email = toText(getCellByAlias(rawRow, ['email']));
      const roleValue = toText(getCellByAlias(rawRow, ['role'])).toLowerCase();
      const isActiveRaw = getCellByAlias(rawRow, ['isactive', 'active', 'status']);
      const parsedIsActive = parseBooleanLike(isActiveRaw);
      const errors: string[] = [];

      if (!fullName) errors.push('fullName is required');
      if (!email) errors.push('email is required');
      if (email && !EMAIL_PATTERN.test(email)) errors.push('email format is invalid');
      if (toText(isActiveRaw) && parsedIsActive === null) errors.push('isActive must be TRUE/FALSE, YES/NO, 1/0, or ACTIVE/INACTIVE');
      if (roleValue && roleValue !== 'user') errors.push('role must be "user" for trainee import');

      const normalizedEmail = email.toLowerCase();
      if (normalizedEmail && normalizedExistingEmails.has(normalizedEmail)) {
        errors.push('email already exists in the system');
      }

      return {
        rowNumber: index + 2,
        fullName,
        email,
        isActive: parsedIsActive ?? true,
        role: 'user' as const,
        errors,
      };
    });

    const emailCountMap = new Map<string, number>();
    for (const row of parsedRows) {
      if (!row.email) continue;
      const key = row.email.toLowerCase();
      emailCountMap.set(key, (emailCountMap.get(key) ?? 0) + 1);
    }

    return parsedRows.map((row) => {
      if (!row.email) return row;
      const duplicateCount = emailCountMap.get(row.email.toLowerCase()) ?? 0;
      if (duplicateCount <= 1) return row;
      return { ...row, errors: [...row.errors, 'duplicate email in file'] };
    });
  };

  const downloadDataAsFile = async (rows: Array<Record<(typeof IMPORT_HEADERS)[number], string>>, format: FileFormat, fileName: string) => {
    const XLSX = await loadSpreadsheetTools();

    if (format === 'csv') {
      const worksheet = XLSX.utils.json_to_sheet(rows, { header: [...IMPORT_HEADERS] });
      const csvText = XLSX.utils.sheet_to_csv(worksheet);
      const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      URL.revokeObjectURL(url);
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(rows, { header: [...IMPORT_HEADERS] });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Trainees');
    const output = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([output], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const downloadTemplate = async (format: FileFormat) => {
    await downloadDataAsFile(TEMPLATE_ROWS, format, `trainee-import-template.${format}`);
  };

  const exportUsers = async (format: FileFormat) => {
    if (!users.length) {
      setError('No trainees available to export.');
      return;
    }

    const rows = users.map((user) => ({
      fullName: user.full_name,
      email: user.email,
      isActive: user.is_active ? 'TRUE' : 'FALSE',
      role: 'user',
    }));

    await downloadDataAsFile(rows, format, `trainees-export-${new Date().toISOString().slice(0, 10)}.${format}`);
  };

  const closeImportModal = () => {
    if (isImporting) return;
    setIsImportModalOpen(false);
    setImportRows([]);
    setImportFileName('');
    setImportError('');
    setImportStatusMessage('');
  };

  const openImportModal = () => {
    setImportError('');
    setImportStatusMessage('');
    setImportRows([]);
    setImportFileName('');
    setIsImportModalOpen(true);
  };

  const handleImportFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportError('');
    setImportStatusMessage('');
    setImportFileName(file.name);

    try {
      const XLSX = await loadSpreadsheetTools();
      const content = await file.arrayBuffer();
      const workbook = XLSX.read(content, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        throw new Error('The selected file has no worksheet.');
      }

      const worksheet = workbook.Sheets[firstSheetName];
      const rawRows = XLSX.utils.sheet_to_json<SpreadsheetRow>(worksheet, { defval: '' });

      if (rawRows.length === 0) {
        throw new Error('The file is empty. Add at least one row before importing.');
      }

      setImportRows(buildImportPreviewRows(rawRows));
    } catch (fileError) {
      setImportRows([]);
      setImportError(fileError instanceof Error ? fileError.message : 'Failed to read the selected file.');
    } finally {
      event.target.value = '';
    }
  };

  const handleConfirmImport = async () => {
    const validRows = importRows.filter((row) => row.errors.length === 0);
    if (!validRows.length) {
      setImportError('No valid rows available to import. Fix errors or upload another file.');
      return;
    }

    setImportError('');
    setImportStatusMessage('');
    setIsImporting(true);

    const failedRows: ImportPreviewRow[] = [];
    let importedCount = 0;

    for (const row of validRows) {
      try {
        await createUser({
          fullName: row.fullName,
          email: row.email,
          role: 'user',
          isActive: row.isActive,
        });
        importedCount += 1;
      } catch (importActionError) {
        const message = importActionError instanceof Error ? importActionError.message : 'Import failed for this row.';
        failedRows.push({ ...row, errors: [message] });
      }
    }

    await loadUsers();
    setIsImporting(false);

    if (failedRows.length === 0) {
      closeImportModal();
      setImportStatusMessage(`Successfully imported ${importedCount} trainee(s).`);
      return;
    }

    setImportRows(failedRows);
    setImportStatusMessage(`Imported ${importedCount} trainee(s). ${failedRows.length} row(s) still have errors.`);
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
  const importRowsWithErrors = useMemo(() => importRows.filter((row) => row.errors.length > 0).length, [importRows]);
  const importRowsReady = useMemo(() => importRows.filter((row) => row.errors.length === 0).length, [importRows]);

  return (
    <section className="space-y-6">
      <div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-300">User Admin</p>
          <h2 className="text-2xl font-bold text-white">Trainee Management</h2>
          <p className="text-slate-400">CRUD for trainees only. Administrator accounts are excluded from this tab.</p>
        </div>
      </div>

      {error ? <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
      {importStatusMessage ? (
        <p className="rounded-md border border-emerald-300/40 bg-emerald-500/10 p-3 text-sm text-emerald-200">{importStatusMessage}</p>
      ) : null}
      {isLoading ? <p className="text-sm text-slate-400">Loading trainees...</p> : null}

      {!isLoading ? (
        <>
          <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-900/55 shadow-sm">
            <div className="border-b border-white/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative w-full sm:w-[300px] md:w-[340px]">
                  <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search trainee by name or email..."
                    className="w-full rounded-lg border border-white/15 bg-slate-950/70 py-2 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-brand-400 focus:outline-none"
                  />
                  </div>

                  <div className="inline-flex rounded-xl border border-white/15 bg-slate-900/70 p-1 text-sm shadow-sm">
                    <button
                      onClick={() => setViewMode('list')}
                      title="List view"
                      aria-label="List view"
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold ${
                        viewMode === 'list' ? 'bg-brand-600 text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <List size={14} />
                      List
                    </button>
                    <button
                      onClick={() => setViewMode('grid')}
                      title="Grid view"
                      aria-label="Grid view"
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold ${
                        viewMode === 'grid' ? 'bg-brand-600 text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <LayoutGrid size={14} />
                      Grid
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-500"
                  >
                    <Plus size={15} />
                    Create Trainee
                  </button>
                </div>

                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={openImportModal}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10"
                  >
                    <Upload size={15} />
                    Import
                  </button>
                  <button
                    type="button"
                    onClick={() => void exportUsers('csv')}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10"
                  >
                    <Download size={15} />
                    Export CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => void exportUsers('xlsx')}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10"
                  >
                    <Download size={15} />
                    Export XLSX
                  </button>
                </div>
              </div>
            </div>

            {viewMode === 'list' ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] table-fixed text-sm">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/5 text-xs uppercase tracking-wider text-slate-400">
                      <th className="w-[24%] px-4 py-3 text-left">Name</th>
                      <th className="w-[28%] px-4 py-3 text-left">Email</th>
                      <th className="w-[12%] px-4 py-3 text-center">Status</th>
                      <th className="w-[22%] px-4 py-3 text-center">Password</th>
                      <th className="w-[24%] px-4 py-3 text-center">Actions</th>
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
                          <div className="flex flex-wrap justify-center gap-2">
                            {editingId === user.id ? (
                              <>
                                <button
                                  onClick={() => void handleSaveEdit()}
                                  disabled={isSaving}
                                  aria-label="Save trainee changes"
                                  title="Save"
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-sky-400/60 bg-sky-500/15 text-sky-200 hover:bg-sky-500/30 disabled:opacity-60"
                                >
                                  <Check size={14} />
                                </button>
                                <button
                                  onClick={() => setEditingId(null)}
                                  disabled={isSaving}
                                  aria-label="Cancel edit"
                                  title="Cancel"
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/20 text-slate-200 hover:bg-white/10 disabled:opacity-60"
                                >
                                  <X size={14} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => startEdit(user)}
                                  disabled={isSaving}
                                  aria-label={`Edit ${user.full_name}`}
                                  title="Edit"
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/20 text-slate-200 hover:bg-white/10 disabled:opacity-60"
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  onClick={() => void openProfile(user.id)}
                                  disabled={isSaving}
                                  aria-label={`View profile of ${user.full_name}`}
                                  title="View Profile"
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-brand-500/40 text-brand-300 hover:bg-brand-500/10 disabled:opacity-60"
                                >
                                  <Eye size={14} />
                                </button>
                                <button
                                  onClick={() => void handleToggleStatus(user)}
                                  disabled={isSaving}
                                  aria-label={user.is_active ? `Deactivate ${user.full_name}` : `Activate ${user.full_name}`}
                                  title={user.is_active ? 'Deactivate' : 'Activate'}
                                  className={`inline-flex h-8 w-8 items-center justify-center rounded-md border disabled:opacity-60 ${
                                    user.is_active
                                      ? 'border-amber-400/50 text-amber-200 hover:bg-amber-500/10'
                                      : 'border-emerald-400/50 text-emerald-200 hover:bg-emerald-500/10'
                                  }`}
                                >
                                  {user.is_active ? <UserX size={14} /> : <UserCheck size={14} />}
                                </button>
                                <button
                                  onClick={() => void handleDelete(user)}
                                  disabled={isSaving}
                                  aria-label={`Delete ${user.full_name}`}
                                  title="Delete"
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-rose-300/60 text-rose-200 hover:bg-rose-500/10 disabled:opacity-60"
                                >
                                  <Trash2 size={14} />
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
              <div className="p-4">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {filteredUsers.map((user) => (
                    <article key={user.id} className="rounded-xl border border-white/10 bg-slate-900/70 p-4 shadow-sm">
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
                      aria-label={`Edit ${user.full_name}`}
                      title="Edit"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/20 text-slate-200 hover:bg-white/10 disabled:opacity-60"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => void openProfile(user.id)}
                      disabled={isSaving}
                      aria-label={`View profile of ${user.full_name}`}
                      title="View Profile"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-brand-500/40 text-brand-300 hover:bg-brand-500/10 disabled:opacity-60"
                    >
                      <Eye size={14} />
                    </button>
                    <button
                      onClick={() => void handleToggleStatus(user)}
                      disabled={isSaving}
                      aria-label={user.is_active ? `Deactivate ${user.full_name}` : `Activate ${user.full_name}`}
                      title={user.is_active ? 'Deactivate' : 'Activate'}
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-md border disabled:opacity-60 ${
                        user.is_active
                          ? 'border-amber-400/50 text-amber-200 hover:bg-amber-500/10'
                          : 'border-emerald-400/50 text-emerald-200 hover:bg-emerald-500/10'
                      }`}
                    >
                      {user.is_active ? <UserX size={14} /> : <UserCheck size={14} />}
                    </button>
                    <button
                      onClick={() => void handleDelete(user)}
                      disabled={isSaving}
                      aria-label={`Delete ${user.full_name}`}
                      title="Delete"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-rose-300/60 text-rose-200 hover:bg-rose-500/10 disabled:opacity-60"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                    </article>
                  ))}
                  {filteredUsers.length === 0 ? (
                    <div className="rounded-xl border border-white/10 bg-slate-900/70 p-6 text-sm text-slate-400 md:col-span-2 xl:col-span-3">
                      No trainees found.
                    </div>
                  ) : null}
                </div>
              </div>
            )}
            </div>

          {isImportModalOpen ? (
            <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
              <div className="w-full max-w-6xl rounded-xl border border-white/10 bg-slate-900/95 p-5 shadow-2xl">
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-300">Bulk Upload</p>
                    <h3 className="text-xl font-bold text-white">Import Trainees</h3>
                    <p className="text-sm text-slate-300">
                      Required columns: <span className="font-semibold">fullName, email</span>. Optional:{' '}
                      <span className="font-semibold">isActive, role</span> (role must be user).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeImportModal}
                    disabled={isImporting}
                    className="rounded-md border border-white/20 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10 disabled:opacity-60"
                  >
                    Close
                  </button>
                </div>

                <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-white/5 p-3">
                  <button
                    type="button"
                    onClick={() => void downloadTemplate('csv')}
                    className="inline-flex items-center gap-1.5 rounded-md border border-white/20 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-white/10"
                  >
                    <Download size={14} />
                    Download CSV Template
                  </button>
                  <button
                    type="button"
                    onClick={() => void downloadTemplate('xlsx')}
                    className="inline-flex items-center gap-1.5 rounded-md border border-white/20 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-white/10"
                  >
                    <Download size={14} />
                    Download XLSX Template
                  </button>
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-500">
                    <Upload size={14} />
                    Upload File
                    <input
                      type="file"
                      accept=".csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                      onChange={handleImportFileSelect}
                      className="hidden"
                      disabled={isImporting}
                    />
                  </label>
                  {importFileName ? <span className="text-xs text-slate-300">Loaded file: {importFileName}</span> : null}
                </div>

                {importError ? <p className="mb-3 rounded-md border border-rose-300/40 bg-rose-500/10 p-3 text-sm text-rose-200">{importError}</p> : null}
                {importRows.length > 0 ? (
                  <div className="mb-4 rounded-lg border border-white/10 bg-slate-950/50">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2 text-xs text-slate-300">
                      <p>
                        Rows loaded: <span className="font-semibold text-white">{importRows.length}</span> | Ready:{' '}
                        <span className="font-semibold text-emerald-300">{importRowsReady}</span> | Errors:{' '}
                        <span className="font-semibold text-rose-300">{importRowsWithErrors}</span>
                      </p>
                    </div>
                    <div className="max-h-[48vh] overflow-auto">
                      <table className="w-full min-w-[900px] table-fixed text-sm">
                        <thead className="sticky top-0 bg-slate-900/95">
                          <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-300">
                            <th className="w-[7%] px-3 py-2 text-left">Row</th>
                            <th className="w-[23%] px-3 py-2 text-left">Full Name</th>
                            <th className="w-[25%] px-3 py-2 text-left">Email</th>
                            <th className="w-[12%] px-3 py-2 text-left">isActive</th>
                            <th className="w-[10%] px-3 py-2 text-left">Role</th>
                            <th className="w-[23%] px-3 py-2 text-left">Validation</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importRows.map((row) => (
                            <tr
                              key={`import-row-${row.rowNumber}-${row.email}`}
                              className={`border-b border-white/5 ${row.errors.length ? 'bg-rose-500/5' : 'bg-emerald-500/5'}`}
                            >
                              <td className="px-3 py-2 text-slate-300">{row.rowNumber}</td>
                              <td className="px-3 py-2 text-slate-100">{row.fullName || '-'}</td>
                              <td className="px-3 py-2 text-slate-100">{row.email || '-'}</td>
                              <td className="px-3 py-2 text-slate-100">{row.isActive ? 'TRUE' : 'FALSE'}</td>
                              <td className="px-3 py-2 text-slate-100">{row.role}</td>
                              <td className={`px-3 py-2 text-xs ${row.errors.length ? 'text-rose-200' : 'text-emerald-200'}`}>
                                {row.errors.length ? row.errors.join('; ') : 'Ready to import'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <p className="mb-4 rounded-lg border border-dashed border-white/15 bg-white/5 p-5 text-sm text-slate-400">
                    Upload a CSV or XLSX file to preview and validate rows before importing.
                  </p>
                )}

                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeImportModal}
                    disabled={isImporting}
                    className="rounded-md border border-white/20 px-4 py-2 text-sm font-semibold text-slate-200 disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportRows([])}
                    disabled={isImporting || importRows.length === 0}
                    className="rounded-md border border-white/20 px-4 py-2 text-sm font-semibold text-slate-200 disabled:opacity-60"
                  >
                    Clear Preview
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleConfirmImport()}
                    disabled={isImporting || importRows.length === 0 || importRowsWithErrors > 0}
                    className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-60"
                  >
                    {isImporting ? 'Importing...' : `Confirm Import (${importRowsReady})`}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

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
                  <p className="rounded-md border border-brand-400/30 bg-brand-500/10 px-3 py-2 text-xs text-brand-100 md:col-span-2">
                    Default password for new trainees is <span className="font-semibold">password123</span>. Users must
                    change it on first login.
                  </p>
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
