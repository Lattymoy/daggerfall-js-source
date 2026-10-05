// LEGACY4 (2026-10-05, bible/06-Systems/Legacy-Arc.md section 7): HEIRLOOMS, THE REMAINS AND THE DEATH QUEST - Mac:
// "Upon your current characters death, have a chance to drop a gear item deemed an heirloom. These heirlooms, along with
// your characters remains can be acquired by completing the death quest on your descendant."
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  pickHeirloom, markHeirloom, attuneHeirloom, heirloomEligible, isHeirloom, mintRemainsItem, isRemainsItem, bestSkillOf,
  blessingOf, legacyFold, heirloomWeaponDamage, heirloomLine, HEIRLOOM_GEN_MAX, HEIRLOOM_DAMAGE_PER_GEN,
  HEIRLOOM_ARMOR_PER_GEN, BLESSING_POINTS, BLESSING_SKILL_MAX, REMAINS_TEMPLATE, REMAINS_GOLD_SHARE,
} from '../src/systems/legacy/heirloom.js';
import { familyRng, MODELS } from '../src/systems/legacy/family.js';
import { createLegacyHost, LEGACY_QUEST_PREFIX } from '../src/scenes/legacyHost.js';
import { _resetModSaveData } from '../src/systems/modSaveData.js';
import { LOCATION_TYPES } from '../src/formats/mapsFile.js';
import { KEEPSAKE_TEMPLATE } from '../src/systems/livingWorld/keepsake.js';
import { setItemFields, mintCondition } from '../src/systems/itemTemplates.js';
import { computeEntityMods, entityModsOf, weaponDamageMods } from '../src/systems/entityMods.js';

/** A piece as the game mints one (itemTemplates' own fields), worn in `slot`. */
const piece = (group, templateIndex, material, slot, over = {}) => ({ ...mintCondition(setItemFields({ group, templateIndex, material, flags: 0, variant: 0, message: 0, stackCount: 1 })), equipSlot: slot, ...over });

test('LEGACY4: the heirloom is the most valuable WORN weapon or armour - never a quest piece, a sigil\'s or an Aetheric', () => {
  const dagger = piece('Weapons', 113, 0, 0);
  const sword = piece('Weapons', 120, 4, 1);   // a longsword of better metal
  const carried = piece('Weapons', 122, 9, null);   // a fine claymore in the bag, not worn
  const ring = piece('Jewellery', 133, 0, 2);
  assert.equal(pickHeirloom([dagger, sword, carried, ring]), sword);
  assert.equal(heirloomEligible(carried), false, 'only what they wore');
  assert.equal(heirloomEligible(ring), false, 'a weapon or armour');
  assert.equal(heirloomEligible({ ...sword, questItem: true }), false);
  assert.equal(heirloomEligible({ ...sword, sigil: { set: 'x' } }), false);
  assert.equal(heirloomEligible({ ...sword, rarity: 'aetheric' }), false);
  // an heirloom already worn is always the one - handed down, not found again
  const old = { ...dagger, heirloom: { line: 'f', house: 'Hlaalu', of: 1, from: 'Ysolde', gen: 2, base: 'Dagger' } };
  assert.equal(pickHeirloom([old, sword]), old);
  assert.equal(pickHeirloom([]), null);
});

test('LEGACY4: marked for the house - a copy named for it, its generation kept, growing to a ceiling', () => {
  const sword = piece('Weapons', 120, 4, 1);
  const h = markHeirloom(sword, { line: 'fam-1', house: 'Hlaalu', of: 3, from: 'Ysolde Hlaalu' });
  assert.notEqual(h, sword, 'a copy for the remains - the fallen\'s own bag is their save\'s');
  assert.equal(h.equipSlot, undefined);
  assert.equal(h.name, `Hlaalu's ${sword.name}`);
  assert.deepEqual(h.heirloom, { line: 'fam-1', house: 'Hlaalu', of: 3, from: 'Ysolde Hlaalu', gen: 0, base: sword.name });
  assert.ok(isHeirloom(h));
  for (let i = 0; i < 7; i++) attuneHeirloom(h);
  assert.equal(h.heirloom.gen, HEIRLOOM_GEN_MAX);
  assert.equal(HEIRLOOM_GEN_MAX, 5);
  const again = markHeirloom({ ...h, equipSlot: 1 }, { line: 'fam-1', house: 'Hlaalu', of: 9, from: 'Riadell Hlaalu' });
  assert.equal(again.heirloom.gen, 5, 'a second death keeps its generations');
  assert.equal(again.name, h.name, 'named once - never "Hlaalu\'s Hlaalu\'s"');
  assert.match(heirloomLine(again), /Heirloom of the house of Hlaalu, first borne by Riadell Hlaalu - carried home 5 times\./);
  assert.equal(heirloomLine(sword), null);
});

test('LEGACY4: an heirloom\'s power rides the entity\'s own folds - a weapon\'s damage, armour on its parts, a blessing on a skill', () => {
  assert.equal(HEIRLOOM_DAMAGE_PER_GEN, 5);
  assert.equal(HEIRLOOM_ARMOR_PER_GEN, 2);
  const w = { heirloom: { line: 'f', house: 'H', of: 1, from: 'A', gen: 3, base: 'Sword' } };
  assert.equal(heirloomWeaponDamage(w, 20), 23, '15% on the roll, truncated');
  assert.equal(heirloomWeaponDamage({}, 20), 20);
  assert.equal(weaponDamageMods(w, 20) >= 23, true, 'and the port\'s damage seam hears it');
  const cuirass = piece('Armor', 102, 2, 3, { heirloom: { line: 'f', house: 'H', of: 1, from: 'A', gen: 2, base: 'Cuirass' } });
  const e = { items: [cuirass], legacyBlessings: [{ of: 1, name: 'A', skill: 29, value: 3 }] };
  const m = legacyFold(e);
  assert.ok(m.armorParts.some((v) => v === 4), 'two generations: +4 on the parts it covers');
  assert.equal(m.skills[29], BLESSING_POINTS);
  assert.equal(legacyFold({ items: [] }).skills[0], undefined, 'nothing worn, nothing blessed: the empty fold');
  // a long line is honoured, never a build: the house's blessings on one skill stop at three blessings' worth
  assert.equal(BLESSING_SKILL_MAX, 3 * BLESSING_POINTS);
  const many = Array.from({ length: 6 }, (_, i) => ({ of: i, name: 'A', skill: 29, value: 3 }));
  assert.equal(legacyFold({ items: [], legacyBlessings: many }).skills[29], BLESSING_SKILL_MAX);
  assert.equal(legacyFold({ items: [], legacyBlessings: [...many.slice(0, 2), { of: 9, name: 'B', skill: 30, value: 3 }] }).skills[29], 6, 'under the cap, each counts');
  computeEntityMods(e);
  assert.equal(entityModsOf(e).skills[29] >= 3, true, 'registered with the entity\'s folds');
});

test('LEGACY4: the remains - an item of the port\'s own, marking whose, beside the keepsake', () => {
  assert.equal(REMAINS_TEMPLATE, KEEPSAKE_TEMPLATE + 10);
  const r = mintRemainsItem({ line: 'fam-1', of: 4, name: 'Ysolde Hlaalu' });
  assert.equal(r.name, 'The remains of Ysolde Hlaalu');
  assert.ok(isRemainsItem(r));
  assert.equal(isRemainsItem({ templateIndex: REMAINS_TEMPLATE }), false, 'the mark is the remains\' own');
  assert.equal(bestSkillOf({ skills: [10, 50, 50, 20] }), 1, 'the highest, the first of equals');
  assert.deepEqual(blessingOf({ id: 4, skills: [1, 2, 90] }, 'Ysolde'), { of: 4, name: 'Ysolde', skill: 2, value: 3 });
});

// ---- the host: the death quest end to end --------------------------------------------------------------------------

function quest({ model = MODELS.bloodline } = {}) {
  _resetModSaveData();
  const mem = () => { const m = new Map(); return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } }; };
  const storage = mem(), tab = mem();
  const sword = piece('Weapons', 120, 4, 1);
  const e = {
    name: 'Ysolde Hlaalu', gender: 'female', race: 'DarkElf', faceIndex: 3, careerIndex: 5, career: { name: 'Nightblade', primarySkills: [28], majorSkills: [], minorSkills: [] },
    level: 9, characterId: 'c-y', chargenDone: true, stats: { strength: 60, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 },
    skills: Array.from({ length: 35 }, (_, i) => (i === 28 ? 80 : 20)), items: [sword],
  };
  const w = { at: false, rest: false, laid: [], said: [], asked: [] };
  const host = createLegacyHost({
    entity: e, storage: () => storage, tab: () => tab, on: () => true, online: () => false, now: () => 500, own: () => 0,
    here: () => ({ pixel: { x: 40, y: 60 }, region: 'Daggerfall', regionIndex: 17, mode: 'dungeon', loc: 'Castle Daggerfall', locationType: LOCATION_TYPES.DungeonKeep, dungeon: { regionIndex: 17, locationIndex: 3 }, pos: [1, 2, 3], world: null }),
    town: () => null, nearestTown: () => ({ region: 'Daggerfall', loc: 'Daggerfall' }), gold: () => 1000, say: (l) => w.said.push(l),
    boot: () => {}, search: () => '?world', loadCharacter: () => false, saveNow: () => {}, inFight: () => false, rng: () => 0,
    killer: () => 'the Vampire Ancient', atPlace: () => w.at, layRemains: (rec, items) => { w.laid.push(items); return true; },
    atRest: () => w.rest, askRest: (name, yes) => { w.asked.push(name); w.yes = yes; }, takeItem: (it) => { e.items = e.items.filter((x) => x !== it); },
  });
  host.found(model);
  return { host, e, w, sword };
}

test('LEGACY4: a Bloodline death leaves the remains where the fallen fell, the heirloom and a tenth of the purse with them', () => {
  const { host, e, sword } = quest();
  assert.equal(host.deathOutcome().kind, 'fall');
  const r = host.family.remains[0];
  assert.equal(r.state, 'lying');
  assert.equal(r.killer, 'the Vampire Ancient');
  assert.equal(r.gold, Math.floor(1000 * REMAINS_GOLD_SHARE));
  assert.deepEqual(r.place.dungeon, { regionIndex: 17, locationIndex: 3 });
  assert.deepEqual(r.place.pos, [1, 2, 3]);
  assert.equal(r.items.length, 1, 'rng 0 < the chance: an heirloom');
  assert.equal(r.items[0].heirloom.of, 1);
  assert.ok(e.items.includes(sword), 'a copy - the fallen\'s own bag is untouched');
  // the death quest in the log and on the maps
  const q = host.questLogEntries();
  assert.equal(q[0].id, `${LEGACY_QUEST_PREFIX}r1`);
  assert.equal(q[0].name, 'The Bones of Ysolde Hlaalu');
  assert.match(q[0].messages[0].join(' '), /fell at Castle Daggerfall, Daggerfall, deep inside/);
  assert.match(q[0].messages[0].join(' '), /the Vampire Ancient/);
  assert.deepEqual(host.mapMarks().map((m) => [m.cx, m.cy, m.place]), [[40.5, 60.5, true]]);
});

test('LEGACY4: found, taken, laid to rest - the pile laid once a visit, the purse once, the heirloom attuned, the blessing given', () => {
  const { host, e, w } = quest();
  host.deathOutcome();
  const r = host.family.remains[0];
  // the heir (the same entity, for the test) arrives where they fell
  host.family.people[0].died = null;   // the tick reads a living played member
  w.at = true;
  host.tick();
  assert.equal(w.laid.length, 1);
  const pile = w.laid[0];
  assert.deepEqual(pile.map((it) => it.templateIndex), [120, REMAINS_TEMPLATE, w.laid[0][2].templateIndex]);
  assert.equal(r.gold, 0, 'the purse lies once');
  host.tick();
  assert.equal(w.laid.length, 1, 'once a visit');
  w.at = false; host.tick(); w.at = true; host.tick();
  assert.equal(w.laid.length, 2, 'a new visit lays them again');
  assert.equal(w.laid[1].length, 2, '- the bones and the heirloom, never a second purse');
  // the heir takes the heirloom and the remains
  e.items.push(pile[0], pile[1]);
  host.tick();
  assert.equal(r.items.length, 0, 'what was taken is the heir\'s - never laid again');
  assert.equal(r.state, 'taken');
  assert.match(host.questLogEntries()[0].messages[0][0], /You carry the remains/);
  assert.deepEqual(host.mapMarks(), [], 'no ring once carried');
  // at a temple: asked, then laid to rest
  w.rest = true;
  host.tick();
  assert.deepEqual(w.asked, ['Ysolde Hlaalu']);
  host.tick();
  assert.equal(w.asked.length, 1, 'asked once a visit');
  w.yes();
  assert.equal(r.state, 'rested');
  assert.ok(!e.items.some(isRemainsItem), 'the remains given up');
  assert.equal(pile[0].heirloom.gen, 1, 'the heirloom carried home attuned');
  assert.deepEqual(e.legacyBlessings, [{ of: 1, name: 'Ysolde Hlaalu', skill: 28, value: 3 }]);
  assert.deepEqual(host.questLogEntries(), [], 'the quest is done');
});

test('LEGACY4: an Enduring rise leaves no remains; a death of years always leaves the heirloom', () => {
  const a = quest({ model: MODELS.enduring });
  assert.equal(a.host.deathOutcome().kind, 'rise');
  assert.deepEqual(a.host.family.remains, []);
  const b = quest({ model: MODELS.enduring });
  b.host.current().toll = 999;
  assert.equal(b.host.deathOutcome().kind, 'fall');
  assert.equal(b.host.family.remains[0].items.length, 1);
  void familyRng;
});
