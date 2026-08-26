// S26: Mysticism, the effect library's one entirely empty school.
// These effects do not fit the "roll a magnitude and apply it" shape
// the rest of the library grew around - not one of the ten supports
// magnitude - so almost every pin here is about a payload rule rather
// than a number.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MYSTICISM_EFFECTS, SUPPORTS_MAGNITUDE, isMysticism,
  triggerOpen, triggerLock, triggerExteriorOpen, dispelNearby, SOUL_TRAP_TEMPLATE,
  dispellableBundles, DISPELLABLE_BUNDLE_TYPES, fillEmptyTrap,
  isSilenced, silenceBlocksCast, DOOR_SPELL_TEXT,
} from '../src/systems/mysticism.js';
import { ActionSystem } from '../src/world/actionSystem.js';
import { doorSpellFor, wireDoorSpells } from '../src/scenes/shared.js';

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
  const star = { azurasStar: true, trappedSoulType: null };
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
  // U42: the classic spellbook hands the ready callback DFU's own
  // noSpellPointCost flag (the lycanthropy free cast), so the call
  // carries a second argument now - still the ONE engine.
  assert.ok(/magic\.readySpell\(sp, \{ free:/.test(wm), 'the interior arm readies through the engine');
  assert.ok(/magic\?\.interceptAttack\(/.test(wm), 'and casts through it (I2: the attack click, not a cast key)');
  // and worldModes is still the ROUTER for the dungeon context
  assert.ok(/buildDungeonContext/.test(wm), 'worldModes mounts the dungeon context');
});

// ── X1/S30: the Open/Lock door seam, driven end to end ───────────
// The hosts above have no execution coverage in node, but the DOOR
// path does: ActionSystem is plain JS and shared.js's doorSpellFor /
// wireDoorSpells are the very helpers the hosts mount, so the law can
// be reached the way the player reaches it instead of being grepped for.
const stubCollider = () => ({ addMesh() {}, removeMesh() {}, removeBucket() {} });
const CPU = { positions: new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0]), indices: new Uint32Array([0, 1, 2]) };
const IDENTITY = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

/** An entity holding an armed Open/Lock entry, exactly as applySpell
 *  lands it (kind + permanent, never expiring on its own). */
const armed = (kind, level) => ({
  level, activeEffects: kind ? [{ kind, permanent: true }] : [],
});

/** One ActionSystem with one door, wired the way a host wires it. */
function doorHost(entity, opts = {}) {
  const actions = new ActionSystem(stubCollider());
  const o = actions.addDoor(CPU, IDENTITY, opts);
  const said = [];
  wireDoorSpells(actions, entity, (t) => said.push(t));
  return { actions, o, said };
}

/** Every .js under a directory, so a sweep names no file itself. */
function sourceFiles(dir) {
  const out = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, ent.name);
    if (ent.isDirectory()) out.push(...sourceFiles(full));
    else if (ent.name.endsWith('.js')) out.push(full);
  }
  return out;
}

test('X1: Open and Lock ARE wired - the armed spell fires through actions.activate', () => {
  // This pin replaces an S27 guard that could not fire. That guard
  // grepped two named hosts for the spelling `triggerOpen(` and
  // asserted the module still said OPEN AND LOCK ARE NOT WIRED; X1
  // wired the laws into world/actionSystem.js's `activate(key,
  // { doorSpell })` instead, which neither named file spells, so the
  // guard passed through the very change it existed to catch - and
  // its second half held a now-false header in place. A grep for a
  // name proves the name is there; this drives the real seam:
  //   cast -> `openArmed`/`lockArmed` on activeEffects (effects.js)
  //   -> doorSpellFor (scenes/shared.js) -> actions.activate
  //   -> triggerOpen/triggerLock -> ToggleDoor + onDoorSpell
  //   -> consumeDoorSpell (CancelEffect).
  // It is DFU's ActivateActionDoor (PlayerActivate.cs:691-704), whose
  // HandleLockEffect/HandleOpenEffect run BEFORE the steal/toggle
  // ladder and swallow the activation.

  // a caster of level 7 with an Open armed, meeting a lock of 5
  const e = armed('openArmed', 7);
  const { actions, o, said } = doorHost(e, { startingLockValue: 5 });
  assert.equal(actions.activate(o.key, { doorSpell: doorSpellFor(e) }), true);
  assert.equal(o.currentLockValue, 0, 'CurrentLockValue = 0 (Open.cs:118-121)');
  assert.equal(o.state, 'forward', 'and the unlocked, closed door is swung (Open.cs:128-132)');
  assert.deepEqual(said, [], 'a lock that yields says nothing');
  assert.equal(doorSpellFor(e), null, 'CancelEffect on the trigger (Open.cs:135)');

  // the SAME door, the SAME lock, with nothing armed: the activation
  // falls through to ToggleDoor, which refuses a locked door. This is
  // the control - it is what the seam does when the law is not reached.
  const bare = doorHost(armed(null, 7), { startingLockValue: 5 });
  bare.actions.activate(bare.o.key, { doorSpell: null });
  assert.equal(bare.o.currentLockValue, 5, 'no spell, no unlock');
  assert.equal(bare.o.state, 'start', 'and the door stays shut');

  // a lock BEYOND the holder's level spends the cast and speaks
  const weak = armed('openArmed', 3);
  const w = doorHost(weak, { startingLockValue: 20 });
  w.actions.activate(w.o.key, { doorSpell: doorSpellFor(weak) });
  assert.equal(w.o.currentLockValue, 20, 'the lock is untouched');
  assert.equal(w.o.state, 'start');
  assert.deepEqual(w.said, [DOOR_SPELL_TEXT.openFailed], 'openFailed (Open.cs:124)');
  assert.equal(doorSpellFor(weak), null, 'and the cast is spent anyway (:135)');

  // the level travels LIVE: the same entity, levelled between the cast
  // and the door, now beats the lock (Open.cs:118 reads the HOLDER's
  // Entity.Level at the trigger)
  const grown = armed('openArmed', 3);
  const g = doorHost(grown, { startingLockValue: 20 });
  grown.level = 20;
  g.actions.activate(g.o.key, { doorSpell: doorSpellFor(grown) });
  assert.equal(g.o.currentLockValue, 0, 'the level read at the door is the one that counts');

  // LOCK: no level test at all, and it swings an OPEN door shut
  const locker = armed('lockArmed', 9);
  const l = doorHost(locker, { startingLockValue: 0 });
  l.actions.activate(l.o.key, { doorSpell: null });          // open it first
  assert.equal(l.o.state, 'forward');
  for (let i = 0; i < 100; i++) l.actions.update(1.5 / 90);  // let the swing finish
  assert.equal(l.o.state, 'end');
  l.actions.activate(l.o.key, { doorSpell: doorSpellFor(locker) });
  assert.equal(l.o.currentLockValue, 9, "the holder's own level becomes the lock (Lock.cs:116)");
  assert.equal(l.o.state, 'reverse', 'and an open door is closed (Lock.cs:122-126)');
  assert.deepEqual(l.said, [DOOR_SPELL_TEXT.doorLocked]);
  assert.equal(doorSpellFor(locker), null);

  // an ALREADY-locked door refuses the Lock, and still spends it
  const again = armed('lockArmed', 9);
  const a = doorHost(again, { startingLockValue: 3 });
  a.actions.activate(a.o.key, { doorSpell: doorSpellFor(again) });
  assert.equal(a.o.currentLockValue, 3, 'refused, not re-locked harder');
  assert.deepEqual(a.said, [DOOR_SPELL_TEXT.doorAlreadyLocked]);
  assert.equal(doorSpellFor(again), null);

  // a SPECIAL door has no DaggerfallActionDoor component, so no
  // Lock/Open effect reaches it ("player cannot open, bash, pick, or
  // cast their way through this type of door")
  const sk = armed('openArmed', 99);
  const s = doorHost(sk, { startingLockValue: 5 });
  s.o.special = true;
  s.actions.activate(s.o.key, { doorSpell: doorSpellFor(sk) });
  assert.equal(s.o.currentLockValue, 5, 'a special door is not cast through');
  assert.deepEqual(doorSpellFor(sk), { kind: 'open', holderLevel: 99, skeletonKey: false },
    'and the spell is still armed, waiting for a real door');
});

test('X1: every player activation seam in src/ hands the armed spell down', () => {
  // The seam, not a file list: whichever host owns the activation ray
  // routes the interaction MODE into actions.activate, and the armed
  // door spell has to ride the same call (DFU runs HandleLockEffect/
  // HandleOpenEffect inside ActivateActionDoor itself, so there is no
  // host that can activate a door and miss them). Found by reading
  // src/, so a host that moves or is added is swept too.
  const sites = [];
  for (const f of sourceFiles(join(root, 'src'))) {
    for (const line of readFileSync(f, 'utf8').split('\n')) {
      if (/\.activate\(/.test(line) && /steal:/.test(line)) sites.push([f, line]);
    }
  }
  assert.ok(sites.length >= 2, `expected the interior and dungeon activation seams, found ${sites.length}`);
  for (const [f, line] of sites) {
    assert.ok(/doorSpell:/.test(line),
      `${f.slice(root.length + 1)} activates doors without handing down the armed Open/Lock spell: ${line.trim()}`);
  }
});
