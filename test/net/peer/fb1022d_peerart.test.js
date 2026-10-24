// FIELD BUGS 2026-10-22d PEER-ART (bible/01-Overview/bugs/Field-Bugs-2026-10-22d.md, report 2): Foretold on the Discord's
// #bug-reports, "Memory Leak": "viewing task manager shows an instance out of 7 that is leaking 5gb of ram"; Xuurath:
// "Yep massive memory leak on desktop app". The peers' art store (net/peer/peerRiders.js createEotbArt) kept every
// sprite's decoded pictures for the session, and let a texture go only for a rider's horse look (COATS1) - a worn-armour
// walker (LAYERED-PEERS, 2026-10-19) is ~55 frames of its own outfit, so every outfit met online stood for good: ~4 MB of
// pixels and its textures each. Driven over the store itself, with the producer's own keys (layeredArmor.js
// layeredSprite) and a renderer that counts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEotbArt, createPeerRiders, createPeerWalkers, spriteLookOf, RIDER_LOOKS_KEPT, RIDER_LOOK_IDLE_MS, RIDER_PIXELS_KEPT } from '../../../src/net/peer/peerRiders.js';
import { layeredSprite, outfitOfItems, LAYERED_ARCHIVE, OUTFIT_SLOTS, CLOAK_SLOTS } from '../../../src/player/eyeOfTheBeholder/layeredArmor.js';
import { createEotbBody } from '../../../src/player/eyeOfTheBeholder/eotbBody.js';
import { playerEntity } from '../../../src/characters/playerEntity.js';
import { equipTableOf } from '../../../src/systems/equip.js';
import { setModSetting, _resetModSettings } from '../../../src/systems/modSettings.js';
import { spriteFor } from '../../../src/player/eyeOfTheBeholder/eotbSprite.js';
import { horseLookCode } from '../../../src/systems/horse/horseCoats.js';

const flush = () => new Promise((r) => setTimeout(r, 0));
/** The outfits the art draws (layeredArmor.js outfitPieces: leather, chain or a plate of seven dyes a piece). */
const PIECES = ['l', 'c', 'p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
const OUTFITS = [];
for (const h of PIECES) for (const t of PIECES) for (const l of PIECES) if (layeredSprite('Move', 0, 0, 4, { gender: 'female', outfit: `${h}${t}${l}` }, false)) OUTFITS.push(`${h}${t}${l}`);
function rig() {
  let now = 0, decodes = 0;
  const uploads = [], evicted = [];
  const art = createEotbArt({
    renderer: { uploadTexture: (a, rec) => uploads.push(`${a}_${rec}`), evictTexture: (k) => evicted.push(k) },
    urlFor: (k) => `u:${k}`, decode: async () => { decodes++; return { width: 4, height: 4, colors: new Uint32Array(16) }; },
    clock: () => now,
  });
  return { art, uploads, evicted, decodes: () => decodes, tick: (ms) => { now += ms; } };
}
/** One outfit's walk: its five facings, four frames each - every sprite a walker in it is drawn with. */
const sprites = (outfit, gender = 'female', mirror = false) => {
  const out = [];
  for (let o = 0; o < 5; o++) for (let f = 0; f < 4; f++) { const s = layeredSprite('Move', o, f, 4, { gender, outfit }, mirror); if (s) out.push(s); }
  return out;
};

test('PEER-ART a sprite\'s look: a horse\'s its coat; a worn-armour walker\'s its body, combo and pieces - every frame and record of one outfit one look, two outfits two; a class sprite none (mutants: the record kept in the look)', () => {
  assert.equal(spriteLookOf({ horse: 'h:2:1:0:3', key: 'x' }), 'h:2:1:0:3');
  assert.ok(OUTFITS.length > RIDER_LOOKS_KEPT * 2, `${OUTFITS.length} outfits drawn`);
  const a = sprites('lll'), b = sprites('ccc');
  assert.ok(a.length > 1 && b.length > 1, 'the producer makes the frames');
  assert.equal(new Set(a.map(spriteLookOf)).size, 1, 'one outfit, one look');
  assert.notEqual(spriteLookOf(a[0]), spriteLookOf(b[0]));
  assert.match(spriteLookOf(a[0]), /^LA:/);
  assert.equal(spriteLookOf({ key: 'FMRM_0-0', archive: 1, rec: 0 }), null, 'a class sprite every player shares stands');
});

// PIN MOVED (AUDIT FB1022d D1): the store lets a look go in its once-a-frame sweep (the riders' settle), so each frame here
// is swept as the world host's is
test('PEER-ART the store lets an outfit go: past RIDER_LOOKS_KEPT outfits, one undrawn RIDER_LOOK_IDLE_MS is evicted - every texture of it - and one drawn now is never (mutants: walkers\' looks unkept)', async () => {
  const r = rig();
  const first = sprites(OUTFITS[0]);
  for (const s of first) r.art.ensure(s);
  r.art.sweep();
  await flush();
  const firstKeys = first.map((s) => `${s.archive}_${s.rec}`);
  assert.deepEqual(r.uploads.slice(0, firstKeys.length), firstKeys);
  for (let i = 1; i <= RIDER_LOOKS_KEPT; i++) { r.tick(RIDER_LOOK_IDLE_MS + 1); for (const s of sprites(OUTFITS[i])) r.art.ensure(s); r.art.sweep(); await flush(); }
  for (const k of firstKeys) assert.ok(r.evicted.includes(k), `${k}: let go`);
  // one drawn every frame is never let go, however many come
  const kept = sprites(OUTFITS[20]);
  const before = r.evicted.length;
  for (let i = 0; i < 30; i++) {
    r.tick(RIDER_LOOK_IDLE_MS + 1);
    for (const s of kept) r.art.ensure(s);
    for (const s of sprites(OUTFITS[i === 20 ? 40 : i], 'female')) r.art.ensure(s);
    r.art.sweep();
    await flush();
  }
  const keptKeys = kept.map((s) => `${s.archive}_${s.rec}`);
  assert.ok(r.evicted.length > before, 'others went');
  for (const k of keptKeys) assert.ok(!r.evicted.includes(k), `${k}: drawn, kept`);
});

test('PEER-ART the store keeps RIDER_PIXELS_KEPT sprites\' pictures, the most recently asked: a mirror asked soon after its sprite shares one decode, asked after a crowd of others decodes again (mutants: every picture kept; the oldest asked kept over the newest)', async () => {
  assert.equal(RIDER_PIXELS_KEPT, 64);
  const r = rig();
  const [s] = sprites(OUTFITS[0]);
  r.art.ensure(s); await flush();
  assert.equal(r.decodes(), 1);
  r.art.ensure({ ...s, rec: `${s.rec}m`, mirror: true }); await flush();
  assert.equal(r.decodes(), 1, 'its mirror, at once: the same pictures');
  // a crowd: more sprites than the store keeps
  let n = 0, last = null;
  for (let i = 1; i < OUTFITS.length && n <= RIDER_PIXELS_KEPT; i++) for (const t of sprites(OUTFITS[i])) { r.art.ensure(t); n++; last = t; }
  await flush();
  assert.ok(n > RIDER_PIXELS_KEPT, `${n} sprites asked`);
  const d = r.decodes();
  r.art.ensure({ ...s, rec: `${s.rec}x` }); await flush();
  assert.equal(r.decodes(), d + 1, 'the first sprite\'s pictures went - decoded again');
  // the newest stays: one asked just now shares its decode
  r.art.ensure({ ...last, rec: `${last.rec}x` }); await flush();
  assert.equal(r.decodes(), d + 1, 'the newest kept');
  // asked again is the most recent: the store full, the first sprite asked once more, then one new - the first stays
  const r2 = rig();
  const crowd = OUTFITS.slice(1).flatMap((o) => sprites(o)).slice(0, RIDER_PIXELS_KEPT - 1);
  r2.art.ensure(s);
  for (const t of crowd) r2.art.ensure(t);
  await flush();
  r2.art.ensure({ ...s, rec: `${s.rec}m` });   // asked again: a mirror, the same pictures
  r2.art.ensure(sprites(OUTFITS.at(-1)).at(-1));   // one new: the store past full
  await flush();
  const d2 = r2.decodes();
  r2.art.ensure({ ...s, rec: `${s.rec}y` }); await flush();
  assert.equal(r2.decodes(), d2, 'the sprite asked again stayed');
  r2.art.ensure({ ...crowd[0], rec: `${crowd[0].rec}y` }); await flush();
  assert.equal(r2.decodes(), d2 + 1, 'the longest unasked went');
  // AUDIT FB1022d D3: the bound itself - a sprite with RIDER_PIXELS_KEPT - 1 asked since shares its decode, one with
  // RIDER_PIXELS_KEPT asked since does not
  const others = OUTFITS.slice(1).flatMap((o) => sprites(o));
  for (const [since, again] of [[RIDER_PIXELS_KEPT - 1, 0], [RIDER_PIXELS_KEPT, 1]]) {
    const r3 = rig();
    r3.art.ensure(s);
    for (const t of others.slice(0, since)) r3.art.ensure(t);
    await flush();
    const d3 = r3.decodes();
    r3.art.ensure({ ...s, rec: `${s.rec}m`, mirror: true }); await flush();
    assert.equal(r3.decodes(), d3 + again, `${since} asked since: ${again ? 'decoded again' : 'shared'}`);
  }
});

test('PEER-ART one cache, two stores: a texture the other store let go under the same key (my own body in the same outfit) is uploaded again, never drawn from nothing - here and in my own body\'s store (mutants: the drawn sprite trusted; my body\'s trusted)', async () => {
  let decodes = 0;
  const textures = new Map(), uploads = [];
  const renderer = { textures, uploadTexture: (a, rec) => { uploads.push(`${a}_${rec}`); textures.set(`${a}_${rec}`, {}); }, evictTexture: (k) => textures.delete(k) };
  const art = createEotbArt({ renderer, urlFor: (k) => `u:${k}`, decode: async () => { decodes++; return { width: 4, height: 4, colors: new Uint32Array(16) }; } });
  const [s] = sprites('lll');
  const key = `${s.archive}_${s.rec}`;
  assert.equal(art.ensure(s), null); await flush();
  assert.deepEqual(art.ensure(s), { w: 4, h: 4 }, 'up');
  textures.delete(key);   // my own body's store let its look go: the renderer's one cache no longer holds it
  assert.equal(art.ensure(s), null, 'not drawn from nothing');
  await flush();
  assert.deepEqual(art.ensure(s), { w: 4, h: 4 });
  assert.deepEqual(uploads, [key, key], 'uploaded again');
  assert.equal(decodes, 1, 'from the pictures it kept');
  // AUDIT FB1022d D3: and a rider's horse look the same (COATS1's dyed pictures, keyed by archive and record alone)
  const horse = spriteFor('IdleHorse', 0, 0, { onHorse: 0, horse: horseLookCode({ coat: 2, pattern: 1, legs: 0, seed: 3 }) });
  const hKey = `${horse.archive}_${horse.rec}`;
  art.ensure(horse); await flush();
  assert.ok(art.ensure(horse) && textures.has(hKey), 'the horse up');
  textures.delete(hKey);
  assert.equal(art.ensure(horse), null, 'a horse let go by the other store: not drawn from nothing');
  await flush();
  assert.ok(art.ensure(horse) && textures.has(hKey), 'uploaded again');
  // my own body's store asks the same (player/eyeOfTheBeholder/eotbBody.js ensure), driven as the world host drives it -
  // in the worn armour (the default) and, AUDIT FB1022d D3, in a class skin (any key: a horse's look is no worn armour)
  for (const layered of [null, 0]) {
    _resetModSettings();
    if (layered != null) setModSetting('eye-of-the-beholder', 'Graphics.LayeredGear', layered);
    const mine = new Map(), up = [];
    const r = { textures: mine, batches: [], uploadTexture(a, rec) { up.push(`${a}_${rec}`); mine.set(`${a}_${rec}`, {}); }, createBillboardBatch(archive, rec, size) { const b = { archive, rec, size, origin: [0, 0, 0] }; this.batches.push(b); return b; }, destroyBillboardBatch() {}, drawBillboards() {} };
    const b = createEotbBody({ count: () => 3035, urlFor: (k2) => `/art/${k2}.png`, decode: async () => ({ width: 4, height: 6, colors: new Uint32Array(24) }) });
    b.attach(r, () => ({}));
    await new Promise((res) => setTimeout(res, 5));
    b.toggle(true, false);
    const still = { motion: { forward: 0, standing: true, speed: 0, grounded: true, height: 1.8 }, feet: [0, 2, 0], yaw: 0, cameraPos: [0, 3.5, -2] };
    const frame = async () => { for (let i = 0; i < 3; i++) b.tick(1 / 60, still); await new Promise((res) => setTimeout(res, 2)); return b.draw(null, { eye: [0, 3.5, -2], feet: [0, 2, 0], yaw: 0 }); };
    let drawnNow = false;
    for (let i = 0; i < 10 && !drawnNow; i++) drawnNow = await frame();
    assert.equal(drawnNow, true, 'my body drawn');
    const drawn = r.batches.at(-1), myKey = `${drawn.archive}_${drawn.rec}`;
    assert.equal(drawn.archive >= 1700 && drawn.archive <= 1701, layered == null, `${myKey}: ${layered == null ? 'worn armour' : 'a class skin'}`);
    const n = up.filter((k) => k === myKey).length;
    assert.ok(n >= 1, 'its frame uploaded');
    mine.delete(myKey);   // the peers' store let a look go under my frame's key
    await frame(); await frame();
    assert.ok(up.filter((k) => k === myKey).length > n, 'my frame uploaded again');
    assert.ok(mine.has(myKey));
  }
  _resetModSettings();
});

/** The crowd's armour as the wire carries it (net/wire.js validLookItem): head, chest and legs pieces, each nothing
 *  (leather), chain or a plate metal - each set a different outfit the female body draws. */
const MATERIALS = [null, 0x0100, 0x0200, 0x0201, 0x0205, 0x0206, 0x0207, 0x0208, 0x0209];
const KITS = new Map();
for (const h of MATERIALS) for (const t of MATERIALS) for (const l of MATERIALS) {
  const items = [[OUTFIT_SLOTS.head, h], [OUTFIT_SLOTS.top, t], [OUTFIT_SLOTS.legs, l]].filter(([, m]) => m != null).map(([equipSlot, material]) => ({ equipSlot, material, group: 'Armor', templateIndex: 102 }));
  const o = outfitOfItems(items);
  if (!KITS.has(o) && layeredSprite('Move', 0, 0, 4, { gender: 'female', outfit: o }, false)) KITS.set(o, items);
}
/** Walkers in their worn armour (LAYERED-GEAR: the look's `lg` 1, the female body), standing in a row. */
const crowd = (kits, tag) => kits.map((items, i) => ({ id: `${tag}${i}`, look: { gender: 'female', lg: 1, items }, shown: { x: i, y: 0, z: 9, yaw: 0, pitch: 0, mv: 0, wd: 0, an: 0, sr: 0, cn: 0, ar: 0 } }));

test('AUDIT FB1022d D1/D3: a crowd of 30 outfits on screen through a 2.5 s hitch - the world host\'s frame (riders, walkers, the riders\' settle) - never lets one go nor decodes one again; one missed the frame after it stands; a crowd gone 2 s goes down to RIDER_LOOKS_KEPT (mutants: the sweep unasked; the last frame unguarded)', async () => {
  assert.ok(KITS.size >= 60, `${KITS.size} outfits`);
  let now = 0, decodes = 0;
  const evicted = [], uploads = [];
  const renderer = { uploadTexture: (a, rec) => uploads.push(`${a}_${rec}`), evictTexture: (k) => evicted.push(k), createBillboardBatch: (archive, record, size) => ({ archive, record, size, origin: null }), destroyBillboardBatch() {} };
  const art = createEotbArt({ renderer, urlFor: (k) => `u:${k}`, decode: async () => { decodes++; return { width: 50, height: 110, colors: new Uint32Array(50 * 110) }; }, clock: () => now });
  const riders = createPeerRiders({ art }), walkers = createPeerWalkers({ art, layeredAll: () => false });
  const toScene = (p) => [p.x, p.y, p.z];
  /** One frame of world.js's peers pass: the riders, the walkers, then the riders' settle. */
  const frame = async (peers, dt = 1 / 60) => {
    now += dt * 1000;
    riders.sync(peers, toScene, { eye: [0, 1, 20], dt });
    walkers.sync(peers, toScene, { eye: [0, 1, 20], dt });
    riders.settle();
    await flush();
  };
  const people = crowd([...KITS.values()].slice(0, 30), 'a');
  for (let i = 0; i < 60; i++) await frame(people);
  assert.equal(people.filter((p) => walkers.isWalking(p.id)).length, 30, 'all 30 drawn');
  const d = decodes, u = uploads.length;
  for (let i = 0; i < 5 * 60; i++) await frame(people);
  await frame(people, 2.5);   // the hitch: a hidden tab, a scene loaded
  for (let i = 0; i < 5 * 60; i++) await frame(people);
  assert.deepEqual([evicted.length, decodes - d, uploads.length - u], [0, 0, 0], 'none let go, none decoded or uploaded again');
  // the hitch's own frame misses one walker (a body stood them, their pose late): back the next frame, still up - undrawn
  // 2.5 s by the clock, but drawn the frame before
  await frame(people.slice(1), 2.5);
  await frame(people);
  assert.deepEqual([evicted.length, decodes - d], [0, 0], 'the one missed one frame stands');
  // two pass by the crowd and go: once undrawn RIDER_LOOK_IDLE_MS, those two go - and not one of the thirty on screen
  const passers = crowd([...KITS.values()].slice(60, 62), 'p');
  for (let i = 0; i < 30; i++) await frame([...people, ...passers]);
  for (let i = 0; i < 3 * 60; i++) await frame(people);
  const passed = new Set(evicted.map((k) => k.split('_')[1]));
  assert.deepEqual([...passed].sort(), [...KITS.keys()].slice(60, 62).sort(), 'the two who passed, alone');
  evicted.length = 0;
  // the crowd gone, five others met: once the old have stood undrawn RIDER_LOOK_IDLE_MS, the store is down to its bound -
  // and not before
  const next = crowd([...KITS.values()].slice(30, 35), 'b');
  for (let i = 0; i < 60; i++) await frame(next);
  assert.equal(evicted.length, 0, 'a second undrawn: all stand');
  for (let i = 0; i < 2 * 60; i++) await frame(next);
  const gone = new Set(evicted.map((k) => k.split('_')[1]));
  assert.equal(gone.size, 30 + 5 - RIDER_LOOKS_KEPT, 'the old crowd\'s outfits past the bound let go');
  assert.ok([...gone].every((code) => [...KITS.keys()].slice(0, 30).includes(code)), 'the old crowd\'s alone - the five on screen stand');
});

test('AUDIT FB1022d D4: my own body\'s armour changed lets the last outfit\'s textures and decoded strips go once the new one is up - never before (my body never drawn from nothing); the frames a cloak\'s outfit shares stand; the skin off lets every outfit go (mutants: the old outfit kept; released before the new is up; the cloak\'s plain frames released; decoded strips kept; in-flight strips put back)', async () => {
  _resetModSettings();
  setModSetting('eye-of-the-beholder', 'Graphics.LayeredGear', 1);   // the female body in the armour worn
  const slots = equipTableOf(playerEntity);
  const saved = { ...slots };
  try {
    for (const k of Object.keys(slots)) delete slots[k];
    const textures = new Map(), evicted = [];
    let decodes = 0;
    const r = { textures, batches: [], uploadTexture(a, rec) { textures.set(`${a}_${rec}`, {}); }, evictTexture(k) { evicted.push(k); textures.delete(k); }, createBillboardBatch(archive, rec, size) { const b = { archive, rec, size, origin: [0, 0, 0] }; this.batches.push(b); return b; }, destroyBillboardBatch() {}, drawBillboards() {} };
    const b = createEotbBody({ count: () => 3035, urlFor: (k) => `/art/${k}.png`, decode: async () => { decodes++; return { width: 4, height: 6, colors: new Uint32Array(24) }; } });
    b.attach(r, () => ({}));
    b.toggle(true, false);
    const still = { motion: { forward: 0, standing: true, speed: 0, grounded: true, height: 1.8 }, feet: [0, 2, 0], yaw: 0, cameraPos: [0, 3.5, -2] };
    const frame = async () => { b.tick(1 / 60, still); const drawn = b.draw(null, { eye: [0, 3.5, -2], feet: [0, 2, 0], yaw: 0 }); await new Promise((res) => setTimeout(res, 2)); return drawn; };
    const drawnRec = () => r.batches.at(-1)?.rec ?? '';
    for (let i = 0; i < 20 && !drawnRec().startsWith('lll_'); i++) await frame();
    assert.match(drawnRec(), /^lll_/, 'in leather');
    const fem = LAYERED_ARCHIVE.female;
    const ofCode = (code) => [...textures.keys()].filter((k) => k.startsWith(`${fem}_${code}_`));
    const plain = ofCode('lll');
    assert.ok(plain.length > 20, `${plain.length} leather frames up (the whole outfit, preloaded)`);
    // a cloak put on: its frames drawn under 'lll~2', the frames with no cloak art still under 'lll' - they stand
    slots[CLOAK_SLOTS[0]] = { templateIndex: 155, dye: 2, group: 'MensClothing' };   // a Formal Cloak, dyed
    assert.equal(b.draw(null, { eye: [0, 3.5, -2], feet: [0, 2, 0], yaw: 0 }), true, 'drawn the frame it changed');
    assert.equal(evicted.length, 0, 'nothing let go before the new outfit is up');
    for (let i = 0; i < 20 && !drawnRec().startsWith('lll~2_'); i++) await frame();
    assert.match(drawnRec(), /^lll~2_/, 'cloaked');
    assert.deepEqual(evicted, [], 'the cloak\'s outfit shares the plain frames: none let go');
    // a plate cuirass: every leather frame and every cloaked one goes, once the plate is up
    delete slots[CLOAK_SLOTS[0]];
    slots[OUTFIT_SLOTS.top] = { templateIndex: 102, material: 0x0201, group: 'Armor' };
    const cloaked = ofCode('lll~2');
    assert.equal(b.draw(null, { eye: [0, 3.5, -2], feet: [0, 2, 0], yaw: 0 }), true, 'the cloak still drawn the frame the plate is asked');
    assert.deepEqual(evicted, [], 'the cloak\'s pictures stand until the plate is up');
    for (let i = 0; i < 20 && !/^lp/.test(drawnRec()); i++) await frame();
    assert.match(drawnRec(), /^lp\d+l_/, 'in the plate');
    for (const k of [...plain, ...cloaked]) assert.ok(evicted.includes(k) && !textures.has(k), `${k}: let go`);
    assert.ok(!evicted.some((k) => /_lp\d+l_/.test(k)), 'the plate stands');
    // the leather again: its strips were let go too - decoded afresh
    const d = decodes;
    delete slots[OUTFIT_SLOTS.top];
    for (let i = 0; i < 20 && !drawnRec().startsWith('lll_'); i++) await frame();
    assert.match(drawnRec(), /^lll_/);
    assert.ok(decodes > d, 'the strips decoded again, not kept for the session');
    // the skin off: the class skin drawn - every outfit's texture goes
    setModSetting('eye-of-the-beholder', 'Graphics.LayeredGear', 0);
    b.ready();   // a lane frame reads the settings first (AUDIT 68 S15)
    for (let i = 0; i < 20 && drawnRec().includes('_') && r.batches.at(-1)?.archive === fem; i++) await frame();
    assert.notEqual(r.batches.at(-1)?.archive, fem, 'the class skin');
    assert.deepEqual([...textures.keys()].filter((k) => k.startsWith(`${fem}_`) || k.startsWith(`${LAYERED_ARCHIVE.male}_`)), [], 'no outfit stands');
  } finally {
    for (const k of Object.keys(slots)) delete slots[k];
    Object.assign(slots, saved);
    _resetModSettings();
  }
});

test('AUDIT FB1022d D4: an outfit let go while its strips are still decoding keeps none of them - a strip that lands after is not put back (mutants: in-flight strips put back)', async () => {
  _resetModSettings();
  setModSetting('eye-of-the-beholder', 'Graphics.LayeredGear', 1);
  const slots = equipTableOf(playerEntity);
  const saved = { ...slots };
  try {
    for (const k of Object.keys(slots)) delete slots[k];
    const held = [], asked = [];
    const img = () => ({ width: 4, height: 6, colors: new Uint32Array(24) });
    // the standing frame decodes at once, every other strip is held: the preload still decoding when the outfit changes
    const leather = (u) => /^\/art\/LA:female:[^:]+:\d+-\d+:lll\.png$/.test(u) && !u.includes(':15-0:');
    const decode = (url) => { asked.push(url); if (url.includes(':15-0:')) return Promise.resolve(img()); return new Promise((res) => held.push({ url, go: () => res(img()) })); };
    const r = { textures: new Map(), batches: [], uploadTexture(a, rec) { this.textures.set(`${a}_${rec}`, {}); }, evictTexture(k) { this.textures.delete(k); }, createBillboardBatch(archive, rec, size) { const b = { archive, rec, size, origin: [0, 0, 0] }; this.batches.push(b); return b; }, destroyBillboardBatch() {}, drawBillboards() {} };
    const b = createEotbBody({ count: () => 3035, urlFor: (k) => `/art/${k}.png`, decode });
    b.attach(r, () => ({}));
    b.toggle(true, false);
    const still = { motion: { forward: 0, standing: true, speed: 0, grounded: true, height: 1.8 }, feet: [0, 2, 0], yaw: 0, cameraPos: [0, 3.5, -2] };
    const frame = async () => { b.tick(1 / 60, still); b.draw(null, { eye: [0, 3.5, -2], feet: [0, 2, 0], yaw: 0 }); await new Promise((res) => setTimeout(res, 2)); };
    const drawnRec = () => r.batches.at(-1)?.rec ?? '';
    for (let i = 0; i < 20 && drawnRec() !== 'lll_15-0'; i++) await frame();
    assert.equal(drawnRec(), 'lll_15-0');
    const leatherHeld = held.filter((h) => leather(h.url)).length;
    assert.ok(leatherHeld > 20, `${leatherHeld} leather strips still decoding`);
    slots[OUTFIT_SLOTS.top] = { templateIndex: 102, material: 0x0201, group: 'Armor' };
    for (let i = 0; i < 20 && !/^lp\d+l_15-0$/.test(drawnRec()); i++) await frame();
    assert.match(drawnRec(), /^lp\d+l_15-0$/, 'the plate up: the leather let go, its strips in flight');
    for (const h of held.splice(0)) h.go();   // the leather's strips land now
    await frame();
    // the plate off, the leather again - and walked in: a walking frame, one that landed after, is decoded afresh
    delete slots[OUTFIT_SLOTS.top];
    for (let i = 0; i < 20 && drawnRec() !== 'lll_15-0'; i++) await frame();
    assert.equal(drawnRec(), 'lll_15-0');
    const walking = { ...still, motion: { forward: 1, standing: false, speed: 3, grounded: true, height: 1.8 } };
    for (let i = 0; i < 30 && /_1\d-/.test(drawnRec()); i++) { b.tick(1 / 60, walking); b.draw(null, { eye: [0, 3.5, -2], feet: [0, 2, 0], yaw: 0 }); await new Promise((res) => setTimeout(res, 2)); for (const h of held.splice(0)) h.go(); }
    const walk = r.batches.at(-1);
    assert.match(walk.rec, /^lll_[0-4]-\d+/, `a walking frame drawn: ${walk.rec}`);
    const url = `/art/LA:female:${asked.find((u) => u.includes(`:${walk.rec.split('_')[1]}:lll.png`)).split(':')[2]}:${walk.rec.split('_')[1]}:lll.png`;
    assert.equal(asked.filter((u) => u === url).length, 2, `${url}: held, let go, decoded again - not put back when it landed`);
  } finally {
    for (const k of Object.keys(slots)) delete slots[k];
    Object.assign(slots, saved);
    _resetModSettings();
  }
});
