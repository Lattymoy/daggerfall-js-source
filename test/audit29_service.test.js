// AUDIT 29 (2026-09-28, Mac: "Lets audit everything so far before we continue") - THE PROFESSIONS' SERVICE, AS THE
// AUDIT FOUND IT, through the real Worker over node:sqlite (test/accountDb.mjs): a node taken once whatever its
// spelling; the day's harvests bounded an account as well as a character; the dungeons nobody vouched for four veins a
// day; a dissent on confirmed ground written down; a signature's own slot; a region's ground by its pixels' facts;
// the XP answered as credited; a paid change of specialisation one track's, asked as the client saw it; a free one
// answered again after the switch; Motherlode Sense refused; a writ's same-id race and a writ one filled oneself.
// Each pin failed on the code before its fix. bible/06-Systems/Online-Arc.md AUDIT 29.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService, T0 } from './accountDb.mjs';
import { veins, nodeCount, nodeKey, dveinKey, herbPatches } from '../src/net/nodeLaw.js';
import { xpForRank, PROF_XP_MAX, HARVESTS_PER_DAY, HARVESTS_PER_ACCOUNT_DAY, DEEP_UNCONFIRMED_PER_DAY, RESPEC } from '../src/net/professionLaw.js';
import { sharedClassicMinutes } from '../src/net/wire.js';
import { utcDay } from '../src/net/marksLaw.js';

const DAY = 86_400;
const WOODS = 231, MOUNTAIN = 226, WAYREST = 23, GLENUMBRA = 59, ANTICLERE = 21, DAGGERFALL = 17;
const hourAt = (s) => Math.floor((((Math.floor(sharedClassicMinutes(s * 1000)) % 1440) + 1440) % 1440) / 60);
function secondAt(from, want) {
  for (let s = from; s < from + 2 * 7200; s += 30) if (hourAt(s) === want && hourAt(s - 60) === want && hourAt(s + 60) === want) return s;
  throw new Error('no such hour');
}
const NOON = secondAt(utcDay(T0) * DAY + 3600, 12);
let _now = NOON;
const realNow = Date.now;
const clock = (s) => { _now = s; Date.now = () => _now * 1000; };
test.after(() => { Date.now = realNow; });
clock(NOON);
let _rid = 0;
const rid = () => `a29-${String(++_rid).padStart(6, '0')}`;
const today = () => utcDay(_now);

async function stand(extra = {}) {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', DEVELOPER_HANDLES: 'Mac', ...extra });
  const raw = s.env.DB._raw;
  const age = (who, days) => raw.prepare('UPDATE players SET registered_at = ? WHERE id = ?').run(_now - days * DAY, who.id);
  const give = (who, m, origin, qty) => raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = excluded.qty`).run(who.id, who.character, m, origin, qty);
  const setXp = (who, xp, prof = 'mining', char = who.character) => raw.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, updated_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (player, char_id, profession) DO UPDATE SET xp = excluded.xp`).run(who.id, char, prof, xp, _now);
  const xpOf = (who, prof = 'mining') => Number(raw.prepare('SELECT xp FROM prof_tracks WHERE player = ? AND char_id = ? AND profession = ?').get(who.id, who.character, prof)?.xp ?? 0);
  return { ...s, raw, age, give, setXp, xpOf };
}
const ore = (who, key, climate, region, extra = {}) => ({ character: who.character, node: key, kind: 'ore', climate, region, act: { glints: 0 }, at: _now - 2, rid: rid(), ...extra });
/** A Woodlands vein of tier 1, unconfirmed, on a pixel of its own. */
function tier1Vein(from = 300) {
  for (let x = from; x < 900; x++) {
    const v = veins({ x, y: 200, day: today(), climate: WOODS, region: GLENUMBRA }).find((q) => q.tier === 1);
    if (v) return { x, key: nodeKey({ kind: 'vein', x, y: 200, day: today(), slot: v.slot }), ...v };
  }
  throw new Error('no vein');
}
/** Three accounts a week registered witness a pixel's ground as (climate, region), through the harvest. */
async function confirmPixel(s, x, y, climate, region, tag = 'W') {
  const ws = [];
  for (let i = 0; i < 3; i++) {
    const w = await s.registered(`${tag}${x}x${i}`);
    s.age(w, 8);
    const v = veins({ x, y, day: today(), climate, region })[0];
    const r = await s.call('/v1/prof/harvest', ore(w, nodeKey({ kind: 'vein', x, y, day: today(), slot: v.slot }), climate, region), w.secret);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    ws.push(w);
  }
  return ws;
}
/**
 * TWO REQUESTS RACING, STAGED as two Worker isolates would run them on D1: each request's first read of `match` waits
 * until `n` requests have made it, so both pass their lookups before either writes.
 */
function staged(s, match, n = 2) {
  const prepare = s.env.DB.prepare;
  const held = [];
  let open = false;
  s.env.DB.prepare = (sql) => {
    const st = prepare(sql);
    if (!open && sql.includes(match)) {
      const first = st.first;
      st.first = async (...a) => {
        const row = await first.apply(st, a);
        if (!open) await new Promise((res) => { held.push(res); if (held.length >= n) { open = true; held.forEach((r) => r()); } });
        return row;
      };
    }
    return st;
  };
  return () => { s.env.DB.prepare = prepare; };
}

// ─── A NODE, ONCE ────────────────────────────────────────────────────

test('AUDIT 29 A1: a node spelt with a leading zero is no node - the day\'s once is the node\'s, not its spelling\'s', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  const v = tier1Vein();
  const r = await s.call('/v1/prof/harvest', ore(mac, v.key, WOODS, GLENUMBRA), mac.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  for (const alt of [v.key.replace(`vein:${v.x}:`, `vein:0${v.x}:`), v.key.replace(':200:', ':0200:'), `${v.key}0`.replace(/:(\d+)0$/, ':0$1')]) {
    assert.deepEqual((await s.call('/v1/prof/harvest', ore(mac, alt, WOODS, GLENUMBRA), mac.secret)).body, { error: 'bad-node' }, alt);
  }
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM node_harvests WHERE player = ?').get(mac.id).n, 1);
});

// ─── THE ACCOUNT'S DAY ───────────────────────────────────────────────

test('AUDIT 29 A3: the day\'s harvests are bounded an account too - characters invented by the id fill no more than two characters\' days a profession', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  assert.equal(HARVESTS_PER_ACCOUNT_DAY, 2 * HARVESTS_PER_DAY);
  const ins = s.raw.prepare(`INSERT INTO node_harvests (day, node, kind, player, char_id, profession, material, qty, xp, at, rid, n)
    VALUES (?, ?, 'ore', ?, ?, 'mining', 'metal:iron', 1, 15, ?, ?, 'x')`);
  for (let i = 0; i < HARVESTS_PER_ACCOUNT_DAY; i++) ins.run(today(), `vein:1:1:${today()}:${i}`, mac.id, `alt-${String(i % 4).padStart(4, '0')}`, _now, `seed-${i}-xxxx`);
  const v = tier1Vein();
  const r = await s.call('/v1/prof/harvest', ore(mac, v.key, WOODS, GLENUMBRA), mac.secret);
  assert.deepEqual([r.status, r.body], [409, { error: 'prof-account-cap' }], 'a fifth character, never used today, refused');
  assert.equal((await s.call('/v1/prof/harvest', { ...ore(mac, herbNode(), WOODS, GLENUMBRA), kind: 'herbs' }, mac.secret)).status, 200, 'another profession\'s day is its own');
});
function herbNode() {
  const p = herbPatches({ x: 300, y: 200, day: today(), climate: WOODS })[0];
  return nodeKey({ kind: 'herb', x: 300, y: 200, day: today(), slot: p.slot });
}

test('AUDIT 29 A5: a dungeon nobody has vouched for gives an account four veins a day - its id the client\'s word, so invented dungeons buy four Silver, not the day', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.setXp(mac, xpForRank(25));
  assert.equal(DEEP_UNCONFIRMED_PER_DAY, 4);
  clock(secondAt(today() * DAY + 60, 2));
  for (let i = 0; i < DEEP_UNCONFIRMED_PER_DAY; i++) {
    const r = await s.call('/v1/prof/harvest', ore(mac, dveinKey({ dungeon: 777000 + i, day: today(), slot: 0 }), MOUNTAIN, WAYREST), mac.secret);
    assert.equal(r.status, 200, JSON.stringify(r.body));
  }
  const fifth = await s.call('/v1/prof/harvest', ore(mac, dveinKey({ dungeon: 777999, day: today(), slot: 0 }), MOUNTAIN, WAYREST), mac.secret);
  assert.deepEqual([fifth.status, fifth.body], [409, { error: 'prof-deep-cap' }]);
  clock(NOON);
});

// ─── THE WITNESSED GROUND ────────────────────────────────────────────

test('AUDIT 29 A4: a claim against confirmed ground is refused AND written down (an account a week old) - the dissent a dispute is made of', async () => {
  const s = await stand();
  await confirmPixel(s, 500, 200, WOODS, ANTICLERE);
  const key = '500,200';
  clock(NOON + 60);   // after the confirmation, as a dissent is
  for (const h of ['Honest1', 'Honest2']) {
    const w = await s.registered(h);
    s.age(w, 8);
    const v = veins({ x: 500, y: 200, day: today(), climate: WOODS, region: GLENUMBRA })[0];
    const r = await s.call('/v1/prof/harvest', ore(w, nodeKey({ kind: 'vein', x: 500, y: 200, day: today(), slot: v.slot }), WOODS, GLENUMBRA), w.secret);
    assert.deepEqual([r.status, r.body], [409, { error: 'prof-pixel' }]);
  }
  assert.equal(s.raw.prepare("SELECT COUNT(*) AS n FROM world_witness WHERE kind = 'pixel' AND key = ? AND region = ?").get(key, GLENUMBRA).n, 2, 'both dissents kept');
  const mac = await s.registered('Mac');
  const px = (await s.call('/v1/prof/pixels', { character: mac.character, pixels: [[500, 200]] }, mac.secret)).body.pixels[0];
  assert.equal(px.state, 'disputed');
  clock(NOON);
});

test('AUDIT 29 A11: a region\'s ground is its pixels\' facts over EVERY report - a pixel one early report named for Daggerfall and three confirmed for Anticlere is Anticlere\'s', async () => {
  const s = await stand();
  const early = await s.registered('Early');
  s.age(early, 8);
  const v = veins({ x: 520, y: 200, day: today(), climate: WOODS, region: DAGGERFALL })[0];
  assert.equal((await s.call('/v1/prof/harvest', ore(early, nodeKey({ kind: 'vein', x: 520, y: 200, day: today(), slot: v.slot }), WOODS, DAGGERFALL), early.secret)).status, 200);
  clock(NOON + 60);
  await confirmPixel(s, 520, 200, WOODS, ANTICLERE);
  clock(NOON);
  const mac = await s.registered('Mac');
  assert.deepEqual((await s.call('/v1/writs/list', { character: mac.character, region: DAGGERFALL }, mac.secret)).body.writs, [], 'none of Daggerfall\'s ground');
  assert.equal((await s.call('/v1/writs/list', { character: mac.character, region: ANTICLERE }, mac.secret)).body.writs.length, 6);
});

test('AUDIT 29 A6: a confirmed pixel\'s signature is a slot of its own, after the climate\'s - taken by the service; no such slot unconfirmed', async () => {
  const s = await stand();
  await confirmPixel(s, 540, 200, MOUNTAIN, WAYREST);
  const mac = await s.registered('Mac');
  s.setXp(mac, xpForRank(100));
  const n = nodeCount(MOUNTAIN, 'vein');
  const r = await s.call('/v1/prof/harvest', ore(mac, nodeKey({ kind: 'vein', x: 540, y: 200, day: today(), slot: n }), MOUNTAIN, WAYREST), mac.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.material, 'ore:mithril');
  const u = await s.call('/v1/prof/harvest', ore(mac, nodeKey({ kind: 'vein', x: 560, y: 200, day: today(), slot: n }), MOUNTAIN, WAYREST), mac.secret);
  assert.deepEqual(u.body, { error: 'bad-node' }, 'an unconfirmed pixel holds no signature slot');
});

// ─── THE XP, AS CREDITED ─────────────────────────────────────────────

test('AUDIT 29 A14: a harvest\'s XP is answered as credited - a track two short of the most says +2, not the harvest\'s +3', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.setXp(mac, PROF_XP_MAX - 2);
  const r = await s.call('/v1/prof/harvest', ore(mac, tier1Vein().key, WOODS, GLENUMBRA), mac.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.xp, s.xpOf(mac)], [2, PROF_XP_MAX], 'a tier-1 vein at Master is a quarter of 15 - 3 - and two of it had room');
});

test('AUDIT 29 A7 + A14: a smelt\'s Smithing XP keeps the quarter at the smith\'s rank, and is answered as credited under the crafter\'s limit', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.setXp(mac, xpForRank(40), 'smithing');
  s.give(mac, 'metal:iron', 'own', 20);
  const r = await s.call('/v1/prof/smelt', { character: mac.character, recipe: 'ingot:iron', count: 10, rid: rid() }, mac.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.xp, 25, 'Iron (tier 1) at Smithing 40: a quarter of 100');
  // two crafts past Journeyman: Smithing stops at 50
  const ann = await s.registered('Ann');
  s.setXp(ann, xpForRank(60), 'alchemy');
  s.setXp(ann, xpForRank(60), 'carpentry');
  s.setXp(ann, xpForRank(51) - 3, 'smithing');
  s.give(ann, 'metal:iron', 'own', 20);
  const c = await s.call('/v1/prof/smelt', { character: ann.character, recipe: 'ingot:iron', count: 10, rid: rid() }, ann.secret);
  assert.equal(c.status, 200, JSON.stringify(c.body));
  assert.equal(c.body.xp, 2, 'two credited, not the smelt\'s whole');
});

// ─── A SPECIALISATION ────────────────────────────────────────────────

test('AUDIT 29 A2: a paid change is its own track\'s - the same id raced for two tracks changes one, and the other is refused', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  for (const p of ['herbalism', 'mining']) s.setXp(mac, xpForRank(50), p);
  s.raw.prepare("UPDATE prof_tracks SET spec50 = CASE profession WHEN 'herbalism' THEN 'gardener' ELSE 'prospector' END WHERE player = ?").run(mac.id);
  s.seedMarks(mac, 5000);
  const id = rid();
  const release = staged(s, 'FROM marks_ledger WHERE actor = ?1 AND rid = ?2');
  const [a, b] = await Promise.all([
    s.call('/v1/prof/spec', { character: mac.character, profession: 'herbalism', rank: 50, spec: 'botanist', from: 'gardener', rid: id }, mac.secret),
    s.call('/v1/prof/spec', { character: mac.character, profession: 'mining', rank: 50, spec: 'deep-delver', from: 'prospector', rid: id }, mac.secret),
  ]);
  release();
  assert.equal(s.raw.prepare("SELECT COUNT(*) AS n FROM marks_ledger WHERE kind = 'respec'").get().n, 1, 'one burn');
  const pending = s.raw.prepare('SELECT profession FROM prof_tracks WHERE player = ? AND respec_to IS NOT NULL').all(mac.id).map((r) => r.profession);
  assert.equal(pending.length, 1, 'one change for the one burn');
  assert.deepEqual([a.status, b.status].sort(), [200, 400]);
  assert.ok([a.body.error, b.body.error].includes('prof-rid'));
});

test('AUDIT 29 A15: a paid change is asked as the client saw the track - a choice it thought free, made meanwhile elsewhere, is refused, not charged', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.setXp(mac, xpForRank(50), 'herbalism');
  s.raw.prepare("UPDATE prof_tracks SET spec50 = 'gardener' WHERE player = ?").run(mac.id);
  s.seedMarks(mac, 5000);
  const r = await s.call('/v1/prof/spec', { character: mac.character, profession: 'herbalism', rank: 50, spec: 'botanist', from: null, rid: rid() }, mac.secret);
  assert.deepEqual([r.status, r.body], [409, { error: 'prof-spec-stale' }]);
  assert.equal(s.raw.prepare("SELECT COUNT(*) AS n FROM marks_ledger WHERE kind = 'respec'").get().n, 0, 'nothing burnt');
  const ok = await s.call('/v1/prof/spec', { character: mac.character, profession: 'herbalism', rank: 50, spec: 'botanist', from: 'gardener', rid: rid() }, mac.secret);
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(ok.body.marks, RESPEC.marks);
});

test('AUDIT 29 A13: a free first choice is a request like any other - asked again after the switch shut, it is answered as made', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.setXp(mac, xpForRank(50), 'herbalism');
  const body = { character: mac.character, profession: 'herbalism', rank: 50, spec: 'gardener', from: null, rid: rid() };
  assert.equal((await s.call('/v1/prof/spec', body, mac.secret)).status, 200);
  s.env.PROFESSIONS_OPEN = 'off';
  const again = await s.call('/v1/prof/spec', body, mac.secret);
  assert.equal(again.status, 200, JSON.stringify(again.body));
  assert.equal(again.body.repeat, true);
  assert.deepEqual(again.body.track.specs, { 50: 'gardener', 100: null });
});

test('AUDIT 29 A17: Motherlode Sense was refused by the service until its Motherlodes - PIN MOVED (PROF2b, 2026-10-03): chosen at Mining 100 as any', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.setXp(mac, xpForRank(100));
  const r = await s.call('/v1/prof/spec', { character: mac.character, profession: 'mining', rank: 100, spec: 'motherlode-sense', from: null, rid: rid() }, mac.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.track.specs[100], 'motherlode-sense');
});

// ─── A COURT WRIT ────────────────────────────────────────────────────

async function writsReady(s) {
  const w = await s.registered('WitA');
  s.age(w, 8);
  const p = herbPatches({ x: 300, y: 200, day: today(), climate: WOODS })[0];
  await s.call('/v1/prof/harvest', { character: w.character, node: nodeKey({ kind: 'herb', x: 300, y: 200, day: today(), slot: p.slot }), kind: 'herbs', climate: WOODS, region: ANTICLERE, act: {}, at: _now - 2, rid: rid() }, w.secret);
}

test('AUDIT 29 A16: a writ one filled oneself, asked again with a new id (the answer lost, the page reloaded), is answered as one\'s own - never "another has filled it"', async () => {
  const s = await stand();
  await writsReady(s);
  const mac = await s.registered('Mac');
  const w = (await s.call('/v1/writs/list', { character: mac.character, region: ANTICLERE }, mac.secret)).body.writs[0];
  s.give(mac, w.material, 'own', w.qty);
  assert.equal((await s.call('/v1/writs/deliver', { character: mac.character, id: w.id, rid: rid() }, mac.secret)).status, 200);
  const again = await s.call('/v1/writs/deliver', { character: mac.character, id: w.id, rid: rid() }, mac.secret);
  assert.equal(again.status, 200, JSON.stringify(again.body));
  assert.equal(again.body.repeat, true);
  assert.equal(s.raw.prepare("SELECT COUNT(*) AS n FROM marks_ledger WHERE kind = 'writ'").get().n, 1, 'paid once');
});

test('AUDIT 29 A12: one id raced over two writs fills one and answers the other as that one - never a 500', async () => {
  const s = await stand();
  await writsReady(s);
  const mac = await s.registered('Mac');
  const ws = (await s.call('/v1/writs/list', { character: mac.character, region: ANTICLERE }, mac.secret)).body.writs;
  for (const w of ws) s.give(mac, w.material, 'own', 100);
  const id = rid();
  const release = staged(s, 'SELECT * FROM writs WHERE filled_by = ?1 AND rid = ?2');
  const rs = await Promise.all([ws[0], ws[1]].map((w) => s.call('/v1/writs/deliver', { character: mac.character, id: w.id, rid: id }, mac.secret)));
  release();
  assert.deepEqual(rs.map((r) => r.status), [200, 200], JSON.stringify(rs.map((r) => r.body)));
  assert.equal(rs.filter((r) => r.body.repeat).length, 1);
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM writs WHERE filled_by = ?').get(mac.id).n, 1);
});
