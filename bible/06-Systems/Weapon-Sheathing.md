# Weapon Sheathing - Greatness7's scabbards on the Morrowind body (WS1)

Opened and closed 2026-09-17. Mac handed over the OpenMW archive of
**Weapon Sheathing 1.6** (Greatness7, Nexus morrowind mod 46069):
"Can we implement this for the morrowind model". The port's Morrowind
body - the player's own behind the wheel camera (MW-D24), other
players' online (MWBODY1) - drew a sheathed weapon the way vanilla
Morrowind does: not at all. Now it stays on the body.

## What the mod is, and what was ported

On OpenMW the mod is ART plus a SETTING. The art: seventy-one `_sh`
scabbard meshes (a sheath and a blade for most retail weapons, a
quiver for the bows and crossbows) and three skeleton addons
(`Animations/xbase_anim*/xbase_anim_sh.nif`) carrying fourteen new
bones. The setting: `weapon sheathing = true` and `use additional anim
sources = true`, which turn on the ENGINE's mechanism - the readme
credits "akortunov and the OpenMW team" for it. So the port vendors
the art (`vendor/weapon-sheathing/`, the mod's own permission: credit
and no fee) and ports the mechanism, in `systems/weaponSheathing.js`,
one home. The MWSE half (Lua) is not applicable; the `Extras/`
alternate draw animations are not vendored (an animation replacer is
a separate slice).

## The mechanism, three laws

1. **The bones** (`mwSkin.js injectSkeletonNodes`, OpenMW's
   injectCustomBones). Every `.nif` under `animations/<model>/` - the
   base `xbase_anim` folder, then the actor's own when it differs, as
   the animation sources are listed (`boneSourcesFor`) - is a bone
   addon: a copy of the retail hierarchy carrying new nodes. A node the
   skeleton lacks is added under the skeleton's node of its PARENT's
   name, with the addon's own local transform; nodes the skeleton has
   are left alone; an addon root the skeleton does not carry
   (`xbase_anim_sh.nif` over a rig rooted at `Bip01`) is looked
   through. The refs are minted past any record index
   (`INJECTED_REF_BASE`), the pose never keys them, and
   skeletonSpaceMatrices poses them at rest - an attach bone. The
   assembly takes the addons before any part binds
   (`assembleFirstPersonArm({ boneSources })`), so a part may attach at
   a bone the addon brought; a file that will not parse is a note.
   The exact visitor OpenMW uses was not to hand; the rule is recorded
   as the FILES dictate it (Morrowind-Rules.md WS1).
2. **The holster** (`resolveHolsterParts`, OpenMW's
   updateHolsteredWeapon). A sheathed weapon of type T hangs at
   `SHEATHING_BONE[T]`, weapontype.cpp's mSheathingBone column - the
   addon's node named for the type, `Bip01 LongBladeTwoClose` for the
   two-handed long blade and `Bip01 AxeTwoClose` for the two-handed
   axe. If `<model>_sh.nif` exists it is the scabbard: the whole file
   attaches at that bone and stays (the `sheath` part, the file LESS
   its `Bip01 Weapon` node), its `Bip01 Weapon` node is shown while the
   weapon is sheathed and masked while it is drawn (the `holster` part,
   the file's `Bip01 Weapon` subtree), and if that node is EMPTY the
   base weapon mesh is instanced under it, bare, on the scabbard's
   offset. No scabbard: the base mesh itself hangs at the bone. A
   scabbard with no `Bip01 Weapon` node stands whole and masks nothing.
   Thrown weapons never holster ("they stack"). Both parts are rigid
   parts through the one binder (bindPartsInto, with `underNode` /
   `excludeNode` through bindPart into flattenNif, which keeps the full
   chain from the file root either way); rule 13's mirror applies as
   to everything, and no sheathing bone's name carries "Left".
3. **The quiver** (OpenMW's updateQuiver). A scabbard carrying `Bip01
   Ammo` takes one bare instance of the equipped ammunition's mesh
   under each `Bip01 Ammo N` child, min(count, children) of them -
   arrows for a bow, bolts for a crossbow; the wrong round or none
   fills nothing. The count is the Daggerfall arrow stack
   (`daggerfallArrowCount`; a peer's build carries none and asks a
   full quiver when the wire's ammo bit is up).

**Where it shows.** Third person only: the first-person skeleton has
no addon (the mod ships none for `xbase_anim.1st`) and the reference
draws no holster there. The rig's three hide sites take the three
slots (`holsterHidden`): the holster shows while the weapon is NOT
shown in the hand (updateHolsteredWeapon(!mShowWeapons)) - so it
appears at the "unequip detach" key and vanishes at "equip attach",
the same moments the hand's blade swaps - and the scabbard and the
quiver always. The portrait (`figure`) shows the weapon in the hand
and so an empty scabbard. Peers ride the same rig (`setSheathed` off
the wire drives the same flag). A weapon swap re-resolves the three
slots with the weapon's (`setWeapon`).

**The files.** `systems/weaponSheathingAssets.js` globs the vendored
tree into a `{ has, get, load, loaded, names }` archive
(`makeVendoredArchive`, fetched on first ask) that dataSource ranks
AFTER the player's own loose files (a replacer wins) and BEFORE every
`.bsa`; `mwLoosePath` now keys `animations/` so a player who attaches
the mod themselves lands its addon where the listing looks. The
switch is a Features row, `mod-weapon-sheathing` (RF4: the pref
`mwSheathing` declared once, on by default, forced on online as the
arms are); the Mods page's Morrowind card carries it beside "Use
Morrowind assets" and rebuilds the body when it moves.

**Not seen on a GPU.** This session has no Morrowind data; the pins
run the real vendored files through the real parser, injector, binder
and assembly, and the rig's wiring is pinned by source. The
placement's correctness on a retail rig - the blade at the hip, the
bow across the back - is Mac's to confirm.

**The census** (pinned): all seventy-one scabbards carry `Bip01
Sheath` and a `Bip01 Weapon` with geometry (the Crescent's is a
NiBSAnimationNode over an empty sheath); twelve carry quivers of five
to seven slots (the bows and crossbows); the three addons carry the
same fourteen nodes, thirteen marked "BONE" and `Bip01 AttachWeapon`
not.

**Pins:** test/ws1_sheathing.test.js (11). tools/mutants/ws1.json (23).
