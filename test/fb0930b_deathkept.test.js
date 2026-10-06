// DEATH-KEPT (2026-09-30, FIELD BUGS 2026-09-30b - Niwy's "If you cure a disease and die at the same time you will
// became immortal", the HUD at HEALTH 0% MAGICKA 0% FATIGUE 3%; bible/01-Overview/Field-Bugs-2026-09-30b.md). The damage
// door raises a death on the blow that crosses to zero and never again, so the death lives in its screen - and a window
// written over a host's slot took it. The reported road: Talk to a temple's priest in a building (the popup comes down,
// the talk goes up in townTalk's slot), a blow kills under the talk (the building's death screen lands in its own, empty
// slot), the talk closes into the priest's service window by a raw write over the screen, the stack replaces its top,
// and the cure is bought - at zero, with no screen, and no later blow, plague day or stat-zero kill ever raising one.
// The world frame now asks the presenter again for a player at zero with no screen up. Real modules throughout:
// hurtPlayer, the plague, statMods, townTalk, the window stack, DeathScreen, the Cure Disease flow; the building's slot
// rules are worldModes.js's (cited), and the frame's own check is lifted off world.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { hurtPlayer, setDeathPresenter, setAvoidDeathHook, presentPlayerDeath } from '../src/characters/playerEntity.js';
import { startDisease, updateDiseases, DISEASES, diseaseCount } from '../src/systems/diseases.js';
import { killIfAnyLiveStatZero, maxFatigue } from '../src/systems/statMods.js';
import { createTownTalk } from '../src/scenes/townTalk.js';
import { makeWindowStack } from '../src/ui/windowStack.js';
import { DeathScreen } from '../src/ui/deathScreen.js';
import { ActionTextBox } from '../src/ui/actionText.js';
import { buildCureDiseaseFlow } from '../src/ui/guildServiceWindows.js';
import { templeOf } from '../src/systems/guildVariants.js';
import { SKILLS } from '../src/systems/skills.js';

const W = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
const M = readFileSync(new URL('../src/scenes/worldModes.js', import.meta.url), 'utf8');
const CHECK = /\n(    if \(playerSpawned && playerEntity\.health <= 0 [^\n]*presentPlayerDeath\(playerEntity\);)\n/.exec(W);
/** The frame's check, lifted: one frame of it over the given world. AUDIT LEGACY B1: `w.succession` - Project Legacy's
 *  Succession standing, the death's own screen (ui/legacyDoor.js successionOpen). */
const frameCheck = (w) => new Function('playerSpawned', 'playerEntity', 'worldMoveBusy', 'townTalk', 'DeathScreen', 'modes', 'presentPlayerDeath', 'successionOpen', CHECK[1])(
  w.spawned ?? true, w.entity, () => !!w.moving, w.townTalk, DeathScreen, w.modes, presentPlayerDeath, () => !!w.succession);

function diseasedPlayer() {
  const p = {
    name: 'Niwy', isPlayer: true, level: 6, health: 40, maxHealth: 70, magicka: 25, maxMagicka: 100,
    goldPieces: 5000, items: [], raceId: 1, gender: 'male', career: {},
    skills: Object.fromEntries(Object.values(SKILLS).map((s) => [s, 30])),
    skillUses: Object.fromEntries(Object.values(SKILLS).map((s) => [s, 0])),
    stats: { strength: 40, intelligence: 50, willpower: 45, agility: 55, endurance: 35, personality: 40, speed: 50, luck: 45 },
    activeEffects: [], fatigue: 0,
  };
  startDisease(p, DISEASES.Plague, 10, () => 0);   // a dungeon's plague: its day takes the stats down, and the magicka
  updateDiseases(p, 11, { hurt: (n) => hurtPlayer(p, n), drainMagicka: (n) => { p.magicka = Math.max(0, p.magicka - n); }, drainFatigue: () => {} }, () => 0.93);
  p.fatigue = Math.round(maxFatigue(p) * 0.4);
  return p;
}

/** A building's two slots and the temple's priest (worldModes.js), with the frame's check on or off. */
function building(p, { kept }) {
  let interiorOverlay = null;
  const stack = makeWindowStack({ onTop: (w) => { interiorOverlay = w; } });
  const townTalk = createTownTalk({
    renderer: { uploadTexture: () => ({}) }, canvas: { width: 640, height: 400 },
    fetchBytes: async () => { throw new Error('no ARENA2'); }, playerEntity: p, regionIndex: 17,
  });
  const modes = { deathUp: () => interiorOverlay instanceof DeathScreen };   // deathUp's interior arm
  const mount = (win) => { interiorOverlay = win; return win; };   // mountServiceWindow's interior arm - a raw write
  const frame = () => {   // the world frame's check (above every mode gate), then the building's reconcile, tick and drain
    if (kept) frameCheck({ entity: p, townTalk, modes });
    stack.reconcile(interiorOverlay);
    const w = interiorOverlay;
    if (w) { w.tick?.(1 / 60); if (w.done) { w.dispose?.(); if (interiorOverlay === w) interiorOverlay = null; } stack.reconcile(interiorOverlay); }
  };
  let presented = 0;
  setDeathPresenter(() => {   // presentInteriorDeath: a DeathScreen into the slot, never over its own
    presented++;
    if (!(interiorOverlay instanceof DeathScreen)) { interiorOverlay?.dispose?.(); interiorOverlay = new DeathScreen({ eyeHeight: 1.6, capsuleHeight: 1.8, online: false }); }
  });
  setAvoidDeathHook(null);
  const popup = {
    done: false, dispose() {},
    cure() {
      const flow = buildCureDiseaseFlow(p, templeOf('Arkay'), null, { rows: (id) => [{ text: `rsc:${id}` }], now: () => 0, quality: 10,
        onClose: () => { if (interiorOverlay === flow) interiorOverlay = null; } });
      this.done = true;
      return mount(flow);
    },
  };
  return { townTalk, modes, frame, mount, popup, slot: () => interiorOverlay, presented: () => presented, clear: () => { interiorOverlay = null; } };
}

/** The report's road, to the cure: Talk, the blow under it, the talk closed, the cure bought if it can be. */
function templeDeath({ kept }) {
  const p = diseasedPlayer();
  const b = building(p, { kept });
  b.mount(b.popup); b.frame();
  b.clear();   // Talk indoors: the popup comes down (:4088), the conversation goes up in townTalk's slot
  const talk = new ActionTextBox(['(the priest talks)']);
  b.townTalk.showOverlay(talk, () => { if (!b.popup.done) b.mount(b.popup); });   // onClosed (:4096) - a raw write
  b.frame();
  hurtPlayer(p, 999);   // a building's foe keeps its clock under a window (WINFOE1)
  b.frame();
  const killed = { health: p.health, presented: b.presented(), deathUp: b.modes.deathUp() };
  b.townTalk.closeOverlay(talk);
  b.frame(); b.frame();
  const afterTalk = { deathUp: b.modes.deathUp(), presented: b.presented() };
  if (!b.modes.deathUp()) {   // the priest's window is up: Cure Disease, Yes, and the dialog dismissed
    const flow = b.popup.cure(); b.frame();
    flow.input('KeyY'); flow.input('Enter'); b.frame(); b.frame();
  }
  const before = b.presented();
  for (let i = 0; i < 5; i++) hurtPlayer(p, 50);
  for (let i = 0; i < 25; i++) killIfAnyLiveStatZero(p, { hurt: (n) => hurtPlayer(p, n) }, 0.25);
  b.frame();
  return { p, killed, afterTalk, cured: diseaseCount(p) === 0, laterDeaths: b.presented() - before, deathUp: b.modes.deathUp(), slot: b.slot() };
}

test('DEATH-KEPT the temple: killed under the priest\'s talk, the talk\'s close writes his window over the building\'s death screen - before, the cure was bought at zero and no blow or stat-zero kill raised a death again; now the frame presents it again the frame the screen is gone, and it stands (mutant: the check gone from the frame)', () => {
  const before = templeDeath({ kept: false });
  assert.deepEqual(before.killed, { health: 0, presented: 1, deathUp: true }, 'the blow raised the death, beneath the talk');
  assert.equal(before.afterTalk.deathUp, false, 'the talk\'s close took the screen');
  assert.equal(before.cured, true, 'and the cure was bought');
  assert.equal(before.p.health, 0);
  assert.equal(before.laterDeaths, 0, 'immortal: nothing raised it again');
  assert.equal(before.deathUp, false);
  const after = templeDeath({ kept: true });
  assert.deepEqual(after.killed, { health: 0, presented: 1, deathUp: true });
  assert.equal(after.afterTalk.deathUp, true, 'the screen back the frame it was taken');
  assert.equal(after.afterTalk.presented, 2, 'presented once more, and once');
  assert.equal(after.cured, false, 'no cure bought by the dead');
  assert.ok(after.deathUp && after.slot instanceof DeathScreen, 'and the death stands');
});

test('DEATH-KEPT the check\'s guards: it asks only for a player at zero, spawned, with no death screen up in townTalk\'s slot or the mode\'s, and never while the world moves (a load restores the save\'s health under its latch, a respawn heals first); presentPlayerDeath asks nothing of the living (mutants: each guard dropped)', () => {
  let asked = 0;
  setDeathPresenter(() => { asked++; });
  const noScreen = { overlay: null };
  const quiet = { deathUp: () => false };
  const run = (w) => { const was = asked; frameCheck({ townTalk: noScreen, modes: quiet, ...w }); return asked - was; };
  assert.equal(run({ entity: { health: 0 } }), 1, 'at zero, nothing up: asked');
  assert.equal(run({ entity: { health: -3 } }), 1, 'below zero too');
  assert.equal(run({ entity: { health: 1 } }), 0, 'alive: never');
  assert.equal(run({ entity: { health: 0 }, spawned: false }), 0, 'before the world stands: never');
  assert.equal(run({ entity: { health: 0 }, moving: true }), 0, 'while the world moves: never');
  assert.equal(run({ entity: { health: 0 }, townTalk: { overlay: new DeathScreen({ online: false }) } }), 0, 'townTalk\'s death screen up: never a second');
  assert.equal(run({ entity: { health: 0 }, modes: { deathUp: () => true } }), 0, 'the mode\'s death screen up: never a second');
  assert.equal(run({ entity: { health: 0 }, modes: null }), 1, 'no modal host: townTalk\'s slot is the whole question');
  assert.equal(run({ entity: { health: 0 }, succession: true }), 0, 'AUDIT LEGACY B1: Project Legacy\'s Succession standing - the death\'s own screen: never a second over it');
  assert.equal(presentPlayerDeath({ health: 5 }), false);
  assert.equal(presentPlayerDeath({ health: 0 }), true);
  assert.equal(asked, 4, 'three frames asked, and the one direct ask of the dead');
  setDeathPresenter(null);
});

test('DEATH-KEPT the place: the check runs in the world frame after the video hold (a death\'s video owns the canvas, and its screen stays in the slot until the run ends) and above every mode gate, so a building\'s and a dungeon\'s deaths are asked too; the popup\'s Talk still closes into a raw write (the door this closes the far side of)', () => {
  const f = W.indexOf('  function frame(now) {');
  const at = W.indexOf(CHECK[1], f);
  assert.ok(f > 0 && at > f, 'in the frame');
  assert.ok(at > W.indexOf('if (frameHeld()) {', f), 'after the video hold');
  assert.ok(at < W.indexOf('if (modes.frame(dt, now)) {', f), 'above the modes\' gate');
  assert.equal(W.split(CHECK[1]).length, 2, 'once');
  assert.match(W, /import \{[^}]*\bpresentPlayerDeath\b[^}]*\} from '\.\.\/characters\/playerEntity\.js';/);
  assert.match(M, /onClosed: keepUnder && !pushed \? \(\) => \{ if \(!keepUnder\.done\) mountServiceWindow\(keepUnder\); \} : null,/);
  assert.match(M, /if \(mode === 'interior'\) \{ interiorOverlay = win; return win; \}/);
});
