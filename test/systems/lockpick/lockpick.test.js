// LOCKPICK (2026-10-26, bible/06-Systems/Lockpicking.md): THE LOCKPICKING MINIGAME AND THE LOCKPICK - the tumblers' law by
// value, the machine played (a clean hand, a slip, a snap, a free pin forced, a spool's false set, the Auto attempt), the
// Lockpick as the producers mint it (its row, the item law headless, the counter's endless stack, the kit and the gift, a
// rogue's pockets), the host's one home (no pick, a snap, the last snap, an open, a dispose), the window's pure geometry
// and its words, the ear, the picture, and every site that rolled the pick now playing it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LOCKPICK_ACT, LOCK_PINS_MIN, LOCK_PINS_MAX, LOCK_PINS_STEP, SPOOL_ONE, SPOOL_TWO, pinsFor, spoolsFor, setWindowS,
  slipBreakChance, lockBand, sensesBinding, lockSeed, bindingOrder, spoolPins, autoOpens,
} from '../../../src/systems/lockpick/lockpickLaw.js';
import { createLockpickAct, PIN } from '../../../src/systems/lockpick/lockpickAct.js';
import { LOCKPICK_TEMPLATE, LOCKPICK_LAW_ROW } from '../../../src/systems/lockpick/lockpickRow.js';
import {
  LOCKPICK_ROW, ENDLESS_LOCKPICK_STACK, LOCKPICK_KIT, LOCKPICK_GIFT, ROGUE_LOCKPICKS, isLockpick, lockpicks, lockpickCount,
  spendLockpick, careerPicksLocks, giveStartingLockpicks, giveLockpickGift, rogueLockpicks, ensureEndlessLockpicks, LOCKPICK_TEXT,
} from '../../../src/systems/lockpick/lockpickItem.js';
import { LOCKPICK_ART, LOCKPICK_ARCHIVE, LOCKPICK_ART_SIZE, lockpickArt, lockpickTexel } from '../../../src/systems/lockpick/lockpickArt.js';
import { LOCK_SFX, LOCK_SFX_FILES, LOCK_CUES, LOCK_CLASSIC_CUES, createLockEar } from '../../../src/systems/lockpick/lockpickSounds.js';
import { createLockpickHost, OPEN_HOLD_MS, LOCKPICK_HOST_WORDS } from '../../../src/scenes/lockpickHost.js';
import { LOCK_W, LOCK_GEOM, chamberX, chamberAt, keyLength, LOCK_WORDS } from '../../../src/ui/lockpickWindow.js';
import { templateByIndex, itemUseHandler } from '../../../src/systems/item/itemTemplates.js';
import { lawTemplate } from '../../../src/systems/item/itemLaw.js';
import { interiorLockpickingChance, exteriorLockpickingChance, ActionSystem, MAGIC_LOCK_THRESHOLD } from '../../../src/world/actionSystem.js';
import { restockEndless, isEndlessStock } from '../../../src/systems/shopStock.js';
import { ENEMY_BASICS } from '../../../src/characters/enemy/enemyBasics.js';
import { MOBILE_TYPES } from '../../../src/characters/mobile/mobileTypes.js';
import { SKILLS } from '../../../src/systems/skills.js';
import { SOUND } from '../../../src/systems/soundClips.js';
import { PSEUDO_ARCHIVES } from '../../../src/world/eliteGates/pseudoArchives.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const src = (p) => readFileSync(join(ROOT, p), 'utf8');
/** A stream of the given rolls, then the last forever. */
const seq = (...xs) => { let i = 0; return () => xs[Math.min(i++, xs.length - 1)]; };

// ---------------------------------------------------------------------------------------------------------------------
// THE LAW
// ---------------------------------------------------------------------------------------------------------------------

test('LOCKPICK law: the act\'s numbers by value, the pins and spools a lock is built of, its window and its snap', () => {
  assert.deepEqual({ ...LOCKPICK_ACT }, {
    riseS: 0.2, riseJitter: 0.45, fallS: 0.32, springS: 0.22, graceS: 0.03, windowMinS: 0.08, windowMaxS: 0.6,   // PIN MOVED (AUDIT LOCKPICK A2): the rise's spread outspans the 5% hang
    breakScale: 0.55, breakMin: 0.04, breakMax: 0.6, freeRisk: 0.35, senseSkill: 50,
  });
  assert.deepEqual([LOCK_PINS_MIN, LOCK_PINS_MAX, LOCK_PINS_STEP, SPOOL_ONE, SPOOL_TWO], [2, 6, 4, 8, 14]);
  assert.deepEqual([0, 1, 3, 4, 7, 8, 11, 12, 15, 16, 18, 19, 40].map(pinsFor), [2, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 6, 6]);
  assert.deepEqual([0, 7, 8, 13, 14, 19].map(spoolsFor), [0, 0, 1, 1, 2, 2]);
  assert.equal(pinsFor(-3), 2, 'never under two'); assert.equal(pinsFor(NaN), 2);
  assert.ok(Math.abs(setWindowS(5) - 0.08) < 1e-12); assert.ok(Math.abs(setWindowS(50) - 0.34) < 1e-12); assert.ok(Math.abs(setWindowS(95) - 0.6) < 1e-12);
  assert.ok(Math.abs(setWindowS(50, 1.3) - 0.442) < 1e-12, 'the Agility band widens it');
  assert.ok(Math.abs(setWindowS(200) - 0.6) < 1e-12 && Math.abs(setWindowS(-10) - 0.08) < 1e-12, 'DFU\'s 5..95 holds it');
  assert.ok(Math.abs(slipBreakChance(5) - 0.5225) < 1e-12); assert.ok(Math.abs(slipBreakChance(50) - 0.275) < 1e-12);
  assert.equal(slipBreakChance(95), 0.04, 'the floor'); assert.equal(lockBand(85), 1.3); assert.equal(lockBand(30), 0.85);
  assert.equal(sensesBinding(49), false); assert.equal(sensesBinding(50), true);
});

test('LOCKPICK law: a lock binds in its own order, the same every visit; its spools are never the first to bind', () => {
  for (const key of ['door:12:7', 'building:5:3', 'chest-a', 'x']) {
    const seed = lockSeed(key);
    assert.equal(seed, lockSeed(key), 'the seed is the name\'s');
    for (let n = 2; n <= 6; n++) {
      const order = bindingOrder(n, seed);
      assert.deepEqual([...order].sort(), Array.from({ length: n }, (_, i) => i), 'a permutation');
      assert.deepEqual(order, bindingOrder(n, seed));
      for (let k = 0; k <= 2; k++) {
        const sp = spoolPins(n, k, seed);
        assert.equal(sp.filter(Boolean).length, Math.min(k, n - 1));
        assert.equal(sp[order[0]], false, 'the first pin to bind is plain');
      }
    }
  }
  assert.notDeepEqual(bindingOrder(6, lockSeed('a')), bindingOrder(6, lockSeed('b')), 'two locks bind their own ways');
  assert.equal(lockSeed(''), 0x811c9dc5, 'FNV-1a\'s offset for nothing');
});

test('LOCKPICK law: the Auto attempt is DFU\'s roll, each site\'s - underground Range(0,100) < chance, a front door chance > Range(1,101)', () => {
  assert.equal(autoOpens(35, 0.34), true); assert.equal(autoOpens(35, 0.35), false, 'Dice100.FailedRoll: 35 >= 35 fails');
  assert.equal(autoOpens(35, 0.33, true), true); assert.equal(autoOpens(35, 0.34, true), false, '35 > 35 is no success');
  assert.equal(autoOpens(-50, 0.04), true, 'the 5 floor'); assert.equal(autoOpens(500, 0.94), true); assert.equal(autoOpens(500, 0.95), false, 'the 95 ceiling');
});

// ---------------------------------------------------------------------------------------------------------------------
// THE MACHINE
// ---------------------------------------------------------------------------------------------------------------------

/** Lift the binding pin and set it at the middle of its hang - a clean hand. Answers the set's answer. */
function cleanSet(act) {
  act.aim(act.binding);
  assert.equal(act.press(), 'lift');
  const p = act.state.pins[act.binding];
  for (let t = 0, want = p.rise + act.state.window / 2; t < want - 1e-12; t += 0.05) act.tick(Math.min(0.05, want - t));   // a step is held to 0.25 s
  assert.equal(p.phase, PIN.hang);
  return act.press();
}

test('LOCKPICK act: a clean hand sets every pin in the lock\'s order, a spool twice, and the last set opens it', () => {
  const lock = 16, seed = lockSeed('door:1:2');
  const act = createLockpickAct({ lock, chance: 40, seed, rng: () => 0.5 });
  const st = act.state;
  assert.equal(st.n, 6); assert.deepEqual(st.order, bindingOrder(6, seed)); assert.equal(st.pins.filter((p) => p.spool).length, 2);
  const answers = [];
  let guard = 0;
  while (!st.open && guard++ < 20) answers.push(cleanSet(act));
  assert.equal(st.open, true); assert.equal(st.done, true);
  assert.equal(answers.filter((a) => a === 'false-set').length, 2, 'each spool false-sets once');
  assert.equal(answers.at(-1), 'open'); assert.equal(st.sets, 6); assert.deepEqual(act.report(), { open: true, broken: 0, sets: 6, slips: 0 });
  assert.equal(act.press(), null, 'an open lock takes no press'); assert.equal(act.auto(), null);
});

test('LOCKPICK act: a press off the hang slips - the pick holds and the last pin set drops, or it snaps and every pin drops', () => {
  const seed = lockSeed('slip');
  const act = createLockpickAct({ lock: 4, chance: 50, seed, rng: () => 0.99 });   // 3 pins; a roll of 0.99 never snaps
  assert.equal(cleanSet(act), 'set');
  const first = act.state.order[0], second = act.binding;
  act.aim(second); assert.equal(act.press(), 'lift');
  act.tick(0.02);   // early in the rise, before the grace
  assert.equal(act.press(), 'slip');
  assert.equal(act.state.pins[first].phase, PIN.rest, 'the last pin set dropped'); assert.equal(act.state.next, 0);
  assert.equal(act.state.slips, 1); assert.equal(act.state.broken, 0);
  // the grace: the rise's last 30 ms sets
  assert.equal(cleanSet(act), 'set');
  act.aim(act.binding); act.press();
  const into = act.state.pins[act.binding].rise - LOCKPICK_ACT.graceS + 0.001;
  act.tick(into / 2); act.tick(into / 2);   // a step is held to 0.25 s
  assert.equal(act.state.pins[act.binding].phase, PIN.rise);
  assert.equal(act.press(), 'set', 'within the grace of the hang');
  // a snap: a roll under the slip's chance
  const snap = createLockpickAct({ lock: 4, chance: 50, seed, rng: seq(0.5, 0.5, 0.0) });
  assert.equal(cleanSet(snap), 'set');
  snap.aim(snap.binding); snap.press(); snap.tick(0.01);
  assert.equal(snap.press(), 'break');
  assert.equal(snap.state.broken, 1); assert.equal(snap.state.next, 0); assert.ok(snap.state.pins.every((p) => p.phase === PIN.rest), 'every pin down');
  assert.equal(snap.state.done, false, 'a fresh pick goes on');
});

test('LOCKPICK act: a free pin springs and never hangs - forcing it may snap the pick; a set pin answers it is set', () => {
  const seed = lockSeed('free'), order = bindingOrder(3, seed);
  const free = [0, 1, 2].find((i) => i !== order[0]);
  const ok = createLockpickAct({ lock: 4, chance: 50, seed, rng: () => 0.99 });
  ok.aim(free);
  assert.equal(ok.press(), 'springy'); assert.equal(ok.state.pins[free].phase, PIN.spring);
  ok.tick(0.05);
  assert.equal(ok.press(), 'slip', 'a press on a free pin mid-bounce slips');
  ok.aim(free); ok.press(); ok.tick(LOCKPICK_ACT.springS + 0.01);
  assert.equal(ok.state.pins[free].phase, PIN.rest, 'it lands, never hanging');
  // forced: under a third of a slip's chance (0.275 x 0.35 = 0.096)
  const forced = createLockpickAct({ lock: 4, chance: 50, seed, rng: () => 0.09 });
  forced.aim(free);
  assert.equal(forced.press(), 'break'); assert.equal(forced.state.broken, 1);
  const spared = createLockpickAct({ lock: 4, chance: 50, seed, rng: () => 0.1 });
  spared.aim(free);
  assert.equal(spared.press(), 'springy');
  assert.equal(cleanSet(ok), 'set'); ok.aim(order[0]);
  assert.equal(ok.press(), 'already');
});

test('LOCKPICK act: the binding pin\'s rise is each lift\'s own, its window DFU\'s chance; a spool slipped loses its false set', () => {
  const lo = createLockpickAct({ lock: 1, chance: 5, seed: 9, rng: () => 0 });
  lo.aim(lo.binding); lo.press();
  assert.ok(Math.abs(lo.state.pins[lo.binding].rise - 0.2 * 0.55) < 1e-12, 'the quickest rise');
  const hi = createLockpickAct({ lock: 1, chance: 5, seed: 9, rng: () => 0.999999 });
  hi.aim(hi.binding); hi.press();
  assert.ok(hi.state.pins[hi.binding].rise > 0.2 * 1.44, 'the slowest');
  assert.ok(Math.abs(lo.state.window - 0.08) < 1e-12);
  assert.ok(Math.abs(createLockpickAct({ lock: 1, chance: 95, seed: 9, band: 1.15 }).state.window - 0.69) < 1e-12);
  // a spool false-set, then a slip: its false set is lost with the tension
  const seed = lockSeed('spool-slip');
  const act = createLockpickAct({ lock: 8, chance: 60, seed, rng: () => 0.99 });   // 4 pins, 1 spool
  const spoolAt = act.state.order.findIndex((i) => act.state.pins[i].spool);
  for (let k = 0; k < spoolAt; k++) assert.equal(cleanSet(act), 'set');
  assert.equal(cleanSet(act), 'false-set'); assert.equal(act.state.pins[act.binding].falseSet, true);
  act.aim(act.binding); act.press(); act.tick(0.01);
  assert.equal(act.press(), 'slip');
  assert.ok(act.state.pins.every((p) => !p.falseSet), 'no false set survives a slip');
});

test('LOCKPICK act: the Auto attempt opens on DFU\'s roll or snaps the pick; moves stay on the lock; a cancel ends it', () => {
  const win = createLockpickAct({ lock: 6, chance: 40, seed: 3, rng: () => 0.39 });
  assert.equal(win.auto(), 'open'); assert.equal(win.state.open, true); assert.ok(win.state.pins.every((p) => p.phase === PIN.set));
  const lose = createLockpickAct({ lock: 6, chance: 40, seed: 3, rng: () => 0.4 });
  assert.equal(lose.auto(), 'break'); assert.equal(lose.state.broken, 1); assert.equal(lose.state.done, false);
  const door = createLockpickAct({ lock: 6, chance: 40, seed: 3, exterior: true, rng: () => 0.39 });
  assert.equal(door.auto(), 'break', 'a front door\'s roll: 1 + 39 is not under 40');
  const m = createLockpickAct({ lock: 6, chance: 40, seed: 3, rng: () => 0.5 });   // the mean rise (0.2 s): one held step reaches the hang
  assert.equal(m.move(-1), 0); assert.equal(m.move(5), 1); m.aim(2); assert.equal(m.state.pos, 2); m.aim(9); assert.equal(m.state.pos, 2);
  m.aim(m.binding); m.press(); m.tick(10); assert.equal(m.state.pins[m.binding].phase, PIN.hang, 'a frame\'s step is held to a quarter second');
  m.cancel(); assert.equal(m.press(), null); assert.equal(m.auto(), null);
});

// ---------------------------------------------------------------------------------------------------------------------
// THE LOCKPICK
// ---------------------------------------------------------------------------------------------------------------------

test('LOCKPICK item: its row registered and known headless, a stack of steel and leather on its own picture', () => {
  assert.equal(LOCKPICK_TEMPLATE, 584);
  assert.deepEqual({ ...LOCKPICK_LAW_ROW }, { index: 584, baseWeight: 0.05, hitPoints: 100, basePrice: 12, rarity: 20, stackable: true });
  const t = templateByIndex(LOCKPICK_TEMPLATE);
  assert.equal(t.name, 'Lockpick'); assert.equal(t.stackable, true); assert.equal(t.weight, 0.05);
  assert.equal(t.worldTexArchive, LOCKPICK_ARCHIVE); assert.equal(LOCKPICK_ROW.worldTextureRecord, 0);
  assert.equal(lawTemplate(LOCKPICK_TEMPLATE)?.index, 584, 'the item law knows it');
  assert.ok(src('src/systems/item/itemLaw.js').includes('STARGLASS_LAW_ROW, LOCKPICK_LAW_ROW]'), 'beside the registry from its leaf, as the service reads it');
  const it = lockpicks(3);
  assert.equal(isLockpick(it), true); assert.equal(it.group, 'UselessItems2'); assert.equal(it.stackCount, 3);
  assert.equal(isLockpick({ ...it, group: 'Gems' }), false);
  assert.equal(lockpicks(0).stackCount, 1, 'one at the least');
  assert.deepEqual(itemUseHandler(LOCKPICK_TEMPLATE)?.(it), { kind: 'text', text: LOCKPICK_TEXT.use() });
  assert.equal(LOCKPICK_TEXT.card().length, 2);
  assert.ok(PSEUDO_ARCHIVES.some((r) => r.from === LOCKPICK_ARCHIVE && r.name === 'LOCKPICK_ARCHIVE'), 'its archive registered');
  const img = lockpickArt();
  assert.equal(img.width, LOCKPICK_ART_SIZE.w); assert.equal(img.height, LOCKPICK_ART_SIZE.h);
  let steel = 0, leather = 0, opaque = 0;
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
    const k = lockpickTexel(x, y); if (k === 'steel') steel++; if (k === 'leather') leather++;
    if (img.colors[(y * img.width + x) * 4 + 3]) opaque++;
  }
  assert.ok(steel > 30 && leather > 10, `a pick and a wrench, a grip (${steel} steel, ${leather} leather)`);
  assert.ok(opaque > steel + leather, 'an outline round them'); assert.equal(img.colors[3], 0, 'its ground clear');
  assert.deepEqual(lockpickArt().colors, img.colors, 'the same pixels every call');
  assert.equal(LOCKPICK_ART.archive, 38321);
});

test('LOCKPICK item: counted across stacks, spent one at a time; the counter\'s endless stack, refilled online as bought', () => {
  const entity = { items: [lockpicks(2), { group: 'UselessItems2', templateIndex: 1, stackCount: 9 }, lockpicks(1)] };
  assert.equal(lockpickCount(entity.items), 3); assert.equal(lockpickCount(null), 0);
  assert.equal(spendLockpick(entity), true); assert.equal(lockpickCount(entity.items), 2);
  spendLockpick(entity); spendLockpick(entity);
  assert.equal(lockpickCount(entity.items), 0); assert.equal(spendLockpick(entity), false);
  const shelf = ensureEndlessLockpicks([]);
  assert.equal(shelf.length, 1); assert.equal(shelf[0].stackCount, ENDLESS_LOCKPICK_STACK); assert.equal(ENDLESS_LOCKPICK_STACK, 25);
  shelf[0].stackCount = 3; ensureEndlessLockpicks(shelf);
  assert.equal(shelf[0].stackCount, 25, 'filled back whole'); assert.equal(shelf.length, 1);
  assert.equal(isEndlessStock(lockpicks(1)), true);
  const was = globalThis.location;
  try {
    globalThis.location = { search: '?online' };
    const counter = [lockpicks(4)];
    assert.equal(restockEndless(counter, [lockpicks(21)]), 1); assert.equal(counter[0].stackCount, 25);
    globalThis.location = { search: '' };
    const off = [lockpicks(4)];
    restockEndless(off, [lockpicks(21)]); assert.equal(off[0].stackCount, 4, 'offline it sells out until the day\'s restock');
  } finally { globalThis.location = was; }
  const SS = src('src/systems/shopStock.js');
  assert.match(SS, /if \(shelfIndex === 0 && \(buildingType === BUILDING_TYPES\.GeneralStore \|\| buildingType === BUILDING_TYPES\.PawnShop\)\) ensureEndlessLockpicks\(items\);/,
    'every General Store\'s and Pawn Shop\'s counter');
});

test('LOCKPICK item: a class that holds Lockpicking sets out with its picks, a character from before is given them once', () => {
  const thief = { items: [], career: { primarySkills: [SKILLS.Pickpocket], majorSkills: [SKILLS.Lockpicking], minorSkills: [] } };
  const minor = { items: [], career: { primarySkills: [], majorSkills: [], minorSkills: [SKILLS.Lockpicking] } };
  const knight = { items: [], career: { primarySkills: [SKILLS.LongBlade], majorSkills: [], minorSkills: [] } };
  assert.equal(careerPicksLocks(thief), true); assert.equal(careerPicksLocks(minor), true); assert.equal(careerPicksLocks(knight), false);
  assert.equal(careerPicksLocks({}), false);
  assert.equal(giveStartingLockpicks(knight), null); assert.equal(knight.items.length, 0);
  assert.equal(giveStartingLockpicks(thief).stackCount, LOCKPICK_KIT); assert.equal(LOCKPICK_KIT, 5);
  const old = { items: [], career: thief.career };
  assert.equal(giveLockpickGift(old), 5); assert.equal(old.lockpickGift, LOCKPICK_GIFT); assert.equal(lockpickCount(old.items), 5);
  assert.equal(giveLockpickGift(old), 0, 'once'); assert.equal(lockpickCount(old.items), 5);
  const oldKnight = { items: [], career: knight.career };
  assert.equal(giveLockpickGift(oldKnight), 0); assert.equal(oldKnight.lockpickGift, 1, 'marked all the same');
  assert.match(src('src/systems/startingGear.js'), /const picks = giveStartingLockpicks\(entity\);\n\s*if \(picks\) added\.push\(picks\);/);
  const S = src('src/systems/save/save.js');
  assert.ok(S.includes('snap.lockpickGift = Number.isSafeInteger(entity.lockpickGift) ? entity.lockpickGift : LOCKPICK_GIFT;'), 'a new character is born with it');
  assert.ok(S.includes('entity.lockpickGift = Number.isSafeInteger(snap.lockpickGift) ? snap.lockpickGift : 0;'), 'a save from before has had none');
  assert.ok(S.indexOf('giveLockpickGift(entity);') > S.indexOf('giveWalletGift(entity);'), 'given as the save is restored, at the pack\'s end');
});

test('LOCKPICK item: a rogue\'s pockets - a Burglar or a Thief more often than not, the rest now and then, none else', () => {
  assert.deepEqual(ROGUE_LOCKPICKS.map((r) => [...r]), [
    [MOBILE_TYPES.Burglar, 0.6, 3], [MOBILE_TYPES.Thief, 0.6, 3], [MOBILE_TYPES.Rogue, 0.3, 2], [MOBILE_TYPES.Nightblade, 0.25, 2],
    [MOBILE_TYPES.Acrobat, 0.25, 2], [MOBILE_TYPES.Assassin, 0.25, 2], [MOBILE_TYPES.Bard, 0.15, 1],
  ]);
  const items = [];
  assert.equal(rogueLockpicks(items, ENEMY_BASICS[MOBILE_TYPES.Thief], seq(0.59, 0.99)), 3); assert.equal(lockpickCount(items), 3);
  assert.equal(rogueLockpicks([], ENEMY_BASICS[MOBILE_TYPES.Thief], seq(0.6)), 0, 'at 60% and over, none');
  assert.equal(rogueLockpicks([], ENEMY_BASICS[MOBILE_TYPES.Burglar], seq(0, 0)), 1, 'one at the least');
  assert.equal(rogueLockpicks([], ENEMY_BASICS[MOBILE_TYPES.Bard], seq(0, 0.99)), 1, 'a Bard one at the most');
  assert.equal(rogueLockpicks([], ENEMY_BASICS[MOBILE_TYPES.Knight], seq(0, 0)), 0, 'a Knight carries none');
  assert.equal(rogueLockpicks([], ENEMY_BASICS[0], seq(0, 0)), 0, 'nor a rat');
});

// ---------------------------------------------------------------------------------------------------------------------
// THE HOST
// ---------------------------------------------------------------------------------------------------------------------

/** A host over a stand-in door: the window's deps kept, the slot's mounts and the host's words counted. */
function rig({ picks = 3, skill = 40, gentle = false } = {}) {
  const player = { items: picks ? [lockpicks(picks)] : [], level: 4, skills: new Array(35).fill(skill), skillUses: new Array(35).fill(0), stats: {} };
  const said = [], lines = [], mounted = [], sounds = [];
  let deps = null, outs = 0, disposed = 0, shut = 0;
  const host = createLockpickHost({
    player, mount: (w) => mounted.push(w), say: (l) => said.push(l), line: (l) => lines.push(l), changed: () => {},
    audio: { playOneShot: (k, v) => sounds.push([k, v]) }, gentle: () => gentle, reduced: () => false, rolls: () => 0.5,
    overlay: (d) => {
      deps = d;
      const end = (self) => { if (ov.done) return; ov.done = true; if (self) shut++; else disposed++; d.onClose(self); };   // the door's own close: `self` its own or the player's
      const ov = { done: false, out() { outs++; }, dispose() { end(false); }, shut() { end(true); } };
      return ov;
    },
  });
  return { host, player, said, lines, mounted, sounds, get deps() { return deps; }, get outs() { return outs; }, get disposed() { return disposed; }, get shut() { return shut; } };
}

test('LOCKPICK host: no pick and the lock says so - nothing opened, rolled, tallied or spent', () => {
  const r = rig({ picks: 0 });
  assert.equal(r.host.inside({ lock: 6, key: 'k' }), true, 'the press is spent');
  assert.deepEqual(r.said, [LOCKPICK_HOST_WORDS.need()]); assert.equal(r.mounted.length, 0); assert.equal(r.deps, null);
  // a locked searchable's own words, each whole - never an English name set into another language's sentence
  assert.deepEqual(['chest', 'crate', 'coffin'].map((k) => LOCKPICK_HOST_WORDS.container(k)), ['the chest', 'the crate', 'the chest']);
  assert.equal(r.player.skillUses[SKILLS.Lockpicking], 0);
});

test('LOCKPICK host: a snap spends a pick and tallies once; the last ends the attempt; an open tallies, shuts, then runs the tail', async () => {
  const r = rig({ picks: 2, skill: 40 });
  let opened = 0;
  r.host.inside({ lock: 6, key: 'door:1:9', what: 'the door', onOpen: () => opened++ });
  assert.equal(r.mounted.length, 1); assert.equal(r.host.busy, true);
  const d = r.deps;
  assert.equal(d.act.state.chance, interiorLockpickingChance(4, 6, 40), 'DFU\'s interior chance at the character\'s level');
  assert.equal(d.seed, lockSeed('door:1:9')); assert.equal(d.picks(), 2); assert.equal(d.skill, 40); assert.equal(d.what, 'the door');
  assert.equal(r.host.inside({ lock: 6, key: 'other' }), true); assert.equal(r.mounted.length, 1, 'one lock at a time');
  d.onAnswer('break');
  assert.equal(d.picks(), 1); assert.equal(r.player.skillUses[SKILLS.Lockpicking], 1); assert.equal(r.outs, 0);
  d.onAnswer('lift'); d.onAnswer('slip'); assert.equal(r.player.skillUses[SKILLS.Lockpicking], 1, 'a lift and a slip tally nothing');
  d.onAnswer('break');
  assert.equal(d.picks(), 0); assert.equal(r.outs, 1, 'the last pick gone: only Leave stays');
  assert.equal(opened, 0);
  // an open
  const o = rig({ picks: 1 });
  let tail = 0;
  o.host.inside({ lock: 2, key: 'chest', onOpen: () => tail++ });
  o.deps.onAnswer('open');
  assert.equal(o.player.skillUses[SKILLS.Lockpicking], 1); assert.equal(tail, 0, 'the plug is seen turning first');
  await new Promise((res) => setTimeout(res, OPEN_HOLD_MS + 40));
  assert.equal(o.shut, 1); assert.equal(tail, 1, 'shut, THEN the tail'); assert.equal(o.host.busy, false);
  assert.equal(o.player.items.length, 1, 'an open costs no pick');
  // a window left: no tail
  const l = rig();
  let left = 0;
  l.host.inside({ lock: 2, key: 'c', onOpen: () => left++ });
  l.deps.onClose(true); assert.equal(left, 0);
  // AUDIT LOCKPICK A3: opened, then replaced in its hold - the death screen (or any window) taking the slot disposes it -
  // and the success tail never runs under it; the player's own close in the hold (Esc, Leave) still runs it
  for (const [how, want] of [['replaced', 0], ['the player', 1]]) {
    const h = rig({ picks: 1 });
    let ran = 0;
    h.host.inside({ lock: 2, key: 'chest', onOpen: () => ran++ });
    h.deps.onAnswer('open');
    if (how === 'the player') h.mounted[0].shut(); else h.mounted[0].dispose();   // the door's own close (Esc, Leave: `self`), or the slot's replace
    await new Promise((res) => setTimeout(res, OPEN_HOLD_MS + 40));
    assert.equal(ran, want, `${how} in the hold`);
  }
});

test('LOCKPICK host: disposed with a window up, the window shuts and an opened lock\'s tail never runs; Gentle work is handed on', async () => {
  const r = rig({ gentle: true });
  let tail = 0;
  r.host.inside({ lock: 2, key: 'c', onOpen: () => tail++ });
  assert.equal(r.deps.gentle, true);
  r.deps.onAnswer('open');
  r.host.dispose();
  await new Promise((res) => setTimeout(res, OPEN_HOLD_MS + 40));
  assert.equal(tail, 0); assert.equal(r.disposed, 1);
  assert.equal(r.host.inside({ lock: 2, key: 'c' }), true); assert.equal(r.mounted.length, 1, 'a dead host opens nothing');
});

test('LOCKPICK host: a front door - DFU\'s exterior chance, its own roll; opened, the break-in tallied, the line, the chime, then in', async () => {
  const r = rig({ picks: 1, skill: 40 });
  const order = [];
  r.host.frontDoor({ lock: 5, skill: 40, key: 'building:3:4', enter: () => order.push('enter') });
  assert.equal(r.deps.act.state.chance, exteriorLockpickingChance(5, 40)); assert.equal(r.deps.act.state.exterior, true);
  r.player.crimeGuildRequirements = undefined;
  r.deps.onAnswer('open');
  await new Promise((res) => setTimeout(res, OPEN_HOLD_MS + 40));
  assert.deepEqual(order, ['enter']); assert.equal(r.lines.length, 1, 'the success line');
  assert.ok(r.sounds.some(([k]) => k === SOUND.ActivateLockUnlock), 'DFU\'s chime');
  const H = src('src/scenes/lockpickHost.js');
  // AUDIT LOCKPICK A5: the tally found at all - its absence read -1 and passed; lockpick_door.test.js counts it landing
  assert.ok(H.indexOf('tallyCrimeGuildRequirements(player, true, 1)') >= 0 && H.indexOf('tallyCrimeGuildRequirements(player, true, 1)') < H.indexOf('line(LOCKPICKING_SUCCESS_TEXT)'), 'CG2: the tally before the text (PlayerActivate.cs:552)');
});

// ---------------------------------------------------------------------------------------------------------------------
// THE WINDOW, THE EAR
// ---------------------------------------------------------------------------------------------------------------------

test('LOCKPICK window: its chambers stand evenly inside the housing and a point finds its chamber; every answer has its words', () => {
  for (let n = 2; n <= 6; n++) {
    const xs = Array.from({ length: n }, (_, i) => chamberX(n, i));
    assert.ok(xs[0] > LOCK_GEOM.left && xs.at(-1) < LOCK_GEOM.right);
    for (let i = 1; i < n; i++) assert.ok(xs[i] - xs[i - 1] > LOCK_GEOM.chamber * 1.8, 'chambers never touch');
    xs.forEach((x, i) => { assert.equal(chamberAt(n, x), i); assert.equal(chamberAt(n, x + LOCK_GEOM.chamber * 0.8), i); });
    assert.equal(chamberAt(n, 2), -1); assert.equal(chamberAt(n, LOCK_W - 2), -1);
  }
  for (let i = 0; i < 6; i++) { const k = keyLength(1234, i); assert.ok(k >= LOCK_GEOM.keyMin && k <= LOCK_GEOM.keyMax); }
  assert.ok(LOCK_GEOM.keyway - LOCK_GEOM.keyMax > LOCK_GEOM.shear, 'the longest key pin still lifts to the line');
  for (const a of ['lift', 'springy', 'set', 'false-set', 'already', 'slip', 'open']) assert.ok(LOCK_WORDS[a]().length > 5, a);
  assert.match(LOCK_WORDS.break(2), /2 left/); assert.equal(LOCK_WORDS.break(0), 'Your last lockpick snaps!');
  assert.match(LOCK_WORDS.title('the chest'), /the chest/);
});

test('LOCKPICK ear: seven clips of ours, each shipped and accounted for; every answer its cue; the classic skin DFU\'s click, and DFU\'s own sounds for a slip and a snap (AUDIT LOCKPICK C13)', () => {
  assert.deepEqual(Object.keys(LOCK_SFX), ['tick', 'spring', 'set', 'false', 'slip', 'snap']);
  const files = Object.values(LOCK_SFX_FILES);
  assert.equal(files.length, 7);
  const sources = src('public/sfx/SOURCES.md');
  for (const f of files) {
    assert.ok(existsSync(join(ROOT, 'public/sfx', f)), f);
    assert.ok(sources.includes(`| \`${f}\` |`), `${f} in SOURCES.md`);
  }
  for (const a of ['lift', 'springy', 'set', 'open', 'false-set', 'slip', 'break', 'already']) assert.ok(LOCK_SFX[LOCK_CUES[a][0]], a);
  const played = [];
  const audio = { registerSound: async () => true, playOneShot: (k, v, p) => played.push([k, v, p]) };
  const on = createLockEar({ audio, on: () => true, rand: () => 0 });
  assert.equal(on.cue('lift'), 'lock:tick-1'); assert.equal(on.cue('lift'), 'lock:tick-2', 'never the one just heard');
  assert.equal(on.cue('break'), 'lock:snap'); assert.equal(on.cue(null), null); assert.equal(on.cue('nothing'), null);
  const off = createLockEar({ audio, on: () => false });
  assert.equal(off.cue('set'), SOUND.ButtonClick); assert.equal(off.cue('lift'), null);
  assert.deepEqual(Object.keys(LOCK_CLASSIC_CUES), ['set', 'open', 'false-set', 'break', 'slip']);
  assert.equal(off.cue('break'), SOUND.Parry6, 'a snapped pick is heard off the port\'s sounds');
  assert.equal(off.cue('slip'), SOUND.EquipShortBlade, 'and a slip');
});

// ---------------------------------------------------------------------------------------------------------------------
// THE SITES THAT ROLLED THE PICK
// ---------------------------------------------------------------------------------------------------------------------

test('LOCKPICK sites: a dungeon door hands its pick to the host below the magic arm; the door\'s graph opens the picked lock', () => {
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const CUBE = { positions: new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0]), indices: new Uint32Array([0, 1, 2]) };
  const a = new ActionSystem({ addMesh: () => {}, removeBucket: () => {}, raycast: () => Infinity }, { lockpickSkill: () => 30, playerLevel: () => 5 });
  const asked = [], results = [];
  a.onLockpickAttempt = (o) => asked.push(o);
  a.onLockpickResult = (o, ok) => results.push(ok);
  const door = a.addDoor(CUBE, I, { startingLockValue: 4 });
  assert.equal(a.attemptLockpicking(door), false); assert.deepEqual(asked, [door]); assert.equal(door.currentLockValue, 4);
  door.failedSkillLevel = 30;
  a.attemptLockpicking(door); assert.equal(asked.length, 2, 'the retry gate is not read for the tumblers');
  const magic = a.addDoor(CUBE, I, { startingLockValue: MAGIC_LOCK_THRESHOLD });
  a.attemptLockpicking(magic); assert.equal(asked.length, 2, 'a magic lock stays the roll\'s'); assert.deepEqual(results, [false]);
  assert.equal(a.lockpicked(door), true); assert.equal(door.currentLockValue, 0); assert.equal(door.state, 'forward');
  for (let i = 0; i < 100 && door.state !== 'end'; i++) a.update(0.1);
  assert.equal(door.state, 'end');
  assert.equal(a.lockpicked(door), false, 'an open lock is no lock'); assert.equal(door.state, 'end', 'and its door is not swung shut');
  const D = src('src/scenes/dungeonContext.js');
  // PIN MOVED (AUDIT LOCKPICK A4): the graph's doors wired through the host's own `wire` - the dungeon's and a building's
  // alike (test/systems/lockpick/lockpick_audit.test.js drives it over a real graph)
  assert.match(D, /lockpick\.wire\(actions, `door:\$\{dfLocation\?\.mapTableData\?\.mapId \?\? 0\}`\);/);
  assert.match(D, /return lockpick\.inside\(\{\n\s*lock: sb\.lock, key, what:/, 'a chest\'s pick, where SEARCH1 rolled');
  assert.match(D, /onOpen: \(\) => \{ markPicked\(key\); hudText\.add\(LOCKPICKING_SUCCESS_TEXT\); audio\.play3d\(SOUND\.ActivateLockUnlock, centre\); activateSearchable\(i, mode\); \}/, 'opened, marked picked and searched');
  assert.ok(D.includes('lockpick.dispose();   // LOCKPICK'), 'shut with the context');
  assert.equal(/Math\.random\(\) \* 100 >= interiorLockpickingChance/.test(D), false, 'no roll left');
});

test('LOCKPICK sites: a front door in Steal mode opens the window where the roll stood, and is activated again once picked', () => {
  const W = src('src/scenes/worldModes.js');
  // PIN MOVED (AUDIT LOCKPICK A1): the host is `lockHost` - the ladder's own `lockpick` (the skill, DFU's name) shadowed
  // `lockpick` and every front door threw; test/systems/lockpick/lockpick_door.test.js drives the door itself
  assert.ok(W.includes('const lockHost = createLockpickHost({ talk: townTalk, mount: mountServiceWindow });'), 'the mode\'s own slot (A4), the street\'s line');
  const ladder = W.indexOf('if (!opened && !isBash) {\n          const lockpick = skillValue(playerEntity, SKILLS.Lockpicking);');
  const steal = W.indexOf("if (getInteractionMode() !== 'steal') {", ladder);
  const pick = W.indexOf('if (!picked) return lockHost.frontDoor({ lock: lockValue, skill: lockpick, key: `front:${locId ?? 0}:${bd.buildingKey}`, enter: () => activateStaticDoor(hit, entries, false, { homeAsked, picked: true })', ladder);
  assert.ok(ladder > 0 && steal > ladder && pick > steal, 'the refusal first, the window in Steal mode');
  assert.ok(W.indexOf('isBrokenIn = true;   // :557', pick) > pick, 'picked, it is a break-in');
  assert.equal(W.includes('getLastLockpickAttempt'), false, 'the anti-grind gate retired');
  assert.equal(W.includes('Math.floor(Math.random() * 100);   // Random.Range(1, 101)'), false, 'no roll left');
});
