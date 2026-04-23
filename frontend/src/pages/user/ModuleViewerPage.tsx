import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDotDashed,
  CirclePlay,
  ClipboardList,
  Cpu,
  HelpCircle,
  Lock,
  PanelLeftClose,
  PanelLeftOpen,
  Timer,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
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

function normalizeUrlCandidate(value: string | null | undefined) {
  const trimmed = (value ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
}

function sanitizeRichHtml(input: string) {
  return input
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '');
}

function isVideoMediaUrl(url: string | null | undefined) {
  if (!url) return false;
  return /^(data:video\/|https?:\/\/.*\.(mp4|webm|ogg|mov)(\?.*)?$)/i.test(url);
}

type TopicLayoutTemplate = 'template-1' | 'template-2' | 'template-3';

function isTopicLayoutTemplate(value: unknown): value is TopicLayoutTemplate {
  return value === 'template-1' || value === 'template-2' || value === 'template-3';
}

function readContentMetadata(block: LessonContentBlock | null | undefined): Record<string, unknown> {
  if (!block || !block.metadata || typeof block.metadata !== 'object' || Array.isArray(block.metadata)) {
    return {};
  }
  return block.metadata;
}

function getTopicTemplateFromBlock(block: LessonContentBlock | null | undefined): TopicLayoutTemplate {
  const template = readContentMetadata(block).template;
  if (isTopicLayoutTemplate(template)) return template;
  return 'template-1';
}

type AssessmentStage = 'pre' | 'post' | 'final';

type SequenceItem =
  | {
      key: string;
      type: 'lesson';
      lesson: LessonSummary;
      unlocked: boolean;
    }
  | {
      key: string;
      type: 'assessment';
      quiz: QuizSummary;
      stage: AssessmentStage;
      lesson: LessonSummary | null;
      unlocked: boolean;
    };

type LessonViewStep =
  | {
      key: string;
      kind: 'overview';
      title: string;
      html: string;
      mediaUrl: string | null;
    }
  | {
      key: string;
      kind: 'topic';
      topic: TopicSummary;
      sections: LessonContentBlock[];
    };

const isPreTest = (quiz: QuizSummary) =>
  quiz.quiz_type === 'lesson_quiz' && (quiz.stage === 'pre_test' || quiz.lesson_id === null);

const formatMinutesLabel = (minutes: number) => `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;

const assessmentViewMeta: Record<AssessmentStage, {
  label: string;
  chipClass: string;
  cardClass: string;
  buttonClass: string;
  icon: typeof ClipboardList;
  description: string;
  cta: string;
}> = {
  pre: {
    label: 'Pre-Test',
    chipClass: 'border-violet-400/50 bg-violet-500/15 text-violet-200',
    cardClass: 'border-violet-400/30 bg-violet-950/20',
    buttonClass: 'bg-violet-600 hover:bg-violet-500',
    icon: ClipboardList,
    description: 'This assessment checks your baseline knowledge before the lessons.',
    cta: 'Start assessment',
  },
  post: {
    label: 'Post-Test',
    chipClass: 'border-orange-400/50 bg-orange-500/15 text-orange-200',
    cardClass: 'border-orange-400/30 bg-orange-950/20',
    buttonClass: 'bg-orange-600 hover:bg-orange-500',
    icon: CirclePlay,
    description: 'This assessment validates your understanding after completing the lesson topics.',
    cta: 'Start assessment',
  },
  final: {
    label: 'Simulation Testing',
    chipClass: 'border-amber-400/50 bg-amber-500/15 text-amber-200',
    cardClass: 'border-amber-400/30 bg-amber-950/20',
    buttonClass: 'bg-amber-600 hover:bg-amber-500',
    icon: Award,
    description: 'This simulation testing evaluates full-module mastery.',
    cta: 'Start simulation',
  },
};

function StatusPill({ text, className }: { text: string; className: string }) {
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${className}`}>
      {text}
    </span>
  );
}

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
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<number | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [readProgressByLessonId, setReadProgressByLessonId] = useState<Record<number, number>>({});
  const [activeLessonStepIndexByLessonId, setActiveLessonStepIndexByLessonId] = useState<Record<number, number>>({});
  const [viewedStepKeysByLessonId, setViewedStepKeysByLessonId] = useState<Record<number, Record<string, true>>>({});
  const [quizPreviewByQuizId, setQuizPreviewByQuizId] = useState<Record<number, QuizQuestion[]>>({});
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
  const contentScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const completeInFlightLessonIdsRef = useRef<Record<number, true>>({});

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
          const [topics, lessonContent] = await Promise.all([getTopics(lesson.id), getLessonContent(lesson.id)]);
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

        nextLessonContentByLessonId[artifact.lessonId].sort((a, b) => a.sort_order - b.sort_order);
      }

      Object.keys(nextContentByTopicId).forEach((topicId) => {
        nextContentByTopicId[Number(topicId)].sort((a, b) => a.sort_order - b.sort_order);
      });

      setTopicsByLessonId(nextTopicsByLessonId);
      setLessonContentByLessonId(nextLessonContentByLessonId);
      setContentByTopicId(nextContentByTopicId);

      const defaultLessonId = orderedLessons.find((lesson) => !lesson.completed)?.id ?? orderedLessons[0]?.id ?? null;
      const nextLessonId =
        selectedLessonId && orderedLessons.some((lesson) => lesson.id === selectedLessonId) ? selectedLessonId : defaultLessonId;
      const lessonOrderLookup = new Map<number, number>();
      orderedLessons.forEach((lesson, index) => {
        lessonOrderLookup.set(lesson.id, index);
      });
      const defaultPreTest =
        [...quizzesByModule]
          .filter(isPreTest)
          .sort((a, b) => {
            const orderA = a.lesson_id !== null ? lessonOrderLookup.get(a.lesson_id) ?? Number.MAX_SAFE_INTEGER : -1;
            const orderB = b.lesson_id !== null ? lessonOrderLookup.get(b.lesson_id) ?? Number.MAX_SAFE_INTEGER : -1;
            if (orderA !== orderB) return orderA - orderB;
            return a.id - b.id;
          })[0] ?? null;
      const nextAssessmentId =
        selectedAssessmentId && quizzesByModule.some((quiz) => quiz.id === selectedAssessmentId)
          ? selectedAssessmentId
          : defaultPreTest?.id ?? null;

      setSelectedLessonId(nextLessonId);
      setSelectedAssessmentId(nextAssessmentId);
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

  const lessonById = useMemo(() => {
    const map = new Map<number, LessonSummary>();
    lessons.forEach((lesson) => map.set(lesson.id, lesson));
    return map;
  }, [lessons]);

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
  const selectedLessonContent = selectedLesson ? lessonContentByLessonId[selectedLesson.id] ?? [] : [];
  const selectedLessonTopicGroups = topicsForSelectedLesson.map((topic) => ({
    topic,
    sections: contentByTopicId[topic.id] ?? [],
  }));
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
    const ordered = [...results].sort(
      (a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
    );
    ordered.forEach((result) => {
      if (!latest.has(result.quiz_id)) {
        latest.set(result.quiz_id, result);
      }
    });
    return latest;
  }, [results]);

  const lessonOrderById = useMemo(() => {
    const map = new Map<number, number>();
    lessons.forEach((lesson, index) => {
      map.set(lesson.id, index);
    });
    return map;
  }, [lessons]);

  const preTests = useMemo(() => {
    return quizzes
      .filter(isPreTest)
      .sort((a, b) => {
        const orderA = a.lesson_id !== null ? lessonOrderById.get(a.lesson_id) ?? Number.MAX_SAFE_INTEGER : -1;
        const orderB = b.lesson_id !== null ? lessonOrderById.get(b.lesson_id) ?? Number.MAX_SAFE_INTEGER : -1;
        if (orderA !== orderB) return orderA - orderB;
        return a.id - b.id;
      });
  }, [quizzes, lessonOrderById]);

  const primaryPreTest = preTests[0] ?? null;

  const postTestByLessonId = useMemo(() => {
    const map = new Map<number, QuizSummary>();
    const orderedPostTests = quizzes
      .filter((quiz) => quiz.quiz_type === 'lesson_quiz' && quiz.stage === 'post_test' && quiz.lesson_id !== null)
      .sort((a, b) => {
        const orderA = lessonOrderById.get(Number(a.lesson_id)) ?? Number.MAX_SAFE_INTEGER;
        const orderB = lessonOrderById.get(Number(b.lesson_id)) ?? Number.MAX_SAFE_INTEGER;
        if (orderA !== orderB) return orderA - orderB;
        return a.id - b.id;
      });

    orderedPostTests.forEach((quiz) => {
      const lessonId = Number(quiz.lesson_id);
      if (!map.has(lessonId)) {
        map.set(lessonId, quiz);
      }
    });

    return map;
  }, [quizzes, lessonOrderById]);

  const finalExam = quizzes.find((quiz) => quiz.quiz_type === 'final_exam') ?? null;

  const activePostTests = useMemo(() => {
    return Array.from(postTestByLessonId.values()).filter((quiz) => quiz.is_active);
  }, [postTestByLessonId]);

  const allActivePostTestsPassed = activePostTests.every((quiz) => passedQuizIds.has(quiz.id));
  const finalExamReady = Boolean(finalExam) && allLessonsCompleted && allActivePostTestsPassed;

  const getAssessmentStage = (quiz: QuizSummary): AssessmentStage => {
    if (quiz.quiz_type === 'final_exam' || quiz.stage === 'final_exam') return 'final';
    return quiz.stage === 'pre_test' ? 'pre' : 'post';
  };

  const isAssessmentUnlocked = (quiz: QuizSummary) => {
    if (!quiz.is_active) return false;
    const stage = getAssessmentStage(quiz);

    if (stage === 'pre') return true;

    if (stage === 'post') {
      if (quiz.lesson_id === null) return false;
      const lesson = lessonById.get(Number(quiz.lesson_id));
      if (!lesson) return false;
      const lessonUnlocked = unlockedLessonIds.has(lesson.id) || lesson.completed;
      return lessonUnlocked && Boolean(lesson.completed);
    }

    return finalExamReady;
  };

  const assessmentUnlockMessage = (quiz: QuizSummary) => {
    const stage = getAssessmentStage(quiz);
    if (!quiz.is_active) return 'Assessment is inactive.';

    if (stage === 'pre') {
      return 'Pre-Test is available before lessons.';
    }

    if (stage === 'post') {
      const lesson = quiz.lesson_id !== null ? lessonById.get(Number(quiz.lesson_id)) : null;
      if (!lesson) return 'Lesson mapping not found.';
      if (!lesson.completed) return 'Complete the lesson first to unlock this Post-Test.';
      return 'Ready to start.';
    }

    if (!allLessonsCompleted) return 'Complete all lessons first.';
    if (!allActivePostTestsPassed) return 'Pass all active lesson Post-Tests first.';
    return 'Ready to start.';
  };

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
  const selectedAssessmentLatestResult =
    selectedAssessmentSessionResult ??
    (selectedAssessment ? (latestResultByQuizId.get(selectedAssessment.id) ?? null) : null);
  const selectedAssessmentStage = selectedAssessment ? getAssessmentStage(selectedAssessment) : null;
  const isSimulationAssessment = selectedAssessmentStage === 'final';

  const sequenceItems = useMemo(() => {
    const items: SequenceItem[] = [];

    if (primaryPreTest) {
      items.push({
        key: `assessment-${primaryPreTest.id}`,
        type: 'assessment',
        quiz: primaryPreTest,
        stage: 'pre',
        lesson: primaryPreTest.lesson_id !== null ? lessonById.get(Number(primaryPreTest.lesson_id)) ?? null : null,
        unlocked: isAssessmentUnlocked(primaryPreTest),
      });
    }

    lessons.forEach((lesson) => {
      const lessonUnlocked = unlockedLessonIds.has(lesson.id) || lesson.completed;

      items.push({
        key: `lesson-${lesson.id}`,
        type: 'lesson',
        lesson,
        unlocked: lessonUnlocked,
      });

      const postTest = postTestByLessonId.get(lesson.id);
      if (postTest) {
        items.push({
          key: `assessment-${postTest.id}`,
          type: 'assessment',
          quiz: postTest,
          stage: 'post',
          lesson,
          unlocked: isAssessmentUnlocked(postTest),
        });
      }
    });

    if (finalExam) {
      items.push({
        key: `assessment-${finalExam.id}`,
        type: 'assessment',
        quiz: finalExam,
        stage: 'final',
        lesson: null,
        unlocked: isAssessmentUnlocked(finalExam),
      });
    }

    return items;
  }, [
    finalExam,
    isAssessmentUnlocked,
    lessonById,
    lessons,
    postTestByLessonId,
    primaryPreTest,
    unlockedLessonIds,
  ]);

  const currentSequenceKey = selectedAssessment
    ? `assessment-${selectedAssessment.id}`
    : selectedLesson
        ? `lesson-${selectedLesson.id}`
        : null;

  const currentSequenceIndex =
    currentSequenceKey === null ? -1 : sequenceItems.findIndex((item) => item.key === currentSequenceKey);

  const currentSequenceItem = currentSequenceIndex >= 0 ? sequenceItems[currentSequenceIndex] ?? null : null;
  const previousSequenceItem = currentSequenceIndex > 0 ? sequenceItems[currentSequenceIndex - 1] : null;
  const nextSequenceItem =
    currentSequenceIndex >= 0 && currentSequenceIndex < sequenceItems.length - 1
      ? sequenceItems[currentSequenceIndex + 1]
      : null;

  const currentPositionLabel = (() => {
    if (!currentSequenceItem) return 'Not selected';
    if (currentSequenceItem.type === 'lesson') {
      return `Lesson ${currentSequenceItem.lesson.sequence_no} of ${lessons.length}`;
    }
    if (currentSequenceItem.stage === 'pre') return 'Pre-Test';
    if (currentSequenceItem.stage === 'post') {
      return currentSequenceItem.lesson
        ? `Post-Test for Lesson ${currentSequenceItem.lesson.sequence_no}`
        : 'Post-Test';
    }
    return 'Simulation Testing';
  })();

  const handleCompleteLesson = async (lessonIdValue: number) => {
    if (!enrollment || completeInFlightLessonIdsRef.current[lessonIdValue]) return;
    completeInFlightLessonIdsRef.current[lessonIdValue] = true;
    setIsMutating(true);
    setError('');
    try {
      await completeLesson(enrollment.id, lessonIdValue);
      setReadProgressByLessonId((previous) => ({ ...previous, [lessonIdValue]: 100 }));
      await reload();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Failed to complete lesson.');
    } finally {
      delete completeInFlightLessonIdsRef.current[lessonIdValue];
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
      setQuizPreviewByQuizId((previous) => ({ ...previous, [quiz.id]: payload.questions }));
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
      currentQuizQuestion.answers.find((answer) => answer.id === currentQuizAnswerId)?.answer_text ??
      `Answer ${currentQuizAnswerId}`;
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

  const selectLesson = (lesson: LessonSummary) => {
    const lessonUnlocked = unlockedLessonIds.has(lesson.id) || lesson.completed;
    if (!lessonUnlocked || isQuizOngoing) return;
    setActiveLessonStepIndexByLessonId((previous) => {
      if (typeof previous[lesson.id] === 'number') return previous;
      return { ...previous, [lesson.id]: 0 };
    });
    setSelectedLessonId(lesson.id);
    setSelectedAssessmentId(null);
    resetQuizSession();
  };

  const selectAssessment = (quiz: QuizSummary) => {
    const unlocked = isAssessmentUnlocked(quiz);
    if (!unlocked && !(isQuizOngoing && quiz.id === quizInProgressId)) return;
    if (isQuizOngoing && quiz.id !== quizInProgressId) return;

    if (quiz.lesson_id !== null) {
      const lessonId = Number(quiz.lesson_id);
      setSelectedLessonId(lessonId);
    }

    setSelectedAssessmentId(quiz.id);
    if (!isQuizOngoing) {
      resetQuizSession();
    }
  };

  const goToSequenceItem = (item: SequenceItem | null) => {
    if (!item || isQuizOngoing || !item.unlocked) return;

    if (item.type === 'lesson') {
      selectLesson(item.lesson);
      return;
    }

    selectAssessment(item.quiz);
  };

  const selectedLessonFallbackContent =
    selectedLessonContent.find(
      (block) => block.body_text.trim().length > 0 || normalizeUrlCandidate(block.content_url) !== null
    ) ?? null;
  const selectedLessonDisplayHtmlRaw = (
    selectedLesson?.overview_text ??
    selectedLessonFallbackContent?.body_text ??
    ''
  ).trim();
  const selectedLessonDisplayHtml = selectedLessonDisplayHtmlRaw
    ? sanitizeRichHtml(selectedLessonDisplayHtmlRaw)
    : '';
  const selectedLessonDisplayMediaUrl =
    normalizeUrlCandidate(selectedLesson?.overview_image_url) ??
    normalizeUrlCandidate(selectedLessonFallbackContent?.content_url);

  const selectedLessonSteps = useMemo<LessonViewStep[]>(() => {
    if (!selectedLesson) return [];

    const steps: LessonViewStep[] = [
      {
        key: `lesson-${selectedLesson.id}-overview`,
        kind: 'overview',
        title: selectedLesson.title,
        html: selectedLessonDisplayHtml,
        mediaUrl: selectedLessonDisplayMediaUrl,
      },
    ];

    selectedLessonTopicGroups.forEach(({ topic, sections }) => {
      steps.push({
        key: `lesson-${selectedLesson.id}-topic-${topic.id}`,
        kind: 'topic',
        topic,
        sections,
      });
    });

    return steps;
  }, [
    selectedLesson,
    selectedLessonDisplayHtml,
    selectedLessonDisplayMediaUrl,
    selectedLessonTopicGroups,
  ]);

  const selectedLessonStepIndexRaw = selectedLesson
    ? activeLessonStepIndexByLessonId[selectedLesson.id] ?? 0
    : 0;
  const selectedLessonStepIndex =
    selectedLessonSteps.length === 0
      ? 0
      : Math.max(0, Math.min(selectedLessonSteps.length - 1, selectedLessonStepIndexRaw));
  const selectedLessonStep = selectedLessonSteps[selectedLessonStepIndex] ?? null;
  const selectedLessonViewedStepKeys = selectedLesson ? viewedStepKeysByLessonId[selectedLesson.id] ?? {} : {};
  const selectedLessonViewedStepCount = selectedLesson
    ? selectedLesson.completed
      ? selectedLessonSteps.length
      : selectedLessonSteps.reduce((count, step) => count + (selectedLessonViewedStepKeys[step.key] ? 1 : 0), 0)
    : 0;
  const isCurrentLessonStepViewed = selectedLessonStep
    ? Boolean(selectedLesson?.completed || selectedLessonViewedStepKeys[selectedLessonStep.key])
    : false;
  const selectedLessonCanAdvance = Boolean(selectedLesson?.completed || isCurrentLessonStepViewed);
  const hasPreviousLessonStep = selectedLessonStepIndex > 0;
  const hasNextLessonStep = selectedLessonStepIndex < selectedLessonSteps.length - 1;
  const isLessonStepMode = Boolean(selectedLesson) && !selectedAssessment && selectedLessonSteps.length > 0;
  const selectedLessonStepPositionLabel = selectedLesson
    ? selectedLessonStep
      ? selectedLessonStep.kind === 'overview'
        ? `Lesson ${selectedLesson.sequence_no} - Overview`
        : selectedLessonStep.topic.title
      : `Lesson ${selectedLesson.sequence_no}`
    : '';
  const displayedPositionLabel = isLessonStepMode ? selectedLessonStepPositionLabel : currentPositionLabel;

  const lessonTitleDisplay = selectedLesson ? `${selectedLesson.sequence_no}.0 ${selectedLesson.title}` : '';
  const contentTitleDisplay = selectedLessonStepPositionLabel || lessonTitleDisplay;
  const globalToolbarTitle = selectedAssessment?.title ?? (!selectedLesson ? moduleTitle || 'Module' : '');
  const isLessonOrTopicView = Boolean(selectedLesson) && !selectedAssessment;

  const updateSelectedLessonReadProgress = () => {
    if (!selectedLesson || selectedAssessment || !selectedLessonStep) return;
    const container = contentScrollContainerRef.current;
    if (!container) return;

    const maxScrollable = container.scrollHeight - container.clientHeight;
    const rawStepPercent = maxScrollable <= 2 ? 100 : Math.round((container.scrollTop / maxScrollable) * 100);
    const nextStepPercent = Math.max(0, Math.min(100, rawStepPercent));

    const totalSteps = selectedLessonSteps.length || 1;
    const isStepAlreadyViewed = selectedLesson.completed || Boolean(selectedLessonViewedStepKeys[selectedLessonStep.key]);
    const viewedCountBefore = selectedLesson.completed ? totalSteps : selectedLessonViewedStepCount;
    const viewedCountAfter =
      isStepAlreadyViewed || nextStepPercent < 99 ? viewedCountBefore : viewedCountBefore + 1;

    const aggregateProgress = selectedLesson.completed
      ? 100
      : isStepAlreadyViewed
        ? Math.round((viewedCountBefore / totalSteps) * 100)
        : Math.round(((viewedCountBefore + nextStepPercent / 100) / totalSteps) * 100);
    const nextProgress = Math.max(0, Math.min(100, aggregateProgress));

    setReadProgressByLessonId((previous) => {
      const current = previous[selectedLesson.id] ?? 0;
      if (selectedLesson.completed) {
        if (current === 100) return previous;
        return { ...previous, [selectedLesson.id]: 100 };
      }
      if (nextProgress <= current) return previous;
      return { ...previous, [selectedLesson.id]: nextProgress };
    });

    if (!selectedLesson.completed && nextStepPercent >= 99) {
      setViewedStepKeysByLessonId((previous) => {
        const lessonViewedSteps = previous[selectedLesson.id] ?? {};
        if (lessonViewedSteps[selectedLessonStep.key]) return previous;
        return {
          ...previous,
          [selectedLesson.id]: {
            ...lessonViewedSteps,
            [selectedLessonStep.key]: true,
          },
        };
      });
    }

    if (
      !selectedLesson.completed &&
      viewedCountAfter >= totalSteps &&
      !isMutating &&
      !completeInFlightLessonIdsRef.current[selectedLesson.id]
    ) {
      void handleCompleteLesson(selectedLesson.id);
    }
  };

  useEffect(() => {
    if (!selectedLesson || selectedAssessment || !selectedLessonStep) return;
    if (selectedLessonStepIndex !== selectedLessonStepIndexRaw) {
      setActiveLessonStepIndexByLessonId((previous) => ({ ...previous, [selectedLesson.id]: selectedLessonStepIndex }));
      return;
    }
    const frameId = window.requestAnimationFrame(() => {
      updateSelectedLessonReadProgress();
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [
    selectedLesson?.id,
    selectedLesson?.completed,
    selectedAssessment?.id,
    selectedLessonStep?.key,
    selectedLessonStepIndex,
    selectedLessonStepIndexRaw,
    selectedLessonSteps.length,
    selectedLessonViewedStepCount,
  ]);

  useEffect(() => {
    if (!contentScrollContainerRef.current) return;
    contentScrollContainerRef.current.scrollTop = 0;
  }, [selectedLesson?.id, selectedAssessment?.id, selectedLessonStepIndex]);

  const handlePreviousNavigation = () => {
    if (isQuizOngoing) return;
    if (isLessonStepMode && selectedLesson && hasPreviousLessonStep) {
      setActiveLessonStepIndexByLessonId((previous) => ({
        ...previous,
        [selectedLesson.id]: selectedLessonStepIndex - 1,
      }));
      return;
    }
    goToSequenceItem(previousSequenceItem);
  };

  const handleNextNavigation = () => {
    if (isQuizOngoing) return;

    if (isLessonStepMode && selectedLesson) {
      if (!selectedLessonCanAdvance) return;

      if (hasNextLessonStep) {
        setActiveLessonStepIndexByLessonId((previous) => ({
          ...previous,
          [selectedLesson.id]: selectedLessonStepIndex + 1,
        }));
        return;
      }
    }

    goToSequenceItem(nextSequenceItem);
  };

  const isPreviousNavigationDisabled = isLessonStepMode
    ? !hasPreviousLessonStep || isQuizOngoing
    : !previousSequenceItem || !previousSequenceItem.unlocked || isQuizOngoing;
  const isNextSequenceLocked = !nextSequenceItem || !nextSequenceItem.unlocked;
  const isNextNavigationDisabled = isLessonStepMode
    ? isQuizOngoing || !selectedLessonCanAdvance || (!hasNextLessonStep && isNextSequenceLocked)
    : isQuizOngoing || isNextSequenceLocked;

  return (
    <section className="space-y-4">
      {error ? <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
      {isLoading ? <p className="text-sm text-slate-400">Loading module content...</p> : null}

      {!isLoading ? (
        <div
          className={`grid gap-5 xl:h-[calc(100vh-7.5rem)] ${
            isSidebarCollapsed ? 'grid-cols-1' : 'xl:grid-cols-[536px_minmax(0,1fr)]'
          }`}
        >
          {!isSidebarCollapsed ? (
            <aside className="no-scrollbar rounded-xl border border-white/10 bg-slate-900/70 p-5 shadow-sm xl:sticky xl:top-20 xl:h-[calc(100vh-7.5rem)] xl:overflow-y-auto">
            <div className="mb-3">
              <Link
                to="/user/modules"
                className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-slate-900/70 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-white/10"
              >
                <ChevronLeft size={14} />
                Back to Modules
              </Link>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                Module {moduleIdNumber || '--'}
              </p>
              <p className="mt-1 text-base font-semibold text-white">{moduleTitle || 'Untitled Module'}</p>
              <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
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

            <div className="mt-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Learning Sequence</p>

              <div className="mt-3 space-y-3">
                {primaryPreTest ? (
                  <div className="relative pl-8">
                    {lessons.length > 0 || finalExam ? (
                      <span className="absolute left-[13px] top-7 h-[calc(100%-0.25rem)] w-px bg-white/10" aria-hidden="true" />
                    ) : null}
                    <button
                      type="button"
                      disabled={!isAssessmentUnlocked(primaryPreTest) || (isQuizOngoing && quizInProgressId !== primaryPreTest.id)}
                      onClick={() => selectAssessment(primaryPreTest)}
                      className={`w-full rounded-lg border px-4 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                        selectedAssessmentId === primaryPreTest.id
                          ? 'border-violet-400/50 bg-violet-500/10'
                          : 'border-violet-400/20 bg-violet-950/20 hover:bg-violet-500/10'
                      }`}
                    >
                      <span className="absolute left-0.5 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-violet-400/40 bg-violet-500/20 text-violet-200">
                        <ClipboardList size={13} />
                      </span>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-violet-200">Pre-Test</p>
                      <p className="mt-0.5 text-[15px] font-semibold text-white">{primaryPreTest.title}</p>
                      <p className="mt-1 text-[12px] text-slate-300">
                        {(() => {
                          const latest = latestResultByQuizId.get(primaryPreTest.id);
                          if (!latest) return 'No attempts yet';
                          return `Latest ${Number(latest.score)}% (${latest.passed ? 'Passed' : 'Failed'})`;
                        })()}
                      </p>
                    </button>
                  </div>
                ) : null}

                {lessons.map((lesson, lessonIndex) => {
                  const lessonUnlocked = unlockedLessonIds.has(lesson.id) || lesson.completed;
                  const lessonPostTest = postTestByLessonId.get(lesson.id) ?? null;
                  const lessonProgressPercent = lesson.completed
                    ? 100
                    : Math.max(0, Math.min(100, Math.round(readProgressByLessonId[lesson.id] ?? 0)));
                  const progressRadius = 15;
                  const progressCircumference = 2 * Math.PI * progressRadius;
                  const progressOffset = progressCircumference * (1 - lessonProgressPercent / 100);

                  const lessonStatus = lesson.completed
                    ? 'Done'
                    : lessonUnlocked
                      ? 'In Progress'
                      : 'Locked';

                  const isLastTopLevel = lessonIndex === lessons.length - 1 && !finalExam;

                  return (
                    <div key={lesson.id} className="relative pl-8">
                      {!isLastTopLevel ? (
                        <span className="absolute left-[13px] top-7 h-[calc(100%-0.25rem)] w-px bg-white/10" aria-hidden="true" />
                      ) : null}

                      <div
                        className={`rounded-lg border transition ${
                          selectedAssessmentId === null && selectedLessonId === lesson.id
                            ? 'border-sky-400/50 bg-sky-500/10'
                            : 'border-sky-400/20 bg-sky-950/20 hover:bg-sky-500/10'
                        } ${lessonUnlocked ? '' : 'opacity-60'}`}
                      >
                        <button
                          type="button"
                          onClick={() => selectLesson(lesson)}
                          disabled={!lessonUnlocked || isQuizOngoing}
                          className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left disabled:cursor-not-allowed"
                        >
                          <span className="absolute left-0.5 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-sky-400/40 bg-sky-500/20 text-sky-200">
                            {lessonUnlocked ? <Check size={13} /> : <Lock size={13} />}
                          </span>
                          <div className="min-w-0">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-200">
                              Lesson {lesson.sequence_no}
                            </p>
                            <p className="truncate text-[15px] font-semibold text-white">{lesson.title}</p>
                            <p className="mt-1 text-[12px] text-slate-300">{formatMinutesLabel(lesson.estimated_minutes)}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className="relative inline-flex h-10 w-10 items-center justify-center">
                              <svg className="h-10 w-10" viewBox="0 0 40 40" aria-hidden="true">
                                <circle cx="20" cy="20" r={progressRadius} fill="none" stroke="rgba(148, 163, 184, 0.35)" strokeWidth="3" />
                                <circle
                                  cx="20"
                                  cy="20"
                                  r={progressRadius}
                                  fill="none"
                                  stroke={lesson.completed ? 'rgb(52 211 153)' : 'rgb(14 165 233)'}
                                  strokeWidth="3"
                                  strokeLinecap="round"
                                  strokeDasharray={`${progressCircumference}`}
                                  strokeDashoffset={progressOffset}
                                  transform="rotate(-90 20 20)"
                                />
                              </svg>
                              <span className="absolute text-[9px] font-semibold text-slate-100">{lessonProgressPercent}%</span>
                            </span>
                            <StatusPill
                              text={lessonStatus}
                              className={
                                lesson.completed
                                  ? 'border-emerald-300/30 bg-emerald-500/10 text-emerald-200'
                                  : lessonUnlocked
                                    ? 'border-sky-300/30 bg-sky-500/10 text-sky-200'
                                    : 'border-slate-400/30 bg-slate-700/30 text-slate-300'
                              }
                            />
                          </div>
                        </button>
                      </div>

                      {lessonPostTest ? (
                        <button
                          type="button"
                          disabled={!isAssessmentUnlocked(lessonPostTest) || (isQuizOngoing && quizInProgressId !== lessonPostTest.id)}
                          onClick={() => selectAssessment(lessonPostTest)}
                          className={`ml-1 mt-2 flex w-[calc(100%-0.25rem)] items-start gap-2 rounded-md border px-3 py-2.5 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50 ${
                            selectedAssessmentId === lessonPostTest.id
                              ? 'border-orange-400/50 bg-orange-500/10 text-orange-100'
                              : 'border-orange-400/25 bg-orange-950/20 text-orange-100 hover:bg-orange-500/10'
                          }`}
                        >
                          <span className="mt-0.5 inline-flex h-2 w-2 shrink-0 rounded-full bg-orange-300" />
                          <span className="min-w-0">
                            <span className="block truncate font-semibold">Post-Test: {lessonPostTest.title}</span>
                            <span className="mt-0.5 block text-xs text-slate-300">
                              {(() => {
                                const latest = latestResultByQuizId.get(lessonPostTest.id);
                                if (!latest) return 'No attempts yet';
                                return `Latest ${Number(latest.score)}% (${latest.passed ? 'Passed' : 'Failed'})`;
                              })()}
                            </span>
                          </span>
                        </button>
                      ) : (
                        <p className="ml-1 mt-2 w-[calc(100%-0.25rem)] rounded-md border border-white/10 bg-slate-900/60 px-3 py-2.5 text-sm text-slate-400">
                          No Post-Test configured.
                        </p>
                      )}
                    </div>
                  );
                })}

                {finalExam ? (
                  <div className="relative pl-8">
                    <button
                      type="button"
                      disabled={!isAssessmentUnlocked(finalExam) || (isQuizOngoing && quizInProgressId !== finalExam.id)}
                      onClick={() => selectAssessment(finalExam)}
                      className={`w-full rounded-lg border px-4 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                        selectedAssessmentId === finalExam.id
                          ? 'border-amber-400/50 bg-amber-500/10'
                          : 'border-amber-400/25 bg-amber-950/20 hover:bg-amber-500/10'
                      }`}
                    >
                      <span className="absolute left-0.5 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-amber-400/40 bg-amber-500/20 text-amber-200">
                        {isAssessmentUnlocked(finalExam) ? <Award size={13} /> : <Lock size={13} />}
                      </span>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-200">Simulation Testing</p>
                      <p className="mt-0.5 text-[15px] font-semibold text-white">{finalExam.title}</p>
                      <p className="mt-1 text-[12px] text-slate-300">{assessmentUnlockMessage(finalExam)}</p>
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
            </aside>
          ) : null}

          <div
            className={`flex min-h-0 flex-col xl:sticky xl:top-20 xl:h-[calc(100vh-7.5rem)] xl:overflow-hidden ${
              isLessonOrTopicView ? 'gap-0' : 'gap-4'
            }`}
          >
            {isLessonOrTopicView ? (
              <div className="z-20 flex items-center gap-3 rounded-t-xl rounded-b-none border border-white/10 bg-slate-900/70 px-3 py-2.5 shadow-sm">
                <button
                  type="button"
                  onClick={() => setIsSidebarCollapsed((previous) => !previous)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/15 text-slate-200 hover:bg-white/10"
                  aria-label={isSidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
                  title={isSidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
                >
                  {isSidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
                </button>
                <p className="truncate text-[28px] leading-none text-slate-100">{contentTitleDisplay || moduleTitle || 'Module'}</p>
              </div>
            ) : null}

            {!isLessonOrTopicView ? (
              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2.5 shadow-sm">
                <button
                  type="button"
                  onClick={() => setIsSidebarCollapsed((previous) => !previous)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/15 text-slate-200 hover:bg-white/10"
                  aria-label={isSidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
                  title={isSidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
                >
                  {isSidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
                </button>
                <p className="truncate text-[28px] leading-none text-slate-100">{globalToolbarTitle}</p>
              </div>
            ) : null}

            <div
              ref={contentScrollContainerRef}
              onScroll={updateSelectedLessonReadProgress}
              className="no-scrollbar min-h-0 flex-1 overflow-y-auto pr-1 xl:overscroll-contain"
            >
            {selectedAssessment ? (
              <div className="flex h-full min-h-full items-stretch">
                {isQuizLoading ? (
                  <article className="flex h-full w-full items-center justify-center rounded-2xl border border-white/10 bg-slate-900/70 p-6 shadow-sm md:p-8">
                    <p className="text-sm text-slate-300">Preparing assessment...</p>
                  </article>
                ) : isResultProcessing ? (
                  isSimulationAssessment ? (
                    <article className="h-full w-full overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-sm">
                      <div className="grid h-full lg:grid-cols-[1fr_420px]">
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
                        <aside className="flex min-h-0 flex-col border-t border-slate-700 bg-black/40 p-5 font-mono text-xs text-brand-100 lg:border-l lg:border-t-0">
                          <div className="mb-4 flex items-center gap-2 border-b border-white/10 pb-3 text-brand-300">
                            <Cpu size={14} />
                            <span className="uppercase tracking-wider">Assessment Terminal</span>
                          </div>
                          <div ref={terminalLogBoxRef} className="no-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
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
                    <article className="flex h-full w-full items-center justify-center rounded-2xl border border-white/10 bg-slate-900/70 p-6 shadow-sm md:p-8">
                      <div className="text-center">
                        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/50 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-cyan-200">
                          <CircleDotDashed size={14} className="animate-spin" />
                          Submitting Assessment
                        </div>
                        <p className="mt-3 text-sm text-slate-300">Please wait while we process your score.</p>
                      </div>
                    </article>
                  )
                ) : isSelectedAssessmentOngoing ? (
                  isSimulationAssessment ? (
                    <article className="h-full w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-900/70 shadow-sm">
                      <div className="grid h-full lg:grid-cols-[minmax(0,1fr)_360px]">
                        <div className="relative flex h-full p-6 md:p-8">
                          <div className="mx-auto flex h-full w-full max-w-4xl flex-col">
                            <div className="flex flex-wrap items-center justify-between gap-3">
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
                                          currentQuizAnswerId === answer.id
                                            ? 'border-slate-400 bg-white/5'
                                            : 'border-white/10 bg-slate-900/70 hover:bg-white/5'
                                        }`}
                                      >
                                        <span>{answer.answer_text}</span>
                                        {currentQuizAnswerId === answer.id ? (
                                          <CheckCircle2 size={18} className="text-brand-400" />
                                        ) : null}
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
                                    className="inline-flex items-center gap-2 rounded-lg border border-cyan-300/60 bg-cyan-500 px-7 py-3 text-base font-semibold text-slate-950 shadow-[0_0_0_1px_rgba(34,211,238,0.35),0_10px_24px_rgba(6,182,212,0.35)] transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {quizCurrentIndex >= quizQuestions.length - 1 ? 'Submit Answer' : 'Submit Answer & Next'}
                                    <ChevronRight size={16} />
                                  </button>
                                </div>
                              </>
                            ) : (
                              <div className="mt-6 rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                                No questions available for this assessment.
                              </div>
                            )}
                          </div>

                          {isSubmitConfirmOpen ? (
                            <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
                              <div className="w-full max-w-md rounded-xl border border-white/10 bg-slate-900/80 p-5 shadow-xl">
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
                        </div>

                        <aside className="flex min-h-0 flex-col border-t border-slate-700 bg-slate-950 p-5 font-mono text-xs text-brand-100 lg:border-l lg:border-t-0">
                          <div className="mb-4 flex items-center gap-2 border-b border-white/10 pb-3 text-brand-300">
                            <Cpu size={14} />
                            <span className="uppercase tracking-wider">Live Terminal</span>
                          </div>
                          <div className="mb-3 grid grid-cols-2 gap-2 text-[10px]">
                            <div className="rounded border border-white/10 bg-white/5 px-2 py-1 text-slate-300">
                              Q {quizCurrentIndex + 1}/{quizQuestions.length}
                            </div>
                            <div className="rounded border border-white/10 bg-white/5 px-2 py-1 text-slate-300">
                              Submitted {submittedQuestionsCount}
                            </div>
                          </div>
                          <div ref={terminalLogBoxRef} className="no-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
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
                    <article className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-900/70 p-6 shadow-sm md:p-8">
                      <div className="mx-auto flex w-full max-w-4xl flex-col">
                        <div className="flex flex-wrap items-center justify-between gap-3">
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
                                      currentQuizAnswerId === answer.id
                                        ? 'border-slate-400 bg-white/5'
                                        : 'border-white/10 bg-slate-900/70 hover:bg-white/5'
                                    }`}
                                  >
                                    <span>{answer.answer_text}</span>
                                    {currentQuizAnswerId === answer.id ? (
                                      <CheckCircle2 size={18} className="text-brand-400" />
                                    ) : null}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-6">
                              <p className="text-sm text-slate-400">
                                {isCurrentQuestionSubmitted
                                  ? 'Answer submitted.'
                                  : 'Submit this answer to proceed to the next question.'}
                              </p>
                              <button
                                type="button"
                                disabled={isCurrentQuestionSubmitted || isQuizSubmitting || !currentQuizAnswerId}
                                onClick={handleSubmitCurrentQuestion}
                                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {quizCurrentIndex >= quizQuestions.length - 1 ? 'Submit Answer' : 'Submit Answer & Next'}
                                <ChevronRight size={16} />
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="mt-6 rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                            No questions available for this assessment.
                          </div>
                        )}
                      </div>

                      {isSubmitConfirmOpen ? (
                        <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
                          <div className="w-full max-w-md rounded-xl border border-white/10 bg-slate-900/80 p-5 shadow-xl">
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
                    </article>
                  )
                ) : selectedAssessmentSessionResult ? (
                  isSimulationAssessment ? (
                    <article className="h-full w-full overflow-hidden rounded-2xl border border-cyan-400/30 bg-slate-950 shadow-sm">
                      <div className="grid h-full lg:grid-cols-[minmax(0,1fr)_360px]">
                        <div className="flex h-full flex-col justify-center p-6 md:p-10">
                          <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
                            Assessment Complete
                          </p>
                          <h3 className="mt-3 text-3xl font-bold text-white md:text-4xl">
                            {selectedAssessmentSessionResult.passed ? 'Quiz Passed' : 'Quiz Failed'}
                          </h3>
                          <p className="mt-2 text-sm text-slate-300">
                            {selectedAssessment.title} evaluation finished. Review your score and continue to the next learning step.
                          </p>

                          <div className="mt-6 grid gap-3 sm:grid-cols-3">
                            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                              <p className="font-mono text-[11px] uppercase tracking-wider text-slate-400">Score</p>
                              <p className="mt-1 text-2xl font-bold text-cyan-300">{Number(selectedAssessmentSessionResult.score)}%</p>
                            </div>
                            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                              <p className="font-mono text-[11px] uppercase tracking-wider text-slate-400">Passing</p>
                              <p className="mt-1 text-2xl font-bold text-white">{selectedAssessment.passing_score}%</p>
                            </div>
                            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                              <p className="font-mono text-[11px] uppercase tracking-wider text-slate-400">Attempt</p>
                              <p className="mt-1 text-2xl font-bold text-white">#{selectedAssessmentSessionResult.attempt_no}</p>
                            </div>
                          </div>

                          <div className="mt-5">
                            <StatusPill
                              text={selectedAssessmentSessionResult.passed ? 'Passed' : 'Failed'}
                              className={
                                selectedAssessmentSessionResult.passed
                                  ? 'border-emerald-300/30 bg-emerald-500/10 text-emerald-200'
                                  : 'border-rose-300/30 bg-rose-500/10 text-rose-200'
                              }
                            />
                          </div>

                          <div className="mt-6 flex flex-wrap items-center gap-3">
                            <button
                              type="button"
                              disabled={
                                selectedAssessmentAttemptsRemaining <= 0 ||
                                isQuizSubmitting ||
                                isQuizLoading
                              }
                              onClick={() => void handleStartQuiz(selectedAssessment)}
                              className="inline-flex items-center gap-2 rounded-lg border border-cyan-300/60 bg-cyan-500 px-6 py-3 text-sm font-semibold text-slate-950 shadow-[0_0_0_1px_rgba(34,211,238,0.35),0_10px_24px_rgba(6,182,212,0.35)] transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <CirclePlay size={16} />
                              Take Quiz Again
                            </button>
                            <p className="text-sm text-slate-300">
                              Remaining attempts: {selectedAssessmentAttemptsRemaining}
                            </p>
                          </div>
                        </div>

                        <aside className="flex min-h-0 flex-col border-t border-slate-700 bg-black/40 p-5 font-mono text-xs text-brand-100 lg:border-l lg:border-t-0">
                          <div className="mb-4 flex items-center gap-2 border-b border-white/10 pb-3 text-brand-300">
                            <Cpu size={14} />
                            <span className="uppercase tracking-wider">Result Terminal</span>
                          </div>
                          <div ref={terminalLogBoxRef} className="no-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
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
                    <article className="w-full rounded-2xl border border-white/10 bg-slate-900/70 p-6 shadow-sm md:p-8">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-300">Assessment Complete</p>
                      <h3 className="mt-2 text-2xl font-bold text-white">
                        {selectedAssessmentSessionResult.passed ? 'Quiz Passed' : 'Quiz Failed'}
                      </h3>
                      <p className="mt-2 text-sm text-slate-300">
                        {selectedAssessment.title} finished. Review your score below.
                      </p>

                      <div className="mt-6 grid gap-3 sm:grid-cols-3">
                        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                          <p className="text-[11px] uppercase tracking-wider text-slate-400">Score</p>
                          <p className="mt-1 text-2xl font-bold text-brand-300">{Number(selectedAssessmentSessionResult.score)}%</p>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                          <p className="text-[11px] uppercase tracking-wider text-slate-400">Passing</p>
                          <p className="mt-1 text-2xl font-bold text-white">{selectedAssessment.passing_score}%</p>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                          <p className="text-[11px] uppercase tracking-wider text-slate-400">Attempt</p>
                          <p className="mt-1 text-2xl font-bold text-white">#{selectedAssessmentSessionResult.attempt_no}</p>
                        </div>
                      </div>

                      <div className="mt-5">
                        <StatusPill
                          text={selectedAssessmentSessionResult.passed ? 'Passed' : 'Failed'}
                          className={
                            selectedAssessmentSessionResult.passed
                              ? 'border-emerald-300/30 bg-emerald-500/10 text-emerald-200'
                              : 'border-rose-300/30 bg-rose-500/10 text-rose-200'
                          }
                        />
                      </div>

                      <div className="mt-6 flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          disabled={
                            selectedAssessmentAttemptsRemaining <= 0 ||
                            isQuizSubmitting ||
                            isQuizLoading
                          }
                          onClick={() => void handleStartQuiz(selectedAssessment)}
                          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <CirclePlay size={16} />
                          Take Quiz Again
                        </button>
                        <p className="text-sm text-slate-300">
                          Remaining attempts: {selectedAssessmentAttemptsRemaining}
                        </p>
                      </div>
                    </article>
                  )
                ) : (
                  (() => {
                    const stage = selectedAssessmentStage ?? 'pre';
                    const meta = assessmentViewMeta[stage];
                    const AssessmentIcon = meta.icon;
                    const latest = selectedAssessmentLatestResult;
                    const unlocked = isAssessmentUnlocked(selectedAssessment);

                    if (!isSimulationAssessment) {
                      return (
                        <article className="w-full rounded-2xl border border-white/10 bg-slate-900/70 p-6 shadow-sm md:p-8">
                          <div className="inline-flex items-center gap-2">
                            <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider ${meta.chipClass}`}>
                              {meta.label}
                            </span>
                            {!unlocked ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-slate-400/30 bg-slate-700/30 px-2.5 py-1 text-[11px] font-semibold text-slate-300">
                                <Lock size={12} />
                                Locked
                              </span>
                            ) : null}
                          </div>

                          <h3 className="mt-4 text-3xl font-bold text-white">{selectedAssessment.title}</h3>
                          <p className="mt-2 text-sm text-slate-300">{assessmentUnlockMessage(selectedAssessment)}</p>

                          <div className="mt-6 grid gap-3 sm:grid-cols-3">
                            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                              <p className="text-[11px] uppercase tracking-wider text-slate-400">Passing</p>
                              <p className="mt-1 text-2xl font-bold text-white">{selectedAssessment.passing_score}%</p>
                            </div>
                            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                              <p className="text-[11px] uppercase tracking-wider text-slate-400">Timer</p>
                              <p className="mt-1 text-2xl font-bold text-white">{selectedAssessment.time_limit_minutes}m</p>
                            </div>
                            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                              <p className="text-[11px] uppercase tracking-wider text-slate-400">Attempts</p>
                              <p className="mt-1 text-2xl font-bold text-white">{selectedAssessment.attempt_limit}</p>
                            </div>
                          </div>

                          <div className="mt-6 flex flex-wrap items-center gap-3">
                            <button
                              type="button"
                              disabled={
                                !unlocked ||
                                selectedAssessmentAttemptsRemaining <= 0 ||
                                isQuizSubmitting ||
                                isQuizLoading
                              }
                              onClick={() => void handleStartQuiz(selectedAssessment)}
                              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <CirclePlay size={16} />
                              {selectedAssessmentAttemptCount > 0 ? 'Take Quiz Again' : 'Start Quiz'}
                            </button>
                            <p className="text-sm text-slate-300">
                              Remaining attempts: {selectedAssessmentAttemptsRemaining}
                            </p>
                          </div>

                          {latest ? (
                            <p className="mt-4 text-xs text-slate-400">
                              Latest attempt: {Number(latest.score)}% ({latest.passed ? 'Passed' : 'Failed'})
                            </p>
                          ) : (
                            <p className="mt-4 text-xs text-slate-400">No attempts yet.</p>
                          )}
                        </article>
                      );
                    }

                    return (
                      <article className="h-full w-full overflow-hidden rounded-2xl border border-cyan-400/30 bg-slate-950 shadow-sm">
                        <div className="grid h-full lg:grid-cols-[minmax(0,1fr)_320px]">
                          <div className="flex h-full flex-col justify-center p-6 md:p-10">
                            <div className="inline-flex items-center gap-2">
                              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-cyan-300/50 bg-cyan-500/10 text-cyan-200">
                                <AssessmentIcon size={20} />
                              </span>
                              <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider ${meta.chipClass}`}>
                                {meta.label}
                              </span>
                              {!unlocked ? (
                                <span className="inline-flex items-center gap-1 rounded-full border border-slate-400/30 bg-slate-700/30 px-2.5 py-1 text-[11px] font-semibold text-slate-300">
                                  <Lock size={12} />
                                  Locked
                                </span>
                              ) : null}
                            </div>

                            <h3 className="mt-5 text-3xl font-bold text-white md:text-4xl">Ready for simulation</h3>
                            <p className="mt-3 max-w-2xl text-sm text-slate-300">{meta.description}</p>
                            <p className="mt-2 font-mono text-xs uppercase tracking-[0.12em] text-cyan-300/90">
                              {assessmentUnlockMessage(selectedAssessment)}
                            </p>

                            <div className="mt-6 grid gap-3 sm:grid-cols-3">
                              <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                                <p className="font-mono text-[11px] uppercase tracking-wider text-slate-400">Passing</p>
                                <p className="mt-1 text-2xl font-bold text-white">{selectedAssessment.passing_score}%</p>
                              </div>
                              <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                                <p className="font-mono text-[11px] uppercase tracking-wider text-slate-400">Timer</p>
                                <p className="mt-1 text-2xl font-bold text-white">{selectedAssessment.time_limit_minutes}m</p>
                              </div>
                              <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                                <p className="font-mono text-[11px] uppercase tracking-wider text-slate-400">Attempts</p>
                                <p className="mt-1 text-2xl font-bold text-white">{selectedAssessment.attempt_limit}</p>
                              </div>
                            </div>

                            <div className="mt-6 flex flex-wrap items-center gap-3">
                              <button
                                type="button"
                                disabled={
                                  !unlocked ||
                                  selectedAssessmentAttemptsRemaining <= 0 ||
                                  isQuizSubmitting ||
                                  isQuizLoading
                                }
                                onClick={() => void handleStartQuiz(selectedAssessment)}
                                className="inline-flex items-center gap-2 rounded-lg border border-cyan-300/60 bg-cyan-500 px-6 py-3 text-sm font-semibold text-slate-950 shadow-[0_0_0_1px_rgba(34,211,238,0.35),0_10px_24px_rgba(6,182,212,0.35)] transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <CirclePlay size={16} />
                                {selectedAssessmentAttemptCount > 0 ? 'Take Quiz Again' : 'Start Quiz'}
                              </button>
                              <p className="text-sm text-slate-300">
                                Remaining attempts: {selectedAssessmentAttemptsRemaining}
                              </p>
                            </div>
                          </div>

                          <aside className="flex min-h-0 flex-col border-t border-slate-700 bg-black/40 p-5 font-mono text-xs text-brand-100 lg:border-l lg:border-t-0">
                            <div className="mb-4 flex items-center gap-2 border-b border-white/10 pb-3 text-brand-300">
                              <Cpu size={14} />
                              <span className="uppercase tracking-wider">Prep Terminal</span>
                            </div>
                            <div className="space-y-2">
                              <p className="leading-relaxed text-brand-100/90">{`> [quiz] ${selectedAssessment.title}`}</p>
                              <p className="leading-relaxed text-brand-100/90">{`> [stage] ${meta.label}`}</p>
                              <p className="leading-relaxed text-brand-100/90">{`> [constraint] pass >= ${selectedAssessment.passing_score}%`}</p>
                              <p className="leading-relaxed text-brand-100/90">{`> [window] ${selectedAssessment.time_limit_minutes} minutes`}</p>
                              <p className="leading-relaxed text-brand-100/90">{`> [attempts] remaining ${selectedAssessmentAttemptsRemaining}`}</p>
                              {latest ? (
                                <p className="leading-relaxed text-brand-100/90">{`> [latest] ${Number(latest.score)}% (${latest.passed ? 'PASSED' : 'FAILED'})`}</p>
                              ) : (
                                <p className="leading-relaxed text-brand-100/90">{'> [latest] no attempts yet'}</p>
                              )}
                              <p className="leading-relaxed text-brand-100/90">{'> [ready] launch sequence available'}</p>
                            </div>
                          </aside>
                        </div>
                      </article>
                    );
                  })()
                )}
              </div>
            ) : !selectedLesson ? (
              <article className="rounded-xl border border-white/10 bg-slate-900/70 p-5 text-sm text-slate-300 shadow-sm">
                Select a lesson or assessment from the sequence rail.
              </article>
            ) : (
              <section>
                  <article
                    className={`border border-white/10 bg-slate-900/70 shadow-sm ${
                      isLessonOrTopicView ? '-mt-px rounded-b-xl rounded-t-none' : 'rounded-xl'
                    }`}
                  >
                    <div className="space-y-8 p-5">
                      {selectedLessonStep?.kind === 'overview' ? (
                        <>
                          <div>
                            {selectedLessonStep.html ? (
                              <div
                                className="max-w-none space-y-3 text-sm leading-relaxed text-slate-200 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-white [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-white [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-white [&_li]:ml-5 [&_li]:list-disc [&_ol>li]:list-decimal [&_p]:text-slate-200"
                                dangerouslySetInnerHTML={{ __html: selectedLessonStep.html }}
                              />
                            ) : (
                              <p className="text-sm text-slate-400">No lesson content yet.</p>
                            )}
                          </div>

                          <div>
                            {selectedLessonStep.mediaUrl ? (
                              isVideoMediaUrl(selectedLessonStep.mediaUrl) ? (
                                <video
                                  src={selectedLessonStep.mediaUrl}
                                  controls
                                  className="max-h-[360px] w-full rounded-md border border-white/10 bg-black/30 object-contain"
                                />
                              ) : (
                                <img
                                  src={selectedLessonStep.mediaUrl}
                                  alt={selectedLesson.title}
                                  className="max-h-[360px] w-full rounded-md border border-white/10 bg-black/30 object-contain"
                                />
                              )
                            ) : (
                              <p className="text-sm text-slate-400">No media uploaded.</p>
                            )}
                          </div>
                        </>
                      ) : selectedLessonStep?.kind === 'topic' ? (
                        <section className="space-y-4">
                          <div>
                            <h4 className="text-lg font-semibold text-white">{selectedLessonStep.topic.title}</h4>
                            {selectedLessonStep.topic.summary ? (
                              <p className="mt-1 text-sm text-slate-300">{selectedLessonStep.topic.summary}</p>
                            ) : null}
                          </div>

                          {selectedLessonStep.sections.length === 0 ? (
                            <p className="text-sm text-slate-400">No content in this topic yet.</p>
                          ) : null}

                          {selectedLessonStep.sections.map((section, sectionIndex) => {
                            const sectionTemplate = getTopicTemplateFromBlock(section);
                            const sectionHtmlRaw = (section.body_text ?? '').trim();
                            const sectionHtml = sectionHtmlRaw ? sanitizeRichHtml(sectionHtmlRaw) : '';
                            const sectionMediaUrl = normalizeUrlCandidate(section.content_url);
                            const hasSectionMedia = Boolean(sectionMediaUrl);
                            const isTemplateReversed = sectionTemplate === 'template-3';

                            return (
                              <section key={section.id} className="space-y-4">
                                {sectionTemplate === 'template-2' ? (
                                  <div className="space-y-4">
                                    <div>
                                      {sectionHtml ? (
                                        <div
                                          className="max-w-none space-y-3 text-sm leading-relaxed text-slate-200 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-white [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-white [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-white [&_li]:ml-5 [&_li]:list-disc [&_ol>li]:list-decimal [&_p]:text-slate-200"
                                          dangerouslySetInnerHTML={{ __html: sectionHtml }}
                                        />
                                      ) : (
                                        <p className="text-sm text-slate-400">No text content yet.</p>
                                      )}
                                    </div>
                                    {hasSectionMedia ? (
                                      <div>
                                        {isVideoMediaUrl(sectionMediaUrl) ? (
                                          <video
                                            src={sectionMediaUrl}
                                            controls
                                            className="max-h-[360px] w-full rounded-md border border-white/10 bg-black/30 object-contain"
                                          />
                                        ) : (
                                          <img
                                            src={sectionMediaUrl}
                                            alt={`${selectedLessonStep.topic.title} section ${sectionIndex + 1}`}
                                            className="max-h-[360px] w-full rounded-md border border-white/10 bg-black/30 object-contain"
                                          />
                                        )}
                                      </div>
                                    ) : null}
                                  </div>
                                ) : hasSectionMedia ? (
                                  <div
                                    className={`grid gap-8 xl:items-start ${
                                      isTemplateReversed
                                        ? 'xl:grid-cols-[340px_minmax(0,1fr)]'
                                        : 'xl:grid-cols-[minmax(0,1fr)_340px]'
                                    }`}
                                  >
                                    <div className={isTemplateReversed ? 'xl:order-2' : ''}>
                                      {sectionHtml ? (
                                        <div
                                          className="max-w-none space-y-3 text-sm leading-relaxed text-slate-200 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-white [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-white [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-white [&_li]:ml-5 [&_li]:list-disc [&_ol>li]:list-decimal [&_p]:text-slate-200"
                                          dangerouslySetInnerHTML={{ __html: sectionHtml }}
                                        />
                                      ) : (
                                        <p className="text-sm text-slate-400">No text content yet.</p>
                                      )}
                                    </div>
                                    <div className={isTemplateReversed ? 'xl:order-1' : ''}>
                                      {isVideoMediaUrl(sectionMediaUrl) ? (
                                        <video
                                          src={sectionMediaUrl}
                                          controls
                                          className="max-h-[320px] w-full rounded-md border border-white/10 bg-black/30 object-contain"
                                        />
                                      ) : (
                                        <img
                                          src={sectionMediaUrl}
                                          alt={`${selectedLessonStep.topic.title} section ${sectionIndex + 1}`}
                                          className="max-h-[320px] w-full rounded-md border border-white/10 bg-black/30 object-contain"
                                        />
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  <div>
                                    {sectionHtml ? (
                                      <div
                                        className="max-w-none space-y-3 text-sm leading-relaxed text-slate-200 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-white [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-white [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-white [&_li]:ml-5 [&_li]:list-disc [&_ol>li]:list-decimal [&_p]:text-slate-200"
                                        dangerouslySetInnerHTML={{ __html: sectionHtml }}
                                      />
                                    ) : (
                                      <p className="text-sm text-slate-400">No text content yet.</p>
                                    )}
                                  </div>
                                )}
                              </section>
                            );
                          })}
                        </section>
                      ) : (
                        <p className="text-sm text-slate-400">No lesson content yet.</p>
                      )}
                    </div>
                  </article>
                </section>
            )}
            </div>

            {currentSequenceIndex >= 0 ? (
              <div className="mt-auto pt-4">
                <article className="rounded-xl border border-white/10 bg-slate-900/70 p-4 shadow-sm">
                  <div className="grid items-center gap-3 md:grid-cols-[1fr_auto_1fr]">
                    <div className="flex">
                      <button
                        disabled={isPreviousNavigationDisabled}
                        onClick={handlePreviousNavigation}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/20 bg-slate-900/80 px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50 md:w-auto md:min-w-[136px]"
                      >
                        <ChevronLeft size={16} />
                        Previous
                      </button>
                    </div>

                    <div className="px-2 text-center">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Current Page</p>
                      <p className="text-sm font-medium text-slate-200">{displayedPositionLabel}</p>
                    </div>

                    <div className="flex md:justify-end">
                      <button
                        disabled={isNextNavigationDisabled}
                        onClick={handleNextNavigation}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/20 bg-slate-900/80 px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50 md:w-auto md:min-w-[136px]"
                      >
                        Next
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>

                  {!isQuizOngoing && isLessonStepMode && !selectedLessonCanAdvance ? (
                    <p className="mt-2 text-center text-xs text-slate-400">
                      Scroll to the end of this page to unlock Next.
                    </p>
                  ) : null}

                  {!isQuizOngoing && !isLessonStepMode && nextSequenceItem && !nextSequenceItem.unlocked ? (
                    <p className="mt-2 text-center text-xs text-slate-400">Next item is locked.</p>
                  ) : null}

                  {!isQuizOngoing && isLessonStepMode && !hasNextLessonStep && nextSequenceItem && !nextSequenceItem.unlocked ? (
                    <p className="mt-2 text-center text-xs text-slate-400">Next item is locked.</p>
                  ) : null}

                  {isQuizOngoing ? (
                    <p className="mt-2 text-center text-xs text-slate-400">
                      Sequence navigation is disabled while an assessment attempt is in progress.
                    </p>
                  ) : null}
                </article>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

    </section>
  );
}

