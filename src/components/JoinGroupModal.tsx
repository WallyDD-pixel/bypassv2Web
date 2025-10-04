"use client";
import React, { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { Group } from "@/data/events";
import { useAuth } from "@/lib/auth";

type Props = {
  slug: string;
  open: boolean;
  onClose: () => void;
  groups: Group[];
};

export default function JoinGroupModal({ slug, open, onClose, groups }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReduced = useReducedMotion();
  const { user } = useAuth();

  // Join requests depuis l'API uniquement
  const userEmailLower = (user?.email || "").toLowerCase();
  type JoinRequest = { group: string; event: string; status?: string };
  const [requested, setRequested] = React.useState<JoinRequest[]>([]);
  // Wizard state
  const [mode, setMode] = React.useState<"list" | "wizard">("list");
  const [activeGroup, setActiveGroup] = React.useState<Group | null>(null);
  const [acceptCGU, setAcceptCGU] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [success, setSuccess] = React.useState(false);

  useEffect(() => {
    if (!open || !userEmailLower || !slug) return;
    fetch(`/api/join-requests?email=${encodeURIComponent(userEmailLower)}&event=${encodeURIComponent(slug)}`)
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        if (Array.isArray(data)) {
          setRequested(data);
        } else {
          setRequested([]);
        }
      })
      .catch(() => setRequested([]));
  }, [open, slug, userEmailLower]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Lock background scroll while modal is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Reset state on close
  useEffect(() => {
    if (!open) {
      setMode("list");
      setActiveGroup(null);
      setAcceptCGU(false);
      setSubmitting(false);
      setSuccess(false);
    }
  }, [open]);

  if (!open) return null;

  return (
  <AnimatePresence>
      {open && (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <motion.div
            className="absolute inset-0 bg-black/50"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.2 } }}
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
          />
          <motion.div
            ref={ref}
      className="relative w-full max-w-[640px] rounded-2xl border border-white/15 bg-[#0b0b0b]/90 backdrop-blur-xl p-6 shadow-2xl max-h-[85dvh] overflow-y-auto"
      initial={prefersReduced ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
      animate={prefersReduced ? { opacity: 1 } : { opacity: 1, scale: 1, transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] } }}
      exit={prefersReduced ? { opacity: 0 } : { opacity: 0, scale: 0.98, transition: { duration: 0.18 } }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-extrabold text-white">{mode === "wizard" ? "Demande d’adhésion" : "Rejoindre un groupe"}</h3>
              <button aria-label="Fermer" onClick={onClose} className="rounded-lg px-2 py-1 text-slate-600 hover:text-slate-900
            </div>
            {mode === "wizard" && activeGroup ? (
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-12 w-12 rounded-full overflow-hidden bg-slate-300">
                    <img src={activeGroup.avatarUrl} alt={activeGroup.name} className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <div className="font-semibold text-white">{activeGroup.name}</div>
                    <div className="mt-1 flex flex-wrap gap-2 text-[12px]">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/15 bg-white/10 text-slate-800
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="#db2777" strokeWidth="1.8"/><path d="M7 21c.8-2.7 3.2-4.5 5-4.5S16.2 18.3 17 21" stroke="#db2777" strokeWidth="1.8" strokeLinecap="round"/></svg>
                        {activeGroup.femaleCount}
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/15 bg-white/10 text-slate-800
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="#2563eb" strokeWidth="1.8"/><path d="M15 21v-3a3 3 0 1 0-6 0v-3" stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round"/></svg>
                        {activeGroup.maleCount}
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/15 bg-white/10 text-slate-800
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M16 11a4 4 0 1 0-8 0m12 7v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                        {activeGroup.members} membres
                      </span>
                    </div>
                  </div>
                </div>
                {(() => {
                  const maleSpots = Math.max(0, (activeGroup.femaleCount || 0) - (activeGroup.maleCount || 0));
                  const priceTxt = typeof activeGroup.pricePerMale === "number" ? `${activeGroup.pricePerMale} € par homme` : "Prix par homme non précisé";
                  const arrivalTxt = activeGroup.arrivalTime ? `Arrivée prévue: ${activeGroup.arrivalTime}` : "Heure d’arrivée: à définir";
                  const isMale = (user?.gender || "").toLowerCase() === "male";
                  const groupKey = activeGroup.name;
                  const alreadyRequested = requested.some(r => r.group === groupKey && r.event === slug && (r.status === 'pending' || r.status === 'accepted' || !r.status));
                  return (
                    <div>
                      <div className="rounded-xl border border-white/15 bg-white/10 p-4 space-y-2 text-sm text-slate-700
                        <div className="flex items-center gap-2"><span className="font-semibold text-white">Votre profil:</span> {isMale ? "Homme" : "Femme"} (détecté automatiquement)</div>
                        <div className="flex items-center gap-2"><span className="font-semibold text-white">Conditions:</span> {priceTxt} • {arrivalTxt}</div>
                        <div className="flex items-center gap-2"><span className="font-semibold text-white">Places hommes restantes:</span> {maleSpots}</div>
                      </div>
                      {!isMale && (
                        <div className="mt-2 text-[13px] text-slate-600 les profils femmes, la demande est simple: vous accompagnez le groupe à l’entrée, sans paiement requis.</div>
                      )}
                      <div className="mt-4">
                        <label className="group flex items-start gap-3 cursor-pointer select-none">
                          <input type="checkbox" className="sr-only" checked={acceptCGU} onChange={(e) => setAcceptCGU(e.target.checked)} />
                          <span className={`mt-0.5 h-5 w-5 rounded-md border grid place-items-center transition shadow-sm ${acceptCGU ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white/10 border-white/15 text-transparent'}`}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={`transition ${acceptCGU ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}>
                              <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </span>
                          <span className="text-sm text-slate-700 les conditions et je confirme ma demande pour ce groupe.</span>
                        </label>
                      </div>
                      <div className="mt-5 flex items-center justify-between gap-3">
                        <button onClick={() => { setMode('list'); setActiveGroup(null); }} className="rounded-xl px-4 py-2 text-sm font-semibold bg-slate-200 text-slate-900
                        <button
                          disabled={submitting || !acceptCGU || (isMale && maleSpots === 0)}
                          onClick={() => {
                            if (submitting) return;
                            if (alreadyRequested) { setMode('list'); setActiveGroup(null); return; }
                            setSubmitting(true);
                            // TODO: appeler l'API pour créer la demande côté serveur
                            // Après création, le useEffect rechargera la liste
                            setTimeout(() => {
                              setSubmitting(false);
                              setSuccess(true);
                              setMode('list');
                              setActiveGroup(null);
                              setAcceptCGU(false);
                            }, 500);
                          }}
                          className="rounded-xl px-4 py-2 text-sm font-semibold bg-slate-900 text-white disabled:opacity-50"
                        >
                          {submitting ? 'Envoi…' : 'Envoyer la demande'}
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <>
                {groups.length === 0 ? (
                  <p className="text-slate-600 groupe pour le moment. Crée le premier !</p>
                ) : (
                  <ul className="divide-y divide-white/10">
                    {groups.map((g, i) => {
                      const ownerEmail = (g as any).ownerEmail as string | undefined;
                      const userEmail = user?.email as string | undefined;
                      const emailMatch = ownerEmail && userEmail && ownerEmail.toLowerCase() === userEmail.toLowerCase();
                      const nameMatch = user?.name ? g.name === `Groupe de ${user.name}` : false;
                      const isMine = Boolean(emailMatch || nameMatch);
                      const groupKey = `${g.name}`;
                      // On considère \"active\" si status est 'pending' ou 'accepted' ou pas de status
                      const alreadyRequested = requested.some(r => r.group === groupKey && r.event === slug && (r.status === 'pending' || r.status === 'accepted' || !r.status));
                      const maleSpots = Math.max(0, (g.femaleCount || 0) - (g.maleCount || 0));
                      const isMale = (user?.gender || '').toLowerCase() === 'male';
                      const onJoinClick = () => {
                        if (isMine || alreadyRequested) return;
                        if (isMale) {
                          setActiveGroup(g);
                          setMode('wizard');
                          setAcceptCGU(false);
                          return;
                        }
                        // Femmes: envoi direct de la demande (simple)
                        // TODO: appeler l'API pour créer la demande côté serveur
                        // Après création, le useEffect rechargera la liste
                      };
                      return (
                        <li key={`${g.name}-${i}`} className="py-3 flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full overflow-hidden bg-slate-300">
                              <img src={g.avatarUrl} alt={g.name} className="w-full h-full object-cover" />
                            </div>
                            <div>
                              <div className="font-semibold text-white">{g.name}</div>
                              <div className="mt-1 flex flex-wrap gap-2 text-[12px]">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/15 bg-white/10 text-slate-800
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="#db2777" strokeWidth="1.8"/><path d="M7 21c.8-2.7 3.2-4.5 5-4.5S16.2 18.3 17 21" stroke="#db2777" strokeWidth="1.8" strokeLinecap="round"/></svg>
                                  {g.femaleCount}
                                </span>
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/15 bg-white/10 text-slate-800
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="#2563eb" strokeWidth="1.8"/><path d="M15 21v-3a3 3 0 1 0-6 0v-3" stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round"/></svg>
                                  {g.maleCount}
                                </span>
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/15 bg-white/10 text-slate-800
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M16 11a4 4 0 1 0-8 0m12 7v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                                  {g.members} membres
                                </span>
                              </div>
                            </div>
                          </div>
                          {isMine ? (
                            <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-700 border border-emerald-500/30">Ce groupe vous appartient</span>
                          ) : alreadyRequested ? (
                            <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-700 border border-amber-500/30">Demande envoyée</span>
                          ) : isMale && maleSpots === 0 ? (
                            <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-slate-500/15 text-slate-700 border border-slate-500/30">Complet pour hommes</span>
                          ) : alreadyRequested ? (
                            <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-700 border border-amber-500/30">Déjà demandé</span>
                          ) : (
                            <button
                              onClick={onJoinClick}
                              className="rounded-xl px-3 py-1.5 text-xs font-semibold shadow bg-slate-900 text-white hover:opacity-90"
                            >
                              Rejoindre ce groupe
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}