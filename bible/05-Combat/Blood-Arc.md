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
  set true on every spawn, and `HandleCollision` is what reads it:

      var point  = e.intersection;
      var normal = e.normal;
      bool isCeiling   = Dot(normal, Vector3.down) > 0.7;
      bool aboveSource = point.y > particleSystem.transform.position.y;
      ... SetupDecal(...) ...
      if (GenerateCeilingDrips && isCeiling && aboveSource) {
        decal.transform.rotation = Quaternion.Euler(180, 0, 0);
        SpawnBloodDripParticles(normal);
      }

  So a CEILING IS A SURFACE TEST, not a position one: a normal within
  0.7 of straight down, which is about forty-five degrees - a steep
  overhang counts and a wall does not. The second test is what stops a
  floor under a source below it from being treated as one.

  The same method also settles how a decal is ORIENTED, which BLOOD1a
  arrived at independently: `Cross(normal, up)` when that is not
  degenerate and `FromToRotation(up, normal)` when it is, plus a random
  spin of `rotationRandomness`. That is `surfaceBasis` - the seed swap
  near horizontal and the turn - by another route.

### Gibs

**RE-READ 2026-09-19 (BLOOD1b).** Two handlers, and the first marks a
death for the second:

`OnExplosionDeath(entity)` - the spell-explosion path:

    if (entity.EntityBehaviour.EntityType == 2) return;
    if (entity is not EnemyEntity e) return;
    if (GetBloodType(e.MobileEnemy.ID) != 1) return;     // blood only
    entity's renderer.enabled = false;                   // the body vanishes
    entity's EnemyMotor.KnockbackSpeed = 0f;
    Instantiate(bloodExplosion3DPrefab, pos, identity);
    SpawnBloodBurst(pos);
    soundToPlayOnKillCallback = <the splash, deferred>;
    lastKilled = entity;

`EnemyDeath_OnEnemyDeath(sender, args)` - which acts on it:

    if (lastKilled == null || sender is not EnemyDeath death) return;
    if (lastKilled.EntityBehaviour != death's behaviour) return;
    var ground = behaviour's EnemyMotor.FindGroundPosition(16f);
    Instantiate(corpseExplosionPrefab, ground, identity, transform);
    _corpsesList.Add(it);
    if (!IsPlayerInside) StreamingWorld.TrackLooseObject(it, ...);
    behaviour.CorpseLootContainer's renderer.enabled = false;
    if (settingsAllowGibs) for (int i = 0; i < 10; i++)
        GibList.Add(new GameObject("Gib", typeof(SpriteFloaty)) at the body);
    soundToPlayOnKillCallback?.Invoke();
    soundToPlayOnKillCallback = null;
    lastKilled = null;

**So `lastKilled` is the whole mechanism, and it is set in exactly two
places**: an explosive death, and the PLAYER'S WARHAMMER OVERKILL in
the attack handler above. Everything else dies ordinarily. The deferred
splash sound plays here, on the death frame, which is what the deferral
was for.

A gib is a `SpriteFloaty`, and its physics are all in its `Start`:

    velocity   = (Random(-15,15), Random(5,15), Random(-15,15))
    useGravity = false; FixedUpdate: AddForce(Physics.gravity * 3, Acceleration)
    drag = 0.1, angularDrag = 0, mass = 15, freezeRotation = true
    AddTorque(Random.insideUnitSphere * 5, Acceleration)
    Destroy(rigidbody, 4f); Destroy(boxCollider, 4f)
    OnCollisionEnter: SpawnBlood(transform.position, 20, 2f, 4f)

The y band NEVER reaches zero, so a chunk is always thrown upward.
Nothing sets a PhysicMaterial, so Unity's default bounciness of zero
applies: a chunk lands, it does not ricochet. At four seconds the
rigidbody and the collider are destroyed and the quad freezes where it
lies.

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
   eleven call sites across five files and IS the event "blood happened
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
2. **BLOOD1b - the blow, the scatter, overkill, gibs, ceilings and
   the swing.** SHIPPED, whole (`src/combat/bloodGibs.js` joined the
   modules above; `tools/mutants/blood1.json` 118/118 dead).

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

   THEN THE GIBS (`src/combat/bloodGibs.js`), on the re-read above.
   Ten chunks, the assembly's own throw, three times UNITY'S gravity -
   not three times the port's own 20, which is DFU's number for a
   walking body and has nothing to do with a thrown chunk - the drag,
   the four-second freeze, and the twenty-particle splat where each
   one hits. No bounce, because nothing sets a PhysicMaterial and the
   engine's default bounciness is zero.

   A CHUNK IS A POINT THAT RAYS ITS OWN STEP. `gibStep` answers a
   segment and commits nothing; the host rays it and then says fly or
   land. That is the same split `bloodDecals.js` keeps and it is what
   lets the whole arc be driven on a table with no collider at all.

   IT NEEDS NO DEATH SEAM, which is the one place this port is simpler
   than the reference rather than poorer. The reference defers to
   `EnemyDeath.OnEnemyDeath` because Unity's death is a separate event
   and it wants its sound on that frame; a blow for 175% of a body's
   whole health is always lethal, so here the hit IS the death - and
   four hosts are spared a wire each of them would have had to
   remember. The chunks then ride `hitEffects.tick`, the call every
   host already makes each frame, for the same reason the origin shift
   rides `offsetAll`.

   THE GIBS RIDE THE OVERKILL ROW rather than one of their own, and
   that is a departure from the reference's two settings worth
   stating: here a body can only come apart on the player's warhammer
   overkill, which that row already gates, so a second switch would be
   one that does nothing unless the first is on.

   WHAT HAS NOWHERE TO GO, and is not carried:

   - **THE SPLASH SOUND.** The reference ships its own audio, which
     this port has no permission to use, and ARENA2 has no blood or
     splat clip - `SplashLarge` is water and `BodyFall` is a thud.
     There is no deferral to build because there is nothing to defer.
   - **THE CORPSE SWAP.** The reference hides the body and puts its
     own corpse-explosion prefab where it stood. The port ships no
     gore art and will not, so hiding the body would be a regression
     rather than a port: a body that vanishes reads worse than one
     that lies there.

   AND THE CHUNKS GOT A QUAD (Mac, 2026-09-20: "So why dont you
   create it"). "It needs art we do not have" was overstated: the art
   is TEXTURE.380, the archive the splash and the mark already come
   from and the one the player's own ARENA2 supplies. A chunk wears
   its FIRST frame - the mark takes the settled stain because that is
   what a stain looks like, and a chunk in the air is the burst - at
   0.28m, a size that reads as a piece rather than a splash still
   playing. The port still ships no gore art of its own.

   THE QUADS ARE WRITTEN, NOT REBUILT, and that is why
   `renderer.moveBillboardBatch` now exists. Destroy-and-rebuild is
   what `hitEffects.offsetAll` does and it is right for a splash that
   moves once in a recentre; ten chunks at sixty frames is 2,400 batch
   rebuilds for ONE death, each a VAO and two buffers. The move writes
   the vertices and the bounds and nothing else - and the bounds
   MATTER, because `_bbVisible` culls on the batch's own sphere and a
   chunk leaves the sphere it was born in within a frame or two.

   The DYNAMIC hint is taken at birth, because a buffer's usage hint
   cannot be changed afterwards; every other batch in the tree stays
   STATIC. The corner table has ONE home (`BB_CORNERS`), since the
   birth bakes the corners and the move rewrites them and the two
   disagreeing about the winding would tear every moved quad.

   The batch is exactly as long as the flight - a billboard quad has
   no per-vertex size, so there is no blanking a spare one the way an
   empty decal slot is blanked - so it is built on the throw and ended
   by name when the last chunk comes to rest, and again in `dispose()`
   for a flight still in the air. The camera basis is handed IN,
   because a billboard needs one and this pool has no camera; every
   host already holds both at the line it calls from.

   AND THE BLOOD REACHES THE CEILING. One drop in four looks UP
   instead of down - the reference's particles fly in every direction
   and the ones that go up find the ceiling, but this port RAYS, so
   the share has to be a number rather than something that emerges,
   and by INDEX rather than by chance so a spray always has some of
   both. Drop zero never does: it is the pool under the body. A drop
   that went up and met something that is not a ceiling leaves
   nothing, because blood does not stick to a wall it hit from below.
   The reach up is longer than the reach down (4 against 3), because
   blood spawns at chest height: the floor is close and the ceiling is
   not.

   WHAT A CEILING HOLDS IT LETS GO OF. Each ceiling mark hangs a DRIP,
   which is a chunk with no throw at all - three times gravity, the
   drag, the four-second freeze and the splat where it lands are all a
   chunk's, because a falling drop and a falling piece fall the same
   way and a second integrator would be a second thing to get wrong. A
   drip carries a DROP: one mark where it lands, against a chunk's
   twenty particles' worth. It gets no quad - a chunk is a piece of a
   body and reads at 28cm; a drip at that size is a water balloon - so
   it falls unseen, and what a player sees is the floor beneath a
   ceiling stain darkening a moment later. Mutants: 106, 106 dead.

   AND LAST, THE SWING THROWS THE SPRAY. `SpawnBlood` rotates its
   particle system to the PLAYER's rotation and pushes it with a
   `forceOverLifetime` chosen by the live `WeaponState`; the IL
   switches on `state - 1` with six arms, and against the port's own
   enum (`fpsWeapon.js` STATE_INDEX, which is DFU's order) they read:

   | state | push | what it looks like |
   |---|---|---|
   | StrikeDown | y +2..+4 | a straight chop sprays it back UP |
   | StrikeDownLeft | y -5..-10, x -5..-10 | down and to the left |
   | StrikeLeft | x -5..-10 | to the left |
   | StrikeRight | x +5..+10 | to the right |
   | StrikeDownRight | y -5..-10, x +5..+10 | down and to the right |
   | StrikeUp | z -2..-8 | an upward cut throws it back at you |
   | Idle, anything else | nothing | |

   `SWING_PUSH` is the MIDPOINT of each band, in the player's own frame
   (x their right, y up, z their forward), and its keys are checked
   against `STATE_INDEX` so an entry for a state the machine cannot be
   in fails rather than sitting dead.

   THE VERTICAL TERM IS DROPPED, and `StrikeDown` is the case that
   shows that is right rather than a shortcut: its whole push is
   upward, so the spatter is thrown NOWHERE - a straight chop sprays
   straight up and it comes straight back down. A mark lies on a
   SURFACE, so an up or down push changes how long blood is in the air
   rather than where on the floor it lands, and modelling that would
   mean flying the spray, which this arc flies only for the chunks.

   The conversion from the reference's force to the port's metres is a
   CHOICE, not a derivation - its number is a force on a particle over
   its lifetime and ours is a displacement - so `SWING_LEAN` says so:
   a full side swipe leans the spatter about two thirds of a metre.

   THE HANDEDNESS IS THE TREE'S, taken from the forward handed in
   rather than from a yaw, because the sites that know one do not all
   hold the other: forward is (sin yaw, ., cos yaw) and right is
   (cos yaw, 0, -sin yaw), which is (f.z, 0, -f.x). THE POOL DOES NOT
   LEAN - drop zero is blood running off the body, not blood thrown
   from it, so it stays at the body's own spot whatever the swing did.

   EXACTLY THREE SITES HAND A SWING OVER: the player's melee in each
   of the three foe pools, each of which holds both halves at the line.
   THE SHAFT DELIBERATELY DOES NOT. The reference reads the LIVE
   weapon state when blood spawns, which for an arrow that has been in
   the air is whatever the player's arm happens to be doing now - a
   quirk of reading a global at spawn time, not a thing to carry. A
   shaft's blood is thrown by the shaft.
   **THE AUDIT (2026-09-20, Mac: "Lets do a comprehensive audit on
   everything so far"), and what it found.**

   BLOOD NEVER APPEARED INSIDE BUILDINGS. `worldModes.js` builds an
   interior pool like the other three hosts, hands it to the splash
   pool, ticks it every frame and clears it on the way out - and never
   DREW it. Every mark laid in a shop, a tavern or a house was
   computed, written into a GPU buffer and never rendered. The comment
   three lines above that pool says "the whole payload - sound,
   knockback, death, corpse, loot AND the splash - runs indoors
   exactly as it does in the other three hosts."

   THE FOUR HOSTS PIN IS WHY IT WENT UNSEEN, and the failure is worth
   keeping: it counted four draws, and the fourth was worldModes
   drawing the DUNGEON'S pool. Nothing asked whether worldModes drew
   its own. Four hosts, four pools, three draws, and a pin that
   counted to four on the wrong objects. The replacement is by
   BINDING, not by count: it walks `src/`, finds every
   `const X = createBloodMarks(`, and holds that each X is drawn by
   that same name and under its host's own sprites.

   THREE MORE:

   - **DISPOSE WAS NOT TERMINAL.** A `place` or `tick` after teardown
     ran `ensure()` and minted a fresh ring and GPU batch on a pool
     nobody would free again - HARD1 from the other end: not a thing
     freed twice, but a thing BUILT after its owner had gone.
   - **THE ART COULD ARRIVE AFTER THE THROW.** `_gibArt` is set when a
     splash's texture resolves, and on the first blood of a session
     that lands after `place` has thrown. The batch was built with no
     art and nothing built it again, so a player whose first blood was
     a warhammer overkill watched ten invisible chunks fly.
   - **`[].every()` IS TRUE**, so with no chunks and a drip still
     falling the bare guard reseated every frame. It no-opped, which
     is how it went unseen; the mutation of it is recorded EQUIVALENT
     rather than pinned, because nothing outside the pool can see it.

   The flight stopped allocating with it: the chunks' centre list is
   built once with the batch and holds the chunks' OWN `pos` arrays,
   which every writer mutates in place - pinned both ways, since a
   writer that replaced an array would leave every chunk drawing at
   its birthplace for ever. Two stale records went with them: this
   file and `bloodMarks.js` both said "eight call sites across four
   hosts", a count taken before the arc reached the peer and fall
   seams. It is eleven, across five files.

   Mutants: 130, 129 dead, 1 equivalent as recorded.

   **THE SECOND AUDIT (2026-09-20, Mac: "I want you to audit the new
   blood system we integrated"), and what it found.**

   THE BLOOD DID NOT GO WITH THE WORLD. `world.js`'s `_teleportToPixel`
   is the ClearStreamingWorld twin: a fast travel, a quickload and
   every teleport go through it. It clears the live foes, the guards,
   the missiles and the arrows, destroys every pixel and then
   `state.init`s a NEW scene frame - mapOrigin moved, x/z compensation
   zeroed - with no recentre offset for anything to ride. The splash
   pool and its ring were the one world-space thing it did not clear,
   so every mark, chunk and drip laid before the jump kept its old
   local coordinates in the new frame: a fight's blood at the same
   spot in the next town, floating or buried wherever the ground
   differed. The interior host clears its pool on every door for
   exactly this reason; the world host's door now does the same, and
   it is a FREE rather than a double free - that pool is built with no
   `onSpawn`, so it owns its splash batches, where the dungeon's hands
   every batch to its billboard list and must never make the call
   (HARD1's own catch, recorded at its teardown).

   READ AND CLEARED, so the next audit need not re-read them:

   - The interior ring rays the room it is in: `player.collider` is
     swapped onto the interior's collider at both doors (worldModes
     4801/5443) and back at both exits, and the ring reads it by a
     getter.
   - A drip born on a ceiling never lands on that ceiling: its first
     ray starts ON the plane and `rayTriangle` refuses t under 1e-4.
   - The puppet-side sites (a peer's blow, seen here) measure against
     the puppet's own `maxHealth`, and `damagePercent` answers 0 to a
     zero one - a record that has not carried the number yet stains at
     the bottom rung, never the top, and never the burst (which is the
     player's alone).
   - The decal pass: depth-tested, depth-unwritten, blended, cull off
     (a ceiling mark is seen from behind its normal), fog on the same
     terms as the flats. An empty ring draws nothing; a full one is one
     draw of capacity quads with the empty slots degenerate.

   **AND THE ONE THAT WAS NOT CLEARED - MAC-BUG W6** (Mac, pushing:
   "super dark coloring instead of red"). The first pass of this audit
   read the decal shader and called it sound. It is sound ON THE
   CLASSIC SET, and the port ships with the Enhanced Lighting lane on:
   under the lane the renderer decodes every colour it uploads to
   linear, and the decal - "a fifth classic program with no lane twin",
   as W4 pinned it - drew an undecoded texel times that linear light
   with no exposure, tonemap or encode. Measured beside a sprite: dusk
   25 against 69, a dark dungeon 2 against 17. The decal has its twin
   now (`EL_DECAL_FS`, the flat's model on the lane's pipeline, the
   shadow read along the mark's own surface), the renderer builds it
   as the set's fifth program, and the probe reads both sets.
   bible/01-Overview/Mac-Bugs-W.md W6 carries the whole of it. The
   lesson for the next audit is written there too: "the pass renders
   correctly" is a claim about a SET, and the shipped default is the
   lane.
   - The four hosts' lifetimes: the world and exterior hosts are page
     lifetime and never dispose (nothing else of theirs does either);
     the dungeon disposes by name; the interior clears at every door.

   TWO LATENCIES RECORDED RATHER THAN PAID:

   - THE RING HOLDS ONE TEXTURE KEY. `useArt` overwrites it on every
     upload, so a second blood record would repaint every mark in the
     last record's colour. `enemyBasics.js` carries exactly two
     values - 0 and the bloodless 2 - so today there is no second
     record and nothing to see. A per-mark record would split the one
     draw into one per texture; it is a slice if a second record ever
     comes.
   - ~~`blood-capacity` AND `blood-density` HAVE NO ROW. Both are read,
     clamped and pinned, and both are reachable from the store alone:
     the feature registry's rows are toggles, and a slider is a slice
     of its own.~~ PAID by BLOOD2g (item 11): the two keys are
     retired for the one `blood-gore` tier, which has its row.

   Mutants: 133, 132 dead, 1 equivalent as recorded.

   **THE THIRD AUDIT (2026-09-20, Mac: "I think this deserves a real
   audit. I doubt there's only one issue" / "the blood system needs to
   be as visceral and detailed as possible. I noticed inconsistencies
   with blood with the exterior and super dark coloring instead of
   red") - three Opus lenses (the pure law; the pool, the splash pool
   and the hosts; the renderer and the collider), every finding
   verified against the code before it was paid, and paid.**

   THE DARK MARKS were MAC-BUG W6 (Mac-Bugs-W.md): the lane. THE
   EXTERIOR'S INCONSISTENCIES were several things at once, each below.

   THE POOL AND THE HOSTS:

   - THE DUNGEON'S RING WAS DRAWN TWICE A FRAME in the world-hosted
     dungeon (worldModes drew it by handle, and `drawFoes` drew it
     again behind its own gate) and ONLY WHILE A FOE, A DROP OR A SPELL
     WAS ALIVE in the standalone `?dungeon` host, which had no draw of
     its own - clear the level and the floor went clean, and a
     warhammer overkill on the last foe threw ten chunks nobody saw.
     The hosts own the pass now, once each, beside the level's flats;
     the context draws its own ring nowhere.
   - THE BLOODLESS GATE WAS BYPASSED AT THE FALL SITES. EnemyMotor's
     fall damage splashes record 0 for every foe (its own literal), and
     the two generic sites handed that 0 to the marks too - a skeleton
     walking off a ledge left a pool. The hit carries `markIndex`, the
     foe's own; the splash stays record 0.
   - THE DUNGEON'S SPLASH POOL HAD NO DEAD LATCH. `entry.dead` is set by
     retire() alone and the dungeon never called clear() (HARD1's first
     pass put one BELOW the destroy loop and it was a double free). A
     splash whose archive was still warming when the dungeon went
     minted a batch into the orphaned list. The clear goes ABOVE the
     loop: retire() splices each batch out before freeing it, so every
     batch is freed exactly once and every warming entry is dead first.
   - THE SWITCH GATED PLACEMENT ALONE: off mid-fight, the marks stayed
     drawn and the chunks finished their flight. It gates the draw and
     drops what is in the air now.
   - THE RING WAS BUILT AT FIRST BLOOD, not at boot as bloodSwitch.js
     said, so the capacity read was whatever the store held then and
     four pools could hold two sizes. Built at construction.
   - A RECENTRE MOVED THE CHUNKS BUT NOT THEIR QUADS until the next
     tick - the host shifts, draws, then ticks - so they drew one frame
     819.2 units behind. The quads move at the shift.

   THE PURE LAW:

   - THE WHOLE CAPACITY WAS DRAWN for a ring holding three marks. The
     pool keeps a high-water mark and hands the pass its RANGES.
   - ...AND IN SLOT ORDER, so once the ring wrapped the OLDEST marks
     composited last, over the newest - the burst over its own pool,
     the one ordering this module argues for at length. The ranges are
     in age order: [next, cap) then [0, next).
   - THE WOBBLE WAS 0.9 RADIANS on a 15-degree slot at the top rung:
     the even turn the comment argues for was swamped and every big
     spray had drops on top of each other. It is nine tenths of the
     slot now, whatever the count.
   - `parent` WAS A DEAD FIELD - stored, never read, and pinned under
     the title "a mark can ride a moving body". Gone, and the pin says
     so.
   - `?blood=off` DID NOT EXIST though the switch's comment promised
     it. It does.
   - THE GUARDS: a NaN capacity threw at the array; a NaN size wrote
     twelve NaN floats into the slot; a non-finite delta poisoned every
     mark in place; `swingThrow('constructor')` answered NaN off the
     prototype; `throwGibs(.., Infinity)` looped for ever; `shiftGibs`
     fell over a hole. Each refused now.
   - THE GIB ARC WAS FRAME-RATE DEPENDENT: explicit Euler at the frame's
     dt, so a chunk thrown at 10 m/s peaked at 1.58 m at 60 fps and
     1.19 m at 10 fps. It integrates at Unity's fixed step (0.02, whole
     steps only, the remainder carried) and is the same list of points
     on every machine.
   - Two comments corrected (the top rung lands EXACTLY on SPRAY_MAX;
     a spray under four drops never looks up).

   THE RENDERER AND THE COLLIDER:

   - THE CLASSIC DECAL HAD NO CLOUD-SHADOW TERM where every other
     classic world shader has one, and the deck rides a different pref
     from the lane: with Environments on and Lighting off the ground
     went dark under a cloud and the blood on it stayed bright. It has
     the term.
   - THE LIGHT CAP WAS THE LANE'S, NOT THE PROGRAM'S: a foreign lane
     with no decal twin would have run the classic sixteen-slot program
     under forty-eight and uploaded forty-eight into a vec4[16]. The
     set carries the cap its decal program declares.
   - A MARK ON STREAMED TERRAIN LAY ON THE BILINEAR HEIGHT, and the
     terrain is drawn as two triangles a quad - up to 0.08 apart on
     real grades (terrainSurface.js measured it), four times the 2cm
     lift. On a hillside a mark lay clipped into the slope on one half
     of a quad and floated over it on the other. The collider takes a
     second sampler, `surfaceAt`, for what is PLACED (surfaceHit and
     groundNormal); the world host hands it the grass placer's own
     `surfaceHeightAt`; the capsule keeps its floor. THIS is the
     exterior inconsistency a player on a hill would have seen.
   - THE SPRAY RAYED THROUGH WALLS: the drop's XZ is the body's plus
     the offset plus the throw (four metres and more for an overkill),
     cast straight down from there. A foe killed against a partition
     sprayed the next corridor. A ray from the body to the drop first;
     a drop that would pass through something lands nowhere.
   - THE RAY WALK ALLOCATED per bucket per ray - the bucket translation
     (the no-`out` overload streamingWorld.js had already named as
     measurable GC) and the box test boxing its origin - and the blood
     multiplies rays: 72 a hit, 74 a frame for four seconds after an
     overkill. One array a bucket; the origin read in place.
   - The lane twin's derived normal could be NaN edge-on; it takes up.
     It decoded the PRODUCT of texel and tint; each on its own now.
     `drawDecals` reaches `.subarray` with drawTerrain's own guard.

   Pins: 48 in test/blood1_decals.test.js (eight new, the rest re-aimed
   where a law changed), the lane's set in test/el1_enhancedlighting
   .test.js. Mutants: tools/mutants/blood1.json is 161 now - 160 dead, 1 equivalent as recorded (twenty-nine of them this audit's, each one a finding above put back); the W4, W5 and W6 campaigns re-run beside it, 27 dead, 1 equivalent, with the four whose anchors this audit moved re-spelled.

3. **BLOOD1c - bleeding.** The 2..5s cadence and the ramp above.

4. **BLOOD2a - blood on walls, and spatter along its travel.** SHIPPED
   (2026-09-21, Mac: "Any way we can improve this to make it even more
   visceral and detailed?" / "Lets do it"). The first of the slices
   the third audit's closing note listed, and the two that read as the
   biggest change per line.

   THE WALL IS STAINED. AUDIT 3 gave the spray a ray from the body to
   each drop so blood could not pass through a partition, and dropped
   the drop. The reference flies particles that meet the wall FIRST
   and stain it; so does this now - a drop that would have had to pass
   through something lands ON it, at the point it met it, facing the
   way it came (the collider's normal is already turned to the ray).
   A wall mark is round: a spurt meeting a wall head-on spreads. Every
   corridor fight marks its walls at the height of the wound.

   SPATTER LIES ALONG ITS TRAVEL. A drop flung from the body lands
   elongated the way it flew, the further the longer - which is what
   cast-off blood is, and what a round dot never read as. The pool
   gained `basisAlong` (the travel projected onto the surface as the
   quad's `right`, the same right-handed frame surfaceBasis makes, so
   the winding and the lift are every other mark's) and a `stretch`
   the quad writer applies along `right` alone; `streakFor` runs from
   round at the body to STREAK_MAX (2.5, the port's own) at the spray's
   reach, clamped past it. The pool under the body flew nowhere and
   stays round; the ceiling's drops are streaks like the floor's; a
   drop dead-on to its surface (nothing of its travel in the plane)
   takes the spun basis it always had.

   Pins: three (the basis, the streak and the writer, a whole spray)
   and the wall pin re-aimed - the wall LOSES no drop now, it takes
   them, and a stub that clamped a beyond-reach wall to a hit at the
   reach was corrected while doing so. Mutants: 10, 10 dead
   (`tools/mutants/blood1.json` is 171).

5. **BLOOD2b - the port's own blood art, made at boot, and marks that
   dry.** SHIPPED (2026-09-21). BLOOD1a wore the splash animation's
   settled frame for every mark - one picture stamped six hundred
   times, in one colour, for ever. The port still ships no blood
   picture; it MAKES one now.

   THE ATLAS (`src/combat/bloodArt.js`): a 256-wide RGBA sheet, one
   row a kind (four kinds here, five since BLOOD2d's print) in four
   variants, generated from noise by a seeded generator
   (mulberry32, so it is the same picture on every boot and a pin can
   name a texel) the first time a pool asks, and uploaded ONCE through
   the renderer's own texture cache under a port-own pseudo-archive
   (38001, above every classic number), LINEAR-sampled so a splat's
   edge is soft. Every cell keeps a clear two-texel border and an
   inset UV rect so a soft sample cannot read its neighbour. The kinds:
   a POOL (broad, irregular, darker at the heart - the drop under the
   body), SPATTER (a blob with satellite dots - cast-off that landed
   short of a third of the reach), a STREAK (a head at -u and a tail
   toward +u - a drop that flew, laid along BLOOD2a's `right`, so the
   tail points away from the body), and a DRIP (a bead high in the
   cell and a run down to its foot - a wall's mark, laid with `turn:
   0`, which on a vertical surface puts the basis' up at world up so
   the run hangs down). Every opaque texel is blood red (the base a
   shade deeper than TEXTURE.380's own 168,16,16, so a lit mark is not
   pink), with grain.

   EACH MARK ITS OWN SHADE: born with a fresh tint near white whose red
   wanders half as far as the other two, so the variance reads as wet-
   or-dark and never as a hue - the tint the quad writer has always
   carried and the lane decodes on its own since W6/AUDIT 3.

   AND IT DRIES. The pool keeps a clock; every DRY_TICK (2 s) each live
   mark's stage is read off its age - DRY_STAGES (8) steps over
   DRY_TIME (180 s) - and one that crossed a stage takes its new tint
   (the fresh tint sliding to DRIED_TINT, landing on it TO THE BIT at
   the last stage - BLOOD AUDIT 4 found the tint shipped here made a
   black-red, not a brown, and moved the colour out of the texels; see
   item 8) and has its slot rewritten. Eight
   rewrites over a mark's life, never one a frame, and none once
   dried. A mark laid later is born at the clock, not at zero.

   Pins: two (the atlas - kinds, borders, insets, coverage bands,
   red, determinism, no picture loaded; the pool - kinds by role (`bloodMarkKind` - `markKind` is inkMap.js's name), the
   wall's run hung from world up, the tint in the slot's floats, the
   drying driven through DRY_TIME with the rewrites counted and
   bounded, dried never rewritten, a late mark born now, a recentre
   keeping the cell) and the settled-frame pin re-aimed. Mutants: 16,
   15 dead and ONE SURVIVOR the record here first called dead
   (`tools/mutants/blood1.json` is 187) - the recentre pin read the
   decal's own field and never the buffer; BLOOD AUDIT 4 (item 8)
   re-aimed it to the floats and the mutant dies.

6. **BLOOD2c - a wounded body bleeds, a dead one bleeds out.** SHIPPED
   (2026-09-21). The arc's BLOOD1c was to be the reference's PLAYER
   bleeding; this turns that shape on the FOES first, because a foe
   cut to half its health should leave a trail you can follow, and a
   foe you killed should lie in a pool that spreads.

   THE LEDGER (`src/combat/bloodBleed.js`, pure): the reference's own
   ramp - `clamp01(1 - (pct - 1) / (threshold - 1))`, nothing at the
   threshold and everything at one percent - over BLEED_THRESHOLD
   (half, the port's own) and the reference's cadence (every 2..5 s,
   random). A drip is `max(1, round(share x BLEED_DROPS_MAX))` drops
   (six at most; the reference's forty particles are not marks). A
   body healed past the threshold starts a fresh wait when wounded
   again. The first frame a body is seen dead WITH A CORPSE - a
   quest-removed foe, a culled one, a watchman who walked away has no
   body and leaves no pool - one pool at its feet. A bloodless body
   neither drips nor pools. State rides a WeakMap keyed by the body.

   THE MARKS: `drip` lays the drops within BLEED_RADIUS of the feet,
   rayed down from KNEE height (a foe on a stair stains its step) at
   the gib's small rate, capped at BLEED_DROPS_CAP, and NEVER looks up -
   a drip is gravity's; `spreadPool` lays one pool-cell mark at the
   feet at POOL_SIZE.start and the pool's tick grows it to
   POOL_SIZE.end over POOL_SPREAD (12 s) in POOL_STEPS (8) rewrites,
   drops it the moment the ring reuses its slot, bounds the spreads
   at MAX_SPREADS, and clears them with the room.

   THE SEAM: `hitEffects.bleed(dt, bodies, view)` - the three foe
   pools hand the bodies they already walk every frame (puppets
   included: they carry health and death) through a six-field view
   `{ feet, health, maxHealth, bloodIndex, dead, corpse }`, and the
   dungeon's two kill paths mark the body a corpse (its quest removal
   does not). No wire, no save.

   Pins: two (the ledger's law end to end; the drip, the spread, the
   splash pool's mapping, the three hosts by source). Mutants: 22, 21
   dead, 1 equivalent as recorded - the threshold guard the clamp
   already answers (`tools/mutants/blood1.json` is 209).

7. **BLOOD2d - tracked blood: a walker who treads in it leaves prints.**
   SHIPPED (2026-09-21). Blood that stays where it fell is a picture;
   blood that follows you is a scene. A foot that comes down IN a wet
   floor mark picks it up, and the next TRACK_STEPS (6) steps each lay
   a boot print of it - alternating feet PRINT_SPREAD (0.13) either
   side of the walk, the toe the way the walker went, a share fainter
   each step - and then the foot is clean again.

   THE ART (`src/combat/bloodArt.js`): a fifth atlas row, `print`,
   a boot shape drawn heel-to-toe along +u; `bloodMarkKind({ print })`
   names it, and the atlas is `cell x ATLAS_KINDS.length` tall so a
   sixth row costs a name and a shape.

   THE LAW (`src/combat/bloodMarks.js` `step(walker, pos, forward)`):
   the walker is a KEY (the player is `PLAYER_WALKER`, a foe is its own
   body) into a WeakMap of `{ left, side }`. The foot is `pos` rayed
   down MARK_DROP, so the eye, the capsule centre and the feet all
   find the same floor. Wet is a floor mark (normal up, `stage` no
   drier than TRACK_WET_STAGE = 2 of the eight) that is NOT a print,
   and the foot within `size / 2` of its centre and half a metre of
   its height - so a print is never a trigger (a walk would otherwise
   feed itself forever), and blood two ticks dry is a stain and not a
   puddle. Standing in it while carrying REFRESHES the count and
   prints nothing over the pool. The print's fade rides the tint's
   alpha - `fresh[3] = left / TRACK_STEPS` - and drying keeps it,
   because the dry tint interpolates from `fresh`.

   THE STEPS: the player's footstep machine already knows when a foot
   comes down (`_step` in world, exterior, dungeon and the interior
   modes); the same line now calls `hitEffects.footfall(player.pos,
   facing)` beside the step that plays. A foe's feet are streamed,
   not stepped, so the bleed ledger counts a `step` off the ground a
   body covers - one every STRIDE (0.7 m), facing the way it went; a
   run of eight strides in one frame is a teleport and not a walk.
   The ledger's actions are now `drip | pool | step`.

   Pins: one (the player's tread, pick-up, six alternating fading
   prints, the clean foot after, no trigger from a print or from dry
   blood, the refresh, the foe's stride through the ledger, the four
   hosts by source) and the atlas pin re-aimed to five rows. Mutants:
   12, 12 dead (`tools/mutants/blood1.json` is 221).

8. **BLOOD AUDIT 4 - four lenses over BLOOD2a..2d, paid.** (2026-09-21,
   Mac: "I just want to audit everything so far before we continue.")
   Four read-only lenses - the pure laws, the marks runtime and the
   renderer, the host seams and online, the colour path end to end and
   the records - and every finding below verified here before it was
   paid. Nothing in this item was merged; it waits on the branch with
   the rest.

   THE BUGS:
   - PRINTS NEVER LANDED INDOORS. `step` rayed down from `pos`, and
     every host hands the walker's FEET - so on a mesh floor the ray
     started ON the triangle, the walk refused a hit inside its own
     epsilon, and no walker ever printed underground or in a building.
     Outdoors the drawn ground sits above the capsule's bilinear floor
     on every quad of positive twist, so half the world's quads dropped
     the print the same way. The ray starts at the KNEE now, as the drip
     and the corpse's pool always did (`DRIP_FROM`), and the pin drives
     a real Collider with a mesh floor and a twisted terrain pair.
   - DRIED WAS A BLACK-RED. `DRIED_TINT` 0.5/0.36/0.34 was a multiply
     over a texel already painted 0.58/0.05/0.04, and a multiply cannot
     raise a channel: dried blood came out at half the brightness and
     MORE saturated (G/R 0.082 fresh, 0.059 dried), on every mark older
     than three minutes, for the rest of the session. THE ATLAS IS INK
     NOW - the shape and its grain in white - AND THE TINT IS THE
     COLOUR: `BLOOD_BASE` fresh, `DRIED_TINT` a rust (0.30/0.13/0.09,
     about the fresh red's luminance, browner), both inside the curve
     so the lane's decode of ink times tint is the decode of the
     product. Fresh varies as ONE factor on all three channels (a
     shade, never a hue - the red used to wander half as far as the
     rest, which made the darker marks the more saturated ones), and a
     mark dries AT ITS OWN SHADE (`freshShade`).
   - BLOOD ON THE BOOTS CROSSED DOORS. `clear()` emptied the ring and
     not `_tracks`; the player's key is one frozen object for the page,
     so a walker who left a shop mid-trail printed the street. The map
     is replaced on `clear()`, and the ledger's memory with it
     (`hitEffects.clear()` calls `bleeding.clear()`).
   - A FOE KILLED TWICE POOLED ONCE. The ledger's `pooled` latch never
     cleared, and the dungeon's load and the online stream un-death a
     foe IN PLACE. Alive clears it. And a body FIRST SEEN DEAD - a
     restored corpse, a re-entered room, a foe a peer killed before the
     ledger was born - has bled out elsewhere and lays no pool; feet
     with a NaN in them skip the frame rather than spending the pool on
     a point the ring refuses.
   - A TELEPORT WAS A FRAME-RATE. "More than eight strides in one
     frame" read a 6 m/s foe as a walk at sixty frames and a teleport at
     one, and a texture hitch erased a running foe's trail. It is a
     SPEED now (`TELEPORT_SPEED`, 40 m/s); the steps come off the ground
     covered ALONG the run, as many as it holds, where the feet passed,
     and the remainder carries.
   - THE RECENTRE MUTANT SURVIVED. The BLOOD2b pin read `d.uv` off the
     record, which the recentre never touches; dropping the cell from
     the buffer write passed 56 pins. The pin reads the slot's floats.
   - THE DUNGEON QUICKLOAD KEPT THE BLOOD. The world clears on every
     teleport and the interior on every door; the dungeon context is
     reused across its own quickload and cleared nothing, so the
     abandoned timeline's marks, chunks, drips and the pool spreading
     under a corpse about to stand up all stayed. `restoreSaved` clears.

   THE LIGHT: A DECAL HAS A NORMAL. W4 lit the mark as a flat ("a decal
   has no normal, exactly as a billboard has none"): the sun's
   Lambert-average half, lanterns attenuation-only. A mark lies ON a
   surface, and the surface takes N.L - so a mark on a sunlit floor and
   one on a shaded wall were the same brightness while the floor and
   the wall were not, which is the outdoor inconsistency Mac reported.
   Both decal programs read the quad's normal off its derivatives (the
   lane's had since AUDIT 3, for its shadow lookups alone) and take THE
   MESH'S terms: the sun by N.L under the cloud and the sun map, the
   lanterns and the indirect by N.L (on the lane through `elPointLit` /
   `elIndirectLit` - the lantern's map, the contact shadow, the glint;
   wet blood glints). `drawDecals` uploads the whole sun and its
   direction. `tools/bloodProbe.mjs` reads the mark against a MESH
   facing the eye now (the surface it lies on), not the flat beside it,
   and reads the ATLAS under the real tints: fresh at noon
   154/13/10 classic and 113/8/6 on the lane; dried 80/34/23 and
   61/24/15 - a rust, not a black.

   THE UPLOADS: THE RING'S MIRROR. Every slot write was its own
   `bufferSubData`: a fight's marks share a birth and crossed each dry
   stage on the same tick (a thousand calls in a frame, eight times a
   cohort), a recentre rewrote every mark one by one, and a door
   blanked every slot - nine hundred calls of dead work, since the
   ring's ranges are empty after `clear()` and a slot outside them is
   never rasterised. Writes land in a CPU mirror of the buffer and name
   their slot dirty; `flush` uploads each contiguous run of dirty slots
   as one call, nothing between them. A dry cohort is one call, a
   recentre one, a clear none, a print one write (its fade dressed in
   rather than rewritten). The spread's "is this still my mark" and the
   step's walk read slots (`at`) rather than allocating the ring as an
   array - per frame for twelve seconds a corpse, per footstep of every
   walker. The atlas is built when first worn (seventy milliseconds off
   the boot path), and the ring, the batch and the upload wait for the
   row to be ON.

   THE SMALLER ONES: `drawDecals` counted its texture bind twice; a
   drip's outer drops wore a streak (gravity's blood does not fly);
   `BLEED_RATE` was a second copy of `GIB_SPLASH_RATE` and imports it;
   the floor test in `step` names `CEILING_DOT` rather than a second
   0.7, and a wall's mark under the foot does not make it wet; the
   named numbers (STRIDE, STREAK_MAX, POOL_SPREAD, TRACK_WET_STAGE and
   its boundary, TELEPORT_SPEED) are pinned as literals so the arc's
   text cannot drift from them. STILL OPEN, said plainly:
   ~~`blood-capacity` and `blood-density` are prefs keys no registry row
   writes (the registry has no range control yet - the gore slider is
   the next slice), so every player runs the defaults~~ (paid by
   BLOOD2g, item 11: one `blood-gore` tier with a row); the decal fog
   term mixes the fog colour into a blended fragment as every classic
   pass does; the host wiring pins are adjacency pins.

   Pins: seven (the knee ray on a real mesh and a twisted terrain; the
   room's clear over boots and ledger; the ledger's second life, the
   body met dead, the NaN feet, the speed guard, the steps along the
   run at one frame and at sixty; the floor test and the drip's
   streaks; the runs - a cohort one call, a recentre one, a clear none,
   the cell in the buffer; nothing per frame and the ON gate; the
   quickload clear, the hosts' bleed at the top of their updates, the
   bind count, the literals), the W4/W6/AUDIT 3 shader pins re-aimed to
   the surface's terms, the BLOOD1a/2b/2c/2d pins re-aimed to runs and
   ink. Mutants: 31 new, 31 dead; 26 records re-aimed by content
   (`tools/mutants/blood1.json` is 252, `macbugw4.json` and
   `macbugw6.json` re-aimed).

9. **BLOOD2e - the player's own blood.** SHIPPED (2026-09-21). The
   reference bleeds the PLAYER (THE FACTS, "Player bleeding": below
   the threshold, every 2..5 s, a spawn ramped from nothing at the
   threshold to everything at one percent, with an optional subtle
   red flash, suppressed at zero health), and BLOOD2c turned that
   shape on the foes first. This is the player's.

   THE DRIPS: `hitEffects.bleedPlayer(dt, feet, entity)` - the same
   ledger, keyed by PLAYER_WALKER, read through a view of the
   entity's health at the feet the host hands; `strides: false`
   (the footstep machine lays the player's prints - BLOOD2d - so the
   ledger counts none, or every stride would print twice) and no
   corpse (a dead player is the death screen's, not a pool's; at zero
   health the ramp is zero and the ledger's dead branch has no body).
   The four hosts call it beside the pool's tick they already make.
   Walking while bleeding leaves the trail behind you; standing, a
   stain that grows.

   THE WAIT IS THE POOL'S: the ledger is per pool and `hitEffects.clear()`
   replaces its memory, so a door (the interior pool clears on every
   one) restarts the player's 2..5 s wait; the world pool clears on
   teleport and load alone. A player who door-hops a street faster than
   a wait never drips indoors, which is the shape the foes have too.

   THE FLASH: each drip that lands calls `flashPlayerBleed()` - the
   damage flash's own quad at BLEED_FLASH_ALPHA (0.12, under a third
   of a blow's 0.4), the same red and the same fade, and it never
   LOWERS a blow's flash still fading. No RemoveHealth: a drip is not
   a blow, the shaker does not hear it.

   THE LENS (`src/ui/bloodScreen.js`) - the port's own; the reference
   has no screen blood. A blow that takes SCREEN_SPATTER_MIN (a tenth)
   of a life in ONE FRAME - read off the vitals detector the HUD
   already runs, VitalsChangeDetector.HealthLostPercent, which
   CameraRecoiler reads for the same reason - throws `screenDrops`
   (one at the threshold to SCREEN_DROPS_MAX = 5 at half a life) onto
   the screen: the atlas's own spatter cells (white ink) blended in
   BLOOD_BASE, each its own place, size (a share of the canvas HEIGHT,
   the same drop on a phone and a monitor) and turn, sliding down
   SCREEN_DROP_SLIDE over SCREEN_DROP_LIFE (2.5 s) and fading over the
   last SCREEN_FADE_SHARE of it. Capped at SCREEN_DROPS_CAP (12),
   oldest first. One singleton, ticked and drawn by `drawHud` - the
   one host-agnostic call, after the detector and above the `!art`
   return, for the damage flash's reason. Its own row,
   `blood-screen` (ON, the player's own online): the one piece of
   blood that is in the player's face rather than on the floor.

   Pins: two (the ledger without strides; the seam - the wait, the
   drip's count and place, the subtle flash, a blow's flash standing,
   drips and no prints while walking, nothing well, nothing and no
   pool dead, the four hosts by source; the lens' law, the drops'
   place, size, cell and cap, the draw's blended red quads sized by
   the height, the slide and the fade, gone at the end, no art no
   quad, the row and the HUD's one call by source). Mutants: 17, 17
   dead (`tools/mutants/blood1.json` is 269).

10. **BLOOD2f - the wet sheen.** SHIPPED (2026-09-21). Fresh blood is
   WET, and wet reads as a glint: the lamp seen in it. Without one a
   mark is paint. The lane has had a low gloss on stone since EL4
   (EL_SPEC_GLOSS 24, EL_SPEC_STRENGTH an eighth of the light); a wet mark takes a far
   tighter, far brighter one - EL_WET_GLOSS 64, EL_WET_STRENGTH 0.9 -
   from every lantern in range (Blinn-Phong on the quad's own normal,
   the lantern's shadow, the squared falloff, ITS colour) and from the
   sun (under the cloud and the sun map), ADDED after the albedo
   multiply, because a highlight is the light's colour and not the
   blood's. The classic set has no specular at all and ignores it.

   THE FLOAT: the slot is pos3 + uv2 + rgba4 + WET1 now (ten floats a
   corner, `DECAL_FLOATS_PER_VERTEX`), the tenth `decal.wet` - one at
   birth, `wetAt(stage)` on every dry rewrite, so the sheen rides the
   eight rewrites the colour already has and costs no upload of its
   own. AND THE SHEEN GOES BEFORE THE COLOUR: fresh blood loses its
   gloss in the first minutes and its red over the rest, so the
   wetness falls as the SQUARE of what is left (WET_POWER 2 - half
   dried is a quarter wet), and a fully dried mark is exactly the
   AUDIT 4 line. A mark that says nothing is dry (the probe's parity
   quads).

   `tools/bloodProbe.mjs` reads it: the same fresh mark wet and dry
   under a torch on the lane (wet brighter on every channel - the
   lamp's white in the green and blue) and in the sun, and on the
   classic set wet equal to dry to the byte.

   Pins: two (the law, the writer's tenth float and its clamp, born
   wet, a quarter at half dried in the record AND in the buffer on the
   dry pass's own rewrite, dry at the end, a print born wet; the
   attribute and the varying, the classic shader ignorant of it, the
   lane's sun glint and lantern glint term for term, dry meaning no
   loop, the probe's rows) and the layout pins re-aimed to ten.
   Mutants: 9, 9 dead (`tools/mutants/blood1.json` is 278).

11. **BLOOD2g - the gore dial.** SHIPPED (2026-09-21). The last of the
   seven. BLOOD1 read the particle-amount fraction and the ring's
   capacity off two prefs keys that no registry row ever wrote (item 2
   said the registry's rows were toggles and a slider was a slice of
   its own; BLOOD AUDIT 4 said the keys were dead), so every player
   ran the defaults. The registry has had a stepped control since FT2
   (`tiers`), and how much blood there is IS a stepped question. ONE
   key now, `blood-gore`, four tiers (`GORE_TIERS`): Light (half a
   blow's blood reaches the floor, 300 marks), Normal (all of it, 600
   - the defaults, so nothing changes for anyone who never touches
   it), Heavy (1500), Abattoir (4000, the ring's ceiling). The two
   numbers are the tier's and are read nowhere else; the old keys are
   retired, not aliased - two sources of one truth is what AUDIT 4
   found. Anything stored that is not a tier is Normal. The amount
   takes effect at once (`scaleRate` reads the density live, and its
   floor of one still means less blood and never none); the count
   when the game is next reloaded - the streaming world, the exterior
   and the interiors build their pools once a page, and only a dungeon
   builds its own on entry (BLOOD AUDIT 5 corrected "when the world
   next loads"). Its row is `blood-gore` (ON at Normal, the
   player's own online), and the home draws it as the four-segment bar
   every tiered row gets (the cycling chooser is the other panes').

   Pins: one (the tiers' law and bounds, the retired keys, the row's
   tiers naming every tier and the default, the shelf's stored tier
   read live, the pool sized by the tier). Mutants: 6, 6 dead
   (`tools/mutants/blood1.json` is 284).

12. **BLOOD AUDIT 5 - four lenses over BLOOD2e..2g and AUDIT 4's own
   fixes, paid.** (2026-09-21, Mac: "Lets audit this".) The player's
   blood and the lens; the wet sheen and the ten-float slot; the gore
   dial and the records; and an adversarial re-read of AUDIT 4's
   fixes. Every finding verified here before it was paid; nothing
   merged.

   THE BUGS AND RISKS:
   - THE LENS SPATTERED ON A LOAD. The vitals detector resets when a
     maximum changes or on its own unpriming, and an in-place save
     load (the world's quickload, the dungeon's restore) writes the
     entity's health without either, so the difference between the
     live health and the save's read as ONE FRAME'S LOSS - the recoil,
     the near-death tint and now the lens all fired on it; a surrender
     (health set to one) the same. Two fixes, both DFU's own: the lens
     needs a BLOW - the damage flash's RemoveHealth latch (`takeBlow`,
     answered once), which an enemy's hit, a trap and a fall raise and
     a spell, a load and a surrender do not - and the detector RESETS
     on load (`resetVitalsDetector`, VitalsChangeDetector.cs:139-158),
     beside the camera recoiler's own reset at both load sites. The
     hudVitals header that said the load flows navigate was stale and
     says why now.
   - THE PLAYER BLED UNDER A WINDOW. Three hosts passed the real dt
     with the inventory open, so drips landed and the flash pulsed
     under the modal; the dungeon arm did the opposite. The three
     pass the host's own pause word (a held overlay is dt 0), and the
     world hosts hand the feet they hand everything else (the camera
     in fly mode and before the spawn).
   - THE MOON WAS STILL THE FLAT'S HALF. AUDIT 4 paid the sun, the
     lanterns and the indirect by N.L and left W4's moon folded into
     the ambient at its Lambert half: at night outdoors a mark on a
     wall facing away from Masser glowed against an unlit wall. Both
     decal shaders take the moon by N.L (`uDecalMoon`, `uMoonDir`) and
     the trilight ambient (BA1) as the mesh does; the tint upload is
     the bare ambient.
   - THE BLOOD-OFF GATE UNDID AUDIT 3. AUDIT 4 built the ring only
     with the row on, so a player who booted with blood off got a ring
     sized by whatever the store held when a drop first landed - the
     fault AUDIT 3 removed, harmless while the keys were dead and LIVE
     once BLOOD2g made a dial of them (two hosts alive at once took two
     sizes). The ring is built at boot again; what waits for the first
     mark is the atlas (`wear`), which was the cost.
   - `ensure()` re-minted the ring - and now the mirror - on every drop
     when a renderer's batch came back empty; it latches on the pool.
     `dispose()` keeps no mirror. A surface the knee ray meets more
     than STEP_ABOVE (0.25) above the feet - streamed feet inside a
     step - is not the floor, for the print and the corpse's pool.
   - THE GLINT PAID ITS SHADOWS TWICE. The wet loop repeated the
     lantern shadow lookups the diffuse loop had just made (and
     answered a different shadow for a non-caster), and the sun glint
     re-read the nine-tap sun map. ONE lantern loop
     (`elPointLitWet`, the glint beside the diffuse on the same
     shadow and falloff, the pow skipped where the mark is dry;
     `elPointLit` is its dry case) and ONE sun visibility for both.
     Also said plainly, from the lens's geometry: a torch in the hand
     can glint a floor mark only underfoot (the half-vector never
     bisects otherwise); the sheen is a wall sconce's and a standing
     lantern's effect, and a wall mark's in the sun.
   - The dry cohort and a spread stepping in the same tick flushed
     twice; they share one. The gore row's effect said "when the world
     next loads" of three pools that live a page; it says when. A
     stored value that is no tier showed the FIRST segment on the home
     while the game ran Normal; the tile and the chooser show the row's
     default. The capacity clamp is over a closed vocabulary now and
     its mutant is recorded equivalent.

   Pins: four (the blow latch and the detector reset, driven; the
   lens's newest-first cap, its band, the no-flash-without-a-landing,
   the literal 0.12; the ring minted once, the mirror gone with
   dispose, the step and the pool refusing a surface above the feet,
   the one flush; the menu's default and the effect's wording by
   source), the W4/W6/2b/2e/2f/AUDIT 4 pins re-aimed (the moon and
   the trilight, the atlas at the first mark, the one sun read, the
   folded loop, the hosts' paused dt, the literal drip count).
   Mutants: 23 new, 23 dead; 19 records re-aimed by content and one
   recorded equivalent (`tools/mutants/blood1.json` is 307;
   `macbugw4.json`, `macbugw6.json` and `el4.json` re-aimed).

13. **BLOOD3 - the film and the sheen.** SHIPPED (2026-09-21, Mac: *"I
   think the blood is too shiny and flat"*). Two complaints, two
   causes, and neither was the art.

   FLAT. The decal's albedo was `ink * tint`, and the ink atlas is
   WHITE - RGB is `shade * grain`, alpha is coverage. Multiply a white
   grain by one tint and every texel of a pool comes out the same red:
   a sticker, whatever the brush did. Blood is not a colour, it is a
   FILM, and a film's colour is its depth: Beer-Lambert,
   `tint * exp(ABSORB * (1 - thick))`, anchored so that FULL thickness
   is exactly a no-op - which is the whole reason the AUDIT 4 parity
   law ("a mark is lit as the wall it lies on") survives this slice
   untouched. `BLOOD_ABSORB` is `[0.50, 0.95, 0.95]`: red passes, green
   and blue are absorbed near twice as hard, so a thinning smear
   brightens AND WARMS toward orange, which is what blood does and what
   makes a flat shape read as depth. Deep `0.580 0.050 0.040` goes to
   `0.956 0.129 0.103` at the rim.

   AND THE THICKNESS IS NOT THE ALPHA. The first cut used `t.a` and
   the law cancelled itself out - visible in the probe's picture, not
   in any pin. Alpha is also what the mark is BLENDED by, so the thin
   rim the film brightens is the rim that is fading out, and the solid
   body has no variation left to read. The ink's grain is the density
   the atlas already carries: `thick = t.a * t.r`, coverage times
   density. Both decal shaders take it, off the one imported constant.

   SHINY. `EL_WET_STRENGTH` was 0.9 - nine tenths of the lamp,
   wherever the half-vector lined up, at ANY angle. That is the
   reflectance of polished plastic, and it is why a wet mark read as a
   white patch. A liquid film is SCHLICK: `F0 + (1-F0)*(1-n.v)^5` with
   water's F0 = 0.02 (n = 1.33). Two per cent head-on - the case the
   player sees most, a mark underfoot - and most of the light only at
   a graze. What is left after Fresnel is `EL_WET_STRENGTH` 0.55, and
   the sheen is gated by the mark's own DEPTH as well
   (`smoothstep(0.15, 0.75, thick)`), so a dried rim does not shine
   while its body is still wet. ONE number feeds both the lantern
   glint and the sun's - one wetness, not two.

   THE MENISCUS. (Read with slice 15: the NAME is right - this is the
   curve a liquid stands in - but "a pool has a raised edge, so its rim
   catches light" is not what the code computes, and a picture was
   finally made of it there.) The thickness gradient is two extra atlas
   taps (one texel along each axis) turned into a world-space slope
   through the quad's OWN tangent frame, solved from `dFdx/dFdy` of
   the world position against the same of the UV; the normal tilts
   AWAY from the rise (`n - slope * 0.85`) - a bank of liquid, not a
   dent. It is computed BEFORE `sunVis`, so the shadows and the sun
   read the bumped normal and not the flat one, and it is guarded on a
   non-degenerate frame and a non-flat patch, so a quad seen edge-on
   divides by nothing.

   The classic set takes the FILM only (it has no specular at all and
   never had); the lane takes all three. `tools/bloodProbe.mjs` reads
   the whole frame now and bands it by thickness: the lane's marks
   come back deep `132,13,9` against thin `72,8,6` - warmth 0.083 to
   0.101 - and the wet checks hold at `wet 137,25,23 vs dry 136,15,12`
   with red keeping a 5.48x lead over the glint. 31 of 31 checks pass
   on a real GPU.

   Pins: three. Re-aimed: THREE, not the two this line said until the
   audit counted them - the classic shader's film in W4, the lane's
   albedo and lantern term in W6, and the strength, the sun glint and
   the probe's strings in 2f. Mutants: 14, 14 dead.

   **READ THIS SLICE WITH SLICE 14.** Three of the claims above are
   wrong and were paid there: the film ran BACKWARDS (the sheet's ink is
   a darkening, not a density, so this brightened what the art had
   darkened); the meniscus differenced two different quantities and was
   a fixed tilt rather than a rim; and a thinning film DESATURATES, it
   does not "warm toward orange". The degenerate-frame guard this slice
   claims covered the UV frame only, and the 31/31 it rests on included
   a film check that was measuring alpha.

14. **AUDIT BLOOD3 - three lenses, and the slice was wrong.** (2026-09-21,
   Mac: *"audit this real quick. Make sure it's perfect"*.) It was not.
   Three lenses went over the shaders and the GPU, the art laws and the
   atlas, and the pins, mutants and records. Two of them found the same
   headline defect independently, and a third confirmed it from the
   records' side. Every finding below was verified against the source
   before it was paid.

   **F1 - THE FILM RAN BACKWARDS. The ink is not a density.**
   `shapeAt`'s own docstring said what the sheet holds - *"shade a
   darkening toward the heart of a pool"* - and every shape obeyed it:
   pool `0.82 + 0.18 * smooth(0, edge, r)`, drip `0.85 + 0.15 * along`,
   streak, print and spatter all put their MINIMUM ink at their
   THICKEST point. That is the art hand-painting depth as a grey
   darkener. BLOOD3 read high ink as thick, which is the same quantity
   with the sign reversed, so the film brightened hardest exactly where
   the art had darkened and erased most of the depth cue it was written
   to add. The ink was also still an albedo factor, so the sheet's one
   grey channel was being spent TWICE, in opposite directions.

   The fix is at the source, and it is exact. `shapeAt` answers a
   DEPTH now (1 at a heart, 0 at a rim). The painter writes
   `ink = 1 - INK_DEPTH * (depth * grain)` - one shared ramp, because a
   per-kind amplitude is not invertible - so the ink keeps the range
   (0.82..1.0) and the sense it always had. That matters: the player's
   own blood lens draws this same sheet through the plain 2D quad, which
   has no film and no business acquiring one, and it is untouched to the
   byte. Both decal shaders now recover the thickness with one line,
   `(1.0 - t.r) / INK_DEPTH`, and neither multiplies by the ink any
   more. The grey darkening WAS the film, done by hand in one channel;
   the film does it now, per channel, properly.

   **F2 - THE MENISCUS MEASURED A GRADIENT OF TWO DIFFERENT THINGS.**
   The two taps read the neighbours' bare `.a` and subtracted the
   centre's `t.a * t.r` - residue from the first cut, where `thick` was
   alpha alone. That is not a difference: it leaves a constant pedestal
   over a mark's whole body, where the true gradient is zero, which is a
   fixed tilt along one atlas diagonal on every mark, several times the
   rim signal it was meant to measure. It fed the diffuse, the shadow
   lookup's normal offset, the moon, the trilight ambient and the
   Fresnel. Both taps recover the same field the centre does now, and
   the `dot(duv, duv) > 0.0` guard - which the pedestal had made
   permanently true - does something again.
   Also in that block: `dFdx`/`dFdy` sat INSIDE the branch, where GLSL
   ES 3.0 leaves a derivative undefined, while line 642 had already
   computed exactly those two values. One pair now, hoisted, which also
   pays two redundant derivative ops. And the guard tests the WORLD
   frame as well as the UV one - without it a quad whose world
   derivatives are parallel hands `normalize()` a zero vector and throws
   away the AUDIT 3 fallback as NaN.

   **F3 - THE TWO LANES APPLIED THE FILM IN DIFFERENT COLOUR SPACES.**
   The lane decodes to linear and encodes at the end; the classic set
   has no decode and no encode and works in display space end to end. A
   gain of G shows there as G and here as G^(1/2.2), so the same
   constant made a mark's thin rim up to 1.7x brighter under the classic
   set - MAC-BUG W6's fault with the sign reversed, on a line W6 had
   left parity-correct. `BLOOD_ABSORB_ENCODED` is the exponent over
   `DISPLAY_GAMMA`, and the pin drives both and asserts they show the
   same gain on the screen.

   **F4/F5 - "LESS SHINY" HAD BECOME "NOT WET".** Schlick for a
   SPECULAR lobe is F(V.H), not F(N.V). BLOOD3 shipped the latter,
   hoisted out in front of every light, where a `(N.H)^64` lobe peaks in
   a different regime entirely - so the case the player sees most, a
   mark underfoot with a torch at head height, went from 0.9 of the lamp
   to 0.018. The angle now sits beside each light's own half-vector
   (`wetFresnel`, one call, used by the lantern loop and the sun alike)
   and `sheen` is the wetness gated on depth and nothing else.
   And the cue that actually reads as wet from above is not a highlight
   at all: a wet surface is DARKER and richer, because the light goes
   into the film before it comes back. `WET_DARKEN` carries that. A
   Fresnel specular without it is a highlight nobody standing up can
   see, which is what BLOOD3 shipped.

   **F6 - the depth gate did not bite.** Against the old ink the
   `smoothstep(0.15, 0.75, thick)` sat above 0.93 over 93-97% of every
   mark, so the "wet core, dry rim" was never delivered; nothing pinned
   it, because the pins only related the two ends to each other. Against
   a real depth the band is the full 0..1 and the gate does its job. The
   pin now asserts where the band SITS, not just that it is ordered.

   **F7 - the film desaturates; it does not "warm".** `BLOOD_ABSORB`
   gives green and blue the same absorption, so a thinning mark holds
   its hue and loses its depth of colour - toward pink, never toward
   orange. BLOOD3's record and its pin both said "warms", and the pin's
   own metric was a saturation measure. Said correctly now, and the
   green:blue ratio is pinned invariant.

   **F8 - a latent JS/GLSL desync that its own pin reproduced.** The
   shader interpolated `${(1 - BLOOD_F0).toFixed(2)}` and the pin
   asserted the same expression, so the two agreed by construction and
   would have stayed green through any F0 that does not round to two
   places. It interpolates the constant itself now.

   **WHAT THE VERIFICATION WAS ACTUALLY DOING.** BLOOD3 reported 31/31
   on a real GPU. The lenses took that apart, and they were right to:
   - the probe's FILM check banded the frame BY RED, which sorts a
     mark's alpha-faded rim into the "thin" bucket. It reported a 1.83
     spread that the film cannot produce at all - its whole range on red
     is `exp(0.5) = 1.65` - so it was measuring alpha, and would have
     passed with the film deleted. It bands BY RADIUS now, two rings
     both well inside the silhouette at full coverage, where only the
     film can differ; and a third check bounds the gain, so
     `BLOOD_ABSORB` has a picture constraining its size for the first
     time.
   - the parity fixtures had been moved from red 168 to 255 to make
     five failing checks pass. 255 was ink at ZERO thickness - the
     film's maximum gain - and the checks passed only because the law
     was inverted too. They are shot at 209 now, which is
     `255 * (1 - INK_DEPTH)`: the value the sheet itself holds at the
     heart of every pool, where the film is anchored and is a no-op by
     construction rather than by convenience.
   - the sun's wet row had been relaxed from "+20 on all three" to
     ">= on two", which a build with the sun glint DELETED satisfies
     exactly. It has a margin again.
   - three pins were re-aimed in the BLOOD3 commit, and the record
     said two.

   **AND THE PIN THAT WOULD HAVE CAUGHT F1.** Nothing in BLOOD3 ever fed
   a real atlas texel to the new laws: three pins drove synthetic
   numbers and the fourth read the shader's source. `BLOOD3 depth` walks
   the sheet now - every kind, every texel - and asserts the sheet is
   still white ink (so the lens cannot be broken silently), that the
   recovered thickness spans the whole range at full coverage, and that
   it FALLS away from each shape's own deep end. Pool -0.97, spatter
   -0.77, drip -0.58 against their anchors; inverted, those are about
   +0.9, which is what the shipped code was doing.

   THE RUN, on chromium/SwiftShader: **33 of 33**. The film is in the
   picture for the first time - classic heart `192,16,13` against its
   shoulder `223,22,17` (red gain 1.164, saturation falling 0.076 ->
   0.088), lane heart `136,14,10` against `152,23,18` (gain 1.118,
   0.090 -> 0.133). The two lanes read different gains ON PURPOSE and
   the row says so: the classic set shows it straight, the lane applies
   it in linear and then tonemaps, which is F3 seen from the other
   side. And the wet rows carry both halves - under a torch
   `142,40,39` wet against `156,19,16` dry, the lamp's colour arriving
   in green and blue while the red FALLS; at noon, head on, where
   Schlick gives about two per cent, `119,12,9` against `134,13,9`: no
   highlight at all, just the darkening. A build with BLOOD3's
   any-angle glint fails that pair now.

   The first run of this came back **18/33**, and every failure was the
   probe rather than the code: the parity fixture carried its red in
   the TEXTURE and tinted itself white, which no decal in the game
   does - so once the ink stopped being an albedo factor it compared a
   white mark against a red wall. The fixture takes its colour from the
   tint now, as a mark does.

   Still not covered by a picture: the meniscus. It is pinned by source
   - the taps, the tangent-frame solve term for term, its placement
   before the sun visibility, both guards - and killed by four mutants,
   but no probe row draws it. Said here rather than implied away.

   Pins: four (the film's law, its clamps, the two lanes' gain agreeing
   on the screen, and the absolute size of the absorption; the sheet
   walked per kind; the gate's band, Schlick's fifth power at V.H, and
   the wet darkening; both shaders by source, the recovery, the
   meniscus's frame, the one derivative pair, both guards). Re-aimed:
   the W4 classic film, the W6 lane albedo, the lane's normal, the 2f
   lantern and sun glints, and EL4's half-vector (the eye vector is
   hoisted out of the light loop now - it was rebuilt up to 48 times a
   fragment). Mutants: 28, 28 dead (`tools/mutants/blood3.json`); three
   records re-aimed by content in `blood1.json` and `macbugw6.json`.

15. **AUDIT BLOOD3, TWO LEFT OVER.** (2026-09-21, Mac: *"Whats the
   meniscus"*, then *"Might aswell"* - make the picture.) Both came out
   of trying to photograph the one part of the slice that had none.

   **F9 - A DIAL AT A WHOLE NUMBER TOOK THE SHADER OUT.** To shoot the
   meniscus against itself, `BLOOD_MENISCUS` was set to `0.0` - and the
   Enhanced Lighting decal program stopped compiling:
   `'*' : wrong operand types ... 'const int'`. JavaScript stringifies
   `0.0` as `"0"`, which is an INTEGER literal in GLSL, and `vec3 * int`
   has no overload. Every constant BLOOD3 and this audit interpolated
   was bare - `BLOOD_MENISCUS`, `WET_DARKEN`, `INK_DEPTH`, `BLOOD_F0`,
   `1 - BLOOD_F0`, `EL_WET_STRENGTH`, both absorption triplets - so any
   of them set to a round number was a runtime landmine under exactly
   the dials the record invites a reader to tune. The house already had
   the answer: `glslFloat` (airPass.js:206), which the lantern loop has
   used since EL5. Eleven interpolations routed through it, both lanes.
   Pinned by driving the shader build at an integral value, which is the
   only way to catch this - a text pin on the built string reads whatever
   the current value happens to produce.

   **F10 - IT IS A HEIGHT FIELD, NOT A RIM.** The picture (the same pool
   under a grazing sun, `BLOOD_MENISCUS` on against off, differenced):
   peak change 56 of 255 - so it is plainly doing something - but the
   change is TWICE as strong in the body as in the rim band, mean 10.7
   against 4.95. That is inherent to the shape. A pool's thickness is
   `1 - smoothstep(0, edge, r)`, and a smoothstep's gradient peaks in
   the MIDDLE of its ramp, not at its ends. So the term lights the mark
   as a relief of its own thickness - which is correct, and is what
   gives a pool volume - and a rim lip is one case of that rather than
   the point of it. The grain rides inside the thickness now, so it
   becomes fine surface texture too. Slice 13's "a pool has a raised
   edge, so its rim catches light a flat quad never could" described an
   effect the code does not have; one of the three lenses flagged the
   wording and it was carried into the record anyway. Said correctly
   here, in the shader, and in the index.

   So the meniscus HAS a picture now, and it is a probe row: the mark's
   lit result changes measurably when the term is switched off, and the
   row says where that change lands. That was the one gap this arc went
   to main with, and it is closed.

   Pins: two (every interpolated dial through `glslFloat`, driven at an
   integral value; the height-field wording by source). Mutants: 4, 4
   dead. Probe: 35 checks, 35 pass.

The numbers in THE FACTS are the target to feel like. The code that
hits them is ours.

## BLOOD4 — the colour, and the sameness that had two causes

Mac, from a lit interior (2026-09-22): *"So it looks reallt good, blood
could be a tad bit darker."* And, with a shot of a room's wall: *"youll
notice in the screen shot the repetition of the wall splatter. I think we
should introduce more variations."*

### The colour is a pure scale

`BLOOD_BASE` is its old self times 0.81 on all three channels. G/R is
0.085 where it was 0.086 — the hue does not move. "A tad darker" is a
luminance note; re-mixing the channels by eye would have answered a
question nobody asked, and every law downstream that reads the hue
(`freshShade`'s factor, the dried stain's relationship to the fresh red)
is untouched by a scale.

The pin that guarded the colour was a bare `BLOOD_BASE[0] > 0.5`. That
is a threshold, not a law, and the new red trips it while being exactly
as red as before. It is re-aimed onto what it always meant: inside the
curve, red by a wide margin, **the hue held**, and darker than the red
it replaced.

### Why a wall repeats where a floor does not

A wall mark is always the `drip` kind and always near-plumb — it has to
be, a run runs downward — so it has none of the freedom the floor's
marks take from the throw. Spatter and streaks get their angle and their
stretch from the swing; a wall gets nothing. Four cells were four
pictures, upright, for ever.

### The obvious half, and the half that mattered

Doubling `ATLAS_CELLS` to 8 (the sheet 512 wide, the cell still 64) is
the obvious half. **It would not have worked.** The pin written to
*measure* the result found the eight drips at **IoU 0.96** against each
other: `shapeAt`'s drip had exactly two degrees of freedom — the run's
length and its edge wobble — and neither moved the bead, the column or
the foot. Doubling a constant cannot vary a shape that does not vary.

Raising the count alone would have shipped Mac his own complaint back,
with a commit message claiming it was fixed.

So the shape gained the freedoms a real run has, each one visible:

| freedom | what you see |
|---|---|
| bead position and size | the spurt does not land in the middle of its own mark |
| **whether it ran at all** | a third never do — the biggest break in "every mark has a tail" |
| run length | over a wider range than before |
| lateral drift | a run wanders as it falls; the foot follows it |
| a fork | where the bead split |

Worst overlap is **0.76** now, and the covered area spans 244–581 where
it spanned 370–410. `pickCell` mirrors horizontally on top of that — 16
faces a kind, for no sheet at all — and returns a **new object** every
time, because the cells are shared by every mark already on the wall and
a swap in place would flip blood that is already up. `WALL_RUN_LEAN`
lets a run sit up to seven degrees off plumb, both ways.

### The catch was the depth

The first cut took the thickness from the run alone. That gave the bead,
the foot, and *every pixel of a no-run cell* a thickness of zero — the
deep end inside out — and BLOOD3's own depth pin caught it in one line,
because that pin walks the real sheet instead of synthetic numbers.

**A drop is a dome.** Its alpha ends at a hard rim; its thickness
feathers to nothing just inside that rim. That is what makes a bead-only
cell legal: even a mark that never ran carries the film's whole range,
instead of reading as the flat sticker BLOOD3 exists to have fixed.

### What the mutants bought

Three of the twelve **survived** the first run — the no-run case, the
dome, and the lean's direction. All three are pinned now because they
survived; none of them would have been pinned otherwise. The lean's one
needed a real sample: three wall marks cannot tell a two-way lean from a
one-way one, so the pin drives the splash until it has enough.

**The lesson:** the pin that measures is worth more than the change it
measures. Doubling the cell count *looked* like the fix, and the number
said it wasn't.
