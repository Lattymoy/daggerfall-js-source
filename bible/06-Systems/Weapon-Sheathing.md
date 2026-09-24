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
(`Animations/xbase_anim*/xbase_anim_sh.nif`) carrying thirteen new
bones (and one unmarked node the engine never adds). The setting: `weapon sheathing = true` and `use additional anim
sources = true`, which turn on the ENGINE's mechanism - the readme
credits "akortunov and the OpenMW team" for it. So the port vendors
the art (`vendor/weapon-sheathing/`, the mod's own permission: credit
and no fee) and ports the mechanism, in `systems/weaponSheathing.js`,
one home. The MWSE half (Lua) is not applicable; the `Extras/`
alternate draw animations are not vendored (an animation replacer is
a separate slice).

## The mechanism, three laws

1. **The bones** (`mwSkin.js injectSkeletonNodes`, OpenMW's
   injectCustomBones - animation.cpp:1284-1322). Every `.nif` under
   `animations/<model>/` - the base `xbase_anim` folder, then the
   actor's own when it differs, the reference's two calls
   (`boneSourcesFor`) - is a bone addon. Only a node MARKED with a
   "BONE" NiStringExtraData (the loader's CustomBone, nifloader.cpp
   :630-633) joins, under the skeleton's node of its addon PARENT's
   name, with its own local transform and its subtree; an unmarked
   node never; a marked node whose parent the skeleton lacks is
   skipped; a name already present is skipped (the reference adds a
   dead copy the bone cache never answers). The refs are minted past
   any record index (`INJECTED_REF_BASE`), the pose never keys them,
   and skeletonSpaceMatrices poses them at rest - an attach bone. The
   assembly takes the addons before any part binds
   (`assembleFirstPersonArm({ boneSources })`), so a part may attach at
   a bone the addon brought; a file that will not parse is a note.
2. **The holster** (`resolveHolsterParts`, OpenMW's
   updateHolsteredWeapon). A sheathed weapon of type T hangs at
   `SHEATHING_BONE[T]`, weapontype.hpp's sheath-bone column -
   `Bip01 LongBladeTwoClose` for the two-handed long blade, `Bip01
   AxeTwoClose` for the two-handed axe, and `Bip01 LongBladeOneHand`
   for the ONE-handed axe (the addon's `Bip01 AxeOneHand` is a node the
   reference never names). If `<model>_sh.nif` exists it is the scabbard: the whole file
   attaches at that bone and stays (the `sheath` part, the file LESS
   its `Bip01 Weapon` node), its `Bip01 Weapon` node is shown while the
   weapon is sheathed and masked while it is drawn (the `holster` part,
   the file's `Bip01 Weapon` subtree), and if that node is EMPTY the
   base weapon mesh is instanced under it, bare, on the scabbard's
   offset. No scabbard: the base mesh itself hangs at the bone. A
   scabbard with no `Bip01 Weapon` node stands whole and masks nothing.
   A thrown weapon's holster is forced off ("they stack"): its
   scabbard, if one exists, stands with the weapon node masked, and no
   bare mesh. Every WS1 part is a rigid part through the one binder
   (bindPartsInto, with `underNode` / `excludeNode` through bindPart
   into flattenNif, which keeps the full chain from the file root
   either way) and BARE: the reference's attachMesh is a plain instance
   under the bone, so no BoneOffset and no mirror ride a holstered
   mesh.
3. **The quiver** (OpenMW's updateQuiver). A scabbard carrying `Bip01
   Ammo` takes one bare instance of the equipped ammunition's mesh
   under each `Bip01 Ammo N` child, min(count, children) of them -
   arrows for a bow, bolts for a crossbow; the wrong round or none
   fills nothing; the LAST slot empties while a round is on the string
   (the parts carry `{ i, n }`, the hide law reads `arrowShown`). The
   count is the weapon's ammunition in the pack (inventory.js
   `ammoCountFor`, the spend law's own module; a
   peer's build carries none and asks a full quiver when the wire's
   ammo bit is up).

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
tree (eagerly - a table of URLs, no chunk per file) into a `{ has,
get, load, loaded, names }` archive (`makeVendoredArchive`, fetched on
first ask) that dataSource ranks
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
same thirteen marked nodes, and `Bip01 AttachWeapon` unmarked.

**Pins:** test/ws1_sheathing.test.js (12). tools/mutants/ws1.json (35).

## AUDIT-WS (2026-09-17, Mac: "Please audit this")

WS1 recorded its bone-injection rule "from the files, not the
visitor" because no OpenMW checkout was in the session. The audit
fetched the reference (actoranimation.cpp, animation.cpp,
npcanimation.cpp, weapontype.hpp, nifloader.cpp at openmw-0.48.0) and
read the slice against it; Morrowind-Rules.md WS1 is rewritten with
the cites. Six findings, all fixed and pinned:

- **F1 - the one-handed axe's bone.** weapontype.hpp:115 sheathes
  AxeOneHand at `Bip01 LongBladeOneHand`; WS1 used the addon's `Bip01
  AxeOneHand`, a node the reference never names (the two sit at the
  same transform in the addon, so the difference is a name, but 1:1
  is the column).
- **F2 - injection is by the marker, not by absence.**
  GetExtendedBonesVisitor (animation.cpp:218-236) collects nodes
  carrying the loader's CustomBone description - a "BONE"
  NiStringExtraData (nifloader.cpp:630-633) - with their addon parent,
  and loadBonesFromFile (:1284-1304) deep-copies each under the actor's
  node of that parent's name. WS1 added every node the skeleton lacked
  under a known parent, which brought the unmarked `Bip01
  AttachWeapon` too (fourteen where the engine adds thirteen) and
  invented a "transparent root" the reference has no need of.
  `injectSkeletonNodes` rewritten; `hasBoneMarker` walks the extra
  chain as the loader does.
- **F3 - thrown weapons.** The reference does not skip the holster for
  a thrown weapon; it forces `showHolsteredWeapons` off
  (actoranimation.cpp:333-336), so a scabbard that exists still
  attaches with its weapon node masked. WS1 returned nothing. (No
  thrown scabbard ships and nothing in Daggerfall maps to the type,
  so the observable was the same; the law is now the reference's.)
- **F4 - the round on the string.** updateQuiver takes one off the
  count while an arrow is attached (:441-443) and is re-run at every
  attach, release and detach (npcanimation.cpp:1062-1074); WS1's
  quiver was static. The quiver parts now carry their slot index and
  the count, and the rig's hide law empties the last slot while
  `arrowShown`.
- **F6 - holstered meshes are bare.** attachMesh
  (actoranimation.cpp:66-83) is `getInstance(model, parent)`: no
  SceneUtil::attach, so no BoneOffset and no mirror - unlike the
  weapon in the hand. WS1 bound the scabbard and the no-scabbard
  fallback through the offset path; a retail weapon mesh carrying a
  BoneOffset node would have hung displaced. Every WS1 part is `bare`
  now (executed pin on the boneoffset fixture: held, it takes the
  offset; holstered, it does not).
- **F5 - the asset table.** The lazy glob emitted seventy-four
  one-line chunks, a request apiece; the table is eager now, the URLs
  in the module that owns them.

Unchanged and still true: third person only; the enchantment glow
unported; not seen on a GPU here.
