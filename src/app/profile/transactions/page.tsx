"use client";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";

function euros(amountCents: number, currency = "EUR") {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format((amountCents || 0) / 100);
}

type Tx = { id: string; ts: string; eventSlug: string; groupName: string; memberEmail: string; amountCents: number; currency: string; method?: string };

export default function TransactionsPage() {
  const { isAuthenticated, user, loading } = useAuth();
  const [txs, setTxs] = useState<Tx[]>([]);

  useEffect(() => {
    if (!isAuthenticated || !user?.email) return;
    try {
      const key = `wallet:tx:${(user.email || '').toLowerCase()}`;
      const raw = window.localStorage.getItem(key);
      const parsed = raw ? (JSON.parse(raw) as Tx[]) : [];
      setTxs(Array.isArray(parsed) ? parsed : []);
    } catch { setTxs([]); }
  }, [isAuthenticated, user?.email]);

  if (!isAuthenticated) {
    return (
      <main className="max-w-md mx-auto px-4 py-16">
        <div className="rounded-2xl border border-white/15 bg-white/5 backdrop-blur-xl p-6">
          <h1 className="text-xl font-extrabold text-white mb-2">Transactions</h1>
          <p className="text-slate-600 vous connecter pour voir l'historique.</p>
          <Link href="/login" className="mt-4 inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold bg-slate-900 text-white connecter</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <div className="mb-4 flex items-center gap-2">
        <Link href="/profile" className="text-sm underline text-slate-700 Retour</Link>
        <h1 className="text-2xl font-extrabold text-white">Historique des transactions</h1>
      </div>
      <section className="rounded-2xl border border-white/15 bg-white/5 backdrop-blur-xl p-4">
        {txs.length === 0 ? (
          <p className="text-slate-600 transaction pour l’instant.</p>
        ) : (
          <ul className="divide-y divide-black/10
            {txs.map((t) => (
              <li key={t.id} className="py-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-slate-900 text-white grid place-items-center text-[11px] font-bold">€</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white truncate">+ {euros(t.amountCents, t.currency)}</div>
                  <div className="text-[12px] text-slate-600 truncate">{t.groupName} • {t.memberEmail}</div>
                </div>
                <div className="text-[11px] text-slate-500 Date(t.ts).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
