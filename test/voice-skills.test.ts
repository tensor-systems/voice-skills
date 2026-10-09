import { describe, expect, it } from "vitest";
import catalogJson from "../voice-skills.json";
import { checkCatalog, checkSkill, frontmatter, harkMetadataWarnings, rawSkillUrl } from "../scripts/voice-skills";

const entry = {
  name: "herdr-voice",
  install: "shanev/herdr-voice/skills/herdr-voice",
  category: "autonomous-ai-agents",
  reviewed: true,
};

const errorsOf = (json: unknown) => {
  const result = checkCatalog(json);
  return result.ok ? [] : result.errors;
};

describe("checkCatalog", () => {
  it("accepts the published catalog", () => {
    expect(errorsOf(catalogJson)).toEqual([]);
  });

  it("accepts an entry without a category", () => {
    const { category: _, ...bare } = entry;
    expect(errorsOf({ version: 1, skills: [bare] })).toEqual([]);
  });

  it("rejects a wrong version, unknown fields and a missing list", () => {
    expect(errorsOf({ version: 2, extra: true })).toEqual([
      'catalog: unknown field "extra"',
      'catalog: "version" must be 1',
      'catalog: "skills" must be a list',
    ]);
    expect(errorsOf([])).toEqual(["catalog must be a JSON object"]);
  });

  it("rejects duplicate names", () => {
    expect(errorsOf({ version: 1, skills: [entry, entry] })).toEqual(['skills[1]: duplicate name "herdr-voice"']);
  });

  it("rejects bad entry fields", () => {
    const bad = { name: "a b", install: "owner/repo", category: "x;rm", reviewed: "yes", url: "x" };
    expect(errorsOf({ version: 1, skills: [bad, "x"] })).toEqual([
      'skills[0]: unknown field "url"',
      'skills[0]: "name" must be a skill name (letters, digits, ".", "_", "-")',
      'skills[0]: "install" must be a GitHub path owner/repo/path/to/skill-dir',
      'skills[0]: "category" must be a category name (letters, digits, ".", "_", "-")',
      'skills[0]: "reviewed" must be true or false',
      "skills[1]: must be an object",
    ]);
  });

  it("rejects install paths that climb out or carry shell syntax", () => {
    for (const install of ["owner/repo/../x", "owner/repo/a b", "owner/repo/$(x)", "/owner/repo/x", "owner/repo/x/"]) {
      expect(errorsOf({ version: 1, skills: [{ ...entry, install }] })).toHaveLength(1);
    }
  });
});

describe("rawSkillUrl", () => {
  it("points at SKILL.md on the default branch", () => {
    expect(rawSkillUrl(entry.install)).toBe(
      "https://raw.githubusercontent.com/shanev/herdr-voice/HEAD/skills/herdr-voice/SKILL.md",
    );
  });
});

const skillMd = (yaml: string) => `---\n${yaml}\n---\n\n# Body\n\n---\nnot frontmatter\n`;

const valid = `name: herdr-voice
description: "Claude Code, Codex, omp, any coding agent: Herdr, not tmux"
metadata:
  hark:
    voice: true
    summary: Start and check coding agents in Herdr.
    requires:
      command: herdr
    phrases:
      - new Claude session for hark
      - what's waiting on me
    routing: "Coding agent sessions on this machine go through Herdr."`;

describe("frontmatter", () => {
  it("returns the leading YAML block only", () => {
    expect(frontmatter(skillMd("name: x"))).toBe("name: x");
    expect(frontmatter("# No frontmatter\n---\nname: x\n---\n")).toBeNull();
  });
});

const clean = { errors: [], warnings: [] };

describe("checkSkill", () => {
  it("accepts a complete skill", () => {
    expect(checkSkill(entry, skillMd(valid))).toEqual(clean);
  });

  it("accepts any Hermes skill: metadata.hark is optional", () => {
    const plain = `name: herdr-voice\ndescription: "Claude Code, Codex, omp, any coding agent: Herdr, not tmux"`;
    expect(checkSkill(entry, skillMd(plain))).toEqual(clean);
  });

  it("fails only when the name doesn't match the catalog", () => {
    const yaml = valid.replace("name: herdr-voice", "name: herdr");
    expect(checkSkill(entry, skillMd(yaml)).errors).toEqual(['name: SKILL.md says "herdr", catalog says "herdr-voice"']);
  });

  it("warns about a description Hermes cuts, counting characters", () => {
    const sixty = valid.replace(/^description: .*$/m, `description: "${"é".repeat(60)}"`);
    expect(checkSkill(entry, skillMd(sixty))).toEqual(clean);
    const long = valid.replace(/^description: .*$/m, `description: "${"x".repeat(61)}"`);
    expect(checkSkill(entry, skillMd(long))).toEqual({
      errors: [],
      warnings: ["description: 61 chars, Hermes shows the model the first 60"],
    });
  });

  it("fails on missing or broken frontmatter", () => {
    expect(checkSkill(entry, "# Just a body\n").errors).toEqual(["SKILL.md: no YAML frontmatter"]);
    expect(checkSkill(entry, skillMd("name: [unclosed")).errors[0]).toMatch(/^SKILL.md: frontmatter is not valid YAML/);
    expect(checkSkill(entry, skillMd("- a list")).errors).toEqual(["SKILL.md: frontmatter must be a mapping"]);
  });
});

describe("harkMetadataWarnings", () => {
  it("has nothing to say about a missing block or a minimal one", () => {
    expect(harkMetadataWarnings(undefined)).toEqual([]);
    expect(harkMetadataWarnings({ voice: true })).toEqual([]);
  });

  it("warns about each field Hark shortens or drops", () => {
    expect(
      harkMetadataWarnings({
        voice: "true",
        summary: "x".repeat(121),
        requires: { command: "herdr && rm -rf ~" },
        phrases: ["1", "2", "3", "4", "5", "6", "7"],
        routing: "x".repeat(301),
      }),
    ).toEqual([
      "metadata.hark.voice: should be true",
      "metadata.hark.summary: 121 chars, Hark shortens it to 120",
      "metadata.hark.requires.command: doesn't match ^[A-Za-z0-9._-]+$, so Hark ignores it",
      "metadata.hark.phrases: 7 items, Hark shows the first 6",
      "metadata.hark.routing: 301 chars, Hark cuts it to 300",
    ]);
  });

  it("warns about wrong types", () => {
    expect(harkMetadataWarnings("yes")).toEqual(["metadata.hark: not a mapping, so Hark ignores it"]);
    expect(harkMetadataWarnings({ summary: " ", requires: "herdr", phrases: "hi", routing: 3 })).toEqual([
      "metadata.hark.summary: not a non-empty string, so Hark shows the description",
      "metadata.hark.phrases: not a list of non-empty strings, so Hark ignores it",
      "metadata.hark.routing: not a string, so Hark ignores it",
    ]);
  });
});
