// @ts-check
// KETCH (2026-10-24; bible/11-Multiplayer/Sky-Ketch.md sections 3 and 11): THE SKY-KETCH ON THIS SCREEN'S DUNGEON HOST - the
// made level stood and moved (HOST-SPLIT: a module the host wires - createWorldModes constructs it and reads its seams,
// as it does the Spire's circle, scenes/eliteGates/egCircleHost.js):
//
//   THE DECK'S SET (createKetchDeck - pure of the host, the lab's too, src/tools/ketchLab.js): the ship's mesh and the land
//     below among the context's draws, the ship's collider one bucket; the parts, each a draw and (where a body meets it) a
//     bucket of its own - the lift's cage a MOVER (its translation read at every query, the Steps' law: scenes/superDungeon/
//     sdSteps.js), its gates, the hatches' grates, the cabin's doors and the bridge's eight sections each moved out of reach
//     when open or fallen. POSED each frame BEFORE THE MOTOR (pose) from the voyage as this page holds it (net/ketch/
//     ketchLink.js) and the shared clock: the hammers slamming, the cage riding (a body on its floor carried with it, as a
//     deck carries one - player/motor.js carryBy), its gates shut but where it stands, the grates turned up on their hinges
//     once the room has opened them, the doors slid back, the sections shuddering and falling, the resonators true or
//     false, the cells in their cradles and sockets and where they lie, the forks risen, the arcs crackling, the steam, the
//     bosun's line. The ship's lamps and the lit things nearest the eye (lightsNear); the clouds and the steam as billboards.
//   THE AIR AND THE LIGHT (ketchFrameLook, ketchApplyLook): her light by the hour and the zone at the eye (world/ketch/
//     ketchAtmos.js ketchHourLight - KETCH-LOOK KL1): on her open decks the world's hour - the sun by its elevation, the
//     moons' key by night, the trilight, the haze, the lamps' gain, the lane's grade; below decks the lamps' warm close air;
//     the cabin its hour's, dimmer.
//   THE HOST'S SEAMS (createKetchDeckHost): stood into a built context (stand - its teardown handed to the context), the six
//     combat seams and the billboards routed to the voyage's fight on the ship (the Spire's way - worldModes' egBoss table),
//     the Steps' void answered on the ship's own ground (castBack), the frame's look.
//
// Not a DFU member. Ledger A (KETCH).
import { identity } from '../../world/mat4.js';
import { buildKetchShip, buildKetchParts, buildKetchGround, KT_GROUND, KT_CAGE, KT_LODESTONE, KT_LAMP, KT_LID_Y } from '../../world/ketch/ketchModel.js';
import { ketchArt, resolveKetchArt, KT_ARCHIVE, KT_REC } from '../../world/ketch/ketchArt.js';
import { DFPalette } from '../../formats/dfPalette.js';
import { hammerHeadY, hazardState, hazardStrike, sectionPose } from '../../world/ketch/ketchPose.js';
import { packKetchHit } from '../../world/ketch/ketchKit.js';
import { isKetchShip, ketchShipLocation, ketchShipBlocks } from '../../world/ketch/ketchShip.js';
import { ketchHourLight, ketchLightRecord, KT_TRI } from '../../world/ketch/ketchAtmos.js';
import { KT_GROUP, pvsGroupsAt } from '../../world/ketch/ketchStates.js';
import {
  KT_HAMMER, KT_STEAM, KT_ARCS, KT_LIFT, KT_CRADLES, KT_BRIDGE_CRADLES, KT_SOCKETS, KT_RESONATORS, KT_BRIDGE, KT_HOLD, KT_GALLERY, KT_SECTIONS,
  KT_ENGINE, KT_HATCH, KT_HOLD_HATCH, KT_FORK_RING, KT_GANGWAY, KT_WAIST, KT_ANCHOR, liftYAt, deckToDungeon, dungeonToDeck, deckZoneAt, sectionAt,
} from '../../net/ketch/ketchDeck.js';
import { KT_STAGE } from '../../net/ketch/ketchLaw.js';
import { KW_SECTION_WARN_MS } from '../../net/ketch/ketchWarden.js';
import { MOONLIGHT, moonlightTerm, skyState } from '../../render/enhancedSky.js';
import { skyMinutes } from '../../systems/worldTick.js';
import { currentWeather } from '../../systems/weather/weatherSim.js';
import { applyFog } from '../../render/underwaterFog.js';
import { egLightsWith } from '../../world/eliteGates/egHall.js';   // the Spire's lamps' merge (the arm's own lights, the glows, the lamps nearest first)

/** The buckets the deck stands on the collider. */
export const KT_BUCKET = Object.freeze({ ship: 'kt:ship', cage: 'kt:cage', gateHold: 'kt:gate:hold', gateTop: 'kt:gate:top', grateW: 'kt:grate:watch', grateH: 'kt:grate:hold', doors: 'kt:doors', section: (k) => `kt:sec:${k}` });
/** Where a part out of reach is moved (deck y): far under the void, out of every reach. */
export const KT_GONE_Y = -400;
/** How many loose cells the deck draws at once, and carried ones. */
export const KT_LOOSE_MAX = 16;
export const KT_CARRIED_MAX = 8;
/** THE CLOUDS: how many, the box they drift in about the ship (deck metres), their size and the wind's drift (m/s along +x). */
export const KT_CLOUDS = Object.freeze({ n: 34, half: 900, below: Object.freeze([-200, -60]), above: Object.freeze([70, 160]), size: Object.freeze([60, 130]), drift: 2.4, seed: 0x6b40 });
/** THE STEAM: puffs a lane while it bursts, their size, how fast they rise. */
export const KT_STEAM_PUFFS = Object.freeze({ n: 7, size: 1.7, rise: 1.6 });
/** The lit things' lights (the light list's shape): a cell's, a true resonator's and a false one's, a live arc's, the fed
 *  engine's, a fork's. */
export const KT_GLOWS = Object.freeze({
  cell: Object.freeze({ color: Object.freeze([0.5, 0.85, 1.0]), range: 4 }),
  resTrue: Object.freeze({ color: Object.freeze([0.55, 0.9, 1.0]), range: 9 }),
  resFalse: Object.freeze({ color: Object.freeze([1.0, 0.4, 0.15]), range: 9 }),
  arc: Object.freeze({ color: Object.freeze([0.6, 0.9, 1.0]), range: 12 }),
  engine: Object.freeze({ color: Object.freeze([0.5, 0.85, 1.0]), range: 14 }),
  fork: Object.freeze({ color: Object.freeze([0.55, 0.9, 1.0]), range: 6 }),
});

const NONE = Object.freeze([]);
/** KETCH-LOOK KL3 THE HALOS (render/superDungeon/sdHalo.js - the classic set's bloom): a lamp's at its glass, `lamp.size`
 *  across (m) at `lamp.k` of its light; a lit thing's (KT_GLOWS - the engine, an arc, a cell, a resonator, a fork) across
 *  `glow.size` of its reach, clamped to `glow.min`..`glow.max`, at `glow.k` of its light. */
export const KT_HALO = Object.freeze({ lamp: Object.freeze({ size: 0.9, k: 0.35 }), glow: Object.freeze({ size: 0.09, min: 0.4, max: 1.4, k: 0.45 }) });
/**
 * THE HALOS OF `lights` (the deck's lightsNear answer: its lit things - `carried` - and its lamps, nearest first) into `out`,
 * a kept array of kept `{ at, size, color }` slots, its length the count. Answers `out`; nothing made past its first slots.
 * @param {any[]} out @param {ArrayLike<any>} lights
 */
export function ketchHalosInto(out, lights) {
  const H = KT_HALO;
  let n = 0;
  for (let i = 0; i < lights.length; i++) {
    const L = lights[i], h = out[n] ?? (out[n] = { at: [0, 0, 0], size: 0, color: [0, 0, 0] }), glow = !!L.carried, k = glow ? H.glow.k : H.lamp.k;
    h.at[0] = L.x; h.at[1] = L.y; h.at[2] = L.z;
    h.size = glow ? Math.max(H.glow.min, Math.min(H.glow.max, H.glow.size * L.range)) : H.lamp.size;
    // AUDIT SHIP A5: a lamp's halo dims with its zone's gain, never past its own glass (the classic set's gain is the light's, not the bloom's)
    const c = glow || !L.zone ? null : L.zone === 'deck' ? KT_LAMP.color : KT_LAMP.below;
    for (let j = 0; j < 3; j++) h.color[j] = (c ? Math.min(L.color[j], c[j]) : L.color[j]) * k;
    n++;
  }
  out.length = n;
  return out;
}
/** How far the cabin's doors slide into their walls (m), the tower's door's portcullis rises (m), the grates' leaves turn (rad). */
export const KT_DOOR_SLIDE = 1.8;
export const KT_SHAFT_DOOR_H = 3.4;
export const KT_LEAF_TURN = 1.62;
const translate = (out, x, y, z) => { out.fill(0); out[0] = out[5] = out[10] = out[15] = 1; out[12] = x; out[13] = y; out[14] = z; return out; };
const yawAbout = (out, yw, x, y, z) => { const c = Math.cos(yw), s = Math.sin(yw); out.fill(0); out[0] = c; out[2] = -s; out[5] = 1; out[8] = s; out[10] = c; out[15] = 1; out[12] = x; out[13] = y; out[14] = z; return out; };
/** `out` turned by `a` about the z axis through (hx, hy) (deck x and y) and moved by (ox, oy, oz) - a grate's leaf on its hinge. */
function hingeZ(out, a, hx, hy, ox, oy, oz) {
  const c = Math.cos(a), s = Math.sin(a);
  out.fill(0);
  out[0] = c; out[1] = s; out[4] = -s; out[5] = c; out[10] = 1; out[15] = 1;
  out[12] = ox + hx - (c * hx - s * hy); out[13] = oy + hy - (s * hx + c * hy); out[14] = oz;
  return out;
}
/** The Ketch's pictures drawn as cutouts (their alpha a hole, never a blend). */
export const KT_CUTOUT_RECS = /** @type {ReadonlyArray<number>} */ (Object.freeze([KT_REC.net, KT_REC.vane]));
let _artUp = null, _artPal = null, _art = null;
/** The Ketch's art uploaded once a renderer (its billboards' pictures by the same keys) - the made level's, and the world
 *  outside's (scenes/ketch/ketchSky.js) - in its fallback colours, or through `rgb`, the player's palette (KETCH-LOOK KL2:
 *  world/ketch/ketchArt.js resolveKetchArt), uploaded again when that arrives; never back to the fallback after it. */
export function ensureKetchArt(renderer, rgb = null) {
  if (!renderer?.uploadTexture || (_artUp === renderer && (rgb == null || rgb === _artPal))) return;
  // the nets' holes a cutout - the sky through them (AUDIT KETCH L4-2: uploaded plain, every net drew as a solid wall), as
  // the Spire's spans' and the boats' liveries are (scenes/eliteGates/egSpan.js); the puffs stay soft, the billboards' own
  const again = _artUp === renderer;   // AUDIT SHIP A1: the renderer's cache answers a key it holds with the picture it holds - let her old ones go first
  for (const [rec, raw] of (_art ??= ketchArt())) {
    const art = resolveKetchArt(raw, rgb);
    if (again) { renderer.releaseTexture?.(KT_ARCHIVE, rec); renderer.evictEmissionTexture?.(`${KT_ARCHIVE}_${rec}`); }
    renderer.uploadTexture(KT_ARCHIVE, rec, art.albedo, ...(KT_CUTOUT_RECS.includes(rec) ? [{ cutout: true }] : []));
    renderer.uploadEmissionTexture?.(KT_ARCHIVE, rec, art.emission, { white: true });
  }
  _artUp = renderer; _artPal = rgb;
}
let _palette = null;
/** THE PLAYER'S PALETTE (KETCH-LOOK KL2): ART_PAL.COL's 256 colours (768 bytes) off the game's one data seam (scenes/
 *  dataSource.js getBytes - the palette every TEXTURE archive is drawn with), asked once; null where there is no game
 *  data. */
export function ketchPaletteRgb(getBytes = (name) => import('../dataSource.js').then((m) => m.getBytes(name))) {
  _palette ??= (async () => {
    try { const pal = new DFPalette(); if (!pal.load(await getBytes('ART_PAL.COL'), 'ART_PAL.COL')) return null; const h = pal.headerLength; return pal.paletteBuffer.slice(h, h + 768); } catch { return null; }
  })();
  return _palette;
}
/** Her art up on `renderer` now, and through the player's palette once it is read (`palette` false: the fallback alone -
 *  the lab's own colours unless it is asked for the game's). */
export function ketchArtUp(renderer, palette = true) {
  if (!renderer?.uploadTexture) return;
  ensureKetchArt(renderer);
  if (palette) ketchPaletteRgb().then((rgb) => { if (rgb) ensureKetchArt(renderer, rgb); }, () => {});
}

/** THE SHAFT'S GATES: the hold's open with the cage at its foot, the top's with it at the top - and neither while the lift
 *  is dead (the engine starving: AUDIT KETCH L3-14 - the dead cage at its foot left the hold's gate open, and a carrier who
 *  stepped onto it stood off the hold's floor, its cell lost). Pure. */
export const ketchShaftGates = (cageY, runs) => ({ hold: !!runs && cageY <= KT_LIFT.y0 + 0.05, top: !!runs && cageY >= KT_LIFT.y1 - 0.05 });


/**
 * THE DECK'S SET. `palette` false keeps her art in its fallback colours (the lab's default).
 * @param {{ renderer?: any, palette?: boolean }} [deps]
 */
export function createKetchDeck({ renderer = null, palette = true } = {}) {
  const O = deckToDungeon(0, 0, 0);
  const meshes = [];
  const make = (model) => { if (!model || !renderer?.createMesh) return null; try { const m = renderer.createMesh(model); meshes.push(m); return m; } catch (e) { console.warn('[kt] the Ketch would not build', e?.message ?? e); return null; } };
  let draws = null, collider = null, ship = null, parts = null;
  /** each part's draw (and its bucket's translation where it has one) */
  const D = { hammers: [], cage: null, gateHold: null, gateTop: null, grateW: [], grateH: [], doors: [], sections: [], resTrue: [], resFalse: [], cradle: [], bcradle: [], socket: [], loose: [], carried: [], forks: [], arcs: [], line: null, lodestone: null };
  /** each moving bucket's translation (the dungeon's frame - a part about the deck's origin stands at the origin plus its
   *  move; a section, laid in the dungeon's frame, at its drop alone) - read by the collider at every query */
  const T = { cage: [...O], gateHold: [...O], gateTop: [...O], grateW: [...O], grateH: [...O], doors: [...O], sections: Array.from({ length: KT_SECTIONS }, () => [0, 0, 0]) };
  const move = (t3, dy) => { t3[0] = O[0]; t3[1] = O[1] + dy; t3[2] = O[2]; };
  let cageY = /** @type {number} */ (KT_LIFT.y0), cageWas = /** @type {number} */ (KT_LIFT.y0);
  // a frame's own scratch (AUDIT KETCH L3-16 - the ship's hot paths built ~60 KB a frame): the hazards' and the sections'
  // poses, the lit things' records (a pool), the lamps' sort and the lights it hands on - each written in place
  const _gain = { deck: 1, below: 1, cabin: 1 };
  /** The ship's lamps (world/ketch/ketchModel.js ketchLights), the ship's own - built once, the stand's or the first ask's. */
  const lamps = () => (ship ??= buildKetchShip()).lights;
  const _glows = [], _lights = [], _near = [], _glowPool = [], _hz = { live: false, warn: false, k: 0 }, _sp = { solid: true, dy: 0, shake: 0, hidden: false };
  const _resOf = Array.from({ length: KT_SECTIONS }, (_, k) => KT_RESONATORS.findIndex(([x, z]) => sectionAt(x, z) === k));
  let clouds = null, steam = null;
  const cloudSeeds = (() => { let s = KT_CLOUDS.seed >>> 0; const r = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; return Array.from({ length: KT_CLOUDS.n }, (_, k) => ({ x: r() * 2 - 1, z: r() * 2 - 1, y: k % 3 === 0 ? KT_CLOUDS.above[0] + r() * (KT_CLOUDS.above[1] - KT_CLOUDS.above[0]) : KT_CLOUDS.below[0] + r() * (KT_CLOUDS.below[1] - KT_CLOUDS.below[0]), s: KT_CLOUDS.size[0] + r() * (KT_CLOUDS.size[1] - KT_CLOUDS.size[0]) })); })();
  const _cloudCentres = cloudSeeds.map(() => [0, 0, 0]);
  const _steamCentres = Array.from({ length: KT_STEAM.z.length * KT_STEAM_PUFFS.n }, () => [0, KT_GONE_Y, 0]);
  // KETCH-LOOK KL3 THE PVS (world/ketch/ketchStates.js KT_PVS): the draws a part group names, the groups the eye's zone sees
  // (none culled while no eye is given), the view it holds for the next frame's edge, the eye in the deck's frame
  const _grouped = [], _seen = new Set(), _eyeDeck = [0, 0, 0];
  let _view = /** @type {string | null} */ (null), _eyed = false;

  /** a part's draw - a record even for a mesh that would not build (posed, never drawn: AUDIT KETCH L3-15, one part's failed
   *  build threw every frame from pose()) */
  const draw = (gpu, o = {}) => {
    if (!draws) return null;
    const d = { gpu, object: { matrix: identity() }, hidden: !gpu, noShadow: !!o.noShadow, texRemap: null };
    if (gpu) draws.push(d);
    if (o.group) { d.group = o.group; d.culled = false; _grouped.push(d); }   // KETCH-LOOK KL3: its PVS group (KT_GROUP)
    return d;
  };
  const hide = (d) => { if (d && !d.hidden) { d.hidden = true; d.object.matrix.fill(0); } };
  const bucket = (key, p, t) => { if (!collider || !p?.hit?.length) return; const { positions, indices } = packKetchHit(p.hit); try { collider.addMesh(key, positions, indices, identity(), t ? () => t : undefined); } catch (e) { console.warn('[kt] a collider', key, e?.message ?? e); } };
  const at = (out, x, y, z) => translate(out, O[0] + x, O[1] + y, O[2] + z);
  /** A hatch's two leaves: flat over it, or each turned up on its hinge (the left at x0, the right at x1). */
  const leaves = (pair, H, open) => {
    if (!open) { at(pair[0].object.matrix, 0, 0, 0); at(pair[1].object.matrix, 0, 0, 0); return; }
    hingeZ(pair[0].object.matrix, KT_LEAF_TURN, H.x0 - 0.05, H.y0, O[0], O[1], O[2]);
    hingeZ(pair[1].object.matrix, -KT_LEAF_TURN, H.x1 + 0.05, H.y0, O[0], O[1], O[2]);
  };

  return {
    /** Stand the ship into the dungeon's draws and collider - once a context. */
    stand({ dynamicDraws, collider: c = null }) {
      if (draws) return false;
      draws = dynamicDraws; collider = c;
      ketchArtUp(renderer, palette);
      ship ??= buildKetchShip();
      parts ??= buildKetchParts();
      draw(make(ship.model));
      draw(make(ship.lamps), { noShadow: true });   // KETCH-LOOK KL1: a lamp's glass never shadows its own light
      draw(make(buildKetchGround()), { noShadow: true });
      if (collider) { const { positions, indices } = packKetchHit(ship.hit); try { collider.addMesh(KT_BUCKET.ship, positions, indices, identity()); } catch (e) { console.warn('[kt] the ship\'s collider', e?.message ?? e); } }
      const P = parts, g = (p) => make(p.model);
      const hammer = g(P.hammer);
      for (let ri = 0; ri < KT_HAMMER.rows.length; ri++) for (let li = 0; li < KT_HAMMER.lanes.length; li++) D.hammers.push({ ri, li, d: draw(hammer, { noShadow: true, group: KT_GROUP.gundeck }) });
      D.cage = draw(g(P.cage), { noShadow: true }); bucket(KT_BUCKET.cage, P.cage, T.cage);   // casts nothing: a part that rides rebuilds no lamp's cube (KETCH-LOOK KL0)
      D.gateHold = draw(g(P.gateHold), { noShadow: true, group: KT_GROUP.hold }); bucket(KT_BUCKET.gateHold, P.gateHold, T.gateHold);
      D.gateTop = draw(g(P.gateTop), { noShadow: true, group: KT_GROUP.aloft }); bucket(KT_BUCKET.gateTop, P.gateTop, T.gateTop);
      // the hatches never culled (a shut leaf is a ceiling below and a floor above); the cabin's doors the bridge's
      for (const [dk, pk, bk, group] of [['grateW', 'grateWatch', 'grateW', null], ['grateH', 'grateHold', 'grateH', null], ['doors', 'doors', 'doors', KT_GROUP.bridge]]) {
        D[dk] = [draw(g(P[pk].left), { noShadow: true, group }), draw(g(P[pk].right), { noShadow: true, group })];
        bucket(KT_BUCKET[bk], P[pk], T[bk]);
      }
      P.sections.forEach((s, k) => { D.sections.push(draw(g(s), { group: KT_GROUP.bridge })); bucket(KT_BUCKET.section(k), s, T.sections[k]); });
      const rt = g(P.resonator.true), rf = g(P.resonator.false), cell = g(P.cell), fork = g(P.fork);
      for (let k = 0; k < KT_RESONATORS.length; k++) { D.resTrue.push(draw(rt, { noShadow: true, group: KT_GROUP.bridge })); D.resFalse.push(draw(rf, { noShadow: true, group: KT_GROUP.bridge })); }
      for (let k = 0; k < KT_CRADLES.length; k++) D.cradle.push(draw(cell, { noShadow: true, group: KT_GROUP.hold }));
      for (let k = 0; k < KT_BRIDGE_CRADLES.length; k++) D.bcradle.push(draw(cell, { noShadow: true, group: KT_GROUP.bridge }));
      for (let k = 0; k < KT_SOCKETS.length; k++) D.socket.push(draw(cell, { noShadow: true, group: KT_GROUP.hold }));
      for (let k = 0; k < KT_LOOSE_MAX; k++) D.loose.push(draw(cell, { noShadow: true }));
      for (let k = 0; k < KT_CARRIED_MAX; k++) D.carried.push(draw(cell, { noShadow: true }));
      for (let k = 0; k < 7; k++) D.forks.push(draw(fork, { noShadow: true, group: KT_GROUP.bridge }));
      const arcs = P.arc.map((a) => g(a));
      for (let j = 0; j < KT_ARCS.z.length; j++) D.arcs.push({ d: draw(arcs[0], { noShadow: true, group: KT_GROUP.hold }), meshes: arcs });
      D.line = draw(g(P.line), { noShadow: true });
      D.lodestone = draw(g(P.lodestone), { noShadow: true, group: KT_GROUP.bridge });
      for (const d of [...D.resFalse, ...D.cradle, ...D.bcradle, ...D.socket, ...D.loose, ...D.carried, ...D.forks, ...D.arcs.map((a) => a.d), D.line]) hide(d);
      if (renderer?.createBillboardBatch) {
        try {
          clouds = renderer.createBillboardBatch(KT_ARCHIVE, KT_REC.cloud, { w: 1, h: 1 }, _cloudCentres, { dynamic: true, scales: cloudSeeds.map((c) => c.s) });
          if (clouds) clouds.noShadow = true;
          steam = renderer.createBillboardBatch(KT_ARCHIVE, KT_REC.steam, { w: KT_STEAM_PUFFS.size, h: KT_STEAM_PUFFS.size }, _steamCentres, { dynamic: true });
          if (steam) steam.noShadow = true;
        } catch (e) { console.warn('[kt] the clouds', e?.message ?? e); clouds = null; steam = null; }
      }
      return true;
    },
    /**
     * ONE FRAME, BEFORE THE MOTOR: every part where the voyage and the clock have it. `V` the voyage as this page holds it
     * (net/ketch/ketchLink.js state - its stage `sg`, its cells `cl`, its fight `ws`; null: the Watch, nothing taken);
     * `t` the shared clock's seconds; `now` the relay's ms; `body` the motor (a body on the cage's floor is carried);
     * `carried` the places (dungeon frame) a carried cell is drawn at; `eye` (dungeon frame - the body's feet by default)
     * where the PVS is read from (KETCH-LOOK KL3: every grouped part its zone cannot see `culled`; none without an eye).
     */
    pose(V, t, now, body = null, carried = NONE, eye = body?.pos ?? null) {
      if (!draws) return;
      _eyed = !!eye;
      if (eye) { _eyeDeck[0] = eye[0] - O[0]; _eyeDeck[1] = eye[1] - O[1]; _eyeDeck[2] = eye[2] - O[2]; _view = pvsGroupsAt(_eyeDeck, _view, _seen); }   // dungeonToDeck, in place
      for (const d of _grouped) d.culled = _eyed && !_seen.has(d.group);
      const sg = V?.sg ?? KT_STAGE.watch, cl = V?.cl ?? null, ws = V?.ws ?? null;
      // the hammers
      for (const h of D.hammers) at(h.d.object.matrix, KT_HAMMER.lanes[h.li], hammerHeadY(h.ri, h.li, t), KT_HAMMER.rows[h.ri]);
      // the lift: its cage on the law's clock (dead at its foot until the engine is fed); a body on it carried
      cageWas = cageY;
      cageY = liftYAt(t, sg >= KT_STAGE.sailwalk);
      at(D.cage.object.matrix, KT_LIFT.x, cageY, KT_LIFT.z);
      T.cage[0] = O[0] + KT_LIFT.x; T.cage[1] = O[1] + cageY; T.cage[2] = O[2] + KT_LIFT.z;   // the cage is made about the deck's origin
      const dy = cageY - cageWas;
      if (dy && body?.grounded && body.groundKey === KT_BUCKET.cage) body.carryBy?.(0, dy, 0);
      const gates = ketchShaftGates(cageY, sg >= KT_STAGE.sailwalk), atFoot = gates.hold, atTop = gates.top;
      move(T.gateHold, atFoot ? KT_GONE_Y : 0); at(D.gateHold.object.matrix, 0, atFoot ? KT_SHAFT_DOOR_H : 0, 0);
      move(T.gateTop, atTop ? KT_GONE_Y : 0); at(D.gateTop.object.matrix, 0, atTop ? -1.4 : 0, 0);
      // the hatches: barred, then each leaf turned up on its hinge once the room has opened them
      const openW = sg >= KT_STAGE.gallery, openH = sg >= KT_STAGE.engine;
      move(T.grateW, openW ? KT_GONE_Y : 0);
      move(T.grateH, openH ? KT_GONE_Y : 0);
      leaves(D.grateW, KT_HATCH, openW);
      leaves(D.grateH, KT_HOLD_HATCH, openH);
      // the cabin's doors: shut while the Warden stands, slid back into their walls once it falls
      const openC = sg >= KT_STAGE.vault;
      move(T.doors, openC ? KT_GONE_Y : 0);
      at(D.doors[0].object.matrix, openC ? -KT_DOOR_SLIDE : 0, 0, 0);
      at(D.doors[1].object.matrix, openC ? KT_DOOR_SLIDE : 0, 0, 0);
      // the bridge's sections: whole, shuddering, falling, gone, rising back (the fight's word of its ring)
      const sec = ws?.sec ?? NONE;
      for (let k = 0; k < KT_SECTIONS; k++) {
        const p = sectionPose(k, sec, now, KW_SECTION_WARN_MS, _sp), d = D.sections[k];
        T.sections[k][1] = p.solid ? 0 : KT_GONE_Y;
        if (p.hidden) hide(d); else { d.hidden = false; translate(d.object.matrix, p.shake, p.dy, p.shake * 0.7); }
        d.noShadow = !(p.solid && p.dy === 0 && p.shake === 0);   // a section casts only whole and still - from its warning to its return it moves (KETCH-LOOK KL0)
        // its resonator rides it
        const ri = _resOf[k];
        if (ri >= 0) {
          const [x, z] = KT_RESONATORS[ri], ok = !ws || ws.ph !== 2 || ws.rs?.[ri] === 1, spin = t * (ok ? 0.8 : 2.4);
          const on = ok ? D.resTrue[ri] : D.resFalse[ri], off = ok ? D.resFalse[ri] : D.resTrue[ri];
          hide(off);
          if (p.hidden) hide(on); else { on.hidden = false; yawAbout(on.object.matrix, spin, O[0] + x + p.shake, O[1] + KT_BRIDGE.y + 4.6 + p.dy + 0.15 * Math.sin(t * 1.7 + ri), O[2] + z); }
        }
      }
      // the cells: in their cradles while charged, in the sockets the engine holds, where they lie, in their carriers' hands
      for (let j = 0; j < D.cradle.length; j++) { const ready = sg === KT_STAGE.engine && cl?.cr?.[j] === 1; if (ready) { D.cradle[j].hidden = false; at(D.cradle[j].object.matrix, KT_CRADLES[j][0], KT_HOLD.y + 0.75, KT_CRADLES[j][1]); } else hide(D.cradle[j]); }
      for (let j = 0; j < D.bcradle.length; j++) { const ready = !!ws && ws.ph === 2 && !!ws.ward && cl?.br?.[j] === 1; if (ready) { D.bcradle[j].hidden = false; at(D.bcradle[j].object.matrix, KT_BRIDGE_CRADLES[j][0], KT_BRIDGE.y + 0.75, KT_BRIDGE_CRADLES[j][1]); } else hide(D.bcradle[j]); }
      for (let j = 0; j < D.socket.length; j++) { const fed = (cl?.sk?.[j] ?? 0) === 1 || sg > KT_STAGE.engine; if (fed) { D.socket[j].hidden = false; at(D.socket[j].object.matrix, KT_SOCKETS[j][0], KT_HOLD.y + 1.0, KT_SOCKETS[j][1]); } else hide(D.socket[j]); }
      const lo = cl?.lo ?? NONE;
      for (let j = 0; j < D.loose.length; j++) { const l = lo[j]; if (l) { D.loose[j].hidden = false; yawAbout(D.loose[j].object.matrix, l[0] * 1.3, O[0] + l[1], O[1] + l[2] + 0.02, O[2] + l[3]); } else hide(D.loose[j]); }
      for (let j = 0; j < D.carried.length; j++) { const p = carried[j]; if (p) { D.carried[j].hidden = false; translate(D.carried[j].object.matrix, p[0], p[1], p[2]); } else hide(D.carried[j]); }
      // the forks the song raised, each while it stands
      const fk = ws?.fk ?? null;
      for (let j = 0; j < D.forks.length; j++) { const q = fk?.c?.[j]; if (q && (q[2] ?? 1) > 0) { D.forks[j].hidden = false; at(D.forks[j].object.matrix, q[0], KT_BRIDGE.y, q[1]); } else hide(D.forks[j]); }
      // the arcs: live through their span, one bolt a strike held still through it (KETCH-LOOK KL0: a frame each 60 ms
      // was a 16.7 Hz flicker, past the flash law's 3 Hz - render/gate/gateTelegraph.js TELEGRAPH_THROB_MAX_HZ)
      for (let j = 0; j < D.arcs.length; j++) {
        const s = hazardState('arc', j, t, _hz), a = D.arcs[j];
        if (!s.live) { hide(a.d); continue; }
        const n = a.meshes.length, k = hazardStrike('arc', j, t) + j;
        a.d.gpu = a.meshes[((k % n) + n) % n] ?? a.d.gpu;   // a frame that would not build: the last one held
        a.d.hidden = false; at(a.d.object.matrix, 0, KT_HOLD.y + 4.4, KT_ARCS.z[j]);
      }
      // the bosun's line, once the bridge is unbarred
      if (sg >= KT_STAGE.bridge) { D.line.hidden = false; translate(D.line.object.matrix, 0, 0, 0); } else hide(D.line);
      // the lodestone behind the helm, turning on its own whatever the voyage does
      yawAbout(D.lodestone.object.matrix, t * KT_LODESTONE.spin, O[0] + KT_LODESTONE.x, O[1] + KT_LODESTONE.y, O[2] + KT_LODESTONE.z);
      // the clouds' drift and the steam's puffs
      if (clouds) {
        for (let k = 0; k < cloudSeeds.length; k++) {
          const c = cloudSeeds[k], H = KT_CLOUDS.half, x = ((((c.x * H + t * KT_CLOUDS.drift) % (2 * H)) + 3 * H) % (2 * H)) - H;
          _cloudCentres[k][0] = O[0] + x; _cloudCentres[k][1] = O[1] + c.y; _cloudCentres[k][2] = O[2] + 110 + c.z * H;   // the deck's frame moved, as deckToDungeon
        }
        renderer.moveBillboardBatch?.(clouds, _cloudCentres);
      }
      if (steam) {
        let i = 0;
        for (let j = 0; j < KT_STEAM.z.length; j++) {
          const s = hazardState('steam', j, t, _hz);
          for (let k = 0; k < KT_STEAM_PUFFS.n; k++, i++) {
            const c = _steamCentres[i];
            if (!s.live && !(s.warn && k < 2)) { c[0] = O[0]; c[1] = O[1] + KT_GONE_Y; c[2] = O[2]; continue; }
            const ph = (t * 1.3 + k * 0.37) % 1, x = KT_GALLERY.x0 + 0.6 + ((k + 0.5) / KT_STEAM_PUFFS.n) * (KT_GALLERY.x1 - KT_GALLERY.x0 - 1.2);
            c[0] = O[0] + x + 0.4 * Math.sin(k * 3.1 + t); c[1] = O[1] + KT_GALLERY.y + 0.2 + ph * KT_STEAM_PUFFS.rise * (s.live ? 2 : 0.6); c[2] = O[2] + KT_STEAM.z[j] + 0.5 * Math.sin(k * 1.7 + t * 2);
          }
        }
        renderer.moveBillboardBatch?.(steam, _steamCentres);
      }
      // the lit things (lightsNear reads them)
      _glows.length = 0;
      const glow = (x, y, z, G, k = 1) => {
        const g = _glowPool[_glows.length] ?? (_glowPool[_glows.length] = { x: 0, y: 0, z: 0, range: 0, color: [0, 0, 0], carried: true });
        g.x = O[0] + x; g.y = O[1] + y; g.z = O[2] + z; g.range = G.range; g.color[0] = G.color[0] * k; g.color[1] = G.color[1] * k; g.color[2] = G.color[2] * k;
        _glows.push(g);
      };
      if (sg >= KT_STAGE.engine) glow(KT_ENGINE.x, KT_HOLD.y + KT_ENGINE.h + 0.6, KT_ENGINE.z, KT_GLOWS.engine, sg > KT_STAGE.engine ? 1 : 0.25 + 0.75 * ((cl?.bk ?? 0) / Math.max(1, cl?.nd ?? 1)));
      for (let j = 0; j < D.arcs.length; j++) { const s = hazardState('arc', j, t, _hz); if (s.live || s.warn) glow(0, KT_HOLD.y + 4.4, KT_ARCS.z[j], KT_GLOWS.arc, s.live ? 1 : 0.3 * s.k); }
      for (let j = 0; j < D.cradle.length; j++) if (!D.cradle[j].hidden) glow(KT_CRADLES[j][0], KT_HOLD.y + 1.2, KT_CRADLES[j][1], KT_GLOWS.cell);
      for (let j = 0; j < KT_RESONATORS.length; j++) { const d = D.resTrue[j].hidden ? D.resFalse[j] : D.resTrue[j]; if (!d.hidden) glow(KT_RESONATORS[j][0], KT_BRIDGE.y + 4.6, KT_RESONATORS[j][1], d === D.resTrue[j] ? KT_GLOWS.resTrue : KT_GLOWS.resFalse); }
      for (let j = 0; j < D.forks.length; j++) if (!D.forks[j].hidden) { const q = fk.c[j]; glow(q[0], KT_BRIDGE.y + 2.2, q[1], KT_GLOWS.fork); }
    },
    /** The ship's lamps and its lit things, the nearest `cap` to `eye` first (the dungeon's frame). */
    /** (Its answer is the deck's own list, written again at the next ask - read it, never keep it.) */
    lightsNear(eye, cap = 16) {
      _lights.length = 0;
      for (const l of _glows) _lights.push(l);
      for (const l of lamps()) _lights.push(l);
      if (eye) {
        for (const l of _lights) l._near = Math.hypot(l.x - eye[0], l.y - eye[1], l.z - eye[2]) - l.range;   // each once, never per comparison
        for (let i = 1; i < _lights.length; i++) { const l = _lights[i]; let j = i - 1; while (j >= 0 && _lights[j]._near > l._near) { _lights[j + 1] = _lights[j]; j--; } _lights[j + 1] = l; }   // in place, nothing built
      }
      _near.length = 0;
      for (let i = 0; i < _lights.length && i < cap; i++) _near.push(_lights[i]);
      return _near;
    },
    /** HER LAMPS AT THE GAIN OF THE ZONE THE EYE STANDS IN (KETCH-LOOK KL1, world/ketch/ketchAtmos.js KT_HOURS `lamps`):
     *  her open decks' by the hour - dim by day, brightest at night - while the eye is on them, below decks' and the
     *  cabin's by their rows while it is in them (the other zones' as they were: none of their light reaches the eye).
     *  Written in place, only when a zone's gain moves. */
    lampGain(g, zone = 'deck') {
      if (_gain[zone] === g) return;
      _gain[zone] = g;
      for (const l of lamps()) if (l.zone === zone) { const c = zone === 'deck' ? KT_LAMP.color : KT_LAMP.below; for (let k = 0; k < 3; k++) l.color[k] = c[k] * g; }
    },
    /** KETCH-LOOK KL3: whether the eye's zone sees part group `g` (KT_GROUP) at the last pose - every group while no eye
     *  was given; the view it holds. */
    sees: (g) => !_eyed || _seen.has(g),
    view: () => (_eyed ? _view : null),
    /** The clouds and the steam, for the frame's billboard pass. */
    billboards() { return [clouds, steam].filter(Boolean); },
    /** Where the cage's floor stands now (deck y) - the lift's riders and its prompt read it. */
    cageY: () => cageY,
    /** The collider's whole ship (the lab's law wire): the static bucket and every part's, each at its place now. */
    colliderTris() {
      const out = [...(ship ?? buildKetchShip()).hit];
      // AUDIT KETCH L4-16: and every part's at its place now (its bucket's translation), as the collider holds them
      const add = (p, t) => { const h = p?.hit ?? NONE; for (let i = 0; i + 2 < h.length; i += 3) out.push(h[i] + t[0], h[i + 1] + t[1], h[i + 2] + t[2]); };
      if (parts) {
        add(parts.cage, T.cage); add(parts.gateHold, T.gateHold); add(parts.gateTop, T.gateTop);
        add(parts.grateWatch, T.grateW); add(parts.grateHold, T.grateH); add(parts.doors, T.doors);
        parts.sections.forEach((sp, k) => add(sp, T.sections[k]));
      }
      return new Float32Array(out);
    },
    /** Gone with the dungeon: every mesh and batch freed, every bucket off the collider. */
    clear() {
      if (collider) for (const k of [KT_BUCKET.ship, KT_BUCKET.cage, KT_BUCKET.gateHold, KT_BUCKET.gateTop, KT_BUCKET.grateW, KT_BUCKET.grateH, KT_BUCKET.doors, ...Array.from({ length: KT_SECTIONS }, (_, k) => KT_BUCKET.section(k))]) { try { collider.removeBucket?.(k); } catch { /* gone */ } }
      for (const m of meshes) { try { renderer?.destroyMesh?.(m); } catch { /* gone */ } }
      for (const b of [clouds, steam]) if (b) { try { renderer?.destroyBillboardBatch?.(b); } catch { /* gone */ } }
      meshes.length = 0; clouds = null; steam = null;
      for (const k of Object.keys(D)) { const v = D[k]; if (Array.isArray(v)) v.length = 0; else D[k] = null; }
      _grouped.length = 0; _seen.clear(); _view = null; _eyed = false;
      draws = null; collider = null;
    },
  };
}

// ── THE AIR AND THE LIGHT ────────────────────────────────────────────────────────────────────────────────────────
const _O = deckToDungeon(0, 0, 0), _lookAt = [0, 0, 0], _foot = ketchLightRecord();
const _look = Object.assign(ketchLightRecord(), { clear: [0, 0, 0, 1], below: false, zone: 'deck' });
/** The sky's foot's colour at the hour (the haze leans to it): her open decks' fog by the hour (world/ketch/ketchAtmos.js
 *  KT_HOURS - night blue, dawn rose, the day's pale blue, dusk amber), into `out`. */
export function ketchSkyFoot(minute, out = [0, 0, 0]) {
  const c = ketchHourLight(minute, 'deck', _foot).fog.color;
  out[0] = c[0]; out[1] = c[1]; out[2] = c[2];
  return out;   // `out` written in place (AUDIT KETCH L3-16)
}
/**
 * THE FRAME'S LOOK at the eye (the dungeon's frame) and the world's minute of the day: her light by the hour and the zone
 * (world/ketch/ketchAtmos.js ketchHourLight's record) and `clear`, `below`, `zone` - one object, its arrays written in
 * place. `moon` the world's moon term (render/enhancedSky.js moonlightTerm - its direction and share; null none): by night
 * the moons' key comes from it, and a moon that is new, set or clouded gives none.
 * @param {ArrayLike<number> | null} eye @param {number} minute @param {boolean} [lane] @param {{ dir: ArrayLike<number>, scale: number } | null} [moon]
 */
export function ketchFrameLook(eye, minute, lane = false, moon = null) {
  const p = _lookAt;
  if (eye) { p[0] = eye[0] - _O[0]; p[1] = eye[1] - _O[1]; p[2] = eye[2] - _O[2]; } else { p[0] = 0; p[1] = 2; p[2] = 0; }   // dungeonToDeck, in place
  const at = deckZoneAt(p[0], p[1] - 1.6, p[2]);
  // below decks: the rooms the deck plan names, and anywhere inside the hull with the feet under the deck - a stair's whole
  // flight (AUDIT KETCH L4-7: the waist's stair read 'waist' to two metres down, and lit its walker with the open sky)
  const feetY = p[1] - 1.6, inHull = Math.abs(p[0]) <= KT_HOLD.x1 && p[2] >= KT_HOLD.z0 - 2 && p[2] <= KT_HOLD.z1 + 2;
  const below = at === 'gallery' || at === 'landing' || at === 'hold' || (at === 'lift' && p[1] < -1) || (inHull && feetY < -0.3);
  const zone = below ? 'below' : at === 'cabin' ? 'cabin' : 'deck';
  const L = ketchHourLight(minute, zone, _look);
  L.below = below; L.zone = zone;
  if (!lane) {   // the classic set: its light carries the eye the lane would open (KETCH-LOOK KL2, KT_HOURS `classic`)
    const k = L.classic.light;
    for (let i = 0; i < 3; i++) { L.ambient[i] *= k; L.tri.sky[i] *= k; L.tri.equator[i] *= k; L.tri.ground[i] *= k; }
    L.sunScale *= k; L.key.scale *= k; L.lamps *= L.classic.lamps;
  }
  const m = moon && moon.scale > 0 ? Math.min(1, moon.scale / MOONLIGHT.masser) : 0, k0 = L.key.scale;
  L.key.scale *= m;
  for (let i = 0; i < 3; i++) L.tri.ground[i] = Math.max(0, L.tri.ground[i] - L.key.color[i] * k0 * (1 - m) * KT_TRI.bounce);   // AUDIT SHIP A6: the moons' bounce at their own light - none on a moonless night
  if (m > 0) { L.key.dir[0] = moon.dir[0]; L.key.dir[1] = moon.dir[1]; L.key.dir[2] = moon.dir[2]; }
  L.clear[0] = L.fog.color[0]; L.clear[1] = L.fog.color[1]; L.clear[2] = L.fog.color[2];
  return L;
}
/** THE WORLD'S MOON NOW (render/enhancedSky.js moonlightTerm, off the state the world's sky draws from - the sky's minute,
 *  its date, the weather's word): the night key's bearing and share. Pure of the host - the sky is the world's, and its
 *  moons are a function of the clock (bible/01-Overview/Host-Split.md: no host line for a read a module can make). Made
 *  once a sky minute, so the frame builds nothing. */
let _moonAt = NaN, _moon = null;
export function ketchMoonNow(sky = skyMinutes(), weather = currentWeather()) {
  const m = Math.floor(sky);
  if (m !== _moonAt) { _moonAt = m; _moon = moonlightTerm(skyState({ minuteOfDay: ((m % 1440) + 1440) % 1440, weather, classicMinutes: m, skyMinutes: m })); }
  return _moon;
}
/** THE LOOK ON THE RENDERER (the dungeon arm's and the lab's one hand): the trilight (its equator the flat ambient a
 *  billboard takes), the sun, the moons' key or none, the haze, and on the lane the zone's grade - the lane takes its
 *  defaults back the frame it is not called (render/renderer.js `_sceneGrade`); the classic set has no grade. */
export function ketchApplyLook(renderer, L, fogInto = null) {
  renderer.setLighting?.(L.tri.equator, L.sunScale, L.sunColor, L.tri);
  renderer.setMoonlight?.(L.key.scale > 0 ? L.key : null);
  applyFog(renderer, L.fog, fogInto);
  if (renderer.lightingLane) renderer.setSceneGrade?.(L.grade);
}

// ── THE HOST'S SEAMS ─────────────────────────────────────────────────────────────────────────────────────────────
/**
 * THE KETCH ON THE DUNGEON HOST: `renderer`, the outer host (its seams routed here while a ship stands - `host.ketch()` the
 * world's client, scenes/ketch/ketchClient.js), and the mode machine's live reads `wm` (`mode`, `dungeonCtx`, `dungeonLoc`,
 * and `place(at, yaw)` - a body stood elsewhere on the level, the action teleport's way); `moon` the world's moon now
 * (ketchMoonNow - a test's own).
 * @param {{ renderer: any, host: any, wm: { readonly mode: string, readonly dungeonCtx: any, readonly dungeonLoc: any, place: (at: number[], yaw?: number|null) => boolean }, moon?: () => ({ dir: ArrayLike<number>, scale: number } | null) }} deps
 */
/** KETCH-FIX (2026-10-25, the owner: "The invisable panels cam fuck up players"): IS A BODY STANDING ON THE WAIST'S LID -
 *  the unseen ceiling over the Anchor Deck and the waist (world/ketch/ketchModel.js KT_LID_Y, the collider's alone, so
 *  nobody climbs out over the nets or the quarter wall)? From above it is an invisible floor in the air: a body off the main
 *  top's net or over the quarter wall's top stood on it, out of the fight with no way down. It is the sky's, then - the
 *  ship casts it back as the nets do. The mast-lift's shaft (its cage rides through the lid's height) is never the lid.
 *  Deck metres. Pure. */
export function ketchOnLid(x, y, z) {
  if (!(y > KT_LID_Y - 0.3 && y < KT_LID_Y + 0.6)) return false;
  if (Math.abs(x - KT_LIFT.x) <= KT_LIFT.half + 0.5 && Math.abs(z - KT_LIFT.z) <= KT_LIFT.half + 0.5) return false;
  const W = KT_WAIST, A = KT_ANCHOR;
  return (x >= W.x0 && x <= W.x1 && z >= W.z0 && z <= W.z1) || (x >= A.x0 && x <= A.x1 && z >= A.z0 && z <= A.z1);
}

export function createKetchDeckHost({ renderer, host, wm, moon = ketchMoonNow }) {
  let deck = null, deckCtx = null;
  const onShip = () => wm.mode === 'dungeon' && isKetchShip(wm.dungeonLoc);
  const K = () => host.ketch?.() ?? null;
  // THE SIX COMBAT SEAMS AND THE BILLBOARDS ARE THE SHIP'S on a ship (the Spire's way: scenes/worldModes.js's egBoss table)
  for (const [gate, kt] of [['gateBoss', 'boss'], ['onBossHit', 'bossHit'], ['gateCrystals', 'forks'], ['onCrystalHit', 'forkHit'], ['gateHost', 'hostTargets'], ['onHostHit', 'hostHit']]) {
    const own = host[gate];
    host[gate] = (...a) => (onShip() ? K()?.[kt]?.(...a) ?? null : own?.(...a) ?? null);
  }
  { const own = host.extraBillboards; host.extraBillboards = () => { const b = own?.() ?? []; return onShip() ? [...b, ...(deck?.billboards() ?? NONE), ...(K()?.batches?.() ?? NONE)] : b; }; }
  // THE STEPS' VOID ON THE SHIP: the Sailwalk's own cast-back stands; a fall from anywhere else (the bridge's fallen ring,
  // over its rail) is caught back to the last ground the body stood on off the course - the Ketch's line and cost
  { const own = host.sdCastBack; host.sdCastBack = (...a) => (onShip() ? castBack() : own?.(...a)); }
  let safe = null, safeZone = null;
  function castBack() {
    const at = safe && safeZone !== 'sailwalk' && safeZone !== 'top' ? safe : null;
    if (at) wm.place(deckToDungeon(at[0], at[1] + 0.2, at[2]));
    K()?.castBack?.();
  }
  /** Where the body last stood on solid ground of the ship (deck frame), and on which part - the cast-back's landing. */
  function noteGround(body) {
    if (!body?.grounded || !body.pos) return;
    const p = dungeonToDeck(body.pos[0], body.pos[1], body.pos[2]), z = deckZoneAt(p[0], p[1], p[2]);
    if (!z || z === 'lift') return;
    if (z === 'bridge') { const k = sectionAt(p[0], p[2]); if (k >= 0) { safe = [KT_BRIDGE.x + (p[0] - KT_BRIDGE.x) * 0.55, KT_BRIDGE.y, KT_BRIDGE.z + (p[2] - KT_BRIDGE.z) * 0.55]; safeZone = z; return; } }
    if (z === 'gangway') { safe = [KT_GANGWAY.bx, 0, KT_GANGWAY.bz]; safeZone = z; return; }
    safe = p; safeZone = z;
  }
  const _extra = [], _fogInto = new Float32Array(3), _halos = [];
  return {
    /** THE SHIP stood into its built context (scenes/worldModes.js - before its start marker is read): its set, its
     *  ride before the motor (beside the Steps'), its presses, its teardown the context's. */
    stand(ctx) {
      deck = createKetchDeck({ renderer });
      deck.stand({ dynamicDraws: ctx.dynamicDraws, collider: ctx.collider });
      deckCtx = ctx;
      safe = null; safeZone = null;
      const ride = ctx.sdStepsRide?.bind(ctx);
      ctx.sdStepsRide = (dt, body, live = true) => {
        const k = K(), now = k?.now?.() ?? Date.now(), t = k?.clock?.() ?? now / 1000;
        deck?.pose(k?.voyage?.() ?? null, t, now, body, k?.carried?.() ?? NONE);
        if (live && body?.grounded && body.pos) { const p = dungeonToDeck(body.pos[0], body.pos[1], body.pos[2]); if (ketchOnLid(p[0], p[1], p[2])) castBack(); }   // KETCH-FIX: the lid is the sky's
        if (live) noteGround(body);
        return ride ? ride(dt, body, live) : null;
      };
      ctx.addActivationTargets?.(() => K()?.targets?.() ?? NONE);
      ctx.addActivationNamer?.((key) => (typeof key === 'string' && key.startsWith('kt:') ? K()?.name?.(key) ?? null : null));
      ctx.addActivationTargets?.(() => host.spoilTargets?.() ?? NONE);
      ctx.addActivationNamer?.((key) => ((typeof key === 'string' && key.startsWith('spoil')) ? host.spoilName?.(key) ?? null : null));
      ctx.addTeardown?.(() => { if (deckCtx === ctx) { deck?.clear(); deck = null; deckCtx = null; } });
    },
    /**
     * THE FRAME'S LOOK on the ship (the dungeon arm's, after its own lights - scenes/worldModes.js): the light and the air
     * at the eye (ketchFrameLook, ketchApplyLook - her hour and zone: the trilight, the sun or the moons' key off the world's
     * own moon, `moon` - ketchMoonNow, the haze, the lane's grade), her lamps at their zone's gain, the ship's lamps and lit
     * things and the fight's glows after the player's own lights (`lit` - the arm's list), nearest first. Answers the look
     * (its sun's direction for the frame's begin).
     */
    frameLook(eye, lit, minute) {
      const L = ketchFrameLook(eye, minute, !!renderer?.lightingLane, moon());
      ketchApplyLook(renderer, L, _fogInto);
      deck?.lampGain(L.lamps, L.zone);
      _extra.length = 0;
      for (const l of K()?.lights?.() ?? NONE) _extra.push(l);
      const lamps = deck?.lightsNear(eye, 24) ?? NONE;   // the deck's own list (egLightsWith sorts it in place - it is written again next frame)
      K()?.halos?.(renderer?.lightingLane ? NONE : ketchHalosInto(_halos, lamps));   // KETCH-LOOK KL3: the classic set's bloom, with the late pass
      if (lit) { const w = egLightsWith(lit, _extra, lamps, eye); renderer.setPointLights?.(w.data, null, w.colors); }
      return L;
    },
    /** The frame's look on the ship at the eye (ketchFrameLook) - its reads alone. */
    look: (eye, minute, lane) => ketchFrameLook(eye, minute, lane),
    /** The ship's lights nearest the eye. */
    lights: (eye, cap) => deck?.lightsNear(eye, cap) ?? NONE,
    /** Is the mode machine on a ship now. */
    onShip,
    /** The set (tests, the client's reads). */
    deck: () => deck,
    /** THE GROUND MY CAST-BACK WOULD TAKE ME TO (deck frame), and its part. */
    safe: () => (safe ? { at: [...safe], zone: safeZone } : null),
  };
}
/**
 * THE DOOR UP: the dungeon host's transition record for a crew's ship (scenes/worldModes.js enterKetch - the Hour's shape): the
 * made location (world/ketch/ketchShip.js), the blocks file answering its one made block, `ketch` the ship itself, the
 * climate and region at Daggerfall, the room's key as its group - or null for a voyage or captain that keys no ship.
 * `r` is { n: the voyage, owner: the captain's digest, site: { climateBase, season, climate, regionIndex, regionName } }.
 */
export function ketchShipHit(r, blocks) {
  if (!r || !Number.isSafeInteger(r.n) || typeof r.owner !== 'string') return null;
  const site = r.site ?? null;
  const dfLocation = ketchShipLocation({ n: r.n, owner: r.owner, regionIndex: site?.regionIndex ?? 17, regionName: site?.regionName || 'Daggerfall', climate: site?.climate ?? undefined });
  if (!dfLocation.ketch) return null;
  return { dfLocation, blocksFile: ketchShipBlocks(blocks), ketch: dfLocation.ketch, climateBase: site?.climateBase ?? 2, season: site?.season ?? 0, group: dfLocation.ketch.key, door: null, dfBlock: null, recordIndex: -1 };
}
/** The ground's place and size (re-said for the frame's far plane). */
export const KT_FAR_M = Math.hypot(KT_GROUND.half, -KT_GROUND.y);
/** The cage's walls' height (the lift's prompt stands inside them). */
export const KT_CAGE_H = KT_CAGE.h;
