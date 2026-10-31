// FIXED-PVE STAGE 7 (bible/05-Combat/Fixed-PvE.md section 9): a spawn grant stands its seed's template from the
// table at its pixel - the same body and level on the owner's machine and every reader's - and only while the world
// hands the grant host a table (the switch on).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { factionsHolding, pveTableAt, grantTemplateKey, templateFoe, templateDiceRefusal, standTemplate, ELITE_RANK, templateMayBeElite, rankTemplateElite, revenantTemplate, templateBand } from '../../../src/systems/pve/pveGrant.js';
import { ORSINIUM_REGION } from '../../../src/systems/pve/pveBestiary.js';
import { TEMPLATE_BY_KEY, templateStats } from '../../../src/systems/pve/pveTemplates.js';
import { grantDiceRefusal, createGrantHost } from '../../../src/scenes/grantHost.js';
import { fixedPveOn } from '../../../src/systems/pve/pveSwitch.js';
import { calculateAttackDamage, registerFormulaOverride } from '../../../src/combat/formulas.js';
import { CLIMATES, BAY_REGION_COUNT } from '../../../src/formats/mapsTables.js';
import { DUNGEON_TYPES } from '../../../src/formats/mapsFile.js';
import { CITIES } from '../../../src/world/tamriel/tamrielGeography.js';
import { pictureToBay } from '../../../src/world/tamriel/tamrielFrame.js';

const mountain = { regionAt: () => ORSINIUM_REGION, climateAt: () => CLIMATES.Mountain, minute: 12 * 60 };
const orcs = pveTableAt(934, 221, mountain);
const grant = (k, s) => ({ k, s, p: [934, 221], m: mountain.minute });

test('STAGE 7: who holds a place - outlaws the open land, the clans their Wrothgar and strongholds, nobody a town', () => {
  assert.deepEqual(factionsHolding(5, 'wild'), ['bandits']);
  assert.deepEqual(factionsHolding(5, 'town'), []);
  assert.deepEqual(factionsHolding(ORSINIUM_REGION, 'road'), ['bandits', 'orc-clans']);
  assert.deepEqual(factionsHolding(62, 'dungeon', DUNGEON_TYPES.OrcStronghold), ['bandits', 'orc-clans']);
});

test('STAGE 7: the table at a grant\'s pixel - the Bay\'s region from the map, a province\'s from its theatre', () => {
  assert.equal(orcs.zone.name, 'Orsinium Area');
  assert.deepEqual(orcs.lists.encounter.map((x) => x.key), ['marauder', 'marauder-bowman', 'marauder-knife', 'orc-defender', 'orc-grunt'], 'the clans and the outlaws both hold Wrothgar');
  const [sx, sy] = pictureToBay(...CITIES.find((c) => c.name === 'Solitude').at).map(Math.floor);
  const skyrim = pveTableAt(sx, sy, { ...mountain, regionAt: () => { throw new Error('past the Bay reads no map region'); } });
  assert.equal(skyrim.zone.region, BAY_REGION_COUNT + 2);
  assert.equal(skyrim.zone.pastBay, true);
  const night = pveTableAt(934, 221, { ...mountain, minute: 0 });
  assert.ok(night, 'the minute reaches the hour');
});

test('STAGE 7: a grant\'s members are its seed\'s templates - the same on every machine, a camp its group member by member', () => {
  const keys = [0, 1, 2, 3].map((i) => grantTemplateKey(grant('encr', 77), i, orcs));
  assert.deepEqual([0, 1, 2, 3].map((i) => grantTemplateKey(grant('encr', 77), i, orcs)), keys);
  for (const k of keys) assert.ok(['marauder', 'marauder-bowman', 'marauder-knife', 'orc-defender', 'orc-grunt'].includes(k));
  const seen = new Set();
  for (let s = 0; s < 40; s++) seen.add(grantTemplateKey(grant('encr', s), 0, orcs));
  assert.equal(seen.size, 5, 'the die reaches every plain foe');
  let differ = 0;
  for (let s = 0; s < 40; s++) if (grantTemplateKey(grant('encr', s), 0, orcs) !== grantTemplateKey(grant('encr', s), 1, orcs)) differ++;
  assert.ok(differ > 0, 'each member rolls its own die');
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((i) => grantTemplateKey(grant('camp', 2), i, orcs)), ['marauder', 'marauder', 'marauder-bowman', 'marauder-knife', 'marauder-warlord', null], 'another seed, the outlaws\' band');
  const camp = [0, 1, 2, 3, 4].map((i) => grantTemplateKey(grant('camp', 5), i, orcs));
  assert.deepEqual(camp, ['orc-grunt', 'orc-grunt', 'orc-defender', 'orc-shaman', null], 'the warband, then none');
  assert.equal(grantTemplateKey(grant('band', 5), 0, orcs), null, 'a band stands no template yet');
  assert.equal(grantTemplateKey(grant('encr', 5), 0, null), null);
});

test('STAGE 7: a template stands at its own numbers, never the owner\'s level', () => {
  const f = templateFoe('orc-grunt');
  assert.deepEqual({ ...f }, { key: 'orc-grunt', name: 'Orc Grunt', mobile: 7, ...templateStats(TEMPLATE_BY_KEY.get('orc-grunt')) });
  assert.equal(templateFoe(null), null);
  assert.equal(templateFoe('nobody'), null);
});

test('STAGE 7: a reader refuses a body or level that is not the seed\'s template', () => {
  const gr = grant('encr', 77), want = templateFoe(grantTemplateKey(gr, 0, orcs));
  const rec = (o) => ({ t: want.mobile, l: want.level, gr: [1, 0], ...o });
  assert.equal(templateDiceRefusal(gr, rec({}), orcs), null);
  assert.equal(templateDiceRefusal(gr, rec({ l: undefined }), orcs), null, 'a record that names no level');
  assert.equal(templateDiceRefusal(gr, rec({ t: 3 }), orcs), 'dice');
  assert.equal(templateDiceRefusal(gr, rec({ l: want.level + 1 }), orcs), 'dice', 'no slack: the level is the template\'s');
  assert.equal(templateDiceRefusal(gr, rec({}), null), 'dice', 'no table, no template');
  assert.equal(grantDiceRefusal(gr, rec({ t: 3 }), null, () => null, () => orcs), 'dice');
  assert.equal(grantDiceRefusal(gr, rec({}), null, () => null, () => orcs), null);
  assert.equal(grantDiceRefusal(grant('camp', 5), { t: 7, l: 26, gr: [1, 2] }, null, () => null, () => orcs), null, 'a camp\'s defender');
  assert.equal(grantDiceRefusal(grant('camp', 5), { t: 3, l: 26, gr: [1, 2] }, null, () => null, () => orcs), 'dice', 'and not another body');
  assert.equal(grantDiceRefusal(gr, rec({ t: 3 }), null, () => null), null, 'switched off: the old law reads it');
});

test('STAGE 7: the grant host stands templates only when handed a table - and the switch is off', () => {
  assert.equal(fixedPveOn(), false);
  const gr = grant('encr', 77);
  const off = createGrantHost({ session: () => null });
  assert.equal(off.templateOf(gr, 0), null);
  assert.equal(off.speciesOf(gr, 0, false), -1);
  const on = createGrantHost({ session: () => null, tableAt: () => orcs });
  assert.deepEqual(on.templateOf(gr, 0), templateFoe(grantTemplateKey(gr, 0, orcs)));
  assert.equal(on.speciesOf(gr, 0, false), 7);
  assert.equal(on.templateOf(null, 0), null);
  assert.equal(createGrantHost({ session: () => null, tableAt: () => null }).speciesOf(gr, 0, false), -1);
  assert.match(readFileSync(new URL('../../../src/scenes/grantHost.js', import.meta.url), 'utf8'),
    /const diceRefusal = \(gr, r\) => grantDiceRefusal\(gr, r, climateAt, faunaAt, tableAt\);/, 'the reader\'s check reads the table');
});

test('STAGE 8: a template foe stands at its own level, health and blow - and lands its blow in range, under its elite\'s scale', () => {
  const foe = templateFoe('orc-grunt');
  const e = standTemplate({ level: 3, maxHealth: 10, health: 10 }, foe);
  assert.deepEqual([e.name, e.level, e.maxHealth, e.health, e.pveBlow, e.pveTemplate], ['Orc Grunt', foe.level, foe.health, foe.health, [...foe.damage], 'orc-grunt']);
  assert.equal(standTemplate(null, foe), null);
  const plain = { level: 3 };
  assert.equal(standTemplate(plain, null), plain);
  assert.deepEqual(plain, { level: 3 }, 'no template, nothing moved');
  registerFormulaOverride('calculateAttackDamage', () => 10);   // the core pinned: the tail alone
  try {
    const me = { isPlayer: true, reflexes: 2, health: 100 };
    assert.equal(calculateAttackDamage({ isPlayer: false, pveBlow: [40, 49] }, me, { rolls: () => 0 }), 40);
    assert.equal(calculateAttackDamage({ isPlayer: false, pveBlow: [40, 49] }, me, { rolls: () => 0.9999 }), 49);
    assert.equal(calculateAttackDamage({ isPlayer: false, pveBlow: [40, 49], damageScale: 2 }, me, { rolls: () => 0 }), 80, 'an elite doubles its own blow');
    assert.equal(calculateAttackDamage({ isPlayer: false }, me, { rolls: () => 0 }), 10, 'any other foe as it was');
    registerFormulaOverride('calculateAttackDamage', () => 0);
    assert.equal(calculateAttackDamage({ isPlayer: false, pveBlow: [40, 49] }, me, { rolls: () => 0 }), 0, 'a miss stays a miss');
  } finally { registerFormulaOverride('calculateAttackDamage', null); }
});

test('STAGE 8: the open world\'s pool stands a granted template and lets no player scale it', () => {
  const src = readFileSync(new URL('../../../src/scenes/exteriorFoes.js', import.meta.url), 'utf8');
  assert.match(src, /let tpl = template \?\? revenantTemplate\(revenant\) \?\? \(puppet \? _net\?\.grants\?\.puppetTemplate\?\.\(puppet, seq\) \?\? null : null\);/, 'a puppet\'s from its owner\'s judged grant');
  assert.match(src, /mobileType = t; basics = ENEMY_BASICS\[t\]; tpl = _net\?\.grants\?\.templateOf\?\.\(a\.gr, a\.i\) \?\? null;/, 'my own from my grant');
  assert.match(src, /const builtLevel = tpl\?\.level \?\? level \?\? effectiveLevel\(playerEntity\);/);
  assert.match(src, /const entity = standTemplate\(makeEnemyEntity\([^\n]*\{ exactLevel: !!puppet \|\| !!tpl \}\), tpl\);/);
  assert.match(src, /if \(!puppet && !allied && !inLocation\(\) && !tpl\) \{/, 'no progression scaling');
  assert.match(src, /\} else if \(puppet && !allied && !inLocation\(\) && !tpl\) \{/, 'nor a puppet\'s hero threat');
  assert.match(src, /const _toughFoe = \(f\) => _sharedFoe\(f\) && !f\.entity\?\.staffBoss && !f\.entity\?\.pveTemplate;/, 'nor the party\'s toughness');
  assert.match(src, /const partyHit = \(dmg, f\) => \(_sharedFoe\(f\) && !f\?\.entity\?\.pveTemplate \?/, 'nor the party\'s weight on its blows');
  const host = readFileSync(new URL('../../../src/scenes/grantHost.js', import.meta.url), 'utf8');
  assert.match(host, /pups\.set\(`\$\{from\}\|\$\{r\.i\}`, \{ s: v\.gr\.s, i, k: v\.gr\.k, gr: v\.gr \}\);/, 'a judged grant kept whole for its puppet');
  const on = createGrantHost({ session: () => null, tableAt: () => orcs });
  assert.equal(on.puppetTemplate('someone', 1), null, 'a puppet not yet judged stands as it would');
});

test('STAGE 9: an elite template stands at a fixed rank - a leader never rolls one', () => {
  const grunt = templateFoe('orc-grunt'), warlord = templateFoe('orc-warlord');
  assert.equal(templateMayBeElite(grunt), true);
  assert.equal(templateMayBeElite(warlord), false, 'a Strong leader is one already');
  assert.equal(templateMayBeElite(null), true, 'no template: the old law');
  const e = rankTemplateElite({ eliteFoe: true, level: 1, maxHealth: grunt.health * 5, health: 1, damageScale: 3 }, grunt);
  assert.deepEqual([e.level, e.maxHealth, e.health, e.damageScale, e.healthMult], [grunt.level + ELITE_RANK.levels, Math.round(grunt.health * ELITE_RANK.health), Math.round(grunt.health * ELITE_RANK.health), ELITE_RANK.damage, ELITE_RANK.health]);
  const plain = { eliteFoe: false, level: 3 };
  assert.deepEqual(rankTemplateElite(plain, grunt), { eliteFoe: false, level: 3 }, 'not an elite: untouched');
  assert.deepEqual(rankTemplateElite({ eliteFoe: true, level: 3 }, null), { eliteFoe: true, level: 3 }, 'no template: the street elite stands');
});

test('STAGE 9: a template revenant comes back as its template, a level a rank, with its own group about it', () => {
  assert.equal(revenantTemplate({ rank: 2 }), null);
  assert.equal(revenantTemplate(null), null);
  const r = { tpl: 'orc-grunt', rank: 3 };
  assert.deepEqual({ ...revenantTemplate(r) }, { ...templateFoe('orc-grunt'), level: templateFoe('orc-grunt').level + 3 });
  assert.equal(revenantTemplate({ tpl: 'orc-grunt', rank: 0 }).level, templateFoe('orc-grunt').level + 1, 'rank floors at one');
  const band = templateBand(r, 3);
  assert.deepEqual(band.map((m) => m.template.key), ['orc-grunt', 'orc-defender', 'orc-shaman'], 'the warband, less itself');
  for (const m of band) assert.deepEqual([m.mobileType, m.level], [m.template.mobile, m.template.level], 'at the template\'s own level');
  assert.deepEqual(templateBand(r, 0), []);
  assert.deepEqual(templateBand({ tpl: 'orc-grunt', rank: 5 }, 5).map((m) => m.template.key), ['orc-grunt', 'orc-defender', 'orc-shaman', 'orc-grunt', 'orc-grunt'], 'short of a group: itself again');
  assert.equal(templateBand({ rank: 3 }, 3), null, 'not a template: the old band');
  const src = readFileSync(new URL('../../../src/scenes/exteriorFoes.js', import.meta.url), 'utf8');
  assert.match(src, /eliteFoe = grantElite\(gm\.gr, gm\.i\) && templateMayBeElite\(tpl\) &&/, 'a granted elite asks the template');
  assert.match(src, /&& templateMayBeElite\(tpl\) && \(revenant \? revenant\.elite : rollOverworldElite\(Math\.random\)\)\) promoteEliteFoe\(entity\);/, 'and a rolled one');
  assert.match(src, /rankTemplateElite\(entity, tpl\);/);
  assert.match(src, /template: m\.template \?\? null, champion: null, eliteFoe: false, transient: true/, 'a band member stands its template');
  const rev = readFileSync(new URL('../../../src/systems/revenant/revenant.js', import.meta.url), 'utf8');
  assert.match(rev, /tpl: typeof entity\.pveTemplate === 'string' && entity\.pveTemplate \? entity\.pveTemplate : null,/, 'a revenant minted from a template keeps it');
  assert.match(rev, /tpl: isStr\(r\.tpl\) && r\.tpl \? r\.tpl : null,/, 'and a load keeps it');
});

test('GROUP-SOLO: a camp stands as one player\'s pack - every build grinds it at the group\'s level; the party zone keeps it whole', async () => {
  const { GROUP_SOLO_WEIGHT, packShare, grantTemplateFoe } = await import('../../../src/systems/pve/pveGrant.js');
  const { GROUP_TEMPLATES, groupWeight } = await import('../../../src/systems/pve/pveTemplates.js');
  const { simMany, groupFoes } = await import('../../../src/systems/pve/pveSim.js');
  const { buildAt, BUILD_KIND_KEYS } = await import('../../../src/systems/pve/pveBuilds.js');
  assert.equal(GROUP_SOLO_WEIGHT, 1.5);
  for (const g of GROUP_TEMPLATES.filter((x) => !x.community)) {
    const k = packShare(g);
    assert.ok(Math.abs(groupWeight(g) * k - 1.5) < 1e-9, `${g.key} weighs one and a half Normals`);
    const foes = groupFoes(g.key).map((t) => ({ ...t, pack: { health: k, damage: k } }));
    const lv = Math.min(45, Math.max(...foes.map((t) => t.level)));
    for (const b of BUILD_KIND_KEYS) assert.ok(simMany({ party: [buildAt(b, lv)], foes, magicka: true }, 12).winRate >= 0.6, `${b} grinds ${g.key}`);
  }
  const camp = grant('camp', 5), whole = templateFoe(grantTemplateKey(camp, 0, orcs)), pack = grantTemplateFoe(camp, 0, orcs);
  assert.equal(pack.level, whole.level, 'a pack member keeps its level');
  assert.ok(pack.health < whole.health * 0.5 && pack.damage[1] < whole.damage[1] * 0.5);
  const { PARTY_FOE } = await import('../../../src/systems/pve/pveGrant.js');
  const party = { ...orcs, zone: { ...orcs.zone, party: true } }, big = grantTemplateFoe(camp, 0, party);
  assert.deepEqual(PARTY_FOE, { level: 50, health: 1.5, damage: 1.25 });
  assert.equal(big.level, 50, 'the party zone stands level 50');
  assert.ok(big.health > whole.health * 1.2 && big.damage[1] > whole.damage[1], 'whole and past a level 45');
  assert.equal(grantTemplateFoe(grant('encr', 77), 0, party).level, 50, 'an encounter there too');
  assert.deepEqual(grantTemplateFoe(grant('encr', 77), 0, orcs), templateFoe(grantTemplateKey(grant('encr', 77), 0, orcs)), 'an encounter is no pack');
});

test('GROUP-PARTY: level 50 groups in the party zone fall to four level 45 players, never to two', async () => {
  const { PARTY_FOE } = await import('../../../src/systems/pve/pveGrant.js');
  const { simMany, groupFoes } = await import('../../../src/systems/pve/pveSim.js');
  const { buildAt } = await import('../../../src/systems/pve/pveBuilds.js');
  const kinds = ['defender', 'melee', 'mage', 'archer', 'battlemage'];
  for (const key of ['dread-band', 'reaver-band']) {
    const foes = groupFoes(key).map((t) => ({ ...t, level: 45, pack: { health: PARTY_FOE.health, damage: PARTY_FOE.damage } }));
    const win = (n) => simMany({ party: kinds.slice(0, n).map((k) => buildAt(k, 45)), foes, magicka: true }, 12).winRate;
    assert.ok(win(4) >= 0.9 && win(5) >= 0.9, `${key}: four, five`);
    assert.ok(win(2) === 0 && win(1) === 0, `${key}: two, one`);
  }
});
