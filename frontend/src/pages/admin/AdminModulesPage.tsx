
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Eye, Plus, Search, Trash2, Upload } from 'lucide-react';
import {
  createLesson,
  createLessonContent,
  createModule,
  createQuestionAnswer,
  createQuiz,
  createQuizQuestion,
  createTopic,
  deleteLesson,
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
  | { view: 'preTest' }
  | { view: 'lesson'; lessonId: number }
  | { view: 'topic'; lessonId: number; topicId: number }
  | { view: 'postTest'; lessonId: number }
  | { view: 'finalExam' };

type AddType = 'preTest' | 'lesson' | 'topic' | 'postTest';

type ModuleForm = {
  title: string;
  description: string;
  category: string;
  thumbnailUrl: string;
  prerequisiteModuleId: number | null;
  isActive: boolean;
  isLocked: boolean;
};

const MODULE_CATEGORIES = ['Hardware', 'Software', 'Networking', 'Security', 'General'];

const defaultModuleForm: ModuleForm = {
  title: '',
  description: '',
  category: 'Hardware',
  thumbnailUrl: '',
  prerequisiteModuleId: null,
  isActive: false,
  isLocked: false,
};

function selectionKey(selection: BuilderSelection): string {
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

function isVideoMediaUrl(url: string | null | undefined) {
  if (!url) return false;
  return /^(data:video\/|https?:\/\/.*\.(mp4|webm|ogg|mov)(\?.*)?$)/i.test(url);
}

export function AdminModulesPage() {
  const [modules, setModules] = useState<ModuleSummary[]>([]);
  const [builder, setBuilder] = useState<ModuleBuilderPayload | null>(null);
  const [selection, setSelection] = useState<BuilderSelection>({ view: 'preTest' });
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

  const [previewSelection, setPreviewSelection] = useState<BuilderSelection>({ view: 'preTest' });
  const lessonContentEditorRef = useRef<HTMLDivElement | null>(null);
  const topicContentEditorRef = useRef<HTMLDivElement | null>(null);

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
    return { view: 'preTest' };
  };

  const selectionExists = (payload: ModuleBuilderPayload, target: BuilderSelection) => {
    if (target.view === 'preTest') return true;
    if (target.view === 'finalExam') return true;
    if (target.view === 'lesson') return payload.lessons.some((lesson) => lesson.id === target.lessonId);
    if (target.view === 'topic') return payload.topics.some((topic) => topic.id === target.topicId && topic.lesson_id === target.lessonId);
    return payload.lessons.some((lesson) => lesson.id === target.lessonId);
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
  const selectedTopicPrimaryContent = selectedContentBlocks[0] ?? null;

  useEffect(() => {
    if (selection.view !== 'topic' || !currentTopic || !topicContentEditorRef.current) return;
    topicContentEditorRef.current.innerHTML = sanitizeRichHtml(selectedTopicPrimaryContent?.body_text ?? '');
  }, [selection.view, currentTopic?.id, selectedTopicPrimaryContent?.id, selectedTopicPrimaryContent?.body_text]);

  const sequence = useMemo(() => {
    const list: Array<{ label: string; selection: BuilderSelection }> = [{ label: 'Pre-Test', selection: { view: 'preTest' } }];
    for (const lesson of lessons) {
      list.push({ label: `Lesson ${lesson.sequence_no}: ${lesson.title}`, selection: { view: 'lesson', lessonId: lesson.id } });
      const topics = topicsByLesson.get(lesson.id) ?? [];
      for (const topic of topics) {
        list.push({
          label: `Topic ${topic.sort_order}: ${topic.title}`,
          selection: { view: 'topic', lessonId: lesson.id, topicId: topic.id },
        });
      }
      list.push({ label: `Lesson ${lesson.sequence_no} Post-Test`, selection: { view: 'postTest', lessonId: lesson.id } });
    }
    list.push({ label: 'Final Exam', selection: { view: 'finalExam' } });
    return list;
  }, [lessons, topicsByLesson]);

  const selectionIndex = sequence.findIndex((item) => sameSelection(item.selection, selection));
  const previewIndex = sequence.findIndex((item) => sameSelection(item.selection, previewSelection));

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

  const openModuleEdit = (module: ModuleSummary) => {
    setEditModuleId(module.id);
    setEditForm({
      title: module.title,
      description: module.description,
      category: module.category ?? 'Hardware',
      thumbnailUrl: module.thumbnail_url ?? '',
      prerequisiteModuleId: module.prerequisite_module_id,
      isActive: module.is_active,
      isLocked: module.is_locked,
    });
    setShowEditModal(true);
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
      if (createForm.isActive !== true || createForm.isLocked || createForm.prerequisiteModuleId !== null) {
        await updateModule(created.module.id, {
          isActive: createForm.isActive,
          isLocked: createForm.isLocked,
          prerequisiteModuleId: createForm.prerequisiteModuleId,
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
        prerequisiteModuleId: editForm.prerequisiteModuleId,
        isActive: editForm.isActive,
        isLocked: editForm.isLocked,
      });
      await loadModules();
      if (builder && builder.module.id === editModuleId) await loadBuilder(editModuleId, selection);
      setShowEditModal(false);
    });
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
    updateLessonLocal(currentLesson.id, { overview_text: lessonContentHtml });
    await run(async () => {
      await updateLesson(currentLesson.id, {
        title: currentLesson.title,
        summary: currentLesson.summary,
        estimatedMinutes: currentLesson.estimated_minutes,
        overviewText: lessonContentHtml,
        overviewImageUrl: currentLesson.overview_image_url ?? '',
        isPublished: currentLesson.is_published ?? true,
      });
      await loadBuilder(builder.module.id, { view: 'lesson', lessonId: currentLesson.id });
    });
  };

  const saveCurrentTopic = async () => {
    if (!builder || !currentTopic) return;
    const topicContentHtml = sanitizeRichHtml(topicContentEditorRef.current?.innerHTML ?? selectedContentBlocks[0]?.body_text ?? '');
    const primaryContentBlock = selectedContentBlocks[0] ?? null;
    if (primaryContentBlock) {
      updateContentLocal(primaryContentBlock.id, { title: currentTopic.title, body_text: topicContentHtml });
    }
    await run(async () => {
      await updateTopic(currentTopic.id, {
        title: currentTopic.title,
        summary: currentTopic.summary,
        sortOrder: currentTopic.sort_order,
        isPublished: currentTopic.is_published,
      });
      if (primaryContentBlock) {
        await updateLessonContent(primaryContentBlock.id, {
          topicId: currentTopic.id,
          contentType: primaryContentBlock.content_type,
          title: currentTopic.title,
          bodyText: topicContentHtml,
          contentUrl: primaryContentBlock.content_url ?? '',
          simulationKey: primaryContentBlock.simulation_key ?? '',
          sortOrder: primaryContentBlock.sort_order,
          isRequired: primaryContentBlock.is_required,
        });
      } else if (topicContentHtml.trim()) {
        await createLessonContent({
          topicId: currentTopic.id,
          contentType: 'text',
          title: currentTopic.title,
          bodyText: topicContentHtml,
          sortOrder: 1,
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

  const saveQuestion = async (question: QuizQuestionRow) => {
    if (!builder) return;
    const answers = answersByQuestion.get(question.id) ?? [];
    if (!answers.length) {
      setError('Each question needs at least one choice.');
      return;
    }
    if (!answers.some((answer) => Boolean(answer.is_correct))) {
      setError('Mark one correct choice before saving the question.');
      return;
    }
    await run(async () => {
      await updateQuizQuestion(question.id, { prompt: question.prompt, points: question.points, sortOrder: question.sort_order });
      await Promise.all(
        answers.map((answer) =>
          updateQuestionAnswer(question.id, answer.id, {
            answerText: answer.answer_text,
            isCorrect: Boolean(answer.is_correct),
            explanation: answer.explanation ?? '',
            sortOrder: answer.sort_order,
          })
        )
      );
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

  const setSingleCorrectAnswerLocally = (questionId: number, answerId: number) => {
    setBuilder((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        answers: prev.answers.map((answer) => {
          if (answer.question_id !== questionId) return answer;
          return { ...answer, is_correct: answer.id === answerId };
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

  const uploadLessonMedia = async (file: File) => {
    if (!currentLesson) return;
    const dataUrl = await toDataUrl(file);
    updateLessonLocal(currentLesson.id, { overview_image_url: dataUrl });
  };

  const uploadTopicMedia = async (file: File) => {
    if (!builder || !currentTopic) return;
    const dataUrl = await toDataUrl(file);
    const contentType: LessonContentBlock['content_type'] = file.type.startsWith('video/') ? 'video' : 'image';
    const primaryContentBlock = selectedContentBlocks[0] ?? null;
    const topicContentHtml = sanitizeRichHtml(topicContentEditorRef.current?.innerHTML ?? primaryContentBlock?.body_text ?? '');

    if (primaryContentBlock) {
      updateContentLocal(primaryContentBlock.id, {
        title: currentTopic.title,
        body_text: topicContentHtml,
        content_type: contentType,
        content_url: dataUrl,
      });
    }

    await run(async () => {
      if (primaryContentBlock) {
        await updateLessonContent(primaryContentBlock.id, {
          topicId: currentTopic.id,
          contentType,
          title: currentTopic.title,
          bodyText: topicContentHtml,
          contentUrl: dataUrl,
          simulationKey: primaryContentBlock.simulation_key ?? '',
          sortOrder: primaryContentBlock.sort_order,
          isRequired: primaryContentBlock.is_required,
        });
      } else {
        await createLessonContent({
          topicId: currentTopic.id,
          contentType,
          title: currentTopic.title,
          bodyText: topicContentHtml,
          contentUrl: dataUrl,
          sortOrder: 1,
        });
      }
      await loadBuilder(builder.module.id, { view: 'topic', lessonId: currentTopic.lesson_id, topicId: currentTopic.id });
    });
  };

  const applyLessonContentCommand = (command: string, value?: string) => {
    const editor = lessonContentEditorRef.current;
    if (!editor) return;
    editor.focus();
    document.execCommand(command, false, value ?? null);
  };

  const applyTopicContentCommand = (command: string, value?: string) => {
    const editor = topicContentEditorRef.current;
    if (!editor) return;
    editor.focus();
    document.execCommand(command, false, value ?? null);
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
  const previewCurrentTopic =
    previewSelection.view === 'topic' ? builder?.topics.find((topic) => topic.id === previewSelection.topicId) ?? null : null;
  const previewTopicContent = previewCurrentTopic ? contentByTopic.get(previewCurrentTopic.id) ?? [] : [];
  const previewTopicPrimaryContent = previewTopicContent[0] ?? null;

  return (
    <section className="space-y-5">
      {error ? <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}

      {!builder ? (
        <div className="space-y-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-300">Content Authoring</p>
              <h2 className="mt-1 text-2xl font-bold text-white">Modules</h2>
              <p className="mt-1 text-sm text-slate-300">Create modules, update module details, and open the full builder.</p>
            </div>
            <div className="flex w-full flex-wrap items-center justify-end gap-2 lg:w-auto">
              <div className="relative w-full max-w-md">
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
                className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500"
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
                    {module.category ?? 'General'}
                  </span>
                  <button
                    onClick={() => openModuleEdit(module)}
                    className="rounded-md border border-white/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-200 hover:bg-white/10"
                  >
                    Edit
                  </button>
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
                <button
                  onClick={() => void run(async () => loadBuilder(module.id))}
                  className="mt-4 rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-500"
                >
                  Open Builder
                </button>
              </article>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-xl border border-white/10 bg-slate-900/70">
            <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-3">
              <p className="font-semibold text-brand-300">HelpDesk Academy</p>
              <button onClick={() => openAddNodeModal('preTest')} className="rounded-full border border-white/10 bg-slate-800/70 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700">Pre-Test</button>
              <button onClick={() => openAddNodeModal('lesson')} className="rounded-full border border-white/10 bg-slate-800/70 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700">Add Lesson</button>
              <button onClick={() => openAddNodeModal('topic')} className="rounded-full border border-white/10 bg-slate-800/70 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700">Add Topic</button>
              <button onClick={() => openAddNodeModal('postTest')} className="rounded-full border border-white/10 bg-slate-800/70 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700">Post-Test</button>
              <button onClick={() => void handleAddFinalExam()} className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/20">Final Exam</button>
              <div className="ml-auto flex items-center gap-2">
                <span className="rounded-full border border-white/10 bg-slate-800/70 px-3 py-1 text-[11px] font-semibold text-slate-300">{sequence.length} pages</span>
                <button onClick={openPreview} className="inline-flex items-center gap-1 rounded-full border border-brand-400/50 px-3 py-1.5 text-xs font-semibold text-brand-300 hover:bg-brand-500/10"><Eye size={13} />Preview</button>
                <button onClick={() => setBuilder(null)} className="inline-flex items-center gap-1 rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/10"><ArrowLeft size={13} />Back</button>
              </div>
            </div>

            <div className="grid gap-3 p-3 xl:grid-cols-[260px_1fr]">
              <aside className="rounded-xl border border-white/10 bg-slate-900/90 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400">Learning Structure</p>
                <div className="mt-3 space-y-2">
                  <button onClick={() => setSelection({ view: 'preTest' })} className={`w-full rounded-full border px-3 py-2 text-left text-sm ${selection.view === 'preTest' ? 'border-violet-400/40 bg-violet-500/20 text-violet-100' : 'border-white/15 bg-slate-800/70 text-slate-200'}`}>Pre-Test</button>
                  {lessons.map((lesson) => (
                    <div key={lesson.id} className="rounded-xl border border-white/10 bg-slate-800/70 p-2">
                      <button onClick={() => setSelection({ view: 'lesson', lessonId: lesson.id })} className={`w-full rounded-full px-3 py-1.5 text-left text-sm ${selection.view === 'lesson' && selection.lessonId === lesson.id ? 'bg-brand-500 text-slate-950 font-semibold' : 'text-slate-200'}`}>
                        Lesson {lesson.sequence_no}: {lesson.title}
                      </button>
                      <div className="mt-2 space-y-1 border-l border-white/10 pl-3">
                        {(topicsByLesson.get(lesson.id) ?? []).map((topic) => (
                          <button key={topic.id} onClick={() => setSelection({ view: 'topic', lessonId: lesson.id, topicId: topic.id })} className={`block w-full rounded-full px-2 py-1 text-left text-xs ${selection.view === 'topic' && selection.topicId === topic.id ? 'bg-emerald-500/25 text-emerald-100' : 'text-slate-300 hover:bg-white/10'}`}>
                            Topic {topic.sort_order}: {topic.title}
                          </button>
                        ))}
                        <button onClick={() => setSelection({ view: 'postTest', lessonId: lesson.id })} className={`block w-full rounded-full px-2 py-1 text-left text-xs ${selection.view === 'postTest' && selection.lessonId === lesson.id ? 'bg-orange-500/25 text-orange-100' : 'text-slate-300 hover:bg-white/10'}`}>Post-Test</button>
                      </div>
                    </div>
                  ))}
                  <button onClick={() => setSelection({ view: 'finalExam' })} className={`w-full rounded-full border px-3 py-2 text-left text-sm ${selection.view === 'finalExam' ? 'border-amber-400/40 bg-amber-500/20 text-amber-100' : 'border-white/15 bg-slate-800/70 text-slate-200'}`}>Final Exam</button>
                </div>
              </aside>

              <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-900/90">
                <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
                  <p className="text-xs text-slate-300">{sequence[selectionIndex]?.label ?? 'Builder'}</p>
                  <div className="ml-auto">
                    <button onClick={() => void handleDeleteCurrentSelection()} className="inline-flex items-center gap-1 rounded-full border border-rose-400/40 px-3 py-1.5 text-xs font-semibold text-rose-200 hover:bg-rose-500/10"><Trash2 size={13} />Delete Page</button>
                  </div>
                </div>

                <div className="max-h-[calc(100vh-22rem)] space-y-4 overflow-y-auto p-4">
                  {selection.view === 'lesson' && currentLesson ? (
                    <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-950/40 p-5">
                      <div className="grid gap-3 md:grid-cols-2">
                        <label className="space-y-1"><span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Lesson Title</span><input value={currentLesson.title} onChange={(event) => updateLessonLocal(currentLesson.id, { title: event.target.value })} className="w-full rounded-md border border-white/15 bg-slate-900/70 px-3 py-2 text-sm text-slate-100" /></label>
                        <label className="space-y-1"><span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Estimated Minutes</span><input type="number" min={1} value={currentLesson.estimated_minutes} onChange={(event) => updateLessonLocal(currentLesson.id, { estimated_minutes: Number(event.target.value) || 1 })} className="w-full rounded-md border border-white/15 bg-slate-900/70 px-3 py-2 text-sm text-slate-100" /></label>
                      </div>
                      <label className="space-y-1">
                        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Lesson Content</span>
                        <div className="overflow-hidden rounded-md border border-white/15 bg-slate-900/70">
                          <div className="flex flex-wrap items-center gap-1 border-b border-white/10 p-2">
                            <button type="button" onClick={() => applyLessonContentCommand('bold')} className="rounded border border-white/15 px-2 py-1 text-xs text-slate-200">B</button>
                            <button type="button" onClick={() => applyLessonContentCommand('italic')} className="rounded border border-white/15 px-2 py-1 text-xs italic text-slate-200">I</button>
                            <button type="button" onClick={() => applyLessonContentCommand('underline')} className="rounded border border-white/15 px-2 py-1 text-xs underline text-slate-200">U</button>
                            <button type="button" onClick={() => applyLessonContentCommand('insertUnorderedList')} className="rounded border border-white/15 px-2 py-1 text-xs text-slate-200">• List</button>
                            <button type="button" onClick={() => applyLessonContentCommand('insertOrderedList')} className="rounded border border-white/15 px-2 py-1 text-xs text-slate-200">1. List</button>
                            <select
                              defaultValue=""
                              onChange={(event) => {
                                const value = event.target.value;
                                if (!value) return;
                                applyLessonContentCommand('fontSize', value);
                                event.target.value = '';
                              }}
                              className="rounded border border-white/15 bg-slate-900 px-2 py-1 text-xs text-slate-200"
                            >
                              <option value="">Size</option>
                              <option value="2">Small</option>
                              <option value="3">Normal</option>
                              <option value="5">Large</option>
                              <option value="6">X-Large</option>
                            </select>
                            <select
                              defaultValue=""
                              onChange={(event) => {
                                const value = event.target.value;
                                if (!value) return;
                                applyLessonContentCommand('foreColor', value);
                                event.target.value = '';
                              }}
                              className="rounded border border-white/15 bg-slate-900 px-2 py-1 text-xs text-slate-200"
                            >
                              <option value="">Color</option>
                              <option value="#f5c800">Yellow</option>
                              <option value="#4a8fe8">Blue</option>
                              <option value="#4caf7d">Green</option>
                              <option value="#e05c5c">Red</option>
                              <option value="#e8eaf0">White</option>
                            </select>
                            <button type="button" onClick={() => applyLessonContentCommand('removeFormat')} className="rounded border border-white/15 px-2 py-1 text-xs text-slate-200">Clear</button>
                          </div>
                          <div
                            ref={lessonContentEditorRef}
                            contentEditable
                            suppressContentEditableWarning
                            onBlur={(event) => {
                              updateLessonLocal(currentLesson.id, { overview_text: sanitizeRichHtml(event.currentTarget.innerHTML) });
                            }}
                            className="min-h-[180px] p-3 text-sm text-slate-100 outline-none"
                          />
                        </div>
                      </label>
                      <div className="space-y-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Upload Photo/Video</span>
                        <label className="flex min-h-[220px] cursor-pointer flex-col items-center justify-center gap-3 rounded-md border-2 border-dashed border-white/25 bg-slate-900/60 p-6 text-center hover:border-brand-400/70 hover:bg-slate-900/80">
                          {currentLesson.overview_image_url ? (
                            isVideoMediaUrl(currentLesson.overview_image_url) ? (
                              <video src={currentLesson.overview_image_url} controls className="max-h-[220px] w-full rounded-md object-contain" />
                            ) : (
                              <img src={currentLesson.overview_image_url} alt={currentLesson.title} className="max-h-[220px] w-full rounded-md object-contain" />
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
                                await uploadLessonMedia(file);
                              });
                            }}
                          />
                        </label>
                      </div>
                      <div><button onClick={() => void saveCurrentLesson()} className="rounded-full bg-brand-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-brand-400">Save Lesson</button></div>
                    </div>
                  ) : null}

                  {selection.view === 'topic' && currentTopic ? (
                    <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-950/40 p-5">
                      <div className="grid gap-3 md:grid-cols-2">
                        <label className="space-y-1"><span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Topic Title</span><input value={currentTopic.title} onChange={(event) => updateTopicLocal(currentTopic.id, { title: event.target.value })} className="w-full rounded-md border border-white/15 bg-slate-900/70 px-3 py-2 text-sm text-slate-100" /></label>
                        <label className="space-y-1"><span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Topic Order</span><input type="number" min={1} value={currentTopic.sort_order} onChange={(event) => updateTopicLocal(currentTopic.id, { sort_order: Number(event.target.value) || 1 })} className="w-full rounded-md border border-white/15 bg-slate-900/70 px-3 py-2 text-sm text-slate-100" /></label>
                      </div>
                      <div className="space-y-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Topic Content</span>
                        <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
                          <div className="rounded-md border border-white/15 bg-slate-900/70">
                            <div className="flex flex-wrap items-center gap-2 border-b border-white/10 p-2">
                              <button type="button" onClick={() => applyTopicContentCommand('bold')} className="rounded border border-white/15 px-2 py-1 text-xs text-slate-200">B</button>
                              <button type="button" onClick={() => applyTopicContentCommand('italic')} className="rounded border border-white/15 px-2 py-1 text-xs italic text-slate-200">I</button>
                              <button type="button" onClick={() => applyTopicContentCommand('underline')} className="rounded border border-white/15 px-2 py-1 text-xs underline text-slate-200">U</button>
                              <button type="button" onClick={() => applyTopicContentCommand('insertUnorderedList')} className="rounded border border-white/15 px-2 py-1 text-xs text-slate-200">• List</button>
                              <button type="button" onClick={() => applyTopicContentCommand('insertOrderedList')} className="rounded border border-white/15 px-2 py-1 text-xs text-slate-200">1. List</button>
                              <select
                                defaultValue=""
                                onChange={(event) => {
                                  const value = event.target.value;
                                  if (!value) return;
                                  applyTopicContentCommand('fontSize', value);
                                  event.target.value = '';
                                }}
                                className="rounded border border-white/15 bg-slate-900 px-2 py-1 text-xs text-slate-200"
                              >
                                <option value="">Size</option>
                                <option value="1">Small</option>
                                <option value="3">Normal</option>
                                <option value="5">Large</option>
                                <option value="7">X-Large</option>
                              </select>
                              <select
                                defaultValue=""
                                onChange={(event) => {
                                  const value = event.target.value;
                                  if (!value) return;
                                  applyTopicContentCommand('foreColor', value);
                                  event.target.value = '';
                                }}
                                className="rounded border border-white/15 bg-slate-900 px-2 py-1 text-xs text-slate-200"
                              >
                                <option value="">Color</option>
                                <option value="#f5c800">Yellow</option>
                                <option value="#4a8fe8">Blue</option>
                                <option value="#4caf7d">Green</option>
                                <option value="#e05c5c">Red</option>
                                <option value="#e8eaf0">White</option>
                              </select>
                              <button type="button" onClick={() => applyTopicContentCommand('removeFormat')} className="rounded border border-white/15 px-2 py-1 text-xs text-slate-200">Clear</button>
                            </div>
                            <div
                              ref={topicContentEditorRef}
                              contentEditable
                              suppressContentEditableWarning
                              onBlur={(event) => {
                                const topicBody = sanitizeRichHtml(event.currentTarget.innerHTML);
                                if (selectedTopicPrimaryContent) {
                                  updateContentLocal(selectedTopicPrimaryContent.id, { body_text: topicBody, title: currentTopic.title });
                                }
                              }}
                              className="min-h-[280px] p-3 text-sm text-slate-100 outline-none"
                            />
                          </div>
                          <div className="space-y-2">
                            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Upload Photo/Video</span>
                            <label className="flex min-h-[280px] cursor-pointer flex-col items-center justify-center gap-3 rounded-md border-2 border-dashed border-white/25 bg-slate-900/60 p-6 text-center hover:border-brand-400/70 hover:bg-slate-900/80">
                              {selectedTopicPrimaryContent?.content_url ? (
                                isVideoMediaUrl(selectedTopicPrimaryContent.content_url) ? (
                                  <video src={selectedTopicPrimaryContent.content_url} controls className="max-h-[260px] w-full rounded-md object-contain" />
                                ) : (
                                  <img src={selectedTopicPrimaryContent.content_url} alt={currentTopic.title} className="max-h-[260px] w-full rounded-md object-contain" />
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
                                  void uploadTopicMedia(file);
                                }}
                              />
                            </label>
                          </div>
                        </div>
                      </div>
                      <div><button onClick={() => void saveCurrentTopic()} className="rounded-full bg-brand-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-brand-400">Save Topic</button></div>
                    </div>
                  ) : null}

                  {selection.view !== 'lesson' && selection.view !== 'topic' ? (
                    <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-950/40 p-5">
                      {!currentQuiz ? (
                        <div className="space-y-2"><p className="text-sm text-slate-300">No assessment is configured for this stage yet.</p><button onClick={() => void createCurrentAssessment()} className="rounded-full bg-brand-500 px-4 py-2 text-xs font-semibold text-slate-950">Create Assessment</button></div>
                      ) : (
                        <>
                          <div className="grid gap-3 md:grid-cols-2">
                            <label className="space-y-1 md:col-span-2"><span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Quiz Title</span><input value={currentQuiz.title} onChange={(event) => updateQuizLocal(currentQuiz.id, { title: event.target.value })} className="w-full rounded-md border border-white/15 bg-slate-900/70 px-3 py-2 text-sm text-slate-100" /></label>
                            <label className="space-y-1"><span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Passing Score</span><input type="number" min={0} max={100} value={currentQuiz.passing_score} onChange={(event) => updateQuizLocal(currentQuiz.id, { passing_score: Number(event.target.value) || 0 })} className="w-full rounded-md border border-white/15 bg-slate-900/70 px-3 py-2 text-sm text-slate-100" /></label>
                            <label className="space-y-1"><span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Time Limit (minutes)</span><input type="number" min={1} value={currentQuiz.time_limit_minutes} onChange={(event) => updateQuizLocal(currentQuiz.id, { time_limit_minutes: Number(event.target.value) || 1 })} className="w-full rounded-md border border-white/15 bg-slate-900/70 px-3 py-2 text-sm text-slate-100" /></label>
                            <label className="space-y-1"><span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Attempt Limit</span><input type="number" min={1} value={currentQuiz.attempt_limit} onChange={(event) => updateQuizLocal(currentQuiz.id, { attempt_limit: Number(event.target.value) || 1 })} className="w-full rounded-md border border-white/15 bg-slate-900/70 px-3 py-2 text-sm text-slate-100" /></label>
                            <label className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-slate-900/70 px-3 py-2 text-sm text-slate-200"><input type="checkbox" checked={currentQuiz.is_active} onChange={(event) => updateQuizLocal(currentQuiz.id, { is_active: event.target.checked })} />Active</label>
                          </div>
                          <div className="border-t border-white/10 pt-3">
                            <button onClick={() => void saveCurrentQuiz()} className="rounded-full bg-brand-500 px-4 py-2 text-xs font-semibold text-slate-950">Save Assessment</button>
                          </div>
                          <div className="space-y-3 rounded-xl border border-white/10 bg-slate-900/40 p-3">
                            <div className="flex items-center">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-400">Questions</p>
                            </div>
                            {selectedQuestions.length === 0 ? (
                              <div className="rounded-lg border border-dashed border-white/15 bg-slate-950/30 p-4 text-center">
                                <p className="text-sm text-slate-400">No questions yet.</p>
                                <button
                                  type="button"
                                  onClick={() => void addQuestion()}
                                  className="mt-3 rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-900"
                                >
                                  + Add First Question
                                </button>
                              </div>
                            ) : (
                              selectedQuestions.map((question, questionIndex) => {
                                const answers = answersByQuestion.get(question.id) ?? [];
                                return (
                                  <div key={question.id} className="space-y-3 rounded-xl border border-white/10 bg-slate-900/70 p-3">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-400">
                                      Question {questionIndex + 1}
                                    </p>
                                    <div className="grid gap-2 md:grid-cols-[1fr_110px]">
                                      <input
                                        value={question.prompt}
                                        onChange={(event) => updateQuestionLocal(question.id, { prompt: event.target.value })}
                                        className="rounded-md border border-white/15 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
                                      />
                                      <input
                                        type="number"
                                        min={1}
                                        value={question.points}
                                        onChange={(event) => updateQuestionLocal(question.id, { points: Number(event.target.value) || 1 })}
                                        className="rounded-md border border-white/15 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
                                      />
                                    </div>
                                    <div className="space-y-2 border-t border-white/10 pt-3">
                                      {answers.map((answer, answerIndex) => (
                                        <div
                                          key={answer.id}
                                          className={`grid gap-2 rounded-lg border p-2.5 md:grid-cols-[24px_1fr_auto] ${
                                            answer.is_correct
                                              ? 'border-emerald-400/50 bg-emerald-500/10'
                                              : 'border-white/10 bg-slate-950/60'
                                          }`}
                                        >
                                          <input
                                            type="radio"
                                            name={`correct-${question.id}`}
                                            checked={Boolean(answer.is_correct)}
                                            onChange={() => setSingleCorrectAnswerLocally(question.id, answer.id)}
                                          />
                                          <input
                                            value={answer.answer_text}
                                            onChange={(event) => updateAnswerLocal(answer.id, { answer_text: event.target.value })}
                                            placeholder={`Choice ${answerIndex + 1}`}
                                            className="rounded-md border border-white/15 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
                                          />
                                          <button
                                            type="button"
                                            onClick={() => void removeAnswer(question.id, answer.id)}
                                            className="rounded-md border border-rose-400/40 px-2 py-1 text-[11px] font-semibold text-rose-200"
                                          >
                                            Delete
                                          </button>
                                        </div>
                                      ))}
                                      <div className="flex items-center justify-between">
                                        <p className="text-xs text-slate-400">Mark the correct choice using the radio button.</p>
                                        <button
                                          type="button"
                                          onClick={() => void addChoice(question.id)}
                                          className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-slate-200"
                                        >
                                          Add Choice
                                        </button>
                                      </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2 border-t border-white/10 pt-2">
                                      <button
                                        type="button"
                                        onClick={() => void saveQuestion(question)}
                                        className="rounded-full bg-brand-500 px-3 py-1.5 text-xs font-semibold text-slate-950"
                                      >
                                        Save Question
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => void removeQuestion(question.id)}
                                        className="rounded-full border border-rose-400/40 px-3 py-1.5 text-xs font-semibold text-rose-200"
                                      >
                                        Delete Question
                                      </button>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                            {selectedQuestions.length > 0 ? (
                              <div className="flex justify-center pt-1">
                                <button
                                  type="button"
                                  onClick={() => void addQuestion()}
                                  className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-900"
                                >
                                  + Add Question
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-900/70 px-4 py-2.5">
            <button disabled={selectionIndex <= 0} onClick={() => { const previous = sequence[selectionIndex - 1]; if (previous) setSelection(previous.selection); }} className="inline-flex items-center gap-1 rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-slate-200 disabled:opacity-40"><ChevronLeft size={14} />Previous</button>
            <p className="text-xs font-semibold text-slate-400">{sequence[selectionIndex]?.label ?? 'Builder'}</p>
            <button disabled={selectionIndex < 0 || selectionIndex >= sequence.length - 1} onClick={() => { const next = sequence[selectionIndex + 1]; if (next) setSelection(next.selection); }} className="inline-flex items-center gap-1 rounded-full bg-brand-500 px-3 py-1.5 text-xs font-semibold text-slate-950 disabled:opacity-40">Next<ChevronRight size={14} /></button>
          </div>
        </div>
      )}

      {showCreateModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <form onSubmit={handleCreateModule} className="w-full max-w-2xl rounded-xl border border-white/10 bg-slate-900 p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between"><h3 className="text-xl font-bold text-white">Create Module</h3><button type="button" onClick={() => setShowCreateModal(false)} className="rounded-md border border-white/20 px-3 py-2 text-sm font-semibold text-slate-200">Close</button></div>
            <div className="grid gap-3 md:grid-cols-2">
              <input required value={createForm.title} onChange={(event) => setCreateForm((prev) => ({ ...prev, title: event.target.value }))} placeholder="Module title" className="rounded-md border border-white/20 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 md:col-span-2" />
              <select value={createForm.category} onChange={(event) => setCreateForm((prev) => ({ ...prev, category: event.target.value }))} className="rounded-md border border-white/20 bg-slate-950/70 px-3 py-2 text-sm text-slate-100">{MODULE_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}</select>
              <input value={createForm.thumbnailUrl} onChange={(event) => setCreateForm((prev) => ({ ...prev, thumbnailUrl: event.target.value }))} placeholder="Thumbnail URL" className="rounded-md border border-white/20 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" />
              <textarea required value={createForm.description} onChange={(event) => setCreateForm((prev) => ({ ...prev, description: event.target.value }))} placeholder="Module description" className="h-24 rounded-md border border-white/20 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 md:col-span-2" />
              <select value={createForm.prerequisiteModuleId ?? ''} onChange={(event) => setCreateForm((prev) => ({ ...prev, prerequisiteModuleId: event.target.value ? Number(event.target.value) : null }))} className="rounded-md border border-white/20 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"><option value="">No prerequisite</option>{modules.map((module) => <option key={module.id} value={module.id}>{module.title}</option>)}</select>
              <label className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-slate-950/60 px-3 py-2 text-sm text-slate-200"><input type="checkbox" checked={createForm.isActive} onChange={(event) => setCreateForm((prev) => ({ ...prev, isActive: event.target.checked }))} />Published</label>
              <label className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-slate-950/60 px-3 py-2 text-sm text-slate-200"><input type="checkbox" checked={createForm.isLocked} onChange={(event) => setCreateForm((prev) => ({ ...prev, isLocked: event.target.checked }))} />Locked</label>
              <div className="md:col-span-2 flex justify-end"><button disabled={busy} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white">{busy ? 'Creating...' : 'Create Module'}</button></div>
            </div>
          </form>
        </div>
      ) : null}

      {showEditModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <form onSubmit={handleUpdateModule} className="w-full max-w-5xl rounded-xl border border-white/10 bg-slate-900 p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between">
              <h3 className="text-xl font-bold text-white">Edit Module Details</h3>
              <button type="button" onClick={() => setShowEditModal(false)} className="rounded-md border border-white/20 px-3 py-2 text-sm font-semibold text-slate-200">
                Close
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
                    {editForm.category || 'General'}
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

                  <p className="mt-3 text-xs text-slate-400">
                    Prerequisite:{' '}
                    <span className="text-slate-200">
                      {editForm.prerequisiteModuleId
                        ? modules.find((module) => module.id === editForm.prerequisiteModuleId)?.title ?? 'Selected module'
                        : 'None'}
                    </span>
                  </p>
                </div>
              </article>

              <div className="grid gap-3 md:grid-cols-2">
                <input
                  required
                  value={editForm.title}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="Module title"
                  className="rounded-md border border-white/20 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 md:col-span-2"
                />
                <select
                  value={editForm.category}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, category: event.target.value }))}
                  className="rounded-md border border-white/20 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
                >
                  {MODULE_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
                <select
                  value={editForm.prerequisiteModuleId ?? ''}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, prerequisiteModuleId: event.target.value ? Number(event.target.value) : null }))}
                  className="rounded-md border border-white/20 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
                >
                  <option value="">No prerequisite</option>
                  {modules
                    .filter((module) => module.id !== editModuleId)
                    .map((module) => (
                      <option key={module.id} value={module.id}>
                        {module.title}
                      </option>
                    ))}
                </select>
                <input
                  value={editForm.thumbnailUrl}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, thumbnailUrl: event.target.value }))}
                  placeholder="Thumbnail URL"
                  className="rounded-md border border-white/20 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 md:col-span-2"
                />
                <textarea
                  required
                  value={editForm.description}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="Module description"
                  className="h-28 rounded-md border border-white/20 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 md:col-span-2"
                />
                <label className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-slate-950/60 px-3 py-2 text-sm text-slate-200">
                  <input type="checkbox" checked={editForm.isActive} onChange={(event) => setEditForm((prev) => ({ ...prev, isActive: event.target.checked }))} />
                  Published
                </label>
                <label className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-slate-950/60 px-3 py-2 text-sm text-slate-200">
                  <input type="checkbox" checked={editForm.isLocked} onChange={(event) => setEditForm((prev) => ({ ...prev, isLocked: event.target.checked }))} />
                  Locked
                </label>
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
          <div className="h-[90vh] w-full max-w-6xl overflow-hidden rounded-2xl border border-white/10 bg-slate-950">
            <div className="flex items-center justify-between border-b border-white/10 bg-slate-900 px-5 py-3"><h3 className="text-lg font-bold text-white">Student Preview</h3><button onClick={() => setShowPreviewModal(false)} className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-slate-200">Close</button></div>
            <div className="grid h-[calc(90vh-61px)] xl:grid-cols-[260px_1fr]">
              <aside className="overflow-y-auto border-r border-white/10 bg-slate-900/90 p-3">{sequence.map((item, index) => <button key={`preview-${selectionKey(item.selection)}`} onClick={() => setPreviewSelection(item.selection)} className={`mb-2 block w-full rounded-full px-3 py-2 text-left text-xs ${sameSelection(item.selection, previewSelection) ? 'bg-brand-500 font-semibold text-slate-950' : 'text-slate-300 hover:bg-white/10'}`}>{index + 1}. {item.label}</button>)}</aside>
              <div className="overflow-y-auto p-5">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-brand-300">{previewNodeLabel}</p>
                {previewSelection.view === 'lesson' && previewCurrentLesson ? (
                  <div className="space-y-3 rounded-xl border border-white/10 bg-slate-900/70 p-4">
                    <h4 className="text-xl font-bold text-white">{previewCurrentLesson.title}</h4>
                    <p className="text-sm text-slate-300">{previewCurrentLesson.summary}</p>
                    {previewCurrentLesson.overview_text ? (
                      <div
                        className="rounded-lg border border-white/10 bg-slate-950/60 p-3 text-sm text-slate-200"
                        dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(previewCurrentLesson.overview_text) }}
                      />
                    ) : null}
                    {previewCurrentLesson.overview_image_url ? (
                      <img
                        src={previewCurrentLesson.overview_image_url}
                        alt={previewCurrentLesson.title}
                        className="max-h-[320px] w-full rounded-lg border border-white/10 object-contain"
                      />
                    ) : null}
                  </div>
                ) : null}
                {previewSelection.view === 'topic' && previewCurrentTopic ? (
                  <div className="space-y-3 rounded-xl border border-white/10 bg-slate-900/70 p-4">
                    <h4 className="text-xl font-bold text-white">{previewCurrentTopic.title}</h4>
                    {previewCurrentTopic.summary ? <p className="text-sm text-slate-300">{previewCurrentTopic.summary}</p> : null}
                    <div className="grid gap-3 xl:grid-cols-[1fr_320px]">
                      <div className="rounded-lg border border-white/10 bg-slate-950/60 p-3 text-sm text-slate-200">
                        {previewTopicPrimaryContent?.body_text ? (
                          <div dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(previewTopicPrimaryContent.body_text) }} />
                        ) : (
                          <p className="text-sm text-slate-400">No topic content yet.</p>
                        )}
                      </div>
                      <div className="rounded-lg border border-white/10 bg-slate-950/60 p-3">
                        {previewTopicPrimaryContent?.content_url ? (
                          isVideoMediaUrl(previewTopicPrimaryContent.content_url) ? (
                            <video src={previewTopicPrimaryContent.content_url} controls className="max-h-[260px] w-full rounded-md object-contain" />
                          ) : (
                            <img src={previewTopicPrimaryContent.content_url} alt={previewCurrentTopic.title} className="max-h-[260px] w-full rounded-md object-contain" />
                          )
                        ) : (
                          <p className="text-sm text-slate-400">No media uploaded.</p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
                {(previewSelection.view === 'preTest' || previewSelection.view === 'postTest' || previewSelection.view === 'finalExam') && previewCurrentQuiz ? <div className="space-y-3 rounded-xl border border-white/10 bg-slate-900/70 p-4"><h4 className="text-xl font-bold text-white">{previewCurrentQuiz.title}</h4><div className="grid gap-2 text-xs text-slate-300 md:grid-cols-3"><p>Passing: {previewCurrentQuiz.passing_score}%</p><p>Time: {previewCurrentQuiz.time_limit_minutes} min</p><p>Attempts: {previewCurrentQuiz.attempt_limit}</p></div>{(questionsByQuiz.get(previewCurrentQuiz.id) ?? []).map((question, questionIndex) => <div key={question.id} className="rounded-lg border border-white/10 bg-slate-950/60 p-3"><p className="text-xs font-semibold uppercase tracking-[0.13em] text-slate-400">Question {questionIndex + 1}</p><p className="mt-1 text-sm font-semibold text-white">{question.prompt}</p><div className="mt-2 space-y-1">{(answersByQuestion.get(question.id) ?? []).map((answer) => <p key={answer.id} className="rounded-md border border-white/10 px-2 py-1 text-sm text-slate-300">{answer.answer_text}</p>)}</div></div>)}</div> : null}
                {previewSelection.view === 'finalExam' && !previewCurrentQuiz ? <p className="text-sm text-slate-400">Final exam has not been created yet.</p> : null}
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-white/10 bg-slate-900 px-5 py-3"><button disabled={previewIndex <= 0} onClick={() => { const previous = sequence[previewIndex - 1]; if (previous) setPreviewSelection(previous.selection); }} className="inline-flex items-center gap-1 rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold text-slate-200 disabled:opacity-40"><ChevronLeft size={14} />Previous</button><p className="text-xs font-semibold text-slate-400">{previewIndex >= 0 ? `${previewIndex + 1} / ${sequence.length}` : `0 / ${sequence.length}`}</p><button disabled={previewIndex < 0 || previewIndex >= sequence.length - 1} onClick={() => { const next = sequence[previewIndex + 1]; if (next) setPreviewSelection(next.selection); }} className="inline-flex items-center gap-1 rounded-full bg-brand-500 px-3 py-1.5 text-xs font-semibold text-slate-950 disabled:opacity-40">Next<ChevronRight size={14} /></button></div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
