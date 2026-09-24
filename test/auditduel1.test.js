// AUDIT DUEL1 (2026-09-24, Mac: "Do an audit on everyrhing" - before DUEL1 and DISC21 merge). Four independent reviews
// (the duel's trust boundaries; its rules and combat; regressions outside it; DISC21, the tests and the records) found
// what this file pins, each against the code path that carried it:
//   A1 a record minted by guests          -> server-account (test/duel_record.test.js pins it over the real SQL)
//   A2 a forged result broke a weapon     -> duelCombat.js duelWearDamage
//   A3 a stranger's asks spent my blows   -> duelSession.js answer / engagedElsewhere
//   A4 + B1 a duel's drain killed         -> effects.js (the live stat's cap)
//   A5 ask-cancel-ask skipped the quiet   -> duelSession.js cancel arm
//   B2 a swing bashed out of the ring     -> worldModes.js attemptExteriorDoorBash
//   B3 a duel's fatigue damage killed     -> effects.js / shared.js / world.js drainFatigue
//   B4 + C2 a duel's spells were saved    -> save.js
//   B5 a double knockout was two losses   -> duelSession.js end arm + accounts.js DUEL_MUTUAL_S
//   B6 melee reach too strict, too loose  -> duelCombat.js duelBlowPlausible + world.js _duelTrail
//   C1 full foes frames forced forever    -> world.js duelFrame
//   D2 the full heal had no pin           -> world.js duelHeal
//   D3 a pad player told a keyboard key   -> quickslotTags.js (test/disc21.test.js)
//   D4 the tested clamp was not the live one -> motor.js _keepInArena
//   D5 peerGone / reset had no caller     -> duelSession.js tick + world.js duelLeaveNow
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createDuelManager, DUEL_REASK_MS, DUEL_COUNTDOWN_MS, NATIVES_PER_M, clampToRing } from '../src/net/duelSession.js';
import { duelBlowPlausible, duelWearDamage, DUEL_WEAR_MULT, DUEL_MELEE_POS_SLACK_M, DUEL_TRAIL_MS } from '../src/combat/duelCombat.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { applySpell } from '../src/systems/effects.js';
import { liveStat } from '../src/systems/statMods.js';
import { WEAPON_REACH } from '../src/combat/playerWeapon.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** One manager and everything it sends, by addressee. */
function solo({ can = null } = {}) {
  let t = 5_000_000;
  const sent = [];
  const said = [];
  const st = { can, reaches: new Set(['peer-oppo', 'peer-zzzz', 'peer-yyyy']), prompts: 0, ends: [] };
  const m = createDuelManager({
    send: (d) => { sent.push(d); return true; },
    now: () => t, say: (l) => said.push(l), peerName: (id) => id.slice(5).toUpperCase(), selfId: () => 'peer-meee',
    near: () => true, can: () => st.can,
    ringFor: () => [100000, 10, 200000],
    reaches: (id) => st.reaches.has(id),
    myPos: () => [100000, 10, 200000], peerPos: () => [100000 + 4 * NATIVES_PER_M, 10, 200000],
    onPrompt: () => { st.prompts++; }, onStart: () => {}, onBlow: () => ({ hit: true, dmg: 1 }), onResult: () => {},
    onEnd: (duel, end) => { st.ends.push(end); }, onHeal: () => {}, vitals: () => [80, 80], rand: () => 0.5,
  });
  const to = (peer) => sent.filter((d) => d.to === peer);
  /** into a live duel with peer-oppo, past the count */
  const fight = () => {
    m.request('peer-oppo');
    const s = to('peer-oppo').at(-1).s;
    m.onFrame('peer-oppo', { k: 'yes', to: 'peer-meee', s }, 'acct-oppo');
    t += DUEL_COUNTDOWN_MS + 1;
    m.tick();
    return s;
  };
  return { m, st, sent, said, to, fight, tick: (ms) => { t += ms; m.tick(); } };
}

test('AUDIT DUEL1 A3 + A5 + B5 + D5 the duel law: a stranger\'s frames at a duellist go unanswered and outside a duel each stranger is answered once a DUEL_REASK_MS; an ask taken back and asked again is the re-ask the quiet holds; a double knockout is said a draw; the asks of a peer I cannot reach go at once (mutants: every stranger answered; the limiter per frame not per peer; the cancel without its quiet; the draw unsaid; a gone peer\'s ask kept)', () => {
  // A3 - in a duel, nothing at all
  let r = solo();
  const s = r.fight();
  assert.ok(r.m.fighting, 'a live duel, past the count');
  for (let i = 0; i < 20; i++) r.m.onFrame('peer-zzzz', { k: 'ask', to: 'peer-meee', s: `zzzz${1000 + i}` }, 'acct-zzzz');
  for (let i = 0; i < 5; i++) r.m.onFrame('peer-zzzz', { k: 'yes', to: 'peer-meee', s: `zzzz${2000 + i}` }, 'acct-zzzz');
  for (let i = 0; i < 5; i++) r.m.onFrame('peer-zzzz', { k: 'start', to: 'peer-meee', s: `zzzz${3000 + i}`, c: [1, 2, 3] }, 'acct-zzzz');
  assert.equal(r.to('peer-zzzz').length, 0, 'a stranger\'s ask, yes or start at a duellist spends nothing of the duellist\'s budget');
  assert.equal(r.m.duel.s, s, 'and the duel goes on');
  // outside a duel: a refusal goes, once a peer per DUEL_REASK_MS
  r = solo({ can: 'outdoors' });
  for (let i = 0; i < 20; i++) r.m.onFrame('peer-zzzz', { k: 'ask', to: 'peer-meee', s: `zzzz${4000 + i}` }, 'acct-zzzz');
  assert.equal(r.to('peer-zzzz').length, 1, 'one answer for twenty asks');
  r.m.onFrame('peer-yyyy', { k: 'ask', to: 'peer-meee', s: 'yyyy5000' }, 'acct-yyyy');
  assert.equal(r.to('peer-yyyy').length, 1, 'the limiter is each peer\'s own');
  r.tick(DUEL_REASK_MS + 1);
  r.m.onFrame('peer-zzzz', { k: 'ask', to: 'peer-meee', s: 'zzzz6000' }, 'acct-zzzz');
  assert.equal(r.to('peer-zzzz').length, 2, 'and again after DUEL_REASK_MS');
  // A5 - an ask taken back, then asked again at once, is the re-ask the quiet holds
  r = solo();
  r.m.onFrame('peer-zzzz', { k: 'ask', to: 'peer-meee', s: 'zzzz7000' }, 'acct-zzzz');
  assert.equal(r.st.prompts, 1);
  r.m.onFrame('peer-zzzz', { k: 'cancel', to: 'peer-meee', s: 'zzzz7000', why: 'cancelled' }, 'acct-zzzz');
  assert.equal(r.m.asks().length, 0);
  r.m.onFrame('peer-zzzz', { k: 'ask', to: 'peer-meee', s: 'zzzz7001' }, 'acct-zzzz');
  assert.equal(r.st.prompts, 1, 'no second prompt over my game');
  assert.equal(r.m.asks().length, 0);
  assert.deepEqual(r.to('peer-zzzz').at(-1), { k: 'no', to: 'peer-zzzz', s: 'zzzz7001' });
  // B5 - I fell; their fall lands in my heal's hold: a draw, said
  r = solo();
  const s2 = r.fight();
  assert.equal(r.m.fell(), true);
  assert.equal(r.st.ends.at(-1).lost, true);
  r.m.onFrame('peer-oppo', { k: 'end', to: 'peer-meee', s: s2, why: 'fell' }, 'acct-oppo');
  assert.equal(r.m.duel.end.draw, true, 'both fell: a draw');
  assert.match(r.said.at(-1), /OPPO fell too - the duel is a draw\./);
  const n = r.said.length;
  r.m.onFrame('peer-oppo', { k: 'end', to: 'peer-meee', s: s2, why: 'fell' }, 'acct-oppo');
  assert.equal(r.said.length, n, 'said once');
  // ...and only for a loser: a winner who hears the loser's end again says nothing new
  r = solo();
  const s3 = r.fight();
  r.m.onFrame('peer-oppo', { k: 'end', to: 'peer-meee', s: s3, why: 'fell' }, 'acct-oppo');
  assert.equal(r.st.ends.at(-1).won, true);
  r.m.onFrame('peer-oppo', { k: 'end', to: 'peer-meee', s: s3, why: 'fell' }, 'acct-oppo');
  assert.equal(r.m.duel.end.draw, undefined);
  // D5 - a peer I can no longer reach takes their ask with them, at the next tick
  r = solo();
  r.m.onFrame('peer-zzzz', { k: 'ask', to: 'peer-meee', s: 'zzzz8000' }, 'acct-zzzz');
  assert.equal(r.m.asks().length, 1);
  r.st.reaches.delete('peer-zzzz');
  r.tick(16);
  assert.equal(r.m.asks().length, 0, 'the strip goes at once, not when the ask lapses');
  r.st.reaches.add('peer-zzzz');
  r.m.request('peer-zzzz');
  assert.equal(r.m.stateFor('peer-zzzz'), 'outgoing');
  r.st.reaches.delete('peer-zzzz');
  r.tick(16);
  assert.equal(r.m.stateFor('peer-zzzz'), 'none', 'and my own ask to them');
  // a live duel is NOT dropped by a moment's reach: it waits DUEL_GONE_MS (duel_session pins it)
  r = solo();
  r.fight();
  r.st.reaches.delete('peer-oppo');
  r.tick(16);
  assert.ok(r.m.live, 'a live duel survives a blink');
});

test('AUDIT DUEL1 A4 + B1 + B3 a duel\'s drain leaves the LIVE stat at 1 over an old drain; the target\'s own drains are DFU\'s cap alone; a duel\'s fatigue damage reaches every sink marked the duel\'s, and each floors it at 1 (mutants: the duel drain capped against the permanent value; the cap on every drain; the round without its entry; the instant without its mark; a sink unfloored)', () => {
  const drain = { type: 7, subType: 0, magnitudeBaseLow: 60, magnitudeBaseHigh: 60, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1, durationBase: 1, durationMod: 0, durationPerLevel: 1, chanceBase: 100 };
  const victim = () => ({ stats: { strength: 50, willpower: 50 }, career: {}, health: 80, maxHealth: 80, activeEffects: [{ kind: 'drainAttribute', stat: 'strength', magnitude: 5, permanent: true }] });
  const v = victim();
  applySpell({ element: 4, rangeType: 2, effects: [drain] }, 1, v, {}, () => 0.99, null, { duelCast: true });
  assert.equal(liveStat(v, 'strength'), 1, 'an old drain of 5 and the opponent\'s 60: the live stat stops at 1, never 0');
  const w = victim();
  applySpell({ element: 4, rangeType: 2, effects: [drain] }, 1, w, {}, () => 0.99, null, {});
  assert.equal(liveStat(w, 'strength'), 1, 'the target\'s own cast merges into the old drain and DFU\'s own cap holds it at 1');
  assert.equal(w.activeEffects.filter((a) => a.kind === 'drainAttribute').length, 1, 'merged, as DFU merges it');
  // B3: fatigue - the instant marked, the rounds with their entry
  const dmgFat = { type: 4, subType: 1, magnitudeBaseLow: 99, magnitudeBaseHigh: 99, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1, chanceBase: 100 };
  const seen = [];
  const f = { stats: { willpower: 50 }, career: {}, health: 80, maxHealth: 80, fatigue: 1000, activeEffects: [] };
  applySpell({ element: 4, rangeType: 2, effects: [dmgFat] }, 1, f, { drainFatigue: (n, a) => seen.push(!!a?.bundleDuel) }, () => 0.99, null, { duelCast: true });
  applySpell({ element: 4, rangeType: 2, effects: [dmgFat] }, 1, f, { drainFatigue: (n, a) => seen.push(!!a?.bundleDuel) }, () => 0.99, null, {});
  assert.deepEqual(seen, [true, false], 'the duel\'s instant fatigue damage reaches the sink marked; an ordinary one does not');
  assert.match(rd('src/systems/effects.js'), /if \(n > 0 && sinks\.drainFatigue\) sinks\.drainFatigue\(n \* FATIGUE_MULTIPLIER, a\);/, 'each round hands its entry, as its health rounds do');
  assert.match(rd('src/scenes/shared.js'), /drainFatigue: \(n, a = null\) => \{\n\s+if \(a\?\.bundleDuel\) n = Math\.min\(n, Math\.max\(0, \(entity\.fatigue \?\? 0\) - 1\)\);/, 'the shared ticker leaves 1');
  assert.match(rd('src/scenes/world.js'), /drainFatigue: \(n, a = null\) => drainExteriorFatigue\(_duelScope \|\| a\?\.bundleDuel \? Math\.min\(n, Math\.max\(0, \(playerEntity\.fatigue \?\? 0\) - 1\)\) : n\),/, 'and so does the world host\'s own spell sink');
});

test('AUDIT DUEL1 A2 + B6 + D4 the blow: a result wears my weapon by at most what the weapon could honestly deal; a swing reached me if it reached where I stood in the last DUEL_TRAIL_MS; a swing\'s claim may stand DUEL_MELEE_POS_SLACK_M from where it is seen, a spell\'s the wider slack; the motor clamps with the one tested clamp (mutants: the wear uncapped; the cap below an honest blow; the trail unread; the melee slack the spell\'s; the motor\'s own copy)', () => {
  const blade = createWeapon(120, 9, () => 0.5);   // a Daedric longsword
  const me = { stats: { strength: 100 } };
  const cap = duelWearDamage(99999, blade, me);
  assert.ok(cap < 99999 && cap % DUEL_WEAR_MULT === 0, `a forged 99999 wears as ${cap}`);
  assert.ok(Math.trunc((10 * cap + 50) / 100) < blade.maxCondition / 20, 'one answer cannot come near breaking the blade');
  assert.equal(duelWearDamage(40, blade, me), 40, 'an honest blow wears as it always has');
  assert.equal(duelWearDamage(-5, blade, me), 0);
  assert.equal(duelWearDamage(40, null, me), 0, 'no weapon, no wear');
  // B6: positions in the world frame - natives on x and z
  const at = (m) => [100000 + m * NATIVES_PER_M, 10, 200000];
  const p = at(0);   // where the striker stood
  const swing = { k: 'strike', by: 'melee', p };
  const reach = WEAPON_REACH;
  assert.equal(duelBlowPlausible(swing, at(reach + 3), p, 12), false, 'I am 5.5 m away now and nothing says I was closer: missed');
  assert.equal(duelBlowPlausible(swing, [at(reach - 0.2), at(reach + 1.5), at(reach + 3)], p, 12), true, 'I ran: 0.4 s ago I was in reach - it connects');
  assert.equal(duelBlowPlausible(swing, [at(reach + 3)], p, 12), false, 'a trail of one is now alone');
  assert.equal(duelBlowPlausible(swing, at(1), at(DUEL_MELEE_POS_SLACK_M + 0.5), 12), false, 'a swing claimed from past the melee slack of where it is seen lands nothing');
  assert.equal(duelBlowPlausible(swing, at(1), at(DUEL_MELEE_POS_SLACK_M - 0.5), 12), true);
  const bolt = { k: 'spell', p };
  assert.equal(duelBlowPlausible(bolt, at(10), at(DUEL_MELEE_POS_SLACK_M + 0.5), 12), true, 'a spell keeps the wider slack');
  assert.ok(DUEL_TRAIL_MS >= 300 && DUEL_TRAIL_MS <= 1000);
  const w = rd('src/scenes/world.js');
  assert.match(w, /_duelTrail\.push\(\{ t: tNow, p: campToWire\(player\.feetAt\(\)\) \}\);\n\s+while \(_duelTrail\.length && tNow - _duelTrail\[0\]\.t > DUEL_TRAIL_MS\) _duelTrail\.shift\(\);/, 'the host keeps the trail while a duel is live');
  // D4
  assert.match(rd('src/player/motor.js'), /const to = clampToRing\(this\.pos, c, a\.radius, CAPSULE_RADIUS\);/, 'the motor clamps with clampToRing');
  assert.deepEqual(clampToRing([20, 5, 0], [0, 0, 0], 12, 0.5), [11.5, 0], 'the tested clamp: the height untouched, the feet at the radius less the capsule');
});

test('AUDIT DUEL1 B2 + B4 + C1 + D2 + D5 the hosts by source: a swing bashes no door while a duel holds; a duel\'s spells are never saved and never restored; a ring change forces a full foes frame only in a cell room; the heal strips the duel\'s spells and fills health, fatigue and magicka; leaving the page ends the duel and heals before the exit autosave writes (mutants: the bash unrefused; the save keeping the duel\'s; the full frame forced in a dungeon; the heal without its strip; the heal without health; the leave after the save)', () => {
  const wm = rd('src/scenes/worldModes.js');
  assert.match(wm, /function attemptExteriorDoorBash\(eye, dir\) \{\n\s+if \(mode !== 'exterior'\) return false;\n(?:\s+\/\/.*\n)+\s+if \(host\.duelHolds\?\.\(\)\) return false;/, 'B2: the bash is refused before any door is picked');
  const sv = rd('src/systems/save.js');
  assert.match(sv, /snap\.activeEffects = \(entity\.activeEffects \?\? \[\]\)\.filter\(\(a\) => !a\.heldItem && !a\.bundleDuel\)/, 'B4: not saved');
  assert.match(sv, /entity\.activeEffects = \(snap\.activeEffects \?\? \[\]\)\.filter\(\(a\) => !a\.heldItem && !a\.bundleDuel\)/, 'B4: not restored from an older save');
  const w = rd('src/scenes/world.js');
  assert.match(w, /if \(online && isCellRoom\(online\.room\) && \(duelMgr\.live\?\.s \?\? null\) !== _duelRingSaid\) _foesFullAt = -Infinity;/, 'C1');
  // D2: THE FULL HEAL, Mac's "both are fully healed on duel end"
  const heal = /const duelHeal = \(\) => \{([\s\S]*?)\n {2}\};/.exec(w)?.[1] ?? '';
  assert.match(heal, /playerEntity\.activeEffects = playerEntity\.activeEffects\.filter\(\(a\) => !a\?\.bundleDuel\);/, 'the opponent\'s spells go');
  assert.match(heal, /playerEntity\.health = playerEntity\.maxHealth;/);
  assert.match(heal, /playerEntity\.fatigue = maxFatigue\(playerEntity\);/);
  assert.match(heal, /playerEntity\.magicka = playerEntity\.maxMagicka \?\? playerEntity\.magicka;/);
  assert.match(heal, /townTalk\.say\('You are fully healed\.'\);/);
  assert.match(heal, /if \(playerEntity\.health > 0 && !modes\?\.deathUp\?\.\(\)\)/, 'the dead are not raised by a duel');
  assert.match(w, /onHeal: \(\) => duelHeal\(\),/, 'the law\'s heal is this heal');
  // D5: the page's end
  const bu = w.indexOf("addEventListener('beforeunload'");
  const leave = w.indexOf('try { duelLeaveNow(); }', bu);
  const save = w.indexOf('for (const saveName of exitAutosaveNames(', bu);
  assert.ok(bu > 0 && leave > bu && save > leave, 'the duel ends and heals BEFORE the exit autosave');
  assert.match(w, /const duelLeaveNow = \(\) => \{\n\s+const had = !!duelMgr\.duel;\n\s+duelMgr\.reset\(\);\n\s+if \(had\) duelHeal\(\);\n\s+\};/);
});
