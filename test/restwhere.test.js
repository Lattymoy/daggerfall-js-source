// U48 - REST ABOVE GROUND: the dispatch ladder that decides whether
// the window opens, and the CanRest gate that decides where.
// Everything here was mutation-proven.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  restDecision, canRestHere, REST_TEXT, CITY_CAMPING_ILLEGAL, HAVE_NOT_RENTED_ROOM,
} from '../src/systems/restSession.js';
import { CRIMES } from '../src/systems/court.js';

const src = (rel) => readFileSync(new URL(`../src/${rel}`, import.meta.url), 'utf8');

// ---------------------------------------------------------------
// 1. THE DISPATCH - and its lack of a scene gate
// ---------------------------------------------------------------

test('rest: the dispatch asks about enemies, water and the ground - and NOTHING about the scene', () => {
  // DaggerfallUI.cs:651-688 has no dungeon/building/outdoors test at
  // all. The port had this ladder in ONE host, so KeyR did nothing
  // above ground for the whole life of the project.
  assert.deepEqual(restDecision({}), { kind: 'rest' });
  assert.deepEqual(restDecision({ enemiesNearby: true }), { kind: 'enemies', textId: REST_TEXT.enemiesNearby });
  assert.deepEqual(restDecision({ swimming: true }), { kind: 'cannot', textId: REST_TEXT.cannotRestNow });
  assert.deepEqual(restDecision({ grounded: false }), { kind: 'cannot', textId: REST_TEXT.cannotRestNow });
  assert.equal(REST_TEXT.enemiesNearby, 354);
  assert.equal(REST_TEXT.cannotRestNow, 355);
  // ENEMIES OUTRANK the water: DFU's is an if/else-if chain, so a
  // swimming player with a foe nearby is told about the FOE - and
  // that matters, because only the enemy arm raises the alert.
  assert.equal(restDecision({ enemiesNearby: true, swimming: true }).kind, 'enemies');
});

test('rest: the prevented-rest registry, and its EMPTY STRING case', () => {
  // GetPreventedRestMessage (GameManager.cs:641-653). A registered
  // condition speaks its own words...
  assert.deepEqual(restDecision({ preventedMessage: 'The ritual is not finished.' }),
    { kind: 'prevented', message: 'The ritual is not finished.' });
  // ...and an EMPTY one is deliberate, not a bug:
  // RegisterPreventRestCondition turns a null message into "" so a
  // caller can block rest without wording it, and the dispatch falls
  // back to 355 rather than showing a blank box.
  assert.deepEqual(restDecision({ preventedMessage: '' }),
    { kind: 'cannot', textId: REST_TEXT.cannotRestNow });
  // no registered condition at all is null, and null is NOT ''
  assert.equal(restDecision({ preventedMessage: null }).kind, 'rest');
  assert.equal(restDecision({}).kind, 'rest');
});

test('rest: a racial override refuses SILENTLY, and it is the last gate', () => {
  // "Allow custom race to block rest (e.g. vampire not sated)" - DFU
  // simply returns, with no message at all.
  assert.deepEqual(restDecision({ racialOverrideBlocks: true }), { kind: 'blocked' });
  // ...but it is below the others: a swimming vampire is told about
  // the water, which is the arm the player can act on.
  assert.equal(restDecision({ racialOverrideBlocks: true, swimming: true }).kind, 'cannot');
  assert.equal(restDecision({ racialOverrideBlocks: true, preventedMessage: 'x' }).kind, 'prevented');
});

// ---------------------------------------------------------------
// 2. CANREST - camping is a crime
// ---------------------------------------------------------------

test('rest: camping in a town is VAGRANCY, and the crime is charged on BOTH attempts', () => {
  // CanRest (:549-561). The first press refuses with TEXT.RSC 17...
  const first = canRestHere({ inTown: true, insideBuilding: false, alreadyWarned: false });
  assert.equal(first.kind, 'refuse');
  assert.equal(first.textId, CITY_CAMPING_ILLEGAL);
  assert.equal(CITY_CAMPING_ILLEGAL, 17);
  assert.equal(first.crime, CRIMES.Vagrancy);
  assert.equal(first.spawnGuards, true);
  // ...and the SECOND is allowed - DFU returns `alreadyWarned`, so
  // the player may camp, having already been booked for it.
  const second = canRestHere({ inTown: true, insideBuilding: false, alreadyWarned: true });
  assert.equal(second.kind, 'allow');
  // THE CRIME AND THE GUARDS RIDE BOTH, because they sit ABOVE the
  // return in C#, not inside the refusal.
  assert.equal(second.crime, CRIMES.Vagrancy);
  assert.equal(second.spawnGuards, true);
  // MUTATION: charging the crime only on the refusal lets a warned
  // player camp for free, and this fails on the second half.
});

test('rest: the wilderness is free, and so is a dungeon', () => {
  // The tail `return true` - a dungeon, a field, anything that is not
  // a town.
  assert.deepEqual(canRestHere({ inTown: false }), { kind: 'allow' });
  assert.deepEqual(canRestHere({}), { kind: 'allow' });
  assert.equal(canRestHere({ inTown: false, insideBuilding: true }).kind, 'allow',
    'a building outside a town is not the town branch');
});

test('rest: inside a building the PERMANENT SCENE gates the owned-or-rented ladder entirely', () => {
  const inn = { inTown: true, insideBuilding: true };
  // No permanent scene: nothing the room record says can help.
  assert.deepEqual(canRestHere({ ...inn, remainingHoursRented: 48 }),
    { kind: 'refuse', message: HAVE_NOT_RENTED_ROOM });
  assert.deepEqual(canRestHere({ ...inn, houseOwned: true }),
    { kind: 'refuse', message: HAVE_NOT_RENTED_ROOM });
  // MUTATION: reading remainingHoursRented before the scene test lets
  // a player sleep in a building they have never held anything in.
  // With one: a ship, a house, or hours left on the room.
  assert.equal(canRestHere({ ...inn, permanentScene: true, isShip: true }).kind, 'allow');
  assert.equal(canRestHere({ ...inn, permanentScene: true, houseOwned: true }).kind, 'allow');
  assert.equal(canRestHere({ ...inn, permanentScene: true, remainingHoursRented: 1 }).kind, 'allow');
  // ...and an EXPIRED room is not hours left. GetRemainingHours
  // answers -1 for no room at all and 0 for one that has run out.
  assert.equal(canRestHere({ ...inn, permanentScene: true, remainingHoursRented: 0 }).kind, 'refuse');
  assert.equal(canRestHere({ ...inn, permanentScene: true, remainingHoursRented: -1 }).kind, 'refuse');
});

test('rest: the guild arm EXCLUDES taverns, and DFU says why', () => {
  const inn = { inTown: true, insideBuilding: true, guildCanRest: true };
  // "exclude taverns since they are all marked as fighters guilds in
  // data" - without that test every inn in the Bay is a free bed for
  // a Fighters Guild member.
  assert.equal(canRestHere({ ...inn, buildingIsTavern: false }).kind, 'allow');
  assert.equal(canRestHere({ ...inn, buildingIsTavern: true }).kind, 'refuse');
  // and a hall the player is not a member of is no help either
  assert.equal(canRestHere({ inTown: true, insideBuilding: true, guildCanRest: false }).kind, 'refuse');
  // MUTATION: dropping `!buildingIsTavern` makes every tavern free.
});

// ---------------------------------------------------------------
// 3. THE WIRING
// ---------------------------------------------------------------

test('rest: both above-ground hosts open it, through ONE deps builder', () => {
  for (const host of ['scenes/world.js', 'scenes/exterior.js']) {
    const h = src(host);
    assert.match(h, /if \(act === 'Rest'\) \{ hudCtx\.toggleRest\(\); return; \}/, `${host} binds KeyR`);
    assert.match(h, /makeRestDeps\(playerEntity, \{/, `${host} builds its deps from the shared builder`);
    assert.match(h, /new RestWindow\(restDeps\)/, `${host} opens the window`);
    // the enemy arm RAISES the alert before refusing (:654-655)
    assert.match(h, /setEnemyAlert\(playerEntity, true, worldMinutes\(\)\)/, `${host} raises the alert`);
    // and the camping crime is charged through the real producer
    assert.match(h, /playerEntity\.crimeCommitted = where\.crime/, `${host} books the vagrancy`);
    assert.match(h, /cityGuards\?\.spawnCityGuards\?\.\(true/, `${host} spawns the guards`);
  }
  // ONE builder, in shared.js, and the dungeon host keeps its own
  // because it has a foe list and a spawner to feed.
  assert.match(src('scenes/shared.js'), /export function makeRestDeps\(/);
  // the WORLD host alone carries the encounter roll through the rest -
  // it is the only above-ground host with a pool to spawn into
  assert.match(src('scenes/world.js'), /afterAdvance: \(\) => runEncounterTick\(/);
  assert.doesNotMatch(src('scenes/exterior.js'), /afterAdvance:/,
    'the fixed ?town page has no mobile foe pool, and does not pretend to');
});

test('rest: the finish text arrives as TEXT.RSC ROWS, and the panel draws STRINGS', async () => {
  // The other thing only the probe could find, on the page-error
  // channel: the first hour that actually COMPLETED above ground threw
  // "text is not iterable". Every endLines feed in the tree is a
  // TEXT.RSC reader - dungeonContext's rscLines, both above-ground
  // hosts' townTalk.lines - and those answer { text, center } records.
  // RestWindow is the plain text-panel idiom, which measures a line by
  // ITERATING it, so a row object threw the moment the rest ended.
  const { RestWindow } = await import('../src/ui/restWindow.js');
  const rows = [{ text: 'You wake up.', center: false }];
  const w = new RestWindow({ endLines: () => rows, advanceMinutes: () => {}, tickVitals: () => false,
    enemiesNearby: () => false, dead: () => false, vitals: () => null, onRestFinished: () => {} });
  w._end({ textId: 353, died: false, enemyBroke: false });
  assert.deepEqual(w.endLines, ['You wake up.'], 'the row must be flattened to its text');
  assert.equal(w.state, 'ended');
  // a plain string feed is untouched - three of DFU's own callers
  // compose their own line
  const w2 = new RestWindow({ endLines: () => ['You are healed.'] });
  w2._end({ textId: 350, died: false });
  assert.deepEqual(w2.endLines, ['You are healed.']);
  // ...and NOTHING at all still ends the window rather than drawing an
  // empty panel: an EMPTY array is as absent as null, which is what
  // `rows?.length` is for.
  const w3 = new RestWindow({ endLines: () => [] });
  w3._end({ textId: 353, died: false });
  assert.equal(w3.done, true);
  assert.equal(w3.endLines, null);
  // DEATH DOES NOT EVEN ASK. The death screen owns the flow, so the
  // text is never fetched - and that is the observable difference,
  // since the `died ||` guard one line down would end the window
  // either way. Pinned on the CALL, which is the only thing that can
  // tell the two apart.
  let asked = 0;
  const w4 = new RestWindow({ endLines: () => { asked++; return rows; } });
  w4._end({ textId: 353, died: true });
  assert.equal(asked, 0, 'the death path must not ask for a finish line');
  assert.equal(w4.done, true, 'death lets the death screen own the flow');
});

test('rest: the window has a SECOND clock name, and the shared seam calls it', () => {
  // The live probe's finding, and it is AUDIT 18 F5 arriving at the
  // other seam. RestWindow spells its clock `tickRest`, so
  // townTalk.frame's `overlay?.tick?.(dt)` walked straight past it:
  // both above-ground hosts opened a real rest window that never
  // advanced a minute. Nothing in the unit suite could see that - the
  // session machine ticks fine when something ticks it - so this pin
  // watches the SEAM.
  const tt = src('scenes/townTalk.js');
  assert.match(tt, /if \(overlay\?\.isRestWindow\) overlay\.tickRest\?\.\(dt\);/,
    'townTalk.frame must drive the rest window\'s own clock');
  // ...and ABOVE the done drain, so a rest that ends ITSELF is
  // cleared on the same frame rather than latching a dead window.
  // The STATEMENT, not the word: the comment beside it says
  // "tickRest" too, and a first draft found that instead - so moving
  // the call below the drain left the comment sitting where the code
  // used to be and the pin passed.
  const body = tt.slice(tt.indexOf('function frame(dt)'), tt.indexOf('function pointerdown'));
  assert.ok(body.indexOf('overlay.tickRest?.(dt);') < body.indexOf('if (overlay?.done)'),
    'the rest tick must run before the done drain');
  // The dungeon host has had both since AUDIT 18 F5 - one law, two
  // seams, and the second one is now the same shape.
  assert.match(src('scenes/dungeonContext.js'), /if \(activeOverlay\.isRestWindow\) activeOverlay\.tickRest\(dt\);/);
});

test('rest: all FOUR hosts answer for KeyR - three wired, the fourth flagged by name', () => {
  // THE FOUR HOSTS RULE. The dungeon context has owned the rest
  // window since U7 and keeps its own deps (it has a foe list and a
  // spawner to feed); world.js and exterior.js are U48's.
  assert.match(src('scenes/dungeonContext.js'), /toggleRest\(\) \{/);
  // The interior host is the one that CANNOT be wired yet, and it
  // says so at the exact seam where the binding would go: canRestHere
  // takes five building facts and nothing in worldModes can answer
  // them, so a bound KeyR there would be a free bed in every shop.
  const wm = src('scenes/worldModes.js');
  assert.doesNotMatch(wm, /^\s*toggleRest\s*[(:]/m, 'the interior host must not half-wire it');
  const flag = wm.match(/^.*U48 FLAGGED.*$/m);
  assert.ok(flag, 'and it must be FLAGGED by name, so regenOpenFlags carries it');
  // the flag names the ladder it is waiting on, not just "todo"
  const near = wm.slice(wm.indexOf(flag[0]), wm.indexOf(flag[0]) + 1200);
  assert.match(near, /PERMANENT SCENE/);
  assert.match(near, /canRestHere/);
});
