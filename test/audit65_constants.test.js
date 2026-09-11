// AUDIT 65 - THE CONSTANTS-VS-READS LANE (2026-09-11). Two findings,
// both "the port spells a number where DFU reads one".
//
// CV-1: the character sheet's skills dialog printed the PERMANENT
// skill array where TextProvider.GetSkillSummary - the ONE member
// DaggerfallCharacterSheetWindow.ShowSkillsDialog builds every row
// from - formats GetLiveSkillValue, and the SAME page's hand-to-hand
// damage row (AUDIT 63 F34) already read the live value. A lycanthrope
// read one number on one line and a damage range computed from another
// on the next.
//
// CV-2: the PLAYER's blast and contact capsule was measured at the
// ENEMY prefab's radius. DFU's queries (DaggerfallMissile.cs:339
// SphereCast, :481 OverlapSphereNonAlloc) meet whatever collider each
// entity actually wears, and the two prefabs differ - the player's
// CharacterController is m_Radius 0.35, the foe's 0.4.
//
// Both fixtures are built by the REAL PRODUCERS (TEST THE SHAPE THE
// PRODUCER MINTS): a chargen character put through the lycanthropy
// round that writes the racialOverride skillMods, and the shipped
// ArrowFlight / createPlayerMagic seams rather than hand-called
// helpers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CharSheet } from '../src/ui/charsheet.js';
import { sheetModel } from '../src/ui/enhancedCharSheet.js';
import { SKILLS, SKILL_NAMES, skillValue, permanentSkillValue } from '../src/systems/skills.js';
import { createCharacter } from '../src/systems/chargen.js';
import {
  createLycanthropyCurse, lycanthropyMagicRound, LYCANTHROPE_SKILL_MOD, LYCANTHROPE_SKILLS,
} from '../src/systems/lycanthropy.js';
import { LYCANTHROPY_TYPES } from '../src/systems/infection.js';
import { isFullMoonFromMinutes, MINUTES_PER_DAY, CLASSIC_GAME_START_TIME } from '../src/systems/gameDate.js';
import { setSpellRecordsByIndex } from '../src/systems/loot.js';
import { handToHandMinDamage, handToHandMaxDamage } from '../src/combat/formulas.js';
import { FNT_ASCII_START } from '../src/formats/fntFile.js';

import { ArrowFlight } from '../src/combat/arrowFlight.js';
import { createPlayerMagic } from '../src/scenes/hostMagic.js';
import {
  BODY_CAPSULE_RADIUS, PLAYER_BODY_RADIUS, EXPLOSION_RADIUS, MISSILE_COLLIDER_RADIUS,
  missileHitsCapsule, sphereOverlapsCapsule,
} from '../src/systems/spellcast.js';
import { CAPSULE_RADIUS, CAPSULE_HEIGHT } from '../src/player/motor.js';

const src = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

// ── CV-1: the skills dialog reads GetLiveSkillValue ──────────────────

const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };

/** Hand-to-Hand is a PRIMARY skill here, so page 1 carries the row AND
 *  the damage line that reads the same skill - the two lines that
 *  disagreed. */
const CAREER = {
  name: 'Monk', hitPointsPerLevel: 10, advancementMultiplier: 1.0,
  primarySkills: [SKILLS.HandToHand, SKILLS.Dodging, SKILLS.Jumping],
  majorSkills: [SKILLS.Climbing, SKILLS.Running, SKILLS.Stealth],
  minorSkills: [SKILLS.ShortBlade, SKILLS.Archery, SKILLS.Swimming, SKILLS.Medical, SKILLS.Backstabbing, SKILLS.CriticalStrike],
};

/** A night with no full moon: ForceTransformDuringFullMoon
 *  (LycanthropyEffect.cs:606) would otherwise morph the subject inside
 *  the round. */
const QUIET = (() => {
  let m = CLASSIC_GAME_START_TIME;
  while (isFullMoonFromMinutes(m)) m += MINUTES_PER_DAY;
  return m;
})();

/** The producer chain, end to end: chargen mints the skills array, the
 *  curse mints the racialOverride, and the MAGIC ROUND is what writes
 *  `entry.skillMods` (lycanthropy.js:233-234 - ApplyLycanthropeAdvantages
 *  re-applied every round, LycanthropyEffect.cs:566-584). Nothing here
 *  touches `entity.skills`, which is the whole point: the permanent
 *  array never moves, so a reader of it never sees the +30. */
function lycanthrope() {
  setSpellRecordsByIndex(new Map([[92, { name: '!Lycanthropy', index: 92 }]]));
  const p = { isPlayer: true, reflexes: 2, items: [], activeEffects: [] };
  createCharacter(p, CAREER, 16, { rolls: seq(0) });
  createLycanthropyCurse(p, LYCANTHROPY_TYPES.Werewolf, { now: QUIET });
  lycanthropyMagicRound(p, { nowMinutes: QUIET });
  setSpellRecordsByIndex(null);
  return p;
}

/** The classic pane's drawn text, recovered at the glyph seam -
 *  drawText indexes `fnt.glyphWidth(code - FNT_ASCII_START)` for every
 *  non-space character in order (the idiom nativetrade.test.js:317-327
 *  already uses). Spaces take the `fixedWidth` arm and are simply
 *  absent from the stream. */
function paintedBy(sheet, page) {
  const chars = [];
  const font = { tex: 'f', fnt: { fixedHeight: 6, glyphWidth: (gi) => { chars.push(String.fromCharCode(gi + FNT_ASCII_START)); return 4; } } };
  const renderer = { uploadTexture: () => 'tex', drawScreenQuad() {} };
  sheet.page = page;
  sheet._drawSkillPage(renderer, font, { s: 1, ox: 0, oy: 0 });
  return chars.join('');
}

test('AUDIT 65 CV-1: every row of the skills dialog is GetLiveSkillValue, the value its own damage row already read', () => {
  const e = lycanthrope();
  const perm = permanentSkillValue(e, SKILLS.HandToHand);
  const live = skillValue(e, SKILLS.HandToHand);

  // The producer really did leave the permanent array alone and put the
  // +30 on the racialOverride entry - if this ever stops holding, the
  // finding's premise is gone and the pins below are meaningless.
  assert.equal(e.skills[SKILLS.HandToHand], perm, 'the curse writes skillMods, never entity.skills');
  assert.equal(LYCANTHROPE_SKILL_MOD, 30, 'const int skillModAmount = 30 (LycanthropyEffect.cs:576)');
  assert.equal(live, perm + LYCANTHROPE_SKILL_MOD, 'ApplyLycanthropeAdvantages is +30 on Hand-to-Hand');
  assert.ok(LYCANTHROPE_SKILLS.includes(SKILLS.HandToHand), 'SetSkillMod(HandToHand, 30) (:582)');
  assert.notEqual(live, perm, 'the fixture must be able to tell the two readers apart');

  // TextProvider.cs:503 - `string.Format("{0}%", playerEntity.Skills
  // .GetLiveSkillValue(skill))`, inside GetSkillSummary (:489-529),
  // which DaggerfallCharacterSheetWindow.cs:288/:296/:301 builds EVERY
  // row of ShowSkillsDialog from. The permanent value is never read on
  // that path.
  const painted = paintedBy(new CharSheet(e, { onClose: () => {} }), 1);
  assert.ok(painted.includes(`${SKILL_NAMES[SKILLS.HandToHand]}${live}%`),
    `the row prints the LIVE value (${live}%): ${painted}`);
  assert.ok(!painted.includes(`${SKILL_NAMES[SKILLS.HandToHand]}${perm}%`),
    `and not the permanent one (${perm}%): ${painted}`);

  // ...and the damage row four lines below it (AUDIT 63 F34,
  // DaggerfallCharacterSheetWindow.cs:313-314, also GetLiveSkillValue)
  // is computed from THE SAME number - the two lines of one page.
  assert.ok(painted.includes(`${SKILL_NAMES[SKILLS.HandToHand]}dmg:${handToHandMinDamage(live)}-${handToHandMaxDamage(live)}`),
    `the damage row reads the same value: ${painted}`);
  assert.notEqual(handToHandMinDamage(live), handToHandMinDamage(perm),
    'the two readings really would have printed different damage');
});

test('AUDIT 65 CV-1: the enhanced skin reads the same law - the number AND the meter beside it', () => {
  const e = lycanthrope();
  const live = skillValue(e, SKILLS.HandToHand);
  const m = sheetModel(e);
  assert.equal(m.skill(SKILLS.HandToHand), live, 'sheetModel.skill is GetLiveSkillValue');
  assert.notEqual(m.skill(SKILLS.HandToHand), e.skills[SKILLS.HandToHand]);
  // ONE model, one law: the attributes were already live (liveStat) and
  // so was handToHandDamage; the skill accessor was the odd one out.
  assert.deepEqual(m.handToHandDamage, { min: handToHandMinDamage(live), max: handToHandMaxDamage(live) });
  assert.equal(m.attributes.length > 0, true);
  // The accessor's ONE consumer draws the value text and the bar from
  // it, so the meter tracks the same figure the attribute bars do.
  const menu = src('src/ui/enhancedMenu.js');
  assert.match(menu, /el\('span', 'v', String\(m\.skill\(id\)\)\)/, 'the number reads through the model');
  assert.match(menu, /pxMeter\(m\.skill\(id\), 100, 'thin'\)/, '...and so does the meter beside it');
  // sheetModel's empty-entity path stays safe: `entity ?? {}` and
  // skillValue({}, id) is 0.
  assert.equal(sheetModel(undefined).skill(SKILLS.HandToHand), 0, 'the art-less/entity-less path still answers 0');
});

// ── CV-2: the player's body is the player's own radius ───────────────

test('AUDIT 65 CV-2: PLAYER_BODY_RADIUS is player/motor.js\'s own controller radius, imported and not restated', () => {
  // PlayerAdvanced.prefab:81-85 - m_Height 1.8, m_Radius 0.35,
  // m_SkinWidth 0.06 - against DaggerfallEnemy [Game Serializable]
  // .prefab:442-446's 1.8 / 0.4 / 0.05. Neither PlayerHeightChanger nor
  // SetupDemoEnemy ever writes a radius; both move HEIGHT alone.
  assert.equal(PLAYER_BODY_RADIUS, CAPSULE_RADIUS, "the player's body IS the player's controller");
  assert.equal(PLAYER_BODY_RADIUS, 0.35, 'PlayerAdvanced.prefab:82 m_Radius');
  assert.equal(BODY_CAPSULE_RADIUS, 0.45, "the FOE's, left where AUDIT 62 recorded it");
  assert.notEqual(PLAYER_BODY_RADIUS, BODY_CAPSULE_RADIUS, 'one number for two bodies is the defect');
  // SKIN WIDTH IS NOT PART OF A QUERY RADIUS: it is PhysX's penetration
  // allowance for the controller's own Move. DFU casts at the raw
  // controller.radius wherever it reads one (PlayerHeightChanger.cs:530,
  // EnemyMotor.cs:679/:1144) and the port's own player sweep agrees.
  assert.notEqual(PLAYER_BODY_RADIUS, 0.35 + 0.06, 'm_SkinWidth 0.06 is not added');
  // ONE DFU MEMBER, ONE EXPORT: spellcast must IMPORT the radius, not
  // spell 0.35 a second time.
  const sc = src('src/systems/spellcast.js');
  assert.match(sc, /import \{ CAPSULE_RADIUS \} from '\.\.\/player\/motor\.js';/);
  assert.match(sc, /export const PLAYER_BODY_RADIUS = CAPSULE_RADIUS;/);
  assert.ok(!/PLAYER_BODY_RADIUS = 0\.35/.test(sc), 'the literal is not restated here');
  // and the false premise the module used to carry is gone
  assert.ok(!/the\n \*  player's is the same radius/.test(sc), "the \"player's is the same radius\" sentence is retired");
});

test('AUDIT 65 CV-2: a blast meets the PLAYER at 4.0 + 0.35, two-sided, through the real explodeAt seam', () => {
  const world = { hurt: 0 };
  const player = {
    isPlayer: true, level: 1, health: 100, maxHealth: 100, magicka: 500, maxMagicka: 500,
    skills: new Array(40).fill(50), skillUses: new Array(40).fill(0),
    stats: { intelligence: 50, willpower: 50, endurance: 50 }, career: {}, activeEffects: [],
  };
  const magic = createPlayerMagic({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {} },
    audio: { playOneShot() {}, play3d() {}, playOneShotId() {}, play3dId() {} },
    getTexture: async () => ({ getSize: () => [16, 16], getScale: () => [0, 0] }),
    uploadRecord() {}, uploadRecordFrame() {},
    collider: { raycast: () => Infinity },
    playerEntity: player,
    playerSinks: { hurt: (n) => { world.hurt += n; }, heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {}, say: () => {} },
    say: () => {},
    surfacePlayer() {},
    foes: () => [],
    foeSinks: () => ({ hurt() {}, heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {} }),
    absorbCtx: () => ({ inside: true, day: false }),
    rolls: () => 0.99,
  });
  const spell = {
    name: 'Blast', index: 91, element: 4, rangeType: 4,
    effects: [{ type: 4, subType: 0, magnitudeBaseLow: 10, magnitudeBaseHigh: 10, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1, durationBase: 0, durationMod: 0, durationPerLevel: 1, chanceBase: 0, chanceMod: 0, chancePerLevel: 1 }],
  };
  // Feet at the origin, standing (1.8): the axis runs 0.35..1.45 and a
  // burst level with it reaches EXPLOSION_RADIUS + 0.35 = 4.35. DFU's
  // OverlapSphereNonAlloc (DaggerfallMissile.cs:481) meets the PLAYER's
  // collider, so 4.36 is clear and 4.34 is not. At the foe's 0.45 both
  // would land, which is exactly the 0.10 the port was giving away.
  const before = world.hurt;
  magic.explodeAt([4.36, 0.9, 0], spell, 1, [0, 0, 0], null, { playerHeight: CAPSULE_HEIGHT });
  assert.equal(world.hurt, before, '4.36 from the axis is past the player rim (4.35)');
  magic.explodeAt([4.34, 0.9, 0], spell, 1, [0, 0, 0], null, { playerHeight: CAPSULE_HEIGHT });
  assert.ok(world.hurt > before, '...and 4.34 is inside it');
  // the bracket is the function's too, and it brackets NOTHING at 0.45
  assert.equal(sphereOverlapsCapsule([4.36, 0.9, 0], EXPLOSION_RADIUS, [0, 0, 0], 1.8, PLAYER_BODY_RADIUS), false);
  assert.equal(sphereOverlapsCapsule([4.34, 0.9, 0], EXPLOSION_RADIUS, [0, 0, 0], 1.8, PLAYER_BODY_RADIUS), true);
  assert.equal(sphereOverlapsCapsule([4.36, 0.9, 0], EXPLOSION_RADIUS, [0, 0, 0], 1.8), true,
    'a FOE there is still caught - the two bodies are different sizes now');
});

test('AUDIT 65 CV-2: an enemy shaft meets the player at 0.45 + 0.35, two-sided, through the real ArrowFlight', () => {
  const open = () => new ArrowFlight({ getGpuMesh: () => null, collider: { raycast: () => Infinity, heightAt: () => -100 } });
  // MISSILE_SPEED * 0.05 = 1.25 per step, so a shaft loosed at z = -1.25
  // stands exactly on the player's z after one update and its lateral
  // offset from the capsule axis is read at face value.
  const shaft = (lateral) => {
    const hits = [];
    const f = open();
    f.fire([lateral, 0.9, -1.25], [0, 0, 1], { enemy: true, shooterFoe: { id: 1 }, weapon: {} });
    f.update(0.05, { playerFeet: [0, 0, 0], playerHeight: CAPSULE_HEIGHT, onPlayerHit: (m) => hits.push(m) });
    return hits.length;
  };
  assert.equal(MISSILE_COLLIDER_RADIUS + PLAYER_BODY_RADIUS, 0.8, "DFU's SphereCast rim at the player (:339)");
  assert.equal(shaft(0.81), 0, '0.81 out sails past the player');
  assert.equal(shaft(0.79), 1, '...and 0.79 feathers it');
  // THE FOE HALF IS UNCHANGED: 0.45 + 0.45 = 0.90, so a shaft the
  // player clears at 0.81 still strikes a foe at 0.89.
  assert.equal(missileHitsCapsule([0.89, 0.9, 0], [0, 0, 0], CAPSULE_HEIGHT), true, 'the foe rim is still 0.90');
  assert.equal(missileHitsCapsule([0.91, 0.9, 0], [0, 0, 0], CAPSULE_HEIGHT), false);
  assert.equal(missileHitsCapsule([0.89, 0.9, 0], [0, 0, 0], CAPSULE_HEIGHT, PLAYER_BODY_RADIUS), false,
    'the same point against a PLAYER is a miss - which is the whole finding');
});

test('AUDIT 65 CV-2: EVERY player-side capsule call carries the player body, at all five sites', () => {
  // The seam is five direct calls: hostMagic's AoE arm and its enemy
  // missile contact, dungeonContext's two enemy-missile player arms, and
  // the shared ArrowFlight the three world hosts fly (world.js:193,
  // exterior.js:28, worldModes.js:68; the dungeon runs its own loop and
  // takes the shared player-arrow LAW at dungeonContext.js:61) - so
  // worldModes.js and exterior.js hold no arrow contact of their own.
  // THE FOUR HOSTS RULE: the sweep is the WHOLE of src/, not a list of
  // three files, or a fifth host wiring its own contact escapes it.
  const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    (d.isDirectory() ? walk(join(dir, d.name)) : (d.name.endsWith('.js') ? [join(dir, d.name)] : [])));
  const root = fileURLToPath(new URL('../', import.meta.url));
  const sites = [];
  for (const f of walk(join(root, 'src'))) {
    for (const line of readFileSync(f, 'utf8').split('\n')) {
      if (!/(missileHitsCapsule|sphereOverlapsCapsule)\(/.test(line)) continue;
      if (!/playerFeet/.test(line)) continue;
      sites.push([f.slice(root.length), line.trim()]);
    }
  }
  assert.deepEqual(sites.map(([f]) => f).sort(), [
    'src/combat/arrowFlight.js',
    'src/scenes/dungeonContext.js', 'src/scenes/dungeonContext.js',
    'src/scenes/hostMagic.js', 'src/scenes/hostMagic.js',
  ], 'five player-side capsule calls, and these are the files that own them');
  for (const [f, line] of sites) {
    assert.ok(line.includes('PLAYER_BODY_RADIUS'), `${f}: a player capsule measured without the player's body - ${line}`);
  }
  // and nowhere in src/ is the player measured at the FOE constant
  for (const [f, line] of sites) {
    assert.ok(!line.replace(/PLAYER_BODY_RADIUS/g, 'PBR').includes('BODY_CAPSULE_RADIUS'),
      `${f}: the foe constant is not applied to the player - ${line}`);
  }
  // The axis inset takes the MEASURED body too, not the module constant.
  // A crouched (0.9) player keeps a real segment, feet+0.35..feet+0.55,
  // where a 0.45 body collapses to one point at 0.45 (Unity's rule for a
  // capsule shorter than its own diameter) - so the two sweep different
  // SHAPES, not merely different rims.
  assert.match(src('src/systems/spellcast.js'), /const half = Math\.min\(bodyRadius, h \/ 2\);/);
  assert.equal(sphereOverlapsCapsule([0.29, 0.9, 0], 0.1, [0, 0, 0], 0.9, PLAYER_BODY_RADIUS), false,
    'a crouched PLAYER is clear of a burst 0.29 to the side of its crown');
  assert.equal(sphereOverlapsCapsule([0.29, 0.9, 0], 0.1, [0, 0, 0], 0.9), true,
    '...where the same point catches a 0.45 body, whose collapsed sphere sits lower and reaches wider');
});
