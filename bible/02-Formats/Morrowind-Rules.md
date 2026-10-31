# Morrowind rules

With the player's own Morrowind data attached (`06-Systems/Morrowind-Assets.md`), the game draws the player's
first-person arms, hands and weapons, and a third-person body, from Morrowind's meshes and clips. The same layer
dresses other players, NPCs and creatures (`04-Characters/Morrowind-NPCs.md`). This page holds the reference's rules
the port follows, the owner's decisions over them, and every departure. The reference is OpenMW, read for its
behaviour: it is GPL, so no code is ported.

## How it works

- **Formats** (`src/formats/morrowind/`): `mwBsaFile.js` (archives, opened by range), `mwNifFile.js` (NIF 4.0.0.2
  only), `mwDdsFile.js` and `mwTexture.js` (textures and the path law), `mwEsmFile.js` (records), `mwNifMesh.js`
  (scene to draw batches), `mwSkin.js` (skeleton, pose, skin), `mwAnim.js` and `mwKeys.js` (text keys, tracks,
  sampling), `mwCharacter.js` and `mwNpc.js` (assembly), `mwFirstPerson.js` (the rule tables and the rig's laws).
- **The rig** (`src/combat/fpArm.js` `createFpArm`, `buildFpArm`): one machine with two rigs, the first-person arms
  and the third-person body. Every clip resolves against the active rig, so `idle1h` comes from `xbase_anim.1st.kf`
  in first person and `xbase_anim.kf` in third. Slots play at the reference's priority order: action over movement
  over jump over idle.
- **Drawing.** First person renders into its own offscreen target through its own lens and is composited over the
  world. Third person draws the body at its feet in the world, at Morrowind's own scale (`MW_UNITS_PER_METER`). A
  piece carries its file's normals through the pose, so a smoothed surface is lit smooth.
- **Camera** (`src/player/mwCamera.js`, `src/player/mwView.js`): the reference's camera machine with its own
  constants. The four hosts ride one seam. The mouse wheel crosses between first and third person.
- **Items** (`src/formats/morrowind/mwItemMap.js`): every Daggerfall weapon, armour and garment against the player's
  Morrowind records, searched by token at runtime.
- **The face**: the head and hair the curated table names (`src/formats/mwFaceTable.json`), else the playable pair
  nearest the classic portrait by measured skin, hair colour, hair length and beard
  (`src/formats/morrowind/mwFaceMatch.js`), else a walk by face index (`playerBodyRows`).
- **On top of the clips:** the held torch and the waist lantern (`06-Systems/Handheld-Torches.md`), the scabbards and
  quiver (`06-Systems/Weapon-Sheathing.md`), the held map (`src/combat/heldPose.js`, `10-UI/Held-Map-Arc.md`), the
  bow's own clock (`src/formats/morrowind/mwPartClock.js`), the ranged aim pitch (`src/combat/spineAim.js`), spell
  effects (`src/formats/morrowind/mwVfx.js`, `mwSpellFx.js`, `src/scenes/mwMagicFx.js`) and the third-person motion
  layer (`04-Characters/Body-Motion.md`).

## Rules

### The reference rules

Code comments cite these by number. Each is OpenMW's behaviour, and the port follows it unless Departures or Open
says otherwise.

*Body parts and bones*
1. A first-person part is a BODY record whose id ends `1st` (`isFirstPersonId`). No mesh path is rewritten.
2. A part is playable, skin type, of the race and of the view. Male parts stand in for missing female ones. The last
   proper match in load order wins (`resolveBodyParts`).
3. Hand, wrist, forearm and upper arm fall back to the third-person record when the `1st` one is missing. On retail
   data this is the main path: a Nord male has a first-person record for the hands alone.
4. Left and right are separate parts at separate bones.
5. Bones: `Right/Left Hand`, `Wrist`, `Forearm`, `Upper Arm`, `Neck`, `Chest`, `Groin`, `Head` (hair filters on
   `Hair`), `Weapon Bone`, `Shield Bone`.
6. The first-person skeleton follows sex and beast: `xbase_anim.1st.nif`, `base_anim_female.1st.nif`,
   `base_animkna.1st.nif`, `wolf/skin.1st.nif` (`FP_SKELETONS`).
7. In first person only the head and hair are left out.

*Animation groups*
8. Eleven weapon short groups. Each type has a short group, a long group and an attach bone. A bow hangs on
   `Weapon Bone Left` (`WEAPON_SHORT_GROUP`, `WEAPON_LONG_GROUP`, `WEAPON_ATTACH_BONE`).
9. A group is base plus short group, through the fallback ladder, gated on a real weapon and on two-handed melee
   (`composeStanceGroup`).
10. The first-person idle wraps `1 + rollDice(4)` times, and only while the stance has a weapon short group.
11. Attack keys sit inside the long group, prefixed by the attack type: `chop start`, `chop max attack`, `chop hit`.
    A bow's type is `shoot` (`attackKeys`).

*Attachment*
12. Skinned parts rebind to the skeleton. Rigid parts hang on a bone. The choice is per file.
13. A left-side rigid part is its mesh with X negated.
14. A node named `BoneOffset` inside a part gives the attach offset, applied after the mirror.
15. The bone name filters a part's geometry (`shapeMatchesBone`).
16. Bone lookup ignores case, and a duplicate name answers the first.
17. The weapon bone is the type's own attach bone where the skeleton has it.
18. An actor model takes the `x` prefix only when that `.kf` exists.

*Skinning and clips*
19. The inverse bind is the NiSkinData bone transform, transposed.
20. `v' = v * (sum of w_i * invBind_i * boneSkelMat_i) * skinToSkel * skinTransform`.
21. A group name is everything before the first `: `.
22. A group's range is searched back from its last key. A `loop start` falls back to `start`.
23. Loop keys are assigned while playing. The loop stop starts at infinity.
24. The key vocabulary after the group name is a closed chain. The port acts on `equip attach`, `unequip detach`, the
    `shoot` keys and the spellcast `release`. Daggerfall's machine owns the hit.
25. A bone's blend mask is the first of three named roots met walking up (`blendMaskBones`).
26. Priority is per bone group, winner takes all in each.
27. `reset` matches start and stop keys in reverse.
28. `playBlendedAnimation` is only a router to `play`.

*First-person view*
29. First person has its own field of view, 60 degrees (`FP_FIELD_OF_VIEW`).
30. The neck controller turns `bip01 neck` by the pitch times `0.75 + 0.25 * aim` about -X.
31. A rotate controller turns in the object root's frame, over the animated matrix (`rootSpaceTurn`).
32. Sneaking sinks the body by `i1stPersonSneakDelta`, through the neck. The Lua camera offset is not ported.
33. A worn part with no `1st` record falls back for arm slots only. Other parts are dropped.
34. The record at index 0 loses its transform unless it is a NiNode named `bip01`.

*Files*
35. Text keys come from any node in a NIF and the first extra in a KF, split on line ends, trimmed and lowercased.
36. A texture path re-roots at `textures` or `bookart`, swaps `.tga` for `.dds` and makes four probes. A miss draws
    the magenta warning texture.
37. Properties gather from the whole ancestor chain, root first. The last wins.
38. Skin weights are stored per bone and inverted to per-vertex lists.
39. Weights are never normalised, clamped, sorted or limited.
40. A missing bone is not fatal.
41. The skin's skeleton root is a name, and it decides which ancestors cancel.
42. A skinned mesh's bounds come from the bones' spheres.
43. Skinning runs once a frame in the cull traversal.
44. A text key blob splits into keys at one time.
45. Case is normalised once, ASCII only. Every later compare is exact.
46. A group starts at its first key. `getTextKeyTime` is a prefix match that answers -1 when absent.
47. A key of another group is dropped, except `sound: ` and `soundgen: `.
48. `play` evicts equal-priority clips. Playing a live group again does not restart it.
49. Each loop is one decrement and a jump to the loop start.
50. Time advances in key-sized steps. Only the lower-body winner moves the actor.
51. A scripted play loops a group with a real `loop start` key or one in the reference's looping set
    (`isLoopingAnimation`, the viewer's path). The player's own paths set their loop fallback per slot.
52. First person draws with depth cleared.
53. First-person meshes take no secondary pass.
54. In first person the camera is the rig's `Camera` node (else `Head`), with no height offset.
55. A NiTransform folds scale into the 3x3, and a chain composes self first.
56. The accumulation root is `bip01` or `root bone`, only where the KF drives it, and the first pick stays.
57. The hidden flag hides and never deletes.
58. A `Bounding Box` subtree is not drawn, except at the root. RootCollisionNode is hidden.
59. Geometry named `shadow` or `tri shadow` is skipped. `tri editormarker` is skipped only under an `MRK` marker.
60. A billboard keeps its translation and scale and drops its stored rotation each frame.
61. Of the seven texture slots, only the base map is a colour map.
62. Alpha blend and alpha test are independent. Disabling one removes the inherited state.
63. A vertex colour replaces the material colour. It never multiplies it.
64. With no material property the default is white diffuse and ambient.
65. The stencil property is the winding. Only draw mode 3 is two-sided.
66. The vertex colour property picks the colour mode. Morrowind NIFs get no specular.

The finer reference rules (keyframe interpolation, TCB and quadratic keys, the slot list, robe and helmet reserves,
the attack's three plays, actor scale, the NIF stream layout) are cited in the modules that port them.

### Owner decisions

- **The goal** (Mac): a whole 3D replacement - the player's look first, then items, weapons, NPCs and enemies.
- **Done means seen.** No stage is done until it is visible on the player's own files. A fixture built from a guess
  proves only the guess.
- **Arms fixed to the screen** (the owner): the arms follow the view as the classic sprite does. The look is not an
  input to the arms pass. Morrowind's look-lag stays in the rig (`setFollowCamera`), with no switch on the card.
- **The movement rate** (Mac, PX29): the rate divides by the playing clip's own source velocity
  (`sourceVelocityOf`), not the reference's walk over all sources (`sourcesVelocity`, kept exported).
- **The backhand** (Mac): `StrikeRight` plays the slash backwards on the same arm (`REVERSED_STRIKES`, `poseTime`).
  No mirror swaps hands.
- **Never an empty hand** (Mac, MW-HAND): while the arm is built, the hand in use follows the weapons
  (`src/combat/playerWeapon.js` `followHeldHand`). H moves only between two held weapons.
- **The arm stands aside for the beast** (Mac, BEAST-SELF): a transformed lycanthrope draws the classic claws and Eye
  Of The Beholder's body (`setStandIn`), unless the rig stands Bloodmoon's werewolf (`wolfStanding`).
- **A blow is paced by Daggerfall's machine** (Mac, MW-PACE1): the attack sections are fitted to the machine's hit
  and end (`blowSchedule`, `blowPace`, `blowRate`). A bow's release is paced to the classic loose (`shotSchedule`).
  A held wind-up, or a blow with no schedule, keeps the record's pace.
- **One cast clock** (Mac, then the owner): `src/systems/castSpeed.js` `castRate` (Speed and the casting-speed loot
  line) sets both lanes. The classic hands step at DFU's 0.04 s (`CAST_FRAME_PERIOD`). The Morrowind hands are paced
  so their `release` falls on classic frame 5 (`castReleaseS`, CAST-PACE).
- **Spell effects** (Mac): drawn from the player's own masters, on by default (`mw-spell-effects`). What a spell does
  stays Daggerfall's.
- **The third-person motion layer** (Mac): `src/characters/bodyMotion/` lays the gait on the legs under a blow and
  eases its own weights. The clips beneath still switch with no cross-fade.
- **Smooth shading** (Mac): a piece is lit by its authored normals. A mesh with none is lit by its faces.
- **Mods' terms are the architecture**: no mod file is bundled without its author's written consent. A player may
  attach loose files beside the archives (`mwLoosePath`).
- **Beast footwear and helmets** are the viewer's choice (`beast-footwear`, `beast-helmets`), As worn by default.
- **Over the shoulder** is the player's option, off by default (`mw-shoulder-camera`).
- **Item map** (Mac): one home for every item, a row for every template and material that says what it draws, and
  a miss that keeps the item drawable and names the miss.

## Departures from the reference

- **Daggerfall's weapons on Morrowind's types** (`DF_TO_MW_WEAPON`): a judgement, keyed by template. Staff is
  BluntTwoWide. Flail is BluntOneHand. Battle Axe draws AxeOneHand and War Axe AxeTwoHand, because Daggerfall's names
  are the reverse of Morrowind's. Claymore and Dai-Katana are two-handed. Materials follow the sprite art's colour
  (`DF_TO_MW_MATERIAL`).
- **The attack type is the gesture** (`DF_STRIKE_TO_MW_ATTACK`): the down strikes chop, the sides slash, up thrusts,
  a bow shoots. `getBestAttack` is not ported: the gesture has already chosen. A swing has no charge, so it releases
  at full strength.
- **The arrow is nocked at the draw** even when the `.kf` lacks `shoot attach`, and the machine's hit waits for the
  arm's `shoot release` (`shotBusy`).
- **A weapon record's mesh must be in the archives**: `pickWeaponRecord` prefers a record whose model is present.
- **Spell effects** are mapped: harm by element, the rest by family, then by school.
- **Sheathing** is drawn (Mac), where the reference keeps it off by default: Weapon Sheathing's assets are vendored.
- **The over-the-shoulder camera** does not pull out as the look rises or the actor speeds up.
- **Beast Footwear Shafts only** draws a boot's ankles where the reference refuses the whole boot.

## Code and tests

- `src/formats/morrowind/` - the readers, assembly, skinning, animation, effects.
- `src/combat/fpArm.js` - the rig, the machine and both draws. `src/combat/weapon/weaponRig.js` - the hand-over each
  frame.
- `src/player/mwCamera.js`, `src/player/mwView.js` - the camera.
- `src/tools/mwInspect.js` (`mw-inspect.html`), `src/tools/mwViewer.js` (`mw-viewer.html`) - what is in the player's
  archives. `tools/mwRigProbe.mjs`, `tools/mwArmProbe.mjs` - where the ink lands on screen.
- `test/formats/morrowind/fparm.test.js` - the rig and machine. `mwnif`, `mwanim`, `mwbsa`, `mwesm`, `mwdds`,
  `mwcharacter`, `mwnifmesh`, `mwmaterial`, `mwinspect`, `mwload_records` tests beside it - the formats.
- `test/formats/morrowind/mwarrow.test.js`, `mwbow1.test.js`, `test/combat/arrowPick.test.js` - the bow.
- `test/combat/reversedSwing.test.js`, `mwhand.test.js`, `mwpace1.test.js`, `mwcast1.test.js`,
  `rpt1026_misc_cast.test.js`, `mwtorch.test.js`, `fb1026c_bowaim.test.js` - the owner's rules in play.
- `test/player/beastself.test.js`, `test/systems/castspeed.test.js`, `test/systems/disc13.test.js`,
  `test/formats/morrowind/mwspellfx1.test.js`, `mwsmooth.test.js`, `mwbeast1_beastboots.test.js`.

## Open

- **Rule 26 in first person**: the slots resolve the whole body. Only the torch's left-arm mask is carried, and the
  motion layer covers third person.
- **The swim family** waits on the port's swimming.
- **Rule 57's second half**: an arm part under a hidden node with a NiVisController is skipped, where the reference
  keeps it for the controller.
- **Rule 43**: the cull-pass double buffer is not ported. The third-person body skins on the GPU
  (`src/formats/morrowind/mwGpuSkin.js`) and the first-person arm on the CPU.
- **The weapon clock** moves the weapon slot alone. Other parts' controllers and the head's clock are not ported.
- **Preview and Vanity cameras** are not ported: no TogglePOV binding and no idle timer.
- **Shield sheathing** and the alternate draw animations are not carried.
- **The held map's pose** (`HELD_POSE_DEFAULT`) turns no bone. The pose Mac settles on in play becomes the default.
- **The viewer's group listing** (`parseAnimGroups`) departs from rules 21, 22 and 44. The player's clips go through
  `resetClip`, which follows them.
