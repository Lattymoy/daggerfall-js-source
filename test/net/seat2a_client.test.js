// SEAT2a (2026-10-01, Mac: "Finish the seats"; "Or we could go ahead and do sieges"; "Continue"): THE BATTLES' WEEK, THE
// LAW AND THE CLIENT - the holder's window and its bounds, when a window opens in a seat week, the crown's slots, the
// schedule (key order, the clash, the two-hour move, the unplaced), the sides' caps and the rosters' close, the board's
// words; the Seat tab's battle panel (the announcement, each side, the reader's sign and unsign, a Guildmaster's
// Sellswords) and the holder's window lever; the seat book's calls. bible/11-Multiplayer/Seats-Arc.md 6.3-6.5;
// `06-Systems/Online-Arc.md` SEAT2a.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { byClass } from '../chargenDom.mjs';
import {
  SIEGE_WINDOW_DAYS, SIEGE_WINDOW_HOURS, SIEGE_WINDOW_DEFAULT, siegeWindowOk, siegeStartMs, seatWeekStartMs, CROWN_SIEGE_SLOT, BATTLE_LENGTH_MS,
  battleLengthMs, BATTLE_BLOCK_MS, battleSpanMs, battlePreferredMs, battleStarts, placeBattles, SIEGE_SIDE_MAX, SELLSWORDS_MAX, SIGN_CLOSES_MS,
  signOpen, SELLSWORD_COOL_WEEKS, SELLSWORD_FEE_MAX, sellswordFeeOk, sideOf, battleWhenText, siegeWindowText, battleAnnouncement, sideLine, SIGN_WHY,
  chronicleLine,
} from '../../src/net/townSeatLaw.js';
import { accountRefusalText } from '../../src/net/accountClient.js';
import { mountNoticeBoard } from '../../src/ui/noticeWindow.js';

const H = 3600_000;
const WK = 5;
const ANTICLERE = { key: 3021, name: 'Anticlere', region: 21, tier: 'palace', pixel: [402, 151] };

test('SEAT2a THE WINDOW AND ITS WEEK: Wednesday to Saturday, 16:00 to 02:00 (a start after midnight the night after its day); the earliest exactly 70 hours after the Turning, the latest ending Sunday 04:00; Wednesday 20:00 the default; the crowns\' Saturday slots an hour apart; the lengths (mutants: the days; the hours; the night after; the offset; the default; the slots; the lengths)', () => {
  assert.deepEqual([...SIEGE_WINDOW_DAYS], ['Wednesday', 'Thursday', 'Friday', 'Saturday']);
  assert.deepEqual([...SIEGE_WINDOW_HOURS], [16, 17, 18, 19, 20, 21, 22, 23, 0, 1, 2]);
  assert.deepEqual(SIEGE_WINDOW_DEFAULT, { day: 0, hour: 20 });
  for (const [d, h, ok] of [[0, 16, true], [3, 2, true], [0, 0, true], [4, 20, false], [-1, 20, false], [0, 3, false], [0, 15, false], [1.5, 20, false], [0, 20.5, false]]) assert.equal(siegeWindowOk(d, h), ok, `${d} ${h}`);
  const turning = seatWeekStartMs(WK);
  assert.equal(siegeStartMs(WK, 0, 16) - turning, 70 * H, 'Wednesday 16:00: 70 hours after the Turning');
  assert.equal(new Date(siegeStartMs(WK, 0, 16)).getUTCDay(), 3);
  assert.equal(siegeStartMs(WK, 0, 1) - siegeStartMs(WK, 0, 23), 2 * H, '"Wednesday 01:00" is Thursday 01:00');
  assert.equal(new Date(siegeStartMs(WK, 3, 2) + BATTLE_BLOCK_MS).getUTCHours(), 4, 'the latest ends Sunday 04:00');
  assert.equal(new Date(siegeStartMs(WK, 3, 2)).getUTCDay(), 0);
  assert.deepEqual([CROWN_SIEGE_SLOT.daggerfall, CROWN_SIEGE_SLOT.wayrest, CROWN_SIEGE_SLOT.sentinel], [{ day: 3, hour: 20 }, { day: 3, hour: 21 }, { day: 3, hour: 22 }]);
  assert.deepEqual([BATTLE_LENGTH_MS.palace, BATTLE_LENGTH_MS.crown, BATTLE_LENGTH_MS.tourney], [30 * 60_000, 45 * 60_000, 20 * 60_000]);
  assert.deepEqual([battleLengthMs({ kind: 'siege', tier: 'crown' }), battleLengthMs({ kind: 'tourney', tier: 'crown' }), battleLengthMs({ kind: 'siege', tier: 'palace' })], [45 * 60_000, 20 * 60_000, 30 * 60_000]);
  assert.deepEqual([battleSpanMs({ kind: 'siege', tier: 'crown' }), battleSpanMs({ kind: 'siege', tier: 'palace' }), battleSpanMs({ kind: 'tourney', tier: 'crown' })], [H, 2 * H, 2 * H]);
  assert.equal(battleStarts(WK).length, 44);
  assert.deepEqual(battleStarts(WK).slice(0, 2), [siegeStartMs(WK, 0, 16), siegeStartMs(WK, 0, 17)]);
  assert.equal(battlePreferredMs(WK, { kind: 'siege', tier: 'crown', kingdom: 'wayrest', window: { day: 0, hour: 16 } }), siegeStartMs(WK, 3, 21), 'a crown at its slot, whatever the window');
  assert.equal(battlePreferredMs(WK, { kind: 'tourney', tier: 'palace', window: { day: 2, hour: 16 } }), siegeStartMs(WK, 0, 20), 'a Tourney at Wednesday 20:00');
  assert.equal(battlePreferredMs(WK, { kind: 'siege', tier: 'palace', window: null }), siegeStartMs(WK, 0, 20), 'a holder with no window: the default');
  assert.equal(battlePreferredMs(WK, { kind: 'siege', tier: 'palace', window: { day: 9, hour: 20 } }), siegeStartMs(WK, 0, 20), 'a window out of bounds: the default');
});

test('SEAT2a THE SCHEDULE: key order; a battle overlapping another of either of its guilds moved two hours on (and on, past the hours no window opens), `moved` said; a crown siege holds its hour alone, so a guild fights two crowns an hour apart; a battle no start of the week can hold is unplaced (mutants: the order; the clash by guild; the span; the step; the allowed hours; the unplaced)', () => {
  const s = (key, attacker, defender, window, o = {}) => ({ key, kind: 'siege', tier: 'palace', attacker, defender, window, ...o });
  const { placed, unplaced } = placeBattles(WK, [s(3034, 'b', 'h', { day: 1, hour: 21 }), s(3021, 'a', 'h', { day: 1, hour: 21 }), s(3050, 'c', 'd', { day: 1, hour: 21 })]);
  assert.deepEqual(placed.map((p) => [p.key, p.startsAt, p.moved]), [
    [3021, siegeStartMs(WK, 1, 21), false], [3034, siegeStartMs(WK, 1, 23), true], [3050, siegeStartMs(WK, 1, 21), false],
  ], 'the holder fights twice: the higher key moved; two other guilds at the same hour untouched');
  assert.equal(placed[0].endsAt - placed[0].startsAt, BATTLE_LENGTH_MS.palace);
  assert.deepEqual(unplaced, []);
  // a move past the hours no window opens: 01:00 then 03:00 (none) ... to 17:00 the next day
  const late = placeBattles(WK, [s(1, 'a', 'h', { day: 0, hour: 1 }), s(2, 'b', 'h', { day: 0, hour: 1 })]).placed;
  assert.deepEqual(late.map((p) => p.startsAt), [siegeStartMs(WK, 0, 1), siegeStartMs(WK, 1, 17)]);
  // a guild holding one crown and challenging another fights both, an hour apart
  const crowns = placeBattles(WK, [s(17, 'x', 'dfh', null, { tier: 'crown', kingdom: 'daggerfall' }), s(23, 'dfh', 'wrh', null, { tier: 'crown', kingdom: 'wayrest' })]).placed;
  assert.deepEqual(crowns.map((p) => [p.startsAt, p.moved]), [[siegeStartMs(WK, 3, 20), false], [siegeStartMs(WK, 3, 21), false]]);
  // the unplaced: a guild with more battles than the week holds
  const many = Array.from({ length: 50 }, (_, i) => s(i + 1, `g${i}`, 'h', { day: 0, hour: 16 }));
  const r = placeBattles(WK, many);
  assert.ok(r.placed.length >= 20 && r.unplaced.length > 0, `${r.placed.length} placed, ${r.unplaced.length} not`);
  assert.equal(new Set(r.placed.map((p) => p.startsAt)).size, r.placed.length, 'never two at once for one guild');
});

test('SEAT2a THE SIDES AND THE WORDS: ten and twenty a side, two and four Sellswords, the rosters closed ten minutes before the start, four weeks\' cooling, a fee to 5,000; the side a guild fights; the board\'s lines - the window, the start, the announcement, a side, the Chronicle\'s two rows - and every roster refusal said in the board\'s words by the account client (mutants: the caps; the close; the fee; the words)', () => {
  assert.deepEqual([SIEGE_SIDE_MAX.palace, SIEGE_SIDE_MAX.crown, SELLSWORDS_MAX.palace, SELLSWORDS_MAX.crown, SIGN_CLOSES_MS, SELLSWORD_COOL_WEEKS, SELLSWORD_FEE_MAX], [10, 20, 2, 4, 600_000, 4, 5000]);
  assert.deepEqual([signOpen(10 * 60_000 + 1, 0), signOpen(10 * 60_000, 0)], [true, false]);
  assert.deepEqual([sellswordFeeOk(0), sellswordFeeOk(5000), sellswordFeeOk(5001), sellswordFeeOk(-1), sellswordFeeOk(1.5)], [true, true, false, false, false]);
  assert.deepEqual([sideOf({ attacker: 'a', defender: 'b' }, 'a'), sideOf({ attacker: 'a', defender: 'b' }, 'b'), sideOf({ attacker: 'a', defender: 'b' }, 'c')], ['attack', 'defend', null]);
  assert.equal(siegeWindowText({ day: 0, hour: 20 }), 'Wednesday 20:00 UTC');
  assert.equal(siegeWindowText({ day: 1, hour: 1 }), 'Thursday 01:00 UTC (the night after)');
  assert.equal(siegeWindowText({ day: 7, hour: 1 }), null);
  assert.equal(battleWhenText(siegeStartMs(WK, 0, 20)), 'Wednesday at 20:00 UTC');
  assert.equal(battleWhenText(siegeStartMs(WK, 0, 1)), 'Thursday at 01:00 UTC');
  const SH = { name: 'The Silver Hand', tag: 'SH' }, EO = { name: 'Ebon Oath', tag: 'EO' };
  assert.equal(battleAnnouncement({ kind: 'siege', startsAt: siegeStartMs(WK, 0, 20), attackerGuild: SH, defenderGuild: EO }, 'Anticlere'),
    'The Silver Hand <SH> has won the Right of Siege at Anticlere. Ebon Oath <EO> holds its Charter. Battle is joined Wednesday at 20:00 UTC.', '6.3\'s announcement (PIN MOVED, CROWN2: the name opening it capitalised)');
  assert.match(battleAnnouncement({ kind: 'tourney', startsAt: siegeStartMs(WK, 0, 20), moved: true, attackerGuild: SH, defenderGuild: EO }, 'Anticlere'), /meet in a Tourney for Anticlere\. Battle is joined Wednesday at 20:00 UTC \(moved, so that no guild fights twice at once\)\./);
  assert.equal(battleAnnouncement(null, 'x'), null);
  assert.equal(sideLine('Attackers', 7, 10, 1), 'Attackers: 7 of 10 signed (1 Sellsword).');
  assert.equal(sideLine('Defenders', 3, 10, 0), 'Defenders: 3 of 10 signed.');
  assert.match(chronicleLine({ kind: 'battle-moved', week: 4, data: { at: siegeStartMs(WK, 1, 23) / 1000 } }, ANTICLERE), /was moved to Thursday at 23:00 UTC, so that no guild fights twice at once\./);
  assert.match(chronicleLine({ kind: 'battle-void', week: 4, data: {} }, ANTICLERE), /no hour of the week could hold the battle for Anticlere; it is void\./);
  for (const [k, v] of Object.entries(SIGN_WHY)) assert.equal(accountRefusalText(k), v, k);
  assert.match(accountRefusalText('bad-fee'), /at most 5,000\./);
});

test('SEAT2a THE SEAT TAB\'S BATTLE: the announcement and both sides\' rosters for everyone; a member of a side not yet signed offered Sign, a signed one told its side and offered its place back, none once the rosters close; a hired account offered Sign as a Sellsword at its fee; the side\'s Guildmaster sees its contracts, withdraws an offered one and hires by name and fee; the holder\'s Officer sets its window (mutants: each offer\'s rule; the calls; the window\'s lever and rank)', async () => {
  const tick = (n = 4) => new Promise((r) => { let i = 0; const go = () => (++i >= n ? r() : setTimeout(go, 0)); setTimeout(go, 0); });
  const noticeBook = { seenAt: () => null, read: async () => ({ board: { notes: [], notices: [], me: {} } }), markSeen: () => {}, cached: () => null, draft: () => ({ subject: '', body: '', days: 7, button: '' }), noticeDraft: () => ({ subject: '', body: '', days: 3 }), readGuild: async () => ({ data: null, error: 'no-guild' }) };
  const now = 1_800_000_000;
  const SH = { id: 'g1', name: 'The Silver Hand', tag: 'SH', heraldry: null }, EO = { id: 'g2', name: 'Ebon Oath', tag: 'EO', heraldry: null };
  // PIN MOVED (AUDIT-SEATS): the standings' fight carries its start and end in SECONDS, as the service sends them
  // (server-account/src/seatBattles.js fightOf: `starts_at`) - the tab now reads them so; the fixture had them in ms
  const fight = (mine, open = true) => ({ week: 6, key: 3021, kind: 'siege', tier: 'palace', startsAt: siegeStartMs(WK, 1, 21) / 1000, endsAt: (siegeStartMs(WK, 1, 21) + 1800_000) / 1000, moved: false, state: 'scheduled',
    attackerGuild: EO, defenderGuild: SH, sides: { attack: { n: 4, swords: 1 }, defend: { n: 2, swords: 0 } }, max: 10, swordsMax: 2, open, window: { day: 1, hour: 21 }, mine });
  const acts = [];
  const mount = (rank, guild, f) => {
    const host = document.createElement('div');
    const data = {
      seat: ANTICLERE, week: 6, phase: 'muster', reckoningAt: now + 3600, turningAt: now + 86400, defence: 4500,
      holder: { guild: SH, since: 3, standing: 55, tithe: 6, edict: null }, battle: { kind: 'siege', guild: EO, against: SH }, standings: [], chronicle: [],
      mine: guild ? { guild, rank, seasoned: true, bound: guild, pledges: [], influence: 0, tributeRoom: 0 } : undefined, fight: f,
    };
    const seatBook = {
      open: true, standings: async () => ({ data, error: null }), pledge: async () => ({ ok: true }), unpledge: async () => ({ ok: true }), tribute: async () => ({ ok: true }),
      sign: async (s) => { acts.push(['sign', s.key]); return { ok: true, text: 'signed' }; },
      unsign: async (s) => { acts.push(['unsign', s.key]); return { ok: true, text: 'unsigned' }; },
      hire: async (s, h, fee) => { acts.push(['hire', s.key, h, fee]); return { ok: true, text: 'hired' }; },
      withdrawHire: async (s, h) => { acts.push(['withdraw', s.key, h]); return { ok: true, text: 'withdrawn' }; },
      window: async (s, d, h) => { acts.push(['window', s.key, d, h]); return { ok: true, text: 'set' }; },
    };
    mountNoticeBoard(host, { town: { name: 'Anticlere', mapId: 3021 }, book: noticeBook, nowS: () => now, seat: { seat: ANTICLERE, book: seatBook } });
    byClass(host, 'notice-tab')[1].onclick();
    return host;
  };
  // a member of the attackers, not signed
  let host = mount(2, 'g2', fight({ side: 'attack', signed: false, sellsword: false }));
  await tick();
  // PIN MOVED (CROWN2): a guild's name opening a sentence is capitalised - "The Silver Hand", where it read "the"
  assert.match(host.textContent, /Ebon Oath <EO> has won the Right of Siege at Anticlere\. The Silver Hand <SH> holds its Charter\. Battle is joined Thursday at 21:00 UTC\./);
  assert.match(host.textContent, /Attackers: 4 of 10 signed \(1 Sellsword\)\./);
  assert.match(host.textContent, /Defenders: 2 of 10 signed\./);
  byClass(host, 'notice-seat-sign')[0].click(); await tick();
  assert.deepEqual(acts.at(-1), ['sign', 3021]);
  assert.equal(byClass(host, 'notice-seat-window-set').length, 0, 'not the holder\'s: no window lever');
  // signed: its side said, its place given back
  host = mount(2, 'g2', fight({ side: 'attack', signed: true, sellsword: false }));
  await tick();
  assert.match(host.textContent, /You are signed for the attackers\./);
  assert.equal(byClass(host, 'notice-seat-sign').length, 0);
  byClass(host, 'notice-seat-unsign')[0].click(); await tick();
  assert.deepEqual(acts.at(-1), ['unsign', 3021]);
  // closed: nothing offered
  host = mount(2, 'g2', fight({ side: 'attack', signed: true, sellsword: false }, false));
  await tick();
  assert.match(host.textContent, /The rosters are closed\./);
  assert.equal(byClass(host, 'notice-seat-unsign').length + byClass(host, 'notice-seat-sign').length, 0);
  host = mount(2, 'g2', fight({ side: 'attack', signed: false, sellsword: false }, false));
  await tick();
  assert.equal(byClass(host, 'notice-seat-sign').length, 0, 'closed: no signing');
  // a hired account
  host = mount(2, null, fight({ side: null, signed: false, sellsword: true, hire: { side: 'attack', fee: 300 } }));
  await tick();
  assert.equal(byClass(host, 'notice-seat-sign')[0].textContent, 'Sign as a Sellsword (300 silver)');
  // the attackers' Guildmaster: its contracts, a withdrawal, a hire
  host = mount(0, 'g2', fight({ side: 'attack', signed: false, sellsword: false, hires: [{ handle: 'Bladra', fee: 300, state: 'offered' }] }));
  await tick();
  assert.match(host.textContent, /Bladra - offered, 300 silver\./);

  byClass(host, 'notice-seat-withdraw')[0].click(); await tick();
  assert.deepEqual(acts.at(-1), ['withdraw', 3021, 'Bladra']);
  const name = byClass(host, 'notice-seat-hire-name')[0], fee = byClass(host, 'notice-seat-hire-fee')[0];
  name.value = ' Cutter '; name.oninput(); fee.value = '9000'; fee.oninput();
  byClass(host, 'notice-seat-hire')[0].click(); await tick();
  assert.deepEqual(acts.at(-1), ['hire', 3021, 'Cutter', SELLSWORD_FEE_MAX], 'the fee held to its cap');
  // a signed contract stands; with the side's two contracts out, no more are offered
  host = mount(0, 'g2', fight({ side: 'attack', signed: false, sellsword: false, hires: [{ handle: 'Bladra', fee: 300, state: 'offered' }, { handle: 'Edda', fee: 0, state: 'signed' }] }));
  await tick();
  assert.match(host.textContent, /Edda - signed\./);
  assert.equal(byClass(host, 'notice-seat-withdraw').length, 1, 'a signed contract stands');
  assert.equal(byClass(host, 'notice-seat-hire').length, 0, 'the side\'s Sellswords all contracted');
  // the holder's Officer: the window
  host = mount(1, 'g1', fight({ side: 'defend', signed: false, sellsword: false }));
  await tick();
  assert.match(host.textContent, /Battles here are fought from Thursday 21:00 UTC\./);
  const day = byClass(host, 'notice-seat-window-day')[0], hour = byClass(host, 'notice-seat-window-hour')[0];
  assert.deepEqual(day.children.map((o) => o.value), ['0', '1', '2', '3']);
  assert.equal(hour.children.length, SIEGE_WINDOW_HOURS.length);
  day.value = '3'; day.onchange(); await tick();
  byClass(host, 'notice-seat-window-set')[0].click(); await tick();
  assert.deepEqual(acts.at(-1), ['window', 3021, 3, 21]);
  // the holder's Member: no lever
  host = mount(2, 'g1', fight({ side: 'defend', signed: false, sellsword: false }));
  await tick();
  assert.equal(byClass(host, 'notice-seat-window-set').length, 0, 'a Member: no window lever');
});

test('SEAT2a THE BOOK\'S CALLS: the window, a signing, an unsigning, a hire and a withdrawal each down their own path with the character, the seat and their fields; the words said back (mutants: each path; the side said)', async () => {
  const { createTownSeatBook } = await import('../../src/net/townSeatBook.js');
  const calls = [];
  const door = new Proxy({}, { get: (_, k) => (...a) => { calls.push([k, ...a]); return Promise.resolve({ ok: true, data: k === 'sign' ? { side: 'defend', sellsword: true } : {} }); } });
  const book = createTownSeatBook({ door, character: () => 'c1', storage: null, nowS: () => 1_800_000_000 });
  const seat = ANTICLERE;
  assert.match((await book.window(seat, 2, 18)).text, /Friday 18:00 UTC/);
  assert.equal((await book.sign(seat)).text, 'You are signed for the defenders as a Sellsword at Anticlere.');
  await book.unsign(seat);
  assert.match((await book.hire(seat, 'Cutter', 300)).text, /Cutter is offered a Sellsword's contract at 300 silver\./);
  await book.withdrawHire(seat, 'Cutter');
  assert.deepEqual(calls.map((c) => c[0]), ['window', 'sign', 'unsign', 'hire', 'withdrawHire']);
  assert.deepEqual(calls[0], ['window', 'c1', 3021, 2, 18]);
  assert.deepEqual(calls[3], ['hire', 'c1', 3021, 'Cutter', 300]);
  assert.deepEqual(calls[2], ['unsign', 3021]);
});
