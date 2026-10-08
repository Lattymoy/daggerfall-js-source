// SD-ALONE (2026-10-08, the Super Dungeons arc; Mac: "We need to make sure companions dont enter the rift"): NO
// COMPANION THROUGH THE RIFT. The court's law (GATE-ALONE, test/gatecrowd.test.js) for the Shattered Hour: the place the
// companion layer asks for (scenes/world.js companionPlace) is none while the player stands in the Hour, so the layer
// (scenes/crewAshore.js) lifts the crew's hands and the sworn as the player steps through the Rift and stands them
// behind the player again out of it; the party panel draws no card for them there (partyCompanions); and the Hour says
// so once as a player steps in with any at their side (sdAloneFrame, through the Hour's own voice). Design:
// bible/11-Multiplayer/Super-Dungeons.md sections 7 and 16.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { SD_REALM_TEXT } from '../src/world/sdRealm.js';
import { createCrewAshore } from '../src/scenes/crewAshore.js';
import { createCompanions } from '../src/systems/naval/crewCompanions.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const WORLD = read('src/scenes/world.js');
const lift = (re, what) => { const m = re.exec(WORLD); assert.ok(m, `lifted from scenes/world.js: ${what}`); return m; };

// ── the place ───────────────────────────────────────────────────────────────────────────────────────────────────────

/** world.js companionPlace, lifted and run over a host of stubs (the gate's own rig, test/gatecrowd.test.js). */
const PLACE = lift(/\n {2}(function companionPlace\(\{ crew = true \} = \{\}\) \{[\s\S]*?\n {2}\})\n/, 'companionPlace')[1];
const placeHost = new Function('d', `const { navalOn, walkMode, playerSpawned, _loading, modes, travelView, csaRuntime, _mode, exteriorFoes, collider, revenantSpawnOptions, effectiveLevel, playerEntity, _dungeonPool } = d;\n${PLACE}\nreturn companionPlace;`);
/** The place as the world host answers it, in an Hour of slot `slot` (null: none) and a gate's court of day `day`. */
function placeOf(slot, { day = null, mode = 'dungeon' } = {}) {
  const pool = { spawnLooseFoe: () => null, removeLooseFoe: () => {}, foes: [], collider: null, companionFx: null };
  const street = { spawnFoe: () => null, removeFoe: () => {}, foes: [], companionFx: null };
  return placeHost({
    navalOn: () => true, walkMode: true, playerSpawned: true, _loading: false, travelView: null, csaRuntime: null,
    modes: { transitioning: false, gateArenaDay: () => day, sdRealmSlot: () => slot, interiorPool: () => street, interiorCollider: null }, _mode: () => mode,
    exteriorFoes: street, collider: null, revenantSpawnOptions: () => ({}), effectiveLevel: () => 1, playerEntity: {}, _dungeonPool: () => pool,
  });
}

test('SD-ALONE the place: the Shattered Hour is no place for a companion - the crew\'s and the sworn\'s layers alike - while the Abyss Dungeon itself, any other dungeon, a building and the street still are, and the gate\'s court is still none (mutants: the Hour admitted; the Hour judged by its slot\'s truth; every dungeon refused)', () => {
  const hour = placeOf(7);
  assert.equal(hour({ crew: true }), null, 'the crew\'s hands wait outside the Hour');
  assert.equal(hour({ crew: false }), null, 'and the sworn');
  assert.equal(placeOf(0)(), null, 'any slot the mode machine answers is an Hour');
  const hollow = placeOf(null)();
  assert.ok(hollow && typeof hollow.spawn === 'function', 'the Abyss Dungeon before its Rift stands them, as any dungeon does');
  assert.ok(placeOf(null, { mode: 'interior' })(), 'a building');
  assert.ok(placeOf(null, { mode: 'exterior' })({ crew: false }), 'the street');
  assert.equal(placeOf(null, { day: 3 })(), null, 'the gate\'s court still none (GATE-ALONE)');
  assert.match(PLACE, /if \(modes\?\.gateArenaDay\?\.\(\) != null\) return null;   \/\/ GATE-ALONE[^\n]*\n\s*if \(modes\?\.sdRealmSlot\?\.\(\) != null\) return null;   \/\/ SD-ALONE/, 'asked with the court\'s, before any place is made');
});

test('SD-ALONE through the Rift: at my side in the Abyss Dungeon, lifted as I step through into the Hour - health and spells carried - none stood there however long, and stood behind me again on the way back (mutant: the Hour admitted)', async () => {
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
  let slot = null, here = mk('the Abyss Dungeon');
  // the place as world.js answers it: the lifted companionPlace's Hour arm over this rig's pools
  const inHour = placeOf(12), out = placeOf(null);
  const layer = createCrewAshore({
    party: () => party, leader: () => ({ feet: [0, 0, 0], yaw: 0 }), now: () => 0,
    place: () => ((slot != null ? inHour : out)() ? here : null),
  });
  layer.frame(); await settle();
  assert.equal(here.live.length, 1, 'at my side in the Abyss Dungeon');
  const body = here.live[0];
  body.entity.health = 25;
  body.entity.activeEffects.push({ kind: 'shield', ended: false });
  layer.frame();
  // through the Rift
  slot = 12; here = mk('the Shattered Hour');
  for (let i = 0; i < 5; i++) { layer.frame(); await settle(); }
  assert.ok(body.dead, 'lifted out of the Abyss Dungeon as I stepped through');
  assert.equal(here.bodies.length, 0, 'nobody stood in the Hour');
  assert.deepEqual(layer.bodies(), []);
  assert.equal(party.party.length, 1, 'still of my party - waiting');
  // the way back to the Abyss Dungeon's Rift
  slot = null; here = mk('the Abyss Dungeon again');
  layer.frame(); await settle();
  assert.equal(here.live.length, 1, 'stood behind me again');
  assert.equal(here.live[0].entity.health, 25, 'hurt as he waited');
  assert.deepEqual(here.live[0].entity.activeEffects.map((a) => a.kind), ['shield'], 'his spells with him');
});

// ── the party panel ─────────────────────────────────────────────────────────────────────────────────────────────────

test('SD-ALONE the party panel: no card for a companion in the Hour, the crew\'s or the sworn\'s - and both again out of it (mutant: the Hour\'s cards drawn)', () => {
  const at = WORLD.indexOf('function partyCompanions() {');
  assert.ok(at > 0, 'partyCompanions');
  const body = WORLD.slice(WORLD.indexOf('{', at) + 1, WORLD.indexOf('\n  }\n', at));
  const cards = new Function('navalOn', 'csaRuntime', 'naval', 'crewAshore', 'composePartyFx', 'swornCards', 'modes', body);
  const naval = { companions: { party: [{ boat: 42, name: 'Hilda', role: 'Bosun', health: 20, maxHealth: 60 }] } };
  const none = { bodies: () => [] };
  const sworn = () => [{ key: 'rv:9', name: 'Ysolde', role: 'Sworn', h: 30, hm: 30, fx: [] }];
  const modesIn = (slot) => ({ gateArenaDay: () => null, sdRealmSlot: () => slot });
  assert.deepEqual(cards(() => true, null, naval, none, () => [], sworn, modesIn(4)), [], 'none in the Hour');
  assert.deepEqual(cards(() => true, null, naval, none, () => [], sworn, modesIn(null)).map((c) => c.key), ['42:Hilda', 'rv:9'], 'the crew\'s and the sworn\'s out of it');
});

// ── the word ────────────────────────────────────────────────────────────────────────────────────────────────────────

test('SD-ALONE the word: said once, through the Hour\'s voice, as a player steps through the Rift with companions at their side - once the step\'s veil has opened and nothing holds the screen; nothing said without any; owed again once out (mutants: said under the veil; said through the door; said under a window; said every frame; never owed again; said with nobody at my side; other words; never said; out of the Hour\'s frame)', () => {
  const m = lift(/\n {2}(let _sdAloneSaid = false;\n {2}const sdAloneFrame = \(\) => \{[\s\S]*?\n {2}\};)\n/, 'sdAloneFrame');
  const s = { slot: null, transitioning: false, busy: false, paused: false, companions: 2 };
  const said = [];
  const frame = new Function('d', `const { modes, gateVeil, gamePaused, companionsWithYou, sdSay, SD_REALM_TEXT } = d;\n${m[1]}\nreturn sdAloneFrame;`)({
    modes: { sdRealmSlot: () => s.slot, get transitioning() { return s.transitioning; } },
    gateVeil: { get busy() { return s.busy; } }, gamePaused: () => s.paused, companionsWithYou: () => s.companions,
    sdSay: (text, ...rest) => { said.push([text, ...rest]); return true; }, SD_REALM_TEXT,
  });
  frame();
  assert.equal(said.length, 0, 'out of the Hour: nothing');
  s.slot = 4; s.transitioning = true;
  frame();
  assert.equal(said.length, 0, 'not through the door');
  s.transitioning = false; s.busy = true;
  frame();
  assert.equal(said.length, 0, 'not under the step\'s veil');
  s.busy = false; s.paused = true;
  frame();
  assert.equal(said.length, 0, 'not under a window');
  s.paused = false;
  frame(); frame(); frame();
  assert.deepEqual(said, [[SD_REALM_TEXT.noCompanions]], 'once, as the veil opens - a refusal of the Hour\'s voice (its turn rank)');
  assert.equal(SD_REALM_TEXT.noCompanions, 'Your companions cannot follow you through the Rift.');
  s.slot = null; frame();
  s.slot = 4; s.companions = 0; frame();
  assert.equal(said.length, 1, 'nobody at my side: nothing said');
  s.slot = null; frame();
  s.slot = 9; s.companions = 1; frame();
  assert.equal(said.length, 2, 'owed again once out - another step through, another word');
  assert.match(WORLD, /const sdFrame = \(\) => \{ try \{ sdHost\?\.frame\(\); \} catch \(e\) \{ console\.warn\('\[sd\] host', e\?\.message \?\? e\); \} sdRealmFrame\(\); sdAloneFrame\(\);/, 'the Hour\'s frame says it, after the realm\'s own');
});
