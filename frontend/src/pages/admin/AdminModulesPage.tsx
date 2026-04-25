
import { ChangeEvent, FormEvent, MouseEvent as ReactMouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Eye,
  List,
  ListOrdered,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  createLesson,
  createLessonContent,
  createModule,
  createQuestionAnswer,
  createQuiz,
  createQuizQuestion,
  createTopic,
  deleteModule,
  deleteLesson,
  deleteLessonContent,
  deleteQuestionAnswer,
  deleteQuiz,
  deleteQuizQuestion,
  deleteTopic,
  getModuleBuilder,
  getModules,
  updateLesson,
  updateLessonContent,
  updateModule,
  updateQuestionAnswer,
  updateQuiz,
  updateQuizQuestion,
  updateTopic,
} from '../../lib/api';
import type {
  AnswerOption,
  LessonContentBlock,
  LessonSummary,
  ModuleBuilderPayload,
  ModuleSummary,
  QuizQuestionRow,
  QuizSummary,
  TopicSummary,
} from '../../types/lms';

type BuilderSelection =
  | { view: 'builderHome' }
  | { view: 'preTest' }
  | { view: 'lesson'; lessonId: number }
  | { view: 'topic'; lessonId: number; topicId: number }
  | { view: 'postTest'; lessonId: number }
  | { view: 'finalExam' };

type AddType = 'preTest' | 'lesson' | 'topic' | 'postTest';
type BuilderQuestionType = 'single_choice' | 'multiple_choice';

type ModuleForm = {
  title: string;
  description: string;
  category: string;
  thumbnailUrl: string;
  isActive: boolean;
  isLocked: boolean;
};

const MODULE_CATEGORIES = ['Hardware', 'Software', 'Security'];

function normalizeModuleCategory(category: string | null | undefined): string {
  if (!category) return 'Hardware';
  const normalized = category.trim().toLowerCase();
  if (normalized === 'hardware') return 'Hardware';
  if (normalized === 'software') return 'Software';
  if (normalized === 'security') return 'Security';
  return 'Hardware';
}

const defaultModuleForm: ModuleForm = {
  title: '',
  description: '',
  category: 'Hardware',
  thumbnailUrl: '',
  isActive: false,
  isLocked: false,
};
const MAX_LESSON_MEDIA_ITEMS = 3;

function normalizeQuestionType(value: string | null | undefined): BuilderQuestionType {
  return value === 'multiple_choice' ? 'multiple_choice' : 'single_choice';
}

const editorToolbarGroupClass =
  'inline-flex items-center gap-1 rounded-md border border-white/10 bg-slate-950/60 px-1 py-1';
const editorToolbarButtonClass =
  'rounded border border-white/15 px-2 py-1 text-xs text-slate-200 transition hover:bg-white/10';
const editorToolbarIconButtonClass =
  'inline-flex h-7 w-7 items-center justify-center rounded border border-white/15 text-slate-200 transition hover:bg-white/10';
const editorToolbarSelectClass = 'h-7 rounded border border-white/15 bg-slate-900 px-2 text-xs text-slate-200';

function selectionKey(selection: BuilderSelection): string {
  if (selection.view === 'builderHome') return 'builderHome';
  if (selection.view === 'lesson') return `lesson:${selection.lessonId}`;
  if (selection.view === 'topic') return `topic:${selection.lessonId}:${selection.topicId}`;
  if (selection.view === 'postTest') return `post:${selection.lessonId}`;
  return selection.view;
}

function sameSelection(a: BuilderSelection, b: BuilderSelection) {
  return selectionKey(a) === selectionKey(b);
}

function findPreQuiz(quizzes: QuizSummary[]) {
  return quizzes.find((quiz) => quiz.stage === 'pre_test' || (quiz.quiz_type === 'lesson_quiz' && quiz.lesson_id === null)) ?? null;
}

function findFinalQuiz(quizzes: QuizSummary[]) {
  return quizzes.find((quiz) => quiz.stage === 'final_exam' || quiz.quiz_type === 'final_exam') ?? null;
}

function toDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Failed to read selected image.'));
    reader.readAsDataURL(file);
  });
}

function sanitizeRichHtml(input: string) {
  return input
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '');
}

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

function serializeLessonOverviewMediaUrls(urls: string[]): string {
  const cleaned = urls
    .map((url) => normalizeUrlCandidate(url))
    .filter((url): url is string => Boolean(url));

  if (cleaned.length === 0) return '';
  if (cleaned.length === 1) return cleaned[0];
  return JSON.stringify(cleaned);
}

function getLessonOverviewMediaUrls(lesson: LessonSummary | null | undefined): string[] {
  return parseLessonOverviewMediaUrls(lesson?.overview_image_url ?? null);
}

function isVideoMediaUrl(url: string | null | undefined) {
  if (!url) return false;
  return /^(data:video\/|https?:\/\/.*\.(mp4|webm|ogg|mov)(\?.*)?$)/i.test(url);
}

function isMediaContentType(value: string | null | undefined): boolean {
  return value === 'image' || value === 'video';
}

function getRenderableMediaUrl(block: LessonContentBlock | null | undefined): string | null {
  if (!block || !isMediaContentType(block.content_type)) return null;
  return normalizeUrlCandidate(block.content_url);
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

function StatusPill({ text, className }: { text: string; className: string }) {
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${className}`}>
      {text}
    </span>
  );
}

export function AdminModulesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [modules, setModules] = useState<ModuleSummary[]>([]);
  const [builder, setBuilder] = useState<ModuleBuilderPayload | null>(null);
  const [selection, setSelection] = useState<BuilderSelection>({ view: 'builderHome' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddNodeModal, setShowAddNodeModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const [createForm, setCreateForm] = useState<ModuleForm>({ ...defaultModuleForm, isActive: true });
  const [editModuleId, setEditModuleId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<ModuleForm>(defaultModuleForm);

  const [addType, setAddType] = useState<AddType>('lesson');
  const [addTitle, setAddTitle] = useState('');
  const [addLessonId, setAddLessonId] = useState<number | null>(null);

  const [previewSelection, setPreviewSelection] = useState<BuilderSelection>({ view: 'builderHome' });
  const lessonContentEditorRef = useRef<HTMLDivElement | null>(null);
  const topicSectionEditorRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const lessonSelectionRangeRef = useRef<Range | null>(null);
  const topicSelectionRangeRefs = useRef<Record<number, Range | null>>({});
  const createThumbnailInputRef = useRef<HTMLInputElement | null>(null);
  const editThumbnailInputRef = useRef<HTMLInputElement | null>(null);
  const autoLoadBuilderModuleIdRef = useRef<number | null>(null);
  const [activeTopicSectionId, setActiveTopicSectionId] = useState<number | null>(null);

  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await task();
    } catch (taskError) {
      setError(taskError instanceof Error ? taskError.message : 'Operation failed.');
    } finally {
      setBusy(false);
    }
  };

  const loadModules = async () => {
    const data = await getModules();
    setModules(data);
  };

  const chooseInitialSelection = (payload: ModuleBuilderPayload): BuilderSelection => {
    const sortedLessons = [...payload.lessons].sort((a, b) => a.sequence_no - b.sequence_no);
    if (findPreQuiz(payload.quizzes)) return { view: 'preTest' };
    if (sortedLessons.length > 0) return { view: 'lesson', lessonId: sortedLessons[0].id };
    if (findFinalQuiz(payload.quizzes)) return { view: 'finalExam' };
    return { view: 'builderHome' };
  };

  const selectionExists = (payload: ModuleBuilderPayload, target: BuilderSelection) => {
    if (target.view === 'builderHome') return true;
    if (target.view === 'preTest') return Boolean(findPreQuiz(payload.quizzes));
    if (target.view === 'finalExam') return Boolean(findFinalQuiz(payload.quizzes));
    if (target.view === 'lesson') return payload.lessons.some((lesson) => lesson.id === target.lessonId);
    if (target.view === 'topic') return payload.topics.some((topic) => topic.id === target.topicId && topic.lesson_id === target.lessonId);
    return payload.quizzes.some((quiz) => quiz.stage === 'post_test' && quiz.lesson_id === target.lessonId);
  };

  const loadBuilder = async (moduleId: number, preferredSelection?: BuilderSelection | null) => {
    const payload = await getModuleBuilder(moduleId);
    setBuilder(payload);
    if (preferredSelection && selectionExists(payload, preferredSelection)) {
      setSelection(preferredSelection);
      return;
    }
    setSelection(chooseInitialSelection(payload));
  };

  useEffect(() => {
    void run(async () => {
      await loadModules();
    });
  }, []);

  useEffect(() => {
    const moduleIdParam = Number(searchParams.get('moduleId'));
    const hasValidModuleParam = Number.isInteger(moduleIdParam) && moduleIdParam > 0;

    if (builder) {
      const hasBuilderParam = searchParams.get('builder') === '1';
      const hasCurrentModuleParam = searchParams.get('moduleId') === String(builder.module.id);
      if (!hasBuilderParam || !hasCurrentModuleParam) {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set('builder', '1');
        nextParams.set('moduleId', String(builder.module.id));
        setSearchParams(nextParams, { replace: true });
      }
      return;
    }

    if (!hasValidModuleParam) {
      if (searchParams.get('builder') === '1') {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete('builder');
        setSearchParams(nextParams, { replace: true });
      }
      return;
    }

    if (autoLoadBuilderModuleIdRef.current === moduleIdParam) return;
    autoLoadBuilderModuleIdRef.current = moduleIdParam;
    void run(async () => {
      await loadBuilder(moduleIdParam);
    });
  }, [builder, searchParams, setSearchParams]);

  const filteredModules = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return modules;
    return modules.filter((module) => `${module.title} ${module.description} ${module.category ?? ''}`.toLowerCase().includes(query));
  }, [modules, search]);

  const lessons = useMemo(() => [...(builder?.lessons ?? [])].sort((a, b) => a.sequence_no - b.sequence_no), [builder?.lessons]);

  const topicsByLesson = useMemo(() => {
    const map = new Map<number, TopicSummary[]>();
    for (const topic of builder?.topics ?? []) {
      const list = map.get(topic.lesson_id) ?? [];
      list.push(topic);
      map.set(topic.lesson_id, list);
    }
    for (const [lessonId, list] of map.entries()) map.set(lessonId, [...list].sort((a, b) => a.sort_order - b.sort_order));
    return map;
  }, [builder?.topics]);

  const contentByTopic = useMemo(() => {
    const map = new Map<number, LessonContentBlock[]>();
    for (const block of builder?.content ?? []) {
      if (!block.topic_id) continue;
      const list = map.get(block.topic_id) ?? [];
      list.push(block);
      map.set(block.topic_id, list);
    }
    for (const [topicId, list] of map.entries()) map.set(topicId, [...list].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id));
    return map;
  }, [builder?.content]);

  const postQuizByLesson = useMemo(() => {
    const map = new Map<number, QuizSummary>();
    for (const quiz of builder?.quizzes ?? []) {
      if (quiz.stage === 'post_test' && quiz.lesson_id !== null && !map.has(quiz.lesson_id)) {
        map.set(quiz.lesson_id, quiz);
      }
    }
    return map;
  }, [builder?.quizzes]);

  const questionsByQuiz = useMemo(() => {
    const map = new Map<number, QuizQuestionRow[]>();
    for (const question of builder?.questions ?? []) {
      const list = map.get(question.quiz_id) ?? [];
      list.push(question);
      map.set(question.quiz_id, list);
    }
    for (const [quizId, list] of map.entries()) map.set(quizId, [...list].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id));
    return map;
  }, [builder?.questions]);

  const answersByQuestion = useMemo(() => {
    const map = new Map<number, AnswerOption[]>();
    for (const answer of builder?.answers ?? []) {
      const list = map.get(answer.question_id) ?? [];
      list.push(answer);
      map.set(answer.question_id, list);
    }
    for (const [questionId, list] of map.entries()) map.set(questionId, [...list].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id));
    return map;
  }, [builder?.answers]);

  const preQuiz = useMemo(() => findPreQuiz(builder?.quizzes ?? []), [builder?.quizzes]);
  const finalQuiz = useMemo(() => findFinalQuiz(builder?.quizzes ?? []), [builder?.quizzes]);

  const currentLessonId =
    selection.view === 'lesson' || selection.view === 'topic' || selection.view === 'postTest' ? selection.lessonId : null;
  const currentLesson = currentLessonId ? lessons.find((lesson) => lesson.id === currentLessonId) ?? null : null;
  const currentLessonMediaUrls = getLessonOverviewMediaUrls(currentLesson);
  const currentTopicId = selection.view === 'topic' ? selection.topicId : null;
  const currentTopic = currentTopicId ? builder?.topics.find((topic) => topic.id === currentTopicId) ?? null : null;

  useEffect(() => {
    if (selection.view !== 'lesson' || !currentLesson || !lessonContentEditorRef.current) return;
    lessonContentEditorRef.current.innerHTML = sanitizeRichHtml(currentLesson.overview_text ?? '');
  }, [selection.view, currentLesson?.id]);

  const currentQuiz = useMemo(() => {
    if (!builder) return null;
    if (selection.view === 'preTest') return preQuiz;
    if (selection.view === 'finalExam') return finalQuiz;
    if (selection.view === 'postTest') return postQuizByLesson.get(selection.lessonId) ?? null;
    return null;
  }, [builder, selection, preQuiz, finalQuiz, postQuizByLesson]);

  const selectedQuestions = currentQuiz ? questionsByQuiz.get(currentQuiz.id) ?? [] : [];
  const selectedContentBlocks = currentTopic ? contentByTopic.get(currentTopic.id) ?? [] : [];
  const selectedTopicSections = selectedContentBlocks;

  useEffect(() => {
    if (selection.view !== 'topic' || !currentTopic) return;
    for (const section of selectedTopicSections) {
      const editor = topicSectionEditorRefs.current[section.id];
      if (editor) editor.innerHTML = sanitizeRichHtml(section.body_text ?? '');
    }
    setActiveTopicSectionId((prev) => {
      if (selectedTopicSections.length === 0) return null;
      if (prev && selectedTopicSections.some((section) => section.id === prev)) return prev;
      return selectedTopicSections[0].id;
    });
  }, [selection.view, currentTopic?.id, selectedTopicSections]);

  const sequence = useMemo(() => {
    const list: Array<{ label: string; selection: BuilderSelection }> = [];
    if (preQuiz) {
      list.push({ label: 'Pre-Test', selection: { view: 'preTest' } });
    }
    for (const lesson of lessons) {
      list.push({ label: `Lesson ${lesson.sequence_no}: ${lesson.title}`, selection: { view: 'lesson', lessonId: lesson.id } });
      const topics = topicsByLesson.get(lesson.id) ?? [];
      for (const topic of topics) {
        list.push({
          label: `Topic ${topic.sort_order}: ${topic.title}`,
          selection: { view: 'topic', lessonId: lesson.id, topicId: topic.id },
        });
      }
      if (postQuizByLesson.get(lesson.id)) {
        list.push({ label: `Lesson ${lesson.sequence_no} Post-Test`, selection: { view: 'postTest', lessonId: lesson.id } });
      }
    }
    if (finalQuiz) {
      list.push({ label: 'Final Exam', selection: { view: 'finalExam' } });
    }
    return list;
  }, [lessons, topicsByLesson, preQuiz, postQuizByLesson, finalQuiz]);

  const selectionIndex = sequence.findIndex((item) => sameSelection(item.selection, selection));
  const previewIndex = sequence.findIndex((item) => sameSelection(item.selection, previewSelection));
  const totalPages = sequence.length;
  const currentPageNumber = selectionIndex >= 0 ? selectionIndex + 1 : 0;
  const currentBuilderLabel = sequence[selectionIndex]?.label ?? 'Builder Home';
  const builderProgressPercent = totalPages > 0 ? Math.max(5, Math.round((currentPageNumber / totalPages) * 100)) : 0;

  const updateLessonLocal = (lessonId: number, patch: Partial<LessonSummary>) => {
    setBuilder((prev) => {
      if (!prev) return prev;
      return { ...prev, lessons: prev.lessons.map((lesson) => (lesson.id === lessonId ? { ...lesson, ...patch } : lesson)) };
    });
  };

  const updateTopicLocal = (topicId: number, patch: Partial<TopicSummary>) => {
    setBuilder((prev) => {
      if (!prev) return prev;
      return { ...prev, topics: prev.topics.map((topic) => (topic.id === topicId ? { ...topic, ...patch } : topic)) };
    });
  };

  const updateContentLocal = (contentId: number, patch: Partial<LessonContentBlock>) => {
    setBuilder((prev) => {
      if (!prev) return prev;
      return { ...prev, content: prev.content.map((content) => (content.id === contentId ? { ...content, ...patch } : content)) };
    });
  };

  const updateQuizLocal = (quizId: number, patch: Partial<QuizSummary>) => {
    setBuilder((prev) => {
      if (!prev) return prev;
      return { ...prev, quizzes: prev.quizzes.map((quiz) => (quiz.id === quizId ? { ...quiz, ...patch } : quiz)) };
    });
  };

  const updateQuestionLocal = (questionId: number, patch: Partial<QuizQuestionRow>) => {
    setBuilder((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        questions: prev.questions.map((question) => (question.id === questionId ? { ...question, ...patch } : question)),
      };
    });
  };

  const updateAnswerLocal = (answerId: number, patch: Partial<AnswerOption>) => {
    setBuilder((prev) => {
      if (!prev) return prev;
      return { ...prev, answers: prev.answers.map((answer) => (answer.id === answerId ? { ...answer, ...patch } : answer)) };
    });
  };

  const setQuestionTypeLocally = (questionId: number, questionType: BuilderQuestionType) => {
    setBuilder((prev) => {
      if (!prev) return prev;

      const nextQuestions = prev.questions.map((question) =>
        question.id === questionId ? { ...question, question_type: questionType } : question
      );

      if (questionType !== 'single_choice') {
        return { ...prev, questions: nextQuestions };
      }

      const currentAnswers = prev.answers
        .filter((answer) => answer.question_id === questionId)
        .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
      const firstCorrectId = currentAnswers.find((answer) => Boolean(answer.is_correct))?.id ?? currentAnswers[0]?.id ?? null;

      if (!firstCorrectId) {
        return { ...prev, questions: nextQuestions };
      }

      return {
        ...prev,
        questions: nextQuestions,
        answers: prev.answers.map((answer) => {
          if (answer.question_id !== questionId) return answer;
          return { ...answer, is_correct: answer.id === firstCorrectId };
        }),
      };
    });
  };

  const openModuleEdit = (module: ModuleSummary) => {
    setEditModuleId(module.id);
    setEditForm({
      title: module.title,
      description: module.description,
      category: normalizeModuleCategory(module.category),
      thumbnailUrl: module.thumbnail_url ?? '',
      isActive: module.is_active,
      isLocked: module.is_locked,
    });
    setShowEditModal(true);
  };

  const handleDeleteModule = async (module: ModuleSummary) => {
    const confirmed = window.confirm(`Delete module "${module.title}"? This cannot be undone.`);
    if (!confirmed) return;
    await run(async () => {
      await deleteModule(module.id);
      await loadModules();
    });
  };

  const closeBuilderView = () => {
    setBuilder(null);
    setSelection({ view: 'builderHome' });
    autoLoadBuilderModuleIdRef.current = null;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('builder');
    nextParams.delete('moduleId');
    setSearchParams(nextParams, { replace: true });
  };

  const handleCreateModule = async (event: FormEvent) => {
    event.preventDefault();
    await run(async () => {
      const created = await createModule({
        title: createForm.title,
        description: createForm.description,
        category: createForm.category,
        thumbnailUrl: createForm.thumbnailUrl || undefined,
      });
      if (createForm.isActive !== true || createForm.isLocked) {
        await updateModule(created.module.id, {
          isActive: createForm.isActive,
          isLocked: createForm.isLocked,
        });
      }
      await loadModules();
      setShowCreateModal(false);
      setCreateForm({ ...defaultModuleForm, isActive: true });
      await loadBuilder(created.module.id);
    });
  };

  const handleUpdateModule = async (event: FormEvent) => {
    event.preventDefault();
    if (!editModuleId) return;
    await run(async () => {
      await updateModule(editModuleId, {
        title: editForm.title,
        description: editForm.description,
        category: editForm.category,
        thumbnailUrl: editForm.thumbnailUrl,
        prerequisiteModuleId: null,
        isActive: editForm.isActive,
        isLocked: editForm.isLocked,
      });
      await loadModules();
      if (builder && builder.module.id === editModuleId) await loadBuilder(editModuleId, selection);
      setShowEditModal(false);
    });
  };

  const handleCreateThumbnailUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file for the module thumbnail.');
      event.target.value = '';
      return;
    }

    try {
      const imageDataUrl = await toDataUrl(file);
      setCreateForm((prev) => ({ ...prev, thumbnailUrl: imageDataUrl }));
      setError('');
    } catch {
      setError('Failed to read selected image.');
    } finally {
      event.target.value = '';
    }
  };

  const handleEditThumbnailUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file for the module thumbnail.');
      event.target.value = '';
      return;
    }

    try {
      const imageDataUrl = await toDataUrl(file);
      setEditForm((prev) => ({ ...prev, thumbnailUrl: imageDataUrl }));
      setError('');
    } catch {
      setError('Failed to read selected image.');
    } finally {
      event.target.value = '';
    }
  };

  const openAddNodeModal = (type: AddType) => {
    if (!builder) return;
    if (type === 'topic' || type === 'postTest') {
      if (!lessons.length) {
        setError('Add a lesson first.');
        return;
      }
      setAddLessonId(currentLesson?.id ?? lessons[0].id);
    } else {
      setAddLessonId(null);
    }
    setAddType(type);
    if (type === 'lesson') setAddTitle(`Lesson ${lessons.length + 1}`);
    if (type === 'preTest') setAddTitle('Pre-Test');
    if (type === 'topic') setAddTitle('New Topic');
    if (type === 'postTest') setAddTitle('Post-Test');
    setShowAddNodeModal(true);
  };

  const handleAddNode = async (event: FormEvent) => {
    event.preventDefault();
    if (!builder) return;
    await run(async () => {
      if (addType === 'preTest') {
        if (preQuiz) throw new Error('Pre-Test already exists.');
        await createQuiz({ moduleId: builder.module.id, lessonId: null, title: addTitle.trim() || 'Pre-Test', quizType: 'lesson_quiz', stage: 'pre_test' });
        await loadBuilder(builder.module.id, { view: 'preTest' });
      } else if (addType === 'lesson') {
        const created = await createLesson({ moduleId: builder.module.id, title: addTitle.trim() || `Lesson ${lessons.length + 1}`, summary: '', estimatedMinutes: 10, overviewText: '' });
        await loadBuilder(builder.module.id, { view: 'lesson', lessonId: created.id });
      } else if (addType === 'topic') {
        if (!addLessonId) throw new Error('Select a lesson for the topic.');
        const created = await createTopic({ lessonId: addLessonId, title: addTitle.trim() || 'Topic', summary: '' });
        await loadBuilder(builder.module.id, { view: 'topic', lessonId: addLessonId, topicId: created.id });
      } else if (addType === 'postTest') {
        if (!addLessonId) throw new Error('Select a lesson for the post-test.');
        if (postQuizByLesson.get(addLessonId)) throw new Error('Post-Test already exists for this lesson.');
        await createQuiz({ moduleId: builder.module.id, lessonId: addLessonId, title: addTitle.trim() || 'Post-Test', quizType: 'lesson_quiz', stage: 'post_test' });
        await loadBuilder(builder.module.id, { view: 'postTest', lessonId: addLessonId });
      }
      setShowAddNodeModal(false);
    });
  };

  const handleAddFinalExam = async () => {
    if (!builder) return;
    await run(async () => {
      if (!finalQuiz) {
        await createQuiz({ moduleId: builder.module.id, lessonId: null, title: 'Final Exam', quizType: 'final_exam', stage: 'final_exam' });
      }
      await loadBuilder(builder.module.id, { view: 'finalExam' });
    });
  };

  const handleDeleteCurrentSelection = async () => {
    if (!builder) return;
    await run(async () => {
      if (selection.view === 'lesson' && currentLesson) {
        await deleteLesson(currentLesson.id);
      } else if (selection.view === 'topic' && currentTopic) {
        await deleteTopic(currentTopic.id);
      } else if (selection.view === 'preTest' || selection.view === 'postTest' || selection.view === 'finalExam') {
        if (!currentQuiz) throw new Error('No assessment exists to delete.');
        await deleteQuiz(currentQuiz.id);
      } else {
        return;
      }
      await loadBuilder(builder.module.id);
    });
  };

  const saveCurrentLesson = async () => {
    if (!builder || !currentLesson) return;
    const lessonContentHtml = sanitizeRichHtml(lessonContentEditorRef.current?.innerHTML ?? currentLesson.overview_text ?? '');
    const normalizedLessonMedia = serializeLessonOverviewMediaUrls(getLessonOverviewMediaUrls(currentLesson));
    updateLessonLocal(currentLesson.id, { overview_text: lessonContentHtml });
    await run(async () => {
      await updateLesson(currentLesson.id, {
        title: currentLesson.title,
        summary: currentLesson.summary,
        estimatedMinutes: currentLesson.estimated_minutes,
        overviewText: lessonContentHtml,
        overviewImageUrl: normalizedLessonMedia,
        isPublished: currentLesson.is_published ?? true,
      });
      await loadBuilder(builder.module.id, { view: 'lesson', lessonId: currentLesson.id });
    });
  };

  const saveCurrentTopic = async () => {
    if (!builder || !currentTopic) return;
    for (const [index, section] of selectedTopicSections.entries()) {
      const sectionBodyHtml = sanitizeRichHtml(topicSectionEditorRefs.current[section.id]?.innerHTML ?? section.body_text ?? '');
      updateContentLocal(section.id, {
        title: `${currentTopic.title} - Section ${index + 1}`,
        body_text: sectionBodyHtml,
      });
    }
    await run(async () => {
      await updateTopic(currentTopic.id, {
        title: currentTopic.title,
        summary: currentTopic.summary,
        sortOrder: currentTopic.sort_order,
        isPublished: currentTopic.is_published,
      });
      for (const [index, section] of selectedTopicSections.entries()) {
        const sectionBodyHtml = sanitizeRichHtml(topicSectionEditorRefs.current[section.id]?.innerHTML ?? section.body_text ?? '');
        const sectionTemplate = getTopicTemplateFromBlock(section);
        await updateLessonContent(section.id, {
          topicId: currentTopic.id,
          contentType: section.content_type,
          title: `${currentTopic.title} - Section ${index + 1}`,
          bodyText: sectionBodyHtml,
          contentUrl: section.content_url ?? '',
          simulationKey: section.simulation_key ?? '',
          metadata: {
            ...readContentMetadata(section),
            template: sectionTemplate,
          },
          sortOrder: section.sort_order,
          isRequired: section.is_required,
        });
      }
      await loadBuilder(builder.module.id, { view: 'topic', lessonId: currentTopic.lesson_id, topicId: currentTopic.id });
    });
  };

  const createCurrentAssessment = async () => {
    if (!builder) return;
    await run(async () => {
      if (selection.view === 'preTest') {
        await createQuiz({ moduleId: builder.module.id, lessonId: null, title: 'Pre-Test', quizType: 'lesson_quiz', stage: 'pre_test' });
      } else if (selection.view === 'postTest') {
        await createQuiz({ moduleId: builder.module.id, lessonId: selection.lessonId, title: 'Post-Test', quizType: 'lesson_quiz', stage: 'post_test' });
      } else if (selection.view === 'finalExam') {
        await createQuiz({ moduleId: builder.module.id, lessonId: null, title: 'Final Exam', quizType: 'final_exam', stage: 'final_exam' });
      }
      await loadBuilder(builder.module.id, selection);
    });
  };

  const saveCurrentQuiz = async () => {
    if (!builder || !currentQuiz) return;
    await run(async () => {
      await updateQuiz(currentQuiz.id, {
        lessonId: currentQuiz.lesson_id,
        title: currentQuiz.title,
        quizType: currentQuiz.quiz_type,
        stage: currentQuiz.stage,
        passingScore: currentQuiz.passing_score,
        timeLimitMinutes: currentQuiz.time_limit_minutes,
        attemptLimit: currentQuiz.attempt_limit,
        isActive: currentQuiz.is_active,
      });
      await loadBuilder(builder.module.id, selection);
    });
  };

  const addQuestion = async (afterQuestion?: QuizQuestionRow) => {
    if (!builder || !currentQuiz) return;
    const sortedQuestions = [...selectedQuestions].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
    const insertAfterSort = afterQuestion ? afterQuestion.sort_order : sortedQuestions.at(-1)?.sort_order ?? 0;
    const nextSortOrder = insertAfterSort + 1;
    const nextQuestionNumber = sortedQuestions.length + 1;
    await run(async () => {
      const questionsToShift = sortedQuestions.filter((question) => question.sort_order >= nextSortOrder);
      if (questionsToShift.length > 0) {
        await Promise.all(
          questionsToShift.map((question) =>
            updateQuizQuestion(question.id, {
              sortOrder: question.sort_order + 1,
            })
          )
        );
      }
      const created = await createQuizQuestion(currentQuiz.id, {
        prompt: `New Question ${nextQuestionNumber}`,
        questionType: 'single_choice',
        points: 1,
        sortOrder: nextSortOrder,
      });
      for (let i = 0; i < 4; i += 1) {
        await createQuestionAnswer(created.id, {
          answerText: `Choice ${i + 1}`,
          isCorrect: i === 0,
          sortOrder: i + 1,
        });
      }
      await loadBuilder(builder.module.id, selection);
    });
  };

  const saveAllQuestions = async () => {
    if (!builder || !currentQuiz) return;
    const questions = selectedQuestions;
    if (questions.length === 0) return;

    for (const question of questions) {
      const answers = answersByQuestion.get(question.id) ?? [];
      if (!answers.length) {
        setError('Each question needs at least one choice.');
        return;
      }
      if (!answers.some((answer) => Boolean(answer.is_correct))) {
        setError('At least one correct choice must be selected for every question.');
        return;
      }
    }

    await run(async () => {
      await Promise.all(
        questions.map((question) =>
          updateQuizQuestion(question.id, {
            prompt: question.prompt,
            questionType: normalizeQuestionType(question.question_type),
            points: question.points,
            sortOrder: question.sort_order,
          })
        )
      );

      const answerUpdates: Promise<unknown>[] = [];
      for (const question of questions) {
        const answers = answersByQuestion.get(question.id) ?? [];
        for (const answer of answers) {
          answerUpdates.push(
            updateQuestionAnswer(question.id, answer.id, {
              answerText: answer.answer_text,
              isCorrect: Boolean(answer.is_correct),
              explanation: answer.explanation ?? '',
              sortOrder: answer.sort_order,
            })
          );
        }
      }
      await Promise.all(answerUpdates);
      await loadBuilder(builder.module.id, selection);
    });
  };

  const removeQuestion = async (questionId: number) => {
    if (!builder) return;
    await run(async () => {
      await deleteQuizQuestion(questionId);
      await loadBuilder(builder.module.id, selection);
    });
  };

  const toggleCorrectAnswerLocally = (questionId: number, answerId: number) => {
    setBuilder((prev) => {
      if (!prev) return prev;
      const questionType = normalizeQuestionType(prev.questions.find((question) => question.id === questionId)?.question_type);

      if (questionType === 'single_choice') {
        return {
          ...prev,
          answers: prev.answers.map((answer) => {
            if (answer.question_id !== questionId) return answer;
            return { ...answer, is_correct: answer.id === answerId };
          }),
        };
      }

      return {
        ...prev,
        answers: prev.answers.map((answer) => {
          if (answer.question_id !== questionId || answer.id !== answerId) return answer;
          return { ...answer, is_correct: !Boolean(answer.is_correct) };
        }),
      };
    });
  };

  const removeAnswer = async (questionId: number, answerId: number) => {
    if (!builder) return;
    const answers = answersByQuestion.get(questionId) ?? [];
    if (answers.length <= 2) {
      setError('Each question must keep at least two choices.');
      return;
    }
    await run(async () => {
      await deleteQuestionAnswer(questionId, answerId);
      await loadBuilder(builder.module.id, selection);
    });
  };

  const addChoice = async (questionId: number) => {
    if (!builder) return;
    const answers = answersByQuestion.get(questionId) ?? [];
    const nextSortOrder = answers.length + 1;
    await run(async () => {
      await createQuestionAnswer(questionId, {
        answerText: `Choice ${nextSortOrder}`,
        isCorrect: answers.length === 0,
        sortOrder: nextSortOrder,
      });
      await loadBuilder(builder.module.id, selection);
    });
  };

  const addLessonMedia = async (file: File) => {
    if (!currentLesson) return;
    const currentMediaUrls = getLessonOverviewMediaUrls(currentLesson);
    if (currentMediaUrls.length >= MAX_LESSON_MEDIA_ITEMS) {
      throw new Error(`You can upload up to ${MAX_LESSON_MEDIA_ITEMS} lesson media files only.`);
    }
    const dataUrl = await toDataUrl(file);
    const nextMediaUrls = [...currentMediaUrls, dataUrl].slice(0, MAX_LESSON_MEDIA_ITEMS);
    updateLessonLocal(currentLesson.id, {
      overview_image_url: serializeLessonOverviewMediaUrls(nextMediaUrls),
    });
  };

  const removeLessonMediaAt = (mediaIndex: number) => {
    if (!currentLesson) return;
    const currentMediaUrls = getLessonOverviewMediaUrls(currentLesson);
    if (mediaIndex < 0 || mediaIndex >= currentMediaUrls.length) return;
    const nextMediaUrls = currentMediaUrls.filter((_, index) => index !== mediaIndex);
    updateLessonLocal(currentLesson.id, {
      overview_image_url: serializeLessonOverviewMediaUrls(nextMediaUrls),
    });
  };

  const uploadTopicMedia = async (section: LessonContentBlock, file: File, sectionIndex: number) => {
    if (!builder || !currentTopic) return;
    const dataUrl = await toDataUrl(file);
    const contentType: LessonContentBlock['content_type'] = file.type.startsWith('video/') ? 'video' : 'image';
    const topicContentHtml = sanitizeRichHtml(topicSectionEditorRefs.current[section.id]?.innerHTML ?? section.body_text ?? '');

    updateContentLocal(section.id, {
      title: `${currentTopic.title} - Section ${sectionIndex + 1}`,
      body_text: topicContentHtml,
      content_type: contentType,
      content_url: dataUrl,
    });

    await run(async () => {
      await updateLessonContent(section.id, {
        topicId: currentTopic.id,
        contentType,
        title: `${currentTopic.title} - Section ${sectionIndex + 1}`,
        bodyText: topicContentHtml,
        contentUrl: dataUrl,
        simulationKey: section.simulation_key ?? '',
        metadata: {
          ...readContentMetadata(section),
          template: getTopicTemplateFromBlock(section),
        },
        sortOrder: section.sort_order,
        isRequired: section.is_required,
      });
      await loadBuilder(builder.module.id, { view: 'topic', lessonId: currentTopic.lesson_id, topicId: currentTopic.id });
    });
  };

  const removeTopicMedia = async (section: LessonContentBlock, sectionIndex: number) => {
    if (!builder || !currentTopic) return;
    const topicContentHtml = sanitizeRichHtml(topicSectionEditorRefs.current[section.id]?.innerHTML ?? section.body_text ?? '');

    updateContentLocal(section.id, {
      title: `${currentTopic.title} - Section ${sectionIndex + 1}`,
      body_text: topicContentHtml,
      content_type: 'text',
      content_url: '',
    });

    await run(async () => {
      await updateLessonContent(section.id, {
        topicId: currentTopic.id,
        contentType: 'text',
        title: `${currentTopic.title} - Section ${sectionIndex + 1}`,
        bodyText: topicContentHtml,
        contentUrl: '',
        simulationKey: section.simulation_key ?? '',
        metadata: {
          ...readContentMetadata(section),
          template: getTopicTemplateFromBlock(section),
        },
        sortOrder: section.sort_order,
        isRequired: section.is_required,
      });
      await loadBuilder(builder.module.id, { view: 'topic', lessonId: currentTopic.lesson_id, topicId: currentTopic.id });
    });
  };

  const addTopicSection = async () => {
    if (!builder || !currentTopic) return;
    const nextSectionNumber = selectedTopicSections.length + 1;
    const nextSortOrder = (selectedTopicSections.at(-1)?.sort_order ?? 0) + 1;
    await run(async () => {
      await createLessonContent({
        topicId: currentTopic.id,
        contentType: 'text',
        title: `${currentTopic.title} - Section ${nextSectionNumber}`,
        bodyText: '',
        metadata: { template: 'template-1' },
        sortOrder: nextSortOrder,
      });
      await loadBuilder(builder.module.id, { view: 'topic', lessonId: currentTopic.lesson_id, topicId: currentTopic.id });
    });
  };

  const removeTopicSection = async (sectionId: number) => {
    if (!builder || !currentTopic) return;
    await run(async () => {
      await deleteLessonContent(sectionId);
      await loadBuilder(builder.module.id, { view: 'topic', lessonId: currentTopic.lesson_id, topicId: currentTopic.id });
    });
  };

  const moveTopicSectionLocally = (sectionId: number, direction: 'up' | 'down') => {
    if (!currentTopic) return;

    setBuilder((prev) => {
      if (!prev) return prev;

      const topicSections = prev.content
        .filter((content) => content.topic_id === currentTopic.id)
        .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);

      const currentIndex = topicSections.findIndex((section) => section.id === sectionId);
      if (currentIndex === -1) return prev;

      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= topicSections.length) return prev;

      const reordered = [...topicSections];
      const [movedSection] = reordered.splice(currentIndex, 1);
      reordered.splice(targetIndex, 0, movedSection);

      const nextOrderById = new Map<number, number>();
      reordered.forEach((section, index) => {
        nextOrderById.set(section.id, index + 1);
      });

      return {
        ...prev,
        content: prev.content.map((content) =>
          content.topic_id === currentTopic.id && nextOrderById.has(content.id)
            ? { ...content, sort_order: nextOrderById.get(content.id) ?? content.sort_order }
            : content
        ),
      };
    });
  };

  const getSelectionRangeInsideEditor = (editor: HTMLElement): Range | null => {
    const selectionRange = window.getSelection();
    if (!selectionRange || selectionRange.rangeCount === 0) return null;
    const range = selectionRange.getRangeAt(0);
    if (!editor.contains(range.startContainer) || !editor.contains(range.endContainer)) return null;
    return range;
  };

  const restoreSelectionRange = (range: Range | null) => {
    if (!range) return false;
    const selectionRange = window.getSelection();
    if (!selectionRange) return false;
    selectionRange.removeAllRanges();
    selectionRange.addRange(range);
    return true;
  };

  const rememberLessonEditorSelection = () => {
    const editor = lessonContentEditorRef.current;
    if (!editor) {
      lessonSelectionRangeRef.current = null;
      return;
    }
    const range = getSelectionRangeInsideEditor(editor);
    lessonSelectionRangeRef.current = range ? range.cloneRange() : null;
  };

  const rememberTopicEditorSelection = (sectionId: number) => {
    const editor = topicSectionEditorRefs.current[sectionId];
    if (!editor) {
      topicSelectionRangeRefs.current[sectionId] = null;
      return;
    }
    const range = getSelectionRangeInsideEditor(editor);
    topicSelectionRangeRefs.current[sectionId] = range ? range.cloneRange() : null;
  };

  const preventToolbarButtonBlur = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
  };

  const applyLessonContentCommand = (command: string, value?: string) => {
    const editor = lessonContentEditorRef.current;
    if (!editor) return;

    editor.focus();
    restoreSelectionRange(lessonSelectionRangeRef.current);
    const currentRange = getSelectionRangeInsideEditor(editor);
    if (!currentRange || currentRange.collapsed) {
      setError('Highlight text first before using formatting tools.');
      return;
    }

    document.execCommand(command, false, value ?? null);
    setError('');
    rememberLessonEditorSelection();
  };

  const applyTopicContentCommand = (sectionId: number, command: string, value?: string) => {
    const editor = topicSectionEditorRefs.current[sectionId];
    if (!editor) return;

    editor.focus();
    restoreSelectionRange(topicSelectionRangeRefs.current[sectionId] ?? null);
    const currentRange = getSelectionRangeInsideEditor(editor);
    if (!currentRange || currentRange.collapsed) {
      setError('Highlight text first before using formatting tools.');
      return;
    }

    document.execCommand(command, false, value ?? null);
    setError('');
    rememberTopicEditorSelection(sectionId);
  };

  const openPreview = () => {
    setPreviewSelection(selection);
    setShowPreviewModal(true);
  };

  const previewNodeLabel = sequence[previewIndex]?.label ?? 'Preview';
  const previewCurrentQuiz =
    previewSelection.view === 'preTest'
      ? preQuiz
      : previewSelection.view === 'finalExam'
        ? finalQuiz
        : previewSelection.view === 'postTest'
          ? postQuizByLesson.get(previewSelection.lessonId) ?? null
          : null;
  const previewCurrentLesson =
    previewSelection.view === 'lesson' || previewSelection.view === 'topic' || previewSelection.view === 'postTest'
      ? lessons.find((lesson) => lesson.id === previewSelection.lessonId) ?? null
      : null;
  const previewCurrentLessonMediaUrls = getLessonOverviewMediaUrls(previewCurrentLesson);
  const previewCurrentTopic =
    previewSelection.view === 'topic' ? builder?.topics.find((topic) => topic.id === previewSelection.topicId) ?? null : null;
  const previewTopicSections = previewCurrentTopic ? contentByTopic.get(previewCurrentTopic.id) ?? [] : [];
  const previewLessonTopics = previewCurrentLesson
    ? builder?.topics.filter((topic) => topic.lesson_id === previewCurrentLesson.id).sort((a, b) => a.sort_order - b.sort_order)
    : [];

  const previewCompletionPercent = builder?.lessons?.length
    ? Math.round((builder.lessons.filter((lesson) => lesson.completed).length / builder.lessons.length) * 100)
    : 0;

  const previewPageTitle =
    previewSelection.view === 'lesson' && previewCurrentLesson
      ? `Lesson ${previewCurrentLesson.sequence_no} - ${previewCurrentLesson.title}`
      : previewSelection.view === 'topic' && previewCurrentTopic
      ? `Topic - ${previewCurrentTopic.title}`
      : previewSelection.view === 'preTest'
      ? 'Pre-Test'
      : previewSelection.view === 'postTest'
      ? 'Post-Test'
      : previewSelection.view === 'finalExam'
      ? 'Final Exam'
      : 'Preview';

  const previewPageSummary =
    previewSelection.view === 'lesson' && previewCurrentLesson
      ? previewCurrentLesson.summary
      : previewSelection.view === 'topic' && previewCurrentTopic
      ? previewCurrentTopic.summary
      : previewCurrentQuiz
      ? `Passing ${previewCurrentQuiz.passing_score}%, ${previewCurrentQuiz.time_limit_minutes} min, ${previewCurrentQuiz.attempt_limit} attempts`
      : 'Choose a lesson, topic, or assessment to preview.';

  const getSequenceLabel = (item: typeof sequence[number]) => {
    if (item.selection.view === 'preTest') return 'Pre-Test';
    if (item.selection.view === 'postTest') return 'Post-Test';
    if (item.selection.view === 'finalExam') return 'Simulation';
    return 'Lesson';
  };

  return (
    <section className="space-y-5">
      {error ? <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}

      {!builder ? (
        <div className="space-y-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">Modules</h2>
              <p className="mt-1 text-sm text-slate-300">Create modules, update module details, and open the full builder.</p>
            </div>
            <div className="flex w-full items-center gap-2 sm:flex-nowrap sm:justify-end lg:w-auto">
              <div className="relative w-full sm:w-[340px]">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="w-full rounded-lg border border-white/20 bg-slate-900/70 py-2.5 pl-9 pr-3 text-sm text-slate-200"
                  placeholder="Search modules..."
                />
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex shrink-0 items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500"
              >
                <Plus size={16} />
                Create Module
              </button>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
            {filteredModules.map((module) => (
              <article key={module.id} className="flex h-full flex-col rounded-xl border border-white/10 bg-slate-900/70 p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-200">
                    {normalizeModuleCategory(module.category)}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => openModuleEdit(module)}
                      aria-label={`Edit module ${module.title}`}
                      title="Edit module"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/20 text-slate-200 transition hover:bg-white/10"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => void handleDeleteModule(module)}
                      aria-label={`Delete module ${module.title}`}
                      title="Delete module"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-rose-400/40 text-rose-200 transition hover:bg-rose-500/10"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="mb-3 mt-3 aspect-video w-full overflow-hidden rounded-md border border-white/10 bg-white/5">
                  {module.thumbnail_url ? (
                    <img src={module.thumbnail_url} alt={module.title} className="h-full w-full object-contain" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs font-semibold uppercase tracking-wider text-slate-400">No Thumbnail</div>
                  )}
                </div>
                <h4 className="text-lg font-bold text-white">{module.title}</h4>
                <p className="mt-2 flex-1 text-sm text-slate-300">{module.description}</p>
                <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                  <span className={`rounded-full px-2 py-0.5 ${module.is_active ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-500/15 text-slate-300'}`}>
                    {module.is_active ? 'Published' : 'Draft'}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 ${module.is_locked ? 'bg-amber-500/15 text-amber-200' : 'bg-brand-500/15 text-brand-200'}`}>
                    {module.is_locked ? 'Locked' : 'Unlocked'}
                  </span>
                </div>
                <a
                  href={`/admin/modules?builder=1&moduleId=${module.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center justify-center rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-500"
                >
                  Open Builder
                </a>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {builder ? (
        <div className="space-y-3">
          <div className="flex h-12 items-center gap-3 rounded-xl border border-white/10 bg-slate-900/80 px-4">
            <p className="text-sm font-semibold text-brand-300">Module Builder</p>
            <div className="h-5 w-px bg-white/10" />
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <span className="text-slate-300">Modules</span>
              <span>/</span>
              <span className="text-slate-300">{builder.module.title}</span>
              <span>/</span>
              <span className="font-medium text-slate-100">{currentBuilderLabel}</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                  builder.module.is_active
                    ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
                    : 'border-amber-400/30 bg-amber-500/10 text-amber-200'
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${builder.module.is_active ? 'bg-emerald-300' : 'bg-amber-300'}`} />
                {builder.module.is_active ? 'Published' : 'Draft'}
              </span>
              <button
                onClick={openPreview}
                disabled={totalPages === 0}
                className="inline-flex items-center gap-1 rounded-md border border-brand-400/40 px-3 py-1.5 text-xs font-semibold text-brand-300 hover:bg-brand-500/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Eye size={13} />
                Preview
              </button>
              <button onClick={closeBuilderView} className="inline-flex items-center gap-1 rounded-md border border-white/20 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/10"><ArrowLeft size={13} />Back</button>
            </div>
          </div>

          <div className="flex h-[calc(100vh-6rem)] min-h-[760px] overflow-hidden rounded-xl border border-white/10 bg-slate-900/70">
            <aside className="flex w-[300px] shrink-0 flex-col border-r border-white/10 bg-slate-950/80">
              <div className="border-b border-white/10 px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Module Structure</p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full rounded-full bg-brand-500" style={{ width: `${builderProgressPercent}%` }} />
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  {totalPages > 0 ? `${currentPageNumber} of ${totalPages} pages` : 'No pages yet'}
                </p>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
                {preQuiz ? (
                  <button onClick={() => setSelection({ view: 'preTest' })} className={`w-full rounded-md px-3 py-2 text-left text-sm ${selection.view === 'preTest' ? 'bg-violet-500/20 text-violet-100' : 'text-slate-300 hover:bg-white/10'}`}>Pre-Test</button>
                ) : null}
                {lessons.map((lesson) => (
                  <div key={lesson.id} className="space-y-1">
                    <p className="px-2 pt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Lesson {lesson.sequence_no}</p>
                    <button onClick={() => setSelection({ view: 'lesson', lessonId: lesson.id })} className={`w-full rounded-md px-3 py-2 text-left text-sm ${selection.view === 'lesson' && selection.lessonId === lesson.id ? 'bg-brand-500 text-slate-950 font-semibold' : 'text-slate-200 hover:bg-white/10'}`}>
                      {lesson.title}
                    </button>
                    <div className="space-y-1 border-l border-white/10 pl-3">
                      {(topicsByLesson.get(lesson.id) ?? []).map((topic) => (
                        <button key={topic.id} onClick={() => setSelection({ view: 'topic', lessonId: lesson.id, topicId: topic.id })} className={`block w-full rounded-md px-2 py-1.5 text-left text-xs ${selection.view === 'topic' && selection.topicId === topic.id ? 'bg-emerald-500/25 text-emerald-100' : 'text-slate-300 hover:bg-white/10'}`}>
                          Topic {topic.sort_order}: {topic.title}
                        </button>
                      ))}
                      {postQuizByLesson.get(lesson.id) ? (
                        <button onClick={() => setSelection({ view: 'postTest', lessonId: lesson.id })} className={`block w-full rounded-md px-2 py-1.5 text-left text-xs ${selection.view === 'postTest' && selection.lessonId === lesson.id ? 'bg-orange-500/25 text-orange-100' : 'text-slate-300 hover:bg-white/10'}`}>Post-Test</button>
                      ) : null}
                    </div>
                  </div>
                ))}
                {finalQuiz ? (
                  <button onClick={() => setSelection({ view: 'finalExam' })} className={`w-full rounded-md px-3 py-2 text-left text-sm ${selection.view === 'finalExam' ? 'bg-amber-500/20 text-amber-100' : 'text-amber-200 hover:bg-amber-500/10'}`}>Final Exam</button>
                ) : null}
              </div>

              <div className="space-y-1 border-t border-white/10 px-3 py-3">
                <button onClick={() => openAddNodeModal('lesson')} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-semibold text-brand-300 hover:bg-brand-500/10"><Plus size={13} />Add Lesson</button>
                <button onClick={() => openAddNodeModal('topic')} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10"><Plus size={13} />Add Topic</button>
                <button onClick={() => openAddNodeModal('preTest')} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-semibold text-violet-300 hover:bg-violet-500/10"><Plus size={13} />Add Pre-Test</button>
                <button onClick={() => openAddNodeModal('postTest')} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-semibold text-orange-300 hover:bg-orange-500/10"><Plus size={13} />Add Post-Test</button>
                <button onClick={() => void handleAddFinalExam()} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/10"><Plus size={13} />Add Final Exam</button>
              </div>
            </aside>

            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <div className="flex h-11 items-center justify-between border-b border-white/10 bg-slate-900/80 px-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex max-w-[220px] items-center gap-1 overflow-x-auto pr-1">
                    {sequence.map((item, index) => (
                      <button
                        key={`${selectionKey(item.selection)}-${index}`}
                        type="button"
                        onClick={() => setSelection(item.selection)}
                        className={`h-1.5 rounded-full transition-all ${index === selectionIndex ? 'w-7 bg-brand-500' : 'w-5 bg-slate-700 hover:bg-slate-500'}`}
                        aria-label={`Go to ${item.label}`}
                      />
                    ))}
                  </div>
                  <p className="truncate text-xs text-slate-400">
                    Page <span className="font-semibold text-slate-100">{currentPageNumber || '-'}</span> of{' '}
                    <span className="font-semibold text-slate-100">{totalPages || '-'}</span> -{' '}
                    <span className="font-semibold text-slate-100">{currentBuilderLabel}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button disabled={selectionIndex <= 0} onClick={() => { const previous = sequence[selectionIndex - 1]; if (previous) setSelection(previous.selection); }} className="inline-flex items-center gap-1 rounded-md border border-white/15 px-2.5 py-1 text-xs font-semibold text-slate-200 disabled:opacity-40"><ChevronLeft size={13} />Previous</button>
                  <button disabled={selectionIndex < 0 || selectionIndex >= totalPages - 1} onClick={() => { const next = sequence[selectionIndex + 1]; if (next) setSelection(next.selection); }} className="inline-flex items-center gap-1 rounded-md border border-white/15 px-2.5 py-1 text-xs font-semibold text-slate-200 disabled:opacity-40">Next<ChevronRight size={13} /></button>
                  <button onClick={() => void handleDeleteCurrentSelection()} className="inline-flex items-center gap-1 rounded-md border border-rose-400/40 px-2.5 py-1 text-xs font-semibold text-rose-200 hover:bg-rose-500/10"><Trash2 size={13} />Delete</button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-5">
                <div className="space-y-5">
                  {selection.view === 'lesson' && currentLesson ? (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Lesson Editor</p>
                          <p className="mt-1 text-sm text-slate-300">Edit lesson title, duration, content, and media.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void saveCurrentLesson()}
                          className="rounded-full bg-brand-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-brand-400"
                        >
                          Save Lesson
                        </button>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-4 rounded-xl border border-white/10 bg-slate-950/40 p-4">
                          <div className="grid gap-3 md:grid-cols-2">
                            <label className="space-y-1"><span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Lesson Title</span><input value={currentLesson.title} onChange={(event) => updateLessonLocal(currentLesson.id, { title: event.target.value })} className="w-full rounded-md border border-white/15 bg-slate-900/70 px-3 py-2 text-sm text-slate-100" /></label>
                            <label className="space-y-1"><span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Estimated Minutes</span><input type="number" min={1} value={currentLesson.estimated_minutes} onChange={(event) => updateLessonLocal(currentLesson.id, { estimated_minutes: Number(event.target.value) || 1 })} className="w-full rounded-md border border-white/15 bg-slate-900/70 px-3 py-2 text-sm text-slate-100" /></label>
                          </div>
                          <label className="space-y-1">
                            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Lesson Content</span>
                            <div className="flex h-[min(61vh,760px)] min-h-[520px] flex-col overflow-hidden rounded-md border border-white/15 bg-slate-900/70">
                              <div className="flex flex-wrap items-center gap-2 border-b border-white/10 p-2">
                                <div className={editorToolbarGroupClass}>
                                  <button type="button" onMouseDown={preventToolbarButtonBlur} onClick={() => applyLessonContentCommand('bold')} className={editorToolbarButtonClass}>B</button>
                                  <button type="button" onMouseDown={preventToolbarButtonBlur} onClick={() => applyLessonContentCommand('italic')} className={`${editorToolbarButtonClass} italic`}>I</button>
                                  <button type="button" onMouseDown={preventToolbarButtonBlur} onClick={() => applyLessonContentCommand('underline')} className={`${editorToolbarButtonClass} underline`}>U</button>
                                </div>
                                <div className={editorToolbarGroupClass}>
                                  <button
                                    type="button"
                                    onMouseDown={preventToolbarButtonBlur}
                                    onClick={() => applyLessonContentCommand('insertUnorderedList')}
                                    className={editorToolbarIconButtonClass}
                                    title="Bulleted list"
                                    aria-label="Bulleted list"
                                  >
                                    <List size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    onMouseDown={preventToolbarButtonBlur}
                                    onClick={() => applyLessonContentCommand('insertOrderedList')}
                                    className={editorToolbarIconButtonClass}
                                    title="Numbered list"
                                    aria-label="Numbered list"
                                  >
                                    <ListOrdered size={14} />
                                  </button>
                                </div>
                                <div className={editorToolbarGroupClass}>
                                  <button
                                    type="button"
                                    onMouseDown={preventToolbarButtonBlur}
                                    onClick={() => applyLessonContentCommand('justifyLeft')}
                                    className={editorToolbarIconButtonClass}
                                    title="Align left"
                                    aria-label="Align left"
                                  >
                                    <AlignLeft size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    onMouseDown={preventToolbarButtonBlur}
                                    onClick={() => applyLessonContentCommand('justifyCenter')}
                                    className={editorToolbarIconButtonClass}
                                    title="Align center"
                                    aria-label="Align center"
                                  >
                                    <AlignCenter size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    onMouseDown={preventToolbarButtonBlur}
                                    onClick={() => applyLessonContentCommand('justifyRight')}
                                    className={editorToolbarIconButtonClass}
                                    title="Align right"
                                    aria-label="Align right"
                                  >
                                    <AlignRight size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    onMouseDown={preventToolbarButtonBlur}
                                    onClick={() => applyLessonContentCommand('justifyFull')}
                                    className={editorToolbarIconButtonClass}
                                    title="Justify"
                                    aria-label="Justify"
                                  >
                                    <AlignJustify size={14} />
                                  </button>
                                </div>
                                <div className={editorToolbarGroupClass}>
                                  <select
                                    defaultValue=""
                                    onMouseDown={rememberLessonEditorSelection}
                                    onChange={(event) => {
                                      const value = event.target.value;
                                      if (!value) return;
                                      applyLessonContentCommand('fontSize', value);
                                      event.target.value = '';
                                    }}
                                    className={editorToolbarSelectClass}
                                  >
                                    <option value="">Size</option>
                                    <option value="2">Small</option>
                                    <option value="3">Normal</option>
                                    <option value="5">Large</option>
                                    <option value="6">X-Large</option>
                                  </select>
                                  <select
                                    defaultValue=""
                                    onMouseDown={rememberLessonEditorSelection}
                                    onChange={(event) => {
                                      const value = event.target.value;
                                      if (!value) return;
                                      applyLessonContentCommand('foreColor', value);
                                      event.target.value = '';
                                    }}
                                    className={editorToolbarSelectClass}
                                  >
                                    <option value="">Color</option>
                                    <option value="#f5c800">Yellow</option>
                                    <option value="#4a8fe8">Blue</option>
                                    <option value="#4caf7d">Green</option>
                                    <option value="#e05c5c">Red</option>
                                    <option value="#e8eaf0">White</option>
                                  </select>
                                  <button type="button" onMouseDown={preventToolbarButtonBlur} onClick={() => applyLessonContentCommand('removeFormat')} className={editorToolbarButtonClass}>Clear</button>
                                </div>
                              </div>
                              <div
                                ref={lessonContentEditorRef}
                                contentEditable
                                suppressContentEditableWarning
                                onFocus={rememberLessonEditorSelection}
                                onMouseUp={rememberLessonEditorSelection}
                                onKeyUp={rememberLessonEditorSelection}
                                onBlur={(event) => {
                                  rememberLessonEditorSelection();
                                  updateLessonLocal(currentLesson.id, { overview_text: sanitizeRichHtml(event.currentTarget.innerHTML) });
                                }}
                                className="flex-1 overflow-y-auto p-3 text-sm text-slate-100 outline-none"
                              />
                            </div>
                          </label>
                        </div>

                        <div className="space-y-2 rounded-xl border border-white/10 bg-slate-950/40 p-4">
                          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Lesson Media</span>
                          <p className="text-xs text-slate-400">Upload up to {MAX_LESSON_MEDIA_ITEMS} image/video items used in the lesson preview.</p>
                          <div className="space-y-3">
                            {currentLessonMediaUrls.length === 0 ? (
                              <p className="text-xs text-slate-500">No media uploaded yet.</p>
                            ) : null}

                            <div className="flex gap-3 overflow-x-auto pb-1">
                              {currentLessonMediaUrls.map((mediaUrl, mediaIndex) => (
                                <div key={`${mediaUrl}-${mediaIndex}`} className="relative w-[320px] shrink-0 overflow-hidden rounded-md border border-white/15 bg-slate-900/70 p-2">
                                  <button
                                    type="button"
                                    onClick={() => removeLessonMediaAt(mediaIndex)}
                                    className="absolute right-3 top-3 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/30 bg-slate-950/85 text-slate-200 transition hover:border-rose-300/70 hover:text-rose-200"
                                    title="Remove media"
                                    aria-label={`Remove media ${mediaIndex + 1}`}
                                  >
                                    <X size={13} />
                                  </button>
                                  <div className="flex h-[220px] items-center justify-center rounded-md border border-white/10 bg-black/30 p-2">
                                    {isVideoMediaUrl(mediaUrl) ? (
                                      <video src={mediaUrl} controls className="max-h-[220px] w-full rounded-md object-contain" />
                                    ) : (
                                      <img src={mediaUrl} alt={`${currentLesson.title} media ${mediaIndex + 1}`} className="max-h-[220px] w-full rounded-md object-contain" />
                                    )}
                                  </div>
                                </div>
                              ))}

                              {currentLessonMediaUrls.length < MAX_LESSON_MEDIA_ITEMS ? (
                                <label
                                  onDragOver={(event) => {
                                    event.preventDefault();
                                  }}
                                  onDrop={(event) => {
                                    event.preventDefault();
                                    const file = event.dataTransfer.files?.[0];
                                    if (!file) return;
                                    void run(async () => {
                                      await addLessonMedia(file);
                                    });
                                  }}
                                  className="flex h-[236px] w-[320px] shrink-0 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-white/25 bg-slate-900/60 p-6 text-center hover:border-brand-400/70 hover:bg-slate-900/80"
                                >
                                  <Plus size={24} className="text-slate-200" />
                                  <p className="text-sm font-semibold text-slate-200">Add Photo/Video</p>
                                  <p className="text-xs text-slate-400">PNG, JPG, WEBP, GIF, MP4, WEBM</p>
                                  <input
                                    type="file"
                                    accept="image/*,video/*"
                                    className="hidden"
                                    onChange={(event) => {
                                      const file = event.target.files?.[0];
                                      if (!file) return;
                                      void run(async () => {
                                        await addLessonMedia(file);
                                      });
                                      event.target.value = '';
                                    }}
                                  />
                                </label>
                              ) : null}
                            </div>

                            {currentLessonMediaUrls.length >= MAX_LESSON_MEDIA_ITEMS ? (
                              <p className="text-xs text-amber-300/90">Maximum of {MAX_LESSON_MEDIA_ITEMS} lesson media items reached.</p>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {selection.view === 'topic' && currentTopic ? (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Topic Editor</p>
                          <p className="mt-1 text-sm text-slate-300">Manage topic metadata and section layout/content.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void saveCurrentTopic()}
                          className="rounded-full bg-brand-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-brand-400"
                        >
                          Save Topic
                        </button>
                      </div>

                      <div className="space-y-4 rounded-xl border border-white/10 bg-slate-950/40 p-4">
                        <div className="grid gap-3 md:grid-cols-2">
                        <label className="space-y-1"><span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Topic Title</span><input value={currentTopic.title} onChange={(event) => updateTopicLocal(currentTopic.id, { title: event.target.value })} className="w-full rounded-md border border-white/15 bg-slate-900/70 px-3 py-2 text-sm text-slate-100" /></label>
                        <label className="space-y-1"><span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Topic Order</span><input type="number" min={1} value={currentTopic.sort_order} onChange={(event) => updateTopicLocal(currentTopic.id, { sort_order: Number(event.target.value) || 1 })} className="w-full rounded-md border border-white/15 bg-slate-900/70 px-3 py-2 text-sm text-slate-100" /></label>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Topic Sections</span>
                          <button
                            type="button"
                            onClick={() => void addTopicSection()}
                            className="inline-flex items-center gap-1 rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/10"
                          >
                            <Plus size={14} />
                            Add Section
                          </button>
                        </div>

                        {selectedTopicSections.length === 0 ? (
                          <div className="rounded-md border border-dashed border-white/20 bg-slate-900/40 p-4 text-center">
                            <p className="text-sm text-slate-300">No topic sections yet. Click Add Section to create your first content block.</p>
                          </div>
                        ) : null}

                        {selectedTopicSections.map((section, sectionIndex) => {
                          const sectionTemplate = getTopicTemplateFromBlock(section);
                          const sectionMediaUrl = getRenderableMediaUrl(section);
                          const hasSectionMedia = Boolean(sectionMediaUrl);
                          return (
                            <div
                              key={section.id}
                              className={`space-y-3 overflow-hidden rounded-xl border ${
                                activeTopicSectionId === section.id
                                  ? 'border-brand-400/50 bg-slate-900/70'
                                  : 'border-white/10 bg-slate-900/45'
                              }`}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-slate-900/70 px-3 py-2">
                                <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                                  Section {sectionIndex + 1}
                                </span>
                                <div className="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateContentLocal(section.id, {
                                        metadata: {
                                          ...readContentMetadata(section),
                                          template: 'template-1',
                                        },
                                        })
                                    }
                                    className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-md border px-3 text-[11px] font-medium transition ${
                                      sectionTemplate === 'template-1'
                                        ? 'border-brand-400/70 bg-brand-500/15 text-brand-100'
                                        : 'border-white/15 bg-slate-950/50 text-slate-400 hover:border-white/30 hover:text-slate-200'
                                    }`}
                                  >
                                    <span className="flex h-5 w-8 shrink-0 overflow-hidden rounded-sm border border-current/40">
                                      <span className="m-[2px] flex-[2] rounded-[2px] bg-current/35" />
                                      <span className="m-[2px] ml-0 flex-1 rounded-[2px] bg-current/20" />
                                    </span>
                                    <span className="whitespace-nowrap">Media Right</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateContentLocal(section.id, {
                                        metadata: {
                                          ...readContentMetadata(section),
                                          template: 'template-2',
                                        },
                                        })
                                    }
                                    className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-md border px-3 text-[11px] font-medium transition ${
                                      sectionTemplate === 'template-2'
                                        ? 'border-brand-400/70 bg-brand-500/15 text-brand-100'
                                        : 'border-white/15 bg-slate-950/50 text-slate-400 hover:border-white/30 hover:text-slate-200'
                                    }`}
                                  >
                                    <span className="flex h-5 w-8 shrink-0 flex-col overflow-hidden rounded-sm border border-current/40 p-[2px]">
                                      <span className="h-1/2 rounded-[2px] bg-current/35" />
                                      <span className="mt-[2px] h-1/2 rounded-[2px] bg-current/20" />
                                    </span>
                                    <span className="whitespace-nowrap">Stacked</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateContentLocal(section.id, {
                                        metadata: {
                                          ...readContentMetadata(section),
                                          template: 'template-3',
                                        },
                                        })
                                    }
                                    className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-md border px-3 text-[11px] font-medium transition ${
                                      sectionTemplate === 'template-3'
                                        ? 'border-brand-400/70 bg-brand-500/15 text-brand-100'
                                        : 'border-white/15 bg-slate-950/50 text-slate-400 hover:border-white/30 hover:text-slate-200'
                                    }`}
                                  >
                                    <span className="flex h-5 w-8 shrink-0 overflow-hidden rounded-sm border border-current/40">
                                      <span className="m-[2px] flex-1 rounded-[2px] bg-current/20" />
                                      <span className="m-[2px] ml-0 flex-[2] rounded-[2px] bg-current/35" />
                                    </span>
                                    <span className="whitespace-nowrap">Media Left</span>
                                  </button>
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => moveTopicSectionLocally(section.id, 'up')}
                                      disabled={sectionIndex === 0}
                                      className="inline-flex h-8 items-center rounded-md border border-transparent px-2.5 text-xs text-slate-500 hover:border-white/15 hover:bg-slate-800/70 hover:text-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                      Up
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => moveTopicSectionLocally(section.id, 'down')}
                                      disabled={sectionIndex === selectedTopicSections.length - 1}
                                      className="inline-flex h-8 items-center rounded-md border border-transparent px-2.5 text-xs text-slate-500 hover:border-white/15 hover:bg-slate-800/70 hover:text-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                      Down
                                    </button>
                                    <span className="h-4 w-px bg-white/15" />
                                    {selectedTopicSections.length > 1 ? (
                                      <button
                                        type="button"
                                        onClick={() => void removeTopicSection(section.id)}
                                        className="inline-flex h-8 items-center gap-1 rounded-md border border-rose-400/30 bg-rose-500/10 px-2.5 text-xs text-rose-200 hover:border-rose-300/50 hover:bg-rose-500/20"
                                      >
                                        <X size={12} />
                                        Delete
                                      </button>
                                    ) : null}
                                  </div>
                              </div>

                              <div className="p-3">
                              <div
                                className={
                                  sectionTemplate === 'template-2'
                                    ? 'space-y-3'
                                    : hasSectionMedia
                                      ? `grid gap-4 xl:items-start ${
                                        sectionTemplate === 'template-3'
                                          ? 'xl:grid-cols-[320px_minmax(0,1fr)]'
                                          : 'xl:grid-cols-[minmax(0,1fr)_320px]'
                                      }`
                                      : 'space-y-3'
                                }
                              >
                                <div className={`rounded-md border border-white/15 bg-slate-900/70 ${sectionTemplate === 'template-3' && hasSectionMedia ? 'xl:order-2' : ''}`}>
                                  <div className="flex flex-wrap items-center gap-2 border-b border-white/10 p-2">
                                    <div className={editorToolbarGroupClass}>
                                      <button type="button" onMouseDown={preventToolbarButtonBlur} onClick={() => applyTopicContentCommand(section.id, 'bold')} className={editorToolbarButtonClass}>B</button>
                                      <button type="button" onMouseDown={preventToolbarButtonBlur} onClick={() => applyTopicContentCommand(section.id, 'italic')} className={`${editorToolbarButtonClass} italic`}>I</button>
                                      <button type="button" onMouseDown={preventToolbarButtonBlur} onClick={() => applyTopicContentCommand(section.id, 'underline')} className={`${editorToolbarButtonClass} underline`}>U</button>
                                    </div>
                                    <div className={editorToolbarGroupClass}>
                                      <button
                                        type="button"
                                        onMouseDown={preventToolbarButtonBlur}
                                        onClick={() => applyTopicContentCommand(section.id, 'insertUnorderedList')}
                                        className={editorToolbarIconButtonClass}
                                        title="Bulleted list"
                                        aria-label="Bulleted list"
                                      >
                                        <List size={14} />
                                      </button>
                                      <button
                                        type="button"
                                        onMouseDown={preventToolbarButtonBlur}
                                        onClick={() => applyTopicContentCommand(section.id, 'insertOrderedList')}
                                        className={editorToolbarIconButtonClass}
                                        title="Numbered list"
                                        aria-label="Numbered list"
                                      >
                                        <ListOrdered size={14} />
                                      </button>
                                    </div>
                                    <div className={editorToolbarGroupClass}>
                                      <button
                                        type="button"
                                        onMouseDown={preventToolbarButtonBlur}
                                        onClick={() => applyTopicContentCommand(section.id, 'justifyLeft')}
                                        className={editorToolbarIconButtonClass}
                                        title="Align left"
                                        aria-label="Align left"
                                      >
                                        <AlignLeft size={14} />
                                      </button>
                                      <button
                                        type="button"
                                        onMouseDown={preventToolbarButtonBlur}
                                        onClick={() => applyTopicContentCommand(section.id, 'justifyCenter')}
                                        className={editorToolbarIconButtonClass}
                                        title="Align center"
                                        aria-label="Align center"
                                      >
                                        <AlignCenter size={14} />
                                      </button>
                                      <button
                                        type="button"
                                        onMouseDown={preventToolbarButtonBlur}
                                        onClick={() => applyTopicContentCommand(section.id, 'justifyRight')}
                                        className={editorToolbarIconButtonClass}
                                        title="Align right"
                                        aria-label="Align right"
                                      >
                                        <AlignRight size={14} />
                                      </button>
                                      <button
                                        type="button"
                                        onMouseDown={preventToolbarButtonBlur}
                                        onClick={() => applyTopicContentCommand(section.id, 'justifyFull')}
                                        className={editorToolbarIconButtonClass}
                                        title="Justify"
                                        aria-label="Justify"
                                      >
                                        <AlignJustify size={14} />
                                      </button>
                                    </div>
                                    <div className={editorToolbarGroupClass}>
                                      <select
                                        defaultValue=""
                                        onMouseDown={() => rememberTopicEditorSelection(section.id)}
                                        onChange={(event) => {
                                          const value = event.target.value;
                                          if (!value) return;
                                          applyTopicContentCommand(section.id, 'fontSize', value);
                                          event.target.value = '';
                                        }}
                                        className={editorToolbarSelectClass}
                                      >
                                        <option value="">Size</option>
                                        <option value="1">Small</option>
                                        <option value="3">Normal</option>
                                        <option value="5">Large</option>
                                        <option value="7">X-Large</option>
                                      </select>
                                      <select
                                        defaultValue=""
                                        onMouseDown={() => rememberTopicEditorSelection(section.id)}
                                        onChange={(event) => {
                                          const value = event.target.value;
                                          if (!value) return;
                                          applyTopicContentCommand(section.id, 'foreColor', value);
                                          event.target.value = '';
                                        }}
                                        className={editorToolbarSelectClass}
                                      >
                                        <option value="">Color</option>
                                        <option value="#f5c800">Yellow</option>
                                        <option value="#4a8fe8">Blue</option>
                                        <option value="#4caf7d">Green</option>
                                        <option value="#e05c5c">Red</option>
                                        <option value="#e8eaf0">White</option>
                                      </select>
                                      <button type="button" onMouseDown={preventToolbarButtonBlur} onClick={() => applyTopicContentCommand(section.id, 'removeFormat')} className={editorToolbarButtonClass}>Clear</button>
                                    </div>
                                  </div>
                                  <div
                                    ref={(element) => {
                                      topicSectionEditorRefs.current[section.id] = element;
                                    }}
                                    contentEditable
                                    suppressContentEditableWarning
                                    onFocus={() => {
                                      setActiveTopicSectionId(section.id);
                                      rememberTopicEditorSelection(section.id);
                                    }}
                                    onMouseUp={() => rememberTopicEditorSelection(section.id)}
                                    onKeyUp={() => rememberTopicEditorSelection(section.id)}
                                    onBlur={(event) => {
                                      rememberTopicEditorSelection(section.id);
                                      const topicBody = sanitizeRichHtml(event.currentTarget.innerHTML);
                                      updateContentLocal(section.id, {
                                        title: `${currentTopic.title} - Section ${sectionIndex + 1}`,
                                        body_text: topicBody,
                                      });
                                    }}
                                    className="min-h-[280px] p-3 text-sm text-slate-100 outline-none"
                                  />
                                </div>

                                <div className={`space-y-2 ${sectionTemplate === 'template-3' && hasSectionMedia ? 'xl:order-1' : ''}`}>
                                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Upload Photo/Video</span>
                                  <div className="relative">
                                    {sectionMediaUrl ? (
                                      <button
                                        type="button"
                                        onClick={(event) => {
                                          event.preventDefault();
                                          event.stopPropagation();
                                          void removeTopicMedia(section, sectionIndex);
                                        }}
                                        className="absolute right-2 top-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/25 bg-slate-950/85 text-slate-200 transition hover:border-rose-300/70 hover:text-rose-200"
                                        title="Remove uploaded file"
                                        aria-label="Remove uploaded file"
                                      >
                                        <X size={13} />
                                      </button>
                                    ) : null}
                                    <label className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-md border-2 border-dashed border-white/25 bg-slate-900/60 p-6 text-center hover:border-brand-400/70 hover:bg-slate-900/80 ${sectionTemplate === 'template-2' ? 'min-h-[220px]' : 'min-h-[280px]'}`}>
                                      {sectionMediaUrl ? (
                                        section.content_type === 'video' || isVideoMediaUrl(sectionMediaUrl) ? (
                                          <video src={sectionMediaUrl} controls className="max-h-[260px] w-full rounded-md object-contain" />
                                        ) : (
                                          <img src={sectionMediaUrl} alt={`${currentTopic.title} section ${sectionIndex + 1}`} className="max-h-[260px] w-full rounded-md object-contain" />
                                        )
                                      ) : (
                                        <>
                                          <Upload size={36} className="text-slate-300" />
                                          <p className="text-lg font-semibold text-slate-200">UPLOAD PHOTO/VIDEO</p>
                                          <p className="text-xs text-slate-400">PNG, JPG, WEBP, GIF, MP4, WEBM</p>
                                        </>
                                      )}
                                      <input
                                        type="file"
                                        accept="image/*,video/*"
                                        className="hidden"
                                        onChange={(event) => {
                                          const file = event.target.files?.[0];
                                          if (!file) return;
                                          void run(async () => {
                                            await uploadTopicMedia(section, file, sectionIndex);
                                          });
                                          event.target.value = '';
                                        }}
                                      />
                                    </label>
                                  </div>
                                </div>
                              </div>
                            </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    </div>
                  ) : null}

                  {selection.view === 'builderHome' ? (
                    <div className="space-y-2 rounded-2xl border border-white/10 bg-slate-950/40 p-5">
                      <p className="text-sm font-semibold text-slate-100">Module is blank.</p>
                      <p className="text-sm text-slate-300">Add a lesson, pre-test, post-test, or final exam from Builder Actions to start building this module.</p>
                    </div>
                  ) : null}

                  {selection.view === 'preTest' || selection.view === 'postTest' || selection.view === 'finalExam' ? (
                    <div className="space-y-4">
                      {!currentQuiz ? (
                        <div className="space-y-2 rounded-xl border border-white/10 bg-slate-950/50 p-4"><p className="text-sm text-slate-300">No assessment is configured for this stage yet.</p><button onClick={() => void createCurrentAssessment()} className="rounded-full bg-brand-500 px-4 py-2 text-xs font-semibold text-slate-950">Create Assessment</button></div>
                      ) : (
                        <>
                          <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3">
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Assessment Builder</p>
                              <p className="mt-1 text-sm text-slate-300">Set assessment details, then create and save questions.</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => void saveCurrentQuiz()}
                              className="rounded-full bg-brand-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-brand-400"
                            >
                              Save Assessment
                            </button>
                          </div>
                          <div className="space-y-4 rounded-xl border border-white/10 bg-slate-950/40 p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Assessment Details</p>
                                <p className="mt-1 text-sm text-slate-300">Configure title, timing, scoring, and activation for this assessment.</p>
                              </div>
                            </div>
                            <div className="grid gap-3 md:grid-cols-2">
                              <label className="space-y-1 md:col-span-2">
                                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Assessment Title</span>
                                <input
                                  value={currentQuiz.title}
                                  onChange={(event) => updateQuizLocal(currentQuiz.id, { title: event.target.value })}
                                  className="w-full rounded-md border border-white/15 bg-slate-900/70 px-3 py-2 text-sm text-slate-100"
                                />
                              </label>
                              <label className="space-y-1">
                                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Passing Score</span>
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={currentQuiz.passing_score}
                                  onChange={(event) => updateQuizLocal(currentQuiz.id, { passing_score: Number(event.target.value) || 0 })}
                                  className="w-full rounded-md border border-white/15 bg-slate-900/70 px-3 py-2 text-sm text-slate-100"
                                />
                              </label>
                              <label className="space-y-1">
                                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Time Limit (minutes)</span>
                                <input
                                  type="number"
                                  min={1}
                                  value={currentQuiz.time_limit_minutes}
                                  onChange={(event) => updateQuizLocal(currentQuiz.id, { time_limit_minutes: Number(event.target.value) || 1 })}
                                  className="w-full rounded-md border border-white/15 bg-slate-900/70 px-3 py-2 text-sm text-slate-100"
                                />
                              </label>
                              <label className="space-y-1">
                                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Attempt Limit</span>
                                <input
                                  type="number"
                                  min={1}
                                  value={currentQuiz.attempt_limit}
                                  onChange={(event) => updateQuizLocal(currentQuiz.id, { attempt_limit: Number(event.target.value) || 1 })}
                                  className="w-full rounded-md border border-white/15 bg-slate-900/70 px-3 py-2 text-sm text-slate-100"
                                />
                              </label>
                              <label className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-slate-900/70 px-3 py-2 text-sm text-slate-200">
                                <input
                                  type="checkbox"
                                  checked={currentQuiz.is_active}
                                  onChange={(event) => updateQuizLocal(currentQuiz.id, { is_active: event.target.checked })}
                                />
                                Active
                              </label>
                            </div>
                          </div>
                          <div className="space-y-4 rounded-xl border border-white/10 bg-slate-950/40 p-4">
                            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-white/10 pb-3">
                              <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-400">Questions</p>
                                <p className="mt-1 text-sm text-slate-300">Build question prompts, scoring, answer type, and correct choices.</p>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => void addQuestion()}
                                  className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-900"
                                >
                                  + Add Question
                                </button>
                                {selectedQuestions.length > 0 ? (
                                  <button
                                    type="button"
                                    onClick={() => void saveAllQuestions()}
                                    className="rounded-full bg-brand-500 px-4 py-2 text-xs font-semibold text-slate-950"
                                  >
                                    Save All Questions
                                  </button>
                                ) : null}
                              </div>
                            </div>
                            {selectedQuestions.length === 0 ? (
                              <div className="border border-dashed border-white/15 px-4 py-6 text-center">
                                <p className="text-sm text-slate-400">No questions yet.</p>
                              </div>
                            ) : (
                              selectedQuestions.map((question, questionIndex) => {
                                const answers = answersByQuestion.get(question.id) ?? [];
                                const questionType = normalizeQuestionType(question.question_type);
                                return (
                                  <div key={question.id} className="space-y-3 rounded-lg border border-white/10 bg-slate-900/40 p-4">
                                    <div className="flex items-start justify-between gap-3">
                                      <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-400">
                                        Question {questionIndex + 1}
                                      </p>
                                      <button
                                        type="button"
                                        onClick={() => void removeQuestion(question.id)}
                                        aria-label={`Delete question ${questionIndex + 1}`}
                                        title="Delete question"
                                        className="rounded-full border border-rose-400/40 px-3 py-1.5 text-xs font-semibold text-rose-200 hover:bg-rose-500/10"
                                      >
                                        Delete Question
                                      </button>
                                    </div>
                                    <div className="grid items-end gap-2 md:grid-cols-[minmax(0,1fr)_110px_240px]">
                                      <label className="space-y-1">
                                        <span className="text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-400">Question Prompt</span>
                                        <input
                                          value={question.prompt}
                                          onChange={(event) => updateQuestionLocal(question.id, { prompt: event.target.value })}
                                          className="w-full rounded-md border border-white/15 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
                                        />
                                      </label>
                                      <label className="space-y-1">
                                        <span className="text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-400">Points</span>
                                        <input
                                          type="number"
                                          min={1}
                                          value={question.points}
                                          onChange={(event) => updateQuestionLocal(question.id, { points: Number(event.target.value) || 1 })}
                                          className="w-full rounded-md border border-white/15 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
                                        />
                                      </label>
                                      <label className="space-y-1">
                                        <span className="text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-400">Question Type</span>
                                        <select
                                          value={questionType}
                                          onChange={(event) =>
                                            setQuestionTypeLocally(question.id, normalizeQuestionType(event.target.value))
                                          }
                                          className="w-full rounded-md border border-white/15 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
                                        >
                                          <option value="single_choice">Radio Button (Single Answer)</option>
                                          <option value="multiple_choice">Check Boxes (Multiple Answers)</option>
                                        </select>
                                      </label>
                                    </div>
                                    <div className="space-y-2 border-t border-white/10 pt-3">
                                      {answers.map((answer, answerIndex) => (
                                        <div
                                          key={answer.id}
                                          className={`grid gap-2 rounded-md border border-white/10 bg-slate-950/45 p-2 md:grid-cols-[auto_1fr_auto] ${
                                            answer.is_correct ? 'text-emerald-100' : 'text-slate-100'
                                          }`}
                                        >
                                          <label className="inline-flex items-center gap-2">
                                            <input
                                              type={questionType === 'single_choice' ? 'radio' : 'checkbox'}
                                              name={`question-${question.id}-correct`}
                                              checked={Boolean(answer.is_correct)}
                                              onChange={() => toggleCorrectAnswerLocally(question.id, answer.id)}
                                              className={`h-4 w-4 border border-white/15 bg-slate-950 text-emerald-400 ${questionType === 'single_choice' ? 'rounded-full' : 'rounded'}`}
                                            />
                                            <span className="text-sm">Correct</span>
                                          </label>
                                          <input
                                            value={answer.answer_text}
                                            onChange={(event) => updateAnswerLocal(answer.id, { answer_text: event.target.value })}
                                            placeholder={`Choice ${answerIndex + 1}`}
                                            className="rounded-md border border-white/15 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
                                          />
                                          <button
                                            type="button"
                                            onClick={() => void removeAnswer(question.id, answer.id)}
                                            aria-label={`Delete choice ${answerIndex + 1}`}
                                            title="Delete choice"
                                            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-rose-400/50 bg-rose-500/15 text-rose-200 transition hover:bg-rose-500/25"
                                          >
                                            <X size={12} />
                                          </button>
                                        </div>
                                      ))}
                                      <div className="flex items-center justify-between">
                                        <p className="text-xs text-slate-400">
                                          {questionType === 'single_choice'
                                            ? 'Radio button mode: select exactly one correct answer.'
                                            : 'Check boxes mode: select all correct answers.'}
                                        </p>
                                        <button
                                          type="button"
                                          onClick={() => void addChoice(question.id)}
                                          className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-slate-200"
                                        >
                                          Add Choice
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  ) : null}
              </div>
            </div>
          </div>

        </div>
        </div>
      ) : null}

      {showCreateModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <form onSubmit={handleCreateModule} className="w-full max-w-5xl rounded-xl border border-white/10 bg-slate-900 p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between">
              <h3 className="text-xl font-bold text-white">Create Module</h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                aria-label="Close create module"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-slate-200 transition hover:bg-white/10"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid gap-5 md:grid-cols-[340px_1fr]">
              <article className="rounded-xl border border-white/10 bg-slate-950/40 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-300">Live Preview</p>
                <div className="mt-3 rounded-xl border border-white/10 bg-slate-900/70 p-4">
                  <div className="mb-3 aspect-video w-full overflow-hidden rounded-md border border-white/10 bg-white/5">
                    {createForm.thumbnailUrl ? (
                      <img src={createForm.thumbnailUrl} alt={createForm.title || 'Module preview'} className="h-full w-full object-contain" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs font-semibold uppercase tracking-wider text-slate-400">
                        No Thumbnail
                      </div>
                    )}
                  </div>

                  <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-200">
                    {createForm.category || 'Hardware'}
                  </span>
                  <h4 className="mt-3 text-lg font-bold text-white">{createForm.title || 'Untitled Module'}</h4>
                  <p className="mt-2 text-sm text-slate-300">{createForm.description || 'Module description preview.'}</p>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    <span className={`rounded-full px-2 py-0.5 ${createForm.isActive ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-500/15 text-slate-300'}`}>
                      {createForm.isActive ? 'Published' : 'Draft'}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 ${createForm.isLocked ? 'bg-amber-500/15 text-amber-200' : 'bg-brand-500/15 text-brand-200'}`}>
                      {createForm.isLocked ? 'Locked' : 'Unlocked'}
                    </span>
                  </div>
                </div>
              </article>

              <div className="grid gap-4 rounded-xl border border-white/10 bg-slate-950/30 p-4 md:grid-cols-2">
                <label htmlFor="create-module-title" className="space-y-1.5 md:col-span-2">
                  <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">Module Title</span>
                  <input
                    id="create-module-title"
                    required
                    value={createForm.title}
                    onChange={(event) => setCreateForm((prev) => ({ ...prev, title: event.target.value }))}
                    placeholder="Enter module title"
                    className="w-full rounded-lg border border-white/20 bg-slate-950/80 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
                  />
                </label>

                <label htmlFor="create-module-category" className="space-y-1.5 md:col-span-2">
                  <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">Category</span>
                  <select
                    id="create-module-category"
                    value={createForm.category}
                    onChange={(event) => setCreateForm((prev) => ({ ...prev, category: event.target.value }))}
                    className="w-full rounded-lg border border-white/20 bg-slate-950/80 px-3.5 py-2.5 text-sm text-slate-100 transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
                  >
                    {MODULE_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="space-y-2 md:col-span-2">
                  <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">Thumbnail</span>
                  <div className="flex flex-col gap-2 rounded-lg border border-white/20 bg-slate-950/65 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-slate-300">Upload a thumbnail image for this module card preview.</p>
                    <div className="flex items-center gap-2">
                      <input ref={createThumbnailInputRef} type="file" accept="image/*" onChange={handleCreateThumbnailUpload} className="hidden" />
                      <button
                        type="button"
                        onClick={() => createThumbnailInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 rounded-md border border-white/20 bg-slate-900/70 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:bg-slate-800"
                      >
                        <Upload size={14} />
                        Upload Photo
                      </button>
                      {createForm.thumbnailUrl ? (
                        <button
                          type="button"
                          onClick={() => setCreateForm((prev) => ({ ...prev, thumbnailUrl: '' }))}
                          className="rounded-md border border-white/20 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <label htmlFor="create-module-thumbnail-url" className="space-y-1.5">
                    <span className="block text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">Or Paste Image URL (Optional)</span>
                    <input
                      id="create-module-thumbnail-url"
                      value={createForm.thumbnailUrl}
                      onChange={(event) => setCreateForm((prev) => ({ ...prev, thumbnailUrl: event.target.value }))}
                      placeholder="https://example.com/module-cover.png"
                      className="w-full rounded-lg border border-white/20 bg-slate-950/80 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
                    />
                  </label>
                </div>

                <label htmlFor="create-module-description" className="space-y-1.5 md:col-span-2">
                  <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">Description</span>
                  <textarea
                    id="create-module-description"
                    required
                    value={createForm.description}
                    onChange={(event) => setCreateForm((prev) => ({ ...prev, description: event.target.value }))}
                    placeholder="Write a short description for this module"
                    className="h-32 w-full rounded-lg border border-white/20 bg-slate-950/80 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
                  />
                </label>

                <div className="grid gap-3 md:col-span-2 md:grid-cols-2">
                  <label htmlFor="create-module-publish" className="flex min-h-[92px] cursor-pointer items-center justify-between rounded-lg border border-white/15 bg-slate-950/60 px-4 py-3 transition hover:border-white/25">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">Publish Status</p>
                      <p className="mt-1 text-sm font-semibold text-slate-100">{createForm.isActive ? 'Published' : 'Draft'}</p>
                    </div>
                    <span className="relative inline-flex h-6 w-11 items-center">
                      <input
                        id="create-module-publish"
                        type="checkbox"
                        checked={createForm.isActive}
                        onChange={(event) => setCreateForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                        className="peer sr-only"
                      />
                      <span className="h-6 w-11 rounded-full bg-slate-600/80 transition peer-checked:bg-emerald-500/80" />
                      <span className="pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
                    </span>
                  </label>

                  <label htmlFor="create-module-lock" className="flex min-h-[92px] cursor-pointer items-center justify-between rounded-lg border border-white/15 bg-slate-950/60 px-4 py-3 transition hover:border-white/25">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">Access Mode</p>
                      <p className="mt-1 text-sm font-semibold text-slate-100">{createForm.isLocked ? 'Locked' : 'Unlocked'}</p>
                    </div>
                    <span className="relative inline-flex h-6 w-11 items-center">
                      <input
                        id="create-module-lock"
                        type="checkbox"
                        checked={createForm.isLocked}
                        onChange={(event) => setCreateForm((prev) => ({ ...prev, isLocked: event.target.checked }))}
                        className="peer sr-only"
                      />
                      <span className="h-6 w-11 rounded-full bg-slate-600/80 transition peer-checked:bg-amber-500/80" />
                      <span className="pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
                    </span>
                  </label>
                </div>
                <div className="flex justify-end md:col-span-2">
                  <button disabled={busy} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white">
                    {busy ? 'Creating...' : 'Create Module'}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      ) : null}

      {showEditModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <form onSubmit={handleUpdateModule} className="w-full max-w-5xl rounded-xl border border-white/10 bg-slate-900 p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between">
              <h3 className="text-xl font-bold text-white">Edit Module Details</h3>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                aria-label="Close edit module details"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-slate-200 transition hover:bg-white/10"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid gap-5 md:grid-cols-[340px_1fr]">
              <article className="rounded-xl border border-white/10 bg-slate-950/40 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-300">Live Preview</p>
                <div className="mt-3 rounded-xl border border-white/10 bg-slate-900/70 p-4">
                  <div className="mb-3 aspect-video w-full overflow-hidden rounded-md border border-white/10 bg-white/5">
                    {editForm.thumbnailUrl ? (
                      <img src={editForm.thumbnailUrl} alt={editForm.title || 'Module preview'} className="h-full w-full object-contain" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs font-semibold uppercase tracking-wider text-slate-400">
                        No Thumbnail
                      </div>
                    )}
                  </div>

                  <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-200">
                    {editForm.category || 'Hardware'}
                  </span>
                  <h4 className="mt-3 text-lg font-bold text-white">{editForm.title || 'Untitled Module'}</h4>
                  <p className="mt-2 text-sm text-slate-300">{editForm.description || 'Module description preview.'}</p>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    <span className={`rounded-full px-2 py-0.5 ${editForm.isActive ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-500/15 text-slate-300'}`}>
                      {editForm.isActive ? 'Published' : 'Draft'}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 ${editForm.isLocked ? 'bg-amber-500/15 text-amber-200' : 'bg-brand-500/15 text-brand-200'}`}>
                      {editForm.isLocked ? 'Locked' : 'Unlocked'}
                    </span>
                  </div>

                </div>
              </article>

              <div className="grid gap-4 rounded-xl border border-white/10 bg-slate-950/30 p-4 md:grid-cols-2">
                <label htmlFor="edit-module-title" className="space-y-1.5 md:col-span-2">
                  <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">Module Title</span>
                  <input
                    id="edit-module-title"
                    required
                    value={editForm.title}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, title: event.target.value }))}
                    placeholder="Enter module title"
                    className="w-full rounded-lg border border-white/20 bg-slate-950/80 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
                  />
                </label>

                <label htmlFor="edit-module-category" className="space-y-1.5 md:col-span-2">
                  <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">Category</span>
                  <select
                    id="edit-module-category"
                    value={editForm.category}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, category: event.target.value }))}
                    className="w-full rounded-lg border border-white/20 bg-slate-950/80 px-3.5 py-2.5 text-sm text-slate-100 transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
                  >
                    {MODULE_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="space-y-2 md:col-span-2">
                  <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">Thumbnail</span>
                  <div className="flex flex-col gap-2 rounded-lg border border-white/20 bg-slate-950/65 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-slate-300">Upload a thumbnail image for this module card preview.</p>
                    <div className="flex items-center gap-2">
                      <input ref={editThumbnailInputRef} type="file" accept="image/*" onChange={handleEditThumbnailUpload} className="hidden" />
                      <button
                        type="button"
                        onClick={() => editThumbnailInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 rounded-md border border-white/20 bg-slate-900/70 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:bg-slate-800"
                      >
                        <Upload size={14} />
                        Upload Photo
                      </button>
                      {editForm.thumbnailUrl ? (
                        <button
                          type="button"
                          onClick={() => setEditForm((prev) => ({ ...prev, thumbnailUrl: '' }))}
                          className="rounded-md border border-white/20 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <label htmlFor="edit-module-thumbnail-url" className="space-y-1.5">
                    <span className="block text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">Or Paste Image URL (Optional)</span>
                    <input
                      id="edit-module-thumbnail-url"
                      value={editForm.thumbnailUrl}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, thumbnailUrl: event.target.value }))}
                      placeholder="https://example.com/module-cover.png"
                      className="w-full rounded-lg border border-white/20 bg-slate-950/80 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
                    />
                  </label>
                </div>

                <label htmlFor="edit-module-description" className="space-y-1.5 md:col-span-2">
                  <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">Description</span>
                  <textarea
                    id="edit-module-description"
                    required
                    value={editForm.description}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, description: event.target.value }))}
                    placeholder="Write a short description for this module"
                    className="h-32 w-full rounded-lg border border-white/20 bg-slate-950/80 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
                  />
                </label>

                <div className="grid gap-3 md:col-span-2 md:grid-cols-2">
                  <label htmlFor="edit-module-publish" className="flex min-h-[92px] cursor-pointer items-center justify-between rounded-lg border border-white/15 bg-slate-950/60 px-4 py-3 transition hover:border-white/25">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">Publish Status</p>
                      <p className="mt-1 text-sm font-semibold text-slate-100">{editForm.isActive ? 'Published' : 'Draft'}</p>
                    </div>
                    <span className="relative inline-flex h-6 w-11 items-center">
                      <input
                        id="edit-module-publish"
                        type="checkbox"
                        checked={editForm.isActive}
                        onChange={(event) => setEditForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                        className="peer sr-only"
                      />
                      <span className="h-6 w-11 rounded-full bg-slate-600/80 transition peer-checked:bg-emerald-500/80" />
                      <span className="pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
                    </span>
                  </label>

                  <label htmlFor="edit-module-lock" className="flex min-h-[92px] cursor-pointer items-center justify-between rounded-lg border border-white/15 bg-slate-950/60 px-4 py-3 transition hover:border-white/25">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">Access Mode</p>
                      <p className="mt-1 text-sm font-semibold text-slate-100">{editForm.isLocked ? 'Locked' : 'Unlocked'}</p>
                    </div>
                    <span className="relative inline-flex h-6 w-11 items-center">
                      <input
                        id="edit-module-lock"
                        type="checkbox"
                        checked={editForm.isLocked}
                        onChange={(event) => setEditForm((prev) => ({ ...prev, isLocked: event.target.checked }))}
                        className="peer sr-only"
                      />
                      <span className="h-6 w-11 rounded-full bg-slate-600/80 transition peer-checked:bg-amber-500/80" />
                      <span className="pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
                    </span>
                  </label>
                </div>
                <div className="flex justify-end md:col-span-2">
                  <button disabled={busy} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white">
                    {busy ? 'Saving...' : 'Save Module'}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      ) : null}

      {showAddNodeModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <form onSubmit={handleAddNode} className="w-full max-w-md rounded-xl border border-white/10 bg-slate-900 p-5 shadow-2xl">
            <div className="mb-4"><h3 className="text-lg font-bold text-white">Add {addType}</h3></div>
            <div className="space-y-3">
              <input value={addTitle} onChange={(event) => setAddTitle(event.target.value)} className="w-full rounded-md border border-white/20 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" />
              {addType === 'topic' || addType === 'postTest' ? (
                <select value={addLessonId ?? ''} onChange={(event) => setAddLessonId(Number(event.target.value))} className="w-full rounded-md border border-white/20 bg-slate-950/70 px-3 py-2 text-sm text-slate-100">
                  {lessons.map((lesson) => <option key={lesson.id} value={lesson.id}>Lesson {lesson.sequence_no}: {lesson.title}</option>)}
                </select>
              ) : null}
            </div>
            <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setShowAddNodeModal(false)} className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-slate-200">Cancel</button><button disabled={busy} className="rounded-full bg-brand-500 px-4 py-2 text-xs font-semibold text-slate-950">Add</button></div>
          </form>
        </div>
      ) : null}

      {showPreviewModal ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/90 p-4 backdrop-blur-sm">
          <div className="h-[90vh] w-full max-w-[95vw] xl:max-w-8xl overflow-hidden rounded-3xl border border-white/10 bg-slate-950">
            <div className="flex items-center justify-between border-b border-white/10 bg-slate-900 px-5 py-3">
              <h3 className="text-lg font-bold text-white">Student Preview</h3>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-rose-500/30 bg-rose-500/10 text-rose-300 transition hover:bg-rose-500/20"
                aria-label="Close preview"
              >
                <X size={18} />
              </button>
            </div>
            <div className="grid h-[calc(90vh-70px)] gap-5 overflow-hidden p-5 xl:grid-cols-[536px_minmax(0,1fr)]">
              <aside className="no-scrollbar rounded-3xl border border-white/10 bg-slate-900/70 p-5 shadow-sm xl:sticky xl:top-20 xl:h-[calc(90vh-5rem)] xl:overflow-y-auto">
                <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Module {builder?.module.id ?? '--'}
                  </p>
                  <p className="mt-2 text-base font-semibold text-white">{builder?.module.title ?? 'Untitled Module'}</p>
                  <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Progress</span>
                    <span className="font-semibold text-brand-300">{previewCompletionPercent}%</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-800/70">
                    <div
                      className="h-full rounded-full bg-brand-500"
                      style={{ width: `${Math.max(0, Math.min(100, previewCompletionPercent))}%` }}
                    />
                  </div>
                </div>

                <div className="mt-5 rounded-3xl border border-white/10 bg-slate-950/70 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Learning Sequence</p>
                  <div className="mt-3 space-y-3">
                    {sequence.map((item) => {
                      const active = sameSelection(item.selection, previewSelection);
                      return (
                        <button
                          key={`preview-${selectionKey(item.selection)}`}
                          type="button"
                          onClick={() => setPreviewSelection(item.selection)}
                          className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                            active
                              ? 'border-sky-400/50 bg-sky-500/10 text-white'
                              : 'border-slate-700/80 bg-slate-950/80 text-slate-300 hover:border-white/20 hover:bg-white/10'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-semibold text-white">{item.label}</span>
                            <span className="text-[10px] uppercase tracking-[0.16em] text-slate-400">
                              {getSequenceLabel(item)}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </aside>

              <div className="flex min-h-0 flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-900/70 shadow-sm">
                <div className="border-b border-white/10 bg-slate-950 px-5 py-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-brand-300">{previewNodeLabel}</p>
                  <h2 className="mt-2 text-2xl font-bold text-white">{previewPageTitle}</h2>
                  <p className="mt-2 max-w-2xl text-sm text-slate-300">{previewPageSummary}</p>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-5">
                  {previewSelection.view === 'lesson' && previewCurrentLesson ? (
                    <div className="space-y-6">
                      {previewCurrentLesson.overview_text ? (
                        <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-5 text-sm text-slate-200">
                          <div dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(previewCurrentLesson.overview_text) }} />
                        </div>
                      ) : null}
                      {previewCurrentLessonMediaUrls.length > 0 ? (
                        <div className="grid gap-3 md:grid-cols-2">
                          {previewCurrentLessonMediaUrls.map((mediaUrl, mediaIndex) =>
                            isVideoMediaUrl(mediaUrl) ? (
                              <video
                                key={`${mediaUrl}-${mediaIndex}`}
                                src={mediaUrl}
                                controls
                                className="h-[220px] w-full rounded-3xl border border-white/10 bg-black/30 object-contain"
                              />
                            ) : (
                              <img
                                key={`${mediaUrl}-${mediaIndex}`}
                                src={mediaUrl}
                                alt={`${previewCurrentLesson.title} media ${mediaIndex + 1}`}
                                className="h-[220px] w-full rounded-3xl border border-white/10 bg-black/30 object-contain"
                              />
                            )
                          )}
                        </div>
                      ) : null}
                      <div className="space-y-4">
                        {previewLessonTopics.length === 0 ? (
                          <p className="rounded-3xl border border-white/10 bg-slate-950/60 p-5 text-sm text-slate-400">
                            No lesson topics configured yet.
                          </p>
                        ) : (
                          previewLessonTopics.map((topic, topicIndex) => {
                            const topicSections = contentByTopic.get(topic.id) ?? [];
                            return (
                              <div key={topic.id} className="rounded-3xl border border-white/10 bg-slate-950/60 p-5">
                                <div className="flex items-center justify-between gap-4">
                                  <div>
                                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Topic {topicIndex + 1}</p>
                                    <h3 className="mt-2 text-lg font-semibold text-white">{topic.title}</h3>
                                  </div>
                                  <StatusPill
                                    text={topicSections.length > 0 ? 'With Content' : 'Empty'}
                                    className={
                                      topicSections.length > 0
                                        ? 'border-emerald-300/30 bg-emerald-500/10 text-emerald-200'
                                        : 'border-slate-400/30 bg-slate-700/30 text-slate-300'
                                    }
                                  />
                                </div>
                                {topic.summary ? <p className="mt-3 text-sm text-slate-300">{topic.summary}</p> : null}
                                {topicSections.length === 0 ? null : (
                                  <div className="mt-4 space-y-4">
                                    {topicSections.map((section, sectionIndex) => {
                                      const sectionTemplate = getTopicTemplateFromBlock(section);
                                      const sectionHtml = sanitizeRichHtml(section.body_text ?? '');
                                      const sectionMediaUrl = getRenderableMediaUrl(section);

                                      return (
                                        <div key={section.id} className="space-y-3 rounded-3xl border border-white/10 bg-slate-950/60 p-4">
                                          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                                            Section {sectionIndex + 1}
                                          </p>
                                          <div
                                            className={`rounded-3xl border border-white/10 bg-slate-950/80 p-4 text-sm text-slate-200 ${
                                              sectionTemplate === 'template-2' ? 'space-y-3' : ''
                                            }`}
                                          >
                                            {sectionHtml ? (
                                              <div dangerouslySetInnerHTML={{ __html: sectionHtml }} />
                                            ) : (
                                              <p className="text-sm text-slate-400">No text content.</p>
                                            )}
                                          </div>
                                          {sectionMediaUrl ? (
                                            <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-4">
                                              {section.content_type === 'video' || isVideoMediaUrl(sectionMediaUrl) ? (
                                                <video
                                                  src={sectionMediaUrl}
                                                  controls
                                                  className="w-full rounded-3xl object-contain"
                                                />
                                              ) : (
                                                <img
                                                  src={sectionMediaUrl}
                                                  alt={`${topic.title} section ${sectionIndex + 1}`}
                                                  className="w-full rounded-3xl object-contain"
                                                />
                                              )}
                                            </div>
                                          ) : null}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  ) : null}

                  {previewSelection.view === 'topic' && previewCurrentTopic ? (
                    <div className="space-y-6">
                      {previewCurrentTopic.summary ? (
                        <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-5 text-sm text-slate-200">
                          <p>{previewCurrentTopic.summary}</p>
                        </div>
                      ) : null}
                      {previewTopicSections.length === 0 ? (
                        <p className="rounded-3xl border border-white/10 bg-slate-950/60 p-5 text-sm text-slate-400">
                          No topic content yet.
                        </p>
                      ) : (
                        previewTopicSections.map((section, sectionIndex) => {
                          const sectionTemplate = getTopicTemplateFromBlock(section);
                          const sectionHtml = sanitizeRichHtml(section.body_text ?? '');
                          const sectionMediaUrl = getRenderableMediaUrl(section);

                          return (
                            <div key={section.id} className="space-y-3 rounded-3xl border border-white/10 bg-slate-950/60 p-5">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                                Section {sectionIndex + 1}
                              </p>
                              <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-4 text-sm text-slate-200">
                                {sectionHtml ? (
                                  <div dangerouslySetInnerHTML={{ __html: sectionHtml }} />
                                ) : (
                                  <p className="text-sm text-slate-400">No text content.</p>
                                )}
                              </div>
                              {sectionMediaUrl ? (
                                <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-4">
                                  {section.content_type === 'video' || isVideoMediaUrl(sectionMediaUrl) ? (
                                    <video
                                      src={sectionMediaUrl}
                                      controls
                                      className="w-full rounded-3xl object-contain"
                                    />
                                  ) : (
                                    <img
                                      src={sectionMediaUrl}
                                      alt={`${previewCurrentTopic.title} section ${sectionIndex + 1}`}
                                      className="w-full rounded-3xl object-contain"
                                    />
                                  )}
                                </div>
                              ) : null}
                            </div>
                          );
                        })
                      )}
                    </div>
                  ) : null}

                  {(previewSelection.view === 'preTest' || previewSelection.view === 'postTest' || previewSelection.view === 'finalExam') && previewCurrentQuiz ? (
                    <div className="space-y-6">
                      <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-5">
                        <div className="grid gap-3 md:grid-cols-3 text-sm text-slate-300">
                          <div>Passing: {previewCurrentQuiz.passing_score}%</div>
                          <div>Time: {previewCurrentQuiz.time_limit_minutes} min</div>
                          <div>Attempts: {previewCurrentQuiz.attempt_limit}</div>
                        </div>
                      </div>
                      {(questionsByQuiz.get(previewCurrentQuiz.id) ?? []).map((question, questionIndex) => (
                        <div key={question.id} className="rounded-3xl border border-white/10 bg-slate-950/60 p-5">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                            Question {questionIndex + 1}
                          </p>
                          <p className="mt-2 text-base font-semibold text-white">{question.prompt}</p>
                          <div className="mt-4 grid gap-2 text-sm text-slate-300">
                            {(answersByQuestion.get(question.id) ?? []).map((answer) => (
                              <p
                                key={answer.id}
                                className="rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-2"
                              >
                                {answer.answer_text}
                              </p>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {previewSelection.view === 'finalExam' && !previewCurrentQuiz ? (
                    <p className="rounded-3xl border border-white/10 bg-slate-950/60 p-5 text-sm text-slate-400">
                      Final exam has not been created yet.
                    </p>
                  ) : null}
                </div>

                <div className="flex items-center justify-between border-t border-white/10 bg-slate-950 px-5 py-3">
                  <button
                    disabled={previewIndex <= 0}
                    onClick={() => {
                      const previous = sequence[previewIndex - 1];
                      if (previous) setPreviewSelection(previous.selection);
                    }}
                    className="inline-flex items-center gap-1 rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold text-slate-200 disabled:opacity-40"
                  >
                    <ChevronLeft size={14} /> Previous
                  </button>
                  <p className="text-xs font-semibold text-slate-400">
                    {previewIndex >= 0 ? `${previewIndex + 1} / ${sequence.length}` : `0 / ${sequence.length}`}
                  </p>
                  <button
                    disabled={previewIndex < 0 || previewIndex >= sequence.length - 1}
                    onClick={() => {
                      const next = sequence[previewIndex + 1];
                      if (next) setPreviewSelection(next.selection);
                    }}
                    className="inline-flex items-center gap-1 rounded-full bg-brand-500 px-3 py-1.5 text-xs font-semibold text-slate-950 disabled:opacity-40"
                  >
                    Next <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
