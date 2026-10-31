// FIXED-PVE: the data layer's law (bible/05-Combat/Fixed-PvE.md) - templates stand by their own data, never a player's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SPECIES, SPECIES_BY_KEY, CANDIDATE_SPECIES } from '../../../src/systems/pve/pveSpecies.js';
import { PVE_CATEGORIES, REFERENCE_PLAYER, NORMAL_BLOWS, PLAYER_EDGE, referencePlayer, categoryStats, FOE_BLOW_S } from '../../../src/systems/pve/pveCategories.js';
import { COMBAT_ROLE_KEYS, roleProblem, roleShares } from '../../../src/systems/pve/pveRoles.js';
import { ABILITY_KEYS, abilityProblem } from '../../../src/systems/pve/pveAbilities.js';
import { MOB_TEMPLATES, GROUP_TEMPLATES, TEMPLATE_BY_KEY, templateProblems, groupProblems, templateStats, groupWeight } from '../../../src/systems/pve/pveTemplates.js';
import { fixedPveOn } from '../../../src/systems/pve/pveSwitch.js';

test('FIXED-PVE the switch is off: nothing in the game reads a template yet', () => {
  assert.equal(fixedPveOn(), false);
});

test('FIXED-PVE species: every vanilla body once, by what it can draw; candidates have no body', () => {
  assert.equal(SPECIES.length, 60);
  assert.equal(new Set(SPECIES.map((s) => s.key)).size, SPECIES.length);
  assert.equal(SPECIES_BY_KEY.get('orc').body, 7);
  assert.equal(SPECIES_BY_KEY.get('orc').shoots, false, 'an Orc has no bow frames');
  assert.equal(SPECIES_BY_KEY.get('archer').shoots, true);
  assert.equal(SPECIES_BY_KEY.get('orc-shaman').casts, true);
  assert.equal(SPECIES_BY_KEY.get('lich').group, 'undead');
  assert.equal(SPECIES_BY_KEY.get('knight').group, 'humanoid', 'a class body is Humanoid');
  assert.ok(CANDIDATE_SPECIES.every((s) => s.body === null && !SPECIES_BY_KEY.has(s.key)));
});

test('FIXED-PVE every shipped template and group stands', () => {
  for (const t of MOB_TEMPLATES) assert.deepEqual(templateProblems(t), [], t.key);
  for (const g of GROUP_TEMPLATES) assert.deepEqual(groupProblems(g), [], g.key);
  for (const k of ABILITY_KEYS) assert.equal(abilityProblem(k), null, k);
  assert.equal(TEMPLATE_BY_KEY.size, MOB_TEMPLATES.length, 'a key twice');
});

test('FIXED-PVE one body, many foes: the orc sprite carries four templates that fight apart', () => {
  const orcs = MOB_TEMPLATES.filter((t) => t.species === 'orc');
  assert.ok(orcs.length >= 4);
  assert.ok(new Set(orcs.map((t) => t.roles.join('+'))).size >= 3);
  assert.ok(new Set(orcs.map((t) => t.disposition)).size >= 3, 'hostile, neutral and friendly orcs');
});

test('FIXED-PVE a template reads its own data only: same template, same numbers, whoever asks', () => {
  const t = TEMPLATE_BY_KEY.get('orc-grunt');
  assert.deepEqual(templateStats(t), templateStats({ ...t }));
  assert.deepEqual(templateStats(t), templateStats(TEMPLATE_BY_KEY.get('orc-grunt')));
  assert.equal(templateStats.length, 1, 'no player argument');
});

test('FIXED-PVE a Normal foe falls in NORMAL_BLOWS and needs the edge more to fell the reference player', () => {
  for (const [L] of REFERENCE_PLAYER) {
    const ref = referencePlayer(L), s = categoryStats(L, 'normal');
    assert.ok(Math.abs(s.health / ref.blow - NORMAL_BLOWS) < 0.2, `L${L} health ${s.health}`);
    const mean = (s.damage[0] + s.damage[1]) / 2;
    const edge = (ref.health / mean) * FOE_BLOW_S / (NORMAL_BLOWS * ref.swingS) - 1;   // its time to fell them over theirs
    assert.ok(edge >= PLAYER_EDGE.min - 0.02 && edge <= PLAYER_EDGE.max + 0.02, `L${L} edge ${edge}`);
  }
  assert.ok(referencePlayer(45).blow > referencePlayer(30).blow * 2.5, 'gear compounds past the base kit');
});

test('FIXED-PVE categories climb in health and in the party they are made for', () => {
  const order = ['normal', 'strong', 'elite', 'champion', 'boss', 'raidBoss'];
  for (let i = 1; i < order.length; i++) {
    assert.ok(PVE_CATEGORIES[order[i]].health > PVE_CATEGORIES[order[i - 1]].health);
    assert.ok(PVE_CATEGORIES[order[i]].party >= PVE_CATEGORIES[order[i - 1]].party);
  }
  assert.ok(PVE_CATEGORIES.strong.margin < 1, 'a Strong foe is a hard fight alone');
});

test('FIXED-PVE roles: at most two, never a clash, never two complex; combined shares are means', () => {
  assert.equal(roleProblem(['mage', 'commander']), null, "the spec's own pair");
  assert.match(roleProblem(['tank', 'assassin']), /clash/);
  assert.match(roleProblem(['healer', 'summoner']), /complex/);
  assert.match(roleProblem(['fighter', 'tank', 'mage']), /more than/);
  assert.match(roleProblem(['wizard']), /unknown/);
  assert.equal(COMBAT_ROLE_KEYS.length, 9);
  const s = roleShares(['tank', 'mage']);
  assert.ok(Math.abs(s.health - (1.25 + 0.75) / 2) < 1e-9 && Math.abs(s.damage - (0.7 + 1.25) / 2) < 1e-9);
});

test('FIXED-PVE the validator refuses what the body cannot draw and what the data does not know', () => {
  const t = { ...TEMPLATE_BY_KEY.get('orc-hunter'), roles: ['archer'] };
  assert.ok(templateProblems(t).some((p) => /needs a body that shoots/.test(p)));
  assert.ok(templateProblems({ ...t, roles: ['fighter'], level: 60 }).some((p) => /outside/.test(p)));
  assert.ok(templateProblems({ ...t, roles: ['fighter'], abilities: ['nuke'] }).some((p) => /unknown ability/.test(p)));
  assert.ok(templateProblems({ ...t, roles: ['fighter'], disposition: 'hostile', interact: ['trade'] }).some((p) => /no service/.test(p)));
  assert.ok(groupProblems({ key: 'g', members: [['orc-grunt', 1]], leader: 'orc-warlord' }).some((p) => /leader/.test(p)));
});

test('FIXED-PVE a group weighs its members: N Normal fighters weigh N', () => {
  assert.equal(groupWeight({ key: 'g', members: [['orc-grunt', 4]] }), 4);
  const w = groupWeight(GROUP_TEMPLATES.find((g) => g.key === 'orc-warband'));
  assert.ok(w > 3.5 && w < 4.5, `the spec's warband of four weighs about four (${w})`);
});
