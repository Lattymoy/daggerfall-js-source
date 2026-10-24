// FIELD BUGS 2026-10-04e - the Arena's feedback (bible/01-Overview/bugs/Field-Bugs-2026-10-04e.md, report 2).
//
// Discord (Draugr): "Great feature and first tournament. But some small problems. Arrows are not refunded, which causes
// problems; The ghosts outside are bothersome (I know they're story related); The multiple npc arena fights will target
// each other despite being on the same team" - and then "The dungeon under the arena is also completely missing enemies".
// ARENA-ARROWS, CURSE-OFF-SAND, ARENA-TEAMS, UNDERCROFT-DEEP.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { QuestMachine } from '../../../src/systems/quest/machine.js';
import { loadQuestTables } from '../../../src/systems/quest/tables.js';

import { createArenaBouts } from '../../../src/scenes/arena/arenaBouts.js';
import { newArenaLadder, nextLadderBout } from '../../../src/systems/arena/arenaLadder.js';
import { ARENA_TEXT } from '../../../src/systems/arena/arenaText.js';
import { markQuiver, refundQuiver, QUIVER_TEMPLATES } from '../../../src/systems/arena/arenaQuiver.js';
import { keptOffArenaGround, ARENA_GROUND_M, ARENA_GROUND_QUESTS } from '../../../src/systems/arena/arenaGround.js';
import { boutTeammates } from '../../../src/combat/friendlyFire.js';
import { boutGate } from '../../../src/characters/enemy/enemyTargets.js';
import { arenaHudModel } from '../../../src/ui/arena/arenaHud.js';
import { undercroftPopulation, deepFoesOf, undercroftHallNear, UNDERCROFT_DEEP_M, UNDERCROFT_BEASTS, UNDERCROFT_PEOPLE } from '../../../src/world/arena/arenaUndercroft.js';
import { spendAmmoFor, ARROW_TEMPLATE } from '../../../src/systems/inventory.js';
import { startShotTally, stopShotTally, noteShot, noteShotRecoverable } from '../../../src/systems/shotTally.js';
import { playerArrowHitFoe } from '../../../src/combat/arrowFlight.js';
import { PELLET_TEMPLATE } from '../../../src/characters/thunderlockIds.js';

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const settle = () => new Promise((r) => setTimeout(r, 0));
const arrows = (n, extra = {}) => ({ name: 'Arrow', group: 'Weapons', templateIndex: ARROW_TEMPLATE, stackCount: n, ...extra });
const realArrows = (items) => items.filter((i) => i.templateIndex === ARROW_TEMPLATE && !i.timeForItemToDisappear).reduce((n, i) => n + i.stackCount, 0);

// ── ARENA-ARROWS ────────────────────────────────────────────────────────────────────────────────────────────────────

test('ARENA-ARROWS law: the quiver is counted as the bout begins and what it LOOSED is handed back - real stacks only, never more than went in or was loosed, a stack spent to nothing stood again (mutants: conjured counted; a refund past the mark; the drop handed back; the tally unread; the empty stack lost)', () => {
  assert.deepEqual([...QUIVER_TEMPLATES], [ARROW_TEMPLATE, PELLET_TEMPLATE], 'every ammunition inventory.js spendAmmoFor spends');
  const items = [arrows(20), arrows(3, { timeForItemToDisappear: 99 }), arrows(4, { questItem: true })];
  const mark = markQuiver(items);
  assert.deepEqual(mark.map((m) => [m.template, m.count]), [[ARROW_TEMPLATE, 20]], 'the twenty real arrows - not the conjured, not the quest\'s');
  startShotTally(items);
  for (let i = 0; i < 5; i++) spendAmmoFor(items, null);   // three conjured first, then two real
  const shots = stopShotTally();
  assert.deepEqual([...shots], [[ARROW_TEMPLATE, 2]], 'the tally counts the two real shots');
  assert.equal(realArrows(items.filter((i) => !i.questItem)), 18);
  assert.equal(refundQuiver(items, mark, shots), 2, 'the two real arrows the bout loosed');
  assert.equal(items.find((i) => !i.questItem && !i.timeForItemToDisappear).stackCount, 20, 'onto the stack they came off');
  assert.equal(refundQuiver(items, mark, shots), 0, 'nothing twice');
  // DROPPED, not loosed: the dropped stack still lies on the sand - it never comes back as well
  const drop = [arrows(30)];
  const md = markQuiver(drop);
  drop[0].stackCount -= 12;   // twelve dropped
  assert.equal(refundQuiver(drop, md, new Map([[ARROW_TEMPLATE, 3]])), 3, 'the three loosed, not the twelve dropped');
  assert.equal(drop[0].stackCount, 21);
  assert.equal(refundQuiver([arrows(10)], markQuiver([arrows(15)]), null), 0, 'nothing loosed (no tally), nothing paid');
  // spent to nothing
  const two = [arrows(2), { name: 'Pellet', group: 'Weapons', templateIndex: PELLET_TEMPLATE, stackCount: 6 }];
  const m2 = markQuiver(two);
  spendAmmoFor(two, null); spendAmmoFor(two, null);
  two.find((i) => i.templateIndex === PELLET_TEMPLATE).stackCount = 1;
  assert.equal(two.some((i) => i.templateIndex === ARROW_TEMPLATE), false, 'the quiver emptied');
  assert.equal(refundQuiver(two, m2, new Map([[ARROW_TEMPLATE, 2], [PELLET_TEMPLATE, 5]])), 2 + 5);
  assert.equal(two.find((i) => i.templateIndex === ARROW_TEMPLATE)?.stackCount, 2, 'a new stack off the copy');
  assert.equal(two.find((i) => i.templateIndex === PELLET_TEMPLATE)?.stackCount, 6, 'and the Thunderlock\'s pellets too');
  // more than went in: nothing
  const grown = [arrows(5)];
  const m3 = markQuiver(grown);
  grown[0].stackCount = 9;
  assert.equal(refundQuiver(grown, m3, new Map([[ARROW_TEMPLATE, 4]])), 0);
  assert.equal(grown[0].stackCount, 9);
  assert.equal(refundQuiver(null, m3, shots), 0); assert.equal(refundQuiver(grown, null, shots), 0);
});

test('ARENA-ARROWS tally: a real round spent from the watched pack is a shot, a shaft lodged in a foe that can be looted is not - one in a bout fighter or a relay opponent\'s stand-in is lost and pays (mutants: the conjured round counted; any pack counted; the lodge uncounted; the bout fighter\'s lodge uncounted)', () => {
  const pack = [arrows(4, { timeForItemToDisappear: 9 }), arrows(10)], other = [arrows(10)];
  startShotTally(pack);
  spendAmmoFor(pack, null);   // conjured
  spendAmmoFor(other, null);   // not the watched pack
  spendAmmoFor(pack, null); spendAmmoFor(pack, null); spendAmmoFor(pack, null);   // the rest conjured
  for (let i = 0; i < 4; i++) spendAmmoFor(pack, null);   // four real
  const bow = { weapon: { templateIndex: 130, name: 'Long Bow' }, pos: [0, 0, 0] };
  const foe = (extra = {}) => ({ dead: false, entity: { items: [], basics: {}, level: 1, stats: {}, skills: {}, ...extra }, ai: { feet: [0, 0, 0], yaw: 0, height: 1.8 } });
  const player = { level: 1, items: pack, stats: {}, skills: {} };
  const lodges = () => 0;   // PIN MOVED (ARROW-LODGE): each shaft survives its strike (under ARROW_LODGE_CHANCE) - the pin is where it lodges
  playerArrowHitFoe(bow, foe(), { playerEntity: player, rolls: lodges });   // a wild foe: lootable
  playerArrowHitFoe(bow, foe({ bout: { id: 'b' } }), { playerEntity: player, rolls: lodges });   // a bout fighter: lost
  playerArrowHitFoe(bow, { ...foe(), rival: 'p1' }, { playerEntity: player, rolls: lodges });   // a relay opponent's stand-in: lost
  assert.deepEqual([...stopShotTally()], [[ARROW_TEMPLATE, 3]], 'four real shots, one lodged where it can be looted');
  noteShot(pack, ARROW_TEMPLATE); noteShotRecoverable(ARROW_TEMPLATE);
  assert.equal(stopShotTally(), null, 'stopped: nothing counted after');
  assert.match(read('src/systems/inventory.js'), /const real = !isSummoned\(getItem\(list, opts\.group, template, opts\)\);\n  if \(!removeOne\(list, template, opts\)\) return false;\n  if \(real\) noteShot\(list, template\);/);
});

/** test/systems/arena/audit1003_bouts.test.js's rig, cut down: a ladder bout on a fake floor, the driver's doors logged. */
async function ladderRig(items) {
  let t = 1000;
  const log = { say: [], heal: 0 };
  const P = { name: 'Hero', health: 100, maxHealth: 100, arenaLadder: newArenaLadder(), goldPieces: 5000, items, arenaLeague: null };
  const foes = [];
  const stage = {
    kind: 'floor', centre: () => [50, 0, 40],
    spawn: async (mobile, feet, o) => { const f = { mobile, o, entity: { health: 60, maxHealth: 60, bout: o.bout, items: [] }, ai: { feet: [...feet], target: null, isHostile: true } }; foes.push(f); return f; },
    remove: () => {}, heightAt: () => null,
  };
  const A = createArenaBouts({
    now: () => t, rng: () => 0.99, playerEntity: P, setPlayerBout: () => {},
    say: (l) => log.say.push(l), notice: () => {}, pay: () => {}, heal: () => { log.heal++; P.health = P.maxHealth; },
    crime: () => {}, drawHud: () => {}, sound: { cue: () => {}, bed: () => {}, stop: () => {} }, gameMinutes: () => 523530,
  });
  A.setStage(stage);
  A.ask({ where: 'floor', kind: 'ladder', next: nextLadderBout(P.arenaLadder) });
  await settle();
  const step = (ms) => { t += ms; A.frame(ms / 1000, { playerFeet: [44, 0, 40], sheathed: false }); };
  return { A, P, foes, log, step };
}

test('ARENA-ARROWS driven: a ladder bout fought with the bow - its healers hand back every real arrow it loosed, never one dropped, and say so (mutants: no mark at the bout; no refund at the heal; the drop handed back)', async () => {
  const items = [arrows(12), arrows(2, { timeForItemToDisappear: 50 })];
  const r = await ladderRig(items);
  for (let i = 0; i < 200 && r.A.bout()?.phase !== 'fight'; i++) r.step(100);
  assert.equal(r.A.bout().phase, 'fight');
  for (let i = 0; i < 7; i++) spendAmmoFor(r.P.items, null);   // two conjured, then five real
  r.P.items.find((i) => i.templateIndex === ARROW_TEMPLATE && !i.timeForItemToDisappear).stackCount -= 2;   // and two dropped on the sand
  assert.equal(realArrows(r.P.items), 5);
  const f = r.foes[0];
  f.entity.health = 0; f.entity.bout.out = true; f.entity.bout.hooks.floor?.(f, { fromPlayer: true });
  for (let i = 0; i < 400 && r.A.bout()?.phase !== 'done'; i++) r.step(100);
  assert.equal(r.A.bout().phase, 'done');
  assert.ok(r.log.heal >= 1, 'the healers came');
  assert.equal(realArrows(r.P.items), 10, 'every real arrow loosed back - the two dropped are not');
  assert.ok(r.log.say.includes(ARENA_TEXT.ammoBack(5)), `said: ${r.log.say.join(' | ')}`);
  assert.equal(r.A.refundQuiver(), 0, 'and paid once - a later let-go hands back nothing more');
});

test('ARENA-ARROWS driven: a bout dismissed before its healers stops its tally - the let-go\'s heal pays what the bout loosed, never a shot taken after it went (mutants: the tally left running; the dismissed quiver dropped)', async () => {
  const r = await ladderRig([arrows(20)]);
  for (let i = 0; i < 200 && r.A.bout()?.phase !== 'fight'; i++) r.step(100);
  assert.equal(r.A.bout().phase, 'fight');
  for (let i = 0; i < 3; i++) spendAmmoFor(r.P.items, null);
  r.A.dismiss();   // a session's let-go: the bout first (scenes/arena/arenaOnline.js letGoPriv)...
  for (let i = 0; i < 4; i++) spendAmmoFor(r.P.items, null);   // ...shots after it are no bout's
  assert.equal(r.A.refundQuiver(), 3, '...then the healers: the three the bout loosed');
  assert.equal(realArrows(r.P.items), 16);
  assert.equal(r.A.refundQuiver(), 0, 'paid once');
});

test('ARENA-ARROWS: a private session\'s bout let go before its healers hands the quiver back too (the world host\'s session door)', () => {
  assert.match(read('src/scenes/world.js'), /heal: \(\) => \{ arenaHeal\(\); arenaBouts\.refundQuiver\(\); \},/);
});

// ── ARENA-TEAMS ─────────────────────────────────────────────────────────────────────────────────────────────────────

test('ARENA-TEAMS: a two-against-one\'s pair are teammates and a blast of one passes the other by; a Grand Melee has none (mutants: the side ignored; the blast\'s skip gone; a caster without its foe)', () => {
  const tag = (id, side) => ({ entity: { bout: { id, side, out: false, hold: false } } });
  const a = tag('b1', 1), b = tag('b1', 1), me = tag('b1', 0), other = tag('b2', 1);
  assert.equal(boutTeammates(a, b), true, 'one bout, one side');
  assert.equal(boutGate(a, b, false), false, 'and the gate already kept them out of each other\'s targets');
  assert.equal(boutTeammates(a, me), false, 'across the sand');
  assert.equal(boutTeammates(a, other), false, 'another bout');
  assert.equal(boutTeammates(a, a), false, 'nobody is their own teammate');
  assert.equal(boutTeammates(a, { entity: {} }), false);
  assert.equal(boutTeammates({ entity: {} }, { entity: {} }), false, 'no bout, no team');
  assert.equal(boutTeammates(tag('m', 1), tag('m', 2)), false, 'a Grand Melee: each a side of its own');
  const M = read('src/scenes/hostMagic.js');
  const blast = M.slice(M.indexOf('function explodeAt('), M.indexOf('applySpellToFoe(spell, casterLevel, t, caster);', M.indexOf('function explodeAt(')));
  assert.match(blast, /if \(caster\?\.foe && boutTeammates\(caster\.foe, t\)\) continue;/, 'the blast passes a teammate by');
  // the floor's instance is a dungeon level: its foe missiles' blasts carry their foe as hostMagic's own do
  const D = read('src/scenes/dungeonContext.js');
  for (const w of ['wCaster', 'fCaster', 'mCaster']) assert.match(D, new RegExp(`const ${w} = m\\.casterFoe \\? \\{ entity: m\\.casterFoe\\.entity, sinks: foeSinks\\(m\\.casterFoe\\), foe: m\\.casterFoe \\} : null;`), w);
});

test('ARENA-TEAMS: the HUD calls a Grand Melee "each alone" between its columns, a team bout "vs" (mutants: the melee test inverted; the word never written)', () => {
  const f = (id, side) => ({ id, name: id, side, health: 10, maxHealth: 10 });
  const at = (fighters) => arenaHudModel({ phase: 'fight', fighters, fightAt: 0, limitMs: 180000 }, null, 0, { you: 'you' });
  assert.equal(at([f('you', 0), f('a', 1), f('b', 2), f('c', 3)]).vs, ARENA_TEXT.hud.eachAlone, 'every fighter a side of its own');
  assert.equal(at([f('you', 0), f('a', 1), f('b', 1)]).vs, ARENA_TEXT.hud.vs, 'two against one: a team');
  assert.equal(at([f('you', 0), f('a', 1)]).vs, ARENA_TEXT.hud.vs, 'a duel');
  assert.match(read('src/ui/arena/arenaHud.js'), /if \(\(model\.vs \?\? ARENA_TEXT\.hud\.vs\) !== shown\.vs\) \{ shown\.vs = model\.vs \?\? ARENA_TEXT\.hud\.vs; parts\.vs\.textContent = shown\.vs; \}/);
});

// ── CURSE-OFF-SAND ──────────────────────────────────────────────────────────────────────────────────────────────────

test('CURSE-OFF-SAND: the Curse of Daggerfall\'s wave waits outside the arena\'s grounds and its levels; any other quest\'s is placed as ever (mutants: every quest kept off; the reach inverted; the levels open)', () => {
  assert.deepEqual([...ARENA_GROUND_QUESTS], ['S0000977']);
  const centre = [100, 0, 100];
  const near = [100 + ARENA_GROUND_M - 1, 0, 100], far = [100 + ARENA_GROUND_M + 1, 0, 100];
  assert.equal(keptOffArenaGround({ questName: 'S0000977', feet: near, centre }), true, 'at the gate: the wave waits');
  assert.equal(keptOffArenaGround({ questName: 's0000977', feet: near, centre }), true, 'by name, as the machine reads one');
  assert.equal(keptOffArenaGround({ questName: 'S0000977', feet: far, centre }), false, 'past the grounds: the curse as ever');
  assert.equal(keptOffArenaGround({ questName: 'S0000977', feet: near, centre: null }), false, 'no arena built: nothing kept');
  assert.equal(keptOffArenaGround({ questName: 'S0000977', inArenaLevel: true }), true, 'the floor\'s instance, the undercroft');
  assert.equal(keptOffArenaGround({ questName: 'M0B00Y16', feet: near, centre }), false, 'another quest\'s foe');
  assert.equal(keptOffArenaGround({ questName: 'M0B00Y16', inArenaLevel: true }), false);
  assert.equal(keptOffArenaGround({ questName: null, feet: near, centre }), false);
  // the hosts whose quest world CreateFoe asks: both exteriors, and the modes host for the dungeon arm (the floor's
  // instance and the undercroft are dungeon levels; dungeonContext.js stands what worldModes.js places - THE FOUR HOSTS
  // RULE). No host refuses at PLACEMENT any more - a pending wave raises the encounter event every tick it waits
  for (const host of ['world.js', 'exterior.js']) {
    assert.match(read(`src/scenes/${host}`), /foeKeptOff: \(foe\) => \(\(modes\?\.mode \?\? 'exterior'\) !== 'exterior'\n\s*\? !!modes\?\.questFoeKeptOff\?\.\(foe\)\n\s*: keptOffArenaGround\(\{ questName: foe\?\.parentQuest\?\.questName, feet: player\.pos, centre: arenaCity(Pixel\(\)|Origin) \? arenaCityStage\.centre\(\) : null \}\)\),/, host);
    const src = read(`src/scenes/${host}`), at = src.indexOf('tryPlaceFoe: (handle) => {');
    assert.ok(at > 0 && !src.slice(at, at + 6000).includes('keptOffArenaGround'), `${host}: no refusal at placement`);
  }
  assert.match(read('src/scenes/worldModes.js'), /questFoeKeptOff\(foe\) \{\n\s*return mode === 'dungeon' && keptOffArenaGround\(\{ questName: foe\?\.parentQuest\?\.questName, inArenaLevel: isArenaFloor\(dungeonLoc\) \|\| isArenaUndercroft\(dungeonLoc\) \}\);/);
});

test('CURSE-OFF-SAND driven: a wave kept off passes at CreateFoe\'s spawn event as a hidden Foe\'s does - no wave pending, so no encounter event raised every tick to break a rest on the grounds; off the grounds the next interval\'s wave comes (mutants: the seam unasked)', () => {
  const VENDOR = new URL('../../../vendor/dfu-quests/Tables/', import.meta.url);
  const sources = {};
  for (const f of readdirSync(VENDOR)) if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = readFileSync(new URL(f, VENDOR), 'utf8').replace(/^\uFEFF/, '');
  loadQuestTables(sources);
  const kept = { v: true };
  const world = {
    currentRegionIndex: () => 0, isPlayerInLocationRect: () => true, created: 0, placed: 0, raised: 0, asked: [],
    createFoeGameObjects: (foe, count) => { world.created++; return Array.from({ length: count }, (_, i) => ({ i })); },
    tryPlaceFoe: () => { world.placed++; return true; }, raiseOnEncounterEvent() { world.raised++; },
    foeKeptOff: (foe) => { world.asked.push(foe?.symbol?.name ?? null); return kept.v; },
  };
  const clock = { t: 100000 };
  const m = new QuestMachine({ nowSeconds: () => clock.t, world, questClockStepMax: () => Infinity, showPopup() {} });
  const q = m.scheduleQuest(['Quest: __QK', 'QRC:', 'Message:  1011', ' x', '', 'QBN:', 'Foe _ghost_ is 2 Ghost', '', ' create foe _ghost_ every 60 minutes 9 times with 100% success'], 0, { rolls: () => 0.4 });
  const act = [...q.tasks.values()].flatMap((t) => t.actions).find((a) => a.constructor.name === 'CreateFoe');
  assert.ok(act);
  for (let i = 0; i < 12 * 60; i++) { clock.t += 60; m.tick(); }   // twelve hours resting on the grounds
  assert.ok(world.asked.length >= 10, `the seam was asked at each spawn event: ${world.asked.length}`);
  assert.equal(world.created, 0, 'no wave made');
  assert.equal(act.spawnInProgress, false, 'none pending');
  assert.equal(world.raised, 0, 'and no encounter event - the rest is never broken');
  kept.v = false;
  for (let i = 0; i < 61; i++) { clock.t += 60; m.tick(); }
  assert.equal(world.created, 1, 'off the grounds: the next interval\'s wave');
  assert.equal(world.placed, 2, 'both stood');
});

// ── UNDERCROFT-DEEP ─────────────────────────────────────────────────────────────────────────────────────────────────

test('UNDERCROFT-DEEP: past a block from the hall the keep\'s own foes stand again - the hall\'s block stays quiet, and a rest is broken only out there (mutants: the reach dropped; every quiet marker deep; the near list without the stair)', () => {
  // a start, then 60 random markers 4 m apart out along x - 240 m of cellar
  const markers = [{ archive: 199, record: 10, x: 0, y: 1, z: 0 }];
  for (let i = 1; i <= 60; i++) markers.push({ archive: 199, record: 15, x: i * 4, y: 1, z: 0 });
  const blocks = [{ layout: { markers, flats: [] }, originX: 0, originZ: 0 }];
  const h = undercroftPopulation(blocks);
  const used = 2 + UNDERCROFT_PEOPLE.length + UNDERCROFT_BEASTS.length;   // the pit, the Hall, the people, the beasts
  const lastHall = used * 4;   // the furthest marker the hall took
  assert.ok(h.deep.length > 0, 'the deep cellars hold foes');
  assert.ok(h.deep.every((m) => m.x - lastHall >= UNDERCROFT_DEEP_M), 'every one a block past the hall');
  assert.equal(h.deep[0].x, Math.ceil((lastHall + UNDERCROFT_DEEP_M) / 4) * 4, 'the first marker past the reach');
  assert.equal(h.quiet + h.deep.length + used, 60, 'every marker is the hall\'s, quiet or deep');
  assert.deepEqual(h.near[0], [0, 1, 0], 'the reach is measured from the stair too');
  // the layout's foes at those markers, and only those
  const layout = markers.slice(1).map((m) => ({ x: m.x, y: m.y, z: m.z, mobileType: 128 }));
  const deep = deepFoesOf(layout, h.deep);
  assert.deepEqual(deep.map((e) => e.x), h.deep.map((m) => m.x));
  // the rest: in the hall's reach, never broken; out in the deep, the keep's
  assert.equal(undercroftHallNear(h, [lastHall + 10, 1, 0]), true);
  assert.equal(undercroftHallNear(h, [h.deep.at(-1).x, 1, 0]), false);
  assert.equal(undercroftHallNear(null, [0, 0, 0]), false);
  // a small undercroft (the ARENA-FIX 4 rig): all of it the hall's reach - nothing deep
  const small = [{ archive: 199, record: 10, x: 0, y: 1, z: 0 }];
  for (let i = 1; i <= 20; i++) small.push({ archive: 199, record: 15, x: i * 3, y: 1, z: 0 });
  assert.equal(undercroftPopulation([{ layout: { markers: small, flats: [] }, originX: 0, originZ: 0 }]).deep.length, 0);
});
