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

**RE-READ 2026-09-19 (BLOOD1b), and the first reading was wrong twice.**
What follows is the assembly, decompiled to its shape:

    if (!target || damage <= 0) return;
    if (target is EnemyEntity e) {                     // the blood-type gate
      var t = GetBloodType(e.MobileEnemy.ID);
      if (t == 0) { SpawnDust(pos); return; }          // no blood -> dust
      if (t == 2) return;                              // suppressed -> nothing
    }
    percent = damage / target.MaxHealth * 100;
    rate    = GetBloodRateByPercentage(percent);
    pos     = target.EntityBehaviour.transform.position;
    heavy   = weapon != null && weapon.ItemTemplate.index == 126;
    isHorse = weapon != null && weapon.shortName.ToLower() == "horse";

    if (attacker == PlayerEntity) {
      if (percent >= 175 && (settingsAllowOverkill || isHorse)) {
        audioSource.Stop();
        if (heavy || isHorse) {
          SpawnBlood(pos, ScaleRate(450), 5, 10);
          lastKilled = target;
          soundToPlayOnKillCallback = <the splash, deferred>;
        } else {
          SpawnBlood(pos, ScaleRate(350), 5, 10);
          PlayRandomBloodAudio(BloodSplashAudio, audioSource);
        }
      }
      SpawnBlood(pos, rate, 1, 5);
      return;
    }
    if (percent >= 175 && settingsAllowOverkill) {
      var src = target's own AudioSource (added if absent);
      src.Stop();
      PlayRandomBloodAudio(BloodSplashAudio, src);
      SpawnBlood(pos, ScaleRate(350), 5, 10);
    }
    SpawnBlood(pos, rate, 1, 5);

**The threshold is 175%, not the 200% the mod's own setting text
says.** That part of the first reading stands.

**WRONG 1: "450 particles, then 350 more."** It is an if/ELSE, not a
sequence. 450 for a WARHAMMER (item template 126) or the joke weapon;
350 for everything else. A hit never spawns both. And the burst does
not REPLACE the ordinary spawn - the ladder's own `SpawnBlood(pos,
rate, 1, 5)` runs underneath either way, and runs alone when the blow
is under the line or the setting is off.

**WRONG 2: "at size 5..10."** `SpawnBlood(pos, rate, a, b)` sets
`main.startSpeed = MinMaxCurve(a, b)`. Those are SPEEDS. The decal
sizes are fixed on the printer - `defaultSize` 0.05, `minSize` 0.01,
`maxSize` 0.1 metres - and never vary with the blow at all. So the
burst's 5..10 against the ordinary 1..5 buys REACH, not bigger marks:
the same blood thrown two and a half times as fast lands further out.

**Item template 126 is the WARHAMMER**, not a joke weapon - the first
reading assumed one from the `"horse"` short-name test beside it. That
second test is for a weapon some other mod adds; this port has no such
item, so it has nowhere to go, like Climates & Calories' two tavern
backgrounds. The warhammer is real here and is carried.

Two more facts the re-read turned up, neither yet built:

- **THE SWING THROWS THE SPRAY.** `SpawnBlood` rotates the particle
  system to the PLAYER's rotation and then pushes it with a
  `forceOverLifetime` chosen by `WeaponManager.ScreenWeapon.WeaponState`
  - a different axis and sign for each of the six strike directions. A
  downward cut throws the blood differently from a left swing. The port
  has weapon states; what none of its eleven splash sites carries is
  which one was live, so this is a thread rather than a line.
- **CEILING DRIPS.** `ParticleCollisionPrinter.GenerateCeilingDrips` is
  set true on every spawn.

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
   `src/combat/bloodMarks.js`, `src/combat/bloodSwitch.js`,
   `test/blood1_decals.test.js`, `tools/mutants/blood1.json` 32/32 dead).
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

   THE HOSTS, under the FOUR HOSTS RULE. The switch is ONE BAG
   (`bloodDecalDeps` in `src/combat/bloodSwitch.js`), built once and
   passed whole by all four: four hosts spelling three settings three
   ways is that rule's own hazard. The collider goes in as a GETTER and
   is never captured, because every host rebuilds its own - a mode
   change swaps it and the streaming world swaps it again on every
   pixel load - while the pool outlives all of it.

   THE MARKS GO DOWN BEFORE THE BILLBOARDS, so a body standing in its
   own blood is over it and not under it. THE SHIFT RIDES `offsetAll`,
   which every host already calls; a second line beside it is a line
   four hosts have to remember, and the one that forgot would strand
   its blood 819.2 units behind - the exact fault AUDIT 17e F23 wrote
   that block's comment about. A room thrown away takes its blood on
   the `clear()` every host already makes, and its GL on `dispose()`.

   THE MARK'S ART IS THE SPLASH'S SETTLED FRAME. A splash plays out to
   the stain and then vanishes, so that last frame IS the mark; it is
   recorded at the upload because nothing else can see `frameCount`.
   The port ships no blood picture of its own and the pin greps for
   one.

   HARD1 FIRED TWICE IN THIS SLICE AND WAS RIGHT BOTH TIMES. The mark
   pool is its OWN binding rather than a property of the splash pool,
   because `hitEffects` is a HAND-OFF and the three ownership answers
   are exclusive - the thing that holds a vertex buffer ends by its own
   name. And the interior host's pool was never named in `tryExit()` or
   `forceExitToExterior()`, so blood laid in a building would have
   followed the player into the street.
2. **BLOOD1b - the blow, the scatter, then overkill and gibs.**
   IN PROGRESS. The first two shipped together.

   THE LADDER WAS DEAD. `showBloodSplash` took the blow as its fourth
   argument and not one of the eleven call sites passed it, so every
   mark in a real game came out of `damagePercent(0, 0)`: the bottom
   rung, the smallest spatter, for a dagger's graze and for a blow that
   took three quarters of a giant. BLOOD1a's pins drove the ladder on a
   table and the hosts never did. The blow now rides all eleven, the
   shape is spelled once (`bloodHit`, which takes the ENTITY because
   what a site has to hand is the body it just hurt), and the pin reads
   every call in `src/` and holds that each carries one. The count is
   pinned too, so a site deleted is as much a drift as one added. The
   one site with no entity to measure against is WeaponManager.cs's
   wandering civilian, who dies to ONE hit whatever the weapon: the
   blow took all of them, which is the hundred rung and NOT an overkill
   - a murder is not a gibbing.

   THE SCATTER, which BLOOD1a named as this slice's. The reference's
   rate is a PARTICLE count and this port flies no particles, and
   building a particle system to decide how many marks to draw would be
   paying for a simulation to answer a question that has a number in
   it. So the rate is read as how much blood left the body, and the
   share of it that reaches a surface is the PORT'S OWN number and says
   so: 0.12, which is four drops at the bottom rung and twenty-four at
   the top. The ceiling of twenty-four is a cost decided at the top of
   the file rather than at the bottom of a frame, because each drop is
   a raycast; the top rung lands just under it, which is the point.
   ONE IS STILL THE FLOOR, so BLOOD1a's single mark is the bottom of
   this rather than a case it replaced.

   DROP ZERO IS THE BODY'S OWN SPOT, with no offset at all: a hit
   stains where it happened whatever else the spray does. The rest go
   on an EVEN angular turn with a wobble rather than a random angle,
   because random angles clump and a clump of spatter reads as one
   badly drawn mark; and the radius goes as the SQUARE ROOT of the
   drop's share, which spreads them by AREA - a linear radius piles
   them into the middle, where the pool already is. A POOL AND ITS
   SPATTER, not one size repeated: drop zero at the band's own size,
   everything around it at 0.45 of it, each jittered by 30% either way
   and floored at zero.

   THE REACH IS JUDGED PER DROP. A foe fought on the edge of a walkway
   throws spatter into the dark on one side and onto stone on the
   other; a spray that took one ray for the lot would either hang the
   far drops in space or lose the near ones with them.

   ONE SET OF DICE: the pool takes the rng and hands it down to the
   ring, so the mark's own turn and the spray's offsets come from one
   seam. Mutants: 49, 49 dead.

   THEN THE OVERKILL. Re-reading the assembly for it found the first
   reading wrong twice; both corrections are in THE FACTS above rather
   than quietly fixed, because a fact the port builds on has to be one
   a person can check.

   What the port does with the corrected reading: a blow at or past
   175% throws a SECOND spray over the ordinary one. The burst has a
   ceiling of its own (48 drops against the ordinary 24) because 450
   and 350 both come out past the ordinary cap, so sharing it would
   make a warhammer and a dagger leave one mess. Both branches fly at
   the same speed, so the 450/350 difference is how MUCH and the
   speed band is how FAR: two and a half times the ordinary reach,
   derived from the two bands rather than typed, so a later re-read
   that moves a band moves the scale with it.

   ONLY A PLAYER'S WARHAMMER takes the heavy branch, because the
   assembly asks both questions. Both are the SITE'S to answer, and
   `fromPlayer` defaults to NO - eleven sites means a default leaning
   the wrong way is eleven silent wrong answers. Four sites say yes:
   a melee swing in each of the three foe pools, and the shaft all
   three share.

   THE BURST GOES DOWN FIRST so the ladder's pool lands on top of it,
   which is the assembly's order and the one that reads right: the
   wide thin spatter, then the pool under the body. `blood-overkill`
   is its own feature row, read live, and off is a killing blow that
   bleeds like any other hit. Mutants: 60, 60 dead.

   STILL TO COME IN THIS SLICE: the splash sound (immediate for the
   350 branch, deferred to the DEATH for the 450 one), the corpse
   swap and the gibs, and the two facts the re-read turned up - the
   swing direction throwing the spray, and the ceiling drips.
3. **BLOOD1c - bleeding.** The 2..5s cadence and the ramp above.

The numbers in THE FACTS are the target to feel like. The code that
hits them is ours.
