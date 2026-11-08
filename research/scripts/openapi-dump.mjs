import fs from "node:fs";
const j = JSON.parse(fs.readFileSync(new URL("../samples/data-openapi.json", import.meta.url), "utf8"));
for (const p of ["/v2/trades", "/v2/prices-history", "/v2/tokens"]) {
  const g = j.paths[p].get;
  console.log(`\n######## ${p}\n${g.description}`);
  console.log("PARAMS:");
  for (const q of g.parameters ?? []) {
    const sc = q.schema ?? {};
    console.log(` - ${q.name} [${sc.type ?? (sc.oneOf ? "oneOf" : "")}${q.required ? " required" : ""}] ${q.description ?? ""}`.replace(/\s+/g, " ").slice(0, 400));
  }
  const r = g.responses["200"].content["application/json"].schema;
  const name = (r.$ref ?? "").split("/").pop();
  const s = name ? j.components.schemas[name] : r;
  console.log("RESPONSE SCHEMA:", JSON.stringify(s, null, 1).slice(0, 5000));
}
