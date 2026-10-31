# Roleplay & Realism 1.8 - Hazelnut: the art left (OWN-WORK3)

**Roleplay & Realism 1.8** for Daggerfall Unity, by **Hazelnut** (Nexus mod 16). The scripts' headers: MIT
("Copyright (C) 2020 Hazelnut", "Copyright (C) 2021 Hazelnut"). Mac handed the shipped zip over on 2026-09-23.

**Permission: [Mac: record the author's permission, or the link to it, here. The code is MIT by every script's header;
the pictures carry no licence line of their own.]**

## What is here, and why

Wave 2 of the Own Work arc (`bible/01-Overview/Own-Work.md`, 2026-10-31) replaced the mod's data and words with DFO's
own. Its pictures stay until wave 3 replaces the art. So this directory holds the art alone:

- `derived-art.json` - the specs of the 19 pictures that are Daggerfall's own records under the author's paint
  (`197_4-0`, `197_5-0` and BUTTONS.RCI 21-37). The game builds each from the player's ARENA2 (NO-BETHESDA2).
- `roleplay-realism.files.json` - the release's 24 pictures, its manifest's file list cut to its PNGs. It is what
  `test/tooling/doctrine.test.js` admits under `public/art/roleplay-realism/`, where the author's own five ship.

## What left, and what took its place

The manifest, settings, presets, the button index, the string table, the seven C# scripts, the seven XML scales, the
quest list and its three quests, and the three world-data files. The commit before OWN-WORK3 still carries them.

- The scripts: `src/systems/roleplayRealism/` restates them (`LICENSE` carries the MIT notice).
- The words: our own lines and names (`rrRealism.js`, `rrQuestLine.js`, `systems/modSettings.js`).
- The scales: our rule, each keeper as big as the classic keeper it replaces (`rrVariants.js`).
- The quests: our own words on the release's logic (`src/systems/roleplayRealism/quests/`).
- The world data: our keep and armory, built from the player's own blocks (`rrWorld.js`).

`bible/06-Systems/Roleplay-Realism.md` is the page.
