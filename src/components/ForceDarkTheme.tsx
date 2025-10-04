"use client";
import { useEffect } from "react";

export function ForceDarkTheme() {
  useEffect(() => {
    // S'assurer que la classe dark est toujours présente
    const ensureDarkClass = () => {
      if (!document.documentElement.classList.contains('dark')) {
        document.documentElement.classList.add('dark');
      }
      // Retirer la classe light si elle existe
      document.documentElement.classList.remove('light');
    };

    // Appliquer immédiatement
    ensureDarkClass();

    // Observer les changements de classe (au cas où autre chose les modifierait)
    const observer = new MutationObserver(ensureDarkClass);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  return null;
}
