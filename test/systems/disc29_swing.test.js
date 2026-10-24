// DISC29-G (2026-09-28, Lynk on Discord, online: "Speed 55" and about four swings a second since the update, faster
// still as a wolf) - FIXED BY SWING-LAW.
//
// What changed was DISC28-D (861462d2, the same morning): the rig gave the first-person swing the player's LIVE Speed,
// which it had never read - every player had swung at the number 50, about a second a blow. A lycanthrope's live Speed
// is its base plus the curse's 40, in both forms, every magic round (LycanthropyEffect.ApplyLycanthropeAdvantages) -
// so a base-55 werewolf swung at live 95, and DFU's line (`3 * (115 - Speed) / 980` a frame) is a hyperbola in the
// rate: 3.3 blows a second at 95, four at the cap. Mac: "swing speed is insane" - and then "Do whatever is the most
// detailed. I dont care about departure, especially if we can do it better". SWING-LAW is the port's own swing law
// (characters/weaponStates.js swingFrameSeconds; its own pins are test/systems/swinglaw.test.js): the Speed still shows, bounded,
// and the weapon in the hand is read. These pin the report's case on the real rig.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createWeaponRig } from '../../src/combat/weapon/weaponRig.js';
import { machineAttack, getMeleeWeaponAnimTime } from '../../src/characters/weaponStates.js';
import { installSwingLaw } from '../../src/combat/swingLaw.js';
import { EQUIP_SLOTS, equipTableOf } from '../../src/systems/equip.js';
import { mintCondition, setItemFields } from '../../src/systems/item/itemTemplates.js';
import { WEAPONS } from '../../src/characters/weapons.js';
import { setModSetting, _resetModSettings } from '../../src/systems/modSettings.js';
import { liveStat } from '../../src/systems/statMods.js';
import { createLycanthropyCurse, lycanthropyMagicRound, morphSelf, LYCANTHROPE_STAT_MOD } from '../../src/systems/lycanthropy.js';
import { LYCANTHROPY_TYPES } from '../../src/systems/infection.js';
import { isFullMoonFromMinutes, MINUTES_PER_DAY, CLASSIC_GAME_START_TIME } from '../../src/systems/gameDate.js';
import { installRoleplayRealismItems } from '../../src/systems/roleplayRealismItems/rriInstall.js';
import { installRoleplayRealism } from '../../src/systems/roleplayRealism/rrInstall.js';

const DT = 1 / 60;
/** A night with no full moon (the lycanthropy suite's QUIET): a forced change would morph the subject. */
const QUIET = (() => {
  let m = CLASSIC_GAME_START_TIME;
  while (isFullMoonFromMinutes(m) || isFullMoonFromMinutes(m + MINUTES_PER_DAY * 3)) m += MINUTES_PER_DAY;
  return m;
})();
/** A base-55 character with the curse's advantages applied, as one magic round applies them. */
function werewolf(beast = true) {
  const p = {
    isPlayer: true, level: 5, health: 60, maxHealth: 60, activeEffects: [], items: [], spells: [], skills: {},
    stats: { strength: 55, intelligence: 50, willpower: 50, agility: 55, endurance: 55, personality: 50, speed: 55, luck: 50 },
  };
  assert.ok(createLycanthropyCurse(p, LYCANTHROPY_TYPES.Werewolf, { now: QUIET }));
  if (beast) morphSelf(p, { force: true, nowMinutes: QUIET });   // PIN MOVED (BAL6, bible/05-Combat/Balance-Arc.md section 12): the curse's +40 is the beast's
  lycanthropyMagicRound(p, { nowMinutes: QUIET + 1 });
  return p;
}
/** The real rig over the entity with a drawn weapon, stepped by its own frame (AUDIT DISC28 AR-4's harness). */
function rigWith(entity, templateIndex) {
  const weapon = mintCondition(setItemFields({ group: 'Weapons', templateIndex, material: 0 }));
  entity.items = [weapon];
  equipTableOf(entity)[EQUIP_SLOTS.RightHand] = weapon;
  const rig = createWeaponRig({
    renderer: { uploadTexture: () => null, drawScreenQuad: () => {} },
    canvas: { width: 1280, height: 800, clientWidth: 1280, clientHeight: 800 },
    fetchBytes: () => { throw new Error('no art in this pin'); }, palette: null, audio: { playOneShot() {} }, entity,
    camera: () => ({ pos: [0, 0, 0], yaw: 0, pitch: 0, move: { baseSpeed: 3, grounded: true, standing: true } }),
  });
  rig.playerWeapon.sheathed = false;
  rig.frame(DT);
  return rig;
}
const swing = (rig) => {
  assert.ok(machineAttack(rig.playerWeapon.machine, 'StrikeDown'), 'a swing starts');
  let t = 0;
  while (rig.playerWeapon.machine.state !== 'Idle' && t < 10) { rig.frame(DT); t += DT; }
  return t;
};

test('DISC29-G: a base-55 lycanthrope\'s live Speed is 95 in beast form - the curse\'s 40 (PIN MOVED, BAL6: the beast\'s alone - the man reads his own 55)', () => {
  const p = werewolf();
  assert.equal(LYCANTHROPE_STAT_MOD, 40);
  assert.equal(liveStat(p, 'speed'), 95, 'the Attributes page shows 95 / 100, not 55');
  assert.equal(liveStat(werewolf(false), 'speed'), 55, 'BAL6: in human form, the character\'s own');
});

test('DISC29-G (SWING-LAW): the real rig swings a base-55 werewolf under two blows a second - DFU\'s line had it at 3.3 - with the mods off and on; the curse still shows, and nothing swings at the cap\'s four', () => {
  installSwingLaw();
  installRoleplayRealismItems({ fetchBytes: () => { throw new Error('no art in this pin'); } });
  installRoleplayRealism();
  for (const mods of [false, true]) {
    _resetModSettings();
    setModSetting('roleplay-realism-items', 'weaponBalance', mods);
    setModSetting('roleplay-realism', 'weaponSpeed', mods);
    try {
      const p = werewolf();
      const rig = rigWith(p, WEAPONS.Dagger);
      const t = swing(rig);
      const law = 5 * getMeleeWeaponAnimTime(95, rig.playerWeapon.animCtx());
      assert.ok(Math.abs(t - law) <= 5 * DT, `mods ${mods ? 'on' : 'off'}: ${t.toFixed(3)}s a blow, the law's ${law.toFixed(3)}s at live 95`);
      assert.ok(1 / t > 1.2 && 1 / t < 2, `mods ${mods ? 'on' : 'off'}: ${(1 / t).toFixed(2)} a second - quick, never DFU's 3.3`);
      assert.ok(t > 5 * ((3 * (115 - 95)) / 980) * 1.5, 'half again slower than DFU\'s line at 95 at least');
      const human = { ...werewolf(), activeEffects: [] };   // the same body without the curse
      const plain = swing(rigWith(human, WEAPONS.Dagger));
      assert.ok(plain > t * 1.2, `mods ${mods ? 'on' : 'off'}: without the curse base 55 is slower (${plain.toFixed(3)}s) - the curse's Speed still shows`);
      const capped = werewolf();
      capped.stats.speed = 90;   // live 100, the cap
      assert.ok(1 / swing(rigWith(capped, WEAPONS.Dagger)) < 2, `mods ${mods ? 'on' : 'off'}: at the cap, still under two a second`);
    } finally { _resetModSettings(); }
  }
});
