// FIELD BUGS 2026-10-12b ALLY-YIELDS (Discord bug-reports, 2026-10-12, "Companion Inventory prioritized over looting,
// taking helm, and other context options": "you need to get them to move before you can loot an item since it keeps
// opening their inventory instead. It would be fixed if we made them less a priority when clicking/selecting!").
//
// A companion at the player's heel is a foe the one ray strikes like any other, so standing between the crosshair and
// a body, a pile, a boat's helm, a door or a shelf he was the nearest hit and took the press: his pack. He now YIELDS to
// whatever the press would take were he not there, when that answers from where the player stands (a firm pick inside
// its own reach); out of its reach, or with nothing behind him, he is the hit as ever. One law (player/activate.js
// allyYields, answersPress), asked by the press (mobileEnemyActivate.js tryMobileEnemyActivate, each host's `behind`)
// and by the plaque (activationRace.js raceWinner, the hit marked `ally` by peacefulFoePass off liveFoeTargets).
// Driven through the real picks over the real producers' shapes (crewAshore.js stands the companion, corpseMarker.js
// corpseLootTargets lays the body), and through each host's own `_enemyArm` and street race, cut out of the shipped
// source and run. bible/01-Overview/bugs/Field-Bugs-2026-10-12d.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import {
  pickActivatableHit, liveFoeTargets, peacefulFoePass, doorDistanceOf, allyYields, answersPress, isCompanion,
  RAY_DISTANCE, DOOR_ACTIVATION_DISTANCE, STATIC_NPC_ACTIVATION_DISTANCE, MOBILE_NPC_ACTIVATION_DISTANCE, CORPSE_ACTIVATION_DISTANCE,
  TREASURE_ACTIVATION_DISTANCE,
} from '../../src/player/activate.js';
import { tryMobileEnemyActivate } from '../../src/player/mobileEnemyActivate.js';
import { raceActivation, raceWinner, PERSON_KEY } from '../../src/player/activationRace.js';
import { corpseLootTargets } from '../../src/scenes/corpseMarker.js';
import { createCrewAshore } from '../../src/scenes/crewAshore.js';
import { createCompanions } from '../../src/systems/naval/crewCompanions.js';
import { rayPersonDistance } from '../../src/scenes/townTalk.js';
import { ACTIVATION_DISTANCE as CSA_ACTIVATION_DISTANCE } from '../../src/systems/comeSailAway/comeSailAway.js';
import { Collider } from '../../src/player/collider.js';

const require = createRequire(import.meta.url);
const { parse } = require('acorn');
const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const settle = () => new Promise((r) => setImmediate(r));

// ─── THE SHAPES THE PRODUCERS MINT ──────────────────────────────────────────────────────────────────────────────────

// The one ray: from knee height straight down +z, so it meets a standing body's box and a lying body's alike.
const EYE = [0, 0.3, 0];
const DIR = [0, 0, 1];
const C = new Collider();   // an empty world: nothing occludes

/** My companion, stood by the companion layer itself (crewAshore.js: `companion` and `shipmate` are its words), his
 *  feet `z` metres down the ray. */
async function standCompanion(z = 1.5) {
  const party = createCompanions();
  party.take(7, { name: 'Aldric', role: 'Bosun', mobile: 144, gender: 'male' }, 0);
  let rec = null;
  const place = {
    key: 'street',
    spawn: () => { rec = { dead: false, mobileType: 144, ai: { feet: [0, 0, z], height: 1.8 }, entity: { name: 'Aldric', isClass: true, team: 'PlayerAlly', mobileTeam: 'PlayerAlly', health: 40, maxHealth: 40 } }; return Promise.resolve(rec); },
    remove: () => {}, has: () => true, spot: () => [0, 0, z],
  };
  const layer = createCrewAshore({ party: () => party, place: () => place, leader: () => ({ feet: [0, 0, 0], yaw: 0, grounded: true }), now: () => 0 });
  layer.frame(); await settle(); layer.frame();
  assert.ok(rec && isCompanion(rec) && rec.shipmate === true, 'the layer stood him, and named him its own');
  rec.ai.feet = [0, 0, z];   // where he stands this press
  return rec;
}
/** A body lying `z` metres down the ray, laid by the pool's own producer (corpseMarker.js corpseLootTargets, under the
 *  street pool's own prefix - exteriorFoes.js lootTargets). */
const bodyAt = (z) => pickActivatableHit(EYE, DIR, corpseLootTargets([{ dead: true, at: [0, 0, z] }], 'foeCorpse', { isCorpse: (e) => e.dead, feetOf: (e) => e.at }), C);
/** A target of the street's door set (worldModes exteriorActivationTargets' rows: the ray's distance, the handler's reach beside it). */
const groundAt = (z, reach, key = 'npc:0') => pickActivatableHit(EYE, DIR, [{ key, aabb: { min: [-0.3, 0, z], max: [0.3, 2, z + 0.4] }, distance: RAY_DISTANCE, reach }], C);
/** A boat's helm box under the ray (world.js csaActivationPick's pick: its key, its distance, the mod's 3.2). */
const helmAt = (z) => ({ key: 'csaBoat:1:helm', distance: z, reach: CSA_ACTIVATION_DISTANCE, modelId: 112400 });

/** THE PRESS, the street's way: the race over what stands behind him, then the foe arm over the pool, as world.js asks it. */
function press(pool, picks = {}, { mode = 'grab', persons = [] } = {}) {
  const race = raceActivation({ ...picks, personDistances: persons.map((z) => rayPersonDistance(EYE, DIR, [0, 0, z])) });
  const out = { packs: 0, said: [] };
  out.took = tryMobileEnemyActivate(EYE, DIR, pool, C, RAY_DISTANCE, mode, {}, {
    nearerThan: race.rival, doorBehind: race.doorDistance, behind: race.next,
    openCompanion: () => { out.packs++; return true; }, hud: (t) => out.said.push(t), midScreen: (t) => out.said.push(t),
  });
  return out;
}
/** THE PLAQUE over the same ray: the pool's live targets, the one seam, the one race. */
function plaque(pool, picks = {}, { mode = 'grab' } = {}) {
  const ft = liveFoeTargets(pool, 'mobileFoe');
  return raceWinner({ ...picks, foe: peacefulFoePass(pickActivatableHit(EYE, DIR, ft, C), ft, picks.ground?.distance ?? Infinity, mode) });
}

// ─── THE LAW ─────────────────────────────────────────────────────────────────────────────────────────────────────────

test('ALLY-YIELDS THE BODY: a body behind my companion inside its reach takes the press (his pack never opens - the ladder below loots it); past its reach he is the hit and his pack opens, as with nothing behind him; the same body in front of him is the hit it always was (mutants: the yield dropped from the press, the reach unread - every body under the ray took him, the yield asked of every foe)', async () => {
  const aldric = await standCompanion(1.5);
  const near = bodyAt(3);
  assert.ok(near && near.distance <= CORPSE_ACTIVATION_DISTANCE && near.reach === CORPSE_ACTIVATION_DISTANCE, 'the pick carries the body\'s own reach');
  assert.deepEqual(press([aldric], { corpse: near }), { packs: 0, said: [], took: false }, 'the body answers: the press passes him - the ladder loots it');
  const far = bodyAt(6);
  assert.ok(far.distance > CORPSE_ACTIVATION_DISTANCE);
  assert.deepEqual(press([aldric], { corpse: far }), { packs: 1, said: [], took: true }, 'a body past its reach would only refuse: his pack');
  assert.deepEqual(press([aldric]), { packs: 1, said: [], took: true }, 'nothing behind him: his pack');
  assert.deepEqual(press([await standCompanion(4)], { corpse: bodyAt(2) }), { packs: 0, said: [], took: false }, 'a body nearer than he is: its press, as ever');
  // the law's two halves, alone
  assert.equal(allyYields(aldric, near), true);
  assert.equal(allyYields(aldric, far), false);
  assert.equal(allyYields(aldric, null), false);
  assert.equal(allyYields({ ...aldric, companion: null }, near), false, 'a foe that is no companion is the ray\'s one hit');
});

test('ALLY-YIELDS THE HELM, THE DOOR, A PERSON: each standing behind him in its own reach takes the press - a boat\'s helm at its 3.2, a static NPC at its 6.4, a townsperson at MobileNPCActivationDistance - and each past it leaves it his; the race\'s `next` carries the door set\'s own reach, and the person\'s (mutants: the door set handed without its reach, the townsfolk left out of `next`)', async () => {
  const aldric = await standCompanion(1.2);
  // the helm (CSA-D: the boat's box, RegisterCustomActivation's 3.2)
  assert.equal(press([aldric], { boat: helmAt(2.4) }).took, false, 'the helm at 2.4: taken - the helm arm runs');
  assert.equal(raceActivation({ boat: helmAt(2.4) }).boatWins, true, '...the race gives the boat arm the press');
  assert.equal(press([aldric], { boat: helmAt(CSA_ACTIVATION_DISTANCE + 1) }).packs, 1, 'a helm past its reach: his pack');
  // the door set's own pick (worldModes exteriorActivationHit): a static NPC reaches 6.4, a door 3.2
  const npc = groundAt(5, STATIC_NPC_ACTIVATION_DISTANCE);
  assert.equal(npc.reach, STATIC_NPC_ACTIVATION_DISTANCE);
  const r = raceActivation({ door: npc });
  assert.equal(r.doorDistance, npc.distance, 'the door set\'s distance is its pick\'s');
  assert.equal(r.next, npc, '...and `next` is the pick itself, its reach with it');
  assert.equal(press([aldric], { door: npc }).took, false, 'a static NPC at 5, inside its 6.4: his');
  assert.equal(press([aldric], { door: groundAt(5, DOOR_ACTIVATION_DISTANCE, 'door:0') }).packs, 1, 'a door at 5, past its 3.2: his pack');
  assert.equal(press([aldric], { door: groundAt(2.5, DOOR_ACTIVATION_DISTANCE, 'door:0') }).took, false, 'a door at 2.5: the door');
  // a townsperson (the press knows the street's townsfolk by their distance; `next` gives them the plaque's reach)
  const p = raceActivation({ personDistances: [rayPersonDistance(EYE, DIR, [0, 0, 4])] }).next;
  assert.equal(p?.key, PERSON_KEY);
  assert.equal(p.reach, MOBILE_NPC_ACTIVATION_DISTANCE);
  assert.equal(press([aldric], {}, { persons: [4] }).took, false, 'a townsperson at 4: talked to');
  assert.equal(press([aldric], {}, { persons: [12] }).packs, 1, 'a townsperson at 12, past 6.4: his pack');
  // the nearest behind him decides: a far body in front of a near helm is what the press takes, and it only refuses
  assert.equal(press([aldric], { corpse: bodyAt(2.5), boat: helmAt(8) }).took, false);
});

test('ALLY-YIELDS IS A COMPANION\'S: a hostile foe or a peaceful watchman in front of the same body is still the ray\'s one hit (DFU); another player\'s companion yields as mine does; another player\'s team behind him, which yields itself, never takes it from him; and he yields in every mode, Steal and Info too (mutants: the companion test dropped, the peer\'s companion kept out, a yielding pick taken for an answer)', async () => {
  const aldric = await standCompanion(1.5);
  const rat = { dead: false, mobileType: 0, ai: { feet: [0, 0, 1.5], height: 1.8, isHostile: true }, entity: { name: 'Rat' } };
  const watch = { dead: false, mobileType: 0, ai: { feet: [0, 0, 1.5], height: 1.8, isHostile: false }, entity: { name: 'Watchman' } };
  for (const foe of [rat, watch]) assert.equal(press([foe], { corpse: bodyAt(3) }, { mode: 'info' }).took, true, `${foe.entity.name}: the ray's one hit, the body behind it as ever`);
  const peers = { ...aldric, companion: 'peer:42:3', ai: { ...aldric.ai } };
  assert.equal(press([peers], { corpse: bodyAt(3) }, { mode: 'info' }).took, false, 'another player\'s companion yields too');
  assert.equal(press([peers], {}, { mode: 'info' }).took, true, '...and is the hit with nothing behind');
  const team = { key: 'hcc:peer:1', distance: 2.5, reach: 3.2, yields: true };
  assert.equal(answersPress(team), false, 'a pick that yields is never an answer');
  assert.equal(press([aldric], { horseCart: team }).packs, 1, 'another player\'s wagon behind him: his pack');
  for (const mode of ['steal', 'info', 'talk', 'grab']) assert.equal(press([aldric], { corpse: bodyAt(3) }, { mode }).took, false, `${mode}: the body`);
  assert.equal(answersPress({ key: 'x', distance: 2 }), false, 'a pick with no reach answers nothing');
});

test('ALLY-YIELDS THE PLAQUE NAMES WHAT THE PRESS TAKES: liveFoeTargets marks him `ally`, peacefulFoePass carries it onto his hit, and raceWinner passes him for what answers behind him - swept against the press over bodies, helms, doors and townsfolk near and far, in every mode, every answer the same (mutants: the target unmarked, the hit unmarked, the race\'s yield dropped)', async () => {
  const aldric = await standCompanion(1.5);
  const t = liveFoeTargets([aldric], 'mobileFoe');
  assert.equal(t[0].ally, true, 'the producer\'s word on his target');
  assert.equal('peaceful' in t[0], false, 'never the peaceful\'s door pass (AUDIT TACT C5)');
  assert.equal(liveFoeTargets([{ dead: false, ai: { feet: [0, 0, 2], height: 1.8, isHostile: true } }], 'mobileFoe')[0].ally, undefined, 'a foe carries no mark');
  const hit = peacefulFoePass(pickActivatableHit(EYE, DIR, t, C), t, Infinity);
  assert.equal(hit.ally, true, 'his hit carries it through the seam');
  assert.equal(plaque([aldric], { corpse: bodyAt(3) })?.key, bodyAt(3).key, 'the plaque names the body');
  assert.equal(plaque([aldric], { corpse: bodyAt(6) })?.key, 'mobileFoe:0', 'past its reach: him');
  assert.equal(plaque([aldric])?.key, 'mobileFoe:0', 'nothing behind: him');
  let yielded = 0, kept = 0;
  const persons = (z) => (z == null ? null : { key: PERSON_KEY, distance: rayPersonDistance(EYE, DIR, [0, 0, z]), reach: MOBILE_NPC_ACTIVATION_DISTANCE });
  for (const mode of ['grab', 'steal', 'info']) {
    for (const z of [2.2, 3, 3.6, 4.5, 6, 9, null]) {
      const sets = [{ corpse: z && bodyAt(z) }, { boat: z && helmAt(z) }, { ground: z && groundAt(z, DOOR_ACTIVATION_DISTANCE, 'door:0') }, { ground: z && groundAt(z, STATIC_NPC_ACTIVATION_DISTANCE) }, { person: persons(z) }];
      for (const set of sets) {
        const { ground = null, person = null, ...fam } = set;
        const pressed = press([aldric], { ...fam, door: ground }, { mode, persons: person ? [z] : [] });
        const named = plaque([aldric], { ...fam, ground, person }, { mode });
        const pressTookHim = pressed.took === true;
        assert.equal(named?.key === 'mobileFoe:0', pressTookHim, `${mode}, ${Object.keys(set)[0]} at ${z}: the plaque names him exactly when the press takes him`);
        if (pressTookHim) kept++; else yielded++;
      }
    }
  }
  assert.ok(yielded > 20 && kept > 20, `the sweep met both answers (${yielded} yielded, ${kept} kept)`);
});

// ─── THE HOSTS, AS THEY SHIP ────────────────────────────────────────────────────────────────────────────────────────

/** Every `const <name> = ...` initializer of a host, cut out of the shipped source. */
function initsOf(file, name) {
  const S = src(file);
  const out = [];
  (function walk(n) {
    if (!n || typeof n !== 'object') return;
    if (n.type === 'VariableDeclarator' && n.id?.name === name && n.init) out.push(S.slice(n.init.start, n.init.end));
    for (const v of Object.values(n)) if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') walk(v);
  })(parse(S, { ecmaVersion: 'latest', sourceType: 'module' }));
  return out;
}
/** Run a cut expression against a scope: the names it reads are `env`'s, the rest the global object's. */
function evalIn(expr, env) {
  const scope = new Proxy(env, { has: () => true, get: (o, k) => (typeof k === 'symbol' ? undefined : (k in o ? o[k] : globalThis[k])) });
  return Function('scope', `with (scope) { return (${expr}); }`)(scope);
}
/** A host's own enemy arm over one companion, the ladder's winner `pick` (and the street's race `race`) behind him. */
function hostPress(arm, aldric, { pick = null, race = null } = {}) {
  const log = { packs: 0, said: [] };
  const say = (t) => log.said.push(t);
  const pack = () => { log.packs++; return true; };
  const env = {
    tryMobileEnemyActivate, doorDistanceOf, eye: EYE, dir: DIR, cam: { pos: EYE }, useFwd: DIR, collider: C,
    exteriorFoes: { foes: [aldric] }, cityGuards: { guards: [] }, exteriorFoePool: () => [aldric], interiorFoePool: () => [aldric],
    interiorCtx: { collider: C }, dungeonCtx: { foes: [aldric], collider: C, hudSay: say, hudBox: say },
    ctx: { foes: [aldric], collider: C, hudSay: say, hudBox: say, makeAreaHostile() {}, randomText: () => null },
    targets: [], _pick: pick, _race: race, getInteractionMode: () => 'grab', playerEntity: {},
    townTalk: { say, showOverlay() {}, randomText: () => null }, ActionTextBox: class {}, _makeEnemiesHostile() {},
    openCompanionPack: pack, openRevenantFate: () => false, host: { openCompanionPack: pack, openRevenantFate: () => false, openLivingDiver: () => false },
    walkMode: false, player: { pos: [0, 0, 0] }, FOUND_NOTHING_VALUABLE_TEXT_ID: 8999, say, mountInterior() {}, makeEnemiesHostile() {}, interiorEnemyDatabase: () => [],
  };
  log.took = evalIn(arm, env)(RAY_DISTANCE, race ? race.rival : (pick?.distance ?? Infinity));
  return log;
}

test('ALLY-YIELDS THE FOUR HOSTS: each host\'s own `_enemyArm`, cut out of the shipped source and run over the real law - the street (world.js, its race`s `next`), a building and the world\'s dungeon (worldModes.js, the ladder\'s `_pick`), the bench street (exterior.js, which stands no companion and asks as world.js does) and the standalone dungeon (dungeon.js, likewise): a body in reach behind him passes the press on, one past its reach opens his pack (mutants: each host\'s `behind` dropped)', async () => {
  const aldric = await standCompanion(1.5);
  const arms = {
    'world.js': initsOf('src/scenes/world.js', '_enemyArm'),
    'worldModes.js': initsOf('src/scenes/worldModes.js', '_enemyArm'),
    'exterior.js': initsOf('src/scenes/exterior.js', '_enemyArm'),
    'dungeon.js': initsOf('src/scenes/dungeon.js', '_enemyArm'),
  };
  assert.deepEqual(Object.values(arms).map((a) => a.length), [1, 2, 1, 1], 'one arm a ladder: the street, a building and the world\'s dungeon, the bench, the standalone dungeon');
  const street = (file) => (corpse) => hostPress(arms[file][0], aldric, { race: raceActivation({ corpse }) });
  for (const file of ['world.js', 'exterior.js']) {
    assert.equal(street(file)(bodyAt(3)).took, false, `${file}: a body in reach behind him - the press passes on`);
    const far = street(file)(bodyAt(6));
    assert.equal(far.took, true, `${file}: past its reach he is the hit`);
  }
  assert.equal(street('world.js')(bodyAt(6)).packs, 1, 'world.js: his pack');
  for (const [i, where] of [[0, 'a building'], [1, 'the world\'s dungeon']]) {
    assert.equal(hostPress(arms['worldModes.js'][i], aldric, { pick: bodyAt(3) }).took, false, `${where}: the body`);
    assert.equal(hostPress(arms['worldModes.js'][i], aldric, { pick: bodyAt(6) }).packs, 1, `${where}: past its reach, his pack`);
  }
  assert.equal(hostPress(arms['dungeon.js'][0], aldric, { pick: bodyAt(3) }).took, false, 'dungeon.js: the body');
  assert.equal(hostPress(arms['dungeon.js'][0], aldric, { pick: bodyAt(6) }).took, true, 'dungeon.js: past its reach, the ray\'s hit');
});

test('ALLY-YIELDS THE STREET\'S RACE, AS IT SHIPS: both exterior hosts hand the race the door set\'s PICK (worldModes exteriorActivationHit, reach and all) - cut out of world.js and exterior.js and run, a static NPC behind him inside its 6.4 takes the press through the host\'s own arm; worldModes\' exteriorActivationHit is the pick off the street and null elsewhere, and exteriorActivationDistance is its distance (mutants: each host\'s door handed as null, the hit never picked)', async () => {
  const aldric = await standCompanion(1.5);
  const npc = groundAt(5, STATIC_NPC_ACTIVATION_DISTANCE);
  for (const file of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const [raceExpr] = initsOf(file, '_race');
    const [arm] = initsOf(file, '_enemyArm');
    const env = {
      raceActivation, rayPersonDistance, cam: { pos: EYE }, useFwd: DIR,
      modes: { exteriorActivationHit: () => npc, exteriorActivationDistance: () => npc.distance },
      _talkPersons: () => [], _livePersons: [],
    };
    const race = evalIn(raceExpr, env);
    assert.equal(race.doorDistance, npc.distance, `${file}: the door set's distance`);
    assert.equal(race.next, npc, `${file}: the door set's pick is what the press takes past him`);
    assert.equal(hostPress(arm, aldric, { race }).took, false, `${file}: the static NPC at 5 takes the press through the host's own arm`);
  }
  // worldModes: the hit and the distance, cut out and run over a stub street
  const M = src('src/scenes/worldModes.js');
  const fns = {};
  (function walk(n) {
    if (!n || typeof n !== 'object') return;
    if (n.type === 'FunctionDeclaration' && ['exteriorActivationHit', 'exteriorActivationDistance'].includes(n.id?.name)) fns[n.id.name] = M.slice(n.start, n.end);
    for (const v of Object.values(n)) if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') walk(v);
  })(parse(M, { ecmaVersion: 'latest', sourceType: 'module' }));
  assert.deepEqual(Object.keys(fns).sort(), ['exteriorActivationDistance', 'exteriorActivationHit']);
  const street = (mode) => evalIn(`(() => { ${fns.exteriorActivationHit}\n${fns.exteriorActivationDistance}\n return { exteriorActivationHit, exteriorActivationDistance }; })()`, {
    mode, pickActivatableHit, player: { eye: EYE }, eyeDir: () => DIR, baseCollider: () => C,
    exteriorActivationTargets: () => ({ targets: [{ key: 'npc:0', aabb: { min: [-0.3, 0, 5], max: [0.3, 2, 5.4] }, distance: RAY_DISTANCE, reach: STATIC_NPC_ACTIVATION_DISTANCE }] }),
  });
  const out = street('exterior');
  assert.deepEqual(out.exteriorActivationHit(EYE, DIR), { key: 'npc:0', distance: 5, reach: STATIC_NPC_ACTIVATION_DISTANCE });
  assert.equal(out.exteriorActivationDistance(EYE, DIR), 5);
  const inside = street('interior');
  assert.equal(inside.exteriorActivationHit(EYE, DIR), null, 'off the street: nothing');
  assert.equal(inside.exteriorActivationDistance(EYE, DIR), Infinity);
});

test('ALLY-YIELDS THE FOUR HOSTS\' PLAQUES: the street\'s (world.js, exterior.js), a building\'s (worldModes.js) and the dungeon\'s (dungeonContext.js) each hand the race their live foes through peacefulFoePass over liveFoeTargets - the one seam that marks him - so every plaque reads the yield the press does', () => {
  const plaques = {
    'src/scenes/world.js': /foe: \(\(ft\) => peacefulFoePass\(pickActivatableHit\(cam\.pos, _hd, ft, collider\), ft, [^\n]*\)\(\[\.\.\.exteriorFoes\.liveTargets\(\), \.\.\.cityGuards\.liveTargets\(\)\]\)/,
    'src/scenes/exterior.js': /foe: \(\(ft\) => peacefulFoePass\(pickActivatableHit\(cam\.pos, _hd, ft, collider\), ft, [^\n]*\)\(\[\.\.\.exteriorFoes\.liveTargets\(\), \.\.\.cityGuards\.liveTargets\(\)\]\)/,
    'src/scenes/worldModes.js': /const liveFoes = liveFoeTargets\(interiorFoePool\(\), 'mobileFoe'\);[^\n]*\n[^\n]*\n[^\n]*\n\s*foe: peacefulFoePass\(pickActivatableHit\(mwv\.eye, d, liveFoes, interiorCtx\.collider\), liveFoes,/,
    'src/scenes/dungeonContext.js': /foe: \(\(ft\) => peacefulFoePass\(pickActivatableHit\(eye, d, ft, collider\), ft, [^\n]*\)\(liveFoeTargets\(foes, 'mobileFoe'\)\)/,
  };
  for (const [file, re] of Object.entries(plaques)) assert.match(src(file), re, `${file}: the plaque's foe goes through the seam`);
  for (const f of ['src/scenes/exteriorFoes.js', 'src/scenes/cityGuards.js']) assert.match(src(f), /return liveFoeTargets\((?:foes|guards), 'mobile(?:Foe|Guard)', \{ idOf \}\);/, `${f}: its live targets are liveFoeTargets'`);
});
