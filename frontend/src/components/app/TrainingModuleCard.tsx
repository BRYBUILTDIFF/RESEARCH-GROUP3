import { ArrowRight, BookOpen, Clock } from 'lucide-react';
import type { TrainingModule } from '../../data/mockData';

interface TrainingModuleCardProps {
  module: TrainingModule;
  actionLabel: string;
}

export function TrainingModuleCard({ module, actionLabel }: TrainingModuleCardProps) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-4">
        <span className="text-xs font-bold uppercase tracking-wider text-sky-700">Module {module.id}</span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-700">
          {module.status}
        </span>
      </div>

      <h3 className="text-xl font-bold text-slate-900">{module.title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-slate-600">{module.description}</p>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-600">
        <span className="rounded-md bg-slate-50 px-2 py-1">{module.category}</span>
        <span className="rounded-md bg-slate-50 px-2 py-1">{module.level}</span>
      </div>

      <div className="mt-6 flex items-center gap-4 text-sm text-slate-600">
        <span className="inline-flex items-center gap-2">
          <BookOpen size={16} />
          {module.lessonsCount} lessons
        </span>
        <span className="inline-flex items-center gap-2">
          <Clock size={16} />
          {module.duration}
        </span>
      </div>

      <button className="mt-6 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
        {actionLabel}
        <ArrowRight size={16} />
      </button>
    </article>
  );
}
