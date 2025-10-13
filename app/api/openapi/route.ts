import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import yaml from "js-yaml";
import { withApiHandler } from "@/lib/api-handler";

const specPath = path.join(process.cwd(), "docs", "openapi.yaml");

let cachedYaml: string | null = null;
let cachedJson: unknown;

async function loadSpec() {
  if (process.env.NODE_ENV !== "production") {
    const yamlString = await readFile(specPath, "utf8");
    return { yaml: yamlString, json: yaml.load(yamlString) };
  }

  if (!cachedYaml || !cachedJson) {
    const yamlString = await readFile(specPath, "utf8");
    cachedYaml = yamlString;
    cachedJson = yaml.load(yamlString);
  }

  return { yaml: cachedYaml, json: cachedJson };
}

export const GET = withApiHandler(
  async (req) => {
    const format = req.nextUrl.searchParams.get("format") ?? "json";
    const { yaml: yamlString, json } = await loadSpec();

    if (format.toLowerCase() === "yaml") {
      return new NextResponse(yamlString, {
        headers: {
          "content-type": "application/yaml; charset=utf-8",
          "cache-control": "public, max-age=60",
        },
      });
    }

    return NextResponse.json(json, {
      headers: {
        "cache-control": "public, max-age=60",
      },
    });
  },
  { requireAuth: false },
);
