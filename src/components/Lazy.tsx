"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Renders its children only once the placeholder comes near the viewport,
 * so sections further down don't fire their (sometimes large) data requests on page load.
 */
export function Lazy({ children, minHeight = 600, id }: { children: ReactNode; minHeight?: number; id?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    // jump links (/#klima) must render the target immediately
    if (id && window.location.hash === `#${id}`) {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setVisible(true), { rootMargin: "400px 0px" });
    io.observe(el);
    const onHash = () => window.location.hash === `#${id}` && setVisible(true);
    window.addEventListener("hashchange", onHash);
    return () => {
      io.disconnect();
      window.removeEventListener("hashchange", onHash);
    };
  }, [visible, id]);

  if (visible) return <>{children}</>;
  return <div ref={ref} id={id} className="scroll-mt-24" style={{ minHeight }} aria-busy="true" />;
}
