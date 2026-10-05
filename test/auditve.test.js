// AUDIT VE (2026-10-05, Mac: "Audit this. Ensure this is on by default. And performance isn't affected") - the audit of
// Vanilla Enhanced, VE1-VE4 (`01-Overview/Audit-VE.md`). Every pin here fails on the code as it stood before its fix:
//   D1 - THE DEFAULT: the shipped Base is on until the player chooses otherwise, its add-ons off; a choice either way is
//        kept, through a boot and under a copy the player attaches.
//   P1 - THE DECODE OFF THE MAIN THREAD: the shipped pack's fetch, decode and texture-detail fit run in a worker
//        (systems/vanillaEnhancedDecodeWorker.js); a browser that cannot falls back to this thread, and a worker that
//        dies is never asked again - an ask must not wait for ever.
//   P2 - THE GROUND CACHE IS BOUNDED: three decoded tile sets, the least recently asked let go.
//   R1-R14 - THE REVIEW: an independent adversarial reading of the pushed head (d1c38864) against DFU's own C#, each
//        finding reproduced here before its fix (the section at the foot of this file).
// The mutants are tools/mutants/auditve.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  setDfmodSources, attachedDfmods, setDfmodEnabled, dfmodEnabled, DFMOD_SHIPPED_PREF, DFMOD_OFF_PREF, GROUND_CACHE_SETS,
  dfmodGroundLayers, _resetDfmodForTests,
} from '../src/systems/dfmodTextures.js';
import { VE_PACK_MODS, ON_BY_DEFAULT, vePackClient, vePackUrl, installVanillaEnhancedPack, _setVePackIoForTests } from '../src/systems/vanillaEnhancedPack.js';
import { mipFitSize } from '../src/formats/resample.js';
import { clearTextureReplacements } from '../src/systems/textureReplacement.js';
import { wearVanillaEnhanced, wearClassicTextures, veWorn, classicTexturesWorn, VE_ADDONS_PREF } from '../src/systems/vanillaEnhanced.js';
import { setValue } from '../src/systems/settings.js';
import { getPref, setPref } from '../src/systems/uiPrefs.js';
// R: the review's seams are read through their modules, so a seam the old code lacks fails its own pin, not the file
import * as TR from '../src/systems/textureReplacement.js';
import * as DM from '../src/systems/dfmodTextures.js';
import * as DS from '../src/scenes/dataSource.js';
import * as OVH from '../src/systems/overhauls.js';
import { createDataPipeline } from '../src/scenes/dataPipeline.js';

const BASE = 'dfmod/vanilla enhanced - base.dfmod';
const MASKED = 'dfmod/vanilla enhanced - masked roads.dfmod';
const SNOWLESS = 'dfmod/vanilla enhanced - snowless swamps and jungles.dfmod';
const enc = (t) => new TextEncoder().encode(t);
const src = (rel) => readFileSync(new URL(`../src/${rel}`, import.meta.url), 'utf8');

function fresh() {
  _resetDfmodForTests();
  setValue('Enhancements', 'AssetInjection', 'True');
  setPref(DFMOD_OFF_PREF, []);
  setPref(DFMOD_SHIPPED_PREF, {});
  setPref(VE_ADDONS_PREF, []);
  clearTextureReplacements();
  _setVePackIoForTests({ fetch: async (u) => enc(u), decode: async () => ({ width: 1, height: 1, data: new Uint8Array(4) }) });
}
const states = () => attachedDfmods().map((m) => [m.key, m.shipped, m.enabled]);

// ---- D1 ------------------------------------------------------------------------------------------------------------

test('AUDIT VE D1: the shipped Base is ON by default and its add-ons OFF - no choice on the shelf, the default answers; a choice either way is the player\'s and outlives a boot; Classic\'s choice holds (mutants: the Base off by default; the default ignored; a choice ignored; an off not kept)', async () => {
  fresh();
  assert.deepEqual([...ON_BY_DEFAULT], ['base'], 'Mac: "Ensure this is on by default" - the Base; its add-ons are picked on the card');
  installVanillaEnhancedPack();
  assert.deepEqual(states(), [[BASE, true, true], [MASKED, true, false], [SNOWLESS, true, false]]);
  assert.deepEqual(getPref(DFMOD_SHIPPED_PREF), {}, 'a default writes nothing');
  assert.ok(veWorn(), 'a fresh game wears it: Replace Game Artwork is on by default (DFU\'s own)');
  setDfmodEnabled([BASE, MASKED], false);
  setDfmodEnabled(SNOWLESS, true);
  assert.deepEqual(getPref(DFMOD_SHIPPED_PREF), { [BASE]: false, [MASKED]: false, [SNOWLESS]: true });
  await setDfmodSources([], async () => null);   // a boot
  assert.deepEqual(states(), [[BASE, true, false], [MASKED, true, false], [SNOWLESS, true, true]], 'the choices, through a boot');
  wearVanillaEnhanced();
  assert.equal(dfmodEnabled(BASE), true);
  wearClassicTextures();
  assert.deepEqual(states().map((s) => s[2]), [false, false, false], 'Classic switches the shipped off');
  _resetDfmodForTests();
  installVanillaEnhancedPack();
  assert.deepEqual(states().map((s) => s[2]), [false, false, false], 'and a new page keeps Classic - the off is a choice, not the default');
});

test('AUDIT VE D1: under a copy the player attaches, the choice is the key\'s - the copy wears the shipped mod\'s switch, the attach switches it on, and removed, the shipped Base keeps the switch the copy left. PIN MOVED (R3, one switch a mod - DFU\'s Mod.Enabled by Title): this read "the shipped choice waits", the copy on a switch of its own on the attached shelf, and removing it brought back a shipped switch the player had moved since', async () => {
  fresh();
  installVanillaEnhancedPack();
  setDfmodEnabled(BASE, false);
  const store = new Map();
  const copy = {
    textAssets: [{ name: 'Vanilla Enhanced - Base.dfmod', get text() { return JSON.stringify({ ModTitle: 'Vanilla Enhanced - Base', ModVersion: '3.5.0' }); } }],
    textures: [{ name: '302_0-0', width: 2, height: 2 }], arrays: [], rgba: async () => null, close() {},
  };
  const load = async (k) => store.get(k) ?? (k === BASE ? new Uint8Array([1]) : null);
  const opts = { open: async () => copy, saveIndex: async (k, j) => { store.set(k, enc(j)); }, background: false };
  await setDfmodSources([BASE], load, opts);
  assert.deepEqual(states()[0], [BASE, false, false], 'the attached copy, off: the key\'s choice');
  DM.noteDfmodAttached(BASE, { title: 'Vanilla Enhanced - Base' });   // the attach's own step (dataSource.storeDfmodFiles)
  assert.deepEqual(states()[0], [BASE, false, true], 'a mod attached is on (VE3)');
  assert.deepEqual(getPref(DFMOD_SHIPPED_PREF), { [BASE]: true }, 'and the switch it wears is the key\'s');
  await setDfmodSources([], load, opts);
  assert.deepEqual(states()[0], [BASE, true, true], 'removed: the shipped Base, on - the switch the copy left');
});

// ---- P1 ------------------------------------------------------------------------------------------------------------

test('AUDIT VE P1: the decode worker fetches, decodes, fits the picture to the texture detail as a mip chain would, and MOVES the pixels back; a browser without OffscreenCanvas there says so; a failed fetch is an error, not "unsupported" (mutants: no fit; the pixels copied, not moved; unsupported unsaid)', async () => {
  const saved = { onmessage: globalThis.onmessage, postMessage: globalThis.postMessage, fetch: globalThis.fetch, createImageBitmap: globalThis.createImageBitmap, OffscreenCanvas: globalThis.OffscreenCanvas };
  const posted = [];
  try {
    globalThis.postMessage = (msg, transfer) => posted.push({ msg, transfer });
    globalThis.fetch = async (url) => (/missing/.test(url) ? { ok: false, status: 404 } : { ok: true, blob: async () => new Blob([url.split('#')[1]]) });
    globalThis.createImageBitmap = async (blob) => { const [w, h] = (await blob.text()).split('x').map(Number); return { width: w, height: h, close() {} }; };
    globalThis.OffscreenCanvas = class {
      constructor(w, h) { this.w = w; this.h = h; }
      getContext() { return { drawImage() {}, getImageData: (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4).fill(200) }) }; }
    };
    await import('../src/systems/vanillaEnhancedDecodeWorker.js');
    const ask = async (data) => { posted.length = 0; await globalThis.onmessage({ data }); return posted[0]; };
    let r = await ask({ id: 1, url: 'x#726x941', maxSize: 256 });
    assert.deepEqual([r.msg.id, r.msg.width, r.msg.height], [1, ...mipFitSize(726, 941, 256)], 'the tree at the texture detail');
    assert.equal(r.msg.data.length, r.msg.width * r.msg.height * 4);
    assert.deepEqual(r.transfer, [r.msg.data.buffer], 'moved, not copied');
    r = await ask({ id: 2, url: 'x#256x256', maxSize: Infinity });
    assert.deepEqual([r.msg.width, r.msg.height], [256, 256], 'whole when no detail is asked');
    r = await ask({ id: 3, url: 'missing#1x1' });
    assert.deepEqual([r.msg.id, r.msg.unsupported, /404/.test(r.msg.error)], [3, false, true]);
    globalThis.OffscreenCanvas = undefined;
    r = await ask({ id: 4, url: 'x#1x1' });
    assert.deepEqual([r.msg.id, r.msg.unsupported], [4, true], 'no OffscreenCanvas in a worker: the page decodes instead');
  } finally { Object.assign(globalThis, saved); }
});

/** A fake decode worker: answers each ask with a 1x1 picture whose red is `red`, or as `mode` says. */
function fakeWorkers(mode = 'ok') {
  const made = [];
  const factory = () => {
    const w = {
      asks: [], dead: false,
      postMessage(msg) {
        w.asks.push(msg);
        if (w.dead) return;   // a dead worker never answers
        setTimeout(() => w.onmessage({ data: mode === 'unsupported' ? { id: msg.id, error: 'no OffscreenCanvas in a worker', unsupported: true } : { id: msg.id, width: 1, height: 1, data: Uint8Array.of(77, 0, 0, 255) } }), 0);
      },
      terminate() { w.dead = true; },
    };
    made.push(w);
    return w;
  };
  return { factory, made };
}
const within = (p, ms = 500) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`still waiting after ${ms} ms`)), ms))]);

test('AUDIT VE P1: the shipped client asks its worker, not this thread; a worker that cannot (no OffscreenCanvas there) hands the decode back to this thread for good; a worker that died while idle is never asked again - the next ask is this thread\'s, never a wait for ever (mutants: the worker never asked; unsupported not falling back; a dead worker asked)', async () => {
  fresh();
  const mainThread = [];
  const io = { fetch: async (u) => { mainThread.push(u); return enc(u); }, decode: async () => ({ width: 1, height: 1, data: Uint8Array.of(9, 0, 0, 255) }) };
  const base = VE_PACK_MODS.find((m) => m.dir === 'base');
  const name = base.index.textures[0][0];
  // a worker that answers
  let w = fakeWorkers();
  _setVePackIoForTests({ ...io, worker: w.factory });
  let img = await vePackClient(base).rgba(name, { maxSize: 256 });
  assert.equal(img.data[0], 77, 'the worker\'s pixels');
  assert.deepEqual(mainThread, [], 'nothing fetched on this thread');
  assert.deepEqual(w.made.flatMap((x) => x.asks).map((a) => [a.url, a.maxSize]), [[vePackUrl(`base/${name}.png`), 256]], 'the URL and the detail, to the worker');
  // a worker that cannot
  w = fakeWorkers('unsupported');
  _setVePackIoForTests({ ...io, worker: w.factory });
  img = await vePackClient(base).rgba(name);
  assert.equal(img.data[0], 9, 'this thread decoded it');
  const asked = w.made.flatMap((x) => x.asks).length;
  await vePackClient(base).rgba(name);
  assert.equal(w.made.flatMap((x) => x.asks).length, asked, 'and the worker is not asked again');
  assert.equal(mainThread.length, 2);
  // a worker that died between asks
  w = fakeWorkers();
  _setVePackIoForTests({ ...io, worker: w.factory });
  mainThread.length = 0;
  assert.equal((await vePackClient(base).rgba(name)).data[0], 77);
  for (const x of w.made) { x.dead = true; x.onerror?.({ message: 'the worker script would not load' }); }
  img = await within(vePackClient(base).rgba(name));
  assert.equal(img.data[0], 9, 'this thread, at once');
  _setVePackIoForTests();
});

// ---- P2 ------------------------------------------------------------------------------------------------------------

test('AUDIT VE P2: the ground cache keeps the three most recently asked tile sets - a fourth lets the least recent go, which is decoded again when it is asked; asking one again makes it the most recent (mutants: the cache unbounded; the oldest asked let go, not the least recent)', async () => {
  fresh();
  assert.equal(GROUND_CACHE_SETS, 3);
  const decoded = [];
  const arrays = Object.fromEntries([302, 303, 304, 402].map((a) => [`${a}-TexArray`, a]));
  const mod = {
    textAssets: [{ name: 'Ground.dfmod', get text() { return JSON.stringify({ ModTitle: 'Ground' }); } }],
    textures: [], arrays: Object.keys(arrays).map((name) => ({ name, width: 1, height: 1, depth: 2 })),
    rgba: async () => null,
    layers: async (name) => { decoded.push(arrays[name]); return [0, 1].map(() => ({ width: 1, height: 1, data: Uint8Array.of(1, 2, 3, 255) })); },
    close() {},
  };
  const store = new Map();
  await setDfmodSources(['dfmod/ground.dfmod'], async (k) => store.get(k) ?? (k === 'dfmod/ground.dfmod' ? new Uint8Array([1]) : null),
    { open: async () => mod, saveIndex: async (k, j) => { store.set(k, enc(j)); }, background: false });
  const tex = { recordCount: 2, getDFBitmap: (r) => r, getColor32: () => ({ width: 1, height: 1, colors: new Uint8Array(4) }) };
  const ask = (a) => dfmodGroundLayers(a, tex);
  for (const a of [302, 303, 304]) await ask(a);
  await ask(302);   // the most recent now
  await ask(402);   // the fourth: 303, the least recently asked, goes
  assert.deepEqual(decoded, [302, 303, 304, 402]);
  await ask(302); await ask(304); await ask(402);
  assert.deepEqual(decoded, [302, 303, 304, 402], 'the three kept answer without a decode');
  await ask(303);
  assert.deepEqual(decoded, [302, 303, 304, 402, 303], 'the one let go is decoded again');
});

// ---- R: THE REVIEW ---------------------------------------------------------------------------------------------------
// An independent adversarial reviewer read a snapshot of the pushed head (d1c38864) against DFU's own C# (ModManager.cs,
// TextureReplacement.cs, TextureReader.cs). Its load order, TryGetAsset walk and terrain import held; these are what did
// not, each red here on the code as it read it.

/** The shipped pack over a fake fetch and decode whose picture's red says whose file it is: 1 the Base, 2 Masked Roads,
 *  3 Snowless Swamps and Jungles. `gate` holds every decode until it settles. Answers the URLs decoded. */
function packIo({ gate = null, failing = null } = {}) {
  const decodes = [];
  _setVePackIoForTests({
    fetch: async (u) => { if (failing?.(u)) throw new Error(`${u}: the network dropped it`); return enc(u); },
    decode: async (bytes) => {
      const url = new TextDecoder().decode(bytes);
      decodes.push(url);
      if (gate) await gate;
      const red = /\/masked-roads\//.test(url) ? 2 : /\/snowless-swamps-and-jungles\//.test(url) ? 3 : 1;
      return { width: 1, height: 1, data: Uint8Array.of(red, 0, 0, 255) };
    },
  });
  return decodes;
}
const redOf = (archive, record) => TR.decodedTexture(archive, record)?.colors?.[0] ?? null;
const settle = () => new Promise((r) => setTimeout(r, 0));
/** An opened bundle as unityBundle answers one: a manifest, textures and the pictures' red. */
const bundle = (title, { deps = [], textures = [], red = 5, version = null } = {}) => ({
  textAssets: [{ name: `${title}.dfmod`, get text() { return JSON.stringify({ ModTitle: title, ModVersion: version, Dependencies: deps.map((n) => ({ Name: n })) }); } }],
  textures: textures.map((n) => ({ name: n, width: 1, height: 1 })), arrays: [],
  rgba: async () => ({ width: 1, height: 1, data: Uint8Array.of(red, 0, 0, 255) }), close() {},
});
const index = (title, { v = 3, version = null, textures = [], deps = [] } = {}) =>
  enc(JSON.stringify({ v, title, version, ...(v >= 3 ? { deps } : {}), textures: textures.map((n) => [n, 1, 1]), arrays: [], xml: {} }));

test('AUDIT VE R1 (Major): a switch keeps every decoded picture whose source still answers - pressed again, or an add-on switched on, it costs the Base none of its pictures; a name the add-on takes over never answers the Base\'s stale picture, and the next ask decodes the add-on\'s alone (mutants: the bundle tier wiped at every install; a stale picture answered)', async () => {
  fresh();
  const decodes = packIo();
  installVanillaEnhancedPack();
  assert.equal(await TR.preloadTextureArchive(303), 56, 'the Base\'s 56 tiles of 303');
  assert.equal(redOf(303, 0), 1);
  const tex = { recordCount: 56, getDFBitmap: (r) => r, getColor32: () => ({ width: 1, height: 1, colors: Uint8Array.of(0, 0, 0, 255) }) };
  await dfmodGroundLayers(302, tex);   // a ground set built
  const before = decodes.length;
  setDfmodEnabled(BASE, true);   // the On pressed again
  assert.equal(redOf(303, 0), 1, 'a switch pressed again costs nothing (the review: every picture went classic)');
  await dfmodGroundLayers(302, tex);
  assert.equal(decodes.length, before, 'nor the ground set built from the same walk');
  setDfmodEnabled(MASKED, true);   // Masked Roads on: 303_46, _47 and _55 are its now
  assert.equal(redOf(303, 0), 1, 'the Base\'s own tiles kept');
  assert.equal(redOf(303, 46), null, 'a name the add-on took over never answers the Base\'s picture');
  decodes.length = 0;
  assert.equal(await TR.preloadTextureArchive(303), 3, 'the next ask decodes the three the add-on answers, and nothing else');
  assert.deepEqual([redOf(303, 46), redOf(303, 47), redOf(303, 55), redOf(303, 0)], [2, 2, 2, 1]);
  setDfmodEnabled(MASKED, false);
  assert.equal(redOf(303, 46), null, 'switched off, the add-on\'s picture is not drawn');
  assert.equal(await TR.preloadTextureArchive(303), 3);
  assert.equal(redOf(303, 46), 1, 'the Base\'s again');
});

test('AUDIT VE R1 (Major): a switch takes effect for what is drawn next - the scene\'s next ask of an archive it already loaded decodes what answers now, and an ask with nothing changed decodes nothing (mutants: an archive preloaded once a scene; the epoch never moved)', async () => {
  fresh();
  const built = [];
  TR.addVendorTextures([{ archive: 9901, record: 0, standIn: true, yields: true, fileName: 'port:9901_0-0', build: async () => { built.push(1); return { width: 1, height: 1, data: Uint8Array.of(9, 0, 0, 255) }; } }]);
  const renderer = { textures: new Map(), uploadTexture() {}, uploadEmissionTexture() {} };
  const pipe = createDataPipeline({ renderer, arch: null, palette: null, fetch: async (n) => { throw new Error(`no ${n} here`); } });
  try {
    await pipe.getTexture(9901);
    assert.equal(redOf(9901, 0), 9, 'the port\'s stand-in');
    await pipe.getTexture(9901);
    assert.equal(built.length, 1, 'nothing changed, nothing decoded again');
    TR.setBundleTextures([{ archive: 9901, record: 0, fileName: 'mod.dfmod:9901_0-0', src: 'mod.dfmod@1:9901_0-0', image: async () => ({ width: 1, height: 1, data: Uint8Array.of(7, 0, 0, 255) }) }]);
    await pipe.getTexture(9901);   // the next area's ask of an archive this scene already holds
    assert.equal(redOf(9901, 0), 7, 'the mod\'s picture: the switch reached the scene (the review: the archive was never asked again)');
    TR.setBundleTextures([]);
    await pipe.getTexture(9901);
    assert.equal(redOf(9901, 0), 9, 'and the stand-in\'s again when the mod goes');
    assert.equal(built.length, 2);
  } finally { TR.setBundleTextures([]); TR.clearVendorTextures(); }
});

test('AUDIT VE R8: a decode in flight when its mod is switched off lands nowhere - Classic chosen while an area loads is what that area draws, and nothing of the mod is held against the budget (mutants: the late picture kept)', async () => {
  fresh();
  let open; const gate = new Promise((r) => { open = r; });
  packIo({ gate });
  installVanillaEnhancedPack();
  const loading = TR.preloadTextureArchive(303);
  await settle();
  wearClassicTextures();   // the pause menu, while the area loads
  open();
  await loading;
  assert.equal(redOf(303, 0), null, 'Classic is what is drawn');
  assert.equal(TR.bundleDecodedBytes(), 0, 'and nothing of the Base is held');
  // the one-record door (an icon, a doll piece) the same
  setDfmodEnabled(BASE, true);
  let open2; const gate2 = new Promise((r) => { open2 = r; });
  packIo({ gate: gate2 });
  const asking = TR.preloadTextureRecord(303, 1);
  await settle();
  wearClassicTextures();
  open2();
  assert.equal(await asking, null);
  assert.equal(TR.bundleDecodedBytes(), 0);
});

test('AUDIT VE R2 (Major): the texture store is registered before a menu reads it - the menus\' door registers it once a page, unless a host or a pick already has; the boot seam goes through the same door; the Overhauls and packs cards wait for it, and the texture card offers no Use until it lands (mutants: the door never registering; registering at every ask)', async () => {
  assert.equal(typeof DS.textureStoreRegistered, 'function', 'the menus\' door');
  const g0 = TR.looseTextureGeneration();
  assert.equal(DS.textureStoreSettled(), false);
  await DS.textureStoreRegistered();
  assert.equal(TR.looseTextureGeneration(), g0 + 1, 'registered (an empty store here: node has no IndexedDB)');
  assert.equal(DS.textureStoreSettled(), true);
  await DS.textureStoreRegistered();
  assert.equal(TR.looseTextureGeneration(), g0 + 1, 'once a page');
  const shared = src('scenes/shared.js');
  assert.match(shared, /const textures = registerTextureStore\(\)/, 'the boot seam\'s registration is the store\'s own');
  assert.doesNotMatch(shared, /setDfmodSources\(|setTextureReplacements\(/, 'no second copy of it');
  const menu = src('ui/enhancedMenu.js');
  assert.match(menu, /function paneOverhauls\(body\) \{\n\s+waitForTextureStore\(\);/);
  assert.match(menu, /function packsCard\(\) \{\n\s+waitForTextureStore\(\);/);
  assert.match(menu, /const reading = p\.id === 'texture' && !textureStoreSettled\(\);/);
  assert.match(menu, /use\.disabled = o === cur \|\| reading \|\| !!blocked;/);
});

test('AUDIT VE R3: a copy over a shipped mod and the shipped mod are ONE switch, as DFU keeps one Mod.Enabled by Title - Classic worn over the copy holds when the copy is removed; a copy attached is on, and so is its key (mutants: the copy on a shelf of its own; the attach not switching the key on)', async () => {
  fresh();
  installVanillaEnhancedPack();
  const store = new Map();
  const load = async (k) => store.get(k) ?? (k === BASE ? enc('copy') : null);
  const opts = { open: async () => bundle('Vanilla Enhanced - Base', { version: '3.5.0', textures: ['302_0-0'] }), saveIndex: async (k, j) => { store.set(k, enc(j)); }, background: false };
  await setDfmodSources([BASE], load, opts);   // the player's own copy, under the shipped key
  assert.deepEqual(states()[0], [BASE, false, true], 'the copy, on: the Base\'s own default');
  wearClassicTextures();
  assert.equal(dfmodEnabled(BASE), false);
  await setDfmodSources([], load, opts);   // the copy removed
  assert.deepEqual(states()[0], [BASE, true, false], 'the shipped Base, off: Classic held (the review: it came back on)');
  assert.ok(classicTexturesWorn());
  assert.equal(typeof DM.noteDfmodAttached, 'function', 'the attach\'s step');
  DM.noteDfmodAttached(BASE, { title: 'Vanilla Enhanced - Base' });   // the copy attached again: a mod attached is on (VE3)
  assert.equal(getPref(DFMOD_SHIPPED_PREF)[BASE], true, 'and the switch it wears is the key\'s');
});

test('AUDIT VE R9: a copy under another file name shadows the shipped mod of its Title, as DFU loads one mod a Title - the browser\'s "(1)" download is the one read, and it wears the shipped mod\'s switch (mutants: shadowing by key alone; the copy on a shelf of its own)', async () => {
  fresh();
  installVanillaEnhancedPack();
  const K = 'dfmod/vanilla enhanced - base (1).dfmod';
  const store = new Map();
  await setDfmodSources([K], async (k) => store.get(k) ?? (k === K ? enc('copy') : null),
    { open: async () => bundle('Vanilla Enhanced - Base', { version: '3.5.0', textures: ['302_0-0'] }), saveIndex: async (k, j) => { store.set(k, enc(j)); }, background: false });
  assert.deepEqual(attachedDfmods().map((m) => [m.key, m.shipped]), [[K, false], [MASKED, true], [SNOWLESS, true]], 'the copy read, the shipped Base not (the review: both, the shipped winning every name)');
  assert.equal(dfmodEnabled(K), true, 'the shipped Base\'s default');
  setDfmodEnabled(K, false);
  assert.deepEqual(getPref(DFMOD_SHIPPED_PREF), { [BASE]: false }, 'the switch is the Title\'s');
  assert.deepEqual(getPref(DFMOD_OFF_PREF), []);
});

test('AUDIT VE R4: a mod attached again under the same file name is read again - the registration knows its index changed, not only its name; the same index again is the same registration, its open bundle kept (mutants: the signature by name alone)', async () => {
  fresh();
  const K = 'dfmod/x.dfmod';
  let version = '1';
  const closed = [];
  const load = async (k) => (k === 'dfmod-index/x.dfmod' ? index('X', { version, textures: ['302_0-0'] }) : k === K ? enc(k) : null);
  const opts = { open: async () => ({ ...bundle('X', { textures: ['302_0-0'], red: Number(version) }), close() { closed.push(version); } }) };
  await setDfmodSources([K], load, opts);
  assert.equal(attachedDfmods()[0].version, '1');
  assert.equal((await TR.preloadTextureRecord(302, 0))?.colors[0], 1, 'X 1\'s picture - its bundle opened');
  await setDfmodSources([K], load, opts);   // a host's boot: nothing changed
  assert.deepEqual(closed, [], 'the same registration: the open bundle kept');
  version = '2';   // X 2 attached under the same name
  await setDfmodSources([K], load, opts);
  assert.equal(attachedDfmods()[0].version, '2', 'read again (the review: the old version stood for the session)');
  assert.equal(redOf(302, 0), null, 'X 1\'s decode is not X 2\'s picture');
  assert.equal((await TR.preloadTextureRecord(302, 0))?.colors[0], 2, 'X 2\'s, from its own open');
});

test('AUDIT VE R5: a copy shadows the shipped mod only once it is registered - one still being indexed, or one that will not index, leaves the shipped Base drawing; the packs card lists it with its state and a Remove (mutants: an unindexed key shadowing; the unregistered unlisted)', async () => {
  fresh();
  installVanillaEnhancedPack();
  const unreadable = Object.assign(new Error('The requested file could not be read'), { name: 'NotReadableError' });
  await setDfmodSources([BASE], async () => null, { background: false, loadBlob: async () => { throw unreadable; } });
  assert.deepEqual(states()[0], [BASE, true, true], 'the shipped Base still registered (the review: shadowed by a copy that never registered)');
  assert.equal(typeof DM.unregisteredDfmods, 'function');
  assert.deepEqual(DM.unregisteredDfmods().map((u) => [u.key, u.state]), [[BASE, 'error']]);
  assert.match(DM.unregisteredDfmods()[0].error, /could not read the stored file - remove it and add it again/);
  assert.match(src('ui/enhancedMenu.js'), /for \(const u of unregisteredDfmods\(\)\) \{/, 'the packs card lists them');
});

test('AUDIT VE R6: an index of the version before registers at once - its mod draws from the first boot after the update and is rebuilt in the background; one that cannot be rebuilt stays registered (mutants: a v2 index refused)', async () => {
  fresh();
  const K = 'dfmod/x.dfmod';
  const stored = new Map([['dfmod-index/x.dfmod', index('X', { v: 2, textures: ['302_0-0'] })]]);
  let release; const opening = new Promise((r) => { release = r; });
  await setDfmodSources([K], async (k) => stored.get(k) ?? (k === K ? enc(k) : null), {
    open: async () => { await opening; return bundle('X', { deps: ['base'], textures: ['302_0-0'] }); },
    saveIndex: async (k, j) => { stored.set(k, enc(j)); }, background: true,
  });
  assert.deepEqual(attachedDfmods().map((m) => [m.key, m.deps]), [[K, []]], 'registered from its v2 index at once (the review: unregistered until rebuilt)');
  release();
  for (let i = 0; i < 5; i++) await settle();
  assert.deepEqual(attachedDfmods()[0].deps, ['base'], 'the rebuilt index lands');
  fresh();
  stored.set('dfmod-index/x.dfmod', index('X', { v: 2, textures: ['302_0-0'] }));
  await setDfmodSources([K], async (k) => stored.get(k) ?? null, { open: async () => { throw new Error('gone'); }, background: false });
  assert.deepEqual(attachedDfmods().map((m) => m.key), [K], 'a rebuild that fails keeps it registered from what it had');
});

test('AUDIT VE R7: a picture asked while a registration reads its indexes is served by the registration it was asked under, and the new registration opens its own - the shipped client never serves the copy that replaced it (mutants: the opened clients forgotten before the reads)', async () => {
  fresh();
  packIo();
  installVanillaEnhancedPack();
  let release; const reading = new Promise((r) => { release = r; });
  const load = async (k) => {
    if (k === 'dfmod-index/vanilla enhanced - base.dfmod') { await reading; return index('Vanilla Enhanced - Base', { version: '3.5.0', textures: ['303_0-0'] }); }
    return k === BASE ? enc('copy') : null;
  };
  const registering = setDfmodSources([BASE], load, { open: async () => bundle('Vanilla Enhanced - Base', { textures: ['303_0-0'], red: 5 }) });
  assert.equal((await TR.preloadTextureRecord(303, 0))?.colors[0], 1, 'asked in the window: the shipped Base\'s, as registered');
  release();
  await registering;
  assert.equal((await TR.preloadTextureRecord(303, 0))?.colors[0], 5, 'the copy\'s, from its own open (the review: the shipped client served it)');
});

test('AUDIT VE R10: with a loose texture pack attached, Classic cannot be worn by a switch - the card says why and its Use is not offered; the Custom note names the loose pack, not a mix of mods (mutants: Classic offered; the note left saying mods)', () => {
  fresh();
  installVanillaEnhancedPack();
  TR.setTextureReplacements(['302_0-0.png'], async () => null);
  const panel = OVH.OVERHAUL_PANELS.find((p) => p.id === 'texture');
  const classic = panel.options.find((o) => o.id === 'classic');
  assert.match(classic.blocked?.() ?? '', /loose texture pack/i, 'the reason, on the card');
  setDfmodEnabled(BASE, false);   // every mod off, the loose pack still drawing
  assert.equal(OVH.currentOption(panel), null);
  assert.match(typeof panel.custom === 'function' ? panel.custom() : panel.custom, /loose texture pack/i);
  TR.clearTextureReplacements();
  assert.equal(classic.blocked(), null, 'nothing loose, nothing in the way');
  assert.equal(OVH.currentOption(panel), classic);
  assert.match(src('ui/enhancedMenu.js'), /const blocked = o\.blocked\?\.\(\) \?\? null;/);
});

test('AUDIT VE R11: ?nomods is the door\'s one rule - no attached mod registers on that page, from the boot, a menu or a pick, and it is listed to be removed; the shipped pack is the port\'s and registers either way (mutants: the rule kept at the boot alone)', async () => {
  fresh();
  const had = Object.getOwnPropertyDescriptor(globalThis, 'location');
  globalThis.location = { search: '?nomods' };
  try {
    installVanillaEnhancedPack();
    await setDfmodSources(['dfmod/x.dfmod'], async (k) => (k === 'dfmod-index/x.dfmod' ? index('X') : null));
    assert.deepEqual(attachedDfmods().map((m) => m.key), [BASE, MASKED, SNOWLESS], 'the shipped alone (the review: the boot skipped the pack and a menu registered the mods)');
    assert.deepEqual((DM.unregisteredDfmods?.() ?? []).map((u) => [u.key, u.state]), [['dfmod/x.dfmod', 'nomods']]);
  } finally { if (had) Object.defineProperty(globalThis, 'location', had); else delete globalThis.location; }
  assert.doesNotMatch(src('scenes/shared.js'), /noMods\(|nomods\\b/, 'the boot keeps no rule of its own');
});

test('AUDIT VE R12: one slice of a shipped array that will not load costs that tile, not the climate - it stands classic in the set, and a set that lost one is asked again next time, not kept (mutants: the array all or nothing; a failed set cached)', async () => {
  fresh();
  const base = VE_PACK_MODS.find((m) => m.dir === 'base');
  const lost = vePackUrl(base.slices['302-TexArray'][5]);
  let failing = true;
  packIo({ failing: (u) => failing && u === lost });
  installVanillaEnhancedPack();
  const tex = { recordCount: 56, getDFBitmap: (r) => r, getColor32: () => ({ width: 1, height: 1, colors: Uint8Array.of(0, 0, 0, 255) }) };
  const warn = console.warn; console.warn = () => {};
  try {
    let set = await dfmodGroundLayers(302, tex);
    assert.equal(set?.length, 56, 'the set stands (the review: the whole climate went classic)');
    assert.deepEqual([set[5].colors[0], set[4].colors[0], set[6].colors[0]], [0, 1, 1], 'the lost tile classic, its neighbours the Base\'s');
    failing = false;
    set = await dfmodGroundLayers(302, tex);
    assert.equal(set[5].colors[0], 1, 'asked again, not kept: the tile is the Base\'s now');
  } finally { console.warn = warn; }
});

test('AUDIT VE R13: the paper doll composes at four times only while a mod switched on carries doll art - not for Vanilla Enhanced or a copy of it, the lighting mod, or a mod switched off (mutants: every attached mod counted)', async () => {
  fresh();
  installVanillaEnhancedPack();
  assert.equal(DM.dfmodCarriesDollArt?.(), false, 'the shipped pack carries none');
  const store = new Map();
  const doll = bundle('Doll', { textures: ['FACES.CIF_14-0', '302_0-0'] });
  const lit = bundle('Improved Interior Lighting');
  await setDfmodSources(['dfmod/doll.dfmod', 'dfmod/iil.dfmod'], async (k) => store.get(k) ?? (/^dfmod\//.test(k) ? enc(k) : null), {
    open: async (b) => (new TextDecoder().decode(b) === 'dfmod/doll.dfmod' ? doll : lit), saveIndex: async (k, j) => { store.set(k, enc(j)); }, background: false,
  });
  assert.equal(DM.dfmodCarriesDollArt(), true, 'a head: doll art');
  setDfmodEnabled('dfmod/doll.dfmod', false);
  assert.equal(DM.dfmodCarriesDollArt(), false, 'switched off, none - the lighting mod carries none either');
  assert.match(src('ui/paperDoll.js'), /const composeScale = \(\) => \(dfmodCarriesDollArt\(\) \? PAPERDOLL_HD_SCALE : 1\);/);
});

test('AUDIT VE R1 (VE4\'s law under it): the same shipped list again changes nothing - its opened clients are kept, not closed and opened again at every card\'s read (the walk signature keeps the generation either way, so this is what the early return alone holds) (mutants: the same list installed again)', async () => {
  fresh();
  let opens = 0;
  const client = { rgba: async () => ({ width: 1, height: 1, data: Uint8Array.of(4, 0, 0, 255) }), close() {} };
  const list = [{ key: 'dfmod/s.dfmod', index: { title: 'S', textures: [['302_0-0', 1, 1], ['302_1-0', 1, 1]], arrays: [], xml: {} }, open: () => { opens++; return client; }, on: true }];
  DM.setShippedDfmods(list);
  assert.equal((await TR.preloadTextureRecord(302, 0))?.colors[0], 4);
  DM.setShippedDfmods(list);   // a card's read puts the pack in again
  assert.equal((await TR.preloadTextureRecord(302, 1))?.colors[0], 4);
  assert.equal(opens, 1, 'one client for the page');
});
