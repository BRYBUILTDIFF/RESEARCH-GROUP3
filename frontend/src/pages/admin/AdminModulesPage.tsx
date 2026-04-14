import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  createLesson,
  createLessonContent,
  createModule,
  createTopic,
  createQuestionAnswer,
  createQuiz,
  createQuizQuestion,
  deleteLesson,
  deleteLessonContent,
  deleteTopic,
  getModuleBuilder,
  getModules,
  reorderLessons,
  reorderTopics,
  updateLesson,
  updateModule,
  updateTopic,
  updateQuiz,
} from '../../lib/api';
import type { ModuleBuilderPayload, ModuleSummary, QuizSummary, TopicSummary } from '../../types/lms';

type Step = 'module' | 'lessons' | 'topics' | 'preTest' | 'postTest' | 'finalTest';

export function AdminModulesPage() {
  const [modules, setModules] = useState<ModuleSummary[]>([]);
  const [builder, setBuilder] = useState<ModuleBuilderPayload | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState<number | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<number | null>(null);
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);
  const [selectedPreTestLessonId, setSelectedPreTestLessonId] = useState<number | null>(null);
  const [selectedPostTestLessonId, setSelectedPostTestLessonId] = useState<number | null>(null);
  const [step, setStep] = useState<Step>('module');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [newModule, setNewModule] = useState<{
    title: string;
    description: string;
    category: string;
    thumbnailUrl: string;
  }>({ title: '', description: '', category: 'Hardware', thumbnailUrl: '' });
  const [newLesson, setNewLesson] = useState({
    title: '',
    summary: '',
    estimatedMinutes: 10,
    overviewText: '',
    overviewImageUrl: '',
  });
  const [newTopic, setNewTopic] = useState({ title: '', summary: '' });
  const [newContent, setNewContent] = useState<{
    contentType: 'text' | 'image' | 'video' | 'simulation' | 'file';
    title: string;
    bodyText: string;
    contentUrl: string;
    simulationKey: string;
  }>({ contentType: 'text', title: '', bodyText: '', contentUrl: '', simulationKey: '' });
  const [newQuestion, setNewQuestion] = useState('');
  const [newAnswer, setNewAnswer] = useState({ answerText: '', explanation: '', isCorrect: false });

  const loadModules = async () => setModules(await getModules());
  const loadBuilder = async (moduleId: number) => {
    const data = await getModuleBuilder(moduleId);
    setBuilder(data);
    setSelectedModuleId(moduleId);
    const orderedLessons = [...data.lessons].sort((a, b) => a.sequence_no - b.sequence_no);
    const firstLessonId = orderedLessons[0]?.id ?? null;
    const loadedPreTest = data.quizzes.find((quiz) => quiz.quiz_type === 'lesson_quiz' && /\bpre[-\s]?test\b/i.test(quiz.title));
    const keepCurrentSelection = selectedModuleId === moduleId;
    const activeLessonId =
      keepCurrentSelection && selectedLessonId !== null && orderedLessons.some((lesson) => lesson.id === selectedLessonId)
        ? selectedLessonId
        : firstLessonId;
    const topicsForActiveLesson = [...data.topics]
      .filter((topic) => topic.lesson_id === activeLessonId)
      .sort((a, b) => a.sort_order - b.sort_order);
    const activeTopicId =
      keepCurrentSelection &&
      selectedTopicId !== null &&
      topicsForActiveLesson.some((topic) => topic.id === selectedTopicId)
        ? selectedTopicId
        : topicsForActiveLesson[0]?.id ?? null;
    const activePreTestLessonId =
      keepCurrentSelection &&
      selectedPreTestLessonId !== null &&
      orderedLessons.some((lesson) => lesson.id === selectedPreTestLessonId)
        ? selectedPreTestLessonId
        : loadedPreTest?.lesson_id ?? activeLessonId;
    const activePostTestLessonId =
      keepCurrentSelection &&
      selectedPostTestLessonId !== null &&
      orderedLessons.some((lesson) => lesson.id === selectedPostTestLessonId)
        ? selectedPostTestLessonId
        : activeLessonId;

    setSelectedLessonId(activeLessonId);
    setSelectedTopicId(activeTopicId);
    setSelectedPreTestLessonId(activePreTestLessonId);
    setSelectedPostTestLessonId(activePostTestLessonId);
  };

  useEffect(() => {
    void loadModules().catch((e) => setError(e.message));
  }, []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Operation failed.');
    } finally {
      setBusy(false);
    }
  };

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(new Error('Failed to read selected file.'));
      reader.readAsDataURL(file);
    });

  const onNewModuleThumbnailFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    await run(async () => {
      const dataUrl = await readFileAsDataUrl(file);
      setNewModule((p) => ({ ...p, thumbnailUrl: dataUrl }));
    });
  };

  const onBuilderThumbnailFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    await run(async () => {
      const dataUrl = await readFileAsDataUrl(file);
      setBuilder((p) => (p ? { ...p, module: { ...p.module, thumbnail_url: dataUrl } } : p));
    });
  };

  const onNewLessonImageFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    await run(async () => {
      const dataUrl = await readFileAsDataUrl(file);
      setNewLesson((p) => ({ ...p, overviewImageUrl: dataUrl }));
    });
  };

  const onSelectedLessonImageFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !selectedLesson) return;
    await run(async () => {
      const dataUrl = await readFileAsDataUrl(file);
      setBuilder((p) =>
        p
          ? {
              ...p,
              lessons: p.lessons.map((lesson) =>
                lesson.id === selectedLesson.id ? { ...lesson, overview_image_url: dataUrl } : lesson
              ),
            }
          : p
      );
    });
  };

  const selectedLesson = builder?.lessons.find((l) => l.id === selectedLessonId) ?? null;
  const selectedTopic = builder?.topics.find((topic) => topic.id === selectedTopicId) ?? null;
  const topicsForSelectedLesson: TopicSummary[] =
    selectedLessonId === null
      ? []
      : [...(builder?.topics ?? [])]
          .filter((topic) => topic.lesson_id === selectedLessonId)
          .sort((a, b) => a.sort_order - b.sort_order);
  const selectedTopicContent =
    selectedTopicId !== null
      ? builder?.content.filter((c) => c.topic_id === selectedTopicId) ?? []
      : [];
  const orderedLessons = useMemo(() => [...(builder?.lessons ?? [])].sort((a, b) => a.sequence_no - b.sequence_no), [builder?.lessons]);
  const isPreTest = (quiz: QuizSummary) => quiz.quiz_type === 'lesson_quiz' && /\bpre[-\s]?test\b/i.test(quiz.title);
  const isPostTest = (quiz: QuizSummary) => quiz.quiz_type === 'lesson_quiz' && !isPreTest(quiz);
  const preTests = builder?.quizzes.filter((quiz) => isPreTest(quiz)) ?? [];
  const preTestsByLessonId = useMemo(() => {
    const map = new Map<number, QuizSummary[]>();
    preTests.forEach((quiz) => {
      if (quiz.lesson_id !== null) {
        const existing = map.get(quiz.lesson_id) ?? [];
        existing.push(quiz);
        map.set(quiz.lesson_id, existing);
      }
    });
    return map;
  }, [preTests]);
  const preTestQuiz: QuizSummary | null = builder?.quizzes.find((quiz) => isPreTest(quiz)) ?? null;
  const postTests = builder?.quizzes.filter((quiz) => isPostTest(quiz)) ?? [];
  const postTestsByLessonId = useMemo(() => {
    const map = new Map<number, QuizSummary[]>();
    postTests.forEach((quiz) => {
      if (quiz.lesson_id !== null) {
        const existing = map.get(quiz.lesson_id) ?? [];
        existing.push(quiz);
        map.set(quiz.lesson_id, existing);
      }
    });
    return map;
  }, [postTests]);
  const postTestQuiz: QuizSummary | null =
    selectedPostTestLessonId !== null ? postTestsByLessonId.get(selectedPostTestLessonId)?.[0] ?? null : null;
  const finalTestQuiz: QuizSummary | null = builder?.quizzes.find((q) => q.quiz_type === 'final_exam') ?? null;
  const activeTestQuiz = step === 'preTest' ? preTestQuiz : step === 'postTest' ? postTestQuiz : step === 'finalTest' ? finalTestQuiz : null;
  const currentQuizId =
    step === 'preTest' || step === 'postTest' || step === 'finalTest' ? activeTestQuiz?.id ?? null : null;
  const quizQuestions = builder?.questions.filter((q) => q.quiz_id === currentQuizId) ?? [];
  const answersByQuestion = useMemo(() => {
    const map: Record<number, typeof builder.answers> = {} as Record<number, typeof builder.answers>;
    for (const ans of builder?.answers ?? []) {
      if (!map[ans.question_id]) map[ans.question_id] = [];
      map[ans.question_id].push(ans);
    }
    return map;
  }, [builder]);

  const topicCountByLessonId = useMemo(() => {
    const map = new Map<number, number>();
    (builder?.topics ?? []).forEach((topic) => {
      map.set(topic.lesson_id, (map.get(topic.lesson_id) ?? 0) + 1);
    });
    return map;
  }, [builder?.topics]);

  const renderLearningSequenceCard = (title: string) => (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</p>
      {orderedLessons.length === 0 ? (
        <p className="mt-2 text-sm text-slate-600">No lessons yet. Add a lesson to build the sequence.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {orderedLessons.map((lesson) => (
            <div key={`seq-${lesson.id}`} className="space-y-1">
              {(preTestsByLessonId.get(lesson.id) ?? []).map((quiz) => (
                <div key={`pre-${quiz.id}`} className="rounded-md border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-700">
                  Pre Test: {quiz.title}
                </div>
              ))}
              <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
                <p className="font-semibold text-slate-800">
                  Lesson {lesson.sequence_no}: {lesson.title}
                </p>
                <p className="text-xs text-slate-500">
                  {topicCountByLessonId.get(lesson.id) ?? 0} topic(s)
                </p>
              </div>
              {(postTestsByLessonId.get(lesson.id) ?? []).map((quiz) => (
                <div key={`post-${quiz.id}`} className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                  Post Test: {quiz.title}
                </div>
              ))}
            </div>
          ))}
          <div className={`rounded-md border px-3 py-2 text-sm font-semibold ${finalTestQuiz ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-amber-300 bg-amber-50 text-amber-700'}`}>
            {finalTestQuiz ? `Final Test: ${finalTestQuiz.title}` : 'Final Test not created yet'}
          </div>
        </div>
      )}
    </div>
  );

  const createModuleHandler = async (event: FormEvent) => {
    event.preventDefault();
    await run(async () => {
      const response = await createModule(newModule);
      await loadModules();
      await loadBuilder(response.module.id);
      setNewModule({ title: '', description: '', category: 'Hardware', thumbnailUrl: '' });
    });
  };

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Module Builder</h2>
        <p className="text-slate-600">Build module info, lessons, content, pre test, post test, and final test settings.</p>
      </div>
      {error ? <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}

      <form onSubmit={createModuleHandler} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Module Title</label>
          <input required value={newModule.title} onChange={(e) => setNewModule((p) => ({ ...p, title: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Module title" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Category</label>
          <select value={newModule.category} onChange={(e) => setNewModule((p) => ({ ...p, category: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option>Hardware</option><option>Software</option><option>Networking</option><option>Security</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Thumbnail Link (Optional)</label>
          <input value={newModule.thumbnailUrl} onChange={(e) => setNewModule((p) => ({ ...p, thumbnailUrl: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="https://... or data:image/..." />
        </div>
        <div className="space-y-1 md:col-span-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Thumbnail Upload (Optional)</label>
          <input type="file" accept="image/*" onChange={(e) => void onNewModuleThumbnailFileChange(e)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white" />
          <p className="text-xs text-slate-500">Upload overrides link by storing the selected image as a data URL.</p>
        </div>
        <div className="space-y-1 md:col-span-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Description</label>
          <textarea required value={newModule.description} onChange={(e) => setNewModule((p) => ({ ...p, description: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Describe the module..." />
        </div>
        {newModule.thumbnailUrl ? (
          <div className="md:col-span-2">
            <img src={newModule.thumbnailUrl} alt="Module thumbnail preview" className="h-36 w-full rounded-md border border-slate-200 object-cover" />
          </div>
        ) : null}
        <button type="submit" disabled={busy} className="rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Create Module</button>
      </form>

      <div className="grid gap-5 xl:grid-cols-[300px_1fr]">
        <aside className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          {modules.map((m) => (
            <button key={m.id} onClick={() => void run(async () => loadBuilder(m.id))} className={`w-full rounded-md border px-3 py-2 text-left text-sm ${selectedModuleId === m.id ? 'border-sky-300 bg-sky-50' : 'border-slate-200'}`}>
              <p className="font-semibold">{m.title}</p>
              <p className="text-xs text-slate-500">{m.category ?? 'General'}</p>
            </button>
          ))}
        </aside>

        <div className="space-y-4">
          {!builder ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Select a module to start building.</div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {(['module', 'lessons', 'topics', 'preTest', 'postTest', 'finalTest'] as Step[]).map((s) => (
                  <button key={s} onClick={() => setStep(s)} className={`rounded-md px-3 py-2 text-sm font-semibold ${step === s ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
                    {s === 'module'
                      ? 'Module Info'
                      : s === 'lessons'
                      ? 'Lessons & Content'
                      : s === 'topics'
                      ? 'Topics & Contents'
                      : s === 'preTest'
                      ? 'Pre Test'
                      : s === 'postTest'
                      ? 'Post Test'
                      : 'Final Test'}
                  </button>
                ))}
              </div>

              {step === 'module' ? (
                <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="grid gap-2 md:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Module Title</label>
                        <input value={builder.module.title} onChange={(e) => setBuilder((p) => p ? { ...p, module: { ...p.module, title: e.target.value } } : p)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Thumbnail Link</label>
                        <input value={builder.module.thumbnail_url ?? ''} onChange={(e) => setBuilder((p) => p ? { ...p, module: { ...p.module, thumbnail_url: e.target.value } } : p)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="https://... or data:image/..." />
                      </div>
                      <div className="space-y-1 md:col-span-2">
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Thumbnail Upload</label>
                        <input type="file" accept="image/*" onChange={(e) => void onBuilderThumbnailFileChange(e)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white" />
                      </div>
                      <div className="space-y-1 md:col-span-2">
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Description</label>
                        <textarea value={builder.module.description} onChange={(e) => setBuilder((p) => p ? { ...p, module: { ...p.module, description: e.target.value } } : p)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                      </div>
                    </div>
                    <button onClick={() => void run(async () => { await updateModule(builder.module.id, { title: builder.module.title, description: builder.module.description, thumbnailUrl: builder.module.thumbnail_url ?? '' }); await loadModules(); await loadBuilder(builder.module.id); })} className="mt-3 rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white">
                      Save Module Info
                    </button>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">User Preview</p>
                    {builder.module.thumbnail_url ? (
                      <img src={builder.module.thumbnail_url} alt={builder.module.title} className="mt-3 h-40 w-full rounded-md border border-slate-200 object-cover" />
                    ) : (
                      <div className="mt-3 flex h-40 items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-500">No thumbnail yet</div>
                    )}
                    <h3 className="mt-3 text-lg font-bold text-slate-900">{builder.module.title}</h3>
                    <p className="mt-1 text-sm text-slate-600">{builder.module.description || 'No description provided.'}</p>
                    <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                      <span>{builder.module.category ?? 'General'}</span>
                      <span>{orderedLessons.length} lessons</span>
                    </div>
                    <Link to={`/user/modules/${builder.module.id}`} className="mt-4 inline-flex rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500">
                      Open User Preview
                    </Link>
                  </div>
                </div>
              ) : null}

              {step === 'topics' ? (
                <div className="grid gap-4 xl:grid-cols-[320px_280px_1fr]">
                  <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Select Lesson</p>
                    {orderedLessons.map((lesson) => (
                      <button
                        key={`topics-${lesson.id}`}
                        onClick={() => {
                          const lessonTopics = [...(builder.topics ?? [])]
                            .filter((topic) => topic.lesson_id === lesson.id)
                            .sort((a, b) => a.sort_order - b.sort_order);
                          setSelectedLessonId(lesson.id);
                          setSelectedTopicId(lessonTopics[0]?.id ?? null);
                        }}
                        className={`w-full rounded-md border px-3 py-2 text-left text-sm ${selectedLessonId === lesson.id ? 'border-sky-300 bg-sky-50' : 'border-slate-200 bg-white'}`}
                      >
                        <p className="font-semibold text-slate-900">Lesson {lesson.sequence_no}: {lesson.title}</p>
                      </button>
                    ))}
                    {orderedLessons.length === 0 ? <p className="text-sm text-slate-500">No lessons yet.</p> : null}
                  </div>

                  <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    {!selectedLesson ? (
                      <p className="text-sm text-slate-500">Pick a lesson to create topics.</p>
                    ) : (
                      <>
                        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Topics for Lesson {selectedLesson.sequence_no}</p>
                          <form onSubmit={(e) => { e.preventDefault(); if (!newTopic.title.trim()) return; void run(async () => { await createTopic({ lessonId: selectedLesson.id, title: newTopic.title.trim(), summary: newTopic.summary }); setNewTopic({ title: '', summary: '' }); await loadBuilder(builder.module.id); }); }} className="mt-2 grid gap-2">
                            <div className="space-y-1">
                              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Topic Title</label>
                              <input value={newTopic.title} onChange={(e) => setNewTopic((p) => ({ ...p, title: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Topic title" />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Topic Summary</label>
                              <textarea value={newTopic.summary} onChange={(e) => setNewTopic((p) => ({ ...p, summary: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Topic summary" />
                            </div>
                            <button className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white">Add Topic</button>
                          </form>
                        </div>

                        {topicsForSelectedLesson.length === 0 ? (
                          <p className="text-sm text-slate-500">No topics yet. Create one to start topic content.</p>
                        ) : (
                          topicsForSelectedLesson.map((topic, idx) => (
                            <div key={`topics-tab-${topic.id}`} className={`rounded-md border p-2 ${selectedTopicId === topic.id ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200'}`}>
                              <button onClick={() => setSelectedTopicId(topic.id)} className="w-full text-left text-sm font-semibold">
                                {topic.sort_order}. {topic.title}
                              </button>
                              {topic.summary ? <p className="mt-1 text-xs text-slate-600">{topic.summary}</p> : null}
                              <div className="mt-2 flex gap-1">
                                <button disabled={idx === 0} onClick={() => void run(async () => { if (!selectedLesson) return; const arr = [...topicsForSelectedLesson]; [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]]; await reorderTopics(selectedLesson.id, arr.map((x) => x.id)); await loadBuilder(builder.module.id); })} className="rounded border border-slate-300 px-2 py-1 text-[11px]">Up</button>
                                <button disabled={idx === topicsForSelectedLesson.length - 1} onClick={() => void run(async () => { if (!selectedLesson) return; const arr = [...topicsForSelectedLesson]; [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]]; await reorderTopics(selectedLesson.id, arr.map((x) => x.id)); await loadBuilder(builder.module.id); })} className="rounded border border-slate-300 px-2 py-1 text-[11px]">Down</button>
                                <button onClick={() => void run(async () => { await deleteTopic(topic.id); await loadBuilder(builder.module.id); })} className="rounded border border-rose-300 px-2 py-1 text-[11px] text-rose-700">Delete</button>
                              </div>
                            </div>
                          ))
                        )}
                      </>
                    )}
                  </div>

                  <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    {!selectedTopic ? (
                      <p className="text-sm text-slate-500">Select a topic to add topic contents (text/image/video).</p>
                    ) : (
                      <>
                        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Edit Topic</p>
                          <div className="mt-2 grid gap-2">
                            <div className="space-y-1">
                              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Topic Title</label>
                              <input value={selectedTopic.title} onChange={(e) => setBuilder((p) => p ? { ...p, topics: p.topics.map((x) => (x.id === selectedTopic.id ? { ...x, title: e.target.value } : x)) } : p)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Topic Summary</label>
                              <textarea value={selectedTopic.summary} onChange={(e) => setBuilder((p) => p ? { ...p, topics: p.topics.map((x) => (x.id === selectedTopic.id ? { ...x, summary: e.target.value } : x)) } : p)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                            </div>
                            <button onClick={() => void run(async () => { await updateTopic(selectedTopic.id, { title: selectedTopic.title, summary: selectedTopic.summary }); await loadBuilder(builder.module.id); })} className="rounded-md bg-sky-600 px-3 py-2 text-sm font-semibold text-white">
                              Save Topic
                            </button>
                          </div>
                        </div>
                        <h3 className="font-semibold text-slate-900">Topic Contents: {selectedTopic.title}</h3>
                        <form onSubmit={(e) => { e.preventDefault(); void run(async () => { await createLessonContent({ topicId: selectedTopic.id, contentType: newContent.contentType, title: newContent.title, bodyText: newContent.bodyText, contentUrl: newContent.contentUrl, simulationKey: newContent.simulationKey }); setNewContent({ contentType: 'text', title: '', bodyText: '', contentUrl: '', simulationKey: '' }); await loadBuilder(builder.module.id); }); }} className="grid gap-2 md:grid-cols-2">
                          <div className="space-y-1">
                            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Content Type</label>
                            <select value={newContent.contentType} onChange={(e) => setNewContent((p) => ({ ...p, contentType: e.target.value as 'text' | 'image' | 'video' | 'simulation' | 'file' }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                              <option value="text">Text</option><option value="image">Image</option><option value="video">Video</option><option value="simulation">Simulation</option><option value="file">File</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Block Title</label>
                            <input required value={newContent.title} onChange={(e) => setNewContent((p) => ({ ...p, title: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Block title" />
                          </div>
                          <div className="space-y-1 md:col-span-2">
                            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Content URL (Optional)</label>
                            <input value={newContent.contentUrl} onChange={(e) => setNewContent((p) => ({ ...p, contentUrl: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Image/Video URL or file URL" />
                          </div>
                          <div className="space-y-1 md:col-span-2">
                            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Body Text</label>
                            <textarea value={newContent.bodyText} onChange={(e) => setNewContent((p) => ({ ...p, bodyText: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Topic content text" />
                          </div>
                          <button className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white">Add Content</button>
                        </form>
                        <div className="space-y-2">
                          {selectedTopicContent.length > 0 ? (
                            selectedTopicContent.map((c) => (
                              <div key={`topics-content-${c.id}`} className="rounded-md border border-slate-200 p-3">
                                <p className="text-xs text-slate-500">{c.content_type}</p><p className="text-sm font-semibold">{c.title}</p>
                                {c.content_url ? <p className="text-xs text-sky-700">{c.content_url}</p> : null}
                                <button onClick={() => void run(async () => { await deleteLessonContent(c.id); await loadBuilder(builder.module.id); })} className="mt-2 rounded border border-rose-300 px-2 py-1 text-xs text-rose-700">Delete</button>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-slate-500">No content blocks yet for this topic.</p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ) : null}

              {step === 'lessons' ? (
                <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
                  <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <form onSubmit={(e) => { e.preventDefault(); void run(async () => { await createLesson({ moduleId: builder.module.id, title: newLesson.title, summary: newLesson.summary, estimatedMinutes: newLesson.estimatedMinutes, overviewText: newLesson.overviewText, overviewImageUrl: newLesson.overviewImageUrl || undefined }); setNewLesson({ title: '', summary: '', estimatedMinutes: 10, overviewText: '', overviewImageUrl: '' }); await loadBuilder(builder.module.id); }); }} className="space-y-2">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Lesson Title</label>
                        <input required value={newLesson.title} onChange={(e) => setNewLesson((p) => ({ ...p, title: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Lesson title" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Lesson Summary</label>
                        <textarea value={newLesson.summary} onChange={(e) => setNewLesson((p) => ({ ...p, summary: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Summary" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Lesson Section Text</label>
                        <textarea value={newLesson.overviewText} onChange={(e) => setNewLesson((p) => ({ ...p, overviewText: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Main lesson section description" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Lesson Image Link (Optional)</label>
                        <input value={newLesson.overviewImageUrl} onChange={(e) => setNewLesson((p) => ({ ...p, overviewImageUrl: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="https://..." />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Lesson Image Upload (Optional)</label>
                        <input type="file" accept="image/*" onChange={(e) => void onNewLessonImageFileChange(e)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white" />
                      </div>
                      <button className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white">Add Lesson</button>
                    </form>
                    {orderedLessons.map((l, idx) => (
                      <div key={l.id} className={`rounded-md border p-2 ${selectedLessonId === l.id ? 'border-sky-300 bg-sky-50' : 'border-slate-200'}`}>
                        <button onClick={() => setSelectedLessonId(l.id)} className="w-full text-left text-sm font-semibold">
                          {l.sequence_no}. {l.title}
                        </button>
                        <div className="mt-2 flex gap-1">
                          <button disabled={idx === 0} onClick={() => void run(async () => { const arr = [...orderedLessons]; [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]]; await reorderLessons(builder.module.id, arr.map((x) => x.id)); await loadBuilder(builder.module.id); })} className="rounded border border-slate-300 px-2 py-1 text-[11px]">Up</button>
                          <button disabled={idx === orderedLessons.length - 1} onClick={() => void run(async () => { const arr = [...orderedLessons]; [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]]; await reorderLessons(builder.module.id, arr.map((x) => x.id)); await loadBuilder(builder.module.id); })} className="rounded border border-slate-300 px-2 py-1 text-[11px]">Down</button>
                          <button onClick={() => void run(async () => { await deleteLesson(l.id); await loadBuilder(builder.module.id); })} className="rounded border border-rose-300 px-2 py-1 text-[11px] text-rose-700">Delete</button>
                        </div>
                      </div>
                    ))}
                    {renderLearningSequenceCard('Learning Sequence Preview')}
                  </div>

                  <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    {!selectedLesson ? (
                      <p className="text-sm text-slate-500">Select a lesson.</p>
                    ) : (
                      <>
                        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Edit Lesson</p>
                          <div className="mt-2 grid gap-2">
                            <div className="space-y-1">
                              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Lesson Title</label>
                              <input
                                value={selectedLesson.title}
                                onChange={(e) =>
                                  setBuilder((p) =>
                                    p
                                      ? { ...p, lessons: p.lessons.map((x) => (x.id === selectedLesson.id ? { ...x, title: e.target.value } : x)) }
                                      : p
                                  )
                                }
                                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Lesson Summary</label>
                              <textarea
                                value={selectedLesson.summary}
                                onChange={(e) =>
                                  setBuilder((p) =>
                                    p
                                      ? { ...p, lessons: p.lessons.map((x) => (x.id === selectedLesson.id ? { ...x, summary: e.target.value } : x)) }
                                      : p
                                  )
                                }
                                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Lesson Section Text</label>
                              <textarea
                                value={selectedLesson.overview_text ?? ''}
                                onChange={(e) =>
                                  setBuilder((p) =>
                                    p
                                      ? { ...p, lessons: p.lessons.map((x) => (x.id === selectedLesson.id ? { ...x, overview_text: e.target.value } : x)) }
                                      : p
                                  )
                                }
                                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Lesson Image Link</label>
                              <input
                                value={selectedLesson.overview_image_url ?? ''}
                                onChange={(e) =>
                                  setBuilder((p) =>
                                    p
                                      ? { ...p, lessons: p.lessons.map((x) => (x.id === selectedLesson.id ? { ...x, overview_image_url: e.target.value } : x)) }
                                      : p
                                  )
                                }
                                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Lesson Image Upload</label>
                              <input type="file" accept="image/*" onChange={(e) => void onSelectedLessonImageFileChange(e)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white" />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Estimated Minutes</label>
                              <input
                                type="number"
                                min={1}
                                value={selectedLesson.estimated_minutes}
                                onChange={(e) =>
                                  setBuilder((p) =>
                                    p
                                      ? {
                                          ...p,
                                          lessons: p.lessons.map((x) =>
                                            x.id === selectedLesson.id ? { ...x, estimated_minutes: Number(e.target.value) } : x
                                          ),
                                        }
                                      : p
                                  )
                                }
                                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                              />
                            </div>
                            <button
                              onClick={() =>
                                void run(async () => {
                                  await updateLesson(selectedLesson.id, {
                                    title: selectedLesson.title,
                                    summary: selectedLesson.summary,
                                    overviewText: selectedLesson.overview_text ?? '',
                                    overviewImageUrl: selectedLesson.overview_image_url ?? '',
                                    estimatedMinutes: selectedLesson.estimated_minutes,
                                  });
                                  await loadBuilder(builder.module.id);
                                })
                              }
                              className="rounded-md bg-sky-600 px-3 py-2 text-sm font-semibold text-white"
                            >
                              Save Lesson
                            </button>
                          </div>
                        </div>

                        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                          <p className="font-semibold">Topics are managed in the Topics &amp; Contents tab.</p>
                          <p className="mt-1">Topic creation has been removed from Lessons &amp; Contents.</p>
                          <button
                            onClick={() => setStep('topics')}
                            className="mt-3 rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
                          >
                            Go to Topics &amp; Contents
                          </button>
                        </div>

                        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Topics Under This Lesson</p>
                          <div className="mt-2 space-y-2">
                            {topicsForSelectedLesson.length > 0 ? (
                              topicsForSelectedLesson.map((topic) => (
                                <div key={`lessons-topics-preview-${topic.id}`} className="rounded-md border border-slate-200 bg-white p-2">
                                  <p className="text-sm font-semibold text-slate-900">{topic.sort_order}. {topic.title}</p>
                                  {topic.summary ? <p className="text-xs text-slate-600">{topic.summary}</p> : null}
                                </div>
                              ))
                            ) : (
                              <p className="text-sm text-slate-500">No topics yet for this lesson.</p>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ) : null}

              {step === 'preTest' || step === 'postTest' || step === 'finalTest' ? (
                <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
                  <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    {step === 'preTest' ? (
                      <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Pre Test Sequence Placement</p>
                      {orderedLessons.length === 0 ? (
                        <p className="mt-2 text-sm text-slate-600">Create lessons first so the pre test can be positioned in sequence.</p>
                      ) : (
                        <>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <div className="space-y-1">
                              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Pre Test Position</label>
                              <select
                                value={selectedPreTestLessonId ?? ''}
                                onChange={(e) => setSelectedPreTestLessonId(Number(e.target.value))}
                                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                              >
                                {orderedLessons.map((lesson) => (
                                  <option key={lesson.id} value={lesson.id}>
                                    Place before Lesson {lesson.sequence_no}: {lesson.title}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <button
                              disabled={!preTestQuiz || !selectedPreTestLessonId || busy}
                              onClick={() =>
                                void run(async () => {
                                  if (!preTestQuiz || !selectedPreTestLessonId) return;
                                  await updateQuiz(preTestQuiz.id, { lessonId: selectedPreTestLessonId, title: preTestQuiz.title });
                                  await loadBuilder(builder.module.id);
                                })
                              }
                              className="rounded-md bg-sky-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                            >
                              Save Placement
                            </button>
                          </div>
                          <div className="mt-3 space-y-2">
                            {preTestQuiz ? null : (
                              <p className="text-sm text-amber-700">Pre test not created yet.</p>
                            )}
                            {orderedLessons.map((lesson) => (
                              <div key={lesson.id} className="space-y-1">
                                {preTestQuiz?.lesson_id === lesson.id ? (
                                  <div className="rounded-md border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-700">
                                    Pre Test: {preTestQuiz.title}
                                  </div>
                                ) : null}
                                <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                                  Lesson {lesson.sequence_no}: {lesson.title}
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                      </div>
                    ) : null}

                    {step === 'postTest' ? (
                      <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Post Test Placement by Lesson</p>
                      {orderedLessons.length === 0 ? (
                        <p className="mt-2 text-sm text-slate-600">Create lessons first to configure post tests.</p>
                      ) : (
                        <>
                          <div className="mt-2">
                            <div className="space-y-1">
                              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Target Lesson for Post Test</label>
                              <select
                                value={selectedPostTestLessonId ?? ''}
                                onChange={(e) => setSelectedPostTestLessonId(Number(e.target.value))}
                                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                              >
                                {orderedLessons.map((lesson) => (
                                  <option key={lesson.id} value={lesson.id}>
                                    Lesson {lesson.sequence_no}: {lesson.title}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="mt-3 space-y-2">
                            {orderedLessons.map((lesson) => {
                              const lessonPostTests = postTestsByLessonId.get(lesson.id) ?? [];
                              return (
                                <div key={lesson.id} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
                                  <p className="font-semibold text-slate-800">
                                    Lesson {lesson.sequence_no}: {lesson.title}
                                  </p>
                                  <p className={`text-xs ${lessonPostTests.length > 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                                    {lessonPostTests.length > 0 ? `Post Test ready (${lessonPostTests.length})` : 'Post Test not created'}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      )}
                      </div>
                    ) : null}

                    {step === 'finalTest' ? (
                      <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Final Test Placement</p>
                      <div className="mt-3 space-y-2">
                        {orderedLessons.map((lesson) => (
                          <div key={lesson.id} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                            Lesson {lesson.sequence_no}: {lesson.title}
                          </div>
                        ))}
                        <div className={`rounded-md border px-3 py-2 text-sm font-semibold ${finalTestQuiz ? 'border-sky-300 bg-sky-50 text-sky-700' : 'border-amber-300 bg-amber-50 text-amber-700'}`}>
                          {finalTestQuiz ? `Final Test (always at end): ${finalTestQuiz.title}` : 'Final Test not created (end position reserved)'}
                        </div>
                      </div>
                      </div>
                    ) : null}

                    {currentQuizId === null ? (
                      <button
                      disabled={(step === 'postTest' && !selectedPostTestLessonId) || (step === 'preTest' && !selectedPreTestLessonId)}
                      onClick={() =>
                        void run(async () => {
                          await createQuiz({
                            moduleId: builder.module.id,
                            lessonId: step === 'postTest' ? selectedPostTestLessonId : step === 'preTest' ? selectedPreTestLessonId : null,
                            title:
                              step === 'preTest'
                                ? `${builder.module.title} Pre Test`
                                : step === 'postTest'
                                ? `${builder.module.title} Post Test`
                                : `${builder.module.title} Final Test`,
                            quizType: step === 'finalTest' ? 'final_exam' : 'lesson_quiz',
                            passingScore: 70,
                            timeLimitMinutes: 15,
                            attemptLimit: 3,
                          });
                          await loadBuilder(builder.module.id);
                        })
                      }
                      className="rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      Create {step === 'preTest' ? 'Pre Test' : step === 'postTest' ? 'Post Test' : 'Final Test'}
                      </button>
                    ) : (
                      <>
                        {activeTestQuiz ? (
                          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                            {step === 'preTest' ? 'Pre Test' : step === 'postTest' ? 'Post Test' : 'Final Test'} Configuration
                          </p>
                          <div className="mt-2 grid gap-2 md:grid-cols-3">
                            <div className="space-y-1">
                              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Passing Score (%)</label>
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={activeTestQuiz.passing_score}
                                onChange={(e) =>
                                  setBuilder((p) =>
                                    p
                                      ? {
                                          ...p,
                                          quizzes: p.quizzes.map((q) => (q.id === activeTestQuiz.id ? { ...q, passing_score: Number(e.target.value) } : q)),
                                        }
                                      : p
                                  )
                                }
                                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                placeholder="Passing score"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Time Limit (Minutes)</label>
                              <input
                                type="number"
                                min={1}
                                value={activeTestQuiz.time_limit_minutes}
                                onChange={(e) =>
                                  setBuilder((p) =>
                                    p
                                      ? {
                                          ...p,
                                          quizzes: p.quizzes.map((q) => (q.id === activeTestQuiz.id ? { ...q, time_limit_minutes: Number(e.target.value) } : q)),
                                        }
                                      : p
                                  )
                                }
                                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                placeholder="Time limit"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Attempt Limit</label>
                              <input
                                type="number"
                                min={1}
                                value={activeTestQuiz.attempt_limit}
                                onChange={(e) =>
                                  setBuilder((p) =>
                                    p
                                      ? {
                                          ...p,
                                          quizzes: p.quizzes.map((q) => (q.id === activeTestQuiz.id ? { ...q, attempt_limit: Number(e.target.value) } : q)),
                                        }
                                      : p
                                  )
                                }
                                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                placeholder="Attempt limit"
                              />
                            </div>
                          </div>
                          <button
                            onClick={() =>
                              void run(async () => {
                                await updateQuiz(activeTestQuiz.id, {
                                  lessonId:
                                    step === 'preTest'
                                      ? selectedPreTestLessonId
                                      : step === 'postTest'
                                      ? selectedPostTestLessonId
                                      : null,
                                  passingScore: activeTestQuiz.passing_score,
                                  timeLimitMinutes: activeTestQuiz.time_limit_minutes,
                                  attemptLimit: activeTestQuiz.attempt_limit,
                                });
                                await loadBuilder(builder.module.id);
                              })
                            }
                            className="mt-2 rounded-md bg-sky-600 px-3 py-2 text-xs font-semibold text-white"
                          >
                            Save Test Settings
                          </button>
                          </div>
                        ) : null}

                        <p className="text-sm text-slate-600">Add questions and answers with correct option + feedback explanation for this test.</p>
                        <form onSubmit={(e) => { e.preventDefault(); if (!newQuestion.trim()) return; void run(async () => { await createQuizQuestion(currentQuizId, { prompt: newQuestion.trim(), points: 1 }); setNewQuestion(''); await loadBuilder(builder.module.id); }); }} className="flex flex-wrap items-end gap-2">
                          <div className="min-w-[280px] flex-1 space-y-1">
                            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Question Prompt</label>
                            <input value={newQuestion} onChange={(e) => setNewQuestion(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Question prompt" />
                          </div>
                          <button className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white">Add Question</button>
                        </form>
                        <div className="space-y-2">
                          {quizQuestions.map((q) => (
                            <div key={q.id} className="rounded-md border border-slate-200 p-3">
                              <p className="text-sm font-semibold">{q.prompt}</p>
                              <div className="mt-2 space-y-1">
                                {(answersByQuestion[q.id] ?? []).map((a) => (
                                  <p key={a.id} className="text-xs text-slate-600">
                                    - {a.answer_text} {a.is_correct ? '(Correct)' : ''} {a.explanation ? `| ${a.explanation}` : ''}
                                  </p>
                                ))}
                              </div>
                              <div className="mt-2 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                                <div className="space-y-1">
                                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Answer Text</label>
                                  <input value={newAnswer.answerText} onChange={(e) => setNewAnswer((p) => ({ ...p, answerText: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Answer text" />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Explanation / Feedback</label>
                                  <input value={newAnswer.explanation} onChange={(e) => setNewAnswer((p) => ({ ...p, explanation: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Explanation/feedback" />
                                </div>
                                <button onClick={() => void run(async () => { await createQuestionAnswer(q.id, newAnswer); setNewAnswer({ answerText: '', explanation: '', isCorrect: false }); await loadBuilder(builder.module.id); })} className="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white">Add Answer</button>
                              </div>
                              <label className="mt-2 inline-flex items-center gap-2 text-xs text-slate-700">
                                <input type="checkbox" checked={newAnswer.isCorrect} onChange={(e) => setNewAnswer((p) => ({ ...p, isCorrect: e.target.checked }))} />
                                Mark as correct
                              </label>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                  {renderLearningSequenceCard('Lessons and Tests Sequence')}
                </div>
              ) : null}

            </>
          )}
        </div>
      </div>
    </section>
  );
}
