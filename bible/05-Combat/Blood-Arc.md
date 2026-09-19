# BLOOD1 - the port's own blood, gore and bleeding (2026-09-19)

Mac: *"this mod we do not have permission to integrate. So instead I
really want to try and build our own version as close to 1:1 as
possible"*, then *"I really want you to read in how their module works
so we can achieve our own type of parity"*.

## What this is, and what it is NOT

DaggerBlood 1.0.6a by **Excoriated** (GUID
`46fdaaf8-6fd2-461b-90f2-b590bda1976b`, for DFU 1.1.1) is the reference
for the FEEL. It is **not** vendored, it gets **no row in
`01-Overview/Mod-Registry.md`**, and nothing of it ships:

- **no code.** The port's 1:1 mod slices (SW1, WW1, the C&C reading)
  transcribe a DLL's IL method by method, and every one of them carries
  a permission line. This has none, so that route is closed. What was
  read out of `DaggerBlood.dll` and written down below is the set of
  BEHAVIOURAL FACTS - thresholds, counts, orderings, which DFU event
  fires what. Facts are not the author's to own; his implementation is.
  Nothing here is a transcription, and no `[IL]` citation into his
  assembly appears anywhere in this tree.
- **no art.** Its thirteen textures (`BloodPool1`, `Gibs`,
  `BloodExplosionSheet`, `Corpseplosion`, and the HD variants) stay in
  his bundle. Ours come from the player's own ARENA2, which is where
  every other pixel in this port comes from.
- **no settings prose.** The key NAMES below are functional labels; his
  descriptions are his writing and are not copied.

The mod's own zip stays out of `vendor/`. It was read once, in the
scratchpad, and the reading is this page.

## THE FACTS READ OFF THE ASSEMBLY

### The hook

One Harmony postfix on `FormulaHelper.CalculateAttackDamage`, plus
`EnemyDeath.OnEnemyDeath`, `SaveLoadManager.OnLoad`,
`StartGameBehaviour.OnNewGame`, `PlayerEnterExit.OnPreTransition` and
`FloatingOrigin.OnPositionUpdate`.

The port needs no Harmony: `combat/formulas.js` already raises a seam
on every resolution of an attack (SW1's recoil rides it), and the
floating-origin shift is `state.compensation` in the streaming host.

### The blood-type gate

`GetBloodType(mobileID)` answers one of three things, and **its
bloodless set is DFU's own**. Measured: the ids it sends down the
"no blood" arm are 15, 18, 19, 23, 32, 33 - exactly the six that carry
`bloodIndex: 2` in `characters/enemyBasics.js`, which the port
generated from DFU (MIT) long ago and which `hitEffects.js` already
reads. It adds id 2 to that set, and sends 35, 36 and 38 down a
"nothing at all" arm.

So the table is not his invention and we do not need it: `bloodIndex`
is already ours.

| answer | what happens |
|---|---|
| no blood | a DUST puff at the body instead of a splash |
| suppressed | nothing is spawned at all |
| blood | the ladder below |

### The rate ladder

`percent = damage / target.MaxHealth * 100`, then a five-rung step
function, each rung scaled by the particle-density setting:

| percent | particles |
|---|---|
| <= 25 | 30 |
| <= 50 | 50 |
| <= 100 | 70 |
| < 175 | 150 |
| >= 175 | 200 |

`ScaleRate(n) = max(1, round(n * density))` - so the density slider
never scales a hit down to nothing.

### Overkill

**The threshold is 175%, not the 200% the mod's own setting text
says.** A hit for >= 1.75x the target's max health, with overkill
enabled, replaces the single spawn with a burst: 450 particles at size
5..10, then 350 more at 5..10, a splash sound, and the rate-ladder
spawn at size 1..5 underneath. The kill sound is deferred to a
callback so it lands on the death rather than the hit.

A weapon whose item template index is 126, or whose short name
lowercases to `"horse"`, forces the overkill branch whatever the
damage was - a joke weapon with a guaranteed gib.

### Gibs

On an explosive death: the corpse renderer is switched OFF, knockback
is zeroed, a gib prefab is instantiated at the body, and a blood burst
goes off. Gibs are sprite quads with physics that pick a random frame
from a sheet; on landing they print a decal and stop.

### Decals

A fixed-size pool built at boot (`MaxBloodPools`, 100..50000, default
1000), recycled oldest-first through a queue - the "how long blood
stays" setting is really "how many before yours is reused". A decal can
ATTACH to a moving parent, so blood on a body rides the body. On a
floating-origin shift every active decal is offset by the same delta.

Particles print decals where they land (`OnParticleCollision`), with a
water-tile check that swaps in a water effect instead, a small random
scale jitter, and an optional splat sound.

### Player bleeding

Off by default. Above the health threshold, nothing. Below it, every
**2..5 seconds** (random) a spawn from the camera of

    round(clamp01(1 - (pct - 1) / (threshold - 1)) * MaxParticles)

particles - so the count ramps from 0 at the threshold to
`MaxParticles` (default 40) at 1% health - with an optional subtle red
screen flash. Suppressed at 0 health and while a load is in progress.

## WHAT WE BUILD

Our own, on the seams the port already has.

`scenes/hitEffects.js` is EnemyBlood.cs ported already - the classic
one-shot splash from TEXTURE.380 at 10fps, with the spawn/retire
pooling to hang the rest off. `combat/formulas.js` already raises a
per-resolution seam. `characters/enemyBasics.js` already carries
`bloodIndex`. `public/art` has no blood and will not need any: the
decal source is TEXTURE.380's own frames out of the player's ARENA2,
varied procedurally (rotation, scale, colour jitter).

Slices, each behind its own `features.js` row:

1. **BLOOD1a - the decal pool.** SHIPPED (`src/combat/bloodDecals.js`,
   `test/blood1_decals.test.js`, `tools/mutants/blood1.json` 8/8 dead).
   A fixed ring of oriented quads laid on the surface a hit or a
   particle met, recycled oldest-first, offset with the floating
   origin, cleared on a mode change; the rate ladder drives the count.

   NO RENDERER IN IT. The module answers WHERE a mark goes and WHICH
   one is next out of the ring; the host draws it. That is the
   camp.js/camps.js split, and it is what lets every law here be driven
   on a table instead of through a GL context.

   **THE DRAW came with it.** `drawCharacterSpriteQuad` could not
   serve a decal: it pins its up-axis to world Y (`cy +- halfH`), so
   its quad is always vertical, and a decal's whole point is to lie on
   the surface it landed on. So the module works out the four corners
   from a full surface basis and the renderer's `createDecalBatch` /
   `writeDecalSlot` / `drawDecals` are plumbing over that. ONE draw
   call for the whole ring, depth TESTED but not WRITTEN (the 2cm lift
   wins the test against the surface; writing depth would make two
   overlapping marks fight instead of layer), a placement touching one
   slot's 36 floats through `bufferSubData` at its own offset, and the
   index buffer built once at boot because an empty slot is a zero-area
   quad rather than a gap. `decalIndices` and `DECAL_FLOATS_PER_VERTEX`
   are imported BY the renderer FROM the module, so the format has one
   home and the writer cannot disagree with the buffer.

   **THE MARK RIDES THE SPLASH'S OWN CALL.** `showBloodSplash` has
   eight call sites across four hosts and IS the event "blood happened
   here", so the stain comes off it rather than a ninth seam nobody
   would remember to feed. The surface is FOUND, not assumed: blood
   spawns at chest height, so the ray goes down and the mark wears
   whatever normal it hit - on a ramp it lies along the ramp and its
   2cm lift comes off the ramp. Blood over open air leaves nothing. A
   bloodless foe stains nothing, off DFU's own `bloodIndex`. A host
   that passes none of the three decal deps draws exactly the splash it
   always drew.

   **ONE MARK PER BLOOD EVENT is the whole of BLOOD1a**, and the rate
   SIZES it rather than multiplying it (0.35m to 1.2m, the port's own
   art direction and said to be). The reference's rate is a PARTICLE
   count and each particle that lands prints its own mark, so the
   scatter is the particles' to bring in BLOOD1b: a decals-per-hit law
   invented here would be one to un-invent later, and two hundred a hit
   would spend a thousand-mark ring in five swings.

   Two things the writing settled that the reading had not. THE
   LADDER'S TOP RUNG AND THE OVERKILL LINE ARE ONE NUMBER (175): the
   first cut had them as separate table rows and the boundary came out
   wrong, so `ladderRate` asks `OVERKILL_PERCENT` directly and the two
   cannot drift apart. And THE SEED AXIS FOR THE SURFACE BASIS swaps
   near horizontal not because the maths breaks there - `up x normal`
   collapsing falls to a fallback that is still a valid basis - but
   because just BESIDE the collapse the cross product is
   ill-conditioned: two floors tilted a thousandth of a unit either way
   would disagree about which way is right. A dungeon floor is never
   exactly level, so that is the case and not the corner. Both are
   mutation-recorded; both survived the first cut of the pins and named
   real holes (the origin-shift pin's delta had a zero height term, and
   the basis was never exercised near horizontal).
2. **BLOOD1b - overkill and gibs.** The 175% rung, the burst, the
   corpse swap.
3. **BLOOD1c - bleeding.** The 2..5s cadence and the ramp above.

The numbers in THE FACTS are the target to feel like. The code that
hits them is ours.
