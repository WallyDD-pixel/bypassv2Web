"use client";
export const dynamic = "force-dynamic";
import React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { getEventBySlug } from "@/data/events";

// Minimal QR rendering without extra deps: display a payload string and provide a canvas-QR generator lazily
// If you prefer a lib, we can switch to 'qrcode' later.

export default function GenerateQRPage() {
  const { slug, group } = useParams<{ slug: string; group: string }>();
  const router = useRouter();
  const { isAuthenticated, loading, user } = useAuth();
  const event = getEventBySlug(slug || "");
  const groupName = decodeURIComponent(group || "");
  const [overlay, setOverlay] = React.useState<{ visible: boolean; status: 'verifying' | 'success'; organizer?: string; amountTxt?: string }>({ visible: false, status: 'verifying' });
  const [alreadyScanned, setAlreadyScanned] = React.useState<boolean>(false);
  const overlayTimerRef = React.useRef<number | null>(null);
  const [lastScanKey, setLastScanKey] = React.useState<string | null>(null);
  const debounceRef = React.useRef<number | null>(null);
  const [organizerName, setOrganizerName] = React.useState<string | undefined>(undefined);
  const prettyName = (email: string) => {
    const local = String(email || '').split('@')[0];
    const cleaned = local.replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!cleaned) return email;
    return cleaned.split(' ').map(w => w ? w.charAt(0).toUpperCase() + w.slice(1) : '').join(' ');
  };

  React.useEffect(() => {
    const title = event ? `Mon QR — ${event.title}` : "Mon QR";
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("mobile-header:title", { detail: title }));
    }
    return () => {
      if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("mobile-header:title", { detail: "" }));
    };
  }, [event?.title]);

  if (loading) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-10">
        <div className="rounded-2xl border border-black/10 dark:border-white/15 bg-white/70 dark:bg-white/5 backdrop-blur-xl p-6 animate-pulse h-40" />
      </main>
    );
  }

  if (!isAuthenticated) {
    router.replace("/login");
    return null;
  }

  if (!event) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-10">
        <div className="rounded-2xl border border-black/10 dark:border-white/15 bg-white/70 dark:bg-white/5 backdrop-blur-xl p-6">
          <p className="text-red-600">Événement introuvable.</p>
          <Link href="/scan" className="mt-3 inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold bg-slate-900 text-white dark:bg-white dark:text-slate-900">Retour</Link>
        </div>
      </main>
    );
  }

  // Récupérer la demande pour info (montant, méthode, etc.) depuis localStorage
  const lowerEmail = (user?.email || "").toLowerCase();
  let amount: number | undefined;
  let currency: string | undefined;
  let method: string | undefined;
  try {
    const key = `joinRequests:${slug}:${lowerEmail}`;
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
    const arr = raw ? (JSON.parse(raw) as any[]) : [];
    const r = arr.find((x) => (typeof x === "string" ? x === groupName : x.group === groupName));
    if (r && typeof r !== "string") {
      amount = r.amount;
      currency = r.currency || "EUR";
      method = r.method || undefined;
    }
  } catch {}

  const fmt = (n?: number) => typeof n === "number" ? new Intl.NumberFormat("fr-FR", { style: "currency", currency: (currency as any) || "EUR" }).format(n) : "—";

  // Payload minimal à encoder (événement, groupe, email, montant)
  const payload = {
    slug: slug,
    group: groupName,
    email: lowerEmail,
    amount: typeof amount === "number" ? amount : undefined,
    currency: currency || "EUR",
    method: method || "card",
  };
  const payloadText = JSON.stringify(payload);

  // Génération QR locale (lib qrcode) via import dynamique
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const [qrReady, setQrReady] = React.useState(false);
  const [qrError, setQrError] = React.useState<string | null>(null);
  const [btnLoading, setBtnLoading] = React.useState(false);
  const generate = async () => {
    setBtnLoading(true);
    setQrError(null);
    try {
      const mod: any = await import("qrcode");
      const QR = mod.default || mod;
      const canvas = canvasRef.current;
      if (!canvas) return;
      await QR.toCanvas(canvas, payloadText, { width: 280, errorCorrectionLevel: "M", margin: 2 });
      setQrReady(true);
    } catch (e) {
      setQrError('Impossible de générer le QR');
    } finally { setBtnLoading(false); }
  };

  // Générer automatiquement le QR à l'ouverture de la page pour qu'il soit directement visible
  React.useEffect(() => {
    let t: number | null = null;
    // petite attente pour garantir que le canvas est monté
    t = window.setTimeout(() => {
      if (!qrReady && !btnLoading && canvasRef.current) {
        // best-effort; ignorer les erreurs silencieusement
        generate().catch(() => {});
      }
    }, 0);
    return () => { if (t) window.clearTimeout(t); };
  }, []);

  const d = new Date(event.startAt);
  const fullDate = d.toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });

  // Afficher une séquence overlay: verifying → success
  const showScanOverlay = React.useCallback((scanKey: string, amountText?: string) => {
    if (alreadyScanned) return; // si déjà scanné, ne plus afficher de pop-up
    // déduplication: ne pas rejouer si déjà traité
    if (lastScanKey === scanKey) return;
    // petite fenêtre anti-rafale (100ms)
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    debounceRef.current = window.setTimeout(() => {
      setLastScanKey(scanKey);
      debounceRef.current = null;
    }, 100);
    // reset any previous timer
    if (overlayTimerRef.current) {
      window.clearTimeout(overlayTimerRef.current);
      overlayTimerRef.current = null;
    }
    // étape 1: verifying
    setOverlay({ visible: true, status: 'verifying', organizer: organizerName, amountTxt: undefined });
    // vibration légère si supporté
    try { (navigator as any)?.vibrate?.(80); } catch {}
    // étape 2: success
    overlayTimerRef.current = window.setTimeout(() => {
      setOverlay({ visible: true, status: 'success', organizer: organizerName, amountTxt: amountText });
      // marquer l’état scanné (persistant)
      try {
        const k = `qrScanned:${String(slug)}:${groupName}:${lowerEmail}`;
        localStorage.setItem(k, JSON.stringify({ at: new Date().toISOString(), amount: amountText }));
        setAlreadyScanned(true);
      } catch {}
      overlayTimerRef.current = null;
    }, 450);
  }, [organizerName, lastScanKey, alreadyScanned]);

  // Charger l’état ‘déjà scanné’ au montage
  React.useEffect(() => {
    try {
      const k = `qrScanned:${String(slug)}:${groupName}:${lowerEmail}`;
      const raw = localStorage.getItem(k);
      if (raw) setAlreadyScanned(true);
    } catch {}
  }, [slug, groupName, lowerEmail]);

  // Récupérer (optionnel) le nom de l’organisatrice depuis l’API groupes
  React.useEffect(() => {
    let aborted = false;
    (async () => {
      try {
        const res = await fetch(`/api/groups?slug=${encodeURIComponent(String(slug || ''))}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (!Array.isArray(data)) return;
        const g = data.find((x: any) => String(x?.name || '') === groupName);
        if (!g) return;
        const email = String(g?.ownerEmail || '');
        let display: string | undefined;
        try {
          const raw = localStorage.getItem(`auth:users:${email.toLowerCase()}`);
          if (raw) {
            const u = JSON.parse(raw) as { name?: string };
            if (u?.name) display = u.name;
          }
        } catch {}
        if (!display && email) display = prettyName(email);
        if (!aborted) setOrganizerName(display);
      } catch {}
    })();
    return () => { aborted = true; };
  }, [slug, groupName]);

  // Poll serveur pour savoir si la demande a été scannée, puis afficher overlay côté participant (secours)
  React.useEffect(() => {
    if (!isAuthenticated || !event || !groupName || !lowerEmail || alreadyScanned) return;
    let timer: number | undefined;
    const tick = async () => {
      try {
        const url = `/api/requests?eventSlug=${encodeURIComponent(String(slug || ''))}&memberEmail=${encodeURIComponent(lowerEmail)}&groupName=${encodeURIComponent(groupName)}`;
        const res = await fetch(url, { cache: 'no-store' });
        if (res.ok) {
          const list = await res.json();
          const item = Array.isArray(list) ? list[0] : undefined;
          if (item && (item.scannedAt || item.payoutReleased)) {
            const key = `${String(slug)}|${groupName}|${lowerEmail}|${String(item.scannedAt || `payout:${item.payoutReleased}`)}`;
            showScanOverlay(key, fmt(amount));
          }
        }
      } catch {}
      timer = window.setTimeout(tick, 3000);
    };
    timer = window.setTimeout(tick, 1000);
    return () => { if (timer) window.clearTimeout(timer); };
  }, [isAuthenticated, event, groupName, lowerEmail, slug, organizerName, amount, showScanOverlay, alreadyScanned]);

  // SSE temps réel: écoute des mises à jour de demandes et déclenche l’overlay immédiatement
  React.useEffect(() => {
    if (!isAuthenticated) return;
    const es = new EventSource('/api/realtime/stream');
    const onUpdate = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        if (!alreadyScanned && data?.eventSlug === String(slug) && data?.memberEmail?.toLowerCase() === lowerEmail && data?.groupName === groupName) {
          const key = `${String(slug)}|${groupName}|${lowerEmail}|${String(data.scannedAt || `payout:${data.payoutReleased}`)}`;
          showScanOverlay(key, fmt(amount));
        }
      } catch {}
    };
    es.addEventListener('joinRequest:updated', onUpdate as any);
    return () => {
      try { es.close(); } catch {}
    };
  }, [isAuthenticated, slug, lowerEmail, groupName, organizerName, amount, showScanOverlay, alreadyScanned]);

  return (
    <main className="max-w-xl mx-auto px-4 py-8">
      <div className="rounded-2xl border border-black/10 dark:border-white/15 bg-white/70 dark:bg-white/5 backdrop-blur-xl p-6 shadow-[0_12px_40px_rgba(0,0,0,0.14)]">
        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white mb-3">Mon QR — {event.title}</h1>
        <div className="text-sm text-slate-700 dark:text-slate-300 space-y-1">
          <div><span className="font-semibold text-slate-900 dark:text-white">Événement:</span> {event.title}</div>
          <div><span className="font-semibold text-slate-900 dark:text-white">Date:</span> {fullDate}</div>
          <div><span className="font-semibold text-slate-900 dark:text-white">Groupe:</span> {groupName}</div>
          <div><span className="font-semibold text-slate-900 dark:text-white">Montant payé:</span> {fmt(amount)}</div>
        </div>

        <div className="mt-5 grid place-items-center gap-2 relative">
          <canvas ref={canvasRef} width={280} height={280} className={`rounded-xl border border-black/10 dark:border-white/15 bg-white ${alreadyScanned ? 'opacity-70 grayscale' : ''}`} aria-label="Mon QR" />
          {overlay.visible && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] rounded-xl flex items-center justify-center p-4">
              <div className="w-full max-w-sm rounded-2xl bg-white text-slate-900 p-5 shadow-xl">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-emerald-100 text-emerald-700 grid place-items-center">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/></svg>
                  </div>
                  <div className="text-base font-bold">Vous venez d’être scanné(e)</div>
                </div>
                <div className="mt-3 text-sm">
                  <p>La créatrice du groupe <span className="font-semibold">{groupName}</span>{overlay.organizer ? <> (<span className="font-semibold">{overlay.organizer}</span>)</> : ''} a validé votre entrée.</p>
                  {overlay.amountTxt && (
                    <p className="mt-1">Le montant <span className="font-semibold">{overlay.amountTxt}</span> a été envoyé à son solde.</p>
                  )}
                </div>
                <div className="mt-4 flex justify-end">
                  <button onClick={() => setOverlay({ visible: false, status: 'success', organizer: overlay.organizer, amountTxt: overlay.amountTxt })} className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold bg-slate-900 text-white">OK</button>
                </div>
              </div>
            </div>
          )}
          {!qrReady && <div className="text-[11px] text-slate-600 dark:text-slate-300">Cliquez sur “Générer mon QR”.</div>}
          <button onClick={generate} disabled={btnLoading} className={`rounded-xl px-4 py-2 text-sm font-semibold ${alreadyScanned ? 'bg-slate-900/80' : 'bg-slate-900'} text-white dark:bg-white dark:text-slate-900`}>{btnLoading ? 'Chargement…' : (qrReady ? 'Régénérer' : 'Générer mon QR')}</button>
          {qrError && <div className="text-xs text-red-600">{qrError}</div>}
        </div>

        <div className="mt-4 text-xs text-slate-600 dark:text-slate-300">
          {alreadyScanned ? (
            <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50/70 dark:bg-emerald-500/10 rounded-md px-2 py-1">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/></svg>
              Vous avez déjà été scanné(e) pour cet événement.
            </span>
          ) : (
            <>Présentez ce QR à l’organisatrice du groupe à l’entrée. Le paiement sera libéré après scan.</>
          )}
        </div>

        <div className="mt-5 flex items-center justify-between">
          <Link href="/scan" className="rounded-xl px-3 py-1.5 text-xs font-semibold border border-black/10 dark:border-white/15 bg-white/70 dark:bg-white/10">Retour</Link>
          {qrReady && (
            <button
              onClick={() => {
                try {
                  const canvas = canvasRef.current;
                  if (!canvas) return;
                  const url = canvas.toDataURL("image/png");
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `qr-${slug}-${groupName}.png`;
                  a.click();
                } catch {}
              }}
              className="rounded-xl px-3 py-1.5 text-xs font-semibold bg-slate-900 text-white dark:bg-white dark:text-slate-900"
            >Télécharger</button>
          )}
        </div>
      </div>
    </main>
  );
}
