/**
 * METAR signal-source comparison catalog, derived from
 * PolyMarket Temperature Tracking/data/summary-rows.json and the 49 city reports.
 *
 * Categories:
 *   national = national meteorological source
 *   other    = non-METAR public observation (SWOB-ML)
 *   noaa     = NWS tgftp single-station file
 *   none     = only AWC is available (baseline)
 *
 * The comparison intentionally polls a representative subset of NOAA/none
 * cities. Polling all 49 station files near every node would create excessive
 * load; AWC itself is never polled by this module (the central node poller
 * already owns the AWC budget).
 */
export const METAR_SOURCE_CATEGORIES = Object.freeze(["national", "other", "noaa", "none"]);

export const METAR_SOURCE_CITIES = Object.freeze([
  {
    city: "Istanbul",
    station: "LTFM",
    category: "national",
    adapter: "mgm",
    params: { ilPlaka: 34, istNo: 17058 },
  },
  {
    city: "Ankara",
    station: "LTAC",
    category: "national",
    adapter: "mgm",
    params: { ilPlaka: 6, istNo: 17128 },
  },
  {
    city: "Cape Town",
    station: "FACT",
    category: "national",
    adapter: "saws",
  },
  {
    city: "Manila",
    station: "RPLL",
    category: "national",
    adapter: "pagasa",
  },
  {
    city: "Toronto",
    station: "CYYZ",
    category: "other",
    adapter: "swob",
  },
  {
    city: "Tel Aviv",
    station: "LLBG",
    category: "noaa",
    adapter: "tgftp",
  },
  {
    city: "Madrid",
    station: "LEMD",
    category: "noaa",
    adapter: "tgftp",
  },
  {
    city: "Moscow",
    station: "UUWW",
    category: "noaa",
    adapter: "tgftp",
  },
  {
    city: "Taipei",
    station: "RCSS",
    category: "none",
    adapter: "none",
  },
]);

export function sourceCatalogForCity(city) {
  return METAR_SOURCE_CITIES.find((entry) => entry.city === city) || null;
}
