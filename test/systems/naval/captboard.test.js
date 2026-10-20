// CAPT-BOARD (2026-10-11, the owner: "giving a reason to players to experience it"; bible/03-World/Captains-Sea.md
// CAPT-BOARD) - THE HARBOURMASTER'S BOARD: a port's contracts off its key and the world's day (a bounty, a hunt, a
// delivery, a salvage, the Admiralty's survey), their purses, terms and sites; a contract taken, come further, done,
// failed or given up, and the crown's regard for each; the letters a rank buys; the harbour office the world stands
// over the ledger; the naval host's sites (a bounty's quarry stood, a wreck's casks floated), its events, a rank's
// favours at the yard, among the hands and in the relief; the shipwright's Harbourmaster tab. tools/mutants/captboard.json.
import '../../modsOff.js';
import { byClass } from '../../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  HARBOUR_CONTRACT_KINDS, BOARD_OFFERS, CONTRACTS_MAX, TERM_DAYS, DELIVERY_DAYS_BASE, DELIVERY_PX_DAY, DELIVERY_PX_MIN, PAY_BASE, PAY_LEVEL, PAY_SITE_PX, PAY_DELIVERY_BASE,
  STANDING_DONE, STANDING_FAILED, STANDING_ABANDONED, CONTRACT_NEED, SITE_PX, SITE_REACH_PX, MARQUE_PRICE, MARQUE_DAYS, ADMIRALTY_OFF,
  payOf, siteFor, bountyClass, boardFor, takeContract, advance, expired, contractLine, contractSites, restoreContract, marqueOffer, admiraltyOffer,
  compassWords, leaguesWords, hashKey,
} from '../../../src/systems/naval/harbourBoard.js';
import { createCaptainLedger, LOG_CONTRACTS, RANK_PERKS } from '../../../src/systems/naval/captainLedger.js';
import { MINUTES_PER_DAY } from '../../../src/systems/gameDate.js';
import { hashKey as wireHashKey } from '../../../src/net/wire.js';
import { createHarbourOffice } from '../../../src/scenes/harbourOffice.js';
import { yardOffer, yardAll, YARD_PRICE, YARD_DISCOUNT_MAX } from '../../../src/systems/naval/navalYard.js';
import { createNavalDirector } from '../../../src/systems/naval/navalDirector.js';
import { HULL_PRICES } from '../../../src/systems/comeSailAway/comeSailAwayHulls.js';
import { officeText, mountNavalYardWindow } from '../../../src/ui/naval/navalYardWindow.js';
import { SITE_LOT, SITE_CASK_LIFE } from '../../../src/scenes/naval/navalHost.js';
import { classById } from '../../../src/systems/naval/navalShips.js';
import { sea } from '../../navalSea.mjs';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const WAYREST = { key: '100,100', name: 'Wayrest', px: 100, py: 100, region: 23, crown: 'Wayrest' };
const PORTS = [WAYREST, { key: '120,100', name: 'Sentinel', px: 120, py: 100, region: 20, crown: 'Sentinel' }, { key: '103,100', name: 'Near', px: 103, py: 100, region: 23, crown: 'Wayrest' }];
const seaAt = (x, y) => x >= 100 || y >= 104;   // east and south of the port, the sea
const board = (o = {}) => boardFor({ port: WAYREST, crown: 'Wayrest', day: 3, level: 5, perks: null, ports: PORTS, seaAt, regionIndex: 23, ...o });

test('CAPT-BOARD the purses: a bounty her size and her waters\' distance, a hunt, a salvage and a survey their need, a delivery her map pixels - each times the captain\'s level and her rank\'s pay, to the nearest five (mutants: each base, the level, the pay, the site\'s distance)', () => {
  assert.deepEqual(PAY_BASE, { bounty: 150, hunt: 85, delivery: 14, salvage: 65, survey: 50 });
  assert.deepEqual([PAY_LEVEL, PAY_SITE_PX, PAY_DELIVERY_BASE], [0.12, 10, 60]);
  assert.equal(payOf('bounty', { level: 1, size: 2, px: 5 }), 350);
  assert.equal(payOf('bounty', { level: 6, size: 2, px: 5 }), Math.round((150 * 2 * 1.6 + 50) / 5) * 5);
  assert.equal(payOf('hunt', { level: 1, need: 3 }), 255);
  assert.equal(payOf('hunt', { level: 1, need: 3, pay: 0.2 }), Math.round((255 * 1.2) / 5) * 5, 'a rank\'s pay on the purse');
  assert.equal(payOf('delivery', { level: 1, px: 20 }), 340);
  assert.equal(payOf('salvage', { level: 1, need: 4, px: 6 }), 320);
  assert.equal(payOf('survey', { level: 1, need: 3 }), 150);
  assert.equal(payOf('nonsense'), 5, 'never nothing');
});

test('CAPT-BOARD a site in open water: SITE_PX map pixels off the port on the square ring, every neighbour sea, the next way round where one way is land; none where the port has no sea (mutants: the neighbours, the ring, the ways)', () => {
  assert.deepEqual(SITE_PX, { near: 3, far: 8 });
  const r = () => 0;   // the first way (east), the nearest distance
  const s = siteFor(WAYREST, r, seaAt);
  assert.deepEqual(s, { px: 103, py: 100, d: 3 });
  const north = siteFor(WAYREST, r, (x, y) => y <= 98);   // only the north is sea
  assert.ok(north && north.py <= 97 && Math.max(Math.abs(north.px - 100), Math.abs(north.py - 100)) >= 3, JSON.stringify(north));
  assert.equal(siteFor(WAYREST, r, () => false), null, 'all land');
  assert.equal(siteFor(WAYREST, r, (x) => x >= 102 && x <= 103), null, 'a strait two pixels wide: no pixel of it all sea about');
  assert.equal(siteFor(WAYREST, r, null), null);
  for (let i = 0; i < 40; i++) {
    const k = mulberryLike(i);
    const t = siteFor(WAYREST, k, seaAt);
    const d = Math.max(Math.abs(t.px - 100), Math.abs(t.py - 100));
    assert.ok(d >= SITE_PX.near && d <= SITE_PX.far && t.d === d, JSON.stringify(t));
  }
});
function mulberryLike(seed) { let a = seed * 2654435761 >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

test('CAPT-BOARD a bounty\'s quarry: the strongest pirates within two levels of the captain\'s, never the flagship before level twelve (mutants: the two levels, the flagship)', () => {
  const ids = (level) => new Set(Array.from({ length: 20 }, (_, i) => bountyClass(level, () => i / 20).id));
  assert.deepEqual([...ids(1)], ['pirateSloop']);
  assert.deepEqual([...ids(2)].sort(), ['pirateBrig', 'pirateSloop']);
  assert.deepEqual([...ids(8)].sort(), ['pirateBrig', 'pirateGalley']);
  assert.ok(!ids(11).has('pirateFlagship'));
  assert.ok(ids(12).has('pirateFlagship'));
});

test('CAPT-BOARD the board: BOARD_OFFERS a day and a rank\'s more, the same for every client off the port and the day, a new one tomorrow; each kind in turn, a kind the port cannot post passed over; an offer taken off it for the day (mutants: the count, the day, the port, the taken, the kinds)', () => {
  assert.deepEqual(HARBOUR_CONTRACT_KINDS, ['bounty', 'hunt', 'delivery', 'salvage', 'survey']);
  assert.equal(BOARD_OFFERS, 3);
  const a = board();
  assert.equal(a.length, 3);
  assert.deepEqual(board(), a, 'the same board');
  assert.notDeepEqual(board({ day: 4 }).map((o) => o.title), a.map((o) => o.title), 'tomorrow\'s');
  assert.notDeepEqual(board({ port: { ...WAYREST, key: '101,100' } }).map((o) => o.title), a.map((o) => o.title), 'another port\'s');
  const ranked = board({ perks: { offers: 2, pay: 0 } });
  assert.equal(ranked.length, 5);
  assert.deepEqual(new Set(ranked.map((o) => o.kind)), new Set(HARBOUR_CONTRACT_KINDS), 'each kind in turn');
  assert.deepEqual(ranked.map((o) => o.id), ['100,100:3:0', '100,100:3:1', '100,100:3:2', '100,100:3:3', '100,100:3:4']);
  const taken = board({ perks: { offers: 2 }, taken: ['100,100:3:1'] });
  assert.ok(!taken.some((o) => o.id === '100,100:3:1') && taken.length === 4, 'taken: off the board');
  const landlocked = board({ seaAt: () => false, perks: { offers: 2 } });
  assert.ok(!landlocked.some((o) => o.kind === 'bounty' || o.kind === 'salvage'), 'no open water, no site');
  const alone = board({ ports: [WAYREST], perks: { offers: 2 } });
  assert.ok(!alone.some((o) => o.kind === 'delivery'), 'no port far enough, no cargo');
  const nearOnly = board({ ports: [WAYREST, PORTS[2]], perks: { offers: 2 } });
  assert.ok(!nearOnly.some((o) => o.kind === 'delivery'), 'a port nearer than DELIVERY_PX_MIN: no cargo for it');
  assert.deepEqual(boardFor({ port: null, crown: 'Wayrest', day: 1 }), []);
  assert.equal(hashKey, wireHashKey, 'the board hashes with the wire\'s FNV-1a - one home');
  // PIN MOVED (AUDIT CAPTAIN'S SEA H24): FNV-1a's own values - the key compared with itself held for any hash
  assert.equal(hashKey(''), 2166136261, 'the offset basis');
  assert.equal(hashKey('100,100'), 115546219);
  assert.notEqual(hashKey('100,100'), hashKey('100,101'));
});

test('CAPT-BOARD the offers\' words and terms: a bounty names her captain and ship and where she was last seen; a hunt, a salvage and a survey their need within CONTRACT_NEED; a delivery her port DELIVERY_PX_MIN or more off and a term of DELIVERY_DAYS_BASE and a day a DELIVERY_PX_DAY pixels; each its crown\'s regard (mutants: the words, the terms, the regard)', () => {
  assert.deepEqual(TERM_DAYS, { bounty: 4, hunt: 3, salvage: 3, survey: 2 });
  assert.deepEqual([DELIVERY_DAYS_BASE, DELIVERY_PX_DAY, DELIVERY_PX_MIN], [2, 6, 6]);
  assert.deepEqual(STANDING_DONE, { bounty: 3, hunt: 1, delivery: 4, salvage: 3, survey: 2 });
  const all = board({ perks: { offers: 2 } });
  const by = Object.fromEntries(all.map((o) => [o.kind, o]));
  const b = by.bounty;
  assert.match(b.title, /^Wanted: (Captain .+ of )?.+$/);
  assert.match(b.words, /preying on Wayrest's shipping, last seen [\d.]+ leagues? (east|north-east|north|north-west|west|south-west|south|south-east) of Wayrest\. Sink it or capture it\./);
  assert.equal(b.standing, STANDING_DONE.bounty * classById(b.target.classId).cargo, 'her size');
  assert.ok(Number.isFinite(b.target.px) && Number.isFinite(b.target.seed) && b.target.region === 23);
  assert.equal(b.days, 4);
  for (const k of ['hunt', 'salvage', 'survey']) assert.ok(by[k].need >= CONTRACT_NEED[k][0] && by[k].need <= CONTRACT_NEED[k][1], k);
  // AUDIT CAPTAIN'S SEA H24: and every need the range holds is drawn (a draw always its least passed the range's check)
  const needs = { hunt: new Set(), salvage: new Set(), survey: new Set() };
  for (let day = 0; day < 120; day++) for (const o of board({ day, perks: { offers: 2 } })) needs[o.kind]?.add(o.need);
  for (const k of ['hunt', 'salvage', 'survey']) assert.deepEqual([...needs[k]].sort((a, b) => a - b), Array.from({ length: CONTRACT_NEED[k][1] - CONTRACT_NEED[k][0] + 1 }, (_, i) => CONTRACT_NEED[k][0] + i), k);
  assert.equal(by.hunt.standing, by.hunt.need);
  assert.equal(by.survey.standing, 2 * by.survey.need);
  const d = by.delivery;
  assert.equal(d.to.name, 'Sentinel', 'the port six or more off - never the near one');
  assert.equal(d.days, 2 + Math.ceil(20 / 6));
  assert.match(d.words, /to Sentinel's harbormaster within 6 days\. It goes in your hold\. If you lose your ship, you lose the cargo\.$/);
  assert.equal(by.salvage.target.px != null && /^Salvage: /.test(by.salvage.title), true);
  assert.deepEqual(['east', 'north', 'south-west'], [compassWords(1, 0), compassWords(0, -1), compassWords(-1, 1)]);
  assert.deepEqual([leaguesWords(6), leaguesWords(1)], ['1 league', '0.2 leagues']);
});

test('CAPT-BOARD a contract held: taken on its term of the captain\'s clock (a delivery in the boat that took it); what happens at sea moves it - a bounty\'s quarry ended, pirates ended in the crown\'s waters, ships studied there, a wreck\'s casks hauled, a cargo berthed at its port or lost with her ship; past its term it is out (mutants: each kind\'s event, the crown, the boat, the term)', () => {
  const all = board({ perks: { offers: 2 } });
  const by = Object.fromEntries(all.map((o) => [o.kind, takeContract(o, { now: 1000, boat: 42 })]));
  assert.equal(by.hunt.until, 1000 + 3 * MINUTES_PER_DAY);
  assert.deepEqual([by.hunt.boat, by.delivery.boat, by.hunt.done], [null, 42, 0], 'only a cargo rides a boat');
  assert.equal(advance(by.bounty, { type: 'end', act: 'sink', faction: 'pirate', crown: 'Wayrest', bounty: 'other' }), null);
  assert.equal(advance(by.bounty, { type: 'end', act: 'board', faction: 'pirate', crown: 'Daggerfall', bounty: by.bounty.id }), 'done', 'her own, anywhere');
  const h = by.hunt;
  for (let i = 0; i < h.need - 1; i++) assert.equal(advance(h, { type: 'end', act: 'sink', faction: 'pirate', crown: 'Wayrest' }), null);
  assert.equal(advance(h, { type: 'end', act: 'sink', faction: 'pirate', crown: 'Sentinel' }), null, 'another crown\'s waters');
  assert.equal(advance(h, { type: 'end', act: 'sink', faction: 'merchant', crown: 'Wayrest' }), null, 'no pirate');
  assert.equal(advance(h, { type: 'end', act: 'repel', faction: 'pirate', crown: 'Wayrest' }), null, 'beaten off is not ended');
  assert.equal(advance(h, { type: 'end', act: 'board', faction: 'pirate', crown: 'Wayrest' }), 'done');
  const v = by.survey;
  v.done = v.need - 1;
  assert.equal(advance(v, { type: 'study', crown: 'Daggerfall' }), null);
  assert.equal(advance(v, { type: 'study', crown: 'Wayrest' }), 'done');
  const sv = by.salvage;
  assert.equal(advance(sv, { type: 'haul', site: 'x' }), null);
  assert.equal(advance(sv, { type: 'haul', site: sv.id }), null);
  assert.equal(sv.done, 1);
  const d = by.delivery;
  assert.equal(advance(d, { type: 'berth', port: 'other', boat: 42 }), null);
  assert.equal(advance(d, { type: 'berth', port: d.to.key, boat: 7 }), null, 'another boat');
  assert.equal(advance(d, { type: 'wrecked', boat: 7 }), null);
  assert.equal(advance({ ...d }, { type: 'wrecked', boat: 42 }), 'failed', 'lost with her');
  assert.equal(advance(d, { type: 'berth', port: d.to.key, boat: 42 }), 'done');
  assert.equal(expired(h, h.until - 1), false);
  assert.equal(expired(h, h.until), true);
});

test('CAPT-BOARD the board\'s words for a held contract, its sites, a save\'s junk refused (mutants: the progress, the term, the sites, the restore)', () => {
  const all = board({ perks: { offers: 2 } });
  const by = Object.fromEntries(all.map((o) => [o.kind, takeContract(o, { now: 0, boat: 42 })]));
  by.hunt.done = 1;
  const l = contractLine(by.hunt, by.hunt.until - (MINUTES_PER_DAY + 120));
  assert.deepEqual([l.progress, l.left], [`1 of ${by.hunt.need} ended`, '1 day, 2 hours left']);
  assert.equal(contractLine(by.hunt, by.hunt.until).left, 'Time is up');
  assert.equal(contractLine(by.survey, 0).progress, `0 of ${by.survey.need} studied`);
  assert.equal(contractLine(by.delivery, 0).progress, 'In your hold, for Sentinel');
  assert.match(contractLine(by.bounty, 0).progress, /^Last seen /);
  by.salvage.done = 2;
  const sites = contractSites(Object.values(by));
  assert.deepEqual(sites.map((x) => x.kind).sort(), ['bounty', 'salvage']);
  const sv = sites.find((x) => x.kind === 'salvage');
  assert.equal(sv.n, by.salvage.need - 2, 'the casks still wanted');
  const bq = sites.find((x) => x.kind === 'bounty');
  assert.deepEqual([bq.classId, bq.seed, bq.region, bq.id], [by.bounty.target.classId, by.bounty.target.seed, 23, by.bounty.id]);
  assert.deepEqual(restoreContract(JSON.parse(JSON.stringify(by.hunt))), by.hunt);
  assert.equal(restoreContract({ ...by.hunt, kind: 'escort' }), null);
  assert.equal(restoreContract({ ...by.bounty, target: null }), null);
  assert.equal(restoreContract({ ...by.delivery, to: null }), null);
  assert.equal(restoreContract({ ...by.hunt, until: 'x' }), null);
  assert.equal(restoreContract({ ...by.hunt, done: -4 }).done, 0);
});

test('CAPT-BOARD the ledger keeps them: CONTRACTS_MAX at once, never one twice; done - its crown\'s regard, its kind and its purse in the log - failed STANDING_FAILED, given up STANDING_ABANDONED; a term out failed; the board\'s taken remembered; the save (mutants: the cap, the regard, the log, the failure, the save)', () => {
  assert.deepEqual([CONTRACTS_MAX, STANDING_FAILED, STANDING_ABANDONED], [3, -3, -1]);
  assert.deepEqual(LOG_CONTRACTS, HARBOUR_CONTRACT_KINDS);
  const L = createCaptainLedger();
  const all = board({ perks: { offers: 2 } });
  const by = Object.fromEntries(all.map((o) => [o.kind, takeContract(o, { now: 0, boat: 42 })]));
  assert.equal(L.holdContract(by.hunt), true);
  assert.equal(L.holdContract(by.hunt), false, 'never twice');
  assert.equal(L.holdContract(by.survey), true);
  assert.equal(L.holdContract(by.delivery), true);
  assert.equal(L.holdContract(by.bounty), false, 'three at once');
  assert.deepEqual(L.taken(), [by.hunt.id, by.survey.id, by.delivery.id]);
  let r;
  for (let i = 0; i < by.hunt.need; i++) r = L.contractEvent({ type: 'end', act: 'sink', faction: 'pirate', crown: 'Wayrest' });
  assert.deepEqual(r.done.map((c) => c.kind), ['hunt']);
  assert.equal(L.standing('Wayrest'), by.hunt.standing);
  assert.deepEqual([L.log.contracts.hunt, L.log.earned], [1, by.hunt.pay]);
  const moved = L.contractEvent({ type: 'study', crown: 'Wayrest' });
  assert.deepEqual([moved.done, moved.failed, moved.moved.map((c) => c.kind)], [[], [], ['survey']]);
  const lost = L.contractEvent({ type: 'wrecked', boat: 42 });
  assert.deepEqual(lost.failed.map((c) => c.kind), ['delivery']);
  assert.equal(L.standing('Wayrest'), by.hunt.standing + STANDING_FAILED);
  const out = L.expireContracts(by.survey.until);
  assert.deepEqual(out.map((c) => c.kind), ['survey']);
  assert.equal(L.contracts().length, 0);
  assert.equal(L.holdContract(by.bounty), true);
  const before = L.standing('Wayrest');
  assert.equal(L.abandonContract(by.bounty.id).id, by.bounty.id);
  assert.equal(L.standing('Wayrest'), before + STANDING_ABANDONED);
  assert.equal(L.abandonContract('none'), null);
  L.holdContract(by.salvage);
  const M = createCaptainLedger();
  M.restoreSaveData(JSON.parse(JSON.stringify(L.getSaveData())));
  assert.deepEqual(M.contracts(), L.contracts());
  assert.deepEqual(M.taken(), L.taken());
  M.restoreSaveData({ contracts: [by.hunt, { kind: 'x' }, { ...by.survey, crown: 'Morrowind' }], taken: ['a', 5] });
  assert.deepEqual([M.contracts().map((c) => c.kind), M.taken()], [['hunt'], ['a']]);
});

test('CAPT-BOARD the letters: a crown\'s letter of marque to its Privateers for MARQUE_PRICE, MARQUE_DAYS, one crown\'s at a time; the Admiralty\'s carrack to its Commodores at ADMIRALTY_OFF off her price (mutants: the rank, the purse, the held letter, the price)', () => {
  assert.deepEqual([MARQUE_PRICE, MARQUE_DAYS, ADMIRALTY_OFF], [1500, 7, 0.2]);
  const priv = RANK_PERKS[2], com = RANK_PERKS[3];
  assert.equal(marqueOffer({ crown: 'Wayrest', perks: RANK_PERKS[1], gold: 9999 }).can, false);
  assert.match(marqueOffer({ crown: 'Wayrest', perks: RANK_PERKS[1], gold: 9999 }).why, /Privateers/);
  assert.equal(marqueOffer({ crown: 'Wayrest', perks: priv, gold: 1499 }).can, false);
  assert.deepEqual(marqueOffer({ crown: 'Wayrest', perks: priv, gold: 1500 }), { can: true, price: 1500, days: 7, why: '' });
  assert.match(marqueOffer({ crown: 'Wayrest', perks: priv, gold: 5000, held: { crown: 'Sentinel' } }).why, /Sentinel's letter\. You can only hold one at a time/);
  const price = Math.round(HULL_PRICES[4] * 0.8);
  assert.deepEqual(admiraltyOffer({ crown: 'Wayrest', perks: com, gold: price }), { can: true, price, why: '' });
  assert.equal(admiraltyOffer({ crown: 'Wayrest', perks: priv, gold: price }).can, false);
  assert.equal(admiraltyOffer({ crown: 'Wayrest', perks: com, gold: price - 1 }).can, false);
});

function officeOf(o = {}) {
  const log = { mid: [], say: [], paid: [], credited: [], carrack: [] };
  let purse = o.gold ?? 10000;
  const ledger = o.ledger ?? createCaptainLedger();
  const office = createHarbourOffice({
    ledger, now: () => o.now ?? 0, day: () => 3, level: () => 5, gold: () => purse,
    pay: (n) => { purse -= n; log.paid.push(n); }, credit: (n) => { purse += n; log.credited.push(n); },
    say: (t) => log.say.push(t), mid: (t) => log.mid.push(t), notorietyOf: () => o.notoriety ?? 0,
    port: () => (o.port === undefined ? WAYREST : o.port), ports: () => PORTS, seaAt, waters: () => 'Wayrest',
    carrack: (price, port) => { log.carrack.push([price, port.name]); return true; },
  });
  return { office, ledger, log, purse: () => purse };
}

test('CAPT-BOARD the harbour office: the board of the port lain at, an offer taken (a cargo needs a ship of the captain\'s), what the sea did paid and said, a term out said, the letters bought and the carrack titled; nothing at no port (mutants: the pay, the words, the boat, the sale)', () => {
  const h = officeOf();
  const m = h.office.model({ uid: 42 });
  assert.equal(m.port, 'Wayrest');
  assert.equal(m.board.length, 3);
  const pick = m.board[0];
  const r = m.take(pick.id);
  assert.equal(r.ok, true);
  assert.ok(!h.office.board().some((o) => o.id === pick.id), 'off the board');
  // a cargo needs a ship of the captain's (a Commodore's board: every kind on it)
  const C = createCaptainLedger();
  C.regard('Wayrest', 130);
  const cb = officeOf({ ledger: C });
  const del = cb.office.board().find((o) => o.kind === 'delivery');
  assert.deepEqual(cb.office.take(del.id, null), { ok: false, text: 'A cargo needs a ship of your own to carry it.' });
  assert.equal(cb.office.take(del.id, { uid: 42 }).ok, true);
  assert.equal(C.contracts()[0].boat, 42, 'in her hold');
  // a hunt done: paid and said
  const g = officeOf();
  const off = g.office.board();
  const c = takeContract({ ...off[0], kind: 'hunt', need: 1, id: 'h1' }, { now: 0 });
  g.ledger.holdContract(c);
  g.office.event({ type: 'end', act: 'sink', faction: 'pirate', crown: 'Wayrest' });
  assert.deepEqual(g.log.credited, [c.pay]);
  assert.equal(g.log.mid.at(-1), `Contract done - ${c.title}. ${c.pay.toLocaleString('en-US')} gold paid by Wayrest's harbormaster.`);
  const s2 = takeContract({ ...off[0], kind: 'survey', need: 3, id: 's2' }, { now: 0 });
  g.ledger.holdContract(s2);
  g.office.event({ type: 'study', crown: 'Wayrest' });
  assert.equal(g.log.say.at(-1), `${s2.title}: 1 of 3 ships studied.`);
  const t = officeOf({ now: s2.until, ledger: g.ledger });
  assert.deepEqual(t.office.tick().map((x) => x.id), ['s2']);
  assert.equal(t.log.mid.at(-1), `Contract failed - ${s2.title}. Its term ran out.`);
  // the letters
  const L = createCaptainLedger();
  L.regard('Wayrest', 130);   // a Commodore
  const p = officeOf({ ledger: L, gold: 200000 });
  assert.equal(p.office.buyMarque().ok, true);
  assert.deepEqual(L.marque(0), { crown: 'Wayrest', until: MARQUE_DAYS * MINUTES_PER_DAY });
  assert.equal(p.office.buyMarque().ok, false, 'one at a time');
  assert.equal(p.office.buyCarrack().ok, true);
  assert.deepEqual(p.log.carrack, [[Math.round(HULL_PRICES[4] * 0.8), 'Wayrest']]);
  assert.deepEqual(p.log.paid, [MARQUE_PRICE, Math.round(HULL_PRICES[4] * 0.8)]);
  const hunted = officeOf({ ledger: L, notoriety: 30 });
  assert.equal(hunted.office.model().hunted, true);
  assert.equal(hunted.office.perksAt('Wayrest').yard, 0, 'a hunted captain: no favours');
  assert.equal(officeOf({ port: null }).office.model(), null);
  assert.equal(officeOf({ ledger: L }).office.perksHere().yard, RANK_PERKS[3].yard);
});

test('CAPT-BOARD the yard\'s favour: a rank\'s share off every price, never past YARD_DISCOUNT_MAX, a price to the copper and a bill to the gold; none, the yard as it was (mutants: the discount unread, the cap)', () => {
  const hurt = { hull: 300, maxHull: 420, sail: 100, maxSail: 160, crew: 20, maxCrew: 24 };
  assert.equal(YARD_DISCOUNT_MAX, 0.5);
  const full = yardOffer(hurt, 4, 99999);
  const off = yardOffer(hurt, 4, 99999, { discount: 0.15 });
  assert.equal(off.rows[0].price, Math.round(YARD_PRICE.hull * 0.85 * 100) / 100);
  assert.equal(off.rows[0].whole, Math.ceil(120 * YARD_PRICE.hull * 0.85 - 1e-9));
  assert.ok(off.whole < full.whole);
  assert.equal(yardOffer(hurt, 4, 99999, { discount: 0.9 }).rows[0].price, YARD_PRICE.hull * 0.5);
  assert.deepEqual(yardOffer(hurt, 4, 99999, { discount: 0 }), full);
  assert.equal(yardAll(hurt, 4, 99999, { discount: 0.15 }).reduce((s, p) => s + p.cost, 0) <= off.whole + 4, true);
});

test('CAPT-BOARD at sea: a bounty\'s quarry stood within SITE_REACH_PX of her waters - her class, her seed\'s name, bold, flying no false colours - and her end at my hand the board\'s; a wreck\'s casks floated, hauled one by one; a delivery\'s berth; a ship studied through the glass; a wreck of mine; none stood too far, or ashore (mutants: the reach, the quarry, the casks, each event)', async () => {
  assert.equal(SITE_REACH_PX, 1);
  const s = await sea({ hull: 2, where: { port: { key: '100,100', name: 'Wayrest' }, nearPort: true } });
  const events = [];
  const sites = [
    { id: 'b1', kind: 'bounty', px: 101, py: 100, seed: 12345, classId: 'pirateBrig', name: 'X', region: 23 },
    { id: 's1', kind: 'salvage', px: 100, py: 101, seed: 777, n: 3 },
    { id: 'far', kind: 'bounty', px: 102, py: 100, seed: 5, classId: 'pirateSloop', region: 23 },
  ];
  s.deps.captain = { event: (ev) => events.push(ev), sites: () => sites };
  s.deps.sitePoint = (px) => (px === 101 ? [800, 0, 0] : [0, 0, 300]);
  s.run(1.2);
  const q = [...s.host._sea.values()].find((e) => e.bounty === 'b1');
  assert.ok(q, 'her quarry stood');
  assert.deepEqual([q.ship.cls.id, q.ship.temper, q.plain], ['pirateBrig', 'bold', true]);
  assert.ok(Math.abs(q.ship.pos[0] - 800) < 2, 'at her waters\' point');
  assert.ok(![...s.host._sea.values()].some((e) => e.bounty === 'far'), 'two pixels off: not yet');
  const casks = s.host._shots.floaters().filter((f) => f.lot === `${SITE_LOT}s1`);
  assert.equal(casks.length, 3);
  assert.ok(casks.every((f) => s.host._shots.floater(f.id).life === SITE_CASK_LIFE));
  assert.ok(events.some((e) => e.type === 'berth' && e.port === '100,100' && e.boat === 42), 'lying in port at the helm, slow: the berth said');
  s.run(2);
  assert.equal([...s.host._sea.values()].filter((e) => e.bounty === 'b1').length, 1, 'stood once while she stands');
  s.host._charge('sink', q.id);
  assert.deepEqual(events.filter((e) => e.type === 'end'), [{ type: 'end', act: 'sink', faction: 'pirate', crown: 'Wayrest', bounty: 'b1' }]);
  // a cask hauled
  s.host._shots.floater(casks[0].id).pos = [0, 0, 0];   // sailed through
  s.run(0.3);
  assert.ok(events.some((e) => e.type === 'haul' && e.site === 's1'), 'the haul the contract\'s');
  assert.ok(s.log.say.includes('You haul a cask of the wreck\'s cargo aboard.'));
  const host = rd('src/scenes/naval/navalHost.js');
  // PIN MOVED (AUDIT CAPTAIN'S SEA L6): and her seed with it - each ship counted once
  assert.match(host, /if \(was < KNOW\.studied && e\.known >= KNOW\.studied && held > 0 && !struck\) deps\.captain\?\.event\?\.\(\{ type: 'study', crown: watersCrown\(\), seed: e\.ship\.seed \}\);/);
  assert.match(host, /if \(wrecked && !s\.wasWrecked\) \{ c\.event\('wrecked'\); deps\.captain\?\.event\?\.\(\{ type: 'wrecked', boat: b\.uid \?\? null \}\); \}/);
  assert.match(host, /if \(!aboardShip\(\) \|\| !Number\.isFinite\(w\.px\) \|\| !Number\.isFinite\(w\.py\)\) return;/, 'ashore: none stood');
  assert.match(host, /const service = deps\.captain\?\.seasonedHires\?\.\(\) \? SEASONED_HIRE : 0;/);
  assert.match(host, /const offer = \(\) => yardOffer\(d, st\.guns\.barrels, deps\.gold\?\.\(\) \?\? 0, \{ discount: discount\(\) \}\);/);
  assert.match(host, /reliefSure: !!distress && !!deps\.captain\?\.reliefSure\?\.\(crown\.name\),/);
});

test('CAPT-BOARD an Admiral\'s crown always answers: the relief stood on any draw where its chance would have refused it (mutants: the sure relief unread)', () => {
  const ctx = (reliefSure) => ({ density: 1, player: [0, 0, 0], players: [[0, 0, 0]], level: 3, ships: [], isOpenWater: () => true, nearPort: false, notoriety: 0, seedBase: 7, seaY: 0, distress: [0, 0, 0], reliefSure });
  let sure = 0, chance = 0;
  for (let i = 0; i < 60; i++) {
    const a = createNavalDirector({ random: () => 0 }), b = createNavalDirector({ random: () => 0 });
    const ca = ctx(true), cb = ctx(false);
    ca.seedBase = cb.seedBase = i * 7919;
    if (a.step(100, ca).spawn?.relief) sure++;
    if (b.step(100, cb).spawn?.relief) chance++;
  }
  assert.equal(sure, 60, 'always');
  assert.ok(chance < 60, `on its chance: ${chance}`);
});

test('CAPT-BOARD the shipwright\'s Harbourmaster tab: the port and the rank, the board\'s rows with their purse, term and regard and Take, the contracts held with Give up, the letters; the tab stands only where the world hands an office (mutants: the tab, the rows, the presses)', () => {
  const h = officeOf();
  const o = h.office.model({ uid: 42 });
  const t = officeText(o);
  assert.equal(t.lede, 'Wayrest - Wayrest\'s harbormaster. You are Unsworn of Wayrest (standing 0).');
  assert.equal(t.board.length, 3);
  assert.match(t.board[0].terms, /^[\d,]+ gold - \d+ days? - \+\d+ with Wayrest$/);
  assert.deepEqual(t.letters.map((x) => [x.id, x.can]), [['marque', false], ['admiralty', false]]);
  assert.equal(officeText(null), null);
  const model = {
    name: 'Small Ship', uid: 42, offer: () => ({ rows: [], whole: 0, gold: 100 }), ship: () => ({ hull: 1, maxHull: 1, sail: 1, maxSail: 1, crew: 1, maxCrew: 1, barrels: 0 }),
    office: () => h.office.model({ uid: 42 }),
  };
  const proto = Object.getPrototypeOf(globalThis.document.createElement('div'));
  proto.removeAttribute ??= function removeAttribute(k) { delete this.attrs[k]; };   // the stand-in DOM's missing one
  const host = globalThis.document.createElement('div');
  const win = mountNavalYardWindow(host, { model });
  const [tabs] = byClass(host, 'dfnaval-tabs');
  assert.ok(tabs && tabs.style.display !== 'none');
  const [yardTab, officeTab, tradeTab] = tabs.children;
  assert.deepEqual([officeTab.style.display, tradeTab.style.display], ['', 'none'], 'the harbormaster\'s tab; no exchange handed, none');
  officeTab.onclick({ stopPropagation() {} });
  const rows = byClass(host, 'dfnaval-officerow');
  assert.ok(rows.length >= 3 + 2, 'the board and the letters');
  const take = byClass(rows[0], 'dfnaval-officebuy')[0];
  take.onclick({ stopPropagation() {} });
  assert.equal(h.ledger.contracts().length, 1, 'taken from the tab');
  const heldRows = byClass(host, 'dfnaval-officerow').filter((r) => byClass(r, 'dfnaval-officebuy')[0]?.textContent === 'Give up');
  assert.equal(heldRows.length, 1);
  yardTab.onclick({ stopPropagation() {} });
  win.unmount();
  const bare = globalThis.document.createElement('div');
  const w2 = mountNavalYardWindow(bare, { model: { ...model, office: undefined } });
  assert.equal(byClass(bare, 'dfnaval-tabs')[0].style.display, 'none', 'no office: no tabs');
  w2.unmount();
  const world = rd('src/scenes/world.js');
  assert.match(world, /return harbourOffice\.model\(\{ uid: model\.uid \?\? null \}\);/);
  assert.match(world, /if \(_officeTickT <= 0 && !gamePaused\(\) && !_loading\) \{\n      _officeTickT = 2; harbourOffice\.tick\(\); captainSay\(\);/);
  assert.match(world, /carrack: \(price, port\) => \{ const deed = mintDeed\(4, 0, csaNewItemUid\(\), price\); return !!titleDeed\(deed, \{ port: \{ name: port\.name \} \}\); \},/);
});
