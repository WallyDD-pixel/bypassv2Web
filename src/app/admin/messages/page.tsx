import { prisma } from "@/lib/prisma";
import { createMessage, deleteMessage } from "./actions";
import ConfirmButton from "@/components/admin/ConfirmButton";

export const dynamic = "force-dynamic";

export default async function AdminMessagesPage({ searchParams }: { searchParams?: { conversationId?: string } }) {
  const conversationId = Number(searchParams?.conversationId || '');
  const where = conversationId && !Number.isNaN(conversationId) ? { conversationId } : {};
  const messages = await prisma.message.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200 });

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-4">Messages {conversationId ? `(conv ${conversationId})` : ''}</h1>

      <section className="rounded-2xl border border-black/10 dark:border-white/15 bg-white/70 dark:bg-white/5 backdrop-blur-xl p-4 mb-6">
        <h2 className="text-lg font-bold mb-3">Créer un message</h2>
        <form action={createMessage} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input name="conversationId" defaultValue={conversationId || ''} placeholder="conversationId" className="px-3 py-2 rounded-lg bg-white/80 dark:bg-white/10 border" />
          <input name="senderEmail" placeholder="senderEmail" className="px-3 py-2 rounded-lg bg-white/80 dark:bg-white/10 border" />
          <input name="content" placeholder="content" className="px-3 py-2 rounded-lg bg-white/80 dark:bg-white/10 border" />
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
                <th className="py-2 pr-3">Conv</th>
                <th className="py-2 pr-3">Expéditeur</th>
                <th className="py-2 pr-3">Contenu</th>
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10 dark:divide-white/10">
              {messages.map(m => (
                <tr key={m.id}>
                  <td className="py-2 pr-3">{m.id}</td>
                  <td className="py-2 pr-3">{m.conversationId}</td>
                  <td className="py-2 pr-3">{m.senderEmail}</td>
                  <td className="py-2 pr-3">{m.content}</td>
                  <td className="py-2 pr-3">{new Date(m.createdAt).toLocaleString('fr-FR')}</td>
                  <td className="py-2 pr-3">
                    <form action={deleteMessage}>
                      <input type="hidden" name="id" value={m.id} />
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
