// @ts-check
// SD4b (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 6): A SUPER DUNGEON'S END -
// THE RIFT AND THE RETURN, stood by the dungeon host (scenes/dungeonContext.js) where world/sdDungeon.js places them.
//
//  - THE RIFT: a ring of brass light turning slowly about a black-gold membrane (`riftFrame`, pure). Its frames are made
//    here once per renderer, as the companion's portal is (scenes/portalFx.js): albedo, and the same picture as its
//    emission, so it is self-lit underground; drawn in the blended pass with the place's foes (`conceal` mode 3), as wide
//    as its hall lets it stand. Its sound is a bell heard under water (systems/sdRiftSound.js), looped where it stands.
//  - THE RETURN: a small portal of pale light beside it (`returnFrame`, pure), standing until the boss falls.
//  - THE STEP: `frame(feet)` hands the host the one the feet stepped INTO this frame - outside, then inside, the Portal
//    Stones' latch (systems/portalStone.js portalStepIn) - so standing in one asks once; a gap in the frames (feet that
//    jumped, a frame not ticked) forgets the step.
//  - THE PRESS: `targets()` stands each in the activation ray (`sdrift:0`, `sdreturn:0`), `hoverName(key)` names it on
//    the plaque, and `press(key)` hands it to the host as a step does.
//  - SD10 (2026-10-07): THE WAY HOME in the Shattered Hour (section 11's collapse) - the Return's pale light stood alone,
//    later, where the Remnant fell (`standReturn`), under the place's own words (`retTitle`, `retTo` - SD_HOME_TEXT): its
//    step or press is the host's way out of the Hour to the Hollow's door.
//
// Not a DFU member. Ledger A (SUPER-DUNGEONS).

import { SD_RETURN_SIZE, SD_RIFT_REACH_M, SD_RETURN_REACH_M, SD_END_TEXT, inSdPortal } from '../world/sdDungeon.js';
import { startRiftBell } from '../systems/sdRiftSound.js';
import { RAY_DISTANCE, DEFAULT_ACTIVATION_DISTANCE } from '../player/activate.js';

export const RIFT_ARCHIVE = 'fxsdrift';
export const RETURN_ARCHIVE = 'fxsdreturn';
/** The Rift's frames: its brass turns an eighth of a turn over them (the ring's eight-fold teeth meet themselves), so a
 *  whole turn takes eight loops - slowly. */
export const RIFT_FRAMES = 16;
export const RIFT_FPS = 6;
export const RIFT_TEX = 96;
/** The Return's frames: a softer, quicker shimmer. */
export const RETURN_FRAMES = 12;
export const RETURN_FPS = 10;
export const RETURN_TEX = Object.freeze({ w: 40, h: 64 });
/** SD10: the way home's words - its plaque, and what is said as it carries a player out of the Hour. */
export const SD_HOME_TEXT = Object.freeze({
  title: 'The Way Home',
  to: 'To the Hollow\'s door',
  taken: 'The way home carries you out of the Hour, to the Hollow\'s door.',
});
/** The keys the activation ray stands them under. */
export const SD_RIFT_KEY = 'sdrift:0';
export const SD_RETURN_KEY = 'sdreturn:0';
/** A step forgotten across a gap (ms) or a jump (m): a door, a teleport, a frame not ticked. */
export const SD_STEP_GAP_MS = 250;
export const SD_STEP_JUMP_M = 1.5;

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const NONE = Object.freeze([]);

/**
 * One frame of the Rift as RGBA rows from the BOTTOM up (a world billboard's color32 order) - pure, for the upload and
 * the tests. The ring: brass light in eight teeth, a bright lip either side, turning; inside it the membrane, near black,
 * with slow gold swirling in it.
 * @returns {{ width: number, height: number, colors: Uint8ClampedArray }}
 */
export function riftFrame(k, n = RIFT_FRAMES, s = RIFT_TEX) {
  const out = new Uint8ClampedArray(s * s * 4);
  const turn = ((k / n) * 2 * Math.PI) / 8;   // the teeth's eighth of a turn
  const swirlT = (k / n) * 2 * Math.PI;       // the membrane's whole wave
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const u = ((x + 0.5) / s) * 2 - 1, v = ((y + 0.5) / s) * 2 - 1;
      const r = Math.hypot(u, v);
      if (r > 1) continue;
      const a = Math.atan2(v, u);
      const o = (y * s + x) * 4;
      let R, G, B, A;
      if (r >= 0.76) {
        // THE RING: brass teeth turning, its lips bright, its face warm
        const band = clamp01((r - 0.76) / 0.04) * clamp01((0.99 - r) / 0.03);
        const teeth = 0.5 + 0.5 * Math.cos(8 * (a - turn));
        const lip = Math.max(clamp01(1 - Math.abs(r - 0.79) / 0.02), clamp01(1 - Math.abs(r - 0.95) / 0.02));
        const glow = 0.55 + 0.3 * teeth + 0.35 * lip;
        R = 255 * glow; G = 178 * glow; B = 70 * glow + 40 * lip;
        A = 255 * band;
      } else {
        // THE MEMBRANE: black, gold swirling slowly in it, brightest at its rim
        const swirl = 0.5 + 0.5 * Math.sin(3 * a + 7 * r - swirlT);
        const gold = swirl ** 4 * (0.25 + 0.75 * r);
        const edge = clamp01((r - 0.62) / 0.14) ** 2;
        R = 14 + 190 * gold + 120 * edge; G = 9 + 128 * gold + 80 * edge; B = 3 + 26 * gold + 20 * edge;
        A = 255 * (0.88 + 0.12 * edge);
      }
      out[o] = R; out[o + 1] = G; out[o + 2] = B; out[o + 3] = A;
    }
  }
  return { width: s, height: s, colors: out };
}

/**
 * One frame of the Return: an oval of pale light, its heart white, a soft shimmer turning in it, fading at its edge.
 * @returns {{ width: number, height: number, colors: Uint8ClampedArray }}
 */
export function returnFrame(k, n = RETURN_FRAMES, w = RETURN_TEX.w, h = RETURN_TEX.h) {
  const out = new Uint8ClampedArray(w * h * 4);
  const phase = (k / n) * 2 * Math.PI;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = ((x + 0.5) / w) * 2 - 1, v = ((y + 0.5) / h) * 2 - 1;
      const r = Math.hypot(u, v);
      if (r > 1) continue;
      const a = Math.atan2(v, u);
      const o = (y * w + x) * 4;
      const shimmer = 0.5 + 0.5 * Math.sin(2 * a - 5 * r + phase);
      const core = clamp01(1 - r / 0.55);
      const light = 0.55 + 0.25 * shimmer + 0.35 * core;
      out[o] = 205 * light + 40 * core; out[o + 1] = 218 * light + 30 * core; out[o + 2] = 240 * light + 15 * core;
      out[o + 3] = 255 * clamp01((1 - r) / 0.25) * (0.6 + 0.4 * light);
    }
  }
  return { width: w, height: h, colors: out };
}

const _uploaded = new WeakSet();
/** The two portals' frames, uploaded once per renderer - albedo, and the same picture as its emission (self-lit). */
export function ensureSdEndArt(renderer) {
  if (!renderer || _uploaded.has(renderer) || typeof renderer.uploadTexture !== 'function') return;
  _uploaded.add(renderer);
  for (let k = 0; k < RIFT_FRAMES; k++) {
    const c32 = riftFrame(k);
    renderer.uploadTexture(RIFT_ARCHIVE, String(k), c32);
    renderer.uploadEmissionTexture?.(RIFT_ARCHIVE, String(k), c32, { white: true });
  }
  for (let k = 0; k < RETURN_FRAMES; k++) {
    const c32 = returnFrame(k);
    renderer.uploadTexture(RETURN_ARCHIVE, String(k), c32);
    renderer.uploadEmissionTexture?.(RETURN_ARCHIVE, String(k), c32, { white: true });
  }
}

/** A portal's activation box: `half` across either way of its axis, from its foot to `height` above it. */
const boxOf = (at, half, height) => ({ min: [at[0] - half, at[1], at[2] - half], max: [at[0] + half, at[1] + height, at[2] + half] });

/**
 * A Super dungeon's end. `onRift()` / `onReturn()` are the host's - a step into either, or a press, hands it over.
 * SD5a: `riftTo` its plaque's row - the Shattered Hour's way back says where it leads. SD10: `retTitle` and `retTo` the
 * Return's (the Hour's way home says its own).
 * @param {{ renderer?: any, audio?: any, now?: () => number, onRift?: () => void, onReturn?: () => void, riftTo?: string, retTitle?: string, retTo?: string }} [deps]
 */
export function createSdEnd({ renderer = null, audio = null, now = () => performance.now(), onRift = () => {}, onReturn = () => {}, riftTo = SD_END_TEXT.riftTo, retTitle = SD_END_TEXT.ret, retTo = SD_END_TEXT.retTo } = {}) {
  /** @type {{ at: number[], size: number, batch: any } | null} */
  let rift = null;
  /** @type {{ at: number[], batch: any } | null} */
  let ret = null;
  let bell = null;
  let wasRift = null, wasRet = null, lastFeet = null, lastAt = -Infinity;
  const born = now();
  /** AUDIT SD: the batches as the draw asks for them - one list, made again only when a portal stands or goes */
  let _batches = NONE;
  const rebatch = () => { _batches = rift || ret ? [rift?.batch, ret?.batch].filter(Boolean) : NONE; };

  const batchAt = (archive, at, w, h) => {
    if (!renderer?.createBillboardBatch) return null;
    ensureSdEndArt(renderer);
    const batch = renderer.createBillboardBatch(archive, '0', { w, h }, [[0, 0, 0]], { dynamic: true });
    batch.origin = [at[0], at[1], at[2]];
    batch.noShadow = true;
    batch.conceal = { mode: 3, alpha: 1, t: 0, phase: 0 };
    return batch;
  };
  const free = (batch) => { if (batch) { try { renderer.destroyBillboardBatch(batch); } catch { /* gone */ } } };

  return {
    /** Stand the Rift (`rift` { at: its foot, size }) and the Return (`retAt` its foot) - once; the bell with the Rift. */
    stand({ rift: r, retAt }) {
      if (rift || !r?.at) return false;
      rift = { at: [...r.at], size: r.size, batch: batchAt(RIFT_ARCHIVE, r.at, r.size, r.size) };
      if (retAt) ret = { at: [...retAt], batch: batchAt(RETURN_ARCHIVE, retAt, SD_RETURN_SIZE.w, SD_RETURN_SIZE.h) };
      rebatch();
      bell = startRiftBell(audio, [r.at[0], r.at[1] + r.size / 2, r.at[2]]);
      return true;
    },
    /** SD10: the Return stood alone, after the stand (the Hour's way home, where the Remnant fell) - once while it stands. */
    standReturn(at) {
      if (ret || !at) return false;
      ret = { at: [...at], batch: batchAt(RETURN_ARCHIVE, at, SD_RETURN_SIZE.w, SD_RETURN_SIZE.h) };
      wasRet = null;
      rebatch();
      return true;
    },
    /** The Return goes out (the boss fell) - for good: it never stands again in this dungeon. */
    returnOut() { if (!ret) return; free(ret.batch); ret = null; wasRet = null; rebatch(); },
    /** One frame: the frames turn; the step into either, handed to the host. */
    frame(feet) {
      const t = now();
      const age = (t - born) / 1000;
      if (rift?.batch) rift.batch.record = String(Math.floor(age * RIFT_FPS) % RIFT_FRAMES);
      if (ret?.batch) ret.batch.record = String(Math.floor(age * RETURN_FPS) % RETURN_FRAMES);
      if (!feet) { wasRift = wasRet = null; lastFeet = null; return null; }
      const gap = t - lastAt > SD_STEP_GAP_MS || !lastFeet || Math.hypot(feet[0] - lastFeet[0], feet[1] - lastFeet[1], feet[2] - lastFeet[2]) > SD_STEP_JUMP_M;
      lastAt = t; lastFeet = [feet[0], feet[1], feet[2]];
      const inRift = !!rift && inSdPortal(feet, rift.at, Math.min(SD_RIFT_REACH_M, rift.size / 4), rift.size);
      const inRet = !!ret && inSdPortal(feet, ret.at, SD_RETURN_REACH_M, SD_RETURN_SIZE.h);
      const enteredRift = inRift && wasRift === false && !gap;
      const enteredRet = inRet && wasRet === false && !gap;
      wasRift = inRift; wasRet = inRet;
      if (enteredRift) { onRift(); return 'rift'; }
      if (enteredRet) { onReturn(); return 'return'; }
      return null;
    },
    /** The two in the activation ray. */
    targets() {
      const out = [];
      if (rift) out.push({ key: SD_RIFT_KEY, aabb: boxOf(rift.at, rift.size / 2, rift.size), distance: RAY_DISTANCE, reach: DEFAULT_ACTIVATION_DISTANCE });
      if (ret) out.push({ key: SD_RETURN_KEY, aabb: boxOf(ret.at, SD_RETURN_SIZE.w / 2, SD_RETURN_SIZE.h), distance: RAY_DISTANCE, reach: DEFAULT_ACTIVATION_DISTANCE });
      return out.length ? out : NONE;
    },
    /** The plaque's words for either - a namer is handed every key the ray can win. */
    hoverName(key) {
      if (key === SD_RIFT_KEY && rift) return { title: SD_END_TEXT.rift, subs: [riftTo] };
      if (key === SD_RETURN_KEY && ret) return { title: retTitle, subs: [retTo] };   // SD10: the Hour's way home says its own
      return null;
    },
    /** A press on either, handed to the host as a step is. True when it was one of these. */
    press(key) {
      if (key === SD_RIFT_KEY && rift) { onRift(); return true; }
      if (key === SD_RETURN_KEY && ret) { onReturn(); return true; }
      return false;
    },
    /** Their batches, drawn with the place's foes. */
    batches: () => _batches,
    /** Where they stand (tests, the host's own questions). */
    get rift() { return rift ? { at: [...rift.at], size: rift.size } : null; },
    get ret() { return ret ? { at: [...ret.at] } : null; },
    /** Gone with the dungeon: the batches freed, the bell stopped. */
    clear() {
      free(rift?.batch); free(ret?.batch);
      rift = null; ret = null; _batches = NONE;
      try { bell?.stop?.(); } catch { /* stopped */ }
      bell = null;
    },
  };
}
