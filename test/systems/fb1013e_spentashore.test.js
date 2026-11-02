// FIELD BUGS 2026-10-13e (SPENT-ASHORE) - a player near Knightshead, "Delayed death after combat despite full health":
// "I killed all enemies without being hit. My health was full ... After the fight ended, the death screen suddenly
// appeared. There was no visible attack, spell, trap, fall, or warning before death." Mac, on SWIM-SPENT: "I dont care
// about DFU. We're our own thing now"; on FULL-GUARD: "No kill from full health".
//
// DFU's exhaustion collapse: any fatigue write that reaches 0 raises OnExhausted (DaggerfallEntity.cs SetFatigue), and
// PlayerEntity.OnExhausted SetHealth(0)s a player on dry feet when AreEnemiesNearby - any live foe inside the classic
// spawn band, seen or not (some 27 m outdoors). The swings and techniques of a fight drain the bar, nothing refills it
// awake, and walking after the last kill charges it every game minute (five real seconds): so the bar reached nothing
// seconds after the fight with a foe still in the band, and the collapse killed at full health past the shield and every
// death save - its box ("You collapse from exhaustion.") taken by the death screen in the same call. SWIM-SPENT ended the
// same death in the water. Now on dry feet too a drain to nothing with foes about costs a tenth of the health pool and a
// line on the HUD, with no box and no death heard by Come Sail Away; with none about the collapse is the rest hour.
//
// Through the real player ticker, a real EnemyAI's spawn band, AreEnemiesNearby, exhaustionOutcome and the one damage
// door with a real death presenter and death save; the hosts' arms are pinned in all four hosts' source, comments out.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import * as REST from '../../src/systems/rest/rest.js';   // a namespace: on the code before, the new names read undefined and the LAW fails, not the import
import { createPlayerTicker } from '../../src/scenes/shared.js';
import { setSharedClock, setWorldMinutes, resetMagicRoundMarker } from '../../src/systems/worldTick.js';
import { hurtPlayer, setDeathPresenter, registerPlayerDeathSave } from '../../src/characters/playerEntity.js';
import { maxFatigue, clampFatigue } from '../../src/systems/statMods.js';
import { SKILLS } from '../../src/systems/skills.js';
import { EnemyAI, CLASSIC_UPDATE_INTERVAL } from '../../src/characters/enemy/enemyMotor.js';
import { areEnemiesNearby } from '../../src/systems/encounters.js';
import { SWING_FATIGUE_COST } from '../../src/scenes/hostCombat.js';
import { setLocale, patchLocaleTable, clearLocaleTables } from '../../src/systems/textManager.js';

const { exhaustionOutcome, EXHAUSTED_SWIMMING_LINE } = REST;
const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const NOON = 100000 * 1440 + 12 * 60;
const FIGHTING_LINE = 'You are too exhausted to fight. Get clear and rest!';
const DRY_WALK = { running: false, runningTally: false, swimming: false, climbing: false, jumped: false, standing: false };

function fighter({ fatigue = 5, maxHealth = 100 } = {}) {
  const entity = {
    isPlayer: true, level: 1, raceId: 0, name: 'Fighter', health: maxHealth, maxHealth, magicka: 0, maxMagicka: 0,
    stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 },
    skills: new Array(35).fill(30), skillUses: new Array(35).fill(0), activeEffects: [], items: [],
  };
  entity.skills[SKILLS.Swimming] = 5;
  entity.fatigue = fatigue;
  return entity;
}

/** A real foe outdoors `metres` from the player at the origin, facing away and failing to notice them (a passed stealth
 *  roll): its spawn band is the motor's own classic recompute. The pool's shape is the hosts' (`{ dead, ai, entity }`). */
function foeAt(metres) {
  const collider = { raycast: () => Infinity, capsuleCast: () => ({ dist: Infinity, key: null }), move: () => ({ grounded: true }) };
  const ai = new EnemyAI(collider, [0, 0, metres], 0, { playerInside: false });
  const senses = { gameMinutes: 0, playerStealth: 100, rolls: () => 0 };
  for (let i = 0; i < 3; i++) ai.update(CLASSIC_UPDATE_INTERVAL + 0.001, [0, 0, 0], senses);
  return { dead: false, ai, entity: { name: 'Orc' } };
}

/** The street host's collapse - scenes/world.js onExhaustedExterior's arms in their order (the source pin below holds
 *  every host to them) - and its swing's drain, drainExteriorFatigue, over the real ticker. */
function streetHost(e, foes, { wet = () => false } = {}) {
  const said = [], kinds = [];
  let boxes = 0, inExhaustion = false, ticker = null;
  const onExhausted = () => {
    if (inExhaustion) return;
    inExhaustion = true;
    try {
      const out = exhaustionOutcome({ enemiesNearby: areEnemiesNearby(foes), swimming: wet(), entity: e, day: true, inside: false });
      kinds.push(out.kind);
      if (out.kind === 'drown') { said.push(out.line); hurtPlayer(e, out.damage, { bypassShield: true }); return; }
      if (out.kind === 'spent') { said.push(out.line); hurtPlayer(e, out.damage, { bypassShield: true }); return; }
      boxes++;   // 'You collapse from exhaustion.'
      if (out.kind === 'rest') {
        ticker.advance(60);
        e.health = Math.min(e.maxHealth, e.health + out.health);
        e.fatigue = Math.min(maxFatigue(e), e.fatigue + out.fatigue);
        return;
      }
      hurtPlayer(e, e.health, { bypassShield: true });   // DFU's SetHealth(0) - the arm SPENT-ASHORE retired, reached on the code before
    } finally { inExhaustion = false; }
  };
  ticker = createPlayerTicker(e, { isInside: () => false, onExhausted });
  const drainExteriorFatigue = (n) => {
    if (n <= 0) return;
    e.fatigue = clampFatigue(e, (e.fatigue ?? 0) - n);
    if (e.fatigue <= 0 && e.health > 0) onExhausted();
  };
  return { ticker, said, kinds, boxes: () => boxes, drainExteriorFatigue };
}

/** The death presenter and a death save that would take the blow, both counted, for the length of `fn`. */
function watched(fn) {
  const seen = { deaths: 0, saves: 0 };
  const prev = setDeathPresenter(() => { seen.deaths++; });
  registerPlayerDeathSave('fb1013c-spent', () => { seen.saves++; return true; });
  setSharedClock(null); setWorldMinutes(NOON); resetMagicRoundMarker(NOON);
  try { fn(seen); } finally { setDeathPresenter(prev); registerPlayerDeathSave('fb1013c-spent', null); }
}

test('SPENT-ASHORE: the law - on dry feet with foes about a drain to nothing is a tenth of the health and a line, never a death; without foes the rest hour; in the water SWIM-SPENT, unchanged', () => {
  const e = fighter();
  const near = exhaustionOutcome({ enemiesNearby: true, swimming: false, entity: e });
  assert.deepEqual({ kind: near.kind, damage: near.damage, line: near.line, textId: near.textId, inWater: near.inWater },
    { kind: 'spent', damage: 10, line: FIGHTING_LINE, textId: null, inWater: false });
  assert.equal(REST.EXHAUSTED_FIGHTING_LINE, FIGHTING_LINE);
  assert.equal(REST.EXHAUSTED_SPENT_SHARE, 0.1, 'the one share, the water\'s and the shore\'s');
  assert.equal(exhaustionOutcome({ enemiesNearby: true, entity: { ...e, maxHealth: 7 } }).damage, 1, 'rounded up');
  assert.equal(exhaustionOutcome({ enemiesNearby: true, entity: { ...e, maxHealth: 0 } }).damage, 1, 'never nothing');
  assert.equal(exhaustionOutcome({ enemiesNearby: true, entity: { ...e, maxHealth: 237 } }).damage, 24);
  assert.equal(exhaustionOutcome({ enemiesNearby: false, swimming: false, entity: e }).kind, 'rest');
  for (const enemiesNearby of [false, true]) {
    const wet = exhaustionOutcome({ enemiesNearby, swimming: true, entity: e });
    assert.deepEqual([wet.kind, wet.damage, wet.line, wet.inWater], ['drown', 10, EXHAUSTED_SWIMMING_LINE, true], 'the water is SWIM-SPENT\'s');
  }
  for (const enemiesNearby of [false, true]) for (const swimming of [false, true]) {
    assert.notEqual(exhaustionOutcome({ enemiesNearby, swimming, entity: e }).kind, 'death', 'no collapse is a death');
  }
  assert.equal(REST.EXHAUSTED_ENEMIES_TEXT_ID, undefined, 'RSC 1072 is said by nobody');
  // the port's own line, in the player's language (L10N4's text core), read at the collapse
  try {
    patchLocaleTable('fr', 'Port_Strings', [['rest.exhausted.fighting', 'Trop épuisé pour combattre - éloignez-vous et reposez-vous !']]);
    setLocale('fr');
    assert.equal(exhaustionOutcome({ enemiesNearby: true, entity: e }).line, 'Trop épuisé pour combattre - éloignez-vous et reposez-vous !');
  } finally { setLocale(null); clearLocaleTables('fr'); }
  assert.equal(exhaustionOutcome({ enemiesNearby: true, entity: e }).line, FIGHTING_LINE, 'English again');
});

test('SPENT-ASHORE: the report on the real ticker - full health, a sliver of fatigue, an unaware foe 20 m off in the classic band: walking on, the first drain to nothing costs a tenth and a line (no death, no box, no save spent), and only ten drains kill; a foe 30 m off is no foe and the collapse rests', () => {
  const close = foeAt(20);
  assert.deepEqual([close.ai.wouldBeSpawned, close.ai.detected], [true, false], 'inside the band, unaware');
  assert.equal(areEnemiesNearby([close]), true, 'and an enemy nearby all the same');
  watched((seen) => {
    const e = fighter({ fatigue: 5 });
    e.lastGameMinutes = NOON;
    const h = streetHost(e, [close]);
    const dt = 1 / 30;
    let t = 0;
    const walk = (seconds) => { for (const end = t + seconds; t < end && e.health > 0; t += dt) h.ticker.tick(dt, DRY_WALK); };
    walk(6);
    assert.deepEqual(h.kinds, ['spent'], 'the first drain to nothing, foes about, on dry feet');
    assert.equal(seen.deaths, 0, 'no death screen');
    assert.equal(e.health, 100 - Math.ceil(0.1 * 100), 'a tenth of the pool');
    assert.deepEqual(h.said, [FIGHTING_LINE], 'told to get clear');
    assert.equal(h.boxes(), 0, 'no box');
    assert.equal(seen.saves, 0, 'no death save asked - nothing came near killing');
    walk(120);
    assert.equal(seen.deaths, 1, 'staying spent among foes kills');
    assert.equal(e.health, 0);
    assert.equal(h.kinds.length, 10, `ten drains from full health (${h.kinds.join(',')})`);
    assert.ok(h.kinds.every((k) => k === 'spent'));
    assert.ok(t >= 45 && t <= 55, `in some fifty real seconds: ${t.toFixed(1)} s`);
  });

  const far = foeAt(30);
  assert.equal(far.ai.wouldBeSpawned, false, 'outside the band');
  watched((seen) => {
    const e = fighter({ fatigue: 5 });
    e.lastGameMinutes = NOON;
    const h = streetHost(e, [far]);
    for (let u = 0; u < 6; u += 1 / 30) h.ticker.tick(1 / 30, DRY_WALK);
    assert.deepEqual(h.kinds, ['rest'], 'the collapse is the rest hour it always was');
    assert.equal(h.boxes(), 1, 'with its box');
    assert.ok(e.health >= 100 && e.fatigue > 0, 'and pays it');
    assert.equal(seen.deaths, 0);
  });
});

test('SPENT-ASHORE: the swing that empties the bar (drainExteriorFatigue) takes the same arm; a swimmer with foes about is still SWIM-SPENT\'s', () => {
  watched((seen) => {
    const e = fighter({ fatigue: SWING_FATIGUE_COST - 1 });
    const h = streetHost(e, [foeAt(20)]);
    h.drainExteriorFatigue(SWING_FATIGUE_COST);
    assert.equal(e.fatigue, 0);
    assert.deepEqual([h.kinds, h.said, e.health, seen.deaths, h.boxes()], [['spent'], [FIGHTING_LINE], 90, 0, 0]);
    h.drainExteriorFatigue(SWING_FATIGUE_COST);
    assert.deepEqual([h.kinds.length, e.health], [2, 80], 'each swing at nothing costs its tenth');
  });
  watched((seen) => {
    const e = fighter({ fatigue: 0 });
    e.lastGameMinutes = NOON;
    const h = streetHost(e, [foeAt(20)], { wet: () => true });
    for (let u = 0; u < 6; u += 1 / 30) h.ticker.tick(1 / 30, { ...DRY_WALK, swimming: true, standing: true });
    assert.deepEqual([h.kinds, h.said, e.health, seen.deaths], [['drown'], [EXHAUSTED_SWIMMING_LINE], 90, 0]);
  });
});

/** Comments out, strings kept (restwhere.test.js's walk): a law named in prose is not a law in code. */
function code(s) {
  let out = '', i = 0;
  while (i < s.length) {
    const two = s.slice(i, i + 2), c = s[i];
    if (two === '//') { const nl = s.indexOf('\n', i); i = nl < 0 ? s.length : nl; continue; }
    if (two === '/*') { const end = s.indexOf('*/', i); i = end < 0 ? s.length : end + 2; continue; }
    if (c === '"' || c === "'" || c === '`') {
      out += c; i++;
      while (i < s.length && s[i] !== c) { if (s[i] === '\\') { out += s[i]; i++; } out += s[i]; i++; }
      out += s[i] ?? ''; i++; continue;
    }
    out += c; i++;
  }
  return out;
}
/** One host function, `head` to its closing brace at the same two-space depth, comments out. */
function fnOf(src, head) {
  const at = src.indexOf(head);
  assert.ok(at >= 0, `${head} is there`);
  const end = src.indexOf(head.includes('=>') ? '\n  };' : '\n  }\n', at);
  return code(src.slice(at, end));
}

test('SPENT-ASHORE: all four hosts take the arm - a line, the share through the one door, no box, no death heard by Come Sail Away - before the box and the death hook; the dungeon asks the sand\'s fall first; no collapse is a SetHealth(0); each host\'s drains reach it', () => {
  const ARMS = {
    'src/scenes/world.js': { head: '  function onExhaustedExterior() {', drain: ['  const drainExteriorFatigue = (n) => {', 'onExhaustedExterior();'], csa: 'csaRuntime.OnPlayerDeath()',
      arm: /if \(out\.kind === 'spent'\) \{ townTalk\.say\(out\.line\); hurtPlayer\(playerEntity, out\.damage, \{ bypassShield: true \}\); return; \}/ },
    'src/scenes/exterior.js': { head: '  function onExhaustedExterior() {', drain: ['  const drainExteriorFatigue = (n) => {', 'onExhaustedExterior();'], csa: null,
      arm: /if \(out\.kind === 'spent'\) \{ townTalk\.say\(out\.line\); hurtPlayer\(playerEntity, out\.damage, \{ bypassShield: true \}\); return; \}/ },
    'src/scenes/worldModes.js': { head: '  function onExhaustedInterior() {', drain: ['  const drainInteriorFatigue = (n) => {', 'onExhaustedInterior();'], csa: 'host.csaOnPlayerDeath?.()',
      arm: /if \(out\.kind === 'spent'\) \{ say\(out\.line\); hurtPlayer\(playerEntity, out\.damage, \{ bypassShield: true \}\); return; \}/ },
    'src/scenes/dungeonContext.js': { head: '  function onExhausted() {', drain: ['  function drainFatigue(n) {', 'onExhausted();'], csa: 'opts.csaOnPlayerDeath?.()',
      arm: /if \(out\.kind === 'spent'\) \{ hudText\.add\(out\.line\); hurtEntity\(playerEntity, out\.damage, \{ bypassShield: true \}\); surfacePlayer\(\); return; \}/ },
  };
  for (const [file, h] of Object.entries(ARMS)) {
    const src = rd(file);
    const fn = fnOf(src, h.head);
    const arm = fn.search(h.arm);
    assert.ok(arm > fn.indexOf('exhaustionOutcome('), `${file}: the spent arm, after the outcome`);
    assert.equal(fn.match(new RegExp(h.arm.source, 'g')).length, 1, `${file}: once`);
    const box = fn.indexOf('new ActionTextBox(');
    assert.ok(box > arm, `${file}: before the collapse's box`);
    if (h.csa) {
      assert.ok(fn.indexOf(h.csa) > arm, `${file}: before Come Sail Away hears a death`);
    } else {
      assert.doesNotMatch(fn, /OnPlayerDeath/, `${file}: no death hook to hear it`);
    }
    assert.doesNotMatch(fn, /playerEntity\.health, \{ bypassShield: true \}\)/, `${file}: no collapse is a SetHealth(0)`);
    assert.doesNotMatch(fn, /kind === 'death'/, `${file}: no death arm`);
    const drain = fnOf(src, h.drain[0]);
    assert.ok(drain.includes(h.drain[1]), `${file}: the fatigue drain reaches the collapse`);
  }
  // the street hosts' tickers raise the same collapse; the swing drains through drainExteriorFatigue
  for (const file of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const src = code(rd(file));
    assert.match(src, /onExhausted: onExhaustedExterior,/, `${file}: the ticker's collapse`);
    assert.equal((src.match(/drainExteriorFatigue\(SWING_FATIGUE_COST\)/g) ?? []).length, 2, `${file}: the melee and the bow swing`);
  }
  assert.match(code(rd('src/scenes/worldModes.js')), /onExhausted: onExhaustedInterior,/, 'worldModes.js: the interior ticker\'s collapse');
  // the arena: under a bout's spare the collapse is still the bout's fall, asked before the spent arm
  const dfn = fnOf(rd('src/scenes/dungeonContext.js'), '  function onExhausted() {');
  assert.ok(dfn.indexOf('if (sandSpare) {') > 0 && dfn.indexOf('if (sandSpare) {') < dfn.search(ARMS['src/scenes/dungeonContext.js'].arm), 'dungeonContext.js: the sand\'s fall first');
  assert.ok(dfn.search(/if \(out\.kind === 'drown'\)/) < dfn.indexOf('const sandSpare'), 'dungeonContext.js: the water first, as SWIM-SPENT left it');
  // and the outcome itself has no death left to answer
  assert.doesNotMatch(code(rd('src/systems/rest/rest.js')), /kind: 'death'/, 'rest.js: no death outcome');
});
