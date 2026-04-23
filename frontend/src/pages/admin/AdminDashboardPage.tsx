import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { getEnrollments, getModules, getResults, getUsers } from '../../lib/api';
import { getCurrentUser } from '../../lib/auth';
import type { Enrollment, ModuleSummary, QuizResult } from '../../types/lms';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseDateMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function formatPercent(value: number): string {
  const fixed = Number.isFinite(value) ? value.toFixed(1) : '0.0';
  return fixed.endsWith('.0') ? `${fixed.slice(0, -2)}%` : `${fixed}%`;
}

function DashboardStatCard({
  label,
  value,
  subtext,
  icon: Icon,
}: {
  label: string;
  value: string;
  subtext: string;
  icon: LucideIcon;
}) {
  return (
    <article className="dark-glass-card border-white/10 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-bold text-white">{value}</p>
          <p className="mt-1 text-xs text-slate-400">{subtext}</p>
        </div>
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-500/10 text-cyan-300">
          <Icon size={18} />
        </span>
      </div>
    </article>
  );
}

export function AdminDashboardPage() {
  const [modules, setModules] = useState<ModuleSummary[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [results, setResults] = useState<QuizResult[]>([]);
  const [usersById, setUsersById] = useState<Map<number, string>>(new Map());
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError('');
      try {
        const [moduleRows, enrollmentRows, resultRows, userRows] = await Promise.all([
          getModules(),
          getEnrollments(),
          getResults(),
          getUsers(),
        ]);
        setModules(moduleRows);
        setEnrollments(enrollmentRows);
        setResults(resultRows);
        setUsersById(new Map(userRows.map((user) => [user.id, user.full_name])));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load dashboard.');
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, []);

  const currentUser = getCurrentUser();
  const todayLabel = new Date().toLocaleDateString(undefined, {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });

  const totalModules = modules.length;
  const publishedModules = useMemo(() => modules.filter((module) => module.is_active).length, [modules]);

  const activeTraineesCount = useMemo(
    () => new Set(enrollments.filter((row) => row.status === 'in_progress').map((row) => row.user_id)).size,
    [enrollments]
  );

  const activeTraineesThisWeek = useMemo(() => {
    const cutoff = Date.now() - 7 * MS_PER_DAY;
    return new Set(
      enrollments
        .filter((row) => row.status === 'in_progress')
        .filter((row) => (parseDateMs(row.enrolled_at) ?? 0) >= cutoff)
        .map((row) => row.user_id)
    ).size;
  }, [enrollments]);

  const completedEnrollments = useMemo(
    () => enrollments.filter((row) => row.status === 'completed').length,
    [enrollments]
  );

  const passedResultsCount = useMemo(() => results.filter((result) => result.passed).length, [results]);

  const passRate = useMemo(
    () => (results.length > 0 ? (passedResultsCount / results.length) * 100 : 0),
    [passedResultsCount, results.length]
  );

  const averageScore = useMemo(() => {
    if (results.length === 0) return 0;
    const total = results.reduce((sum, row) => sum + (Number(row.score) || 0), 0);
    return total / results.length;
  }, [results]);

  const recentResults = useMemo(
    () => [...results].sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()).slice(0, 6),
    [results]
  );

  const modulesOverviewRows = useMemo(
    () =>
      [...modules]
        .sort((a, b) => Number(b.is_active) - Number(a.is_active) || a.title.localeCompare(b.title))
        .slice(0, 6),
    [modules]
  );

  const learnerStatus = useMemo(() => {
    const enrolled = enrollments.filter((row) => row.status === 'enrolled').length;
    const inProgress = enrollments.filter((row) => row.status === 'in_progress').length;
    const completed = enrollments.filter((row) => row.status === 'completed').length;
    const total = Math.max(enrolled + inProgress + completed, 1);

    return {
      total,
      rows: [
        { label: 'Enrolled', value: enrolled, color: 'bg-cyan-400' },
        { label: 'In Progress', value: inProgress, color: 'bg-amber-400' },
        { label: 'Completed', value: completed, color: 'bg-emerald-400' },
      ],
    };
  }, [enrollments]);

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Welcome back, {currentUser?.fullName ?? 'Admin'}</h2>
          <p className="text-sm text-slate-400">Here&apos;s what&apos;s happening with the training platform today.</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-300">
          <CalendarDays size={14} className="text-brand-300" />
          {todayLabel}
        </span>
      </div>

      {error ? <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
      {isLoading ? <p className="text-sm text-slate-400">Loading dashboard...</p> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardStatCard
          label="Total Modules"
          value={totalModules.toLocaleString()}
          subtext={`${publishedModules.toLocaleString()} published`}
          icon={BookOpen}
        />
        <DashboardStatCard
          label="Active Trainees"
          value={activeTraineesCount.toLocaleString()}
          subtext={`+${activeTraineesThisWeek.toLocaleString()} this week`}
          icon={Users}
        />
        <DashboardStatCard
          label="Completions"
          value={completedEnrollments.toLocaleString()}
          subtext={`${formatPercent(passRate)} success rate`}
          icon={CheckCircle2}
        />
        <DashboardStatCard
          label="Avg. Score"
          value={formatPercent(averageScore)}
          subtext={`${results.length.toLocaleString()} attempts`}
          icon={BarChart3}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,1fr)]">
        <article className="dark-glass-card border-white/10 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-300">Recent Activity</h3>
            <span className="text-xs font-semibold text-brand-300">View All</span>
          </div>

          {recentResults.length === 0 ? <p className="text-sm text-slate-400">No assessment submissions yet.</p> : null}

          {recentResults.length > 0 ? (
            <ul className="space-y-3">
              {recentResults.map((result) => (
                <li
                  key={`recent-result-${result.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-slate-900/35 px-3 py-2.5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
                        result.passed
                          ? 'border-emerald-400/35 bg-emerald-500/10 text-emerald-300'
                          : 'border-rose-400/35 bg-rose-500/10 text-rose-300'
                      }`}
                    >
                      {result.passed ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-100">
                        {usersById.get(result.user_id) ?? `User #${result.user_id}`}
                      </p>
                      <p className="truncate text-xs text-slate-300">
                        {result.quiz_title ?? `Assessment #${result.quiz_id}`}
                      </p>
                      <p className="text-xs text-slate-400">{new Date(result.submitted_at).toLocaleString()}</p>
                    </div>
                  </div>

                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                      result.passed ? 'bg-emerald-500/15 text-emerald-200' : 'bg-rose-500/15 text-rose-200'
                    }`}
                  >
                    {result.passed ? 'Passed' : 'Failed'}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </article>

        <article className="dark-glass-card border-white/10 p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-slate-300">Modules Overview</h3>

          {modulesOverviewRows.length === 0 ? <p className="text-sm text-slate-400">No modules available.</p> : null}

          {modulesOverviewRows.length > 0 ? (
            <div className="space-y-2.5">
              {modulesOverviewRows.map((module) => (
                <div key={module.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="inline-flex min-w-0 items-center gap-2 text-slate-200">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${module.is_active ? 'bg-emerald-400' : 'bg-slate-500'}`}
                    />
                    <span className="truncate">{module.title}</span>
                  </span>
                  <span className={`font-semibold uppercase tracking-wide ${module.is_active ? 'text-emerald-300' : 'text-slate-400'}`}>
                    {module.is_active ? 'Published' : 'Unpublished'}
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-5 border-t border-white/10 pt-4">
            <h4 className="text-xs font-semibold uppercase tracking-[0.13em] text-slate-300">Learner Status Distribution</h4>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800/70">
              <div className="flex h-full w-full">
                {learnerStatus.rows.map((status) => (
                  <span
                    key={`learner-status-${status.label}`}
                    className={status.color}
                    style={{ width: `${(status.value / learnerStatus.total) * 100}%` }}
                  />
                ))}
              </div>
            </div>
            <div className="mt-3 space-y-1.5">
              {learnerStatus.rows.map((status) => (
                <div key={`learner-status-row-${status.label}`} className="flex items-center justify-between text-xs text-slate-300">
                  <span className="inline-flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${status.color}`} />
                    {status.label}
                  </span>
                  <span>{status.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
