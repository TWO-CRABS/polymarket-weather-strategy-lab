/**
 * shared/cityEvents.js
 *
 * 根据城市 + 观察日生成 Polymarket 官方事件 slug/URL。
 * 仅用于入口链接；实际 market/event 仍以后端发现结果为准。
 */

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

const CITY_SLUG_OVERRIDES = Object.freeze({
  "New York City": "nyc",
  NYC: "nyc",
  "São Paulo": "sao-paulo",
  "Sao Paulo": "sao-paulo",
  "Seoul (Incheon)": "seoul",
});

/** Lowercase, strip accents/punctuation, hyphenate. */
export function citySlug(cityName) {
  const name = String(cityName || "").trim();
  if (!name) return "";
  return (CITY_SLUG_OVERRIDES[name] || name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Official Polymarket event slug for a city's high-temperature event.
 * @param {string} cityName
 * @param {string} dateKey YYYY-MM-DD (UTC observation date key)
 * @returns {string|null}
 */
export function cityEventSlug(cityName, dateKey) {
  const slugCity = citySlug(cityName);
  if (!slugCity) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey || ""));
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  if (!Number.isInteger(day) || day < 1 || day > 31) return null;
  return `highest-temperature-in-${slugCity}-on-${MONTHS[month - 1]}-${day}-${year}`;
}

/** Official event URL for a city/date, or null when inputs are incomplete. */
export function cityEventUrl(cityName, dateKey, locale = "zh") {
  const slug = cityEventSlug(cityName, dateKey);
  if (!slug) return null;
  return `https://polymarket.com/${locale}/event/${encodeURIComponent(slug)}`;
}
