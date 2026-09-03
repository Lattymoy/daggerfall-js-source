// AUDIT 23 fix pins, wave 4: the UI-lane findings + the last dead code.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyLevelUp } from '../src/systems/advancement.js';
import { RAY_DISTANCE, MOBILE_NPC_ACTIVATION_DISTANCE, PICKPOCKET_DISTANCE } from '../src/systems/talk.js';
import * as weaponStates from '../src/characters/weaponStates.js';
import { MISSILE_SPEED } from '../src/systems/spellcast.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (f) => readFileSync(join(root, f), 'utf8');

test('AUDIT 23 ui-native-1: a pre-rolled pool means applyLevelUp draws no second one', () => {
  // DaggerfallCharacterSheetWindow.cs:375-390 rolls BonusPool() ONCE.
  const entity = () => ({
    readyToLevelUp: true, pendingLevel: 2, level: 1, maxHealth: 30, health: 30,
    stats: { endurance: 50, luck: 50 },
    career: { hitPointsPerLevel: 10 },
  });
  let draws = 0;
  const rolls = () => { draws++; return 0.5; };
  applyLevelUp(entity(), () => {}, rolls, 5);
  assert.equal(draws, 1, 'the HP roll only - the pool came pre-rolled');
  draws = 0;
  applyLevelUp(entity(), () => {}, rolls);
  assert.equal(draws, 2, 'the headless path still rolls its own pool');
  // ...and the screen forwards its shown roll
  assert.ok(src('src/ui/charsheet.js').includes('this._rolls, this._rolledPool)'),
    'LevelUpScreen hands the ORIGINAL roll back');
});

test('AUDIT 23 ui-native-3: the talk ray reaches 76.8; each mode gates with the classic line', () => {
  // PlayerActivate.cs:76 RayDistance; :775-796 the per-mode distances.
  assert.equal(RAY_DISTANCE, 3072 * 0.025);   // 76.8 in float (3072 * GlobalScale, the DFU expression)
  assert.equal(MOBILE_NPC_ACTIVATION_DISTANCE, 6.4);
  assert.equal(PICKPOCKET_DISTANCE, 3.2);
  const tt = src('src/scenes/townTalk.js');
  assert.ok(tt.includes('if (!best || bestDist > RAY_DISTANCE) return false;'), 'the ray reach is the only silent bound');
  // R1: the mode moved to the interactionMode singleton (PlayerActivate's
  // currentMode is global) - the gates read it live, same law
  // AUDIT 54 (talk lane) MOVED THIS PIN: the refusal is the localized
  // key 'youAreTooFarAway' (Internal_Strings.csv:22) and there is one
  // constant for it now (player/activate.js), so the literal these two
  // lines used to carry - a full stop where the table spells an
  // ellipsis - is gone from the source.
  assert.ok(tt.includes("if (getInteractionMode() !== 'steal' && bestDist > MOBILE_NPC_ACTIVATION_DISTANCE) { hud.add(TOO_FAR_AWAY_TEXT); return true; }"));
  assert.ok(tt.includes("if (getInteractionMode() === 'steal' && !best.person?.pickpocketAttempted\n        && bestDist > PICKPOCKET_DISTANCE) { hud.add(TOO_FAR_AWAY_TEXT); return true; }"));
});

test('AUDIT 23 ui-native-5: the drawn space omits GlyphSpacing; the measured space keeps it', () => {
  // DaggerfallFont.cs:328 vs :381/:464 - the asymmetry is DFU's.
  const t = src('src/ui/text.js');
  assert.ok(t.includes('cx += spaceGlyphWidth(fnt) * scale;'), 'drawText: width alone');
  assert.equal(/cx \+= \(spaceGlyphWidth\(fnt\) \+ FNT_GLYPH_SPACING\) \* scale/.test(t), false, 'the old symmetric advance is gone');
  // AUDIT 39 F129 MOVED THIS PIN: the space test is now `code ===
  // FNT_SPACE_CODE`, because measureText folds through Encoding.ASCII
  // and substitutes ErrorCode first (:373-379) - after that, the only
  // sub-33 code left IS the space. The law pinned here is unchanged:
  // every glyph, space included, adds GlyphSpacing to the measure.
  assert.ok(/w \+= \(code === FNT_SPACE_CODE \? spaceGlyphWidth\(fnt\) : fnt\.glyphWidth\(code - FNT_ASCII_START\)\) \+ FNT_GLYPH_SPACING;/.test(t),
    'measureText adds the spacing for every glyph, space included');
});

test('AUDIT 23 ui-chargen-1: backing out of Reflexes keeps the skill spinner cursor', () => {
  // CreateCharAddBonusSkills.cs:62-68 restores without touching the
  // per-group selections.
  const c = src('src/ui/chargen.js');
  assert.equal(/action === 'back'\) \{ this\.state = 'skills'; this\.skillCursor = 0; \}/.test(c), false);
  assert.ok(c.includes("else if (action === 'back') this.state = 'skills';"), 'the arm survives without the reset');
});

test('AUDIT 23 hosts-16: interior destroy() frees the voxelfolk rigs', () => {
  const ic = src('src/scenes/interiorContext.js');
  assert.ok(ic.includes('renderer.destroyMesh(rg.mesh)'), 'the rigs are freed');
  const d = ic.indexOf('destroy() {');
  assert.ok(ic.indexOf('renderer.destroyMesh(rg.mesh)', d) > d, 'inside destroy()');
});

test('AUDIT 23 characters-14/combat-13: the duplicate constants are gone; the single sources hold', () => {
  assert.equal(weaponStates.ARROW_MOVEMENT_SPEED, undefined, 'MISSILE_SPEED is the one home');
  assert.equal(weaponStates.SWING_WEAPON_FATIGUE_LOSS, undefined, 'hostCombat owns the swing loss');
  assert.equal(MISSILE_SPEED, 25.0);
  assert.equal(weaponStates.ARROW_ARM_LENGTH, 0.9, 'ArmLength keeps its one home');
});
