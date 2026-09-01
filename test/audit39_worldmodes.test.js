// AUDIT 39 - the MODAL host (src/scenes/worldModes.js) and the arrow
// flight the three non-dungeon hosts share.
//
// The shape the audit found here twice over: one arm of a pair wired
// and the other not. The dungeon arm gated its movers under an open
// window and the interior arm did not; the enemy arrow hunted and the
// player arrow flew through everything; the exterior transitions
// notified the talk session and the dungeon entry notified nothing;
// three hosts told the HUD the cursor was free and the fourth stayed
// silent. Each pin below is the missing half.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ArrowFlight, playerArrowHitFoe } from '../src/combat/arrowFlight.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (f) => readFileSync(join(ROOT, f), 'utf8');
const WM = src('src/scenes/worldModes.js');

// ---------------------------------------------------------------
// #28 - the outer host's window pauses the modal frame
// ---------------------------------------------------------------

test('AUDIT39 #28: overlayHeld takes townTalk\'s slot, so a window mounted OUT THERE pauses in here', () => {
  const decl = WM.slice(WM.indexOf('const overlayHeld ='), WM.indexOf('const crouchHeld'));
  assert.match(decl, /!!townTalk\?\.overlayActive \|\|/,
    'AddWindow pauses for the WINDOW, not for the slot it was pushed into');
  // the two that were already there stay there
  assert.match(decl, /mode === 'interior' && !!interiorOverlay/);
  assert.match(decl, /mode === 'dungeon' && !!dungeonCtx\?\.uiOverlayActive/);
  // and this host mounts into that slot itself - the reachability the
  // finding turns on, kept next to the gate that answers it
  assert.match(WM, /townTalk\.openTalkWindow\(talk\.greeting, \{ npcSeed: npcData\.nameSeed/);
});

// ---------------------------------------------------------------
// #29 - an aborted dungeon transition must leave nothing behind
// ---------------------------------------------------------------

test('AUDIT39 #29: the start-marker test runs BEFORE the mode/collider commit, and unwinds the context', () => {
  const at = WM.indexOf("console.error('[dungeon] no start marker; transition aborted')");
  assert.ok(at > 0, 'the refusal is still there');
  // DFU: `if (!dungeon.StartMarker) { Destroy(newDungeon); RaiseOnFailedTransition(...); return; }`
  // BEFORE EnableDungeonParent/MovePlayerToMarker (PlayerEnterExit.cs:921-934).
  const refusal = WM.slice(at, at + 200);
  assert.match(refusal, /ctx\.destroy\(\);\n\s+dungeonCtx = null;\n\s+return false;/,
    'Destroy + the handle cleared - the built layout must not leak');
  const commit = WM.indexOf("mode = 'dungeon';", at);
  assert.ok(commit > at, 'the three commits sit BELOW the refusal, not above it');
  assert.ok(WM.indexOf('player.collider = ctx.collider;', at) > at);
  // and there is no OTHER mode write above the test inside this member
  const member = WM.slice(WM.indexOf('async function tryEnterDungeon('), at);
  assert.ok(!member.includes("mode = 'dungeon'"),
    'nothing commits the mode before the marker is known');
});

// ---------------------------------------------------------------
// #31 - the sixth TalkManager subscription
// ---------------------------------------------------------------

test('AUDIT39 #31: entering a dungeon interior clears castleNPCsSpokenTo', () => {
  assert.match(WM, /npcSession\?\.onEnterDungeonInterior\(\);/,
    'OnTransitionToDungeonInterior (TalkManager.cs:3611-3614), raised from BOTH entry members');
  // beside the resource mount, which is the other thing the transition raises
  const tail = WM.slice(WM.indexOf('mountQuestResources();   // B2:'));
  assert.ok(tail.indexOf('npcSession?.onEnterDungeonInterior();') < 600,
    'on the transition itself, with the resources');
  // the two exterior transitions keep their own notification
  assert.equal((WM.match(/npcSession\?\.onWorldChanged\(\);/g) || []).length, 2);
});

// ---------------------------------------------------------------
// #32 - the scene cache carries a door's POSE and lock, not a word
// ---------------------------------------------------------------

test('AUDIT39 #32: the interior scene caches the whole action record and restores through the system', () => {
  // SerializableActionDoor round-trips currentRotation + actionPercentage
  // beside currentState; RestartTween(1 - percentage) is what puts an
  // open door back OPEN, posed and passable.
  assert.match(WM, /const actionDoors = ctx\.actions\?\.collectSaveData\?\.\(\) \?\? \[\];/,
    'the cache stores the action system\'s own record');
  assert.ok(!WM.includes('.map((o) => ({ key: o.key, state: o.state }))'),
    'the state-word-only cache is deleted, not annotated');
  assert.match(WM, /interiorCtx\.actions\?\.restoreSaveData\?\.\(/,
    'and the restore goes through syncRestored, which settles matrix AND collider bucket');
  assert.match(WM, /d\.t == null \? \{ \.\.\.d, t: d\.state === 'end' \? 1 : 0 \} : d/,
    'a scene cached before this shipped carries the word alone - derive its pose, never a NaN matrix');
});

// ---------------------------------------------------------------
// #33 / #34 - a paused game advances no movers and no swing
// ---------------------------------------------------------------

test('AUDIT39 #33: the interior movers are held under a window, like the dungeon arm twelve lines up', () => {
  assert.match(WM, /if \(!overlayHeld\) interiorCtx\.actions\.update\(dt\);/,
    'PauseGame sets timeScale 0 and DFU\'s door tween never opts out of it');
  assert.match(WM, /if \(!overlayHeld\) advanceMachinery\(r\.state, dt, r\.child\);/,
    'the mill rotors are movers too');
  // the DRAW is deliberately outside the gate - a paused world still paints
  const rotors = WM.slice(WM.indexOf('for (const r of interiorCtx.rotors) {'));
  assert.match(rotors.slice(0, 500), /renderer\.drawMesh\(r\.gpu, mountMachineryChild\(/);
  // the dungeon arm's gate, unchanged - the pin that made the asymmetry visible
  assert.match(WM, /if \(!overlayHeld\) dungeonCtx\.actions\.update\(dt\);/);
});

test('AUDIT39 #34: an in-flight interior swing does not land its hit frame under a window', () => {
  // PIN MOVED (AUDIT 39r): the overlay gate is unchanged, but the rig
  // now takes the paralysis flag its two above-ground siblings take
  // (WeaponManager.cs:235-239). The gate under test is `overlayHeld ?
  // [] :`, which still reads exactly as it did.
  assert.match(WM, /for \(const ev of \(overlayHeld \? \[\] : interiorWeapon\.frame\(dt, \{ paralyzed \}\)\)\) \{/,
    'the rig MACHINE is held; the events it would have yielded do real work');
  // ...and the viewmodel still paints, outside the gate
  assert.match(WM, /\n\s+interiorWeapon\.draw\(\{ paralyzed \}\);/);
});

// ---------------------------------------------------------------
// #36 - PlayerDeath's camera sink in a world-hosted dungeon
// ---------------------------------------------------------------

test('AUDIT39 #36: the dungeon arm of the death camera sink exists and reads the CONTEXT\'s slot', () => {
  // createDungeonContext registers its own death presenter for the
  // whole visit, so a dungeon death never reaches interiorOverlay.
  assert.match(WM, /if \(mode === 'dungeon'\) cam\.pos\[1\] -= dungeonCtx\?\.deathDrop \?\? 0;/,
    'PlayerDeath.Update lowers the eye whatever host is standing');
  assert.match(WM, /if \(interiorOverlay instanceof DeathScreen\) cam\.pos\[1\] -= interiorOverlay\.drop;/,
    'the building arm keeps its own write');
  // the comment that asserted the opposite is retired where it stood
  assert.ok(!WM.includes('Both modal modes route\n    // death to interiorOverlay'),
    'the false claim is deleted');
  // ORDER: both sink writes follow the per-frame eye write
  const sink = WM.indexOf("if (mode === 'dungeon') cam.pos[1] -= dungeonCtx?.deathDrop ?? 0;");
  const eye = WM.lastIndexOf('cam.pos = player.eyeAt();', sink);
  assert.ok(eye !== -1 && sink - eye < 900, 'the sink rides after the eye write, or the eye write undoes it');
});

// ---------------------------------------------------------------
// #39 - the interior foe pool gets its spells
// ---------------------------------------------------------------

test('AUDIT39 #39: an interior foe carries its spell lists and its caster, as SetEnemyCareer gives them', () => {
  const mount = WM.slice(WM.indexOf('function makeInteriorFoes(ctx) {'));
  const body = mount.slice(0, mount.indexOf('\n  }'));
  assert.match(body, /\n\s+spellsByIndex,/, 'SetEnemySpells has no scene test in DFU');
  assert.match(body, /magicHooks: magic \? \{/, 'and the release seams ride the host\'s ONE engine');
  assert.match(body, /explodeAt: \(\.\.\.a\) => magic\.explodeAt\(\.\.\.a\),/);
  assert.match(body, /magic\.fireEnemyMissile\(from, \[d\[0\] \/ l, d\[1\] \/ l, d\[2\] \/ l\], spell, casterLevel, foe\);/,
    'aimed at the walking player\'s mid-capsule at fire time, the exterior shape');
});

// ---------------------------------------------------------------
// #64 / #65 - the arrow that LANDS
// ---------------------------------------------------------------

test('AUDIT39 #64: a PLAYER arrow now hunts the foe list, through its own impact seam', () => {
  const f = new ArrowFlight({ getGpuMesh: () => null, collider: null });
  f.fire([0, 0.9, 0], [0, 0, 1], { fromPlayer: true, weapon: { name: 'Long Bow' } });
  const hits = [];
  f.update(0.05, {
    foeTargets: [{ feet: [0, 0, 1.5], ref: { id: 'bear' } }],
    onFoeHit: () => hits.push('ENEMY ARM'),
    onPlayerArrowHitFoe: (m, t) => hits.push([m.weapon.name, t.id]),
  });
  assert.deepEqual(hits, [['Long Bow', 'bear']], 'the shooter decides the arm, not a flag on one side of it');
  assert.equal(f.arrows[0].dead, true, 'the landed arrow is spent');
});

test('AUDIT39 #64: a player arrow still cannot hit the PLAYER, and an unmarked shaft lands nothing', () => {
  const f = new ArrowFlight({ getGpuMesh: () => null, collider: null });
  f.fire([0, 0.9, 0], [0, 0, 1], { fromPlayer: true, weapon: {} });
  f.fire([0, 0.9, 0], [0, 0, 1], {});   // neither marker
  const log = [];
  f.update(0.05, {
    playerFeet: [0, 0, 1.5],
    onPlayerHit: () => log.push('player'),
    foeTargets: [{ feet: [0, 0, 1.5], ref: { id: 'bear' } }],
    onFoeHit: () => log.push('enemyArm'),
    onPlayerArrowHitFoe: () => log.push('playerArm'),
  });
  assert.deepEqual(log, ['playerArm'], 'the player arm is the only one a player shaft can take');
});

test('AUDIT39 #64: the impact recovers the arrow whatever the damage, and never writes health itself', () => {
  // A too-low weapon material is CalculateAttackDamage's deterministic
  // zero (FormulaHelper.cs:576-583), so this exercises BowDamage's
  // recoverable-arrow line without rolling dice.
  const foe = { entity: { minMetalToHit: 5, items: [] }, ai: { feet: [0, 0, 0], yaw: 0 } };
  const dealt = [];
  const said = [];
  const dmg = playerArrowHitFoe(
    { weapon: { material: 0 }, pos: [0, 1, 0], dir: [0, 0, 1] }, foe,
    { playerEntity: { isPlayer: true }, playerFeet: [0, 0, -1], dealDamage: (f, d) => dealt.push(d), say: (l) => said.push(l) });
  assert.equal(dmg, 0);
  assert.deepEqual(dealt, [], 'no damage, no door - the pool owns the death chain');
  assert.equal(foe.entity.items.length, 1, 'the arrow is recoverable from the TARGET, damage or not');
  assert.equal(foe.entity.items[0].templateIndex, 131);
  assert.ok(said.length, 'and the player is told the material was ineffective');
  // a dead foe is no target
  assert.equal(playerArrowHitFoe({ pos: [0, 0, 0], dir: [0, 0, 1] }, { dead: true }, {}), 0);
});

test('AUDIT39 #64: all three non-dungeon hosts mark the shaft and resolve it', () => {
  for (const [f, fire] of [
    ['src/scenes/world.js', 'arrows.fire(cam.pos, fwd, { fromPlayer: true, weapon: weaponRig.playerWeapon.weapon })'],
    ['src/scenes/exterior.js', 'arrows.fire(eye, fwd, { fromPlayer: true, weapon: weaponRig.playerWeapon.weapon })'],
    ['src/scenes/worldModes.js', 'interiorArrows.fire(player.eye, eyeDir(), { fromPlayer: true, weapon: interiorWeapon.playerWeapon.weapon })'],
  ]) {
    const s = src(f);
    assert.ok(s.includes(fire), `${f} rides LastBowUsed on the shaft`);
    assert.match(s, /onPlayerArrowHitFoe: \(m, t\) => playerArrowHitFoe\(m, t, \{/, `${f} resolves it`);
    assert.match(s, /foeTargets:/, `${f} hands the flight its live targets`);
  }
  // the module's stale premise is retired where it stood - the header
  // quotes it to say why, which is the record working, not the claim
  // surviving (the module used to state it as its own law)
  const af = src('src/combat/arrowFlight.js');
  assert.match(af, /retires the premise this module was written on/);
  assert.ok(!af.includes('out here there are no live targets yet, and DFU'),
    'the premise no longer stands as the module\'s own sentence');
});

test('AUDIT39 #65: the interior arrow update takes the four impact options it never had', () => {
  const call = WM.slice(WM.indexOf('interiorArrows.update(dt, {'), WM.indexOf('interiorArrows.draw('));
  assert.ok(!WM.includes('interiorArrows.update(dt);'), 'the bare geometry call is gone');
  assert.match(call, /playerFeet: player\.pos,/);
  assert.match(call, /onPlayerHit: \(m\) => \{/);
  assert.match(call, /foeTargets: \(interiorFoes\?\.foes \?\? \[\]\)/);
  assert.match(call, /onFoeHit: \(m, t\) => interiorFoes\?\.arrowHitFoe\(m, t\),/);
  // the player-side arm of the same call
  assert.match(call, /onPlayerArrowHitFoe: \(m, t\) => playerArrowHitFoe\(m, t, \{/);
  // the enemy hit runs the melee arm's own payload: pain voice, sound,
  // the recoverable arrow
  assert.match(call, /playPlayerVoice\(audio, playerPainVoice\(playerEntity, dmg\)\);/);
  assert.match(call, /addItem\(playerEntity\.items, \{ group: 'Weapons', name: 'Arrow', templateIndex: 131/);
});

// ---------------------------------------------------------------
// #108 - StartNewConversation on the static-NPC door
// ---------------------------------------------------------------

test('AUDIT39 #108: both static-NPC doors spend the window\'s OnPush reset', () => {
  // DaggerfallTalkWindow.OnPush -> SetStartConversation (:266) ->
  // TalkManager.StartNewConversation (:654), on EVERY push. TalkToNpc
  // is a different member and the engine runs only that one.
  assert.equal((WM.match(/npcSession\?\.startNewConversation\(\);/g) || []).length, 2,
    'the click door and the guild/coven popup door');
  for (const opener of ['townTalk.openTalkWindow(talk.greeting', 'townTalk.openTalkWindow(talk2.greeting']) {
    const at = WM.indexOf(opener);
    assert.ok(at > 0, opener);
    const before = WM.lastIndexOf('npcSession?.startNewConversation();', at);
    assert.ok(before !== -1 && at - before < 700, `${opener} is pushed with the reset spent`);
  }
});

// ---------------------------------------------------------------
// #132 - the interior HUD is told the pointer is free
// ---------------------------------------------------------------

test('AUDIT39 #132: the interior drawHud passes cursorActive, the value the frame already computed', () => {
  const call = WM.slice(WM.indexOf('drawHud(renderer, canvas, hudArt, playerEntity,'));
  const opts = call.slice(0, call.indexOf('weaponSheathed:'));
  assert.match(opts, /cursorActive: overlayHeld,/,
    'hud.js defaults it FALSE, so the strip, the crosshair and the vitals detector all ran under a window');
});

// ---------------------------------------------------------------
// #164 - a deferred building entry is not a crash
// ---------------------------------------------------------------

test('AUDIT39 #164: the greeting-deferred entry catches, like the two host call sites', () => {
  assert.match(WM, /new ChoiceWindow\(\{ lines \}\), \(\) => \{ enterInteriorCore\(hit, entries\)\.catch\(\(e\) => console\.error\(e\)\); \}\)/,
    'a refused interior is recoverable - it must not reach main.js\'s unhandledrejection overlay');
  // the throw the catch exists for is still the design
  assert.match(WM, /throw new Error\('no interior landing'\)/);
});

// ---------------------------------------------------------------
// AUDIT 39r (R16) - #64's header claimed the missile's own position
// was DFU's impactPosition, "the one place these hosts hold the real
// hit point rather than the body centre", and splashed at the arrow
// tip on that reading. AssignBowDamageToTarget passes
// `hitTransform.position` (DaggerfallMissile.cs:679-687) - the struck
// entity's transform origin; only the MELEE callers pass a contact
// point (WeaponManager.cs:1054 ClosestPoint, :1068 hit.point), and
// WeaponManager.cs:568-571 hands whichever it got to ShowBloodSplash.
// ---------------------------------------------------------------

test('AUDIT39r R16: a player arrow bleeds its TARGET, not its own tip', () => {
  const foe = {
    entity: { isPlayer: false, level: 1, skills: 0, stats: { agility: 0, luck: 0 }, armor: 0, items: [], basics: { bloodIndex: 2 } },
    ai: { feet: [3, 0, 4], yaw: 0, height: 1.8 },
  };
  const splashes = [];
  const dmg = playerArrowHitFoe(
    { weapon: null, pos: [0, 1, 0], dir: [0, 0, 1] }, foe,
    {
      playerEntity: { isPlayer: true, level: 20, skills: 100, stats: { strength: 100, agility: 100, luck: 100 } },
      playerFeet: [0, 0, -1], dealDamage: () => {}, rolls: () => 0.5,
      hitEffects: { showBloodSplash: (i, p) => splashes.push([i, p]) },
    });
  assert.ok(dmg > 0, 'the shot landed');
  assert.equal(splashes.length, 1);
  assert.equal(splashes[0][0], 2, 'MobileEnemy.BloodIndex');
  assert.deepEqual(splashes[0][1], [3, 0, 4], 'hitTransform.position - the target\'s own origin');
  // the stale gloss is gone from the header with the code
  const af = src('src/combat/arrowFlight.js');
  assert.ok(!af.includes('The missile\'s\n * own position is DFU\'s impactPosition'),
    'the mis-citation no longer stands as this module\'s law');
  assert.match(af, /hitTransform\.position/, 'and the real fifth argument is named');
});
