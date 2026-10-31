# Head Portraits

With Morrowind's data attached, a face Daggerfall paints is drawn as a picture of the head the body wears: its face
and hair, a helm or hood on it, a vampire's or werewolf's head, for every race. The player sees it on save tiles,
the profile, the account card, chargen, the large HUD head, the tab dial, the party plate, family cards, the escorts'
column and the NPC talk window.

## How it works

- **One face.** The head and hair are the body's own, chosen by the build's face door (`faceMatchOf` in
  `src/combat/fpArm.js`: the curated table, the measured match, the walk) and `playerBodyRows`. A player's portrait
  index is the portrait's head. An NPC's head and hair are walked off its seed (`npcFaceOf`) from the look its body is
  built from. Creatures, wolves, children, daedra and editor flats keep their painted record.
- **Who asks.** A player's face (the live player, a save, a chargen portrait, a party seat, another player's character)
  asks for the port's own heads (`Own-Heads.md`). An NPC in the talk window, an escort and a family member not played
  wear the data's, as their bodies do.
- **The picture** (`headPortrait`). It reads its own catalogue of Morrowind records, so it works before any body is
  built (chargen, the title screen). `renderHeadAssembly` builds the head on the third-person skeleton with what is
  worn on the head (`composeWornArmor`, clothes left out) and its shadows: a closed steel helm hides the face, the
  open one shows it. A vampire wears the race's vampire head; a transformed werewolf, Bloodmoon's head in its skin.
  The wereboar keeps Daggerfall's picture. `headBounds` frames the head pieces and `headFrame` puts the eye before the
  face. The head is lit as the inventory figure is, on a transparent ground, rendered once per head and what it wears.
- **Keys.** `headDataStamp` (`src/characters/headPortraits.js`) is the data generation while Morrowind's data is
  attached. `playerHeadKey` adds the helm worn and the steel helm's style, so a helm, a visor, a curse or new data
  draws the head again.
- **Doors.** `src/ui/facePortrait.js` (player faces), `setNpcPortrait` in `src/ui/native/nativeTalk.js` (the talk
  window; the town walker's look from `src/scenes/townTalk.js`), `src/ui/hud/hudLarge.js`, `src/ui/chargenArt.js`,
  `createFaceLoader` in `src/ui/partyPanel.js` (party, family, succession, at `HEAD_RECORD` size),
  `src/ui/hud/hudEscortFaces.js`, `src/ui/dialClassicArt.js`. The menu's renderer is handed in at boot
  (`src/render/portraitRenderer.js`).
- **Gates.** A player's face draws when Morrowind's data is attached and the player's own body stands on it. An NPC's
  talk face draws when people stand in Morrowind bodies (`npcBodiesOn`).

## Rules

- Every race gets a 3D portrait, the portraits themselves drawn as the 3D head, including the NPC talk window (the
  owner).
- The curse's heads and the helm are drawn; the large HUD head draws the Morrowind head first, the curse's too (the
  owner).
- The head stands alone, with no neck or shoulders, and the classic window shows its own art round it (the owner).
- Two portraits that map to one head show the same head twice in chargen (the owner).
- Every door keeps its classic record until the picture lands, and for good when none is drawn. Nothing about a face
  is stored. A miss is not cached.

## Daggerfall Unity

DFU's faces are painted records (FACES.CIF, the TFAC talk portraits, the HUD head). The 3D head is the port's own,
shown only with Morrowind's data attached; without it every door is DFU's.

## Code and tests

- `src/combat/fpArm.js` - `headPortrait`, `renderHeadAssembly`, `headFrame`, `headBounds`, `faceMatchOf`
- `src/characters/headPortraits.js` - who is asked, gates, keys
- `src/render/portraitRenderer.js` - the menu's renderer
- `tools/headPortraitProbe.mjs` - real-browser renders on the retail skeleton
- `test/ui/portrait3d.test.js` - framing, helms, curses, keys, doors, the rig following the curse

## Open

- A party seat, a family member and an escort wear their bare face: no record carries what they wear.
- Not seen on retail Morrowind data here; probed only on the vendored retail skeleton with the port's own heads and
  helms.
