import { ArrowRight, BookOpenCheck, Clock3, GraduationCap, ListChecks, Trophy } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getEnrollmentProgress,
  getEnrollmentResults,
  getEnrollments,
  getModules,
  getQuizzesByModule,
  getUserDashboard,
} from '../../lib/api';
import type { Enrollment, LessonSummary, ModuleSummary, QuizResult, QuizSummary } from '../../types/lms';

interface EnrollmentSnapshot {
  enrollment: Enrollment;
  module: ModuleSummary | null;
  completionPercent: number;
  completedLessons: number;
  totalLessons: number;
  nextLesson: LessonSummary | null;
}

interface AssessmentStatusItem {
  id: number;
  title: string;
  stage: 'Pre Test' | 'Post Test' | 'Final Test';
  status: 'Passed' | 'Failed' | 'Retake Available' | 'Not Taken';
  latestScore: number | null;
  attemptsUsed: number;
  attemptsLimit: number;
}

function getQuizStage(quiz: QuizSummary): 'Pre Test' | 'Post Test' | 'Final Test' {
  if (quiz.quiz_type === 'final_exam') return 'Final Test';
  if (/\bpre[-\s]?test\b/i.test(quiz.title)) return 'Pre Test';
  return 'Post Test';
}

function getStageOrder(stage: AssessmentStatusItem['stage']): number {
  if (stage === 'Pre Test') return 1;
  if (stage === 'Post Test') return 2;
  return 3;
}

function pickContinueSnapshot(rows: EnrollmentSnapshot[]): EnrollmentSnapshot | null {
  if (!rows.length) return null;
  const activeRows = rows.filter((row) => row.completionPercent < 100);
  if (!activeRows.length) return rows[0];

  const prioritized = activeRows.filter((row) => Boolean(row.enrollment.last_lesson_id));
  const source = prioritized.length ? prioritized : activeRows;
  return [...source].sort((a, b) => b.completionPercent - a.completionPercent)[0] ?? source[0];
}

function getAssessmentStatusClass(status: AssessmentStatusItem['status']) {
  if (status === 'Passed') return 'bg-emerald-100 text-emerald-700';
  if (status === 'Failed') return 'bg-rose-100 text-rose-700';
  if (status === 'Retake Available') return 'bg-amber-100 text-amber-700';
  return 'bg-slate-100 text-slate-600';
}

export function UserDashboardPage() {
  const [stats, setStats] = useState({ enrollments: 0, averageScore: 0, completedModules: 0 });
  const [enrollmentSnapshots, setEnrollmentSnapshots] = useState<EnrollmentSnapshot[]>([]);
  const [availableModules, setAvailableModules] = useState<ModuleSummary[]>([]);
  const [assessmentItems, setAssessmentItems] = useState<AssessmentStatusItem[]>([]);
  const [assessmentModuleTitle, setAssessmentModuleTitle] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const overallCompletion = useMemo(() => {
    if (!enrollmentSnapshots.length) return 0;
    const total = enrollmentSnapshots.reduce((sum, item) => sum + item.completionPercent, 0);
    return Math.round(total / enrollmentSnapshots.length);
  }, [enrollmentSnapshots]);

  const continueSnapshot = useMemo(() => pickContinueSnapshot(enrollmentSnapshots), [enrollmentSnapshots]);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setIsLoading(true);
      setError('');

      try {
        const [dashboard, modules, enrollments] = await Promise.all([getUserDashboard(), getModules(), getEnrollments()]);
        const activeModules = modules.filter((module) => module.is_active);
        const moduleById = new Map(activeModules.map((module) => [module.id, module]));

        const snapshotRows = await Promise.all(
          enrollments.map(async (enrollment) => {
            const progress = await getEnrollmentProgress(enrollment.id);
            const completedLessons = progress.lessons.filter((lesson) => lesson.completed).length;
            const nextLesson = progress.lessons.find((lesson) => !lesson.completed) ?? null;

            return {
              enrollment,
              module: moduleById.get(enrollment.module_id) ?? null,
              completionPercent: progress.completionPercent,
              completedLessons,
              totalLessons: progress.lessons.length,
              nextLesson,
            };
          })
        );

        const enrolledIds = new Set(enrollments.map((enrollment) => enrollment.module_id));
        const recommended = activeModules.filter((module) => !enrolledIds.has(module.id)).slice(0, 6);

        const currentSnapshot = pickContinueSnapshot(snapshotRows);
        if (currentSnapshot) {
          const [quizzes, results] = await Promise.all([
            getQuizzesByModule(currentSnapshot.enrollment.module_id),
            getEnrollmentResults(currentSnapshot.enrollment.id),
          ]);

          const resultByQuizId = new Map<number, QuizResult[]>();
          results.forEach((result) => {
            const current = resultByQuizId.get(result.quiz_id) ?? [];
            current.push(result);
            resultByQuizId.set(result.quiz_id, current);
          });

          const rows = quizzes
            .filter((quiz) => quiz.is_active)
            .map((quiz) => {
              const quizResults = [...(resultByQuizId.get(quiz.id) ?? [])].sort((a, b) => b.attempt_no - a.attempt_no);
              const latestResult = quizResults[0] ?? null;
              const attemptsUsed = quizResults.length;

              let status: AssessmentStatusItem['status'] = 'Not Taken';
              if (latestResult?.passed) {
                status = 'Passed';
              } else if (latestResult && attemptsUsed >= quiz.attempt_limit) {
                status = 'Failed';
              } else if (latestResult) {
                status = 'Retake Available';
              }

              return {
                id: quiz.id,
                title: quiz.title,
                stage: getQuizStage(quiz),
                status,
                latestScore: latestResult?.score ?? null,
                attemptsUsed,
                attemptsLimit: quiz.attempt_limit,
              } satisfies AssessmentStatusItem;
            })
            .sort((a, b) => getStageOrder(a.stage) - getStageOrder(b.stage));

          if (isMounted) {
            setAssessmentModuleTitle(currentSnapshot.module?.title ?? `Module #${currentSnapshot.enrollment.module_id}`);
            setAssessmentItems(rows);
          }
        } else if (isMounted) {
          setAssessmentItems([]);
          setAssessmentModuleTitle('');
        }

        if (!isMounted) return;
        setStats(dashboard);
        setEnrollmentSnapshots(snapshotRows);
        setAvailableModules(recommended);
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load dashboard.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr] lg:items-end">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">Command Center</span>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">Welcome back</h2>
            <p className="mt-1 text-sm text-slate-600">Continue where you left off, monitor assessments, and keep your module momentum.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link to="/user/modules" className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500">
                Continue Learning
                <ArrowRight size={16} />
              </Link>
              <Link to="/user/progress" className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                View Progress
              </Link>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Enrolled</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{stats.enrollments}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Completed</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{stats.completedModules}</p>
            </div>
          </div>
        </div>
      </div>

      {error ? <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
      {isLoading ? <p className="text-sm text-slate-500">Loading dashboard...</p> : null}

      {!isLoading ? (
        <>
          <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
            <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <BookOpenCheck size={16} className="text-emerald-600" />
                Continue Where You Left Off
              </div>

              {continueSnapshot ? (
                <>
                  <h3 className="mt-3 text-xl font-bold text-slate-900">
                    {continueSnapshot.module?.title ?? `Module #${continueSnapshot.enrollment.module_id}`}
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Next: {continueSnapshot.nextLesson?.title ?? 'Final module check'}{' '}
                    {continueSnapshot.nextLesson?.estimated_minutes ? `· ${continueSnapshot.nextLesson.estimated_minutes} min` : ''}
                  </p>
                  <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                    <div className="mb-1.5 flex items-center justify-between text-xs font-semibold">
                      <span className="uppercase tracking-wider text-slate-500">Overall Module Progress</span>
                      <span className="text-emerald-700">{continueSnapshot.completionPercent}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${Math.max(0, Math.min(100, continueSnapshot.completionPercent))}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-slate-600">
                      {continueSnapshot.completedLessons}/{continueSnapshot.totalLessons} lessons completed
                    </p>
                  </div>
                  <div className="mt-4">
                    <Link
                      to={`/user/modules/${continueSnapshot.enrollment.module_id}`}
                      className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
                    >
                      Resume Module
                      <ArrowRight size={16} />
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <p className="mt-3 text-sm text-slate-600">No active module yet. Start your first module to build progress here.</p>
                  <div className="mt-4">
                    <Link to="/user/modules" className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500">
                      Browse Modules
                    </Link>
                  </div>
                </>
              )}
            </article>

            <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Trophy size={16} className="text-emerald-600" />
                Learning Snapshot
              </div>
              <div className="mt-4 space-y-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Average Completion</p>
                  <p className="mt-1 text-xl font-bold text-slate-900">{overallCompletion}%</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Assessment Performance</p>
                  <p className="mt-1 text-xl font-bold text-slate-900">{stats.averageScore}%</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Modules Completed</p>
                  <p className="mt-1 text-xl font-bold text-slate-900">{stats.completedModules}</p>
                </div>
              </div>
            </article>
          </div>

          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Assessments</p>
                <h3 className="text-lg font-bold text-slate-900">Assessment Status</h3>
              </div>
              {assessmentModuleTitle ? <p className="text-xs font-medium text-slate-600">{assessmentModuleTitle}</p> : null}
            </div>
            {assessmentItems.length ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {assessmentItems.map((item) => (
                  <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-700">
                        {item.stage}
                      </span>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${getAssessmentStatusClass(item.status)}`}>
                        {item.status}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{item.title}</p>
                    <p className="mt-1 text-xs text-slate-600">
                      Latest Score: {item.latestScore !== null ? `${item.latestScore}%` : 'No attempts yet'}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Attempts: {item.attemptsUsed}/{item.attemptsLimit}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-600">No assessment activity yet. Start a module to unlock quizzes and exams.</p>
            )}
          </article>

          <div className="grid gap-4 xl:grid-cols-2">
            <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Your Modules</p>
                  <h3 className="text-lg font-bold text-slate-900">Enrolled Snapshot</h3>
                </div>
                <Link to="/user/modules" className="text-xs font-semibold text-emerald-700 hover:underline">
                  View All
                </Link>
              </div>
              {enrollmentSnapshots.length ? (
                <div className="mt-4 space-y-3">
                  {enrollmentSnapshots.slice(0, 4).map((item) => (
                    <div key={item.enrollment.id} className="rounded-lg border border-slate-200 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{item.module?.title ?? `Module #${item.enrollment.module_id}`}</p>
                          <p className="mt-0.5 text-xs text-slate-600">
                            {item.completedLessons}/{item.totalLessons} lessons completed
                          </p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-700">
                          {item.enrollment.status}
                        </span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(0, Math.min(100, item.completionPercent))}%` }} />
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <p className="text-xs font-semibold text-emerald-700">{item.completionPercent}% complete</p>
                        <Link to={`/user/modules/${item.enrollment.module_id}`} className="text-xs font-semibold text-emerald-700 hover:underline">
                          Continue
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-600">No enrolled modules yet.</p>
              )}
            </article>

            <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Discover</p>
                  <h3 className="text-lg font-bold text-slate-900">Recommended Modules</h3>
                </div>
                <Link to="/user/modules" className="text-xs font-semibold text-emerald-700 hover:underline">
                  Browse Modules
                </Link>
              </div>
              {availableModules.length ? (
                <div className="mt-4 space-y-3">
                  {availableModules.slice(0, 4).map((module) => (
                    <div key={module.id} className="rounded-lg border border-slate-200 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{module.title}</p>
                          <p className="mt-1 max-h-[40px] overflow-hidden text-xs leading-5 text-slate-600">{module.description}</p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-700">
                          {module.category ?? 'General'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-600">You are already enrolled in all active modules.</p>
              )}
            </article>
          </div>
        </>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-center gap-4 text-center text-xs text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <GraduationCap size={14} className="text-emerald-600" />
            Keep passing post-tests to unlock final exams.
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ListChecks size={14} className="text-emerald-600" />
            Complete lessons in sequence to maintain progress.
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock3 size={14} className="text-emerald-600" />
            Resume frequently to improve completion speed.
          </span>
        </div>
      </div>
    </section>
  );
}
