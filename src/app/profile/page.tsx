"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import ProfileSkeleton from "@/components/skeletons/ProfileSkeleton";

function euros(cents: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}

export default function ProfilePage() {
  const { isAuthenticated, user, logout, setUser, loading } = useAuth();
  const [walletCents, setWalletCents] = useState<number>(0);
  const search = useSearchParams();
  const router = useRouter();
  const nameInitials = useMemo(() => (user?.name ? user.name.split(" ").map((s) => s[0]).join("")?.slice(0, 2).toUpperCase() : "U"), [user?.name]);
  const [showSettings, setShowSettings] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [txs, setTxs] = useState<Array<{ id: string; ts: string; eventSlug: string; groupName: string; memberEmail: string; amountCents: number; currency: string; method?: string }>>([]);

  // Show success toast when ?created=1 or ?logged=1 is present
  useEffect(() => {
    const msg = search.get("created") === "1"
      ? "Votre compte a été créé avec succès"
      : search.get("logged") === "1"
      ? "Connexion réussie"
      : null;
    if (!msg) return;
    setToast(msg);
    const t = setTimeout(() => setToast(null), 4000);
    // Clean the URL (remove query) after showing
    const clean = setTimeout(() => router.replace("/profile"), 100);
    return () => {
      clearTimeout(t);
      clearTimeout(clean);
    };
  }, [search, router]);

  const onSelectFile = (file?: File | null) => {
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setUser({ ...user, avatarUrl: base64 });
    };
    reader.readAsDataURL(file);
  };

  const onDrop: React.DragEventHandler<HTMLLabelElement> = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    onSelectFile(file);
  };

  const onDragOver: React.DragEventHandler<HTMLLabelElement> = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const onDragLeave: React.DragEventHandler<HTMLLabelElement> = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  // Keep wallet in sync across pages/tabs
  useEffect(() => {
    if (!isAuthenticated || !user?.email) return;
    const key = `wallet:balance:${(user.email || '').toLowerCase()}`;
    const tkey = `wallet:tx:${(user.email || '').toLowerCase()}`;
    const read = () => {
      try {
        const raw = window.localStorage.getItem(key);
        const parsed = raw ? (JSON.parse(raw) as { amountCents: number }) : null;
        setWalletCents(parsed?.amountCents ?? 0);
        const traw = window.localStorage.getItem(tkey);
        const tparsed = traw ? (JSON.parse(traw) as any[]) : [];
        setTxs(Array.isArray(tparsed) ? tparsed.slice(0, 3) : []);
      } catch {
        setWalletCents(0);
        setTxs([]);
      }
    };
    const backfillLocal = () => {
      try {
        const lowerEmail = (user.email || '').toLowerCase();
        // 1) collect owned groups from localStorage
        const ownedBySlug = new Map<string, Set<string>>();
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i) || '';
          if (!k.startsWith('createdGroups:')) continue;
          // createdGroups:<slug>[:<ownerEmail>]
          const parts = k.split(':');
          if (parts.length < 2) continue;
          const slug = parts[1];
          try {
            const arr = JSON.parse(window.localStorage.getItem(k) || '[]') as any[];
            const mine = arr.filter((g) => {
              const emailMatch = g?.ownerEmail && String(g.ownerEmail).toLowerCase() === lowerEmail;
              const nameMatch = user?.name ? g?.name === `Groupe de ${user.name}` : false;
              return emailMatch || nameMatch;
            });
            if (mine.length) {
              const set = ownedBySlug.get(slug) || new Set<string>();
              mine.forEach((g) => set.add(g?.name));
              ownedBySlug.set(slug, set);
            }
          } catch {}
        }
        // 2) scan joinRequests for those slugs and groups
        const txsAll: Array<{ id: string; ts: string; eventSlug: string; groupName: string; memberEmail: string; amountCents: number; currency: string; method?: string }> = [];
        for (const [slug, groups] of ownedBySlug.entries()) {
          for (let i = 0; i < window.localStorage.length; i++) {
            const k = window.localStorage.key(i) || '';
            if (!k.startsWith(`joinRequests:${slug}:`)) continue;
            try {
              const arr = JSON.parse(window.localStorage.getItem(k) || '[]') as any[];
              for (const r of arr) {
                const groupName = typeof r === 'string' ? r : r?.group;
                if (!groupName || !groups.has(groupName)) continue;
                const scannedAt = typeof r === 'string' ? null : r?.scannedAt;
                const payoutReleased = typeof r === 'string' ? null : r?.payoutReleased;
                if (!scannedAt || payoutReleased !== true) continue;
                const amount = typeof r === 'string' ? 0 : (typeof r.amount === 'number' ? Math.round(r.amount * 100) : 0);
                const currency = typeof r === 'string' ? 'EUR' : (r.currency || 'EUR');
                const memberEmail = k.split(':')[2] || '';
                txsAll.push({ id: `${slug}-${memberEmail}-${groupName}-${scannedAt}`, ts: scannedAt, eventSlug: slug, groupName, memberEmail, amountCents: amount, currency, method: typeof r === 'string' ? undefined : r.method });
              }
            } catch {}
          }
        }
        txsAll.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
        if (txsAll.length) {
          window.localStorage.setItem(tkey, JSON.stringify(txsAll));
          setTxs(txsAll.slice(0, 3));
        }
      } catch {}
    };
    const backfillFromServer = async () => {
      try {
        const lowerEmail = (user.email || '').toLowerCase();
        const res = await fetch(`/api/groups?ownerEmail=${encodeURIComponent(lowerEmail)}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('groups');
        const groups = (await res.json()) as Array<{ eventSlug: string; name: string }>;
        const bySlug = new Map<string, Set<string>>();
        for (const g of groups) {
          const set = bySlug.get(g.eventSlug) || new Set<string>();
          set.add(g.name);
          bySlug.set(g.eventSlug, set);
        }
        const txsAll: Array<{ id: string; ts: string; eventSlug: string; groupName: string; memberEmail: string; amountCents: number; currency: string; method?: string }> = [];
        for (const [slug, names] of bySlug.entries()) {
          try {
            const rr = await fetch(`/api/requests?eventSlug=${encodeURIComponent(slug)}`, { cache: 'no-store' });
            if (!rr.ok) continue;
            const list = await rr.json() as Array<{ id: number; groupName: string; memberEmail: string; amountCents: number | null; currency: string | null; method: string | null; scannedAt: string | null; payoutReleased: boolean | null }>
            for (const r of list) {
              if (!names.has(r.groupName)) continue;
              if (!r.scannedAt || r.payoutReleased !== true) continue;
              txsAll.push({ id: String(r.id), ts: r.scannedAt, eventSlug: slug, groupName: r.groupName, memberEmail: r.memberEmail, amountCents: r.amountCents || 0, currency: r.currency || 'EUR', method: r.method || undefined });
            }
          } catch {}
        }
        txsAll.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
        if (txsAll.length) {
          window.localStorage.setItem(tkey, JSON.stringify(txsAll));
          setTxs(txsAll.slice(0, 3));
          return true;
        }
      } catch {}
      return false;
    };
    read();
    // If balance > 0 but no transactions, attempt to reconstruct from server then local
    setTimeout(async () => {
      try {
        const hasTx = txs && txs.length > 0;
        if (!hasTx && walletCents > 0) {
          const ok = await backfillFromServer();
          if (!ok) backfillLocal();
        }
      } catch {}
    }, 0);
    const onWallet = (e: Event) => {
      const detail = (e as CustomEvent).detail as { amountCents?: number } | undefined;
      if (detail && typeof detail.amountCents === 'number') setWalletCents(detail.amountCents);
      try {
        const traw = window.localStorage.getItem(tkey);
        const tparsed = traw ? (JSON.parse(traw) as any[]) : [];
        setTxs(Array.isArray(tparsed) ? tparsed.slice(0, 3) : []);
      } catch {}
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === key || e.key === tkey) read();
    };
    const onVis = () => { if (document.visibilityState === 'visible') read(); };
    window.addEventListener('wallet:updated', onWallet as EventListener);
    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('wallet:updated', onWallet as EventListener);
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [isAuthenticated, user?.email]);

  if (loading) return <ProfileSkeleton />;

  if (!isAuthenticated) {
    return (
      <main className="max-w-md mx-auto px-4 py-16">
        <div className="rounded-2xl border border-white/15 bg-white/5 backdrop-blur-xl p-6 shadow-[0_12px_40px_rgba(0,0,0,0.14)]">
          <h1 className="text-xl font-extrabold text-white mb-2">Profil</h1>
          <p className="text-slate-600 vous connecter pour accéder à votre profil.</p>
          <Link href="/login" className="mt-4 inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold bg-slate-900 text-white shadow hover:opacity-90 transition">Se connecter</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      {/* Sync wallet from localStorage */}
      {(() => {
        try {
          const key = `wallet:balance:${(user?.email || '').toLowerCase()}`;
          const raw = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
          const parsed = raw ? (JSON.parse(raw) as { amountCents: number; currency?: string }) : null;
          const cents = parsed?.amountCents ?? 0;
          if (walletCents !== cents) setWalletCents(cents);
        } catch {}
        return null;
      })()}
      {/* Success toast */}
  <AnimatePresence>
    {toast && (
          <motion.div
            initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -6, filter: "blur(3px)" }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-[90]"
          >
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/15 text-emerald-900 backdrop-blur px-4 py-2 shadow">
      {toast}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Profile header card centered */}
      <section className="mb-6">
        <div className="mx-auto max-w-md rounded-2xl border border-white/15 bg-white/5 backdrop-blur-xl p-6 shadow-[0_12px_40px_rgba(0,0,0,0.14)] text-center">
          <div className="mx-auto w-20 h-20 rounded-full ring-2 ring-white/80 overflow-hidden flex items-center justify-center bg-gradient-to-br from-slate-300 to-slate-500">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-xl font-bold text-slate-800
            )}
          </div>
          <h1 className="mt-4 text-2xl font-extrabold text-white leading-tight">{user?.name ?? "Utilisateur"}</h1>
          <p className="text-slate-600 text-sm">Gère tes groupes et tes gains</p>
        </div>
      </section>

      {/* Balance card with available and pending */}
      <section className="mb-6">
        <div className="mx-auto max-w-md rounded-2xl border border-white/15 bg-white/5 backdrop-blur-xl p-6 shadow-[0_12px_40px_rgba(0,0,0,0.14)]">
          <div className="flex items-end justify-between">
            <div>
              <div className="uppercase text-xs tracking-[0.18em] text-slate-600 disponible</div>
              <div className="text-2xl font-extrabold text-white">{euros(walletCents)}</div>
            </div>
            <div className="text-right">
              <div className="uppercase text-xs tracking-[0.18em] text-slate-600 attente</div>
              <div className="text-xl font-bold text-slate-900/80 ?? 0)}</div>
            </div>
          </div>
          <p className="mt-3 text-sm text-slate-600 solde en attente sera libéré après validation lors du scan en soirée lorsque les membres se rencontrent en vrai.</p>
        </div>
      </section>

      {/* Dernières transactions */}
      <section className="mb-6">
        <div className="mx-auto max-w-md rounded-2xl border border-white/15 bg-white/5 backdrop-blur-xl p-4 shadow-[0_12px_40px_rgba(0,0,0,0.14)]">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-extrabold text-white">Dernières transactions</h2>
            <Link href="/profile/transactions" className="text-xs font-semibold underline text-slate-700 plus</Link>
          </div>
          {txs.length === 0 ? (
            <p className="text-sm text-slate-600 transaction pour l’instant.</p>
          ) : (
            <ul className="divide-y divide-black/10
              {txs.map((t) => (
                <li key={t.id} className="py-2 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-slate-900 text-white grid place-items-center text-[11px] font-bold">€</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white truncate">
                      + {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: t.currency || 'EUR' }).format((t.amountCents || 0) / 100)}
                    </div>
                    <div className="text-[12px] text-slate-600 truncate">
                      {t.groupName} • {t.memberEmail}
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-500
                    {new Date(t.ts).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Boutons ordonnés verticalement */}
      <section className="mt-4 max-w-md mx-auto space-y-3">
        <button className="w-full rounded-xl px-4 py-3 text-sm font-semibold bg-slate-900 text-white shadow hover:opacity-90">
          Retirer mes gains
        </button>
        <button onClick={() => setShowSettings(true)} className="w-full rounded-xl px-4 py-3 text-sm font-semibold bg-white/80 text-slate-900 border border-white/15 hover:opacity-90">
          Paramètres
        </button>
      </section>

      {/* Se déconnecter tout en bas */}
      <section className="mt-10 max-w-md mx-auto">
        <button onClick={logout} className="w-full rounded-xl px-4 py-3 text-sm font-semibold bg-red-600 text-white shadow hover:opacity-90">
          Se déconnecter
        </button>
      </section>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowSettings(false)} />
          <div className="relative w-full max-w-[640px] rounded-2xl border border-white/15 bg-[#0b0b0b]/90 backdrop-blur-xl shadow-2xl max-h-[85dvh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <h3 className="text-lg font-extrabold text-white">Paramètres</h3>
              <button aria-label="Fermer" onClick={() => setShowSettings(false)} className="rounded-lg px-2 py-1 text-slate-600 hover:text-slate-900
            </div>
            <div className="p-5 overflow-y-auto">
              <label className="block">
                <span className="text-sm text-slate-700 d’utilisateur</span>
                <input
                  type="text"
                  value={user?.name ?? ""}
                  disabled
                  className="mt-1 w-full rounded-xl border border-white/15 bg-slate-100 text-slate-500 px-3 py-2 outline-none cursor-not-allowed"
                />
                <span className="mt-1 block text-xs text-slate-500">Non modifiable</span>
              </label>
              <label className="block">
                <span className="text-sm text-slate-700
                <input
                  type="email"
                  value={user?.email ?? ""}
                  disabled
                  className="mt-1 w-full rounded-xl border border-white/15 bg-slate-100 text-slate-500 px-3 py-2 outline-none cursor-not-allowed"
                />
                <span className="mt-1 block text-xs text-slate-500">Non modifiable</span>
              </label>
              <label className="block mt-4">
                <span className="text-sm text-slate-700 de profil</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => onSelectFile(e.target.files?.[0] ?? null)}
                />
                <label
                  onDrop={onDrop}
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                  className={`mt-1 w-full min-h-[140px] rounded-2xl border-2 border-dashed px-4 py-6 text-center transition cursor-pointer flex flex-col items-center justify-center gap-2 ${
                    dragActive
                      ? "border-slate-900 bg-slate-900/5
                      : "border-white/20 bg-white/5"
                  }`}
                >
                  {user?.avatarUrl ? (
                    <img src={user.avatarUrl} alt="Aperçu" className="w-24 h-24 rounded-full object-cover ring-2 ring-white/80 />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-slate-200 to-slate-400 ring-2 ring-white/70 />
                  )}
                  <div className="text-sm text-slate-700 font-semibold">Dépose une image ici</div>
                  <div className="text-xs text-slate-500 clique pour choisir un fichier (PNG, JPG)</div>
                </label>
              </label>
            </div>
            <div className="px-5 py-4 border-t border-white/10 flex justify-end gap-3">
              <button onClick={() => setShowSettings(false)} className="rounded-xl px-4 py-2 text-sm font-semibold bg-slate-200 text-slate-900 hover:opacity-90">Fermer</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
