import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { getEnrollmentResults, startQuiz, submitQuiz } from '../../lib/api';
import type { QuizQuestion, QuizResult, QuizSummary } from '../../types/lms';

export function QuizPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const [searchParams] = useSearchParams();

  const enrollmentId = Number(searchParams.get('enrollmentId'));
  const moduleId = Number(searchParams.get('moduleId'));
  const quizIdNumber = Number(quizId);

  const [quiz, setQuiz] = useState<QuizSummary | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [selected, setSelected] = useState<Record<number, number>>({});
  const [attemptsUsed, setAttemptsUsed] = useState(0);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<QuizResult | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!quizIdNumber || !enrollmentId) {
        setError('Invalid quiz or enrollment.');
        return;
      }
      setIsLoading(true);
      setError('');
      try {
        const [data, history] = await Promise.all([startQuiz(enrollmentId, quizIdNumber), getEnrollmentResults(enrollmentId)]);
        setQuiz(data.quiz);
        setQuestions(data.questions);
        setAttemptsUsed(history.filter((item) => item.quiz_id === quizIdNumber).length);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to start quiz.');
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, [enrollmentId, quizIdNumber]);

  const answeredCount = useMemo(() => Object.keys(selected).length, [selected]);
  const attemptsRemaining = quiz ? Math.max(quiz.attempt_limit - attemptsUsed, 0) : 0;
  const backToPath = moduleId ? `/user/modules/${moduleId}` : '/user/modules';

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!quiz || !enrollmentId) return;
    if (answeredCount !== questions.length) {
      setError('Please answer all questions before submitting.');
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      const payload = await submitQuiz(
        enrollmentId,
        quiz.id,
        Object.entries(selected).map(([questionId, answerId]) => ({
          questionId: Number(questionId),
          answerId: Number(answerId),
        }))
      );
      setResult(payload.result);
      setAttemptsUsed((previous) => previous + 1);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to submit quiz.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">{quiz?.title ?? 'Quiz'}</h2>
        <p className="text-slate-600">
          Passing score: {quiz?.passing_score ?? '--'}% | Time limit: {quiz?.time_limit_minutes ?? '--'} minutes
        </p>
        <p className="text-xs text-slate-500">
          Attempts used: {attemptsUsed} / {quiz?.attempt_limit ?? '--'} {quiz ? `| Remaining: ${attemptsRemaining}` : ''}
        </p>
      </div>

      {error ? <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
      {isLoading ? <p className="text-sm text-slate-500">Loading quiz...</p> : null}

      {!isLoading ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          {questions.map((question, index) => (
            <article key={question.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="font-semibold text-slate-900">
                {index + 1}. {question.prompt}
              </h3>
              <div className="mt-3 space-y-2">
                {question.answers.map((answer) => (
                  <label key={answer.id} className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
                    <input
                      type="radio"
                      name={`question-${question.id}`}
                      checked={selected[question.id] === answer.id}
                      onChange={() => setSelected((previous) => ({ ...previous, [question.id]: answer.id }))}
                    />
                    <span>{answer.answer_text}</span>
                  </label>
                ))}
              </div>
            </article>
          ))}

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-600">
              Answered: {answeredCount} / {questions.length}
            </p>
            <button
              type="submit"
              disabled={isSubmitting || questions.length === 0}
              className="mt-3 rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Quiz'}
            </button>
          </div>

          {result ? (
            <div className={`rounded-md p-4 text-sm ${result.passed ? 'border border-emerald-200 bg-emerald-50 text-emerald-700' : 'border border-amber-200 bg-amber-50 text-amber-700'}`}>
              <p>
                Score: {Number(result.score)}% - {result.passed ? 'Passed' : 'Failed'}
              </p>
              <p className="text-xs">
                Attempt #{result.attempt_no}
                {result.feedback?.earnedPoints !== undefined && result.feedback?.totalPoints !== undefined
                  ? ` | Points: ${result.feedback.earnedPoints}/${result.feedback.totalPoints}`
                  : ''}
              </p>
            </div>
          ) : null}
        </form>
      ) : null}

      <Link to={backToPath} className="inline-flex text-sm font-medium text-sky-700 hover:underline">
        Back
      </Link>
    </section>
  );
}
