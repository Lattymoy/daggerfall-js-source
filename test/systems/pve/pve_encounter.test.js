// FIXED-PVE STAGE 6 (bible/05-Combat/Fixed-PvE.md section 8): threat steers a foe, contribution pays a kill, the
// director builds a place's encounters from the place alone, and only a creature's own group and wronged kin join.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { THREAT, TURN_MARGIN, TAUNT, THREAT_FADE, threatTable, addThreat, fadeThreat, threatTarget } from '../../../src/systems/pve/pveThreat.js';
import { CONTRIB, QUALIFY_SHARE, contributionLedger, addContribution, qualifiers, killRewards } from '../../../src/systems/pve/pveContribution.js';
import { ENCOUNTER_KINDS, TELL_MIN, readabilityProblems, tellProblem, placeRng, directEncounters, ASSIST, assistants } from '../../../src/systems/pve/pveEncounter.js';
import { MOB_TEMPLATES, TEMPLATE_BY_KEY } from '../../../src/systems/pve/pveTemplates.js';
import { ORSINIUM_REGION } from '../../../src/systems/pve/pveBestiary.js';
import { RENOWN_ASSIST_MS } from '../../../src/net/renownTracker.js';
import { CLIMATES } from '../../../src/formats/mapsTables.js';
import { DUNGEON_TYPES } from '../../../src/formats/mapsFile.js';

const near = (id, dist = 2) => ({ id, dist, reachable: true });

test('STAGE 6 threat: damage whole, healing half and split over the foes, a hold a fixed sum', () => {
  const t = threatTable();
  addThreat(t, 'a', 'damage', 100);
  addThreat(t, 'b', 'healing', 100, { foes: 2 });
  addThreat(t, 'c', 'control');
  assert.deepEqual(['a', 'b', 'c'].map((k) => t.by.get(k)?.v), [100 * THREAT.damage, 100 * THREAT.healing / 2, THREAT.control]);
});

test('STAGE 6 threat: the foe turns only past the margin - wider at range - never to one it cannot reach, and a taunt holds it', () => {
  const t = threatTable();
  addThreat(t, 'tank', 'damage', 100);
  assert.equal(threatTarget(t, [near('tank')]), 'tank');
  addThreat(t, 'dps', 'damage', 105);
  assert.equal(threatTarget(t, [near('tank'), near('dps')]), 'tank', 'within 10%');
  addThreat(t, 'dps', 'damage', 10);
  assert.equal(threatTarget(t, [near('tank'), near('dps')]), 'dps', 'past 10% in reach');
  const r = threatTable();
  addThreat(r, 'tank', 'damage', 100); threatTarget(r, [near('tank')]);
  addThreat(r, 'archer', 'damage', 120);
  assert.equal(threatTarget(r, [near('tank'), near('archer', TURN_MARGIN.nearMetres + 10)]), 'tank', 'from range it takes 30%');
  assert.equal(threatTarget(r, [near('tank'), { id: 'archer', dist: 30, reachable: false }]), 'tank');
  addThreat(r, 'archer', 'damage', 1000);
  assert.equal(threatTarget(r, [{ ...near('tank'), reachable: false }, { id: 'archer', dist: 30, reachable: false }]), null, 'nobody it can reach');
  addThreat(r, 'tank', 'taunt', 0, { now: 5 });
  assert.ok(r.by.get('tank').v >= r.by.get('archer').v * TAUNT.lead);
  addThreat(r, 'archer', 'damage', 5000, { now: 6 });
  assert.equal(threatTarget(r, [near('tank'), near('archer')], 6), 'tank', 'the taunt holds');
  assert.equal(threatTarget(r, [near('tank'), near('archer')], 5 + TAUNT.holdS), 'archer', 'and lets go');
});

test('STAGE 6 threat: a player who stops acting fades out after the grace', () => {
  const t = threatTable();
  addThreat(t, 'a', 'damage', 10, { now: 0 });
  fadeThreat(t, THREAT_FADE.graceS, 1);
  assert.equal(t.by.get('a').v, 10);
  for (let s = THREAT_FADE.graceS + 1; s < 60; s++) fadeThreat(t, s, 1);
  assert.ok(!t.by.has('a'));
});

test('STAGE 6 contribution: damage counts only up to the foe\'s health, healing only on a player in the fight', () => {
  const c = contributionLedger(100);
  addContribution(c, 'a', 'damage', 80);
  addContribution(c, 'b', 'damage', 80);
  assert.equal(c.by.get('a').points, 80);
  assert.equal(c.by.get('b').points, 20, 'past the foe\'s health counts nothing');
  addContribution(c, 'h', 'healing', 50, { engaged: false });
  assert.ok(!c.by.has('h'));
  addContribution(c, 'h', 'healing', 50);
  addContribution(c, 'i', 'interrupt');
  assert.deepEqual([c.by.get('h').points, c.by.get('i').points], [50 * CONTRIB.healing, 100 * CONTRIB.interrupt]);
});

test('STAGE 6 contribution: a qualifier acted within Renown\'s window and earned a twentieth; a kill goes to the side that earned most, a world boss to each', () => {
  const c = contributionLedger(1000);
  addContribution(c, 'p1', 'damage', 400, { now: 0 });
  addContribution(c, 'p2', 'damage', 300, { now: 0 });
  addContribution(c, 'solo', 'damage', 280, { now: 0 });
  addContribution(c, 'leech', 'damage', 20, { now: 0 });
  assert.ok(20 / 1000 < QUALIFY_SHARE);
  assert.deepEqual(qualifiers(c, 1000), ['p1', 'p2', 'solo']);
  assert.deepEqual(qualifiers(c, RENOWN_ASSIST_MS + 1), [], 'nobody acted inside the window');
  const partyOf = (id) => (id.startsWith('p') ? 'party' : null);
  assert.deepEqual(killRewards(c, 1000, { partyOf }), { paid: ['p1', 'p2'], personal: false });
  assert.deepEqual(killRewards(c, 1000, { kind: 'worldBoss', partyOf }), { paid: ['p1', 'p2', 'solo'], personal: true });
});

test('STAGE 6 director: a place\'s encounters from the place and a seed alone - in band, the same twice, the peaceful ambient', () => {
  assert.equal(directEncounters.length, 2);
  const zone = { band: /** @type {[number, number]} */ ([20, 35]), key: 'orsinium-1', count: 5 };
  const place = { province: 'HighRock', region: ORSINIUM_REGION, climate: CLIMATES.Mountain, factions: ['orc-clans'] };
  const a = directEncounters(zone, place), b = directEncounters(zone, place);
  assert.deepEqual(a, b);
  assert.ok(a.picks.length === 5 && a.picks.every((k) => a.hostile.includes(k)));
  for (const k of a.hostile) { const t = TEMPLATE_BY_KEY.get(k); assert.ok(t.level >= 20 && t.level <= 35 && t.disposition === 'hostile', k); }
  for (const k of ['orc-merchant', 'orc-stronghold-guard', 'orc-hunter']) assert.ok(a.ambient.includes(k) && !a.hostile.includes(k), k);
  assert.ok(directEncounters(zone, { ...place, event: 'hostile' }).hostile.includes('orc-merchant'), 'an event may turn them');
  assert.ok(!directEncounters({ ...zone, band: [1, 10] }, place).hostile.some((k) => k.startsWith('orc')));
});

test('STAGE 6 director: groups only where every member lives, never a community; bosses by kind', () => {
  const crypt = { province: 'Imperial', dungeon: DUNGEON_TYPES.Crypt };
  assert.deepEqual(directEncounters({ band: [1, 45], kind: 'smallGroup', key: 'c' }, crypt).hostile, ['crypt-patrol']);
  assert.deepEqual(directEncounters({ band: [1, 45], kind: 'dungeonBoss', key: 'c' }, crypt).hostile, ['crypt-lich']);
  const orcs = directEncounters({ band: [1, 45], kind: 'smallGroup', key: 'o' }, { province: 'HighRock', region: ORSINIUM_REGION, climate: CLIMATES.Mountain, factions: ['orc-clans'] });
  assert.ok(orcs.hostile.includes('orc-warband') && !orcs.hostile.includes('orc-stronghold'));
  assert.equal(ENCOUNTER_KINDS.raid.party, 10);
  assert.equal(directEncounters({ band: [1, 45], kind: 'worldBoss', key: 'x' }, crypt).personal, true);
});

test('STAGE 6 readability: every harmful ability gives a tell to answer, an area strike a longer one', () => {
  for (const t of MOB_TEMPLATES) assert.deepEqual(readabilityProblems(t), [], t.key);
  assert.deepEqual(readabilityProblems({ abilities: ['rally'] }), [], 'a buff needs no tell');
  assert.ok(TELL_MIN.area > TELL_MIN.blow);
  assert.equal(tellProblem('slam', { kind: 'active', uses: 'blow:arc', area: 4, tell: 0.5 }), `slam gives 0.5 s of tell, under ${TELL_MIN.area}`);
  assert.equal(tellProblem('jab', { kind: 'active', uses: 'blow:arc', tell: 0.1 }), `jab gives 0.1 s of tell, under ${TELL_MIN.blow}`);
  assert.equal(tellProblem('jab', { kind: 'active', uses: 'blow:arc', tell: TELL_MIN.blow }), null);
  const seeded = placeRng('k'), again = placeRng('k');
  assert.deepEqual([seeded(), seeded()], [again(), again()]);
});

test('STAGE 6 social aggro: the group joins, hostile kin join, guards come when the faction is wronged - a species alone brings nobody, a joiner calls no one', () => {
  const t = (k) => TEMPLATE_BY_KEY.get(k);
  const others = [
    { id: 'mate', template: t('orc-grunt'), group: 'wb1', dist: 30, state: 'hostile' },
    { id: 'guard', template: t('orc-stronghold-guard'), group: null, dist: 10, state: 'neutral' },
    { id: 'hunter', template: t('orc-hunter'), group: null, dist: 5, state: 'neutral' },
    { id: 'far-grunt', template: t('orc-grunt'), group: null, dist: ASSIST.radius + 1, state: 'hostile' },
    { id: 'near-grunt', template: t('orc-grunt'), group: null, dist: 8, state: 'hostile' },
    { id: 'rat', template: t('wild-rat'), group: null, dist: 1, state: 'neutral' },
  ];
  assert.deepEqual(assistants({ template: t('orc-grunt'), group: 'wb1', state: 'hostile' }, others), ['near-grunt', 'mate']);
  assert.deepEqual(assistants({ template: t('orc-merchant'), group: null, state: 'friendly' }, others), ['near-grunt', 'guard'], 'a wronged merchant brings the guard, not the neutral hunter');
  assert.deepEqual(assistants({ template: t('orc-merchant'), group: null, state: 'friendly' }, others, { provoked: true }), ['near-grunt'], 'self-defence wrongs nobody');
  assert.deepEqual(assistants({ template: t('wild-rat'), group: null, state: 'neutral' }, [{ id: 'r2', template: t('wild-rat'), group: null, dist: 1, state: 'neutral' }]), []);
  assert.deepEqual(assistants({ template: t('sabretooth'), group: null, state: 'hostile' }, [{ id: 's2', template: t('sabretooth'), group: null, dist: 3, state: 'hostile' }]), [], 'a lone hunter\'s kind does not come');
  assert.deepEqual(assistants({ template: t('orc-grunt'), group: 'wb1', state: 'hostile' }, others, { depth: 1 }), []);
  const crowd = Array.from({ length: 10 }, (_, i) => ({ id: `g${i}`, template: t('orc-grunt'), group: 'big', dist: i, state: 'hostile' }));
  assert.equal(assistants({ template: t('orc-grunt'), group: 'big', state: 'hostile' }, crowd).length, ASSIST.max);
});
