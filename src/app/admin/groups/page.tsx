import { prisma } from "@/lib/prisma";
import { createGroup, deleteGroup } from "./actions";
import ConfirmButton from "@/components/admin/ConfirmButton";

export const dynamic = "force-dynamic";

export default async function AdminGroupsPage() {
  const groups = await prisma.group.findMany({ orderBy: { createdAt: 'desc' } });
  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-4">Groupes</h1>

      <section className="rounded-2xl border border-black/10 dark:border-white/15 bg-white/70 dark:bg-white/5 backdrop-blur-xl p-4 mb-6">
        <h2 className="text-lg font-bold mb-3">Créer un groupe</h2>
        <form action={createGroup} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input name="eventSlug" placeholder="eventSlug" className="px-3 py-2 rounded-lg bg-white/80 dark:bg-white/10 border border-black/10 dark:border-white/10" />
          <input name="name" placeholder="Nom du groupe" className="px-3 py-2 rounded-lg bg-white/80 dark:bg-white/10 border border-black/10 dark:border-white/10" />
          <input name="ownerEmail" placeholder="Email propriétaire" className="px-3 py-2 rounded-lg bg-white/80 dark:bg-white/10 border border-black/10 dark:border-white/10" />
          <input name="ownerName" placeholder="Nom propriétaire (opt)" className="px-3 py-2 rounded-lg bg-white/80 dark:bg-white/10 border border-black/10 dark:border-white/10" />
          <input name="pricePerMale" placeholder="Prix homme (opt)" className="px-3 py-2 rounded-lg bg-white/80 dark:bg-white/10 border border-black/10 dark:border-white/10" />
          <div className="sm:col-span-3">
            <button type="submit" className="px-4 py-2 rounded-xl bg-black text-white dark:bg-white dark:text-black font-semibold">Créer</button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-black/10 dark:border-white/15 bg-white/70 dark:bg-white/5 backdrop-blur-xl p-4">
        <h2 className="text-lg font-bold mb-3">Liste</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-slate-600 dark:text-slate-300">
              <tr>
                <th className="py-2 pr-3">ID</th>
                <th className="py-2 pr-3">Événement</th>
                <th className="py-2 pr-3">Nom</th>
                <th className="py-2 pr-3">Owner</th>
                <th className="py-2 pr-3">M/F</th>
                <th className="py-2 pr-3">Membres</th>
                <th className="py-2 pr-3">Prix H</th>
                <th className="py-2 pr-3">Créé le</th>
                <th className="py-2 pr-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10 dark:divide-white/10">
              {groups.map(g => (
                <tr key={g.id}>
                  <td className="py-2 pr-3">{g.id}</td>
                  <td className="py-2 pr-3">{g.eventSlug}</td>
                  <td className="py-2 pr-3">{g.name}</td>
                  <td className="py-2 pr-3">{g.ownerName || '—'} ({g.ownerEmail})</td>
                  <td className="py-2 pr-3">{g.maleCount}/{g.femaleCount}</td>
                  <td className="py-2 pr-3">{g.members}</td>
                  <td className="py-2 pr-3">{g.pricePerMale ?? '—'}</td>
                  <td className="py-2 pr-3">{new Date(g.createdAt).toLocaleString('fr-FR')}</td>
                  <td className="py-2 pr-3">
                    <form action={deleteGroup}>
                      <input type="hidden" name="id" value={g.id} />
                      <ConfirmButton className="px-3 py-1 rounded-lg bg-red-600 text-white">Supprimer</ConfirmButton>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
