// AUDIT DISC28 (2026-09-28, before the merge), lane "arrest": DISC28-B (a surrender box never outlives its crime) and
// DISC28-D (the first-person swing reads the live Speed) read again on the batch merged with main.
//
// - AR-1: a LOAD carried the old game's arrest into the loaded one. DFU never loads under the court (InputManager.Update
//   returns before any action while a window pauses the game, QuickLoad excepted only while PlayerDeath.DeathInProgress);
//   the port's F11 loads from under any window (world.js's FIX-E arm), and worldQuickLoad told the arrest flow nothing.
//   Under the plea box the trial rode into the loaded game - `arrested` stood, the old sentence was served on the loaded
//   clock and its release cleared the loaded save's own crime; under the surrender box the loaded character was asked
//   the departed guard's question, and N landed that guard's blow on them. `arrestFlow.abandon()` ends both the way
//   DaggerfallCourtWindow.OnPop ends a trial (Arrested and InPrison false, the court's windows closed) and runs nothing
//   of ReleaseFromPrison; a withdrawn question, and a trial no longer standing, act on nothing that reaches them late.
// - AR-2: the third-person body asked GetMeleeWeaponAnimTime with the Speed alone, where Eye of the Beholder's
//   GetMeleeAnimTickTime hands it the PlayerEntity and the ScreenWeapon's type and hands - so under the boot's default
//   mods (Roleplay & Realism: Items' weaponBalance) the sprite swung on DFU's line while the blow landed on the
//   override's, and one blow played two swings.
// - AR-3: the surrender box's N re-reads the crime ("N lands no departed guard's blow") - pinned; nothing held it.
// - AR-4: the rig's live Speed, pinned on the REAL rig (DISC28-D pinned the rig's reader by its source text).
//
// Real modules throughout: the arrest flow, townTalk (its frame drains, over a synthesized FONT0003 so the font-less
// drop never fires), save.js's snapshot and restore, the weapon rig, the Eye of the Beholder body through the view
// seam, and the two Roleplay & Realism installs the boot makes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createArrestFlow } from '../../src/scenes/arrestFlow.js';
import { createTownTalk } from '../../src/scenes/townTalk.js';
import { CRIMES, setCrimeCommitted } from '../../src/systems/court.js';
import { hurtPlayer, playerDamageWithheld } from '../../src/characters/playerEntity.js';
import { snapshotPlayer, restorePlayer } from '../../src/systems/save/save.js';
import { PrisonScreenWindow } from '../../src/ui/prisonScreen.js';
import { ChoiceWindow } from '../../src/ui/talkWindow.js';
import { createWeaponRig } from '../../src/combat/weapon/weaponRig.js';
import { machineAttack, getMeleeWeaponAnimTime } from '../../src/characters/weaponStates.js';
import { EQUIP_SLOTS, equipTableOf } from '../../src/systems/equip.js';
import { mintCondition, setItemFields } from '../../src/systems/item/itemTemplates.js';
import { WEAPONS } from '../../src/characters/weapons.js';
import { SKILL_COUNT } from '../../src/systems/skills.js';
import { setModSetting, _resetModSettings } from '../../src/systems/modSettings.js';
import { installRoleplayRealismItems } from '../../src/systems/roleplayRealismItems/rriInstall.js';
import { installRoleplayRealism } from '../../src/systems/roleplayRealism/rrInstall.js';
import { eotbBody } from '../../src/player/eyeOfTheBeholder/eotbBody.js';
import { eotbCamera } from '../../src/player/eyeOfTheBeholder/eotbCamera.js';
import { STRING } from '../../src/player/eyeOfTheBeholder/eotbBillboard.js';
import { mwViewFrame, setEotbBodyReady, setEotbPlayerState, eotbLane } from '../../src/player/mwView.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

// ── THE TALK HOST, as a host has it ─────────────────────────────────────────────────────────────────────────────────
/** FONT0003's shape (FntFile: a 4-byte header, 240 glyph entries, one 32-byte glyph they all share). */
function fnt() {
  const head = 4 + 240 * 4, bytes = new Uint8Array(head + 32);
  const v = new DataView(bytes.buffer);
  v.setUint16(0, 8, true); v.setUint16(2, 8, true);
  for (let i = 0; i < 240; i++) { v.setUint16(4 + i * 4, head, true); v.setUint16(6 + i * 4, 4, true); }
  return bytes;
}
async function talkHost(playerEntity) {
  const tt = createTownTalk({
    renderer: { uploadTexture: () => ({}), drawScreenQuad: () => {} },
    canvas: { width: 640, height: 400, getBoundingClientRect: () => ({ left: 0, top: 0, width: 640, height: 400 }) },
    fetchBytes: async (name) => { if (name === 'FONT0003.FNT') return fnt(); throw new Error(`no ARENA2 in this pin (${name})`); },
    playerEntity, regionIndex: 17,
  });
  const warn = console.warn; console.warn = () => {};
  try { await tt.ensureLoaded(); } finally { console.warn = warn; }
  return tt;
}
const key = (code) => ({ code, key: code.slice(-1).toLowerCase(), repeat: false, preventDefault() {}, stopPropagation() {}, target: null });
const frames = (tt, n, dt = 1 / 60) => { for (let i = 0; i < n; i++) tt.frame(dt); };

// ── THE PLAYER, and the saves a load reads ──────────────────────────────────────────────────────────────────────────
/** A defendant with no gold (the whole penalty is days) and a legal reputation above 0 (SurrenderToCityGuards: a
 *  forced surrender always goes to court), so the trial is deterministic with the court's dice high. */
const mkPlayer = () => ({
  isPlayer: true, name: 'Mack', health: 30, maxHealth: 40, fatigue: 50, magicka: 0, maxMagicka: 20,
  stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 },
  legalRep: { 17: 5 }, items: [], activeEffects: [], skills: 30, skillUses: new Array(SKILL_COUNT).fill(0),
  crimeCommitted: 0, haveShownSurrenderDialogue: false, arrested: false, inPrison: false,
});
/** The save the load reads: this character, taken while wanted for Theft. */
function wantedSave(player) {
  const was = player.crimeCommitted;
  player.crimeCommitted = CRIMES.Theft;
  const snap = JSON.parse(JSON.stringify(snapshotPlayer(player)));
  player.crimeCommitted = was;
  return snap;
}
/** The flow with every one of ReleaseFromPrison's world doors counted. */
function mkFlow(townTalk, player) {
  const world = { minutes: 0, days: 0, repositions: 0, clears: 0 };
  const flow = createArrestFlow({
    townTalk, playerEntity: player, regionIndex: 17, rolls: () => 0.99, guildRankOf: () => null,
    advanceDays: (d) => { world.days += d; }, advanceMinutes: (m) => { world.minutes += m; },
    positionPlayerAtLocationEntrance: () => { world.repositions++; }, clearEnemies: () => { world.clears++; },
  });
  return { flow, world };
}
/** worldQuickLoad's own two acts on the arrest: the save read over the SAME entity, then the flow told. (A flow
 *  that offers no `abandon` is told nothing - the tree before AR-1 - and the pins below say what that costs.) */
function load(player, flow, snap) {
  assert.ok(restorePlayer(player, snap), 'the save reads');
  flow.abandon?.();
}

// ── AR-1 ────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT DISC28 AR-1: a load under the plea box ends the trial as DaggerfallCourtWindow.OnPop does - no arrest, no court left up, nothing of ReleaseFromPrison', async () => {
  const player = mkPlayer();
  const save = wantedSave(player);
  player.crimeCommitted = CRIMES.Assault; player.haveShownSurrenderDialogue = true;
  const tt = await talkHost(player);
  const { flow, world } = mkFlow(tt, player);
  try {
    assert.equal(flow.onGuardHit(99, () => assert.fail('the forced surrender takes the blow')), true);
    assert.equal(player.arrested, true, 'the trial is up');
    assert.ok(tt.overlay instanceof ChoiceWindow, 'the plea box, over the courtroom');
    assert.equal(tt.overlayActive, true, 'a pausing window: the host\'s F11 arm takes its load from under it');
    load(player, flow, save);
    // a key that reaches the plea box before the frame drains it acts on no trial
    tt.keydown(key('KeyG'), new Set());
    frames(tt, 6);
    assert.equal(player.arrested, false, 'OnPop: Arrested false - the loaded game carries no trial');
    assert.equal(player.inPrison, false, 'OnPop: InPrison false');
    assert.equal(tt.overlay, null, 'the plea box and the courtroom are down');
    assert.equal(playerDamageWithheld(), false, 'and the trial\'s veto with them');
    assert.equal(flow.inCourt(), false);
    assert.equal(player.crimeCommitted, CRIMES.Theft, 'the loaded save\'s own crime stands - ReleaseFromPrison clears nothing');
    assert.deepEqual(world, { minutes: 0, days: 0, repositions: 0, clears: 0 }, 'no RaiseTime, no sentence served, no reposition, no ClearEnemies');
  } finally { flow.dispose(); }
});

test('AUDIT DISC28 AR-1: a load during the prison countdown - the countdown never ends on the loaded game, and its release never runs', async () => {
  const player = mkPlayer();
  const save = wantedSave(player);
  player.crimeCommitted = CRIMES.Assault; player.haveShownSurrenderDialogue = true;
  const tt = await talkHost(player);
  const { flow, world } = mkFlow(tt, player);
  try {
    flow.onGuardHit(99, () => {});
    tt.keydown(key('KeyG'), new Set());   // guilty: state 3, the prison screen
    const prison = tt.overlay;
    assert.ok(prison instanceof PrisonScreenWindow, 'serving the sentence');
    assert.equal(player.inPrison, true);
    frames(tt, 20, 0.1);                  // a few of the days pass
    assert.equal(prison.served, false, 'still serving');
    load(player, flow, save);
    frames(tt, 400, 0.1);                 // far past the whole term
    assert.equal(prison.served, false, 'UpdatePrisonScreen\'s zero arm never ran on the loaded game');
    assert.equal(player.inPrison, false, 'OnPop: InPrison false');
    assert.equal(player.arrested, false, 'OnPop: Arrested false');
    assert.equal(tt.overlay, null, 'the prison screen and the courtroom are down');
    assert.equal(player.crimeCommitted, CRIMES.Theft, 'the loaded save\'s crime stands');
    assert.deepEqual(world, { minutes: 0, days: 0, repositions: 0, clears: 0 }, 'no days served, no four hours, no reposition, no ClearEnemies');
  } finally { flow.dispose(); }
});

test('AUDIT DISC28 AR-1: a load under the surrender box withdraws the question - and a Y or an N that reaches the box before it drains answers nothing', async () => {
  for (const answer of ['KeyY', 'KeyN']) {
    const player = mkPlayer();
    const save = wantedSave(player);
    player.crimeCommitted = CRIMES.Assault;
    const tt = await talkHost(player);
    const { flow } = mkFlow(tt, player);
    try {
      let landed = 0;
      assert.equal(flow.onGuardHit(6, () => { landed++; hurtPlayer(player, 6); }), true, 'the question');
      const box = tt.overlay;
      load(player, flow, save);
      assert.equal(playerDamageWithheld(), false, `${answer}: the question no longer shields anyone`);
      tt.keydown(key(answer), new Set());   // the key lands on the withdrawn box, ahead of the frame's drain
      frames(tt, 3);
      assert.equal(box.done, true);
      assert.equal(tt.overlay, null, `${answer}: the box is down`);
      assert.equal(landed, 0, `${answer}: the departed guard's blow never lands on the loaded character`);
      assert.equal(player.arrested, false, `${answer}: no surrender of a character the box never asked`);
      assert.equal(player.health, 30, `${answer}: and no surrender's forced 1 health`);
    } finally { flow.dispose(); }
  }
});

test('AUDIT DISC28 AR-1: every load door of the world host reaches the one that tells the flow - worldQuickLoad, after the restore and before the teleport', () => {
  const world = read('src/scenes/world.js');
  const body = world.slice(world.indexOf('async function worldQuickLoad'), world.indexOf('function applyPose'));
  const restore = body.indexOf('const extras = restorePlayer(playerEntity, snap, spellsByIndex);');
  const abandon = body.indexOf('arrestFlow.abandon();');
  const teleport = body.indexOf('await _teleportToPixel');
  assert.ok(restore > 0 && abandon > restore && teleport > abandon, 'the save is read, THEN the flow is told, before the world is rebuilt');
  assert.ok(!/arrestFlow\.abandon\(\);[\s\S]*arrestFlow\.abandon\(\);/.test(body), 'once');
  // the building's route (worldModes: the pause, the keys, the dungeon's hand-up) and this host's own doors are all it
  for (const door of [/quickLoad: \(\) => worldQuickLoad\(\),/, /loadKey: \(key\) => worldQuickLoad\(\{ key \}\),/, /loadSave: \(key\) => worldQuickLoad\(key != null \? \{ key \} : \{\}\),/, /quickLoad: worldQuickLoad,/]) {
    assert.match(world, door);
  }
  const modes = read('src/scenes/worldModes.js');
  assert.match(modes, /quickLoad: host\.quickLoad,/, 'the building\'s pause door is the host\'s load');
  assert.match(modes, /quickLoad\(\) \{ host\.quickLoad\?\.\(\); \}/, 'and its keys');
  assert.match(modes, /worldLoad: host\.loadSave \?/, 'and a dungeon save from another place is handed up to it');
});

// ── AR-3 ────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT DISC28 AR-3: N to a question whose crime has gone lands no blow - the answer re-reads the crime', async () => {
  const player = mkPlayer();
  player.crimeCommitted = CRIMES.Assault;
  const tt = await talkHost(player);
  const { flow } = mkFlow(tt, player);
  try {
    let landed = 0;
    flow.onGuardHit(6, () => { landed++; });
    assert.equal(tt.overlay?.options?.[1]?.code, 'KeyN');
    setCrimeCommitted(player, CRIMES.None);   // a clearer that did not withdraw the question
    tt.keydown(key('KeyN'), new Set());
    assert.equal(landed, 0, 'the guard\'s blow is not delivered for a crime that is no longer there');
    assert.equal(tt.overlay, null, 'the answer closed the box');
    assert.equal(flow.inCourt(), false);
  } finally { flow.dispose(); }
});

// ── THE REAL RIG ────────────────────────────────────────────────────────────────────────────────────────────────────

const DT = 1 / 60;
/** A drawn weapon on the real rig over this entity; the swing is started on the rig's own machine and stepped by the
 *  rig's own frame, as the host steps it. */
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
  assert.equal(rig.playerWeapon.weapon, weapon, 'the rig holds the worn weapon');
  return rig;
}
const swingEntity = (stats) => ({
  isPlayer: true, health: 40, maxHealth: 40, activeEffects: [], items: [],
  stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50, ...stats },
});

// ── AR-4 ────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT DISC28 AR-4: the real rig swings on the entity\'s LIVE Speed - a Fortify Speed cast between two swings times the second', () => {
  _resetModSettings();
  // the port's own swing law (SWING-LAW): neither Roleplay & Realism override answers (both are off here, whatever this
  // process installed)
  setModSetting('roleplay-realism-items', 'weaponBalance', false);
  setModSetting('roleplay-realism', 'weaponSpeed', false);
  try {
    const entity = swingEntity({ speed: 50 });
    const rig = rigWith(entity, WEAPONS.Saber);
    const swing = () => {
      assert.ok(machineAttack(rig.playerWeapon.machine, 'StrikeDown'), 'a swing starts');
      let t = 0;
      while (rig.playerWeapon.machine.state !== 'Idle' && t < 10) { rig.frame(DT); t += DT; }
      return t;
    };
    // five frames a swing, each GetMeleeWeaponAnimTime's tick for the rig's own wielder (SWING-LAW: its ctx - the law reads
    // the weapon in the hand), a coroutine's resume apiece (the remainder dropped)
    const tick = (speed) => getMeleeWeaponAnimTime(speed, rig.playerWeapon.animCtx());
    const near = (got, speed) => Math.abs(got - 5 * tick(speed)) <= 5 * DT;
    const at50 = swing();
    assert.ok(near(at50, 50), `Speed 50: ${at50.toFixed(3)}s against ${(5 * tick(50)).toFixed(3)}s`);
    entity.activeEffects.push({ kind: 'fortifyAttribute', stat: 'speed', magnitude: 50 });   // the live stat, 100
    const at100 = swing();
    assert.ok(near(at100, 100), `Fortified to 100: ${at100.toFixed(3)}s against ${(5 * tick(100)).toFixed(3)}s - the rig asked the entity, not the number it was built with`);
    assert.ok(at100 < at50, 'the Speed shows in the swing');
    entity.activeEffects.length = 0;
    const again = swing();
    assert.ok(near(again, 50), 'and the spell over, the next swing is Speed 50\'s again');
  } finally { _resetModSettings(); }
});

// ── AR-2 ────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT DISC28 AR-2: under the boot\'s default mods the third-person body plays ONE swing per first-person blow, on the blow\'s own clock', async () => {
  _resetModSettings();
  installRoleplayRealismItems({ fetchBytes: async () => { throw new Error('no art in this pin'); } });   // the boot's two installs (scenes/shared.js)
  installRoleplayRealism();
  setModSetting('eye-of-the-beholder', 'Graphics.AttackStrings', STRING.None);
  const entity = swingEntity({ speed: 80, strength: 30 });
  const rig = rigWith(entity, WEAPONS.Claymore);
  try {
    const live = 80;
    const ctx = rig.playerWeapon.animCtx();
    const blowTick = getMeleeWeaponAnimTime(live, ctx);
    assert.notEqual(blowTick, getMeleeWeaponAnimTime(live), 'the defaults register an override that answers for this weapon (Items\' weaponBalance) - the case at issue');
    // the view seam, the lane open, the body active (third person): the rig's own state reaches the body each frame
    setEotbBodyReady(() => true);
    eotbCamera.toggleOffset(true);
    assert.equal(eotbLane(), true, 'the Eye of the Beholder lane has the frame');
    const view = { fpEye: [0, 1.6, 0], feet: [0, 0, 0], yaw: 0, pitch: 0, dt: DT };
    for (let i = 0; i < 12; i++) { rig.frame(DT); mwViewFrame(view); }
    assert.ok(machineAttack(rig.playerWeapon.machine, 'StrikeDown'), 'the blow starts');
    let blow = 0, clips = 0, prev = -1, span = 0;
    while (rig.playerWeapon.machine.state !== 'Idle' && blow < 10) {
      rig.frame(DT); mwViewFrame(view); blow += DT;
      const c = eotbBody.state().clip;
      const i = c && c.table === 'AttackMelee' ? c.i : -1;
      if (i >= 0 && (prev < 0 || i < prev)) { clips++; span = c.interval * c.frames.length; }
      prev = i;
    }
    assert.equal(clips, 1, `one blow of ${blow.toFixed(3)}s played ${clips} third-person swings`);
    assert.ok(Math.abs(span - 5 * blowTick) < 1e-9, `the sprite's swing spans ${span.toFixed(3)}s, the blow's five ticks are ${(5 * blowTick).toFixed(3)}s - GetMeleeAnimTickTime asks the weapon's own clock`);
  } finally {
    setEotbBodyReady(null); setEotbPlayerState(null); eotbCamera.toggleOffset(false); eotbBody.attach(null, null);
    _resetModSettings();
  }
});
