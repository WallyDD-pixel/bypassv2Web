"use client";
import React, { useEffect, useMemo, useState } from "react";
import { notFound, useParams, useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { Dialog } from '@headlessui/react'; // Assuming you're using headlessui for dialog
import Link from "next/link";
import { getEventBySlug } from "@/data/events";
import type { Group } from "@/data/events";
import { useAuth } from "@/lib/auth";

export default function JoinGroupPage() {
  const { slug } = useParams<{ slug: string }>();
  const event = getEventBySlug(slug || "");
  const searchParams = useSearchParams();
  const status = (searchParams?.get("status") as string) || "";
  const router = useRouter();
  const { isAuthenticated, user, loading } = useAuth();

  // Ajout des hooks et états nécessaires
  const [mode, setMode] = useState<'list' | 'wizard'>("list");
  const [activeGroup, setActiveGroup] = useState<Group | null>(null);
  const [wizardStep, setWizardStep] = useState(0);
  const [selectedAmount, setSelectedAmount] = useState(0);
  const [acceptCGU, setAcceptCGU] = useState(false);
  const [showGratuitInfo, setShowGratuitInfo] = useState(false);

  // Groupes dynamiques de l'événement (fetch API)
  const [allGroups, setAllGroups] = useState<Group[]>([]);
  const [fetchingGroups, setFetchingGroups] = useState(true);

  useEffect(() => {
    if (!slug) return;
    setFetchingGroups(true);
    fetch(`/api/groups?slug=${encodeURIComponent(slug)}`)
      .then(res => res.json())
      .then(data => setAllGroups(data || []))
      .catch(() => setAllGroups([]))
      .finally(() => setFetchingGroups(false));
  }, [slug]);
  // Email utilisateur en minuscule
  const userEmailLower = user?.email ? user.email.toLowerCase() : undefined;
  // Récupère les demandes déjà faites depuis l'API (join requests de l'utilisateur connecté pour cet event)
  // On attend aussi le statut de la demande
  type JoinRequest = { groupName: string; eventSlug: string; status?: string };
  const [requested, setRequested] = useState<JoinRequest[]>([]);

  useEffect(() => {
    if (!userEmailLower || !slug) return;
    // Appel API pour récupérer les demandes de l'utilisateur pour cet event
    const load = async () => {
      const key = `joinRequests:${slug}:${userEmailLower}`;
      try {
        const res = await fetch(`/api/requests?memberEmail=${encodeURIComponent(userEmailLower)}&eventSlug=${encodeURIComponent(String(slug))}`, { cache: "no-store" });
        if (res.ok) {
          const apiData = await res.json();
          const listFromApi: JoinRequest[] = Array.isArray(apiData)
            ? apiData.map((r: any) => ({ groupName: r.groupName, eventSlug: r.eventSlug, status: r.status }))
            : [];
          setRequested(listFromApi);
          return; // Succès API: ne pas mélanger avec localStorage
        }
      } catch {
        // ignore, on tentera localStorage ci-dessous
      }
      // Fallback localStorage uniquement si l'API échoue
      try {
        const raw = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
        if (raw) {
          const arr = JSON.parse(raw) as Array<string | { group: string; amount?: number; currency?: string; status?: string; createdAt?: string; method?: string }>;
          const localList: JoinRequest[] = arr.map((x) =>
            typeof x === 'string'
              ? { groupName: x, eventSlug: String(slug), status: 'pending' }
              : { groupName: x.group, eventSlug: String(slug), status: (x.status as string) || 'pending' }
          );
          setRequested(localList);
        } else {
          setRequested([]);
        }
      } catch {
        setRequested([]);
      }
    };
    load();
  }, [userEmailLower, slug]);
  // Détection du genre (à adapter selon la logique réelle)
  const isMale = user?.gender === 'male';

  if (!event) return notFound();
  if (fetchingGroups) {
    return (
      <main className="relative min-h-dvh">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
        <div className="relative z-10 min-h-dvh grid place-items-center px-4">
          <div className="w-16 h-16 rounded-full border-4 border-white/30 border-t-white/90 animate-spin" aria-label="Chargement" />
        </div>
      </main>
    );
  }
  return (
    <>
      {/* Dialog explicatif pour "Gratuit" */}
      <Dialog open={showGratuitInfo} onClose={() => setShowGratuitInfo(false)} className="fixed z-50 inset-0 flex items-center justify-center">
        <div className="fixed inset-0 bg-black/40" aria-hidden="true" onClick={() => setShowGratuitInfo(false)} />
        <div className="relative bg-white rounded-2xl p-6 max-w-sm w-full mx-auto shadow-xl z-10">
          <Dialog.Title className="text-lg font-bold mb-2 text-slate-900 c'est gratuit pour les filles ?</Dialog.Title>
          <Dialog.Description className="text-slate-700 mb-4">
            <ul className="list-disc pl-5 space-y-1">
              <li>Les femmes ne paient jamais pour rejoindre un groupe.</li>
              <li>Cela vise à favoriser la mixité et l’équilibre dans les groupes.</li>
              <li>Le paiement des hommes sert uniquement à entrer avec le groupe, aucun droit n’est acquis sur quiconque.</li>
            </ul>
          </Dialog.Description>
          <button onClick={() => setShowGratuitInfo(false)} className="mt-2 px-4 py-2 rounded-xl bg-slate-900 text-white font-semibold">Fermer</button>
        </div>
      </Dialog>
      <main className="max-w-6xl mx-auto px-6 py-14">
        {status === "success" && (
          <div className="mb-4 rounded-md border border-green-700/50 bg-green-900/20 text-green-200 px-3 py-2">
            Paiement confirmé ✔ — votre demande a bien été envoyée au groupe.
          </div>
        )}
        {status === "failed" && (
          <div className="mb-4 rounded-md border border-red-700/50 bg-red-900/20 text-red-200 px-3 py-2">
            Paiement refusé ✖ — aucune somme n’a été débitée. Vous pouvez réessayer.
          </div>
        )}
        <div className="mb-10 flex items-center gap-3">
          <h1 className="hidden md:block text-3xl font-extrabold text-slate-900 tracking-tight">Rejoindre un groupe</h1>
        </div>

        <div className="grid md:grid-cols-[1fr_370px] gap-12 items-start min-h-[60vh]">
          <div className="w-full">
            {mode === "list" && (
              allGroups.length === 0 ? (
                <div className="text-center text-slate-500 py-12">
                  <div className="text-2xl mb-2">😶‍🌫️</div>
                  <div>Aucun groupe n'est encore disponible pour cet évènement.<br/>Créez le premier groupe ou revenez plus tard !</div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                  {allGroups.map((g, idx) => {
                    // Vérifie si l'utilisateur a déjà fait une demande ACTIVE pour ce groupe
                    // On considère "active" si status est 'pending' ou 'accepted'
                    const alreadyRequested = requested.some(r => r.groupName === g.name && r.eventSlug === slug && (r.status === 'pending' || r.status === 'accepted'));
                    return (
                      <div
                        key={g.name || idx}
                        className="group w-full rounded-2xl border border-white/15 bg-white/90 shadow hover:shadow-xl transition overflow-hidden flex flex-col items-center p-6 relative"
                      >
                        <div className="w-16 h-16 rounded-full overflow-hidden bg-slate-300 mb-3 ring-2 ring-primary-500">
                          {g.avatarUrl ? (
                            <img src={g.avatarUrl} alt={g.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="w-full h-full flex items-center justify-center text-2xl text-slate-400">👥</span>
                          )}
                        </div>
                        <div className="font-bold text-slate-900 mb-1 truncate w-full text-center text-lg">{g.name}</div>
                        <div className="flex flex-wrap gap-2 justify-center text-xs text-slate-700 mb-2">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-pink-100 text-pink-700 width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="#db2777" strokeWidth="1.5"/><path d="M7 21c.8-2.7 3.2-4.5 5-4.5S16.2 18.3 17 21" stroke="#db2777" strokeWidth="1.5" strokeLinecap="round"/></svg> {g.femaleCount}</span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="#2563eb" strokeWidth="1.5"/><path d="M15 21v-3a3 3 0 1 0-6 0v-3" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round"/></svg> {g.maleCount}</span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 membres</span>
                        </div>
                        {/* Prix mis en avant */}
                        <div className="flex items-center justify-center gap-2 mt-2 mb-1">
                          <span className="inline-block rounded-full bg-emerald-500/90 text-white px-3 py-1 text-sm font-bold shadow">{typeof g.pricePerMale === 'number' ? `${g.pricePerMale} € / homme` : 'Prix non précisé'}</span>
                        </div>
                        {/* Heure d'arrivée mise en avant */}
                        {g.arrivalTime && (
                          <div className="flex items-center justify-center gap-1 text-xs text-slate-700 mb-2">
                            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                            <span className="font-medium">Arrivée :</span> <span className="ml-1 font-semibold">{g.arrivalTime}</span>
                          </div>
                        )}
                        {/* Bouton rejoindre ou badge */}
                        <button
                          onClick={() => {
                            if (alreadyRequested) return;
                            setActiveGroup(g);
                            setWizardStep(0);
                            setMode('wizard');
                            // Initialise le prix sélectionné au prix de base du groupe
                            if (typeof g.pricePerMale === 'number') {
                              setSelectedAmount(g.pricePerMale);
                            } else {
                              setSelectedAmount(0);
                            }
                          }}
                          className={`mt-4 w-full rounded-xl font-semibold py-2 px-4 text-base shadow transition
                            ${alreadyRequested
                              ? 'bg-amber-100 text-amber-700 cursor-not-allowed opacity-70'
                              : 'bg-slate-900 text-white hover:bg-slate-800
                          disabled={alreadyRequested}
                        >
                          {alreadyRequested ? 'Déjà demandé' : 'Rejoindre ce groupe'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )
            )}

            {mode === "wizard" && activeGroup && (
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-12 w-12 rounded-full overflow-hidden bg-slate-300">
                    <img src={activeGroup.avatarUrl} alt={activeGroup.name} className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <div className="font-semibold text-white">{activeGroup.name}</div>
                    <div className="mt-1 flex flex-wrap gap-2 text-[12px]">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/15 bg-white/80 text-slate-800
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="#db2777" strokeWidth="1.8"/><path d="M7 21c.8-2.7 3.2-4.5 5-4.5S16.2 18.3 17 21" stroke="#db2777" strokeWidth="1.8" strokeLinecap="round"/></svg>
                        {activeGroup.femaleCount}
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/15 bg-white/80 text-slate-800
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="#2563eb" strokeWidth="1.8"/><path d="M15 21v-3a3 3 0 1 0-6 0v-3" stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round"/></svg>
                        {activeGroup.maleCount}
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/15 bg-white/80 text-slate-800
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M16 11a4 4 0 1 0-8 0m12 7v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                        {activeGroup.members} membres
                      </span>
                    </div>
                  </div>
                </div>

                {wizardStep === 0 && (() => {
                  const avatars = (activeGroup.memberAvatars && activeGroup.memberAvatars.length > 0)
                    ? activeGroup.memberAvatars
                    : (activeGroup.avatarUrl ? [activeGroup.avatarUrl] : []);
                  return (
                    <div>
                      <div className="text-sm font-semibold text-white mb-1">Voici les personnes déjà dans le groupe</div>
                      {(() => {
                        const maleSpots0 = Math.max(0, (activeGroup.femaleCount || 0) - (activeGroup.maleCount || 0));
                        return (
                          <div className="mb-2">
                            {maleSpots0 > 0 ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] bg-white text-slate-900 border border-emerald-500/30">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                  <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="#059669" strokeWidth="1.8"/>
                                  <path d="M15 21v-3a3 3 0 1 0-6 0v-3" stroke="#059669" strokeWidth="1.8" strokeLinecap="round"/>
                                </svg>
                                Places hommes restantes: {maleSpots0}
                              </span>
                              ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] bg-white text-slate-900 border border-slate-500/30">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                  <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="currentColor" strokeWidth="1.8"/>
                                  <path d="M15 21v-3a3 3 0 1 0-6 0v-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                                </svg>
                                Complet pour hommes
                              </span>
                            )}
                          </div>
                        );
                      })()}
                      {/* Suppression du bloc dupliqué et de maleSpots0 */}
                    {/* Légende genres */}
                    <div className="mb-3 flex items-center gap-2 text-[12px]">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-white/15 bg-white/70 text-slate-700
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="#db2777" strokeWidth="1.8"/><path d="M7 21c.8-2.7 3.2-4.5 5-4.5S16.2 18.3 17 21" stroke="#db2777" strokeWidth="1.8" strokeLinecap="round"/></svg>
                        Filles
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-white/15 bg-white/70 text-slate-700
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="#2563eb" strokeWidth="1.8"/><path d="M15 21v-3a3 3 0 1 0-6 0v-3" stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round"/></svg>
                        Garçons
                      </span>
                    </div>
                    {avatars.length === 0 ? (
                      <div className="text-sm text-slate-600 non disponible.</div>
                    ) : (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
                        {avatars.slice(0, 15).map((src, idx) => {
                          const femaleCount = activeGroup.femaleCount || 0;
                          const isFemale = idx < femaleCount;
                          return (
                            <div key={idx} className="relative aspect-square rounded-2xl border border-white/15 bg-white/60 overflow-hidden shadow-sm">
                              {/* Badge genre */}
                              <span className={`absolute top-1 left-1 inline-flex items-center justify-center h-6 w-6 rounded-full border border-white/70 shadow ${isFemale ? 'bg-pink-600/80' : 'bg-blue-600/80'}`} title={isFemale ? 'Fille' : 'Garçon'}>
                                {isFemale ? (
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="#fff" strokeWidth="1.8"/><path d="M7 21c.8-2.7 3.2-4.5 5-4.5S16.2 18.3 17 21" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/></svg>
                                ) : (
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="#fff" strokeWidth="1.8"/><path d="M15 21v-3a3 3 0 1 0-6 0v-3" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/></svg>
                                )}
                              </span>
                              <img src={src} alt={`Membre (flouté) — ${isFemale ? 'Fille' : 'Garçon'}`} className="w-full h-full object-cover blur-[3px] scale-110" />
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <div className="mt-5 flex items-center justify-between gap-3">
                      <button onClick={() => { setMode('list'); setActiveGroup(null); }} className="rounded-xl px-4 py-2 text-sm font-semibold bg-slate-200 text-slate-900
                      <button
                        onClick={() => {
                          if (!activeGroup) return;
                          if (isMale) {
                            setWizardStep(1);
                          } else {
                            const key = encodeURIComponent(activeGroup.name);
                            router.push(`/events/${slug}/join/free?g=${key}`);
                          }
                        }}
                        className="rounded-xl px-4 py-2 text-sm font-semibold bg-slate-900 text-white
                      >
                        Suivant
                      </button>
                    </div>
                  </div>
                );
              })()}

              {wizardStep === 1 && (() => {
                const basePrice = typeof activeGroup.pricePerMale === 'number' ? activeGroup.pricePerMale : 0;
                const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);
                // Empêche de descendre en dessous du prix de base
                const canMinus1 = selectedAmount > basePrice;
                const canMinus5 = selectedAmount > basePrice;
                return (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 mb-2">Prix par homme</h3>
                    <p className="text-sm text-slate-600 mb-4">
                      Prix fixé par le groupe: <strong>{fmt(basePrice)}</strong>. Vous pouvez payer ce prix ou ajouter un extra.
                    </p>
                    <div className="grid place-items-center">
                      <div className="text-4xl font-bold tracking-wide tabular-nums text-slate-900 mb-3">{fmt(selectedAmount)}</div>
                      <div className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/60 backdrop-blur px-2 py-2">
                        <button
                          type="button"
                          aria-label="-5 €"
                          onClick={() => setSelectedAmount((v) => Math.max(basePrice, Math.round((v - 5) * 100) / 100))}
                          className={`h-10 px-3 grid place-items-center rounded-xl border border-white/15 text-sm font-semibold select-none active:scale-95 transition
                            ${!canMinus5 ? 'bg-slate-200 text-black cursor-not-allowed' : 'bg-white/80 text-slate-900
                          disabled={!canMinus5}
                        >
                          −5
                        </button>
                        <button
                          type="button"
                          aria-label="-1 €"
                          onClick={() => setSelectedAmount((v) => Math.max(basePrice, Math.round((v - 1) * 100) / 100))}
                          className={`h-10 px-3 grid place-items-center rounded-xl border border-white/15 text-sm font-semibold select-none active:scale-95 transition
                            ${!canMinus1 ? 'bg-slate-200 text-black cursor-not-allowed' : 'bg-white/80 text-slate-900
                          disabled={!canMinus1}
                        >
                          −1
                        </button>
                        <button type="button" aria-label="+1 €" onClick={() => setSelectedAmount((v) => Math.round((v + 1) * 100) / 100)} className="h-10 px-3 grid place-items-center rounded-xl bg-slate-900 text-white border border-white/15 text-sm font-semibold select-none active:scale-95 transition">+1</button>
                        <button type="button" aria-label="+5 €" onClick={() => setSelectedAmount((v) => Math.round((v + 5) * 100) / 100)} className="h-10 px-3 grid place-items-center rounded-xl bg-slate-900 text-white border border-white/15 text-sm font-semibold select-none active:scale-95 transition">+5</button>
                      </div>
                      <div className="mt-3 flex flex-wrap justify-center gap-2">
                        {[basePrice, basePrice + 5, basePrice + 10].map((n, idx) => (
                          <button key={idx} type="button" onClick={() => setSelectedAmount(Math.max(basePrice, n))} className={`px-3 py-1.5 rounded-full text-sm border transition ${selectedAmount === Math.max(basePrice, n) ? 'bg-slate-900 text-white border-white/15 : 'bg-white/60 text-slate-700 border-white/15 hover:bg-white'}`}>{fmt(Math.max(basePrice, n))}</button>
                        ))}
                      </div>
                    </div>

                    <div className="mt-5 flex items-center justify-between gap-3">
                      <button onClick={() => setWizardStep(0)} className="rounded-xl px-4 py-2 text-sm font-semibold bg-slate-200 text-slate-900
                      <button onClick={() => setWizardStep(2)} className="rounded-xl px-4 py-2 text-sm font-semibold bg-slate-900 text-white
                    </div>
                  </div>
                );
              })()}

              {wizardStep === 2 && (() => {
                const maleSpots = Math.max(0, (activeGroup.femaleCount || 0) - (activeGroup.maleCount || 0));
                const priceTxt = typeof activeGroup.pricePerMale === "number" ? `${activeGroup.pricePerMale} € par homme` : "Prix par homme non précisé";
                const arrivalTxt = activeGroup.arrivalTime ? `Arrivée prévue: ${activeGroup.arrivalTime}` : "Heure d’arrivée: à définir";
                return (
                  <div>
                    <div className="rounded-xl border border-white/15 bg-white/70 p-4 space-y-2 text-sm text-slate-700
                      <div className="flex items-center gap-2"><span className="font-semibold text-slate-900 profil:</span> Homme (détecté automatiquement)</div>
                      <div className="flex items-center gap-2"><span className="font-semibold text-slate-900 {priceTxt} • {arrivalTxt}</div>
                      <div className="flex items-center gap-2"><span className="font-semibold text-slate-900 que vous paierez:</span> {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Math.max(0, selectedAmount))}</div>
                      <div className="flex items-center gap-2"><span className="font-semibold text-slate-900 hommes restantes:</span> {maleSpots}</div>
                    </div>

                    {/* Aperçu des membres (flouté pour confidentialité) */}
                    <div className="mt-4">
                      <div className="text-sm font-semibold text-slate-900 mb-2">Voici les personnes déjà dans le groupe</div>
                      {(() => {
                        const avatars = (activeGroup.memberAvatars && activeGroup.memberAvatars.length > 0)
                          ? activeGroup.memberAvatars
                          : (activeGroup.avatarUrl ? [activeGroup.avatarUrl] : []);
                        if (avatars.length === 0) {
                          return (
                            <div className="text-sm text-slate-600 non disponible.</div>
                          );
                        }
                        return (
                          <div className="grid grid-cols-5 sm:grid-cols-6 gap-3">
                            {avatars.slice(0, 12).map((src, idx) => (
                              <div key={idx} className="aspect-square rounded-xl border border-white/15 bg-white/60 overflow-hidden shadow-sm">
                                {/* flou léger */}
                                <img src={src} alt="Membre (flouté)" className="w-full h-full object-cover blur-[3px] scale-105" />
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                      <div className="mt-2 text-[12px] text-slate-500 photos sont volontairement floutées pour préserver la confidentialité.</div>
                    </div>

                    {/* Encart explicatif bienveillant */}
                    <div className="mt-4 rounded-xl border border-amber-300/60 bg-amber-50/80 p-4">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 h-7 w-7 rounded-full bg-amber-500 text-white grid place-items-center shadow">
                          {/* heart-handshake icon */}
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                            <path d="M12 13.5 9.5 11a3 3 0 0 1 4.24-4.24l.26.26.26-.26A3 3 0 0 1 18 11l-2.5 2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M8 12 4.5 8.5A3.536 3.536 0 0 1 9.5 4.5L12 7m4 5-3 3a2 2 0 0 1-2.83 0L9 13.83" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </span>
                        <div className="text-sm text-amber-900
                          <div className="font-semibold mb-0.5">Important — comment ça marche</div>
                          <ul className="list-disc pl-4 space-y-1">
                            <li>Votre paiement sert uniquement à vous faire entrer avec ce groupe.</li>
                            <li>Il ne vous donne aucun droit ni priorité sur les femmes du groupe.</li>
                            <li>Respect, consentement et bienveillance sont indispensables à tout moment.</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4">
                      <label className="group flex items-start gap-3 cursor-pointer select-none">
                        <input type="checkbox" className="sr-only" checked={acceptCGU} onChange={(e) => setAcceptCGU(e.target.checked)} />
                        <span className={`mt-0.5 h-5 w-5 rounded-md border grid place-items-center transition shadow-sm ${acceptCGU ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white/70 border-white/15 text-transparent'}`}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={`transition ${acceptCGU ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}>
                            <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </span>
                        <span className="text-sm text-slate-700 les conditions et je confirme ma demande pour ce groupe.</span>
                      </label>
                    </div>

                    <div className="mt-5 flex items-center justify-between gap-3">
                      <button onClick={() => setWizardStep(1)} className="rounded-xl px-4 py-2 text-sm font-semibold bg-slate-200 text-slate-900
                      <button
                        disabled={!acceptCGU || maleSpots === 0}
                        onClick={() => {
                          if (!activeGroup) return;
                          const key = encodeURIComponent(activeGroup.name);
                          const amt = Math.max(0, selectedAmount);
                          router.push(`/events/${slug}/join/pay?g=${key}&amt=${amt}`);
                        }}
                        className="rounded-xl px-4 py-2 text-sm font-semibold bg-slate-900 text-white disabled:opacity-50"
                      >
                        Continuer vers le paiement
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
          <aside className="hidden md:block rounded-2xl border border-white/15 bg-white/80 backdrop-blur-xl p-8 shadow-[0_12px_40px_rgba(0,0,0,0.14)] sticky top-24 min-w-[370px] max-w-sm ml-8">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 h-8 w-8 rounded-full bg-slate-900 text-white grid place-items-center shadow">
                {/* megaphone icon */}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M3 11v2m0-2a9 9 0 0 1 9-9v0v20a9 9 0 0 1-9-9Zm9-9c3.771 0 7.108 2.087 8.822 5.196A2 2 0 0 1 21 9v6a2 2 0 0 1-.178.804C19.108 18.913 15.771 21 12 21V2Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
              <div>
                <div className="text-sm font-extrabold text-slate-900
                <ul className="mt-2 space-y-2 text-[13px] text-slate-700 list-disc pl-4">
                  <li>Respect, consentement et bienveillance à tout moment.</li>
                  <li>Les femmes ne paient pas pour rejoindre un groupe.</li>
                  <li>Le paiement des hommes sert uniquement à entrer avec le groupe; aucun droit n’est acquis sur quiconque.</li>
                  <li>Un groupe peut refuser une demande si les conditions ne sont pas respectées.</li>
                </ul>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}
