// SEAT1c (2026-09-30, Mac: "Finish the seats"): THE TURNING'S LAW AND THE CHARTER ON THE CLIENT - the plan (the claim
// threshold and fee, Contested within 10%, the defence and Standing's modifier, one Right a guild and a seat, the truce,
// the unchallenged Standing, the Legacy), the Chronicle's words, a held seat's marks and banner, the book dressing a seat
// in its holder, the Seat tab's holder, battle, claim line, Chronicle and relinquish, and the hosts by source.
// bible/11-Multiplayer/Seats-Arc.md 3.3-3.4, 5.2, 7.9, 9.2; `06-Systems/Online-Arc.md` SEAT1c.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { byClass } from './chargenDom.mjs';
import {
  turningPlan, standingModifier, seatDefence, claimTotal, bySeatStanding, chronicleLine, seatHolderLine, seatClaimLine, seatBattleLine,
  seatMapMark, seatBannerOf, seatPlainBanner, seatArrivalLine, seatInfoLine, CLAIM_THRESHOLD, CLAIM_FEE, STANDING_START, STANDING_UNCHALLENGED,
  SEAT_RING_SIEGE,
} from '../src/net/townSeatLaw.js';
import { createTownSeatBook } from '../src/net/townSeatBook.js';
import { paintSeatRing } from '../src/ui/inkMap.js';
import { mountNoticeBoard } from '../src/ui/noticeWindow.js';
import { SEAT_RELINQUISH_ARM_MS } from '../src/ui/seatTab.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const ANTICLERE = { key: 3021, name: 'Anticlere', region: 21, tier: 'palace', pixel: [402, 151] };
const SH = { id: 'g1', name: 'The Silver Hand', tag: 'SH', heraldry: { field: 'azure', border: 'gold', device: 'tower' } };
const EO = { id: 'g2', name: 'Ebon Oath', tag: 'EO', heraldry: { field: 'crimson', border: 'argent', device: 'wolf' } };
const g = (guild, influence, o = {}) => ({ guild, influence, legacy: 0, pledgedAt: 0, ...o });

test('SEAT1c THE PLAN: the claim threshold and the fee, paid in key order from one purse; Contested within 10%; below the line nobody; the next claimant when the first cannot pay (mutants: the threshold; the margin; the fee pass; the purse spent)', () => {
  const unheld = (key, guilds, tier = 'palace') => ({ key, tier, holder: null, guilds });
  let p = turningPlan({ week: 5, seats: [unheld(1, [g('a', 6000)])], treasuries: new Map([['a', CLAIM_FEE.palace]]) });
  assert.deepEqual(p.claims, [{ key: 1, guild: 'a', fee: CLAIM_FEE.palace, total: 6000 }]);
  p = turningPlan({ week: 5, seats: [unheld(1, [g('a', 5999)])], treasuries: new Map([['a', 99999]]) });
  assert.deepEqual(p.claims, [], 'below the line');
  p = turningPlan({ week: 5, seats: [unheld(1, [g('a', 10000), g('b', 9000)])], treasuries: new Map([['a', 99999]]) });
  assert.deepEqual([p.claims, p.contested], [[], [{ key: 1, a: 'a', b: 'b' }]], 'within 10%: Contested');
  p = turningPlan({ week: 5, seats: [unheld(1, [g('a', 10000), g('b', 8999)])], treasuries: new Map([['a', 99999]]) });
  assert.equal(p.claims[0].guild, 'a', 'past 10%: the first takes it');
  p = turningPlan({ week: 5, seats: [unheld(1, [g('a', 10000), g('b', 5000)])], treasuries: new Map() });
  assert.deepEqual([p.claims, p.contested], [[], []], 'a guild below the line never contests, and nobody could pay');
  p = turningPlan({ week: 5, seats: [unheld(1, [g('a', 10000), g('b', 7000)])], treasuries: new Map([['b', 8000]]) });
  assert.equal(p.claims[0].guild, 'b', 'the first cannot pay: the next who passed');
  p = turningPlan({ week: 5, seats: [unheld(2, [g('a', 7000)]), unheld(1, [g('a', 7000)])], treasuries: new Map([['a', 10000]]) });
  assert.deepEqual(p.claims.map((c) => c.key), [1], 'one purse, in key order: the first seat takes the Drakes');
  p = turningPlan({ week: 5, seats: [unheld(1, [g('a', 29000)], 'crown')], treasuries: new Map([['a', 999999]]) });
  assert.deepEqual(p.claims, [], `a crown asks ${CLAIM_THRESHOLD.crown}`);
  // the Legacy: 10% of each guild's week, and it counts toward the next claim
  p = turningPlan({ week: 5, seats: [unheld(1, [g('a', 5600)])], treasuries: new Map() });
  assert.deepEqual(p.legacy, [{ key: 1, guild: 'a', amount: 560 }]);
  assert.equal(claimTotal(g('a', 5500, { legacy: 560 })), 6060);
  // the tie order: the higher Legacy, then the earlier pledge, then the lower id
  const t = [g('b', 100, { legacy: 1 }), g('a', 100, { legacy: 1, pledgedAt: 5 }), g('c', 100, { legacy: 1, pledgedAt: 5 }), g('d', 99, { legacy: 2 })];
  assert.deepEqual([...t].sort(bySeatStanding).map((x) => x.guild), ['d', 'b', 'a', 'c']);
});

test('SEAT1c THE DEFENCE AND THE RIGHTS: the holder\'s own week x (1 + Standing\'s modifier) and its Legacy; a challenger past the line and the defence; one Right a guild (its strongest) and one a seat (the next in line); a truce seat never; the unchallenged +5, capped (mutants: the modifier\'s two slopes; the Legacy; one a guild; one a seat; the truce; the cap)', () => {
  assert.equal(standingModifier(STANDING_START), 0);
  assert.equal(standingModifier(100), 0.25);
  assert.equal(standingModifier(0), -0.5);
  assert.equal(standingModifier(60), 0.05);
  assert.equal(standingModifier(40), -0.1);
  assert.equal(seatDefence({ influence: 4000, legacy: 300 }, 60), 4500);
  assert.equal(seatDefence(null, 50), 0);
  // SEAT1d: each holder at a Tithe that moves Standing neither way, its upkeep paid - so the Turning's +5 stands alone
  const held = (key, holder, guilds, o = {}) => ({ key, tier: 'palace', holder: { guild: holder, standing: 50, truceWeek: null, tithe: 6, ...o }, guilds });
  const purses = new Map(['h1', 'h2', 'h3', 'h4'].map((h) => [h, 2500]));
  const p = turningPlan({ week: 9, treasuries: purses, seats: [
    held(1, 'h1', [g('h1', 4000), g('c', 9000), g('d', 7000)]),
    held(2, 'h2', [g('h2', 4000), g('c', 8000)]),
    held(3, 'h3', [g('h3', 1000), g('e', 9000)], { truceWeek: 9 }),
    held(4, 'h4', [g('h4', 7000), g('f', 6500)], { standing: 98 }),
  ] });
  assert.deepEqual(p.rights.map((r) => [r.key, r.guild, r.defence]), [[1, 'c', 4000]], 'one a guild: seat 2 has no other challenger; seat 1 to the Circle, not the Host');
  assert.deepEqual(p.held.map((h) => [h.key, h.standing]), [[2, 55], [3, 55], [4, 100]], 'held unchallenged: +5, the truce seat too, capped at 100');
  const q = turningPlan({ week: 9, treasuries: purses, seats: [held(1, 'h1', [g('h1', 4000), g('c', 9000), g('d', 7000)]), held(2, 'h2', [g('h2', 4000), g('c', 9500)])] });
  assert.deepEqual(q.rights.map((r) => [r.key, r.guild]).sort((a, b) => a[0] - b[0]), [[1, 'd'], [2, 'c']], 'the Circle\'s strongest is seat 2; seat 1 falls to the Host, next in line');
  assert.equal(STANDING_UNCHALLENGED, 5);
});

test('SEAT1c THE WORDS AND THE MARKS: the Chronicle\'s lines; the holder\'s, the battle\'s and the claim\'s lines; the arrival and the map\'s line held; a held seat\'s ring filled and edged in its holder\'s colours, a Contested seat\'s split, a siege week\'s edge burning; the holder\'s banner, the plain one for an unheld seat or a holder with none (mutants: each line; the fill; the split; the siege edge; the banner)', () => {
  const row = (kind, data, week = 3) => chronicleLine({ kind, week, data }, ANTICLERE);
  assert.equal(row('claim', { guild: SH, total: 8393 }), 'In week 3, the Silver Hand <SH> took the Charter of Anticlere with 8,393 influence.');
  assert.equal(row('contested', { a: SH, b: EO }), 'In week 3, the Charter of Anticlere was Contested between the Silver Hand <SH> and Ebon Oath <EO>. A Tourney decides it.');
  assert.equal(row('right', { guild: EO, holder: SH }), 'In week 3, Ebon Oath <EO> won a Right of Siege against the Silver Hand <SH> at Anticlere.');
  assert.equal(row('held', { guild: SH }), 'In week 3, the Silver Hand <SH> held Anticlere unchallenged.');
  assert.equal(row('relinquish', { guild: SH }), 'In week 3, the Silver Hand <SH> gave up the Charter of Anticlere.');
  assert.equal(row('nonsense', {}), null);
  assert.equal(seatHolderLine({ guild: SH, since: 3, standing: 55 }), 'Held by the Silver Hand <SH> since week 3. Standing 55.');
  assert.equal(seatHolderLine(null), 'No guild holds this Charter.');
  // PIN MOVED (CROWN2): a guild's name opening a sentence is capitalised
  assert.equal(seatBattleLine({ kind: 'tourney', guild: SH, against: EO }), 'The Silver Hand <SH> and Ebon Oath <EO> meet in a Tourney for the Charter this week.');
  assert.equal(seatBattleLine({ kind: 'siege', guild: EO, against: SH }), 'Ebon Oath <EO> has won a Right of Siege against the Silver Hand <SH> this week.');
  assert.equal(seatBattleLine(null), null);
  assert.match(seatClaimLine(ANTICLERE), /6,000 influence, and 8,000 silver/);
  assert.match(seatClaimLine(ANTICLERE, 7410), /the holder's defence of 7,410, and at least 6,000 influence/);
  assert.equal(seatArrivalLine(ANTICLERE, SH), 'Anticlere, held by the Silver Hand <SH>.');
  assert.equal(seatInfoLine(ANTICLERE, SH), 'The Charter of Anticlere: held by the Silver Hand <SH>');
  const heldSeat = { ...ANTICLERE, holder: { guild: SH } };
  assert.deepEqual(seatMapMark(heldSeat), { ring: '#d4a017', crown: null, second: ['#3b6fd8', '#b3262e'], fill: '#3b6fd8', split: null, siege: false });
  const contested = { ...ANTICLERE, holder: null, battle: { kind: 'tourney', guild: SH, against: EO } };
  assert.deepEqual(seatMapMark(contested).split, ['#3b6fd8', '#b3262e']);
  assert.equal(seatMapMark({ ...heldSeat, battle: { kind: 'siege', guild: EO, against: SH } }).siege, true);
  const calls = [];
  const ctx = new Proxy({}, { get: (_, k) => (typeof k === 'string' && !['strokeStyle', 'fillStyle', 'lineWidth', 'globalAlpha'].includes(k) ? (...a) => calls.push([k, ...a]) : undefined), set: (_, k, v) => { calls.push(['set', k, v]); return true; } });
  paintSeatRing(ctx, 10, 20, 7, seatMapMark({ ...heldSeat, battle: { kind: 'siege', guild: EO, against: SH } }));
  assert.deepEqual(calls.filter((c) => c[0] === 'set' && c[1] === 'fillStyle').map((c) => c[2]), ['#3b6fd8'], 'filled in the holder\'s field');
  assert.equal(calls.filter((c) => c[0] === 'set' && c[1] === 'strokeStyle')[0][2], SEAT_RING_SIEGE, 'the siege week\'s edge');
  calls.length = 0;
  paintSeatRing(ctx, 10, 20, 7, seatMapMark(contested));
  assert.deepEqual(calls.filter((c) => c[0] === 'set' && c[1] === 'fillStyle').map((c) => c[2]).slice(0, 2), ['#3b6fd8', '#b3262e'], 'split in two');
  assert.deepEqual(seatBannerOf(heldSeat), SH.heraldry, 'a held seat flies its holder\'s');
  assert.deepEqual(seatBannerOf({ ...ANTICLERE, holder: { guild: { ...SH, heraldry: null } } }), seatPlainBanner(ANTICLERE), 'a holder with none: the plain one');
  assert.deepEqual(seatBannerOf(ANTICLERE), seatPlainBanner(ANTICLERE));
});

test('SEAT1c THE BOOK AND THE SEAT TAB: a derived seat dressed in its holder and battle from the list; the tab under the holder\'s banner - the holder, the battle, the claim or defence line, the Chronicle; the holder\'s guildmaster gives the Charter up with two presses (mutants: the dress; the holder line; the Chronicle; the arming; the rank)', async () => {
  const book = createTownSeatBook({
    door: /** @type {any} */ ({ list: async () => ({ ok: true, data: { seats: [{ ...ANTICLERE, state: 'confirmed', holder: { guild: SH, since: 3, standing: 55 }, battle: { kind: 'siege', guild: EO, against: SH } }], me: {} } }) }),
  });
  await book.read();
  const d = book.dressed(ANTICLERE);
  assert.deepEqual([d.holder.guild.tag, d.battle.kind, d.key], ['SH', 'siege', 3021]);
  assert.deepEqual(book.dressed({ ...ANTICLERE, key: 1 }).holder, null, 'a seat the list did not name');
  assert.equal(book.dressed(null), null);
  const tick = (n = 4) => new Promise((r) => { let i = 0; const go = () => (++i >= n ? r() : setTimeout(go, 0)); setTimeout(go, 0); });
  const noticeBook = { seenAt: () => null, read: async () => ({ board: { notes: [], notices: [], me: {} } }), markSeen: () => {}, cached: () => null, draft: () => ({ subject: '', body: '', days: 7, button: '' }), noticeDraft: () => ({ subject: '', body: '', days: 3 }), readGuild: async () => ({ data: null, error: 'no-guild' }) };
  const acts = [];
  let now = 1_800_000_000;
  const data = (rank) => ({
    seat: ANTICLERE, week: 16, phase: 'muster', reckoningAt: now + 3600, turningAt: now + 86400, defence: 4500,
    holder: { guild: SH, since: 3, standing: 55 }, battle: { kind: 'siege', guild: EO, against: SH },
    standings: [{ guild: SH, influence: 4000, legacy: 0, tribute: 0, accounts: 2, holder: true }],
    chronicle: [{ kind: 'held', week: 15, data: { guild: SH } }, { kind: 'claim', week: 3, data: { guild: SH, total: 6100 } }],
    mine: { guild: 'g1', rank, seasoned: true, bound: 'g1', pledges: [], influence: 0, tributeRoom: 0 },
  });
  const mount = (rank) => {
    const host = document.createElement('div');
    const seatBook = { open: true, standings: async () => ({ data: data(rank), error: null }), relinquish: async (s) => { acts.push(['relinquish', s.key]); return { ok: true, text: 'given up' }; }, pledge: async () => ({ ok: true }), unpledge: async () => ({ ok: true }), tribute: async () => ({ ok: true }) };
    const v = mountNoticeBoard(host, { town: { name: 'Anticlere', mapId: 3021 }, book: noticeBook, nowS: () => now, seat: { seat: ANTICLERE, book: seatBook } });
    byClass(host, 'notice-tab')[1].onclick();
    return { host, v };
  };
  const { host, v } = mount(0);
  await tick();
  const text = host.textContent;
  assert.match(text, /The Charter of Anticlere: held by the Silver Hand <SH>/);
  assert.match(text, /Held by the Silver Hand <SH> since week 3\. Standing 55\./);
  assert.match(text, /Ebon Oath <EO> has won a Right of Siege against the Silver Hand <SH> this week\./);
  assert.match(text, /the holder's defence of 4,500/);
  assert.deepEqual(byClass(host, 'notice-chronicle')[0].querySelectorAll('li').map((li) => li.textContent), ['In week 15, the Silver Hand <SH> held Anticlere unchallenged.', 'In week 3, the Silver Hand <SH> took the Charter of Anticlere with 6,100 influence.']);
  const give = () => byClass(host, 'notice-seat-relinquish')[0];
  give().click();
  await tick();
  assert.equal(acts.length, 0, 'the first press arms it');
  assert.match(give().textContent, /Press again/);
  give().click();
  await tick();
  assert.deepEqual(acts, [['relinquish', 3021]]);
  // armed, then left: it disarms
  give().click();
  now += SEAT_RELINQUISH_ARM_MS / 1000 + 1;
  give().click();
  await tick();
  assert.equal(acts.length, 1, 'an old arming is a first press again');
  v.unmount();
  const o = mount(1);
  await tick();
  assert.equal(byClass(o.host, 'notice-seat-relinquish').length, 0, 'the guildmaster\'s alone');
  o.v.unmount();
});

test('SEAT1c THE HOSTS BY SOURCE: the service settles the Turning before any seat answer, decorates the list with holders and battles, routes relinquish; a guild holding a Charter or named in a battle to come does not go; the holder counts at its seat and pledges nowhere else in its region; the client\'s seats are dressed, the arrival names the holder, the banners fly its colours (mutants: each seam)', () => {
  const idx = rd('server-account/src/index.js');
  // PIN MOVED (SEASON1): the Turnings due read the Season counted
  assert.match(idx, /if \(seatsOpenFor\(who\.player, env\)\) await settleDue\(ctx\.db, nowS, seasonZeroOf\(env\.SEASON_ZERO_WEEK\)\);[^\n]*\n\s*const act = \{/);
  // PIN MOVED (CROWN2): the list carries the server's red lines too
  assert.match(idx, /return 'error' in r \? r : \{ \.\.\.r, seats: await seatsWithHolders\(ctx\.db, r\.seats, nowS\), red: await redOf\(ctx\.db, nowS\), zero: seasonZeroOf\(env\.SEASON_ZERO_WEEK\) \};/);   // CROWN2: the red lines; SEASON1 part two: Season 0's week
  assert.match(idx, /'\/v1\/seats\/relinquish': \(\) => relinquishSeat\(ctx, who\.player, env, body\),/);
  assert.ok(rd('server-account/src/service.js').includes("'/v1/seats/relinquish',"));
  const gu = rd('server-account/src/guilds.js');
  assert.match(gu, /OR EXISTS \(SELECT 1 FROM town_seat_holds WHERE guild_id = \$\{p\}\)/);
  assert.match(gu, /OR EXISTS \(SELECT 1 FROM town_seat_rights WHERE \(guild_id = \$\{p\} OR against = \$\{p\}\) AND \$\{SEAT_BATTLE_PENDING\}\)   -- SEAT1c/);   // PIN MOVED (AUDIT CHAP5 E4): no longer the list's last - a patron's bid kept after it
  assert.match(gu, /const SEAT_BATTLE_PENDING = 'week > COALESCE\(\(SELECT MAX\(week\) FROM town_seat_weeks\), -1\)';/);
  const si = rd('server-account/src/seatInfluence.js');
  assert.match(si, /const held = await db\.prepare\('SELECT key FROM town_seat_holds WHERE guild_id = \? AND region = \? ORDER BY key LIMIT 1'\)/);
  assert.match(si, /if \(await db\.prepare\('SELECT 1 FROM town_seat_holds WHERE guild_id = \? AND region = \?'\)\.bind\(gid, seat\.region\)\.first\(\)\) return \{ error: 'seat-held-here' \};/);
  const st = rd('server-account/src/seatTurning.js');
  assert.match(st, /const stmts = \[db\.prepare\('INSERT INTO town_seat_weeks \(week, settled_at\) VALUES \(\?, \?\)'\)\.bind\(week, nowS\)\];/, 'the key first, a plain INSERT');
  // PIN MOVED (AUDIT-SEATS): a batch that rolls back says whether it FAILED (S1) - not a racing reader's key - so settleDue
  // stops at it rather than settle a later week over it
  assert.match(st, /try \{ await db\.batch\(stmts\); \} catch \{ return \{ settled: false, failed: !\(await db\.prepare\('SELECT 1 FROM town_seat_weeks WHERE week = \?'\)\.bind\(week\)\.first\(\)\) \}; \}/);
  const w = rd('src/scenes/world.js');
  assert.match(w, /const seatHere = \(mapId\) => \(seatBook\?\.open === true \? seatBook\.dressed\(seatAtMapId\(townSeats, mapId\)\) : null\);/);
  assert.match(w, /townTalk\.say\(seatArrivalLine\(seat\), 5\)/);
  assert.equal(seatArrivalLine({ ...ANTICLERE, holder: { guild: SH } }), 'Anticlere, held by the Silver Hand <SH>.', 'a dressed seat names its own holder');
  assert.match(rd('src/scenes/seatBanners.js'), /const h = seat \? seatBannerOf\(seat\) : null;/);
});
