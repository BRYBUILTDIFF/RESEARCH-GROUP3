import { trainees } from '../../data/mockData';

export function AdminTraineesPage() {
  return (
    <section className="space-y-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-300">Learner Oversight</p>
        <h2 className="text-2xl font-bold text-white">Trainees</h2>
        <p className="text-slate-400">Track learner progress and identify who needs support.</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10 bg-slate-900/55 shadow-sm">
        <table className="w-full min-w-[680px] text-left">
          <thead>
            <tr className="border-b border-white/10 bg-white/5 text-xs uppercase tracking-wider text-slate-400">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Progress</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {trainees.map((trainee) => (
              <tr key={trainee.email} className="border-b border-white/5 text-sm">
                <td className="px-4 py-3 font-semibold text-slate-900">{trainee.name}</td>
                <td className="px-4 py-3 text-slate-600">{trainee.email}</td>
                <td className="px-4 py-3 text-slate-700">{trainee.progress}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{trainee.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
