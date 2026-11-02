// AUDIT LOCKPICK (2026-10-26, the owner: "Audit this" - bible/01-Overview/audits/Audit-Lockpick.md): THE MACHINE'S
// PINS the audit found missing - each one a mutant that survived the slice's own tests.
//   A2 - at DFU's 5%, no one delay after a lift sets every rise, at any Agility band (a blind rhythm set every pin).
//   A6 - after the rise: the hang ends at the chance's window and the pin falls, the fall's first grace still sets and
//        the press past it slips, the fall ends at rest.
//   A7 - a snap drops every pin at all three of its sites - a forced free pin, a slip's snap, a failed Auto - and no
//        spool keeps a false set.
//   A9 - the host hands the machine the character's Lockpicking (the sense) and Agility (the band); the opened lock is
//        seen turning before its window shuts; the action graph never swings a moving door for a pick.
//   A4 - a building's door a Lock spell locked is picked, as DFU picks it (the interior's graph wired to the window).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LOCKPICK_ACT, setWindowS, lockBand, lockSeed } from '../../../src/systems/lockpick/lockpickLaw.js';
import { createLockpickAct, PIN } from '../../../src/systems/lockpick/lockpickAct.js';
import { lockpicks } from '../../../src/systems/lockpick/lockpickItem.js';
import { createLockpickHost, OPEN_HOLD_MS } from '../../../src/scenes/lockpickHost.js';
import { readFileSync } from 'node:fs';
import { SOUND } from '../../../src/systems/soundClips.js';
import { ActionSystem, LOCKPICKING_SUCCESS_TEXT } from '../../../src/world/actionSystem.js';

const DT = 1 / 60;
/** Tick `act` `s` seconds in frames of DT. */
const run = (act, s) => { for (let t = 0; t + 1e-9 < s; t += DT) act.tick(DT); };

test('AUDIT LOCKPICK A2: at DFU\'s 5% no one delay after a lift sets every rise, at any Agility band - the rise\'s spread outspans the hang and its graces (mutants: the jitter narrowed; the 5% hang widened; the grace widened)', () => {
  const A = LOCKPICK_ACT;
  for (const band of [lockBand(0), lockBand(40), lockBand(60), lockBand(85)]) {
    assert.ok(setWindowS(5, band) + 2 * A.graceS < 2 * A.riseS * A.riseJitter, `band ${band}: the settable span under the rise's spread`);
    const coversEvery = (D) => {
      for (let k = 0; k <= 50; k++) {
        const u = (k / 50) * 0.999999;
        let first = true;
        const act = createLockpickAct({ lock: 18, chance: 5, seed: 1, band, rng: () => (first ? ((first = false), u) : 0.999) });
        act.aim(act.binding);
        if (act.press() !== 'lift') return false;
        run(act, D);
        const a = act.press();
        if (a !== 'set' && a !== 'false-set') return false;
      }
      return true;
    };
    const blind = [];
    for (let D = 0; D <= 0.6; D += DT) if (coversEvery(D)) blind.push(+D.toFixed(3));
    assert.deepEqual(blind, [], `band ${band}: no blind rhythm sets every rise`);
  }
  // a watching hand still can: at the hang's middle, every rise sets
  for (let k = 0; k <= 10; k++) {
    let first = true;
    const act = createLockpickAct({ lock: 18, chance: 5, seed: 1, rng: () => (first ? ((first = false), k / 10 * 0.999999) : 0.999) });
    act.aim(act.binding); act.press();
    run(act, act.state.pins[act.binding].rise + act.state.window / 2);
    assert.ok(['set', 'false-set'].includes(act.press()), `rise ${k}: set at the hang's middle`);
  }
});

test('AUDIT LOCKPICK A6: the hang ends at the chance\'s window and the pin falls; the fall\'s grace still sets, past it a slip; the fall ends at rest (mutants: the hang blind to the chance; never ending; the fall never resting; the fall\'s grace lost; the whole fall setting)', () => {
  const lift = (chance) => {
    const act = createLockpickAct({ lock: 1, chance, seed: lockSeed('a6'), rng: () => 0.5 });   // 2 pins; 0.5 the mean rise, never a snap at 50
    act.aim(act.binding); assert.equal(act.press(), 'lift');
    return act;
  };
  for (const chance of [5, 95]) {
    const act = lift(chance), p = act.state.pins[act.binding];
    run(act, p.rise + 0.001);
    assert.equal(p.phase, PIN.hang, `${chance}%: at the line`);
    run(act, act.state.window - 2 * DT);
    assert.equal(p.phase, PIN.hang, `${chance}%: still hanging inside the window (${act.state.window} s)`);
    run(act, 3 * DT);
    assert.equal(p.phase, PIN.fall, `${chance}%: falling past it`);
    run(act, LOCKPICK_ACT.fallS + DT);
    assert.equal(p.phase, PIN.rest, `${chance}%: at rest once the fall is done`);
  }
  // the fall's first grace sets; a press past it slips
  const timeToFall = (act) => { const p = act.state.pins[act.binding]; let t = 0; while (p.phase !== PIN.fall && t < 2) { act.tick(0.001); t += 0.001; } return p; };
  const early = lift(50), pe = timeToFall(early);
  early.tick(LOCKPICK_ACT.graceS - 0.01);
  assert.equal(pe.phase, PIN.fall); assert.equal(early.press(), 'set', 'within the fall\'s grace');
  const late = lift(50), pl = timeToFall(late);
  late.tick(LOCKPICK_ACT.graceS + 0.01);
  assert.equal(pl.phase, PIN.fall); assert.equal(late.press(), 'slip', 'past it');
});

test('AUDIT LOCKPICK A7: a snap drops every pin at all three sites - a forced free pin, a slip\'s snap, a failed Auto - and no spool keeps a false set (mutants: a free snap keeps the pins; an Auto snap keeps them; a snap keeps a false set)', () => {
  /** A 5-pin, 2-spool lock with a pin set and a spool false-set, its rolls `roll.v` (0.99: no snap, a slow rise). */
  const primed = () => {
    const roll = { v: 0.99 };
    const act = createLockpickAct({ lock: 14, chance: 50, seed: lockSeed('a7'), rng: () => roll.v });
    for (let guard = 0; guard < 40 && (act.state.next < 1 || !act.state.pins.some((p) => p.falseSet)); guard++) {
      act.aim(act.binding); act.press();
      run(act, act.state.pins[act.binding].rise + act.state.window / 2);
      act.press();
    }
    assert.ok(act.state.next >= 1 && act.state.pins.some((p) => p.falseSet), 'primed: a pin set and a spool false-set');
    return { act, roll };
  };
  const down = (act) => act.state.next === 0 && act.state.pins.every((p) => p.phase === PIN.rest && !p.falseSet);
  // a free pin forced: a pin at rest that is not binding, the roll under breakChance x freeRisk
  const f = primed();
  f.roll.v = 0;
  f.act.aim(f.act.state.pins.findIndex((p, k) => p.phase === PIN.rest && k !== f.act.binding));
  assert.equal(f.act.press(), 'break', 'a free pin forced'); assert.ok(down(f.act), 'a free snap: every pin down, no false set');
  // a slip's snap: the binding pin pressed early in its rise
  const s = primed();
  s.act.aim(s.act.binding); s.act.press(); s.act.tick(0.01);
  s.roll.v = 0;
  assert.equal(s.act.press(), 'break', 'a slip snapped'); assert.ok(down(s.act), 'a slip\'s snap: every pin down');
  // a failed Auto: the roll over the chance
  const a = primed();
  assert.equal(a.act.auto(), 'break', 'DFU\'s roll failed'); assert.ok(down(a.act), 'a failed Auto: every pin down');
});

test('AUDIT LOCKPICK A9: the host hands the machine Lockpicking (the sense) and Agility (the band); the opened lock turns before its window shuts; a moving door is never swung for a pick (mutants: the host never senses; Agility ignored; no hold; the moving door swung)', () => {
  const host = (skill, agility) => {
    let deps = null;
    const player = { items: [lockpicks(3)], level: 4, skills: new Array(35).fill(skill), skillUses: new Array(35).fill(0), stats: { agility } };
    createLockpickHost({ player, mount: () => {}, say: () => {}, line: () => {}, changed: () => {}, audio: { playOneShot() {} }, gentle: () => false, reduced: () => false, rolls: () => 0.5,
      overlay: (d) => { deps = d; return { done: false, dispose() {}, shut() {}, out() {} }; } }).inside({ lock: 4, key: 'a9' });
    return deps.act.state;
  };
  assert.equal(host(49, 50).sense, false); assert.equal(host(50, 50).sense, true, 'Lockpicking 50 tells the binding pin');
  const slow = host(40, 0), quick = host(40, 100);
  assert.ok(quick.window > slow.window, `Agility widens the hang (${slow.window} -> ${quick.window})`);
  assert.equal(quick.window, setWindowS(quick.chance, lockBand(100)));
  assert.ok(OPEN_HOLD_MS >= 300, 'the plug is seen turning');
  // the action graph: a door in its swing is neither handed to the window nor swung by a pick
  const actions = new ActionSystem(null);
  let asked = 0;
  actions.onLockpickAttempt = () => asked++;
  const door = { state: 'forward', currentLockValue: 6, key: 'd' };
  assert.equal(actions.attemptLockpicking(door), false); assert.equal(asked, 0, 'no window on a swinging door');
  assert.equal(actions.lockpicked(door), false); assert.equal(door.currentLockValue, 6, 'a swinging door keeps its lock');
  door.state = 'reverse';
  assert.equal(actions.lockpicked(door), false);
});

test('AUDIT LOCKPICK A4: a building\'s door a Lock spell locked is picked as DFU picks it - the graph wired to the window, opened through its own seam and DFU\'s line said where the graph has none; worldModes wires the interior\'s graph and dungeonContext the dungeon\'s (mutants: the interior unwired; the dungeon unwired; the line unsaid; the door left shut)', () => {
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const CUBE = { positions: new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0]), indices: new Uint32Array([0, 1, 2]) };
  const actions = new ActionSystem({ addMesh: () => {}, removeBucket: () => {}, raycast: () => Infinity });   // interiorContext.js's own: no hooks of its own
  const door = actions.addDoor(CUBE, I);
  actions.activate(door.key, { steal: false, doorSpell: { kind: 'lock', holderLevel: 12 } });
  assert.ok(door.currentLockValue > 0, 'the Lock spell locked it');
  let deps = null;
  const lines = [], sounds = [];
  const player = { items: [lockpicks(2)], level: 4, skills: new Array(35).fill(40), skillUses: new Array(35).fill(0), stats: {} };
  const host = createLockpickHost({ player, mount: () => {}, say: () => {}, line: (l) => lines.push(l), changed: () => {}, audio: { playOneShot: (k) => sounds.push(k) }, gentle: () => false, reduced: () => false, rolls: () => 0,
    overlay: (d) => { deps = d; const ov = { done: false, dispose() { ov.done = true; d.onClose(false); }, shut() { ov.done = true; d.onClose(true); }, out() {} }; return ov; } });
  host.wire(actions, 'inner:7');
  actions.activate(door.key, { steal: true });
  assert.ok(deps, 'Steal mode at the locked door opens the window');
  assert.equal(deps.seed, lockSeed(`inner:7:${door.key}`), 'its lock named by the building');
  assert.equal(deps.act.auto(), 'open');
  deps.onAnswer('open');
  host.wire(null, 'x');   // a host with no graph: nothing
  return new Promise((res) => setTimeout(() => {
    assert.equal(door.currentLockValue, 0, 'the lock is open'); assert.notEqual(door.state, 'start', 'and the door swings');
    assert.deepEqual(lines, [LOCKPICKING_SUCCESS_TEXT], 'DFU\'s line, the graph having none'); assert.ok(sounds.includes(SOUND.ActivateLockUnlock), 'and its chime');
    const W = readFileSync(new URL('../../../src/scenes/worldModes.js', import.meta.url), 'utf8');
    assert.match(W, /wireDoorSpells\(ctx\.actions, playerEntity, \(t\) => townTalk\?\.say\?\.\(t\)\);\n\s*lockHost\.wire\(ctx\.actions, `inner:\$\{interiorBuilding\?\.buildingKey \?\? 0\}`\);/, 'the interior\'s graph wired beside its door spells');
    assert.match(W, /const lockHost = createLockpickHost\(\{ talk: townTalk, mount: mountServiceWindow \}\);/, 'in the mode\'s own slot');
    const DC = readFileSync(new URL('../../../src/scenes/dungeonContext.js', import.meta.url), 'utf8');
    assert.match(DC, /\n  lockpick\.wire\(actions, `door:\$\{dfLocation\?\.mapTableData\?\.mapId \?\? 0\}`\);/, 'and the dungeon\'s graph, by the same `wire`');
    res();
  }, OPEN_HOLD_MS + 40));
});

test('AUDIT LOCKPICK B2: the Lockpick\'s card lines reach every card that shows it - the classic Info box, the enhanced card, the stat rows (mutants: a gate that forgot the Lockpick)', async () => {
  const { itemInfoRows, itemStatRows } = await import('../../../src/systems/item/itemInfo.js');
  const { itemLine } = await import('../../../src/ui/enhanced/enhancedInventory.js');
  const { LOCKPICK_TEXT } = await import('../../../src/systems/lockpick/lockpickItem.js');
  const pick = lockpicks(3), want = LOCKPICK_TEXT.card();
  assert.equal(want.length, 2);
  const classic = itemInfoRows(pick, (id) => [{ text: `<TEXT.RSC ${id}>` }]).map((r) => r.text);
  assert.ok(want.every((w) => classic.includes(w)), `the classic box: ${JSON.stringify(classic)}`);
  assert.deepEqual(itemLine(pick).survival?.filter((w) => want.includes(w)), want, 'the enhanced card');
  const stats = itemStatRows(pick).map((r) => r.text);
  assert.ok(want.every((w) => stats.includes(w)), `the stat rows: ${JSON.stringify(stats)}`);
});

test('AUDIT LOCKPICK B4: online, a counter\'s picks stand back by what a purchase took - a stack shoplifted stays gone, ENDLESS-ARROWS\' law; a whole stack bought stands the whole again (mutants: the whole stack on any purchase; past the stack)', async () => {
  const { restockEndless } = await import('../../../src/systems/shopStock.js');
  const { restockLockpicks, lockpickCount, ENDLESS_LOCKPICK_STACK } = await import('../../../src/systems/lockpick/lockpickItem.js');
  const saved = globalThis.location;
  globalThis.location = { search: '?online' };
  try {
    const counter = [];   // 24 of the 25 shoplifted, then the last one bought - taken off the counter, as the trade does
    restockEndless(counter, [lockpicks(1)]);
    assert.equal(lockpickCount(counter), 1, 'the bought one stood back, the stolen ones gone');
    const whole = [];
    restockEndless(whole, [lockpicks(ENDLESS_LOCKPICK_STACK)]);
    assert.equal(lockpickCount(whole), ENDLESS_LOCKPICK_STACK, 'the whole stack bought: the whole stood again');
    const full = [lockpicks(ENDLESS_LOCKPICK_STACK)];
    assert.equal(restockLockpicks(full, 3), 0); assert.equal(lockpickCount(full), ENDLESS_LOCKPICK_STACK, 'never past the stack');
    const some = [lockpicks(20)];
    assert.equal(restockLockpicks(some, 3), 1); assert.equal(lockpickCount(some), 23);
    assert.equal(restockLockpicks(some, 0), 0);
    const near = [lockpicks(23)];
    assert.equal(restockLockpicks(near, 5), 1); assert.equal(lockpickCount(near), ENDLESS_LOCKPICK_STACK, 'stood back to the whole, never past it');
  } finally { globalThis.location = saved; }
});

test('AUDIT LOCKPICK B8: the gift through the real save - a picking class from before the Lockpick given five once, never again through five saves and loads; a new one\'s kit never doubled; a class that never picks given none (mutants: the mark unsaved; the gift every load; the gift to any class)', async () => {
  const { snapshotPlayer, restorePlayer } = await import('../../../src/systems/save/save.js');
  const { giveStartingLockpicks, lockpickCount, LOCKPICK_KIT } = await import('../../../src/systems/lockpick/lockpickItem.js');
  const { SKILLS } = await import('../../../src/systems/skills.js');
  const careerOf = (picks) => ({ primarySkills: [SKILLS.ShortBlade, 0, 1], majorSkills: picks ? [SKILLS.Lockpicking, 2, 3] : [2, 3, 4], minorSkills: [5, 6, 7, 8, 9, 10], luck: 50 });
  const mk = (picks) => ({ isPlayer: true, level: 3, gender: 'male', activeEffects: [], health: 60, maxHealth: 60, items: [], spells: [], stats: {}, skills: {}, career: careerOf(picks) });
  const quiet = (fn) => { const k = [console.info, console.log, console.warn]; console.info = console.log = console.warn = () => {}; try { return fn(); } finally { [console.info, console.log, console.warn] = k; } };
  const cycles = (entity, { old = false } = {}) => {
    let snap = JSON.parse(JSON.stringify(snapshotPlayer(entity, { classicMinutes: 100 })));
    if (old) delete snap.lockpickGift;
    const counts = [];
    for (let k = 0; k < 5; k++) {
      const loaded = { isPlayer: true };
      quiet(() => restorePlayer(loaded, snap, new Map()));
      counts.push(lockpickCount(loaded.items));
      snap = JSON.parse(JSON.stringify(snapshotPlayer(loaded, { classicMinutes: 100 })));
    }
    return counts;
  };
  const five = Array(5).fill(LOCKPICK_KIT);
  const thief = mk(true); giveStartingLockpicks(thief);
  assert.deepEqual(cycles(thief), five, 'a new Thief: the kit, never doubled');
  assert.deepEqual(cycles(mk(true), { old: true }), five, 'a Thief from before: five, once');
  assert.deepEqual(cycles(mk(false), { old: true }), [0, 0, 0, 0, 0], 'a Knight from before: none');
  assert.deepEqual(cycles(mk(false)), [0, 0, 0, 0, 0], 'a new Knight: none');
});

test('AUDIT LOCKPICK B8: the item law judges the Lockpick headless - itemLaw.js alone, the account Worker\'s graph, in a process of its own - and finds nothing in a pick, a kit, a counter\'s stack (mutant: the leaf unread)', async () => {
  const { execFileSync } = await import('node:child_process');
  const { lockpicks } = await import('../../../src/systems/lockpick/lockpickItem.js');
  const items = [lockpicks(1), lockpicks(5), lockpicks(25)];
  const law = new URL('../../../src/systems/item/itemLaw.js', import.meta.url).href;
  const out = execFileSync(process.execPath, ['--input-type=module', '-e',
    `const law = await import(${JSON.stringify(law)}); console.log(JSON.stringify(${JSON.stringify(JSON.stringify(items))} && JSON.parse(${JSON.stringify(JSON.stringify(items))}).map((it) => law.itemFindings(it))));`], { encoding: 'utf8' });
  assert.deepEqual(JSON.parse(out.trim().split('\n').at(-1)), [[], [], []], 'no finding against an honest Lockpick');
});
