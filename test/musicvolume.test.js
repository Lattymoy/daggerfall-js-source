// THE MUSIC SLIDER, LIVE - and a replacement pack at its own level
// (2026-08-27, Mac, from play; re-landed alone after the music arc was
// reverted, because these two were fixes, not the arc).
//
// Two roots. Controls/MusicVolume was LIVE in the registry's tier and
// read once per player, at _ensureMaster, and never again - so the
// slider was heard at the NEXT song and a looping song never heard it.
// And the replacement player took MUSIC_GAIN - the FM bank's trim,
// there because raw oscillators sum hot - on top of the setting, so a
// user's mastered music pack played at a fifth of itself.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setValue, onSettingChange, _resetForTests } from '../src/systems/settings.js';
import { musicGain, trackGain, MUSIC_GAIN, SongPlayer, AudioSongPlayer } from '../src/systems/songPlayer.js';
import { MusicService } from '../src/systems/music.js';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

/** A fake AudioContext whose gain params record their automation. */
function fakeCtx() {
  const log = [];
  const param = () => ({
    value: 0,
    setValueAtTime(v, t) { log.push(['set', v, t]); this.value = v; },
    linearRampToValueAtTime(v, t) { log.push(['ramp', v, t]); this.value = v; },
    cancelScheduledValues(t) { log.push(['cancel', t]); },
  });
  return { currentTime: 10, destination: {}, log, createGain: () => ({ gain: param(), connect() {} }) };
}

test('MusicVolume: a settings write is published once; unsubscribe works; a throwing listener is skipped', () => {
  _resetForTests();
  const seen = [];
  const off = onSettingChange((sec, key, str) => seen.push(`${sec}/${key}=${str}`));
  setValue('Controls', 'MusicVolume', 0.8);
  assert.deepEqual(seen, ['Controls/MusicVolume=0.8']);
  setValue('Controls', 'MusicVolume', 0.5);   // back to the default: still published, as the default's string
  assert.equal(seen[1], 'Controls/MusicVolume=0.5');
  off();
  setValue('Controls', 'MusicVolume', 0.3);
  assert.equal(seen.length, 2, 'unsubscribed');
  const off2 = onSettingChange(() => { throw new Error('bad listener'); });
  setValue('Controls', 'MusicVolume', 0.4);
  assert.equal(trackGain(), 0.4, 'the write landed despite the listener');
  off2();
  _resetForTests();
});

test('MusicVolume: the service re-levels both its players on exactly that key', () => {
  _resetForTests();
  const svc = new MusicService();
  const calls = [];
  svc.player = { resyncGain: () => calls.push('song') };
  svc._audio = { resyncGain: () => calls.push('replacement') };
  setValue('Controls', 'MusicVolume', 0.6);
  assert.deepEqual(calls, ['song', 'replacement']);
  setValue('Controls', 'SoundVolume', 0.9);
  assert.equal(calls.length, 2, 'another key does not touch the music');
  svc._unsubscribe();
  setValue('Controls', 'MusicVolume', 0.7);
  assert.equal(calls.length, 2, 'a torn-down service stops listening');
  _resetForTests();
});

test('MusicVolume: each player ramps its master to the setting now - the scheduler trimmed, the replacement not', () => {
  _resetForTests();
  setValue('Controls', 'MusicVolume', 0.7);
  const ctx = fakeCtx();
  const sp = new SongPlayer(ctx); sp._ensureMaster(); sp.resyncGain();
  let last = ctx.log.filter((l) => l[0] === 'ramp').pop();
  assert.ok(Math.abs(last[1] - MUSIC_GAIN * 0.7) < 1e-9, 'the scheduler ramps to MUSIC_GAIN x the setting');
  assert.ok(last[2] - ctx.currentTime <= 0.06, 'a short ramp, not a zipper');
  const ap = new AudioSongPlayer(ctx); ap._ensureMaster();
  assert.equal(ap._master.gain.value, 0.7, 'a replacement pack starts at the setting alone');
  setValue('Controls', 'MusicVolume', 0.2);
  ap.resyncGain();
  last = ctx.log.filter((l) => l[0] === 'ramp').pop();
  assert.ok(Math.abs(last[1] - 0.2) < 1e-9, '...and follows it untrimmed');
  assert.equal(musicGain(), MUSIC_GAIN * 0.2);
  assert.ok(trackGain() / musicGain() > 4, 'a pack is no longer a fifth of itself');
  // Nothing to re-level before a master exists: no throw.
  new SongPlayer(ctx).resyncGain(); new AudioSongPlayer(ctx).resyncGain();
  _resetForTests();
});

test('MusicVolume: every writer already goes through setValue, so the door reaches them all', () => {
  for (const f of ['src/ui/enhancedMenu.js', 'src/ui/settingsWindow.js', 'src/ui/pauseWindow.js']) {
    assert.match(read(f), /setValue\(/, `${f} writes through setValue`);
  }
  assert.match(read('src/systems/settings.js'), /_publish\(section, key, str\);\n    return;/, 'the default-drop arm publishes too');
  assert.match(read('src/systems/music.js'), /if \(section === 'Controls' && key === 'MusicVolume'\) this\.resyncGain\(\);/);
});
