// STANDING-TREND and FESTIVAL-STAGE (2026-10-02, Mac: "lets finish the build work"): two of the Seats arc's NOT YETs
// (bible/11-Multiplayer/Seats-Arc.md 7.9, 7.6).
//
// STANDING-TREND: the Seat tab's holder line says which way its Standing moved - "Standing 55, up 7 since the last
// Turning." (net/townSeatLaw.js seatHolderLine). Each Turning writes every held seat's Standing as it found it and as it
// leaves it, a `town_seat_history` row of kind 'standing' the Chronicle never shows (server-account seatTurning.js
// settleWeek; seatInfluence.js chronicleOf), and the standings read names the holder's `was` off the last Turning's row
// (seatInfluence.js standingWas) - no migration.
//
// FESTIVAL-STAGE: while a Festival rules at a town, its streets hear the tavern's music (scenes/shared.js
// createMusicDirector, scenes/seatFestival.js festivalEnvironment), its holder's banners hang at its taverns' doors and
// over its bounty boards too (festivalBannerAnchors, seatBanners.js createSeatBanners), and a lantern burns before every
// banner it flies (festivalLanternsOf, world/city/cityLights.js fillLanternPool) - off the seats' list alone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { standService, T0 } from '../accountDb.mjs';
import {
  seatReportText, seatWeekOf, seatWeekStartMs, SEAT_MEMBER_WAIT_S, seatHolderLine, standingTrend, standingTrendWords, festivalRules,
} from '../../src/net/townSeatLaw.js';
import {
  festivalBannerAnchors, festivalLanternsOf, festivalEnvironment, createFestivalStage, FESTIVAL_BANNERS_MAX, FESTIVAL_LANTERN_DROP_M, FESTIVAL_LANTERN_OUT_M,
} from '../../src/scenes/seatFestival.js';
import { createSeatBanners } from '../../src/scenes/seatBanners.js';
import { hallBannerAnchors, BANNER_REFRESH_MS } from '../../src/scenes/hallBanners.js';
import { fillLanternPool } from '../../src/world/city/cityLights.js';
import { createMusicDirector } from '../../src/scenes/shared.js';
import { LOCATION_TYPES, TAVERN_SONGS, MUSIC_ENV } from '../../src/systems/song/songManager.js';
import { BUILDING_TYPES } from '../../src/world/buildingNames.js';
import { createTownSeatBook, SEAT_LIST_CACHE_MS, SEAT_RED_READ_MS, SEAT_TURN_READ_SPREAD_MS } from '../../src/net/townSeatBook.js';   // AUDIT FESTIVAL S1   // D1-LOAD: the Turning's read spread
import { hostText } from '../hostText.mjs';   // HOST-SPLIT 2: the world host whole

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const tick = (n = 4) => new Promise((r) => { let i = 0; const go = () => (++i >= n ? r() : setTimeout(go, 0)); setTimeout(go, 0); });
const SH = { id: 'g1', name: 'The Silver Hand', tag: 'SH', heraldry: { field: 'azure', border: 'gold', device: 'tower' } };

// ─── STANDING-TREND ──────────────────────────────────────────────────

test('STANDING-TREND the holder\'s line says which way its Standing moved since the last Turning - up, down or steady - and the number alone where the read names no `was` (mutants: the sign; steady said as up; the line without its trend)', () => {
  const bare = seatHolderLine({ guild: SH, since: 3, standing: 55 });
  assert.equal(bare, 'Held by the Silver Hand <SH> since week 3. Standing 55.');
  assert.equal(seatHolderLine({ guild: SH, since: 3, standing: 55, was: 48 }), 'Held by the Silver Hand <SH> since week 3. Standing 55, up 7 since the last Turning.');
  assert.equal(seatHolderLine({ guild: SH, since: 3, standing: 45, was: 50 }), 'Held by the Silver Hand <SH> since week 3. Standing 45, down 5 since the last Turning.');
  assert.equal(seatHolderLine({ guild: SH, since: 3, standing: 55, was: 55 }), 'Held by the Silver Hand <SH> since week 3. Standing 55, steady since the last Turning.');
  assert.equal(seatHolderLine({ guild: SH, since: 3, standing: 55, was: null }), bare);
  assert.equal(seatHolderLine({ guild: SH, since: 3, standing: 55, was: '50' }), bare, 'a `was` that is no number names no trend');
  assert.deepEqual([standingTrend({ standing: 20, was: 0 }), standingTrend({ standing: 0, was: 20 }), standingTrend({ standing: 7 }), standingTrend(null)], [20, -20, null, null]);
  assert.deepEqual([standingTrendWords(3), standingTrendWords(-3), standingTrendWords(0), standingTrendWords(null)],
    [', up 3 since the last Turning', ', down 3 since the last Turning', ', steady since the last Turning', '']);
  assert.equal(seatHolderLine(null), 'No guild holds this Charter.');
});

const ANTICLERE = { key: 3021, name: 'Anticlere', region: 21, tier: 'palace', pixel: [402, 151] };
const DAY = 86400;
const W = seatWeekOf(T0 * 1000);
const AFTER = (w) => Math.floor(seatWeekStartMs(w + 1) / 1000) + 3 * 3600;   // three hours past week w's Turning

async function stood() {
  const svc = await standService({ SEATS_OPEN: 'on', MARKS_OPEN: 'on', PROFESSIONS_OPEN: 'on', BOARD_OPEN: 'on' });
  const raw = svc.env.DB._raw;
  for (const w of [await svc.guest(), await svc.guest(), await svc.guest()]) {
    raw.prepare("INSERT INTO world_witness (kind, key, account, report, region, at) VALUES ('seat', ?, ?, ?, ?, ?)").run(String(ANTICLERE.key), w.id, seatReportText(ANTICLERE), ANTICLERE.region, T0 - DAY);
  }
  raw.prepare('INSERT INTO town_seat_weeks (week, settled_at) VALUES (?, ?)').run(W - 1, T0);
  const gm = await svc.registered('Gamal', { renown: 12 });
  assert.equal((await svc.found(gm, { name: 'The Silver Hand', tag: 'SH' })).status, 200);
  const gid = raw.prepare('SELECT guild_id FROM guild_members WHERE player = ? AND char_id = ?').get(gm.id, gm.character).guild_id;
  raw.prepare('UPDATE guild_members SET joined_at = ? WHERE guild_id = ?').run(T0 - SEAT_MEMBER_WAIT_S - DAY, gid);
  raw.prepare(`INSERT INTO town_seat_holds (key, guild_id, region, tier, since_week, standing, truce_week, at, tithe, owed)
    VALUES (?, ?, ?, ?, ?, 50, NULL, ?, 6, 0)`).run(ANTICLERE.key, gid, ANTICLERE.region, ANTICLERE.tier, W - 1, T0 - 7 * DAY);
  const treasury = (n) => raw.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
    VALUES ('mint', NULL, 'guild', ?, 'test', ?, 1, 1, 'seed', NULL, ?)`).run(gid, n, `seed-${n}-${Math.random().toString(36).slice(2, 10)}`);
  const watch = async (week) => {
    const a = await svc.guest();
    raw.prepare('INSERT INTO town_seat_binds (week, account, guild_id, char_id, at) VALUES (?, ?, ?, ?, ?)').run(week, a.id, gid, 'c', T0);
    raw.prepare(`INSERT INTO town_seat_influence (week, key, guild_id, account, char_id, source, amount, region, day, ref, at)
      VALUES (?, ?, ?, ?, 'c', 'watch', 100, ?, 1, ?, ?)`).run(week, ANTICLERE.key, gid, a.id, ANTICLERE.region, `t:${a.id}:${week}`, T0);
  };
  const rows = () => raw.prepare("SELECT week, data FROM town_seat_history WHERE key = ? AND kind = 'standing' ORDER BY seq").all(ANTICLERE.key).map((r) => ({ week: r.week, ...JSON.parse(r.data) }));
  const standings = async () => (await svc.call('/v1/seats/standings', { key: ANTICLERE.key, character: gm.character }, gm.secret)).body;
  return { svc, raw, gm, gid, treasury, watch, rows, standings };
}

test('STANDING-TREND the Turning writes each held seat\'s Standing as it found it and as it left it; the next week\'s standings name the holder\'s `was`, and the line its trend; the Chronicle and the Hall of Records never show the row; a row naming another guild, or none from the last Turning, names no `was` (mutants: the row unwritten; `was` the Standing after; the Chronicle unfiltered; the guild unchecked; this week\'s row read)', async (t) => {
  let now = T0;
  t.mock.method(Date, 'now', () => now * 1000);
  const s = await stood();
  s.treasury(2600);
  for (let w = W; w <= W + 1; w++) await s.watch(w);
  assert.equal((await s.standings()).holder.was, undefined, 'no Turning reckoned it yet');
  now = AFTER(W);
  let r = await s.standings();
  assert.deepEqual(s.rows(), [{ week: W, guild: s.gid, was: 50, standing: 55 }], 'held unchallenged +5: as found, as left');
  assert.deepEqual([r.holder.standing, r.holder.was], [55, 50]);
  assert.equal(seatHolderLine(r.holder), `Held by the Silver Hand <SH> since week ${W - 1}. Standing 55, up 5 since the last Turning.`);
  assert.ok(r.chronicle.length > 0 && r.chronicle.every((c) => c.kind !== 'standing'), `the Chronicle never shows it: ${r.chronicle.map((c) => c.kind)}`);
  const book = (await s.svc.call('/v1/seats/records', { key: ANTICLERE.key }, s.gm.secret)).body;
  assert.ok(book.rows.length > 0 && book.rows.every((c) => c.kind !== 'standing'), 'nor the Hall of Records');
  // a short treasury: Neglect -10, held +5 - the line falls
  now = AFTER(W + 1);
  r = await s.standings();
  assert.deepEqual([r.holder.standing, r.holder.was], [50, 55]);
  assert.match(seatHolderLine(r.holder), /Standing 50, down 5 since the last Turning\.$/);
  // the last Turning's row naming another holder (a seat taken since): no trend
  s.raw.prepare("UPDATE town_seat_history SET data = json_set(data, '$.guild', 'g-other') WHERE key = ? AND kind = 'standing' AND week = ?").run(ANTICLERE.key, W + 1);
  assert.equal((await s.standings()).holder.was, undefined);
});

// ─── FESTIVAL-STAGE: THE BANNERS AND THE LANTERNS ───────────────────

const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const tavern = (x) => ({ box: [x - 5, 0, -5, x + 5, 8, 5], door: { a: [x - 1, 0, 5], b: [x + 1, 0, 5] } });
const board = (x) => ({ local: [...I.slice(0, 12), x, 0, 30, 1], box: [x - 1, 0, 29.5, x + 1, 2, 30.5] });

test('FESTIVAL-STAGE the Festival\'s anchors: two beside each tavern\'s door, then a pennant over each board BOUNTY1 took - never a rumour board, which flies the seat\'s already - at most FESTIVAL_BANNERS_MAX; a lantern before each banner, below its top and out before its cloth; a Festival rules where the holder\'s Edict is one (mutants: the rumour boards for the bounty boards; the cap; the lantern raised; any Edict a Festival)', () => {
  const frames = new Map([['t1', tavern(0)], ['t2', tavern(40)]]);
  const boards = [board(100), board(120), board(140)];
  const got = festivalBannerAnchors({ frames, tavernKeys: ['t1', 't2', 'none'], boards, bounty: new Set([1]) });
  assert.equal(got.length, 5, 'the two taverns\' four, the one bounty board\'s pennant');
  assert.deepEqual(got.slice(0, 2), hallBannerAnchors(frames.get('t1')));
  assert.deepEqual(got.slice(2, 4), hallBannerAnchors(frames.get('t2')));
  assert.ok(Math.abs(got[4].top[0] - 120) < 1e-9, `the bounty board's, not a rumour board's: ${got[4].top}`);
  const many = festivalBannerAnchors({ frames, tavernKeys: ['t1', 't2', 't1', 't2'], boards, bounty: new Set([0, 1, 2]) });
  assert.equal(many.length, FESTIVAL_BANNERS_MAX, 'four taverns: three\'s six - no room for the fourth\'s, nor a pennant');
  assert.equal(festivalBannerAnchors({ boards, bounty: new Set([0, 1, 2]) }).length, 3);
  assert.equal(festivalBannerAnchors({ boards: Array(9).fill(board(0)), bounty: new Set([0, 1, 2, 3, 4, 5, 6, 7, 8]) }).length, FESTIVAL_BANNERS_MAX);
  assert.deepEqual(festivalBannerAnchors(), []);
  const a = { top: [1, 5, 2], out: [0, 0, 1], right: [1, 0, 0] };
  assert.deepEqual(festivalLanternsOf([a]), [[1, 5 - FESTIVAL_LANTERN_DROP_M, 2 + FESTIVAL_LANTERN_OUT_M]]);
  assert.deepEqual(festivalLanternsOf(null), []);
  assert.equal(festivalRules({ holder: { edict: 'festival' } }), true);
  assert.equal(festivalRules({ holder: { edict: 'market-day' } }), false);
  assert.equal(festivalRules({ holder: null }), false);
});

test('FESTIVAL-STAGE the town dressed while a Festival rules: the holder\'s banners at the Festival\'s anchors after the seat\'s own; its lanterns lit in the street\'s pool after the pixel\'s own lamps, on the slots that follow; another Edict, or none, hangs and lights nothing more; the stage reads a town again when the seats\' answer moves (mutants: the Festival\'s banners unhung; its lanterns lit any week; the fill without them; the version unread)', () => {
  const g = { top: [1, 2, 3], right: [1, 0, 0], out: [0, 0, 1] };
  const f = { top: [7, 8, 9], right: [1, 0, 0], out: [0, 0, 1] };
  const p = { px: 5, py: 6, homeTown: 3021, seatAnchors: [g], festivalAnchors: [f, f], festivalLanterns: festivalLanternsOf([g, f, f]), lights: [[0, 3, 0]] };
  let edict = 'festival', v = 1, reads = 0;
  const seatAt = (k) => { reads++; return k === 3021 ? { region: 21, holder: { guild: SH, edict } } : null; };
  const sb = createSeatBanners({ built: () => new Map([['a', p]]), seatAt, translation: () => [100, 0, 200], now: () => 0, version: () => v });
  const hung = sb.list();
  assert.equal(hung.length, 3, 'the seat\'s one, the Festival\'s two');
  assert.deepEqual(hung.map((b) => b.top), [[101, 2, 203], [107, 8, 209], [107, 8, 209]]);
  assert.ok(hung.every((b) => b.heraldry === SH.heraldry), 'all in the holder\'s colours');
  const stage = createFestivalStage({ seatAt, now: () => 0, version: () => v });
  assert.equal(stage.festive(3021), true);
  assert.equal(stage.festive(9999), false);
  assert.equal(stage.lanterns(p), p.festivalLanterns);
  const anim = new Float32Array(64).map((_, i) => i + 1);
  const pool = [];
  let filled = fillLanternPool([p], () => [100, 0, 200], pool, new Float32Array(1), anim, stage.lanterns);
  assert.equal(filled.n, 4, 'the lamp, and a lantern before each of the three banners');
  assert.deepEqual(pool.slice(0, 4).map((e) => [e.x, e.y, e.z]), [[100, 3, 200], ...p.festivalLanterns.map((l) => [l[0] + 100, l[1], l[2] + 200])]);
  const slot = filled.ranges[0];
  assert.deepEqual([...filled.ranges.subarray(0, 4)].map((r) => anim.indexOf(r) - anim.indexOf(slot)), [0, 1, 2, 3], 'the slots after the lamp\'s');
  assert.equal(fillLanternPool([p], () => [0, 0, 0], [], new Float32Array(1), anim).n, 1, 'no stage: the lamp alone');
  // the Festival over: read again when the answer moves - nothing more hung or lit
  edict = 'market-day'; v = 2;
  assert.equal(sb.list().length, 1, 'the seat\'s own alone');
  const before = reads;
  assert.equal(stage.festive(3021), false, 'the answer moved: read again');
  assert.equal(stage.festive(3021), false);
  assert.equal(reads, before + 1, 'once, and kept');
  assert.equal(stage.lanterns(p), null);
  filled = fillLanternPool([p], () => [0, 0, 0], pool, filled.ranges, anim, stage.lanterns);
  assert.equal(filled.n, 1);
});

// ─── FESTIVAL-STAGE: THE MUSIC ──────────────────────────────────────

const OUTDOOR = { inside: false, inLocationRect: true, locationType: LOCATION_TYPES.TownCity, locationIndex: 1, weather: 'sunny', night: false, gameDays: 0, arrested: false };
function director() {
  const played = [];
  let playing = false;
  const d = createMusicDirector({ fm: false, play: (name) => { played.push(name); playing = true; }, stop: () => { playing = false; }, playing: () => playing });
  return { d, played };
}

test('FESTIVAL-STAGE the music: a Festival town\'s streets hear the tavern\'s playlist, the day\'s song as a tavern picks it; the same streets without one keep the street\'s; a building keeps its own; the wilds never (mutants: the Festival unheard; every environment a tavern)', () => {
  const fest = director();
  assert.equal(fest.d.update({ ...OUTDOOR, festival: true }), TAVERN_SONGS[0], 'day 0: the tavern list\'s first');
  assert.equal(fest.d.update({ ...OUTDOOR, festival: true, gameDays: 2 }), TAVERN_SONGS[2], 'day 2: its third, as a tavern walks it');
  assert.equal(fest.d.manager.currentPlaylist, TAVERN_SONGS);
  const plain = director();
  plain.d.update({ ...OUTDOOR, festival: false });
  assert.ok(!TAVERN_SONGS.includes(plain.played[0]), `no Festival: the street's own (${plain.played[0]})`);
  const inside = director();
  inside.d.update({ ...OUTDOOR, festival: true }, { inside: true, buildingType: BUILDING_TYPES.Palace });
  assert.equal(inside.d.manager.currentPlaylist.includes('06.HMI'), true, 'the palace keeps its own');
  assert.deepEqual([MUSIC_ENV.City, MUSIC_ENV.Wilderness, MUSIC_ENV.Palace].map((e) => festivalEnvironment(e, true)), [MUSIC_ENV.Tavern, MUSIC_ENV.Wilderness, MUSIC_ENV.Palace]);
  assert.equal(festivalEnvironment(MUSIC_ENV.City, false), MUSIC_ENV.City);
  assert.equal(festivalEnvironment(MUSIC_ENV.City, 'yes'), MUSIC_ENV.City, 'only a Festival that rules');
});

test('FESTIVAL-STAGE wired in the streets\' host: the build measures the Festival\'s anchors at the taverns and the bounty boards and a lantern before every banner, kept on the pixel; the stage reads the dressed seat; the lantern pool takes its lanterns; the music its Festival (mutants: the temples for the taverns; the pool without them; the music without it)', () => {
  const w = hostText('src/scenes/world.js');
  assert.match(w, /const festivalAnchors = pixelBoardSplit \? festivalBannerAnchors\(\{ frames: pixelHomeFrames, tavernKeys: buildingKeysOfType\(locBlocks, makeBuildingKey, TALK_BUILDING_TYPES\.Tavern\), boards: pixelBoards, bounty: pixelBoardSplit \}\) : null;/);
  assert.match(w, /const festivalLanterns = festivalAnchors \? festivalLanternsOf\(\[\.\.\.\(seatAnchors \?\? \[\]\), \.\.\.festivalAnchors\]\) : null;/);
  assert.match(w, /seatAnchors, _boardSplit: pixelBoardSplit, festivalAnchors, festivalLanterns,/);
  assert.match(w, /const festivalStage = seatBook \? createFestivalStage\(\{ seatAt: \(mapId\) => seatHere\(mapId\), version: \(\) => \(seatBook\.open === true \? 1 : 0\) \}\) : null;/);
  assert.match(w, /worldLightAnimator\.ranges, festivalStage \? festivalStage\.lanterns : null\);/);
  assert.match(w, /arrested: Boolean\(playerEntity\.arrested\),\n\s*festival: festivalStage\?\.festive\(_musicLoc\?\.mapTableData\?\.mapId\) === true,/);
  assert.match(src('src/scenes/shared.js'), /const environment = festivalEnvironment\(held, merged\.festival === true\);/);
});

// ─── AUDIT FESTIVAL S1: THE TURNING WHILE THE PLAYER STAYS ──────────
// The seats' list was read at the session's start and at a town's arrival alone, and an arrival inside SEAT_LIST_CACHE_MS
// reused the last read - so a Festival (its music, banners, lanterns) or a Curfew outlived its week for a player who stayed
// in town past the Turning, and one that became law at it was never staged. A list read in an earlier seat week is
// expired; and the book's own frame tick (redTick, called each online frame) reads the list again once the week turns.

/** A list door whose holder's Edict is `edictAt()` at the read's moment; `calls` counts its reads. */
const turningDoor = (edictAt) => {
  const door = { calls: 0, list: async () => { door.calls++; return { ok: true, data: { seats: [{ key: 3021, state: 'confirmed', holder: { guild: SH, edict: edictAt() } }] } }; } };
  return door;
};

test('AUDIT FESTIVAL S1 the seats\' list read in an earlier seat week is expired: an arrival just after the Turning, inside SEAT_LIST_CACHE_MS of a read just before it, asks the service again and stages what rules now; inside one week the list is kept as before (mutants: the week unchecked; the cache unchecked)', async () => {
  const W = seatWeekOf(Date.UTC(2026, 9, 1)), turning = seatWeekStartMs(W + 1);
  let now = turning - 60_000;
  const door = turningDoor(() => (now < turning ? 'festival' : null));
  const book = createTownSeatBook({ door, nowMs: () => now });
  await book.read();
  assert.equal(book.dressed({ key: 3021 }).holder.edict, 'festival');
  now = turning - 30_000;
  await book.read();
  assert.equal(door.calls, 1, 'the same week, inside the list\'s minutes: kept');
  now = turning + 3 * 60_000;   // four minutes after the read: inside SEAT_LIST_CACHE_MS, but past the Turning
  assert.ok(now - (turning - 60_000) < SEAT_LIST_CACHE_MS);
  await book.read();
  assert.equal(door.calls, 2, 'last week\'s list: asked again');
  assert.equal(book.dressed({ key: 3021 }).holder.edict, null, 'the Festival ended at the Turning');
  const stage = createFestivalStage({ seatAt: (m) => (m === 3021 ? book.dressed({ key: 3021 }) : null), now: () => now });
  assert.equal(stage.festive(3021), false, 'no tavern music, banners or lanterns in week W+1');
  now += 60_000;
  await book.read();
  assert.equal(door.calls, 2, 'this week\'s list: kept again');
});

test('AUDIT FESTIVAL S1 the book\'s frame tick reads the list again ONCE when the seat week turns - the Festival that ended unstaged, the one that became law staged, a Curfew the same - while the seats are open; never before the Turning, never twice, never for seats shut to this account; the host calls the tick each online frame (mutants: the re-read; the week compare; the open gate; once)', async () => {
  const W = seatWeekOf(Date.UTC(2026, 9, 1)), turning = seatWeekStartMs(W + 1);
  let now = turning - 60_000;
  let edicts = ['festival', 'curfew'];   // week W's, then W+1's
  const door = turningDoor(() => (now < turning ? edicts[0] : edicts[1]));
  // PIN MOVED (D1-LOAD): each client reads at its own share of SEAT_TURN_READ_SPREAD_MS past the Turning - this one's
  // half of it (rand 0.5), never every client in one second
  const book = createTownSeatBook({ door, nowMs: () => now, rand: () => 0.5 });
  const READ = turning + SEAT_TURN_READ_SPREAD_MS / 2 + 1000;
  await book.read();   // the arrival's
  const stage = createFestivalStage({ seatAt: (m) => (book.open === true && m === 3021 ? book.dressed({ key: 3021 }) : null), now: () => now, version: () => (book.open === true ? 1 : 0) });
  assert.equal(stage.festive(3021), true);
  now = turning - 1;
  book.redTick();
  assert.equal(door.calls, 1, 'before the Turning: nothing asked');
  now = turning + 1000;
  book.redTick();
  await tick();
  assert.equal(door.calls, 1, 'the week turned, but inside this client\'s share of the spread: not yet');
  now = READ;
  book.redTick();
  book.redTick();   // the same frame's second ask while the read is in flight
  await tick();
  assert.equal(door.calls, 2, 'the week turned: read again, once');
  assert.equal(book.dressed({ key: 3021 }).holder.edict, 'curfew', 'the Curfew that became law');
  now += BANNER_REFRESH_MS;
  assert.equal(stage.festive(3021), false, 'the Festival that ended: unstaged within a second');
  for (let i = 0; i < 5; i++) { now += 60_000; book.redTick(); }
  await tick();
  assert.equal(door.calls, 2, 'this week\'s list read: not asked again until SEAT_RED_READ_MS');
  now = READ + SEAT_RED_READ_MS;
  book.redTick();
  await tick();
  assert.equal(door.calls, 3, 'the red lines\' own clock as before');
  // a Festival that becomes law at the next Turning: staged
  edicts = [null, 'festival'];
  const W2 = seatWeekStartMs(W + 2);
  now = W2 - 60_000;
  const door2 = turningDoor(() => (now < W2 ? edicts[0] : edicts[1]));
  const book2 = createTownSeatBook({ door: door2, nowMs: () => now, rand: () => 0 });   // a share of nought: at once
  await book2.read();
  const stage2 = createFestivalStage({ seatAt: (m) => (m === 3021 ? book2.dressed({ key: 3021 }) : null), now: () => now });
  assert.equal(stage2.festive(3021), false);
  now = W2 + 5000;
  book2.redTick();
  await tick();
  now += BANNER_REFRESH_MS;
  assert.equal(stage2.festive(3021), true, 'the Festival that became law: staged');
  // seats shut to this account: no week's read
  now = turning - 60_000;
  const shut = { calls: 0, list: async () => { shut.calls++; return { ok: false, error: 'seats-closed' }; } };
  const book3 = createTownSeatBook({ door: shut, nowMs: () => now, rand: () => 0 });
  await book3.read();
  now = turning + 1000;
  book3.redTick();
  await tick();
  assert.equal(shut.calls, 1, 'shut: never asked at the Turning');
  assert.match(hostText('src/scenes/world.js'), /\n    seatBook\?\.redTick\(\);   \/\/ CROWN2/, 'the host ticks the book each online frame');
  assert.equal(SEAT_TURN_READ_SPREAD_MS, 120_000, 'two minutes');
  // the shares drawn: a book's own, from its rand - the last of the window still reads inside it
  const late = turningDoor(() => edicts[1]);
  now = turning - 60_000;
  const book4 = createTownSeatBook({ door: late, nowMs: () => now, rand: () => 0.999 });
  await book4.read();
  now = turning + SEAT_TURN_READ_SPREAD_MS - 1000;
  book4.redTick(); await tick();
  assert.equal(late.calls, 1, 'not before its own share');
  now = turning + SEAT_TURN_READ_SPREAD_MS;
  book4.redTick(); await tick();
  assert.equal(late.calls, 2, 'and read at it, inside the window');
});
