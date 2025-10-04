"use client";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useRealtime } from "@/lib/useRealtime";

type Notice = {
  id: string;
  title: string;
  message?: string;
  href?: string;
  icon?: React.ReactNode;
  variant?: "info" | "success" | "warning" | "error";
  ttlMs?: number; // auto-dismiss
};

type Ctx = {
  show: (n: Omit<Notice, "id">) => string;
  dismiss: (id: string) => void;
};

const NotificationsContext = createContext<Ctx | null>(null);

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used within <InAppNotifications />");
  return ctx;
}

export default function InAppNotifications() {
  const [items, setItems] = useState<Notice[]>([]);
  const timersRef = useRef<Record<string, number>>({});
  const audioReadyRef = useRef<boolean>(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated } = useAuth();

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((n) => n.id !== id));
    const t = timersRef.current[id];
    if (t) {
      clearTimeout(t);
      delete timersRef.current[id];
    }
  }, []);

  const show = useCallback((n: Omit<Notice, "id">) => {
    const id = Math.random().toString(36).slice(2);
    const ttl = n.ttlMs ?? 6000;
    setItems((prev) => [{ id, ...n }, ...prev].slice(0, 4)); // keep max 4
    timersRef.current[id] = window.setTimeout(() => dismiss(id), ttl);
    // jouer un petit ping si autorisé
    try {
      if (localStorage.getItem("notif:sound") === "off") return id;
      // Besoin d’une interaction utilisateur préalable pour déverrouiller WebAudio sur certains navigateurs
      if (!audioReadyRef.current) return id;
      const ctx = audioCtxRef.current || new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = ctx;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      // petit glissando ‘king’: 880Hz -> 1320Hz sur 120ms
      const now = ctx.currentTime;
      o.frequency.setValueAtTime(880, now);
      o.frequency.exponentialRampToValueAtTime(1320, now + 0.12);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
      o.connect(g).connect(ctx.destination);
      o.start(now);
      o.stop(now + 0.22);
    } catch {}
    return id;
  }, [dismiss]);

  const ctx = useMemo<Ctx>(() => ({ show, dismiss }), [show, dismiss]);

  // Débloque l’audio au premier clic/touch
  useEffect(() => {
    const unlock = () => {
      try {
        if (audioReadyRef.current) return;
        const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!Ctor) return;
        const ctx = new Ctor();
        // créer un court buffer silencieux pour initialiser
        const buffer = ctx.createBuffer(1, 1, 22050);
        const src = ctx.createBufferSource();
        src.buffer = buffer; src.connect(ctx.destination); src.start(0);
        audioCtxRef.current = ctx;
        audioReadyRef.current = true;
        window.removeEventListener("pointerdown", unlock);
        window.removeEventListener("keydown", unlock);
        window.removeEventListener("touchstart", unlock);
      } catch {}
    };
    window.addEventListener("pointerdown", unlock, { once: false });
    window.addEventListener("keydown", unlock, { once: false });
    window.addEventListener("touchstart", unlock, { once: false });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };
  }, []);

  // Brancher aux évènements temps réel (SSE)
  useRealtime({
    onMessageCreated: (p) => {
      if (!isAuthenticated) return;
      const sender = String(p.senderEmail || "").toLowerCase();
      const me = String(user?.email || "").toLowerCase();
      if (sender && me && sender === me) return; // ne pas notifier pour ses propres messages
      
      // Ne pas afficher la notification si on est déjà sur la page de cette conversation
      // ou sur la page des messages en général
      const currentConversationPath = `/messages/${p.conversationId}`;
      console.log('🔍 Notification check:', { 
        pathname, 
        currentConversationPath, 
        conversationId: p.conversationId,
        shouldSkip: pathname === currentConversationPath || pathname === '/messages'
      });
      if (pathname === currentConversationPath || pathname === '/messages') return;
      
      const preview = (p.content || "").slice(0, 90);
      const who = (p as any).senderName || p.senderEmail || "Quelqu'un";
      show({
        title: `Nouveau message de ${who}`,
        message: preview || "Vous avez reçu un nouveau message",
        href: `/messages/${p.conversationId}`,
        variant: "info",
      });
    },
    onJoinRequestCreated: (p) => {
      // Ne sait pas si l'utilisateur est organisateur ici; on affiche générique
      const g = p.groupName || "un groupe";
      show({
        title: "Nouvelle demande",
        message: `Nouvelle demande d'adhésion dans ${g}`,
        href: p.eventSlug ? `/events/${p.eventSlug}/requests` : "/requests",
        variant: "info",
      });
    },
    onJoinRequestUpdated: (p) => {
      if (p.status === "accepted") {
        show({
          title: "Demande acceptée",
          message: p.groupName ? `Vous êtes accepté dans ${p.groupName}` : "Votre demande a été acceptée",
          href: p.eventSlug ? `/scan/${p.eventSlug}` : "/scan",
          variant: "success",
        });
      }
    },
    onGroupCreated: (p) => {
      if (p.name) {
        show({
          title: "Nouveau groupe",
          message: p.name,
          href: p.eventSlug ? `/events/${p.eventSlug}` : "/explore",
          variant: "info",
        });
      }
    },
  });

  return (
    <NotificationsContext.Provider value={ctx}>
      {/* Conteneur des toasts en haut */}
      <div className="pointer-events-none fixed left-1/2 top-3 z-[9999] -translate-x-1/2 space-y-2 px-2 sm:top-4 w-full max-w-xl">
        {items.map((n) => (
          <div
            key={n.id}
            onClick={() => {
              if (n.href) router.push(n.href);
              dismiss(n.id);
            }}
            className={[
              "pointer-events-auto cursor-pointer select-none",
              "mx-auto w-[95%] sm:w-full overflow-hidden rounded-2xl",
              // Verre + dégradé subtil, cohérent avec TopNav/GlassCard
              "backdrop-blur-xl border",
              n.variant === "success"
                ? "bg-gradient-to-br from-emerald-500/25 to-emerald-600/25 border-white/10 text-white"
                : n.variant === "warning"
                ? "bg-gradient-to-br from-amber-500/25 to-amber-600/25 border-white/10 text-white"
                : n.variant === "error"
                ? "bg-gradient-to-br from-rose-500/25 to-rose-600/25 border-white/10 text-white"
                : "bg-white/5 border-white/40 text-white",
              // Ombres douces comme la TopNav
              "shadow-[0_10px_30px_rgba(31,38,135,0.18)]",
              // Animation
              "transition-all duration-300 animate-[slideDown_0.24s_ease-out]",
            ].join(" ")}
            style={{
              // simple enter animation via keyframes defined inline below
              animationFillMode: "both",
            }}
          >
            <div className="flex items-start gap-3 p-3.5 sm:p-4">
              <div className="mt-0.5 shrink-0">
                {n.icon ?? (
                  <span className={[
                    "inline-flex h-7 w-7 items-center justify-center rounded-lg",
                    n.variant === "success"
                      ? "bg-emerald-400/20 text-emerald-200"
                      : n.variant === "warning"
                      ? "bg-amber-400/20 text-amber-200"
                      : n.variant === "error"
                      ? "bg-rose-400/20 text-rose-200"
                      : "bg-white/10 text-slate-900/70
                  ].join(" ")}>
                    •
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold leading-5">
                  {n.title}
                </div>
                {n.message && (
                  <div className="mt-0.5 text-xs leading-5 text-black/70 line-clamp-2">
                    {n.message}
                  </div>
                )}
              </div>
              <button
                aria-label="Fermer"
                onClick={(e) => { e.stopPropagation(); dismiss(n.id); }}
                className="rounded-md p-1.5 text-black/60 hover:text-black/80 hover:bg-black/5 transition"
              >
                ×
              </button>
            </div>
            {/* barre de progression */}
            <div className="h-0.5 w-full bg-black/10
              <div className={[
                "h-full animate-[bar_6s_linear]",
                n.variant === "success"
                  ? "bg-emerald-300"
                  : n.variant === "warning"
                  ? "bg-amber-300"
                  : n.variant === "error"
                  ? "bg-rose-300"
                  : "bg-slate-300
              ].join(" ")} />
            </div>
          </div>
        ))}
      </div>

      {/* keyframes CSS inline */}
      <style jsx global>{`
        @keyframes slideDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes bar { from { width: 100%; } to { width: 0%; } }
      `}</style>
    </NotificationsContext.Provider>
  );
}
