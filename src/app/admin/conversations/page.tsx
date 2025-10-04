import { prisma } from "@/lib/prisma";
import { createConversation, deleteConversation } from "./actions";
import Link from "next/link";
import ConfirmButton from "@/components/admin/ConfirmButton";

export const dynamic = "force-dynamic";

export default async function AdminConversationsPage() {
  const items = await prisma.conversation.findMany({ orderBy: { createdAt: 'desc' } });
  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-4">Conversations</h1>

      <section className="rounded-2xl border border-black/10 dark:border-white/15 bg-white/70 dark:bg-white/5 backdrop-blur-xl p-4 mb-6">
        <h2 className="text-lg font-bold mb-3">Créer</h2>
        <form action={createConversation} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input name="eventSlug" placeholder="eventSlug" className="px-3 py-2 rounded-lg bg-white/80 dark:bg-white/10 border" />
          <input name="groupName" placeholder="groupName" className="px-3 py-2 rounded-lg bg-white/80 dark:bg-white/10 border" />
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
                <th className="py-2 pr-3">Groupe</th>
                <th className="py-2 pr-3">Créée le</th>
                <th className="py-2 pr-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10 dark:divide-white/10">
              {items.map(c => (
                <tr key={c.id}>
                  <td className="py-2 pr-3">{c.id}</td>
                  <td className="py-2 pr-3">{c.eventSlug}</td>
                  <td className="py-2 pr-3">{c.groupName}</td>
                  <td className="py-2 pr-3">{new Date(c.createdAt).toLocaleString('fr-FR')}</td>
                  <td className="py-2 pr-3 flex gap-2">
                    <Link href={`/admin/messages?conversationId=${c.id}`} className="px-3 py-1 rounded-lg bg-slate-700 text-white">Voir messages</Link>
                    <form action={deleteConversation}>
                      <input type="hidden" name="id" value={c.id} />
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
