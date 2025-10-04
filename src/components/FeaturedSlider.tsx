"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

export type FeaturedItem = {
  id: string | number;
  title: string;
  date: string;
  location: string;
  imageUrl: string;
  href?: string;
};

interface FeaturedSliderProps {
  items: FeaturedItem[];
  intervalMs?: number;
}

export default function FeaturedSlider({ items, intervalMs = 4500 }: FeaturedSliderProps) {
  const [index, setIndex] = useState(0);
  const [dragDx, setDragDx] = useState(0);
  const draggingRef = useRef(false);
  const startXRef = useRef(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pausedRef = useRef(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const safeItems = useMemo(() => items.slice(0, 6), [items]);
  const count = safeItems.length;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = () => setReducedMotion(mq.matches);
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);

  useEffect(() => {
    if (count <= 1 || pausedRef.current || reducedMotion) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % count), intervalMs);
    return () => clearInterval(id);
  }, [count, intervalMs, reducedMotion, index]);

  if (count === 0) return null;

  const goTo = (i: number) => setIndex(((i % count) + count) % count);
  const prev = () => goTo(index - 1);
  const next = () => goTo(index + 1);

  const onPointerDown = (e: React.PointerEvent) => {
    draggingRef.current = true;
    startXRef.current = e.clientX;
    pausedRef.current = true;
    setDragDx(0);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    setDragDx(e.clientX - startXRef.current);
  };
  const onPointerUp = () => {
    if (!draggingRef.current) return;
    const width = containerRef.current?.offsetWidth ?? 1;
    const threshold = 0.15; // 15% du conteneur
    const dxPct = dragDx / width;
    if (dxPct > threshold) prev();
    else if (dxPct < -threshold) next();
    draggingRef.current = false;
    setDragDx(0);
    pausedRef.current = false;
  };

  const width = containerRef.current?.offsetWidth ?? 1;
  const dxPct = (dragDx / width) * 100;
  const trackStyle: React.CSSProperties = {
    transform: `translate3d(${(-index * 100) + dxPct}%, 0, 0)`,
    transition: draggingRef.current || reducedMotion ? "none" : "transform 600ms cubic-bezier(.22,.61,.36,1)",
  };

  return (
    <section className="relative w-full max-w-5xl mx-auto select-none" role="region" aria-label="Événements à la une">
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-3xl border border-black/10 dark:border-white/15 shadow-[0_12px_40px_rgba(0,0,0,0.18)] touch-pan-y"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onMouseEnter={() => (pausedRef.current = true)}
        onMouseLeave={() => (pausedRef.current = false)}
      >
        {/* Track */}
        <div className="flex w-full h-full will-change-transform" style={trackStyle}>
          {safeItems.map((item) => (
            <article key={item.id} className="relative shrink-0 w-full aspect-[16/12] sm:aspect-[16/10] md:aspect-[16/8]">
              <img
                src={item.imageUrl}
                alt={item.title}
                className="absolute inset-0 w-full h-full object-cover"
                draggable={false}
              />
              {/* Edge gradients for depth */}
              <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-black/30 to-transparent pointer-events-none" />
              <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-black/30 to-transparent pointer-events-none" />
              {/* Info glass card */}
              <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 flex items-end">
                <div className="backdrop-blur-2xl bg-white/10 dark:bg-white/5 border border-white/20 rounded-2xl p-4 sm:p-6 max-w-[88%]">
                  <h3 className="text-lg sm:text-2xl font-bold text-white drop-shadow mb-1">{item.title}</h3>
                  <p className="text-white/85 text-xs sm:text-sm">{item.date} • {item.location}</p>
                </div>
                {item.href && (
                  <Link
                    href={item.href}
                    className="ml-auto hidden sm:inline-flex bg-white text-slate-900 font-semibold text-sm px-4 py-2 rounded-xl hover:bg-white/90 shadow"
                  >
                    Voir
                  </Link>
                )}
              </div>
            </article>
          ))}
        </div>

        {/* Controls */}
        <button
          onClick={prev}
          aria-label="Précédent"
          className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full backdrop-blur bg-black/30 text-white flex items-center justify-center hover:bg-black/40 active:scale-95 transition md:flex hidden"
        >
          ‹
        </button>
        <button
          onClick={next}
          aria-label="Suivant"
          className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full backdrop-blur bg-black/30 text-white flex items-center justify-center hover:bg-black/40 active:scale-95 transition md:flex hidden"
        >
          ›
        </button>

        {/* Dots */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
          {safeItems.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              aria-label={`Aller à la slide ${i + 1}`}
              className={`h-2.5 rounded-full transition-all shadow ${
                i === index ? "w-6 bg-white" : "w-2.5 bg-white/60 hover:bg-white/80"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
