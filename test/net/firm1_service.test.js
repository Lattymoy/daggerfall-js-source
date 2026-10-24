// FIRM1 (2026-10-13) - THE FIRMAMENT, AS THE SERVICE KEEPS IT (server-account/src/firmament.js; the law
// src/net/firmament/firmamentLaw.js): the switch, the purses read off the Renown and profession tracks, a change judged whole by
// the law, a request asked twice charged once, a refund free below Renown 10 and silver after it, and the tree's hand
// on a harvest's XP. Driven through the real Worker over node:sqlite with every migration applied (test/accountDb.mjs).
// bible/06-Systems/Firmament.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService, T0 } from '../accountDb.mjs';
import { pathTo, packTree, treeStats, xpPct, scaleXp, starsFor, craftPointsFor, REFUND_SILVER_PER_STAR, FIRM_RESPEC_GOLD } from '../../src/net/firmament/firmamentLaw.js';
import { seatRealm } from '../realmSeat.mjs';
import { haulKey } from '../../src/net/nodeLaw.js';
import { harvestXp, xpForRank } from '../../src/net/professionLaw.js';
import { utcDay } from '../../src/net/marksLaw.js';
import { sharedClassicMinutes } from '../../src/net/wire.js';

const DAY = 86_400;
const hourAt = (s) => Math.floor((((Math.floor(sharedClassicMinutes(s * 1000)) % 1440) + 1440) % 1440) / 60);
function secondAt(from, want) {
  for (let s = from; s < from + 2 * 7200; s += 30) if (hourAt(s) === want && hourAt(s - 60) === want && hourAt(s + 60) === want) return s;
  throw new Error('no such hour');
}
const NOON = secondAt(utcDay(T0) * DAY + 3600, 12);
const realNow = Date.now;
Date.now = () => NOON * 1000;
test.after(() => { Date.now = realNow; });
let _rid = 0, _id = 0;
const rid = () => `firm-${String(++_rid).padStart(6, '0')}`;
const hid = () => (++_id).toString(16).padStart(12, '0');

/** A tree walked from `start` to each of `targets` in turn, by the law's own shortest path. */
function walk(start, ...targets) {
  const tree = { start, keys: [] };
  for (const t of targets) tree.keys.push(...pathTo(tree, t));
  return tree;
}

async function stand(env = { FIRMAMENT_OPEN: 'on' }) {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', DEVELOPER_HANDLES: 'Mac', ...env });
  const raw = s.env.DB._raw;
  const state = (who) => s.call('/v1/firmament/state', { character: who.character }, who.secret);
  const set = (who, tree, id = rid()) => s.call('/v1/firmament/set', { character: who.character, tree: typeof tree === 'string' ? tree : packTree(tree), rid: id }, who.secret);
  const row = (who) => raw.prepare('SELECT tree FROM firmament WHERE player = ? AND char_id = ?').get(who.id, who.character)?.tree ?? null;
  const setXp = (who, profession, xp) => raw.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, updated_at) VALUES (?, ?, ?, ?, 1)
    ON CONFLICT (player, char_id, profession) DO UPDATE SET xp = excluded.xp`).run(who.id, who.character, profession, xp);
  const balance = (who) => Number(raw.prepare('SELECT balance FROM marks WHERE account = ?').get(who.id)?.balance ?? 0);
  return { ...s, raw, state, set, row, setXp, balance };
}

test('FIRM1 service: the switch - off by default (firm-closed, 403), at "dev" the developers alone, "on" everyone', async () => {
  const off = await stand({});
  const a = await off.seated('Ana', { renown: 5 });
  assert.deepEqual([(await off.state(a)).status, (await off.state(a)).body], [403, { error: 'firm-closed' }]);
  const dev = await stand({ FIRMAMENT_OPEN: 'dev' });
  const mac = await dev.seated('Mac', { renown: 5 }), bo = await dev.seated('Bobby', { renown: 5 });
  assert.equal((await dev.state(mac)).status, 200);
  assert.equal((await dev.state(bo)).status, 403);
});

test('FIRM1 service: the purses - Stars off the Renown track (2 a level past the first), Craft off the profession ranks (1 per 8) - and the view', async () => {
  const s = await stand();
  const mac = await s.seated('Mac', { renown: 6 });
  s.setXp(mac, 'mining', xpForRank(40));
  s.setXp(mac, 'smithing', xpForRank(30));
  const r = await s.state(mac);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.tree, r.body.renown, r.body.stars, r.body.craft], ['', 6, starsFor(6), craftPointsFor([40, 30])]);
  assert.deepEqual([r.body.stars, r.body.craft], [10, 8]);
  assert.deepEqual(r.body.left, { stars: 10, craft: 8 });
  assert.deepEqual(r.body.ranks, { mining: 40, smithing: 30 });
});

test('FIRM1 service: a change judged whole - a sign chosen and walked within the Stars; one star more, a star cut off, a key the sky has not, a start among the stars - each refused, the row unmoved', async () => {
  const s = await stand();
  const mac = await s.seated('Mac', { renown: 5 });   // 8 Stars
  const tree = walk('mg.start', 'mg.k1');   // mg.s1 .. mg.k1: six stars
  assert.equal(tree.keys.length, 6);
  const ok = await s.set(mac, tree);
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.deepEqual([ok.body.tree, ok.body.silver, ok.body.left], [packTree(tree), 0, { stars: 2, craft: 0 }]);
  assert.equal(s.row(mac), packTree(tree));
  const nine = walk('mg.start', 'mg.c5.3');
  assert.ok(nine.keys.length > 8);
  assert.deepEqual((await s.set(mac, nine)).body, { error: 'firm-points' });
  assert.deepEqual((await s.set(mac, { start: 'mg.start', keys: ['mg.s1', 'mg.g'] })).body, { error: 'firm-path' });
  assert.deepEqual((await s.set(mac, 'mg.start|mg.s1,mg.nowhere')).body, { error: 'firm-key' });
  assert.deepEqual((await s.set(mac, 'mg.start|mg.s1,mg.s1')).body, { error: 'firm-key' });
  assert.deepEqual((await s.set(mac, 'mg.start|wr.start')).body, { error: 'firm-key' });
  assert.deepEqual((await s.set(mac, 'zz.start|')).body, { error: 'firm-start' });
  assert.equal(s.row(mac), packTree(tree), 'every refusal left the tree as it was');
});

test('FIRM1 service: the Craft purse pays the life ring alone - a crafter with no Renown walks the Wayfarer\'s Road to the trades, and never into a fight', async () => {
  const s = await stand();
  const smith = await s.seated('Smith', { renown: 1 });   // no Stars at all
  s.setXp(smith, 'smithing', xpForRank(100));
  s.setXp(smith, 'mining', xpForRank(100));   // 25 Craft points
  const life = walk('wr.start', 'wr.l2.3');
  assert.ok(life.keys.every((k) => !k.includes('.s') && !k.includes('.g')), 'the road out is the Wayfarer\'s');
  const r = await s.set(smith, life);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual((await s.set(smith, { start: 'wr.start', keys: ['wr.s1'] })).body, { error: 'firm-points' }, 'a combat star is never Craft\'s to pay');
});

test('FIRM1 service: asked twice, one change - the repeat answered from its row; an id another character\'s refused', async () => {
  const s = await stand();
  const mac = await s.seated('Mac', { renown: 4 });
  const id = rid();
  const tree = walk('th.start', 'th.g');
  const a = await s.set(mac, tree, id);
  const b = await s.set(mac, tree, id);
  assert.equal(a.status, 200);
  assert.deepEqual([b.body.repeat, b.body.tree], [true, packTree(tree)]);
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM firmament_sets WHERE player = ?').get(mac.id).n, 1);
  const other = await s.call('/v1/firmament/set', { character: 'char-another', tree: packTree(tree), rid: id }, mac.secret);
  assert.deepEqual([other.status, other.body], [400, { error: 'firm-rid' }]);
});

test('FIRM1 service: a refund - free below Renown 10; past it, 10 silver a star taken back, burnt in the change\'s batch, refused short (marks-short) with nothing moved', async () => {
  const s = await stand();
  const young = await s.seated('Young', { renown: 9 });
  const tree = walk('st.start', 'st.r2');
  assert.equal((await s.set(young, tree)).status, 200);
  const back = await s.set(young, { start: 'st.start', keys: tree.keys.slice(0, 2) });
  assert.deepEqual([back.status, back.body.silver], [200, 0], 'below Renown 10 a refund is free');

  const old = await s.seated('Old', { renown: 12 });
  const t2 = walk('wr.start', 'wr.r2');
  assert.equal((await s.set(old, t2)).status, 200, 'a first sign costs nothing');
  const less = { start: 'wr.start', keys: t2.keys.slice(0, 3) };
  const short = await s.set(old, less);
  assert.deepEqual([short.status, short.body], [409, { error: 'marks-short', silver: 2 * REFUND_SILVER_PER_STAR }]);
  assert.equal(s.row(old), packTree(t2));
  s.seedMarks(old, 100);
  const paid = await s.set(old, less);
  assert.deepEqual([paid.status, paid.body.silver, paid.body.balance], [200, 20, 80]);
  assert.equal(s.balance(old), 80);
  assert.equal(s.row(old), packTree(less));
  const line = s.raw.prepare("SELECT kind, amount, dst_kind, who FROM marks_ledger WHERE actor = ? AND kind = 'firmament'").get(old.id);
  assert.deepEqual({ ...line }, { kind: 'firmament', amount: 20, dst_kind: 'burn', who: old.character });
  // a new sign takes every star back
  const moved = await s.set(old, walk('mg.start', 'mg.s2'));
  assert.deepEqual([moved.status, moved.body.silver], [200, 3 * REFUND_SILVER_PER_STAR]);
});

test('FIRM1 service: THE TREE\'S HAND ON A HARVEST - the haul\'s XP the profession\'s percent more, on the service\'s own reckoning; no tree, no change', async () => {
  const s = await stand();
  const mac = await s.seated('Mac', { renown: 1 });
  s.setXp(mac, 'fishing', xpForRank(55));
  s.setXp(mac, 'mining', xpForRank(100));
  s.setXp(mac, 'herbalism', xpForRank(100));
  const haul = () => s.call('/v1/prof/harvest', { character: mac.character, node: haulKey({ x: 300, y: 200, day: utcDay(NOON), id: hid() }), kind: 'fish', climate: 231, region: 17, act: { clean: false }, at: NOON - 2, rid: rid() }, mac.secret);
  const plain = await haul();
  assert.equal(plain.status, 200, JSON.stringify(plain.body));
  assert.equal(plain.body.xp, harvestXp(5, 55, false));
  const tree = walk('st.start', 'st.lk');   // the Steed's life keystone: Master and Commander, +3% Fishing XP (FIRM2: every sign's stars sum under the cap)
  assert.equal((await s.set(mac, tree)).status, 200);
  const pct = xpPct(treeStats(tree), 'fishing');
  assert.ok(pct >= 1, `the walk out carries Fishing XP (${pct})`);
  const fished = await haul();
  assert.equal(fished.body.xp, scaleXp(harvestXp(5, 55, false), pct));
  assert.ok(fished.body.xp >= plain.body.xp);   // FIRM2: a haul of five XP floors a few percent to nothing
});

test('FIRM1 service: THE RESPEC - the whole sky back for 10,000 gold, paid on a realm character\'s record in the respec\'s own batch; asked twice, charged once; short of gold, nothing moves', async () => {
  const s = await stand();
  const mac = await s.seated('Mac', { renown: 30 });
  const R = await seatRealm(s.env, mac.secret, 'Mac', { name: 'Mac', level: 9, goldPieces: FIRM_RESPEC_GOLD + 2500, items: [] });
  s.raw.prepare('UPDATE renown_tracks SET char_id = ? WHERE player = ? AND char_id = ?').run(R.id, mac.id, mac.character);
  mac.character = R.id;
  const tree = walk('wr.start', 'wr.k1');
  assert.equal((await s.set(mac, tree)).status, 200);
  const gold = () => { const row = s.raw.prepare('SELECT obj FROM realm_characters WHERE id = ?').get(R.id); return JSON.parse(new TextDecoder().decode(s.env.SAVES._map.get(row.obj))).goldPieces; };
  const respec = (id, at = R.at()) => s.call('/v1/firmament/respec', { character: R.id, rid: id, realm: at }, mac.secret);
  assert.equal((await s.call('/v1/firmament/respec', { character: R.id, rid: rid() }, mac.secret)).body.error, 'realm-needed', 'a realm character names where its record stands');
  const id = rid();
  const at = R.at();
  const r = await respec(id, at);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.tree, r.body.respec, r.body.gold, r.body.realm.seq], ['', true, FIRM_RESPEC_GOLD, at.seq + 1]);
  assert.equal(s.row(mac), '');
  assert.equal(gold(), 2500, 'the record paid');
  const again = await respec(id, at);   // the answer lost: asked again where the record stood - it is one on, so it landed
  assert.deepEqual([again.status, again.body.error, again.body.seq], [409, 'seq', at.seq + 1]);
  assert.equal(gold(), 2500, 'charged once');
  assert.equal((await respec(rid())).body.error, 'firm-respec-empty', 'an empty sky has nothing to take back');
  assert.equal((await s.set(mac, tree)).status, 200);
  const short = await respec(rid());
  assert.deepEqual([short.status, short.body.error], [409, 'realm-gold']);
  assert.equal(s.row(mac), packTree(tree), 'nothing moved');
});
