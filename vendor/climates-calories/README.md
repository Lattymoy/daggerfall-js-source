# Climates & Calories 1.7.1 - Ralzar (overhauled, not ported; its item art vendored)

**Climates & Calories 1.7.1** for Daggerfall Unity 1.0, by **Ralzar**
(the manifest's ContactInfo is the DFU forums). The mod's own
description: "Introduces temperature effects based on climates,
seasons, weather and clothes etc. Also adds food items and starvation
effects." The shipped bundle carries a compiled DLL (no C# source),
eleven item templates (530-540), twenty small textures and a tent
model.

Mac (Lattymoy) handed the shipped zip
(`Climates_and_Calories-49-1-7-1-1707751069`) over on 2026-09-17:
"Instead of a 1:1 port, we have been given permission to completely
overhaul this mod, figure out bugs and implement it to our desire."

**Permission: the author's, relayed by Mac (2026-09-17) - an overhaul,
not a 1:1 port, with the mod's own item art carried.**

## What is here

- `climates-calories.dfmod.json` - the shipped bundle's manifest,
  verbatim (title, version 1.7.1, author, DFUnity 1.0.0, GUID
  `7975b109-1381-485b-bdfd-8d076bb5d0c9`, the 36 files it was built
  from, and its six dependencies - Roleplay & Realism, Filling Food,
  Climates & Cloaks, Travel Options, Roleplay Realism Items, Ironman
  Options - none of which the port carries; the overhaul stands alone).
- `ItemTemplates.json` - the mod's own template rows, verbatim: 530
  Camping Equipment, 531 Rations, 532 Apple, 533 Orange, 534 Bread, 535
  Raw Fish, 536 Cooked Fish, 537 Meat, 538 Raw Meat, 539 Waterskin,
  540 Skillet. `src/systems/survival/items.js` restates them as the
  port's custom templates (same indices, same textures; the prices
  retuned where the mod's were typos - meat 50, skillet 500) and adds
  541, the port's own Campfire Kit.
- `Textures/` - sixteen of the mod's twenty PNGs: the spoiled face of
  each food (`532_0-0` a mouldy apple, `532_1-0` a rotten one, and so
  on through 537), raw meat's three (`538_0-0`, `538_1-0`, `538_2-0` -
  the fresh one, which the template names) and the waterskin
  (`539_0-0`). The two tavern menu backgrounds (`RALZARTAVERN`,
  `BLANKMENU_TAVERN`) and the tent model's two textures (`50_7-0`,
  `67_10-0`) are not carried: the port draws its tavern menu in its own
  panel and its tent from its own mesh.

## What the port does with it

The rules were read off the DLL's IL (`tools/ilDump.py`) - the reading
is in `bible/06-Systems/Systems-Arc.md` under SURV - and rebuilt as
the port's own survival arc: a felt temperature, five needs, food that
spoils, camps and campfires as shared world objects, a costed rest,
hunting. Nothing of the mod's code is carried; its numbers were the
starting point and its item art is what a player sees.
