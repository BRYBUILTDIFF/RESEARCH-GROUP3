import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { StatCard } from '../../components/app/StatCard';
import { getUserDashboard } from '../../lib/api';

export function UserDashboardPage() {
  const [stats, setStats] = useState({ enrollments: 0, averageScore: 0, completedModules: 0 });
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setError('');
      try {
        const dashboard = await getUserDashboard();
        setStats(dashboard);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load dashboard.');
      }
    };
    void load();
  }, []);

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Learner Dashboard</h2>
        <p className="text-slate-600">Track your progress, continue modules, and complete assessments.</p>
      </div>

      {error ? <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Enrolled Modules" value={stats.enrollments} />
        <StatCard label="Average Score" value={`${stats.averageScore}%`} />
        <StatCard label="Completed Modules" value={stats.completedModules} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900">Continue Learning</h3>
        <p className="mt-2 text-sm text-slate-600">
          Resume from your latest lesson position. Progress checkpoints are saved automatically.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link to="/user/modules" className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500">
            Open Modules
          </Link>
          <Link to="/user/progress" className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            View Progress
          </Link>
        </div>
      </div>
    </section>
  );
}
