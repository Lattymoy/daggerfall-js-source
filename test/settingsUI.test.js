// MENU: the settings screen's pins.
//
// The laws here are the ones the design workflow's nine critiques
// established by MEASUREMENT against this codebase - each of these
// caught a real defect in one of the three candidate designs before a
// line was written.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALL_KEYS, tierOf, LIVE, DEFAULTS, effectiveSettings, _resetForTests } from '../src/systems/settings.js';
import { CATEGORIES, CATEGORY_IDS, keysOf, categoryOf } from '../src/ui/settingsMap.js';
import { LABELS, labelOf, helpOf, READOUT, INSTEAD } from '../src/ui/settingsCopy.js';
import { widgetFor, formatValue, stepValue, NUMBER_LAW, ENUM_LAW, COLOUR_KEYS } from '../src/ui/settingsLaw.js';
import { settingsMetrics, pointToPage, tapMin } from '../src/ui/settingsMetrics.js';
import { SettingsWindow } from '../src/ui/settingsWindow.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (f) => readFileSync(join(root, 'src', f), 'utf8');

test('MENU T1: the category map is TOTAL and DISJOINT over the store', () => {
  const seen = new Map();
  for (const cat of CATEGORY_IDS) {
    for (const k of keysOf(cat)) {
      assert.ok(ALL_KEYS.includes(k), `${k} is mapped but is not a store key`);
      assert.ok(!seen.has(k), `${k} is in both ${seen.get(k)} and ${cat}`);
      seen.set(k, cat);
    }
  }
  for (const k of ALL_KEYS) assert.ok(seen.has(k), `${k} has no category - it would vanish from the screen`);
  assert.equal(seen.size, 171);
  // the shape the design settled on, so a re-bake that renames a key
  // fails the build rather than quietly dropping a row
  assert.deepEqual(CATEGORY_IDS.map((c) => keysOf(c).length), [21, 16, 5, 66, 37, 19, 7]);
  assert.deepEqual(CATEGORY_IDS, ['game', 'controls', 'audio', 'video', 'interface', 'accessibility', 'mods']);
});

test('MENU T2: no player ever reads a raw ini identifier', () => {
  for (const k of ALL_KEYS) {
    const label = labelOf(k);
    assert.ok(label && label.length <= 26, `${k}: label "${label}" is missing or over 26 chars`);
    assert.match(label, /^[\x20-\x7E]+$/, `${k}: label must be plain ASCII (the font has no glyph below 33)`);
    // the rule is about IDENTIFIERS, not about words: "Fullscreen" is
    // both the ini key and the right English, and that is fine. What
    // must never survive is camelCase or an underscore.
    assert.ok(!/[a-z][A-Z]/.test(label), `${k}: "${label}" is still camelCase`);
    assert.ok(!label.includes('_'), `${k}: "${label}" still carries an identifier underscore`);
  }
  // the words this screen must never say about the port's own gaps
  const banned = /unsupported|broken|missing|not implemented|n\/a/i;
  for (const s of [...Object.values(LABELS), ...Object.values(READOUT), ...Object.values(INSTEAD),
    ...CATEGORIES.map((c) => c.blurb), ...CATEGORIES.map((c) => c.title)]) {
    assert.ok(!banned.test(s), `discouraging word in copy: "${s}"`);
    assert.match(s, /^[\x20-\x7E]+$/, `non-ASCII in copy: "${s}"`);
  }
});

test('MENU T4: the widget law is total, and a blocked row never shows a stored value', () => {
  const kinds = new Set(['switch', 'enum', 'number', 'colour', 'text', 'blocked']);
  for (const k of ALL_KEYS) assert.ok(kinds.has(widgetFor(k)), `${k}: no widget kind`);
  // an unavailable key must resolve to 'blocked' and NOTHING else -
  // otherwise the screen offers a control that cannot move
  for (const k of ALL_KEYS) {
    if (tierOf(k) === 'unavailable') {
      assert.equal(widgetFor(k), 'blocked', `${k} is unavailable but drew an operable widget`);
      assert.ok(READOUT[k], `${k} has no readout - it would print its stored value`);
      assert.ok(INSTEAD[k], `${k} has no "instead" sentence`);
    }
  }
  // THE HONESTY CASE: EnhancedCombatAI stores DFU's True while this
  // port runs the classic path. Printing "On" would be a lie.
  assert.equal(formatValue('Enhancements/EnhancedCombatAI', 'True'), 'classic');
  // enums are DFU's names in DFU's order
  for (const [k, law] of Object.entries(ENUM_LAW)) {
    assert.ok(law.values.length >= 2 && law.cite, `${k}: enum needs values and a citation`);
    assert.ok(ALL_KEYS.includes(k), `${k}: enum law names a key the store lacks`);
  }
  for (const k of COLOUR_KEYS) {
    const [s, kk] = k.split('/');
    assert.match(DEFAULTS[s][kk], /^[0-9A-F]{8}$/i, `${k}: colour default must be RRGGBBAA`);
  }
});

test('MENU T5: a slider never offers travel its consumer ignores', () => {
  // The range-equals-clamp law: a slider whose last three quarters did
  // nothing would be the same lie as an inoperable control. It used to
  // be stated over MouseLookSensitivity, which ran to 4.0 here against
  // DFU's 16.0 because lookSettings.js clamped there; ROAD-G G6 built
  // DFU's own sensitivity slider and widened the clamp instead, so
  // that row is DFU's range now and this pin reads the agreement
  // rather than a narrowing.
  for (const [key, law] of Object.entries(NUMBER_LAW)) {
    assert.ok(law.min < law.max, `${key}: empty range`);
    assert.ok(law.step > 0 && law.coarse >= law.step, `${key}: bad step`);
    assert.ok(law.source, `${key}: a range with no stated source is an invention`);
    if (!LIVE[key]) continue;
    const consumer = readFileSync(join(root, LIVE[key]), 'utf8');
    const re = new RegExp(`get(?:Int|Float)\\('${key.split('/')[0]}',\\s*'${key.split('/')[1]}',\\s*([\\d.]+),\\s*([\\d.]+)\\)`);
    const m = consumer.match(re);
    if (!m) continue;   // the consumer may read it via a named constant
    assert.equal(Number(m[1]), law.min, `${key}: the screen offers min ${law.min}, the consumer clamps at ${m[1]}`);
    assert.equal(Number(m[2]), law.max, `${key}: the screen offers max ${law.max}, the consumer clamps at ${m[2]}`);
  }
  // stepping never escapes the range
  for (const [key, law] of Object.entries(NUMBER_LAW)) {
    let v = String(law.min);
    for (let i = 0; i < 200; i++) v = stepValue(key, v, +1, true);
    assert.ok(Number(v) <= law.max, `${key}: stepping up escaped the max`);
    for (let i = 0; i < 200; i++) v = stepValue(key, v, -1, true);
    assert.ok(Number(v) >= law.min, `${key}: stepping down escaped the min`);
  }
});

test('MENU T6: tier is a GROUP - nothing is hidden, and the tally is computed', () => {
  _resetForTests();
  const canvas = { width: 1280, height: 800 };
  for (const cat of CATEGORY_IDS) {
    const w = new SettingsWindow({});
    w.category = cat;
    const L = w.layout(canvas);
    const t = w.tally(cat);
    // every key of the category is accounted for by the three tiers
    assert.equal(t.live + t.stored + t.unavailable, keysOf(cat).length, `${cat}: tally does not cover the category`);
    // a group with members always APPEARS, even when folded - a count
    // on screen is what stops a hidden setting being undiscoverable
    for (const [tier, id] of [['live', 'live'], ['stored', 'stored'], ['unavailable', 'na']]) {
      if (t[tier] > 0) {
        const g = L.list.items.find((i) => i.kind === 'group' && i.id === id);
        assert.ok(g, `${cat}: the ${id} group has ${t[tier]} members and is not on screen`);
        assert.equal(g.count, t[tier], `${cat}/${id}: the heading count must be computed, not typed`);
      }
    }
    // the header sentence is built from the same computed tally
    assert.ok(L.tallyText.includes(String(t.live)) && L.tallyText.includes(String(t.stored)));
    // no unavailable row exposes an operable control
    for (const it of L.list.placed) {
      if (it.kind === 'row' && it.tier === 'unavailable') {
        assert.ok(!L.hit.some((h) => h.id === `ctrl:${it.key}`), `${it.key}: an unavailable row offered a control`);
      }
    }
  }
});

test('MENU T8: THE TOUCH-REACHABILITY LAW, across the device matrix', () => {
  const SIZES = [[1920, 1080], [1280, 720], [1024, 768], [1180, 820], [844, 390], [390, 844], [360, 640], [320, 568]];
  for (const [W, H] of SIZES) {
    for (const textScale of [0, 1]) {
      const canvas = { width: W, height: H };
      const w = new SettingsWindow({});
      w.category = 'video';               // the longest list
      const L = w.layout(canvas);
      const m = L.m;
      // (d) body text is never smaller than the launcher already showed
      if (W >= 312 && H >= 300) assert.ok(m.s >= 2, `${W}x${H}: scale ${m.s} would shrink the type below today's launcher`);
      for (const h of L.hit) {
        // (a) every target is INSIDE the canvas, in screen pixels
        const sx = m.ox + h.rect[0] * m.s;
        const sy = m.oy + h.rect[1] * m.s;
        const sw = h.rect[2] * m.s;
        const sh = h.rect[3] * m.s;
        assert.ok(sx >= 0 && sy >= 0 && sx + sw <= W + 0.001 && sy + sh <= H + 0.001,
          `${W}x${H} ts${textScale}: ${h.id} is off-canvas (${sx},${sy} ${sw}x${sh})`);
      }
      // (c) PLAY exists everywhere, and (e) tapping it launches once
      const play = L.hit.find((h) => h.id === 'btn:play');
      assert.ok(play, `${W}x${H}: no PLAY button`);
      let launched = 0;
      const w2 = new SettingsWindow({ onLaunch: () => launched++ });
      w2.category = 'video';
      const L2 = w2.layout(canvas);
      const p2 = L2.hit.find((h) => h.id === 'btn:play').rect;
      w2.click(p2[0] + p2[2] / 2, p2[1] + p2[3] / 2, canvas);
      assert.equal(launched, 1, `${W}x${H}: tapping PLAY must launch exactly once`);
      // the hit test and the draw agree: the centre of every rect
      // resolves back to that rect's own id
      for (const h of L.hit) {
        const got = w.hitTest(L, h.rect[0] + h.rect[2] / 2, h.rect[1] + h.rect[3] / 2);
        assert.ok(got, `${W}x${H}: ${h.id} centre hits nothing`);
      }
    }
  }
});

test('MENU T13: the screen depends on no ARENA2 art and no 320x200 window', () => {
  // messageBox/listPicker both compute their own nativeMetrics and
  // need art nothing preloads before the game - reusing either would
  // draw an invisible panel that still ate input.
  for (const f of ['ui/settingsWindow.js', 'ui/settingsLaw.js', 'ui/settingsMap.js', 'ui/settingsCopy.js']) {
    const t = src(f);
    assert.ok(!/from '.*messageBox\.js'/.test(t), `${f} must not import messageBox`);
    assert.ok(!/from '.*listPicker\.js'/.test(t), `${f} must not import listPicker`);
    assert.ok(!/from '.*nativePanel\.js'[^\n]*nativeMetrics/.test(t) && !/\bnativeMetrics\(/.test(t),
      `${f} must use settingsMetrics, not nativeMetrics`);
  }
  // and the host boots audio, so a volume change can be heard
  const scene = readFileSync(join(root, 'src/scenes/launcherScene.js'), 'utf8');
  assert.ok(/ensureAudio/.test(scene), 'the host must boot audio - it runs before main.js does');
});

test('MENU T14: on a TOUCH device every control is a 44px finger target, pill or not', () => {
  // The browser probe (tools/settingsProbe.mjs) found this on its first
  // run: rows were TAP tall, but the control pill inside was inset by 4,
  // so the thing a finger actually aims at was 36 CSS px. Drawn size and
  // target size are two rects now, and this pin holds them apart.
  // (Canvas px == CSS px here; the probe re-checks that seam live.)
  const hadWindow = 'window' in globalThis;
  const saved = globalThis.window;
  globalThis.window = { ontouchstart: null };
  try {
    assert.equal(tapMin({ s: 2 }), 22, 'a touch device asks for 44/s page units');
    for (const [W, H] of [[390, 844], [360, 640], [844, 390], [1180, 820]]) {
      for (const cat of ['game', 'audio', 'graphics', 'controls', 'interface', 'gameplay', 'mods']) {
        const w = new SettingsWindow({});
        w.category = cat;
        // unfold every group: a folded group hides the rows we must
        // check, and _toggleGroup FLIPS - so ask the layout what is open
        for (let pass = 0; pass < 3; pass++) {
          const probe = w.layout({ width: W, height: H });
          const shut = probe.list.items.find((i) => i.kind === 'group' && !i.open);
          if (!shut) break;
          w._toggleGroup(shut.id);
        }
        const L = w.layout({ width: W, height: H });
        for (const h of L.hit) {
          const short = Math.min(h.rect[2], h.rect[3]) * L.m.s;
          assert.ok(short >= 44, `${W}x${H} ${cat}: ${h.id} is a ${short}px target - a finger is 44`);
        }
        for (const r of L.list.placed) {
          if (!r.ctrlHit) continue;
          assert.ok(r.ctrlHit[3] >= r.rect[3], `${cat}: ${r.key}'s target must span its row`);
          assert.ok(r.ctrlRect[3] <= r.ctrlHit[3], `${cat}: ${r.key}'s pill must not exceed its target`);
        }
      }
    }
  } finally {
    if (hadWindow) globalThis.window = saved; else delete globalThis.window;
  }
});

test('MENU T15: a number row shows the value IN EFFECT, and stepping cannot mint one that is not', () => {
  // The launcher this screen replaced had a defect its own merge audit
  // caught: the step came from the CURRENT value ('.' present -> 0.1),
  // so stepping 0.9 up stored "1", which has no '.', and the next press
  // stepped by ONE. A player who muted SoundVolume could never get back
  // to a fraction, and the row showed a "2" the audio bus clamps to 1.
  // The rewrite kills the first half structurally - the step is declared
  // per key, never read off the value - and this pin holds both halves.
  const step = stepValue('Controls/SoundVolume', '0', +1);
  assert.equal(step, '0.05', 'the step is the LAW\'s, not one inferred from the stored string');
  let v = '0';
  for (let i = 0; i < 60; i++) v = stepValue('Controls/SoundVolume', v, +1);
  assert.equal(v, '1', 'stepping up cannot escape the max');
  assert.equal(formatValue('Controls/SoundVolume', v), '100%');
  for (let i = 0; i < 60; i++) v = stepValue('Controls/SoundVolume', v, -1);
  assert.equal(v, '0', 'stepping down cannot escape the min');
  // and a value that is already out of range READS as what is in effect
  assert.equal(formatValue('Controls/SoundVolume', '2'), '100%', 'the bus runs 1, so the row says 100%');
  assert.equal(formatValue('Controls/SoundVolume', '-3'), '0%');
  // the same law for every numeric key, both ends, against the same
  // bounds its consumer clamps to
  for (const [key, law] of Object.entries(NUMBER_LAW)) {
    const hi = formatValue(key, String(law.max + Math.max(1, law.step)));
    assert.equal(hi, formatValue(key, String(law.max)), `${key}: over-max must read as the max in effect`);
    const lo = formatValue(key, String(law.min - Math.max(1, law.step)));
    assert.equal(lo, formatValue(key, String(law.min)), `${key}: under-min must read as the min in effect`);
    assert.equal(stepValue(key, String(law.max), +1), String(law.max === Math.round(law.max) && !String(law.step).includes('.') ? Math.round(law.max) : Number(law.max.toFixed(String(law.step).split('.')[1]?.length ?? 0))), `${key}: stepping past the max`);
  }
});

test('MENU T16: driving the screen by KEY, a muted volume comes back by fractions', () => {
  // Carried verbatim in intent from the launcher's merge-audit test
  // (test/settings.test.js, retired with LauncherWindow): the same
  // player action, driven end to end through the window that replaced
  // it. T15 pins the law at the unit; this pins that the SCREEN really
  // routes to it, which is where the original defect actually bit.
  _resetForTests();
  const canvas = { width: 1280, height: 800 };
  const w = new SettingsWindow({});
  w.category = 'audio';
  const L0 = w.layout(canvas);
  const idx = L0.list.items.findIndex((i) => i.kind === 'row' && i.key === 'Controls/SoundVolume');
  assert.ok(idx >= 0, 'Sound Volume must be reachable in Audio');
  w.focus = idx;
  const vol = () => Number(effectiveSettings().Controls.SoundVolume);
  const press = (dir) => w.input(dir < 0 ? 'ArrowLeft' : 'ArrowRight', { key: dir < 0 ? 'ArrowLeft' : 'ArrowRight' }, canvas);
  assert.equal(vol(), 0.5, 'DFU ships it at a half');
  for (let i = 0; i < 10; i++) press(-1);
  assert.equal(vol(), 0, 'ten presses mute it');
  press(-1);
  assert.equal(vol(), 0, 'and 0 is the floor');
  press(+1);
  assert.equal(vol(), 0.05, 'ONE press back up is a step, not the whole scale');
  for (let i = 0; i < 40; i++) press(+1);
  assert.equal(vol(), 1, 'and the top is 1 - never a 2 the audio bus would clamp away');
  assert.equal(w.layout(canvas).list.placed.find((r) => r.key === 'Controls/SoundVolume').display, '100%');
  _resetForTests();
});

test('M-EXT: the music-pack row is reachable, and BOTH input paths run its action', () => {
  // A feature reachable only by typing ?music is a feature nobody
  // finds. AssetInjection is DFU's own gate on replacement assets and
  // the port implements its SOUND half, so that row is where the
  // folder gets picked.
  let picked = 0;
  const win = new SettingsWindow({ onPickMusic: () => { picked++; } });
  const d = win._detail('Enhancements/AssetInjection');
  assert.ok(d.buttons.some((b) => b.id === 'pick'), 'the row offers a Choose Folder button');
  assert.equal(typeof d.onYes, 'function');

  // THE MOUSE PATH honours `onYes` - but only on the AFFIRMATIVE
  // BUTTON. AUDIT 26 F152: this used to run the action for a click
  // ANYWHERE, which is what made the drawn Cancel on Reset Everything
  // wipe every override. A drawn button is a real button, so the
  // click is hit-tested against the rects _drawDialog paints.
  const dlgCanvas = { width: 1280, height: 800 };
  win.dialog = win._detail('Enhancements/AssetInjection');
  const yesRect = win.layout(dlgCanvas).dialog.buttons[0].rect;
  win.click(yesRect[0] + 1, yesRect[1] + 1, dlgCanvas);
  assert.equal(picked, 1, 'a click on the affirmative button runs the action');
  assert.equal(win.dialog, null, 'and closes the dialog');

  // The LAST button is Close, and it is not the affirmative.
  win.dialog = win._detail('Enhancements/AssetInjection');
  const closeRect = win.layout(dlgCanvas).dialog.buttons.at(-1).rect;
  win.click(closeRect[0] + 1, closeRect[1] + 1, dlgCanvas);
  assert.equal(picked, 1, 'Close declines');
  assert.equal(win.dialog, null);

  // ...and so does a click that lands on no button at all.
  win.dialog = win._detail('Enhancements/AssetInjection');
  win.click(0, 0, dlgCanvas);
  assert.equal(picked, 1, 'a click outside the buttons declines');
  assert.equal(win.dialog, null);

  // ...and THE KEYBOARD PATH did NOT, which is the divergence this
  // fixes. Nothing set onYes on a settings dialog before, so it was
  // latent: the first dialog to carry an action would have worked on
  // click and done nothing on Enter.
  win.dialog = win._detail('Enhancements/AssetInjection');
  win.input('Enter', null, { width: 1280, height: 800 });
  assert.equal(picked, 2, 'Enter runs the action too');
  assert.equal(win.dialog, null);

  // ESCAPE IS A REFUSAL on both paths - it must not pick anything.
  win.dialog = win._detail('Enhancements/AssetInjection');
  win.input('Escape', null, { width: 1280, height: 800 });
  assert.equal(picked, 2, 'Escape declines');
  assert.equal(win.dialog, null);

  // A HOST THAT CANNOT PICK FILES gets the explanation and no button,
  // rather than a control that does nothing - the same anti-lie rule
  // the blocked rows follow.
  const headless = new SettingsWindow({});
  const plain = headless._detail('Enhancements/AssetInjection');
  assert.ok(!plain.buttons.some((b) => b.id === 'pick'));
  assert.equal(plain.onYes, undefined);
});

test('M-EXT: the confirm this shares its path with still works', () => {
  // `onYes` was inserted AHEAD of the ShowOptionsAtStart confirm, which
  // is the one action that path already carried. Both arms have to
  // survive: a dialog with onYes runs it, a dialog without falls
  // through to the commit.
  _resetForTests();
  const win = new SettingsWindow({});
  win.dialog = {
    title: 'x', key: 'GUI/ShowOptionsAtStart', lines: [],
    buttons: [{ id: 'yes', label: 'Turn Off' }, { id: 'no', label: 'Keep It' }],
  };
  win.input('Enter', null, { width: 1280, height: 800 });
  assert.equal(effectiveSettings().GUI.ShowOptionsAtStart, 'False',
    'the lock-out confirm still commits');
  _resetForTests();
});
