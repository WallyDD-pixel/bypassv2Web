export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import Link from "next/link";

function isAdmin(email?: string | null): boolean {
  if (!email) return false;
  const list = (process.env.ADMIN_EMAILS || "").split(/[,;\s]+/).map(s => s.trim().toLowerCase()).filter(Boolean);
  if (list.length === 0) return false;
  return list.includes(String(email).toLowerCase());
}

function prettyEmail(email: string) {
  const local = String(email || '').split('@')[0];
  const cleaned = local.replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned) return email;
  return cleaned.split(' ').map(w => w ? w.charAt(0).toUpperCase() + w.slice(1) : '').join(' ');
}

export default async function AdminDashboard() {
  const ck = await cookies();
  const email = ck.get("auth-email")?.value || "";
  const name = ck.get("auth-name")?.value || "";
  if (!isAdmin(email)) {
    return (
      <main className="max-w-6xl mx-auto px-4 py-10">
        <div className="rounded-2xl border border-black/10 dark:border-white/15 bg-white/70 dark:bg-white/5 backdrop-blur-xl p-6">
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white mb-2">Accès refusé</h1>
          <p className="text-slate-700 dark:text-slate-300">Votre compte n'est pas autorisé. Ajoutez votre email à la variable d'environnement <code>ADMIN_EMAILS</code>.</p>
          <div className="mt-4 text-sm">
            <Link href="/" className="underline">Retour</Link>
          </div>
        </div>
      </main>
    );
  }

  // Récupérer stats en parallèle
  const [
    usersCount,
    groupsCount,
    requestsCount,
    pendingCount,
    acceptedCount,
    refusedCount,
    convCount,
    msgCount,
    pushCount,
    latestUsers,
    latestGroups,
    latestReqs,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.group.count(),
    prisma.joinRequest.count(),
    prisma.joinRequest.count({ where: { status: "pending" } }),
    prisma.joinRequest.count({ where: { status: "accepted" } }),
    prisma.joinRequest.count({ where: { status: "refused" } }),
    prisma.conversation.count(),
    prisma.message.count(),
    (prisma as any).pushSubscription.count?.() ?? 0,
    prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 8, select: { id: true, name: true, email: true, createdAt: true } }),
    prisma.group.findMany({ orderBy: { createdAt: "desc" }, take: 8, select: { id: true, eventSlug: true, name: true, ownerEmail: true, createdAt: true } }),
    prisma.joinRequest.findMany({ orderBy: { createdAt: "desc" }, take: 10, select: { id: true, eventSlug: true, groupName: true, memberEmail: true, status: true, amountCents: true, currency: true, createdAt: true } }),
  ]);

  // Optionnel: regrouper par event
  let byEvent: Array<{ eventSlug: string; groups: number; requests: number }>|null = null;
  try {
    const gGroups = await (prisma as any).group.groupBy({ by: ["eventSlug"], _count: { _all: true } });
    const gReqs = await (prisma as any).joinRequest.groupBy({ by: ["eventSlug"], _count: { _all: true } });
    const map = new Map<string, { groups: number; requests: number }>();
    (gGroups || []).forEach((r: any) => map.set(r.eventSlug, { groups: r._count?._all ?? 0, requests: 0 }));
    (gReqs || []).forEach((r: any) => {
      const cur = map.get(r.eventSlug) || { groups: 0, requests: 0 };
      cur.requests = r._count?._all ?? 0; map.set(r.eventSlug, cur);
    });
    byEvent = Array.from(map.entries()).map(([eventSlug, v]) => ({ eventSlug, ...v })).sort((a,b)=> (b.groups+b.requests)-(a.groups+a.requests));
  } catch {}

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">Admin — Dashboard</h1>
  <p className="text-slate-600 dark:text-slate-300">Bienvenue {name || prettyEmail(email)}</p>
      </div>

      {/* KPIs */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {[
          { label: "Utilisateurs", value: usersCount },
          { label: "Groupes", value: groupsCount },
          { label: "Conversations", value: convCount },
          { label: "Messages", value: msgCount },
          { label: "Demandes", value: requestsCount },
          { label: "En attente", value: pendingCount },
          { label: "Acceptées", value: acceptedCount },
          { label: "Refusées", value: refusedCount },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl border border-black/10 dark:border-white/15 bg-white/70 dark:bg-white/5 backdrop-blur-xl p-4">
            <div className="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-300">{k.label}</div>
            <div className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-white">{k.value}</div>
          </div>
        ))}
      </section>

      {/* Par événement */}
      {byEvent && byEvent.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-3">Par événement</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {byEvent.map((r) => (
              <div key={r.eventSlug} className="rounded-2xl border border-black/10 dark:border-white/15 bg-white/70 dark:bg-white/5 backdrop-blur-xl p-4">
                <div className="text-sm font-semibold text-slate-900 dark:text-white">{r.eventSlug}</div>
                <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">Groupes: {r.groups} — Demandes: {r.requests}</div>
                <div className="mt-2 text-sm">
                  <Link href={`/events/${r.eventSlug}`} className="underline">Ouvrir</Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Derniers utilisateurs */}
        <section className="rounded-2xl border border-black/10 dark:border-white/15 bg-white/70 dark:bg-white/5 backdrop-blur-xl p-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Derniers utilisateurs</h3>
          <div className="divide-y divide-black/10 dark:divide-white/10">
            {latestUsers.map(u => (
              <div key={u.id} className="py-2 text-sm flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-900 dark:text-white">{u.name}</div>
                  <div className="text-slate-600 dark:text-slate-300">{u.email}</div>
                </div>
                <div className="text-xs text-slate-500">{new Date(u.createdAt).toLocaleString("fr-FR")}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Derniers groupes */}
        <section className="rounded-2xl border border-black/10 dark:border-white/15 bg-white/70 dark:bg-white/5 backdrop-blur-xl p-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Derniers groupes</h3>
          <div className="divide-y divide-black/10 dark:divide-white/10">
            {latestGroups.map(g => (
              <div key={g.id} className="py-2 text-sm flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-900 dark:text-white">{g.name}</div>
                  <div className="text-slate-600 dark:text-slate-300">{g.eventSlug} — {g.ownerEmail}</div>
                </div>
                <div className="text-xs text-slate-500">{new Date(g.createdAt).toLocaleString("fr-FR")}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Dernières demandes */}
        <section className="rounded-2xl border border-black/10 dark:border-white/15 bg-white/70 dark:bg-white/5 backdrop-blur-xl p-4 lg:col-span-2">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Dernières demandes</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Événement</th>
                  <th className="py-2 pr-3">Groupe</th>
                  <th className="py-2 pr-3">Membre</th>
                  <th className="py-2 pr-3">Statut</th>
                  <th className="py-2 pr-3">Montant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/10 dark:divide-white/10">
                {latestReqs.map(r => {
                  const amount = typeof r.amountCents === 'number' ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: r.currency || 'EUR' }).format(r.amountCents / 100) : '—';
                  return (
                    <tr key={r.id}>
                      <td className="py-2 pr-3 text-slate-700 dark:text-slate-300">{new Date(r.createdAt).toLocaleString('fr-FR')}</td>
                      <td className="py-2 pr-3">{r.eventSlug}</td>
                      <td className="py-2 pr-3">{r.groupName}</td>
                      <td className="py-2 pr-3">{r.memberEmail}</td>
                      <td className="py-2 pr-3">{r.status}</td>
                      <td className="py-2 pr-3">{amount}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
