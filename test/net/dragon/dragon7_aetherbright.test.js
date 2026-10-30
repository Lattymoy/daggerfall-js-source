// DRAGON7 (2026-10-29, the owner: "Rare chance of a "shiny" varient to spawn with different colors"; bible/11-Multiplayer/
// Dwarven-Dragon.md section 11): THE AETHERBRIGHT'S OWN COLOURS. The dragon's indexed pictures under another palette - the
// brass to aetherium's blue, the wings to its violet, the greys cooled - archive 1801, the PLTE turned and its CRC written
// again; drawn for the boss (in the sky too, before any fight is mine), for a peer's rider, for the mount's pack picture and
// for its rider's saddle. No wash. tools/mutants/dragon7.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { crc32 as zcrc } from 'node:zlib';
import { aetherbrightColour, aetherbrightPalette, aetherbrightPng, AETHER_HUE, AETHER_WING_HUE } from '../../../src/characters/dwarvenDragonShiny.js';
import { installDwarvenDragon, dwarvenDragonSpriteEntries, DWARVEN_DRAGON_ID } from '../../../src/characters/dwarvenDragon.js';
import { DWARVEN_DRAGON_ARCHIVE, AETHERBRIGHT_ARCHIVE, dragonArchiveOf } from '../../../src/characters/dwarvenDragonId.js';
import { PSEUDO_ARCHIVES } from '../../../src/world/eliteGates/pseudoArchives.js';
import { newDragonMount } from '../../../src/systems/dragon/dragonMount.js';
import { inventoryItemImage } from '../../../src/systems/item/itemTemplates.js';
import { createDragonHost } from '../../../src/scenes/dragonHost.js';
import { createDragonLink } from '../../../src/net/dragon/dragonLink.js';
import { createDragonSaddle } from '../../../src/player/dragonSaddle.js';
import { isDragonOmen, dragonTimes, dragonLookOf, pixelCentreNative } from '../../../src/net/dragon/dragonLaw.js';
/** DRAGON-HIDDEN: a watch's omen under the tests' seed, as its cell would tell it. */
const om = (w, s = 0x5eed1234) => ({ w, s });
import { orbitLeg } from '../../../src/net/dragon/dragonBody.js';
import { validDragonOut } from '../../../src/net/wire.js';
import { RemotePlayers } from '../../../src/net/remotePlayers.js';

installDwarvenDragon({ fetchBytes: async () => new Uint8Array(0) });
const src = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const art = (n) => new Uint8Array(readFileSync(new URL(`../../../public/art/dwarven-dragon/${n}.png`, import.meta.url)));
/** [hue, saturation, value] of 0..255 rgb. */
const hsv = ([r, g, b]) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0; if (d) h = mx === r ? 60 * (((g - b) / d) % 6) : mx === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4); return [(h + 360) % 360, mx ? d / mx : 0, mx / 255]; };
/** The PNG's chunks: [type, body, crc, start]. */
function chunks(png) {
  const out = []; const dv = new DataView(png.buffer, png.byteOffset, png.byteLength);
  for (let i = 8; i + 12 <= png.length;) { const n = dv.getUint32(i); out.push([String.fromCharCode(...png.subarray(i + 4, i + 8)), png.subarray(i + 8, i + 8 + n), dv.getUint32(i + 8 + n), i]); i += 12 + n; }
  return out;
}

test('DRAGON7 the palette: the brass and the copper go aetherium\'s blue, the wings\' olive membrane its violet, a grey is cooled and never turned; each colour keeps its light (mutants: the wings left brass; the brass left; the greys turned)', () => {
  const brass = hsv(aetherbrightColour(200, 160, 90)), copper = hsv(aetherbrightColour(150, 90, 50)), wing = hsv(aetherbrightColour(120, 116, 64)), grey = hsv(aetherbrightColour(120, 120, 118));
  assert.ok(Math.abs(brass[0] - AETHER_HUE) < 3 && Math.abs(copper[0] - AETHER_HUE) < 3, `brass ${brass[0]}, copper ${copper[0]}`);
  assert.ok(Math.abs(wing[0] - AETHER_WING_HUE) < 3, `wing ${wing[0]}`);
  assert.ok(grey[1] < 0.15 && Math.abs(grey[0] - (AETHER_HUE + 10)) < 6 && Math.abs(grey[1] - 0.08) < 0.02, `a grey stays a grey, cooled (${grey.map((x) => x.toFixed(2))})`);
  assert.ok(Math.abs(brass[2] - 200 / 255 * 1.08) < 0.02 && Math.abs(wing[2] - 120 / 255) < 0.02, 'the light kept (the brass a little brighter)');
  const pl = new Uint8Array([200, 160, 90, 120, 116, 64]);
  assert.deepEqual([...aetherbrightPalette(pl)], [...aetherbrightColour(200, 160, 90), ...aetherbrightColour(120, 116, 64)]);
});

test('DRAGON7 the picture: an indexed PNG\'s PLTE turned and its CRC written again, every other byte as it came - the pixels, the header, the transparency; anything else answered as it came (mutants: the CRC left; the palette untouched)', () => {
  for (const name of ['1800_15-0', 'saddle-0']) {
    const png = art(name), out = aetherbrightPng(png);
    assert.equal(out.length, png.length);
    const a = chunks(png), b = chunks(out);
    assert.deepEqual(b.map((c) => c[0]), a.map((c) => c[0]));
    for (let i = 0; i < a.length; i++) {
      const [type, body, crc] = b[i];
      assert.equal(crc, zcrc(out.subarray(b[i][3] + 4, b[i][3] + 8 + body.length)) >>> 0, `${name} ${type}'s CRC`);
      if (type === 'PLTE') assert.notDeepEqual([...body], [...a[i][1]], 'the palette turned');
      else assert.deepEqual([...body], [...a[i][1]], `${name} ${type} untouched`);
    }
  }
  const junk = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(aetherbrightPng(junk), junk, 'not a PNG: as it came');
});

test('DRAGON7 the pictures: archive 1801 is every one of 1800\'s, its file turned as it loads; the registry names it; a look\'s archive is 1801 for the Aetherbright alone (mutants: 1801 the brass\'s bytes; a look drawn brass)', async () => {
  const asked = [];
  const entries = dwarvenDragonSpriteEntries({ fetchBytes: async (url) => { asked.push(url); return art('1800_15-0'); } });
  const brass = entries.filter((e) => e.archive === DWARVEN_DRAGON_ARCHIVE), aether = entries.filter((e) => e.archive === AETHERBRIGHT_ARCHIVE);
  assert.equal(aether.length, brass.length);
  assert.deepEqual(aether.map((e) => [e.record, e.frame]), brass.map((e) => [e.record, e.frame]));
  const idle = aether.find((e) => e.record === 15 && e.frame === 0);
  assert.deepEqual([...(await idle.load())], [...aetherbrightPng(art('1800_15-0'))]);
  assert.match(asked.at(-1), /1800_15-0\.png$/, 'from the brass\'s own file - no picture ships');
  assert.ok(PSEUDO_ARCHIVES.some((r) => r.from === 1801 && r.name === 'AETHERBRIGHT_ARCHIVE'));
  assert.deepEqual([dragonArchiveOf(1), dragonArchiveOf(0), dragonArchiveOf(undefined)], [1801, 1800, 1800]);
});

test('DRAGON7 the tamed mount\'s pack picture is its look\'s (mutants: the Aetherbright\'s icon brass)', () => {
  const of = (look) => inventoryItemImage(newDragonMount({ id: 'dg0123456789abcdef', look }));
  assert.deepEqual([of(1).archive, of(1).record], [1801, 15], 'the Aetherbright\'s own idle front');
  assert.deepEqual([of(0).archive, of(0).record], [1800, 15], 'the brass\'s');
});

// the boss on this screen, as dragon3_host.test.js stands it
const M = 40;
function screen(W, t0, me, o = {}) {
  const site = { w: W, lane: 0, px: 205, py: 214, ...pixelCentreNative(205, 214), near: 'Here' };
  const S = { t: t0, me };
  const link = createDragonLink({ now: () => S.t, site: () => S.host.site(), say: () => {} });
  S.host = createDragonHost({
    now: () => S.t, link, sites: { of: (o) => (o.w === W ? site : null) }, online: { ready: () => true, send: () => true },
    local: (nx, nz) => [nx / M, nz / M], native: (x, z) => [x * M, z * M], ground: () => 0,
    feet: () => [site.sx / M + S.me[0], 0, site.sz / M + S.me[1]], eye: () => [site.sx / M + S.me[0], 1.6, site.sz / M + S.me[1]], level: () => 20,
    player: () => ({ health: 100, maxHealth: 200, level: 20 }), hurt: () => {}, save: () => 50, mid: () => {}, say: () => {}, audio: { play3d: () => {} }, ...o,
  });
  S.st = (x = {}) => link.word(validDragonOut({ t: 'dragon', w: W, sx: site.sx, sz: site.sz, k: 'st', b: 0, ph: 1, h: 1000, m: 1000, md: 0, mu: 0, sh: 0, legs: [orbitLeg(dragonTimes(om(W)).landAt, 0, 0, 55, 0, 1, 30)], blows: [], n: 1, lv: dragonTimes(om(W)).leaveAt, op: 0, fell: null, gone: null, ...x }));
  S.run = (ms, step = 50) => { for (let k = 0; k < ms; k += step) { S.host.frame(); S.t += step; } };
  S.host.omen(om(W));   // DRAGON-HIDDEN: its cell's answer to the `ask`
  S.host.frame();
  return S;
}
const watch = (look) => { let w = 500_000; while (!(isDragonOmen(om(w)) && dragonLookOf(om(w)) === look)) w++; return w; };
const draws = () => {
  const made = [], gone = [];
  const tex = { getFrameCount: () => 8, getSize: () => ({ width: 471, height: 262 }), getScale: () => ({ width: 0, height: 0 }) };
  const asked = [];
  return { made, gone, asked, deps: { renderer: { createBillboardBatch: (a, rkey, size) => { const b = { archive: a, rkey, size }; made.push(b); return b; }, destroyBillboardBatch: (b) => gone.push(b), textures: new Set() }, getTexture: async (a) => { asked.push(a); return tex; }, uploadRecordFrame: () => {} } };
};

test('DRAGON7 the boss in its own colours: an Aetherbright\'s fight drawn from 1801, a brass one\'s from 1800, never washed; and in the sky before any fight is mine, the clock\'s look - an Aetherbright circling is blue from the first sight (mutants: the sky drawn brass; the batch kept across a look; a wash)', async () => {
  const Wb = watch(1), T = dragonTimes(om(Wb));
  const d = draws();
  const sky = screen(Wb, T.landAt + 60_000, [0, -300], d.deps);   // in sight, no fight of mine
  sky.run(100); await new Promise((r) => setImmediate(r)); sky.run(200);
  assert.ok(d.made.length >= 1 && d.made.at(-1).archive === AETHERBRIGHT_ARCHIVE, 'circling, already the Aetherbright');
  assert.ok(d.asked.includes(AETHERBRIGHT_ARCHIVE));
  assert.equal(d.made.at(-1).tint ?? null, null, 'no wash');
  const Wn = watch(0), Tn = dragonTimes(om(Wn));
  const e = draws();
  const fight = screen(Wn, Tn.landAt + 60_000, [0, -40], e.deps);
  await new Promise((r) => setImmediate(r));
  fight.st(); fight.run(200); await new Promise((r) => setImmediate(r)); fight.run(200);
  assert.equal(e.made.at(-1).archive, DWARVEN_DRAGON_ARCHIVE, 'the brass');
  fight.st({ b: 1 }); fight.run(200); await new Promise((r) => setImmediate(r)); fight.run(200);
  assert.equal(e.made.at(-1).archive, AETHERBRIGHT_ARCHIVE, 'its look said: its own pictures');
  assert.ok(e.gone.some((b) => b.archive === DWARVEN_DRAGON_ARCHIVE), 'the brass batch put away');
  assert.doesNotMatch(src('src/scenes/dragonHost.js'), /AETHER_WASH|AETHERBRIGHT_WASH/);
});

test('DRAGON7 a peer\'s Aetherbright rider stands in 1801\'s pictures, a brass one\'s in 1800\'s - its own bundle, built again when its look changes (mutants: the skin unread; one bundle for both looks)', async () => {
  const asked = [];
  const tex = { getFrameCount: () => 8 };
  const rp = new RemotePlayers({ renderer: { createBillboardBatch: () => ({ origin: [0, 0, 0] }), destroyBillboardBatch: () => {} }, deps: { fetchBytes: async () => null, getTexture: async (a) => { asked.push(a); return tex; }, uploadRecordFrame: () => {} }, compose: async () => null });
  const blue = await rp._mobileFor('p1', DWARVEN_DRAGON_ID, 'male', dragonArchiveOf(1));
  assert.equal(blue.archive, AETHERBRIGHT_ARCHIVE);
  assert.equal(rp._mobileFor('p1', DWARVEN_DRAGON_ID, 'male', dragonArchiveOf(1)), blue, 'kept while its look holds');
  const brass = await rp._mobileFor('p1', DWARVEN_DRAGON_ID, 'male', dragonArchiveOf(0));
  assert.equal(brass.archive, DWARVEN_DRAGON_ARCHIVE);
  assert.deepEqual(asked, [1801, 1800]);
  assert.match(src('src/net/remotePlayers.js'), /mobileType === DWARVEN_DRAGON_ID \? dragonArchiveOf\(peer\.shown\.rc\) : null\)/);
  assert.doesNotMatch(src('src/net/remotePlayers.js'), /AETHERBRIGHT_WASH|batch\.tint = shown\.rc/);
});

test('DRAGON7 an Aetherbright\'s rider sees its saddle in its own colours: the turned pictures for look 1, the brass\'s for 0, each asked once and kept apart (mutants: the saddle always brass)', async () => {
  let look = 1;
  const loaded = [], up = [];
  const saddle = createDragonSaddle({
    renderer: { uploadTexture: (_k, name) => { up.push(name); return name; }, drawScreenQuad: () => {} },
    load: async (url) => { loaded.push(url); return { width: 320, height: 97 }; }, look: () => look, turn: async (url) => `turned:${url}`,
  });
  saddle.loadArt();
  await new Promise((r) => setImmediate(r));
  assert.equal(saddle.loaded(), true);
  assert.ok(loaded.every((u) => u.startsWith('turned:')) && loaded.length === 2);
  assert.deepEqual(up, ['dragon:aether:saddle-0', 'dragon:aether:saddle-1']);
  look = 0;
  assert.equal(saddle.loaded(), false, 'the brass not yet asked');
  saddle.loadArt();
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(up.slice(2), ['dragon:saddle-0', 'dragon:saddle-1']);
  assert.match(src('src/player/mountRig.js'), /createDragonSaddle\(\{ renderer, look: \(\) => dragonLookOfItem\(dragonMountOf\(playerEntity\?\.items \?\? \[\]\)\) \}\)/);
});
