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
// `window.__frame` counts drawn frames (the probes frame-sync on it - bible/Home.md's Process); `window.__lab` moves the
// camera and the clock from a probe.
import { Renderer, WORLD_FRAME, INTERIOR_CLEAR } from '../render/renderer.js';
import { EL_LANE, dungeonFog, dungeonTrilight, dungeonAmbient, exposureFor } from '../render/enhancedLighting.js';
import { applyFog, DUNGEON_FOG } from '../render/underwaterFog.js';
import { skyGain } from '../render/deadlands.js';
import { SdSkyRenderer } from '../render/sdSky.js';
import { SdMotesRenderer } from '../render/sdMotes.js';
import { SD_HOUR_GRADE } from '../world/sdLook.js';
import { buildRealmModel, realmLighting, realmLightsWith, packRealmFaces, SD_REALM_ARCHIVE, SD_REALM_FOG, SD_WAY_BACK_Z, SD_WAY_BACK_SIZE, SD_ARRIVE_Z } from '../world/sdRealm.js';
import { realmArt } from '../world/sdRealmArt.js';
import { faces } from '../world/gateModel.js';
import { createSdHall } from '../scenes/sdHall.js';
import { createSdSteps } from '../scenes/sdSteps.js';
import { createSdRemnant } from '../scenes/sdRemnant.js';
import { createSdEnd } from '../scenes/sdEnd.js';
import { realmToDungeon, SD_ORRERY, SD_ARENA } from '../net/sdBrain.js';
import { sdMarksOf } from '../net/sdMarks.js';
import { DUNGEON_AMBIENT } from '../world/dungeonLights.js';
import { INTERIOR_LIGHT_DIR } from '../world/interiorLights.js';
import { perspective, lookAt, identity, mirrorProjectionX } from '../world/mat4.js';

const params = new URLSearchParams(location.search);
const canvas = document.getElementById('c');
const $ = (id) => document.getElementById(id);
if (params.has('nopanel')) $('panel').style.display = 'none';
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
};
const viewSel = $('view');
for (const k of Object.keys(VIEWS)) { const o = document.createElement('option'); o.value = o.textContent = k; viewSel.append(o); }
viewSel.value = VIEWS[params.get('view')] ? params.get('view') : 'threshold';
if (params.has('t')) $('t').value = params.get('t');
if (params.get('lane') === 'off') $('lane').checked = false;
if (params.has('still')) $('still').checked = true;

const cam = { pos: [0, 0, 0], yaw: 0, pitch: 0, hollow: false };
function setView(name) {
  const v = VIEWS[name] ?? VIEWS.threshold;
  cam.hollow = !!v.hollow;
  cam.pos = v.hollow ? [...v.at] : realmToDungeon(v.at[0], v.at[1], v.at[2]);
  cam.yaw = v.yaw * Math.PI / 180; cam.pitch = v.pitch * Math.PI / 180;
}
setView(viewSel.value);
if (params.has('x')) cam.pos = [Number(params.get('x')), Number(params.get('y') ?? 1.7), Number(params.get('z') ?? 0)];
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
const steps = createSdSteps({ renderer });
steps.stand({ dynamicDraws, collider: null });
const remnant = createSdRemnant({ renderer, link: () => null, ending: sdMarksOf(LAB_SLOT)[0] });
remnant.stand({ dynamicDraws });
const wayBack = createSdEnd({ renderer, riftTo: 'To the Abyss Dungeon' });
wayBack.stand({ rift: { at: realmToDungeon(0, 0, SD_WAY_BACK_Z), size: SD_WAY_BACK_SIZE }, retAt: null });
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
const hollowEnd = createSdEnd({ renderer, riftCount: () => 'Fades in 1d 20h' });
hollowEnd.stand({ rift: { at: RIFT_AT, size: 7 }, retAt: [3.4, 0, RIFT_AT[2] + 0.6] });
const TORCHES = [[-ROOM.halfW + 0.4, 3, -4], [ROOM.halfW - 0.4, 3, -4], [-ROOM.halfW + 0.4, 3, 4], [ROOM.halfW - 0.4, 3, 4]];

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

let last = performance.now(), clock = Number($('t').value);
window.__frame = 0;
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
    const data = new Float32Array(TORCHES.length * 4), colors = new Float32Array(TORCHES.length * 3);
    TORCHES.forEach((t, i) => { data.set([t[0], t[1], t[2], 9], i * 4); colors.set([1, 0.72, 0.42], i * 3); });
    renderer.setPointLights(data, null, colors);
    renderer.setClearColor(INTERIOR_CLEAR);
    renderer.beginFrame(proj, view, INTERIOR_LIGHT_DIR, WORLD_FRAME);
    renderer.drawMesh(roomMesh, identity(), null);
    hollowEnd.frame(null);
    renderer.drawBillboards(hollowEnd.batches(), camRight, UP_Y);
  } else {
    // the Hour, as the dungeon arm draws the realm
    const rl = realmLighting(), rt = dungeonTrilight(lane, rl.tri);
    _equator.set(rt.equator);
    renderer.setLighting(_equator, 0, undefined, rt);
    renderer.setMoonlight(rl.key);
    applyFog(renderer, dungeonFog(lane, SD_REALM_FOG));
    if (!params.has('nograde')) renderer.setSceneGrade(SD_HOUR_GRADE);   // SD-LOOK: the dungeon arm's own (?nograde: the lane's defaults, for a before)
    const hour = realmLightsWith(EMPTY_LIT, NO_LIGHTS, cam.pos);
    renderer.setPointLights(hour.data, null, hour.colors);
    renderer.setClearColor(INTERIOR_CLEAR);
    hall.frame(dt, null, null);
    steps.ride(clock, dt, null, true);
    remnant.frame(dt, null);
    wayBack.frame(null);
    renderer.beginFrame(proj, view, INTERIOR_LIGHT_DIR, WORLD_FRAME);
    renderer.drawMesh(realmMesh, identity(), null);
    for (const d of dynamicDraws) if (!d.hidden) renderer.drawMesh(d.gpu, d.object.matrix, null);
    if (sky.draw(proj, view, clock, courtFogNow(), skyGain(renderer._fogColor, SD_REALM_FOG.color))) renderer.markForeignPass();
    renderer.drawBillboards(wayBack.batches(), camRight, UP_Y);
    if (motes.draw(proj, view, clock, courtFogNow(), skyGain(renderer._fogColor, SD_REALM_FOG.color), renderer.worldViewportPx?.[3] ?? h)) renderer.markForeignPass();
  }
  renderer.resolveFrame();
  window.__frame++;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
