// SEASON1 part two, the economy's Tides (2026-10-01, Mac: "Finish the seats"; "Continue"; "Hurry up"): A HARVEST, A
// BLIGHT, A STORM SEASON AND A BANDIT SUMMER (bible/11-Multiplayer/Seats-Arc.md 9.3) - the law (each kind's multiplier,
// the courier's factor, the yields' Tide after the March's) and, through the real Worker, a tree felled on confirmed
// ground in Daggerfall's Harvest and Blight weeks and a courier bought into Daggerfall in its Bandit Summer, each set
// against a twin service counting no Season; unconfirmed ground no Tide. The rolls are the law's: Daggerfall's Harvest
// falls in week W+8 of T0's, its Blight in W+10, its Bandit Summer in W+5 - pinned here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { standService, T0 } from '../accountDb.mjs';
import { tideOf, tideYield, tideCourier, HARVEST_KINDS, TIDE_EFFECTS } from '../../src/net/tideLaw.js';
import { trees, nodeKey, treeYield, herbYield, foodYield, veinYield, boulderYield, haulYield, MARCH_MULT } from '../../src/net/nodeLaw.js';
import { xpForRank } from '../../src/net/professionLaw.js';
import { courierSeconds, roadPixels } from '../../src/net/marketLaw.js';
import { seatWeekOf } from '../../src/net/townSeatLaw.js';
import { sharedClassicMinutes } from '../../src/net/wire.js';
import { utcDay } from '../../src/net/marksLaw.js';

const DAY = 86_400;
const W = seatWeekOf(T0 * 1000);
const WOODS = 231, GLENUMBRA = 59;   // a Daggerfall region
const hourAt = (s) => Math.floor((((Math.floor(sharedClassicMinutes(s * 1000)) % 1440) + 1440) % 1440) / 60);
function noonOf(day) {
  for (let s = day * DAY + 3600; s < day * DAY + 3600 + 2 * 7200; s += 30) if (hourAt(s) === 12 && hourAt(s - 60) === 12 && hourAt(s + 60) === 12) return s;
  throw new Error('no noon');
}
let _now = T0;
const realNow = Date.now;
const clock = (s) => { _now = s; Date.now = () => _now * 1000; };
test.after(() => { Date.now = realNow; });
let _rid = 0;
const rid = () => `tide-${String(++_rid).padStart(6, '0')}`;
const realRandom = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
async function steered(b, fn) {
  globalThis.crypto.getRandomValues = (arr) => (arr.byteLength === 4 ? (new Uint8Array(arr.buffer, arr.byteOffset, 4).fill(b), arr) : realRandom(arr));
  try { return await fn(); } finally { globalThis.crypto.getRandomValues = realRandom; }
}

test('SEASON1 THE ECONOMY\'S TIDES, THE LAW: a Harvest a quarter more on the land\'s gathering (never the net), a Blight a quarter less on herbs and wood alone, a Storm Season half again on the net alone; a Bandit Summer\'s courier twice as long; each yield takes its Tide after the March\'s (mutants: each Tide; each kind; the factor; the order)', () => {
  assert.deepEqual([...HARVEST_KINDS], ['herb', 'food', 'tree', 'vein', 'boulder']);
  const kinds = ['herb', 'food', 'tree', 'vein', 'boulder', 'haul'];
  assert.deepEqual(kinds.map((k) => tideYield('harvest', k)), [1.25, 1.25, 1.25, 1.25, 1.25, 1]);
  assert.deepEqual(kinds.map((k) => tideYield('blight', k)), [0.75, 1, 0.75, 1, 1, 1]);
  assert.deepEqual(kinds.map((k) => tideYield('storms', k)), [1, 1, 1, 1, 1, 1.5]);
  assert.deepEqual(kinds.map((k) => tideYield('calm', k)), [1, 1, 1, 1, 1, 1]);
  assert.deepEqual(['bandits', 'calm', 'storms'].map(tideCourier), [TIDE_EFFECTS.banditsCourier, 1, 1]);
  const top = 0.999;
  assert.deepEqual([treeYield({ roll: 4, tideMult: 1.25 }, top), treeYield({ roll: 4, tideMult: 0.75 }, top), treeYield({ roll: 4, march: true, tideMult: 1.25 }, top)], [5, 3, Math.floor(4 * MARCH_MULT * 1.25)]);
  assert.deepEqual([herbYield({ roll: 4, tideMult: 0.75 }, top), foodYield({ roll: 4, tideMult: 1.25 }, top), veinYield({ roll: 4, tideMult: 1.25 }, top), boulderYield({ roll: 4, tideMult: 1.25 }, top).qty], [3, 5, 5, 5]);
  assert.equal(haulYield({ roll: 2, tideMult: 1.5 }, top), 3, 'the net, before a school\'s fish');
  assert.equal(haulYield({ roll: 2, school: true, tideMult: 1.5 }, 0), 3 + 1, 'a school\'s fish added after the Tide (before it, 4.5 - and the low dice\'s fifth)');
  // the wiring: every kind of ground's yield asks its own Tide, on confirmed ground alone
  const prof = readFileSync(new URL('../../server-account/src/professions.js', import.meta.url), 'utf8');
  assert.match(prof, /const tide = !deep && !isBody && confirmed \? tideNow\(env, nowS, region\) : 'calm';/);
  for (const k of ['haul', 'tree', 'herb', 'food', 'boulder', 'vein']) assert.match(prof, new RegExp(`tideMult: tideYield\\(tide, '${k}'\\)`), k);
  const mkt = readFileSync(new URL('../../server-account/src/market.js', import.meta.url), 'utf8');
  assert.equal((mkt.match(/courierSlow\(env, nowS, region\)/g) ?? []).length, 3, 'the read\'s quote, the buy and the bid');
});

async function stand(zero) {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on', DEVELOPER_HANDLES: 'Mac', ...(zero != null ? { SEASON_ZERO_WEEK: String(zero) } : {}) });
  const raw = s.env.DB._raw;
  const confirm = async (x, y, climate, region) => {
    for (const h of ['WitA', 'WitB', 'WitC']) {
      const w = await s.seated(`${h}${x}`);
      raw.prepare("INSERT OR IGNORE INTO world_witness (kind, key, account, report, region, at) VALUES ('pixel', ?, ?, ?, ?, ?)").run(`${x},${y}`, w.id, `${climate},${region}`, region, _now - 9 * DAY);
    }
  };
  const setXp = (who, xp, prof) => raw.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, spec50, spec100, updated_at) VALUES (?, ?, ?, ?, NULL, NULL, ?)
    ON CONFLICT (player, char_id, profession) DO UPDATE SET xp = excluded.xp`).run(who.id, who.character, prof, xp, _now);
  return { ...s, raw, confirm, setXp };
}

test('SEASON1 THE ECONOMY\'S TIDES IN THE SERVICE, AGAINST A TWIN: a tree on confirmed ground in Daggerfall\'s Harvest gives a quarter more, in its Blight a quarter less; on unconfirmed ground no Tide; a courier into Daggerfall in its Bandit Summer takes twice as long, quoted and bought (mutants: the Tide read; the confirmed gate; the kind; the courier)', async () => {
  assert.deepEqual([tideOf(W + 8, 'daggerfall'), tideOf(W + 10, 'daggerfall'), tideOf(W + 5, 'daggerfall')], ['harvest', 'blight', 'bandits'], 'the rolls this test stands on');
  const fell = async (zero, week, confirmed) => {
    clock(noonOf(utcDay(T0) + (week - W) * 7));
    const s = await stand(zero);
    const mac = await s.seated('Mac');
    s.setXp(mac, xpForRank(10), 'logging');
    const day = utcDay(_now);
    let t = null;
    for (let x = 300; x < 900 && !t; x++) {
      const hit = trees({ x, y: 210, day, climate: WOODS, confirmed }).find((q) => q.material === 'log:oak');
      if (hit) t = { x, y: 210, ...hit, key: nodeKey({ kind: 'tree', x, y: 210, day, slot: hit.slot }) };
    }
    if (confirmed) await s.confirm(t.x, t.y, WOODS, GLENUMBRA);
    const body = { character: mac.character, node: t.key, kind: 'logs', climate: WOODS, region: GLENUMBRA, act: { cuts: 0, clean: false }, at: _now - 2, rid: rid() };
    const r = await steered(0xff, () => s.call('/v1/prof/harvest', body, mac.secret));
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return r.body.qty;
  };
  assert.deepEqual([await fell(null, W + 8, true), await fell(W, W + 8, true)], [4, 5], 'the Harvest: a quarter more on four logs');
  assert.deepEqual([await fell(null, W + 10, true), await fell(W, W + 10, true)], [4, 3], 'the Blight: a quarter less');
  assert.deepEqual([await fell(W, W + 8, false)], [4], 'unconfirmed ground: no Tide');
  // a courier from Wayrest into Daggerfall
  const DF = 17, WR = 23;
  const HUBS = { [DF]: [207, 212], [WR]: [590, 166] };
  const ROAD = roadPixels({ x: 207, y: 212 }, { x: 590, y: 166 });
  const courier = async (zero) => {
    clock(T0 + 5 * 7 * DAY);
    const s = await stand(zero);
    const mac = await s.seated('Mac'), ann = await s.seated('Ann');
    s.raw.prepare('UPDATE players SET registered_at = ? WHERE id = ?').run(_now - 9 * DAY, ann.id);
    s.raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, 'ore:mithril', 'own', 100)`).run(mac.id, mac.character);
    for (const [who, n] of [[mac, 100], [ann, 1000]]) s.raw.prepare('INSERT INTO marks (account, balance) VALUES (?, ?) ON CONFLICT (account) DO UPDATE SET balance = excluded.balance').run(who.id, n);
    const { body: { listing: l } } = await s.call('/v1/market/list', { character: mac.character, region: WR, kind: 'material', material: 'ore:mithril', units: 45, price: 8, hubs: HUBS, rid: rid() }, mac.secret);
    const quote = (await s.call('/v1/market/read', { character: ann.character, region: DF, view: 'materials', hubs: HUBS }, ann.secret)).body.rows[0].road;
    const r = await s.call('/v1/market/buy', { character: ann.character, region: DF, listing: l.id, units: 45, max: 999, hubs: HUBS, rid: rid() }, ann.secret);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return [quote.seconds, r.body.sale.arrivesAt - _now];
  };
  assert.deepEqual(await courier(null), [courierSeconds(ROAD), courierSeconds(ROAD)]);
  assert.deepEqual(await courier(W), [2 * courierSeconds(ROAD), 2 * courierSeconds(ROAD)], 'the Bandit Summer: twice as long');
});
