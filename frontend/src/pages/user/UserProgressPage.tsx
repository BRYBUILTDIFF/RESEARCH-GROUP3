import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getEnrollmentProgress, getEnrollments, getResults } from '../../lib/api';
import type { Enrollment, QuizResult } from '../../types/lms';

type ModuleProgressRow = {
  enrollment: Enrollment;
  completionPercent: number;
  completedLessons: number;
  totalLessons: number;
  nextLessonTitle: string | null;
};

function getEnrollmentStatusClass(status: Enrollment['status']) {
  if (status === 'completed') return 'bg-brand-500/15 text-brand-300';
  if (status === 'in_progress') return 'bg-brand-500/10 text-brand-300';
  return 'bg-white/10 text-slate-200';
}

export function UserProgressPage() {
  const [results, setResults] = useState<QuizResult[]>([]);
  const [moduleProgress, setModuleProgress] = useState<ModuleProgressRow[]>([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError('');

      try {
        const [enrollments, allResults] = await Promise.all([getEnrollments(), getResults()]);
        setResults(allResults);

        const progressRows = await Promise.all(
          enrollments.map(async (enrollment) => {
            const progress = await getEnrollmentProgress(enrollment.id);
            const totalLessons = progress.lessons.length;
            const completedLessons = progress.lessons.filter((lesson) => lesson.completed).length;
            return {
              enrollment,
              completionPercent: progress.completionPercent,
              totalLessons,
              completedLessons,
              nextLessonTitle: progress.lessons.find((lesson) => !lesson.completed)?.title ?? null,
            } satisfies ModuleProgressRow;
          })
        );
        setModuleProgress(
          [...progressRows].sort((a, b) => {
            if (a.enrollment.status === 'completed' && b.enrollment.status !== 'completed') return 1;
            if (a.enrollment.status !== 'completed' && b.enrollment.status === 'completed') return -1;
            return b.completionPercent - a.completionPercent;
          })
        );
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load progress data.');
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, []);

  const overallCompletion = useMemo(() => {
    if (!moduleProgress.length) return 0;
    const total = moduleProgress.reduce((sum, item) => sum + item.completionPercent, 0);
    return Math.round(total / moduleProgress.length);
  }, [moduleProgress]);

  const completedModules = useMemo(() => moduleProgress.filter((item) => item.enrollment.status === 'completed').length, [moduleProgress]);
  const activeModules = useMemo(() => moduleProgress.filter((item) => item.enrollment.status !== 'completed').length, [moduleProgress]);
  const latestResult = useMemo(() => {
    if (!results.length) return null;
    return [...results].sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())[0];
  }, [results]);
  const nextModule = useMemo(() => {
    const rows = moduleProgress.filter((item) => item.enrollment.status !== 'completed');
    if (!rows.length) return null;
    return [...rows].sort((a, b) => b.completionPercent - a.completionPercent)[0];
  }, [moduleProgress]);
  const recentResults = useMemo(
    () => [...results].sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()).slice(0, 3),
    [results]
  );

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 shadow-sm">
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-300">Progress Overview</span>
        <h2 className="mt-1 text-2xl font-bold text-white">My Progress</h2>
        <p className="mt-1 text-sm text-slate-300">Simple view of your modules and latest assessment result.</p>
      </div>

      {error ? <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
      {isLoading ? <p className="text-sm text-slate-400">Loading progress...</p> : null}

      {!isLoading ? (
        <>
          <div className="rounded-xl border border-white/10 bg-slate-900/70 p-5 shadow-sm">
            <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr] lg:items-end">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Overall Completion</p>
                <p className="mt-1 text-3xl font-bold text-white">{overallCompletion}%</p>
                <div className="mt-3 h-2.5 rounded-full bg-white/10">
                  <div className="h-2.5 rounded-full bg-brand-500" style={{ width: `${Math.max(0, Math.min(100, overallCompletion))}%` }} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-white/10 px-2.5 py-1 font-semibold text-slate-200">Active: {activeModules}</span>
                  <span className="rounded-full bg-brand-500/15 px-2.5 py-1 font-semibold text-brand-300">Completed: {completedModules}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 lg:justify-end">
                <Link to="/user/modules" className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500">
                  Continue Learning
                </Link>
                <Link to="/user/dashboard" className="rounded-md border border-white/20 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/5">
                  Back to Dashboard
                </Link>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-slate-900/70 p-5 shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/10 pb-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Module Tracking</p>
                <h3 className="text-lg font-bold text-white">Module Completion</h3>
              </div>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {moduleProgress.length === 0 ? (
                <p className="text-sm text-slate-300">No enrollments yet. Start with the modules page.</p>
              ) : (
                moduleProgress.map((item) => (
                  <article key={item.enrollment.id} className="rounded-lg border border-white/10 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">{item.enrollment.module_title ?? `Module #${item.enrollment.module_id}`}</p>
                        <p className="mt-0.5 text-xs text-slate-300">
                          {item.completedLessons}/{item.totalLessons} lessons completed
                        </p>
                        <p className="mt-1 text-xs text-slate-400">{item.nextLessonTitle ? `Next lesson: ${item.nextLessonTitle}` : 'All lessons completed'}</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${getEnrollmentStatusClass(item.enrollment.status)}`}>
                        {item.enrollment.status}
                      </span>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-white/10">
                      <div className="h-2 rounded-full bg-brand-500" style={{ width: `${Math.max(0, Math.min(100, item.completionPercent))}%` }} />
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-xs font-semibold text-brand-300">{item.completionPercent}% complete</p>
                      <Link to={`/user/modules/${item.enrollment.module_id}`} className="text-xs font-semibold text-brand-300 hover:underline">
                        Resume Module
                      </Link>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-slate-900/70 p-5 shadow-sm">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Assessments</p>
                <h3 className="text-lg font-bold text-white">Latest Result</h3>
              </div>
              {latestResult ? (
                <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-3">
                  <p className="text-sm font-semibold text-white">{latestResult.quiz_title ?? `Quiz #${latestResult.quiz_id}`}</p>
                  <p className="mt-1 text-xs text-slate-300">{latestResult.module_title ?? '-'} · Attempt #{latestResult.attempt_no}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${latestResult.passed ? 'bg-brand-500/15 text-brand-300' : 'bg-rose-100 text-rose-700'}`}>
                      {latestResult.passed ? 'Passed' : 'Failed'}
                    </span>
                    <span className="text-sm font-semibold text-white">{Number(latestResult.score)}%</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-400">{new Date(latestResult.submitted_at).toLocaleString()}</p>
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-300">No assessment attempts yet.</p>
              )}
            </div>

            <div className="rounded-xl border border-white/10 bg-slate-900/70 p-5 shadow-sm">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Next Action</p>
                <h3 className="text-lg font-bold text-white">Next Assessment to Take</h3>
              </div>
              {nextModule ? (
                <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-3">
                  <p className="text-sm font-semibold text-white">{nextModule.enrollment.module_title ?? `Module #${nextModule.enrollment.module_id}`}</p>
                  <p className="mt-1 text-xs text-slate-300">Complete remaining lessons, then take the next unlocked test.</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-200">
                      {nextModule.completionPercent}% completed
                    </span>
                    <Link to={`/user/modules/${nextModule.enrollment.module_id}`} className="text-xs font-semibold text-brand-300 hover:underline">
                      Go to Module
                    </Link>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-300">All enrolled modules are completed.</p>
              )}
            </div>
          </div>

          {recentResults.length ? (
            <div className="rounded-xl border border-white/10 bg-slate-900/70 p-5 shadow-sm">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Recent Attempts</p>
                <h3 className="text-lg font-bold text-white">Last 3 Assessment Attempts</h3>
              </div>
              <ul className="mt-3 space-y-2">
                {recentResults.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-white/10 p-3 text-sm">
                    <div>
                      <p className="font-semibold text-white">{item.quiz_title ?? `Quiz #${item.quiz_id}`}</p>
                      <p className="text-xs text-slate-300">{item.module_title ?? '-'} · {new Date(item.submitted_at).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${item.passed ? 'bg-brand-500/15 text-brand-300' : 'bg-rose-100 text-rose-700'}`}>
                        {item.passed ? 'Passed' : 'Failed'}
                      </span>
                      <span className="text-sm font-semibold text-white">{Number(item.score)}%</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

