// AUDIT 26 F181 - THE SPELL MAKER'S ALLOWED TARGETS AND ELEMENTS.
//
// DaggerfallSpellMakerWindow gates both selections on what the CHOSEN
// effects permit, by two OPPOSITE rules the ledger row ran together:
// targets INTERSECT (seeded TargetFlags_All), elements UNION (seeded
// ElementFlags_MagicOnly, so magic is always offered). The port
// cycled both freely through all five values and held no allowed
// state at all, so it would price and inscribe spells DFU cannot
// mint - an "Area at Range" built from a caster-only effect.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  allowedTargetsOf, allowedElementsOf, updateAllowedButtons,
  enforceSelected, cycleAllowed, firstAllowedIndex,
  TARGET_FLAGS, ELEMENT_FLAGS,
  TARGET_FLAGS_ALL, TARGET_FLAGS_SELF, TARGET_FLAGS_OTHER,
  ELEMENT_FLAGS_ALL, ELEMENT_FLAGS_MAGIC_ONLY,
  DEFAULT_TARGET_INDEX, DEFAULT_ELEMENT_INDEX,
} from '../src/systems/spellMaker.js';
import { MAGIC_ONLY_KEYS } from '../src/systems/effects.js';
import { SPELL_MAKER_EFFECTS } from '../src/systems/spellEffects.js';
import { SpellMakerWindow } from '../src/ui/spellMakerWindow.js';
import { SPELLBOOK_TEMPLATE_INDEX } from '../src/systems/spellMaker.js';

const slot = (type, subType) => ({ type, subType, key: `${type},${subType}`, settings: {} });

// ---------------------------------------------------------------
// The flag sets themselves (EntityEffectBroker.cs:41-48,
// MagicAndEffectsEnums.cs:21-29 and :36-44).
// ---------------------------------------------------------------
test('audit26 F181: the bit sets are DFU\'s, and an index is its bit\'s position', () => {
  assert.deepEqual(TARGET_FLAGS, { CasterOnly: 1, ByTouch: 2, SingleTargetAtRange: 4, AreaAroundCaster: 8, AreaAtRange: 16 });
  assert.deepEqual(ELEMENT_FLAGS, { Fire: 1, Cold: 2, Poison: 4, Shock: 8, Magic: 16 });
  assert.equal(TARGET_FLAGS_ALL, 31);
  assert.equal(TARGET_FLAGS_SELF, TARGET_FLAGS.CasterOnly);
  assert.equal(TARGET_FLAGS_OTHER, TARGET_FLAGS_ALL & ~TARGET_FLAGS.CasterOnly, 'everything BUT caster-only');
  assert.equal(ELEMENT_FLAGS_ALL, 31);
  assert.equal(ELEMENT_FLAGS_MAGIC_ONLY, ELEMENT_FLAGS.Magic);
  // the window stores classic indices; the enums declare in that order
  assert.equal(DEFAULT_TARGET_INDEX, 0);
  assert.equal(DEFAULT_ELEMENT_INDEX, 4);
});

test('audit26 F181: every offered effect classifies, and the three target sets are the only ones DFU uses', () => {
  const seen = new Set();
  for (const e of SPELL_MAKER_EFFECTS) {
    const t = allowedTargetsOf(e.type, e.subType);
    assert.ok([TARGET_FLAGS_ALL, TARGET_FLAGS_SELF, TARGET_FLAGS_OTHER].includes(t),
      `${e.key} got ${t}, which is not one of DFU's three sets`);
    seen.add(t);
    const el = allowedElementsOf(e.type, e.subType);
    assert.ok(el === ELEMENT_FLAGS_ALL || el === ELEMENT_FLAGS_MAGIC_ONLY, `${e.key} elements ${el}`);
  }
  assert.equal(seen.size, 3, 'all three target sets are actually reached by the offer list');

  // spot the three kinds against the classes they were read from
  assert.equal(allowedTargetsOf(4, 0), TARGET_FLAGS_OTHER, 'ContinuousDamageHealth: TargetFlags_Other');
  assert.equal(allowedTargetsOf(2, 255), TARGET_FLAGS_SELF, 'a caster-only effect');
  assert.equal(allowedTargetsOf(9, 0), TARGET_FLAGS_ALL, 'a fortify: TargetFlags_All');

  // the element half runs off the SAME set the GetElementType law
  // already read off those classes - not a second, drifting table.
  for (const e of SPELL_MAKER_EFFECTS) {
    const expected = MAGIC_ONLY_KEYS.has(`${e.type},${e.subType}`) ? ELEMENT_FLAGS_MAGIC_ONLY : ELEMENT_FLAGS_ALL;
    assert.equal(allowedElementsOf(e.type, e.subType), expected, e.key);
  }
});

// ---------------------------------------------------------------
// UpdateAllowedButtons (:561-594) - the two opposite rules.
// ---------------------------------------------------------------
test('audit26 F181: targets INTERSECT and elements UNION - the rules run opposite ways', () => {
  // one caster-only effect narrows the whole spell to CasterOnly...
  const self = updateAllowedButtons([slot(2, 255), null, null]);
  assert.equal(self.targets, TARGET_FLAGS_SELF);

  // ...and adding an "other"-only effect leaves NOTHING legal, since
  // the two sets are disjoint. DFU intersects to None and every arm
  // of SelectFirstAllowedTargetType falls through.
  const none = updateAllowedButtons([slot(2, 255), slot(4, 0), null]);
  assert.equal(none.targets, 0);
  assert.equal(firstAllowedIndex(0), -1);

  // an All effect never narrows anything
  assert.equal(updateAllowedButtons([slot(9, 0), null, null]).targets, TARGET_FLAGS_ALL);
  assert.equal(updateAllowedButtons([slot(9, 0), slot(4, 0), null]).targets, TARGET_FLAGS_OTHER);

  // ELEMENTS go the other way: magic is the seed, so a magic-only
  // effect adds nothing and an All effect opens all five - and the
  // ORDER of the two makes no difference, which a shared rule would
  // not survive.
  assert.equal(updateAllowedButtons([slot(2, 255), null, null]).elements, ELEMENT_FLAGS_MAGIC_ONLY);
  assert.equal(updateAllowedButtons([slot(4, 0), null, null]).elements, ELEMENT_FLAGS_ALL);
  assert.equal(updateAllowedButtons([slot(2, 255), slot(4, 0), null]).elements, ELEMENT_FLAGS_ALL,
    'a magic-only effect beside an All one still allows all five - UNION, not intersection');
  assert.equal(updateAllowedButtons([slot(4, 0), slot(2, 255), null]).elements, ELEMENT_FLAGS_ALL);
  // ...while the same pair intersects to nothing on the target side.
  assert.equal(updateAllowedButtons([slot(4, 0), slot(2, 255), null]).targets, 0);
});

test('audit26 F181: an empty sheet takes the DEFAULT arm, which FORCES rather than enforces', () => {
  const empty = updateAllowedButtons([null, null, null]);
  assert.equal(empty.targets, TARGET_FLAGS_ALL);
  assert.equal(empty.elements, ELEMENT_FLAGS_MAGIC_ONLY, 'magic only, though every target is legal');
  assert.equal(empty.forced, true);
  assert.equal(updateAllowedButtons([slot(9, 0), null, null]).forced, false);
});

// ---------------------------------------------------------------
// EnforceSelectedButtons (:595-603) and SelectFirstAllowed*
// (:605-660).
// ---------------------------------------------------------------
test('audit26 F181: an illegal selection snaps to the FIRST allowed value, a legal one never moves', () => {
  // AreaAtRange (index 4) under a caster-only spell -> CasterOnly
  assert.equal(enforceSelected(4, TARGET_FLAGS_SELF), 0);
  // ByTouch (1) under TargetFlags_Other is legal and stays put...
  assert.equal(enforceSelected(1, TARGET_FLAGS_OTHER), 1);
  // ...while CasterOnly (0) is not, and takes the first Other bit.
  assert.equal(enforceSelected(0, TARGET_FLAGS_OTHER), 1, 'ByTouch is the first bit in Other');
  // the FIRST allowed, in declaration order - not the nearest
  assert.equal(firstAllowedIndex(TARGET_FLAGS.AreaAroundCaster | TARGET_FLAGS.ByTouch), 1);
  // Fire is the first element bit, so an illegal element goes there
  assert.equal(enforceSelected(4, ELEMENT_FLAGS_ALL), 4, 'Magic is legal under All and stays');
  assert.equal(enforceSelected(0, ELEMENT_FLAGS_MAGIC_ONLY), 4, 'only Magic is left');
  // nothing allowed at all: DFU's arms all fall through and the
  // selection is left where it was.
  assert.equal(enforceSelected(3, 0), 3);
});

test('audit26 F181: the cycle steps OVER disallowed values in both directions', () => {
  // Other = ByTouch|SingleAtRange|AreaAroundCaster|AreaAtRange, so a
  // forward step from AreaAtRange (4) skips CasterOnly (0).
  assert.equal(cycleAllowed(4, 1, TARGET_FLAGS_OTHER), 1);
  assert.equal(cycleAllowed(1, -1, TARGET_FLAGS_OTHER), 4, 'and backwards the same way');
  // a single legal value has nowhere to go
  assert.equal(cycleAllowed(0, 1, TARGET_FLAGS_SELF), 0);
  assert.equal(cycleAllowed(4, 1, ELEMENT_FLAGS_MAGIC_ONLY), 4);
  // an empty set leaves the index alone rather than hunting forever
  assert.equal(cycleAllowed(2, 1, 0), 2);
  // and with everything allowed it is the plain wrap it always was
  assert.equal(cycleAllowed(4, 1, TARGET_FLAGS_ALL), 0);
  assert.equal(cycleAllowed(0, -1, TARGET_FLAGS_ALL), 4);
});

// ---------------------------------------------------------------
// The window: the recompute runs on every slot change, so no
// selection outlives the effect that permitted it.
// ---------------------------------------------------------------
const win = () => new SpellMakerWindow({ entity: {
  name: 'S', level: 1, stats: {}, skills: [50], maxMagicka: 40,
  goldPieces: 100000,   // E4: PlayerEntity.GoldPieces
  items: [{ group: 'MiscItems', templateIndex: SPELLBOOK_TEMPLATE_INDEX }],
  spells: [],
} });
const toRow = (w, kind, i = 0) => {
  w.cursor = w._rows().findIndex((r) => r.kind === kind && (r.i ?? 0) === i);
  return w;
};

test('audit26 F181: adding a caster-only effect drags an Area selection back to Caster Only', () => {
  const w = win();
  // pick Area At Range while the sheet is empty (every target legal)
  toRow(w, 'target');
  for (let i = 0; i < 4; i++) w.input('confirm');
  assert.equal(w.rangeType, 4, 'Area At Range');

  // now add a caster-only effect: AddEffect ends in
  // UpdateAllowedButtons, whose EnforceSelectedButtons moves it.
  w.slots[0] = slot(2, 255);
  w._updateAllowed();
  assert.equal(w.allowedTargets, TARGET_FLAGS_SELF);
  assert.equal(w.rangeType, 0, 'the illegal selection did not survive the effect that outlawed it');
  // ...and the row can no longer be cycled off it
  toRow(w, 'target').input('confirm');
  assert.equal(w.rangeType, 0);
});

test('audit26 F181: deleting the last effect FORCES CasterOnly and Magic back, not merely a legal value', () => {
  const w = win();
  w.slots[0] = slot(4, 0);          // Other targets, All elements
  w._updateAllowed();
  toRow(w, 'target');
  w.input('confirm');               // step off ByTouch
  toRow(w, 'element').input('confirm');
  const target = w.rangeType;
  const element = w.element;
  assert.notEqual(target, 0);
  assert.notEqual(element, 4);

  // delete it. The default arm allows EVERY target, so a mere
  // enforcement would leave the selection alone - DFU calls
  // SetSpellTarget(CasterOnly) outright (:567-568).
  toRow(w, 'slot', 0).input('char:d');
  assert.equal(w.allowedTargets, TARGET_FLAGS_ALL, 'every target is legal again');
  assert.equal(w.rangeType, 0, 'and it STILL snaps back to Caster Only');
  assert.equal(w.element, 4, 'and to Magic');
});

test('audit26 F181: a fresh sheet starts on the default flags', () => {
  const w = win();
  assert.equal(w.allowedTargets, TARGET_FLAGS_ALL);
  assert.equal(w.allowedElements, ELEMENT_FLAGS_MAGIC_ONLY);
  assert.equal(w.rangeType, 0);
  assert.equal(w.element, 4);
  // ...and the element row is inert until an effect opens it
  toRow(w, 'element').input('confirm');
  assert.equal(w.element, 4);
});
