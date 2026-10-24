// @ts-nocheck
// GUILD3 (2026-10-11, the owner: "simplifying the player guild and npc guild system from being too overcomplicated.
// Keeping depth, but making it easier to understand"; then "These are all of your decisions") - THE GUILDS MADE PLAIN:
// one word, one thing; every rule before the press; a duplicate cut, never depth. bible/11-Multiplayer/Guilds-Made-Plain.md.
//
// GUILD3a the words (a chapter's chairs and council, silver, the writ cards); GUILD3b the silver ledger says which way;
// GUILD3c what each rank may do, everything that holds a guild that would go, the treasury's two golds, a guild in one
// look; GUILD3d the chapter's card on the board; GUILD3e five Season events, the Ascendant band its own.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { byClass } from '../chargenDom.mjs';

import {
  seatLineOf, seatLinesOf, bookCappedLine, chapterChronicleLine, chapterSeasonLine, chapterRollLines, chapterTitleText, chapterBandEffectsLine,
  chapterDutiesLine, chapterBandOf, CHAPTER_BANDS, CHAPTER_ASCENDANT_FROM, CHAPTER_EVENTS, CHAPTER_EVENT_EFFECTS, chapterEventWeights, chapterEventOk,
  chapterHallFactor, chapterPriceFactor, CHAPTER_PATRON_PRICE, hallReceiptKindsOf, chapterDoctrinesFor,
} from '../../src/net/npcChapterLaw.js';
import * as chapterLaw from '../../src/net/npcChapterLaw.js';
import { chapterSeasonLines } from '../../src/net/chapterEvents.js';
import { CHAPTER_NEWS, CHAPTER_EVENT_NEWS } from '../../src/systems/livingWorld/lines.js';
import { TITLE_TEXT } from '../../src/ui/playerBadge.js';
import { siegeHonourLine } from '../../src/net/siege/siegeLink.js';
import { chronicleLine } from '../../src/net/townSeatLaw.js';
import { eventTimerRows } from '../../src/systems/eventTimers.js';
import { MARKS_KINDS } from '../../src/net/marksLaw.js';
import { GUILD_POWERS, GUILD_RANK_NAMES } from '../../src/net/guild/guildLaw.js';
import { HALL_POWERS } from '../../src/net/hallLaw.js';
import { WRIT_POWERS } from '../../src/net/writLaw.js';
import { SEAT_POWERS } from '../../src/net/townSeatLaw.js';
import { GUILD_RANK_ACTS, guildActRanks, guildRankActsOf, guildRankLines, GUILD_RANK_ACTS_NOTE } from '../../src/net/guild/guildPowers.js';
import {
  createSocialPanel, GUILD_SILVER_LINE_WORDS, guildSilverLineText, guildKeepsOf, guildRealmGoldText, GUILD_PRIMER_LINES, GUILD_ELSEWHERE_TEXT, GUILD_KEEPS_HEAD,
} from '../../src/ui/socialPanel.js';
import { GuildBook } from '../../src/net/guild/guildBook.js';
import { SocialState } from '../../src/net/social.js';
import { REFUSALS, accountRefusalText, accountGuilds } from '../../src/net/accountClient.js';
import { mountNoticeBoard } from '../../src/ui/noticeWindow.js';
import { materialCountLabel } from '../../src/systems/professions/profItems.js';
import { standService, T0 } from '../accountDb.mjs';
import { seatRealm } from '../realmSeat.mjs';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const FIGHTERS = 41, MAGES = 40, THIEVES = 42, BROTHERHOOD = 108, ARKAY = 21, KYNARETH = 35, DRAGON = 368, ANTICLERE = 21;
const tick = () => new Promise((r) => setImmediate(r));

// ─── GUILD3a: THE WORDS ─────────────────────────────────────────────

test('GUILD3a a chapter\'s rank 9 is its Master\'s CHAIR and its rank 8 a COUNCIL chair, its title a Councillor\'s - "seat" a town\'s Charter alone, "officer" a player guild\'s rank; the ids stand (mutants: each word)', () => {
  assert.equal(seatLineOf({ f: FIGHTERS, region: ANTICLERE, seat: 'master' }), 'You hold the Master\'s chair of the Fighters Guild in Anticlere.');
  assert.equal(seatLineOf({ f: MAGES, region: ANTICLERE, seat: 'officer' }, false), 'You no longer hold a council chair of the Mages Guild in Anticlere.');
  assert.deepEqual(seatLinesOf(null, [{ f: FIGHTERS, region: ANTICLERE, seat: 'officer' }]), ['You hold a council chair of the Fighters Guild in Anticlere.']);
  assert.equal(bookCappedLine([FIGHTERS]), 'The Fighters Guild keeps ranks 8 and 9 for its chapters\' Masters and councils, won by Merit. Your rank there is 7.');
  assert.equal(bookCappedLine([FIGHTERS, MAGES]), 'The Fighters Guild and the Mages Guild keep ranks 8 and 9 for their chapters\' Masters and councils, won by Merit. Your rank there is 7.');
  assert.deepEqual(chapterRollLines(FIGHTERS, { strength: 50, seats: [{ seat: 'officer', name: 'Bryn' }] }),
    ['The chapter of the Fighters Guild here is Steady (Strength 50).', 'The Master\'s chair stands empty.', 'Its council: Bryn.']);
  assert.deepEqual(chapterRollLines(FIGHTERS, { seats: [{ seat: 'master', name: 'Alda' }, { seat: 'officer', name: 'Bryn' }, { seat: 'officer', name: 'Cael' }] }),
    ['Master of the chapter: Alda.', 'Its council: Bryn and Cael.']);
  assert.deepEqual(chapterRollLines(FIGHTERS, { seats: [] }).slice(-1), ['No council chair is held.']);
  const row = (from, to) => chapterChronicleLine({ kind: 'seat', faction: FIGHTERS, week: null, data: { from, to }, name: 'Alda' });
  assert.deepEqual([row(null, 'master'), row(null, 'officer'), row('officer', 'master'), row('master', 'officer'), row('officer', null)], [
    'Alda took the Master\'s chair of the Fighters Guild.', 'Alda took a council chair of the Fighters Guild.', 'Alda rose to the Master\'s chair of the Fighters Guild.',
    'Alda gave the Master\'s chair of the Fighters Guild up, and kept a council chair.', 'Alda lost a council chair of the Fighters Guild.',
  ]);
  assert.match(chapterSeasonLine({ kind: 'season', faction: FIGHTERS, data: { season: 2 }, name: 'Alda' }), /^Through the Season of .+, Alda held the Master's chair of the Fighters Guild\.$/);
  assert.equal(chapterTitleText('chapterofficer', [FIGHTERS * 100 + ANTICLERE, 3]), 'Councillor of the Fighters Guild, Anticlere');
  assert.equal(chapterTitleText('chaptermaster', [FIGHTERS * 100 + ANTICLERE, 3]), 'Master of the Fighters Guild, Anticlere');
  assert.equal(TITLE_TEXT.chapterofficer, 'Chapter Councillor');
  // the sweep: no sentence a player reads of a chapter's ranks 8 and 9 says "seat" or "officer"
  const said = [seatLineOf({ f: FIGHTERS, region: ANTICLERE, seat: 'master' }), seatLineOf({ f: FIGHTERS, region: ANTICLERE, seat: 'officer' }), bookCappedLine([FIGHTERS]),
    ...chapterRollLines(FIGHTERS, { seats: [] }), row('master', 'officer'), row('officer', null), chapterTitleText('chapterofficer', [4121, 3])];
  for (const line of said) assert.doesNotMatch(line, /\bseat|\bofficer/i, line);
});

test('GUILD3a silver in every sentence a player reads - a siege\'s Honour, a struck Charter\'s refund, the day\'s reset - never "Marks" (mutants: each sentence)', () => {
  assert.equal(siegeHonourLine({ marks: 50, xp: 2000 }), 'Your Honor: 50 silver, 2,000 Renown, one Spoils of War roll');
  const seat = { key: 1, name: 'Anticlere', region: ANTICLERE, tier: 'palace' };
  assert.equal(chronicleLine({ kind: 'strike', week: 5, data: { guild: { name: 'The Silver Hand', tag: 'SH' }, refund: 8000 } }, seat),
    'In week 5, Anticlere was struck from the registry, and the Silver Hand <SH>\'s Charter with it - its claim fee of 8,000 silver refunded.');
  const daily = eventTimerRows({ now: T0 * 1000 }).find((r) => r.id === 'daily');
  assert.ok(daily, 'the daily reset row');
  assert.match(daily.detail, /rare hides, silver and Court writs/);
  for (const f of ['src/net/siege/siegeLink.js', 'src/systems/eventTimers.js']) assert.doesNotMatch(src(f), /[`'"][^`'"\n]*\b\d*\s*Marks\b[^`'"\n]*[`'"]/, f);
});

// ─── GUILD3b: THE LEDGER SAYS WHICH WAY ─────────────────────────────

/** Every MARKS_KINDS kind a guild's treasury is an end of (marksLaw.js and the service's writes). */
const GUILD_KINDS = ['guild-deposit', 'guild-withdraw', 'heraldry', 'guild-deed', 'contract-escrow', 'contract-return', 'writ-escrow', 'writ-return', 'tribute',
  'seat-claim', 'seat-upkeep', 'seat-edict', 'fort', 'seat-strike-refund', 'tithe', 'bounty-escrow', 'bounty-return', 'sellsword-escrow', 'sellsword-return',
  'royal-escrow', 'royal-return', 'patron-escrow', 'patron-return', 'conscription', 'fealty-tribute'];

test('GUILD3b a silver line by its own kind and way: every kind a guild\'s treasury is an end of has words; one that runs either way by its direction; a kind with none "paid" or "received" - never "put in" for silver that left; an older service\'s line by its `kind` as before (mutants: the words, the direction, the fallback)', () => {
  for (const k of GUILD_KINDS) {
    assert.ok(Object.hasOwn(MARKS_KINDS, k), `${k} is a ledger kind`);
    assert.ok(Object.hasOwn(GUILD_SILVER_LINE_WORDS, k), `${k} has words`);
  }
  assert.equal(guildSilverLineText({ who: 'Alda', raw: 'tribute', out: true, amount: 1000 }), 'Alda paid Tribute of 1,000 silver');
  // PIN MOVED: AUDIT GUILD3 W2 - a line the service made (its `who` a label: 'The Turning', an auction's id) is the guild's
  assert.equal(guildSilverLineText({ who: 'The Turning', raw: 'seat-upkeep', out: true, amount: 2500 }), 'The guild paid a Charter\'s upkeep of 2,500 silver');
  assert.equal(guildSilverLineText({ who: 'Alda', raw: 'patron-escrow', out: true, amount: 1500 }), 'Alda bid for a chapter\'s patronage: 1,500 silver');
  assert.equal(guildSilverLineText({ who: 'auction:4f1c', raw: 'tithe', out: false, amount: 12 }), 'The guild collected a Tithe of 12 silver');
  assert.equal(guildSilverLineText({ who: 'Bryn', raw: 'guild-deposit', out: false, amount: 5 }), 'Bryn put in 5 silver');
  assert.deepEqual([guildSilverLineText({ who: 'X', raw: 'conscription', out: true, amount: 3 }), guildSilverLineText({ who: 'X', raw: 'conscription', out: false, amount: 3 })],
    ['The guild paid Conscription of 3 silver', 'The guild received Conscription of 3 silver']);
  assert.deepEqual([guildSilverLineText({ who: 'X', raw: 'fealty-tribute', out: true, amount: 3 }), guildSilverLineText({ who: 'X', raw: 'fealty-tribute', out: false, amount: 3 })],
    ['The guild paid its liege a fealty share of 3 silver', 'The guild received a vassal\'s fealty share of 3 silver']);   // PIN MOVED: AUDIT GUILD3 W5 - fealty, never "tribute"
  assert.equal(guildSilverLineText({ who: 'X', raw: 'some-new-kind', out: true, amount: 7 }), 'The guild paid 7 silver', 'a kind with no words, out: paid');
  assert.equal(guildSilverLineText({ who: 'X', raw: 'some-new-kind', out: false, amount: 7 }), 'The guild received 7 silver');
  assert.equal(guildSilverLineText({ who: 'X', kind: 'heraldry', amount: 500 }), 'X changed the guild\'s arms for 500 silver', 'an older service: by its kind');   // PIN MOVED: AUDIT GUILD3 W6 - arms
  assert.equal(guildSilverLineText({ who: 'X', kind: 'deposit', amount: 9 }), 'X put in 9 silver');
  // the sweep: no kind that LEAVES a treasury is worded as one coming in (the in-only kinds - a deposit, a Tithe, a deed,
  // a refund, a return - are never a guild's `out`)
  const OUT_KINDS = ['guild-withdraw', 'heraldry', 'contract-escrow', 'writ-escrow', 'tribute', 'seat-claim', 'seat-upkeep', 'seat-edict', 'fort', 'bounty-escrow',
    'sellsword-escrow', 'royal-escrow', 'patron-escrow', 'conscription', 'fealty-tribute', 'some-new-kind'];
  for (const k of OUT_KINDS) assert.doesNotMatch(guildSilverLineText({ who: 'X', raw: k, out: true, amount: 1 }), /put in|received|collected|came home|come home/, k);
});

/** A service with a guild founded, its silver open. */
async function guildService(extra = {}) {
  const s = await standService({ MARKS_OPEN: 'on', ...extra });
  const raw = s.env.DB._raw;
  const gm = await s.registered('Aldric', { renown: 10 });
  const found = await s.found(gm, { name: 'The Iron Oath', tag: 'IRON' });
  assert.equal(found.status, 200, JSON.stringify(found.body));
  return { ...s, raw, gm, gid: found.body.guild.id };
}

test('GUILD3b the service: each silver line carries its own kind (`raw`) and whether it left the treasury (`out`), beside the `kind` an older client reads (mutants: the kind, the way)', async () => {
  const s = await guildService();
  const line = (src, dst, kind, amount, rid) => s.raw.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?, 'test', 'Aldric', ?)`).run(src[0], src[1], dst[0], dst[1], kind, amount, T0, rid);
  line(['mint', null], ['guild', s.gid], 'guild-deed', 100, 'r-deed');
  line(['guild', s.gid], ['burn', null], 'tribute', 40, 'r-trib');
  const mine = await s.call('/v1/guilds/mine', { character: s.gm.character }, s.gm.secret);
  assert.equal(mine.status, 200, JSON.stringify(mine.body));
  const lines = mine.body.guild.marksLedger.map((l) => [l.raw, l.out, l.kind, l.amount]);
  assert.deepEqual(lines.sort(), [['guild-deed', false, 'deed', 100], ['tribute', true, 'deposit', 40]].sort(), 'the Tribute left the treasury - its old `kind` still "deposit" for an older client');
  assert.equal(guildSilverLineText(mine.body.guild.marksLedger.find((l) => l.raw === 'tribute')), 'Aldric paid Tribute of 40 silver');   // PIN MOVED: AUDIT GUILD3 W2 - a Tribute's `who` is its payer's name
});

// ─── GUILD3c: EVERY RULE BEFORE THE PRESS ───────────────────────────

test('GUILD3c what each rank may do: every power of the four tables worded, each line\'s ranks read off its own table; a rank said on top of the one below it; a Member the same as a Recruit (mutants: a table\'s ranks, a power unworded)', () => {
  const tables = { guild: GUILD_POWERS, hall: HALL_POWERS, writ: WRIT_POWERS, seat: SEAT_POWERS };
  for (const [name, table] of Object.entries(tables)) {
    for (const power of Object.keys(table)) {
      const row = GUILD_RANK_ACTS.find((r) => r.table === name && r.power === power);
      assert.ok(row, `${name}.${power} is worded`);
      assert.deepEqual(guildActRanks(row), [...table[power]], `${name}.${power} reads its own table`);
    }
  }
  assert.ok(GUILD_RANK_ACTS.some((r) => r.table === 'levers'), 'the seat\'s levers');
  // PIN MOVED: AUDIT GUILD3 W3/W4/C4/C5/C7 - what a rank may NOT do is said (an Officer fills no writ of its own guild's,
  // is paid by none of its contracts); the guildmaster's acts by rank alone and the town board's call worded; the writ budget
  // the Officers'; the vault its own line; a rank named as its guild wrote it, never with an article guessed
  assert.deepEqual(guildRankActsOf(3), ['put gold and silver into the treasuries', 'put pieces into the vault', 'pin notes on the guild\'s board',
    'put materials into the guild Stores, and take their own back out', 'fill the guild\'s own writs for their pay', 'be paid by the guild\'s own contracts']);
  assert.deepEqual(guildRankLines().map((l) => [l.name, l.text]), [
    ['Guildmaster', 'Everything the Officer may, and: take pieces out of the vault, any number; take gold and silver out of the treasuries; set the Officers\' weekly silver budget for guild writs and contracts; withdraw any guild writ or contract; pay Tribute at the seat the guild pledged; hire Sellswords for the guild\'s battles; give a held Charter up; buy and sell the hall; choose the guild\'s arms; grant or take back each member\'s use of the vault; rename the ranks; give the guild a new name, for a price; hand the guild on; disband it.'],
    ['Officer', 'Everything the Member may except fill the guild\'s own writs for their pay or be paid by the guild\'s own contracts, and: take pieces out of the vault, 10 a day; invite new members, and pin the guild\'s call for them on a town\'s Notice Board; promote and demote the ranks below their own; remove a member of a lower rank; choose who may enter the hall; decorate the hall, its yard and its outside; take down anyone\'s note on the guild\'s board; post guild writs and contracts (Officers within the weekly budget the guildmaster sets) and withdraw the ones they posted; take any materials out of the guild Stores; pledge the guild to a seat in the Muster; run a held seat: its Tithe, Edict, battle window, Works, fealty and Pacts.'],
    ['Member', 'The same as the Recruit.'],
    ['Recruit', 'Put gold and silver into the treasuries; put pieces into the vault; pin notes on the guild\'s board; put materials into the guild Stores, and take their own back out; fill the guild\'s own writs for their pay; be paid by the guild\'s own contracts.'],
  ]);
  assert.deepEqual(guildRankLines(['Captain', 'The Unsworn', 'Honoured Blade', 'Unit']).map((l) => l.text.split(':')[0]),
    ['Everything The Unsworn may, and', 'Everything the Honoured Blade may except fill the guild\'s own writs for their pay or be paid by the guild\'s own contracts, and', 'The same as the Unit.', 'Put gold and silver into the treasuries; put pieces into the vault; pin notes on the guild\'s board; put materials into the guild Stores, and take their own back out; fill the guild\'s own writs for their pay; be paid by the guild\'s own contracts.'],
    'the guild\'s own names, as written');
  assert.equal(GUILD_RANK_ACTS_NOTE, 'The guildmaster can grant or remove each member\'s vault access on this page.');
});

test('GUILD3c everything that holds a guild that would go: the page\'s own (gold, the hall, the vault; others still in it for a leave) and the service\'s last word, less what the page sees cleared since - each in the refusal\'s sentence (mutants: each known reason, the clearing)', () => {
  const v = (o = {}) => ({ id: 'g1', treasury: 0, hall: null, vault: { used: 0 }, members: [{}], ...o });
  assert.deepEqual(guildKeepsOf(v(), null), []);
  assert.deepEqual(guildKeepsOf(v({ treasury: 5, hall: { region: 1 }, vault: { used: 2 } }), null), ['guild-treasury', 'guild-hall', 'guild-vault']);
  // PIN MOVED: AUDIT GUILD3 C10/T15 - the leave's hand-over, which the page never asked here, gone: the Leave button says it
  assert.deepEqual(guildKeepsOf(v({ members: [{}, {}] }), ['guild-master-leaves']), []);
  assert.deepEqual(guildKeepsOf(v({ members: [{}, {}] }), null), [], 'a disbanding asks no one to leave');
  assert.deepEqual(guildKeepsOf(v({ treasury: 5 }), ['guild-stores', 'guild-treasury', 'guild-seat', 'guild-hall']), ['guild-stores', 'guild-treasury', 'guild-seat'],
    'the service\'s order; its hall since sold, cleared');
  for (const k of ['guild-master-leaves', 'guild-treasury', 'guild-stores', 'guild-writs', 'guild-writ-escrow', 'guild-contracts', 'guild-hall', 'guild-vault', 'guild-seat', 'guild-battle', 'guild-patron', 'marks-full']) {
    assert.equal(typeof REFUSALS[k], 'string', `${k} has its sentence`);
  }
});

test('GUILD3c the service names EVERYTHING that holds a guild that would go - its first the error as ever, the whole list its `keeps` - and the door and the book carry it (mutants: one reason dropped, the list, the route, the door, the book)', async () => {
  const s = await guildService();
  s.raw.prepare("UPDATE guilds SET treasury = 500, moved_by = 'seed', moved_at = ? WHERE id = ?").run(T0, s.gid);
  s.raw.prepare("INSERT INTO guild_prof_stores (guild_id, material, dep_player, dep_char, qty, moved_by, moved_at) VALUES (?, 'iron', '', '', 3, 'seed', ?)").run(s.gid, T0);
  s.raw.prepare("INSERT INTO guild_vault (guild_id, slot, rec, name, count, dep_player, dep_char, dep_name, at) VALUES (?, 0, '{}', 'Arrow', 1, 'p', 'c', 'Aldric', ?)").run(s.gid, T0);
  const r = await s.call('/v1/guilds/disband', { character: s.gm.character }, s.gm.secret);
  assert.equal(r.status >= 400, true);
  assert.deepEqual(r.body, { error: 'guild-treasury', keeps: ['guild-treasury', 'guild-stores', 'guild-vault'] });
  const leave = await s.call('/v1/guilds/leave', { character: s.gm.character }, s.gm.secret);
  assert.deepEqual(leave.body, { error: 'guild-treasury', keeps: ['guild-treasury', 'guild-stores', 'guild-vault'] }, 'a lone guildmaster\'s leave the same');
  // and BEFORE the press: the guildmaster's view carries the same list (one read, guildHolds); a member's carries none
  assert.deepEqual((await s.call('/v1/guilds/mine', { character: s.gm.character }, s.gm.secret)).body.guild.keeps, ['guild-treasury', 'guild-stores', 'guild-vault']);
  const bryn = await s.registered('Bryn');
  const B = await seatRealm(s.env, bryn.secret, 'Bryn');
  assert.equal((await s.call('/v1/guilds/invite', { character: s.gm.character, handle: 'Bryn' }, s.gm.secret)).status, 200);
  assert.equal((await s.call('/v1/guilds/answer', { character: B.id, guild: s.gid, accept: true }, bryn.secret)).status, 200);
  assert.equal('keeps' in (await s.call('/v1/guilds/mine', { character: B.id }, bryn.secret)).body.guild, false, 'a member is asked nothing of the guild\'s going');
  s.raw.prepare("UPDATE guilds SET treasury = 0, moved_by = 'seed', moved_at = ? WHERE id = ?").run(T0, s.gid);
  s.raw.prepare('DELETE FROM guild_prof_stores WHERE guild_id = ?').run(s.gid);
  s.raw.prepare('DELETE FROM guild_vault WHERE guild_id = ?').run(s.gid);
  assert.deepEqual((await s.call('/v1/guilds/mine', { character: s.gm.character }, s.gm.secret)).body.guild.keeps, [], 'nothing holds it');
  // the seats' and the patrons' holds through the same read: a Charter, a battle still to come, a patron's open bid
  s.raw.prepare("INSERT INTO town_seat_holds (key, guild_id, region, tier, since_week, at) VALUES (900, ?, 21, 'palace', 0, ?)").run(s.gid, T0);
  s.raw.prepare("INSERT INTO guilds (id, name, name_key, tag, ranks, treasury, founded_at) VALUES ('gother', 'The Other', 'the other', 'OTH', '[]', 0, 1)").run();
  s.raw.prepare("INSERT INTO town_seat_rights (week, key, kind, guild_id, against, at) VALUES (5, 901, 'siege', 'gother', ?, ?)").run(s.gid, T0);
  s.raw.prepare("INSERT INTO npc_chapter_patron_bids (faction, region, season, guild_id, amount, at) VALUES (41, 21, 3, ?, 1000, ?)").run(s.gid, T0);
  assert.deepEqual((await s.call('/v1/guilds/mine', { character: s.gm.character }, s.gm.secret)).body.guild.keeps, ['guild-seat', 'guild-battle', 'guild-patron'],
    'a battle it is named in, as the attacked side too');
  // the door: the list carried, strings alone, bounded
  const door = accountGuilds({
    fetch: async () => ({ ok: false, status: 409, json: async () => ({ error: 'guild-treasury', keeps: ['guild-treasury', 7, 'guild-vault'] }) }),
    storage: { getItem: () => JSON.stringify({ id: 'a', secret: 's'.repeat(43) }), setItem() {}, removeItem() {} },
  });
  const d = await door.disband('rabc');
  assert.deepEqual([d.error, d.keeps], ['guild-treasury', ['guild-treasury', 'guild-vault']]);
  // the book: kept on the refusal
  const book = new GuildBook({ door: { mine: async () => ({ ok: true, data: { guild: null } }), invites: async () => ({ ok: true, data: { invites: [] } }),
    disband: async () => ({ ok: false, error: 'guild-hall', keeps: ['guild-hall', 'guild-seat'] }) }, character: () => 'rabc', wallet: () => ({}) });
  assert.deepEqual(await book.disband(), { ok: false, error: 'guild-hall', keeps: ['guild-hall', 'guild-seat'] });
  assert.match(src('server-account/src/index.js'), /if \(Array\.isArray\(r\.keeps\)\) return json\(\{ error: r\.error, keeps: r\.keeps \}/);
});

// ─── THE TAB ────────────────────────────────────────────────────────

function fakeNode(tag, doc) {
  const n = {
    tagName: tag.toUpperCase(), children: [], parent: null, className: '', textContent: '', id: '', value: '', disabled: false, open: false,
    style: {}, dataset: {}, attrs: {}, listeners: new Map(),
    append(...cs) { for (const c of cs) { if (typeof c === 'object') { c.parent = n; n.children.push(c); } } },
    replaceChildren(...cs) { n.children = []; n.append(...cs); },
    setAttribute(k, v) { n.attrs[k] = v; }, getAttribute(k) { return n.attrs[k]; },
    addEventListener(t, fn) { if (!n.listeners.has(t)) n.listeners.set(t, []); n.listeners.get(t).push(fn); },
    removeEventListener() {},
    fire(t, e = {}) { const ev = { type: t, target: n, preventDefault() {}, stopPropagation() {}, ...e }; for (const fn of n.listeners.get(t) ?? []) fn(ev); return ev; },
    focus() { doc.activeElement = n; }, remove() {},
  };
  return n;
}
function fakeDocument() {
  const doc = { activeElement: null };
  doc.createElement = (tag) => fakeNode(tag, doc);
  doc.head = fakeNode('head', doc); doc.body = fakeNode('body', doc);
  doc.getElementById = () => null;
  return doc;
}
const find = (n, cls, out = []) => { if (String(n.className).split(/\s+/).includes(cls)) out.push(n); for (const c of n.children) find(c, cls, out); return out; };
const texts = (n) => [n.textContent, ...n.children.flatMap(texts)].filter(Boolean);
const btn = (root, label) => find(root, 'dfsocial-btn').find((b) => b.textContent === label || b.children[0]?.textContent === label);
const view = (over = {}) => ({
  id: 'g0123456789', name: 'The Hand', tag: 'HND', ranks: [...GUILD_RANK_NAMES], treasury: 30_000, hallGold: 12_000, foundedAt: 1, rank: 0,
  members: [{ member: 'm1', name: 'Aldric', rank: 0, joinedAt: 1, you: true, vault: { level: 'withdraw', limit: 0, granted: false } }],
  invites: [], ledger: [], hall: null, heraldry: null, renamedAt: null, renameAt: null, vault: { used: 0, max: 50, me: { level: 'withdraw', limit: 0, granted: false, taken: 0 } }, ...over,
});
async function tab(guild, page = null, door = {}) {
  const book = new GuildBook({ door: { mine: async () => ({ ok: true, data: { guild } }), invites: async () => ({ ok: true, data: { invites: [] } }), ...door },
    character: () => 'rabc', wallet: () => ({ gold: () => 0, pay() {}, credit() {} }) });
  const doc = fakeDocument();
  const panel = createSocialPanel({ social: new SocialState({ acct: 'a' }), guild: book, doc, win: { addEventListener() {}, removeEventListener() {} }, overlay: () => false, touch: false });
  const go = async (p) => { panel.openGuild(p); for (let i = 0; i < 4; i++) { await tick(); panel.render(); } };
  await go(page);
  return { panel, go, book };
}

test('GUILD3c the tab: a guild in one look for a character in none; where the rest is run on the Overview; the treasury\'s two golds at the Treasury\'s top; what each rank may do folded on the Members page, in the guild\'s own names (mutants: each line)', async () => {
  const none = await tab(null);
  const said = texts(none.panel.root);
  for (const line of GUILD_PRIMER_LINES) assert.ok(said.includes(line), line);
  const t = await tab(view({ ranks: ['Captain', 'Adept', 'Initiate', 'Novice'] }));
  assert.ok(texts(t.panel.root).includes(GUILD_ELSEWHERE_TEXT));
  await t.go('treasury');
  // PIN MOVED: AUDIT GUILD3 W15 - the rename's own words, a new name or tag; C10 - a guild with its hall, the name alone
  assert.ok(texts(t.panel.root).includes('12,000 of the treasury\'s 30,000 gold was put in by realm characters and can buy a hall, or a new name or tag. Gold in a bank account cannot.'));
  assert.equal(guildRealmGoldText(12_000, 30_000, true), '12,000 of the treasury\'s 30,000 gold was put in by realm characters and can pay for a new name or tag. Gold in a bank account cannot.');
  assert.equal(guildRealmGoldText(undefined, 1), null, 'an older service: nothing said');
  await t.go('members');
  const ranks = find(t.panel.root, 'dfsocial-ranks')[0];
  assert.ok(ranks, 'the list');
  assert.equal(ranks.tagName, 'DETAILS');
  const lines = ranks.children.filter((c) => c.tagName === 'P').map((p) => texts(p).join(''));
  assert.deepEqual(lines.slice(0, 4).map((l) => l.split(':')[0]), ['Captain', 'Adept', 'Initiate', 'Novice']);
  assert.equal(lines[2], 'Initiate: The same as the Novice.');   // PIN MOVED: AUDIT GUILD3 C7 - no article guessed
  assert.equal(lines[4], GUILD_RANK_ACTS_NOTE);
});

test('GUILD3c the Settings page says, before the press, everything that holds the guild - its own at once, the service\'s whole list after a refusal, cleared as the page sees it cleared (mutants: the list, the press\'s keeping)', async () => {
  const t = await tab(view({ treasury: 0, hallGold: 0, hall: { region: 1 }, vault: { used: 1, max: 100, me: { level: 'withdraw', limit: 0 } } }), 'settings',
    { disband: async () => ({ ok: false, error: 'guild-hall', keeps: ['guild-hall', 'guild-vault', 'guild-seat', 'guild-writs'] }), leave: async () => ({ ok: false }) });
  const before = texts(t.panel.root);
  assert.ok(before.includes(`${GUILD_KEEPS_HEAD}:`));
  assert.deepEqual(find(t.panel.root, 'dfsocial-keeps')[0].children.map((li) => li.textContent), [accountRefusalText('guild-hall'), accountRefusalText('guild-vault')]);
  // the hall held back the button: the press is the service's word on the rest - asked here through the book's own door
  const r = await t.book.disband();
  assert.deepEqual(r.keeps, ['guild-hall', 'guild-vault', 'guild-seat', 'guild-writs']);
  assert.match(src('src/ui/socialPanel.js'), /guildDo\(keptBy\(g\.disband\(\)\), 'The guild is disbanded\.'\)/);
  assert.match(src('src/ui/socialPanel.js'), /guildDo\(keptBy\(g\.leave\(\)\), 'You left the guild\.'\)/);
  // the press: a guild whose own knowns are clear, refused for what the page cannot see - the whole list said after it
  const calls = [];
  const clear = await tab(view({ treasury: 0, hallGold: 0, members: [{ member: 'm1', name: 'Aldric', rank: 0, you: true }, { member: 'm2', name: 'Bryn', rank: 2 }] }), 'settings',
    { disband: async (c) => { calls.push(c); return { ok: false, error: 'guild-seat', keeps: ['guild-seat', 'guild-writs', 'guild-master-leaves'] }; } });
  assert.equal(find(clear.panel.root, 'dfsocial-keeps').length, 0, 'nothing the page can see holds it - and a guildmaster with members is asked no hand-over to disband');
  btn(clear.panel.root, 'Disband').fire('click');
  clear.panel.render();
  btn(clear.panel.root, 'Sure?').fire('click');
  for (let i = 0; i < 4; i++) { await tick(); clear.panel.render(); }
  assert.deepEqual(calls, ['rabc']);
  assert.deepEqual(find(clear.panel.root, 'dfsocial-keeps')[0]?.children.map((li) => li.textContent), [accountRefusalText('guild-seat'), accountRefusalText('guild-writs')],
    'the service\'s whole list - its hand-over left to the Leave button');
  // the view's own list (a guildmaster's, the service's guildHolds): said before any press, the buttons waiting on it
  const viewed = await tab(view({ treasury: 0, hallGold: 0, keeps: ['guild-seat', 'guild-patron'] }), 'settings');
  assert.deepEqual(find(viewed.panel.root, 'dfsocial-keeps')[0]?.children.map((li) => li.textContent), [accountRefusalText('guild-seat'), accountRefusalText('guild-patron')]);
  assert.equal(btn(viewed.panel.root, 'Disband').disabled, true);
  assert.ok(texts(btn(viewed.panel.root, 'Disband')).includes('clear the list above first'));
  assert.equal(btn(viewed.panel.root, 'Leave').disabled, true, 'a lone guildmaster leaves only a guild that can go');
  // PIN MOVED: AUDIT GUILD3 S3 - the view reads the silver's room too now: its word stands for it; a code it reads not stays
  assert.deepEqual(guildKeepsOf(view({ treasury: 0, keeps: [] }), ['guild-writs', 'marks-full', 'guild-some-new-hold']), ['guild-some-new-hold'], 'the view\'s word stands for what it reads; a refusal\'s other word stays');
  const officer = await tab(view({ rank: 1, treasury: 9 }), 'settings');
  assert.equal(find(officer.panel.root, 'dfsocial-keeps').length, 0, 'an Officer is asked nothing of the guild\'s going');
});

// ─── GUILD3d: THE CHAPTER'S CARD ────────────────────────────────────

test('GUILD3d what a band does, in words off the bands and off what the guild\'s hall sells - training where it trains, spells at the Mages Guild and Kynareth\'s, a shelf where it keeps one, writs everywhere; a hidden guild\'s its writs alone; an Ascendant chapter\'s Master its High Master (mutants: each part)', () => {
  // PIN MOVED: AUDIT GUILD3 L4 - Steady's line the usual of what the hall HAS (the Fighters keep no shelf); R1 - a Failing
  // chapter's fall said; L5/W8 - the High Master a rule of the band
  // PIN MOVED: AUDIT GUILD3 W12 - the chapter's writs (a Court's move by no band); the card's lines sentences, each
  assert.equal(chapterBandEffectsLine(50, FIGHTERS), 'Its halls keep their usual prices and chapter writs.');
  assert.equal(chapterBandEffectsLine(50, MAGES), 'Its halls keep their usual prices, shelf and chapter writs.');
  assert.equal(chapterBandEffectsLine(50, DRAGON), 'Its halls keep their usual chapter writs.');
  assert.equal(chapterBandEffectsLine(10, MAGES), 'Training and spells a quarter dearer, a poorer shelf, half the chapter writs - and it loses 2 Strength more each week its members\' Merit lifts it by less than 2.');
  assert.equal(chapterBandEffectsLine(75, MAGES), 'Training and spells a tenth cheaper, a richer shelf, half again the chapter writs.');
  assert.equal(chapterBandEffectsLine(95, MAGES), 'Training and spells a fifth cheaper, a richer shelf, half again the chapter writs - and whoever holds its Master\'s chair is its High Master.');
  assert.equal(chapterBandEffectsLine(75, FIGHTERS), 'Training a tenth cheaper, half again the chapter writs.', 'the Fighters Guild keeps no shelf, sells no spell');
  assert.equal(chapterBandEffectsLine(75, KYNARETH), 'Training and spells a tenth cheaper, half again the chapter writs.');
  assert.equal(chapterBandEffectsLine(75, ARKAY), 'Training a tenth cheaper, a richer shelf, half again the chapter writs.');
  assert.equal(chapterBandEffectsLine(95, DRAGON), 'Half again the chapter writs - and whoever holds its Master\'s chair is its High Master.', 'an order trains nothing, keeps no shelf');
  assert.equal(chapterBandEffectsLine(95, THIEVES), 'Half again the chapter writs.', 'a hidden guild: its hall DFU\'s own; no title');
  assert.deepEqual(chapterDoctrinesFor(DRAGON), ['writs']);
});

test('GUILD3d a chapter\'s Duties: what its guild asks of its members in the region and what each earns, the reader\'s first of each today; to a stranger its members\'; none for the Thieves Guild (mutants: the words, the state)', () => {
  const asks = [{ faction: FIGHTERS, kind: 'gate', member: true, done: true }, { faction: FIGHTERS, kind: 'raid', member: true, done: false }];
  // PIN MOVED: AUDIT GUILD3 L2 - a member is promised Merit where its Merit row says it earns some
  assert.equal(chapterDutiesLine(FIGHTERS, asks, { merit: 10, max: 600 }), 'Duties here: hold a gate (done today), defend a raided town - standing each time, more for the day\'s first of each, and Merit.');
  assert.equal(chapterDutiesLine(FIGHTERS, []), 'Its members\' duties here: hold a gate, defend a raided town - standing each time, more for the day\'s first of each, and Merit.');
  assert.equal(chapterDutiesLine(MAGES, [{ faction: MAGES, kind: 'gate', member: false, done: true }]), 'Its members\' duties here: hold a gate - standing each time, more for the day\'s first of it, and Merit.', 'a stranger is told no state');
  assert.equal(chapterDutiesLine(THIEVES, []), null);
  assert.deepEqual(hallReceiptKindsOf(BROTHERHOOD), ['gate', 'raid']);
});

/** The board's Work tab over `data`. */
async function board(data, work = {}) {
  const book = { state: { open: true, writs: { today: 0, max: 3 } }, held: () => 9,
    writs: async () => ({ data: { writs: [], receipts: [], merit: [], chapters: [], today: { filled: 0, max: 3 }, ...data }, error: null, stale: false }),
    deliver: async () => ({ ok: false }) };
  const notices = { seenAt: () => null, read: async () => ({ board: { notes: [], notices: [], me: {} } }), markSeen() {}, cached: () => null, draft: () => ({ subject: '', body: '', days: 7, button: '' }), noticeDraft: () => ({ subject: '', body: '', days: 3 }) };
  const host = document.createElement('div');
  mountNoticeBoard(host, { town: { name: 'Anticlere', mapId: 5 }, book: notices,
    work: { book, region: ANTICLERE, regionName: 'Anticlere', countName: (k, n) => materialCountLabel(k, n), back: async () => ({ ok: true }), ...work } });
  await tick();
  byClass(host, 'notice-tab')[1].click();
  for (let i = 0; i < 3; i++) await tick();
  return host;
}

test('GUILD3d the board draws each chapter as one card under its guild\'s name and band - its Strength, what the band does, the reader\'s Merit there, its Season and sides, its Duties; the receipts\' asks are no cards; the writ cards say "Chapter writ" and "Your chapter writ" (mutants: the card, each line, the kinds)', async () => {
  const host = await board({
    chapters: [{ faction: FIGHTERS, strength: 75, band: 'thriving', event: 'rivalry', season: 3, rival: THIEVES }, { faction: MAGES, strength: 10, band: 'failing' }],
    merit: [{ faction: FIGHTERS, merit: 150, max: 600, elsewhere: false, from: null }, { faction: BROTHERHOOD, merit: 50, max: 600, elsewhere: false, from: null }],
    receipts: [{ faction: FIGHTERS, kind: 'gate', member: true, done: true }, { faction: FIGHTERS, kind: 'raid', member: true, done: false }, { faction: MAGES, kind: 'gate', member: false, done: false }],
    writs: [
      { id: 'h:1', kind: 'hall', faction: FIGHTERS, material: 'iron', qty: 3, pay: 20, renown: 5, state: 'open', expiresAt: T0 },
      { id: 'm:1', kind: 'member', faction: FIGHTERS, material: 'iron', qty: 2, pay: 12, renown: 3, state: 'open', expiresAt: T0 },
      { id: 'c:1', kind: 'court', material: 'iron', qty: 4, pay: 30, renown: 6, state: 'open', expiresAt: T0 },
    ],
  });
  const cards = byClass(host, 'notice-chapter-card');
  assert.equal(cards.length, 2, 'one a chapter');
  const card = (i) => [...cards[i].querySelectorAll('h3, p')].map((n) => n.textContent);
  assert.deepEqual(card(0), [
    'Fighters Guild - Thriving',
    'The chapter of the Fighters Guild here is Thriving (Strength 75).',
    'Training a tenth cheaper, half again the chapter writs.',
    'Merit with the Fighters Guild here this week: 150 of 600.',
    'The chapter races a rival in the shadows for Merit this Season.',   // a hidden rival, never named on a board
    'Duties here: hold a gate (done today), defend a raided town - standing each time, more for the day\'s first of each, and Merit.',
  ]);
  assert.deepEqual(card(1), [
    'Mages Guild - Failing', 'The chapter of the Mages Guild here is Failing (Strength 10).',
    'Training and spells a quarter dearer, a poorer shelf, half the chapter writs - and it loses 2 Strength more each week its members\' Merit lifts it by less than 2.',   // PIN MOVED: AUDIT GUILD3 R1
    'Its members\' duties here: hold a gate - standing each time, more for the day\'s first of it, and Merit.',
  ]);
  const inCard = (n) => { for (let x = n.parentNode; x; x = x.parentNode) if (String(x.className).split(/\s+/).includes('notice-chapter-card')) return true; return false; };
  const loose = byClass(host, 'notice-merit').filter((p) => !inCard(p)).map((p) => p.textContent);
  assert.deepEqual(loose, ['Merit with the Dark Brotherhood here this week: 50 of 600'], 'a Merit line with no card stands above them');
  const kinds = byClass(host, 'writ-kind').map((n) => n.textContent);
  assert.deepEqual(kinds, ['Chapter writ', 'Your chapter writ', 'Court writ'], 'three writs, three cards - no receipt\'s ask among them');
});

// ─── GUILD3e: FIVE EVENTS, THE ASCENDANT BAND ITS OWN ───────────────

test('GUILD3e five Season events - Calm, Schism, Succession, Crackdown, Rivalry - the Decline and the Ascendancy folded into the bands they repeated; the weights move as section 7 says, an Ascendant chapter\'s Succession still (mutants: the list, the weights)', () => {
  assert.deepEqual(CHAPTER_EVENTS.map((e) => [e.id, e.weight]), [['calm', 30], ['schism', 15], ['succession', 10], ['crackdown', 10], ['rivalry', 15]]);
  assert.deepEqual([chapterEventOk('decline'), chapterEventOk('ascendancy'), chapterEventOk('rivalry')], [false, false, true]);
  assert.equal('declineAfter' in chapterLaw, false, 'the Decline\'s week is gone');
  for (const k of ['declineFailing', 'declineFall', 'declineMeets', 'ascendancyAscendant', 'ascendancyPrice']) assert.equal(k in CHAPTER_EVENT_EFFECTS, false, k);
  assert.deepEqual(chapterEventWeights({ faction: MAGES, band: 'steady', rivalBand: 'steady' }), [30, 15, 10, 10, 15]);
  assert.deepEqual(chapterEventWeights({ faction: MAGES, band: 'ascendant', rivalBand: 'steady' }), [30, 15, 20, 10, 15], 'an Ascendant chapter\'s Succession +10');
  assert.deepEqual(chapterEventWeights({ faction: MAGES, band: 'failing', rivalBand: 'steady' }), [30, 15, 10, 10, 15], 'a Failing chapter draws as any - its band says it');
  assert.deepEqual(chapterSeasonLines(MAGES, ANTICLERE, { event: 'decline', season: 3 }), [], 'a retired event a sheet still carries says nothing');
  // the Chronicle keeps its words for a row written before: history
  assert.match(chapterSeasonLine({ kind: 'event', faction: FIGHTERS, data: { season: 2, event: 'ascendancy' } }), /the Fighters Guild stood ascendant\.$/);
  assert.match(chapterSeasonLine({ kind: 'event', faction: FIGHTERS, data: { season: 2, event: 'decline', fell: 4 } }), /decline cost it 4 Strength\.$/);
  // and the town's talk of them is the bands' now
  assert.equal('decline' in CHAPTER_EVENT_NEWS || 'ascendancy' in CHAPTER_EVENT_NEWS, false);
  assert.ok(CHAPTER_NEWS.failing.some((l) => l[0].includes('in decline')));
  assert.ok(CHAPTER_NEWS.ascendant.some((l) => l[0].includes('in its ascendancy')));
  // the service asks the Decline no more
  assert.doesNotMatch(src('server-account/src/npcChapters.js'), /declineAfter|live\(c\) === 'decline'|event = 'ascendancy'/);
});

test('GUILD3e the Ascendant band is its own: a fifth off training and spells, from 90; a patron\'s members pay the better of the band and Thriving\'s - never more than a stranger at an Ascendant hall (mutants: the price, the floor, the better)', () => {
  assert.deepEqual(CHAPTER_BANDS.map((b) => [b.band, b.from, b.price]), [['failing', 0, 1.25], ['steady', 20, 1], ['thriving', 70, 0.9], ['ascendant', 90, 0.8]]);
  assert.equal(CHAPTER_ASCENDANT_FROM, 90);
  assert.deepEqual([chapterBandOf(89).band, chapterBandOf(90).band], ['thriving', 'ascendant']);
  assert.equal(chapterPriceFactor(95), 0.8);
  const G = 'gabcdefghij';
  const at = (strength, o = {}) => ({ strength, patron: { id: G, name: 'Grey Lanterns', tag: 'GLN' }, ...o });
  assert.equal(chapterHallFactor(at(95), 'spells', G), 0.8, 'a patron at an Ascendant hall: the Ascendant fifth');
  assert.equal(chapterHallFactor(at(95), 'spells', null), 0.8, 'a stranger the same');
  assert.equal(chapterHallFactor(at(10), 'spells', G), CHAPTER_PATRON_PRICE, 'a patron at a Failing hall: Thriving\'s');
  assert.equal(chapterHallFactor(at(10), 'spells', null), 1.25);
  assert.equal(chapterHallFactor(at(95, { doctrine: 'training', season: 3, event: 'calm' }), 'training', G), 0.8 * 0.9, 'the doctrine\'s tenth on top');
  assert.equal(chapterHallFactor(at(95, { event: 'ascendancy', season: 3 }), 'spells', null), 0.8, 'a retired Ascendancy on a sheet adds nothing');
});
