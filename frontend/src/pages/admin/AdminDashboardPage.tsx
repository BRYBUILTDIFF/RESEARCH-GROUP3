import { useEffect, useState } from 'react';
import { StatCard } from '../../components/app/StatCard';
import { getAdminDashboard } from '../../lib/api';

export function AdminDashboardPage() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalEnrollments: 0,
    averageScore: 0,
    completionRate: 0,
  });
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setError('');
      try {
        const dashboard = await getAdminDashboard();
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
        <h2 className="text-2xl font-bold text-slate-900">Admin Dashboard</h2>
        <p className="text-slate-600">Monitor user activity, enrollment trends, and learning outcomes.</p>
      </div>

      {error ? <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Users" value={stats.totalUsers} />
        <StatCard label="Total Enrollments" value={stats.totalEnrollments} />
        <StatCard label="Average Score" value={`${stats.averageScore}%`} />
        <StatCard label="Completion Rate" value={`${stats.completionRate}%`} />
      </div>
    </section>
  );
}
