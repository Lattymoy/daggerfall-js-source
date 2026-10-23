// SEA-SEASON (2026-10-22, the owner: "Build ever single bit of this and dont return until its perfected" - the Eltheric
// Ocean's seasonal boards for the deepest voyage and the legends ended; bible/03-World/Eltheric-Ocean.md SEA-SEASON): the
// season's law (net/sea/seaSeasonLaw.js), the captain's ledger's season figures (systems/naval/captainLedger.js, the
// ether host's day), the copy doors that drop them (systems/offlineCopy.js), the service's figures off a clean checkpoint
// and its boards over the real routes (server-account/src/seaSeason.js, realm.js checkpointRealm), the page's half
// (scenes/seaSeasonHost.js), the tab's words and section (ui/naval/navalYardWindow.js seasonText), the seams by source.
// tools/mutants/seaseason.json.
import '../../modsOff.js';
import { byClass } from '../../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as S from '../../../src/net/sea/seaSeasonLaw.js';
import { ARENA_SEASON_EPOCH_S, ARENA_SEASON_S, arenaSeasonOf, arenaSeasonEndsS } from '../../../src/net/arena/arenaLaw.js';
import { sharedClassicMinutes } from '../../../src/net/wire.js';
import { ETHER_BOX, etherDepthAt } from '../../../src/world/ethericSea.js';
import { LEGENDS, LEGEND_RISE_DAYS } from '../../../src/systems/naval/etherShips.js';
import { createCaptainLedger, CAPTAIN_SAVE_VERSION, CAPTAIN_SAVE_VENDOR, restoreSeason } from '../../../src/systems/naval/captainLedger.js';
import { createEtherHost } from '../../../src/scenes/etherHost.js';
import { offlineCopyOf, onlineCopyOf } from '../../../src/systems/offlineCopy.js';
import { createSeaSeason, SEA_SEASON_FRESH_MS } from '../../../src/scenes/seaSeasonHost.js';
import { seasonText, etherOfficeText, mountNavalYardWindow } from '../../../src/ui/naval/navalYardWindow.js';
import { accountSeaSeason, SESSION_KEY } from '../../../src/net/accountClient.js';
import worker from '../../../server-account/src/index.js';
import { standService } from '../../accountDb.mjs';
import { seatRealm } from '../../realmSeat.mjs';
import { createWeapon } from '../../../src/combat/enemyEquipment.js';
import { seeded } from '../../honestItems.mjs';

const src = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
/** Ten days into the first season, and three into the second (epoch seconds). */
const T1 = ARENA_SEASON_EPOCH_S + 10 * 86_400;
const T2 = ARENA_SEASON_EPOCH_S + ARENA_SEASON_S + 3 * 86_400;
/** The world's day at an epoch second, online (the shared clock's). */
const dayAt = (s) => Math.floor(sharedClassicMinutes(s * 1000) / 1440);
const RC = 'r00000000000000000c01';

test('SEA-SEASON the season\'s law: its numbers each their source\'s; a world day\'s season the shared clock\'s; the legends a season can hold so far; a save\'s figures read through the law; a board read safely (mutants: the bounds, the clock, the rises, the reads)', () => {
  assert.equal(S.SEA_SEASON_VENDOR, CAPTAIN_SAVE_VENDOR);
  assert.equal(S.SEA_DEEPEST_MAX, Math.floor(etherDepthAt(ETHER_BOX.x0)), 'the sea\'s west edge');
  assert.deepEqual([S.SEA_LEGENDS, S.SEA_LEGEND_RISE_DAYS], [LEGENDS.length, LEGEND_RISE_DAYS]);
  assert.equal(S.SEA_LEGEND_RISE_S, 60 * 3600, 'thirty of the world\'s days are sixty hours of wall time');
  assert.deepEqual([S.SEA_SEASON_ROWS, S.SEA_SEASON_LAST_ROWS], [10, 3]);
  const turn = dayAt(ARENA_SEASON_EPOCH_S + ARENA_SEASON_S);
  assert.deepEqual([dayAt(T1), dayAt(T2), turn + 1, turn].map(S.seaSeasonOfDay), [1, 2, 2, 1], 'by the wall time a day begins at - the day the season turns in, the old one\'s');
  assert.deepEqual([1, 2, 3].map(S.seaSeasonStartS), [ARENA_SEASON_EPOCH_S, ARENA_SEASON_EPOCH_S + ARENA_SEASON_S, ARENA_SEASON_EPOCH_S + 2 * ARENA_SEASON_S]);
  const start = S.seaSeasonStartS(2);
  assert.deepEqual([start, start + S.SEA_LEGEND_RISE_S - 1, start + S.SEA_LEGEND_RISE_S, start + 5 * S.SEA_LEGEND_RISE_S].map(S.seaLegendsPossible), [6, 6, 12, 36], 'each of the six once, and again at each rise');
  const save = (season) => ({ modData: { Captain: { ether: { season } } } });
  assert.deepEqual(S.seaSeasonFigures(save({ n: 1, deepest: 400, legends: 3 }), T1), { n: 1, deepest: 400, legends: 3 });
  assert.deepEqual(S.seaSeasonFigures(save({ n: 1, deepest: S.SEA_DEEPEST_MAX, legends: S.seaLegendsPossible(T1) }), T1), { n: 1, deepest: S.SEA_DEEPEST_MAX, legends: 30 }, 'at the bounds');
  for (const bad of [{ n: 2, deepest: 1, legends: 0 }, { n: 1, deepest: S.SEA_DEEPEST_MAX + 1, legends: 0 }, { n: 1, deepest: 1, legends: 31 }, { n: 1, deepest: -1, legends: 0 }, { n: 1, deepest: 1.5, legends: 0 }, { n: 1, deepest: 1, legends: -1 }, { n: 1, deepest: '1', legends: 0 }, { n: '1', deepest: 1, legends: 0 }, null]) {
    assert.equal(S.seaSeasonFigures(save(bad), T1), null, JSON.stringify(bad));
  }
  assert.equal(S.seaSeasonFigures({}, T1), null, 'an older ledger\'s');
  assert.equal(S.seaSeasonFigures(null, T1), null);
  assert.equal(S.readSeaSeasonBoard(null), null);
  assert.equal(S.readSeaSeasonBoard({ season: 0 }), null);
  const many = Array.from({ length: 14 }, (_, i) => ({ name: `n${i}`, n: 14 - i }));
  const b = S.readSeaSeasonBoard({ season: 2, ends: 99, deep: many, legends: [{ name: 'kim', n: -2 }, { name: '' }, null, { name: 'hal', n: 3.5 }], mine: { deep: { rank: 3, n: 40 }, legends: { rank: 0, n: 1 } }, last: { deep: many, legends: 'x' } });
  assert.deepEqual([b.season, b.ends, b.deep.length, b.legends, b.mine, b.last.deep.length, b.last.legends], [2, 99, S.SEA_SEASON_ROWS, [{ name: 'kim', n: 0 }, { name: 'hal', n: 0 }], { deep: { rank: 3, n: 40 }, legends: null }, S.SEA_SEASON_LAST_ROWS, []]);
});

test('SEA-SEASON the captain\'s ledger: the deepest voyage and the legends ended kept for the season of the world\'s day - begun afresh in a new season, never by a day before it; kept by the save, read back within the law; the ether host hands it the day; neither copy door carries it (mutants: the season\'s mark, the reset, the count, the restore, the host\'s day, the doors)', () => {
  const L = createCaptainLedger();
  assert.equal(L.season(), null);
  L.deepest(12.7);
  assert.deepEqual([L.log.deepest, L.season()], [12, null], 'no day: the log\'s alone');
  const d1 = dayAt(T1), d2 = dayAt(T2);
  L.deepest(400.4, d1);
  L.deepest(300, d1);
  L.endLegend('wake', d1);
  L.endLegend('wake', d1 + 31);
  assert.deepEqual(L.season(), { n: 1, deepest: 400, legends: 2 }, 'the most, and each end');
  L.deepest(S.SEA_DEEPEST_MAX + 9, d1);
  assert.equal(L.season().deepest, S.SEA_DEEPEST_MAX, 'never past the sea');
  L.endLegend('wake', d2);
  assert.deepEqual(L.season(), { n: 2, deepest: 0, legends: 1 }, 'a new season begins afresh');
  L.deepest(2000, d1);
  L.endLegend('crown', d1);
  assert.deepEqual(L.season(), { n: 2, deepest: 0, legends: 1 }, 'a day of the season before counts nothing now');
  assert.deepEqual([L.log.deepest, L.legendDay('crown')], [2000, d1], '...though the log and the legend\'s day keep it');
  L.deepest(50, d2);
  const M = createCaptainLedger();
  M.restoreSaveData(JSON.parse(JSON.stringify(L.getSaveData())));
  assert.deepEqual(M.season(), { n: 2, deepest: 50, legends: 1 }, 'kept by the save');
  assert.equal(L.getSaveData().v, CAPTAIN_SAVE_VERSION);
  for (const bad of [{ n: 0, deepest: 1, legends: 1 }, { n: 1, deepest: S.SEA_DEEPEST_MAX + 1, legends: 0 }, { n: 1, deepest: 1, legends: -1 }, { n: 1.5, deepest: 1, legends: 1 }, 'x']) assert.equal(restoreSeason(bad), null, JSON.stringify(bad));
  M.restoreSaveData({ ether: { season: { n: 1, deepest: -4, legends: 2 } } });
  assert.equal(M.season(), null, 'a figure no voyage makes: none');
  // the ether host: a sighting at sea marks the season's deepest by the world's day, a legend's end its count
  const H = createCaptainLedger();
  let day = d1;
  const host = createEtherHost({ ledger: H, day: () => day });
  host.sight(4000, -5000);
  assert.equal(H.season().deepest, Math.floor(etherDepthAt(4000)));
  assert.equal(H.season().n, 1);
  day = d1 + 100;
  host.legendEnded(LEGENDS[0].id, 'sink');
  assert.equal(H.season().legends, 1);
  // neither door carries them
  const snap = { classicMinutes: 600_000, worldMinutes: 600_000, modData: { Captain: { v: 1, ether: { charted: ['1,2'], season: { n: 1, deepest: 400, legends: 3 } } } } };
  const off = offlineCopyOf(snap);
  assert.deepEqual([off.modData.Captain.ether.season, off.modData.Captain.ether.charted], [null, ['1,2']], 'offline: the season\'s figures dropped, the rest kept');
  assert.equal(onlineCopyOf(snap, 700_000).modData.Captain.ether.season, null, 'brought online: from nothing');
  assert.deepEqual(offlineCopyOf({ classicMinutes: 1, worldMinutes: 1 }).modData, undefined, 'a save with no ledger: nothing made');
});

/** The service at `nowS` (Date.now held there), three captains seated - kim, hal, val - and their checkpoints. */
async function harbour() {
  const realNow = Date.now;
  const clock = { s: T1 };
  Date.now = () => clock.s * 1000;
  const svc = await standService();
  const who = {}, R = {};
  const base = (n) => ({ name: n, level: 1, goldPieces: 100, items: [] });
  for (const n of ['kim', 'hal', 'val']) {
    who[n] = await svc.registered(n);
    R[n] = await seatRealm(svc.env, who[n].secret, n, base(n));
  }
  const put = async (n, season, extra = {}) => {
    const at = R[n].at();
    const res = await worker.fetch(new Request(`https://accounts.invalid/v1/realm/${R[n].id}/data`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${who[n].secret}`, 'x-realm-lease': at.lease, 'x-realm-seq': String(at.seq + 1) },
      body: JSON.stringify({ ...base(n), ...extra, modData: { Captain: { v: 1, ether: { season } } } }),
    }), svc.env);
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  const board = async (n) => (await svc.call('/v1/sea/season/board', { character: R[n].id }, who[n].secret)).body;
  const row = (n, season) => ({ ...svc.env.DB._raw.prepare('SELECT deepest, deep_at, legends, legends_at FROM sea_season WHERE season = ? AND char_id = ?').get(season, R[n].id) });
  const raw = (sql, ...a) => svc.env.DB._raw.prepare(sql).run(...a);
  return { svc, who, R, put, board, row, raw, clock, restore: () => { Date.now = realNow; } };
}

test('SEA-SEASON the service, end to end over its routes and real records: a clean checkpoint\'s figures written, each the most the season has heard and when it was first reached; a figure out of the law, of another season, of a lawless checkpoint or of a held character never; the boards in order with the asker\'s ranks, a held captain on neither; the season before\'s firsts (mutants: the clean, the hold, the law, the most, the first reached, the order, the ranks, the last season)', async () => {
  const h = await harbour();
  try {
    const ok = async (n, season, extra) => { const r = await h.put(n, season, extra); assert.equal(r.status, 200, JSON.stringify(r.body)); return r; };
    assert.deepEqual(await h.board('kim'), { season: 1, ends: arenaSeasonEndsS(1), deep: [], legends: [], mine: { deep: null, legends: null }, last: { deep: [], legends: [] } }, 'a quiet season');
    // val reaches 400 leagues first, kim later - the board's order by who reached a figure first, never by name
    await ok('val', { n: 1, deepest: 400, legends: 3 });
    h.clock.s += 60;
    await ok('hal', { n: 1, deepest: 900, legends: 1 });
    h.clock.s += 60;
    await ok('kim', { n: 1, deepest: 400, legends: 3 });
    assert.deepEqual(h.row('kim', 1), { deepest: 400, deep_at: T1 + 120, legends: 3, legends_at: T1 + 120 });
    // a later checkpoint saying less: the most stands, and when it was first reached
    h.clock.s += 60;
    await ok('kim', { n: 1, deepest: 300, legends: 2 });
    assert.deepEqual(h.row('kim', 1), { deepest: 400, deep_at: T1 + 120, legends: 3, legends_at: T1 + 120 }, 'a figure never falls');
    await ok('kim', { n: 1, deepest: 400, legends: 4 });
    assert.deepEqual(h.row('kim', 1), { deepest: 400, deep_at: T1 + 120, legends: 4, legends_at: T1 + 180 }, 'an equal deepest keeps its moment; a greater count takes the new');
    // out of the law, another season's, nothing at all: none written
    await ok('kim', { n: 1, deepest: S.SEA_DEEPEST_MAX + 1, legends: 99 });
    await ok('kim', { n: 2, deepest: 1300, legends: 1 });
    assert.deepEqual(h.row('kim', 1), { deepest: 400, deep_at: T1 + 120, legends: 4, legends_at: T1 + 180 });
    await ok('val', { n: 1, deepest: 0, legends: 0 });
    assert.equal(h.svc.env.DB._raw.prepare('SELECT COUNT(*) AS n FROM sea_season').get().n, 3);
    // a lawless checkpoint (a forged piece) is stored and held - its figures never written
    const forged = { ...createWeapon(113, 1, seeded(7)), affixes: [{ id: 'damage', value: 40 }] };
    const lawless = await ok('val', { n: 1, deepest: 1000, legends: 9 }, { items: [forged] });
    assert.equal(lawless.body.tradeHeld, 'law');
    assert.deepEqual([h.row('val', 1).deepest, h.row('val', 1).legends], [400, 3], 'a lawless checkpoint says nothing to the boards');
    // the boards: by the figure, equal figures by who reached them first
    const kb = await h.board('kim');
    assert.deepEqual(kb.deep, [{ name: 'hal', n: 900 }, { name: 'kim', n: 400 }], 'val held: on neither board');
    assert.deepEqual(kb.legends, [{ name: 'kim', n: 4 }, { name: 'hal', n: 1 }]);
    assert.deepEqual(kb.mine, { deep: { rank: 2, n: 400 }, legends: { rank: 1, n: 4 } });
    assert.deepEqual((await h.board('val')).mine, { deep: null, legends: null }, 'a held captain has no place');
    // a clean checkpoint lifts the law's hold; val stands again - before kim on the deepest (reached first), after kim on the legends (fewer)
    await ok('val', { n: 1, deepest: 400, legends: 3 });
    const vb = await h.board('val');
    assert.deepEqual(vb.deep, [{ name: 'hal', n: 900 }, { name: 'val', n: 400 }, { name: 'kim', n: 400 }]);
    assert.deepEqual(vb.legends, [{ name: 'kim', n: 4 }, { name: 'val', n: 3 }, { name: 'hal', n: 1 }]);
    assert.deepEqual(vb.mine, { deep: { rank: 2, n: 400 }, legends: { rank: 2, n: 3 } });
    assert.deepEqual((await h.board('kim')).mine.deep, { rank: 3, n: 400 }, 'equal, and reached later');
    // staff's hold: its checkpoints write nothing while it stands
    h.raw('UPDATE realm_characters SET held = ?1 WHERE id = ?2', 'staff', h.R.hal.id);
    await ok('hal', { n: 1, deepest: 1100, legends: 5 });
    assert.deepEqual([h.row('hal', 1).deepest, h.row('hal', 1).legends], [900, 1], 'held: nothing written');
    assert.deepEqual((await h.board('kim')).deep.map((r) => r.name), ['val', 'kim']);
    assert.deepEqual((await h.board('kim')).mine.deep, { rank: 2, n: 400 }, 'a held captain is no one ahead');
    h.raw('UPDATE realm_characters SET held = NULL WHERE id = ?1', h.R.hal.id);
    // another account's character asked for: no place of mine
    assert.deepEqual((await h.svc.call('/v1/sea/season/board', { character: h.R.kim.id }, h.who.hal.secret)).body.mine, { deep: null, legends: null });
    assert.deepEqual((await h.svc.call('/v1/sea/season/board', {}, h.who.hal.secret)).body.mine, { deep: null, legends: null });
    // the next season: the boards begin again, the last season's firsts shown
    h.clock.s = T2;
    await ok('val', { n: 2, deepest: 50, legends: 1 });
    await ok('kim', { n: 2, deepest: 0, legends: 0 });
    assert.equal(h.svc.env.DB._raw.prepare('SELECT COUNT(*) AS n FROM sea_season WHERE season = 2').get().n, 1, 'nothing yet: no row');
    await ok('hal', { n: 2, deepest: 0, legends: 2 });
    const nb = await h.board('val');
    assert.deepEqual([nb.season, nb.ends, nb.deep, nb.legends, nb.mine], [2, arenaSeasonEndsS(2), [{ name: 'val', n: 50 }], [{ name: 'hal', n: 2 }, { name: 'val', n: 1 }], { deep: { rank: 1, n: 50 }, legends: { rank: 2, n: 1 } }], 'a board names no captain without its figure');
    assert.deepEqual((await h.board('hal')).mine, { deep: null, legends: { rank: 1, n: 2 } });
    assert.deepEqual(nb.last, { deep: [{ name: 'hal', n: 900 }, { name: 'val', n: 400 }, { name: 'kim', n: 400 }], legends: [{ name: 'kim', n: 4 }, { name: 'val', n: 3 }, { name: 'hal', n: 1 }] });
    assert.equal(arenaSeasonOf(T2), 2);
  } finally { h.restore(); }
});

/** The page's half over a fake door. */
function page({ live = true, answer = null } = {}) {
  const st = { live, now: T1 * 1000, asked: [] };
  const data = { season: 1, ends: T1 + 2 * 86_400 + 3600, deep: [{ name: 'kim', n: 900 }], legends: [], mine: { deep: { rank: 1, n: 900 }, legends: null }, last: { deep: [], legends: [] } };
  const door = { board: async (req) => { st.asked.push(req); return answer ?? { ok: true, data }; } };
  const s = createSeaSeason({ live: () => st.live, session: {}, character: () => RC, door, now: () => st.now });
  return { s, st };
}
const settle = async () => { for (let i = 0; i < 6; i++) await new Promise((r) => setImmediate(r)); };

test('SEA-SEASON the page\'s half (seaSeasonHost.js) and its door: no section offline; the boards read when the tab is shown, once at a time, and again SEA_SEASON_FRESH_MS on; the days left by the clock; a refusal said; the door\'s route (mutants: the gate, the read, the stale, the days, the line, the route)', async () => {
  assert.equal(SEA_SEASON_FRESH_MS, 60_000);
  assert.equal(page({ live: false }).s.office(), null, 'offline: no section');
  assert.equal(createSeaSeason({ live: () => true, session: null, character: () => RC, door: {} }).office(), null, 'no realm character: none');
  const { s, st } = page();
  assert.equal(s.office().asking, true, 'shown: read');
  s.office(); void s.read();
  await settle();
  assert.deepEqual(st.asked, [{ character: RC }], 'once at a time');
  const o = s.office();
  assert.deepEqual([o.asking, o.season, o.daysLeft, o.deep, o.mine.deep, o.line], [false, 1, 3, [{ name: 'kim', n: 900 }], { rank: 1, n: 900 }, null]);
  st.now += SEA_SEASON_FRESH_MS - 1; s.office(); await settle();
  assert.equal(st.asked.length, 1, 'fresh: not read again');
  st.now += 1; s.office(); await settle();
  assert.equal(st.asked.length, 2, 'stale: read again');
  assert.equal(s.office().daysLeft, 3);
  st.now = (T1 + 2 * 86_400 + 3601) * 1000;
  assert.equal(s.office().daysLeft, 0, 'never below none');
  const no = page({ answer: { ok: false, error: 'bad-json' } });
  no.s.office(); await settle();
  const n = no.s.office();
  assert.equal(n.asking, true);   // PIN MOVED (AUDIT SEA VENTURES E7): boards never read are still asked for, never an empty season
  assert.equal(n.line.warn, true);
  assert.ok(n.line.text.length > 0);
  const sent = [];
  const fetch = async (url, init) => { sent.push([new URL(url).pathname, JSON.parse(init.body), init.headers.authorization]); return new Response(JSON.stringify({ ok: true }), { status: 200 }); };
  await accountSeaSeason({ fetch, storage: { getItem: (k) => (k === SESSION_KEY ? JSON.stringify({ secret: 'sek' }) : null) } }).board({ character: RC });
  assert.deepEqual(sent, [['/v1/sea/season/board', { character: RC }, 'Bearer sek']]);
});

test('SEA-SEASON the tab\'s words and section (navalYardWindow.js seasonText): the season and its days left, each board\'s ranks with their figures (or its line of none), the player\'s own places, the last season\'s firsts; shown at a freeport online, hidden offline and on the shipwright\'s own tab (mutants: the head, the rows, the plurals, the places, the last, the section)', () => {
  const s = { asking: false, season: 3, daysLeft: 1, deep: [{ name: 'kim', n: 1365 }, { name: 'hal', n: 1 }], legends: [], mine: { deep: { rank: 2, n: 1 }, legends: { rank: 11, n: 1200 } }, last: { deep: [{ name: 'val', n: 900 }], legends: [{ name: 'pat', n: 1 }] }, line: null };
  const t = seasonText(s);
  assert.deepEqual(t.head, ['The season\'s captains', 'Season 3 - 1 day left']);
  assert.deepEqual(seasonText({ ...s, daysLeft: 34 }).head[1], 'Season 3 - 34 days left');
  assert.equal(t.lede, 'Every captain of the realm, this season: how far past the Veil they have sailed, and how many of the six legends they have sunk or taken. You are 2nd for the deepest voyage (1 league). You are 11th for legends ended (1,200 legends). Last season\'s deepest voyage: val (900 leagues). Last season\'s most legends ended: pat (1 legend).');
  assert.deepEqual(t.lists, [
    { title: 'Deepest voyages', rows: [{ title: '1. kim', words: '1,365 leagues' }, { title: '2. hal', words: '1 league' }], none: 'No captain has sailed past the Veil this season.' },
    { title: 'Legends ended', rows: [], none: 'No legend has been sunk or taken this season.' },
  ]);
  assert.deepEqual([1, 3, 12, 21, 22, 113].map((rank) => seasonText({ ...s, mine: { deep: { rank, n: 2 }, legends: null }, last: {} }).lede.split('. ').pop()), ['You are 1st for the deepest voyage (2 leagues).', 'You are 3rd for the deepest voyage (2 leagues).', 'You are 12th for the deepest voyage (2 leagues).', 'You are 21st for the deepest voyage (2 leagues).', 'You are 22nd for the deepest voyage (2 leagues).', 'You are 113th for the deepest voyage (2 leagues).']);
  const quiet = seasonText({ ...s, mine: { deep: null, legends: null }, last: { deep: [], legends: [] } });
  assert.equal(quiet.lede, 'Every captain of the realm, this season: how far past the Veil they have sailed, and how many of the six legends they have sunk or taken.');
  const asking = seasonText({ asking: true, season: 0, daysLeft: 0, deep: [], legends: [], mine: {}, last: {}, line: null });
  assert.deepEqual([asking.head[1], asking.lede, asking.lists], ['', 'The harbormaster is reading the season\'s boards...', []]);
  const office = { ether: true, port: 'Pyrewatch', waters: 'The Deep Aether', charted: 0, rumours: [], chart: null };
  assert.equal(etherOfficeText(office).season, null, 'offline: no section');
  assert.equal(etherOfficeText({ ...office, season: s }).season.lists.length, 2);
  // the section in the shipwright's window
  const proto = Object.getPrototypeOf(globalThis.document.createElement('div'));
  proto.removeAttribute ??= function removeAttribute(k) { delete this.attrs[k]; };   // the stand-in DOM's missing one
  let model = { ...office, season: { ...s, line: { text: 'Refused.', warn: true } } };
  const host = globalThis.document.createElement('div');
  const win = mountNavalYardWindow(host, { model: { name: 'Sloop', uid: 7, offer: () => ({ rows: [], whole: 0, gold: 100 }), ship: () => ({ hull: 1, maxHull: 1, sail: 1, maxSail: 1, crew: 1, maxCrew: 1, barrels: 0 }), office: () => model } });
  const [tabs] = byClass(host, 'dfnaval-tabs');
  tabs.children[1].onclick({ stopPropagation() {} });
  const sec = () => byClass(host, 'dfnaval-sec').find((x) => x.children[0]?.children[0]?.textContent === 'The season\'s captains');
  assert.ok(sec() && sec().style.display !== 'none', 'shown');
  assert.equal(sec().children[0].children[1].textContent, 'Season 3 - 1 day left');
  const items = byClass(sec(), 'dfnaval-item').map((li) => li.textContent);
  assert.deepEqual(items, ['Deepest voyages', '1. kim1,365 leagues', '2. hal1 league', 'Legends ended', 'No legend has been sunk or taken this season.']);
  const line = byClass(sec(), 'dfnaval-note')[0];
  assert.deepEqual([line.textContent, line.className], ['Refused.', 'dfnaval-note warn']);
  tabs.children[0].onclick({ stopPropagation() {} });
  assert.equal(sec().style.display, 'none', 'the shipwright\'s own tab: hidden');
  tabs.children[1].onclick({ stopPropagation() {} });
  model = { ...office, season: null };
  win.repaint();
  assert.equal(sec().style.display, 'none', 'offline: hidden');
  win.unmount();
});

test('SEA-SEASON the seams by source: a clean checkpoint carries the figures in its own batch; the route; the deploy watches the law; the sea\'s host builds the season\'s half and spreads it into the harbourmaster\'s tab (mutants: each seam)', () => {
  const realm = src('server-account/src/realm.js');
  assert.match(realm, /\.\.\.v\.steps,\n\s+\/\/ SEA-SEASON[^\n]*\n\s+\.\.\.\(v\.clean \? seaSeasonSteps\(db, \{ player: playerId, char: id \}, save, nowS\) : \[\]\),\n\s+\]\);/);
  assert.match(src('server-account/src/index.js'), /if \(path === '\/v1\/sea\/season\/board'\) \{\n\s+if \(request\.method !== 'POST'\) return no\('method', 405, origin\);\n\s+return json\(await seaSeasonBoard\(ctx, who\.player, body\), 200, origin\);/);
  assert.match(src('server-account/src/service.js'), /'\/v1\/sea\/season\/board',/);
  assert.match(src('.github/workflows/account-deploy.yml'), /- "src\/net\/sea\/seaSeasonLaw\.js"/);
  const sea = src('src/scenes/seaVenturesHost.js');
  assert.match(sea, /const season = createSeaSeason\(\{ live, session: deps\.session, character, door: deps\.seasonDoor, now: clock \}\);/);
  assert.match(sea, /office: \(\) => \(\{ wanted: bounty\.office\(\), season: season\.office\(\) \}\),/);
  assert.match(src('src/scenes/world.js'), /\.\.\.seaVentures\.office\(\), buyChart:/);
  assert.match(src('src/scenes/etherHost.js'), /L\.deepest\?\.\(etherDepthAt\(px\), day\(\)\);/);
  const win = src('src/ui/naval/navalYardWindow.js');
  assert.match(win, /renderSeason\(ot\.season\);/);
  assert.match(win, /for \(const n of \[oLede, boardSec, heldSec, lettersSec, wantedSec, seasonSec\]\) n\.style\.display = tab === 'office' \? '' : 'none';/);
});
