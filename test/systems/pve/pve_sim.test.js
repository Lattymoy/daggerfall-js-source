// FIXED-PVE stage 3 (bible/05-Combat/Fixed-PvE.md section 4): the reference builds, the Combat Profile and Score, the
// simulator and the balance report, held to their laws.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildAt, BUILD_KIND_KEYS, TIERS } from '../../../src/systems/pve/pveBuilds.js';
import { combatProfile, combatScore, encounterEval, dangerWord, DANGER_WORDS } from '../../../src/systems/pve/pveProfile.js';
import { simulate, simMany, probeTemplate, groupFoes } from '../../../src/systems/pve/pveSim.js';
import { REFERENCE_PLAYER, PVE_CATEGORIES, PLAYER_EDGE, NORMAL_BLOWS, referencePlayer } from '../../../src/systems/pve/pveCategories.js';
import { GROUP_TEMPLATES } from '../../../src/systems/pve/pveTemplates.js';
import { TACT } from '../../../src/ai/tactics.js';
import { CURB_SHARE } from '../../../src/systems/bossTraits.js';
import { fights } from '../../../tools/pveBalance.mjs';

const median = (xs) => { const a = [...xs].sort((x, y) => x - y), m = a.length / 2; return a.length % 2 ? a[Math.floor(m)] : (a[m - 1] + a[m]) / 2; };

test('FIXED-PVE builds: six kinds at six tiers, every number whole, and each kind grows with its level', () => {
  assert.equal(BUILD_KIND_KEYS.length, 6);
  for (const k of BUILD_KIND_KEYS) {
    let last = 0;
    for (const { level } of TIERS) {
      const b = buildAt(k, level);
      for (const v of [b.blow, b.hit, b.actionS, b.health, b.taken]) assert.ok(Number.isFinite(v) && v > 0, `${k} L${level}`);
      assert.ok(b.actionS >= 0.3 && b.actionS <= 2.5, `${k} L${level} acts every ${b.actionS} s`);
      const s = combatScore(b);
      assert.ok(s > last, `${k}'s score rises at L${level}`);
      last = s;
    }
  }
  assert.throws(() => buildAt('bard', 10), /unknown build kind/);
});

test('FIXED-PVE the reference player is the builds\' middle: what a swing lands and health it can lose, within 5%', () => {
  for (const [level, blow, health] of REFERENCE_PLAYER) {
    const ps = BUILD_KIND_KEYS.map((k) => combatProfile(buildAt(k, level)));
    const swing = referencePlayer(level).swingS;
    const mb = median(ps.map((p) => p.offense)) * swing, mh = median(ps.map((p) => p.defense));
    assert.ok(Math.abs(blow / mb - 1) <= 0.05, `L${level} blow ${blow} vs the builds' ${mb.toFixed(1)}`);
    assert.ok(Math.abs(health / mh - 1) <= 0.05, `L${level} health ${health} vs the builds' ${mh.toFixed(0)}`);
  }
});

test('FIXED-PVE the category law: Normal is the unit, and each category\'s health and blow follow its party, swings and margin', () => {
  assert.deepEqual([PVE_CATEGORIES.normal.health, PVE_CATEGORIES.normal.damage], [1, 1]);
  for (const c of Object.values(PVE_CATEGORIES)) {
    assert.ok(Math.abs(c.health - (c.party * c.swings) / NORMAL_BLOWS) < 1e-9, c.label);
    assert.ok(Math.abs(c.damage - ((c.party + 1) * NORMAL_BLOWS * (1 + PLAYER_EDGE.mid)) / (2 * c.swings * c.margin)) < 1e-9, c.label);
  }
});

test('FIXED-PVE a player on the reference line keeps the planned edge over a Normal foe of its level', () => {
  for (const level of [1, 12, 27, 45]) {
    const r = referencePlayer(level);
    const b = { blow: r.blow, hit: 1, actionS: r.swingS, health: r.health, taken: 1, evade: 0, block: 0, regen: 0, vigil: false, hitCap: null,
      spellShare: 0, element: null, blade: true, family: 'melee', range: 0, control: 0 };
    const e = encounterEval(/** @type {any} */ (b), probeTemplate(level));
    assert.ok(Math.abs(e.margin - (1 + PLAYER_EDGE.mid)) < 0.04, `L${level} margin ${e.margin} (whole numbers round it)`);
    assert.equal(dangerWord(e.margin), 'appropriate');
  }
  assert.deepEqual(DANGER_WORDS.map(([, w]) => w), ['trivial', 'easy', 'appropriate', 'challenging', 'dangerous', 'overwhelming']);
  assert.equal(dangerWord(0.1), 'overwhelming');
});

test('FIXED-PVE the Combat Score is advice: no module that makes a foe reads the profile, the builds or the simulator', () => {
  for (const f of ['pveCategories', 'pveTemplates', 'pveSpecies', 'pveRoles', 'pveAbilities', 'pveDisposition', 'pveSwitch']) {
    const src = readFileSync(new URL(`../../../src/systems/pve/${f}.js`, import.meta.url), 'utf8');
    assert.doesNotMatch(src, /from '\.\/(pveProfile|pveBuilds|pveSim)\.js'/, f);
  }
});

test('FIXED-PVE the simulator is seeded: one seed, one fight; another seed, another', () => {
  const o = { party: [buildAt('melee', 20), buildAt('mage', 20)], foes: groupFoes('crypt-patrol') };
  assert.deepEqual(simulate({ ...o, seed: 3 }), simulate({ ...o, seed: 3 }));
  const many = Array.from({ length: 8 }, (_, i) => simulate({ ...o, seed: i + 1 }).seconds);
  assert.ok(new Set(many).size > 1);
});

test('FIXED-PVE the simulator holds the tactics tokens: two melee foes strike a player at once, the rest wait their patience', () => {
  const log = [];
  simulate({ party: [buildAt('defender', 45)], foes: Array.from({ length: 6 }, () => probeTemplate(20)), log, maxS: TACT.PATIENCE - 0.5 });
  const strikers = new Set(log.filter((e) => e.by === 'foe').map((e) => e.from));
  assert.ok(strikers.size > 0 && strikers.size <= TACT.MELEE_TOKENS, `${strikers.size} struck`);
});

test('FIXED-PVE a curbing foe takes at least one blow per curb share of its health, whatever hits it', () => {
  const log = [];
  const r = simulate({ party: [buildAt('monk', 45)], foes: [probeTemplate(10, 'normal', ['fighter'], ['curbing'])], log });
  assert.ok(r.win);
  assert.ok(log.filter((e) => e.by === 'player').length >= Math.ceil(1 / CURB_SHARE));
});

test('FIXED-PVE every group template stands in the simulator, and a plain Normal fight is won more often than lost', () => {
  for (const g of GROUP_TEMPLATES) {
    const r = simMany({ party: [buildAt('melee', 30), buildAt('defender', 30), buildAt('mage', 30), buildAt('monk', 30), buildAt('archer', 30)], foes: groupFoes(g.key) }, 4);
    assert.ok(r.meanS > 0 && r.winRate >= 0 && r.winRate <= 1, g.key);
  }
  assert.ok(fights(20, 1, [probeTemplate(20)], 8).winRate > 0.5);
});
