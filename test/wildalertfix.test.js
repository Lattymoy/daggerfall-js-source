// WILD-ALERT-FIX (2026-10-05, bible/06-Systems/Travel-View.md "WILD-ALERT-FIX"): THE DEEP AUDIT'S FIVE - a foe that
// noticed a fast traveller only had the gate lifted (its own eyes came long after, so no "!", no hold of the clock, no
// meeting), a band that caught the traveller stood unaware, a band's notice outlived a chase handed to a peer and a load,
// the checks rolled while a window held the game, and the gate's switch dropped the peers a foe was fighting. The host's
// functions lifted out of scenes/world.js and scenes/exteriorFoes.js and RUN; the target machine run for real.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createWildAlert } from '../src/systems/wildAlert.js';
import { SIGHT_RADIUS, EnemyAI } from '../src/characters/enemyMotor.js';
import { foeAlerted, foeHostile } from '../src/systems/encounters.js';
import { isLocalPlayerTarget, PLAYER_TARGET, getTargets, runTargetMachine } from '../src/characters/enemyTargets.js';
import { PACK_SPACING, PACK_ALERT_RADIUS } from '../src/systems/campEncounters.js';
import { BAND_STAND_MIN_M } from '../src/systems/travelBands.js';

const W = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
const EF = readFileSync(new URL('../src/scenes/exteriorFoes.js', import.meta.url), 'utf8');
const cut = (src, kind, name) => {
  const m = kind === 'fn' ? new RegExp(`\\n {2}function ${name}\\([^)]*\\) \\{\\n[\\s\\S]*?\\n {2}\\}\\n`).exec(src) : new RegExp(`\\n {2}const ${name} = [^\\n]*\\n`).exec(src);
  assert.ok(m, `${name} lifted`);
  return m[0];
};
const collider = { raycast: () => Infinity, capsuleCast: () => ({ dist: Infinity, key: null }), move: () => ({ grounded: true }) };

/** world.js's gate over stubs - the pool's notice recorded. */
function gateHost(over = {}) {
  const d = { travelling: true, scale: 60, stealth: 30, foes: [], paused: false, noticed: [], rolls: 0, die: 0.999, ...over };
  const wildFoes = createWildAlert({ weak: true, rng: () => { d.rolls++; return d.die; } });
  const scope = {
    wildFoes, playerEntity: {}, SKILLS: { Stealth: 'Stealth' }, skillValue: () => d.stealth,
    travelControlUI: { get isShowing() { return d.travelling; } }, travelOptions: { state: { get autopilot() { return d.travelling ? {} : null; } } },
    tvWalking: 0, modes: { mode: 'exterior' }, walkMode: true, playerSpawned: true, gamePaused: () => d.paused,
    player: { feetAt: () => [1, 0, 2] }, worldTimeScale: () => d.scale, performance: { now: () => 0 },
    exteriorFoes: { get foes() { return d.foes; }, noticedPlayer: (f, feet) => d.noticed.push({ f, feet }) },
    foeHostile, isLocalPlayerTarget, SIGHT_RADIUS, _inAnyLocationRect: () => false,
  };
  const names = Object.keys(scope);
  const body = `let { ${names.join(', ')} } = s; let _wildGate = false;
    ${cut(W, 'const', 'wildStealth')}${cut(W, 'const', 'wildTravelling')}${cut(W, 'const', 'wildGated')}${cut(W, 'fn', 'wildFoesFrame')}
    return { frame: wildFoesFrame, gated: wildGated };`;
  return { d, wildFoes, ...new Function('s', body)(scope) };
}
const wilds = (feet, ai = {}) => ({ dead: false, entity: {}, ai: { isHostile: true, feet, sightRadius: 60, target: null, targetIsLocalPlayer: false, detected: false, ...ai } });

test('WILD-ALERT-FIX a foe that NOTICES the fast traveller on the check is handed to the pool to come for them (noticedPlayer, at the feet it noticed them at), once; the checks hold while a window holds the game - the game\'s clock their cadence (mutants: the notice unheard, the pause unread)', () => {
  const near = wilds([0, 0, 20]);
  const g = gateHost({ foes: [near], die: 0 });
  g.frame(1 / 60);
  assert.equal(g.wildFoes.alerted(near), true);
  assert.deepEqual(g.d.noticed.map((n) => [n.f, n.feet]), [[near, [1, 0, 2]]], 'noticed: the pool told, at my feet');
  g.frame(1 / 60);
  assert.equal(g.d.noticed.length, 1, 'once - it is on me now');
  // the pause: a window over a journey that keeps its scale - no check rolls till the game runs again
  const p = gateHost({ foes: [wilds([0, 0, 30])], paused: true });
  p.frame(1 / 60);
  assert.equal(p.d.rolls, 1, 'the first check at once, as it comes within reach');
  for (let i = 0; i < 600; i++) p.frame(1 / 60);
  assert.equal(p.d.rolls, 1, 'ten real seconds under a window at x60: no more (it rolled twelve a second)');
  p.d.paused = false;
  for (let i = 0; i < 6; i++) p.frame(1 / 60);
  assert.equal(p.d.rolls, 2, 'the game running: a classic minute on');
});

test('WILD-ALERT-FIX the pool\'s side: a foe that noticed the traveller is on them at once - the player its target, the feet it noticed them at its last known place, its blind pursuit\'s GiveUpTimer full (so foeAlerted: the "!", the clock held) - and its campmates within its alert radius woken; the dead and a puppet untouched (mutants: the target unhanded, the camp unwoken)', () => {
  const foes = [];
  const scope = { foes, PLAYER_TARGET };
  const fns = new Function('s', `const { foes, PLAYER_TARGET } = s; ${cut(EF, 'fn', 'noticedPlayer')}${cut(EF, 'fn', 'wakeCampmates')} return { noticedPlayer };`)(scope);
  const mk = (feet, extra = {}) => ({ dead: false, campId: 7, campAlertRadius: 12, ai: Object.assign(new EnemyAI(collider, feet, 0, {}), { isHostile: true }), entity: {}, ...extra });
  const f = mk([0, 0, 0]), mate = mk([8, 0, 0]), far = mk([40, 0, 0]), other = mk([5, 0, 0], { campId: 9 });
  foes.push(f, mate, far, other);
  fns.noticedPlayer(f, [0, 0, 50]);
  assert.equal(f.ai.target, PLAYER_TARGET, 'on me');
  assert.deepEqual(f.ai.lastKnownTargetPos, [0, 0, 50], 'where it noticed me');
  assert.ok(f.ai.giveUpTimer > 0, 'hunting, unseen');
  f.ai.update(1 / 60, [0, 0, 50], { targeting: () => {}, playerHeight: 1.8 });
  assert.equal(foeAlerted(f), true, 'alerted - the "!" and the hold read it');
  assert.equal(mate.ai.target, PLAYER_TARGET, 'its campmate within the radius woken');
  assert.equal(far.ai.target, null, 'one past it not');
  assert.equal(other.ai.target, null, 'another camp not');
  const dead = mk([0, 0, 0], { dead: true }), pup = mk([0, 0, 0], { puppet: 'p2' });
  fns.noticedPlayer(dead, [0, 0, 5]); fns.noticedPlayer(pup, [0, 0, 5]);
  assert.deepEqual([dead.ai.target, pup.ai.target], [null, null], 'the dead, a peer\'s puppet: untouched');
});

test('WILD-ALERT-FIX a band that caught the traveller stands ON them - each member stood alerted (the gate never holds it off) and handed to the pool to come; a refused stand stands nobody (mutants: the stood band unaware)', async () => {
  const wildFoes = createWildAlert({ weak: true });
  const told = [];
  const fa = { dead: false }, fb = { dead: false };
  let asked = 0;
  const scope = {
    bandRoom: () => true, player: { feetAt: () => [3, 0, 4] }, BAND_STAND_MIN_M, PACK_SPACING, PACK_ALERT_RADIUS, wildFoes, performance: { now: () => 0 },
    exteriorFoes: { noticedPlayer: (f, feet) => told.push([f, feet]) },
    _standCampEncounter: () => (asked++ === 0 ? null : { foes: Promise.resolve([fa, null, fb]), anchorFeet: [0, 0, 0] }),
  };
  const names = Object.keys(scope);
  const bandStand = new Function('s', `const { ${names.join(', ')} } = s; ${cut(W, 'fn', 'bandStand')} return bandStand;`)(scope);
  assert.equal(bandStand({ mobileTypes: [1, 2] }, 0, 60), true, 'stood on the second bearing');
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual([wildFoes.alerted(fa), wildFoes.alerted(fb)], [true, true], 'alerted');
  assert.deepEqual(told, [[fa, [3, 0, 4]], [fb, [3, 0, 4]]], 'and come for me');
  scope._standCampEncounter = () => null;
  const refused = new Function('s', `const { ${names.join(', ')} } = s; ${cut(W, 'fn', 'bandStand')} return bandStand;`)(scope);
  assert.equal(refused({ mobileTypes: [1] }, 0, 60), false);
});

test('WILD-ALERT-FIX a band\'s notice goes with its chase: a chase handed to a peer forgets it (a stale word was a chase again from anywhere, unchecked), and a load forgets every one (mutants: the yield, the load)', () => {
  const wildBands = createWildAlert();
  const _bandChase = new Map([['b1', {}], ['b2', {}]]), _bandSpent = new Set(), _bandPeer = new Map();
  wildBands.alert('b1'); wildBands.alert('b2');
  const scope = {
    performance: { now: () => 0 }, bandPixelOf: () => ({ x: 0, y: 0 }), playerTravelPixel: () => ({ x: 0, y: 0 }), bandNowMs: () => 0, BAND_LIFE_MS: 1,
    validBandWord: (raw) => raw, bandNearMe: () => true, _bandSpent, _bandChase, _bandPeer, chaseYields: (me, from) => from === 'low', online: { id: 'me' }, wildBands,
  };
  const names = Object.keys(scope);
  const bandHear = new Function('s', `const { ${names.join(', ')} } = s; ${cut(W, 'fn', 'bandHear')} return bandHear;`)(scope);
  bandHear('low', [['b1', 0, 0, 1]]);
  assert.deepEqual([_bandChase.has('b1'), wildBands.alerted('b1')], [false, false], 'the peer\'s chase: forgotten here');
  bandHear('high', [['b2', 0, 0, 1]]);
  assert.deepEqual([_bandChase.has('b2'), wildBands.alerted('b2')], [true, true], 'mine still: kept');
  const reset = cut(W, 'fn', 'overworldLoadReset');
  assert.match(reset, /_bandSpentAt\.length = 0; wildBands\.prune\(\(\) => false\);/, 'the load forgets every band\'s notice');
  wildBands.prune(() => false);
  assert.equal(wildBands.alerted('b2'), false);
  assert.ok(W.indexOf('const wildBands = createWildAlert();') < W.indexOf('function overworldLoadReset()'), 'declared above its reader (BOOT-TDZ)');
});

test('WILD-ALERT-FIX the gate\'s switch drops ME alone (dropLocal): a foe unaware of the fast traveller still fights the peer it was fighting - DFU\'s noTargetMode drops every player (mutants: every player dropped, the switch unwired)', () => {
  const peer = { isPlayer: true, isPeer: true, id: 'p9', feet: [3, 0, 0], height: 1.8, health: 1 };
  const self = () => ({ ai: { feet: [0, 0, 0], yaw: Math.PI / 2, height: 1.8, centreOffset: 0.9, collider, isHostile: true, target: null, secondaryTarget: null, targetSenses: null, wouldBeSpawned: true, classicTargetUpdateTimer: 100, sawSecondaryTarget: false }, entity: { team: 'Orcs', mobileTeam: 'Orcs', health: 10 } });
  const cands = [PLAYER_TARGET, peer];
  assert.equal(getTargets(self(), cands, [2, 0, 0], { dropLocal: true, infighting: true }).target, peer, 'me dropped, the peer its foe');
  assert.equal(getTargets(self(), cands, [2, 0, 0], { noTargetMode: true, infighting: true }).target, null, 'DFU\'s switch: no player at all');
  const s = self();
  assert.deepEqual(runTargetMachine(s, cands, [2, 0, 0], 1 / 60, { dropLocal: true, infighting: true }), [3, 0, 0], 'the machine carries it');
  assert.equal(s.ai.target, peer);
});
