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
  const [imageLoadErrorByModuleId, setImageLoadErrorByModuleId] = useState<Record<number, true>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingStartModule, setPendingStartModule] = useState<ModuleSummary | null>(null);
  const [isStartingModule, setIsStartingModule] = useState(false);
  const [carouselStart, setCarouselStart] = useState(0);
  const carouselSize = 2;

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError('');
      try {
        const [data, enrollments] = await Promise.all([getModules(), getEnrollments()]);
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

  const enrolledModules = useMemo(
    () => modules.filter((module) => Boolean(enrollmentByModuleId[module.id])),
    [modules, enrollmentByModuleId]
  );
  const notEnrolledModules = useMemo(
    () => {
      const query = searchQuery.trim().toLowerCase();
      return modules.filter((module) => {
        if (enrollmentByModuleId[module.id]) return false;
        if (!query) return true;
        return `${module.title} ${module.description} ${module.category ?? ''}`.toLowerCase().includes(query);
      });
    },
    [modules, enrollmentByModuleId, searchQuery]
  );

  const enrolledMaxCarouselStart = Math.max(0, enrolledModules.length - carouselSize);
  const enrolledCarouselModules = enrolledModules.slice(carouselStart, carouselStart + carouselSize);

  useEffect(() => {
    setCarouselStart(0);
  }, [searchQuery]);

  useEffect(() => {
    setCarouselStart((previous) => Math.min(previous, enrolledMaxCarouselStart));
  }, [enrolledMaxCarouselStart]);

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
      openModule(selected.id);4
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : 'Failed to start module.');
    } finally {
      setIsStartingModule(false);
    }
  };

  return (
    <section className="space-y-6">
      <h2 className="sr-only">HelpDesk Academy modules page with enrolled carousel on left and published modules on right</h2>

      <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 shadow-sm">
        <div className="flex flex-col gap-4">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-300">Learning Center</span>
            <h2 className="mt-1 text-2xl font-bold text-white">My Modules</h2>
            <p className="mt-1 text-sm text-slate-300">Continue your active training or discover a new track to enroll in.</p>
          </div>
        </div>
      </div>

      {error ? <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
      {isLoading ? <p className="text-sm text-slate-400">Loading modules...</p> : null}

      {!isLoading ? (
        <div className="grid min-h-[calc(100vh-245px)] items-stretch gap-8 xl:grid-cols-[1.4fr_0.9fr]">
          <section className="flex h-full flex-col rounded-2xl border border-white/10 bg-slate-900/70 shadow-sm xl:border-r-0 xl:border-r-white/10">
            <div className="border-b border-white/10 px-5 py-4 sm:px-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Active Learning</p>
                  <h3 className="text-lg font-bold text-white">Enrolled modules</h3>
                </div>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-200">
                  {enrolledModules.length} total
                </span>
              </div>
            </div>
            <div className="carousel-wrap flex flex-1 flex-col gap-4 p-5 sm:p-6">
              {enrolledModules.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6 text-sm text-slate-300 shadow-sm">
                  No enrolled modules found. Discover a published module to start training.
                </div>
              ) : (
                <>
                  <div className="relative flex-1">
                    <button
                      type="button"
                      disabled={carouselStart <= 0}
                      onClick={() => setCarouselStart((previous) => Math.max(previous - 1, 0))}
                      className="absolute -left-3 top-1/2 z-10 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl border border-white/10 bg-slate-900/90 text-slate-200 transition disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Previous enrolled module"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <button
                      type="button"
                      disabled={carouselStart >= enrolledMaxCarouselStart}
                      onClick={() => setCarouselStart((previous) => Math.min(previous + 1, enrolledMaxCarouselStart))}
                      className="absolute -right-3 top-1/2 z-10 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl border border-white/10 bg-slate-900/90 text-slate-200 transition disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Next enrolled module"
                    >
                      <ChevronRight size={18} />
                    </button>

                    <div className="carousel-viewport h-full overflow-hidden rounded-2xl">
                      <div className="carousel-track flex h-full gap-4 transition-transform duration-300">
                      {enrolledCarouselModules.map((module) => (
                        <article key={module.id} className="relative flex min-h-[560px] min-w-0 flex-1 rounded-2xl border border-white/10 bg-slate-900/70 p-3.5 shadow-sm sm:min-h-[590px] sm:p-4">
                          <div className="flex h-full flex-col">
                            <div className="mb-3 flex items-center justify-between gap-2">
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-300/25 bg-cyan-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-100">
                                <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
                                {module.category ?? 'General'}
                              </span>
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-300/25 bg-brand-500/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-100">
                                <span className="h-1.5 w-1.5 rounded-full bg-brand-300" />
                                Enrolled
                              </span>
                            </div>

                            <div className="mb-3 h-52 w-full overflow-hidden rounded-xl border border-white/10 bg-slate-950/50 sm:h-56">
                              {module.thumbnail_url && !imageLoadErrorByModuleId[module.id] ? (
                                <img
                                  src={module.thumbnail_url}
                                  alt={module.title}
                                  loading="lazy"
                                  onError={() => setImageLoadErrorByModuleId((previous) => ({ ...previous, [module.id]: true }))}
                                  className="h-full w-full object-contain"
                                />
                              ) : (
                                <div className="flex h-full items-center justify-center text-xs font-semibold uppercase tracking-wider text-slate-400">
                                  No Thumbnail
                                </div>
                              )}
                            </div>

                            <h3 className="text-base font-bold leading-6 text-white">{module.title}</h3>
                            <p className="mt-1.5 max-h-[126px] overflow-hidden text-sm leading-6 text-slate-300">{module.description}</p>

                            <div className="mt-auto rounded-2xl border border-white/10 bg-white/5 p-3">
                              <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                                <span>Progress</span>
                                <span className="text-brand-300">{completionByModuleId[module.id] ?? 0}%</span>
                              </div>
                              <div className="h-2 overflow-hidden rounded-full bg-slate-800/70">
                                <div
                                  className="h-full rounded-full bg-brand-500 transition-all"
                                  style={{ width: `${Math.max(0, Math.min(100, completionByModuleId[module.id] ?? 0))}%` }}
                                />
                              </div>
                            </div>

                            <button
                              onClick={() => openModule(module.id)}
                              className="mt-3 w-full rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-500"
                            >
                              Continue module
                            </button>
                          </div>
                        </article>
                      ))}
                      </div>
                    </div>
                  </div>

                  <div className="carousel-nav flex items-center justify-end gap-3">
                    <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                      Showing {Math.min(carouselStart + 1, enrolledModules.length)}-{Math.min(carouselStart + carouselSize, enrolledModules.length)} of {enrolledModules.length}
                    </span>
                  </div>
                </>
              )}
            </div>
          </section>

          <section className="flex h-full flex-col rounded-2xl border border-white/10 bg-slate-900/70 shadow-sm">
            <div className="border-b border-white/10 px-5 py-4 sm:px-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Discover</p>
                  <h3 className="text-lg font-bold text-white">Published modules</h3>
                </div>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-200">
                  {notEnrolledModules.length} total
                </span>
              </div>
            </div>

            <div className="px-5 pt-5 sm:px-6 sm:pt-6">
              <div className="relative">
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

            <div className="pub-scroll flex flex-1 flex-col gap-3 p-5 sm:p-6">
              {notEnrolledModules.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6 text-sm text-slate-300 shadow-sm">
                  No published modules found.
                </div>
              ) : (
                notEnrolledModules.map((module) => (
                  <article
                    key={module.id}
                    className="pub-card flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900/70 transition hover:border-white/20 sm:min-h-[170px] sm:flex-row"
                    onClick={() => setPendingStartModule(module)}
                  >
                    <div className="pub-thumb flex h-32 w-full items-center justify-center border-b border-white/10 bg-slate-950/50 p-2 sm:h-auto sm:w-36 sm:min-w-[144px] sm:border-b-0 sm:border-r sm:p-2.5">
                      {module.thumbnail_url && !imageLoadErrorByModuleId[module.id] ? (
                        <img
                          src={module.thumbnail_url}
                          alt={module.title}
                          loading="lazy"
                          onError={() => setImageLoadErrorByModuleId((previous) => ({ ...previous, [module.id]: true }))}
                          className="h-full w-full rounded-md object-contain"
                        />
                      ) : (
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">No Image</span>
                      )}
                    </div>

                    <div className="pub-info flex flex-1 flex-col gap-2.5 p-3.5 sm:p-4">
                      <div className="pub-top flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-300/25 bg-cyan-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-100">
                          <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
                          {module.category ?? 'General'}
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/25 bg-emerald-500/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-100">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                          Published
                        </span>
                      </div>

                      <div className="flex-1">
                        <h4 className="pub-title text-sm font-semibold text-white">{module.title}</h4>
                        <p className="pub-desc mt-1.5 max-h-[66px] overflow-hidden text-sm leading-5 text-slate-300">{module.description}</p>
                      </div>

                      <div className="pub-footer mt-auto flex items-center justify-between gap-3">
                        <span className="pub-meta text-xs text-slate-400">{module.lessons_count ?? '-'} lessons</span>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setPendingStartModule(module);
                          }}
                          className="enroll-btn rounded-full border border-[#378ADD] bg-transparent px-3 py-2 text-xs font-semibold text-[#378ADD] transition hover:bg-[#378ADD] hover:text-white"
                        >
                          Enroll
                        </button>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
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
