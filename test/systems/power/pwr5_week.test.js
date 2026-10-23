// PWR5 (2026-10-23, bible/05-Combat/Power-Arc.md section 8; Mac, asked: "Weekly per boss" - "each boss rolls
// Legendary-and-up, set and Gilded pieces for an account once an arena week; repeat kills still pay gold, Marks and
// Embers (the Elite Gates' weekly law the template)"): THE WEEK'S FINEST. The law (net/bossWeek.js), the service's
// claims over the real migrations and routes (the gate's, the Hour's, the serpent's), the Lost and Found's refusal, the
// claims' carriers, the host's grants (scenes/bossSpoilsHost.js) and every door by source.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { standService, T0 } from '../../accountDb.mjs';
import { hostText } from '../../hostText.mjs';
import { mintReceipt, importReceiptKey } from '../../../src/net/gate/gateReceipt.js';
import { mintSdReceipt } from '../../../src/net/superDungeon/sdReceipt.js';
import { mintSerpentReceipt } from '../../../src/net/serpent/serpentReceipt.js';
import { serpentBossById } from '../../../src/net/serpent/serpentLaw.js';
import { arenaWeekOf, ARENA_WEEK_S, ARENA_SEASON_EPOCH_S } from '../../../src/net/arena/arenaLaw.js';
import { egSpoilsSeed } from '../../../src/net/eliteGates/egPay.js';
import {
  BOSS_TOP_RARITIES, isTopPiece, bossWeekKey, bossWeekOf, bossWeekRef, bossTopSeed, weekBase, weekTop, bossTopDay, isBossTopDay,
  bossWeekDevice, BOSS_WEEK_DEVICE_KEY, BOSS_WEEK_CID_RE,
} from '../../../src/net/bossWeek.js';
import { RARITY_ORDER, RARITIES } from '../../../src/systems/loot/lootRarity.js';
import { spoilsList, createSpoilsPool } from '../../../src/scenes/spoilsPool.js';
import { sdSpoilsList, sdSpoilsDay } from '../../../src/systems/superDungeon/sdSpoils.js';
import { serpentSpoilsList, serpentSpoilsDay } from '../../../src/systems/serpent/serpentSpoils.js';
import { isSigilStone } from '../../../src/systems/gate/gateSpoils.js';
import { createBossSpoils, BOSS_WEEK_TEXT } from '../../../src/scenes/bossSpoilsHost.js';
import { createGateClaims } from '../../../src/net/gate/gateClaims.js';
import { createSdClaims } from '../../../src/net/superDungeon/sdClaims.js';
import { playerEntity } from '../../../src/characters/playerEntity.js';
import { mintHourlock } from '../../../src/systems/gilded.js';
import { setPref } from '../../../src/systems/uiPrefs.js';

const { subtle } = globalThis.crypto;
const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const realNow = Date.now;
let _now = T0;
const clock = (s) => { _now = s; Date.now = () => _now * 1000; };
test.after(() => { Date.now = realNow; });
setPref('lootRarity', true);
/** The first seed from `from` whose list rolls a piece of the week's finest. */
const seedWithTop = (roll, from = 1) => { for (let s = from; s < from + 5000; s++) if (weekTop(roll(s)).length) return s; throw new Error('no seed'); };
const WEEK0 = arenaWeekOf(T0), NEXT = ARENA_SEASON_EPOCH_S + (WEEK0 + 1) * ARENA_WEEK_S + 600;
const WD = '0123456789abcdef', WD2 = 'fedcba9876543210';

test('PWR5 THE WEEK\'S FINEST, THE LAW: Legendary\'s rank and over by the item\'s own rarity - never an ember\'s or a card\'s glow; every list a receipt rolls parts into its floor and its finest; the week the kill\'s, the kill its kind\'s own row; the second roll on the claim\'s own draw (mutants: a Rare counted; the glow read; the week the claim\'s; the seed the receipt\'s)', () => {
  assert.deepEqual(BOSS_TOP_RARITIES, RARITY_ORDER.filter((r) => RARITIES[r].rank >= RARITIES.legendary.rank), 'pinned equal');
  assert.deepEqual(['common', 'magic', 'rare', 'legendary', 'aetheric', 'artifact', 'gilded'].map((rarity) => isTopPiece({ rarity })), [false, false, false, true, true, true, true]);
  assert.equal(isTopPiece(mintHourlock()), true, 'a Gilded');
  assert.equal(isTopPiece(null), false);
  const lists = [(s) => spoilsList(s, 30, { b: 'ruhn', d: 1 }), (s) => sdSpoilsList(s, 30), (s) => serpentSpoilsList(s, 30, 'dealt')];
  let tops = 0, embers = 0, cards = 0;
  for (const roll of lists) {
    for (let s = 1; s <= 120; s++) {
      const L = roll(s), base = weekBase(L), top = weekTop(L);
      assert.equal(base.length + top.length, L.length, 'a partition');
      assert.ok(base.every((p) => !isTopPiece(p.item)) && top.every((p) => isTopPiece(p.item)));
      tops += top.length;
      embers += base.filter((p) => p.kind === 'item' && isSigilStone(p.item)).length;
      cards += base.filter((p) => p.tier === 'aetheric' && !p.item?.rarity).length;
    }
  }
  assert.ok(tops > 0 && embers > 0 && cards > 0, `the finest rolled (${tops}), and every ember (${embers}) and card (${cards}) a floor's`);
  assert.deepEqual([bossWeekKey('gate', { b: 'ruhn' }), bossWeekKey('sd', { b: 'remnant' }), bossWeekKey('serpent', { b: 'sethrakul' }), bossWeekKey('raid', { b: 'x' }), bossWeekKey('gate', {})], ['gate:ruhn', 'sd:remnant', 'serpent:sethrakul', null, null]);
  assert.equal(bossWeekOf({ i: T0 }), arenaWeekOf(T0), 'the receipt\'s issue time');
  assert.equal(bossWeekRef({ d: 700 }), '700');
  const n1 = '00000000deadbeef', n2 = '00000000deadbeee';
  assert.equal(bossTopSeed(4242, n1), bossTopSeed(4242, n1), 'deterministic');
  assert.notEqual(bossTopSeed(4242, n1), bossTopSeed(4242, n2), 'the draw moves it');
  assert.notEqual(bossTopSeed(4242, n1), egSpoilsSeed(4242, n1), 'never the Elite Breach\'s own stream');
  assert.notEqual(bossTopSeed(4242, n1), 4242, 'never the receipt\'s');
  assert.equal(bossTopDay(700), 'top:700');
  assert.deepEqual([isBossTopDay('top:sd:3'), isBossTopDay(700), isBossTopDay('sd:3')], [true, false, false]);
  const mem = new Map(), storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  const k = bossWeekDevice(storage);
  assert.match(k, BOSS_WEEK_CID_RE);
  assert.deepEqual([bossWeekDevice(storage), mem.get(BOSS_WEEK_DEVICE_KEY)], [k, k], 'kept on the device');
  assert.equal(bossWeekDevice(null), bossWeekDevice(null), 'the session\'s own where nothing keeps it');
});

test('PWR5 THE SERVICE, THE GATE: the first kill of the week claimed from a device takes the week - answered `top` with its seed, asked again the same; another kill that week, or that kill from another device, not - and still paid its embers and Marks; a receipt held past Monday is its own week\'s; the next week\'s kill takes the next; a claim naming no device neither takes it nor is answered it; a guest never (mutants: the week unwritten; the device unread; the ref unread; the week the claim\'s)', async () => {
  clock(T0);
  const svc = await standService({ MARKS_OPEN: 'on' });
  const raw = svc.env.DB._raw;
  const A = await svc.registered('Wanda');
  const gate = async (who, d, iS, wd) => { if (iS > _now) clock(iS); return svc.call('/v1/gate/claim', { receipt: await mintReceipt({ d, b: 'ruhn', s: who.id, c: 4242, x: 'dealt' }, svc.gatePriv, { subtle, nowS: iS }), ...(wd ? { wd } : {}) }, who.secret); };
  const k1 = (await gate(A, 700, T0, WD)).body;
  assert.deepEqual([k1.recorded, k1.top, Number.isSafeInteger(k1.topSeed)], [true, true, true], 'the week\'s first');
  const again = (await gate(A, 700, T0, WD)).body;
  assert.deepEqual([again.recorded, again.why, again.top, again.topSeed], [false, 'claimed', true, k1.topSeed], 'asked again: the same week, the same seed');
  assert.equal((await gate(A, 700, T0, WD2)).body.top, false, 'that kill from another device');
  const k2 = (await gate(A, 701, T0 + 60, WD)).body;
  assert.deepEqual([k2.recorded, k2.top, k2.stones], [true, false, 1], 'another kill that week: no finest - its ember still');
  assert.ok(k2.marks, 'and its Marks');
  const none = (await gate(A, 702, T0 + 120)).body;
  assert.deepEqual([none.recorded, 'top' in none], [true, false], 'no device: no week asked');
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM boss_weeks').get().n, 1);
  clock(NEXT);
  assert.equal((await gate(A, 703, T0 + 180, WD)).body.top, false, 'a receipt of the full week, claimed after Monday: still that week\'s');
  const k4 = (await gate(A, 704, NEXT, WD)).body;
  assert.deepEqual([k4.recorded, k4.top], [true, true], 'the next week\'s first');
  assert.notEqual(k4.topSeed, k1.topSeed);
  assert.deepEqual(raw.prepare('SELECT boss, wk, ref, cid FROM boss_weeks ORDER BY wk').all().map((r) => ({ ...r })), [
    { boss: 'gate:ruhn', wk: WEEK0, ref: '700', cid: WD }, { boss: 'gate:ruhn', wk: WEEK0 + 1, ref: '704', cid: WD },
  ]);
  clock(T0);
  const g = await svc.guest();
  const gb = (await gate(g, 700, T0, WD)).body;
  assert.deepEqual([gb.why, 'top' in gb], ['guest', false], 'a guest holds no week');
  const sql = rd('server-account/migrations/0165_boss_weeks.sql');
  assert.match(sql, /PRIMARY KEY \(account, boss, wk\)/);
  assert.match(sql, /FOREIGN KEY \(account\) REFERENCES players\(id\) ON DELETE CASCADE/);
});

test('PWR5 THE SERVICE, THE HOUR AND THE SERPENT: the Brass Remnant\'s first slot of the week takes it, the next not; the serpent\'s week goes with its hoard - the device given the hoard, the week\'s first day - and a hoard another device holds answers no week at all (mutants: the Hour\'s week unwritten; the serpent\'s week by another cid)', async () => {
  clock(T0);
  const svc = await standService({ MARKS_OPEN: 'on' });
  const CH = 'char-0001';
  const A = await svc.registered('Hanna', { character: CH });
  const sd = async (slot, wd) => (await svc.call('/v1/sd/claim', { receipt: await mintSdReceipt({ d: slot, s: A.id, c: 77, x: 'dealt', l: 20 }, svc.gatePriv, { subtle, nowS: T0 }), ...(wd ? { wd } : {}) }, A.secret)).body;
  const h1 = await sd(11, WD);
  assert.deepEqual([h1.recorded, h1.top, Number.isSafeInteger(h1.topSeed)], [true, true, true]);
  assert.deepEqual([(await sd(11, WD)).top, (await sd(12, WD)).top], [true, false], 'the same slot asked again; the next slot');
  const serpent = async (day, cid) => (await svc.call('/v1/serpent/claim', { receipt: await mintSerpentReceipt({ d: day, b: 'sethrakul', s: A.id, c: 99, x: 'dealt', h: 4, l: 20 }, svc.gatePriv, { subtle, nowS: T0 }), character: CH, name: A.handle, stones: 1, cid }, A.secret)).body;
  const s1 = await serpent(363, WD);
  assert.deepEqual([s1.recorded, s1.spoils, s1.top, Number.isSafeInteger(s1.topSeed)], [true, true, true, true]);
  const other = await serpent(363, WD2);
  assert.deepEqual([other.spoils, 'top' in other], [false, false], 'its hoard is another device\'s: no week said');
  const s2 = await serpent(365, WD);
  assert.deepEqual([s2.recorded, s2.spoils, s2.top], [true, true, false], 'the next serpent that week: its hoard, not the finest');
});

test('PWR5 THE LOST AND FOUND TAKES NO FINEST FROM A FLOOR UNDER THE WEEK\'S LAW: a Warden\'s floor of a week the law holds never held one (they go into the pack), so one asked for is refused - its other leftovers mailed; a kill from before the law\'s week is mailed as it was (mutants: the refusal unasked; the week unread)', async () => {
  clock(T0);
  const svc = await standService({ MARKS_OPEN: 'on' });
  const A = await svc.registered('Lona'), B = await svc.registered('Mabe');
  assert.equal((await svc.call('/v1/gate/claim', { receipt: await mintReceipt({ d: 710, b: 'ruhn', s: A.id, c: 4242, x: 'dealt' }, svc.gatePriv, { subtle, nowS: T0 }), wd: WD }, A.secret)).body.recorded, true);
  const plain = weekBase(spoilsList(4242, 20)).map((p, i) => ({ i, p })).filter(({ p }) => p.kind === 'item').map(({ i, p }) => ({ i, item: JSON.parse(JSON.stringify(p.item)) }));
  const lost = (who, body) => svc.call('/v1/post/lost', body, who.secret);
  assert.equal((await lost(A, { day: 710, pieces: [{ i: 30, item: mintHourlock() }] })).body.error, 'lost-item', 'a Gilded from a floor that never held one');
  assert.equal((await lost(A, { day: 710, pieces: plain.slice(0, 1) })).body.ok, true, 'a floor\'s own leftover');
  svc.env.DB._raw.prepare("INSERT INTO gate_kills (day, account, boss, earned, at, stones) VALUES (?, ?, 'ruhn', 'dealt', ?, 1)").run(711, B.id, T0);
  assert.equal((await lost(B, { day: 711, pieces: [{ i: 30, item: mintHourlock() }] })).body.ok, true, 'a kill no week\'s row holds: as it was');
});

test('PWR5 THE CARRIERS: the gate\'s claims hand the host every answer that says the week - counted now, or asked again - and say the line it answers; a grant that fails keeps the receipt to be asked again (mutants: the hook unheard; the receipt let go on a failed grant)', async () => {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const key = await importReceiptKey(Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64'), { subtle });
  const r = await mintReceipt({ d: 720, b: 'ruhn', s: 'acct-a', c: 1, x: 'dealt' }, key, { subtle, nowS: T0 });
  const mem = new Map(), store = { get: (k) => mem.get(k), set: (k, v) => mem.set(k, v) };
  const said = [], heard = [];
  let answer = { ok: true, data: { recorded: true, closed: 1, top: false } }, fail = false;
  const q = createGateClaims({ claim: async () => answer, store, nowS: () => T0, me: () => 'acct-a', say: (t) => said.push(t),
    onWeek: async (rr, data) => { heard.push([rr, data.top]); if (fail) throw new Error('no lock'); return 'the week is taken'; } });
  const settle = async () => { for (let i = 0; i < 20; i++) await new Promise((res) => setImmediate(res)); };   // the carrier's flushes, run out
  fail = true;
  q.add(r); await settle();
  assert.deepEqual(heard, [[r, false]]);
  assert.equal(q.kept().length, 1, 'a failed grant: the receipt kept');
  fail = false;
  answer = { ok: true, data: { recorded: false, why: 'claimed', closed: 1, top: false } };
  await q.flush(); await settle();
  assert.deepEqual(heard.at(-1), [r, false], 'asked again: heard again');
  assert.ok(said.includes('the week is taken'), 'its line said');
  assert.equal(q.kept().length, 0, 'given: let go');
  // the Hour's carrier, the same law
  const hr = await mintSdReceipt({ d: 21, s: 'acct-a', c: 5, x: 'dealt', l: 20 }, key, { subtle, nowS: T0 });
  const hm = new Map(), hs = [], hh = [];
  let hfail = true;
  const hq = createSdClaims({ claim: async () => ({ ok: true, data: { recorded: true, slot: 21, broken: 1, top: true, topSeed: 9 } }), store: { get: (k) => hm.get(k), set: (k, v) => hm.set(k, v) }, nowS: () => T0, me: () => 'acct-a', say: (t) => hs.push(t),
    onWeek: async (rr, data) => { hh.push(data.topSeed); if (hfail) throw new Error('no lock'); return null; } });
  hq.add(hr); await settle();
  assert.deepEqual([hh, hq.kept().length], [[9], 1], 'the Hour\'s: heard, and kept on a failed grant');
  hfail = false;
  await hq.flush(); await settle();
  assert.deepEqual([hh, hq.kept().length], [[9, 9], 0]);
});

test('PWR5 THE HOST\'S GRANTS: a kill whose week is its own rolls again on the claim\'s seed and gives its finest alone, under the pool\'s own key for them; the week taken says so, once, for a kill counted now; the rite rolls none; the serpent\'s hoard comes without its finest, then the week\'s (mutants: the finest given whole; the base given whole; the key the receipt\'s; the line said on a claim asked again)', async () => {
  const calls = { gate: [], sd: [], serpent: [] }, notes = [];
  const fake = (k) => ({ grant: (o) => { calls[k].push(o); return true; } });
  const H = createBossSpoils({ spoilsPool: fake('gate'), sdSpoilsPool: fake('sd'), serpentSpoils: fake('serpent'), raidSpoils: null, get modes() { return null; }, get chatNotice() { return (t) => notes.push(t); } });
  const was = playerEntity.level;
  playerEntity.level = 30;
  try {
    const seed = seedWithTop((s) => spoilsList(s, 30, { b: 'ruhn', d: 730, s: 'acct-a', c: 1, x: 'dealt', l: 30 }));
    const r = await mintReceipt({ d: 730, b: 'ruhn', s: 'acct-a', c: 1, x: 'dealt', l: 30 }, null, { subtle, nowS: T0 });
    assert.equal(await H.gateWeek(r, { recorded: true, top: true, topSeed: seed }), null);
    assert.equal(calls.gate.length, 1);
    const g = calls.gate[0];
    assert.deepEqual([g.day, g.acct], [bossTopDay(730), 'acct-a'], 'its own key, beside the receipt\'s');
    const want = weekTop(spoilsList(seed, 30, { d: 730, b: 'ruhn', s: 'acct-a', c: 1, x: 'dealt', l: 30 }));
    assert.deepEqual(JSON.parse(JSON.stringify(g.roll())), JSON.parse(JSON.stringify(want)), 'the finest of the claim\'s roll, alone');
    assert.ok(g.roll().length > 0 && g.roll().every((p) => isTopPiece(p.item)));
    assert.equal(g.text, BOSS_WEEK_TEXT.granted('Valkynaz Ruhn'));
    assert.equal(await H.gateWeek(r, { recorded: true, top: false }), BOSS_WEEK_TEXT.taken('Valkynaz Ruhn'), 'the week taken: said');
    assert.equal(await H.gateWeek(r, { recorded: false, why: 'claimed', top: false }), null, 'asked again: not said again');
    const rite = await mintReceipt({ d: 731, b: 'ruhn', s: 'acct-a', c: 1, x: 'rite' }, null, { subtle, nowS: T0 });
    assert.equal(H.gateWeek(rite, { recorded: true, top: true, topSeed: seed }), null, 'the rite rolls no piece');
    // the Hour's
    const hs = seedWithTop((s) => sdSpoilsList(s, 20));
    const hr = await mintSdReceipt({ d: 9, s: 'acct-a', c: 5, x: 'dealt', l: 20 }, null, { subtle, nowS: T0 });
    await H.sdWeek(hr, { recorded: true, top: true, topSeed: hs });
    assert.deepEqual([calls.sd[0].day, calls.sd[0].roll().length], [bossTopDay(sdSpoilsDay(9)), weekTop(sdSpoilsList(hs, 20)).length]);
    // the serpent's: the hoard without its finest, then the week's
    const ss = seedWithTop((s) => serpentSpoilsList(s, 20, 'dealt'));
    const base = seedWithTop((s) => serpentSpoilsList(s, 20, 'dealt'), ss + 1);
    const sr = await mintSerpentReceipt({ d: 363, b: 'sethrakul', s: 'acct-a', c: base, x: 'dealt', h: 4, l: 20 }, null, { subtle, nowS: T0 });
    await H.grantSerpentSpoils({ r: sr, ch: 'char-x', nm: 'Ann', lv: 20, cid: WD }, { recorded: true, spoils: true, top: true, topSeed: ss });
    assert.equal(calls.serpent.length, 2);
    assert.deepEqual([calls.serpent[0].day, calls.serpent[1].day, calls.serpent[1].owner], [serpentSpoilsDay(363), bossTopDay(serpentSpoilsDay(363)), 'char-x']);
    assert.ok(calls.serpent[0].roll().every((p) => !isTopPiece(p.item)) && calls.serpent[0].roll().length === weekBase(serpentSpoilsList(base, 20, 'dealt')).length, 'the hoard, its finest out');
    assert.ok(calls.serpent[1].roll().length > 0 && calls.serpent[1].roll().every((p) => isTopPiece(p.item)), 'then the week\'s');
    await H.grantSerpentSpoils({ r: sr, ch: 'char-x', nm: 'Ann', lv: 20, cid: WD }, { recorded: true, spoils: true, top: false });
    assert.deepEqual(notes, [BOSS_WEEK_TEXT.taken(serpentBossById('sethrakul').name)], 'the week taken, said in the chat');
  } finally { playerEntity.level = was; }
});

test('PWR5 THE FLOOR AND THE DOORS, BY SOURCE: the gate\'s pool throws and grants a receipt\'s spoils without its finest; every boss spoils list a scene rolls is its floor\'s (weekBase) or a week\'s own roll; the hosts wire each claim\'s answer to its grant, a week\'s key never said to the hub, and every claim names its device (mutants: the burst whole; the grant whole; a list rolled whole; a hook unwired)', () => {
  const seed = seedWithTop((s) => spoilsList(s, 20));
  const taken = [];
  const p = createSpoilsPool({ ray: () => null, now: () => 0, take: (x) => taken.push(x), store: null, who: () => 'c' });
  assert.equal(p.spew({ day: 740, seed, level: 20, at: [0, 2, 0], bearing: 0, acct: 'a' }), true);
  assert.equal(p.state().pieces.length, weekBase(spoilsList(seed, 20)).length, 'the burst: its floor');
  assert.ok(p.grant({ day: 741, seed, level: 20, acct: 'a' }));
  assert.ok(taken.length === weekBase(spoilsList(seed, 20)).length && taken.every((x) => !isTopPiece(x.item)), 'the grant: the same');
  // the sweep: every gate, Hour and serpent list a scene rolls
  const files = readdirSync(new URL('../../../src/scenes/', import.meta.url), { recursive: true }).filter((f) => f.endsWith('.js')).map((f) => `src/scenes/${f.split('\\').join('/')}`);
  const rolls = [];
  for (const f of files) for (const line of rd(f).split('\n')) {
    if (/^\s*(\/\/|\*|\/\*\*)/.test(line) || /export function (spoilsList|sdSpoilsList|serpentSpoilsList)\(/.test(line)) continue;
    if (/(?<![A-Za-z])(spoilsList|sdSpoilsList|serpentSpoilsList)\(/.test(line)) rolls.push([f, /weekBase\((sd|serpent)?[sS]poilsList\(|roll: \(seed\) =>/.test(line)]);
  }
  assert.ok(rolls.length >= 7, `the rolls found (${rolls.length})`);
  assert.deepEqual(rolls.filter(([, ok]) => !ok), [], 'each a floor\'s or a week\'s own');
  const w = hostText('src/scenes/world.js');
  assert.match(w, /onSpent: \(day\) => isBossTopDay\(day\) \|\| socialLink\(\)\?\.sendGateSpent\?\.\(day\) === true,/);
  assert.match(w, /onWeek: \(r, data\) => gateWeek\(r, data\),/);
  assert.match(w, /onWeek: \(r, data\) => sdWeek\(r, data\),/);
  assert.match(w, /onSpoils: \(entry, data\) => grantSerpentSpoils\(entry, data\),/);
  assert.match(w, /get chatNotice\(\) \{ return chatNotice; \},/);
  const ac = rd('src/net/accountClient.js');
  assert.match(ac, /claimGateReceipt\(i, receipt, \{ \.\.\.\(extra \?\? \{\}\), wd: bossWeekDevice\(storage\) \}\)/);
  assert.match(ac, /claimSdReceipt\(i, receipt, bossWeekDevice\(storage\)\)/);
  assert.match(rd('src/scenes/superDungeon/sdSpoils.js'), /roll: \(\) => weekBase\(sdSpoilsList\(c\.c, lv\)\)/);
  for (const f of ['server-account/src/accounts.js', 'server-account/src/sds.js', 'server-account/src/serpents.js']) assert.match(rd(f), /bossWeekStatement\(\{ db, nowS, rand \}, player, '(gate|sd|serpent)', c, (wd|cid)\)/, f);
});
