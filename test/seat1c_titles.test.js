// SEAT1c (2026-09-30, Mac: "Finish the seats"; Seats-Arc 7.4): THE TITLES AND GLYPHS A CHARTER GIVES - the token's
// vocabulary (five generic title ids with a bounded `ts` claim, four glyphs) reaching the relay first; the relay carrying
// the claim from the signature to every row; the client wording it off its own seats; and the service deriving both at
// a mint and offering the titles in the wardrobe - a palace seat's guildmaster a Warden, a crown's a Protector, every
// member the seat's glyph.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { standService, T0 } from './accountDb.mjs';
import { seatBadgeOf } from '../server-account/src/seatTurning.js';
import { fakeRoom } from './fakeRoom.mjs';
import { claimsValid, SEAT_TITLES, seatTitleClaimOk, TITLES, GLYPHS } from '../src/net/identityToken.js';
import { badged, readBadge } from '../src/net/wire.js';
import { seatGlyphsOf, seatTitleOf, seatTitleText, seatReportText, SEAT_MEMBER_WAIT_S } from '../src/net/townSeatLaw.js';
import { titleBadge, setSeatTitlePlaces, TITLE_TEXT, TITLE_RGBA, GLYPH_RGBA, GLYPH_PATH, GLYPH_MARK } from '../src/ui/playerBadge.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const ANTICLERE = { key: 3021, name: 'Anticlere', region: 21, tier: 'palace', pixel: [402, 151] };
const WAYREST = { key: 5023, name: 'Wayrest', region: 23, tier: 'crown', pixel: [610, 118] };
const DAY = 86400;

test('SEAT1c THE VOCABULARY: five seat title ids and four glyphs, closed; a seat title rides with its claim [key, Season] and only beside one; `badged` stamps it and `readBadge` reads it back, never beside another title (mutants: the claim required; the claim refused elsewhere; the bounds; the stamp; the reader)', () => {
  assert.deepEqual([...SEAT_TITLES], ['warden', 'protector', 'crowned', 'keeper', 'champion']);
  for (const t of SEAT_TITLES) assert.ok(TITLES.includes(t));
  for (const g of ['tower', 'crownDF', 'crownWR', 'crownSN']) assert.ok(GLYPHS.includes(g));
  const base = { s: 'acct-0001', n: 'Gamal', k: 'linked', i: T0, e: T0 + 60 };
  assert.equal(claimsValid({ ...base, t: 'warden', ts: [3021, 0] }), true);
  assert.equal(claimsValid({ ...base, t: 'warden' }), false, 'a seat title without its claim');
  assert.equal(claimsValid({ ...base, t: 'developer', ts: [3021, 0] }), false, 'a claim beside another title');
  assert.equal(claimsValid({ ...base, ts: [3021, 0] }), false, 'a claim beside none');
  assert.equal(seatTitleClaimOk([2 ** 32, 0]), false);
  assert.equal(seatTitleClaimOk([1, 10000]), false);
  assert.equal(seatTitleClaimOk([1, 2, 3]), false);
  assert.deepEqual(badged({}, { title: 'warden', ts: [3021, 0], glyphs: ['tower'] }), { title: 'warden', ts: [3021, 0], glyphs: ['tower'] });
  assert.deepEqual(badged({}, { title: 'developer', ts: [3021, 0] }), { title: 'developer' }, 'never beside another title');
  assert.deepEqual(readBadge({ title: 'warden', ts: [3021, 0], glyphs: ['tower', 'nonsense'] }), { title: 'warden', glyphs: ['tower'], ts: [3021, 0] });
  assert.deepEqual(readBadge({ title: 'founder', ts: [3021, 0] }), { title: 'founder', glyphs: [] });
  assert.deepEqual(readBadge({ title: 'warden', ts: ['x', 0] }), { title: 'warden', glyphs: [] }, 'a claim that does not fit is dropped');
});

test('SEAT1c THE LAW AND THE WORDS: the glyphs a guild\'s Charters give (the tower, each crown its own, in the vocabulary\'s order); the guildmaster\'s title (a crown first); the title worded off the client\'s own seats - "Warden of Anticlere", "Protector of Wayrest" - and its plain word where the place is unknown; every new title and glyph has its word, colour, shape and mark (mutants: the crown\'s glyph; the crown first; the words)', () => {
  assert.deepEqual(seatGlyphsOf([{ key: 2, tier: 'crown', region: 23 }, { key: 1, tier: 'palace', region: 21 }, { key: 3, tier: 'palace', region: 34 }]), ['tower', 'crownWR']);
  assert.deepEqual(seatGlyphsOf([{ key: 2, tier: 'crown', region: 17 }]), ['crownDF']);
  assert.deepEqual(seatGlyphsOf([]), []);
  assert.deepEqual(seatTitleOf([{ key: 9, tier: 'palace', region: 21 }, { key: 3, tier: 'palace', region: 21 }]), { title: 'warden', ts: [3, 0] });
  assert.deepEqual(seatTitleOf([{ key: 9, tier: 'palace', region: 21 }, { key: 5023, tier: 'crown', region: 23 }]), { title: 'protector', ts: [5023, 0] }, 'a crown first');
  assert.equal(seatTitleOf([]), null);
  const place = (k) => ({ 3021: ANTICLERE, 5023: WAYREST })[k] ?? null;
  assert.equal(seatTitleText('warden', [3021, 0], place), 'Warden of Anticlere');
  assert.equal(seatTitleText('protector', [5023, 0], place), 'Protector of Wayrest');
  assert.equal(seatTitleText('keeper', [3021, 2], place), 'Keeper of Anticlere, Season 2');
  assert.equal(seatTitleText('crowned', [5023, 3], place), 'Crowned in Season 3');
  assert.equal(seatTitleText('warden', [1, 0], place), null);
  setSeatTitlePlaces(place);
  assert.equal(titleBadge({ title: 'warden', ts: [3021, 0] }).text, 'Warden of Anticlere');
  assert.equal(titleBadge({ title: 'warden', ts: [1, 0] }).text, 'Warden', 'a place this client does not know: the plain word');
  setSeatTitlePlaces(null);
  assert.equal(titleBadge({ title: 'warden', ts: [3021, 0] }).text, 'Warden');
  for (const t of SEAT_TITLES) assert.ok(TITLE_TEXT[t] && TITLE_RGBA[t], `${t}'s word and colour`);
  for (const g of ['tower', 'crownDF', 'crownWR', 'crownSN']) assert.ok(GLYPH_RGBA[g] && GLYPH_PATH[g] && GLYPH_MARK[g], `${g}'s colour, shape and mark`);
  assert.deepEqual(GLYPH_RGBA.crownWR.map((v) => Math.round(v * 255)), [179, 38, 46, 255], 'Wayrest\'s crimson');
});

test('SEAT1c THE RELAY CARRIES THE CLAIM: a hello whose token wears "warden" with its claim stands in the room with `ts` beside its title, and a second hello wearing none takes it off (mutants: the projection; the attachment; badged)', async () => {
  const r = fakeRoom('world:40,15');
  const a = r.connect();
  await r.hello(a, 'peer-0001', { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 }, { title: 'warden', ts: [3021, 0], glyphs: ['tower'] });
  const b = r.connect();
  await r.hello(b, 'peer-0002', { x: 1, y: 0, z: 1, yaw: 0, pitch: 0 });
  const row = b.sent.find((m) => m.t === 'welcome')?.peers?.find((p) => p.id === 'peer-0001');
  assert.deepEqual([row?.title, row?.ts, row?.glyphs], ['warden', [3021, 0], ['tower']]);
  assert.deepEqual(a.att.ts, [3021, 0], 'on the socket\'s row');
  const c = r.connect();
  await r.hello(c, 'peer-0001', { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 });
  assert.equal(c.att.ts, undefined, 'a hello wearing none carries none');
});

test('SEAT1c THE SERVICE\'S MINT AND WARDROBE: a palace seat\'s guildmaster may wear "warden", and a token minted for that character wears it with its claim and every member\'s tower; a member wears the tower and no title; the guildmaster\'s other character wears neither; an account holding nothing may not equip it (mutants: the wardrobe\'s titles; the mint\'s guildmaster check; the member\'s glyph)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const svc = await standService({ SEATS_OPEN: 'on', MARKS_OPEN: 'on' });
  const raw = svc.env.DB._raw;
  const w = [await svc.guest(), await svc.guest(), await svc.guest()];
  for (const x of w) raw.prepare("INSERT INTO world_witness (kind, key, account, report, region, at) VALUES ('seat', ?, ?, ?, ?, ?)").run(String(ANTICLERE.key), x.id, seatReportText(ANTICLERE), 21, T0 - DAY);
  const gm = await svc.registered('Gamal', { renown: 12 });
  assert.equal((await svc.found(gm, { name: 'The Silver Hand', tag: 'SH' })).status, 200);
  const gid = raw.prepare('SELECT guild_id FROM guild_members WHERE player = ? AND char_id = ?').get(gm.id, gm.character).guild_id;
  raw.prepare('UPDATE guild_members SET joined_at = ? WHERE guild_id = ?').run(T0 - SEAT_MEMBER_WAIT_S - DAY, gid);
  const mem = await svc.registered('Menno');
  raw.prepare('INSERT INTO guild_members (player, char_id, guild_id, rank, name, joined_at) VALUES (?, ?, ?, 2, ?, ?)').run(mem.id, mem.character, gid, 'Menno', T0 - 30 * DAY);
  const outsider = await svc.registered('Oswin');
  assert.equal((await svc.call('/v1/account/title', { title: 'warden' }, gm.secret)).status, 403, 'nothing held yet');
  raw.prepare("INSERT INTO town_seat_holds (key, guild_id, region, tier, since_week, standing, truce_week, at) VALUES (?, ?, 21, 'palace', 1, 50, NULL, ?)").run(ANTICLERE.key, gid, T0);
  const wardrobe = (await svc.call('/v1/account', undefined, gm.secret));
  void wardrobe;
  const equip = await svc.call('/v1/account/title', { title: 'warden' }, gm.secret);
  assert.equal(equip.status, 200);
  assert.ok(equip.body.titles.includes('warden'), 'offered in the wardrobe');
  const mint = async (who, character) => (await svc.call('/v1/auth/token', { character, guild: true }, who.secret)).body;
  const m1 = await mint(gm, gm.character);
  assert.deepEqual([m1.title, m1.ts], ['warden', [ANTICLERE.key, 0]]);
  assert.ok(m1.glyphs.includes('tower'));
  const claims = JSON.parse(Buffer.from(m1.token.split('.')[1], 'base64url').toString());
  assert.deepEqual([claims.t, claims.ts], ['warden', [ANTICLERE.key, 0]], 'in the signed claims');
  const m2 = await mint(mem, mem.character);
  assert.deepEqual([m2.title, m2.ts, m2.glyphs.includes('tower')], [null, undefined, true], 'a member: the tower, no title');
  assert.deepEqual(await seatBadgeOf(svc.env.DB, mem.id, mem.character), { glyphs: ['tower'], title: null, ts: null }, 'a member\'s badge: the glyph, never the title - whatever it wears');
  const m3 = await mint(gm, 'char-gamal-other');
  assert.deepEqual([m3.title, m3.glyphs.includes('tower')], [null, false], 'the guildmaster\'s other character: neither');
  assert.equal((await svc.call('/v1/account/title', { title: 'warden' }, outsider.secret)).status, 403);
  // PIN MOVED (CROWN1 part two): the champion's title is the account's own, before the guildmaster's seat titles
  // PIN MOVED (SEASON1): every title kept for good - a Season's crowned and keeper beside the champion - worn off its own row
  assert.match(rd('server-account/src/index.js'), /const seatT = KEPT_TITLES\.includes\(wornT\) \? \(kept \? \{ t: wornT, ts: kept\.ts \} : \{\}\)\s*: SEAT_TITLES\.includes\(wornT\) \? \(seatBadge\?\.title === wornT \? \{ t: wornT, ts: seatBadge\.ts \} : \{\}\)\s*: CHAPTER_TITLES\.includes\(wornT\) \? \(chapterT \? \{ t: wornT, ts: chapterT\.ts \} : \{\}\) : \(wornT \? \{ t: wornT \} : \{\}\);/);   // PIN MOVED (CHAP4c): and a chapter's seat's title, its claim the named character's own
});
