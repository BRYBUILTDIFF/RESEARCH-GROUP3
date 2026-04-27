import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  Check,
  CheckCircle2,
  ChevronDown,
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
  AnswerOption,
  Enrollment,
  LessonContentBlock,
  LessonSummary,
  ModuleBuilderPayload,
  QuizQuestion,
  QuizQuestionRow,
  QuizResult,
  QuizSummary,
  TopicSummary,
} from '../../types/lms';

function normalizeUrlCandidate(value: string | null | undefined) {
  const trimmed = (value ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseLessonOverviewMediaUrls(value: string | null | undefined): string[] {
  const normalized = normalizeUrlCandidate(value);
  if (!normalized) return [];

  try {
    const parsed = JSON.parse(normalized) as unknown;
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => (typeof item === 'string' ? normalizeUrlCandidate(item) : null))
        .filter((item): item is string => Boolean(item));
    }
  } catch {
    // Backward compatibility for legacy single URL value.
  }

  return [normalized];
}

const ALLOWED_INLINE_STYLE_PROPERTIES = new Set([
  'color',
  'background-color',
  'font-size',
  'font-weight',
  'font-style',
  'text-decoration',
  'text-align',
]);

function sanitizeInlineStyle(styleValue: string) {
  return styleValue
    .split(';')
    .map((declaration) => declaration.trim())
    .filter((declaration) => declaration.length > 0)
    .map((declaration) => {
      const separatorIndex = declaration.indexOf(':');
      if (separatorIndex === -1) return null;

      const property = declaration.slice(0, separatorIndex).trim().toLowerCase();
      let value = declaration.slice(separatorIndex + 1).trim();
      if (!ALLOWED_INLINE_STYLE_PROPERTIES.has(property)) return null;
      if (/expression|javascript:|url\(/i.test(value)) return null;

      if (property === 'font-size') {
        const numericValue = Number.parseFloat(value);
        if (!Number.isFinite(numericValue)) return null;
        const unitMatch = value.match(/[a-z%]+$/i);
        const unit = (unitMatch ? unitMatch[0] : 'px').toLowerCase();
        if (!['px', 'em', 'rem', '%'].includes(unit)) return null;
        const clampedValue = Math.max(8, Math.min(96, numericValue));
        const normalizedNumber = Number.isInteger(clampedValue)
          ? `${clampedValue}`
          : clampedValue.toFixed(2).replace(/\.?0+$/, '');
        value = `${normalizedNumber}${unit}`;
      }

      return `${property}: ${value}`;
    })
    .filter((declaration): declaration is string => Boolean(declaration))
    .join('; ');
}

function sanitizeRichHtml(input: string) {
  return input
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
    .replace(/\sclass="[^"]*"/gi, '')
    .replace(/\sclass='[^']*'/gi, '')
    .replace(/\sstyle="([^"]*)"/gi, (_match, styleValue: string) => {
      const safeStyle = sanitizeInlineStyle(styleValue);
      return safeStyle ? ` style="${safeStyle}"` : '';
    })
    .replace(/\sstyle='([^']*)'/gi, (_match, styleValue: string) => {
      const safeStyle = sanitizeInlineStyle(styleValue);
      return safeStyle ? ` style="${safeStyle}"` : '';
    });
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
      mediaUrls: string[];
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

type ModuleViewerPageProps = {
  previewData?: ModuleBuilderPayload | null;
  previewBypassLocks?: boolean;
};

function buildPreviewQuestionsByQuizId(
  questions: QuizQuestionRow[],
  answers: AnswerOption[]
): Record<number, QuizQuestion[]> {
  const answersByQuestionId = new Map<number, AnswerOption[]>();
  answers.forEach((answer) => {
    const existing = answersByQuestionId.get(answer.question_id) ?? [];
    existing.push(answer);
    answersByQuestionId.set(answer.question_id, existing);
  });

  const questionsByQuizId: Record<number, QuizQuestion[]> = {};
  questions
    .slice()
    .sort((a, b) => (a.quiz_id - b.quiz_id) || (a.sort_order - b.sort_order) || (a.id - b.id))
    .forEach((question) => {
      const questionAnswers = (answersByQuestionId.get(question.id) ?? [])
        .slice()
        .sort((a, b) => (a.sort_order - b.sort_order) || (a.id - b.id));
      const correctCount = questionAnswers.filter((answer) => Boolean(answer.is_correct)).length;
      const effectiveType = question.question_type === 'multiple_choice' || correctCount > 1 ? 'multiple_choice' : 'single_choice';
      const effectiveMaxSelections =
        effectiveType === 'multiple_choice'
          ? Math.max(1, Number(question.max_selections) || 1, correctCount)
          : 1;

      if (!questionsByQuizId[question.quiz_id]) {
        questionsByQuizId[question.quiz_id] = [];
      }

      questionsByQuizId[question.quiz_id].push({
        id: question.id,
        prompt: question.prompt,
        question_type: effectiveType,
        max_selections: effectiveMaxSelections,
        points: question.points,
        sort_order: question.sort_order,
        answers: questionAnswers,
      });
    });

  return questionsByQuizId;
}

export function ModuleViewerPage({ previewData = null, previewBypassLocks = false }: ModuleViewerPageProps = {}) {
  const { moduleId } = useParams<{ moduleId: string }>();
  const isPreviewMode = Boolean(previewData);
  const isPreviewBypassMode = isPreviewMode && previewBypassLocks;
  const moduleIdNumber = isPreviewMode ? Number(previewData?.module.id ?? 0) : Number(moduleId);

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
  const [lessonResetRequiredByLessonId, setLessonResetRequiredByLessonId] = useState<Record<number, true>>({});
  const [postTestRecoveredCycleByLessonId, setPostTestRecoveredCycleByLessonId] = useState<Record<number, number>>({});
  const [expandedLessonIds, setExpandedLessonIds] = useState<Record<number, true>>({});
  const [quizPreviewByQuizId, setQuizPreviewByQuizId] = useState<Record<number, QuizQuestion[]>>({});
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number[]>>({});
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
      if (isPreviewMode && previewData) {
        setModuleTitle(previewData.module.title);
        setEnrollment({
          id: -1 * Math.max(1, Number(previewData.module.id) || 1),
          user_id: 0,
          module_id: previewData.module.id,
          status: 'in_progress',
          enrolled_at: new Date().toISOString(),
          completed_at: null,
          module_title: previewData.module.title,
          last_lesson_id: null,
        });

        const orderedLessons = [...(previewData.lessons ?? [])]
          .sort((a, b) => a.sequence_no - b.sequence_no)
          .map((lesson) => ({
            ...lesson,
            completed: Boolean(lesson.completed),
          }));
        setLessons(orderedLessons);
        setQuizzes([...(previewData.quizzes ?? [])]);
        setResults([]);
        setCompletionPercent(0);

        const nextTopicsByLessonId: Record<number, TopicSummary[]> = {};
        (previewData.topics ?? []).forEach((topic) => {
          if (!nextTopicsByLessonId[topic.lesson_id]) nextTopicsByLessonId[topic.lesson_id] = [];
          nextTopicsByLessonId[topic.lesson_id].push(topic);
        });
        Object.keys(nextTopicsByLessonId).forEach((lessonId) => {
          nextTopicsByLessonId[Number(lessonId)].sort((a, b) => (a.sort_order - b.sort_order) || (a.id - b.id));
        });

        const nextLessonContentByLessonId: Record<number, LessonContentBlock[]> = {};
        const nextContentByTopicId: Record<number, LessonContentBlock[]> = {};
        (previewData.content ?? []).forEach((block) => {
          if (block.topic_id === null) {
            if (!nextLessonContentByLessonId[block.lesson_id]) nextLessonContentByLessonId[block.lesson_id] = [];
            nextLessonContentByLessonId[block.lesson_id].push(block);
            return;
          }
          if (!nextContentByTopicId[block.topic_id]) nextContentByTopicId[block.topic_id] = [];
          nextContentByTopicId[block.topic_id].push(block);
        });
        Object.keys(nextLessonContentByLessonId).forEach((lessonId) => {
          nextLessonContentByLessonId[Number(lessonId)].sort((a, b) => (a.sort_order - b.sort_order) || (a.id - b.id));
        });
        Object.keys(nextContentByTopicId).forEach((topicId) => {
          nextContentByTopicId[Number(topicId)].sort((a, b) => (a.sort_order - b.sort_order) || (a.id - b.id));
        });
        setTopicsByLessonId(nextTopicsByLessonId);
        setLessonContentByLessonId(nextLessonContentByLessonId);
        setContentByTopicId(nextContentByTopicId);
        setQuizPreviewByQuizId(buildPreviewQuestionsByQuizId(previewData.questions ?? [], previewData.answers ?? []));

        const quizzesByModule = [...(previewData.quizzes ?? [])];
        const defaultLessonId =
          orderedLessons.find((lesson) => !lesson.completed || lessonResetRequiredByLessonId[lesson.id])?.id ??
          orderedLessons[0]?.id ??
          null;
        const hasSelectedLesson = selectedLessonId !== null && orderedLessons.some((lesson) => lesson.id === selectedLessonId);
        const hasSelectedAssessment =
          selectedAssessmentId !== null && quizzesByModule.some((quiz) => quiz.id === selectedAssessmentId);
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
        let nextLessonId: number | null = hasSelectedLesson ? selectedLessonId : null;
        let nextAssessmentId: number | null = null;

        if (hasSelectedAssessment) {
          nextAssessmentId = selectedAssessmentId;
          const selectedQuiz = quizzesByModule.find((quiz) => quiz.id === selectedAssessmentId) ?? null;
          const selectedQuizLessonId =
            selectedQuiz?.lesson_id !== null && selectedQuiz?.lesson_id !== undefined ? Number(selectedQuiz.lesson_id) : null;
          if (selectedQuizLessonId !== null && orderedLessons.some((lesson) => lesson.id === selectedQuizLessonId)) {
            nextLessonId = selectedQuizLessonId;
          }
        } else if (nextLessonId === null) {
          if (defaultPreTest) {
            nextAssessmentId = defaultPreTest.id;
            const defaultPreTestLessonId =
              defaultPreTest.lesson_id !== null && defaultPreTest.lesson_id !== undefined
                ? Number(defaultPreTest.lesson_id)
                : null;
            nextLessonId =
              defaultPreTestLessonId !== null && orderedLessons.some((lesson) => lesson.id === defaultPreTestLessonId)
                ? defaultPreTestLessonId
                : defaultLessonId;
          } else {
            nextLessonId = defaultLessonId;
          }
        }

        const focusedLessonId = (() => {
          if (nextAssessmentId !== null) {
            const focusedQuiz = quizzesByModule.find((quiz) => quiz.id === nextAssessmentId) ?? null;
            if (focusedQuiz?.lesson_id !== null && focusedQuiz?.lesson_id !== undefined) {
              return Number(focusedQuiz.lesson_id);
            }
          }
          return nextLessonId;
        })();

        setSelectedLessonId(nextLessonId);
        setSelectedAssessmentId(nextAssessmentId);
        setExpandedLessonIds(() => {
          if (focusedLessonId === null) return {};
          if (!orderedLessons.some((lesson) => lesson.id === focusedLessonId)) return {};
          return { [focusedLessonId]: true };
        });
        return;
      }

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

      const defaultLessonId =
        orderedLessons.find((lesson) => !lesson.completed || lessonResetRequiredByLessonId[lesson.id])?.id ??
        orderedLessons[0]?.id ??
        null;
      const hasSelectedLesson = selectedLessonId !== null && orderedLessons.some((lesson) => lesson.id === selectedLessonId);
      const hasSelectedAssessment =
        selectedAssessmentId !== null && quizzesByModule.some((quiz) => quiz.id === selectedAssessmentId);
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
      let nextLessonId: number | null = hasSelectedLesson ? selectedLessonId : null;
      let nextAssessmentId: number | null = null;

      if (hasSelectedAssessment) {
        nextAssessmentId = selectedAssessmentId;
        const selectedQuiz = quizzesByModule.find((quiz) => quiz.id === selectedAssessmentId) ?? null;
        const selectedQuizLessonId =
          selectedQuiz?.lesson_id !== null && selectedQuiz?.lesson_id !== undefined ? Number(selectedQuiz.lesson_id) : null;
        if (selectedQuizLessonId !== null && orderedLessons.some((lesson) => lesson.id === selectedQuizLessonId)) {
          nextLessonId = selectedQuizLessonId;
        }
      } else if (nextLessonId === null) {
        if (defaultPreTest) {
          nextAssessmentId = defaultPreTest.id;
          const defaultPreTestLessonId =
            defaultPreTest.lesson_id !== null && defaultPreTest.lesson_id !== undefined
              ? Number(defaultPreTest.lesson_id)
              : null;
          nextLessonId =
            defaultPreTestLessonId !== null && orderedLessons.some((lesson) => lesson.id === defaultPreTestLessonId)
              ? defaultPreTestLessonId
              : defaultLessonId;
        } else {
          nextLessonId = defaultLessonId;
        }
      }

      const focusedLessonId = (() => {
        if (nextAssessmentId !== null) {
          const focusedQuiz = quizzesByModule.find((quiz) => quiz.id === nextAssessmentId) ?? null;
          if (focusedQuiz?.lesson_id !== null && focusedQuiz?.lesson_id !== undefined) {
            return Number(focusedQuiz.lesson_id);
          }
        }
        return nextLessonId;
      })();

      setSelectedLessonId(nextLessonId);
      setSelectedAssessmentId(nextAssessmentId);
      setExpandedLessonIds(() => {
        if (focusedLessonId === null) return {};
        if (!orderedLessons.some((lesson) => lesson.id === focusedLessonId)) return {};
        return { [focusedLessonId]: true };
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load module viewer.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, [moduleIdNumber, isPreviewMode, previewData]);

  useEffect(() => {
    if (!terminalLogBoxRef.current) return;
    terminalLogBoxRef.current.scrollTop = terminalLogBoxRef.current.scrollHeight;
  }, [quizTerminalLogs]);

  const lessonById = useMemo(() => {
    const map = new Map<number, LessonSummary>();
    lessons.forEach((lesson) => map.set(lesson.id, lesson));
    return map;
  }, [lessons]);

  const selectedLesson = lessons.find((lesson) => lesson.id === selectedLessonId) ?? null;
  const topicsForSelectedLesson = selectedLesson ? topicsByLessonId[selectedLesson.id] ?? [] : [];
  const selectedLessonContent = selectedLesson ? lessonContentByLessonId[selectedLesson.id] ?? [] : [];
  const selectedLessonTopicGroups = topicsForSelectedLesson.map((topic) => ({
    topic,
    sections: contentByTopicId[topic.id] ?? [],
  }));

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

  const failedPostTestCyclesByLessonId = useMemo(() => {
    const failedCyclesByLessonId: Record<number, number> = {};

    postTestByLessonId.forEach((postTest, lessonId) => {
      const attemptLimit = Math.max(postTest.attempt_limit, 1);
      const attempts = results
        .filter((result) => result.quiz_id === postTest.id)
        .sort((a, b) => {
          const attemptOrder = a.attempt_no - b.attempt_no;
          if (attemptOrder !== 0) return attemptOrder;
          return new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime();
        });

      let failedCycles = 0;
      while (true) {
        const cycleStart = failedCycles * attemptLimit;
        const cycleAttempts = attempts.slice(cycleStart, cycleStart + attemptLimit);
        if (cycleAttempts.length < attemptLimit) break;
        if (!cycleAttempts.every((attempt) => !attempt.passed)) break;
        failedCycles += 1;
      }

      if (failedCycles > 0) {
        failedCyclesByLessonId[lessonId] = failedCycles;
      }
    });

    return failedCyclesByLessonId;
  }, [postTestByLessonId, results]);

  const postTestAttemptsUsedInCurrentCycleByLessonId = useMemo(() => {
    const attemptsUsedByLessonId: Record<number, number> = {};
    postTestByLessonId.forEach((postTest, lessonId) => {
      const attemptLimit = Math.max(postTest.attempt_limit, 1);
      const attempts = results
        .filter((result) => result.quiz_id === postTest.id)
        .sort((a, b) => {
          const attemptOrder = a.attempt_no - b.attempt_no;
          if (attemptOrder !== 0) return attemptOrder;
          return new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime();
        });
      const failedCycles = failedPostTestCyclesByLessonId[lessonId] ?? 0;
      const cycleStart = failedCycles * attemptLimit;
      attemptsUsedByLessonId[lessonId] = attempts.slice(cycleStart).length;
    });
    return attemptsUsedByLessonId;
  }, [failedPostTestCyclesByLessonId, postTestByLessonId, results]);

  const postTestPassedInCurrentCycleByLessonId = useMemo(() => {
    const passedInCurrentCycleByLessonId: Record<number, boolean> = {};
    postTestByLessonId.forEach((postTest, lessonId) => {
      const attemptLimit = Math.max(postTest.attempt_limit, 1);
      const attempts = results
        .filter((result) => result.quiz_id === postTest.id)
        .sort((a, b) => {
          const attemptOrder = a.attempt_no - b.attempt_no;
          if (attemptOrder !== 0) return attemptOrder;
          return new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime();
        });
      const failedCycles = failedPostTestCyclesByLessonId[lessonId] ?? 0;
      const cycleStart = failedCycles * attemptLimit;
      passedInCurrentCycleByLessonId[lessonId] = attempts.slice(cycleStart).some((attempt) => attempt.passed);
    });
    return passedInCurrentCycleByLessonId;
  }, [failedPostTestCyclesByLessonId, postTestByLessonId, results]);

  const effectiveLessonCompletedById = useMemo(() => {
    const map = new Map<number, boolean>();
    lessons.forEach((lesson) => {
      map.set(lesson.id, lesson.completed && !lessonResetRequiredByLessonId[lesson.id]);
    });
    return map;
  }, [lessons, lessonResetRequiredByLessonId]);

  const allLessonsCompleted = lessons.length > 0 && lessons.every((lesson) => effectiveLessonCompletedById.get(lesson.id));

  const lessonReadyForProgressionById = useMemo(() => {
    const readiness = new Map<number, boolean>();
    lessons.forEach((lesson) => {
      const postTest = postTestByLessonId.get(lesson.id) ?? null;
      const postTestRequirementMet = !postTest || !postTest.is_active || Boolean(postTestPassedInCurrentCycleByLessonId[lesson.id]);
      readiness.set(lesson.id, Boolean(effectiveLessonCompletedById.get(lesson.id)) && postTestRequirementMet);
    });
    return readiness;
  }, [effectiveLessonCompletedById, lessons, postTestByLessonId, postTestPassedInCurrentCycleByLessonId]);

  const unlockedLessonIds = useMemo(() => {
    if (isPreviewBypassMode) {
      return new Set(lessons.map((lesson) => lesson.id));
    }

    const unlocked = new Set<number>();
    lessons.forEach((lesson, index) => {
      if (index === 0) {
        unlocked.add(lesson.id);
        return;
      }
      const previousLesson = lessons[index - 1];
      if (previousLesson && lessonReadyForProgressionById.get(previousLesson.id)) {
        unlocked.add(lesson.id);
      }
    });
    return unlocked;
  }, [isPreviewBypassMode, lessons, lessonReadyForProgressionById]);

  const allActivePostTestsPassed = activePostTests.every((quiz) => {
    if (quiz.lesson_id === null) return false;
    return Boolean(postTestPassedInCurrentCycleByLessonId[Number(quiz.lesson_id)]);
  });
  const moduleProgressPercent = useMemo(() => {
    const lessonUnitCount = lessons.length;
    const includePreTest = Boolean(primaryPreTest?.is_active);
    const includeFinalExam = Boolean(finalExam?.is_active);
    const assessmentUnitCount = (includePreTest ? 1 : 0) + (includeFinalExam ? 1 : 0);
    const totalUnits = lessonUnitCount + assessmentUnitCount;

    if (totalUnits === 0) {
      return Math.max(0, Math.min(100, Math.round(completionPercent)));
    }

    const lessonUnitProgressSum = lessons.reduce((sum, lesson) => {
      const lessonCompleted = Boolean(effectiveLessonCompletedById.get(lesson.id));
      const lessonContentProgressPercent = lessonCompleted
        ? 100
        : Math.max(0, Math.min(100, Math.round(readProgressByLessonId[lesson.id] ?? 0)));
      const lessonPostTest = postTestByLessonId.get(lesson.id) ?? null;
      const lessonHasActivePostTest = Boolean(lessonPostTest?.is_active);
      const lessonPostTestSharePercent = lessonHasActivePostTest ? 20 : 0;
      const lessonContentSharePercent = 100 - lessonPostTestSharePercent;
      const lessonPostTestRequirementMet =
        !lessonPostTest || !lessonPostTest.is_active || Boolean(postTestPassedInCurrentCycleByLessonId[lesson.id]);
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

    const preTestUnitProgress =
      includePreTest && primaryPreTest
        ? latestResultByQuizId.get(primaryPreTest.id)?.passed
          ? 1
          : 0
        : 0;
    const finalExamUnitProgress =
      includeFinalExam && finalExam
        ? latestResultByQuizId.get(finalExam.id)?.passed
          ? 1
          : 0
        : 0;

    const overallProgress = (lessonUnitProgressSum + preTestUnitProgress + finalExamUnitProgress) / totalUnits;
    return Math.max(0, Math.min(100, Math.round(overallProgress * 100)));
  }, [
    completionPercent,
    effectiveLessonCompletedById,
    finalExam,
    lessons,
    latestResultByQuizId,
    postTestByLessonId,
    postTestPassedInCurrentCycleByLessonId,
    primaryPreTest,
    readProgressByLessonId,
  ]);
  const finalExamReady = Boolean(finalExam) && allLessonsCompleted && allActivePostTestsPassed;

  const getAssessmentStage = (quiz: QuizSummary): AssessmentStage => {
    if (quiz.quiz_type === 'final_exam' || quiz.stage === 'final_exam') return 'final';
    return quiz.stage === 'pre_test' ? 'pre' : 'post';
  };

  const isAssessmentUnlocked = (quiz: QuizSummary) => {
    if (isPreviewBypassMode) return true;
    if (!quiz.is_active) return false;
    const stage = getAssessmentStage(quiz);

    if (stage === 'pre') return true;

    if (stage === 'post') {
      if (quiz.lesson_id === null) return false;
      const lesson = lessonById.get(Number(quiz.lesson_id));
      if (!lesson) return false;
      const lessonCompleted = Boolean(effectiveLessonCompletedById.get(lesson.id));
      const lessonUnlocked = unlockedLessonIds.has(lesson.id) || lessonCompleted;
      return lessonUnlocked && lessonCompleted;
    }

    return finalExamReady;
  };

  const assessmentUnlockMessage = (quiz: QuizSummary) => {
    if (isPreviewBypassMode) return 'Preview mode: lock bypass enabled.';
    const stage = getAssessmentStage(quiz);
    if (!quiz.is_active) return 'Assessment is inactive.';

    if (stage === 'pre') {
      return 'Pre-Test is available before lessons.';
    }

    if (stage === 'post') {
      const lesson = quiz.lesson_id !== null ? lessonById.get(Number(quiz.lesson_id)) : null;
      if (!lesson) return 'Lesson mapping not found.';
      if (lessonResetRequiredByLessonId[lesson.id]) {
        return 'Review all lesson content again to unlock this Post-Test.';
      }
      if (!effectiveLessonCompletedById.get(lesson.id)) return 'Complete the lesson first to unlock this Post-Test.';
      return 'Ready to start.';
    }

    if (!allLessonsCompleted) return 'Complete all lessons first.';
    if (!allActivePostTestsPassed) return 'Pass all active lesson Post-Tests first.';
    return 'Ready to start.';
  };

  const selectedAssessment = selectedAssessmentId
    ? quizzes.find((quiz) => quiz.id === selectedAssessmentId) ?? null
    : null;
  const selectedAssessmentStage = selectedAssessment ? getAssessmentStage(selectedAssessment) : null;
  const selectedAssessmentLessonId =
    selectedAssessment?.lesson_id !== null && selectedAssessment?.lesson_id !== undefined
      ? Number(selectedAssessment.lesson_id)
      : null;

  const isQuizOngoing = quizInProgressId !== null && quizSessionResult === null;
  const selectedAssessmentAttemptCount = selectedAssessment
    ? (() => {
        const totalAttempts = results.filter((result) => result.quiz_id === selectedAssessment.id).length;
        if (selectedAssessmentStage !== 'post' || selectedAssessmentLessonId === null) {
          return totalAttempts;
        }
        return postTestAttemptsUsedInCurrentCycleByLessonId[selectedAssessmentLessonId] ?? totalAttempts;
      })()
    : 0;
  const selectedAssessmentAttemptsRemaining = selectedAssessment
    ? Math.max(selectedAssessment.attempt_limit - selectedAssessmentAttemptCount, 0)
    : 0;
  const isSelectedAssessmentOngoing = selectedAssessment
    ? isQuizOngoing && quizInProgressId === selectedAssessment.id
    : false;

  const currentQuizQuestion = isSelectedAssessmentOngoing ? quizQuestions[quizCurrentIndex] ?? null : null;
  const currentQuizAnswerIds = currentQuizQuestion ? quizAnswers[currentQuizQuestion.id] ?? [] : [];
  const isCurrentQuestionMultipleChoice = currentQuizQuestion?.question_type === 'multiple_choice';
  const currentQuizMaxSelections =
    currentQuizQuestion && isCurrentQuestionMultipleChoice
      ? Math.max(1, Number(currentQuizQuestion.max_selections) || 1)
      : 1;
  const hasCurrentQuizAnswer = currentQuizAnswerIds.length > 0;
  const isCurrentQuestionSubmitted = currentQuizQuestion
    ? Boolean(quizSubmittedByQuestionId[currentQuizQuestion.id])
    : false;
  const submittedQuestionsCount = Object.keys(quizSubmittedByQuestionId).length;
  const selectedAssessmentSessionResult =
    selectedAssessment && quizSessionResult?.quiz_id === selectedAssessment.id ? quizSessionResult : null;
  const selectedAssessmentLatestResult =
    selectedAssessmentSessionResult ??
    (selectedAssessment ? (latestResultByQuizId.get(selectedAssessment.id) ?? null) : null);
  const isSimulationAssessment = selectedAssessmentStage === 'final';
  const selectedAssessmentDisplayResult =
    selectedAssessmentSessionResult ??
    (!isSimulationAssessment && selectedAssessmentAttemptsRemaining <= 0 ? selectedAssessmentLatestResult : null);

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
      const lessonUnlocked = unlockedLessonIds.has(lesson.id) || Boolean(effectiveLessonCompletedById.get(lesson.id));

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
    effectiveLessonCompletedById,
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
      if (isPreviewMode) {
        setLessons((previous) =>
          previous.map((lesson) =>
            lesson.id === lessonIdValue
              ? { ...lesson, completed: true, completedAt: new Date().toISOString() }
              : lesson
          )
        );
        setReadProgressByLessonId((previous) => ({ ...previous, [lessonIdValue]: 100 }));
        setPostTestRecoveredCycleByLessonId((previous) => ({
          ...previous,
          [lessonIdValue]: failedPostTestCyclesByLessonId[lessonIdValue] ?? 0,
        }));
        setLessonResetRequiredByLessonId((previous) => {
          if (!previous[lessonIdValue]) return previous;
          const next = { ...previous };
          delete next[lessonIdValue];
          return next;
        });
        return;
      }

      await completeLesson(enrollment.id, lessonIdValue);
      setReadProgressByLessonId((previous) => ({ ...previous, [lessonIdValue]: 100 }));
      setPostTestRecoveredCycleByLessonId((previous) => ({
        ...previous,
        [lessonIdValue]: failedPostTestCyclesByLessonId[lessonIdValue] ?? 0,
      }));
      setLessonResetRequiredByLessonId((previous) => {
        if (!previous[lessonIdValue]) return previous;
        const next = { ...previous };
        delete next[lessonIdValue];
        return next;
      });
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

  useEffect(() => {
    const lessonsToReset = lessons
      .map((lesson) => lesson.id)
      .filter((lessonId) => {
        const failedCycles = failedPostTestCyclesByLessonId[lessonId] ?? 0;
        const recoveredCycles = postTestRecoveredCycleByLessonId[lessonId] ?? 0;
        return failedCycles > recoveredCycles && !lessonResetRequiredByLessonId[lessonId];
      });

    if (lessonsToReset.length === 0) return;

    setLessonResetRequiredByLessonId((previous) => {
      const next = { ...previous };
      lessonsToReset.forEach((lessonId) => {
        next[lessonId] = true;
      });
      return next;
    });

    setReadProgressByLessonId((previous) => {
      const next = { ...previous };
      lessonsToReset.forEach((lessonId) => {
        next[lessonId] = 0;
      });
      return next;
    });

    setViewedStepKeysByLessonId((previous) => {
      const next = { ...previous };
      lessonsToReset.forEach((lessonId) => {
        next[lessonId] = {};
      });
      return next;
    });

    setActiveLessonStepIndexByLessonId((previous) => {
      const next = { ...previous };
      lessonsToReset.forEach((lessonId) => {
        next[lessonId] = 0;
      });
      return next;
    });

    const focusedResetLessonId =
      selectedAssessmentLessonId !== null && lessonsToReset.includes(selectedAssessmentLessonId)
        ? selectedAssessmentLessonId
        : selectedLessonId !== null && lessonsToReset.includes(selectedLessonId)
          ? selectedLessonId
          : lessonsToReset[0] ?? null;

    if (focusedResetLessonId !== null) {
      setSelectedAssessmentId(null);
      setSelectedLessonId(focusedResetLessonId);
      setExpandedLessonIds({ [focusedResetLessonId]: true });
      resetQuizSession();
    }

    setError('Post-Test failed 3 times. Lesson progress reset to 0%. Review all lesson content to unlock another 3 attempts.');
  }, [
    failedPostTestCyclesByLessonId,
    lessonResetRequiredByLessonId,
    lessons,
    postTestRecoveredCycleByLessonId,
    selectedAssessmentLessonId,
    selectedLessonId,
  ]);

  const handleStartQuiz = async (quiz: QuizSummary) => {
    if (!enrollment) return;
    setIsQuizLoading(true);
    setError('');
    setIsResultProcessing(false);
    setQuizSessionResult(null);
    try {
      if (isPreviewMode) {
        const previewQuestions = (quizPreviewByQuizId[quiz.id] ?? []).map((question) => ({
          ...question,
          answers: question.answers.map((answer) => ({ ...answer })),
        }));
        setQuizQuestions(previewQuestions);
        setQuizAnswers({});
        setQuizSubmittedByQuestionId({});
        setQuizCurrentIndex(0);
        setQuizInProgressId(quiz.id);
        setIsSubmitConfirmOpen(false);
        setQuizTerminalLogs([
          `> [boot] Preview assessment session initialized`,
          `> [auth] Admin preview mode (no user progress recording)`,
          `> [quiz] ${quiz.title}`,
          `> [load] ${previewQuestions.length} questions prepared`,
          `> [mode] Sequential lock enabled (submit to continue)`,
          `> [ready] Question 1 awaiting answer`,
        ]);
        return;
      }

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
    if (!hasCurrentQuizAnswer) {
      setError('Please select an answer before submitting this question.');
      return;
    }
    const selectedAnswerTexts = currentQuizQuestion.answers
      .filter((answer) => currentQuizAnswerIds.includes(answer.id))
      .map((answer) => answer.answer_text);
    const selectedAnswerText =
      selectedAnswerTexts.length > 0
        ? selectedAnswerTexts.join(' | ')
        : `Answer ${currentQuizAnswerIds[0] ?? ''}`;
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
      if (isPreviewMode) {
        const totalPoints = quizQuestions.reduce((sum, question) => sum + Number(question.points || 0), 0);
        let earnedPoints = 0;

        quizQuestions.forEach((question) => {
          const selected = Array.from(new Set((quizAnswers[question.id] ?? []).map((answerId) => Number(answerId))))
            .filter((answerId) => Number.isFinite(answerId));
          if (selected.length === 0) return;

          const answerMap = new Map(question.answers.map((answer) => [Number(answer.id), answer]));
          const selectedValid = selected.filter((answerId) => answerMap.has(answerId));
          if (selectedValid.length === 0) return;

          const correctSet = new Set(
            question.answers.filter((answer) => Boolean(answer.is_correct)).map((answer) => Number(answer.id))
          );
          const effectiveType =
            question.question_type === 'multiple_choice' || correctSet.size > 1 ? 'multiple_choice' : 'single_choice';
          const maxSelections = effectiveType === 'multiple_choice' ? Math.max(1, Number(question.max_selections) || 1) : 1;
          if (selectedValid.length > Math.max(maxSelections, correctSet.size)) return;

          if (effectiveType === 'multiple_choice') {
            const selectedSet = new Set(selectedValid);
            const exactMatch =
              selectedSet.size === correctSet.size &&
              [...correctSet].every((correctId) => selectedSet.has(correctId));
            if (exactMatch) earnedPoints += Number(question.points || 0);
            return;
          }

          if (correctSet.has(selectedValid[0])) {
            earnedPoints += Number(question.points || 0);
          }
        });

        const score = totalPoints <= 0 ? 0 : Number(((earnedPoints / totalPoints) * 100).toFixed(2));
        const passed = score >= Number(selectedAssessment.passing_score || 0);
        const attemptNo = results.filter((result) => result.quiz_id === selectedAssessment.id).length + 1;
        const previewResult: QuizResult = {
          id: Date.now(),
          enrollment_id: enrollment.id,
          user_id: 0,
          quiz_id: selectedAssessment.id,
          attempt_no: attemptNo,
          score,
          passed,
          submitted_at: new Date().toISOString(),
          feedback: {
            earnedPoints,
            totalPoints,
          },
          quiz_title: selectedAssessment.title,
          module_title: moduleTitle,
        };

        await wait(260);
        appendTerminalLog('[verify] Cross-checking responses...');
        await wait(220);
        appendTerminalLog(`[result] Score ${Number(previewResult.score).toFixed(0)}%`);
        appendTerminalLog(`[result] Status ${previewResult.passed ? 'PASSED' : 'FAILED'} | Attempt #${previewResult.attempt_no}`);
        appendTerminalLog('[preview] Results stored locally for testing only.');
        setQuizSessionResult(previewResult);
        setQuizInProgressId(null);
        setIsSubmitConfirmOpen(false);
        setResults((previous) => [previewResult, ...previous]);
        return;
      }

      const payload = await submitQuiz(
        enrollment.id,
        selectedAssessment.id,
        Object.entries(quizAnswers).flatMap(([questionId, answerIds]) =>
          (answerIds ?? []).map((answerId) => ({
            questionId: Number(questionId),
            answerId,
          }))
        )
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
    const lessonUnlocked = unlockedLessonIds.has(lesson.id) || Boolean(effectiveLessonCompletedById.get(lesson.id));
    if (!lessonUnlocked || isQuizOngoing) return;
    setActiveLessonStepIndexByLessonId((previous) => ({ ...previous, [lesson.id]: 0 }));
    setSelectedLessonId(lesson.id);
    setSelectedAssessmentId(null);
    setExpandedLessonIds({ [lesson.id]: true });
    setError('');
    resetQuizSession();
  };

  const handleToggleQuizAnswer = (answerId: number) => {
    if (!currentQuizQuestion || isCurrentQuestionSubmitted) return;
    setError('');

    if (isCurrentQuestionMultipleChoice) {
      const isAlreadySelected = currentQuizAnswerIds.includes(answerId);
      if (!isAlreadySelected && currentQuizAnswerIds.length >= currentQuizMaxSelections) {
        setError(`You can select up to ${currentQuizMaxSelections} answers for this question.`);
        return;
      }

      setQuizAnswers((previous) => {
        const currentAnswers = previous[currentQuizQuestion.id] ?? [];
        const hasAnswer = currentAnswers.includes(answerId);
        return {
          ...previous,
          [currentQuizQuestion.id]: hasAnswer
            ? currentAnswers.filter((id) => id !== answerId)
            : [...currentAnswers, answerId],
        };
      });
      return;
    }

    setQuizAnswers((previous) => ({
      ...previous,
      [currentQuizQuestion.id]: [answerId],
    }));
  };

  const handleLessonDropdownToggle = (lesson: LessonSummary) => {
    const lessonUnlocked = unlockedLessonIds.has(lesson.id) || Boolean(effectiveLessonCompletedById.get(lesson.id));
    if (!lessonUnlocked || isQuizOngoing) return;
    setExpandedLessonIds((previous) => (previous[lesson.id] ? {} : { [lesson.id]: true }));
  };

  const selectLessonTopic = (lesson: LessonSummary, topic: TopicSummary) => {
    const lessonUnlocked = unlockedLessonIds.has(lesson.id) || Boolean(effectiveLessonCompletedById.get(lesson.id));
    if (!lessonUnlocked || isQuizOngoing) return;

    const orderedTopics = topicsByLessonId[lesson.id] ?? [];
    const topicIndex = orderedTopics.findIndex((item) => item.id === topic.id);
    const nextStepIndex = topicIndex >= 0 ? topicIndex + 1 : 0;

    setActiveLessonStepIndexByLessonId((previous) => ({
      ...previous,
      [lesson.id]: nextStepIndex,
    }));
    setSelectedLessonId(lesson.id);
    setSelectedAssessmentId(null);
    setExpandedLessonIds({ [lesson.id]: true });
    setError('');
    resetQuizSession();
  };

  const selectAssessment = (quiz: QuizSummary) => {
    const unlocked = isAssessmentUnlocked(quiz);
    if (!unlocked && !(isQuizOngoing && quiz.id === quizInProgressId)) return;
    if (isQuizOngoing && quiz.id !== quizInProgressId) return;

    if (quiz.lesson_id !== null) {
      const lessonId = Number(quiz.lesson_id);
      setSelectedLessonId(lessonId);
      setExpandedLessonIds({ [lessonId]: true });
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
  const selectedLessonDisplayMediaUrlsFromOverview = parseLessonOverviewMediaUrls(selectedLesson?.overview_image_url);
  const selectedLessonDisplayMediaUrls =
    selectedLessonDisplayMediaUrlsFromOverview.length > 0
      ? selectedLessonDisplayMediaUrlsFromOverview
      : (() => {
          const fallbackMedia = normalizeUrlCandidate(selectedLessonFallbackContent?.content_url);
          return fallbackMedia ? [fallbackMedia] : [];
        })();

  const selectedLessonSteps = useMemo<LessonViewStep[]>(() => {
    if (!selectedLesson) return [];

    const steps: LessonViewStep[] = [
      {
        key: `lesson-${selectedLesson.id}-overview`,
        kind: 'overview',
        title: selectedLesson.title,
        html: selectedLessonDisplayHtml,
        mediaUrls: selectedLessonDisplayMediaUrls,
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
    selectedLessonDisplayMediaUrls,
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
  const isSelectedLessonCompleted = selectedLesson ? Boolean(effectiveLessonCompletedById.get(selectedLesson.id)) : false;
  const selectedLessonViewedStepKeys = selectedLesson ? viewedStepKeysByLessonId[selectedLesson.id] ?? {} : {};
  const selectedLessonViewedStepCount = selectedLesson
    ? isSelectedLessonCompleted
      ? selectedLessonSteps.length
      : selectedLessonSteps.reduce((count, step) => count + (selectedLessonViewedStepKeys[step.key] ? 1 : 0), 0)
    : 0;
  const isCurrentLessonStepViewed = selectedLessonStep
    ? Boolean(isSelectedLessonCompleted || selectedLessonViewedStepKeys[selectedLessonStep.key])
    : false;
  const selectedLessonCanAdvance = Boolean(isSelectedLessonCompleted || isCurrentLessonStepViewed);
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
  const richTextContentClassName =
    'max-w-none space-y-3 text-sm leading-relaxed text-slate-200 [overflow-wrap:anywhere] [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-white [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-white [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-white [&_li]:ml-5 [&_li]:list-disc [&_ol>li]:list-decimal [&_p]:text-slate-200 [&_img]:h-auto [&_img]:max-w-full';

  const updateSelectedLessonReadProgress = () => {
    if (!selectedLesson || selectedAssessment || !selectedLessonStep) return;
    const container = contentScrollContainerRef.current;
    if (!container) return;

    const maxScrollable = container.scrollHeight - container.clientHeight;
    const rawStepPercent = maxScrollable <= 2 ? 100 : Math.round((container.scrollTop / maxScrollable) * 100);
    const nextStepPercent = Math.max(0, Math.min(100, rawStepPercent));

    const totalSteps = selectedLessonSteps.length || 1;
    const isStepAlreadyViewed = isSelectedLessonCompleted || Boolean(selectedLessonViewedStepKeys[selectedLessonStep.key]);
    const viewedCountBefore = isSelectedLessonCompleted ? totalSteps : selectedLessonViewedStepCount;
    const viewedCountAfter =
      isStepAlreadyViewed || nextStepPercent < 99 ? viewedCountBefore : viewedCountBefore + 1;

    const aggregateProgress = isSelectedLessonCompleted
      ? 100
      : isStepAlreadyViewed
        ? Math.round((viewedCountBefore / totalSteps) * 100)
        : Math.round(((viewedCountBefore + nextStepPercent / 100) / totalSteps) * 100);
    const nextProgress = Math.max(0, Math.min(100, aggregateProgress));

    setReadProgressByLessonId((previous) => {
      const current = previous[selectedLesson.id] ?? 0;
      if (isSelectedLessonCompleted) {
        if (current === 100) return previous;
        return { ...previous, [selectedLesson.id]: 100 };
      }
      if (nextProgress <= current) return previous;
      return { ...previous, [selectedLesson.id]: nextProgress };
    });

    if (!isSelectedLessonCompleted && nextStepPercent >= 99) {
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
      !isSelectedLessonCompleted &&
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
    isSelectedLessonCompleted,
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
    <section className={isPreviewMode ? 'h-full' : 'space-y-4'}>
      {error ? <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
      {isLoading ? <p className="text-sm text-slate-400">Loading module content...</p> : null}

      {!isLoading ? (
        <div
          className={`grid gap-5 ${isPreviewMode ? 'h-full' : 'xl:h-[calc(100vh-7.5rem)]'} ${
            isSidebarCollapsed ? 'grid-cols-1' : 'xl:grid-cols-[536px_minmax(0,1fr)]'
          }`}
        >
          {!isSidebarCollapsed ? (
            <aside
              className={`no-scrollbar rounded-xl border border-white/10 bg-slate-900/70 p-5 shadow-sm ${
                isPreviewMode ? 'h-full overflow-y-auto' : 'xl:sticky xl:top-20 xl:h-[calc(100vh-7.5rem)] xl:overflow-y-auto'
              }`}
            >
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              {isPreviewMode ? (
                <span className="inline-flex items-center gap-1 text-sm font-medium text-slate-300">
                  <ChevronLeft size={14} />
                  Modules
                </span>
              ) : (
                <Link
                  to="/user/modules"
                  className="inline-flex items-center gap-1 text-sm font-medium text-slate-300 hover:text-white"
                >
                  <ChevronLeft size={14} />
                  Modules
                </Link>
              )}
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                Module {moduleIdNumber || '--'}
              </p>
              <div className="mt-2 flex items-end justify-between gap-3">
                <p className="truncate text-[24px] font-semibold leading-tight tracking-tight text-white">
                  {moduleTitle || 'Untitled Module'}
                </p>
                <div className="text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Progress</p>
                  <p className="text-[22px] font-semibold leading-none text-brand-300">{moduleProgressPercent}%</p>
                </div>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800/70">
                <div
                  className="h-full rounded-full bg-brand-500"
                  style={{ width: `${Math.max(0, Math.min(100, moduleProgressPercent))}%` }}
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
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-violet-200">Pre-Test</p>
                        <p className="mt-0.5 truncate text-[15px] font-semibold text-white">{primaryPreTest.title}</p>
                      </div>
                    </button>
                  </div>
                ) : null}

                {lessons.map((lesson, lessonIndex) => {
                  const lessonCompleted = Boolean(effectiveLessonCompletedById.get(lesson.id));
                  const lessonUnlocked = unlockedLessonIds.has(lesson.id) || lessonCompleted;
                  const lessonPostTest = postTestByLessonId.get(lesson.id) ?? null;
                  const lessonHasActivePostTest = Boolean(lessonPostTest?.is_active);
                  const lessonPostTestRequirementMet =
                    !lessonPostTest || !lessonPostTest.is_active || Boolean(postTestPassedInCurrentCycleByLessonId[lesson.id]);
                  const lessonReadyForProgression = lessonReadyForProgressionById.get(lesson.id) ?? false;
                  const lessonTopics = topicsByLessonId[lesson.id] ?? [];
                  const lessonViewedStepKeys = viewedStepKeysByLessonId[lesson.id] ?? {};
                  const isExpanded = Boolean(expandedLessonIds[lesson.id]);
                  const lessonContentProgressPercent = lessonCompleted
                    ? 100
                    : Math.max(0, Math.min(100, Math.round(readProgressByLessonId[lesson.id] ?? 0)));
                  const lessonPostTestSharePercent = lessonHasActivePostTest ? 20 : 0;
                  const lessonContentSharePercent = 100 - lessonPostTestSharePercent;
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
                  const progressRadius = 15;
                  const progressCircumference = 2 * Math.PI * progressRadius;
                  const progressOffset = progressCircumference * (1 - lessonProgressPercent / 100);

                  const isLastTopLevel = lessonIndex === lessons.length - 1 && !finalExam;

                  return (
                    <div key={lesson.id} className="relative pl-8">
                      {!isLastTopLevel ? (
                        <span className="absolute left-[13px] top-7 h-[calc(100%-0.25rem)] w-px bg-white/10" aria-hidden="true" />
                      ) : null}
                      <span
                        className={`absolute left-0.5 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full border ${
                          lessonReadyForProgression
                            ? 'border-emerald-300/50 bg-emerald-500/20 text-emerald-100'
                            : lessonUnlocked
                              ? 'border-sky-300/50 bg-sky-500/20 text-sky-100'
                              : 'border-slate-400/40 bg-slate-700/40 text-slate-300'
                        }`}
                      >
                        {lessonReadyForProgression ? (
                          <Check size={13} className="text-emerald-100" />
                        ) : lessonUnlocked ? (
                          <span className="inline-flex h-2 w-2 rounded-full bg-sky-100" />
                        ) : (
                          <Lock size={13} className="text-slate-300" />
                        )}
                      </span>

                      <div
                        className={`rounded-lg border transition ${
                          selectedAssessmentId === null && selectedLessonId === lesson.id
                            ? 'border-sky-400/50 bg-sky-500/10'
                            : 'border-sky-400/20 bg-sky-950/20 hover:bg-sky-500/10'
                        } ${lessonUnlocked ? '' : 'opacity-60'}`}
                      >
                        <div className="flex items-center">
                          <button
                            type="button"
                            onClick={() => {
                              selectLesson(lesson);
                            }}
                            disabled={!lessonUnlocked || isQuizOngoing}
                            className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left disabled:cursor-not-allowed"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-200">
                                Lesson {lesson.sequence_no} · {formatMinutesLabel(lesson.estimated_minutes)}
                              </p>
                              <p className="truncate text-[15px] font-semibold text-white">{lesson.title}</p>
                            </div>
                            <span className="relative inline-flex h-10 w-10 items-center justify-center">
                              <svg className="h-10 w-10" viewBox="0 0 40 40" aria-hidden="true">
                                <circle cx="20" cy="20" r={progressRadius} fill="none" stroke="rgba(148, 163, 184, 0.35)" strokeWidth="3" />
                                <circle
                                  cx="20"
                                  cy="20"
                                  r={progressRadius}
                                  fill="none"
                                  stroke={
                                    lessonReadyForProgression
                                      ? 'rgb(52 211 153)'
                                      : 'rgb(14 165 233)'
                                  }
                                  strokeWidth="3"
                                  strokeLinecap="round"
                                  strokeDasharray={`${progressCircumference}`}
                                  strokeDashoffset={progressOffset}
                                  transform="rotate(-90 20 20)"
                                />
                              </svg>
                              {lessonReadyForProgression ? (
                                <span className="absolute inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/30 text-emerald-100">
                                  <Check size={12} />
                                </span>
                              ) : (
                                <span className="absolute text-[9px] font-semibold text-slate-100">
                                  {lessonProgressPercent}%
                                </span>
                              )}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              handleLessonDropdownToggle(lesson);
                            }}
                            disabled={!lessonUnlocked || isQuizOngoing}
                            className="inline-flex h-10 w-8 items-center justify-center text-sky-200 disabled:cursor-not-allowed disabled:opacity-60"
                            aria-label={isExpanded ? 'Collapse lesson topics' : 'Expand lesson topics'}
                            title={isExpanded ? 'Collapse lesson topics' : 'Expand lesson topics'}
                          >
                            <ChevronDown
                              size={15}
                              className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                              aria-hidden="true"
                            />
                          </button>
                        </div>
                      </div>

                      {isExpanded ? (
                        <div className="relative ml-1 mt-2 w-[calc(100%-0.25rem)] pl-5">
                          <span className="absolute left-2 top-1 bottom-1 w-px bg-white/10" aria-hidden="true" />
                          <div className="space-y-2">
                          {lessonTopics.length > 0 ? (
                            lessonTopics.map((topic) => {
                              const topicStepKey = `lesson-${lesson.id}-topic-${topic.id}`;
                              const topicCompleted = lessonCompleted || Boolean(lessonViewedStepKeys[topicStepKey]);
                              const topicProgressPercent = topicCompleted ? 100 : 0;
                              const topicProgressRadius = 11;
                              const topicProgressCircumference = 2 * Math.PI * topicProgressRadius;
                              const topicProgressOffset =
                                topicProgressCircumference * (1 - topicProgressPercent / 100);
                              const isTopicSelected =
                                selectedAssessmentId === null &&
                                selectedLessonId === lesson.id &&
                                selectedLessonStep?.kind === 'topic' &&
                                selectedLessonStep.topic.id === topic.id;

                              return (
                                <div key={topic.id} className="relative pl-4">
                                  <span className="absolute left-0 top-1/2 h-px w-3 -translate-y-1/2 bg-white/10" aria-hidden="true" />
                                  <button
                                    type="button"
                                    disabled={!lessonUnlocked || isQuizOngoing}
                                    onClick={() => selectLessonTopic(lesson, topic)}
                                    className={`flex w-full items-center gap-2 rounded-md border px-2.5 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-60 ${
                                      isTopicSelected
                                        ? 'border-sky-400/50 bg-sky-500/10 text-sky-100'
                                        : 'border-white/10 bg-slate-950/70 text-slate-200 hover:bg-white/10'
                                    }`}
                                  >
                                    <span className="relative inline-flex h-7 w-7 shrink-0 items-center justify-center">
                                      <svg className="h-7 w-7" viewBox="0 0 40 40" aria-hidden="true">
                                        <circle
                                          cx="20"
                                          cy="20"
                                          r={topicProgressRadius}
                                          fill="none"
                                          stroke="rgba(148, 163, 184, 0.35)"
                                          strokeWidth="3"
                                        />
                                        <circle
                                          cx="20"
                                          cy="20"
                                          r={topicProgressRadius}
                                          fill="none"
                                          stroke={topicCompleted ? 'rgb(52 211 153)' : 'rgb(20 184 166)'}
                                          strokeWidth="3"
                                          strokeLinecap="round"
                                          strokeDasharray={`${topicProgressCircumference}`}
                                          strokeDashoffset={topicProgressOffset}
                                          transform="rotate(-90 20 20)"
                                        />
                                      </svg>
                                      {topicCompleted ? (
                                        <span className="absolute inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/25 text-emerald-100">
                                          <Check size={11} />
                                        </span>
                                      ) : null}
                                    </span>
                                    <span className="min-w-0">
                                      <span className="block truncate font-semibold">Topic {topic.sort_order}: {topic.title}</span>
                                    </span>
                                  </button>
                                </div>
                              );
                            })
                          ) : (
                            <div className="relative pl-4">
                              <span className="absolute left-0 top-1/2 h-px w-3 -translate-y-1/2 bg-white/10" aria-hidden="true" />
                              <p className="rounded-md border border-dashed border-white/15 px-2.5 py-2 text-xs text-slate-400">
                                No topics configured.
                              </p>
                            </div>
                          )}

                          {lessonPostTest ? (
                            <div className="relative pl-4">
                              <span className="absolute left-0 top-1/2 h-px w-3 -translate-y-1/2 bg-white/10" aria-hidden="true" />
                              <button
                                type="button"
                                disabled={!isAssessmentUnlocked(lessonPostTest) || (isQuizOngoing && quizInProgressId !== lessonPostTest.id)}
                                onClick={() => selectAssessment(lessonPostTest)}
                                className={`flex w-full items-center gap-2 rounded-md border px-2.5 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50 ${
                                  selectedAssessmentId === lessonPostTest.id
                                    ? 'border-orange-400/50 bg-orange-500/10 text-orange-100'
                                    : 'border-orange-400/25 bg-orange-950/20 text-orange-100 hover:bg-orange-500/10'
                                }`}
                              >
                                <span
                                  className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                                    postTestPassedInCurrentCycleByLessonId[lesson.id]
                                      ? 'border-emerald-300/70 bg-emerald-500/20 text-emerald-100'
                                      : 'border-orange-300/40 bg-orange-500/10 text-orange-200'
                                  }`}
                                >
                                  {postTestPassedInCurrentCycleByLessonId[lesson.id] ? <Check size={12} /> : null}
                                </span>
                                <span className="min-w-0">
                                  <span className="block truncate font-semibold">Post-Test: {lessonPostTest.title}</span>
                                </span>
                              </button>
                            </div>
                          ) : (
                            <div className="relative pl-4">
                              <span className="absolute left-0 top-1/2 h-px w-3 -translate-y-1/2 bg-white/10" aria-hidden="true" />
                              <p className="rounded-md border border-white/10 bg-slate-950/70 px-2.5 py-2 text-xs text-slate-400">
                                No Post-Test configured.
                              </p>
                            </div>
                          )}
                          </div>
                        </div>
                      ) : null}
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
            className={`flex min-h-0 flex-col ${
              isPreviewMode ? 'h-full overflow-hidden' : 'xl:sticky xl:top-20 xl:h-[calc(100vh-7.5rem)] xl:overflow-hidden'
            } ${isLessonOrTopicView ? 'gap-0' : 'gap-4'}`}
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
              className="no-scrollbar min-h-0 flex-1 overflow-y-auto xl:overscroll-contain"
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
                                        disabled={
                                          isCurrentQuestionSubmitted ||
                                          (isCurrentQuestionMultipleChoice &&
                                            !currentQuizAnswerIds.includes(answer.id) &&
                                            currentQuizAnswerIds.length >= currentQuizMaxSelections)
                                        }
                                        onClick={() => handleToggleQuizAnswer(answer.id)}
                                        className={`flex w-full items-center justify-between rounded-lg border px-5 py-4 text-left text-base font-medium disabled:cursor-not-allowed disabled:opacity-70 ${
                                          currentQuizAnswerIds.includes(answer.id)
                                            ? 'border-slate-400 bg-white/5'
                                            : 'border-white/10 bg-slate-900/70 hover:bg-white/5'
                                        }`}
                                      >
                                        <span>{answer.answer_text}</span>
                                        {isCurrentQuestionMultipleChoice ? (
                                          <span
                                            className={`inline-flex h-[18px] w-[18px] items-center justify-center rounded-[4px] border ${
                                              currentQuizAnswerIds.includes(answer.id)
                                                ? 'border-brand-300 bg-brand-500/20 text-brand-300'
                                                : 'border-slate-500/70 text-transparent'
                                            }`}
                                          >
                                            {currentQuizAnswerIds.includes(answer.id) ? <Check size={13} /> : null}
                                          </span>
                                        ) : currentQuizAnswerIds.includes(answer.id) ? (
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
                                      : isCurrentQuestionMultipleChoice
                                        ? `Select up to ${currentQuizMaxSelections} answers, then submit to continue.`
                                        : 'Submit this answer to proceed to the next question.'}
                                  </p>
                                  <button
                                    type="button"
                                    disabled={isCurrentQuestionSubmitted || isQuizSubmitting || !hasCurrentQuizAnswer}
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
                                    disabled={
                                      isCurrentQuestionSubmitted ||
                                      (isCurrentQuestionMultipleChoice &&
                                        !currentQuizAnswerIds.includes(answer.id) &&
                                        currentQuizAnswerIds.length >= currentQuizMaxSelections)
                                    }
                                    onClick={() => handleToggleQuizAnswer(answer.id)}
                                    className={`flex w-full items-center justify-between rounded-lg border px-5 py-4 text-left text-base font-medium disabled:cursor-not-allowed disabled:opacity-70 ${
                                      currentQuizAnswerIds.includes(answer.id)
                                        ? 'border-slate-400 bg-white/5'
                                        : 'border-white/10 bg-slate-900/70 hover:bg-white/5'
                                    }`}
                                  >
                                    <span>{answer.answer_text}</span>
                                    {isCurrentQuestionMultipleChoice ? (
                                      <span
                                        className={`inline-flex h-[18px] w-[18px] items-center justify-center rounded-[4px] border ${
                                          currentQuizAnswerIds.includes(answer.id)
                                            ? 'border-brand-300 bg-brand-500/20 text-brand-300'
                                            : 'border-slate-500/70 text-transparent'
                                        }`}
                                      >
                                        {currentQuizAnswerIds.includes(answer.id) ? <Check size={13} /> : null}
                                      </span>
                                    ) : currentQuizAnswerIds.includes(answer.id) ? (
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
                                  : isCurrentQuestionMultipleChoice
                                    ? `Select up to ${currentQuizMaxSelections} answers, then submit to continue.`
                                    : 'Submit this answer to proceed to the next question.'}
                              </p>
                              <button
                                type="button"
                                disabled={isCurrentQuestionSubmitted || isQuizSubmitting || !hasCurrentQuizAnswer}
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
                ) : selectedAssessmentDisplayResult ? (
                  isSimulationAssessment ? (
                    <article className="h-full w-full overflow-hidden rounded-2xl border border-cyan-400/30 bg-slate-950 shadow-sm">
                      <div className="grid h-full lg:grid-cols-[minmax(0,1fr)_360px]">
                        <div className="flex h-full flex-col justify-center p-6 md:p-10">
                          <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
                            Assessment Complete
                          </p>
                          <h3 className="mt-3 text-3xl font-bold text-white md:text-4xl">
                            {selectedAssessmentDisplayResult.passed ? 'Quiz Passed' : 'Quiz Failed'}
                          </h3>
                          <p className="mt-2 text-sm text-slate-300">
                            {selectedAssessment.title} evaluation finished. Review your score and continue to the next learning step.
                          </p>

                            <div className="mt-6 grid gap-3 sm:grid-cols-3">
                              <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                                <p className="font-mono text-[11px] uppercase tracking-wider text-slate-400">Score</p>
                                <p className="mt-1 text-2xl font-bold text-cyan-300">{Number(selectedAssessmentDisplayResult.score)}%</p>
                              </div>
                            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                              <p className="font-mono text-[11px] uppercase tracking-wider text-slate-400">Passing</p>
                              <p className="mt-1 text-2xl font-bold text-white">{selectedAssessment.passing_score}%</p>
                            </div>
                              <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                                <p className="font-mono text-[11px] uppercase tracking-wider text-slate-400">Attempt</p>
                                <p className="mt-1 text-2xl font-bold text-white">#{selectedAssessmentDisplayResult.attempt_no}</p>
                              </div>
                            </div>

                          <div className="mt-5">
                            <StatusPill
                              text={selectedAssessmentDisplayResult.passed ? 'Passed' : 'Failed'}
                              className={
                                selectedAssessmentDisplayResult.passed
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
                    (() => {
                      const stageTitle = selectedAssessmentStage === 'post' ? 'Post-test complete' : 'Pre-test complete';
                      const canRetake =
                        selectedAssessmentAttemptsRemaining > 0 &&
                        !isQuizSubmitting &&
                        !isQuizLoading;

                      return (
                        <article className="flex h-full w-full items-center justify-center rounded-2xl border border-white/10 bg-slate-900/70 p-6 shadow-sm md:p-8">
                          <div className="w-full max-w-xl text-center">
                              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center">
                                {selectedAssessmentDisplayResult.passed ? (
                                  <svg viewBox="0 0 80 80" width="80" height="80" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                    <circle cx="40" cy="40" r="36" fill="none" stroke="rgba(148,163,184,0.35)" strokeWidth="6" />
                                    <circle
                                      cx="40"
                                      cy="40"
                                      r="36"
                                      fill="none"
                                      stroke="rgb(29 158 117)"
                                      strokeWidth="6"
                                      strokeDasharray="226"
                                      strokeDashoffset="0"
                                      strokeLinecap="round"
                                      transform="rotate(-90 40 40)"
                                    />
                                    <polyline
                                      points="25,41 36,52 56,30"
                                      fill="none"
                                      stroke="rgb(29 158 117)"
                                      strokeWidth="5"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                  </svg>
                                ) : (
                                  <svg viewBox="0 0 80 80" width="80" height="80" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                    <circle cx="40" cy="40" r="36" fill="none" stroke="rgba(148,163,184,0.35)" strokeWidth="6" />
                                    <circle
                                      cx="40"
                                      cy="40"
                                      r="36"
                                      fill="none"
                                      stroke="rgb(244 63 94)"
                                      strokeWidth="6"
                                      strokeDasharray="226"
                                      strokeDashoffset="0"
                                      strokeLinecap="round"
                                      transform="rotate(-90 40 40)"
                                    />
                                    <line x1="28" y1="28" x2="52" y2="52" stroke="rgb(244 63 94)" strokeWidth="6" strokeLinecap="round" />
                                    <line x1="52" y1="28" x2="28" y2="52" stroke="rgb(244 63 94)" strokeWidth="6" strokeLinecap="round" />
                                  </svg>
                                )}
                              </div>

                              <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-slate-400">{stageTitle}</p>
                              <h3 className="mt-1 text-[28px] font-semibold text-white">
                                {selectedAssessmentDisplayResult.passed ? 'Quiz passed' : 'Quiz failed'}
                              </h3>

                              <div className="mx-auto mt-8 grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-3">
                                <div className="rounded-lg border border-white/10 bg-slate-950/70 p-4">
                                  <p className="text-[11px] uppercase tracking-[0.06em] text-slate-400">Score</p>
                                  <p className={`mt-1 text-2xl font-semibold ${selectedAssessmentDisplayResult.passed ? 'text-emerald-300' : 'text-rose-300'}`}>
                                    {Number(selectedAssessmentDisplayResult.score)}%
                                  </p>
                                </div>
                                <div className="rounded-lg border border-white/10 bg-slate-950/70 p-4">
                                  <p className="text-[11px] uppercase tracking-[0.06em] text-slate-400">Passing</p>
                                  <p className="mt-1 text-2xl font-semibold text-white">{selectedAssessment.passing_score}%</p>
                                </div>
                                <div className="rounded-lg border border-white/10 bg-slate-950/70 p-4">
                                  <p className="text-[11px] uppercase tracking-[0.06em] text-slate-400">Attempt</p>
                                  <p className="mt-1 text-2xl font-semibold text-white">#{selectedAssessmentDisplayResult.attempt_no}</p>
                                </div>
                              </div>

                              <div className="mt-8">
                                <button
                                  type="button"
                                  disabled={!canRetake}
                                  onClick={() => void handleStartQuiz(selectedAssessment)}
                                  className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  <CirclePlay size={16} />
                                  Retake quiz
                                </button>
                                <p className="mt-2 text-xs text-slate-400">
                                  {selectedAssessmentAttemptsRemaining > 0
                                    ? `Remaining attempts: ${selectedAssessmentAttemptsRemaining}`
                                    : 'No attempts remaining'}
                                </p>
                              </div>
                          </div>
                        </article>
                      );
                    })()
                  )
                ) : (
                  (() => {
                    const stage = selectedAssessmentStage ?? 'pre';
                    const meta = assessmentViewMeta[stage];
                    const AssessmentIcon = meta.icon;
                    const latest = selectedAssessmentLatestResult;
                    const unlocked = isAssessmentUnlocked(selectedAssessment);

                    if (!isSimulationAssessment) {
                      const stageTitle = stage === 'post' ? 'Post-test' : 'Pre-test';
                      const latestScore = latest ? `${Number(latest.score)}%` : '—';
                      const attemptsRemainingLabel =
                        selectedAssessmentAttemptsRemaining === 1 ? 'attempt' : 'attempts';
                      const canStart =
                        unlocked &&
                        selectedAssessmentAttemptsRemaining > 0 &&
                        !isQuizSubmitting &&
                        !isQuizLoading;

                      return (
                        <article className="flex h-full w-full items-center justify-center rounded-2xl border border-white/10 bg-slate-900/70 p-6 shadow-sm md:p-8">
                          <div className="w-full max-w-xl text-center">
                              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center">
                                <svg viewBox="0 0 80 80" width="80" height="80" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                  <circle cx="40" cy="40" r="36" fill="none" stroke="rgba(148,163,184,0.35)" strokeWidth="6" />
                                  <circle cx="40" cy="40" r="10" fill="rgba(148,163,184,0.55)" />
                                  <line x1="40" y1="16" x2="40" y2="42" stroke="rgba(148,163,184,0.75)" strokeWidth="6" strokeLinecap="round" />
                                  <circle cx="40" cy="57" r="4" fill="rgba(148,163,184,0.75)" />
                                </svg>
                              </div>

                              <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-slate-400">{stageTitle}</p>
                              <h3 className="mt-1 text-[28px] font-semibold text-white">Ready when you are</h3>
                              <p className="mt-2 text-sm text-slate-300">
                                {`You need ${selectedAssessment.passing_score}% to pass. You have ${selectedAssessmentAttemptsRemaining} of ${selectedAssessment.attempt_limit} ${attemptsRemainingLabel} remaining.`}
                              </p>
                              {!unlocked ? (
                                <p className="mt-2 text-xs font-medium uppercase tracking-[0.08em] text-amber-300">
                                  {assessmentUnlockMessage(selectedAssessment)}
                                </p>
                              ) : null}

                              <div className="mx-auto mt-8 grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-3">
                                <div className="rounded-lg border border-white/10 bg-slate-950/70 p-4">
                                  <p className="text-[11px] uppercase tracking-[0.06em] text-slate-400">Score</p>
                                  <p className="mt-1 text-2xl font-semibold text-slate-300">{latestScore}</p>
                                </div>
                                <div className="rounded-lg border border-white/10 bg-slate-950/70 p-4">
                                  <p className="text-[11px] uppercase tracking-[0.06em] text-slate-400">Passing</p>
                                  <p className="mt-1 text-2xl font-semibold text-white">{selectedAssessment.passing_score}%</p>
                                </div>
                                <div className="rounded-lg border border-white/10 bg-slate-950/70 p-4">
                                  <p className="text-[11px] uppercase tracking-[0.06em] text-slate-400">Attempts</p>
                                  <p className="mt-1 text-2xl font-semibold text-white">{selectedAssessmentAttemptsRemaining}</p>
                                </div>
                              </div>

                              <div className="mt-8">
                                <button
                                  type="button"
                                  disabled={!canStart}
                                  onClick={() => void handleStartQuiz(selectedAssessment)}
                                  className="inline-flex items-center gap-2 rounded-md bg-slate-100 px-7 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  <CirclePlay size={16} />
                                  {selectedAssessmentAttemptCount > 0 ? 'Retake quiz' : 'Start quiz'}
                                </button>
                                <p className="mt-2 text-xs text-slate-400">
                                  {selectedAssessmentAttemptsRemaining > 0
                                    ? `Remaining attempts: ${selectedAssessmentAttemptsRemaining}`
                                    : 'No attempts remaining'}
                                </p>
                              </div>
                          </div>
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
                                className={richTextContentClassName}
                                dangerouslySetInnerHTML={{ __html: selectedLessonStep.html }}
                              />
                            ) : (
                              <p className="text-sm text-slate-400">No lesson content yet.</p>
                            )}
                          </div>

                          <div>
                            {selectedLessonStep.mediaUrls.length > 0 ? (
                              <div
                                className={`mt-4 grid gap-3 ${
                                  selectedLessonStep.mediaUrls.length > 1 ? 'sm:grid-cols-2' : 'grid-cols-1'
                                }`}
                              >
                                {selectedLessonStep.mediaUrls.map((mediaUrl, mediaIndex) =>
                                  isVideoMediaUrl(mediaUrl) ? (
                                    <video
                                      key={`${mediaUrl}-${mediaIndex}`}
                                      src={mediaUrl}
                                      controls
                                      className="h-[220px] w-full rounded-md border border-white/10 bg-black/30 object-contain"
                                    />
                                  ) : (
                                    <img
                                      key={`${mediaUrl}-${mediaIndex}`}
                                      src={mediaUrl}
                                      alt={`${selectedLesson.title} media ${mediaIndex + 1}`}
                                      className="h-[220px] w-full rounded-md border border-white/10 bg-black/30 object-contain"
                                    />
                                  )
                                )}
                              </div>
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
                                          className={richTextContentClassName}
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
                                    className={`grid items-start gap-8 xl:items-center ${
                                      isTemplateReversed
                                        ? 'xl:grid-cols-[340px_minmax(0,1fr)]'
                                        : 'xl:grid-cols-[minmax(0,1fr)_340px]'
                                    }`}
                                  >
                                    <div className={`min-w-0 ${isTemplateReversed ? 'xl:order-2' : ''}`}>
                                      {sectionHtml ? (
                                        <div
                                          className={richTextContentClassName}
                                          dangerouslySetInnerHTML={{ __html: sectionHtml }}
                                        />
                                      ) : (
                                        <p className="text-sm text-slate-400">No text content yet.</p>
                                      )}
                                    </div>
                                    <div className={`min-w-0 xl:flex xl:items-center ${isTemplateReversed ? 'xl:order-1' : ''}`}>
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
                                        className={richTextContentClassName}
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

