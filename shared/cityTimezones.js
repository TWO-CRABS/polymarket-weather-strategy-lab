/**
 * shared/cityTimezones.js
 *
 * 城市 → IANA 时区映射，用于策略构建页面按“当前 UTC 偏移”分组选择城市。
 * 只影响 UI 分组与批量选择；不参与运行/结算。
 */

/** @type {Readonly<Record<string, string>>} */
export const CITY_TIMEZONES = Object.freeze({
  Amsterdam: "Europe/Amsterdam",
  Ankara: "Europe/Istanbul",
  Atlanta: "America/New_York",
  Austin: "America/Chicago",
  Beijing: "Asia/Shanghai",
  "Buenos Aires": "America/Argentina/Buenos_Aires",
  Busan: "Asia/Seoul",
  "Cape Town": "Africa/Johannesburg",
  Chengdu: "Asia/Shanghai",
  Chicago: "America/Chicago",
  Chongqing: "Asia/Shanghai",
  Dallas: "America/Chicago",
  Denver: "America/Denver",
  Guangzhou: "Asia/Shanghai",
  Helsinki: "Europe/Helsinki",
  "Hong Kong": "Asia/Hong_Kong",
  Houston: "America/Chicago",
  Istanbul: "Europe/Istanbul",
  Jeddah: "Asia/Riyadh",
  Karachi: "Asia/Karachi",
  "Kuala Lumpur": "Asia/Kuala_Lumpur",
  London: "Europe/London",
  "Los Angeles": "America/Los_Angeles",
  Lucknow: "Asia/Kolkata",
  Madrid: "Europe/Madrid",
  Manila: "Asia/Manila",
  "Mexico City": "America/Mexico_City",
  Miami: "America/New_York",
  Milan: "Europe/Rome",
  Moscow: "Europe/Moscow",
  Munich: "Europe/Berlin",
  "New York City": "America/New_York",
  "Panama City": "America/Panama",
  Paris: "Europe/Paris",
  Qingdao: "Asia/Shanghai",
  "San Francisco": "America/Los_Angeles",
  "São Paulo": "America/Sao_Paulo",
  Seattle: "America/Los_Angeles",
  Seoul: "Asia/Seoul",
  Shanghai: "Asia/Shanghai",
  Shenzhen: "Asia/Shanghai",
  Singapore: "Asia/Singapore",
  Taipei: "Asia/Taipei",
  "Tel Aviv": "Asia/Jerusalem",
  Tokyo: "Asia/Tokyo",
  Toronto: "America/Toronto",
  Warsaw: "Europe/Warsaw",
  Wellington: "Pacific/Auckland",
  Wuhan: "Asia/Shanghai",
});

/** Aliases used by older saved strategies / external market names. */
const CITY_ALIASES = Object.freeze({
  NYC: "New York City",
  "New York": "New York City",
  "Seoul (Incheon)": "Seoul",
  "Sao Paulo": "São Paulo",
  "Tel-Aviv": "Tel Aviv",
  "Cape-town": "Cape Town",
});

/** IANA zone for a city name, or null when unknown. */
export function timezoneForCity(cityName) {
  if (!cityName) return null;
  const name = CITY_ALIASES[cityName] || cityName;
  return CITY_TIMEZONES[name] || null;
}

/**
 * Current UTC offset in minutes for an IANA time zone.
 * Uses Intl's longOffset so DST is handled automatically.
 */
export function offsetMinutesForTimeZone(timeZone, at = new Date()) {
  if (!timeZone) return null;
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "longOffset",
    }).formatToParts(at);
    const raw = parts.find((part) => part.type === "timeZoneName")?.value || "";
    const match = /^GMT(?:([+-])(\d{2}):?(\d{2}))?$/.exec(raw);
    if (!match) return null;
    const sign = match[1] === "-" ? -1 : 1;
    const hours = Number(match[2] || 0);
    const minutes = Number(match[3] || 0);
    return sign * (hours * 60 + minutes);
  } catch {
    return null;
  }
}

/** Format minutes as UTC+08:00 / UTC-05:00. */
export function formatUtcOffset(offsetMinutes) {
  if (!Number.isFinite(offsetMinutes)) return "其他";
  const sign = offsetMinutes < 0 ? "-" : "+";
  const abs = Math.abs(offsetMinutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `UTC${sign}${hh}:${mm}`;
}

/** Local current time (HH:mm) for an IANA zone. */
export function localTimeForTimeZone(timeZone, at = new Date()) {
  if (!timeZone) return "";
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(at);
  } catch {
    return "";
  }
}

/** Local date + time label (e.g. 11月10日 17:42) for an IANA zone. */
export function localDateTimeForTimeZone(timeZone, at = new Date()) {
  if (!timeZone) return "";
  try {
    const parts = new Intl.DateTimeFormat("zh-CN", {
      timeZone,
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(at);
    const pick = (type) => parts.find((part) => part.type === type)?.value || "";
    const month = pick("month");
    const day = pick("day");
    const hour = pick("hour");
    const minute = pick("minute");
    if (!month || !day || !hour || !minute) return "";
    return `${month}月${day}日 ${hour}:${minute}`;
  } catch {
    return "";
  }
}

/**
 * Group cities by their current UTC offset (DST-aware), descending by offset.
 * Unknown/legacy cities go to a final “其他 / 未识别时区” group.
 *
 * @param {Array<{name:string, station?:string}>} cities
 * @param {Date} [at]
 * @returns {Array<{key:string,label:string,offsetMinutes:number|null,localTime:string,cities:Array<{name:string,station?:string}>}>}
 */
export function groupCitiesByTimezone(cities, at = new Date()) {
  const groups = new Map();
  for (const city of Array.isArray(cities) ? cities : []) {
    if (!city || !city.name) continue;
    const zone = timezoneForCity(city.name);
    const offset = zone ? offsetMinutesForTimeZone(zone, at) : null;
    const known = Number.isFinite(offset);
    const key = known ? String(offset) : "unknown";
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        offsetMinutes: known ? offset : null,
        label: known ? formatUtcOffset(offset) : "其他 / 未识别时区",
        timeZone: zone,
        localTime: zone ? localTimeForTimeZone(zone, at) : "",
        localDateTime: zone ? localDateTimeForTimeZone(zone, at) : "",
        cities: [],
      });
    }
    groups.get(key).cities.push({ name: city.name, station: city.station || "" });
  }
  const list = [...groups.values()];
  list.sort((a, b) => {
    if (a.offsetMinutes === null && b.offsetMinutes === null) return 0;
    if (a.offsetMinutes === null) return 1;
    if (b.offsetMinutes === null) return -1;
    return a.offsetMinutes - b.offsetMinutes;
  });
  for (const group of list) {
    group.cities.sort((a, b) => a.name.localeCompare(b.name));
  }
  return list;
}
