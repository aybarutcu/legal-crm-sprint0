import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

const src = path.join(process.cwd(), "docs", "openapi.yaml");
const dest = path.join(process.cwd(), "public", "openapi.json");

if (!fs.existsSync(src)) {
  throw new Error(`OpenAPI source not found at ${src}`);
}

const yamlContent = fs.readFileSync(src, "utf8");
const doc = yaml.load(yamlContent);

fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify(doc, null, 2));

console.log(`✅ Wrote ${dest}`);
