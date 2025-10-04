import { prisma } from "@/lib/prisma";
import { createUser, deleteUser } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });
  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-4">Utilisateurs</h1>

      <section className="rounded-2xl border border-black/10 dark:border-white/15 bg-white/70 dark:bg-white/5 backdrop-blur-xl p-4 mb-6">
        <h2 className="text-lg font-bold mb-3">Créer un utilisateur</h2>
        <form action={createUser} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input name="name" placeholder="Nom" className="px-3 py-2 rounded-lg bg-white/80 dark:bg-white/10 border border-black/10 dark:border-white/10" />
          <input name="email" placeholder="Email" className="px-3 py-2 rounded-lg bg-white/80 dark:bg-white/10 border border-black/10 dark:border-white/10" />
          <input name="gender" placeholder="Genre (F/M/Autre)" className="px-3 py-2 rounded-lg bg-white/80 dark:bg-white/10 border border-black/10 dark:border-white/10" />
          <input name="avatarUrl" placeholder="Avatar URL (optionnel)" className="px-3 py-2 rounded-lg bg-white/80 dark:bg-white/10 border border-black/10 dark:border-white/10" />
          <div className="sm:col-span-2">
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
                <th className="py-2 pr-3">Nom</th>
                <th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3">Genre</th>
                <th className="py-2 pr-3">Créé le</th>
                <th className="py-2 pr-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10 dark:divide-white/10">
              {users.map(u => (
                <tr key={u.id}>
                  <td className="py-2 pr-3">{u.id}</td>
                  <td className="py-2 pr-3">{u.name}</td>
                  <td className="py-2 pr-3">{u.email}</td>
                  <td className="py-2 pr-3">{u.gender || '—'}</td>
                  <td className="py-2 pr-3">{new Date(u.createdAt).toLocaleString('fr-FR')}</td>
                  <td className="py-2 pr-3">
                    <form action={deleteUser}>
                      <input type="hidden" name="id" value={u.id} />
                      <button className="px-3 py-1 rounded-lg bg-red-600 text-white">Supprimer</button>
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
