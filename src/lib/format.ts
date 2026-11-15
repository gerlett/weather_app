import { getLang, locale, tr } from "./i18n";

const nf = (digits: number) => new Intl.NumberFormat(locale(), { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const fmt = (v: number | null | undefined, digits = 1) => {
  if (v == null || Number.isNaN(v)) return "–";
  const r = Number(v.toFixed(digits));
  return nf(digits).format(r === 0 ? 0 : r); // avoid "-0"
};

const COMPASS_DE = ["N", "NNO", "NO", "ONO", "O", "OSO", "SO", "SSO", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
const COMPASS_EN = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
export const compassPoints = () => (getLang() === "de" ? COMPASS_DE : COMPASS_EN);
export const compass = (deg: number | null | undefined) => (deg == null ? "–" : compassPoints()[Math.round(deg / 22.5) % 16]);

export const time = (iso: string) => new Date(iso).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" });
export const weekday = (iso: string, long = false) =>
  new Date(iso).toLocaleDateString(locale(), { weekday: long ? "long" : "short" });
export const dayMonth = (iso: string) => new Date(iso).toLocaleDateString(locale(), { day: "2-digit", month: "2-digit" });
export const fullDate = (iso: string) =>
  new Date(iso).toLocaleDateString(locale(), { day: "2-digit", month: "2-digit", year: "numeric" });

const MONTHS_DE = ["Jän", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** Short month names of the active language. */
export const months = () => (getLang() === "de" ? MONTHS_DE : MONTHS_EN);

/** Beaufort scale for wind speed in km/h */
export function beaufort(kmh: number) {
  const limits = [1, 6, 12, 20, 29, 39, 50, 62, 75, 89, 103, 118];
  const de = ["Windstille", "Leiser Zug", "Leichte Brise", "Schwache Brise", "Mäßige Brise", "Frische Brise", "Starker Wind", "Steifer Wind", "Stürmischer Wind", "Sturm", "Schwerer Sturm", "Orkanartiger Sturm", "Orkan"];
  const en = ["Calm", "Light air", "Light breeze", "Gentle breeze", "Moderate breeze", "Fresh breeze", "Strong breeze", "Near gale", "Gale", "Strong gale", "Storm", "Violent storm", "Hurricane"];
  const i = limits.findIndex((l) => kmh < l);
  const bft = i === -1 ? 12 : i;
  return { bft, name: (getLang() === "de" ? de : en)[bft] };
}

export function uvLabel(uv: number | null | undefined) {
  if (uv == null) return "–";
  if (uv < 3) return tr("Niedrig", "Low");
  if (uv < 6) return tr("Mäßig", "Moderate");
  if (uv < 8) return tr("Hoch", "High");
  if (uv < 11) return tr("Sehr hoch", "Very high");
  return tr("Extrem", "Extreme");
}
