// RAID-ASHORE (2026-10-17, the owner: "when pirates attack but your first boat (the one that is assigned to be your cabin
// if you press T > ship) You spawn and fight in land ... after you defeat the pirates they keep spawning but passive";
// bible/03-World/Naval-Refit.md RAID-ASHORE) - Warm Ashes' voyage raid, fought where the player stands, ENDS there: the
// author's own WAQ_SHIP_SMALLRAID through the real quest machine, each of its three outcomes, won ashore - its crew and
// its last raiders withdrawn, the dead left lying, the quest ended (no crew called again), the ship blocks at their base;
// at sea the IL's own arm as it was; the withdraw's own law over the pools; one raid at a time on the fast travel too;
// and the world host's wiring. tools/mutants/raidashore.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

import { QuestMachine } from '../../../src/systems/quest/machine.js';
import { loadQuestTables } from '../../../src/systems/quest/tables.js';
import { QuestResourceBehaviour } from '../../../src/systems/quest/resourceBehaviour.js';
import {
  LeaveShip, setWarmAshesHost, _resetWarmAshesShips, onPreFastTravel, WA_SEA_REGION, WA_SHIP_BLOCKS, WA_VARIANT_BASE,
} from '../../../src/systems/warmAshesShips.js';
import { createRaidAshore, questFoesOf } from '../../../src/scenes/raidAshore.js';
import { hostText } from '../../hostText.mjs';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const T = new URL('../../../vendor/dfu-quests/Tables/', import.meta.url);
loadQuestTables(Object.fromEntries(readdirSync(T).map((f) => [f.replace(/\.txt$/, ''), readFileSync(new URL(f, T), 'utf8')])));
const RAID = rd('vendor/warm-ashes-ships/Quests/WAQ_SHIP_SMALLRAID.txt').split(/\r?\n/);
const WORLD = hostText('src/scenes/world.js');

/**
 * The author's raid run through the real machine over a street's pool of records (the exterior pool's shape: a foe the
 * quest stood carries its quest resource behaviour as `questBehaviour`), its waves placed as the host's tryPlaceFoe places
 * them, Warm Ashes' host answering as the world host does - `region` where the player stands.
 */
function raid({ roll, region, ashoreSeam = true, leave = new LeaveShip(null) }) {
  const pool = [];
  const calls = [];
  let now = 12 * 3600;
  const ashore = createRaidAshore({ pools: () => [{ foes: () => pool, remove: (f) => { const i = pool.indexOf(f); if (i >= 0) pool.splice(i, 1); } }] });
  const m = new QuestMachine({
    nowSeconds: () => now,
    questFoeInstances: (sym) => pool.filter((f) => !f.dead && f.questBehaviour?.targetSymbol?.name === sym?.name),
    onQuestEnded: (q) => ashore.questEnded(q),
  });
  m.registerAction(leave);
  _resetWarmAshesShips();
  setWarmAshesHost({
    currentRegionIndex: () => region, leaveShipGate: () => 'proceed', ownsShip: () => true,
    setTransportModeShip: () => calls.push('ship'), setBlockVariant: (block, v) => calls.push(`${block}${v}`),
    ...(ashoreSeam ? { raidAshore: (q) => { calls.push('ashore'); return ashore.over(q); } } : {}),
  });
  const quest = m.scheduleQuest(RAID, 0, { rolls: () => roll });
  // the spawn seam (CreateFoe's world - GameObjectHelper's mint and TryPlacement) on the quest the machine parsed
  quest.hooks = {
    ...quest.hooks,
    world: {
      currentRegionIndex: () => region,
      createFoeGameObjects: (foe, count) => Array.from({ length: count }, () => ({ foe })),
      tryPlaceFoe: (h) => {
        const qrb = new QuestResourceBehaviour(m);
        qrb.questUID = h.foe.parentQuest.uid; qrb.targetSymbol = h.foe.symbol;
        pool.push({ sym: h.foe.symbol.name, foe: h.foe, questBehaviour: qrb, dead: false });
        return true;
      },
    },
  };
  const tick = (n, dt = 1) => { for (let i = 0; i < n; i++) { now += dt; m.tick(); } };
  const standing = () => pool.filter((f) => !f.dead).reduce((o, f) => ({ ...o, [f.sym]: (o[f.sym] ?? 0) + 1 }), {});
  /** Struck down: the record dead, its kill counted on its Foe (QuestResourceBehaviour's incrementKills). */
  const kill = (sym, n) => { for (const f of pool.filter((x) => !x.dead && x.sym === sym).slice(0, n)) { f.dead = true; f.foe.incrementKills(); } };
  const win = () => { kill('warrior', 8); kill('barb', 8); kill('orc', 6); kill('orcs', 2); };
  return { m, quest, pool, calls, ashore, tick, standing, kill, win };
}

test('RAID-ASHORE the author\'s raid, won ashore, ENDS: each of its three outcomes - its crew (`_ally_`) and the raiders stood; the raiders struck down, and nothing of the raid stands after it (its crew withdrawn), its dead lying to be looted, the quest ended and tombstoned, the ship blocks back at their base - and no crew is ever called again however long the player stays (mutants: the seam unasked, the quest left running)', () => {
  const outcomes = [];
  for (const roll of [0, 0.2, 0.4]) {
    const r = raid({ roll, region: 17 });
    r.tick(20);
    const before = r.standing();
    assert.equal(before.ally, 5, `roll ${roll}: the crew stood`);
    outcomes.push(Object.keys(before).filter((k) => k !== 'ally').sort().join('+'));
    const dead = Object.values(before).reduce((a, b) => a + b, 0) - 5;
    r.win();
    r.tick(10);
    assert.deepEqual(r.standing(), {}, `roll ${roll}: nothing of the raid stands`);
    assert.equal(r.pool.length, dead, `roll ${roll}: the dead lie where they fell`);
    assert.ok(r.calls.includes('ashore'), 'the host was asked');
    assert.deepEqual(r.calls.filter((c) => c.includes('.RMB')), WA_SHIP_BLOCKS.map((b) => `${b}${WA_VARIANT_BASE}`), 'the blocks at their base');
    assert.ok(!r.calls.includes('ship'), 'no ship sailed off - the player stays where they fought');
    assert.equal(r.quest.questComplete, true, `roll ${roll}: the quest ended`);
    assert.equal(r.quest.questTombstoned, true);
    assert.equal(r.ashore.ending, 0, 'its end swept, and let go');
    r.tick(40, 300);
    assert.deepEqual(r.standing(), {}, `roll ${roll}: no crew called again in the hour it would have run`);
  }
  assert.deepEqual(outcomes.sort(), ['barb', 'orc+orcs', 'warrior'], 'the three outcomes');
});

test('RAID-ASHORE what the owner met, kept as the record of the bug: the same raid won ashore with the port\'s arm absent (the IL\'s "else SetComplete" alone) leaves its crew standing and the quest running, and strikes of the crew call five more each time five fall', () => {
  // the IL's own arm off the sea, as it shipped: done, nothing else
  class IlLeaveShip extends LeaveShip {
    createNew(source, q) { return this.test(source) ? new IlLeaveShip(q) : null; }
    update() { this.setComplete(); }
  }
  const r = raid({ roll: 0, region: 17, ashoreSeam: false, leave: new IlLeaveShip(null) });
  r.tick(20);
  r.win();
  r.tick(10);
  assert.equal(r.standing().ally, 5, 'the crew stood on');
  assert.equal(r.quest.questComplete, false, 'the quest ran on');
  r.kill('ally', 5);
  r.tick(10);
  assert.equal(r.standing().ally, 5, 'five struck, five more called - "they keep spawning"');
});

test('RAID-ASHORE at sea (region 31, "Your Ship") the IL\'s own arm is untouched: the blocks back, the player sailed off the ship, the host\'s raidAshore never asked and the quest left to its clock (mutants: the arm taken at sea)', () => {
  const r = raid({ roll: 0, region: WA_SEA_REGION });
  r.tick(20);
  r.win();
  r.tick(5);
  assert.ok(r.calls.includes('ship'), 'sailed off the ship');
  assert.ok(!r.calls.includes('ashore'));
  assert.equal(r.standing().ally, 5, 'its crew is the ship\'s scene\'s, left behind as the IL leaves it');
  assert.equal(r.quest.questComplete, false);
});

test('RAID-ASHORE the withdraw\'s law: every pool the host hands - the street\'s, the room\'s below deck - each living foe of the raid\'s quest withdrawn and counted; the dead, another quest\'s foes and a foe of no quest left; the quest\'s end sweeps again only for a raid ended ashore, and once (mutants: the dead taken, another quest\'s taken, the end unswept, swept for any quest)', () => {
  const q = { uid: 7 }, other = { uid: 8 };
  const mk = (uid, dead = false) => ({ dead, questBehaviour: uid == null ? null : { questUID: uid } });
  const street = [mk(7), mk(7, true), mk(8), mk(null), mk(7)];
  const room = [mk(7), mk(8)];
  const poolOf = (list) => ({ foes: () => list, remove: (f) => list.splice(list.indexOf(f), 1) });
  const a = createRaidAshore({ pools: () => [poolOf(street), null, poolOf(room)] });
  assert.deepEqual(questFoesOf(q, street).length, 2);
  assert.equal(questFoesOf(null, street).length, 0);
  assert.equal(a.over(q), 3);
  assert.deepEqual(street.map((f) => [f.questBehaviour?.questUID ?? null, f.dead]), [[7, true], [8, false], [null, false]]);
  assert.deepEqual(room.map((f) => f.questBehaviour.questUID), [8]);
  assert.equal(a.ending, 1);
  street.push(mk(7));   // a wave its grace ticks stood
  assert.equal(a.questEnded(other), 0, 'another quest\'s end sweeps nothing');
  assert.equal(street.length, 4);
  assert.equal(a.questEnded(q), 1, 'its own end sweeps what its last ticks stood');
  assert.equal(street.length, 3);
  assert.equal(a.ending, 0);
  street.push(mk(7));
  assert.equal(a.questEnded(q), 0, 'and once');
  assert.equal(a.over(null), 0);
});

test('RAID-ASHORE one raid at a time on the fast travel too: a voyage by ship while a raid\'s quest runs arms no second ambush - no ship lent, the blocks left as the running raid set them; with none running it arms as the IL does (mutants: the guard dropped)', () => {
  _resetWarmAshesShips();
  const calls = [];
  let running = true;
  setWarmAshesHost({ random: () => 0.99, ownsShip: () => false, assignShip: () => calls.push('lend'), setBlockVariant: (b, v) => calls.push(`${b}${v}`), raidRunning: () => running });
  assert.equal(onPreFastTravel({ oceanPixels: 3, travelShip: true }), 'busy');
  assert.deepEqual(calls, []);
  running = false;
  assert.equal(onPreFastTravel({ oceanPixels: 3, travelShip: true }), 'raid-lent');
  assert.deepEqual(calls, ['lend', 'SHIPAA00.RMB_smallraid', 'SHIPAA01.RMB_smallraid']);
  _resetWarmAshesShips();
});

test('RAID-ASHORE the world host\'s wiring: one withdraw built before the quest bridge over the street\'s pool and the room\'s, Leave Ship\'s seam its `over`, and the quest\'s end its `questEnded`', () => {
  assert.match(WORLD, /const raidAshore = createRaidAshore\(\{ pools: \(\) => \{\n\s+const inner = modes\?\.interiorPool\?\.\(\);\n\s+return \[\{ foes: \(\) => exteriorFoes\.foes, remove: \(f\) => exteriorFoes\.removeFoe\(f\) \}, inner \? \{ foes: \(\) => inner\.foes, remove: \(f\) => inner\.removeFoe\(f\) \} : null\];\n\s+\} \}\);\n {2}questBridge = createQuestBridge\(\{/);   // the room's pool read once, guarded on `modes` (declared below - audit24_wave37)
  assert.match(WORLD, /raidAshore: \(quest\) => raidAshore\.over\(quest\),/);
  assert.match(WORLD, /naval\?\.raidEnded\(q\);[^\n]*\n {6}raidAshore\.questEnded\(q\);/);
});
