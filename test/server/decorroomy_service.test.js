// FIELD BUGS 2026-10-29f DECOR-ROOMY (#feature-feedback, "Housing feedback & suggestions after 20 hours of decorating",
// item 6: "Rise the decoration limit for bigger houses ... Some houses, for example in Sentinel, are REALLY WIDE and take
// as much as three times the space of a small house"). A home's room holds pieces by its ground - the measure its price
// was set from, kept with the claim where the price agrees - to DECOR_CAP_MAX; a home bought before names it once.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService } from '../accountDb.mjs';
import { realmAt } from '../realmSeat.mjs';
import { DECOR_CAP, DECOR_CAP_MAX, DECOR_HALL_CAP, decorCapOf } from '../../src/net/decorLaw.js';
import { homeGroundOk, homeGroundKept, homeOnlinePrice, HOME_GROUND_MAX, HOME_PRICE_MAX } from '../../src/net/homeLaw.js';

const RICH = (name) => ({ name, level: 9, goldPieces: 10_000_000, items: [], bankAccounts: new Array(62).fill(0).map(() => ({ accountGold: 0 })) });
const WIDE = { mapId: 1291010263, buildingKey: 0x10203 };
const OLD = { mapId: 1291010263, buildingKey: 0x10204 };
const piece = (id, extra = {}) => ({ id, model: 41000, flat: null, pos: [1.5, 0, -2.25], rot: [90, 0, 0], scale: 1, light: null, storage: false, paid: 180, ...extra });
const fill = (env, at, n) => {
  const ins = env.DB._raw.prepare('INSERT INTO home_decor (map_id, building_key, id, model, place, placed_at, paid, yard) VALUES (?, ?, ?, 41000, ?, 1, 180, 0)');
  for (let i = 0; i < n; i++) ins.run(at.mapId, at.buildingKey, `f${i}`, JSON.stringify(piece(`f${i}`)));
};

test('DECOR-ROOMY the law: a room holds DECOR_CAP to 200 m2 of ground and as much more for each as much more, in tens, to DECOR_CAP_MAX - a ground unknown, DECOR_CAP; a ground stands only where the price is the one it sets (mutants: DECORROOMY-flat-cap, DECORROOMY-no-max, DECORROOMY-no-step, DECORROOMY-price-unheld, DECORROOMY-ground-unbounded)', () => {
  for (const g of [undefined, null, 0, -5, NaN, Infinity, '450']) assert.equal(decorCapOf(g), DECOR_CAP, String(g));
  assert.deepEqual([100, 200, 300, 455, 599, 655, 996].map(decorCapOf), [DECOR_CAP, 200, 300, 450, 590, 600, 600]);
  assert.equal(DECOR_CAP_MAX, 600);
  const price = homeOnlinePrice(450.04, 1);
  assert.equal(homeGroundOk(450.04, 1, price), true);
  assert.equal(homeGroundOk(450.04, 1, price + 100), false, 'another price');
  assert.equal(homeGroundOk(450.04, 4, price), false, 'another town');
  for (const bad of [[0, 1], [-1, 1], [NaN, 1], [HOME_GROUND_MAX + 1, 1], [450.04, -1], [450.04, 65], [450.04, 1.5]]) {
    assert.equal(homeGroundOk(bad[0], bad[1], homeOnlinePrice(bad[0], bad[1])), false, JSON.stringify(bad));
  }
  assert.equal(homeGroundOk(HOME_GROUND_MAX, 1, HOME_PRICE_MAX), true, 'the dearest, at the widest');
  assert.equal(homeGroundKept(450.04), 450);
});

test('DECOR-ROOMY the service: a claim keeps the ground its price agrees with, the room answers its cap, and a batch and a placement fill it to that cap and no further; a claim whose ground and price disagree keeps none and holds DECOR_CAP (mutants: DECORROOMY-claim-unkept, DECORROOMY-claim-unheld, DECORROOMY-batch-flat, DECORROOMY-place-flat, DECORROOMY-list-unsaid)', async () => {
  const { env, call, seated } = await standService();
  const A = await seated('Aldric', { save: RICH('Aldric') });
  const claim = (at, ground, price) => call('/v1/homes/claim', { ...at, region: 17, character: A.character, price, layout: null, realm: A.at(), ground, townBlocks: 1 }, A.secret);
  assert.equal((await claim(WIDE, 450.04, homeOnlinePrice(450.04, 1))).status, 200);
  const row = (at) => env.DB._raw.prepare('SELECT ground FROM homes WHERE map_id = ? AND building_key = ?').get(at.mapId, at.buildingKey);
  assert.equal(row(WIDE).ground, 450, 'kept to a tenth');
  const list = async (at) => (await call('/v1/homes/decor', at, A.secret)).body;
  assert.deepEqual([(await list(WIDE)).cap, (await list(WIDE)).measured], [450, true]);
  fill(env, WIDE, 449);
  const batch = (at, id, rev, txn) => call('/v1/homes/decor/batch', { ...at, character: A.character, realm: realmAt(env, A.character), rev, txn: `roomy-txn-${txn}`, put: [piece(id, { pos: [7, 0, 7] })], drop: [] }, A.secret);
  const last = await batch(WIDE, 'last', 0, '00000001');
  assert.equal(last.status, 200, JSON.stringify(last.body));
  assert.equal((await batch(WIDE, 'over', 1, '00000002')).body.error, 'decor-cap', 'full at its own cap');
  const place = (at, id) => call('/v1/homes/decor/place', { ...at, character: A.character, realm: realmAt(env, A.character), piece: piece(id) }, A.secret);
  assert.equal((await place(WIDE, 'more')).body.error, 'decor-cap');
  env.DB._raw.prepare('DELETE FROM home_decor WHERE map_id = ? AND building_key = ? AND id = ?').run(WIDE.mapId, WIDE.buildingKey, 'f0');
  assert.equal((await place(WIDE, 'more')).status, 200, 'a placement fills to the cap too');
  assert.equal((await list(WIDE)).pieces.length, 450, 'and the room reads whole');
  assert.equal((await claim(OLD, 450.04, homeOnlinePrice(450.04, 1) + 100)).status, 200);
  assert.equal(row(OLD).ground, null, 'a ground its price does not agree with is no ground');
  assert.deepEqual([(await list(OLD)).cap, (await list(OLD)).measured], [DECOR_CAP, false]);
  fill(env, OLD, DECOR_CAP);
  assert.equal((await place(OLD, 'more')).body.error, 'decor-cap');
});

test('DECOR-ROOMY a home bought before: its owner names the ground once - held to its price, kept only where none is, never a stranger\'s word, never a hall\'s - and the room holds the larger cap from then (mutants: DECORROOMY-ground-op-unwired, DECORROOMY-ground-anyone, DECORROOMY-ground-rewritten, DECORROOMY-ground-unheld, DECORROOMY-hall-cap)', async () => {
  const { env, call, seated } = await standService();
  const A = await seated('Aldric', { save: RICH('Aldric') });
  const M = await seated('Mara', { save: RICH('Mara') });
  const price = homeOnlinePrice(450.04, 1);
  assert.equal((await call('/v1/homes/claim', { ...OLD, region: 17, character: A.character, price, layout: null, realm: A.at() }, A.secret)).status, 200, 'an older build names no ground');
  const ground = (who, g) => call('/v1/homes/decor/use', { ...OLD, character: who.character, op: 'ground', ground: g, townBlocks: 1 }, who.secret);
  assert.equal((await ground(M, 450.04)).body.error, 'no-home', 'a stranger names nothing');
  assert.equal((await ground(A, 650)).body.error, 'bad-home', 'a ground its price does not agree with');
  const named = await ground(A, 450.04);
  assert.equal(named.status, 200, JSON.stringify(named.body));
  assert.equal(named.body.ground, 450);
  assert.equal((await ground(A, 450.1)).body.ground, 450, 'once: a second word changes nothing');
  const listed = (await call('/v1/homes/decor', OLD, A.secret)).body;
  assert.deepEqual([listed.cap, listed.measured], [450, true]);
  const owner = env.DB._raw.prepare('SELECT player FROM homes WHERE map_id = ?').get(OLD.mapId).player;
  env.DB._raw.prepare(`INSERT INTO guilds (id, name, name_key, tag, ranks, treasury, founded_at) VALUES ('g1', 'The Hall', 'the hall', 'HALL', '[]', 0, 1)`).run();
  env.DB._raw.prepare('INSERT INTO guild_members (player, char_id, guild_id, rank, name, joined_at) VALUES (?, ?, \'g1\', 0, \'Aldric\', 1)').run(owner, A.character);
  env.DB._raw.prepare('UPDATE homes SET guild_id = \'g1\', ground = NULL WHERE map_id = ? AND building_key = ?').run(OLD.mapId, OLD.buildingKey);
  assert.equal((await call('/v1/homes/decor', OLD, A.secret)).body.cap, DECOR_HALL_CAP, 'a hall keeps its own');
  assert.equal((await ground(A, 450.04)).body.error, 'no-home', 'and names no ground');
});
