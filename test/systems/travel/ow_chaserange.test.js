// OW-CHASE-RANGE (2026-10-19, the owner, of the Overworld's gaps: "4. Fix it"; bible/06-Systems/Travel-View.md
// OW-CHASE-RANGE): A CHASE SEEN AS FAR AS ITS BAND IS DRAWN. The relay fans a cell's foes frame - TV7b's chase word on it
// - RANGE_PIXELS (3) about its sender, and the Overworld draws the bands BAND_REACH_PX (6) about the viewer: a player three
// to six pixels off saw a chased band at its own wander. The chaser's trav frame (TV3, the region's channel) now carries
// its chase words BESIDE its mark (world230: `bd` the bands', `sr` the raiders' - AUDIT OW-REVISITED L4-1: as a key of the
// mark, every older client dropped the traveller whole). Pinned on the wire (net/wire.js: the words checked whole, near
// their chaser), the relay over a real Room (kept beside the mark, fanned and welcomed with it, the widest inside the
// runtime's 2 KiB), the session (the words beside the mark to any relay - an older one drops them, refusing nothing), the
// client's own law (systems/travellerMarks.js: said on a change, again while a chase runs), the region's words and their
// hearing (systems/travel/regionChase.js), a word carried end to end through the real laws, and the world host's half
// (its hearing lifted and run - a region's word stands TRAV_BAND_HOLD_MS, a cell's BAND_WORD_MS, and is withdrawn).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  validTravellerMark, validTravellerFrame, validTravWord, validTravWords, parseClient, TRAV_KEYS, TRAV_BANDS_MAX, TRAV_CHASE_NEAR_PX,
  RELAY_VERSION, RANGE_PIXELS, chatRegionRoom, TRAV_SEND_MIN_MS, OW_BAND_ID_RE, OW_RAIDER_ID_RE, NAME_MAX, WORLD_PIXEL_BOUND,
} from '../../../src/net/wire.js';
import { BANDS_WIRE_MAX, BAND_ID_RE, BAND_WORD_MS, BAND_REACH_PX, BAND_CELL_PX, bandWordOf, validBandWord } from '../../../src/systems/travel/travelBands.js';
import { RAIDER_ID_RE, RAIDER_REACH_PX, RAIDER_CELL_PX, validRaiderWord } from '../../../src/systems/seaRaiders.js';
import { travellerMarkOf, travellerDue, chaseWordKey, TRAV_CHASE_REFRESH_MS, travellerWorldOf } from '../../../src/systems/travellerMarks.js';
import { regionChaseWords, regionChaseHeard, regionChaseWithdraw, TRAV_BAND_HOLD_MS, REGION_BANDS_NEAR_PX, REGION_RAIDERS_NEAR_PX } from '../../../src/systems/travel/regionChase.js';
import { fakeRoom } from '../../fakeRoom.mjs';
import { fakeSocketClass } from '../../fakeSocket.mjs';
import { OnlineSession } from '../../../src/net/online.js';
import { hostText } from '../../hostText.mjs';
import { createRegionChaseHearing } from '../../../src/scenes/regionChaseHost.js';

const quiet = (fn) => { const w = console.warn, l = console.log; console.warn = () => {}; console.log = () => {}; try { return fn(); } finally { console.warn = w; console.log = l; } };
const MARK = Object.freeze({ px: 207, py: 213, fx: 12, fy: 250, h: 64, m: 1, tv: 1 });
/** A native place in map pixel (px, py). */
const at = (px, py, dx = 900, dz = 400) => [px * 32768 + dx, (499 - py) * 32768 + dz];
const BD = Object.freeze([['b103.106.88', ...at(208, 213), 1], ['b51.53.12', 0, 0, 2]]);
const SR = Object.freeze([['r51.53.12', 0, 0, 2]]);

test('OW-CHASE-RANGE the wire: the mark seven keys and no eighth (AUDIT OW-REVISITED L4-1: an older client refused an eighth and dropped the traveller); its chase words beside it - `bd` bands only, `sr` raiders only, each checked whole (an id of its kind once, a chase\'s place on the world\'s pixels AND within TRAV_CHASE_NEAR_PX of the mark, a spent one\'s none), at most TRAV_BANDS_MAX each; the door refuses a bad word, a reader drops it and keeps the mark (mutants: the z bound dropped; a spent one\'s place half-checked; a far chase taken; the kinds crossed)', () => {
  assert.deepEqual(TRAV_KEYS, ['px', 'py', 'fx', 'fy', 'h', 'm', 'tv']);
  assert.equal(validTravellerMark({ ...MARK, bd: BD }), null, 'an eighth key: refused, as every client ever has');
  assert.equal(TRAV_BANDS_MAX, BANDS_WIRE_MAX, 'the foes frame\'s own cap');
  assert.equal(TRAV_CHASE_NEAR_PX, 5);
  assert.equal(OW_BAND_ID_RE.source, BAND_ID_RE.source, 'a band\'s id, its home\'s');
  assert.equal(OW_RAIDER_ID_RE.source, RAIDER_ID_RE.source, 'a raider\'s, its home\'s');
  assert.deepEqual(validTravWords({ bd: BD, sr: SR }, MARK), { bd: BD, sr: SR });
  assert.deepEqual(validTravWords({ bd: [], sr: [] }, MARK), {}, 'nothing to say: no word');
  const eight = Array.from({ length: 8 }, (_, i) => [`b${i}.0.1`, 0, 0, 2]);
  assert.ok(validTravWord(eight, OW_BAND_ID_RE, MARK));
  for (const [why, bd] of [
    ['nine', [...eight, ['b9.0.1', 0, 0, 2]]], ['a raider in the bands\' word', [['r1.2.3', 0, 0, 2]]], ['a stranger\'s id', [['x1.2.3', 0, 0, 2]]],
    ['a spent with a place', [['b1.2.3', 5, 5, 2]]], ['a spent with an x alone', [['b1.2.3', 5, 0, 2]]], ['a place off the world', [['b1.2.3', 1e12, 0, 1]]],
    ['a place off the world\'s other edge', [['b1.2.3', 0, 1e12, 1]]], ['a fraction', [['b1.2.3', 1.5, 2, 1]]], ['a third flag', [['b1.2.3', 0, 0, 3]]],
    ['a band named twice', [['b1.2.3', 0, 0, 2], ['b1.2.3', 0, 0, 2]]], ['three fields', [['b1.2.3', 0, 0]]], ['not a list', 'b1.2.3'],
    ['a chase across the region (AUDIT OW-REVISITED L4-5)', [['b1.2.3', ...at(207 + TRAV_CHASE_NEAR_PX + 1, 213), 1]]],
    ['a chase across the region, north', [['b1.2.3', ...at(207, 213 - TRAV_CHASE_NEAR_PX - 1), 1]]],
  ]) assert.equal(validTravWord(bd, OW_BAND_ID_RE, MARK), null, why);
  assert.ok(validTravWord([['b1.2.3', ...at(207 + TRAV_CHASE_NEAR_PX, 213), 1]], OW_BAND_ID_RE, MARK), 'a chase at the leash\'s edge');
  assert.equal(validTravWord([['b1.2.3', 0, 0, 2]], OW_RAIDER_ID_RE, MARK), null, 'a band in the raiders\' word');
  assert.equal(validTravWords({ bd: [['r1.2.3', 0, 0, 2]] }, MARK), null, 'the words\' own kinds: a raider in `bd`');
  assert.equal(validTravWords({ sr: [['b1.2.3', 0, 0, 2]] }, MARK), null, 'a band in `sr`');
  // at the world's edge a chase within the leash may still lie off the world: refused (each axis)
  const edge = { ...MARK, px: WORLD_PIXEL_BOUND - 1, py: WORLD_PIXEL_BOUND - 1 };
  assert.ok(validTravWord([['b1.2.3', ...at(WORLD_PIXEL_BOUND - 1, WORLD_PIXEL_BOUND - 1), 1]], OW_BAND_ID_RE, edge), 'the premise: on the edge, taken');
  assert.equal(validTravWord([['b1.2.3', ...at(WORLD_PIXEL_BOUND + 1, WORLD_PIXEL_BOUND - 1), 1]], OW_BAND_ID_RE, edge), null, 'off the world east, within the leash');
  assert.equal(validTravWord([['b1.2.3', ...at(WORLD_PIXEL_BOUND - 1, WORLD_PIXEL_BOUND + 1), 1]], OW_BAND_ID_RE, edge), null, 'off the world south, within the leash');
  // the door: the words beside the mark kept, a bad one refuses the frame (the client never says one - the session's own check)
  assert.deepEqual(parseClient(JSON.stringify({ t: 'trav', p: MARK, bd: BD, sr: SR }), { hasHello: true }), { t: 'trav', p: MARK, bd: BD, sr: SR });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'trav', p: MARK, bd: [['x', 0, 0, 2]] }), { hasHello: true }), { error: 'bad trav' });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'trav', p: null, bd: BD }), { hasHello: true }), { t: 'trav', p: null }, 'a clear says nothing beside it');
  // the reader: the words heard; a bad one dropped, the mark kept
  const heard = validTravellerFrame({ t: 'trav', id: 'peer-0002', name: 'Bran', p: MARK, bd: BD, sr: SR });
  assert.deepEqual([heard.p, heard.bd, heard.sr], [MARK, BD, SR], 'heard through the reader\'s own door');
  const bad = validTravellerFrame({ t: 'trav', id: 'peer-0002', name: 'Bran', p: MARK, bd: [['x', 0, 0, 2]] });
  assert.deepEqual([bad.p, bad.bd], [MARK, undefined], 'a bad word dropped, never the mark');
});

/** A plain name the name filter passes, by index. */
const nameOf = (i) => `Rider ${String.fromCharCode(65 + Math.floor(i / 26))}${String.fromCharCode(97 + (i % 26))}`;
async function regionRoom(ids, names = ids.map((_, i) => nameOf(i))) {
  const r = fakeRoom(chatRegionRoom(5));
  const ws = [];
  for (const [i, id] of ids.entries()) { const s = r.connect(); await quiet(() => r.hello(s, id, null, { name: names[i] })); ws.push(s); }
  return { r, ws };
}

test('OW-CHASE-RANGE the relay: the words beside a mark are kept with it on the attachment, fanned beside it, and said beside it in a joiner\'s welcome - the mark itself the seven keys an older client reads; the widest - both words, eight chases each of the longest ids, under the longest name - fits the runtime\'s 2 KiB (mutants: the words dropped on the relay; the welcome without them; a word inside the mark)', async () => {
  const { r, ws: [a, b] } = await regionRoom(['peer-0001', 'peer-0002']);
  for (const s of [a, b]) s.sent.length = 0;
  await r.raw(a, JSON.stringify({ t: 'trav', p: MARK, bd: BD, sr: SR }));
  assert.deepEqual([a.att.tm.bd, a.att.tm.sr], [BD, SR], 'kept');
  const heard = b.sent.filter((m) => m.t === 'trav');
  assert.equal(heard.length, 1);
  assert.deepEqual([heard[0].p, heard[0].bd, heard[0].sr], [MARK, BD, SR], 'fanned beside the mark, the mark its seven keys');
  // a joiner's welcome: the row beside its mark
  const c = r.connect();
  await quiet(() => r.hello(c, 'peer-0003', null, { name: nameOf(2) }));
  const row = c.sent.find((m) => m.t === 'welcome')?.tr?.find((t) => t.id === 'peer-0001');
  assert.ok(row, 'the premise: the welcome lists A');
  assert.deepEqual([row.p, row.bd, row.sr], [MARK, BD, SR], 'welcomed beside the mark');
  // the widest
  const wide = await regionRoom(['peer-0004'], ['W'.repeat(NAME_MAX)]);
  const p = { ...MARK, px: WORLD_PIXEL_BOUND - 3, py: WORLD_PIXEL_BOUND - 3 };
  const word = (k) => Array.from({ length: TRAV_BANDS_MAX }, (_, i) => [`${k}-${1000 + i}.-9999.999999999`, ...at(p.px + 2, p.py + 2, 32767, 1), 1]);
  const words = validTravWords({ bd: word('b'), sr: word('r') }, p);
  assert.ok(words?.bd && words?.sr, 'the widest words are valid ones');
  await wide.r.raw(wide.ws[0], JSON.stringify({ t: 'trav', p, ...words }));
  assert.deepEqual([wide.ws[0].att.tm.bd.length, wide.ws[0].att.tm.sr.length], [TRAV_BANDS_MAX, TRAV_BANDS_MAX], 'the widest kept');
  assert.ok(JSON.stringify(wide.ws[0].att).length <= 2048, `the attachment is ${JSON.stringify(wide.ws[0].att).length} bytes`);
});

function regionLink(relayV) {
  const { FakeWS, sockets } = fakeSocketClass();
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'a', id: 'aaaa-0001', secret: 'secret-of-aaaa-0001', presence: false, WebSocketImpl: FakeWS, now: () => 1_000_000 });
  quiet(() => s.join(chatRegionRoom(5)));
  const ws = sockets[0]; ws.open();
  quiet(() => ws.receive({ t: 'welcome', id: 'aaaa-0001', peers: [], n: 1, v: relayV }));
  return { s, out: () => ws.sent.map((x) => JSON.parse(x)).filter((m) => m.t === 'trav') };
}

test('OW-CHASE-RANGE the session: the words go beside the mark to any relay (an older one reads the mark and drops them - nothing refused); a word the door would refuse goes unsaid, never the mark with it (AUDIT OW-REVISITED L4-9: one bad entry froze the region mark every frame) (mutants: a word inside the mark; a bad word sent; the mark refused for it)', () => {
  const link = regionLink(RELAY_VERSION);
  assert.equal(link.s.sendTraveller({ ...MARK, bd: BD, sr: SR }), true);
  const sent = link.out().at(-1);
  assert.deepEqual([sent.p, sent.bd, sent.sr], [MARK, BD, SR], 'beside the mark, never in it');
  const old = regionLink('world223');
  assert.equal(old.s.sendTraveller({ ...MARK, bd: BD }), true, 'an older relay: the same frame (its door reads the mark alone)');
  const twice = regionLink(RELAY_VERSION);
  assert.equal(twice.s.sendTraveller({ ...MARK, bd: [['b1.2.3', 0, 0, 2], ['b1.2.3', 0, 0, 2]], sr: SR }), true, 'the mark still goes');
  const t2 = twice.out().at(-1);
  assert.deepEqual([t2.p, t2.bd, t2.sr], [MARK, undefined, SR], 'the bad word unsaid, the good one said');
});

test('OW-CHASE-RANGE the client\'s law: a mark goes again when its words say another chase or another band or raider spent - never for a chase\'s place alone - and while a chase RUNS, every TRAV_CHASE_REFRESH_MS (the session\'s floor); a ship that only stands about me no chase (AUDIT OW-REVISITED L4-8: twelve marks in two minutes moored by one) (mutants: the place a reason; no refresh; the refresh for a standing ship)', () => {
  assert.equal(TRAV_CHASE_REFRESH_MS, TRAV_SEND_MIN_MS);
  assert.equal(chaseWordKey(BD, SR), 'b103.106.88:1,b51.53.12:2|r51.53.12:2');
  assert.equal(chaseWordKey(undefined), '|');
  const mark = travellerMarkOf({ x: 207 * 32768 + 100, z: (499 - 213) * 32768 + 100 });
  const st = { last: { ...mark }, at: 0 };
  const due = (bd, now, chasing) => travellerDue(st, { now, mark: bd ? { ...mark, bd } : mark, alone: false, shown: true, chasing });
  assert.equal(due(null, 1000), null, 'nothing new');
  assert.equal(due([['b1.1.1', 50, 50, 1]], 1000), 'send', 'a chase begun');
  st.last = { ...mark, bd: [['b1.1.1', 50, 50, 1]] };
  st.at = 1000;
  assert.equal(due([['b1.1.1', 90, 90, 1]], 2000), null, 'the band moved: not alone a reason');
  assert.equal(due([['b1.1.1', 90, 90, 1]], 1000 + TRAV_CHASE_REFRESH_MS, true), 'send', 'the chase running: said again where it runs');
  assert.equal(due([['b1.1.1', 90, 90, 1]], 1000 + TRAV_CHASE_REFRESH_MS, false), null, 'a ship that only stands: no refresh');
  assert.equal(due([['b1.1.1', 0, 0, 2]], 2000), 'send', 'the band spent');
  st.last = { ...mark, bd: [['b1.1.1', 0, 0, 2]] };
  assert.equal(due([['b1.1.1', 0, 0, 2]], 1000 + TRAV_CHASE_REFRESH_MS), null, 'a spent word alone waits the keepalive');
  assert.equal(due(null, 2000), 'send', 'the word gone: said');
  assert.equal(travellerDue({ last: { ...mark, sr: [] }, at: 1000 }, { now: 2000, mark: { ...mark, sr: SR }, alone: false, shown: true }), 'send', 'a raider spent: said');
});

test('OW-CHASE-RANGE the region\'s words: each its own slots (AUDIT OW-REVISITED L4-6: one shared word let eight spent bands keep every raider spend off it) - the chases first, then the spent of this life and the last; heard from a traveller at ANY distance it could share the chase with me (L4-4: past the cell\'s reach only, a chase went unseen for seconds at the hand-over) and from none farther (L4-5) - the bands\' within REGION_BANDS_NEAR_PX, the raiders\' within REGION_RAIDERS_NEAR_PX; standing TRAV_BAND_HOLD_MS (mutants: one word; the dead lives kept; the cell\'s reach a floor; no ceiling)', () => {
  const w = regionChaseWords([['b1.1.9', 0, 0, 2], ['b2.2.9', 5, 5, 1], ['b3.3.2', 0, 0, 2]], [['r1.1.9', 7, 7, 1], ['r2.2.1', 0, 0, 2]], 9, 9);
  assert.deepEqual(w, { bd: [['b2.2.9', 5, 5, 1], ['b1.1.9', 0, 0, 2]], sr: [['r1.1.9', 7, 7, 1]] }, 'chases first, then the spent of these lives; a life gone by unsaid');
  const many = Array.from({ length: 12 }, (_, i) => [`b${i}.0.9`, 0, 0, i < 3 ? 1 : 2]);
  const full = regionChaseWords(many, [['r9.9.9', 0, 0, 2]], 9, 9);
  assert.equal(full.bd.length, BANDS_WIRE_MAX);
  assert.deepEqual(full.bd.slice(0, 3).map((e) => e[3]), [1, 1, 1], 'every chase kept');
  assert.deepEqual(full.sr, [['r9.9.9', 0, 0, 2]], 'the raider spend has its own slots');
  assert.equal(TRAV_BAND_HOLD_MS, 2.5 * TRAV_CHASE_REFRESH_MS);
  assert.ok(TRAV_BAND_HOLD_MS > BAND_WORD_MS, 'longer than a cell\'s word: the region\'s comes a refresh at a time');
  assert.deepEqual([REGION_BANDS_NEAR_PX, REGION_RAIDERS_NEAR_PX], [BAND_REACH_PX + BAND_CELL_PX + 1, RAIDER_REACH_PX + RAIDER_CELL_PX + 1]);
  const f = (dx) => ({ id: 'peer-2', p: { ...MARK, px: 100 + dx, py: 50 }, bd: BD, sr: SR });
  assert.deepEqual(regionChaseHeard(f(RANGE_PIXELS), { x: 100, y: 50 }), { bd: BD, sr: SR }, 'within the cell\'s reach: heard (a fresh cell word preferred by the hearing)');
  assert.deepEqual(regionChaseHeard(f(REGION_BANDS_NEAR_PX), { x: 100, y: 50 }), { bd: BD, sr: SR }, 'at the bands\' reach');
  assert.deepEqual(regionChaseHeard(f(REGION_BANDS_NEAR_PX + 1), { x: 100, y: 50 }), { bd: [], sr: SR }, 'past it: the raiders\' alone');
  assert.deepEqual(regionChaseHeard(f(REGION_RAIDERS_NEAR_PX + 1), { x: 100, y: 50 }), { bd: [], sr: [] }, 'past both: nothing');
  assert.equal(regionChaseHeard({ id: 'p', p: null }, { x: 0, y: 0 }), null, 'a clear: no words');
  assert.ok(BAND_REACH_PX > RANGE_PIXELS, 'the premise: the bands drawn past the cell\'s reach');
  // withdrawn: a sender's region-held entries its next word no longer names; a cell's never
  const peers = new Map([['b1', { from: 'a', hold: TRAV_BAND_HOLD_MS }], ['b2', { from: 'a', hold: TRAV_BAND_HOLD_MS }], ['b3', { from: 'a', hold: BAND_WORD_MS }], ['b4', { from: 'z', hold: TRAV_BAND_HOLD_MS }]]);
  regionChaseWithdraw(peers, 'a', new Set(['b2']));
  assert.deepEqual([...peers.keys()], ['b2', 'b3', 'b4'], 'the unnamed withdrawn; the named, the cell\'s and another\'s kept');
  regionChaseWithdraw(peers, 'a');
  assert.deepEqual([...peers.keys()], ['b3', 'b4'], 'a clear: all of theirs the region held');
});

test('OW-CHASE-RANGE end to end through the real laws: A, five pixels from B, chases a band - A\'s words beside A\'s mark, through the relay\'s door and the reader\'s, heard by B: the band where A says it runs, and the raider A spent; A three hundred pixels off, nothing (mutants: any door\'s word dropped; the far heard)', () => {
  const chases = new Map([['b51.53.4000', { pos: { x: 102 * 32768 + 900, z: (499 - 107) * 32768 + 400 } }]]);
  const words = regionChaseWords(bandWordOf(chases, []), [['r51.53.12', 0, 0, 2]], 4000, 12);
  const mark = travellerMarkOf({ x: 102 * 32768 + 500, z: (499 - 107) * 32768 + 500 });
  const sent = parseClient(JSON.stringify({ t: 'trav', p: mark, ...words }), { hasHello: true });   // the relay's door
  const heard = validTravellerFrame({ t: 'trav', id: 'peer-000a', name: 'A', ...sent });   // the reader's
  const got = regionChaseHeard(heard, { x: 107, y: 107 });
  assert.deepEqual(validBandWord(got.bd), [['b51.53.4000', 102 * 32768 + 900, (499 - 107) * 32768 + 400, 1]], 'the band where A says it runs');
  assert.deepEqual(validRaiderWord(got.sr), [['r51.53.12', 0, 0, 2]], 'and the raider A spent');
  assert.deepEqual(regionChaseHeard(heard, { x: 407, y: 107 }), { bd: [], sr: [] }, 'three hundred pixels off: nothing');
});

test('OW-CHASE-RANGE the host: my mark carries my words beside it; a traveller\'s frame - one heard, a clear, a leave, a welcome - heard through the bands\' and the raiders\' own hearing (a fresh cell word preferred; a welcome row\'s age taken from its hold) and WITHDRAWN when no longer said (AUDIT OW-REVISITED L4-2: a far chase stood drawn 25 s after it ended), nothing heard of one my map hides (L4-3, WILD1) (mutants: the chase never withdrawn; a clear unheard; a leave unheard; the hidden heard; the cell word overridden; the age unread)', () => {
  const w = hostText('src/scenes/world.js');
  assert.match(w, /if \(mark\) Object\.assign\(mark, regionChaseWords\(bandWordOf\(_bandChase, _bandSpentAt\), raiderWordOf\(seaRaidHeld\(\), tvRaid\.spentAt\), Math\.floor\(bandNowMs\(\) \/ BAND_LIFE_MS\), Math\.floor\(raidNowMs\(\) \/ RAIDER_LIFE_MS\)\)\);[^\n]*\n\s*const due = travellerDue\(travellerSent, \{ now, mark, alone: link\.othersHere === 0, shown, chasing: _bandChase\.size > 0 \|\| tvRaid\.chase\.size > 0 \}\);/);
  assert.match(w, /link\.onTraveller = \(f\) => \{ travellerBook\.put\(f, Date\.now\(\)\); regionChase\.hear\(f\); \};/);
  assert.match(w, /link\.onTravellerLeft = \(id\) => \{ travellerBook\.drop\(id\); regionChase\.hear\(\{ id, p: null \}\); \};/);
  assert.match(w, /link\.onTravellerRoom = \(list\) => \{ travellerBook\.reset\(list, Date\.now\(\)\); travellerSent\.last = null; travellerSent\.at = 0; regionChase\.room\(list\); \};/);
  // HOST-SPLIT: the hearing is scenes/regionChaseHost.js, wired with the host's own hearings and books
  assert.match(w, /const regionChase = createRegionChaseHearing\(\{ bandHear, seaRaidHear, bands: \(\) => _bandPeer, raids: \(\) => tvRaid\.peer, me: \(\) => playerTravelPixel\(\), wildHides: wildHidesPlayer, social: \(\) => social, guildTag: myGuildTag \}\);/);
  // the host's hearings lifted, the module's run over them and the clock
  const lift = (head) => { const at2 = w.indexOf(head); assert.ok(at2 >= 0, head); return w.slice(at2, w.indexOf('\n  }\n', at2) + 4); };
  let now = 1000, hidden = false;
  const env = {
    performance: { now: () => now }, _bandPeer: new Map(), _bandChase: new Map(), _bandSpent: new Set(), validBandWord, bandNearMe: () => true,
    bandPixelOf: (p) => p, playerTravelPixel: () => ({ x: 100, y: 100 }), bandNowMs: () => 0, BAND_LIFE_MS: 1, chaseYields: () => false, online: null, wildBands: { forget() {} }, BAND_WORD_MS,
    tvRaid: { peer: new Map(), chase: new Map(), spent: new Set() }, validRaiderWord, raiderNearMe: () => true, raidNowMs: () => 0, RAIDER_LIFE_MS: 1, RAIDER_WORD_MS: 3000,
  };
  const names = Object.keys(env);
  const host = new Function(...names, `${lift('  function bandPeerChase(id) {')}\n${lift('  function bandHear(from, raw, hold = BAND_WORD_MS, aged = 0) {')}\n${lift('  function seaRaidPeerChase(id) {')}\n${lift('  function seaRaidHear(from, raw, hold = RAIDER_WORD_MS, aged = 0) {')}\nreturn { bandPeerChase, bandHear, seaRaidPeerChase, seaRaidHear };`)(...names.map((k) => env[k]));
  const asked = [];
  const social = { isFriendPeer: (id) => id === 'peer-f', isPartyPeer: (id) => id === 'peer-p' };
  const hearing = createRegionChaseHearing({ bandHear: host.bandHear, seaRaidHear: host.seaRaidHear, bands: () => env._bandPeer, raids: () => env.tvRaid.peer,
    me: () => ({ x: 100, y: 100 }), wildHides: (who) => { asked.push(who); return hidden; }, social: () => social, guildTag: () => null });
  const run = { ...host, regionChaseHear: hearing.hear, regionChaseRoom: hearing.room };
  const A = (bd, sr = []) => ({ id: 'peer-a', p: { ...MARK, px: 104, py: 100 }, bd, sr });
  run.regionChaseHear(A([['b1.1.1', 10, 20, 1]], [['r1.1.1', 30, 40, 1]]));
  now += BAND_WORD_MS + 1;
  assert.deepEqual([run.bandPeerChase('b1.1.1')?.x, run.seaRaidPeerChase('r1.1.1')?.x], [10, 30], 'the region\'s words stand past a cell\'s');
  run.regionChaseHear(A([]));   // A's next mark: the chase over
  assert.deepEqual([run.bandPeerChase('b1.1.1'), run.seaRaidPeerChase('r1.1.1')], [null, null], 'withdrawn when no longer said');
  run.regionChaseHear(A([['b1.1.1', 10, 20, 1]]));
  run.regionChaseHear({ id: 'peer-a', p: null });
  assert.equal(run.bandPeerChase('b1.1.1'), null, 'a clear withdraws it');
  run.regionChaseHear(A([['b1.1.1', 10, 20, 1]]));
  now += TRAV_BAND_HOLD_MS + 1;
  assert.equal(run.bandPeerChase('b1.1.1'), null, 'and it lapses at its own hold');
  // a fresh cell word for the same band: kept over the region's
  run.bandHear('peer-c', [['b2.2.2', 1, 2, 1]]);
  run.regionChaseHear(A([['b2.2.2', 50, 60, 1]]));
  assert.equal(run.bandPeerChase('b2.2.2')?.x, 1, 'the cell\'s fresh word kept');
  // hidden (WILD1): nothing heard
  hidden = true;
  run.regionChaseHear(A([['b3.3.3', 10, 20, 1]]));
  assert.equal(run.bandPeerChase('b3.3.3'), null, 'one my map hides: nothing heard');
  assert.deepEqual(asked.at(-1).wire, [travellerWorldOf(A([]).p).x, 0, travellerWorldOf(A([]).p).z], 'asked where their mark stands');
  run.regionChaseHear({ ...A([['b3.3.3', 10, 20, 1]]), id: 'peer-p' });
  assert.equal(asked.at(-1).party, true, 'my party asked as my party');
  hidden = false;
  // a welcome: A listed with an aged row; B, heard before, not listed - withdrawn
  run.regionChaseHear({ id: 'peer-b', p: { ...MARK, px: 103, py: 100 }, bd: [['b4.4.4', 1, 1, 1]], sr: [] });
  run.regionChaseRoom([{ ...A([['b5.5.5', 7, 7, 1]]), ag: (TRAV_BAND_HOLD_MS - 2000) / 1000 }]);
  assert.equal(run.bandPeerChase('b4.4.4'), null, 'one the welcome no longer lists: withdrawn');
  assert.equal(run.bandPeerChase('b5.5.5')?.x, 7, 'a listed row heard');
  now += 2001;
  assert.equal(run.bandPeerChase('b5.5.5'), null, 'its age taken from its hold');
  run.regionChaseRoom([{ ...A([['b6.6.6', 7, 7, 1]]), ag: TRAV_BAND_HOLD_MS / 1000 }]);
  assert.equal(run.bandPeerChase('b6.6.6'), null, 'a row older than the word stands: never heard');
});
