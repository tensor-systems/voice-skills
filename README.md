# Hark voice skills

The list of voice skills [Hark](https://heyhark.app) shows in its settings. Voice skills are [Hermes](https://hermes-agent.nousresearch.com) skills that answer in a few spoken sentences. Hark reads this list at `https://heyhark.app/voice-skills.json`, which serves `voice-skills.json` from this repo's `main`, so a merged change shows up in Hark within a few minutes.

Each entry only points at a skill, and any Hermes skill can be listed. To give Hark more to show (a summary, a requirement, example phrases, and when Hermes should use it), add the optional `metadata.hark` block to the skill's own `SKILL.md`; [heyhark.app/skills](https://heyhark.app/skills/) describes it.

## Adding a skill

1. Push your skill to a public GitHub repo, with a `metadata.hark` block in its `SKILL.md` if you like.
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

3. The check on your pull request fetches your `SKILL.md` and fails only if it can't be read or its `name` doesn't match. It warns about anything Hark or Hermes will shorten or skip, such as a description over 60 characters. Run it yourself first:

   ```
   npm ci
   npm run check -- --local weather=path/to/SKILL.md
   ```

A skill doesn't have to be listed here to be used: anyone can install one in Hark by its GitHub path, from Settings → Voice skills.

## Tests

```
npm test && npm run typecheck
```
