// @ts-check
// SD4b (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 6): A SUPER DUNGEON'S END -
// THE RIFT AND THE RETURN, stood by the dungeon host (scenes/dungeonContext.js) where world/sdDungeon.js places them.
//
//  - THE RIFT: SD-LOOK (2026-10-08, bible/11-Multiplayer/Super-Dungeons-Look.md section 1) - a brass astrolabe stood on its
//    edge, its face square to its hall's long line (world/sdDungeon.js sdRiftFace): the crater, the plinth and its claws
//    (world/sdRiftModel.js - the one part that casts), the outer gear ticking a tooth forward each second on the
//    escapement (world/sdLook.js sdTick) on the realm's anchored clock - every screen ticks together - the hour-ring
//    ratcheting an hour BACK on each toll of its bell, two studs a block counting how long its Hour stands, the iris whose
//    APERTURE IS ITS STATE (world/sdDungeon.js riftLook - open, not yet, collapsing, closed, refused), three broken pieces
//    of ring orbiting it; and through the iris the Shattered Hour's own sky, its light spilling down the hall and across
//    the floor (render/sdRiftPass.js, render/sdHalo.js - the host draws them from `look`, `halos` and `lights`). Its
//    meshes stand among the dungeon's dynamic draws (`stand({ dynamicDraws })`, as the Remnant's do), each that turns
//    `noShadow` - nothing that moves rebuilds a shadow's cube (LA-SHADOW3's everyLightCasts). Its sound is a bell heard
//    under water (systems/sdRiftSound.js), looped where it stands.
//  - THE RETURN: SD-LOOK - a pale lancet arch banded in silver beside it, its keystone's clock ticking FORWARD (here, time
//    runs on), its window looking home (the Bay's sky at the world's hour), standing until the boss falls.
//  - THE STEP: `frame(feet)` hands the host the one the feet stepped INTO this frame - outside, then inside, the Portal
//    Stones' latch (systems/portalStone.js portalStepIn) - so standing in one asks once; a gap in the frames (feet that
//    jumped, a host held for seconds - never a slow frame, AUDIT SD IV F3) forgets the step.
//  - THE PRESS: `targets()` stands each in the activation ray (`sdrift:0`, `sdreturn:0`), `hoverName(key)` names it on
//    the plaque, and `press(key)` hands it to the host as a step does.
//  - SD10 (2026-10-07): THE WAY HOME in the Shattered Hour (section 11's collapse) - the Return stood alone, later, where
//    the Remnant fell (`standReturn`), under the place's own words (`retTitle`, `retTo` - SD_HOME_TEXT): its step or press
//    is the host's way out of the Hour to the Hollow's door. AUDIT SD II (L6 F9, F16): PRESSED, NEVER WALKED INTO - it
//    stands where the Remnant fell, where its spoils land - and it RISES out of the floor (SD_HOME_RISE_MS, the gate's
//    portal's) with the Rift's bell tolled once, a fourth higher.
//
// Not a DFU member. Ledger A (SUPER-DUNGEONS).

import { SD_RETURN_SIZE, SD_RIFT_REACH_M, SD_RETURN_REACH_M, SD_END_TEXT, inSdPortal, SD_RIFT_OPEN_LOOK } from '../world/sdDungeon.js';
import { startRiftBell, tollRiftBell, RIFT_BELL_SECONDS } from '../systems/sdRiftSound.js';
import { RAY_DISTANCE, DEFAULT_ACTIVATION_DISTANCE } from '../player/activate.js';
import { buildRiftStatic, buildRiftGear, buildHourRing, buildRiftStuds, irisModel, irisPositions, buildRiftShard, buildReturnModel, buildReturnHand, returnDialAt, riftCentreY, SD_RIFT_PARTS, SD_RIFT_STUDS, SD_RETURN_ARCH } from '../world/sdRiftModel.js';
import { sdRiftArt, SD_RIFT_RECORD } from '../world/sdRiftArt.js';
import { SD_REALM_ARCHIVE, SD_REALM_BRASS_RECORD, SD_REALM_COBBLE_RECORD, SD_REALM_EDGE_RECORD } from '../world/sdRealm.js';
import { realmArt } from '../world/sdRealmArt.js';
import { hallGlowArt, SD_GLOW_COLORS, SD_HALL_GLOW_RECORD } from '../world/sdHallArt.js';
import { SD_TICK_EASE_S, SD_LIGHT } from '../world/sdLook.js';
import { multiply } from '../world/mat4.js';

/** SD10: the way home's words - its plaque, and what is said as it carries a player out of the Hour. */
export const SD_HOME_TEXT = Object.freeze({
  title: 'The Way Home',
  to: 'To the Abyss Dungeon\'s door',   // AUDIT SD III (T15): the player's word for it - "the Hollow's door"
  taken: 'The way home carries you out of the Hour, to the Abyss Dungeon\'s door.',
  rises: 'The way home stands open.',   // AUDIT SD II (L6 F16): said as it rises (the fall's readout said where)
});
/** AUDIT SD II (L6 F16): how long the way home takes to rise out of the floor (ms) - the gate's portal's own
 *  (world/gateArena.js PORTAL_RISE_MS) - and how long after it began to rise it is still said and tolled (a page that
 *  comes later finds it standing, in silence). */
export const SD_HOME_RISE_MS = 1500;
export const SD_HOME_SAY_MS = SD_HOME_RISE_MS + 1000;
/** The keys the activation ray stands them under. */
export const SD_RIFT_KEY = 'sdrift:0';
export const SD_RETURN_KEY = 'sdreturn:0';
/** A step forgotten across a gap (ms) or a jump (m): a door, a teleport, a host held (a window, a load). AUDIT SD IV
 *  (F3): never a slow frame - the hosts' dt cap moves the feet a tenth of a second's walk a frame however long it took,
 *  so the jump alone tells a teleport; at 250 ms no walk-in was taken under 4 frames a second, nor across a hitch. */
export const SD_STEP_GAP_MS = 2000;
export const SD_STEP_JUMP_M = 1.5;
/** AUDIT SD III (A7): how often a Rift standing without its bell asks for it again (ms). */
export const SD_BELL_ASK_MS = 1000;
/** SD-LOOK: how long the iris takes to ease to its state (s); the hour-ring's jolt as it ratchets back (s) and its
 *  overshoot (a share of an hour); the light's swell on a toll and its fade (s); a refusal's ember (s); a step's ripple
 *  (s); the reveal - the first clear sight of it - asked each SD_REVEAL_ASK_MS within SD_REVEAL_M, its flare (s). */
export const SD_IRIS_EASE_S = 0.6;
export const SD_RATCHET_S = 0.25;
export const SD_RATCHET_OVER = 0.08;
export const SD_TOLL_SWELL = 0.15;
export const SD_TOLL_FADE_S = 1.2;
export const SD_REFUSE_S = 1;
export const SD_RIPPLE_S = 1.5;
export const SD_REVEAL_ASK_MS = 250;
export const SD_REVEAL_M = 30;
export const SD_REVEAL_S = 0.6;
/** SD-LOOK: the Rift's light - before its face (a share of its size), its reach (its size's times, never past a
 *  hall), the Return's (moon) and its reach. */
export const SD_RIFT_LIGHT = Object.freeze({ ahead: 0.55, reach: 3, maxReach: 21, gain: 0.8, ret: 0.6, retReach: 4.5 });

/** AUDIT SD II (L2 F9): where the Rift's frame keeps its numbers (`rift.n`). */
const N_GEAR = 0, N_RING = 1, N_IRIS_T = 2, N_TOLL = 3, N_IRIS = 4, N_CY = 5, N_A = 6, N_B = 7, N_R = 8;
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const NONE = Object.freeze([]);
/** Draw records for a state: cold and red swap the lit atlas by a draw's texRemap. */
const LIT_KEY = `${SD_REALM_ARCHIVE}_${SD_RIFT_RECORD.lit}`;
const REMAP = Object.freeze({
  cold: new Map([[LIT_KEY, `${SD_REALM_ARCHIVE}_${SD_RIFT_RECORD.cold}`]]),
  red: new Map([[LIT_KEY, `${SD_REALM_ARCHIVE}_${SD_RIFT_RECORD.red}`]]),
});

const _uploaded = new WeakSet();
/** The Rift's atlas, uploaded once per renderer - each record's albedo and its own light. */
export function ensureSdEndArt(renderer) {
  if (!renderer || _uploaded.has(renderer) || typeof renderer.uploadTexture !== 'function') return;
  _uploaded.add(renderer);
  // its atlas, and the realm's records it wears beside it (brass, the cobbles its crater falls back to, the edge line's
  // gold on its lit studs, the fray's ember on its going ones) - a Hollow is no realm: none of them are up there
  const realm = new Map(realmArt());
  /** @type {Array<[number, any]>} */
  const worn = [[SD_REALM_BRASS_RECORD, realm.get(SD_REALM_BRASS_RECORD)], [SD_REALM_COBBLE_RECORD, realm.get(SD_REALM_COBBLE_RECORD)], [SD_REALM_EDGE_RECORD, realm.get(SD_REALM_EDGE_RECORD)], [SD_HALL_GLOW_RECORD.fray, hallGlowArt(SD_GLOW_COLORS.fray)]];
  for (const [rec, art] of [...sdRiftArt(), ...worn]) {
    renderer.uploadTexture(SD_REALM_ARCHIVE, rec, art.albedo);
    renderer.uploadEmissionTexture?.(SD_REALM_ARCHIVE, rec, art.emission, { white: true });
  }
}

/** A portal's activation box: `half` across either way of its axis, from its foot to `height` above it. */
const boxOf = (at, half, height) => ({ min: [at[0] - half, at[1], at[2] - half], max: [at[0] + half, at[1] + height, at[2] + half] });
/** AUDIT SD IV (F33): how far either side of its plane the Rift is pressed (m) - its ring and its claws as drawn. */
export const SD_RIFT_PRESS_M = 0.35;
/** AUDIT SD IV (F33): THE RIFT'S PRESS IS ITS RING - a box turned with it (`base`, the stand's), its gear's span across,
 *  foot to top, SD_RIFT_PRESS_M either side of its plane, and the world box about that; no surface in the collider. Its
 *  whole sweep's cube (half its size every way, its size high) took the presses at the bodies and the floor before it. */
function riftPress(r) {
  const R = r.size / 2, top = r.cy + R, D = SD_RIFT_PRESS_M, b = r.base;
  const hx = Math.abs(b[0]) * R + Math.abs(b[8]) * D, hz = Math.abs(b[2]) * R + Math.abs(b[10]) * D;
  return {
    key: SD_RIFT_KEY, aabb: { min: [r.at[0] - hx, r.at[1], r.at[2] - hz], max: [r.at[0] + hx, r.at[1] + top, r.at[2] + hz] },
    obb: { m: Float64Array.from(b), box: [-R, 0, -D, R, top, D] }, noSurface: true, distance: RAY_DISTANCE, reach: DEFAULT_ACTIVATION_DISTANCE,
  };
}

// ── the stand's matrices: the foot, turned to face, up to the centre, turned about z - into scratch, nothing made ──────
const _t = new Float32Array(16), _r = new Float32Array(16);
function setT(m, x, y, z) { m.fill(0); m[0] = m[5] = m[10] = m[15] = 1; m[12] = x; m[13] = y; m[14] = z; return m; }
/** About y, taking the frame's +z to (sin a, 0, cos a). */
function setRy(m, a) { m.fill(0); const c = Math.cos(a), s = Math.sin(a); m[0] = c; m[2] = -s; m[5] = 1; m[8] = s; m[10] = c; m[15] = 1; return m; }
/** About z, CLOCKWISE by a as the front (-z) sees it. */
function setRz(m, a) { m.fill(0); const c = Math.cos(a), s = Math.sin(a); m[0] = c; m[1] = -s; m[4] = s; m[5] = c; m[10] = 1; m[15] = 1; return m; }
function setRx(m, a) { m.fill(0); const c = Math.cos(a), s = Math.sin(a); m[0] = 1; m[5] = c; m[6] = s; m[9] = -s; m[10] = c; m[15] = 1; return m; }
/** out = base * T(0, cy, 0) * Rz(theta) - a part turned about the ring's centre. AUDIT SD II (L2 F9): its two numbers read
 *  out of `n` (a double handed to a call is a number made), the product written out by hand. */
function about(out, base, n, iCy, iTheta) {
  const c = Math.cos(n[iTheta]), s = Math.sin(n[iTheta]), cy = n[iCy];
  for (let r = 0; r < 4; r++) {
    const b0 = base[r], b1 = base[4 + r];
    out[r] = c * b0 - s * b1; out[4 + r] = s * b0 + c * b1; out[8 + r] = base[8 + r]; out[12 + r] = cy * b1 + base[12 + r];
  }
  return out;
}
/** `m` set to a turn about x by n[i], or about z (clockwise as the front sees it). */
function setRxN(m, n, i) { m.fill(0); const c = Math.cos(n[i]), s = Math.sin(n[i]); m[0] = 1; m[5] = c; m[6] = s; m[9] = -s; m[10] = c; m[15] = 1; return m; }
function setRzN(m, n, i) { m.fill(0); const c = Math.cos(n[i]), s = Math.sin(n[i]); m[0] = c; m[1] = -s; m[4] = s; m[5] = c; m[10] = 1; m[15] = 1; return m; }
/** `m` set to a step up y by n[i]; to the stand at at + (0, n[i], 0) turned by n[iYaw] about y. */
function setTyN(m, n, i) { m.fill(0); m[0] = m[5] = m[10] = m[15] = 1; m[13] = n[i]; return m; }
function standAtN(m, at, n, iLift, iYaw) {
  m.fill(0); const c = Math.cos(n[iYaw]), s = Math.sin(n[iYaw]);
  m[0] = c; m[2] = -s; m[5] = 1; m[8] = s; m[10] = c; m[15] = 1; m[12] = at[0]; m[13] = at[1] + n[iLift]; m[14] = at[2];
  return m;
}

/**
 * A Super dungeon's end. `onRift()` / `onReturn()` are the host's - a step into either, or a press, hands it over;
 * `onRift()` answering false has not taken it (AUDIT SD III, H6: a step under way), and a walk-in stays armed.
 * SD5a: `riftTo` its plaque's row - the Shattered Hour's way back says where it leads. SD10: `retTitle` and `retTo` the
 * Return's (the Hour's way home says its own). AUDIT SD II (L6 F5): `riftCount()` the Rift's plaque's second row - how
 * long its Hour stands (world/sdDungeon.js sdRiftCount), or null. SD-LOOK: `look()` its state (world/sdDungeon.js
 * riftLook - open by default), `clock()` the realm's anchored seconds (every screen's gear ticks together; `now`'s without).
 * @param {{ renderer?: any, audio?: any, now?: () => number, onRift?: () => (boolean|null|void), onReturn?: () => void, riftTo?: string, retTitle?: string, retTo?: string, riftCount?: () => (string | null), look?: () => any, clock?: () => number }} [deps]
 */
export function createSdEnd({ renderer = null, audio = null, now = () => performance.now(), onRift = () => {}, onReturn = () => {}, riftTo = SD_END_TEXT.riftTo, retTitle = SD_END_TEXT.ret, retTo = SD_END_TEXT.retTo, riftCount = () => null, look = () => SD_RIFT_OPEN_LOOK, clock = null } = {}) {
  /** @type {any} */
  let rift = null;
  /** @type {any} AUDIT SD II (L6 F9, F16): when it began to rise, whether it has, and whether only a press takes it (the
   *  way home) */
  let ret = null;
  let bell = null, bellAskedAt = -Infinity, bellAt = -Infinity;
  let wasRift = null, wasRet = null, hasLast = false;
  /** AUDIT SD II (L2 F9): where the feet were last frame, and when - one scratch each */
  const lastFeet = [0, 0, 0], lastAt = new Float64Array([-Infinity]);
  /** the dungeon's dynamic draws the meshes stand among (the host's), and the ones this end put there */
  let draws = null;
  const mine = [];
  let _targets = NONE;
  const retarget = () => {
    const out = [];
    if (rift) out.push(riftPress(rift));
    if (ret) out.push({ key: SD_RETURN_KEY, aabb: boxOf(ret.at, SD_RETURN_SIZE.w / 2, SD_RETURN_SIZE.h), distance: RAY_DISTANCE, reach: DEFAULT_ACTIVATION_DISTANCE });
    _targets = out.length ? Object.freeze(out) : NONE;
  };
  /** A mesh stood among the draws: { gpu, object: { matrix }, noShadow, texRemap } - kept to take back. */
  const standMesh = (model, noShadow) => {
    if (!renderer?.createMesh) return null;
    ensureSdEndArt(renderer);
    const d = { gpu: renderer.createMesh(model), object: { matrix: new Float32Array(16) }, noShadow, texRemap: null, sdEnd: true };
    mine.push(d);
    draws?.push(d);
    return d;
  };
  const dropMesh = (d) => {
    if (!d) return;
    const i = mine.indexOf(d); if (i >= 0) mine.splice(i, 1);
    const j = draws ? draws.indexOf(d) : -1; if (j >= 0) draws.splice(j, 1);
    try { renderer?.destroyMesh?.(d.gpu); } catch { /* gone */ }
  };

  /** The Return's arch and hand stood at `at`, turned by `yaw`. */
  const standRet = (at, yaw) => {
    const w = SD_RETURN_SIZE.w, h = SD_RETURN_SIZE.h;
    const r = { at: [...at], yaw, arch: standMesh(buildReturnModel(w, h), false), hand: standMesh(buildReturnHand(), true), base: new Float32Array(16), window: new Float32Array(16), n: new Float64Array([0, yaw, 0]), outAt: -Infinity };
    setT(_t, at[0], at[1], at[2]); multiply(_t, setRy(_r, yaw), r.base);
    return r;
  };


  /** The light of the Rift's state now, a toll's swell and a reveal's flare in it. */
  const lightNow = (L, t) => {
    if (!rift) return 0;
    const sinceToll = Number.isFinite(rift.n[N_TOLL]) ? (t - rift.n[N_TOLL]) / 1000 : Infinity;
    const swell = sinceToll < SD_TOLL_FADE_S ? SD_TOLL_SWELL * (1 - sinceToll / SD_TOLL_FADE_S) : 0;
    const sinceReveal = (t - rift.revealAt) / 1000;
    const flare = sinceReveal >= 0 && sinceReveal < SD_REVEAL_S ? 0.6 * (1 - sinceReveal / SD_REVEAL_S) : 0;
    return L.light * (1 + swell + flare);
  };

  const api = {
    /** Stand the Rift (`rift` { at: its foot, size, face? }) and the Return (`retAt` its foot) - once; the bell with the
     *  Rift. SD-LOOK: `dynamicDraws` the host's (its meshes stand there), `probe` the collider's (its floor light's edge,
     *  its reveal), `floor` the hall's own floor texture ({ archive, record } - the crater's; the realm's cobbles without). */
    stand({ rift: r, retAt, dynamicDraws = null, probe = null, floor = null }) {
      if (rift || !r?.at) return false;
      draws = dynamicDraws ?? draws ?? [];
      const size = r.size, R = size / 2, face = r.face ?? [0, 0, 1], yaw = Math.atan2(face[0], face[2]);
      rift = {
        at: [...r.at], size, face: [...face], yaw, cy: riftCentreY(size), probe,
        base: new Float32Array(16), centre: new Float32Array(16), toLocal: new Float32Array(9),
        statics: standMesh(buildRiftStatic(size, floor), false),
        gear: standMesh(buildRiftGear(size), true),
        ring: standMesh(buildHourRing(size), true),
        studs: null, studKey: '',
        iris: standMesh(irisModel(size, SD_RIFT_OPEN_LOOK.aperture), true),
        shards: [0, 1, 2].map((k) => standMesh(buildRiftShard(size, k), true)),
        toned: null, studLit: -1, studEmber: -1, remap: undefined,
        n: new Float64Array(9),   // AUDIT SD II (L2 F9): the frame's numbers in place - the gear's turn, the ring's, the iris's last ease, the last toll, the iris's aperture
        radii: new Float32Array(8), tolls: 0, revealAt: -Infinity, revealed: false, revealAskAt: 0,
        refusedAt: -Infinity, steppedAt: -Infinity, ripple: [0, 0, 0, 9], light: [0, 0, 0],
      };
      rift.n[N_TOLL] = -Infinity; rift.n[N_IRIS] = SD_RIFT_OPEN_LOOK.aperture; rift.n[N_IRIS_T] = now(); rift.n[N_CY] = rift.cy; rift.n[N_R] = (SD_RIFT_PARTS.shardOrbit * size) / 2;
      rift.toned = [rift.statics, rift.gear, rift.ring, rift.iris, ...rift.shards].filter(Boolean);   // the parts the state's tone swaps, listed once
      setT(_t, r.at[0], r.at[1], r.at[2]); multiply(_t, setRy(_r, yaw), rift.base);
      multiply(rift.base, setT(_t, 0, rift.cy, 0), rift.centre);
      // the world's directions into the ring's frame (the turn's transpose)
      const c = Math.cos(yaw), s = Math.sin(yaw);
      rift.toLocal.set([c, 0, s, 0, 1, 0, -s, 0, c]);
      // the floor light's edge: the hall's own along eight bearings of the ring's frame, at a shin's height
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2, lx = Math.cos(a), lz = Math.sin(a);
        const dir = [lx * c + lz * s, 0, -lx * s + lz * c];
        const d = probe?.ray?.([r.at[0], r.at[1] + 0.3, r.at[2]], dir, 3 * size) ?? null;
        rift.radii[k] = Math.max(R * 0.95, Math.min(3 * size, d == null ? 1.6 * size : d - 0.1));
      }
      if (retAt) ret = { ...standRet(retAt, yaw), risesAt: -Infinity, pressed: false, up: true };
      retarget();
      bell = startRiftBell(audio, [r.at[0], r.at[1] + rift.cy, r.at[2]]);
      bellAskedAt = now();
      if (bell) bellAt = now();
      api.frame(null);
      return true;
    },
    /** SD10: the Return stood alone, after the stand (the Hour's way home, where the Remnant fell) - once while it stands.
     *  AUDIT SD II (L6 F9, F16): pressed alone; `age` how long ago it began to rise (ms - the fight's clock's, a page that
     *  comes later finds it risen), tolled while it rises. */
    standReturn(at, age = Infinity, { dynamicDraws = null, yaw = 0 } = {}) {
      if (ret || !at) return false;
      draws = dynamicDraws ?? draws ?? [];
      const ago = Number.isFinite(age) ? Math.max(0, age) : Infinity;
      ret = { ...standRet(at, yaw), risesAt: now() - ago, pressed: true, up: false };
      wasRet = null;
      retarget();
      if (ago < SD_HOME_SAY_MS) tollRiftBell(audio, [at[0], at[1] + SD_RETURN_SIZE.h / 2, at[2]]);
      api.frame(null);
      return true;
    },
    /** The Return goes out (the boss fell) - for good: it never stands again in this dungeon. Its press target drops at
     *  once (the law is never kept waiting on a picture). */
    returnOut() { if (!ret) return; dropMesh(ret.arch); dropMesh(ret.hand); ret = null; wasRet = null; retarget(); },
    /** SD-LOOK: what the hall sees happen - 'refused' (a press it would not take: the ring jerks back a tooth, the window
     *  clouds to ember) or 'step' (one went through: the window ripples from its heart). */
    pulse(kind) {
      if (!rift) return;
      const t = now();
      if (kind === 'refused') rift.refusedAt = t;
      if (kind === 'step') rift.steppedAt = t;
    },
    /** One frame: the parts turned and the light read; the step into either, handed to the host. `eye` (optional) asks
     *  the reveal. */
    frame(feet, eye = null) {
      const t = now();
      // AUDIT SD III (A7): the bell asked again while the Rift stands without one
      if (rift && !bell && audio && t - bellAskedAt >= SD_BELL_ASK_MS) { bellAskedAt = t; bell = startRiftBell(audio, [rift.at[0], rift.at[1] + rift.cy, rift.at[2]]); if (bell) bellAt = t; }
      if (rift) frameRift(t, eye);
      if (ret) frameRet(t);
      if (!feet) { wasRift = wasRet = null; hasLast = false; return null; }
      // AUDIT SD II (L2 F9): the jump's length by its square - Math.hypot made a list of its numbers every frame
      const dx = feet[0] - lastFeet[0], dy = feet[1] - lastFeet[1], dz = feet[2] - lastFeet[2];
      const gap = t - lastAt[0] > SD_STEP_GAP_MS || !hasLast || dx * dx + dy * dy + dz * dz > SD_STEP_JUMP_M * SD_STEP_JUMP_M;
      lastAt[0] = t; lastFeet[0] = feet[0]; lastFeet[1] = feet[1]; lastFeet[2] = feet[2]; hasLast = true;
      const inRift = !!rift && inSdPortal(feet, rift.at, Math.min(SD_RIFT_REACH_M, rift.size / 4), rift.size);
      const inRet = !!ret && !ret.pressed && inSdPortal(feet, ret.at, SD_RETURN_REACH_M, SD_RETURN_SIZE.h);   // AUDIT SD II (L6 F9): the way home pressed alone
      const enteredRift = inRift && wasRift === false && !gap;
      const enteredRet = inRet && wasRet === false && !gap;
      wasRift = inRift; wasRet = inRet;
      // AUDIT SD III (H6): a host that answers false has not taken it (a step under way) - the walk-in stays armed
      if (enteredRift) { const took = onRift(); if (took === false) wasRift = false; seen(took); return 'rift'; }
      if (enteredRet) { onReturn(); return 'return'; }
      return null;
    },
    /** The two in the activation ray - the one list, made as either stands or goes. */
    targets() { return _targets; },
    /** The plaque's words for either - a namer is handed every key the ray can win. */
    hoverName(key) {
      if (key === SD_RIFT_KEY && rift) { const n = riftCount(); return { title: SD_END_TEXT.rift, subs: n ? [riftTo, n] : [riftTo] }; }   // AUDIT SD II (L6 F5): and how long its Hour stands
      if (key === SD_RETURN_KEY && ret) return { title: retTitle, subs: [retTo] };   // SD10: the Hour's way home says its own
      return null;
    },
    /** A press on either, handed to the host as a step is. True when it was one of these. */
    press(key) {
      if (key === SD_RIFT_KEY && rift) { seen(onRift()); return true; }
      if (key === SD_RETURN_KEY && ret) { onReturn(); return true; }
      return false;
    },
    /** SD-LOOK: no billboards stand for them now (their meshes are among the dynamic draws) - kept for the hosts that ask. */
    batches: () => NONE,
    /** SD-LOOK: what the pass draws (render/sdRiftPass.js): the Rift's window and floor light, the Return's window home -
     *  `sky` { map, seconds, gain, clock } the Hour's painted sky, `hour` the world's hour (the Return's), or null. */
    look(eye, sky, hour = 12) {
      if (!rift && !ret) return null;
      const out = { window: null, floor: null, bay: null };
      const t = now(), L = look() ?? SD_RIFT_OPEN_LOOK;
      if (rift) {
        const R = rift.size / 2, light = lightNow(L, t), refused = (t - rift.refusedAt) / 1000;
        const ember = refused >= 0 && refused < SD_REFUSE_S ? 1 - refused / SD_REFUSE_S : L.tone === 'ember' ? 0.35 : 0;
        const stepped = (t - rift.steppedAt) / 1000;
        rift.ripple[2] = stepped >= 0 && stepped < SD_RIPPLE_S ? 1 : 0; rift.ripple[3] = stepped >= 0 && stepped < SD_RIPPLE_S ? stepped : SD_RIPPLE_S;   // never infinite: sin(-inf) is NaN, and a NaN ray blanks the window
        if (L.aperture > 0.01 && sky?.map) out.window = { model: rift.centre, toLocal: rift.toLocal, radius: SD_RIFT_PARTS.window * R, eye, light, ember, ripple: rift.ripple, sky };
        if (light > 0.01) {
          const col = L.tone === 'red' ? SD_LIGHT.red : L.tone === 'ember' ? SD_LIGHT.ember : SD_LIGHT.gold;
          rift.light[0] = col[0] * light; rift.light[1] = col[1] * light; rift.light[2] = col[2] * light;
          const since = Number.isFinite(rift.n[N_TOLL]) ? (t - rift.n[N_TOLL]) / 1000 : Infinity;
          out.floor = { model: rift.base, reach: Math.max(...rift.radii), radii: rift.radii, crater: SD_RIFT_PARTS.crater1 * R, gear: rift.n[N_GEAR], pulse: since < 3 ? since * 5 : -1, color: rift.light };
        }
      }
      if (ret && ret.up !== false) {
        const fade = Number.isFinite(ret.outAt) ? clamp01((t - ret.outAt) / 1500) : 0;
        out.bay = { model: ret.window ?? ret.base, key: 'return', outline: RETURN_OUTLINE, half: RETURN_HALF, hour, clouds: t / 1000, fade };
      }
      return out;
    },
    /** SD-LOOK: the halos the frame adds (render/sdHalo.js) - the Rift's heart, the Return's keystone. */
    halos() {
      _halos.length = 0;
      const t = now();
      if (rift) {
        const L = look() ?? SD_RIFT_OPEN_LOOK, k = lightNow(L, t) * Math.max(0.25, L.aperture);
        if (k > 0.01) { const c = L.tone === 'red' ? SD_LIGHT.red : L.tone === 'ember' ? SD_LIGHT.ember : SD_LIGHT.gold; _core.at = [rift.at[0], rift.at[1] + rift.cy, rift.at[2]]; _core.size = rift.size * 0.32; _core.color = [c[0] * 0.55 * k, c[1] * 0.55 * k, c[2] * 0.55 * k]; _halos.push(_core); }
      }
      if (ret && ret.up !== false) { const d = RETURN_DIAL, b = ret.base; _key.at = [b[12] + b[8] * d[2], b[13] + d[1], b[14] + b[10] * d[2]]; _key.size = 0.35; _key.color = SD_LIGHT.moon.map((v) => v * 0.35); _halos.push(_key); }
      return _halos;
    },
    /** SD-LOOK: the lights they cast - the Rift's before its face in its state's colour, the Return's moon. */
    lights() {
      _lights.length = 0;
      const t = now();
      if (rift) {
        const L = look() ?? SD_RIFT_OPEN_LOOK, k = lightNow(L, t);
        if (k > 0.01) {
          const c = L.tone === 'red' ? SD_LIGHT.red : L.tone === 'ember' ? SD_LIGHT.ember : SD_LIGHT.gold, b = rift.base, a = -SD_RIFT_LIGHT.ahead * rift.size;
          _rl.x = b[12] + b[8] * a; _rl.y = rift.at[1] + rift.cy; _rl.z = b[14] + b[10] * a;
          _rl.range = Math.min(SD_RIFT_LIGHT.maxReach, SD_RIFT_LIGHT.reach * rift.size); const g = k * SD_RIFT_LIGHT.gain; _rl.color = [c[0] * g, c[1] * g, c[2] * g];
          _lights.push(_rl);
        }
      }
      if (ret && ret.up !== false) { const b = ret.base; _ml.x = b[12] - b[8] * 0.6; _ml.y = ret.at[1] + 1.4; _ml.z = b[14] - b[10] * 0.6; _ml.range = SD_RIFT_LIGHT.retReach; _ml.color = SD_LIGHT.moon.map((v) => v * SD_RIFT_LIGHT.ret); _lights.push(_ml); }
      return _lights;
    },
    /** Where they stand (tests, the host's own questions). */
    get rift() { return rift ? { at: [...rift.at], size: rift.size, face: [...rift.face] } : null; },
    get ret() { return ret ? { at: [...ret.at], foot: ret.base[13] } : null; },   // SD-LOOK: `foot` - as far as it has risen
    /** SD-LOOK: the parts as drawn (tests and the lab): the draws this end stood, its iris's aperture, its hour-ring's turn. */
    get parts() { return rift ? { draws: [...mine], aperture: rift.n[N_IRIS], ringAngle: rift.n[N_RING], gearAngle: rift.n[N_GEAR], studs: rift.studKey } : { draws: [...mine] }; },
    /** Gone with the dungeon: the meshes freed and taken out of the draws, the bell stopped - at once, mid-animation too. */
    clear() {
      for (const d of [...mine]) dropMesh(d);
      rift = null; ret = null; _targets = NONE;
      try { if (bell?.fadeStop) bell.fadeStop(); else bell?.stop?.(); } catch { /* stopped */ }   // AUDIT SD III (A7): faded, never cut
      bell = null; bellAskedAt = -Infinity; bellAt = -Infinity;
    },
  };
  const _halos = [], _core = { at: [0, 0, 0], size: 1, color: [0, 0, 0] }, _key = { at: [0, 0, 0], size: 0.35, color: [0, 0, 0] };
  const _lights = [], _rl = { x: 0, y: 0, z: 0, range: 1, color: [0, 0, 0] }, _ml = { x: 0, y: 0, z: 0, range: 1, color: [0, 0, 0] };

  /** A step or a press the host refused - the Rift's state was not open: the hall sees it. */
  function seen(took) {
    const L = look() ?? SD_RIFT_OPEN_LOOK;
    if (took !== false && took !== null) api.pulse(L.state === 'open' ? 'step' : 'refused');
  }

  function frameRift(t, eye) {
    const L = look() ?? SD_RIFT_OPEN_LOOK, s = clock ? clock() : t / 1000;
    // THE GEAR: a tooth forward each second on the escapement (world/sdLook.js sdTick's sum, inline - AUDIT SD II, L2 F9:
    // a number handed back from a call is a number made) - twice a second in the collapse; a refusal jerks it back one
    const pitch = (Math.PI * 2) / SD_RIFT_PARTS.teeth, refused = (t - rift.refusedAt) / 1000;
    const jerk = refused >= 0 && refused < 0.3 ? -pitch * (1 - refused / 0.3) : 0;
    const sx = s * L.tickHz, si = Math.floor(sx), se = Math.min(1, (sx - si) / SD_TICK_EASE_S);
    rift.n[N_GEAR] = L.tickHz > 0 ? (si + se * se * (3 - 2 * se)) * pitch + jerk : jerk;
    if (rift.gear) about(rift.gear.object.matrix, rift.base, rift.n, N_CY, N_GEAR);
    // THE HOUR-RING: an hour BACK on each toll of its bell (its own loop's, so the toll and the jolt land together; the
    // realm's clock where no bell sounds), a jolt with a small overshoot and settle; still while it is not live
    const period = RIFT_BELL_SECONDS, since = Number.isFinite(bellAt) ? (t - bellAt) / 1000 - 0.05 : s;
    const tolls = Math.floor(since / period), into = since - tolls * period;
    if (L.tickHz > 0 && tolls !== rift.tolls) { rift.tolls = tolls; rift.n[N_TOLL] = t - into * 1000; }
    const e0 = into / SD_RATCHET_S, e = e0 < 0 ? 0 : e0 > 1 ? 1 : e0, jolt = e < 1 ? 1 - (1 - e) * (1 - e) * (1 + SD_RATCHET_OVER * 6 * e) : 1;
    rift.n[N_RING] = L.tickHz > 0 ? -((tolls - 1) + jolt) * (Math.PI / 6) : rift.n[N_RING];
    if (rift.ring) about(rift.ring.object.matrix, rift.base, rift.n, N_CY, N_RING);
    // THE STUDS: rebuilt only as their count changes (at most every 7.5 s in the collapse) - AUDIT SD II (L2 F9): asked
    // by their two numbers, never a key minted a frame
    if ((L.studs !== rift.studLit || L.ember !== rift.studEmber) && renderer?.createMesh) {
      rift.studLit = L.studs; rift.studEmber = L.ember; rift.studKey = `${L.studs}|${L.ember}`;
      dropMesh(rift.studs);
      rift.studs = standMesh(buildRiftStuds(rift.size, Math.min(SD_RIFT_STUDS, L.studs), Math.min(SD_RIFT_STUDS - L.studs, L.ember)), true);
    }
    if (rift.studs) rift.studs.object.matrix.set(rift.ring?.object.matrix ?? rift.centre);
    // THE IRIS: eased to its state's aperture over SD_IRIS_EASE_S, its vertices written only while it moves
    const want = L.aperture;
    if (Math.abs(rift.n[N_IRIS] - want) > 1e-4) {
      const dt = Math.min(0.1, Math.max(0, (t - rift.n[N_IRIS_T]) / 1000));
      const stepA = dt / SD_IRIS_EASE_S;
      rift.n[N_IRIS] = Math.abs(want - rift.n[N_IRIS]) <= stepA ? want : rift.n[N_IRIS] + Math.sign(want - rift.n[N_IRIS]) * stepA;
      if (rift.iris && renderer?.updateMeshVertices) { const p = irisPositions(rift.size, rift.n[N_IRIS]); renderer.updateMeshVertices(rift.iris.gpu, p.positions, p.normals); }
    }
    rift.n[N_IRIS_T] = t;
    if (rift.iris) rift.iris.object.matrix.set(rift.centre);
    // THE SHARDS: orbiting the rim on tilted paths, tumbling slowly - on the realm's clock
    for (let k = 0; k < 3; k++) {
      const d = rift.shards[k];
      if (!d) continue;
      const m = d.object.matrix, n = rift.n;
      n[N_A] = (k - 1) * 0.42; multiply(rift.centre, setRxN(_t, n, N_A), m);
      n[N_A] = (s * (0.05 + 0.02 * k) * (k === 1 ? -1 : 1)) * Math.PI * 2 + (k * Math.PI * 2) / 3; multiply(m, setRzN(_t, n, N_A), m);
      multiply(m, setTyN(_t, n, N_R), m);
      n[N_B] = s * (0.6 + 0.2 * k); multiply(m, setRxN(_t, n, N_B), m);
    }
    // the hall's tone: cold records when closed, cracked red when refused for good
    const remap = L.tone === 'cold' ? REMAP.cold : L.tone === 'red' ? REMAP.red : null;
    if (remap !== rift.remap) { rift.remap = remap; for (const d of rift.toned) d.texRemap = remap; }
    if (rift.statics) rift.statics.object.matrix.set(rift.base);
    // THE REVEAL: the first clear sight of it, once a visit - the bell tolled a fourth higher, the window flaring
    if (!rift.revealed && eye && t >= rift.revealAskAt && L.state === 'open') {
      rift.revealAskAt = t + SD_REVEAL_ASK_MS;
      const dx = rift.at[0] - eye[0], dy = rift.at[1] + rift.cy - eye[1], dz = rift.at[2] - eye[2], dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist < SD_REVEAL_M && dist > 1) {
        const hit = rift.probe?.ray?.(eye, [dx / dist, dy / dist, dz / dist], dist) ?? null;
        if (hit == null || hit >= dist - rift.size * 0.6) { rift.revealed = true; rift.revealAt = t; tollRiftBell(audio, [rift.at[0], rift.at[1] + rift.cy, rift.at[2]]); }
      }
    }
  }
  function frameRet(t) {
    // AUDIT SD II (L6 F16): the way home's foot as far as it has risen (rise's sum, inline)
    const k0 = ret.pressed ? (t - ret.risesAt) / SD_HOME_RISE_MS : 1, k = k0 < 0 ? 0 : k0 > 1 ? 1 : k0, n = ret.n;
    n[0] = -SD_RETURN_SIZE.h * (1 - k);
    ret.up = k >= 1;
    standAtN(ret.base, ret.at, n, 0, 1);
    if (ret.arch) ret.arch.object.matrix.set(ret.base);
    // the keystone's hand: a tick FORWARD each second - here, time runs on
    if (ret.hand) {
      multiply(ret.base, RETURN_DIAL_T, ret.hand.object.matrix);
      const hs = t / 1000, hi = Math.floor(hs), he = Math.min(1, (hs - hi) / SD_TICK_EASE_S);   // the escapement, inline
      n[2] = (hi + he * he * (3 - 2 * he)) * (Math.PI * 2) / 60;
      multiply(ret.hand.object.matrix, setRzN(_t, n, 2), ret.hand.object.matrix);
    }
    multiply(ret.base, RETURN_WINDOW_T, ret.window);
  }
  return api;
}

/** SD-LOOK: the keystone's dial on the Return (its own frame). */
const RETURN_DIAL = Object.freeze(returnDialAt(SD_RETURN_SIZE.h));
/** ...and the steps up to it and to the window's middle, made once. */
const RETURN_DIAL_T = setT(new Float32Array(16), RETURN_DIAL[0], RETURN_DIAL[1], RETURN_DIAL[2]);
const RETURN_WINDOW_T = setT(new Float32Array(16), 0, SD_RETURN_SIZE.h / 2 - 0.02, 0);
/** SD-LOOK: the Return's opening for its window (render/sdRiftPass.js archFan) - the arch's inner edge about the
 *  opening's middle, and the opening's half-size. */
const RETURN_HALF = Object.freeze([SD_RETURN_SIZE.w / 2, SD_RETURN_SIZE.h / 2]);
const RETURN_OUTLINE = Object.freeze((() => {
  const hw = SD_RETURN_SIZE.w / 2 - SD_RETURN_ARCH.jamb, h = SD_RETURN_SIZE.h, spring = h * SD_RETURN_ARCH.spring, top = h - SD_RETURN_ARCH.jamb * 1.2, n = SD_RETURN_ARCH.segs;
  const left = [];
  for (let j = 0; j <= n; j++) { const t = j / n; left.push([-hw + hw * Math.sin((t * Math.PI) / 2), spring + (top - spring) * (1 - Math.cos((t * Math.PI) / 2)) ** 0.9]); }
  const pts = [[-hw, 0.08], ...left, ...left.slice(0, -1).reverse().map((p) => [-p[0], p[1]]), [hw, 0.08], [-hw, 0.08]];
  return pts.map((p) => Object.freeze([p[0], p[1] - h / 2]));
})());
