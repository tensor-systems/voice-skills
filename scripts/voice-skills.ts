// Validation for the voice skills catalog (voice-skills.json) and the
// `metadata.hark` block in each skill's SKILL.md frontmatter. Pure functions:
// check-voice-skills.ts does the reading and fetching.

import { parse as parseYaml } from "yaml";

export interface CatalogEntry {
  name: string;
  install: string;
  category?: string;
  reviewed: boolean;
}

export interface Catalog {
  version: 1;
  skills: CatalogEntry[];
}

export type Checked<T> = { ok: true; value: T } | { ok: false; errors: string[] };

/** A skill name, category or command: safe to put on a shell command line. */
const TOKEN = /^[A-Za-z0-9._-]+$/;
const isToken = (s: string) => TOKEN.test(s) && s !== "." && s !== "..";

export const MAX_DESCRIPTION = 60;
export const MAX_SUMMARY = 120;
export const MAX_PHRASES = 6;
export const MAX_ROUTING = 300;

const ENTRY_KEYS = new Set(["name", "install", "category", "reviewed"]);

/** Length in Unicode code points, as Hermes (Python) counts it. */
const chars = (s: string) => [...s].length;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** `owner/repo/path/to/skill-dir`, as `hermes skills install` takes it. */
export function isInstallPath(install: string): boolean {
  const parts = install.split("/");
  return parts.length >= 3 && parts.every(isToken);
}

/** Where the skill's SKILL.md lives on GitHub, for an install path `owner/repo/rest`. */
export function rawSkillUrl(install: string): string {
  const [owner, repo, ...rest] = install.split("/");
  return `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/${rest.join("/")}/SKILL.md`;
}

function entryErrors(entry: unknown, at: string): string[] {
  if (!isRecord(entry)) return [`${at}: must be an object`];
  const errors: string[] = [];
  for (const key of Object.keys(entry)) {
    if (!ENTRY_KEYS.has(key)) errors.push(`${at}: unknown field "${key}"`);
  }
  const { name, install, category, reviewed } = entry;
  if (typeof name !== "string" || !isToken(name)) {
    errors.push(`${at}: "name" must be a skill name (letters, digits, ".", "_", "-")`);
  }
  if (typeof install !== "string" || !isInstallPath(install)) {
    errors.push(`${at}: "install" must be a GitHub path owner/repo/path/to/skill-dir`);
  }
  if (category !== undefined && (typeof category !== "string" || !isToken(category))) {
    errors.push(`${at}: "category" must be a category name (letters, digits, ".", "_", "-")`);
  }
  if (typeof reviewed !== "boolean") errors.push(`${at}: "reviewed" must be true or false`);
  return errors;
}

/** The catalog's shape: version 1, and entries with unique names. */
export function checkCatalog(json: unknown): Checked<Catalog> {
  if (!isRecord(json)) return { ok: false, errors: ["catalog must be a JSON object"] };
  const errors: string[] = [];
  for (const key of Object.keys(json)) {
    if (key !== "version" && key !== "skills") errors.push(`catalog: unknown field "${key}"`);
  }
  if (json.version !== 1) errors.push(`catalog: "version" must be 1`);
  if (!Array.isArray(json.skills)) {
    errors.push(`catalog: "skills" must be a list`);
    return { ok: false, errors };
  }
  const seen = new Set<string>();
  json.skills.forEach((entry, i) => {
    const at = `skills[${i}]`;
    errors.push(...entryErrors(entry, at));
    if (isRecord(entry) && typeof entry.name === "string") {
      if (seen.has(entry.name)) errors.push(`${at}: duplicate name "${entry.name}"`);
      seen.add(entry.name);
    }
  });
  return errors.length ? { ok: false, errors } : { ok: true, value: json as unknown as Catalog };
}

const FRONTMATTER = /^﻿?---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

/** The YAML between the leading `---` lines of a SKILL.md, or null if it has none. */
export function frontmatter(skillMd: string): string | null {
  return skillMd.match(FRONTMATTER)?.[1] ?? null;
}

/** `metadata.hark` rules shared with the app (contract section 1). */
export function harkMetadataErrors(hark: unknown): string[] {
  if (!isRecord(hark)) return ["metadata.hark: missing (must be a mapping)"];
  const errors: string[] = [];
  if (hark.voice !== true) errors.push("metadata.hark.voice: must be true");
  const { summary, requires, phrases, routing } = hark;
  if (typeof summary !== "string" || summary.trim() === "") {
    errors.push("metadata.hark.summary: must be a non-empty string");
  } else if (chars(summary) > MAX_SUMMARY) {
    errors.push(`metadata.hark.summary: ${chars(summary)} chars, at most ${MAX_SUMMARY}`);
  }
  if (requires !== undefined) {
    if (!isRecord(requires)) {
      errors.push("metadata.hark.requires: must be a mapping");
    } else if (requires.command !== undefined) {
      if (typeof requires.command !== "string" || !isToken(requires.command)) {
        errors.push(`metadata.hark.requires.command: must match ${TOKEN.source}`);
      }
    }
  }
  if (phrases !== undefined) {
    if (!Array.isArray(phrases)) {
      errors.push("metadata.hark.phrases: must be a list");
    } else {
      if (phrases.length > MAX_PHRASES) {
        errors.push(`metadata.hark.phrases: ${phrases.length} items, at most ${MAX_PHRASES}`);
      }
      if (!phrases.every((p) => typeof p === "string" && p.trim() !== "")) {
        errors.push("metadata.hark.phrases: every item must be a non-empty string");
      }
    }
  }
  if (routing !== undefined) {
    if (typeof routing !== "string") {
      errors.push("metadata.hark.routing: must be a string");
    } else if (chars(routing) > MAX_ROUTING) {
      errors.push(`metadata.hark.routing: ${chars(routing)} chars, at most ${MAX_ROUTING}`);
    }
  }
  return errors;
}

/** Errors in a catalog entry's SKILL.md: its name, description and metadata.hark. */
export function skillErrors(entry: Pick<CatalogEntry, "name">, skillMd: string): string[] {
  const yaml = frontmatter(skillMd);
  if (yaml === null) return ["SKILL.md: no YAML frontmatter"];
  let doc: unknown;
  try {
    doc = parseYaml(yaml);
  } catch (e) {
    return [`SKILL.md: frontmatter is not valid YAML (${e instanceof Error ? e.message : String(e)})`];
  }
  if (!isRecord(doc)) return ["SKILL.md: frontmatter must be a mapping"];
  const errors: string[] = [];
  if (doc.name !== entry.name) {
    errors.push(`name: SKILL.md says ${JSON.stringify(doc.name)}, catalog says "${entry.name}"`);
  }
  if (typeof doc.description !== "string" || doc.description.trim() === "") {
    errors.push("description: must be a non-empty string");
  } else if (chars(doc.description) > MAX_DESCRIPTION) {
    errors.push(`description: ${chars(doc.description)} chars, at most ${MAX_DESCRIPTION}`);
  }
  const metadata = doc.metadata;
  errors.push(...harkMetadataErrors(isRecord(metadata) ? metadata.hark : undefined));
  return errors;
}
