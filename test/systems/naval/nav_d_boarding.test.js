// NAV-D (2026-09-28, Mac: "actual sailing ships to the world that players can encounter and pillage, which should
// also directly enhance and integrate into the pirate quest system") - BOARDING, PLUNDER, THE LAW AND THE QUESTS:
// the grapples and the berth, the musters, the fight's reckoning, a raid's win, the hold and the captor's choice, the
// crowns' law and notoriety, and Warm Ashes' "Leave Ship" asking the sea fight first (bible/03-World/Naval-Combat.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GRAPPLE_S, HAUL_MAX_S, BERTH_GAP, MUSTER_MIN, MUSTER_MAX, CREW_PER_HAND, HANDS_MAX, SURRENDER_SHARE, REPEL_PARTY, MOBILE, MUSTERS, HAND,
  WA_SMALLRAID, WA_ATTACK_PIRATE, RAID_WIN_TASKS,
  raidQuestOf, raidQuestWon, musterOf, handsOf, repelPartyOf, berthPose, drawHaul, boardingWon, createBoarding,
} from '../../../src/systems/naval/navalBoarding.js';
import {
  HOLD_KEYS, STRONGBOX_KEY, CHOICES, REPAIR_SHARE, PRESS_SHARE, FLOTSAM_OF, HOLD_RARITY_TIER, STRONGBOX_RARITY_TIER, CHOICE_TITLES,
  holdTier, holdKeys, flotsamKeys, drawHold, choiceEffect, choiceOffer,
} from '../../../src/systems/naval/navalPlunder.js';
import {
  NOTORIETY, PIRATE_REWARD, KNIGHTLY_FACTION, TEMPLE_FACTION, crownNamed, crownRegion, notorietyLevel, createNotoriety, lawOf,
} from '../../../src/systems/naval/navalLaw.js';
import { classById, SHIP_CLASSES, CROWNS } from '../../../src/systems/naval/navalShips.js';
import { CRIMES } from '../../../src/systems/crimes.js';
import { LeaveShip, setWarmAshesHost, WA_SEA_REGION, _resetWarmAshesShips, raidAtSea, raidUnderWay, frame as warmAshesFrame, WA_RAID_QUESTS } from '../../../src/systems/warmAshesShips.js';
import { readFileSync } from 'node:fs';

const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg ?? ''} ${a} vs ${b} (±${eps})`);

// ── the boarding ────────────────────────────────────────────────────────────────────────────────────────────────

test('NAV-D the muster: her class\'s boarders thinned by her crew\'s losses, never under MUSTER_MIN nor over MUSTER_MAX, drawn round her trade\'s list and led by its captain - a pirate\'s a Spellsword (Warm Ashes\' leader), a navy\'s a Knight (mutants: the captain counted twice, the thinning dropped, the clamp)', () => {
  const sloop = classById('pirateSloop'), brig = classById('pirateBrig');   // 8 boarders; 13, over the most
  const m = musterOf(sloop);
  assert.equal(m.captain, MOBILE.Spellsword);
  assert.equal(m.men.length, sloop.boarders - 1, 'the captain is one of the muster');
  assert.deepEqual(m.men, MUSTERS.pirate.men.slice(0, sloop.boarders - 1));
  const full = musterOf(brig);
  assert.equal(full.men.length, MUSTER_MAX - 1, 'never over the most');
  assert.equal(full.men[MUSTERS.pirate.men.length], MUSTERS.pirate.men[0], 'round and round');
  assert.equal(musterOf(sloop, 0.5).men.length, Math.round(sloop.boarders * 0.5) - 1, 'thinned by her losses');
  assert.equal(musterOf(sloop, 0).men.length, MUSTER_MIN - 1, 'never under the least');
  assert.equal(musterOf(classById('pirateFlagship')).men.length, MUSTER_MAX - 1);
  assert.equal(musterOf(sloop, 7).men.length, sloop.boarders - 1, 'a share over one is one');
  assert.equal(musterOf(classById('navyCutter')).captain, MOBILE.Knight);
  assert.equal(musterOf(classById('merchantCoaster')).captain, MOBILE.Ranger);
  assert.ok(musterOf(classById('merchantCoaster')).men.every((t) => MUSTERS.merchant.men.includes(t)));
  // the player's hands: Warm Ashes' _ally_ Warriors, one a CREW_PER_HAND, HANDS_MAX at most, none from an uncrewed boat
  assert.equal(HAND, MOBILE.Warrior);
  assert.equal(handsOf(CREW_PER_HAND - 1, true), 0);
  assert.equal(handsOf(CREW_PER_HAND * 2, true), 2);
  assert.equal(handsOf(1000, true), HANDS_MAX);
  assert.equal(handsOf(1000, false), 0);
  // a boat with no crew meets the arc's own party
  assert.equal(repelPartyOf({ boarders: 0 }), REPEL_PARTY.min);
  assert.equal(repelPartyOf({ boarders: 12 }), 4);
  assert.equal(repelPartyOf(classById('pirateFlagship')), REPEL_PARTY.max);
});

test('NAV-D the berth: she is hauled parallel on the side she lies - the same heading or the reciprocal, whichever is nearer her own - the two half beams and BERTH_GAP apart, level with the middle; the haul\'s yaw the short way across the seam (BOARD-MAGNET: drawn, navalBoarding.js drawHaul - boardmagnet.test.js holds its way in) (mutants: the side\'s sign, the gap, the long way round)', () => {
  const anchor = { pos: [0, 0, 0], yaw: 0, beam: 7.4, midZ: 0 };
  const star = berthPose(anchor, { pos: [30, 5, 10], yaw: 0.3, beam: 1.9, midZ: 0 });
  assert.equal(star.side, 1);
  near(star.pos[0], 7.4 + 1.9 + BERTH_GAP, 1e-9, 'to starboard (+x at a heading of 0)');
  near(star.pos[2], 0, 1e-9, 'level with the middle');
  assert.equal(star.pos[1], 5, 'her own height');
  near(star.yaw, 0, 1e-12);
  const port = berthPose(anchor, { pos: [-30, 0, -10], yaw: Math.PI - 0.2, beam: 1.9 });
  assert.equal(port.side, -1);
  near(port.pos[0], -(7.4 + 1.9 + BERTH_GAP), 1e-9);
  near(Math.abs(port.yaw), Math.PI, 1e-9, 'lying head to tail: the reciprocal');
  // the middles: hers is set against the anchor's
  const mid = berthPose({ ...anchor, midZ: 4 }, { pos: [30, 0, 0], yaw: 0, beam: 1, midZ: 2 });
  near(mid.pos[2], 4 - 2, 1e-9);
  // the haul's heading, the hull it is hauled to far off (BOARD-MAGNET: drawHaul)
  const far = { pos: [0, 0, -5000], yaw: 0, hull: 2 };
  const from = { pos: [10, 0, 0], yaw: Math.PI - 0.1 }, to = { pos: [20, 0, 10], yaw: -Math.PI + 0.1 };
  const half = drawHaul(from, to, 0, GRAPPLE_S / 2, far, 2);
  near(Math.abs(half.yaw), Math.PI, 1e-9, 'the short way: half of 0.2 across the seam, not half of 6.08 back round');
  const end = drawHaul(half, to, GRAPPLE_S / 2, GRAPPLE_S / 2, far, 2);
  near(end.pos[0], to.pos[0], 1e-9); near(end.pos[2], to.pos[2], 1e-9);
  near(end.yaw, to.yaw, 1e-9);
  // a yaw many turns out lands in one step (ONCRASH1: no loop)
  near(drawHaul({ pos: [0, 0, 0], yaw: 0 }, { pos: [0, 0, 0], yaw: 1e6 * Math.PI * 2 + 0.5 }, GRAPPLE_S, 1, far, 2).yaw, 0.5, 1e-6);
});

test('NAV-D the fight\'s reckoning and phases: won when the captain is down with SURRENDER_SHARE of the muster, or every man; grapple for GRAPPLE_S and on till she lies in her berth (HAUL_MAX_S at most), then the fight, then the prize - or abandoned (mutants: the share\'s edge, the captain not asked, a won fight abandoned)', () => {
  assert.equal(boardingWon({ captainDown: true, down: Math.ceil(10 * SURRENDER_SHARE), total: 10 }), true);
  assert.equal(boardingWon({ captainDown: true, down: Math.ceil(10 * SURRENDER_SHARE) - 1, total: 10 }), false);
  assert.equal(boardingWon({ captainDown: false, down: 9, total: 10 }), false, 'her captain still stands');
  assert.equal(boardingWon({ captainDown: false, down: 10, total: 10 }), true, 'every man');
  assert.equal(boardingWon({ captainDown: false, down: 0, total: 0 }), true);
  const b = createBoarding({ kind: 'board', shipId: 's1', from: { pos: [0, 0, 0], yaw: 0 }, to: { pos: [10, 0, 0], yaw: 0 } });
  assert.equal(b.phase, 'grapple');
  const far = { pos: [0, 0, -5000], yaw: 0, hull: 2 };
  b.haul(b.to, far, GRAPPLE_S - 0.01);
  assert.equal(b.step(GRAPPLE_S - 0.01), null);
  b.haul(b.to, far, 0.02);
  assert.equal(b.arrived, true, 'in her berth');
  assert.equal(b.step(0.02), 'fight');
  assert.equal(b.step(1), null);
  // held from her berth, the fight waits for her - HAUL_MAX_S at the most
  const held = createBoarding({ kind: 'board', shipId: 's2', from: { pos: [0, 0, 0], yaw: 0 }, to: { pos: [10, 0, 0], yaw: 0 } });
  held.step(GRAPPLE_S + 0.5);
  assert.equal(held.phase, 'grapple', 'not yet alongside');
  held.step(HAUL_MAX_S);
  assert.equal(held.phase, 'fight', 'HAUL_MAX_S: over her rail whatever held her');
  b.win();
  assert.equal(b.phase, 'prize');
  assert.equal(b.outcome, 'won');
  b.abandon();
  assert.equal(b.phase, 'prize', 'a won fight is not given up');
  b.done();
  assert.equal(b.phase, 'done');
  assert.equal(b.outcome, 'won');
  const a = createBoarding({ kind: 'repel', shipId: 's2', from: { pos: [0, 0, 0], yaw: 0 }, to: { pos: [0, 0, 0], yaw: 0 } });
  a.abandon();
  assert.deepEqual([a.phase, a.outcome], ['done', 'abandoned']);
  a.win();
  assert.equal(a.phase, 'done', 'nothing wins after');
});

test('NAV-D the quests: a pirate flagship\'s boarders are Warm Ashes\' WAQ_SHIP_ATTACK_PIRATE, any other pirate\'s WAQ_SHIP_SMALLRAID; a raid is WON by a winning task\'s trigger - the pirate attack\'s `winner`, the small raid\'s three `endquestproper`s - never by its ending alone (mutants: an unwon end counted, a winning task missed)', () => {
  assert.equal(raidQuestOf(classById('pirateFlagship')), WA_ATTACK_PIRATE);
  assert.equal(raidQuestOf(classById('pirateBrig')), WA_SMALLRAID);
  assert.equal(raidQuestOf(null), WA_SMALLRAID);
  assert.deepEqual([...RAID_WIN_TASKS], ['winner', 'endquestproper', 'endquestproper2', 'endquestproper5']);
  const quest = (set) => ({ tasks: new Map(['winner', 'endquestproper', 'endquestproper2', 'endquestproper5', 'cooldown', 'gotYou'].map((n) => [n, { getTriggerValue: () => set.includes(n) }])) });
  assert.equal(raidQuestWon(quest([])), false);
  assert.equal(raidQuestWon(quest(['cooldown'])), false, 'the small raid\'s hour ran out');
  assert.equal(raidQuestWon(quest(['gotYou'])), false);
  for (const n of RAID_WIN_TASKS) assert.equal(raidQuestWon(quest([n])), true, n);
  assert.equal(raidQuestWon(null), false);
  assert.equal(raidQuestWon({ tasks: null }), false);
  assert.equal(raidQuestWon({ tasks: new Map([['winner', {}]]) }), false, 'a task with no trigger reading');
});

// ── the prize ───────────────────────────────────────────────────────────────────────────────────────────────────

test('NAV-D the hold: one lot a tier of her cargo, each a key of her trade drawn from her seed - the same whoever takes her; a flagship\'s last lot her captain\'s strongbox at its own rarity tier; a sunk ship floats FLOTSAM_OF of her lots, at least one (mutants: the strongbox dropped, the tier of the trade ignored, the seed ignored)', () => {
  const brig = classById('pirateBrig'), carrack = classById('merchantCarrack'), flag = classById('pirateFlagship'), cutter = classById('navyCutter');
  assert.deepEqual(holdKeys(brig, 42), holdKeys(brig, 42));
  assert.equal(holdKeys(brig, 42).length, brig.cargo);
  assert.equal(holdKeys(carrack, 9).length, 4);
  assert.ok(holdKeys(carrack, 9).every((k) => HOLD_KEYS.merchant.includes(k)));
  assert.ok(holdKeys(cutter, 9).every((k) => HOLD_KEYS.navy.includes(k)));
  const fk = holdKeys(flag, 5);
  assert.equal(fk.at(-1), STRONGBOX_KEY);
  assert.ok(fk.slice(0, -1).every((k) => HOLD_KEYS.pirate.includes(k)));
  const spread = new Set(Array.from({ length: 30 }, (_, i) => holdKeys(carrack, i).join('')));
  assert.ok(spread.size > 5, 'the seed draws');
  assert.equal(holdKeys({ faction: 'pirate', cargo: 0 }, 1).length, 1, 'at least one lot');
  assert.equal(holdKeys({ faction: 'pirate', cargo: 9 }, 1).length, 4, 'four at most');
  assert.deepEqual(flotsamKeys(carrack, 9), holdKeys(carrack, 9).slice(0, Math.round(4 * FLOTSAM_OF)));
  assert.equal(flotsamKeys(classById('pirateSloop'), 3).length, 1);
  // the tiers
  assert.equal(holdTier(carrack), HOLD_RARITY_TIER.merchant);
  assert.equal(holdTier(brig), HOLD_RARITY_TIER.pirate);
  assert.equal(holdTier(cutter), HOLD_RARITY_TIER.navy);
  assert.equal(holdTier(brig, true), STRONGBOX_RARITY_TIER);
  assert.equal(holdTier(null), HOLD_RARITY_TIER.merchant);
  // drawn through the host's generator: every lot, the strongbox at its own tier, one list
  const calls = [];
  const items = drawHold(flag, 5, (key, tier) => { calls.push([key, tier]); return [{ key }, { key, n: calls.length }]; });
  assert.deepEqual(calls, fk.map((k, i) => [k, i === fk.length - 1 ? STRONGBOX_RARITY_TIER : HOLD_RARITY_TIER.pirate]));
  assert.equal(items.length, fk.length * 2);
  assert.deepEqual(drawHold(brig, 1, () => null), [], 'a lot that drew nothing');
});

test('NAV-D the captor\'s one choice, as the window offers it: what it would make good NOW, bounded by what is missing - timber for the hull and canvas, powder for every gun and the barrels, pressed men for the losses - refused (greyed, with why) when it would make nothing good (mutants: the bound dropped, a loaded deck offered powder, the plural)', () => {
  assert.deepEqual([...CHOICES], ['repair', 'powder', 'press', 'papers']);   // AUDIT NAV1 (B13): her papers the fourth (test/systems/naval/navaudit_boarding.test.js)
  assert.deepEqual(Object.keys(CHOICE_TITLES), [...CHOICES]);
  const mine = { maxHull: 400, hull: 380, maxSail: 100, sail: 20, maxCrew: 24, crew: 14 };
  assert.deepEqual(choiceEffect('repair', mine), { repair: { hull: 400 * REPAIR_SHARE, sail: 100 * REPAIR_SHARE } });
  assert.deepEqual(choiceEffect('press', mine), { crew: Math.ceil(10 * PRESS_SHARE) });
  assert.deepEqual(choiceEffect('powder', mine, { barrelStock: 4 }), { barrels: 4, reload: true });
  assert.deepEqual(choiceEffect('nothing', mine), {});
  const r = choiceOffer('repair', mine);
  assert.deepEqual(r, { id: 'repair', title: 'Timber and cordage', useful: true, detail: 'Mend 20 of hull and 40 of canvas' }, 'the hull\'s twenty missing, not its 160 share');
  assert.deepEqual(choiceOffer('repair', { ...mine, hull: 400, sail: 100 }), { id: 'repair', title: 'Timber and cordage', useful: false, detail: 'Your ship is sound' });
  assert.equal(choiceOffer('repair', { ...mine, sail: 100 }).detail, 'Mend 20 of hull');
  assert.deepEqual(choiceOffer('powder', mine, { loaded: true }), { id: 'powder', title: 'Powder and shot', useful: false, detail: 'Your guns are loaded' });
  assert.equal(choiceOffer('powder', mine, { loaded: false }).useful, true);
  assert.deepEqual(choiceOffer('powder', mine, { loaded: true, barrelGuns: true, barrels: 1, barrelStock: 4 }), { id: 'powder', title: 'Powder and shot', useful: true, detail: 'Every gun loaded - fire barrels to 4' });
  assert.equal(choiceOffer('powder', mine, { loaded: true, barrelGuns: true, barrels: 4, barrelStock: 4 }).useful, false);
  assert.deepEqual(choiceOffer('press', mine), { id: 'press', title: 'Press the crew', useful: true, detail: `${Math.ceil(10 * PRESS_SHARE)} hands to your guns` });
  assert.equal(choiceOffer('press', { ...mine, crew: 23 }).detail, '1 hand to your guns');
  assert.deepEqual(choiceOffer('press', { ...mine, crew: 24 }), { id: 'press', title: 'Press the crew', useful: false, detail: 'Your crew is whole' });
  assert.equal(choiceOffer('press', { ...mine, maxCrew: 0, crew: 0 }).detail, 'No berths for them');
});

// ── the law ─────────────────────────────────────────────────────────────────────────────────────────────────────

test('NAV-D the law at sea: the first shot landed on a lawful ship is Piracy - DFU\'s own crime - charged to the crown whose waters, with its notoriety; sinking her notoriety alone; boarding her Piracy again; a pirate\'s end rewarded as Warm Ashes rewards it, a flagship\'s the quest\'s own numbers (mutants: every shot a crime, the pirate charged, the crown\'s region)', () => {
  const merchant = { faction: 'merchant' }, navy = { faction: 'navy' }, pirate = { faction: 'pirate' }, flagship = { faction: 'pirate', flagship: true };
  const wr = crownRegion('Wayrest');
  assert.equal(wr, 23);
  assert.deepEqual(lawOf('fire', merchant, { crown: 'Wayrest', firstStrike: true }), { crimes: [{ region: wr, crime: CRIMES.Piracy }], notoriety: [{ crown: 'Wayrest', add: NOTORIETY.fire }], rewards: [] });
  assert.deepEqual(lawOf('fire', merchant, { crown: 'Wayrest' }), { crimes: [], notoriety: [], rewards: [] }, 'once a ship, however many shots follow');
  assert.deepEqual(lawOf('sink', navy, { crown: 'Sentinel' }), { crimes: [], notoriety: [{ crown: 'Sentinel', add: NOTORIETY.sink }], rewards: [] });
  assert.deepEqual(lawOf('board', navy, { crown: 'Sentinel' }).crimes, [{ region: 20, crime: CRIMES.Piracy }]);
  assert.deepEqual(lawOf('fire', pirate, { crown: 'Wayrest', firstStrike: true }), { crimes: [], notoriety: [], rewards: [] }, 'firing on a pirate is no crime');
  assert.deepEqual(lawOf('sink', pirate, { crown: 'Wayrest' }).rewards, [{ ...PIRATE_REWARD.sunk, region: wr }]);
  assert.deepEqual(lawOf('board', pirate, { crown: 'Wayrest' }).rewards, [{ ...PIRATE_REWARD.taken, region: wr }]);
  assert.deepEqual(lawOf('sink', flagship, { crown: 'Daggerfall' }).rewards, [{ legal: 3, knightly: 3, temple: 1, region: 17 }], 'WAQ_SHIP_ATTACK_PIRATE\'s own');
  assert.equal(crownNamed('Atlantis'), CROWNS[0], 'an unknown crown: Daggerfall\'s');
  assert.equal(KNIGHTLY_FACTION, 844);
  assert.equal(TEMPLE_FACTION, 450);
  assert.equal(CRIMES.Piracy, 10, 'the crime Daggerfall already names');
});

test('NAV-D notoriety: 0 to 100 in each crown\'s waters, falling decayPerDay a day, four anchors on the plate; the save\'s record bounded to the three crowns (mutants: the ceiling, the decay kept at zero, a stranger\'s crown restored)', () => {
  const n = createNotoriety();
  assert.equal(n.add('Wayrest', 30), 30);
  assert.equal(n.add('Wayrest', 90), NOTORIETY.max);
  assert.equal(n.add('Sentinel', -5), 0);
  assert.equal(n.add(null, 50), 0, 'no crown, no ledger');
  n.add('Daggerfall', 20);
  assert.equal(n.highest(), 100);
  n.decay(1);
  assert.equal(n.get('Wayrest'), NOTORIETY.max - NOTORIETY.decayPerDay);
  assert.equal(n.get('Daggerfall'), 20 - NOTORIETY.decayPerDay);
  n.decay(0); n.decay(-3);
  assert.equal(n.get('Wayrest'), NOTORIETY.max - NOTORIETY.decayPerDay, 'no time, no decay');
  n.decay(1);
  assert.deepEqual(Object.keys(n.snapshot()).sort(), ['Sentinel', 'Wayrest'].filter((k) => n.get(k) > 0).sort(), 'a crown gone quiet leaves the ledger');
  const m = createNotoriety();
  m.restore({ Wayrest: 40, Sentinel: 1e9, Atlantis: 50, Daggerfall: 'a lot' });
  assert.deepEqual(m.snapshot(), { Wayrest: 40, Sentinel: NOTORIETY.max });
  m.restore(null);
  assert.deepEqual(m.snapshot(), {});
  assert.deepEqual([0, 24, 25, 49, 50, 99, 100, 500, 'x'].map(notorietyLevel), [0, 0, 1, 1, 2, 3, 4, 4, 0]);
  assert.ok(SHIP_CLASSES.every((c) => c.faction !== 'pirate' || lawOf('board', c, { crown: 'Wayrest' }).crimes.length === 0), 'no pirate is a crime to take');
});

// ── Warm Ashes' "Leave Ship", asking first ──────────────────────────────────────────────────────────────────────

test('NAV-D THE GATE (DECLARED): Warm Ashes\' LeaveShip asks the host\'s leaveShipGate(quest) before its own body - "naval" completes it with nothing sailed, "wait" holds it, "proceed" or no gate runs the IL\'s own (mutants: the gate not asked, "naval" falling through to the ship, "wait" completing)', () => {
  _resetWarmAshesShips();
  const quest = { name: 'WAQ_SHIP_SMALLRAID' };
  const calls = [];
  let gate = 'wait';
  const h = {
    leaveShipGate: (q) => { calls.push(['gate', q]); return gate; },
    currentRegionIndex: () => WA_SEA_REGION,
    ownsShip: () => true,
    setTransportModeShip: () => calls.push(['ship']),
    setBlockVariant: (block, v) => calls.push(['variant', block, v]),
    assignShip: () => calls.push(['assign']),
    resetShip: () => calls.push(['reset']),
  };
  setWarmAshesHost(h);
  const a = new LeaveShip(null).createNew('Leave Ship', quest);
  a.update(null);
  assert.deepEqual(calls, [['gate', quest]]);
  assert.equal(a.isComplete, false, 'not yet: the raiders\' hold is open');
  calls.length = 0;
  gate = 'naval';
  a.update(null);
  assert.deepEqual(calls, [['gate', quest]], 'nothing sailed');
  assert.equal(a.isComplete, true);
  calls.length = 0;
  gate = 'proceed';
  const b = new LeaveShip(null).createNew('Leave Ship', quest);
  b.update(null);
  assert.deepEqual(calls, [['gate', quest], ['variant', 'SHIPAA00.RMB', '_base'], ['variant', 'SHIPAA01.RMB', '_base'], ['ship']], 'the IL\'s own body');
  assert.equal(b.isComplete, true);
  // a host without the gate: the IL's own, as before the arc
  calls.length = 0;
  delete h.leaveShipGate;
  const c = new LeaveShip(null).createNew('Leave Ship', quest);
  c.update(null);
  assert.deepEqual(calls, [['variant', 'SHIPAA00.RMB', '_base'], ['variant', 'SHIPAA01.RMB', '_base'], ['ship']]);
  setWarmAshesHost(null);
  _resetWarmAshesShips();
});

test('NAV-D ONE RAID AT A TIME (THE MERGE with OWS3): Warm Ashes\' module answers for every starter - an ambush armed or boarding, a lent ship out, or a raid quest running whoever started it (the host\'s word off the quest machine); an Overworld raider alongside is refused while the sea fight\'s raid runs, and the sea fight\'s boarders start none over an armed ambush - they come over as the arc\'s own party (mutants: the running raid unasked, the boarders\' raid over an ambush, the host\'s word never given)', () => {
  // the two quests as the machine names them (AUDIT NAV1 B5: the pirate attack's file, WA_ATTACK_PIRATE, names itself
  // WAQ_SHIP_PIRATEATTACK - test/systems/naval/navaudit_boarding.test.js reads each file's header)
  assert.deepEqual([...WA_RAID_QUESTS], [WA_SMALLRAID, 'WAQ_SHIP_PIRATEATTACK']);
  _resetWarmAshesShips();
  let running = false;
  const calls = [];
  setWarmAshesHost({
    random: () => 0.99, ownsShip: () => true, raidRunning: () => running,
    getQuest: (name) => ({ name }), startQuest: (q) => calls.push(['start', q.name]), setTransportModeShip: () => calls.push(['ship']),
    setBlockVariant: () => {}, assignShip: () => {}, resetShip: () => {}, currentRegionIndex: () => WA_SEA_REGION,
  });
  assert.equal(raidUnderWay(), false, 'nothing under way');
  // the sea fight's raid running on a Come Sail Away deck: the raider alongside sheers off, nothing armed
  running = true;
  assert.equal(raidUnderWay(), true);
  assert.equal(raidAtSea(), 'busy');
  assert.equal(warmAshesFrame(1), false, 'no coroutine armed');
  assert.deepEqual(calls, []);
  // the raid over: the next raider is heeded - and while ITS ambush is armed, the boarders start no second raid
  running = false;
  assert.equal(raidAtSea(), 'raid');
  assert.equal(raidUnderWay(), true, 'armed and boarding');
  assert.equal(warmAshesFrame(1), true);
  assert.deepEqual(calls, [['start', WA_SMALLRAID], ['ship']]);
  assert.equal(raidUnderWay(), false, 'boarded: the quest itself is the host\'s word now');
  running = true;
  assert.equal(raidUnderWay(), true);
  // a lent ship out (a player with none of their own): under way until Leave Ship takes it back
  _resetWarmAshesShips();
  running = false;
  setWarmAshesHost({ random: () => 0.99, ownsShip: () => false, raidRunning: () => running, getQuest: (name) => ({ name }), startQuest: () => {}, setTransportModeShip: () => {}, setBlockVariant: () => {}, assignShip: () => {}, resetShip: () => {} });
  assert.equal(raidAtSea(), 'raid-lent');
  warmAshesFrame(1);
  assert.equal(raidUnderWay(), true, 'the lent ship is out');
  setWarmAshesHost(null);
  _resetWarmAshesShips();
  // the host: the machine's live raid quests are the word, and the sea fight's starter asks first
  const w = readFileSync(new URL('../../../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(w, /raidRunning: \(\) => \[\.\.\.questBridge\.machine\.quests\.values\(\)\]\.some\(\(q\) => WA_RAID_QUESTS\.includes\(q\.questName\) && !q\.questComplete && !q\.questTombstoned\),/);
  assert.match(w, /startRaid: \(name\) => \{\n\s+if \(warmAshesRaidUnderWay\(\)\) return null;/);
});
