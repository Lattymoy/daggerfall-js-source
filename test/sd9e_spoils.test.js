// SD9e (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 11): THE BRASS REMNANT'S SPOILS -
// the roll off the relay's receipt (systems/sdSpoils.js: section 11's table, the Brass of Numidium last), thrown from
// where it fell by the spoils pool under keys of its own (scenes/sdSpoils.js - the court's burst for the arena: its
// moment, its place, kept on the arena's floor over the realm's REAL collider), granted straight into the pack outside
// the realm, said spent to the hub, and the hosts' wiring by source (scenes/world.js, scenes/worldModes.js).
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  rollSdSpoils, sdSpoilsList, rareOrBetter, sdSpoilsDay, sdSpoilsSlot,
  SD_SPOILS_GOLD_PER_LEVEL, SD_SPOILS_LEGENDARY, SD_SPOILS_SOURCE, SD_SPOILS_KEYS, SD_SPOILS_RECORDS_MAX, SD_SPOILS_TEXT,
} from '../src/systems/sdSpoils.js';
import { createSdSpoils, SD_SPEW_AT_MS, SD_RECEIPT_WAIT_MS, SD_SPEW_CHEST, SD_SPEW_LOW_M, SD_SPOILS_KEEP } from '../src/scenes/sdSpoils.js';
import { createSpoilsPool, spoilsList, SPOILS_KEYS, SPOILS_TEXT } from '../src/scenes/spoilsPool.js';
import { RAID_SPOILS_KEYS } from '../src/systems/raidSpoils.js';
import { SERPENT_SPOILS_KEYS } from '../src/systems/serpentSpoils.js';
import { spoilsBase } from '../src/systems/gateSpoils.js';
import { applyRarity, rarityChances, lastPass, techniquePass } from '../src/systems/lootRarity.js';
import { rollNumidiumPiece, NUMIDIUM_SET_CHANCE, AETHERIC } from '../src/systems/aetheric.js';
import { rollHourlock, GILDED_CHANCE, GILDED } from '../src/systems/gilded.js';
import { seededRng } from '../src/systems/wind.js';
import { RANDOM_TREASURE_ICONS, validLootItem } from '../src/systems/loot.js';
import { mintSdReceipt } from '../src/net/sdReceipt.js';
import { createSdFightLink } from '../src/net/sdFightLink.js';
import { validSdOut } from '../src/net/wire.js';
import { newRemnantFight, joinRemnant, remnantStateOf, SD_REM } from '../src/net/sdRemnant.js';
import { SD_ARENA, realmToDungeon } from '../src/net/sdBrain.js';
import { remnantPose } from '../src/scenes/sdRemnant.js';
import { realmColliderTris } from '../src/world/sdRealm.js';
import { Collider } from '../src/player/collider.js';
import { bossCardRoll } from '../src/systems/bossCards.js';   // CARDS9: the Remnant's card, the hoard's last draw

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
const RANK = { common: 0, magic: 1, rare: 2, legendary: 3 };
const T0 = 1_000_000;

// ── the roll ──────────────────────────────────────────────────────────

test('SD9e THE ROLL: section 11\'s table - gold 400 a level, a fifth either way; a first piece Legendary a quarter of the time, else Rare; two Rare or better at a boss past the ladder\'s top tier with a lucky hand; every piece known, wearable and never under Rare; the Brass of Numidium a third of the time, after them; the Hourlock one in fifty, last of all (GILDED1); the same seed the same spoils (mutants: the gold; the share; a Magic piece; the source)', () => {
  assert.deepEqual([SD_SPOILS_GOLD_PER_LEVEL, SD_SPOILS_LEGENDARY, { ...SD_SPOILS_SOURCE }], [400, 0.25, { boss: true, tier: 24, luck: 70 }]);
  let brass = 0, hour = 0, firstLeg = 0;
  const N = 1500;
  for (let seed = 1; seed <= N; seed++) {
    const s = rollSdSpoils(seed * 2654435761, 20);
    assert.ok(s.gold >= 400 * 20 * 0.8 && s.gold <= 400 * 20 * 1.2 && Number.isInteger(s.gold), `seed ${seed}: ${s.gold} gold`);
    const plain = s.pieces.filter((p) => p.tier !== AETHERIC && p.tier !== GILDED);
    assert.equal(plain.length, 3, `seed ${seed}: three pieces`);
    for (const p of plain) {
      assert.ok(RANK[p.tier] >= RANK.rare, `seed ${seed}: ${p.tier}`);
      assert.equal(p.item.isIdentified, true);
      assert.equal(p.item.rarity, p.tier);
    }
    if (plain[0].tier === 'legendary') firstLeg++;
    // (GILDED1) after the three: the Brass when it drops, then the Hourlock when it does - nothing else, in that order
    const after = s.pieces.slice(3), b = after.find((p) => p.tier === AETHERIC), h = after.find((p) => p.tier === GILDED);
    if (b) { brass++; assert.equal(b.item.sigil.set, 'numidium', `seed ${seed}: the Brass's alone`); }
    if (h) { hour++; assert.equal(h.item.gilded, 'the-hourlock', `seed ${seed}: the Hourlock`); assert.equal(after.at(-1), h, `seed ${seed}: the Hourlock after the Brass`); }
    assert.equal(after.length, (b ? 1 : 0) + (h ? 1 : 0), `seed ${seed}: nothing else after the three`);
    assert.ok(s.pieces.slice(0, 3).every((p) => p.tier !== AETHERIC && p.tier !== GILDED), 'the Brass and the Hourlock last, or not at all');
  }
  assert.ok(Math.abs(brass / N - NUMIDIUM_SET_CHANCE) < 0.04, `the Brass ${brass} of ${N}`);
  assert.ok(hour > 0 && Math.abs(hour / N - GILDED_CHANCE) < 0.015, `the Hourlock ${hour} of ${N}`);
  assert.ok(firstLeg / N <= SD_SPOILS_LEGENDARY + 0.03 && firstLeg / N > 0.1, `a first Legendary ${firstLeg} of ${N} (a kind with no record falls to Rare)`);
  assert.deepEqual(JSON.parse(JSON.stringify(rollSdSpoils(77, 9))), JSON.parse(JSON.stringify(rollSdSpoils(77, 9))), 'the same seed, the same spoils');
  assert.equal(rollSdSpoils(77, 0).gold, rollSdSpoils(77, 1).gold, 'a level under 1 is 1');
  assert.deepEqual(JSON.parse(JSON.stringify(rollSdSpoils(77, -3))), JSON.parse(JSON.stringify(rollSdSpoils(77, 1))), 'and below nought');
  // the Rare-or-better ladder: the source's own chances, the Common and Magic cut away
  const c = rarityChances(SD_SPOILS_SOURCE);
  assert.equal(rareOrBetter(() => (c.legendary / c.rare) * 0.999), 'legendary');
  assert.equal(rareOrBetter(() => (c.legendary / c.rare) * 1.001), 'rare');
});

test('SD9e THE ORDER: the roll is its law\'s stream, read in order - the gold, the first piece, the two Rare or better, the ladder\'s last pass, the Brass of Numidium, and the Hourlock LAST (GILDED1), so no roll before it moves (an oracle off the same makers, over 300 seeds; mutants: the Brass before the last pass; the two before the first; the Hourlock before the Brass)', () => {
  const oracle = (seed, level) => {
    const rolls = seededRng(seed >>> 0);
    const gold = Math.round(400 * level * (0.8 + 0.4 * rolls()));
    const g = (item, tier) => { applyRarity(item, tier, rolls); item.isIdentified = true; return { item, tier: item.rarity ?? tier }; };
    const pieces = [g(spoilsBase(level, rolls), rolls() < 0.25 ? 'legendary' : 'rare')];
    for (let i = 0; i < 2; i++) { const ch = rarityChances({ boss: true, tier: 24, luck: 70 }); pieces.push(g(spoilsBase(level, rolls), rolls() * ch.rare < ch.legendary ? 'legendary' : 'rare')); }
    lastPass(pieces.map((p) => p.item), rolls);
    const brass = rollNumidiumPiece(rolls);
    if (brass) pieces.push({ item: brass, tier: brass.rarity });
    const hour = rollHourlock(rolls);
    if (hour) pieces.push({ item: hour, tier: hour.rarity });
    const card = bossCardRoll('abyss', rolls);   // PIN MOVED (CARDS9): the Brass Remnant's own card, one draw after the Hourlock's - last
    techniquePass(pieces.map((p) => p.item), rolls);   // PIN MOVED (TECH1): a weapon's technique, the door's draw after the card's (Loot-II law 9)
    return { gold, pieces, card };
  };
  for (let seed = 1; seed <= 300; seed++) {
    const k = (seed * 40503) >>> 0;
    assert.deepEqual(JSON.parse(JSON.stringify(rollSdSpoils(k, 30))), JSON.parse(JSON.stringify(oracle(k, 30))), `seed ${k}`);
  }
});

test('SD9e THE LIST: the pieces as the pool throws them - each item with its tier, then the gold, each dressed in the treasure flat its own look-stream chooses; every item the loot\'s validator admits off the wire (mutants: the gold first; a piece undressed)', () => {
  for (const seed of [3, 99, 123456, 0xfffffff0]) {
    const s = rollSdSpoils(seed, 12), list = sdSpoilsList(seed, 12);
    // PIN MOVED (CARDS9): the Remnant's card after the pieces, before the gold, when it drops
    assert.deepEqual(list.map((p) => p.kind), [...s.pieces.map(() => 'item'), ...(s.card ? ['item'] : []), 'gold']);
    assert.deepEqual(list.slice(0, -1).map((p) => p.tier), [...s.pieces.map((p) => p.tier), ...(s.card ? ['aetheric'] : [])]);
    if (s.card) assert.equal(list.at(-2).item.card, 'brass-remnant');
    assert.deepEqual(list.at(-1), { kind: 'gold', gold: s.gold, tier: 'common', record: list.at(-1).record });
    const look = seededRng(((seed >>> 0) ^ 0x5eed) >>> 0);
    // PIN MOVED (AUDIT CARDS-6 A8): the look-stream draws the pieces', then the gold's, then the card's LAST - the gold
    // pile's picture what the seed gave it before CARDS9 (test/auditcards6_a.test.js holds every hoard to it)
    const drawn = [...list.filter((p) => p.item?.templateIndex !== 581), ...list.filter((p) => p.item?.templateIndex === 581)];
    for (const p of drawn) assert.equal(p.record, RANDOM_TREASURE_ICONS[Math.floor(look() * RANDOM_TREASURE_ICONS.length)]);
    for (const p of list.slice(0, -1)) assert.ok(validLootItem(JSON.parse(JSON.stringify(p.item))), `seed ${seed}: ${p.item.name} off the wire`);
  }
});

test('SD9e THE KEYS: the Hour\'s spoils keep their own record and spent list - never a boss\'s, a town\'s or a hoard\'s - and an Hour\'s receipt is spent as its slot, read back as it (mutants: the gate\'s keys; a slot misread)', () => {
  const all = [SPOILS_KEYS, RAID_SPOILS_KEYS, SERPENT_SPOILS_KEYS, SD_SPOILS_KEYS];
  assert.equal(new Set(all.map((k) => k.store)).size, 4);
  assert.equal(new Set(all.map((k) => k.day)).size, 4);
  assert.deepEqual({ ...SD_SPOILS_KEYS }, { store: 'sd9.spoils', day: 'sd9.spoilsDay' });
  assert.equal(SD_SPOILS_RECORDS_MAX, 8);
  assert.equal(sdSpoilsDay(42), 'sd:42');
  assert.equal(sdSpoilsSlot(sdSpoilsDay(42)), 42);
  for (const junk of ['sd:0', 'sd:', 'sd:x', 'serpent:4', 42, null, 'sd:1234567890', 'sd:4 ']) assert.equal(sdSpoilsSlot(junk), null, String(junk));
});

// ── the pool ──────────────────────────────────────────────────────────

const memStore = () => { const mem = new Map(); return { get: (k) => (mem.has(k) ? JSON.parse(mem.get(k)) : null), set: (k, v) => mem.set(k, JSON.stringify(v)), remove: (k) => mem.delete(k), mem }; };

test('SD9e THE POOL\'S ROLL: the burst throws the list its `roll` answers - the Hour\'s - and with none the gate\'s, as ever; the pool says its own words gathering (mutants: the roll unread at the burst; the gate\'s words for the Hour\'s)', () => {
  const store = memStore(), said = [];
  const p = createSpoilsPool({ ray: () => null, now: () => 0, take: () => {}, store, who: () => 'c', wall: () => 1, keys: SD_SPOILS_KEYS, gathered: 'The Hour\'s spoils are in your pack.', say: (t) => said.push(t) });
  const list = sdSpoilsList(5, 10);
  assert.equal(p.spew({ day: sdSpoilsDay(3), seed: 5, level: 10, at: [0, 2, 0], bearing: 0, acct: 'acc', roll: () => list }), true);
  assert.deepEqual(p.state().pieces.map((q) => [q.kind, q.tier]), list.map((q) => [q.kind, q.tier]));
  assert.deepEqual(store.get(SD_SPOILS_KEYS.store)[0].pieces.map((q) => q.kind), list.map((q) => q.kind), 'its record the Hour\'s keys\'');
  assert.equal(store.get(SPOILS_KEYS.store), null, 'never the gate\'s');
  p.gather();
  assert.equal(said.at(-1), 'The Hour\'s spoils are in your pack.', 'each piece taken, then its own words');
  const g = createSpoilsPool({ ray: () => null, now: () => 0, take: () => {}, store: memStore(), who: () => 'c', wall: () => 1, say: (t) => said.push(t) });
  g.spew({ day: 9, seed: 5, level: 10, at: [0, 2, 0], bearing: 0, acct: 'acc' });
  assert.deepEqual(g.state().pieces.map((q) => [q.kind, q.tier]), spoilsList(5, 10).map((q) => [q.kind, q.tier]), 'no roll: the gate\'s');
  g.gather();
  assert.equal(said.at(-1), SPOILS_TEXT.gathered);
});

// ── the burst ─────────────────────────────────────────────────────────

/** A fight link for the driver: the real one, fed the realm's words. */
function fight({ me = true } = {}) {
  let clock = T0;
  const L = createSdFightLink({ now: () => clock });
  const f = newRemnantFight(4, 1, T0);
  joinRemnant(f, 'a', 'A', 30, T0);
  L.word(validSdOut({ ...remnantStateOf(f), ...(me ? { me: 1 } : {}) }));
  return { L, f, at: (t) => { clock = t; }, fall: (at, x = 3, z = -4) => { f.rem.x = x; f.rem.z = z; f.fell = { at, top: ['A'], n: 1 }; L.word(validSdOut(remnantStateOf(f))); } };
}
const fakePool = () => { const calls = { spew: [], frame: 0, gather: 0 }; return { calls, spew: (o) => { calls.spew.push(o); return true; }, frame: () => { calls.frame++; }, gather: () => { calls.gather++; return 0; } }; };
const receiptFor = (d, over = {}) => mintSdReceipt({ d, s: 'acct-a', c: 1234, x: 'dealt', l: 7, ...over }, null, { subtle: globalThis.crypto.subtle, nowS: 1_700_000_000 });

test('SD9e THE BURST: SD_SPEW_AT_MS into its fall, my spoils leave the cage of its chest where it fell, toward my feet, kept on the arena\'s floor - the receipt\'s seed and account, the slot\'s spent key, never past the level the fight admitted, the Hour\'s own roll; once a fight, again for the next; never off another slot\'s receipt (mutants: spewed at the fall; twice; another slot\'s; the level unbounded; the gate\'s roll)', async () => {
  const F = fight(), pool = fakePool(), said = [];
  let r = await receiptFor(4);
  const d = createSdSpoils({ link: F.L, pool, slot: () => 4, receipt: (s) => (s === 4 ? r : null), level: () => 30, feet: () => realmToDungeon(SD_ARENA.x, 0, SD_ARENA.z + 10), say: (t) => said.push(t) });
  F.at(T0 + 5000); d.frame();
  assert.equal(pool.calls.spew.length, 0, 'no fall: nothing');
  F.fall(T0 + 10_000);
  F.at(T0 + 10_000 + SD_SPEW_AT_MS - 1); d.frame();
  assert.equal(pool.calls.spew.length, 0, 'not before its moment');
  F.at(T0 + 10_000 + SD_SPEW_AT_MS); d.frame();
  assert.equal(pool.calls.spew.length, 1);
  const o = pool.calls.spew[0];
  const pose = remnantPose(F.L.state(), T0 + 10_000 + SD_SPEW_AT_MS);
  const at = realmToDungeon(SD_ARENA.x + 3, Math.max(SD_SPEW_LOW_M, SD_REM.h * SD_SPEW_CHEST - pose.sink), SD_ARENA.z - 4);
  assert.deepEqual([o.day, o.seed, o.level, o.acct, o.keep], [sdSpoilsDay(4), 1234, 7, 'acct-a', SD_SPOILS_KEEP]);
  assert.deepEqual(o.at.map((v) => +v.toFixed(6)), at.map((v) => +v.toFixed(6)), 'out of its chest, where it fell, as it sinks');
  assert.ok(Math.abs(o.bearing - Math.atan2(0 - 3, 10 + 4)) < 1e-9, 'toward my feet');
  assert.deepEqual(JSON.parse(JSON.stringify(o.roll())), JSON.parse(JSON.stringify(sdSpoilsList(1234, 7))), 'the Hour\'s roll, at the fight\'s level');
  assert.deepEqual(said, [SD_SPOILS_TEXT.spilled]);
  F.at(T0 + 30_000); d.frame(); d.frame();
  assert.equal(pool.calls.spew.length, 1, 'once a fight');
  assert.ok(pool.calls.frame >= 4, 'the pool flies every frame');
  // the next fight's fall spews again; another slot's receipt never
  F.f.fi = 2; F.f.fell = null; F.L.word(validSdOut(remnantStateOf(F.f)));
  r = await receiptFor(5);
  F.fall(T0 + 40_000); F.at(T0 + 40_000 + SD_SPEW_AT_MS); d.frame();
  assert.equal(pool.calls.spew.length, 1, 'another slot\'s receipt: no spoils here');
  r = await receiptFor(4, { c: 99, l: 50 });
  d.frame();
  assert.equal(pool.calls.spew.length, 2, 'the next fight\'s, once its receipt is here');
  assert.deepEqual([pool.calls.spew[1].seed, pool.calls.spew[1].level], [99, 30], 'my level when lower than the fight\'s');
});

test('SD9e NO SPOILS, SAID: a fighter the realm counted in with no receipt SD_RECEIPT_WAIT_MS into the fall is told so once; one it never counted is told nothing; out of the Hour the floor is gathered and the fight forgotten (mutants: said at once; said to a watcher; said twice; never gathered)', () => {
  const F = fight(), pool = fakePool(), said = [];
  const d = createSdSpoils({ link: F.L, pool, slot: () => 4, receipt: () => null, level: () => 30, say: (t) => said.push(t) });
  F.fall(T0 + 10_000);
  F.at(T0 + 10_000 + SD_RECEIPT_WAIT_MS - 1); d.frame();
  assert.deepEqual(said, [], 'not before the receipt could come');
  F.at(T0 + 10_000 + SD_RECEIPT_WAIT_MS); d.frame(); d.frame();
  assert.deepEqual(said, [SD_SPOILS_TEXT.none], 'once');
  d.leave();
  assert.equal(pool.calls.gather, 1, 'leaving gathers the floor');
  assert.deepEqual(d.state(), { spewedFi: 0, saidFi: 0 });
  const W = fight({ me: false }), w = [];
  const dw = createSdSpoils({ link: W.L, pool: fakePool(), slot: () => 4, receipt: () => null, level: () => 30, say: (t) => w.push(t) });
  W.fall(T0 + 10_000); W.at(T0 + 60_000); dw.frame();
  assert.deepEqual(w, [], 'a watcher the realm never counted is told nothing');
  const out = createSdSpoils({ link: F.L, pool: fakePool(), slot: () => null, receipt: () => 'x', level: () => 30, say: (t) => w.push(t) });
  out.frame();
  assert.deepEqual(w, [], 'out of the realm: nothing');
});

test('SD9e ON THE ARENA\'S FLOOR: over the realm\'s REAL collider (its floors and its four brass pillars), every piece thrown from where the Remnant fell - its heart, and the edge of its reach (SD_REM.keep) thrown outward over the void - comes to rest on the arena\'s floor, inside the keep\'s rim (mutants: the keep unread; the rim widened)', () => {
  const c = new Collider();
  const tris = realmColliderTris(); const n = tris.length / 3;
  const idx = new Uint32Array(n); for (let i = 0; i < n; i++) idx[i] = i;
  c.addMesh('sd:realm', tris, idx, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const ray = (from, dir, len) => { const h = c.raycastHit(from, dir, len); return Number.isFinite(h?.dist) ? h : null; };
  const centre = SD_SPOILS_KEEP.centre, K = SD_REM.keep, D = K / Math.SQRT2;
  assert.deepEqual([SD_SPOILS_KEEP.r, SD_SPOILS_KEEP.floorY, centre], [SD_ARENA.r - 2, realmToDungeon(0, 0, 0)[1], realmToDungeon(SD_ARENA.x, 0, SD_ARENA.z)]);
  for (const [x, z, bearing] of [[0, 0, 0.3], [-K, 0, -Math.PI / 2], [K, 0, Math.PI / 2], [0, K, 0], [0, -K, Math.PI], [D, D, Math.PI / 4], [-D, -D, -3 * Math.PI / 4]]) {
    for (let seed = 1; seed <= 3; seed++) {
      const at = realmToDungeon(SD_ARENA.x + x, SD_REM.h * SD_SPEW_CHEST, SD_ARENA.z + z);
      const clock = { t: 100000 };
      const p = createSpoilsPool({ ray, now: () => clock.t, take: () => {}, store: memStore(), who: () => 'c', wall: () => 1, keys: SD_SPOILS_KEYS });
      assert.ok(p.spew({ day: sdSpoilsDay(seed), seed, level: 20, at, bearing, keep: SD_SPOILS_KEEP, roll: () => sdSpoilsList(seed, 20) }));
      for (let t = 0; t < 9000; t += 16) { clock.t += 16; p.frame(); }
      for (const q of p.state().pieces) {
        assert.ok(q.rest, `(${x}, ${z}) seed ${seed}: at rest`);
        assert.ok(Math.abs(q.pos[1] - SD_SPOILS_KEEP.floorY) < 1e-6, `(${x}, ${z}) seed ${seed}: on the floor, ${q.pos[1]}`);
        assert.ok(Math.hypot(q.pos[0] - centre[0], q.pos[2] - centre[2]) <= SD_SPOILS_KEEP.r + 1e-6, `(${x}, ${z}) seed ${seed}: inside the rim`);
      }
    }
  }
});

// ── the host ──────────────────────────────────────────────────────────

test('SD9e THE HOST: world.js keeps the Hour\'s pool under its own keys - the dungeon\'s ray, the pack\'s take, each piece\'s own picture, its words - says a spent receipt to the hub as its slot, keeps my realm\'s receipt for the burst and grants one that came outside it, hands the pool to the saves, the loads and the crash\'s door; the realm stands its pieces to the ray and the press, lights them and draws their lines (mutants: the gate\'s keys; spent unsaid; the burst\'s receipt granted; no crash door; the realm\'s targets unstood)', () => {
  const w = strip(read('src/scenes/world.js'));
  assert.match(w, /const sdSpoilsPool = createSpoilsPool\(\{[\s\S]*?keys: SD_SPOILS_KEYS, recordsMax: SD_SPOILS_RECORDS_MAX,[\s\S]*?\}\);/);
  assert.match(w, /onSpent: \(day\) => \{ const s = sdSpoilsSlot\(day\); return s == null \|\| socialLink\(\)\?\.sendSdSpent\?\.\(s\) === true; \}/);   // AUDIT SD II (L5 F4, PIN MOVED): whether it went - a word that did not is owed
  assert.doesNotMatch(/const sdSpoilsPool = createSpoilsPool\(\{[\s\S]*?\n {2}\}\);/.exec(w)[0], /feet:/, 'the press is its one hand (GATE-UX): no feet');
  assert.match(/const sdSpoilsPool = createSpoilsPool\(\{[\s\S]*?\n {2}\}\);/.exec(w)[0], /take: takeSpoil, [\s\S]*gathered: SD_SPOILS_TEXT\.gathered,/, 'the pack\'s plain take - no embers here - and its own words');
  assert.match(w, /online\.onSdReceipt = \(r, room\) => \{ sdClaims\?\.add\(r\); sdSpoilsReceipt\(r, room\); \};/);
  assert.match(w, /function sdSpoilsReceipt\(r, room\) \{[\s\S]*?if \(modes\?\.sdRealmSlot\?\.\(\) === c\.d\) \{ _sdReceipts\.set\(c\.d, r\); return; \}[\s\S]*?sdSpoilsPool\.grant\(\{ day: sdSpoilsDay\(c\.d\), acct: c\.s, roll: \(\) => sdSpoilsList\(c\.c, level\), text: SD_SPOILS_TEXT\.granted \}\)/);
  assert.match(w, /onSlotSaved\(\(characterId\) => \{ try \{ sdSpoilsPool\.saved\(characterId\); \}/);
  assert.match(w, /recoverSpoils\(_spoilsStore, takeSpoil, \{ who, saves: enumerateSaves\(\)\.info\.values\(\), onHanded: \(rec\) => sdSpoilsPool\.adopt\(rec\), key: SD_SPOILS_KEYS\.store, inSave: _spoilsInSave \}\)/);
  assert.match(w, /sdSpoilsPool\.loaded\(characterId\);/);
  assert.match(w, /sdSpoilsPool\?\.heldIds\?\.\(who\)/);
  assert.match(w, /try \{ sdSpoilsPool\?\.saved\(who, ids\); \}/);
  assert.match(w, /const sdSpoilsBurst = sdFightLink \? createSdSpoils\(\{/);
  assert.match(w, /if \(!inRealm && _sdFightHeld\) \{ sdSpoilsBurst\?\.leave\(\); saveSoon\.changed\(\); \}[^\n]*\n\s*if \(!inRealm && _sdFightHeld\) \{ sdFightLink\.leave\(\);/, 'gathered before the fight is forgotten');   // AUDIT SD II (L5 F5, PIN MOVED): and a checkpoint asked
  assert.match(w, /if \(inRealm\) \{ try \{ sdSpoilsBurst\?\.frame\(\); \}/);
  assert.match(w, /const floorPool = \(\) => \(modes\?\.sdRealmSlot\?\.\(\) != null \? sdSpoilsPool : spoilsPool\);/);
  assert.match(w, /spoilTargets: \(\) => floorPool\(\)\?\.targets\(\) \?\? null,/);
  assert.match(w, /takeSpoil: \(key\) => !!floorPool\(\)\?\.pick\(key\),/);
  const m = strip(read('src/scenes/worldModes.js'));
  assert.match(m, /function standSdRealm\(ctx\) \{[\s\S]*?ctx\.addActivationTargets\(\(\) => \(host\.spoilTargets\?\.\(\) \?\? NO_TARGETS\)\);\n\s*ctx\.addActivationNamer\(\(key\) => \(\(typeof key === 'string' && key\.startsWith\('spoil'\)\) \? host\.spoilName\?\.\(key\) \?\? null : null\)\);\n  \}/);
  assert.match(w, /sdRealmLights: \(\) => \{\s+const lit = sdSpoilsPool\?\.lights\(\) \?\? NO_SD_LIGHTS, fx = [^\n]*;\n[^\n]*\n\s+const hearts = [^\n]*\n\s+if \(!fx\.length && !stone && !hearts\.length\) return lit;\n[^\n]*\n\s+_sdHourLights\.length = 0;\n\s+for \(let i = 0; i < hearts\.length; i\+\+\) _sdHourLights\.push\(hearts\[i\]\);\n\s+for \(let i = 0; i < lit\.length; i\+\+\) _sdHourLights\.push\(lit\[i\]\);/);   // AUDIT SD III (V5, PIN MOVED): the spoils' light first, into one kept list   // SD16 (PIN MOVED): the spoils' light first, the landings' flashes after   // SD-LOOK S7/S8 (PIN MOVED): the arena's reads in the same pass, the sky told the fight, the hearts' lights first
  assert.match(w, /\.\.\.\(gateCourt\?\.batches\(\) \?\? \[\]\), \.\.\.\(sdSpoilsPool\?\.batches\(\) \?\? \[\]\),/);
  assert.match(w, /lines = !!sdSpoilsPool\?\.drawPass\(proj, view, eye, t, fog\); const motes = [^\n]*; const sparks = [^\n]*; const beams = [^\n]*; const beam = [^\n]*; const reads = drawSdArenaReads\(proj, view, fog\); if \(blows \|\| lines \|\| motes \|\| sparks \|\| beam \|\| reads\) renderer\.markForeignPass\(\);/);   // SD14c (PIN MOVED): the Hour's motes in the same pass   // SD16 (PIN MOVED): its sparks   // SD17 (PIN MOVED): the Hour-Hand's beam after the sparks   // SD-LOOK S7/S8 (PIN MOVED): the arena's reads in the same pass, the sky told the fight, the hearts' lights first
  assert.match(m, /realmLightsWith\(_dgLit, host\.sdRealmLights\?\.\(\) \?\? NO_LIGHTS, cam\.pos, host\.sdLampDim\?\.\(\) \?\? null\)/);   // AUDIT SD II (L2 F9 - PIN MOVED): the spoils' light before the lamps, into the realm's own arrays; PIN MOVED (SD-LOOK S7): and the Reset's dimming after the eye
});
