# Morrowind first-person: the rules, from the reference implementation

STATUS: reference only. No code in this tree implements this yet - the
first import arc was reverted whole on 2026-08-28 (see the R7 guard in
test/enhancedMenu.test.js). This file exists so a second attempt starts
from what the engine ACTUALLY does instead of from what seemed
reasonable.

WHY THIS FILE EXISTS. The first attempt shipped three "fixes" for one
bug report and none of them worked. Every one was built on a guess
about Morrowind's conventions, verified against a fixture I had
authored from the same guess, and reported green. The port cites
Daggerfall Unity's C# line by line for everything else in this
repository; the Morrowind layer cited nothing, and that is the whole
difference.

SOURCE: OpenMW, the reference implementation, at master. Citations are
`file:line` and were read directly, not recalled.

---

## 1. A first-person body part is a RECORD, not a filename

```cpp
bool isFirstPersonBodyPart(const BodyPart& value)
{
    return value.mId.endsWith("1st");
}
```
- `components/esm3/loadbody.cpp:85-88`

The discriminator is the **BODY record's ID**. The engine never
transforms a mesh path. It looks up a DIFFERENT RECORD whose id ends
in `1st` and uses that record's own MODL, whatever it happens to be.

In the equipment path the lookup is literally id + ".1st":
```cpp
const char* ext = (mViewMode == VM_FirstPerson) ? ".1st" : "";
bodypart = partStore.search(ESM::RefId::stringRefId(part.mMale.getRefIdString() + ext));
```
- `apps/openmw/mwrender/npcanimation.cpp:879, 901`

FIRST ATTEMPT GOT THIS WRONG IN KIND. It inserted `.1st` before the
file extension of the MODL path (`b\B_N_Nord_M_Hand.nif` ->
`b\B_N_Nord_M_Hand.1st.nif`) and asked the archive for that file. The
engine does not do this, and there is no reason a mesh must be named
that way.

## 2. The naked body table: how parts are chosen

`NpcAnimation::getBodyParts(race, female, firstPerson, werewolf)` -
`npcanimation.cpp:1167-1265`. Over every BODY record:

| Test | Rule | Line |
|---|---|---|
| playable | skip `BPF_NotPlayable` | :1206 |
| type | require `MT_Skin` (not Clothing, not Armor) | :1208 |
| race | must match | :1211 |
| view | `isFirstPersonBodyPart(part) != firstPerson` -> skip | :1256 |
| sex | male parts stand in for missing female ones | :1259+ |

`flagFirstPerson = 1 << 1` at `:1170` is NOT a record flag - it is part
of the memoisation KEY for the race/flags cache. The ESM record's own
flags are only `BPF_Female = 1` and `BPF_NotPlayable = 2`
(`loadbody.hpp`). I misread this once already; the record-id suffix in
rule 1 is the real discriminator.

## 3. The arms are the exception, and it is a FALLBACK rule

```cpp
/* A fallback for the arms if 1st person is missing:
   1. Try to use 3d person skin for same gender
   2. Try to use 1st person skin for male, if female == true
   3. Try to use 3d person skin for male, if female == true */
if (firstPerson && isHand && !partFirstPerson)
```
where `isHand` is `MP_Hand || MP_Wrist || MP_Forearm || MP_Upperarm`.
- `npcanimation.cpp:1217-1253`

So hand/wrist/forearm/upperarm DO get special treatment - but as the
list of parts allowed to fall back to a THIRD-PERSON mesh when the
first-person record is missing. It is not the list of what gets shown.

FIRST ATTEMPT INVERTED THIS: it used those four slots as the selection
rule and never rendered anything else.

## 4. Left and right are SEPARATE parts

```cpp
{ MP_Hand, PRT_RHand }, { MP_Hand, PRT_LHand },
{ MP_Wrist, PRT_RWrist }, { MP_Wrist, PRT_LWrist },
...
```
- `npcanimation.cpp:1197-1207` (a multimap: one mesh part, two slots)

Each side is its own part reference at its own bone.

FIRST ATTEMPT treated a part as one mesh attached at two bones in one
pass, which is a different thing and produced a different transform.

## 5. The bones, verbatim

`NpcAnimation::sPartList`, `npcanimation.cpp:200-260`:

| Part | Bone |
|---|---|
| PRT_RHand / PRT_LHand | `Right Hand` / `Left Hand` |
| PRT_RWrist / PRT_LWrist | `Right Wrist` / `Left Wrist` |
| PRT_RForearm / PRT_LForearm | `Right Forearm` / `Left Forearm` |
| PRT_RUpperarm / PRT_LUpperarm | `Right Upper Arm` / `Left Upper Arm` |
| PRT_Neck | `Neck` |
| PRT_Cuirass | `Chest` |
| PRT_Groin / PRT_Skirt | `Groin` |
| PRT_Head / PRT_Hair | `Head` (hair filters on `Hair`) |
| PRT_Weapon | `Weapon Bone` (fallback; real node depends on weapon type) |
| PRT_Shield | `Shield Bone` |

## 6. The skeleton is chosen by SEX and BEAST - it is not one file

`getActorSkeleton`, `apps/openmw/mwrender/actorutil.cpp:8-32`, with the
names from `files/settings-default.cfg [Models]`:

| Actor | First-person skeleton |
|---|---|
| male, non-beast | `meshes/xbase_anim.1st.nif` |
| female | `meshes/base_anim_female.1st.nif` |
| beast (Khajiit, Argonian) | `meshes/base_animkna.1st.nif` |
| werewolf | `meshes/wolf/skin.1st.nif` |

The animation SOURCE is added separately (`npcanimation.cpp:503-536`):
`xbaseanim1st = meshes/xbase_anim.1st.nif`, with the KF at
`xbaseanim1stkf = meshes/xbase_anim.1st.kf`.

FIRST ATTEMPT hardcoded `meshes\base_anim.1st.nif` - a name that does
not appear anywhere in this table. `base_anim.nif` (no `x`) is the
THIRD-person skeleton; `xbase_anim.nif` is the third-person animation
carrier. This alone would have failed the load on retail data.

## 7. In first person, only head and hair are suppressed

```cpp
if (mViewMode != VM_FirstPerson) { ...add Head... ...add Hair... }
```
- `npcanimation.cpp:650-658`

Everything else in the race's table is present; you do not see the
chest because of where the CAMERA is, not because a filter removed it.

FIRST ATTEMPT excluded the chest deliberately, reasoning it "would clip
the camera". That reasoning described something the engine does not do.

---

# The animation layer

## 8. There are ELEVEN weapon short groups, not four

`apps/openmw/mwmechanics/weapontype.cpp:21-345`, one template
specialisation per type. Read out in full:

| ESM type | short | long group | attach bone |
|---|---|---|---|
| ShortBladeOneHand | `1s` | `shortbladeonehand` | Weapon Bone |
| LongBladeOneHand | `1h` | `weapononehand` | Weapon Bone |
| BluntOneHand | `1b` | `bluntonehand` | Weapon Bone |
| AxeOneHand | `1b` | `bluntonehand` | Weapon Bone |
| LongBladeTwoHand | `2c` | `weapontwohand` | Weapon Bone |
| AxeTwoHand | `2b` | `blunttwohand` | Weapon Bone |
| BluntTwoClose | `2b` | `blunttwohand` | Weapon Bone |
| BluntTwoWide | `2w` | `weapontwowide` | Weapon Bone |
| SpearTwoWide | `2w` | `weapontwowide` | Weapon Bone |
| MarksmanBow | `bow` | `bowandarrow` | **Weapon Bone Left** |
| MarksmanCrossbow | `crossbow` | `crossbow` | Weapon Bone |
| MarksmanThrown | `1t` | `throwweapon` | Weapon Bone |
| HandToHand | `hh` | `handtohand` | - |
| Spell | `spell` | `spellcast` | - |
| PickProbe | `1h` | `pickprobe` | - |
| Arrow | - | - | `Bip01 Arrow` |
| Bolt | - | - | `ArrowBone` |

THE REVERTED ARC HAD FOUR CLASSES: onehand, twohand, twowide, bow. So
`shortbladeonehand`, `bluntonehand`, `blunttwohand`, `throwweapon`,
`crossbow` and `spellcast` did not exist in it at all - every
one-hander was forced onto `weapononehand`, and every two-hander onto
one of two groups.

The `blunttwohand` / `2b` group is the one that matters most for
Daggerfall: two-handed AXES and two-handed close BLUNT live there.
MWAUDIT reasoned that Daggerfall's Staff, Warhammer and Battleaxe were
all "wide" and moved all three to `weapontwowide`. By this table a
two-handed axe is `2b`, not `2w`. The original mapping was wrong and
the correction was wrong in a different direction; neither was read
off anything.

A BOW ATTACHES AT A DIFFERENT BONE - `Weapon Bone Left`. The reverted
code had one `MW_WEAPON_BONE = 'weapon bone'` for every type.

## 9. Group names are composed, and the fallback is a real function

Idle is `"idle" + shortGroup` - `idle1h`, `idle2b`, `idlebow`
(`character.cpp:799-803`). Movement and jump compose the same way
(`:509`, `:674-686`).

The fallback, `CharacterController::fallbackShortWeaponGroup`
(`character.cpp:602-637`):

1. not a real weapon -> the BARE base group, blend mask
   **lower body only**
2. two-handed melee -> base + `2c` (LongBladeTwoHand's short group)
3. otherwise -> base + `1h` (LongBladeOneHand's short group)
4. crossbow -> lower-body mask even when the fallback exists
5. still missing -> bare base group, lower-body mask

The long group falls back the same way (`:573-580`).

MWAUDIT INVENTED A DIFFERENT CHAIN - "the asked-for group, the class
idle, any idle, then whatever the file carries". The real chain has a
fixed two-step ladder and terminates at the bare group. Its tail, "any
idle / the first group in the file", exists nowhere in the engine.

THE BLEND MASK IS THE PART WE HAVE NO CONCEPT OF. When the engine
falls back it plays the animation on the LOWER BODY ONLY. For a
first-person arms rig that is the whole difference between a wrong
animation and no animation on the arms.

## 10. First-person Idle loops 2-5 times

```cpp
// play until the Loop Stop key 2 to 5 times, then play until the Stop key
// this replicates original engine behavior for the "Idle1h" 1st-person animation
numLoops = 1 + Misc::Rng::rollDice(4, prng);
```
- `character.cpp:806-810`

A first-person-specific behaviour, engine-PRNG driven, that the
reverted arc did not have.

## 11. Attack keys are namespaced by the LONG group

```cpp
mAnimation->getTextKeyTime(mCurrentWeapon + ": " + mAttackType + " min attack");
```
- `character.cpp:1241-1242`, where `mCurrentWeapon` is the long group

So the text keys read `weapononehand: chop min attack`, and start/stop
are `<attackType> start` / `<attackType> stop` (`:1635-1636`). A bow's
attack type is the literal `"shoot"` (`:1677`).

`getBestAttack` (`character.cpp:65-78`) picks the type from the WEAPON
RECORD's own damage spread - slash/chop/thrust summed over their min
and max, ties going to slash. That is a data-driven choice the port
would have to make from Daggerfall's own item data instead.

---

# The divergence this port must record, LOUDLY

Daggerfall's weapon taxonomy is not Morrowind's. Any mapping from
Daggerfall's `WEAPON_TYPES` onto the eleven short groups above is a
PORT DECISION, not a ported rule, and belongs in the recorded
divergences with its reasoning visible - not inferred inside a lookup
table where the last attempt hid it twice.

---

# The attachment layer

## 12. Skinned and rigid parts take COMPLETELY different paths

`SceneUtil::attach`, `components/sceneutil/attach.cpp:114-198`, branches
on whether the loaded part is itself a Skeleton:

**Skinned** (`:117-142`) - the part's rig geometry is COPIED onto the
actor's master skeleton and re-bound by bone name. The part's own
skeleton is discarded. It is never parented to a bone.

**Rigid** (`:143-197`) - cloned and parented UNDER the bone, with two
transforms the reverted arc knew nothing about. See 13 and 14.

## 13. The mirror: left-side rigid parts are the mesh with X NEGATED

```cpp
if (attachNode->getName().find("Left") != std::string::npos)
{
    trans->setScale(osg::Vec3f(-1.f, 1.f, 1.f));
    // Need to invert culling because of the negative scale
    trans->setStateSet(frontFaceStateSet);
}
```
- `attach.cpp:166-181`

A substring test for `Left` on the ATTACH BONE's name. One mesh serves
both sides; the left is the right, mirrored, with the front face
flipped so backface culling still works.

MW8 ATTACHED THE SAME MESH AT BOTH BONES WITH NO MIRROR. The left hand
would have been a second right hand, inside-out under culling.

## 14. `BoneOffset` - a named node inside the part mesh

```cpp
FindByNameVisitor findBoneOffset("BoneOffset");
...
trans->setPosition(boneOffset->getMatrix().getTrans());
// Now that we used it, get rid of the redundant node.
```
- `attach.cpp:147-164`

A part may carry a node literally named `BoneOffset` whose matrix
TRANSLATION becomes the attachment offset; the node is then dropped
from the scene. Must be a MatrixTransform or it is a hard error.

Absent from the reverted arc entirely.

## 15. The bone name is also a GEOMETRY FILTER

```cpp
const std::string_view bonefilter = (type == ESM::PRT_Hair) ? "hair" : bonename;
mObjectParts[type] = insertBoundedPart(mesh, bonename, bonefilter, ...);
```
- `npcanimation.cpp:799-802` (hair is the documented sole exception)

and the filter test, `attach.cpp:159-166` of CopyRigVisitor:

```cpp
if (ciStartsWith(name, mFilter)) return true;
constexpr std::string_view prefix = "tri ";
if (ciStartsWith(name, prefix)) return ciStartsWith(name.substr(4), mFilter);
```

Case-insensitive PREFIX match on the drawable's name, with Morrowind's
`Tri ` naming convention stripped first. So a skinned part file
containing both `Tri Left Hand` and `Tri Right Hand` yields the correct
side BY NAME - the filter is how a skinned part picks its side, where a
rigid part uses the mirror in 13.

THIS IS THE DISTINCTION THE REVERTED ARC FUMBLED IN BOTH DIRECTIONS:
it bound skinned parts once with no filter, and attached rigid parts at
both bones with no mirror.

## 16. Bone lookup IS case-insensitive, and duplicates go to the FIRST

```cpp
BoneCache::iterator found = mBoneCache.find(Misc::StringUtils::lowerCase(name));
```
- `components/sceneutil/skeleton.cpp:55-66`, cache built at
  `:23-29` with `mCache.emplace(lowerCase(node.getName()), mPath)`

Lowercased on both sides - so the reverted arc's lowercasing was
CORRECT, and is recorded here as parity confirmed rather than a
correction. `emplace` does not overwrite, so where a skeleton repeats a
bone name the FIRST in depth-first order wins. The cached value is the
whole root-to-node transform path.

## 17. The weapon bone is overridden PER WEAPON TYPE at attach time

`npcanimation.cpp:780-796`: for `PRT_Weapon` the generic `Weapon Bone`
from the part table is replaced by the equipped weapon type's own
`mAttachBone` when that node exists in the actor - which is how a bow
reaches `Weapon Bone Left` (rule 8). The part table's entry is only the
fallback, exactly as its own comment says.

## 18. The `x` prefix on actor models is CONDITIONAL

`Misc::ResourceHelpers::correctActorModelPath`,
`components/misc/resourcehelpers.cpp:180-199`: insert `x` before the
FILENAME, swap `.nif` for `.kf`, and **use the x-form only if that KF
exists in the VFS** - otherwise keep the original path.

This refines rule 6 above, which read as though the names were fixed.
They are not: `base_anim_female.1st.nif` is promoted to
`xbase_anim_female.1st.nif` only when `xbase_anim_female.1st.kf` is
present. The male first-person entry is already x-form in the settings,
so the insert yields a non-existent `xx` name and the original stands.

(`correctMeshPath` is just the `meshes` prefix, `:206-211` - the one
path rule the reverted arc had right.)

---

## What is still unknown

These rules come from the reference implementation. They have NOT been
run against retail Morrowind data - there is none in this environment
and none is obtainable here. Any second attempt must therefore report
what it FINDS in the player's own archives, on screen, in words, rather
than falling back silently and being called fixed.
