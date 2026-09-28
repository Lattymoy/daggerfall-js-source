# Bloodmoon's werewolf, and the Shadow Fang skin (WEREWOLF1, 2026-09-26)

Mac, of SirMcMobdon's werewolf skin: "it's the 3d model", "Might need to grab OpenMW for this", then "Well it needs
to be imported if its not. It shouldnt be skipped". And the skin itself: "Wants a custom morrowind werewolf skin
(skin base but blacker amd like crimson red thru out the edging in the fur, red eyes)".

Until this slice the Morrowind rig scoped the werewolf out (`combat/fpArm.js`, rule 6's note): a transformed player
with the Morrowind body stood as their own human body, and the only "Morrowind-looking" werewolf in the port was Eye Of
The Beholder's pre-rendered sprite (PR-WW1). This page is the 3D werewolf, read off OpenMW's source (a shallow clone
of OpenMW/openmw at 3ee798e, 0.52.0-dev), and the skin that dresses one player's.

## What OpenMW draws for a werewolf

- **The skeletons.** `getActorSkeleton` tests the werewolf first, whatever the race or sex
  (`apps/openmw/mwrender/actorutil.cpp:8-32`): `[Models] wolfskin = meshes/wolf/skin.nif` and
  `wolfskin1st = meshes/wolf/skin.1st.nif` (`files/settings-default.cfg:1123`, `:1126`). Rule 18's x-swap applies:
  `meshes/wolf/xskin.nif` when `meshes/wolf/xskin.kf` exists (`components/misc/resourcehelpers.cpp:180-198`).
- **One animation source.** `updateNpcBase` leaves the base empty for a werewolf (`npcanimation.cpp:503-510`), so
  `xbase_anim.kf` / `xbase_anim.1st.kf` are never added; only the wolf skeleton's own `.kf` (`:529-533`).
- **No body parts.** `getBodyParts(..., werewolf)` answers 27 nulls before reading a BODY record (`:1200-1203`), and
  the skeleton's own geometry is stripped (`setObjectRoot(smodel, true, true, false)`, `:525`, through
  `CleanObjectRootVisitor`). What is drawn is:
  - **the robe**: `MechanicsManager::setWerewolf` unequips everything and equips the CLOT `werewolfrobe` in
    `Slot_Robe` (`mwmechanics/mechanicsmanagerimp.cpp:1896-1901`); its part references are claimed at the robe's
    priority `((11+1)<<1)+0 = 24`, and the robe reserves its eleven slots (`npcanimation.cpp:633-641`);
  - **the head and hair**: the BODY records `WerewolfHead` and `WerewolfHair`, looked up by id alone - no race, sex,
    part or flag test (`:475-494`) - third person only, and only while the head slot is the skin's (`:650-656`).
- **First person.** The robe's parts take `addPartGroup`'s ladder (`:873-915`): a part's `<id>.1st` record, else the
  plain one only for a hand, wrist, forearm or upper arm, else the slot reserved with nothing in it.
- **The wolf holds nothing.** `unequipAll` empties every slot; the player's items are refused while transformed.
- **Animation groups** are the standard names; the werewolf fights hand-to-hand (`idlehh`, `handtohand`, falling back
  to the bare groups), which the port's machine already composes for an empty drawn hand.
- **The rebuild.** A change of NPC type rebuilds the animation (`updateParts`, `:578-584` -> `rebuild()`).
- Scale: `Npc::adjustScale` has no werewolf test - the wolf takes the actor's race scale.

## What the port does

- `combat/fpArm.js`: `WOLFSKIN` / `WOLFSKIN_1ST`; `fpSkeletonPath` / `tpSkeletonPath` take `werewolf` and ask for the
  wolf first. `buildFpArm({ werewolf })` and `buildTpBody({ werewolf })`: no face match, no race rows, the robe
  composed as a garment handed in whole (`mwItemMap.js composeWornArmor`, a `record` piece at the robe's priority with
  its reserves), the first person through `firstPersonPartGroup`, the head and hair by `werewolfHeadRows`
  (`mwFirstPerson.js`), no weapon, arrow, torch, lantern, holster or bone addons, and the wolf's own `.kf` alone
  (`fpAnimSources` / `tpAnimSources` with `{ werewolf }`). The result carries `werewolf: true`.
- **The rig follows the curse.** `fpArm.setWerewolf(on, { skin })` rebuilds as the wolf and back on a change (one
  boolean compare otherwise); `builtFor()` carries the form. While the wolf stands the worn table, the torch and the
  lantern are kept for the way back and not worn; it takes no weapon (`setWeapon`), readies and casts no spell
  ("Werewolfs can not cast spells", mechanicsmanagerimp.cpp:1888-1890), and the claws key as the empty hand. A form
  asked during the first build waits for it; one asked while a door's build is queued rides that build. A wolf refused
  (no Bloodmoon) still turns back - see AUDIT D1.
- `combat/weaponRig.js`: `isMwWerewolf(entity)` - transformed, and the curse the wolf's (LycanthropyTypes 1); the
  wereboar has no Morrowind form and keeps the person's body. It rides `armBuildOptsOf` (a save loaded mid-change
  builds the wolf at the door) and `armIdentityOf`, and every frame the form is handed to `setWerewolf` AHEAD of the
  `ready()` gate and of the hand, the worn table and the spell; the skin is read when the form changes, not per frame.
- **Peers.** `net/peerBodies.js`: the pose's `wb` 1 is the wolf (`peerIsWolf`); `peerBodyKey` keys the wolf by what its
  build reads - race, sex, skin - apart from the person, so a transformation rebuilds at once rather than after
  `BODY_REBUILD_MS`, and a refused wolf is waited out as a wolf. The wolf's body is built holding nothing, readying no
  spell and hanging no lantern. A wolf refused at its skeleton is the data's answer: until the data changes no werewolf
  is the bodies' (one refusal, one warning, the person's body lingering for a turn back). A form flipped back within
  `BODY_REBUILD_MS` of a form's body waits the rest out. In `scenes/world.js` a werewolf on foot goes to the bodies
  either way (its wolf builds while Eye Of The Beholder's lycanthrope stands for it); `net/peerRiders.js` DEFERS a
  werewolf on foot and `settle`s it after the bodies have synced - drawn by the riders unless its wolf stands this
  frame (`wolfStands`). A mounted beast and the wereboar stay the rider layer's.
- **Not a garment.** `mwClothingRecord` never resolves a Daggerfall robe to `werewolfrobe` (OpenMW hides it from the
  inventory), nor to a record with no ground mesh: a dark robe measured nearest its fur would have dressed a person in
  the wolf's body. The reader keeps a CLOT with part references and no MODL (`Clothing::load` reads MODL as optional),
  so a `werewolfrobe` without one still dresses the wolf (`ARM_RECORDS_VERSION` 3).

## The fallback

Bloodmoon's files are the player's own, like every Morrowind file. Without Bloodmoon attached the wolf is refused at
its skeleton (`meshes/wolf/skin.1st.nif is not in your archives`), nothing of Morrowind stands, and the transformed
player is Eye Of The Beholder's lycanthrope in third person and the classic claws in first - as before - and the
person's Morrowind body comes back at the turn. With Bloodmoon.bsa and no Bloodmoon.esm the wolf is refused at its
`parts` (no robe), the note saying which: `Bloodmoon.esm does, and it is not attached`, or `Bloodmoon.esm is attached
and no CLOT record here names it`. A viewer without Bloodmoon sees a transformed peer as the lycanthrope.

## The Shadow Fang skin

`characters/werewolfSkin.js`. The textures are Bloodmoon's, so the skin is a **law over their pixels**, painted on a
**copy** - the decoded texture cache is shared by every rig on the page. It is painted IN THE BUILD (`fpArm.js
preskinTextures`, a texture a turn) and kept module-wide by the decoded image, the skin and the use (`SKINNED_MIPS`,
`skinUseKey`), so the frame that hangs a mesh finds it ready and a second wolf in the same skin paints nothing. The law
runs on the texture's FIRST level; every later level is that one box-filtered down, colour weighted by alpha, each
keeping its own alpha. Per texel (a texel of alpha 0 is left alone; any other is dressed):

- **the eyes burn red** (#ff222e, the glyph's own eye, by the texel's own light - a pupil stays dark), WHERE THE EYES
  ARE: every texel of a texture - or a shape - whose name says eye, and on the HEAD's own texture (WerewolfHead, or a
  robe's head part) a small, compact blob of the eye's colour (bright and saturated in the yellow-to-cyan hues, or a
  hot red) glowing 0.3 above the texels round it and alone among them (`eyeBlob`). Never a colour alone and never the
  body's fur;
- **the base is the skin's own colour, blacker**: 0.3 of its light, 40% of its colour drained toward its grey;
- **the edging is crimson** (#c41230) through the fur: a strand lighter than its 5x5 opaque neighbourhood, the lit tips
  - the texture's own light between its 85th and 97th percentiles - and, on an ALPHA-TESTED card alone, the fringe
  beside a cut; the crimson lit by the texel's own light. The neighbourhood and the fringe wrap as the texture does.

**Who wears it**: the holder of the Shadow Fang glyph. A peer, by the glyphs their signed token carries (the relay
reads them off the signature, so every client in a room agrees); the player, by the account service's last word on
this device - `net/accountClient.js adoptIdentity` keeps a token's or a wardrobe's `glyphs` on the stored session, and
`systems/ownGlyphs.js` reads them, so the skin is theirs offline too. The skin rides the build opts (`skin`), the peer's
body key and `setWerewolf`; it is only ever applied to the wolf's body, never a person's or an item's icon.

## What is not verified here

No Bloodmoon data is in this container. The pins drive the law with fixture meshes under Bloodmoon's own paths and
hand-written BODY/CLOT records; they prove which files are asked for and how they are dressed, not how Bloodmoon's
real werewolf looks. In particular:

- the robe's actual part list, and whether its records carry `.1st` variants, are Bloodmoon.esm's;
- whether Bloodmoon ships `xskin.kf` / `xskin.1st.kf` (the build takes whichever exists), and whether the first-person
  wolf skeleton has a `Camera` or `Head` bone (the build refuses without one, by name);
- the skin's eyes: if Bloodmoon's werewolf eyes are neither named as eyes nor a glowing blob on the head's texture,
  they stay their colour, blackened. The first preview was made on Eye Of The Beholder's renders of the same wolf,
  which carry neither the eyes' own colour (the eye rule fired on none of their texels - the preview placed them by
  hand) nor a texture's fringe (a render's silhouette is not a card's cut): it validated nothing of the law on real
  textures. The law is pinned on synthetic furs - dark, brown, golden, wheat, amber, auburn, blond, cream.

The first player to transform with Bloodmoon attached is the check; a refusal is a named note on the Morrowind card.

## Pins

- `test/werewolf1.test.js` (17): the paths and sources, the robe and its first-person ladder, the head and hair, the
  build (read log: the wolf's files - its head and hair bound on the fixture's own third-person skeleton - none of the
  person's, not the base's bone addon nor the person's first-person neck), the refusal and its notes, the robe with no
  MODL, the third person's ladder, the rig and its gates, the queue, the per-frame door through a refusal and back
  (a real `createWeaponRig().frame()`), the weapon rig, the peers (key, refusal, throttle), the host, the same-frame
  handoff and the garment pool, and (the merge) BEAST-SELF's stand-aside asked of the form. `tools/mutants/werewolf1.json`
  29, all dead.
- `test/shadowfangskin.test.js` (8): who wears it, the law (base, strand, flat light, cut-only fringe, wrap, the opaque
  neighbourhood), the eyes (named, the head's blob, never the fur - seven furs, three seeds), light and dark wolves and
  the law's golden fingerprint, the mips, the rig (both views skinned, painted in the build, shared module-wide), the
  skin riding the form, and whose skin (the stored session, the asking session, the peer's key and build).
  `tools/mutants/shadowfangskin.json` 14, all dead.
- `tools/mutants/wwaudit.json` - the audit's own, one a fix (below).
- Nine older pins re-aimed to the new law (disc12, prww1_werewolf, mwbody1, fparm x2, htwaist_mwbody, mwarms_fps,
  mwtorch, ws1_sheathing) and mac7: a werewolf on foot may now take a Morrowind body; the wereboar still never does.

## AUDIT (2026-09-26, before the merge)

Mac: "let's audit everything before merging". Six lenses read both commits (DEV3 + SHADOW-FANG, WEREWOLF1 + the skin)
read-only, each proving its findings with a driver script against the real modules, and nothing was fixed while they
read: A the title and glyph on every face (real Chromium), B identity, versions and deploy, C the build against
OpenMW, D the rig's state machine, E the peers and the world host, F the skin law, the pins and the records. This page
keeps the werewolf's and the skin's; the title's, the glyph's and the deploy's are in
`06-Systems/Accounts-And-Cloud-Saves-Arc.md` (its SHADOW-FANG section, AUDIT).

**Fixed.**
- **D1 / C1 (the blocker): a refused wolf never turned back.** The per-frame `setWerewolf` sat under `if (!paralyzed &&
  fpArm.ready())`, and a refusal leaves no arm standing - so without Bloodmoon, a player who transformed and turned back
  stood in the classic sprite until the next load. The form is handed over ahead of the gate now; the pin drives a
  real `createWeaponRig().frame()` through the refusal and back (the old pin called `setWerewolf(false)` itself).
- **D2 / E5 / F5: the skin was painted in the frame** - the first frame after every wolf build, per rig, thrown away at
  every rebuild: a 1024-square texture half a second's stall on every screen at every transformation (2048: 1.7 s).
  Painted in the build now, a texture a turn, and kept module-wide by the image it paints; the law itself 3-4x faster
  (precomputed taps, the first level alone).
- **F2: the eyes by colour burned golden, wheat, amber and auburn fur red** (5-77% of a coat). An eye is named, or a
  small compact blob on the head's own texture glowing above the fur round it and alone there - never the body's fur.
  **F3: the tips were a fixed brightness** - a blond or cream wolf came out red; they are the texture's own lightest
  now. **F4: the law ran on each mip level apart** - the edging faded with distance and a cut's fringe grew a texel a
  level; the first level is skinned and filtered down. **F6: the fringe edged opaque textures' UV padding and every
  semi-transparent texel** - on alpha-tested ranges alone now, never a texel's own.
- **D3/D7/C5: the claws were a weapon swap on every transformation**, and nothing stopped a weapon on the wolf; the
  claws key as the empty hand and the wolf takes none. **E6: the wolf played casts** - it readies and casts none.
  **D4/D6: the form was lost** when asked during the first build, or while a door's build was queued. **D5/B6/F12: the
  skin was a storage read every frame** (a file read in the desktop shell) - read at the change.
- **E1: the wolf's key read the person's gear** - the transformation's own unequip, said again a second later, tore the
  standing wolf down ten seconds on. **E2: without Bloodmoon every wolf was retried every 30 s** for ever - a rig, a
  warning and the farthest body evicted each time; refused once per data now, the person's body lingering. **E3: a
  `wb` flipped every pose rebuilt every flip**; a flip back inside `BODY_REBUILD_MS` of a form's body waits it out.
  **E4: the rider layer's skip was the last frame's answer** - the transformation's frame drew nothing (the wereboar's
  too), the wolf's first frame drew it twice; the riders defer the wolf and settle it after the bodies.
- **C2: a robe with no MODL was dropped** (the reader required one; OpenMW does not) - kept, `ARM_RECORDS_VERSION` 3 so
  a stored record set is extracted again, and the garment pool still asks for a model. **C4: the third person's
  ladder was the garments' never-trap reading**, not addPartGroup's - a woman's CNAM miss fell to nothing, a man wore a
  CNAM-only part, a miss claimed nothing (so the robe's missing head drew WerewolfHead); both views share OpenMW's
  ladder now. **C6 / F8: the head, the hair and the chest never bound in any pin** (the fixture skeleton was an arm);
  the fixture's third-person wolf has Head and Chest bones, a head texture of its own with two eyes, the base's bone
  addon and a person's first-person neck to refuse. **C7: the notes** name which Bloodmoon half is missing and the
  wolf's own .kf.
- **F1 / F7 / F9 / F10: the pins.** The skin's road to every screen was unpinned (nine mutants survived the whole
  werewolf set); behavioural pins now cover `setWerewolf`'s skin, both views' uploads, the peer's build, the value at
  the door; the law's constants are held by a golden fingerprint of one fur; the glyph's eye must sit on the head.

**Declined, with the reason.**
- **C3: first-person-only refusals (its parts, the bare `idle`, the Camera/Head bone) refuse the whole wolf**, the
  third person and every peer's with it. OpenMW's first-person werewolf works on Bloodmoon (the camera needs the node;
  it shows the arms), and a rig standing in third person alone is an architectural change to every rig, persons too -
  not an audit's. The first transformation with Bloodmoon is the check; a refusal names its stage on the card.
- **C8: OpenMW's werewolf overlay** (`textures/werewolfoverlay.dds`, a screen fader) is the HUD's, not the body's.
- **E8: a wolf's name height is the race's capsule** - the real wolf's height is Bloodmoon's and not here to measure.
- **E7 was a nit and is fixed** (`failureOf` answers a wolf's refusal); **F13 was unreachable and is fixed anyway** (a
  level short of its size is the mips as they are).

## THE MERGE (2026-09-26, main at c0093f701)

Mac: "Merge". Main had moved on by the Enhanced Plus and Guilds patch and two rounds of field fixes, and two of those
fixes stand on this page's ground.

- **BEAST-SELF** (`02-Formats/Morrowind-Rules.md`, its DECLARED DIVERGENCE): main stood the Morrowind arm and body
  aside for every transformed lycanthrope, because the rig had no beast. It has one here, so the stand-aside is asked
  of the FORM (`combat/weaponRig.js` bindArm, `fpArm.wolfStanding()`): aside while the rig is not the form the curse
  holds - the person while the wolf builds, a wolf refused, a wereboar, the wolf while the person rebuilds after the
  turn back - and never while the wolf stands for a werewolf, whose arm draws in first person and whose body the wheel
  crosses into. A change of form is two edges, each carried by main's camera hand-off; with Eye Of The Beholder off a
  third-person player falls to the first at the change and stays there - BEAST-SELF's own fallback, left as it is.
  Main's pins hold unchanged but for two re-aimed rig mutants (`beastself.json`: the line they cut moved).
- **BEAST-PEER** (`net/remotePlayers.js`): a beast whose art is not up draws nothing and drops the person's doll. A
  peer's wolf body answers `bodyHeight` ahead of that branch, a peer changing form has no body while its wolf builds
  (WEREWOLF1 releases the person's at the change), and DISC23-B's walkers skip a beast, so it composes as
  it stands: never the person on a beast, in any lane.
- **Versions**: RELAY `world117`, ACCOUNT `acct14` - this branch's world114 and acct12 were never deployed and main
  holds world114, world115, acct12 and acct13 (`06-Systems/Accounts-And-Cloud-Saves-Arc.md`, B2); and world116, the
  number the first merge took, went to the Oblivion Gate's WBX, which reached main while this branch sat merged but
  never opened as a pull request (the second merge, 2026-09-27). The widest token
  (AUDIT B8) now carries GUILD1c's three guild claims at their shapes' bounds too: 400 characters of the 512.
