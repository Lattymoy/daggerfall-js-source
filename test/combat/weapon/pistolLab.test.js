// THE PISTOL LAB's own laws, pinned (bible/05-Combat/Pistol-Lab.md). The
// lab is a prototype and the game draws nothing of it - so what is
// pinned is what it adds (the strip, the 1-bit cut, native size, the
// pair's trigger) and that what it BORROWS it runs: the game's gun frame,
// the gun's feel, the Two-Hands law. A borrowed law restated beside its
// home is the drift FIELD-GUN12 spent five rounds undoing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PISTOL_STRIP, PISTOL_OPENING, PAIR_TRIGGER, stripCellRect, hardenAlpha, nativeWidthPct, createPair,
  strikeHandOf, guardOffset, GUARD, FLURRY_WINDOW, gunFrameRect, createWidgetRig, ALIGN, SFX_CANDIDATES, pistolPageState,
} from '../../../src/tools/pistolLab.js';
import { strikeHandOf as LAW_STRIKE, guardOffset as LAW_GUARD } from '../../../src/combat/twoHands/handsLaw.js';
import { gunFrameRect as GAME_FRAME } from '../../../src/combat/gun/gunViewmodel.js';
import { readPng } from '../../../tools/pngIO.mjs';

const page = () => readFileSync('pistol-proto.html', 'utf8');

test('the lab is a lab: nothing the game runs imports it', () => {
  for (const f of [
    'src/combat/weapon/weaponRig.js', 'src/combat/fpsWeapon.js', 'src/combat/weapon/weaponWidget.js',
    'src/combat/weapon/weaponWidgetMotion.js', 'src/combat/gun/gunViewmodel.js', 'src/combat/twoHands/handsLaw.js',
    'src/combat/twoHands/twoHands.js', 'src/systems/thunderlock.js',
    // AUDIT PISTOLET D31: and the modules the lab graduated into the game
    'src/systems/pistolet.js', 'src/combat/gun/pistoletArt.js', 'src/combat/gun/pistolStrip.js',
    'src/combat/gun/gunFeel.js', 'src/combat/playerWeapon.js',
    // PIN MOVED (PISTOL-PORT): combat/gun/gunPair.js is gone - the page's own machine, pair and frame moved into the game
    'src/combat/gun/gunMachine.js', 'src/combat/gun/pistolPair.js', 'src/combat/gun/pistolViewmodel.js', 'src/combat/gun/pistolLane.js',
  ]) {
    // a side-effect import (`import '...pistolLab.js'`) is an import too
    assert.doesNotMatch(readFileSync(f, 'utf8'), /^\s*import\s+(?:[\s\S]*?from\s+)?'[^']*pistolLab/m, `${f} does not import the lab`);
  }
  assert.ok(page().includes("from '/src/tools/pistolLab.js'"), 'the page is the consumer');
});

test('what it borrows is RUN, not restated: the game’s frame and the Two-Hands law, by identity', () => {
  assert.equal(gunFrameRect, GAME_FRAME, 'combat/gun/gunViewmodel.js gunFrameRect itself');
  assert.equal(strikeHandOf, LAW_STRIKE, 'handsLaw.strikeHandOf itself - the flurry the swords obey');
  assert.equal(guardOffset, LAW_GUARD, 'handsLaw.guardOffset itself');
  // AUDIT 68 S08's law, held for the second lab: the page composes its
  // frame through the game's and never calls the steps inside it
  // PIN MOVED (PISTOL-PORT): through pistolHandRect, the game's own draw block, which runs gunFrameRect
  // (test/combat/gun/pistolport.test.js holds the rest of the page to the game's frame)
  const html = page();
  // PIN MOVED (AUDIT PISTOL-PORT D7): the page asks its panel's rect of the lab module, which runs pistolHandRect
  assert.match(html, /\bpistolPageRect\(hands, hd, state, art, canvas\)/);
  assert.match(readFileSync('src/tools/pistolLab.js', 'utf8'), /=> pistolHandRect\(hands, h, \{/);
  for (const step of ['placeSprite(', 'widgetTransformRect(', 'unionDrawRect(']) {
    assert.ok(!html.includes(step), `the page calls ${step} itself - a second copy of the frame the game draws`);
  }
});

test('the strip is the owner’s six frames, 88x113 each, side by side', () => {
  const png = readPng(readFileSync(`public/art/${PISTOL_STRIP.file}`));
  assert.equal(png.width, PISTOL_STRIP.cellW * PISTOL_STRIP.frames);
  assert.equal(png.height, PISTOL_STRIP.cellH);
  assert.deepEqual([PISTOL_STRIP.frames, PISTOL_STRIP.cellW, PISTOL_STRIP.cellH], [6, 88, 113]);
  assert.deepEqual(Array.from({ length: 6 }, (_, i) => stripCellRect(i).x), [0, 88, 176, 264, 352, 440]);
  const cell = (i) => {
    const out = [];
    for (let y = 0; y < png.height; y++) out.push(...png.data.subarray((y * png.width + i * 88) * 4, (y * png.width + i * 88 + 88) * 4));
    return out;
  };
  // the art's own timing, which the lab plays as given: 3 = 6, 4 = 5
  assert.deepEqual(cell(2), cell(5), 'frames 3 and 6 are one picture (settling)');
  assert.deepEqual(cell(3), cell(4), 'frames 4 and 5 are one picture (the hold, muzzle up)');
  assert.notDeepEqual(cell(0), cell(1), 'the shot is its own picture');
  // REGISTERED BY THE CANVAS: the forearm leaves every frame through the
  // bottom-right corner, so one corner anchors all six
  for (let i = 0; i < 6; i++) {
    const p = ((png.height - 1) * png.width + i * 88 + 87) * 4;
    assert.equal(png.data[p + 3], 255, `frame ${i + 1}: the arm is cut on the canvas corner`);
  }
  // public/ is the static root: the file is on the doctrine's allow-list
  assert.ok(readFileSync('test/tooling/doctrine.test.js', 'utf8').includes(`'public/art/${PISTOL_STRIP.file}'`));
});

test('the 1-bit cut: the screen quad’s 0.5, nothing between 0 and 255', () => {
  const data = new Uint8ClampedArray([0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 127, 0, 0, 0, 128, 0, 0, 0, 200, 0, 0, 0, 255]);
  const cleared = hardenAlpha({ data });
  assert.deepEqual([3, 7, 11, 15, 19, 23].map((i) => data[i]), [0, 0, 0, 255, 255, 255], 'the default cut is 128 - drawScreenQuad’s 0.5');
  assert.equal(cleared, 2, 'it counts the soft texels it took');
  assert.equal(PISTOL_OPENING.alphaCut, 128);
  // the real art is soft (an antialiased fringe, the flash's glow), so the cut is not a no-op on it
  const png = readPng(readFileSync(`public/art/${PISTOL_STRIP.file}`));
  const soft = () => { let n = 0; for (let p = 3; p < png.data.length; p += 4) if (png.data[p] && png.data[p] !== 255) n++; return n; };
  assert.ok(soft() > 1000, `the file keeps the art's own soft alpha (${soft()} texels) - the lab cuts it live`);
  hardenAlpha(png);
  assert.equal(soft(), 0);
});

test('native size: one art pixel is one design pixel at scale 1', () => {
  assert.equal(nativeWidthPct(82), 82 / 320);
  assert.equal(nativeWidthPct(82, 2), 82 / 160);
  // through the game's own frame: at 1x the anchor is its art width in design units
  const anchor = { x: 6, y: 12, w: 82, h: 101 }, union = { x: 0, y: 9, w: 88, h: 104 };
  const { anchorRect, rect } = gunFrameRect({
    canvasW: 1280, canvasH: 800, anchor, union, rig: createWidgetRig(),
    widthPct: nativeWidthPct(anchor.w), align: ALIGN.Right, offset: 0, raise: 0,
  });
  assert.ok(Math.abs(anchorRect.w - 82 * 4) < 1e-9 && Math.abs(anchorRect.h - 101 * 4) < 1e-9, '4x the art on a 1280-wide window');
  // the forearm's cut lands on the view's corner: the union and the anchor share it
  assert.ok(Math.abs(rect.x + rect.w - 1280) < 1e-9 && Math.abs(rect.y + rect.h - 800) < 1e-9, 'flush to the bottom-right');
  // and the mirror puts the left pistol's cut on the other corner
  const left = gunFrameRect({
    canvasW: 1280, canvasH: 800, anchor, union, rig: createWidgetRig(), flip: true,
    widthPct: nativeWidthPct(anchor.w), align: ALIGN.Right, offset: 0, raise: 0,
  });
  assert.ok(Math.abs(left.rect.x) < 1e-9 && Math.abs(left.rect.x - (1280 - rect.x - rect.w)) < 1e-9, 'the left hand is the right in the glass');
});

const run = (pair, seconds, dt = 1 / 60) => { for (let t = 0; t < seconds; t += dt) pair.step(dt); };

test('alternate: the lead opens, a quick second pull is the other hand’s - the game’s flurry', () => {
  const pair = createPair({ fps: 12, cooldownMs: 1400, hitFrame: 1 });
  assert.equal(pair.trigger, PAIR_TRIGGER.Alternate, 'the pair opens on the flurry');
  assert.deepEqual(pair.pull(), ['R'], 'the lead (right) opens');
  assert.equal(pair.lastShot.off, false);
  run(pair, 0.1);
  assert.deepEqual(pair.pull(), ['L'], 'mid-shot, the other hand');
  assert.equal(pair.lastShot.off, true, 'the left is the off hand');
  assert.equal(pair.lastShot.flurry, true);
  assert.deepEqual(pair.order, ['R', 'L'], 'the hand that fired last is drawn over the other');
  // both are spent: a pull is a click on nothing
  run(pair, 0.1);
  assert.deepEqual(pair.pull(), []);
  // past the window and both reloaded, the lead opens again
  run(pair, 0.5 + 1.4 + FLURRY_WINDOW + 0.1);
  assert.deepEqual(pair.pull(), ['R']);
  // lead left: the left opens
  const l = createPair({ lead: 'L' });
  assert.deepEqual(l.pull(), ['L']);
  assert.equal(l.lastShot.off, false, 'the lead is never the off hand');
});

test('alternate’s one departure: the pull falls to the loaded pistol', () => {
  // A sword can always swing; a pistol mid-reload cannot fire. The law
  // names the right (the lead, past the window) - and the right is
  // still reloading, so the trigger finds the left.
  const pair = createPair({ fps: 12, cooldownMs: 3000 });
  pair.pull();                                   // R fires
  run(pair, 0.5 + FLURRY_WINDOW + 0.2);          // R's frames end, then past the window; R still reloading
  assert.equal(pair.R.state, 'Cooling');
  assert.equal(strikeHandOf({ mode: 'dual', lead: 'R', last: 'R', sinceLast: FLURRY_WINDOW + 0.2 }).hand, 'R', 'the law names the right');
  assert.deepEqual(pair.pull(), ['L'], 'the left is loaded, so the left fires');
});

test('volley fires both on one pull, per-hand gives each hand its button, single is one pistol', () => {
  const v = createPair({ trigger: PAIR_TRIGGER.Volley });
  assert.deepEqual(v.pull(), ['R', 'L']);
  assert.deepEqual(v.pull(), [], 'one shot each, then reload');
  const p = createPair({ trigger: PAIR_TRIGGER.PerHand });
  assert.deepEqual(p.pull(2), ['L'], 'the right mouse button, the left pistol');
  assert.deepEqual(p.pull(0), ['R']);
  const s = createPair({ trigger: PAIR_TRIGGER.Single });
  assert.deepEqual(s.hands(), ['R'], 'one pistol drawn');
  assert.deepEqual(s.pull(), ['R']);
  run(s, 0.1);
  assert.deepEqual(s.pull(), [], 'the one used hand is DFU’s - no second pistol to fall to');
  s.lead = 'L';
  assert.deepEqual(s.hands(), ['L'], 'a left-handed single is the mirror');
});

test('the resting pistol lowers a share of its height while the other fires (handsLaw GUARD)', () => {
  const [x, y] = guardOffset(1, 'left', { height: 101 });
  assert.equal(x, 0, 'straight down - the cut side stays on the view’s edge');
  assert.ok(Math.abs(y - GUARD.LOWER * 101) < 1e-9);
});

test('the owner\u2019s numbers, exactly (PISTOL-LAB 2: "Must be these values/sounds exactly")', () => {
  // read off the owner's two screenshots of the panel, 2026-10-21 - a
  // change here is the owner's to make, and must be made on purpose
  assert.deepEqual({ ...PISTOL_OPENING, widget: { ...PISTOL_OPENING.widget } }, {
    scale: 1.05, raise: -60, offset: 0,
    fps: 12, reloadMs: 1400, hitFrame: 1,
    kick: 3, back: 0, stiff: 400, damp: 36,
    shake: 20, shakeRot: 2.5, shakeFreq: 60, shakeDecay: 5,
    drop: 0.7, alphaCut: 128,
    sfxFire: 'fire-shotgun', sfxOpen: 'open-shell', sfxClose: 'close-ready', sfxVol: 1, sfxVary: 0.19,
    widget: {
      'Offset.Speed': 1,
      'Bob.Length': 146, 'Bob.SizeX': 1, 'Bob.SizeY': 0.7, 'Bob.SpeedMove': 1, 'Bob.SpeedState': 1,
      'Bob.Shape': 0, 'Bob.BobWhileIdle': true,
      'Inertia.Scale': 2, 'Inertia.Speed': 2, 'Inertia.ForwardDepth': 0, 'Inertia.ForwardSpeed': 1,
    },
    light: 0.6,   // AUDIT PISTOLET B5: the muzzle light the lab opened on as a literal, now the feel's own (PISTOLET_FEEL.flashLight)
  });
  // every pick is a clip the lab offers, and the clip ships
  for (const [slot, name] of [['fire', 'sfxFire'], ['reload-open', 'sfxOpen'], ['reload-close', 'sfxClose']]) {
    assert.ok(SFX_CANDIDATES[slot].some(([n]) => n === PISTOL_OPENING[name]), `${PISTOL_OPENING[name]} is a ${slot} candidate`);
    assert.ok(readFileSync(`public/sfx/${PISTOL_OPENING[name]}.wav`).length > 1000);
  }
});

test('the page opens on the row: state is read from it, and every control is set from state before it is bound', () => {
  const html = page();
  // PIN MOVED (AUDIT PISTOL-PORT D7): the state is the lab module's (pistolPageState), which the port's pins run - read
  // here off the row by value, not by the page's text
  assert.match(html, /const state = pistolPageState\(\);/);
  const st = pistolPageState();
  for (const k of ['scale', 'raise', 'kick', 'shake', 'drop', 'alphaCut']) assert.equal(st[k], PISTOL_OPENING[k], `state.${k} is the row's`);
  assert.equal(st.sfxFire, PISTOL_OPENING.sfxFire);
  assert.equal(st.bobLength, PISTOL_OPENING.widget['Bob.Length']);
  assert.equal(st.inFwd, PISTOL_OPENING.widget['Inertia.ForwardDepth']);
  // the sync runs before the binding - the markup's value= cannot win
  assert.ok(html.indexOf("el.checked = !!state[id]; else el.value = String(state[id]);") < html.indexOf('for (const id of CONTROLS) bind(id);'));
  // and the markup agrees anyway, so a reader of the HTML is not misled
  for (const [id, v] of [['scale', 1.05], ['raise', -60], ['bobLength', 146], ['bobSizeY', 0.7], ['inScale', 2], ['inSpeed', 2], ['inFwd', 0]]) {
    assert.match(html, new RegExp(`id="${id}"[^>]*value="${v}"`), `the ${id} slider's markup says ${v}`);
  }
});

test('its own deploy: vite.config.pistol.js builds the lab alone and deploy.yml mounts it', async () => {
  const cfg = (await import('../../../vite.config.pistol.js')).default;
  assert.equal(cfg.base, './', 'relative, so it runs from any directory');
  assert.deepEqual(Object.values(cfg.build.rollupOptions.input), ['pistol-proto.html']);
  assert.match(readFileSync('vite.config.pistol.js', 'utf8'), /const ART = \['pistol-frames\.png'\];/);
  const deploy = readFileSync('.github/workflows/deploy.yml', 'utf8');
  assert.match(deploy, /npx vite build --config vite\.config\.pistol\.js/);
  assert.match(deploy, /cp -a production\/dist-pistol\/\. site\/preview\/pistol-lab\//);
});
