import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { tr } from "@/lib/i18n";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 rounded-2xl bg-white/[0.04] p-5 ring-1 ring-white/10 backdrop-blur-sm ${className}`}>{children}</div>
  );
}

export function SectionTitle({ id, eyebrow, title, children }: { id?: string; eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <div id={id} className="mb-5 flex scroll-mt-24 flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300/80">{eyebrow}</p>
        <h2 className="mt-1 text-2xl font-semibold text-white sm:text-3xl">{title}</h2>
      </div>
      {children}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = "md",
}: {
  value: T;
  options: { value: T; label: string; icon?: LucideIcon }[];
  onChange: (v: T) => void;
  size?: "sm" | "md";
}) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-xl bg-white/5 p-1 ring-1 ring-white/10" role="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`inline-flex items-center gap-1.5 rounded-lg font-medium transition ${
              size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm"
            } ${active ? "bg-sky-500 text-white shadow" : "text-slate-300 hover:bg-white/10 hover:text-white"}`}
          >
            {o.icon && <o.icon className="h-4 w-4" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Stat({ label, value, unit, sub }: { label: string; value: string; unit?: string; sub?: ReactNode }) {
  return (
    <div className="rounded-xl bg-white/[0.04] p-3 ring-1 ring-white/10">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-white">
        {value}
        {unit && <span className="ml-1 text-sm font-normal text-slate-400">{unit}</span>}
      </p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-white/[0.06] ${className}`} />;
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <div className="rounded-xl bg-rose-500/10 p-4 text-sm text-rose-200 ring-1 ring-rose-400/30">
      {tr("Daten konnten nicht geladen werden", "Data could not be loaded")}: {message}
    </div>
  );
}

/** Shared Recharts styling for the dark theme */
export const chartTheme = {
  grid: "rgba(255,255,255,0.08)",
  axis: "#94a3b8",
  tooltip: {
    contentStyle: { background: "#0f172a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, color: "#e2e8f0" },
    labelStyle: { color: "#94a3b8" },
  },
};

/** Distinct series colours for location comparison (validated against the dark background). */
export const SERIES_COLORS = ["#38bdf8", "#f59e0b", "#a78bfa", "#34d399", "#f472b6", "#22d3ee"];
