import { describe, expect, it } from "vitest";
import catalogJson from "../voice-skills.json";
import { checkCatalog, frontmatter, harkMetadataErrors, rawSkillUrl, skillErrors } from "../scripts/voice-skills";

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

describe("skillErrors", () => {
  it("accepts a complete skill", () => {
    expect(skillErrors(entry, skillMd(valid))).toEqual([]);
  });

  it("accepts a skill with only the required metadata", () => {
    const minimal = `name: herdr-voice\ndescription: Short.\nmetadata:\n  hark:\n    voice: true\n    summary: Does a thing.`;
    expect(skillErrors(entry, skillMd(minimal))).toEqual([]);
  });

  it("reports a missing hark block, as on a skill that predates it", () => {
    const old = `name: herdr-voice\ndescription: "Claude Code, Codex, omp, any coding agent: Herdr, not tmux"`;
    expect(skillErrors(entry, skillMd(old))).toEqual(["metadata.hark: missing (must be a mapping)"]);
  });

  it("checks the name against the catalog and the description length in characters", () => {
    const yaml = valid
      .replace("name: herdr-voice", "name: herdr")
      .replace(/^description: .*$/m, `description: "${"é".repeat(60)}"`);
    expect(skillErrors(entry, skillMd(yaml))).toEqual(['name: SKILL.md says "herdr", catalog says "herdr-voice"']);
    const long = valid.replace(/^description: .*$/m, `description: "${"x".repeat(61)}"`);
    expect(skillErrors(entry, skillMd(long))).toEqual(["description: 61 chars, at most 60"]);
  });

  it("reports missing or broken frontmatter", () => {
    expect(skillErrors(entry, "# Just a body\n")).toEqual(["SKILL.md: no YAML frontmatter"]);
    expect(skillErrors(entry, skillMd("name: [unclosed"))[0]).toMatch(/^SKILL.md: frontmatter is not valid YAML/);
    expect(skillErrors(entry, skillMd("- a list"))).toEqual(["SKILL.md: frontmatter must be a mapping"]);
  });
});

describe("harkMetadataErrors", () => {
  it("enforces every field rule", () => {
    expect(
      harkMetadataErrors({
        voice: "true",
        summary: "x".repeat(121),
        requires: { command: "herdr && rm -rf ~" },
        phrases: ["1", "2", "3", "4", "5", "6", ""],
        routing: "x".repeat(301),
      }),
    ).toEqual([
      "metadata.hark.voice: must be true",
      "metadata.hark.summary: 121 chars, at most 120",
      "metadata.hark.requires.command: must match ^[A-Za-z0-9._-]+$",
      "metadata.hark.phrases: 7 items, at most 6",
      "metadata.hark.phrases: every item must be a non-empty string",
      "metadata.hark.routing: 301 chars, at most 300",
    ]);
  });

  it("rejects wrong types", () => {
    expect(harkMetadataErrors({ voice: true, summary: " ", requires: "herdr", phrases: "hi", routing: 3 })).toEqual([
      "metadata.hark.summary: must be a non-empty string",
      "metadata.hark.requires: must be a mapping",
      "metadata.hark.phrases: must be a list",
      "metadata.hark.routing: must be a string",
    ]);
  });
});
