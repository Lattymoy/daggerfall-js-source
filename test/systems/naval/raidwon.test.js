// RAID-WON (FIELD BUGS 2026-10-19, the Discord, [IMB]Monday: "If you get boarded.. repel the attackers.. board them..
// etc. You can use overview as your crew class as enemies"; bible/01-Overview/bugs/Field-Bugs-2026-10-19.md) - A RAID
// WON AT SEA ENDS. The sea fight starts Warm Ashes' raid on a crewed boat (scenes/naval/navalHost.js beginFight): the
// small raid's waves come with five `_ally_` Warriors in my crew's place. Won - its leader down, or its wave killed and
// its Leave Ship the sea fight's ('naval') - it ran on: the small raid until its hour, the pirate attack until its
// `_reset_`, and nothing in either script removes `_ally_`. Their team was set to mine (`change foe _ally_ team 1`) but
// their mobile team - the law the enemies-near question reads (systems/encounters.js areEnemiesNearby, DFU's
// GameManager :709) - is a Warrior's, so the Overworld ("You cannot survey the land with enemies nearby"), a rest and a
// journey were refused for as long as I stayed aboard. Now a won raid ends as one thrown back ashore does
// (scenes/raidAshore.js `won`, through world.js endRaid's `won`): its living foes withdrawn, its quest ended as its own
// `end quest` ends one. tools/mutants/raidwon.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

import { QuestMachine } from '../../../src/systems/quest/machine.js';
import { loadQuestTables } from '../../../src/systems/quest/tables.js';
import { QuestResourceBehaviour } from '../../../src/systems/quest/resourceBehaviour.js';
import { LeaveShip, setWarmAshesHost, _resetWarmAshesShips } from '../../../src/systems/warmAshesShips.js';
import { createRaidAshore } from '../../../src/scenes/raidAshore.js';
import { areEnemiesNearby } from '../../../src/systems/encounters.js';
import { ENEMY_BASICS } from '../../../src/characters/enemy/enemyBasics.js';
import { GRAPPLE_S, RAID_CREW } from '../../../src/systems/naval/navalBoarding.js';
import { hostText } from '../../hostText.mjs';
import { sea } from '../../navalSea.mjs';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const T = new URL('../../../vendor/dfu-quests/Tables/', import.meta.url);
loadQuestTables(Object.fromEntries(readdirSync(T).map((f) => [f.replace(/\.txt$/, ''), readFileSync(new URL(f, T), 'utf8')])));
const RAID = rd('vendor/warm-ashes-ships/Quests/WAQ_SHIP_SMALLRAID.txt').split(/\r?\n/);
const FILE = (name) => rd(`vendor/warm-ashes-ships/Quests/${name}.txt`).split(/\r?\n/);
/** world.js's endRaid, lifted whole (test/systems/naval/navaudit_boarding.test.js's way) - the shipped arms, run. */
const ENDRAID = /\n {6}endRaid: (\(quest, \{ withdraw = false, won = false, crew = false \} = \{\}\) => \{\n[\s\S]*?\n {6}\}),\n/.exec(rd('src/scenes/world.js'));

/**
 * The author's small raid through the real machine at sea, its waves placed on a deck pool shaped as the street's (a
 * foe's quest behaviour; its entity's species row; a motor that would spawn it near me), Warm Ashes' Leave Ship asking
 * the sea fight's gate - which answers 'naval' as navalHost.js leaveShipGate does, having won the boarding: `won` true,
 * the raid ended as the naval host now ends it (raidAshore.js `won`); false, the record of the bug.
 */
function raidAtSea({ roll, won }) {
  const pool = [];
  let now = 12 * 3600;
  const ashore = createRaidAshore({ pools: () => [{ foes: () => pool, remove: (f) => { const i = pool.indexOf(f); if (i >= 0) pool.splice(i, 1); } }] });
  const m = new QuestMachine({
    nowSeconds: () => now,
    questFoeInstances: (sym) => pool.filter((f) => !f.dead && f.questBehaviour?.targetSymbol?.name === sym?.name),
    onQuestEnded: (q) => ashore.questEnded(q),
  });
  m.registerAction(new LeaveShip(null));
  _resetWarmAshesShips();
  let quest = null;
  setWarmAshesHost({
    currentRegionIndex: () => 23, ownsShip: () => true, setTransportModeShip: () => {}, setBlockVariant: () => {},
    leaveShipGate: () => { if (won) ashore.won(quest); return 'naval'; },
  });
  quest = m.scheduleQuest(RAID, 0, { rolls: () => roll });
  quest.hooks = {
    ...quest.hooks,
    world: {
      currentRegionIndex: () => 23,
      createFoeGameObjects: (foe, count) => Array.from({ length: count }, () => ({ foe })),
      tryPlaceFoe: (h) => {
        const qrb = new QuestResourceBehaviour(m);
        qrb.questUID = h.foe.parentQuest.uid; qrb.targetSymbol = h.foe.symbol;
        const mt = h.foe.foeType;
        pool.push({ sym: h.foe.symbol.name, foe: h.foe, questBehaviour: qrb, dead: false, mobileType: mt,
          entity: { basics: ENEMY_BASICS[mt] }, ai: { isHostile: true, wouldBeSpawned: true } });
        return true;
      },
    },
  };
  const tick = (n, dt = 1) => { for (let i = 0; i < n; i++) { now += dt; m.tick(); } };
  const standing = () => pool.filter((f) => !f.dead).reduce((o, f) => ({ ...o, [f.sym]: (o[f.sym] ?? 0) + 1 }), {});
  const kill = (sym, n) => { for (const f of pool.filter((x) => !x.dead && x.sym === sym).slice(0, n)) { f.dead = true; f.foe.incrementKills(); } };
  const win = () => { kill('warrior', 8); kill('barb', 8); kill('orc', 6); kill('orcs', 2); };
  return { quest, pool, ashore, tick, standing, win };
}

test('RAID-WON the small raid won at sea ENDS: each of its three outcomes - its crew withdrawn with the raid, its dead lying, the quest ended and tombstoned, nothing called again in its hour, and no enemy near; the record - the same win with the raid left running keeps five Warriors on my deck that the enemies-near law counts (mutants: the won raid left running; its foes kept)', () => {
  for (const roll of [0, 0.2, 0.4]) {
    const bug = raidAtSea({ roll, won: false });
    bug.tick(20);
    assert.equal(bug.standing().ally, 5, `roll ${roll}: its crew stood`);
    bug.win();
    bug.tick(10);
    assert.deepEqual(bug.standing(), { ally: 5 }, `roll ${roll}: the record - won, its crew left standing`);
    assert.equal(bug.quest.questTombstoned, false, 'and its quest running on');
    assert.equal(areEnemiesNearby(bug.pool), true, 'five Warriors on my deck count as enemies near');

    const r = raidAtSea({ roll, won: true });
    r.tick(20);
    const dead = Object.values(r.standing()).reduce((a, b) => a + b, 0) - 5;
    r.win();
    r.tick(10);
    assert.deepEqual(r.standing(), {}, `roll ${roll}: nothing of the raid stands`);
    assert.equal(r.pool.length, dead, 'its dead lie where they fell');
    assert.equal(r.quest.questTombstoned, true, 'its quest ended');
    assert.equal(r.ashore.ending, 0, 'its end swept, and let go');
    assert.equal(areEnemiesNearby(r.pool), false, 'no enemy near');
    r.tick(40, 300);
    assert.deepEqual(r.standing(), {}, 'no crew called again in the hour it would have run');
  }
});

test('RAID-WON `won`\'s own law: a raid not yet ended - its foes withdrawn now and again at its end, its quest ended with `end quest`\'s grace, never a break; one already ending - never its grace begun again; one already ended - its foes withdrawn once, nothing waiting on its end (mutants: no end; the grace restarted; the ended one held)', () => {
  const quest = (o = {}) => ({ uid: 7, questTombstoned: false, questComplete: false, ticksToEnd: 0, questBreak: false, ends: 0, endQuest() { this.ends++; this.ticksToEnd = 2; }, ...o });
  const pool = [];
  const mk = (q) => ({ dead: false, questBehaviour: { questUID: q.uid } });
  const ashore = createRaidAshore({ pools: () => [{ foes: () => pool, remove: (f) => pool.splice(pool.indexOf(f), 1) }] });
  const q = quest();
  pool.push(mk(q), mk(q), { dead: true, questBehaviour: { questUID: 7 } }, mk({ uid: 8 }));
  assert.equal(ashore.won(q), 2, 'its two living foes');
  assert.deepEqual([q.ends, q.questBreak, ashore.ending, pool.length], [1, false, 1, 2], 'ended with `end quest`\'s grace, never a break from outside a tick; its end awaited for a second sweep');   // AUDIT FB1019 D3 (PIN MOVED): a break cut the pirate attack\'s grace tick
  assert.equal(ashore.won(q), 0);
  assert.equal(q.ends, 1, 'already ending: its grace not begun again');
  const gone = quest({ uid: 9, questTombstoned: true });
  pool.push(mk(gone));
  assert.equal(ashore.won(gone), 1, 'already ended: its foes withdrawn');
  assert.deepEqual([gone.ends, ashore.ending], [0, 1], 'nothing ended twice, nothing waiting on an end that came');
  assert.equal(ashore.won(null), 0);
});

test('RAID-WON the hosts: the naval host ends a raid its throw-back won - after the boarding\'s end, on both of the throw-back\'s branches (a legend\'s first wave too) - and the world host\'s endRaid ends a won one through raidAshore\'s `won` (mutants: either branch unended; the world host\'s arm unwired)', () => {
  const N = rd('src/scenes/naval/navalHost.js');
  const w = N.slice(N.indexOf('  function wonRaid(quest) {'), N.indexOf('  /** The fight won: a boarding\'s prize, or boarders thrown back. */'));
  assert.match(w, /if \(quest\) deps\.board\?\.endRaid\?\.\(quest, \{ won: true \}\);/);
  assert.doesNotMatch(w, /raidUids\.delete/, 'its uid kept until the quest ends - a late Leave Ship or wave still the sea fight\'s');
  const win = N.slice(N.indexOf('  function winBoarding(b, entry) {'), N.indexOf('    b.win();'));
  assert.match(win, /endBoarding\(\);\n\s*wonRaid\(b\.quest\);[^\n]*\n\s*deps\.mid\?\.\(`The boarders are thrown back, but/, 'a legend\'s first wave');   // PIN MOVED (VOICE2, in PLAIN-SWEEP's words): no dash aside (Voice.md rule 5)
  assert.match(win, /entry\.ship\.boarded = false;\n\s*endBoarding\(\);\n\s*wonRaid\(b\.quest\);[^\n]*\n\s*return;\n\s*\}\n\s*$/, 'thrown back');
  const W = hostText('src/scenes/world.js');
  assert.match(W, /endRaid: \(quest, \{ withdraw = false, won = false, crew = false \} = \{\}\) => \{\n\s*if \(!quest \|\| !questBridge\) return;\n\s*if \(won\) \{ raidAshore\.won\(quest\); return; \}[^\n]*\n\s*if \(crew\) raidAshore\.crew\(quest\);/);   // AUDIT FB1019 D2 (PIN MOVED): and her ship gone, its crew home
});

/**
 * AUDIT FB1019 (lane D, its own rig made a pin): THE REAL SEA FIGHT - the naval host (test/navalSea.mjs) grappled by a
 * pirate of `cls` over my wrecked boat, starting Warm Ashes' own raid through the real quest machine; its waves stood
 * where the host deals them (placeQuestFoe: her deck, or `RING` - the open ground's ring, which a raid of mine must never
 * take), on a pool shaped as the street's; world.js's own endRaid (lifted) over the real raidAshore; the machine's end
 * told to the naval host and the withdraw as world.js tells them. A frame and a quest tick each 0.1 s.
 */
async function seaRaid({ cls = 'pirateBrig', roll = 0, deckFull = () => false, save = null } = {}) {
  const pool = [];
  let now = 12 * 3600;
  const calls = [];
  const remove = (f) => { f.dead = true; f.withdrawn = true; };
  const ashore = createRaidAshore({ pools: () => [{ foes: () => pool, remove }] });
  let h = null;
  const m = new QuestMachine({
    nowSeconds: () => now,
    questFoeInstances: (sym) => pool.filter((f) => !f.dead && f.questBehaviour?.targetSymbol?.name === sym?.name),
    onQuestEnded: (q) => { h.host.raidEnded(q); ashore.questEnded(q); },
    playSound: (id) => { calls.push(['sound', id]); return true; },
  });
  m.registerAction(new LeaveShip(null));
  _resetWarmAshesShips();
  const quests = [];
  h = await sea({ hull: 2, save: save ?? { v: 1, boats: { 42: { hull: 0, sail: 0, crew: 24, fire: 0, state: 'wrecked', barrels: 4 } }, notoriety: {}, day: 1, raids: [] }, raidQuest: (name) => {
    const q = m.scheduleQuest(FILE(name), 0, { rolls: () => roll });
    const base = q.hooks;
    q.hooks = new Proxy({ ...base, world: {
      currentRegionIndex: () => 23,
      createFoeGameObjects: (foe, count) => Array.from({ length: count }, () => ({ foe })),
      tryPlaceFoe: (hd) => {
        const d = h.host.placeQuestFoe(hd.foe.parentQuest, () => !deckFull());
        if (d === false) return false;
        const qrb = new QuestResourceBehaviour(m);
        qrb.questUID = hd.foe.parentQuest.uid; qrb.targetSymbol = hd.foe.symbol;
        pool.push({ sym: hd.foe.symbol.name, foe: hd.foe, questBehaviour: qrb, dead: false, where: d ? 'deck' : 'RING', quest: hd.foe.parentQuest.uid,
          entity: { basics: ENEMY_BASICS[hd.foe.foeType] }, ai: { isHostile: true, wouldBeSpawned: true } });
        return true;
      },
    } }, { get: (t, k) => (k in t ? t[k] : () => {}) });
    quests.push(q);
    return q;
  } });
  h.deps.board.endRaid = new Function('d', `const { exteriorFoes, questBridge, raidAshore } = d; return ${ENDRAID[1]};`)({
    exteriorFoes: { foes: pool, removeFoe: remove }, questBridge: { machine: m }, raidAshore: ashore,
  });
  setWarmAshesHost({ currentRegionIndex: () => 23, ownsShip: () => true, setTransportModeShip: () => {}, setBlockVariant: () => {},
    leaveShipGate: (q) => { const g = h.host.leaveShipGate(q); calls.push(['gate', q.uid, g]); return g; } });
  const id = h.host.spawnShip(cls, { range: 16, bearing: Math.PI / 2, yaw: 0 });
  const p = h.host._sea.get(id);
  p.ship.pos = [16, 0, 0];
  h.host.frame(0.1);
  const step = (sec) => { for (let t = 0; t < sec - 1e-9; t += 0.1) { h.host.frame(0.1); now += 1; m.tick(); } };
  step(0.5);
  step(GRAPPLE_S + 0.3);
  const standing = (uid = null) => pool.filter((f) => !f.dead && (uid == null || f.quest === uid)).reduce((o, f) => ({ ...o, [`${f.sym}@${f.where}`]: (o[`${f.sym}@${f.where}`] ?? 0) + 1 }), {});
  const kill = (sym, n = 99) => { for (const f of pool.filter((x) => !x.dead && x.sym === sym).slice(0, n)) { f.dead = true; f.foe.incrementKills(); } };
  return { h, p, m, pool, ashore, calls, quests, step, standing, kill, tick: () => { now += 1; m.tick(); } };
}

test('RAID-WON on the real sea fight, the small raid\'s one way to a win (its Leave Ship): its uid the sea fight\'s through its grace - a wave waiting on a full deck never stood on the open ground\'s ring - and nothing of it standing once it ends (mutants: the uid let go at the Leave Ship; the won raid left running)', async () => {
  let full = false;
  const s = await seaRaid({ deckFull: () => full });
  const q = s.quests[0];
  s.step(2);
  assert.equal(s.standing()[`${RAID_CREW}@deck`], 5, 'its crew on my deck');
  full = true;
  s.kill(RAID_CREW, 5);   // five struck: `_callfriends_` calls five more, and the full deck makes them wait
  s.step(0.5);
  s.kill('warrior', 8);
  for (let t = 0; t < 5 && !s.calls.some((c) => c[0] === 'gate'); t++) s.tick();
  assert.deepEqual(s.calls.filter((c) => c[0] === 'gate'), [['gate', q.uid, 'naval']], 'its Leave Ship the sea fight\'s');
  assert.ok(q.ticksToEnd > 0, 'ending');
  assert.deepEqual(s.h.host.getSaveData().raids, [q.uid], 'in its grace, still mine');
  assert.equal(s.h.host.placeQuestFoe(q, () => true), false, 'and a wave of it stood nowhere - never the open ground\'s ring');
  s.tick(); s.tick(); s.tick();
  assert.equal(q.questTombstoned, true);
  assert.deepEqual(s.standing(), {}, 'nothing of it stands');
  assert.equal(s.pool.filter((f) => f.where === 'RING').length, 0, 'none ever stood on the ring');
  assert.deepEqual(s.h.host.getSaveData().raids, [], 'ended: mine no longer');
});

test('RAID-WON the pirate attack won (its leader down, seen by the sea fight\'s frame): its crew home, its quest ended with its grace tick whole - the victory gong it rides still rings (mutants: a break from outside a tick)', async () => {
  const s = await seaRaid({ cls: 'pirateFlagship', roll: 0.99 });
  const q = s.quests[0];
  s.step(2);
  assert.ok(s.standing()[`${RAID_CREW}@deck`] > 0, 'its crew on my deck');
  for (let i = 0; i < 40 && !s.pool.some((f) => f.sym === 'spells' && !f.dead); i++) { s.kill('warrior', 5); s.step(1); }   // its waves down until its leader comes
  assert.ok(s.pool.some((f) => f.sym === 'spells' && !f.dead), 'its leader stands');
  s.kill('spells');
  for (let t = 0; t < 30 && !q.questTombstoned; t++) s.step(0.1);
  assert.equal(q.questTombstoned, true, 'ended');
  assert.ok(s.calls.some((c) => c[0] === 'sound' && c[1] === 364), 'the levelup gong, rung in its grace tick');
  assert.equal(s.standing()[`${RAID_CREW}@deck`] ?? 0, 0, 'its crew home');
});

test('RAID-WON her ship gone from the sea under the fight: her stranded boarders fight on, her raid sends no more, and its crew goes home - never five Warriors on my deck counted as enemies near; won after, nothing of it stands (mutants: the crew left)', async () => {
  const s = await seaRaid();
  const q = s.quests[0];
  s.step(2);
  s.p.ship.damage.apply({ hull: s.p.ship.damage.hull, sail: 0, crew: 0 }, 0);
  for (let i = 0; i < 600 && s.h.host._sea.has(s.p.id); i++) s.step(0.1);
  assert.equal(s.h.host._sea.has(s.p.id), false, 'her ship gone');
  assert.equal(s.standing()[`${RAID_CREW}@deck`] ?? 0, 0, 'its crew home');
  assert.ok(Object.keys(s.standing()).some((k) => !k.startsWith(RAID_CREW)), 'her stranded boarders fight on');
  assert.equal(q.questTombstoned, true, 'her raid sends no more');
  for (const sym of Object.keys(s.standing()).map((k) => k.split('@')[0])) s.kill(sym);
  s.step(1);
  assert.deepEqual(s.standing(), {});
  assert.equal(areEnemiesNearby(s.pool), false);
});

test('RAID-WON a legend\'s boarders again: her first wave\'s raid ended with its win, the second wave its own - no crew of the first left on my deck beside the second\'s; a raid of mine a load carried, won by its Leave Ship, ended as won; and one whose ship left the sea in the tick its Leave Ship ran (mutants: a legend\'s first wave unended; the carried raid left running; her ship gone, the win unended)', async () => {
  const s = await seaRaid({ cls: 'legendHunger' });
  const q1 = s.quests[0];
  s.step(2);
  s.kill('warrior', 8);
  for (let i = 0; i < 3; i++) s.tick();
  s.step(3);
  assert.equal(q1.questTombstoned, true, 'the first wave\'s raid ended');
  assert.equal(s.quests.length, 2, 'the second wave its own raid');
  s.step(2);
  assert.deepEqual(s.standing(q1.uid), {}, 'nothing of the first stands beside the second');
  // a raid restored from a save: no boarding of it (the sea is not a save's), its uid mine - its Leave Ship won it
  const quest = { uid: 77, questTombstoned: false };
  const ended = [];
  const t = await sea({ hull: 2, save: { v: 1, boats: {}, notoriety: {}, day: 1, raids: [77] } });
  t.deps.board.endRaid = (q, o) => ended.push([q, o]);
  assert.equal(t.host.leaveShipGate(quest), 'naval', 'nothing sailed');
  assert.deepEqual(ended, [[quest, { won: true }]], 'ended as won');
  // her ship gone from the sea in the very tick its Leave Ship runs (before the sea fight's frame saw her go): won all the same
  const u = await seaRaid();
  const q2 = u.quests[0];
  const log = [];
  const end = u.h.deps.board.endRaid;
  u.h.deps.board.endRaid = (q, o) => { log.push(o); return end(q, o); };
  u.h.host._sea.delete(u.p.id);
  assert.equal(u.h.host.leaveShipGate(q2), 'naval');
  assert.deepEqual(log, [{ won: true }], 'her ship gone, the raid won and ended so');
  assert.equal(u.h.host.boarding, null);
});

test('RAID-WON `crew` and `late`: her ship gone, only the raid\'s own crew withdrawn; a wave landing after its raid is over (won, thrown back, let go) withdrawn as it lands - on the deck, the open ground\'s ring and below deck - never one of a raid running, nor another quest\'s landing after its quest ended (DFU\'s CreateFoe stood it) (mutants: crew taking the boarders; late keeping a lander; late taking a running raid\'s; late taking any quest\'s; the deck, the ring or below deck never asking it)', () => {
  const pool = [];
  const ashore = createRaidAshore({ pools: () => [{ foes: () => pool, remove: (f) => pool.splice(pool.indexOf(f), 1) }] });
  const q = { uid: 5, questName: 'WAQ_SHIP_SMALLRAID', questTombstoned: false };
  const mk = (sym, uid = 5) => ({ dead: false, questBehaviour: { questUID: uid, targetSymbol: { name: sym } } });
  pool.push(mk(RAID_CREW), mk('warrior'), mk(RAID_CREW), mk(RAID_CREW, 6));
  assert.equal(ashore.crew(q), 2);
  assert.deepEqual(pool.map((f) => [f.questBehaviour.targetSymbol.name, f.questBehaviour.questUID]), [['warrior', 5], [RAID_CREW, 6]]);
  const lander = mk('warrior');
  pool.push(lander);
  assert.equal(ashore.late(q, lander), false, 'its raid running: it stands');
  ashore.over(q);
  const late = mk('warrior');
  pool.push(late);
  assert.equal(ashore.late(q, late), true, 'its raid over: withdrawn as it lands');
  assert.equal(pool.includes(late), false);
  const gone = { uid: 9, questName: 'WAQ_SHIP_PIRATEATTACK', questTombstoned: true };
  const late2 = mk('warrior', 9);
  pool.push(late2);
  assert.equal(ashore.late(gone, late2), true, 'its raid ended');
  assert.equal(ashore.late(q, null), false);
  const other = { uid: 11, questName: 'M0B00Y16', questTombstoned: true };
  const late3 = mk('rat', 11);
  pool.push(late3);
  assert.equal(ashore.late(other, late3), false, 'another quest\'s foe stands');
  assert.ok(pool.includes(late3));
  const ring = rd('src/scenes/world.js');
  assert.match(ring, /questBehaviour: handle\.behaviour,\n\s*\}\)\)\.then\(\(f\) => raidAshore\.late\(foe\.parentQuest, f\)\)\.catch\(\(e\) => console\.error\('\[quest\] exterior foe stand failed:'/, 'the open ground\'s ring asks it');
  assert.match(ring, /raidLate: \(quest, f\) => raidAshore\.late\(quest, f\),/, 'and hands it below deck');
  assert.match(rd('src/scenes/worldModes.js'), /\}\)\)\.then\(\(f\) => host\.raidLate\?\.\(foe\.parentQuest, f\)\)\.catch\(\(e\) => console\.error\('\[quest\] interior foe stand failed:'/, 'below deck asks it');
  assert.match(rd('src/scenes/world.js'), /\.then\(\(f\) => \{ if \(!raidAshore\.late\(handle\.foe\?\.parentQuest, f\)\) navalDeckBody\(f, _deck\[2\]\); \}\)/, 'the deck\'s landing asks it');
});
