// CAPTAIN-TREE and REFIT-ORES (2026-10-17, the owner: "A firmament styled captain skill tree along with making improvements
// to the ship upgrade system" - a player's ask beside it: "levels unlock upgrading with ores from steel to Ebony and beyond",
// "connect current stats to ship behaviour"; bible/03-World/Naval-Refit.md CAPTAIN-TREE, REFIT-ORES).
//
// The captain's level off the log and the stars it buys (systems/naval/captainTree.js), kept in the captain's ledger
// (systems/naval/captainLedger.js); where each star is read - her refits (scenes/fleetHost.js refit: Come Sail Away's way,
// oars, helm and hold; the sea fight's hull and harm), her crew's worth, her shot, her ram and its foul, her aim, the
// exchange's spread; the metal refits past the shipwright's third tier (systems/fleet.js) and the ore a piece of arms or
// plate melts down for; the stars' window (ui/captainTreeWindow.js) and the Captain page's card (ui/captainPage.js).
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CAPTAIN_XP, TRADED_GOLD, CAPTAIN_LEVEL_MAX, CAPTAIN_STATS, CAPTAIN_STARS, CAPTAIN_EDGES, CAPTAIN_CROSS, RELOAD_LEAST,
  captainXpOf, xpForLevel, levelOf, starPoints, captainOf, starOf, neighboursOf, heldStars, takeable, takesBack, refundable, wayTo,
  starStats, statScale, captainRefit, captainWorth, captainShot, struckGun,
} from '../../../src/systems/naval/captainTree.js';
import { createCaptainLedger } from '../../../src/systems/naval/captainLedger.js';
import { NO_WORTH } from '../../../src/systems/naval/shipCrew.js';
import { GUNS } from '../../../src/systems/naval/navalShips.js';
import { shotFireChance, shotGun, shotReach, FIRE_MOST } from '../../../src/systems/naval/shotKinds.js';
import { FIRE_CHANCE } from '../../../src/systems/naval/navalDamage.js';
import { foul, FOUL_S } from '../../../src/systems/naval/navalFoul.js';
import { exchangeOf, priceOf, TRADE_MOST, SPREAD } from '../../../src/systems/naval/tradeGoods.js';
import { LEAGUE_M } from '../../../src/world/ethericSea.js';
import {
  MATERIALS, ORE_TIERS, BASE_TIERS, ORE_PER, UPGRADE_TIERS, REFIT_NUMERALS, upgradeCost, refitOf, refitShare, refitWords, refitMetalOf, meltable,
  materialCount, takeMaterials, meltCount, materialsFor,
} from '../../../src/systems/fleet.js';
import { WEAPONS } from '../../../src/characters/weapons.js';
import { refitRowWords } from '../../../src/ui/fleetPage.js';
import { levelMeter, drawCaptainPage } from '../../../src/ui/captainPage.js';
import { setHoldingsProvider } from '../../../src/ui/holdingsPages.js';
import { starName, starKindWords, starStatWords, starLines, skySummary, starRefusal, mountCaptainTreeWindow } from '../../../src/ui/captainTreeWindow.js';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg ?? ''} ${a} ~ ${b}`);

// ── the captain's level ──────────────────────────────────────────────────────────────────────────────────────────────

test('CAPTAIN-TREE the level: earned off the log as CAPTAIN_XP weighs each deed - a merchant\'s exchange too - up 100 x (L - 1)^1.6 to level 30, a point a level past the first; an empty or unreadable log is level 1 (mutants: a deed unweighed, the curve, the points)', () => {
  const log = {
    sunk: { pirate: 2 }, taken: { navy: 1 }, repelled: 1, claimed: 1, contracts: { bounty: 2 }, sailed: 3.5 * LEAGUE_M,
    maps: 1, islands: 2, deepest: 3, traded: 100,
  };
  assert.equal(captainXpOf(log), 2 * 40 + 75 + 30 + 20 + 2 * 50 + 3 * 12 + 40 + 2 * 25 + 3 * 15 + Math.floor(100 / TRADED_GOLD));
  assert.equal(TRADED_GOLD, 40);
  assert.equal(CAPTAIN_XP.traded, 1);
  assert.equal(captainXpOf({ traded: 79 }), 1, 'an XP for every TRADED_GOLD sold');
  assert.equal(captainXpOf({ sunk: { legend: 1 }, taken: { ether: 1 } }), 300 + 90);
  assert.equal(captainXpOf(null), 0);
  assert.equal(captainXpOf({ sunk: { pirate: -5 }, repelled: NaN }), 0, 'nothing negative or not a number counts');
  assert.deepEqual([1, 2, 10, 20, 30].map(xpForLevel), [0, 100, 3363, 11117, 21869]);
  assert.deepEqual([0, 99, 100, 3362, 3363, 1e9].map(levelOf), [1, 1, 2, 9, 10, 30]);
  assert.equal(CAPTAIN_LEVEL_MAX, 30);
  assert.deepEqual([1, 2, 30, 99].map(starPoints), [0, 1, 29, 29]);
  assert.deepEqual(captainOf({ sunk: { pirate: 3 } }), { xp: 120, level: 2, points: 1, next: xpForLevel(3) });
  assert.equal(captainOf({ sunk: { legend: 1000 } }).next, null, 'the top: no next level');
});

// ── the sky's law ────────────────────────────────────────────────────────────────────────────────────────────────────

test('CAPTAIN-TREE the sky: the Helm in the middle, the Master\'s paths to the left and the Commander\'s to the right, every star joined to the Helm, five keystones, more stars than a captain at the top has points; every stat a star carries is one the seams read (mutants: a link, a half)', () => {
  assert.equal(CAPTAIN_STARS.length, 38);
  assert.equal(new Set(CAPTAIN_STARS.map((s) => s.id)).size, 38, 'each star once');
  assert.equal(CAPTAIN_STARS[0].id, 'helm');
  for (const s of CAPTAIN_STARS) {
    for (const l of s.links) assert.ok(starOf(l), `${s.id}'s link ${l}`);
    if (s.sec === 'master') assert.ok(s.pos[0] < 0, `${s.id} on the Master's side`);
    if (s.sec === 'commander') assert.ok(s.pos[0] > 0, `${s.id} on the Commander's side`);
    for (const k of Object.keys(s.stats)) assert.ok(CAPTAIN_STATS.includes(k), `${s.id}'s ${k}`);
    assert.ok(wayTo(['helm'], s.id), `${s.id} reached from the Helm`);
  }
  assert.deepEqual(CAPTAIN_STARS.filter((s) => s.kind === 'keystone').map((s) => s.id), ['m_wind', 'm_prince', 'm_iron', 'c_line', 'c_creed']);
  assert.ok(CAPTAIN_STARS.length - 1 > starPoints(CAPTAIN_LEVEL_MAX), 'a captain chooses: never every star');
  assert.equal(CAPTAIN_EDGES.length, CAPTAIN_STARS.reduce((n, s) => n + s.links.length, 0) + CAPTAIN_CROSS.length);
  assert.ok(neighboursOf('c_drill').includes('c_long') && neighboursOf('c_long').includes('c_drill'), 'a cross line both ways');
  // every keystone carries a price
  for (const s of CAPTAIN_STARS.filter((x) => x.kind === 'keystone')) assert.ok(Object.values(s.stats).some((v) => v < 0), `${s.id} costs something`);
});

test('CAPTAIN-TREE holding stars: through the door only known stars joined to the Helm, once, no more than the points - in an order a captain could have set them, whatever order asked; a star is taken beside one held with a point left; given back with every star joined only through it; the way to a star its shortest (mutants: the join, the cap, the cascade, the way)', () => {
  assert.deepEqual(heldStars(['m_way2', 'm_way1', 'zzz', 'm_way1', 5, 'c_rel1', 'helm']), ['helm', 'm_way1', 'c_rel1', 'm_way2'], 'm_way2 joined once m_way1 is');
  assert.deepEqual(heldStars(['m_way1', 'm_way2', 'c_rel1'], 2), ['helm', 'm_way1', 'm_way2'], 'the earliest asked first');
  assert.deepEqual(heldStars(['m_way2']), ['helm'], 'a star joined to nothing held');
  assert.deepEqual(heldStars(null), ['helm']);
  assert.equal(takeable(['helm'], 'm_way1', 1), true);
  assert.equal(takeable(['helm'], 'm_way1', 0), false, 'no point left');
  assert.equal(takeable(['helm'], 'm_way2', 9), false, 'not beside a star held');
  assert.equal(takeable(['helm', 'm_way1'], 'm_way1', 9), false, 'held already');
  const held = ['helm', 'm_way1', 'm_way2', 'm_clean', 'm_quick'];
  assert.deepEqual(takesBack(held, 'm_way1'), ['m_way1', 'm_way2', 'm_clean', 'm_quick']);
  assert.deepEqual(takesBack(held, 'm_clean'), ['m_clean', 'm_quick']);
  assert.deepEqual(takesBack(held, 'helm'), []);
  assert.deepEqual(takesBack(held, 'c_rel1'), []);
  assert.equal(refundable(held, 'm_quick'), true);
  assert.equal(refundable(held, 'm_way2'), false);
  // a sky with a star taken out of its middle keeps every star still joined, in any order
  const ring = ['helm', 'c_rel1', 'c_rel2', 'c_drill', 'c_long', 'c_aim1', 'c_aim2'];
  assert.deepEqual(takesBack(ring, 'c_rel1'), ['c_rel1'], 'the rest are joined round by the aim path');
  assert.deepEqual(heldStars(ring.filter((id) => id !== 'c_rel1')).length, ring.length - 1);
  assert.deepEqual(wayTo(['helm'], 'm_wind'), ['m_way1', 'm_way2', 'm_clean', 'm_way3', 'm_wind']);
  assert.deepEqual(wayTo(['helm', 'c_rel1', 'c_rel2', 'c_drill'], 'c_long'), ['c_long'], 'across from the drill\'s notable');
  assert.deepEqual(wayTo(['helm', 'm_way1'], 'm_way1'), []);
  assert.equal(wayTo(['helm'], 'nowhere'), null);
});

test('CAPTAIN-TREE what the stars do: each stat summed over the stars held, a keystone\'s price with it; a stat\'s multiple 1 + its share, never under 0.1 (mutants: the sum, the floor)', () => {
  const s = starStats(['helm', 'c_rel1', 'c_rel2', 'c_drill']);
  near(s.reload, 0.12);
  assert.equal(s.harm, 0);
  assert.equal(Object.isFrozen(s), true);
  assert.deepEqual(Object.keys(s), [...CAPTAIN_STATS]);
  const wind = starStats(['m_way1', 'm_way2', 'm_clean', 'm_way3', 'm_wind']);
  near(wind.way, 0.27);
  near(wind.oars, -0.12);
  near(statScale(wind, 'way'), 1.27);
  near(statScale(wind, 'oars'), 0.88);
  assert.equal(statScale({ way: -5 }, 'way'), 0.1);
  assert.equal(statScale(null, 'way'), 1);
});

// ── where the stars are read ─────────────────────────────────────────────────────────────────────────────────────────

test('CAPTAIN-TREE the seams: her refits bettered by the stars - hold, way, hull, harm - with her oars\' way and her helm\'s swing; her crew\'s worth drilled - the reload (never under RELOAD_LEAST), the mending, the hands over the rail; the shot locker - grape\'s men, chain\'s canvas, heated shot\'s fire to FIRE_MOST; a ram\'s foul held longer (mutants: each seam)', () => {
  const r = captainRefit({ cargo: 1.4, speed: 1.04, hull: 1.3, guns: 1 }, { cargo: 0.12, way: 0.06, hull: 0.04, harm: 0.08, oars: -0.12, turn: 0.12 });
  near(r.cargo, 1.4 * 1.12); near(r.speed, 1.04 * 1.06); near(r.hull, 1.3 * 1.04); near(r.guns, 1.08); near(r.oars, 0.88); near(r.turn, 1.12);
  assert.equal(captainRefit(null, { way: 1 }), null);
  assert.deepEqual(captainRefit({ cargo: 1, speed: 1, hull: 1, guns: 1 }, null), { cargo: 1, speed: 1, hull: 1, guns: 1, oars: 1, turn: 1 });
  const w = captainWorth(NO_WORTH, { reload: 0.12, repair: 0.25, boarders: 3 });
  near(w.reload, 0.88); near(w.mend, 1.25); assert.equal(w.hands, 3); assert.equal(w.sight, 1);
  assert.equal(captainWorth(NO_WORTH, null), NO_WORTH);
  assert.equal(captainWorth(NO_WORTH, { reload: 0.9 }).reload, RELOAD_LEAST);
  assert.equal(captainWorth({ ...NO_WORTH, hands: 1 }, { boarders: -4 }).hands, 0);
  const long = GUNS.long;
  const grape = captainShot('long', shotGun('long', long, 'grape'), 'grape', { grape: 0.3 });
  near(grape.crew, shotGun('long', long, 'grape').crew * 1.3);
  const chain = captainShot('chain', GUNS.chain, null, { chain: 0.3 });
  near(chain.sail, GUNS.chain.sail * 1.3, 'the chasers\' own chain, said as no load');
  const hot = captainShot('long', shotGun('long', long, 'heated'), 'heated', { heated: 0.5 });
  near(hot.fireK, 1.5);
  assert.equal(captainShot('long', long, 'round', { grape: 0.3, chain: 0.3 }), long, 'round shot: none of the locker\'s');
  assert.equal(captainShot('long', long, 'grape', null), long, 'another\'s ball');
  assert.equal(captainShot('barrel', GUNS.barrel, null, { heated: 1 }), GUNS.barrel);
  // AUDIT 2026-10-17: the gun a ball struck with, out of the naval host - its load's, the locker's over it, grape's men by
  // its time aloft
  assert.equal(struckGun('long', long, null, 9, { grape: 0.3 }), long, 'no load said: its bore\'s own');
  near(struckGun('long', long, 'grape', 0.1, { grape: 0.3 }).crew, grape.crew, 'close aboard: the locker over the load');
  assert.ok(shotReach('grape', 5) < 1);
  near(struckGun('long', long, 'grape', 5, null).crew, shotGun('long', long, 'grape').crew * shotReach('grape', 5), 'far off: grape\'s men by its time aloft');
  near(struckGun('long', long, 'grape', 5, { grape: 0.3 }).crew, grape.crew * shotReach('grape', 5), 'the locker\'s, and the reach over it');
  assert.equal(struckGun('nope', undefined, null, 0, null), null, 'no such gun: none');
  near(shotFireChance('heated', FIRE_CHANCE, 1.5), 0.45 * 1.5);
  assert.equal(shotFireChance('heated', FIRE_CHANCE, 3), FIRE_MOST);
  assert.equal(shotFireChance('heated', FIRE_CHANCE), 0.45, 'no stars: heated shot\'s own');
  assert.equal(shotFireChance(null, FIRE_CHANCE, undefined), FIRE_CHANCE);
  const ship = {};
  foul(ship, 'me', 10, 8);
  assert.equal(ship.fouled.until, 10 + FOUL_S + 8);
  foul(ship, 'me', 10);
  assert.equal(ship.fouled.until, 10 + FOUL_S);
  foul(ship, 'me', 10, -5);
  assert.equal(ship.fouled.until, 10 + FOUL_S, 'never shorter');
});

test('CAPTAIN-TREE the exchange: the captain\'s `trade` closes a share of the spread - each price nearer the good\'s middle - never past TRADE_MOST, so the exchange still buys under what it sells; none is today\'s prices to the coin (mutants: the edge unread, the cap)', () => {
  const port = { key: 'daggerfall-docks', crown: 'Daggerfall' };
  const day = 12;
  const base = exchangeOf(port, day);
  for (const r of base) { const p = priceOf(port, r.id, day); assert.deepEqual([r.sell, r.buy], [p.sell, p.buy], `${r.id} at no edge`); }
  const edged = exchangeOf(port, day, {}, 0.5);
  for (const [i, r] of edged.entries()) {
    assert.ok(r.sell <= base[i].sell && r.buy >= base[i].buy, `${r.id} nearer the middle`);
    assert.ok(r.buy <= r.sell, `${r.id} still bought under what it sells`);
  }
  const g = edged.find((r) => r.id === 'wine');
  const mid = priceOf(port, 'wine', day).mid;
  assert.equal(g.sell, Math.max(1, Math.round(mid * (1 + SPREAD * 0.5))));
  assert.deepEqual(exchangeOf(port, day, {}, 9).map((r) => [r.sell, r.buy]), exchangeOf(port, day, {}, TRADE_MOST).map((r) => [r.sell, r.buy]), 'the cap');
  assert.equal(TRADE_MOST, 0.75);
  const office = rd('src/scenes/harbourOffice.js');
  assert.equal(office.split('exchangeOf(port, day, L.dealtAt(port.key, day), L.stats?.().trade, townAt(port))').length - 1, 3, 'the board, a purchase and a sale read the same prices');   // PIN MOVED (SEA-TRADE): and the port town's factors
});

test('CAPTAIN-TREE the hosts read the stars where the ship\'s own numbers are read: the sea fight\'s worth, aim, my shot and its fire, my ram and its foul; Come Sail Away\'s oars and helm through the refit seam; the Fleet\'s refit a ship of mine\'s alone (PIN: the seams)', () => {
  const host = rd('src/scenes/naval/navalHost.js');
  assert.match(host, /s\.worth = captainWorth\(b\.crewed \? crewWorth\(c\.hands, ashoreNames\(b\)\) : NO_WORTH, deps\.captain\?\.stats\?\.\(\)\);/);
  assert.match(host, /const crewSkill = \(boat, st\) => Math\.min\(1, \(boat\.crewed \? [^\n]*\) \* statScale\(deps\.captain\?\.stats\?\.\(\), 'aim'\)\);/);
  assert.match(host, /const gun = e\.type === 'blast' \? GUNS\.barrel : struckGun\(e\.gun, GUNS\[e\.gun\], e\.shot, e\.t, isMine\(e\.shooter\) \? deps\.captain\?\.stats\?\.\(\) : null\);/);   // PIN MOVED (AUDIT 2026-10-17: captainTree.js struckGun, out of the host)
  assert.match(host, /random\(\) < shotFireChance\(e\.shot, FIRE_CHANCE, gun\.fireK\);/);
  assert.match(host, /const dealt = Math\.round\(speed \* RAM_DAMAGE \* \(galley \? GALLEY_RAM : 1\) \* statScale\(deps\.captain\?\.stats\?\.\(\), 'ram'\)\);/);
  assert.match(host, /foul\(e\.ship, myId\(\), clock, deps\.captain\?\.stats\?\.\(\)\.foul\);/);
  const csa = rd('src/systems/comeSailAway/comeSailAway.js');
  assert.match(csa, /f\(b\.modifierMoveSpeedOar\)\) \* hurt\) \* rigOf\(b, 'oars'\)\) \* peace\(\)\);/);
  assert.equal(csa.split("* rigOf(b, 'turn'))").length - 1, 2, 'her helm under oars and under sail');
  assert.match(csa, /const rigOf = \(b, key = 'speed'\) => \{ const k = Number\(refitOf\(b\)\?\.\[key\]\);/);
  const world = rd('src/scenes/world.js');
  assert.match(world, /stats: \(\) => captainLedger\.stats\(\),/);
  assert.match(world, /captain: \(\) => captainLedger,   \/\/ CAPTAIN-TREE \/ REFIT-ORES/);
});

// ── the ledger keeps the sky ─────────────────────────────────────────────────────────────────────────────────────────

test('CAPTAIN-TREE the ledger: the sky set through the law and the captain\'s points, its stats kept with it; the save round-trips it; an older save holds the Helm alone, a hand-made one is put right (mutants: the save, the restore\'s law, the stats stale)', () => {
  const L = createCaptainLedger();
  assert.deepEqual(L.newSaveData().tree, ['helm']);
  assert.deepEqual(L.setTree(['c_rel1']), ['helm'], 'a captain of level 1 has no point');
  const save = L.newSaveData();
  save.log.sunk.pirate = 30;   // 1200 XP: level 5, four points
  L.restoreSaveData(save);
  assert.deepEqual(L.captain(), { xp: 1200, level: 5, points: 4, next: xpForLevel(6) });
  assert.deepEqual(L.setTree(['c_rel1', 'c_rel2', 'c_drill', 'c_harm1', 'c_line']), ['helm', 'c_rel1', 'c_rel2', 'c_drill', 'c_harm1']);
  near(L.stats().reload, 0.12);
  near(L.stats().harm, 0.04);
  assert.equal(L.stats(), L.stats(), 'kept, not summed again each read');
  const out = L.getSaveData();
  assert.deepEqual(out.tree, ['helm', 'c_rel1', 'c_rel2', 'c_drill', 'c_harm1']);
  const L2 = createCaptainLedger();
  L2.restoreSaveData(JSON.parse(JSON.stringify(out)));
  assert.deepEqual(L2.tree(), out.tree);
  near(L2.stats().reload, 0.12);
  L2.restoreSaveData({ ...out, tree: ['helm', 'c_rel1', 'c_rel2', 'c_drill', 'c_harm1', 'c_line', 'm_way1'] });
  assert.equal(L2.tree().length, 5, 'no more than her points');
  L2.restoreSaveData({ ...out, tree: undefined });
  assert.deepEqual(L2.tree(), ['helm']);
  assert.equal(L2.stats().reload, 0, 'the stats with it');
});

// ── REFIT-ORES ───────────────────────────────────────────────────────────────────────────────────────────────────────

test('REFIT-ORES the ladder: past the shipwright\'s three tiers, nine of metal - Steel to Daedric, DFU\'s ladder - each a captain\'s level, its gold, its metal and the line\'s first store at the third tier\'s count; a metal tier half a shipwright\'s; twelve numerals (mutants: a tier\'s level, its gold, its share, its stores)', () => {
  assert.deepEqual(ORE_TIERS.map((o) => o.ore), ['steel', 'silver', 'elven', 'dwarven', 'mithril', 'adamantium', 'ebony', 'orcish', 'daedric']);
  assert.deepEqual(ORE_TIERS.map((o) => MATERIALS[o.ore].metal), [1, 2, 3, 4, 5, 6, 7, 8, 9], 'each its metal, WeaponMaterialTypes');
  assert.deepEqual(ORE_TIERS.map((o) => o.level), [3, 5, 8, 11, 14, 17, 20, 24, 28]);
  for (let i = 1; i < ORE_TIERS.length; i++) assert.ok(ORE_TIERS[i].gold > ORE_TIERS[i - 1].gold && ORE_TIERS[i].n >= ORE_TIERS[i - 1].n);
  assert.ok(ORE_TIERS.at(-1).level <= CAPTAIN_LEVEL_MAX, 'the last is a level a captain reaches');
  assert.deepEqual([BASE_TIERS, UPGRADE_TIERS, ORE_PER], [3, 12, 0.5]);
  assert.deepEqual([REFIT_NUMERALS.length, REFIT_NUMERALS[4], REFIT_NUMERALS[12]], [13, 'IV', 'XII']);
  assert.deepEqual(upgradeCost(2, 'hull', 3), { gold: 6000, mats: [{ kind: 'steel', n: 4 }, { kind: 'timber', n: 10 }], level: 3 });
  assert.deepEqual(upgradeCost(4, 'guns', 11), { gold: 175000, mats: [{ kind: 'daedric', n: 20 }, { kind: 'iron', n: 25 }], level: 28 });
  assert.deepEqual(upgradeCost(0, 'hold', 10), { gold: 27500, mats: [{ kind: 'orcish', n: 4 }, { kind: 'timber', n: 5 }], level: 24 });
  assert.deepEqual(upgradeCost(2, 'rigging', 9), { gold: 42000, mats: [{ kind: 'ebony', n: 7 }, { kind: 'timber', n: 10 }], level: 20 });
  assert.equal(upgradeCost(2, 'hold', 12), null);
  near(refitOf({ upgrades: { hull: 5 } }).hull, 1 + 0.3 + 2 * 0.1 * 0.5);
  near(refitShare('guns', 12), 0.08 * 3 + 0.08 * 9 * 0.5);
  assert.equal(refitShare('guns', 0), 0);
  assert.equal(refitWords('hull', 7), 'Hull VII');
  for (const o of ORE_TIERS) assert.ok(MATERIALS[o.ore].templates.length && MATERIALS[o.ore].hint.includes('melted down'));
  assert.deepEqual([...MATERIALS.ebony.templates], [627, 630], 'the Warforged Steel ingot counts as Ebony');
});

const piece = (group, material, extra = {}) => ({ group, templateIndex: group === 'Weapons' ? WEAPONS.Longsword : 105, material, stackCount: 1, ...extra });

test('REFIT-ORES a piece melted down: a weapon\'s metal, or a piece of plate\'s - never chain, leather, an arrow; never one worn, locked, bound, a quest\'s, an artifact, a sigil\'s, a player\'s make, enchanted, graded past Common or socketed; counted beside the ingots, the ingots taken first in every list before a piece is melted; what a refit would melt, said; stores counted for two kinds taken for one alone (mutants: the plate\'s metal, each guard, the ingots first, the joint count)', () => {
  assert.equal(refitMetalOf(piece('Weapons', 7)), 7);
  assert.equal(refitMetalOf(piece('Armor', 0x205)), 5, 'mithril plate');
  assert.equal(refitMetalOf(piece('Armor', 0x100)), null, 'chain');
  assert.equal(refitMetalOf(piece('Armor', 0)), null, 'leather');
  assert.equal(refitMetalOf({ group: 'Weapons', templateIndex: WEAPONS.Arrow, material: 1 }), null, 'an arrow');
  assert.equal(refitMetalOf({ group: 'UselessItems2', templateIndex: 621 }), null, 'an ingot is counted by its template');
  assert.equal(refitMetalOf(piece('Weapons', 12)), null);
  assert.equal(meltable(piece('Weapons', 1)), true);
  for (const guard of [{ equipSlot: 3 }, { questItem: true }, { artifact: true }, { sigil: { set: 'x' } }, { enchantments: [{ type: 1 }] },
    // AUDIT (2026-10-17): the refit melts unasked, so a plain piece alone - never locked, bound, a player's make, enchanted
    // by the item maker, graded past Common (its tier, its affixes, a Legendary's record, DFU's magic mark) or socketed
    { locked: true }, { bound: true }, { provenance: 'p:1' }, { customEnchantments: [{ type: 'x' }] }, { rarity: 'magic' },
    { rarity: 'legendary', legendary: 'l1', affixes: [{ id: 'a' }] }, { affixes: [{ id: 'a' }] }, { legendary: 'l1' }, { magic: true },
    { socket: 'empty' }, { sockets: ['empty'] }]) assert.equal(meltable(piece('Weapons', 1, guard)), false, JSON.stringify(guard));
  for (const plain of [{ rarity: 'common' }, { enchantments: [] }, { customEnchantments: [] }, { affixes: [] }, { sockets: [] }, { counterBought: true }, { stolen: true }]) assert.equal(meltable(piece('Weapons', 1, plain)), true, JSON.stringify(plain));
  assert.equal(meltable(null), false);
  const ingot = (t, n) => ({ templateIndex: t, stackCount: n });
  const sword = piece('Weapons', 1), cuirass = piece('Armor', 0x201), worn = piece('Weapons', 1, { equipSlot: 9 }), magic = piece('Armor', 0x201, { enchantments: [{}] });
  const pack = [sword, ingot(621, 2), worn, cuirass, magic], hold = [ingot(621, 1)];
  assert.equal(materialCount([pack, hold], 'steel'), 5, 'three ingots, the sword and the cuirass');
  assert.equal(meltCount([pack, hold], 'steel', 4), 1, 'the ingots first');
  assert.equal(meltCount([pack, hold], 'steel', 9), 2, 'no more than there is');
  assert.equal(meltCount([pack, hold], 'timber', 4), 0);
  assert.equal(takeMaterials([pack, hold], 'steel', 4), true);
  assert.deepEqual([pack.includes(sword), pack.includes(cuirass), hold.length, pack.some((it) => it.templateIndex === 621)], [false, true, 0, false], 'every ingot, the hold\'s too, then the first piece');
  assert.ok(pack.includes(worn) && pack.includes(magic), 'never the worn one or the enchanted one');
  // a steel ingot is Steel and Iron both (MATERIALS.iron): counted once for the two
  const steel = [ingot(621, 4)];
  assert.equal(materialCount([steel], 'iron'), 4);
  assert.equal(materialsFor([steel], [{ kind: 'steel', n: 4 }, { kind: 'iron', n: 4 }]), false);
  assert.equal(steel[0].stackCount, 4, 'tried on copies');
  assert.equal(materialsFor([[...steel, ingot(620, 4)]], [{ kind: 'steel', n: 4 }, { kind: 'iron', n: 4 }]), true);
});

test('REFIT-ORES the refit\'s words, the Fleet page\'s and the shipyard\'s: her line at its numeral, what it betters her by now and next, what the next asks and what the player holds, a metal\'s pieces melted, a level asked (mutants: the share, the melt, the lock)', () => {
  const row = { id: 'guns', label: 'Guns', what: 'Broadside damage', tier: 3, share: 0.24, next: { gold: 6000, share: 0.28, level: 3, locked: true, mats: [{ kind: 'steel', label: 'Steel', n: 4, have: 4, melt: 1 }, { kind: 'iron', label: 'Iron', n: 10, have: 12, melt: 0 }] } };
  const w = refitRowWords(row);
  assert.equal(w.name, 'Guns III');
  assert.equal(w.gain, 'Broadside damage: +24% now, +28% with the next refit.');
  assert.equal(w.asks, 'Next: 6,000 gold, 4 Steel (you have 4), 10 Iron (you have 12).');
  assert.match(w.melt, /Melts down weapons and armor you carry for 1 Steel/);
  assert.equal(w.lock, 'Needs captain level 3.');
  const done = refitRowWords({ ...row, tier: 12, share: 0.6, next: null });
  assert.deepEqual(done, { name: 'Guns XII', gain: 'Broadside damage: +60%.', asks: null, melt: null, lock: null });
  assert.equal(refitRowWords({ ...row, next: { ...row.next, locked: false, mats: [{ ...row.next.mats[0], melt: 0 }] } }).melt, null);
});

// ── the window and the page ──────────────────────────────────────────────────────────────────────────────────────────

test('CAPTAIN-TREE the window\'s words: every star named, its half and kind; a stat\'s line - hands a count, a foul\'s seconds, the reload quicker or slower; the sky\'s sum in the stats\' order; a star refused says why (mutants: a name, the units, the points)', () => {
  for (const s of CAPTAIN_STARS) assert.notEqual(starName(s.id), s.id, `${s.id} named`);
  assert.equal(new Set(CAPTAIN_STARS.map((s) => starName(s.id))).size, CAPTAIN_STARS.length, 'no two alike');
  assert.equal(starKindWords(starOf('c_line')), 'The Commander · keystone');
  assert.equal(starKindWords(starOf('m_quick')), 'The Master · notable');
  assert.deepEqual([starStatWords('way', 0.06), starStatWords('oars', -0.12), starStatWords('boarders', 2), starStatWords('foul', 8), starStatWords('reload', 0.03), starStatWords('reload', -0.1)],
    ['Speed under sail +6%', 'Speed under oars -12%', 'Boarding party size +2', 'Time a rammed ship stays fouled +8 s', 'Guns reload 3% faster', 'Guns reload 10% slower']);
  assert.deepEqual(starLines(starOf('m_wind')), [{ text: 'Speed under sail +12%', neg: false }, { text: 'Speed under oars -12%', neg: true }]);
  assert.deepEqual(skySummary(['helm', 'c_rel1', 'm_hold1']).map((l) => l.key), ['cargo', 'reload'], 'CAPTAIN_STATS\' order');
  assert.equal(starRefusal(['helm'], 'm_way1', 1), null);
  assert.equal(starRefusal(['helm'], 'm_wind', 3), 'Reaching this star costs 5 points. You have 3. You get one point per captain level after the first.');
  assert.equal(starRefusal(['helm'], 'm_way1', 0), 'Reaching this star costs 1 point. You have 0. You get one point per captain level after the first.');
  assert.equal(starRefusal(['helm'], 'nope', 9), 'Unknown star.');
  assert.equal(starRefusal(['helm', 'm_way1'], 'm_way1', 0), null, 'held');
});

/** A document enough for the window: elements that keep children, classes and handlers; a canvas that draws nothing. */
function fakeDoc() {
  const listeners = new Map();
  const mk = (tag) => {
    const kids = [];
    const classes = new Set();
    const e = {
      tagName: tag.toUpperCase(), children: kids, style: {}, attrs: {}, dataset: {}, textContent: '', title: '', disabled: false, handlers: {},
      classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c), toggle: (c, on) => { if (on ?? !classes.has(c)) classes.add(c); else classes.delete(c); }, contains: (c) => classes.has(c) },
      set className(v) { classes.clear(); for (const c of String(v).split(/\s+/).filter(Boolean)) classes.add(c); },
      get className() { return [...classes].join(' '); },
      append: (...n) => kids.push(...n), appendChild: (n) => kids.push(n), replaceChildren: (...n) => { kids.length = 0; kids.push(...n); },
      remove() { e.removed = true; }, setAttribute: (k, v) => { e.attrs[k] = v; }, focus() {}, setPointerCapture() {},
      addEventListener: (t, fn) => { e.handlers[t] = fn; }, getBoundingClientRect: () => ({ left: 0, top: 0, right: 1280, bottom: 60, width: 1280, height: 60 }),
      clientWidth: 1280, clientHeight: 760, offsetWidth: 200, offsetHeight: 100,
      getContext: () => new Proxy({}, { get: (_t, k) => (k === 'measureText' ? (s) => ({ width: String(s).length * 7 }) : k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {}), set: () => true }),
    };
    return e;
  };
  const text = (e) => [e.textContent, ...e.children.map(text)].join('');
  return {
    doc: { createElement: mk, getElementById: () => null, head: mk('head'), documentElement: { dataset: {} } },
    text, mk,
    win: { addEventListener: (t, fn) => listeners.set(t, fn), removeEventListener: (t) => listeners.delete(t), listeners },
  };
}

test('CAPTAIN-TREE the window: a star pressed sets the whole way to it while the points pay; one refused says why; a star taken back takes those joined only through it; Accept gives the ledger the sky and says so, the save told; a close with a change unaccepted asks once (mutants: the way, the points, the cascade, the accept, the ask)', () => {
  const f = fakeDoc();
  const saved = { add: globalThis.addEventListener, rem: globalThis.removeEventListener, doc: globalThis.document, raf: globalThis.requestAnimationFrame, caf: globalThis.cancelAnimationFrame };
  globalThis.document = /** @type {any} */ (f.doc);
  globalThis.addEventListener = f.win.addEventListener;
  globalThis.removeEventListener = f.win.removeEventListener;
  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = () => {};
  try {
    const L = createCaptainLedger();
    const save = L.newSaveData();
    save.log.sunk.pirate = 30;   // level 5: four points
    L.restoreSaveData(save);
    let exits = 0, changed = 0;
    const host = f.mk('div');
    const w = mountCaptainTreeWindow(/** @type {any} */ (host), { ledger: L, changed: () => changed++, onExit: () => exits++, doc: /** @type {any} */ (f.doc) });
    w.take('c_drill');
    assert.deepEqual(w.model().pending, ['helm', 'c_rel1', 'c_rel2', 'c_drill'], 'the whole way');
    w.take('c_line');
    assert.deepEqual(w.model().pending.length, 4, 'two more than the one point left: refused');
    assert.match(f.text(host), /Reaching this star costs 2 points\. You have 1\./);
    w.take('m_way1');
    assert.equal(w.model().pending.length, 5);
    w.giveBack('c_rel1');
    assert.deepEqual(w.model().pending, ['helm', 'm_way1'], 'the drill\'s path with it');
    w.take('c_rel1');
    assert.deepEqual(w.model().changes, { added: 2, removed: 0 });
    assert.equal(w.tryClose(), false, 'asked first');
    assert.match(f.text(host), /You have unaccepted changes\. Press Accept to keep them, or close again to discard them\./);
    w.accept();
    assert.deepEqual(L.tree(), ['helm', 'm_way1', 'c_rel1']);
    assert.equal(changed, 1);
    assert.match(f.text(host), /Stars saved/);
    assert.equal(w.tryClose(), true);
    assert.equal(exits, 1);
    assert.equal(f.win.listeners.has('keydown'), false, 'the keyboard given back');
  } finally {
    globalThis.addEventListener = saved.add; globalThis.removeEventListener = saved.rem; globalThis.document = saved.doc;
    globalThis.requestAnimationFrame = saved.raf; globalThis.cancelAnimationFrame = saved.caf;
  }
});

test('CAPTAIN-TREE the Captain page: her level, her XP\'s meter to the next, the stars set of her points, and the door to the stars through the menu\'s hand-off (mutants: the meter\'s floor, the door)', () => {
  assert.deepEqual(levelMeter({ xp: 1200, level: 5, points: 4, next: xpForLevel(6) }), { now: 1200 - xpForLevel(5), max: xpForLevel(6) - xpForLevel(5), label: `${(xpForLevel(6) - 1200).toLocaleString('en-US')} XP to level 6` });
  assert.equal(levelMeter({ xp: 99999, level: 30, points: 29, next: null }).label, 'Maximum level');
  assert.equal(levelMeter(null), null);
  const f = fakeDoc();
  const el = (tag, cls = null, text = null) => { const e = f.mk(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  let opened = 0, handed = 0;
  setHoldingsProvider({ captain: { model: () => ({ crowns: [], log: [], stars: { xp: 1200, level: 5, points: 4, next: xpForLevel(6), set: 1 } }), openStars: () => { opened++; return true; } } });
  const saved = globalThis.document;
  globalThis.document = /** @type {any} */ (f.doc);
  try {
    const detail = el('div');
    drawCaptainPage(detail, () => {}, { el, divider: (t) => el('h4', null, t), door: (fn) => { handed++; fn(); } });
    const words = f.text(detail);
    assert.match(words, /The Captain's StarsLevel 5/);
    assert.match(words, /1 of 4 stars set - 3 to spend\./);
    const find = (e) => (e.tagName === 'BUTTON' ? e : e.children.map(find).find(Boolean));
    const b = find(detail);
    assert.equal(b.textContent, 'Open the stars');
    b.onclick();
    assert.deepEqual([handed, opened], [1, 1], 'through the hand-off');
  } finally {
    globalThis.document = saved;
    setHoldingsProvider(null);
  }
  assert.match(rd('src/scenes/world.js'), /show: \(w\) => townTalk\.showOverlay\(w\), changed: \(\) => \{ fleetHost\?\.restat\(\); surfacePlayer\(\); \} \}\);/);
  assert.match(rd('src/scenes/captainPageHost.js'), /const w = createCaptainStarsOverlay\(\{ ledger: deps\.ledger, changed: deps\.changed \}\);\n\s+if \(w\) deps\.show\(w\);/);
});
