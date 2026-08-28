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

## What is still unknown

These rules come from the reference implementation. They have NOT been
run against retail Morrowind data - there is none in this environment
and none is obtainable here. Any second attempt must therefore report
what it FINDS in the player's own archives, on screen, in words, rather
than falling back silently and being called fixed.
