import { trainees } from '../../data/mockData';

export function AdminTraineesPage() {
  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Trainees</h2>
        <p className="text-slate-600">Track learner progress and identify who needs support.</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[680px] text-left">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Progress</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {trainees.map((trainee) => (
              <tr key={trainee.email} className="border-b border-slate-100 text-sm">
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
