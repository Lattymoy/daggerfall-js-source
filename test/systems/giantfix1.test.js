// GIANT-LOOT + GIANT-BLOWS (2026-10-12, a player in the open zone: "the greater giant now drops like 2 gold and does less
// damage than normal mobs in the zone").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { eliteLoot, grantEliteLoot } from '../../src/systems/eliteFoes.js';
import { WILD_GIANT_DAMAGE_MULT } from '../../src/systems/wild/wildZone.js';

const src = readFileSync(new URL('../../src/scenes/exteriorFoes.js', import.meta.url), 'utf8');

test('GIANT-LOOT: a Greater Giant is no elite, so the elite door gave it nothing - its two drops are the elite table\'s, laid on it directly', () => {
  const giant = { wildGiant: true, items: [] };
  grantEliteLoot(giant, 20, () => 0.5);
  assert.equal(giant.items.length, 0, 'the door the giant used: an elite\'s alone - the bug');
  const one = eliteLoot(20, () => 0.5);
  assert.ok(one.length >= 2, 'an elite\'s drop is pieces and a purse');
  assert.ok(one.some((it) => it?.isGold || /gold/i.test(String(it?.name ?? it?.shortName ?? '')) || it?.templateIndex === 0 || it?.group === 'Currency'), 'with its gold');
  assert.match(src, /if \(entity\.wildGiant\) \{ entity\.items = entity\.items \?\? \[\]; entity\.items\.push\(\.\.\.eliteLoot\(builtLevel\), \.\.\.eliteLoot\(builtLevel\)\); \}/);
  assert.doesNotMatch(src, /if \(entity\.wildGiant\) \{ grantEliteLoot/);
});

test('GIANT-BLOWS: every client\'s copy of a Greater Giant strikes with its four times - once, when its owner\'s record names it', () => {
  assert.equal(WILD_GIANT_DAMAGE_MULT, 4);
  assert.match(src, /if \(!f\.entity\._ggBlows\) \{ f\.entity\._ggBlows = true; f\.entity\.damageScale = \(Number\.isFinite\(f\.entity\.damageScale\) && f\.entity\.damageScale > 0 \? f\.entity\.damageScale : 1\) \* WILD_GIANT_DAMAGE_MULT; \}/);
  // the owner's own stand keeps its arm (health and blows), unchanged
  assert.match(src, /if \(wild && mobileType === WILD_GIANT && zoneGiant != null && !puppet\) \{/);
});
