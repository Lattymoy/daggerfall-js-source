// EVENTS1 (2026-10-23, the owner: "Instead of stuffing these in the chat menu, there must be a less obstructive and more
// detailed way to handle them"): THE EVENT BOARD'S LAW (systems/eventBoard.js) AND ITS DOOR (systems/eventNotices.js).
// Design: bible/10-UI/Event-Board.md; AUDIT EVENTS1, bible/01-Overview/audits/Audit-Event-Board.md. The fixtures are the
// producers' own (TEST THE SHAPE THE PRODUCER MINTS): the stars through starTimerRows, the raids through raidTimerList
// over a restored day, the gate's and the serpent's rows through eventTimerRows' laws. Mutation list:
// tools/mutants/events1.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  eventWay, eventBoardModel, eventAnnouncements, createEventToasts, EVENT_SOON_MS, EVENT_BOARD_ROWS, EVENT_BOARD_RAIDS, EVENT_RAID_REACH_M,
  EVENT_TOAST_MS, EVENT_NOTE_SAME_MS, EVENT_NOTE_MIN_MS, EVENT_TOASTS_SHOWN, EVENT_TOASTS_KEPT, EVENT_SEED_GRACE_MS, EVENT_KIND_TEXT, EVENT_SINGLE_KINDS,
  EVENT_BOARD_KINDS,
} from '../../src/systems/eventBoard.js';
import {
  eventNotice, takeEventNotices, seatEventBoard, eventBoardSource, eventBoardOn, eventNoticeElsewhere, eventHudLine, eventKindShown, _resetEventNotices,
  EVENT_NOTICES_KEPT, EVENT_BOARD_PREF, EVENT_NOTICE_KINDS,
} from '../../src/systems/eventNotices.js';
import { gateAt, PIXEL_M } from '../../src/net/gate/gateLaw.js';
import { serpentAt, serpentTimes, serpentBossOf } from '../../src/net/serpent/serpentLaw.js';
import { starTimes, starNightAt, STAR_FALLS_MS } from '../../src/net/starfall/starfallLaw.js';
import { FESTIVALS } from '../../src/net/festivalLaw.js';
import { STAR_COVENS } from '../../src/systems/starfall/starfallCovens.js';
import { starTimerRows, STAR_WARN_MS } from '../../src/systems/starfall/starfallClient.js';
import {
  setRaidingPartiesHost, restoreRaidSaveData, raidTimerList, raidRegionNow, raidKey, _resetRaidingParties,
} from '../../src/systems/raidingParties.js';
import { MINUTES_PER_DAY } from '../../src/systems/gameDate.js';
import { LOCATION_TYPES } from '../../src/formats/mapsFile.js';
import { registerPresenter, _resetNotifyForTests } from '../../src/systems/notify.js';
import { setPref, _resetForTests as resetPrefs } from '../../src/systems/uiPrefs.js';
import { FEATURES, EVENT_KINDS, EVENT_KIND_ORDER, eventKindPref, FEATURE_PREF_DEFAULTS, FEATURE_PREF_ONLINE } from '../../src/systems/features.js';

const HERE = { x: 200, y: 200 };
/** A moment the day's gate is open (gateLaw's own clock). */
const G = gateAt(Date.UTC(2026, 9, 23, 12, 0, 0));
const OPEN = G.openAt + 60_000;
/** The board's row ids of the kinds a check is about (the shared clock's other events stand beside them at times). */
const ids = (m, kinds = ['gate', 'star', 'raid', 'super']) => m.rows.filter((r) => kinds.includes(r.kind)).map((r) => r.id);
const of = (rows, kind) => rows.filter((r) => r.kind === kind);

/** A night's stars as the host finds them (systems/starfall/starfallSites.js's shape), read through starTimerRows. */
const N = starNightAt(FESTIVALS[0].fromMs) + 30;   // a night inside the Witches' Festival (star6_words.test.js's)
const site = (k, o = {}) => ({ n: N, k, px: [190, 210, 200][k], py: [210, 200, 190][k], near: ['Gothway Garden', 'Copperham', 'Ilessan Hills'][k], coven: STAR_COVENS[0], ...o });
const SITES = [site(0), site(1), site(2)];
const ST = SITES.map((s) => starTimes(s.n, s.k));

/** A raid day restored as a save carries it (systems/raidingParties.js), read through raidTimerList - its minutes on a
 *  relay clock of 5 s a classic minute (the event clock's pace), from a base this test sets. */
const DAY = 400;
const AT = (min) => DAY * MINUTES_PER_DAY + min;
const raidRec = (o = {}) => ({ regionIndex: 17, locationIndex: 7, startDay: DAY, locationName: 'Ilessan Hills', type: 2, startMinute: AT(600), endMinute: AT(720), killed: 0, attackAmount: 18, cleansed: false, announced: false, struck: false, px: 201, py: 200, ...o });
const REGIONS = { 17: 'Daggerfall', 18: 'Wayrest' };
function raidDay(raids, nowMinute = AT(610)) {
  const at = { now: nowMinute };
  setRaidingPartiesHost({ now: () => at.now, regionIndex: () => 17 });
  restoreRaidSaveData({ lastSelectedDay: DAY, raids });
  const relayOf = (m) => OPEN + (m - nowMinute) * 5000;   // the relay's now is this day's `nowMinute`
  return { at, relayOf, list: (ahead = 0) => raidTimerList(relayOf, (r) => REGIONS[r], ahead) };
}

test('EVENTS1 THE WAY: metres between the pixels\' hearts (a pixel PIXEL_M), the compass word clockwise from north with y running south, "Nearby" on the same pixel, tenths under 10 km and whole km past it by the rounded value (AUDIT EVENTS1 A10); nothing where either end is unknown (mutants: the scale, the bearing\'s sign, the seam)', () => {
  assert.deepEqual(eventWay(HERE, { px: 200, py: 200 }), { m: 0, dir: '', text: 'Nearby' });
  const east = eventWay(HERE, { px: 210, py: 200 });
  assert.equal(east.m, 10 * PIXEL_M);
  assert.deepEqual([east.dir, east.text], ['E', '8.2 km E']);
  assert.equal(eventWay(HERE, { px: 200, py: 195 }).text, '4.1 km N', 'a smaller y is north');
  assert.deepEqual(['S', 'NE', 'SW', 'W'], [[200, 205], [205, 195], [195, 205], [195, 200]].map(([px, py]) => eventWay(HERE, { px, py }).dir));
  assert.equal(eventWay(HERE, { px: 201, py: 200 }).text, '0.8 km E');
  assert.equal(eventWay(HERE, { px: 213, py: 200 }).text, '11 km E');
  assert.equal(eventWay(HERE, { px: 212, py: 200 }).text, '9.8 km E', 'under ten km: a tenth');
  assert.equal(eventWay(HERE, { px: 212, py: 202 }).text, '10 km E', 'AUDIT EVENTS1 A10: 9,966 m rounds to ten - "10 km", never "10.0 km"');
  assert.equal(eventWay(null, { px: 1, py: 1 }), null);
  assert.equal(eventWay(HERE, null), null);
  assert.equal(eventWay(HERE, { px: NaN, py: 1 }), null);
});

test('EVENTS1 THE LAW\'S NUMBERS: a quarter hour ahead, three rows on a desk, the nearest two raids, 25 km of reach, a news of 9 s and one at a time, a joined line 5 s of its own, a minute\'s sameness, six kept, the seed\'s 5 s of grace, a star\'s 10 minutes\' warning (mutants: each number)', () => {
  assert.deepEqual([EVENT_SOON_MS, EVENT_BOARD_ROWS, EVENT_BOARD_RAIDS, EVENT_RAID_REACH_M, EVENT_TOAST_MS, EVENT_TOASTS_SHOWN, EVENT_NOTE_MIN_MS, EVENT_NOTE_SAME_MS, EVENT_TOASTS_KEPT, EVENT_SEED_GRACE_MS, STAR_WARN_MS],
    [900_000, 3, 2, 25_000, 9000, 1, 5000, 60_000, 6, 5000, 600_000]);
  assert.deepEqual([...EVENT_SINGLE_KINDS], ['gate', 'serpent', 'super', 'festival'], 'a star and a raid have several at once');
});

test('EVENTS1 THE GATE AND THE SERPENT ON THE BOARD: their rows in the player\'s words (AUDIT EVENTS1 W3) - the gate open to its seal, near its place, its way off its site; sealed, no one gets in and it is left out (A6); the serpent hunting off its port with its way; each one\'s `since` its law\'s moment; the resets, the seat week and the battles stay the Timers window\'s (mutants: the shut filter, the serpent\'s way, the kinds filter)', () => {
  const src = (o = {}) => ({ now: OPEN, pixel: HERE, region: 'Daggerfall', gate: { place: 'Copperham, Daggerfall', site: { px: 207, py: 191 } }, ...o });
  const gate = of(eventBoardModel(src()).rows, 'gate')[0];
  assert.deepEqual([gate.id, gate.title, gate.detail, gate.where, gate.way.text, gate.live, gate.at, gate.since, gate.announce],
    [`gate:${G.day}`, 'Dagon\'s Breach is open', 'It seals when this runs out', 'Near Copperham, Daggerfall', '9.3 km NE', true, G.sealAt, G.openAt, true]);
  assert.deepEqual(of(eventBoardModel(src({ now: G.sealAt + 1000 })).all, 'gate'), [], 'sealed for the night: no one gets in');
  // its omen a quarter hour before it opens: on the board from that very ms, the horizon's own edge
  const omen = of(eventBoardModel(src({ now: G.omenAt })).rows, 'gate')[0];
  assert.deepEqual([omen.title, omen.detail, omen.live, omen.at, omen.since], ['Dagon\'s Breach opens', 'Its omen burns in the sky', false, G.openAt, G.omenAt]);
  assert.deepEqual(of(eventBoardModel(src({ now: G.omenAt - 60_000, gate: { place: null, site: null } })).rows, 'gate'), [], 'before its omen: no place, no row');
  // the serpent, hunting
  const S = serpentAt(OPEN), T = serpentTimes(S.day), boss = serpentBossOf(S.day).name;
  const m = eventBoardModel(src({ now: T.riseAt + 60_000, gate: null, serpent: { place: 'Sentinel', site: { px: 190, py: 200 }, fellAt: () => null } }));
  const serpent = of(m.rows, 'serpent')[0];
  assert.deepEqual([serpent.id, serpent.title, serpent.detail, serpent.where, serpent.way.text, serpent.live, serpent.since],
    [`serpent:${S.day}`, `${boss} hunts`, 'It dives when this runs out', 'Off Sentinel', '8.2 km W', true, T.riseAt]);
  // a reset a minute before midnight, its place '00:00 UTC': inside the horizon, never on the board
  const midnight = Math.ceil(OPEN / 86_400_000) * 86_400_000;
  const reset = eventBoardModel(src({ now: midnight - 60_000, gate: null }));
  assert.ok(!reset.all.some((r) => ['reset', 'seat', 'battle', 'elite'].includes(r.kind)), 'the daily reset stays the Timers window\'s');
});

test('EVENTS1 THE ABYSS DUNGEON ON THE BOARD: found, its row stands near its city with its way off the site the host hands (AUDIT EVENTS1 A2) and its `since` its find; collapsing after the kill it is left out (A6) (mutants: the site\'s way, the find\'s moment)', () => {
  const rec = { s: 7, ph: 'found', r: 18, at: OPEN - 7_200_000, foundAt: OPEN - 3_600_000, fb: 'Ann', until: OPEN + 600_000 };
  const sd = { rec, name: 'The Shattered Hour', site: { px: 210, py: 200, cityName: 'Wayrest' } };
  const row = of(eventBoardModel({ now: OPEN, pixel: HERE, sd }).rows, 'super')[0];
  assert.deepEqual([row.id, row.title, row.detail, row.where, row.way.text, row.live, row.since], ['sd:7', 'The Shattered Hour stands', 'It fades away unbeaten when this runs out', 'Near Wayrest', '8.2 km E', true, rec.foundAt]);
  assert.deepEqual(of(eventBoardModel({ now: OPEN, pixel: HERE, sd: { ...sd, rec: { ...rec, fellAt: OPEN - 1000 } } }).all, 'super'), [], 'its Hour broken: no one gets in');
});

test('EVENTS1 THE STARS ON THE BOARD, FROM starTimerRows: each star warned STAR_WARN_MS before it falls - EVERY star, not only the soonest (AUDIT EVENTS1 A3: the night\'s falls are 7.5 minutes apart) - with its town and its way; its `since` its warning, then its fall; a star held or lost leaves (mutants: the warning for the soonest alone, the since)', () => {
  assert.equal(STAR_FALLS_MS[1] - STAR_FALLS_MS[0], 450_000, 'the falls 7.5 minutes apart');
  // a minute after the first falls: the second (6.5 min off) warned; the third (14 min off) not yet, and not the soonest
  const t = ST[0].fallAt + 60_000;
  const rows = starTimerRows(SITES, t);
  assert.deepEqual(rows.map((r) => [r.id, r.live, r.where]), [[`star:${N}.0`, true, 'Near Gothway Garden'], [`star:${N}.1`, false, 'Near Copperham']]);
  // before the night's first falls by more than the warning: the soonest alone, coming without its town - and inside the
  // board's horizon, still off it: a star with no town yet is no place to go
  assert.deepEqual(starTimerRows(SITES, ST[0].fallAt - STAR_WARN_MS - 1).map((r) => [r.id, r.where]), [[`star:${N}.0`, null]]);
  const early = ST[0].fallAt - STAR_WARN_MS - 60_000;
  assert.deepEqual(of(eventBoardModel({ now: early, pixel: HERE, stars: starTimerRows(SITES, early) }).all, 'star'), [], 'eleven minutes off, no town: not on the board');
  // ten minutes before the third falls the second is still coming: both warned at once
  const t2 = ST[2].fallAt - STAR_WARN_MS;
  assert.deepEqual(starTimerRows(SITES, t2).filter((r) => !r.live).map((r) => [r.id, r.where]), [[`star:${N}.1`, 'Near Copperham'], [`star:${N}.2`, 'Near Ilessan Hills']], 'every warned star named - the third 10 minutes ahead');
  const m = eventBoardModel({ now: t2, pixel: HERE, stars: starTimerRows(SITES, t2) });
  const third = of(m.rows, 'star').find((r) => r.id === `star:${N}.2`);
  assert.deepEqual([third.way.text, third.since, third.at], ['8.2 km N', ST[2].fallAt - STAR_WARN_MS, ST[2].fallAt]);
  const fallen = of(eventBoardModel({ now: t, pixel: HERE, stars: rows }).rows, 'star').find((r) => r.live);
  assert.equal(fallen.since, ST[0].fallAt, 'a fallen star came on at its fall');
  assert.deepEqual(eventBoardModel({ now: t, pixel: HERE, stars: starTimerRows(SITES, t, () => true) }).all.filter((r) => r.live && r.kind === 'star'), [], 'decided: gone');
});

test('EVENTS1 THE RAIDS ON IT, FROM raidTimerList: the nearest two under way or within the horizon (to the ms), never one over or cleansed; its id its raid\'s key; its party and its count in the player\'s words (AUDIT EVENTS1 W1/W2); announced in the player\'s region or within EVENT_RAID_REACH_M - a raid of the region past the reach still, one of another region past it never (mutants: the nearest, the region rule, the reach, the horizon\'s edge, live from its start)', () => {
  _resetRaidingParties();
  const far = (n, i, px, o = {}) => raidRec({ regionIndex: 18, locationIndex: i, locationName: n, px, py: 200, ...o });
  const d = raidDay([
    raidRec({ locationName: 'Here' }),
    far('Near', 2, 225, { type: 1 }),
    far('Reach', 3, 230),
    far('Past', 4, 231),
    raidRec({ locationIndex: 5, locationName: 'Home far', px: 260, py: 200 }),
    raidRec({ locationIndex: 6, locationName: 'Done', cleansed: true }),
    raidRec({ locationIndex: 8, locationName: 'Over', startMinute: AT(400), endMinute: AT(520) }),
    raidRec({ locationIndex: 9, locationName: 'Edge', startMinute: AT(610) + EVENT_SOON_MS / 5000, endMinute: AT(900), px: 250 }),
    raidRec({ locationIndex: 10, locationName: 'Later', startMinute: AT(610) + EVENT_SOON_MS / 5000 + 1, endMinute: AT(900), px: 250 }),
  ]);
  const list = d.list();
  assert.deepEqual(Object.keys(list[0]).sort(), ['done', 'endMs', 'key', 'n', 'name', 'px', 'py', 'region', 'startMs', 'tg', 'type'].sort(), 'the producer\'s shape');
  assert.equal(list[0].key, raidKey(raidRec({ locationName: 'Here' })));
  const m = eventBoardModel({ now: OPEN, pixel: HERE, region: 'Daggerfall', raids: list }, { max: 20 });
  const raids = of(m.all, 'raid');
  assert.deepEqual(of(m.rows, 'raid').map((r) => r.title), ['Raid on Here', 'Raid on Near'], 'the nearest two');
  assert.deepEqual(raids.map((r) => r.title).sort(), ['Raid on Edge', 'Raid on Here', 'Raid on Home far', 'Raid on Near', 'Raid on Past', 'Raid on Reach'], 'none over, cleansed or past the horizon; the edge itself in');
  const by = (title) => raids.find((r) => r.title === title);
  assert.equal(by('Raid on Here').id, `raid:${raidKey(raidRec({ locationName: 'Here' }))}`);
  assert.deepEqual([by('Raid on Here').live, by('Raid on Here').detail], [true, 'Orcs attacking']);
  assert.equal(by('Raid on Near').detail, 'Bandits attacking', 'the party in the player\'s words');
  assert.deepEqual([by('Raid on Edge').live, by('Raid on Edge').since], [false, by('Raid on Edge').at - EVENT_SOON_MS], 'coming: on the board since the horizon reached it');
  assert.equal(by('Raid on Here').since, d.relayOf(AT(600)), 'under way: since its start');
  assert.deepEqual([by('Raid on Reach').announce, by('Raid on Past').announce], [true, false], '30 pixels (24.6 km) within the reach, 31 (25.4 km) past it');
  assert.equal(by('Raid on Home far').announce, true, 'its region\'s, 49 km away: the mod\'s own rule');
  const atStart = eventBoardModel({ now: OPEN, pixel: HERE, raids: raidDay([raidRec({ locationName: 'Now', startMinute: AT(610) })]).list() });
  assert.deepEqual([of(atStart.rows, 'raid')[0].live, of(atStart.rows, 'raid')[0].detail], [true, 'Orcs attacking'], 'live from its start minute');
  _resetRaidingParties();
});

test('EVENTS1 THE RAID\'S COUNT AND ITS REGION: the relay\'s ledger on the row in the label form (W1), never past its target; raidRegionNow is the raids\' own region - the host\'s, none at sea or past the Veil (AUDIT EVENTS1 A8, G7) (mutants: the cap, the region\'s door)', () => {
  _resetRaidingParties();
  const d = raidDay([raidRec()]);
  const list = d.list().map((r) => ({ ...r, n: 30, tg: 18 }));
  assert.equal(of(eventBoardModel({ now: OPEN, pixel: HERE, raids: list }).rows, 'raid')[0].detail, 'Raiders down: 18 of 18');
  assert.equal(raidRegionNow(), 17);
  setRaidingPartiesHost({ regionIndex: () => -1 });
  assert.equal(raidRegionNow(), -1, 'at sea, past the Veil: no region');
  _resetRaidingParties();
});

test('EVENTS1 A RAID EARLY IN A DAY IS NAMED A QUARTER HOUR AHEAD: within the ahead of the day\'s turn, raidTimerList lists the next day\'s roll beside the day\'s (AUDIT EVENTS1 A4) - never further out, and never for a day not yet rolled (mutants: the look ahead, its reach, a roll before the regions)', () => {
  _resetRaidingParties();
  const row = (locationType, x, y) => ({ locationType, longitude: x * 128, latitude: (499 - y) * 128 });
  const regions = { 5: { mapNames: ['City', 'Village'], mapTable: [row(LOCATION_TYPES.TownCity, 10, 20), row(LOCATION_TYPES.TownVillage, 11, 21)] } };
  const maps = { regionCount: 62, getRegion: (r) => regions[r] ?? null, baseLocationCount: (r) => regions[r]?.mapTable.length ?? 0 };
  const picker = Uint8Array.from([128 + 5]);
  const near = MINUTES_PER_DAY - 10;   // ten classic minutes (50 s) before the turn
  const at = { now: AT(near) };
  let art = null;   // the picker's art not read yet
  setRaidingPartiesHost({ now: () => at.now, maps: () => maps, picker: () => art });
  restoreRaidSaveData({ lastSelectedDay: DAY, raids: [raidRec()] });
  const relayOf = (m) => OPEN + (m - at.now) * 5000;
  assert.equal(raidTimerList(relayOf, () => '', EVENT_SOON_MS).length, 1, 'the regions not read yet: the day\'s alone');
  art = picker;
  const ahead = raidTimerList(relayOf, () => '', EVENT_SOON_MS);
  assert.ok(ahead.length > 1, 'the next day\'s roll listed beside the day\'s');
  assert.ok(ahead.slice(1).every((r) => r.key.endsWith(`:${DAY + 1}`)), 'the next day\'s raids, keyed by their own day');
  assert.equal(raidTimerList(relayOf, () => '', 0).length, 1, 'no ahead asked: the day\'s alone');
  at.now = AT(MINUTES_PER_DAY - 200);   // 1000 s before the turn - past a quarter hour
  assert.equal(raidTimerList(relayOf, () => '', EVENT_SOON_MS).length, 1, 'further out: the day\'s alone');
  at.now = AT(MINUTES_PER_DAY + 5);   // past the turn, the day not yet rolled
  assert.equal(raidTimerList(relayOf, () => '', EVENT_SOON_MS).length, 1, 'a list not rolled for today looks ahead of nothing');
  _resetRaidingParties();
});

test('EVENTS1 THE BOARD\'S CUT: at most `max` rows, `more` the rest, `all` every row uncut (mutants: the cut, the count)', () => {
  const stars = [1, 2, 3, 4].map((k) => ({ id: `star:${N}.${k}`, kind: 'star', title: 'Fallen Star', where: 'Near X', detail: null, live: true, at: OPEN + k * 60_000, until: OPEN + k * 60_000, px: 190, py: 210 }));
  const m = eventBoardModel({ now: OPEN, pixel: HERE, stars, gate: { place: 'Copperham', site: { px: 207, py: 191 } } });
  assert.equal(m.rows.length, 3);
  assert.equal(m.more, m.all.length - 3);
  assert.ok(m.all.length >= 5);
  assert.equal(eventBoardModel({ now: OPEN, stars }, { max: 4 }).more, eventBoardModel({ now: OPEN, stars }).all.length - 4);
  assert.deepEqual(eventBoardModel(null), { rows: [], more: 0, all: [], every: [], now: NaN });
});

test('EVENTS1 THE ANNOUNCEMENTS: nothing before the board first reads the world; then a row first seen is news only if its event came on no earlier than EVENT_SEED_GRACE_MS before that read (AUDIT EVENTS1 A5 - a source that fills in late announces nothing that stood), a row of no known `since` never at first sight; a row that turns live is `begun`, each once; a quiet row never; a row gone is let go (mutants: the since test, the grace, the turn, the once, the announce flag)', () => {
  const W = 1_000_000;
  const r = (id, live, since, announce = true) => ({ id, kind: 'raid', live, since, announce });
  const seen = new Map();
  assert.deepEqual(eventAnnouncements([r('x', true, W + 10)], seen, null), [], 'before the first read: nothing is news');
  seen.clear();
  const out = eventAnnouncements([
    r('old', true, W - 60_000), r('late', true, W - EVENT_SEED_GRACE_MS), r('later', true, W - EVENT_SEED_GRACE_MS - 1),
    r('soon', false, W + 1000), r('nan', true, NaN), r('quiet', false, W + 1000, false),
  ], seen, W);
  assert.deepEqual(out, [{ id: 'late', kind: 'raid', phase: 'begun' }, { id: 'soon', kind: 'raid', phase: 'soon' }], 'within the grace: news; before it, and of no known since: none');
  assert.deepEqual(eventAnnouncements([r('old', true, W - 60_000), r('soon', true, W + 1000), r('nan', true, NaN), r('quiet', true, W + 1000, false)], seen, W),
    [{ id: 'soon', kind: 'raid', phase: 'begun' }], 'turned live: begun; a quiet row never');
  assert.deepEqual(eventAnnouncements([r('soon', true, W + 1000)], seen, W), [], 'once');
  assert.equal(seen.has('old'), false, 'gone, let go');
  // the producers' own late fill: the stars' scan done after the first read, a star fallen before it - no news; one that
  // falls after it - news
  const t = ST[0].fallAt + 60_000, mem = new Map();
  eventAnnouncements(eventBoardModel({ now: t, pixel: HERE, stars: [] }).all, mem, t);
  assert.deepEqual(eventAnnouncements(eventBoardModel({ now: t + 3000, pixel: HERE, stars: starTimerRows(SITES, t + 3000) }).all, mem, t).filter((a) => a.id === `star:${N}.0`), [], 'a star that fell before the board read the world: no news');
  const fallsAfter = ST[1].fallAt;
  const later = eventAnnouncements(eventBoardModel({ now: fallsAfter + 500, pixel: HERE, stars: starTimerRows(SITES, fallsAfter + 500) }).all, mem, t);
  assert.deepEqual(later.filter((a) => a.id === `star:${N}.1`), [{ id: `star:${N}.1`, kind: 'star', phase: 'begun' }]);
});

test('EVENTS1 THE NEWS: one at a time, EVENT_TOAST_MS of shown time; a card is ONE event\'s (AUDIT EVENTS1 A1/A7) - a line joins its event\'s card by its id, a single kind\'s by its kind, and never another star\'s or raid\'s; an announcement takes a waiting card of its single kind\'s lines, never a star\'s or a raid\'s line; a line joining a shown card has EVENT_NOTE_MIN_MS of its own; the same line within a minute is one; past the kept, a bare announcement goes first (mutants: the id join, the single kinds, the late line\'s time, the drop\'s order, the sameness, the clock)', () => {
  const q = createEventToasts({ kept: 3 });
  q.note('gate', 'The omen burns.', 0);
  q.announce({ id: 'gate:1', kind: 'gate', phase: 'soon' });
  assert.deepEqual(q.cards().map((c) => [c.kind, c.id, c.phase, c.notes]), [['gate', 'gate:1', 'soon', ['The omen burns.']]], 'a single kind: the announcement took its line\'s card');
  q.note('gate', 'The faithful work their rite.', 10);
  q.note('gate', 'The omen burns.', 20);
  assert.deepEqual(q.cards()[0].notes, ['The omen burns.', 'The faithful work their rite.'], 'joined by its kind; the same line dropped');
  // a star's lines: each its own star's
  q.note('star', 'The star near Gothway Garden is held by Ann.', 30, 'star:1.0');
  q.announce({ id: 'star:1.1', kind: 'star', phase: 'soon' });
  q.note('star', 'A star has fallen near Copperham.', 40, 'star:1.1');
  q.step(EVENT_TOAST_MS);
  assert.deepEqual(q.cards().map((c) => [c.id, c.notes]), [['star:1.0', ['The star near Gothway Garden is held by Ann.']]], 'star A\'s line alone - never under B\'s news');
  q.step(EVENT_TOAST_MS);
  assert.deepEqual(q.cards().map((c) => [c.id, c.phase, c.notes]), [['star:1.1', 'soon', ['A star has fallen near Copperham.']]], 'B\'s line on B\'s card');
  // a line that joins a card near its end is given its own time
  q.step(EVENT_TOAST_MS - 100);
  q.note('star', 'It is going dark!', 50, 'star:1.1');
  q.step(EVENT_NOTE_MIN_MS - 1);
  assert.equal(q.cards()[0]?.id, 'star:1.1', 'still standing for its new line');
  q.step(1);
  assert.equal(q.cards().length, 0);
  // an id-less line of a kind with several events makes its own card
  q.note('raid', 'A raid line with no id.', 60);
  q.announce({ id: 'raid:1', kind: 'raid', phase: 'soon' });
  assert.deepEqual(q.cards().map((c) => [c.id, c.notes.length]), [[null, 1]], 'never taken by a raid\'s announcement');
  q.clear();
  // past the kept, a bare announcement goes before a card with a line
  const k = createEventToasts({ kept: 3 });
  k.announce({ id: 'raid:a', kind: 'raid', phase: 'soon' });
  k.note('raid', 'Line b.', 0, 'raid:b');
  k.announce({ id: 'raid:c', kind: 'raid', phase: 'soon' });
  k.note('raid', 'Line d.', 0, 'raid:d');
  k.step(EVENT_TOAST_MS);
  const left = [];
  while (k.cards().length) { left.push(k.cards()[0].id); k.step(EVENT_TOAST_MS); }
  assert.deepEqual(left, ['raid:b', 'raid:d'], 'the bare announcement c went; b\'s and d\'s lines kept');
  const s = createEventToasts({ shown: 2 });
  s.note('gate', 'x', 0);
  assert.equal(s.note('gate', 'x', EVENT_NOTE_SAME_MS - 1), null);
  s.step(EVENT_TOAST_MS);
  assert.ok(s.note('gate', 'x', EVENT_NOTE_SAME_MS), 'a minute on, said again');
  const t = createEventToasts();
  t.note('gate', 'one', 0); t.take(t.cards()[0].key);
  assert.equal(t.cards().length, 0, 'taken whole');
  assert.ok(Object.keys(EVENT_KIND_TEXT).every((kind) => typeof EVENT_KIND_TEXT[kind]() === 'string'));
});

test('EVENTS1 THE DOOR: a line waits with its kind and its event\'s id until the board takes it, EVENT_NOTICES_KEPT at most, and is filed in the log the host seated (a function, or townTalk\'s hudMessageSink, filled after the seat - AUDIT EVENTS1 C4/C5); the board off - the switch, or its piece put away in the editor under Enhanced Plus (B8) - a line goes where it went before: a raid\'s to the HUD\'s line (C8), every other to the chat the host seated; the seat answers the source as handed, a throwing source reads as none (mutants: the id, the log, the editor\'s X, the raid\'s own, the kept, the seat)', () => {
  _resetEventNotices(); resetPrefs(); _resetNotifyForTests();
  const hud = [];
  registerPresenter({ hudText: (t) => { hud.push(t); return true; } });
  try {
    assert.equal(eventBoardOn(), true, 'on by default');
    const chat = [], logged = [];
    const town = { hudMessageSink: null };
    const f = () => ({ now: 1 });
    assert.equal(seatEventBoard(f, (t) => chat.push(t), town), f, 'the source as handed');
    town.hudMessageSink = (t) => logged.push(t);   // the host fills the journal's door after the seat
    assert.equal(eventNotice('star', '  A star has fallen.  ', 'star:1.0'), true);
    assert.equal(eventNotice('nope', 'x'), true);
    assert.equal(eventNotice('gate', '   '), false);
    assert.deepEqual(takeEventNotices().map((l) => [l.kind, l.text, l.id]), [['star', 'A star has fallen.', 'star:1.0'], ['gate', 'x', null]]);
    assert.deepEqual(logged, ['A star has fallen.', 'x'], 'every line filed in the journal');
    assert.deepEqual(takeEventNotices(), [], 'taken');
    seatEventBoard(f, null, (t) => logged.push(`fn:${t}`));
    eventNotice('super', 'Found.');
    assert.equal(logged.at(-1), 'fn:Found.', 'a function log too');
    takeEventNotices();
    for (let i = 0; i < EVENT_NOTICES_KEPT + 5; i++) eventNotice('raid', `line ${i}`);
    const kept = takeEventNotices();
    assert.equal(kept.length, EVENT_NOTICES_KEPT);
    assert.equal(kept[0].text, 'line 5', 'the newest kept');
    seatEventBoard(f, (t) => chat.push(t), town);
    setPref(EVENT_BOARD_PREF, false);
    logged.length = 0;
    eventNotice('gate', 'The omen burns.');
    eventNotice('raid', 'Ilessan Hills in Daggerfall is under attack by orcs!');
    assert.deepEqual([chat, hud, takeEventNotices(), logged], [['The omen burns.'], ['Ilessan Hills in Daggerfall is under attack by orcs!'], [], []], 'off: the gate\'s to the chat, the raid\'s to the HUD\'s line (which files itself)');
    eventNoticeElsewhere('star', 'A star.');
    assert.equal(chat.at(-1), 'A star.');
    setPref(EVENT_BOARD_PREF, true);
    setPref('hudLayout', { events: { off: true } });
    assert.equal(eventBoardOn(), false, 'the editor\'s X puts the board away');
    setPref('skin', 'classic');
    assert.equal(eventBoardOn(), true, 'a layout the classic skin does not wear');
    seatEventBoard(() => { throw new Error('x'); });
    assert.equal(eventBoardSource(), null);
    seatEventBoard(null);
    eventNotice('gate', 'No chat seated.');
    setPref('skin', 'enhanced');
    eventNotice('gate', 'With the board off and no chat: the HUD\'s line.');
    assert.equal(hud.at(-1), 'With the board off and no chat: the HUD\'s line.');
    const row = FEATURES.find((r) => r.id === 'event-board');
    assert.deepEqual([row.control.store, row.control.key, row.control.initial], ['prefs', EVENT_BOARD_PREF, true], 'the switch is the feature row\'s');
  } finally { _resetEventNotices(); resetPrefs(); _resetNotifyForTests(); }
});

test('EVENTS1 THE JOURNAL HOLDS A LINE ONCE: a line the door filed, said again on the HUD\'s line (the board with no room for its news, or switched off with it in hand), is not filed again - DFU\'s AddHUDText files every line it says, so the journal\'s door is held aside for that one call and given back (mutants: filed twice, the journal lost)', () => {
  _resetEventNotices(); resetPrefs(); _resetNotifyForTests();
  const town = { hudMessageSink: null }, filed = [], hud = [];
  // the HUD's line as the world host has it: townTalk.say - PopupText - files each line through the same holder
  registerPresenter({ hudText: (t) => { hud.push(t); town.hudMessageSink?.(t); return true; } });
  try {
    seatEventBoard(() => null, (t) => t, town);
    const sink = (t) => filed.push(t);
    town.hudMessageSink = sink;
    eventNotice('star', 'The star near Copperham is held by Ann.', 'star:9.1');
    eventHudLine('The star near Copperham is held by Ann.');
    assert.deepEqual([filed, hud], [['The star near Copperham is held by Ann.'], ['The star near Copperham is held by Ann.']], 'filed once, said once');
    assert.equal(town.hudMessageSink, sink, 'the journal\'s door given back');
    eventNoticeElsewhere('raid', 'Ilessan Hills in Daggerfall has been cleansed of the orc attack!', true);
    assert.deepEqual(filed, ['The star near Copperham is held by Ann.'], 'a filed raid line, switched off with it in hand: not again');
    eventNoticeElsewhere('raid', 'Anticlere in Daggerfall is under attack by orcs!');
    assert.deepEqual(filed.length, 2, 'a raid line the board never took: the HUD\'s line files it, as the mod\'s AddHUDText did');
  } finally { _resetEventNotices(); _resetNotifyForTests(); }
});

// EVENTS2 (2026-10-24, the players on Discord: "Allow us to filter which events we want to show up in the event tracker",
// "I don't want all this crap cluttering up my interface"; the owner: "No band aids"): EACH KIND THE PLAYER'S OWN.
// bible/10-UI/Event-Board.md section 8.

/** A `shown` that answers for these kinds alone. */
const only = (...kinds) => (k) => kinds.includes(k);
/** A star night's moment with three raids of the region under way, the stars and the raids as their producers mint them
 *  (starTimerRows, raidTimerList over a restored day on a relay clock that reads `t` at the day's minute 610). */
function starsAndRaids(t) {
  setRaidingPartiesHost({ now: () => AT(610), regionIndex: () => 17 });
  restoreRaidSaveData({ lastSelectedDay: DAY, raids: [raidRec({ locationName: 'A', locationIndex: 1 }), raidRec({ locationName: 'B', locationIndex: 2, px: 202 }), raidRec({ locationName: 'C', locationIndex: 3, px: 203 })] });
  const raids = raidTimerList((m) => t + (m - AT(610)) * 5000, (r) => REGIONS[r]);
  return (now) => ({ now, pixel: HERE, region: 'Daggerfall', stars: starTimerRows(SITES, now), raids });
}

test('EVENTS2 ONE HOME FOR THE KINDS: features.js EVENT_KINDS, in the board\'s order - the board\'s rows, the door\'s kinds, the single kinds and the headings all derived from it; each kind a part of the Event board row, its pref `eventBoard-<kind>` on by default and the player\'s own online, its chip the heading\'s own words (mutants: the key, a kind without its chip, a kind undeclared, off by default, forced online, the chip unnamed, the festival a row, a star single, the heading not the home, the door\'s kinds, the board\'s kinds)', () => {
  const KINDS = ['gate', 'serpent', 'super', 'star', 'raid', 'festival'];
  const NAMES = ['Dagon\'s Breach', 'Sea Serpent', 'Abyss Dungeon', 'Starfall', 'Town Raid', 'Witches\' Festival'];
  assert.deepEqual([...EVENT_KIND_ORDER], KINDS);
  assert.deepEqual([...EVENT_NOTICE_KINDS], KINDS, 'the door\'s');
  assert.deepEqual(Object.keys(EVENT_KIND_TEXT), KINDS, 'the headings\'');
  assert.deepEqual(KINDS.map((k) => EVENT_KIND_TEXT[k]()), NAMES);
  assert.deepEqual(KINDS.map((k) => EVENT_KINDS[k].label), NAMES);
  assert.deepEqual([...EVENT_BOARD_KINDS], ['gate', 'serpent', 'super', 'star', 'raid'], 'the festival is news alone');
  assert.deepEqual([...EVENT_SINGLE_KINDS], ['gate', 'serpent', 'super', 'festival']);
  const PREFS = ['eventBoard-gate', 'eventBoard-serpent', 'eventBoard-super', 'eventBoard-star', 'eventBoard-raid', 'eventBoard-festival'];
  assert.deepEqual(KINDS.map(eventKindPref), PREFS);
  const c = FEATURES.find((r) => r.id === 'event-board').control;
  assert.deepEqual(c.also.map((a) => [a.store, a.key, a.initial, a.online]), PREFS.map((k) => ['prefs', k, true, 'player']), 'each kind declared on the row that covers it');
  assert.deepEqual(c.parts.map((p) => [p.key, p.label, p.tiers]), PREFS.map((k, i) => [k, NAMES[i], undefined]), 'each a chip, in its kind\'s own words');
  assert.deepEqual(PREFS.map((k) => [FEATURE_PREF_DEFAULTS[k], FEATURE_PREF_ONLINE[k]]), PREFS.map(() => [true, 'player']), 'on by default; the player\'s own online');
});

test('EVENTS2 A KIND TURNED OFF LEAVES THE BOARD BEFORE THE CUT: its rows free their places (the next star takes a raid\'s), "more" never counts it, `all` is the kinds shown and `every` every kind, uncut (mutants: the filter after the cut, the rows unfiltered, more counts the hidden, every is the shown)', () => {
  _resetRaidingParties();
  const t = ST[0].fallAt + 60_000;
  const src = starsAndRaids(t)(t);
  const rid = (k) => `raid:${raidKey(raidRec({ locationName: 'ABC'[k], locationIndex: k + 1 }))}`;
  const [A, B, C] = [0, 1, 2].map(rid), S0 = `star:${N}.0`, S1 = `star:${N}.1`;
  const at = (shown) => { const m = eventBoardModel(src, { max: 3, shown }); return [m.rows.map((r) => r.id), m.more, m.all.map((r) => r.id).sort(), m.every.map((r) => r.id).sort()]; };
  const EVERY = [A, B, C, S0, S1].sort();
  assert.deepEqual(at(only('star', 'raid')), [[A, B, S0], 2, EVERY, EVERY], 'both: the nearest two raids and the live star; the third raid and the coming star counted');
  assert.deepEqual(at(undefined), at(only('star', 'raid')), 'none handed: every kind shown');
  assert.deepEqual(at(only('star')), [[S0, S1], 0, [S0, S1], EVERY], 'the raids off: the coming star takes their place, and nothing is counted');
  assert.deepEqual(at(only('raid')), [[A, B], 1, [A, B, C], EVERY], 'the stars off: the third raid alone counted, never a star');
  _resetRaidingParties();
});

test('EVENTS2 TURNED BACK ON, WHAT STOOD IS NO NEWS: the announcements\' memory reads every kind (the model\'s `every`), and a kind turned off is announced never - a star that fell while the stars were off, and one warned then, are no news when they come back; what comes after is (mutants: the hidden announced, the memory of the shown, every is the shown)', () => {
  _resetRaidingParties();
  const t = ST[0].fallAt + 60_000;
  const read = starsAndRaids(t);
  const mem = new Map();
  const ask = (now, shown) => eventAnnouncements(eventBoardModel(read(now), { shown }).every, mem, t, shown).map((a) => [a.id, a.phase]);
  assert.deepEqual(ask(t, only('star', 'raid')), [], 'the first read: what stands is no news');
  assert.deepEqual(ask(ST[1].fallAt + 500, only('raid')), [], 'the stars off: the second fallen, the third warned - neither announced');
  assert.deepEqual(ask(ST[1].fallAt + 2000, only('star', 'raid')), [], 'back on: both stood while the stars were off - no news');
  assert.deepEqual(ask(ST[2].fallAt + 500, only('star', 'raid')), [[`star:${N}.2`, 'begun']], 'the third falls while they show: news');
  _resetRaidingParties();
});

test('EVENTS2 AT THE DOOR: a kind turned off (eventKindShown, its chip) is filed in the journal and said nowhere else - never queued for the news, never sent back to the chat; a line of no known kind is the gate\'s; the board\'s switch is read first, so with the board off every kind goes where it went before; a card of a kind turned off is let go, shown or waiting (mutants: the door open, the door unfiled, the hidden to the chat, the kind before the board, the switch inverted, the drop undone)', () => {
  _resetEventNotices(); resetPrefs(); _resetNotifyForTests();
  const hud = [];
  registerPresenter({ hudText: (t) => { hud.push(t); return true; } });
  try {
    const chat = [], logged = [];
    seatEventBoard(() => ({ now: 1 }), (t) => chat.push(t), (t) => logged.push(t));
    assert.deepEqual(EVENT_KIND_ORDER.map(eventKindShown), EVENT_KIND_ORDER.map(() => true), 'every kind shown by default');
    setPref(eventKindPref('star'), false);
    assert.deepEqual(EVENT_KIND_ORDER.map(eventKindShown), [true, true, true, false, true, true]);
    assert.equal(eventNotice('star', 'The star near Copperham is held by Ann.', 'star:9.1'), true);
    eventNotice('raid', 'Ilessan Hills in Daggerfall is under attack by orcs!', 'raid:17:7:400');
    assert.deepEqual([takeEventNotices().map((l) => l.text), logged, chat, hud],
      [['Ilessan Hills in Daggerfall is under attack by orcs!'], ['The star near Copperham is held by Ann.', 'Ilessan Hills in Daggerfall is under attack by orcs!'], [], []],
      'the star\'s line filed, never queued, never to the chat or the HUD\'s line');
    setPref(eventKindPref('gate'), false);
    eventNotice('nope', 'A line of no known kind.');
    assert.deepEqual([takeEventNotices(), logged.at(-1)], [[], 'A line of no known kind.'], 'the gate\'s, and the gate is off');
    setPref(EVENT_BOARD_PREF, false);
    eventNotice('star', 'A star has fallen near Copperham.', 'star:9.1');
    assert.deepEqual(chat, ['A star has fallen near Copperham.'], 'the board off: the line where it went before, whatever its kind');
  } finally { _resetEventNotices(); resetPrefs(); _resetNotifyForTests(); }
  const q = createEventToasts();
  q.announce({ id: 'star:1.0', kind: 'star', phase: 'soon' });
  q.note('raid', 'A raid\'s line.', 0, 'raid:a');
  q.note('star', 'Another star\'s line.', 0, 'star:1.1');
  q.drop('star');
  assert.deepEqual([q.cards().map((c) => c.id), q.waiting()], [['raid:a'], 0], 'the shown star\'s card and the waiting one let go; the raid\'s kept');
});
