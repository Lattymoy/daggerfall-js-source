// @ts-check
// BLOOD1a - THE DECAL POOL: blood that stays where it landed.
//
// The port already draws the classic SPLASH - scenes/hitEffects.js is
// EnemyBlood.cs whole, a one-shot billboard from TEXTURE.380 at ten
// frames a second that plays and retires. What it has never had is the
// mark left behind. This is that: a fixed ring of oriented quads laid
// on whatever surface the blood met, recycled oldest-first.
//
// THE REFERENCE AND THE LINE (bible/05-Combat/Blood-Arc.md). The feel
// is measured off DaggerBlood 1.0.6a (Excoriated), which the port has
// NO permission to integrate: none of its code and none of its
// thirteen textures are here, and nothing in this file is a
// transcription of its assembly. What IS taken is a set of facts -
// numbers and orderings, which are nobody's to own - and the two that
// shape this module are:
//
//   - THE POOL IS A COUNT, NOT A LIFETIME. Its "how long blood stays"
//     setting is really "how many marks exist before yours is reused";
//     the ring below is that, and a decal is never retired on a clock.
//   - THE RATE LADDER is five rungs off damage over the target's max
//     health, and the density setting scales each rung with a floor of
//     one, so a player who turns the blood down never turns a hit into
//     nothing.
//
// NO RENDERER, NO GL, NO TEXTURE. This module answers WHERE a mark
// goes and WHICH one is next out of the ring; the host draws it. That
// split is the same one camp.js/camps.js keeps, and it is what lets
// every law here be driven on a table.

/** A hit for this share of the target's max health is an OVERKILL.
 *  Measured at 175, NOT the 200 the reference's own setting text
 *  claims - the text rounds and the code does not. */
export const OVERKILL_PERCENT = 175;
/** The three rungs with a ceiling of their own, off
 *  `damage / maxHealth * 100`, each INCLUSIVE at its top. */
export const RATE_LADDER = Object.freeze([
  Object.freeze({ upTo: 25, rate: 30 }),
  Object.freeze({ upTo: 50, rate: 50 }),
  Object.freeze({ upTo: 100, rate: 70 }),
]);
/** Past the last rung and short of the threshold: a hit that hurt. */
export const RATE_NEAR_LETHAL = 150;
/** At and past the threshold. THE LADDER'S TOP IS THE OVERKILL LINE
 *  ITSELF, which is why this is not a fourth row in the table above:
 *  the two are one number, and a table would let them drift apart. */
export const RATE_MAX = 200;
/**
 * THE OVERKILL BURST. Re-read off the assembly for BLOOD1b, and the
 * first reading was wrong TWICE - both corrections are here rather
 * than quietly fixed, because a fact the port builds on has to be one
 * a person can check.
 *
 * WRONG 1: "450 particles, then 350 more". The IL is an if/ELSE, not a
 * sequence. Which one fires depends on the WEAPON: 450 for a warhammer
 * (or the joke weapon below), 350 for everything else. A hit never
 * spawns both.
 *
 * WRONG 2: "at size 5..10". `SpawnBlood(pos, rate, a, b)` sets
 * `main.startSpeed = MinMaxCurve(a, b)` - a SPEED, not a size. The
 * decal sizes are fixed on the printer (0.05 default, 0.01..0.1
 * metres) and never vary with the blow at all. So what the burst's
 * 5..10 against the ordinary spawn's 1..5 buys is REACH: the same
 * blood thrown two and a half times as fast, which lands further out.
 */
export const OVERKILL_RATE_HEAVY = 450;
export const OVERKILL_RATE = 350;
/** The two speed bands, whose RATIO is the fact the port can use. */
export const OVERKILL_SPEED = Object.freeze({ min: 5, max: 10 });
export const ORDINARY_SPEED = Object.freeze({ min: 1, max: 5 });
/** 7.5 over 3 - the midpoints of the two bands above, and the whole of
 *  what the burst does to where the blood goes. */
export const OVERKILL_REACH_SCALE = (OVERKILL_SPEED.min + OVERKILL_SPEED.max)
  / (ORDINARY_SPEED.min + ORDINARY_SPEED.max);

/** THE WEAPON THAT ALWAYS THROWS THE BIG ONE. Item template 126 is the
 *  WARHAMMER - not a joke weapon, which the first reading assumed from
 *  the `"horse"` short-name test beside it. That second test is for a
 *  weapon some OTHER mod adds and this port does not have, so it has
 *  nowhere to go and is not carried; the warhammer is real here and
 *  is. */
export const HEAVY_WEAPON_TEMPLATE = 126;

/** `damage / maxHealth * 100`, or 0 where the target has no health to
 *  measure against (a divide by zero is not an overkill). */
export function damagePercent(damage, maxHealth) {
  if (!(maxHealth > 0) || !(damage > 0)) return 0;
  return (damage / maxHealth) * 100;
}

/** The ladder's particle count for a percent, before density. */
export function ladderRate(percent) {
  if (percent >= OVERKILL_PERCENT) return RATE_MAX;
  for (const rung of RATE_LADDER) if (percent <= rung.upTo) return rung.rate;
  return RATE_NEAR_LETHAL;
}

/** THE FLOOR IS THE POINT. `density` is the particle-amount setting as
 *  a fraction (0.1..1). A hit that lands always marks something, so a
 *  player who turns the blood right down gets less of it and never
 *  none of it - which is why this is `max(1, ...)` and not a bare
 *  multiply. */
export function scaleRate(rate, density = 1) {
  const d = Number.isFinite(density) ? Math.max(0, density) : 1;
  return Math.max(1, Math.round(rate * d));
}

/** The whole ladder in one read: how many marks this hit is worth. */
export const bloodRate = (damage, maxHealth, density = 1) =>
  scaleRate(ladderRate(damagePercent(damage, maxHealth)), density);

/** THE PORT'S OWN ART DIRECTION, and said to be: the reference scales
 *  its particles, not its marks, so these two numbers are a choice
 *  rather than a fact. A glancing blow leaves a spatter about a third
 *  of a metre across and a near-lethal one a bit over a metre, which is
 *  what a body's worth of blood looks like on a dungeon floor. */
export const MARK_SIZE_MIN = 0.35;
export const MARK_SIZE_MAX = 1.2;

/**
 * How wide the mark a hit leaves is, off the rate ladder's own band.
 *
 * ONE MARK PER BLOOD EVENT IS THE WHOLE OF BLOOD1a, and the rate sizes
 * it rather than multiplying it. The reference's rate is a PARTICLE
 * count and each particle that lands prints its own mark - so the
 * scatter is the particles' to bring (BLOOD1b), and inventing a
 * decals-per-hit law here would be inventing one to un-invent later.
 * The ring is a thousand marks; two hundred a hit would spend it in
 * five swings.
 */
export function markSize(rate) {
  const lo = ladderRate(0), hi = RATE_MAX;                 // the ladder's own ends, never a second copy of 30/200
  const t = Math.max(0, Math.min(1, (rate - lo) / (hi - lo)));
  return MARK_SIZE_MIN + (MARK_SIZE_MAX - MARK_SIZE_MIN) * t;
}

/**
 * BLOOD1b - THE SPRAY: how many marks one blood event leaves.
 *
 * BLOOD1a laid ONE mark per event and said in as many words that the
 * scatter was this slice's: "the reference's rate is a PARTICLE count
 * and each particle that lands prints its own mark, so the scatter is
 * the particles' to bring in BLOOD1b."
 *
 * This port flies no particles, and building a particle system to
 * decide how many marks to draw would be paying for a simulation to
 * answer a question that has a number in it. So the rate is read as
 * what it is - how much blood left the body - and the share of it that
 * reaches a surface is the PORT'S OWN number, said to be: most of a
 * spray goes onto the body itself, into the air, and onto walls out of
 * the ray's reach.
 */
export const SPRAY_SHARE = 0.12;
/** ...and never more rays than this in one event, whatever the ladder
 *  says. Each drop costs a raycast and an overkill is the worst case,
 *  so the ceiling is decided at the top of this file rather than at
 *  the bottom of a frame. At the ladder's top rung the share lands
 *  EXACTLY on it (200 x 0.12 is 24, in doubles too - BLOOD1 AUDIT 3
 *  corrected "just under"), so the cap shapes nothing a real hit does
 *  and catches a density setting or a future rung that would. */
export const SPRAY_MAX = 24;
/** How many marks a rate is worth. Always at least one: BLOOD1a's
 *  single mark is the FLOOR of this and not a case it replaced. */
export function sprayCount(rate) {
  if (!(rate > 0)) return 1;
  return Math.max(1, Math.min(SPRAY_MAX, Math.round(rate * SPRAY_SHARE)));
}

/** How far the spatter reaches, off the ladder's own ends - a graze
 *  spots the floor at the body's feet, a near-lethal blow throws it
 *  most of two metres. The port's own numbers again. */
export const SPRAY_RADIUS_MIN = 0.35;
export const SPRAY_RADIUS_MAX = 1.8;
export function sprayRadius(rate) {
  const lo = ladderRate(0), hi = RATE_MAX;                 // the ladder's own ends, never a second copy
  const t = Math.max(0, Math.min(1, (rate - lo) / (hi - lo)));
  return SPRAY_RADIUS_MIN + (SPRAY_RADIUS_MAX - SPRAY_RADIUS_MIN) * t;
}

/** How far a drop's angle may wander off its share of the circle, AS A
 *  FRACTION OF THAT SHARE. BLOOD1 AUDIT 3: this was 0.9 RADIANS - fine
 *  at the bottom rung's four drops (90 degrees apart) and nonsense at
 *  the top rung's twenty-four (15 degrees apart, wobbling 52), where
 *  the even turn the comment below argues for was wholly swamped and
 *  every spray had drops on top of each other. Nine tenths of a slot
 *  keeps neighbours from crossing. */
export const SPRAY_WOBBLE = 0.9;

/**
 * Where the i-th drop of a spray falls, as a horizontal offset from
 * the body.
 *
 * DROP ZERO IS ALWAYS THE BODY'S OWN SPOT. A hit stains where it
 * happened whatever else it does, which is what keeps BLOOD1a's single
 * mark as the floor of this and what a player who turns the density
 * right down still gets.
 *
 * The rest are laid on an EVEN angular turn with a wobble, not on a
 * random angle: random angles clump, and a clump of spatter reads as
 * one badly drawn mark rather than as a spray. The radius goes as the
 * SQUARE ROOT of the drop's share, which spreads them by AREA - a
 * linear radius piles them into the middle, where the pool already is.
 */
export function sprayOffset(i, count, radius, rng = Math.random) {
  if (!(i > 0)) return [0, 0];
  const n = Math.max(1, count);
  const turn = (i / n) * Math.PI * 2 + (rng() - 0.5) * SPRAY_WOBBLE * (Math.PI * 2 / n);   // BLOOD1 AUDIT 3: the wobble is a share of the slot, not an angle
  const r = (radius > 0 ? radius : 0) * Math.sqrt(Math.min(1, (i + rng()) / n));
  return [Math.cos(turn) * r, Math.sin(turn) * r];
}

/** A POOL AND ITS SPATTER, not one size of mark repeated. Drop zero is
 *  the pool under the body at the ladder's own size; everything around
 *  it is spatter and this is its share. */
export const SPATTER_SCALE = 0.45;
/** ...jittered, because a ring of identical marks reads as a stencil
 *  rather than as blood. (THE FACTS: the reference jitters its decal
 *  scale too, which is the one part of this the reading settled.) */
export const SIZE_JITTER = 0.3;
export function dropSize(i, rate, rng = Math.random) {
  const base = markSize(rate) * (i > 0 ? SPATTER_SCALE : 1);
  return Math.max(0, base * (1 + (rng() - 0.5) * 2 * SIZE_JITTER));
}

/**
 * BLOOD1b - THE BURST'S OWN SPRAY, laid BESIDE the ladder's and not
 * instead of it. The assembly runs `SpawnBlood(pos, rate, 1, 5)` under
 * both overkill branches AND under neither, so the ordinary spawn is
 * never replaced - the burst is a second spawn on top of it.
 *
 * Its own ceiling is higher than `SPRAY_MAX` for a reason the cap
 * would otherwise erase: 450 and 350 both come out past twenty-four,
 * so a shared cap would make a warhammer and a dagger leave the same
 * mess. An overkill is rare, spectacular, and worth the rays.
 */
export const BURST_DROPS_MAX = 48;
/** How much blood the burst throws: the heavy branch or the other one. */
export const burstRate = (heavy, density = 1) => scaleRate(heavy ? OVERKILL_RATE_HEAVY : OVERKILL_RATE, density);
/** ...and how many drops of it reach a surface. */
export function burstCount(heavy, density = 1) {
  return Math.max(1, Math.min(BURST_DROPS_MAX, Math.round(burstRate(heavy, density) * SPRAY_SHARE)));
}
/** THE SPEED IS THE REACH. The burst's particles start at 5..10 where
 *  the ordinary spawn's start at 1..5, and since the decal sizes never
 *  vary at all in the reference, that ratio is the WHOLE of what the
 *  burst does to where the blood goes. */
export const burstReach = (heavy, density = 1) => sprayRadius(burstRate(heavy, density)) * OVERKILL_REACH_SCALE;

/**
 * BLOOD1b - THE CEILING, and how blood gets there.
 *
 * `ParticleCollisionPrinter.HandleCollision`, read off the assembly:
 *
 *     var point  = e.intersection;
 *     var normal = e.normal;
 *     bool isCeiling   = Dot(normal, Vector3.down) > 0.7;
 *     bool aboveSource = point.y > particleSystem.transform.position.y;
 *     ... SetupDecal(...) ...
 *     if (GenerateCeilingDrips && isCeiling && aboveSource) {
 *       decal.transform.rotation = Quaternion.Euler(180, 0, 0);
 *       SpawnBloodDripParticles(normal);
 *     }
 *
 * So a ceiling is a SURFACE TEST, not a position test: a normal within
 * 0.7 of straight down, which is about forty-five degrees - a steep
 * overhang counts and a wall does not. The second test is what stops a
 * FLOOR under a source that is itself below it from being treated as
 * one.
 */
export const CEILING_DOT = 0.7;
/** `raycastHit` answers the normal already turned to face the ray, so
 *  a ceiling met by a ray going UP faces back down at it. */
export function isCeilingNormal(normal) {
  const n = unit(normal);
  return !!n && -n[1] > CEILING_DOT;
}

/**
 * WHICH DROPS OF A SPRAY LOOK UP.
 *
 * The reference's particles fly in every direction and the ones that
 * go up find the ceiling; this port rays instead of flying, so the
 * share that looks up has to be a number rather than something that
 * emerges. One in four, BY INDEX rather than by chance, so a spray of
 * four or more always has some of both and a test can say which -
 * and a spray of fewer has none (BLOOD1 AUDIT 3, said plainly: the
 * chunk's two-drop splat and the drip's one-drop splat never look up).
 *
 * DROP ZERO NEVER LOOKS UP. It is the pool under the body, and a hit
 * that stained the ceiling instead of the floor where it happened
 * would be the one drop of this arc a player would call a bug.
 */
export const CEILING_EVERY = 4;
export const looksUp = (i) => i > 0 && (i + 1) % CEILING_EVERY === 0;

/**
 * BLOOD1b - THE SWING THROWS THE SPRAY.
 *
 * `SpawnBlood` rotates its particle system to the PLAYER'S rotation
 * and then pushes it with a `forceOverLifetime` chosen by the live
 * `WeaponManager.ScreenWeapon.WeaponState`. The IL switches on
 * `state - 1` with six arms, and against the port's own enum
 * (`fpsWeapon.js` STATE_INDEX, which is DFU's order) they read:
 *
 *   StrikeDown       y +2..+4      a straight chop sprays it back UP
 *   StrikeDownLeft   y -5..-10, x -5..-10
 *   StrikeLeft       x -5..-10
 *   StrikeRight      x +5..+10
 *   StrikeDownRight  y -5..-10, x +5..+10
 *   StrikeUp         z -2..-8      an upward cut throws it back at you
 *   Idle, anything else            nothing
 *
 * The table below is the MIDPOINT of each band, in the player's own
 * frame: x is their right, y is up, z is their forward.
 */
export const SWING_PUSH = Object.freeze({
  StrikeDown: Object.freeze([0, 3, 0]),
  StrikeDownLeft: Object.freeze([-7.5, -7.5, 0]),
  StrikeLeft: Object.freeze([-7.5, 0, 0]),
  StrikeRight: Object.freeze([7.5, 0, 0]),
  StrikeDownRight: Object.freeze([7.5, -7.5, 0]),
  StrikeUp: Object.freeze([0, 0, -5]),
});

/** THE PORT'S OWN, and said to be: how far a unit of the reference's
 *  push moves a spray. Its number is a force on a particle over its
 *  lifetime and ours is a displacement in metres, so there is no
 *  conversion to derive - only a choice. A full side swipe (7.5)
 *  leans the spatter about two thirds of a metre, which is enough to
 *  read as "it went that way" and not so much that the blood leaves
 *  the body behind. */
export const SWING_LEAN = 0.08;

/**
 * Where a swing throws a spray, as a HORIZONTAL offset [dx, dz].
 *
 * THE VERTICAL TERM IS DROPPED, and deliberately. A mark lies on a
 * surface; an up or down push changes how LONG the blood is in the
 * air, not where on the floor it lands. Modelling that would mean
 * flying the spray, and this arc flies only the chunks - which is why
 * `StrikeDown`, whose whole push is upward, throws the spatter
 * NOWHERE and is still the right answer: a straight chop sprays
 * straight up and it comes straight back down.
 */
export function swingThrow(state, forward) {
  const p = Object.hasOwn(SWING_PUSH, state) ? SWING_PUSH[state] : null;   // BLOOD1 AUDIT 3: a frozen object still has a prototype - 'constructor' answered a function and the maths NaN
  if (!p) return [0, 0];
  // The push is in the player's frame, so it needs their basis - and
  // only the FLAT part of it, since the answer is a ground offset.
  const f = unit([forward?.[0] ?? 0, 0, forward?.[2] ?? 0]);
  if (!f) return [0, 0];
  // HANDEDNESS (mat4's law): the tree builds forward as
  // (sin yaw, ., cos yaw) and right as (cos yaw, 0, -sin yaw), which
  // is (f.z, 0, -f.x). Taken from the forward handed in rather than
  // from a yaw, because the sites that know one do not all hold the
  // other.
  const rx = f[2], rz = -f[0];
  return [(rx * p[0] + f[0] * p[2]) * SWING_LEAN, (rz * p[0] + f[2] * p[2]) * SWING_LEAN];
}

/** DFU's `bloodIndex` of 2 is the BLOODLESS six (skeletons and the
 *  like), and `characters/enemyBasics.js` has carried it from DFU
 *  since long before this arc. They bleed nothing, so they mark
 *  nothing - the splash record the port already draws for them stands,
 *  and no stain is laid under it. */
export const BLOODLESS_INDEX = 2;
export const marksBlood = (bloodIndex) => (bloodIndex ?? 0) !== BLOODLESS_INDEX;

/** At or past the threshold. */
export const isOverkill = (damage, maxHealth) => damagePercent(damage, maxHealth) >= OVERKILL_PERCENT;

/**
 * BLOOD1b - THE HIT A MARK IS MEASURED BY, SPELLED IN ONE PLACE.
 *
 * BLOOD1a shipped the ladder and nothing drove it. `showBloodSplash`
 * took the blow as its fourth argument and not one of the eleven call
 * sites passed it, so every mark in a real game came out of
 * `damagePercent(0, 0)` - the bottom rung, the smallest spatter, for a
 * dagger's graze and for a blow that took three quarters of a giant.
 * The pins drove the ladder on a table and the hosts never did.
 *
 * So the shape is here rather than at eleven sites, and
 * test/blood1_decals.test.js reads every `showBloodSplash(` in `src/`
 * and holds that each one hands its blow over. A site that forgets is
 * the failure this whole seam exists to make impossible.
 */
export function bloodHit(damage, entity, { fromPlayer = false, weapon = null, swing = null, forward = null } = {}) {
  return Object.freeze({
    damage: Number.isFinite(damage) ? damage : 0,
    maxHealth: Number.isFinite(entity?.maxHealth) ? entity.maxHealth : 0,
    // BLOOD1b, THE OVERKILL BRANCH. The assembly asks two more things
    // of a blow and both are decided at the site rather than here: was
    // the attacker the PLAYER (only the player's blow can take the
    // heavy branch) and was the weapon the WARHAMMER (which is what
    // takes it). A site that knows neither answers no to both, which
    // is the 350 branch - the one everything else takes anyway.
    fromPlayer: !!fromPlayer,
    heavy: (weapon?.templateIndex ?? -1) === HEAVY_WEAPON_TEMPLATE,
    // ...and WHICH WAY THE SWING THREW IT, worked out HERE rather than
    // carried as a state and a basis for the pool to combine. Only the
    // site knows both, the answer is two numbers, and a pool that took
    // the raw pair would have to know the tree's handedness to use
    // them - which is exactly the knowledge this module is kept clear
    // of everywhere else.
    throw: Object.freeze(swingThrow(swing, forward)),
  });
}

/** A blow that kills whatever it lands on, for the one site with no
 *  entity to measure against. WeaponManager.cs:504-508's wandering
 *  civilian dies to ONE weapon hit whatever the weapon was, so the
 *  share of their health it took is all of it - which the ladder reads
 *  as its hundred rung, not as an overkill. */
export const LETHAL_HIT = Object.freeze({ damage: 1, maxHealth: 1, fromPlayer: true, heavy: false, throw: Object.freeze([0, 0]) });

/** How far off the surface a mark floats, so it does not fight the
 *  wall it is on. hitEffects.js nudges its splash by the same 2cm for
 *  the same reason (EnemyBlood.cs:35's `+ transform.forward * 0.02f`). */
export const SURFACE_LIFT = 0.02;

/**
 * An orthonormal pair spanning the plane of `normal`, with `turn`
 * (radians) spinning them inside it.
 *
 * The seed axis is the WORLD UP unless the surface is itself near
 * horizontal, where up and the normal are parallel and their cross
 * product collapses to nothing - a floor is exactly the case this
 * module exists for, so the degenerate one is the common one and is
 * handled first rather than guarded against.
 */
export function surfaceBasis(normal, turn = 0) {
  const n = unit(normal) ?? [0, 1, 0];
  const seed = Math.abs(n[1]) > 0.9 ? [0, 0, 1] : [0, 1, 0];
  const r0 = unit(cross(seed, n)) ?? [1, 0, 0];
  const u0 = cross(n, r0);   // already unit: n and r0 are unit and perpendicular
  const c = Math.cos(turn), s = Math.sin(turn);
  return {
    normal: n,
    right: [r0[0] * c + u0[0] * s, r0[1] * c + u0[1] * s, r0[2] * c + u0[2] * s],
    up: [u0[0] * c - r0[0] * s, u0[1] * c - r0[1] * s, u0[2] * c - r0[2] * s],
  };
}

/**
 * BLOOD2a - A BASIS ALONG A DIRECTION. Spatter is not round: a drop
 * flung from a body lands elongated along its travel, the further it
 * flew the longer. `along` is that travel in world space; projected
 * onto the surface it becomes the quad's `right`, and `up` closes the
 * same right-handed frame surfaceBasis makes (right x up = normal), so
 * the winding and the lift are the ones every other mark has. A travel
 * with no component in the plane (straight down onto a floor) falls
 * back to the spun basis, which is what an unthrown drop gets anyway.
 */
export function basisAlong(normal, along, turn = 0) {
  const n = unit(normal) ?? [0, 1, 0];
  const a = along ? [along[0], along[1], along[2]] : null;
  if (!a) return surfaceBasis(n, turn);
  const d = a[0] * n[0] + a[1] * n[1] + a[2] * n[2];
  const r = unit([a[0] - n[0] * d, a[1] - n[1] * d, a[2] - n[2] * d]);
  if (!r) return surfaceBasis(n, turn);
  return { normal: n, right: r, up: cross(n, r) };
}

/** BLOOD2a - HOW LONG A STREAK GETS. A drop at the body's own spot is
 *  round; one flung to the edge of the spray's reach is this many times
 *  longer than it is wide, and the ones between scale with how far they
 *  flew. The port's own number: two and a half reads as cast-off blood
 *  without turning a drop into a line. */
export const STREAK_MAX = 2.5;
export function streakFor(flown, reach) {
  if (!(flown > 0) || !(reach > 0)) return 1;
  return 1 + Math.min(1, flown / reach) * (STREAK_MAX - 1);
}

const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function unit(v) {
  if (!v) return null;
  const l = Math.hypot(v[0], v[1], v[2]);
  return l > 1e-6 ? [v[0] / l, v[1] / l, v[2] / l] : null;
}

// ---- the geometry the host uploads ---------------------------------
//
// A decal is FOUR VERTICES and the host draws a thousand of them in one
// call, so the corner maths lives here - pure, pinned, and nowhere near
// a GL context - and the renderer's pass is plumbing over it. The same
// reason the rest of this module has no renderer in it.

/** pos(3) + uv(2) + rgba(4). */
export const DECAL_FLOATS_PER_VERTEX = 9;
/** A quad, drawn as two triangles through an index buffer. */
export const DECAL_VERTS = 4;
/** One decal's stride into the batch's vertex buffer. */
export const DECAL_FLOATS = DECAL_VERTS * DECAL_FLOATS_PER_VERTEX;

const WHITE = Object.freeze([1, 1, 1, 1]);

/**
 * Write one decal's four corners into `out` at `offset` (in FLOATS).
 *
 * The corners go BL, TL, TR, BR - counter-clockwise seen from the
 * front, which is the side the surface normal points at. The host
 * draws with culling off (a decal on a ceiling is seen from behind its
 * own normal as often as not), so the winding is for the index buffer's
 * sake and for anything that ever wants to cull, not for correctness
 * today.
 *
 * `size` is the decal's FULL width, so the half-extent is half of it -
 * a decal of size 1 covers a metre of floor, which is what a caller
 * passing a metre expects.
 *
 * Answers the next free offset, so a loop over the ring can chain.
 */
export function writeDecalQuad(out, offset, decal, uv = null) {
  const u0 = uv?.u0 ?? 0, v0 = uv?.v0 ?? 0, u1 = uv?.u1 ?? 1, v1 = uv?.v1 ?? 1;
  const [px, py, pz] = decal.pos;
  const h = decal.size / 2;
  const hs = h * (decal.stretch ?? 1);   // BLOOD2a: longer along `right` by the streak
  const rx = decal.right[0] * hs, ry = decal.right[1] * hs, rz = decal.right[2] * hs;
  const ux = decal.up[0] * h, uy = decal.up[1] * h, uz = decal.up[2] * h;
  const c = decal.tint ?? WHITE;
  const corner = (i, sx, sy, u, v) => {
    const o = offset + i * DECAL_FLOATS_PER_VERTEX;
    out[o] = px + rx * sx + ux * sy;
    out[o + 1] = py + ry * sx + uy * sy;
    out[o + 2] = pz + rz * sx + uz * sy;
    out[o + 3] = u; out[o + 4] = v;
    out[o + 5] = c[0]; out[o + 6] = c[1]; out[o + 7] = c[2]; out[o + 8] = c[3] ?? 1;
  };
  corner(0, -1, -1, u0, v0);
  corner(1, -1, 1, u0, v1);
  corner(2, 1, 1, u1, v1);
  corner(3, 1, -1, u1, v0);
  return offset + DECAL_FLOATS;
}

/**
 * A SLOT WITH NOTHING IN IT IS A ZERO-AREA QUAD, not a gap in the
 * buffer. The ring is written by slot and drawn whole in one call, so
 * a hole has to be something the rasteriser throws away rather than
 * something the draw has to skip - skipping would mean either a second
 * draw call per run of live decals or an index rebuild on every
 * placement, and this costs four degenerate vertices.
 */
export function clearDecalQuad(out, offset) {
  out.fill(0, offset, offset + DECAL_FLOATS);
  return offset + DECAL_FLOATS;
}

/** The index buffer for `capacity` quads: two triangles each, BL-TR-TL
 *  and BL-BR-TR, matching the corner order above. */
export function decalIndices(capacity) {
  const out = new Uint32Array(capacity * 6);
  for (let q = 0; q < capacity; q++) {
    const b = q * DECAL_VERTS, o = q * 6;
    out[o] = b; out[o + 1] = b + 2; out[o + 2] = b + 1;
    out[o + 3] = b; out[o + 4] = b + 3; out[o + 5] = b + 2;
  }
  return out;
}

/**
 * The ring.
 *
 * `capacity` marks exist from the first call and no more are ever
 * made: `place` hands back the OLDEST slot once the ring is full, so
 * the cost of blood is decided at boot and cannot grow during a fight.
 * `serial` rises forever and is what a draw sorts or a test reads;
 * `slot` is the ring index and repeats.
 *
 * @param {{capacity?:number, rng?:() => number}} [opts]
 */
export function createBloodDecalPool({ capacity = 1000, rng = Math.random } = {}) {
  // BLOOD1 AUDIT 3: a NaN or an Infinity here threw RangeError at the
  // array - the switch can never hand one, a host passing a raw pref
  // could. Not a number is the default, as it is for the switch.
  const cap = Math.max(1, Math.floor(Number.isFinite(Number(capacity)) ? Number(capacity) : 1000));
  /** @type {Array<any>} */
  const ring = new Array(cap).fill(null);
  let next = 0;        // the slot `place` takes
  let serial = 0;      // how many have ever been placed
  let live = 0;
  // BLOOD1 AUDIT 3: THE HIGH-WATER MARK - the slots ever touched, so a
  // ring holding three marks draws three quads and not its capacity.
  // Slots fill in order from zero, so the live ones are always the
  // prefix [0, touched) until the ring wraps, and the whole ring after.
  let touched = 0;

  /**
   * Lay a mark. `point` is where the blood met the surface and
   * `normal` is that surface's, as collider.raycastHit answers it
   * (already turned to face the ray). Answers the decal, or null when
   * the caller handed nothing to place it on.
   */
  function place(point, normal, { size = 1, tint = null, turn = null, along = null, stretch = 1 } = {}) {
    if (!point || !Number.isFinite(point[0]) || !Number.isFinite(point[1]) || !Number.isFinite(point[2])) return null;
    // BLOOD2a: a drop that flew lies ALONG its travel; one that did not
    // spins as it always has.
    const basis = along ? basisAlong(normal, along, Number.isFinite(turn) ? turn : rng() * Math.PI * 2) : surfaceBasis(normal, Number.isFinite(turn) ? turn : rng() * Math.PI * 2);
    const slot = next;
    const d = {
      slot,
      serial: serial++,
      // LIFTED OFF THE SURFACE, and stored lifted: a decal that is
      // re-read after a floating-origin shift must not have to
      // remember which way its own wall faced.
      pos: [
        point[0] + basis.normal[0] * SURFACE_LIFT,
        point[1] + basis.normal[1] * SURFACE_LIFT,
        point[2] + basis.normal[2] * SURFACE_LIFT,
      ],
      normal: basis.normal,
      right: basis.right,
      up: basis.up,
      // BLOOD1 AUDIT 3: a NaN size wrote NaN into all twelve position
      // floats of the slot; a mark with no size is a mark of size zero.
      size: Number.isFinite(size) ? Math.max(0, size) : 0,
      // BLOOD2a: the streak - how many times longer along `right` than
      // across. One is a round drop, the pool's own.
      stretch: Number.isFinite(stretch) ? Math.max(1, stretch) : 1,
      tint,
      // BLOOD1 AUDIT 3: the `parent` a mark could "ride" is GONE. It was
      // stored and never read - the corners are baked into the GPU slot
      // at place, `pos` is world space, and shiftOrigin moved a parented
      // mark too - so the field promised a capability nothing had. A
      // mark rides nothing; blood on a body is the body's own art.
    };
    if (!ring[slot]) live++;
    ring[slot] = d;
    next = (next + 1) % cap;
    if (slot + 1 > touched) touched = slot + 1;
    return d;
  }

  /** Every live mark, oldest first. The draw reads this. */
  function decals() {
    const out = [];
    for (let i = 0; i < cap; i++) {
      const d = ring[(next + i) % cap];
      if (d) out.push(d);
    }
    return out;
  }

  /**
   * THE STREAMING WORLD MOVES UNDER THE MARKS. When the host recenters
   * (world.js's `state.compensation`), everything already placed is in
   * the OLD frame and would jump a pixel's width. Every live mark takes
   * the same delta, which is why they are stored in world space and not
   * as a surface plus an offset.
   */
  function shiftOrigin(delta) {
    if (!delta) return 0;
    // BLOOD1 AUDIT 3: a non-finite delta poisoned every live mark's
    // position IN PLACE and answered the count as if it had worked;
    // nothing short of clear() recovers from that.
    if (!Number.isFinite(delta[0]) || !Number.isFinite(delta[1]) || !Number.isFinite(delta[2])) return 0;
    let n = 0;
    for (const d of ring) {
      if (!d) continue;
      d.pos[0] += delta[0]; d.pos[1] += delta[1]; d.pos[2] += delta[2];
      n++;
    }
    return n;
  }

  /** A mode change throws the room away, and the blood with it. */
  function clear() {
    ring.fill(null);
    next = 0; live = 0; touched = 0;
    return true;
  }

  /**
   * BLOOD1 AUDIT 3: THE DRAW RANGES, oldest first. One draw composites
   * in SLOT order under depthMask(false) and blending, so once the
   * ring has wrapped the oldest live marks - slots [next, cap) - would
   * draw LAST, over the newest. That broke the one ordering the module
   * goes out of its way to get right (the burst under the pool). Two
   * ranges, [next, cap) then [0, next), put the oldest down first; an
   * unwrapped ring is the one prefix [0, touched).
   * @returns {Array<[number, number]>} half-open slot ranges
   */
  function ranges() {
    if (touched < cap) return touched > 0 ? [[0, touched]] : [];
    return next > 0 ? [[next, cap], [0, next]] : [[0, cap]];
  }

  return {
    ranges,
    get touched() { return touched; },
    place, decals, shiftOrigin, clear,
    get capacity() { return cap; },
    get count() { return live; },
    get placed() { return serial; },
    /** Tests only: the ring as it stands, holes included. */
    _ring: () => ring.slice(),
  };
}
