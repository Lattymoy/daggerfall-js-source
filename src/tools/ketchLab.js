// THE KETCH LAB (KETCH, 2026-10-24; bible/11-Multiplayer/Sky-Ketch.md section 3): the sky-ketch Mzunthar drawn by the game's
// own renderer from its own parts, with no game data - the ship, its parts, the Sailwalk's Steps and the land below are all
// made in code (world/ketch/ketchModel.js, world/ketch/ketchArt.js, scenes/superDungeon/sdSteps.js with the Ketch's course),
// lit, fogged and graded as the dungeon arm lights the Ketch (scenes/ketch/ketchDeckHost.js ketchFrameLook, ketchApplyLook -
// her hour and zone, the moons' key off this page's own sky), so what this page shows is what a crew sees.
//
//   ?view=<name>     a camera (the panel's list)            ?t=<seconds>   the shared clock, pinned   ?still
//   ?stage=0-5       the voyage's stage the parts stand for (the hatches, the lift, the cabin's door, the bosun's line)
//   ?cr ?br ?bk ?nd ?lo ?carry ?wv ?fight=   (KL3) the voyage's state, through the fake link (src/tools/ketchLabLink.js)
//   ?sec=<k,k>       the bridge's sections fallen            ?law           the colliders as wire
//   &secAt=<s>       (KL0) their moment on the shared clock: warned before it, falling, gone, risen 7 s after
//   ?hour=<0-24>     the hour the light is at               ?nopanel       the panel hidden (probes)
//   ?x=&y=&z=&yaw=&pitch=   an exact eye (the deck's frame, metres; degrees)
//   KETCH-LOOK KL0 (bible/11-Multiplayer/Sky-Ketch-Look.md section 17) - the lab's eyes, read off the query by
//   src/tools/ketchLabViews.js ketchLabKnobs:
//   ?grey            the frame in grey (every meaning carried by shape, place and motion, never by hue alone)
//   ?lite            the phone's tier (ui/touch/touchDevice.js isTouchDevice's answer, forced: the Steps' lite set)
//   ?bill            the frame's bill on screen and on window.__lab.bill(): GL draws, the ship's draws, its shadow
//                    casters and how many of them MOVED this frame (the shadow probe's - none may), lights, its CPU
//   ?sky=0           no sky (the world's sky stands over her by default, as the dungeon arm's host.drawSky draws it in
//                    the game - the procedural sky's, render/enhancedSky.js, at ?hour= and ?weather=)
//   ?eye=<k>         (KL1) the lane's eye adapting k times faster (where it settles the game's) - a probe's settled frame;
//                    window.__lab.hour(h) moves the hour without a load
//   ?arena2          (KL2) her art through the player's own ART_PAL (the dev server's ARENA2), not its fallback colours
//   ?warden          (KL2, the dev server's ARENA2) the Tonal Warden on the bridge, as the fight draws it: the Iron
//                    Atronach dyed Dwarven at upload (scenes/ketch/ketchFight.js ktWardenDye), at its presence
// `window.__frame` counts drawn frames; `window.__lab` moves the camera and the clock from a probe.
import { Renderer, WORLD_FRAME } from '../render/renderer.js';
import { EL_LANE, exposureFor } from '../render/enhancedLighting.js';
import { AIR_ADAPT_OPEN, AIR_ADAPT_CLOSE } from '../render/airPass.js';
import { createSdSteps } from '../scenes/superDungeon/sdSteps.js';
import { createKetchDeck, ketchFrameLook, ketchApplyLook, ketchHalosInto } from '../scenes/ketch/ketchDeckHost.js';
import { SdHaloRenderer, SD_HALO_GAIN } from '../render/superDungeon/sdHalo.js';
import { KtGaugeRenderer, KT_GAUGE_KIND, KT_GAUGE_FLOATS, ktGaugePut } from '../render/ketch/ktGaugePass.js';
import { KT_COURSE, KT_BRIDGE, deckToDungeon } from '../net/ketch/ketchDeck.js';
import { KT_GROUP } from '../world/ketch/ketchStates.js';
import { createKetchLabLink, KT_LAB_EPOCH } from './ketchLabLink.js';
import { KT_WARDEN_LOOK, ktWardenDye } from '../scenes/ketch/ketchFight.js';
import { TextureFile } from '../formats/textureFile.js';
import { DFPalette } from '../formats/dfPalette.js';
import { mobileBillboardSize } from '../world/rmbFlats.js';
import { perspective, lookAt, identity, mirrorProjectionX } from '../world/mat4.js';
import { lightList, packLight } from '../render/lightId.js';
import { EnhancedSkyRenderer, skyState, moonlightTerm } from '../render/enhancedSky.js';
import { KT_LAB_VIEWS, ketchLabKnobs } from './ketchLabViews.js';

const params = new URLSearchParams(location.search);
const canvas = document.getElementById('c');
const $ = (id) => document.getElementById(id);
if (params.has('nopanel')) $('panel').style.display = 'none';
const knobs = ketchLabKnobs(location.search);
if (knobs.grey) canvas.style.filter = 'grayscale(1)';
canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true });
const renderer = new Renderer(canvas);
const gl = renderer.gl;

/** The cameras (src/tools/ketchLabViews.js - pure, checked in node). */
const VIEWS = KT_LAB_VIEWS;
const viewSel = $('view');
for (const k of Object.keys(VIEWS)) { const o = document.createElement('option'); o.value = o.textContent = k; viewSel.append(o); }
viewSel.value = VIEWS[params.get('view')] ? params.get('view') : 'arrive';
if (params.has('t')) $('t').value = params.get('t');
if (params.get('lane') === 'off') $('lane').checked = false;
if (params.has('still')) $('still').checked = true;
let clock = Number($('t').value);
const cam = { pos: [0, 0, 0], yaw: 0, pitch: 0 };
function setView(name) {
  const v = VIEWS[name] ?? VIEWS.arrive;
  cam.pos = deckToDungeon(v.at[0], v.at[1], v.at[2]);
  cam.yaw = (v.yaw * Math.PI) / 180; cam.pitch = (v.pitch * Math.PI) / 180;
}
setView(viewSel.value);
if (params.has('x')) cam.pos = deckToDungeon(Number(params.get('x')), Number(params.get('y') ?? 1.7), Number(params.get('z') ?? 0));
if (params.has('yaw')) cam.yaw = (Number(params.get('yaw')) * Math.PI) / 180;
if (params.has('pitch')) cam.pitch = (Number(params.get('pitch')) * Math.PI) / 180;
viewSel.addEventListener('change', () => setView(viewSel.value));

let laneOn = null;
function syncLane() {
  const on = $('lane').checked;
  if (on === laneOn) return;
  laneOn = on;
  renderer.setLightingLane(on ? EL_LANE : null);
  if (on) { renderer.setExposure?.(exposureFor('')); renderer.setAir?.(true); }
  const air = renderer._air;   // KL1: ?eye - the eye's rates, its targets untouched
  if (air?.adaptRates) { air.adaptRates[0] = AIR_ADAPT_OPEN * knobs.eye; air.adaptRates[1] = AIR_ADAPT_CLOSE * knobs.eye; }
}

// ── the ship, stood as the deck host stands it ─────────────────────────────────────────────────────────────────
const dynamicDraws = [];
const deck = createKetchDeck({ renderer, palette: knobs.arena2 });   // KL2: ?arena2 - her art through the game's own palette
deck.stand({ dynamicDraws, collider: null });
const steps = createSdSteps({ renderer, course: KT_COURSE, lite: knobs.lite });
steps.stand({ dynamicDraws, collider: null });
// KETCH-LOOK KL3: THE FAKE LINK (src/tools/ketchLabLink.js) - the voyage as her room would say it, written by the knobs
// (?stage ?cr ?br ?bk ?nd ?lo ?carry ?wv ?fight= and its companions; KL0's ?sec&secAt and ?forks), on the relay's clock
const labNow = () => KT_LAB_EPOCH + clock * 1000;
const labLink = createKetchLabLink(location.search, labNow);
const labVoyage = () => labLink.state();
const lawMesh = params.has('law') ? (() => {
  const tris = deck.colliderTris(), n = tris.length / 3;
  return renderer.createMesh({ positions: tris, normals: new Float32Array(n * 3).map((_, i) => (i % 3 === 1 ? 1 : 0)), uvs: new Float32Array(n * 2), indices: Uint32Array.from({ length: n }, (_, i) => i), subMeshes: [{ textureArchive: 38311, textureRecord: 11, startIndex: 0, primitiveCount: n / 3 }] });
})() : null;

// ?warden (KL2): the Tonal Warden on the bridge, ahead of the helm - its first frame dyed as the fight dyes it, off the dev
// server's ARENA2 (never kept), its batch the fight's shape (feet at its origin, its presence's size)
let wardenBatch = null;
if (params.has('warden')) (async () => {
  try {
    const get = async (name) => { const r = await fetch(`/arena2/${name}`); if (!r.ok) throw new Error(`${name}: ${r.status}`); return new Uint8Array(await r.arrayBuffer()); };
    const pal = new DFPalette(); pal.load(await get('ART_PAL.COL'), 'ART_PAL.COL');
    const t = new TextureFile(); t.load(await get('TEXTURE.291'), 'TEXTURE.291', pal);
    renderer.uploadTexture(291, '0#0~kt', t.getColor32(ktWardenDye(t.getDFBitmap(0, 0)), 0));
    const sz = mobileBillboardSize(t, 0), k = KT_WARDEN_LOOK.scale;
    const b = renderer.createBillboardBatch(291, '0#0~kt', { w: sz.w * k, h: sz.h * k }, [[0, 0, 0]]);
    b.origin = deckToDungeon(KT_BRIDGE.x, KT_BRIDGE.y, KT_BRIDGE.z);
    wardenBatch = b;
  } catch (e) { console.warn('[lab] the Warden would not stand', e?.message ?? e); }
})();

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

let last = performance.now(), hour = knobs.hour;
window.__frame = 0;
window.__lab = {
  view: (name) => { viewSel.value = name; setView(name); },
  eye: (x, y, z, yawDeg, pitchDeg) => { cam.pos = deckToDungeon(x, y, z); cam.yaw = (yawDeg * Math.PI) / 180; cam.pitch = (pitchDeg * Math.PI) / 180; },
  clock: (s) => { clock = s; $('t').value = String(s); },
  hour: (h) => { hour = h; },
};
$('t').addEventListener('input', () => { clock = Number($('t').value); });
const NO_SHADOW = Object.freeze({ noShadow: true }), WITH_SHADOW = Object.freeze({ noShadow: false });
// the world's sky over her (the game's dungeon arm draws it after the opaque level: host.drawSky)
const sky = knobs.sky ? new EnhancedSkyRenderer(gl) : null;
// THE BILL (KETCH-LOOK KL0): what the frame cost, and whether any part that moved recorded a shadow
const bill = { gl: 0, draws: 0, casters: 0, moving: 0, lights: 0, cpuMs: 0, halos: 0 };   // gl: the ship's GL draws, one a submesh
const _was = new Map();
// KETCH-LOOK KL3: the classic set's halos, as the fight's late pass draws them on a ship (scenes/ketch/ketchFight.js drawPass)
let halo = null;
const _halos = [], _fog = { mode: 0, density: 0, range: null, camPos: null };
// ?gauges (KL3): a card of every gauge kind (rows) at five shares (columns, each its meaning in turn) before the eye
let gauge = null;
const _cardShares = [0, 0.25, 0.5, 0.75, 1], _card = new Float32Array(Object.keys(KT_GAUGE_KIND).length * _cardShares.length * KT_GAUGE_FLOATS);
const billBox = knobs.bill ? Object.assign(document.body.appendChild(document.createElement('pre')), { id: 'bill' }) : null;
if (billBox) Object.assign(billBox.style, { position: 'fixed', right: '10px', top: '10px', margin: '0', padding: '6px 8px', background: 'rgba(14,16,19,0.85)', color: '#e9e4d9', font: '12px monospace' });
let _movedSince = 0;   // the most moving casters any frame drew since the bill was last read (a probe steps the clock, then reads)
window.__lab.bill = () => { const b = { ...bill, moving: Math.max(bill.moving, _movedSince) }; _movedSince = 0; return b; };

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (!$('still').checked && !params.has('t')) { clock += dt; $('t').value = String(clock); }
  $('tV').textContent = clock.toFixed(1);
  syncLane();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.floor(canvas.clientWidth * dpr), h = Math.floor(canvas.clientHeight * dpr);
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  const fwd = [Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch)];
  const right = [Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)];
  const sp = (keys.has('ShiftLeft') || keys.has('ShiftRight') ? 30 : 7) * dt;
  const mv = (v, s) => { cam.pos[0] += v[0] * s; cam.pos[1] += v[1] * s; cam.pos[2] += v[2] * s; };
  if (keys.has('KeyW')) mv(fwd, sp); if (keys.has('KeyS')) mv(fwd, -sp);
  if (keys.has('KeyD')) mv(right, -sp); if (keys.has('KeyA')) mv(right, sp);
  if (keys.has('KeyE')) cam.pos[1] += sp; if (keys.has('KeyQ')) cam.pos[1] -= sp;
  const view = lookAt(cam.pos, [cam.pos[0] + fwd[0], cam.pos[1] + fwd[1], cam.pos[2] + fwd[2]], [0, 1, 0]);
  const proj = mirrorProjectionX(perspective((65 * Math.PI) / 180, w / h, 0.1, 4000));
  const lane = !!renderer.lightingLane;
  const minute = hour * 60;
  const skyNow = sky ? skyState({ minuteOfDay: minute, weather: knobs.weather, seconds: clock }) : null;
  const look = ketchFrameLook(cam.pos, minute, lane, skyNow ? moonlightTerm(skyNow) : null);
  ketchApplyLook(renderer, look);
  deck.lampGain(look.lamps, look.zone);
  const V = labVoyage();   // the room's word made and folded - the lab's, outside the ship's own CPU
  const cpu0 = performance.now();
  deck.pose(V, clock, labNow(), null, undefined, cam.pos);   // KETCH-LOOK KL3: the PVS read from the camera
  steps.ride(clock, dt, null, true, deck.sees(KT_GROUP.sailwalk));
  bill.cpuMs = performance.now() - cpu0;
  const lights = deck.lightsNear(cam.pos, renderer.maxPointLights ?? 16);
  const data = lightList(lights.length), colors = new Float32Array(Math.max(1, lights.length) * 3);
  lights.forEach((l, i) => { packLight(data, i, l); colors.set(l.color, i * 3); });
  renderer.setPointLights(data, null, colors.subarray(0, lights.length * 3));
  renderer.setClearColor(look.clear);
  renderer.beginFrame(proj, view, look.sunDir, WORLD_FRAME);
  bill.gl = 0; bill.draws = 0; bill.casters = 0; bill.moving = 0; bill.lights = lights.length;
  for (const d of dynamicDraws) {
    if (d.hidden || d.culled) continue;
    renderer.drawMesh(d.gpu, d.object.matrix, d.texRemap ?? null, d.noShadow ? NO_SHADOW : WITH_SHADOW);
    bill.draws++; bill.gl += d.gpu?.subMeshes?.length ?? 1;   // a GL draw a submesh (the colour pass's)
    // a caster MOVED when it cast in the frame before too and its matrix changed between them (a part that comes to rest
    // and casts from there - a section risen home - moved before it cast)
    const m = d.object.matrix, was = _was.get(d);
    if (!d.noShadow) { bill.casters++; if (was && was.cast && was.m.some((v, i) => v !== m[i])) bill.moving++; }
    if (was) { was.m.set(m); was.cast = !d.noShadow; } else _was.set(d, { m: Float32Array.from(m), cast: !d.noShadow });
  }
  _movedSince = Math.max(_movedSince, bill.moving);
  if (lawMesh) renderer.drawMeshWire(lawMesh, identity(), null);
  if (sky) {
    sky.setState(skyNow);
    sky.draw(cam.yaw, cam.pitch, (65 * Math.PI) / 180, w / h);
  }
  const camRight = new Float32Array([-view[0], -view[4], -view[8]]);
  renderer.drawBillboards(wardenBatch ? [...deck.billboards(cam.pos, clock), wardenBatch] : deck.billboards(cam.pos, clock), camRight, new Float32Array([0, 1, 0]));
  if (!lane) {
    halo ??= new SdHaloRenderer(renderer.gl);
    _fog.mode = renderer._fogMode; _fog.density = renderer._fogDensity; _fog.range = renderer._fogRange; _fog.camPos = renderer._camPos;
    if (halo.draw(proj, view, ketchHalosInto(_halos, deck.lightsNear(cam.pos, 24)), _fog, SD_HALO_GAIN.classic)) renderer.markForeignPass?.();
  }
  bill.halos = halo?.drawn ?? 0;
  if (knobs.gauges) {
    gauge ??= new KtGaugeRenderer(renderer.gl);
    const up = [view[1], view[5], view[9]], R = [camRight[0], camRight[1], camRight[2]], S = 0.3, H = 0.11;   // the screen's right (the mirrored X's) and up
    let n = 0;
    Object.values(KT_GAUGE_KIND).forEach((kind, row) => _cardShares.forEach((a, col) => {
      const ox = (col - 2) * S, oy = (2 - row) * S, at = [0, 1, 2].map((i) => cam.pos[i] + fwd[i] * 2.4 + R[i] * ox + up[i] * oy);
      n = ktGaugePut(_card, n, at, R.map((v) => v * H), up.map((v) => v * H), kind, col % 4, a, 5);
    }));
    _fog.mode = renderer._fogMode; _fog.density = renderer._fogDensity; _fog.range = renderer._fogRange; _fog.camPos = renderer._camPos; _fog.color = renderer._fogColor;
    if (gauge.draw(proj, view, _card, n, { lane, fog: _fog })) renderer.markForeignPass?.();
  }
  renderer.resolveFrame();
  if (billBox) billBox.textContent = `ship GL draws ${bill.gl}\nship meshes ${bill.draws}\ncasters ${bill.casters} (moving ${bill.moving})\nlights ${bill.lights}\nship CPU ${bill.cpuMs.toFixed(2)} ms`;
  window.__frame++;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
