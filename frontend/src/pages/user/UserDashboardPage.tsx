import { ArrowRight, BookOpenCheck, Clock3, GraduationCap, ListChecks } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getEnrollmentProgress,
  getEnrollmentResults,
  getEnrollments,
  getModules,
  getQuizzesByModule,
} from '../../lib/api';
import type { Enrollment, LessonSummary, ModuleSummary, QuizResult, QuizSummary } from '../../types/lms';

interface EnrollmentSnapshot {
  enrollment: Enrollment;
  module: ModuleSummary | null;
  completionPercent: number;
  completedLessons: number;
  totalLessons: number;
  nextLesson: LessonSummary | null;
  lessons: LessonSummary[];
}

interface AssessmentStatusItem {
  id: number;
  title: string;
  stage: 'Pre Test' | 'Post Test' | 'Final Test';
  status: 'Passed' | 'Failed' | 'Retake Available' | 'Not Taken';
  latestScore: number | null;
  attemptsUsed: number;
  attemptsLimit: number;
  lessonLabel: string | null;
}

function isActivePreTest(quiz: QuizSummary) {
  return quiz.is_active && (quiz.stage === 'pre_test' || (quiz.quiz_type === 'lesson_quiz' && quiz.lesson_id === null));
}

function isActiveFinalExam(quiz: QuizSummary) {
  return quiz.is_active && (quiz.stage === 'final_exam' || quiz.quiz_type === 'final_exam');
}

function calculateDashboardProgressPercent({
  lessons,
  quizzes,
  results,
}: {
  lessons: LessonSummary[];
  quizzes: QuizSummary[];
  results: QuizResult[];
}) {
  const activePreTest = quizzes.find(isActivePreTest) ?? null;
  const activeFinalExam = quizzes.find(isActiveFinalExam) ?? null;
  const activePostTestByLessonId = new Map<number, QuizSummary>();

  quizzes
    .filter((quiz) => quiz.is_active && quiz.stage === 'post_test' && quiz.lesson_id !== null)
    .forEach((quiz) => {
      activePostTestByLessonId.set(Number(quiz.lesson_id), quiz);
    });

  const latestResultByQuizId = new Map<number, QuizResult>();
  results.forEach((result) => {
    const current = latestResultByQuizId.get(result.quiz_id);
    if (!current || result.attempt_no > current.attempt_no) {
      latestResultByQuizId.set(result.quiz_id, result);
    }
  });

  const lessonUnitCount = lessons.length;
  const assessmentUnitCount = (activePreTest ? 1 : 0) + (activeFinalExam ? 1 : 0);
  const totalUnits = lessonUnitCount + assessmentUnitCount;
  if (totalUnits === 0) return 0;

  const lessonUnitProgressSum = lessons.reduce((sum, lesson) => {
    const lessonCompleted = Boolean(lesson.completed);
    const lessonContentProgressPercent = lessonCompleted ? 100 : 0;
    const lessonPostTest = activePostTestByLessonId.get(lesson.id) ?? null;
    const lessonHasActivePostTest = Boolean(lessonPostTest);
    const lessonPostTestSharePercent = lessonHasActivePostTest ? 20 : 0;
    const lessonContentSharePercent = 100 - lessonPostTestSharePercent;
    const lessonPostTestRequirementMet = !lessonPostTest || Boolean(latestResultByQuizId.get(lessonPostTest.id)?.passed);
    const lessonProgressPercent = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          (lessonContentProgressPercent * lessonContentSharePercent) / 100 +
            (lessonPostTestRequirementMet ? lessonPostTestSharePercent : 0)
        )
      )
    );
    return sum + lessonProgressPercent / 100;
  }, 0);

  const preTestUnitProgress = activePreTest && latestResultByQuizId.get(activePreTest.id)?.passed ? 1 : 0;
  const finalExamUnitProgress = activeFinalExam && latestResultByQuizId.get(activeFinalExam.id)?.passed ? 1 : 0;
  const overallProgress = (lessonUnitProgressSum + preTestUnitProgress + finalExamUnitProgress) / totalUnits;
  return Math.max(0, Math.min(100, Math.round(overallProgress * 100)));
}

function getQuizStage(quiz: QuizSummary): 'Pre Test' | 'Post Test' | 'Final Test' {
  if (quiz.stage === 'final_exam' || quiz.quiz_type === 'final_exam') return 'Final Test';
  if (quiz.stage === 'pre_test') return 'Pre Test';
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
  if (status === 'Passed') return 'bg-brand-500/15 text-brand-300';
  if (status === 'Failed') return 'bg-rose-100 text-rose-700';
  if (status === 'Retake Available') return 'bg-amber-100 text-amber-700';
  return 'bg-white/10 text-slate-300';
}

function getAssessmentScoreFillClass(status: AssessmentStatusItem['status']) {
  if (status === 'Passed') return 'bg-emerald-400';
  if (status === 'Failed') return 'bg-rose-400';
  if (status === 'Retake Available') return 'bg-amber-400';
  return 'bg-slate-500';
}

function getAssessmentScoreTextClass(status: AssessmentStatusItem['status']) {
  if (status === 'Passed') return 'text-emerald-300';
  if (status === 'Failed') return 'text-rose-300';
  if (status === 'Retake Available') return 'text-amber-300';
  return 'text-slate-300';
}

function getEnrollmentStatusClass(status: Enrollment['status']) {
  if (status === 'completed') return 'border-emerald-300/40 bg-emerald-500/15 text-emerald-200';
  if (status === 'in_progress') return 'border-sky-300/40 bg-sky-500/15 text-sky-200';
  return 'border-slate-300/30 bg-white/10 text-slate-200';
}

function toTitleCaseStatus(status: Enrollment['status']) {
  if (status === 'in_progress') return 'In progress';
  if (status === 'completed') return 'Completed';
  return status.replaceAll('_', ' ');
}

export function UserDashboardPage() {
  const [enrollmentSnapshots, setEnrollmentSnapshots] = useState<EnrollmentSnapshot[]>([]);
  const [assessmentItems, setAssessmentItems] = useState<AssessmentStatusItem[]>([]);
  const [assessmentModuleTitle, setAssessmentModuleTitle] = useState('');
  const [assessmentModuleSnapshot, setAssessmentModuleSnapshot] = useState<EnrollmentSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const continueSnapshot = useMemo(() => pickContinueSnapshot(enrollmentSnapshots), [enrollmentSnapshots]);
  const stats = useMemo(
    () => ({
      enrollments: enrollmentSnapshots.length,
      completedModules: enrollmentSnapshots.filter((item) => item.completionPercent >= 100).length,
    }),
    [enrollmentSnapshots]
  );

  const renderAssessmentCards = () => (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {assessmentItems.map((item) => (
        <article key={item.id} className="flex h-full flex-col rounded-lg border border-white/10 bg-white/5 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-200">
              {item.stage}
            </span>
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${getAssessmentStatusClass(item.status)}`}>
              {item.status}
            </span>
          </div>
          <p className="mt-2 text-sm font-semibold text-white">{item.title}</p>
          {item.lessonLabel ? <p className="mt-1 text-xs text-slate-300">{item.lessonLabel}</p> : null}
          <p className="mt-auto pt-2 text-xs text-slate-400">
            Attempts: {item.attemptsUsed}/{item.attemptsLimit}
          </p>
          <div className="mt-2">
            <div className="mb-1 flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-300">Score</span>
              <span className={getAssessmentScoreTextClass(item.status)}>{item.latestScore !== null ? `${item.latestScore}%` : '-'}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-800/70">
              <div
                className={`h-full rounded-full ${getAssessmentScoreFillClass(item.status)}`}
                style={{ width: `${Math.max(0, Math.min(100, item.latestScore ?? 0))}%` }}
              />
            </div>
          </div>
        </article>
      ))}
    </div>
  );

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setIsLoading(true);
      setError('');

      try {
        const [modules, enrollments] = await Promise.all([getModules(), getEnrollments()]);
        const activeModules = modules.filter((module) => module.is_active);
        const moduleById = new Map(activeModules.map((module) => [module.id, module]));

        const snapshotRows = await Promise.all(
          enrollments.map(async (enrollment) => {
            const [progress, quizzesByModule, enrollmentResults] = await Promise.all([
              getEnrollmentProgress(enrollment.id),
              getQuizzesByModule(enrollment.module_id),
              getEnrollmentResults(enrollment.id),
            ]);
            const completedLessons = progress.lessons.filter((lesson) => lesson.completed).length;
            const nextLesson = progress.lessons.find((lesson) => !lesson.completed) ?? null;
            const completionPercent = calculateDashboardProgressPercent({
              lessons: progress.lessons,
              quizzes: quizzesByModule,
              results: enrollmentResults,
            });

            return {
              enrollment,
              module: moduleById.get(enrollment.module_id) ?? null,
              completionPercent,
              completedLessons,
              totalLessons: progress.lessons.length,
              nextLesson,
              lessons: progress.lessons,
            };
          })
        );

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

          const lessonById = new Map(currentSnapshot.lessons.map((lesson) => [lesson.id, lesson]));
          const rows = quizzes
            .filter((quiz) => quiz.is_active)
            .map((quiz) => {
              const quizResults = [...(resultByQuizId.get(quiz.id) ?? [])].sort((a, b) => b.attempt_no - a.attempt_no);
              const latestResult = quizResults[0] ?? null;
              const attemptsUsed = quizResults.length;
              const lessonLabel =
                quiz.lesson_id !== null
                  ? lessonById.get(Number(quiz.lesson_id))?.title ?? `Lesson #${quiz.lesson_id}`
                  : null;

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
                lessonLabel,
              } satisfies AssessmentStatusItem;
            })
            .sort((a, b) => getStageOrder(a.stage) - getStageOrder(b.stage));

          if (isMounted) {
            setAssessmentModuleTitle(currentSnapshot.module?.title ?? `Module #${currentSnapshot.enrollment.module_id}`);
            setAssessmentModuleSnapshot(currentSnapshot);
            setAssessmentItems(rows);
          }
        } else if (isMounted) {
          setAssessmentItems([]);
          setAssessmentModuleTitle('');
          setAssessmentModuleSnapshot(null);
        }

        if (!isMounted) return;
        setEnrollmentSnapshots(snapshotRows);
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
      <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6 shadow-sm">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr] lg:items-end">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-300">Command Center</span>
            <h2 className="mt-1 text-2xl font-bold text-white">Welcome back</h2>
            <p className="mt-1 text-sm text-slate-300">Continue where you left off, monitor assessments, and keep your module momentum.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link to="/user/modules" className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500">
                Continue Learning
                <ArrowRight size={16} />
              </Link>
              <Link to="/user/progress" className="rounded-md border border-white/20 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/5">
                View Progress
              </Link>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Enrolled</p>
              <p className="mt-1 text-2xl font-bold text-white">{stats.enrollments}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Completed</p>
              <p className="mt-1 text-2xl font-bold text-white">{stats.completedModules}</p>
            </div>
          </div>
        </div>
      </div>

      {error ? <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
      {isLoading ? <p className="text-sm text-slate-400">Loading dashboard...</p> : null}

      {!isLoading ? (
        <>
          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <article className="rounded-xl border border-white/10 bg-slate-900/70 p-5 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Pick Up Where You Stopped</p>
              <div className="mt-1 flex items-center gap-2 text-lg font-bold text-white">
                <BookOpenCheck size={18} className="text-brand-400" />
                Continue learning
              </div>

              {continueSnapshot ? (
                <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-bold text-white">{continueSnapshot.module?.title ?? `Module #${continueSnapshot.enrollment.module_id}`}</p>
                      <p className="mt-1 text-sm text-slate-300">
                        Next: {continueSnapshot.nextLesson?.title ?? 'Final module check'}
                      </p>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getEnrollmentStatusClass(continueSnapshot.enrollment.status)}`}>
                      {toTitleCaseStatus(continueSnapshot.enrollment.status)}
                    </span>
                  </div>
                  <div className="mt-3">
                    <div className="mb-1.5 flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-300">{continueSnapshot.completedLessons}/{continueSnapshot.totalLessons} lessons completed</span>
                      <span className="text-brand-300">{continueSnapshot.completionPercent}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-800/70">
                      <div
                        className="h-full rounded-full bg-brand-500"
                        style={{ width: `${Math.max(0, Math.min(100, continueSnapshot.completionPercent))}%` }}
                      />
                    </div>
                  </div>
                  <Link
                    to={`/user/modules/${continueSnapshot.enrollment.module_id}`}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500"
                  >
                    Resume module
                    <ArrowRight size={16} />
                  </Link>
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm text-slate-300">No active module yet. Start your first module to build progress here.</p>
                  <Link to="/user/modules" className="mt-4 inline-flex rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500">
                    Browse Modules
                  </Link>
                </div>
              )}
            </article>

            <article className="rounded-xl border border-white/10 bg-slate-900/70 p-5 shadow-sm">
              <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/10 pb-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Your Modules</p>
                  <h3 className="text-lg font-bold text-white">Enrolled Snapshot</h3>
                </div>
                <Link to="/user/modules" className="rounded-md border border-white/20 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-white/5">
                  View all
                </Link>
              </div>
              {enrollmentSnapshots.length ? (
                <div className="mt-4 space-y-3">
                  {enrollmentSnapshots.slice(0, 3).map((item) => (
                    <div key={item.enrollment.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">{item.module?.title ?? `Module #${item.enrollment.module_id}`}</p>
                          <p className="mt-0.5 text-xs text-slate-300">{item.completedLessons}/{item.totalLessons} lessons</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-semibold text-brand-300">{item.completionPercent}%</p>
                          <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getEnrollmentStatusClass(item.enrollment.status)}`}>
                            {toTitleCaseStatus(item.enrollment.status)}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800/70">
                        <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.max(0, Math.min(100, item.completionPercent))}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-300">No enrolled modules yet.</p>
              )}
            </article>
          </div>

          <article className="rounded-xl border border-white/10 bg-slate-900/70 p-5 shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/10 pb-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Assessments</p>
                <h3 className="text-lg font-bold text-white">Assessment Status</h3>
              </div>
              {assessmentModuleTitle ? <p className="text-xs font-medium text-slate-300">{assessmentModuleTitle}</p> : null}
            </div>
            {assessmentModuleSnapshot ? (
              <div className="mt-4 grid gap-3 xl:grid-cols-[280px_minmax(0,1fr)]">
                <aside className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Module Context</p>
                  <h4 className="mt-2 text-base font-bold text-white">
                    {assessmentModuleSnapshot.module?.title ?? `Module #${assessmentModuleSnapshot.enrollment.module_id}`}
                  </h4>
                  <div className="mt-3 h-32 w-full overflow-hidden rounded-lg border border-white/10 bg-slate-950/60">
                    {assessmentModuleSnapshot.module?.thumbnail_url ? (
                      <img
                        src={assessmentModuleSnapshot.module.thumbnail_url}
                        alt={assessmentModuleSnapshot.module.title}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                        No Image
                      </div>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-300">
                    {assessmentModuleSnapshot.completedLessons}/{assessmentModuleSnapshot.totalLessons} lessons completed
                  </p>
                  <div className="mt-3">
                    <div className="mb-1 flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-300">Progress</span>
                      <span className="text-brand-300">{assessmentModuleSnapshot.completionPercent}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-800/70">
                      <div
                        className="h-full rounded-full bg-brand-500"
                        style={{ width: `${Math.max(0, Math.min(100, assessmentModuleSnapshot.completionPercent))}%` }}
                      />
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-slate-400">
                    Next lesson: {assessmentModuleSnapshot.nextLesson?.title ?? 'Final module check'}
                  </p>
                  <Link
                    to={`/user/modules/${assessmentModuleSnapshot.enrollment.module_id}`}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-white/20 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-white/5"
                  >
                    Open module
                    <ArrowRight size={13} />
                  </Link>
                </aside>

                <div>
                  {assessmentItems.length ? (
                    renderAssessmentCards()
                  ) : (
                    <p className="text-sm text-slate-300">No assessment activity yet. Start a module to unlock quizzes and exams.</p>
                  )}
                </div>
              </div>
            ) : (
              <>
                {assessmentItems.length ? (
                  <div className="mt-4">{renderAssessmentCards()}</div>
                ) : (
                  <p className="mt-4 text-sm text-slate-300">No assessment activity yet. Start a module to unlock quizzes and exams.</p>
                )}
              </>
            )}
          </article>
        </>
      ) : null}

      <div className="rounded-xl border border-white/10 bg-slate-900/70 p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-center gap-4 text-center text-xs text-slate-300">
          <span className="inline-flex items-center gap-1.5">
            <GraduationCap size={14} className="text-brand-400" />
            Keep passing post-tests to unlock final exams.
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ListChecks size={14} className="text-brand-400" />
            Complete lessons in sequence to maintain progress.
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock3 size={14} className="text-brand-400" />
            Resume frequently to improve completion speed.
          </span>
        </div>
      </div>
    </section>
  );
}

