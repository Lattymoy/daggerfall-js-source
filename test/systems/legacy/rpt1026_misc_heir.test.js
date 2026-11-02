// RPT1026-MISC HEIR-WAITS (a private report: a high-level Bloodline character's death offered an heir, the game went back to
// the menu before one was chosen, and the parent was gone from the realm). A Bloodline's fall is the realm's tombstone at the death door, before the Succession; the page
// that went back to the title left the Succession waiting on the line's record - and HOUSE-WAITS, the Online page's one door
// to a waiting line (systems/legacy/waitingHouses.js), named its LIVING members alone. The fall's own Succession offers a
// newborn heir of the fallen too (legacyHost.js fallOutcome), and a fallen with no sibling or child left the house with
// nothing to press. Driven through the real family law, the real store and the door.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { foundFamily, recordDeath, personOf, isAlive, MODELS, DESCENDANTS } from '../../../src/systems/legacy/family.js';
import { storeFamily, loadFamily, readBirth } from '../../../src/systems/legacy/store.js';
import { waitingHouses, takeUpLine, newbornButtonLabel } from '../../../src/systems/legacy/waitingHouses.js';

const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), get length() { return m.size; }, key: (i) => [...m.keys()][i] }; };
/** A Bloodline founder fallen with no kin, the Succession waiting - as the death door leaves it (legacyHost.js recordFall). */
function loneFall({ heir = true } = {}) {
  // AUDIT RPT1026 L4: a name of the test's own - the fixture had worn the report's own character's surname, race and sex
  const f = foundFamily({ name: 'Maren Holloway', race: 5, gender: 1 }, { model: MODELS.bloodline, at: 1, id: 'fam-h', rng: () => 0.3 });
  const fallen = personOf(f, f.currentId);
  fallen.heir = heir;   // B12: the heir answer, rolled at their birth
  recordDeath(f, f.currentId, { at: 700, cause: 'fell' });
  f.pending = { fallenId: f.currentId, at: 700, estate: 1200, bequest: [] };
  return { f, fallen };
}
const RANDOM = { descendants: DESCENDANTS.random, maxSiblings: 0, siblingChance: 0 };

test('RPT1026-MISC HEIR-WAITS: a fall with no living kin whose heir answer allows one names a newborn heir on its card; one whose answer refuses names none (mutant: rpt1026-misc-heir-newborn-unoffered)', () => {
  const { f, fallen } = loneFall();
  const [h] = waitingHouses([f], { settings: RANDOM });
  assert.ok(h, 'the house waits on the Online page');
  assert.deepEqual(h.heirs, [], 'no living member to carry it');
  assert.equal(h.newborn, true, 'but the fall may raise a child of the fallen');
  assert.equal(h.fallen.id, fallen.id);
  assert.equal(newbornButtonLabel(fallen), 'Raise a child of Maren as your heir');
  const refused = loneFall({ heir: false }).f;
  assert.deepEqual(waitingHouses([refused], { settings: RANDOM }), [], 'an answer of no heir, and no kin: no card - the line has no one to go on');
  assert.equal(waitingHouses([refused], { settings: { ...RANDOM, descendants: DESCENDANTS.always } })[0]?.newborn, true, 'the Descendants dial at Always answers for everyone');
});

test('RPT1026-MISC HEIR-WAITS: raising the newborn from the card makes the fallen\'s child at the fall\'s minute, the line\'s current, stored, and leaves their birth for the boot - the fall still waits for them to land (mutant: rpt1026-misc-heir-newborn-refused)', () => {
  const { f, fallen } = loneFall();
  const storage = mem(), tab = mem();
  storeFamily(storage, f);
  const r = takeUpLine({ storage, tab, familyId: f.id, personId: null, newborn: true, settings: RANDOM, rng: () => 0.3, now: 50 });
  assert.equal(r.ok, true, r.why);
  const kept = loadFamily(storage, f.id);
  const heir = personOf(kept, r.heirId);
  assert.ok(heir && isAlive(heir), 'a new member of the house');
  assert.deepEqual(heir.parents, [fallen.id], 'the fallen\'s child');
  assert.equal(heir.gen, fallen.gen + 1);
  assert.equal(heir.born, 700, 'born at the fall\'s own minute (AUDIT RPT1026 L6: the door\'s choice - the Succession bears its newborn at the choice\'s own minute, a breath after the fall)');
  assert.equal(kept.currentId, heir.id, 'the line\'s current');
  assert.ok(kept.pending, 'the fall is settled when the heir lands, never at the choice (AUDIT LEGACY II B1)');
  const birth = readBirth(tab, heir.id, 60);
  assert.equal(birth?.familyId, f.id, 'the birth left for the boot');
  assert.equal(birth?.newborn, true, 'a newborn - the towns hear of a birth');
  // a card asked for a newborn the fall may not raise is refused, nothing made
  const lone = loneFall({ heir: false });
  storeFamily(storage, lone.f);
  const before = loadFamily(storage, lone.f.id).people.length;
  assert.equal(takeUpLine({ storage, tab, familyId: lone.f.id, personId: null, newborn: true, settings: RANDOM }).ok, false);
  assert.equal(loadFamily(storage, lone.f.id).people.length, before, 'nobody minted');
});
