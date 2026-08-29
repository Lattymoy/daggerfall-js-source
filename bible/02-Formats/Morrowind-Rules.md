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

Superseded by Part III below, which is specific. The general statement
stands: none of this has been run against retail Morrowind data, because
there is none in this environment. Rules read off the reference
implementation are not the same as behaviour observed on a player's own
archives, and the difference is exactly what the first arc got wrong.

---

# Part II - the fan-out, and how much of it survived

MW-R4 (2026-08-29). Six readers over the OpenMW subsystems the first three
passes had not reached, then EVERY extracted rule put through three
independent verifiers told to refute by default: one re-fetches the cited
file and checks the quote is really there, one checks the rule follows from
the code rather than overreaching, one hunts for callers or special cases
elsewhere that override it. 151 agents.

    48 rules extracted
    19 unanimous  - all three lenses confirmed
    29 disputed   - the mechanism confirmed, a caveat recorded
     0 refuted    - nothing was found to be simply false

THE DISPUTE RATE IS THE POINT. Almost every objection is of one shape:
"the mechanism is right, but you stated a conditional as unconditional."
That is precisely the error that sank the first arc - a rule that is true
in the case you looked at, written down as though it were true always. A
disputed rule below is NOT unreliable; it is a rule whose caveat is now
written next to it instead of being discovered in production.

ONE VERIFIER WAS ITSELF WRONG and it is recorded here rather than quietly
dropped: the objection to "skeleton space is the MatrixTransform product"
argues the cited code does not exist, having searched THIS repository - a
JavaScript Daggerfall port - for OpenMW's C++. The rule stands; the
objection was looking in the wrong tree. Verification catches errors in
both directions and neither direction is automatically right.

# Unanimous - confirmed by all three lenses

## 19. The inverse bind matrix is the per-bone NiSkinData transform, TRANSPOSED into row-vector form
- `components/nif/niftypes.hpp:68-84` - NIF skinning, importance **critical**

There is no matrix inversion anywhere at load: NiSkinData::BoneInfo::mTransform IS the inverse bind matrix (skin space -> bone space) and is used as read (nifloader.cpp:1708). The only conversion is NiTransform::toMatrix: transform(j, i) = mRotation.mValues[i][j] * mScale, with the translation placed in the LAST ROW via setTrans. That is OSG's row-vector convention: a point is transformed as v' = v * M (osg::Matrixf::preMult(vec) computes exactly Sum_i v_i*M[i][j] + M[3][j] - OpenSceneGraph include/osg/Matrixf:725-731), and a product A*B means 'apply A, then B'. So the port's matrix is [transpose(NIF 3x3) * uniform scale ; translation in row 3]; the NIF 3x3 itself may already contain non-uniform or negative scale (comment at niftypes.hpp:70), so it must be transposed wholesale rather than decomposed. The same conversion is applied to NiSkinData's own overall transform (nifloader.cpp:1715) and to every node transform. A port that stores column-vector matrices must transpose the 4x4 AND reverse every product order given in the following rules.

```cpp
    struct NiTransform
    {
        Matrix3 mRotation; // this can contain scale components too, including negative and nonuniform scales
        osg::Vec3f mTranslation;
        float mScale;

        osg::Matrixf toMatrix() const
        {
            osg::Matrixf transform;
            transform.setTrans(mTranslation);

            for (int i = 0; i < 3; ++i)
                for (int j = 0; j < 3; ++j)
                    transform(j, i) = mRotation.mValues[i][j] * mScale; // NB column/row major difference

            return transform;
        }
```

## 20. The per-frame vertex formula: v' = v * (Sum w_i * invBind_i * boneSkelMat_i) * skinToSkel * skinTransform
- `components/sceneutil/riggeometry.cpp:172-210` - NIF skinning, importance **critical**

For each distinct influence set the engine builds one matrix and reuses it for every vertex carrying that set. Steps, in order: (1) per bone, boneMat_i = invBind_i * boneMatrixInSkeletonSpace_i (apply inverse bind first, then the bone's current skeleton-space matrix); bones that did not resolve to a skeleton node are left as the default-constructed identity but are skipped at blend time. (2) resultMat starts as all zeros except m[15] = 1 and accumulates Sum_i (boneMat_i * w_i) ELEMENT-WISE, skipping every index where i % 4 == 3 - i.e. the projective last column is not blended and stays [0,0,0,1]; a bone whose node is null contributes nothing and its weight is NOT redistributed. (3) resultMat = resultMat * transform, where transform = skinToSkelMatrix * NiSkinData's overall mTransform when a skin-to-skeleton matrix exists, otherwise just that overall transform. (4) positions: dst[v] = resultMat.preMult(src[v]), i.e. v * resultMat. (5) normals and tangents use the SAME matrix's upper 3x3 via transform3x3(v, resultMat) - no inverse-transpose, no renormalisation, tangent.w carried through unchanged. Skinning always reads from the untouched source arrays, so every frame starts from bind-pose coordinates; the destination is a double-buffered deep copy (riggeometry.cpp:58-92).

```cpp
        std::vector<osg::Matrixf> boneMatrices(mNodes.size());
        std::vector<Bone*>::const_iterator bone = mNodes.begin();
        std::vector<BoneInfo>::const_iterator boneInfo = mData->mBones.begin();
        for (osg::Matrixf& boneMat : boneMatrices)
        {
            if (*bone != nullptr)
                boneMat = boneInfo->mInvBindMatrix * (*bone)->mMatrixInSkeletonSpace;
            ++bone;
            ++boneInfo;
        }

        osg::Matrixf transform;
        if (mSkinToSkelMatrix)
            transform = (*mSkinToSkelMatrix) * mData->mTransform;
        else
            transform = mData->mTransform;

        for (const auto& [influences, vertices] : mData->mInfluences)
        {
            osg::Matrixf resultMat(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1);

            for (const auto& [index, weight] : influences)
            {
                if (mNodes[index] == nullptr)
                    continue;
                const float* boneMatPtr = boneMatrices[index].ptr();
                float* resultMatPtr = resultMat.ptr();
                for (int i = 0; i < 16; ++i, ++resultMatPtr, ++boneMatPtr)
                    if (i % 4 != 3)
                        *resultMatPtr += *boneMatPtr * weight;
            }

            resultMat *= transform;

            for (unsigned short vertex : vertices)
            {
                (*positionDst)[vertex] = resultMat.preMult((*positionSrc)[vertex]);
                if (normalDst)
                    (*normalDst)[vertex] = osg::Matrixf::transform3x3((*normalSrc)[vertex], resultMat);
```

## 21. The group name is everything before the FIRST ": " — colon plus one space, and nothing else is a separator
- `components/sceneutil/textkeymap.hpp:29-47` - Text keys and .kf, importance **critical**

SceneUtil::TextKeyMap::emplace derives the group by find(": ") — colon followed by exactly one space — and takes substr(0, separator). A key with no ": " registers NO group (it is still stored in the time multimap, it just never appears in mGroups). mGroups is a std::set<std::string,std::less<>>, i.e. sorted and deduplicated, and it IS the engine's list of available animations: Animation::addSingleAnimSource copies it into mSupportedAnimations (apps/openmw/mwrender/animation.cpp:705-707) and Animation::hasAnimation is nothing but a lookup in that set (animation.cpp:787-790). So "does this KF have group X" means literally "does some text key in it begin with 'x: '", and the group is the prefix, never a suffix or a whole-string match. Note find() is the FIRST occurrence, so "weapononehand: chop min attack" has group "weapononehand", and a hypothetical "a: b: c" has group "a".

```cpp
        void emplace(float time, std::string&& textKey)
        {
            const auto separator = textKey.find(": ");
            if (separator != std::string::npos)
                mGroups.emplace(textKey.substr(0, separator));

            mTextKeyByTime.emplace(time, std::move(textKey));
        }

        bool empty() const noexcept { return mTextKeyByTime.empty(); }

        auto findGroupStart(std::string_view groupName) const
        {
            return std::find_if(mTextKeyByTime.begin(), mTextKeyByTime.end(), IsGroupStart{ groupName });
        }

        bool hasGroupStart(std::string_view groupName) const { return mGroups.count(groupName) > 0; }

        const std::set<std::string, std::less<>>& getGroups() const { return mGroups; }
```

## 22. A group's time range: search BACKWARDS from the group's last key; stop-key match is length-truncated; "loop start" falls back to "start"
- `apps/openmw/mwrender/animation.cpp:971-1022` - Text keys and .kf, importance **critical**

Animation::reset derives [mStartTime, mStopTime] for a play request, given a group and the caller's start/stop key names (usually "start"/"stop"). Algorithm, exactly: (1) scan the whole time-ordered multimap in REVERSE to find `groupend`, the LAST key in time whose text is `<group>` + ": " — the comment says this exists because undeadwolf_2.nif has two separate walkforward key blocks and the later one wins. (2) From groupend, continue backwards for the start key, matched as EXACTLY `<group>` + ": " + `<start>`. (3) If that fails AND the requested start was literally "loop start", retry from groupend for `<group>: start`. (4) From groupend, backwards again for the stop key — but the candidate is first TRUNCATED to groupname.size()+2+stop.size() before comparison, deliberately tolerating trailing garbage (the Scrib's "Idle3: Stop."). This tolerance applies to the STOP key only; the start key must match exactly. (5) If either key is missing, or startkey time > stopkey time, reset returns false and Animation::play moves on to the NEXT anim source (animation.cpp:919-965, iterating mAnimSources in reverse — last-added source has priority). mStartTime/mStopTime are those two key times, and the initial playhead is start + (stop-start)*startpoint.

```cpp
        // Look for text keys in reverse. This normally wouldn't matter, but for some reason undeadwolf_2.nif has two
        // separate walkforward keys, and the last one is supposed to be used.
        auto groupend = keys.rbegin();
        for (; groupend != keys.rend(); ++groupend)
        {
            if (groupend->second.starts_with(groupname) && groupend->second.compare(groupname.size(), 2, ": ") == 0)
                break;
        }

        auto startkey = groupend;
        while (startkey != keys.rend() && !equalsParts(startkey->second, groupname, ": ", start))
            ++startkey;
        if (startkey == keys.rend() && start == "loop start")
        {
            startkey = groupend;
            while (startkey != keys.rend() && !equalsParts(startkey->second, groupname, ": start"))
                ++startkey;
        }
        if (startkey == keys.rend())
            return false;

        auto stopkey = groupend;
        std::size_t checkLength = groupname.size() + 2 + stop.size();
        while (stopkey != keys.rend()
            // We have to ignore extra garbage at the end.
            // The Scrib's idle3 animation has "Idle3: Stop." instead of "Idle3: Stop".
            // Why, just why? :(
            && !equalsParts(std::string_view{ stopkey->second }.substr(0, checkLength), groupname, ": ", stop))
            ++stopkey;
        if (stopkey == keys.rend())
            return false;

        if (startkey->first > stopkey->first)
            return false;
```

## 23. "loop start"/"loop stop" are assigned WHILE PLAYING, and mLoopStopTime starts at FLT_MAX
- `apps/openmw/mwrender/animation.cpp:1009-1040` - Text keys and .kf, importance **high**
- REFINES OR CORRECTS RECORDED RULE 10

The loop window is not read out of the file up front. In reset, mLoopStartTime is seeded to the start-key time and mLoopStopTime to std::numeric_limits<float>::max() (unless the caller passed loopfallback, in which case the loop window is just the whole start..stop range). Only two things narrow it: (a) Animation::handleTextKey, called for every key the playhead crosses, sets mLoopStartTime/mLoopStopTime when it crosses `<playing group>: loop start` / `: loop stop` (animation.cpp:861-868); (b) reset's back-fill loop, which walks backwards from groupend and applies any loop start/stop key at or before the initial playhead, for the case where startpoint already skipped past them. Looping itself is `getTime() >= mLoopStopTime && mLoopingEnabled && mLoopCount > 0` (animation.hpp:177), so with mLoopStopTime = FLT_MAX a group with no "loop stop" key never wraps early — it simply plays to mStopTime. This is the mechanism under recorded rule 10 (first-person Idle plays to Loop Stop 2-5 times): the loop is driven by the KEYS crossed at runtime, not by a range computed at load.

```cpp
        state.mStartTime = startkey->first;
        if (loopfallback)
        {
            state.mLoopStartTime = startkey->first;
            state.mLoopStopTime = stopkey->first;
        }
        else
        {
            state.mLoopStartTime = startkey->first;
            state.mLoopStopTime = std::numeric_limits<float>::max();
        }
        state.mStopTime = stopkey->first;

        state.setTime(state.mStartTime + ((state.mStopTime - state.mStartTime) * startpoint));

        // mLoopStartTime and mLoopStopTime normally get assigned when encountering these keys while playing the
        // animation (see handleTextKey). But if startpoint is already past these keys, or start time is == stop time,
        // we need to assign them now.

        auto key = groupend;
        for (; key != startkey && key != keys.rend(); ++key)
        {
            if (key->first > state.getTime())
                continue;

            if (equalsParts(key->second, groupname, ": loop start"))
                state.mLoopStartTime = key->first;
            else if (equalsParts(key->second, groupname, ": loop stop"))
                state.mLoopStopTime = key->first;
        }
```

## 24. The action vocabulary after "<group>: " is a closed if/else chain, and "hit" has a start-key fallback
- `apps/openmw/mwmechanics/character.cpp:1074-1146` - Text keys and .kf, importance **high**
- REFINES OR CORRECTS RECORDED RULE 11

Once the group prefix is stripped, `action` is matched against exact strings, first match wins, no default branch: "equip attach", "unequip detach", "chop hit"/"slash hit"/"thrust hit"/"hit", "start" (only when the group is one of attack1/2/3 or swimattack1/2/3), "shoot attach", "shoot release", "shoot follow attach", `<mAttackType> release` (only when group == "spellcast"), "loot" (only when group == "containeropen"). Anything else falls off the end and does nothing. Two details a port will get wrong otherwise: (a) the bare "hit" action carries no attack type of its own — the type comes from the GROUP NAME, attack1/swimattack1 -> Chop, attack2 -> Slash, attack3 -> Thrust; (b) for those same random-attack groups, on the "start" key the engine scans FORWARD through the map for `<group>: hit`, stopping early at `<group>: stop`, and if no hit key exists in that window the hit is delivered on the START key instead. Also note "min attack"/"max attack"/"min hit" are NOT in this dispatch chain at all — they are never handled as events; they are only ever polled by time via getTextKeyTime (character.cpp:1241-1242, 1767-1780, 1879-1880), which is why recorded rule 11's `<longgroup>: <attacktype> min attack` form is a QUERY string, not a handled action.

```cpp
        else if (action == "chop hit" || action == "slash hit" || action == "thrust hit" || action == "hit")
        {
            int attackType = -1;
            if (action == "hit")
            {
                if (groupname == "attack1" || groupname == "swimattack1")
                    attackType = ESM::Weapon::AT_Chop;
                else if (groupname == "attack2" || groupname == "swimattack2")
                    attackType = ESM::Weapon::AT_Slash;
                else if (groupname == "attack3" || groupname == "swimattack3")
                    attackType = ESM::Weapon::AT_Thrust;
            }
...
        else if (isRandomAttackAnimation(groupname) && action == "start")
        {
            std::multimap<float, std::string>::const_iterator hitKey = key;

            // Not all animations have a hit key defined. If there is none, the hit happens with the start key.
            bool hasHitKey = false;
            while (hitKey != map.end())
            {
                if (hitKey->second.starts_with(groupname))
                {
                    std::string_view suffix = std::string_view(hitKey->second).substr(groupname.size());
                    if (suffix == ": hit")
                    {
                        hasHitKey = true;
                        break;
                    }
                    if (suffix == ": stop")
                        break;
                }
                ++hitKey;
            }
```

## 25. BlendMask is a 4-bit set, and a bone's bit is decided by walking ancestors for three literal names
- `apps/openmw/mwrender/animation.cpp:592-616` - Animation playback, importance **critical**
- REFINES OR CORRECTS RECORDED RULE 9

There are exactly four discrete blend masks, held as a bitfield: LowerBody = 1<<0, Torso = 1<<1, LeftArm = 1<<2, RightArm = 1<<3; UpperBody = Torso|LeftArm|RightArm; All = LowerBody|UpperBody (apps/openmw/mwrender/blendmask.hpp:8-20). Which mask a given animated bone belongs to is NOT stored per animation and is NOT a list of bone names. It is computed once per bone, at animation-source load time, by Animation::detectBlendMask: starting at the bone's node, walk up parents until mObjectRoot, and at each ancestor compare that ancestor's node name (exact, case-SENSITIVE ==, no lowercasing) against exactly three strings - "Bip01 Spine1" (index 1 = Torso), "Bip01 L Clavicle" (index 2 = LeftArm), "Bip01 R Clavicle" (index 3 = RightArm). Index 0 (the empty string, lower body / character root) is deliberately skipped by the loop (`for (size_t i = 1; ...)`) and is the fallback returned when no ancestor matches. So: everything under Bip01 Spine1 but not under a clavicle is Torso; everything under a clavicle is that arm (the arm test wins because the clavicle is encountered before the spine on the way up); everything else - pelvis, legs, tail, the root - is LowerBody. The Collada path also accepts a match on the KeyframeController's own name. The returned value is a mask INDEX 0..3 (== the BoneGroup enum, bonegroup.hpp:8-12), and membership is later tested as `mBlendMask & (1 << index)` (animation.hpp:176). Result: the per-bone controllers are bucketed into animsrc->mControllerMap[blendMask] at addAnimSource time (animation.cpp:693-700), so a JS port must do this partition once per (skeleton, kf) pair, not per play() call.

```cpp
    // controllerName is used for Collada animated deforming models
    size_t Animation::detectBlendMask(const osg::Node* node, const std::string& controllerName) const
    {
        static const std::string_view sBlendMaskRoots[sNumBlendMasks] = {
            "", /* Lower body / character root */
            "Bip01 Spine1", /* Torso */
            "Bip01 L Clavicle", /* Left arm */
            "Bip01 R Clavicle", /* Right arm */
        };

        while (node != mObjectRoot)
        {
            const std::string& name = node->getName();
            for (size_t i = 1; i < sNumBlendMasks; i++)
            {
                if (name == sBlendMaskRoots[i] || controllerName == sBlendMaskRoots[i])
                    return i;
            }

            assert(node->getNumParents() > 0);

            node = node->getParent(0);
        }

        return 0;
    }

// apps/openmw/mwrender/blendmask.hpp:8-20
    enum BlendMask
    {
        BlendMask_LowerBody = 1 << 0,
        BlendMask_Torso = 1 << 1,
        BlendMask_LeftArm = 1 << 2,
        BlendMask_RightArm = 1 << 3,

        BlendMask_UpperBody = BlendMask_Torso | BlendMask_LeftArm | BlendMask_RightArm,

        BlendMask_All = BlendMask_LowerBody | BlendMask_UpperBody
    };
    /* This is the number of *discrete* blend masks. */
    static constexpr size_t sNumBlendMasks = 4;

// apps/openmw/mwrender/animation.cpp:691-700 (where it is applied, once, per bone)
            size_t blendMask = detectBlendMask(node, it->second->getName());

            // clone the controller, because each Animation needs its own ControllerSource
            osg::ref_ptr<SceneUtil::KeyframeController> cloned
                = osg::clone(it->second.get(), osg::CopyOp::SHALLOW_COPY);
            cloned->setSource(mAnimationTimePtr[blendM
...(truncated; see the cited lines)
```

## 26. Priority is a four-element vector, one per bone group, and is resolved winner-takes-all PER bone group
- `apps/openmw/mwrender/animation.cpp:1126-1142` - Animation playback, importance **critical**

AnimPriority is not a scalar: it holds one int per BoneGroup (animationpriority.hpp:10-40); the int constructor merely fills all four slots with the same value, and operator== compares all four. Resolution happens in Animation::resetActiveGroups(), which runs once after every play/disable and loops over the four blend masks independently. For each mask it scans mStates - a std::map<std::string, AnimState, std::less<>>, i.e. iterated in LEXICOGRAPHIC ORDER OF GROUP NAME (animation.hpp:180) - skipping states whose mBlendMask lacks that bit, and keeps the state with the strictly greatest mPriority[thatBoneGroup]. The comparison is `<`, so a TIE keeps the FIRST state found, i.e. the alphabetically-first group name. Exactly one state wins each bone group; the losers contribute NOTHING to those bones (their controllers are simply not attached). Consequently two animations on the same bone never blend by weight - the higher priority replaces the lower outright on that bone group, and one animation can own the legs while a different one owns an arm. The winner's shared time pointer is installed as mAnimationTimePtr[mask], so every bone in a mask reads the winner's clock. The accumulation root is only tracked when blendMask == 0 (animation.cpp:1177), so only the LOWER-BODY winner drives movement. Priority values are the enum in apps/openmw/mwmechanics/character.hpp:28-45, in ascending order: Default=0, WeaponLowerBody, SneakIdleLowerBody, SwimIdle, Jump, Movement, Hit, Weapon, Block, Knockdown, Torch, Storm, Death, Scripted=13.

```cpp
        for (size_t blendMask = 0; blendMask < sNumBlendMasks; blendMask++)
        {
            AnimStateMap::const_iterator active = mStates.end();

            AnimStateMap::const_iterator state = mStates.begin();
            for (; state != mStates.end(); ++state)
            {
                if (!state->second.blendMaskContains(blendMask))
                    continue;

                if (active == mStates.end()
                    || active->second.mPriority[(BoneGroup)blendMask] < state->second.mPriority[(BoneGroup)blendMask])
                    active = state;
            }

            mAnimationTimePtr[blendMask]->setTimePtr(
                active == mStates.end() ? std::shared_ptr<float>() : active->second.mTime);

// apps/openmw/mwrender/animationpriority.hpp:10-39
    struct AnimPriority
    {
        /// Convenience constructor, initialises all priorities to the same value.
        AnimPriority(int priority)
        {
            for (unsigned int i = 0; i < sNumBlendMasks; ++i)
                mPriority[i] = priority;
        }

        bool operator==(const AnimPriority& other) const
        {
            for (unsigned int i = 0; i < sNumBlendMasks; ++i)
                if (other.mPriority[i] != mPriority[i])
                    return false;
            return true;
        }

        int& operator[](BoneGroup n) { return mPriority[n]; }

// apps/openmw/mwrender/animation.hpp:176
            bool blendMaskContains(size_t blendMask) const { return (mBlendMask & (1 << blendMask)); }
```

## 27. reset(): start/stop keys are matched in reverse by time, with a 'loop start'->'start' fallback and a truncated stop compare
- `apps/openmw/mwrender/animation.cpp:971-1040` - Animation playback, importance **high**

Animation::reset resolves the start and stop key names against one animation source's text-key multimap (ordered by TIME) and is the sole gate on whether a group exists in that source. The search is REVERSE, i.e. from the latest key backwards, and the comment gives the reason (undeadwolf_2.nif has two walkforward key sets; the LAST one wins). Steps: find `groupend` = the last key whose text starts with `"<group>"` followed by `": "`; from there search backwards for an exact `"<group>: <start>"`; if that fails AND the requested start was literally "loop start", retry the same backwards search for `"<group>: start"` (this is the only start-key fallback that exists). For the stop key the comparison is made on only the first groupname.size()+2+stop.size() characters, deliberately tolerating trailing garbage - the cited case is the Scrib's "Idle3: Stop." with a trailing period. Missing start key, missing stop key, or startkey time > stopkey time each return false and the caller moves to the next (older) animation source. On success mStartTime/mStopTime are the two key times and the playhead is set to `mStartTime + (mStopTime - mStartTime) * startpoint`, so startPoint is a 0..1 fraction of the START->STOP span (not of the loop span). Finally it re-scans keys between groupend and startkey whose time is <= the computed playhead to pick up any "loop start"/"loop stop" that startPoint has already skipped past. All comparisons are plain case-sensitive string equality via equalsParts (animation.cpp:169-178), which is safe only because both the text keys and the group names are lowercased at load.

```cpp
        // Look for text keys in reverse. This normally wouldn't matter, but for some reason undeadwolf_2.nif has two
        // separate walkforward keys, and the last one is supposed to be used.
        auto groupend = keys.rbegin();
        for (; groupend != keys.rend(); ++groupend)
        {
            if (groupend->second.starts_with(groupname) && groupend->second.compare(groupname.size(), 2, ": ") == 0)
                break;
        }

        auto startkey = groupend;
        while (startkey != keys.rend() && !equalsParts(startkey->second, groupname, ": ", start))
            ++startkey;
        if (startkey == keys.rend() && start == "loop start")
        {
            startkey = groupend;
            while (startkey != keys.rend() && !equalsParts(startkey->second, groupname, ": start"))
                ++startkey;
        }
        if (startkey == keys.rend())
            return false;

        auto stopkey = groupend;
        std::size_t checkLength = groupname.size() + 2 + stop.size();
        while (stopkey != keys.rend()
            // We have to ignore extra garbage at the end.
            // The Scrib's idle3 animation has "Idle3: Stop." instead of "Idle3: Stop".
            // Why, just why? :(
            && !equalsParts(std::string_view{ stopkey->second }.substr(0, checkLength), groupname, ": ", stop))
            ++stopkey;
        if (stopkey == keys.rend())
            return false;

        if (startkey->first > stopkey->first)
            return false;

        state.mStartTime = startkey->first;
        ...
        state.mStopTime = stopkey->first;

        state.setTime(state.mStartTime + ((state.mStopTime - state.mStartTime) * startpoint));

        // mLoopStartTime and mLoopStopTime normally get assigned when encountering these keys while 
...(truncated; see the cited lines)
```

## 28. playBlendedAnimation is only a router - it does no blending and has the identical signature to play()
- `apps/openmw/mwmechanics/character.cpp:2610-2620` - Animation playback, importance **medium**

CharacterController::playBlendedAnimation is NOT a second, blending-aware playback path. It takes exactly the arguments of Animation::play and either forwards them verbatim to Animation::play, or, when Lua animations are active for this actor (mLuaAnimations), hands the same arguments to the Lua manager so scripts can intercept. Any port must not invent blend semantics from the name: the only 'blending' in this layer is the per-bone-group winner-takes-all selection of rule (B). The corresponding Lua entry point anim.playBlended (apps/openmw/mwlua/animationbindings.cpp:215-231) fixes the DEFAULTS that the rest of the engine implicitly assumes: loops = 0, priority = Priority_Default, blendMask = BlendMask_All, autoDisable = true, speed = 1.0, startKey = "start", stopKey = "stop", startPoint = 0.0, and loopFallback = forceLoop || isLoopingAnimation(group). It also LOWERCASES the group name before calling play, which is what makes reset()'s case-sensitive comparisons work against the lowercased text keys. (Separately, note the smooth cross-fade in resetActiveGroups is an OPTIONAL non-vanilla feature gated on Settings::game().mSmoothAnimTransitions, animation.cpp:1155-1170 - vanilla behaviour is a hard cut.)

```cpp
    void CharacterController::playBlendedAnimation(const std::string& groupname, const MWRender::AnimPriority& priority,
        int blendMask, bool autodisable, float speedmult, std::string_view start, std::string_view stop,
        float startpoint, uint32_t loops, bool loopfallback) const
    {
        if (mLuaAnimations)
            MWBase::Environment::get().getLuaManager()->playAnimation(mPtr, groupname, priority, blendMask, autodisable,
                speedmult, start, stop, startpoint, loops, loopfallback);
        else
            mAnimation->play(
                groupname, priority, blendMask, autodisable, speedmult, start, stop, startpoint, loops, loopfallback);
    }

// apps/openmw/mwlua/animationbindings.cpp:215-231
        api["playBlended"] = [](const SelfObject& object, std::string_view groupName, const sol::table& options) {
            uint32_t loops = options.get_or("loops", 0u);
            MWRender::Animation::AnimPriority priority = getPriorityArgument(options);
            BlendMask blendMask = options.get_or("blendMask", BlendMask::BlendMask_All);
            bool autoDisable = options.get_or("autoDisable", true);
            float speed = options.get_or("speed", 1.0f);
            std::string start = options.get_or<std::string>("startKey", "start");
            std::string stop = options.get_or<std::string>("stopKey", "stop");
            float startPoint = options.get_or("startPoint", 0.0f);
            bool forceLoop = options.get_or("forceLoop", false);

            const std::string lowerGroup = Misc::StringUtils::lowerCase(groupName);

            auto animation = getMutableAnimationOrThrow(object);
            animation->play(lowerGroup, priority, blendMask, autoDisable, speed, start, stop, startPoint, loops,
                forceLoop |
...(truncated; see the cited lines)
```

## 29. First-person meshes are rendered with their OWN field of view (default 60.0 deg), injected by a cull callback
- `apps/openmw/mwrender/npcanimation.cpp:373-414, 542-547` - First-person specifics, importance **critical**

The first-person object root carries an OverrideFieldOfViewCallback as a CULL callback (added in updateNpcBase, only when is1stPerson). During cull it reads the current projection's perspective params; if |currentFov - mFov| > 0.001 it rebuilds a perspective matrix with fov = mFov and the SAME aspect/zNear/zFar, post-multiplies the RenderingManager's projection offset (offsetX = offset.x/viewport.width*2, offsetY likewise), then pushes modelView' = modelView * newProj * inverse(oldProj) as an ABSOLUTE_RF modelview for the subtree and pops it after traversal. If the FOVs already match it just traverses. The value comes from Settings::camera().mFirstPersonFieldOfView = [Camera] "first person field of view", default 60.0, clamped to [1,179] (components/settings/categories/camera.hpp:27-28), a SEPARATE setting from [Camera] "field of view" (also 60.0) whose own comment says it "Does not affect the player's hands in the first person camera". It is read once into RenderingManager::mFirstPersonFieldOfView at construction (renderingmanager.cpp:209) and passed to the NpcAnimation ctor (renderingmanager.cpp:1161-1162); processChangedSettings only live-updates "field of view", never the first-person one (renderingmanager.cpp:1364-1367). Separately, the Morrowind fallback General_Werewolf_FOV overrides the MAIN camera FOV only while in first person (mwworld/player.cpp:470-482) - it does not touch the hands' FOV.

```cpp
// npcanimation.cpp:373-403
    /// Overrides Field of View to given value for rendering the subgraph.
    /// Must be added as cull callback.
    class OverrideFieldOfViewCallback : public osg::NodeCallback
    {
    public:
        OverrideFieldOfViewCallback(float fov, RenderingManager* renderingManager)
            : mFov(fov)
            , mRenderingManager(renderingManager)
        {
        }

        void operator()(osg::Node* node, osg::NodeVisitor* nv) override
        {
            osgUtil::CullVisitor* cv = static_cast<osgUtil::CullVisitor*>(nv);
            float fov, aspect, zNear, zFar;
            if (cv->getProjectionMatrix()->getPerspective(fov, aspect, zNear, zFar) && std::abs(fov - mFov) > 0.001)
            {
                fov = mFov;
                osg::ref_ptr<osg::RefMatrix> newProjectionMatrix = new osg::RefMatrix();
                newProjectionMatrix->makePerspective(fov, aspect, zNear, zFar);

                osg::Vec2f offset = mRenderingManager->getProjectionOffset();

                double offsetX = (offset.x() / cv->getViewport()->width()) * 2.0;
                double offsetY = (offset.y() / cv->getViewport()->height()) * 2.0;

                const osg::Matrix translation = osg::Matrix::translate(offsetX, offsetY, 0.0);
                newProjectionMatrix->postMult(translation);

                osg::ref_ptr<osg::RefMatrix> invertedOldMatrix = cv->getProjectionMatrix();
                invertedOldMatrix = new osg::RefMatrix(osg::RefMatrix::inverse(*invertedOldMatrix));
                osg::ref_ptr<osg::RefMatrix> viewMatrix = new osg::RefMatrix(*cv->getModelViewMatrix());
                viewMatrix->postMult(*newProjectionMatrix);
                viewMatrix->postMult(*invertedOldMatrix);
                cv->pushModelViewMatrix(viewM
...(truncated; see the cited lines)
```

## 30. The first-person neck controller: "bip01 neck", rotated by camera PITCH times 0.75-1.00 about -X
- `apps/openmw/mwrender/npcanimation.cpp:712-724, 931-946` - First-person specifics, importance **critical**

Only in VM_FirstPerson, and only while at least one animation state is playing (mStates.size() > 0 - the comment says that otherwise the node is not reset each frame and the controller would ACCUMULATE rotation), addControllers() looks up "bip01 neck" in the node map (an unordered_map with Misc::StringUtils::CiHash/CiEqual, so the lookup is case-insensitive and the FIRST matching MatrixTransform in traversal order wins - animation.hpp:124-127, sceneutil/visitor.cpp:60-64) and attaches a RotateController(mObjectRoot) as an UPDATE callback on it. mFirstPersonNeckController is set to nullptr at the top of every addControllers() call, so it is destroyed and rebuilt on every rebuild/view change. Each frame in runAnimation the rotation is set to Quat(rot[0] * rotateFactor, Vec3f(-1,0,0)) where rot[0] is the actor's PITCH in radians from RefData position (not yaw, not the camera object) and rotateFactor = 0.75 + 0.25 * mAimingFactor, i.e. the neck follows only 75% of the look pitch normally and 100% while aiming accurately. mAimingFactor snaps to 1.0 when setAccurateAiming(true) and otherwise decays LINEARLY at 0.5 per second toward 0 (max(0, f - dt*0.5)), so a full release takes 2 seconds. Accurate aiming is on exactly while mUpperBodyState > UpperBodyState::WeaponEquipped, i.e. AttackWindUp, AttackRelease, AttackEnd or Casting (mwmechanics/character.cpp:1895, enum at character.hpp:107-117). The controller's offset is set from mFirstPersonOffset in the same block.

```cpp
// npcanimation.cpp:712-724 (NpcAnimation::runAnimation)
        if (mFirstPersonNeckController)
        {
            if (mAccurateAiming)
                mAimingFactor = 1.f;
            else
                mAimingFactor = std::max(0.f, mAimingFactor - timepassed * 0.5f);

            float rotateFactor = 0.75f + 0.25f * mAimingFactor;

            mFirstPersonNeckController->setRotate(
                osg::Quat(mPtr.getRefData().getPosition().rot[0] * rotateFactor, osg::Vec3f(-1, 0, 0)));
            mFirstPersonNeckController->setOffset(mFirstPersonOffset);
        }

// npcanimation.cpp:928-946 (NpcAnimation::addControllers)
        mFirstPersonNeckController = nullptr;
        WeaponAnimation::deleteControllers();

        if (mViewMode == VM_FirstPerson)
        {
            // If there is no active animation, then the bip01 neck node will not be updated each frame, and the
            // RotateController will accumulate rotations.
            if (mStates.size() > 0)
            {
                NodeMap::iterator found = mNodeMap.find("bip01 neck");
                if (found != mNodeMap.end())
                {
                    osg::MatrixTransform* node = found->second.get();
                    mFirstPersonNeckController = new RotateController(mObjectRoot.get());
                    node->addUpdateCallback(mFirstPersonNeckController);
                    mActiveControllers.emplace_back(node, mFirstPersonNeckController);
                }
            }
        }

// apps/openmw/mwmechanics/character.cpp:1895
        mAnimation->setAccurateAiming(mUpperBodyState > UpperBodyState::WeaponEquipped);
```

## 31. RotateController applies the rotation in the OBJECT ROOT's space, on top of the animated matrix
- `apps/openmw/mwrender/rotatecontroller.cpp:30-68` - First-person specifics, importance **critical**

RotateController is a node callback on a MatrixTransform that runs AFTER the animation has written that node's matrix for the frame (its header states the assumption: "Assumes that the node being rotated has its original orientation set every frame by a different controller. The rotation is then applied on top of that orientation."). Each update it takes worldOrient = rotation part of computeLocalToWorld(first parental node path up to mRelativeTo, which for the neck controller is mObjectRoot), and computes orient = worldOrient * mRotate * worldOrientInverse * matrix.getRotate() - i.e. the pitch quaternion is conjugated into the node's local frame so that it is a rotation in the ACTOR ROOT's space, then pre-applied to the animated local rotation. The translation is matrix.getTrans() + worldOrientInverse * mOffset, so the first-person offset is likewise a vector in root space rotated into the bone's local frame. If the node is an osgAnimation::Bone it additionally writes setMatrixInSkeletonSpace(matrix * parent->getMatrixInSkeletonSpace()). If !mEnabled it just traverses, changing nothing.

```cpp
    void RotateController::operator()(osg::MatrixTransform* node, osg::NodeVisitor* nv)
    {
        if (!mEnabled)
        {
            traverse(node, nv);
            return;
        }
        osg::Matrix matrix = node->getMatrix();

        osg::Quat worldOrient;
        osg::NodePathList nodepaths = node->getParentalNodePaths(mRelativeTo);

        if (!nodepaths.empty())
        {
            osg::Matrixf worldMat = osg::computeLocalToWorld(nodepaths[0]);
            worldOrient = worldMat.getRotate();
        }

        osg::Quat worldOrientInverse = worldOrient.inverse();

        osg::Quat orient = worldOrient * mRotate * worldOrientInverse * matrix.getRotate();
        matrix.setRotate(orient);
        matrix.setTrans(matrix.getTrans() + worldOrientInverse * mOffset);

        node->setMatrix(matrix);

        // If we are linked to a bone we must call setMatrixInSkeletonSpace
        osgAnimation::Bone* b = dynamic_cast<osgAnimation::Bone*>(node);
        if (b)
        {
            osgAnimation::Bone* parent = b->getBoneParent();
            if (parent)
                matrix *= parent->getMatrixInSkeletonSpace();

            b->setMatrixInSkeletonSpace(matrix);
        }
```

## 32. There are TWO first-person offsets: the neck/body one (sneak only) and the camera one (Lua only)
- `apps/openmw/mwrender/camera.cpp:149-157, 310-313` - First-person specifics, importance **high**

(a) NpcAnimation::mFirstPersonOffset, pushed into the neck RotateController every frame, is written ONLY by Camera::setSneakOffset, as osg::Vec3f(0, 0, -offset). Its source is MWWorld::Player::update: while the player has the Sneak stance and is neither swimming nor flying, offset = the GMST i1stPersonSneakDelta (read once, statically); otherwise 0.f. So the whole first-person body is sunk by i1stPersonSneakDelta units in -Z while sneaking, via the neck bone, and there is no smoothing - it is a step change. Default is Vec3f(0,0,0) (npcanimation.hpp:71, default-constructed). (b) Camera::mFirstPersonOffset is a DIFFERENT member, default {0,0,0} (camera.hpp:148), settable only from Lua (camera bindings get/setFirstPersonOffset, mwlua/camerabindings.cpp:79-80); it is added to the camera position with its X/Y rotated by the camera yaw and Z applied straight. Do not conflate them: the sneak sink moves the MESH (and therefore the Camera bone with it), the Lua offset moves only the camera.

```cpp
// camera.cpp:149-157
    osg::Vec3d Camera::calculateFirstPersonPosition(const osg::Vec3d& trackedPosition) const
    {
        osg::Vec3d res = trackedPosition;
        osg::Vec2f horizontalOffset
            = Misc::rotateVec2f(osg::Vec2f(mFirstPersonOffset.x(), mFirstPersonOffset.y()), mYaw);
        res.x() += horizontalOffset.x();
        res.y() += horizontalOffset.y();
        res.z() += mFirstPersonOffset.z();
        return res;
    }

// camera.cpp:310-313
    void Camera::setSneakOffset(float offset)
    {
        mAnimation->setFirstPersonOffset(osg::Vec3f(0, 0, -offset));
    }

// apps/openmw/mwworld/player.cpp:485-494
        // Sink the camera while sneaking
        bool sneaking = playerClass.getCreatureStats(player).getStance(MWMechanics::CreatureStats::Stance_Sneak);
        bool swimming = world->isSwimming(player);
        bool flying = world->isFlying(player);

        static const float i1stPersonSneakDelta
            = store.get<ESM::GameSetting>().find("i1stPersonSneakDelta")->mValue.getFloat();
        if (sneaking && !swimming && !flying)
            rendering->getCamera()->setSneakOffset(i1stPersonSneakDelta);
        else
            rendering->getCamera()->setSneakOffset(0.f);
```

## 33. Equipped parts: if the ".1st" record is missing, ONLY arm parts fall back to the third-person record - everything else is dropped
- `apps/openmw/mwrender/npcanimation.cpp:879-914` - First-person specifics, importance **high**
- REFINES OR CORRECTS RECORDED RULE 1

REFINES RULE 1. In addPartGroup (the EQUIPMENT path, both the female and the male branch) the engine searches id + ".1st" in first person. If that search fails it does NOT simply give up and it does NOT simply use the plain record: it re-searches the plain (third-person) record and then keeps it only if that record's mData.mPart is MP_Hand, MP_Wrist, MP_Forearm or MP_Upperarm; for any other part it sets bodypart = nullptr, i.e. the equipped part is silently NOT SHOWN in first person and no warning is logged (the warning branch is the else of the first-person test). This is the equipment-path twin of the naked-body arm fallback already recorded as rule 3, and it means a port must not render a cuirass/helmet/greaves/boots in first person from its third-person mesh just because the .1st record is absent - the engine renders nothing there. Note also the search is over BODY RECORD IDs (rule 1 stands): partStore.search(RefId::stringRefId(part.mMale.getRefIdString() + ext)).

```cpp
        const char* ext = (mViewMode == VM_FirstPerson) ? ".1st" : "";
        for (const ESM::PartReference& part : parts)
        {
            const ESM::BodyPart* bodypart = nullptr;
            if (!mNpc->isMale() && !part.mFemale.empty())
            {
                bodypart = partStore.search(ESM::RefId::stringRefId(part.mFemale.getRefIdString() + ext));
                if (!bodypart && mViewMode == VM_FirstPerson)
                {
                    bodypart = partStore.search(part.mFemale);
                    if (bodypart
                        && !(bodypart->mData.mPart == ESM::BodyPart::MP_Hand
                            || bodypart->mData.mPart == ESM::BodyPart::MP_Wrist
                            || bodypart->mData.mPart == ESM::BodyPart::MP_Forearm
                            || bodypart->mData.mPart == ESM::BodyPart::MP_Upperarm))
                        bodypart = nullptr;
                }
                else if (!bodypart)
                    Log(Debug::Warning) << "Warning: Failed to find body part '" << part.mFemale << "'";
            }
            if (!bodypart && !part.mMale.empty())
            {
                bodypart = partStore.search(ESM::RefId::stringRefId(part.mMale.getRefIdString() + ext));
                if (!bodypart && mViewMode == VM_FirstPerson)
                {
                    bodypart = partStore.search(part.mMale);
                    if (bodypart
                        && !(bodypart->mData.mPart == ESM::BodyPart::MP_Hand
                            || bodypart->mData.mPart == ESM::BodyPart::MP_Wrist
                            || bodypart->mData.mPart == ESM::BodyPart::MP_Forearm
                            || bodypart->mData.mPart == ESM::BodyPart::MP_Upperarm))
                        bodypart = nullptr;
      
...(truncated; see the cited lines)
```

## 34. The root NiNode's transform is DISCARDED at parse time unless the node is named "bip01"
- `components/nif/node.cpp:170-192` - NIF nodes and transforms, importance **critical**

In NiNode::read, if the record index is 0 and the node's name is not case-insensitively equal to "bip01", the node's whole NiTransform is REPLACED with identity before anything else ever sees it. This happens in the parser, not the renderer, so every consumer (render loader, collision loader, animation) sees identity. It applies to Morrowind-version files: the early-out above it only skips versions strictly greater than VER_MW and strictly less than VER_BGS. It applies only to NiNode records - a NiTriShape at record index 0 keeps its transform. A JS port that faithfully applies the root node's stored translation/rotation/scale will mis-orient meshes exactly as the comment describes, and a port that unconditionally zeroes the root will break every skeleton whose root node is named Bip01. This is also the reason a Bip01 root survives as a real transform node and can therefore be found by name later (see the accum-root rule).

```cpp
    void NiNode::read(NIFStream* nif)
    {
        NiAVObject::read(nif);

        readRecordList(nif, mChildren);
        if (nif->getBethVersion() < NIFFile::BethVersion::BETHVER_FO4)
            readRecordList(nif, mEffects);

        // FIXME: stopgap solution until we figure out what Oblivion does if it does anything
        if (nif->getVersion() > NIFFile::NIFVersion::VER_MW && nif->getVersion() < NIFFile::NIFVersion::VER_BGS)
            return;

        // Discard transformations for the root node, otherwise some meshes
        // occasionally get wrong orientation. Only for NiNode-s for now, but
        // can be expanded if needed.
        // FIXME: if node 0 is *not* the only root node, this must not happen.
        // FIXME: doing this here is awful.
        // We want to do this on world scene graph level rather than local scene graph level.
        if (mRecordIndex == 0 && !Misc::StringUtils::ciEqual(mName, "bip01"))
        {
            mTransform = Nif::NiTransform::getIdentity();
        }
    }
```

## 35. NiTextKeyExtraData: any node in a NIF, first-extra-only in a KF, split/trim/lowercase into a multimap
- `components/nifosg/nifloader.cpp:213-227` - NIF nodes and transforms, importance **high**

Two completely different attachment rules depending on the file. In a MESH (.nif), the loader reads NiTextKeyExtraData off ANY node it walks, at any depth, and flattens every one it finds into a single shared TextKeyMap for the whole file (nifloader.cpp:737-741; the map is created once in load() at :446 and hung on the root's UserDataContainer at :483, only if non-empty). In a KEYFRAME file (.kf), the rule is rigid: the root must be a NiSequenceStreamHelper, and the text keys must be the FIRST entry of its extra list - `extraList[0]->mRecordType != Nif::RC_NiTextKeyExtraData` is a warning and abort, not a search (nifloader.cpp:359-376). The remaining extras of that helper are NiStringExtraData naming the target node for each NiKeyframeController in the parallel controller chain (nifloader.cpp:384-412). Key normalisation is the load-bearing part: each key's text is split on the character set "\r\n" (so ONE key at ONE time can produce SEVERAL entries), each piece is trimmed, lowercased in place, and dropped if empty; survivors go into a MULTIMAP keyed by time, so duplicate times are all retained. Group names are derived from these lowercased strings, which is why every group/text-key comparison elsewhere in the engine is against lowercase.

```cpp
components/nifosg/nifloader.cpp:213-227
    void extractTextKeys(const Nif::NiTextKeyExtraData* tk, SceneUtil::TextKeyMap& textkeys)
    {
        for (const Nif::NiTextKeyExtraData::TextKey& key : tk->mList)
        {
            std::vector<std::string> results;
            Misc::StringUtils::split(key.mText, results, "\r\n");
            for (std::string& result : results)
            {
                Misc::StringUtils::trim(result);
                Misc::StringUtils::lowerCaseInPlace(result);
                if (!result.empty())
                    textkeys.emplace(key.mTime, std::move(result));
            }
        }
    }

components/nifosg/nifloader.cpp:737-741 (mesh: any node)
                if (e->mRecordType == Nif::RC_NiTextKeyExtraData && args.mTextKeys)
                {
                    const Nif::NiTextKeyExtraData* tk = static_cast<const Nif::NiTextKeyExtraData*>(e.getPtr());
                    extractTextKeys(tk, *args.mTextKeys);
                }

components/nifosg/nifloader.cpp:367-374 (kf: first extra only)
            if (extraList[0]->mRecordType != Nif::RC_NiTextKeyExtraData)
            {
                Log(Debug::Warning) << "NIFFile Warning: First extra data was not a NiTextKeyExtraData, but a "
                                    << extraList[0]->mRecordName << ". File: " << nif.getFilename();
                return;
            }

            auto textKeyExtraData = static_cast<const Nif::NiTextKeyExtraData*>(extraList[0].getPtr());
```

## 36. The tga->dds swap is one step of a five-step, existence-checked path search
- `components/misc/resourcehelpers.cpp:80-141` - Materials and textures, importance **critical**
- REFINES OR CORRECTS RECORDED RULE 18

correctTexturePath(resPath, vfs) = correctResourcePath({"textures","bookart"}, resPath, vfs, "dds") (resourcehelpers.cpp:137-141). The input is already normalized: backslashes become '/' and EVERY character is lowercased (components/vfs/pathutil.hpp:18-21, `c == '\\' ? separator : toLower(c)`). The algorithm is: (1) scan the path for a whole path COMPONENT equal to "textures" or "bookart" - findDirectory (:37-62) requires the match to be preceded by start-of-string or '/' AND followed by '/', so "mytextures/x.tga" does not match - and if found, truncate the path to begin at that component; otherwise prefix "textures/". (2) Keep a copy `origExt`, then replace the extension with "dds" - unconditionally, not only for .tga: Normalized::changeExtension replaces everything after the last '.' and returns true even when the text is unchanged (pathutil.hpp:289-297). (3) Then try, IN ORDER, returning the first that vfs.exists(): the .dds path; the ORIGINAL-extension path; "textures/" + basename-of-the-dds-path; "textures/" + basename-of-the-original-extension path. (4) If none exist, return the .dds path anyway. Steps 3c/3d are the 'flatten to the top-level directory' fallback that lets `textures/foo/bar.tga` resolve to `textures/bar.dds`. Note the top-level list is ordered and only the FIRST entry ("textures") is ever used as a prefix; "bookart" is only ever recognised, never synthesised. When the final path does not exist, ImageManager::getImage logs "Failed to open image" and returns mWarningImage - an 8x8 SOLID MAGENTA RGB image (components/resource/imagemanager.cpp:28-43, :96-101) - so a missing texture renders as flat magenta, it does not render untextured. One further Morrowind quirk in the same function: for a .tga with 16bpp and 1 alpha bit the alpha channel is discarded, "Morrowind ignores the alpha channel of 16bpp TGA files even when the header says not to" (imagemanager.cpp:118-139).

```cpp
// If `ext` is not empty we first search file with extension `ext`, then if not found fallback to original extension.
VFS::Path::Normalized Misc::ResourceHelpers::correctResourcePath(
    std::span<const VFS::Path::NormalizedView> topLevelDirectories, VFS::Path::NormalizedView resPath,
    const VFS::Manager& vfs, VFS::Path::ExtensionView ext)
{
    VFS::Path::Normalized correctedPath;

    // Handle top level directory
    bool needsPrefix = true;

    for (const VFS::Path::NormalizedView potentialTopLevelDirectory : topLevelDirectories)
    {
        if (const std::size_t topLevelPos = findDirectory(resPath, potentialTopLevelDirectory);
            topLevelPos != std::string::npos)
        {
            correctedPath = VFS::Path::Normalized(resPath.value().substr(topLevelPos));
            needsPrefix = false;
            break;
        }
    }

    if (needsPrefix)
        correctedPath = topLevelDirectories.front() / resPath;

    const VFS::Path::Normalized origExt = correctedPath;

    // replace extension if `ext` is specified (used for .tga -> .dds, .wav -> .mp3)
    const bool isExtChanged = !ext.empty() && correctedPath.changeExtension(ext);

    if (vfs.exists(correctedPath))
        return correctedPath;

    // fall back to original extension
    if (isExtChanged && vfs.exists(origExt))
        return origExt;

    // fall back to a resource in the top level directory if it exists
    {
        const VFS::Path::Normalized fallback = topLevelDirectories.front() / correctedPath.filename();
        if (vfs.exists(fallback))
            return fallback;
    }

    if (isExtChanged)
    {
        const VFS::Path::Normalized fallback = topLevelDirectories.front() / origExt.filename();
        if (vfs.exists(fallback))
            return fallback;
    }

    retur
...(truncated; see the cited lines)
```

## 37. Material, vertex-colour, specular and alpha properties are gathered from the WHOLE ancestor chain, root-first, and the last one wins
- `components/nifosg/nifloader.cpp:187-211` - Materials and textures, importance **high**

Unlike NiTexturingProperty and NiStencilProperty, which are applied at the node they sit on, exactly four record types are deferred to the drawable: NiMaterialProperty, NiVertexColorProperty, NiSpecularProperty and NiAlphaProperty. collectDrawableProperties recurses to the ROOT FIRST and then appends the current node's own properties, producing a root-to-leaf ordered list; applyDrawableProperties then walks that list mutating ONE material object, so a nearer property overwrites a farther one field by field (a child NiMaterialProperty replaces diffuse/ambient/emissive/specular/gloss/alpha wholesale; a child NiAlphaProperty with blending off actively strips the ancestor's blend state, per the removal branches in handleAlphaBlending/handleAlphaTesting). The geometry's own mShaderProperty and mAlphaProperty pointers are appended LAST, after the inherited chain (:1671-1674 for NiGeometry, :1889-1892 for BSTriShape). At node level these four types are explicit no-ops with the reasons stated in comments: material/vertexcolor/specular 'Handled on drawable level so we know whether vertex colors are available' (:2552-2558), alpha 'Handled on drawable level to prevent RenderBin nesting issues' (:2559-2563). A port that reads these properties only off the shape's own NiTriShape will silently drop every material set on a parent NiNode - which is the common authoring pattern in Morrowind meshes.

```cpp
    // Collect all properties affecting the given drawable that should be handled on drawable basis rather than on the
    // node hierarchy above it.
    void collectDrawableProperties(
        const Nif::NiAVObject* nifNode, const Nif::Parent* parent, std::vector<const Nif::NiProperty*>& out)
    {
        if (parent != nullptr)
            collectDrawableProperties(&parent->mNiNode, parent->mParent, out);
        for (const auto& property : nifNode->mProperties)
        {
            if (!property.empty())
            {
                switch (property->mRecordType)
                {
                    case Nif::RC_NiMaterialProperty:
                    case Nif::RC_NiVertexColorProperty:
                    case Nif::RC_NiSpecularProperty:
                    case Nif::RC_NiAlphaProperty:
                        out.push_back(property.getPtr());
                        break;
                    default:
                        break;
                }
            }
        }
    }
```

---

# Verified with a recorded caveat

Each of these had its mechanism confirmed and one or more overreaching
claims flagged. Read the rule, then the caveat, and implement the
intersection.

## 38. Skin weights are stored PER BONE and inverted into per-vertex lists at load
- `components/nifosg/nifloader.cpp:1698-1717` - NIF skinning, importance **n/a**

NiSkinInstance is read as [NiSkinData ref; NiSkinPartition ref ONLY if version >= 10.1.0.101 (so absent in Morrowind's 4.0.0.2); skeleton-root NiAVObject ref; bone list = u32 count + that many NiAVObject refs] (components/nif/data.cpp:330-337). NiSkinData is [NiTransform (3x3 rotation read as 9 floats row-major, Vec3 translation, float scale); u32 bone count; a NiSkinPartition ref when 4.0.0.2 <= version <= 10.1.0.0, so Morrowind files DO carry this link; a bool hasVertexWeights only when version >= 4.2.1.0, so Morrowind (VER_MW = 0x04000002, niffile.hpp:28) never stores it and it is implicitly true; then per bone: NiTransform, bounding sphere (Vec3 centre + float radius, nifstream.cpp:140-144), u16 vertex count, then that many (u16 vertexIndex, float weight) pairs] (data.cpp:411-428, 35-51, 13-18). Bones pair POSITIONALLY: NiSkinInstance::mBones[i] is the scene node for NiSkinData::mBones[i]. NiSkinInstance::post (data.cpp:339-358) throws on: missing data or missing root, a bone-count mismatch between the two records, or any null bone ref. The loader then inverts the bone->vertices layout into vertex->list of (boneIndex, weight), appending in ascending bone index order, and uses the stored weight values verbatim. Where a NiSkinPartition is present it supplies ONLY triangle/strip topology, replacing the NiTriShapeData primitives (nifloader.cpp:1572-1595); the weights used for skinning always come from NiSkinData, never from the partition.

```cpp
                const Nif::NiSkinInstance* skin = niGeometry->mSkin.getPtr();
                const Nif::NiSkinData* data = skin->mData.getPtr();
                const Nif::NiAVObjectList& bones = skin->mBones;

                // Assign bone weights
                std::vector<SceneUtil::RigGeometry::BoneInfo> boneInfo(bones.size());
                std::vector<SceneUtil::RigGeometry::BoneWeights> influences(geom->getVertexArray()->getNumElements());
                for (std::size_t i = 0; i < bones.size(); ++i)
                {
                    boneInfo[i].mName = Misc::StringUtils::lowerCase(bones[i].getPtr()->mName);
                    boneInfo[i].mInvBindMatrix = data->mBones[i].mTransform.toMatrix();
                    boneInfo[i].mBoundSphere = data->mBones[i].mBoundSphere;
                    for (const auto& [vertex, weight] : data->mBones[i].mWeights)
                        influences.at(vertex).emplace_back(i, weight);
                }
                rig->setBoneInfo(std::move(boneInfo));
                rig->setInfluences(influences);
                rig->setTransform(data->mTransform.toMatrix());
                if (const Nif::NiAVObject* rootBone = skin->mRoot.getPtr())
                    rig->setRootBone(rootBone->mName);

// and the record layout it reads, components/nif/data.cpp:411-428:
    void NiSkinData::read(NIFStream* nif)
    {
        nif->read(mTransform);

        const uint32_t numBones = nif->get<uint32_t>();
        bool hasVertexWeights = true;
        if (nif->getVersion() >= NIFFile::NIFVersion::VER_MW)
        {
            if (nif->getVersion() <= NIFStream::generateVersion(10, 1, 0, 0))
                mPartitions.read(nif);

            if (nif->getVersion() >= NIFStream::generateVersion(4, 2, 1, 0))
                nif->re
...(truncated; see the cited lines)
```

**Recorded caveat** (from adversarial verification - the rule above is
sound, this is the condition it must not be read past):

> Nearly all of the rule verifies, but the per-bone layout omits a guard. In ReadNiSkinDataBoneInfo (components/nif/data.cpp:35-51) the read is: NiTransform, bounding sphere, u16 numVertices, then `if (!mHasVertexWeights) return;` BEFORE `stream.readVectorOfRecords(numVertices, readNiSkinDataVertWeight, value.mWeights)`. The rule states the (u16 vertexIndex, float weight) pairs as an unconditional tail of every bone record, having introduced hasVertexWeights only to note Morrowind lacks it. Since the rule explicitly generalises across versions (it spells out the 10.1.0.0 and 4.2.1.0 bounds), that is a conditional stated as always-true: for any file with version >= 4.2.1.0 whose hasVertexWeights byte is false, the bone record ends right after the u16 count, and following the rule's layout over-reads numVertices*6 bytes. It also makes the closing claim misleading — because nifloader.cpp:1571-1597 uses only the partition's mTrueTriangles/mTrueStrips and never Partition::mWeights or mBoneIndices, a hasVertexWeights==false NiSkinData leaves mWeights empty and those vertices receive no influences at all, rather than NiSkinData reliably supplying the weights. Everything else confirmed against /tmp/fpv/openmw: NiSkinInstance::read partition guard >= 10.1.0.101 (data.cpp:330-337); readRecordList is readVectorOfRecords<uint32_t>, i.e. u32 count + refs (recordptr.hpp:161, nifstream.hpp:188-203); post throws on empty data/root, bone-count mismatch, null bone (data.cpp:339-358); VER_MW = 0x04000002 at niffile.hpp:28 and the NiSkinData partition ref IS read for Morrowind (>= VER_MW && <= 10.1.0.0), matching getPartitions()'s fallback to mData->mPartitions (data.cpp:360-369); bounding sphere = Vec3 centre + float radius (nifstream.cpp:140-144); Matrix3 is float[3][3] read as 9 contiguous floats; positional bone pairing, ascending-index append, and verbatim weights (RigGeometry::setInfluences only groups identical BoneWeights, never renormalises).

**Corrected form offered:** Same as stated, except for the NiSkinData per-bone record: it is [NiTransform; bounding sphere (Vec3 centre + float radius); u16 vertex count; and THEN, only if hasVertexWeights is true, that many (u16 vertexIndex, float weight) pairs — when the flag is false the count is still consumed but the pair array is absent entirely (components/nif/data.cpp:35-51)]. hasVertexWeights is read only for version >= 4.2.1.0 and defaults to true, so Morrowind (VER_MW = 0x04000002) bone records always do carry the pairs; the conditional only bites on later files. Correspondingly, the last sentence should read: OpenMW's nifosg loader takes skinning weights exclusively from NiSkinData and never reads NiSkinPartition::Partition::mWeights or mBoneIndices, so a NiSkinData with hasVertexWeights false yields empty mWeights and vertices with no influences at all rather than weights sourced from the partition.


## 39. Weights are never normalised, clamped, sorted or limited; unweighted vertices are never written
- `components/sceneutil/riggeometry.cpp:334-346` - NIF skinning, importance **n/a**

Grep of components/sceneutil/riggeometry.cpp and components/nifosg/nifloader.cpp finds no normalisation and no clamping in the NIF skinning path. Concretely: there is no 4-bones-per-vertex limit (a vertex keeps every weight the file gives it, in ascending bone-index order), no epsilon culling of small weights, no sorting by weight, no rescaling so weights sum to 1 - a file whose weights sum to != 1 produces a correspondingly shrunk/expanded/offset vertex, and dropping a missing bone (rule on skeleton binding) does NOT trigger renormalisation of the remaining weights. Vertices are bucketed by EXACT equality of their whole (boneIndex, weight) vector using std::map ordering, so one blend matrix is built per distinct influence set. The empty influence set is explicitly erased, so a vertex with no weights at all is never written to the destination array and keeps the bind-pose coordinates deep-copied at setSourceGeometry - it does not collapse to the origin. Note also nifloader.cpp:1711 uses influences.at(vertex): a weight naming a vertex index >= the vertex count throws rather than being ignored.

```cpp
    void RigGeometry::setInfluences(const std::vector<BoneWeights>& influences)
    {
        if (!mData)
            mData = new InfluenceData;

        std::map<BoneWeights, VertexList> influencesToVertices;
        for (size_t i = 0; i < influences.size(); i++)
            influencesToVertices[influences[i]].emplace_back(static_cast<VertexList::value_type>(i));
        influencesToVertices.erase(BoneWeights());

        mData->mInfluences.reserve(influencesToVertices.size());
        mData->mInfluences.assign(influencesToVertices.begin(), influencesToVertices.end());
    }
```

**Recorded caveat** (from adversarial verification - the rule above is
sound, this is the condition it must not be read past):

> The rule's non-normalisation core is correct, but it states as unconditional properties of "the NIF skinning path" two things that hold only in one of the two paths that call setInfluences. (1) "No 4-bones-per-vertex limit, in ascending bone-index order" is true only of handleNiGeometry (nifloader.cpp:1704-1714), where the outer loop walks bones i ascending and appends every NiSkinData weight. handleBSTriShape (nifloader.cpp:1863-1880) does `for (int j = 0; j < 4; j++) influences[i].emplace_back(vertData.mBoneIndices[j], halfToFloat(vertData.mBoneWeights[j]))` over `std::array<Misc::float16_t,4> mBoneWeights` / `std::array<char,4> mBoneIndices` (components/nif/node.hpp:383-384) — exactly four influences per vertex, in the file's slot order, not sorted by bone index. (2) The "no weights -> keeps bind-pose, does not collapse to the origin" claim is inverted for that path: a BSTriShape vertex with all four weights zero is not BoneWeights(), it is four (index, 0.0f) pairs, so `influencesToVertices.erase(BoneWeights())` does not remove it; it is written with resultMat left as the all-zero linear part with m[3][3]=1, and since handleBSTriShape never calls setTransform (mTransform is identity), the vertex does collapse to the origin. The erase only protects vertices whose influence vector is literally empty, which in practice means the NiSkinData path. Verified: no normalisation/clamping/epsilon/sorting exists in either file; the missing-bone skip in cull() (riggeometry.cpp:391) does not renormalise; std::map bucketing is exact-equality; and nifloader.cpp:1711 is indeed `influences.at(vertex)`, which throws on an out-of-range vertex index.

> The rule cannot be confirmed because it describes a codebase that is not present. /home/user/project-dagger is "project-dagger", a JavaScript port of Daggerfall (logic from Daggerfall Unity, presentation on hand-rolled WebGL2), not OpenMW. There are no .cpp/.hpp files anywhere in the tree, no components/ directory, and `grep -rli openmw` across the entire checkout and all 2505 commits returns zero hits. The claimed source components/sceneutil/riggeometry.cpp:334-346 and the corroborating components/nifosg/nifloader.cpp:1711 do not exist, so nothing about NIF skin-weight handling, std::map bucketing of (boneIndex, weight) vectors, or influences.at(vertex) can be verified here. More substantively, there is no vertex skinning mechanism at all for any override to contradict. Character geometry is procedural and forward-kinematic: src/characters/rewrite/body.js poses a rig via mkFrame/solveTwoBone and lofts pieces into flat faces, and src/render/characterMesh.js packCharacterFaces packs them into an interleaved [pos.xyz, color.rgb, normal.xyz] stream (9 floats/vertex, fan-triangulated) with no bone indices, no weights, and no blend matrices. A grep over all of src/ for boneWeight|vertexWeight|weightsPerVertex|MAX_BONES|bindPose|inverseBind|skinMatri|blendMatri|jointIndex|normalize-weight returns zero matches (skinRamp in rewrite/limb.js is a skin-tone color ramp, not skinning). On the specific case the lens asks me to confirm - the first-person player body - the rule is doubly inapplicable. The only FP body-geometry path, drawFirstPersonViewmodel at src/render/characterSprite.js:54, is explicitly parked: its header comment reads "ON ICE (2026-08-17, Mac): the voxel FP viewmodel is parked in favor of the TRUE classic method (combat/fpsWeapon.js, WEAPON*.CIF per FPSWeapon). No consumer". Live first person renders src/combat/fpsWeapon.js, the classic Daggerfall 2D CIF sprite method, so there is no first-person body mesh whose vertices any weight rule could govern. Werewolves and beast races are handled by procedural piece swaps (src/characters/pieces/beastBody.js, beastHead.js, tail.js, bodyScales.js) and paperdoll art, not by bone-weight remapping.

**Corrected form offered:** Neither riggeometry.cpp nor nifloader.cpp normalises, rescales, epsilon-culls, or sorts skinning weights: resultMat in RigGeometry::cull accumulates boneMatrices[index] * weight into columns 0-2 with m[3][3] pinned to 1, so a file whose weights sum to != 1 yields a correspondingly shrunk/expanded/offset vertex, and the `if (mNodes[index] == nullptr) continue;` skip for a bone missing from the skeleton does not renormalise the remaining weights. setInfluences buckets vertices by exact std::map equality of the whole (boneIndex, weight) vector, one blend matrix per distinct influence set, and erases the empty set. However, the per-vertex influence list differs by path. In handleNiGeometry (NiSkinData, nifloader.cpp:1704-1714) there is no bone-count limit — a vertex keeps every weight the file names for it, appended in ascending bone-index order because the outer loop iterates bones — and `influences.at(vertex)` at line 1711 throws if a weight names a vertex index >= the vertex count. Only on this path does a vertex named by no weight end up with an empty influence set, get erased, and so keep the bind-pose coordinates deep-copied at setSourceGeometry instead of collapsing to the origi


## 40. 'Skeleton space' is the MatrixTransform product below the Skeleton node; a missing bone is not fatal
- `components/sceneutil/skeleton.cpp:161-175` - NIF skinning, importance **n/a**

The bone matrix fed to the blend is mMatrixInSkeletonSpace = the bone node's own matrix multiplied by its parent's skeleton-space matrix (row-vector: own transform first, then ancestors), with the chain STARTING at the first osg::MatrixTransform below the SceneUtil::Skeleton node - the Skeleton itself and everything above it contribute nothing, so posing happens in skeleton space. Only MatrixTransform nodes are collected into the path (InitBoneCacheVisitor, skeleton.cpp:23-33); plain groups between bones contribute nothing. Matrices are recomputed at most once per traversal number (Skeleton::updateBoneMatrices, skeleton.cpp:95-108). Binding is by NAME only and is resolved lazily on the first update/cull traversal by walking up the node path for the nearest Skeleton ancestor (RigGeometry::initFromParentSkeleton, riggeometry.cpp:100-136). This refines recorded rule 16: the skin's bone names are lowercased once at load (nifloader.cpp:1707) and lowercased again inside Skeleton::getBone, and - critically - a bone the skeleton does not have is NOT an error that aborts anything: it logs 'RigGeometry did not find bone', stores nullptr, and every influence naming it is silently skipped in the blend, so a vertex weighted only to missing bones renders at its bind-pose position rather than disappearing.

```cpp
    void Bone::update(const osg::Matrixf* parentMatrixInSkeletonSpace)
    {
        if (!mNode)
        {
            Log(Debug::Error) << "Error: Bone without node";
            return;
        }
        if (parentMatrixInSkeletonSpace)
            mMatrixInSkeletonSpace = mNode->getMatrix() * (*parentMatrixInSkeletonSpace);
        else
            mMatrixInSkeletonSpace = mNode->getMatrix();

        for (const auto& child : mChildren)
            child->update(&mMatrixInSkeletonSpace);
    }
```

**Recorded caveat** (from adversarial verification - the rule above is
sound, this is the condition it must not be read past):

> The rule cannot be derived from this codebase, because none of the code it cites exists here. /home/user/project-dagger is a JavaScript/C# Daggerfall-style game project (census: 1077 .js, 856 .cs, 180 .mjs, 0 C++ files). There is no components/ directory, no sceneutil/, no skeleton.cpp, riggeometry.cpp, or nifloader.cpp — not in the working tree, not in vendor/ (which holds only dfu-books, dfu-quests, dfu-settings), not in dist/ or node_modules/, and not at any point in git history (`git log --all --diff-filter=A --name-only` surfaces no such paths). There are no submodules (.gitmodules absent), and grep for "openmw", "osg::MatrixTransform", "SceneUtil", "mMatrixInSkeletonSpace", "InitBoneCacheVisitor", "initFromParentSkeleton", and "updateBoneMatrices" returns zero hits repo-wide. The only name-adjacent file, /home/user/project-dagger/src/characters/pieces/skeletonBones.js, is unrelated: it procedurally builds a ribcage mesh for an undead character model, with no bone hierarchy, no skinning matrices, and no name-based bone binding. Every line reference in the rule is therefore unverifiable against this repo: skeleton.cpp:23-33 (MatrixTransform-only collection), skeleton.cpp:95-108 (once-per-traversal-number caching), riggeometry.cpp:100-136 (lazy name-only binding by walking up for the nearest Skeleton ancestor), and nifloader.cpp:1707 (load-time lowercasing). The only fragment with any support is the snippet pasted into the prompt itself, which does show `mMatrixInSkeletonSpace = mNode->getMatrix() * (*parentMatrixInSkeletonSpace)` and recursion into children — but that text was supplied by the prompt, not fetched from this codebase, so it corroborates nothing about project-dagger. The rule's most load-bearing claims are exactly the unfalsifiable-here absolutes the check warns about: that the Skeleton node and everything above it "contribute nothing," that "only MatrixTransform nodes are collected" so plain groups contribute nothing, that matrices are recomputed "at most once per traversal number," that binding is "by NAME only," and — stated as certain — that a missing bone "is NOT an error that aborts anything," is "silently skipped in the blend," and leaves such a vertex "at its bind-pose position rather than disappearing." That last chain in particular asserts a specific rendering outcome (bind-pose fallback vs. collapse to origin) that depends on how the accumulated weight and result vertex are initialized in the skin loop — code not present here to confirm or deny. Per the instruction to default to refuted when unable to verify, the rule is refut ...

> The structural half of the rule survives the wider search, but its final clause is wrong, and wrong exactly where a first-person player body is concerned. WHAT HOLDS. SceneUtil::Bone::update (/tmp/fpv/openmw/components/sceneutil/skeleton.cpp:169) really does compose mMatrixInSkeletonSpace = own matrix * parent's skeleton-space matrix, row-vector. InitBoneCacheVisitor (skeleton.cpp:23-29) really does collect only osg::MatrixTransform nodes on a path rooted at the Skeleton's children, and nifloader.cpp:472 makes the Skeleton a plain osg::Group that adopts the NIF root's children, so the first bone genuinely is the first MatrixTransform below it. grep shows mMatrixInSkeletonSpace has exactly two readers, both in riggeometry.cpp; there is no Skeleton subclass, no override, and no other writer anywhere in the tree. The first-person and werewolf paths do not change this. SceneUtil::attach (components/sceneutil/attach.cpp:117-142) discards a skinned bodypart's own Skeleton and re-parents its rig subtree directly under the actor's Skeleton, ignoring the requested attach bone - which is precisely what makes name-only binding work for FP hands. MWRender::RotateController (apps/openmw/mwrender/rotatecontroller.cpp:30-54), the one first-person-only bone manipulation, writes the neck node's OWN matrix and lets Bone::update compose it, confirming the rule rather than overriding it. WHAT REFUTES IT. The clause "a vertex weighted only to missing bones renders at its bind-pose position rather than disappearing" is false. RigGeometry::cull seeds the blend accumulator as the ZERO matrix, not identity - riggeometry.cpp:191, osg::Matrixf resultMat(0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,1) - and riggeometry.cpp:195-196 skips any influence whose bone is nullptr. If every influence on a vertex names a missing bone, nothing accumulates, so rows 0-2 stay zero. Line 204's resultMat *= transform leaves rows 0-2 zero and sets row 3 to transform's row 3. Line 208's resultMat.preMult(v) is the row-vector product v*M, so it evaluates to the translation component of transform for EVERY such vertex, independent of the source position; line 210's transform3x3 yields a zero normal. All such vertices collapse onto one point (the origin of mSkinToSkelMatrix * mData->mTransform): zero-area triangles where a whole face is affected, long spikes to that point where a face mixes present and missing bones. That is the opposite of a bind-pose render, and closer to disappearing than to surviving. riggeometry.cpp:259-268 compounds it - updateBounds skips missing bones outright, so the bounding box does not ...

**Corrected form offered:** Scoped to what can actually be checked: this repository contains no OpenMW C++ source, so no rule about Bone::update, Skeleton::updateBoneMatrices, RigGeometry::initFromParentSkeleton, or NIF-loader bone-name lowercasing can be attributed to it. The only statement supported by the material at hand is the one visible in the supplied snippet: Bone::update composes mMatrixInSkeletonSpace as the node's own matrix times the parent's skeleton-space matrix when a parent is passed (row-vector order: own transform first), falls back to the node's own matrix at the root of the recursion, and then recurses into children passing its own result. The traversal-caching behavior, the MatrixTransform-only path collection, the chain's starting point relative to the Skeleton node, the name-only lazy binding, and the missing-bone handling (including the claim that affected vertices render at bind pose rather than disappearing) are all unverified here and must be confirmed against the actual OpenMW tree before being recorded as fact. Recorded rule 16 should likewise not be treated as refined by this rule on the basis of this codebase.


## 41. The skin's 'skeleton root' is a NAME, and it decides which ancestor transforms get cancelled
- `components/sceneutil/riggeometry.cpp:289-324` - NIF skinning, importance **n/a**

NiSkinInstance::mRoot is stored by name only (nifloader.cpp:1716-1717, rig->setRootBone(rootBone->mName)). Each UPDATE traversal recomputes mSkinToSkelMatrix from the drawable's current node path: start just BELOW the SceneUtil::Skeleton; search forward for the first node whose name matches the skin root case-insensitively; if found, the cancelled range ends just AFTER it (skinRoot++ makes it inclusive); if the skin declares no root or the name is not on this path, fall back to the RigGeometry's parent - EXCLUDED when that parent's name equals the drawable's own name (both come from the NIF node name, nifloader.cpp:715 and :1757, i.e. it is the trishape's own MatrixTransform), INCLUDED when the names differ ('but maybe it can get optimized out'). Over that range every osg::Transform contributes its world-to-local matrix, accumulated by post-multiplication (product of inverses, top-down), and MatrixTransforms whose matrix is identity are skipped. The purpose is to cancel scene-graph transforms that will be re-applied above the drawable, which is why the header says 'the RigGeometry ignores any transforms below the Skeleton, so the attachment point is not that important' (riggeometry.hpp:22-24). This refines recorded rule 12: a copied skinned part is indeed never parented to a bone, but attach.cpp:48-55 copies the topmost filter-matching ANCESTOR of the rig, not the bare drawable, and that surviving chain is exactly what this function walks. VERSION WARNING - this skin-root logic and the NiSkinData overall transform of rule C are master-only: openmw-0.49.0's riggeometry.cpp:200-201 and :283-310 cancel every transform between the Skeleton and the rig's parent inclusive, and never apply NiSkinData's overall transform at all. A port must pick one reference version and say which.

```cpp
    void RigGeometry::updateSkinToSkelMatrix(const osg::NodePath& nodePath)
    {
        if (mSkinToSkelMatrix)
            mSkinToSkelMatrix->makeIdentity();
        auto skeletonRoot = std::find(nodePath.begin(), nodePath.end(), mSkeleton);
        if (skeletonRoot == nodePath.end())
            return;
        skeletonRoot++;
        auto skinRoot = nodePath.end();
        if (!mData->mRootBone.empty())
            skinRoot = std::find_if(skeletonRoot, nodePath.end(),
                [&](const osg::Node* node) { return Misc::StringUtils::ciEqual(node->getName(), mData->mRootBone); });
        if (skinRoot == nodePath.end())
        {
            // Failed to find skin root, cancel out everything up till the trishape.
            // Our parent node is the trishape's transform
            skinRoot = nodePath.end() - 2;
            if ((*skinRoot)->getName() != getName()) // but maybe it can get optimized out
                skinRoot++;
        }
        else
            skinRoot++;
        for (auto it = skeletonRoot; it != skinRoot; ++it)
        {
            const osg::Node* node = *it;
            if (const osg::Transform* trans = node->asTransform())
            {
                const osg::MatrixTransform* matrixTrans = trans->asMatrixTransform();
                if (matrixTrans && matrixTrans->getMatrix().isIdentity())
                    continue;
                if (!mSkinToSkelMatrix)
                    mSkinToSkelMatrix = new osg::RefMatrix;
                trans->computeWorldToLocalMatrix(*mSkinToSkelMatrix, nullptr);
            }
        }
    }
```

**Recorded caveat** (from adversarial verification - the rule above is
sound, this is the condition it must not be read past):

> The mechanism half of the rule is accurate in every detail I could check against master, but the opening cadence claim — "Each UPDATE traversal recomputes mSkinToSkelMatrix from the drawable's current node path" — states as unconditional something the code gates twice, and omits the guard that gives it teeth. updateSkinToSkelMatrix has exactly one caller: updateBounds (riggeometry.cpp:249), which is reached on UPDATE_VISITOR (accept, :382) only after (1) `if (!mSkeleton) { if (!initFromParentSkeleton(nv)) return; }` — riggeometry.cpp:238-241, and (2) `if (!mSkeleton->getActive() && !mBoundsFirstFrame) return; mBoundsFirstFrame = false;` — riggeometry.cpp:243-245, with `bool mBoundsFirstFrame{ true }` (riggeometry.hpp:108). So an inactive skeleton (Skeleton::setActive/ActiveType Inactive, skeleton.hpp:46-57 — the documented "bones are not currently moving" case) recomputes the matrix on the FIRST update traversal and never again. The rule's "each UPDATE traversal" is true only while the skeleton is active. This is load-bearing, not pedantic: cull() — the path that actually skins vertices — consumes the matrix at riggeometry.cpp:184-185 (`transform = (*mSkinToSkelMatrix) * mData->mTransform`) and never recomputes it. So for an inactive skeleton the skinning transform is whatever node path was current at the last passing update, not the drawable's current one. A reader porting from this rule would believe the matrix self-heals per frame after a reparent; it does not unless the skeleton is active. Secondary omission: the function's own early exit `if (skeletonRoot == nodePath.end()) return;` (:294-295) — if the Skeleton is not on the path, nothing is cancelled at all and any previously accumulated matrix is left identity. For the record, the parts I tried hardest to break and could not: nodePath does end with the RigGeometry (accept does nv.pushOntoNodePath(this) at :365), so end()-2 is genuinely the parent; the fallback polarity is NOT inverted (loop is half-open `it != skinRoot`, so name-equal leaves skinRoot at the parent = EXCLUDED, name-differs increments = INCLUDED, exactly as stated); skinRoot++ on a found root does make it inclusive; the identity-skip and post-multiplied computeWorldToLocalMatrix are right; nifloader.cpp:1716-1717, :715, :1757, attach.cpp:48-55 and riggeometry.hpp:22-24 all land on precisely the cited code; and the 0.49.0 warning holds (updateGeomToSkelMatrix spans :283-310, walks begin()→end()-1 cancelling Skeleton-exclusive through parent-inclusive, has no root-bone concept, and the class has no mTransform member — though the overa ...

**Corrected form offered:** NiSkinInstance::mRoot is stored by name only (nifloader.cpp:1716-1717, rig->setRootBone(rootBone->mName)). mSkinToSkelMatrix is recomputed from the drawable's current node path in updateSkinToSkelMatrix, called only from updateBounds (riggeometry.cpp:249) on an UPDATE traversal AND only when that call gets past two guards: the skeleton must be resolvable (initFromParentSkeleton, :238-241) and, after the very first update, the skeleton must be active — `if (!mSkeleton->getActive() && !mBoundsFirstFrame) return;` (:243-245, mBoundsFirstFrame starts true). For an inactive skeleton the matrix is therefore computed once and then frozen, and cull() — which does the actual skinning — only consumes it (:184-185, transform = (*mSkinToSkelMatrix) * mData->mTransform) and never recomputes it, so skinning can run on a matrix derived from a stale node path. When it does run: if the Skeleton is not on the node path the function returns immediately and cancels nothing (:294-295). Otherwise start just BELOW the Skeleton; search forward for the first node whose name matches the skin root case-insensitively (only if the skin declares a root); if found, the cancelled range ends just AFTER it (skinRoo


## 42. A skinned mesh's bounds come from the bones' bounding spheres, never from posed vertices
- `components/sceneutil/riggeometry.cpp:251-268` - NIF skinning, importance **n/a**

The bounding box is the union of every resolved bone's NiSkinData BoneInfo bounding sphere (read at data.cpp:41-42, carried at nifloader.cpp:1709), each transformed by bone->mMatrixInSkeletonSpace * transform - the same 'transform' as rule C (skinToSkel then NiSkinData's overall transform), so the bone's current pose then the skin-to-skeleton correction. Bones that did not resolve are skipped. transformBoundingSphere (components/sceneutil/util.hpp:59-90) moves the centre and takes the LARGEST of three axis-probe lengths as the new radius: a conservative approximation, not a tight bound. This runs in the UPDATE traversal only, and after the first frame it is skipped entirely while the skeleton is inactive. When the box changes, both double-buffered geometries receive it through CopyBoundingBoxCallback / CopyBoundingSphereCallback and all parents are dirtied; the internal geometries have setCullingActive(false) (riggeometry.cpp:54), so ALL culling of a skinned mesh uses this bone-sphere box and nothing else.

```cpp
        osg::BoundingBox box;
        osg::Matrixf transform;
        if (mSkinToSkelMatrix)
            transform = (*mSkinToSkelMatrix) * mData->mTransform;
        else
            transform = mData->mTransform;

        size_t index = 0;
        for (const BoneInfo& info : mData->mBones)
        {
            const Bone* bone = mNodes[index++];
            if (bone == nullptr)
                continue;

            osg::BoundingSpheref bs = info.mBoundSphere;
            transformBoundingSphere(bone->mMatrixInSkeletonSpace * transform, bs);
            box.expandBy(bs);
        }
```

**Recorded caveat** (from adversarial verification - the rule above is
sound, this is the condition it must not be read past):

> The mechanical core is right (union of resolved bones' spheres in /tmp/fpv/openmw/components/sceneutil/riggeometry.cpp:251-268, transform = skinToSkel * mData->mTransform, null bones skipped, UPDATE-only dispatch at riggeometry.cpp:382, the !getActive() && !mBoundsFirstFrame skip at 243-245, double-buffered copy + parent dirtying), but three claims overreach or invert what the code does. (1) "conservative approximation" is backwards. transformBoundingSphere (/tmp/fpv/openmw/components/sceneutil/util.hpp:59-90) probes the three axis offsets and takes the largest resulting length. Each probe length is a row norm of the matrix's linear part, and every row norm is <= the largest singular value, so the computed radius is never larger than the true transformed-sphere radius. It is exact for rotation/uniform-scale (the usual bone case) and an UNDER-estimate under shear or non-uniform scale - i.e. potentially non-conservative, the opposite of what the rule asserts. (The subsequent box.expandBy(sphere) is what adds slack, not the radius rule.) (2) "ALL culling of a skinned mesh uses this bone-sphere box and nothing else" over-generalises in two ways. First, RigGeometry::accept (riggeometry.cpp:378-386) never calls nv.apply(*this) for a CULL_VISITOR - it calls cull() directly - so the CullVisitor's drawable frustum test is never applied to this box either. The box reaches culling only indirectly, by feeding ancestors' bounds via the dirtyBound() loop; the actual isCulled test runs on a parent's combined bound, which also covers siblings. Consequently the per-vertex skinning loop in cull() runs whenever the parent is not culled, regardless of this box. Second, not every skinned mesh is a SceneUtil::RigGeometry: COLLADA/glTF skins are converted to SceneUtil::RigGeometryHolder (/tmp/fpv/openmw/components/sceneutil/riggeometryosgaextension.cpp:93-94, 114), whose _boundingBox comes from the osgAnimation source geometry's compute-bound callback and has nothing to do with NiSkinData bone spheres. (3) The sphere source is stated as NiSkinData only. nifloader.cpp:1709 is one of two sites; nifloader.cpp:1870 fills the same BoneInfo::mBoundSphere from Nif::BSSkinBoneData for Fallout 4 BSTriShape skins (struct at components/nif/data.hpp:263-275). data.cpp:41-42 covers only the NiSkinData path.

**Corrected form offered:** In RigGeometry::updateBounds (/tmp/fpv/openmw/components/sceneutil/riggeometry.cpp:235-268) the box is the union of the bounding spheres of every bone that resolved to a non-null Bone; each sphere is carried from the NIF loader - NiSkinData::BoneInfo::mBoundSphere at nifloader.cpp:1709 (read at nif/data.cpp:41-42) for NiSkinInstance meshes, and BSSkinBoneData::BoneInfo::mBoundSphere at nifloader.cpp:1870 for Fallout 4 BSTriShape skins - and is transformed by bone->mMatrixInSkeletonSpace * transform, where transform is (skinToSkel * mData->mTransform), the same composition the vertex path uses (the bound path just omits the per-bone inverse bind matrix). Unresolved bones are skipped, as are invalid spheres (BoundingBox::expandBy ignores them). transformBoundingSphere (components/sceneutil/util.hpp:59-90) moves the centre and takes the largest of three axis-probe lengths as the radius. Those lengths are row norms of the matrix's linear part, so the result is always <= the true (max-singular-value) radius: exact for rotation and uniform scale, an under-estimate under shear or non-uniform scale. It is therefore not a conservative bound; the slack in the final box comes from wrapping ea


## 43. Skinning runs once per frame in the CULL traversal, into a frame%2 double buffer
- `components/sceneutil/riggeometry.cpp:149-161` - NIF skinning, importance **n/a**

Ordering and frequency are part of the contract. Bounds and the skin-to-skeleton matrix are computed in the UPDATE traversal (accept -> updateBounds, riggeometry.cpp:382-383); the vertex skinning itself happens in the CULL traversal (accept -> cull, :369-381). cull() re-poses at most once per traversal number: if this frame's number was already handled (a second camera or render pass) or the skeleton is inactive after the first frame, the previously written geometry is re-submitted unchanged and no vertex is recomputed. The output alternates between two geometries selected by frame % 2 (getGeometry, :395-398), so the buffer being written is not the one drawn last frame. mSkeleton->updateBoneMatrices(traversalNumber) is called at the top of both cull and updateBounds, and is itself idempotent per frame. Consequences for a port: the skinToSkel matrix used by a frame's skinning is the one computed in that frame's preceding update pass, and the drawable itself is never culled - only its precomputed bone-sphere box is (see the bounds rule). This is the only skinning path for NIF content: SceneUtil::RigGeometryHolder / OsgaRigGeometry (components/sceneutil/riggeometryosgaextension.hpp:13-30) exist solely for osgAnimation/COLLADA models.

```cpp
        unsigned int traversalNumber = nv->getTraversalNumber();
        if (mLastFrameNumber == traversalNumber || (mLastFrameNumber != 0 && !mSkeleton->getActive()))
        {
            osg::Geometry& geom = *getGeometry(mLastFrameNumber);
            nv->pushOntoNodePath(&geom);
            nv->apply(geom);
            nv->popFromNodePath();
            return;
        }
        mLastFrameNumber = traversalNumber;
        osg::Geometry& geom = *getGeometry(mLastFrameNumber);

        mSkeleton->updateBoneMatrices(traversalNumber);
```

**Recorded caveat** (from adversarial verification - the rule above is
sound, this is the condition it must not be read past):

> The mechanism sketch is right (update computes bounds + skinToSkel, cull skins, once per traversal number, frame%2 double buffer) and every line citation checks out, but two consequences are asserted unconditionally when the code makes them conditional. (a) "the buffer being written is not the one drawn last frame" fails because the early-out at riggeometry.cpp:150-157 re-submits the old geometry WITHOUT advancing mLastFrameNumber; after one inactive frame the next re-pose lands on traversalNumber = mLastFrameNumber+2, so getGeometry() returns the very buffer drawn last frame. The parity is tied to the absolute traversal number, not to an alternation counter, so any skipped cull collides the same way. (b) "the skinToSkel matrix used by a frame's skinning is the one computed in that frame's preceding update pass" omits two guards: updateBounds early-returns at :243 (!getActive() && !mBoundsFirstFrame), and Skeleton::traverse (skeleton.cpp:131-138) skips the update traversal entirely for Inactive skeletons after frame 1 and for SemiActive skeletons whose mLastCullFrameNumber+3 <= traversalNumber. Since getActive() is mActive != Inactive (skeleton.cpp:119-122), a SemiActive rig passes cull's guard and re-skins while its update pass was skipped, using a stale mSkinToSkelMatrix and stale bounding box.

**Corrected form offered:** Ordering and frequency are part of the contract. Bounds and the skin-to-skeleton matrix are computed in the UPDATE traversal (accept -> updateBounds, riggeometry.cpp:382-383); the vertex skinning happens in the CULL traversal (accept -> cull, :369-381). cull() re-poses at most once per traversal number: if this frame's number was already handled (a second camera or render pass) or the skeleton is inactive after the first cull, the previously written geometry is re-submitted unchanged, no vertex is recomputed, and crucially mLastFrameNumber is NOT advanced. Output geometry is chosen by mLastFrameNumber % 2 (getGeometry, :395-398), so the write targets a different buffer than the previous draw only when re-posing happens on consecutive traversal numbers; after a skipped or re-submitted frame the next re-pose (traversal n+2) writes into the same buffer that was just drawn, so a port cannot rely on the double buffer as an unconditional write/read separation. mSkeleton->updateBoneMatrices(traversalNumber) is called in both cull and updateBounds and is idempotent per frame (skeleton.cpp:95-111). The skinToSkel matrix is recomputed only inside updateBounds, which itself returns early when


## 44. A text key record is (time, blob); the blob is split on \r and \n, trimmed, lowercased, and every surviving line becomes its own key AT THE SAME TIME
- `components/nifosg/nifloader.cpp:213-227` - Text keys and .kf, importance **n/a**

NiTextKeyExtraData holds a vector of {float mTime; std::string mText} (components/nif/extra.hpp:74-86, read at extra.cpp:19-30). Loading does NOT treat mText as one key. It is split with Misc::StringUtils::split(mText, results, "\r\n"), and that split uses find_first_of over the delimiter STRING AS A CHARACTER SET (components/misc/strings/algorithm.hpp:173-184), so it breaks on '\r' OR '\n' individually — a CRLF-separated blob yields an empty string between each pair. Each piece is then trimmed (algorithm.hpp:160-171, std::isspace: space \t \n \v \f \r), ASCII-lowercased, and dropped if empty. Every non-empty piece is emplaced into a std::multimap<float,std::string> under THE SAME mTime. So one NIF text-key record carrying "Idle: Stop\r\nIdle2: Start" produces TWO independent keys at one identical time, and the multimap is what preserves them. JS port: `text.split(/[\r\n]/).map(trim).map(asciiLower).filter(s => s.length)`, all pushed at the one time, into a structure that allows duplicate times.

```cpp
    void extractTextKeys(const Nif::NiTextKeyExtraData* tk, SceneUtil::TextKeyMap& textkeys)
    {
        for (const Nif::NiTextKeyExtraData::TextKey& key : tk->mList)
        {
            std::vector<std::string> results;
            Misc::StringUtils::split(key.mText, results, "\r\n");
            for (std::string& result : results)
            {
                Misc::StringUtils::trim(result);
                Misc::StringUtils::lowerCaseInPlace(result);
                if (!result.empty())
                    textkeys.emplace(key.mTime, std::move(result));
            }
        }
    }
```

**Recorded caveat** (from adversarial verification - the rule above is
sound, this is the condition it must not be read past):

> The rule's parsing pipeline is entirely correct and I confirmed every step against the source: the record layout (extra.hpp:74-86, extra.cpp:19-30); split's find_first_of over the delimiter as a CHARACTER SET (algorithm.hpp:173-184), so CRLF really does yield an empty piece between each pair (verified by compiling and running the split: 3 pieces, ["Idle: Stop", "", "Idle2: Start"]); trim via std::isspace (algorithm.hpp:160-171); ASCII-only lowercasing via the 256-entry tolowermap that touches only A-Z (lower.hpp:26-40); the empty-drop guard in the correct direction; and both surviving pieces emplaced under the identical key.mTime. So "one NIF text-key record can yield two keys at one time" is right. It overreaches on the destination. `textkeys` is a SceneUtil::TextKeyMap (components/sceneutil/textkeymap.hpp), NOT a std::multimap<float,std::string>. TextKeyMap is a class wrapping that multimap PLUS a std::set<std::string, std::less<>> mGroups, and its emplace() runs a conditional the rule elides entirely: it does textKey.find(": ") and, when found, inserts substr(0, separator) into mGroups before inserting into the multimap. That group set is what backs hasGroupStart(), findGroupStart() and getGroups() — the animation layer's group discovery. The rule converts its mischaracterization into the port spec ("into a structure that allows duplicate times"), so a JS port built to it would faithfully reproduce split/trim/lower/filter and silently lose group registration. The rule's own example is exactly the case that fires the elided branch twice, registering "idle" and "idle2".

**Corrected form offered:** NiTextKeyExtraData holds a vector of {float mTime; std::string mText} (components/nif/extra.hpp:74-86, read at extra.cpp:19-30). Loading does NOT treat mText as one key. It is split with Misc::StringUtils::split(mText, results, "\r\n"), and that split uses find_first_of over the delimiter STRING AS A CHARACTER SET (components/misc/strings/algorithm.hpp:173-184), so it breaks on '\r' OR '\n' individually — a CRLF-separated blob yields an empty string between each pair. Each piece is then trimmed (algorithm.hpp:160-171, std::isspace: space \t \n \v \f \r), ASCII-lowercased (lower.hpp:26-40, a tolowermap that maps only A-Z and leaves multibyte bytes unchanged), and dropped if empty. Every non-empty piece is then emplaced under THE SAME mTime into a SceneUtil::TextKeyMap (components/sceneutil/textkeymap.hpp) — NOT a raw std::multimap. TextKeyMap wraps a std::multimap<float,std::string> (which is what preserves duplicate times) alongside a std::set<std::string, std::less<>> mGroups, and its emplace() does two things: if the key contains ": " it inserts the prefix before that separator into mGroups, then it inserts into the multimap. mGroups backs hasGroupStart(), findGroupStart() and ge


## 45. Case is normalised ONCE at load, ASCII-only; every consumer then does EXACT byte comparison
- `components/misc/strings/lower.hpp:23-40` - Text keys and .kf, importance **n/a**

lowerCaseInPlace is applied in extractTextKeys (nifloader.cpp:222). It uses a 256-entry table that maps only 'A'-'Z' (65-90) to 'a'-'z'; every other byte, including all multibyte/UTF-8 continuation bytes, is returned unchanged. After that point NOTHING in the animation layer is case-insensitive: Animation::handleTextKey compares with `==` and starts_with (animation.cpp:861-867), Animation::reset via equalsParts uses `==` (animation.cpp:169-178), CharacterController::handleTextKey compares evt.substr(...) against lowercase literals with `!=`/`==` (character.cpp:1016, 1024, 1067, 1074+). Groups passed in from code ("weapononehand", "idle1h", "spellcast") are already lowercase literals. JS port: lowercase with an ASCII-only map at parse time (NOT String.prototype.toLowerCase, which is Unicode-aware and would fold e.g. 'İ' or 'K'), then compare exactly. This also means the payload of a `sound:` key is lowercased too — the sound ID is looked up in lowercase.

```cpp
    /// Plain and simple locale-unaware toLower. Anything from A to Z is lower-cased, multibyte characters are
    /// unchanged. Don't use std::tolower(char, locale&) because that is abysmally slow. Don't use tolower(int) because
    /// that depends on global locale.
    inline constexpr char toLower(char c)
    {
        return tolowermap[static_cast<unsigned char>(c)];
    }

    /// Transforms input string to lower case w/o copy
    inline void lowerCaseInPlace(std::string& str)
    {
        for (auto& ch : str)
            ch = toLower(ch);
    }
```

**Recorded caveat** (from adversarial verification - the rule above is
sound, this is the condition it must not be read past):

> The comparison half of the rule is exactly right and every line number checks out against OpenMW master: lower.hpp's 256-entry table maps only 65-90 to 97-122 and leaves every other byte (including UTF-8 continuation bytes) untouched; nifloader.cpp:213-227 splits on "\r\n", trims, lowerCaseInPlace's each line and skips empties; equalsParts at animation.cpp:169-178 is starts_with + ==; Animation::handleTextKey at 861-867 is starts_with + ==; character.cpp:1016/1024/1067/1074 are ==/!= against lowercase literals. But the absolute "after that point NOTHING in the animation layer is case-insensitive" is contradicted by the very branch the rule ends on. character.cpp:1019 passes the lowercased payload to ESM::RefId::stringRefId, and RefIds are interned in a std::unordered_set keyed by Misc::StringUtils::CiHash/CiEqual (components/esm/stringrefid.cpp:17), with StringRefId::operator==(string_view) = ciEqual and operator< = ciLess (:59-66). The soundgen branch is the same: Creature::getSoundIdFromSndGen matches `ourId == sound->mCreature` (creature.cpp:605) by case-insensitive RefId compare. So sound resolution downstream of the text key is case-insensitive, and that is precisely why the lowercased payload resolves at all: Morrowind sound records retain their ESM casing ("WolfHowl", "Item Weapon Longblade Up"). The rule's porting instruction, "lowercase at parse time, then compare exactly", is correct for text-key matching but wrong for the sound path it explicitly calls out: an exact-match lookup of a lowercased sound ID against a store keyed by original-case ESM IDs finds nothing. A lesser gap: lowercasing at parse time is not universal even upstream, since the osgAnimation/collada path builds text keys from a .txt sidecar via parseTextKey (components/resource/keyframemanager.cpp:28-33, 172) with no case folding.

**Corrected form offered:** lowerCaseInPlace is applied in extractTextKeys (nifloader.cpp:222), after the line is split on "\r\n" and trimmed, with empty results dropped (nifloader.cpp:217-224). It uses a 256-entry table that maps only 'A'-'Z' (65-90) to 'a'-'z'; every other byte, including all multibyte/UTF-8 continuation bytes, is returned unchanged. Every text-key STRING COMPARISON after that point is case-sensitive against lowercase literals: Animation::handleTextKey uses == and starts_with (animation.cpp:861-867), Animation::reset via equalsParts uses starts_with/== (animation.cpp:169-178), CharacterController::handleTextKey compares evt.substr(...) with !=/== (character.cpp:1016, 1024, 1067, 1074+). Groups passed in from code ("weapononehand", "idle1h", "spellcast") are already lowercase literals. The payloads the handler then extracts leave that world, however: `sound:` hands evt.substr(7) to ESM::RefId::stringRefId, and RefIds are interned in a CiHash/CiEqual set with operator==(string_view)=ciEqual and operator<=ciLess (components/esm/stringrefid.cpp:17, 59-66), so the sound-store lookup is case-INsensitive; the `soundgen:` path likewise resolves through case-insensitive RefId compares (creature.cpp:


## 46. getStartTime is the group's FIRST key, not its "start" key; getTextKeyTime is a PREFIX match returning -1 when absent
- `apps/openmw/mwrender/animation.cpp:827-854` - Text keys and .kf, importance **n/a**

Two different lookups, easy to conflate. getStartTime(group) uses findGroupStart, whose predicate is only `starts_with(group) && compare(group.size(), 2, ": ") == 0` — ANY key of that group — over the map in FORWARD time order, so it returns the time of the group's earliest key whatever its action is; the header comment says so verbatim: "Get the absolute position in the animation track of the first text key with the given group" (animation.hpp:427-428). getTextKeyTime(textKey) is a PREFIX test (`iterKey->second.starts_with(textKey)`), forward in time, and returns the first match; it does NOT require an exact key. Both iterate mAnimSources in REVERSE (last-added source wins) and both return -1.f when nothing matches — which is the sentinel every caller tests (e.g. character.cpp:1243 `if (minAttackTime == -1.f ...)`, animation.cpp:807 `if (getTextKeyTime(group + ": loop start") >= 0) return true`). JS port: -1 is the not-found value, not null/undefined, and the callers compare against it numerically.

```cpp
    float Animation::getStartTime(const std::string& groupname) const
    {
        for (AnimSourceList::const_reverse_iterator iter(mAnimSources.rbegin()); iter != mAnimSources.rend(); ++iter)
        {
            const SceneUtil::TextKeyMap& keys = (*iter)->getTextKeys();

            const auto found = keys.findGroupStart(groupname);
            if (found != keys.end())
                return found->first;
        }
        return -1.f;
    }

    float Animation::getTextKeyTime(std::string_view textKey) const
    {
        for (AnimSourceList::const_reverse_iterator iter(mAnimSources.rbegin()); iter != mAnimSources.rend(); ++iter)
        {
            const SceneUtil::TextKeyMap& keys = (*iter)->getTextKeys();

            for (auto iterKey = keys.begin(); iterKey != keys.end(); ++iterKey)
            {
                if (iterKey->second.starts_with(textKey))
                    return iterKey->first;
            }
        }

        return -1.f;
    }
```

**Recorded caveat** (from adversarial verification - the rule above is
sound, this is the condition it must not be read past):

> Every mechanical claim verifies exactly, but one universal quantifier overreaches. VERIFIED (all confirmed against source): - findGroupStart's predicate is verbatim `value.second.starts_with(mGroupName) && value.second.compare(mGroupName.size(), 2, ": ") == 0` (components/sceneutil/textkeymap.hpp, struct IsGroupStart) — note this lives in textkeymap.hpp, NOT animation.hpp as the rule's phrasing loosely implies. - It is a std::find_if over `std::multimap<float, std::string> mTextKeyByTime` from begin() to end(), i.e. forward time order, so it does return the group's earliest key regardless of action suffix. The ": " check correctly prevents "idle" matching "idle2: start". - The header comment is verbatim and the line cite is exact: animation.hpp:427 is the comment "/// Get the absolute position in the animation track of the first text key with the given group.", :428 the declaration. - getTextKeyTime is indeed a pure prefix test (`iterKey->second.starts_with(textKey)`), forward, first match, no exact-key requirement. - Both loop mAnimSources via rbegin/rend (animation.cpp:829, :842) and mAnimSources.push_back(animsrc) is at animation.cpp:703, so "last-added source wins" is right. - Both return -1.f. Both cited examples are verbatim correct: character.cpp:1243 is `if (minAttackTime == -1.f || minAttackTime >= maxAttackTime)`, and animation.cpp:807 is `if (getTextKeyTime(std::string(group) + ": loop start") >= 0)` / :808 `return true`. THE OVERREACH: "-1.f ... which is the sentinel every caller tests" is false. Two of the nine call sites never test the sentinel and instead consume the value arithmetically: - character.cpp:2597-2600 — `float start = getTextKeyTime(mGroup + ": start"); float stop = getTextKeyTime(mGroup + ": stop"); float time = std::clamp(animation.mTime, start, stop); entry.mTime = (time - start) / (stop - start);` No -1 check at all. If the keys are missing this clamps against -1/-1 and divides by zero, and if start > stop std::clamp is undefined behavior. - character.cpp:1879-1882 — minAttackTime and startTime feed straight into `if (startTime <= currentTime && currentTime < minAttackTime)` and then into `(currentTime - startTime) / (minAttackTime - startTime)`; the ordering comparison happens to filter the -1 case, but nothing tests the sentinel. (character.cpp:1767-1780 is likewise mixed: :1776 does test `minAttackTime != -1.f`, but the minHitTime/hitTime pair at :1779-1780 is only ordering-compared.) This matters for the JS port, and it cuts the opposite way from the rule's framing: because some callers do raw arithmetic on the result, ...

**Corrected form offered:** Two different lookups, easy to conflate. getStartTime(group) uses SceneUtil::TextKeyMap::findGroupStart (defined in components/sceneutil/textkeymap.hpp, not animation.hpp), whose predicate is only `starts_with(group) && compare(group.size(), 2, ": ") == 0` — ANY key of that group — applied by std::find_if over the multimap in FORWARD time order, so it returns the time of the group's earliest key whatever its action is; the header comment says so verbatim: "Get the absolute position in the animation track of the first text key with the given group" (animation.hpp:427-428). getTextKeyTime(textKey) is a PREFIX test (`iterKey->second.starts_with(textKey)`), forward in time, returning the first match; it does NOT require an exact key. Both iterate mAnimSources in REVERSE (last-added source wins, since addAnimSource push_backs at animation.cpp:703) and both return -1.f when nothing matches. JS port: -1 is the not-found value, not null/undefined. Most callers test it numerically (character.cpp:1243 `if (minAttackTime == -1.f || minAttackTime >= maxAttackTime)`, character.cpp:1413 and :1471 `< 0`, character.cpp:1643 `startTime == -1.f`, character.cpp:2643 `endOfLoop < 0`, animation.cpp:807


## 47. A key whose group is not the playing group is SILENTLY DROPPED — except "sound: " and "soundgen: ", which are group-independent
- `apps/openmw/mwmechanics/character.cpp:1012-1073` - Text keys and .kf, importance **n/a**

Every key the playhead crosses is dispatched (Animation::runAnimation -> Animation::handleTextKey -> mTextKeyListener->handleTextKey, animation.cpp:1372-1390, 870-873), so the listener sees keys of OTHER groups too. CharacterController::handleTextKey filters them, and the order of the checks is the rule: (1) the whole key is forwarded to Lua unconditionally; (2) if it starts with the 7 bytes "sound: ", the remainder is a sound ID and it plays at volume 1.0 / pitch 1.0, then RETURNS — no group check at all; (3) if it starts with the 10 bytes "soundgen: ", the remainder is `<sndgen name> [volume] [pitch]`, whitespace-split (default delimiter " "), volume and pitch parsed as floats defaulting to 1.0, then RETURNS — again no group check; (4) only then is the group tested, and any key not beginning with exactly `<currently playing group>` + ": " is discarded with the comment "Not ours, skip it". There is no error, no fallback, no warning — an unknown or foreign group's key simply does nothing. Note the test is against the group the STATE is playing, not against the set of known groups: an unknown group's keys are never even reached, because a group with no keys can never be played (rule on mSupportedAnimations above).

```cpp
        std::string_view evt = key->second;

        MWBase::Environment::get().getLuaManager()->animationTextKey(mPtr, key->second);

        if (evt.substr(0, 7) == "sound: ")
        {
            MWBase::SoundManager* sndMgr = MWBase::Environment::get().getSoundManager();
            sndMgr->playSound3D(mPtr, ESM::RefId::stringRefId(evt.substr(7)), 1.0f, 1.0f);
            return;
        }

        auto& charClass = mPtr.getClass();
        if (evt.substr(0, 10) == "soundgen: ")
        {
            std::string_view soundgen = evt.substr(10);

            // The event can optionally contain volume and pitch modifiers
            float volume = 1.0f;
            float pitch = 1.0f;

            if (soundgen.find(' ') != std::string::npos)
            {
                std::vector<std::string_view> tokens;
                Misc::StringUtils::split(soundgen, tokens);
                soundgen = tokens[0];

                if (tokens.size() >= 2)
                {
                    volume = Misc::StringUtils::toNumeric<float>(tokens[1], volume);
                }

                if (tokens.size() >= 3)
                {
                    pitch = Misc::StringUtils::toNumeric<float>(tokens[2], pitch);
                }
            }

            const ESM::RefId sound = charClass.getSoundIdFromSndGen(mPtr, soundgen);
...
        if (evt.substr(0, groupname.size()) != groupname || evt.substr(groupname.size(), 2) != ": ")
        {
            // Not ours, skip it
            return;
        }

        std::string_view action = evt.substr(groupname.size() + 2);
```

**Recorded caveat** (from adversarial verification - the rule above is
sound, this is the condition it must not be read past):

> The ordering claim is right, but step (1) is stated as unconditional when it is not, and the excerpt was cut one line below the guard that makes it conditional. CharacterController::handleTextKey opens at character.cpp:1009-1011 with `if (!mAnimation) return;` — two lines ABOVE where the quoted span starts (line 1012, `std::string_view evt = key->second;`). That early return aborts the entire handler, the Lua dispatch included, so it is false that "the whole key is forwarded to Lua unconditionally"; when mAnimation is null nothing at all happens, not Lua, not sound, not the group test. (The guard is defensive — detachAnimation at 998-1004 nulls mAnimation and calls setTextKeyListener(nullptr) in the same block — but it is a real guard on the very step the rule calls unconditional.) Secondarily, the rule flattens the soundgen branch: after parsing, playback is gated twice — `charClass.getSoundIdFromSndGen(mPtr, soundgen)` may return an empty RefId, in which case nothing plays at all, and for soundgen "left"/"right" the sound plays only `if (!sndMgr->getSoundPlaying(mPtr, wolfRun))`, with MWSound::Type::Foot and PlayMode::NoPlayerLocal rather than a plain playSound3D. The rule's own "no error, no fallback, no warning" phrasing also sits next to an error path it does not mention: Animation::handleTextKey wraps the listener call in try/catch and logs `Log(Debug::Error) << "Error handling text key ..."` (animation.cpp:870-878) — that fires on exceptions, not on foreign-group keys, so it does not contradict the discard claim but does contradict the flat "there is no error" framing of the dispatch path. Everything else checks out: dispatch is Animation::runAnimation -> handleTextKey (animation.cpp:1375, 1388) -> mTextKeyListener->handleTextKey (872-873); groupname is `stateiter->first`, the state's own playing group, so the listener genuinely sees other groups' keys from the same text-key map; the `sound: ` branch does play at 1.0f/1.0f and returns with no group check; split's default delimiter really is " "; the group test `evt.substr(0, groupname.size()) != groupname || evt.substr(groupname.size(), 2) != ": "` discards silently; and Animation::reset (animation.cpp:968-1040) does return false unless both a start and a stop key exist for the group, so a keyless group can never become an AnimState and can never be the groupname argument. Note one addition the rule misses: keys are also dispatched from Animation::play (animation.cpp:940-960) at and below the start time, so the listener sees keys the playhead never "crossed" during runAnimation.

> The dispatch chain and the order of checks are correct and nothing overrides them: CharacterController is the sole TextKeyListener implementer (character.hpp:128), setTextKeyListener has exactly one caller (character.cpp:918), handleTextKey has no subclass override, and NpcAnimation::setViewMode/rebuild (npcanimation.cpp:296-321, 435-442) keeps the same animation object so a first-person switch never drops the listener. But the rule truncates the soundgen branch exactly where the player / first-person / werewolf special cases live (character.cpp:1049-1063), and those matter for a first-person player body. (1) The branch does not merely parse and return: charClass.getSoundIdFromSndGen(mPtr, soundgen) resolves the name and an empty result plays nothing — Npc::getSoundIdFromSndGen (mwclass/npc.cpp:1149-1197) returns empty when flying, returns empty for "land", "moan", "roar", "scream", and otherwise selects swim/footwater/bare/light/medium/heavy from the Boots slot (beast races, unable to wear boots, always take the bare branch). (2) soundgen "left"/"right" is special-cased twice: it plays only if !sndMgr->getSoundPlaying(mPtr, wolfRun) — a werewolf suppression, wolfRun at character.cpp:63, looped at :2530-2540 — and it passes MWSound::Type::Foot with PlayMode::NoPlayerLocal, deliberately opting out of the player branch in SoundManager::playSound3D (mwsound/soundmanagerimp.cpp:549). Every other key sound (sound: at :1019, non-footstep soundgen at :1061) takes that player branch and becomes a 2D local sound for the player, so the FP player's footsteps are the one positional sound here. (3) "There is no error, no fallback, no warning" is false on this path: Npc::getSoundIdFromSndGen throws "Unexpected soundgen type: <name>" (npc.cpp:1196) and Class::getSoundIdFromSndGen throws "class does not support soundgen look up" (mwworld/class.cpp:274); the throw escapes into Animation::handleTextKey's try/catch (mwrender/animation.cpp:866-878) and is logged at Debug::Error, and Creature/Activator carry explicit fallbacksounds lists (creature.cpp:588+, activator.cpp:132+). Smaller corrections: if (!mAnimation) return; precedes the Lua forward (:1010-1011); LuaManager::animationTextKey (mwlua/luamanagerimp.cpp:598-604) drops keys containing no ": " and splits the rest into group+key rather than forwarding the whole key; Animation::runAnimation skips non-scripted states entirely when mPlayScriptedOnly is set (animation.cpp:1342, set from character.cpp:1915/1952/2776); Animation::play also fires keys at the start point (animation.cpp:938-960); non-actors route through the  ...

**Corrected form offered:** Every key a playing state's playhead crosses is dispatched (Animation::runAnimation -> Animation::handleTextKey -> mTextKeyListener->handleTextKey, animation.cpp:1375/1388 and 870-878; Animation::play, animation.cpp:940-960, additionally fires keys at and below the start time), with groupname = the group that state is playing, so the listener sees keys of OTHER groups in the same text-key map too. CharacterController::handleTextKey (character.cpp:1007-1177) filters them, and the order of the checks is the rule: (0) if mAnimation is null it returns immediately and NOTHING below happens — not even the Lua dispatch; (1) otherwise the whole key is forwarded to Lua via LuaManager::animationTextKey; (2) if it starts with the 7 bytes "sound: ", the remainder is a sound ID played at volume 1.0 / pitch 1.0, then RETURNS — no group check; (3) if it starts with the 10 bytes "soundgen: ", the remainder is `<sndgen name> [volume] [pitch]`, whitespace-split (Misc::StringUtils::split, default delimiter " ") only when it contains a space, volume and pitch parsed as floats defaulting to 1.0; the name is resolved through charClass.getSoundIdFromSndGen and plays only if that returns a non-empty RefId


## 48. play() evicts every equal-priority animation, and re-playing a live group does NOT restart it
- `apps/openmw/mwrender/animation.cpp:881-968` - Animation playback, importance **n/a**

Animation::play does four things in a fixed order. (1) An empty groupname is a no-op that only calls resetActiveGroups() and returns. (2) If a state for this group already exists, its mPriority is OVERWRITTEN with the new priority - and nothing else is. (3) It then erases every OTHER state whose priority vector is exactly equal (all four slots) to the new one, calling animationEnded on each; this is the eviction rule - same priority means mutually exclusive, regardless of blend mask. (4) If the group already existed, it calls resetActiveGroups() and RETURNS EARLY: the animation is not restarted, its time is not reset, and speedmult, blendMask, loops, autodisable, start and stop key are all silently IGNORED on that call. Only when the group was not already playing does it build a new AnimState, searching mAnimSources IN REVERSE - `/* Look in reverse; last-inserted source has priority. */` - and taking the FIRST source for which reset() finds usable start/stop keys. If no source has them, no state is created and nothing plays (no error, no fallback). Note the state is inserted into mStates BEFORE the initial text keys are handled, and the immediately-following block can consume one loop iteration at time zero when startPoint already lands at or past the loop-stop key.

```cpp
    void Animation::play(std::string_view groupname, const AnimPriority& priority, int blendMask, bool autodisable,
        float speedmult, std::string_view start, std::string_view stop, float startpoint, uint32_t loops,
        bool loopfallback)
    {
        if (!mObjectRoot || mAnimSources.empty())
            return;

        if (groupname.empty())
        {
            resetActiveGroups();
            return;
        }

        AnimStateMap::iterator foundstateiter = mStates.find(groupname);
        if (foundstateiter != mStates.end())
        {
            foundstateiter->second.mPriority = priority;
        }

        AnimStateMap::iterator stateiter = mStates.begin();
        while (stateiter != mStates.end())
        {
            if (stateiter->second.mPriority == priority && stateiter->first != groupname)
            {
                animationEnded(stateiter->second);
                stateiter = mStates.erase(stateiter);
            }
            else
                ++stateiter;
        }

        if (foundstateiter != mStates.end())
        {
            resetActiveGroups();
            return;
        }

        /* Look in reverse; last-inserted source has priority. */
        AnimState state;
        AnimSourceList::reverse_iterator iter(mAnimSources.rbegin());
        for (; iter != mAnimSources.rend(); ++iter)
        {
            const SceneUtil::TextKeyMap& textkeys = (*iter)->getTextKeys();
            if (reset(state, textkeys, groupname, start, stop, startpoint, loopfallback))
            {
                state.mSource = *iter;
                state.mSpeedMult = speedmult;
                state.mLoopCount = loops;
                state.mPlaying = (state.getTime() < state.mStopTime);
                state.mPriority = priority;
                s
...(truncated; see the cited lines)
```

**Recorded caveat** (from adversarial verification - the rule above is
sound, this is the condition it must not be read past):

> Most of the rule checks out, but it omits a guard and overreaches on its closing note. (a) OMITTED GUARD / CONDITIONAL STATED AS ALWAYS-TRUE. The rule says play "does four things in a fixed order" and makes the empty-groupname branch step (1). The function's actual first statement, one line above the quoted excerpt's step (1), is `if (!mObjectRoot || mAnimSources.empty()) return;`. So "an empty groupname is a no-op that only calls resetActiveGroups() and returns" is not always true: with a null mObjectRoot or an empty mAnimSources, play() returns immediately and resetActiveGroups() is NEVER called. That is a real behavioral difference, not a nitpick - resetActiveGroups() (animation.cpp:1110) removes every active controller from the scene graph via removeUpdateCallback, clears mActiveControllers, nulls mAccumCtrl, and recomputes the winning state per blend mask. The same unmentioned guard also gates steps (2), (3) and (4): the priority overwrite and the equal-priority eviction sweep do not run at all when mAnimSources is empty. (b) THE CLOSING NOTE OVERREACHES. `mStates[std::string{ groupname }] = state;` stores a COPY; `state` remains the local temporary and is never rebound to the map entry. AnimState (animation.hpp:150-178) holds `std::shared_ptr<float> mTime`, so setTime()/getTime() alias between copy and stored entry - but mLoopCount, mPlaying, mLoopStartTime and mLoopStopTime are plain members. Therefore `state.mLoopCount--` and `state.mPlaying = true` in the loop-fixup block, and the mLoopStartTime/mLoopStopTime writes that handleTextKey(AnimState&, ...) (animation.cpp:856) performs on the initial text keys, all land on a temporary that is discarded when play() returns. The stored state does NOT "consume one loop iteration": its time is rewound to mLoopStartTime (via the shared pointer) while its loop counter stays at the full value. The rule's own emphasis that the state is inserted BEFORE the text keys are handled implies those key effects reach the stored state; they do not. Verified as correct: the 4-slot priority comparison (sNumBlendMasks == 4 in blendmask.hpp; AnimPriority::operator== loops all four and never consults mBlendMask), the priority-only overwrite, the `stateiter->first != groupname` self-exclusion, the early return that silently ignores speedmult/blendMask/loops/autodisable/start/stop, the reverse first-match source search, and the silent no-op when no source yields usable keys.

**Corrected form offered:** The quoted range is 881-969 rather than 881-968; line 968 is the closing 'resetActiveGroups();' call and line 969 is the function's closing brace, which the quote includes. The code itself is verbatim correct.


## 49. Looping: mLoopStopTime is +infinity unless loopFallback, and each loop is one decrement plus a jump to mLoopStartTime
- `apps/openmw/mwrender/animation.cpp:1379-1395` - Animation playback, importance **n/a**

loops is a count of ADDITIONAL passes, consumed one at a time, and the loop window is [mLoopStartTime, mLoopStopTime], which is NOT the same as [mStartTime, mStopTime]. reset() initialises mLoopStartTime = start-key time in both branches, but mLoopStopTime = stop-key time ONLY when loopFallback is true; otherwise it is std::numeric_limits<float>::max(). Since shouldLoop() is `getTime() >= mLoopStopTime && mLoopingEnabled && mLoopCount > 0` (animation.hpp:177), an animation whose text keys carry no "<group>: loop stop" NEVER loops unless the caller passed loopFallback - it just runs start->stop once and stops. When a real "<group>: loop start"/"loop stop" key is crossed during playback, handleTextKey (animation.cpp:856-868) overwrites mLoopStartTime/mLoopStopTime live, which is how the loop window narrows to the authored sub-range after the first pass. Honouring a loop is: decrement mLoopCount, setTime(mLoopStartTime), force mPlaying = true, re-fire every text key at or before the new time, and break out of the inner loop if the playhead is STILL >= mLoopStopTime (the guard against a zero-length or inverted loop window spinning forever). mLoopCount is uint32_t and 'loop forever' is expressed as std::numeric_limits<uint32_t>::max() by callers. mLoopingEnabled is a separate live switch set by Animation::setLoopingEnabled (animation.cpp:1452-1457), used to let a running looped animation finish its current pass and stop.

```cpp
                if (state.shouldLoop())
                {
                    state.mLoopCount--;
                    state.setTime(state.mLoopStartTime);
                    state.mPlaying = true;

                    textkey = textkeys.lowerBound(state.getTime());
                    while (textkey != textkeys.end() && textkey->first <= state.getTime())
                    {
                        handleTextKey(state, stateiter->first, textkey, textkeys);
                        ++textkey;
                    }

                    if (state.getTime() >= state.mLoopStopTime)
                        break;
                }

// apps/openmw/mwrender/animation.hpp:177
            bool shouldLoop() const { return getTime() >= mLoopStopTime && mLoopingEnabled && mLoopCount > 0; }

// apps/openmw/mwrender/animation.cpp:1008-1020 (reset)
        state.mStartTime = startkey->first;
        if (loopfallback)
        {
            state.mLoopStartTime = startkey->first;
            state.mLoopStopTime = stopkey->first;
        }
        else
        {
            state.mLoopStartTime = startkey->first;
            state.mLoopStopTime = std::numeric_limits<float>::max();
        }
        state.mStopTime = stopkey->first;

// apps/openmw/mwrender/animation.cpp:856-868 (handleTextKey - the live loop-window update)
        if (evt.starts_with(groupname) && evt.substr(groupname.size()).starts_with(": "))
        {
            size_t off = groupname.size() + 2;
            if (evt.substr(off) == "loop start")
                state.mLoopStartTime = key->first;
            else if (evt.substr(off) == "loop stop")
                state.mLoopStopTime = key->first;
        }
```

**Recorded caveat** (from adversarial verification - the rule above is
sound, this is the condition it must not be read past):

> The rule states as unconditional something that reset() itself conditionally overwrites. It quotes reset() as ending at animation.cpp:1020 and asserts "mLoopStopTime = stop-key time ONLY when loopFallback is true; otherwise it is std::numeric_limits<float>::max()". Those are only the INITIAL values. reset() continues to line 1038 with a third stage the rule omits entirely — a reverse scan over the group's text keys that assigns state.mLoopStartTime / state.mLoopStopTime from real ": loop start" / ": loop stop" keys whose time is <= the startpoint-adjusted playhead. The source's own comment names the carve-out: "mLoopStartTime and mLoopStopTime normally get assigned when encountering these keys while playing the animation (see handleTextKey). But if startpoint is already past these keys, or start time is == stop time, we need to assign them now." So with loopfallback == false, a real ": loop stop" key, and a startpoint at or past it, reset() returns with mLoopStopTime equal to that key's time, not FLT_MAX. This is reachable, not hypothetical: CharacterController::playAnimQueue (character.cpp:1955-1961) passes mAnimQueue.front().mTime — a saved resume fraction restored by unpersistAnimationState (character.cpp:2594-2600) and written at 1938 — as the startpoint. Two consequences follow that the rule also gets wrong. First, its causal claim that handleTextKey "is how the loop window narrows to the authored sub-range after the first pass" is incomplete: reset() can narrow the window before any frame runs. Second, the rule presents animation.cpp:1379-1395 as the single site that honours a loop; Animation::play carries a second, near-duplicate block at animation.cpp:946-958 that fires at play() time before runAnimation ever touches the state, and its ordering differs — it checks "if (state.getTime() >= state.mLoopStopTime) break;" BEFORE re-firing the text keys, whereas the quoted runAnimation block re-fires the text keys first and then breaks. Everything else verifies: shouldLoop() at animation.hpp:177, the 1379-1395 block, handleTextKey at 856-868, setLoopingEnabled at 1452-1457, mLoopCount as uint32_t with std::numeric_limits<uint32_t>::max() used by callers for "forever" (character.cpp:491, 529, 758, 786, 1211, 1344, 2588), loops as additional passes, and the loop window being distinct from [mStartTime, mStopTime]. The headline conclusion — no ": loop stop" key means the animation never loops without loopFallback — does survive, since the override requires such a key to exist; but the mechanism as stated is presented as always-true when it is conditional.

**Corrected form offered:** loops is a count of ADDITIONAL passes, consumed one at a time, and the loop window is [mLoopStartTime, mLoopStopTime], which is NOT the same as [mStartTime, mStopTime]. reset() (animation.cpp:1008-1038) sets these in two stages. First it INITIALISES mLoopStartTime = start-key time in both branches, with mLoopStopTime = stop-key time when loopFallback is true and std::numeric_limits<float>::max() otherwise. Then, after seeking the playhead to mStartTime + (mStopTime - mStartTime) * startpoint, it re-scans the group's text keys and OVERWRITES mLoopStartTime / mLoopStopTime from any real "<group>: loop start" / "<group>: loop stop" key at or before that playhead — the code comment explains this covers the case where startpoint is already past those keys, or start time == stop time. So the FLT_MAX value is the non-fallback DEFAULT, not a guarantee: a resumed animation (CharacterController::playAnimQueue passes a saved resume fraction as startpoint) can come out of reset() with a real loop-stop time even when loopFallback is false. Since shouldLoop() is `getTime() >= mLoopStopTime && mLoopingEnabled && mLoopCount > 0` (animation.hpp:177), an animation whose text keys carry NO "<group>: 


## 50. Time advances in text-key-sized steps, and only the lower-body winner produces movement
- `apps/openmw/mwrender/animation.cpp:1341-1408` - Animation playback, importance **n/a**

Animation::runAnimation(duration) advances every AnimState independently. Per state: timepassed = duration * mSpeedMult, then an inner loop repeatedly steps the playhead to min(target, next text key time) clamped to mStopTime - the animation never jumps OVER a text key, it lands exactly on it, fires it, and continues with the remaining time. mPlaying becomes false as soon as time reaches mStopTime; timepassed is reduced by the distance actually travelled; the loop exits when timepassed <= 0. Text keys at or before the new playhead are fired in order via handleTextKey, which also forwards them to the TextKeyListener (the CharacterController). Root-motion accumulation is applied ONLY when `state.mTime == mAnimationTimePtr[0]->getTimePtr()`, i.e. only for the state that currently wins BoneGroup_LowerBody - so an upper-body-only animation can never move the actor. When the state finishes and mAutoDisable is set, the state is erased and resetActiveGroups() is called immediately (re-resolving all four bone groups mid-frame). If mPlayScriptedOnly is set, any state whose priority vector does not contain Priority_Scripted is skipped entirely - it is frozen, not stopped.

```cpp
            if (mPlayScriptedOnly && !state.mPriority.contains(MWMechanics::Priority_Scripted))
            {
                ++stateiter;
                continue;
            }

            const SceneUtil::TextKeyMap& textkeys = state.mSource->getTextKeys();
            auto textkey = textkeys.upperBound(state.getTime());

            float timepassed = duration * state.mSpeedMult;
            while (state.mPlaying)
            {
                if (!state.shouldLoop())
                {
                    float targetTime = state.getTime() + timepassed;
                    if (textkey == textkeys.end() || textkey->first > targetTime)
                    {
                        if (mAccumCtrl && state.mTime == mAnimationTimePtr[0]->getTimePtr())
                            updatePosition(state.getTime(), targetTime, movement);
                        state.setTime(std::min(targetTime, state.mStopTime));
                    }
                    else
                    {
                        if (mAccumCtrl && state.mTime == mAnimationTimePtr[0]->getTimePtr())
                            updatePosition(state.getTime(), textkey->first, movement);
                        state.setTime(textkey->first);
                    }

                    state.mPlaying = (state.getTime() < state.mStopTime);
                    timepassed = targetTime - state.getTime();

                    while (textkey != textkeys.end() && textkey->first <= state.getTime())
                    {
                        handleTextKey(state, stateiter->first, textkey, textkeys);
                        ++textkey;
                    }
                }
                ...
                if (timepassed <= 0.0f)
                    break;
            }

            if (!state.mPlaying && stat
...(truncated; see the cited lines)
```

**Recorded caveat** (from adversarial verification - the rule above is
sound, this is the condition it must not be read past):

> The rule describes only the non-looping half of the inner loop and states its behaviour as unconditional, while the elided "..." is precisely the branch that reverses it. Correct in the rule (verified): timepassed = duration * mSpeedMult; timepassed = targetTime - getTime() reduces it by distance travelled; text keys at or before the new playhead fire in order via handleTextKey, which forwards to mTextKeyListener (guarded by a null check); the root-motion claim checks out - mAnimationTimePtr is indexed by blend mask, sNumBlendMasks == 4, BlendMask_LowerBody == 1<<0 so index 0, resetActiveGroups() assigns mAnimationTimePtr[blendMask] the mTime of the highest-priority state whose blendMaskContains(blendMask), and mAccumCtrl is only ever set under "if (blendMask == 0 && node == mAccumRoot)", so an upper-body-only state can never satisfy the guard; mAutoDisable -> animationEnded + erase + immediate resetActiveGroups() over all four masks; mPlayScriptedOnly does "++stateiter; continue;" so the state is frozen, not stopped, and AnimPriority::contains is an exact-equality scan over the four bone-group priorities. Refuting problems: 1. Conditional stated as always-true. "state.mPlaying = (state.getTime() < state.mStopTime);" sits inside "if (!state.shouldLoop())". The elided block is a SECOND, non-else "if (state.shouldLoop())" that runs in the same iteration and executes "state.mLoopCount--; state.setTime(state.mLoopStartTime); state.mPlaying = true;". So mPlaying does not become false as soon as time reaches mStopTime - for a looping state it is re-armed to true within the same iteration and the playhead is rewound. 2. The dominant path is missing. shouldLoop() is "getTime() >= mLoopStopTime && mLoopingEnabled && mLoopCount > 0" and mLoopingEnabled defaults to true (animation.hpp:162). Animation::reset() sets mLoopStopTime from the group's "loop stop" key, which is below mStopTime, so ordinary actor animations (idle/walk/run, played with loop counts) turn around at mLoopStopTime and never reach mStopTime until loops are exhausted. 3. Omitted guard / wrong clamp. "clamped to mStopTime" only describes the no-key branch (std::min(targetTime, state.mStopTime)); the text-key branch is a bare state.setTime(textkey->first) with no clamp. And "the loop exits when timepassed <= 0" omits the "while (state.mPlaying)" condition and the load-bearing "if (state.getTime() >= state.mLoopStopTime) break;" inside the loop branch - the only thing preventing an infinite spin on a degenerate loop where mLoopStartTime >= mLoopStopTime, since timepassed never decreases there. 4. "ad ...

**Corrected form offered:** Minor precision note only, not a refutation: the quoted text begins at line 1342 rather than 1341 (line 1341 is `AnimState& state = stateiter->second;`), so the exact span is lines 1342-1408 of apps/openmw/mwrender/animation.cpp on OpenMW master.


## 51. Text keys are lowercased, trimmed and newline-split at load; the loopFallback flag comes from a hardcoded looping-group set
- `apps/openmw/mwrender/animation.cpp:792-825` - Animation playback, importance **n/a**

Two data facts a port must reproduce before any of the key matching above works. (1) NIF text keys are not stored as authored: extractTextKeys splits each NiTextKeyExtraData entry on \r and \n - so ONE key entry at one time can yield SEVERAL keys - trims each fragment, lowercases it in place, drops empties, and emplaces it into a std::multimap<float, std::string> ordered by time (components/sceneutil/textkeymap.hpp:61). Every comparison in animation.cpp is therefore an exact lowercase compare, and duplicate times are legal. (2) Whether an animation is allowed to loop without loop keys is decided by Animation::isLoopingAnimation, which returns true immediately if `"<group>: loop start"` exists, and otherwise strips the LONGEST matching weapon short group suffix (so "crossbow" is preferred over "bow") and tests membership in a hardcoded set of vanilla looping group names: walkforward/back/left/right, the swimwalk and run and swimrun and sneak variants, turnleft/turnright, swimturnleft/right, spellturnleft/right, torch, idle and idle2..idle9, idlesneak, idlestorm, idleswim, jump, inventoryhandtohand, inventoryweapononehand, inventoryweapontwohand, inventoryweapontwowide. This set - not a heuristic - is what makes e.g. "idle1h" loop while an arbitrary group does not.

```cpp
    bool Animation::isLoopingAnimation(std::string_view group) const
    {
        // In Morrowind, a some animation groups are always considered looping, regardless
        // of loop start/stop keys.
        // To be match vanilla behavior we probably only need to check this list, but we don't
        // want to prevent modded animations with custom group names from looping either.
        static const std::unordered_set<std::string_view> loopingAnimations = { "walkforward", "walkback", "walkleft",
            "walkright", "swimwalkforward", "swimwalkback", "swimwalkleft", "swimwalkright", "runforward", "runback",
            "runleft", "runright", "swimrunforward", "swimrunback", "swimrunleft", "swimrunright", "sneakforward",
            "sneakback", "sneakleft", "sneakright", "turnleft", "turnright", "swimturnleft", "swimturnright",
            "spellturnleft", "spellturnright", "torch", "idle", "idle2", "idle3", "idle4", "idle5", "idle6", "idle7",
            "idle8", "idle9", "idlesneak", "idlestorm", "idleswim", "jump", "inventoryhandtohand",
            "inventoryweapononehand", "inventoryweapontwohand", "inventoryweapontwowide" };
        static const std::vector<std::string_view> shortGroups = MWMechanics::getAllWeaponTypeShortGroups();

        if (getTextKeyTime(std::string(group) + ": loop start") >= 0)
            return true;

        // Most looping animations have variants for each weapon type shortgroup.
        // Just remove the shortgroup instead of enumerating all of the possible animation groupnames.
        // Make sure we pick the longest shortgroup so e.g. "bow" doesn't get picked over "crossbow"
        // when the shortgroup is crossbow.
        std::size_t suffixLength = 0;
        for (std::string_view suffix : shortGroups)
        {
      
...(truncated; see the cited lines)
```

**Recorded caveat** (from adversarial verification - the rule above is
sound, this is the condition it must not be read past):

> The two halves of the rule are individually accurate, but the bridging generalisation is false and it is the load-bearing one for a port. "Every comparison in animation.cpp is therefore an exact lowercase compare" is contradicted by the file, which is deliberately prefix-based: (a) getTextKeyTime (animation.cpp:840-853) — the function isLoopingAnimation itself calls at line 807 — matches with `iterKey->second.starts_with(textKey)`, a PREFIX test, and then guards on the returned time being `>= 0` (sentinel `-1.f`), so it is not an existence-of-exact-key check as the rule states; (b) reset() (animation.cpp:979) finds the group with `starts_with(groupname) && compare(groupname.size(), 2, ": ") == 0`; (c) reset() (animation.cpp:995-1001) explicitly TRUNCATES the key to `checkLength` before comparing, with the in-source comment "We have to ignore extra garbage at the end. The Scrib's idle3 animation has 'Idle3: Stop.' instead of 'Idle3: Stop'" — an exact compare makes reset() return false and that animation never plays; (d) animation.cpp:986 contains an omitted fallback, retrying "<group>: start" when "<group>: loop start" is absent; (e) animation.cpp:726, 1293 and 1314 use Misc::StringUtils::ciEqual, i.e. case-INSENSITIVE compares. The rule also omits two details that matter for a port: reset() scans the map in REVERSE (rbegin/rend) on purpose because undeadwolf_2.nif has two walkforward keys and the last must win (this, not merely "duplicate times are legal", is the real consequence of the multimap); and TextKeyMap::emplace additionally populates an mGroups set from the substring before ": " (used by hasGroupStart), which the rule describes as a plain multimap insert. Verified against upstream OpenMW master: apps/openmw/mwrender/animation.cpp, components/nifosg/nifloader.cpp, components/sceneutil/textkeymap.hpp, components/misc/strings/algorithm.hpp, apps/openmw/mwmechanics/weapontype.cpp.

> Fact (1) is confirmed verbatim. extractTextKeys (components/nifosg/nifloader.cpp:213-227) splits each NiTextKeyExtraData entry with Misc::StringUtils::split(key.mText, results, "\r\n"), and split uses find_first_of (components/misc/strings/algorithm.hpp:174-184), i.e. a delimiter CHARACTER SET, so one entry at one time does yield several keys; each is trimmed, lowerCaseInPlace'd, dropped if empty, and emplaced into the std::multimap<float,std::string> of SceneUtil::TextKeyMap (components/sceneutil/textkeymap.hpp:61), so duplicate times are legal. The only nuance is that this is not the sole population path: components/resource/keyframemanager.cpp:172 fills the same map from a sidecar .txt for osgAnimation/Collada animations, and its parseTextKey (keyframemanager.cpp:28-34) neither splits, trims, nor lowercases. That path never applies to vanilla NIF first-person data, so it does not affect a first-person player body. Fact (2) is where the rule breaks. The DESCRIPTION of Animation::isLoopingAnimation is accurate — apps/openmw/mwrender/animation.cpp:792-825 matches word for word: early return when getTextKeyTime(group + ": loop start") >= 0, longest-matching weapon shortGroup suffix stripped (the explicit "crossbow" over "bow" comment), then membership in exactly the hardcoded unordered_set listed. It is non-virtual (animation.hpp:373), so no subclass (ActorAnimation, NpcAnimation, CreatureAnimation, ESM4NpcAnimation, ObjectAnimation) overrides it, and neither is getTextKeyTime (animation.hpp:431). But the CAUSAL claim — "Whether an animation is allowed to loop without loop keys is decided by Animation::isLoopingAnimation" — is false, and false precisely for the first-person player body. That decision is made by the loopfallback argument of Animation::play, consumed in Animation::reset (animation.cpp:1009-1019): loopfallback true sets state.mLoopStopTime to the stop key (so the group loops with no loop keys), false sets it to numeric_limits<float>::max() (so it never loops). isLoopingAnimation is only ONE of several producers of that argument, and it is consulted exclusively on the scripted/queued path: character.cpp:2589 (unpersistAnimationState), character.cpp:2631 (playGroup, the MWScript PlayGroup/LoopGroup entry), character.cpp:2708 (playGroupLua), plus the Lua bindings at mwlua/animationbindings.cpp:154 and :230. The paths that actually animate the player's first-person body bypass it entirely and hardcode loopfallback: - character.cpp:757-758, refreshMovementAnims: playBlendedAnimation(mCurrentMovement, ..., "start", "stop", startpoint, UINT32_MAX,  ...

**Corrected form offered:** Two data facts a port must reproduce before any of the key matching above works. (1) NIF text keys are not stored as authored: extractTextKeys splits each NiTextKeyExtraData entry on ANY '\r' or '\n' character (Misc::StringUtils::split uses find_first_of over the delimiter set) — so ONE key entry at one time can yield SEVERAL keys — trims each fragment, lowercases it in place, drops empties, and emplaces it into SceneUtil::TextKeyMap, which holds a std::multimap<float, std::string> ordered by time AND also records the substring before ": " in an mGroups set used by hasGroupStart. Because every stored key is already lowercased, animation.cpp never needs case folding for text keys — but its comparisons are PREFIX matches, not exact ones: getTextKeyTime uses starts_with (animation.cpp:848), reset() locates a group with starts_with + a ": " separator check (:979), and matches the stop key against only the first groupname.size()+2+stop.size() characters so trailing garbage is tolerated (:1001 — the Scrib's "idle3: stop." would otherwise fail to resolve). reset() also falls back from "<group>: loop start" to "<group>: start" (:986) and scans the map in REVERSE, because undeadwolf_2.nif h


## 52. First person gets its own render bin (12) whose draw callback CLEARS the depth buffer first
- `apps/openmw/mwrender/npcanimation.cpp:319-368, 418-433` - First-person specifics, importance **n/a**

In first person the object root's StateSet is given setRenderBinDetails(RenderBin_FirstPerson, "DepthClear", osg::StateSet::OVERRIDE_RENDERBIN_DETAILS); leaving first person calls setRenderBinToInherit() on that same stateset. RenderBin_FirstPerson = 12 (apps/openmw/mwrender/renderbin.hpp:15), i.e. AFTER RenderBin_Default=0, RenderBin_OpaqueResolve=9, RenderBin_DepthSorted=10 (transparent) and RenderBin_OcclusionQuery=11, and BEFORE RenderBin_SunGlare=13 - so the whole world is drawn first, then the depth buffer is cleared, then the hands are drawn: the hands can never be occluded by, or z-fight with, world geometry no matter how close a wall is. The "DepthClear" bin prototype is registered once, globally, and its DrawCallback does two passes: bind the FBO_FirstPerson framebuffer, glClear(GL_DEPTH_BUFFER_BIT | GL_STENCIL_BUFFER_BIT), draw the bin (colour pass); then rebind the primary FBO / the FBO_OpaqueDepth attachment, swap in a stateset with ColorMask(false,false,false,false) and draw the bin AGAIN (depth-only accumulation pass) so post-processing still sees a complete depth buffer. Depth writes are forced on for the pass via SceneUtil::AutoDepth with setWriteMask(true). setRenderBin() is re-run on every setViewMode (npcanimation.cpp:309).

```cpp
// npcanimation.cpp:319-333
    /// @brief A RenderBin callback to clear the depth buffer before rendering.
    /// Switches depth attachments to a proxy renderbuffer, reattaches original depth then redraws first person root.
    /// This gives a complete depth buffer which can be used for postprocessing, buffer resolves as if depth was never
    /// cleared.
    class DepthClearCallback : public osgUtil::RenderBin::DrawCallback
    {
    public:
        DepthClearCallback()
        {
            mDepth = new SceneUtil::AutoDepth;
            mDepth->setWriteMask(true);

            mStateSet = new osg::StateSet;
            mStateSet->setAttributeAndModes(new osg::ColorMask(false, false, false, false), osg::StateAttribute::ON);
        }

// npcanimation.cpp:344-361
            postProcessor->getFbo(PostProcessor::FBO_FirstPerson, frameId)->apply(*state);
            glClear(GL_DEPTH_BUFFER_BIT | GL_STENCIL_BUFFER_BIT);
            // color accumulation pass
            bin->drawImplementation(renderInfo, previous);

            auto primaryFBO = postProcessor->getPrimaryFbo(frameId);
            primaryFBO->apply(*state);

            postProcessor->getFbo(PostProcessor::FBO_OpaqueDepth, frameId)->apply(*state);

            // depth accumulation pass
            osg::ref_ptr<osg::StateSet> restore = bin->getStateSet();
            bin->setStateSet(mStateSet);
            bin->drawImplementation(renderInfo, previous);
            bin->setStateSet(restore);

// npcanimation.cpp:418-433
    void NpcAnimation::setRenderBin()
    {
        if (mViewMode == VM_FirstPerson)
        {
            [[maybe_unused]] static const bool prototypeAdded = [&] {
                osg::ref_ptr<osgUtil::RenderBin> depthClearBin(new osgUtil::RenderBin);
                depthClearBin->setD
...(truncated; see the cited lines)
```

**Recorded caveat** (from adversarial verification - the rule above is
sound, this is the condition it must not be read past):

> The mechanism description is accurate, but the rule states as unconditional something the code only guarantees conditionally, and it misreads the coverage of setRenderBin(). WHAT CHECKS OUT (verified against fetched master): - renderbin.hpp:9-18 confirms the ordering (Sky=-1, Default=0, OpaqueResolve=9, DepthSorted=10, OcclusionQuery=11, FirstPerson=12, SunGlare=13, and also Distortion=14, which the rule omits but which does not affect the argument). The header comment literally says "The bin with the lowest number is rendered first." - npcanimation.cpp:319-368 matches: static one-time addRenderBinPrototype("DepthClear"), AutoDepth with setWriteMask(true) applied via state->applyAttribute, FBO_FirstPerson + glClear(DEPTH|STENCIL) + colour pass, then primaryFbo->apply / FBO_OpaqueDepth->apply, bin stateset swapped for the ColorMask(false,false,false,false) one, second draw, stateset restored, primary FBO reapplied. There is no null-check on postProcessor and no settings guard. WHERE IT OVERREACHES: 1. "setRenderBin() is re-run on every setViewMode" — grep for setRenderBin over the whole file yields exactly two hits: the definition at :418 and the single call site at :309. It is NOT called from the constructor (:267-293, which calls only updateNpcBase()), and setViewMode itself early-returns before reaching :309: if (mViewMode == viewMode) return; // npcanimation.cpp:298-299 So setRenderBin() runs only on an actual view-mode *transition*, never on a same-mode re-entry. 2. That matters because rebuild() destroys and recreates the node the bin was set on. rebuild() -> updateNpcBase() -> setObjectRoot(smodel, true, true, false) (:525) installs a brand-new mObjectRoot with a fresh (empty) StateSet. Two reachable paths call rebuild() *without* any following setRenderBin(): - npcanimation.cpp:579-584 — updateParts(): `if (curType != mNpcType) { mNpcType = curType; rebuild(); return; }` - renderingmanager.cpp:1167-1183 — rebuildPtr(): `anim->rebuild(); ... mCamera->attachTo(ptr); mCamera->setAnimation(anim);` setAnimation only sets mProcessViewChange = true (camera.cpp:341-344); the deferred processViewChange() (camera.cpp:346-368) then calls mAnimation->setViewMode(VM_FirstPerson) — which hits the `mViewMode == viewMode` early return, so setRenderBin() is never reached. This is a live path: NpcAnimation::setVampire (:1139-1150) calls World::reattachPlayerCamera() for the player, and worldimp.cpp:2761-2763 is `mRendering->rebuildPtr(getPlayerPtr())`. So after such a rebuild while already in first person, the new object root carries no "DepthClear" bin details, th ...

**Corrected form offered:** No correction needed to the substance. Optional precision on the line ranges: the drawImplementation excerpt is npcanimation.cpp:346-360 (not 344-361), setRenderBin's quoted body is 418-432 with the closing brace at 433, and the RenderBins enumerators are renderbin.hpp:10-16 (not 9-17). All quoted code is verbatim correct.


## 53. Mask_FirstPerson (1<<9) REPLACES the root's mask, and excludes the hands from every secondary pass by omission
- `apps/openmw/mwrender/vismask.hpp:23-60` - First-person specifics, importance **n/a**

Mask_FirstPerson = (1 << 9). It is set exactly once in the whole engine - setNodeMask(Mask_FirstPerson) on the first-person NpcAnimation's object root (npcanimation.cpp:544) - and read nowhere by name; grep over apps+components at master finds only the enum and that one assignment. Exclusion is therefore by OMISSION from allow-lists, since OSG traverses only when (nodeMask & traversalMask) != 0 and setNodeMask REPLACES the root's previous mask (so the FP subtree carries bit 9 and nothing else): the MAIN camera's cull mask is ~(Mask_UpdateVisitor | Mask_SimpleWater) (renderingmanager.cpp:398-399), which contains bit 9, so the hands render in the main view; but every secondary pass builds an explicit allow-list that never contains it - water reflection/refraction Mask_Scene|Mask_Sky|Mask_Lighting plus a detail-driven extraMask of Terrain/Static/Effect/ParticleSystem/Object/Player/Actor/Groundcover (mwrender/water.cpp:302-319), the local map Mask_Scene|Mask_SimpleWater|Mask_Terrain|Mask_Object|Mask_Static (localmap.cpp:721-723), precipitation occlusion Mask_Scene|Mask_Object|Mask_Static (precipitationocclusion.cpp:113), the sky RTT Mask_Sky (sky.cpp:224), and the shadow-casting masks Mask_Scene (+Actor/Player/Object/Static/Terrain per setting) (renderingmanager.cpp:134-152). So: the first-person body casts NO shadow, appears in NO water reflection or refraction, and on NO map, at any detail setting. Note it is NOT removed from the intersection/ray-cast mask, which is ~0u minus RenderToTexture|Sky|Debug|Effect|Water|SimpleWater|Groundcover (renderingmanager.cpp:1040-1048) - the FP subtree is gated there only by its parent "Player Root" node's Mask_Player, which is cleared when ignorePlayer is set.

```cpp
// apps/openmw/mwrender/vismask.hpp:28-40
        Mask_Effect = (1 << 1),
        Mask_Debug = (1 << 2),
        Mask_Actor = (1 << 3),
        Mask_Player = (1 << 4),
        Mask_Sky = (1 << 5),
        Mask_Water = (1 << 6), // choose Water or SimpleWater depending on detail required
        Mask_SimpleWater = (1 << 7),
        Mask_Terrain = (1 << 8),
        Mask_FirstPerson = (1 << 9),
        Mask_Object = (1 << 10),
        Mask_Static = (1 << 11),

// apps/openmw/mwrender/renderingmanager.cpp:398-399
        auto mask = ~(Mask_UpdateVisitor | Mask_SimpleWater);
        MWBase::Environment::get().getWindowManager()->setCullMask(mask);

// apps/openmw/mwrender/water.cpp:303-318 (reflection/refraction cull mask)
        unsigned int calcNodeMask()
        {
            int reflectionDetail = Settings::water().mReflectionDetail;
            reflectionDetail = std::clamp(reflectionDetail, mInterior ? 2 : 0, 5);
            unsigned int extraMask = 0;
            if (reflectionDetail >= 1)
                extraMask |= Mask_Terrain;
            if (reflectionDetail >= 2)
                extraMask |= Mask_Static;
            if (reflectionDetail >= 3)
                extraMask |= Mask_Effect | Mask_ParticleSystem | Mask_Object;
            if (reflectionDetail >= 4)
                extraMask |= Mask_Player | Mask_Actor;
            if (reflectionDetail >= 5)
                extraMask |= Mask_Groundcover;
            return Mask_Scene | Mask_Sky | Mask_Lighting | extraMask;
        }

// apps/openmw/mwrender/localmap.cpp:721
        camera->setCullMask(Mask_Scene | Mask_SimpleWater | Mask_Terrain | Mask_Object | Mask_Static);
```

**Recorded caveat** (from adversarial verification - the rule above is
sound, this is the condition it must not be read past):

> Nearly all of the rule verifies against master (a042cd3), but it overreaches on one limb: it cites apps/openmw/mwrender/water.cpp:303-320 as the "reflection/refraction cull mask" and folds refraction into the by-omission-from-allow-lists mechanism. That calcNodeMask() is a private member of `class Reflection : public SceneUtil::RTTNode` (water.cpp:238) and feeds only camera->setCullMask(mNodeMask) at water.cpp:273. There is no refraction RTT camera and no refraction cull mask anywhere in the engine — the only occurrence of "refraction" in water.cpp is the shader define at line 594. Refraction is screen-space: files/shaders/compatibility/water.frag:205 does `refraction = sampleOpaqueColorTex(refractionCoords).rgb`, sampling the opaque color texture resolved at RenderBin_OpaqueResolve = 9 (postprocessor.cpp:165), while the first-person body draws at RenderBin_FirstPerson = 12 (renderbin.hpp:15, set in NpcAnimation::setRenderBin, npcanimation.cpp:428-429) — after the opaque resolve and after the transparent bin where water draws. So the conclusion "not in refraction" is incidentally true, but by render-bin ordering and the opaque-resolve capture point, not by an allow-list omitting bit 9. This is operationally misleading: the rule implies adding Mask_FirstPerson to water.cpp:303-320 would put the hands into both reflection and refraction; it would only affect reflection, because refraction has no mask to add it to. Everything else checks out: vismask.hpp:35 defines the bit; grep over apps+components yields only the enum and npcanimation.cpp:544 (guarded by `if (is1stPerson)`); renderingmanager.cpp:398-399 routes through WindowManager::setCullMask to mViewer->getCamera()->setCullMask (windowmanagerimp.cpp:1462-1469) and ~(0x1|0x80) does contain bit 9; the local map (localmap.cpp:721-723), precipitation occlusion (precipitationocclusion.cpp:113), sky RTT (sky.cpp:224) and shadow-casting masks (renderingmanager.cpp:135-153, wired at 246-247) all omit bit 9; and the intersection mask (renderingmanager.cpp:1040-1048) does retain it, with the player's NpcAnimation parented to the Mask_Player "Player Root" (renderingmanager.cpp:1144-1153, 1161).

**Corrected form offered:** Citations hold; only two line ranges need tightening. vismask.hpp: the Mask_Effect–Mask_Static block is at lines 27-37, not 28-40. water.cpp: calcNodeMask() spans lines 305-321, not 303-318. renderingmanager.cpp:398-399 and localmap.cpp:721 are exactly right as cited.


## 54. In first person the CAMERA is a node of the rig: it tracks "Camera" (fallback "Head"), with no height offset
- `apps/openmw/mwrender/camera.cpp:87-99, 346-368` - First-person specifics, importance **n/a**

Camera::processViewChange, on entering first person, calls mAnimation->setViewMode(VM_FirstPerson) and then sets mTrackingNode = mAnimation->getNode("Camera"), falling back to getNode("Head") if there is no Camera node, and forces mHeightScale = 1.f. (getNode goes through the case-insensitive NodeMap.) In third person the tracking node is instead the Ptr's base transform and mHeightScale is that transform's Z scale. calculateTrackedPosition takes the world translation of the tracking node and adds mHeight * mHeightScale ONLY when the mode is not FirstPerson - so the first-person eye position is literally wherever the skeleton's Camera bone ended up this frame, animation and neck rotation included, with no camera-height constant. Because the animation is evaluated during cull, updateCamera RE-computes the position at cull time rather than reusing mPosition, explicitly to avoid a one-frame lag ("It is a hack. Camera position depends on neck animation."). Switching to or from first person is deferred while mAnimation->upperBodyReady() is false (setMode queues it) because the view change stops all playing animations, and it triggers instantTransition() + mProcessViewChange (camera.cpp:225-244).

```cpp
// camera.cpp:87-99
    osg::Vec3d Camera::calculateTrackedPosition() const
    {
        if (!mTrackingNode)
            return osg::Vec3d();
        osg::NodePathList nodepaths = mTrackingNode->getParentalNodePaths();
        if (nodepaths.empty())
            return osg::Vec3d();
        osg::Matrix worldMat = osg::computeLocalToWorld(nodepaths[0]);
        osg::Vec3d res = worldMat.getTrans();
        if (mMode != Mode::FirstPerson)
            res.z() += mHeight * mHeightScale;
        return res;
    }

// camera.cpp:346-360
    void Camera::processViewChange()
    {
        if (mTrackingPtr.isEmpty())
            return;
        if (mMode == Mode::FirstPerson)
        {
            mAnimation->setViewMode(NpcAnimation::VM_FirstPerson);
            mTrackingNode = mAnimation->getNode("Camera");
            if (!mTrackingNode)
                mTrackingNode = mAnimation->getNode("Head");
            mHeightScale = 1.f;
        }

// camera.cpp:117-126 (updateCamera)
        if (mMode == Mode::FirstPerson)
        {
            // It is a hack. Camera position depends on neck animation.
            // Animations are updated in OSG cull traversal and in order to avoid 1 frame delay we
            // recalculate the position here. Note that it becomes different from mPosition that
            // is used in other parts of the code.
            // TODO: detach camera from OSG animation and get rid of this hack.
            osg::Vec3d recalculatedTrackedPosition = calculateTrackedPosition();
            pos = calculateFirstPersonPosition(recalculatedTrackedPosition);
        }
```

**Recorded caveat** (from adversarial verification - the rule above is
sound, this is the condition it must not be read past):

> Most of the rule checks out against upstream OpenMW apps/openmw/mwrender/camera.cpp: processViewChange's first-person branch (setViewMode(VM_FirstPerson), getNode("Camera") with a "Head" fallback, mHeightScale = 1.f) is verbatim; NodeMap really is case-insensitive (animation.hpp:125-127 uses Misc::StringUtils::CiHash/CiEqual); third person really does track the Ptr's base transform; and calculateTrackedPosition really does add mHeight * mHeightScale only when mMode != FirstPerson. But two claims overreach. (1) The deferral is stated as always-true and is in fact conditional on a flag that DEFAULTS THE OTHER WAY. setMode is `void setMode(Mode mode, bool force = true)` (camera.hpp:103), and the queuing branch is `if (!force && (newMode == FirstPerson || oldMode == FirstPerson) && mAnimation && !mAnimation->upperBodyReady())`. So a plain setMode(...) does NOT defer — it switches immediately regardless of upperBodyReady(); Camera::reset() (`setMode(Mode::FirstPerson)`) and the re-dispatch of the queued mode at camera.cpp:136 (`setMode(*mQueuedMode)`) both rely on that default to avoid re-queuing. Only explicit force==false callers defer: toggleViewMode(force), toggleVanityMode (passes false), and the Lua binding (camerabindings.cpp:37-38, which defaults force to false). The rule omits both the !force guard and the mAnimation null guard. It also omits the `if (mMode == newMode) { mQueuedMode = nullopt; return; }` early return. (2) "the first-person eye position is literally wherever the skeleton's Camera bone ended up this frame ... with no camera-height constant" treats calculateFirstPersonPosition as identity. The "no camera-height constant" half is correct (mHeight * mHeightScale is genuinely skipped), but both updatePosition (line 167) and updateCamera (line 125) route the tracked position through calculateFirstPersonPosition, which ADDS Camera::mFirstPersonOffset — x/y rotated by mYaw via Misc::rotateVec2f, z added directly (camera.cpp:149-157). It defaults to {0,0,0} but is publicly settable (camera.hpp:107) and exposed to Lua as camera.setFirstPersonOffset, so the eye position equals the bone position only when that offset happens to be zero. The rule's own excerpt shows the call yet the prose asserts identity. Secondary imprecision: "updateCamera RE-computes the position at cull time" — the callback is registered with mCamera->addUpdateCallback(mUpdateCallback) (camera.cpp:78), i.e. it is an update-traversal callback that traverses children first, not a cull callback. The source comment says animations are updated in cull; it does not say updateCamera ...

**Corrected form offered:** Camera::processViewChange, on entering first person, calls mAnimation->setViewMode(VM_FirstPerson), sets mTrackingNode = mAnimation->getNode("Camera") falling back to getNode("Head"), and forces mHeightScale = 1.f (getNode goes through the case-insensitive NodeMap — CiHash/CiEqual). In third person the tracking node is the Ptr's base transform, with mHeightScale = transform->getScale().z(), or 1.f if that transform is null. calculateTrackedPosition takes the world translation of the tracking node and adds mHeight * mHeightScale only when the mode is not FirstPerson, so no camera-height constant is applied in first person. The first-person eye position is not the bone position itself, though: both updatePosition and updateCamera pass the tracked position through calculateFirstPersonPosition, which adds Camera::mFirstPersonOffset (x/y rotated by mYaw, z added directly; default {0,0,0}, settable from Lua via camera.setFirstPersonOffset), so the eye equals the Camera bone only while that offset is zero. Because animations are evaluated during cull, updateCamera recomputes the tracked position rather than reusing mPosition, explicitly to avoid a one-frame lag ("It is a hack. Camera posi


## 55. NiTransform is TRS with the scale folded into the 3x3, and a chain composes self-first
- `components/nif/niftypes.hpp:68-93` - NIF nodes and transforms, importance **n/a**

Every NiAVObject carries one NiTransform. STREAM ORDER IS translation, then the 3x3 rotation, then the float scale (node.cpp:144-146) - NOT the struct's declaration order. Matrix3 is 9 floats blitted straight into mValues[3][3] in file order (nifstream.cpp:122-126), i.e. mValues[row][col], row-major as NIF stores it. The local transform is p_parent = (mRotation * mScale) * p_local + mTranslation: the float mScale multiplies the ENTIRE 3x3, the 3x3 may itself already contain non-uniform or negative scale (see the comment on the mRotation field), and the translation is NEVER scaled. Composition to world is self first then every ancestor in order, which in OSG's row-vector convention is `transform *= parent...` walking up the Parent chain (bulletnifloader.cpp:283-285). In a column-vector engine (three.js/gl-matrix) this is local = T(mTranslation) * (mRotation * mScale) and world = parentWorld * local - i.e. ordinary hierarchical composition, no surprises, but the scale must go into the rotation block, not a separate uniform scale node. A NiTriShape's own transform applies exactly like any other node's: the loader builds a node for the geometry record too and adds the drawable under it (nifloader.cpp:1757-1758). One optimisation to be aware of when you look for a node by name later: createNode emits a plain osg::Group with NO transform when a node has no parents AND no controller AND an identity transform (nifloader.cpp:696-699).

```cpp
components/nif/niftypes.hpp:68-93
    struct NiTransform
    {
        Matrix3 mRotation; // this can contain scale components too, including negative and nonuniform scales
        osg::Vec3f mTranslation;
        float mScale;

        osg::Matrixf toMatrix() const
        {
            osg::Matrixf transform;
            transform.setTrans(mTranslation);

            for (int i = 0; i < 3; ++i)
                for (int j = 0; j < 3; ++j)
                    transform(j, i) = mRotation.mValues[i][j] * mScale; // NB column/row major difference

            return transform;
        }

        bool isIdentity() const { return mRotation.isIdentity() && mTranslation == osg::Vec3f() && mScale == 1.f; }

        static const NiTransform& getIdentity()
        {
            static const NiTransform identity = { Matrix3(), osg::Vec3f(), 1.0f };
            return identity;
        }
    };

components/nif/node.cpp:144-146 (stream order)
        nif->read(mTransform.mTranslation);
        nif->read(mTransform.mRotation);
        nif->read(mTransform.mScale);

components/nifbullet/bulletnifloader.cpp:283-285 (composition, self-first)
        osg::Matrixf transform = niGeometry.mTransform.toMatrix();
        for (const Nif::Parent* parent = nodeParent; parent != nullptr; parent = parent->mParent)
            transform *= parent->mNiNode.mTransform.toMatrix();
```

**Recorded caveat** (from adversarial verification - the rule above is
sound, this is the condition it must not be read past):

> Most of the rule verifies exactly against upstream OpenMW, but one clause is stated as unconditional when the code makes it conditional. CONFIRMED, line-for-line: - node.cpp:144-146 in NiAVObject::read is indeed nif->read(mTransform.mTranslation); mRotation; mScale — translation first, not declaration order. This is a genuine catch, and correctly scoped: the generic NIFStream::read<NiTransform> (nifstream.cpp:145-151) reads rotation FIRST (declaration order), used by records such as NiSkinData where the file layout really is rotation-first. The rule attributing the translation-first order specifically to node.cpp/NiAVObject is right. - nifstream.cpp:122-126 is readBufferOfType<9>(mStream, reinterpret_cast<float*>(&mat.mValues)) — a straight 9-float blit, as claimed. - toMatrix() writes transform(j,i) = mRotation.mValues[i][j] * mScale for all i,j in 0..2, so mScale does multiply the entire 3x3, and the loop never touches row 3, so setTrans(mTranslation) survives unscaled. The stated p_parent = (mRotation*mScale)*p_local + mTranslation is algebraically correct for OSG's row-vector convention, and the column-vector transcription (local = T * (R*S), world = parentWorld * local) follows correctly. - The mRotation comment about negative/nonuniform scale is present verbatim. - bulletnifloader.cpp:283-285 is self-first then `transform *= parent->mNiNode.mTransform.toMatrix()` up the mParent chain, exactly as described. - nifloader.cpp:696 is exactly `if (nifNode->mParents.empty() && nifNode->mController.empty() && nifNode->mTransform.isIdentity()) node = new osg::Group;` — the guard is reproduced accurately, including the three-way AND. REFUTED — "A NiTriShape's own transform applies exactly like any other node's" is true only for UNSKINNED geometry: handleNiGeometry (nifloader.cpp:1694) branches on `if (!niGeometry->mSkin.empty())`, replacing the plain osg::Geometry with a SceneUtil::RigGeometry that gets rig->setTransform(data->mTransform.toMatrix()) — the NiSkinData transform — plus per-bone mInvBindMatrix values. At render time RigGeometry::updateSkinToSkelMatrix (riggeometry.cpp:289-323) walks the node path from the skeleton root down to the trishape and calls trans->computeWorldToLocalMatrix() on every osg::Transform it finds, accumulating the INVERSE of that whole chain into mSkinToSkelMatrix. The source comment is explicit: "Failed to find skin root, cancel out everything up till the trishape. Our parent node is the trishape's transform." The vertex update (riggeometry.cpp:183-187) then uses transform = (*mSkinToSkelMatrix) * mData->mTransform over bone ...

> The decode half of the rule is verified exactly (node.cpp:144-146 stream order; nifstream.cpp:122-126 row-major Matrix3; niftypes.hpp:74-84 scale-times-whole-3x3 with unscaled translation; skeleton.cpp:168-171 composition order; nifloader.cpp:696-699 Group shortcut; nifloader.cpp:869-872 + 1757-1758 geometry gets its own node). What is refuted is the closing claim -- "world = parentWorld * local ... ordinary hierarchical composition, no surprises" and "a NiTriShape's own transform applies exactly like any other node's" -- for exactly the case the rule was asked to hold for. (1) THE LEFT ARM IS MIRRORED BY A TRANSFORM THAT IS IN NO NIF. Morrowind stores ONE body-part record per limb and maps it to both sides: sBodyPartMap in apps/openmw/mwrender/npcanimation.cpp:1189-1191 binds MP_Hand -> {PRT_RHand, PRT_LHand}, MP_Wrist -> {R,L}, MP_Forearm -> {R,L}, MP_Upperarm -> {R,L}. sPartList (npcanimation.cpp:249-252) attaches those to bones literally named "Left Hand"/"Left Wrist"/"Left Forearm"/"Left Upper Arm". components/sceneutil/attach.cpp:166-178 then does `if (attachNode->getName().find("Left") != std::string::npos)` -> inserts an extra osg::PositionAttitudeTransform with setScale(-1,1,1) plus a FrontFace CLOCKWISE StateSet to undo the winding flip. Those four parts ARE the first-person player body (getBodyParts(..., firstPerson=true) at npcanimation.cpp:681, ".1st" at 879). So for half the geometry a first-person player ever sees, world = parentWorld * MIRROR * local, and the mirror exists nowhere in the file. (2) TWO MORE ENGINE-INJECTED TRANSFORMS ON THE SAME PATH. attach.cpp:147-163: a node named "BoneOffset" has ONLY its translation honoured -- rotation and scale discarded -- lifted onto a PAT above the model, and the node is then deleted from the graph. actoranimation.cpp:97-102: a held light (the torch in the player's left hand) gets an extra -90 deg X rotation passed as `attitude`. (3) SKINNED GEOMETRY DOES NOT COMPOSE HIERARCHICALLY AT ALL. components/sceneutil/riggeometry.cpp:289-324 (updateSkinToSkelMatrix) walks the node path from the SceneUtil::Skeleton down to the skin root and calls computeWorldToLocalMatrix on every transform, i.e. it INVERTS THEM OUT -- the comment says "Failed to find skin root, cancel out everything up till the trishape. Our parent node is the trishape's transform". Vertices come from invBindMatrix * bone->mMatrixInSkeletonSpace (riggeometry.cpp:170-186) times NiSkinData::mTransform (nifloader.cpp:1715), not from the node chain. attach.cpp:35-56 (CopyRigVisitor) additionally discards the source file's node hierarchy abov ...

**Corrected form offered:** Every NiAVObject carries one NiTransform. STREAM ORDER for NiAVObject IS translation, then the 3x3 rotation, then the float scale (node.cpp:144-146) — NOT the struct's declaration order. (Beware: the generic NIFStream::read<NiTransform> at nifstream.cpp:145-151 reads rotation FIRST, and that is the one used by NiSkinData and friends, where the file layout genuinely is rotation-first.) Matrix3 is 9 floats blitted straight into mValues[3][3] in file order (nifstream.cpp:122-126), i.e. mValues[row][col]. The local transform is p_parent = (mRotation * mScale) * p_local + mTranslation: the float mScale multiplies the ENTIRE 3x3, the 3x3 may itself already contain non-uniform or negative scale, and the translation is NEVER scaled by mScale. Composition to world is self first then every ancestor in order, which in OSG's row-vector convention is `transform *= parent...` walking up the Parent chain (bulletnifloader.cpp:283-285). In a column-vector engine (three.js/gl-matrix) this is local = T(mTranslation) * (mRotation * mScale) and world = parentWorld * local, with the scale folded into the rotation block rather than a separate uniform scale node. Three exceptions where a node's own mTrans


## 56. The accum root is chosen from a two-name table AND must be driven by the KF
- `apps/openmw/mwrender/animation.cpp:712-734` - NIF nodes and transforms, importance **n/a**

Root motion comes from ONE node, picked by Animation::addAnimSource. The candidate names are exactly {"bip01", "root bone"}, tried in that order ("Priority matters! bip01 is preferred"). A candidate is accepted only if BOTH (a) the name resolves in the node map and (b) the loaded KF's controller map contains a keyframe controller under that same name (case-insensitive). Once chosen, mAccumRoot is sticky for the life of the Animation - later anim sources do not re-pick it. Two further facts: mAccumulate defaults to (1, 1, 0) (animation.cpp:548), so X and Y accumulate into world position and Z does NOT; and a ResetAccumRootCallback is installed on the accum root that, every frame, ZEROES exactly the accumulating components of that node's local translation (animation.cpp:515-539, wired at :1177-1189), so the mesh stays at the origin while the actor moves. The controller is only bound as mAccumCtrl when its blendMask == 0. REFINES RULE 16: the map used here is not the Skeleton bone cache - it is SceneUtil::NodeMap, an unordered_map with Misc::StringUtils::CiHash/CiEqual (visitor.hpp:53-55) populated by NodeMapVisitor with `mMap.emplace(trans.getName(), &trans)` over osg::MatrixTransform nodes ONLY (visitor.cpp:60-65). Same case-insensitive, first-in-depth-first-order-wins semantics as rule 16 - but a node the loader emitted as a plain osg::Group (see the transform rule) is absent from this map entirely and can never be the accum root.

```cpp
        // Determine the movement accumulation bone if necessary
        if (!mAccumRoot)
        {
            // Priority matters! bip01 is preferred.
            static const std::initializer_list<std::string_view> accumRootNames = { "bip01", "root bone" };
            NodeMap::const_iterator found = nodeMap.end();
            for (const std::string_view& name : accumRootNames)
            {
                found = nodeMap.find(name);
                if (found == nodeMap.end())
                    continue;
                for (SceneUtil::KeyframeHolder::KeyframeControllerMap::const_iterator it = controllerMap.begin();
                     it != controllerMap.end(); ++it)
                {
                    if (Misc::StringUtils::ciEqual(it->first, name))
                    {
                        mAccumRoot = found->second;
                        break;
                    }
                }
                if (mAccumRoot)
                    break;
            }
        }
```

**Recorded caveat** (from adversarial verification - the rule above is
sound, this is the condition it must not be read past):

> Most of the rule checks out against /home/user/openmw/openmw/apps/openmw/mwrender/animation.cpp — the candidate list {"bip01","root bone"} and its order, the two-part acceptance test (node-map hit AND a ciEqual-matching entry in the KF controller map), the `if (!mAccumRoot)` guard, mAccumulate(1,1,0) at :548, `blendMask == 0 && node == mAccumRoot` gating mAccumCtrl at :1177, and ResetAccumRootCallback's inverted mask (setAccumulate sets mResetAxes[i] = accumulate[i] != 0 ? 0 : 1, then componentMultiply), which does zero exactly the accumulating components. But two statements are asserted unconditionally when the code makes them conditional, and one of them is the "REFINES RULE 16" claim the rule is built around. (1) The node map is NOT always a NodeMapVisitor map. Animation::getNodeMap() (:1048-1065) branches: `if (mRequiresBoneMap) SceneUtil::NodeMapVisitorBoneOnly visitor(mNodeMap); else SceneUtil::NodeMapVisitor visitor(mNodeMap);`. mRequiresBoneMap is set at :1640 as `mSkeleton != nullptr && !Misc::StringUtils::ciEndsWith(model, ".nif")` — i.e. osgAnimation-backed skeletons (collada/gltf). NodeMapVisitorBoneOnly::apply (visitor.cpp:51-58) emplaces only `if (dynamic_cast<osgAnimation::Bone*>(&trans) != nullptr)`. So for those models the map holds Bones only, and a plain osg::MatrixTransform named "bip01" is just as absent as an osg::Group and equally cannot be the accum root. The rule's "populated by NodeMapVisitor ... over osg::MatrixTransform nodes ONLY" describes only the .nif / no-skeleton branch. (The container type, CiHash/CiEqual, and emplace-first-wins semantics are right for both branches.) (2) "mAccumRoot is sticky for the life of the Animation" is too strong. Animation::setObjectRoot (:1546) clears it: mNodeMap.clear(); mNodeMapCreated = false; mActiveControllers.clear(); mAccumRoot = nullptr; mAccumCtrl = nullptr (:1561-1565). setObjectRoot is called repeatedly on the same Animation object — npcanimation.cpp:525 (updateNpcBase, on race/sex/vampirism/werewolf rebuild), creatureanimation.cpp:28/48, animation.cpp:2084. Stickiness is scoped to the current object root, not the Animation's lifetime; the accurate part is that later anim sources on the same object root do not re-pick it. Minor: the block lives in Animation::addSingleAnimSource, not addAnimSource (addAnimSource is the caller, and loadAdditionalAnimations calls addSingleAnimSource directly too).

> The selection mechanism is verbatim correct, but the stickiness claim is false exactly where the question aims it — the first-person player body. WHAT HOLDS (all at /home/user/openmw/openmw/apps/openmw/mwrender/animation.cpp): - The pick at 713-735: candidates are exactly {"bip01", "root bone"} in that order with the "Priority matters! bip01 is preferred" comment; a candidate needs both a nodeMap hit and a ci-equal key in the loaded KF's controllerMap. - mAccumulate(1.f, 1.f, 0.f) at :548; ResetAccumRootCallback at :515-539 (setAccumulate inverts, so accumulating axes are the ones zeroed); wired at :1177-1189 under `if (blendMask == 0 && node == mAccumRoot)`. - mAccumRoot is set at exactly one place (:728) and nowhere else in the tree; no subclass overrides it (grep for mAccumRoot/mAccumCtrl/setAccumulation across apps/ and components/ returns only animation.cpp, animation.hpp, and two setAccumulation calls in character.cpp). - The "later anim sources do not re-pick it" half is right: the `if (!mAccumRoot)` guard at :713 holds across addSingleAnimSource calls, including the ones from loadAdditionalAnimations (:623-643). WHAT REFUTES IT — "sticky for the life of the Animation": Animation::setObjectRoot (:1546) nulls it at :1564-1565 (`mAccumRoot = nullptr; mAccumCtrl = nullptr;`) and also does `mNodeMap.clear(); mNodeMapCreated = false;` at :1561-1562. The accum root is sticky for the life of the *object root*, not the Animation. The very case asked about drives this: Camera::processViewChange (camera.cpp:352 / :360) -> NpcAnimation::setViewMode (npcanimation.cpp:295-308) -> rebuild() (:435-441) -> updateNpcBase() (:459) -> setObjectRoot(smodel, true, true, false) at :525 -> mAccumRoot nulled -> addAnimSource(base=xbase_anim.1st, ...) at :530-540 re-picks it against the *first-person* skeleton's freshly rebuilt node map. Same NpcAnimation instance, new accum root. Every first<->third person toggle re-runs this. Same teardown fires for the other two cases named in the question: - Werewolf/vampire: NpcAnimation::updateParts (:578-583) sees NpcType change -> rebuild(). For the player, MechanicsManager::setWerewolf (mechanicsmanagerimp.cpp:1910) and NpcAnimation::setVampire (:1146) route through World::reattachPlayerCamera -> RenderingManager::rebuildPtr (renderingmanager.cpp:1168-1177), which calls anim->rebuild() on the *existing* mPlayerAnimation — the object is not destroyed, so this is a genuine mid-life re-pick. - Werewolf also changes which KFs are loaded: `base` stays empty for werewolves (npcanimation.cpp:504-511), so only the wolfskin defaultSkeleto ...

**Corrected form offered:** Root motion comes from ONE node, picked in Animation::addSingleAnimSource (the worker behind addAnimSource; loadAdditionalAnimations also calls it directly). The candidate names are exactly {"bip01", "root bone"}, tried in that order ("Priority matters! bip01 is preferred"). A candidate is accepted only if BOTH (a) the name resolves in the node map and (b) the loaded KF's controller map contains a keyframe controller under that same name (Misc::StringUtils::ciEqual). The `if (!mAccumRoot)` guard makes the choice sticky for the life of the current object root — later anim sources do not re-pick it — but Animation::setObjectRoot clears mNodeMap, mAccumRoot and mAccumCtrl (animation.cpp:1561-1565), and it is called again on every rebuild (npcanimation.cpp:525 updateNpcBase for race/sex/vampirism/werewolf, creatureanimation.cpp:28/48, animation.cpp:2084), so the pick restarts from scratch there. Two further facts: mAccumulate defaults to (1, 1, 0) (animation.cpp:548), so X and Y accumulate into world position and Z does NOT; and a ResetAccumRootCallback is installed on the accum root that, every frame, ZEROES exactly the accumulating components of that node's local translation (animati


## 57. The hidden flag (0x0001) hides but never deletes - and a NiVisController overrides it
- `components/nifosg/nifloader.cpp:815-832` - NIF nodes and transforms, importance **n/a**

NiAVObject::Flag_Hidden is bit 0x0001 of mFlags (node.hpp:74-79, isHidden() at :95). When set, the loader ALWAYS still creates the node and its whole child hierarchy ("still create the child node hierarchy for animating collision shapes"), sets the node's cull mask to Loader::getHiddenNodeMask() (documented default 0, nifloader.hpp:45-48), and sets mSkipMeshes for the SUBTREE so no drawables are built under it - but mSkipMeshes is suppressed if this node's own controller chain contains a NiVisController, in which case the meshes ARE built and the controller flips visibility at runtime. Note the scan for the NiVisController does NOT check ctrl->isActive(), unlike every other controller loop in the file - so an inactive NiVisController still keeps the meshes alive while never making them visible. The runtime behaviour is a binary node mask swap: `node->setNodeMask(vis ? ~0 : mMask)` where mMask is the same hidden mask (controller.cpp:379-387); the value is sampled with upper_bound then step-back, i.e. a step function holding the previous key's boolean, defaulting to visible when there are no keys (controller.cpp:364-377). So: hidden means "do not draw, but keep the node, keep its transform, keep animating it" - never "prune the branch".

```cpp
            // We can skip creating meshes for hidden nodes if they don't have a VisController that
            // might make them visible later
            if (nifNode->isHidden())
            {
                bool hasVisController = false;
                for (Nif::NiTimeControllerPtr ctrl = nifNode->mController; !ctrl.empty(); ctrl = ctrl->mNext)
                {
                    hasVisController |= (ctrl->mRecordType == Nif::RC_NiVisController);
                    if (hasVisController)
                        break;
                }

                if (!hasVisController)
                    args.mSkipMeshes = true; // skip child meshes, but still create the child node hierarchy for
                                             // animating collision shapes

                node->setNodeMask(Loader::getHiddenNodeMask());
            }
```

**Recorded caveat** (from adversarial verification - the rule above is
sound, this is the condition it must not be read past):

> The rule gets the overall mechanism and the isActive() observation right, but it states as unconditional something the code makes conditional. "mSkipMeshes is suppressed if this node's own controller chain contains a NiVisController, in which case the meshes ARE built" is wrong: the code never clears mSkipMeshes, it only declines to set it (nifloader.cpp:827-828 is a bare `if (!hasVisController) args.mSkipMeshes = true;` with no else). HandleNodeArgs is passed BY VALUE into handleNode (nifloader.cpp:708) and forwarded to every child at line 939, so mSkipMeshes is inherited and sticky-true. If any ancestor already set it - a hidden ancestor with no VisController, or the RootCollisionNode branch at nifloader.cpp:809-812 which sets it unconditionally - then a hidden descendant WITH a NiVisController still builds no drawables (the gate at line 852 is `isGeometry && !args.mSkipMeshes`), while handleNodeControllers still attaches the VisController, which at runtime flips the node mask to ~0 over an empty subtree. Two smaller overreaches: (a) the rule describes VisController::calculate as "sampled with upper_bound then step-back... defaulting to visible when there are no keys", but that is only the mData branch - calculate() first does `if (!mInterpolator.empty()) return mInterpolator.interpKey(time);` (controller.cpp:366-367), so with a NiBoolInterpolator neither the upper_bound walk nor the empty-keys default is ever reached; (b) the hidden mask is not always the node's final mask - nifloader.cpp:833-838, immediately after the hidden block, overwrites it with getIntersectionDisabledNodeMask() (default ~0u, i.e. visible) for a hidden NiCollisionSwitch whose collision is inactive. Verified correct: Flag_Hidden = 0x0001 and isHidden() (node.hpp:77, :98 in master - the rule's :74-79/:95 is minor version drift); hidden mask default 0 documented at nifloader.hpp; children are always recursed regardless of hidden, so "never prune the branch" holds for this loader; mMask in VisController is the same hidden mask (nifloader.cpp:1036); and the scan at line 820 is indeed the only controller-chain loop in the file lacking `if (!ctrl->isActive()) continue;` (present at 966, 993, 1088, 1193, 1464, 1724), so an inactive NiVisController does suppress the skip while never getting a callback attached.

> The loader-level half of the rule is accurate (verified nifloader.cpp:817-832, node.hpp:77/98, HandleNodeArgs passed by value so mSkipMeshes is subtree-scoped, the isActive() asymmetry between the isHidden scan at :819-825 and handleNodeControllers at :993, and controller.cpp:364-387). But the closing generalisation "never prune the branch" is false on exactly the path the question cares about. SceneUtil::CleanObjectRootVisitor::applyNode (components/sceneutil/visitor.cpp:96-105) does `if (node.getNodeMask() == 0x1 && node.getNumParents() == 1) mToRemove.emplace_back(&node, node.getParent(0)); else traverse(node);` — removing the node and its entire subtree from its parent. That hardcoded 0x1 is Mask_UpdateVisitor, which is precisely what the game sets the hidden mask to at renderingmanager.cpp:400 (NifOsg::Loader::setHiddenNodeMask(Mask_UpdateVisitor)), so the header's "default 0" is never the runtime value. The visitor runs inside getModelInstance(..., baseonly, ...) at animation.cpp:1506-1527, and NpcAnimation::updateNpcBase()'s setObjectRoot(smodel, true, true, false) at npcanimation.cpp:525 is the only baseonly=true caller in the engine — it covers every NPC and the player, with smodel coming from getActorSkeleton(is1stPerson, isFemale, isBeast, isWerewolf) (npcanimation.cpp:513-525), i.e. the first-person skeleton included. Werewolves and beast races are not special-cased here; they only select a different skeleton file that goes down the same baseonly path. The pruning also defeats the stated NiVisController carve-out: VisController is an update callback that has not run at load time, so the node mask still reads 0x1 and the whole branch (meshes and controller) is deleted before it could ever flip visible; the pruned result is then cached in a static Cache and reused as the template for every later instance. A second independent pruning site exists for statics: objectpaging.cpp:668-672 sets copyMask = ~Mask_UpdateVisitor with a comment explicitly naming Flag_Hidden. The rule does still hold for the first-person hand/wrist/forearm part meshes, which are attached via insertBoundedPart/SceneUtil::attach and never see CleanObjectRootVisitor.

**Corrected form offered:** NiAVObject::Flag_Hidden is bit 0x0001 of mFlags (node.hpp:77, isHidden() at :98). When set, the nifosg loader still creates the node and recurses into its whole child hierarchy - it never prunes the branch, "so we can still animate collision shapes" - and sets the node's node mask to Loader::getHiddenNodeMask() (documented default 0). It also sets args.mSkipMeshes, which is subtree-scoped because HandleNodeArgs is passed by value (nifloader.cpp:708) and copied to each child (line 939); this suppresses the node's OWN geometry as well as its descendants', since the gate at line 852 is `isGeometry && !args.mSkipMeshes`. Crucially, mSkipMeshes is only ever set, never cleared: finding a NiVisController on this node's controller chain merely skips the assignment, so meshes are built only if no ancestor already set the flag (a hidden ancestor without a VisController, or the RootCollisionNode branch at lines 809-812). Under such an ancestor, a hidden node with a NiVisController still gets no drawables while its VisController flips an empty subtree's mask at runtime. That scan does NOT check ctrl->isActive(), unlike every other controller loop in the file (966, 993, 1088, 1193, 1464, 1724),


## 58. Special node names: "Bounding Box" is deleted, RootCollisionNode is hidden, "AttachLight" receives lights
- `components/nifosg/nifloader.cpp:707-711` - NIF nodes and transforms, importance **n/a**

Three names/types are resolved by name and each has a DIFFERENT mechanism. (1) "Bounding Box" (case-insensitive exact match): the render loader returns nullptr for it - the node AND its entire subtree never enter the scene graph at all. The guard is `args.mRootNode && ...`, and mRootNode is null on the first call, so a NIF whose ROOT is named "Bounding Box" is not skipped. The node is not wasted: the collision loader walks the record tree for the same name and, if the node's BoundingVolume is BOX_BV with all extents > 0, takes mExtents/mCenter as the actor collision box (bulletnifloader.cpp:83-99); the first match in depth-first child order wins. (2) RootCollisionNode is a record TYPE, found by NiNode::findRootCollisionNode which scans the root's direct children IN REVERSE order (`// Yes, this search needs to be reversed`, node.cpp:209-231) and only recurses when the root carried the "RCN" string extra data. The found node is hidden exactly like a hidden node - node mask set to the hidden mask and mSkipMeshes set - but the subgraph is still built and still animated (nifloader.cpp:807-813). (3) "AttachLight" (case-insensitive, FindByNameVisitor stops at the FIRST match in depth-first order and does not descend into a matched group): when a light is attached to an object subgraph, the LightSource is added as a child of that node; if no such node exists the light is added to the subgraph's own root instead.

```cpp
components/nifosg/nifloader.cpp:707-711
        osg::ref_ptr<osg::Node> handleNode(
            const Nif::NiAVObject* nifNode, const Nif::Parent* parent, osg::Group* parentNode, HandleNodeArgs args)
        {
            if (args.mRootNode && Misc::StringUtils::ciEqual(nifNode->mName, "Bounding Box"))
                return nullptr;

components/nifbullet/bulletnifloader.cpp:85-99
        if (Misc::StringUtils::ciEqual(node.mName, "Bounding Box"))
        {
            if (node.mBounds.mType == Nif::BoundingVolume::Type::BOX_BV
                && std::ranges::all_of(node.mBounds.mBox.mExtents._v, [](float extent) { return extent > 0.f; }))
            {
                mShape->mCollisionBox.mExtents = node.mBounds.mBox.mExtents;
                mShape->mCollisionBox.mCenter = node.mBounds.mBox.mCenter;
            }

components/nifosg/nifloader.cpp:807-813
            // Hide collision shapes, but don't skip the subgraph
            // We still need to animate the hidden bones so the physics system can access them
            if (nifNode == args.mCollisionNode)
            {
                args.mSkipMeshes = true;
                node->setNodeMask(Loader::getHiddenNodeMask());
            }

components/sceneutil/lightutil.cpp:98-104
        SceneUtil::FindByNameVisitor visitor("AttachLight");
        node->accept(visitor);

        osg::Group* attachTo = visitor.mFoundNode ? visitor.mFoundNode : node;
        osg::ref_ptr<LightSource> lightSource
            = createLightSource(esmLight, lightMask, isExterior, osg::Vec4f(0, 0, 0, 1));
        attachTo->addChild(lightSource);
```

**Recorded caveat** (from adversarial verification - the rule above is
sound, this is the condition it must not be read past):

> Mechanisms (1) "Bounding Box" and (3) "AttachLight" hold exactly as stated and have no player/first-person/werewolf special case (the only name-resolved sites are components/nifosg/nifloader.cpp:710, components/nifbullet/bulletnifloader.cpp:84-106, and components/sceneutil/lightutil.cpp:98 — the torch light on the player is attached to the PRT_Shield part in both view modes, apps/openmw/mwrender/npcanimation.cpp:670 and :1038). Mechanism (2) is contradicted by a caller precisely where the lens asks. The rule says the RootCollisionNode subgraph "is still built and still animated" — that is true of the loader in isolation (nifloader.cpp:807-813 only sets mSkipMeshes and node mask = Loader::getHiddenNodeMask()), but the hidden mask is Mask_UpdateVisitor == 0x1 (apps/openmw/mwrender/vismask.hpp:24, installed by apps/openmw/mwrender/renderingmanager.cpp:400), and SceneUtil::CleanObjectRootVisitor::applyNode (components/sceneutil/visitor.cpp:96-105) deletes any node whose mask is exactly 0x1 with a single parent, together with its whole subtree, instead of traversing it. That visitor runs in MWRender::getModelInstance (apps/openmw/mwrender/animation.cpp:1521-1523) on every baseonly=true load, and NpcAnimation::updateNpcBase calls setObjectRoot(smodel, true, true, false) unconditionally at apps/openmw/mwrender/npcanimation.cpp:525 — for the player, in first person as well as third, and for the werewolf/beast skeletons too, since smodel comes from getActorSkeleton(is1stPerson, isFemale, isBeast, isWerewolf) (apps/openmw/mwrender/actorutil.cpp:8-31). The result is cached and re-instanced, so no first-person player body (or any NPC/werewolf body, or ESM4 NPC via esm4npcanimation.cpp:25) ever contains the RootCollisionNode subgraph at all; it cannot be animated because it is not there. The loader comment's justification ("still need to animate the hidden bones so the physics system can access them") does not apply to actors, whose shapes come from the separate BulletNifLoader box/capsule. Note the same removal also strips ordinary Flag_Hidden nodes from actor bases, and ObjectPaging independently drops both kinds via copyMask = ~Mask_UpdateVisitor (apps/openmw/mwrender/objectpaging.cpp:668-672). Minor imprecision in claim (1): bulletnifloader's findBoundingBox stops at the first node *named* "Bounding Box" whether or not its bounds are valid — an invalid BOX_BV logs a warning, sets no box, and aborts the search rather than letting a later match win.

**Corrected form offered:** Mechanisms (1) and (3) are correct as stated. Mechanism (2) needs its last clause replaced: the RootCollisionNode is found by NiNode::findRootCollisionNode (reverse scan of the root's direct children, recursing only when the root carried the "RCN" string extra data, components/nif/node.cpp:209-231) and the loader hides it exactly like a hidden node — node mask set to Loader::getHiddenNodeMask() and mSkipMeshes set (nifloader.cpp:807-813) — so in a plain object the subgraph is still built and still animated. That last part does NOT hold for actors. Because the hidden mask is Mask_UpdateVisitor == 0x1, SceneUtil::CleanObjectRootVisitor (components/sceneutil/visitor.cpp:96-105) removes every node with mask 0x1 and its entire subtree from any model loaded with baseonly=true, which is the path every NPC body takes (Animation::setObjectRoot via getModelInstance, animation.cpp:1521-1523; NpcAnimation::updateNpcBase, npcanimation.cpp:525). So for the player's body — first person, third person, and the werewolf/beast skeletons alike — the RootCollisionNode subgraph is deleted outright rather than merely masked, and nothing in it is animated. Also, in claim (1), the collision loader stops at


## 59. NiStringExtraData markers are exact-match, root-scoped, and gate the geometry name skip list
- `components/nifosg/nifloader.cpp:742-768` - NIF nodes and transforms, importance **n/a**

A node's extra-data chain is read via NiObjectNET::getExtraList(), which concatenates the modern mExtraList vector with the legacy singly-linked mExtra chain (base.cpp:33-39) - both must be walked. Only four NiStringExtraData payloads mean anything, and the comparisons are EXACT and CASE-SENSITIVE (==, not ciEqual): "MRK" sets mHasMarkers, "RCN" enables recursive RootCollisionNode search, and BOTH are honoured ONLY when the node carrying them is the root (`args.mRootNode == node`); "BONE" tags the node with the description "CustomBone" (any node, no root check); and a string with the prefix "omw:data" carries an OpenMW-specific YAML payload (an OpenMW extension, not Morrowind data). What mHasMarkers actually does is gate a geometry-NAME skip list: for Morrowind-version files (<= VER_MW) a drawable is skipped when its name case-insensitively starts with "tri editormarker" (only if mHasMarkers) or, UNCONDITIONALLY, with "shadow" or "tri shadow". REFINES RULE 15: the "Tri " naming convention shows up in more places than the CopyRigVisitor bone filter - the engine also prefix-tests "tri editormarker", "tri shadow", and, in Animation::setObjectRoot for CREATURES ONLY, strips every drawable whose name starts with "tri bip" (animation.cpp:1645-1650 via SceneUtil::RemoveTriBipVisitor, visitor.cpp:143-151). That "tri bip" strip is creature-specific; it is NOT a general NIF rule and must not be applied to NPC or first-person meshes.

```cpp
components/nifosg/nifloader.cpp:742-768
                else if (e->mRecordType == Nif::RC_NiStringExtraData)
                {
                    const Nif::NiStringExtraData* sd = static_cast<const Nif::NiStringExtraData*>(e.getPtr());

                    constexpr std::string_view extraDataIdentifer = "omw:data";

                    // String markers may contain important information
                    // affecting the entire subtree of this obj
                    if (sd->mData == "MRK")
                    {
                        // Marker objects. These meshes are only visible in the editor.
                        if (!Loader::getShowMarkers() && args.mRootNode == node)
                            args.mHasMarkers = true;
                    }
                    else if (sd->mData == "BONE")
                    {
                        node->getOrCreateUserDataContainer()->addDescription("CustomBone");
                    }
                    else if (sd->mData == "RCN")
                    {
                        if (args.mRootNode == node)
                            recursiveCollision = true;
                    }
                    else if (sd->mData.rfind(extraDataIdentifer, 0) == 0)
                    {
                        extraData = sd->mData.substr(extraDataIdentifer.length());
                    }
                }

components/nifosg/nifloader.cpp:855-860
                if (args.mNifVersion <= Nif::NIFFile::NIFVersion::VER_MW)
                {
                    skip = (args.mHasMarkers && Misc::StringUtils::ciStartsWith(nifNode->mName, "tri editormarker"))
                        || Misc::StringUtils::ciStartsWith(nifNode->mName, "shadow")
                        || Misc::StringUtils::ciStartsWith(nifNode->mName, "tri shadow");
   
...(truncated; see the cited lines)
```

**Recorded caveat** (from adversarial verification - the rule above is
sound, this is the condition it must not be read past):

> The rule is largely accurate but states as exclusive two things the code makes conditional, so it overreaches. (1) OMITTED GUARD THAT CHANGES MEANING. The rule asserts MRK and RCN "are honoured ONLY when the node carrying them is the root (args.mRootNode == node)". The very line the rule quotes is `if (!Loader::getShowMarkers() && args.mRootNode == node)` (nifloader.cpp:753). MRK has TWO conjunctive guards, not one. `Loader::getShowMarkers()` is a global static (`sShowMarkers`, nifloader.cpp:259-269, set via `setShowMarkers`); when it is true, a root-carried MRK sets nothing at all and marker meshes render. That is the entire point of the feature and the adjacent comment says so ("These meshes are only visible in the editor"). The word "ONLY" makes this an explicit exclusivity claim the code contradicts. RCN really does have just the root check (line 762), so the rule collapses two differently-guarded cases into one wrong generalisation. (2) STATES AS THE WHOLE BEHAVIOUR SOMETHING THAT IS ONE BRANCH. "What mHasMarkers actually does is gate a geometry-NAME skip list" for `<= VER_MW` describes only the `if` arm (855-860). Lines 861-866 are an `else` arm: for post-Morrowind files `mHasMarkers` instead gates `ciStartsWith(name, "EditorMarker") || ciStartsWith(name, "VisibilityEditorMarker")`. Further, line 899 uses `mHasMarkers` for something that is not a skip list at all — `if (isAnimated || (args.mHasAnimatedParents && ((args.mSkipMeshes || args.mHasMarkers) || isGeometry))) node->setDataVariance(DYNAMIC)`. And `mHasMarkers` is settable with no NiStringExtraData involved, via BSXFlags bit 32 (lines 774-778). The whole skip block is also nested under `if (isGeometry && !args.mSkipMeshes)` (line 852). (3) SCOPE OVERREACH on the absolutes. "Only four NiStringExtraData payloads mean anything" and "the comparisons are EXACT and CASE-SENSITIVE (==, not ciEqual)" are true inside this one loop, but the rule opens by framing itself as a rule about "a node's extra-data chain" generally. bulletnifloader.cpp:141-165 walks the same `getExtraList()` and additionally honours the `"NC"`/`"NCC"` family through `Misc::StringUtils::ciStartsWith` — case-INsensitive — setting `mShape->mVisualCollisionType` to Camera or Default. VERIFIED CORRECT, for the record: base.cpp:33-39 does concatenate `mExtraList` with a walk of the legacy `mExtra`/`mNext` chain, so both must be walked. BONE adds the "CustomBone" description on any node with no root check. The `omw:data` prefix test is `rfind(id, 0) == 0` and its payload really is YAML (handleExtraData, nifloader.cpp:229-231, `YAML::L ...

> The first-person/player-relevant half of the rule is correct and survives every caller check, but the rule's absolute claims about NiStringExtraData are contradicted elsewhere in OpenMW. (1) components/nifbullet/bulletnifloader.cpp:141-165 reads a FIFTH NiStringExtraData payload using a CASE-INSENSITIVE PREFIX test, not an exact case-sensitive ==: `else if (Misc::StringUtils::ciStartsWith(sd->mData, "NC"))` sets mShape->mVisualCollisionType to Camera when the third character is an uppercase 'C' ("NCC*") and to Default (no collision) otherwise. That same loop also reads "MRK" (into mHasTriMarkers) and "RCN" at the root, and the physics skip list is a different one: ciStartsWith(name, "EditorMarker") under BSXFlags-derived mHasMarkers (line 269) and ciStartsWith(name, "Tri EditorMarker") under mHasTriMarkers (line 273). (2) The nifosg marker flag is not set by "MRK" alone: nifloader.cpp:753 gates it on `!Loader::getShowMarkers()`, and apps/opencs/editor.cpp:61 calls NifOsg::Loader::setShowMarkers(true), so in OpenCS "MRK" at the root does NOT set mHasMarkers and editor markers render. (3) mHasMarkers is additionally set by BSXFlags bit 32 (NiIntegerExtraData, nifloader.cpp:775-779), so the string is not its only source. Everything else verified as stated: base.cpp:31-39 concatenates mExtraList with the mExtra/mNext chain; nifloader.cpp:750-767 has the root gate on MRK/RCN and no root gate on BONE; nifloader.cpp:855-866 has the MW-version skip list with "tri editormarker" gated on mHasMarkers and "shadow"/"tri shadow" unconditional; and the "tri bip" strip is creature-only and cannot reach an NPC or first-person body — animation.cpp:1645-1650 runs RemoveTriBipVisitor only under `if (isCreature)`, and npcanimation.cpp:525 calls setObjectRoot(smodel, true, true, false) for every NPC including VM_FirstPerson (xbase_anim.1st), werewolves and beast races, with esm4npcanimation.cpp:25 likewise false; that NPC call additionally passes baseonly=true, which runs CleanObjectRootVisitor (animation.cpp:1506-1531) and removes every drawable from the skeleton regardless. OpenCS mirrors the same split at apps/opencs/view/render/actor.cpp:53-72 (CleanObjectRootVisitor for non-creatures, RemoveTriBipVisitor for creatures).

**Corrected form offered:** Two trivial line-range off-by-ones: nifloader.cpp:742-769 (not 742-768; the block's closing brace is on line 769) and visitor.cpp:144-152 (not 143-151; line 143 is a blank line preceding the function). The nifloader.cpp:855-860 range is exactly correct, and all three code excerpts are verbatim-accurate against current master.


## 60. NiBillboardNode keeps its translation and float scale but throws away its stored rotation every frame
- `components/nifosg/nifloader.cpp:671-690` - NIF nodes and transforms, importance **n/a**

A NiBillboardNode becomes a NifOsg::AutoTransform instead of a MatrixTransform. Its NiTransform is still read: the TRANSLATION and the float mScale are used verbatim, and the stored 3x3 is converted once into mBaseRotation. Every cull traversal the node's matrix is rebuilt from scratch as scale(mScale) then rotate(cameraDerivedRotation * mBaseRotation) then translate(storedTranslation) (autotransform.cpp:146-151) - so the file's rotation only ever acts as a fixed pre-rotation, never as the final orientation, and any non-uniform scale baked into the 3x3 is LOST for billboards. Only three of the six modes are implemented: AlwaysFaceCamera(0), RotateAboutUp(1) and BSRotateAboutUp(5) which maps onto RotateAboutUp, and RigidFaceCamera(2). AlwaysFaceCenter(3) and RigidFaceCenter(4) fall into the `else` branch: a warning is logged and the node is built with AutoTransform's DEFAULT mode, which is RigidFaceCamera (autotransform.hpp:18). Billboard nodes are also forced to DYNAMIC data variance so no optimiser flattens them away. Modes differ in kind: RotateAboutUp yaws about the node's local up using the eye position relative to the node's own translation, while the FaceCamera modes align to the cull stack's look/up vectors regardless of where the node is.

```cpp
components/nifosg/nifloader.cpp:671-690
            if (nifNode->mRecordType == Nif::RC_NiBillboardNode)
            {
                auto billboard = static_cast<const Nif::NiBillboardNode*>(nifNode);
                using Mode = Nif::NiBillboardNode::BillboardMode;

                if (billboard->mMode == Mode::AlwaysFaceCamera)
                    node = new NifOsg::AutoTransform(billboard->mTransform, AutoTransform::Mode::AlwaysFaceCamera);
                else if (billboard->mMode == Mode::RotateAboutUp || billboard->mMode == Mode::BSRotateAboutUp)
                    node = new NifOsg::AutoTransform(billboard->mTransform, AutoTransform::Mode::RotateAboutUp);
                else if (billboard->mMode == Mode::RigidFaceCamera)
                    node = new NifOsg::AutoTransform(billboard->mTransform, AutoTransform::Mode::RigidFaceCamera);
                else
                {
                    Log(Debug::Warning) << "Unhandled billboard mode " << static_cast<int>(billboard->mMode)
                                        << " in record " << nifNode->mRecordIndex;
                    node = new NifOsg::AutoTransform(billboard->mTransform);
                }

                dataVariance = osg::Object::DYNAMIC;
            }

components/nifosg/autotransform.cpp:146-151
        osg::Matrixd matrix;
        matrix.makeScale(mScale, mScale, mScale);
        matrix.postMultRotate(mat.getRotate() * mBaseRotation);
        matrix.postMultTranslate(_matrix.getTrans());

        return matrix;
```

**Recorded caveat** (from adversarial verification - the rule above is
sound, this is the condition it must not be read past):

> Most of the rule checks out against the source: the dispatch at components/nifosg/nifloader.cpp:671-690 is quoted correctly; Nif::NiBillboardNode::BillboardMode really has six values 0-5 (components/nif/node.hpp:294-302) with BSRotateAboutUp(5) folded onto RotateAboutUp; modes 3 and 4 do hit the `else`, log a warning, and get AutoTransform's default mode, which is Mode::RigidFaceCamera (autotransform.hpp:18-19 — the `else` branch actually calls the two-arg ctor on line 19, same default); dataVariance is unconditionally overridden to DYNAMIC at nifloader.cpp:689; translation and the float mScale are used verbatim (matrixtransform.cpp:5-10 plus autotransform.cpp:147,149); the non-uniform-scale-is-lost claim is correct and well-supported, since NiTransform::mRotation is documented as possibly carrying "negative and nonuniform scales" (niftypes.hpp:70) while AutoTransform rebuilds with makeScale(mScale,mScale,mScale) and mBaseRotation = rotMat.getRotate(); and the RotateAboutUp-vs-FaceCamera distinction is right (eye - _matrix.getTrans() at line 135 vs. look/up only at lines 99-100). The overreach is the clause "the file's rotation only ever acts as a fixed pre-rotation, never as the final orientation." Lines 146-151 are only reached from the CullStack branch, and even there `mat` is guarded. Three omitted paths make the file's rotation the whole final orientation: 1. autotransform.cpp:83-87 — computeMatrix falls through whenever nv is null or the visitor is not a CullStack (`nv ? nv->asCullStack() : nullptr`). That path builds scale · mRotation · translate, and mRotation is initialised to mBaseRotation in the ctor (line 24), so before any cull the file's rotation IS the final orientation. 2. The degenerate guards at autotransform.cpp:110 (`if (norm > 1e-6)`) and :137 (`if (norm > 1e-12)`). When they fail, `mat` is left as the default identity Matrixd, so line 148 reduces to postMultRotate(mBaseRotation) — again the file rotation alone. 3. Non-degenerate and routine: apps/openmw/mwrender/objectpaging.cpp:250-264 explicitly special-cases NifOsg::AutoTransform for the inactive grid, calls autoTransform->computeMatrix(nullptr) — deliberately hitting path 1 — bakes the result into a plain osg::MatrixTransform and sets osg::Object::STATIC. This also undercuts "forced to DYNAMIC data variance so no optimiser flattens them away": distant paged billboards are flattened into a static matrix, frozen at the cached mRotation.

**Corrected form offered:** A NiBillboardNode becomes a NifOsg::AutoTransform (a subclass of NifOsg::MatrixTransform) rather than a plain MatrixTransform. Its NiTransform is still read: the translation and the float mScale are used verbatim, and the stored 3x3 is converted at construction into mBaseRotation (autotransform.cpp:19-24). During a cull traversal — and only when the visitor resolves to an osg::CullStack (autotransform.cpp:75-81) — the matrix is rebuilt from scratch as scale(mScale), then rotate(cameraDerivedRotation * mBaseRotation), then translate(_matrix.getTrans()) (autotransform.cpp:146-151), so on that path the file's rotation is composed with a camera-derived rotation rather than standing as the final orientation, and any non-uniform or negative scale baked into the 3x3 is lost for billboards. It is not, however, "never the final orientation": when the visitor is not a CullStack, computeMatrix falls back to scale · mRotation · translate (autotransform.cpp:83-87), and mRotation starts out equal to mBaseRotation; and inside computeMatrixForFrame the degenerate guards `norm > 1e-6` (AlwaysFaceCamera, line 110) and `norm > 1e-12` (RotateAboutUp, line 137) leave `mat` at identity, collapsing line 


## 61. The seven texture slots are positional, and only the base map is a colour map
- `components/nifosg/nifloader.cpp:2158-2237` - Materials and textures, importance **n/a**

NiTexturingProperty::mTextures is an ordered vector whose INDEX is the slot: 0=BaseTexture, 1=DarkTexture, 2=DetailTexture, 3=GlossTexture, 4=GlowTexture, 5=BumpTexture, 6=DecalTexture (components/nif/property.hpp:43-52 - note the stream order is NOT base/dark/detail/glow, gloss sits at 3 and glow at 4). handleTextureProperty walks them in ASCENDING index order and, for each stage that is mEnabled (plus slot 0 also when the property has any controller), binds it to the NEXT FREE texture unit - `texUnit = boundTextures.size()` at :1154 - and tags that unit with a name: 0->"diffuseMap", 1->"darkMap", 2->"detailMap", 3->"glossMap", 4->"emissiveMap", 5->"bumpMap", 6->"decalMap". Any index >= 7 falls to `default:` and is SKIPPED with a log line. Because the loop is ascending and base is index 0, the base map is unit 0 whenever it is enabled - the comment at :2165 says the shadow-casting shader depends on that invariant. Three exceptions worth porting exactly: (a) an enabled stage with an empty mSourceTexture and no controller is `continue`d, so it consumes NO unit and shifts nothing; (b) a DISABLED base stage reachable only through a NiFlipController is bound with a null image and forced wrapS=wrapT=true, uvSet=0; (c) wrapT = mClamp & 1 and wrapS = mClamp & 2 (property.hpp:69-70) - note T is bit 0, S is bit 1, the opposite of the intuitive order. Each unit remembers the stage's mUVSet and the geometry's UV array for that unit comes from mUVList[uvSet] (:1643-1667). A NiTexturingProperty seen on a node calls clearBoundTextures FIRST (:2163), so it REPLACES the inherited texture set rather than merging with it. What the non-base slots actually do, from files/shaders/compatibility/objects.frag: darkMap multiplies the whole RGBA before the alpha test (:159-162); detailMap multiplies RGB by its RGB times 2.0 (:179-181); decalMap is mix()ed into RGB weighted by decalTex.a * diffuseColor.a (:183-186); emissiveMap is ADDED to RGB after lighting (:247-249); glossMap only multiplies the environment-map contribution and is a no-op without an env map (:208-210); bumpMap only perturbs env-map coordinates (:200-206). So for a Morrowind mesh with no env map, gloss and bump slots are inert.

```cpp
            // If this loop is changed such that the base texture isn't guaranteed to end up in texture unit 0, the
            // shadow casting shader will need to be updated accordingly.
            for (size_t i = 0; i < texprop->mTextures.size(); ++i)
            {
                const Nif::NiTexturingProperty::Texture& tex = texprop->mTextures[i];
                if (tex.mEnabled || (i == Nif::NiTexturingProperty::BaseTexture && !texprop->mController.empty()))
                {
                    std::string textureName;
                    switch (i)
                    {
                        // These are handled later on
                        case Nif::NiTexturingProperty::BaseTexture:
                            textureName = "diffuseMap";
                            break;
                        case Nif::NiTexturingProperty::GlowTexture:
                            textureName = "emissiveMap";
                            break;
                        case Nif::NiTexturingProperty::DarkTexture:
                            textureName = "darkMap";
                            break;
                        case Nif::NiTexturingProperty::BumpTexture:
                            textureName = "bumpMap";
                            break;
                        case Nif::NiTexturingProperty::DetailTexture:
                            textureName = "detailMap";
                            break;
                        case Nif::NiTexturingProperty::DecalTexture:
                            textureName = "decalMap";
                            break;
                        case Nif::NiTexturingProperty::GlossTexture:
                            textureName = "glossMap";
                            break;
                        default:
                  
...(truncated; see the cited lines)
```

**Recorded caveat** (from adversarial verification - the rule above is
sound, this is the condition it must not be read past):

> Most of the rule checks out against upstream master (enum order at components/nif/property.hpp:44-53; wrapT = mClamp & 1 / wrapS = mClamp & 2 at property.hpp:70-71; the ascending loop, the seven name tags, texUnit = boundTextures.size() at nifloader.cpp:1154, the default: skip-with-log, exception (b) verbatim, and the darkMap/detailMap/decalMap/emissiveMap/glossMap shader semantics). But four claims overreach: (1) It states the unit-0 invariant as always-true and derives it from the wrong premise: "Because the loop is ascending and base is index 0, the base map is unit 0 whenever it is enabled." Ascending order does not give that, because the rule's own exception (a) is the counterexample: base enabled with an empty mSourceTexture and an empty texprop->mController hits `continue` at nifloader.cpp:2205-2213, so nothing is bound and unit 0 is taken by the next surviving stage (darkMap, detailMap, ...). The invariant the shadow-casting shader actually relies on is "if a base texture is bound at all, it lands on unit 0." (2) The UV claim omits a guard that changes the meaning. nifloader.cpp:1651-1658 is not an unconditional mUVList[uvSet]: `if (uvSet >= uvlist.size())` logs "Out of bounds UV set", then `continue`s (that stage gets NO texcoord array at all) when uvlist is empty, otherwise clamps uvSet = 0. A port that indexes mUVList[uvSet] directly reads out of bounds on malformed NIFs. (3) clearBoundTextures (nifloader.cpp:1180-1186) accepts an osg::StateSet* and IGNORES it — the body is only `if (!boundTextures.empty()) boundTextures.clear();`. It resets the unit counter so new bindings overwrite units 0..N-1 on the node's own stateset; it removes nothing from any stateset, so higher-numbered texture attributes set on an ancestor stateset are still inherited by OSG state. "REPLACES the inherited texture set rather than merging with it" is the intent stated in the comment at :2162, not what the function does. (4) "bumpMap only perturbs env-map coordinates" is incomplete — objects.frag:203 also computes envLuma = clamp(bumpTex.b * envMapLumaBias.x + envMapLumaBias.y, 0.0, 1.0), which scales the entire env contribution; and the rule omits that the BumpTexture branch at nifloader.cpp:2227-2234 additionally uploads the bumpMapMatrix and envMapLumaBias uniforms. Relatedly, "gloss and bump slots are inert" for a no-env-map Morrowind mesh overstates: both still consume a texture unit (shifting every later slot), and a bound bumpMap suppresses OpenMW's auto-detected normal map when the filenames match (components/shader/shadervisitor.cpp:358-360). Minor: the proper ...

**Corrected form offered:** NiTexturingProperty::mTextures is an ordered vector whose INDEX is the slot: 0=BaseTexture, 1=DarkTexture, 2=DetailTexture, 3=GlossTexture, 4=GlowTexture, 5=BumpTexture, 6=DecalTexture (components/nif/property.hpp:44-53 - gloss sits at 3 and glow at 4). handleTextureProperty walks them in ASCENDING index order and, for each stage that is mEnabled (plus slot 0 also when texprop->mController is non-empty), binds it to the NEXT FREE texture unit (`texUnit = boundTextures.size()` at nifloader.cpp:1154) and tags that unit via SceneUtil::TextureType: 0->"diffuseMap", 1->"darkMap", 2->"detailMap", 3->"glossMap", 4->"emissiveMap", 5->"bumpMap", 6->"decalMap". Any index >= 7 falls to `default:` and is skipped with a log line. The correct unit-0 invariant is: IF a base texture is bound at all, it lands on unit 0 (it is the first index considered and boundTextures was just cleared). It is NOT true that an enabled base always occupies unit 0 - see (a) below, where an enabled base binds nothing and unit 0 falls to the next surviving stage. The comment at :2165 and the FlipController's hardcoded `stateset->getTextureAttribute(0, ...)` at :1209 both lean on the bound-base form of the invariant. T


## 62. Alpha blending and alpha testing are two independent bitfields, and disabling REMOVES inherited state
- `components/nifosg/nifloader.cpp:2320-2368` - Materials and textures, importance **n/a**

Everything comes out of NiAlphaProperty::mFlags (uint16) plus a separate uint8 mThreshold (components/nif/property.hpp:414-462): blending is enabled by bit 0x0001, alpha TESTING by bit 0x0200, and 0x2000 is Flag_NoSorter. Source blend factor = (mFlags >> 1) & 0xF, destination = (mFlags >> 5) & 0xF, alpha test function = (mFlags >> 10) & 0x7. The blend-factor table is 0=ONE, 1=ZERO, 2=SRC_COLOR, 3=ONE_MINUS_SRC_COLOR, 4=DST_COLOR, 5=ONE_MINUS_DST_COLOR, 6=SRC_ALPHA, 7=ONE_MINUS_SRC_ALPHA, 8=DST_ALPHA, 9=ONE_MINUS_DST_ALPHA, 10=SRC_ALPHA_SATURATE, anything else -> SRC_ALPHA with a log line (nifloader.cpp:1899-1929). The test-function table is 0=ALWAYS, 1=LESS, 2=EQUAL, 3=LEQUAL, 4=GREATER, 5=NOTEQUAL, 6=GEQUAL, 7=NEVER, anything else -> LEQUAL (:1931-1955). The alpha reference is mThreshold / 255.0. Two behaviours a naive port gets wrong: (1) when the flag is OFF the loader does not merely skip - it REMOVES the blend func / GL_BLEND and the alpha func / GL_ALPHA_TEST from the stateset, which is how a child NiAlphaProperty cancels an ancestor's; (2) a destination factor of DST_ALPHA is rewritten to ONE, because 'D3D8.1 doesn't do that' on an RGBA framebuffer. Sorting is decided separately: `sort = !alphaprop->noSorter()`, i.e. blending WITHOUT the 0x2000 bit puts the drawable in the TRANSPARENT_BIN (back-to-front); with the bit set it inherits the opaque bin. In the shader the test happens AFTER the base and dark maps and after the material/vertex alpha multiply: `gl_FragData[0].a *= diffuseColor.a * alpha * actorFade;` then optional darkMap multiply, then `gl_FragData[0].a = alphaTest(gl_FragData[0].a, alphaRef);` (files/shaders/compatibility/objects.frag:156-164).

```cpp
        static void handleAlphaTesting(
            bool enabled, osg::AlphaFunc::ComparisonFunction function, int threshold, osg::Node& node)
        {
            if (enabled)
            {
                osg::ref_ptr<osg::AlphaFunc> alphaFunc(new osg::AlphaFunc(function, threshold / 255.f));
                alphaFunc = shareAttribute(alphaFunc);
                node.getOrCreateStateSet()->setAttributeAndModes(alphaFunc, osg::StateAttribute::ON);
            }
            else if (osg::StateSet* stateset = node.getStateSet())
            {
                stateset->removeAttribute(osg::StateAttribute::ALPHAFUNC);
                stateset->removeMode(GL_ALPHA_TEST);
            }
        }

        void handleAlphaBlending(
            bool enabled, int sourceMode, int destMode, bool sort, bool& hasSortAlpha, osg::Node& node) const
        {
            if (enabled)
            {
                osg::ref_ptr<osg::StateSet> stateset = node.getOrCreateStateSet();
                osg::ref_ptr<osg::BlendFunc> blendFunc(
                    new osg::BlendFunc(getBlendMode(sourceMode), getBlendMode(destMode)));
                // on AMD hardware, alpha still seems to be stored with an RGBA framebuffer with OpenGL.
                // This might be mandated by the OpenGL 2.1 specification section 2.14.9, or might be a bug.
                // Either way, D3D8.1 doesn't do that, so adapt the destination factor.
                if (blendFunc->getDestination() == GL_DST_ALPHA)
                    blendFunc->setDestination(GL_ONE);
                blendFunc = shareAttribute(blendFunc);
                stateset->setAttributeAndModes(blendFunc, osg::StateAttribute::ON);

                if (sort)
                {
                    hasSortAlpha = true;
                    if (!mPu
...(truncated; see the cited lines)
```

**Recorded caveat** (from adversarial verification - the rule above is
sound, this is the condition it must not be read past):

> Nearly everything checks out against upstream, but the sorting claim states as unconditional what the code guards. Confirmed accurate: property.hpp:414-463 has Flag_Blending=0x0001, Flag_Testing=0x0200, Flag_NoSorter=0x2000, uint16 mFlags + uint8 mThreshold, and sourceBlendMode()=(mFlags>>1)&0xF, destinationBlendMode()=(mFlags>>5)&0xF, alphaTestMode()=(mFlags>>10)&0x7. getBlendMode (nifloader.cpp:1899-1928) and getTestMode (1930-1954) match the quoted tables including the SRC_ALPHA / LEQUAL defaults with Log(Debug::Info). handleAlphaTesting uses threshold/255.f, and both handlers really do removeAttribute + removeMode on the OFF branch; collectDrawableProperties (nifloader.cpp:189-211) recurses into the parent first and appends the node's own props last, so a child NiAlphaProperty genuinely cancels an ancestor's on the shared drawable stateset. The DST_ALPHA -> ONE rewrite and the objects.frag ordering (157 `gl_FragData[0].a *= diffuseColor.a * alpha * actorFade;`, 160-161 darkMap, 164 alphaTest) are verbatim correct. The defect: "blending WITHOUT the 0x2000 bit puts the drawable in the TRANSPARENT_BIN (back-to-front); with the bit set it inherits the opaque bin" drops the `if (!mPushedSorter)` guard that sits on BOTH bin calls in the quoted snippet. mPushedSorter is the enclosing NiSortAdjustNode (nifloader.cpp:329, pushed at :800-803). When one is in scope, handleAlphaBlending sets NO bin at all — it only sets hasSortAlpha — and the bin is decided later at nifloader.cpp:2943-2985 from the sorter's mode and subsorter type. That inverts the stated outcome in real cases: under SortingMode::Off a blending drawable with the sorter bit CLEAR gets setBinTraversal (bin 2, "TraversalOrderBin"), not back-to-front; and under a NiClusterAccumulator subsorter a drawable WITH the 0x2000 bit set still gets setBinBackToFront regardless of hasSortAlpha, rather than inheriting. A port that hardcodes the rule as written mis-sorts every mesh under a NiSortAdjustNode. Two smaller inaccuracies ride along: the back-to-front path outside handleAlphaBlending is setRenderBinDetails(0, "SORT_BACK_TO_FRONT"), not the TRANSPARENT_BIN hint (bin 10, DepthSortedBin); and setRenderBinToInherit() means inheriting whatever bin is in effect, which is not necessarily "the opaque bin".

> The rule cannot hold here because its entire subject is absent from this codebase, and the code that actually renders the first-person player body contradicts it. This repository is /home/user/project-dagger, a JavaScript port of Daggerfall (logic from Daggerfall Unity, presentation on hand-rolled WebGL2) — not OpenMW. All three cited sources are non-existent paths: there is no components/ directory, no files/shaders/ directory, no .gitmodules, and zero .cpp/.hpp/.frag/.glsl files anywhere in the tree. A full-tree grep (excluding .git and node_modules) for NiAlphaProperty, nifloader, nifosg, and openmw returns no hits; the sole filename matching *nif* is /home/user/project-dagger/test/manifest.test.js, matching on the substring inside "manifest". Daggerfall assets are ARCH3D/CIF/IMG, never NIF, so no mFlags/mThreshold decode, blend-factor table, test-function table, stateset, or sorting bin exists to be overridden. Where it matters for a first-person player body, the real behaviour is different in kind, not just in detail. Alpha is a fixed 1-bit cutout compiled into the shaders rather than a per-material reference derived from mThreshold/255.0: `if (t.a < 0.5) discard;` at /home/user/project-dagger/src/render/renderer.js:63, :794 and :895, with the one exception being spectral (ghost) flats at renderer.js:230, `if (tex.a < (uSpectral == 1 ? 0.1 : 0.5)) discard;`. The comment at renderer.js:890-895 states the governing law: classic art is a 1-bit palette cutout (index 0 transparent, everything else fully opaque), so the default discards and forces alpha 1, with a narrow `uBlendTex` opt-in for art authored outside that palette. Blending, where enabled at all, is one hard-coded pair with no factor decoding — gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA) at renderer.js:950, :1438, :1512, overworldRenderer.js:369 and :385, and precipitation.js:165 — so there is no source/destination factor selection and therefore no DST_ALPHA-to-ONE rewrite. Because the renderer is immediate-mode WebGL2 with no stateset graph, the rule's two load-bearing behaviours have no mechanism to exist: nothing can REMOVE a blend func or alpha func from a parent's state to cancel it, and there is no noSorter bit or TRANSPARENT_BIN assignment. The specific special cases the task asked about confirm the same. The first-person viewmodel entry point, drawFirstPersonViewmodel at /home/user/project-dagger/src/render/characterSprite.js:54, is explicitly marked ON ICE (2026-08-17) with "No consumer"; the live first-person path is src/combat/fpsWeapon.js using WEAPON*.CIF sprites, and neith ...

**Corrected form offered:** Same as stated for the flags, the bit fields, both lookup tables (SRC_ALPHA / LEQUAL fallbacks), alphaRef = mThreshold/255.0, the remove-on-off cancellation semantics, the DST_ALPHA -> ONE destination rewrite, and the shader ordering — but the sorting rule is conditional on there being no enclosing NiSortAdjustNode. The call site passes sort = !alphaprop->noSorter() (nifloader.cpp:2829-2830), and handleAlphaBlending's blending branch always records hasSortAlpha = sort; the bin, however, is only touched when mPushedSorter == nullptr: sort -> setRenderingHint(TRANSPARENT_BIN), !sort -> setRenderBinToInherit(), and the OFF branch also calls setRenderBinToInherit(). When an ancestor NiSortAdjustNode IS in scope, handleAlphaBlending sets no bin; the end of applyDrawableProperties (nifloader.cpp:2943-2985) assigns it instead: SortingMode::Off -> setRenderBinDetails(2, "TraversalOrderBin") no matter what the alpha flags say; Inherit/Subsort with a NiAlphaAccumulator -> setRenderBinDetails(0, "SORT_BACK_TO_FRONT") if hasSortAlpha else TraversalOrderBin; with a NiClusterAccumulator -> SORT_BACK_TO_FRONT unconditionally. Also, with no pushed sorter, a non-sorting drawable that carries a sten


## 63. Vertex colour REPLACES the material colour - it never multiplies it
- `files/shaders/lib/material/vertexcolors.glsl:6-32` - Materials and textures, importance **n/a**

This is the single most likely place for a port to be silently wrong. OpenMW does not modulate the material by the vertex colour; the vertex colour SUBSTITUTES for whichever material channel the colour mode names. getDiffuseColor returns passColor (the whole vec4, RGB and A) when the mode is AmbientAndDiffuse or Diffuse, otherwise material.diffuse; getAmbientColor and getEmissionColor behave the same way for their modes. Consequences that must be reproduced: (a) with vertex colours present the material's DIFFUSE COLOUR IS DISCARDED, not tinted; (b) with vertex colours present the material's ALPHA is discarded too, because NiMaterialProperty's mAlpha is stored as diffuse.a (`mat->setDiffuse(osg::Vec4f(matprop->mDiffuse, matprop->mAlpha))`, nifloader.cpp:2599) and the fragment shader consumes it as `gl_FragData[0].a *= diffuseColor.a` (objects.frag:156-157) where diffuseColor is the vertex colour - so vertex alpha wins outright; (c) the specular channel is only ever replaced under ColorMode_Specular, which the NIF loader never selects. passColor is gl_Color, bound per-vertex from NiGeometryData::mColors as a Vec4Array (nifloader.cpp:1642-1644, objects.vert:88/:103). The numeric mode values that reach the shader are ColorMode_None=0, Emission=1, AmbientAndDiffuse=2, Ambient=3, Diffuse=4, Specular=5 (files/shaders/lib/material/colormodes.glsl:4-9), matching SceneUtil::VertexColorModes in components/sceneutil/material.hpp:18-25.

```cpp
vec4 getEmissionColor(Material material, vec4 passColor)
{
    if (material.vertexColorMode == ColorMode_Emission)
        return passColor;
    return material.emission;
}

vec4 getAmbientColor(Material material, vec4 passColor)
{
    if (material.vertexColorMode == ColorMode_AmbientAndDiffuse || material.vertexColorMode == ColorMode_Ambient)
        return passColor;
    return material.ambient;
}

vec4 getDiffuseColor(Material material, vec4 passColor)
{
    if (material.vertexColorMode == ColorMode_AmbientAndDiffuse || material.vertexColorMode == ColorMode_Diffuse)
        return passColor;
    return material.diffuse;
}

vec4 getSpecularColor(Material material, vec4 passColor)
{
    if (material.vertexColorMode == ColorMode_Specular)
        return passColor;
    return material.specular;
}
```

**Recorded caveat** (from adversarial verification - the rule above is
sound, this is the condition it must not be read past):

> The core mechanism is correct and verified: vertexcolors.glsl:6-32 substitutes (does not modulate) the whole vec4 passColor for the named channel; the mode constants 0-5 match SceneUtil::VertexColorModes (material.hpp:18-25); passColor = gl_Color from a per-vertex Vec4Array (objects.vert:88/:103, nifloader.cpp:1642-1644); objects.frag:156-157 is quoted exactly; and ColorMode_Specular is indeed never selected by the NIF loader (nothing in the tree selects it at all). But consequences (a) and (b) are both stated as holding "with vertex colours present", and that is not the guard the code uses. Presence of vertex colours only sets the DEFAULT mode (nifloader.cpp:2737-2738); a NiVertexColorProperty then overrides it (nifloader.cpp:2784-2822): VertMode_SrcIgnore -> None, VertMode_SrcEmissive -> Emission, VertMode_SrcAmbDif + LightMode_Emissive -> None, VertMode_SrcAmbDif + LightMode_EmiAmbDif -> AmbientAndDiffuse. In the None and Emission cases a mesh that HAS vertex colours still takes material.diffuse, so the material's diffuse colour and its alpha (matprop->mAlpha) are fully preserved and vertex alpha does NOT win. Stating the consequence as conditional on vertex-colour presence rather than on the vertex colour MODE turns a conditional into an always-true and omits the guard that a porter most needs. Secondary inaccuracies: "vertex alpha wins outright" overstates objects.frag:157, where diffuseColor.a is only one multiplicand alongside the diffuse-map alpha already in gl_FragData[0].a, the separate `alpha` uniform (objects.frag:67), and actorFade; diffuse.a is also not exclusively NiMaterialProperty's mAlpha, since Material::setAlpha (material.hpp:88-95, used for BSLightingShaderProperty at nifloader.cpp:2857) writes the same value into all four channels' alpha; and the cited line number for setDiffuse is 2768 in this checkout, not 2599.

**Corrected form offered:** OpenMW does not modulate the material by the vertex colour; the vertex colour SUBSTITUTES for whichever material channel the VERTEX COLOUR MODE names. getDiffuseColor returns the whole passColor vec4 (RGB and A) when the mode is AmbientAndDiffuse or Diffuse, otherwise material.diffuse; getAmbientColor and getEmissionColor behave the same way for their modes (files/shaders/lib/material/vertexcolors.glsl:6-32). Consequences to reproduce: (a) WHEN THE MODE IS AmbientAndDiffuse OR Diffuse the material's diffuse colour is discarded, not tinted; (b) in those same modes the material's alpha is discarded too, because NiMaterialProperty's mAlpha is stored as diffuse.a (mat->setDiffuse(osg::Vec4f(matprop->mDiffuse, matprop->mAlpha)), nifloader.cpp:2768) and the fragment shader consumes it as gl_FragData[0].a *= diffuseColor.a * alpha * actorFade (objects.frag:156-157) - so vertex alpha replaces the material alpha there, though it is still multiplied against the diffuse-map alpha, the separate `alpha` uniform and actorFade rather than winning outright. Crucially, the mode is NOT simply "does the mesh have vertex colours". Vertex colours only set the default (AmbientAndDiffuse) at nifloader.cp


## 64. With no NiMaterialProperty the default is white diffuse + white ambient, and the material is attached only if it differs from default
- `components/nifosg/nifloader.cpp:2731-2934` - Materials and textures, importance **n/a**

applyDrawableProperties starts from a fresh SceneUtil::Material whose MaterialConfig defaults are diffuse (1,1,1,1), ambient (1,1,1,1), specular (0,0,0,0), emission (0,0,0,1), shininess 0, emissiveMult 1, specularStrength 1, vertexColorMode None (components/sceneutil/material.hpp:27-36), then explicitly re-sets diffuse and ambient to white with the comment 'NIF material defaults don't match OpenGL defaults'. The ONLY thing set before the property loop that is not the default is the colour mode: it is AmbientAndDiffuse when the geometry has a colour array and None when it does not - so a shape with vertex colours and NO NiMaterialProperty still gets a material, and its vertex colours drive both ambient and diffuse. Two guards run after the loop: if the geometry turned out to have no colour array, whatever mode was selected is undone by writing the corresponding channel to white and forcing mode None (:2907-2926) - i.e. a NiVertexColorProperty on a colourless mesh yields plain white, not black; and the material is only ATTACHED TO THE STATESET AT ALL if it has a controller or differs from a default-constructed Material (:2928-2934), so an untextured, unmaterialled, colourless shape carries no material state and inherits whatever is above it. Also note NiMaterialProperty's own fields per property.cpp:505-521: ambient and diffuse are only read when bethVersion < 26, emissiveMult only when bethVersion >= 22, and mAlpha is a single float that becomes diffuse.a (ambient/emissive/specular keep alpha 1).

```cpp
            // Specular lighting is enabled by default, but there's a quirk...
            bool specEnabled = true;
            osg::ref_ptr<SceneUtil::Material> mat(new SceneUtil::Material);
            mat->setVertexColorMode(
                hasVertexColors ? SceneUtil::VertexColorModes::AmbientAndDiffuse : SceneUtil::VertexColorModes::None);

            // NIF material defaults don't match OpenGL defaults
            mat->setDiffuse(osg::Vec4f(1, 1, 1, 1));
            mat->setAmbient(osg::Vec4f(1, 1, 1, 1));
...
            // If we're told to use vertex colors but there are none to use, use a default color instead.
            if (!hasVertexColors)
            {
                switch (mat->getVertexColorMode())
                {
                    case SceneUtil::VertexColorModes::Ambient:
                        mat->setAmbient(osg::Vec4f(1, 1, 1, 1));
                        break;
                    case SceneUtil::VertexColorModes::AmbientAndDiffuse:
                        mat->setAmbient(osg::Vec4f(1, 1, 1, 1));
                        mat->setDiffuse(osg::Vec4f(1, 1, 1, 1));
                        break;
                    case SceneUtil::VertexColorModes::Emission:
                        mat->setEmission(osg::Vec4f(1, 1, 1, 1));
                        break;
                    default:
                        break;
                }
                mat->setVertexColorMode(SceneUtil::VertexColorModes::None);
            }

            static const SceneUtil::Material defaultMat{};

            if (hasMatCtrl || *mat != defaultMat)
            {
                mat = shareAttribute(mat);
                node->getOrCreateStateSet()->setAttributeAndModes(mat, osg::StateAttribute::ON);
            }
```

**Recorded caveat** (from adversarial verification - the rule above is
sound, this is the condition it must not be read past):

> The rule omits a guard that inverts its central claim. It asserts only "Two guards run after the loop" and cites :2907-2926 and :2928-2934, but there are two further blocks between the loop and :2907. The decisive one is nifloader.cpp:2899-2906: `if (lightmode == LightMode_Emissive) { diffuse = (0,0,0,diffuse.a()); mat->setDiffuse(diffuse); mat->setAmbient(osg::Vec4f()); }`. Trace a NiVertexColorProperty with VertMode_SrcAmbDif + LightMode_Emissive on a mesh with no colour array: inside the loop (2808-2812) the mode is forced to None and `lightmode` is latched to LightMode_Emissive; at 2899 ambient and diffuse RGB are zeroed to black; at 2907 the !hasVertexColors switch sees mode None, hits `default:`, and writes nothing back to white; at 2930 the material now differs from defaultMat so it IS attached, carrying black ambient and black diffuse. That directly refutes "a NiVertexColorProperty on a colourless mesh yields plain white, not black" — stated as always-true when it holds only while lightmode != LightMode_Emissive — and refutes the corollary that such a shape carries no material state and inherits from above. A second omitted block at 2891-2897 (`mVersion <= VER_MW || !specEnabled`) also runs after the loop and unconditionally stomps specular to (0,0,0,0), shininess to 0 and specularStrength to 1, so on Morrowind-era NIFs a NiMaterialProperty's mSpecular/mGlossiness never reach the stateset. Everything else in the rule checks out against the fetched sources: MaterialConfig defaults at material.hpp:27-36 are exactly as stated; the redundant white re-set of diffuse/ambient is real; the colour mode is indeed the only non-default material state set before the loop; Material::operator== (material.cpp:68-75) compares mVertexColorMode, so a vertex-coloured shape with no NiMaterialProperty does get a material attached with AmbientAndDiffuse; and the property.cpp:505-521 claims hold (mAmbient/mDiffuse read only when bethVersion < 26, mEmissiveMult only when bethVersion >= 22, mAlpha a single float becoming diffuse.a while setAmbient/setEmission/setSpecular each pass 1.f as alpha).

> Refuted on its premise, not by an override. The rule describes OpenMW's C++ NIF loader, and none of it exists in the codebase under review. Working directory is /home/user/project-dagger, a JavaScript 1:1 Daggerfall port on a hand-rolled WebGL2 renderer. Verified: (1) the claimed source components/nifosg/nifloader.cpp:2731-2934 does not exist, and there is no components/, nifosg/, or sceneutil/ directory anywhere; (2) the repo contains ZERO C++ sources - find for *.cpp/*.hpp/*.cc/*.h returns nothing; (3) grep across the whole tree including vendor/ for applyDrawableProperties, NiMaterialProperty, NiVertexColorProperty, SceneUtil, emissiveMult, vertexColorMode, bethVersion and openmw returns zero hits. vendor/ holds only dfu-books, dfu-quests, dfu-settings (Daggerfall Unity text data). The only "Morrowind" matches are a province name at /home/user/project-dagger/src/ui/provinceMap.js:93 and a font remark at /home/user/project-dagger/bible/10-UI/UI-Arc.md:339. The actual rendering model is incompatible with the rule rather than a variant of it: /home/user/project-dagger/src/render/characterMesh.js packs interleaved [pos.xyz, color.rgb, normal.xyz] per vertex and /home/user/project-dagger/src/render/renderer.js lights it in-shader against a scene ambient/sun/point model - no OSG state sets, no material objects, no inheritance from parent state, no NIF property loop, so there is no "attach only if it differs from a default-constructed Material" behaviour to override. The first-person framing has no counterpart either: per /home/user/project-dagger/src/combat/fpsWeapon.js:1-22 first-person view is classic 2D CIF sprite art and the voxel FP viewmodel is explicitly "ON ICE" as of a 2026-08-17 design pivot, so there is no first-person 3D player body carrying material state. Beast/werewolf and vampire handling (/home/user/project-dagger/src/characters/beasts.js, /home/user/project-dagger/src/characters/pieces/beastHead.js, /home/user/project-dagger/src/characters/paperdollPayload.js) drives paperdoll and sprite art, never mesh materials. IMPORTANT CAVEAT: I did not find a caller, subclass, or special case that contradicts the rule as a statement about real OpenMW - I found that OpenMW is not present in this session at all, so the rule is unverifiable here and must not be recorded as confirmed. If the intent was to audit the genuine OpenMW repository, it needs to be attached first; nothing in project-dagger can confirm or refute its NIF material defaults.

**Corrected form offered:** applyDrawableProperties starts from a fresh SceneUtil::Material whose MaterialConfig defaults are diffuse (1,1,1,1), ambient (1,1,1,1), specular (0,0,0,0), emission (0,0,0,1), shininess 0, emissiveMult 1, specularStrength 1, vertexColorMode None (components/sceneutil/material.hpp:27-36), then redundantly re-sets diffuse and ambient to white. The only non-default material state set before the property loop is the colour mode: AmbientAndDiffuse when the geometry has a colour array, None when it does not — so a shape with vertex colours and no NiMaterialProperty still gets a material whose vertex colours drive ambient and diffuse. FOUR things then run after the loop, not two. (1) :2891-2897 — if mVersion <= VER_MW or specular was disabled, specular is forced to (0,0,0,0), shininess to 0 and specularStrength to 1, discarding whatever a NiMaterialProperty or BSLightingShaderProperty set. (2) :2899-2906 — if a NiVertexColorProperty selected VertMode_SrcAmbDif with LightMode_Emissive, diffuse RGB is zeroed (alpha kept) and ambient is set to (0,0,0,0), i.e. genuinely black. (3) :2907-2926 — only if the geometry has no colour array, the channel matching the currently selected mode is writte


## 65. NiStencilProperty is really the winding/two-sided property; only DrawMode 3 disables culling
- `components/nifosg/nifloader.cpp:2490-2532` - Materials and textures, importance **n/a**

NiStencilProperty carries two separate things and the loader always acts on the first even when stencilling itself is off. mDrawMode (Default=0, CounterClockwise=1, Clockwise=2, Both=3, property.hpp:539-545) sets the OSG front-face winding and culling: mode 2 (Clockwise) -> FrontFace CLOCKWISE, everything else including Default and Both -> COUNTER_CLOCKWISE; then GL_CULL_FACE is turned OFF only for mode 3 (Both) and explicitly ON for every other mode. So two-sided rendering in a Morrowind NIF means exactly `NiStencilProperty.mDrawMode == 3`, and 'Default' is a synonym for CCW-with-backface-culling, not for two-sided. The actual stencil buffer state is applied only when mEnabled: function from mTestFunction (Never=0..Always=7 mapping straight onto GL), ref = mStencilRef, mask = mStencilMask, and the three actions (fail / z-fail / pass) from Keep=0, Zero=1, Replace=2, Increment=3, Decrement=4, Invert=5. Field layout differs by version (property.cpp:539-568): for NIF <= 20.0.0.5 the fields are read individually as separate values; for later versions they are packed into mFlags as enabled=bit0, fail=(>>1)&7, zfail=(>>4)&7, pass=(>>7)&7, drawMode=(>>10)&3, testFunc=(>>12)&7 - Morrowind (4.0.0.2) uses the individual-field form. One knock-on: any enabled stencil property anywhere sets the loader-wide mHasStencilProperty, which pushes non-alpha-sorted drawables into a TraversalOrderBin instead of the default bin (:2938-2939) - stencil meshes are drawn in traversal order.

```cpp
                case Nif::RC_NiStencilProperty:
                {
                    const Nif::NiStencilProperty* stencilprop = static_cast<const Nif::NiStencilProperty*>(property);

                    osg::ref_ptr<osg::FrontFace> frontFace = new osg::FrontFace;
                    using DrawMode = Nif::NiStencilProperty::DrawMode;
                    switch (stencilprop->mDrawMode)
                    {
                        case DrawMode::Clockwise:
                            frontFace->setMode(osg::FrontFace::CLOCKWISE);
                            break;
                        case DrawMode::Default:
                        case DrawMode::CounterClockwise:
                        case DrawMode::Both:
                        default:
                            frontFace->setMode(osg::FrontFace::COUNTER_CLOCKWISE);
                            break;
                    }
                    frontFace = shareAttribute(frontFace);

                    osg::StateSet* stateset = node->getOrCreateStateSet();
                    stateset->setAttribute(frontFace, osg::StateAttribute::ON);
                    if (stencilprop->mDrawMode == DrawMode::Both)
                        stateset->setMode(GL_CULL_FACE, osg::StateAttribute::OFF);
                    else
                        stateset->setMode(GL_CULL_FACE, osg::StateAttribute::ON);

                    if (stencilprop->mEnabled)
                    {
                        mHasStencilProperty = true;
                        osg::ref_ptr<osg::Stencil> stencil = new osg::Stencil;
                        stencil->setFunction(getStencilFunction(stencilprop->mTestFunction), stencilprop->mStencilRef,
                            stencilprop->mStencilMask);
```

**Recorded caveat** (from adversarial verification - the rule above is
sound, this is the condition it must not be read past):

> The rule is a faithful reading of components/nifosg/nifloader.cpp:2490-2532 and components/nif/property.{hpp,cpp} in isolation — I verified the DrawMode switch, the CULL_FACE OFF-only-for-Both logic, the mEnabled gate, the enum values at property.hpp:519-545, and the version split at property.cpp:539-568 (VER_MW=0x04000002, VER_OB=0x14000005 at niffile.hpp:28-30, so Morrowind does take the individual-field branch). But two callers change the behaviour precisely on the first-person player body, which is the case the question asks about. (1) The TraversalOrderBin knock-on does not happen on the first-person body. apps/openmw/mwrender/npcanimation.cpp:418-433 (NpcAnimation::setRenderBin, called from :309 on every view-mode change) does, for VM_FirstPerson: mObjectRoot->getOrCreateStateSet()->setRenderBinDetails(RenderBin_FirstPerson /*12*/, "DepthClear", osg::StateSet::OVERRIDE_RENDERBIN_DETAILS). OVERRIDE_RENDERBIN_DETAILS suppresses every descendant stateset's bin details unless that descendant is PROTECTED. The loader's setBinTraversal (nifloader.cpp:2748, applied at :2938-2939) uses plain setRenderBinDetails(2, "TraversalOrderBin") with the default USE_RENDERBIN_DETAILS mode, so it is suppressed — stencil meshes on the FP body are drawn in bin 12 "DepthClear" together with everything else, not in traversal order. The loader's alpha SORT_BACK_TO_FRONT (nifloader.cpp:2317, 2747) is suppressed the same way. OpenMW's own code corroborates the semantics: components/sceneutil/extradata.cpp:33 and components/sceneutil/mwshadowtechnique.cpp:3472 deliberately use OVERRIDE_PROTECTED_RENDERBIN_DETAILS specifically so their bins survive an enclosing OVERRIDE. (2) "Default is a synonym for CCW-with-backface-culling" is not the effective state on the first-person left arm. components/sceneutil/attach.cpp:103-172: any attachment whose bone name contains "Left" gets trans->setScale(-1,1,1) plus a shared stateset carrying osg::FrontFace::CLOCKWISE, so the ambient winding under the mirrored left arm is CLOCKWISE. The FP left-arm body parts attach to exactly those bones — "Left Hand"/"Left Wrist"/"Left Forearm"/"Left Upper Arm" (npcanimation.cpp:249-256, reached via ActorAnimation::attach at actoranimation.cpp:89-105), and first person keeps precisely the Hand/Wrist/Forearm/Upperarm slots (npcanimation.cpp:886-889, 902-905). Because attach's stateset is setAttributeAndModes(frontFace, ON) and NOT marked OVERRIDE, a left-side part whose NIF carries a NiStencilProperty keeps the loader's node-level COUNTER_CLOCKWISE, which cancels the mirror's compensation and renders that  ...

**Corrected form offered:** The loader half is right: in components/nifosg/nifloader.cpp:2490-2532 mDrawMode is acted on unconditionally, with Clockwise(2) -> FrontFace CLOCKWISE and Default(0)/CounterClockwise(1)/Both(3) -> COUNTER_CLOCKWISE, then GL_CULL_FACE OFF only for Both(3) and ON otherwise; the osg::Stencil (function from mTestFunction, ref mStencilRef, mask mStencilMask, ops from mFailAction/mZFailAction/mPassAction) is applied only when mEnabled; and the version split in components/nif/property.cpp:539-568 is as described, with Morrowind (4.0.0.2 <= VER_OB 20.0.0.5) reading the fields individually. Within a Morrowind NIF, mDrawMode == Both is indeed the only route to two-sided rendering, and that does survive — no ancestor stateset marks GL_CULL_FACE with OVERRIDE. Two clauses must be qualified for the first-person player body: 1. The TraversalOrderBin claim does not apply there. NpcAnimation::setRenderBin (apps/openmw/mwrender/npcanimation.cpp:418-433, called from :309) puts RenderBin_FirstPerson (12) / "DepthClear" on mObjectRoot with osg::StateSet::OVERRIDE_RENDERBIN_DETAILS. Since the loader's setRenderBinDetails(2, "TraversalOrderBin") at nifloader.cpp:2748 is unprotected, it is discarded for 


## 66. NiVertexColorProperty picks the colour mode; LightMode_Emissive blacks out diffuse and ambient; Morrowind NIFs never get specular
- `components/nifosg/nifloader.cpp:2784-2905` - Materials and textures, importance **n/a**

NiVertexColorProperty has two enums (property.hpp:558-576): VertexMode SrcIgnore=0 / SrcEmissive=1 / SrcAmbDif=2, and LightMode Emissive=0 / EmiAmbDif=1. The loader maps SrcIgnore -> VertexColorModes::None (vertex colours dropped entirely), SrcEmissive -> Emission (vertex colour replaces the emissive term), and SrcAmbDif -> AmbientAndDiffuse UNLESS its LightMode is Emissive, in which case the mode is None. Then, separately, after the whole property loop, if the last-seen lightmode was LightMode_Emissive the material's diffuse RGB is forced to (0,0,0) keeping its alpha, and ambient is forced to the zero vector - i.e. the surface is lit ONLY by its emissive term. Careful with the scoping: `lightmode` is only updated inside the SrcAmbDif branch (:2805), so a SrcEmissive or SrcIgnore property leaves the running lightmode at its EmiAmbDif default and does not trigger the blackout. On version: for any NIF at or below VER_MW (0x04000002, components/nif/niffile.hpp:28) specular is unconditionally zeroed - specular colour (0,0,0,0), shininess 0, strength 1 - with the comment 'Morrowind has its support disabled'. So for a Morrowind-era mesh NiSpecularProperty and NiMaterialProperty's specular/glossiness fields are parsed and then thrown away; a port should not implement Morrowind specular at all.

```cpp
                    case Nif::RC_NiVertexColorProperty:
                    {
                        const Nif::NiVertexColorProperty* vertprop
                            = static_cast<const Nif::NiVertexColorProperty*>(property);

                        using VertexMode = Nif::NiVertexColorProperty::VertexMode;
                        switch (vertprop->mVertexMode)
                        {
                            case VertexMode::VertMode_SrcIgnore:
                            {
                                mat->setVertexColorMode(SceneUtil::VertexColorModes::None);
                                break;
                            }
                            case VertexMode::VertMode_SrcEmissive:
                            {
                                mat->setVertexColorMode(SceneUtil::VertexColorModes::Emission);
                                break;
                            }
                            case VertexMode::VertMode_SrcAmbDif:
                            {
                                lightmode = vertprop->mLightingMode;
                                using LightMode = Nif::NiVertexColorProperty::LightMode;
                                switch (lightmode)
                                {
                                    case LightMode::LightMode_Emissive:
                                    {
                                        mat->setVertexColorMode(SceneUtil::VertexColorModes::None);
                                        break;
                                    }
                                    case LightMode::LightMode_EmiAmbDif:
                                    default:
                                    {
                                        mat->setVertexColorMode(SceneUtil::VertexColorModes::Am
...(truncated; see the cited lines)
```

**Recorded caveat** (from adversarial verification - the rule above is
sound, this is the condition it must not be read past):

> Most of the rule is accurate (verified against OpenMW master: components/nif/property.hpp:558-576 for both enums, components/nif/niffile.hpp:28 for VER_MW = 0x04000002, and components/nifosg/nifloader.cpp:2784-2905 for the mapping, the blackout and the specular zeroing). The specular half is if anything understated: nifloader.cpp:1118-1120 additionally skips any NiMaterialColorController whose mTargetColor is Specular when mVersion <= VER_MW, so nothing reintroduces specular for a Morrowind-era mesh and "a port should not implement Morrowind specular at all" holds. The scoping clause is where it overreaches. The rule correctly observes that `lightmode` is assigned only inside the SrcAmbDif branch (nifloader.cpp:2804; the only writes are the initialisation at :2750 and that one line), but then states as always-true something that is only conditional: "a SrcEmissive or SrcIgnore property leaves the running lightmode at its EmiAmbDif default and does not trigger the blackout." The code does not leave lightmode at its default — it simply does not touch it, so lightmode keeps whatever a previously-processed property latched. That is reachable, not hypothetical. collectDrawableProperties (nifloader.cpp:189-210) recurses through the whole ancestor chain first (`if (parent != nullptr) collectDrawableProperties(&parent->mNiNode, parent->mParent, out);`) and appends every NiVertexColorProperty it finds, root-first, before the drawable's own. So a parent NiNode carrying SrcAmbDif + LightMode_Emissive latches lightmode = Emissive, and a child NiTriShape carrying SrcIgnore or SrcEmissive then overrides only the vertex colour mode — the `if (lightmode == LightMode_Emissive)` test at :2899 still fires and the diffuse/ambient blackout still happens. The SrcEmissive case in particular yields a combination the rule denies: vertex colour mode Emission plus blacked-out diffuse and ambient, i.e. a surface lit solely by its vertex colours. A port implementing the rule as written would diverge from OpenMW on any mesh whose ancestor node carries a SrcAmbDif + Emissive vertex-colour property.

> The rule cannot be confirmed because its subject does not exist in the repository under review. The codebase at /home/user/project-dagger is "project-dagger", a JavaScript port of Daggerfall (data/logic translated from Daggerfall Unity, presentation on hand-rolled WebGL2) — not OpenMW. Specifics: (1) All three cited files are missing — components/nifosg/nifloader.cpp, components/nif/property.hpp, components/nif/niffile.hpp; there is no components/ directory at all. (2) The repository contains zero C++ files (find for *.cpp/*.hpp outside node_modules returns nothing). (3) Grep across the whole tree for NiVertexColorProperty, NiMaterialProperty, nifosg, VertexColorMode, lightmode, SrcAmbDif, SrcEmissive, AmbientAndDiffuse, VER_MW, and glossiness returns no hits; grep for "openmw" returns no hits. (4) There is no NIF pipeline: the 3D model format layer is /home/user/project-dagger/src/formats/arch3dFile.js, Daggerfall's ARCH3D.BSA format, which has no NiProperty concept. The renderer (/home/user/project-dagger/src/render/) contains renderer.js, characterMesh.js, skyRenderer.js and similar; the only two files mentioning "specular" anywhere are src/characters/pieces/draped.js and src/tools/paperdollViewer.js, neither related to NIF materials or a version gate. (5) The requested special cases do exist as subject matter but are wholly unrelated to the rule: first-person body and werewolf/beast-race code lives in src/combat/fpsWeapon.js, src/characters/rewrite/limb.js, src/characters/beasts.js and src/characters/pieces/beastHead.js, and none of it touches vertex-colour modes, emissive lightmodes, or specular version gating, because that machinery is absent. I therefore found no caller, override, subclass or special case that changes the described behaviour — but only because the described behaviour is not present here. Since the task's bar was to confirm only if the rule holds where it matters for a first-person player body, and nothing in this repository can establish that, this is a refutation on premise grounds. Note this is NOT a claim that the rule is factually wrong about upstream OpenMW; that codebase is simply not available here to check.

**Corrected form offered:** NiVertexColorProperty has two enums (components/nif/property.hpp:558-576): VertexMode SrcIgnore=0 / SrcEmissive=1 / SrcAmbDif=2, and LightMode Emissive=0 / EmiAmbDif=1. The loader maps SrcIgnore -> VertexColorModes::None, SrcEmissive -> Emission, and SrcAmbDif -> AmbientAndDiffuse UNLESS its LightMode is Emissive, in which case the mode is None. Separately, after the whole property loop, if `lightmode` holds LightMode_Emissive the material's diffuse RGB is forced to (0,0,0) keeping its alpha and ambient is forced to the zero vector, so the surface is lit only by its emissive term. Scoping: `lightmode` is initialised to EmiAmbDif before the loop (nifloader.cpp:2750) and written in exactly one place, inside the SrcAmbDif branch (:2804). A SrcEmissive or SrcIgnore property therefore does not reset lightmode — it leaves it untouched at whatever the last SrcAmbDif property set, or at the EmiAmbDif default only if no SrcAmbDif property has been seen yet. This matters because collectDrawableProperties (:189-210) accumulates properties from the entire ancestor chain, parents first, so a parent node's SrcAmbDif + LightMode_Emissive latches lightmode = Emissive and the blackout still fires e


---

# Part III - what the port still does not know

The completeness critic's answer to "what would a port still get wrong?",
verified against OpenMW checkouts rather than recalled. This is the
worklist for the next reading pass, and the reason no code has been
written yet.

I read the doc and then verified each suspected gap against the two OpenMW checkouts already on disk (`/home/user/openmw/openmw`, `/tmp/fpv/openmw`). Gaps below are in priority order; every citation was read, not recalled.

---

**1. Nothing anywhere tells the port how to EVALUATE a keyframe track. This is the single largest hole.**

Rules 1–18 and the whole fan-out cover which KF to load, which group to play, which text keys bound it, and how a posed vertex is skinned — and then stop. The step in the middle, "given a bone track and a time t, produce a rotation/translation/scale", is unread ground. Unread files: `components/nif/nifkey.hpp` (all 240 lines), `components/nifosg/controller.hpp:42-180`, `components/nifosg/controller.cpp:94-223`.

Specifics a port will get wrong by guessing: there are six interpolation types (`nifkey.hpp:17-24`), and `InterpolationType_Constant` is **not** hold-previous — it is `fraction > 0.5f ? b.mValue : a.mValue` (`controller.hpp:136-137`), so it flips at the midpoint. Quadratic and TCB share one cubic Hermite with the basis polynomials written out at `controller.hpp:139-154`. TCB tangents are baked at LOAD time from tension/continuity/bias into four coefficients `mA..mD` (`nifkey.hpp:165-169`) and then into `mInTan`/`mOutTan` by three different formulas for first key / interior / last key, with the interior ones scaled by `(key.mTime - prev.mTime)/timeSpan` and `(next.mTime - key.mTime)/timeSpan` (`nifkey.hpp:172-205`). Quaternions **never** take the Hermite path — always slerp — and TCB-for-quat is an explicit empty stub (`controller.hpp:157-172`, `nifkey.hpp:203-206`). XYZ rotation (type 4) is not read where it appears at all: `data.cpp` eats a float and re-runs the read three times as LINEAR float subtracks (`nifkey.hpp:104-111`), and evaluation composes three per-axis quats in one of **nine** axis orders (`controller.cpp:136-170`). Edge behaviour: `time <= keys.front().first` returns the first value verbatim, past-the-end returns `keys.back()`, equal-time keys return the low one (`controller.hpp:100-125`), and the reader deliberately does not sort or dedupe — the comment says so: *"Note: NetImmerse does NOT sort keys or remove duplicates"* (`nifkey.hpp:117`).

**2. What a MISSING channel does — and it is a first-person bug the engine names out loud.**

`components/nifosg/controller.cpp:179-200`:
```cpp
if (rotation) node->setRotation(*rotation);
else
{
    // This is necessary to prevent first person animations glitching out due to RotationController
    node->setRotation(node->mRotationScale);
}
if (translation) node->setTranslation(*translation);
if (scale) node->setScale(*scale);
```
Translation and scale are written only when the track has them; rotation is rewritten **every frame regardless**, to the NIF's original 3×3. `components/nifosg/matrixtransform.{hpp,cpp}` (unread, whole file) explains why: the node stores `float mScale` and `Nif::Matrix3 mRotationScale` alongside the 4×4 precisely because *"Decomposing the original components from the 4x4 matrix isn't possible, which causes problems when a KeyframeController wants to change only one of these components"*. `setRotation` writes `_matrix(i,j) = mRotationScale.mValues[j][i] * mScale`; `setTranslation` writes row 3 independently. A port that stores only a matrix per bone, or that skips the rotation write when a track has no rotation channel, reproduces exactly the FP neck glitch that comment was written to prevent — because the RotateController from the surviving first-person rules is what accumulates into it.

**3. An attack is THREE `play()` calls, and the weapon is not always drawn.**

The doc has attack text-key NAMES (rule 11) but not the sequence. `character.cpp:1705-1719` plays wind-up `<type> start` → `<type> max attack`; `:1763-1877` plays release `<type> max attack` → `<type> hit` (literally `" release"` instead of `" hit"` when `mAttackType == "shoot"`) with `startPoint = 1.f - mAttackStrength`, further scaled by `(minHitTime - maxAttackTime)/(hitTime - maxAttackTime)` when `maxAttackTime <= minHitTime < hitTime`; `:1794-1812` plays follow `<type> <small|medium|large> follow start` → `... follow stop`, buckets at 0.33/0.66, and the strength prefix is **omitted** for `"shoot"`. All three pass `weapSpeed` as the speed multiplier, which is the weapon record's own `mData.mSpeed` (`character.cpp:1298, 1326`) — the doc has no concept of per-weapon animation speed. Separately, `NpcAnimation::showWeapons(bool)` (`npcanimation.cpp:953-989`) is what creates and destroys the weapon mesh, driven off the `equip attach`/`unequip detach` keys gated on `mUpperBodyState` (`character.cpp:1074-1087`) — so a drawn weapon is a state, not a fact. And rule 11 records only `getBestAttack`; `character.cpp:1683-1691` shows that is behind `Settings::game().mBestAttack`, with `getMovementBasedAttackType()` as the other branch, unread.

**4. The equipment priority system — the thing that decides whether the arm you are drawing exists.**

`npcanimation.cpp:573-700`, entirely unread. A `slotlist[]` table with base priorities (Robe 11, Skirt 3, everything else 0), `prio = ((mBasePriority + 1) << 1) + (0 for Clothing, 1 for Armor)`, and `reserveIndividualPart` (`:744-757`) which claims a slot with **no mesh at all** — the part is then invisible, not replaced. A ROBE reserves `PRT_RForearm, PRT_LForearm, PRT_RUpperarm, PRT_LUpperarm` among others (`:637-641`), i.e. it deletes the very forearms and upper arms a first-person view is made of. Also: the naked-body fill loop is `for (int part = ESM::PRT_Neck; part < ESM::PRT_Count; ++part)` (`:682`) — `PRT_Head = 0, PRT_Hair = 1, PRT_Neck = 2` (`components/esm3/loadarmo.hpp`), so head and hair are excluded by the **loop bound**, not only by the `VM_FirstPerson` test at `:650`. Rule 7 is true but the doc does not say why.

**5. Actor scale — and first person is deliberately different.**

The doc never mentions scale. `apps/openmw/mwclass/npc.cpp:1102-1136`: it is rendering-only (`if (!rendering) return; // collision meshes are not scaled based on race height`). For the player in first person it applies race **height** uniformly to all three axes and returns early, with the comment *"Race weight should not affect 1st-person meshes, otherwise it will change hand proportions and can break aiming."* Third person instead applies weight to x/y and height to z — a **non-uniform** scale. `NpcAnimation::setViewMode` re-applies this on every view change, before `rebuild()` (`npcanimation.cpp:304-306`). A port that scales FP hands by weight, or that scales uniformly in third person, is visibly wrong.

**6. How to get a triangle out of the file.**

There are rules about skinning and materials but none about geometry. Unread: `components/nif/data.hpp:13-64` (`mNumVertices` is a **uint16**; `mUVList` is a vector-of-vectors; separate `mNormals/mTangents/mBitangents`) and `nifloader.cpp:1557-1640` — `NiTriShapeData` yields one TRIANGLES set from `mTriangles`; `NiTriStrips` yields one TRIANGLE_STRIP **per strip** with strips of size < 3 silently skipped (`:1613-1618`); and a skinned mesh with a partition uses `partition.mTrueTriangles`/`mTrueStrips` instead (`:1571-1592`). Winding, the has-normals/has-colors flags, and the skin-partition vertex remap are all unexamined.

**7. The container format itself.**

`components/nif/niffile.cpp:539-720`, unread. Header must start with `"NetImmerse File Format"` or `"Gamebryo File Format"`; then a BCD version and a chain of version-gated optional blocks (endianness ≥ 20.0.0.4, user version ≥ 10.0.1.8, record-type listing ≥ 5.0.0.1, record sizes ≥ 20.2.0.5, string table ≥ 20.1.0.1, groups ≥ 5.0.0.6, record separators in [10.0.0.0, 10.2.0.0)). An unknown record type is a **throw**, not a skip (`:674-676`). Root records come from a trailing index list (`:698-714`). And `nifstream.cpp:58-72`: sized strings are truncated at the first NUL and then run through the `ToUTF8` encoder — Morrowind node names are **Windows-1252**, not ASCII. Every bone-name and text-key comparison in every surviving rule depends on that decode, and it is nowhere recorded.

**8. Three different animation clocks on one actor.**

`npcanimation.cpp:857-867`: the head's internal controllers get `mHeadAnimationTime`, `PRT_Weapon` gets `mWeaponAnimationTime`, and **every other attached part** gets `mAnimationTimePtr[0]` — the LOWER-BODY winner's clock, not its own bone group's. `weaponanimation.cpp:25-49`: `mWeaponAnimationTime` returns `getCurrentTime(mWeaponGroup) - mStartTime`, and `mStartTime` is `getStartTime(group)` only when relative — which `character.cpp:943-945` sets true **only for Ranged** weapons, with a comment about mods rotating throwing projectiles. The doc has one clock.

**9. Ranged aim pitch, and its unresolved first-person form.**

`NpcAnimation::addControllers` attaches `WeaponAnimation::addControllers` only in `VM_Normal` (`npcanimation.cpp:947-950`), so the spine-pitch controllers are third-person only — yet `updateWeaponState` calls `setPitchFactor` unconditionally with a text-key-derived ramp (`character.cpp:1868-1893`: `(currentTime - startTime)/(minAttackTime - startTime)` during wind-up, `1 - complete` at attack end, `max(0, 1 - complete*10)` for crossbow). What the FP arm does with bow pitch instead is genuinely unanswered; needs `weaponanimation.cpp:130+` and `npcanimation.cpp:712-750`.

**10. Two OpenMW features that must NOT be ported, and are not flagged in the doc.**

`Settings::game().mSmoothAnimTransitions` gates `AnimBlendRules` (`animation.cpp:738-765, 1157-1170`, plus `components/sceneutil/animblendrules.cpp` and `files/data/animations/animation-config.yaml`) — vanilla is a hard cut. `Settings::game().mShieldSheathing` (`npcanimation.cpp:991-1013`) invents a `"Bip01 AttachShield"` bone Morrowind has no such thing as. Given this port's history, both belong in the doc as explicit do-not-implement entries, not as omissions.

**11. VFS lookup.** `components/vfs/pathutil.hpp:18-21` (`c == '\\' ? '/' : toLower(c)`, no leading separator, no duplicate separators) and `components/vfs/registerarchives.cpp` for BSA-vs-loose precedence. Rule 18 asks "does this KF exist in the VFS" and the port has no rule for answering it.

---

**Surviving rules I consider too vague to implement from:**

- **The skinning blend accumulation.** "Skipping every index where `i % 4 == 3` — i.e. the projective last column" is only unambiguous for a flat row-major `Float32Array`. Restate as: elements [0..2][0..2] and [3][0..2] are blended; [i][3] is never touched. As written, a port using nested arrays or a column-major library will skip the wrong four elements.
- **Rule 9's lower-body-only fallback.** The doc says it "is the whole difference between a wrong animation and no animation on the arms" without saying which. Per the surviving priority rule, a bone group with no winner gets **no controller attached at all** — so the arms hold whatever the last winner left, which is not bind pose. Write that consequence down; a port will otherwise assume bind pose.
- **Rule 10 overreaches.** `character.cpp:799-812` rolls the 2–5 dice only `if (!weapShortGroup.empty())`, and `ESM::Weapon::None`'s short group is `""` (`weapontype.cpp`, `Weapon<None>::getValue`). A first-person player with nothing drawn plays bare `idle` with `numLoops = UINT32_MAX` — forever. As written the rule reads as if FP idle always loops 2–5 times.
- **The stop-key truncation rule.** "truncated to `groupname.size()+2+stop.size()`" — C++ `compare(pos, len, ...)` is well-defined when the string is shorter; a naive JS `slice()` is not equivalent. The exact predicate is needed.
- **Rule 17's node existence test.** Not stated that the lookup is against `getNodeMap()`, case-insensitive, and that failure silently keeps `Weapon Bone` (`npcanimation.cpp:780-796`).
- **The first-person FOV rule** gives OpenMW's mechanism (`modelView * newProj * inverse(oldProj)`) but not what a WebGL port must do — second pass with its own projection, or the matrix trick — and the two are only equivalent if the depth clear also happens, which lives in a **disputed** rule (render bin 12).
