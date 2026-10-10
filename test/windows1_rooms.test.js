// RW1 (2026-10-09, Mac: "The implementation of the real window overhaul, allowing players to see inside/outside of
// house windows"): THE ROOMS BEHIND THE GLASS - from the street, every exterior window (DFU's own table, its 0xff
// mask) shows a room behind it, painted from numbers (world/windowRoomArt.js), lit by the day dim and by the night
// warm, some rooms dark; the rooms are a FRAME's, asked by the two exterior hosts after their beginFrame, never by an
// interior, a dungeon or a panel. render/realWindows.js carries the law; this file pins it by execution wherever node
// can run it (the laws, the art, the renderer's uniform traffic over a recording GL), and by the shader's own text
// only where it cannot (GLSL compiles in a browser: tools/realWindowsProbe.mjs draws it).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Renderer } from '../src/render/renderer.js';
import { EL_MESH_FS } from '../src/render/enhancedLighting.js';
import { classicShadowLane } from '../src/render/classicShadowLane.js';
import { windowEmissionRGB, WINDOW_STYLES } from '../src/render/windowEmission.js';
import {
  winModeFor, WIN_MODE, GLASS_NONE, GLASS_EXTERIOR, GLASS_INTERIOR, roomLightFor, roomExit, roomDepth, ROOM_BOX,
  ROOM_DAY_SHARE, ROOM_LAMP_GAIN, ROOM_DEPTH_MIN, ROOM_DEPTH_MAX, ROOM_DEPTH_PER_WIDTH, realWindowsMode, realWindowsGlsl,
  RW_MAIN_DERIVS, RW_MAIN_CUTOUT, RW_MAIN_GLASS, RW_MAIN_ROOM,
} from '../src/render/realWindows.js';
import {
  ROOM_STYLES, ROOM_PIECES, ROOM_FABRICS, ROOM_LIT_SHARE, ROOM_CURTAIN_SHARE, roomStyleOf, roomPieceOf, roomFabricOf,
  roomLitAt, roomCurtained, roomColorTable, ROOM_COLOR_SLOTS,
} from '../src/world/windowRoomArt.js';
import { FEATURES } from '../src/systems/features.js';
import { GRAPHICS_PRESETS, PRESET_ROWS } from '../src/systems/graphicsPresets.js';
import { getPref, setPref } from '../src/systems/uiPrefs.js';
import { identity } from '../src/world/mat4.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');

/** A Renderer over a recording GL: every call logged, every uniform location named. */
function recordingRenderer(log) {
  let id = 0;
  const stub = new Proxy({}, {
    get: (o, k) => {
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation') return (p, name) => ({ name });
      if (k === 'getAttribLocation') return () => 0;
      if (typeof k === 'string' && k.startsWith('create')) return () => ({ id: ++id, kind: k });
      if (k === 'getParameter') return () => new Float32Array([0, 0, 0, 0]);
      if (k === 'drawingBufferWidth') return 640;
      if (k === 'drawingBufferHeight') return 400;
      if (typeof k === 'string' && k.toUpperCase() === k) return k;
      return (...args) => { log.push([k, ...args]); };
    },
  });
  const canvas = { getContext: () => stub, clientWidth: 640, clientHeight: 400, width: 640, height: 400 };
  const r = new Renderer(canvas);
  log.length = 0;
  return r;
}
const px = { width: 1, height: 1, colors: new Uint8ClampedArray([255, 255, 255, 255]) };
const uploads = (log, name) => log.filter((c) => (c[0] === 'uniform1f' || c[0] === 'uniform4f' || c[0] === 'uniform3fv' || c[0] === 'uniform4fv') && c[1]?.name === name).map((c) => c.slice(2));
const I = identity();

test('RW1 rooms R1: the window mode law - DFU\'s window is a room outdoors, cut to the street indoors, plain elsewhere; an interior\'s declared glass is never a room and never wears a style (mutants: a window cut outdoors, an interior glass as a room, the plain arm lost)', () => {
  assert.equal(winModeFor(GLASS_EXTERIOR, true, false), WIN_MODE.room, 'a street frame: the room behind it');
  assert.equal(winModeFor(GLASS_EXTERIOR, false, true), WIN_MODE.cut, 'an interior frame with the view out: cut');
  assert.equal(winModeFor(GLASS_EXTERIOR, false, false), WIN_MODE.plain, 'a dungeon, a panel, a map: the classic glass');
  assert.equal(winModeFor(GLASS_INTERIOR, true, false), WIN_MODE.glass, 'an interior\'s glass seen from a street frame: glass, never a room');
  assert.equal(winModeFor(GLASS_INTERIOR, false, false), WIN_MODE.glass, 'and never a window style');
  assert.equal(winModeFor(GLASS_INTERIOR, false, true), WIN_MODE.cut);
  assert.equal(winModeFor(GLASS_NONE, true, true), WIN_MODE.plain, 'no glass is plain whatever the frame asks');
  assert.deepEqual(WIN_MODE, { plain: 0, room: 1, glass: 2, cut: 3 }, 'the shader\'s own numbers (uWinMode)');
});

test('RW1 rooms R2: the room\'s light is the window style\'s own - the night style\'s amber lifted to a lamp, day, fog and custom are no night, Disabled draws no room, and the day light is the ambient\'s share (mutants: the night test inverted, the gain lost, the day share, Disabled lit)', () => {
  const amb = [0.9, 0.8, 0.7];
  const night = roomLightFor(windowEmissionRGB('night'), amb);
  assert.equal(night.on, true); assert.equal(night.night, 1);
  const e = windowEmissionRGB('night'), peak = Math.max(...e);
  night.lamp.forEach((v, i) => assert.ok(Math.abs(v - e[i] * ROOM_LAMP_GAIN / peak) < 1e-6, `the lamp is the night style's hue at the gain (${i})`));
  assert.ok(Math.abs(Math.max(...night.lamp) - ROOM_LAMP_GAIN) < 1e-6, 'its brightest channel is the gain');
  night.day.forEach((v, i) => assert.ok(Math.abs(v - amb[i] * ROOM_DAY_SHARE) < 1e-6, 'the day light: the ambient\'s share'));
  for (const style of ['day', 'fog', 'custom']) {
    const l = roomLightFor(windowEmissionRGB(style), amb);
    assert.equal(l.on, true, `${style} draws a room`);
    assert.equal(l.night, 0, `${style} is no night`);
    assert.deepEqual(l.lamp, [0, 0, 0], `${style} lights no lamp`);
  }
  assert.equal(roomLightFor(windowEmissionRGB('disabled'), amb).on, false, 'an interior\'s Disabled glass: no room');
  assert.deepEqual(Object.keys(WINDOW_STYLES).sort(), ['custom', 'day', 'disabled', 'fog', 'night'], 'every style the table has was asked');
});

test('RW1 rooms R3: the march out of the room - a ray leaves the box through the back wall, a side, the floor or the ceiling, on the face it names, and the room is as deep as its width says between its bounds (mutants: a box edge moved, the floor and ceiling swapped, the depth clamp lost)', () => {
  const o = [0.5, 0.5, 0];
  const head = roomExit(o, [0, 0, 0.5]);
  assert.equal(head.face, 'back'); assert.equal(head.t, 2); assert.deepEqual(head.h, [0.5, 0.5, 1]);
  const down = roomExit(o, [0, -2, 0.1]);
  assert.equal(down.face, 'floor'); assert.ok(Math.abs(down.h[1] - ROOM_BOX.y0) < 1e-9, 'on the floor\'s own plane');
  const up = roomExit(o, [0, 2, 0.1]);
  assert.equal(up.face, 'ceiling'); assert.ok(Math.abs(up.h[1] - ROOM_BOX.y1) < 1e-9);
  const right = roomExit(o, [3, 0, 0.1]);
  assert.equal(right.face, 'side'); assert.ok(Math.abs(right.h[0] - ROOM_BOX.x1) < 1e-9);
  const left = roomExit(o, [-3, 0, 0.1]);
  assert.equal(left.face, 'side'); assert.ok(Math.abs(left.h[0] - ROOM_BOX.x0) < 1e-9);
  assert.deepEqual(ROOM_BOX, { x0: -0.5, x1: 1.5, y0: -0.25, y1: 1.1 }, 'two tiles wide about its own, the floor under the tile\'s foot');
  // every exit lies inside the box, on one of its faces, whatever the direction
  for (let i = 0; i < 200; i++) {
    const a = (i * 2.399) % (2 * Math.PI), b = ((i * 0.618) % 1) * 1.4 - 0.7;
    const d = [Math.cos(a) * Math.cos(b) * 2, Math.sin(b) * 2, 0.05 + ((i * 0.37) % 1)];
    const x = roomExit([((i * 0.31) % 1), ((i * 0.53) % 1), 0], d);
    const onFace = Math.abs(x.h[2] - 1) < 1e-9 || Math.abs(x.h[0] - ROOM_BOX.x0) < 1e-9 || Math.abs(x.h[0] - ROOM_BOX.x1) < 1e-9 || Math.abs(x.h[1] - ROOM_BOX.y0) < 1e-9 || Math.abs(x.h[1] - ROOM_BOX.y1) < 1e-9;
    assert.ok(onFace && x.h[2] <= 1 + 1e-9 && x.h[0] >= ROOM_BOX.x0 - 1e-9 && x.h[0] <= ROOM_BOX.x1 + 1e-9, `ray ${i} leaves through a face`);
  }
  assert.equal(roomDepth(2), ROOM_DEPTH_PER_WIDTH * 2 * 2, 'a 2 m tile: a 4 m wide room, 3.6 m deep');
  assert.equal(roomDepth(0.2), ROOM_DEPTH_MIN, 'never a cupboard');
  assert.equal(roomDepth(40), ROOM_DEPTH_MAX, 'never a hall');
});

test('RW1 rooms R4: the rooms painted from numbers - every style eight byte colours, the seeds spread over every style, piece and cloth, the lit and curtained shares hold, and the shader\'s table is these very colours (mutants: a style lost from the spread, the lit share, the table drifting from the art)', () => {
  assert.equal(ROOM_COLOR_SLOTS.length, 8);
  for (const s of ROOM_STYLES) {
    assert.equal(s.colors.length, 8, `${s.name}: eight colours`);
    for (const c of s.colors) assert.ok(c.length === 3 && c.every((v) => Number.isInteger(v) && v >= 0 && v <= 255), `${s.name}: sRGB bytes`);
    assert.equal(s.pattern.length, 4);
  }
  assert.equal(new Set(ROOM_STYLES.map((s) => JSON.stringify(s.colors))).size, ROOM_STYLES.length, 'every room its own');
  const N = 20000, styles = new Array(ROOM_STYLES.length).fill(0), pieces = new Array(ROOM_PIECES.length).fill(0), fabs = new Array(ROOM_FABRICS.length).fill(0);
  let lit = 0, curt = 0;
  for (let i = 0; i < N; i++) {
    const s = (i + 0.5) / N;
    styles[roomStyleOf(s)]++; pieces[roomPieceOf(s)]++; fabs[roomFabricOf(s)]++;
    if (roomLitAt(s)) lit++; if (roomCurtained(s)) curt++;
  }
  for (const [name, h] of [['styles', styles], ['pieces', pieces], ['fabrics', fabs]]) {
    const want = N / h.length;
    h.forEach((n, k) => assert.ok(Math.abs(n - want) <= 1, `${name}[${k}] takes its share (${n} of ${want})`));
  }
  assert.equal(lit, Math.round(N * ROOM_LIT_SHARE)); assert.equal(curt, Math.round(N * ROOM_CURTAIN_SHARE));
  assert.ok(ROOM_LIT_SHARE > 0.4 && ROOM_LIT_SHARE < 0.9, 'some rooms dark, most lit');
  assert.equal(roomStyleOf(1), ROOM_STYLES.length - 1, 'a seed of one stays in the table');
  // the GLSL's RW_COL is the art's table, colour for colour
  const glsl = realWindowsGlsl('c');
  const m = /const vec3 RW_COL\[(\d+)\] = vec3\[\d+\]\((.*?)\);\n/.exec(glsl);
  assert.ok(m, 'the table is in the shader');
  const vals = [...m[2].matchAll(/vec3\(([\d.]+), ([\d.]+), ([\d.]+)\)/g)].map((v) => [Number(v[1]), Number(v[2]), Number(v[3])]);
  const want = roomColorTable();
  assert.equal(Number(m[1]), want.length); assert.equal(vals.length, want.length);
  vals.forEach((v, i) => v.forEach((c, k) => assert.ok(Math.abs(c * 255 - want[i][k]) < 0.01, `colour ${i}.${k}`)));
  assert.match(glsl, new RegExp(`const float RW_NSTYLES = ${ROOM_STYLES.length}\\.0;`));
  assert.match(glsl, /step\(s2, RW_LIT_SHARE\)/, 'the lit share the twin keeps');
  assert.match(glsl, /const float RW_LIT_SHARE = 0\.62;/, 'WAGONS2 (FINAL AUDIT): one constant, the bloom\'s replay reads it too');
});

test('RW1 rooms R5: the rooms are a frame\'s - an exterior frame that asks (after its beginFrame) draws its window sub-meshes as rooms, the next frame that does not draws the classic glass, a wall is never a room, and a panel bracket hands the world frame its rooms back (mutants: the frame not dropping them, \'off\' asking rooms, the panel losing them, the mode left on after the mesh)', () => {
  const log = [];
  const r = recordingRenderer(log);
  r.uploadTexture(9, 3, px, { opaque: true });
  r.uploadEmissionTexture(9, 3, px, { window: true });   // DFU's window mask (the pipeline's exterior arm)
  r.uploadTexture(9, 4, px, { opaque: true });            // a wall
  const mesh = { vao: {}, subMeshes: [{ textureArchive: 9, textureRecord: 3, primitiveCount: 2, startIndex: 0 }, { textureArchive: 9, textureRecord: 4, primitiveCount: 2, startIndex: 6 }] };
  r.setLighting(new Float32Array([0.25, 0.25, 0.3]), 0);
  r.setWindowEmission(windowEmissionRGB('night'));
  r.beginFrame(I, I, new Float32Array([0, 1, 0]));
  r.setWindowRooms('full');
  log.length = 0;
  r.drawMesh(mesh, I);
  assert.deepEqual(uploads(log, 'uWinMode'), [[1], [0]], 'the window a room, the wall plain - in draw order');
  const lamp = uploads(log, 'uRoomLamp');
  assert.equal(lamp.length, 1, 'the room\'s light, once');
  assert.equal(lamp[0][3], 1, 'the night');
  // a second draw in the same frame: nothing new to say but the modes
  log.length = 0; r.drawMesh(mesh, I);
  assert.equal(uploads(log, 'uRoomLamp').length, 0, 'the light already stands');
  // the next frame does not ask: the classic glass
  r.beginFrame(I, I, new Float32Array([0, 1, 0]));
  log.length = 0; r.drawMesh(mesh, I);
  assert.deepEqual(uploads(log, 'uWinMode'), [], 'no room asked, none drawn (the program already plain)');
  // 'off' asks none
  r.beginFrame(I, I, new Float32Array([0, 1, 0]));
  r.setWindowRooms('off');
  log.length = 0; r.drawMesh(mesh, I);
  assert.deepEqual(uploads(log, 'uWinMode'), [], 'the row off: the classic glass');
  // a window last in a mesh: the mode is put back after it, so no other draw on the program inherits it
  const lastWindow = { vao: {}, subMeshes: [{ textureArchive: 9, textureRecord: 4, primitiveCount: 2, startIndex: 0 }, { textureArchive: 9, textureRecord: 3, primitiveCount: 2, startIndex: 6 }] };
  r.beginFrame(I, I, new Float32Array([0, 1, 0]));
  r.setWindowRooms('rooms');
  log.length = 0; r.drawMesh(lastWindow, I);
  assert.deepEqual(uploads(log, 'uWinMode'), [[1], [0]], 'the room, then the program put back');
  // a panel bracket mid-frame keeps the world frame's rooms
  r.beginFrame(I, I, new Float32Array([0, 1, 0]));
  r.setWindowRooms('full');
  r.panelFrame({ proj: I, view: I, lightDir: new Float32Array([0, 1, 0]), rect: { x: 0, y: 0, w: 100, h: 100 } }, () => {
    log.length = 0; r.drawMesh(mesh, I);
    assert.deepEqual(uploads(log, 'uWinMode'), [], 'a panel (the automap, the bank\'s preview) draws no room');
  });
  log.length = 0; r.drawMesh(mesh, I);
  assert.deepEqual(uploads(log, 'uWinMode'), [[1], [0]], 'and the world frame has them back after it');
});

test('RW1 rooms R6: both mesh shaders carry the one block and its four lines where they must stand - the derivatives before any discard, the cutout after the picture, the glass between the emission and the albedo it is subtracted from, the room before the output (shader text - GLSL compiles in a browser, tools/realWindowsProbe.mjs) (mutants: a lane without the block, a line out of its place)', () => {
  const r = rd('src/render/renderer.js');
  const fs = r.slice(r.indexOf('const FS = `'), r.indexOf('const CHAR_VS = `'));
  const at = (s, k) => s.indexOf(k);
  assert.ok(at(fs, '${realWindowsGlsl(\'c\')}') > 0, 'the classic FS: the block, on the classic codec');
  const order = (src, label) => {
    const main = src.slice(src.indexOf('void main() {'));
    const iD = at(main, 'RW_MAIN_DERIVS'), iDisc = at(main, 'discard'), iTex = at(main, 'vec4 tex = texture(uTex, vUV);'), iCut = at(main, 'RW_MAIN_CUTOUT');
    const iEm = at(main, 'vec3 emission = '), iG = at(main, 'RW_MAIN_GLASS'), iAlb = at(main, 'vec3 albedo = '), iRoom = at(main, 'RW_MAIN_ROOM'), iOut = at(main, 'outColor = vec4(');
    assert.ok(iD > 0 && iD < iDisc, `${label}: the derivatives before the first discard`);
    assert.ok(iTex < iCut && iCut < at(main, 'vec3 n = normalize(vNormal);'), `${label}: the cutout right after the picture`);
    assert.ok(iEm < iG && iG < iAlb, `${label}: the glass between the emission and the albedo`);
    assert.ok(iRoom > iAlb && iRoom < iOut, `${label}: the room before the output`);
  };
  order(fs, 'classic');
  const el = rd('src/render/enhancedLighting.js');
  const elFs = el.slice(el.indexOf('export const EL_MESH_FS = `'), el.indexOf('export const EL_BB_FS = `'));
  assert.ok(elFs.includes('${realWindowsGlsl(\'elDecode(c)\')}'), 'the lane: the block on its own codec');
  order(elFs, 'lane');
  // the built text, both lanes and the classic-look shadow lane that derives from the lane's
  for (const [label, built] of [['lane', EL_MESH_FS], ['classic shadows', classicShadowLane().meshFs]]) {
    for (const line of [RW_MAIN_DERIVS, RW_MAIN_CUTOUT, RW_MAIN_GLASS, RW_MAIN_ROOM]) assert.ok(built.includes(line), `${label}: ${line.slice(0, 40)}`);
    assert.ok(built.includes('vec3 rwRoomOver('), `${label}: the room`);
  }
  // the lines themselves say the law
  assert.match(RW_MAIN_CUTOUT, /if \(uCutout > 0\.5 && tex\.a < 0\.5\) discard;/, 'a cut only under the cutout flag');
  assert.match(RW_MAIN_GLASS, /if \(uWinMode > 2\.5 && rwGlass > 0\.5 && rwInRect\(gl_FragCoord\.xy\)\) discard;/);
  assert.match(RW_MAIN_GLASS, /emission \*= step\(uWinMode, 1\.5\);/, 'an interior\'s glass wears no style');
  assert.match(RW_MAIN_ROOM, /if \(uWinMode > 0\.5 && uWinMode < 1\.5\) lit = rwRoomOver\(lit \+ emission, rwGlass, rwDp1, rwDp2, rwDuv1, rwDuv2\) - emission;/);
});

test('RW1 rooms R7: THE FOUR HOSTS - world.js and exterior.js ask for rooms after their exterior beginFrame and hand the modes their street; worldModes asks none (its interior is glass, its dungeon nothing); dungeonContext.js asks none; the pipeline marks DFU\'s windows as windows (mutants: a host unwired, a dungeon asking rooms, the window flag lost)', () => {
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const s = rd(host);
    const ask = s.indexOf('renderer.setWindowRooms(realWindowsMode());');
    const begin = s.indexOf('renderer.beginFrame(proj, view, sunDirection(minute), WORLD_FRAME);');
    assert.ok(ask > 0 && begin > 0 && ask > begin && ask - begin < 6000, `${host}: asked after its exterior beginFrame`);
    assert.equal(s.split('renderer.setWindowRooms(').length - 1, 1, `${host}: once`);
    assert.match(s, /\n {4}outsideView,   \/\/ RW1: the street through a building's glass/, `${host}: the modes are handed the street`);
  }
  assert.ok(!rd('src/scenes/worldModes.js').includes('setWindowRooms('), 'the modes ask no rooms - the interior is the glass, the dungeon nothing');
  assert.ok(!rd('src/scenes/dungeonContext.js').includes('setWindowRooms('), 'the dungeon host asks none');
  assert.match(rd('src/scenes/dataPipeline.js'), /renderer\.uploadEmissionTexture\(archive, record, t\.getWindowColors32\(bitmap\), \{ replacement, window: true \}\);/);
});

test('RW1 rooms R8: the switch - the classic skin is Daggerfall\'s glass, the kill door wins over the row, the row is read as stored, and the row stands at Full by default (mutants: the skin gate lost, the door ignored, the default not full)', () => {
  assert.equal(realWindowsMode('?skin=classic'), 'off', 'the classic skin: the classic glass');
  assert.equal(realWindowsMode('?skin=classic&windows=full'), 'off', 'not even by the door');
  assert.equal(realWindowsMode('?skin=enhanced&windows=rooms'), 'rooms');
  assert.equal(realWindowsMode('?skin=enhanced&windows=off'), 'off');
  assert.equal(getPref('realWindows'), 'full', 'the shelf\'s default');
  assert.equal(realWindowsMode('?skin=enhanced'), 'full');
  const was = getPref('realWindows');
  try {
    setPref('realWindows', 'rooms');
    assert.equal(realWindowsMode('?skin=enhanced'), 'rooms', 'the row as stored');
    assert.equal(realWindowsMode('?skin=enhanced&windows=full'), 'full', 'the door wins');
  } finally { setPref('realWindows', was); }
});

test('RW1 rooms R9: the Graphics row and the presets - the real windows row on the Graphics tab, its three tiers, High its default (how the game ships), Medium the rooms alone, Low the classic glass (mutants: a preset off its row, High off the default)', () => {
  const row = FEATURES.find((f) => f.id === 'real-windows');
  assert.ok(row, 'the row');
  assert.deepEqual(row.control.tiers.map(([v]) => v), ['full', 'rooms', 'off']);
  assert.equal(row.control.key, 'realWindows'); assert.equal(row.control.initial, 'full'); assert.equal(row.control.online, 'player');
  assert.ok(PRESET_ROWS.includes('real-windows'));
  const v = Object.fromEntries(GRAPHICS_PRESETS.map((p) => [p.id, p.values['real-windows']]));
  assert.deepEqual(v, { low: 'off', medium: 'rooms', high: 'full', ultra: 'full' });
  assert.equal(v.high, row.control.initial, 'High is how the game ships');
  assert.match(rd('src/ui/settingsMap.js'), /"feat:cloud-quality", "feat:real-windows",/, 'on the Graphics tab, beside the clouds');
});
