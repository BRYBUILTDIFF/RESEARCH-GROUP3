import { ArrowRight, CheckCircle2, CircleAlert, CircleX, TrendingUp } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getEnrollmentProgress, getEnrollmentResults, getEnrollments, getModules, getQuizzesByModule, getResults } from '../../lib/api';
import type { Enrollment, LessonSummary, ModuleSummary, QuizResult, QuizSummary } from '../../types/lms';

type AssessmentStatus = 'Passed' | 'Failed' | 'Not Taken';

type AssessmentRow = {
  id: number;
  quizId: number;
  title: string;
  stageLabel: 'Pre-Test' | 'Post-Test' | 'Final Exam';
  stageOrder: number;
  lessonLabel: string;
  status: AssessmentStatus;
  score: number | null;
  attemptsUsed: number;
  attemptsLimit: number;
  submittedAt: string | null;
};

type ModuleProgressRow = {
  enrollment: Enrollment;
  module: ModuleSummary | null;
  completionPercent: number;
  completedLessons: number;
  totalLessons: number;
  nextLessonTitle: string | null;
  lessons: LessonSummary[];
  assessments: AssessmentRow[];
};

function getEnrollmentStatusClass(status: Enrollment['status']) {
  if (status === 'completed') return 'border-emerald-300/40 bg-emerald-500/15 text-emerald-200';
  if (status === 'in_progress') return 'border-sky-300/40 bg-sky-500/15 text-sky-200';
  return 'border-white/20 bg-white/10 text-slate-200';
}

function getAssessmentStatusClass(status: AssessmentStatus) {
  if (status === 'Passed') return 'border-emerald-300/40 bg-emerald-500/15 text-emerald-200';
  if (status === 'Failed') return 'border-rose-300/40 bg-rose-500/15 text-rose-200';
  return 'border-white/20 bg-white/10 text-slate-300';
}

function isActivePreTest(quiz: QuizSummary) {
  return quiz.is_active && (quiz.stage === 'pre_test' || (quiz.quiz_type === 'lesson_quiz' && quiz.lesson_id === null));
}

function isActiveFinalExam(quiz: QuizSummary) {
  return quiz.is_active && (quiz.stage === 'final_exam' || quiz.quiz_type === 'final_exam');
}

function calculateProgressPercent({
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
    const lessonPostTestSharePercent = lessonPostTest ? 20 : 0;
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

function getStageInfo(quiz: QuizSummary, lessonsById: Map<number, LessonSummary>) {
  if (quiz.stage === 'final_exam' || quiz.quiz_type === 'final_exam') {
    return { label: 'Final Exam' as const, order: 300, lessonLabel: 'Pass all post-tests first' };
  }
  if (quiz.stage === 'pre_test' || (quiz.quiz_type === 'lesson_quiz' && quiz.lesson_id === null)) {
    return { label: 'Pre-Test' as const, order: 0, lessonLabel: 'Module overview' };
  }

  const lesson = quiz.lesson_id !== null ? lessonsById.get(Number(quiz.lesson_id)) : null;
  const lessonLabel = lesson ? `Lesson ${lesson.sequence_no}: ${lesson.title}` : quiz.lesson_id !== null ? `Lesson #${quiz.lesson_id}` : 'Lesson post-test';
  const lessonOrder = lesson ? lesson.sequence_no : 999;
  return { label: 'Post-Test' as const, order: 100 + lessonOrder, lessonLabel };
}

function formatShortDateTime(value: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

export function UserProgressPage() {
  const [results, setResults] = useState<QuizResult[]>([]);
  const [moduleProgress, setModuleProgress] = useState<ModuleProgressRow[]>([]);
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError('');

      try {
        const [enrollments, allResults, modules] = await Promise.all([getEnrollments(), getResults(), getModules()]);
        setResults(allResults);

        const moduleById = new Map(modules.map((module) => [module.id, module]));

        const progressRows = await Promise.all(
          enrollments.map(async (enrollment) => {
            const [progress, quizzesByModule, enrollmentResults] = await Promise.all([
              getEnrollmentProgress(enrollment.id),
              getQuizzesByModule(enrollment.module_id),
              getEnrollmentResults(enrollment.id),
            ]);

            const totalLessons = progress.lessons.length;
            const completedLessons = progress.lessons.filter((lesson) => lesson.completed).length;
            const lessonsById = new Map(progress.lessons.map((lesson) => [lesson.id, lesson]));

            const resultsByQuizId = new Map<number, QuizResult[]>();
            enrollmentResults.forEach((result) => {
              const current = resultsByQuizId.get(result.quiz_id) ?? [];
              current.push(result);
              resultsByQuizId.set(result.quiz_id, current);
            });

            const assessments = quizzesByModule
              .filter((quiz) => quiz.is_active)
              .map((quiz) => {
                const attempts = [...(resultsByQuizId.get(quiz.id) ?? [])].sort((a, b) => b.attempt_no - a.attempt_no);
                const latest = attempts[0] ?? null;
                const stageInfo = getStageInfo(quiz, lessonsById);
                const status: AssessmentStatus = !latest ? 'Not Taken' : latest.passed ? 'Passed' : 'Failed';

                return {
                  id: quiz.id,
                  quizId: quiz.id,
                  title: quiz.title,
                  stageLabel: stageInfo.label,
                  stageOrder: stageInfo.order,
                  lessonLabel: stageInfo.lessonLabel,
                  status,
                  score: latest ? Number(latest.score) : null,
                  attemptsUsed: attempts.length,
                  attemptsLimit: quiz.attempt_limit,
                  submittedAt: latest?.submitted_at ?? null,
                } satisfies AssessmentRow;
              })
              .sort((a, b) => a.stageOrder - b.stageOrder || a.quizId - b.quizId);
            const completionPercent = calculateProgressPercent({
              lessons: progress.lessons,
              quizzes: quizzesByModule,
              results: enrollmentResults,
            });

            return {
              enrollment,
              module: moduleById.get(enrollment.module_id) ?? null,
              completionPercent,
              totalLessons,
              completedLessons,
              nextLessonTitle: progress.lessons.find((lesson) => !lesson.completed)?.title ?? null,
              lessons: progress.lessons,
              assessments,
            } satisfies ModuleProgressRow;
          })
        );

        const sortedRows = [...progressRows].sort((a, b) => {
          if (a.enrollment.status === 'completed' && b.enrollment.status !== 'completed') return 1;
          if (a.enrollment.status !== 'completed' && b.enrollment.status === 'completed') return -1;
          return b.completionPercent - a.completionPercent;
        });
        setModuleProgress(sortedRows);

        setSelectedEnrollmentId((previous) => {
          if (previous && sortedRows.some((row) => row.enrollment.id === previous)) return previous;
          return sortedRows[0]?.enrollment.id ?? null;
        });
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

  const recentResults = useMemo(
    () => [...results].sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()).slice(0, 3),
    [results]
  );

  const selectedModuleProgress = useMemo(() => {
    if (!moduleProgress.length) return null;
    if (selectedEnrollmentId === null) return moduleProgress[0] ?? null;
    return moduleProgress.find((row) => row.enrollment.id === selectedEnrollmentId) ?? moduleProgress[0] ?? null;
  }, [moduleProgress, selectedEnrollmentId]);

  const selectedAssessments = selectedModuleProgress?.assessments ?? [];
  const passedCount = selectedAssessments.filter((item) => item.status === 'Passed').length;
  const failedCount = selectedAssessments.filter((item) => item.status === 'Failed').length;
  const notTakenCount = selectedAssessments.filter((item) => item.status === 'Not Taken').length;
  const avgScore = (() => {
    const scored = selectedAssessments.filter((item) => item.score !== null);
    if (!scored.length) return 0;
    return Math.round(scored.reduce((sum, item) => sum + Number(item.score), 0) / scored.length);
  })();

  return (
    <section className="space-y-6">
      {error ? <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
      {isLoading ? <p className="text-sm text-slate-400">Loading progress...</p> : null}

      {!isLoading ? (
        <>
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-300">Progress Overview</p>
                <h2 className="mt-1 text-2xl font-bold text-white">My Progress</h2>
                <p className="mt-1 text-sm text-slate-300">Module completion, assessments, and recent activity.</p>
              </div>
              <div className="flex gap-2">
                <Link to="/user/dashboard" className="rounded-md border border-white/20 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/5">
                  Back to Dashboard
                </Link>
                <Link to="/user/modules" className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500">
                  Continue Learning
                  <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Overall Completion</p>
                <p className="mt-1 text-4xl font-bold text-brand-300">{overallCompletion}%</p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-semibold">
                <span className="rounded-full border border-sky-300/35 bg-sky-500/15 px-3 py-1 text-sky-200">Active: {activeModules}</span>
                <span className="rounded-full border border-emerald-300/35 bg-emerald-500/15 px-3 py-1 text-emerald-200">Completed: {completedModules}</span>
              </div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.max(0, Math.min(100, overallCompletion))}%` }} />
            </div>
            <p className="mt-2 text-xs text-slate-300">{moduleProgress.length} modules enrolled.</p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 shadow-sm">
              <div className="border-b border-white/10 pb-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Module Tracking</p>
                <h3 className="text-lg font-bold text-white">Module Completion</h3>
              </div>
              <div className="mt-2">
                {moduleProgress.length === 0 ? (
                  <p className="text-sm text-slate-300">No enrollments yet. Start with the modules page.</p>
                ) : (
                  moduleProgress.map((item) => (
                    <div key={item.enrollment.id} className="flex items-center gap-3 border-b border-white/10 py-3 last:border-b-0">
                      <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-slate-950/60 text-xs font-bold text-slate-200">
                        {item.module?.thumbnail_url ? (
                          <img src={item.module.thumbnail_url} alt={item.module.title} className="h-full w-full object-contain" />
                        ) : (
                          (item.module?.title ?? 'M').slice(0, 2).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-white">{item.module?.title ?? item.enrollment.module_title ?? `Module #${item.enrollment.module_id}`}</p>
                        <p className="mt-0.5 text-xs text-slate-300">{item.completedLessons}/{item.totalLessons} lessons completed</p>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                          <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.max(0, Math.min(100, item.completionPercent))}%` }} />
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getEnrollmentStatusClass(item.enrollment.status)}`}>
                          {item.enrollment.status === 'in_progress' ? 'In progress' : item.enrollment.status === 'completed' ? 'Completed' : 'Enrolled'}
                        </span>
                        <span className="text-xs font-semibold text-brand-300">{item.completionPercent}%</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </article>

            <article className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 shadow-sm">
              <div className="border-b border-white/10 pb-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Recent Attempts</p>
                <h3 className="text-lg font-bold text-white">Last 3 Assessment Attempts</h3>
              </div>
              <div className="mt-2">
                {recentResults.length === 0 ? (
                  <p className="text-sm text-slate-300">No assessment attempts yet.</p>
                ) : (
                  recentResults.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-3 border-b border-white/10 py-3 last:border-b-0">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">{item.quiz_title ?? `Quiz #${item.quiz_id}`}</p>
                        <p className="mt-0.5 text-xs text-slate-300">
                          {item.module_title ?? '-'} - {formatShortDateTime(item.submitted_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${item.passed ? 'border-emerald-300/40 bg-emerald-500/15 text-emerald-200' : 'border-rose-300/40 bg-rose-500/15 text-rose-200'}`}>
                          {item.passed ? 'Passed' : 'Failed'}
                        </span>
                        <span className={`text-sm font-semibold ${item.passed ? 'text-emerald-300' : 'text-rose-300'}`}>{Number(item.score)}%</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </article>
          </div>

          <article className="rounded-2xl border border-white/10 bg-slate-900/70 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Assessments</p>
                <h3 className="text-lg font-bold text-white">Assessment Status</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-300">Module</span>
                <select
                  value={selectedModuleProgress?.enrollment.id ?? ''}
                  onChange={(event) => setSelectedEnrollmentId(Number(event.target.value))}
                  className="rounded-md border border-white/20 bg-slate-900/80 px-3 py-1.5 text-sm text-slate-200 outline-none"
                >
                  {moduleProgress.map((item) => (
                    <option key={item.enrollment.id} value={item.enrollment.id}>
                      {item.module?.title ?? item.enrollment.module_title ?? `Module #${item.enrollment.module_id}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-0 xl:grid-cols-[25%_75%]">
              <aside className="border-b border-white/10 p-4 xl:border-b-0 xl:border-r">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Module Context</p>
                {selectedModuleProgress ? (
                  <>
                    <div className="overflow-hidden rounded-lg border border-white/10 bg-white/5">
                      <div className="h-32 overflow-hidden bg-slate-950/70">
                        {selectedModuleProgress.module?.thumbnail_url ? (
                          <img src={selectedModuleProgress.module.thumbnail_url} alt={selectedModuleProgress.module.title} className="h-full w-full object-contain" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs font-semibold uppercase text-slate-400">No Image</div>
                        )}
                      </div>
                      <div className="p-3">
                        <p className="text-sm font-semibold text-white">{selectedModuleProgress.module?.title ?? selectedModuleProgress.enrollment.module_title ?? `Module #${selectedModuleProgress.enrollment.module_id}`}</p>
                        <div className="mt-2">
                          <div className="mb-1 flex items-center justify-between text-[10px] font-semibold text-slate-300">
                            <span>Progress</span>
                            <span>{selectedModuleProgress.completionPercent}%</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                            <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.max(0, Math.min(100, selectedModuleProgress.completionPercent))}%` }} />
                          </div>
                        </div>
                        <p className="mt-2 text-xs text-slate-300">{selectedModuleProgress.completedLessons}/{selectedModuleProgress.totalLessons} lessons completed</p>
                        <div className="mt-2 rounded-md bg-slate-900/70 p-2 text-xs text-slate-300">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Up Next</p>
                          <p className="mt-1">{selectedModuleProgress.nextLessonTitle ?? 'Final module check'}</p>
                        </div>
                        <Link to={`/user/modules/${selectedModuleProgress.enrollment.module_id}`} className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-500">
                          Open Module
                          <ArrowRight size={13} />
                        </Link>
                      </div>
                    </div>

                    <p className="mb-2 mt-4 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Progress Trail</p>
                    <div className="space-y-2">
                      {selectedAssessments.map((item, index) => (
                        <div key={item.id} className="flex gap-2">
                          <div className="flex flex-col items-center pt-1">
                            <span className={`h-2.5 w-2.5 rounded-full ${item.status === 'Passed' ? 'bg-emerald-400' : item.status === 'Failed' ? 'bg-rose-400' : 'bg-slate-500'}`} />
                            {index < selectedAssessments.length - 1 ? <span className="mt-1 h-5 w-px bg-white/20" /> : null}
                          </div>
                          <div className="min-w-0 pb-1">
                            <p className="text-xs font-semibold text-white">{item.stageLabel}</p>
                            <p className="text-[11px] text-slate-300">{item.lessonLabel}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-slate-300">No module selected.</p>
                )}
              </aside>

              <div className="p-4">
                <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
                  <div className="rounded-md border border-white/10 bg-white/5 px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 size={14} className="text-emerald-300" />
                      <span className="text-[10px] uppercase tracking-[0.08em] text-slate-400">Passed</span>
                    </div>
                    <p className="mt-1 text-lg font-bold text-emerald-300">{passedCount}</p>
                  </div>
                  <div className="rounded-md border border-white/10 bg-white/5 px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <CircleX size={14} className="text-rose-300" />
                      <span className="text-[10px] uppercase tracking-[0.08em] text-slate-400">Failed</span>
                    </div>
                    <p className="mt-1 text-lg font-bold text-rose-300">{failedCount}</p>
                  </div>
                  <div className="rounded-md border border-white/10 bg-white/5 px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <CircleAlert size={14} className="text-slate-300" />
                      <span className="text-[10px] uppercase tracking-[0.08em] text-slate-400">Not Taken</span>
                    </div>
                    <p className="mt-1 text-lg font-bold text-slate-200">{notTakenCount}</p>
                  </div>
                  <div className="rounded-md border border-white/10 bg-white/5 px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <TrendingUp size={14} className="text-brand-300" />
                      <span className="text-[10px] uppercase tracking-[0.08em] text-slate-400">Avg Score</span>
                    </div>
                    <p className="mt-1 text-lg font-bold text-brand-300">{avgScore}%</p>
                  </div>
                </div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">All Assessments</p>
                {selectedAssessments.length === 0 ? (
                  <p className="text-sm text-slate-300">No assessments found for this module yet.</p>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {selectedAssessments.map((item) => (
                      <article key={item.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">{item.stageLabel}</span>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getAssessmentStatusClass(item.status)}`}>{item.status}</span>
                        </div>
                        <p className="mt-2 text-sm font-semibold text-white">{item.title}</p>
                        <p className="mt-0.5 text-xs text-slate-300">{item.lessonLabel}</p>
                        <div className="mt-2 flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                            <div
                              className={`h-full rounded-full ${item.status === 'Passed' ? 'bg-emerald-400' : item.status === 'Failed' ? 'bg-rose-400' : 'bg-slate-500'}`}
                              style={{ width: `${Math.max(0, Math.min(100, item.score ?? 0))}%` }}
                            />
                          </div>
                          <span className={`w-10 text-right text-xs font-semibold ${item.status === 'Passed' ? 'text-emerald-300' : item.status === 'Failed' ? 'text-rose-300' : 'text-slate-300'}`}>
                            {item.score !== null ? `${item.score}%` : '-'}
                          </span>
                        </div>
                        <p className="mt-2 text-[11px] text-slate-400">Attempts: {item.attemptsUsed}/{item.attemptsLimit}</p>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </article>
        </>
      ) : null}
    </section>
  );
}
