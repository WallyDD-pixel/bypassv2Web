import { useEffect, useState } from "react";

export default function usePageLoading() {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const start = () => setLoading(true);
    const end = () => setLoading(false);
    
    window.addEventListener("next:router:start", start);
    window.addEventListener("next:router:done", end);
    window.addEventListener("next:router:error", end);
    return () => {
      window.removeEventListener("next:router:start", start);
      window.removeEventListener("next:router:done", end);
      window.removeEventListener("next:router:error", end);
    };
  }, []);

  return loading;
}
