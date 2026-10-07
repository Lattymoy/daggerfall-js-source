// GATE-CROWD (2026-10-07, Mac: "We need to not allow followers inside the oblivion gates, plus need some type of filter
// when there are too many people"): THE COURT, ALONE AND THINNED. GATE-ALONE - no companion steps into an Oblivion
// Gate's court (scenes/world.js companionPlace answers no place there, so the companion layer, scenes/crewAshore.js,
// lifts the crew's hands and the sworn as the player steps in and stands them again outside), the party panel draws no
// card for them there, and the court says so once as a fighter steps in with any at their side. THE CROWD - in a
// court, past the count on the Other players card only the nearest other players are drawn, the party always, the
// places held against a newcomer only a little nearer (net/gateCrowd.js; the online frame's drawn list). Design:
// bible/11-Multiplayer/World-Bosses.md section 21.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { crowdDrawn, createGateCrowd, gateCrowdMax, GATE_CROWD_TIERS, GATE_CROWD_DEFAULT, GATE_CROWD_HOLD_M } from '../src/net/gateCrowd.js';
import { PREF_DEFAULTS } from '../src/systems/uiPrefs.js';
import { COURT_TEXT } from '../src/world/gateArena.js';
import { courtSaySeconds } from '../src/scenes/gateCourt.js';
import { createCrewAshore } from '../src/scenes/crewAshore.js';
import { createCompanions } from '../src/systems/naval/crewCompanions.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const WORLD = read('src/scenes/world.js');
const lift = (re, what) => { const m = re.exec(WORLD); assert.ok(m, `lifted from scenes/world.js: ${what}`); return m; };

/** A peer as the online frame holds one - its id, and its pose `shown` in the scene's own frame here. */
const peer = (id, x, z = 0, y = 0) => ({ id, shown: { x, y, z } });
const at = (p) => [p.shown.x, p.shown.y, p.shown.z];
const ids = (set) => [...set].sort();
const ME = [0, 0, 0];

// ── the law ─────────────────────────────────────────────────────────────────────────────────────────────────────────

test('GATE-CROWD the choices: twelve by default, twenty-four, or everyone; held four metres; a stored value that is no choice reads as twelve; the shelf\'s default is the law\'s (mutants: another default; the tiers reordered; the hold three; a stray value kept; the shelf\'s own literal)', () => {
  assert.deepEqual(GATE_CROWD_TIERS, [12, 24, 0]);
  assert.equal(GATE_CROWD_DEFAULT, 12);
  assert.equal(GATE_CROWD_HOLD_M, 4);
  assert.equal(PREF_DEFAULTS.gateCrowd, GATE_CROWD_DEFAULT, 'the prefs shelf carries the law\'s own default');
  for (const v of GATE_CROWD_TIERS) assert.equal(gateCrowdMax(v), v, `${v} is a choice`);
  for (const v of [undefined, null, 7, -12, '12', 13, true, Infinity]) assert.equal(gateCrowdMax(v), 12, `${String(v)} is no choice`);
});

test('GATE-CROWD the drawn: everyone while the crowd is no more than the count; past it the nearest on the ground, a party mate always and counted; ties by id; no count draws everyone (mutants: one over the count; the farthest drawn; height counted; a mate dropped; mates uncounted; ties unordered; no count cutting)', () => {
  const twelve = Array.from({ length: 12 }, (_, i) => peer(`p${String(i).padStart(2, '0')}`, i + 1));
  assert.equal(crowdDrawn(twelve, ME, { at }).size, 12, 'twelve of twelve');
  const crowd = Array.from({ length: 20 }, (_, i) => peer(`p${String(i).padStart(2, '0')}`, 20 - i));   // p00 the farthest (20 m), p19 the nearest (1 m)
  assert.deepEqual(ids(crowdDrawn(crowd, ME, { at })), ids(crowd.slice(8).map((p) => p.id)), 'the twelve nearest of twenty');
  assert.equal(crowdDrawn(crowd, ME, { at, max: 24 }).size, 20, 'twenty under a count of twenty-four');
  assert.equal(crowdDrawn(crowd, ME, { at, max: 0 }).size, 20, 'no count: everyone');
  // the ground's distance - one standing high over me is as near as their feet across the floor
  const high = [...crowd.slice(1), peer('up', 0.5, 0, 40)];   // twenty, the nearest of them forty metres overhead
  assert.ok(crowdDrawn(high, ME, { at }).has('up'), 'height is not distance on the floor');
  // a party mate across the court is drawn, and takes one of the twelve
  const mates = new Set(['p00', 'p01']);
  const withMates = crowdDrawn(crowd, ME, { at, mate: (id) => mates.has(id) });
  assert.equal(withMates.size, 12);
  assert.ok(withMates.has('p00') && withMates.has('p01'), 'the farthest two, my party, drawn');
  assert.deepEqual(ids(withMates), ids(['p00', 'p01', ...crowd.slice(10).map((p) => p.id)]), 'and the ten nearest strangers');
  // a party larger than the count is drawn whole, and nobody else
  const many = new Set(crowd.slice(0, 14).map((p) => p.id));
  assert.deepEqual(ids(crowdDrawn(crowd, ME, { at, mate: (id) => many.has(id) })), ids([...many]), 'the party, whole');
  // ties: one distance, ordered by id - the same answer in any order of arrival
  const huddle = Array.from({ length: 16 }, (_, i) => peer(`r${String(i).padStart(2, '0')}`, 5));
  const a = ids(crowdDrawn(huddle, ME, { at })), b = ids(crowdDrawn([...huddle].reverse(), ME, { at }));
  assert.deepEqual(a, b, 'a huddle at one distance is cut alike whatever order it came in');
  assert.deepEqual(a, huddle.slice(0, 12).map((p) => p.id), 'the lowest ids');
  // `out` is refilled, never grown
  const out = new Set(['stale']);
  assert.equal(crowdDrawn(crowd, ME, { at }, out), out);
  assert.ok(!out.has('stale') && out.size === 12);
});

test('GATE-CROWD held places: one drawn last frame keeps the place against one less than four metres nearer, and gives it to one more than four metres nearer (mutants: no hold; the hold given to the newcomer; the hold\'s sign turned)', () => {
  const base = Array.from({ length: 11 }, (_, i) => peer(`n${String(i).padStart(2, '0')}`, i + 1));   // eleven within 11 m
  const held = peer('held', 20), near = peer('near', 17), nearer = peer('nearer', 15.5);
  const was = new Set([...base.map((p) => p.id), 'held']);
  // without a hold the newcomer three metres nearer takes the twelfth place
  assert.ok(crowdDrawn([...base, held, near], ME, { at }).has('near'));
  assert.ok(!crowdDrawn([...base, held, near], ME, { at, hold: 0, was }).has('held'), 'no hold, no place kept');
  // held: three metres nearer is not enough
  const kept = crowdDrawn([...base, held, near], ME, { at, was });
  assert.ok(kept.has('held') && !kept.has('near'), 'the place held against one three metres nearer');
  // four and a half metres nearer is
  const lost = crowdDrawn([...base, held, nearer], ME, { at, was });
  assert.ok(lost.has('nearer') && !lost.has('held'), 'and given up to one four and a half nearer');
});

test('GATE-CROWD the host\'s crowd: out of a court every peer, the same list, and the places forgotten; in one under the count the same list; past it the drawn in the frame\'s own order; a crowd milling at the edge does not swap every frame (mutants: cut out of a court; the places never forgotten; the held set refilled under itself; a new list every frame; the order lost)', () => {
  const crowd = createGateCrowd();
  const list = Array.from({ length: 20 }, (_, i) => peer(`p${String(i).padStart(2, '0')}`, 20 - i));
  const o = { me: ME, at };
  assert.equal(crowd.cut(list, { ...o, on: false }), list, 'out of a court: the list itself');
  assert.equal(crowd.held().size, 0);
  const few = list.slice(0, 5);
  const fresh = createGateCrowd();
  assert.equal(fresh.cut(few, { ...o, on: true }), few, 'in a court under the count: the list itself');
  assert.deepEqual(ids(fresh.held()), ids(few.map((p) => p.id)), 'every one of them holding a place');
  assert.ok(fresh.cut(list, { ...o, on: true }).some((p) => p.id === 'p04'), 'p04 (16 m), drawn the frame before, keeps a place against p08 (12 m) - a tie, held, and the lower id');
  const cut = crowd.cut(list, { ...o, on: true });
  assert.notEqual(cut, list);
  assert.deepEqual(cut.map((p) => p.id), list.slice(8).map((p) => p.id), 'the twelve nearest, in the frame\'s own order');
  assert.equal(crowd.cut(list, { ...o, on: true }), cut, 'the one list, refilled');
  assert.deepEqual(ids(crowd.held()), ids(cut.map((p) => p.id)));
  // a crowd milling at the edge: the twelfth and thirteenth trade a metre each frame - held, nobody swaps
  const edge = Array.from({ length: 11 }, (_, i) => peer(`e${String(i).padStart(2, '0')}`, i + 1));
  const x = peer('x', 14), y = peer('y', 14.5);
  const milling = [...edge, x, y];
  let swaps = 0, last = null;
  const c2 = createGateCrowd();
  for (let f = 0; f < 60; f++) {
    x.shown.x = f % 2 ? 14 : 15.2; y.shown.x = f % 2 ? 14.5 : 13.9;
    const drawn = c2.cut(milling, { ...o, on: true }).map((p) => p.id).join();
    if (last !== null && drawn !== last) swaps++;
    last = drawn;
  }
  assert.equal(swaps, 0, 'the twelfth place held through the milling');
  // the same milling unheld swaps every frame (the law's hold is what stops it)
  let unheld = 0, prev = null;
  for (let f = 0; f < 60; f++) {
    x.shown.x = f % 2 ? 14 : 15.2; y.shown.x = f % 2 ? 14.5 : 13.9;
    const drawn = [...crowdDrawn(milling, ME, { at, hold: 0 })].sort().join();
    if (prev !== null && drawn !== prev) unheld++;
    prev = drawn;
  }
  assert.equal(unheld, 59, 'without the hold the twelfth place changed hands every frame');
  // out of the court and back: the places forgotten, chosen afresh
  assert.equal(c2.cut(milling, { ...o, on: false }), milling);
  assert.equal(c2.held().size, 0, 'forgotten at the door');
});

// ── the host: the crowd's cut in the online frame ─────────────────────────────────────────────────────────────────

test('GATE-CROWD the online frame: the drawn list cut after the map\'s poses are kept and before a cast, a light or a body is drawn - in a gate\'s court alone, at the card\'s count, my party always (mutants: cut everywhere; the count unread; the party unasked)', () => {
  const m = lift(/\n\s*for \(const d of drawable\) if \(d\?\.shown\) _peerMapPoses\.set\(d\.id, d\.shown\);\n\s*const visiblePeers = gateCrowd\.cut\(cabin \? drawable : drawable\.filter\(\(d\) => !csaPeers\.isBelowDeck\(d\.id\)\), (\{ on: [^\n]*?\})\);[^\n]*\n\s*peerCastVisuals\(visiblePeers\);/, 'the crowd\'s cut');
  assert.match(WORLD, /const gateCrowd = createGateCrowd\(\);/);
  // the cut's question, evaluated as the frame asks it
  const ask = new Function('d', `const { modes, player, onlineToScene, gateCrowdMax, getPref, social } = d; return ${m[1]};`);
  const prefs = { gateCrowd: 12 };
  const mates = new Set(['m1']);
  const host = (day) => ({
    modes: { gateArenaDay: () => day }, player: { pos: [0, 0, 0] }, onlineToScene: (p) => [p.x, p.y, p.z], gateCrowdMax,
    getPref: (k) => prefs[k], social: { isPartyPeer: (id) => mates.has(id) },
  });
  const crowd = [peer('m1', 30), ...Array.from({ length: 19 }, (_, i) => peer(`p${String(i).padStart(2, '0')}`, i + 1))];
  const gc = createGateCrowd();
  assert.equal(gc.cut(crowd, ask(host(null))), crowd, 'on the street, in a building, in a dungeon: never cut');
  const court = gc.cut(crowd, ask(host(7)));
  assert.equal(court.length, 12, 'in the court: twelve');
  assert.ok(court.some((p) => p.id === 'm1'), 'my party mate across the court among them');
  prefs.gateCrowd = 24;
  assert.equal(createGateCrowd().cut(crowd, ask(host(7))).length, 20, 'the card at twenty-four');
  prefs.gateCrowd = 0;
  assert.equal(createGateCrowd().cut(crowd, ask(host(7))).length, 20, 'and at everyone');
  prefs.gateCrowd = 'junk';
  assert.equal(createGateCrowd().cut(crowd, ask(host(7))).length, 12, 'a stray value reads as twelve');
  // the readers of the drawn list are the cut's - the casts, the seen (lights, riders, bodies, walkers, auras) and the
  // sprites, names and steps; the map's poses were taken off the whole list above it
  assert.match(WORLD, /const seen = \[\];\n\s*for \(const d of visiblePeers\) \{/);
  assert.match(WORLD, /remotePlayers\.sync\(visiblePeers, onlineToScene, \{/);
});

test('GATE-CROWD the Other players card: the crowd\'s choice beside the sprite and the sounds, its tiers the law\'s (mutants: the row gone; its key another; the tiers written twice)', () => {
  const menu = read('src/ui/enhancedMenu.js');
  const card = menu.slice(menu.indexOf('function peerSpritesCard() {'), menu.indexOf('\n}\n', menu.indexOf('function peerSpritesCard() {')));
  assert.match(card, /c\.append\(choiceRow\('gateCrowd', 'Crowd in an Oblivion Gate',\n\s*'[^\n]*',\n\s*GATE_CROWD_TIERS\.map\(\(n\) => \[n, n \? `Nearest \$\{n\}` : 'Everyone'\]\), \{ home: true \}\)\);/);
  assert.match(menu, /import \{ GATE_CROWD_TIERS \} from '\.\.\/net\/gateCrowd\.js';/);
  assert.match(read('src/systems/uiPrefs.js'), /\n {2}gateCrowd: GATE_CROWD_DEFAULT,\n/);
});

// ── GATE-ALONE: no companion in the court ───────────────────────────────────────────────────────────────────────────

/** world.js companionPlace, lifted and run over a host of stubs. */
const PLACE = lift(/\n {2}(function companionPlace\(\{ crew = true \} = \{\}\) \{[\s\S]*?\n {2}\})\n/, 'companionPlace')[1];
const placeHost = new Function('d', `const { navalOn, walkMode, playerSpawned, _loading, modes, travelView, csaRuntime, _mode, exteriorFoes, collider, revenantSpawnOptions, effectiveLevel, playerEntity, _dungeonPool } = d;\n${PLACE}\nreturn companionPlace;`);
function placeOf(day, mode = 'dungeon') {
  const pool = { spawnLooseFoe: () => null, removeLooseFoe: () => {}, foes: [], collider: null, companionFx: null };
  const street = { spawnFoe: () => null, removeFoe: () => {}, foes: [], companionFx: null };
  return placeHost({
    navalOn: () => true, walkMode: true, playerSpawned: true, _loading: false, travelView: null, csaRuntime: null,
    modes: { transitioning: false, gateArenaDay: () => day, interiorPool: () => street, interiorCollider: null }, _mode: () => mode,
    exteriorFoes: street, collider: null, revenantSpawnOptions: () => ({}), effectiveLevel: () => 1, playerEntity: {}, _dungeonPool: () => pool,
  });
}

test('GATE-ALONE the place: a gate\'s court is no place for a companion - the crew\'s and the sworn\'s layers alike - and a dungeon, a building and the street still are (mutants: the court admitted; every dungeon refused)', () => {
  const court = placeOf(9);
  assert.equal(court({ crew: true }), null, 'the crew\'s hands wait outside');
  assert.equal(court({ crew: false }), null, 'and the sworn');
  const dungeon = placeOf(null)();
  assert.ok(dungeon && typeof dungeon.spawn === 'function', 'any other dungeon stands them');
  assert.ok(placeOf(null, 'interior')(), 'a building');
  assert.ok(placeOf(null, 'exterior')({ crew: false }), 'the street');
  assert.ok(placeOf(0)() === null, 'the court of day zero is a court');
  assert.match(PLACE, /if \(\(crew && !navalOn\(\)\) \|\|[^\n]*\) return null;\n\s*if \(modes\?\.gateArenaDay\?\.\(\) != null\) return null;   \/\/ GATE-ALONE/, 'asked before any place is made');
});

test('GATE-ALONE through the court: the party lifted as the player steps in, their health and spells carried, none stood inside however long, and stood behind the player again outside (mutant: the court admitted)', async () => {
  const party = createCompanions();
  party.take(7, { name: 'Aldric Wayrest', role: 'Bosun', mobile: 144, gender: 'male' }, 0);
  const mk = (key) => {
    const p = { key, bodies: [], live: [] };
    p.spawn = (mobile, feet, o) => { const rec = { mobile, gender: o.gender, ai: { feet: [...feet], yaw: o.yaw }, entity: { health: 40, maxHealth: 40, activeEffects: [] }, dead: false }; p.bodies.push(rec); p.live.push(rec); return Promise.resolve(rec); };
    p.remove = (rec) => { rec.dead = true; p.live = p.live.filter((r) => r !== rec); };
    p.has = (rec) => p.live.includes(rec);
    return p;
  };
  const settle = () => new Promise((r) => setImmediate(r));
  let day = null, here = mk('street');
  // the place as world.js answers it: the lifted companionPlace's court arm over this rig's pools
  const court = placeOf(3), out = placeOf(null);
  const layer = createCrewAshore({
    party: () => party, leader: () => ({ feet: [0, 0, 0], yaw: 0 }), now: () => 0,
    place: () => ((day != null ? court : out)() ? here : null),
  });
  layer.frame(); await settle();
  assert.equal(here.live.length, 1, 'at my side on the street');
  const body = here.live[0];
  body.entity.health = 25;
  body.entity.activeEffects.push({ kind: 'shield', ended: false });
  layer.frame();
  // through the gate
  day = 3; here = mk('court');
  for (let i = 0; i < 5; i++) { layer.frame(); await settle(); }
  assert.ok(body.dead, 'lifted out of the street as I stepped in');
  assert.equal(here.bodies.length, 0, 'nobody stood in the court');
  assert.deepEqual(layer.bodies(), []);
  assert.equal(party.party.length, 1, 'still of my party - waiting');
  // the way home
  day = null; here = mk('street again');
  layer.frame(); await settle();
  assert.equal(here.live.length, 1, 'stood behind me outside');
  assert.equal(here.live[0].entity.health, 25, 'hurt as he left');
  assert.deepEqual(here.live[0].entity.activeEffects.map((a) => a.kind), ['shield'], 'his spells with him');
});

test('GATE-ALONE the word: said once as a fighter steps in with companions at their side, once the step\'s fire has opened and nothing holds the screen; nothing said without any; owed again once out (mutants: said under the fire; said through the door; said under a window; said every frame; never owed again; said with nobody at my side; said for a moment; other words; never said)', () => {
  const m = lift(/\n {2}(let _courtAloneSaid = false;\n {2}const courtAloneFrame = \(\) => \{[\s\S]*?\n {2}\};)\n/, 'courtAloneFrame');
  const s = { day: null, transitioning: false, busy: false, paused: false, companions: 2 };
  const said = [];
  const frame = new Function('d', `const { modes, gateVeil, gamePaused, companionsWithYou, setMidScreenText, COURT_TEXT, courtSaySeconds } = d;\n${m[1]}\nreturn courtAloneFrame;`)({
    modes: { gateArenaDay: () => s.day, get transitioning() { return s.transitioning; } },
    gateVeil: { get busy() { return s.busy; } }, gamePaused: () => s.paused, companionsWithYou: () => s.companions,
    setMidScreenText: (text, secs) => said.push([text, secs]), COURT_TEXT, courtSaySeconds,
  });
  frame();
  assert.equal(said.length, 0, 'out of a court: nothing');
  s.day = 4; s.transitioning = true;
  frame();
  assert.equal(said.length, 0, 'not through the door');
  s.transitioning = false; s.busy = true;
  frame();
  assert.equal(said.length, 0, 'not under the step\'s fire');
  s.busy = false; s.paused = true;
  frame();
  assert.equal(said.length, 0, 'not under a window');
  s.paused = false;
  frame(); frame(); frame();
  assert.deepEqual(said, [[COURT_TEXT.noCompanions, courtSaySeconds(COURT_TEXT.noCompanions)]], 'once, as the fire opens, for its length');
  assert.equal(COURT_TEXT.noCompanions, 'Your companions cannot follow you into the Deadlands.');
  s.day = null; frame();
  s.day = 4; s.companions = 0; frame();
  assert.equal(said.length, 1, 'nobody at my side: nothing said');
  s.day = null; frame();
  s.day = 5; s.companions = 1; frame();
  assert.equal(said.length, 2, 'owed again once out - another court, another word');
  assert.match(WORLD, /try \{ gateCourt\?\.frame\(\); \} catch \(e\) \{ console\.warn\('\[gate\] court', e\?\.message \?\? e\); \}   \/\/ WB4: the fight on this screen \(out of the court it puts itself away\)\n\s*courtAloneFrame\(\);/, 'the gate\'s frame says it, after the court\'s own');
});
