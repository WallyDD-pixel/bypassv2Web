"use client";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { usePageVisibility } from "@/hooks/usePageVisibility";

export function UserVisibilityTracker() {
  const { user, isAuthenticated } = useAuth();
  const isVisibleRef = usePageVisibility();

  useEffect(() => {
    if (!isAuthenticated || !user?.email) return;

    let intervalId: NodeJS.Timeout;

    const updateVisibility = async (isVisible: boolean) => {
      try {
        await fetch('/api/user-visibility', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userEmail: user.email,
            isVisible
          })
        });
      } catch (error) {
        console.error('Error updating visibility:', error);
      }
    };

    const handleVisibilityChange = () => {
      updateVisibility(isVisibleRef.current);
    };

    // Mettre à jour immédiatement
    updateVisibility(true);

    // Écouter les changements de visibilité
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Ping périodique quand l'utilisateur est actif (toutes les 15 secondes)
    intervalId = setInterval(() => {
      if (isVisibleRef.current) {
        updateVisibility(true);
      }
    }, 15000);

    // Cleanup au démontage du composant
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(intervalId);
      // Marquer comme inactif quand on quitte la page
      updateVisibility(false);
    };
  }, [isAuthenticated, user?.email, isVisibleRef]);

  return null; // Ce composant n'affiche rien
}
