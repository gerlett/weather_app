"use client";

import { useState } from "react";
import { Timer } from "lucide-react";
import { addDays, ARCHIVE_START, isoDate } from "@/lib/openmeteo";
import { fullDate, MONTHS, time, weekday } from "@/lib/format";

export type Group = "hour" | "h3" | "h6" | "h12" | "day" | "week" | "month" | "year";

const pad = (n: number) => String(n).padStart(2, "0");
/** Date → value for <input type="datetime-local"> (local time) */
export const toInput = (d: Date) => `${isoDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export function presets() {
  const now = new Date();
  const today = startOfDay(now);
  return [
    { label: "Heute", start: today, end: now },
    { label: "Gestern", start: addDays(today, -1), end: today },
    { label: "Letzte 24 h", start: new Date(now.getTime() - 24 * 3600_000), end: now },
    { label: "Letzte 7 Tage", start: addDays(today, -7), end: now },
    { label: "Dieser Monat", start: new Date(now.getFullYear(), now.getMonth(), 1), end: now },
    { label: "Letzter Monat", start: new Date(now.getFullYear(), now.getMonth() - 1, 1), end: new Date(now.getFullYear(), now.getMonth(), 1) },
    { label: "Dieses Jahr", start: new Date(now.getFullYear(), 0, 1), end: now },
  ];
}

const HOURS_PER: Partial<Record<Group, number>> = { hour: 1, h3: 3, h6: 6, h12: 12 };

/**
 * Bucket key = local start of the interval.
 * `shiftHour`: accumulated values (rain) at stamp t belong to the hour (t-1h … t), so attribute them to t-1h.
 */
export function groupKey(t: string, g: Group, shiftHour: boolean) {
  const d = shiftHour ? new Date(new Date(t).getTime() - 3600_000) : new Date(t);
  const n = HOURS_PER[g];
  if (n) return `${isoDate(d)}T${pad(Math.floor(d.getHours() / n) * n)}:00`;
  if (g === "day") return isoDate(d);
  if (g === "week") return isoDate(addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -((d.getDay() + 6) % 7))); // Monday
  if (g === "month") return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  return String(d.getFullYear());
}

export function bucketLabel(key: string, g: Group, long = false) {
  const n = HOURS_PER[g];
  if (n) {
    const from = new Date(key);
    const to = new Date(from.getTime() + n * 3600_000);
    const range = n === 1 ? time(key) : `${time(key)}–${time(to.toISOString())}`;
    if (!long) return from.getHours() === 0 ? `${key.slice(8, 10)}.${key.slice(5, 7)}.` : time(key);
    return `${weekday(key)} ${fullDate(key)} ${n === 1 ? `${time(key)}–${time(to.toISOString())}` : range}`;
  }
  if (g === "day") return long ? `${weekday(key)} ${fullDate(key)}` : `${key.slice(8, 10)}.${key.slice(5, 7)}.`;
  if (g === "week") {
    const end = addDays(new Date(key), 6);
    return long ? `Woche ${fullDate(key)} – ${fullDate(isoDate(end))}` : `KW ${isoWeek(new Date(key))}`;
  }
  if (g === "month") {
    const [y, m] = key.split("-");
    return `${MONTHS[Number(m) - 1]} ${long ? y : y.slice(2)}`;
  }
  return key;
}

function isoWeek(d: Date) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - y0.getTime()) / 86400000 + 1) / 7);
}

export function downloadCsv(filename: string, lines: string[]) {
  const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export const GROUP_OPTIONS: { value: Group; label: string }[] = [
  { value: "hour", label: "1 h" },
  { value: "h3", label: "3 h" },
  { value: "h6", label: "6 h" },
  { value: "h12", label: "12 h" },
  { value: "day", label: "Tag" },
  { value: "week", label: "Woche" },
  { value: "month", label: "Monat" },
  { value: "year", label: "Jahr" },
];

/** Rough bucket count, used to grey out intervals that would produce too many/too few bars. */
export function bucketCount(hours: number, g: Group) {
  const per: Record<Group, number> = { hour: 1, h3: 3, h6: 6, h12: 12, day: 24, week: 168, month: 730, year: 8760 };
  return Math.ceil(hours / per[g]);
}

export function IntervalPicker({ span }: { span: Span }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="flex items-center gap-1 text-xs uppercase tracking-wider text-slate-500">
        <Timer className="h-3.5 w-3.5" /> Intervall
      </span>
      <div className="inline-flex flex-wrap gap-1 rounded-xl bg-white/5 p-1 ring-1 ring-white/10" role="tablist">
        {GROUP_OPTIONS.map((o) => {
          const n = bucketCount(span.spanHours, o.value);
          const disabled = n > 3000;
          const active = span.group === o.value;
          return (
            <button
              key={o.value}
              role="tab"
              aria-selected={active}
              disabled={disabled}
              title={disabled ? "Zu viele Intervalle für diesen Zeitraum" : `${n} Intervall${n === 1 ? "" : "e"}`}
              onClick={() => span.setGroup(o.value)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-30 ${
                active ? "bg-sky-500 text-white shadow" : "text-slate-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Shared state for a start/end date-time span with an aggregation level. */
export function useSpan(defaultGroup: (hours: number) => Group) {
  const initial = presets()[3];
  const [startStr, setStartStr] = useState(toInput(initial.start));
  const [endStr, setEndStr] = useState(toInput(initial.end));
  const [groupOverride, setGroupOverride] = useState<Group | null>(null);

  const start = new Date(startStr);
  const end = new Date(endStr);
  const valid = !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end > start;
  const spanHours = valid ? (end.getTime() - start.getTime()) / 3600_000 : 0;
  const group = groupOverride ?? defaultGroup(spanHours);

  return {
    startStr,
    endStr,
    start,
    end,
    valid,
    spanHours,
    group,
    setGroup: setGroupOverride,
    setStart: (v: string) => {
      setStartStr(v);
      setGroupOverride(null);
    },
    setEnd: (v: string) => {
      setEndStr(v);
      setGroupOverride(null);
    },
    setRange: (s: Date, e: Date) => {
      setStartStr(toInput(s));
      setEndStr(toInput(e));
      setGroupOverride(null);
    },
  };
}

export type Span = ReturnType<typeof useSpan>;

export function RangePicker({ span }: { span: Span }) {
  const inputCls =
    "mt-1 block rounded-lg bg-slate-900 px-3 py-2 text-sm text-white ring-1 ring-white/10 [color-scheme:dark] focus:outline-none focus:ring-sky-400";
  return (
    <>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-slate-400">
          Von
          <input type="datetime-local" step={3600} min={`${ARCHIVE_START}T00:00`} max={span.endStr} value={span.startStr} onChange={(e) => span.setStart(e.target.value)} className={inputCls} />
        </label>
        <label className="text-xs text-slate-400">
          Bis
          <input type="datetime-local" step={3600} min={span.startStr} max={toInput(new Date())} value={span.endStr} onChange={(e) => span.setEnd(e.target.value)} className={inputCls} />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {presets().map((p) => (
            <button
              key={p.label}
              onClick={() => span.setRange(p.start, p.end)}
              className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-300 ring-1 ring-white/10 hover:bg-sky-500/20 hover:text-white"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      {!span.valid && <p className="mt-4 text-sm text-amber-300">Bitte einen gültigen Zeitraum wählen (Ende nach Beginn).</p>}
    </>
  );
}
