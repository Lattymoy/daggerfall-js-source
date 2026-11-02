// SHIP-FADE (2026-10-02, Mac: "Ships should just disappear into the void. If theyre going out to open sea, they should
// fade away") - a ship let go by her range was dropped where she sailed: the director's past DESPAWN_BEYOND, a raider
// past RAIDER_DROP_M, a harbour's moored ships the moment the port was left, a peer's ship out of their word - each gone
// between one frame and the next, and every ship stood came into the world whole, from nothing. Now a ship comes into
// the world over SHIP_FADE_S and goes out of it over SHIP_FADE_S - she sails on, dissolving (the renderer's ordered
// dither, a fragment kept where the screen's 4x4 threshold stands under her share), her crew and lanterns going first
// (FADE_FLATS), her tag with her - and is dropped once she has gone; one fired on as she fades comes about and stays. A
// ship sunk, taken or yielded into a peer's copy goes as she always went. The real host (scenes/naval/navalHost.js) through
// real frames over Come Sail Away's pool (test/navalSea.mjs, test/navalRoom.mjs), the pool's own draw and flats
// (scenes/comeSailAway/comeSailAwayPool.js), the renderer's own setDissolve and shader (render/renderer.js). Each is red on the
// record's code (168bf2587). `03-World/Naval-Combat.md` (SHIP-FADE).
import '../modsOff.js';
import { byClass } from '../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { sea, knowAll } from '../navalSea.mjs';
import { SHIP_FADE_S, HARBOUR_LEAVE } from '../../src/scenes/naval/navalHost.js';
import { createComeSailAwayPool, FADE_FLATS } from '../../src/scenes/comeSailAway/comeSailAwayPool.js';
import { Boat } from '../../src/systems/comeSailAway/comeSailAwayBoat.js';
import { Renderer } from '../../src/render/renderer.js';
import { DISSOLVE_GLSL } from '../../src/render/orderedDither.js';
import { EL_MESH_FS } from '../../src/render/enhancedLighting.js';
import { classicShadowLane } from '../../src/render/classicShadowLane.js';
import { DESPAWN_BEYOND } from '../../src/systems/naval/navalDirector.js';
import { RAIDER_DROP_M } from '../../src/systems/naval/navalRaiders.js';
import { drawNavalTags, destroyNavalHud, tagAlpha } from '../../src/ui/naval/navalHud.js';

const RENDERER = readFileSync(new URL('../../src/render/renderer.js', import.meta.url), 'utf8');
const coast = (x, z) => !(z > 200 || (x > 300 && x < 400 && z > -300));
const PORT = { key: 'port:1', name: 'Wayrest', rect: { minX: -100, maxX: 100, minZ: 220, maxZ: 420 } };
/** The player and her boat moved to `p`. */
const at = (h, p) => { h.view.feet = [...p]; if (h.boat) h.boat.GameObject.position = [...p]; };
/** Frames of `dt` until `done()` - its seconds, or Infinity. */
function until(h, done, max = 30, dt = 0.1) {
  for (let t = 0; t <= max; t += dt) { if (done()) return t; h.host.frame(dt); }
  return Infinity;
}

test('SHIP-FADE A SHIP COMES INTO THE WORLD: every ship stood comes in over SHIP_FADE_S - her share of the world from nought to whole, her boat\'s with her and her tag\'s (she stood whole at once, from nothing)', async () => {
  const h = await sea({ hull: 2 });
  const e = h.host._sea.get(h.host.spawnShip('merchantCoaster', { range: 300 }));
  knowAll(h.host);   // PIN MOVED (SPYGLASS): her colours made out - an unknown hull wears no tag
  assert.deepEqual([e.fade, e.retiring], [0, false], 'stood: not yet in the world');
  h.run(1);
  assert.ok(Math.abs(e.fade - 1 / SHIP_FADE_S) < 1e-6, `a second in: ${e.fade}`);
  assert.equal(e.boat.fade, e.fade, 'her boat drawn at her share');
  assert.ok(Math.abs(h.host.tags().find((t) => t.id === e.id).fade - e.fade) < 1e-9, 'her tag with her');
  h.run(SHIP_FADE_S / 2);
  assert.ok(e.fade > 0.7 && e.fade < 0.8, `${e.fade}`);
  h.run(SHIP_FADE_S);
  assert.deepEqual([e.fade, e.boat.fade], [1, 1], 'whole, and no more');
});

test('SHIP-FADE THE DIRECTOR\'S SHIP SAILS OUT OF THE WORLD: one let go past DESPAWN_BEYOND sails on and fades over SHIP_FADE_S - in the sea and drawn all the while, her share falling - and is gone once she has (she was dropped between one frame and the next)', async () => {
  const h = await sea({ hull: 2, settings: { ShipsAtSea: 'some' } });
  const e = h.host._sea.get(h.host.spawnShip('merchantCoaster', { range: 300, bearing: Math.PI }));
  h.run(SHIP_FADE_S + 0.5);
  assert.equal(e.fade, 1);
  at(h, [0, 0, DESPAWN_BEYOND + 2500]);
  assert.ok(until(h, () => e.retiring) < 10, 'let go by the director');
  assert.ok(h.host._sea.has(e.id), 'not dropped: she sails on');
  const shares = [];
  for (let t = 0; t < SHIP_FADE_S - 0.5; t += 0.5) { h.run(0.5); shares.push(e.fade); assert.ok(h.host._sea.has(e.id), `still in the world at ${t + 0.5} s`); }
  assert.ok(shares.every((v, i) => v < (i ? shares[i - 1] : 1)), `fading: ${shares.map((v) => v.toFixed(2))}`);
  assert.equal(e.boat.fade, e.fade);
  h.run(1);
  assert.equal(h.host._sea.has(e.id), false, 'gone once faded');
});

test('SHIP-FADE ONE FIRED ON AS SHE FADES STAYS: a ship of mine let go that comes to fight comes about and stays, whole again in time; a peer\'s ship let go out of their word fades whatever her word said she did (her stander\'s, never mine to keep)', async () => {
  const h = await sea({ hull: 2 });
  const p = h.host._sea.get(h.host.spawnShip('pirateBrig', { range: 300 }));
  h.run(2);
  assert.equal(p.ship.mode, 'engage', 'she comes for me');
  const share = p.fade;
  p.retiring = true;   // let go, as a range's law lets her
  h.run(0.2);
  assert.equal(p.retiring, false, 'fighting: she stays');
  assert.ok(p.fade > share, 'and comes whole again');
  // a peer's
  const o = await sea({ hull: 2, online: { id: () => 'b-player', peers: () => [{ id: 'a-player', feet: [10, 0, 0] }], sendHit: () => true } });   // her stander in the room
  const word = { s: [[4, 1, 0, 120, 0, 0, Math.PI / 2, 0, 1, 100, 100, 100, 0, 0, 999, 0]], v: [], b: [] };
  for (let t = 0; t < SHIP_FADE_S + 1; t += 0.5) { o.host.applyWord('a-player', word, (q) => q); o.run(0.5); }   // her stander's word, said on
  const peer = o.host._sea.get('a-player:4');
  assert.ok(peer && peer.fade === 1, 'a peer\'s ship stands, whole');
  peer.ship.mode = 'engage';   // her stander's word: she fights
  o.host.applyWord('a-player', { s: [], v: [], b: [] }, (q) => q);
  assert.equal(peer.retiring, true, 'out of the word: she fades');
  o.run(1);
  o.host.applyWord('a-player', word, (q) => q);
  assert.ok(o.host._sea.get('a-player:4') === peer, 'said again as she faded: the same ship');
  assert.equal(peer.retiring, false, 'she stays');
  o.run(1);
  peer.ship.mode = 'engage';
  o.host.applyWord('a-player', { s: [], v: [], b: [] }, (q) => q);
  assert.equal(peer.retiring, true);
  const left = peer.fade;
  o.run(left * SHIP_FADE_S - 0.3);
  assert.ok(o.host._sea.get('a-player:4') === peer && peer.retiring, 'never mine to keep: fading still');
  o.run(0.6);
  assert.equal(o.host._sea.has('a-player:4'), false, 'gone');
});

test('SHIP-FADE A RAIDER SAILS ON OUT OF SIGHT: past RAIDER_DROP_M she fades and is gone; back within it as she fades, she stays; one a peer\'s word holds with the stronger claim (a copy in their sea) goes at once - their copy stands where she does', async () => {
  const h = await sea({ hull: 2 });
  const R = { id: 'r17.16.99', seed: 0x5eed1, pos: [600, 0, 0], ahead: [600, 0, 200], yaw: 0 };
  const raider = () => [...h.host._sea.values()].find((e) => e.raider?.id === R.id) ?? null;
  const LOOKOUT = 100;   // her lookout short of me: she sails her course, no fight of hers
  h.host.raiders([R], { sight: LOOKOUT, spent: new Set() });
  const e = raider();
  assert.ok(e, 'stood');
  h.run(SHIP_FADE_S + 0.5);
  assert.deepEqual([e.fade, e.ship.mode], [1, 'cruise'], 'whole, sailing her course');
  at(h, [-(RAIDER_DROP_M + 4000), 0, 0]);
  h.host.raiders([{ ...R, pos: e.ship.pos }], { sight: LOOKOUT, spent: new Set() });
  assert.equal(e.retiring, true, 'out of sight: she sails on, fading');
  h.run(1);
  assert.ok(h.host._sea.has(e.id) && e.fade < 1 && e.fade > 0.5, `in the world still, fading: ${e.fade}`);
  at(h, [0, 0, 0]);
  h.host.raiders([{ ...R, pos: e.ship.pos }], { sight: LOOKOUT, spent: new Set() });
  assert.equal(e.retiring, false, 'back in range as she faded: she stays');
  assert.equal(raider(), e, 'the same ship');
  at(h, [-(RAIDER_DROP_M + 4000), 0, 0]);
  h.host.raiders([{ ...R, pos: e.ship.pos }], { sight: LOOKOUT, spent: new Set() });
  h.run(SHIP_FADE_S + 0.5);
  assert.equal(raider(), null, 'faded, gone');
  // one stood and let go before she was ever seen (no share of the world yet) goes at once
  h.host.raiders([{ ...R, pos: [-(RAIDER_DROP_M + 4000) + 300, 0, 0] }], { sight: LOOKOUT, spent: new Set() });
  const unseen = raider();
  assert.ok(unseen && unseen.fade === 0);
  at(h, [0, 0, 0]);
  h.host.raiders([{ ...R, pos: unseen.ship.pos }], { sight: LOOKOUT, spent: new Set() });
  h.host.frame(0.1);
  assert.equal(raider(), null, 'never in the world: nothing to fade');
  // a peer holds her, the lower id: mine yields into theirs at once
  h.host.raiders([R], { sight: LOOKOUT, spent: new Set() });
  const again = raider();
  assert.ok(again && again !== e, 'stood again');
  h.run(SHIP_FADE_S + 0.5);
  h.host.raiders([R], { sight: LOOKOUT, spent: new Set(), held: new Map([[R.id, 'a-peer']]) });
  assert.equal(raider(), null, 'yielded: gone at once, never fading beside their copy');
});

test('SHIP-FADE A HARBOUR LEFT: its moored ships fade as the port falls behind and are gone after SHIP_FADE_S; come back while they fade and the same ships stay at their berths - none stood again beside them', async () => {
  const h = await sea({ hull: null, water: coast, settings: { ShipsAtSea: 'few' } });
  at(h, [0, 0, 300]);
  h.deps.harbourNear = () => PORT;
  h.run(SHIP_FADE_S + 1);
  const moored = () => [...h.host._sea.values()].filter((e) => e.ship.errand?.kind === 'moored');
  const ids = moored().map((e) => e.id).sort();
  assert.ok(ids.length >= 2 && moored().every((e) => e.fade === 1), 'the harbour\'s ships, whole');
  at(h, [0, 0, 300 + HARBOUR_LEAVE + 800]);
  h.run(1);
  assert.ok(moored().length === ids.length && moored().every((e) => e.retiring), 'the port left: fading, not gone');
  at(h, [0, 0, 300]);
  h.run(1);
  assert.deepEqual(moored().map((e) => e.id).sort(), ids, 'the same ships');
  assert.ok(moored().every((e) => !e.retiring), 'they stay');
  at(h, [0, 0, 300 + HARBOUR_LEAVE + 800]);
  h.run(SHIP_FADE_S + 1);
  assert.equal(moored().length, 0, 'gone once faded');
});

// ── the drawing ──────────────────────────────────────────────────────────────────────────────────────────────────

const fileFetch = async (url) => {
  const bytes = readFileSync(fileURLToPath(url));
  return { ok: true, json: async () => JSON.parse(bytes.toString('utf8')), arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) };
};
/** test/systems/comeSailAway/csa_pool.test.js's stand-in pipeline: its textures kept, so the flats have their sizes. */
function standInPipeline() {
  const texture = () => ({ recordCount: 100, getSize: () => ({ width: 40, height: 64 }), getScale: () => ({ width: 0, height: 0 }) });
  const textureFiles = new Map(), cpuModels = new Map();
  return {
    textureFiles, cpuModels,
    getTexture: async (a) => { if (!textureFiles.has(a)) textureFiles.set(a, texture()); return textureFiles.get(a); },
    uploadRecord() {},
    getGpuMesh: async (id) => { cpuModels.set(id, { positions: new Float32Array([-1, 0, -2, 1, 1.5, 2]) }); return { classic: id }; },
  };
}

test('SHIP-FADE THE POOL DRAWS HER SHARE: a fading boat\'s meshes are drawn under the renderer\'s dissolve at her share, put back whole after her - a whole boat\'s never; one faded away draws nothing; under FADE_FLATS her flats (her crew, her lanterns) stand down, and stand again over it', async () => {
  const seq = [];
  const renderer = {
    createMesh: (model) => ({ model, buffers: [{}, {}], bounds: [0, 0, 0, 0], subMeshes: model.subMeshes.map((s) => ({ ...s, _bounds: [0, 0, 0, 0] })) }),
    drawMesh: (mesh, matrix) => seq.push(['draw', matrix]), updateMeshVertices() {}, destroyMesh() {},
    createBillboardBatch: (archive, record, size, centers, opts) => ({ archive, record, size, centers, opts }), destroyBillboardBatch() {},
    setDissolve: (v) => seq.push(['dissolve', v]),
  };
  const pool = createComeSailAwayPool({ renderer, pipeline: standInPipeline(), fetchFn: fileFetch, log: { warn() {} } });
  const a = await pool.spawn(new Boat(2), { position: [0, 0, 0], rotation: [0, 0, 0, 1] });
  const b = await pool.spawn(new Boat(2), { position: [40, 0, 0], rotation: [0, 0, 0, 1] });
  for (let i = 0; i < 3; i++) { pool.frame(1 / 60, { playerPosition: [0, 0, 0] }); pool.draw(); await new Promise((r) => setTimeout(r, 20)); }
  const mine = (boat) => new Set(pool.walkOf(boat).mats);
  const ofA = mine(a), ofB = mine(b);
  const run = () => { seq.length = 0; pool.draw(); return seq.map(([k, v]) => (k === 'draw' ? (ofA.has(v) ? 'A' : ofB.has(v) ? 'B' : '?') : `d${v}`)); };
  const whole = run();
  assert.ok(whole.includes('A') && whole.includes('B') && !whole.some((x) => x.startsWith('d')), 'both whole: no dissolve asked');
  a.fade = 0.3;
  const half = run();
  const i = half.indexOf('d0.3'), j = half.indexOf('d1');
  assert.ok(i >= 0 && j > i, `her share, then whole again: ${half.filter((x) => x.startsWith('d'))}`);
  assert.ok(half.slice(i + 1, j).every((x) => x === 'A') && half.slice(i + 1, j).length === whole.filter((x) => x === 'A').length, 'every mesh of hers under it, and only hers');
  assert.equal(half.filter((x) => x === 'B').length, whole.filter((x) => x === 'B').length);
  assert.ok(!half.slice(0, i).includes('A') && !half.slice(j).includes('A'), 'none of hers outside it');
  a.fade = 0;
  const gone = run();
  assert.ok(!gone.includes('A') && !gone.some((x) => x.startsWith('d')), 'faded away: nothing drawn');
  // the flats
  a.fade = 1;
  pool.frame(1 / 60, { playerPosition: [0, 0, 0] });
  const all = pool.batches().length;
  assert.ok(all > 0 && all % 2 === 0, `both boats' flats: ${all}`);
  a.fade = FADE_FLATS - 0.01;
  pool.frame(1 / 60, { playerPosition: [0, 0, 0] });
  assert.equal(pool.batches().length, all / 2, 'under FADE_FLATS: hers stand down');
  a.fade = FADE_FLATS;
  pool.frame(1 / 60, { playerPosition: [0, 0, 0] });
  assert.equal(pool.batches().length, all, 'and stand again');
});

test('SHIP-FADE THE RENDERER\'S DISSOLVE: both mesh shaders - the classic and Enhanced Lighting\'s, the classic shadows\' lane with it - cut a fading ship\'s fragments by the port\'s one bayer4 (orderedDither.js) after their slice: exactly k of a 4x4 tile\'s 16 kept at a share of k/16, all at a cut of nought (a uniform\'s own start - no program needs a word to draw whole); setDissolve clamps the share, uploads its cut at once on the installed mesh program, and asks nothing of the GL when it is unchanged; no pass uploads it (the frame\'s cost unchanged)', () => {
  assert.equal(DISSOLVE_GLSL.trim(), 'uniform float uDissolveCut;\nvoid dissolveCut() {\n  if (uDissolveCut > 0.0 && bayer4(gl_FragCoord.xy) + 0.03125 >= 1.0 - uDissolveCut) discard;\n}');
  // the law, run: bayer4 as BAYER_GLSL spells it (its bits; test/render/la_cost.test.js holds it to the table)
  const bayer4 = (x, y) => { const z = (x & 3) ^ (y & 3); return (((z & 1) << 3) | ((y & 1) << 2) | (z & 2) | ((y >> 1) & 1)) / 16; };
  const kept = (cut) => { let n = 0; for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if (!(cut > 0 && bayer4(x, y) + 0.03125 >= 1 - cut)) n++; return n; };
  for (let k = 0; k <= 16; k++) assert.equal(kept(1 - k / 16), k, `a share of ${k}/16`);
  assert.equal(kept(0), 16, 'a cut of nought: whole');
  // in both mesh shaders, after the slice and before the texture is read
  const classicFs = RENDERER.slice(RENDERER.indexOf('const FS = `'), RENDERER.indexOf('`;', RENDERER.indexOf('const FS = `')));
  assert.match(classicFs, /\$\{BAYER_GLSL\}\n\$\{DISSOLVE_GLSL\}\n/);
  for (const [name, fs] of [['classic', classicFs], ['enhanced', EL_MESH_FS], ['classic shadows', classicShadowLane().meshFs]]) {
    if (name !== 'classic') assert.ok(fs.includes(DISSOLVE_GLSL) && /float bayer4\(vec2 p\)/.test(fs), `${name}: the cut and its bayer4`);
    const main = fs.slice(fs.indexOf('void main() {'));
    const slice = main.indexOf('else if (vWorldPos.y > uClipY) discard;'), cut = main.indexOf('dissolveCut();'), tex = main.indexOf('texture(uTex, vUV)');
    assert.ok(slice > 0 && cut > slice && cut < tex, `${name}: cut after the slice, before the texture`);
  }
  assert.match(RENDERER, /this\.uDissolveCut = gl\.getUniformLocation\(this\.program, 'uDissolveCut'\);/, 'located with the installed mesh program');
  assert.ok(!/uDissolve/.test(RENDERER.slice(RENDERER.indexOf('  _uploadFog(prog) {'), RENDERER.indexOf('\n  }\n', RENDERER.indexOf('  _uploadFog(prog) {')))), 'no pass uploads it');
  // setDissolve
  const calls = [];
  const self = { gl: { uniform1f: (loc, v) => calls.push(['u', loc, v]) }, program: 'mesh', uDissolveCut: 'cut', _use: (p) => calls.push(['use', p]) };
  const set = (v) => Renderer.prototype.setDissolve.call(self, v);
  set(0.25);
  assert.deepEqual(calls, [['use', 'mesh'], ['u', 'cut', 0.75]], 'its cut uploaded at once on the mesh program');
  assert.equal(self._dissolve, 0.25);
  calls.length = 0;
  set(0.25);
  assert.deepEqual(calls, [], 'unchanged: nothing asked');
  for (const [v, want] of [[-3, 0], [7, 1], [NaN, 1], [0.5, 0.5]]) { set(v); assert.equal(self._dissolve, want, `${v}`); }
  assert.equal(calls.at(-1)[2], 0.5);
  const bare = { gl: null, program: 'mesh', uDissolveCut: null, _use() { throw new Error('no program'); } };
  Renderer.prototype.setDissolve.call(bare, 0.4);
  assert.equal(bare._dissolve, 0.4, 'kept where the program has no cut to upload');
});

test('SHIP-FADE HER TAG WITH HER: a tag\'s opacity is its distance\'s times her share of the world', () => {
  destroyNavalHud();
  const pt = (o = {}) => ({ id: 'a:1', name: 'The Gilded Cog', faction: 'merchant', hostile: false, friendly: true, hull: 1, state: 'afloat', boarded: false, target: false, distance: 500, x: 400, y: 200, ...o });
  drawNavalTags([pt({ fade: 0.5 }), pt({ id: 'b:2', x: 700 }), pt({ id: 'c:3', fade: 0, x: 1000 })], { scale: 1, reach: 700 });   // SHIP-CLUTTER: apart, or the nearer covers the rest
  const [layer] = byClass(globalThis.document.body, 'dfnaval-tags');
  const ops = byClass(layer, 'dfnaval-tag').map((n) => n.style.opacity);
  const r = (v) => String(Math.round(v * 100) / 100);
  assert.deepEqual(ops, [r(tagAlpha(500, 700) * 0.5), r(tagAlpha(500, 700)), '0']);
  destroyNavalHud();
});
