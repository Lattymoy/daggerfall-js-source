// WAGONS2-VISIT (2026-10-09, Mac: "People should be able to use the interior just like houses, like crafting and such";
// asked who may come into a player's caravan online, "Like an online home" - the owner sets private, party, guild or
// public, and visitors cannot take from its storage; they come in "to craft, rest, look around"): a visit to another
// player's caravan, BY EXECUTION over fakes - the law (systems/caravanVisit.js), the room's key (net/privateInterior.js),
// the word (systems/horseCartWire.js, net/wire.js's park record), the cart's pool's rows and target
// (scenes/horseCartPool.js), the door (scenes/caravanRoom.js), the cell's listener (net/caravanVisitLink.js), and the
// hosts' own functions lifted out of their source and run (scenes/world.js, scenes/worldModes.js). The relay's half is
// test/wagons2_visit_relay.test.js.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'acorn';

import {
  caravanEntryCode, caravanEntryOfCode, caravanEntryOf, setDrivenCaravanEntry, caravanMayEnter, caravanGuildTag, CARAVAN_GUILD_CODE,
  caravanDecorDoc, readCaravanDecor, CARAVAN_DECOR_BYTES, CARAVAN_DECOR_V, CARAVAN_VISIT_TEXT,
} from '../src/systems/caravanVisit.js';
import { HOME_ENTRIES } from '../src/net/homeLaw.js';
import { HOME_ENTRY_WORDS, homeNextEntry } from '../src/systems/onlineHomes.js';
import { newWagonItem } from '../src/systems/wagonKinds.js';
import { caravanRoomOf, caravanKeyOf, privateInteriorOf, privateInteriorPrefix, privateInteriorRoom } from '../src/net/privateInterior.js';
import { nativePoseRoom, roomKeyFor } from '../src/net/online.js';
import { parkKeyOf, PARK_KEY_RE, validParkData, PARK_WAGON_ENTRY_MAX, PARK_WAGON_ENTRY_GUILD, MAX_FRAME_BYTES, cellRoomOfWire, PIXEL_UNITS } from '../src/net/wire.js';
import { hccWireRecord, validHccRecord, hccRecordKey, HCC_WIRE_KIND } from '../src/systems/horseCartWire.js';
import { createHorseCartPool, CARAVAN_VISIT_ROW, CARAVAN_ENTRY_ROW, CARAVAN_ENTER_ROW, KEY_WAGON, peerKey } from '../src/scenes/horseCartPool.js';
import { WAGON_MODE, HORSE_MODE } from '../src/systems/horseCartLaw.js';
import { createCaravanAccess, caravanDescriptorAt, caravanTurnOf } from '../src/scenes/caravanRoom.js';
import { createCaravanVisitLink, caravanStands, CARAVAN_STANDS_NATIVES } from '../src/net/caravanVisitLink.js';
import { readCaravanRoom, isCaravanRoom, turnCaravanScene, CARAVAN_TEXT } from '../src/systems/caravanRoom.js';
import { worldCoordToMapPixel } from '../src/world/streamingWorld.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const bakeOf = (kind) => JSON.parse(read(`src/assets/wagons/${kind}.json`));
const flush = async (n = 8) => { for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0)); };
/** A digest lands on WebCrypto's own time (its thread pool, slower under a loaded suite): asked again until it answers. */
const settle = async (f) => { for (let i = 0; i < 1000; i++) { const v = f(); if (v) return v; await new Promise((r) => setTimeout(r, 2)); } return f(); };
const piece = (id, extra = {}) => ({ id, model: 41000, flat: null, pos: [1, 0, 2], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 100, ...extra });

// ─── the hosts' own functions, lifted out of their source (an object's method as an anonymous function, so a method that
//     shares an import's name calls the import) ───────────────────────────────────────────────────────────────────────
const sources = new Map();
function lift(file, name) {
  if (!sources.has(file)) { const src = read(file); sources.set(file, { src, ast: parse(src, { ecmaVersion: 'latest', sourceType: 'module' }) }); }
  const { src, ast } = sources.get(file);
  const walk = (node) => {
    if (!node || typeof node !== 'object') return null;
    if (node.type === 'FunctionDeclaration' && node.id?.name === name) return src.slice(node.start, node.end);
    if (node.type === 'VariableDeclarator' && node.id?.name === name && node.init?.type === 'ArrowFunctionExpression') return src.slice(node.init.start, node.init.end);
    if (node.type === 'Property' && node.key?.name === name && (node.method || node.kind === 'get')) return `${node.value.async ? 'async ' : ''}function ${src.slice(node.value.start, node.value.end)}`;
    for (const v of Object.values(node)) {
      if (Array.isArray(v)) { for (const n of v) { const f = walk(n); if (f) return f; } } else if (v && typeof v === 'object') { const f = walk(v); if (f) return f; }
    }
    return null;
  };
  const found = walk(ast);
  assert.ok(found, `${file} has ${name}`);
  return found;
}

test('WAGONS2-VISIT THE LAW: who may enter is a home\'s four - the owner alone (absent), party, public, guild - the wire\'s codes their places in HOME_ENTRIES, the park record\'s bound the law\'s; a caravan opens as a home\'s door does: anyone when public, the owner\'s party by the relay\'s handles, the owner\'s guild by its tag, nobody when it is the owner\'s alone or names no owner (mutants: the guild opening without its tag, a nameless caravan opening, an entry past the law kept)', () => {
  assert.deepEqual(HOME_ENTRIES.map(caravanEntryCode), [0, 1, 2, 3]);
  assert.deepEqual([0, 1, 2, 3].map(caravanEntryOfCode), HOME_ENTRIES);
  for (const bad of [4, -1, 1.5, '2', null, undefined]) assert.equal(caravanEntryOfCode(bad), 'private', String(bad));
  assert.equal(caravanEntryCode('everyone'), 0, 'an entry the law does not know is the owner alone');
  assert.equal(PARK_WAGON_ENTRY_MAX, HOME_ENTRIES.length - 1, 'the relay\'s bound is the law\'s');
  assert.equal(PARK_WAGON_ENTRY_GUILD, CARAVAN_GUILD_CODE);
  assert.equal(caravanGuildTag('ABC'), 'ABC'); assert.equal(caravanGuildTag('abc'), null); assert.equal(caravanGuildTag('ABCDE'), null);
  const t = (entry, guild = null) => ({ owner: 'Mac', entry, guild });
  assert.equal(caravanMayEnter(t('private'), { partyNames: ['mac'], guild: 'ABC' }), false, 'its owner\'s alone');
  assert.equal(caravanMayEnter(t('public')), true);
  assert.equal(caravanMayEnter(t('party'), { partyNames: ['Ann', 'mac'] }), true, 'the party holds the owner (a handle, read without case)');
  assert.equal(caravanMayEnter(t('party'), { partyNames: ['Ann'] }), false);
  assert.equal(caravanMayEnter(t('guild', 'ABC'), { guild: 'ABC' }), true);
  assert.equal(caravanMayEnter(t('guild', 'ABC'), { guild: 'XYZ' }), false, 'another guild');
  assert.equal(caravanMayEnter(t('guild', 'ABC'), { guild: null }), false, 'no guild');
  assert.equal(caravanMayEnter(t('guild', null), { guild: 'ABC' }), false, 'a guild caravan whose word names no tag opens to nobody');
  assert.equal(caravanMayEnter({ owner: '', entry: 'public' }), false, 'no owner\'s name: no door');
  assert.equal(caravanMayEnter(null), false);
  // the park record keeps it - and nothing past the law
  const W = [2, 1000, 1, 2000, 0, 0, 0, 1, 50, 0];
  assert.deepEqual(validParkData({ c: 'char-ann-0001', a: [1000, 2000], r: { w: W, wk: 2, we: 3, wg: 'ABC' } }).r, { w: W, wk: 2, we: 3, wg: 'ABC' });
  assert.deepEqual(validParkData({ c: 'char-ann-0001', a: [1000, 2000], r: { w: W, wk: 2, we: 1, wg: 'ABC' } }).r, { w: W, wk: 2, we: 1 }, 'a guild\'s tag only with the guild\'s entry');
  assert.deepEqual(validParkData({ c: 'char-ann-0001', a: [1000, 2000], r: { w: W, wk: 2, we: 4 } }).r, { w: W, wk: 2 }, 'an entry past the law is none');
  assert.deepEqual(validParkData({ c: 'char-ann-0001', a: [1000, 2000], r: { w: W, wk: 2, we: 3, wg: 'bad tag' } }).r, { w: W, wk: 2, we: 3 });
});

test('WAGONS2-VISIT THE CARAVAN ITEM: who may enter rides the caravan beside its paint - absent for the owner alone, set on the DRIVEN caravan (its place in the pack taken by its new self), refused on any other wagon and for an entry the law does not know; the owner\'s row turns it round as a home\'s door does (mutants: the field kept for the owner alone, the door set on a cart)', () => {
  const caravan = { ...newWagonItem('caravan'), wagonLook: { o: 1, w: 0, f: 0, c: 0 } };
  const cart = newWagonItem('cart');
  const items = [cart, caravan];
  assert.equal(caravanEntryOf(caravan), 'private');
  assert.equal(setDrivenCaravanEntry(items, 'party'), 'party');
  assert.notEqual(items[1], caravan, 'a new item in its place');
  assert.deepEqual(items[1].wagonLook, caravan.wagonLook, 'its paint kept');
  assert.equal(caravanEntryOf(items[1]), 'party');
  assert.equal(setDrivenCaravanEntry(items, 'everyone'), null);
  assert.equal(setDrivenCaravanEntry(items, 'private'), 'private');
  assert.equal('wagonEntry' in items[1], false, 'the owner alone is no field');
  assert.equal(setDrivenCaravanEntry([cart], 'public'), null, 'a cart has no door');
  assert.equal(caravanEntryOf({ ...cart, wagonEntry: 'public' }), 'private', 'nor reads one');
  assert.equal(caravanEntryOf({ ...caravan, wagonEntry: 'nobody' }), 'private');
  // the row's words are a home's, and its turn a home's
  let e = 'private';
  const seen = [];
  for (let i = 0; i < 4; i++) { e = homeNextEntry(e); seen.push(CARAVAN_VISIT_TEXT.entryRow(HOME_ENTRY_WORDS[e])); }
  assert.deepEqual(seen, ['Who may enter: My party', 'Who may enter: Anyone', 'Who may enter: My guild', 'Who may enter: Only me']);
});

test('WAGONS2-VISIT THE ROOM\'S KEY: `caravan:<k>`, k the owner\'s park key (the key the cell\'s record carries) - one of the private rooms\' family, so its poses are MapsFile\'s (net/online.js nativePoseRoom), and nothing an owned room keyed before (mutant: a caravan\'s room in the scene\'s frame)', async () => {
  const k = await parkKeyOf('acct-ann1', 'char-ann-0001');
  assert.match(k, PARK_KEY_RE);
  assert.equal(caravanRoomOf(k), `caravan:${k}`);
  assert.equal(caravanKeyOf(caravanRoomOf(k)), k);
  for (const bad of ['caravan:xyz', `caravan:${k}0`, `owned:${k}`, null, `caravan:${k.toUpperCase()}`]) assert.equal(caravanKeyOf(bad), null, String(bad));
  assert.equal(caravanRoomOf('nope'), null);
  assert.deepEqual(privateInteriorOf(caravanRoomOf(k)), { caravan: k });
  assert.equal(nativePoseRoom(caravanRoomOf(k)), true, 'a caravan stands at its pose in the world: its room\'s poses are natives');
  const owned = privateInteriorRoom(await privateInteriorPrefix('acct-ann1', 'realm-char'), 77, 9);
  assert.equal(privateInteriorOf(owned).buildingKey, 9, 'an owned room reads as it did');
  assert.equal(nativePoseRoom('town:m1'), false);
});

test('WAGONS2-VISIT THE WORD: `we` names who may enter (absent, the owner alone - every word before it), `wg` the guild\'s tag with the guild\'s alone; the reader folds both into `w`, an older word reads as the owner\'s alone; a changed door is a moved word (mutants: the tag on every entry, the entry unread, a door changed with no word)', () => {
  const view = (entry, guild) => ({ wagon: { kind: HCC_WIRE_KIND.Deployed, position: [1, 2, 3], rotation: [0, 0, 0, 1], tier: 25, angle: 0, model: 'caravan', entry, guild }, horse: null, name: '' });
  const g = hccWireRecord(view('guild', 'ABC'));
  assert.deepEqual([g.we, g.wg], [3, 'ABC']);
  const p = hccWireRecord(view('party', 'ABC'));
  assert.deepEqual([p.we, 'wg' in p], [1, false], 'the guild\'s tag only with the guild\'s entry');
  const o = hccWireRecord(view('private', 'ABC'));
  assert.deepEqual(['we' in o, 'wg' in o], [false, false]);
  assert.deepEqual([validHccRecord(g).w.entry, validHccRecord(g).w.guild], ['guild', 'ABC']);
  assert.deepEqual([validHccRecord(p).w.entry, validHccRecord(p).w.guild], ['party', null]);
  assert.deepEqual([validHccRecord({ w: g.w }).w.entry, validHccRecord({ w: g.w }).w.guild], ['private', null], 'an older word: the owner\'s alone');
  assert.equal(validHccRecord({ ...g, we: 9 }).w.entry, 'private');
  assert.notEqual(hccRecordKey(g), hccRecordKey(p), 'a door turned is news');
  assert.notEqual(hccRecordKey(g), hccRecordKey({ ...g, wg: 'XYZ' }));
});

test('WAGONS2-VISIT THE DOCUMENT: what the owner placed, through the decor law in its order, as the save keeps it (unturned) - a piece the law refuses left out, bounded under the small frame\'s cap; a visitor reads it back and turns it with the caravan as it stands, landing where the owner sees it (mutants: a bad piece published, the document unbounded)', () => {
  const doc = caravanDecorDoc([piece('a'), { id: 'bad id!' }, piece('b', { storage: true }), piece('c', { station: 'forge' })]);
  assert.equal(doc.v, CARAVAN_DECOR_V);
  assert.deepEqual(doc.p.map((x) => x.id), ['a', 'b', 'c']);
  assert.deepEqual(readCaravanDecor(doc).map((x) => [x.id, x.storage, x.station ?? null]), [['a', false, null], ['b', true, null], ['c', false, 'forge']]);
  assert.equal(readCaravanDecor({ v: 9, p: [] }), null); assert.equal(readCaravanDecor(null), null); assert.equal(readCaravanDecor({ v: 1, p: 'x' }), null);
  assert.deepEqual(readCaravanDecor({ v: 1, p: [piece('ok'), { id: 'x' }] }).map((x) => x.id), ['ok'], 'a visitor reads through the same law');
  // bounded: two hundred pieces with long lights do not fit one frame - the first that do go, and the frame fits
  const many = Array.from({ length: 200 }, (_, i) => piece(`piece-${String(i).padStart(4, '0')}-xxxxxxx`, { light: { color: [0.123, 0.456, 0.789], range: 12.34, intensity: 1.23 }, pos: [10.123, 2.456, -3.789], rot: [123.4, -45.6, 78.9], scale: 1.234 }));
  const big = caravanDecorDoc(many);
  assert.ok(big.p.length > 20 && big.p.length < 200, `a prefix: ${big.p.length}`);
  assert.deepEqual(big.p.map((x) => x.id), many.slice(0, big.p.length).map((x) => x.id), 'in their order');
  const frame = JSON.stringify({ t: 'caravan', data: { c: 'x'.repeat(64), d: big } });
  assert.ok(frame.length <= MAX_FRAME_BYTES, `the frame fits the small cap: ${frame.length}`);
  assert.ok(JSON.stringify(big).length <= CARAVAN_DECOR_BYTES);
  // the turn: the owner's caravan stands at 90 degrees, a piece at +x in its room; the save (and the document) keep it
  // unturned; the visitor's caravan stands the same way - the piece lands at +x again
  const room = { decor: [piece('t', { pos: [1, 0, 0], rot: [10, 0, 0] })] };
  const saved = turnCaravanScene(room, 90).decor;
  const back = turnCaravanScene({ decor: readCaravanDecor(caravanDecorDoc(saved)) }, -90).decor[0];
  assert.ok(Math.abs(back.pos[0] - 1) < 1e-3 && Math.abs(back.pos[2]) < 1e-3 && Math.abs(back.rot[0] - 10) < 1e-6, JSON.stringify(back));
});

// ─── the pool: a peer's parked caravan, a visit's target and its row; my own caravan's door row ────────────────────
function fakeRenderer() {
  const r = { textures: new Map(), draws: [] };
  r.uploadTexture = (a, rec, px, o) => { r.textures.set(`${a}_${rec}`, { px, o }); };
  r.createMesh = (model) => ({ model });
  r.drawMesh = (gpu, m) => r.draws.push({ gpu, m: [...m] });
  r.createBillboardBatch = () => ({ origin: [0, 0, 0] });
  r.destroyBillboardBatch = () => {};
  return r;
}
const runtimeOf = (view = {}, state = {}) => ({
  view: () => ({ state: { HorseName: '', HorseMode: 0, ...state }, moving: null, deployed: null, horse: null, teamFollowing: false, horseFollowing: false, persistence: true, ...view }),
  lateUpdate() {}, actionRows: () => [{ id: 1, label: 'Hitch up' }], handleDeployedWagonActivation: () => 'runtime',
});
const QUARTER = [0, Math.SQRT1_2, 0, Math.SQRT1_2];
const CW = (x = 4000, z = 8000) => [2, x, 1, z, ...QUARTER, 50, 0];

test('WAGONS2-VISIT THE POOL: another\'s parked caravan the cell keeps a record of lists "Step inside" where the host\'s law opens it (and only there); its target names the record\'s key, the relay\'s owner name, who may enter, its paint, where its record stands and its door as drawn here (the one door law, turned with it); its press, within the mod\'s reach, goes to the host; a caravan seen only on its owner\'s live word names no room (mutants: the row on every caravan, the reach unread, a caravan with no record opening)', async () => {
  const may = []; const entered = [];
  let open = true;
  const pool = createHorseCartPool({ renderer: fakeRenderer(), meshes: null, collider: () => null, now: () => 0, wagonKind: () => 'cart', bakedWagon: async (k) => bakeOf(k),
    peerName: () => null, visit: { may: (t) => { may.push(t); return open; }, enter: (t) => { entered.push(t); } } });
  pool.attach(runtimeOf());
  const k = 'a'.repeat(24);
  pool.applyKept('world:1,1', { k, id: 'ann1', name: 'Ann', r: { w: CW(), wk: 2, wl: 7, we: 2 } }, (p) => p, 0);
  pool.partsOf('caravan'); await flush();
  pool.frame(0.016, [0, 0, 0]);
  const key = peerKey(`kept:${k}`, 'w');
  const named = pool.hoverName(key);
  assert.equal(named.title, 'Caravan');
  assert.deepEqual(named.actions.map((r) => [r.id, r.label]), [[CARAVAN_VISIT_ROW, CARAVAN_TEXT.enter]]);
  const t = may.at(-1);
  assert.deepEqual([t.k, t.owner, t.entry, t.guild, t.look.o + 6 * t.look.w], [k, 'Ann', 'public', null, 7]);
  assert.deepEqual(t.at, [4000, 1, 8000], 'where the record stands, natives');
  assert.deepEqual(t.position, [4000, 1, 8000]);
  const door = pool.partsOf('caravan').door;
  assert.ok(Math.abs(t.step[0] - (4000 + door.step[2])) < 1e-6 && Math.abs(t.step[2] - (8000 - door.step[0])) < 1e-6, 'its door turned with it (a quarter turn: its back is -x)');
  assert.ok(Math.abs(t.yaw + Math.PI / 2) < 1e-9, 'facing away from it');
  assert.equal(Math.round(caravanTurnOf(t.rotation)), 90);
  // its press: inside the reach to the host; out of it, "too far"
  let far = 0;
  assert.equal(pool.activate(key, 2, null, () => far++, CARAVAN_VISIT_ROW), true);
  pool.activate(key, 9, null, () => far++, CARAVAN_VISIT_ROW);
  assert.deepEqual([entered.length, far], [1, 1]);
  assert.equal(entered[0].k, k);
  // the host's law shut: no row, the plaque as before
  open = false;
  assert.equal(pool.hoverName(key).actions, undefined);
  // a caravan on its owner's live word alone (no record in any held cell): no room to name
  open = true;
  pool.replaceKept('world:1,1', [], (p) => p, 0);
  pool.applyOwner('bob1', { w: CW(6000, 8000), wk: 2, we: 2 }, (p) => p, 0);
  pool.frame(0.016, [0, 0, 0]);
  assert.equal(pool.visitTarget('bob1'), null);
  assert.equal(pool.hoverName(peerKey('bob1', 'w')).actions, undefined);
  // ...and once its cell keeps it, the live peer's own row names the record's key (its owner the relay's stamp, where the
  // session has no name for them)
  pool.applyKept('world:1,1', { k: 'b'.repeat(24), id: 'bob1', name: 'bob-stamp', r: { w: CW(6000, 8000), wk: 2, we: 2 } }, (p) => p, 0);
  assert.deepEqual([pool.visitTarget('bob1').k, pool.visitTarget('bob1').owner], ['b'.repeat(24), 'bob-stamp']);
  // an open wagon is no caravan
  pool.applyKept('world:1,1', { k: 'c'.repeat(24), id: 'cat1', name: 'Cat', r: { w: CW(9000, 8000), wk: 1, we: 2 } }, (p) => p, 0);
  pool.frame(0.016, [0, 0, 0]);
  assert.equal(pool.visitTarget(`kept:${'c'.repeat(24)}`), null);
});

test('WAGONS2-VISIT MY CARAVAN\'S DOOR: my parked caravan\'s plaque lists "Who may enter" after "Step inside" while the host gives a row; its press turns it (within the mod\'s reach) and says the host\'s line; my word carries it - the live `we`/`wg` and the parked record the cell keeps while I am away (mutants: the door\'s word never parked, the row\'s press out of reach)', async () => {
  const said = [];
  let entry = { entry: 'guild', guild: 'ABC' };
  let turned = 0;
  const pool = createHorseCartPool({ renderer: fakeRenderer(), meshes: null, collider: () => null, now: () => 0, wagonKind: () => 'caravan', bakedWagon: async (k) => bakeOf(k),
    enterCaravan: () => {}, wagonEntry: () => entry,
    caravanEntry: { row: () => (entry ? `Who may enter: ${entry.entry}` : null), turn: () => { turned++; return 'Who may enter your caravan: Anyone.'; } } });
  const state = { Mode: WAGON_MODE.Deployed, WorldX: 4000, WorldZ: 8000, HorseMode: HORSE_MODE.None, HorseWorldX: 0, HorseWorldZ: 0 };
  pool.attach(runtimeOf({ deployed: { isGrounded: true, position: [4000, 1, 8000], rotation: [0, 0, 0, 1], cargoTier: 50 } }, state));
  pool.partsOf('caravan'); await flush();
  assert.deepEqual(pool.hoverName(KEY_WAGON).actions.map((r) => r.id), [1, CARAVAN_ENTER_ROW, CARAVAN_ENTRY_ROW]);
  assert.equal(pool.activate(KEY_WAGON, 2, (l) => said.push(l), null, CARAVAN_ENTRY_ROW), true);
  let far = 0;
  pool.activate(KEY_WAGON, 9, (l) => said.push(l), () => far++, CARAVAN_ENTRY_ROW);
  assert.deepEqual([turned, far, said], [1, 1, ['Who may enter your caravan: Anyone.']]);
  const rec = pool.wireRecord();
  assert.deepEqual([rec.we, rec.wg], [3, 'ABC'], 'the live word');
  const parked = pool.parkWord();
  assert.deepEqual([parked.r.we, parked.r.wg], [3, 'ABC'], 'and the record the cell keeps');
  assert.deepEqual(validParkData({ c: 'char-ann-0001', ...parked }).r.we, 3, 'through the relay\'s own door');
  entry = null;   // offline: no row, no word
  assert.deepEqual(pool.hoverName(KEY_WAGON).actions.map((r) => r.id), [1, CARAVAN_ENTER_ROW]);
  assert.equal('we' in pool.wireRecord(), false);
});

test('WAGONS2-VISIT THE DOOR: another\'s caravan is entered by the ONE descriptor law mine is - at its pose, turned with it, out behind its door - as a visit (its room, its owner, its paint, its key and where its record stands handed through); no room, no owner, busy or indoors, no visit (mutant: a visit entered as my own room)', async () => {
  const calls = []; const said = [];
  let mode = 'exterior', busy = false;
  const access = createCaravanAccess({
    available: () => true, mode: () => mode, busy: () => busy, say: (l) => said.push(l), parked: () => null,
    toNative: (p) => p.map((v) => v * 2), fromNative: (p) => p.map((v) => v / 2), ground: (p) => [p[0], 0, p[2]],
    enterInterior: async (...a) => { calls.push(a); return true; },
  });
  const t = { position: [10, 1, 10], rotation: QUARTER, step: [8, 0, 10], yaw: -Math.PI / 2, k: 'a'.repeat(24), owner: 'Ann', look: { o: 0, w: 1, f: 0, c: 0 }, at: [20, 2, 20] };
  assert.equal(await access.visit(t, `caravan:${'a'.repeat(24)}`), true);
  const [room, visit] = calls[0];
  assert.deepEqual(room, caravanDescriptorAt(t, (p) => p.map((v) => v * 2)), 'the one law');
  assert.deepEqual({ ...room, turn: Math.round(room.turn) }, { v: 2, kind: 'caravan', origin: [20, 2, 20], turn: 90, step: [16, 0, 20], yaw: -Math.PI / 2 });
  assert.deepEqual(visit, { privateRoom: `caravan:${'a'.repeat(24)}`, cabinOwner: 'Ann', look: t.look, k: t.k, at: [20, 2, 20] });
  assert.deepEqual(access.returnToWagon(room), { position: [8, 0, 10], yaw: -Math.PI / 2 }, 'out behind its door');
  for (const [tt, r] of [[{ ...t, owner: '' }, 'caravan:x'], [t, ''], [null, 'caravan:x']]) assert.equal(await access.visit(tt, r), false);
  busy = true; assert.equal(await access.visit(t, 'caravan:x'), false); busy = false;
  mode = 'interior'; assert.equal(await access.visit(t, 'caravan:x'), false);
  assert.equal(calls.length, 1);
});

// ─── the cell's listener ───────────────────────────────────────────────────────────────────────────────────────────
function fakeSessions() {
  const sessions = [];
  class Session {
    constructor(o) { this.o = o; this.room = null; this.joins = []; this.left = 0; this.ticks = 0; sessions.push(this); }
    join(room, pose) { this.room = room; this.joins.push([room, pose]); }
    tick() { this.ticks++; }
    leave() { this.left++; this.room = null; }
  }
  return { Session, sessions };
}
const AT = [100 * PIXEL_UNITS + 1000, 1, (499 - 150) * PIXEL_UNITS + 1000];
const CELL = cellRoomOfWire(AT[0], AT[2]);
const recAt = (x = AT[0], z = AT[2], extra = {}) => ({ w: [2, x, 1, z, 0, 0, 0, 1, 50, 0], wk: 2, ...extra });

test('WAGONS2-VISIT THE LISTENER: inside another\'s caravan a second session on my own identity hears its cell - joined with no presence and no pose; the cell\'s record a caravan parked where it stood keeps me in, its paint changed repaints; moved, dropped, missing from the welcome or no longer a caravan is gone - said ONCE, in the host\'s frame, never inside the socket\'s callback, and again while the host cannot take it; my own primary joining that cell (the way out) closes it first (mutants: a move never noticed, gone said twice, gone said in the callback, the listener standing a body)', () => {
  const { Session, sessions } = fakeSessions();
  const gone = [], looks = [];
  let answer = true;
  const link = createCaravanVisitLink({ onGone: () => { gone.push(1); return answer; }, onLook: (l) => looks.push(l), Session });
  const main = { room: `caravan:${'a'.repeat(24)}`, inRoom: () => false, url: 'wss://relay.test/', id: 'vis-0001', secret: 's', name: 'Vis', look: null, mintToken: null, terminal: false };
  const v = { privateRoom: main.room, cabinOwner: 'Ann', k: 'a'.repeat(24), at: AT, look: { o: 0, w: 0, f: 0, c: 0 } };
  link.tick(main, v);
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].o.presence, false, 'a listener stands nobody in the cell');
  assert.deepEqual(sessions[0].joins, [[CELL, null]], 'joined to the caravan\'s cell, with no pose');
  assert.equal(sessions[0].o.id, main.id, 'on my own identity');
  const s = sessions[0];
  s.onParks(CELL, [{ k: 'z'.repeat(24), r: recAt(0, 0) }, { k: v.k, r: recAt() }]);
  s.onPark(CELL, { k: v.k, r: recAt(AT[0] + CARAVAN_STANDS_NATIVES, AT[2]) });   // nudged within the reach: the same caravan
  link.tick(main, v);
  assert.deepEqual(gone, []);
  s.onPark(CELL, { k: v.k, r: recAt(AT[0], AT[2], { wl: 6 }) });
  assert.equal(looks.length, 1, 'painted again'); assert.equal(looks[0].w, 1);
  s.onPark(CELL, { k: 'z'.repeat(24), r: null });   // another's team: nothing of mine
  s.onPark(CELL, { k: v.k, r: recAt(AT[0] + CARAVAN_STANDS_NATIVES + 1, AT[2]) });   // moved
  assert.deepEqual(gone, [], 'never inside the socket\'s callback');
  answer = false;   // the host is walking through a door - asked again
  link.tick(main, v);
  assert.deepEqual(gone, [1]);
  answer = true;
  link.tick(main, v);
  assert.deepEqual(gone, [1, 1]);
  s.onPark(CELL, { k: v.k, r: null });
  link.tick(main, v); link.tick(main, v);
  assert.deepEqual(gone, [1, 1], 'once a visit');
  // the stand law alone
  assert.equal(caravanStands(recAt(), AT), true);
  assert.equal(caravanStands(null, AT), false, 'dropped');
  assert.equal(caravanStands({ w: [1, AT[0], 1, AT[2], 0, 0, 0, 1, 50, 0], wk: 2 }, AT), false, 'towed away');
  assert.equal(caravanStands(recAt(AT[0], AT[2], { wk: 1 }), AT), false, 'no longer a caravan');
  assert.equal(caravanStands(recAt(AT[0], AT[2] - CARAVAN_STANDS_NATIVES - 1), AT), false, 'moved along z');
  // a fresh visit: a welcome without it is gone
  link.close(); assert.equal(s.left, 1);
  link.tick(main, v);
  sessions[1].onParks(CELL, []);
  link.tick(main, v);
  assert.equal(gone.length, 3);
  // the way out: my primary in that very cell closes the listener before it can be replaced by my own id
  link.tick({ ...main, room: CELL }, v);
  assert.equal(sessions[1].left, 1);
  link.tick(main, null);
  assert.equal(sessions.length, 2, 'no visit, no listener');
});

// ─── the world host: the caravan's room, the owner's word to it, a visitor's door ───────────────────────────────────
function worldRoomRig({ caravanOk = true, room = { kind: 'caravan' }, acct = 'acct-ann1', character = 'char-ann-0001', quest = null } = {}) {
  const scope = {
    modes: { caravanRoom: room }, online: { caravanOk }, social: { acct }, playerEntity: {}, characterIdOf: () => character, parkKeyOf, caravanRoomOf, caravanKeyOf,
    chatLinks: new Map([['world', { staffTeleportOk: true }]]), realmSession: { id: 'realm-1' }, privateInteriorPrefix, privateBoatRoom: () => null, privateInteriorRoom,
    _questLoc: () => quest,
  };
  const make = new Function(...Object.keys(scope), `let _caravanKeyFor = null, _caravanKey = null, _privateSource = null, _privatePrefix = null;
    const myCaravanRoom = ${lift('src/scenes/world.js', 'myCaravanRoom')};
    const caravanRoomHere = ${lift('src/scenes/world.js', 'caravanRoomHere')};
    return ${lift('src/scenes/world.js', 'privateRoomHere')};`);
  return { privateRoomHere: make(...Object.values(scope)), scope };
}

test('WAGONS2-VISIT THE KNOWN BUG: inside my caravan online my room is the caravan\'s own - `caravan:<my park key>` - in the wilderness (no town under it: WAGONS2 keyed NO room there) and in a town alike; a visitor\'s is the room the record named; an older relay is asked for none; the online frame keys it and poses it in MapsFile\'s frame, as its visitors do (mutants: the caravan keyed as a town building, the visit\'s room ignored, an older relay asked)', async () => {
  const k = await parkKeyOf('acct-ann1', 'char-ann-0001');
  const wild = worldRoomRig();
  assert.equal(wild.privateRoomHere({ private: true, buildingKey: -2000000001 }), null, 'the key is a digest - nothing until it lands');
  assert.equal(await settle(() => wild.privateRoomHere({ private: true, buildingKey: -2000000001 })), `caravan:${k}`, 'the wilderness: my caravan\'s own room');
  const town = worldRoomRig({ quest: { mapTableData: { mapId: 77 } } });
  assert.equal(await settle(() => town.privateRoomHere({ private: true, buildingKey: -2000000001 })), `caravan:${k}`, 'a town: the same room, never a building of it');
  const visitRoom = `caravan:${'b'.repeat(24)}`;
  assert.equal(town.privateRoomHere({ private: true, privateRoom: visitRoom }), visitRoom, 'a visit: the room its record named');
  assert.equal(worldRoomRig({ caravanOk: false }).privateRoomHere({ private: true, privateRoom: visitRoom }), null, 'an older relay keeps no caravan\'s room');
  const other = worldRoomRig({ acct: 'acct-ann1', character: 'char-ann-0002' });
  assert.equal(await settle(() => other.privateRoomHere({ private: true })), `caravan:${await parkKeyOf('acct-ann1', 'char-ann-0002')}`, 'another character, another caravan');
  // any other private room keeps its own law
  const ship = worldRoomRig({ room: null, quest: { mapTableData: { mapId: 77 } } });
  assert.match(await settle(() => ship.privateRoomHere({ private: true, buildingKey: 9 })), /^owned:[0-9a-f]{32}\.[0-9a-f]{16}:77\.9$/);
  // the online frame: the visitor's key, the pose in MapsFile's frame
  const W = read('src/scenes/world.js');
  const start = W.indexOf("    const mode = modes?.mode ?? 'exterior';   // audit24_wave37");
  const end = W.indexOf('    // ONLINE-MVFLICKER1', start);
  assert.ok(start > -1 && end > start);
  const args = { modes: { mode: 'interior', sailingCabin: null, roomIdentity: () => ({ kind: 'interior', private: true, privateRoom: visitRoom }) },
    state: { compensation: [0, 100, 0], localFromWorld: (x, z) => [x - 500, z - 600], worldCoords: (p) => ({ x: p[0] + 500, z: p[2] + 600 }) },
    player: { pos: [1, -30, 2] }, cam: { yaw: 0.2, pitch: 0.1 }, worldCoordToMapPixel, roomKeyFor, privateInteriorOf,
    _questLoc: () => null, privateRoomHere: town.privateRoomHere, siegeSession: null, royalSession: null, campToWire: (p) => [p[0] + 500, p[1] - 100, p[2] + 600] };
  const route = new Function(...Object.keys(args), `let onlineToScene, sceneToOnline; ${W.slice(start, end)} return { key, pose, onlineToScene };`)(...Object.values(args));
  assert.equal(route.key, visitRoom);
  assert.deepEqual([route.pose.x, route.pose.y, route.pose.z], [501, -130, 602], 'MapsFile\'s frame - the room stands at the caravan\'s pose in the world');
  assert.deepEqual(route.onlineToScene(route.pose), args.player.pos);
});

test('WAGONS2-VISIT THE OWNER\'S WORD TO THE ROOM: standing in my own caravan online, what I placed goes to its room on every welcome and again when it changed - read at most once in its spacing, never the same twice, never from another\'s caravan or at an older relay (mutants: said every frame, said to an older relay)', () => {
  const sent = [];
  let doc = { v: 1, p: [piece('a')] };
  const online = { status: 'open', caravanOk: true, room: `caravan:${'a'.repeat(24)}`, welcomes: 1, sendCaravan: (f) => { sent.push(f); return true; } };
  const scope = { online, modes: { myCaravanDecor: () => doc }, characterIdOf: () => 'char-ann-0001', playerEntity: {}, caravanKeyOf };
  const tick = new Function(...Object.keys(scope), `const CARAVAN_DECOR_MIN_MS = 1500; let _cvSent = null, _cvWelcomes = -1, _cvRoom = null, _cvReadAt = -Infinity;
    return ${lift('src/scenes/world.js', 'caravanDecorTick')};`)(...Object.values(scope));
  tick(0);
  assert.deepEqual(sent, [{ c: 'char-ann-0001', d: doc }], 'the welcome\'s');
  tick(100); tick(2000); tick(4000);
  assert.equal(sent.length, 1, 'unchanged: said once');
  doc = { v: 1, p: [piece('a'), piece('b')] };
  tick(4100);
  assert.equal(sent.length, 1, 'read at most once in its spacing');
  tick(5600);
  assert.equal(sent.length, 2, 'changed: said again');
  online.welcomes = 2;
  tick(5700);
  assert.equal(sent.length, 3, 'a new welcome hears it at once');
  scope.modes.myCaravanDecor = () => null;   // another's caravan (or none): nothing of mine to say
  online.welcomes = 3; tick(9000);
  assert.equal(sent.length, 3);
  scope.modes.myCaravanDecor = () => doc;
  online.caravanOk = false; online.welcomes = 4; tick(12000);
  assert.equal(sent.length, 3, 'an older relay closes the socket on it');
});

test('WAGONS2-VISIT THE VISITOR\'S DOOR, ON THE WORLD HOST: another\'s caravan opens to me only online at a relay that keeps caravans\' rooms, outdoors, and by its owner\'s word read as a home\'s door is (my party\'s handles, my guild\'s tag); pressed shut it says so; open, it goes through the caravan\'s door with the record\'s room (mutants: the door open to whom its owner shut, an older relay\'s visit)', async () => {
  const said = [], visits = [];
  const scope = {
    online: { caravanOk: true, status: 'open' }, modes: { mode: 'exterior' }, caravanMayEnter, myGuildTag: () => 'ABC',
    social: { others: () => [{ name: 'Mac' }, { name: null }] }, caravanRoomOf, townTalk: { say: (l) => said.push(l) }, CARAVAN_VISIT_TEXT,
    caravanRooms: { visit: async (t, room) => { visits.push([t.owner, room]); return true; } },
  };
  const { may, enter } = new Function(...Object.keys(scope), `const caravanVisitMay = ${lift('src/scenes/world.js', 'caravanVisitMay')};
    return { may: caravanVisitMay, enter: ${lift('src/scenes/world.js', 'caravanVisitEnter')} };`)(...Object.values(scope));
  const t = (owner, entry, guild = null) => ({ k: 'a'.repeat(24), owner, entry, guild });
  assert.equal(may(t('mac', 'party')), true, 'my party holds its owner');
  assert.equal(may(t('Zed', 'party')), false);
  assert.equal(may(t('Zed', 'guild', 'ABC')), true, 'my guild');
  assert.equal(may(t('Zed', 'private')), false);
  scope.modes.mode = 'interior'; assert.equal(may(t('Zed', 'public')), false, 'indoors no caravan is stepped into'); scope.modes.mode = 'exterior';
  scope.online.caravanOk = false; assert.equal(may(t('Zed', 'public')), false, 'an older relay keeps no caravan\'s room'); scope.online.caravanOk = true;
  assert.equal(await enter(t('Zed', 'private')), false);
  assert.deepEqual(said, ["This is Zed's caravan. Its door is shut."]);
  assert.equal(await enter(t('Zed', 'public')), true);
  assert.deepEqual(visits, [['Zed', `caravan:${'a'.repeat(24)}`]]);
  assert.equal(await enter({ ...t('Zed', 'public'), k: 'nope' }), false, 'a record\'s key or nothing');
});

// ─── the interior host ────────────────────────────────────────────────────────────────────────────────────────────
test('WAGONS2-VISIT THE INTERIOR HOST\'S DOOR: a visit enters the caravan\'s room through the one transition as a PRIVATE VISIT - its room and owner on the restore (the visitor\'s own scene cache neither read nor kept), the room in its owner\'s paint; a visit naming no caravan\'s room or owner is refused, never my own room; my own entry stays mine (mutants: a visit entered as my own room, its owner\'s paint unread)', async () => {
  const calls = [], painted = [];
  const room = readCaravanRoom({ v: 2, kind: 'caravan', origin: [1, 2, 3], turn: 90, step: [4, 5, 6], yaw: 1 });
  const scope = {
    mode: 'exterior', renderer: {}, caravanKeyOf,
    host: { caravanRoom: { fromNative: (p) => p, look: () => ({ o: 0, w: 5, f: 0, c: 0 }) } },
    caravanRoomEntry: (r, f, o) => { painted.push(o.look); return { hit: { r }, entries: ['e'], building: { b: 1 } }; },
    enterInteriorCore: async (...a) => { calls.push(a); return true; },
  };
  const make = new Function(...Object.keys(scope), `let _caravanVisit = null; const f = ${lift('src/scenes/worldModes.js', 'enterCaravanRoom')}; return { enter: f, visit: () => _caravanVisit };`);
  const h = make(...Object.values(scope));
  const visit = { privateRoom: `caravan:${'a'.repeat(24)}`, cabinOwner: 'Ann', look: { o: 0, w: 1, f: 0, c: 0 }, k: 'a'.repeat(24), at: [1, 2, 3] };
  assert.equal(await h.enter(room, null, visit), true);
  assert.deepEqual(calls[0][2], { building: { b: 1 }, pos: null, privateRoom: visit.privateRoom, cabinOwner: 'Ann' });
  assert.deepEqual(painted[0], visit.look, 'in its owner\'s paint');
  assert.equal(h.visit(), visit);
  assert.equal(await h.enter(room, null, { ...visit, privateRoom: 'owned:x' }), false, 'no caravan\'s room: no visit');
  assert.equal(await h.enter(room, null, { ...visit, cabinOwner: '' }), false);
  assert.equal(calls.length, 1);
  assert.equal(await h.enter(room, [1, 1, 1]), true, 'my own');
  assert.deepEqual(calls[1][2], { building: { b: 1 }, pos: [1, 1, 1] });
  assert.deepEqual(painted.at(-1), { o: 0, w: 5, f: 0, c: 0 }, 'in my own paint');
  assert.equal(h.visit(), null);
});

test('WAGONS2-VISIT THE INTERIOR HOST\'S ROOM: a visitor is a caravan\'s guest only in another\'s caravan; its owner\'s document stands for its guest turned with the caravan as it stands (only from the room it is visiting), the owner\'s own pieces go out unturned and only from their own caravan; a station serves its guest; the caravan gone stands the guest outside, told, unless a door holds the host (mutants: the guest\'s pieces unturned, the owner\'s published turned, a visit\'s pieces published, a station for a stranger)', () => {
  const stood = [], said = [], exits = [];
  const doc = caravanDecorDoc(turnCaravanScene({ decor: [piece('p', { pos: [1, 0, 0], station: 'forge' })] }, 90).decor);
  const room = { v: 2, kind: 'caravan', origin: [0, 0, 0], turn: 90, step: [0, 0, 0], yaw: 0 };
  const scope = {
    mode: 'interior', interiorCtx: {}, interiorCabin: room, privateVisitRoom: `caravan:${'a'.repeat(24)}`, transitioning: false, renderer: {},
    isCaravanRoom, turnCaravanScene, caravanDecorDoc, readCaravanDecor, paintCaravanRoom: () => {}, say: (l) => said.push(l), exitInteriorNow: () => { exits.push(1); return true; },
    interiorDecor: { set: (p) => stood.push(p), list: () => stood.at(-1) ?? [] },
  };
  const make = new Function(...Object.keys(scope), `let _caravanVisit = null;
    const caravanGuestHere = ${lift('src/scenes/worldModes.js', 'caravanGuestHere')};
    const caravanGuestStation = ${lift('src/scenes/worldModes.js', 'caravanGuestStation')};
    return { guest: caravanGuestHere, station: caravanGuestStation, apply: ${lift('src/scenes/worldModes.js', 'applyCaravanDecor')},
      mine: ${lift('src/scenes/worldModes.js', 'myCaravanDecor')}, leave: ${lift('src/scenes/worldModes.js', 'leaveCaravanVisit')} };`);
  // a fresh host per case, the scope's values its closure's
  const host = (over = {}) => make(...Object.values({ ...scope, ...over }));
  const g = host();
  assert.equal(g.guest(), true);
  assert.equal(g.apply(scope.privateVisitRoom, doc), true);
  const p = stood.at(-1)[0];
  assert.ok(Math.abs(p.pos[0] - 1) < 1e-3 && Math.abs(p.pos[2]) < 1e-3, `turned with the caravan as it stands: ${p.pos}`);
  assert.equal(g.apply(`caravan:${'b'.repeat(24)}`, doc), false, 'another room\'s word is not this one\'s');
  assert.equal(g.apply(scope.privateVisitRoom, null), true); assert.deepEqual(stood.at(-1), [], 'none stands nothing');
  g.apply(scope.privateVisitRoom, doc);
  assert.deepEqual(g.station('forge'), { kind: 'home', fee: 0 }, 'its forge serves its guest');
  assert.equal(g.station('loom'), null);
  assert.equal(g.mine(), null, 'a guest publishes nothing');
  // the owner in their own caravan: no guest, no station of a guest's, the pieces out unturned
  const o = host({ privateVisitRoom: null });
  assert.equal(o.guest(), false);
  assert.equal(o.station('forge'), null, 'the owner\'s are the owner\'s own (decorOwnerHere)');
  const out = o.mine();
  assert.deepEqual(out.p[0].pos.map((v) => Math.round(v * 1000) / 1000 + 0), [0, 0, 1], 'unturned: a piece at +x of a caravan turned a quarter is +z of the save');
  assert.deepEqual(out.p[0].pos, doc.p[0].pos, 'as the save keeps it');
  assert.equal(o.apply(scope.privateVisitRoom, doc), false, 'no visit, no other\'s pieces');
  // gone: told and stood outside; a door walking holds it
  assert.equal(host({ transitioning: true }).leave('gone'), false);
  assert.equal(g.leave('gone'), true);
  assert.deepEqual([said, exits], [['gone'], [1]]);
  assert.equal(o.leave('gone'), true, 'nothing to leave'); assert.equal(exits.length, 1);
  // not a caravan at all
  assert.equal(host({ interiorCabin: { uid: 3 } }).guest(), false);
});

test('WAGONS2-VISIT THE INTERIOR HOST, BY SOURCE: its storage is shut to the guest in the owner\'s name (a home\'s words), its stations serve the guest, its bed rests the guest (over a home\'s bed, never under it), every craft\'s station the guest\'s, the caravan\'s visit read only while its room stands, and a save made visiting comes back outside (mutants: the storage refusal unsaid, the stations shut, the bed refused, a visit\'s save restored inside)', () => {
  const wm = read('src/scenes/worldModes.js');
  assert.match(wm, /if \(piece\?\.station\) \{ useDecorStation\(piece\); return; \}[^\n]*\n\s+if \(piece\?\.storage && caravanGuestHere\(\)\) \{ say\(homeBelongsLine\(\{ owner: privateVisitOwner \}\)\); return; \}[^\n]*\n\s+if \(isHallBoard\(piece\)\)/, 'a station serves it (above); its storage is shut in its owner\'s name, before anything else of a storage piece');
  assert.match(wm, /if \(!hallMemberHere\(\)\) \{   \/\/ GUILD1d: a hall's stations are its members'\n\s+if \(interiorHome\) say\(homeBelongsLine\(interiorHome\)\);\n\s+if \(!caravanGuestHere\(\)\) return;/);
  assert.match(wm, /homeBed: homeBedIsMine\(interiorHome, [^\n]*\n\s+\.\.\.\(caravanGuestHere\(\) \? \{ homeBed: true \} : \{\}\),/, 'after the home\'s bed - a later key wins');
  for (const s of ['forge', 'workbench', 'loom', 'mason', 'jeweller', 'alchemy', 'enchant']) assert.match(wm, new RegExp(`station === '${s}'\\)\\) return \\{ kind: 'home', fee: 0 \\};[^\\n]*\\n\\s+return caravanGuestStation\\('${s}'\\);`), s);
  assert.match(wm, /get caravanVisit\(\) \{ return caravanGuestHere\(\) && _caravanVisit\?\.privateRoom === privateVisitRoom \? _caravanVisit : null; \}/);
  assert.match(wm, /if \(saved\?\.caravanRoom && saved\.privateRoom\) return false;[^\n]*\n\s+if \(saved\?\.caravanRoom\) \{\n\s+if \(mode !== 'exterior' \|\| !host\.caravanRoom\?\.canRestore\(saved\.caravanRoom\)\) return false;/);
  // the decorator: no button on a visit - decorOwnerHere's first answer
  assert.match(wm, /function decorOwnerHere\(\) \{\n\s+if \(privateVisitRoom\) return false;/);
});

test('WAGONS2-VISIT THE FOUR HOSTS: world.js wired - the pool\'s three, the caravan\'s door for a visit, the room\'s key, the owner\'s word, the document heard, the listener ticked and closed; worldModes.js the room; exterior.js (the fixed city: no online, no caravan room) and dungeonContext.js (no caravan) FLAGGED - neither names a visit (mutants: the listener never ticked, the document never heard)', () => {
  const w = read('src/scenes/world.js');
  assert.match(w, /wagonEntry: \(\) => caravanEntryWord\(\),/);
  assert.match(w, /caravanEntry: \{ row: \(\) => caravanEntryRow\(\), turn: \(\) => caravanEntryTurn\(\) \},/);
  assert.match(w, /visit: \{ may: \(t\) => caravanVisitMay\(t\), enter: \(t\) => caravanVisitEnter\(t\) \},/);
  assert.match(w, /enterInterior: \(room, visit = null\) => modes\?\.enterCaravanRoom\(room, null, visit\),/);
  assert.match(w, /if \(modes\?\.caravanRoom\) return caravanRoomHere\(identity\);/);
  assert.match(w, /online\.onCaravan = \(room, doc\) => modes\?\.applyCaravanDecor\?\.\(room, doc\);/);
  assert.match(w, /overworldLedgerFrame\(now\);[^\n]*\n\s+caravanDecorTick\(now\);[^\n]*\n\s+caravanVisitLink\.tick\(key \? online : null, modes\?\.caravanVisit \?\? null\);/, 'every frame, after my primary\'s own join and tick');
  assert.match(w, /if \(!modes\?\.caravanVisit\) caravanVisitLink\.close\(\);[^\n]*\n\s+if \(!key\) \{ if \(online\.room\) online\.leave\(\); \}/, 'no visit: closed before my primary joins the cell it heard');
  assert.match(w, /caravanVisitLink\.close\(\);[^\n]*\n\s+seatLock\?\.release\(\);/, 'and with the seat (test/oneseat.test.js runs it)');
  assert.match(w, /globalThis\.addEventListener\?\.\('pagehide', \(\) => caravanVisitLink\.close\(\)\);/, 'and with the page');
  assert.equal((w.match(/caravanVisitLink\.close\(\)/g) ?? []).length, 3, 'the frame, the seat lost, the page\'s going');
  for (const host of ['exterior', 'dungeonContext']) assert.doesNotMatch(read(`src/scenes/${host}.js`), /caravanVisit|caravanRoom|CARAVAN_VISIT/, `${host}.js names no visit`);
});
