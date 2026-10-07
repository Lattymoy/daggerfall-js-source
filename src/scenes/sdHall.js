// @ts-check
// SD6c (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 8): THE ORRERY'S HALL ON THE
// PAGE - the dungeon host's set for the Shattered Hour's puzzle, as scenes/sdEnd.js is for its Rift. The realm judges
// every turn (SD6b); this stands the hall and shows what the realm says of it.
//
//   STOOD once (stand): the hall's standing parts (world/sdHall.js - the six stones, the plaques, the first step), a hand
//     on each dial, the bridge (hidden until the Concord), and the bridge's and the step's floors for the collider (the
//     edge keeps a body off them until the Concord - the outer host widens it then) with the stones and plaques solid.
//   EACH FRAME (frame): the realm's latest word on the hall, read from the outer host - a word not seen before is HEARD:
//     each hand set going toward its stone's hour (the short way round, a hand's breadth of time - the gear settling), a
//     turn's clunk at its stone and a lesser one at each partner it moved, the snap's toll, the dial's lit ring and the
//     fray rebuilt to the word's counts, and with the Concord its chime, its line and the bridge laid. The first word the
//     hall hears is where the stones ARE: the hands are put there, not turned there.
//   PRESSED (targets/hoverName/press): a stone's right handle turns it forward, its left back - from within reach of it
//     (net/sdBrain.js stoneInReach, the realm's own law, else "Stand closer") and before its face (AUDIT SD II), never
//     inside its gear's settling, never after the Concord; the plaque names the stone, its sign, its hour and the way the
//     handle turns it. A Ledger plaque's riddle shows on its plaque as the ray finds it, and is said when it is pressed.
//
// Not a DFU member. Ledger A (SUPER-DUNGEONS).
import { orreryOf, SD_STONES, SD_STONE_SETTLE_MS, stoneInReach, dungeonToRealm, sdHour, sdHourWord } from '../net/sdBrain.js';
import { SD_REALM_ARCHIVE } from '../world/sdRealm.js';
import { hallArt } from '../world/sdHallArt.js';
import { buildHallModel, buildHandModel, buildLitModel, buildFrayModel, buildBridgeModel, hallFloorTris, hallSolidTris, handMatrix, handleBox, plaqueBox, dialCentre, beforeStone, SD_PLAQUE, SD_FRAY_RING } from '../world/sdHall.js';
import { identity } from '../world/mat4.js';
import { RAY_DISTANCE, DEFAULT_ACTIVATION_DISTANCE } from '../player/activate.js';

/** The hall's words. */
export const SD_HALL_TEXT = Object.freeze({
  forward: 'Turn it forward',
  back: 'Turn it back',
  closer: 'Stand closer to the stone.',
  front: 'Stand before the stone\'s face.',
  still: 'The Concord holds. The stones will not turn again.',
  snap: 'The Hour snaps back.',
  concord: 'The Concord! A bridge of light opens.',   // AUDIT SD II (L6 F21): WB13b's - the event and what it opens ("The endings stand as one" commented)
  plaque: (k) => `Ledger Plaque ${['I', 'II', 'III', 'IV', 'V', 'VI'][k]}`,
  hour: (h) => `Its hand stands at the ${sdHourWord(h)} hour.`,
});
/** The keys the activation ray wins: a stone's handle (`sdstone:<i>:f` forward, `:b` back), a plaque (`sdplaque:<k>`). */
export const sdStoneKey = (i, a) => `sdstone:${i}:${a > 0 ? 'f' : 'b'}`;
export const sdPlaqueKey = (k) => `sdplaque:${k}`;
/** A hand's pace toward its hour (hours a second) - a turn's hour in about the gear's settling - and the snap's whirl. */
export const SD_HAND_RATE = 3;
export const SD_SNAP_RATE = 9;
/** AUDIT SD II (L2 F16): how long the fray's ember arc stands FULL at the snap before it empties (ms) - the realm's word
 *  that snaps says the fray is nothing (net/sdBrain.js orreryStep), so the arc went from 47 steps to none, never round. */
export const SD_FRAY_FULL_MS = 1500;
/** The sounds (DAGGER.SND records): a gear's clunk (metal on metal), the snap's toll (the ship's bell, low), the Concord's
 *  chime (the enchanter's). */
export const SD_HALL_SOUNDS = Object.freeze({ clunk: 433, toll: 107, chime: 364 });
const ZERO = new Float32Array(16);
const NONE = Object.freeze([]);

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
 * The Orrery's hall for slot `s`. `onTurn(i, a)` sends a turn (true when it left); `say(text)` puts a line up.
 * @param {{ renderer?: any, audio?: any, s: number, now?: () => number, onTurn?: (i: number, a: number) => boolean, say?: (t: string) => void }} deps
 */
export function createSdHall({ renderer = null, audio = null, s, now = () => performance.now(), onTurn = () => false, say = () => {} }) {
  const o = orreryOf(s);
  /** @type {any[]} the dungeon's draws, as stood into */
  let draws = null;
  let hallMesh = null, handMesh = null, bridgeMesh = null, litMesh = null, frayMesh = null;
  const hands = [];
  let litDraw = null, frayDraw = null, bridgeDraw = null;
  let word = null, heard = false;
  const shown = o ? [...o.start] : [], want = o ? [...o.start] : [];
  const lastTurn = SD_STONES.map(() => -Infinity);
  let lit = 0, fray = 0, ok = false, rate = SD_HAND_RATE;
  /** AUDIT SD II (L2 F9): where I stand, one scratch (it was a fresh array a frame); the activation boxes, made once at the
   *  stand (they never move - the hover pick asked for 18 KB of them twice a frame); and the fray's arc held full at a
   *  snap until `frayFullUntil`, its word's own count after (L2 F16). */
  const feet = [0, 0, 0];
  let hasFeet = false, targetList = NONE, frayWant = 0, frayFullUntil = -Infinity;

  const make = (model) => { if (!model || !renderer?.createMesh) return null; try { return renderer.createMesh(model); } catch (e) { console.warn('[sd] the hall would not build', e?.message ?? e); return null; } };
  const drop = (mesh) => { if (mesh) { try { renderer?.destroyMesh?.(mesh); } catch { /* gone */ } } };
  const play = (rec, at, vol, pitch) => { try { audio?.play3d?.(rec, at, vol, { maxDistance: 40, pitch }); } catch { /* no sound */ } };
  /** A draw that comes and goes: its mesh swapped, out of the list when there is none. */
  const swap = (draw, mesh) => {
    if (!draws) return null;
    if (draw) { const at = draws.indexOf(draw); if (at >= 0) draws.splice(at, 1); }
    if (!mesh) return null;
    const d = { gpu: mesh, object: { matrix: identity() } };
    draws.push(d);
    return d;
  };
  const setLit = (n) => { if (n === lit && (litDraw || n === 0)) return; lit = n; const old = litMesh; litMesh = make(buildLitModel(n)); litDraw = swap(litDraw, litMesh); drop(old); };
  const setFray = (f) => { if (f === fray && (frayDraw || f === 0)) return; fray = f; const old = frayMesh; frayMesh = make(buildFrayModel(f)); frayDraw = swap(frayDraw, frayMesh); drop(old); };

  /** A word from the realm, heard once: the hands set going, the sounds, the dial, the Concord. */
  function hear(w) {
    const first = !heard;
    heard = true;
    for (let i = 0; i < want.length; i++) want[i] = w.st[i];
    if (first) for (let i = 0; i < want.length; i++) { shown[i] = want[i]; if (hands[i]) hands[i].object.matrix = handMatrix(i, shown[i]); }   // where the stones ARE, not a turn to them (AUDIT SD: drawn there now - a hand at rest is never drawn again)
    rate = w.x ? SD_SNAP_RATE : SD_HAND_RATE;
    if (!first && w.i != null && o) {
      lastTurn[w.i] = now();
      play(SD_HALL_SOUNDS.clunk, dialCentre(w.i), 1, w.a > 0 ? 1 : 0.85);
      for (let j = 0; j < SD_STONES.length; j++) if (j !== w.i && o.gear[w.i][j] !== 0) play(SD_HALL_SOUNDS.clunk, dialCentre(j), 0.4, 1.25);
    }
    if (!first && w.x) play(SD_HALL_SOUNDS.toll, dialCentre(0), 1, 0.5);
    setLit(w.lit);
    // AUDIT SD II (L2 F16): the snap shows the arc all the way round for a moment, then empty - the word's own count
    frayWant = w.f;
    if (!first && w.x) { frayFullUntil = now() + SD_FRAY_FULL_MS; setFray(SD_FRAY_RING.steps); }
    else if (!(now() < frayFullUntil)) setFray(w.f);
    if (w.ok && !ok) {
      ok = true;
      if (bridgeDraw) { bridgeDraw.object.matrix = identity(); bridgeDraw.hidden = false; }
      if (!first) { play(SD_HALL_SOUNDS.chime, dialCentre(0), 1, 1); say(SD_HALL_TEXT.concord); }
    }
  }

  return {
    /** Stand the hall into the dungeon's draws and collider - once. */
    stand({ dynamicDraws, collider = null }) {
      if (draws || !o) return false;
      draws = dynamicDraws;
      ensureSdHallArt(renderer);
      hallMesh = make(buildHallModel());
      if (hallMesh) draws.push({ gpu: hallMesh, object: { matrix: identity() } });
      handMesh = make(buildHandModel());
      if (handMesh) for (let i = 0; i < SD_STONES.length; i++) { const d = { gpu: handMesh, object: { matrix: handMatrix(i, shown[i]) } }; hands.push(d); draws.push(d); }
      bridgeMesh = make(buildBridgeModel());
      // AUDIT SD II (L2 F11): hidden until the Concord - drawn by no pass (the draw loop and the shadow records skip it)
      if (bridgeMesh) { bridgeDraw = { gpu: bridgeMesh, object: { matrix: ok ? identity() : new Float32Array(ZERO) }, hidden: !ok }; draws.push(bridgeDraw); }
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
      if (frayFullUntil !== -Infinity && now() >= frayFullUntil) { frayFullUntil = -Infinity; setFray(frayWant); }   // AUDIT SD II (L2 F16): the full arc's moment over
      const step = Math.max(0, dt) * rate;
      for (let i = 0; i < hands.length; i++) {
        const d = way(shown[i], want[i]);
        if (d === 0) continue;   // AUDIT SD: a hand at rest keeps its matrix - none made a frame for nothing
        shown[i] = Math.abs(d) <= step ? want[i] : sdHour(shown[i] + Math.sign(d) * step);
        hands[i].object.matrix = handMatrix(i, shown[i]);
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
      if (st) { const i = Number(st[1]), stone = SD_STONES[i]; return { title: `${stone.name.charAt(0).toUpperCase()}${stone.name.slice(1)} - ${stone.sign}`, subs: [SD_HALL_TEXT.hour(want[i]), st[2] === 'f' ? SD_HALL_TEXT.forward : SD_HALL_TEXT.back] }; }
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
      onTurn(i, a);
      return true;
    },
    /** Whether the Concord holds (the outer host's edge widens with it). */
    get concord() { return ok; },
    /** Where the hands stand now (tests). */
    get shown() { return [...shown]; },
    get counts() { return { lit, fray }; },
    /** Gone with the dungeon: every mesh freed. */
    clear() {
      for (const m of [hallMesh, handMesh, bridgeMesh, litMesh, frayMesh]) drop(m);
      hallMesh = handMesh = bridgeMesh = litMesh = frayMesh = null;
      hands.length = 0; litDraw = frayDraw = bridgeDraw = null; draws = null; targetList = NONE;
    },
  };
}
