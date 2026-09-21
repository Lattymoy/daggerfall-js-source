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
   - `blood-capacity` AND `blood-density` HAVE NO ROW. Both are read,
     clamped and pinned, and both are reachable from the store alone:
     the feature registry's rows are toggles, and a slider is a slice
     of its own.

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

   THE ATLAS (`src/combat/bloodArt.js`): a 256x256 RGBA sheet of four
   kinds in four variants, generated from noise by a seeded generator
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
   (the fresh tint sliding to DRIED_TINT, a dark brown-red, landing on
   it TO THE BIT at the last stage) and has its slot rewritten. Eight
   rewrites over a mark's life, never one a frame, and none once
   dried. A mark laid later is born at the clock, not at zero.

   Pins: two (the atlas - kinds, borders, insets, coverage bands,
   red, determinism, no picture loaded; the pool - kinds by role (`bloodMarkKind` - `markKind` is inkMap.js's name), the
   wall's run hung from world up, the tint in the slot's floats, the
   drying driven through DRY_TIME with the rewrites counted and
   bounded, dried never rewritten, a late mark born now, a recentre
   keeping the cell) and the settled-frame pin re-aimed. Mutants: 16,
   16 dead (`tools/mutants/blood1.json` is 187).

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

The numbers in THE FACTS are the target to feel like. The code that
hits them is ours.
