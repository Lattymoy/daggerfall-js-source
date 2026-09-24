// AUDIT 68 (2026-09-24), the whole-tree sweep - cluster "scenes_ab" (src/scenes: the watch, the data door, the
// dropped torches, the mesh pipeline, the town talk slot, the host magic and enchant doors, the interior people).
// Each pin EXECUTES the real module over the shape its producer mints, and each failed on the base it fixes: a
// watchman who died twice, a drop that walked one item, a Morrowind read that landed in the next attach's cache,
// a flying torch that rebuilt its GL batch every step, two mill builds minting one mesh twice, a readout that ate
// every activation, an enchanted strike that dropped the Soul Trap line and the Charm, a squad stood inside
// itself, a flash and a shopkeeper published into a torn-down scene, and a hidden person still drawn.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createCityGuards } from '../src/scenes/cityGuards.js';
import { registerEnemyDeathHandler } from '../src/scenes/corpseMarker.js';
import * as ds from '../src/scenes/dataSource.js';
import { createDroppedTorches, PROJECTILE_FIXED_DT, PUFF } from '../src/scenes/droppedTorches.js';
import { readTorchSettings, HANDHELD_TORCHES_VENDOR } from '../src/systems/handheldTorches.js';
import { MOD_SETTINGS } from '../src/systems/modSettings.js';
import { TEMPLATES } from '../src/systems/useItem.js';
import { setWorldMinutes } from '../src/systems/worldTick.js';
import { createDataPipeline } from '../src/scenes/dataPipeline.js';
import { DFPalette } from '../src/formats/dfPalette.js';
import { createTownTalk } from '../src/scenes/townTalk.js';
import { StatusReadout } from '../src/ui/statusBox.js';
import { ActionTextBox } from '../src/ui/actionText.js';
import { createPlayerMagic } from '../src/scenes/hostMagic.js';
import { createEnchantCtx, standLooseFoe } from '../src/scenes/hostEnchant.js';
import { buildInteriorContext } from '../src/scenes/interiorContext.js';

const settle = (ms = 5) => new Promise((r) => setTimeout(r, ms));

// ---- S18-guard-redeath ---------------------------------------------------------------------------------------
/** The 74-byte CLASS18.CFG record ClassFile.load walks (watch1.test.js's synthetic career). */
function stubClassCfg() {
  const b = new Uint8Array(80); const v = new DataView(b.buffer);
  v.setUint16(52, 10, true);
  for (let i = 0; i < 8; i++) v.setUint16(58 + i * 2, 50, true);
  return b;
}
const guardTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 4 };
async function oneWatchman() {
  const said = [];
  const player = { level: 1, reflexes: 2, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50 }, crimeCommitted: 4 };
  const pool = createCityGuards({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
    collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false },
    fetchBytes: async (n) => { if (n === 'CLASS18.CFG') return stubClassCfg(); throw new Error(`no ${n} in this pin`); },
    getTexture: async () => guardTex, uploadRecordFrame: () => {},
    currentMinute: () => 523530, currentPixelKey: () => '3,12',
    playerEntity: player, audio: null, onPlayerHurt: () => {}, rand: () => 0.9, say: (t) => said.push(t),
  });
  await pool.spawnCityGuards(true, { playerFeet: [0, 0, 0], playerFwd: [0, 0, 1], pool: [{ pos: [5, 0, 5], fwdYaw: 0, guard: true, disable: () => {} }] });
  return { pool, said, player, g: pool.guards[0] };
}

test('AUDIT 68 S18-guard-redeath: a blow on a watchman already dead runs no second death - one notice, one OnEnemyDeath, one body', async () => {
  let deaths = 0;
  registerEnemyDeathHandler('audit68-guard-redeath', () => { deaths++; });
  try {
    const { pool, said, g } = await oneWatchman();
    pool.hurtGuard(g, 1000, [0, 0, 0]);              // the killing blow
    await settle();
    pool.hurtGuard(g, 5, [0, 0, 0]);                 // the next DoT tick of the same round, on the body
    await settle();
    assert.deepEqual(said.filter((l) => /just died/.test(l)), ['City Watch just died.'], 'one kill notice');
    assert.equal(deaths, 1, 'OnEnemyDeath once - its handlers roll loot');
    assert.equal(pool.update(0.016, [0, 0, 0], [0, 1.6, 0]).length, 1, 'and one corpse batch for one body');
  } finally { registerEnemyDeathHandler('audit68-guard-redeath', null); }
});

test('AUDIT 68 S18-guard-redeath: a watchman who walked away is not a body a stray shaft can mint, and costs no Murder', async () => {
  const { pool, said, player, g } = await oneWatchman();
  player.crimeCommitted = 0;                          // the court let the player go
  pool.update(0.016, [0, 0, 0], [0, 1.6, 0]);         // the watch walks away (dead, no corpse)
  assert.equal(g.dead, true);
  pool.hurtGuard(g, 1000, [0, 0, 0], [0, 0, 1]);      // an arrow in flight lands on the record it closed over
  await settle();
  assert.equal(player.crimeCommitted, 0, 'no Murder for a man who was never there');
  assert.equal(!!g.corpse, false, 'and no lootable body');
  assert.deepEqual(said, []);
});

// ---- S18-drop-items-after-await ------------------------------------------------------------------------------
/** The drop event as the browser mints it: the item list reads empty once the dispatch has returned (the
 *  DataTransferItemList's disabled mode), and its iterator re-reads `length` every step (Array.prototype.values). */
function dropEvent(entries) {
  let dispatching = true;
  const items = { get length() { return dispatching ? entries.length : 0; }, [Symbol.iterator]: Array.prototype.values };
  entries.forEach((en, i) => Object.defineProperty(items, i, { get: () => (dispatching ? { kind: 'file', webkitGetAsEntry: () => en } : undefined) }));
  return { event: { preventDefault() {}, dataTransfer: { items } }, dispatched: () => { dispatching = false; } };
}
const fileEntry = (name, { fail = false } = {}) => ({
  isFile: true, isDirectory: false, name,
  file: (res, rej) => setTimeout(() => (fail ? rej?.(Object.assign(new Error('A requested file could not be read'), { name: 'NotReadableError' })) : res({ name, arrayBuffer: async () => new ArrayBuffer(4) })), 0),
});
const dirEntry = (name, children) => ({
  isFile: false, isDirectory: true, name,
  createReader: () => { let done = false; return { readEntries: (res) => setTimeout(() => { res(done ? [] : children); done = true; }, 0) }; },
});
/** ensureArena2's picker over a DOM stand-in: its drop listener and its message line. */
async function arena2Picker() {
  const ui = { style: {}, innerHTML: '', listeners: {}, removed: false, els: {},
    querySelector(sel) { return (this.els[sel] ??= { textContent: '', addEventListener() {} }); },
    addEventListener(t, fn) { this.listeners[t] = fn; }, remove() { this.removed = true; } };
  const prev = globalThis.document;
  globalThis.document = { createElement: () => ui, body: { appendChild() {} } };
  const done = ds.ensureArena2().then(() => 'resolved');
  for (let i = 0; i < 50 && !ui.listeners.drop; i++) await settle(1);
  globalThis.document = prev;
  assert.ok(ui.listeners.drop, 'the picker is up');
  return { ui, done, msg: ui.els['#msg'] };
}

test('AUDIT 68 S18-drop-items-after-await: every dropped item is walked - the list is read before the first await', async () => {
  const { ui, done, msg } = await arena2Picker();
  // the files INSIDE ARENA2, selected and dropped (FOLDER_PICK_HINT's own route), one of them a folder
  const [first, ...rest] = ds.REQUIRED_ARENA2;
  const drop = dropEvent([fileEntry(first), dirEntry('more', rest.slice(0, 3).map((n) => fileEntry(n))), ...rest.slice(3).map((n) => fileEntry(n))]);
  ui.listeners.drop(drop.event);
  drop.dispatched();                                  // the handler has hit its first await: the dispatch is over
  const how = await Promise.race([done, settle(300).then(() => 'pending')]);
  assert.doesNotMatch(msg.textContent, /not a complete ARENA2 folder/, `every file reached the ingest (${msg.textContent})`);
  assert.equal(how, 'resolved', 'and the whole set was taken');
  assert.equal(ui.removed, true);
});

test('AUDIT 68 S18-drop-items-after-await: a read the browser refuses is said, not waited on for ever', async () => {
  const { ui, msg } = await arena2Picker();
  const drop = dropEvent([fileEntry('ARCH3D.BSA', { fail: true })]);
  ui.listeners.drop(drop.event);
  drop.dispatched();
  await settle(50);
  assert.match(msg.textContent, /^drop failed: A requested file could not be read\. /, 'the error, and the hint after it');
  assert.equal(ui.removed, false, 'the picker stays up');
});

// ---- S18-mw-cache-stale-generation ---------------------------------------------------------------------------
/** A fake IndexedDB with the timing the race needs: every request lands a beat later, and one named read can be
 *  held back (`slow`). Values are snapshotted at the request, as a transaction's are. */
function fakeIndexedDb(initial) {
  const stores = new Map(Object.entries(initial).map(([k, v]) => [k, new Map(Object.entries(v))]));
  const slow = new Map();
  const later = (fn, ms = 2) => setTimeout(fn, ms);
  const storeOf = (name) => { if (!stores.has(name)) stores.set(name, new Map()); return stores.get(name); };
  const db = {
    objectStoreNames: { contains: () => true }, createObjectStore: () => {},
    transaction(names) {
      const tx = {};
      tx.objectStore = (name) => {
        const map = storeOf(name);
        return {
          getAllKeys() { const r = {}; const keys = [...map.keys()]; const ms = slow.get(`keys:${name}`) ?? 2; slow.delete(`keys:${name}`); later(() => { r.result = keys; r.onsuccess?.(); later(() => tx.oncomplete?.()); }, ms); return r; },
          get(k) { const r = {}; const v = map.get(k); const ms = slow.get(k) ?? 2; slow.delete(k); later(() => { r.result = v; r.onsuccess?.(); }, ms); return r; },
          put(v, k) { map.set(k, v); later(() => tx.oncomplete?.()); },
          delete(k) { map.delete(k); },
          clear() { map.clear(); later(() => tx.oncomplete?.()); },
        };
      };
      void names;
      return tx;
    },
  };
  return { idb: { open: () => { const r = {}; later(() => { r.result = db; r.onsuccess?.(); }); return r; } }, stores, slow };
}
/** ONE fake for the file: dataSource opens its database once and keeps the handle. */
let _mwIo = null;
function mwStore(files) {
  _mwIo ??= fakeIndexedDb({ morrowind: {} });
  globalThis.indexedDB = _mwIo.idb;
  const store = _mwIo.stores.get('morrowind');
  store.clear();
  for (const [k, v] of Object.entries(files)) store.set(k, v);
  return { io: _mwIo, store };
}

test('AUDIT 68 S18-mw-cache-stale-generation: a read in flight across an attach lands in its OWN generation, and a clear mid-read does not throw', async () => {
  const prev = globalThis.indexedDB;
  const { io, store } = mwStore({ 'Morrowind.esm': new Uint8Array([1, 1, 1]).buffer });
  try {
    await ds.registerMorrowindData();
    const gen0 = ds.morrowindDataGeneration();
    io.slow.set('Morrowind.esm', 150);
    const inflight = ds.loadMorrowindFile('Morrowind.esm');          // a build reads the old .esm
    await settle(1);
    store.set('Morrowind.esm', new Uint8Array([2, 2, 2, 2]).buffer);  // the player re-attaches a newer one
    await ds.registerMorrowindData();
    assert.equal(ds.morrowindDataGeneration(), gen0 + 1, 'the attach is a new generation');
    await ds.loadMorrowindFile('Morrowind.bsa');                       // anything in the new generation mints its cache
    assert.deepEqual([...await inflight], [1, 1, 1], 'the old read answers its own caller');
    assert.deepEqual([...await ds.loadMorrowindFile('Morrowind.esm')], [2, 2, 2, 2], 'and the new generation reads the file the store holds');

    io.slow.set('Morrowind.esm', 150);
    const reading = ds.loadMorrowindFile('Morrowind.esm');
    await settle(1);
    // a warm cache would answer without a read; drop it the way the attach does, then read
    await ds.clearStoredMorrowind();                                  // MWA2's Remove data, mid-read
    await assert.doesNotReject(reading, 'the read lands in the cache it began under, not on the null the clear left');
  } finally { if (prev === undefined) delete globalThis.indexedDB; else globalThis.indexedDB = prev; }
});

test('AUDIT 68 S18-mw-cache-stale-generation: an archive set opened before an attach is not served as the new generation\'s', async () => {
  const prev = globalThis.indexedDB;
  const { io, store } = mwStore({ 'Morrowind.esm': new ArrayBuffer(2) });
  try {
    await ds.registerMorrowindData();
    const gen = ds.morrowindDataGeneration();
    io.slow.set('keys:morrowind', 120);
    const opening = ds.loadMorrowindArchives();                         // the open walks the stored names...
    await settle(5);
    store.set('meshes/x/y.nif', new ArrayBuffer(3));                    // ...while a loose mod is attached
    await ds.registerMorrowindData();
    assert.equal(ds.morrowindDataGeneration(), gen + 1, 'the attach is a new generation');
    const stale = await opening;
    const current = await ds.loadMorrowindArchives();
    assert.notEqual(current, stale, 'the new generation opens its own set');
    assert.equal(current.filter((a) => a.loose).length, 1, 'with the loose mod in it');
  } finally { if (prev === undefined) delete globalThis.indexedDB; else globalThis.indexedDB = prev; }
});

// ---- S18-torch-batch-churn -----------------------------------------------------------------------------------
const TORCH_SHAPES = { 0: [4, 31, 34], 1: [5, 9, 19], 2: [5, 15, 21], 10: [1, 31, 34], 11: [1, 9, 19], 12: [1, 15, 21] };
function torchPool(deps = {}) {
  const store = { ...Object.fromEntries(Object.entries(MOD_SETTINGS[HANDHELD_TORCHES_VENDOR].keys).map(([k, d]) => [k, d.default])), 'Throwing.ThrowDispersion': 0, 'Throwing.ThrowAngleOffset': 0 };
  const made = { created: 0, destroyed: 0 };
  const renderer = {
    uploadTexture: () => {}, uploadEmissionTexture: () => {},
    createBillboardBatch: (archive, record, size, centers) => { made.created++; return { archive, record, size: { ...size }, centers: centers.map((c) => [...c]), frame: 0 }; },
    destroyBillboardBatch: () => { made.destroyed++; },
  };
  const p = createDroppedTorches({
    renderer, audio: null, getTexture: deps.getTexture ?? null, uploadRecordFrame: () => {},
    collider: () => null, foes: () => deps.foes ?? [],
    entity: { level: 5, lightSource: null, stats: { strength: 100, agility: 50, luck: 50, speed: 50 }, skills: {}, activeEffects: [], armorValues: [] },
    camera: () => ({ pos: [0, 1.7, 0], feet: [0, 0, 0], yaw: 0, pitch: 0, forward: [0, 0, 1], right: [1, 0, 0], up: [0, 1, 0] }),
    inside: () => true, waterLevel: () => null,
    settings: () => readTorchSettings(() => store), rolls: () => 0.5, say: () => {},
    loadTexture: async (record, frame) => { const s = TORCH_SHAPES[record]; return !s || frame >= s[0] ? null : { width: s[1], height: s[2], data: null }; },
  });
  return { p, made };
}
const drawnAt = (b) => { const o = b.origin ?? [0, 0, 0]; return [b.centers[0][0] + o[0], b.centers[0][1] + o[1], b.centers[0][2] + o[2]]; };

test('AUDIT 68 S18-torch-batch-churn: a thrown torch flies on ONE batch - the flight and the spin ride the draw-time origin and size', async () => {
  setWorldMinutes(31000);
  const { p: q, made } = torchPool();
  q.tick(0);
  const t = q.spawnLightSourceProjectile(TEMPLATES.Torch, 1000, [0, 5, 0], [0, 0, 1], 1);
  await settle();
  const batch = t.batch;
  for (let i = 0; i < 30; i++) q.tick(PROJECTILE_FIXED_DT);
  assert.equal(t.dead, false, 'still in the air');
  assert.equal(t.batch, batch, 'the same batch, thirty steps on');
  assert.deepEqual(made, { created: 1, destroyed: 0 }, 'no VAO freed and rebuilt per 0.02 s step');
  const at = drawnAt(t.batch);
  assert.ok(Math.abs(at[2] - t.pos[2]) < 1e-9 && Math.abs(at[1] - (t.pos[1] - Math.abs(t.base.h) / 2)) < 1e-9, 'drawn centred on the flight point');
  assert.equal(t.batch.size, t.size, 'and the spin is the batch\'s size');
  q.offsetAll([10, 0, 0]);
  assert.ok(Math.abs(drawnAt(t.batch)[0] - t.pos[0]) < 1e-9, 'a recenter moves it without a rebuild');
  assert.equal(made.created, 1);
});

test('AUDIT 68 S18-torch-batch-churn: a burning foe that walks keeps ONE flame batch', async () => {
  const foe = { entity: { level: 1, health: 3000, maxHealth: 3000, activeEffects: [], armorValues: [], stats: { agility: 50, luck: 50 }, skills: {} }, ai: { feet: [0.35, 0, 1], height: 1.8, yaw: 0, isHostile: true }, dead: false };
  const { p: q, made } = torchPool({ foes: [foe], getTexture: async () => ({ getFrameCount: () => 6, getSize: () => ({ width: 32, height: 64 }) }) });
  q.igniteFoe(foe);
  q.tick(0.016); await settle(); q.tick(0.016);
  const flame = q.batches().find((b) => b.archive === PUFF.archive);
  assert.ok(flame, 'the flame stands');
  for (let i = 0; i < 20; i++) { foe.ai.feet = [0.35 + i * 0.1, 0, 1]; q.tick(0.016); }
  assert.equal(q.batches().find((b) => b.archive === PUFF.archive), flame, 'the same batch');
  assert.deepEqual(made, { created: 1, destroyed: 0 }, 'not one per frame the foe moved');
  assert.ok(Math.abs(drawnAt(flame)[0] - (0.35 + 1.9)) < 1e-9, 'and it is drawn where the foe is now');
});

// ---- S18-uploadpart-no-inflight ------------------------------------------------------------------------------
/** A TEXTURE archive of `n` 1x1 records sharing one body - every (archive, record) the mill names resolves. */
function textureArchive(n) {
  const recPos = 26 + 20 * n, RECORD_HEADER = 28;
  const bytes = new Uint8Array(recPos + RECORD_HEADER + 256);
  const v = new DataView(bytes.buffer);
  v.setInt16(0, n, true);
  for (let i = 0; i < n; i++) v.setInt32(26 + 20 * i + 2, recPos, true);
  v.setInt16(recPos + 4, 1, true); v.setInt16(recPos + 6, 1, true);
  v.setUint32(recPos + 10, 256, true); v.setUint32(recPos + 14, RECORD_HEADER, true); v.setUint16(recPos + 20, 1, true);
  bytes[recPos + RECORD_HEADER] = 5;
  return bytes;
}

test('AUDIT 68 S18-uploadpart-no-inflight: two cold mill builds share ONE body and ONE sail mesh', async () => {
  const palette = new DFPalette(); palette.makeGrayscale();
  const tex = textureArchive(80);
  let meshes = 0;
  const pipe = createDataPipeline({
    renderer: { uploadTexture: () => 'tex', uploadEmissionTexture: () => {}, createMesh: () => ({ id: ++meshes }) },
    arch: { getRecordIndex: () => -1, getMesh: () => null }, palette,
    fetch: async (name) => { await settle(3); return name === 'FLATS.CFG' ? new Uint8Array(0) : tex; },
  });
  const [a, b] = await Promise.all([pipe.getWindmillMeshes(300, false), pipe.getWindmillMeshes(300, false)]);
  assert.equal(meshes, 2, 'the body and the sail, once each - the second cold build waits on the first');
  assert.equal(a.body, b.body);
  assert.equal(a.rotor, b.rotor);
});

// ---- S21-readout-eats-activate -------------------------------------------------------------------------------
const talkHost = () => createTownTalk({ renderer: {}, canvas: { width: 320, height: 200 }, fetchBytes: async () => { throw new Error('no data'); }, playerEntity: { name: 'P', stats: {} }, regionIndex: 0 });

test('AUDIT 68 S21-readout-eats-activate: the non-pausing Status readout consumes no activation and no touch mode cycle - a pausing window still does', () => {
  const tt = talkHost();
  tt.showOverlay(new StatusReadout(['a', 'b']));
  assert.equal(tt.overlayActive, false, 'the readout does not pause');
  assert.equal(tt.tryActivate([0, 1.5, 0], [0, 0, 1], []), false, 'nobody under the ray: the door, the pile, the body behind it are the ladder\'s');
  const m0 = tt.mode;
  assert.notEqual(tt.nextMode(), m0, 'the touch cycle turns the mode, as F1-F4 do under the readout');
  // ...and the other half of the law: a PAUSING window still takes both
  const paused = talkHost();
  paused.showOverlay(new ActionTextBox(['a']));
  assert.equal(paused.overlayActive, true);
  assert.equal(paused.tryActivate([0, 1.5, 0], [0, 0, 1], []), true, 'a click under a pausing window is the window\'s');
  const m1 = paused.mode;
  assert.equal(paused.nextMode(), m1, 'and the mode holds');
});

// ---- S21-strike-landing-dup ----------------------------------------------------------------------------------
/** A foe record (a monster, or a class for the Charm), the real cast engine, and the real enchant ctx over it. */
function strikeRig(mobileType) {
  const player = { level: 10, activeEffects: [], stats: {} };
  const said = [];
  const foe = { entity: { mobileType, level: 1, activeEffects: [], stats: { willpower: 0 }, ...(mobileType >= 128 ? { isClass: true } : {}), health: 20, maxHealth: 20 }, mobileType, ai: { isHostile: true, feet: [0, 0, 1] }, dead: false };
  const sinks = () => ({ hurt() {}, heal() {} });
  const magic = createPlayerMagic({ renderer: {}, audio: { playOneShotId() {} }, getTexture: async () => null, uploadRecord() {}, collider: { raycast: () => Infinity },
    playerEntity: player, playerSinks: {}, say: (l) => said.push(l), surfacePlayer() {}, foes: () => [foe], foeSinks: sinks, absorbCtx: () => ({}), rolls: () => 0.99 });
  const ctx = createEnchantCtx({ playerEntity: player, spellsByIndex: () => new Map(), now: () => 0, sinks: {}, say: (l) => said.push(l), magic, foes: () => [foe], foeSinks: sinks });
  return { player, said, foe, ctx };
}

test('AUDIT 68 S21-strike-landing-dup: Cast When Strikes lands through the cast paths\' foe door - "Trap active." and the Charm both reach the foe', () => {
  const soulTrap = { name: 'Soul Trap', rangeType: 1, element: 4, effects: [{ type: 12, subType: 255, chanceBase: 100, chanceMod: 0, chancePerLevel: 1, durationBase: 5, durationMod: 0, durationPerLevel: 1 }] };
  const a = strikeRig(3);
  a.ctx.applySpellToTarget(soulTrap, a.player, a.foe.entity);   // enchantments.js CastWhenStrikes -> the ctx's target door
  assert.ok(a.foe.entity.activeEffects.some((e) => e.kind === 'soulTrap'), 'the trap is on the foe');
  assert.deepEqual(a.said, ['Trap active.'], 'and BecomeIncumbent says so, as it does for the cast');
  const charm = { name: 'Charm', rangeType: 2, element: 4, effects: [{ type: 34, subType: 255, chanceBase: 100, chanceMod: 0, chancePerLevel: 1 }] };
  const b = strikeRig(140);
  b.ctx.applySpellToTarget(charm, b.player, b.foe.entity);
  assert.equal(b.foe.ai.isHostile, false, 'a struck Charm pacifies, as a cast one does');
});

// ---- S21-loose-foe-stacking ----------------------------------------------------------------------------------
test('AUDIT 68 S21-loose-foe-stacking: a squad stood in one loop sees its own spots before any spawn lands', async () => {
  // a seeded stream, so the placement is the same run to run (placeFoeEnv's default is Math.random)
  let seed = 12345;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x80000000; };
  const real = Math.random;
  Math.random = rnd;
  try {
    const collider = { raycastHit: () => ({ dist: Infinity, normal: null }), heightAt: () => 0, sphereOverlaps: () => false };
    const foes = [], spots = [];
    const env = { collider, feet: [0, 0, 0], yawRad: 0, fovDegrees: 60, foes,
      // the pool lands a walker on the floor under the spot it was handed (its own floorLanding), a beat later
      spawn: (mt, pos) => { spots.push(pos); return settle(0).then(() => { foes.push({ ai: { feet: [pos[0], 0, pos[2]], height: 1.8 } }); return {}; }); } };
    // RR's Thieves Guild expulsion at level 10 (rrRealism's squad): 10 rogues at 1..8, 10 thieves at 1..4
    const landing = [];
    for (let i = 0; i < 10; i++) landing.push(standLooseFoe(env, 129, { lineOfSightCheck: false, minDistance: 1, maxDistance: 8, attempts: 200 }));
    for (let i = 0; i < 10; i++) landing.push(standLooseFoe(env, 130, { lineOfSightCheck: false, minDistance: 1, maxDistance: 4, attempts: 200 }));
    await Promise.all(landing);
    let inside = 0;
    for (let i = 0; i < spots.length; i++) for (let j = i + 1; j < spots.length; j++) {
      if (Math.hypot(spots[i][0] - spots[j][0], spots[i][2] - spots[j][2]) < 0.9) inside++;   // two capsules (r 0.45) interpenetrating
    }
    assert.ok(spots.length >= 15, `the squad stands (${spots.length})`);
    assert.equal(inside, 0, 'no two foes stand inside each other');
    // and a spawn that settles gives its spot back to the pool's own record
    const again = standLooseFoe(env, 129, { lineOfSightCheck: false, minDistance: 1, maxDistance: 8, attempts: 200 });
    await again;
    assert.equal(foes.length, spots.length);
  } finally { Math.random = real; }
});

// ---- S21-magic-destroy-impacts -------------------------------------------------------------------------------
test('AUDIT 68 S21-magic-destroy-impacts: a flash still warming its archive at teardown publishes nothing into the dead engine', async () => {
  let created = 0, freed = 0;
  const tex = { recordCount: 5, getSize: () => ({ width: 16, height: 16 }), getScale: () => ({ x: 0, y: 0 }), getFrameCount: () => 3 };
  const magic = createPlayerMagic({
    renderer: { createBillboardBatch: () => { created++; return {}; }, destroyBillboardBatch: () => { freed++; } },
    audio: { playOneShotId() {}, play3dId() {} },
    getTexture: () => settle(5).then(() => tex),   // an archive this scene has not warmed yet
    uploadRecord() {}, uploadRecordFrame() {}, collider: { raycast: () => Infinity },
    playerEntity: { level: 1, activeEffects: [] }, playerSinks: {}, say() {}, surfacePlayer() {},
    foes: () => [], foeSinks: () => ({}), absorbCtx: () => ({ inside: true, day: false }),
  });
  magic.spellVisual({ from: [0, 1, 0], dir: [0, 0, 1], element: 0, rangeType: 1 });   // the impact flash starts warming
  magic.destroy();                                                                    // the dungeon context is torn down (NT1)
  await settle(30);
  assert.equal(created - freed, 0, 'no batch outlives the engine');
  assert.deepEqual(magic.batches(), []);
});

// ---- S21-late-stand-after-destroy / S21-person-hide-noop -----------------------------------------------------
/** A one-room, one-person interior through the real builder (the shape collectInteriorPeople reads). */
async function onePersonRoom({ peopleVisible = true, texDelay = 0 } = {}) {
  const model = { positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 0, 1]), indices: new Uint32Array([0, 1, 2]), subMeshes: [] };
  const cpuModels = new Map();
  const live = new Set();
  const renderer = {
    createBillboardBatch: (a, r, s, c) => { const b = { a, r, c }; live.add(b); return b; },
    destroyBatch: (b) => { live.delete(b); }, destroyMesh: () => {}, createMesh: () => ({}),
  };
  const tex = { recordCount: 10, getSize: () => ({ width: 32, height: 64 }), getScale: () => ({ width: 0, height: 0 }), getFrameCount: () => 1 };
  const deps = { renderer, getGpuMesh: async (id) => { cpuModels.set(id, model); return { gpu: id }; }, cpuModels,
    getTexture: () => (texDelay ? settle(texDelay).then(() => tex) : Promise.resolve(tex)), uploadRecord: () => {}, uploadRecordFrame: () => {}, palette: null };
  const dfBlock = { name: 'T.RMB', rmbBlock: { subRecords: [{ interior: { header: { num3dObjectRecords: 1 },
    block3dObjectRecords: [{ modelIdNum: 1, objectType: 3, xPos: 0, yPos: 0, zPos: 0, xRotation: 0, yRotation: 0, zRotation: 0 }],
    blockFlatObjectRecords: [], blockDoorRecords: [], blockSection3Records: [],
    blockPeopleRecords: [{ xPos: 0, yPos: 0, zPos: 100, textureArchive: 182, textureRecord: 0, factionID: 0, flags: 0, position: 1 }] } }] } };
  const ctx = await buildInteriorContext(deps, dfBlock, 0, 0, 300, 0, null, { peopleVisible });
  const drawing = () => ctx.billboardBatches.filter((b) => b.a === 182).length;
  return { ctx, live, drawing, pn: ctx.people[0] };
}

test('AUDIT 68 S21-late-stand-after-destroy: a person stood as the player walks out publishes no billboard into the torn-down room', async () => {
  const { ctx, live } = await onePersonRoom({ peopleVisible: false, texDelay: 5 });   // a shuttered shop: nobody stands
  ctx.people[0].host.setActive(true);   // the rest's OnPop: UpdateNpcPresence stands the shopkeeper...
  ctx.destroy();                        // ...and the player walks out before the archive warms
  await settle(30);
  assert.equal(live.size, 0, 'no batch outlives the room');
  assert.deepEqual(ctx.billboardBatches.filter((b) => b.a === 182), []);
});

test('AUDIT 68 S21-person-hide-noop: SetActive(false) takes a person the BUILD stood out of the draw, and SetActive(true) stands one copy', async () => {
  const { pn, drawing, ctx } = await onePersonRoom();
  assert.equal(drawing(), 1, 'the build draws the person');
  assert.ok(pn.width > 0, 'with an extent for the ray');
  pn.host.setActive(false);             // QuestResource.Tick's hide, after the build
  assert.equal(drawing(), 0, 'SetActive(false) takes the renderer with the collider');
  pn.host.setActive(true);
  await settle();
  assert.equal(drawing(), 1, 'and the person comes back once, not twice');
  ctx.destroy();
});
