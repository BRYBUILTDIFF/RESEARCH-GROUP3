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
        <h2 className="text-2xl font-bold text-slate-900">Performance Analytics</h2>
        <p className="text-slate-600">Module-level insights and completion metrics.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Pass Rate" value="75%" />
        <StatCard label="Average Completion Time" value="9m 40s" />
        <StatCard label="Assessments Taken" value={128} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-bold text-slate-900">Score by Module</h3>
        <div className="space-y-4">
          {moduleScores.map((row) => (
            <div key={row.module}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">{row.module}</span>
                <span className="font-semibold text-slate-900">{row.score}%</span>
              </div>
              <div className="h-3 w-full rounded-full bg-slate-100">
                <div className="h-3 rounded-full bg-sky-600" style={{ width: `${row.score}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
