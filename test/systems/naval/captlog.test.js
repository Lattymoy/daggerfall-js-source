// CAPT-LOG, CAPT-PAY and the law of CAPT-MARQUE (2026-10-11, the owner: "make the decisions and completely make this as
// detailed as possible, providing depth without overcomplicating systems") - THE CAPTAIN'S LEDGER (bible/03-World/
// Captains-Sea.md): the log, the three crowns' regard and the ranks it earns with each - and their favours, none while the
// crown hunts the captain - boarders thrown back paid as a pirate's end, and the letter of marque that makes a rival's
// lawful ship that rival's grievance alone. tools/mutants/captlog.json.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createCaptainLedger, crownRankOf, nextRankOf, CROWN_RANKS, RANK_PERKS, perksOf, PERKS_REFUSED_AT, standingFor, DEED_STANDING, PIRACY_STANDING, MARQUE_STANDING,
  LEGEND_STANDING, CROWN_STANDING_MAX, CROWN_STANDING_MIN, LEAGUE_M, logLines, leagueWords, CAPTAIN_SAVE_VENDOR, CAPTAIN_SAVE_VERSION, newLog,
} from '../../../src/systems/naval/captainLedger.js';
import { lawOf, PIRATE_REWARD, crownRegion } from '../../../src/systems/naval/navalLaw.js';
import { classById, flagOf, FLAG_HOME_SHARE, CROWNS } from '../../../src/systems/naval/navalShips.js';
import { perkWords, standingMeter } from '../../../src/ui/captainPage.js';
import { CRIMES } from '../../../src/systems/crimes.js';
import { sea } from '../../navalSea.mjs';
import { GRAPPLE_S } from '../../../src/systems/naval/navalBoarding.js';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const sloop = classById('pirateSloop'), brig = classById('pirateBrig'), flag = classById('pirateFlagship');
const coaster = classById('merchantCoaster'), cutter = classById('navyCutter');

test('CAPT-LOG the ranks: a crown names a captain Sworn Captain at 15, Privateer at 50, Commodore at 120, Admiral at 250 - and the next rank\'s want (mutants: each threshold, the ladder\'s order)', () => {
  assert.deepEqual(CROWN_RANKS.map((r) => [r.rank, r.at, r.title]), [[0, -Infinity, 'Unsworn'], [1, 15, 'Sworn Captain'], [2, 50, 'Privateer'], [3, 120, 'Commodore'], [4, 250, 'Admiral']]);
  assert.deepEqual([-40, 0, 14, 15, 49, 50, 119, 120, 249, 250, 999].map((s) => crownRankOf(s).title),
    ['Unsworn', 'Unsworn', 'Unsworn', 'Sworn Captain', 'Sworn Captain', 'Privateer', 'Privateer', 'Commodore', 'Commodore', 'Admiral', 'Admiral']);
  assert.deepEqual([nextRankOf(10).rank.title, nextRankOf(10).wanting], ['Sworn Captain', 5]);
  assert.deepEqual([nextRankOf(-20).wanting], [35], 'a captain in disgrace climbs from where they stand');
  assert.equal(nextRankOf(300), null, 'an Admiral has no next');
});

test('CAPT-LOG what a rank brings in its crown\'s harbours: the table - the shipwright, the board\'s pay and offers, the letter of marque from Privateer, the Admiralty\'s Carrack and seasoned hands from Commodore, the navy\'s answer an Admiral\'s - and nothing at all while the crown hunts the captain (mutants: each favour, the refusal)', () => {
  assert.deepEqual(RANK_PERKS.map((p) => [p.yard, p.pay, p.offers, p.marque, p.admiralty, p.seasoned, p.relief]), [
    [0, 0, 0, false, false, false, false],
    [0.05, 0.1, 1, false, false, false, false],
    [0.1, 0.2, 1, true, false, false, false],
    [0.15, 0.3, 2, true, true, true, false],
    [0.2, 0.4, 2, true, true, true, true],
  ]);
  assert.equal(PERKS_REFUSED_AT, 25, 'one of the plate\'s anchors');
  assert.equal(perksOf(4, 24), RANK_PERKS[4]);
  assert.equal(perksOf(4, 25), RANK_PERKS[0], 'hunted: no favours');
  assert.equal(perksOf(9), RANK_PERKS[4], 'past the top, the top');
  // PIN MOVED (AUDIT CAPTAIN'S SEA B15): the discount the shipwright's repairs and powder - his stores and grog are what they cost
  assert.equal(perkWords(RANK_PERKS[3]), 'the shipwright\'s repairs and powder 15% off - the harbor board pays 30% more, 2 more offers a day - a letter of marque - the Admiralty\'s Carrack - seasoned hands hired');
  assert.equal(perkWords(RANK_PERKS[0]), '');
});

test('CAPT-LOG what a deed is worth with a crown: a pirate\'s end her size (cargo) times sunk 2, taken 3, repelled 2; piracy against a lawful ship its own (fire -5, sink -8, board -10); a rival\'s ship under a letter of marque her size times 2 sunk, 3 taken (mutants: each weight, the size, the marque\'s)', () => {
  assert.deepEqual(DEED_STANDING, { sunk: 2, taken: 3, repelled: 2 });
  assert.deepEqual(PIRACY_STANDING, { fire: -5, sink: -8, board: -10 });
  assert.deepEqual(MARQUE_STANDING, { sink: 2, board: 3 });
  assert.deepEqual([standingFor('sink', sloop), standingFor('board', sloop), standingFor('repel', sloop)], [2, 3, 2], 'a sloop, size 1');
  assert.deepEqual([standingFor('sink', brig), standingFor('board', brig)], [4, 6], 'a brigantine, size 2');
  assert.deepEqual([standingFor('sink', flag), standingFor('board', flag), standingFor('repel', flag)], [8, 12, 8], 'a flagship, size 4');
  assert.equal(standingFor('fire', sloop), 0, 'a shot at a pirate is nothing yet');
  assert.deepEqual([standingFor('fire', coaster), standingFor('sink', coaster), standingFor('board', cutter)], [-5, -8, -10]);
  assert.deepEqual([standingFor('sink', coaster, { marque: true }), standingFor('board', cutter, { marque: true }), standingFor('fire', coaster, { marque: true })], [2, 6, 0]);
  assert.equal(standingFor('sink', null), 0);
});

test('CAPT-LOG the ledger: a deed logged by her trade and her crown\'s regard moved (a marque\'s to the letter\'s crown); a legend\'s end every crown\'s, once; the Eltheric Ocean\'s ships no crown\'s; regard kept in its band; a rank crossed said once, up and down (mutants: the trade, the marque\'s crown, the legend, the band, the changes)', () => {
  const l = createCaptainLedger();
  l.deed('sink', brig, { crown: 'Wayrest' });
  l.deed('board', sloop, { crown: 'Wayrest' });
  l.deed('repel', sloop, { crown: 'Sentinel' });
  assert.deepEqual([l.log.sunk.pirate, l.log.taken.pirate, l.log.repelled], [1, 1, 1]);
  assert.deepEqual([l.standing('Wayrest'), l.standing('Sentinel'), l.standing('Daggerfall')], [7, 2, 0]);
  l.deed('sink', coaster, { crown: 'Sentinel', marque: 'Daggerfall' });
  assert.deepEqual([l.log.sunk.merchant, l.standing('Daggerfall'), l.standing('Sentinel')], [1, 2, 2], 'the letter\'s crown\'s regard - the rival\'s is the host\'s to lower');
  l.deed('fire', coaster, { crown: 'Wayrest' });
  assert.equal(l.standing('Wayrest'), 2, 'piracy: 7 - 5');
  const changes = l.deed('sink', classById('pirateBrig'), { trade: 'legend', legend: 'The Pale Queen' });
  assert.deepEqual(changes, [], 'no rank crossed by ten');
  assert.deepEqual([l.standing('Daggerfall'), l.standing('Wayrest'), l.standing('Sentinel')], [12, 12, 12], 'every crown hears of a legend');
  assert.deepEqual(l.log.legends, ['The Pale Queen']);
  l.deed('board', classById('pirateBrig'), { trade: 'legend', legend: 'The Pale Queen' });
  assert.deepEqual([l.standing('Daggerfall'), l.log.legends.length], [12, 1], 'a legend ends once');
  l.deed('sink', brig, { trade: 'ether', crown: 'Wayrest' });
  assert.deepEqual([l.log.sunk.ether, l.standing('Wayrest')], [1, 12], 'the Eltheric Ocean knows no crown');
  l.takeRankChanges();
  const up = l.regard('Wayrest', 3);
  assert.deepEqual([up.crown, up.from.title, up.to.title], ['Wayrest', 'Unsworn', 'Sworn Captain']);
  assert.equal(l.regard('Wayrest', 1), null, 'no rank crossed, nothing said');
  const down = l.regard('Wayrest', -10);
  assert.deepEqual([down.from.title, down.to.title], ['Sworn Captain', 'Unsworn']);
  assert.equal(l.takeRankChanges().length, 2, 'read once');
  assert.equal(l.takeRankChanges().length, 0);
  l.regard('Sentinel', 5000);
  assert.equal(l.standing('Sentinel'), CROWN_STANDING_MAX);
  l.regard('Sentinel', -9000);
  assert.equal(l.standing('Sentinel'), CROWN_STANDING_MIN);
  assert.equal(l.regard('Morrowind', 10), null, 'no such crown');
});

test('CAPT-LOG the log\'s counts: the notes, the leagues (a frame\'s nonsense refused), the richest prize kept while none richer comes, the deepest Eltheric waters; a letter of marque held on the captain\'s own clock until its end, torn up at will (mutants: each count, the prize\'s keep, the letter\'s end)', () => {
  const l = createCaptainLedger();
  for (const f of ['claimed', 'maps', 'islands']) l.note(f);
  l.note('plunder', 1250.7); l.note('earned', 900); l.note('traded', 400); l.note('bounty'); l.note('bounty'); l.note('salvage');
  l.note('plunder', -50); l.note('plunder', NaN);
  assert.deepEqual([l.log.claimed, l.log.maps, l.log.islands, l.log.plunder, l.log.earned, l.log.traded, l.log.contracts.bounty, l.log.contracts.salvage], [1, 1, 1, 1250, 900, 400, 2, 1]);
  l.sailed(LEAGUE_M * 2); l.sailed(-5); l.sailed(1e9);
  assert.equal(leagueWords(l.log.sailed), '2.0 leagues');
  l.prize('The Red Wake', 800); l.prize('The Gilded Cog', 500); l.prize('The Sea Hag', 1200); l.prize('A Sloop', 300);
  assert.deepEqual(l.log.best, { name: 'The Sea Hag', worth: 1200 }, 'a lesser prize after it changes nothing');
  l.deepest(3); l.deepest(2);
  assert.equal(l.log.deepest, 3);
  assert.equal(l.marque(100), null);
  l.setMarque('Wayrest', 5000);
  assert.deepEqual(l.marque(4999), { crown: 'Wayrest', until: 5000 });
  assert.equal(l.marque(5000), null, 'its last minute is its end');
  l.setMarque('Morrowind', 9000);
  assert.equal(l.marque(10).crown, 'Wayrest', 'no such crown signs a letter');
  assert.deepEqual(l.tearMarque(), { crown: 'Wayrest', until: 5000 });
  assert.equal(l.marque(10), null);
});

test('CAPT-LOG the save: its own slot (Captain, v1) - the log, the crowns\' regard and the letter kept whole; a record\'s junk cleaned field by field, never thrown (mutants: a field dropped, the band on a load, the letter\'s crown)', () => {
  assert.equal(CAPTAIN_SAVE_VENDOR, 'Captain');
  assert.equal(CAPTAIN_SAVE_VERSION, 1);
  const a = createCaptainLedger();
  a.deed('sink', flag, { crown: 'Sentinel' }); a.note('claimed'); a.note('plunder', 640); a.note('earned', 75); a.sailed(9000); a.prize('X', 50); a.setMarque('Sentinel', 777); a.deed('sink', sloop, { trade: 'legend', legend: 'Bloodwake' });
  const b = createCaptainLedger();
  b.restoreSaveData(JSON.parse(JSON.stringify(a.getSaveData())));
  assert.deepEqual(b.getSaveData(), a.getSaveData());
  assert.deepEqual(b.newSaveData(), { v: 1, log: newLog(), standing: { Daggerfall: 0, Wayrest: 0, Sentinel: 0 }, marque: null, contracts: [], taken: [], dealt: null, charts: [], raised: [], ether: { charted: [], legends: {}, harvested: {}, from: null, crossings: 0, heard: [], season: null, fleets: [], wrack: [] }, tree: ['helm'] });   // PIN MOVED (SEA-SEASON): and no season's figures; (AUDIT SEA VENTURES D2, D4, D6): no fleet ended, no wrack hauled   // CAPTAIN-TREE: and the captain's sky, the Helm alone (PIN MOVED); CAPT-BOARD: and the contracts held, the board's taken; CAPT-TRADE: the day's dealing; ETHER-SEA: the captain's Eltheric Ocean - PIN MOVED (AUDIT CAPTAIN'S SEA B8): and the caches raised
  const c = createCaptainLedger();
  c.restoreSaveData({ log: { sunk: { pirate: -4, merchant: 'x' }, plunder: 1e20, legends: [5, 'Ok'], best: { name: 3 } }, standing: { Wayrest: 5000, Daggerfall: 'q', Morrowind: 9 }, marque: { crown: 'Morrowind', until: 10 } });
  assert.deepEqual([c.log.sunk.pirate, c.log.sunk.merchant, c.log.legends, c.log.best], [0, 0, ['Ok'], null]);
  assert.ok(Number.isSafeInteger(c.log.plunder));
  assert.deepEqual([c.standing('Wayrest'), c.standing('Daggerfall'), c.standing('Morrowind')], [CROWN_STANDING_MAX, 0, 0]);
  assert.equal(c.marque(0), null);
  c.restoreSaveData(null);
  assert.deepEqual(c.getSaveData(), c.newSaveData());
});

test('CAPT-LOG the log in words, and the page\'s meter: the counts that stand (the first three always), by trade; a rank\'s meter from its floor to the next rank\'s, full at the top (mutants: a line, the meter\'s floor)', () => {
  const l = createCaptainLedger();
  assert.deepEqual(logLines(l.log), [['Ships sunk', 'none'], ['Ships taken', 'none'], ['Leagues sailed', '0.0 leagues']]);
  l.deed('sink', brig, { crown: 'Wayrest' }); l.deed('sink', coaster, { crown: 'Wayrest' }); l.deed('board', cutter, { crown: 'Wayrest' }); l.note('earned', 1200); l.note('hunt');
  const lines = Object.fromEntries(logLines(l.log));
  assert.equal(lines['Ships sunk'], '2 - 1 pirate, 1 merchantman');   // PIN MOVED (AUDIT CAPTAIN'S SEA L11): one is one
  assert.equal(lines['Ships taken'], '1 - 1 crown\'s ship');   // PIN MOVED (AUDIT CAPTAIN'S SEA L11)
  assert.equal(lines['Contracts done'], '1 - 1 hunt');
  assert.equal(lines['Contract purses'], '1,200 gold');
  assert.deepEqual(standingMeter(30, crownRankOf(30)), { now: 15, max: 35, label: '20 to Privateer' });
  // PIN MOVED (AUDIT CAPTAIN'S SEA L5): below nothing, the meter's floor the standing itself and its label what the next
  // rank still wants (it read "15 to Sworn Captain" at -10)
  assert.deepEqual(standingMeter(-10, crownRankOf(-10)), { now: 0, max: 25, label: '25 to Sworn Captain' });
  assert.deepEqual(standingMeter(5, crownRankOf(5)), { now: 5, max: 15, label: '10 to Sworn Captain' });
  assert.deepEqual(standingMeter(400, crownRankOf(400)), { now: 1, max: 1, label: 'The highest rank' });
});

test('CAPT-MARQUE a ship\'s colours: a crown\'s ship flies her crown\'s; a merchantman her home port\'s crown about FLAG_HOME_SHARE of the time where her region is a crown\'s, else one of the three by her seed; a pirate none - the same on every client (mutants: the navy\'s, the home share, the pirate\'s none)', () => {
  assert.equal(flagOf(cutter, 7, 23), 'Wayrest');
  assert.equal(flagOf(sloop, 7, 23), null, 'the black flag');
  assert.equal(flagOf(coaster, 1234, 20), flagOf(coaster, 1234, 20), 'her seed\'s');
  let home = 0;
  const N = 3000;
  for (let i = 0; i < N; i++) if (flagOf(coaster, i * 7919 + 13, 20) === 'Sentinel') home++;
  const expect = FLAG_HOME_SHARE + (1 - FLAG_HOME_SHARE) / 3;
  assert.ok(Math.abs(home / N - expect) < 0.03, `Sentinel's own about ${expect.toFixed(2)} (${(home / N).toFixed(3)})`);
  const any = new Set();
  for (let i = 0; i < 300; i++) any.add(flagOf(coaster, i, 31));
  assert.deepEqual([...any].sort(), CROWNS.map((c) => c.name).sort(), 'from the sea\'s own region, any of the three');
});

test('CAPT-PAY the law: boarders thrown back are a pirate\'s end - `repel` rewarded as PIRATE_REWARD.repelled (a flagship\'s as hers) in the crown\'s waters; nothing for a lawful ship\'s (mutants: the act unread, the flagship\'s)', () => {
  const wr = crownRegion('Wayrest');
  assert.deepEqual(PIRATE_REWARD.repelled, { legal: 1, knightly: 1, temple: 0 });
  assert.deepEqual(lawOf('repel', sloop, { crown: 'Wayrest' }).rewards, [{ ...PIRATE_REWARD.repelled, region: wr }]);
  assert.deepEqual(lawOf('repel', flag, { crown: 'Wayrest' }).rewards, [{ ...PIRATE_REWARD.flagship, region: wr }]);
  assert.deepEqual(lawOf('repel', coaster, { crown: 'Wayrest' }), { crimes: [], notoriety: [], rewards: [] });
});

/** A sea with a ledger at the host's `captain` seam and the law's three recorded. */
async function ledgerSea(o = {}) {
  const s = await sea({ hull: 2, ...o });
  const ledger = createCaptainLedger();
  const law = { crimes: [], legal: [], faction: [] };
  s.deps.law = { crime: (r, c) => law.crimes.push([r, c]), legal: (r, n) => law.legal.push([r, n]), faction: (id, n) => law.faction.push([id, n]) };
  let held = null;
  s.deps.captain = {
    deed: (act, cls, opts) => ledger.deed(act, cls, opts), regard: (c, n) => ledger.regard(c, n), note: (f, n) => ledger.note(f, n), sailed: (m) => ledger.sailed(m),
    prize: (n, w) => ledger.prize(n, w), marque: () => held, tearMarque: () => { const was = held; held = null; return was; },
  };
  return { ...s, ledger, law, hold: (crown) => { held = crown ? { crown, until: 1e9 } : null; }, held: () => held };
}

test('CAPT-LOG at sea: the host charges the ledger with the law - a pirate sunk in Wayrest\'s waters logged and Wayrest\'s regard raised; boarders thrown back paid and logged (a flagship\'s raid quest pays its own repute, the ledger still told); a lawful ship\'s piracy logged and its crown\'s regard lowered (mutants: the ledger untold, the repel unpaid, the quest paid twice)', async () => {
  const s = await ledgerSea({ where: { region: 23, capitals: [{ region: 23, x: 100, y: 100 }] } });
  const p = s.host.spawnShip('pirateBrig');
  s.host._charge('sink', p);
  assert.deepEqual([s.ledger.log.sunk.pirate, s.ledger.standing('Wayrest')], [1, 4]);
  assert.deepEqual(s.law.legal, [[23, PIRATE_REWARD.sunk.legal]]);
  const r = s.host.spawnShip('pirateSloop');
  s.host._charge('repel', r);
  assert.deepEqual([s.ledger.log.repelled, s.ledger.standing('Wayrest')], [1, 6]);
  assert.deepEqual(s.law.legal.at(-1), [23, PIRATE_REWARD.repelled.legal], 'the repel paid');
  const before = s.law.legal.length;
  const f = s.host.spawnShip('pirateFlagship');
  s.host._charge('repel', f, { questPays: true });
  assert.equal(s.law.legal.length, before, 'WAQ_SHIP_ATTACK_PIRATE pays its own repute');
  assert.equal(s.ledger.log.repelled, 2, 'the ledger still told');
  const m = s.host.spawnShip('merchantGalleon');
  s.host._charge('fire', m);
  assert.deepEqual(s.law.crimes, [[23, CRIMES.Piracy]]);
  assert.equal(s.ledger.standing('Wayrest'), 6 + 8 + PIRACY_STANDING.fire, 'a flagship\'s 8 and piracy\'s -5');
});

test('CAPT-MARQUE at sea: under a letter a RIVAL\'s lawful ship struck is the rival\'s grievance - its crime, its notoriety, its regard lost - and the letter\'s crown\'s regard won; the signing crown\'s navy looks on; a ship of the letter\'s own crown tears it up and is piracy as ever (mutants: the rival\'s crown, the signer\'s gain, the tear, the witness)', async () => {
  const s = await ledgerSea({ where: { region: 23, capitals: [{ region: 23, x: 100, y: 100 }] } });
  s.hold('Wayrest');
  const m = s.host.spawnShip('merchantGalleon');
  const e = s.host._sea.get(m);
  e.ship.flag = 'Sentinel';
  s.host._charge('board', m);
  assert.deepEqual(s.law.crimes, [[crownRegion('Sentinel'), CRIMES.Piracy]], 'Sentinel\'s grievance, never Wayrest\'s');
  assert.ok(s.host.notoriety.get('Sentinel') > 0 && s.host.notoriety.get('Wayrest') === 0);
  assert.deepEqual([s.ledger.standing('Wayrest'), s.ledger.standing('Sentinel')], [MARQUE_STANDING.board * 3, PIRACY_STANDING.board], 'a galleon is size 3');
  assert.ok(s.held(), 'the letter stands');
  const own = s.host.spawnShip('merchantGalleon');
  s.host._sea.get(own).ship.flag = 'Wayrest';
  s.host._charge('fire', own);
  assert.equal(s.held(), null, 'torn up');
  assert.ok(s.log.mid.some((t) => /letter of marque is revoked/.test(t)));
  assert.deepEqual(s.law.crimes.at(-1), [crownRegion('Wayrest'), CRIMES.Piracy]);
  const host = rd('src/scenes/naval/navalHost.js');
  assert.match(host, /for \(const w of sea\.values\(\)\) if \(w\.ship\.cls\.faction === 'navy' && w\.ship\.flag !== signed && dist2d\(w\.ship\.pos, s\.pos\) < WITNESS_RANGE\) provoke\(w\.ship, by, clock\);/, 'the signing crown\'s navy looks on');
  assert.match(host, /ship\.flag = ether \? etherFlagOf\(cls\) : flagOf\(cls, spec\.seed, region\);/, 'every ship launched with her colours (ETHER-SEA: a trader of the Eltheric Ocean the Isles\')');
});

test('CAPT-LOG the world\'s wiring: one ledger a world host, in its own save slot whether the sea runs or not; the deeds\' rank changes said on the screen\'s middle; the letter read on the captain\'s own clock; plunder\'s worth handed in; the leagues at the helm; the Captain page on the Holdings rail after the Fleet (mutants: the slot, the clock, the say)', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /const captainLedger = createCaptainLedger\(\);/);
  // PIN MOVED (AUDIT CAPTAIN'S SEA L9): the ledger's own slot, a load dropping the rank lines still waiting to be said
  assert.match(w, /registerModSaveData\(CAPTAIN_SAVE_VENDOR, \{ \.\.\.captainLedger, restoreSaveData: \(r\) => \{ _rankLines\.length = 0; captainLedger\.restoreSaveData\(r\); \} \}\);/);
  assert.match(w, /marque: \(\) => captainLedger\.marque\(Math\.floor\(playerTicker\.ownMinutes\)\),/);
  assert.match(w, /deed: \(act, cls, o\) => \{ const r = captainLedger\.deed\(act, cls, o\); captainSay\(\); return r; \},/);
  assert.match(w, /worth: \(items\) => navalLootWorth\(items\),/);
  assert.match(w, /captain: fleetHost \? \{ model: \(\) => captainPage\.model\(\), openStars: \(\) => captainPage\.openStars\(\), stars: \(\) => captainPage\.stars\(\) \} : null,/);   // PIN MOVED (AUDIT CAPTAIN'S SEA L15): beside the Fleet's - PIN MOVED (GROWTH3): and the stars' deps, drawn in the Growth tab
  const host = rd('src/scenes/naval/navalHost.js');
  assert.match(host, /if \(boat\) \{ const v = boatPose\(boat\)\.velocity; deps\.captain\?\.sailed\?\.\(Math\.hypot\(v\[0\], v\[2\]\) \* Math\.min\(Math\.max\(0, dt\), FRAME_STEP_S \* FRAME_STEPS_MAX\)\); \}/);
  // PIN MOVED (AUDIT CAPTAIN'S SEA L12): the hold's own items counted, each once (the captain's own things put in and taken
  // out again were counted every pass)
  assert.match(host, /tallyPlunder\(all\.filter\(\(it\) => !left\.includes\(it\)\)\);/);
  assert.match(host, /deps\.captain\?\.note\?\.\('claimed'\);/);
  assert.match(rd('src/ui/enhanced/enhancedMenu.js'), /captain: \(d\) => drawCaptainPage\(d, render, \{ \.\.\.kit, door: \(fn\) => \{ handoff\(fn\); \}, growth: \(\) => \{ setGrowthSection\('captain'\); pauseTab = 'growth'; render\(\); \} \}\),/);   // PIN MOVED (GROWTH3): the stars' button goes to the Growth tab
});

/** The player's boat wrecked where a pirate alongside boards her at once (navaudit_boarding.test.js's own). */
const WRECKED = { v: 1, boats: { 42: { hull: 0, sail: 0, crew: 24, fire: 0, state: 'wrecked', barrels: 4 } }, notoriety: {}, day: 1, raids: [] };

test('CAPT-PAY at sea: boarders thrown back off my own deck are charged as a pirate\'s end when the fight is won - the arc\'s own party beaten pays the law and the log; a flagship\'s raid quest won tells the log and leaves its repute to the quest (mutants: the repel never charged, the quest paid twice)', async () => {
  const run = async (classId, quest) => {
    const s = await ledgerSea({ save: WRECKED, where: { region: 23, capitals: [{ region: 23, x: 100, y: 100 }] }, raidQuest: quest ? (name) => ({ uid: quest, name, tasks: new Map() }) : undefined });
    const id = s.host.spawnShip(classId, { range: 16, bearing: Math.PI / 2, yaw: 0 });
    const e = s.host._sea.get(id);
    e.ship.pos = [16, 0, 0];
    s.host.frame(0.1);
    s.run(0.5);
    assert.equal(s.host.boarding?.kind, 'repel', 'boarded');
    s.run(GRAPPLE_S + 0.2);
    return s;
  };
  const party = await run('pirateBrig');
  for (const f of party.log.foes) if (f.side === 'enemy') f.dead = true;
  party.run(1);
  assert.equal(party.host.boarding, null, 'thrown back');
  assert.equal(party.ledger.log.repelled, 1);
  assert.deepEqual(party.law.legal.at(-1), [23, PIRATE_REWARD.repelled.legal], 'the law\'s reward');
  assert.equal(party.ledger.standing('Wayrest'), DEED_STANDING.repelled * 2, 'a brigantine is size 2');
  const raid = await run('pirateFlagship', 905);
  raid.host.boarding.quest.tasks.set('winner', { getTriggerValue: () => true });
  raid.run(0.2);
  assert.equal(raid.host.boarding, null, 'won');
  assert.equal(raid.ledger.log.repelled, 1);
  assert.deepEqual(raid.law.legal, [], 'WAQ_SHIP_ATTACK_PIRATE pays its own repute');
});
