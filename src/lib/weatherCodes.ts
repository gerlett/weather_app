import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  Moon,
  Snowflake,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { tr } from "./i18n";

type Info = { label: string; en: string; icon: LucideIcon; nightIcon?: LucideIcon; tone: "clear" | "cloud" | "rain" | "snow" | "storm" | "fog" };

/** WMO weather interpretation codes → German/English label + icon */
const CODES: Record<number, Info> = {
  0: { label: "Klar", en: "Clear", icon: Sun, nightIcon: Moon, tone: "clear" },
  1: { label: "Überwiegend klar", en: "Mainly clear", icon: Sun, nightIcon: Moon, tone: "clear" },
  2: { label: "Teilweise bewölkt", en: "Partly cloudy", icon: CloudSun, nightIcon: CloudMoon, tone: "cloud" },
  3: { label: "Bedeckt", en: "Overcast", icon: Cloud, tone: "cloud" },
  45: { label: "Nebel", en: "Fog", icon: CloudFog, tone: "fog" },
  48: { label: "Raureifnebel", en: "Rime fog", icon: CloudFog, tone: "fog" },
  51: { label: "Leichter Nieselregen", en: "Light drizzle", icon: CloudDrizzle, tone: "rain" },
  53: { label: "Nieselregen", en: "Drizzle", icon: CloudDrizzle, tone: "rain" },
  55: { label: "Starker Nieselregen", en: "Dense drizzle", icon: CloudDrizzle, tone: "rain" },
  56: { label: "Gefrierender Niesel", en: "Freezing drizzle", icon: CloudDrizzle, tone: "snow" },
  57: { label: "Gefrierender Niesel", en: "Freezing drizzle", icon: CloudDrizzle, tone: "snow" },
  61: { label: "Leichter Regen", en: "Light rain", icon: CloudRain, tone: "rain" },
  63: { label: "Regen", en: "Rain", icon: CloudRain, tone: "rain" },
  65: { label: "Starker Regen", en: "Heavy rain", icon: CloudRain, tone: "rain" },
  66: { label: "Gefrierender Regen", en: "Freezing rain", icon: CloudRain, tone: "snow" },
  67: { label: "Gefrierender Regen", en: "Freezing rain", icon: CloudRain, tone: "snow" },
  71: { label: "Leichter Schneefall", en: "Light snow", icon: CloudSnow, tone: "snow" },
  73: { label: "Schneefall", en: "Snow", icon: CloudSnow, tone: "snow" },
  75: { label: "Starker Schneefall", en: "Heavy snow", icon: Snowflake, tone: "snow" },
  77: { label: "Schneegriesel", en: "Snow grains", icon: CloudSnow, tone: "snow" },
  80: { label: "Regenschauer", en: "Rain showers", icon: CloudRain, tone: "rain" },
  81: { label: "Regenschauer", en: "Rain showers", icon: CloudRain, tone: "rain" },
  82: { label: "Heftige Schauer", en: "Violent showers", icon: CloudRain, tone: "rain" },
  85: { label: "Schneeschauer", en: "Snow showers", icon: CloudSnow, tone: "snow" },
  86: { label: "Starke Schneeschauer", en: "Heavy snow showers", icon: CloudSnow, tone: "snow" },
  95: { label: "Gewitter", en: "Thunderstorm", icon: CloudLightning, tone: "storm" },
  96: { label: "Gewitter mit Hagel", en: "Thunderstorm with hail", icon: CloudLightning, tone: "storm" },
  99: { label: "Schweres Gewitter mit Hagel", en: "Severe thunderstorm with hail", icon: CloudLightning, tone: "storm" },
};

export function weatherInfo(code: number | null | undefined, isDay = true) {
  const info = CODES[code ?? -1] ?? { label: "Unbekannt", en: "Unknown", icon: Cloud, tone: "cloud" as const };
  return { ...info, label: tr(info.label, info.en), Icon: !isDay && info.nightIcon ? info.nightIcon : info.icon };
}

/** Hero background gradient per weather tone */
export const TONE_BG: Record<Info["tone"] | "night", string> = {
  clear: "from-sky-500 via-sky-600 to-indigo-700",
  cloud: "from-slate-500 via-slate-600 to-slate-800",
  rain: "from-slate-600 via-blue-800 to-slate-900",
  snow: "from-slate-300 via-sky-500 to-slate-700",
  storm: "from-slate-700 via-violet-900 to-slate-950",
  fog: "from-slate-400 via-slate-500 to-slate-700",
  night: "from-indigo-900 via-slate-900 to-slate-950",
};
