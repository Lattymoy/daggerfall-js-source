// CAPT-WATERS (2026-10-11, the owner: "giving a reason to players to experience it") - THE RICH WATERS (bible/03-World/
// Captains-Sea.md): SEA-EASE's safe coasts kept, and the DEEP waters - DEEP_PX map pixels and more from every port - the
// captain's chosen risk: pirates DEEP_PIRATE_K as likely and the trade's ships fewer, classes drawn DEEP_LEVEL levels up,
// pirates bold DEEP_BOLD of the time on the same draw that makes a coast's pirate bold, and every hold and cask rolled
// DEEP_TIER rarity tiers richer. The plate says the deep. tools/mutants/captwaters.json.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  watersOf, factionWeights, createNavalDirector, DEEP_PX, DEEP_PIRATE_K, DEEP_TRADE_K, DEEP_LEVEL, DEEP_BOLD, DEEP_TIER, FACTION_WEIGHTS, PORT_PIRATE_K,
} from '../../../src/systems/naval/navalDirector.js';
import { temperOf, TEMPERS, BOLD_SHARE } from '../../../src/systems/naval/navalAI.js';
import { classById } from '../../../src/systems/naval/navalShips.js';
import { navalHudText } from '../../../src/ui/naval/navalHud.js';
import { sea } from '../../navalSea.mjs';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');

test('CAPT-WATERS the waters a captain sails: coastal within a port\'s reach (SEA-EASE\'s own), deep DEEP_PX map pixels and more from every port, else open - and no port known is never deep (mutants: the threshold, the coast first, the unknown)', () => {
  assert.equal(DEEP_PX, 12);
  assert.equal(watersOf({ nearPort: true, portPx: 40 }), 'coastal', 'a port\'s reach before anything');
  assert.equal(watersOf({ portPx: 11 }), 'open');
  assert.equal(watersOf({ portPx: 12 }), 'deep');
  assert.equal(watersOf({ portPx: null }), 'open');
  assert.equal(watersOf({ portPx: NaN }), 'open', 'a distance nobody measured is no deep');
  assert.equal(watersOf(), 'open');
});

test('CAPT-WATERS the deep\'s traffic: pirates DEEP_PIRATE_K times as likely, the merchantmen and the crown\'s ships DEEP_TRADE_K - a port\'s waters keep SEA-EASE\'s peace whatever the flag says (mutants: each weight, the port\'s precedence)', () => {
  assert.deepEqual([DEEP_PIRATE_K, DEEP_TRADE_K], [1.8, 0.5]);
  const d = factionWeights({ deep: true });
  assert.deepEqual(d, { pirate: FACTION_WEIGHTS.pirate * 1.8, merchant: FACTION_WEIGHTS.merchant * 0.5, navy: FACTION_WEIGHTS.navy * 0.5 });
  assert.deepEqual(factionWeights({ deep: false }), { ...FACTION_WEIGHTS });
  const port = factionWeights({ nearPort: true, deep: true });
  assert.equal(port.pirate, FACTION_WEIGHTS.pirate * PORT_PIRATE_K, 'the crown\'s own waters');
});

test('CAPT-WATERS the deep\'s launches: a spawn there says so (`deep`), and its class is drawn DEEP_LEVEL levels above the captain\'s own - a first-level captain meets brigantines there; off the deep, the spec as it was (mutants: the level, the flag)', () => {
  assert.equal(DEEP_LEVEL, 3);
  const roll = (deep, level, n = 400) => {
    const classes = new Set(), flags = new Set();
    for (let i = 0; i < n; i++) {
      const dir = createNavalDirector({ random: () => 0 });
      const out = dir.step(40, { density: 4, player: [0, 0, 0], players: [[0, 0, 0]], level, ships: [], isOpenWater: () => true, nearPort: false, deep, notoriety: 0, seedBase: i * 977 + 3, seaY: 0 });
      if (out.spawn && !out.spawn.encounter) { classes.add(out.spawn.classId); flags.add(!!out.spawn.deep); }
    }
    return { classes, flags };
  };
  const deep = roll(true, 1);
  assert.ok(deep.classes.has('pirateBrig'), 'a brigantine (minLevel 4) at level 1 + 3');
  assert.deepEqual([...deep.flags], [true]);
  const coast = roll(false, 1);
  assert.ok(!coast.classes.has('pirateBrig'), 'never on the open sea at level 1');
  assert.deepEqual([...coast.flags], [false]);
});

test('CAPT-WATERS a deep pirate\'s temper: bold on DEEP_BOLD of the draw that makes a coast\'s bold on BOLD_SHARE - every coast\'s bold pirate bold in the deep too; the trade\'s and the flagship\'s tempers their own (mutants: the share unread, the draw)', () => {
  assert.equal(DEEP_BOLD, 0.5);
  const sloop = classById('pirateSloop');
  let coast = 0, deep = 0;
  const N = 4000;
  for (let i = 0; i < N; i++) {
    const c = temperOf(sloop, i * 2654435761 >>> 0), d = temperOf(sloop, i * 2654435761 >>> 0, { bold: DEEP_BOLD });
    if (c === TEMPERS.bold) { coast++; assert.equal(d, TEMPERS.bold, 'bold on the coast, bold in the deep'); }
    if (d === TEMPERS.bold) deep++;
  }
  assert.ok(Math.abs(coast / N - BOLD_SHARE) < 0.03, `coast ${coast / N}`);
  assert.ok(Math.abs(deep / N - DEEP_BOLD) < 0.03, `deep ${deep / N}`);
  assert.equal(temperOf(classById('merchantCoaster'), 5, { bold: 1 }), TEMPERS.peaceful);
  assert.equal(temperOf(classById('pirateFlagship'), 5, { bold: 0 }), TEMPERS.bold);
});

test('CAPT-WATERS at sea: a ship launched of the deep is the deep\'s - her temper the deep\'s draw, her casks marked; her hold and her casks rolled DEEP_TIER tiers richer; the plate says the deep (mutants: the flag, the temper, the tiers, the plate)', async () => {
  assert.equal(DEEP_TIER, 2);
  const s = await sea({ hull: 2, where: { waters: 'deep' } });
  const id = s.host.spawnShip('pirateSloop');
  const e = s.host._sea.get(id);
  assert.equal(e.deep, false, 'a hand-launched ship is no deep one');
  const host = rd('src/scenes/naval/navalHost.js');
  assert.match(host, /if \(spec\.deep\) ship\.temper = temperOf\(cls, spec\.seed, \{ bold: DEEP_BOLD \}\);/);
  assert.match(host, /region, deep: !!spec\.deep, ether, legend: legend\?\.id \?\? null, orphan: null,/);
  assert.match(host, /deps\.hold\?\.\(key, tier \+ \(entry\.deep \? DEEP_TIER : 0\) \+ etherTier\(entry\)\)/, 'her hold');
  assert.match(host, /holdTier\(classById\(e\.from\)\) \+ \(e\.deep \? DEEP_TIER : 0\)/, 'her cask hauled');
  assert.match(host, /holdTier\(classById\(f\.from\)\) \+ \(f\.deep \? DEEP_TIER : 0\)/, 'her cask stowed');
  assert.match(host, /lot, from: s\.cls\.id, deep: !!entry\.deep \|\| !!entry\.ether \}\);/, 'her casks marked');
  assert.match(host, /nearPort: !!w\.nearPort, deep: w\.waters === 'deep', notoriety:/, 'the director told the waters');
  assert.equal(s.host.hudModel().waters, 'deep');
  const plate = navalHudText({
    ship: { name: 'Small Ship', hull: 1, sail: 1, crew: 1 }, armed: false, aiming: false, aim: null, board: null, boarding: null, target: null, batteries: [],
    notoriety: { crown: 'Wayrest', value: 0, level: 0 }, waters: 'deep',
  }, { aim: 'R', board: 'E', brace: 'C' }).plate;
  assert.equal(plate.waters, 'Wayrest waters, deep');
  const shots = rd('src/systems/naval/navalShots.js');
  assert.match(shots, /floaters\.push\(\{ kind: 'flotsam', id, from, lot, owner, deep: !!deep,/);
  assert.match(shots, /owner: f\.owner, deep: !!f\.deep, collector: c\.id,/);
});

test('CAPT-WATERS the world\'s waters: where() says them off the port\'s reach and the nearest port\'s distance - every map port\'s pixel found once, the distance Chebyshev and asked once a pixel (mutants: the distance\'s metric, the waters unsaid)', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /waters: ether \? 'ether' : watersOf\(\{ nearPort, portPx: navalPortPx\(\) \}\),/);
  assert.match(w, /for \(const q of _navalPorts\) d = Math\.min\(d, Math\.max\(Math\.abs\(q\.x - p\.x\), Math\.abs\(q\.y - p\.y\)\)\);/);
  assert.match(w, /if \(_navalPortPxAt\?\.key === key\) return _navalPortPxAt\.d;/);
});
