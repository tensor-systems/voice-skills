# Hark voice skills

The list of voice skills [Hark](https://heyhark.app) shows in its settings. Voice skills are [Hermes](https://hermes-agent.nousresearch.com) skills that answer in a few spoken sentences. Hark reads this list at `https://heyhark.app/voice-skills.json`, which serves `voice-skills.json` from this repo's `main`, so a merged change shows up in Hark within a few minutes.

Each entry only points at a skill. What Hark shows about it (summary, requirement, example phrases, and when Hermes should use it) comes from the `metadata.hark` block in the skill's own `SKILL.md`, so it stays with the skill. [heyhark.app/skills](https://heyhark.app/skills/) describes the block.

## Adding a skill

1. Add the `metadata.hark` block to your skill's `SKILL.md` and push it to a public GitHub repo.
2. Open a pull request adding an entry to `voice-skills.json`:

   ```json
   {
     "name": "weather",
     "install": "you/your-repo/skills/weather",
     "category": "productivity",
     "reviewed": false
   }
   ```

   - `name`: the `name` in your skill's frontmatter.
   - `install`: the GitHub path `hermes skills install` takes: owner, repo, then the skill's folder.
   - `category`: optional. Hermes files the skill under it.
   - `reviewed`: leave it `false`. Maintainers set it to `true` after looking the skill over. Hark labels other skills "community", and Hark's setup installs only reviewed ones.

3. The check on your pull request fetches your `SKILL.md` and checks its name, its description (60 characters at most, Hermes' limit) and its `metadata.hark` block. Run it yourself first:

   ```
   npm ci
   npm run check -- --local weather=path/to/SKILL.md
   ```

A skill doesn't have to be listed here to be used: anyone can install one in Hark by its GitHub path, from Settings → Voice skills.

## Tests

```
npm test && npm run typecheck
```
