"use client";

/** Drag handles + persisted order for the dashboard's weather panels. */
import { GripVertical } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { tr } from "@/lib/i18n";

export const PANEL_KEYS = ["aktuell", "vorhersage", "verlauf", "auswertung", "klima", "station"] as const;
export type PanelKey = (typeof PANEL_KEYS)[number];
const KEY = "wetter-perg:panel-order";

const validOrder = (v: unknown): v is PanelKey[] =>
  Array.isArray(v) &&
  v.every((k) => (PANEL_KEYS as readonly string[]).includes(k as string)) &&
  new Set(v).size === v.length;

export function usePanelOrder() {
  const [order, setOrder] = useState<PanelKey[]>([...PANEL_KEYS]);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(KEY) ?? "null");
      if (validOrder(saved)) setOrder([...saved, ...PANEL_KEYS.filter((k) => !saved.includes(k))]);
    } catch {
      /* ignore */
    }
    setRestored(true);
  }, []);

  useEffect(() => {
    if (!restored) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(order));
    } catch {
      /* ignore */
    }
  }, [order, restored]);

  const move = (from: PanelKey, to: PanelKey) =>
    setOrder((prev) => {
      if (from === to) return prev;
      const next = prev.filter((k) => k !== from);
      const at = next.indexOf(to);
      if (at < 0) return prev;
      next.splice(at, 0, from);
      return next;
    });

  return { order, move };
}

export function SortablePanel({ id, onMove, children }: { id: PanelKey; onMove: (from: PanelKey, to: PanelKey) => void; children: ReactNode }) {
  const [over, setOver] = useState(false);
  const [dragging, setDragging] = useState(false);
  const label = tr("Ziehen zum Sortieren", "Drag to reorder");
  return (
    <div
      className={`relative rounded-xl transition ${over ? "ring-2 ring-sky-400" : ""} ${dragging ? "opacity-40" : ""}`}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const from = e.dataTransfer.getData("text/plain") as PanelKey;
        if (from && from !== id) onMove(from, id);
      }}
    >
      <div className="flex h-5 items-center justify-end px-1">
        <button
          type="button"
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData("text/plain", id);
            e.dataTransfer.effectAllowed = "move";
            setDragging(true);
          }}
          onDragEnd={() => setDragging(false)}
          className="cursor-grab rounded p-0.5 text-slate-600 hover:bg-white/10 hover:text-slate-300 active:cursor-grabbing"
          aria-label={label}
          title={label}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </div>
      {children}
    </div>
  );
}
