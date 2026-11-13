/** One-off migration: derive eventDate from the event slug instead of the UTC anchor. */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EVENTS_DIR = path.join(PROJECT_ROOT, "data", "trader-reactions", "events");
const months = {
  january: "01", february: "02", march: "03", april: "04", may: "05", june: "06",
  july: "07", august: "08", september: "09", october: "10", november: "11", december: "12",
};

function dateFromSlug(slug) {
  const match = /-on-([a-z]+)-(\d{1,2})-(\d{4})$/i.exec(String(slug || ""));
  if (!match) return "";
  const month = months[match[1].toLowerCase()];
  return month ? `${match[3]}-${month}-${String(match[2]).padStart(2, "0")}` : "";
}

let changed = 0;
for (const file of (await fs.readdir(EVENTS_DIR)).filter((name) => name.endsWith(".json"))) {
  const full = path.join(EVENTS_DIR, file);
  let fact;
  try {
    fact = JSON.parse(await fs.readFile(full, "utf8"));
  } catch {
    continue;
  }
  const next = dateFromSlug(fact.slug);
  if (next && fact.eventDate !== next) {
    fact.eventDate = next;
    await fs.writeFile(full, `${JSON.stringify(fact)}\n`, "utf8");
    changed += 1;
  }
}
console.log(`updated ${changed} event dates`);
