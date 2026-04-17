import { useEffect, useMemo, useState } from 'react';
import { StatCard } from '../../components/app/StatCard';
import { getAdminDashboard, getEnrollments, getModules, getResults } from '../../lib/api';
import type { Enrollment, ModuleSummary, QuizResult } from '../../types/lms';

export function AdminDashboardPage() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalEnrollments: 0,
    averageScore: 0,
    completionRate: 0,
  });
  const [modules, setModules] = useState<ModuleSummary[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [results, setResults] = useState<QuizResult[]>([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError('');
      try {
        const [dashboard, moduleRows, enrollmentRows, resultRows] = await Promise.all([
          getAdminDashboard(),
          getModules(),
          getEnrollments(),
          getResults(),
        ]);
        setStats(dashboard);
        setModules(moduleRows);
        setEnrollments(enrollmentRows);
        setResults(resultRows);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load dashboard.');
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, []);

  const enrollmentByModule = useMemo(() => {
    const counts = new Map<number, number>();
    enrollments.forEach((enrollment) => {
      counts.set(enrollment.module_id, (counts.get(enrollment.module_id) ?? 0) + 1);
    });
    return modules
      .map((module) => ({
        module,
        enrollments: counts.get(module.id) ?? 0,
      }))
      .sort((a, b) => b.enrollments - a.enrollments)
      .slice(0, 5);
  }, [enrollments, modules]);

  const scoreBandCounts = useMemo(() => {
    const ranges = [
      { label: '90-100', min: 90, max: 100 },
      { label: '80-89', min: 80, max: 89.999 },
      { label: '70-79', min: 70, max: 79.999 },
      { label: 'Below 70', min: 0, max: 69.999 },
    ];
    return ranges.map((range) => ({
      label: range.label,
      count: results.filter((result) => result.score >= range.min && result.score <= range.max).length,
    }));
  }, [results]);

  const maxBandCount = Math.max(1, ...scoreBandCounts.map((item) => item.count));
  const completionRows = [
    { label: 'Completed', value: Math.round((stats.totalEnrollments * stats.completionRate) / 100) },
    { label: 'In Progress', value: Math.max(stats.totalEnrollments - Math.round((stats.totalEnrollments * stats.completionRate) / 100), 0) },
  ];

  const recentResults = useMemo(
    () => [...results].sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()).slice(0, 6),
    [results]
  );

  return (
    <section className="space-y-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-300">Command Center</p>
        <h2 className="text-2xl font-bold text-white">Admin Dashboard</h2>
        <p className="text-slate-400">Monitor user activity, enrollment trends, and learning outcomes.</p>
      </div>

      {error ? <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
      {isLoading ? <p className="text-sm text-slate-400">Loading dashboard...</p> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Users" value={stats.totalUsers} />
        <StatCard label="Total Enrollments" value={stats.totalEnrollments} />
        <StatCard label="Average Score" value={`${stats.averageScore}%`} />
        <StatCard label="Completion Rate" value={`${stats.completionRate}%`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <article className="dark-glass-card border-white/10 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-300">Top Modules By Enrollment</h3>
            <span className="text-xs text-slate-400">{enrollments.length} total enrollments</span>
          </div>
          <div className="space-y-3">
            {enrollmentByModule.map((row) => {
              const width = stats.totalEnrollments > 0 ? Math.max((row.enrollments / stats.totalEnrollments) * 100, 4) : 4;
              return (
                <div key={`module-enroll-${row.module.id}`}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="truncate text-slate-200">{row.module.title}</span>
                    <span className="text-brand-300">{row.enrollments}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-800/70">
                    <div className="h-full rounded-full bg-brand-500" style={{ width: `${width}%` }} />
                  </div>
                </div>
              );
            })}
            {enrollmentByModule.length === 0 ? <p className="text-sm text-slate-400">No enrollments yet.</p> : null}
          </div>
        </article>

        <article className="dark-glass-card border-white/10 p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-slate-300">Assessment Score Bands</h3>
          <div className="space-y-3">
            {scoreBandCounts.map((band) => (
              <div key={`score-band-${band.label}`}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-slate-200">{band.label}</span>
                  <span className="text-brand-300">{band.count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-800/70">
                  <div className="h-full rounded-full bg-cyan-400" style={{ width: `${Math.max((band.count / maxBandCount) * 100, 4)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
        <article className="dark-glass-card border-white/10 p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-slate-300">Completion Funnel</h3>
          <div className="space-y-3">
            {completionRows.map((row) => (
              <div key={`completion-${row.label}`}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-slate-200">{row.label}</span>
                  <span className="text-brand-300">{row.value}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-800/70">
                  <div
                    className={`h-full rounded-full ${row.label === 'Completed' ? 'bg-emerald-400' : 'bg-amber-400'}`}
                    style={{ width: `${stats.totalEnrollments > 0 ? Math.max((row.value / stats.totalEnrollments) * 100, 4) : 4}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="dark-glass-card border-white/10 p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-slate-300">Recent Assessment Activity</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-slate-400">
                  <th className="px-2 py-2">Module</th>
                  <th className="px-2 py-2">Quiz</th>
                  <th className="px-2 py-2">Score</th>
                  <th className="px-2 py-2">Result</th>
                  <th className="px-2 py-2">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {recentResults.map((result) => (
                  <tr key={`recent-result-${result.id}`} className="border-b border-white/5 text-slate-200">
                    <td className="px-2 py-2">{result.module_title ?? '-'}</td>
                    <td className="px-2 py-2">{result.quiz_title ?? '-'}</td>
                    <td className="px-2 py-2">{Number(result.score).toFixed(0)}%</td>
                    <td className="px-2 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                          result.passed ? 'bg-emerald-500/15 text-emerald-200' : 'bg-rose-500/15 text-rose-200'
                        }`}
                      >
                        {result.passed ? 'Passed' : 'Failed'}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-slate-400">{new Date(result.submitted_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {recentResults.length === 0 ? <p className="mt-3 text-sm text-slate-400">No assessment submissions yet.</p> : null}
          </div>
        </article>
      </div>
    </section>
  );
}
