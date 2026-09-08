// AUDIT 64 - THE AUDIO LANE. Six laws the port had silent, quiet or
// rebased, each pinned against the line of Daggerfall Unity it restores:
//
//   F40  the dungeon damage trap's pain cry   (DaggerfallAction.cs:739/:768
//                                              -> PlayerFootsteps.cs:348-364)
//   F41  the video's music/ambient mute       (DaggerfallVidPlayerWindow.cs
//                                              :93/:112/:134/:150 ->
//                                              DaggerfallSongPlayer.cs:356-369,
//                                              AmbientEffectsPlayer.cs:536-554)
//   F43  the use-magic-item pick's ButtonClick (DaggerfallUseMagicItemWindow.cs:125)
//   F44  the classic load window's clicks      (DaggerfallLoadClassicGameWindow.cs
//                                              :213-217, :219-223, :225-230)
//   F45  the foe-vs-foe PARRY volume           (EnemySounds.cs:139 vs :143-156)
//   F46  the footstep stride anchor            (PlayerFootsteps.cs:221-225,
//                                              :232-238, :264-265)
//
// Where a checkout of the reference is reachable the pin READS it, so the
// value being held is DFU's own and not a remembered literal.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { dfuFile, missingDfu } from './dfuRoot.mjs';
import { audio } from '../src/systems/audio.js';
import { SOUND } from '../src/systems/soundClips.js';
import { music, MusicService } from '../src/systems/music.js';
import {
  musicGain, trackGain, setMusicMuted, SongPlayer, AudioSongPlayer,
} from '../src/systems/songPlayer.js';
import {
  AmbientEffects, AMBIENT_RAIN_LOOP, muteAmbientForVideo, unmuteAmbientForVideo,
} from '../src/systems/ambientEffects.js';
import { createUseMagicItemWindow } from '../src/ui/useMagicItemWindow.js';
import { LoadClassicWindow } from '../src/ui/loadClassicWindow.js';
import { applyDamageToNonPlayer, PARRY_VOLUME, PARRY_1 } from '../src/scenes/hostCombat.js';
import { EnemyAI } from '../src/characters/enemyMotor.js';
import { FootstepMachine, FOOTSTEP, WALK_STEP_INTERVAL, FOOTSTEP_VOLUME } from '../src/systems/footsteps.js';
import { TEMPLATES } from '../src/systems/useItem.js';
import { playVideo } from '../src/ui/videoPlayer.js';
import { VID_BLOCK_TYPES as T } from '../src/formats/vidFile.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(root, p), 'utf8');
const dfu = (rel) => readFileSync(dfuFile(`Assets/Scripts/${rel}`), 'utf8').split('\n');

/** One clip recorder over the shared UI sink, restored on the way out. */
function withAudioSink(fn) {
  const heard = [];
  const real = audio.playOneShot;
  audio.playOneShot = (index, volume = 1) => { heard.push([index, volume]); return 0.1; };
  try { fn(heard); } finally { audio.playOneShot = real; }
  return heard;
}

// ---------------------------------------------------------------------------
// F40 - the damage trap cries out
// ---------------------------------------------------------------------------

test('AUDIT 64 F40: RemoveHealth has THREE senders, and the trap\'s two reach the pain cry', { skip: missingDfu('Assets/Scripts/Internal/DaggerfallAction.cs', 'Assets/Scripts/Game/PlayerFootsteps.cs') }, () => {
  // The reference's own value: DaggerfallAction SENDS the message, so
  // Unity's SendMessage reaches every component on PlayerObject - the
  // flash (PlayerHealth) and the 40% cry (PlayerFootsteps) alike.
  const act = dfu('Internal/DaggerfallAction.cs');
  assert.match(act[738], /playerObject\.SendMessage\("RemoveHealth", damage\);/,
    'DaggerfallAction.cs:739 - DrainHealth21 (action flag 21)');
  assert.match(act[767], /playerObject\.SendMessage\("RemoveHealth", damage\);/,
    'DaggerfallAction.cs:768 - DrainHealth (action flags 22-25)');
  const pf = dfu('Game/PlayerFootsteps.cs');
  assert.match(pf[347], /public void RemoveHealth\(int amount\)/,
    'PlayerFootsteps.cs:348 - the receiver the trap path had no caller for');
  assert.match(pf.slice(347, 364).join('\n'), /Dice100\.SuccessRoll\(40\)/,
    'and its body is the 40% roll');
  // A fall is the ONE damaging path that stays silent, because
  // PlayerHealth calls its own RemoveHealth in C# rather than sending it.
  const ph = dfu('Game/PlayerHealth.cs');
  assert.match(ph[56], /^\s*RemoveHealth\(damage\);\s*$/,
    'PlayerHealth.cs:57 - ApplyPlayerFallDamage\'s DIRECT call, which PlayerFootsteps never hears');
});

test('AUDIT 64 F40: the dungeon host\'s damagePlayer sink bills the health AND cries', () => {
  const dc = rd('src/scenes/dungeonContext.js');
  const sink = dc.slice(dc.indexOf('damagePlayer:'), dc.indexOf('castSpell:'));
  assert.match(sink, /hurtPlayer\(dmg\)/, 'the trap still bills the health');
  assert.match(sink, /playPlayerVoice\(audio, playerPainVoice\(playerEntity, dmg\)\)/,
    'and it CRIES - DaggerfallAction.cs:739/:768 send exactly the message EnemyAttack.cs:406 sends');
  // ...and the fall, which shares hurtPlayer, must NOT have gained one.
  const hp = dc.slice(dc.indexOf('function hurtPlayer(dmg)'));
  assert.doesNotMatch(hp.slice(0, hp.indexOf('\n  }')), /playerPainVoice/,
    'the cry is on the SINK, not inside hurtPlayer - a fall flashes and stays silent (PlayerHealth.cs:57)');
});

// ---------------------------------------------------------------------------
// F41 - a VID mutes the music and stops the ambient loops
// ---------------------------------------------------------------------------

test('AUDIT 64 F41: the reference mutes the SONG PLAYER and the AMBIENT PLAYER for a video\'s lifetime', { skip: missingDfu('Assets/Scripts/Internal/DaggerfallSongPlayer.cs', 'Assets/Scripts/Game/AmbientEffectsPlayer.cs', 'Assets/Scripts/Game/UserInterfaceWindows/DaggerfallVidPlayerWindow.cs') }, () => {
  const vid = dfu('Game/UserInterfaceWindows/DaggerfallVidPlayerWindow.cs');
  assert.match(vid[92], /RaiseOnVideoStartGlobalEvent\(\);/, ':93 - the custom-video arm');
  assert.match(vid[111], /RaiseOnVideoStartGlobalEvent\(\);/, ':112 - raised AFTER video.Open/Playing');
  assert.match(vid[110], /video\.Playing = true;/, 'and :111 is the open that precedes it');
  assert.match(vid[133], /RaiseOnVideoEndGlobalEvent\(\);/, ':134 - the any-key/back close');
  assert.match(vid[149], /RaiseOnVideoEndGlobalEvent\(\);/, ':150 - the end-of-file close');

  const sp = dfu('Internal/DaggerfallSongPlayer.cs');
  assert.match(sp[75], /DaggerfallVidPlayerWindow\.OnVideoStart \+=/, ':76 subscribes the start');
  assert.match(sp[76], /DaggerfallVidPlayerWindow\.OnVideoEnd \+=/, ':77 subscribes the end');
  assert.match(sp.slice(355, 362).join('\n'), /Gain = 0;[\s\S]*IsMuted = true;/, ':356-362 - GAIN to zero');
  assert.match(sp.slice(363, 369).join('\n'), /Gain = oldGain;[\s\S]*IsMuted = false;/, ':364-369 - restored');
  assert.match(sp[105], /audioSource\.volume = IsMuted \? 0f : DaggerfallUnity\.Settings\.MusicVolume;/,
    ':106 - re-asserted EVERY Update, which is why the port reads the flag inside the gain accessors');

  const ae = dfu('Game/AmbientEffectsPlayer.cs');
  assert.match(ae[91], /OnVideoStart \+=/, ':92 subscribes');
  assert.match(ae.slice(535, 549).join('\n'),
    /rainLoop = null;[\s\S]*cricketsLoop = null;[\s\S]*loopAudioSource\.Stop\(\);[\s\S]*IsMuted = true;/,
    ':536-548 - both handles nulled and the loop source stopped');
  assert.match(ae[552], /IsMuted = false;/, ':553 - the end handler clears the flag and nothing else');
  assert.match(ae.slice(107, 111).join('\n'), /void Update\(\)\s*\{\s*if \(IsMuted\)\s*return;/,
    ':108-110 - IsMuted is Update\'s FIRST statement, so nothing restarts while muted');
});

/** An AudioContext whose gain params really carry a value, so the level
 *  a LIVE player is sitting at can be read back after a mute. */
function gainCtx() {
  const param = () => ({
    value: 0,
    setValueAtTime(v) { this.value = v; },
    linearRampToValueAtTime(v) { this.value = v; },
    cancelScheduledValues() {},
  });
  return { currentTime: 10, destination: {}, createGain: () => ({ gain: param(), connect() {} }) };
}

test('AUDIT 64 F41: the mute drops an ALREADY-SOUNDING song to zero, and is not a stop', () => {
  // DaggerfallSongPlayer.cs:106 re-asserts `IsMuted ? 0f : MusicVolume`
  // EVERY Update, so a song that was already playing when the video
  // opened goes silent on the spot. The port has no per-frame writer -
  // `_ensureMaster` sets the master ONCE at the song's start - so the
  // resync inside setMuted is the whole of that re-assertion, and a pin
  // that never starts a song cannot see it.
  const svc = new MusicService();
  const ctx = gainCtx();
  try {
    assert.ok(musicGain() > 0 && trackGain() > 0, 'unmuted, both accessors carry the setting');

    const sp = new SongPlayer(ctx);          // the MIDI player
    const ap = new AudioSongPlayer(ctx);     // M-EXT: the replacement player
    sp._ensureMaster(); ap._ensureMaster();
    sp.playing = true; ap.playing = true;
    svc.player = sp; svc._audio = ap; svc._current = 'DUNGEON5';
    const level = [sp._master.gain.value, ap._master.gain.value];
    assert.ok(level[0] > 0 && level[1] > 0, 'the song is at level before the video opens');

    svc.setMuted(true);   // DaggerfallSongPlayer.cs:356-362
    assert.equal(musicGain(), 0, 'DaggerfallSongPlayer.cs:106 - IsMuted ? 0f');
    assert.equal(trackGain(), 0, 'the replacement player\'s accessor honours it too');
    assert.equal(svc.muted, true);
    assert.equal(music.muted, true, 'the flag is the module\'s, so every service sees it');
    // THE LIVE SOURCE, not just the next one to start.
    assert.equal(sp._master.gain.value, 0, ':106 - the sounding MIDI song drops at once');
    assert.equal(ap._master.gain.value, 0, '...and so does a sounding replacement track');
    // And it is NOT stop(): :356-362 writes Gain and IsMuted and touches
    // nothing else, so the track keeps advancing under the video and
    // :364-369 comes back mid-song rather than at the top of one.
    assert.equal(svc.current, 'DUNGEON5', 'the song was never cleared');
    assert.equal(svc.playing, true, 'nor stopped - DFU restores the level on a track still running');

    svc.setMuted(false);   // :364-369
    assert.ok(musicGain() > 0 && trackGain() > 0, ':364-369 - the level comes back');
    assert.equal(sp._master.gain.value, level[0], 'on the live source too');
    assert.equal(ap._master.gain.value, level[1]);
    assert.equal(svc.current, 'DUNGEON5', 'and the same song is still the one playing');
    assert.equal(svc.muted, false);
  } finally { svc._unsubscribe(); setMusicMuted(false); }
});

test('AUDIT 64 F41: a muted AmbientEffects stops its loop AND does not re-open it while the video runs', () => {
  const loops = [];
  const engine = {
    play3d: () => 2, playOneShot: () => 2,
    loop: (index) => { const h = { index, stopped: false, stop() { this.stopped = true; }, setVolume() {} }; loops.push(h); return h; },
  };
  const a = new AmbientEffects({ minWait: 500, maxWait: 501 }, engine, () => 0, () => 100);
  try {
    a.setPreset('rain');
    a.update(0.1, {});
    assert.equal(loops.length, 1, 'the rain loop opened');
    assert.equal(loops[0].index, AMBIENT_RAIN_LOOP);

    muteAmbientForVideo();   // AmbientEffectsPlayer.cs:536-548
    assert.equal(loops[0].stopped, true, 'the loop source is Stopped');
    assert.equal(a._rainLoop, null, 'and both handles are nulled');
    assert.equal(a.isMuted, true);

    // The quest-video seam holds no frame, so the host keeps ticking
    // under the video. Update's :108-110 early return is what keeps it
    // silent - without it the lazy start below re-opens the rain.
    a.update(0.1, {});
    a.update(0.1, {});
    assert.equal(loops.length, 1, 'AmbientEffectsPlayer.cs:108-110 - a muted Update returns before the loop starts');

    unmuteAmbientForVideo();   // :551-554 - the flag alone
    assert.equal(a.isMuted, false);
    a.update(0.1, {});
    assert.equal(loops.length, 2, 'the nulled handle is DFU\'s retry: Update re-opens the loop');
    assert.equal(loops[1].index, AMBIENT_RAIN_LOOP);
  } finally { a.dispose(); }
});

test('AUDIT 64 F41: every LIVE ambient instance is reached, and a disposed one is not', () => {
  const mk = () => new AmbientEffects({ minWait: 500, maxWait: 501 },
    { play3d: () => 2, playOneShot: () => 2, loop: () => ({ stop() {}, setVolume() {} }) }, () => 0, () => 100);
  const a = mk();
  const b = mk();
  try {
    // DFU gets this from a STATIC event with a subscription per instance
    // (AmbientEffectsPlayer.cs:92-93); the port's three hosts each own
    // one privately, so one host's wiring would not do.
    muteAmbientForVideo();
    assert.deepEqual([a.isMuted, b.isMuted], [true, true], 'both instances heard the start event');
    unmuteAmbientForVideo();
    assert.deepEqual([a.isMuted, b.isMuted], [false, false]);
    b.dispose();               // OnDisable/OnDestroy - the unsubscribe
    muteAmbientForVideo();
    assert.equal(a.isMuted, true);
    assert.equal(b.isMuted, false, 'a disposed instance has left the event');
  } finally { unmuteAmbientForVideo(); a.dispose(); b.dispose(); }
});

test('AUDIT 64 F41: the host door - the dungeon disposes its ambience, so the registry does not grow per entry', () => {
  // AmbientEffectsPlayer subscribes in Start (:92-93); Unity's
  // OnDisable/OnDestroy is the unsubscribe, and the registry that
  // stands in for that static event is a STRONG Set - so whichever
  // host rebuilds needs a door that calls dispose(), or every dungeon
  // entry leaves a dead instance for muteAmbientForVideo to walk.
  const dc = rd('src/scenes/dungeonContext.js');
  assert.match(dc, /const sceneAmbience = new AmbientEffects\(/,
    'the standalone-dungeon host owns one instance');
  const destroy = dc.slice(dc.indexOf('\n    destroy() {'));
  assert.ok(destroy.length > 0, 'buildDungeonContext exposes a destroy');
  assert.match(destroy, /sceneAmbience\.dispose\(\);/,
    'and its teardown unsubscribes it - AmbientEffectsPlayer.cs:92-93\'s OnDisable half');

  // THE FOUR-HOSTS CHECK. The two outdoor hosts build ONE ambience each
  // for the life of the run and expose no teardown at all, so there is
  // no repeated build to leak; the law lands only where one repeats.
  for (const f of ['src/scenes/exterior.js', 'src/scenes/world.js']) {
    const src = rd(f);
    assert.equal((src.match(/new AmbientEffects\(/g) ?? []).length, 1, `${f} builds exactly one`);
    assert.doesNotMatch(src, /^ {4}destroy\(\) \{/m, `${f} has no teardown to dispose it from`);
  }
  // dungeon.js/worldModes.js/interior.js mount the dungeon context
  // rather than owning an instance, so the door above is theirs too.
  for (const f of ['src/scenes/dungeon.js', 'src/scenes/worldModes.js', 'src/scenes/interior.js']) {
    assert.doesNotMatch(rd(f), /new AmbientEffects\(/, `${f} owns none`);
  }
});

// A minimal VID that opens: header, palette, one audio + one video block,
// then EndOfFile. Enough to drive playVideo's loop headlessly.
function tinyVid() {
  const u16 = (n) => [n & 0xff, (n >> 8) & 0xff];
  const out = [];
  for (const c of 'VID') out.push(c.charCodeAt(0));
  out.push(...u16(512), ...u16(1), ...u16(4), ...u16(2), ...u16(4), ...u16(14));
  out.push(T.Palette);
  for (let i = 0; i < 256; i++) out.push(i, i, i);
  const silence = new Array(740).fill(128);
  out.push(T.Audio_StartFrame, ...u16(0), 166, ...u16(silence.length), ...silence);
  out.push(T.Video_StartFrame, ...u16(1), 0x80 + 8, 1);
  out.push(T.EndOfFile);
  return new Uint8Array(out);
}

test('AUDIT 64 F41: playVideo mutes once the video OPENS and restores on every exit', async () => {
  const renderer = {
    uploads: [], quads: [],
    uploadTexture(a, r) { this.uploads.push(r); return { a, r }; },
    releaseTexture() { return true; },
    drawScreenQuad() {},
    beginFrame() {},
  };
  const canvas = { width: 640, height: 400 };
  // BOTH subscribers, not just the song: AmbientEffectsPlayer.cs:92-93
  // subscribes the same pair DaggerfallSongPlayer.cs:76-77 does, so a
  // live ambient instance must be silenced and restored by the same two
  // raises. A live one is enough - the registry fans out (test above).
  const ambience = new AmbientEffects({ minWait: 500, maxWait: 501 },
    { play3d: () => 2, playOneShot: () => 2, loop: () => ({ stop() {}, setVolume() {} }) }, () => 0, () => 100);
  const seen = [];
  let clock = 0;
  const opts = {
    now: () => clock, audioContext: () => null,
    raf: (fn) => { clock += 1 / 60; seen.push([music.muted, ambience.isMuted]); queueMicrotask(fn); },
    listen: () => () => {},
  };
  try {
    assert.equal(await playVideo(canvas, renderer, tinyVid(), opts), true);
    assert.ok(seen.length > 0, 'the video ran at least one frame');
    assert.ok(seen.every(([m]) => m === true),
      'DaggerfallVidPlayerWindow.cs:112 - the song is muted for the video\'s whole lifetime');
    assert.ok(seen.every(([, a]) => a === true),
      ':112 -> AmbientEffectsPlayer.cs:536-548 - and so is the rain, for the same lifetime');
    assert.equal(music.muted, false, ':150 -> DaggerfallSongPlayer.cs:364-369 restores at the close');
    assert.equal(ambience.isMuted, false, ':150 -> AmbientEffectsPlayer.cs:551-554 clears the flag');

    // The bytes that will not open resolve WITHOUT going through
    // finish(), so DFU's own ordering (raise the start event only after
    // video.Open succeeds, :110-112) is what keeps the game from being
    // silenced for good by one bad VID.
    seen.length = 0;
    assert.equal(await playVideo(canvas, renderer, new Uint8Array(0), opts), false);
    assert.equal(music.muted, false, 'a video that never opened never muted');
    assert.equal(ambience.isMuted, false,
      '...and left every AmbientEffects hearing - a mute with no finish() to lift it is silence for good');
  } finally { music.setMuted(false); unmuteAmbientForVideo(); ambience.dispose(); }
});

// ---------------------------------------------------------------------------
// F43 - the use-magic-item pick clicks
// ---------------------------------------------------------------------------

test('AUDIT 64 F43: MagicItemPicker_OnItemPicked plays ButtonClick FIRST, then closes, then uses', { skip: missingDfu('Assets/Scripts/Game/UserInterfaceWindows/DaggerfallUseMagicItemWindow.cs') }, () => {
  const w = dfu('Game/UserInterfaceWindows/DaggerfallUseMagicItemWindow.cs');
  assert.match(w[122], /public void MagicItemPicker_OnItemPicked/, ':123 - the handler');
  assert.match(w[124], /DaggerfallUI\.Instance\.PlayOneShot\(SoundClips\.ButtonClick\);/,
    ':125 - and its FIRST statement is the click');
  assert.match(w[126], /CloseWindow\(\);/, ':127 - the close comes after the sound');
});

test('AUDIT 64 F43: the port\'s pick clicks once, before the close and before the use', () => {
  const potion = { name: 'Potion', group: 'UselessItems1', templateIndex: TEMPLATES.Glass_Bottle };
  // ONE ordered log, not a sound list beside a call list: the whole
  // claim of :125 is that the clip comes FIRST, and two separate
  // recorders cannot see a click that moved to the end.
  const order = [];
  const win = createUseMagicItemWindow({
    items: [potion],
    isEnchanted: () => false,
    onClose: () => order.push('close'),
    onUse: () => order.push('use'),
  });
  const heard = withAudioSink(() => {
    const real = audio.playOneShot;
    audio.playOneShot = (index, volume = 1) => { order.push('click'); return real(index, volume); };
    try { win.onPick(0, 'Potion'); } finally { audio.playOneShot = real; }
  });
  assert.deepEqual(heard, [[SOUND.ButtonClick, 1]], 'exactly one ButtonClick (SoundClips.ButtonClick)');
  assert.deepEqual(order, ['click', 'close', 'use'],
    'DaggerfallUseMagicItemWindow.cs:125 - the sound, THEN CloseWindow, THEN the use');
  // The base picker is silent in DFU (neither ListBox nor
  // DaggerfallListPickerWindow plays a clip), so the click must not
  // have migrated there and made every other list picker click.
  assert.doesNotMatch(rd('src/ui/listPicker.js'), /playOneShot/,
    'the shared list picker stays silent, as DaggerfallListPickerWindow.cs is');
});

// ---------------------------------------------------------------------------
// F44 - the classic load window's clicks
// ---------------------------------------------------------------------------

test('AUDIT 64 F44: the classic load window sounds its three handlers and NOT its exit', { skip: missingDfu('Assets/Scripts/Game/UserInterfaceWindows/DaggerfallLoadClassicGameWindow.cs') }, () => {
  const w = dfu('Game/UserInterfaceWindows/DaggerfallLoadClassicGameWindow.cs');
  assert.match(w[214], /PlayOneShot\(SoundClips\.ButtonClick\);/, ':215 - LoadGameButton_OnMouseClick');
  assert.match(w[220], /PlayOneShot\(SoundClips\.ButtonClick\);/, ':221 - SaveGame_OnMouseClick');
  assert.match(w[226], /PlayOneShot\(SoundClips\.ButtonClick\);/, ':227 - SaveGame_OnMouseDoubleClick');
  assert.match(w[161], /WindowMessages\.wmCloseWindow/,
    ':162 - the exit button has no handler at all, so it plays nothing');
  // ...and a slot carries BOTH handlers on the SAME button (:132-133,
  // :139-140), which is what makes the second press of a double click
  // sound twice.
  assert.match(w[131], /OnMouseClick \+= SaveGame_OnMouseClick;/, ':132');
  assert.match(w[132], /OnMouseDoubleClick \+= SaveGame_OnMouseDoubleClick;/, ':133');
});

test('AUDIT 64 F44: BaseScreenComponent raises the double click IN ADDITION to the single one', { skip: missingDfu('Assets/Scripts/Game/UserInterface/BaseScreenComponent.cs') }, () => {
  // The reference's own value, and the whole of why a double click is
  // two clips and not one: the single-click raise is unconditional and
  // the double-click raise is a nested `if`, on the same press.
  const b = dfu('Game/UserInterface/BaseScreenComponent.cs');
  assert.match(b[680], /if \(mouseOverComponent && leftMouseDown\)/, ':681 - one press');
  assert.match(b[683], /^\s*MouseClick\(scaledMousePosition\);$/, ':684 - the single click, always');
  assert.match(b[690], /if \(leftClickTime - lastLeftClickTime < doubleClickDelay\)/, ':691');
  assert.match(b[691], /^\s*MouseDoubleClick\(scaledMousePosition\);$/,
    ':692 - INSIDE that if and after :684, not instead of it');
  // Neither raiser plays anything itself, so the clips are the window's
  // two handlers and nothing else.
  const raisers = b.slice(902, 947).join('\n');
  assert.doesNotMatch(raisers, /PlayOneShot/, ':903-947 - MouseClick/MouseDoubleClick are silent raisers');
});

test('AUDIT 64 F44: a slot click, a double click and Load all click; Exit stays silent', () => {
  const canvas = { width: 320, height: 200 };
  const slots = [null, { name: 'SLOT ONE', tex: null }, null, { name: 'SLOT THREE', tex: null }, null, null];
  const win = new LoadClassicWindow(null, slots);
  const heard = withAudioSink(() => {
    assert.deepEqual(win.click(canvas, 210, 10), { action: 'select', index: 3 });        // SaveGame_OnMouseClick
    assert.deepEqual(win.click(canvas, 45, 75, true), { action: 'load', index: 1 });     // + SaveGame_OnMouseDoubleClick
    assert.deepEqual(win.click(canvas, 130, 8), { action: 'load', index: 1 });           // LoadGameButton_OnMouseClick
  });
  // FOUR clips across those three presses, not three: the middle one is
  // the second press of a double click, and BaseScreenComponent.cs:684
  // raises MouseClick before :692 raises MouseDoubleClick, so :221 and
  // :227 both sound on it.
  assert.deepEqual(heard, [
    [SOUND.ButtonClick, 1],
    [SOUND.ButtonClick, 1], [SOUND.ButtonClick, 1],
    [SOUND.ButtonClick, 1],
  ], 'one clip per sounded HANDLER, at the UI volume');
  const dbl = withAudioSink(() => {
    assert.deepEqual(win.click(canvas, 210, 10, true), { action: 'load', index: 3 },
      'a double click on a slot selects AND opens it (:225-230)');
  });
  assert.equal(dbl.length, 2, 'a double click is two handlers and so two clips');

  const quiet = withAudioSink(() => {
    assert.deepEqual(win.click(canvas, 140, 160), { action: 'exit' });   // wmCloseWindow (:162)
    assert.equal(win.click(canvas, 45, 10), null, 'an unmounted slot has no button');
    assert.equal(win.click(canvas, 0, 0), null, 'and neither does bare background');
  });
  assert.deepEqual(quiet, [], 'the exit button and the dead rects play nothing');
});

// ---------------------------------------------------------------------------
// F45 - the parry is 1.1, the miss is 1
// ---------------------------------------------------------------------------

test('AUDIT 64 F45: PlayParrySound is volumeScale 1.1f and PlayMissSound is the default 1f', { skip: missingDfu('Assets/Scripts/Game/EnemySounds.cs', 'Assets/Scripts/Internal/DaggerfallAudioSource.cs') }, () => {
  const es = dfu('Game/EnemySounds.cs');
  assert.match(es[133], /public void PlayParrySound\(\)/, ':134');
  assert.match(es[138], /dfAudioSource\.PlayOneShot\(sound, 1, 1\.1f\);/, ':139 - the parry\'s own scale');
  assert.match(es[142], /public void PlayMissSound\(/, ':143');
  assert.match(es.slice(142, 156).join('\n'), /PlayOneShot\(weapon\.GetSwingSound\(\)\);/,
    ':143-156 - the miss passes NO volumeScale');
  const das = dfu('Internal/DaggerfallAudioSource.cs');
  assert.match(das[187], /public void PlayOneShot\(int soundIndex, float spatialBlend = 1, float volumeScale = 1f\)/,
    'DaggerfallAudioSource.cs:188 - so the miss really is 1f');
  assert.equal(PARRY_VOLUME, 1.1, 'the port\'s constant IS EnemySounds.cs:139');
});

test('AUDIT 64 F45: the zero-damage fork splits its volume by arm as well as by place', () => {
  const clearCollider = () => ({
    raycast: () => Infinity,
    capsuleCast: () => ({ dist: Infinity, key: null }),
    move: () => ({ grounded: true }),
  });
  const mkFoe = (feet, parry) => ({
    ai: new EnemyAI(clearCollider(), feet, 0),
    entity: { isClass: false, gender: 'male', health: 30, maxHealth: 30, team: 'Orcs', basics: { team: 'Orcs', weight: 80, parrySounds: parry, bloodIndex: 2 } },
  });
  const attacker = mkFoe([0, 0, 0], false);
  const heard = [];
  const opts = {
    rolls: () => 0.5, calculateAttackDamage: () => 0, dealDamage: () => {},
    audio: { play3d: (clip, where, vol) => heard.push([clip, where[2], vol]) },
  };
  // The parry arm: a ParrySounds target struck with a weapon by an arrow.
  applyDamageToNonPlayer(attacker, mkFoe([0, 0, 1.5], true), {
    ...opts, weapon: { templateIndex: 120, material: 3 }, bowAttack: true,
  });
  assert.equal(heard.length, 1);
  assert.equal(heard[0][0], PARRY_1 + 4, 'Parry1 + Random.Range(0, 9)');
  assert.equal(heard[0][1], 1.5, 'PlayParrySound rings at the TARGET (EnemyAttack.cs:374)');
  assert.equal(heard[0][2], 1.1, 'EnemySounds.cs:139 - PlayOneShot(sound, 1, 1.1f)');
  // The miss arm: no ParrySounds, so `sounds.PlayMissSound(weapon)`.
  heard.length = 0;
  applyDamageToNonPlayer(attacker, mkFoe([0, 0, 1.5], false), { ...opts, weapon: null });
  assert.equal(heard[0][1], 0, 'the whiff rings at the ATTACKER (:372)');
  assert.equal(heard[0][2], 1, 'EnemySounds.cs:143-156 -> DaggerfallAudioSource.cs:188\'s default volumeScale');
  assert.notEqual(heard[0][2], PARRY_VOLUME, 'the two arms do not share one constant');
});

// ---------------------------------------------------------------------------
// F46 - the stride anchor is left stale by the early returns
// ---------------------------------------------------------------------------

test('AUDIT 64 F46: lastPosition is written in exactly TWO places, and none of them is an early return', { skip: missingDfu('Assets/Scripts/Game/PlayerFootsteps.cs') }, () => {
  const pf = dfu('Game/PlayerFootsteps.cs');
  // The three early returns, each distance-only.
  assert.match(pf.slice(220, 225).join('\n'),
    /IsLevitating[\s\S]*distance = 0f;\s*\n\s*return;/, ':221-225 - the on-foot/levitation gate');
  assert.match(pf.slice(231, 238).join('\n'),
    /!IsGrounded\(\)[\s\S]*distance = 0f;[\s\S]*lostGrounding = true;\s*\n\s*return;/, ':232-238 - the lost-grounding arm');
  assert.match(pf.slice(263, 265).join('\n'), /IsStandingStill\)\s*\n\s*return;/, ':264-265 - a bare return');
  for (const at of [221, 222, 223, 224, 225, 232, 233, 234, 235, 236, 237, 238, 264, 265]) {
    assert.doesNotMatch(pf[at - 1], /lastPosition\s*=/, `PlayerFootsteps.cs:${at} does not touch lastPosition`);
  }
  // ...and the only two that do.
  const writes = pf.map((l, i) => [i + 1, l]).filter(([, l]) => /^\s*lastPosition = /.test(l)).map(([n]) => n);
  assert.deepEqual(writes, [89, 245, 270],
    'Start\'s seed, the landing reset, and the accumulation - nothing else');
});

test('AUDIT 64 F46: the whole ride lands on the first frame after the gate opens', () => {
  const m = new FootstepMachine();
  m.ignoreLostGrounding = false;
  const set = [FOOTSTEP.Outside1, FOOTSTEP.Outside2];
  const mounted = { grounded: true, standingStill: false, swimming: false, levitating: false, onFoot: false, onExteriorWater: false, halfSpeed: false };
  assert.equal(m.update([0, 0, 0], mounted, set), null, 'the seed');
  for (let x = 5; x <= 40; x += 5) {
    assert.equal(m.update([x, 0, 0], mounted, set), null, 'a mount is silent (PlayerFootsteps.cs:221-225)');
  }
  assert.deepEqual(m.last, [0, 0], 'and the anchor never moved - :223 writes distance only');
  // DFU dismounts by SHRINKING the controller, so the player stays
  // grounded across it and the :245 landing reset never runs. The next
  // FixedUpdate bills the whole ride at :269 and fires one step.
  const step = m.update([41, 0, 0], { ...mounted, onFoot: true }, set);
  assert.deepEqual(step, { clip: FOOTSTEP.Outside1, volume: FOOTSTEP_VOLUME },
    'the first walking frame after the dismount plays a step');
  assert.ok(41 > WALK_STEP_INTERVAL, 'and it is the RIDE that carried it over the threshold, not the step');
});

test('AUDIT 64 F46: a fall that ends in water bills the fall, because IsSwimming skips the landing reset', () => {
  const m = new FootstepMachine();
  m.ignoreLostGrounding = false;
  const set = [FOOTSTEP.Submerged, FOOTSTEP.Submerged];
  const base = { grounded: true, standingStill: false, swimming: false, levitating: false, halfSpeed: false };
  assert.equal(m.update([0, 0, 0], base, set), null);
  for (let x = 2; x <= 6; x += 2) {
    assert.equal(m.update([x, 0, 0], { ...base, grounded: false }, set), null,
      'airborne is silent (:232-238) and leaves the anchor alone');
  }
  assert.deepEqual(m.last, [0, 0], ':235-237 writes distance and the flag, never lastPosition');
  // Landing in water: `if (!IsSwimming)` (:230) skips the whole
  // grounding block, so lostGrounding is never cleared and the :245
  // reset never runs - :269 bills the fall's horizontal travel.
  const splash = m.update([7, 0, 0], { ...base, swimming: true, grounded: false }, set);
  assert.deepEqual(splash, { clip: FOOTSTEP.Submerged, volume: FOOTSTEP_VOLUME },
    'the first swimming frame plays');
  assert.equal(m.lostGrounding, true, 'and the flag is still up, exactly as DFU leaves it');
});

test('AUDIT 64 F46: standing still returns bare - the anchor is not rebased under a stopped player', () => {
  const m = new FootstepMachine();
  m.ignoreLostGrounding = false;
  const set = [FOOTSTEP.Outside1, FOOTSTEP.Outside2];
  const base = { grounded: true, standingStill: false, swimming: false, levitating: false, halfSpeed: false };
  assert.equal(m.update([0, 0, 0], base, set), null);
  // A stop-motion teleport under IsStandingStill (the motor's own flag
  // is speed, not position) leaves the anchor where it was: :264-265 is
  // `return;` with nothing else on it.
  assert.equal(m.update([3, 0, 0], { ...base, standingStill: true }, set), null);
  assert.deepEqual(m.last, [0, 0], 'no write on the standing-still arm');
  assert.equal(m.distance, 0, 'and nothing accumulated - the return precedes :268-269');
  // The port-only floating-origin guard is untouched and still re-seeds.
  m.rebase();
  assert.equal(m.last, null);
  assert.equal(m.update([819.2, 0, 0], base, set), null, 'a recentre re-seeds instead of billing 819.2');
});
