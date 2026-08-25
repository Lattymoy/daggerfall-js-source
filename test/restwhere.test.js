// U48 - THE REST DISPATCH, and the fourth host.
//
// V5 ported CanRest (test/canrest.test.js pins it) and wired three
// hosts to it. Two things it left: the ladder that runs BEFORE
// CanRest - DaggerfallUI.cs:651-688, which asks about enemies, water
// and the ground - still lived inline inside dungeonContext alone, so
// above ground the rest window opened while swimming, while falling,
// and with a foe in the street; and the single-location ?town page,
// the fourth host that can hold a player, had no rest arm at all.
//
// Everything here was mutation-proven.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { restDecision, REST_TEXT } from '../src/systems/restSession.js';
import { startRestGroundedCheck, CAPSULE_HEIGHT } from '../src/player/motor.js';

const src = (rel) => readFileSync(new URL(`../src/${rel}`, import.meta.url), 'utf8');

// ---------------------------------------------------------------
// 1. THE DISPATCH
// ---------------------------------------------------------------

test('rest: the dispatch asks about enemies, water and the ground - and NOTHING about the scene', () => {
  // DaggerfallUI.cs:651-688 has no dungeon/building/outdoors test at
  // all, which is why this is a ladder and not a per-host branch.
  assert.deepEqual(restDecision({}), { kind: 'rest' });
  assert.deepEqual(restDecision({ enemiesNearby: true }), { kind: 'enemies', textId: REST_TEXT.enemiesNearby });
  assert.deepEqual(restDecision({ swimming: true }), { kind: 'cannot', textId: REST_TEXT.cannotRestNow });
  assert.deepEqual(restDecision({ grounded: false }), { kind: 'cannot', textId: REST_TEXT.cannotRestNow });
  assert.equal(REST_TEXT.enemiesNearby, 354);
  assert.equal(REST_TEXT.cannotRestNow, 355);
  // ENEMIES OUTRANK THE WATER: DFU's is an if/else-if chain, so a
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
  // RacialOverrideEffect.CheckStartRest - "allow custom race to block
  // rest (e.g. vampire not sated)". DFU simply returns, with no
  // message at all, which is why this kind carries no text.
  assert.deepEqual(restDecision({ racialOverrideBlocks: true }), { kind: 'blocked' });
  // ...but it is BELOW the others: a swimming vampire is told about
  // the water, which is the arm the player can act on.
  assert.equal(restDecision({ racialOverrideBlocks: true, swimming: true }).kind, 'cannot');
  assert.equal(restDecision({ racialOverrideBlocks: true, preventedMessage: 'x' }).kind, 'prevented');
  assert.equal(restDecision({ racialOverrideBlocks: true, enemiesNearby: true }).kind, 'enemies');
});

// ---------------------------------------------------------------
// 2. THE GROUNDED CHECK, AND ITS ONE HOME
// ---------------------------------------------------------------

test('rest: StartRestGroundedCheck - the flag, then DFU\'s fallback ray', () => {
  // PlayerMotor.cs:184-194. "Standard grounded will pass check
  // immediately"; otherwise a downward ray from the controller CENTRE
  // for height/2 + 0.2, which is DFU's "collision fix for when player
  // is levitating but feet are close enough to ground to rest".
  const asked = [];
  const collider = { raycast: (o, d, max) => { asked.push([o.slice(), d, max]); return 0.4; } };
  assert.equal(startRestGroundedCheck(true, [1, 2, 3], null), true, 'grounded passes with no ray at all');
  assert.equal(asked.length, 0);

  assert.equal(startRestGroundedCheck(false, [1, 2, 3], collider), true);
  assert.deepEqual(asked[0][0], [1, 2 + CAPSULE_HEIGHT / 2, 3], 'from the controller CENTRE, not the feet');
  assert.deepEqual(asked[0][1], [0, -1, 0]);
  assert.equal(asked[0][2], CAPSULE_HEIGHT / 2 + 0.2, 'height/2 + 0.2, derived so it cannot drift from the motor');

  // no hit is not-grounded; the reader answers null, not Infinity
  assert.equal(startRestGroundedCheck(false, [1, 2, 3], { raycast: () => null }), false);
  // A HIT AT DISTANCE ZERO IS A HIT - the ray starts inside the
  // capsule, so a surface exactly at the controller centre answers 0,
  // and `!!dist` would call that no floor at all. Number.isFinite is
  // the test for a reason.
  assert.equal(startRestGroundedCheck(false, [1, 2, 3], { raycast: () => 0 }), true);
  // ...and a caller with nothing to cast against is refused rather
  // than trusted: a mock motor must not sleep in mid-air.
  assert.equal(startRestGroundedCheck(false, [1, 2, 3], null), false);
  assert.equal(startRestGroundedCheck(false, null, collider), false);
});

test('rest: the grounded check has ONE home, and all three rest hosts call it', () => {
  // It lived inline in dungeonContext, which was fine while that was
  // its only caller. U48 gave it two more, so it moved to the file
  // DFU keeps it in - and the copy is gone rather than duplicated.
  assert.match(src('player/motor.js'), /export function startRestGroundedCheck\(/);
  for (const h of ['scenes/dungeonContext.js', 'scenes/world.js', 'scenes/exterior.js']) {
    assert.match(src(h), /startRestGroundedCheck\(/, `${h} calls the one home`);
  }
  // the inline geometry must be GONE from the dungeon, not shadowed
  // MERGED: the pin used to forbid a `const nearFloor =` local, which
  // was a proxy for "the inline geometry is gone". The geometry itself
  // is the thing to forbid, and forbidding the local would have made
  // a named intermediate a failure - so this asks the real question.
  assert.doesNotMatch(src('scenes/dungeonContext.js'), /CAPSULE_HEIGHT \/ 2 \+ 0\.2/,
    'the dungeon must not keep its own copy of the ray');
  // THE RAW FLAG IS NOT ENOUGH UP HERE, and for a reason DFU never
  // has: on a page whose motor is never stepped `grounded` sits at its
  // initialiser `false` forever, so KeyR answered 355 on solid ground.
  // Pinned as the initialiser, because that is the fact that makes the
  // fallback load-bearing outside the levitation case.
  assert.match(src('player/motor.js'), /this\.grounded = false;/);
  for (const h of ['scenes/world.js', 'scenes/exterior.js']) {
    // the DISPATCH's own grounded slot, not any mention of the flag -
    // the world host also reports it on a probe surface, and a bare
    // ban matched that instead.
    assert.match(src(h), /grounded: startRestGroundedCheck\(player\.grounded, player\.pos, collider\)/,
      `${h} must feed the dispatch through the check, not the raw flag`);
  }
});

// ---------------------------------------------------------------
// 3. THE WIRING
// ---------------------------------------------------------------

test('rest: both above-ground hosts run the DISPATCH before CanRest, and raise the alert', () => {
  for (const host of ['scenes/world.js', 'scenes/exterior.js']) {
    const h = src(host);
    assert.match(h, /restDecision\(\{/, `${host} runs the dispatch`);
    // ...and the KEY'S OWN function calls it. A first draft asked only
    // that restDecision appeared in the file, which a toggle that
    // hardcodes `{ kind: 'rest' }` and leaves the helper unused passes
    // - both hosts survived that mutant.
    // MERGED: the key's own function is `toggleRest` in both hosts now
    // (the two lanes named it differently); what matters is unchanged -
    // the toggle itself runs the dispatch rather than hardcoding a
    // verdict and leaving the helper unused, a mutant both hosts once
    // survived.
    const toggle = h.slice(h.indexOf('const toggleRest = () => {'));
    assert.match(toggle.slice(0, 600), /const d = restDecision\(\{/,
      `${host}'s toggle must run the dispatch, not a literal`);
    assert.match(h, /setEnemyAlert\(playerEntity, true, Math\.floor\(worldMinutes\(\)\)\)/, `${host} raises the alert`);
    // the alert is raised on the ENEMY arm only - it is what arms the
    // rest-encounter roll, and the water arm must not arm it
    const arm = h.slice(h.indexOf('if (d.kind !== \'rest\')'), h.indexOf('if (d.kind !== \'rest\')') + 900);
    assert.match(arm, /d\.kind === 'enemies'.*setEnemyAlert/s, `${host} raises it on the enemy arm`);
    // ...and a racial override says NOTHING: no box at all
    assert.match(arm, /d\.kind === 'blocked'\) return;/, `${host} refuses silently for a racial override`);
    // the dispatch runs BEFORE the camping question, not after
    // the CODE, not the comment above it: world.js explains the
    // two-step in prose thirty lines before it runs it.
    assert.ok(h.indexOf('restDecision({') < h.indexOf("getBool('GUI', 'IllegalRestWarning')"),
      `${host} must not ask about camping before it knows rest is possible at all`);
  }
});

test('rest: the ?town page is the FOURTH host, and it goes through the same two laws', () => {
  // V5's own pin says "every host that can hold a player now has a
  // rest arm" and names three. This page holds one.
  const e = src('scenes/exterior.js');
  assert.match(e, /if \(act === 'Rest'\) \{ hudCtx\.toggleRest\(\); return; \}/, 'the key ladder routes it');
  assert.match(e, /toggleRest: \(\) => toggleExteriorRest\(\)/, 'on hudCtx, like the world host');
  assert.match(e, /createRestDeps\(playerEntity, \{/, 'deps from the ONE factory, not a fifth copy');
  assert.match(e, /canRest\(\{/, 'and CanRest rather than an invented gate');
  assert.match(e, /new RestWindow\(exteriorRestDeps\)/);
  // THE TWO-STEP, verbatim: the warning box calls back with true, and
  // CanRest answers `alreadyWarned` itself.
  assert.match(e, /ILLEGAL_REST_WARNING/);
  assert.match(e, /action: \(\) => doExteriorRest\(true\)/);
  assert.match(e, /playerEntity\.crimeCommitted = CRIMES\.Vagrancy/, 'and the Vagrancy rides it');
  // This page IS a location and its player is always outdoors, so the
  // town-outside arm is a CONSTANT here - there is no wilderness to
  // step into and no building to step inside.
  assert.match(e, /canRest\(\{ inTownOutside: true, inTownLocation: false, alreadyWarned \}\)/);
});

test('rest: the world host carries the ENCOUNTER roll through a rested night', () => {
  const w = src('scenes/world.js');
  // It is the only host with a mobile foe pool to spawn into, and its
  // frame body returns at the overlay gate - so left to the frame, a
  // whole night's rolls fire in one burst the moment the window
  // closes. The catch-up rides INSIDE advanceMinutes.
  assert.match(w, /advanceMinutes: \(n\) => \{ playerTicker\.advance\(n\); runEncounterTick\(/);
  // ...and the fixed ?town page has no such pool and does not pretend
  assert.match(src('scenes/exterior.js'), /advanceMinutes: \(n\) => \{ playerTicker\.advance\(n\); \},/);
  assert.doesNotMatch(src('scenes/exterior.js'), /runEncounterTick/);
});
