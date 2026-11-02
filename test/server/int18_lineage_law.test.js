// INT18 (2026-10-17, the INTEGRITY arc's lane 4 - bible/06-Systems/Integrity-Arc.md section 7): THE LEGACY RECORD HELD TO
// ITS OWN LAW. A line's copy at the realm (server-account/src/legacy.js putLineage) is asked the family law's bounds
// (src/systems/legacy/legacyLaw.js - a member's blood and hearth, the waiting estate) and, beside the stored copy it was
// made from, the facts store.js mergeFacts only ever adds (a member, a death, a retirement, a fallen's remains). A copy
// that breaks it is refused whole and the stored one stands; a STALE copy is answered stale as ever, so a device still
// takes another's new member in. Honest copies are the family law's own producers' (foundFamily, addChild, recordDeath).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService } from '../accountDb.mjs';
import {
  lineageLawFindings, BLOOD_MAX, HEARTH_MAX, ESTATE_MAX, ESTATE_SHARE, REMAINS_GOLD_MAX, REMAINS_GOLD_SHARE, BLOOD_KEYS_MAX,
} from '../../src/systems/legacy/legacyLaw.js';
import * as family from '../../src/systems/legacy/family.js';
import * as heirloom from '../../src/systems/legacy/heirloom.js';
import { foundFamily, addChild, recordDeath, familyRng, estateOf, MODELS } from '../../src/systems/legacy/family.js';
import { LINE_REFUSALS } from '../../src/systems/legacy/realmLine.js';
import { REFUSALS } from '../../src/net/accountClient.js';
import { STAT_KEYS_ORDER } from '../../src/systems/statMods.js';

const entity = (over = {}) => ({
  name: 'Ysolde Hlaalu', gender: 'female', race: 'DarkElf', raceId: 4, faceIndex: 3, careerIndex: 5,
  career: { name: 'Nightblade', primarySkills: [28, 22, 16], majorSkills: [19, 24, 13], minorSkills: [1, 2, 3, 4, 5, 6] },
  level: 7, characterId: 'c-ysolde', chargenDone: true, levelingSystem: 'virtue',
  stats: { strength: 100, intelligence: 100, willpower: 100, agility: 100, endurance: 100, personality: 100, speed: 100, luck: 100 },
  skills: Array.from({ length: 35 }, () => 100),
  ...over,
});
/** A line as the family law makes one: founded by a hero of every stat and skill at 100 (the gifts at their most), three
 *  children, the founder dead with a purse that pays the estate's whole ceiling. */
function honestLine(id = 'fam-k1x2y3-abc123') {
  const f = foundFamily(entity(), { model: MODELS.bloodline, rng: familyRng(5), id, at: 1 });
  for (let i = 0; i < 3; i++) addChild(f, 1, { rng: familyRng(20 + i), at: 2 + i });
  recordDeath(f, 1, { at: 9, cause: 'test' });
  f.pending = { fallenId: 1, at: 9, estate: estateOf(10_000_000), bequest: [] };
  f.remains = [{ id: 'r1', of: 1, name: 'Ysolde Hlaalu', place: null, items: [], first: [], state: 'lying', by: null, killer: null, at: 9 }];
  return JSON.parse(JSON.stringify(f));
}

test('INT18: one home for each bound - family.js and heirloom.js say the leaf\'s own; the blood names at most the eight stats', () => {
  assert.deepEqual([family.BLOOD_MAX, family.HEARTH_MAX, family.ESTATE_MAX, family.ESTATE_SHARE], [BLOOD_MAX, HEARTH_MAX, ESTATE_MAX, ESTATE_SHARE]);
  assert.deepEqual([heirloom.REMAINS_GOLD_MAX, heirloom.REMAINS_GOLD_SHARE], [REMAINS_GOLD_MAX, REMAINS_GOLD_SHARE]);
  assert.deepEqual([BLOOD_MAX, HEARTH_MAX, ESTATE_MAX, REMAINS_GOLD_MAX], [3, 3, 9_900, 2_500]);
  assert.equal(BLOOD_KEYS_MAX, STAT_KEYS_ORDER.length);
  assert.equal(heirloom.remainsGoldOf(1e9), REMAINS_GOLD_MAX);
});

test('INT18: an honest line breaks nothing - the gifts at their most (a founder of 100s), the estate at its ceiling, a death and its remains', () => {
  const f = honestLine();
  const kids = f.people.filter((p) => p.id !== 1);
  assert.equal(kids.length, 3);
  for (const k of kids) {
    assert.ok(Object.values(k.blood).some((v) => v === BLOOD_MAX), 'a gift at its most');
    assert.ok(Object.values(k.hearth).some((v) => v === HEARTH_MAX));
  }
  assert.equal(f.pending.estate, ESTATE_MAX);
  assert.deepEqual(lineageLawFindings(f), []);
  assert.deepEqual(lineageLawFindings(f, f), [], 'beside itself');
  const grown = JSON.parse(JSON.stringify(f));
  addChild(grown, 2, { rng: familyRng(40), at: 20 });
  recordDeath(grown, 3, { at: 21 });
  assert.deepEqual(lineageLawFindings(grown, f), [], 'a copy that only adds');
});

test('INT18: what a forged copy breaks - a gift past its most or not whole, a hearth on no skill, a waiting estate past its ceiling; beside the stored copy, a member, a death, a retirement or remains gone', () => {
  const f = honestLine();
  const forged = (edit) => { const c = JSON.parse(JSON.stringify(f)); edit(c); return c; };
  assert.deepEqual(lineageLawFindings(forged((c) => { c.people[1].blood.strength = BLOOD_MAX + 1; })), ['blood']);
  assert.deepEqual(lineageLawFindings(forged((c) => { c.people[1].blood.strength = 1.5; })), ['blood']);
  assert.deepEqual(lineageLawFindings(forged((c) => { c.people[1].blood = { ...Object.fromEntries(STAT_KEYS_ORDER.map((k) => [k, 1])), extra: 1 }; })), ['blood']);
  assert.deepEqual(lineageLawFindings(forged((c) => { c.people[1].blood = [3, 3]; })), ['blood']);
  assert.deepEqual(lineageLawFindings(forged((c) => { c.people[1].hearth = { 28: HEARTH_MAX + 1 }; })), ['hearth']);
  assert.deepEqual(lineageLawFindings(forged((c) => { c.people[1].hearth = { 35: 1 }; })), ['hearth'], 'no skill thirty-five');
  assert.deepEqual(lineageLawFindings(forged((c) => { c.people[1].hearth = { '07': 1 }; })), ['hearth']);
  assert.deepEqual(lineageLawFindings(forged((c) => { c.pending.estate = ESTATE_MAX + 1; })), ['estate']);
  assert.deepEqual(lineageLawFindings(forged((c) => { c.pending.estate = -1; })), ['estate']);
  assert.deepEqual(lineageLawFindings(forged((c) => { c.people.pop(); }), f), ['member']);
  assert.deepEqual(lineageLawFindings(forged((c) => { c.people[0].died = null; }), f), ['death']);
  const retired = forged((c) => { c.people[1].retired = 12; });
  assert.deepEqual(lineageLawFindings(forged((c) => { c.people[1].retired = null; }), retired), ['retired']);
  assert.deepEqual(lineageLawFindings(forged((c) => { c.remains = []; }), f), ['remains']);
  assert.deepEqual(lineageLawFindings(forged((c) => { c.people.pop(); c.remains = []; }), null), [], 'a founding has no stored copy to lose anything from');
  assert.deepEqual(lineageLawFindings(forged((c) => { c.people[0].died = null; c.people[1].blood.luck = 9; }), f), ['blood', 'death'], 'every finding named');
});

test('INT18 service: a forged copy refused whole (\'lineage-law\', its finding) and the stored one stands; one that unwrites a death refused; a STALE copy lacking another device\'s new member answered stale to merge, then lands', async () => {
  const S = await standService();
  const g = await S.guest();
  const call = (body) => S.call('/v1/realm/lineage', body, g.secret);
  const f = honestLine();
  f.rev = 1;
  const forgedFounding = JSON.parse(JSON.stringify(f));
  forgedFounding.people[1].blood.strength = 50;
  const r0 = await call({ id: f.id, record: forgedFounding });
  assert.deepEqual([r0.status, r0.body.error, r0.body.why], [400, 'lineage-law', 'blood'], 'a founding asked the copy alone');
  assert.deepEqual((await S.call('/v1/realm/lineages', {}, g.secret)).body.lineages, [], 'nothing written');
  assert.deepEqual((await call({ id: f.id, record: f })).body, { ok: true, rev: 1 });
  // device B adds a member and writes from the stored copy
  const b = JSON.parse(JSON.stringify(f));
  addChild(b, 2, { rng: familyRng(70), at: 30 });
  b.rev = 2;
  assert.deepEqual((await call({ id: f.id, record: b, base: 1 })).body, { ok: true, rev: 2 });
  // device A, made from rev 1, lacks B's member: STALE - the stored copy to merge into, never the law's refusal
  const a = JSON.parse(JSON.stringify(f));
  a.rev = 2;
  const stale = await call({ id: f.id, record: a, base: 1 });
  assert.deepEqual([stale.status, stale.body.error], [409, 'lineage-stale']);
  // made from the stored copy, dropping B's member: the law's
  const dropped = { ...JSON.parse(JSON.stringify(a)), rev: 3 };
  const r1 = await call({ id: f.id, record: dropped, base: 2 });
  assert.deepEqual([r1.status, r1.body.error, r1.body.why], [400, 'lineage-law', 'member']);
  const undead = { ...JSON.parse(JSON.stringify(b)), rev: 3 };
  undead.people[0].died = null;
  const r2 = await call({ id: f.id, record: undead, base: 2 });
  assert.deepEqual([r2.body.error, r2.body.findings], ['lineage-law', ['death']]);
  const listed = (await S.call('/v1/realm/lineages', {}, g.secret)).body.lineages;
  assert.deepEqual([listed[0].rev, listed[0].record.people.length, !!listed[0].record.people[0].died], [2, 5, true], 'the stored copy stands');
  // the merged copy - B's member taken in - lands
  const merged = { ...JSON.parse(JSON.stringify(b)), rev: 3 };
  assert.deepEqual((await call({ id: f.id, record: merged, base: 2 })).body, { ok: true, rev: 3 });
});

test('INT18 client: a refused copy is the record\'s own refusal - said once, never sent again this session; the words are there', () => {
  assert.ok(LINE_REFUSALS.includes('lineage-law'));
  assert.equal(typeof REFUSALS['lineage-law'], 'string');
});
