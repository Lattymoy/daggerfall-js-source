// THE ABYSS LAB (SD-LAB, 2026-10-08, Mac: "I want to do a detailed pass on all the visuals for the inside of the Rift,
// the portal that leads to the rift, mechanics, etc"). The Shattered Hour and the Rift drawn by the game's own renderer
// and the Hour's own parts, with no game data - everything the Hour is, is made in code (world/sdRealm.js and its art,
// render/sdSky.js, render/sdMotes.js, scenes/sdHall.js, scenes/sdSteps.js, scenes/sdRemnant.js, scenes/sdEnd.js). The
// frame is the dungeon arm's for the realm (scenes/worldModes.js: the realm's trilight and key, its haze, its lamps,
// the islands, the dynamic draws, the sky after the solid geometry, the flats, the motes) in the same calls, so what
// this page shows is what a player in the Hour sees - and the Hollow scene stands the Rift and the Return in a made
// stone room, lit as a dungeon is, because the Hollow's own blocks are the player's ARENA2.
//
//   ?view=threshold|back|orrery|steps|arena|overview|sky|hollow   a camera (the panel's list)
//   ?t=<seconds>     the Hour's anchored clock, pinned          ?still   the clock stopped
//   ?lane=off        the classic set (no enhanced lighting)      ?nopanel the panel hidden (probes)
//   ?x=&y=&z=&yaw=&pitch=   an exact eye (the dungeon's frame, metres; degrees)
//   ?rx=&ry=&rz=     an exact eye in the realm's frame
//   ?fight=fell&age=<s> (the way home assembling) | held (the hold's curtain) | stomp&st=<s since its landing> | pulse&pt=<s since its landing> | reset&rt=<s of 8> | end | break | live&ft=<share>   the fight's clock as
//                    the arena's floor and the sky read it (render/sdArenaGlow.js), from a made fight state
//   ?veil=in|back|home|cast&vp=closing|shut|opening&vs=<seconds into it>&vshut=<seconds it stood shut>&vx=&vy=  the
//                    Hour's veil over the frame (render/sdVeil.js), still at that moment; &reduce its reduced motion
//   ?plate           the Returns' hand-plates alight, as when the activation ray finds them (SD-LOOK S6)
//   SD-LOOK S9, the Steps: ?view=pendulums|beat|beat-far|gust|crumble   their cameras; ?beat=<s into the first Beat
//                    plate's 3.6 s cycle> (the clock put there - the next plate half a beat on); ?crumble=<s since a foot>
//                    (every Crumble pin touched that long ago: 0-0.7 its crack stages, 0.7-5.1 its chunks falling, 5.1-5.7
//                    flying back); ?span=0|1|2 (the waystone my cast-back would take me to); ?rewind=<s since>&on=0|1|2
//                    (the cast-back's gold rewind burst on that checkpoint, scenes/sdFx.js); ?grey the frame in grey (a screenshot's);
//                    ?touch=on the phone's tier (two chunks a Crumble pin, toothless pendulum gears - ui/touchDevice.js)
// `window.__frame` counts drawn frames (the probes frame-sync on it - bible/Home.md's Process); `window.__lab` moves the
// camera and the clock from a probe.
import { Renderer, WORLD_FRAME, INTERIOR_CLEAR } from '../render/renderer.js';
import { EL_LANE, dungeonFog, dungeonTrilight, dungeonAmbient, exposureFor } from '../render/enhancedLighting.js';
import { applyFog, DUNGEON_FOG } from '../render/underwaterFog.js';
import { skyGain } from '../render/deadlands.js';
import { SdSkyRenderer, SD_SKY_STEPS, SD_SKY_MODE } from '../render/sdSky.js';
import { SdMotesRenderer } from '../render/sdMotes.js';
import { SD_HOUR_GRADE } from '../world/sdLook.js';
import { SdVeilRenderer, SD_VEIL_MODE } from '../render/sdVeil.js';
import { SdArenaGlowRenderer, sdArenaGlowAt, sdHourClockOf } from '../render/sdArenaGlow.js';
import { SdStompWallRenderer, sdStompWalls, sdStompWallRecords, SD_HOLD_WALL, sdHomeBeacon } from '../render/sdStompWall.js';
import { SD_BLOWS } from '../net/sdRemnant.js';
import { veilAt, VEIL_OPEN_S } from '../render/gateVeil.js';
import { buildRealmModel, realmLighting, realmLightsWith, packRealmFaces, SD_REALM_ARCHIVE, SD_REALM_FOG, SD_WAY_BACK_Z, SD_WAY_BACK_SIZE, SD_ARRIVE_Z } from '../world/sdRealm.js';
import { realmArt } from '../world/sdRealmArt.js';
import { faces } from '../world/gateModel.js';
import { createSdHall } from '../scenes/sdHall.js';
import { createSdSteps } from '../scenes/sdSteps.js';
import { createSdFx } from '../scenes/sdFx.js';
import { SD_STEPS_COURSE, SD_BEAT_CYCLE } from '../world/sdSteps.js';
import { createSdRemnant } from '../scenes/sdRemnant.js';
import { createSdEnd, SD_RETURN_KEY } from '../scenes/sdEnd.js';
import { sdRiftFace, SD_RIFT_OPEN_LOOK, SD_RIFT_NOT_YET, SD_RIFT_CLOSED, SD_RIFT_REFUSED } from '../world/sdDungeon.js';
import { SdRiftRenderer } from '../render/sdRiftPass.js';
import { SdHaloRenderer, SD_HALO_GAIN } from '../render/sdHalo.js';
import { realmToDungeon, SD_ORRERY, SD_ARENA } from '../net/sdBrain.js';
import { sdMarksOf, SD_ENDINGS } from '../net/sdMarks.js';
import { DUNGEON_AMBIENT } from '../world/dungeonLights.js';
import { INTERIOR_LIGHT_DIR } from '../world/interiorLights.js';
import { perspective, lookAt, identity, mirrorProjectionX } from '../world/mat4.js';

const params = new URLSearchParams(location.search);
const canvas = document.getElementById('c');
const $ = (id) => document.getElementById(id);
if (params.has('nopanel')) $('panel').style.display = 'none';
if (params.has('grey')) canvas.style.filter = 'grayscale(1)';   // SD-LOOK: the grayscale check - every meaning carried by shape, place and motion, never by hue alone
canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true });   // the probe reads pixels after the frame; the renderer's own getContext returns this one
const renderer = new Renderer(canvas);
const gl = renderer.gl;

/** The cameras, in the realm's frame (x across, y up, z along the Hour; yaw 0 faces +z, degrees) - or `hollow`, the
 *  made room's. */
const VIEWS = {
  threshold: { at: [0, 1.7, SD_ARRIVE_Z], yaw: 0, pitch: -4 },
  back: { at: [0, 1.7, SD_ARRIVE_Z], yaw: 180, pitch: 2 },
  orrery: { at: [-12, 3.2, SD_ORRERY.z - 14], yaw: 40, pitch: -12 },
  steps: { at: [0, 2.2, SD_ORRERY.z + SD_ORRERY.r - 2], yaw: 0, pitch: -6 },
  arena: { at: [0, 4.5, SD_ARENA.z - SD_ARENA.r + 3], yaw: 0, pitch: -6 },
  overview: { at: [70, 60, 60], yaw: -60, pitch: -28 },
  sky: { at: [0, 1.7, SD_ARRIVE_Z], yaw: 20, pitch: 45 },
  hollow: { at: [0, 1.7, -7.5], yaw: 0, pitch: 0, hollow: true },
  'hollow-side': { at: [-4.6, 1.7, 3.6], yaw: 50, pitch: 4, hollow: true },
  'hollow-ret': { at: [2.2, 1.7, 5.0], yaw: 20, pitch: 6, hollow: true },
  'hollow-close': { at: [0, 2.6, 2.6], yaw: 0, pitch: 8, hollow: true },
  // SD-LOOK S9: the Steps - the Drift's pendulums from beside A, a Beat plate close and from 30 m, the vane on C, the Crumble
  pendulums: { at: [-11, 9, 70], yaw: 28, pitch: 16 },
  beat: { at: [3.2, 4.2, 123.5], yaw: -14, pitch: -24 },
  'beat-far': { at: [0, 5.5, 102], yaw: 0, pitch: -7 },
  gust: { at: [-1.4, 6.3, 168.6], yaw: 30, pitch: 2 },
  crumble: { at: [3.4, 7.4, 173.5], yaw: -12, pitch: -22 },
};
const viewSel = $('view');
for (const k of Object.keys(VIEWS)) { const o = document.createElement('option'); o.value = o.textContent = k; viewSel.append(o); }
viewSel.value = VIEWS[params.get('view')] ? params.get('view') : 'threshold';
if (params.has('t')) $('t').value = params.get('t');
if (params.get('lane') === 'off') $('lane').checked = false;
if (params.has('still')) $('still').checked = true;

/** The Hour's anchored clock, as the lab pins or runs it - read by the stands below, so it is the page's first. */
let clock = Number($('t').value);
if (params.has('beat')) { clock = 10 * SD_BEAT_CYCLE + Number(params.get('beat')); $('t').value = String(clock); }   // SD-LOOK S9: a whole number of Beat cycles on
const cam = { pos: [0, 0, 0], yaw: 0, pitch: 0, hollow: false };
function setView(name) {
  const v = VIEWS[name] ?? VIEWS.threshold;
  cam.hollow = !!v.hollow;
  cam.pos = v.hollow ? [...v.at] : realmToDungeon(v.at[0], v.at[1], v.at[2]);
  cam.yaw = v.yaw * Math.PI / 180; cam.pitch = v.pitch * Math.PI / 180;
}
setView(viewSel.value);
if (params.has('x')) cam.pos = [Number(params.get('x')), Number(params.get('y') ?? 1.7), Number(params.get('z') ?? 0)];
if (params.has('rx')) cam.pos = realmToDungeon(Number(params.get('rx')), Number(params.get('ry') ?? 1.7), Number(params.get('rz') ?? 0));   // the realm's frame
if (params.has('yaw')) cam.yaw = Number(params.get('yaw')) * Math.PI / 180;
if (params.has('pitch')) cam.pitch = Number(params.get('pitch')) * Math.PI / 180;
viewSel.addEventListener('change', () => setView(viewSel.value));

// ── the lane: the game's one call, without reading a page the lab is not ─────────────────────────────────────────
let laneOn = null;
function syncLane() {
  const on = $('lane').checked;
  if (on === laneOn) return;
  laneOn = on;
  renderer.setLightingLane(on ? EL_LANE : null);
  if (on) { renderer.setExposure?.(exposureFor('')); renderer.setAir?.(true); }
}

// ── the Hour, stood as standSdRealm stands it ────────────────────────────────────────────────────────────────────
for (const [rec, art] of realmArt()) { renderer.uploadTexture(SD_REALM_ARCHIVE, rec, art.albedo); renderer.uploadEmissionTexture?.(SD_REALM_ARCHIVE, rec, art.emission, { white: true }); }
const realmMesh = renderer.createMesh(buildRealmModel());
const dynamicDraws = [];
const LAB_SLOT = Number(params.get('slot') ?? 1);
const hall = createSdHall({ renderer, s: LAB_SLOT });
hall.stand({ dynamicDraws, collider: null });
const steps = createSdSteps({ renderer, ending: sdMarksOf(LAB_SLOT)[0] });   // SD-LOOK S9: the Hollow's Ending on the vane
steps.stand({ dynamicDraws, collider: null });
/** SD-LOOK S9: the Steps' knobs - every Crumble pin touched ?crumble= ago, the waystone ?span= lit, the rewind on ?on=. */
const CRUMBLES = SD_STEPS_COURSE.filter((s) => s.kind === 'crumble').map((s) => s.i);
const labFx = createSdFx({ link: { state: () => null, now: () => clock * 1000 } });
if (params.has('rewind')) labFx.rewind(Number(params.get('on') ?? 1), (clock - Number(params.get('rewind'))) * 1000);
const remnant = createSdRemnant({ renderer, link: () => null, ending: sdMarksOf(LAB_SLOT)[0] });
remnant.stand({ dynamicDraws });
const arenaGlow = new SdArenaGlowRenderer(gl);
const stompWall = new SdStompWallRenderer(gl), _walls = sdStompWallRecords(), HELD = [SD_HOLD_WALL];
const ARENA_MODEL = (() => { const m = identity(), c = realmToDungeon(SD_ARENA.x, 0, SD_ARENA.z); m[12] = c[0]; m[13] = c[1]; m[14] = c[2]; return m; })();
const wayBack = createSdEnd({ renderer, riftTo: 'To the Abyss Dungeon', clock: () => clock, now: () => clock * 1000 });   // the lab's clock: a still frame holds the way home's rise
wayBack.stand({ rift: { at: realmToDungeon(0, 0, SD_WAY_BACK_Z), size: SD_WAY_BACK_SIZE }, retAt: null, dynamicDraws, hollow: !params.has('nohollow') });
// ?fight=fell&age=<s since it began to rise>: the way home assembling where the Remnant fell (scenes/sdEnd.js standReturn)
if (params.get('fight') === 'fell') wayBack.standReturn(realmToDungeon(SD_ARENA.x, 0, SD_ARENA.z - 8), Number(params.get('age') ?? 3) * 1000, { dynamicDraws });
const sky = new SdSkyRenderer(gl);
const motes = new SdMotesRenderer(gl);

// ── the Hollow's end, in a made room: a dungeon hall of Daggerfall's brown block stone (made here - the Hollow's own
//    blocks are the player's ARENA2), the Rift at its far end and the Return beside it ──────────────────────────────
const LAB_ARCHIVE = 38990, WALL = 0, FLOOR = 1;
/** A 64-texel block stone in Daggerfall's dungeon browns: courses of blocks, dark mortar, a grain of noise. */
function stoneArt(seed, { course = 16, block = 24, base = [104, 84, 62], mortar = [40, 32, 25] } = {}) {
  const N = 64, out = new Uint8ClampedArray(N * N * 4);
  let r = seed >>> 0;
  const rnd = () => { r = (r * 1664525 + 1013904223) >>> 0; return r / 4294967296; };
  const shade = new Float32Array(64);
  for (let i = 0; i < 64; i++) shade[i] = 0.8 + 0.35 * rnd();
  for (let y = 0; y < N; y++) {
    const row = Math.floor(y / course), off = (row & 1) * (block / 2);
    for (let x = 0; x < N; x++) {
      const col = Math.floor((x + off) / block), bx = (x + off) % block, by = y % course;
      const edge = bx === 0 || by === 0;
      const k = shade[(row * 7 + col * 3) & 63] * (0.88 + 0.24 * rnd()) * (bx === 1 || by === 1 ? 1.12 : 1) * (bx === block - 1 || by === course - 1 ? 0.8 : 1);
      const c = edge ? mortar : base;
      const o = (y * N + x) * 4;
      out[o] = c[0] * (edge ? 1 : k); out[o + 1] = c[1] * (edge ? 1 : k); out[o + 2] = c[2] * (edge ? 1 : k); out[o + 3] = 255;
    }
  }
  return { width: N, height: N, colors: out };
}
renderer.uploadTexture(LAB_ARCHIVE, WALL, stoneArt(7));
renderer.uploadTexture(LAB_ARCHIVE, FLOOR, stoneArt(11, { course: 32, block: 32, base: [88, 76, 62], mortar: [34, 29, 24] }));
const ROOM = { halfW: 6, len: 22, h: 7.5 };
function buildRoom() {
  const f = faces();
  const { halfW: w, len: L, h } = ROOM;
  const z0 = -L / 2, z1 = L / 2;
  const both = (rec, a, b, c, d, s, t) => { f.quad(rec, a, b, c, d, [0, 0], [0, t], [s, t], [s, 0]); f.quad(rec, d, c, b, a, [s, 0], [s, t], [0, t], [0, 0]); };
  both(FLOOR, [-w, 0, z0], [-w, 0, z1], [w, 0, z1], [w, 0, z0], 4, 7);
  both(WALL, [-w, h, z0], [w, h, z0], [w, h, z1], [-w, h, z1], 4, 7);
  both(WALL, [-w, 0, z0], [-w, h, z0], [-w, h, z1], [-w, 0, z1], 2.5, 7);
  both(WALL, [w, 0, z1], [w, h, z1], [w, h, z0], [w, 0, z0], 2.5, 7);
  both(WALL, [-w, 0, z1], [-w, h, z1], [w, h, z1], [w, 0, z1], 4, 2.5);
  both(WALL, [w, 0, z0], [w, h, z0], [-w, h, z0], [-w, 0, z0], 4, 2.5);
  const m = packRealmFaces(f);
  for (const sm of m.subMeshes) sm.textureArchive = LAB_ARCHIVE;
  return m;
}
const roomMesh = renderer.createMesh(buildRoom());
const RIFT_AT = [0, 0, ROOM.len / 2 - 3.2];
/** The made room as the collider answers it: its floor at 0, its walls and ceiling a box. */
const roomProbe = {
  floor: () => 0,
  ray: (o, d, max) => {
    let t = Infinity;
    const planes = [[0, -ROOM.halfW], [0, ROOM.halfW], [2, -ROOM.len / 2], [2, ROOM.len / 2], [1, 0], [1, ROOM.h]];
    for (const [ax, at] of planes) { if (Math.abs(d[ax]) < 1e-9) continue; const k = (at - o[ax]) / d[ax]; if (k > 1e-6) t = Math.min(t, k); }
    return t <= max ? t : null;
  },
};
/** SD-LOOK: the Rift's state from the query - ?rift=open|notyet|collapse|closed|refused, &left=<share of the collapse> */
const RIFT_LOOKS = { open: SD_RIFT_OPEN_LOOK, notyet: SD_RIFT_NOT_YET, closed: SD_RIFT_CLOSED, refused: SD_RIFT_REFUSED };
function labRiftLook() {
  const st = params.get('rift') ?? 'open';
  if (st === 'collapse') { const left = Number(params.get('left') ?? 0.5), lit = Math.ceil(left * 24); return { state: 'collapse', aperture: params.has('newcomer') ? 0 : 1 / 3 + (2 / 3) * left, tickHz: 2, studs: lit, ember: 24 - lit, tone: params.has('newcomer') ? 'ember' : 'gold', light: 0.5 + 0.5 * left }; }
  return RIFT_LOOKS[st] ?? SD_RIFT_OPEN_LOOK;
}
const RIFT_SIZE = Number(params.get('riftSize') ?? 7);
const hollowDraws = [];
const hollowEnd = createSdEnd({ renderer, riftCount: () => 'Fades in 1d 20h', look: labRiftLook, clock: () => clock });
hollowEnd.stand({ rift: { at: RIFT_AT, size: RIFT_SIZE, face: sdRiftFace(RIFT_AT, RIFT_SIZE, roomProbe) }, retAt: [3.4, 0, RIFT_AT[2] + 0.6], dynamicDraws: hollowDraws, probe: roomProbe });
const riftPass = new SdRiftRenderer(gl);
const halo = new SdHaloRenderer(gl);
const TORCHES = [[-ROOM.halfW + 0.4, 3, -4], [ROOM.halfW - 0.4, 3, -4], [-ROOM.halfW + 0.4, 3, 4], [ROOM.halfW - 0.4, 3, 4]];

/** The dungeon arm's draw options (render/renderer.js drawMesh), made once. */
const NO_SHADOW = Object.freeze({ noShadow: true }), WITH_SHADOW = Object.freeze({ noShadow: false });
/** The sky's look: the pixel law's steps on this lane, the Hollow's own Ending and its light. */
const skyLook = (lane) => { const i = SD_ENDINGS.findIndex((E) => E.id === sdMarksOf(LAB_SLOT)[0]); return { steps: lane ? SD_SKY_STEPS.lane : SD_SKY_STEPS.classic, ending: SD_ENDINGS[i]?.light ?? null, endingIdx: i }; };
/** SD-LOOK: the sky's word for the fight, from the query - ?fight=reset&rt=<s of 8> | break | end | live&ft=<share>
 *  [&last] | ?collapse=<s of 180> - as the host hands it from the fight's own clocks. */
const _labClock = new Float32Array(4);
/** SD-LOOK S7: a made fight state for ?fight= - the page's own shape (net/sdFightLink.js state()), its clocks in ms. */
function labFight() {
  const f = params.get('fight'), t = clock * 1000, op = t - 300_000, ends = op + 900_000;
  if (!f) return null;
  const s = { fi: 1, op, ends, ph: 1, rem: { atk: null }, ec: [], clk: null, su: -Infinity, fell: null, lost: null };
  if (f === 'stomp') s.rem.atk = { a: SD_BLOWS.stomp.id, at: t - Number(params.get('st') ?? 0.3) * 1000, x: 0, z: 0, i: 6 };
  else if (f === 'pulse') s.clk = { a: SD_BLOWS.pulse.id, at: t - Number(params.get('pt') ?? 0.2) * 1000, i: 7 };
  else if (f === 'reset') s.rem.atk = { a: SD_BLOWS.reset.id, at: t - Number(params.get('rt') ?? 4) * 1000 + SD_BLOWS.reset.windup, i: 8 };
  else if (f === 'end') s.clk = { a: SD_BLOWS.end.id, at: t + 1000, i: 9 };
  else if (f === 'break') s.ec = [{ h: 100 }, { h: 100 }];
  else if (f === 'live') { s.op = t - Number(params.get('ft') ?? 0.4) * 900_000; s.ends = s.op + 900_000; }
  return s;
}
const _glowMemo = { flood: -1, floodK: 0, reset: -1, end: 0, pulseAt: -Infinity };
function labClock() {
  const f = params.get('fight'), c = params.get('collapse');
  _labClock.fill(0);
  if (f && c == null) return sdHourClockOf(labFight(), clock * 1000, _labClock);
  if (c != null) { _labClock[0] = SD_SKY_MODE.collapse; _labClock[1] = Math.min(1, Number(c) / 180); _labClock[3] = 12 - Math.floor(Number(c) / 15); }
  else if (f === 'reset') { _labClock[0] = SD_SKY_MODE.reset; _labClock[1] = Math.min(1, Number(params.get('rt') ?? 4) / 8); }
  else if (f === 'break') _labClock[0] = SD_SKY_MODE.break;
  else if (f === 'end') _labClock[0] = SD_SKY_MODE.end;
  else if (f === 'live') { _labClock[0] = SD_SKY_MODE.fight; _labClock[1] = Number(params.get('ft') ?? 0.4); _labClock[2] = params.has('last') ? 1 : 0; }
  return _labClock;
}

// ── the frame ────────────────────────────────────────────────────────────────────────────────────────────────────
const EMPTY_LIT = { data: new Float32Array(0), colors: new Float32Array(0), carried: new Uint8Array(0) };
const NO_LIGHTS = Object.freeze([]);
const UP_Y = new Float32Array([0, 1, 0]);
const _equator = new Float32Array(3);
const fogNow = { mode: 'exp', density: 0, range: 0, color: [0, 0, 0], camPos: [0, 0, 0] };
const courtFogNow = () => { fogNow.mode = renderer._fogMode; fogNow.density = renderer._fogDensity; fogNow.range = renderer._fogRange; fogNow.color = renderer._fogColor; fogNow.camPos = renderer._camPos; return fogNow; };
const keys = new Set();
addEventListener('keydown', (e) => keys.add(e.code));
addEventListener('keyup', (e) => keys.delete(e.code));
let drag = null;
canvas.addEventListener('pointerdown', (e) => { drag = [e.clientX, e.clientY]; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  cam.yaw -= (e.clientX - drag[0]) * 0.005; cam.pitch = Math.max(-1.5, Math.min(1.5, cam.pitch - (e.clientY - drag[1]) * 0.005));
  drag = [e.clientX, e.clientY];
});
canvas.addEventListener('pointerup', () => { drag = null; });

let last = performance.now();
window.__frame = 0;
/** The lab's parts, for a probe's questions. */
window.__labParts = { renderer, sky, riftPass, halo, hollowEnd, wayBack };
window.__lab = {
  view: (name) => { viewSel.value = name; setView(name); },
  eye: (x, y, z, yawDeg, pitchDeg) => { cam.pos = [x, y, z]; cam.yaw = yawDeg * Math.PI / 180; cam.pitch = pitchDeg * Math.PI / 180; },
  clock: (s) => { clock = s; $('t').value = String(s); },
};
$('t').addEventListener('input', () => { clock = Number($('t').value); });

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (!$('still').checked && !params.has('t')) { clock += dt; if (clock > 600) clock -= 600; $('t').value = String(clock); }
  $('tV').textContent = clock.toFixed(1);
  syncLane();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.floor(canvas.clientWidth * dpr), h = Math.floor(canvas.clientHeight * dpr);
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  // the free camera
  const fwd = [Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch)];
  const right = [Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)];
  const sp = (keys.has('ShiftLeft') || keys.has('ShiftRight') ? 24 : 6) * dt;
  const mv = (v, s) => { cam.pos[0] += v[0] * s; cam.pos[1] += v[1] * s; cam.pos[2] += v[2] * s; };
  if (keys.has('KeyW')) mv(fwd, sp); if (keys.has('KeyS')) mv(fwd, -sp);
  if (keys.has('KeyD')) mv(right, -sp); if (keys.has('KeyA')) mv(right, sp);   // HANDEDNESS: screen-right is (cos, 0, -sin) under the mirrored projection
  if (keys.has('KeyE')) cam.pos[1] += sp; if (keys.has('KeyQ')) cam.pos[1] -= sp;
  const view = lookAt(cam.pos, [cam.pos[0] + fwd[0], cam.pos[1] + fwd[1], cam.pos[2] + fwd[2]], [0, 1, 0]);
  const proj = mirrorProjectionX(perspective(65 * Math.PI / 180, w / h, 0.1, 2000));
  const camRight = new Float32Array([-view[0], -view[4], -view[8]]);
  const lane = !!renderer.lightingLane;

  if (cam.hollow) {
    // a dungeon's light and air (the dungeon arm's own: the ambient scaled to the lane, the dungeon fog, four torches)
    renderer.setMoonlight(null);
    renderer.setLighting(new Float32Array(dungeonAmbient(lane, DUNGEON_AMBIENT)), 0);
    applyFog(renderer, dungeonFog(lane, DUNGEON_FOG));
    // a Hollow has no fires (the Hour is cold): the Rift's light alone - ?torches stands the made room's four
    if (params.has('plate')) hollowEnd.hoverName(SD_RETURN_KEY);
    hollowEnd.frame(null, cam.pos);
    const lit = [...(params.has('torches') ? TORCHES.map((t) => ({ x: t[0], y: t[1], z: t[2], range: 9, color: [1, 0.72, 0.42] })) : []), ...hollowEnd.lights()];
    const data = new Float32Array(Math.max(1, lit.length) * 4), colors = new Float32Array(Math.max(1, lit.length) * 3);
    lit.forEach((l, i) => { data.set([l.x, l.y, l.z, l.range], i * 4); colors.set(l.color, i * 3); });
    renderer.setPointLights(data.subarray(0, lit.length * 4), null, colors.subarray(0, lit.length * 3));
    renderer.setClearColor(INTERIOR_CLEAR);
    renderer.beginFrame(proj, view, INTERIOR_LIGHT_DIR, WORLD_FRAME);
    renderer.drawMesh(roomMesh, identity(), null);
    for (const d of hollowDraws) if (!d.hidden) renderer.drawMesh(d.gpu, d.object.matrix, d.texRemap ?? null, d.noShadow ? NO_SHADOW : WITH_SHADOW);
    const vp = renderer.worldViewportPx ?? [0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight];
    sky.paint(clock, { color: SD_REALM_FOG.color }, skyLook(lane), vp);
    const look = hollowEnd.look(cam.pos, { map: sky.map.texture, seconds: clock, gain: 1, clock: labClock() }, Number(params.get('hour') ?? 12));
    if (look && riftPass.draw(proj, view, look, courtFogNow(), lane ? SD_SKY_STEPS.lane : SD_SKY_STEPS.classic)) renderer.markForeignPass();
    if (halo.draw(proj, view, hollowEnd.halos(), courtFogNow(), lane ? SD_HALO_GAIN.lane : SD_HALO_GAIN.classic)) renderer.markForeignPass();
  } else {
    // the Hour, as the dungeon arm draws the realm
    const rl = realmLighting(), rt = dungeonTrilight(lane, rl.tri);
    _equator.set(rt.equator);
    renderer.setLighting(_equator, 0, undefined, rt);
    renderer.setMoonlight(rl.key);
    applyFog(renderer, dungeonFog(lane, SD_REALM_FOG));
    if (!params.has('nograde')) renderer.setSceneGrade(SD_HOUR_GRADE);   // SD-LOOK: the dungeon arm's own (?nograde: the lane's defaults, for a before)
    const hour = realmLightsWith(EMPTY_LIT, remnant.lights(), cam.pos);   // SD-LOOK: its heart's light first
    renderer.setPointLights(hour.data, null, hour.colors);
    renderer.setClearColor(INTERIOR_CLEAR);
    hall.frame(dt, null, null);
    if (params.has('crumble')) for (const i of CRUMBLES) steps.touch(i, clock - Number(params.get('crumble')));
    if (params.has('span')) steps.standOn(Number(params.get('span')));
    steps.ride(clock, dt, null, true);
    remnant.frame(dt, null);
    if (params.has('plate')) wayBack.hoverName(SD_RETURN_KEY);
    wayBack.frame(null);
    renderer.beginFrame(proj, view, INTERIOR_LIGHT_DIR, WORLD_FRAME);
    renderer.drawMesh(realmMesh, identity(), null);
    for (const d of dynamicDraws) if (!d.hidden && !d.culled) renderer.drawMesh(d.gpu, d.object.matrix, d.texRemap ?? null, d.noShadow ? NO_SHADOW : WITH_SHADOW);
    sky.paint(clock, courtFogNow(), skyLook(lane), renderer.worldViewportPx ?? [0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight]);
    if (sky.draw(proj, view, clock, courtFogNow(), skyGain(renderer._fogColor, SD_REALM_FOG.color), labClock())) renderer.markForeignPass();
    const look = wayBack.look(cam.pos, { map: sky.map.texture, seconds: clock, gain: skyGain(renderer._fogColor, SD_REALM_FOG.color), clock: labClock() });
    if (look && riftPass.draw(proj, view, look, courtFogNow(), lane ? SD_SKY_STEPS.lane : SD_SKY_STEPS.classic)) renderer.markForeignPass();
    if (halo.draw(proj, view, wayBack.halos(), courtFogNow(), lane ? SD_HALO_GAIN.lane : SD_HALO_GAIN.classic)) renderer.markForeignPass();
    if (arenaGlow.draw(proj, view, ARENA_MODEL, sdArenaGlowAt(labFight(), clock * 1000, _glowMemo), courtFogNow(), lane ? SD_SKY_STEPS.lane : SD_SKY_STEPS.classic)) renderer.markForeignPass();
    if (stompWall.draw(_walls, sdStompWalls(labFight(), clock * 1000, _walls), proj, view, courtFogNow())) renderer.markForeignPass();
    if (params.get('fight') === 'held' && stompWall.draw(HELD, 1, proj, view, courtFogNow())) renderer.markForeignPass();
    if (params.get('fight') === 'fell' && stompWall.draw([Object.assign(sdHomeBeacon((Number(params.get('age') ?? 3) - 1.5) * 1000, {}, 2.3 * 1.5), { x: 0, z: -8 })], 1, proj, view, courtFogNow())) renderer.markForeignPass();   // its beacon
    if (motes.draw(proj, view, clock, courtFogNow(), skyGain(renderer._fogColor, SD_REALM_FOG.color), renderer.worldViewportPx?.[3] ?? h)) renderer.markForeignPass();
    if (steps.drawPass(proj, view, courtFogNow())) renderer.markForeignPass();   // SD-LOOK S9: the Steps' ghosts, as the world host's Hour pass draws them
    if (labFx.draw(gl, proj, view, cam.pos, clock * 1000, courtFogNow(), renderer.worldViewportPx?.[3] ?? h)) renderer.markForeignPass();   // and the cast-back's rewind
  }
  renderer.resolveFrame();
  drawVeil();
  window.__frame++;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
// ?veil: the Hour's veil on a canvas of its own over the frame, a third of its pixels and drawn pixelated (ui/gateVeil.js)
let veilPass = null, veilCanvas = null;
function drawVeil() {
  const mode = SD_VEIL_MODE[params.get('veil') ?? ''];
  if (mode === undefined) return;
  if (!veilCanvas) {
    veilCanvas = document.createElement('canvas');
    veilCanvas.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;image-rendering:pixelated;';
    document.body.appendChild(veilCanvas);
    veilPass = new SdVeilRenderer(veilCanvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false }));
  }
  const w = Math.round(window.innerWidth / 3), h = Math.round(window.innerHeight / 3);
  if (veilCanvas.width !== w) veilCanvas.width = w;
  if (veilCanvas.height !== h) veilCanvas.height = h;
  const vp = params.get('vp') ?? 'shut', vs = Number(params.get('vs') ?? 1), shut = vp === 'shut' ? vs : vp === 'opening' ? Number(params.get('vshut') ?? 2) : 0;
  const opening = vp === 'opening' ? Math.min(1, vs / VEIL_OPEN_S) : 0;
  veilPass.draw(w, h, vs, veilAt(vp, vs), {
    mode, centre: [Number(params.get('vx') ?? 0), Number(params.get('vy') ?? 0)], shut, opening, reduce: params.has('reduce'),
    mend: mode === SD_VEIL_MODE.home ? Math.min(1, shut / 1.2) : 0, shatter: mode === SD_VEIL_MODE.cast ? opening : 0,
  });
}
