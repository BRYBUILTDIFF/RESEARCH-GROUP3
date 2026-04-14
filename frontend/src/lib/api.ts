import type { LoginResponse } from '../types/auth';
import type {
  AnswerOption,
  Enrollment,
  LessonContentBlock,
  LessonSummary,
  ModuleBuilderPayload,
  ModuleSummary,
  ProgressResponse,
  TopicSummary,
  QuizQuestion,
  QuizResult,
  QuizQuestionRow,
  QuizSummary,
} from '../types/lms';
import { getToken } from './auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

interface ApiOptions extends RequestInit {
  auth?: boolean;
}

async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers = new Headers(options.headers ?? {});
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  if (options.auth !== false) {
    const token = getToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const data = (await response.json().catch(() => ({}))) as { message?: string } & T;
  if (!response.ok) {
    throw new Error(data.message ?? `Request failed (${response.status})`);
  }
  return data;
}

export async function register(fullName: string, email: string, password: string): Promise<LoginResponse> {
  return apiRequest<LoginResponse>('/api/auth/register', {
    method: 'POST',
    auth: false,
    body: JSON.stringify({ fullName, email, password }),
  });
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  return apiRequest<LoginResponse>('/api/auth/login', {
    method: 'POST',
    auth: false,
    body: JSON.stringify({ email, password }),
  });
}

export async function getModules(): Promise<ModuleSummary[]> {
  const data = await apiRequest<{ modules: ModuleSummary[] }>('/api/modules');
  return data.modules;
}

export async function getModuleById(moduleId: number): Promise<ModuleSummary & { lessons: LessonSummary[] }> {
  const data = await apiRequest<{ module: ModuleSummary & { lessons: LessonSummary[] } }>(`/api/modules/${moduleId}`);
  return data.module;
}

export async function getModuleBuilder(moduleId: number): Promise<ModuleBuilderPayload> {
  return apiRequest<ModuleBuilderPayload>(`/api/modules/${moduleId}/builder`);
}

export async function createModule(payload: {
  title: string;
  description: string;
  category?: string;
  difficulty?: 'Beginner' | 'Intermediate' | 'Advanced';
  thumbnailUrl?: string;
}) {
  return apiRequest<{ module: ModuleSummary }>('/api/modules', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateModule(
  moduleId: number,
  payload: Partial<{
    title: string;
    description: string;
    category: string;
    difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
    thumbnailUrl: string;
    prerequisiteModuleId: number | null;
    isLocked: boolean;
    isActive: boolean;
  }>
) {
  return apiRequest<{ module: ModuleSummary }>(`/api/modules/${moduleId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function getLessons(moduleId: number): Promise<LessonSummary[]> {
  const data = await apiRequest<{ lessons: LessonSummary[] }>(`/api/lessons?moduleId=${moduleId}`);
  return data.lessons;
}

export async function createLesson(payload: {
  moduleId: number;
  title: string;
  summary?: string;
  estimatedMinutes?: number;
  overviewText?: string;
  overviewImageUrl?: string;
}): Promise<LessonSummary> {
  const data = await apiRequest<{ lesson: LessonSummary }>('/api/lessons', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.lesson;
}

export async function updateLesson(
  lessonId: number,
  payload: Partial<{
    sequenceNo: number;
    title: string;
    summary: string;
    estimatedMinutes: number;
    overviewText: string;
    overviewImageUrl: string;
    isPublished: boolean;
  }>
): Promise<LessonSummary> {
  const data = await apiRequest<{ lesson: LessonSummary }>(`/api/lessons/${lessonId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return data.lesson;
}

export async function deleteLesson(lessonId: number) {
  await apiRequest<{}>(`/api/lessons/${lessonId}`, {
    method: 'DELETE',
  });
}

export async function reorderLessons(moduleId: number, orderedLessonIds: number[]): Promise<LessonSummary[]> {
  const data = await apiRequest<{ lessons: LessonSummary[] }>('/api/lessons/reorder', {
    method: 'PATCH',
    body: JSON.stringify({ moduleId, orderedLessonIds }),
  });
  return data.lessons;
}

export async function getLessonContent(lessonId: number): Promise<LessonContentBlock[]> {
  const data = await apiRequest<{ content: LessonContentBlock[] }>(`/api/content?lessonId=${lessonId}`);
  return data.content;
}

export async function createLessonContent(payload: {
  topicId: number;
  contentType: 'text' | 'image' | 'video' | 'simulation' | 'file';
  title: string;
  bodyText?: string;
  contentUrl?: string;
  simulationKey?: string;
  isRequired?: boolean;
  sortOrder?: number;
}): Promise<LessonContentBlock> {
  const data = await apiRequest<{ content: LessonContentBlock }>('/api/content', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.content;
}

export async function updateLessonContent(
  contentId: number,
  payload: Partial<{
    topicId: number;
    title: string;
    bodyText: string;
    contentUrl: string;
    simulationKey: string;
    isRequired: boolean;
    sortOrder: number;
  }>
): Promise<LessonContentBlock> {
  const data = await apiRequest<{ content: LessonContentBlock }>(`/api/content/${contentId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return data.content;
}

export async function deleteLessonContent(contentId: number) {
  await apiRequest<{}>(`/api/content/${contentId}`, {
    method: 'DELETE',
  });
}

export async function getTopics(lessonId: number): Promise<TopicSummary[]> {
  const data = await apiRequest<{ topics: TopicSummary[] }>(`/api/topics?lessonId=${lessonId}`);
  return data.topics;
}

export async function createTopic(payload: {
  lessonId: number;
  title: string;
  summary?: string;
  sortOrder?: number;
  isPublished?: boolean;
}): Promise<TopicSummary> {
  const data = await apiRequest<{ topic: TopicSummary }>('/api/topics', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.topic;
}

export async function updateTopic(
  topicId: number,
  payload: Partial<{
    title: string;
    summary: string;
    sortOrder: number;
    isPublished: boolean;
  }>
): Promise<TopicSummary> {
  const data = await apiRequest<{ topic: TopicSummary }>(`/api/topics/${topicId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return data.topic;
}

export async function deleteTopic(topicId: number) {
  await apiRequest<{}>(`/api/topics/${topicId}`, {
    method: 'DELETE',
  });
}

export async function reorderTopics(lessonId: number, orderedTopicIds: number[]): Promise<TopicSummary[]> {
  const data = await apiRequest<{ topics: TopicSummary[] }>('/api/topics/reorder', {
    method: 'PATCH',
    body: JSON.stringify({ lessonId, orderedTopicIds }),
  });
  return data.topics;
}

export async function getQuizzesByModule(moduleId: number): Promise<QuizSummary[]> {
  const data = await apiRequest<{ quizzes: QuizSummary[] }>(`/api/quizzes?moduleId=${moduleId}`);
  return data.quizzes;
}

export async function createQuiz(payload: {
  moduleId: number;
  lessonId?: number | null;
  title: string;
  quizType: 'lesson_quiz' | 'final_exam';
  passingScore?: number;
  timeLimitMinutes?: number;
  attemptLimit?: number;
}): Promise<QuizSummary> {
  const data = await apiRequest<{ quiz: QuizSummary }>('/api/quizzes', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.quiz;
}

export async function updateQuiz(
  quizId: number,
  payload: Partial<{
    lessonId: number | null;
    title: string;
    passingScore: number;
    timeLimitMinutes: number;
    attemptLimit: number;
    isActive: boolean;
  }>
): Promise<QuizSummary> {
  const data = await apiRequest<{ quiz: QuizSummary }>(`/api/quizzes/${quizId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return data.quiz;
}

export async function deleteQuiz(quizId: number) {
  await apiRequest<{}>(`/api/quizzes/${quizId}`, {
    method: 'DELETE',
  });
}

export async function getQuizQuestions(quizId: number): Promise<QuizQuestionRow[]> {
  const data = await apiRequest<{ questions: QuizQuestionRow[] }>(`/api/quizzes/${quizId}/questions`);
  return data.questions;
}

export async function createQuizQuestion(
  quizId: number,
  payload: { prompt: string; points?: number; sortOrder?: number }
): Promise<QuizQuestionRow> {
  const data = await apiRequest<{ question: QuizQuestionRow }>(`/api/quizzes/${quizId}/questions`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.question;
}

export async function updateQuizQuestion(
  questionId: number,
  payload: Partial<{ prompt: string; points: number; sortOrder: number }>
): Promise<QuizQuestionRow> {
  const data = await apiRequest<{ question: QuizQuestionRow }>(`/api/quizzes/questions/${questionId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return data.question;
}

export async function deleteQuizQuestion(questionId: number) {
  await apiRequest<{}>(`/api/quizzes/questions/${questionId}`, {
    method: 'DELETE',
  });
}

export async function getQuestionAnswers(questionId: number): Promise<AnswerOption[]> {
  const data = await apiRequest<{ answers: AnswerOption[] }>(`/api/quizzes/questions/${questionId}/answers`);
  return data.answers;
}

export async function createQuestionAnswer(
  questionId: number,
  payload: { answerText: string; isCorrect?: boolean; explanation?: string; sortOrder?: number }
): Promise<AnswerOption> {
  const data = await apiRequest<{ answer: AnswerOption }>(`/api/quizzes/questions/${questionId}/answers`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.answer;
}

export async function updateQuestionAnswer(
  answerId: number,
  payload: Partial<{ answerText: string; isCorrect: boolean; explanation: string; sortOrder: number }>
): Promise<AnswerOption> {
  const data = await apiRequest<{ answer: AnswerOption }>(`/api/quizzes/answers/${answerId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return data.answer;
}

export async function deleteQuestionAnswer(answerId: number) {
  await apiRequest<{}>(`/api/quizzes/answers/${answerId}`, {
    method: 'DELETE',
  });
}

export async function getEnrollments(): Promise<Enrollment[]> {
  const data = await apiRequest<{ enrollments: Enrollment[] }>('/api/enrollments');
  return data.enrollments;
}

export async function enroll(moduleId: number): Promise<Enrollment> {
  const data = await apiRequest<{ enrollment: Enrollment }>('/api/enrollments', {
    method: 'POST',
    body: JSON.stringify({ moduleId }),
  });
  return data.enrollment;
}

export async function getEnrollmentProgress(enrollmentId: number): Promise<ProgressResponse> {
  return apiRequest<ProgressResponse>(`/api/progress/${enrollmentId}`);
}

export async function completeLesson(enrollmentId: number, lessonId: number): Promise<{ completionPercent: number }> {
  return apiRequest<{ completionPercent: number }>(`/api/progress/lessons/${lessonId}/complete`, {
    method: 'POST',
    body: JSON.stringify({ enrollmentId, lastPositionSeconds: 0 }),
  });
}

export async function saveLessonCheckpoint(
  enrollmentId: number,
  lessonId: number,
  lastPositionSeconds: number
): Promise<{ saved: boolean }> {
  return apiRequest<{ saved: boolean }>(`/api/progress/lessons/${lessonId}/checkpoint`, {
    method: 'POST',
    body: JSON.stringify({ enrollmentId, lastPositionSeconds }),
  });
}

export async function startQuiz(enrollmentId: number, quizId: number): Promise<{ quiz: QuizSummary; questions: QuizQuestion[] }> {
  return apiRequest<{ quiz: QuizSummary; questions: QuizQuestion[] }>(`/api/quizzes/${quizId}/start`, {
    method: 'POST',
    body: JSON.stringify({ enrollmentId }),
  });
}

export async function submitQuiz(
  enrollmentId: number,
  quizId: number,
  answers: Array<{ questionId: number; answerId: number }>
): Promise<{ result: QuizResult }> {
  return apiRequest<{ result: QuizResult }>('/api/results/submit', {
    method: 'POST',
    body: JSON.stringify({ enrollmentId, quizId, answers }),
  });
}

export async function getResults(): Promise<QuizResult[]> {
  const data = await apiRequest<{ results: QuizResult[] }>('/api/results');
  return data.results;
}

export async function getEnrollmentResults(enrollmentId: number): Promise<QuizResult[]> {
  const data = await apiRequest<{ results: QuizResult[] }>(`/api/results/enrollments/${enrollmentId}`);
  return data.results;
}

export async function getUserDashboard() {
  return apiRequest<{ enrollments: number; averageScore: number; completedModules: number }>('/api/dashboard/user');
}

export async function getAdminDashboard() {
  return apiRequest<{ totalUsers: number; totalEnrollments: number; averageScore: number; completionRate: number }>(
    '/api/dashboard/admin'
  );
}

export async function getUsers(): Promise<
  Array<{
    id: number;
    email: string;
    full_name: string;
    role: 'admin' | 'user';
    is_active: boolean;
  }>
> {
  const data = await apiRequest<{
    users: Array<{
      id: number;
      email: string;
      full_name: string;
      role: 'admin' | 'user';
      is_active: boolean;
    }>;
  }>('/api/users');
  return data.users;
}

export async function createUser(payload: {
  fullName: string;
  email: string;
  password: string;
  role?: 'admin' | 'user';
  isActive?: boolean;
}) {
  return apiRequest<{
    user: {
      id: number;
      email: string;
      full_name: string;
      role: 'admin' | 'user';
      is_active: boolean;
    };
  }>('/api/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateUser(id: number, payload: { role?: 'admin' | 'user'; isActive?: boolean }) {
  return apiRequest<{ user: unknown }>(`/api/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function updateUserDetails(
  id: number,
  payload: {
    fullName?: string;
    email?: string;
    password?: string;
    role?: 'admin' | 'user';
    isActive?: boolean;
  }
) {
  return apiRequest<{ user: unknown }>(`/api/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteUser(id: number) {
  await apiRequest<{}>(`/api/users/${id}`, {
    method: 'DELETE',
  });
}
