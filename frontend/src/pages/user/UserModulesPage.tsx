import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { enroll, getEnrollmentProgress, getEnrollments, getModules } from '../../lib/api';
import type { Enrollment, ModuleSummary } from '../../types/lms';

export function UserModulesPage() {
  const navigate = useNavigate();
  const [modules, setModules] = useState<ModuleSummary[]>([]);
  const [enrollmentByModuleId, setEnrollmentByModuleId] = useState<Record<number, Enrollment>>({});
  const [completionByModuleId, setCompletionByModuleId] = useState<Record<number, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingStartModule, setPendingStartModule] = useState<ModuleSummary | null>(null);
  const [isStartingModule, setIsStartingModule] = useState(false);
  const [carouselStart, setCarouselStart] = useState(0);
  const [carouselSize, setCarouselSize] = useState(3);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError('');
      try {
        const [data, enrollments] = await Promise.all([getModules(), getEnrollments()]);
        // User module discovery should only show published modules.
        const publishedModules = data.filter((module) => module.is_active);
        setModules(publishedModules);

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

  useEffect(() => {
    const updateCarouselSize = () => {
      if (window.innerWidth < 768) {
        setCarouselSize(1);
        return;
      }
      if (window.innerWidth < 1280) {
        setCarouselSize(2);
        return;
      }
      setCarouselSize(3);
    };
    updateCarouselSize();
    window.addEventListener('resize', updateCarouselSize);
    return () => window.removeEventListener('resize', updateCarouselSize);
  }, []);

  const filteredModules = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return modules;
    return modules.filter((module) =>
      `${module.title} ${module.description} ${module.category ?? ''}`.toLowerCase().includes(query)
    );
  }, [modules, searchQuery]);

  const enrolledModules = useMemo(
    () => filteredModules.filter((module) => Boolean(enrollmentByModuleId[module.id])),
    [filteredModules, enrollmentByModuleId]
  );
  const notEnrolledModules = useMemo(
    () => filteredModules.filter((module) => !enrollmentByModuleId[module.id]),
    [filteredModules, enrollmentByModuleId]
  );

  const maxCarouselStart = Math.max(0, notEnrolledModules.length - carouselSize);
  const carouselModules = notEnrolledModules.slice(carouselStart, carouselStart + carouselSize);

  useEffect(() => {
    setCarouselStart(0);
  }, [searchQuery]);

  useEffect(() => {
    setCarouselStart((previous) => Math.min(previous, maxCarouselStart));
  }, [maxCarouselStart]);

  const openModule = (moduleId: number) => {
    navigate(`/user/modules/${moduleId}`);
  };

  const handleConfirmStartModule = async () => {
    if (!pendingStartModule) return;
    const selected = pendingStartModule;
    setIsStartingModule(true);
    setError('');
    try {
      const createdEnrollment = await enroll(selected.id);
      setEnrollmentByModuleId((previous) => ({ ...previous, [selected.id]: createdEnrollment }));
      const progress = await getEnrollmentProgress(createdEnrollment.id);
      setCompletionByModuleId((previous) => ({ ...previous, [selected.id]: progress.completionPercent }));
      setPendingStartModule(null);
      openModule(selected.id);
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : 'Failed to start module.');
    } finally {
      setIsStartingModule(false);
    }
  };

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-300">Learning Center</span>
            <h2 className="mt-1 text-2xl font-bold text-white">My Modules</h2>
            <p className="mt-1 text-sm text-slate-300">Find a module quickly, continue active training, or start a new track.</p>
          </div>

          <div className="relative w-full max-w-xl">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search title, category, or description..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full rounded-lg border border-white/20 bg-slate-900/70 py-2.5 pl-9 pr-3 text-sm text-slate-200 outline-none ring-0 placeholder:text-slate-400 focus:border-brand-500"
            />
          </div>
        </div>
      </div>

      {error ? <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
      {isLoading ? <p className="text-sm text-slate-400">Loading modules...</p> : null}

      {!isLoading ? (
        <div className="space-y-8">
          <section className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/10 pb-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Active Learning</p>
                <h3 className="text-lg font-bold text-white">Enrolled Modules</h3>
              </div>
              <span className="rounded-full bg-brand-500/10 px-3 py-1 text-xs font-semibold text-brand-300">
                {enrolledModules.length} total
              </span>
            </div>

            {enrolledModules.length === 0 ? (
              <p className="rounded-xl border border-white/10 bg-slate-900/70 p-4 text-sm text-slate-300 shadow-sm">
                No enrolled modules found.
              </p>
            ) : (
              <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
                {enrolledModules.map((module) => (
                  <article key={module.id} className="flex h-full flex-col rounded-xl border border-white/10 bg-slate-900/70 p-5 shadow-sm">
                    <div className="flex-1">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-200">
                          {module.category ?? 'General'}
                        </span>
                        <span className="rounded-full bg-brand-500/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-brand-300">
                          Enrolled
                        </span>
                      </div>
                      <div className="mb-3 aspect-video w-full overflow-hidden rounded-md border border-white/10 bg-white/10">
                        {module.thumbnail_url ? (
                          <img src={module.thumbnail_url} alt={module.title} className="h-full w-full object-contain" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs font-semibold uppercase tracking-wider text-slate-400">
                            No Thumbnail
                          </div>
                        )}
                      </div>
                      <h3 className="min-h-[56px] text-lg font-bold leading-7 text-white">{module.title}</h3>
                      <p className="mt-2 min-h-[72px] max-h-[72px] overflow-hidden text-sm leading-6 text-slate-300">{module.description}</p>
                      <div className="mt-4 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5">
                        <div className="mb-1.5 flex items-center justify-between text-xs font-semibold">
                          <span className="uppercase tracking-wider text-slate-400">Progress</span>
                          <span className="text-brand-300">{completionByModuleId[module.id] ?? 0}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-800/70">
                          <div
                            className="h-full rounded-full bg-brand-500 transition-all"
                            style={{ width: `${Math.max(0, Math.min(100, completionByModuleId[module.id] ?? 0))}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => openModule(module.id)}
                      className="mt-5 w-full rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-500"
                    >
                      Continue Module
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/10 pb-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Discover</p>
                <h3 className="text-lg font-bold text-white">Published Modules</h3>
              </div>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-200">
                {notEnrolledModules.length} total
              </span>
            </div>

            {notEnrolledModules.length === 0 ? (
              <p className="rounded-xl border border-white/10 bg-slate-900/70 p-4 text-sm text-slate-300 shadow-sm">
                No published modules found.
              </p>
            ) : (
              <div className="relative">
                <button
                  disabled={carouselStart <= 0}
                  onClick={() => setCarouselStart((previous) => Math.max(previous - 1, 0))}
                  className="absolute -left-4 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/10 bg-slate-900/85 p-2 text-slate-200 shadow-lg shadow-slate-300/70 backdrop-blur-md disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Previous modules"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  disabled={carouselStart >= maxCarouselStart}
                  onClick={() => setCarouselStart((previous) => Math.min(previous + 1, maxCarouselStart))}
                  className="absolute -right-4 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/10 bg-slate-900/85 p-2 text-slate-200 shadow-lg shadow-slate-300/70 backdrop-blur-md disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Next modules"
                >
                  <ChevronRight size={18} />
                </button>
                <div className="flex gap-5 px-2">
                  {carouselModules.map((module) => (
                    <article key={module.id} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-900/70 p-5 shadow-sm">
                      <div className="flex h-full flex-col">
                        <div className="flex-1">
                          <div className="mb-3 flex items-center justify-between gap-2">
                            <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-200">
                              {module.category ?? 'General'}
                            </span>
                            <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-300">
                              Published
                            </span>
                          </div>
                          <div className="mb-3 aspect-video w-full overflow-hidden rounded-md border border-white/10 bg-white/10">
                            {module.thumbnail_url ? (
                              <img src={module.thumbnail_url} alt={module.title} className="h-full w-full object-contain" />
                            ) : (
                              <div className="flex h-full items-center justify-center text-xs font-semibold uppercase tracking-wider text-slate-400">
                                No Thumbnail
                              </div>
                            )}
                          </div>
                          <h3 className="min-h-[56px] text-lg font-bold leading-7 text-white">{module.title}</h3>
                          <p className="mt-2 min-h-[72px] max-h-[72px] overflow-hidden text-sm leading-6 text-slate-300">{module.description}</p>
                        </div>
                        <button
                          onClick={() => setPendingStartModule(module)}
                          className="mt-5 w-full rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-500"
                        >
                          Start Module
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      ) : null}

      {pendingStartModule ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-slate-900/70 p-5 shadow-xl">
            <h3 className="text-lg font-bold text-white">Start Module</h3>
            <p className="mt-2 text-sm text-slate-300">
              Start <span className="font-semibold text-white">{pendingStartModule.title}</span>? You will be enrolled and moved to the module viewer.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={isStartingModule}
                onClick={() => setPendingStartModule(null)}
                className="rounded-md border border-white/20 px-4 py-2 text-sm font-semibold text-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isStartingModule}
                onClick={() => void handleConfirmStartModule()}
                className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isStartingModule ? 'Starting...' : 'Confirm Start'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

