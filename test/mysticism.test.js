// S26: Mysticism, the effect library's one entirely empty school.
// These effects do not fit the "roll a magnitude and apply it" shape
// the rest of the library grew around - not one of the ten supports
// magnitude - so almost every pin here is about a payload rule rather
// than a number.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MYSTICISM_EFFECTS, SUPPORTS_MAGNITUDE, isMysticism,
  armOpen, triggerOpen, triggerLock, dispelNearby,
  dispellableBundles, DISPELLABLE_BUNDLE_TYPES, fillEmptyTrap,
  isSilenced, silenceBlocksCast,
} from '../src/systems/mysticism.js';

const door = (lock = 0, state = 'start') => ({ currentLockValue: lock, state });

test('mysticism: the ten classic keys, and NOT ONE supports magnitude', () => {
  assert.equal(Object.keys(MYSTICISM_EFFECTS).length, 10);
  assert.equal(SUPPORTS_MAGNITUDE, false,
    'the reason this school needed its own module rather than another branch of the magnitude ladder');
  assert.deepEqual(MYSTICISM_EFFECTS.DispelMagic, { type: 6, subType: 0, chance: [120, 180], duration: null });
  assert.deepEqual(MYSTICISM_EFFECTS.DispelUndead, { type: 6, subType: 1, chance: [80, 140], duration: null });
  assert.deepEqual(MYSTICISM_EFFECTS.DispelDaedra, { type: 6, subType: 2, chance: [120, 180], duration: null });
  assert.equal(MYSTICISM_EFFECTS.Open.type, 17);
  assert.equal(MYSTICISM_EFFECTS.Lock.type, 16);
  assert.equal(MYSTICISM_EFFECTS.Silence.type, 19);
  assert.equal(MYSTICISM_EFFECTS.SoulTrap.type, 12);
  assert.equal(MYSTICISM_EFFECTS.Teleport.type, 43);
  assert.equal(MYSTICISM_EFFECTS.ComprehendLanguages.type, 44);
  assert.equal(MYSTICISM_EFFECTS.CreateItem.type, 2);
  // the three Dispels SHARE a group and differ only by subgroup
  const dispels = ['DispelMagic', 'DispelUndead', 'DispelDaedra'].map((k) => MYSTICISM_EFFECTS[k]);
  assert.equal(new Set(dispels.map((d) => d.type)).size, 1);
  assert.equal(new Set(dispels.map((d) => d.subType)).size, 3);
  // Teleport alone costs on neither axis
  assert.equal(MYSTICISM_EFFECTS.Teleport.chance, null);
  assert.equal(MYSTICISM_EFFECTS.Teleport.duration, null);

  assert.equal(isMysticism({ type: 17, subType: 255 }), true);
  assert.equal(isMysticism({ type: 4, subType: 0 }), false, 'Damage Health is Destruction');
});

test('mysticism: Open is ARMED at cast, and an item skips the roll', () => {
  // The chance is rolled at CAST and the payload waits for a door.
  assert.deepEqual(armOpen({ rollChance: () => true }), { armed: true, alert: 'readyToOpen' });
  assert.deepEqual(armOpen({ rollChance: () => false }), { armed: false, alert: 'spellEffectFailed' });
  // an item cast and the Skeleton's Key skip the roll ENTIRELY - even a
  // roll that would have failed
  assert.deepEqual(armOpen({ castByItem: true, rollChance: () => false }),
    { armed: true, alert: 'readyToOpen' });
  assert.deepEqual(armOpen({ castBySkeletonKey: true, rollChance: () => false }),
    { armed: true, alert: 'readyToOpen' });
});

test('mysticism: Open yields a lock only to a caster whose LEVEL reaches it', () => {
  // "Unlocks chest or door to lock-level of caster."
  const low = door(10);
  assert.deepEqual(triggerOpen(low, 5), { unlocked: false, opened: false, alert: 'openFailed' });
  assert.equal(low.currentLockValue, 10, 'and the lock is untouched');

  const equal = door(10);
  const r = triggerOpen(equal, 10);
  assert.equal(r.unlocked, true, 'level EQUAL to the lock is enough');
  assert.equal(equal.currentLockValue, 0);
  assert.equal(r.opened, true, 'and an unlocked, closed door swings open');

  // the Skeleton's Key ignores the level rule - even a magical lock
  const magical = door(20);
  assert.equal(triggerOpen(magical, 1, { castBySkeletonKey: true }).unlocked, true);
  assert.equal(magical.currentLockValue, 0);
});

test('mysticism: Open does not re-open an already-open door, and unlocking is not opening', () => {
  const open = door(0, 'end');
  assert.deepEqual(triggerOpen(open, 9), { unlocked: false, opened: false, alert: null });

  // a door it FAILED to unlock is not opened either
  const stuck = door(99, 'start');
  const r = triggerOpen(stuck, 1);
  assert.equal(r.unlocked, false);
  assert.equal(r.opened, false, 'a lock it could not beat keeps the door shut');
});

test('mysticism: Lock has NO level test - it locks to the caster own level', () => {
  // The asymmetry with Open is the point: Open must beat the lock,
  // Lock simply imposes one.
  const d = door(0, 'end');
  const r = triggerLock(d, 7);
  assert.deepEqual(r, { locked: true, closed: true, alert: 'doorLocked' });
  assert.equal(d.currentLockValue, 7, "the caster's level becomes the lock");

  // an ALREADY-locked door is refused, not re-locked harder
  const already = door(3);
  const r2 = triggerLock(already, 9);
  assert.deepEqual(r2, { locked: false, closed: false, alert: 'doorAlreadyLocked' });
  assert.equal(already.currentLockValue, 3, 'a level-9 caster does not deepen a level-3 lock');
});

test('mysticism: Dispel rolls PER TARGET and DESTROYS - no kill, no loot', () => {
  // DFU: "dispel simply destroys serializable enemy object in scene -
  // target is not killed and will drop no loot. This can break quests
  // if used carelessly." Ported as such.
  const nearby = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
  let n = 0;
  const gone = dispelNearby(nearby, () => (++n % 2 === 1));
  assert.deepEqual(gone.map((o) => o.id), [1, 3], 'the roll is per target, not once for the group');
  assert.equal(dispelNearby(nearby, () => false).length, 0);
  assert.equal(dispelNearby(nearby, () => true).length, 4);
  assert.equal(dispelNearby(null, () => true).length, 0);
  assert.equal(dispelNearby([null, { id: 9 }], () => true).length, 1, 'a dead slot is skipped');
});

test('mysticism: Dispel Magic offers spells and held items, nothing else', () => {
  assert.deepEqual([...DISPELLABLE_BUNDLE_TYPES], ['Spell', 'HeldMagicItem']);
  const bundles = [
    { name: 'a', bundleType: 'Spell' },
    { name: 'b', bundleType: 'HeldMagicItem' },
    { name: 'c', bundleType: 'Disease' },
    { name: 'd', bundleType: 'Poison' },
    { name: 'e', bundleType: 'Spell', showIcon: false },
  ];
  assert.deepEqual(dispellableBundles(bundles).map((b) => b.name), ['a', 'b'],
    'a disease or a poison is not dispellable, and an icon-less spell is hidden');
  assert.deepEqual(dispellableBundles(null), []);
});

test('mysticism: Soul Trap fills AZURA\'S STAR before any ordinary gem', () => {
  const star = { azurasStar: true, trappedSoulType: null };
  const gem1 = { name: 'Soul trap', trappedSoulType: null };
  const gem2 = { name: 'Soul trap', trappedSoulType: null };
  const items = [gem1, star, gem2];
  assert.equal(fillEmptyTrap(items, 'Daedroth'), star, 'the artifact takes it first, wherever it sits');
  assert.equal(star.trappedSoulType, 'Daedroth');
  assert.equal(gem1.trappedSoulType, null);

  // with the star full, the FIRST empty ordinary gem takes the next
  assert.equal(fillEmptyTrap(items, 'Lich'), gem1);
  assert.equal(fillEmptyTrap(items, 'Wraith'), gem2);
  assert.equal(fillEmptyTrap(items, 'Ghost'), null, 'and a full pack fills nothing');
});

test('mysticism: azurasStarOnly refuses to fall back to a gem', () => {
  const gem = { name: 'Soul trap', trappedSoulType: null };
  assert.equal(fillEmptyTrap([gem], 'Lich', { azurasStarOnly: true }), null);
  assert.equal(gem.trappedSoulType, null, 'and leaves it untouched');
  assert.equal(fillEmptyTrap([gem], 'Lich'), gem, 'while the ordinary path takes it');
});

test('mysticism: silence blocks a cast that COSTS spell points, and only that', () => {
  const silenced = { isSilenced: true };
  const free = { isSilenced: false };
  assert.equal(isSilenced(silenced), true);
  assert.equal(isSilenced(free), false);
  assert.equal(isSilenced(undefined), false);

  assert.equal(silenceBlocksCast(silenced), true);
  assert.equal(silenceBlocksCast(free), false);
  // DFU guards with `!noSpellPointCost && SilenceCheck()`, so a free
  // cast - an item, or a no-cost effect - fires through a silence.
  assert.equal(silenceBlocksCast(silenced, { costsSpellPoints: false }), false);
});


// ── S27: the host wiring, swept from source ──────────────────────
// These hosts have no execution coverage in node (AUDIT 19 found a
// crash that 990 tests could not see), so the seam is pinned by
// READING them - the same idiom audit17e uses for the four-host rules.
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(root, f), 'utf8');

test('S27: silence gates BOTH the ready and the cast, in the host that casts', () => {
  // DFU checks SilenceCheck in two places and both clear the readied
  // spell, so a silence landing mid-aim disarms you rather than
  // waiting for the click.
  // M3: the gates moved with the cast stack into the ONE engine
  // (scenes/hostMagic.js) - the behavioral halves are pinned in
  // hostmagic.test.js; this sweep holds the source shape.
  const hm = read('src/scenes/hostMagic.js');
  assert.ok(/import \{[^}]*silenceBlocksCast[^}]*\} from '\.\.\/systems\/mysticism\.js'/.test(hm),
    'the engine imports the gate');

  const castFn = hm.slice(hm.indexOf('function castInput'));
  const castBody = castFn.slice(0, castFn.indexOf('\n  }\n'));
  assert.ok(/silenceBlocksCast\(playerEntity\)/.test(castBody), 'the CAST gate');
  assert.ok(/readiedSpell = null/.test(castBody), 'and it clears the readied spell');

  const readyFn = hm.slice(hm.indexOf('function readySpell'));
  const readyBody = readyFn.slice(0, readyFn.indexOf('\n  }\n'));
  assert.ok(/silenceBlocksCast\(playerEntity\)/.test(readyBody), 'the READY gate');
  assert.ok(/readiedSpell = null/.test(readyBody), 'and it clears too');
});

test('S27: THE FOUR HOSTS - every host mounts the ONE cast engine', () => {
  // This pin used to assert the OPPOSITE ("casting is dungeon-only...
  // if an exterior host EVER grows a cast path, this fails and sends
  // the author to the gate"). The M slice is that author: spellcasting
  // went above ground THROUGH the shared engine, so the silence gates
  // ride along by construction - one implementation, four hosts.
  for (const host of ['src/scenes/exterior.js', 'src/scenes/world.js', 'src/scenes/dungeonContext.js']) {
    const src = read(host);
    assert.ok(/createPlayerMagic\(\{/.test(src), `${host} mounts the engine`);
  }
  const wm = read('src/scenes/worldModes.js');
  assert.ok(/magic\.readySpell\(sp\)/.test(wm), 'the interior arm readies through the engine');
  assert.ok(/magic\.castInput\(/.test(wm), 'and casts through it');
  // and worldModes is still the ROUTER for the dungeon context
  assert.ok(/buildDungeonContext/.test(wm), 'worldModes mounts the dungeon context');
});

test('S27: Open and Lock are NOT wired, and the seams are named', () => {
  // Flagged deliberately: their payload is an ARMED effect that must
  // survive between the cast and the next door touched. This pin holds
  // the claim honest - it fails the moment someone wires one without
  // updating the record.
  const my = read('src/systems/mysticism.js');
  assert.ok(/OPEN AND LOCK ARE NOT WIRED/.test(my), 'the module says so');
  assert.ok(/actionSystem\.js's `activate\(key\)`/.test(my), 'and names the door seam');
  assert.ok(/interiorContext\.js/.test(my), 'and both ActionSystem owners');

  for (const host of ['src/scenes/dungeonContext.js', 'src/scenes/interiorContext.js']) {
    assert.ok(!/triggerOpen\(|triggerLock\(/.test(read(host)),
      `${host} does not call the door payload yet - update the record when it does`);
  }
});
