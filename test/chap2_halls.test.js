// CHAP2a (2026-10-07, Mac: "Do it") - THE CHAPTERS' HALLS AND THEIR WRITS: a town's guild halls witnessed as a seat is
// (three registered accounts a week old agree), a region's chapters the guilds its confirmed towns name; each chapter
// posts its own writs on the Notice Board beside the Court's, from the Court's law and the guild's own kinds, sharing the
// Court's three a day; a hall writ pays as a Court writ does and its guild remembers it on the Roll (+2, outside the
// claims' pace); and the Roll records a new membership only where its standing meets DFU's join.
// bible/11-Multiplayer/Chapters-Arc.md section 4 (CHAP2a).
//
// The law (src/net/npcChapterLaw.js) against literals; the client's halls (src/net/npcHallBook.js) against a fake
// faction file and door; the service (server-account/src/npcHalls.js, professions.js, npcRoll.js) over the real
// migrations; the tracker's refresh; and the host's wiring.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  HALL_WITNESS_KIND, HALL_WRIT_REP, hallWritCount, hallWritId, hallFamiliesOf, hallWrits, hallReportOf, hallReportText,
  parseHallReport, joinRecordable, hallPosterName, ROLL_FACTIONS,
} from '../src/net/npcChapterLaw.js';
import { regionWritTable, courtWrits, material } from '../src/net/nodeLaw.js';
import { hallFactionsOf, createHallBook, HALL_REPORTED_KEY, HALL_STOPS, HALL_DONE } from '../src/net/npcHallBook.js';
import { createRollTracker } from '../src/net/npcRollTracker.js';
import { GUILD_GROUPS, FACTION_TYPES } from '../src/formats/factionFile.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { regionChapters, forgetChapters, witnessHall, CHAPTERS_KEPT_MS } from '../server-account/src/npcHalls.js';
import { readRoll, claimRoll } from '../server-account/src/npcRoll.js';
import { herbPatches, nodeKey, pixelKey } from '../src/net/nodeLaw.js';
import { COURT_WRITS_PER_DAY } from '../src/net/professionLaw.js';
import { sharedClassicMinutes } from '../src/net/wire.js';
import { utcDay } from '../src/net/marksLaw.js';
import { standService, T0 } from './accountDb.mjs';
import { seatRealm } from './realmSeat.mjs';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const DAY = 86_400;
const WOODS = 231, ANTICLERE = 21;

// ── THE LAW ─────────────────────────────────────────────────────────

test('CHAP2a the hall writs\' numbers: two a chapter a day per hundred active (never none), +2 to the guild, their own id and kind (mutants: the scale, the floor)', () => {
  assert.deepEqual([0, 1, 100, 101, 200, 201, -5, NaN].map(hallWritCount), [2, 2, 2, 4, 4, 6, 2, 2]);
  assert.equal(HALL_WRIT_REP, 2);
  assert.equal(HALL_WITNESS_KIND, 'npchall');
  assert.equal(hallWritId(20000, 21, 40, 1), 'h:20000:21:40:1');
});

test('CHAP2a a chapter\'s writs: the Court\'s law over the guild\'s own kinds - the Dark Brotherhood\'s herbs, the Fighters\' metal and wood - the whole table where the region yields none; its own dice, the same all day (mutants: the kinds unread, the Court\'s dice)', () => {
  assert.deepEqual([40, 41, 42, 108, 21, 368, 510].map(hallFamiliesOf), [
    ['herbs', 'metals'], ['metals', 'wood'], ['metals', 'herbs', 'wood', 'stone'], ['herbs'], ['herbs'], ['metals', 'wood'], [],
  ]);
  const table = regionWritTable(ANTICLERE, [{ climate: WOODS, confirmed: true }], 'summer');
  const fam = (w) => material(w.material).family;
  const db = hallWrits(20000, ANTICLERE, 108, 4, table);
  assert.equal(db.length, 4);
  assert.ok(db.every((w) => fam(w) === 'herbs'));
  const fg = hallWrits(20000, ANTICLERE, 41, 4, table);
  assert.ok(fg.every((w) => fam(w) === 'metals' || fam(w) === 'wood'));
  assert.deepEqual(hallWrits(20000, ANTICLERE, 41, 4, table), fg, 'the same all day');
  assert.notDeepEqual(hallWrits(20000, ANTICLERE, 42, 4, table), courtWrits(20000, ANTICLERE, 4, table), 'a chapter\'s own dice - the Thieves\' kinds are the whole table, and still not the Court\'s writs');
  assert.notDeepEqual(hallWrits(20000, ANTICLERE, 368, 4, table), fg, 'and each chapter its own - an order asks the kinds the Fighters do, and other writs');
  assert.notDeepEqual(hallWrits(20001, ANTICLERE, 41, 4, table), fg, 'a new day, new writs');
  const stoneOnly = table.filter((m) => fam(m) === 'stone');
  assert.ok(hallWrits(20000, ANTICLERE, 108, 2, stoneOnly).every((w) => fam(w) === 'stone'), 'none of its kinds: the whole table');
  assert.deepEqual(hallWrits(20000, ANTICLERE, 510, 2, table), [], 'no guild, no writs');
});

test('CHAP2a a hall report: a map id, a region and the twenty-two alone, each once, sorted - one canonical text, so witnesses agree byte for byte (mutants: a duplicate let in, the text\'s order)', () => {
  assert.deepEqual(hallReportOf({ key: 1234, region: ANTICLERE, factions: [41, 40] }), { key: 1234, region: ANTICLERE, factions: [40, 41] });
  for (const bad of [
    { key: 1234, region: ANTICLERE, factions: [] }, { key: 1234, region: ANTICLERE, factions: [40, 40] },
    { key: 1234, region: ANTICLERE, factions: [510] }, { key: -1, region: ANTICLERE, factions: [40] },
    { key: 2 ** 32, region: ANTICLERE, factions: [40] }, { key: 1.5, region: ANTICLERE, factions: [40] },
    { key: 1234, region: 62, factions: [40] }, { key: 1234, region: ANTICLERE, factions: ['40'] }, null,
  ]) assert.equal(hallReportOf(bad), null, JSON.stringify(bad));
  const h = hallReportOf({ key: 1234, region: ANTICLERE, factions: [108, 40] });
  assert.equal(hallReportText(h), '[1234,21,[40,108]]');
  assert.deepEqual(parseHallReport('[1234,21,[40,108]]'), h);
  assert.equal(parseHallReport('[1234,21,[108,40]]'), null, 'a text that is not its own canonical bytes');
  assert.equal(parseHallReport('[1234, 21, [40,108]]'), null);
  assert.equal(parseHallReport(null), null);
});

test('CHAP2a the join: the Roll records a new membership only at DFU\'s join floor - a standing of 0 or more (mutants: the floor\'s side)', () => {
  assert.deepEqual([-100, -1, 0, 1, 100].map(joinRecordable), [false, false, true, true, true]);
});

test('CHAP2a a chapter\'s name: the guild as DFU captions its hall, a temple by its divine\'s whole name; none for no guild', () => {
  assert.deepEqual([40, 41, 42, 108, 22, 26, 368, 411, 414, 510].map(hallPosterName), [
    'Mages Guild', 'Fighters Guild', 'Thieves Guild', 'Dark Brotherhood', 'Temple of Zenithar', 'Temple of Akatosh',
    'Knights of the Dragon', 'Host of the Horn', 'Order of the Raven', null,
  ]);
  assert.ok(ROLL_FACTIONS.every((f) => typeof hallPosterName(f) === 'string'), 'every one of the twenty-two has a name');
});

// ── THE CLIENT'S HALLS ──────────────────────────────────────────────

/** A faction file as DFU's dict holds the rows the halls read: the guilds' own, a divine with its templar child, an
 *  order, the merchants, and a commoners' faction of the GeneralPopulace group. */
function dict() {
  const rows = [
    { id: 40, type: FACTION_TYPES.Group, ggroup: GUILD_GROUPS.MagesGuild },
    { id: 41, type: FACTION_TYPES.Group, ggroup: GUILD_GROUPS.FightersGuild },
    { id: 42, type: FACTION_TYPES.Group, ggroup: GUILD_GROUPS.GeneralPopulace },
    { id: 108, type: FACTION_TYPES.Group, ggroup: GUILD_GROUPS.DarkBrotherHood },
    { id: 21, type: FACTION_TYPES.God, ggroup: GUILD_GROUPS.None, children: [82] },
    { id: 82, type: FACTION_TYPES.Temple, ggroup: GUILD_GROUPS.HolyOrder, parent: 21 },
    { id: 368, type: FACTION_TYPES.KnightlyGuard, ggroup: GUILD_GROUPS.KnightlyOrder },
    { id: 510, type: FACTION_TYPES.Group, ggroup: GUILD_GROUPS.FightersGuild },
    { id: 600, type: FACTION_TYPES.People, ggroup: GUILD_GROUPS.GeneralPopulace },
  ];
  return new Map(rows.map((r) => [r.id, r]));
}
const at = (buildingType, factionId) => ({ buildingType, factionId });

test('CHAP2a a town\'s halls off its own buildings: a guild hall by its faction\'s group, a temple through its templar order to its divine, an order; the hidden two by their own faction alone; a shop or a commoner\'s door never; none before the faction file (mutants: the building\'s kind unread, the hidden rule)', () => {
  const B = BUILDING_TYPES;
  assert.deepEqual(hallFactionsOf([
    at(B.GuildHall, 40), at(B.GuildHall, 41), at(B.Temple, 82), at(B.GuildHall, 368), at(B.House2, 42), at(B.House3, 108),
  ], dict()), [21, 40, 41, 42, 108, 368]);
  assert.deepEqual(hallFactionsOf([at(B.Temple, 21)], dict()), [21], 'a temple of the divine\'s own faction');
  assert.deepEqual(hallFactionsOf([at(B.Armorer, 41), at(B.GeneralStore, 40)], dict()), [], 'a shop is no hall');
  assert.deepEqual(hallFactionsOf([at(B.GuildHall, 600), at(B.GuildHall, 510)], dict()), [], 'a commoners\' hall is no Thieves Guild; the merchants no guild');
  assert.deepEqual(hallFactionsOf([at(B.GuildHall, 40), at(B.GuildHall, 40)], dict()), [40], 'each once');
  assert.deepEqual(hallFactionsOf([at(B.House2, 42), at(B.GuildHall, 40)], null), [], 'half an answer is none');
});

function fakeWitnessDoor() {
  const calls = [];
  const door = { calls, error: null, async witness(h) { calls.push(h); return door.error ? { ok: false, error: door.error } : { ok: true, data: { counted: true } }; } };
  return door;
}
function memStorage() {
  const m = new Map();
  return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
}

test('CHAP2a the hall book: a town reported once a UTC day until it is counted, then never again (PIN MOVED, AUDIT CHAP2 E9), kept across pages; a shut answer or a young account stops it for the page (C8); a malformed report never sent (mutants: the day unread, the stop list ignored)', async () => {
  let ms = 20000 * DAY * 1000 + 3_600_000;
  const door = fakeWitnessDoor();
  door.error = 'halls-rate';   // answered, never counted: asked again the next day
  const storage = memStorage();
  const book = createHallBook({ door, storage, nowMs: () => ms });
  const town = { key: 77, region: ANTICLERE, factions: [41, 40] };
  assert.equal(await book.witness(town), true);
  assert.deepEqual(door.calls, [{ key: 77, region: ANTICLERE, factions: [40, 41] }]);
  assert.equal(await book.witness(town), false, 'once a day');
  assert.deepEqual(JSON.parse(storage.getItem(HALL_REPORTED_KEY)), { 77: 20000 });
  const next = createHallBook({ door, storage, nowMs: () => ms });
  assert.equal(await next.witness(town), false, 'the next page knows');
  ms += DAY * 1000;
  door.error = null;
  assert.equal(await next.witness(town), true, 'a new UTC day');
  assert.deepEqual(JSON.parse(storage.getItem(HALL_REPORTED_KEY)), { 77: HALL_DONE + 20001 }, 'counted: done for good');
  ms += DAY * 1000;
  assert.equal(await next.witness(town), false, 'a counted town is never reported again - the account\'s answer stands');
  assert.equal(await next.witness({ key: 78, region: ANTICLERE, factions: [] }), false);
  assert.deepEqual(HALL_STOPS, ['chapters-closed', 'halls-need-account', 'no-session', 'auth']);
  door.error = 'chapters-closed';
  assert.equal(await next.witness({ ...town, key: 79 }), true);
  assert.equal(next.stopped, true);
  assert.equal(await next.witness({ ...town, key: 80 }), false, 'stopped for the page');
  assert.equal(door.calls.length, 3);
  const quiet = createHallBook({ door: { witness: async () => ({ ok: false, error: 'halls-rate' }) }, storage: memStorage(), nowMs: () => ms });
  await quiet.witness(town);
  assert.equal(quiet.stopped, false, 'the hour\'s bound is no stop');
  const young = createHallBook({ door: { witness: async () => ({ ok: true, data: { counted: false, why: 'young' } }) }, storage: memStorage(), nowMs: () => ms });
  await young.witness(town);
  assert.equal(young.stopped, true, 'an account under a week asks no more this page');
  const struckStore = memStorage();
  const struck = createHallBook({ door: { witness: async () => ({ ok: false, error: 'hall-struck' }) }, storage: struckStore, nowMs: () => ms });
  await struck.witness(town);
  assert.ok(JSON.parse(struckStore.getItem(HALL_REPORTED_KEY))[77] >= HALL_DONE, 'a struck town is never asked again');
});

// ── THE SERVICE ─────────────────────────────────────────────────────

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
let _rid = 0;
const rid = () => `chap2-${String(++_rid).padStart(6, '0')}`;
const WITNESS = '/v1/chapters/witness';

async function stand(open = 'on') {
  clock(NOON);
  forgetChapters();
  // the witnesses are developers too, so a town is witnessed at `dev` as at `on`
  const devs = ['Devra', ...Array.from({ length: 40 }, (_, i) => `Wit${i}`)].join(',');
  const s = await standService({ CHAPTERS_OPEN: open, PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', DEVELOPER_HANDLES: devs });
  const raw = s.env.DB._raw;
  const age = (who, days) => raw.prepare('UPDATE players SET registered_at = ? WHERE id = ?').run(_now - days * DAY, who.id);
  const give = (who, character, m, qty) => raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, 'own', ?)
    ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = excluded.qty`).run(who.id, character, m, qty);
  /** Three week-old accounts report the town; the region's ground witnessed by a harvest, so writs post. */
  let wits = 0;
  const witnessTown = async (hall, n = 3) => {
    for (let i = 0; i < n; i++) {
      const w = await s.registered(`Wit${wits++}`);
      age(w, 8);
      clock(_now + 1);   // each report its own second: the witnesses' order is the clock's, never the accounts' ids
      const r = await s.call(WITNESS, { hall }, w.secret);
      assert.equal(r.status, 200, JSON.stringify(r.body));
    }
  };
  const ground = async () => {
    const w = await s.registered('Ground');
    age(w, 8);
    const p = herbPatches({ x: 300, y: 200, day: utcDay(_now), climate: WOODS, confirmed: false })[0];
    const r = await s.call('/v1/prof/harvest', {
      character: w.character, node: nodeKey({ kind: 'herb', x: 300, y: 200, day: utcDay(_now), slot: p.slot }), kind: 'herbs',
      climate: WOODS, region: ANTICLERE, act: { clean: false, bruised: false }, at: _now - 2, rid: rid(),
    }, w.secret);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM world_witness WHERE key = ?').get(pixelKey(300, 200)).n, 1);
  };
  return { ...s, raw, age, give, witnessTown, ground };
}

test('CHAP2a witnessing a town: a guest 403, the Chapters shut 403, a malformed hall 400, an account under a week counted nothing; a week-old account\'s first answer stands (mutants: the age unread, a second answer taken)', async () => {
  const s = await stand();
  const hall = { key: 1234, region: ANTICLERE, factions: [40, 41] };
  const g = await s.guest();
  assert.deepEqual([(await s.call(WITNESS, { hall }, g.secret)).status, (await s.call(WITNESS, { hall }, g.secret)).body.error], [403, 'halls-need-account']);
  const young = await s.registered('Young');
  assert.deepEqual((await s.call(WITNESS, { hall }, young.secret)).body, { ok: true, counted: false, why: 'young' });
  assert.equal(s.raw.prepare("SELECT COUNT(*) AS n FROM world_witness WHERE kind = 'npchall'").get().n, 0);
  s.age(young, 8);
  assert.deepEqual([(await s.call(WITNESS, { hall: { ...hall, factions: [510] } }, young.secret)).status], [400]);
  assert.deepEqual((await s.call(WITNESS, { hall }, young.secret)).body, { ok: true, counted: true });
  await s.call(WITNESS, { hall: { ...hall, factions: [40] } }, young.secret);
  assert.deepEqual(s.raw.prepare("SELECT key, report, region FROM world_witness WHERE kind = 'npchall'").all().map((r) => ({ ...r })),
    [{ key: '1:1234', report: '[1234,21,[40,41]]', region: ANTICLERE }], 'the first answer stands');   // PIN MOVED (AUDIT CHAP2 E7): keyed by the hall law's version
  const shut = await stand('off');
  const w = await shut.registered('Shut');
  shut.age(w, 8);
  assert.deepEqual([(await shut.call(WITNESS, { hall }, w.secret)).status, (await shut.call(WITNESS, { hall }, w.secret)).body.error], [403, 'chapters-closed']);
  // and the module's own door, behind the route's: a caller past the route is still asked the switch
  const row = shut.raw.prepare('SELECT * FROM players WHERE id = ?').get(w.id);
  assert.deepEqual(await witnessHall({ db: shut.env.DB, nowS: _now }, { ...row }, { CHAPTERS_OPEN: 'off' }, { hall }), { error: 'chapters-closed' });
  assert.equal(shut.raw.prepare("SELECT COUNT(*) AS n FROM world_witness WHERE kind = 'npchall'").get().n, 0);
});

test('CHAP2a the hour\'s bound: twenty-four towns an hour an account, then halls-rate 429', async () => {
  const s = await stand();
  const w = await s.registered('Walker');
  s.age(w, 8);
  for (let i = 0; i < 24; i++) assert.equal((await s.call(WITNESS, { hall: { key: 5000 + i, region: ANTICLERE, factions: [40] } }, w.secret)).status, 200);
  const r = await s.call(WITNESS, { hall: { key: 6000, region: ANTICLERE, factions: [40] } }, w.secret);
  assert.deepEqual([r.status, r.body.error], [429, 'halls-rate']);
});

test('CHAP2a a region\'s chapters: the guilds its confirmed towns name - three agreeing accounts confirm, split answers confirm nothing, a town confirmed for another region counts there; kept by the isolate a minute (mutants: the confirmation unread, the region unread)', async () => {
  const s = await stand();
  const db = s.env.DB;
  await s.witnessTown({ key: 1, region: ANTICLERE, factions: [40, 41] }, 2);
  assert.deepEqual(await regionChapters(db, ANTICLERE, _now * 1000), [], 'two are not three');
  await s.witnessTown({ key: 1, region: ANTICLERE, factions: [40, 41] }, 1);
  assert.deepEqual(await regionChapters(db, ANTICLERE, _now * 1000), [40, 41]);
  await s.witnessTown({ key: 2, region: ANTICLERE, factions: [41, 108] });
  assert.deepEqual(await regionChapters(db, ANTICLERE, _now * 1000), [40, 41, 108], 'each guild once');
  // a town another region's witnesses confirmed counts there, never here
  await s.witnessTown({ key: 3, region: 17, factions: [368] });
  assert.deepEqual(await regionChapters(db, 17, _now * 1000), [368]);
  assert.deepEqual(await regionChapters(db, ANTICLERE, _now * 1000), [40, 41, 108]);
  // a town one early report named for this region and three confirmed for another is the other's (AUDIT 29 A11's law)
  clock(_now + 1);
  const early = await s.registered('Wit39');
  s.age(early, 8);
  await s.call(WITNESS, { hall: { key: 5, region: ANTICLERE, factions: [409] } }, early.secret);
  await s.witnessTown({ key: 5, region: 17, factions: [409] });
  forgetChapters();
  assert.deepEqual(await regionChapters(db, 17, _now * 1000), [368, 409]);
  assert.deepEqual(await regionChapters(db, ANTICLERE, _now * 1000), [40, 41, 108], 'never here');
  // THE ISOLATE KEEPS IT A MINUTE: a row written behind the service's back is read after
  s.raw.prepare("DELETE FROM world_witness WHERE kind = 'npchall' AND key = '1:2'").run();   // PIN MOVED (AUDIT CHAP2 E7)
  assert.deepEqual(await regionChapters(db, ANTICLERE, _now * 1000 + 1000), [40, 41, 108]);
  assert.equal(CHAPTERS_KEPT_MS, 60_000);
  assert.deepEqual(await regionChapters(db, ANTICLERE, _now * 1000 + CHAPTERS_KEPT_MS), [40, 41]);
  // split answers confirm nothing; a confirmed answer stands through a dispute after it (the seats' one law, nodeLaw.js)
  forgetChapters();
  await s.witnessTown({ key: 4, region: 18, factions: [40] }, 2);
  await s.witnessTown({ key: 4, region: 18, factions: [42] }, 2);
  assert.deepEqual(await regionChapters(db, 18, _now * 1000), [], 'two and two: unconfirmed');
  await s.witnessTown({ key: 4, region: 18, factions: [40] }, 1);
  await s.witnessTown({ key: 4, region: 18, factions: [42] }, 1);
  assert.deepEqual(await regionChapters(db, 18, _now * 1000), [40], 'the first to three, standing through the dissent after it');
});

test('CHAP2a hall writs on the board: none until a chapter, then two a chapter beside the Court\'s, written down for the day; a hidden guild\'s to its members on the Roll alone; none where the Chapters are not this account\'s (mutants: posted with no chapter, the switch unread, the hidden two shown)', async () => {
  const s = await stand('dev');
  await s.ground();
  const dev = await s.registered('Devra');
  const mac = await s.registered('Mac');
  const list = async (who) => (await s.call('/v1/writs/list', { character: who.character, region: ANTICLERE }, who.secret)).body;
  const first = await list(dev);
  assert.ok(first.writs.length > 0 && first.writs.every((w) => w.kind === 'court' && w.faction === 0));
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM hall_writ_days').get().n, 0, 'no chapter, nothing written down');
  await s.witnessTown({ key: 1, region: ANTICLERE, factions: [41, 108] });
  const l = await list(dev);
  const day = utcDay(_now);
  assert.deepEqual(l.writs.filter((w) => w.kind === 'hall').map((w) => [w.faction, w.id]), [[41, `h:${day}:21:41:0`], [41, `h:${day}:21:41:1`]],
    'the Dark Brotherhood\'s writs are its members\' alone');
  assert.deepEqual({ ...s.raw.prepare('SELECT posted FROM hall_writ_days').get() }, { posted: 4 });
  // A MEMBER OF A HIDDEN GUILD ON THE ROLL sees its chapter's writs - and they ask the Brotherhood's herbs
  const R = await seatRealm(s.env, dev.secret, 'Devra');
  await readRoll({ db: s.env.DB, nowS: _now }, { id: dev.id }, { character: R.id, lease: R.lease, seed: { factions: { 108: 10 }, members: [{ f: 108, rank: 0 }] } });
  const member = (await s.call('/v1/writs/list', { character: R.id, region: ANTICLERE }, dev.secret)).body.writs.filter((w) => w.kind === 'hall');
  assert.deepEqual(member.map((w) => [w.faction, w.id]), [
    [41, `h:${day}:21:41:0`], [41, `h:${day}:21:41:1`], [108, `h:${day}:21:108:0`], [108, `h:${day}:21:108:1`],
  ]);
  assert.ok(member.filter((w) => w.faction === 108).every((w) => material(w.material).family === 'herbs'));
  // a standing with the Brotherhood is no membership of it
  s.raw.prepare('UPDATE npc_roll SET member = 0 WHERE char_id = ? AND faction_id = 108').run(R.id);
  assert.deepEqual((await s.call('/v1/writs/list', { character: R.id, region: ANTICLERE }, dev.secret)).body.writs.filter((w) => w.faction === 108), []);
  // and to one not its member a hidden guild's writ is no writ at all
  const db0 = member.find((w) => w.faction === 108);
  s.give(dev, dev.character, db0.material, db0.qty);
  assert.deepEqual((await s.call('/v1/writs/deliver', { character: dev.character, id: db0.id, rid: rid() }, dev.secret)).body, { error: 'no-writ' });
  assert.equal(l.writs.filter((w) => w.kind === 'court').length, first.writs.length, 'the Court\'s untouched');
  // a chapter confirmed after the day's are written down posts from the next day
  await s.witnessTown({ key: 2, region: ANTICLERE, factions: [40] });
  assert.equal((await list(dev)).writs.filter((w) => w.kind === 'hall').length, 2, 'no Mages Guild writs today');
  assert.deepEqual((await list(mac)).writs.filter((w) => w.kind === 'hall'), [], 'dev: a player not a developer sees none');
});

test('CHAP2a a hall writ delivered: paid as a Court writ, +2 to its guild on the deliverer\'s Roll outside the day\'s pace and never past 100, the Roll\'s head moved; sharing the Court\'s three a day; refused while the Chapters are shut (mutants: the credit skipped, the head unmoved, the cap)', async () => {
  const s = await stand();
  await s.ground();
  await s.witnessTown({ key: 1, region: ANTICLERE, factions: [41] });
  const who = await s.registered('Rolla');
  const R = await seatRealm(s.env, who.secret, 'Rolla');
  const player = { id: who.id };
  await readRoll({ db: s.env.DB, nowS: _now }, player, { character: R.id, lease: R.lease, seed: { factions: { 41: 98 }, members: [] } });
  const repOf = (f) => s.raw.prepare('SELECT rep, owed FROM npc_roll WHERE char_id = ? AND faction_id = ?').get(R.id, f);
  const seqOf = () => s.raw.prepare('SELECT seq FROM npc_roll_heads WHERE char_id = ?').get(R.id).seq;
  const l = (await s.call('/v1/writs/list', { character: R.id, region: ANTICLERE }, who.secret)).body;
  const [h1, h2] = l.writs.filter((w) => w.kind === 'hall');
  const court = l.writs.filter((w) => w.kind === 'court');
  const seq0 = seqOf();
  const rep0 = repOf(41).rep;
  s.give(who, R.id, h1.material, h1.qty);
  const r = await s.call('/v1/writs/deliver', { character: R.id, id: h1.id, rid: rid() }, who.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.writ.kind, r.body.writ.faction, r.body.pay, r.body.balance], ['hall', 41, h1.pay, h1.pay]);
  assert.equal(repOf(41).rep, Math.min(100, rep0 + HALL_WRIT_REP));
  assert.equal(seqOf(), seq0 + 1, 'the head moved: a claim that read it before is refused its write');
  assert.equal(repOf(40).rep, 0, 'only its guild');
  // the second: 100 at most
  s.give(who, R.id, h2.material, h2.qty);
  assert.equal((await s.call('/v1/writs/deliver', { character: R.id, id: h2.id, rid: rid() }, who.secret)).status, 200);
  assert.deepEqual({ ...repOf(41) }, { rep: 100, owed: 0 });
  // the Court's one allowance: two hall writs and one Court writ, then writ-cap
  s.give(who, R.id, court[0].material, court[0].qty);
  assert.equal((await s.call('/v1/writs/deliver', { character: R.id, id: court[0].id, rid: rid() }, who.secret)).status, 200);
  s.give(who, R.id, court[1].material, court[1].qty);
  assert.deepEqual((await s.call('/v1/writs/deliver', { character: R.id, id: court[1].id, rid: rid() }, who.secret)).body, { error: 'writ-cap' });
  assert.equal(COURT_WRITS_PER_DAY, 3);
});

test('CHAP2a a hall writ\'s credit: the owed trimmed to the room 100 leaves; a deliverer with no Roll is paid and nothing more; a hall writ asked while the Chapters are shut is chapters-closed (mutants: the owed untrimmed, the switch unread)', async () => {
  const s = await stand('dev');
  await s.ground();
  await s.witnessTown({ key: 1, region: ANTICLERE, factions: [40] });
  const dev = await s.registered('Devra');
  const R = await seatRealm(s.env, dev.secret, 'Devra');
  await readRoll({ db: s.env.DB, nowS: _now }, { id: dev.id }, { character: R.id, lease: R.lease, seed: { factions: { 40: 97 }, members: [] } });
  s.raw.prepare('UPDATE npc_roll SET owed = 3 WHERE char_id = ? AND faction_id = 40').run(R.id);
  const l = (await s.call('/v1/writs/list', { character: R.id, region: ANTICLERE }, dev.secret)).body;
  const [h1, h2] = l.writs.filter((w) => w.kind === 'hall');
  s.give(dev, R.id, h1.material, h1.qty);
  assert.equal((await s.call('/v1/writs/deliver', { character: R.id, id: h1.id, rid: rid() }, dev.secret)).status, 200);
  assert.deepEqual({ ...s.raw.prepare('SELECT rep, owed FROM npc_roll WHERE char_id = ? AND faction_id = 40').get(R.id) }, { rep: 99, owed: 1 });
  // no Roll: the writ pays, and no row is made
  s.give(dev, dev.character, h2.material, h2.qty);
  const r = await s.call('/v1/writs/deliver', { character: dev.character, id: h2.id, rid: rid() }, dev.secret);
  assert.equal(r.status, 200);
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM npc_roll WHERE char_id = ?').get(dev.character).n, 0);
  // a player the dev switch keeps out is refused a hall writ by id
  const mac = await s.registered('Mac');
  s.give(mac, mac.character, h2.material, h2.qty);
  const hallId = `h:${utcDay(_now)}:21:40:0`;
  s.raw.prepare('UPDATE writs SET filled_by = NULL, filled_char = NULL, filled_at = NULL, rid = NULL, n = NULL WHERE id = ?').run(hallId);
  assert.deepEqual((await s.call('/v1/writs/deliver', { character: mac.character, id: hallId, rid: rid() }, mac.secret)).body, { error: 'chapters-closed' });
});

test('CHAP2a the join: a new membership is recorded only where the Roll\'s standing meets DFU\'s join; one already recorded stays whatever its standing since (mutants: the floor unread, a member dropped)', async () => {
  const s = await stand();
  const who = await s.registered('Rolla');
  const R = await seatRealm(s.env, who.secret, 'Rolla');
  const ctx = (t) => ({ db: s.env.DB, nowS: t });
  const player = { id: who.id };
  await readRoll(ctx(T0), player, { character: R.id, lease: R.lease, seed: { factions: { 40: -5, 41: 0 }, members: [] } });
  const claim = (t, members, deltas = {}) => claimRoll(ctx(t), player, { character: R.id, lease: R.lease, rid: rid(), deltas, members });
  let r = await claim(T0 + 10, [{ f: 40, rank: 0 }, { f: 41, rank: 0 }]);
  assert.deepEqual(r.roll.members.map((m) => m.f), [41], 'below the floor: the Mages Guild\'s join not recorded');
  r = await claim(T0 + 20, [{ f: 40, rank: 0 }, { f: 41, rank: 0 }], { 40: 5 });
  assert.deepEqual(r.roll.members.map((m) => m.f), [40, 41], 'at 0: recorded');
  r = await claim(T0 + 30, [{ f: 40, rank: 0 }, { f: 41, rank: 0 }], { 41: -20 });
  assert.deepEqual(r.roll.members.map((m) => m.f), [40, 41], 'a member already on the Roll stays');
});

// ── THE TAB ─────────────────────────────────────────────────────────

test('CHAP2a the tab\'s refresh: after a hall writ the next tick claims with nothing moved, even inside the minute, and the Roll\'s +2 is adopted; nothing before the first read or once stopped (mutants: the refresh ignored, the minute kept)', async () => {
  let roll = null;
  const calls = [];
  const door = {
    async read(character, lease, seed) { calls.push('read'); roll ??= { factions: { ...seed.factions }, members: [] }; return { ok: true, data: { roll: { seq: 1, ...roll } } }; },
    async claim(character, lease, rid_, deltas) { calls.push(['claim', deltas]); for (const [f, d] of Object.entries(deltas)) roll.factions[f] += d; return { ok: true, data: { roll: { seq: 2, ...roll }, credited: deltas } }; },
  };
  let t = 1_000_000;
  const held = { 41: 10 };
  const tracker = createRollTracker({
    io: door, character: () => 'r0123456789abcdef0123', lease: () => 'a'.repeat(32), read: () => ({ ...held }),
    write: (v) => Object.assign(held, v), members: () => null, now: () => t,
  });
  const settle = () => new Promise((r) => setTimeout(r, 0));
  tracker.refresh();
  tracker.tick(); await settle();
  assert.deepEqual(calls, ['read'], 'before the first read the read answers');
  held[41] = 11;
  tracker.tick(); await settle();
  assert.deepEqual(calls[1], ['claim', { 41: 1 }]);
  roll.factions[41] += 2;   // a hall writ delivered on the service
  t += 5_000;
  tracker.tick(); await settle();
  assert.equal(calls.length, 2, 'nothing moved here, inside the minute: nothing asked');
  tracker.refresh();
  tracker.tick(); await settle();
  assert.deepEqual(calls[2], ['claim', {}]);
  assert.equal(held[41], 13, 'the Roll\'s word adopted');
  tracker.tick(); await settle();
  assert.equal(calls.length, 3, 'asked once');
});

// ── THE WIRING ──────────────────────────────────────────────────────

test('CHAP2a the wiring: the halls witnessed at the town\'s entry edge off the reveal\'s own buildings, online; the hall book built online; a hall writ refreshes the Roll; the board names its guild; the route stands; the version moved', () => {
  const world = src('src/scenes/world.js');
  assert.match(world, /revealMemberGuildHalls\(\{ witness: onlineOn \}\);/);
  // PIN MOVED (AUDIT CHAP2 U1, U2, C1, C7; T: where it sits - inside the wait on the faction file)
  const reveal = world.slice(world.indexOf('const revealMemberGuildHalls'), world.indexOf('// A2: the exterior automap'));
  assert.match(reveal, /Promise\.resolve\(townTalk\.ensureFactions\?\.\(\)\)\.then\(\(\) => \{[\s\S]*if \(witness && hallBook && \(!homeLayoutsOnline \|\| \(_homeLayoutsApplied && !worldDataPacksMissing\(\)\.length\)\)\) \{\n\s+const factions = hallFactionsOf\(buildings, townTalk\.factionDict \?\? null\);\n\s+const region = \(\(\) => \{ try \{ return maps\.getRegionIndexAt\(px\.x, px\.y\); \} catch \{ return null; \} \}\)\(\);\n\s+if \(factions\.length && Number\.isInteger\(region\)\) hallBook\.witness\(\{ key: dfLoc\.mapTableData\.mapId >>> 0, region, factions \}\);/);
  assert.match(world, /const hallDoor = params\.has\('online'\) \? accountRoll\(\{ fetch: \(u, i\) => globalThis\.fetch\(u, i\), storage: appStorage\(\) \}\) : null;\n\s+const hallBook = hallDoor \? createHallBook\(\{ door: hallDoor, storage: appStorage\(\) \}\) : null;/);
  assert.match(world, /if \(d\.writ\?\.kind === 'hall'\) rollTracker\?\.refresh\(\);\n\s+const hall = d\.writ\?\.kind === 'hall' && !d\.repeat && rollTracker\?\.held \? hallPosterName\(d\.writ\.faction\) : null;/);
  assert.match(world, /\$\{hall \? ` The \$\{hall\} will remember it\.` : ''\}/);
  const board = src('src/ui/noticeWindow.js');
  assert.match(board, /const poster = w\.kind === 'hall' \? hallPosterName\(w\.faction\) \?\? 'guild' : null;/);
  assert.match(board, /`Wanted: \$\{w\.qty\} \$\{work\.countName\(w\.material, w\.qty\)\}, for the \$\{poster\} in \$\{work\.regionName\}`/);
  assert.match(src('server-account/src/service.js'), /'\/v1\/chapters\/witness'/);
  assert.match(src('server-account/src/index.js'), /path === '\/v1\/chapters\/witness' \? await witnessHall\(ctx, who\.player, env, body\)/);
  assert.match(src('server-account/src/service.js'), /ACCOUNT_VERSION = 'acct94'/);
  assert.match(src('server-account/wrangler.toml'), /CHAPTERS_OPEN = "dev"/);
  assert.match(src('server-account/migrations/0091_npc_halls.sql'), /kind IN \('pixel', 'dungeon', 'hub', 'seat', 'npchall'\)/);
});
