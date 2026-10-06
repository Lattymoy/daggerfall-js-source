// CREW-HOLD and GALLEON-WEIGHT (2026-10-06, Mac: "Crew depletes too fast"; "The galleon has less cannons, so it needs a
// buff to account for that") - A PLAYER'S CREW STANDS TWICE WHAT A CAPTAIN'S DOES, AND A PLAYER'S GALLEON THROWS SIX GUNS'
// WEIGHT FROM HER FIVE PORTS (bible/03-World/Naval-Combat.md). The men every blow on a player's ship takes - a ball's, her
// fire's, a galley's ram's, the serpent's - over PLAYER_CREW_TOUGHNESS, the captains' crews as they were; her broadside's
// weight of metal from her guns to each ball's hit and the captains' reckoning of her fire, the captains' galleons as they
// were tuned. Each pin failed on the build before it. tools/mutants/crewhold.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { SHIP_TOUGHNESS, PLAYER_CREW_TOUGHNESS, playerBatteryWeight, setGalleonStanding, hullBuild, MOD_SMALL_SHIP_BUILD, GUNS, HULL, SHIP_CLASSES, batteryOf, classById } from '../src/systems/naval/navalShips.js';
import { ballMen, playerMen, shotDamage, createShipDamage, HOLED_BONUS, WATERLINE_BAND } from '../src/systems/naval/navalDamage.js';
import { ramMen, RAM_A_MAN } from '../src/scenes/navalHost.js';
import { fightingPower, classPower, strikeTime, hitShare, layMin, rangeOfHull, TURN_PER_VOLLEY } from '../src/systems/naval/navalAI.js';
import { volleyLaunches, reloadSeconds } from '../src/systems/naval/navalGunnery.js';
import { createShotField } from '../src/systems/naval/navalShots.js';
import { orientedBox } from '../src/systems/naval/navalBallistics.js';

const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
/** Every roll a blow can come on, evenly - so a mean is the blow's own average. */
const ROLLS = Array.from({ length: 1000 }, (_, i) => (i + 0.5) / 1000);
const mean = (f) => ROLLS.reduce((sum, r) => sum + f(r), 0) / ROLLS.length;
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) < eps, `${msg ?? ''} ${a} against ${b}`);

test('CREW-HOLD the law: a player\'s crew stands twice what a captain\'s does - a ball\'s, a ram\'s and the serpent\'s men over PLAYER_CREW_TOUGHNESS on her ship, over SHIP_TOUGHNESS on a captain\'s, whole men on the roll; her hull and canvas the gun\'s either way (mutants: the toughness, the ball\'s, the ram\'s)', () => {
  assert.equal(PLAYER_CREW_TOUGHNESS, 2 * SHIP_TOUGHNESS);
  for (const men of [1, 2, 3, 4]) {
    near(mean((r) => ballMen(men, r)), men / SHIP_TOUGHNESS, 2e-3, `a captain's crew, ${men} men a blow:`);
    near(mean((r) => playerMen(men, r)), men / PLAYER_CREW_TOUGHNESS, 2e-3, `a player's crew, ${men} men a blow:`);
    assert.ok(ROLLS.every((r) => Number.isInteger(playerMen(men, r))), 'whole men');
  }
  assert.equal(playerMen(0, 0.999), 0, 'no men, nobody');
  for (const gun of ['long', 'swivel', 'heavy', 'chain', 'barrel']) {
    for (const zone of ['hull', 'holed', 'rig']) {
      const g = GUNS[gun];
      near(mean((r) => shotDamage(g, zone, { roll: r, tough: PLAYER_CREW_TOUGHNESS }).crew), mean((r) => shotDamage(g, zone, { roll: r }).crew) / 2, 2e-3, `${gun} ${zone}: half the men`);
      const mine = shotDamage(g, zone, { roll: 0.3, tough: PLAYER_CREW_TOUGHNESS }), theirs = shotDamage(g, zone, { roll: 0.3 });
      assert.deepEqual([mine.hull, mine.sail], [theirs.hull, theirs.sail], `${gun} ${zone}: her timbers and canvas as a captain's`);
    }
  }
  near(mean((r) => ramMen(200, r, PLAYER_CREW_TOUGHNESS)), 200 / RAM_A_MAN / PLAYER_CREW_TOUGHNESS, 2e-3, 'a galley\'s ram on her');
  near(mean((r) => ramMen(200, r)), 200 / RAM_A_MAN / SHIP_TOUGHNESS, 2e-3, 'a ram on a captain\'s, as it was');
});

test('CREW-HOLD her fire: the same sixteen fires burned out take a captain\'s crew ten men and a player\'s five - her timbers and canvas alike (mutants: the player\'s wound)', () => {
  const burn = (player) => {
    const d = createShipDamage({ hullHp: 100000, sailHp: 1000, crew: 100, player });
    for (let i = 0; i < 16; i++) {
      d.apply({ hull: 0, sail: 0, crew: 0, fire: true }, i * 20);
      for (let k = 0; k < 200; k++) d.step(0.1, i * 20 + k * 0.1);
    }
    assert.equal(d.fire, 0, 'every fire out');
    return d;
  };
  const theirs = burn(false), mine = burn(true);
  assert.equal(100 - theirs.crew, 10, 'a captain\'s: a man\'s worth a fire over SHIP_TOUGHNESS');
  assert.equal(100 - mine.crew, 5, 'a player\'s: over PLAYER_CREW_TOUGHNESS');
  assert.deepEqual([mine.hull, mine.sail], [theirs.hull, theirs.sail], 'the same fires on her timbers and canvas');
});

/** On navalAI.js strikeTime's own terms (its balls, hits and holes), how long `cls`'s fire takes to empty a player's
 *  `hull` of her crew and of her timbers (s). */
function emptying(hull, cls) {
  const a = classPower(cls), b = hullBuild(hull);
  const sides = a.tactic === 'bow' ? ['bow', 'starboard'] : ['starboard'];
  let timber = 0, men = 0;
  for (const side of sides) {
    const bat = batteryOf(a.hull, side);
    if (!bat || layMin(a.hull, side, hull) > rangeOfHull(hull)) continue;
    const g = GUNS[bat.gun];
    const hits = (bat.muzzles.length / sides.length / (reloadSeconds(bat.gun, 1, true) + TURN_PER_VOLLEY / Math.max(1, a.turn))) * hitShare(bat, a.skill, hull);
    timber += hits * g.hull * (1 + HOLED_BONUS * Math.min(1, WATERLINE_BAND / b.top));
    men += (hits * g.crew) / PLAYER_CREW_TOUGHNESS;
  }
  return { timber: b.hullHp / timber, crew: b.crew / men };
}

test('CREW-HOLD measured, on strikeTime\'s own terms: every ship of the line\'s fire leaves a player\'s galleon and Carrack their crews when their hulls are gone - a brigantine takes a galleon\'s men in 292 s and her hull in 176 (at SHIP_TOUGHNESS her men went in 146); a swivel boat\'s balls still thin a crew first, its trade, at half the pace (mutants: the toughness)', () => {
  for (const hull of [HULL.SmallShip, HULL.Carrack]) {
    for (const cls of SHIP_CLASSES) {
      const t = emptying(hull, cls);
      if (cls.hull === HULL.LargeBoat) assert.ok(t.crew < t.timber, `${cls.id}'s swivels on hull ${hull}: her men first (${t.crew.toFixed(0)} s against ${t.timber.toFixed(0)})`);
      else assert.ok(t.crew > t.timber * 1.5, `${cls.id} on hull ${hull}: her crew outlasts her hull (${t.crew.toFixed(0)} s against ${t.timber.toFixed(0)})`);
    }
  }
  const brig = emptying(HULL.SmallShip, classById('pirateBrig'));
  near(brig.crew, 292, 1, 'a brigantine on a galleon\'s men');
  near(brig.timber, 176, 1, 'and on her hull');
  near(emptying(HULL.SmallShip, classById('pirateSloop')).crew, 134, 1, 'a sloop\'s swivels on a galleon\'s men (67 s before)');
});

test('GALLEON-WEIGHT the law: a player\'s galleon\'s broadside throws the mod\'s six long guns\' weight from her five ports - each ball 6/5 her hull and canvas harm, never her men; her chasers and barrels, every other hull and the mod\'s own galleon standing in throw their own (mutants: the weight, the side, the stand-in, the shot\'s)', () => {
  assert.equal(hullBuild(HULL.SmallShip).broadside.length, 5, 'Mac\'s galleon: a gun a port');
  assert.equal(MOD_SMALL_SHIP_BUILD.broadside.length, 6, 'the mod\'s: six a side');
  for (const side of ['starboard', 'port']) assert.equal(playerBatteryWeight(HULL.SmallShip, side), 6 / 5);
  for (const side of ['bow', 'stern']) assert.equal(playerBatteryWeight(HULL.SmallShip, side), 1, `her ${side}: as it was`);
  for (const hull of [HULL.Rowboat, HULL.LargeBoat, HULL.LargeGalley, HULL.Carrack]) for (const side of ['starboard', 'port', 'bow', 'stern']) assert.equal(playerBatteryWeight(hull, side), 1);
  setGalleonStanding(false);
  try { assert.equal(playerBatteryWeight(HULL.SmallShip, 'starboard'), 1, 'the mod\'s own galleon standing in: her own six guns'); } finally { setGalleonStanding(true); }
  const w = playerBatteryWeight(HULL.SmallShip, 'starboard');
  near(hullBuild(HULL.SmallShip).broadside.length * GUNS.long.hull * w, MOD_SMALL_SHIP_BUILD.broadside.length * GUNS.long.hull, 1e-9, 'her broadside the mod\'s six guns\' harm:');
  for (const zone of ['hull', 'holed', 'rig']) {
    const heavy = shotDamage(GUNS.long, zone, { roll: 0.5, weight: w }), plain = shotDamage(GUNS.long, zone, { roll: 0.5 });
    assert.equal(heavy.crew, plain.crew, `${zone}: her men the gun's`);
    assert.equal(heavy.hull, Math.round(plain.hull === 0 ? 0 : GUNS.long.hull * (zone === 'holed' ? 1 + HOLED_BONUS : 1) * w), `${zone}: her timbers by the weight`);
    assert.ok(heavy.hull + heavy.sail > plain.hull + plain.sail, `${zone}: a heavier ball`);
  }
});

test('GALLEON-WEIGHT rides the ball: the launches carry the weight they are fired with, each ball keeps it, and its hit says it to the host, which lays it on the harm (mutants: the launch, the ball, the hit)', () => {
  const sol = { side: 'starboard', gun: 'long', barrel: false, elevation: 0.02, dir: [1, 0, 0], muzzles: [[0, 2, 0], [0, 2, 2]] };
  const launched = volleyLaunches(sol, 7, { skill: 1, weight: 6 / 5 });
  assert.equal(launched.length, 2);
  assert.ok(launched.every((l) => l.weight === 6 / 5), 'each launch its weight');
  assert.ok(volleyLaunches(sol, 7, { skill: 1 }).every((l) => l.weight === 1), 'a captain\'s volley: none of it');
  const events = [];
  const her = { id: 'her', box: orientedBox([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 50, 1, 0, 1], [0, 0, 0], [3, 3, 8]), overSea: 1 };
  const field = createShotField({ seaY: () => 0, targets: () => [her], onEvent: (e) => events.push(e), random: () => 0.25 });
  field.fireVolley({ id: 1, shooter: 'me:1', launches: [{ gun: 'long', index: 0, p0: [0, 2, 0], v0: [60, 1.5, 0], delay: 0, weight: 6 / 5 }], side: 'starboard', owner: 'me' });
  for (let i = 0; i < 20; i++) field.step(0.1);
  const hit = events.find((e) => e.type === 'hit');
  assert.equal(hit?.target, 'her', 'she is struck');
  assert.equal(hit.weight, 6 / 5, 'the hit says the ball\'s weight');
});

test('GALLEON-WEIGHT the captains\' reckoning: a player\'s galleon makes a ship strike 6/5 as fast as a captain\'s galleon would - her measure says she is a player\'s - and a captain\'s fights as she was tuned (mutants: the player\'s weight in strikeTime, the measure\'s flag)', () => {
  const b = hullBuild(HULL.SmallShip);
  const mine = fightingPower({ hull: HULL.SmallShip, hullHp: b.hullHp, crew: 24, player: true });
  const theirs = fightingPower({ hull: HULL.SmallShip, hullHp: b.hullHp, crew: 24 });
  assert.equal(mine.player, true);
  assert.equal(theirs.player, false);
  assert.equal(classPower(classById('pirateBrig')).player, false, 'a captain\'s galleon is a captain\'s');
  const target = fightingPower({ hull: HULL.Carrack, hullHp: hullBuild(HULL.Carrack).hullHp });   // one that strikes by her hull alone
  near(strikeTime(theirs, target) / strikeTime(mine, target), 6 / 5, 1e-9, 'my fire six guns\' weight:');
  assert.equal(strikeTime(classPower(classById('pirateBrig')), target), strikeTime(fightingPower({ ...classPower(classById('pirateBrig')) }), target), 'a captain\'s as tuned');
});

test('CREW-HOLD and GALLEON-WEIGHT on the host, by source: a captain\'s ball on my boat takes her men as a player\'s crew stands them and strikes with its weight; a galley\'s ram on my boat; the serpent\'s blow through playerMen; my volley and a peer\'s own boat\'s carry the weight, a captain\'s none; my boat\'s measure a player\'s (mutants: each seam)', () => {
  const n = src('scenes/navalHost.js');
  assert.match(n, /const hurt = shotDamage\(gun, zone, \{ braced: st\.guns\.braced, roll: random\(\), tough: PLAYER_CREW_TOUGHNESS, weight: e\.weight \}\);/, 'a ball on my boat');
  assert.match(n, /const hurt = shotDamage\(gun, zone, \{ roll: random\(\), weight: e\.weight \}\);/, 'a ball on a captain\'s ship: her men a captain\'s');
  assert.match(n, /hull: gun\.hull \* \(e\.weight \?\? 1\) \* \(0\.85 \+ 0\.3 \* random\(\)\)/, 'a ball in the serpent');
  assert.match(n, /st\.damage\.apply\(\{ hull: dealt, sail: 0, crew: ramMen\(dealt, random\(\), PLAYER_CREW_TOUGHNESS\) \}, clock\);/, 'a galley\'s ram on my boat');
  assert.match(n, /const men = playerMen\(hurt\.crew \?\? 0, random\(\)\);\n\s+const change = st\.damage\.apply\(\{ \.\.\.hurt, crew: men,/, 'the serpent\'s blow');
  assert.match(n, /const weight = isMine\(shooter\) \? playerBatteryWeight\(hull, solution\.side\) : 1;[^\n]*\n\s+const launches = volleyLaunches\([^\n]*\{ skill, carry: pose\.velocity, weight \}\);/, 'my volley');
  assert.match(n, /const weight = v\.shooter < 0 \? playerBatteryWeight\(v\.hull, v\.side\) : 1;[^\n]*\n\s+const launches = volleyLaunches\([^\n]*\{ skill: v\.skill, carry: v\.vel, weight \}\);/, 'a peer\'s own boat\'s volley');
  assert.match(n, /return fightingPower\(\{ hull: boat\.hull, [^\n]*crewed: !!boat\.crewed, player: true \}\);/, 'my boat\'s measure');
  assert.match(n, /crewed: !\(p\.boat && !p\.boat\.crewed\), player: true \}\);/, 'a peer\'s boat\'s measure');
});
