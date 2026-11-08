// Probe aviationweather METAR + Open-Meteo forecast used as reference sources.
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SAMPLES = path.join(ROOT, "samples");
const targets = [
  ["metar-zsqd-json", "https://aviationweather.gov/api/data/metar?ids=ZSQD&format=json&hours=24"],
  ["metar-zsqd-raw", "https://aviationweather.gov/api/data/metar?ids=ZSQD&format=raw&hours=6"],
  ["metar-klga-json", "https://aviationweather.gov/api/data/metar?ids=KLGA&format=json&hours=24"],
  ["metar-multi-json", "https://aviationweather.gov/api/data/metar?ids=ZSQD,KLGA,RJTT&format=json&hours=3"],
  ["open-meteo-qingdao", "https://api.open-meteo.com/v1/forecast?latitude=36.27&longitude=120.37&hourly=temperature_2m&forecast_days=3&timezone=auto"],
];
for (const [name, url] of targets) {
  const t0 = Date.now();
  try {
    const r = await fetch(url, { headers: { accept: "application/json,text/plain", "user-agent": "research-probe/1.0" }, signal: AbortSignal.timeout(30000) });
    const text = await r.text();
    await fs.writeFile(path.join(SAMPLES, `${name}.${name.includes("raw") ? "txt" : "json"}`), text);
    console.log(`\n=== ${name} [${r.status}] ${Date.now() - t0}ms ${r.headers.get("content-type")} ${text.length}B`);
    if (name.includes("raw")) { console.log(text.slice(0, 800)); continue; }
    const j = JSON.parse(text);
    if (Array.isArray(j)) {
      console.log(`array len=${j.length}; keys=${Object.keys(j[0] ?? {}).join(",")}`);
      for (const o of j.slice(0, 3)) console.log(JSON.stringify({ station_id: o.station_id ?? o.icaoId, reportTime: o.reportTime, temp: o.temp, dewp: o.dewp, rawOb: o.rawOb?.slice(0, 120) }));
      const temps = j.map((o) => o.temp).filter((x) => typeof x === "number");
      console.log(`temps=${temps.length} min=${Math.min(...temps)} max=${Math.max(...temps)}`);
    } else if (j.hourly) {
      console.log("keys:", Object.keys(j).join(","));
      console.log("units:", JSON.stringify(j.hourly_units), "tz:", j.timezone);
      console.log("times:", j.hourly.time.slice(0, 3), "...", j.hourly.time.at(-1), "n=", j.hourly.time.length);
      console.log("temps:", j.hourly.temperature_2m.slice(0, 6), "max=", Math.max(...j.hourly.temperature_2m));
    } else console.log(text.slice(0, 500));
  } catch (e) {
    console.log(`\n=== ${name} ERROR ${e.message}`);
  }
}
