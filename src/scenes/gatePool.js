// @ts-check
// WB2 (2026-09-25, Mac: "A gate model would be spawned with a timer that leads to a completely different area"):
// THE GATE THE WORLD HOST STANDS - the pool on the runtime pools' shape (scenes/camps.js, scenes/horseCartPool.js):
// the stone (world/gateModel.js, uploaded once with its own art - world/gateArt.js), the fire and the beacon
// (render/gatePass.js), its collider, its light, the eye's box and its names, the countdown over the screen, and
// the door into the arena. Design: bible/11-Multiplayer/World-Bosses.md section 3.
//
// NOTHING HERE IS SAVED OR SENT. Where and when a gate stands is the clock's (net/gateLaw.js) over the map files
// (systems/gateSite.js) - the omen hands it over (systems/gateOmen.js standing()), and this pool stands the stone
// where that says, every frame, in THIS scene's frame: the pixel's translation plus the spot (the streaming host's
// own sum), so a floating-origin recentre moves the gate with the world and the collider is stood again when its
// matrix moves. The ground is the built pixel's (the host's `heightAt`). GATE-SEEN (2026-09-26, Mac: "Somepeople cant
// see the gate spawn" - "No oblivion portal to enter"): a gate on a pixel NOT yet built stood nowhere, the beacon too -
// and the streamed grid is the Land View Distance's, so from the town the omen names (2 to 4 pixels off) a player on a
// short view saw no gate at all, and "the gate is found by looking up" was false for them. Such a gate stands its
// BEACON alone now, on the ground the pixel will be built from (the host's `groundAt` - the terrain sampler's own
// kernel): no stone, no collider, no light, no door, until the pixel is built and the gate stands whole.
//
// ITS LIFE, off the phase: RISING (it climbs out of the ground over GATE_RISE_MS, the fire and the beacon fading in),
// SEALED (the fire an ember, the countdown to the opening), OPEN (the fire blazing, walked through or activated to
// enter), CLOSED (sealed again after 22:00, no way in), COLLAPSING (the kill or the wrath: it sinks over
// GATE_COLLAPSE_MS and the beacon goes out). The collider stands only while the gate stands risen.
//
// THE DOOR. Activate the fire, or walk through it while it is open: `enter(gate)` - the host's arena door (WB3).
// A gate that is not open says why; a relay that cannot hold a gate's arena says "not yet" (`ready()` false - the
// wire's relaySupportsGate, WB3), and nothing else happens.
//
// Not a DFU member. Ledger A (WB).
import { buildGateModel, gateArchProfile, GATE_ARCHIVE, GATE_HEIGHT, PORTAL_CENTRE_Y, ARCH_Y0, ARCH_Y1, ARCH_PROFILE_N } from '../world/gateModel.js';
import { gateArt } from '../world/gateArt.js';
import { GatePassRenderer, gateSpinRate } from '../render/gatePass.js';
import { gateSceneXZ } from '../systems/gateOmen.js';
import { gateYaw, gatePhase, gateCountdown, countdownText, GATE_RISE_MS, GATE_COLLAPSE_MS } from '../net/gateLaw.js';
import { trs } from '../world/mat4.js';
import { RAY_DISTANCE } from '../player/activate.js';

/** The collider's bucket for the gate's stone. */
export const GATE_BUCKET = 'wb:gate';
/** The eye's reach to the fire (the activation's own), and the ray's length. */
export const GATE_REACH = 4;
/** The countdown stands at the top of the screen within this many metres of the gate. */
export const GATE_BANNER_M = 60;
/** The fire's light: over the threshold, and how far it reaches. */
export const GATE_LIGHT_UP = PORTAL_CENTRE_Y;
export const GATE_LIGHT_RANGE = 24;
/** How fast the fire eases between sealed and open (per second). */
export const GATE_OPEN_EASE = 0.6;
/** AUDIT WB C7: the one empty answer for no gate - the host asks for the lights and the targets every frame. */
const NO_GATE = Object.freeze([]);
/** A refusal said again no sooner than this (a player pressing at a sealed gate hears it once a while). */
export const GATE_SAY_MS = 3000;
/** How close to the fire's plane a step through it counts (metres either side). */
export const GATE_STEP_M = 1.5;

/** The words a gate answers with. */
export const GATE_TEXT = Object.freeze({
  name: 'Oblivion Gate',
  opensIn: (left) => `The gate is sealed. It opens in ${left}.`,
  sealed: 'The gate has sealed.',
  notYet: 'The gate will not open to you yet.',
});

/**
 * The gate's place in the scene now: its foot (the ground under the spot, the rise already in y), its turn, how open
 * its fire is and how far it has faded in - or null when it stands nowhere. Pure.
 * @param {{day:number, px:number, py:number, spot:number[], phase:string, t:{omenAt:number, riseAt:number, openAt:number, sealAt:number, wrathAt:number}, fellAt:number|null}} g the omen's `standing()`
 * @param {{pixelTranslation:(px:number, py:number)=>number[], heightAt:(x:number, z:number)=>number, now:number, groundAt?:((px:number, py:number, x:number, z:number)=>number)|null}} at
 */
export function gatePlacement(g, { pixelTranslation, heightAt, now, groundAt = null }) {
  if (!g) return null;
  const [x, z] = gateSceneXZ(g, pixelTranslation(g.px, g.py));
  let ground = heightAt(x, z);
  // GATE-SEEN: a pixel not built yet - the beacon alone, on the ground it will be built from
  const coarse = !Number.isFinite(ground);
  if (coarse) ground = groundAt ? groundAt(g.px, g.py, x, z) : NaN;
  if (!Number.isFinite(ground)) return null;
  const phase = gatePhase(g.t, now, g.fellAt);
  let rise = 1, fade = 1;
  if (phase === 'rising') { rise = Math.max(0, Math.min(1, (now - g.t.riseAt) / GATE_RISE_MS)); fade = rise; }
  if (phase === 'collapsing') {
    const end = Number.isFinite(g.fellAt) ? Math.min(/** @type {number} */ (g.fellAt), g.t.wrathAt) : g.t.wrathAt;
    const sink = Math.max(0, Math.min(1, (now - end) / GATE_COLLAPSE_MS));
    rise = 1 - sink; fade = 1 - sink;
  }
  if (phase === 'gone' || phase === 'quiet' || phase === 'omen') return null;
  const eased = rise * rise * (3 - 2 * rise);   // it heaves out of the ground and settles, not at a constant crawl
  return { day: g.day, phase, origin: [x, ground - (1 - eased) * GATE_HEIGHT, z], ground, yaw: gateYaw(g.day), fade, risen: rise >= 1, coarse };
}

/** The half-width of the fire's opening at a height over the gate's foot (the arch's own profile, as the pass reads it). */
export function openingHalfWidth(profile, y) {
  if (!(y >= ARCH_Y0 && y <= ARCH_Y1)) return 0;
  const t = ((y - ARCH_Y0) / (ARCH_Y1 - ARCH_Y0)) * (ARCH_PROFILE_N - 1);
  const i = Math.min(ARCH_PROFILE_N - 1, Math.floor(t)), j = Math.min(ARCH_PROFILE_N - 1, i + 1);
  return profile[i] + (profile[j] - profile[i]) * (t - i);
}

/** The fire's slab as a box in the scene: its widest half-width, the arch's height, a metre deep - turned with the
 *  gate and boxed again (the eight corners' bounds). */
export function fireBox(place, profile, halfW = null) {
  const w = halfW ?? Math.max(...profile), c = Math.cos(place.yaw), s = Math.sin(place.yaw), o = place.origin;
  const min = [Infinity, o[1] + ARCH_Y0, Infinity], max = [-Infinity, o[1] + ARCH_Y1, -Infinity];
  for (const lx of [-w, w]) for (const lz of [-0.5, 0.5]) {
    const x = o[0] + c * lx + s * lz, z = o[2] - s * lx + c * lz;
    min[0] = Math.min(min[0], x); max[0] = Math.max(max[0], x); min[2] = Math.min(min[2], z); max[2] = Math.max(max[2], z);
  }
  return { min, max };
}

/** A point in the gate's own frame (x across the arch, y up from its foot, z through the fire) - trs's R_y undone. */
export function gateLocal(place, p) {
  const dx = p[0] - place.origin[0], dz = p[2] - place.origin[2];
  const c = Math.cos(place.yaw), s = Math.sin(place.yaw);
  return [c * dx - s * dz, p[1] - place.origin[1], s * dx + c * dz];
}

/**
 * @param {{
 *   renderer?: any, gl?: WebGL2RenderingContext|null, collider?: () => any,
 *   standing: () => any, pixelTranslation: (px:number, py:number) => number[], heightAt: (x:number, z:number) => number,
 *   now: () => number, feet?: () => (number[]|null), say?: (text: string) => void, banner?: (text: string|null) => void,
 *   ready?: () => boolean, enter?: (gate: any) => void, groundAt?: ((px:number, py:number, x:number, z:number) => number)|null,
 * }} deps
 */
export function createGatePool({
  renderer = null, gl = null, collider = () => null, standing, pixelTranslation, heightAt, now,
  feet = () => null, say = () => {}, banner = () => {}, ready = () => false, enter = () => {}, groundAt = null,
}) {
  const model = buildGateModel();
  const profile = gateArchProfile(model);
  let mesh = null, meshTried = false;
  let pass = null, passTried = false;
  let place = null, g = null;
  let open = 0;
  /** AUDIT WB C6: the vortex's turn, accumulated at the open's rate as it eases (a turn in [0, 1)) */
  let spin = 0;
  let colliderAt = null;   // the matrix the collider's stone stands at, or null
  let lastLz = null;
  let saidAt = -Infinity;

  /** AUDIT WB C7: the stone's matrix, made again only when its place moves (the draw and the collider ask every frame) */
  let _mat = null, _matKey = '';
  const matrixOf = (p) => { const k = `${p.origin[0]},${p.origin[1]},${p.origin[2]},${p.yaw}`; if (k !== _matKey) { _matKey = k; _mat = trs(p.origin[0], p.origin[1], p.origin[2], 0, (p.yaw * 180) / Math.PI, 0); } return _mat; };
  /** AUDIT WB C7: the fire's half-width, measured once (the box asks every frame) */
  const fireHalfW = Math.max(...profile);
  const sameMatrix = (a, b) => { if (!a || !b) return false; for (let i = 0; i < 16; i++) if (Math.abs(a[i] - b[i]) >= 5e-4) return false; return true; };

  function ensureMesh() {
    if (mesh || meshTried || !renderer?.createMesh) return;
    meshTried = true;
    try {
      for (const [rec, art] of gateArt()) {
        renderer.uploadTexture?.(GATE_ARCHIVE, rec, art.albedo);
        renderer.uploadEmissionTexture?.(GATE_ARCHIVE, rec, art.emission);
      }
      mesh = renderer.createMesh(model);
    } catch (e) { console.warn('[gate] the stone would not build', e?.message ?? e); mesh = null; }
  }
  function ensurePass() {
    if (pass || passTried || !gl) return;
    passTried = true;
    try { pass = new GatePassRenderer(gl, profile); } catch (e) { console.warn('[gate] the fire would not build', e?.message ?? e); pass = null; }
  }
  function standCollider() {
    const col = collider();
    if (!col?.addMesh) return;
    const want = place?.risen && !place.coarse ? matrixOf(place) : null;   // GATE-SEEN: a beacon alone stands nothing to walk into
    if (want ? sameMatrix(want, colliderAt) : colliderAt === null) return;
    col.removeBucket?.(GATE_BUCKET);
    colliderAt = null;
    if (!want) return;
    col.addMesh(GATE_BUCKET, model.positions, model.indices, want);
    colliderAt = want;
  }
  /** Say `text`, but not again inside GATE_SAY_MS. */
  function refuse(text) {
    const t = now();
    if (t - saidAt < GATE_SAY_MS) return;
    saidAt = t;
    say(text);
  }
  /** The door: open and a relay that holds arenas, the host's; else the reason, once a while. */
  function tryEnter() {
    if (!place || !g || place.coarse) return false;
    if (place.phase === 'open') {
      if (!ready()) { refuse(GATE_TEXT.notYet); return false; }
      enter({ day: g.day, near: g.near, origin: place.origin, yaw: place.yaw, px: g.px, py: g.py, spot: g.spot });
      return true;
    }
    const cd = gateCountdown(g.t, now(), place.phase);
    refuse(cd?.to === 'open' ? GATE_TEXT.opensIn(countdownText(cd.ms)) : GATE_TEXT.sealed);
    return false;
  }

  return {
    /** One frame: where the gate stands now, its fire's ease, its collider, the step through it, the countdown. */
    frame(dt = 0) {
      g = standing?.() ?? null;
      place = g ? gatePlacement(g, { pixelTranslation, heightAt, now: now(), groundAt }) : null;
      const target = place?.phase === 'open' ? 1 : 0;
      open += Math.sign(target - open) * Math.min(Math.abs(target - open), GATE_OPEN_EASE * Math.max(0, dt));
      spin = (spin + gateSpinRate(open) * Math.max(0, dt)) % 1;
      if (place) { ensureMesh(); ensurePass(); }
      standCollider();
      // the step through the fire: the feet crossing its plane inside the opening, while it stands open
      const f = place && !place.coarse ? feet() : null;   // GATE-SEEN: no step, no countdown at a beacon alone
      if (f && place.phase === 'open') {
        const [lx, ly, lz] = gateLocal(place, f);
        const inside = Math.abs(lx) < openingHalfWidth(profile, Math.max(ARCH_Y0 + 0.05, ly + 0.9)) && Math.abs(lz) < GATE_STEP_M;
        if (inside && lastLz !== null && Math.sign(lz) !== Math.sign(lastLz) && lz !== 0) tryEnter();
        lastLz = inside ? lz : null;
      } else lastLz = null;
      // the countdown over the screen, near the gate
      if (place && f && Math.hypot(f[0] - place.origin[0], f[2] - place.origin[2]) <= GATE_BANNER_M) {
        const cd = gateCountdown(g.t, now(), place.phase);
        banner(cd ? `${GATE_TEXT.name} - ${cd.to === 'open' ? 'opens' : 'seals'} in ${countdownText(cd.ms)}` : (place.phase === 'closed' ? `${GATE_TEXT.name} - sealed` : null));
      } else banner(null);
      return place;
    },
    /** The stone, in the host's world pass. */
    draw(r = renderer, texRemap = null) {
      if (!place || place.coarse || !mesh || !r?.drawMesh) return 0;
      r.drawMesh(mesh, matrixOf(place), texRemap);
      return 1;
    },
    /** AUDIT WB C7: whether a gate stands to be drawn - the host builds the pass's arguments only then. */
    stands: () => !!place && !!pass,
    /** The fire and the beacon: one foreign pass, after the world's (the duel wall's seat). */
    drawPass(proj, view, eye, seconds, fog = null) {
      if (!place || !pass) return 0;
      pass.draw([{ origin: place.origin, yaw: place.yaw, open, fade: place.fade, spin, beaconOnly: !!place.coarse }], proj, view, eye, seconds, fog);
      return pass.drawn;
    },
    /** The fire's light over the threshold, for the host's list. */
    lights() {
      if (!place || place.coarse || place.fade <= 0) return NO_GATE;
      return [{ x: place.origin[0], y: place.origin[1] + GATE_LIGHT_UP, z: place.origin[2], range: GATE_LIGHT_RANGE * place.fade * (0.5 + 0.5 * open) }];
    },
    /** The eye's box: the FIRE, not the stone - a player standing on the plinth is inside the gate's own bounds, and a
     *  box they stand in would win every press they made there. The opening's slab, turned with the gate. */
    targets() {
      if (!place || !place.risen || place.coarse) return NO_GATE;
      return [{ key: `gate:${place.day}`, aabb: fireBox(place, profile, fireHalfW), distance: RAY_DISTANCE, reach: GATE_REACH, noSurface: true }];
    },
    /** WORLD-HOVER: the gate's name and its countdown. */
    hoverName(key) {
      if (typeof key !== 'string' || !key.startsWith('gate:') || !place || !g) return null;
      const cd = gateCountdown(g.t, now(), place.phase);
      return cd ? `${GATE_TEXT.name} (${cd.to === 'open' ? 'opens' : 'seals'} in ${countdownText(cd.ms)})` : GATE_TEXT.name;
    },
    /** A press on the gate. */
    activate(key) { return typeof key === 'string' && key.startsWith('gate:') ? tryEnter() : false; },
    /** The pool's state, for the tests and the probes. */
    state: () => ({ place, open, collider: !!colliderAt, mesh: !!mesh, pass: !!pass }),
    /** A transition takes the stone's collider down (the next frame stands it again where it belongs). */
    destroyAll() {
      collider()?.removeBucket?.(GATE_BUCKET);
      colliderAt = null; place = null; lastLz = null;
      banner(null);
    },
  };
}
