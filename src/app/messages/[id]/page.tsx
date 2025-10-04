"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { GlassCard } from "@/components/ui";

// (header retiré)

export default function ConversationPage() {
	const params = useParams<{ id: string }>();
	const id = Number(params?.id);
	const { user } = useAuth();
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [messages, setMessages] = useState<Array<{ id: number; conversationId: number; senderEmail: string; content: string; createdAt: string }>>([]);
	const [vvh, setVvh] = useState<number | null>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const scrollerRef = useRef<HTMLDivElement>(null);
	const endRef = useRef<HTMLDivElement>(null);
	const markSeen = () => {
		try {
			if (!user?.email || !Number.isFinite(id)) return;
			const key = `conv:lastSeen:${user.email.toLowerCase()}:${id}`;
			localStorage.setItem(key, String(Date.now()));
		} catch {}
	};

	const scrollToEnd = (behavior: ScrollBehavior = "auto") => {
		if (endRef.current) {
			try { endRef.current.scrollIntoView({ behavior, block: "end" }); return; } catch {}
		}
		const el = scrollerRef.current;
		if (el) el.scrollTop = el.scrollHeight;
	};

	// Charger les messages
	useEffect(() => {
		let cancelled = false;
		const run = async () => {
			try {
				setError(null);
				if (!Number.isFinite(id)) return;
				setLoading(true);
				const res = await fetch(`/api/conversations/${id}/messages`, { cache: "no-store" });
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				const data = await res.json();
				if (!cancelled) setMessages(Array.isArray(data) ? data : []);
			} catch (e: any) {
				if (!cancelled) setError(e?.message || "Erreur");
			} finally {
				if (!cancelled) setLoading(false);
			}
		};
		run();
		return () => {
			cancelled = true;
		};
	}, [id]);

	// Scroll auto en bas sur changement de messages
	useEffect(() => {
		scrollToEnd();
		markSeen();
	}, [messages]);

	// Empêcher le scroll global, on scrolle seulement la liste
	useEffect(() => {
		const prevBody = document.body.style.overflow;
		const prevHtml = document.documentElement.style.overflow;
		document.body.style.overflow = "hidden";
		document.documentElement.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = prevBody;
			document.documentElement.style.overflow = prevHtml;
		};
	}, []);

	// SSE realtime: écoute des nouveaux messages et append si correspond à cette conversation
	useEffect(() => {
		if (!Number.isFinite(id)) return;
	const src = new EventSource("/api/realtime/stream");
		const handler = (ev: MessageEvent) => {
			try {
				const m = JSON.parse(ev.data) as { id: number; conversationId: number; senderEmail: string; content: string; createdAt: string };
				if (m.conversationId === id) {
					setMessages((arr) => (arr.some((x) => x.id === m.id) ? arr : [...arr, m]));
		    // Marquer vu si on est sur la conversation ouverte
		    markSeen();
				}
			} catch {}
		};
		src.addEventListener("message:created", handler as any);
		return () => {
			try { src.removeEventListener("message:created", handler as any); } catch {}
			try { src.close(); } catch {}
		};
	}, [id]);

	// Stabiliser lors des changements de viewport (clavier iOS/Android)
	useEffect(() => {
		const vv = (typeof window !== "undefined" ? (window as any).visualViewport : undefined) as VisualViewport | undefined;
		// Initialiser la hauteur virtuelle
		const updateVvh = () => setVvh(vv ? Math.round(vv.height) : window.innerHeight);
		updateVvh();

		let t: number | undefined;
		const onResize = () => {
			updateVvh();
			if (t) window.clearTimeout(t);
			// Double rafraîchissement pour gérer la fermeture du clavier sur iOS
			t = window.setTimeout(() => {
				scrollToEnd();
				window.setTimeout(() => scrollToEnd("smooth"), 180);
			}, 80);
		};
		vv?.addEventListener("resize", onResize);
		vv?.addEventListener("scroll", onResize);
		return () => {
			try { vv?.removeEventListener("resize", onResize); } catch {}
			try { vv?.removeEventListener("scroll", onResize); } catch {}
			if (t) window.clearTimeout(t);
		};
	}, []);

	const send = async () => {
		const content = inputRef.current?.value?.trim();
		if (!content || !user?.email || !Number.isFinite(id)) return;
		try {
			const res = await fetch(`/api/conversations/${id}/messages`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ senderEmail: user.email, content }),
			});
			if (!res.ok) throw new Error("failed");
			const m = await res.json();
			setMessages((arr) => (arr.some((x) => x.id === m.id) ? arr : [...arr, m]));
			if (inputRef.current) inputRef.current.value = "";
		} catch {}
	};

	return (
		<main
				className="w-full overflow-hidden px-4 pt-4 text-slate-900 flex flex-col min-h-0 transition-all duration-300 ease-out"
				style={vvh ? { height: `${vvh}px`, paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 96px)" } : { paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 96px)" }}
			>

		    <GlassCard padding="none" className="flex-1 flex flex-col min-h-0 p-2 transition-all duration-300 ease-out">
					<div
						ref={scrollerRef}
			    className="flex-1 overflow-y-auto space-y-2 overscroll-contain scroll-smooth"
						style={{ overflowAnchor: "none" as any }}
					>
				{!Number.isFinite(id) ? (
					<div className="text-sm text-slate-600 de conversation invalide.</div>
				) : loading ? (
					<div className="text-sm text-slate-600
				) : error ? (
					<div className="text-sm text-red-600
				) : messages.length === 0 ? (
					<div className="text-sm text-slate-600 text-center mt-6">Aucun message pour l’instant.</div>
				) : (
					messages.map((m) => {
						const mine = user?.email && m.senderEmail.toLowerCase() === user.email.toLowerCase();
						return (
							<div
								key={m.id}
								className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${
									mine
										? "ml-auto bg-slate-900 text-white
										: "bg-white/80
								}`}
							>
								<div className="text-[10px] opacity-70 mb-0.5">{m.senderEmail.split("@")[0]}</div>
								<div>{m.content}</div>
								<div className="text-[10px] opacity-70 mt-1">{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
							</div>
						);
					})
				)}
					<div ref={endRef} />
				</div>

				<div className="pt-2 mt-2 flex items-center gap-2 border-t border-white/50
					<input
						ref={inputRef}
						type="text"
						placeholder="Écrire un message…"
						className="flex-1 px-3 py-2 rounded-xl bg-white/80 border border-white/50 outline-none"
						onKeyDown={(e) => {
							if ((e as any).key === "Enter") send();
						}}
						onFocus={() => setTimeout(() => scrollToEnd("smooth"), 50)}
						onBlur={() => setTimeout(() => scrollToEnd(), 80)}
					/>
					<button onClick={send} className="px-3 py-2 rounded-xl bg-slate-900 text-white
						Envoyer
					</button>
				</div>
			</GlassCard>
		</main>
	);
}

