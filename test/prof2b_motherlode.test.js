// PROF2b (2026-10-03, Mac: "plus we need to build motherloads"): THE MOTHERLODES - the law both ends read
// (src/net/motherlodeLaw.js: the day's three on witnessed ground, their hours, their ore, their yield) and the account
// service's half (server-account/src/motherlodes.js: the day's three picked once and kept; a strike through the
// harvest's route, the relay's Watch receipt on the Motherlode's pixel, an Apprentice's Mining, the twenty, the
// account's one a day, the ore into the Stores, the XP, the 10 silver), driven through the real Worker over
// node:sqlite with every migration applied (test/accountDb.mjs). bible/06-Systems/Professions-Arc.md 6, 38.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService, T0 } from './accountDb.mjs';
import { mintWatchReceipt } from '../src/net/watchReceipt.js';
import { utcDay } from '../src/net/marksLaw.js';
import { xpForRank, harvestXp, glintsMax, specOk } from '../src/net/professionLaw.js';
import { CLIMATES } from '../src/formats/mapsTables.js';
import {
  MOTHERLODES_A_DAY, MOTHERLODE_STRIKERS, MOTHERLODE_SILVER, MOTHERLODE_RANK, MOTHERLODE_TIER, MOTHERLODE_OPEN_S, MOTHERLODE_THIRD_S,
  MOTHERLODE_RISE_SPREAD_S, MOTHERLODE_WARN_S, MOTHERLODE_SENSE_WARN_S, MOTHERLODE_WATCH_S, MOTHERLODE_ORES, MOTHERLODE_CLIMATES,
  motherlodeKey, parseMotherlodeKey, motherlodeTimes, motherlodeOre, motherlodeSites, motherlodeOpen, motherlodeYield, motherlodeWarnS,
} from '../src/net/motherlodeLaw.js';

const { subtle } = globalThis.crypto;
const DAY = 86400;
const DAY0 = utcDay(T0);
let _now = T0;
const realNow = Date.now;
const clock = (s) => { _now = s; Date.now = () => _now * 1000; };
test.after(() => { Date.now = realNow; });
clock(T0);
let _rid = 0;
const rid = () => `mlode-${String(++_rid).padStart(6, '0')}`;
const M = CLIMATES.Mountain, W = CLIMATES.Woodlands;

// ─── THE LAW ─────────────────────────────────────────────────────────────────────────────────────────────────────────

test('PROF2b the law: three a day, twenty strikers, 10 silver, Mining 25, tier 6; each in its own third of the UTC day within its first six hours, standing two; a warning of ten minutes, a Sense\'s thirty; a Watch of ten; the key in its one spelling (mutants: the twenty; the third; the spread; the hours it stands; the key\'s leading zero)', () => {
  assert.deepEqual([MOTHERLODES_A_DAY, MOTHERLODE_STRIKERS, MOTHERLODE_SILVER, MOTHERLODE_RANK, MOTHERLODE_TIER], [3, 20, 10, 25, 6]);
  assert.deepEqual([MOTHERLODE_THIRD_S, MOTHERLODE_RISE_SPREAD_S, MOTHERLODE_OPEN_S, MOTHERLODE_WARN_S, MOTHERLODE_SENSE_WARN_S, MOTHERLODE_WATCH_S],
    [8 * 3600, 6 * 3600, 2 * 3600, 600, 1800, 600]);
  assert.deepEqual([motherlodeWarnS(false), motherlodeWarnS(true)], [600, 1800]);
  for (let day = DAY0; day < DAY0 + 30; day++) {
    for (let k = 0; k < 3; k++) {
      const t = motherlodeTimes(day, k);
      assert.ok(t.opensAt >= day * DAY + k * MOTHERLODE_THIRD_S && t.opensAt < day * DAY + k * MOTHERLODE_THIRD_S + MOTHERLODE_RISE_SPREAD_S, `${day}:${k} in its third's six hours`);
      assert.equal(t.opensAt % 60, 0, 'a whole minute');
      assert.equal(t.closesAt - t.opensAt, MOTHERLODE_OPEN_S);
    }
  }
  assert.equal(motherlodeKey(DAY0, 2), `mlode:${DAY0}:2`);
  assert.deepEqual(parseMotherlodeKey(`mlode:${DAY0}:1`), { day: DAY0, k: 1 });
  assert.deepEqual([`mlode:0${DAY0}:1`, `mlode:${DAY0}:3`, `mlode:${DAY0}:01`, 'vein:1:2:3:4', null].map(parseMotherlodeKey), [null, null, null, null, null]);
  const lode = { opensAt: 1000, closesAt: 2000 };
  assert.deepEqual([999, 1000, 1999, 2000].map((t) => motherlodeOpen(lode, t)), [false, true, true, false]);
  assert.deepEqual([motherlodeYield(0, false), motherlodeYield(2, false), motherlodeYield(2, true), motherlodeYield(0, true), motherlodeYield(9, false)], [4, 6, 9, 6, 6]);
});

test('PROF2b the law: the day\'s three on distinct witnessed pixels, the same for every reader whatever order they came in; the mountains\' and the deserts\' first, every vein-bearing pixel where they are fewer than three; none on a realm nobody walked; a region whose signature is a tier-6 ore yields it (mutants: the pool\'s order; a pixel twice; the rich climates unread; the signature unread)', () => {
  const ground = (n, climate, region = 21) => Array.from({ length: n }, (_, i) => ({ x: 100 + i, y: 50 + (i % 3), climate, region }));
  const mountains = ground(8, M);
  const a = motherlodeSites(DAY0, mountains), b = motherlodeSites(DAY0, [...mountains].reverse());
  assert.deepEqual(a, b, 'one order, whoever read the ground first');
  assert.equal(a.length, 3);
  assert.equal(new Set(a.map((s) => `${s.x},${s.y}`)).size, 3, 'three pixels');
  assert.deepEqual(a.map((s) => [s.k, s.key]), [0, 1, 2].map((k) => [k, motherlodeKey(DAY0, k)]));
  // the rich climates first: woods beside three mountains are never chosen
  const mixed = motherlodeSites(DAY0, [...ground(3, M), ...ground(20, W).map((g) => ({ ...g, y: g.y + 100 }))]);
  assert.ok(mixed.every((s) => MOTHERLODE_CLIMATES.includes(s.climate)));
  // fewer than three rich: every vein-bearing pixel
  const woods = motherlodeSites(DAY0, [...ground(1, M), ...ground(5, W).map((g) => ({ ...g, y: g.y + 100 }))]);
  assert.equal(woods.length, 3);
  assert.equal(motherlodeSites(DAY0, []).length, 0);
  assert.equal(motherlodeSites(DAY0, ground(2, CLIMATES.Ocean)).length, 0, 'no veins at sea');
  assert.deepEqual(motherlodeSites(DAY0, ground(2, M)).map((s) => s.k), [0, 1], 'fewer where the ground is fewer');
  // the ore: a tier-6 signature where the region has one, else one of the three
  for (let day = DAY0; day < DAY0 + 20; day++) assert.ok(MOTHERLODE_ORES.includes(motherlodeOre(day, 0, 21)));
  const sentinel = [...Array(62).keys()].find((r) => motherlodeOre(DAY0, 0, r) === 'ore:ebony' && motherlodeOre(DAY0 + 1, 0, r) === 'ore:ebony' && motherlodeOre(DAY0 + 2, 0, r) === 'ore:ebony' && motherlodeOre(DAY0 + 3, 0, r) === 'ore:ebony');
  assert.ok(sentinel != null, 'a region whose signature is Ebony yields it every day');
});

// ─── THE SERVICE ─────────────────────────────────────────────────────────────────────────────────────────────────────

async function stand(extra = {}) {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', DEVELOPER_HANDLES: 'Mac', ...extra });
  const raw = s.env.DB._raw;
  const witnesses = [await s.registered('Wita'), await s.registered('Witb'), await s.registered('Witc')];
  /** `n` pixels of `climate` confirmed by three witnesses before day `day` began. */
  const confirm = (n, climate = M, region = 21, day = DAY0) => {
    for (let i = 0; i < n; i++) {
      for (const w of witnesses) {
        raw.prepare('INSERT INTO world_witness (kind, key, account, report, region, at) VALUES (?, ?, ?, ?, ?, ?)')
          .run('pixel', `${200 + i},${80}`, w.id, `${climate},${region}`, region, day * DAY - 3600);
      }
    }
  };
  const setXp = (who, xp) => raw.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, updated_at) VALUES (?, ?, 'mining', ?, ?)
    ON CONFLICT (player, char_id, profession) DO UPDATE SET xp = excluded.xp`).run(who.id, who.character, xp, _now);
  const balance = (who) => Number(raw.prepare('SELECT balance FROM marks WHERE account = ?').get(who.id)?.balance ?? 0);
  const stores = (who, m) => Number(raw.prepare("SELECT qty FROM prof_stores WHERE player = ? AND char_id = ? AND material = ? AND origin = 'own'").get(who.id, who.character, m)?.qty ?? 0);
  const read = (who) => s.call('/v1/prof/motherlodes', { character: who.character }, who.secret);
  const watch = (who, lode, { nowS = _now, x = lode.x, y = lode.y } = {}) => mintWatchReceipt({ s: who.id, x, y, c: 4242 }, s.gateKey, { subtle, nowS });
  const strike = async (who, lode, extra2 = {}) => s.call('/v1/prof/harvest', {
    character: who.character, node: lode.key, kind: 'ore', act: { glints: glintsMax(MOTHERLODE_TIER), clean: true }, at: _now - 2, rid: rid(),
    watch: await watch(who, lode), ...extra2,
  }, who.secret);
  /** A miner of `rank`, its Mining track set. */
  const miner = async (handle, rank = MOTHERLODE_RANK) => { const w = await s.registered(handle); setXp(w, xpForRank(rank)); return w; };
  return { ...s, raw, confirm, setXp, balance, stores, read, watch, strike, miner };
}

test('PROF2b DONE WHEN: the day\'s three read from witnessed ground and kept; at its rising an Apprentice miner the relay saw on its pixel strikes it - its ore into the Stores as own, tier 6\'s XP, 10 silver - said in a harvest\'s answer; asked twice, one strike; a second Motherlode that day refused, the account\'s one (mutants: the silver unstruck; the strike twice; the day\'s one an account)', async () => {
  clock(DAY0 * DAY + 60);
  const s = await stand();
  s.confirm(6);
  const ann = await s.miner('Ann');
  const r = await s.read(ann);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.lodes.length, 3);
  assert.deepEqual([r.body.strikers, r.body.rank, r.body.silver, r.body.found], [20, 25, 10, null]);
  assert.deepEqual(r.body.lodes, motherlodeSites(DAY0, Array.from({ length: 6 }, (_, i) => ({ x: 200 + i, y: 80, climate: M, region: 21 }))).map((l) => ({ ...l, struck: 0 })));
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM motherlodes WHERE day = ?').get(DAY0).n, 3, 'kept');
  const [l0, l1] = r.body.lodes;
  // before its rising: closed
  clock(l0.opensAt - 30);
  assert.equal((await s.strike(ann, l0)).body.error, 'motherlode-closed');
  clock(l0.opensAt + 120);
  const id = rid();
  const hit = await s.strike(ann, l0, { rid: id });
  assert.equal(hit.status, 200, JSON.stringify(hit.body));
  assert.deepEqual([hit.body.motherlode, hit.body.node, hit.body.kind, hit.body.material, hit.body.qty, hit.body.xp], [true, l0.key, 'ore', l0.material, hit.body.qty, harvestXp(6, 25, true)]);
  assert.ok(hit.body.qty >= 6 && hit.body.qty <= 9, 'a clean act: 4-6 and half again');
  assert.deepEqual(hit.body.marks, { struck: 10, balance: 10 });
  assert.deepEqual(hit.body.lode, { struck: 1, strikers: 20 });
  assert.equal(hit.body.today, 0, 'the day\'s sixty untouched');
  assert.equal(s.stores(ann, l0.material), hit.body.qty);
  assert.equal(hit.body.track.xp, xpForRank(25) + harvestXp(6, 25, true));
  const again = await s.strike(ann, l0, { rid: id });
  assert.deepEqual([again.body.repeat, again.body.qty, again.body.marks.struck], [true, hit.body.qty, 10]);
  assert.equal(s.balance(ann), 10, 'struck once');
  // another the same day: the account's one
  clock(l1.opensAt + 60);
  assert.equal((await s.strike(ann, l1)).body.error, 'motherlode-found');
  assert.equal((await s.read(ann)).body.found, l0.key);
  assert.deepEqual(s.raw.prepare("SELECT kind, amount, rid FROM marks_ledger WHERE kind = 'motherlode'").all().map((x) => ({ ...x })), [{ kind: 'motherlode', amount: 10, rid: `motherlode:${DAY0}` }]);
});

test('PROF2b the Watch: a strike counts only from an account the relay saw on the Motherlode\'s own pixel in the ten minutes before - another pixel, an older receipt, another account\'s and an unsigned one are refused; a rank under 25 too (mutants: the pixel unread; the ten minutes; the account unread; the rank)', async () => {
  clock(DAY0 * DAY + 60);
  const s = await stand();
  s.confirm(4);
  const ann = await s.miner('Ann'), bea = await s.miner('Bea'), low = await s.miner('Low', MOTHERLODE_RANK - 1);
  const [l0] = (await s.read(ann)).body.lodes;
  clock(l0.opensAt + 900);
  assert.equal((await s.strike(ann, l0, { watch: await s.watch(ann, l0, { x: l0.x + 1 }) })).body.error, 'motherlode-watch', 'the next pixel');
  assert.equal((await s.strike(ann, l0, { watch: await s.watch(ann, l0, { nowS: _now - 2 - MOTHERLODE_WATCH_S - 1 }) })).body.error, 'motherlode-watch', 'eleven minutes old');
  assert.equal((await s.strike(ann, l0, { watch: await s.watch(bea, l0) })).body.error, 'motherlode-watch', 'another account\'s');
  assert.equal((await s.strike(ann, l0, { watch: 'k1.e30.' })).body.error, 'motherlode-watch', 'unsigned');
  assert.equal((await s.strike(ann, l0, { watch: undefined })).body.error, 'motherlode-watch', 'none');
  assert.equal((await s.strike(low, l0)).body.error, 'prof-rank');
  assert.equal((await s.strike(ann, l0, { watch: await s.watch(ann, l0, { nowS: _now - 2 - MOTHERLODE_WATCH_S }) })).status, 200, 'ten minutes to the second');
});

test('PROF2b the twenty: the first twenty accounts strike, the twenty-first is refused `motherlode-full`; the read says the count; a strike after it goes is `motherlode-closed`; silver shut, the ore still comes and no silver is said; a realm with no witnessed ground has none (mutants: the twenty unread; the hours unread; the silver without the switch)', async () => {
  clock(DAY0 * DAY + 60);
  const s = await stand();
  s.confirm(3);
  const first = await s.miner('Firsty');
  const [l0] = (await s.read(first)).body.lodes;
  clock(l0.opensAt + 60);
  assert.equal((await s.strike(first, l0)).status, 200);
  for (let i = 1; i < MOTHERLODE_STRIKERS; i++) assert.equal((await s.strike(await s.miner(`Miner${i}`), l0)).status, 200, `striker ${i + 1}`);
  const late = await s.miner('Lately');
  assert.equal((await s.strike(late, l0)).body.error, 'motherlode-full');
  assert.equal((await s.read(late)).body.lodes[0].struck, 20);
  const l1 = (await s.read(late)).body.lodes[1];
  clock(l1.closesAt + 2);
  assert.equal((await s.strike(late, l1)).body.error, 'motherlode-closed', 'gone at its second hour - an act ending on it');
  // silver shut
  const shut = await stand({ MARKS_OPEN: 'off' });
  shut.confirm(3);
  clock(DAY0 * DAY + 60);
  const c = await shut.miner('Cora');
  const [m0] = (await shut.read(c)).body.lodes;
  clock(m0.opensAt + 60);
  const r = await shut.strike(c, m0);
  assert.deepEqual([r.status, 'marks' in r.body, shut.raw.prepare("SELECT COUNT(*) AS n FROM marks_ledger WHERE kind = 'motherlode'").get().n], [200, false, 0]);
  // nobody walked: none
  const bare = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on' });
  const d = await bare.registered('Dora');
  assert.deepEqual((await bare.call('/v1/prof/motherlodes', { character: d.character }, d.secret)).body.lodes, []);
  clock(T0);
});

test('PROF2b Motherlode Sense is chosen at Mining 100 as any specialisation (PIN MOVED from AUDIT 29 A17: named and locked until its Motherlodes)', () => {
  assert.equal(specOk('mining', 100, 'motherlode-sense'), true);
});
