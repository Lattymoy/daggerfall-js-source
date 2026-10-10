// FIELD BUGS 2026-10-09f (bible/01-Overview/Field-Bugs-2026-10-09f.md): HELD-REWEAR (a Cast-When-Held piece re-worn
// within its spell's six hours pays nothing, and the equip bill never breaks it) and HOUSE-WAITS (a line whose
// Succession waits is answered from the Online page).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENCHANTMENT_TYPES as T, setDefaultEnchantCtx, REROLL_MINIMUM_HOURS } from '../src/systems/enchantments.js';
import '../src/systems/effects.js';
import { equipItem, unequipSlot } from '../src/systems/equip.js';
import { ITEM_GROUPS } from '../src/characters/equipRules.js';
import { classicCastingCost } from '../src/systems/spellcost.js';
import { foundFamily, addChild, recordDeath, personOf, MODELS } from '../src/systems/legacy/family.js';
import { storeFamily, loadFamily, readBirth } from '../src/systems/legacy/store.js';
import { waitingHouses, takeUpLine } from '../src/systems/legacy/waitingHouses.js';

// a Fortify record, CasterOnly (enchantcast.test.js's shape): 49 classic points at skill 40
const rec = { index: 4, name: 'Fortify', rangeType: 0, effects: [{ type: 9, subType: 0, durationBase: 3, durationMod: 0, durationPerLevel: 1, chanceBase: 0, chanceMod: 0, chancePerLevel: 1, magnitudeBaseLow: 5, magnitudeBaseHigh: 5, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1 }, { type: -1 }, { type: -1 }] };
const amulet = (cond) => ({ name: 'Amulet', templateIndex: 133, group: ITEM_GROUPS.Jewellery, currentCondition: cond, maxCondition: 800, enchantments: [{ type: T.CastWhenHeld, param: 4 }] });
const wearer = (items) => ({ name: 'W', isPlayer: true, health: 20, maxHealth: 30, items, level: 5, stats: {}, skills: 40, career: {} });
function withClock(fn) {
  const clock = { now: 100_000 };
  setDefaultEnchantCtx({ spellsByIndex: () => new Map([[4, rec]]), now: () => clock.now });
  try { fn(clock); } finally { setDefaultEnchantCtx(null); }
}

test('HELD-REWEAR: the first wear pays the casting cost; a re-wear inside the six hours pays nothing; past them it pays again', () => withClock((clock) => {
  const cost = classicCastingCost(rec, () => 40);
  const a = amulet(800);
  const w = wearer([a]);
  equipItem(w, a);
  assert.equal(a.currentCondition, 800 - cost);
  unequipSlot(w, a.equipSlot);
  clock.now += REROLL_MINIMUM_HOURS * 60 - 1;
  equipItem(w, a);
  assert.equal(a.currentCondition, 800 - cost, 'a swap back on inside the window is free');
  unequipSlot(w, a.equipSlot);
  clock.now += REROLL_MINIMUM_HOURS * 60;
  equipItem(w, a);
  assert.equal(a.currentCondition, 800 - 2 * cost, 'the spell gone stale, the wear bills again');
}));

test('HELD-REWEAR: an equip bill larger than what is left stops at 1 - the piece is worn, never broken or lost', () => withClock(() => {
  const a = amulet(10);
  const w = wearer([a]);
  equipItem(w, a);
  assert.equal(a.currentCondition, 1);
  assert.ok(a.equipSlot != null && w.items.includes(a), 'still worn, still carried');
}));

function fallenLine() {
  const f = foundFamily({ name: 'Ana Greenham', race: 1, gender: 1 }, { model: MODELS.bloodline, at: 1, id: 'fam-t', rng: () => 0.3 });
  const kid = addChild(f, f.currentId, { rng: () => 0.3, at: 2 }).person;
  kid.minor = true;
  recordDeath(f, f.currentId, { at: 3, cause: 'fell' });
  f.pending = { fallenId: f.currentId, at: 3, estate: 0, bequest: [] };
  return { f, kid };
}
const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), get length() { return m.size; }, key: (i) => [...m.keys()][i] }; };

test('HOUSE-WAITS: a fallen line names its living members (a child too), never the fallen, nor one the roster plays', () => {
  const { f, kid } = fallenLine();
  const [h] = waitingHouses([f]);
  assert.deepEqual(h.heirs.map((p) => p.id), [kid.id]);
  assert.equal(h.fallen.id, f.pending.fallenId);
  kid.characterId = 'rc-1';
  assert.deepEqual(waitingHouses([f], { played: (id) => id === 'rc-1' }), [], 'a member with a living character is joined from the roster');
  f.pending = null;
  kid.characterId = null;
  assert.deepEqual(waitingHouses([f]), [], 'no Succession waiting, no card');
});

test('HOUSE-WAITS: taking up the line makes the heir current and of age, stores it, and leaves their birth for the boot', () => {
  const { f, kid } = fallenLine();
  const storage = mem(), tab = mem();
  storeFamily(storage, f);
  const r = takeUpLine({ storage, tab, familyId: f.id, personId: kid.id, now: 50 });
  assert.equal(r.ok, true);
  const kept = loadFamily(storage, f.id);
  assert.equal(kept.currentId, kid.id);
  assert.equal(personOf(kept, kid.id).minor, false);
  assert.ok(kept.pending, 'the fall is settled when the heir lands, never at the choice');
  assert.equal(readBirth(tab, kid.id, 60)?.familyId, f.id);
  assert.equal(takeUpLine({ storage, tab, familyId: f.id, personId: f.pending.fallenId }).ok, false, 'never the fallen');
});
