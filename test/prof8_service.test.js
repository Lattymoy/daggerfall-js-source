// PROF8 (2026-09-30, Mac: "Continue the arc"; "XP follows your rank") - FISHING WITH THE NET, AS THE SERVICE KEEPS IT: a
// haul's key the client's own (`haul:<x>:<y>:<day>:<id>`) - bounded, not witnessed - its Raw Fish into the Stores as own,
// worked at the rank's own tier; a full net x1.5, a school's fish; at sea on ground the witnesses confirmed a Pearl and a
// Slaughterfish's scales, a trophy anywhere (said again to an answer asked twice); an ACCOUNT's hauls a day counted, past forty (CAP-OFF); the
// daylight kept; the pixel witnessed. Driven through the real Worker over node:sqlite with every migration applied
// (test/accountDb.mjs). bible/06-Systems/Professions-Arc.md 30.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService, T0 } from './accountDb.mjs';
import { haulKey, pixelReport, SEA_REGION } from '../src/net/nodeLaw.js';
import { harvestXp, xpForRank, haulTier, PEARL } from '../src/net/professionLaw.js';
import { sharedClassicMinutes } from '../src/net/wire.js';
import { utcDay } from '../src/net/marksLaw.js';

const DAY = 86_400;
const WOODS = 231, OCEAN = 223, DAGGERFALL = 17;
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
const rid = () => `fish-${String(++_rid).padStart(6, '0')}`;
const hid = () => (++_id).toString(16).padStart(12, '0');

/** Every die the service rolls at nought for `fn`'s length: every chance hits, every roll its least. */
async function zeroDice(fn) {
  const real = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
  globalThis.crypto.getRandomValues = (b) => { if (b.byteLength === 4) { b.fill(0); return b; } return real(b); };
  try { return await fn(); } finally { globalThis.crypto.getRandomValues = real; }
}

async function stand() {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', DEVELOPER_HANDLES: 'Mac' });
  const raw = s.env.DB._raw;
  const stores = (who, m) => raw.prepare('SELECT origin, qty FROM prof_stores WHERE player = ? AND char_id = ? AND material = ? ORDER BY origin')
    .all(who.id, who.character, m).map((r) => [r.origin, Number(r.qty)]);
  const setXp = (who, xp) => raw.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, updated_at) VALUES (?, ?, 'fishing', ?, 1)
    ON CONFLICT (player, char_id, profession) DO UPDATE SET xp = excluded.xp`).run(who.id, who.character, xp);
  /** A pixel the witnesses confirmed: three accounts a week old said it. */
  const confirm = async (x, y, climate, region) => {
    for (const h of ['WitA', 'WitB', 'WitC']) {
      const w = await s.registered(`${h}${x}`);
      raw.prepare('INSERT INTO world_witness (kind, key, account, report, region, at) VALUES (?, ?, ?, ?, ?, ?)').run('pixel', `${x},${y}`, w.id, pixelReport(climate, region), region, T0);
    }
  };
  const haul = (who, { x = 300, y = 200, climate = WOODS, region = DAGGERFALL, act = { clean: false }, at = NOON - 2, day = utcDay(NOON), kind = 'fish', node } = {}) => s.call('/v1/prof/harvest', {
    character: who.character, node: node ?? haulKey({ x, y, day, id: hid() }), kind, climate, region, act, at, rid: rid(),
  }, who.secret);
  return { ...s, raw, stores, setXp, confirm, haul };
}

test('PROF8 service: a haul - Raw Fish into the Stores as own, 1-2 of them; Fishing XP at the rank\'s own tier (a Novice 15, a full net 22; a rank 55 angler 75); the account\'s hauls said; asked twice one', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  const r = await s.haul(mac);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.material, r.body.kind, r.body.track.profession, r.body.xp, r.body.hauls], ['food:fish', 'fish', 'fishing', harvestXp(1, 0, false), 1]);
  assert.ok(r.body.qty >= 1 && r.body.qty <= 3, `1-2 fish, a march or not (${r.body.qty})`);
  assert.deepEqual(s.stores(mac, 'food:fish'), [['own', r.body.qty]]);
  const full = await s.haul(mac, { act: { clean: true } });
  assert.equal(full.body.xp, harvestXp(1, 0, true));
  assert.equal(harvestXp(1, 0, true), 22);
  // XP FOLLOWS THE RANK: a rank 55 angler's haul is worked at tier 5 - never a Novice's 15, quartered to 3
  s.setXp(mac, xpForRank(55));
  const master = await s.haul(mac);
  assert.equal(haulTier(55), 5);
  assert.equal(master.body.xp, harvestXp(5, 55, false));
  assert.equal(master.body.xp, 75);
  assert.ok(harvestXp(1, 55, false) < 10, 'at its catch\'s own tier it would have been quartered');
  // asked twice: one
  const body = { character: mac.character, node: haulKey({ x: 301, y: 200, day: utcDay(NOON), id: hid() }), kind: 'fish', climate: WOODS, region: DAGGERFALL, act: { clean: false }, at: NOON - 2, rid: rid() };
  const a = await s.call('/v1/prof/harvest', body, mac.secret);
  const b = await s.call('/v1/prof/harvest', body, mac.secret);
  assert.deepEqual([b.body.repeat, b.body.qty, b.body.node], [true, a.body.qty, a.body.node]);
  assert.deepEqual((await s.call('/v1/prof/harvest', { ...body, rid: rid() }, mac.secret)).body, { error: 'node-taken' }, 'a haul\'s key is one haul');
  // the state says the day - CAP-OFF: and no bound after it
  const st = await s.call('/v1/prof/state', { character: mac.character }, mac.secret);
  assert.deepEqual([st.body.hauls, st.body.caps.hauls], [4, undefined]);
});

test('PROF8 service: at sea on ground the witnesses confirmed, a Pearl and a Slaughterfish\'s scales (a fish more); a trophy anywhere, said again to an answer asked twice; on unconfirmed ground or inland, no Pearl and no scales', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  await s.confirm(500, 90, OCEAN, SEA_REGION);
  const sea = await zeroDice(() => s.haul(mac, { x: 500, y: 90, climate: OCEAN, region: SEA_REGION }));
  assert.equal(sea.status, 200, JSON.stringify(sea.body));
  assert.deepEqual([sea.body.gem, sea.body.extra, sea.body.extraQty, sea.body.trophy], [PEARL.key, 'hide:slaughterfish', 1, true]);
  assert.equal(sea.body.qty, 2, 'the least roll, one, and the Slaughterfish\'s weight');
  assert.deepEqual([s.stores(mac, PEARL.key), s.stores(mac, 'hide:slaughterfish')], [[['own', 1]], [['own', 1]]]);
  const again = await s.call('/v1/prof/harvest', { character: mac.character, node: sea.body.node, kind: 'fish', climate: OCEAN, region: SEA_REGION, act: {}, at: NOON - 2, rid: `fish-${String(_rid).padStart(6, '0')}` }, mac.secret);
  assert.deepEqual([again.body.repeat, again.body.trophy], [true, true], 'the trophy said again - the client puts it in the pack on the answer');
  // unconfirmed sea: the dice at nought, and still no Pearl and no scales
  const open = await zeroDice(() => s.haul(mac, { x: 510, y: 90, climate: OCEAN, region: SEA_REGION }));
  assert.deepEqual([open.body.gem, open.body.extra, open.body.trophy, open.body.qty], [undefined, undefined, true, 1]);
  // confirmed ground, but inland water: the same
  await s.confirm(310, 200, WOODS, DAGGERFALL);
  const river = await zeroDice(() => s.haul(mac, { x: 310, y: 200 }));
  assert.deepEqual([river.body.gem, river.body.extra], [undefined, undefined]);
  // a school's fish: the least roll and one; a full net's step x1.5 first
  const school = await zeroDice(() => s.haul(mac, { act: { clean: true, school: 1 } }));
  assert.equal(school.body.qty, 3, 'one x1.5, its fraction the dice\'s nought, and the school\'s one');
  const lied = await zeroDice(() => s.haul(mac, { act: { clean: false, school: 7 } }));
  assert.equal(lied.body.qty, 1, 'a school past the two is none');
});

test('PROF8 service: an ACCOUNT\'s hauls a day past forty (CAP-OFF) - the forty-first credited, on another character too, the account\'s count said; the kind and the key\'s one spelling; hauled by night too (ANY-HOUR); the pixel witnessed by a haul', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  for (let i = 0; i < 40; i++) {
    const r = await s.haul(mac, { x: 320 + (i % 5) });
    assert.equal(r.status, 200, `haul ${i + 1}: ${JSON.stringify(r.body)}`);
  }
  // PIN MOVED (CAP-OFF, 2026-10-07 - Mac: "Remove the cap on life skills"): the account's day held forty hauls - the
  // forty-first was `prof-fish-cap`, on another character too
  const over = await s.haul(mac);
  assert.deepEqual([over.status, over.body.hauls], [200, 41], JSON.stringify(over.body));
  const alt = { ...mac, character: 'char-mac-alt' };
  const other = await s.haul(alt);
  assert.deepEqual([other.status, other.body.hauls], [200, 42], 'the account\'s hauls, counted across its characters');
  const ann = await s.registered('Ann');
  assert.deepEqual((await s.haul(ann, { kind: 'hide' })).body, { error: 'prof-kind' });
  const day = utcDay(NOON);
  assert.deepEqual((await s.haul(ann, { node: `haul:0300:200:${day}:${hid()}` })).body, { error: 'bad-node' }, 'one spelling');
  assert.deepEqual((await s.haul(ann, { node: `haul:300:200:${day}:XYZ` })).body, { error: 'bad-node' });
  assert.deepEqual((await s.haul(ann, { day: day - 1 })).body, { error: 'prof-day' });
  // PIN MOVED (ANY-HOUR, 2026-10-01, Mac: "Remove the time limit for professions. Should be available at any time"):
  // 23:00 refused a haul (`prof-night`, "the wilderness keeps Foraging's day"); now the net is hauled as at noon
  const night = secondAt(utcDay(NOON) * DAY + 3600, 23);
  Date.now = () => night * 1000;
  try {
    const dark = await s.haul(ann, { at: night - 2 });
    assert.equal(dark.status, 200, JSON.stringify(dark.body));
  } finally { Date.now = () => NOON * 1000; }
  // a haul from an account a week old witnesses its pixel
  s.raw.prepare('UPDATE players SET registered_at = ? WHERE id = ?').run(NOON - 9 * DAY, ann.id);
  assert.equal((await s.haul(ann, { x: 700, y: 60, climate: OCEAN, region: SEA_REGION })).status, 200);
  assert.deepEqual({ ...s.raw.prepare("SELECT report FROM world_witness WHERE kind = 'pixel' AND key = '700,60' AND account = ?").get(ann.id) }, { report: pixelReport(OCEAN, SEA_REGION) });
});
