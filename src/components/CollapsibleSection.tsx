"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

const PREFIX = "wetter-perg:open:";

/**
 * A page section whose heading toggles the content. The open/closed state is
 * remembered per section in localStorage. Jump links (/#id) always open it.
 */
export function CollapsibleSection({
  id,
  eyebrow,
  title,
  defaultOpen = false,
  actions,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  defaultOpen?: boolean;
  /** Controls shown next to the heading, only while the section is open. */
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  // read stored state after mount (static export: no localStorage during prerender)
  useEffect(() => {
    try {
      const v = localStorage.getItem(PREFIX + id);
      if (v === "1") setOpen(true);
      else if (v === "0") setOpen(false);
    } catch {
      /* ignore */
    }
    const onHash = () => window.location.hash === `#${id}` && setOpen(true);
    onHash();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [id]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    try {
      localStorage.setItem(PREFIX + id, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  return (
    <section id={id} className="scroll-mt-24">
      <div className={`${open ? "mb-5" : ""} flex flex-wrap items-end justify-between gap-3`}>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={`${id}-body`}
          className="group flex items-end gap-3 text-left"
        >
          <span>
            <span className="block text-xs font-semibold uppercase tracking-[0.2em] text-sky-300/80">{eyebrow}</span>
            <span className="mt-1 block text-2xl font-semibold text-white group-hover:text-sky-100 sm:text-3xl" role="heading" aria-level={2}>
              {title}
            </span>
          </span>
          <ChevronDown
            className={`mb-1.5 h-6 w-6 shrink-0 text-slate-400 transition-transform group-hover:text-white ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>
        {open && actions}
      </div>
      {open && <div id={`${id}-body`}>{children}</div>}
    </section>
  );
}
