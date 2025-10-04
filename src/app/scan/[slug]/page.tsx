"use client";
export const dynamic = "force-dynamic";
import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getEventBySlug, eventSlug } from "@/data/events";
import { useAuth } from "@/lib/auth";
import jsQR from "jsqr";

type DecodedPayload = {
  slug: string;
  email: string;
  group: string;
  amount?: number;
  currency?: string;
  method?: string;
};

type LocalRequest =
  | string
  | {
      group: string;
      status?: string;
      amount?: number;
      currency?: string;
      method?: string;
      scannedAt?: string;
      payoutReleased?: boolean;
    };

export default function EventScannerPage() {
  const params = useParams<{ slug: string }>();
  const slug = String(params?.slug || "");
  const { isAuthenticated, user, loading } = useAuth();
  const [error, setError] = React.useState<string>("");
  const [info, setInfo] = React.useState<string>("");
  const [scanned, setScanned] = React.useState<DecodedPayload | null>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = React.useState<MediaStream | null>(null);
  const [ownerGroups, setOwnerGroups] = React.useState<string[]>([]);
  const [groupsReady, setGroupsReady] = React.useState(false);
  const [pendingRaw, setPendingRaw] = React.useState<string | null>(null);
  const [rescanNonce, setRescanNonce] = React.useState(0);
  const [isFrozen, setIsFrozen] = React.useState(false);
  const [overlay, setOverlay] = React.useState<{ visible: boolean; status: 'verifying' | 'success'; name?: string; amountTxt?: string; balanceTxt?: string }>({ visible: false, status: 'verifying' });
  const scanLockRef = React.useRef<boolean>(false);
  const norm = (s: string) => s ? s.normalize('NFKC').trim().toLowerCase() : "";
  const ownerGroupsNorm = React.useMemo(() => ownerGroups.map(norm), [ownerGroups]);
  const prettyName = (email: string) => {
    const local = String(email || '').split('@')[0];
    const cleaned = local.replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!cleaned) return email;
    return cleaned
      .split(' ')
      .map(w => w ? w.charAt(0).toUpperCase() + w.slice(1) : '')
      .join(' ');
  };

  const event = React.useMemo(() => getEventBySlug(slug), [slug]);

  // Set mobile header title on deep page (used by MobileHeader)
  React.useEffect(() => {
    const title = event ? `Scanner — ${event.title}` : "Scanner";
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("mobile-header:title", { detail: title }));
    }
    return () => {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("mobile-header:title", { detail: "" }));
      }
    };
  }, [event?.title]);

  React.useEffect(() => {
    if (!slug) return;
    if (!event) {
      setError("Événement introuvable");
    }
  }, [slug, event]);

  React.useEffect(() => {
    if (!isAuthenticated || loading) return;
    // Charger les groupes de l'événement et vérifier ceux qui appartiennent à l'utilisateur (organisatrice)
    const lower = (user?.email || "").toLowerCase();
    let abort = false;
    setGroupsReady(false);
    (async () => {
      try {
        const res = await fetch(`/api/groups?slug=${encodeURIComponent(slug)}`, { cache: "no-store" });
        const data = res.ok ? await res.json() : [];
        const fromApi = Array.isArray(data)
          ? data.filter((g: any) => String(g?.ownerEmail || "").toLowerCase() === lower).map((g: any) => String(g?.name || "")).filter(Boolean)
          : [];
        // Lire aussi localStorage et fusionner
        const local: string[] = [];
        try {
          if (typeof window !== "undefined") {
            const scoped = window.localStorage.getItem(`createdGroups:${slug}:${lower}`);
            const legacy = window.localStorage.getItem(`createdGroups:${slug}`);
            if (scoped) {
              try { (JSON.parse(scoped) as any[]).forEach((g) => local.push(String(g?.name || ""))); } catch {}
            }
            if (legacy) {
              try {
                (JSON.parse(legacy) as any[]).forEach((g) => {
                  const emailMatch = String(g?.ownerEmail || "").toLowerCase() === lower;
                  const nameMatch = user?.name ? g?.name === `Groupe de ${user.name}` : false;
                  if (emailMatch || nameMatch) local.push(String(g?.name || ""));
                });
              } catch {}
            }
          }
        } catch {}
        const setAll = new Set<string>([...fromApi, ...local].filter(Boolean));
        if (!abort) setOwnerGroups(Array.from(setAll));
      } catch {
        // Fallback localStorage
        try {
          const list: string[] = [];
          if (typeof window !== "undefined") {
            const scoped = window.localStorage.getItem(`createdGroups:${slug}:${lower}`);
            const legacy = window.localStorage.getItem(`createdGroups:${slug}`);
            if (scoped) {
              try { (JSON.parse(scoped) as any[]).forEach((g) => list.push(String(g?.name || ""))); } catch {}
            }
            if (legacy) {
              try {
                (JSON.parse(legacy) as any[]).forEach((g) => {
                  const emailMatch = String(g?.ownerEmail || "").toLowerCase() === lower;
                  const nameMatch = user?.name ? g?.name === `Groupe de ${user.name}` : false;
                  if (emailMatch || nameMatch) list.push(String(g?.name || ""));
                });
              } catch {}
            }
          }
          if (!abort) setOwnerGroups(list.filter(Boolean));
        } catch { if (!abort) setOwnerGroups([]); }
      } finally { if (!abort) setGroupsReady(true); }
    })();
    return () => { abort = true; };
  }, [isAuthenticated, loading, slug, user?.email, user?.name]);

  // Si un QR est lu avant que les groupes ne soient prêts, re-tenter dès que possible
  React.useEffect(() => {
    if (groupsReady && pendingRaw && !scanned) {
      const raw = pendingRaw;
      setPendingRaw(null);
      handleRaw(raw);
    }
  }, [groupsReady, pendingRaw, scanned]);

  React.useEffect(() => {
    let raf = 0;
  let detector: unknown = null;
    let mounted = true;

    const getUserMediaCompat = (constraints: MediaStreamConstraints) => {
      return new Promise<MediaStream>((resolve, reject) => {
        try {
          type LegacyGetUserMedia = (
            constraints: MediaStreamConstraints,
            success: (stream: MediaStream) => void,
            error: (err: unknown) => void
          ) => void;
          const nav = navigator as Navigator & {
            webkitGetUserMedia?: LegacyGetUserMedia;
            mozGetUserMedia?: LegacyGetUserMedia;
            msGetUserMedia?: LegacyGetUserMedia;
            getUserMedia?: LegacyGetUserMedia;
          };
          if (nav.mediaDevices?.getUserMedia) {
            nav.mediaDevices.getUserMedia(constraints).then(resolve, reject);
            return;
          }
          const legacy = nav.getUserMedia || nav.webkitGetUserMedia || nav.mozGetUserMedia || nav.msGetUserMedia;
          if (legacy) {
            legacy.call(nav, constraints, resolve, reject);
            return;
          }
          reject(new Error("getUserMedia non supporté"));
        } catch (e) {
          reject(e);
        }
      });
    };

    const friendlyCameraError = (err: unknown) => {
      const e = err as { name?: string; message?: string } | undefined;
      const name = String(e?.name || "");
      const msg = String(e?.message || "");
      if (/NotAllowedError|denied|Permission/i.test(name + msg)) {
        return "Permission caméra refusée. Autorisez l’accès dans la barre d’adresse du navigateur.";
      }
      if (/NotFoundError|DevicesNotFound/i.test(name + msg)) {
        return "Aucune caméra trouvée sur cet appareil.";
      }
      if (/NotReadableError|Could not start video source|TrackStartError/i.test(name + msg)) {
        return "Impossible de démarrer la caméra (utilisée par une autre application ?). Fermez les autres apps vidéo et réessayez.";
      }
      if (/OverconstrainedError|Constraint/i.test(name + msg)) {
        return "La caméra demandée n’est pas disponible. Nouvel essai avec une autre caméra…";
      }
      if (/NotSupportedError|secure context|https/i.test(name + msg)) {
        return "Accès caméra bloqué: utilisez HTTPS (ou localhost en dev).";
      }
      return "Erreur caméra. Vérifiez les permissions et réessayez.";
    };

    const start = async () => {
      try {
        if (typeof window === "undefined" || typeof navigator === "undefined") {
          throw new Error("Environnement client requis");
        }
        if (!window.isSecureContext) {
          setError("Accès caméra bloqué: utilisez HTTPS (ou localhost en dev).");
          return;
        }
        let s: MediaStream | null = null;
        try {
          s = await getUserMediaCompat({ video: { facingMode: { ideal: "environment" } } });
        } catch (e1) {
          // Fallback 1: generic video true
          setInfo("Nouvelle tentative avec une autre configuration de caméra…");
          try {
            s = await getUserMediaCompat({ video: true });
          } catch (e2) {
            // Fallback 2: user-facing (pour desktop sans back camera)
            s = await getUserMediaCompat({ video: { facingMode: { ideal: "user" } } });
          }
        }
        if (!mounted) return;
        setStream(s);
        if (videoRef.current) {
          videoRef.current.srcObject = s as any;
          await videoRef.current.play();
        }

        // Prefer BarcodeDetector if available
        const BD: any = (window as any).BarcodeDetector;
        if (BD) {
          detector = new BD({ formats: ["qr_code"] });
          const tick = async () => {
            if (!mounted) return;
            try {
              const codes = await (detector as any).detect(videoRef.current!);
              for (const c of codes) {
                if (c.rawValue) {
                  handleRaw(c.rawValue);
                  return;
                }
              }
            } catch {}
            raf = requestAnimationFrame(tick);
          };
          raf = requestAnimationFrame(tick);
        } else {
          // Fallback Safari/iOS: utiliser jsQR via canvas
          const video = videoRef.current!;
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            setError("Impossible d'initialiser le décodage QR.");
            return;
          }
          const tick = () => {
            if (!mounted) return;
            try {
              const vw = video.videoWidth;
              const vh = video.videoHeight;
              if (vw && vh) {
                canvas.width = vw;
                canvas.height = vh;
                ctx.drawImage(video, 0, 0, vw, vh);
                const img = ctx.getImageData(0, 0, vw, vh);
                const code = jsQR(img.data, vw, vh, { inversionAttempts: "attemptBoth" });
                if (code && code.data) {
                  handleRaw(code.data);
                  return;
                }
              }
            } catch {}
            raf = requestAnimationFrame(tick);
          };
          raf = requestAnimationFrame(tick);
        }
  } catch (err: unknown) {
        setError(friendlyCameraError(err));
      }
    };

    start();
    return () => {
      mounted = false;
      if (raf) cancelAnimationFrame(raf);
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rescanNonce]);

  const handleRaw = (raw: string) => {
    if (scanned || scanLockRef.current) return; // éviter doublons
    scanLockRef.current = true; // lock immédiat
    try {
      const data = JSON.parse(raw) as DecodedPayload;
      if (!data.slug || !data.email || !data.group) throw new Error("payload incomplet");
      if (data.slug !== slug) {
        setError("QR d'un autre événement");
        scanLockRef.current = false;
        return;
      }
      if (!groupsReady) {
        setInfo("Chargement de vos groupes…");
        setPendingRaw(raw);
        scanLockRef.current = false;
        return;
      }
      // Réinitialiser les messages pour ce scan
      setError("");
      setInfo("");
      // Figer la caméra et afficher la superposition de vérification
      try { videoRef.current?.pause(); } catch {}
      setIsFrozen(true);
      setOverlay({ visible: true, status: 'verifying' });
      // Vérifier droits: seule l'organisatrice du groupe peut scanner
  const canScan = ownerGroupsNorm.includes(norm(data.group));
      if (!canScan) {
        setOverlay({ visible: false, status: 'verifying' });
        setIsFrozen(false);
        scanLockRef.current = false;
        try { videoRef.current?.play(); } catch {}
        setError(`Seule l’organisatrice du groupe « ${data.group} » peut scanner ce QR.`);
        return;
      }
      setScanned(data);
      markAsScanned(data).then((res) => {
        // Incrémenter le solde local de l'organisatrice
        let balanceTxt: string | undefined = undefined;
        const tx: { id: string; ts: string; eventSlug: string; groupName: string; memberEmail: string; amountCents: number; currency: string; method?: string } | null = (() => {
          try {
            const currency = (data.currency || 'EUR').toUpperCase();
            const amountCents = typeof data.amount === 'number' ? Math.round(data.amount * 100) : 0;
            return {
              id: `${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
              ts: new Date().toISOString(),
              eventSlug: slug,
              groupName: data.group,
              memberEmail: data.email.toLowerCase(),
              amountCents,
              currency,
              method: data.method,
            };
          } catch {
            return null;
          }
        })();
        try {
          const key = `wallet:balance:${(user?.email || '').toLowerCase()}`;
          const raw = localStorage.getItem(key);
          const currency = (data.currency || 'EUR').toUpperCase();
          const current = raw ? JSON.parse(raw) as { amountCents: number; currency: string } : { amountCents: 0, currency };
          const incCents = typeof data.amount === 'number' ? Math.round(data.amount * 100) : 0;
          const next = { amountCents: current.amountCents + incCents, currency };
          localStorage.setItem(key, JSON.stringify(next));
          try { window.dispatchEvent(new CustomEvent('wallet:updated', { detail: next })); } catch {}
          balanceTxt = new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(next.amountCents / 100);
          // Append transaction log
          if (tx) {
            const tkey = `wallet:tx:${(user?.email || '').toLowerCase()}`;
            const traw = localStorage.getItem(tkey);
            const tlist = traw ? (JSON.parse(traw) as any[]) : [];
            tlist.unshift(tx);
            // garder taille raisonnable (p.ex 200 max)
            if (tlist.length > 200) tlist.length = 200;
            localStorage.setItem(tkey, JSON.stringify(tlist));
          }
        } catch {}
        // Afficher succès avec détails + solde
        setOverlay({ visible: true, status: 'success', name: res.display, amountTxt: res.amountTxt, balanceTxt });
      }).catch(() => {
        // En cas d'erreur silencieuse, revenir à l'état normal
        setOverlay({ visible: false, status: 'verifying' });
        setIsFrozen(false);
        scanLockRef.current = false;
        try { videoRef.current?.play(); } catch {}
      });
    } catch (e) {
      setError("QR invalide");
      scanLockRef.current = false;
    }
  };

  const markAsScanned = async (p: DecodedPayload): Promise<{ ok: boolean; display: string; amountTxt?: string; serverUpdated: boolean }> => {
    try {
      // 1) Essayer de mettre à jour côté serveur
      let serverUpdated = false;
      try {
        const res = await fetch(`/api/requests?eventSlug=${encodeURIComponent(slug)}&memberEmail=${encodeURIComponent(p.email.toLowerCase())}&groupName=${encodeURIComponent(p.group)}`, { cache: "no-store" });
        if (res.ok) {
          const list = await res.json();
          if (Array.isArray(list) && list.length > 0 && list[0]?.id) {
            const r2 = await fetch(`/api/requests/${list[0].id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ scannedAt: new Date().toISOString(), payoutReleased: true }),
            });
            serverUpdated = r2.ok;
          }
        }
      } catch {}

      const key = `joinRequests:${slug}:${p.email.toLowerCase()}`;
      const raw = window.localStorage.getItem(key);
  const arr = raw ? (JSON.parse(raw) as LocalRequest[]) : [];
      let updated = false;
      for (const r of arr) {
        const groupName = typeof r === "string" ? r : r.group;
        if (norm(groupName) === norm(p.group)) {
          if (typeof r === "string") {
            // upgrade legacy string to object
    const obj: Exclude<LocalRequest, string> = { group: groupName, status: "accepted", amount: p.amount, currency: p.currency, method: p.method };
            obj.scannedAt = new Date().toISOString();
            obj.payoutReleased = true;
            const idx = arr.indexOf(r);
            arr[idx] = obj;
          } else {
            r.scannedAt = new Date().toISOString();
            r.payoutReleased = true;
            // if pending/accepted, leave as is; we just mark scanned
          }
          updated = true;
          break;
        }
      }
      // Préparer l'affichage
      let display = p.email;
      try {
        const rawUser = localStorage.getItem(`auth:users:${p.email.toLowerCase()}`);
        if (rawUser) {
          const up = JSON.parse(rawUser) as { name?: string };
          if (up?.name) display = up.name;
          else display = prettyName(p.email);
        } else {
          display = prettyName(p.email);
        }
      } catch { display = prettyName(p.email); }
      const amountTxt = typeof p.amount === 'number' ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: p.currency || 'EUR' }).format(p.amount) : undefined;

      if (updated) {
        window.localStorage.setItem(key, JSON.stringify(arr));
      }
      // Notifier en temps réel via SSE broadcast (best effort)
      // Pour éviter les doublons (broadcast + patch), on diffuse seulement si le serveur n'a pas émis d'update
      if (!serverUpdated) {
        try {
          await fetch('/api/realtime/scan-broadcast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              eventSlug: slug,
              groupName: p.group,
              memberEmail: p.email,
              amountCents: typeof p.amount === 'number' ? Math.round(p.amount * 100) : null,
              currency: p.currency || 'EUR',
              method: p.method || 'card',
              scannedAt: new Date().toISOString(),
              payoutReleased: true,
            }),
          });
        } catch {}
      }
      return { ok: updated || serverUpdated, display, amountTxt, serverUpdated };
    } catch (e) {
      setError("Erreur lors de la mise à jour");
  return { ok: false, display: prettyName(p.email), amountTxt: undefined, serverUpdated: false };
    }
  };

  const resumeScan = () => {
    setOverlay({ visible: false, status: 'verifying', name: undefined, amountTxt: undefined });
    setIsFrozen(false);
    setScanned(null);
    setError("");
    setInfo("");
    setRescanNonce((n) => n + 1);
  scanLockRef.current = false;
  };

  if (loading) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-10">
        <div className="rounded-2xl border border-black/10 dark:border-white/15 bg-white/70 dark:bg-white/5 backdrop-blur-xl p-6 animate-pulse h-40" />
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="max-w-md mx-auto px-4 py-16">
        <div className="rounded-2xl border border-black/10 dark:border-white/15 bg-white/70 dark:bg-white/5 backdrop-blur-xl p-6">
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white mb-2">Scanner un QR code</h1>
          <p className="text-slate-600 dark:text-slate-300 mb-4">Connectez-vous pour scanner les membres à l’entrée.</p>
          <Link href="/login" className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold bg-slate-900 text-white dark:bg-white dark:text-slate-900">Se connecter</Link>
        </div>
      </main>
    );
  }

  if (!event) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-10">
        <div className="rounded-2xl border border-black/10 dark:border-white/15 bg-white/70 dark:bg-white/5 backdrop-blur-xl p-6">
          <p className="text-red-600">Événement introuvable.</p>
          <Link href="/scan" className="mt-3 hidden md:inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold bg-slate-900 text-white dark:bg-white dark:text-slate-900">Retour</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-6">
      {/* Desktop title only; on mobile the MobileHeader shows back + title */}
      <h1 className="hidden md:block text-2xl font-extrabold text-slate-900 dark:text-white mb-4">Scanner — {event.title}</h1>

      {error && (
        <div className="mb-3 rounded-xl border border-red-200/50 bg-red-50/60 dark:bg-red-500/10 text-red-700 dark:text-red-300 px-4 py-2 text-sm">{error}</div>
      )}
      {info && (
        <div className="mb-3 rounded-xl border border-emerald-200/50 bg-emerald-50/60 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-4 py-2 text-sm">{info}</div>
      )}

      <div className="relative rounded-2xl overflow-hidden border border-black/10 dark:border-white/15 bg-black/90">
        <video ref={videoRef} className={`w-full aspect-[3/4] object-cover ${isFrozen ? 'grayscale-[15%]' : ''}`} playsInline muted />
        {/* Overlay UI */}
        {overlay.visible && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px] flex items-center justify-center p-4">
            {overlay.status === 'verifying' ? (
              <div className="flex flex-col items-center gap-3 text-white">
                <div className="h-10 w-10 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <div className="text-sm text-white/90">Vérification du QR…</div>
              </div>
            ) : (
              <div className="w-full max-w-sm rounded-2xl bg-white text-slate-900 p-5 shadow-xl">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-emerald-100 text-emerald-700 grid place-items-center">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/></svg>
                  </div>
                  <div className="text-base font-bold">QR scanné avec succès</div>
                </div>
                <div className="mt-3 text-sm">
                  {overlay.name ? (
                    <p>Vous avez scanné <span className="font-semibold">{overlay.name}</span>.</p>
                  ) : (
                    <p>Le membre a été scanné.</p>
                  )}
                  {overlay.amountTxt && (
                    <p className="mt-1">Montant libéré: <span className="font-semibold">{overlay.amountTxt}</span>.</p>
                  )}
                  {overlay.balanceTxt && (
                    <p className="mt-1">Nouveau solde: <span className="font-semibold">{overlay.balanceTxt}</span>.</p>
                  )}
                </div>
                <div className="mt-4 flex justify-end">
                  <button onClick={resumeScan} className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold bg-slate-900 text-white">Reprendre le scan</button>
                </div>
              </div>
            )}
          </div>
        )}
        <div className="px-4 py-3 text-xs text-white/80">Alignez le QR dans le cadre. Un bip visuel confirmera la lecture.</div>
      </div>

      <div className="mt-2 text-[12px] text-slate-600 dark:text-slate-300">
        Conseil: si la caméra ne démarre pas, autorisez son accès dans la barre d’adresse du navigateur et utilisez une URL en HTTPS.
      </div>
    </main>
  );
}
