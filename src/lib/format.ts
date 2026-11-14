const nf = (digits: number) => new Intl.NumberFormat("de-AT", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const fmt = (v: number | null | undefined, digits = 1) => {
  if (v == null || Number.isNaN(v)) return "–";
  const r = Number(v.toFixed(digits));
  return nf(digits).format(r === 0 ? 0 : r); // avoid "-0"
};

export const COMPASS = ["N", "NNO", "NO", "ONO", "O", "OSO", "SO", "SSO", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
export const compass = (deg: number | null | undefined) => (deg == null ? "–" : COMPASS[Math.round(deg / 22.5) % 16]);

export const time = (iso: string) => new Date(iso).toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" });
export const weekday = (iso: string, long = false) =>
  new Date(iso).toLocaleDateString("de-AT", { weekday: long ? "long" : "short" });
export const dayMonth = (iso: string) => new Date(iso).toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit" });
export const fullDate = (iso: string) =>
  new Date(iso).toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" });

export const MONTHS = ["Jän", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

/** Beaufort scale for wind speed in km/h */
export function beaufort(kmh: number) {
  const limits = [1, 6, 12, 20, 29, 39, 50, 62, 75, 89, 103, 118];
  const names = ["Windstille", "Leiser Zug", "Leichte Brise", "Schwache Brise", "Mäßige Brise", "Frische Brise", "Starker Wind", "Steifer Wind", "Stürmischer Wind", "Sturm", "Schwerer Sturm", "Orkanartiger Sturm", "Orkan"];
  const i = limits.findIndex((l) => kmh < l);
  const bft = i === -1 ? 12 : i;
  return { bft, name: names[bft] };
}

export function uvLabel(uv: number | null | undefined) {
  if (uv == null) return "–";
  if (uv < 3) return "Niedrig";
  if (uv < 6) return "Mäßig";
  if (uv < 8) return "Hoch";
  if (uv < 11) return "Sehr hoch";
  return "Extrem";
}
