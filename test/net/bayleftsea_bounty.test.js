// BAY-LEFT-SEA (2026-10-26; the audit "no system left behind in the Bay", item 20 - B8 = E3; the owner's call taken:
// "Every single thing here needs to be addressed. No exceptions."): A PROVINCE SEAT'S BOUNTY PAYS - past the Bay for its
// bailiwick's own foes' dens, an outlaws' hideout routed (LW12) and a lair whose foe falls (TESA8), by the camp claim's own
// kind of proof (a den's id naming its map pixel; once a day, five an account a day, bounded and not witnessed). The Bay's
// camp Bounty unchanged. The law, the client and the real Worker over node:sqlite (bible/11-Multiplayer/Seats-Arc.md
// BAY-LEFT-SEA).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { standService, T0 } from '../accountDb.mjs';
import {
  bountySitePixel, bountyDenPixel, bountyDenId, bountyClaimPixel, BOUNTY_DEN_KINDS, edictLine, EDICT_WORDS, seatReportText, seatWeekOf,
} from '../../src/net/townSeatLaw.js';
import { createSeatEdicts, lairDenOf, bountyPaidText, bountyDenPaidText, ORC_CAMP_TEXT, BOUNTY_DEN_ASK_GAP_MS } from '../../src/systems/seatEdicts.js';
import { synthesizeLairLocation } from '../../src/world/tamrielDungeons.js';
import { createHideouts } from '../../src/scenes/hideouts.js';
import { createRelations } from '../../src/systems/livingWorld/relations.js';
import { NATIVE_PER_M } from '../../src/systems/livingWorld/trips.js';

const SOLITUDE = { key: 873988097, name: 'Solitude', region: 64, tier: 'crown', pixel: [1569, -430] };
const ANTICLERE = { key: 3021, name: 'Anticlere', region: 21, tier: 'palace', pixel: [402, 151] };

test('BAY-LEFT-SEA A DEN\'S ID: an outlaws\' hideout or a lair past the Bay names its map pixel, canonical, on the world\'s grid - none on the Bay; a camp\'s id the Bay\'s as ever, and an Orc Raid\'s camp never a den (mutants: a den on the Bay; an id not canonical; off the grid; the camp first unread)', () => {
  assert.deepEqual(BOUNTY_DEN_KINDS, ['hideout', 'lair']);
  assert.deepEqual([bountyDenId('lair', 1569, -430), bountyDenId('hideout', -27, 1322), bountyDenId('camp', 1, 1), bountyDenId('lair', 1.5, 2)], ['1569,-430:lair', '-27,1322:hideout', null, null]);
  assert.deepEqual([bountyDenPixel('1569,-430:lair'), bountyDenPixel('-27,1322:hideout'), bountyDenPixel('2069,668:lair')], [[1569, -430], [-27, 1322], [2069, 668]]);
  for (const bad of ['410,150:lair', '0,0:hideout', '999,499:lair', '01569,-430:lair', '1569,-0430:lair', '-0,600:lair', '9000,1:lair', '1569,-430:camp', '1569,-430', 'x']) assert.equal(bountyDenPixel(bad), null, bad);
  assert.equal(bountyDenPixel('-1,250:lair')?.[0], -1, 'west of the Bay\'s edge');
  assert.equal(bountyDenPixel('1000,0:hideout')?.[0], 1000, 'east of it');
  assert.deepEqual([bountyClaimPixel('410,150:91'), bountyClaimPixel('410,150:hold'), bountyClaimPixel('1569,-430:lair'), bountyClaimPixel('410,150:lair')], [[410, 150], [410, 150], [1569, -430], null]);
  assert.equal(bountySitePixel('1569,-430:lair'), null, 'a camp\'s law - the Orc Raids\' (seatInfluence.js) - never takes a den');
});

test('BAY-LEFT-SEA THE SEAT TAB: a Bounty past the Bay says it pays for dens; the Bay\'s says its camps, as ever (mutants: the province unread)', () => {
  assert.equal(edictLine('bounty', 'crown', 'calm', SOLITUDE), 'Bounty: Outlaws\' hideouts and lairs near the town: the treasury pays 20 silver a den cleared, from what is set aside.');
  assert.equal(edictLine('bounty', 'palace', 'calm', ANTICLERE), `Bounty: ${EDICT_WORDS.bounty}`);
  assert.equal(edictLine('bounty', 'palace'), `Bounty: ${EDICT_WORDS.bounty}`, 'no seat named: the camps\'');
  assert.equal(edictLine('levy', 'crown', 'calm', SOLITUDE), `Levy: ${EDICT_WORDS.levy}`);
  assert.ok(readFileSync(new URL('../../src/ui/seatTab.js', import.meta.url), 'utf8').includes("const words = edictLine(chosen, seat.tier, data?.tides?.next ?? 'calm', seat);"));
});

test('BAY-LEFT-SEA THE CLIENT: a den cleared past the Bay in a Bounty seat\'s bailiwick is claimed and its pay said, once in BOUNTY_DEN_ASK_GAP_MS (a lair\'s every foe falls); a camp as ever, asked at each, an Orc Raid\'s count a camp\'s alone; a lair\'s dungeon names its den; a hideout routed tells its host; the world host wires both (mutants: the den unclaimed; the orcs counting a den; the den\'s words a camp\'s; the gap never kept; the gap kept for camps; never asked again; the lair unread; the rout untold; the host unwired)', async () => {
  const claims = [], orcs = [], said = [];
  let now = 1_000_000;
  const held = (seat) => ({ ...seat, holder: { edict: 'bounty' } });
  const se = createSeatEdicts({
    seatAt: () => null, here: () => null, seats: () => [held(SOLITUDE), held(ANTICLERE)], guildId: () => null, minutes: () => 0,
    regionAt: (px, py) => (px === 1569 || px === 1580 ? 64 : px === 410 ? 21 : 63), say: (l) => said.push(l),
    claim: async (site, region) => { claims.push([site, region]); return { paid: 20 }; },
    tideAt: () => 'orcs', orcCamp: async (site) => { orcs.push(site); return { counted: false }; }, nowMs: () => now,
  });
  assert.equal(BOUNTY_DEN_ASK_GAP_MS, 600_000);
  assert.equal(await se.denCleared('lair', 1580, -420), 20);
  assert.equal(await se.campCleared('410,150:91'), 20);
  assert.equal(await se.denCleared('hideout', 1569, -400), 20);
  assert.equal(await se.denCleared('hideout', 410, 150), 0, 'a den on the Bay: none (its Bounty its camps\')');
  assert.equal(await se.denCleared('lair', 200, 900), 0, 'no Bounty seat in its region');
  // the lair's next foes: not asked again inside the gap, asked again past it (the service pays a den once a day)
  now += BOUNTY_DEN_ASK_GAP_MS - 1;
  assert.equal(await se.campCleared('1580,-420:lair'), 0, 'a lair\'s next foe inside the gap: not asked');
  assert.equal(await se.campCleared('410,150:91'), 20, 'a camp\'s next foe asked, as ever');
  now += 1;
  assert.equal(await se.denCleared('lair', 1580, -420), 20, 'past the gap: asked again');
  assert.deepEqual(claims, [['1580,-420:lair', 64], ['410,150:91', 21], ['1569,-400:hideout', 64], ['410,150:91', 21], ['1580,-420:lair', 64]]);
  assert.deepEqual(orcs, ['410,150:91', '410,150:91'], 'an Orc Raid counts camps alone');
  assert.deepEqual(said, [bountyDenPaidText(20), bountyPaidText(20), bountyDenPaidText(20), bountyPaidText(20), bountyDenPaidText(20)]);
  // a hideout routed: its den claimed, quietly (scenes/hideouts.js `routed`, the world host's seatEdicts.hideoutRouted)
  const quiet = [];
  createSeatEdicts({ seatAt: () => null, here: () => null, seats: () => [held(SOLITUDE)], guildId: () => null, minutes: () => 0, regionAt: () => 64,
    claim: async (site) => { quiet.push(site); return { paid: 20 }; } }).hideoutRouted({ key: 'O64.1', px: 1600, py: -380 });
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(quiet, ['1600,-380:hideout']);
  assert.equal(bountyDenPaidText(20), 'The Bounty pays you 20 silver for the den.');
  assert.ok(!said.includes(ORC_CAMP_TEXT));
  // a lair's dungeon as TESA8 stands it names its den; any other place none
  const lair = synthesizeLairLocation({ name: 'T', mapTableData: { mapId: 1 }, exterior: { exteriorData: {} }, dungeon: { header: { blockCount: 1 }, recordElement: { header: {} } } }, { c: 77, px: 1580, py: -420, name: 'The Barrow of Ulf', type: 7, blocks: [] });
  assert.deepEqual([lairDenOf(lair), lairDenOf({ name: 'Daggerfall', mapTableData: {} }), lairDenOf(null)], ['1580,-420:lair', null, null]);
  // a hideout routed tells its host, by its hideout
  const h = { key: 'O64.0', x: 0, z: 0, px: 1600, py: -380, region: 64 };
  const band = { key: 'O64.0~1', gen: 1, heir: 0, name: 'the Black Hand', people: [0, 1].map((i) => ({ id: `O64.0~1.${i}`, name: `Out ${i}`, cls: 138, level: 5, sex: 'male' })) };
  const spawned = [], routed = [], rel = createRelations();
  const host = createHideouts({
    hideoutsNear: () => [h], bandAt: () => band, clock: () => 12 * 60, here: () => ({ x: 50 * NATIVE_PER_M, z: 0 }), ready: () => true, owner: () => true,
    sceneOf: (nx, nz) => [nx / NATIVE_PER_M, 0, nz / NATIVE_PER_M],
    spawn: (type, feet, o) => { const rec = { type, feet, o, dead: false, entity: {} }; spawned.push(rec); return Promise.resolve(rec); },
    remove: () => {}, inPool: (rec) => spawned.includes(rec), relations: () => rel, say: () => {},
    chest: function* () { return { items: [], robbed: [] }; }, dropPile: (items) => ({ items }), removePile: () => {},
    routed: (hh) => routed.push(hh.key),
  });
  const tick = async (n = 1) => { for (let i = 0; i < n; i++) { host.frame(1.01); host.frame(0); await new Promise((r) => setImmediate(r)); } };
  await tick();
  spawned.forEach((r) => { r.dead = true; r.corpse = true; });
  await tick(2);
  assert.deepEqual(routed, ['O64.0']);
  const w = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');
  assert.ok(w.includes("seatEdicts.campCleared(foe?.site ?? lairDenOf(modes?.mode === 'dungeon' ? modes.dungeonLocation : null)).catch(() => {}); });"));
  assert.ok(w.includes('    routed: seatEdicts.hideoutRouted,   // BAY-LEFT-SEA'));
});

test('BAY-LEFT-SEA (the real Worker): a Bounty ruling at Solitude pays for a lair and a hideout in its bailiwick, once a day each and never on the Bay\'s pixels; a Bay seat\'s camp as ever (mutants: the service\'s claim the camps\' alone)', async (t) => {
  const W = seatWeekOf(T0 * 1000);
  t.mock.method(Date, 'now', () => T0 * 1000);
  const svc = await standService({ SEATS_OPEN: 'on', MARKS_OPEN: 'on', PROFESSIONS_OPEN: 'on', BOARD_OPEN: 'on' });
  const raw = svc.env.DB._raw;
  const witnesses = [await svc.guest(), await svc.guest(), await svc.guest()];
  for (const seat of [SOLITUDE, ANTICLERE]) for (const w of witnesses) raw.prepare("INSERT INTO world_witness (kind, key, account, report, region, at) VALUES ('seat', ?, ?, ?, ?, ?)").run(String(seat.key), w.id, seatReportText(seat), seat.region, T0 - 86400);
  const gm = await svc.seated('Gamal', { renown: 12 });
  assert.equal((await svc.found(gm, { name: 'The Silver Hand', tag: 'SH' })).status, 200);
  const gid = raw.prepare('SELECT guild_id FROM guild_members WHERE player = ? AND char_id = ?').get(gm.id, gm.character).guild_id;
  for (const seat of [SOLITUDE, ANTICLERE]) {
    raw.prepare(`INSERT INTO town_seat_holds (key, guild_id, region, tier, since_week, standing, truce_week, at, tithe, owed) VALUES (?, ?, ?, ?, ?, 50, NULL, ?, 6, 0)`).run(seat.key, gid, seat.region, seat.tier, W - 1, T0 - 7 * 86400);
    raw.prepare("INSERT INTO town_seat_edicts (key, week, edict, guild_id, set_by, set_aside, state, at) VALUES (?, ?, 'bounty', ?, 'x', 200, 'law', ?)").run(seat.key, W, gid, T0);
    raw.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid) VALUES ('mint', NULL, 'escrow', ?, 'test', 200, 1, 1, 'seed', NULL, ?)`).run(`bounty:${seat.key}:${W}`, `seed-${seat.key}`);
  }
  const [a, b] = [await svc.seated('Hugo'), await svc.seated('Ilse')];
  const claim = (who, site, region) => svc.call('/v1/seats/bounty', { character: who.character, site, region }, who.secret);
  assert.deepEqual((await claim(a, '1580,-420:lair', 64)).body, { ok: true, paid: 20, key: SOLITUDE.key }, 'a lair in Solitude\'s bailiwick');
  assert.deepEqual((await claim(b, '1580,-420:lair', 64)).body, { ok: true, paid: 0, why: 'claimed' }, 'a den once a day, whoever cleared it');
  assert.deepEqual((await claim(b, '1600,-380:hideout', 64)).body, { ok: true, paid: 20, key: SOLITUDE.key }, 'a hideout routed');
  assert.deepEqual((await claim(a, '1600,-380:hideout', 63)).body, { ok: true, paid: 0, why: 'no-bounty' }, 'the region the claim names holds no Bounty seat');
  assert.equal((await claim(a, '410,150:lair', 21)).body.error, 'bad-bounty', 'a den on the Bay\'s pixels is none');
  assert.equal((await claim(a, '01580,-420:lair', 64)).body.error, 'bad-bounty');
  assert.deepEqual((await claim(a, '410,150:91', 21)).body, { ok: true, paid: 20, key: ANTICLERE.key }, 'the Bay\'s camp as ever');
  assert.deepEqual(raw.prepare('SELECT site, key FROM town_seat_bounties ORDER BY site').all().map((r) => [r.site, Number(r.key)]), [['1580,-420:lair', SOLITUDE.key], ['1600,-380:hideout', SOLITUDE.key], ['410,150:91', ANTICLERE.key]]);
});
