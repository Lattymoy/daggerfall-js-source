// INTRO2: score, session ownership, transition and independent asset identity.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { IntroTheme, audibleContextTime, INTRO_THEME_GAIN, MENU_THEME_GAIN } from '../src/systems/introTheme.js';
import { introTitleAt, introFrameAt, introCameraAt, INTRO_CREDITS, TITLE_IMPACT_TIME, TITLE_ENTER_TIME, TITLE_READY_TIME, LANDSCAPE_HOLD_TIME, TITLE_DEPTH, TITLE_BLUR } from '../src/ui/introCue.js';
import { introTerrainGrid } from '../src/ui/introLandscape.js';
import { buildIliac, SEA_LEVEL, seaDistance, BALFIERA } from '../src/ui/introMap.js';
import { brandMark } from '../src/ui/brandMark.js';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url));

test('INTRO2: supplied logo and Mac\u2019s remastered recording are byte-exact; timing cannot drift behind a replacement track', () => {
  assert.equal(createHash('sha256').update(read('src/assets/branding/daggerfall-enhanced.jpg')).digest('hex'), '337c265017959af6575fbf4be4d322b1d57be7c33e02279db387c756dd252bf7');
  const track = read('src/assets/intro/theme.mp3');
  assert.equal(createHash('sha256').update(track).digest('hex'), 'f51aea745cc1b20de9b98afea9a00b5ea9089703b3b0a26cdf6bc2bfe990f8a6');

  // BR1 forbids the old name on any shipped surface, and the supplied master
  // carried it in its ID3 title. ONLY that title was rewritten: the tag is
  // reassembled frame for frame and the MPEG payload behind it is Mac's file
  // bit for bit, which is what this second hash exists to prove. A re-encode
  // or a trim would move it, and the cue above is measured off this recording.
  const tag = 10 + ((track[6] & 0x7f) << 21 | (track[7] & 0x7f) << 14 | (track[8] & 0x7f) << 7 | (track[9] & 0x7f));
  assert.equal(createHash('sha256').update(track.subarray(tag)).digest('hex'), '3a1bc066e12951a6450b04649a2ffaa0b614c0848b520d033c2448b155bf56d7');
  const header = track.subarray(0, tag).toString('latin1');
  assert.ok(header.includes('Daggerfall Enhanced Main Theme'), 'the track titles itself by the product\u2019s name');
  // Spelled in parts, so this assertion is not itself a surface BR1 must sweep.
  const gone = ['Daggerfall', 'JS', 'JavaScript'];
  for (const name of [`${gone[0]} ${gone[1]}`, `${gone[0]}${gone[1]}`, `${gone[0]} ${gone[2]}`]) {
    assert.ok(!header.includes(name), `the old name survives in the ID3 tag: ${name}`);
  }
});

test('INTRO2b: the logo lands on the 19 s beat at decoded sample 230016 / 12000; one frame earlier it is still out in front', () => {
  const measured = 230016 / 12000; // reproduced by tools/introAudioCheck.mjs, independently of the cue
  assert.ok(measured > 19 && measured < 19.25, 'Mac\u2019s beat is the one around 19 seconds');
  assert.ok(Math.abs(TITLE_IMPACT_TIME - measured) < 1e-6);
  const before = introTitleAt(measured - 1 / 60), at = introTitleAt(measured + 1e-8);
  assert.ok(before.scale < 0.95 && before.opacity > 0.9, 'still arriving, and already legible');
  assert.equal(at.scale, 1); assert.equal(at.blur, 0); assert.equal(at.opacity, 1);
  assert.ok(at.impact > 0.999);
  assert.equal(introTitleAt(measured - 2).opacity, 0);
});

test('INTRO2c: the mark flies out of the depth of the shot, never from the top, and stops dead on the beat', () => {
  // y is the vertical component of the entrance. There is none, at any time.
  for (let t = 0; t <= TITLE_IMPACT_TIME + 3; t += 1 / 60) assert.equal(introTitleAt(t).y, 0);
  const at = (t) => introTitleAt(TITLE_IMPACT_TIME + t);
  assert.equal(introTitleAt(TITLE_ENTER_TIME).scale, 1 / TITLE_DEPTH);
  assert.ok(TITLE_DEPTH > 3, 'it starts genuinely far away, not merely small');
  // 1/z under a constant approach: the rush accelerates into the landing, and
  // never overshoots past its resting size on the way or after it.
  const a = at(-0.5).scale, b = at(-0.3).scale, c = at(-0.1).scale;
  assert.ok(a < b && b < c && c < 1, 'monotone approach');
  assert.ok(c - b > b - a, 'the approach accelerates into its landing');
  for (let t = TITLE_ENTER_TIME; t <= TITLE_IMPACT_TIME + 4; t += 1 / 120) {
    const st = introTitleAt(t);
    assert.ok(st.scale <= 1 + 1e-12, `no overshoot at ${t}`);
    assert.ok(st.blur >= 0 && st.blur <= TITLE_BLUR);
  }
  // Depth of field closes with the distance and costs nothing once at rest.
  assert.ok(at(-0.5).blur > at(-0.1).blur && at(-0.1).blur > 0);
  for (const t of [0, 0.5, 30, 600]) assert.equal(at(t).blur, 0);
});

test('INTRO2b: the camera is already at rest before the logo starts moving, so the beat carries the landing alone', () => {
  const rest = introCameraAt(LANDSCAPE_HOLD_TIME, 16 / 9);
  assert.ok(LANDSCAPE_HOLD_TIME < TITLE_ENTER_TIME - 0.5, 'the camera flight ends well before the mark starts its own');
  for (const t of [TITLE_ENTER_TIME, (TITLE_ENTER_TIME + TITLE_IMPACT_TIME) / 2, TITLE_IMPACT_TIME, TITLE_IMPACT_TIME + 1]) {
    assert.deepEqual(introCameraAt(t, 16 / 9), rest, `camera still moving at ${t}`);
    assert.equal(introFrameAt(t).landscapeTime, LANDSCAPE_HOLD_TIME, 'the held terrain frame is not re-rendered');
  }
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

test('INTRO2: reduced motion removes the flight, the arriving logo, and impact, retaining its musical reveal', () => {
  assert.deepEqual(introCameraAt(2, 1.5, true), introCameraAt(19, 1.5, true));
  assert.equal(introTitleAt(TITLE_IMPACT_TIME - 0.01, true).opacity, 0);
  assert.deepEqual(introTitleAt(TITLE_IMPACT_TIME, true), { opacity: 1, y: 0, scale: 1, blur: 0, impact: 0 });
  assert.deepEqual(introTitleAt(TITLE_IMPACT_TIME - 0.4, true), { opacity: 0, y: 0, scale: 1, blur: 0, impact: 0 });
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

// ═══ INTRO-FIELD (Mac, 2026-09-18) ═══════════════════════════════════
// "For the first screen where you have to touch to begin. Remove all the
// text except the begin button."
test('INTRO-FIELD: the gate is the BEGIN button and nothing drawn beside it - the status line is spoken, not shown (mutants: INTROFIELD-*)', () => {
  const src = String(read('src/ui/introScreen.js'));

  // 1. NOTHING BUT THE BUTTON IS APPENDED. The kicker, the title and the
  // ornament rule are gone from the gate, not merely hidden - a hidden
  // node is a thing the next reader re-shows by accident.
  assert.match(src, /gate\.append\(begin, status\);/, 'the gate holds the button and the live region, in that order, and nothing else');
  for (const gone of ['The Elder Scrolls II', 'The Iliac Bay', 'The journey awaits']) {
    assert.ok(!src.includes(gone), `"${gone}" is off the gate entirely`);
  }
  for (const cls of ['intro-kicker', 'intro-ornament']) {
    assert.ok(!src.includes(cls), `.${cls} is gone from the markup AND the style - a rule with no node is litter`);
  }
  assert.doesNotMatch(src, /\.intro-gate h1\{/, 'and the gate has no heading rule left to style a heading with');

  // 2. THE STATUS LINE IS SPOKEN, NOT DRAWN. It stays a node because it
  // is the live region a screen reader is owed, and because it is what
  // says the tap enables sound - but it takes no space on the picture.
  assert.match(src, /const status = make\(doc, 'p', 'intro-status', 'Preparing the journey…'\); status\.setAttribute\('role', 'status'\);/,
    'still a role=status live region');
  const rule = src.match(/\.intro-status\{([^}]*)\}/);
  assert.ok(rule, 'and it still has a rule of its own');
  assert.match(rule[1], /clip-path:inset\(50%\)/, 'CLIPPED rather than display:none - a display:none live region is not announced');
  assert.match(rule[1], /width:1px/); assert.match(rule[1], /height:1px/);
  assert.doesNotMatch(rule[1], /min-height:18px/, 'and it reserves no line of the layout any more');

  // 3. THE ONE MESSAGE A PLAYER MUST SEE IS NOT THIS LINE'S. The score
  // failing to load writes the FOOTER, which is still drawn - hiding the
  // status must never have hidden a real failure.
  assert.match(src, /footer\.textContent = 'Music couldn’t load\. You can still continue\.';/);
  assert.doesNotMatch(src, /status\.textContent = '[^']*(couldn|failed|error)/i, 'no failure is routed to the clipped line');

  // 4. AND THE BUTTON STILL CARRIES BOTH ITS WORDS, since the heading it
  // used to be re-worded beside is gone.
  assert.match(src, /begin\.textContent = resuming \? 'Resume' : 'Begin';/);
  assert.match(src, /begin\.disabled = false; begin\.textContent = 'Resume';/, 'a suspended film says Resume on the button itself');

  // The probe aimed its "tap anywhere that is not a control" at the
  // kicker's box. With the kicker gone it aims at the button's own top.
  const probe = String(read('tools/introProbe.mjs'));
  assert.ok(!probe.includes('.intro-kicker'), 'the probe does not reach for a node that no longer exists');
  assert.match(probe, /const button = document\.querySelector\('\.intro-begin'\)\.getBoundingClientRect\(\);\s*\n\s*return \{ x: Math\.round\(innerWidth \/ 2\), y: Math\.round\(button\.top \/ 2\)/);
});
