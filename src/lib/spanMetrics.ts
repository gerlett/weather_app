import {
  CloudRain,
  Cloud,
  Droplets,
  Gauge,
  Snowflake,
  Sun,
  SunMedium,
  Thermometer,
  ThermometerSnowflake,
  Wind,
  Waves,
  type LucideIcon,
} from "lucide-react";

/**
 * Every measurement that can be analysed over a free time span.
 * - `sum`: accumulated values (rain, snow, sunshine) → total per interval + cumulative curve
 * - `stats`: instantaneous values → min / max / average per interval
 */
export type SpanMetric = {
  id: string;
  label: string;
  variable: string; // Open-Meteo hourly variable
  unit: string;
  icon: LucideIcon;
  agg: "sum" | "stats";
  /** multiply raw values (e.g. seconds → hours) */
  scale?: number;
  digits?: number;
  color: string;
  /** optional threshold counters shown as KPIs (counted on hourly values) */
  thresholds?: { label: string; test: (v: number) => boolean; unit?: string }[];
};

export const SPAN_METRICS: SpanMetric[] = [
  {
    id: "temperature",
    label: "Temperatur",
    variable: "temperature_2m",
    unit: "°C",
    icon: Thermometer,
    agg: "stats",
    color: "#f59e0b",
    thresholds: [
      { label: "Froststunden (< 0 °C)", test: (v) => v < 0 },
      { label: "Stunden ≥ 25 °C", test: (v) => v >= 25 },
    ],
  },
  { id: "apparent", label: "Gefühlte Temp.", variable: "apparent_temperature", unit: "°C", icon: ThermometerSnowflake, agg: "stats", color: "#fb923c" },
  { id: "dewpoint", label: "Taupunkt", variable: "dew_point_2m", unit: "°C", icon: Waves, agg: "stats", color: "#2dd4bf" },
  {
    id: "precipitation",
    label: "Niederschlag",
    variable: "precipitation",
    unit: "mm",
    icon: CloudRain,
    agg: "sum",
    color: "#38bdf8",
    thresholds: [{ label: "Regenstunden (≥ 0,1 mm)", test: (v) => v >= 0.1 }],
  },
  { id: "snowfall", label: "Neuschnee", variable: "snowfall", unit: "cm", icon: Snowflake, agg: "sum", color: "#e0f2fe" },
  { id: "humidity", label: "Luftfeuchte", variable: "relative_humidity_2m", unit: "%", icon: Droplets, agg: "stats", digits: 0, color: "#60a5fa" },
  { id: "pressure", label: "Luftdruck", variable: "pressure_msl", unit: "hPa", icon: Gauge, agg: "stats", color: "#a78bfa" },
  {
    id: "wind",
    label: "Wind",
    variable: "wind_speed_10m",
    unit: "km/h",
    icon: Wind,
    agg: "stats",
    color: "#34d399",
    thresholds: [{ label: "Stunden ≥ 6 Bft (39 km/h)", test: (v) => v >= 39 }],
  },
  {
    id: "gusts",
    label: "Windböen",
    variable: "wind_gusts_10m",
    unit: "km/h",
    icon: Wind,
    agg: "stats",
    color: "#f472b6",
    thresholds: [{ label: "Stunden mit Sturmböen (≥ 75 km/h)", test: (v) => v >= 75 }],
  },
  { id: "clouds", label: "Bewölkung", variable: "cloud_cover", unit: "%", icon: Cloud, agg: "stats", digits: 0, color: "#94a3b8" },
  { id: "sunshine", label: "Sonnenschein", variable: "sunshine_duration", unit: "h", icon: Sun, agg: "sum", scale: 1 / 3600, color: "#facc15" },
  { id: "radiation", label: "Globalstrahlung", variable: "shortwave_radiation", unit: "W/m²", icon: SunMedium, agg: "stats", digits: 0, color: "#fde047" },
];

export const spanMetric = (id: string) => SPAN_METRICS.find((m) => m.id === id) ?? SPAN_METRICS[0];
