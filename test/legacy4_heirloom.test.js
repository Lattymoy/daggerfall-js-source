// LEGACY4 (2026-10-05, bible/06-Systems/Legacy-Arc.md section 7): HEIRLOOMS, THE REMAINS AND THE DEATH QUEST - Mac:
// "Upon your current characters death, have a chance to drop a gear item deemed an heirloom. These heirlooms, along with
// your characters remains can be acquired by completing the death quest on your descendant."
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  pickHeirloom, markHeirloom, attuneHeirloom, heirloomEligible, isHeirloom, mintRemainsItem, isRemainsItem, bestSkillOf,
  blessingOf, legacyFold, heirloomWeaponDamage, heirloomLine, HEIRLOOM_GEN_MAX, HEIRLOOM_DAMAGE_PER_GEN,
  HEIRLOOM_ARMOR_PER_GEN, BLESSING_POINTS, BLESSING_SKILL_MAX, REMAINS_TEMPLATE, REMAINS_GOLD_SHARE, REMAINS_GOLD_MAX, remainsGoldOf,
} from '../src/systems/legacy/heirloom.js';
import { itemLongName } from '../src/systems/itemInfo.js';
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

test('LEGACY4: marked for the house - a copy carrying it, its generation kept, growing to a ceiling; the long name puts the house first', () => {
  const sword = piece('Weapons', 120, 4, 1);
  const h = markHeirloom(sword, { line: 'fam-1', house: 'Hlaalu', of: 3, from: 'Ysolde Hlaalu' });
  assert.notEqual(h, sword, 'a copy for the remains - the fallen\'s own bag is their save\'s');
  assert.equal(h.equipSlot, undefined);
  assert.equal(h.name, sword.name, 'its own name kept');
  assert.deepEqual(h.heirloom, { line: 'fam-1', house: 'Hlaalu', of: 3, from: 'Ysolde Hlaalu', gen: 0, base: sword.name ?? 'heirloom' });
  assert.ok(isHeirloom(h));
  // AUDIT LEGACY H9: "Hlaalu's Dwarven Longsword" - the house before the whole long name, the maker's mark's shape
  const long = itemLongName(h);
  assert.match(long, /^Hlaalu's \S+ /, long);
  assert.ok(long.endsWith(itemLongName(sword)), `${long} is the house's ${itemLongName(sword)}`);
  assert.equal(itemLongName({ ...h, heirloom: { ...h.heirloom, house: 'of Daggerfall' } }), `${itemLongName(sword)} of the house of Daggerfall`, 'a house named for its seat, after');
  for (let i = 0; i < 7; i++) attuneHeirloom(h);
  assert.equal(h.heirloom.gen, HEIRLOOM_GEN_MAX);
  assert.equal(HEIRLOOM_GEN_MAX, 5);
  const again = markHeirloom({ ...h, equipSlot: 1 }, { line: 'fam-1', house: 'Hlaalu', of: 9, from: 'Riadell Hlaalu' });
  assert.equal(again.heirloom.gen, 5, 'a second death keeps its generations');
  assert.equal(itemLongName(again), itemLongName(h), 'named once - never "Hlaalu\'s Hlaalu\'s"');
  assert.match(heirloomLine(again), /Heirloom of the house of Hlaalu, first borne by Riadell Hlaalu - carried home 5 times\./);
  assert.equal(heirloomLine(sword), null);
});

test('AUDIT LEGACY H5: an artifact (minted `artifact: true`, no rarity) and a summoned piece are never an heirloom', () => {
  const sword = piece('Weapons', 120, 4, 1);
  assert.equal(heirloomEligible({ ...sword, artifact: true }), false, 'Chrysamere is never copied');
  assert.equal(heirloomEligible({ ...sword, timeForItemToDisappear: 99 }), false, 'its timer would take the copy at the pickup');
  assert.equal(pickHeirloom([{ ...sword, artifact: true, value: 1e6 }, sword]), sword);
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

function quest({ model = MODELS.bloodline } = {}) {
  _resetModSaveData();
  const mem = () => { const m = new Map(); return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } }; };
  const storage = mem(), tab = mem();
  const sword = piece('Weapons', 120, 4, 1);
  const e = {
    name: 'Ysolde Hlaalu', gender: 'female', race: 'DarkElf', faceIndex: 3, careerIndex: 5, career: { name: 'Nightblade', primarySkills: [28], majorSkills: [], minorSkills: [] },
    level: 9, characterId: 'c-y', chargenDone: true, health: 0, stats: { strength: 60, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 },
    skills: Array.from({ length: 35 }, (_, i) => (i === 28 ? 80 : 20)), items: [sword], wagonItems: [],
  };
  const w = { at: false, rest: false, opened: [], said: [], asked: [], shown: true, fight: false };
  const host = createLegacyHost({
    entity: e, storage: () => storage, tab: () => tab, on: () => true, online: () => false, now: () => 500, own: () => 0,
    here: () => ({ pixel: { x: 40, y: 60 }, region: 'Daggerfall', regionIndex: 17, mode: 'dungeon', loc: 'Castle Daggerfall', locationType: LOCATION_TYPES.DungeonKeep, dungeon: { regionIndex: 17, locationIndex: 3 }, pos: [1, 2, 3], world: null }),
    town: () => null, nearestTown: () => ({ region: 'Daggerfall', loc: 'Daggerfall' }), gold: () => 1000, say: (l) => w.said.push(l),
    boot: () => {}, search: () => '?world', loadCharacter: () => false, saveNow: () => true, inFight: () => w.fight, rng: () => 0,
    killer: () => 'the Vampire Ancient', atPlace: () => w.at, openRemains: (rec, items) => { w.opened.push(items); return w.shown; },
    carried: () => [...e.items, ...e.wagonItems],
    atRest: () => w.rest, askRest: (name, yes) => { if (!w.shown) return false; w.asked.push(name); w.yes = yes; return true; },
    takeItem: (it) => { e.items = e.items.filter((x) => x !== it); e.wagonItems = e.wagonItems.filter((x) => x !== it); },
  });
  host.found(model);
  return { host, e, w, sword, storage };
}
/** The heir takes the mantle: a newborn of the fallen, played by the same test entity under the heir's own id. */
function heirOf(t) {
  assert.equal(t.host.succeed({ newborn: true }), true);
  t.e.characterId = 'c-heir';
  t.e.name = `Heir ${t.host.family.surname}`;
  t.e.items = [];
  t.e.health = 50;
  t.host.current().characterId = 'c-heir';
  return t.host.current();
}

test('LEGACY4: a Bloodline death leaves the remains where the fallen fell - their bones, the heirloom and a tenth of the purse, a list the record owns', () => {
  const { host, e, sword } = quest();
  assert.equal(host.deathOutcome().kind, 'fall');
  const r = host.family.remains[0];
  assert.equal(r.state, 'lying');
  assert.equal(r.killer, 'the Vampire Ancient');
  assert.deepEqual(r.place.dungeon, { regionIndex: 17, locationIndex: 3 });
  assert.deepEqual(r.place.pos, [1, 2, 3]);
  assert.deepEqual(r.items.map((it) => it.templateIndex), [REMAINS_TEMPLATE, 120, r.items[2].templateIndex], 'the bones, the heirloom (rng 0 < the chance), the purse');
  assert.equal(r.items[1].heirloom.of, 1);
  assert.equal(r.items[2].stackCount, Math.floor(1000 * REMAINS_GOLD_SHARE), 'a tenth of the purse');
  assert.deepEqual(r.first, r.items, 'the list as laid, kept');
  assert.ok(e.items.includes(sword), 'a copy - the fallen\'s own bag is untouched');
  assert.equal(remainsGoldOf(10_000_000), REMAINS_GOLD_MAX, 'AUDIT LEGACY H7: a ceiling on the purse that lies');
  // the death quest in the log and on the maps
  const q = host.questLogEntries();
  assert.equal(q[0].id, `${LEGACY_QUEST_PREFIX}r1`);
  assert.equal(q[0].name, 'The Bones of Ysolde Hlaalu');
  assert.match(q[0].messages[0].join(' '), /fell at Castle Daggerfall, Daggerfall, deep inside/);
  assert.match(q[0].messages[0].join(' '), /the Vampire Ancient/);
  assert.deepEqual(host.mapMarks().map((m) => [m.cx, m.cy, m.place]), [[40.5, 60.5, true]]);
});

test('LEGACY4 + AUDIT LEGACY H1/H4/H6/H8: found, taken, laid to rest - the list opened once a visit and never laid twice, the bones always somewhere, the rest asked once shown', () => {
  const t = quest();
  const { host, w } = t;
  host.deathOutcome();
  const r = host.family.remains[0];
  const heir = heirOf(t);
  const e = t.e;
  // the heir arrives where they fell: the remains' own list, opened - never a world pile
  w.at = true;
  host.tick();
  assert.equal(w.opened.length, 1);
  assert.equal(w.opened[0], r.items, 'THE RECORD\'S LIST - what is left in it stays with the remains');
  assert.equal(r.by, heir.id, 'opened: the heir\'s claim');
  host.tick();
  assert.equal(w.opened.length, 1, 'once a visit');
  w.fight = true; w.at = false; host.tick(); w.at = true; host.tick();
  assert.equal(w.opened.length, 1, 'never mid-fight');
  w.fight = false; host.tick();
  assert.equal(w.opened.length, 2, 'a new visit opens the same list again - nothing was ever laid twice');
  // the heir takes the gold and the heirloom from the window (the window moves them), leaves the bones
  const [bones, heirloom, gold] = r.items;
  r.items.splice(1, 2); e.items.push(heirloom, gold);
  host.tick();
  assert.deepEqual(r.items, [bones], 'what was taken is gone from the list for good; the bones lie on');
  assert.equal(r.state, 'lying');
  // then the bones - into the wagon, which keeps them as well as the pack (H4)
  r.items.splice(0, 1); e.wagonItems.push(bones);
  host.tick();
  assert.equal(r.state, 'taken');
  assert.match(host.questLogEntries()[0].messages[0][0], /You carry the remains/);
  assert.deepEqual(host.mapMarks(), [], 'no ring once carried');
  // sold or dropped: the bones are no longer carried - they lie again where the fallen fell, never stranded (H4)
  e.wagonItems = [];
  host.tick();
  assert.equal(r.state, 'lying');
  assert.equal(r.items.filter(isRemainsItem).length, 1, 'the bones back in the list, once');
  assert.ok(w.said.some((l) => /no longer with you/.test(l)));
  r.items.splice(0, 1); e.items.push(bones);
  host.tick();
  assert.equal(r.state, 'taken');
  // at a temple: a rest asked under another window is asked again (H8), then once a visit
  w.rest = true; w.shown = false;
  host.tick();
  assert.deepEqual(w.asked, []);
  w.shown = true;
  host.tick();
  assert.deepEqual(w.asked, ['Ysolde Hlaalu']);
  host.tick();
  assert.equal(w.asked.length, 1, 'asked once a visit');
  w.yes();
  assert.equal(r.state, 'rested');
  assert.ok(!e.items.some(isRemainsItem), 'the remains given up');
  assert.equal(heirloom.heirloom.gen, 1, 'the heirloom carried home attuned');
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
  assert.equal(b.host.family.remains[0].items.filter(isHeirloom).length, 1);
  void familyRng;
});
