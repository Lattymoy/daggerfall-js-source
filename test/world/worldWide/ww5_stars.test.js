// WW5 (bible/03-World/World-Wide.md WW5; bible/11-Multiplayer/Starfall.md section 16, WW5 - the owner's call taken,
// 2026-10-26: "Every single thing here needs to be addressed. No exceptions."): A COVEN NIGHT IN EVERY THEATRE. One coven a
// night on the Bay was the Starfall whole - its sites the Bay's scan's (`W = 1000`, `px = id % W`), the wire's star word
// the Bay's 0..999, three stars an hour for the world. Now each theatre that stands one (the Bay's and the eight
// provinces'; Cyrodiil's open zone none) is its own night: its coven (the port's own past the Bay - FACTION.TXT's are the
// Bay's), its sites over its own ground (the gate's theatre scan over the registry's places - TESA's), its stars numbered
// in its own lane, its words on the world's pixel at both ends of the wire. The Bay's covens, nights, sites and stars are
// the law before WW5, written out here and held to it. tools/mutants/ww5_stars.json.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  STAR_LANES, starLaneOf, starIndexOf, starOfLane, starOk, starTimes, starRoll, starSpotLocal, starHeldOrder, starLedgerSane, newStarLedger,
  starNightAt, starInWindow, STAR_PER_NIGHT, STAR_SALT, STAR_HOUR_MS,
} from '../../../src/net/starfall/starfallLaw.js';
import {
  starWireOk, validStarIn, validStarOut, STAR_HELD_MAX, STAR_LANES_WIRE, STAR_STARS_MAX, SITE_EVENT_LANES, siteEventLaneOpen, siteEventPixelOk,
  WW5_RELAY_MIN, relaySupportsWw5, RELAY_VERSION, WORLD_PIXEL_BOUND,
} from '../../../src/net/wire.js';
import { starReceiptValid } from '../../../src/net/starfall/starReceipt.js';
import { STAR_COVENS, STAR_COVENS_APART, STAR_PROVINCE_COVENS, covensOfLane, starCovenOf, covenWitches } from '../../../src/systems/starfall/starfallCovens.js';
import { findStarSites, findTheatreStarSites, STAR_APART_PX, STAR_DRAWS } from '../../../src/systems/starfall/starfallSites.js';
import { heartStar, witchesNight, HEART_STAR } from '../../../src/systems/starfall/starfallNight.js';
import { starMasterOf, STAR_MASTERS } from '../../../src/systems/starfall/starCoven.js';
import { starTimerRows, starHeldKey } from '../../../src/systems/starfall/starfallClient.js';
import { createStarfallHost } from '../../../src/scenes/starfall/starfallHost.js';
import { createEventTheatres, PROVINCE_EVENT_LANES } from '../../../src/scenes/eventTheatres.js';
import { scanTheatreGate, findTheatreGateSite } from '../../../src/systems/gate/theatreGateSite.js';
import { findGateSite } from '../../../src/systems/gate/gateSite.js';
import { gateHash, gameDayAt, gateNumber } from '../../../src/net/gate/gateLaw.js';
import { THEATRE_COUNT, THEATRE_KEYS, theatreAt, worldPixelKey } from '../../../src/world/worldWide/worldGrid.js';
import { REGION_NAMES, LOCATION_TYPES } from '../../../src/formats/mapsFile.js';
import { regionOfTheatre } from '../../../src/formats/mapsTables.js';
import { FESTIVALS } from '../../../src/net/festivalLaw.js';
import * as TM from '../../../src/systems/textManager.js';
import { codeOnly } from '../../codeOnly.mjs';
import { HAVE, ww5World } from './ww5World.mjs';
import { OnlineSession } from '../../../src/net/online.js';
import { worldRoom, PIXEL_UNITS, SD_LANE_SPAN } from '../../../src/net/wire.js';
import { fakeSocketClass } from '../../fakeSocket.mjs';

const src = (p) => codeOnly(readFileSync(new URL('../../../' + p, import.meta.url), 'utf8'));
const FESTIVAL = FESTIVALS[0];
const N = starNightAt(FESTIVAL.fromMs) + 30;
const BAY_PX = [300, 200], PAST_PX = [1600, -120];

// ═══ THE LAW BEFORE WW5, WRITTEN OUT ════════════════════════════════════════════════════════════════════════════════
/** The Bay's star instants before WW5: `n * STAR_HOUR_MS` and the night's three falls. */
const oldFallAt = (n, k) => n * 3_600_000 + [-900_000, -450_000, 0][k];
/** The Bay's coven of a night before WW5 (starfallCovens.js starCovenOf, at e77eadc58f). */
function oldCovenOf(n) {
  const len = STAR_COVENS.length;
  const bagRound = (round) => { const a = Array.from({ length: len }, (_, i) => i); for (let i = len - 1; i > 0; i--) { const j = gateHash(STAR_SALT, round, 11, i) % (i + 1); const tmp = a[i]; a[i] = a[j]; a[j] = tmp; } return a; };
  const round = Math.floor(n / len), at = n - round * len;
  const bag = bagRound(round);
  if (bag[0] === bagRound(round - 1)[len - 1]) { const tmp = bag[0]; bag[0] = bag[1]; bag[1] = tmp; }
  return STAR_COVENS[bag[at]];
}
/** The Bay's night before WW5 (starfallSites.js findStarSites, at e77eadc58f), its answers' identity. */
function oldStarSites(n, scan, gateSiteOf) {
  const coven = oldCovenOf(n), pixels = scan.byRegion.get(coven.region);
  if (!pixels?.length) return [];
  const out = [], towns = new Set(), apart = (a, px, py) => Math.max(Math.abs(a.px - px), Math.abs(a.py - py)) >= 5;
  for (let k = 0; k < 3; k++) {
    const gate = gateSiteOf(gameDayAt(oldFallAt(n, k)));
    const fits = (id, strict) => { const px = id % 1000, py = Math.floor(id / 1000); if (gate && !apart(gate, px, py)) return false; if (!out.every((s) => apart(s, px, py))) return false; return !strict || !towns.has(scan.townAt[id]); };
    let pick = -1;
    for (const strict of [true, false]) { for (let d = 0; d < 32 && pick < 0; d++) { const id = pixels[gateHash(STAR_SALT, n, k, 100 + d + (strict ? 0 : 32)) % pixels.length]; if (fits(id, strict)) pick = id; } if (pick >= 0) break; }
    if (pick < 0) continue;
    const town = scan.towns[scan.townAt[pick]] ?? null;
    towns.add(scan.townAt[pick]);
    out.push({ n, k, region: coven.region, coven: coven.id, px: pick % 1000, py: Math.floor(pick / 1000), near: town?.name || (REGION_NAMES[coven.region] ?? ''), town: town?.name ?? null });
  }
  return out;
}
const idOfSite = (s) => ({ n: s.n, k: s.k, region: s.region, coven: s.coven.id, px: s.px, py: s.py, near: s.near, town: s.town?.name ?? null });

/** A theatre's scan made by the producer (systems/gate/theatreGateSite.js scanTheatreGate) over towns of `theatre` on a
 *  grid off the Bay, every pixel land, no place but the towns. */
function theatreScan(theatre = 3, ox = 1500, oy = -200) {
  const towns = [];
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) towns.push({ name: `Town ${i}.${j}`, px: ox + i * 12, py: oy + j * 12, area: 200 + theatre, type: LOCATION_TYPES.TownCity });
  const at = new Map(towns.map((t) => [`${t.px},${t.py}`, t]));
  return scanTheatreGate({ towns, placeAt: (x, y) => at.get(`${x},${y}`) ?? null, inTheatre: () => true, areaAt: () => 200 + theatre, wet: () => false, theatre });
}

test('WW5 THE LAW: a star\'s number names its lane - lane t\'s three are 3t + 0..2, so the Bay\'s are the 0, 1 and 2 they always were; a star stands on the lanes the law opens (the Bay and the eight provinces, Cyrodiil\'s open zone none); every lane\'s night is the one sky\'s hour - its falls the Bay\'s instants, its place in the night its master and its Heart-Star; its rolls its own; the hub says the Bay\'s holds first; a stored ledger is on its own lane\'s pixel (mutants: the lane bound; Cyrodiil\'s lane opened; the instant by the raw number; the Heart-Star by the raw number; the master by the raw number; the held order; the ledger\'s pixel unread)', () => {
  assert.equal(STAR_LANES, THEATRE_COUNT, 'a lane a theatre');
  assert.equal(STAR_LANES_WIRE, STAR_LANES, 'the wire\'s copy, pinned equal');
  assert.equal(STAR_STARS_MAX, STAR_PER_NIGHT);
  assert.deepEqual([...SITE_EVENT_LANES], [0, 1, 2, 3, 4, 5, 6, 7, 8], 'the Bay and the eight provinces; Cyrodiil\'s open zone stands no site-bound event');
  for (let lane = 0; lane < STAR_LANES; lane++) for (let j = 0; j < STAR_PER_NIGHT; j++) {
    const k = starOfLane(lane, j);
    assert.equal(k, lane * 3 + j);
    assert.equal(starLaneOf(k), lane); assert.equal(starIndexOf(k), j);
    assert.equal(starOk(N, k), lane <= 8, `lane ${lane}`);
    assert.deepEqual(starTimes(N, k), starTimes(N, j), 'one sky: every lane\'s star j falls at the Bay\'s star j\'s instants');
    assert.equal(starMasterOf(3, k).id, starMasterOf(3, j).id, 'its master its place\'s');
  }
  assert.ok(!starOk(N, 27) && !starOk(N, 30) && !starOk(N, -1) && !starOk(0, 0));
  for (let k = 0; k < 3; k++) assert.equal(starTimes(N, k).fallAt, oldFallAt(N, k), 'the Bay\'s instants, the law before WW5');
  assert.notEqual(starRoll(N, 3, 1), starRoll(N, 0, 1), 'a lane\'s rolls its own');
  assert.notDeepEqual(starSpotLocal(N, 3), starSpotLocal(N, 0));
  let night = N;
  while (!witchesNight(night)) night++;
  for (let lane = 0; lane <= 8; lane++) {
    assert.deepEqual([0, 1, 2].map((j) => heartStar(night, starOfLane(lane, j))), [false, false, true], `lane ${lane}: its night's last the Heart-Star`);
    assert.equal(starOfLane(lane, HEART_STAR) % 3, 2);
  }
  assert.deepEqual(starHeldOrder([[N, 9, 1600, -10, 5], [N, 1, 300, 200, 6], [N, 4, 900, -50, 7], [N, 2, 310, 210, 8]]), [[N, 1, 300, 200, 6], [N, 2, 310, 210, 8], [N, 9, 1600, -10, 5], [N, 4, 900, -50, 7]], 'the Bay\'s first, each lane\'s in its order');
  const word = (k, px, py) => ({ n: N, k, px, py, lv: 5, s: 0, o: 0, kw: 0, kn: 0, wc: 0, hb: 0, mf: 0 });
  assert.equal(starLedgerSane(newStarLedger(word(9, ...PAST_PX), 1)), true, 'a province\'s ledger on its world pixel');
  assert.equal(starLedgerSane(newStarLedger(word(9, ...BAY_PX), 1)), false, 'never on the Bay\'s map');
  assert.equal(starLedgerSane(newStarLedger(word(1, ...PAST_PX), 1)), false, 'a Bay star off the Bay\'s map is none');
  assert.equal(starLedgerSane(newStarLedger(word(1, ...BAY_PX), 1)), true);
});

test('WW5 THE WIRE AND THE RELAY: the star word on its lane\'s pixel - the Bay\'s map for the Bay\'s three as it always was, a world pixel off the Bay for a province\'s, none for Cyrodiil\'s or past the theatres; the Bay\'s word projected as before; every word a cell or the hub says the same; the held list every lane\'s nights; the relay that keeps them (WW5_RELAY_MIN), a province\'s word never sent to an older one; the receipt and the account service\'s claim a province\'s star\'s (mutants: the pixel by the Bay\'s bound alone; the held bound; the relay gate; the send\'s gate)', () => {
  assert.equal(starWireOk(0, ...BAY_PX) && starWireOk(2, 999, 499) && starWireOk(0, 0, 0), true);
  for (const [k, px, py] of [[0, 1000, 10], [1, -1, 5], [3, ...BAY_PX], [26, 10, 10]]) assert.equal(starWireOk(k, px, py), false, `${k} @${px},${py}`);
  for (const [k, px, py] of [[3, ...PAST_PX], [5, 1000, 0], [26, -400, 1800]]) assert.equal(starWireOk(k, px, py), true, `${k} @${px},${py}`);
  for (const [k, px, py] of [[27, ...PAST_PX], [30, ...PAST_PX], [3, WORLD_PIXEL_BOUND, 0], [3.5, ...PAST_PX], [-1, ...PAST_PX]]) assert.equal(starWireOk(k, px, py), false, `${k}`);
  assert.equal(siteEventLaneOpen(9), false); assert.equal(siteEventPixelOk(9, ...PAST_PX), false);
  const bay = { n: N, k: 1, px: 300, py: 200, lv: 12, s: 1, o: 0, kw: 2, kn: 3, wc: 1, hb: 40, mf: 0 };
  assert.deepEqual(validStarIn({ ...bay, junk: 1 }), bay, 'the Bay\'s word, projected as it always was');
  assert.deepEqual(validStarIn({ ...bay, k: 10, px: 1600, py: -120 }), { ...bay, k: 10, px: 1600, py: -120 });
  assert.equal(validStarIn({ ...bay, k: 10 }), null, 'a province\'s star on the Bay\'s map: junk');
  const st = { k: 'st', n: N, s: 10, px: 1600, py: -120, p: 2, w: 1, wz: 4, kn: 0, wl: 1000, lt: 90, nd: 1, b: 1, ow: 1, hc: 3, hd: 0, lo: 0, why: 0 };
  assert.deepEqual(validStarOut(st), st);
  assert.equal(validStarOut({ ...st, px: 300, py: 200 }), null);
  assert.deepEqual(validStarOut({ k: 'hd', n: N, s: 10, px: 1600, py: -120, at: 9, top: ['Ann'], c: 1 }), { k: 'hd', n: N, s: 10, px: 1600, py: -120, at: 9, top: ['Ann'], c: 1 });
  assert.deepEqual(validStarOut({ k: 'hds', l: [[N, 10, 1600, -120, 9], [N, 10, 300, 200, 9], [N, 1, 300, 200, 9]] }).l, [[N, 10, 1600, -120, 9], [N, 1, 300, 200, 9]]);
  assert.equal(STAR_HELD_MAX, 9 * 3 * 2 + 6, 'a night\'s and the night before\'s three in every lane, and room');
  assert.equal(WW5_RELAY_MIN, 276);   // PIN MOVED (the eighth merge of main into #1184): world276, past main's world275 (SD-PARTY, live), which refuses; PIN MOVED (the seventh merge of main into #1184): world275, past main's world274 (LADDER-CUT), which refuses
  assert.ok(relaySupportsWw5(RELAY_VERSION) && relaySupportsWw5('world277') && !relaySupportsWw5('world275') && !relaySupportsWw5('acct272') && !relaySupportsWw5(undefined));   // PIN MOVED (the fourth merge of main into #1184): the gate is world274, past main's world273, which refuses; PIN MOVED (the third merge of main into #1184): the gate is world272, past MASTER-THREE's world271 (main's), which refuses; world271 at the second merge, past CHAT-POST's world270   // PIN MOVED: world277, YARD-CELL YC2 (2026-10-27, bible/11-Multiplayer/Yard-Cells.md section 11; world271 to world277, and acct198 to acct200 then acct205 and acct206, on its branch, renumbered past YC1 at the merges) (the yard arm of the hub: a carried YARD ORDER verified and fanned once a second, server/src/yardWords.js; yd in its welcome); PIN MOVED: world277, YARD-CELL (net/homeLaw.js HOME_TOWN_MAX 2,048 - a law of the relay import graph, no relay behaviour moves; world266 on its branch, renumbered past main at the merges, last past TESA and SHOP); PIN MOVED: world276, SHOP (Genesis, Eternal and Origin join the vocabulary, last; the token's body bound 896); PIN MOVED: world275, the merge of main (world274 on its branch, renumbered past world274 on main at the merge); PIN MOVED: world274, the merge of main (world272 on its branch, renumbered past world272-world273 on main at the merge)
  const on = src('src/net/online.js');
  assert.match(on, /if \(primary\) \{ this\.starOk = relaySupportsStar\(relayV\); this\.ww5Ok = relaySupportsWw5\(relayV\); this\.delveOk = relaySupportsDelve\(relayV\); \}/);   // PIN MOVED (DELVE II DLV3, at the merge): the line asks the dungeon encounters' relay too
  assert.match(on, /if \(w\.k >= STAR_PER_NIGHT_WIRE && !\(this\._mine\(cell\) \? this\.ww5Ok : this\._haloFor\(cell\)\?\.ww5Ok\)\) return false;/, 'a province\'s star word never to a relay that refuses it as junk - the socket\'s own relay\'s word');
  // WW5's finish: each socket's word goes with it across a crossing (AUDIT WB12d C6) - the cell stepped down keeps its own
  assert.match(on, /sdOk: this\.sdOk, ww5Ok: this\.ww5Ok, foeInventoryOk:/);
  assert.match(on, /this\.egOk = !!h\.egOk; this\.ww5Ok = !!h\.ww5Ok;/);
  const base = { sf: [N, 13], s: 'acct_1234', c: 1, l: 5, i: 100, e: 160 };
  assert.ok(starReceiptValid(base), 'a province\'s star\'s receipt - the relay mints it, the account service reads it (both bundle the law)');
  assert.ok(!starReceiptValid({ ...base, sf: [N, 27] }));
  const r = src('server/src/index.js');
  assert.match(r, /this\._send\(ws, JSON\.stringify\(\{ t: 'star', k: 'hds', l: starHeldOrder\(l\) \}\)\);/, 'the hello says the Bay\'s first');
  // the account service's row is the star's night and number (stars.js starKeyOf), its day the star's own fall (the law's)
  const acct = src('server-account/src/stars.js');
  assert.match(acct, /export const starKeyOf = \(n, k\) => `\$\{n\}\.\$\{k\}`;/);
  assert.match(acct, /export const starDayOf = \(n, k\) => Math\.floor\(starTimes\(n, k\)\.fallAt \/ DAY_MS\);/);
});

test('WW5 A HALO SAYS FOR ITSELF: a province\'s star word and a province\'s find go down a halo only when the halo\'s own relay keeps them (WW5_RELAY_MIN - a halo on an older object, a deploy under way, refuses the word as a bad frame); the primary\'s word is the primary\'s (AUDIT RAID R8b\'s law, WW5\'s finish; mutants: the halo sent on the primary\'s word, for a star and for a find; the halo never told)', () => {
  const { FakeWS, sockets } = fakeSocketClass();
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'a', id: 'aaaa-0001', secret: 'secret-of-aaaa-0001', WebSocketImpl: FakeWS, now: () => 1000 });
  const log = console.info; console.info = () => {};
  try {
    const [px, py] = PAST_PX, other = worldRoom(px + 16, py);
    s.join(worldRoom(px, py), { x: px * PIXEL_UNITS + 16384, y: 0, z: (499 - py) * PIXEL_UNITS + 16384, yaw: 0, pitch: 0 });
    sockets[0].open();
    sockets[0].receive({ t: 'welcome', id: 'aaaa-0001', peers: [], host: 'aaaa-0001', world: null, v: RELAY_VERSION });
    s.setHalo([other]);
    const halo = sockets[1];
    halo.open();
    halo.receive({ t: 'welcome', id: 'aaaa-0001', peers: [], n: 1, v: `world${WW5_RELAY_MIN - 1}` });
    assert.equal(s.ww5Ok, true, 'my own cell\'s relay keeps them');
    const star = { n: N, k: starOfLane(3, 1), px: px + 16, py, lv: 12, s: 1, o: 0, kw: 0, kn: 0, wc: 0, hb: 0, mf: 0 };
    const find = { s: 3 * SD_LANE_SPAN + 1, px: px + 16, py };
    const said = (ws, t) => ws.sent.filter((x) => JSON.parse(x).t === t).length;
    assert.deepEqual([s.sendStar(star, other), s.sendSdFound(find, other)], [false, false], 'the halo\'s relay refuses a province\'s word');
    assert.deepEqual([said(halo, 'star'), said(halo, 'sd')], [0, 0]);
    halo.receive({ t: 'welcome', id: 'aaaa-0001', peers: [], n: 1, v: RELAY_VERSION });
    const before = [said(sockets[0], 'star'), said(sockets[0], 'sd')];
    assert.deepEqual([s.sendStar(star, other), s.sendSdFound(find, other)], [true, true], 'its own relay keeps them');
    assert.deepEqual([said(halo, 'star'), said(halo, 'sd')], [1, 1], 'down the halo\'s own socket');
    assert.deepEqual([said(sockets[0], 'star'), said(sockets[0], 'sd')], before, 'never the primary\'s');
  } finally { console.info = log; }
});

test('WW5 THE PROVINCES\' COVENS: the port\'s own, one a province theatre (Cyrodiil none), each its province\'s WW-R region, no FACTION.TXT faction nor MAPS.BSA place, no id a Bay coven\'s; its witches, its member and its leader its own words; a theatre\'s night its own covens\' bag - the Bay\'s the thirteen\'s, night for night as before; a province\'s leader comes for the star where a Bay coven\'s Coven Mother does (mutants: a coven\'s region; a faction id; the Bay\'s bag by the lane; a province night the Bay\'s coven; the leader lost)', () => {
  assert.deepEqual(STAR_PROVINCE_COVENS.map((c) => [c.theatre, c.region, c.id]), [[1, 62, 'moor'], [2, 63, 'sand'], [3, 64, 'rime'], [4, 65, 'ash'], [5, 66, 'dusk'], [6, 67, 'briar'], [7, 68, 'mafala'], [8, 69, 'fen']]);
  for (const c of STAR_PROVINCE_COVENS) {
    assert.equal(c.region, regionOfTheatre(c.theatre));
    assert.deepEqual([c.factionId, c.location, c.place, c.own], [null, null, null, true], c.id);
    assert.ok(Object.isFrozen(c));
    for (const f of [c.name, c.member, c.leader]) assert.ok(typeof f() === 'string' && f().length > 2, c.id);
  }
  const bayIds = new Set([...STAR_COVENS, ...STAR_COVENS_APART].map((c) => c.id));
  assert.ok(STAR_PROVINCE_COVENS.every((c) => !bayIds.has(c.id)), 'no id a Bay coven\'s');
  assert.equal(new Set(STAR_PROVINCE_COVENS.map((c) => c.id)).size, 8);
  assert.ok(STAR_COVENS.every((c) => Number.isInteger(c.factionId) && c.factionId > 0), 'the Bay\'s are FACTION.TXT\'s');
  assert.deepEqual(STAR_PROVINCE_COVENS.map((c) => [c.name(), c.member(), c.leader()]), [
    ['The Sisters of the Moor', 'Sister of the Moor', 'Mother Gwenllian'], ['The Sand Witches', 'Sand Witch', 'Mother Adara'],
    ['The Witches of the Rime', 'Witch of the Rime', 'Mother Hjordis'], ['The Ash Witches', 'Ash Witch', 'Wise Woman Ulyne'],
    ['The Sisters of Dusk', 'Sister of Dusk', 'Mother Calanwe'], ['The Briar Witches', 'Briar Witch', 'Mother Thaewen'],
    ['The Daughters of Mafala', 'Daughter of Mafala', 'Clan Mother Ri\'shazra'], ['The Fen Witches', 'Fen Witch', 'Mother Neeta-Hei'],
  ]);
  for (const c of STAR_PROVINCE_COVENS) assert.equal(covenWitches(c), c.name(), 'its own words, never a faction\'s');
  // in the player's language: its own row (a faction's name read for it would answer the English)
  const row = readFileSync(new URL('../../../locales/de/Port_Strings.csv', import.meta.url), 'utf8').split('\n').find((l) => l.startsWith('starfall.coven.moor,'));
  const de = JSON.parse(row.slice('starfall.coven.moor,'.length));
  TM.registerLocale({ code: 'de', name: 'Deutsch' });
  TM.patchLocaleTable('de', TM.runtimeCollectionName(TM.TextCollections.Port), [['starfall.coven.moor', de]]);
  try {
    TM.setLocale('de');
    assert.notEqual(de, 'The Sisters of the Moor');
    assert.equal(covenWitches(STAR_PROVINCE_COVENS[0]), de, 'said in German');
  } finally { TM.setLocale('en'); }
  assert.equal(covensOfLane(0), STAR_COVENS);
  assert.deepEqual(covensOfLane(9), []);
  assert.equal(starCovenOf(N, 9), null, 'the open zone stands no coven night');
  for (let n = N; n < N + 3 * STAR_COVENS.length + 5; n++) {
    assert.equal(starCovenOf(n), oldCovenOf(n), `night ${n}: the Bay's bag, the law before WW5`);
    for (let t = 1; t <= 8; t++) assert.equal(starCovenOf(n, t).theatre, t);
  }
  const rime = STAR_PROVINCE_COVENS[2];
  const M = starMasterOf(1, starOfLane(3, 0), rime);
  assert.deepEqual([M.name(), M.call(), M.circle(), M.female, M.career], ['Mother Hjordis', 'Mother Hjordis comes for the star!', 'Mother Hjordis calls her circle. Break it!', true, STAR_MASTERS.mother.career]);
  assert.equal(starMasterOf(1, starOfLane(3, 0), rime), M, 'kept, one a coven');
  assert.equal(starMasterOf(1, 0, STAR_COVENS[0]), STAR_MASTERS.mother, 'a Bay coven keeps its Coven Mother');
  assert.equal(starMasterOf(3, starOfLane(3, 0), rime), STAR_MASTERS.lord, 'the third band\'s masters are the rite\'s, a province\'s too');
});

test('WW5 A PROVINCE\'S NIGHT: its coven\'s three stars over its theatre\'s own ground (the producer\'s scan) - numbered in its lane, its region its province\'s, each on a suitable pixel near its own town, apart from the rest and from its theatre\'s gate of that game day, its spot its own; none on the Bay\'s lane (its own law) or the open zone\'s (mutants: the lane\'s number; the gate unasked; the towns repeated; the pixel of the key)', () => {
  const scan = theatreScan(3);
  const all = new Set([...scan.byArea.values()].flatMap((l) => [...l]));
  const sites = findTheatreStarSites(N, 3, scan);
  assert.deepEqual(sites.map((s) => [s.k, s.lane, s.region, s.coven.id]), [[9, 3, 64, 'rime'], [10, 3, 64, 'rime'], [11, 3, 64, 'rime']]);
  for (const s of sites) {
    assert.ok(all.has(worldPixelKey(s.px, s.py)), `${s.px},${s.py} one of the scan's`);
    const ti = scan.townOf.get(worldPixelKey(s.px, s.py));
    assert.equal(s.town.name, scan.towns[ti].name, 'named by its nearest town');
    assert.equal(s.near, s.town.name);
    assert.equal(s.regionName, 'Skyrim');
    assert.deepEqual(s.spot, starSpotLocal(N, s.k));
    assert.deepEqual(s.times, starTimes(N, s.k));
    for (const o of sites) if (o !== s) assert.ok(Math.max(Math.abs(o.px - s.px), Math.abs(o.py - s.py)) >= STAR_APART_PX);
  }
  assert.equal(new Set(sites.map((s) => s.town.name)).size, 3, 'a town each');
  assert.deepEqual(findTheatreStarSites(N, 3, scan), sites, 'every client the same');
  // its gate of that game day kept off
  const first = sites[0];
  const kept = findTheatreStarSites(N, 3, scan, { gateSiteOf: (day) => (day === gameDayAt(starTimes(N, 9).fallAt, 3) ? { px: first.px, py: first.py } : null) });
  assert.ok(Math.max(Math.abs(kept[0].px - first.px), Math.abs(kept[0].py - first.py)) >= STAR_APART_PX, 'off its gate');
  // a town a star where the province has them: two towns, the night's first two by one each, night after night
  const pair = [{ name: 'East', px: 1500, py: -200 }, { name: 'West', px: 1530, py: -200 }].map((t) => ({ ...t, area: 203, type: LOCATION_TYPES.TownCity }));
  const pairAt = new Map(pair.map((t) => [`${t.px},${t.py}`, t]));
  const two = scanTheatreGate({ towns: pair, placeAt: (x, y) => pairAt.get(`${x},${y}`) ?? null, inTheatre: () => true, areaAt: () => 203, wet: () => false, theatre: 3 });
  for (let n = N; n < N + 40; n++) {
    const l = findTheatreStarSites(n, 3, two);
    assert.ok(l.length >= 2 && l[0].town.name !== l[1].town.name, `night ${n}: ${l.map((x) => x.town.name)}`);
  }
  assert.deepEqual(findTheatreStarSites(N, 0, scan), [], 'the Bay\'s night is its own law\'s');
  assert.deepEqual(findTheatreStarSites(N, 9, scan), [], 'the open zone: none');
  assert.equal(STAR_DRAWS, 32);
});

test('WW5 THE THEATRES WARMED A THEATRE AT A TIME: a province\'s scan is asked of the gate\'s own scans (keptTheatreScans), made in an idle moment one theatre at a time - none until it is warm - and made again for a new registry generation or picture (mutants: every theatre in one idle moment; a stale scan kept; the open zone\'s lane warmed)', () => {
  const made = [];
  const scans = { scanOf: (t) => { made.push(t); return { theatre: t, byArea: new Map(), towns: [], townOf: new Map() }; }, theatres: () => [], siteOf: () => null };
  const queue = [];
  let gen = 1;
  const T = createEventTheatres({ scans: () => scans, generation: () => gen, land: () => 7, idle: (fn) => queue.push(fn) });
  assert.deepEqual([...PROVINCE_EVENT_LANES], [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(T.warmLanes(), [], 'none warm yet');
  assert.equal(made.length, 0, 'nothing scanned on the asking frame');
  assert.equal(queue.length, 1, 'one idle moment asked');
  queue.shift()();
  assert.deepEqual(made, [1], 'one theatre an idle moment');
  assert.equal(queue.length, 1);
  while (queue.length) queue.shift()();
  assert.deepEqual(made, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(T.warmLanes().map(([t]) => t), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(T.scanOf(9), null, 'the open zone: none');
  assert.equal(queue.length, 0, 'and never owed an idle moment');
  gen = 2;
  assert.equal(T.scanOf(3), null, 'a new generation: warmed again');
  assert.equal(T.ready(3), false);
  while (queue.length) queue.shift()();
  assert.ok(T.ready(3) && T.scanOf(3));
  const now = createEventTheatres({ scans: () => scans, idle: null });
  assert.ok(now.scanOf(4), 'no idle queue: made where it is asked');
  assert.equal(createEventTheatres({ scans: () => null, idle: null }).scanOf(3), null, 'no world host: none');
  const gl = src('src/scenes/gate/gateLanes.js');
  assert.match(gl, /return \(_kept = \{\n {4}scanOf,/, 'the world host\'s scans kept as it makes them');
  assert.match(gl, /export const keptTheatreScans = \(\) => _kept;/);
});

/** The Starfall's host on bindings by name (star5_host.test.js's shape), a province's theatre scan beside the Bay's. */
function starWorld({ ww5 = true, region = 17, n = N } = {}) {
  const bayScan = (() => {
    const byRegion = new Map(), townAt = new Int32Array(1000 * 500).fill(-1), towns = [];
    [...new Set(STAR_COVENS.map((c) => c.region))].forEach((r, i) => { const px = []; for (let y = 20 + i * 30; y < 40 + i * 30; y++) for (let x = 300; x < 320; x++) { const id = y * 1000 + x; px.push(id); townAt[id] = towns.length; towns.push({ name: `Town ${towns.length}`, px: x, py: y, region: r }); } byRegion.set(r, Int32Array.from(px)); });
    return { byRegion, towns, townAt };
  })();
  const sk = theatreScan(3);
  const w = { t: starTimes(n, 0).omenAt + 1000, region, said: [] };
  const host = createStarfallHost({
    renderer: null, state: { pixelTranslation: (px, py, out) => { out[0] = px * 100; out[1] = 0; out[2] = py * 100; return out; } },
    exteriorFoes: null, gateScanOf: () => bayScan, warmGateScan: () => {}, surfaceAt: () => 0, player: { feetAt: () => null }, walkMode: true, playerSpawned: true,
    online: { ww5Ok: ww5, starReady: () => true, sendStar: () => true }, eventNotice: (kind, s) => w.said.push(s), _questRegionIndex: () => w.region,
    gamePaused: () => false, townTalk: { hudHidden: false }, collider: null, _sharedOffsetMs: 0, audio: { playOneShot() {}, play3d() {} }, storage: null,
    theatreScans: { scanOf: (t) => (t === 3 ? sk : { theatre: t, byArea: new Map(), towns: [], townOf: new Map() }), theatres: () => [3], siteOf: () => null },
    worldPlaces: { generation: () => 1 }, landVersion: () => 1, idle: null,
  });
  return { w, host, bayScan, sk };
}

test('WW5 THE HOST: every theatre\'s stars stand - the Bay\'s and a province\'s, each its own key; none of a province\'s on a relay that keeps none; the Timers the theatre I stand in alone (the Bay\'s at sea and in Cyrodiil); a province\'s hold said to its own theatre, the Bay\'s to everyone; the map every theatre\'s (mutants: the lanes unasked; the relay gate; the Timers every theatre\'s; the hold to everyone)', () => {
  // PIN MOVED: FRONTS - a festival night on Skyrim's turn, all three of its stars landing (net/frontLaw.js); N is High Rock's and Summerset's
  let NS = N;
  while (NS < N + 48 && ![9, 10, 11].every((k) => starInWindow(NS, k))) NS++;
  assert.ok(NS < N + 48, 'Skyrim\'s turn comes within two days of nights');
  const realNow = Date.now;
  try {
    const { w, host, sk } = starWorld({ n: NS });
    Date.now = () => w.t;
    host.frame();
    const keys = host.state().map((s) => s.key);
    const lane3 = findTheatreStarSites(NS, 3, sk).filter((s) => starInWindow(s.n, s.k));
    assert.ok(keys.some((k) => k.startsWith(`${NS}.0@`)), 'the Bay\'s first star in its omen');
    assert.ok(keys.includes(starHeldKey(NS, 9, lane3[0].px, lane3[0].py)), 'Skyrim\'s first star in its omen, its own key');
    const marks = host.mapMarks().map((m) => m.key);
    assert.ok(marks.includes(starHeldKey(NS, 9, lane3[0].px, lane3[0].py)) && marks.some((k) => k.startsWith(`${NS}.0@`)), 'the map: every theatre\'s');
    assert.ok(host.timerRows().every((r) => /^star:\d+\.[0-2]$/.test(r.id)), 'on the Bay: the Bay\'s rows alone');
    w.region = 64;   // Skyrim
    const rows = host.timerRows();
    assert.ok(rows.length > 0 && rows.every((r) => /^star:\d+\.(9|10|11)$/.test(r.id)), `in Skyrim: Skyrim's rows alone (${rows.map((r) => r.id)})`);
    w.region = 70;   // Cyrodiil: the Bay's, as they were
    const cy = host.timerRows();
    assert.ok(cy.length > 0 && cy.every((r) => /^star:\d+\.[0-2]$/.test(r.id)), 'in Cyrodiil: the Bay\'s rows');
    // a hold past the Bay: said where it stands
    w.t = starTimes(NS, 0).fallAt + 1000; host.frame();
    w.region = 17; w.said.length = 0;
    const s9 = lane3[0];
    host.onStar({ k: 'hd', n: NS, s: 9, px: s9.px, py: s9.py, at: w.t, top: ['Ann'], c: 1 });
    assert.deepEqual(w.said, [], 'a province\'s hold, not news on the Bay');
    w.region = 64;
    host.onStar({ k: 'hd', n: NS, s: 10, px: lane3[1].px, py: lane3[1].py, at: w.t, top: ['Ann'], c: 1 });
    assert.equal(w.said.length, 1, 'said in its own province');
    w.region = 17;
    const b0 = host.state().find((s) => s.key.startsWith(`${NS}.0@`));
    const [bpx, bpy] = b0.key.split('@')[1].split(',').map(Number);
    host.onStar({ k: 'hd', n: NS, s: 0, px: bpx, py: bpy, at: w.t, top: ['Ann'], c: 1 });
    assert.equal(w.said.length, 2, 'the Bay\'s hold to everyone, as it always was');
    const old = starWorld({ ww5: false, n: NS });
    Date.now = () => old.w.t;
    old.host.frame();
    assert.ok(old.host.state().every((s) => /^\d+\.[0-2]@/.test(s.key)), 'an older relay: the Bay\'s stars alone');
    const off = starWorld({ n: N });   // FRONTS: Skyrim off its turn - the Bay's stars alone
    Date.now = () => off.w.t;
    off.host.frame();
    assert.ok(off.host.state().length > 0 && off.host.state().every((s) => /^\d+\.[0-2]@/.test(s.key)), 'off its turn: no star of Skyrim\'s');
  } finally { Date.now = realNow; }
  const h = src('src/scenes/starfall/starfallHost.js');
  assert.match(h, /scans: \(\) => \(host\.theatreScans !== undefined \? host\.theatreScans : keptTheatreScans\(\)\),/);
  assert.match(h, /const lanesOk = \(\) => !!session\(\)\?\.ww5Ok;/);
  assert.match(h, /for \(const \[lane, sc\] of theatres\.warmLanes\(\)\) out\.push\(\.\.\.laneSitesOf\(n, +\(lane\), sc\)\);/);
  assert.match(h, /try \{\n\s*return findTheatreGateSite\(gateNumber\(day, lane\), sc\);\n\s*\}/, 'a province\'s stars keep off its own gate');
  // every master the host and the client name is its star's coven's (a province's leader where a Bay coven's Coven Mother)
  for (const f of ['src/scenes/starfall/starfallHost.js', 'src/systems/starfall/starfallClient.js']) {
    const calls = src(f).match(/starMasterOf\((?:[^()]|\([^()]*\))*\)/g) ?? [];
    assert.ok(calls.length > 0 && calls.every((c) => /\.coven\)$/.test(c)), `${f}: ${calls.filter((c) => !/\.coven\)$/.test(c))}`);
  }
});

test('WW5 ON THE FREEWARE\'S WORLD: the Bay\'s nights the law before WW5, star for star over the festival\'s every night (its covens, its pixels, its towns); every province\'s three star sites a night (AUDIT FRONTS C12: the sites alone - which nights stand them is its turn\'s), each in its own theatre on its scan\'s ground by a town of its own, its theatre\'s gate of the day kept off (TESA\'s places registered, WW7-1)', { skip: HAVE ? false : 'ARENA2_PATH not set (sh tools/fetch-data.sh)', timeout: 600_000 }, async () => {
  const W = await ww5World();
  const from = starNightAt(FESTIVAL.fromMs), to = starNightAt(FESTIVAL.toMs);
  const bayGate = (d) => findGateSite(d, W.bayScan);
  let bayStars = 0;
  for (let n = from; n <= to; n++) {
    const now = findStarSites(n, W.bayScan, { gateSiteOf: bayGate }).map(idOfSite);
    assert.deepEqual(now, oldStarSites(n, W.bayScan, bayGate), `night ${n}: the Bay's, to the byte`);
    bayStars += now.length;
  }
  assert.ok(bayStars > (to - from) * 2, `${bayStars} Bay stars`);
  for (let t = 1; t <= 8; t++) {
    const sc = W.scans.scanOf(t);
    const keys = new Set([...sc.byArea.values()].flatMap((l) => [...l]));
    let stars = 0;
    for (let n = from; n <= to; n++) {
      const list = findTheatreStarSites(n, t, sc, { gateSiteOf: (d) => findTheatreGateSite(gateNumber(d, t), sc) });
      assert.equal(list.length, 3, `${THEATRE_KEYS[t]} night ${n}`);
      for (const s of list) {
        assert.equal(theatreAt(s.px, s.py), t, `${THEATRE_KEYS[t]}: ${s.px},${s.py} in its own theatre`);
        assert.ok(keys.has(worldPixelKey(s.px, s.py)), 'on its ground');
        assert.ok(s.town && sc.towns.some((x) => x.name === s.town.name && x.px === s.town.px), 'by a town of its own');
        const g = findTheatreGateSite(gateNumber(gameDayAt(s.times.fallAt, t), t), sc);
        if (g) assert.ok(Math.max(Math.abs(g.px - s.px), Math.abs(g.py - s.py)) >= STAR_APART_PX, 'off its gate');
        stars++;
      }
    }
    assert.equal(stars, (to - from + 1) * 3);
  }
});
