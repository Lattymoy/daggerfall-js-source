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
import { isActionDoorObject } from '../world/actionSystem.js';   // MC-2: ActionDoorCheck's own classifier (PlayerActivate.cs:374 vs :380)

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
/** AUDIT 58 (talk lane): TextManager 'youAreTooFarAway'
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
/** AUDIT 58 (talk lane): TextManager 'youSee'
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
 * AUDIT 63 F37: the world box a RAY must test against one action
 * object - the collider DFU's Physics.Raycast actually meets.
 *
 * A posed object measures LIVE. DaggerfallAction.TweenToEnd
 * (Internal/DaggerfallAction.cs:361-379) is iTween.RotateBy (:378) and
 * iTween.MoveTo (:379) on the GameObject, so its MeshCollider travels
 * with the transform, and both ray sites read a live hit:
 * PlayerActivate.cs:381-385 (ActionCheck -> Receive(Direct)) and
 * WeaponManager.cs:459-464
 * (WeaponEnvDamage -> Receive(Attack)). The port's precomputed `aabb`
 * is the AT-REST placement box (dungeonContext writes it for the
 * collision-trigger pass, which wants exactly that), so preferring it
 * left a moved platform unclickable at its new pose while its ghost
 * still answered - and shadowed - the ray at the old one.
 *
 * Recomputing (rather than translating a baseAabb the way _applyFlat
 * does) is required: a model mover carries ActionRotation as well as
 * ActionTranslation, and an offset-shifted box is wrong under
 * rotation. Objects with no mesh - effects, relays, moveFlats - keep
 * their stored box, which is the only one they have.
 */
export function objectAabb(o) {
  if (!o) return null;
  if (o.cpu && o.matrix) return worldAabb(o.cpu.positions, o.matrix);
  return o.aabb ?? null;
}

/**
 * Build activation targets from an ActionSystem's live objects - ONE
 * source for both scenes (audit 2026-08-16: the scenes built targets
 * inline with worldAabb(o.cpu.positions, o.matrix) and CRASHED on
 * effect objects, which carry a precomputed aabb and no cpu/matrix;
 * relay objects carry neither and are chain-only, never targets).
 * AUDIT 65 MC-2: the two kinds this one pool holds are NOT gated
 * alike in DFU. An ACTION DOOR is dispatched off the ray's hit
 * (ActionDoorCheck, :374 -> ActivateActionDoor) and refuses out loud
 * inside the handler - `hit.distance > DoorActivationDistance` ->
 * SetMidScreenText(youAreTooFarAway), :686-689 - so it must reach the
 * handler to speak, which means competing for the pick at the RAY's
 * own reach and carrying its real one. An action RECORD is gated in
 * the Update ladder itself and is SILENT - `if (ActionCheck(hit, out
 * action) && hit.distance <= DefaultActivationDistance)` (:380-383),
 * no else, no line - so it keeps the narrow pre-gate exactly as it is.
 * isActionDoorObject (world/actionSystem.js:106) is the port's spelling
 * of that GetComponent<DaggerfallActionDoor> everywhere else.
 *
 * @param {Map<string, object>} objects - ActionSystem.objects
 * @param {number} distance - activation reach for every target.
 */
export function activationTargets(objects, distance = DOOR_ACTIVATION_DISTANCE) {
  const targets = [];
  for (const o of objects.values()) {
    const aabb = objectAabb(o);
    if (!aabb) continue;
    if (isActionDoorObject(o)) targets.push({ key: o.key, aabb, distance: RAY_DISTANCE, reach: distance });   // :686-689 speaks
    else targets.push({ key: o.key, aabb, distance });   // :380-383 is silent
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
  return pickFoeAlong(eye, dir, foes, collider, distance, (f) => !!f.questBehaviour)?.foe ?? null;
}

/**
 * TI1 - THE LOCK-ON PICK: the same box, the same occlusion, ANY live
 * foe. The quest-foe click above is this with `questBehaviour` as the
 * accept; the touch lock-on (player/lockOn.js) wants the foe under the
 * finger whether or not a quest owns it. One law, two accepts - a
 * second copy of the box would drift from the first (the exact way
 * F-C2's three swing thresholds once did).
 * @returns {object|null} the nearest live foe the ray hits
 */
export function pickFoe(eye, dir, foes, collider, distance = DEFAULT_ACTIVATION_DISTANCE) {
  return pickFoeAlong(eye, dir, foes, collider, distance, () => true)?.foe ?? null;
}

/** AUDIT 63 F33: the same pick, WITH the hit distance.
 *  ActivateMobileEnemy's steal arm gates on `hit.distance >
 *  PickpocketDistance` (PlayerActivate.cs:832-836) - DFU reads the
 *  distance off the one RaycastHit its ray already produced, so the
 *  pick has to hand it back rather than have the caller re-measure
 *  against a different volume.
 *  @returns {{foe: object, distance: number}|null} */
export function pickFoeHit(eye, dir, foes, collider, distance = DEFAULT_ACTIVATION_DISTANCE) {
  return pickFoeAlong(eye, dir, foes, collider, distance, () => true);
}

function pickFoeAlong(eye, dir, foes, collider, distance, accept) {
  let best = null;
  let bestD = Infinity;
  for (const f of foes ?? []) {
    if (!f || f.dead || !accept(f)) continue;
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
  return best ? { foe: best, distance: bestD } : null;
}

/**
 * Pick the nearest activatable the eye ray hits within reach and sight.
 * @param {Array<{key:string, aabb:{min,max}, distance?:number, reach?:number}>} targets
 * @returns {string|null} target key
 */
export function pickActivatable(eye, dir, targets, collider) {
  return pickActivatableHit(eye, dir, targets, collider)?.key ?? null;
}

/**
 * AUDIT 63 F33 (review round): the SAME pick, with the winning hit's
 * distance handed back.
 *
 * DFU fires ONE ray and dispatches on the ONE RaycastHit it produces
 * (PlayerActivate.cs:314 `Physics.Raycast(ray, out hit, RayDistance,
 * playerLayerMask)`); every check below it - the action door (:374),
 * the loot container (:388), the static NPC (:402), the mobile NPC
 * (:412) and the mobile ENEMY (:419) - reads `hit.transform` off that
 * same hit (MobileEnemyCheck, :1243-1248). So a foe is dispatched only
 * when the foe IS the nearest thing the ray met: a chest at arm's
 * length always beats a foe standing behind it.
 *
 * The port has no unified raycast - each kind of target is picked from
 * its own pool - so a host that wants DFU's answer has to compare the
 * two picks by DISTANCE, which means this one has to return it.
 *
 * AUDIT 65 MC-2: and its REACH with it. DFU's ray is cast once at
 * RayDistance (:76) and every handler it dispatches into gates the
 * distance ITSELF, out loud - the static door (:501-504), the action
 * door (:686-689), the bulletin board (:709-712), ladders and shelves
 * (:850-853), the loot container (:868-873) and the corpse (:936-941)
 * each answer `hit.distance > <its own constant>` with
 * SetMidScreenText(youAreTooFarAway) and return. A target whose
 * `distance` is widened to RAY_DISTANCE so it can WIN the pick
 * therefore carries its real `reach` beside it, and the ladder speaks
 * the refusal when the winner came back out of reach. This is the
 * bulletin board's idiom (scenes/worldModes.js:3991-4001) given a
 * field, not a second pick: one ray, one winner, the gate downstream.
 * Targets that were never widened answer `reach === distance`, which
 * the pre-gate has already enforced, so they can never refuse.
 *
 * @returns {{key:string, distance:number, reach:number}|null}
 */
export function pickActivatableHit(eye, dir, targets, collider) {
  let bestKey = null;
  let bestDist = Infinity;
  let bestAabb = null;
  let bestReach = DEFAULT_ACTIVATION_DISTANCE;
  for (const target of targets) {
    const d = rayAabb(eye, dir, target.aabb);
    if (d === null || d >= bestDist) continue;
    if (d > (target.distance ?? DEFAULT_ACTIVATION_DISTANCE)) continue;
    bestKey = target.key;
    bestDist = d;
    bestAabb = target.aabb;
    // MC-2: a family that was not widened has no `reach` of its own, and
    // its pick reach IS its handler's constant.
    bestReach = target.reach ?? target.distance ?? DEFAULT_ACTIVATION_DISTANCE;
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
  return { key: bestKey, distance: bestDist, reach: bestReach };
}
