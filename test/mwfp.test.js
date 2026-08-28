import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mwWeaponClass,
  mwSegmentForState,
  mwAnimForState,
  mwSegmentWindow,
  MW_WEAPON_MESH,
  MW_WEAPON_BONE,
} from '../src/combat/mwFpArms.js';
import { WEAPON_TYPES } from '../src/combat/fpsWeapon.js';
import { parseAnimGroups } from '../src/formats/mwAnim.js';

test('mwfp: engine weapon types land in the right Morrowind class', () => {
  assert.equal(mwWeaponClass(WEAPON_TYPES.LongBlade), 'onehand');
  assert.equal(mwWeaponClass(WEAPON_TYPES.Dagger_Magic), 'onehand');
  assert.equal(mwWeaponClass(WEAPON_TYPES.Mace), 'onehand');
  assert.equal(mwWeaponClass(WEAPON_TYPES.Warhammer), 'twohand');
  assert.equal(mwWeaponClass(WEAPON_TYPES.Battleaxe_Magic), 'twohand');
  assert.equal(mwWeaponClass(WEAPON_TYPES.Staff), 'twohand');
  assert.equal(mwWeaponClass(WEAPON_TYPES.Bow), 'bow');
  assert.equal(mwWeaponClass(WEAPON_TYPES.Melee), 'handtohand');
  assert.equal(mwWeaponClass(WEAPON_TYPES.Werecreature), 'handtohand');
  assert.equal(mwWeaponClass(WEAPON_TYPES.None), 'none');
});

test('mwfp: six classic swing directions fold onto MW three', () => {
  assert.equal(mwSegmentForState('StrikeDown'), 'chop');
  assert.equal(mwSegmentForState('StrikeDownLeft'), 'chop');
  assert.equal(mwSegmentForState('StrikeDownRight'), 'chop');
  assert.equal(mwSegmentForState('StrikeLeft'), 'slash');
  assert.equal(mwSegmentForState('StrikeRight'), 'slash');
  assert.equal(mwSegmentForState('StrikeUp'), 'thrust');
  assert.equal(mwSegmentForState('Idle'), null);
});

test('mwfp: the full decision - idle groups per class, attack group + segment', () => {
  assert.deepEqual(mwAnimForState(WEAPON_TYPES.LongBlade, 'Idle'), {
    group: 'Idle1h',
    segment: null,
  });
  assert.deepEqual(mwAnimForState(WEAPON_TYPES.LongBlade, 'StrikeUp'), {
    group: 'WeaponOneHand',
    segment: 'thrust',
  });
  assert.deepEqual(mwAnimForState(WEAPON_TYPES.Warhammer, 'StrikeDown'), {
    group: 'WeaponTwoHand',
    segment: 'chop',
  });
  assert.deepEqual(mwAnimForState(WEAPON_TYPES.Bow, 'Idle'), { group: 'Idle1h', segment: null });
  assert.deepEqual(mwAnimForState(WEAPON_TYPES.Melee, 'StrikeLeft'), {
    group: 'HandToHand',
    segment: 'slash',
  });
  // Bare hands never resolve an attack group they don't have.
  assert.deepEqual(mwAnimForState(WEAPON_TYPES.None, 'StrikeDown'), {
    group: 'Idle',
    segment: null,
  });
});

test('mwfp: segment windows read the group sub-markers, retail marker shapes', () => {
  const groups = parseAnimGroups([
    { time: 0, text: 'WeaponOneHand: Start' },
    { time: 0.1, text: 'WeaponOneHand: Chop Start' },
    { time: 0.3, text: 'WeaponOneHand: Chop Min Attack' },
    { time: 0.5, text: 'WeaponOneHand: Chop Max Attack' },
    { time: 0.7, text: 'WeaponOneHand: Chop Hit' },
    { time: 0.9, text: 'WeaponOneHand: Chop Follow Stop' },
    { time: 1.0, text: 'WeaponOneHand: Slash Start' },
    { time: 1.4, text: 'WeaponOneHand: Slash Hit' },
    { time: 2.0, text: 'WeaponOneHand: Stop' },
  ]);
  const g = groups.get('WeaponOneHand');
  assert.deepEqual(mwSegmentWindow(g, 'chop'), { start: 0.1, stop: 0.9 });
  // Partial marker sets fall back honestly: no follow -> hit ends it.
  assert.deepEqual(mwSegmentWindow(g, 'slash'), { start: 1.0, stop: 1.4 });
  // A segment the group never carries is null, not a guess.
  assert.equal(mwSegmentWindow(g, 'thrust'), null);
  assert.equal(mwSegmentWindow(null, 'chop'), null);
});

test('mwfp: the iron weapon-mesh table covers every drawable type; bone name fixed', () => {
  const drawable = Object.values(WEAPON_TYPES).filter(
    (t) => t !== WEAPON_TYPES.None && t !== WEAPON_TYPES.Melee && t !== WEAPON_TYPES.Werecreature,
  );
  for (const t of drawable) {
    assert.match(MW_WEAPON_MESH[t], /^meshes\\w\\w_/, `type ${t}`);
  }
  assert.equal(MW_WEAPON_BONE, 'weapon bone');
});
