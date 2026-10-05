// @ts-check
// TACT4 - THE THREE SHAPES (bible/12-Enhanced-AI/Tactics-Arc.md), a LEAF: the ground's pass (render/foeTelegraph.js) is
// on the renderer's boot graph and must not bring the brain with it (test/boot2.test.js holds the entry's reach), so the
// numbers both read live here, importing nothing. ai/foeBlows.js re-exports them.

/** The shapes, and every number they carry. Metres, seconds, damage multipliers on the foe's own blow. */
export const BLOW = Object.freeze({
  lunge: Object.freeze({ windup: 0.7, len: 4.5, halfW: 0.6, mult: 1.5 }),
  sweep: Object.freeze({ windup: 0.8, r: 3.2, halfArc: (65 * Math.PI) / 180, mult: 1.25 }),
  slam: Object.freeze({ windup: 0.9, r: 2.0, ahead: 1.0, mult: 1.75 }),
});

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
/** The shapes this kind may throw ([] for none). */
export function blowShapesOf(mobileType) {
  if (BLOW_FAMILY.has(mobileType)) return BLOW_FAMILY.get(mobileType);
  if (mobileType >= 128 && mobileType !== NONE) return BLOW_CASTERS.has(mobileType) ? [] : BLADE;   // the classes and the watch
  return [];
}
/** Is the point (px, pz) inside the blow's shape (`{ kind, origin: [x, y, z], yaw }`, yaw atan2(dx, dz))? The verdict
 *  at the landing. */
export function inBlow(b, px, pz) {
  const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw);
  const rx = px - b.origin[0], rz = pz - b.origin[2];
  const along = rx * fx + rz * fz, across = -rx * fz + rz * fx;
  if (b.kind === 'lunge') { const P = BLOW.lunge; return along >= -0.3 && along <= P.len && Math.abs(across) <= P.halfW; }
  if (b.kind === 'sweep') {
    const P = BLOW.sweep, d = Math.hypot(rx, rz);
    if (d > P.r) return false;
    if (d < 0.5) return true;   // at its feet
    return Math.acos(Math.max(-1, Math.min(1, along / d))) <= P.halfArc;
  }
  if (b.kind === 'slam') { const P = BLOW.slam; return Math.hypot(along - P.ahead, across) <= P.r; }
  return false;
}
