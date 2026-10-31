---
name: ste-notes
description: Write or check a pull request's player-facing patch notes for DFO Online. Use when opening or editing a PR description, or when asked for patch notes, release notes or a Discord post about a change.
---

# Patch notes

Players read these twice: in the desktop release's notes and in the launcher's news. Many read English as a second
language.

## Where they go

- In the PR description, under `## Patch notes: <title>`, with parts under `###` headings
  (`.github/pull_request_template.md`). The desktop release reads them from there.
- Never as a file in the tree: `test/tooling/rel4_release.test.js` fails the suite on one.
- Editing a merged PR's description rewrites its release's notes (`release-notes.yml`).
- Leave the section out when players would not notice the change.

## How they are written: ASD-STE100 Simplified Technical English

- STE's approved words in their approved meanings. The game's own names (items, skills, places, settings, controls)
  are technical names. Write a control or an item **bold**, as the game shows it.
- The simple present, simple past or future. No -ing verb forms, no "has been" or "have fixed". Active voice.
- One topic in a sentence. 25 words at most, 20 in an instruction. Put an instruction's condition first.
- Six sentences at most in a paragraph. Use a list for steps or choices.
- No semicolons. No contractions.
- LOOT-GATE: never give the levels, factors or drop chances in `src/systems/loot/lootLevelGate.js`. Say only that
  Rare and Legendary gear is rarer early on and more common as a character grows.

## Check before you post

Write the whole description to a file and run:

```sh
node scripts/steNotes.mjs <file>
```

The PR's `ste-notes` check runs the same script each time the description changes. A clean run is not proof: the
script cannot check the dictionary, so choose each word yourself. Full rules: `bible/01-Overview/Desktop-App.md`,
STE-NOTES.
