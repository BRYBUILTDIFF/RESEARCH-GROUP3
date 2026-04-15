import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Award,
  Check,
  CheckCircle2,
  CircleDotDashed,
  ChevronLeft,
  ChevronRight,
  CirclePlay,
  ClipboardList,
  Cpu,
  HelpCircle,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  Timer,
  XCircle,
} from 'lucide-react';
import { useParams } from 'react-router-dom';
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
  startQuiz,
  submitQuiz,
} from '../../lib/api';
import type {
  Enrollment,
  LessonContentBlock,
  LessonSummary,
  QuizQuestion,
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
      <article className="rounded-lg border border-white/10 bg-slate-900/70 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Text Lesson</p>
        <h4 className="mt-1 text-base font-semibold text-white">{block.title}</h4>
        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-200">{block.body_text || 'No text content provided.'}</p>
      </article>
    );
  }

  if (block.content_type === 'image') {
    return (
      <article className="rounded-lg border border-white/10 bg-slate-900/70 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Image</p>
        <h4 className="mt-1 text-base font-semibold text-white">{block.title}</h4>
        {block.content_url ? (
          <img src={block.content_url} alt={block.title} className="mt-3 w-full rounded-md border border-white/10 object-cover" />
        ) : (
          <p className="mt-2 text-sm text-slate-300">No image URL configured.</p>
        )}
      </article>
    );
  }

  if (block.content_type === 'video') {
    const embedUrl = block.content_url ? toYouTubeEmbedUrl(block.content_url) : null;
    return (
      <article className="rounded-lg border border-white/10 bg-slate-900/70 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Video</p>
        <h4 className="mt-1 text-base font-semibold text-white">{block.title}</h4>
        {embedUrl ? (
          <div className="mt-3 aspect-video overflow-hidden rounded-md border border-white/10">
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
          <video controls className="mt-3 w-full rounded-md border border-white/10">
            <source src={block.content_url} />
          </video>
        ) : (
          <p className="mt-2 text-sm text-slate-300">No video URL configured.</p>
        )}
      </article>
    );
  }

  if (block.content_type === 'simulation') {
    return (
      <article className="rounded-lg border border-brand-500/30 bg-brand-500/10 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-300">Simulation</p>
        <h4 className="mt-1 text-base font-semibold text-white">{block.title}</h4>
        <p className="mt-2 text-sm text-slate-200">{block.body_text || 'Complete this interactive scenario to practice troubleshooting.'}</p>
        {block.content_url ? (
          <a
            href={block.content_url}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-500"
          >
            Open Simulation
          </a>
        ) : null}
      </article>
    );
  }

  return (
    <article className="rounded-lg border border-white/10 bg-slate-900/70 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Download</p>
      <h4 className="mt-1 text-base font-semibold text-white">{block.title}</h4>
      {block.content_url ? (
        <a href={block.content_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm font-semibold text-brand-300 hover:underline">
          Open Resource
        </a>
      ) : (
        <p className="mt-2 text-sm text-slate-300">No file URL configured.</p>
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
      accent: 'text-slate-200',
      surface: 'bg-white/10',
      border: 'border-white/10',
      buttonClass: 'bg-slate-900',
      cta: 'Take Final Exam',
    };
  }
  if (isPreTest(quiz)) {
    return {
      label: 'Pre Test',
      icon: ClipboardList,
      accent: 'text-slate-200',
      surface: 'bg-white/10',
      border: 'border-white/10',
      buttonClass: 'bg-slate-900',
      cta: 'Take Pre Test',
    };
  }
  return {
    label: 'Post Test',
    icon: CirclePlay,
    accent: 'text-slate-200',
    surface: 'bg-white/10',
    border: 'border-white/10',
    buttonClass: 'bg-slate-900',
    cta: 'Take Post Test',
  };
};

export function ModuleViewerPage() {
  const { moduleId } = useParams<{ moduleId: string }>();
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
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizSubmittedByQuestionId, setQuizSubmittedByQuestionId] = useState<Record<number, true>>({});
  const [quizCurrentIndex, setQuizCurrentIndex] = useState(0);
  const [quizInProgressId, setQuizInProgressId] = useState<number | null>(null);
  const [quizSessionResult, setQuizSessionResult] = useState<QuizResult | null>(null);
  const [isQuizLoading, setIsQuizLoading] = useState(false);
  const [isQuizSubmitting, setIsQuizSubmitting] = useState(false);
  const [isSubmitConfirmOpen, setIsSubmitConfirmOpen] = useState(false);
  const [isResultProcessing, setIsResultProcessing] = useState(false);
  const [quizTerminalLogs, setQuizTerminalLogs] = useState<string[]>([]);
  const terminalLogBoxRef = useRef<HTMLDivElement | null>(null);

  const appendTerminalLog = (message: string) => {
    setQuizTerminalLogs((previous) => [...previous, `> ${message}`]);
  };

  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

  useEffect(() => {
    if (!terminalLogBoxRef.current) return;
    terminalLogBoxRef.current.scrollTop = terminalLogBoxRef.current.scrollHeight;
  }, [quizTerminalLogs]);

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
  const isQuizOngoing = quizInProgressId !== null && quizSessionResult === null;
  const selectedAssessmentAttemptCount = selectedAssessment
    ? results.filter((result) => result.quiz_id === selectedAssessment.id).length
    : 0;
  const selectedAssessmentAttemptsRemaining = selectedAssessment
    ? Math.max(selectedAssessment.attempt_limit - selectedAssessmentAttemptCount, 0)
    : 0;
  const isSelectedAssessmentOngoing = selectedAssessment
    ? isQuizOngoing && quizInProgressId === selectedAssessment.id
    : false;
  const currentQuizQuestion = isSelectedAssessmentOngoing ? quizQuestions[quizCurrentIndex] ?? null : null;
  const currentQuizAnswerId = currentQuizQuestion ? quizAnswers[currentQuizQuestion.id] : undefined;
  const isCurrentQuestionSubmitted = currentQuizQuestion
    ? Boolean(quizSubmittedByQuestionId[currentQuizQuestion.id])
    : false;
  const submittedQuestionsCount = Object.keys(quizSubmittedByQuestionId).length;
  const selectedAssessmentSessionResult =
    selectedAssessment && quizSessionResult?.quiz_id === selectedAssessment.id ? quizSessionResult : null;

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

  const resetQuizSession = () => {
    setQuizQuestions([]);
    setQuizAnswers({});
    setQuizSubmittedByQuestionId({});
    setQuizCurrentIndex(0);
    setQuizInProgressId(null);
    setQuizSessionResult(null);
    setIsSubmitConfirmOpen(false);
    setIsQuizLoading(false);
    setIsQuizSubmitting(false);
    setIsResultProcessing(false);
    setQuizTerminalLogs([]);
  };

  const handleStartQuiz = async (quiz: QuizSummary) => {
    if (!enrollment) return;
    setIsQuizLoading(true);
    setError('');
    setIsResultProcessing(false);
    setQuizSessionResult(null);
    try {
      const payload = await startQuiz(enrollment.id, quiz.id);
      setQuizQuestions(payload.questions);
      setQuizAnswers({});
      setQuizSubmittedByQuestionId({});
      setQuizCurrentIndex(0);
      setQuizInProgressId(quiz.id);
      setIsSubmitConfirmOpen(false);
      setQuizTerminalLogs([
        `> [boot] Assessment session initialized`,
        `> [auth] Enrollment #${enrollment.id} verified`,
        `> [quiz] ${quiz.title}`,
        `> [load] ${payload.questions.length} questions prepared`,
        `> [mode] Sequential lock enabled (submit to continue)`,
        `> [ready] Question 1 awaiting answer`,
      ]);
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : 'Failed to start assessment.');
    } finally {
      setIsQuizLoading(false);
    }
  };

  const handleSubmitCurrentQuestion = () => {
    if (!currentQuizQuestion || !selectedAssessment) return;
    if (!currentQuizAnswerId) {
      setError('Please select an answer before submitting this question.');
      return;
    }
    const selectedAnswerText =
      currentQuizQuestion.answers.find((answer) => answer.id === currentQuizAnswerId)?.answer_text ?? `Answer ${currentQuizAnswerId}`;
    const compactAnswerText =
      selectedAnswerText.length > 56 ? `${selectedAnswerText.slice(0, 53).trimEnd()}...` : selectedAnswerText;
    appendTerminalLog(`[q${quizCurrentIndex + 1}] Captured answer -> "${compactAnswerText}"`);
    appendTerminalLog(`[q${quizCurrentIndex + 1}] Answer locked.`);
    setError('');
    setQuizSubmittedByQuestionId((previous) => ({ ...previous, [currentQuizQuestion.id]: true }));

    if (quizCurrentIndex >= quizQuestions.length - 1) {
      appendTerminalLog('[submit] Final question reached. Awaiting confirmation.');
      setIsSubmitConfirmOpen(true);
      return;
    }
    appendTerminalLog(`[router] Loading question ${quizCurrentIndex + 2}...`);
    setQuizCurrentIndex((previous) => previous + 1);
  };

  const handleFinalizeQuiz = async () => {
    if (!selectedAssessment || !enrollment) return;
    if (quizQuestions.length === 0) return;

    if (Object.keys(quizSubmittedByQuestionId).length !== quizQuestions.length) {
      setError('Please submit answers for all questions first.');
      setIsSubmitConfirmOpen(false);
      return;
    }

    setIsSubmitConfirmOpen(false);
    setIsQuizSubmitting(true);
    setIsResultProcessing(true);
    setError('');
    try {
      appendTerminalLog('[submit] Packaging response payload...');
      await wait(220);
      appendTerminalLog('[sync] Sending answers to validation service...');
      await wait(220);
      const payload = await submitQuiz(
        enrollment.id,
        selectedAssessment.id,
        Object.entries(quizAnswers).map(([questionId, answerId]) => ({
          questionId: Number(questionId),
          answerId,
        }))
      );
      await wait(260);
      appendTerminalLog('[verify] Cross-checking responses...');
      await wait(220);
      appendTerminalLog(`[result] Score ${Number(payload.result.score).toFixed(0)}%`);
      appendTerminalLog(`[result] Status ${payload.result.passed ? 'PASSED' : 'FAILED'} | Attempt #${payload.result.attempt_no}`);
      setQuizSessionResult(payload.result);
      setQuizInProgressId(null);
      setIsSubmitConfirmOpen(false);
      const updatedResults = await getEnrollmentResults(enrollment.id);
      setResults(updatedResults);
    } catch (submitError) {
      appendTerminalLog('[error] Submission failed. Review connection and try again.');
      setError(submitError instanceof Error ? submitError.message : 'Failed to submit assessment.');
    } finally {
      setIsQuizSubmitting(false);
      setIsResultProcessing(false);
    }
  };

  const selectLesson = (lessonId: number) => {
    if (isQuizOngoing) return;
    const shouldCollapse = expandedLessonId === lessonId;
    setExpandedLessonId(shouldCollapse ? null : lessonId);
    setSelectedLessonId(lessonId);
    setSelectedTopicId(null);
    setSelectedAssessmentId(null);
    resetQuizSession();
  };

  const selectTopic = (lessonId: number, topicId: number) => {
    if (isQuizOngoing) return;
    setSelectedLessonId(lessonId);
    setExpandedLessonId(lessonId);
    setSelectedTopicId(topicId);
    setSelectedAssessmentId(null);
    resetQuizSession();
  };

  const selectAssessment = (quiz: QuizSummary) => {
    if (isQuizOngoing && quiz.id !== quizInProgressId) return;
    if (quiz.lesson_id !== null) {
      setSelectedLessonId(Number(quiz.lesson_id));
      setExpandedLessonId(Number(quiz.lesson_id));
    }
    setSelectedTopicId(null);
    setSelectedAssessmentId(quiz.id);
    if (!isQuizOngoing) {
      resetQuizSession();
    }
  };

  const goToSequenceItem = (item: SequenceItem | null) => {
    if (isQuizOngoing) return;
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
      {isLoading ? <p className="text-sm text-slate-400">Loading module content...</p> : null}

      {!isLoading ? (
        <div
          className={`grid items-stretch gap-5 xl:min-h-[calc(100vh-10rem)] ${
            isLessonsSidebarOpen ? 'xl:grid-cols-[360px_1fr]' : 'xl:grid-cols-1'
          }`}
        >
          {isLessonsSidebarOpen ? (
            <aside className="h-full space-y-2 rounded-xl border border-white/10 bg-slate-900/70 p-4 shadow-sm">
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Module {moduleIdNumber || '--'}
                </p>
                <p className="mt-1 text-sm font-semibold text-white">{moduleTitle || 'Untitled Module'}</p>
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Progress</span>
                  <span className="font-semibold text-brand-300">{completionPercent}%</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-800/70">
                  <div
                    className="h-full rounded-full bg-brand-500"
                    style={{ width: `${Math.max(0, Math.min(100, completionPercent))}%` }}
                  />
                </div>
              </div>

              <div className="mb-1 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Learning Sequence</p>
                <button
                  onClick={() => setIsLessonsSidebarOpen(false)}
                  className="rounded-md border border-white/20 p-1 text-slate-300 hover:bg-white/5"
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
                          disabled={isQuizOngoing && quizInProgressId !== quiz.id}
                          onClick={() => selectAssessment(quiz)}
                          className={`w-full rounded-md border px-3 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-60 ${
                            selectedAssessmentId === quiz.id ? 'border-white/20 bg-white/5' : 'border-white/10 bg-slate-900/70'
                          }`}
                        >
                          <p className="font-semibold text-white">Pre Test: {quiz.title}</p>
                          <p className="mt-1 text-xs text-slate-300">
                            {latest ? `Latest ${Number(latest.score)}% (${latest.passed ? 'Passed' : 'Failed'})` : 'No attempts yet'}
                          </p>
                        </button>
                      );
                    })}

                    <button
                      disabled={!lessonUnlocked || isQuizOngoing}
                      onClick={() => selectLesson(lesson.id)}
                      className={`w-full rounded-md border px-3 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-60 ${
                        selectedAssessmentId === null && selectedLessonId === lesson.id ? 'border-brand-500/40 bg-brand-500/10' : 'border-white/10 bg-slate-900/70'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <span
                          className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                            lesson.completed ? 'border-brand-500 bg-brand-600 text-white' : 'border-slate-400 bg-slate-900/70 text-slate-400'
                          }`}
                          aria-hidden="true"
                        >
                          {lesson.completed ? <Check size={12} strokeWidth={3} /> : null}
                        </span>
                        <div>
                          <p className="font-semibold text-white">{lesson.title}</p>
                          <p className="mt-1 text-xs text-slate-300">Estimated time: {formatMinutesLabel(lesson.estimated_minutes)}</p>
                          <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
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
                              disabled={!lessonUnlocked || isQuizOngoing}
                              onClick={() => selectTopic(lesson.id, topic.id)}
                              className={`w-full rounded-md border px-3 py-2 text-left text-xs disabled:cursor-not-allowed disabled:opacity-60 ${
                                selectedAssessmentId === null && selectedTopicId === topic.id
                                  ? 'border-brand-500/40 bg-brand-500/10 text-brand-200'
                                  : 'border-white/10 bg-slate-900/70 text-slate-200'
                              }`}
                            >
                              <div className="flex items-start gap-2">
                                <span
                                  className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                                    topicCompleted ? 'border-brand-500 bg-brand-600 text-white' : 'border-slate-400 bg-slate-900/70 text-slate-400'
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
                          <p className="rounded-md border border-white/10 bg-slate-900/70 px-3 py-2 text-xs text-slate-400">
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
                          disabled={isQuizOngoing && quizInProgressId !== quiz.id}
                          onClick={() => selectAssessment(quiz)}
                          className={`w-full rounded-md border px-3 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-60 ${
                            selectedAssessmentId === quiz.id ? 'border-white/20 bg-white/5' : 'border-white/10 bg-slate-900/70'
                          }`}
                        >
                          <p className="font-semibold text-white">Post Test: {quiz.title}</p>
                          <p className="mt-1 text-xs text-slate-300">
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
                  disabled={isQuizOngoing && quizInProgressId !== finalExam.id}
                  onClick={() => selectAssessment(finalExam)}
                  className={`mt-1 w-full rounded-md border px-3 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-60 ${
                    selectedAssessmentId === finalExam.id ? 'border-white/20 bg-white/5' : 'border-white/10 bg-slate-900/70'
                  }`}
                >
                  <p className="font-semibold text-white">Final Exam: {finalExam.title}</p>
                  <p className="mt-1 text-xs text-slate-300">{assessmentUnlockMessage(finalExam)}</p>
                </button>
              ) : null}
            </aside>
          ) : null}

          <div className="flex h-full min-h-0 flex-col gap-4">
            <div className="flex flex-1 flex-col gap-4">
            {!isLessonsSidebarOpen ? (
              <button
                onClick={() => setIsLessonsSidebarOpen(true)}
                className="inline-flex items-center gap-2 rounded-md border border-white/20 bg-slate-900/70 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/5"
              >
                <PanelLeftOpen size={14} />
                Show Sequence
              </button>
            ) : null}

            {selectedAssessment ? (
              <div className="flex flex-1 min-h-0 items-stretch py-2">
                {isQuizLoading ? (
                  <article className="flex h-full w-full items-center justify-center rounded-2xl border border-white/10 bg-slate-900/70 p-6 shadow-sm md:p-8">
                    <p className="text-sm text-slate-300">Preparing assessment...</p>
                  </article>
                ) : isResultProcessing ? (
                  <article className="w-full overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-sm">
                    <div className="grid h-full min-h-[620px] lg:grid-cols-[1fr_420px]">
                      <div className="flex flex-col justify-center p-8 text-brand-100">
                        <div className="mx-auto w-full max-w-2xl text-center">
                          <div className="inline-flex items-center gap-2 rounded-full border border-brand-500/40 bg-brand-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
                            <CircleDotDashed size={14} className="animate-spin" />
                            Validating Assessment
                          </div>
                          <h3 className="mt-4 text-2xl font-bold text-white md:text-3xl">Running Answer Integrity Checks</h3>
                          <p className="mt-3 text-sm text-brand-100/90">
                            Please wait while the system verifies all submitted responses and computes your final score.
                          </p>
                        </div>
                      </div>
                      <aside className="border-t border-slate-700 bg-black/40 p-5 font-mono text-xs text-brand-100 lg:border-l lg:border-t-0">
                        <div className="mb-4 flex items-center gap-2 border-b border-white/10 pb-3 text-brand-300">
                          <Cpu size={14} />
                          <span className="uppercase tracking-wider">Assessment Terminal</span>
                        </div>
                        <div ref={terminalLogBoxRef} className="space-y-2 overflow-hidden">
                          {quizTerminalLogs.map((log, index) => (
                            <p key={`${log}-${index}`} className="leading-relaxed text-brand-100/90">
                              {log}
                            </p>
                          ))}
                        </div>
                      </aside>
                    </div>
                  </article>
                ) : selectedAssessmentSessionResult ? (
                  <article className="w-full overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-sm">
                    <div className="grid h-full min-h-[620px] lg:grid-cols-[1fr_420px]">
                      <div className="flex flex-col justify-center p-8 text-brand-100">
                      {(() => {
                        const score = Math.max(0, Math.min(100, Number(selectedAssessmentSessionResult.score)));
                        const radius = 56;
                        const circumference = 2 * Math.PI * radius;
                        const offset = circumference - (score / 100) * circumference;
                        const passed = selectedAssessmentSessionResult.passed;
                        return (
                          <div className="mx-auto w-full max-w-2xl text-center">
                            <p className="text-xs font-semibold uppercase tracking-wider text-brand-300">Assessment Result</p>
                            <h3 className="mt-2 text-2xl font-bold text-white md:text-3xl">{selectedAssessment.title}</h3>
                            <div className="mt-6 flex justify-center">
                              <div className="relative inline-flex items-center justify-center">
                                <svg width="152" height="152" className="-rotate-90">
                                  <circle cx="76" cy="76" r={radius} fill="none" stroke="#1f2937" strokeWidth="12" />
                                  <circle
                                    cx="76"
                                    cy="76"
                                    r={radius}
                                    fill="none"
                                    stroke={passed ? '#22c55e' : '#ef4444'}
                                    strokeWidth="12"
                                    strokeDasharray={circumference}
                                    strokeDashoffset={offset}
                                    strokeLinecap="round"
                                  />
                                </svg>
                                <div className="absolute text-center">
                                  <p className="text-3xl font-bold text-white">{score.toFixed(0)}%</p>
                                  <p className="text-xs font-semibold uppercase tracking-wider text-brand-300/80">Score</p>
                                </div>
                              </div>
                            </div>
                            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1.5 text-sm font-semibold text-brand-100">
                              {passed ? <CheckCircle2 size={16} className="text-brand-300" /> : <XCircle size={16} className="text-rose-300" />}
                              {passed ? 'Passed' : 'Failed'} - Attempt #{selectedAssessmentSessionResult.attempt_no}
                            </div>
                            <div className="mx-auto mt-5 grid max-w-md grid-cols-2 gap-3 text-left">
                              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                                <p className="text-[11px] uppercase tracking-wider text-brand-300/80">Passing Score</p>
                                <p className="mt-1 text-lg font-semibold text-white">{selectedAssessment.passing_score}%</p>
                              </div>
                              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                                <p className="text-[11px] uppercase tracking-wider text-brand-300/80">Time Limit</p>
                                <p className="mt-1 text-lg font-semibold text-white">{selectedAssessment.time_limit_minutes} min</p>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => setQuizSessionResult(null)}
                            className="rounded-md border border-white/20 px-4 py-2 text-sm font-semibold text-brand-100 hover:bg-white/5"
                          >
                            Close Result
                          </button>
                          <button
                            type="button"
                            disabled={!isAssessmentUnlocked(selectedAssessment) || selectedAssessmentAttemptsRemaining <= 0}
                            onClick={() => void handleStartQuiz(selectedAssessment)}
                            className="rounded-md bg-brand-500 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {selectedAssessmentAttemptsRemaining > 0 ? 'Retake Assessment' : 'No Attempts Remaining'}
                          </button>
                        </div>
                      </div>
                      <aside className="border-t border-slate-700 bg-black/40 p-5 font-mono text-xs text-brand-100 lg:border-l lg:border-t-0">
                        <div className="mb-4 flex items-center gap-2 border-b border-white/10 pb-3 text-brand-300">
                          <Cpu size={14} />
                          <span className="uppercase tracking-wider">Assessment Terminal</span>
                        </div>
                        <div ref={terminalLogBoxRef} className="space-y-2 overflow-hidden">
                          {quizTerminalLogs.map((log, index) => (
                            <p key={`${log}-${index}`} className="leading-relaxed text-brand-100/90">
                              {log}
                            </p>
                          ))}
                        </div>
                      </aside>
                    </div>
                  </article>
                ) : isSelectedAssessmentOngoing ? (
                  <article className="w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-900/70 shadow-sm">
                    <div className="grid h-full min-h-[620px] lg:grid-cols-[1fr_420px]">
                      <div className="flex h-full p-6 md:p-8">
                        <div className="mx-auto flex h-full w-full max-w-4xl flex-col">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-slate-200">
                              <HelpCircle size={14} />
                              Question {quizCurrentIndex + 1} of {quizQuestions.length}
                            </div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                              Submitted {submittedQuestionsCount} / {quizQuestions.length}
                            </p>
                          </div>
                          {currentQuizQuestion ? (
                            <>
                              <div className="mt-6 flex flex-1 flex-col">
                                <h3 className="text-2xl font-bold leading-tight text-white md:text-3xl">{currentQuizQuestion.prompt}</h3>
                                <div className="mt-7 grid gap-3">
                                  {currentQuizQuestion.answers.map((answer) => (
                                    <button
                                      key={answer.id}
                                      type="button"
                                      disabled={isCurrentQuestionSubmitted}
                                      onClick={() =>
                                        setQuizAnswers((previous) => ({
                                          ...previous,
                                          [currentQuizQuestion.id]: answer.id,
                                        }))
                                      }
                                      className={`flex w-full items-center justify-between rounded-lg border px-5 py-4 text-left text-base font-medium disabled:cursor-not-allowed disabled:opacity-70 ${
                                        currentQuizAnswerId === answer.id ? 'border-slate-400 bg-white/5' : 'border-white/10 bg-slate-900/70 hover:bg-white/5'
                                      }`}
                                    >
                                      <span>{answer.answer_text}</span>
                                      {currentQuizAnswerId === answer.id ? <CheckCircle2 size={18} className="text-brand-400" /> : null}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-6">
                                <p className="text-sm text-slate-400">
                                  {isCurrentQuestionSubmitted
                                    ? 'Answer submitted.'
                                    : 'Submit this answer to proceed to the next question.'}
                                </p>
                                <button
                                  type="button"
                                  disabled={isCurrentQuestionSubmitted || isQuizSubmitting || !currentQuizAnswerId}
                                  onClick={handleSubmitCurrentQuestion}
                                  className="rounded-md bg-slate-900 px-7 py-3 text-base font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {quizCurrentIndex >= quizQuestions.length - 1 ? 'Submit Answer' : 'Submit Answer & Next'}
                                </button>
                              </div>
                            </>
                          ) : (
                            <div className="mt-6 rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                              No questions available for this assessment.
                            </div>
                          )}
                        </div>
                      </div>
                      <aside className="border-t border-slate-700 bg-slate-950 p-5 font-mono text-xs text-brand-100 lg:border-l lg:border-t-0">
                        <div className="mb-4 flex items-center gap-2 border-b border-white/10 pb-3 text-brand-300">
                          <Cpu size={14} />
                          <span className="uppercase tracking-wider">Live Terminal</span>
                        </div>
                        <div ref={terminalLogBoxRef} className="space-y-2 overflow-hidden">
                          {quizTerminalLogs.map((log, index) => (
                            <p key={`${log}-${index}`} className="leading-relaxed text-brand-100/90">
                              {log}
                            </p>
                          ))}
                        </div>
                      </aside>
                    </div>
                  </article>
                ) : (
                  (() => {
                    const meta = assessmentMeta(selectedAssessment);
                    const AssessmentIcon = meta.icon;
                    return (
                      <article className={`flex h-full w-full flex-col rounded-2xl border bg-slate-900/70 p-6 shadow-sm md:p-8 ${meta.border}`}>
                        <div className="flex flex-1 flex-col justify-center">
                          <div className="mx-auto w-full max-w-3xl text-center">
                            <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider ${meta.surface} ${meta.border} ${meta.accent}`}>
                              <AssessmentIcon size={14} />
                              {meta.label}
                            </div>
                            <h3 className="mt-3 text-2xl font-bold text-white md:text-3xl">{selectedAssessment.title}</h3>
                            <p className="mt-3 text-sm text-slate-300 md:text-base">{assessmentUnlockMessage(selectedAssessment)}</p>
                          </div>

                          <div className="mx-auto mt-7 grid w-full max-w-4xl gap-3 sm:grid-cols-3">
                            <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-center">
                              <div className="mb-1 inline-flex text-slate-400">
                                <Award size={16} />
                              </div>
                              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Passing Score</p>
                              <p className="mt-1 text-lg font-bold text-white">{selectedAssessment.passing_score}%</p>
                            </div>
                            <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-center">
                              <div className="mb-1 inline-flex text-slate-400">
                                <Timer size={16} />
                              </div>
                              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Time Limit</p>
                              <p className="mt-1 text-lg font-bold text-white">{selectedAssessment.time_limit_minutes} min</p>
                            </div>
                            <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-center">
                              <div className="mb-1 inline-flex text-slate-400">
                                <ClipboardList size={16} />
                              </div>
                              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Attempts</p>
                              <p className="mt-1 text-lg font-bold text-white">{selectedAssessment.attempt_limit}</p>
                            </div>
                          </div>

                          <div className="mx-auto mt-6 max-w-2xl text-center">
                            <p className="text-sm text-slate-300">
                              Attempts used: {selectedAssessmentAttemptCount} / {selectedAssessment.attempt_limit} | Remaining:{' '}
                              {selectedAssessmentAttemptsRemaining}
                            </p>
                            {latestResultByQuizId.get(selectedAssessment.id) ? (
                              <p className="mt-1 text-sm text-slate-300">
                                Latest result: {Number(latestResultByQuizId.get(selectedAssessment.id)?.score)}% (
                                {latestResultByQuizId.get(selectedAssessment.id)?.passed ? 'Passed' : 'Failed'})
                              </p>
                            ) : (
                              <p className="mt-1 text-sm text-slate-400">No attempts yet.</p>
                            )}
                          </div>
                        </div>

                        <div className="mt-6 flex justify-center">
                          <button
                            type="button"
                            disabled={
                              !isAssessmentUnlocked(selectedAssessment) ||
                              selectedAssessmentAttemptsRemaining <= 0 ||
                              isQuizSubmitting ||
                              isQuizLoading
                            }
                            onClick={() => void handleStartQuiz(selectedAssessment)}
                            className={`inline-flex items-center gap-2 rounded-md px-6 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 ${meta.buttonClass}`}
                          >
                            <AssessmentIcon size={16} />
                            {selectedAssessmentAttemptsRemaining <= 0 ? 'No Attempts Remaining' : meta.cta}
                          </button>
                        </div>
                      </article>
                    );
                  })()
                )}
              </div>
            ) : !selectedLesson ? (
              <div className="rounded-xl border border-white/10 bg-slate-900/70 p-5 text-sm text-slate-300 shadow-sm">
                Select a lesson and topic from the sidebar.
              </div>
            ) : selectedTopic ? (
              <>
                <article className="rounded-xl border border-white/10 bg-slate-900/70 p-5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Topic {selectedTopic.sort_order}
                  </p>
                  <h3 className="text-xl font-bold text-white">{selectedTopic.title}</h3>
                  {selectedTopic.summary ? <p className="mt-2 text-sm text-slate-300">{selectedTopic.summary}</p> : null}
                  <p className="mt-2 text-xs text-slate-400">
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
                    <div className="rounded-xl border border-white/10 bg-slate-900/70 p-5 text-sm text-slate-300 shadow-sm">
                      No content blocks yet for this topic.
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <article className="rounded-xl border border-white/10 bg-slate-900/70 p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Lesson {selectedLesson.sequence_no}</p>
                      <h3 className="text-xl font-bold text-white">{selectedLesson.title}</h3>
                      <p className="mt-2 text-sm text-slate-300">{selectedLesson.summary || 'No summary provided.'}</p>
                      <p className="mt-2 text-xs text-slate-400">
                        Estimated time: {formatMinutesLabel(selectedLesson.estimated_minutes)}
                      </p>
                      {(selectedLesson.overview_image_url ?? '').trim() ? (
                        <img src={selectedLesson.overview_image_url} alt={selectedLesson.title} className="mt-3 h-44 w-full max-w-3xl rounded-md border border-white/10 object-cover" />
                      ) : null}
                      {(selectedLesson.overview_text ?? '').trim() ? (
                        <p className="mt-3 whitespace-pre-wrap text-sm text-slate-200">{selectedLesson.overview_text}</p>
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
                    <div className="rounded-xl border border-white/10 bg-slate-900/70 p-5 text-sm text-slate-300 shadow-sm">
                      No lesson-level content blocks yet for this lesson.
                    </div>
                  )}
                </div>
              </>
            )}
            </div>
            {currentSequenceIndex >= 0 ? (
              <article className="mt-auto rounded-xl border border-white/10 bg-slate-900/70 p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    disabled={!previousSequenceItem || isQuizOngoing}
                    onClick={() => goToSequenceItem(previousSequenceItem)}
                    className="inline-flex items-center gap-2 rounded-md border border-white/20 px-3 py-2 text-sm font-semibold text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ChevronLeft size={16} />
                    Previous
                  </button>
                  <span className="text-xs text-slate-400">
                    Sequence {currentSequenceIndex + 1} of {sequenceItems.length}
                  </span>
                  <button
                    disabled={!nextSequenceItem || isQuizOngoing}
                    onClick={() => goToSequenceItem(nextSequenceItem)}
                    className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                    <ChevronRight size={16} />
                  </button>
                </div>
                {isQuizOngoing ? (
                  <p className="mt-2 text-center text-xs text-slate-400">
                    Sequence navigation is disabled while an assessment attempt is in progress.
                  </p>
                ) : null}
              </article>
            ) : null}
          </div>
        </div>
      ) : null}

      {isSubmitConfirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-slate-900/70 p-5 shadow-xl">
            <h3 className="text-lg font-bold text-white">Submit Assessment?</h3>
            <p className="mt-2 text-sm text-slate-300">
              This is the last question. Confirm to submit all your answers and see your result.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={isQuizSubmitting}
                onClick={() => setIsSubmitConfirmOpen(false)}
                className="rounded-md border border-white/20 px-4 py-2 text-sm font-semibold text-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isQuizSubmitting}
                onClick={() => void handleFinalizeQuiz()}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isQuizSubmitting ? 'Submitting...' : 'Confirm Submit'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}


