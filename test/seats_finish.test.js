// AUDIT-SEATS (2026-10-01, Mac: "We need to do a comprehensive audit on everything and finish the not done"): THE SEATS
// ARC'S OPEN ITEMS, FINISHED - each test one item the bible had left NOT YET (bible/11-Multiplayer/Seats-Arc.md,
// `06-Systems/Online-Arc.md` AUDIT-SEATS). Driven through the real Worker over node:sqlite where the service is
// touched (test/accountDb.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService, T0 } from './accountDb.mjs';
import { seatReportText, seatWeekOf, SEAT_MEMBER_WAIT_S, politicsRows, POLITICS_ACTS, countWords, siegeMinutes, chronicleLine } from '../src/net/townSeatLaw.js';
import { createTownSeatBook } from '../src/net/townSeatBook.js';
import { readFileSync } from 'node:fs';
import { fakeSocketClass } from './fakeSocket.mjs';
import { OnlineSession } from '../src/net/online.js';
import { validTravellerFrame } from '../src/net/wire.js';
import { TRAVEL_VIEW_RIBBON } from '../src/ui/travelViewHud.js';
import { byClass } from './chargenDom.mjs';
import { mountNoticeBoard } from '../src/ui/noticeWindow.js';
import { HALL_OF_RECORDS_SHUT } from '../src/systems/onlineHomes.js';
import { templateByIndex } from '../src/systems/itemTemplates.js';
import '../src/systems/profTemplates.js';
import { SIEGE_GEM, GEMS } from '../src/net/professionLaw.js';
import { material } from '../src/net/nodeLaw.js';
import { mintMaterialItem, materialLabel, materialCountLabel } from '../src/systems/profItems.js';
import { SIEGE_SPOILS } from '../src/net/townSeatLaw.js';

const WAYREST = { key: 5023, name: 'Wayrest', region: 23, tier: 'crown', pixel: [590, 166] };
const ALCAIRE = { key: 3034, name: 'Alcaire Keep', region: 34, tier: 'palace', pixel: [520, 130] };
const DAY = 86400;
const W = seatWeekOf(T0 * 1000);

async function stood(t) {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const svc = await standService({ SEATS_OPEN: 'on', MARKS_OPEN: 'on' });
  const raw = svc.env.DB._raw;
  const witnesses = [await svc.guest(), await svc.guest(), await svc.guest()];
  for (const seat of [WAYREST, ALCAIRE]) for (const w of witnesses) raw.prepare("INSERT INTO world_witness (kind, key, account, report, region, at) VALUES ('seat', ?, ?, ?, ?, ?)").run(String(seat.key), w.id, seatReportText(seat), seat.region, T0 - DAY);
  raw.prepare('INSERT INTO town_seat_weeks (week, settled_at) VALUES (?, ?)').run(W - 1, T0);
  const guild = async (handle, name, tag) => {
    const gm = await svc.registered(handle, { renown: 12 });
    assert.equal((await svc.found(gm, { name, tag })).status, 200);
    const gid = raw.prepare('SELECT guild_id FROM guild_members WHERE player = ? AND char_id = ?').get(gm.id, gm.character).guild_id;
    raw.prepare('UPDATE guild_members SET joined_at = ? WHERE guild_id = ?').run(T0 - SEAT_MEMBER_WAIT_S - DAY, gid);
    return { gm, gid, tag };
  };
  const hold = (seat, g) => raw.prepare(`INSERT INTO town_seat_holds (key, guild_id, region, tier, since_week, standing, truce_week, at, tithe, owed)
    VALUES (?, ?, ?, ?, ?, 50, NULL, ?, 6, 0)`).run(seat.key, g.gid, seat.region, seat.tier, W - 1, T0 - 7 * DAY);
  const act = async (path, g, body) => (await svc.call(path, { character: g.gm.character, ...body }, g.gm.secret)).body;
  return { svc, raw, guild, hold, act };
}

test('AUDIT-SEATS AN OFFER DECLINED: an offer of fealty made to a guild is declined by it at no cost (the offer gone, nothing sworn, no Standing lost), and its own offer still withdrawn first, a sworn fealty still broken; an offer of a Pact made to it declined, unannounced; the Seat tab\'s rows carry a Decline beside Accept and Sign, and the book says each in its own words (mutants: the decline\'s pair; its order; the lever; the words)', async (t) => {
  const s = await stood(t);
  const oa = await s.guild('Orla', 'The Oath', 'OA'), sh = await s.guild('Gamal', 'The Silver Hand', 'SH');
  s.hold(WAYREST, oa); s.hold(ALCAIRE, sh);
  // the Silver Hand offers to swear; the Oath declines
  assert.deepEqual(await s.act('/v1/seats/fealty', sh, { tag: 'OA', as: 'vassal' }), { ok: true });
  assert.deepEqual(await s.act('/v1/seats/fealty/break', oa, { tag: 'SH' }), { ok: true, declined: true });
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM guild_fealty').get().n, 0);
  assert.deepEqual(s.raw.prepare('SELECT standing FROM town_seat_holds ORDER BY key').all().map((r) => r.standing), [50, 50], 'no cost');
  assert.equal((await s.act('/v1/seats/fealty/break', oa, { tag: 'SH' })).error, 'fealty-none', 'nothing left to decline');
  // the Oath offers to take the Silver Hand; the Silver Hand declines; a third guild cannot decline another pair's
  const dg = await s.guild('Doran', 'Daggers', 'DG');
  assert.deepEqual(await s.act('/v1/seats/fealty', oa, { tag: 'SH', as: 'liege' }), { ok: true });
  assert.equal((await s.act('/v1/seats/fealty/break', dg, { tag: 'OA' })).error, 'fealty-none', 'not its offer to decline');
  assert.deepEqual(await s.act('/v1/seats/fealty/break', sh, { tag: 'OA' }), { ok: true, declined: true });
  // sworn: the break still breaks
  await s.act('/v1/seats/fealty', sh, { tag: 'OA', as: 'vassal' });
  assert.deepEqual(await s.act('/v1/seats/fealty/accept', oa, { tag: 'SH' }), { ok: true });
  assert.deepEqual(await s.act('/v1/seats/fealty/break', oa, { tag: 'SH' }), { ok: true, breaking: true });
  // a Pact offered to the Oath, declined unannounced
  assert.equal((await s.act('/v1/seats/pact', dg, { tag: 'OA' })).signed, false);
  assert.deepEqual(await s.act('/v1/seats/pact/break', oa, { tag: 'DG' }), { ok: true, announced: false });
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM town_seat_red').get().n, 0);
  // the rows and the book
  const SHg = { name: 'The Silver Hand', tag: 'SH' }, OAg = { name: 'The Oath', tag: 'OA' };
  assert.deepEqual(politicsRows({ fealty: [{ vassal: SHg, liege: OAg, state: 'offered', mine: false, asVassal: false }] }).map((r) => [r.act, r.alt]), [['fealty-accept', 'fealty-decline']]);
  assert.deepEqual(politicsRows({ pacts: [{ with: SHg, state: 'offered', until: 9, mine: false }] }).map((r) => [r.act, r.alt]), [['pact-accept', 'pact-decline']]);
  assert.deepEqual(politicsRows({ pacts: [{ with: SHg, state: 'offered', until: 9, mine: true }] }).map((r) => [r.act, r.alt]), [['pact-withdraw', undefined]], 'its own offer: no Decline');
  assert.deepEqual([POLITICS_ACTS['fealty-decline'], POLITICS_ACTS['pact-decline']], ['Decline', 'Decline']);
  const calls = [];
  let answer = { declined: true };
  const door = new Proxy({}, { get: (_, k) => (...a) => { calls.push([k, ...a]); return Promise.resolve({ ok: true, data: answer }); } });
  const book = createTownSeatBook({ door, character: () => 'c1', storage: null });
  assert.equal((await book.declineFealty('SH')).text, 'The offer of fealty from <SH> is declined.');
  answer = { announced: false };
  assert.equal((await book.declinePact('SH')).text, 'The offer of a Pact from <SH> is declined.');
  assert.deepEqual(calls, [['fealtyBreak', 'c1', 'SH'], ['pactBreak', 'c1', 'SH']]);
});

test('AUDIT-SEATS A SIEGE\'S LENGTH IN THE CHRONICLE (9.2: "stormed the gates of Anticlere and took its Charter from the Ebon Oath after thirty-one minutes"): a count in words to ninety-nine, its digits past; a siege\'s whole minutes from its start to its receipt\'s end, at least one, none for a bad pair; the line in the design\'s words where the row keeps the length, the old line where it does not (mutants: the words; the rounding; the floor; the line; the singular)', () => {
  assert.deepEqual([0, 1, 7, 13, 19, 20, 31, 40, 99, 100, 1234].map(countWords), ['zero', 'one', 'seven', 'thirteen', 'nineteen', 'twenty', 'thirty-one', 'forty', 'ninety-nine', '100', '1,234']);
  assert.deepEqual([countWords(-1), countWords(2.5)], ['-1', '2.5']);
  assert.deepEqual([siegeMinutes(1000, 1000 + 31 * 60), siegeMinutes(1000, 1000 + 31 * 60 + 29), siegeMinutes(1000, 1000 + 31 * 60 + 30), siegeMinutes(1000, 1010), siegeMinutes(1000, 999), siegeMinutes(NaN, 1000), siegeMinutes(1000, undefined)],
    [31, 31, 32, 1, null, null, null]);
  const ANT = { key: 3021, name: 'Anticlere', region: 21, tier: 'palace' };
  const row = (minutes) => ({ kind: 'siege-taken', week: 4, data: { guild: { name: 'The Silver Hand', tag: 'SH' }, from: { name: 'Ebon Oath', tag: 'EO' }, ...(minutes !== undefined ? { minutes } : {}) } });
  assert.equal(chronicleLine(row(31), ANT), 'In week 4, the Silver Hand <SH> stormed the gates of Anticlere and took its Charter from Ebon Oath <EO> after thirty-one minutes.');
  assert.equal(chronicleLine(row(1), ANT), 'In week 4, the Silver Hand <SH> stormed the gates of Anticlere and took its Charter from Ebon Oath <EO> after one minute.');
  assert.equal(chronicleLine(row(undefined), ANT), 'In week 4, the Silver Hand <SH> took the Charter of Anticlere by siege from Ebon Oath <EO>.');
  assert.equal(chronicleLine(row(null), ANT), 'In week 4, the Silver Hand <SH> took the Charter of Anticlere by siege from Ebon Oath <EO>.', 'a row from before');
});

test('AUDIT-SEATS THE RIBBON GOES WITH THE GUILD: a socket whose guild is taken off (a removal carried in, or a new guild\'s order) wears no ribbon on its row; on the page a peer whose tag moves loses its ribbon, in the room and in memory, and so do I when my own tag moves; a frame that leaves the tag as it was keeps it (mutants: the relay\'s strip; the page\'s three)', async () => {
  const relay = readFileSync(new URL('../server/src/index.js', import.meta.url), 'utf8');
  assert.match(relay, /_unguild\(a\) \{ const b = \{ \.\.\.a \}; delete b\.gi; delete b\.gt; delete b\.gm; delete b\.rb; return b; \}/);
  const { FakeWS, sockets } = fakeSocketClass();
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => 1_000_000 });
  s.join('world:2,12', { x: 1, y: 2, z: 3, yaw: 0, pitch: 0, mv: 0 });
  const ws = sockets[0];
  ws.open();
  ws.receive({ t: 'welcome', id: 'mac-0001', peers: [{ id: 'bob-0002', name: 'Bob', gt: 'OA', rb: [0, 2] }], n: 2, v: 'world149' });
  ws.receive({ t: 'guild', id: 'bob-0002', gt: 'OA' });
  assert.deepEqual(s.ribbonOf('bob-0002'), [0, 2], 'the tag as it was: kept');
  ws.receive({ t: 'guild', id: 'bob-0002', gt: 'SH' });
  assert.equal(s.ribbonOf('bob-0002'), null, 'another guild: gone');
  ws.receive({ t: 'join', id: 'bob-0002', name: 'Bob', gt: 'OA', rb: [0, 2] });
  ws.receive({ t: 'leave', id: 'bob-0002' });
  ws.receive({ t: 'guild', id: 'bob-0002' });
  assert.equal(s.ribbonOf('bob-0002'), null, 'no guild, in memory too');
  s.adoptIdentity({ name: 'Mac', guild: 'OA', ribbon: [3, 4] });
  ws.receive({ t: 'guild', id: 'mac-0001', gt: 'OA' });
  assert.deepEqual(s.ribbonOf('mac-0001'), [3, 4]);
  ws.receive({ t: 'guild', id: 'mac-0001' });
  assert.equal(s.ribbonOf('mac-0001'), null, 'mine, when my guild is taken off');
});

test('AUDIT-SEATS THE RIBBON ON THE TRAVEL VIEW: a traveller frame keeps the ribbon the relay stamps (a bad one read as none); the travel view\'s badge carries it, its sprite keyed by it and drawn with a band under the row in the field colour, edged in the border (mutants: the reader; the badge; the key; the band)', () => {
  const f = validTravellerFrame({ t: 'trav', id: 'peer-0002', name: 'Bran', p: null, rb: [0, 2] });
  assert.deepEqual(f.rb, [0, 2]);
  assert.equal(validTravellerFrame({ t: 'trav', id: 'peer-0002', name: 'Bran', p: null, rb: [2, 2] }).rb, null);
  assert.deepEqual({ ...TRAVEL_VIEW_RIBBON }, { band: 2, edge: 1, gap: 1 });
  const hud = readFileSync(new URL('../src/ui/travelViewHud.js', import.meta.url), 'utf8');
  assert.match(hud, /const ribbonH = P\.rb \? TRAVEL_VIEW_RIBBON\.gap \+ TRAVEL_VIEW_RIBBON\.band \+ TRAVEL_VIEW_RIBBON\.edge : 0;/, 'the sprite grown to hold it');
  assert.match(hud, /h = Math\.ceil\(titleH \+ rowH \+ 2 \+ ribbonH\)/);
  assert.match(hud, /glyphs: glyphBadges\(b\), rb: ribbonColours\(b\?\.rb\), arms: badgeArms\(b\) \};/);   // AUDIT HERALDRY H4: and the tag's arms
  assert.match(hud, /\$\{b\.gt \?\? ''\}\|\$\{\(Array\.isArray\(b\.rb\) \? b\.rb : \[\]\)\.join\('\/'\)\}/, 'the sprite keyed by it');
  assert.match(hud, /x\.fillStyle = P\.rb\.field; x\.fillRect\(cx, by, rowW, R\.band\);\n\s+x\.fillStyle = P\.rb\.border; x\.fillRect\(cx, by \+ R\.band, rowW, R\.edge\);/);
  const world = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(world, /const tvBadgeOf = \(p\) => \(\{[^\n]*gt: p\.gt \?\? null, rb: p\.rb \?\? null \}\);/);
});

test('AUDIT-SEATS THE HALL OF RECORDS FROM THE BOARD AND IN THE CASTLES: the Seat tab reads the whole Chronicle as the book (said where it cannot); the world opens it in place of the board; a crown\'s castle shelves are its Hall of Records while the seats are open, pressed into the dungeon\'s own window slot (mutants: the button; its refusal; the board\'s door; the castle\'s shelves; the castle\'s gate; its press)', async () => {
  const noticeBook = { seenAt: () => null, read: async () => ({ board: { notes: [], notices: [], me: {} } }), markSeen: () => {}, cached: () => null, draft: () => ({ subject: '', body: '', days: 7, button: '' }), noticeDraft: () => ({ subject: '', body: '', days: 3 }), readGuild: async () => ({ data: null, error: 'no-guild' }) };
  const now = 1_800_000_000;
  const ANT = { key: 3021, name: 'Anticlere', region: 21, tier: 'palace', pixel: [402, 151] };
  const data = { seat: ANT, week: 42, phase: 'muster', reckoningAt: now + 3600, turningAt: now + 86400, defence: null, holder: null, standings: [], chronicle: [{ kind: 'held', week: 41, data: { guild: { name: 'The Oath', tag: 'OA' }, standing: 50 } }] };
  const tick = (n = 4) => new Promise((r) => { let i = 0; const go = () => (++i >= n ? r() : setTimeout(go, 0)); setTimeout(go, 0); });
  const asked = [];
  let answer = true;
  const host = document.createElement('div');
  mountNoticeBoard(host, { town: { name: 'Anticlere', mapId: 3021 }, book: noticeBook, nowS: () => now, seat: { seat: ANT, book: { open: true, standings: async () => ({ data, error: null }) } }, seatRecords: async (s) => { asked.push(s.key); return answer; } });
  byClass(host, 'notice-tab')[1].onclick();
  await tick();
  const b = byClass(host, 'notice-seat-records')[0];
  assert.equal(b.textContent, 'Read the Hall of Records');
  b.onclick();
  await tick();
  assert.deepEqual(asked, [3021]);
  answer = false;
  byClass(host, 'notice-seat-records')[0].onclick();
  await tick();
  assert.ok(host.textContent.includes(HALL_OF_RECORDS_SHUT), 'said where it cannot be read');
  const world = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(world, /seatRecords: \(st\) => openRecordsFromBoard\(st\),/);
  assert.match(world, /await hallOfRecordsRead\(st\)[^\n]*\n[^\n]*\n\s+if \(!w\) return false;\n\s+townTalk\.showOverlay\(w\);/);   // PIN MOVED (AUDIT CHAP4 C5): the board opens the palace's own read, its window the Hall's whole book
  assert.match(readFileSync(new URL('../src/ui/noticeWindow.js', import.meta.url), 'utf8'), /\.\.\.\(deps\.seatRecords \? \{ readRecords: deps\.seatRecords \} : \{\}\)/);
  // the castles
  const dc = readFileSync(new URL('../src/scenes/dungeonContext.js', import.meta.url), 'utf8');
  assert.match(dc, /if \(b\.layout\.castleBlock && isShopShelfModel\(p\.modelIdNum\)\) castleShelves\.push\(\{ aabb \}\);/);
  const modes = readFileSync(new URL('../src/scenes/worldModes.js', import.meta.url), 'utf8');
  assert.match(modes, /const castleRecordsHere = \(\) => mode === 'dungeon' && !!dungeonLoc && !!host\.hallOfRecords\?\.here\?\.\(\(dungeonLoc\.mapTableData\?\.mapId \?\? 0\) >>> 0\);/);
  assert.match(modes, /ctx\.addActivationTargets\(\(\) => \(castleRecordsHere\(\) \? ctx\.castleShelves\.map\(\(s, i\) => \(\{ key: `records:\$\{i\}`, aabb: s\.aabb,/);
  assert.match(modes, /if \(key\.startsWith\('records:'\)\) \{ openCastleRecords\(\); return true; \}/);
  // PIN MOVED (AUDIT-SEATS C11): and over a window opened meanwhile it is disposed, not stacked
  assert.match(modes, /if \(mode !== 'dungeon' \|\| dungeonLoc !== at \|\| dungeonCtx\?\.overlayWindow\?\.\(\)\) \{ dropRecords\(w\); return; \}\n\s+if \(w\) mountServiceWindow\(w\);\n\s+else say\(HALL_OF_RECORDS_SHUT\);/);
});

test('AUDIT-SEATS THE CHRONICLE NAMES WHAT WAS PAID: a vassal\'s tribute and a Conscription whose treasury held less than the due say what it held - and nothing where it held nothing (mutants: the ledger\'s amount; the row\'s lookup; the empty)', async (t) => {
  const src = readFileSync(new URL('../server-account/src/seatTurning.js', import.meta.url), 'utf8');
  assert.match(src, /SELECT \?1, \?2, \?3, json_set\(\?4, '\$\.marks', amount\), \?5 FROM marks_ledger WHERE actor = 'seats' AND rid = \?6/);
  assert.match(src, /paidHistory\(c\.crownKey, 'conscription', \{ guild: names\.get\(c\.crown\), from: names\.get\(c\.guild\) \}, rid\)/);
  assert.match(src, /paidHistory\(k, 'fealty-tribute', \{ vassal: names\.get\(f\.vassal\), liege: names\.get\(f\.liege\) \}, `fealty-\$\{week\}-\$\{f\.vassal\}`\)/);
  // the SQL itself, over the real schema: a ledger row of 30 against a due of 120 - the row says 30; none written, none said
  const s = await stood(t);
  const raw = s.raw;
  const v = await s.guild('Vara', 'Vassals', 'VA'), l = await s.guild('Liam', 'Lieges', 'LI');
  raw.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
    VALUES ('mint', NULL, 'guild', ?, 'test', 100, 1, 1, 'seed', NULL, 'seed-v')`).run(v.gid);
  raw.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
    VALUES ('guild', ?, 'guild', ?, 'fealty-tribute', 30, 1, 1, 'seats', 'The Turning', 'fealty-9-g1')`).run(v.gid, l.gid);
  const ins = raw.prepare(`INSERT INTO town_seat_history (key, week, kind, data, at)
    SELECT ?1, ?2, ?3, json_set(?4, '$.marks', amount), ?5 FROM marks_ledger WHERE actor = 'seats' AND rid = ?6`);
  ins.run(5023, 9, 'fealty-tribute', JSON.stringify({ vassal: { name: 'V', tag: 'V' }, liege: { name: 'L', tag: 'L' } }), 1, 'fealty-9-g1');
  ins.run(5023, 9, 'fealty-tribute', JSON.stringify({}), 1, 'fealty-9-none');
  const rows = raw.prepare("SELECT data FROM town_seat_history WHERE kind = 'fealty-tribute'").all().map((r) => JSON.parse(r.data));
  assert.deepEqual(rows, [{ vassal: { name: 'V', tag: 'V' }, liege: { name: 'L', tag: 'L' }, marks: 30 }]);
});

test('AUDIT-SEATS THE SIEGE-CRACKED GEM: template 678 registered on the Diamond\'s picture, a Stores material of the gems at the Diamond\'s tier that withdraws as an item and is named as one; never a vein\'s strike (mutants: the template; the registry)', () => {
  const t = templateByIndex(678);
  assert.deepEqual([t?.name, t?.worldTextureArchive, t?.worldTextureRecord, t?.stackable, t?.rarity], ['Siege-cracked Gem', 254, 3, true, 10]);
  assert.deepEqual({ ...SIEGE_GEM, icon: [...SIEGE_GEM.icon] }, { key: 'gem:siege', family: 'gems', tier: 6, templateIndex: 678, name: 'Siege-cracked Gem', icon: [254, 3], dye: null });
  assert.deepEqual(material('gem:siege'), { key: 'gem:siege', family: 'gems', tier: 6, value: material('gem:diamond').value, templateIndex: 678 });
  assert.equal(mintMaterialItem('gem:siege', false)?.templateIndex, 678);
  assert.deepEqual([materialLabel('gem:siege', false), materialCountLabel('gem:siege', 2, false)], ['Siege-cracked Gem', 'Siege-cracked Gems']);
  assert.equal(GEMS.some((g) => g.key === 'gem:siege'), false, 'the glint\'s table holds no war\'s gem');
  assert.ok(SIEGE_SPOILS.includes('gem:siege'));
});
