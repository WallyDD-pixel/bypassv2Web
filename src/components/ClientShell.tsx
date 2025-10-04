"use client";
import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import PageTransition from "@/components/PageTransition";
import TopNav from "@/components/TopNav";
import BottomNav from "@/components/BottomNav";
import MobileHeader from "@/components/MobileHeader";
import { useAuth } from "@/lib/auth";
import GenericSkeleton, { HomeSkeleton, ExploreSkeleton, EventDetailSkeleton, RequestsSkeleton, ScannerSkeleton, ProfileSkeleton } from "@/components/Skeletons";
import PwaInstallPrompt from "@/components/PwaInstallPrompt";
import { ensurePushSubscription } from "@/lib/push-client";
import InAppNotifications from "@/components/InAppNotifications";

export default function ClientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, user, loading } = useAuth();
  // Auth pages: center content and hide BottomNav on mobile
  const isAuthPage = pathname.startsWith("/login") || pathname.startsWith("/register") || pathname.startsWith("/onboarding");
  // Rule: show BottomNav only on shallow routes (depth 0 or 1). Hide on deeper pages (depth >= 2) where a back button is expected.
  const depth = pathname.split("/").filter(Boolean).length; // "/" => 0, "/explore" => 1, "/events/slug" => 2
  const showBottomNav = !isAuthPage && depth <= 1;

  // Guard: if logged in but missing gender or avatar, force onboarding
  useEffect(() => {
    // Service Worker registration (PWA + push)
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      ensurePushSubscription().catch(() => {});
    }
  }, [isAuthenticated]);

  // Guard: if logged in but missing gender or avatar, try hydrate from cache/DB, else force onboarding
  useEffect(() => {
    if (isAuthPage) return;
    let cancelled = false;
    async function checkAndHydrateUser() {
      if (isAuthenticated && (!user?.gender || !user?.avatarUrl)) {
        // 1) Cache local par email
        try {
          const emailLower = String(user?.email || "").toLowerCase();
          if (emailLower) {
            const raw = localStorage.getItem(`auth:users:${emailLower}`);
            if (raw) {
              const cached = JSON.parse(raw);
              if (cached?.gender && cached?.avatarUrl) {
                localStorage.setItem("auth:user", JSON.stringify(cached));
                return;
              }
            }
          }
        } catch {}
        // 2) DB via API
        try {
          const email = user?.email;
          if (email) {
            const res = await fetch(`/api/user?email=${encodeURIComponent(email)}`, { cache: "no-store" });
            if (res.ok) {
              const data = await res.json();
              const dbUser = data?.user;
              if (dbUser?.gender && dbUser?.avatarUrl) {
                const normalized = {
                  name: dbUser.name,
                  email: dbUser.email,
                  avatarUrl: dbUser.avatarUrl,
                  gender: dbUser.gender,
                  balanceCents: 0,
                  pendingBalanceCents: 0,
                };
                localStorage.setItem("auth:user", JSON.stringify(normalized));
                localStorage.setItem(`auth:users:${String(dbUser.email).toLowerCase()}`, JSON.stringify(normalized));
                window.location.reload();
                return;
              }
            }
          }
        } catch {}
        if (!cancelled) router.replace("/onboarding");
      }
    }
    checkAndHydrateUser();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user?.gender, user?.avatarUrl, user?.email, router, isAuthPage]);

  return (
    <>
      {/* TopNav: rendue tout le temps (elle est déjà hidden en mobile via md:block) */}
      <TopNav />
      <InAppNotifications />
      <PwaInstallPrompt />
    {/* Mobile back header on deep pages */}
    {!isAuthPage && depth >= 2 && <MobileHeader />}
      <main className={
        isAuthPage
          ? "min-h-dvh flex items-center justify-center px-4 md:pt-24"
      : `min-h-dvh ${showBottomNav ? "pb-24" : "pb-6"} md:pb-0 md:pt-24`
      }>
        <div className="max-w-3xl mx-auto w-full p-4">
          {loading ? (
            pathname === "/" ? (
              <HomeSkeleton />
            ) : pathname.startsWith("/explore") ? (
              <ExploreSkeleton />
            ) : pathname.startsWith("/events/") ? (
              pathname.endsWith("/requests") ? <RequestsSkeleton /> : <EventDetailSkeleton />
            ) : pathname.startsWith("/scan") ? (
              <ScannerSkeleton />
            ) : pathname.startsWith("/profile") ? (
              <ProfileSkeleton />
            ) : (
              <GenericSkeleton />
            )
          ) : (
            <PageTransition>{children}</PageTransition>
          )}
        </div>
      </main>
      {/* BottomNav: cacher sur /login */}
      {showBottomNav && <BottomNav />}
    </>
  );
}
