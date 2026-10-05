// @ts-check
// TACT4 - THE SHAPES (three at TACT4, bible/12-Enhanced-AI/Tactics-Arc.md; four more since TELL6), a LEAF: the ground's pass (render/foeTelegraph.js) is
// on the renderer's boot graph and must not bring the brain with it (test/boot2.test.js holds the entry's reach), so the
// numbers both read live here, importing nothing. ai/foeBlows.js re-exports them.

/** The shapes, and every number they carry. Metres, seconds, damage multipliers on the foe's own blow. */
export const BLOW = Object.freeze({
  lunge: Object.freeze({ windup: 0.7, len: 4.5, halfW: 0.6, mult: 1.5 }),
  sweep: Object.freeze({ windup: 0.8, r: 3.2, halfArc: (65 * Math.PI) / 180, mult: 1.25 }),
  slam: Object.freeze({ windup: 0.9, r: 2.0, ahead: 1.0, mult: 1.75 }),
  // TELL6 (bible/12-Enhanced-AI/Feud-Arc.md 8.1): the ring - an annulus about its feet; safe at its feet (the hug
  // answers it), for the player who backs off
  ring: Object.freeze({ windup: 1.0, rIn: 1.6, rOut: 4.0, mult: 1.5 }),
  // TELL6 (8.1): the charge - the gap-closer, begun 5-12 m out: a lane 9 m by 1.6 m it crosses in 0.45 s at its landing
  charge: Object.freeze({ windup: 0.9, len: 9.0, halfW: 0.8, mult: 1.5, cross: 0.45, from: 5, to: 12 }),
  // TELL6 (8.1): the leap - a disc at the target's feet, locked at its start, 3-9 m off; the wind-up a crouch, its last
  // `arc` seconds the jump to the point
  leap: Object.freeze({ windup: 1.0, r: 1.8, mult: 1.6, from: 3, range: 9, arc: 0.35 }),
  // TELL6 (8.1): the aimed shot - a line from the archer to its target, locked at its start; the arrow leaves along it
  // x1.3 as fast (`speed`) and x`mult` its damage. The arrow's own flight decides: stepping off the line dodges it
  aimed: Object.freeze({ windup: 0.6, halfW: 0.25, mult: 1.4, speed: 1.3 }),
  // RVN5 (bible/12-Enhanced-AI/Feud-Arc.md 16.1): the pyre - a revenant's signature where its family reaches no other: a
  // disc at its target's feet, locked at its start, out to `range`; its landing a blast of its own element (a spell -
  // the player's saving throw answers it), never a swing
  pyre: Object.freeze({ windup: 1.2, r: 2.2, mult: 1, range: 12 }),
});

// TELL2 (bible/12-Enhanced-AI/Feud-Arc.md section 4): the numbers the ground's pass reads beside the brain - their one
// home is here, for the same reason as the shapes'; ai/tells.js's TELL table takes them from here.
/** The last stretch before a landing (s): the glint rises to full and the mark's line brightens ("now"). */
export const TELL_NOW = 0.2;
/** A wind-up this near the player (m)... */
export const TELL_NEAR_M = 6;
/** ...draws at no less than this through the fog (a dungeon's black murk swallowed a mark a step away). */
export const TELL_NEAR_FLOOR = 0.6;
/** TELL3 (section 5): an IRON blow's wind-up runs this much longer than its shape's. */
export const TELL_IRON_EXTRA = 0.2;
/** TELL5 (7.3): a cut feint's mark fades out, dashed, over this (s). */
export const TELL_FEINT_FADE = 0.15;

/** AUDIT ARENA-LADDER: THE FAMILIES AND THE VERDICT, MOVED HERE FROM ai/foeBlows.js - the relay runs the arena's ladder
 *  (net/arenaBrain.js) and its fighters telegraph too, and the relay's import graph reaches a leaf and never the brain
 *  (characters/mobileTypes.js, the tactics clock). So the shapes a kind may throw are kept here by the MobileTypes number
 *  (test/arenaladder_audit.test.js pins every number against characters/mobileTypes.js), and ai/foeBlows.js hands both
 *  on: one home, two readers. Not here: no telegraphed blow (the casters, the spectral, the small and the flying). */
const BEAST = Object.freeze(['lunge']);
const BRUTE = Object.freeze(['slam', 'sweep']);
const BLADE = Object.freeze(['sweep', 'lunge']);
/** MobileTypes number -> the shapes it may throw (GrizzlyBear 4, SabertoothTiger 5, Spider 6, Werewolf 9, Wereboar 14,
 *  GiantScorpion 20, Dragonling 34 and its alternate 40, Centaur 8; Giant 16, OrcWarlord 24, Daedroth 27, DaedraLord 31,
 *  IronAtronach 36, FleshAtronach 37, Gargoyle 22, Dreugh 41; Orc 7, OrcSergeant 12, SkeletalWarrior 15, Mummy 19,
 *  Vampire 28, VampireAncient 30, FrostDaedra 25, FireDaedra 26, DaedraSeducer 29, Lamia 42). */
export const BLOW_FAMILY = Object.freeze(new Map([
  [4, BEAST], [5, BEAST], [6, BEAST], [9, BEAST], [14, BEAST], [20, BEAST], [34, BEAST], [40, BEAST], [8, BLADE],
  [16, BRUTE], [24, BRUTE], [27, BRUTE], [31, BRUTE], [36, BRUTE], [37, BRUTE], [22, BRUTE], [41, BRUTE],
  [7, BLADE], [12, BLADE], [15, BLADE], [19, BLADE], [28, BLADE], [30, BLADE], [25, BLADE], [26, BLADE], [29, BLADE], [42, BLADE],
]));
/** The casters among the classes - Mage 128, Sorcerer 131, Healer 132 - throw none. */
export const BLOW_CASTERS = Object.freeze(new Set([128, 131, 132]));
/** MobileTypes.None. */
const NONE = 65535;
/** The kind's family's own shapes (TACT4's one or two). */
function familyShapes(mobileType) {
  if (BLOW_FAMILY.has(mobileType)) return BLOW_FAMILY.get(mobileType);
  if (mobileType >= 128 && mobileType !== NONE) return BLOW_CASTERS.has(mobileType) ? [] : BLADE;   // the classes and the watch
  return [];
}
/** TELL5 (bible/12-Enhanced-AI/Feud-Arc.md 7): the kind's family - 'beast', 'brute' or 'blade' (null: none throws a
 *  telegraphed blow). */
export function blowFamily(mobileType) {
  const s = familyShapes(mobileType);
  return s === BEAST ? 'beast' : s === BRUTE ? 'brute' : s === BLADE ? 'blade' : null;
}
/** TELL5: an elite - the ELITE FOES gold or an Elite Dungeon's (Feud-Arc.md section 9's "an elite (`elite`, `eliteFoe`)").
 *  Here beside the whole set it decides; ai/tells.js hands it on. */
export const isElite = (ent) => ent?.eliteFoe === true || ent?.elite === true;
/** TELL7: an elite, a champion or a revenant (any rank) - who throws its family's whole set of shapes (ai/tells.js hands
 *  it on). */
export const wholeSet = (ent) => isElite(ent) || !!ent?.champion || !!ent?.revenant;
/** TELL7 (Feud-Arc.md section 9): what an elite, a champion or a revenant adds to its family's, by the MobileTypes number
 *  as the families are (test/tell7_tier.test.js and the shapes' own pins hold each by its name) - the ring (the massive
 *  brute, the atronachs, the Daedra Lord: Giant 16, IronAtronach 36, FleshAtronach 37, DaedraLord 31), the charge (the
 *  chargers: GrizzlyBear 4, SabertoothTiger 5, Wereboar 14, Centaur 8, OrcWarlord 24), the leap (the leapers: Spider 6,
 *  Werewolf 9, SabertoothTiger 5, Vampire 28). A shape joins only once it exists (TELL6 brings them; `BLOW` is their one
 *  home). The archers' aimed shot is a ranged token's, not a family's. */
const RING_KINDS = Object.freeze(new Set([16, 36, 37, 31]));
const CHARGERS = Object.freeze(new Set([4, 5, 14, 8, 24]));
const LEAPERS = Object.freeze(new Set([6, 9, 5, 28]));
/** TELL7: the shapes the whole set adds to this kind's family, whether or not they exist yet. */
export function extraShapesOf(mobileType) {
  const out = [];
  if (RING_KINDS.has(mobileType)) out.push('ring');
  if (CHARGERS.has(mobileType)) out.push('charge');
  if (LEAPERS.has(mobileType)) out.push('leap');
  return out;
}
/** The shapes this kind may throw ([] for none) - its family's. TELL7: an elite, a champion or a revenant (`entity`)
 *  throws its family's whole set; an ordinary foe of the tier keeps TACT4's one or two (Mac, 2026-10-02). The relay's
 *  ladder brain asks a kind's family alone (no entity). */
export function blowShapesOf(mobileType, entity = null) {
  const base = familyShapes(mobileType);
  if (!base.length || !wholeSet(entity)) return base;
  const add = extraShapesOf(mobileType).filter((k) => k in BLOW && !base.includes(k));
  return add.length ? [...base, ...add] : base;
}
/** Is the point (px, pz) inside the blow's shape (`{ kind, origin: [x, y, z], yaw }`, yaw atan2(dx, dz))? The verdict
 *  at the landing. */
export function inBlow(b, px, pz) {
  const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw);
  const rx = px - b.origin[0], rz = pz - b.origin[2];
  const along = rx * fx + rz * fz, across = -rx * fz + rz * fx;
  if (b.kind === 'lunge' || b.kind === 'charge') { const P = BLOW[b.kind]; return along >= -0.3 && along <= P.len && Math.abs(across) <= P.halfW; }   // TELL6: the charge's lane is a lunge's, longer and wider
  if (b.kind === 'sweep') {
    const P = BLOW.sweep, d = Math.hypot(rx, rz);
    if (d > P.r) return false;
    if (d < 0.5) return true;   // at its feet
    return Math.acos(Math.max(-1, Math.min(1, along / d))) <= P.halfArc;
  }
  if (b.kind === 'slam') { const P = BLOW.slam; return Math.hypot(along - P.ahead, across) <= P.r; }
  if (b.kind === 'ring') { const P = BLOW.ring, d = Math.hypot(rx, rz); return d >= P.rIn && d <= P.rOut; }   // TELL6: safe at its feet
  if (b.kind === 'leap') return Math.hypot(along - (b.ahead ?? 0), across) <= BLOW.leap.r;   // TELL6: a disc at its point
  if (b.kind === 'aimed') return along >= -0.3 && along <= (b.ahead ?? 0) && Math.abs(across) <= BLOW.aimed.halfW;   // TELL6: its line to its target
  if (b.kind === 'pyre') return Math.hypot(along - (b.ahead ?? 0), across) <= BLOW.pyre.r;   // RVN5: a disc at its target's feet
  return false;
}
