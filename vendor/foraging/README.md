# Foraging 1.7 - Harbinger451 (the art that is still here)

**Foraging 1.7** for Daggerfall Unity 1.1.1, by **Harbinger451** (the
shipped archive is `Foraging_1260_1.7`, Nexus mod 1260 by its name; GUID
`603e3883-dbdc-4a5f-8683-6c57e14a331b`). Mac (Lattymoy) handed the zip
over on 2026-09-28 - "Heres this for life skills" - and, asked whether
the port has the author's permission, answered "Yes, permission".

**Permission: [Mac: record the author's permission, or the link to it,
here - Mac confirmed on 2026-09-28 that Harbinger451 gave it ("Yes,
permission"); the earlier mod records carry the author's own words or a
link in this line.]**

## What is left, and why

OWN-WORK3 (2026-10-31, the owner: "removing mods from outside authors and
instead replacing them with our own work") replaced the mod's data and
words with our own. Wave 2 does not replace art, so the author's seven
pictures stay here until wave 3:

- `Textures/` - `11600_0-0.png` Wood-Axe, `11601_0-0.png` Pick-Axe,
  `11602_0-0.png` Sickle, `11603_0-0.png` Fishing-Net (128 x 128),
  `11604_0-0.png` Wood Bundle, `11605_0-0.png` Egg, `11606_0-0.png`
  Spade (the others 64 x 64). The author's own pixel art, no Daggerfall
  record, taken out of the bundle's Texture2D objects.
- `foraging.files.json` - our listing of those seven files and their
  sha256, which the doctrine gate reads in place of the bundle's manifest.

## What left the tree

The manifest, the twelve item templates, `Foraging.dll` and its IL dump,
the quest list and its 22 quests, and the shipped readme. The tree at
`8d110d8f7` still holds them. Our own work is the record now:
`src/systems/foraging/foragingItems.js` (the rows),
`src/systems/foraging/foragingLaw.js` (the rules, read off the build's IL,
in our words) and `src/systems/foraging/quests/` (the quests, with
FORAGE-FIX's mends written in). See `bible/06-Systems/Foraging.md`.
