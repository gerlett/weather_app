"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { useLang } from "@/lib/i18n";

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
  useLang(); // re-render on a language switch (titles come from the parent)
  const [open, setOpen] = useState(defaultOpen);

  // Opened by a jump link rather than by the user: the next jump elsewhere closes it again.
  const jumpOpened = useRef(false);

  // read stored state after mount (static export: no localStorage during prerender)
  useEffect(() => {
    const stored = () => {
      try {
        const v = localStorage.getItem(PREFIX + id);
        return v === "1" ? true : v === "0" ? false : defaultOpen;
      } catch {
        return defaultOpen;
      }
    };
    // A re-run of this effect (dev Strict Mode) must not undo a jump that already
    // opened the section and dropped the hash.
    setOpen(jumpOpened.current || stored());
    // A jump link (/#id) opens the section once; the hash is dropped afterwards so the
    // section, when it appears again later (e.g. after switching to a place without a
    // station and back), follows only the stored state. A jump to any other section
    // (including "Aktuell") returns a jump-opened section to its stored state, so menu
    // clicks don't leave a trail of open sections behind; sections stored as open stay open.
    // Read the hash from the event: the target section's listener may already have
    // dropped it from the URL before this one runs.
    const onHash = (e?: HashChangeEvent) => {
      const hash = e ? new URL(e.newURL).hash : window.location.hash;
      if (hash !== `#${id}`) {
        if (hash && jumpOpened.current) {
          jumpOpened.current = false;
          setOpen(stored());
        }
        return;
      }
      jumpOpened.current = true;
      setOpen(true);
      history.replaceState(history.state, "", window.location.pathname + window.location.search);
    };
    onHash();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [id, defaultOpen]);

  const toggle = () => {
    jumpOpened.current = false; // the user decided; a later jump leaves it alone
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
