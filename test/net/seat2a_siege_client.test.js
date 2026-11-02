// SEAT2a part three (2026-10-01, Mac: "Finish the seats"; "Or we could go ahead and do sieges"; "Continue"): THE LAW
// THE SERVICE AND THE CLIENT SHARE OF A BATTLE'S END - the field settled from the fighters' games, the pass's door and
// window, the winner, what the Turning remembers, Honours and the Spoils, the Chronicle's rows, the refusals in words, and
// the book's two calls. bible/11-Multiplayer/Seats-Arc.md 6.2, 6.5-6.8; `06-Systems/Online-Arc.md` SEAT2a (part three).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  settleField, passWindowEnds, passOpens, siegeWinner, siegeAftermath, spoilsOf, SIEGE_SPOILS, SIEGE_HONOURS, SIEGE_STANDING,
  SIEGE_DEFENCE_BONUS, SIEGE_PAIR_WEEKS, SIEGE_WHY, chronicleLine, seatDefence, turningPlan, CLAIM_THRESHOLD,
} from '../../src/net/townSeatLaw.js';
import { accountRefusalText } from '../../src/net/accountClient.js';
import { siegeFieldValid } from '../../src/net/identityToken.js';
import { STANDARD_SILK } from '../../src/net/professionLaw.js';

const SEAT = { key: 3021, name: 'Anticlere', tier: 'palace', region: 21 };

test('SEAT2a part three THE FIELD AND THE DOOR: settled by the first field an attacker and a defender both sent, never by one side alone; once joined, a side absent, the most sent and the earliest; the pass\'s door ten minutes before the start and its window the battle\'s block (mutants: the agreement; the fallback; the count; the tie; the door; the window)', () => {
  const r = (side, field, at) => ({ side, field, at });
  assert.equal(settleField([r('attack', 'A', 1), r('attack', 'A', 2)], false), null, 'one side alone agrees nothing');
  assert.equal(settleField([r('attack', 'A', 1), r('defend', 'B', 2), r('defend', 'A', 3), r('attack', 'B', 4)], false), 'A', 'the first both sides sent');
  assert.equal(settleField([r('attack', 'A', 1), r('attack', 'B', 2), r('attack', 'B', 3)], false), null, 'not before the battle is joined');
  assert.equal(settleField([r('attack', 'A', 1), r('attack', 'B', 2), r('attack', 'B', 3)], true), 'B', 'joined: the most sent');
  assert.equal(settleField([r('defend', 'A', 1), r('defend', 'B', 2)], true), 'A', 'a tie: the earliest');
  assert.equal(settleField([], true), null);
  const b = { starts_at: 1000_000, kind: 'siege', tier: 'palace' };
  assert.equal(passOpens(b), 1000_000 - 600);
  assert.equal(passWindowEnds(b), 1000_000 + 7200);
  assert.equal(passWindowEnds({ ...b, tier: 'crown' }), 1000_000 + 3600, 'a crown siege holds its hour');
  assert.equal(passWindowEnds({ ...b, kind: 'tourney' }), 1000_000 + 7200);
  assert.equal(siegeFieldValid([[0, 0], [1, 1], [2, 2], [3, 3], [4, 4], [5, 5]], 'palace'), true);
  assert.equal(siegeFieldValid([[0, 0], [1, 1], [2, 2], [3, 3], [4, 4], [5, 5]], 'crown'), false);
});

test('SEAT2a part three THE WINNER AND THE AFTERMATH: a taken seat the attackers\', a held one, a forfeit and an absence the holder\'s, a dead heat the higher influence\'s; a taken seat changes hands; a held one barred to the challenger, +15 and x1.2 only where a banner was raised; a forfeit +10 (none a second time in the Season) and x1.2; an absence nothing; a Tourney\'s result its Charter alone (mutants: each side; each row of 6.8)', () => {
  assert.deepEqual(['attack', 'defend', 'forfeit', 'absent'].map((r) => siegeWinner(r)), ['attack', 'defend', 'defend', 'defend']);
  assert.deepEqual([siegeWinner('tie', 'attack'), siegeWinner('tie', 'defend'), siegeWinner('tie'), siegeWinner('void')], ['attack', 'defend', null, null]);
  const none = { bonus: false, barred: false, standing: 0, taken: false };
  assert.deepEqual(siegeAftermath('siege', 'attack', 1), { ...none, taken: true });
  assert.deepEqual(siegeAftermath('siege', 'defend', 1), { bonus: true, barred: true, standing: 15, taken: false });
  assert.deepEqual(siegeAftermath('siege', 'defend', 0), { bonus: false, barred: true, standing: 0, taken: false }, 'a siege nobody fought is not a victory');
  assert.deepEqual(siegeAftermath('siege', 'forfeit', 0), { bonus: true, barred: true, standing: 10, taken: false });
  assert.deepEqual(siegeAftermath('siege', 'forfeit', 0, { forfeitPaid: true }), { bonus: true, barred: true, standing: 0, taken: false });
  assert.deepEqual(siegeAftermath('siege', 'absent', 0), none);
  assert.deepEqual(siegeAftermath('tourney', 'attack', 1), none);
  assert.deepEqual([SIEGE_STANDING.held, SIEGE_STANDING.forfeit, SIEGE_DEFENCE_BONUS, SIEGE_PAIR_WEEKS], [15, 10, 1.2, 8]);
  // the Turning: the x1.2 in the defence, the barred challenger skipped
  assert.equal(seatDefence({ influence: 1000, legacy: 7 }, 50, 0, true), 1207);
  assert.equal(seatDefence({ influence: 1000, legacy: 7 }, 50, 0), 1007);
  const seats = (o) => [{ key: 3021, tier: 'palace', holder: { guild: 'sh', standing: 50, truceWeek: null, tithe: 0, owed: 0, ...o.holder }, barred: o.barred ?? [],
    guilds: [{ guild: 'sh', influence: 5100, legacy: 0, pledgedAt: 1 }, { guild: 'eo', influence: 6100, legacy: 0, pledgedAt: 2 }] }];
  const plan = (o) => turningPlan({ week: 9, seats: seats(o), treasuries: new Map([['sh', 100000], ['eo', 100000]]), active: 100 });
  assert.equal(CLAIM_THRESHOLD.palace, 6000);
  assert.deepEqual(plan({}).rights.map((x) => [x.guild, x.defence]), [['eo', 5100]], 'past the holder\'s 5,100');
  assert.deepEqual(plan({ holder: { bonus: true } }).rights, [], 'the holder at x1.2 defends at 6,120: 6,100 is not past it');
  assert.deepEqual(plan({ barred: ['eo'] }).rights, [], 'barred');
});

test('SEAT2a part three HONOURS AND THE SPOILS: 50 Marks and 2,000 Renown XP to the winners, 25 and 1,000 to the losers; a fighter\'s roll its own and the same however asked, between the ingot and the silk (the Siege-cracked Gem waits for its template); the Chronicle\'s rows; the refusals in the board\'s words (mutants: the sizes; the roll; the rows; the words)', () => {
  assert.deepEqual(SIEGE_HONOURS, { win: { marks: 50, xp: 2000 }, lose: { marks: 25, xp: 1000 } });
  assert.deepEqual([...SIEGE_SPOILS], ['ingot:warforged', STANDARD_SILK.key, 'gem:siege']);   // PIN MOVED (AUDIT-SEATS): the Siege-cracked Gem has its template (678)
  const rolls = new Set();
  for (let i = 0; i < 40; i++) rolls.add(spoilsOf(20, 3021, `acct-${i}`));
  assert.deepEqual([...rolls].sort(), [...SIEGE_SPOILS].sort(), 'all three fall');
  assert.equal(spoilsOf(20, 3021, 'acct-7'), spoilsOf(20, 3021, 'acct-7'), 'the same however often asked');
  const pick = (w, k, a) => { let h = 0x811c9dc5; for (const ch of `${w}:${k}:${a}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return SIEGE_SPOILS[h % 3]; };
  for (let i = 0; i < 10; i++) assert.equal(spoilsOf(21, 3022, `a-${i}`), pick(21, 3022, `a-${i}`), 'FNV-1a over the battle and the account');
  const SH = { name: 'The Silver Hand', tag: 'SH' }, EO = { name: 'Ebon Oath', tag: 'EO' };
  const line = (kind, data) => chronicleLine({ week: 20, kind, data }, SEAT);
  assert.deepEqual([
    line('siege-taken', { guild: EO, from: SH }), line('siege-held', { guild: SH, against: EO }), line('siege-forfeit', { guild: SH, against: EO }),
    line('siege-absent', { guild: SH }), line('tourney-won', { guild: EO }), line('tourney-unheld', {}),
  ], [
    'In week 20, Ebon Oath <EO> took the Charter of Anticlere by siege from the Silver Hand <SH>.',
    'In week 20, the Silver Hand <SH> held Anticlere against the siege of Ebon Oath <EO>.',
    'In week 20, Ebon Oath <EO> never came to the siege of Anticlere; the Silver Hand <SH> holds it by forfeit.',
    'In week 20, neither side came to the siege of Anticlere; the Silver Hand <SH> keeps it.',
    'In week 20, Ebon Oath <EO> won the Tourney for the Charter of Anticlere.',
    'In week 20, the Tourney for Anticlere was fought, but neither guild could pay for the Charter of Anticlere.',
  ]);
  for (const [k, v] of Object.entries(SIEGE_WHY)) assert.equal(accountRefusalText(k), v, k);
  assert.equal(accountRefusalText('field-unsettled'), 'Waiting for the other side\'s scouts to agree on the field. Try again in a moment.');
  assert.equal(accountRefusalText('not-yours'), 'That gate result belongs to another account.', 'the gate\'s words untouched');
});

test('SEAT2a part three THE BOOK\'S CALLS: a pass asked with the field this game derived, its answer passed on; an unsettled field said in words with its word kept, to ask again; a receipt claimed for this character, the standings read afresh (mutants: the field sent; the answer; the refusal; the character)', async () => {
  const { createTownSeatBook } = await import('../../src/net/townSeatBook.js');
  const calls = [];
  let answer = { ok: true, data: { pass: 'v1.x.y', side: 'attack', week: 20, startsAt: 5, endsAt: 6, window: 7 } };
  const door = new Proxy({}, { get: (_, k) => (...a) => { calls.push([k, ...a]); return Promise.resolve(answer); } });
  const book = createTownSeatBook({ door, character: () => 'c1', storage: null });
  const field = [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4], [5, 5]];
  assert.deepEqual(await book.siegePass(SEAT, field), { ok: true, pass: 'v1.x.y', side: 'attack', week: 20, startsAt: 5, endsAt: 6, window: 7 });
  assert.deepEqual(calls.at(-1), ['pass', 3021, field]);
  answer = { ok: false, error: 'field-unsettled' };
  assert.deepEqual(await book.siegePass(SEAT, field), { ok: false, error: 'field-unsettled', text: SIEGE_WHY['field-unsettled'] });
  answer = { ok: true, data: { result: 'attack', winner: 'attack', honours: { marks: 50 } } };
  assert.deepEqual(await book.claimSiege('s1.a.b'), { ok: true, result: 'attack', winner: 'attack', honours: { marks: 50 } });
  assert.deepEqual(calls.at(-1), ['claimSiege', 's1.a.b', 'c1']);
  answer = { ok: false, error: 'honours-twice' };
  assert.equal((await book.claimSiege('s1.a.b')).text, SIEGE_WHY['honours-twice']);
});
