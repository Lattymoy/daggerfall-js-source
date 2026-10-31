// RAID-BOSS-LOOK (2026-10-31): a PvE raid boss is drawn at a staff mini boss's default size with an outline of its own
// colour (systems/eliteFoes.js RAID_BOSS_GLOW / RAID_BOSS_SIZE, systems/hitFlash.js RAID_BOSS_RIM). Looks alone.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  eliteGlow, eliteSize, isEliteCorpse, markEliteCorpseBatch, bossGlowOffset, isRaidBoss,
  RAID_BOSS_GLOW, RAID_BOSS_SIZE, STAFF_BOSS_GLOW,
} from '../../../src/systems/eliteFoes.js';
import { STAFF_BOSS_SIZE_DEFAULT } from '../../../src/net/staffEvent/staffEventLaw.js';
import { standTemplate, templateFoe } from '../../../src/systems/pve/pveGrant.js';
import { MOB_TEMPLATES } from '../../../src/systems/pve/pveTemplates.js';

const raidKeys = MOB_TEMPLATES.filter((t) => t.category === 'raidBoss').map((t) => t.key);

test('every raid boss stands marked, at a mini boss\'s default size', () => {
  assert.equal(raidKeys.length, 10);
  assert.equal(RAID_BOSS_SIZE * 100, STAFF_BOSS_SIZE_DEFAULT);
  for (const k of raidKeys) {
    const e = standTemplate({}, templateFoe(k));
    assert.ok(isRaidBoss(e), k);
    assert.equal(eliteSize(e), RAID_BOSS_SIZE, k);
  }
});

test('a raid boss glows past RAID_BOSS_GLOW, a mini boss and an elite as before', () => {
  const raid = standTemplate({}, templateFoe(raidKeys[0]));
  for (const t of [0, 0.4, 1.3, 2.9]) {
    const g = eliteGlow(raid, t);
    assert.ok(g >= RAID_BOSS_GLOW + 0.55 && g <= RAID_BOSS_GLOW + 1, String(g));
    const m = eliteGlow({ eliteFoe: true, staffBoss: { size: 2 } }, t);
    assert.ok(m >= STAFF_BOSS_GLOW + 0.55 && m <= STAFF_BOSS_GLOW + 1);
    const e = eliteGlow({ eliteFoe: true }, t);
    assert.ok(e >= 0.55 && e <= 1);
  }
  assert.equal(eliteGlow({}, 1), 0);
  assert.equal(eliteGlow(standTemplate({}, templateFoe('orc-grunt')), 1), 0);   // a plain template foe: no glow
});

test('a raid boss corpse keeps its red outline; true still marks a mini boss', () => {
  const raid = standTemplate({}, templateFoe(raidKeys[3]));
  assert.ok(isEliteCorpse(raid));
  const b = {}; markEliteCorpseBatch(b, 0.5, bossGlowOffset(raid));
  assert.ok(-b.eliteGlow >= RAID_BOSS_GLOW + 0.05 && -b.eliteGlow <= RAID_BOSS_GLOW + 1);
  const m = {}; markEliteCorpseBatch(m, 0.5, true);
  assert.ok(-m.eliteGlow >= STAFF_BOSS_GLOW + 0.05 && -m.eliteGlow < RAID_BOSS_GLOW);
  const e = {}; markEliteCorpseBatch(e, 0.5);
  assert.ok(-e.eliteGlow < STAFF_BOSS_GLOW);
});

test('the shaders read the raid boss band before the mini boss band', () => {
  const src = readFileSync(new URL('../../../src/systems/hitFlash.js', import.meta.url), 'utf8');
  assert.match(src, /RAID_BOSS_RIM/);
  assert.match(src, /-g >= 4\.0 \? 4\.0 : -g >= 2\.0 \? 2\.0 : 0\.0/);
  assert.match(src, /if \(k >= 4\.0\) k -= 4\.0; else if \(k >= 2\.0\) k -= 2\.0;/);
});
