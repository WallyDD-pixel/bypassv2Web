"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getEventBySlug } from "@/data/events";
import type { Group } from "@/data/events";
import { useAuth } from "@/lib/auth";

export default function PayJoinPage() {
  const { slug } = useParams<{ slug: string }>();
  const event = getEventBySlug(slug || "");
  const router = useRouter();
  const search = useSearchParams();
  const { isAuthenticated, user, loading } = useAuth();

  const groupName = decodeURIComponent(search.get("g") || "");
  const amount = Number(search.get("amt") || 0);

  // Hooks d'état/réfs doivent être déclarés avant tout return conditionnel
  const [paying, setPaying] = useState(false);
  const [done, setDone] = useState(false);
  const [statusMsg, setStatusMsg] = useState<"idle" | "processing" | "success" | "failed">("idle");
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState(""); // MM/YY
  const [cvc, setCvc] = useState("");
  const [method, setMethod] = useState<"card" | "paypal">("card");
  const [sdkReady, setSdkReady] = useState(false);
  const paypalContainerRef = useRef<HTMLDivElement | null>(null);
  const [hfReady, setHfReady] = useState(false);
  const hostedFieldsRef = useRef<any>(null);
  const createdOrderIdRef = useRef<string | null>(null);

  // Mobile header title
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("mobile-header:title", { detail: "Paiement" }));
    }
    return () => {
      if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("mobile-header:title", { detail: "" }));
    };
  }, []);

  useEffect(() => {
    if (!loading && !isAuthenticated) router.replace("/login");
  }, [loading, isAuthenticated, router]);

  // Load groups (mock + persisted) to find the selected one
  const storageKeyGroupsLegacy = (slug: string) => `createdGroups:${slug}`;
  const storageKeyGroupsScoped = (slug: string, emailLower?: string) => `createdGroups:${slug}${emailLower ? ":" + emailLower : ""}`;
  const [persistedGroups, setPersistedGroups] = useState<Group[]>([]);
  const [serverGroups, setServerGroups] = useState<Group[]>([]);
  useEffect(() => {
    try {
      const emailLower = (user?.email || "").toLowerCase();
      let merged: any[] = [];
      if (typeof window !== "undefined") {
        const scoped = window.localStorage.getItem(storageKeyGroupsScoped(slug || "", emailLower || undefined));
        const legacy = window.localStorage.getItem(storageKeyGroupsLegacy(slug || ""));
        if (scoped) merged = merged.concat(JSON.parse(scoped));
        if (legacy) {
          const arr = JSON.parse(legacy) as any[];
          const mine = arr.filter((g: any) => (g?.ownerEmail || "").toLowerCase() === emailLower || (user?.name && g?.name === `Groupe de ${user?.name}`));
          merged = merged.concat(mine);
        }
      }
      setPersistedGroups(merged);
    } catch {
      setPersistedGroups([]);
    }
  }, [slug, user?.email, user?.name]);

  // Aussi charger les groupes depuis l'API pour couvrir les cas cross-device
  useEffect(() => {
    let aborted = false;
    (async () => {
      try {
        const res = await fetch(`/api/groups?slug=${encodeURIComponent(String(slug || ""))}`, { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        if (!aborted) setServerGroups(Array.isArray(data) ? data : []);
      } catch {
        if (!aborted) setServerGroups([]);
      }
    })();
    return () => { aborted = true; };
  }, [slug]);

  const allGroups = useMemo(() => {
    if (!event) return [] as Group[];
    // merge et dédoublonne par nom
    const merged = [...event.groupsGoing, ...serverGroups, ...persistedGroups];
    const seen = new Set<string>();
    return merged.filter((g: any) => {
      const name = String(g?.name || "");
      if (!name || seen.has(name)) return false;
      seen.add(name);
      return true;
    });
  }, [event, serverGroups, persistedGroups]);

  const group = allGroups.find((g) => g.name === groupName) || null;

  useEffect(() => {
    if (!event) router.replace("/");
    if (!groupName) router.replace(`/events/${slug}/join`);
  }, [event, groupName, router, slug]);

  // Si, après chargements, le groupe n'existe pas, revenir à la liste pour éviter un écran vide
  useEffect(() => {
    if (event && groupName && !group) {
      const t = setTimeout(() => {
        router.replace(`/events/${slug}/join`);
      }, 1000);
      return () => clearTimeout(t);
    }
  }, [event, groupName, group, router, slug]);


  const userEmailLower = (user?.email || "").toLowerCase();
  const storageKeyRequests = (slug: string, email: string) => `joinRequests:${slug}:${email}`;

  type StoredRequest = { group: string; amount?: number; currency?: string; status?: string; createdAt?: string; method?: string };
  const persistRequest = (opts?: { amount?: number; method?: "card" | "paypal" }) => {
    try {
      if (!group) return;
      const now = new Date().toISOString();
      const amountNum = Math.max(0, Number(opts?.amount ?? amount) || 0);
      const entry: StoredRequest = {
        group: group.name,
        amount: amountNum > 0 ? Number(amountNum.toFixed(2)) : undefined,
        currency: amountNum > 0 ? "EUR" : undefined,
        status: "pending",
        createdAt: now,
        method: opts?.method,
      };
      // Try server first
      (async () => {
        try {
          await fetch(`/api/requests`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              eventSlug: slug,
              groupName: group.name,
              memberEmail: userEmailLower,
              amountCents: entry.amount != null ? Math.round(entry.amount * 100) : null,
              currency: entry.currency,
              method: entry.method,
              status: entry.status,
            }),
          });
        } catch {}
        // Always also store locally for offline visibility
        try {
          const key = storageKeyRequests(slug || "", userEmailLower);
          const raw = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
          let arr = raw ? (JSON.parse(raw) as Array<string | StoredRequest>) : [];
          arr = arr.map((x) => {
            if (typeof x === 'string' && x === entry.group) return { ...entry, createdAt: entry.createdAt } as StoredRequest;
            if (typeof x !== 'string' && x.group === entry.group) {
              return { ...x, amount: entry.amount ?? x.amount, method: entry.method ?? x.method, currency: entry.currency ?? x.currency, status: x.status || 'pending' } as StoredRequest;
            }
            return x;
          });
          const same = arr.find((x) => typeof x !== 'string' && x.group === entry.group && x.createdAt?.slice(0,10) === entry.createdAt?.slice(0,10));
          if (!same) arr.push(entry);
          window.localStorage.setItem(key, JSON.stringify(arr));
        } catch {}
      })();
    } catch {}
  };

  // Form helpers et validations

  const onlyDigits = (s: string) => s.replace(/\D+/g, "");
  const formatCardNumber = (s: string) => onlyDigits(s).slice(0, 19).replace(/(.{4})/g, "$1 ").trim();
  const luhnCheck = (num: string) => {
    const digits = onlyDigits(num);
    if (digits.length < 13) return false;
    let sum = 0;
    let dbl = false;
    for (let i = digits.length - 1; i >= 0; i--) {
      let d = parseInt(digits[i], 10);
      if (dbl) {
        d *= 2;
        if (d > 9) d -= 9;
      }
      sum += d;
      dbl = !dbl;
    }
    return sum % 10 === 0;
  };
  const formatExpiry = (s: string) => {
    const d = onlyDigits(s).slice(0, 4);
    if (d.length <= 2) return d;
    return d.slice(0, 2) + "/" + d.slice(2);
  };
  const isValidExpiry = (s: string) => {
    const m = s.match(/^(\d{2})\/(\d{2})$/);
    if (!m) return false;
    let mm = parseInt(m[1], 10);
    let yy = parseInt(m[2], 10);
    if (mm < 1 || mm > 12) return false;
    const now = new Date();
    const curY = now.getFullYear() % 100;
    const curM = now.getMonth() + 1;
    if (yy < curY) return false;
    if (yy === curY && mm < curM) return false;
    return true;
  };
  const isValidName = (s: string) => s.trim().length >= 2;
  const isValidCvc = (s: string) => /^\d{3,4}$/.test(s);
  const isValidNumber = (s: string) => {
    const digits = onlyDigits(s);
    return digits.length >= 13 && digits.length <= 19 && luhnCheck(s);
  };
  const formValid = isValidName(cardName) && isValidNumber(cardNumber) && isValidExpiry(expiry) && isValidCvc(cvc);

  // Chargement unique du SDK PayPal (buttons + hosted-fields) avec client token
  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
    if (!clientId) { setSdkReady(false); return; }
    const w: any = window as any;
    if (w.paypal && w.paypal.Buttons && w.paypal.HostedFields) { setSdkReady(true); return; }
    (async () => {
      try {
        // Client token requis pour Hosted Fields
        let clientToken: string | undefined;
        try {
          const tokRes = await fetch(`/api/paypal/client-token`, { cache: "no-store" });
          if (tokRes.ok) {
            const j = await tokRes.json();
            clientToken = j?.clientToken;
          }
        } catch {}
        const params = new URLSearchParams({ 'client-id': clientId, components: 'buttons,hosted-fields', currency: 'EUR' });
        const script = document.createElement('script');
        script.src = `https://www.paypal.com/sdk/js?${params.toString()}`;
        if (clientToken) script.setAttribute('data-client-token', clientToken);
        script.async = true;
        script.onload = () => setSdkReady(!!( (window as any).paypal ));
        script.onerror = () => setSdkReady(false);
        document.body.appendChild(script);
      } catch {
        setSdkReady(false);
      }
    })();
  }, []);

  // Rendu des boutons PayPal quand SDK prêt
  useEffect(() => {
    if (method !== "paypal") return;
    if (!sdkReady) return;
    if (!paypalContainerRef.current) return;
    const w: any = window as any;
    if (!w.paypal) return;
    // reset container
    paypalContainerRef.current.innerHTML = "";
    const val = Math.max(0.01, Number(amount) || 0);
  w.paypal
      .Buttons({
        style: { layout: "vertical", shape: "rect", color: "gold" },
        createOrder: (_data: any, actions: any) => {
          return actions.order.create({
            purchase_units: [
              {
                amount: { value: val.toFixed(2), currency_code: "EUR" },
                description: `Demande pour ${groupName}`,
              },
            ],
          });
        },
        onApprove: async (_data: any, actions: any) => {
          try {
            setStatusMsg("processing");
            if (actions?.order) await actions.order.capture();
          } catch {}
          persistRequest({ amount, method: "paypal" });
          setStatusMsg("success");
          setTimeout(() => router.replace(`/events/${slug}/join?status=success`), 1200);
        },
        onCancel: () => {
          setStatusMsg("failed");
        },
        onError: (err: any) => {
          console.error("PayPal error", err);
          setStatusMsg("failed");
        },
      })
      .render(paypalContainerRef.current);
  }, [method, sdkReady, amount, groupName, router, slug]);

  // Initialisation Hosted Fields (UX Carte) une fois SDK prêt
  useEffect(() => {
    if (method !== "card") return;
    const w: any = window as any;
    if (!sdkReady || !w?.paypal?.HostedFields) { setHfReady(false); return; }
    // Vérifier que les éléments DOM existent bien avant d'initialiser HostedFields
    const checkDomReady = () => {
      return (
        document.getElementById('pp-card-number') &&
        document.getElementById('pp-card-expiration') &&
        document.getElementById('pp-card-cvv')
      );
    };
    let timeout: any;
    const tryInit = async () => {
      if (!checkDomReady()) {
        timeout = setTimeout(tryInit, 50);
        return;
      }
      try {
        const wp: any = w.paypal;
        // teardown previous instance if any to avoid stacked iframes
        try { await hostedFieldsRef.current?.teardown?.(); } catch {}
        createdOrderIdRef.current = null;
        hostedFieldsRef.current = await wp.HostedFields.render({
          createOrder: async () => {
            const orderRes = await fetch(`/api/paypal/order`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ amount: Math.max(0.01, Number(amount) || 0), description: `Demande pour ${groupName}` }),
            });
            if (!orderRes.ok) {
              let detail = "Création de commande échouée";
              try { const j = await orderRes.json(); detail = j?.error || detail; } catch {}
              throw new Error(detail);
            }
            const order = await orderRes.json();
            createdOrderIdRef.current = order?.id || null;
            return order?.id;
          },
          styles: {
            'input': { 'font-size': '14px', 'color': '#ffffff' },
            ':focus': { 'color': '#ffffff' },
            '::placeholder': { 'color': '#94a3b8' },
            '.invalid': { 'color': '#fecaca' },
            '.valid': { 'color': '#bbf7d0' },
          },
          fields: {
            number: { selector: '#pp-card-number', placeholder: '1234 5678 9012 3456' },
            cvv: { selector: '#pp-card-cvv', placeholder: '123' },
            expirationDate: { selector: '#pp-card-expiration', placeholder: 'MM/YY' },
          },
        });
        setHfReady(true);
      } catch (e) {
        console.error(e);
        setHfReady(false);
        hostedFieldsRef.current = null;
      }
    };
    tryInit();
    return () => {
      if (timeout) clearTimeout(timeout);
      // cleanup on unmount or method change
      try { hostedFieldsRef.current?.teardown?.(); } catch {}
      hostedFieldsRef.current = null;
      setHfReady(false);
    };
  }, [method, amount, groupName, sdkReady]);

  // Si l'événement ou le groupe cible n'est pas prêt, ne rien afficher (les effets ci-dessus gèrent les redirections)
  if (loading || !isAuthenticated || !user || !event || !group) return null;

  return (
    <main className="max-w-md mx-auto px-4 py-10">
      <div className="mb-6 flex items-center gap-3">
        <h1 className="hidden md:block text-2xl font-extrabold text-slate-900
      </div>

  <div className="rounded-2xl border border-white/15 bg-white/70 p-6 shadow-[0_12px_40px_rgba(0,0,0,0.14)] isolate">
        <div className="mb-4">
          <div className="text-sm text-slate-600 demandez à rejoindre</div>
          <div className="text-lg font-bold text-slate-900
        </div>

        <div className="mb-4 text-sm text-slate-700
          Montant à payer: <span className="font-semibold">{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Math.max(0, amount))}</span>
        </div>

        {/* Formulaire Carte Bancaire uniquement */}
        {/* Sélecteur méthode */}
        <div className="mb-4 inline-flex rounded-xl border border-white/15 bg-white/60 p-1">
          <button
            type="button"
            onClick={() => setMethod("card")}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${method === "card" ? "bg-slate-900 text-white : "text-slate-700
          >
            Carte bancaire
          </button>
          <button
            type="button"
            onClick={() => setMethod("paypal")}
            disabled={!process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || (Number(amount) || 0) <= 0}
            className={`ml-1 px-3 py-1.5 rounded-lg text-sm font-semibold ${method === "paypal" ? "bg-slate-900 text-white : "text-slate-700 ${(!process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || (Number(amount) || 0) <= 0) ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            PayPal
          </button>
        </div>

        {/* Formulaire Carte Bancaire (Hosted Fields) */}
        {method === "card" && (
          <>
            {!hfReady && (
              <div className="mb-4 flex items-center gap-2 text-sm text-slate-700
                <svg className="animate-spin h-5 w-5 text-emerald-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path></svg>
                Veuillez patienter pendant le chargement du paiement sécurisé…
              </div>
            )}
            <form className="mb-6" onSubmit={(e) => e.preventDefault()}>
              <div className="text-sm font-semibold text-slate-900 mb-2">Paiement par carte bancaire</div>
              <div className="grid gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Nom sur la carte</label>
                  <input
                    type="text"
                    autoComplete="cc-name"
                    value={cardName}
                    onChange={(e) => setCardName(e.target.value)}
                    placeholder="Prénom Nom"
                    className="w-full rounded-xl border border-white/15 bg-white/80 px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/10"
                  />
                  {!isValidName(cardName) && cardName !== "" && (
                    <div className="mt-1 text-[12px] text-rose-600">Nom trop court.</div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Numéro de carte</label>
                  <div
                    id="pp-card-number"
                    className="relative w-full h-11 rounded-lg border border-white/15 bg-white/80 px-3 py-2 text-sm cursor-text z-10"
                    style={{ pointerEvents: "auto" }}
                    onClick={() => {
                      try { hostedFieldsRef.current?.focus?.('number'); } catch {}
                    }}
                  ></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Expiration (MM/YY)</label>
                    <div
                      id="pp-card-expiration"
                      className="relative w-full h-11 rounded-lg border border-white/15 bg-white/80 px-3 py-2 text-sm cursor-text z-10"
                      style={{ pointerEvents: "auto" }}
                      onClick={() => {
                        try { hostedFieldsRef.current?.focus?.('expirationDate'); } catch {}
                      }}
                    ></div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">CVC</label>
                    <div
                      id="pp-card-cvv"
                      className="relative w-full h-11 rounded-lg border border-white/15 bg-white/80 px-3 py-2 text-sm cursor-text z-10"
                      style={{ pointerEvents: "auto" }}
                      onClick={() => {
                        try { hostedFieldsRef.current?.focus?.('cvv'); } catch {}
                      }}
                    ></div>
                  </div>
                </div>
                {!hfReady && process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID && (
                  <div className="text-[12px] text-slate-500">Initialisation du paiement sécurisé…</div>
                )}
                {!process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID && (
                  <div className="text-[12px] text-amber-700 NEXT_PUBLIC_PAYPAL_CLIENT_ID pour activer le paiement carte.</div>
                )}
              </div>
              {/* Force iframes to fill containers so clicks register */}
              <style jsx>{`
                #pp-card-number iframe, #pp-card-expiration iframe, #pp-card-cvv iframe {
                  width: 100% !important;
                  height: 100% !important;
                  display: block !important;
                }
              `}</style>
            </form>
          </>
        )}

        {/* Boutons PayPal */}
        {method === "paypal" && (
          <div className="mb-6">
            {!process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID && (
              <div className="mb-3 text-[12px] text-amber-700 NEXT_PUBLIC_PAYPAL_CLIENT_ID pour activer PayPal.</div>
            )}
            {(Number(amount) || 0) <= 0 && (
              <div className="mb-3 text-[12px] text-amber-700 montant doit être supérieur à 0 pour utiliser PayPal.</div>
            )}
            <div ref={paypalContainerRef} />
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <button onClick={() => router.back()} className="rounded-xl px-4 py-2 text-sm font-semibold bg-slate-200 text-slate-900
      {method === "card" ? (
        <button
          disabled={paying || !isValidName(cardName) || !hfReady}
          onClick={async () => {
            if (!hfReady) {
              setStatusMsg("failed");
              return;
            }
            try {
              setPaying(true);
              const w: any = window as any;
              if (!hostedFieldsRef.current || !w?.paypal?.HostedFields) {
                throw new Error("Paiement carte non prêt. Réessayez dans un instant.");
              }
              setStatusMsg("processing");
              await hostedFieldsRef.current.submit({
                cardholderName: cardName,
                contingencies: ["SCA_WHEN_REQUIRED"],
              });
              persistRequest({ amount, method: "card" });
              setDone(true);
              setStatusMsg("success");
              setTimeout(() => router.replace(`/events/${slug}/join?status=success`), 1200);
            } catch (e: any) {
              setStatusMsg("failed");
            } finally {
              setPaying(false);
            }
          }}
          className="rounded-xl px-4 py-2 text-sm font-semibold bg-white text-slate-900 disabled:opacity-50"
        >
          {paying ? "Paiement en cours…" : "Payer et envoyer la demande"}
        </button>
      ) : (
        <div className="text-[12px] text-slate-400">Utilisez les boutons PayPal ci-dessus.</div>
      )}
        </div>
      </div>
      {/* Feedback inline */}
      {statusMsg !== "idle" && (
        <div className="mt-4 text-center text-sm">
          {statusMsg === "processing" && (
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-200 text-slate-800
              <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2a10 10 0 100 20 10 10 0 000-20z" stroke="currentColor" strokeOpacity="0.2" strokeWidth="4"/><path d="M12 2a10 10 0 000 20" stroke="currentColor" strokeWidth="4"/></svg>
              Traitement du paiement…
            </div>
          )}
          {statusMsg === "success" && (
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-green-600/20 text-green-200 border border-green-700/40">
              Paiement accepté — redirection…
            </div>
          )}
          {statusMsg === "failed" && (
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-600/20 text-rose-200 border border-rose-700/40">
              Paiement refusé — redirection…
            </div>
          )}
        </div>
      )}
    </main>
  );
}
