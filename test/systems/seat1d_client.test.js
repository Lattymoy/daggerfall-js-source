// SEAT1d (2026-10-01, Mac: "Finish the seats"; "Continue"): HOLDING A SEAT - the law (upkeep and Overreach, the crown's
// scale, the Tithe and its bailiwick, the members' discount, every row of Standing, Unrest, the Edicts, the Levy's share,
// a camp's pixel), the Turning's plan over them, the client's own (systems/seatEdicts.js: the shops, the arrival's news,
// the Festive buff, Curfew, the Bounty's camps), the Seat tab's levers, the hosts by source, and the economy model.
// bible/11-Multiplayer/Seats-Arc.md 7.1-7.3, 7.6, Appendix C; `06-Systems/Online-Arc.md` SEAT1d.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { byClass } from '../chargenDom.mjs';
import {
  SEAT_UPKEEP, CROWN_SCALE, crownScale, SEAT_WEIGHT, OVERREACH, overreachOf, overreachDefence, seatUpkeep, seatDefence, TITHE_CAP, titheOk,
  titheOf, bailiwickOf, MEMBER_DISCOUNT, STANDING_LOVED, LOVED_DISCOUNT, MARKET_DAY_DISCOUNT, seatShopFactor, STANDING_CHANGES,
  STANDING_UNREST, UNREST_BONUS, seatInUnrest, unrestInfluence, titheStanding, EDICTS, edictOk, edictMayFollow, edictCost, LEVY_SHARE,
  BOUNTY_MARKS, BOUNTY_CAMPS_DAY, FESTIVE, CURFEW, SEAT_EDICTS_HOUR, SEAT_LEVER_RANKS, standingWeek, turningPlan, levyOf, bountySitePixel,
  edictLine, seatHoldingLines, seatRuleLine, seatArrivalNews, chronicleLine, CLAIM_THRESHOLD,
} from '../../src/net/townSeatLaw.js';
import { createSeatEdicts, festiveMods, FESTIVE_TEXT, bountyPaidText } from '../../src/systems/seatEdicts.js';
import { STAT_KEYS_ORDER } from '../../src/systems/statMods.js';
import { lowerRepForCrime, setCrimeRepFactor, CRIME_IDS } from '../../src/systems/court.js';
import { mountNoticeBoard } from '../../src/ui/noticeWindow.js';
import { runModel, SIZES, PROFILES, seeded, memberWeek } from '../../tools/seatEconomy.mjs';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const ANTICLERE = { key: 3021, name: 'Anticlere', region: 21, tier: 'palace', pixel: [402, 151] };
const ASHFIELD = { key: 3022, name: 'Ashfield', region: 21, tier: 'palace', pixel: [470, 160] };
const WAYREST = { key: 5023, name: 'Wayrest', region: 23, tier: 'crown', pixel: [590, 166] };
const SH = { id: 'g1', name: 'The Silver Hand', tag: 'SH', heraldry: null };
const g = (guild, influence, o = {}) => ({ guild, influence, legacy: 0, pledgedAt: 0, ...o });

test('SEAT1d THE COST: a palace 2,500 a week, a crown 15,000 x min(1.5, max(0.4, active / 100)); Overreach\'s extra the weights past the heaviest, +25% upkeep and -5% defence each, added (mutants: each number; the scale\'s bounds; the extra; the defence cut)', () => {
  assert.deepEqual([SEAT_UPKEEP.palace, SEAT_UPKEEP.crown, CROWN_SCALE.least, CROWN_SCALE.most, CROWN_SCALE.per], [2500, 15000, 0.4, 1.5, 100]);
  assert.deepEqual([crownScale(10), crownScale(100), crownScale(120), crownScale(1000), crownScale(-5)], [0.4, 1, 1.2, 1.5, 0.4]);
  assert.deepEqual([SEAT_WEIGHT.palace, SEAT_WEIGHT.crown, OVERREACH.upkeep, OVERREACH.defence], [1, 3, 0.25, 0.05]);
  assert.deepEqual([overreachOf([]), overreachOf(['crown']), overreachOf(['palace']), overreachOf(['crown', 'palace']), overreachOf(['crown', 'crown']), overreachOf(['palace', 'palace', 'palace'])], [0, 0, 0, 1, 3, 2]);
  assert.deepEqual([seatUpkeep('palace'), seatUpkeep('palace', 1), seatUpkeep('palace', 2), seatUpkeep('crown', 0, 100), seatUpkeep('crown', 0, 50), seatUpkeep('crown', 3, 200)], [2500, 3125, 3750, 15000, 7500, 39375]);
  assert.deepEqual([seatUpkeep('palace', 0, 30), seatUpkeep('palace', 0, 300)], [2500, 2500], 'a palace\'s never scales - the seats held already grow with the server');
  assert.deepEqual([overreachDefence(0), overreachDefence(1), overreachDefence(3), overreachDefence(30)], [1, 0.95, 0.85, 0]);
  assert.equal(seatDefence({ influence: 4000, legacy: 300 }, 60, 1), Math.floor(4000 * 1.05 * 0.95) + 300, 'the cut on its week, never its Legacy');
});

test('SEAT1d WHAT IT PAYS: the Tithe 0-10% at a palace, 0-15% at a crown, whole percents; a board\'s seat the nearest of its region (ties to the lower key; no pixel, the region\'s first; another region\'s never); the members\' discount 10% / 15% and 5% more while loved; Market Day\'s tenth for everyone, added (mutants: the caps; the share; the bailiwick; each discount)', () => {
  assert.deepEqual([TITHE_CAP.palace, TITHE_CAP.crown], [10, 15]);
  assert.deepEqual([titheOk('palace', 10), titheOk('palace', 11), titheOk('crown', 15), titheOk('crown', 16), titheOk('palace', -1), titheOk('palace', 2.5), titheOk('nope', 1)], [true, false, true, false, false, false, false]);
  assert.deepEqual([titheOf(100, 8), titheOf(99, 8), titheOf(0, 8)], [8, 7, 0]);
  const seats = [ASHFIELD, ANTICLERE, WAYREST];
  assert.equal(bailiwickOf(seats, 21, [405, 150]).key, 3021);
  assert.equal(bailiwickOf(seats, 21, [468, 161]).key, 3022);
  assert.equal(bailiwickOf(seats, 21, [436, 155.5]).key, 3021, 'level: the lower key');
  assert.equal(bailiwickOf(seats, 21, null).key, 3021, 'no pixel: the region\'s first');
  assert.equal(bailiwickOf(seats, 34, [520, 130]), null, 'no seat in the region');
  assert.deepEqual([MEMBER_DISCOUNT.palace, MEMBER_DISCOUNT.crown, STANDING_LOVED, LOVED_DISCOUNT, MARKET_DAY_DISCOUNT], [0.10, 0.15, 80, 0.05, 0.10]);
  const held = (tier, standing, edict = null) => ({ tier, holder: { guild: { id: 'g1' }, standing, edict } });
  assert.equal(seatShopFactor(held('palace', 50), 'g1'), 0.9);
  assert.equal(seatShopFactor(held('crown', 50), 'g1'), 0.85);
  assert.equal(seatShopFactor(held('palace', 80), 'g1').toFixed(2), '0.85', 'loved: 5% more');
  assert.equal(seatShopFactor(held('palace', 79), 'g1'), 0.9);
  assert.equal(seatShopFactor(held('palace', 50), 'g2'), 1, 'another guild\'s');
  assert.equal(seatShopFactor(held('palace', 50, 'market-day'), 'g2'), 0.9, 'Market Day: everyone');
  assert.equal(seatShopFactor(held('palace', 90, 'market-day'), 'g1').toFixed(2), '0.75', 'added');
  assert.equal(seatShopFactor({ tier: 'palace', holder: null }, 'g1'), 1, 'an unheld seat');
  assert.equal(seatShopFactor(null, 'g1'), 1);
});

test('SEAT1d STANDING: every row of 7.3 - the Tithe\'s two (at or below half its cap +2, above three quarters -3), unchallenged +5, a gate +2 to +6, no Watch -5, a siege held +15 and the Throne reached -5, Festival +10, Neglect -10, writs +1 to +5, upkeep late -5, a revolt put down to 20, Curfew -2, Levy -2, Open Gates +3; held to 0-100; Unrest below 20, challengers a quarter more (mutants: each row; each cap; the clamp; Unrest)', () => {
  assert.deepEqual({ ...STANDING_CHANGES }, {
    titheLow: 2, titheHigh: -3, unchallenged: 5, gate: 2, gateWeekMax: 6, noWatch: -5, siegeHeld: 15, throneReached: -5, festival: 10,
    neglect: -10, writ: 1, writWeekMax: 5, paidLate: -5, revoltTo: 20, curfew: -2, levy: -2, openGates: 3,
    conscripted: -5,   // PIN MOVED (CROWN1): a seat that paid a crown's Conscription (test/net/crown1_law.test.js)
    fealtyBroken: -10,   // PIN MOVED (CROWN2): every seat of a guild that broke its fealty (test/net/crown2_law.test.js)
    wedding: 3, taxRevolt: -3,   // PIN MOVED (SEASON1 part two): a Royal Wedding's week, a Tax Revolt's (test/net/tide_law.test.js)
  });
  assert.deepEqual([0, 5, 6, 7, 8, 10].map((p) => titheStanding('palace', p)), [2, 2, 0, 0, -3, -3]);
  assert.deepEqual([7, 8, 11, 12].map((p) => titheStanding('crown', p)), [2, 0, 0, -3]);
  const w = (o) => standingWeek({ tier: 'palace', standing: 50, tithe: 6, ...o });
  assert.deepEqual(w({}), { standing: 50, changes: [] });
  assert.equal(w({ tithe: 0 }).standing, 52);
  assert.equal(w({ tithe: 9 }).standing, 47);
  assert.equal(w({ unchallenged: true }).standing, 55);
  assert.deepEqual([w({ gates: 1 }).standing, w({ gates: 3 }).standing, w({ gates: 9 }).standing], [52, 56, 56]);
  assert.equal(w({ watched: false }).standing, 45);
  assert.deepEqual([w({ writs: 2 }).standing, w({ writs: 9 }).standing], [52, 55]);
  assert.deepEqual([w({ upkeep: 'neglect' }).standing, w({ upkeep: 'late' }).standing, w({ upkeep: 'paid' }).standing], [40, 45, 50]);
  assert.deepEqual(['festival', 'curfew', 'levy', 'open-gates', 'market-day', 'bounty'].map((e) => w({ edict: e }).standing), [60, 48, 48, 53, 50, 50]);
  assert.equal(standingWeek({ tier: 'palace', standing: 98, tithe: 0, unchallenged: true }).standing, 100, 'held to 100');
  assert.equal(standingWeek({ tier: 'palace', standing: 4, tithe: 10, watched: false, upkeep: 'neglect' }).standing, 0, 'and to 0');
  assert.deepEqual(w({ tithe: 0, unchallenged: true, gates: 1 }).changes, [['titheLow', 2], ['unchallenged', 5], ['gate', 2]], 'the table\'s order');
  assert.deepEqual([STANDING_UNREST, UNREST_BONUS, seatInUnrest(19), seatInUnrest(20), seatInUnrest(null)], [20, 0.25, true, false, false]);
  assert.deepEqual([unrestInfluence(5000, 19), unrestInfluence(5000, 20), unrestInfluence(-5, 10)], [6250, 5000, 0]);
});

test('SEAT1d THE EDICTS AND THEIR NUMBERS: six for a palace (the crown\'s two CROWN1\'s), none twice running but Market Day; a Festival 2,500 / 10,000; the Levy a tenth (its fraction kept by the harvest\'s roll), the Bounty 20 a camp and 5 a day, the Festive +5 a game day, Curfew 5 levels and twice the reputation; levers for the Guildmaster and Officers, five an hour; a camp\'s pixel off its id (mutants: the list; the repeat; the costs; the shares; the caps; the pixel)', () => {
  // PIN MOVED (CROWN1): the crown's Conscription joins them, proclaimed at a crown alone (test/net/crown1_law.test.js)
  assert.deepEqual(Object.keys(EDICTS), ['market-day', 'open-gates', 'curfew', 'festival', 'levy', 'bounty', 'conscription', 'royal-tourney']);   // PIN MOVED (CROWN1 part two): and the Royal Tourney
  assert.deepEqual([edictOk('festival'), edictOk('royal-tourney'), edictOk('feast'), edictOk('toString'), edictOk(null)], [true, true, false, false, false]);   // PIN MOVED (CROWN1 part two): the Royal Tourney is an Edict now
  assert.deepEqual([edictMayFollow('market-day', 'market-day'), edictMayFollow('festival', 'festival'), edictMayFollow('festival', 'curfew'), edictMayFollow('festival', null), edictMayFollow('nope', null)], [true, false, true, true, false]);
  assert.deepEqual([edictCost('festival', 'palace'), edictCost('festival', 'crown'), edictCost('market-day', 'crown'), edictCost('nope', 'palace')], [2500, 10000, 0, 0]);
  assert.deepEqual([LEVY_SHARE, BOUNTY_MARKS, BOUNTY_CAMPS_DAY, FESTIVE.attributes, FESTIVE.gameDays, CURFEW.guardLevels, CURFEW.crimeFactor, SEAT_EDICTS_HOUR], [0.1, 20, 5, 5, 1, 5, 2, 5]);
  assert.deepEqual([...SEAT_LEVER_RANKS], [0, 1]);
  assert.deepEqual([levyOf(3, 0.29), levyOf(3, 0.3), levyOf(20, 0.99), levyOf(25, 0.49), levyOf(25, 0.5), levyOf(0, 0)], [1, 0, 2, 3, 2, 0]);
  assert.deepEqual([bountySitePixel('410,150:91'), bountySitePixel('410,150:91.2'), bountySitePixel('410,150:hold'), bountySitePixel('410,500:1'), bountySitePixel('x'), bountySitePixel(5)], [[410, 150], [410, 150], [410, 150], null, null, null]);
});

test('SEAT1d THE WORDS: an Edict\'s line with its cost; the holder\'s members\' lines (next week\'s Edict, Unrest, the upkeep, Neglect\'s debt); everyone\'s line (the Tithe, the Edict, Unrest); the arrival\'s news; the Chronicle\'s new rows (mutants: each line)', () => {
  assert.equal(edictLine('festival', 'palace'), 'Festival: Music and banners; everyone in the town is Festive, +5 to every attribute for a day. Standing +10. Costs 2,500 silver.');
  assert.equal(edictLine('market-day', 'palace'), 'Market Day: The town\'s shops ask a tenth less of everyone.');
  assert.equal(edictLine('nope', 'palace'), null);
  assert.deepEqual(seatHoldingLines(ANTICLERE, { standing: 15, tithe: 6, edict: null, next: 'levy', upkeep: 3125, owed: 2500 }), [
    'Proclaimed for next week: Levy.', 'Unrest: challengers earn a quarter more influence at Anticlere.',
    'Upkeep at the Turning: 3,125 silver from the treasury (the Tithe at most 10%).', 'Neglect: 2,500 silver of upkeep is owed with it, or the Charter lapses.',
  ]);
  assert.deepEqual(seatHoldingLines(ANTICLERE, { standing: 50, tithe: 0, next: null, upkeep: 2500, owed: 0 }), ['No Edict is proclaimed for next week.', 'Upkeep at the Turning: 2,500 silver from the treasury (the Tithe at most 10%).']);
  assert.equal(seatRuleLine(ANTICLERE, { tithe: 8, edict: 'market-day', standing: 50 }), 'Tithe 8%. Market Day is proclaimed.');
  assert.equal(seatRuleLine(ANTICLERE, { tithe: 0, edict: null, standing: 10 }), 'Tithe 0%. No Edict rules this week. Anticlere is in Unrest.');
  assert.equal(seatRuleLine(ANTICLERE, null), null);
  assert.equal(seatArrivalNews({ ...ANTICLERE, holder: { standing: 10, edict: 'curfew' } }), 'The town is in Unrest. A Curfew is proclaimed.');   // PIN MOVED (AUDIT-SEATS L7): its article
  assert.equal(seatArrivalNews({ ...ANTICLERE, holder: { standing: 50, edict: null } }), null);
  assert.equal(seatArrivalNews(ANTICLERE), null);
  const row = (kind, data) => chronicleLine({ kind, week: 4, data }, ANTICLERE);
  assert.equal(row('neglect', { guild: SH }), 'In week 4, the Silver Hand <SH> could not pay the upkeep of the Charter of Anticlere. Anticlere is in Neglect.');
  assert.equal(row('late', { guild: SH }), 'In week 4, the Silver Hand <SH> paid the upkeep it owed for the Charter of Anticlere.');
  assert.equal(row('lapse', { guild: SH }), 'In week 4, the Charter of Anticlere lapsed - the Silver Hand <SH> could not pay its upkeep two weeks running.');
  assert.equal(row('edict', { guild: SH, edict: 'festival' }), 'In week 4, the Silver Hand <SH> proclaimed a Festival at Anticlere.');   // PIN MOVED (AUDIT-SEATS L7)
  assert.equal(row('edict-unpaid', { guild: SH, edict: 'festival' }), 'In week 4, the Silver Hand <SH> could not pay for the Festival it proclaimed at Anticlere.');
});

test('SEAT1d THE TURNING\'S PLAN: each holder\'s upkeep in key order from what the claims left - paid, late (with the arrears), Neglect, lapse; a lapsing Charter is no siege\'s; Overreach cuts the defence; a challenger at a seat in Unrest wins on a quarter more; the coming Edict law where paid, unpaid where not (a Bounty\'s cost its set-aside); every held seat\'s Standing (mutants: the order; each state; the lapse\'s exclusion; the cut; the bonus; the Edict\'s purse)', () => {
  const held = (key, guild, guilds, o = {}, tier = 'palace') => ({ key, tier, holder: { guild, standing: 50, truceWeek: null, tithe: 6, watched: true, ...o }, guilds });
  let p = turningPlan({ week: 9, treasuries: new Map([['a', 4000]]), seats: [held(2, 'a', []), held(1, 'a', [])] });
  assert.deepEqual(p.upkeep.map((u) => [u.key, u.amount, u.paid, u.state]), [[1, 3125, 3125, 'paid'], [2, 3125, 0, 'neglect']], 'key order, one purse; two palaces: Overreach');
  assert.deepEqual(p.upkeep[1].owed, 3125);
  p = turningPlan({ week: 9, treasuries: new Map([['a', 5000]]), seats: [held(1, 'a', [], { owed: 2500 })] });
  assert.deepEqual([p.upkeep[0].state, p.upkeep[0].paid, p.standings[0].standing], ['late', 5000, 50], 'late: both weeks; -5 and +5');
  p = turningPlan({ week: 9, treasuries: new Map([['a', 4999], ['c', 0]]), seats: [held(1, 'a', [g('a', 100), g('c', 9000)], { owed: 2500 })] });
  assert.deepEqual([p.upkeep[0].state, p.rights, p.standings, p.held], ['lapse', [], [], []], 'a lapse: no Right against it, no Standing');
  // Overreach's cut: two seats, extra 1 - a defence of 6,650 at 7,000 influence, beaten by 6,700
  p = turningPlan({ week: 9, treasuries: new Map([['a', 99999]]), seats: [held(1, 'a', [g('a', 7000), g('c', 6700)]), held(2, 'a', [])] });
  assert.deepEqual(p.rights.map((r) => [r.key, r.guild, r.defence]), [[1, 'c', 6650]]);
  // Unrest: a challenger's 5,000 at Standing 15 is 6,250, past the line
  p = turningPlan({ week: 9, treasuries: new Map([['a', 9999]]), seats: [held(1, 'a', [g('a', 1000), g('c', 5000)], { standing: 15 })] });
  assert.deepEqual(p.rights.map((r) => [r.guild, r.total]), [['c', 6250]]);
  // the Edicts: a Festival paid after the upkeep; one the purse cannot pay; a Bounty's set-aside its cost
  p = turningPlan({ week: 9, treasuries: new Map([['a', 5000], ['b', 4000], ['d', 2600]]), seats: [held(1, 'a', [], { edict: 'festival' }), held(2, 'b', [], { edict: 'festival' }), held(3, 'd', [], { edict: 'bounty', setAside: 100 })] });
  assert.deepEqual(p.edicts.map((e) => [e.key, e.edict, e.cost, e.state]), [[1, 'festival', 2500, 'law'], [2, 'festival', 2500, 'unpaid'], [3, 'bounty', 100, 'law']]);
  assert.deepEqual(p.standings.map((s) => s.standing), [65, 55, 55], 'the Festival\'s +10 only where it became law');
  assert.deepEqual(p.held.map((h) => [h.key, h.standing]), [[1, 65], [2, 55], [3, 55]]);
  // the crown's scale reaches the plan
  p = turningPlan({ week: 9, active: 30, treasuries: new Map([['a', 99999]]), seats: [held(1, 'a', [], {}, 'crown')] });
  assert.equal(p.upkeep[0].amount, 6000);
});

test('SEAT1d THE CLIENT\'S OWN (systems/seatEdicts.js): a seat town\'s shops price for the holder\'s members; the arrival\'s news said, and a Festival\'s buff taken for a game day (+5 every attribute); Curfew\'s watch five levels stronger at night alone and its crimes twice the legal reputation; a Bounty\'s camps in its bailiwick alone - double loot, each one cleared claimed and its twenty said (mutants: the factor; the news; the buff\'s day; the night; the factor\'s home; the bailiwick; the claim)', async () => {
  let mins = 1000, here = 3021;
  const said = [], claims = [];
  let festiveCalls = 0;
  const seats = [{ ...ANTICLERE, holder: { guild: { id: 'g1' }, standing: 50, edict: 'curfew' } }, { ...ASHFIELD, holder: { guild: { id: 'g2' }, standing: 10, edict: 'bounty' } }];
  const at = (k) => seats.find((s) => s.key === k) ?? null;
  const e = createSeatEdicts({
    seatAt: (k) => at(k), here: () => here, seats: () => seats, guildId: () => 'g1', minutes: () => mins, say: (l) => said.push(l),
    regionAt: (px) => (px < 500 ? 21 : 34),
    claim: async (site, region) => { claims.push([site, region]); return { paid: 20 }; }, onFestive: () => { festiveCalls++; },
  });
  assert.equal(e.shopFactor({ townMapId: 3021 }), 0.9);
  assert.equal(e.shopFactor({ townMapId: 3022 }), 1, 'another guild\'s town');
  assert.equal(e.shopFactor({ townMapId: 77 }), 1);
  // CURFEW: at night alone, in the Curfew town alone
  assert.deepEqual([e.guardLevelBonus(23 * 60), e.guardLevelBonus(12 * 60), e.crimeFactor()], [CURFEW.guardLevels, 0, 2]);
  here = 3022;
  assert.deepEqual([e.guardLevelBonus(23 * 60), e.crimeFactor()], [0, 1]);
  // the arrival's news; a Festival's buff for a game day
  e.arrived(at(3022));
  assert.deepEqual(said, ['The town is in Unrest. A Bounty is proclaimed.']);   // PIN MOVED (AUDIT-SEATS L7)
  assert.equal(e.festive(), false);
  e.arrived({ ...ANTICLERE, holder: { guild: { id: 'g1' }, standing: 50, edict: 'festival' } });
  assert.deepEqual([said.at(-1), e.festive(), festiveCalls], [FESTIVE_TEXT, true, 1]);
  mins += 1439;
  assert.equal(e.festive(), true);
  mins += 1;
  assert.equal(e.festive(), false, 'a game day');
  assert.deepEqual(festiveMods(STAT_KEYS_ORDER).stats, Object.fromEntries(STAT_KEYS_ORDER.map((k) => [k, 5])));
  // THE BOUNTY: Ashfield's bailiwick alone
  assert.deepEqual([e.bountyAt(470, 160), e.bountyAt(405, 150), e.bountyAt(520, 130)], [true, false, false]);
  assert.equal(await e.campCleared('470,160:91'), 20);
  assert.equal(await e.campCleared('405,150:91'), 0);
  assert.equal(await e.campCleared(undefined), 0, 'a foe of no camp');
  assert.deepEqual(claims, [['470,160:91', 21]]);
  assert.equal(said.at(-1), bountyPaidText(20));
  // court.js: the host's factor doubles the legal loss alone
  const player = { legalRep: new Array(62).fill(0), factionRep: null };
  setCrimeRepFactor(() => 2);
  lowerRepForCrime(player, 21, CRIME_IDS.Pickpocketing, { curfew: true });   // PIN MOVED (AUDIT FB1021d SM-8): the town watch's charge alone
  const doubled = player.legalRep[21];
  lowerRepForCrime(player, 23, CRIME_IDS.Pickpocketing);   // a road's report, a loan defaulted: no crime in the town stood in
  const plain = player.legalRep[23];
  setCrimeRepFactor(null);
  assert.equal(doubled, 2 * plain, 'AUDIT FB1021d SM-8: the Curfew doubles the watch\'s charge, not a charge laid while standing there');
  lowerRepForCrime(player, 22, CRIME_IDS.Pickpocketing);
  assert.equal(doubled, 2 * player.legalRep[22]);
  assert.ok(player.legalRep[22] < 0);
});

test('SEAT1d THE SEAT TAB\'S LEVERS: the holder\'s Officer sees the Tithe and its Set (none once set this week), the Edicts it may proclaim (not this week\'s again, but Market Day) with their words, a Bounty\'s set-aside, the take-back; a Member sees the lines and no lever; everyone sees the Tithe and the Edict (mutants: the levers\' rank; the week\'s one change; the repeat rule; the calls)', async () => {
  const tick = (n = 4) => new Promise((r) => { let i = 0; const go = () => (++i >= n ? r() : setTimeout(go, 0)); setTimeout(go, 0); });
  const noticeBook = { seenAt: () => null, read: async () => ({ board: { notes: [], notices: [], me: {} } }), markSeen: () => {}, cached: () => null, draft: () => ({ subject: '', body: '', days: 7, button: '' }), noticeDraft: () => ({ subject: '', body: '', days: 3 }), readGuild: async () => ({ data: null, error: 'no-guild' }) };
  const acts = [];
  const now = 1_800_000_000;
  const data = (rank, holding) => ({
    seat: ANTICLERE, week: 16, phase: 'muster', reckoningAt: now + 3600, turningAt: now + 86400, defence: 4500,
    holder: { guild: SH, since: 3, standing: 55, tithe: 6, edict: 'festival' }, battle: null, standings: [], chronicle: [],
    mine: { guild: 'g1', rank, seasoned: true, bound: 'g1', pledges: [{ region: 21, key: 3021, held: true }], influence: 0, tributeRoom: 0 },
    holding,
  });
  const mount = (rank, holding) => {
    const host = document.createElement('div');
    const seatBook = {
      open: true, standings: async () => ({ data: data(rank, holding), error: null }), pledge: async () => ({ ok: true }), unpledge: async () => ({ ok: true }), tribute: async () => ({ ok: true }),
      tithe: async (s, pct) => { acts.push(['tithe', s.key, pct]); return { ok: true, text: 'set' }; },
      edict: async (s, e, aside) => { acts.push(['edict', s.key, e, aside]); return { ok: true, text: 'proclaimed' }; },
    };
    const v = mountNoticeBoard(host, { town: { name: 'Anticlere', mapId: 3021 }, book: noticeBook, nowS: () => now, seat: { seat: ANTICLERE, book: seatBook } });
    byClass(host, 'notice-tab')[1].onclick();
    return { host, v };
  };
  const holding = { standing: 55, tithe: 6, titheWeek: 15, edict: 'festival', next: 'curfew', upkeep: 2500, owed: 0 };
  const { host, v } = mount(1, holding);
  await tick();
  assert.match(host.textContent, /Tithe 6%\. A Festival is proclaimed\./);   // PIN MOVED (AUDIT-SEATS L7): its article
  assert.match(host.textContent, /Proclaimed for next week: Curfew\./);
  assert.match(host.textContent, /Upkeep at the Turning: 2,500 silver/);
  const opts = byClass(host, 'notice-seat-edict')[0].children.map((o) => o.value);
  assert.deepEqual(opts, ['market-day', 'open-gates', 'curfew', 'levy', 'bounty'], 'this week\'s Festival not offered again');
  byClass(host, 'notice-seat-tithe')[0].value = '9';
  byClass(host, 'notice-seat-tithe')[0].oninput();
  byClass(host, 'notice-seat-tithe-set')[0].click();
  await tick();
  byClass(host, 'notice-seat-edict-set')[0].click();
  await tick();
  byClass(host, 'notice-seat-edict-back')[0].click();
  await tick();
  assert.deepEqual(acts, [['tithe', 3021, 9], ['edict', 3021, 'curfew', 0], ['edict', 3021, null, undefined]]);
  v.unmount();
  const set = mount(0, { ...holding, titheWeek: 16, next: null });
  await tick();
  assert.equal(byClass(set.host, 'notice-seat-tithe-set').length, 0, 'set this week: no second');
  assert.match(set.host.textContent, /The Tithe has been set this week\./);
  assert.equal(byClass(set.host, 'notice-seat-edict-back').length, 0, 'nothing to take back');
  set.v.unmount();
  const member = mount(2, holding);
  await tick();
  assert.equal(byClass(member.host, 'notice-seat-edict').length, 0, 'a Member: no lever');
  assert.match(member.host.textContent, /Upkeep at the Turning/);
  member.v.unmount();
  const stranger = mount(2, undefined);
  await tick();
  assert.match(stranger.host.textContent, /Tithe 6%\. A Festival is proclaimed\./, 'everyone\'s line');
  assert.doesNotMatch(stranger.host.textContent, /Upkeep at the Turning/);
  stranger.v.unmount();
});

test('SEAT1d THE HOSTS BY SOURCE: the service\'s routes and the Turning\'s writes; the market\'s Tithe lines and the board\'s pixel; the Levy in a harvest; Open Gates in the town\'s homes; the client\'s shops, arrival, Festive fold, Curfew watch and crimes, Bounty loot and claims, and the market tab\'s board (mutants: each seam)', () => {
  const idx = rd('server-account/src/index.js');
  for (const r of ['tithe', 'edict', 'bounty']) assert.ok(rd('server-account/src/service.js').includes(`'/v1/seats/${r}'`), r);
  assert.match(idx, /'\/v1\/seats\/tithe': \(\) => setTithe\(ctx, who\.player, env, body\),/);
  assert.match(idx, /'\/v1\/seats\/edict': \(\) => proclaimEdict\(ctx, who\.player, env, body\),/);
  assert.match(idx, /'\/v1\/seats\/bounty': \(\) => claimBounty\(ctx, who\.player, env, body\),/);
  assert.match(idx, /const r = await homesInTown\(ctx, who\.player, body, \{ seats: seatsOpenFor\(who\.player, env\) \}\);/);
  const tu = rd('server-account/src/seatTurning.js');
  // PIN MOVED (SEASON1): the plan reckoned, then Season 0's end stripping what it sets up for the next
  assert.match(tu, /const reckonedPlan = turningPlan\(\{ week, seats, treasuries: new Map\(purses\.map\(\(p\) => \[p\.guild_id, Number\(p\.balance\)\]\)\), active: await activeIn\(db, week\) \}\);/);
  const mk = rd('server-account/src/market.js');
  assert.match(mk, /at \? null : titheAt\(db, nowS, from, rowBoard\(l\)\),/);   // PIN MOVED (MARKET-SPEED): a buy asks its Tithes beside its hubs
  assert.match(mk, /at \|\| from === region \? null : titheAt\(db, nowS, region, boardOf\(board\)\),/);
  assert.match(mk, /const ct = road\.courier > 0 \? await titheAt\(db, nowS, region, boardOf\(board\)\) : null;/);
  assert.match(mk, /const tt = high == null \? null : await titheAt\(db, nowS, Number\(a\.region\), rowBoard\(a\)\);/);
  const pr = rd('server-account/src/professions.js');
  assert.match(pr, /!deep && !isBody && seatsOpenFor\(player, env\) \? levyAt\(db, nowS, region, \[n\.x, n\.y\]\) : null,/);   // PIN MOVED (GATHER-SPEED): asked beside the ground and the track, at once
  assert.match(pr, /\.bind\(player\.id, rid, nonce, character, key2, day, node, kind, profession, kept, ROOM,/);   // PIN MOVED (BAG1): the bound is the Stores' or the bag's carried count's (ROOM)
  const w = rd('src/scenes/world.js');
  assert.match(w, /else if \(hub\) townTalk\.say\(hubArrivalLine\(hub\), 5\);\n\s*if \(seat\) seatEdicts\.arrived\(seat\);/);
  assert.match(w, /seatShopFactor: \(b\) => seatEdicts\.shopFactor\(b\),/);
  assert.match(w, /registerEntityFold\(FESTIVE_FOLD, \(e\) => \(e === playerEntity && seatEdicts\.festive\(\) \? festiveMods\(STAT_KEYS_ORDER\) : EMPTY_MODS\)\);/);
  assert.match(w, /setCrimeRepFactor\(\(\) => seatEdicts\.crimeFactor\(\)\);/);
  assert.match(w, /levelBonus: \(\) => seatEdicts\.guardLevelBonus\(Math\.floor\(skyMinutes\(\)\)\),/);   // PIN MOVED (AUDIT SEATS-3 E1): the sky's night
  assert.match(w, /if \(seatEdicts\.bountyAt\(p\.px, p\.py\)\) items\.push\(\.\.\.generateLootItems\(lootKey,/);
  assert.match(w, /sigilDrinks\(xp\); seatEdicts\.campCleared\(foe\?\.site\)\.catch\(\(\) => \{\}\); \}\);/);
  assert.match(w, /minutes: \(\) => worldMinutes\(\),\n\s*regionAt: \(px, py\) => maps\.getRegionIndexAt\(px, py\),/);   // PIN MOVED (AUDIT SEATS-3 F5): the edicts' own, not REP4's
  assert.match(w, /board: \[town\.px, town\.py\],/);
  const wm = rd('src/scenes/worldModes.js');
  // PIN MOVED (TOWN-ECON TE1, test/systems/townecon.test.js): the town's factor first (online, the seat's folded in), the seat's alone without it
  assert.match(wm, /const f = host\.townShopFactor\?\.\(b, mode\) \?\? \(mode === 'Buy' \|\| mode === 'Repair' \? host\.seatShopFactor\?\.\(b\) \?\? 1 : mode === 'Sell' \|\| mode === 'SellMagic' \? Math\.min\(1, host\.seatShopFactor\?\.\(b\) \?\? 1\) : 1\);/);   // PIN MOVED (AUDIT TOWN-ECON 2 PRICE-4): with no town law wired, a sale held to the seat's factor
  assert.match(wm, /priceAdjustment: shopAdjustment\(b, mode\),/);
  assert.match(wm, /priceAdjustment: shopAdjustment\(b, 'Buy'\) \}\);/);   // (main's #500 reverted MANA-SHOP's buyer level: the pin is back where SEAT1d set it)
  assert.match(wm, /priceAdjustment: shopAdjustment\(b, 'Repair'\),/);
  const cg = rd('src/scenes/cityGuards.js');
  assert.match(cg, /level \?\? effectiveLevel\(playerEntity\) \+ \(levelBonus\?\.\(\) \?\? 0\)/);
  const mt = rd('src/ui/marketTab.js');
  assert.equal((mt.match(/hubs: m\.hubs, \.\.\.at\(\)/g) ?? []).length, 4, 'the board on a buy, a material listing, a piece listing and an auction');
  assert.match(mt, /const at = \(\) => \(m\.board \? \{ board: m\.board \} : \{\}\);/);
});

test('SEAT1d THE ECONOMY MODEL (tools/seatEconomy.mjs): seeded and the same each run; each size\'s influence ordered p10 <= p50 <= p90; the upkeep\'s shares read off the law (2,500 and 15,000 at a hundred accounts over the median writ income); a twelve-member guild\'s median clears a palace; a member\'s week never past the account\'s 2,000 (mutants: the law it reads; the cap)', () => {
  const a = runModel({ runs: 60, seed: 3 });
  assert.deepEqual(a, runModel({ runs: 60, seed: 3 }), 'the same run');
  assert.deepEqual(a.map((r) => r.size), [...SIZES]);
  for (const r of a) {
    assert.ok(r.p10 <= r.p50 && r.p50 <= r.p90);
    assert.equal(r.palaceShare, SEAT_UPKEEP.palace / r.writP50);
    assert.equal(r.crownShare, SEAT_UPKEEP.crown / r.writP50);
  }
  const twelve = runModel({ runs: 200, seed: 1, sizes: [12] })[0];
  assert.ok(twelve.p50 >= CLAIM_THRESHOLD.palace, `a twelve-member guild's median (${twelve.p50}) clears a palace`);
  const r = seeded(9);
  for (let i = 0; i < 200; i++) assert.ok(memberWeek('hardcore', r).influence <= 2000);
  assert.deepEqual(Object.keys(PROFILES), ['casual', 'regular', 'hardcore']);
});
