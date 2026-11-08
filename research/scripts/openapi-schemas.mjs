import fs from "node:fs";
const j = JSON.parse(fs.readFileSync(new URL("../samples/data-openapi.json", import.meta.url), "utf8"));
for (const n of ["Trade", "PricePoint", "Pagination"]) {
  console.log(`\n######## ${n}\n` + JSON.stringify(j.components.schemas[n], null, 1));
}
