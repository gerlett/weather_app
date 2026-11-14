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

type Info = { label: string; icon: LucideIcon; nightIcon?: LucideIcon; tone: "clear" | "cloud" | "rain" | "snow" | "storm" | "fog" };

/** WMO weather interpretation codes → German label + icon */
const CODES: Record<number, Info> = {
  0: { label: "Klar", icon: Sun, nightIcon: Moon, tone: "clear" },
  1: { label: "Überwiegend klar", icon: Sun, nightIcon: Moon, tone: "clear" },
  2: { label: "Teilweise bewölkt", icon: CloudSun, nightIcon: CloudMoon, tone: "cloud" },
  3: { label: "Bedeckt", icon: Cloud, tone: "cloud" },
  45: { label: "Nebel", icon: CloudFog, tone: "fog" },
  48: { label: "Raureifnebel", icon: CloudFog, tone: "fog" },
  51: { label: "Leichter Nieselregen", icon: CloudDrizzle, tone: "rain" },
  53: { label: "Nieselregen", icon: CloudDrizzle, tone: "rain" },
  55: { label: "Starker Nieselregen", icon: CloudDrizzle, tone: "rain" },
  56: { label: "Gefrierender Niesel", icon: CloudDrizzle, tone: "snow" },
  57: { label: "Gefrierender Niesel", icon: CloudDrizzle, tone: "snow" },
  61: { label: "Leichter Regen", icon: CloudRain, tone: "rain" },
  63: { label: "Regen", icon: CloudRain, tone: "rain" },
  65: { label: "Starker Regen", icon: CloudRain, tone: "rain" },
  66: { label: "Gefrierender Regen", icon: CloudRain, tone: "snow" },
  67: { label: "Gefrierender Regen", icon: CloudRain, tone: "snow" },
  71: { label: "Leichter Schneefall", icon: CloudSnow, tone: "snow" },
  73: { label: "Schneefall", icon: CloudSnow, tone: "snow" },
  75: { label: "Starker Schneefall", icon: Snowflake, tone: "snow" },
  77: { label: "Schneegriesel", icon: CloudSnow, tone: "snow" },
  80: { label: "Regenschauer", icon: CloudRain, tone: "rain" },
  81: { label: "Regenschauer", icon: CloudRain, tone: "rain" },
  82: { label: "Heftige Schauer", icon: CloudRain, tone: "rain" },
  85: { label: "Schneeschauer", icon: CloudSnow, tone: "snow" },
  86: { label: "Starke Schneeschauer", icon: CloudSnow, tone: "snow" },
  95: { label: "Gewitter", icon: CloudLightning, tone: "storm" },
  96: { label: "Gewitter mit Hagel", icon: CloudLightning, tone: "storm" },
  99: { label: "Schweres Gewitter mit Hagel", icon: CloudLightning, tone: "storm" },
};

export function weatherInfo(code: number | null | undefined, isDay = true) {
  const info = CODES[code ?? -1] ?? { label: "Unbekannt", icon: Cloud, tone: "cloud" as const };
  return { ...info, Icon: !isDay && info.nightIcon ? info.nightIcon : info.icon };
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
