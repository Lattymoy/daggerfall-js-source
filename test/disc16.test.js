// DISC16 (2026-09-24, Discord through Mac: "I want to fix these issues + enhance guard interaction"), each report
// reproduced in node before it was touched, fixed at its root and pinned BY EXECUTION where the seam is a function.
//   A - "leaving the game undoes your lycanthropy/vampirism" and "Playing online makes my vampire character human
//       again": the curse entry (and the infection before it) carried neither `permanent` nor a round count, so
//       every live round took an absent roundsRemaining to NaN, the save's JSON wrote the NaN as null, and the first
//       round after ANY load read `null <= 0` and dropped the entry - the spell stayed in the book and did nothing.
//   B - "Light spell does not work in dungeons": the world host's dungeon frame lit its point lights with ITS OWN
//       engine's candle, while every cast underground is the dungeon context's engine's and the world's engine is not
//       updated below ground - the candle drew as a flame and lit nothing (or stood lit at the street it was cast on).
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createLycanthropyCurse, liveLycanthropy, cureLycanthropy } from '../src/systems/lycanthropy.js';
import { createVampirismCurse, liveVampirism, cureVampirism } from '../src/systems/vampirism.js';
import { endDisease } from '../src/systems/diseases.js';
import { LYCANTHROPY_TYPES, VAMPIRE_CLANS, INFECTION, startInfection, liveInfection } from '../src/systems/infection.js';
import { runMagicRoundsFor, setSharedClock, alignEntityClocks, resetMagicRoundMarker, setWorldMinutes } from '../src/systems/worldTick.js';
import { snapshotPlayer, restorePlayer } from '../src/systems/save.js';
import { MINUTES_PER_DAY } from '../src/systems/gameDate.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

// ═══ A: the curse through a load ═════════════════════════════════════════════════════════════════════════════════
const T0 = 523530 + 10 * MINUTES_PER_DAY;
const mortal = () => ({
  isPlayer: true, name: 'Mac', race: 'Nord', gender: 'male', level: 10, reflexes: 2,
  skills: new Array(40).fill(50), skillUses: new Array(40).fill(0),
  stats: { strength: 60, intelligence: 50, willpower: 50, agility: 60, endurance: 60, personality: 50, speed: 60, luck: 50 },
  items: [], activeEffects: [], spells: [], health: 100, maxHealth: 100, crimeCommitted: 0, lastGameMinutes: T0,
});
/** The slot's own path: the envelope through JSON, into a fresh entity. */
const reload = (p, minutes) => { const q = { isPlayer: true }; restorePlayer(q, JSON.parse(JSON.stringify(snapshotPlayer(p, { classicMinutes: minutes })))); return q; };
const live = (e) => liveLycanthropy(e) ?? liveVampirism(e);

test('DISC16-A: a werewolf and a vampire who have lived a round come back from a load still cursed - through the next rounds offline, and through the online arrival', () => {
  for (const make of [(p) => createLycanthropyCurse(p, LYCANTHROPY_TYPES.Werewolf, { now: T0 }), (p) => createVampirismCurse(p, VAMPIRE_CLANS.Lyrezi, { now: T0 })]) {
    setWorldMinutes(T0); resetMagicRoundMarker(null);
    const p = mortal();
    const racial = make(p).racial;
    runMagicRoundsFor(p, T0, T0 + 5, {});   // the curse lives a few rounds before the save, as every real one does
    const strength = live(p).statMods.strength;
    assert.ok(strength > 0, `${racial}: the advantages are on`);
    const q = reload(p, T0 + 5);
    runMagicRoundsFor(q, T0 + 5, T0 + 8, {});
    assert.ok(live(q), `${racial}: the curse survives the first rounds after a load`);
    assert.equal(q.racialOverride, live(q));
    assert.equal(live(q).statMods.strength, strength, `${racial}: the stats are the cursed ones`);
    // online: the shared clock stands elsewhere and the arrival shifts every marker onto it
    const W = T0 + 37 * MINUTES_PER_DAY + 123;
    const o = reload(p, T0 + 5);
    setSharedClock(() => W);
    try {
      alignEntityClocks(o, W);
      runMagicRoundsFor(o, W, W + 3, {});
      assert.ok(live(o), `${racial}: and the first online rounds`);
    } finally { setSharedClock(null); resetMagicRoundMarker(null); }
  }
});

test('DISC16-A: an infection that has ticked survives a load - the bite is not cured by reloading', () => {
  setWorldMinutes(T0); resetMagicRoundMarker(null);
  const p = mortal();
  startInfection(p, INFECTION.Werewolf, { day: Math.floor(T0 / MINUTES_PER_DAY) });
  runMagicRoundsFor(p, T0, T0 + 5, {});
  const q = reload(p, T0 + 5);
  runMagicRoundsFor(q, T0 + 5, T0 + 8, {});
  assert.equal(liveInfection(q)?.infection, INFECTION.Werewolf);
  resetMagicRoundMarker(null);
});

test('DISC16-A: a save written before the fix - the curse with a null round count and no flag - gives the player the curse back', () => {
  setWorldMinutes(T0); resetMagicRoundMarker(null);
  const p = mortal();
  createLycanthropyCurse(p, LYCANTHROPY_TYPES.Wereboar, { now: T0 });
  const snap = JSON.parse(JSON.stringify(snapshotPlayer(p, { classicMinutes: T0 })));
  const old = snap.activeEffects.find((a) => a.kind === 'racialOverride');
  delete old.permanent;
  old.roundsRemaining = null;   // what JSON made of the NaN
  const q = { isPlayer: true };
  restorePlayer(q, snap);
  runMagicRoundsFor(q, T0, T0 + 3, {});
  assert.equal(liveLycanthropy(q)?.infectionType, LYCANTHROPY_TYPES.Wereboar);
  resetMagicRoundMarker(null);
});

test('DISC16-A: in the session itself the round clock never touches a curse or an infection, and an ended one leaves the list at the next round (forcedRoundsRemaining = 0)', () => {
  const lives = [
    ['werewolf', (p) => createLycanthropyCurse(p, LYCANTHROPY_TYPES.Werewolf, { now: T0 }), (p) => cureLycanthropy(p, { nowMinutes: T0 + 2 })],
    ['vampire', (p) => createVampirismCurse(p, VAMPIRE_CLANS.Lyrezi, { now: T0 }), (p) => cureVampirism(p)],
    ['infection', (p) => startInfection(p, INFECTION.Vampirism, { day: Math.floor(T0 / MINUTES_PER_DAY) }), (p) => { endDisease(liveInfection(p)); return true; }],
  ];
  for (const [what, make, end] of lives) {
    setWorldMinutes(T0); resetMagicRoundMarker(null);
    const p = mortal();
    const entry = make(p);
    runMagicRoundsFor(p, T0, T0 + 2, {});
    assert.equal(Number.isNaN(entry.roundsRemaining), false, `${what}: no round count ever counted down to NaN - the seed of the load's loss`);
    assert.equal(p.activeEffects.includes(entry), true, `${what}: alive while it lasts`);
    assert.equal(end(p), true);
    runMagicRoundsFor(p, T0 + 2, T0 + 3, {});
    assert.equal(p.activeEffects.includes(entry), false, `${what}: ended, it leaves the list as DFU's bundle does`);
  }
  resetMagicRoundMarker(null);
});

// ═══ B: the Light spell underground ═══════════════════════════════════════════════════════════════════════════════
test('DISC16-B: the world host\'s dungeon frame lights the DUNGEON engine\'s candle - the engine every cast down there goes through - and never its own', () => {
  const src = rd('src/scenes/worldModes.js');
  const at = src.indexOf("if (mode === 'dungeon') {\n      if (pendingDungeonExit)");   // the frame's own branch, not the one-line dispatches
  const branch = src.slice(at, src.indexOf('\n    }\n', at));
  assert.ok(at > 0 && branch.includes('dungeonCtx.drawFoes('), 'the branch was found whole');
  const lights = branch.slice(branch.indexOf('withPlayerLights('));
  assert.match(lights.slice(0, lights.indexOf('renderer.setClearColor')), /^withPlayerLights\(nearestLights\([^\n]*\n\s*dungeonCtx\.candleLight\(\), playerTorchLight\(/);
  assert.ok(!branch.includes('magic?.candleLight()') && !branch.includes('magic.candleLight()'), 'this host\'s own engine is not updated underground');
  assert.ok(!/\bmagic\??\.update\(/.test(branch), 'and nothing here updates it - so its candle is never the dungeon\'s');
  assert.match(rd('src/scenes/dungeonContext.js'), /candleLight: \(\) => magic\.candleLight\(\),/, 'the context hands out its own engine\'s candle');
});
