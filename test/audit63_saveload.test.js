// AUDIT 63 - THE SAVE-AND-LOAD LANE (F24-F31).
//
// Eight holes in the save envelope, every one of them a member DFU
// writes and reads and the port did not:
//   F24  the INTERIOR host's two enemy pools rode no envelope at all
//        (SaveLoadManager.cs:865/:1006 - enemyData is unconditional)
//   F25  WeaponManager.UsingRightHand (SerializablePlayer.cs:176/:421)
//   F26  EnemyEntity.Team + the MobileEnemy struct copy's team
//        (SerializableEnemy.cs:121/:125, restored :157/:179-181)
//   F27  MobileUnit.SpecialTransformationCompleted (:126/:225-228)
//   F28  RemoveAllOrphanedItems (SaveLoadManager.cs:1518)
//   F29  EnemyEntity.WabbajackActive (:124/:172)
//   F30  PlayerEnterExit.PlayerTeleportedIntoDungeon
//        (SerializablePlayer.cs:188-191/:402-405) and the two clears
//        it depends on (PlayerEnterExit.cs:875/:1197)
//   F31  StartFromClassicSave's weapon hand (StartGameBehaviour.cs:606)
//
// The reference gates below read the C# checkout when one is present
// (DFU_PATH, or the in-tree sparse clone) and skip loudly otherwise -
// the port pins beside them do not skip.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dfuFile } from './dfuRoot.mjs';
import { snapshotPlayer, restorePlayer, restoreSessionState, removeOrphanedItems, removeAllOrphanedItems } from '../src/systems/save.js';
import { MobileUnit, MOBILE_DAEDRA_SEDUCER } from '../src/characters/mobileUnit.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';
import { usingRightHandFromSaveVars } from '../src/combat/playerWeapon.js';
import { equipItem } from '../src/systems/equip.js';
import { createRandomPotion, randomlyAddMap, randomlyAddPotionRecipe } from '../src/systems/loot.js';   // AUDIT 63r F28: the three NAMELESS production mints
import { templateByIndex } from '../src/systems/itemTemplates.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const WM = rd('src/scenes/worldModes.js');
const WORLD = rd('src/scenes/world.js');
const DC = rd('src/scenes/dungeonContext.js');
const XF = rd('src/scenes/exteriorFoes.js');
const CS = rd('src/systems/classicSave.js');

const cs = (rel) => {
  const u = dfuFile(rel);
  return existsSync(u) ? readFileSync(u, 'utf8').split('\n') : null;
};
/** The C# line at a 1-based number, trimmed. */
const at = (lines, n) => (lines[n - 1] ?? '').trim();

const mkEntity = (over = {}) => ({
  name: 'T', level: 3, health: 20, maxHealth: 30, fatigue: 100, magicka: 10, maxMagicka: 40,
  stats: { strength: 50 }, skills: new Array(35).fill(20), items: [], spells: [],
  ...over,
});

// ---------------------------------------------------------------
// F24 - the interior host's enemy half of the save envelope.
// ---------------------------------------------------------------
test('AUDIT 63 F24 (reference): enemyData is unconditional, and a quest foe is NOT stood during a load', (t) => {
  const slm = cs('Assets/Scripts/Game/Serialization/SaveLoadManager.cs');
  const goh = cs('Assets/Scripts/Utility/GameObjectHelper.cs');
  if (!slm || !goh) { t.diagnostic('DFU checkout absent - the reference gate skipped'); return; }
  assert.equal(at(slm, 865), 'saveData.enemyData = stateManager.GetEnemyData();',
    'BuildSaveData writes every live enemy with no world-context gate');
  assert.equal(at(slm, 1006), 'stateManager.RestoreEnemyData(saveData.enemyData);',
    'and RestoreSaveData reads them all back');
  assert.match(at(goh, 1075), /if \(SaveLoadManager\.Instance\.LoadInProgress\)/,
    'AddQuestFoe refuses while a load runs - the restore owns the enemy state');
  assert.equal(at(goh, 1076), 'return;');
});

test('AUDIT 63 F24: the interior pools ride the SAVE envelope in natives (mutant: drop foes from the bag)', () => {
  // the snapshot seam takes BOTH of this host's pools...
  const snap = WM.slice(WM.indexOf('function interiorPoolSnapshot(toNative)'), WM.indexOf('function restoreInteriorPools'));
  assert.match(snap, /if \(mode !== 'interior' \|\| !toNative\) return null;/, 'interior mode only');
  assert.match(snap, /foes: interiorFoes\?\.snapshotWorld\(toNative\) \?\? \[\],/);
  assert.match(snap, /guards: interiorGuards\?\.snapshotWorld\(toNative\) \?\? \[\],/,
    'the WATCH called into a shop is an enemy too - both pools, or a crime load is a free escape');
  // ...and it is NOT the scene cache: CacheScene stores `new object[0]`
  // at the Enemy slot, and OnTransitionExterior destroys them.
  const scene = WM.slice(WM.indexOf('function currentSceneState()'), WM.indexOf('function cacheInteriorScene'));
  assert.ok(!/snapshotWorld/.test(scene),
    'the re-entry scene cache carries NO enemy - a killed shop fight must not stand again through the door');
  const ident = WM.slice(WM.indexOf('function interiorIdentity()'), WM.indexOf('function cacheInteriorScene'));
  assert.ok(!/snapshotWorld/.test(ident), 'and neither does the Recall anchor, which shares the identity');
  // the world host composes it in NATIVES with the compensation shed
  // per record - the pile/foe/guard law, not the scene cache's raw pos
  const qs = WORLD.slice(WORLD.indexOf('function worldQuickSave'), WORLD.indexOf('\n  }\n', WORLD.indexOf('function worldQuickSave')));
  assert.match(qs, /modes\?\.interiorPoolSnapshot\?\.\(\(pos\) => state\.worldCoords\(pos\)\)/, 'natives in');
  assert.match(qs, /r\.y - state\.compensation\[1\]/, 'and the vertical compensation shed per record');
  assert.match(qs, /interior\.foes = shed\(interiorPools\.foes\);/);
  assert.match(qs, /interior\.guards = shed\(interiorPools\.guards\);/);
});

test('AUDIT 63 F24: the re-entry suppresses its own marker-foe walk while the record lands', () => {
  // GameObjectHelper.cs:1073-1076 - hard-coded `false` stood every
  // marker foe WHOLE beside the ones the save brought back.
  assert.ok(!/loadInProgress: \(\) => false/.test(WM),
    'neither quest adapter answers a hard-coded false any more');
  assert.equal([...WM.matchAll(/loadInProgress: \(\) => _enemyRestoreInProgress/g)].length, 2,
    'the interior adapter AND the dungeon adapter read the one latch');
  const ri = WM.slice(WM.indexOf('async restoreInterior(saved, pos = null'), WM.indexOf('tryEnter,\n'));
  assert.match(ri, /const hasEnemyRecord = saved\.foes != null \|\| saved\.guards != null;/,
    'a pre-AUDIT-63 envelope carries no record, so its walk still stands the marker foes');
  const raise = ri.indexOf('_enemyRestoreInProgress = hasEnemyRecord;');
  assert.ok(raise > 0 && raise < ri.indexOf('await enterInteriorCore('),
    'the latch is up BEFORE the walk runs, and it is the RECORD that raises it');
  assert.match(ri, /\} finally \{\n\s+_enemyRestoreInProgress = false;\n\s+\}/,
    'and down again even when the re-entry throws');
  const overlay = ri.indexOf('restoreInteriorPools(saved, fromNative, yOffset)');
  assert.ok(overlay > 0 && overlay > ri.indexOf('await enterInteriorCore('),
    'the overlay lands AFTER the fresh pools are minted - SerializableEnemy\'s rebuild-then-set order');
});

test('AUDIT 63 F24: a restored quest foe keeps its quest link (SerializableEnemy.cs:205-218)', () => {
  assert.match(XF, /questResource: f\.questBehaviour\?\.getSaveData\?\.\(\) \?\? null,/,
    'the record carries QuestResourceBehaviour.GetSaveData');
  assert.match(XF, /const questBehaviour = \(sf\.questResource && reviveQuestBehaviour\)/);
  // the arm itself lives in ONE home (questFoeHost), where
  // bindQuestFoeHost - the mint-side half of the same link - already is
  const QFH = rd('src/scenes/questFoeHost.js');
  const rev = QFH.slice(QFH.indexOf('export function reviveQuestBehaviour'));
  assert.match(rev, /const b = new QuestResourceBehaviour\(machine\);/);
  assert.match(rev, /b\.restoreSaveData\(data\);/);
  assert.match(rev, /if \(!b\.questUID \|\| b\.targetSymbol == null\) return null;/,
    'a record naming no quest is left plain - :214-217 destroys the component');
  const wm = WM.slice(WM.indexOf('const reviveQuestBehaviour'), WM.indexOf('interiorFoes?.restoreWorld'));
  assert.match(wm, /reviveQuestBehaviourFromSave\(questBridge\?\.machine \?\? null, data\)/,
    'the interior host runs the shared arm');
  assert.match(wm, /if \(b\) interiorFoeStands\.push\(b\);/,
    'and the revived behaviour joins the scene list Resources.FindObjectsOfTypeAll would see');
});

test('AUDIT 63r F24: BOTH pools that use the factory revive the link - the exterior caller passes the bag too', () => {
  // The record was written for both pools (one snapshotWorld) and read
  // for one: the world host's exterior restore passed no options, so
  // `reviveQuestBehaviour` was null and a reloaded exterior quest foe
  // stood, fought and ticked no task. SerializableEnemy.cs:206-217 is
  // one law for every WorldContext.
  const calls = [...WORLD.matchAll(/exteriorFoes\.restoreWorld\([\s\S]{0,400}?\);/g)].map((m) => m[0]);
  assert.equal(calls.length, 1, 'the exterior pool has one restore seam');
  assert.match(calls[0], /\{ reviveQuestBehaviour: _reviveQuestBehaviour \}/,
    'and it hands the pool a revival, exactly as worldModes.restoreInteriorPools does');
  const rev = WORLD.slice(WORLD.indexOf('const _reviveQuestBehaviour'), WORLD.indexOf('let _loading = false;'));
  assert.match(rev, /reviveQuestBehaviour\(questBridge\?\.machine \?\? null, data\)/,
    'through the SHARED arm, not a second copy of :206-217');
  // the exterior host needs NO stand list: its ActiveGameObjectDatabase
  // walk reads the pool itself, so a revived foe is reachable the
  // moment spawnFoe lands it.
  assert.match(WORLD, /return \[\.\.\.exteriorFoes\.foes, \.\.\.cityGuards\.guards, \.\.\.\(modes\?\.liveQuestFoes\?\.\(\) \?\? \[\]\)\]\.filter\(\(f\) =>/,
    'questFoeInstances unions the live pools');
});

// ---------------------------------------------------------------
// F25 / F31 - the weapon HAND, the second line of the pair
// SerializablePlayer.cs:175-176 writes and :420-421 restores.
// ---------------------------------------------------------------
test('AUDIT 63 F25 (reference): weaponDrawn and the hand are written and restored as ONE pair', (t) => {
  const sp = cs('Assets/Scripts/Game/Serialization/SerializablePlayer.cs');
  const sg = cs('Assets/Scripts/Game/Utility/StartGameBehaviour.cs');
  if (!sp || !sg) { t.diagnostic('DFU checkout absent - the reference gate skipped'); return; }
  assert.equal(at(sp, 175), 'data.weaponDrawn = !weaponManager.Sheathed;');
  assert.equal(at(sp, 176), 'data.usingLeftHand = !weaponManager.UsingRightHand;');
  assert.equal(at(sp, 420), 'weaponManager.Sheathed = !data.weaponDrawn;');
  assert.equal(at(sp, 421), 'weaponManager.UsingRightHand = !data.usingLeftHand;');
  assert.equal(at(sg, 606), 'weaponManager.UsingRightHand = !saveVars.UsingLeftHandWeapon;');
});

test('AUDIT 63 F25: the hand round-trips through the envelope (mutant: drop it from the pose bag)', () => {
  const pose = { yaw: 1.25, pitch: -0.2, crouching: true, weaponDrawn: true, usingRightHand: false };
  const snap = JSON.parse(JSON.stringify(snapshotPlayer(mkEntity(), { pose })));
  const extras = restorePlayer(mkEntity(), snap, null);
  assert.equal(extras.pose.usingRightHand, false, 'a left-handed fighter loads back left-handed');
  // and the field is additive: a pre-fix envelope carries none, which
  // is C#'s `usingLeftHand` defaulting false (UsingRightHand true)
  const old = { yaw: 0, pitch: 0, crouching: false, weaponDrawn: false };
  const snap2 = JSON.parse(JSON.stringify(snapshotPlayer(mkEntity(), { pose: old })));
  assert.equal('usingRightHand' in restorePlayer(mkEntity(), snap2, null).pose, false);
});

test('AUDIT 63 F25: both save hosts write the hand and land it, and neither re-runs ApplyWeapon', () => {
  // AUDIT 65 SL-2 rewrote this line to the new law. DFU has ONE
  // WeaponManager for every WorldContext; the port has FOUR rigs, and
  // IS1 routes the inside-a-building save to the WORLD host's composer
  // - which read its own EXTERIOR rig unconditionally, so an F9 pressed
  // in a shop recorded the street's sheath and hand and the load wrote
  // them back into the street's rig. The composer asks the mode host
  // for the rig that is actually in the player's hands, per field, and
  // falls back to its own when there is none.
  assert.match(WORLD, /const wp = modes\?\.weaponPose\?\.\(\) \?\? null;/, 'the world host asks the mode seam for the live rig');
  assert.match(WORLD, /weaponDrawn: wp\?\.weaponDrawn \?\? !weaponRig\.playerWeapon\.sheathed, usingRightHand: wp\?\.usingRightHand \?\? weaponRig\.playerWeapon\.usingRightHand,/,
    'per field: the mode seam, else this host\'s own rig');
  assert.match(WORLD, /if \(pose\.usingRightHand != null\) weaponRig\.playerWeapon\.usingRightHand = !!pose\.usingRightHand;/,
    ':421 sets the property, presence-gated');
  assert.match(WORLD, /modes\?\.applyWeaponPose\?\.\(pose\);/, 'and the pair lands in the interior rig too - DFU sets ONE manager');

  // ...and the fourth host's two seams, MOUNTED, not matched: the
  // expressions that run below are the ones in src/scenes/worldModes.js.
  const lift = (text, sig) => {
    const i = text.indexOf(sig);
    assert.ok(i >= 0, `${sig} was found`);
    let d = 0;
    for (let k = text.indexOf('{', i + sig.length - 1); k < text.length; k++) {
      const c = text[k];
      if (c === '/' && text[k + 1] === '/') { k = text.indexOf('\n', k); continue; }
      if (c === '\'' || c === '"' || c === '`') { const q = c; for (k++; k < text.length; k++) { if (text[k] === '\\') k++; else if (text[k] === q) break; } continue; }
      if (c === '{') d++;
      else if (c === '}' && --d === 0) return text.slice(i, k + 1);
    }
    assert.fail(`unbalanced ${sig}`);
    return '';
  };
  // eslint-disable-next-line no-new-func
  const seam = (mode, interiorWeapon) => new Function('mode', 'interiorWeapon',
    `return ({ ${lift(WM, '    weaponPose() {')}, ${lift(WM, '    applyWeaponPose(pose) {')} });`)(mode, interiorWeapon);
  const rig = (sheathed, usingRightHand) => ({ playerWeapon: { sheathed, usingRightHand } });

  const drawnLeft = rig(false, false);
  assert.deepEqual(seam('interior', drawnLeft).weaponPose(), { weaponDrawn: true, usingRightHand: false },
    'inside a building the pair comes off the INTERIOR rig');
  // null in exterior AND dungeon mode: the world host composes its own
  // rig outdoors, and dungeonContext owns the whole pair underground
  // (:4690 save, :4766/:4772 restore) - answering here would shadow a
  // correct composer with this file's idle interim rig.
  assert.equal(seam('exterior', drawnLeft).weaponPose(), null);
  assert.equal(seam('dungeon', drawnLeft).weaponPose(), null);

  // THE RESTORE IS UNGATED BY MODE, deliberately: worldQuickLoad runs
  // forceExitToExterior FIRST and re-enters the building after, so an
  // OUTDOOR save loaded while the player stood indoors must still land
  // its bit in the rig they will meet at the next door.
  const sheathedRight = rig(true, true);
  seam('exterior', sheathedRight).applyWeaponPose({ weaponDrawn: true, usingRightHand: false });
  assert.deepEqual(sheathedRight.playerWeapon, { sheathed: false, usingRightHand: false },
    'an outdoor-mode apply still reaches the interior rig');
  const untouched = rig(true, true);
  seam('interior', untouched).applyWeaponPose({ yaw: 1 });
  assert.deepEqual(untouched.playerWeapon, { sheathed: true, usingRightHand: true }, 'presence-gated, like every additive pose member');
  seam('interior', untouched).applyWeaponPose(null);
  assert.deepEqual(untouched.playerWeapon, { sheathed: true, usingRightHand: true }, 'and a poseless envelope leaves the live rig');
  assert.ok(!/applyWeapon\(/.test(lift(WM, '    applyWeaponPose(pose) {')), 'flag only - the rig re-derives the screen weapon per frame');
  assert.match(DC, /usingRightHand: playerWeapon\.usingRightHand \}/, 'the dungeon/interior host writes it');
  assert.match(DC, /if \(extras\.pose\.usingRightHand != null\) playerWeapon\.usingRightHand = !!extras\.pose\.usingRightHand;/);
  // THE RESTORE SETS THE FLAG AND NOTHING ELSE. SerializablePlayer's
  // restore calls no ApplyWeapon; WeaponManager.Update's UpdateHands
  // ends in one (:699) on the next frame, and the port's twin is
  // weaponRig.syncWorn - which also re-forces the right hand under a
  // shield (:656) and keeps the racial claws a bare applyWeapon()
  // would drop.
  const applyPose = WORLD.slice(WORLD.indexOf('function applyPose(pose)'), WORLD.indexOf('\n  }\n', WORLD.indexOf('function applyPose(pose)')))
    .split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  assert.ok(!/applyWeapon\(/.test(applyPose), 'no ApplyWeapon in the pose landing - the rig re-derives it per frame');
  const dcApply = DC.slice(DC.indexOf('if (extras.pose) {'), DC.indexOf('surfacePlayer();', DC.indexOf('if (extras.pose) {')))
    .split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  assert.ok(!/applyWeapon\(/.test(dcApply), 'and none in the dungeon host\'s either');
});

test('AUDIT 63 F31: the classic import assigns the hand from SAVEVARS', () => {
  assert.equal(usingRightHandFromSaveVars({ usingLeftHandWeapon: true }), false, 'the :606 inversion');
  assert.equal(usingRightHandFromSaveVars({ usingLeftHandWeapon: false }), true);
  // ...and the snapshot builder finally calls it (the helper alone
  // stayed green through the whole gap).
  const pose = CS.slice(CS.indexOf('    pose: {'), CS.indexOf('readiedSpellIndex: null,'));
  assert.match(pose, /usingRightHand: usingRightHandFromSaveVars\(saveVars\),/);
  assert.match(CS, /import \{ usingRightHandFromSaveVars \} from '\.\.\/combat\/playerWeapon\.js';/);
  // the in-file record no longer claims the port has no left-hand rig
  assert.ok(!/no cheat toggles, no left-hand rig/.test(CS), 'the stale ground is struck');
  assert.match(CS, /GodMode is read but dropped/, 'the GodMode half of that record stands');
});

// ---------------------------------------------------------------
// F26 / F29 - the team pair and the Wabbajack latch.
// ---------------------------------------------------------------
test('AUDIT 63 F26/F29 (reference): the enemy record carries both team fields and the latch', (t) => {
  const se = cs('Assets/Scripts/Game/Serialization/SerializableEnemy.cs');
  if (!se) { t.diagnostic('DFU checkout absent - the reference gate skipped'); return; }
  assert.equal(at(se, 121), 'data.alliedToPlayer = mobileEnemy.Enemy.Team == MobileTeams.PlayerAlly;');
  assert.equal(at(se, 124), 'data.wabbajackActive = entity.WabbajackActive;');
  assert.equal(at(se, 125), 'data.team = (int)entity.Team + 1;');
  assert.equal(at(se, 172), 'entity.WabbajackActive = data.wabbajackActive;', 'restored UNCONDITIONALLY - a rewind clears it');
  assert.match(at(se, 180), /if \(team > 0\)/, 'and the team behind its own 0 = "no team saved" sentinel');
  assert.equal(at(se, 181), 'entity.Team = (MobileTeams)(team - 1);');
});

test('AUDIT 63 F26: BOTH team fields ride both foe records and restore independently', () => {
  for (const [name, src] of [['exteriorFoes', XF], ['dungeonContext', DC]]) {
    assert.match(src, /team: f\.entity\.team, mobileTeam: f\.entity\.mobileTeam,/, `${name} records both`);
    assert.match(src, /if \(sf\.team != null\) f\.entity\.team = sf\.team;/, `${name} restores entity.Team`);
    assert.match(src, /if \(sf\.mobileTeam != null\) f\.entity\.mobileTeam = sf\.mobileTeam;/, `${name} restores the struct copy`);
  }
  // NOT collapsed into the `allied` boolean: ChangeFoeTeam can set any
  // of the twelve MobileTeams, which one flag cannot carry.
  assert.ok(!/allied: sf\./.test(XF), 'the restore assigns the fields, it does not route a PlayerAlly boolean');
});

test('AUDIT 63 F29: the Wabbajack latch rides both records and restores BOTH ways', () => {
  for (const [name, src] of [['exteriorFoes', XF], ['dungeonContext', DC]]) {
    assert.match(src, /wabbajackActive: !!f\.entity\.wabbajackActive,/, `${name} records it`);
    assert.match(src, /if \(sf\.wabbajackActive != null\) f\.entity\.wabbajackActive = !!sf\.wabbajackActive;/,
      `${name} restores it with a PRESENCE gate, not a truthiness one - :172 assigns false as readily as true`);
  }
});

// ---------------------------------------------------------------
// F27 - the Daedra Seducer's completed transformation.
// ---------------------------------------------------------------
test('AUDIT 63 F27 (reference): the flag is saved and replayed THROUGH THE SETTER', (t) => {
  const se = cs('Assets/Scripts/Game/Serialization/SerializableEnemy.cs');
  const mu = cs('Assets/Scripts/Internal/Base/MobileUnit.cs');
  if (!se || !mu) { t.diagnostic('DFU checkout absent - the reference gate skipped'); return; }
  assert.equal(at(se, 126), 'data.specialTransformationCompleted = mobileEnemy.SpecialTransformationCompleted;');
  assert.match(at(se, 225), /if \(data\.specialTransformationCompleted && mobileEnemy\)/);
  assert.match(se.slice(225, 228).join(' '), /mobileEnemy\.SetSpecialTransformationCompleted\(\);/,
    'the SETTER, because it is what rewrites the per-mobile MobileEnemy struct copy');
  assert.match(mu.slice(195, 225).join('\n'), /Called when restoring save game if unit has raised transformation completed flag/);
  // AUDIT 63r: the five rewrites the setter makes, and the STOCK row
  // they overwrite - the shared row must still read the stock after a
  // transform, which is what the port's copy buys.
  assert.equal(at(mu, 214), 'enemy.Behaviour = MobileBehaviour.Flying;');
  assert.equal(at(mu, 215), 'enemy.CorpseTexture = EnemyBasics.CorpseTexture(400, 5);');
  assert.equal(at(mu, 216), 'enemy.HasIdle = false;');
  assert.equal(at(mu, 217), 'enemy.HasSpellAnimation = true;');
  const eb = cs('Assets/Scripts/Utility/EnemyBasics.cs');
  if (!eb) return;
  assert.equal(at(eb, 1222), 'ID = 29,', 'the Daedra Seducer row');
  assert.equal(at(eb, 1223), 'Behaviour = MobileBehaviour.General,');
  assert.match(at(eb, 1227), /^CorpseTexture = CorpseTexture\(400, 6\),/);
  assert.equal(at(eb, 1228), 'HasIdle = true,');
});

test('AUDIT 63 F27: the setter rewrites the basics copy and the restore rewind puts the shared row back', () => {
  const frames = () => 10;
  const m = new MobileUnit(MOBILE_DAEDRA_SEDUCER, ENEMY_BASICS[MOBILE_DAEDRA_SEDUCER], frames, () => 0.5, 'female');
  assert.equal(m.specialTransformationCompleted, false);
  assert.equal(m.basics, ENEMY_BASICS[MOBILE_DAEDRA_SEDUCER], 'the shared frozen row until something writes');
  m.setSpecialTransformationCompleted();
  // Base/MobileUnit.cs:208-224's five rewrites, the winged form
  assert.equal(m.specialTransformationCompleted, true);
  assert.equal(m.basics.behaviour, 'Flying');
  assert.deepEqual(m.basics.corpseTexture, { archive: 400, record: 5 });
  assert.equal(m.basics.hasIdle, false);
  assert.equal(m.basics.hasSpellAnimation, true);
  assert.notEqual(m.basics, ENEMY_BASICS[MOBILE_DAEDRA_SEDUCER], 'on its own copy, never the shared row');
  // AUDIT 63r: and the SHARED row still reads its STOCK values, which
  // are the reference's (EnemyBasics.cs:1223 General, :1227
  // CorpseTexture(400, 6) "only using unwinged here", :1228 HasIdle
  // true). ENEMY_BASICS[29] is a plain mutable object, so a setter
  // that dropped its own copy would rewrite the row for every Seducer
  // in the game, transformed or not - and the earlier form of this
  // assertion compared the row against itself and could not see it.
  assert.equal(ENEMY_BASICS[MOBILE_DAEDRA_SEDUCER].behaviour, 'General');
  assert.deepEqual(ENEMY_BASICS[MOBILE_DAEDRA_SEDUCER].corpseTexture, { archive: 400, record: 6 });
  assert.equal(ENEMY_BASICS[MOBILE_DAEDRA_SEDUCER].hasIdle, true);
  // ...and the arm a host that patches its foes IN PLACE needs: a save
  // taken BEFORE the transform must land an untransformed Seducer,
  // which is free in DFU because it restores over a rebuilt mobile.
  m.clearSpecialTransformationCompleted();
  assert.equal(m.specialTransformationCompleted, false);
  assert.equal(m.basics, ENEMY_BASICS[MOBILE_DAEDRA_SEDUCER], 'the shared row is back - the struct-copy rewrite is undone');
  assert.deepEqual(m.basics.corpseTexture, { archive: 400, record: 6 }, 'the unwinged corpse, EnemyBasics.cs:1227');
  assert.equal(m.basics.behaviour, 'General');
});

test('AUDIT 63 F27: both foe records carry the flag, and the dungeon applies it BEFORE the corpse', () => {
  for (const [name, src] of [['exteriorFoes', XF], ['dungeonContext', DC]]) {
    assert.match(src, /specialTransformationCompleted: !!f\.mobile\?\.specialTransformationCompleted,/, `${name} records it`);
  }
  assert.match(XF, /if \(sf\.specialTransformationCompleted && f\.mobile\) f\.mobile\.setSpecialTransformationCompleted\(\);/,
    'the exterior restore replays it through the setter');
  const aw = DC.slice(DC.indexOf('function applyWorld(w, { truncate = true } = {})'), DC.indexOf('\n  }\n', DC.indexOf('droppedLoot.restorePiles')));
  const setter = aw.indexOf('f.mobile.setSpecialTransformationCompleted();');
  const corpse = aw.indexOf('if (sf.dead && !f.dead) { f.dead = true; spawnCorpse(f); }');
  assert.ok(setter > 0 && corpse > 0 && corpse > setter,
    'spawnCorpse reads mobile.basics.corpseTexture, so a Seducer that died winged only gets the 400/5 corpse if the setter ran first');
  assert.match(aw, /else if \(sf\.specialTransformationCompleted === false && f\.mobile\?\.specialTransformationCompleted\)/,
    'and the in-place host carries the rewind arm the rebuild gives DFU for free');
  assert.match(aw, /f\.mobile\.clearSpecialTransformationCompleted\(\);/);
  assert.match(aw, /f\.seducer = new SeducerTransformBehaviour\(f\.mobile, f\.entity\);/,
    'with a fresh transform clock - SetupDemoEnemy.cs:191-195\'s component on a rebuilt enemy');
});

// ---------------------------------------------------------------
// F28 - RemoveAllOrphanedItems.
// ---------------------------------------------------------------
test('AUDIT 63 F28 (reference): LoadGame sweeps the three collections, and nothing else does', (t) => {
  const slm = cs('Assets/Scripts/Game/Serialization/SaveLoadManager.cs');
  const ic = cs('Assets/Scripts/Game/Items/ItemCollection.cs');
  if (!slm || !ic) { t.diagnostic('DFU checkout absent - the reference gate skipped'); return; }
  assert.equal(at(slm, 1518), 'RemoveAllOrphanedItems();');
  assert.equal(at(slm, 1564), 'count += playerEntity.Items.RemoveOrphanedItems();');
  assert.equal(at(slm, 1565), 'count += playerEntity.WagonItems.RemoveOrphanedItems();');
  assert.equal(at(slm, 1566), 'count += playerEntity.OtherItems.RemoveOrphanedItems();');
  const body = ic.slice(660, 690).join('\n');
  assert.match(body, /if \(item\.IsQuestItem\)/);
  assert.match(body, /if \(quest == null\)/);
  assert.match(body, /else if \(quest\.QuestTombstoned\)/);
  assert.match(body, /else if \(string\.IsNullOrEmpty\(item\.shortName\)\)/);
  // AUDIT 63r: and what that last arm MEANS, in the reference's own
  // words - an invalid template, not a missing display name. SetItem
  // gives every template-backed mint a shortName, so it can only read
  // empty when the template did not resolve.
  assert.equal(at(ic, 663), '// Schedule removal if item relates to a null or tombstoned quest, or has an invalid template');
  const dui = cs('Assets/Scripts/Game/Items/DaggerfallUnityItem.cs');
  if (!dui) return;
  assert.equal(at(dui, 551), 'shortName = TextManager.Instance.GetLocalizedItemName(itemTemplate.index, itemTemplate.name);');
});

test('AUDIT 63 F28: the sweep drops a dead quest\'s items from all three collections', () => {
  const live = { questTombstoned: false };
  const dead = { questTombstoned: true };
  const quests = new Map([[11, live], [12, dead]]);
  const getQuest = (uid) => quests.get(uid) ?? null;
  const e = mkEntity();
  const keep = { name: 'Ebony Dagger', questItem: true, questUID: 11 };
  const plain = { name: 'Iron Dagger' };
  e.items = [keep, plain,
    { name: 'Painting', questItem: true, questUID: 12 },      // tombstoned
    { name: 'Letter', questItem: true, questUID: 99 },        // quest gone
    { questItem: false, group: 'Weapons', templateIndex: 9999 }];   // no name AND no template - :663's "invalid template"
  e.wagonItems = [{ name: 'Chest', questItem: true, questUID: 99 }, { name: 'Ingot' }];
  e.otherItems = [{ name: 'Broken Sword', questItem: true, questUID: 12 }];
  const n = removeAllOrphanedItems(e, getQuest);
  assert.equal(n, 5, 'three orphaned quest items in the pack, one in the wagon, one in repair - and the templateless');
  assert.deepEqual(e.items, [keep, plain], 'a LIVE quest\'s item and an ordinary item stay');
  assert.deepEqual(e.wagonItems.map((i) => i.name), ['Ingot'], 'the wagon is swept too - Item.Dispose never reaches it');
  assert.deepEqual(e.otherItems, [], 'and the in-repair collection');
  // a QUEST item with no name at all, of a LIVE quest, stays: the C#
  // arms are exclusive (`else if`), so the quest arm never falls
  // through to the template arm.
  const e2 = mkEntity({ items: [{ questItem: true, questUID: 11 }] });
  assert.equal(removeOrphanedItems(e2, e2.items, getQuest), 0, 'the quest arm never falls through to the name arm');
});

test('AUDIT 63r F28: an UNNAMED but template-backed item survives - DFU\'s arm is an invalid TEMPLATE, not a missing name', () => {
  // The port's `name` is an optional override (resolveItemName falls
  // back to the template); DFU's `shortName` is assigned from the
  // template on every mint (DaggerfallUnityItem.cs:551), so
  // IsNullOrEmpty(shortName) can only mean "no template". These three
  // production factories mint no `name` at all, and a sweep that read
  // the override deleted every one of them on the next load.
  const potion = createRandomPotion(() => 0.3);
  const recipeShelf = [];
  randomlyAddPotionRecipe(100, recipeShelf, () => 0);
  const recipe = recipeShelf[0];
  const mapPile = [];
  randomlyAddMap(100, mapPile, () => 0);
  const map = mapPile[0];
  for (const [what, it] of [['potion', potion], ['recipe', recipe], ['map', map]]) {
    assert.ok(it, `${what} was minted`);
    assert.equal(it.name, undefined, `${what} really carries no name override`);
    assert.ok(templateByIndex(it.templateIndex)?.name, `${what} resolves a template name instead`);
  }
  const e = mkEntity({ items: [potion, map], wagonItems: [recipe] });
  assert.equal(removeAllOrphanedItems(e, () => null), 0,
    'nothing is swept: an alchemist bottle, a treasure map and a potion recipe are ordinary items');
  assert.deepEqual(e.items, [potion, map]);
  assert.deepEqual(e.wagonItems, [recipe]);
  // ...and the arm still fires for what DFU means by it.
  const e3 = mkEntity({ items: [{ group: 'Weapons', templateIndex: 4242 }] });
  assert.equal(removeAllOrphanedItems(e3, () => null), 1, 'an item whose template does not resolve is the orphan');
});

test('AUDIT 63 F28: an orphan comes OFF THE DOLL on its way out', () => {
  const e = mkEntity();
  const worn = { name: 'Steel Cuirass', questItem: true, questUID: 77, templateIndex: 103, groupIndex: 3, group: 'Armor', material: 3, currentCondition: 100, maxCondition: 100 };
  e.items = [worn];
  equipItem(e, worn);
  const slot = worn.equipSlot;
  assert.notEqual(slot, undefined, 'the fixture really is worn');
  removeAllOrphanedItems(e, () => null);
  assert.deepEqual(e.items, [], 'the orphan left');
  assert.equal(worn.equipSlot, undefined, 'and its slot with it - a bare splice would leave a ghost equip');
});

test('AUDIT 63 F28: the sweep runs in the ONE composer, AFTER the quest machine is restored', () => {
  // the ordering trap: restorePlayer runs BEFORE restoreSessionState at
  // both host seams, so a sweep there would ask the OUTGOING session's
  // machine (or, on a boot load, an empty one) and delete every
  // legitimately restored quest item. DFU's order is :1433 then :1518.
  const seen = [];
  const bridge = {
    restore: () => seen.push('quest'),
    machine: { getQuest: (uid) => { seen.push(`ask:${uid}`); return null; } },
  };
  const e = mkEntity({ items: [{ name: 'Bell', questItem: true, questUID: 5 }] });
  restoreSessionState({ quest: { q: 1 } }, { questBridge: bridge, entity: e });
  assert.equal(seen[0], 'quest', 'the machine is restored first');
  assert.ok(seen.includes('ask:5'), 'and the sweep asks the RESTORED machine');
  assert.deepEqual(e.items, [], 'the orphan is gone');
  // the two port-only back-compat gates, neither of them a behaviour
  // departure: no machine to ask, and no quest envelope in the save.
  const e2 = mkEntity({ items: [{ name: 'Bell', questItem: true, questUID: 5 }] });
  restoreSessionState({ quest: { q: 1 } }, { entity: e2 });
  assert.equal(e2.items.length, 1, 'a host with no quest machine sweeps nothing');
  const e3 = mkEntity({ items: [{ name: 'Bell', questItem: true, questUID: 5 }] });
  restoreSessionState({ quest: null }, { questBridge: bridge, entity: e3 });
  assert.equal(e3.items.length, 1, 'and a pre-Q4-v save, which carries items but no quest block, is left alone');
  // both hosts hand the entity in; the classic import does NOT sweep
  // (StartFromClassicSave is not LoadGame).
  assert.match(WORLD, /restoreSessionState\(extras, \{ questBridge, talk: \{ mill: rumorMill, tree: topicTree, session: npcSession \}, entity: playerEntity \}\)/);
  assert.match(DC, /restoreSessionState\(extras, \{ questBridge: opts\.questBridge, talk: opts\.talkSave, entity: playerEntity \}\)/);
  assert.equal([...WORLD.matchAll(/removeAllOrphanedItems/g)].length, 0, 'no second copy of the sweep in a host');
});

// ---------------------------------------------------------------
// F30 - PlayerTeleportedIntoDungeon.
// ---------------------------------------------------------------
test('AUDIT 63 F30 (reference): the flag is saved and restored UNDER TWO GATES, and lowered on both exits', (t) => {
  const sp = cs('Assets/Scripts/Game/Serialization/SerializablePlayer.cs');
  const pee = cs('Assets/Scripts/Game/PlayerEnterExit.cs');
  if (!sp || !pee) { t.diagnostic('DFU checkout absent - the reference gate skipped'); return; }
  assert.match(at(sp, 188), /if \(playerEnterExit\.IsPlayerInsideDungeon\)/, 'written only from inside a dungeon');
  assert.equal(at(sp, 190), 'data.playerPosition.playerTeleportedIntoDungeon = playerEnterExit.PlayerTeleportedIntoDungeon;');
  assert.match(at(sp, 402), /if \(data\.playerPosition\.insideDungeon\)/, 'and restored only for such a save');
  assert.equal(at(sp, 404), 'playerEnterExit.PlayerTeleportedIntoDungeon = data.playerPosition.playerTeleportedIntoDungeon;');
  assert.equal(at(pee, 875), 'PlayerTeleportedIntoDungeon = false;', 'TransitionExterior lowers it');
  assert.equal(at(pee, 1197), 'PlayerTeleportedIntoDungeon = false;', 'and TransitionDungeonExterior');
});

test('AUDIT 63 F30: the flag rides the DUNGEON envelope, not ENTITY_FIELDS', () => {
  const SAVE = rd('src/systems/save.js');
  const fields = SAVE.slice(SAVE.indexOf('const ENTITY_FIELDS'), SAVE.indexOf('];', SAVE.indexOf('const ENTITY_FIELDS')));
  assert.ok(!/playerTeleportedIntoDungeon/.test(fields),
    'ENTITY_FIELDS is copied BLIND in both directions - that would drop DFU\'s two gates');
  assert.match(DC, /teleportedIntoDungeon: !!playerEntity\.playerTeleportedIntoDungeon,/,
    'this host IS SerializablePlayer.cs:188\'s IsPlayerInsideDungeon gate');
  assert.match(DC, /if \(w\.teleportedIntoDungeon != null\) playerEntity\.playerTeleportedIntoDungeon = !!w\.teleportedIntoDungeon;/,
    'and applyWorld runs only for this dungeon\'s own save - :402\'s insideDungeon gate');
});

test('AUDIT 63r F30 (reference): the flag has exactly TWO clears, and the teleport teardowns are not among them', (t) => {
  const pee = cs('Assets/Scripts/Game/PlayerEnterExit.cs');
  const tp = cs('Assets/Scripts/Game/MagicAndEffects/Effects/Mysticism/Teleport.cs');
  if (!pee || !tp) { t.diagnostic('DFU checkout absent - the reference gate skipped'); return; }
  const clears = pee.reduce((a, l, i) => (l.trim() === 'PlayerTeleportedIntoDungeon = false;' ? [...a, i + 1] : a), []);
  assert.deepEqual(clears, [875, 1197], 'TransitionExterior and TransitionDungeonExterior, and NOTHING else in PlayerEnterExit');
  // The first pass read Teleport.cs:151 as a third door. It is not:
  // TransitionDungeonExteriorImmediate is five lines and raises an
  // event.
  assert.equal(at(tp, 151), 'playerEnterExit.TransitionDungeonExteriorImmediate();');
  assert.match(at(pee, 1209), /public void TransitionDungeonExteriorImmediate\(\)/);
  assert.match(pee.slice(1209, 1215).join('\n'), /RaiseOnPreTransitionEvent\(PlayerEnterExit\.TransitionType\.ToDungeonExterior\);/);
  assert.ok(!pee.slice(1209, 1215).join('\n').includes('PlayerTeleportedIntoDungeon'),
    'the Immediate arm never lowers the flag - :246 overwrites it from the anchor either way');
  // ...and `teleport pc to` is RespawnPlayer, whose Respawner resets
  // the four INSIDE fields and leaves this one alone.
  const respawner = pee.slice(471, 490).join('\n');
  for (const f of ['isPlayerInside = false;', 'isPlayerInsideDungeon = false;', 'isPlayerInsideDungeonCastle = false;', 'lastPlayerDungeonBlockIndex = -1;']) {
    assert.ok(respawner.includes(f), `Respawner resets ${f}`);
  }
  assert.ok(!respawner.includes('PlayerTeleportedIntoDungeon'), 'and never PlayerTeleportedIntoDungeon');
});

test('AUDIT 63r F30: the TWO exit transitions lower the flag - and the shared teleport teardown does not', () => {
  assert.equal([...WM.matchAll(/playerEntity\.playerTeleportedIntoDungeon = false;/g)].length, 2,
    'the building door and the dungeon door, matching PlayerEnterExit.cs:875/:1197 - no third clear');
  // the building exit (PlayerEnterExit.cs:875) - beside the tavern latch
  assert.match(WM, /_insideTavern = false;[^\n]*\n(?:\s*\/\/[^\n]*\n)*\s*playerEntity\.playerTeleportedIntoDungeon = false;/,
    'lowered where TransitionExterior lowers it, beside isPlayerInsideTavern');
  // ...and the shared teardown forceExitToExterior - which the QUEST
  // TELEPORT (_respawnAtSite) and the teleport window run too, neither
  // of which re-raises - must not carry one, or a Recall latch is lost
  // where DFU's RespawnPlayer keeps it.
  const fx = WM.slice(WM.indexOf('forceExitToExterior({ cacheScene'), WM.indexOf('get interiorCollider()'));
  assert.ok(fx.length > 100, 'the teardown body was found');
  assert.ok(!/playerEntity\.playerTeleportedIntoDungeon = false;/.test(fx),
    'forceExitToExterior lowers no flag - RespawnPlayer (PlayerEnterExit.cs:482-489) does not');
  // ...and the Recall arms re-raise it AFTER their exit, which is what
  // makes the missing clear harmless there (Teleport.cs:216/:246).
  for (const [name, src] of [['world', WORLD], ['exterior', rd('src/scenes/exterior.js')]]) {
    const i = src.indexOf('forceExitToExterior({ cacheScene');
    const j = src.indexOf('playerEntity.playerTeleportedIntoDungeon = plan.teleportedIntoDungeon;', i);
    assert.ok(i > 0 && j > i, `${name}.js re-raises the anchor's flag after the exit door (Teleport.cs:246)`);
  }
  // the two teleport teardowns really are the same seam, and really do
  // not re-raise - which is why the third clear was a live bug.
  for (const fn of ['async function teleportTo(pick)', 'async function _respawnAtSite(loc)']) {
    const i = WORLD.indexOf(fn);
    assert.ok(i > 0, `${fn} exists`);
    const body = WORLD.slice(i, WORLD.indexOf('\n  }\n', i));
    assert.match(body, /modes\?\.forceExitToExterior\(\);/, `${fn} runs the shared teardown`);
    assert.ok(!/playerTeleportedIntoDungeon/.test(body), `${fn} re-raises nothing, so a clear there would be permanent`);
  }
});
