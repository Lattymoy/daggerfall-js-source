// @ts-check
// EYE OF THE BEHOLDER - THE CART (EOTB-IL, 2026-09-16).
//
// `EyeOfTheBeholder.SpawnWagon` / `UpdateWagon` / `CheckWagon`, read
// off the shipped assembly's IL (`vendor/eye-of-the-beholder/il/`).
// `Graphics.ShowCart`: "A 3D cart will follow your billboard when
// using the Cart Transport Mode" - Daggerfall model 41239, built by
// `GameObjectHelper.CreateDaggerfallMeshGameObject` (IL_1e4d-IL_1e5c),
// its own collider OFF and a trigger box over the renderer's bounds
// (IL_1e76-IL_1eb3), registered with PlayerActivate as a custom
// activation at 3.2 (IL_1eea-IL_1f05). It is the CAMERA's, not the
// billboard's: `LateUpdate` runs UpdateWagon every frame, BEFORE the
// `offset` gate (IL_1c74-IL_1c7f), so the cart follows in first person
// too.
//
// Every number below is the IL's. The one thing that is not: the port
// SHIFTS the cart with the floating origin (`rebase`), which Unity's
// FloatingOrigin does for every world object and which the streaming
// host here has to do by hand (scenes/world.js's rebase block).

import { modSettingsOf } from '../systems/modSettings.js';
import { trs } from '../world/mat4.js';
import { localAabb, transformedAabb } from '../render/frustum.js';

/** [IL] IL_1e4d, IL_1eef: the mesh, and the model id the activation is keyed on. */
export const WAGON_MODEL = 41239;
/** [IL] IL_1f00: RegisterCustomActivation's distance. */
export const WAGON_REACH = 3.2;
/** [IL] IL_1e67: `wagonOffsetLast`'s seed, `Vector3.forward * -2.5` (WORLD forward). */
export const OFFSET_LAST_SEED = Object.freeze([0, 0, -2.5]);
/** [IL] IL_1fa2: on activation the cart appears ten metres behind the body. */
export const SPAWN_BEHIND = 10;
/** [IL] IL_1fe8: the cart starts to follow beyond 2.5 m ... */
export const FOLLOW_TRIGGER = 2.5;
/** [IL] IL_1ff1: ... and beyond 10 m it keeps its LAST offset instead of the current one. */
export const TELEPORT_TRIGGER = 10;
/** [IL] IL_2023, IL_2106: it settles 2.49 m from the body. */
export const FOLLOW_DISTANCE = 2.49;
/** [IL] IL_2054: the ground probe starts 0.6 m behind the cart's own forward ... */
export const PROBE_BACK = 0.6;
/** [IL] IL_2074: ... two metres up ... */
export const PROBE_UP = 2;
/** [IL] IL_2097: ... and casts ten metres down. */
export const PROBE_DOWN = 10;
/** [IL] IL_20c4: the cart sits one metre above the hit. */
export const GROUND_LIFT = 1;
/** [IL] IL_214a: the wobble's frequency. */
export const WOBBLE_SPEED = 10;
/** [IL] IL_2280: CheckWagon's Info-mode line. */
export const WAGON_INFO_TEXT = 'You see your wagon';

/**
 * [IL] IL_2151-IL_21a8: the roll while the cart is moving.
 *   amp  = 2 + (sin t + 1)                 (IL_2151-IL_2167)
 *   amp  = 1 + (sin t + 1) * 0.5  on a path (IL_2169-IL_2196)
 *   roll = sin(t * 10) * amp               (IL_2198-IL_21a8)
 * `t` is Unity's `Time.time`.
 */
export function wobbleRoll(time, onExteriorPath = false) {
  let amp = 2 + (Math.sin(time) + 1);
  if (onExteriorPath) amp = 1 + (Math.sin(time) + 1) * 0.5;
  return Math.sin(time * WOBBLE_SPEED) * amp;
}

/**
 * `Transform.LookAt(body)`: yaw and pitch (Unity Euler, degrees) that
 * point +Z from `from` at `to`, world up. Unity's forward for Euler
 * (x, y, 0) is (cos x sin y, -sin x, cos x cos y), so pitch is
 * -asin(f.y) and yaw is atan2(f.x, f.z) - the same order mat4's `trs`
 * composes (Ry * Rx * Rz), which is also Unity's.
 */
export function lookAtEuler(from, to) {
  const dx = to[0] - from[0], dy = to[1] - from[1], dz = to[2] - from[2];
  const len = Math.hypot(dx, dy, dz);
  if (len === 0) return { yaw: 0, pitch: 0 };
  const yaw = Math.atan2(dx, dz) * 180 / Math.PI;
  const pitch = -Math.asin(Math.max(-1, Math.min(1, dy / len))) * 180 / Math.PI;
  return { yaw, pitch };
}

const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]); return l > 0 ? [v[0] / l, v[1] / l, v[2] / l] : [0, 0, 0]; };
const yawForward = (yawDeg) => { const r = yawDeg * Math.PI / 180; return [Math.sin(r), 0, Math.cos(r)]; };

/**
 * [IL] UpdateWagon (IL_1f18-IL_223e), one frame, PURE: `w` is the
 * cart's state and the return is the next one.
 *
 * @param {{active:boolean, pos:number[]|null, yaw:number, pitch:number, roll:number, offsetLast:number[], time:number}} w
 * @param {{dt?:number, showCart?:boolean, cart?:boolean, bodyPos?:number[], bodyForward?:number[],
 *          onExteriorPath?:boolean, raycast?:((o:number[], d:number[], max:number) => number|null)|null}} f
 */
export function updateWagon(w, f = {}) {
  const dt = f.dt ?? 0;
  const next = { ...w, time: w.time + dt };
  // IL_1f18-IL_1f39: the setting off - hide, and nothing else
  if (!f.showCart) { next.active = false; return next; }
  // IL_1f49-IL_1f59, IL_2225-IL_223e: not the cart transport - hide
  if (!f.cart) { next.active = false; return next; }
  const body = f.bodyPos ?? [0, 0, 0];
  const bodyFwd = f.bodyForward ?? [0, 0, 1];
  // IL_1f5e-IL_1fb1: first frame of the cart - shown ten metres behind
  if (!next.active || !next.pos) {
    next.active = true;
    next.pos = [body[0] - bodyFwd[0] * SPAWN_BEHIND, body[1] - bodyFwd[1] * SPAWN_BEHIND, body[2] - bodyFwd[2] * SPAWN_BEHIND];
  }
  // IL_1fb6-IL_1ff9: loc0 `far`, loc1 `veryFar`, loc2 the delta
  let far = false, veryFar = false;
  const delta = [body[0] - next.pos[0], body[1] - next.pos[1], body[2] - next.pos[2]];
  const mag = Math.hypot(delta[0], delta[1], delta[2]);
  if (mag > FOLLOW_TRIGGER) { far = true; if (mag > TELEPORT_TRIGGER) veryFar = true; }
  if (far) {
    // IL_2000-IL_2032: the direction is the delta, or the LAST offset past ten metres
    const dir = norm(veryFar ? w.offsetLast : delta);
    let target = [body[0] - dir[0] * FOLLOW_DISTANCE, body[1] - dir[1] * FOLLOW_DISTANCE, body[2] - dir[2] * FOLLOW_DISTANCE];
    // IL_2034-IL_20a8: the ground probe. `wagon.position -
    // wagon.TransformPoint(forward * 0.6)` is `-wagon.forward * 0.6`.
    const wf = yawForward(w.yaw);
    const origin = [target[0] - wf[0] * PROBE_BACK, target[1] - wf[1] * PROBE_BACK + PROBE_UP, target[2] - wf[2] * PROBE_BACK];
    const hit = f.raycast ? f.raycast(origin, [0, -1, 0], PROBE_DOWN) : null;
    if (hit != null && hit < PROBE_DOWN) {
      // IL_20af-IL_2115: the target's y is the hit plus one, then the
      // 2.49 is measured again from the body to THAT point
      const grounded = [target[0], origin[1] - hit + GROUND_LIFT, target[2]];
      const d2 = norm([body[0] - grounded[0], body[1] - grounded[1], body[2] - grounded[2]]);
      target = [body[0] - d2[0] * FOLLOW_DISTANCE, body[1] - d2[1] * FOLLOW_DISTANCE, body[2] - d2[2] * FOLLOW_DISTANCE];
    }
    next.pos = target;   // IL_2117-IL_2124
  }
  // IL_2129-IL_213f: LookAt(body) every frame - which also clears any roll
  const look = lookAtEuler(next.pos, body);
  next.yaw = look.yaw; next.pitch = look.pitch; next.roll = 0;
  // IL_2144-IL_21ea: the wobble, only while following
  if (far) next.roll = wobbleRoll(next.time, !!f.onExteriorPath);
  // IL_21ef: the offset remembered is the delta BEFORE the move...
  next.offsetLast = delta;
  // IL_21f6-IL_221f: ...unless the cart was teleported, then the one after
  if (veryFar) next.offsetLast = [body[0] - next.pos[0], body[1] - next.pos[1], body[2] - next.pos[2]];
  return next;
}

/** [IL] SpawnWagon's state: inactive, no position yet, the seed offset. */
export const freshWagon = () => ({ active: false, pos: null, yaw: 0, pitch: 0, roll: 0, offsetLast: [...OFFSET_LAST_SEED], time: 0 });

/** The cart's model matrix: LookAt's yaw and pitch, the wobble's roll (IL_21aa-IL_21ea sets localEulerAngles (x, y, roll)). */
export const wagonMatrix = (w) => (w.active && w.pos ? trs(w.pos[0], w.pos[1], w.pos[2], w.pitch, w.yaw, w.roll) : null);

/**
 * [IL] CheckWagon (IL_224c-IL_22a4): the hit was the cart - in Info
 * mode (`PlayerActivate.CurrentMode == 2`) one HUD line; in any other
 * mode `AllowDungeonWagonAccess()` and `dfuiOpenInventoryWindow`.
 * @returns {'info'|'inventory'}
 */
export const checkWagon = (mode) => (mode === 'info' ? 'info' : 'inventory');

/** `Graphics.ShowCart`, as LoadSettings reads it into `wagon` (IL_0eb6-IL_0ec5). */
export function showCart() {
  try { return modSettingsOf('eye-of-the-beholder')['Graphics.ShowCart'] !== false; } catch { return true; }
}

/**
 * THE CART, as the hosts carry it: the machine above, the mesh the
 * host's pipeline loads, and the three doors (draw, pick, activate).
 */
export function createEotbWagon() {
  let w = freshWagon();
  /** @type {null|{getGpuMesh:Function, cpuModels:Map<number, any>}} */
  let pipeline = null;
  let gpu = null;
  let loading = false;
  let localBox = null;

  const ensureMesh = () => {
    if (gpu || loading || !pipeline) return;
    loading = true;
    Promise.resolve(pipeline.getGpuMesh(WAGON_MODEL)).then((g) => {
      gpu = g ?? null;
      const cpu = pipeline?.cpuModels?.get(WAGON_MODEL);
      if (cpu?.positions) localBox = localAabb(cpu.positions);
    }).catch(() => {}).finally(() => { loading = false; });
  };

  return {
    /** The host's mesh pipeline (SpawnWagon's CreateDaggerfallMeshGameObject). */
    attach(p) { pipeline = p ?? null; gpu = null; localBox = null; if (pipeline) ensureMesh(); return this; },
    /**
     * One frame (UpdateWagon). `feet` and `yaw` are the host's; the body
     * is the player object - the capsule CENTRE, `feet + height / 2`,
     * facing the yaw.
     */
    tick(dt, { feet = null, yaw = 0, height = 1.8, cart = false, onExteriorPath = false, raycast = null } = {}) {
      if (!feet) return w;
      const body = [feet[0], feet[1] + height / 2, feet[2]];
      w = updateWagon(w, { dt, showCart: showCart(), cart, bodyPos: body, bodyForward: [Math.sin(yaw), 0, Math.cos(yaw)], onExteriorPath, raycast });
      if (w.active) ensureMesh();
      return w;
    },
    /** The floating origin moved the world: the cart moves with it. */
    rebase(delta) {
      if (!delta || !w.pos) return;
      w = { ...w, pos: [w.pos[0] + delta[0], w.pos[1] + delta[1], w.pos[2] + delta[2]] };
    },
    /** Draw it, if it is active and the mesh has arrived. */
    draw(renderer, texRemap = null) {
      const m = wagonMatrix(w);
      if (!m || !gpu || !renderer?.drawMesh) return false;
      renderer.drawMesh(gpu, m, texRemap);
      return true;
    },
    /**
     * The custom activation's target (RegisterCustomActivation at 3.2):
     * the trigger box over the mesh's bounds (IL_1e99-IL_1eb3). The pick
     * publishes the ray's reach so the ARM can refuse out loud, as every
     * activatable family in this port does (AUDIT 65 MC-2).
     */
    targets(rayDistance = WAGON_REACH) {
      const m = wagonMatrix(w);
      if (!m) return [];
      const box = localBox ? transformedAabb(localBox, m) : [w.pos[0] - 1, w.pos[1] - 1, w.pos[2] - 1, w.pos[0] + 1, w.pos[1] + 1, w.pos[2] + 1];
      return [{ key: 'eotbWagon', aabb: { min: [box[0], box[1], box[2]], max: [box[3], box[4], box[5]] }, distance: rayDistance, reach: WAGON_REACH }];
    },
    /** CheckWagon, with the host's two doors. */
    activate(mode, { say = null, openInventoryWithWagon = null } = {}) {
      if (checkWagon(mode) === 'info') { say?.(WAGON_INFO_TEXT); return 'info'; }
      openInventoryWithWagon?.();
      return 'inventory';
    },
    state() { return w; },
    reset() { w = freshWagon(); },
  };
}

export const eotbWagon = createEotbWagon();
