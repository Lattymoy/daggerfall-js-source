# Own Heads

The port's own heads and hairs for the Morrowind body: three heads and three hairs for Breton men, worn by players
only. A Breton player, and every other player who is a Breton man, wears them in place of Morrowind's Breton men's
heads; NPCs keep Morrowind's own.

## How it works

- **The pools** (`OWN_HEADS`, `src/characters/ownModels/ownHeadModels.js`). Each head and hair is written as the BODY
  record Morrowind would carry (a skin part of a race and sex, slot head or hair, a rigid mesh under the Head node), so
  the build chooses among them on its ordinary doors. Breton men: heads `h04`, `h0411` (the eyepatch) and `h0423`;
  hairs `01`, `0111` (the red headband) and the widow's peak. `ownFacePools` answers them; every other race and sex has
  none and keeps the data's.
- **Players only.** `facePools` (`src/formats/morrowind/mwFirstPerson.js`) returns the port's own only when asked
  (`own`). The build asks only for a player's body: the local player's (`ownHeads` from `armBuildOptsOf` in
  `src/combat/weapon/weaponRig.js`) and every peer's (`playerBuildOpts` in `src/net/peer/peerBodies.js`). NPC lanes,
  quest people, foes, card regulars, escorts and family members not played use `peerBuildOpts`, which never asks.
- **All or none.** The port's own stand only while all six meshes are in the archives (`archiveHas` in
  `src/combat/fpArm.js`); otherwise the data's pools stand whole.
- **Choosing a face.** The player's curated face (`src/formats/mwFaceTable.json`) wins first and maps Daggerfall's ten
  Breton portraits by likeness onto the pairs; portrait 6 is the eyepatch with hair `01`. Where the curated table
  answers both halves, the measured face match stands down. An NPC's face is walked off its seed among the data's pools
  (`npcFaceOf`, `src/characters/wardrobe.js`), never the port's own.
- **A Breton vampire** wears the data's vampire head over them, his own hair.
- The meshes ship under `src/assets/mw/` through `src/systems/ownMwAssets.js`.

## Rules

- Only players who are Breton men receive the new heads, not NPCs (the owner).
- The heads face as a retail head does (-Y); the bake turns its +Y frame round.
- The eyepatch is never paired with the headband.

## Daggerfall Unity

DFU has no Morrowind body; its faces are the chargen portraits. The curated table maps those portraits onto these
heads.

## Code and tests

- `src/characters/ownModels/ownHeadModels.js` - `OWN_HEADS`, `ownFacePools`
- `src/formats/morrowind/mwFirstPerson.js` - `facePools`, `playerBodyRows`
- `src/formats/mwFaceTable.json` - the curated portraits
- `tools/bakeHeads.mjs` - the bake
- `test/tooling/mwheads1.test.js` - the bake byte for byte, the pools, players only, a real build
- `test/ui/portrait3d.test.js` - which portraits ask for the port's own

## Open

- A Breton man who is a player has nine faces, where Morrowind's data gives forty-eight.
- The turn is read off the owner's report, not a retail skeleton: the Head node's own rotation is not pinned.
- No Breton women's heads yet. The first person draws no head or hair.
