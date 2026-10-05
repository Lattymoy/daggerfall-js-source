// WILD-ALERT (2026-10-04, Mac: "Wilderness enemies now approach/non approach based on distance and a stealth check.
// Enemies alerted are given an exclamation point and slow down as they do now, non alerted enemies do not slowdown or
// bother the player"). The law (systems/wildAlert.js: DFU's own stealth formula with the enemy's reach laid onto its
// range, a check a classic minute apart on the traveller's clock), the alert predicate (systems/encounters.js
// foeAlerted), the host's gate, band spotting and "!" marks lifted out of scenes/world.js and RUN, and the mark's DOM
// layer (ui/wildMarks.js) over a fake document.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { noticeChance, createWildAlert, WILD_ROLL_S, WILD_MARK_S, WILD_MARK } from '../src/systems/wildAlert.js';
import { stealthChance, STEALTH_MAX_DISTANCE, SIGHT_RADIUS } from '../src/characters/enemyMotor.js';
import { foeAlerted, foeHostile, areEnemiesNearby } from '../src/systems/encounters.js';
import { isLocalPlayerTarget, PLAYER_TARGET } from '../src/characters/enemyTargets.js';
import { drawWildMarks, destroyWildMarks, wildMarksMounted, wildMarkScale, wildMarkAlpha, WILD_MARK_RANGE, WILD_MARKS_MAX, WILD_MARKS_IDLE_MS } from '../src/ui/wildMarks.js';
import { fakeDoc } from './decorFakes.mjs';

const W = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
const cutFn = (name) => {
  const m = new RegExp(`\\n {2}function ${name}\\([^)]*\\) \\{\\n[\\s\\S]*?\\n {2}\\}\\n`).exec(W);
  assert.ok(m, `${name} lifted`);
  return m[0];
};
const cutConst = (name) => {
  const m = new RegExp(`\\n {2}const ${name} = [^\\n]*\\n`).exec(W);
  assert.ok(m, `${name} lifted`);
  return m[0];
};

// ── the law ─────────────────────────────────────────────────────────────────────────────────────────────────────────

test('WILD-ALERT law: THE NOTICE CHANCE IS DFU\'S STEALTH CHECK WITH THE REACH LAID ONTO ITS RANGE - at the reach\'s edge the traveller stays unseen with twice their Stealth in a hundred, at half the reach with their Stealth, close in almost never; outside the reach no check (mutants: the range unscaled, the complement dropped, the edge counted out)', () => {
  assert.equal(WILD_ROLL_S, 5, 'a classic game minute: sixty game seconds at TimeScale 12');
  assert.equal(STEALTH_MAX_DISTANCE, 25.6);
  // the formula's own numbers, DFU's int math, the reach onto 25.6 m
  const hidden = (dM, reach, s) => Math.min(100, stealthChance(dM * (STEALTH_MAX_DISTANCE / reach), s));
  for (const [d, reach, s] of [[320, 320, 25], [160, 320, 25], [32, 320, 25], [60, 60, 40], [5, 102.4, 50], [0, 102.4, 100]]) {
    assert.equal(noticeChance(d, reach, s), 100 - hidden(d, reach, s), `${d} m of ${reach}, Stealth ${s}`);
  }
  // the shape, in words
  const edge = noticeChance(320 - 1e-9, 320, 30), half = noticeChance(160, 320, 30), near = noticeChance(16, 320, 30);
  assert.ok(edge >= 100 - 2 * 30 - 1 && edge <= 100 - 2 * 30 + 3, `the edge: about 100 - 2 x Stealth (${edge})`);
  assert.ok(half >= 100 - 30 - 1 && half <= 100 - 30 + 2, `half the reach: about 100 - Stealth (${half})`);
  assert.ok(near > 95, `close in: almost always (${near})`);
  assert.ok(edge < half && half < near, 'nearer is likelier');
  assert.equal(noticeChance(320, 320, 30), 100 - Math.min(100, stealthChance(STEALTH_MAX_DISTANCE, 30)), 'AT the reach: checked');
  assert.ok(noticeChance(320, 320, 30) > 0);
  assert.equal(noticeChance(321, 320, 30), 0, 'outside the reach: no check at all');
  assert.equal(noticeChance(300, 320, 0), 100, 'no Stealth: noticed on the first check');
  assert.equal(noticeChance(319, 320, 100), 0, 'a master at the edge: never noticed there');
  assert.equal(noticeChance(10, 0, 50), 0, 'no reach, no sight');
});

test('WILD-ALERT law: THE CHECKS - the first the moment the enemy is within reach, then one a classic minute on the traveller\'s (scaled) clock; out of reach nothing is rolled and its return checks at once; an alerted enemy stays alerted; alert, checked, forget and prune (mutants: the first check delayed, the cadence real-time, the clock not reset out of reach, an alert forgotten)', () => {
  const dice = [];
  const w = createWildAlert({ rng: () => { const v = dice.shift(); assert.ok(v != null, 'a die was rolled that the pin did not expect'); return v; } });
  const q = (scaledDt, distM = 100) => ({ distM, reachM: 320, stealth: 30, scaledDt, now: 7 });
  dice.push(0.999);
  assert.deepEqual(w.step('b', q(0)), { alerted: false, noticed: false }, 'within reach: rolled at once, and missed');
  assert.equal(w.unaware('b'), true, 'checked, and keeping to its business');
  assert.deepEqual(w.step('b', q(4.9)), { alerted: false, noticed: false }, 'under a minute: no die');
  dice.push(0.999);
  w.step('b', q(0.1));   // the minute: the second check
  assert.equal(dice.length, 0, 'the second die was rolled on the minute');
  assert.deepEqual(w.step('b', q(100, 400)), { alerted: false, noticed: false }, 'out of reach: nothing, however long');
  dice.push(0);
  assert.deepEqual(w.step('b', q(0)), { alerted: true, noticed: true }, 'back within reach: checked at once - and noticed');
  assert.equal(w.alertedAt('b'), 7);
  assert.deepEqual(w.step('b', q(5, 4000)), { alerted: true, noticed: false }, 'alerted stays alerted, near or far');
  // x100: a classic minute is a twentieth of a real second at x100 - twelve frames at 60 fps hold ~4 checks
  const fast = createWildAlert({ rng: () => 0.999 });
  let rolls = 0;
  const counting = createWildAlert({ rng: () => { rolls++; return 0.999; } });
  for (let i = 0; i < 12; i++) counting.step('b', q((1 / 60) * 100));
  assert.equal(rolls, 1 + Math.floor((11 * (100 / 60)) / WILD_ROLL_S) + 0, `at x100 the checks follow the traveller's clock (${rolls})`);
  fast.alert('x', 3);
  assert.deepEqual([fast.alerted('x'), fast.alertedAt('x')], [true, 3], 'alerted another way');
  fast.checked('y');
  assert.equal(fast.unaware('y'), true);
  dice.length = 0;
  const later = createWildAlert({ rng: () => 0 });
  later.checked('y');
  assert.deepEqual(later.step('y', q(1)), { alerted: false, noticed: false }, 'a check made another way: the next waits its minute');
  assert.deepEqual(later.step('y', q(4)), { alerted: true, noticed: true });
  later.forget('y');
  assert.equal(later.alerted('y'), false, 'forgotten');
  const m = createWildAlert({ rng: () => 0 });
  m.step('a', q(0)); m.step('b', q(0));
  m.prune((k) => k === 'a');
  assert.deepEqual([m.alerted('a'), m.alerted('b')], [true, false], 'pruned to the kept');
  const weak = createWildAlert({ weak: true, rng: () => 0 });
  const rec = {};
  weak.step(rec, q(0));
  assert.equal(weak.alerted(rec), true, 'a foe record keys a weak store');
});

test('WILD-ALERT foeAlerted: A FOE ALERTED TO ME is hostile, on me (the motor\'s latch), and seeing me or still hunting me blind; a foe on another, unaware, pacified, an ally or the dead is not (mutants: the target unread, the blind pursuit dropped)', () => {
  const foe = (ai = {}, o = {}) => ({ dead: false, entity: {}, ai: { isHostile: true, targetIsLocalPlayer: true, detected: true, giveUpTimer: 0, ...ai }, ...o });
  assert.equal(foeAlerted(foe()), true);
  assert.equal(foeAlerted(foe({ detected: false, giveUpTimer: 40 })), true, 'out of sight, still hunting');
  assert.equal(foeAlerted(foe({ detected: false, giveUpTimer: 0 })), false, 'given up');
  assert.equal(foeAlerted(foe({ targetIsLocalPlayer: false })), false, 'on another');
  assert.equal(foeAlerted(foe({ targetIsLocalPlayer: undefined })), false, 'a bare stub has noticed nobody');
  assert.equal(foeAlerted(foe({ isHostile: false })), false, 'pacified');
  assert.equal(foeAlerted(foe({}, { dead: true })), false);
  assert.equal(foeAlerted(foe({}, { entity: { team: 'PlayerAlly' } })), foeHostile(foe({}, { entity: { team: 'PlayerAlly' } })), 'the one hostility gate');
});

// ── the host, run ───────────────────────────────────────────────────────────────────────────────────────────────────

/** world.js's gate (wildGated, wildSeen, wildFoesFrame) over stubs. */
function gateHost(over = {}) {
  const d = {
    travelling: true, mode: 'exterior', walkMode: true, spawned: true, scale: 60, stealth: 30, rects: () => false,
    foes: [], ...over,
  };
  const wildFoes = createWildAlert({ weak: true, rng: () => { d.rolls = (d.rolls ?? 0) + 1; return d.die ?? 0.999; } });
  const scope = {
    wildFoes, playerEntity: {}, SKILLS: { Stealth: 'Stealth' }, skillValue: () => d.stealth,
    travelControlUI: { get isShowing() { return d.travelling; } }, travelOptions: { state: { get autopilot() { return d.travelling ? {} : null; } } },
    tvWalking: 0, modes: { get mode() { return d.mode; } }, get walkMode() { return d.walkMode; }, get playerSpawned() { return d.spawned; },
    player: { feetAt: () => [0, 0, 0] }, worldTimeScale: () => d.scale, performance: { now: () => 0 }, gamePaused: () => !!d.paused,
    exteriorFoes: { get foes() { return d.foes; }, noticedPlayer: (f, feet) => (d.noticed ??= []).push({ f, feet }) }, foeHostile, isLocalPlayerTarget, SIGHT_RADIUS, _inAnyLocationRect: (p) => d.rects(p),
  };
  const names = Object.keys(scope);
  const body = `
    let { ${names.join(', ')} } = s;
    let _wildGate = false;
    ${cutConst('wildStealth')}${cutConst('wildTravelling')}${cutConst('wildGated')}${cutConst('wildSeen')}${cutFn('wildFoesFrame')}
    return { frame: wildFoesFrame, gated: wildGated, seen: wildSeen, gate: () => _wildGate };`;
  return { d, wildFoes, ...new Function('s', body)(scope) };
}
const wilds = (feet, ai = {}) => ({ dead: false, entity: {}, ai: { isHostile: true, feet, sightRadius: 60, target: null, targetIsLocalPlayer: false, detected: false, ...ai } });

test('WILD-ALERT host run: THE GATE - while a fast traveller crosses the wilderness each of my hostile foes in reach is checked, one already on me is alerted, a town\'s foe keeps the town\'s law, a peer\'s puppet is its owner\'s; the gated foes are left off the stops\' count; walking, indoors or dead, no gate (mutants: the gate always on, the town foe gated, the puppet gated, the stops counting the unaware)', () => {
  const near = wilds([0, 0, 30]), far = wilds([0, 0, 500]), onMe = wilds([0, 0, 40], { target: PLAYER_TARGET }), town = wilds([0, 0, 20]), pup = { ...wilds([0, 0, 25]), puppet: 'p2' };
  const g = gateHost({ foes: [near, far, onMe, town, pup], rects: (p) => p === town.ai.feet });
  g.frame(1 / 60);
  assert.equal(g.gate(), true, 'a journey drives, out of doors: the gate stands');
  assert.equal(g.wildFoes.unaware(near), true, 'within its sixty metres: checked (the die missed), unaware');
  assert.equal(g.wildFoes.unaware(far), false, 'out of reach: never checked');
  assert.equal(g.wildFoes.alerted(onMe), true, 'one already on me is alerted');
  assert.deepEqual([g.gated(near), g.gated(far), g.gated(onMe), g.gated(town), g.gated(pup)], [true, true, false, false, false],
    'gated: the unaware and the unchecked in the wilds; never the alerted, a town\'s, or a puppet');
  // the stops: an unaware foe a step away stops nothing; the same foe alerted does
  const beside = wilds([0, 0, 5], { wouldBeSpawned: true });
  const h = gateHost({ foes: [beside] });
  h.frame(1 / 60);
  assert.equal(areEnemiesNearby(h.seen(h.d.foes)), false, 'unaware within the classic band: no stop');
  assert.equal(areEnemiesNearby(h.d.foes), true, 'DFU\'s own sweep would have stopped for it');
  h.wildFoes.alert(beside);
  assert.equal(areEnemiesNearby(h.seen(h.d.foes)), true, 'alerted: the stop');
  // no fast traveller, no gate - DFU's senses as ever
  for (const quiet of [{ travelling: false }, { mode: 'interior' }, { walkMode: false }, { spawned: false }]) {
    const q = gateHost({ foes: [wilds([0, 0, 30])], ...quiet });
    q.frame(1 / 60);
    assert.deepEqual([q.gate(), q.gated(q.d.foes[0])], [false, false], `no gate: ${Object.keys(quiet)[0]}`);
  }
  // THE CADENCE IS THE TRAVELLER'S CLOCK: at x60 a sixtieth of a real second is one scaled second, so after the first
  // check at once the second comes five scaled seconds on - the sixth frame; walking at x1 it would be five real seconds
  const c = gateHost({ foes: [wilds([0, 0, 40])], scale: 60 });
  for (let i = 0; i < 5; i++) c.frame(1 / 60);
  assert.equal(c.d.rolls, 1, 'the first at once, and none more inside the minute');
  c.frame(1 / 60);
  assert.equal(c.d.rolls, 2, 'the second a classic minute of the traveller\'s clock on');
  const slow = gateHost({ foes: [wilds([0, 0, 40])], scale: 1 });
  for (let i = 0; i < 6; i++) slow.frame(1 / 60);
  assert.equal(slow.d.rolls, 1, 'at x1 the same six frames are a tenth of a real second: one check');
  // the die notices: alerted, ungated
  const n = gateHost({ foes: [wilds([0, 0, 10])], die: 0 });
  n.frame(1 / 60);
  assert.deepEqual([n.wildFoes.alerted(n.d.foes[0]), n.gated(n.d.foes[0])], [true, false], 'noticed: no longer gated - it comes');
});

test('WILD-ALERT host wiring: the pools leave the gated foe off its list (the target machine\'s dropLocal - AUDIT-F5: me alone, never a peer), the senses carry the host\'s answer, the gate runs before the pools move, and the journey\'s stops and the view\'s danger count no gated foe (mutants: each seam)', () => {
  const ef = readFileSync(new URL('../src/scenes/exteriorFoes.js', import.meta.url), 'utf8');
  assert.match(ef, /const wildUnaware = !!senses\.wildUnaware\?\.\(f\) && !isLocalPlayerTarget\(ai\.target\);/);
  assert.match(ef, /noTargetMode: campAsleep,[^\n]*\n\s*dropLocal: wildUnaware,/, 'AUDIT-F5: the gate drops me alone (the target machine\'s own local switch)');
  const sh = readFileSync(new URL('../src/scenes/shared.js', import.meta.url), 'utf8');
  assert.match(sh, /playerCrouching = false, wildUnaware = null \} = \{\}\)/);
  assert.match(sh, /\n\s*wildUnaware,\n\s*playerEntity: playerEntity \?\? entity,/);
  assert.match(W, /wildUnaware: \(f\) => wildGated\(f\),/);
  assert.match(W, /wildFoesFrame\(foeDt\);[^\n]*\n\s*if \(\(modes\?\.mode \?\? 'exterior'\) === 'exterior'\) \{\n[^\n]*\n\s*exteriorFoes\.update\(foeDt, _pf, cam\.pos, _foeSenses\(\)\);/);
  assert.match(W, /areEnemiesNearby\(\[\.\.\.cityGuards\.guards, \.\.\.wildSeen\(exteriorFoes\.foes\)\]\)/, 'the journey\'s stop');
  assert.match(W, /danger: \(\) => duelEnemyNear\(\) \|\| areEnemiesNearby\(wildSeen\(exteriorFoePool\(\)\)\),/, 'the view\'s danger');
  assert.match(W, /if \(!foeAlerted\(f\) \|\| !f\.ai\.feet \|\| f\.ai\.unreachable\) continue;/, 'the clock held for an alerted foe alone');
  assert.match(W, /wildMarksFrame\(proj, view, mwv\.eye\);/, 'the "!" drawn every frame beside the crew\'s lines');
});

test('WILD-ALERT host run: A BAND NOTICES ON THE CHECK - lifted bandFrame over the real store: a band within its sight but far, against a stealthy traveller and a high die, wanders on; the same band close in chases; the check follows the traveller\'s clock (mutants: the band chases on sight alone, the stealth unread)', async () => {
  const { readFileSync: rf } = await import('node:fs');
  const w = rf(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  const cut = (name) => { const m = new RegExp(`\\n  function ${name}\\([^)]*\\) \\{\\n[\\s\\S]*?\\n  \\}\\n`).exec(w); assert.ok(m, name); return m[0]; };
  const law = await import('../src/systems/travelBands.js');
  const run = ({ stealth, die, zM }) => {
    const d = {
      _bandChase: new Map(), _bandSpent: new Set(), _bandSpentAt: [], _bandPeer: new Map(),
      worldMoveBusy: () => false, travelView: { active: true }, isEnhanced: () => true, modes: { mode: 'exterior', deathUp: () => false },
      walkMode: true, playerSpawned: true, getPref: () => true, gamePaused: () => false,
      playerEntity: { health: 50, preventEnemySpawns: false }, player: { isPlayerSwimming: false, feetAt: () => [0, 0, 0] },
      _inAnyLocationRect: () => false, bandNowMs: () => 1_000_000, state: { worldCoords: () => ({ x: 0, z: 0 }) },
      travelViewBands: () => [{ id: 'b1.1.5', at: { x: 0, z: zM * 40 } }], tvBandSeen: { night: false },
      worldTimeScale: () => 60, bandPlace: (b) => b.at, bandMake: () => ({ mobileTypes: [1, 2], name: 'Orc' }), bandPeerChase: () => null,
      playerAfloat: () => false, journeyMet: () => null, owSaySpent: () => {},
      wildBands: createWildAlert({ rng: () => die }), wildStealth: () => stealth,
    };
    const names = Object.keys(d);
    const f = new Function('d', 'law', `const { ${names.join(', ')} } = d;
      const { bandChaseStep, bandSight, BAND_CONTACT_M, BAND_STAND_M, BAND_STAND_TRIES, BAND_STAND_RETRY_MS, BANDS_WIRE_MAX } = law;
      const NATIVE_PER_M = 40; let _bandClock = 0;
      const bandRoom = () => true, bandStand = () => true, bandYaw = () => 0, bandDrop = () => {}, bandSpend = (id) => _bandSpent.add(id);
      ${cut('bandFrame')} return bandFrame;`)(d, law);
    f(1000, 1 / 60);
    return d._bandChase.has('b1.1.5');
  };
  assert.equal(run({ stealth: 80, die: 0.6, zM: 300 }), false, 'far within its 320 m against Stealth 80: unaware, it wanders on');
  assert.equal(run({ stealth: 80, die: 0.6, zM: 30 }), true, 'thirty metres off: noticed, and it comes');
  assert.equal(run({ stealth: 0, die: 0.99, zM: 300 }), true, 'no Stealth: noticed at its sight\'s edge');
  assert.equal(run({ stealth: 0, die: 0, zM: 400 }), false, 'past its sight: never checked');
});

test('WILD-ALERT host run: THE "!" - lifted wildMarksFrame: an alerted wilderness foe is marked for WILD_MARK_S in play and for as long as it stays alerted under a fast traveller; never one unaware, in a town, out of range or behind the eye; under a window or the Overworld, none (mutants: the mark kept in play, dropped in travel, the town foe marked)', () => {
  const marks = [];
  const d = { t: 0, gate: false, foes: [], rect: () => false, covered: false, up: false };
  const scope = {
    exteriorFoes: { get foes() { return d.foes; } }, foeAlerted, WILD_MARK_S, WILD_MARK_RANGE, CAPSULE_HEIGHT: 1.8,
    get _wildGate() { return d.gate; }, _inAnyLocationRect: (p) => d.rect(p),
    canvas: { clientWidth: 800, clientHeight: 600 }, worldViewportRect: () => ({ x: 0, y: 0, w: 800, h: 600 }),
    projectToScreen: (p) => ({ x: 400 + p[0], y: 300 - p[1], front: p[2] > 0 }),
    townTalk: { get overlayActive() { return d.covered; }, hudHidden: false }, gamePaused: () => false, _mode: () => 'exterior',
    travelView: { get active() { return d.up; } }, enhancedHudScale: () => 1, performance: { now: () => d.t * 1000 },
    drawWildMarks: (pts, opts) => marks.push({ pts, opts }), document: {},
  };
  const names = Object.keys(scope).filter((k) => k !== '_wildGate');
  const fn = new Function('s', `let { ${names.join(', ')} } = s;
    ${cutConst('_wildMarkKeys')}${cutConst('_wildMarkAt')}let _wildMarkKey = 0;
    ${cutFn('wildMarksFrame').replace(/_wildGate/g, 's._wildGate')} return wildMarksFrame;`)(scope);
  const foe = (z, ai = {}) => ({ dead: false, entity: {}, ai: { isHostile: true, feet: [0, 0, z], height: 1.8, targetIsLocalPlayer: true, detected: true, ...ai } });
  const a = foe(40), unaware = foe(30, { detected: false, targetIsLocalPlayer: false }), behind = foe(-30), farOff = foe(500);
  d.foes = [a, unaware, behind, farOff];
  fn([], [], [0, 0, 0]);
  assert.deepEqual(marks.at(-1).pts.map((p) => p.distance > 0), [true], 'the alerted foe ahead alone');
  const key = marks.at(-1).pts[0].key;
  d.t = WILD_MARK_S + 0.5;
  fn([], [], [0, 0, 0]);
  assert.deepEqual(marks.at(-1).pts, [], 'in play its mark stands WILD_MARK_S');
  d.gate = true;
  fn([], [], [0, 0, 0]);
  assert.deepEqual(marks.at(-1).pts.map((p) => p.key), [key], 'under a fast traveller it stands while it is alerted - the same key');
  d.rect = (p) => p === a.ai.feet;
  fn([], [], [0, 0, 0]);
  assert.deepEqual(marks.at(-1).pts, [], 'a town\'s foe keeps the town\'s law - no mark');
  d.rect = () => false; d.up = true;
  fn([], [], [0, 0, 0]);
  assert.deepEqual([marks.at(-1).pts, marks.at(-1).opts.covered], [[], true], 'under the Overworld its marks carry the "!" - none here');
  d.up = false;
  a.ai.detected = false; a.ai.giveUpTimer = 0;
  fn([], [], [0, 0, 0]);
  assert.deepEqual(marks.at(-1).pts, [], 'given up: no longer alerted');
  a.ai.detected = true; d.gate = false; d.t = 100;
  fn([], [], [0, 0, 0]);
  assert.equal(marks.at(-1).pts.length, 1, 'noticing again pops it again, for WILD_MARK_S');
});

test('WILD-ALERT host: the Overworld\'s marks - a chase wears the "!", and so does a camp a member of which is alerted, mine or a peer\'s (lifted wildCampKeys) (mutants: the camp\'s key wrong, a puppet unread)', () => {
  const pool = [
    { dead: false, campId: 7, entity: {}, ai: { isHostile: true, targetIsLocalPlayer: true, detected: true } },
    { dead: false, campId: 9, entity: {}, ai: { isHostile: true, targetIsLocalPlayer: false, detected: false } },
    { dead: false, puppet: 'p2', _pupCamp: { id: 3 }, entity: {}, ai: { isHostile: true, targetIsLocalPlayer: true, detected: true } },
    { dead: true, campId: 11, entity: {}, ai: { isHostile: true, targetIsLocalPlayer: true, detected: true } },
  ];
  const keys = new Function('exteriorFoes', 'foeAlerted', `${cutFn('wildCampKeys')} return wildCampKeys;`)({ foes: pool }, foeAlerted)();
  assert.deepEqual([...keys].sort(), ['me:7', 'p2:3']);
  assert.equal(WILD_MARK, '!');
  assert.match(W, /label: chasing \? `\$\{WILD_MARK\} \$\{bandLabel\(mk\.name, mk\.mobileTypes\.length\)\}` : bandLabel/);
  assert.match(W, /label: wildCamps\.has\(c\.key\) \? `\$\{WILD_MARK\} \$\{c\.label\}` : c\.label/);
});

test('WILD-ALERT host: a wilderness band no longer holds the journey for its sight - journeyThreats asks a chase alone (mutant: the wanderers counted again)', () => {
  const fn = cutFn('journeyThreats');
  assert.doesNotMatch(fn, /travelViewBands\(\)/, 'no wandering band in the threats');
  assert.match(fn, /for \(const c of _bandChase\.values\(\)\)/, 'the chases');
});

// ── the mark's layer ────────────────────────────────────────────────────────────────────────────────────────────────

test('WILD-ALERT the "!" layer: one element a mark, kept while it stands (a pop on its first frame, never on a frame after, nor when another mark moves); the nearest WILD_MARKS_MAX; covered, none; the scale and the fade by distance; its own watchdog takes it down when the frames stop (mutants: the slot reused for another key, the cap unread, the watchdog unarmed)', () => {
  destroyWildMarks();
  const doc = fakeDoc();
  drawWildMarks([{ key: 'a', x: 100, y: 50, distance: 20 }], { doc });
  assert.equal(wildMarksMounted(), true);
  const root = doc.body.children.find((c) => c.className === 'dfwild-marks');
  assert.ok(root, 'mounted on the body');
  const [first] = root.children;
  assert.equal(first.className, 'dfwild-mark pop', 'a new mark pops');
  assert.equal(first.children[0].textContent, '!');
  drawWildMarks([{ key: 'b', x: 10, y: 10, distance: 5 }, { key: 'a', x: 101, y: 50, distance: 20 }], { doc });
  assert.equal(first.className, 'dfwild-mark pop', 'a keeps its element (its pop runs on), though b is nearer now');
  const second = root.children[1];
  assert.equal(second.className, 'dfwild-mark pop', 'b, new, pops in its own');
  drawWildMarks([{ key: 'b', x: 10, y: 10, distance: 5 }], { doc });
  assert.equal(first.style.display, 'none', 'a gone: its element hidden');
  drawWildMarks([{ key: 'b', x: 10, y: 10, distance: 5 }, { key: 'c', x: 1, y: 1, distance: 9 }], { doc });
  assert.equal(first.className, 'dfwild-mark pop', 'c, new, takes a free element and pops');
  assert.equal(second.className, 'dfwild-mark pop', 'b untouched');
  const many = Array.from({ length: WILD_MARKS_MAX + 5 }, (_, i) => ({ key: `k${i}`, x: i, y: i, distance: i + 1 }));
  drawWildMarks(many, { doc });
  assert.equal(root.children.filter((c) => c.style.display !== 'none').length, WILD_MARKS_MAX, 'the nearest twelve');
  drawWildMarks(many, { doc, covered: true });
  assert.equal(root.children.filter((c) => c.style.display !== 'none').length, 0, 'covered: none');
  assert.deepEqual([wildMarkScale(0), wildMarkScale(160), wildMarkScale(10_000)], [1.25, 0.6, 0.6]);
  assert.deepEqual([wildMarkAlpha(10), wildMarkAlpha(WILD_MARK_RANGE)], [1, 0]);
  assert.ok(wildMarkAlpha(115) < 1 && wildMarkAlpha(115) > 0.3);
  destroyWildMarks();
  assert.equal(wildMarksMounted(), false);
  assert.equal(root.removed, true, 'its node goes with it');
  // IT OWNS ITS OWN END: a standing mark arms a watchdog each frame; a frame that does not come (the host's loop gone)
  // takes the layer down; a frame with no mark disarms it
  const armed = [];
  const timers = { set: (fn, ms) => { armed.push({ fn, ms, live: true }); return armed.length - 1; }, clear: (id) => { armed[id].live = false; } };
  const doc2 = fakeDoc();
  drawWildMarks([{ key: 'a', x: 1, y: 1, distance: 3 }], { doc: doc2, timers });
  drawWildMarks([{ key: 'a', x: 1, y: 1, distance: 3 }], { doc: doc2, timers });
  assert.deepEqual(armed.map((t) => [t.ms, t.live]), [[WILD_MARKS_IDLE_MS, false], [WILD_MARKS_IDLE_MS, true]], 're-armed by each frame, the last one live');
  armed[1].fn();
  assert.equal(wildMarksMounted(), false, 'no frame came: the layer took itself down');
  drawWildMarks([{ key: 'a', x: 1, y: 1, distance: 3 }], { doc: doc2, timers });
  drawWildMarks([], { doc: doc2, timers });
  assert.equal(armed.at(-1).live, false, 'a frame with no mark disarms it');
  assert.equal(wildMarksMounted(), true, 'and the layer stands, empty, for the next');
  destroyWildMarks();
});
