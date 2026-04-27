export interface ModuleSummary {
  id: number;
  title: string;
  description: string;
  thumbnail_url?: string | null;
  category: string | null;
  prerequisite_module_id: number | null;
  is_locked: boolean;
  is_active: boolean;
  lessons_count?: number;
}

export interface ModuleCertificationSettings {
  module_id: number;
  require_all_lessons: boolean;
  require_lesson_quizzes: boolean;
  require_final_exam: boolean;
  min_final_exam_score: number;
}

export interface LessonSummary {
  id: number;
  module_id: number;
  sequence_no: number;
  title: string;
  summary: string;
  estimated_minutes: number;
  overview_text?: string;
  overview_image_url?: string | null;
  is_published?: boolean;
  completed?: boolean;
  completedAt?: string | null;
  lastPositionSeconds?: number;
}

export interface TopicSummary {
  id: number;
  lesson_id: number;
  title: string;
  summary: string;
  sort_order: number;
  is_published: boolean;
  completed?: boolean;
}

export interface LessonContentBlock {
  id: number;
  lesson_id: number;
  topic_id: number | null;
  content_type: 'text' | 'image' | 'video' | 'simulation' | 'file';
  title: string;
  body_text: string;
  content_url: string | null;
  simulation_key: string | null;
  metadata: Record<string, unknown>;
  sort_order: number;
  is_required: boolean;
}

export interface Enrollment {
  id: number;
  user_id: number;
  module_id: number;
  status: 'enrolled' | 'in_progress' | 'completed';
  enrolled_at: string;
  completed_at: string | null;
  module_title?: string;
  last_lesson_id?: number | null;
}

export interface QuizSummary {
  id: number;
  module_id: number;
  lesson_id: number | null;
  title: string;
  quiz_type: 'lesson_quiz' | 'final_exam';
  stage: 'pre_test' | 'post_test' | 'final_exam';
  passing_score: number;
  time_limit_minutes: number;
  attempt_limit: number;
  is_active: boolean;
}

export interface QuizQuestionRow {
  id: number;
  quiz_id: number;
  prompt: string;
  question_type: string;
  max_selections: number;
  points: number;
  sort_order: number;
}

export interface AnswerOption {
  id: number;
  question_id: number;
  answer_text: string;
  is_correct?: boolean;
  explanation?: string;
  sort_order: number;
}

export interface QuizQuestion {
  id: number;
  prompt: string;
  question_type: string;
  max_selections: number;
  points: number;
  sort_order: number;
  answers: AnswerOption[];
}

export interface QuizResultFeedback {
  earnedPoints?: number;
  totalPoints?: number;
}

export interface QuizResult {
  id: number;
  enrollment_id: number;
  user_id: number;
  quiz_id: number;
  attempt_no: number;
  score: number;
  passed: boolean;
  submitted_at: string;
  feedback?: QuizResultFeedback | null;
  quiz_title?: string;
  module_title?: string;
}

export interface Certificate {
  id: number;
  enrollment_id: number;
  user_id: number;
  module_id: number;
  certificate_no: string;
  pdf_url: string | null;
  issued_at: string;
  module_title?: string;
}

export interface ProgressResponse {
  enrollment: Enrollment;
  completionPercent: number;
  lessons: LessonSummary[];
}

export interface ModuleBuilderPayload {
  module: ModuleSummary;
  lessons: LessonSummary[];
  topics: TopicSummary[];
  content: LessonContentBlock[];
  quizzes: QuizSummary[];
  questions: QuizQuestionRow[];
  answers: AnswerOption[];
  certification: ModuleCertificationSettings;
}
