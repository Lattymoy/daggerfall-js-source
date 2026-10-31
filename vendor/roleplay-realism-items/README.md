# Roleplay & Realism: Items 1.3 - Hazelnut & Ralzar: the art left (OWN-WORK3)

**Roleplay & Realism: Items 1.3** for Daggerfall Unity, by **Hazelnut & Ralzar** (Nexus mod 61). The scripts'
headers: MIT ("Copyright (C) 2020 Hazelnut"; the mod's own script "Copyright (C) 2020", "Authors: Hazelnut &
Ralzar"). Mac handed the shipped zip over on 2026-09-23.

**Permission: [Mac: record the authors' permission, or the link to it, here. The code is MIT by every script's header;
the sprites are the authors' own art and carry no licence line of their own.]**

## What is here, and why

Wave 2 of the Own Work arc (`bible/01-Overview/Own-Work.md`, 2026-10-31) replaced the mod's data and words with DFO's
own. Its sprites stay until wave 3 replaces the art. So this directory holds the art alone:

- `derived-art.json` - the specs of the 50 sprites that are Daggerfall's own records under the authors' paint (46
  helmet masks, four Dwarven helmets). The game builds each from the player's ARENA2 (NO-BETHESDA2).
- `roleplay-realism-items.files.json` - the release's 280 sprites, its manifest's file list cut to its PNGs. It is
  what `test/tooling/doctrine.test.js` and `tools/rriExtract.mjs` admit under `public/art/roleplay-realism-items/`,
  where the authors' own 230 ship. Their paper-doll rects stay in `src/systems/roleplayRealismItems/rriIndex.js`.

## What left, and what took its place

The manifest, settings, `ItemTemplates.json`, the string table and the fifteen C# scripts. The commit before
OWN-WORK3 still carries them.

- The scripts: `src/systems/roleplayRealismItems/` and `src/combat/rriEnemyEquipment.js` restate them (`LICENSE`
  carries the MIT notice).
- The rows and patches: our own, by our rule from the classic slot piece (`rriItems.js` RRI_ROW_RULE).
- The words: our item names, our three name words, our nine spell names and our settings text.

`bible/06-Systems/Roleplay-Realism-Items.md` is the page.
