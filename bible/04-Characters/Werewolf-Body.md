# Werewolf Body

With Morrowind's data and Bloodmoon attached, a transformed werewolf stands in Bloodmoon's 3D wolf, in first and third
person, for the player and for other players. The holder of the Shadow Fang glyph wears a custom skin on it: the fur
blacker, crimson through its edging, the eyes red.

## How it works

- **What OpenMW draws.** A werewolf takes the wolf skeleton (`meshes/wolf/skin.nif`, `skin.1st.nif`) whatever its race
  or sex, animated by the wolf's own `.kf` only. No body parts are read; the CLOT `werewolfrobe` is equipped in the robe
  slot, and its parts are what is drawn.
- **The rig** (`src/combat/fpArm.js`). `WOLFSKIN` and `WOLFSKIN_1ST`; `fpSkeletonPath` and `tpSkeletonPath` ask for the
  wolf first. A wolf build has no face match or race rows; the robe is composed whole at the robe's priority; the head
  and hair come from `werewolfHeadRows` (`src/formats/morrowind/mwFirstPerson.js`). No weapon, arrow, torch, lantern
  or holster.
- **The curse drives it.** `setWerewolf(on, { skin })` rebuilds as the wolf and back on a change. While the wolf stands,
  the worn table, torch and lantern are kept for the way back. The wolf takes no weapon and casts no spell; the claws
  key as the empty hand. `isMwWerewolf` (`src/combat/weapon/weaponRig.js`) is true for a transformed werewolf only; the
  wereboar has no Morrowind form and keeps the person's body.
- **Peers** (`src/net/peer/peerBodies.js`). The pose's `wb` 1 is the wolf (`peerIsWolf`). The body key separates the
  wolf from the person, so a transformation rebuilds at once. The rider layer (`src/net/peer/peerRiders.js`) draws a
  werewolf on foot only while its wolf body does not stand.
- **Not a garment.** `mwClothingRecord` never resolves a Daggerfall robe to `werewolfrobe`.
- **The fallback.** Without Bloodmoon the wolf is refused at its skeleton with a named note. The player is then Eye of
  the Beholder's lycanthrope sprite in third person and the classic claws in first person. A viewer without Bloodmoon
  sees a transformed peer as the lycanthrope.
- **The Shadow Fang skin** (`src/characters/werewolfSkin.js`). A law over Bloodmoon's pixels, painted on a copy of the
  texture in the build (`skinMips`, `shadowFangPixels`) and cached by image, skin and use (`skinUseKey`). It runs on the
  first mip level; the rest are box-filtered down from it. Eyes burn red where a texture or shape names an eye, or as
  a small glowing blob on the head's texture, never by colour alone. The base is the fur's own colour, darker and less
  saturated. The edging is crimson on strands lighter than their neighbourhood and on the fringe of a cut card.

## Rules

- Bloodmoon's werewolf is imported, not skipped (Mac).
- The Shadow Fang skin: the skin's base blacker, crimson red through the fur's edging, red eyes (Mac).
- Who wears it: the holder of the Shadow Fang glyph (`SKIN_GLYPH`, `werewolfSkinOf`), read from the signed token for a
  peer and from the account's last word on this device for the player, so it holds offline too. It is only ever
  applied to the wolf's body.
- Bloodmoon's files are the player's own, never shipped. The skin is therefore a law over pixels, not a painted texture.

## Daggerfall Unity

DFU draws the werewolf as a billboard and the first-person claws. The 3D wolf follows OpenMW's rules for Bloodmoon's
werewolf (`actorutil.cpp` `getActorSkeleton`, `npcanimation.cpp`, `MechanicsManager::setWerewolf`).

## Code and tests

- `src/combat/fpArm.js` - the wolf's build and `setWerewolf`
- `src/combat/weapon/weaponRig.js` `isMwWerewolf` - the player's form each frame
- `src/net/peer/peerBodies.js`, `src/net/peer/peerRiders.js` - peers
- `src/characters/werewolfSkin.js` - the Shadow Fang law
- `test/net/peer/werewolf1.test.js`, `test/net/shadowfangskin.test.js` - the wolf and the skin
- `test/characters/mwnpc15_werewolf.test.js` - the werewolf foe in the wolf

## Open

- No Bloodmoon data is in the tree: the pins use fixture meshes and hand-written records. The robe's real parts,
  whether Bloodmoon ships `xskin.kf`, the first-person wolf's camera bone and how the eye rule reads Bloodmoon's real
  eyes are all unchecked. The first player to transform with Bloodmoon attached is the check.
