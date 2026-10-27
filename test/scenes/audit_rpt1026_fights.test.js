// AUDIT RPT1026 (the audit of FIELD BUGS 2026-10-26r, lane FIGHTS), E1: WINDOW-ONLINE AND THE TECHNIQUE KEY. Since
// RPT1026-FIGHTS WINDOW-ONLINE (scenes/windowWorld.js) a window over the world-hosted dungeon holds no frame online while
// the player lives under it: drawFoes runs, and with it the dungeon's weapon rig (combat/weapon/weaponRig.js frame) and
// the technique key it steps (combat/techniques.js stepTechnique). AUDIT TECH1 holds that key under a window by the door's
// `blocked` - the street's is `gamePaused()` - and the dungeon's door had none, because its rig had never stepped under
// one of its windows: the technique key (Mouse3, which reaches the held keys under any window) fired a weapon's technique
// from under the inventory or the map. The dungeon's door, as its host writes it, run on the real rig.
// tools/mutants/audit_rpt1026_fights.json.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createWeaponRig } from '../../src/combat/weapon/weaponRig.js';
import * as T from '../../src/combat/techniques.js';
import { TECHNIQUE_ACTION } from '../../src/combat/technique/techniqueRoster.js';
import * as LR from '../../src/systems/loot/lootRarity.js';
import { setPref, _resetForTests } from '../../src/systems/uiPrefs.js';
import { createWeapon } from '../../src/combat/enemyEquipment.js';
import { EQUIP_SLOTS } from '../../src/systems/equip.js';
import { resetToDefaults } from '../../src/systems/settings/settings.js';
import { setSharedClock } from '../../src/systems/worldTick.js';
import { windowHoldsDungeon } from '../../src/scenes/windowWorld.js';

const D = readFileSync(new URL('../../src/scenes/dungeonContext.js', import.meta.url), 'utf8');
/** The dungeon rig's technique door, as buildDungeonContext writes it - its `blocked` entry's expression. */
function dungeonBlockedExpr() {
  const rig = D.slice(D.indexOf('const weaponRig = createWeaponRig({'));
  const door = rig.slice(rig.indexOf('    technique: {'), rig.indexOf('\n    },'));
  return door.match(/\n\s+blocked: ([^\n]+?),\s*(?:\/\/[^\n]*)?\n/)?.[1] ?? null;
}
const lcg = (seed) => { let s = seed >>> 0 || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };

test('AUDIT RPT1026 E1 A WINDOW HOLDS THE TECHNIQUE KEY UNDERGROUND: online the dungeon\'s frame runs under a living player\'s window (WINDOW-ONLINE), and with it the rig - so its door holds the key as the street\'s does: the key under the inventory fires nothing, and with the window down the same press fires the technique (mutants: the door holds nothing; it holds by nothing)', (t) => {
  setSharedClock(() => 1000);
  t.after(() => setSharedClock(null));
  assert.equal(windowHoldsDungeon(true, true), false, 'online, a living player\'s window holds no dungeon frame - drawFoes and its rig run');
  const expr = dungeonBlockedExpr();
  assert.ok(expr, 'the dungeon\'s technique door says when a window holds the key');
  let windowUp = true;
  const blocked = new Function('dungeonPaused', 'opts', `return (${expr});`)(() => windowUp, {});
  resetToDefaults(); _resetForTests(); setPref('lootRarity', true); T._resetTechniquesForTests();
  t.after(() => { _resetForTests(); T._resetTechniquesForTests(); });
  // a Rare longsword with the Whirlwind - its technique a swing, nothing to aim (techniqueRoster.js)
  const blade = LR.applyRarity(createWeapon(120, 1), 'rare', lcg(7));
  blade.isIdentified = true;
  LR.addTechniqueLine(blade, () => 0.5, { id: 'whirlwind' });
  const entity = {
    isPlayer: true, level: 8, items: [blade], fatigue: 6400, health: 100, maxHealth: 100, equipCountdown: 0, activeEffects: [], career: {},
    stats: { strength: 60, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 }, skills: new Array(35).fill(50),
    equip: { slots: { [EQUIP_SLOTS.RightHand]: blade } },
  };
  let keyDown = false;
  const rig = createWeaponRig({
    renderer: {}, canvas: { clientWidth: 1000, clientHeight: 800 }, fetchBytes: () => { throw new Error('no art in this test'); }, palette: null,
    audio: { playOneShot() {}, registerSound: async () => true }, entity, say: () => {},
    actionDown: (a) => keyDown && a === TECHNIQUE_ACTION,   // the key in the held set, as Mouse3 is under any window
    camera: () => ({ pos: [0, 1.7, 0], yaw: 0, pitch: 0, feet: [0, 0, 0], move: { grounded: true } }),
    technique: { motor: () => null, face() {}, fireArrow() {}, drainFatigue() {}, fx() {}, shake() {}, sound() {}, blocked },
  });
  rig.toggleSheath();
  for (let i = 0; i < 120; i++) rig.frame(1 / 60);
  assert.equal(rig.playerWeapon.sheathed, false, 'drawn');
  const press = () => { keyDown = true; rig.frame(1 / 60); keyDown = false; rig.frame(1 / 60); };
  press();
  assert.equal(rig.swing.n, 0, 'under the window: no strike started');
  assert.deepEqual([T.techniqueState().act, [...T.techniqueState().wait.keys()]], [null, []], 'nor the technique taken, nor its wait begun');
  windowUp = false;
  rig.frame(1 / 60);   // the key seen up with the window down (TECH1: a key held as it closes asks to be pressed again)
  press();
  assert.equal(rig.swing.n, 1, 'the window down: the same press strikes');
  assert.equal(T.techniqueState().act, 'swing');
  assert.ok(T.techniqueWait('whirlwind') > 0, 'and its wait begins');
});
