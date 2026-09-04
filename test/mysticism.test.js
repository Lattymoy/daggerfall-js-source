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
  triggerOpen, triggerLock, triggerExteriorOpen, dispelNearby, SOUL_TRAP_TEMPLATE,
  dispellableBundles, DISPELLABLE_BUNDLE_TYPES, fillEmptyTrap,
  isSilenced, silenceBlocksCast, castBySkeletonKey,
} from '../src/systems/mysticism.js';
import {
  artifactTextureIndices, ARTIFACT_TEXTURE_INDEX_MAPPINGS,
  ARTIFACT_MALE_TEXTURE_ARCHIVE, ARTIFACT_FEMALE_TEXTURE_ARCHIVE,
} from '../src/systems/loot.js';
import { applySpell } from '../src/systems/effects.js';
import { doorSpellFor } from '../src/scenes/shared.js';

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

test('X3 mysticism: Open on an EXTERIOR building door is a DIFFERENT rule (Open.cs:146-161)', () => {
  // The building has no door record to unlock, only a lock VALUE, and
  // the test is a strict `Level < value` failure - so level EQUAL to
  // the value succeeds, matching the interior arm's <= from the other
  // side of the inequality.
  assert.deepEqual(triggerExteriorOpen(10, 9), { opened: false, alert: 'openFailed' });
  assert.deepEqual(triggerExteriorOpen(10, 10), { opened: true, alert: null });
  assert.deepEqual(triggerExteriorOpen(10, 11), { opened: true, alert: null });
  // an unlocked building (value 0) opens at any level
  assert.equal(triggerExteriorOpen(0, 1).opened, true);
  // and there is NO Skeleton's Key exemption out here - DFU's comment
  // is explicit ("the player's level is always checked, even for the
  // Skeleton Key"), which is why this function takes no options at all
  assert.equal(triggerExteriorOpen.length, 2);
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
  // X5: these were {name: 'Soul trap'} fixtures built to match a
  // default predicate that could never fire on a REAL item - the
  // port's items are {group, templateIndex} records carrying no
  // `name`, and the template's own name is "Soul Trap". Now they are
  // real records, matched the way DFU matches them (group + index).
  // ROAD-U: ...and the STAR's fixture was the same mistake one item
  // over - `{ azurasStar: true }` matched a boolean only the port's
  // own mint wrote, so a Star imported from a classic save (or any
  // Star DFU would recognise) fell straight through. SoulTrap.cs:129
  // asks the ITEM: ContainsEnchantment(SpecialArtifactEffect,
  // Azuras_Star = 9).
  const star = { enchantments: [{ type: 26, param: 9 }], trappedSoulType: null };
  const gem1 = { group: 'MiscItems', templateIndex: SOUL_TRAP_TEMPLATE, trappedSoulType: null };
  const gem2 = { group: 'MiscItems', templateIndex: SOUL_TRAP_TEMPLATE, trappedSoulType: null };
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
  const gem = { group: 'MiscItems', templateIndex: SOUL_TRAP_TEMPLATE, trappedSoulType: null };
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
  // U42: the spellbook hands the ready callback DFU's own
  // noSpellPointCost flag (the lycanthropy free cast), so the call
  // carries a second argument - still the ONE engine.
  //
  // PX23: and that call moved ONE FILE. Four hosts built the book
  // identically, so the build went into ui/spellbookDoor.js and took
  // the readySpell arm with it. The law is unchanged and is pinned
  // where it now lives; what each host must still do is HAND THE
  // ENGINE to the door, which is the thing that could actually be
  // dropped.
  const door = read('src/ui/spellbookDoor.js');
  assert.ok(/magic\?\.readySpell\?\.\(sp, \{ free: !!noSpellPointCost \}\)/.test(door),
    'the door readies through the engine');
  for (const host of ['src/scenes/exterior.js', 'src/scenes/world.js', 'src/scenes/dungeonContext.js', 'src/scenes/worldModes.js']) {
    const src = read(host);
    const call = src.slice(src.indexOf('createSpellbookWindow({'), src.indexOf('createSpellbookWindow({') + 320);
    assert.ok(/\bmagic,/.test(call), `${host} hands the engine to the door`);
  }
  assert.ok(wm.includes('createSpellbookWindow({'), 'the interior arm takes the door');
  assert.ok(/magic\?\.interceptAttack\(/.test(wm), 'and casts through it (I2: the attack click, not a cast key)');
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


// ---------------------------------------------------------------
// D9 - THE SKELETON'S KEY. Open.CheckCastByItem (Open.cs:172-181)
// identifies it by the artifact texture indices SetArtifact writes
// (DaggerfallUnityItem.cs:608-611 from ItemHelper.GetArtifactTexture-
// Indices :519-523), and TriggerOpenEffect then skips the level test.
// The port had the law and neither of its two inputs.
// ---------------------------------------------------------------

test('D9: GetArtifactTextureIndices - the gender archive and the mapping row', () => {
  assert.equal(ARTIFACT_MALE_TEXTURE_ARCHIVE, 432, 'ItemHelper.cs:50');
  assert.equal(ARTIFACT_FEMALE_TEXTURE_ARCHIVE, 433, ':51');
  assert.deepEqual([...ARTIFACT_TEXTURE_INDEX_MAPPINGS],
    [12, 13, 10, 8, 19, 16, 25, 18, 21, 2, 24, 26, 0, 15, 3, 9, 23, 17, 7, 1, 22, 20, 5],
    'ItemHelper.cs:43, digit for digit');
  // Skeletons_Key is ArtifactsSubTypes 21 (ItemEnums.cs:262) and its
  // mapping row is 20 - the record Open.cs tests for.
  assert.deepEqual(artifactTextureIndices(21, 'male'), { archive: 432, record: 20 });
  assert.deepEqual(artifactTextureIndices(21, 'female'), { archive: 433, record: 20 });
  assert.deepEqual(artifactTextureIndices(12, 'male'), { archive: 432, record: 0 });
});

test('D9: castBySkeletonKey is all four terms - and a female character\'s key is not one', () => {
  const key = { artifact: true, worldTextureArchive: 432, worldTextureRecord: 20 };
  assert.equal(castBySkeletonKey(key), true);
  assert.equal(castBySkeletonKey(null), false, 'no casting item at all');
  assert.equal(castBySkeletonKey({ ...key, artifact: false }), false, 'IsArtifact');
  assert.equal(castBySkeletonKey({ ...key, worldTextureArchive: 433 }), false,
    'archive 433 is the FEMALE artifact archive - DFU\'s test is 432 only, quirk kept');
  assert.equal(castBySkeletonKey({ ...key, worldTextureRecord: 21 }), false, 'and the record is the subtype row');
});

test('D9: the used item rides the armed bundle, and the key opens above the holder\'s level', () => {
  const openSpell = { effects: [{ type: 17, subType: 255 }], element: 0, rangeType: 0 };
  const key = { artifact: true, worldTextureArchive: 432, worldTextureRecord: 20 };
  const arm = (castByItem) => {
    const e = { level: 3, activeEffects: [] };
    applySpell(openSpell, 3, e, {}, () => 0, { entity: e },
      { bypassSavingThrows: true, bypassChance: true, castByItem });
    return e;
  };
  // a plain cast: no casting item, so no key
  const plain = doorSpellFor(arm(null));
  assert.equal(plain.kind, 'open');
  assert.equal(plain.skeletonKey, false);
  const locked = door(9);
  assert.deepEqual(triggerOpen(locked, plain.holderLevel, { castBySkeletonKey: plain.skeletonKey }),
    { unlocked: false, opened: false, alert: 'openFailed' }, 'lock 9 over level 3 refuses');

  // the SAME spell, cast by using the Skeleton's Key
  const withKey = doorSpellFor(arm(key));
  assert.equal(withKey.skeletonKey, true, 'CastByItem reached the armed entry');
  const locked2 = door(9);
  assert.deepEqual(triggerOpen(locked2, withKey.holderLevel, { castBySkeletonKey: withKey.skeletonKey }),
    { unlocked: true, opened: true, alert: null }, '"Skeleton\'s Key can open even magical locks"');
  assert.equal(locked2.currentLockValue, 0);

  // and any OTHER used artifact is still just a cast
  const other = doorSpellFor(arm({ artifact: true, worldTextureArchive: 432, worldTextureRecord: 12 }));
  assert.equal(other.skeletonKey, false);
});
