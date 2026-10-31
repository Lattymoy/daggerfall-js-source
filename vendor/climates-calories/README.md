# Climates & Calories 1.7.1 - Ralzar (its item pictures only; the rest is our own code)

**Climates & Calories 1.7.1** for Daggerfall Unity 1.0, by **Ralzar**
(the manifest's ContactInfo is the DFU forums; GUID
`7975b109-1381-485b-bdfd-8d076bb5d0c9`). The mod's own description:
"Introduces temperature effects based on climates, seasons, weather and
clothes etc. Also adds food items and starvation effects."

Mac (Lattymoy) handed the shipped zip
(`Climates_and_Calories-49-1-7-1-1707751069`) over on 2026-09-17:
"Instead of a 1:1 port, we have been given permission to completely
overhaul this mod, figure out bugs and implement it to our desire."

**Permission: the author's, relayed by Mac (2026-09-17) - an overhaul,
not a 1:1 port, with the mod's own item art carried.**

## What is here, and why

- `Textures/` - thirteen of the mod's pictures, the author's own art: the
  spoiled faces of each food (`532_0-0` a mouldy apple, `532_1-0` a rotten
  one, and so on through 537), raw meat's three (`538_0-0` to `538_2-0`)
  and the waterskin (`539_0-0`). There is no `TEXTURE.532` in ARENA2, so
  the pipeline stands a shell in for each archive
  (`vendorTextureStandIn`).
- `derived.json` - four pictures that are Daggerfall's own records
  (NO-BETHESDA2): the tent's canvas (TEXTURE.050 record 7) and pole
  (TEXTURE.067 record 10), the mouldy cooked fish (TEXTURE.211 record 10)
  and the mouldy bread (record 31 with the author's mould on it, kept as
  edits). The game builds each from the player's own ARENA2
  (`src/systems/rebuiltPicture.js`).

They stay until wave 3 of the owner's arc (OWN-WORK, "removing mods from
outside authors and instead replacing them with our own work"), which
replaces outside art with our own. Wave 2 replaced the mod's data and
words. The rotten cooked fish is already ours (NO-BETHESDA3,
`src/systems/survival/rotPicture.js`).

## What left the tree (OWN-WORK3, 2026-10-31)

The manifest and the mod's item templates (530-540, and a row renaming
DFU's 149 "Shoes", which the port never carried). The rules were rebuilt
as our own survival arc from 2026-09-18 (SURV1-SURV7; nothing of the DLL
is carried). Our code is the record now:

- the item rows, by our own rules: `src/systems/survival/items.js`
  (`SURVIVAL_TEMPLATES`, `foodPrice`);
- food, spoiling and eating: `src/systems/survival/food.js`;
- the rest of the arc: `bible/06-Systems/Climates-Calories.md`.

The commit before OWN-WORK3 still holds the files.
