// AUDIT SD III, SD20g (2026-10-08, Mac: "a deep comprehensive audit over everything, ensuring absolute polish and
// perfection"; bible/11-Multiplayer/Super-Dungeons.md "AUDIT SD III"): THE DELVE ARC AND THE DUNGEONS' SIZES - the
// lens's findings, each reproduced and pinned here: a fall is one way on the way out (D1); the online split said as it
// is built (D2); an ended quest marks nothing (D3); the way out never builds its whole field each second, nor asks two
// thousand rays at once (D4); a quest shared online laid on this page's sizes (D5) and never re-stamped by a link
// online (D6); the held map's tier read once a place (D7); the Smaller dungeons row says the law (D8).
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  automapTrailTick, automapWaySteps, TRAIL_FALL_M, TRAIL_FILL_M, TRAIL_LAND_FILL_M, TRAIL_DROPS_MAX,
  snapshotAutomap, restoreAutomap, resetAutomapStore, enterDungeonAutomap, bindAutomapLayout, buildRevealIndex, hideAllAutomap,
} from '../src/systems/automap.js';
import { trailCells, nearestCell, wayField, createWayOut, attachCells, WAY_STEP_DY, WAY_FIELD_S, WAY_REFIELD_S, WAY_ASK_MS } from '../src/systems/wayOut.js';
import { walkSpeed, runSpeed, GRAVITY, EYE_HEIGHT } from '../src/player/motor.js';
import { dungeonQuestMarks, questCompassPick, questEnded } from '../src/systems/questGuidance.js';
import { relayQuestOnline } from '../src/systems/quest/questRepair.js';
import { SITE_TYPES } from '../src/systems/quest/place.js';
import { adoptLinkedDungeonSize, ONLINE_DUNGEONS_STATE, MEDIUM_DUNGEONS_STATE, SMALLER_DUNGEONS_STATE } from '../src/world/smallerDungeons.js';
import { FEATURES } from '../src/systems/features.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const ALL = () => true;

// ── D1: a fall is one way ──────────────────────────────────────────────

/** A walk east off a ledge at x 10 at `speed`, falling to -`drop` (the motor's own fall: `fallStart` where it left the
 *  ground), sampled at the scan's 5 Hz through the real tick - and on to x 22. */
function fallWalk(speed, drop) {
  const rec = { trail: new Set() };
  let x = 0.5, y = 0, vy = 0, falling = false, fallStart = 0;
  automapTrailTick(rec, [x, y + EYE_HEIGHT, 0.5], EYE_HEIGHT, null);
  for (let t = 0; t < 30; t += 0.2) {
    x += speed * 0.2;
    if (x > 10 && y > -drop) { if (!falling) { falling = true; fallStart = y; } vy -= GRAVITY * 0.2; y = Math.max(-drop, y + vy * 0.2); }
    if (y <= -drop && falling) falling = false;
    automapTrailTick(rec, [x, y + EYE_HEIGHT, 0.5], EYE_HEIGHT, falling ? fallStart : null);
    if (y <= -drop && x > 22) break;
  }
  return { rec, trail: rec.trail, landing: [x, -drop, 0.5] };
}
/** A stair walked on the ground at `slope` (rise per run) for 10 m of run, then 5 m on its top. */
function stairWalk(speed, slope) {
  const rec = { trail: new Set() };
  for (let s = 0; s <= 10.0001; s += speed * 0.2 / Math.hypot(1, slope)) automapTrailTick(rec, [0.5 + s, s * slope + EYE_HEIGHT, 0.5], EYE_HEIGHT, null);
  for (let s = 0; s <= 5; s += speed * 0.2) automapTrailTick(rec, [10.5 + s, 10 * slope + EYE_HEIGHT, 0.5], EYE_HEIGHT, null);
  return rec.trail;
}

test('SD20g A FALL IS ONE WAY (D1): the trail laid a fall as a column of cells half a metre apart, and the way out walked the player back up drops of two, four and six metres they could not climb - at a walk and at a run. Now a sample taken in the air is not stood in, and a landing more than TRAIL_FALL_M below where its fall began is not filled: the drop is walked down, never up; a step down and a hop are filled as ever, and a stair walked on the ground, at thirty to fifty-three degrees, is a way both ways (mutants: the air stood in; every landing filled; the fall\'s height unread)', () => {
  assert.equal(TRAIL_FALL_M, WAY_STEP_DY, 'the way out\'s own step');
  assert.equal(TRAIL_LAND_FILL_M, 2 * TRAIL_FILL_M);
  for (const speed of [walkSpeed(50), runSpeed(50, 50)]) {
    for (const drop of [1.5, 2, 4, 6]) {
      const { rec, trail, landing } = fallWalk(speed, drop);
      const c = trailCells(trail);
      const up = wayField(c, nearestCell(c, [0.5, 0, 0.5]));
      assert.equal(up.next[nearestCell(c, landing)], -1, `${speed.toFixed(1)} m/s, ${drop} m: never walked back up`);
      // walked DOWN it: the drop kept as a one-way step (a teleporter's kind), the field from the landing reaching the top
      const steps = automapWaySteps(rec);
      assert.equal(steps.length, 1, 'the drop kept, once');
      const ends = steps.map((x) => [nearestCell(c, x.entrance.pos), nearestCell(c, x.exit.pos)]);
      const down = wayField(c, nearestCell(c, landing), ends);
      const top = nearestCell(c, [0.5, 0, 0.5]);
      assert.ok(down.next[top] >= 0, `${speed.toFixed(1)} m/s, ${drop} m: walked down it`);
      assert.ok(!c.pts.some((p) => p[1] < -0.5 && p[1] > -drop + 0.25), 'nothing in the air stood in');
    }
    const { trail, landing } = fallWalk(speed, 0.6);
    const c = trailCells(trail);
    assert.ok(wayField(c, nearestCell(c, [0.5, 0, 0.5])).next[nearestCell(c, landing)] >= 0, 'a step down is a step');
  }
  for (const slope of [Math.tan(Math.PI / 6), 1, 4 / 3]) {
    for (const speed of [walkSpeed(50), runSpeed(50, 50)]) {
      const c = trailCells(stairWalk(speed, slope));
      const top = nearestCell(c, [15.5, 10 * slope, 0.5]), bottom = nearestCell(c, [0.5, 0, 0.5]);
      assert.ok(wayField(c, top).next[bottom] >= 0, `a stair of ${slope.toFixed(2)} at ${speed.toFixed(1)} m/s: up`);
      assert.ok(wayField(c, bottom).next[top] >= 0, `...and down`);
    }
  }
  // a hop on level ground: the samples in the air not stood in, the landing filled from the take-off
  const hop = { trail: new Set() };
  automapTrailTick(hop, [0.5, EYE_HEIGHT, 0.5], EYE_HEIGHT, null);
  automapTrailTick(hop, [1.5, 0.6 + EYE_HEIGHT, 0.5], EYE_HEIGHT, 0);
  automapTrailTick(hop, [2.5, 0.8 + EYE_HEIGHT, 0.5], EYE_HEIGHT, 0);
  automapTrailTick(hop, [3.5, EYE_HEIGHT, 0.5], EYE_HEIGHT, null);
  assert.deepEqual([...hop.trail].sort(), ['0,0,0', '1,0,0', '2,0,0', '3,0,0'], 'the hop\'s ground, filled; its air, not');
  // the hosts hand the motor's fall to the tick
  assert.match(read('src/scenes/worldModes.js'), /motorState: \(\) => \(\{ eyeLevel: player\.eye\[1\] - player\.pos\[1\], capsule: player\.height, fallFrom: player\.falling \? player\.fallStart : null \}\),/);
  assert.match(read('src/scenes/dungeon.js'), /fallFrom: _motorRef\.falling \? _motorRef\.fallStart : null/);
  assert.match(read('src/scenes/dungeonContext.js'), /automapTrailTick\(automapRec, eye, ms\?\.eyeLevel, ms\?\.fallFrom \?\? null\);/);
});

test('SD20g A DROP IS A WAY DOWN, KEPT WITH THE TRAIL (D1): each drop taken is kept on the dungeon\'s record as a one-way step - the last place stood in, then the landing, once a pair of cells, the oldest let go past TRAIL_DROPS_MAX - handed to the way out with the walked teleporters; saved and loaded with the trail, and gone with it when the layout is another or the map is hidden (mutants: the drop unkept; unsaved; unread back; kept across a new layout)', () => {
  const BIG = { min: [-1000, -1000, -1000], max: [1000, 1000, 1000] };
  resetAutomapStore();
  try {
    const model = buildRevealIndex([{ key: '0:1', aabb: BIG, blockIndex: 0, blockName: 'LIVE.RDB' }]);
    const rec = enterDungeonAutomap('sd20g/drop', 0);
    bindAutomapLayout(rec, model);
    automapTrailTick(rec, [10.5, EYE_HEIGHT, 0.5], EYE_HEIGHT, null);
    automapTrailTick(rec, [11.5, -1 + EYE_HEIGHT, 0.5], EYE_HEIGHT, 0);
    automapTrailTick(rec, [12.5, -4 + EYE_HEIGHT, 0.5], EYE_HEIGHT, null);
    automapTrailTick(rec, [12.6, -4 + EYE_HEIGHT, 0.5], EYE_HEIGHT, null);
    assert.equal(rec.drops.size, 1);
    assert.deepEqual(automapWaySteps(rec), [{ entrance: { pos: [10.5, 0, 0.5] }, exit: { pos: [12.5, -4, 0.5] } }], 'from the ledge to the landing');
    automapTrailTick(rec, [10.5, EYE_HEIGHT, 0.5], EYE_HEIGHT, null);
    automapTrailTick(rec, [11.5, -1 + EYE_HEIGHT, 0.5], EYE_HEIGHT, 0);
    automapTrailTick(rec, [12.5, -4 + EYE_HEIGHT, 0.5], EYE_HEIGHT, null);
    assert.equal(rec.drops.size, 1, 'the same drop once');
    const snap = snapshotAutomap(0);
    assert.deepEqual(snap['sd20g/drop'].drops, [[10.5, 0, 0.5, 12.5, -4, 0.5]], 'saved');
    resetAutomapStore();
    restoreAutomap(JSON.parse(JSON.stringify({ ...snap, 'sd20g/drop': { ...snap['sd20g/drop'], drops: [...snap['sd20g/drop'].drops, [1, 2, 'x', 4, 5, 6], 'junk'] } })));
    const loaded = enterDungeonAutomap('sd20g/drop', 0, { fromLoad: true });
    bindAutomapLayout(loaded, model);
    assert.deepEqual([...loaded.drops.values()], [[10.5, 0, 0.5, 12.5, -4, 0.5]], 'loaded back, what is not six numbers dropped');
    hideAllAutomap(loaded);
    assert.equal(loaded.drops, undefined, 'the map hidden: no drop known');
    restoreAutomap({ 'sd20g/other': { revealed: ['0:1'], visitedThisRun: [], entranceDiscovered: true, lastVisited: 0, blockNames: ['OTHER.RDB'], notes: [], teleporters: [], trail: ['1,0,0'], drops: [[0, 0, 0, 1, -3, 0]] } });
    const other = enterDungeonAutomap('sd20g/other', 0, { fromLoad: true });
    assert.equal(other.drops.size, 1);
    bindAutomapLayout(other, model);
    assert.equal(other.drops, undefined, 'another layout: gone with its trail');
    // the oldest let go past TRAIL_DROPS_MAX
    const many = { trail: new Set() };
    for (let k = 0; k <= TRAIL_DROPS_MAX; k++) {
      automapTrailTick(many, [k * 10 + 0.5, EYE_HEIGHT, 0.5], EYE_HEIGHT, null);
      automapTrailTick(many, [k * 10 + 1.5, -1 + EYE_HEIGHT, 0.5], EYE_HEIGHT, 0);
      automapTrailTick(many, [k * 10 + 2.5, -3 + EYE_HEIGHT, 0.5], EYE_HEIGHT, null);
    }
    assert.equal(many.drops.size, TRAIL_DROPS_MAX);
    assert.equal(many.drops.values().next().value[0], 10.5, 'the first let go');
  } finally { resetAutomapStore(); }
});

// ── D2: the split said as it is built ──────────────────────────────────

test('SD20g THE ONLINE SPLIT SAID AS IT IS BUILT (D2): the draw is a quarter small, half medium, a quarter whole, but a dungeon of five blocks or fewer is small whatever it draws and one of eight or fewer never more than medium - section 13 said the Bay\'s dungeons were split so; it says now what is built, and that weighting the draw is Mac\'s call (mutant: the old line)', () => {
  const doc = read('bible/11-Multiplayer/Super-Dungeons.md');
  const page = doc.slice(doc.indexOf('\n## 13.'), doc.indexOf('\n## 14.'));   // section 13, the online law (the audit's record quotes the old line)
  assert.ok(page.length > 1000, 'section 13');
  assert.match(page, /a quarter of the DRAWS small, half\s+medium, a quarter whole/);
  assert.match(page, /What is BUILT is not that split/);
  assert.doesNotMatch(page, /a quarter of the Bay's dungeons\s+small, half medium, a quarter whole/);
});

// ── D3: an ended quest marks nothing ─────────────────────────────────

test('SD20g AN ENDED QUEST MARKS NOTHING (D3): a tombstoned quest stays in the machine a game week, its stands standing and its behaviours bound to it - the Exact tier marked its item, its people and its foes, and the compass pointed at them. A quest complete or tombstoned marks nothing; a running one marks as ever (mutants: the stand, the foe or the person of an ended quest marked)', () => {
  const live = { questComplete: false, questTombstoned: false }, done = { questComplete: true, questTombstoned: false }, gone = { questComplete: true, questTombstoned: true };
  const box = () => ({ min: [0, 0, 0], max: [2, 1, 2] });
  const stand = (q) => ({ active: true, dead: false, behaviour: { questUID: 1, targetQuest: q, targetResource: { isItem: true } } });
  const foe = (q) => ({ dead: false, ai: { feet: [5, 0, 5] }, questBehaviour: { questUID: 1, targetQuest: q, targetResource: { displayName: 'Bandit' } } });
  const person = (q) => ({ x: 9, y: 0, z: 9, active: true, questBehaviour: { questUID: 1, targetResource: { displayName: 'Mara', parentQuest: q } } });
  const marks = (q) => dungeonQuestMarks({ stands: [stand(q)], foes: [foe(q)], people: [person(q)], boxOf: box });
  assert.equal(marks(live).length, 3, 'running: item, foe and person');
  assert.deepEqual(marks(done), [], 'complete: none');
  assert.deepEqual(marks(gone), [], 'tombstoned: none');
  assert.equal(questCompassPick(marks(gone), [0, 0, 0]), null, 'and the compass points at none');
  assert.equal(questEnded({ targetResource: { parentQuest: gone } }), true, 'the resource\'s quest where the behaviour holds none');
  assert.equal(questEnded(null), false);
});

// ── D4: the way out never builds its whole field each second ────────

const run = (x0, x1, z = 0, y = 0) => Array.from({ length: Math.abs(x1 - x0) + 1 }, (_, i) => [x0 + Math.sign(x1 - x0) * i + 0.5, y, z + 0.5]);
const walk = (points, rec = { trail: new Set() }) => { for (const p of points) automapTrailTick(rec, [p[0], p[1] + 1.6, p[2]], 1.6); return rec.trail; };

test('SD20g THE WAY OUT NEVER BUILDS ITS WHOLE FIELD EACH SECOND (D4): exploring, the player always stood on a fresh cell and the field was built whole each second (5-14 ms at 8,000 cells); a long trail loaded whole asked its 2,000 wall rays in one build (31 ms) and built the field again each second until every step was asked. Now new cells are attached as they come (attachCells); a player off the field has it built at most each WAY_FIELD_S, then twice as long each time it leaves them off, up to WAY_REFIELD_S; and an aim asks at most WAY_ASK_MS of rays - the rest taken as clear and asked in the aims that follow, the field built again only when one it walks proves walled (mutants: rebuilt each second off it; no back-off; asks unpaced; a walled step left walked)', () => {
  assert.equal(WAY_ASK_MS, 2);
  // attached as they come: a walk of a hundred new cells, one build
  const exitAt = [0.5, 0, 0.5];
  const rec = { trail: new Set() };
  walk(run(0, 10), rec);
  const w = createWayOut();
  w.aim(rec.trail, null, exitAt, [10.5, 0, 0.5], ALL, 0);
  for (let x = 11, t = 0.25; x <= 110; x++, t += 0.25) {
    walk([[x + 0.5, 0, 0.5]], rec);
    const sees = (p) => Math.abs(p[0] - (x + 0.5)) <= 5;   // an eye that sees five metres down the corridor
    const aim = w.aim(rec.trail, null, exitAt, [x + 0.5, 0, 0.5], sees, t);
    assert.deepEqual(aim, [x + 0.5 - 5, 0.5], `x ${x}: along the trail at once, never the crow`);
  }
  assert.equal(w.builds(), 3, 'a hundred new cells over 25 s: the first build and two refields, never one a second');
  const f = { next: new Int32Array([0, -1]), jump: new Uint8Array(2) };
  const two = trailCells(new Set(['0,0,0', '1,0,0', '2,0,0']));
  attachCells(two, f, 1);
  assert.deepEqual([...f.next].slice(0, 3), [0, 0, 1], 'each to a neighbour already on it, the arrays grown');
  const g = { next: new Int32Array([0, -1, -1]), jump: new Uint8Array(3) };
  attachCells(two, g, 1, () => false);
  assert.deepEqual([...g.next], [0, -1, -1], 'never through a wall the host\'s word puts between');
  // off the field (a teleport into an island the trail never joined): built again at once, then backing off
  const island = { trail: new Set() };
  walk(run(0, 10), island);
  walk(run(50, 60), island);
  const o = createWayOut();
  o.aim(island.trail, null, exitAt, [55.5, 0, 0.5], ALL, 0);
  assert.equal(o.builds(), 1);
  const times = [0];
  for (let tenth = 1, b = 1; tenth <= 450; tenth++) {
    o.aim(island.trail, null, exitAt, [55.5, 0, 0.5], ALL, tenth / 10);
    if (o.builds() !== b) { b = o.builds(); times.push(tenth / 10); }
  }
  const gaps = times.slice(1).map((t, i) => Math.round((t - times[i]) * 10) / 10);
  assert.deepEqual(gaps.slice(0, 6), [1, 2, 4, 8, 10, 10], 'off it: a second, then two, four, eight - then WAY_REFIELD_S at most');
  assert.ok(WAY_FIELD_S === 1 && WAY_REFIELD_S === 10);
  // the asks paced by the clock: a ray costs half a millisecond here, so four an aim
  let clockMs = 0, asks = 0;
  const pair = new Set([...walk(run(0, 20, 0)), ...walk(run(20, 0, 1))]);
  const wall = (p, q) => { asks++; clockMs += 0.5; return Math.floor(p[2]) === Math.floor(q[2]) || (p[0] > 19 && q[0] > 19); };
  const paced = createWayOut({ clock: () => clockMs });
  const first = paced.aim(pair, null, exitAt, [3.5, 0, 1.5], ALL, 0, wall);
  assert.equal(asks, 4, 'WAY_ASK_MS of rays, no more');
  assert.equal(first[1], 0.5, 'the steps unasked taken as clear: through the wall, for now');
  let t = 0, last = null;
  for (let k = 0; k < 120 && (last?.[1] ?? 0) !== 1.5; k++) last = paced.aim(pair, null, exitAt, [3.5, 0, 1.5], ALL, t += 0.25, wall);
  assert.equal(last[1], 1.5, 'asked over the aims that follow - a walled step it walked built it again - it finds the way');
  assert.ok(paced.builds() < 40, `built again only for a walled step it walked (${paced.builds()} builds)`);
});

// ── D5, D6: a shared quest on this page's sizes; no link's stamp online ─

test('SD20g A QUEST SHARED ONLINE IS LAID ON THIS PAGE\'S SIZES, AND NO LINK RE-STAMPS ONE ONLINE (D5, D6): an older page lays every dungeon whole, and its copy pointed into blocks this page\'s world-sized build has not - the load\'s pass alone re-laid it, at this player\'s next online load. Each shared copy is laid as it arrives and as it is kept in step (relayQuestOnline); and online a quest\'s markers are the world\'s, so a link\'s older stamp never takes the place of its own (mutants: the share unlaid; the resync unlaid; a link\'s stamp online)', () => {
  const markersOnline = { questSpawnMarkers: [{ dungeonX: 0, dungeonZ: 0, markerID: 101 }], questItemMarkers: [] };
  const place = {
    isPlace: true, symbol: { name: 'dun' },
    siteDetails: { siteType: SITE_TYPES.Dungeon, regionIndex: 3, locationName: 'Keep', questSpawnMarkers: [{ dungeonX: 0, dungeonZ: -1, markerID: 1 }], questItemMarkers: [] },
    _enumerateDungeonQuestMarkers: () => markersOnline,
  };
  const world = { maps: { getRegion: () => ({ mapNameLookup: new Map([['Keep', 5]]) }), getLocation: () => ({ dungeon: { blocks: [{}] } }) } };
  const quest = { smallerDungeonsState: SMALLER_DUNGEONS_STATE.Disabled, hooks: { world }, resources: new Map([['dun', place]]), tasks: new Map() };
  assert.equal(relayQuestOnline(quest), true, 'its markers moved to the build');
  assert.deepEqual(place.siteDetails.questSpawnMarkers, markersOnline.questSpawnMarkers);
  assert.equal(quest.smallerDungeonsState, ONLINE_DUNGEONS_STATE, 'stamped the world\'s');
  assert.equal(relayQuestOnline(quest), false, 'the world\'s already: nothing');
  const share = read('src/systems/questShare.js');
  // PIN MOVED (MEDIUM-DISTINCT's audit, 2026-10-08): the relay lays the copy on the world's sizes online, and on this page's
  // medium layout where the copy's dungeon moved, online and off
  assert.match(share, /const relay = \(q\) => \{\n\s*const online = ctx\.online \?\? isOnlinePage\(\);\n\s*if \(online\) relayQuestOnline\(q, \{ carriesQuestItem: ctx\.carriesQuestItem \?\? null \}\);\n\s*relayQuestMovedLayout\(q, machine, \{ carriesQuestItem: ctx\.carriesQuestItem \?\? null \}, online\);\n\s*\};/);
  assert.match(share, /if \(quest\) \{ relay\(quest\); return \{ ok: true, quest, resync: true \}; \}/, 'kept in step: laid');
  assert.match(share, /if \(!quest\) return \{ ok: false, reason: 'restore' \};[^\n]*\n\s*relay\(quest\);/, 'arrived: laid');
  assert.match(read('src/scenes/world.js'), /carriesQuestItem: \(res\) => \(playerEntity\.items \?\? \[\]\)\.some\(\(it\) => it\.questItem && it\.questUID === res\.parentQuest\?\.uid && it\.questSymbol\?\.name === res\.symbol\?\.name\),\n\s*\}\);/, 'a quest item I carry never laid again');
  // D6: a link's older stamp, online - never taken
  const mine = { uid: 2, smallerDungeonsState: ONLINE_DUNGEONS_STATE, resources: new Map([['dun', { isPlace: true, siteDetails: { siteType: SITE_TYPES.Dungeon, mapId: 777 } }]]) };
  const machine = { getSiteLinks: () => [{ questUID: 1 }], getQuest: () => ({ smallerDungeonsState: MEDIUM_DUNGEONS_STATE }) };
  assert.equal(adoptLinkedDungeonSize(mine, machine, true), null, 'online: none');
  assert.equal(mine.smallerDungeonsState, ONLINE_DUNGEONS_STATE, 'its own kept');
  assert.equal(adoptLinkedDungeonSize(mine, machine, false), MEDIUM_DUNGEONS_STATE, 'offline: the link\'s, as E5 has it');
});

// ── D7, D8: the held map's tier once a place; the Smaller dungeons row ─

test('SD20g THE HELD MAP\'S TIER READ ONCE A PLACE, AND THE SMALLER DUNGEONS ROW SAYS THE LAW (D7, D8): the maps hand a fresh location each ask, so the tier label\'s own memory never held one and each pointer move over a dungeon read its record again - it is kept by place now; and the Smaller dungeons row said a quest\'s dungeon keeps its full size, where a quest keeps the size it was set up at (mutants: the cache unread; the old words)', () => {
  const w = read('src/scenes/world.js');
  const at = w.indexOf("      tierAt: params.has('online') ? (summary) => {");
  assert.ok(at > 0, 'the held map\'s tier seam');
  const text = w.slice(at + '      tierAt: '.length, w.indexOf('      } : null,', at) + '      } : null'.length);
  let reads = 0;
  const env = {
    params: new Map([['online', '1']]), _tierLabels: new Map(),
    maps: { getLocation: (r, l) => { reads++; return { r, l }; } }, dungeonTierLabel: (loc) => ({ text: 'Regular Dungeon', size: loc.l === 5 ? 'Large' : 'Small' }),
  };
  const tierAt = new Function(...Object.keys(env), `return (${text});`)(...Object.values(env));
  const a = tierAt({ regionIndex: 3, locationIndex: 5 }), b = tierAt({ regionIndex: 3, locationIndex: 5 });
  assert.equal(a, b, 'the one label');
  assert.equal(reads, 1, 'read once');
  tierAt({ regionIndex: 3, locationIndex: 6 });
  assert.equal(reads, 2, 'another place, read once');
  assert.equal(tierAt(null), null);
  assert.match(w, /const _tierLabels = new Map\(\);\n\s*function buildTravelMapWindow\(extra = \{\}\) \{/, 'kept for the page, across the map\'s openings');
  const note = FEATURES.find((f) => f.id === 'smaller-dungeons').note;
  assert.match(note, /Main-story dungeons keep full size; a quest keeps the size it was set up at\./);
  assert.doesNotMatch(note, /a quest sends you to keep/);
});
