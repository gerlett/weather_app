export type WeatherLocation = {
  /** Stable identifier used for persistence (localStorage). */
  id: string;
  name: string;
  region: string;
  country?: string;
  latitude: number;
  longitude: number;
  /** AWEKAS station ID – if set, the official live widget of the physical station is shown. */
  awekasId?: number;
  /** Station page on wetter-strudengau.at, if one exists. */
  sourceUrl?: string;
  /** "station" = regional station of the Wetter-Strudengau network, "place" = any searched place. */
  kind: "station" | "place";
};

const SITE = "https://www.wetter-strudengau.at/wetter-news";

/**
 * Regional stations of the Wetter-Strudengau network.
 * Coordinates are the respective municipalities (approximate station position).
 * Add `awekasId` once the AWEKAS station ID of a station is known – the dashboard
 * then shows the station's official live widget next to the model data.
 */
export const REGIONAL_STATIONS: WeatherLocation[] = [
  { id: "perg-thurnhof", name: "Perg / Thurnhof", region: "Oberösterreich", country: "AT", latitude: 48.2505, longitude: 14.6336, awekasId: 12182, sourceUrl: `${SITE}/wetterstation-pergturnhof/`, kind: "station" },
  { id: "grein", name: "Grein", region: "Oberösterreich", country: "AT", latitude: 48.2283, longitude: 14.8547, sourceUrl: `${SITE}/wetterstation-grein/`, kind: "station" },
  { id: "pabneukirchen", name: "Pabneukirchen", region: "Oberösterreich", country: "AT", latitude: 48.3197, longitude: 14.8097, sourceUrl: `${SITE}/wetterstation-pabneukirchen/`, kind: "station" },
  { id: "st-georgen-walde", name: "St. Georgen am Walde", region: "Oberösterreich", country: "AT", latitude: 48.3567, longitude: 14.8942, sourceUrl: `${SITE}/st-georgen-w/`, kind: "station" },
  { id: "waldhausen", name: "Waldhausen im Strudengau", region: "Oberösterreich", country: "AT", latitude: 48.2794, longitude: 14.9386, sourceUrl: `${SITE}/wetterstation-waldhausen/`, kind: "station" },
  { id: "bad-kreuzen", name: "Bad Kreuzen", region: "Oberösterreich", country: "AT", latitude: 48.2647, longitude: 14.8069, sourceUrl: `${SITE}/wetterstation-bad-kreuzen/`, kind: "station" },
  { id: "dimbach", name: "Dimbach", region: "Oberösterreich", country: "AT", latitude: 48.2878, longitude: 14.8925, sourceUrl: `${SITE}/wetterstation-dimbach/`, kind: "station" },
  { id: "naarn", name: "Naarn im Machlande", region: "Oberösterreich", country: "AT", latitude: 48.2244, longitude: 14.6056, sourceUrl: `${SITE}/wetterstation-naarn/`, kind: "station" },
  { id: "ried-riedmark", name: "Ried in der Riedmark", region: "Oberösterreich", country: "AT", latitude: 48.2744, longitude: 14.5294, sourceUrl: `${SITE}/wetterstation-ried-in-der-riedmark/`, kind: "station" },
  { id: "burgstall", name: "Burgstall", region: "Oberösterreich", country: "AT", latitude: 48.2981, longitude: 14.8306, sourceUrl: `${SITE}/wetterstation-burgstall/`, kind: "station" },
];

export const DEFAULT_LOCATION = REGIONAL_STATIONS[0];

export const SITE_LINKS = {
  home: "https://www.wetter-strudengau.at/",
  forecast: "https://www.wetter-strudengau.at/aktuelle-wettervorhersage/",
  webcams: "https://www.wetter-strudengau.at/webcams/",
  radar: "https://www.wetter-strudengau.at/radar/",
  livemap: "https://www.wetter-strudengau.at/wetter-news/livekarte/",
  news: "https://www.wetter-strudengau.at/wetter-news/alle-artikel/",
  statistics: "https://www.wetter-strudengau.at/statistik/",
  extremes: "https://www.wetter-strudengau.at/extremereignisse/",
  media: "https://www.wetter-strudengau.at/strudengauer-wetterfernsehen/",
  station: "https://www.wetter-strudengau.at/startseite/wetterstation/",
};
