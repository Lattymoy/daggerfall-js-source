// Player activation ray. Verbatim Daggerfall Unity PlayerActivate
// constants (MIT, Daggerfall Workshop): the ray reaches classic's
// farthest view distance, individual targets gate on their activation
// distance (doors/default 128 * GlobalScale).
// Target picking (ours): activatables are tested as world AABBs (their
// model's transformed corner box - doors and levers are box-like), the
// nearest in-reach hit wins, and a collider raycast rejects targets
// occluded by closer world geometry.

// AUDIT 24 (wave 23): MeshReader.GlobalScale has one home
// (world/meshReader.js), which every other module in the port already
// imports it from. This file declared a second 0.025 - agreeing, as
// duplicates do until they do not.
import { GLOBAL_SCALE } from '../world/meshReader.js';

export { GLOBAL_SCALE };

// PlayerActivate.cs:76-88, the WHOLE set. Three of these used to live
// in systems/talk.js instead, and wave 22 of this audit added a fourth
// there without noticing the first three - which is how a duplicate
// set gets built one honest commit at a time. talk.js re-exports these
// now.
export const RAY_DISTANCE = 3072 * GLOBAL_SCALE; // 76.8
export const DEFAULT_ACTIVATION_DISTANCE = 128 * GLOBAL_SCALE; // 3.2
export const DOOR_ACTIVATION_DISTANCE = 128 * GLOBAL_SCALE;
export const TREASURE_ACTIVATION_DISTANCE = 128 * GLOBAL_SCALE;
export const PICKPOCKET_DISTANCE = 128 * GLOBAL_SCALE;
export const STATIC_NPC_ACTIVATION_DISTANCE = 256 * GLOBAL_SCALE;
export const MOBILE_NPC_ACTIVATION_DISTANCE = 256 * GLOBAL_SCALE;
/** AUDIT 54 (talk lane): TextManager 'youAreTooFarAway'
 *  (Master Localization CSV Files/Internal_Strings.csv:22 -
 *  `youAreTooFarAway,You are too far away...`), the ONE string every
 *  reach refusal in PlayerActivate speaks: the static-NPC arm
 *  (PlayerActivate.cs:763), the mobile-NPC arm (:780), the pickpocket
 *  arm (:790) and the bulletin board (:712). It lives here because it
 *  is PlayerActivate's, not any one caller's - systems/bulletinBoard.js
 *  spelled it correctly and scenes/townTalk.js spelled the same key
 *  'You are too far away.' with a full stop, so one localized key was
 *  shipping as two different sentences in one session. */
export const TOO_FAR_AWAY_TEXT = 'You are too far away...';
/** AUDIT 54 (talk lane): TextManager 'youSee'
 *  (Internal_Strings.csv:53 - `youSee,You see %s.`), the WHOLE of
 *  PresentNPCInfo (PlayerActivate.cs:1484-1486): one HUD line naming
 *  the NPC, with %s replaced by StaticNPC.DisplayName. It is what
 *  ActivateStaticNPC's Info arm does and the only thing it does
 *  (:755-757) - the other three modes fall to StaticNPCClick. */
export const YOU_SEE_TEXT = 'You see %s.';
/** PresentNPCInfo's one line, macro-replaced (:1486). */
export const presentNpcInfoText = (displayName) => YOU_SEE_TEXT.replace('%s', displayName ?? '');
// PlayerActivate.cs:85 - corpses reach FURTHER than everything else
// (150 classic units, not 128). It is deliberate, not incidental:
// ActivateLootContainer (:866-874) exempts CorpseMarker from the
// TreasureActivationDistance gate and re-tests it at :938 against
// CorpseActivationDistance. AUDIT 18: this constant was missing, so
// corpse targets fell back to the 128-unit default.
export const CORPSE_ACTIVATION_DISTANCE = 150 * GLOBAL_SCALE; // 3.75

/** Axis-aligned bounds of a model's positions under a matrix. */
export function worldAabb(positions, m) {
  let minX = Infinity; let minY = Infinity; let minZ = Infinity;
  let maxX = -Infinity; let maxY = -Infinity; let maxZ = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];
    const wx = m[0] * x + m[4] * y + m[8] * z + m[12];
    const wy = m[1] * x + m[5] * y + m[9] * z + m[13];
    const wz = m[2] * x + m[6] * y + m[10] * z + m[14];
    if (wx < minX) minX = wx; if (wx > maxX) maxX = wx;
    if (wy < minY) minY = wy; if (wy > maxY) maxY = wy;
    if (wz < minZ) minZ = wz; if (wz > maxZ) maxZ = wz;
  }
  return { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] };
}

/** Slab ray-AABB; distance along unit dir or null. */
export function rayAabb(origin, dir, aabb) {
  let tMin = 0;
  let tMax = Infinity;
  for (let a = 0; a < 3; a++) {
    if (Math.abs(dir[a]) < 1e-9) {
      if (origin[a] < aabb.min[a] || origin[a] > aabb.max[a]) return null;
      continue;
    }
    const inv = 1 / dir[a];
    let t0 = (aabb.min[a] - origin[a]) * inv;
    let t1 = (aabb.max[a] - origin[a]) * inv;
    if (t0 > t1) { const s = t0; t0 = t1; t1 = s; }
    if (t0 > tMin) tMin = t0;
    if (t1 < tMax) tMax = t1;
    if (tMin > tMax) return null;
  }
  return tMin;
}

/**
 * Build activation targets from an ActionSystem's live objects - ONE
 * source for both scenes (audit 2026-08-16: the scenes built targets
 * inline with worldAabb(o.cpu.positions, o.matrix) and CRASHED on
 * effect objects, which carry a precomputed aabb and no cpu/matrix;
 * relay objects carry neither and are chain-only, never targets).
 * @param {Map<string, object>} objects - ActionSystem.objects
 * @param {number} distance - activation reach for every target.
 */
export function activationTargets(objects, distance = DOOR_ACTIVATION_DISTANCE) {
  const targets = [];
  for (const o of objects.values()) {
    const aabb = o.aabb ?? (o.cpu ? worldAabb(o.cpu.positions, o.matrix) : null);
    if (!aabb) continue;
    targets.push({ key: o.key, aabb, distance });
  }
  return targets;
}

/**
 * QG1 - the FOE half of PlayerActivate's quest-resource click arm
 * (PlayerActivate.cs:325-339): an activate ray landing on a live foe
 * that carries a QuestResourceBehaviour, within the DEFAULT activation
 * distance. The CALLER owns the two law gates that sit around the C#
 * call - `currentMode != Info` and the non-consuming fall-through (the
 * C# arm does not return; the rest of the activation ladder still
 * runs) - because both are the host ladder's, not the pick's.
 *
 * The body is the port's own foe volume: feet + ai.height, the 0.45
 * half-width the missile hit test uses (spellcast.js) - foes are
 * billboards and carry no mesh AABB. Occlusion is pickActivatable's
 * posture: solid world strictly in front blocks the click.
 *
 * @param {Array<object>} foes - live pool entries ({ai, dead, questBehaviour})
 * @returns {object|null} the nearest clicked quest foe
 */
export function pickQuestFoe(eye, dir, foes, collider, distance = DEFAULT_ACTIVATION_DISTANCE) {
  let best = null;
  let bestD = Infinity;
  for (const f of foes ?? []) {
    if (!f || f.dead || !f.questBehaviour) continue;
    const feet = f.ai?.feet;
    if (!feet) continue;
    const h = f.ai?.height ?? 1.8;
    const half = 0.45;
    const aabb = {
      min: [feet[0] - half, feet[1], feet[2] - half],
      max: [feet[0] + half, feet[1] + h, feet[2] + half],
    };
    const d = rayAabb(eye, dir, aabb);
    if (d === null || d > distance || d >= bestD) continue;
    const wall = collider?.raycast?.(eye, dir, d) ?? Infinity;
    if (Number.isFinite(wall) && wall < d - 0.05) continue;
    best = f;
    bestD = d;
  }
  return best;
}

/**
 * Pick the nearest activatable the eye ray hits within reach and sight.
 * @param {Array<{key:string, aabb:{min,max}, distance?:number}>} targets
 * @returns {string|null} target key
 */
export function pickActivatable(eye, dir, targets, collider) {
  let bestKey = null;
  let bestDist = Infinity;
  let bestAabb = null;
  for (const target of targets) {
    const d = rayAabb(eye, dir, target.aabb);
    if (d === null || d >= bestDist) continue;
    if (d > (target.distance ?? DEFAULT_ACTIVATION_DISTANCE)) continue;
    bestKey = target.key;
    bestDist = d;
    bestAabb = target.aabb;
  }
  if (bestKey === null) return null;
  // Occlusion: solid world strictly in front of the target blocks it -
  // UNLESS the blocking hit lies inside the target's own box (thin or
  // diagonal meshes sit well inside their AABB, so their own surface
  // legitimately lands nearer than the AABB entry).
  const wall = collider.raycast(eye, dir, bestDist - 0.05);
  if (wall < bestDist - 0.05) {
    const hx = eye[0] + dir[0] * wall;
    const hy = eye[1] + dir[1] * wall;
    const hz = eye[2] + dir[2] * wall;
    const b = bestAabb;
    const skin = 0.15;
    const inside = hx >= b.min[0] - skin && hx <= b.max[0] + skin
      && hy >= b.min[1] - skin && hy <= b.max[1] + skin
      && hz >= b.min[2] - skin && hz <= b.max[2] + skin;
    if (!inside) return null;
  }
  return bestKey;
}
