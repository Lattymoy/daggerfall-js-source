// INTRO2: score, session ownership, transition and independent asset identity.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { IntroTheme, audibleContextTime, INTRO_THEME_GAIN, MENU_THEME_GAIN } from '../src/systems/introTheme.js';
import { introTitleAt, introFrameAt, introCameraAt, INTRO_CREDITS, TITLE_IMPACT_TIME, TITLE_READY_TIME } from '../src/ui/introCue.js';
import { introTerrainGrid } from '../src/ui/introLandscape.js';
import { buildIliac, SEA_LEVEL, seaDistance, BALFIERA } from '../src/ui/introMap.js';
import { brandMark } from '../src/ui/brandMark.js';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url));

test('INTRO2: supplied logo and recovered music are byte-exact; timing cannot drift behind a replacement track', () => {
  assert.equal(createHash('sha256').update(read('src/assets/branding/daggerfall-enhanced.jpg')).digest('hex'), '337c265017959af6575fbf4be4d322b1d57be7c33e02279db387c756dd252bf7');
  assert.equal(createHash('sha256').update(read('src/assets/intro/theme.mp3')).digest('hex'), '7cc0ec09eeee9afe1ecff20ee3cffd824f5e6b295f08ddea79583ea5ab97f577');
});

test('INTRO2: the logo lands on the first closing beat at decoded sample 246400 / 12000; one frame earlier it is still falling', () => {
  const measured = 246400 / 12000; // reproduced by tools/introAudioCheck.mjs, independently of the cue
  assert.ok(Math.abs(TITLE_IMPACT_TIME - measured) < 1e-6);
  const before = introTitleAt(measured - 1 / 60), at = introTitleAt(measured + 1e-8);
  assert.ok(before.y < -0.01);
  assert.equal(at.y, 0); assert.equal(at.opacity, 1);
  assert.ok(at.impact > 0.999);
  assert.equal(introTitleAt(measured - 2).opacity, 0);
  const a = introTitleAt(measured - 0.5).y, b = introTitleAt(measured - 0.3).y, c = introTitleAt(measured - 0.1).y;
  assert.ok(c - b > b - a, 'the fall accelerates into its landing');
});

test('INTRO2: the final title never auto-dismisses, including after the entire recording loops', () => {
  for (const time of [TITLE_READY_TIME + 1, 60, 165, 600]) {
    const st = introFrameAt(time);
    assert.equal(st.title.opacity, 1); assert.equal(st.title.y, 0);
    assert.equal(st.ready, true); assert.equal(st.prompt, 1);
    assert.equal(st.credits.every(c => c.opacity === 0), true);
  }
  assert.equal(introFrameAt(TITLE_READY_TIME - 0.01).ready, false);
});

test('INTRO2: both credits end before the climb, with a readable hold and no overlap', () => {
  for (const c of INTRO_CREDITS) {
    assert.ok(c.out - c.up >= 1.8);
    assert.ok(c.end < 9.45);
    const st = introFrameAt((c.up + c.out) / 2);
    assert.equal(st.credits.filter(x => x.opacity > 0).length, 1);
    assert.equal(st.credits.find(x => x.key === c.key).opacity, 1);
  }
});

test('INTRO2: camera is continuous, finite, and keeps the full horizontal frame on portrait screens', () => {
  for (const aspect of [0.47, 1, 16 / 9, 21 / 9]) {
    let previous = introCameraAt(0, aspect);
    for (let i = 1; i <= 1450; i++) {
      const current = introCameraAt(i / 60, aspect);
      assert.ok([...current.eye, ...current.aim, current.fov].every(Number.isFinite));
      assert.ok(current.fov > 0 && current.fov < Math.PI);
      assert.ok(Math.hypot(...current.eye.map((v, k) => v - previous.eye[k])) < 15, 'no teleport between camera projections');
      previous = current;
    }
  }
  const wide = introCameraAt(19, 16 / 9), narrow = introCameraAt(19, 0.47);
  assert.ok(Math.abs(Math.tan(wide.fov / 2) * 16 / 9 - Math.tan(narrow.fov / 2) * 0.47) < 1e-9);
});

test('INTRO2: reduced motion removes the flight, falling logo, and impact, retaining its musical reveal', () => {
  assert.deepEqual(introCameraAt(2, 1.5, true), introCameraAt(19, 1.5, true));
  assert.equal(introTitleAt(TITLE_IMPACT_TIME - 0.01, true).opacity, 0);
  assert.deepEqual(introTitleAt(TITLE_IMPACT_TIME, true), { opacity: 1, y: 0, scale: 1, impact: 0 });
});

test('INTRO2: generated mesh indices remain within the grid and geography has sea plus land', () => {
  const g = introTerrainGrid(8, 5);
  assert.equal(g.vertices.length, 9 * 6 * 2); assert.equal(g.indices.length, 8 * 5 * 6);
  assert.ok(g.indices.every(i => i < 9 * 6));
  const map = buildIliac({ w: 64, h: 40 });
  assert.ok(map.height.some(h => h === SEA_LEVEL)); assert.ok(map.height.some(h => h > SEA_LEVEL + 60));
  assert.ok(seaDistance(BALFIERA.x, BALFIERA.y) > 0);
  assert.deepEqual(buildIliac({ w: 64, h: 40 }), map, 'same boot, same geography');
});

test('INTRO2: audible clock uses the device timestamp, with a latency-aware fallback', () => {
  assert.equal(audibleContextTime({ currentTime: 10.2, getOutputTimestamp: () => ({ contextTime: 10, performanceTime: 10000 }) }, 10016), 10.016);
  assert.equal(audibleContextTime({ currentTime: 10.2, outputLatency: 0.2 }, 10016), 10);
  assert.equal(audibleContextTime({ currentTime: 10.2, outputLatency: 0.2, getOutputTimestamp: () => ({ contextTime: 0, performanceTime: 0 }) }, 10016), 10);
});

function audioRig() {
  const events = [], sources = [];
  let volume = 0.5, listener = null;
  const gain = {
    value: 1,
    cancelAndHoldAtTime(t) { events.push(['hold', t]); },
    linearRampToValueAtTime(v, t) { events.push(['ramp', v, t]); this.value = v; },
  };
  const ctx = {
    currentTime: 10, state: 'suspended', outputLatency: 0.1, destination: {},
    createGain: () => ({ gain, connect: () => events.push(['connectGain']), disconnect: () => events.push(['disconnectGain']) }),
    decodeAudioData: async () => ({ duration: 164.5 }),
    resume() { events.push(['resume']); this.state = 'running'; return Promise.resolve(); },
    suspend() { this.state = 'suspended'; return Promise.resolve(); },
    close() { events.push(['close']); this.state = 'closed'; return Promise.resolve(); },
    createBufferSource() {
      const s = { loop: false, connect: () => {}, start: at => events.push(['start', at]), stop: () => events.push(['stop']), disconnect: () => events.push(['disconnectSource']) };
      sources.push(s); return s;
    },
  };
  const theme = new IntroTheme({ makeContext: () => ctx, readVolume: () => volume, now: () => 10000,
    fetcher: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) }),
    subscribe: f => { listener = f; return () => { listener = null; events.push(['unsubscribe']); }; },
  });
  return { theme, ctx, gain, events, sources, volume: (v) => { volume = v; listener?.('Controls', 'MusicVolume'); } };
}

test('INTRO2: unlock is synchronous within the gesture, audio is scheduled once, and menu ducking never restarts it', async () => {
  const r = audioRig();
  const unlocked = r.theme.unlock();
  assert.ok(r.events.some(e => e[0] === 'resume'), 'resume before the first await');
  await unlocked; await r.theme.prepare();
  assert.equal(r.theme.start(), true); assert.equal(r.theme.start(), true);
  assert.equal(r.sources.length, 1); assert.equal(r.sources[0].loop, true);
  assert.ok(Math.abs(r.gain.value - 0.5 * INTRO_THEME_GAIN) < 1e-9);
  r.theme.setLevel(MENU_THEME_GAIN, 1.1);
  assert.deepEqual(r.events.at(-1), ['ramp', 0.5 * MENU_THEME_GAIN, 11.1]);
  assert.equal(r.sources.length, 1); assert.equal(r.events.filter(e => e[0] === 'start').length, 1);
  r.volume(0.2); assert.ok(Math.abs(r.gain.value - 0.2 * MENU_THEME_GAIN) < 1e-9);
  r.volume(0); assert.equal(r.gain.value, 0, 'mute remains mute');
  await r.theme.dispose(); await r.theme.dispose();
  for (const event of ['close', 'stop', 'disconnectSource', 'disconnectGain', 'unsubscribe']) assert.equal(r.events.filter(e => e[0] === event).length, 1, event);
  assert.equal(r.theme.buffer, null); assert.equal(r.theme.source, null);
  assert.doesNotThrow(() => r.theme.time());
});

test('INTRO2: suspension holds the picture; resume uses audio progress instead of elapsed wall time', async () => {
  const r = audioRig(); await r.theme.unlock(); await r.theme.prepare(); r.theme.start();
  r.ctx.currentTime = 15; const before = r.theme.time();
  await r.theme.pause(); assert.equal(r.theme.time(999999), before);
  await r.theme.unlock(); r.ctx.currentTime = 15.2;
  assert.ok(Math.abs(r.theme.time() - before - 0.2) < 1e-8);
  await r.theme.dispose();
});

test('INTRO2: disposing during fetch prevents late audio and releases the loading context', async () => {
  const r = audioRig(); let finish;
  r.theme.fetcher = () => new Promise(resolve => { finish = resolve; });
  const loading = r.theme.prepare(); await r.theme.dispose();
  finish({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) });
  assert.equal(await loading, false); assert.equal(r.theme.start(), false);
  assert.equal(r.theme.buffer, null); assert.equal(r.sources.length, 0);
});

test('INTRO2: the shared logo has accessible text and its exact natural aspect ratio', () => {
  const logo = brandMark({ createElement: (tag) => ({ tag }) });
  assert.equal(logo.tag, 'img'); assert.equal(logo.alt, 'The Elder Scrolls II: Daggerfall Enhanced');
  assert.equal(logo.width / logo.height, 3); assert.equal(logo.draggable, false);
});
