// WAGON-ARMS PASS A (2026-10-16) - the wire half and its contract, nothing more.
// `og` is the owner's guild tag and nothing else. There is no `ob`: the tag's presence IS the broadcast.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { validParkData } from '../src/net/wire.js';
import { GUILD_ARMS_TAGS_MAX } from '../src/net/guildLaw.js';
import {
  hccWireRecord, validHccRecord, hccRecordKey, HCC_WIRE_KIND,
  wagonArmsOfWire,
} from '../src/systems/horseCartWire.js';
import { standService } from './accountDb.mjs';
import { ACCEPTED } from '../src/net/legalLaw.js';

const P = [1, 2, 3];
const R = [0, 0, 0, 1];

test('WAGON-ARMS PASS A client: og travels on a small cart and on an open wagon, neither a guild door', () => {
  for (const kind of [HCC_WIRE_KIND.Trailing, HCC_WIRE_KIND.Following]) {
    const rec = hccWireRecord({ wagon: { kind, position: [1, 2, 3], rotation: R, tier: 0, angle: 0, model: 'cart', arms: { tag: 'IRON' } } });
    assert.equal(rec.og, 'IRON', 'the owner\'s guild is on the wire');
    assert.equal(rec.we, undefined, 'no guild door rides with it');
    assert.equal(rec.wg, undefined, 'no door guild either');
  }
  const kept = validParkData({ c: 'char-0001', a: [10, 10], r: { w: [2, 10, 1, 10, 0, 0, 0, 1, 0, 0], og: 'IRON' } });
  assert.equal(kept.r.og, 'IRON', 'the tag survives the park word');
  assert.equal(kept.r.wg, undefined, 'and the door keeps none');
  assert.equal(kept.r.we, undefined, 'the door stays private');
});

test('WAGON-ARMS PASS A client: og is gated, but a bad tag drops the field alone and never the team', () => {
  const base = { c: 'char-0001', a: [10, 10], r: { w: [2, 10, 1, 10, 0, 0, 0, 1, 0, 0], og: 'IRON', n: 'Bay', h: [12, 1, 12, 0, 1, 0] } };
  for (const bad of ['iron', 'I', 'IRONIC', 1, null, '', 'IRON  ']) {
    const r = validParkData({ ...base, r: { ...base.r, og: bad } });
    assert.ok(r && r.r && r.r.w, `a bad tag does not refuse the team (${JSON.stringify(bad)})`);
    assert.equal(r.r.og, undefined, `a bad tag is not a guild (${JSON.stringify(bad)})`);
  }
  // a good tag still passes
  const good = validParkData({ ...base });
  assert.equal(good.r.og, 'IRON');
  // out-of-range shaped like a tag but unknown to the guard? the shape is the only law on the wire; the service decides existence
  assert.equal(validParkData({ ...base, r: { ...base.r, og: 'NOWA' } }).r.og, 'NOWA');
});

test('WAGON-ARMS PASS A client: no guild means no og, and the reader gets null', () => {
  const rec = hccWireRecord({ wagon: { kind: 2, position: [1, 2, 3], rotation: R, tier: 0, angle: 0, model: 'caravan', arms: null } });
  assert.equal(rec.og, undefined);
  assert.equal(wagonArmsOfWire(undefined), null);
  assert.equal(wagonArmsOfWire(''), null);
  assert.equal(wagonArmsOfWire('nope'), null);
  const read = validHccRecord(hccWireRecord({ wagon: { kind: 2, position: [1, 2, 3], rotation: R, tier: 0, angle: 0, model: 'caravan' } }));
  assert.equal(read.w.arms, null, 'no tag on the wire, nothing to draw');
});

test('WAGON-ARMS PASS A client: a guild with the setting on sends og, and the reader gets { tag }', () => {
  const raw = hccWireRecord({ wagon: { kind: 2, position: [1, 2, 3], rotation: R, tier: 0, angle: 0, model: 'caravan', arms: { tag: 'IRON' } } });
  assert.equal(raw.og, 'IRON');
  const read = validHccRecord(raw);
  assert.deepEqual(read.w.arms, { tag: 'IRON' }, 'the reader gets the tag and nothing else');
  assert.deepEqual(wagonArmsOfWire('IRON'), { tag: 'IRON' });
  // the contract has exactly two outcomes: nothing drawn, or the arms of that tag drawn
  assert.equal(JSON.stringify(wagonArmsOfWire('IRON')), '{"tag":"IRON"}');
});

test('WAGON-ARMS PASS A client: the two reader outcomes are nothing vs draw, and never a third', () => {
  // The redundant flag is not re-minted: there is no broadcast field and no "withdrawn" state on the wire.
  assert.equal('broadcast' in (wagonArmsOfWire('IRON') ?? {}), false, 'no broadcast flag is ever minted');
  assert.ok(wagonArmsOfWire('IRON'), 'draw');
  assert.equal(wagonArmsOfWire(null), null, 'nothing');
  // a gate that fails closed does not exist here: absence is absence, and there is no "off" bit to forget
  assert.equal(typeof wagonArmsOfWire('IRON').tag, 'string');
});

test('WAGON-ARMS PASS A client: hccRecordKey changes when og changes, and stands still when nothing did', () => {
  const ironRaw = hccWireRecord({ wagon: { kind: 2, position: [1, 2, 3], rotation: R, tier: 0, angle: 0, model: 'caravan', arms: { tag: 'IRON' } }, horse: { position: [4, 1, 4], forward: [1, 0, 0], walking: false }, name: 'Bay' });
  const goldRaw = hccWireRecord({ wagon: { kind: 2, position: [1, 2, 3], rotation: R, tier: 0, angle: 0, model: 'caravan', arms: { tag: 'GOLD' } }, horse: { position: [4, 1, 4], forward: [1, 0, 0], walking: false }, name: 'Bay' });
  const noneRaw = hccWireRecord({ wagon: { kind: 2, position: [1, 2, 3], rotation: R, tier: 0, angle: 0, model: 'caravan' }, horse: { position: [4, 1, 4], forward: [1, 0, 0], walking: false }, name: 'Bay' });
  const cloneRaw = JSON.parse(JSON.stringify(ironRaw));
  assert.notEqual(hccRecordKey(ironRaw), hccRecordKey(goldRaw), 'a changed guild moves the key');
  assert.notEqual(hccRecordKey(ironRaw), hccRecordKey(noneRaw), 'turning the arms off moves the key');
  assert.equal(hccRecordKey(ironRaw), hccRecordKey(cloneRaw), 'nothing else changes it');
  assert.equal(hccRecordKey(null), '');
});

test('WAGON-ARMS PASS A endpoint: arms by tag for a guild in none of seats/homes/board/writs; no existence leak; batch bound', async () => {
  const s = await standService();
  const raw = s.env.DB._raw;
  const gid = 'g1234567890';
  raw.prepare("INSERT INTO guilds (id, name, name_key, tag, ranks, treasury, founded_at, heraldry) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run(gid, 'Test Guild', 'testguild', 'TSTG', JSON.stringify(['M','O','R','C']), 0, 1_800_000_000, JSON.stringify({ field: 'azure', border: 'gold', device: 'wolf' }));
  const g = await s.call('/v1/auth/guest', { ...ACCEPTED });
  assert.equal(g.status, 200);
  const secret = g.body.secret;

  let r = await s.call('/v1/guilds/arms', { tags: ['TSTG', 'NOPE'] }, secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.arms.length, 2);
  assert.deepEqual(r.body.arms[0], { tag: 'TSTG', name: 'Test Guild', heraldry: { field: 'azure', border: 'gold', device: 'wolf' } });
  assert.deepEqual(r.body.arms[1], { tag: 'NOPE', name: null, heraldry: null }, 'an unknown tag leaks nothing beyond null/null');

  const bound = await s.call('/v1/guilds/arms', { tags: Array.from({ length: GUILD_ARMS_TAGS_MAX }, () => 'TSTG') }, secret);
  assert.equal(bound.status, 200, 'the batch bound is allowed');

  const tooBig = await s.call('/v1/guilds/arms', { tags: Array.from({ length: GUILD_ARMS_TAGS_MAX + 1 }, () => 'TSTG') }, secret);
  assert.notEqual(tooBig.status, 200, 'past the bound is refused whole');

  const badTag = await s.call('/v1/guilds/arms', { tags: ['TST!'] }, secret);
  assert.notEqual(badTag.status, 200, 'a tag off the shape is refused whole, not cut');
});
