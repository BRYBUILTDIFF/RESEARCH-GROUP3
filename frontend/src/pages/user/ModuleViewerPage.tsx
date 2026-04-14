import { useEffect, useMemo, useState } from 'react';
import {
  Award,
  Check,
  ChevronLeft,
  ChevronRight,
  CirclePlay,
  ClipboardList,
  PanelLeftClose,
  PanelLeftOpen,
  Timer,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  completeLesson,
  enroll,
  getEnrollmentProgress,
  getEnrollmentResults,
  getEnrollments,
  getLessonContent,
  getModuleById,
  getQuizzesByModule,
  getTopics,
} from '../../lib/api';
import type {
  Enrollment,
  LessonContentBlock,
  LessonSummary,
  QuizResult,
  QuizSummary,
  TopicSummary,
} from '../../types/lms';

function toYouTubeEmbedUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('youtu.be')) {
      return `https://www.youtube.com/embed/${parsed.pathname.replace('/', '')}`;
    }
    if (parsed.hostname.includes('youtube.com')) {
      const videoId = parsed.searchParams.get('v');
      return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
    }
  } catch {
    return null;
  }
  return null;
}

function ContentBlock({ block }: { block: LessonContentBlock }) {
  if (block.content_type === 'text') {
    return (
      <article className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Text Lesson</p>
        <h4 className="mt-1 text-base font-semibold text-slate-900">{block.title}</h4>
        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{block.body_text || 'No text content provided.'}</p>
      </article>
    );
  }

  if (block.content_type === 'image') {
    return (
      <article className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Image</p>
        <h4 className="mt-1 text-base font-semibold text-slate-900">{block.title}</h4>
        {block.content_url ? (
          <img src={block.content_url} alt={block.title} className="mt-3 w-full rounded-md border border-slate-200 object-cover" />
        ) : (
          <p className="mt-2 text-sm text-slate-600">No image URL configured.</p>
        )}
      </article>
    );
  }

  if (block.content_type === 'video') {
    const embedUrl = block.content_url ? toYouTubeEmbedUrl(block.content_url) : null;
    return (
      <article className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Video</p>
        <h4 className="mt-1 text-base font-semibold text-slate-900">{block.title}</h4>
        {embedUrl ? (
          <div className="mt-3 aspect-video overflow-hidden rounded-md border border-slate-200">
            <iframe
              src={embedUrl}
              title={block.title}
              className="h-full w-full"
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        ) : block.content_url ? (
          <video controls className="mt-3 w-full rounded-md border border-slate-200">
            <source src={block.content_url} />
          </video>
        ) : (
          <p className="mt-2 text-sm text-slate-600">No video URL configured.</p>
        )}
      </article>
    );
  }

  if (block.content_type === 'simulation') {
    return (
      <article className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Simulation</p>
        <h4 className="mt-1 text-base font-semibold text-slate-900">{block.title}</h4>
        <p className="mt-2 text-sm text-slate-700">{block.body_text || 'Complete this interactive scenario to practice troubleshooting.'}</p>
        {block.content_url ? (
          <a
            href={block.content_url}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            Open Simulation
          </a>
        ) : null}
      </article>
    );
  }

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Download</p>
      <h4 className="mt-1 text-base font-semibold text-slate-900">{block.title}</h4>
      {block.content_url ? (
        <a href={block.content_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm font-semibold text-sky-700 hover:underline">
          Open Resource
        </a>
      ) : (
        <p className="mt-2 text-sm text-slate-600">No file URL configured.</p>
      )}
    </article>
  );
}

const isPreTest = (quiz: QuizSummary) =>
  quiz.quiz_type === 'lesson_quiz' && /\bpre[-\s]?test\b/i.test(quiz.title);

const formatMinutesLabel = (minutes: number) => `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;

const assessmentMeta = (quiz: QuizSummary) => {
  if (quiz.quiz_type === 'final_exam') {
    return {
      label: 'Final Exam',
      icon: Award,
      accent: 'text-emerald-700',
      surface: 'bg-emerald-50',
      border: 'border-emerald-200',
      buttonClass: 'bg-emerald-600 hover:bg-emerald-500',
      cta: 'Take Final Exam',
    };
  }
  if (isPreTest(quiz)) {
    return {
      label: 'Pre Test',
      icon: ClipboardList,
      accent: 'text-emerald-700',
      surface: 'bg-emerald-50',
      border: 'border-emerald-200',
      buttonClass: 'bg-emerald-600 hover:bg-emerald-500',
      cta: 'Take Pre Test',
    };
  }
  return {
    label: 'Post Test',
    icon: CirclePlay,
    accent: 'text-emerald-700',
    surface: 'bg-emerald-50',
    border: 'border-emerald-200',
    buttonClass: 'bg-emerald-600 hover:bg-emerald-500',
    cta: 'Take Post Test',
  };
};

export function ModuleViewerPage() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const navigate = useNavigate();
  const moduleIdNumber = Number(moduleId);

  const [moduleTitle, setModuleTitle] = useState('');
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [lessons, setLessons] = useState<LessonSummary[]>([]);
  const [completionPercent, setCompletionPercent] = useState(0);
  const [quizzes, setQuizzes] = useState<QuizSummary[]>([]);
  const [results, setResults] = useState<QuizResult[]>([]);
  const [topicsByLessonId, setTopicsByLessonId] = useState<Record<number, TopicSummary[]>>({});
  const [lessonContentByLessonId, setLessonContentByLessonId] = useState<Record<number, LessonContentBlock[]>>({});
  const [contentByTopicId, setContentByTopicId] = useState<Record<number, LessonContentBlock[]>>({});
  const [selectedLessonId, setSelectedLessonId] = useState<number | null>(null);
  const [expandedLessonId, setExpandedLessonId] = useState<number | null>(null);
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<number | null>(null);
  const [isLessonsSidebarOpen, setIsLessonsSidebarOpen] = useState(true);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);

  const reload = async () => {
    if (!moduleIdNumber) return;
    setIsLoading(true);
    setError('');

    try {
      const module = await getModuleById(moduleIdNumber);
      setModuleTitle(module.title);

      const enrollments = await getEnrollments();
      let currentEnrollment = enrollments.find((item) => item.module_id === moduleIdNumber) ?? null;
      if (!currentEnrollment) {
        currentEnrollment = await enroll(moduleIdNumber);
      }
      setEnrollment(currentEnrollment);

      const [progress, quizzesByModule, enrollmentResults] = await Promise.all([
        getEnrollmentProgress(currentEnrollment.id),
        getQuizzesByModule(moduleIdNumber),
        getEnrollmentResults(currentEnrollment.id),
      ]);

      const orderedLessons = [...progress.lessons].sort((a, b) => a.sequence_no - b.sequence_no);
      setLessons(orderedLessons);
      setCompletionPercent(progress.completionPercent);
      setQuizzes(quizzesByModule);
      setResults(enrollmentResults);

      const lessonArtifacts = await Promise.all(
        orderedLessons.map(async (lesson) => {
          const [topics, lessonContent] = await Promise.all([
            getTopics(lesson.id),
            getLessonContent(lesson.id),
          ]);
          return { lessonId: lesson.id, topics, lessonContent };
        })
      );

      const nextTopicsByLessonId: Record<number, TopicSummary[]> = {};
      const nextLessonContentByLessonId: Record<number, LessonContentBlock[]> = {};
      const nextContentByTopicId: Record<number, LessonContentBlock[]> = {};

      for (const artifact of lessonArtifacts) {
        const sortedTopics = [...artifact.topics].sort((a, b) => a.sort_order - b.sort_order);
        nextTopicsByLessonId[artifact.lessonId] = sortedTopics;
        nextLessonContentByLessonId[artifact.lessonId] = [];

        for (const block of artifact.lessonContent) {
          if (block.topic_id === null) {
            nextLessonContentByLessonId[artifact.lessonId].push(block);
            continue;
          }
          if (!nextContentByTopicId[block.topic_id]) {
            nextContentByTopicId[block.topic_id] = [];
          }
          nextContentByTopicId[block.topic_id].push(block);
        }
      }

      setTopicsByLessonId(nextTopicsByLessonId);
      setLessonContentByLessonId(nextLessonContentByLessonId);
      setContentByTopicId(nextContentByTopicId);

      const defaultLessonId =
        orderedLessons.find((lesson) => !lesson.completed)?.id ??
        orderedLessons[0]?.id ??
        null;

      const nextLessonId =
        selectedLessonId && orderedLessons.some((lesson) => lesson.id === selectedLessonId)
          ? selectedLessonId
          : defaultLessonId;

      const topicsForLesson = nextLessonId ? nextTopicsByLessonId[nextLessonId] ?? [] : [];
      const nextTopicId =
        selectedTopicId && topicsForLesson.some((topic) => topic.id === selectedTopicId)
          ? selectedTopicId
          : null;

      setSelectedLessonId(nextLessonId);
      setExpandedLessonId(nextLessonId);
      setSelectedTopicId(nextTopicId);

      if (selectedAssessmentId && !quizzesByModule.some((quiz) => quiz.id === selectedAssessmentId)) {
        setSelectedAssessmentId(null);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load module viewer.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, [moduleIdNumber]);

  const unlockedLessonIds = useMemo(() => {
    const unlocked = new Set<number>();
    lessons.forEach((lesson, index) => {
      if (index === 0) {
        unlocked.add(lesson.id);
        return;
      }
      const previousLesson = lessons[index - 1];
      if (previousLesson?.completed) {
        unlocked.add(lesson.id);
      }
    });
    return unlocked;
  }, [lessons]);

  const selectedLesson = lessons.find((lesson) => lesson.id === selectedLessonId) ?? null;
  const topicsForSelectedLesson = selectedLesson ? topicsByLessonId[selectedLesson.id] ?? [] : [];
  const selectedTopic =
    selectedTopicId && topicsForSelectedLesson.some((topic) => topic.id === selectedTopicId)
      ? topicsForSelectedLesson.find((topic) => topic.id === selectedTopicId) ?? null
      : null;
  const selectedLessonContent = selectedLesson ? lessonContentByLessonId[selectedLesson.id] ?? [] : [];
  const selectedTopicContent = selectedTopic ? contentByTopicId[selectedTopic.id] ?? [] : [];
  const allLessonsCompleted = lessons.length > 0 && lessons.every((lesson) => lesson.completed);

  const passedQuizIds = useMemo(() => {
    const passed = new Set<number>();
    results.forEach((result) => {
      if (result.passed) passed.add(result.quiz_id);
    });
    return passed;
  }, [results]);

  const latestResultByQuizId = useMemo(() => {
    const latest = new Map<number, QuizResult>();
    results.forEach((result) => {
      if (!latest.has(result.quiz_id)) {
        latest.set(result.quiz_id, result);
      }
    });
    return latest;
  }, [results]);

  const preTestsByLessonId = useMemo(() => {
    const map = new Map<number, QuizSummary[]>();
    quizzes
      .filter((quiz) => quiz.quiz_type === 'lesson_quiz' && isPreTest(quiz) && quiz.lesson_id !== null)
      .forEach((quiz) => {
        const lessonId = Number(quiz.lesson_id);
        const existing = map.get(lessonId) ?? [];
        existing.push(quiz);
        map.set(lessonId, existing);
      });
    return map;
  }, [quizzes]);

  const postTestsByLessonId = useMemo(() => {
    const map = new Map<number, QuizSummary[]>();
    quizzes
      .filter((quiz) => quiz.quiz_type === 'lesson_quiz' && !isPreTest(quiz) && quiz.lesson_id !== null)
      .forEach((quiz) => {
        const lessonId = Number(quiz.lesson_id);
        const existing = map.get(lessonId) ?? [];
        existing.push(quiz);
        map.set(lessonId, existing);
      });
    return map;
  }, [quizzes]);

  const finalExam = quizzes.find((quiz) => quiz.quiz_type === 'final_exam') ?? null;
  const activeLessonQuizzes = quizzes.filter((quiz) => quiz.quiz_type === 'lesson_quiz' && quiz.is_active);
  const allLessonQuizzesPassed = activeLessonQuizzes.every((quiz) => passedQuizIds.has(quiz.id));
  const finalExamReady = Boolean(finalExam) && allLessonsCompleted && allLessonQuizzesPassed;

  const selectedAssessment = selectedAssessmentId
    ? quizzes.find((quiz) => quiz.id === selectedAssessmentId) ?? null
    : null;

  const isAssessmentUnlocked = (quiz: QuizSummary) => {
    if (!quiz.is_active) return false;
    if (quiz.quiz_type === 'final_exam') return finalExamReady;
    return allLessonsCompleted;
  };

  const assessmentUnlockMessage = (quiz: QuizSummary) => {
    if (quiz.quiz_type === 'final_exam') {
      if (finalExamReady) return 'Ready to take.';
      if (!allLessonsCompleted) return 'Complete all lessons first.';
      return 'Pass all active pre/post tests first.';
    }
    return allLessonsCompleted
      ? 'Ready to take.'
      : 'Unlocks after all lessons are completed.';
  };

  type SequenceItem =
    | { key: string; type: 'lesson'; lessonId: number; lesson: LessonSummary; unlocked: boolean }
    | { key: string; type: 'topic'; lessonId: number; topic: TopicSummary; unlocked: boolean }
    | { key: string; type: 'assessment'; lessonId: number | null; quiz: QuizSummary; unlocked: boolean };

  const sequenceItems = useMemo(() => {
    const items: SequenceItem[] = [];
    lessons.forEach((lesson) => {
      const lessonUnlocked = unlockedLessonIds.has(lesson.id) || lesson.completed;
      (preTestsByLessonId.get(lesson.id) ?? []).forEach((quiz) => {
        items.push({
          key: `assessment-${quiz.id}`,
          type: 'assessment',
          lessonId: lesson.id,
          quiz,
          unlocked: isAssessmentUnlocked(quiz),
        });
      });

      items.push({
        key: `lesson-${lesson.id}`,
        type: 'lesson',
        lessonId: lesson.id,
        lesson,
        unlocked: lessonUnlocked,
      });

      const lessonTopics = topicsByLessonId[lesson.id] ?? [];
      lessonTopics.forEach((topic) => {
        items.push({
          key: `topic-${topic.id}`,
          type: 'topic',
          lessonId: lesson.id,
          topic,
          unlocked: lessonUnlocked,
        });
      });

      (postTestsByLessonId.get(lesson.id) ?? []).forEach((quiz) => {
        items.push({
          key: `assessment-${quiz.id}`,
          type: 'assessment',
          lessonId: lesson.id,
          quiz,
          unlocked: isAssessmentUnlocked(quiz),
        });
      });
    });

    if (finalExam) {
      items.push({
        key: `assessment-${finalExam.id}`,
        type: 'assessment',
        lessonId: null,
        quiz: finalExam,
        unlocked: isAssessmentUnlocked(finalExam),
      });
    }

    return items;
  }, [lessons, unlockedLessonIds, preTestsByLessonId, topicsByLessonId, postTestsByLessonId, finalExam, isAssessmentUnlocked]);

  const currentSequenceKey = selectedAssessment
    ? `assessment-${selectedAssessment.id}`
    : selectedTopic
    ? `topic-${selectedTopic.id}`
    : selectedLesson
    ? `lesson-${selectedLesson.id}`
    : null;
  const currentSequenceIndex =
    currentSequenceKey === null ? -1 : sequenceItems.findIndex((item) => item.key === currentSequenceKey);
  const previousSequenceItem = currentSequenceIndex > 0 ? sequenceItems[currentSequenceIndex - 1] : null;
  const nextSequenceItem =
    currentSequenceIndex >= 0 && currentSequenceIndex < sequenceItems.length - 1
      ? sequenceItems[currentSequenceIndex + 1]
      : null;

  const handleCompleteLesson = async (lessonIdValue: number) => {
    if (!enrollment) return;
    setIsMutating(true);
    setError('');
    try {
      await completeLesson(enrollment.id, lessonIdValue);
      await reload();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Failed to complete lesson.');
    } finally {
      setIsMutating(false);
    }
  };

  const openQuiz = (quizId: number) => {
    if (!enrollment) return;
    navigate(`/user/quizzes/${quizId}?enrollmentId=${enrollment.id}&moduleId=${moduleIdNumber}`);
  };

  const selectLesson = (lessonId: number) => {
    const shouldCollapse = expandedLessonId === lessonId;
    setExpandedLessonId(shouldCollapse ? null : lessonId);
    setSelectedLessonId(lessonId);
    setSelectedTopicId(null);
    setSelectedAssessmentId(null);
  };

  const selectTopic = (lessonId: number, topicId: number) => {
    setSelectedLessonId(lessonId);
    setExpandedLessonId(lessonId);
    setSelectedTopicId(topicId);
    setSelectedAssessmentId(null);
  };

  const selectAssessment = (quiz: QuizSummary) => {
    if (quiz.lesson_id !== null) {
      setSelectedLessonId(Number(quiz.lesson_id));
      setExpandedLessonId(Number(quiz.lesson_id));
    }
    setSelectedTopicId(null);
    setSelectedAssessmentId(quiz.id);
  };

  const goToSequenceItem = (item: SequenceItem | null) => {
    if (!item) return;
    if (item.type === 'lesson') {
      setExpandedLessonId(item.lessonId);
      setSelectedLessonId(item.lessonId);
      setSelectedTopicId(null);
      setSelectedAssessmentId(null);
      return;
    }
    if (item.type === 'topic') {
      selectTopic(item.lessonId, item.topic.id);
      return;
    }
    selectAssessment(item.quiz);
  };

  return (
    <section className="space-y-4">
      {error ? <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
      {isLoading ? <p className="text-sm text-slate-500">Loading module content...</p> : null}

      {!isLoading ? (
        <div
          className={`grid items-stretch gap-5 xl:min-h-[calc(100vh-10rem)] ${
            isLessonsSidebarOpen ? 'xl:grid-cols-[360px_1fr]' : 'xl:grid-cols-1'
          }`}
        >
          {isLessonsSidebarOpen ? (
            <aside className="h-full space-y-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Module {moduleIdNumber || '--'}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{moduleTitle || 'Untitled Module'}</p>
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Progress</span>
                  <span className="font-semibold text-sky-700">{completionPercent}%</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-sky-500"
                    style={{ width: `${Math.max(0, Math.min(100, completionPercent))}%` }}
                  />
                </div>
              </div>

              <div className="mb-1 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Learning Sequence</p>
                <button
                  onClick={() => setIsLessonsSidebarOpen(false)}
                  className="rounded-md border border-slate-300 p-1 text-slate-600 hover:bg-slate-50"
                  aria-label="Collapse lessons sidebar"
                >
                  <PanelLeftClose size={14} />
                </button>
              </div>

              {lessons.map((lesson) => {
                const lessonUnlocked = unlockedLessonIds.has(lesson.id) || lesson.completed;
                const lessonTopics = topicsByLessonId[lesson.id] ?? [];
                const lessonPreTests = preTestsByLessonId.get(lesson.id) ?? [];
                const lessonPostTests = postTestsByLessonId.get(lesson.id) ?? [];

                return (
                  <div key={lesson.id} className="space-y-2">
                    {lessonPreTests.map((quiz) => {
                      const latest = latestResultByQuizId.get(quiz.id);
                      return (
                        <button
                          key={quiz.id}
                          onClick={() => selectAssessment(quiz)}
                          className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                            selectedAssessmentId === quiz.id ? 'border-sky-300 bg-sky-50' : 'border-slate-200 bg-white'
                          }`}
                        >
                          <p className="font-semibold text-slate-900">Pre Test: {quiz.title}</p>
                          <p className="mt-1 text-xs text-slate-600">
                            {latest ? `Latest ${Number(latest.score)}% (${latest.passed ? 'Passed' : 'Failed'})` : 'No attempts yet'}
                          </p>
                        </button>
                      );
                    })}

                    <button
                      disabled={!lessonUnlocked}
                      onClick={() => selectLesson(lesson.id)}
                      className={`w-full rounded-md border px-3 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-60 ${
                        selectedAssessmentId === null && selectedLessonId === lesson.id ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <span
                          className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                            lesson.completed ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-400 bg-white text-slate-400'
                          }`}
                          aria-hidden="true"
                        >
                          {lesson.completed ? <Check size={12} strokeWidth={3} /> : null}
                        </span>
                        <div>
                          <p className="font-semibold text-slate-900">{lesson.title}</p>
                          <p className="mt-1 text-xs text-slate-600">Estimated time: {formatMinutesLabel(lesson.estimated_minutes)}</p>
                          <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                            {lesson.completed ? 'Completed' : lessonUnlocked ? 'Unlocked' : 'Locked'}
                          </p>
                        </div>
                      </div>
                    </button>

                    {expandedLessonId === lesson.id ? (
                      <div className="space-y-1 pl-4">
                        {lessonTopics.map((topic) => {
                          const topicCompleted = topic.completed ?? lesson.completed;
                          return (
                            <button
                              key={topic.id}
                              disabled={!lessonUnlocked}
                              onClick={() => selectTopic(lesson.id, topic.id)}
                              className={`w-full rounded-md border px-3 py-2 text-left text-xs disabled:cursor-not-allowed disabled:opacity-60 ${
                                selectedAssessmentId === null && selectedTopicId === topic.id
                                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                                  : 'border-slate-200 bg-white text-slate-700'
                              }`}
                            >
                              <div className="flex items-start gap-2">
                                <span
                                  className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                                    topicCompleted ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-400 bg-white text-slate-400'
                                  }`}
                                  aria-hidden="true"
                                >
                                  {topicCompleted ? <Check size={10} strokeWidth={3} /> : null}
                                </span>
                                <p className="font-medium">{topic.title}</p>
                              </div>
                            </button>
                          );
                        })}
                        {lessonTopics.length === 0 ? (
                          <p className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                            No topics in this lesson yet.
                          </p>
                        ) : null}
                      </div>
                    ) : null}

                    {lessonPostTests.map((quiz) => {
                      const latest = latestResultByQuizId.get(quiz.id);
                      return (
                        <button
                          key={quiz.id}
                          onClick={() => selectAssessment(quiz)}
                          className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                            selectedAssessmentId === quiz.id ? 'border-sky-300 bg-sky-50' : 'border-slate-200 bg-white'
                          }`}
                        >
                          <p className="font-semibold text-slate-900">Post Test: {quiz.title}</p>
                          <p className="mt-1 text-xs text-slate-600">
                            {latest ? `Latest ${Number(latest.score)}% (${latest.passed ? 'Passed' : 'Failed'})` : 'No attempts yet'}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                );
              })}

              {finalExam ? (
                <button
                  onClick={() => selectAssessment(finalExam)}
                  className={`mt-1 w-full rounded-md border px-3 py-2 text-left text-sm ${
                    selectedAssessmentId === finalExam.id ? 'border-sky-300 bg-sky-50' : 'border-slate-200 bg-white'
                  }`}
                >
                  <p className="font-semibold text-slate-900">Final Exam: {finalExam.title}</p>
                  <p className="mt-1 text-xs text-slate-600">{assessmentUnlockMessage(finalExam)}</p>
                </button>
              ) : null}
            </aside>
          ) : null}

          <div className="flex h-full min-h-0 flex-col gap-4">
            <div className="flex flex-1 flex-col gap-4">
            {!isLessonsSidebarOpen ? (
              <button
                onClick={() => setIsLessonsSidebarOpen(true)}
                className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <PanelLeftOpen size={14} />
                Show Sequence
              </button>
            ) : null}

            {selectedAssessment ? (
              <div className="flex flex-1 min-h-0 items-stretch py-2">
                {(() => {
                  const meta = assessmentMeta(selectedAssessment);
                  const AssessmentIcon = meta.icon;
                  return (
                    <article className={`flex h-full w-full flex-col rounded-2xl border bg-white p-6 shadow-sm md:p-8 ${meta.border}`}>
                      <div className="flex flex-1 flex-col justify-center">
                        <div className="mx-auto w-full max-w-3xl text-center">
                          <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider ${meta.surface} ${meta.border} ${meta.accent}`}>
                            <AssessmentIcon size={14} />
                            {meta.label}
                          </div>
                          <h3 className="mt-3 text-2xl font-bold text-slate-900 md:text-3xl">{selectedAssessment.title}</h3>
                          <p className="mt-3 text-sm text-slate-600 md:text-base">{assessmentUnlockMessage(selectedAssessment)}</p>
                        </div>

                        <div className="mx-auto mt-7 grid w-full max-w-4xl gap-3 sm:grid-cols-3">
                          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center">
                            <div className="mb-1 inline-flex text-slate-500">
                              <Award size={16} />
                            </div>
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Passing Score</p>
                            <p className="mt-1 text-lg font-bold text-slate-900">{selectedAssessment.passing_score}%</p>
                          </div>
                          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center">
                            <div className="mb-1 inline-flex text-slate-500">
                              <Timer size={16} />
                            </div>
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Time Limit</p>
                            <p className="mt-1 text-lg font-bold text-slate-900">{selectedAssessment.time_limit_minutes} min</p>
                          </div>
                          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center">
                            <div className="mb-1 inline-flex text-slate-500">
                              <ClipboardList size={16} />
                            </div>
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Attempts</p>
                            <p className="mt-1 text-lg font-bold text-slate-900">{selectedAssessment.attempt_limit}</p>
                          </div>
                        </div>

                        <div className="mx-auto mt-6 max-w-2xl text-center">
                          {latestResultByQuizId.get(selectedAssessment.id) ? (
                            <p className="text-sm text-slate-600">
                              Latest result: {Number(latestResultByQuizId.get(selectedAssessment.id)?.score)}% (
                              {latestResultByQuizId.get(selectedAssessment.id)?.passed ? 'Passed' : 'Failed'})
                            </p>
                          ) : (
                            <p className="text-sm text-slate-500">No attempts yet.</p>
                          )}
                        </div>
                      </div>

                      <div className="mt-6 flex justify-center">
                        <button
                          disabled={!isAssessmentUnlocked(selectedAssessment)}
                          onClick={() => openQuiz(selectedAssessment.id)}
                          className={`inline-flex items-center gap-2 rounded-md px-6 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 ${meta.buttonClass}`}
                        >
                          <AssessmentIcon size={16} />
                          {meta.cta}
                        </button>
                      </div>
                    </article>
                  );
                })()}
              </div>
            ) : !selectedLesson ? (
              <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
                Select a lesson and topic from the sidebar.
              </div>
            ) : selectedTopic ? (
              <>
                <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Topic {selectedTopic.sort_order}
                  </p>
                  <h3 className="text-xl font-bold text-slate-900">{selectedTopic.title}</h3>
                  {selectedTopic.summary ? <p className="mt-2 text-sm text-slate-600">{selectedTopic.summary}</p> : null}
                  <p className="mt-2 text-xs text-slate-500">
                    Lesson {selectedLesson.sequence_no}: {selectedLesson.title}
                  </p>
                </article>

                <div className="space-y-3">
                  {selectedTopicContent.length > 0 ? (
                    selectedTopicContent.map((block) => (
                      <div key={block.id}>
                        <ContentBlock block={block} />
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
                      No content blocks yet for this topic.
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Lesson {selectedLesson.sequence_no}</p>
                      <h3 className="text-xl font-bold text-slate-900">{selectedLesson.title}</h3>
                      <p className="mt-2 text-sm text-slate-600">{selectedLesson.summary || 'No summary provided.'}</p>
                      <p className="mt-2 text-xs text-slate-500">
                        Estimated time: {formatMinutesLabel(selectedLesson.estimated_minutes)}
                      </p>
                      {(selectedLesson.overview_image_url ?? '').trim() ? (
                        <img src={selectedLesson.overview_image_url} alt={selectedLesson.title} className="mt-3 h-44 w-full max-w-3xl rounded-md border border-slate-200 object-cover" />
                      ) : null}
                      {(selectedLesson.overview_text ?? '').trim() ? (
                        <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{selectedLesson.overview_text}</p>
                      ) : null}
                    </div>
                    <button
                      disabled={!unlockedLessonIds.has(selectedLesson.id) || selectedLesson.completed || isMutating}
                      onClick={() => void handleCompleteLesson(selectedLesson.id)}
                      className="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {selectedLesson.completed ? 'Lesson Completed' : 'Mark Lesson Complete'}
                    </button>
                  </div>
                </article>

                <div className="space-y-3">
                  {selectedLessonContent.length > 0 ? (
                    selectedLessonContent.map((block) => (
                      <div key={block.id}>
                        <ContentBlock block={block} />
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
                      No lesson-level content blocks yet for this lesson.
                    </div>
                  )}
                </div>
              </>
            )}
            </div>
            {currentSequenceIndex >= 0 ? (
              <article className="mt-auto rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    disabled={!previousSequenceItem}
                    onClick={() => goToSequenceItem(previousSequenceItem)}
                    className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ChevronLeft size={16} />
                    Previous
                  </button>
                  <span className="text-xs text-slate-500">
                    Sequence {currentSequenceIndex + 1} of {sequenceItems.length}
                  </span>
                  <button
                    disabled={!nextSequenceItem}
                    onClick={() => goToSequenceItem(nextSequenceItem)}
                    className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                    <ChevronRight size={16} />
                  </button>
                </div>
              </article>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
