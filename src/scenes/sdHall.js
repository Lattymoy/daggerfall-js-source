// @ts-check
// SD6c (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 8): THE ORRERY'S HALL ON THE
// PAGE - the dungeon host's set for the Shattered Hour's puzzle, as scenes/sdEnd.js is for its Rift. The realm judges
// every turn (SD6b); this stands the hall and shows what the realm says of it.
//
//   STOOD once (stand): the hall's standing parts (world/sdHall.js - the six stones, the lecterns, the dial's floor, the
//     first step), a hand on each dial, the bridge (hidden until the Concord), and the bridge's and the step's floors for
//     the collider (the edge keeps a body off them until the Concord - the outer host widens it then) with the stones and
//     plaques solid.
//   EACH FRAME (frame): the realm's latest word on the hall, read from the outer host - a word not seen before is HEARD:
//     each hand set going toward its stone's hour (the short way round, a hand's breadth of time - the gear settling), a
//     turn's clunk at its stone and a lesser one at each partner it moved, the snap's toll, the dial's lit ring and the
//     fray rebuilt to the word's counts, and with the Concord its chime, its line and the bridge laid. The first word the
//     hall hears is where the stones ARE: the hands are put there, not turned there.
//   PRESSED (targets/hoverName/press): a stone's right handle turns it forward, its left back - from within reach of it
//     (net/sdBrain.js stoneInReach, the realm's own law, else "Stand closer") and before its face (AUDIT SD II), never
//     inside its gear's settling, never after the Concord; the plaque names the stone, its sign, its hour and the way the
//     handle turns it - after the Concord, that it holds (AUDIT SD IV, T8: it offered the turn the press refused). A Ledger plaque's riddle shows on its plaque as the ray finds it, and is said when it is pressed.
//
// SD-LOOK S10 (2026-10-09; bible/11-Multiplayer/Super-Dungeons-Look.md section 7): THE ORRERY OF ENDINGS SEEN - every part
// a dynamic draw that turns carries `noShadow`, and every frame makes nothing:
//   CROWN GEARS - one mesh, six draws, each turned 2:1 with its own stone's shown hour (gearMatrix): it moves exactly when
//     its hand moves, so a partner's gear moves with that partner's hand and with nothing else.
//   BEZELS - six meshes, each swapped by its draw's texRemap: gold while its stone's gear settles (SD_STONE_SETTLE_MS,
//     dimming as it frees), the fray's ember when the realm refused MY turn of it (its word `w` to me alone).
//   BANNERS - frozen mid-ripple; at the Concord they stream for SD_BANNER.wind and freeze again (bannerPose,
//     renderer.updateMeshVertices those three seconds only).
//   THE DIAL - a rise lifts its plates and flashes the whole inner ring once ("nearer"), a fall dims it with a clunk; the
//     gem's light is the count (how many, never which); the fray's tabs flip up a turn, the last eight pulse at 2 Hz, and
//     at the snap they blaze white and drop.
//   THE RINGS IN MODE A (world/sdOrreryModel.js) - the decor's tick, the shiver past three quarters, a whole turn back on
//     the snap, one plane at the Concord: never a stone's hour, never a turn. No arcs from a stone to its partners.
//   THE CONCORD - the banners stream, the rings swing flat and lock with a tock as the gem flares and its band runs from
//     the hub to the rim, then the bridge's twelve plates flip into place from the rim out (SD_CONCORD_MS). Each step a
//     function of when the Concord was heard; one that held before I came stands whole (the first word's rule).
//
// Not a DFU member. Ledger A (SUPER-DUNGEONS).
import { orreryOf, SD_ORRERY, SD_STONES, SD_STONE_SETTLE_MS, SD_FRAY_MAX, stoneInReach, dungeonToRealm, realmToDungeon, sdHour, sdHourWord } from '../net/sdBrain.js';
import { SD_REALM_ARCHIVE, SD_REALM_BRASS_RECORD } from '../world/sdRealm.js';
import { hallArt, gemGlow, SD_HALL_GLOW_RECORD, SD_HALL_GOLD_DIM_RECORD, SD_HALL_EMBER_DIM_RECORD, SD_HALL_GEM_RECORD, SD_HALL_FLASH_RECORD, SD_FLASH_COLOR } from '../world/sdHallArt.js';
import {
  buildHallModel, buildHandModel, buildLitModel, buildFrayModel, buildBridgeModel, buildBridgePlateModel, buildBezelModel, buildCrownGearModel,
  buildBannerModel, buildBandModel, bannerPose, bandMatrix, plateMatrix, gearMatrix, hallFloorTris, hallSolidTris, handMatrix, handleBox, plaqueBox,
  dialCentre, beforeStone, stonePoint, SD_PLAQUE, SD_FRAY_RING, SD_BRIDGE_PLATES, SD_BANNER, SD_BANNER_VERTS, SD_DIAL, SD_BEZEL, SD_STONE_SIZE,
} from '../world/sdHall.js';
import { buildOrbitRing, buildOrreryHub, ringHang, ringPoseInto, ringMatrix, hubMatrix, ringTicks, gemCentre, SD_RING_SNAP_S } from '../world/sdOrreryModel.js';
import { SD_LIGHT } from '../world/sdLook.js';
import { identity } from '../world/mat4.js';
import { RAY_DISTANCE, DEFAULT_ACTIVATION_DISTANCE } from '../player/activate.js';

/** The hall's words. */
export const SD_HALL_TEXT = Object.freeze({
  forward: 'Turn it forward',
  back: 'Turn it back',
  closer: 'Stand closer to the stone.',
  front: 'Stand before the stone\'s face.',
  still: 'The Concord holds. The stones will not turn again.',
  held: 'The Concord holds.',   // AUDIT SD IV (T8): a handle's plaque once it holds - it offered a turn the press refused
  snap: 'The Hour snaps back.',
  concord: 'The Concord! A bridge of light opens.',   // AUDIT SD II (L6 F21): WB13b's - the event and what it opens ("The endings stand as one" commented)
  plaque: (k) => `Ledger Plaque ${['I', 'II', 'III', 'IV', 'V', 'VI'][k]}`,
  hour: (h) => `Its hand stands at the ${sdHourWord(h)} hour.`,
});
/** AUDIT SD III (V10): the Concord's bridge is LAID - out across the void from the hall's rim over this long; it stood
 *  whole in a frame. One that held before I came stands whole. SD-LOOK S10: its twelve plates flip into place over it,
 *  from the rim out, once the rings have locked. */
export const SD_BRIDGE_LAY_MS = 900;
/** SD-LOOK S10: THE CONCORD'S SEQUENCE (ms from the word): the rings swing flat and lock with their tock at `rings`; the
 *  gem flares from `bandFrom` while its band runs from the hub to the rim over `band`; the bridge's plates flip from
 *  `bridgeFrom` (over SD_BRIDGE_LAY_MS); the banners stream the while (SD_BANNER.wind). */
export const SD_CONCORD_MS = Object.freeze({ rings: 1200, bandFrom: 200, band: 1000, flare: 1200, bridgeFrom: 1200 });
/** The keys the activation ray wins: a stone's handle (`sdstone:<i>:f` forward, `:b` back), a plaque (`sdplaque:<k>`). */
export const sdStoneKey = (i, a) => `sdstone:${i}:${a > 0 ? 'f' : 'b'}`;
export const sdPlaqueKey = (k) => `sdplaque:${k}`;
/** A hand's pace toward its hour (hours a second) - a turn's hour in about the gear's settling - and the snap's whirl. */
export const SD_HAND_RATE = 3;
export const SD_SNAP_RATE = 9;
/** AUDIT SD II (L2 F16): how long the fray stands FULL at the snap before it empties (ms) - the realm's word that snaps
 *  says the fray is nothing (net/sdBrain.js orreryStep), so it went from 47 steps to none, never round. SD-LOOK S10:
 *  every tab up, blazing white, then dropped. */
export const SD_FRAY_FULL_MS = 1500;
/** SD-LOOK S10: a bezel's gold for the first share of its gear's settling, then its dim to the end of it; the ember a
 *  refused turn lights on it (ms) - and how long after my press a refusal is still my press's; the dial's one flash on a
 *  rise, its dimming on a fall (ms); the last tabs' pulse (Hz - the flash law's 3 Hz ceiling over it). */
export const SD_BEZEL_MS = Object.freeze({ gold: 0.65, ember: 1000, mine: 3000 });
export const SD_DIAL_FLASH_MS = 250;
export const SD_DIAL_DIM_MS = 600;
export const SD_FRAY_PULSE_HZ = 2;
/** SD-LOOK S10: THE GEM'S LIGHT (the Hour's light channel): its reach, and its colour the Mantella's at gemGlow(count). */
export const SD_GEM_LIGHT = Object.freeze({ range: 14, gain: 1 });
/** The sounds (DAGGER.SND records): a gear's clunk (metal on metal), the snap's toll (the ship's bell, low), the Concord's
 *  chime (the enchanter's). */
export const SD_HALL_SOUNDS = Object.freeze({ clunk: 433, toll: 107, chime: 364 });
const ZERO = new Float32Array(16);
const NONE = Object.freeze([]);
/** SD-LOOK S10: the states a draw's texRemap swaps in (the realm's archive's keys), made once. */
const key = (rec) => `${SD_REALM_ARCHIVE}_${rec}`;
const REMAP = Object.freeze({
  gold: new Map([[key(SD_REALM_BRASS_RECORD), key(SD_HALL_GLOW_RECORD.brass)]]),
  dim: new Map([[key(SD_REALM_BRASS_RECORD), key(SD_HALL_GOLD_DIM_RECORD)]]),
  ember: new Map([[key(SD_REALM_BRASS_RECORD), key(SD_HALL_GLOW_RECORD.fray)]]),
  pulse: new Map([[key(SD_HALL_EMBER_DIM_RECORD), key(SD_REALM_BRASS_RECORD)]]),
  litDim: new Map([[key(SD_HALL_GLOW_RECORD.mantella), key(SD_HALL_GEM_RECORD + 2)]]),
  flare: new Map([[key(SD_HALL_GEM_RECORD), key(SD_HALL_FLASH_RECORD)]]),
  gem: Object.freeze([0, 1, 2, 3, 4, 5, 6].map((n) => (n === 0 ? null : new Map([[key(SD_HALL_GEM_RECORD), key(SD_HALL_GEM_RECORD + n)]])))),
});
export { REMAP as SD_HALL_REMAP };

const _uploaded = new WeakSet();
/** The hall's pictures, uploaded once a renderer - albedo and their own light. AUDIT SD II (L2 F3): the light their own,
 *  never the window's - `white`, as the Rift's is (scenes/sdEnd.js): an emission upload without it is a window mask, and
 *  the dungeon arm tints every window by DFU's day colour (0.175, 0.302, 0.349), so every glow in the Hour burned dim
 *  and blue-green. */
export function ensureSdHallArt(renderer) {
  if (!renderer || _uploaded.has(renderer) || typeof renderer.uploadTexture !== 'function') return;
  _uploaded.add(renderer);
  for (const [rec, art] of hallArt()) { renderer.uploadTexture(SD_REALM_ARCHIVE, rec, art.albedo); renderer.uploadEmissionTexture?.(SD_REALM_ARCHIVE, rec, art.emission, { white: true }); }
}

/** The short way from hour `from` to hour `to` (-6 to 6). */
const way = (from, to) => ((((to - from) % 12) + 18) % 12) - 6;

/**
 * The Orrery's hall for slot `s`. `onTurn(i, a)` sends a turn (true when it left); `say(text)` puts a line up; `clock()`
 * the realm's anchored seconds (SD-LOOK S10: the rings' decor ticks on it - every screen's together).
 * @param {{ renderer?: any, audio?: any, s: number, now?: () => number, clock?: () => number, onTurn?: (i: number, a: number) => boolean, say?: (t: string) => void }} deps
 */
export function createSdHall({ renderer = null, audio = null, s, now = () => performance.now(), clock = null, onTurn = () => false, say = () => {} }) {
  const o = orreryOf(s);
  const clockNow = clock ?? (() => now() / 1000);
  /** @type {any[]} the dungeon's draws, as stood into */
  let draws = null;
  let hallMesh = null, handMesh = null, bridgeMesh = null, litMesh = null, frayMesh = null;
  let gearMesh = null, bannerMesh = null, hubMesh = null, flashMesh = null, bandMesh = null;
  const bezelMeshes = [], ringMeshes = [], plateMeshes = [];
  const hands = [], gears = [], bezels = [], rings = [], plates = [];
  let litDraw = null, frayDraw = null, bridgeDraw = null, bannerDraw = null, hubDraw = null, flashDraw = null, bandDraw = null;
  let word = null, heard = false;
  const shown = o ? [...o.start] : [], want = o ? [...o.start] : [];
  const lastTurn = SD_STONES.map(() => -Infinity);
  let lit = 0, fray = 0, ok = false, rate = SD_HAND_RATE;
  /** AUDIT SD II (L2 F9): where I stand, one scratch (it was a fresh array a frame); the activation boxes, made once at the
   *  stand (they never move - the hover pick asked for 18 KB of them twice a frame); and the fray held full at a snap
   *  until `frayFullUntil`, its word's own count after (L2 F16). */
  const feet = [0, 0, 0];
  let hasFeet = false, targetList = NONE, frayWant = 0, frayFullUntil = -Infinity;
  /** SD-LOOK S10: the fray's tabs (its Hollow's own snap: 48, the Fraying's 36), whether the last eight are warned and the
   *  tabs blaze; the rings' hang (the slot's); when the Hour snapped back, when the Concord was heard (-Infinity: never,
   *  or before I came), whether its steps are done; the stone I last pressed and when; each bezel's ember; the dial's
   *  flash and dim; the banners' kept arrays for the wind. */
  const tabs = o?.fray ?? SD_FRAY_MAX, hang = ringHang(s), pose = new Float64Array(2), ringState = new Float64Array(4);
  let frayWarn = false, snapAt = -Infinity, concordAt = -Infinity, concordDone = true, tocked = true, bannerLive = false;
  let pressedStone = -1, pressedAt = -Infinity, flashUntil = -Infinity, dimUntil = -Infinity;
  const emberUntil = SD_STONES.map(() => -Infinity);
  const bannerPos = new Float32Array(SD_BANNER_VERTS * 3), bannerNrm = new Float32Array(SD_BANNER_VERTS * 3);
  const GEM_AT = gemCentre(), _light = { x: GEM_AT[0], y: GEM_AT[1], z: GEM_AT[2], range: SD_GEM_LIGHT.range, color: [0, 0, 0] }, _lights = [_light];
  const _gemHalo = { at: GEM_AT, size: 0.9, color: [0, 0, 0] }, _bezelHalos = SD_STONES.map((_, i) => ({ at: realmToDungeon(...stonePoint(i, 0, SD_DIAL.y, SD_BEZEL.o1 - SD_STONE_SIZE.d / 2)), size: 0.7, color: [0, 0, 0] })), _halos = [];

  const make = (model) => { if (!model || !renderer?.createMesh) return null; try { return renderer.createMesh(model); } catch (e) { console.warn('[sd] the hall would not build', e?.message ?? e); return null; } };
  const drop = (mesh) => { if (mesh) { try { renderer?.destroyMesh?.(mesh); } catch { /* gone */ } } };
  const play = (rec, at, vol, pitch) => { try { audio?.play3d?.(rec, at, vol, { maxDistance: 40, pitch }); } catch { /* no sound */ } };
  /** A draw that turns or glows: never a shadow's caster (SD-LOOK: LA-SHADOW3's everyLightCasts rebuilds a cube for one). */
  const drawOf = (gpu, matrix = identity(), hidden = false) => ({ gpu, object: { matrix }, noShadow: true, texRemap: null, hidden });
  /** A draw that comes and goes: its mesh swapped, out of the list when there is none. */
  const swap = (draw, mesh) => {
    if (!draws) return null;
    if (draw) { const at = draws.indexOf(draw); if (at >= 0) draws.splice(at, 1); }
    if (!mesh) return null;
    const d = drawOf(mesh);
    draws.push(d);
    return d;
  };
  const setLit = (n) => { if (n === lit && (litDraw || n === 0)) return; lit = n; const old = litMesh; litMesh = make(buildLitModel(n)); litDraw = swap(litDraw, litMesh); drop(old); };
  /** SD18b - SD-LOOK S10: the fray's tabs by its Hollow's own snap (the Fraying's thirty-six), one a turn. */
  const frayArc = (f) => Math.max(0, Math.min(tabs, Math.round(f)));
  let blazing = false;
  const setFray = (f, blaze = false) => {
    const warn = !blaze && f >= tabs - 8;
    if (f === fray && blaze === blazing && warn === frayWarn && (frayDraw || (f === 0 && !warn))) return;
    fray = f; blazing = blaze; frayWarn = warn;
    const old = frayMesh; frayMesh = make(buildFrayModel(f, tabs, { blaze })); frayDraw = swap(frayDraw, frayMesh); drop(old);
  };
  /** The crown gears where their hands are. */
  const poseGear = (i) => { if (gears[i]) gearMatrix(i, shown[i], gears[i].object.matrix); };
  /** The Concord's last state, at once (a first word that says it holds; the end of its sequence). */
  function concordWhole() {
    concordDone = true; tocked = true;
    if (bannerMesh && renderer?.updateMeshVertices) { bannerPose(SD_BANNER.wind, bannerPos, bannerNrm); renderer.updateMeshVertices(bannerMesh, bannerPos, bannerNrm); }
    bannerLive = false;
    if (bandDraw) { bandDraw.hidden = false; bandDraw.object.matrix = identity(); }
    for (const p of plates) p.hidden = true;
    if (bridgeDraw) { bridgeDraw.object.matrix = identity(); bridgeDraw.hidden = false; }
  }

  /** A word from the realm, heard once: the hands set going, the sounds, the dial, the Concord. */
  function hear(w) {
    const first = !heard;
    heard = true;
    for (let i = 0; i < want.length; i++) want[i] = w.st[i];
    if (first) for (let i = 0; i < want.length; i++) { shown[i] = want[i]; if (hands[i]) hands[i].object.matrix = handMatrix(i, shown[i]); }   // where the stones ARE, not a turn to them (AUDIT SD: drawn there now - a hand at rest is never drawn again)
    if (first) for (let i = 0; i < want.length; i++) poseGear(i);   // SD-LOOK S10: and their gears
    rate = w.x ? SD_SNAP_RATE : SD_HAND_RATE;
    if (!first && w.i != null && o) {
      lastTurn[w.i] = now();
      play(SD_HALL_SOUNDS.clunk, dialCentre(w.i), 1, w.a > 0 ? 1 : 0.85);
      for (let j = 0; j < SD_STONES.length; j++) if (j !== w.i && o.gear[w.i][j] !== 0) play(SD_HALL_SOUNDS.clunk, dialCentre(j), 0.4, 1.25);
    }
    if (!first && w.x) { play(SD_HALL_SOUNDS.toll, dialCentre(0), 1, 0.5); snapAt = now(); }
    // SD-LOOK S10: a refusal - the realm's word to me alone, `w` - lights the ember on the stone I pressed
    if (!first && w.w === 1 && pressedStone >= 0 && now() - pressedAt < SD_BEZEL_MS.mine) emberUntil[pressedStone] = now() + SD_BEZEL_MS.ember;
    // SD-LOOK S10: nearer - the whole inner ring flashes once; further - it dims with a downward clunk (never at the snap)
    if (!first && !w.x && w.lit > lit) flashUntil = now() + SD_DIAL_FLASH_MS;
    if (!first && !w.x && w.lit < lit) { dimUntil = now() + SD_DIAL_DIM_MS; play(SD_HALL_SOUNDS.clunk, realmToDungeon(SD_ORRERY.x, 0.3, SD_ORRERY.z), 0.7, 0.6); }
    setLit(w.lit);
    // AUDIT SD II (L2 F16): the snap shows every tab up for a moment, then none - the word's own count (SD-LOOK S10: blazing)
    frayWant = w.f;
    if (!first && w.x) { frayFullUntil = now() + SD_FRAY_FULL_MS; setFray(tabs, true); }
    else if (!(now() < frayFullUntil)) setFray(frayArc(w.f));
    if (w.ok && !ok) {
      ok = true;
      if (first) concordWhole();   // AUDIT SD III (V10) - SD-LOOK S10: one that held before I came stands whole
      else { concordAt = now(); concordDone = false; tocked = false; bannerLive = !!bannerMesh; }
      if (!first) { play(SD_HALL_SOUNDS.chime, dialCentre(0), 1, 1); say(SD_HALL_TEXT.concord); }
    }
  }
  /** SD-LOOK S10: the Concord's steps at `ms` after its word. */
  function concordStep(ms) {
    if (bannerLive) { bannerPose(ms / 1000, bannerPos, bannerNrm); renderer?.updateMeshVertices?.(bannerMesh, bannerPos, bannerNrm); if (ms >= SD_BANNER.wind * 1000) bannerLive = false; }
    if (bandDraw) { const k = (ms - SD_CONCORD_MS.bandFrom) / SD_CONCORD_MS.band; bandDraw.hidden = !(k > 0); if (k > 0) bandMatrix(k, bandDraw.object.matrix); }
    if (!tocked && ms >= SD_CONCORD_MS.rings) { tocked = true; play(SD_HALL_SOUNDS.clunk, GEM_AT, 1, 0.45); }   // the rings lock: one great tock
    const kb = (ms - SD_CONCORD_MS.bridgeFrom) / SD_BRIDGE_LAY_MS, n = SD_BRIDGE_PLATES.n;
    if (kb >= 1) {
      for (const p of plates) p.hidden = true;
      if (bridgeDraw) { bridgeDraw.object.matrix = identity(); bridgeDraw.hidden = false; }
    } else for (let j = 0; j < plates.length; j++) {
      const kj = (kb - (j * 0.6) / (n - 1)) / 0.4;
      plates[j].hidden = !(kj > 0);
      if (kj > 0) plateMatrix(j, kj, plates[j].object.matrix);
    }
    if (kb >= 1 && !bannerLive && ms >= SD_CONCORD_MS.bandFrom + SD_CONCORD_MS.band) concordDone = true;
  }

  return {
    /** Stand the hall into the dungeon's draws and collider - once. */
    stand({ dynamicDraws, collider = null }) {
      if (draws || !o) return false;
      draws = dynamicDraws;
      ensureSdHallArt(renderer);
      hallMesh = make(buildHallModel());
      if (hallMesh) draws.push({ gpu: hallMesh, object: { matrix: identity() } });   // standing stone: it casts
      handMesh = make(buildHandModel());
      if (handMesh) for (let i = 0; i < SD_STONES.length; i++) { const d = drawOf(handMesh, handMatrix(i, shown[i])); hands.push(d); draws.push(d); }
      // SD-LOOK S10: the crown gears, the bezels, the banners, the rings and the hub with its gem
      gearMesh = make(buildCrownGearModel());
      if (gearMesh) for (let i = 0; i < SD_STONES.length; i++) { const d = drawOf(gearMesh, gearMatrix(i, shown[i])); gears.push(d); draws.push(d); }
      for (let i = 0; i < SD_STONES.length; i++) { const m = make(buildBezelModel(i)); if (!m) continue; bezelMeshes.push(m); const d = drawOf(m); bezels[i] = d; draws.push(d); }
      bannerMesh = make(buildBannerModel());
      if (bannerMesh) { bannerDraw = drawOf(bannerMesh); draws.push(bannerDraw); }
      for (let k = 0; k < SD_STONES.length; k++) { const m = make(buildOrbitRing(k)); if (!m) continue; ringMeshes.push(m); const d = drawOf(m, new Float32Array(16)); rings[k] = d; draws.push(d); }
      hubMesh = make(buildOrreryHub());
      if (hubMesh) { hubDraw = drawOf(hubMesh, new Float32Array(16)); draws.push(hubDraw); }
      flashMesh = make(buildLitModel(SD_STONES.length, SD_HALL_FLASH_RECORD));
      if (flashMesh) { flashDraw = drawOf(flashMesh, identity(), true); draws.push(flashDraw); }
      bandMesh = make(buildBandModel());
      if (bandMesh) { bandDraw = drawOf(bandMesh, new Float32Array(16), true); draws.push(bandDraw); }
      for (let j = 0; j < SD_BRIDGE_PLATES.n; j++) { const m = make(buildBridgePlateModel(j)); if (!m) continue; plateMeshes.push(m); const d = drawOf(m, new Float32Array(16), true); plates.push(d); draws.push(d); }
      bridgeMesh = make(buildBridgeModel());
      // AUDIT SD II (L2 F11): hidden until the Concord - drawn by no pass (the draw loop and the shadow records skip it)
      if (bridgeMesh) { bridgeDraw = { gpu: bridgeMesh, object: { matrix: ok ? identity() : new Float32Array(ZERO) }, hidden: !ok, noShadow: true }; draws.push(bridgeDraw); }
      if (ok) concordWhole();
      // the bridge's and the step's floors, and (AUDIT SD II, L2 F2) every stone and plaque solid
      const floors = hallFloorTris(), solids = hallSolidTris(), tris = new Float32Array(floors.length + solids.length);
      tris.set(floors);
      tris.set(solids, floors.length);
      const n = tris.length / 3, idx = new Uint16Array(n);
      for (let k = 0; k < n; k++) idx[k] = k;
      try { collider?.addMesh?.('sd:hall', tris, idx, identity()); } catch (e) { console.warn('[sd] the hall\'s floors', e?.message ?? e); }
      const list = [];
      for (let i = 0; i < SD_STONES.length; i++) for (const a of [1, -1]) list.push({ key: sdStoneKey(i, a), aabb: handleBox(i, a), distance: RAY_DISTANCE, reach: DEFAULT_ACTIVATION_DISTANCE });
      for (let k = 0; k < SD_PLAQUE.bearings.length; k++) list.push({ key: sdPlaqueKey(k), aabb: plaqueBox(k), distance: RAY_DISTANCE, reach: DEFAULT_ACTIVATION_DISTANCE });
      targetList = Object.freeze(list);
      return true;
    },
    /** One frame: `w` the realm's latest word on the hall (or null), `pos` where I stand (the dungeon's frame). */
    frame(dt, pos, w) {
      hasFeet = !!pos;
      if (pos) { feet[0] = pos[0]; feet[1] = pos[1]; feet[2] = pos[2]; }
      if (w && w !== word && o && w.s === s && Array.isArray(w.st)) { word = w; hear(w); }
      if (frayFullUntil !== -Infinity && now() >= frayFullUntil) { frayFullUntil = -Infinity; setFray(frayArc(frayWant)); }   // AUDIT SD II (L2 F16): the full moment over
      if (!concordDone) concordStep(now() - concordAt);   // SD-LOOK S10: the Concord's steps; AUDIT SD III (V10): the bridge laid
      const step = Math.max(0, dt) * rate;
      for (let i = 0; i < hands.length; i++) {
        const d = way(shown[i], want[i]);
        if (d === 0) continue;   // AUDIT SD: a hand at rest keeps its matrix - none made a frame for nothing
        shown[i] = Math.abs(d) <= step ? want[i] : sdHour(shown[i] + Math.sign(d) * step);
        hands[i].object.matrix = handMatrix(i, shown[i]);
        poseGear(i);   // SD-LOOK S10: its gear with it, and only with it
      }
      // SD-LOOK S10: the bezels' states, the dial's flash and dim, the last tabs' pulse, the gem's count, the rings
      const t = now();
      for (let i = 0; i < bezels.length; i++) {
        const b = bezels[i];
        if (!b) continue;
        const since = t - lastTurn[i], st = t < emberUntil[i] ? REMAP.ember : since < SD_STONE_SETTLE_MS * SD_BEZEL_MS.gold ? REMAP.gold : since < SD_STONE_SETTLE_MS ? REMAP.dim : null;
        if (b.texRemap !== st) b.texRemap = st;
      }
      const flashing = t < flashUntil;
      if (flashDraw) flashDraw.hidden = !flashing;
      if (litDraw) { litDraw.hidden = flashing && !!flashDraw; litDraw.texRemap = t < dimUntil ? REMAP.litDim : null; }
      if (frayDraw) frayDraw.texRemap = frayWarn && Math.floor((t / 1000) * SD_FRAY_PULSE_HZ * 2) % 2 === 1 ? REMAP.pulse : null;
      const cms = ok ? (concordAt === -Infinity ? Infinity : t - concordAt) : -1;
      if (hubDraw) { hubDraw.texRemap = cms >= SD_CONCORD_MS.bandFrom && cms < SD_CONCORD_MS.bandFrom + SD_CONCORD_MS.flare ? REMAP.flare : REMAP.gem[Math.max(0, Math.min(6, lit))]; hubMatrix(ringTicks(clockNow()) * 0.13, hubDraw.object.matrix); }
      if (rings.length) {
        ringState[0] = clockNow(); ringState[1] = frayFullUntil !== -Infinity ? 0 : fray / tabs;
        ringState[2] = snapAt === -Infinity ? -1 : (t - snapAt) / 1000; ringState[3] = cms < 0 ? -1 : cms / 1000;
        if (ringState[2] > SD_RING_SNAP_S) snapAt = -Infinity;
        for (let k = 0; k < rings.length; k++) if (rings[k]) { ringPoseInto(k, hang, ringState, pose); ringMatrix(k, hang, pose, rings[k].object.matrix); }
      }
    },
    /** The handles and the plaques, in the activation ray - the one list the stand made. */
    targets() {
      return draws && o ? targetList : NONE;
    },
    /** The plaque's words for a handle or a Ledger plaque. */
    hoverName(key) {
      if (!o || typeof key !== 'string') return null;
      const st = /^sdstone:([0-5]):([fb])$/.exec(key);
      if (st) { const i = Number(st[1]), stone = SD_STONES[i]; return { title: `${stone.name.charAt(0).toUpperCase()}${stone.name.slice(1)} - ${stone.sign}`, subs: [SD_HALL_TEXT.hour(want[i]), ok ? SD_HALL_TEXT.held : st[2] === 'f' ? SD_HALL_TEXT.forward : SD_HALL_TEXT.back] }; }
      const pl = /^sdplaque:([0-5])$/.exec(key);
      if (pl) { const k = Number(pl[1]); return { title: SD_HALL_TEXT.plaque(k), subs: [o.riddles[k].text] }; }
      return null;
    },
    /** A press on a handle (a turn, sent) or a plaque (its riddle, said). True when it was one of the hall's. */
    press(key) {
      if (!o || typeof key !== 'string') return false;
      const pl = /^sdplaque:([0-5])$/.exec(key);
      if (pl) { say(o.riddles[Number(pl[1])].text); return true; }
      const st = /^sdstone:([0-5]):([fb])$/.exec(key);
      if (!st) return false;
      const i = Number(st[1]), a = st[2] === 'f' ? 1 : -1;
      if (ok) { say(SD_HALL_TEXT.still); return true; }
      const at = hasFeet ? dungeonToRealm(feet[0], feet[1], feet[2]) : null;
      if (!at || !stoneInReach(i, at[0], at[2])) { say(SD_HALL_TEXT.closer); return true; }
      if (!beforeStone(i, at[0], at[2])) { say(SD_HALL_TEXT.front); return true; }   // AUDIT SD II (L2 F2): a handle is turned from the stone's face, never from behind it
      if (now() - lastTurn[i] < SD_STONE_SETTLE_MS) return true;   // the gear still settling: the realm would not take it
      if (onTurn(i, a)) { pressedStone = i; pressedAt = now(); }   // SD-LOOK S10: a refusal's ember is this stone's
      return true;
    },
    /** SD-LOOK S10: the gem's light, for the Hour's light channel - the Mantella's, as bright as the count. */
    lights() {
      if (!draws || !o) return NONE;
      const k = gemGlow(lit) * SD_GEM_LIGHT.gain;
      _light.color[0] = SD_LIGHT.mantella[0] * k; _light.color[1] = SD_LIGHT.mantella[1] * k; _light.color[2] = SD_LIGHT.mantella[2] * k;
      return _lights;
    },
    /** SD-LOOK S10: the halos the frame adds (render/sdHalo.js) - the gem's core, and a settling bezel's gold. */
    halos() {
      _halos.length = 0;
      if (!draws || !o) return _halos;
      const t = now(), cms = ok ? (concordAt === -Infinity ? Infinity : t - concordAt) : -1, flare = cms >= SD_CONCORD_MS.bandFrom && cms < SD_CONCORD_MS.bandFrom + SD_CONCORD_MS.flare;
      const k = flare ? 1 : gemGlow(lit) * 0.6;
      for (let c = 0; c < 3; c++) _gemHalo.color[c] = (flare ? SD_FLASH_COLOR[c] / 255 : SD_LIGHT.mantella[c]) * k;
      _halos.push(_gemHalo);
      for (let i = 0; i < bezels.length; i++) {
        const b = bezels[i];
        if (!b?.texRemap || b.texRemap === REMAP.dim) continue;
        const c = b.texRemap === REMAP.ember ? SD_LIGHT.ember : SD_LIGHT.gold, h = _bezelHalos[i];
        h.color[0] = c[0] * 0.4; h.color[1] = c[1] * 0.4; h.color[2] = c[2] * 0.4;
        _halos.push(h);
      }
      return _halos;
    },
    /** Whether the Concord holds (the outer host's edge widens with it). */
    get concord() { return ok; },
    /** Where the hands stand now (tests). */
    get shown() { return [...shown]; },
    get counts() { return { lit, fray }; },
    /** SD-LOOK S10: the draws it stood, by part (tests, the lab). */
    get parts() { return { hands, gears, bezels, rings, plates, hub: hubDraw, banner: bannerDraw, lit: litDraw, flash: flashDraw, fray: frayDraw, band: bandDraw, bridge: bridgeDraw }; },
    /** Gone with the dungeon: every mesh freed. */
    clear() {
      for (const m of [hallMesh, handMesh, bridgeMesh, litMesh, frayMesh, gearMesh, bannerMesh, hubMesh, flashMesh, bandMesh, ...bezelMeshes, ...ringMeshes, ...plateMeshes]) drop(m);
      hallMesh = handMesh = bridgeMesh = litMesh = frayMesh = gearMesh = bannerMesh = hubMesh = flashMesh = bandMesh = null;
      bezelMeshes.length = ringMeshes.length = plateMeshes.length = 0;
      hands.length = gears.length = bezels.length = rings.length = plates.length = 0;
      litDraw = frayDraw = bridgeDraw = bannerDraw = hubDraw = flashDraw = bandDraw = null; draws = null; targetList = NONE;
    },
  };
}
