import { StatCard } from '../../components/app/StatCard';

const moduleScores = [
  { module: 'Hardware', score: 85 },
  { module: 'Software', score: 92 },
  { module: 'Security', score: 78 },
];

export function AdminAnalyticsPage() {
  return (
    <section className="space-y-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-300">Insights</p>
        <h2 className="text-2xl font-bold text-white">Performance Analytics</h2>
        <p className="text-slate-400">Module-level insights and completion metrics.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Pass Rate" value="75%" />
        <StatCard label="Average Completion Time" value="9m 40s" />
        <StatCard label="Assessments Taken" value={128} />
      </div>

      <div className="dark-glass-card border-white/10 p-6">
        <h3 className="mb-4 text-lg font-bold text-white">Score by Module</h3>
        <div className="space-y-4">
          {moduleScores.map((row) => (
            <div key={row.module}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium text-slate-300">{row.module}</span>
                <span className="font-semibold text-slate-100">{row.score}%</span>
              </div>
              <div className="h-3 w-full rounded-full bg-slate-800">
                <div className="h-3 rounded-full bg-brand-500" style={{ width: `${row.score}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
