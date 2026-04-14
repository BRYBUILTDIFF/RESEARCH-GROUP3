import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getEnrollmentProgress, getEnrollments, getModules } from '../../lib/api';
import type { Enrollment, ModuleSummary } from '../../types/lms';

export function UserModulesPage() {
  const navigate = useNavigate();
  const [modules, setModules] = useState<ModuleSummary[]>([]);
  const [enrollmentByModuleId, setEnrollmentByModuleId] = useState<Record<number, Enrollment>>({});
  const [completionByModuleId, setCompletionByModuleId] = useState<Record<number, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError('');
      try {
        const [data, enrollments] = await Promise.all([getModules(), getEnrollments()]);
        setModules(data.filter((module) => module.is_active));

        const enrollmentMap: Record<number, Enrollment> = {};
        enrollments.forEach((enrollment) => {
          enrollmentMap[enrollment.module_id] = enrollment;
        });
        setEnrollmentByModuleId(enrollmentMap);

        const progressByModule: Record<number, number> = {};
        await Promise.all(
          enrollments.map(async (enrollment) => {
            const progress = await getEnrollmentProgress(enrollment.id);
            progressByModule[enrollment.module_id] = progress.completionPercent;
          })
        );
        setCompletionByModuleId(progressByModule);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load modules.');
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, []);

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">My Modules</h2>
        <p className="text-slate-600">Enroll and proceed through structured lessons in strict sequence.</p>
      </div>

      {error ? <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
      {isLoading ? <p className="text-sm text-slate-500">Loading modules...</p> : null}

      {!isLoading ? (
        <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
          {modules.map((module) => (
            <article key={module.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-700">
                  {module.category ?? 'General'}
                </span>
                <span className="text-xs text-slate-500">{module.difficulty}</span>
              </div>
              {module.thumbnail_url ? (
                <img src={module.thumbnail_url} alt={module.title} className="mb-3 h-32 w-full rounded-md border border-slate-200 object-cover" />
              ) : null}
              <h3 className="text-lg font-bold text-slate-900">{module.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{module.description}</p>
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className={`rounded-full px-2.5 py-1 font-semibold ${enrollmentByModuleId[module.id] ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                  {enrollmentByModuleId[module.id] ? 'Enrolled' : 'Not enrolled'}
                </span>
                {enrollmentByModuleId[module.id] ? (
                  <span className="text-slate-600">{completionByModuleId[module.id] ?? 0}% complete</span>
                ) : null}
              </div>
              <button
                onClick={() => navigate(`/user/modules/${module.id}`)}
                className="mt-4 rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
              >
                {enrollmentByModuleId[module.id] ? 'Continue Module' : 'Start Module'}
              </button>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
