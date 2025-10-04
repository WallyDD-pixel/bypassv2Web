"use client";
import React from "react";

export default function ProfileSkeleton() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      {/* Header avatar + name card */}
      <section className="rounded-2xl border border-white/15 bg-white/5 backdrop-blur-xl p-6 shadow animate-pulse">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-slate-200/70 dark:bg-white/10" />
          <div className="flex-1">
            <div className="h-5 w-48 bg-slate-200/70 dark:bg-white/10 rounded mb-2" />
            <div className="h-4 w-64 bg-slate-200/70 dark:bg-white/10 rounded" />
          </div>
        </div>
      </section>

      {/* Balance card */}
      <section className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-white/15 bg-white/5 backdrop-blur-xl p-6 shadow animate-pulse">
          <div className="h-4 w-40 bg-slate-200/70 dark:bg-white/10 rounded mb-3" />
          <div className="h-8 w-32 bg-slate-200/70 dark:bg-white/10 rounded" />
          <div className="h-4 w-full bg-slate-200/70 dark:bg-white/10 rounded mt-4" />
        </div>
        <div className="rounded-2xl border border-white/15 bg-white/5 backdrop-blur-xl p-6 shadow animate-pulse">
          <div className="h-4 w-44 bg-slate-200/70 dark:bg-white/10 rounded mb-3" />
          <div className="h-8 w-40 bg-slate-200/70 dark:bg-white/10 rounded" />
          <div className="h-4 w-5/6 bg-slate-200/70 dark:bg-white/10 rounded mt-4" />
        </div>
      </section>

      {/* Actions */}
      <section className="mt-8 max-w-md mx-auto space-y-3">
        <div className="h-10 w-full rounded-xl bg-slate-200/70 dark:bg-white/10" />
        <div className="h-10 w-full rounded-xl bg-slate-200/70 dark:bg-white/10" />
        <div className="h-10 w-full rounded-xl bg-slate-200/70 dark:bg-white/10 mt-8" />
      </section>
    </main>
  );
}
