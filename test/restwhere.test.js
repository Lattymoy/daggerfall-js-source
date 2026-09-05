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
// THE FOUR WIRING PINS BELOW WERE REWRITTEN, and what killed them is
// worth writing down because they were the pins that should have
// caught it. scenes/world.js and scenes/exterior.js each ended up
// declaring `toggleRest` TWICE in one hudCtx literal: the complete
// path (createRestDeps + place/commitCrime delegating CanRest, the
// Vagrancy charge and the IllegalRestWarning two-step to
// systems/restSession.js and ui/restWindow.js) and, later in the same
// object, a crippled inline twin that re-implemented all three. The
// later key wins, so the twin ran the rest key - and every pin here
// still matched, because they matched the twin's SOURCE TEXT. A regex
// cannot see a shadowed key.
//
// So they now pin the LAW instead of the spelling: the real modules
// are imported and run where they can be, and where a claim is
// genuinely about the host's shape ("declared once", "the same
// expression as the world host", "reached through the one home") it is
// asserted as STRUCTURE - keys counted, values compared - rather than
// as a code spelling. The bible's own standing lesson: a pin that dies
// on a rename was never watching the behaviour, and a pin that
// restates the port instead of the source is not a pin.
//
// Everything here was mutation-proven.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  restDecision, canRest, REST_TEXT, RestSession, MINUTES_PER_TICK, REST_WAIT_PER_HOUR,
} from '../src/systems/restSession.js';
import { startRestGroundedCheck, CAPSULE_HEIGHT, PlayerMotor } from '../src/player/motor.js';
import { setEnemyAlert, decayEnemyAlert } from '../src/systems/encounters.js';
import { isPlayerInTown } from '../src/systems/nearbyObjects.js';
import { LOCATION_TYPES } from '../src/formats/mapsFile.js';
import { LIVE } from '../src/systems/settings.js';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));
const src = (rel) => readFileSync(join(SRC, rel), 'utf8');
/** Every module under src/, DERIVED on every run - a checked-in list
 *  is the stale-second-copy shape, and these are ONE HOME sweeps. */
const srcFiles = (dir = SRC) => readdirSync(dir, { withFileTypes: true }).flatMap((d) => (
  d.isDirectory() ? srcFiles(join(dir, d.name))
    : (d.name.endsWith('.js') ? [join(dir, d.name).slice(SRC.length)] : []))).sort();

/** The four hosts that can open a rest window. */
const REST_HOSTS = ['scenes/dungeonContext.js', 'scenes/world.js',
  'scenes/exterior.js', 'scenes/worldModes.js'];

// ---------------------------------------------------------------
// READING THE HOSTS AS STRUCTURE, NOT AS TEXT
// ---------------------------------------------------------------
//
// A host's boot function takes a canvas, a WebGL renderer and ARENA2
// bytes, so its rest wiring cannot be imported and run the way
// restSession and restWindow can. What CAN be read without falling
// back to a spelling is the shape: which keys an object literal
// declares, how many times, and what expression each one carries.
//
// The walk skips comments, quoted strings and template literals so a
// brace inside one cannot unbalance it, and `balanced` is asserted by
// every caller - an unterminated scan must fail loudly rather than
// quietly answer an empty key list.

function scan(source, opener) {
  const start = source.indexOf(opener);
  if (start < 0) return null;
  let i = start + opener.length;   // just past the opener's own brace
  let depth = 1;
  const entries = [];
  let token = '';
  let key = null;
  let valueFrom = 0;
  const flush = (at) => {
    if (key !== null) entries.push([key, source.slice(valueFrom, at).trim()]);
    key = null; token = '';
  };
  while (i < source.length && depth > 0) {
    const two = source.slice(i, i + 2);
    const c = source[i];
    if (two === '//') { const nl = source.indexOf('\n', i); i = nl < 0 ? source.length : nl; if (key === null) token = ''; continue; }
    if (two === '/*') { const e = source.indexOf('*/', i); i = e < 0 ? source.length : e + 2; if (key === null) token = ''; continue; }
    if (c === '"' || c === "'") {
      const q = c; i++;
      while (i < source.length && source[i] !== q) { if (source[i] === '\\') i++; i++; }
      i++; continue;
    }
    if (c === '`') {
      i++;
      let td = 0;
      while (i < source.length) {
        if (source[i] === '\\') { i += 2; continue; }
        if (source.slice(i, i + 2) === '${') { td++; i += 2; continue; }
        if (source[i] === '}' && td > 0) { td--; i++; continue; }
        if (source[i] === '`' && td === 0) break;
        i++;
      }
      i++; continue;
    }
    if (c === '{' || c === '(' || c === '[') { depth++; i++; continue; }
    if (c === '}' || c === ')' || c === ']') {
      depth--; i++;
      if (depth === 0) flush(i - 1);
      continue;
    }
    if (depth === 1 && c === ':' && key === null) { key = token.trim(); token = ''; valueFrom = i + 1; i++; continue; }
    if (depth === 1 && c === ',') { flush(i); i++; continue; }
    if (key === null) token += c;
    i++;
  }
  return {
    balanced: depth === 0,
    body: source.slice(start, i),
    keys: entries.map(([k]) => k),
    count: (k) => entries.filter(([n]) => n === k).length,
    value: (k) => entries.find(([n]) => n === k)?.[1],
  };
}

/** The same walk, used to blank out comments before a tree sweep - so
 *  a law NAMED in prose is never mistaken for a law IMPLEMENTED. */
function stripComments(s) {
  let out = '';
  let i = 0;
  while (i < s.length) {
    const two = s.slice(i, i + 2);
    const c = s[i];
    if (two === '//') { const nl = s.indexOf('\n', i); i = nl < 0 ? s.length : nl; continue; }
    if (two === '/*') { const e = s.indexOf('*/', i); i = e < 0 ? s.length : e + 2; continue; }
    if (c === '"' || c === "'" || c === '`') {
      const q = c; out += c; i++;
      while (i < s.length && s[i] !== q) { if (s[i] === '\\') { out += s[i]; i++; } out += s[i]; i++; }
      out += s[i] ?? ''; i++; continue;
    }
    out += c; i++;
  }
  return out;
}

/** Which modules under src/ actually CONTAIN this law (comments do not
 *  count). The ONE DFU MEMBER, ONE EXPORT rule, made checkable. */
const modulesMatching = (re) => srcFiles().filter((f) => re.test(stripComments(src(f))));

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

test('rest: the grounded check has ONE home, and every rest host feeds the dispatch through it', () => {
  // PlayerMotor.cs:184-193 owns the check, so player/motor.js owns the
  // port - it lived inline in dungeonContext while that was its only
  // caller, and U48 gave it three more.
  //
  // ONE HOME is a claim about the whole tree, not a spelling in one
  // host, and what a second copy would bring back is DFU's RAY - so
  // the ray is what the sweep looks for. `controller.height / 2 +
  // 0.2f` is the only geometry in the law; a duplicate cannot avoid
  // writing it.
  // AUDIT 26 F069: the needle was bare `/ 2 + 0.2`, which is arithmetic
  // rather than geometry - worldModes' AlignBillboardToGround centre
  // offset (`by + size.h / 2 + 0.2`) matched it without being a second
  // copy of anything. The rest ray's geometry is the CAPSULE's, and a
  // real duplicate could not avoid writing that, so the needle now
  // names it. Intent unchanged; the false positive is gone.
  assert.deepEqual(modulesMatching(/CAPSULE_HEIGHT\s*\/\s*2\s*\+\s*0\.2(?!\d)/), ['player/motor.js'],
    'the fallback ray is written in exactly one module');
  assert.equal(typeof startRestGroundedCheck, 'function');

  // ...and all four hosts reach it through the DISPATCH's own
  // `grounded` slot. Read as the argument literal's key rather than as
  // source text: the slot is what carries the law, and the first draft
  // of this pin died on a `!!` in front of the flag.
  for (const h of REST_HOSTS) {
    const d = scan(src(h), 'restDecision({');
    assert.ok(d?.balanced, `${h}: the dispatch call did not parse`);
    // V2b: the FOURTH question is DFU's own - DaggerfallUI's rest
    // ladder ends at racialOverride.CheckStartRest, and the dispatch
    // carries it as racialOverrideBlocks (fed by racialRestBlock).
    //
    // ROAD-B B5 MOVED THIS PIN from four keys to five, deliberately.
    // DaggerfallUI.cs:651-688 has always asked FIVE things and
    // restDecision has always had five slots; the third,
    // GetPreventedRestMessage (:669), had no producer in the port -
    // the registry itself (GameManager.cs:52, :637-675) was unported -
    // so every host omitted the key and the arm was dead. B5 ported
    // the registry, so the key is now part of the dispatch a host owes
    // and its ABSENCE is the drift worth failing on. The ORDER is
    // still DFU's ladder read top to bottom.
    assert.deepEqual(d.keys, ['enemiesNearby', 'swimming', 'grounded', 'preventedMessage', 'racialOverrideBlocks'],
      `${h} asks DFU's five questions and asks nothing about the scene`);
    // PIN MOVED (ROAD review-p): the registry is handed over as the
    // PRODUCER. DFU reads it inside the third `else` (:667-669), after
    // the enemy and swimming/grounded arms have returned, so a host
    // that polls it eagerly runs the caller's conditions on presses
    // DFU never brings them into.
    assert.match(d.value('preventedMessage'), /getPreventedRestMessage(?!\()/,
      `${h} reads the ONE registry rather than inventing a condition`);
    assert.match(d.value('grounded'), /startRestGroundedCheck\(/,
      `${h} must feed the dispatch through the one home, not the raw flag`);
  }

  // THE RAW FLAG IS NOT ENOUGH UP HERE, and for a reason DFU never
  // has: on a page whose motor is never stepped `grounded` sits at its
  // initialiser forever, so KeyR answered 355 on solid ground. Pinned
  // by BUILDING one - the fact is the motor's behaviour, not the
  // spelling of the line that sets it.
  const fresh = new PlayerMotor({ raycast: () => 0.3 });
  assert.equal(fresh.grounded, false, 'an unstepped motor reports NOT grounded');
  assert.equal(startRestGroundedCheck(fresh.grounded, fresh.pos, fresh.collider), true,
    'the fallback ray is what lets an unstepped page rest at all');
});

// ---------------------------------------------------------------
// 3. THE WIRING
// ---------------------------------------------------------------

test('rest: both above-ground hosts run the DISPATCH, and ONLY its enemies arm raises the alert', () => {
  // DaggerfallUI.cs:651-687. The arm order carries a SIDE EFFECT:
  // SetEnemyAlert(true) sits inside the enemies branch (:654-655) and
  // nowhere else, so a swimming player is refused having armed
  // nothing, while a player with a foe in the street has paid for the
  // attempt - the alert is what arms the rest-encounter roll.
  //
  // THE LAW, over the real modules.
  const e = {};
  assert.equal(restDecision({ enemiesNearby: true, swimming: true }).kind, 'enemies');
  setEnemyAlert(e, true, 600);
  assert.deepEqual(e, { enemyAlertActive: true, lastEnemyAlertTime: 600 });
  // ...and it is not free: PlayerEntity.Update:380-384 only lowers it
  // eight hours later, so the refusal costs the player a whole armed
  // night.
  decayEnemyAlert(e, 600 + 8 * 60);
  assert.equal(e.enemyAlertActive, true, 'eight hours is not YET the decay');
  decayEnemyAlert(e, 600 + 8 * 60 + 1);
  assert.equal(e.enemyAlertActive, false);

  // THE HOSTS' OBEDIENCE, as the shape of the toggle rather than as
  // its text. A first draft asked only that `restDecision` appeared in
  // the file, which a toggle that hardcodes `{ kind: 'rest' }` and
  // leaves the helper unused survives - both hosts survived that
  // mutant.
  for (const host of ['scenes/world.js', 'scenes/exterior.js']) {
    const h = src(host);
    const t = scan(h, 'const toggleRest = () => {');
    assert.ok(t?.balanced, `${host}: the toggle did not parse`);
    const body = stripComments(t.body);
    assert.equal((body.match(/restDecision\(/g) ?? []).length, 1,
      `${host}'s toggle runs the dispatch itself, exactly once`);
    // The alert is raised on the ENEMY arm ONLY. Asserted as the
    // GUARD, not as the call: every line that raises it must be the
    // enemies line.
    const raises = body.split('\n').filter((l) => l.includes('setEnemyAlert('));
    assert.equal(raises.length, 1, `${host} raises the alert exactly once`);
    assert.match(raises[0], /d\.kind === 'enemies'/, `${host} raises it on the enemies arm alone`);
    // ...and a racial override says NOTHING: no box at all.
    // V2b: the blocked arm SPEAKS now - the unfed vampire's own
    // TEXT.RSC 36 box - so the pin holds the arm and its voice.
    assert.match(body, /d\.kind === 'blocked'\)\s*\{/, `${host} acts on a racial override's block`);
    assert.match(body, /rb\.textId/, `${host} speaks the override's own record`);
    // The window opens only past the gate, and only once.
    assert.equal((body.match(/new RestWindow\(/g) ?? []).length, 1, `${host} opens ONE rest window`);
    assert.ok(body.indexOf('restDecision(') < body.indexOf('new RestWindow('),
      `${host}: the gate must precede the window`);
  }

  // THE DISPATCH IS ABOVE CANREST, and the port says so by OWNERSHIP:
  // the host asks the dispatch, and the window it opens asks CanRest.
  // The old pin compared the dispatch's offset against the host's own
  // `getBool('GUI', 'IllegalRestWarning')` - which the hosts no longer
  // have at all, so `indexOf` answered -1 and the comparison went
  // quietly false. This is the claim it was reaching for, and it is a
  // ONE DFU MEMBER, ONE EXPORT sweep: CanRest, the camping warning and
  // the Vagrancy charge live in exactly one place each, and it is
  // never a host.
  assert.deepEqual(modulesMatching(/(?<![\w.])canRest\(/),
    ['systems/restSession.js', 'ui/restWindow.js'],
    'CanRest is DECLARED in restSession and CALLED by the window - by no host');
  assert.deepEqual(modulesMatching(/ILLEGAL_REST_WARNING/),
    ['systems/restSession.js', 'ui/restWindow.js']);
  assert.deepEqual(modulesMatching(/getBool\('GUI', 'IllegalRestWarning'\)/),
    ['systems/restSession.js'], 'the setting has one reader');
  // ...and the settings ledger names that reader. It named
  // scenes/world.js through a DUPLICATE KEY - the same defect class as
  // the twin above, one file over - and the claim went stale the
  // moment the host stopped reading it.
  assert.equal(LIVE['GUI/IllegalRestWarning'], 'src/systems/restSession.js');
});

test('rest: the ?town page is the FOURTH host, and it runs the SAME laws as the world host', () => {
  // V5's own pin says "every host that can hold a player now has a
  // rest arm" and names three. This page holds one.
  const e = src('scenes/exterior.js');
  const w = src('scenes/world.js');

  // ONE toggleRest ON THE LADDER'S CONTEXT OBJECT. This is the pin the
  // duplicate-key defect needed and that no regex could give: both
  // hosts declared the key TWICE in this literal, the later one won,
  // and a `toggleRest: () => ...` match found the dead first one and
  // reported green. Keys are COUNTED here, so a shadowed one cannot
  // hide behind a match.
  for (const [f, s] of [['scenes/exterior.js', e], ['scenes/world.js', w]]) {
    const hud = scan(s, 'const hudCtx = {');
    assert.ok(hud?.balanced, `${f}: hudCtx did not parse`);
    assert.ok(hud.keys.includes('toggleRest'), `${f}: hudCtx has a rest door`);
    assert.deepEqual(hud.keys.filter((k, i) => hud.keys.indexOf(k) !== i), [],
      `${f}: no hudCtx key may be declared twice - the later one silently wins`);
  }
  // ...and the Rest action reaches that door. The whole arm, not the
  // action name: matching the name alone survives a `false &&` in
  // front of it, which leaves the key dead.
  assert.match(e, /if \(act === 'Rest'\) \{[^}]*hudCtx\.toggleRest\(\);[^}]*\}/,
    'the key ladder routes Rest into the one door');

  // THE SAME TWO LAWS AS THE WORLD HOST, asserted as SAMENESS rather
  // than as two spellings. The twin this page used to run carried its
  // own CanRest call, its own Vagrancy charge and its own warning box,
  // and it hardcoded `inTownOutside: true`.
  const ed = scan(e, 'createRestDeps(playerEntity, {');
  const wd = scan(w, 'createRestDeps(playerEntity, {');
  assert.ok(ed?.balanced && wd?.balanced, 'both hosts build their deps from the ONE factory');
  for (const k of ['place', 'commitCrime', 'endLines', 'onClose']) {
    assert.ok(ed.value(k), `the ?town page supplies ${k}`);
    assert.equal(ed.value(k), wd.value(k), `${k} is ONE law shared with the world host, not a fifth copy`);
  }
  // The crime rides the verdict rather than being named by the host:
  // canRest mints it, the host relays whatever it was handed.
  assert.match(ed.value('commitCrime'), /setCrimeCommitted\(playerEntity, crime\);/);   // V4: through the one setter (SuppressCrime)
  assert.deepEqual(modulesMatching(/CRIMES\.Vagrancy/), [],
    'no host names the crime itself - CanRest answers it');
  // ...and the dispatch above it is the same three questions too.
  assert.equal(scan(e, 'restDecision({').body, scan(w, 'restDecision({').body);

  // `inTownOutside` IS NOT A CONSTANT ON THIS PAGE, and that is the
  // law the twin got wrong. PlayerGPS.IsPlayerInTown(:504-527) tests
  // the LOCATION TYPE first, and only seven of the fifteen are towns -
  // so the ?town page loaded on a graveyard is not a town, and camping
  // there is no crime. Both hosts write the strict test once, and both
  // write the SAME one.
  const strict = (s) => s.match(/const _isPlayerInTownStrict = \(\) =>([\s\S]*?)\n\s*\}\);/)?.[1];
  assert.ok(strict(e), 'the ?town page asks IsPlayerInTown(true, true)');
  assert.equal(strict(e), strict(w), 'and asks it exactly as the world host does');

  // The law itself, run: in a city's rect and outdoors it is Vagrancy
  // either way (CanRest :542-560); on a graveyard, or through a door,
  // rest is free.
  const inTownOutside = (locationType, { inRect = true, inside = false } = {}) => isPlayerInTown(
    locationType, { mustBeInLocationRect: true, mustBeOutside: true, inLocationRect: inRect, inside });
  assert.equal(inTownOutside(LOCATION_TYPES.TownCity), true);
  assert.equal(inTownOutside(LOCATION_TYPES.Graveyard), false, 'a graveyard is not a town');
  assert.equal(inTownOutside(LOCATION_TYPES.TownCity, { inside: true }), false, 'mustBeOutside');
  assert.deepEqual(canRest({ inTownOutside: inTownOutside(LOCATION_TYPES.TownCity), inTownLocation: false }),
    { allowed: false, textId: REST_TEXT.cityCampingIllegal, crime: 'Vagrancy', spawnGuards: true, hoursRented: -1, bedIndex: -1 });
  assert.deepEqual(canRest({ inTownOutside: inTownOutside(LOCATION_TYPES.Graveyard), inTownLocation: false }),
    { allowed: true, hoursRented: -1, bedIndex: -1 });
});

test('rest: the world host carries the ENCOUNTER roll through a rested night', () => {
  // PlayerEntity.Update:484-491 runs ONE intermittent roll per elapsed
  // game minute and breaks on a spawn. It is the ENTITY update, so in
  // DFU it keeps rolling while the rest window raises time; this
  // port's frame body returns at the overlay gate, so left to the
  // frame a whole night's rolls fire in one burst the moment the
  // window closes - AUDIT 24 wave 30's finding about the magic rounds,
  // one system over. The catch-up has to ride INSIDE advanceMinutes.
  //
  // THE BEHAVIOUR FIRST: TickRest advances in TEN-MINUTE sub-ticks
  // (:376, MINUTES_PER_TICK), so anything composed into advanceMinutes
  // runs THROUGH the night rather than after it.
  const spans = [];
  const s = new RestSession('timed', 2, {
    advanceMinutes: (n) => spans.push(n),
    tickVitals: () => false, fullyHealed: () => false,
    enemiesNearby: () => false, dead: () => false,
  });
  let out = null;
  for (let i = 0; i < 200 && !out; i++) out = s.tick(REST_WAIT_PER_HOUR / MINUTES_PER_TICK + 1e-9);
  assert.equal(out?.textId, REST_TEXT.wakeUp, 'two hours rested');
  assert.deepEqual(spans, Array(12).fill(MINUTES_PER_TICK),
    'twelve sub-ticks of ten minutes - never one 120-minute jump');

  // ...and the world host is the one that composes the roll in,
  // because it is the only host with a mobile foe pool to spawn into.
  // Read as the dep's own VALUE: the first draft matched the line's
  // braces and semicolons and died when the ?town page's twin dropped
  // its block body.
  const wd = scan(src('scenes/world.js'), 'createRestDeps(playerEntity, {');
  assert.match(wd.value('advanceMinutes'), /runEncounterTick\(/, 'the roll rides inside the advance');
  assert.match(wd.value('advanceMinutes'), /playerTicker\.advance\(n\)/, 'and rides ON the clock, not instead of it');
  assert.ok(wd.value('advanceMinutes').indexOf('playerTicker.advance(n)')
    < wd.value('advanceMinutes').indexOf('runEncounterTick('),
    'the minutes pass before the roll asks how many passed');
  // ROAD-G TAIL (2026-09-05): the ?town page HAS the pool now (ROAD-G G2
  // mounted it) and carries the same loop - the catch-up has TWO homes,
  // one per streaming host, each riding its own rest advance.
  const ed = scan(src('scenes/exterior.js'), 'createRestDeps(playerEntity, {');
  assert.match(ed.value('advanceMinutes'), /runEncounterTick\(/, 'the fixed city rolls the rested night too');
  assert.match(ed.value('advanceMinutes'), /playerTicker\.advance\(n\)/);
  assert.ok(ed.value('advanceMinutes').indexOf('playerTicker.advance(n)') < ed.value('advanceMinutes').indexOf('runEncounterTick('));
  assert.deepEqual(modulesMatching(/runEncounterTick/), ['scenes/exterior.js', 'scenes/world.js']);
});
