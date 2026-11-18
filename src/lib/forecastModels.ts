/**
 * Free forecast models served by Open-Meteo. No API key is needed and the
 * existing same-origin /api/om proxy passes the `models` parameter through.
 * Every entry was checked to return the variables this app uses for the
 * selected location (a few models have no UV – the UI already handles that).
 */
import { tr } from "./i18n";

export const FORECAST_MODELS = [
  { value: "best_match", de: "Best Match (Open-Meteo)", en: "Best match (Open-Meteo)" },
  { value: "icon_seamless", de: "ICON · DWD (Europa)", en: "ICON · DWD (Europe)" },
  { value: "icon_eu", de: "ICON EU (hohe Auflösung)", en: "ICON EU (high resolution)" },
  { value: "ecmwf_ifs025", de: "ECMWF IFS 0,25°", en: "ECMWF IFS 0.25°" },
  { value: "gfs_seamless", de: "GFS · NOAA", en: "GFS · NOAA" },
  { value: "meteofrance_seamless", de: "Météo-France", en: "Météo-France" },
  { value: "metno_seamless", de: "MET Norway", en: "MET Norway" },
  { value: "ukmo_seamless", de: "UK Met Office", en: "UK Met Office" },
  { value: "knmi_seamless", de: "KNMI", en: "KNMI" },
] as const;

export type ForecastModel = (typeof FORECAST_MODELS)[number]["value"];

export const modelLabel = (model: ForecastModel) => {
  const found = FORECAST_MODELS.find((m) => m.value === model) ?? FORECAST_MODELS[0];
  return tr(found.de, found.en);
};

export const isForecastModel = (value: unknown): value is ForecastModel => FORECAST_MODELS.some((m) => m.value === value);
