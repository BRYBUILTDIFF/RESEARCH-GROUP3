import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { StatCard } from '../../components/app/StatCard';
import { getEnrollmentProgress, getEnrollments, getResults } from '../../lib/api';
import type { Enrollment, QuizResult } from '../../types/lms';

type ModuleProgressRow = {
  enrollment: Enrollment;
  completionPercent: number;
  completedLessons: number;
  totalLessons: number;
};

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
            } satisfies ModuleProgressRow;
          })
        );
        setModuleProgress(progressRows);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load progress data.');
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, []);

  const passedCount = useMemo(() => results.filter((result) => result.passed).length, [results]);
  const failedCount = useMemo(() => results.filter((result) => !result.passed).length, [results]);
  const averageScore = useMemo(() => {
    if (results.length === 0) return '0.00';
    const total = results.reduce((sum, result) => sum + Number(result.score), 0);
    return (total / results.length).toFixed(2);
  }, [results]);

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">My Progress</h2>
        <p className="text-slate-600">Track module completion, quiz outcomes, and latest assessment attempts.</p>
      </div>

      {error ? <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
      {isLoading ? <p className="text-sm text-slate-500">Loading progress...</p> : null}

      {!isLoading ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard label="Passed Attempts" value={passedCount} />
            <StatCard label="Failed Attempts" value={failedCount} />
            <StatCard label="Average Score" value={`${averageScore}%`} />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900">Module Completion</h3>
            <div className="mt-4 space-y-3">
              {moduleProgress.length === 0 ? (
                <p className="text-sm text-slate-600">No enrollments yet. Start with the modules page.</p>
              ) : (
                moduleProgress.map((item) => (
                  <article key={item.enrollment.id} className="rounded-md border border-slate-200 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-900">{item.enrollment.module_title ?? `Module #${item.enrollment.module_id}`}</p>
                        <p className="text-xs text-slate-600">
                          {item.completedLessons}/{item.totalLessons} lessons completed | Status: {item.enrollment.status}
                        </p>
                      </div>
                      <Link to={`/user/modules/${item.enrollment.module_id}`} className="text-xs font-semibold text-sky-700 hover:underline">
                        Resume Module
                      </Link>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-slate-100">
                      <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${item.completionPercent}%` }} />
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">Module</th>
                  <th className="px-4 py-3">Assessment</th>
                  <th className="px-4 py-3">Attempt</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Score</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {results.length === 0 ? (
                  <tr className="text-sm">
                    <td className="px-4 py-4 text-slate-500" colSpan={6}>
                      No quiz or exam attempts yet.
                    </td>
                  </tr>
                ) : (
                  results.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100 text-sm">
                      <td className="px-4 py-3 font-medium text-slate-900">{item.module_title ?? '-'}</td>
                      <td className="px-4 py-3 text-slate-700">{item.quiz_title ?? `Quiz #${item.quiz_id}`}</td>
                      <td className="px-4 py-3 text-slate-700">#{item.attempt_no}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            item.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {item.passed ? 'Passed' : 'Failed'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{Number(item.score)}%</td>
                      <td className="px-4 py-3 text-slate-600">{new Date(item.submitted_at).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </section>
  );
}
