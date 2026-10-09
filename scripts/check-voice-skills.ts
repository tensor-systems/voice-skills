// Checks voice-skills.json and, for each entry, the SKILL.md on GitHub
// (readable frontmatter, matching name). Exits 1 on an error; warnings don't fail it.
//
//   npm run check
//   npm run check -- --local herdr-voice=../path/to/SKILL.md
//
// --local reads that skill's SKILL.md from a file instead of GitHub (for a
// skill whose change isn't merged yet). Repeatable.

import { readFileSync } from "node:fs";
import { checkCatalog, checkSkill, rawSkillUrl, type SkillCheck } from "./voice-skills.ts";

const CATALOG = new URL("../voice-skills.json", import.meta.url);

function parseArgs(argv: string[]): Map<string, string> {
  const local = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const value = argv[i] === "--local" ? argv[++i] : undefined;
    const eq = value?.indexOf("=") ?? -1;
    if (value === undefined || eq < 1) {
      console.error("usage: check-voice-skills.ts [--local <name>=<path to SKILL.md>]...");
      process.exit(2);
    }
    local.set(value.slice(0, eq), value.slice(eq + 1));
  }
  return local;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`GET ${url}: ${response.status}`);
  return response.text();
}

const local = parseArgs(process.argv.slice(2));
const catalog = checkCatalog(JSON.parse(readFileSync(CATALOG, "utf8")));
if (!catalog.ok) {
  for (const error of catalog.errors) console.error(`voice-skills.json: ${error}`);
  process.exit(1);
}

let failed = false;
for (const entry of catalog.value.skills) {
  const path = local.get(entry.name);
  const source = path ?? rawSkillUrl(entry.install);
  let check: SkillCheck;
  try {
    check = checkSkill(entry, path ? readFileSync(path, "utf8") : await fetchText(source));
  } catch (e) {
    check = { errors: [e instanceof Error ? e.message : String(e)], warnings: [] };
  }
  if (check.errors.length) failed = true;
  console.log(`${check.errors.length ? "✗" : "✓"} ${entry.name} (${source})`);
  for (const error of check.errors) console.error(`    ${error}`);
  for (const warning of check.warnings) console.log(`    warning: ${warning}`);
}
for (const name of local.keys()) {
  if (!catalog.value.skills.some((s) => s.name === name)) {
    console.error(`--local ${name}: not in the catalog`);
    failed = true;
  }
}
process.exit(failed ? 1 : 0);
