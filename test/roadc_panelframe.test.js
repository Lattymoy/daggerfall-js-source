// ROAD-C c2/S2: THE PANEL BRACKET, inside the renderer, before any
// consumer. One Renderer serves the whole session and a panel pass
// sets a dozen globals per frame; the mitigation is structural, not
// vigilant - the renderer owns the save and the return (EV6), the
// return runs in a `finally`, and the SOURCE PIN at the bottom names
// every setter so no automap file can call one outside the bracket.
//
// The two sharp edges, pinned as values: SCISSOR_TEST also gates
// gl.clear (so a leaked scissor silently blanks the NEXT host frame's
// clear rather than erroring, and the scissor must be armed BEFORE
// beginFrame), and beginFrame re-sets the viewport to the full canvas
// (so the panel viewport must be set AFTER it).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { identity } from '../src/world/mat4.js';
import { Renderer, PANEL_CLEAR_RGBA, AUTOMAP_PANEL_NATIVE_RECT } from '../src/render/renderer.js';
import { nativeMetrics } from '../src/ui/nativePanel.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => readFileSync(join(ROOT, p), 'utf8');

/** The EV6 counting Proxy-GL, grown a call LOG (name + args). */
function recordingRenderer(log, canvasSize = { w: 640, h: 400 }) {
  const stub = new Proxy({}, {
    get: (o, k) => {
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation' || k === 'getAttribLocation') return () => ({});
      if (k === 'createTexture' || k === 'createBuffer' || k === 'createVertexArray'
        || k === 'createProgram' || k === 'createShader' || k === 'createFramebuffer') return () => ({});
      if (k === 'getParameter') return () => new Float32Array([0, 0, 0, 0]);
      if (typeof k === 'string' && k.toUpperCase() === k) return k;   // GL enums answer their own name
      return (...args) => { log.push([k, ...args]); };
    },
  });
  const canvas = {
    getContext: () => stub, clientWidth: canvasSize.w, clientHeight: canvasSize.h, width: canvasSize.w, height: canvasSize.h,
  };
  const r = new Renderer(canvas);
  log.length = 0;   // drop the construction chatter
  return r;
}

const idx = (log, name, pred = () => true) => log.findIndex((c) => c[0] === name && pred(c));
const calls = (log, name) => log.filter((c) => c[0] === name);

const PANEL = { x: 10, y: 20, w: 318, h: 169 };

test('c2/S2 the ordering: scissor ON before beginFrame, viewport set AFTER it, both closed on exit', () => {
  const log = [];
  const r = recordingRenderer(log);
  r.beginPanelFrame(identity(), identity(), new Float32Array([0, 1, 0]), PANEL);

  const iEnable = idx(log, 'enable', (c) => c[1] === 'SCISSOR_TEST');
  const iScissor = idx(log, 'scissor');
  const iClear = idx(log, 'clear');
  assert.ok(iEnable >= 0 && iScissor >= 0 && iClear >= 0, 'all three happen');
  assert.ok(iEnable < iClear, 'SCISSOR_TEST is enabled BEFORE the clear it gates');
  assert.ok(iScissor < iClear, 'and the rect is set before it too');

  // the viewport: beginFrame sets the FULL canvas, the bracket sets
  // the panel AFTER it - so the LAST viewport inside the bracket is
  // the panel's, in GL's bottom-left space
  const vps = calls(log, 'viewport');
  assert.deepEqual(vps[0].slice(1), [0, 0, 640, 400], 'beginFrame still takes the full canvas first');
  assert.deepEqual(vps[vps.length - 1].slice(1), [10, 400 - (20 + 169), 318, 169], 'the panel viewport lands after it');

  // the colour half of beginFrame's clear is masked off - a DEPTH-ONLY
  // clear, because the panel draws OVER the background already there
  const iMaskOff = idx(log, 'colorMask', (c) => c[1] === false);
  const iMaskOn = idx(log, 'colorMask', (c) => c[1] === true);
  assert.ok(iMaskOff >= 0 && iMaskOff < iClear, 'colorMask is off across the clear');
  assert.ok(iMaskOn > iClear, 'and back on straight after');

  log.length = 0;
  r.endPanelFrame();
  assert.ok(idx(log, 'disable', (c) => c[1] === 'SCISSOR_TEST') >= 0, 'the scissor is disabled on the way out');
  const outVp = calls(log, 'viewport').pop();
  assert.deepEqual(outVp.slice(1), [0, 0, 640, 400], 'and the full canvas comes back');
});

test('c2/S2 every named global is written and written BACK to its entry value', () => {
  const log = [];
  const r = recordingRenderer(log);
  // a distinctive entry state on every global the bracket names
  r.setScreenOffset(7, 9);
  r.setClipY(12.5);
  r.setAutomapMode(2);
  r.setFog('linear', 0.25, 3, 44, new Float32Array([0.1, 0.2, 0.3]));
  r.setLighting(new Float32Array([0.11, 0.22, 0.33]), 0.44, new Float32Array([0.5, 0.6, 0.7]));
  r.setMoonlight({ scale: 0.8, dir: [0, 1, 0], color: [0.9, 0.9, 1] });
  r.setWindowEmission(new Float32Array([0.3, 0.4, 0.5]));
  r.setPointLights(new Float32Array([1, 2, 3, 4]), new Float32Array([1, 0, 0]));
  r.setIndirectLight([5, 6, 7], 8, new Float32Array([0.2, 0.3, 0.4]));
  r._clearColor.set([0.53, 0.7, 0.92, 1]);

  const before = {
    screenOffset: [...r.screenOffset],
    clipY: r._clipY,
    automapMode: r._automapMode,
    fogMode: r._fogMode, fogDensity: r._fogDensity, fogRange: [...r._fogRange], fogColor: [...r._fogColor],
    ambient: [...r._ambient], sunScale: r._sunScale, sunColor: [...r._sunColor], clockLit: r._clockLit,
    moonScale: r._moonScale, moonDir: [...r._moonDir], moonColor: [...r._moonColor],
    windowEmission: [...r._windowEmission],
    pointLights: [...r._pointLights], pointColor: [...r._pointColor],
    indirect: [...r._indirect], indirectColor: [...r._indirectColor],
    clearColor: [...r._clearColor],
  };

  r.panelFrame({
    proj: identity(), view: identity(), lightDir: new Float32Array([0, 1, 0]), rect: PANEL,
    setup: () => {
      r.setFog('off');
      r.setLighting(new Float32Array([1, 1, 1]), 0);
      r.setMoonlight(null);
      r.setWindowEmission(new Float32Array([0, 0, 0]));
      r.setPointLights(new Float32Array([]), new Float32Array([0, 0, 0]));
      r.setIndirectLight([0, 0, 0], 0, new Float32Array([0, 0, 0]));
    },
  }, () => {
    // the body mutates everything the pass is allowed to mutate
    r.setClipY(3);
    r.setAutomapMode(1);
    r.setScreenOffset(100, 100);
    assert.equal(r._fogMode, 0, 'the pass really is running with its own fog');
    assert.equal(r._clipY, 3);
  });

  assert.deepEqual([...r.screenOffset], before.screenOffset, 'screenOffset');
  assert.equal(r._clipY, before.clipY, 'clipY');
  assert.equal(r._automapMode, before.automapMode, 'automapMode');
  assert.equal(r._fogMode, before.fogMode, 'fog mode');
  assert.equal(r._fogDensity, before.fogDensity, 'fog density');
  assert.deepEqual([...r._fogRange], before.fogRange, 'fog range');
  assert.deepEqual([...r._fogColor], before.fogColor, 'fog colour');
  assert.deepEqual([...r._ambient], before.ambient, 'ambient');
  assert.equal(r._sunScale, before.sunScale, 'sun scale');
  assert.deepEqual([...r._sunColor], before.sunColor, 'sun colour');
  assert.equal(r._clockLit, before.clockLit, 'the clock-lit flag setLighting raises');
  assert.equal(r._moonScale, before.moonScale, 'moon scale');
  assert.deepEqual([...r._moonDir], before.moonDir, 'moon dir');
  assert.deepEqual([...r._moonColor], before.moonColor, 'moon colour');
  assert.deepEqual([...r._windowEmission], before.windowEmission, 'window emission');
  assert.deepEqual([...r._pointLights], before.pointLights, 'point lights');
  assert.deepEqual([...r._pointColor], before.pointColor, 'point colour');
  assert.deepEqual([...r._indirect], before.indirect, 'indirect light');
  assert.deepEqual([...r._indirectColor], before.indirectColor, 'indirect colour');
  assert.deepEqual([...r._clearColor], before.clearColor, 'the clear-colour shadow');
  const cc = calls(log, 'clearColor').pop();
  assert.deepEqual(cc.slice(1), before.clearColor, 'and GL itself was handed it back');
});

test('c2/S2 the return runs in a finally - a THROWING body still hands the state back', () => {
  const log = [];
  const r = recordingRenderer(log);
  r.setClipY(9);
  r.setScreenOffset(4, 4);
  const boom = new Error('the pass exploded');
  assert.throws(() => r.panelFrame({
    proj: identity(), view: identity(), lightDir: new Float32Array([0, 1, 0]), rect: PANEL,
  }, () => { r.setClipY(1); throw boom; }), /the pass exploded/);
  assert.equal(r._clipY, 9, 'the slice came back');
  assert.deepEqual([...r.screenOffset], [4, 4], 'the screen offset came back');
  assert.ok(idx(log, 'disable', (c) => c[1] === 'SCISSOR_TEST') >= 0,
    'THE SCISSOR CAME OFF - a leaked one silently blanks the next host frame clear');
  assert.equal(r._panelSaved, null, 'and the bracket is closed, so the next pass can open');
  // proving it: a second pass opens fine after the throw
  assert.doesNotThrow(() => r.panelFrame({ proj: identity(), view: identity(), lightDir: new Float32Array([0, 1, 0]), rect: PANEL }, () => {}));
});

test('c2/S2 markForeignPass fires EXACTLY once on exit, and re-entry is refused', () => {
  const log = [];
  const r = recordingRenderer(log);
  let foreign = 0;
  const real = r.markForeignPass.bind(r);
  r.markForeignPass = () => { foreign++; real(); };

  r.panelFrame({ proj: identity(), view: identity(), lightDir: new Float32Array([0, 1, 0]), rect: PANEL }, () => {});
  assert.equal(foreign, 1, 'once - the pass ran its own programs, the shadows are not to be trusted');

  r.beginPanelFrame(identity(), identity(), new Float32Array([0, 1, 0]), PANEL);
  assert.throws(() => r.beginPanelFrame(identity(), identity(), new Float32Array([0, 1, 0]), PANEL), /already inside a panel frame/);
  r.endPanelFrame();
  assert.equal(foreign, 2);
  r.endPanelFrame();   // idempotent - a double close is a no-op, never a second foreign pass
  assert.equal(foreign, 2);
});

test('c2/S2 the clear is DFU\'s: Unity default background, BLENDED, never an opaque black clear', () => {
  // (49, 77, 121, 5) / 255 - clearFlags = SolidColor (Automap.cs:2012)
  // with backgroundColor never assigned anywhere in the file. The 5/255
  // alpha is the feature: it is what lets AMAP00I0's map-area art and
  // the three alternative backgrounds show through empty map space.
  assert.equal(PANEL_CLEAR_RGBA.length, 4);
  assert.equal(PANEL_CLEAR_RGBA[0], 49 / 255);
  assert.equal(PANEL_CLEAR_RGBA[1], 77 / 255);
  assert.equal(PANEL_CLEAR_RGBA[2], 121 / 255);
  assert.equal(PANEL_CLEAR_RGBA[3], 5 / 255);
  assert.ok(PANEL_CLEAR_RGBA[3] < 0.02, 'TWO PERCENT alpha - an opaque clear deletes the background feature');
  assert.equal(Math.round(PANEL_CLEAR_RGBA[0] * 1e6) / 1e6, 0.192157);
  assert.equal(Math.round(PANEL_CLEAR_RGBA[1] * 1e6) / 1e6, 0.301961);
  assert.equal(Math.round(PANEL_CLEAR_RGBA[2] * 1e6) / 1e6, 0.47451);
  assert.equal(Math.round(PANEL_CLEAR_RGBA[3] * 1e6) / 1e6, 0.019608);

  // the quad, not a gl.clear: the alpha is under 1 so screenQuadBlends
  // turns blending ON (renderer.js:520)
  const log = [];
  const r = recordingRenderer(log);
  r.beginPanelFrame(identity(), identity(), new Float32Array([0, 1, 0]), PANEL);
  const iBlend = idx(log, 'enable', (c) => c[1] === 'BLEND');
  const iDraw = idx(log, 'drawElements');
  assert.ok(iBlend >= 0 && iDraw > iBlend, 'the clear quad is drawn BLENDED');
  // and only ONE gl.clear happened in the whole bracket (beginFrame's,
  // colour-masked to depth)
  assert.equal(calls(log, 'clear').length, 1, 'exactly one gl.clear, and its colour half is masked off');
  r.endPanelFrame();

  // a caller CAN ask for an opaque clear (the bank preview's camera
  // really does clear black) - alpha 1 draws unblended
  const log2 = [];
  const r2 = recordingRenderer(log2);
  r2.beginPanelFrame(identity(), identity(), new Float32Array([0, 1, 0]), PANEL, [0, 0, 0, 1]);
  assert.equal(idx(log2, 'enable', (c) => c[1] === 'BLEND'), -1, 'an opaque clear quad needs no blending');
  r2.endPanelFrame();
});

test('c2/S2 the panel rect is DFU (1,1,318,169) under the nativePanel metric at three integer scales', () => {
  assert.deepEqual({ ...AUTOMAP_PANEL_NATIVE_RECT }, { x: 1, y: 1, w: 318, h: 169 },
    'DaggerfallAutomapWindow.cs:358-360 and DaggerfallExteriorAutomapWindow.cs:335-336, the same rect');
  for (const [w, h, s] of [[320, 200, 1], [640, 400, 2], [1280, 800, 4]]) {
    const m = nativeMetrics({ width: w, height: h });
    assert.equal(m.s, s, `scale ${s}`);
    const rect = {
      x: m.ox + AUTOMAP_PANEL_NATIVE_RECT.x * m.s, y: m.oy + AUTOMAP_PANEL_NATIVE_RECT.y * m.s,
      w: AUTOMAP_PANEL_NATIVE_RECT.w * m.s, h: AUTOMAP_PANEL_NATIVE_RECT.h * m.s,
    };
    assert.deepEqual(rect, { x: s, y: s, w: 318 * s, h: 169 * s });
    // and the viewport the bracket derives from it stays inside the canvas
    const log = [];
    const r = recordingRenderer(log, { w, h });
    r.beginPanelFrame(identity(), identity(), new Float32Array([0, 1, 0]), rect);
    const vp = calls(log, 'viewport').pop().slice(1);
    assert.deepEqual(vp, [s, h - (s + 169 * s), 318 * s, 169 * s]);
    assert.ok(vp[1] >= 0 && vp[0] + vp[2] <= w && vp[1] + vp[3] <= h, 'the panel fits the canvas');
    r.endPanelFrame();
  }
  // a letterboxed canvas keeps the offset
  const m = nativeMetrics({ width: 700, height: 400 });
  assert.equal(m.s, 2);
  assert.equal(m.ox, Math.floor((700 - 640) / 2));
});

test('c2/S2 SOURCE PIN: no automap file, and no host, may set renderer GL state outside the bracket', () => {
  // The bracket's whole value is that it is the ONE place that must
  // learn a thirteenth global. Nothing enforces that but this pin, so
  // it names the setters.
  const SETTERS = [
    'setScreenScissor', 'clearScreenScissor', 'setScreenOffset', 'setFog', 'setLighting',
    'setMoonlight', 'setWindowEmission', 'setPointLights', 'setIndirectLight',
  ];
  const rend = src('src/render/renderer.js');
  const begun = rend.slice(rend.indexOf('beginPanelFrame('), rend.indexOf('panelFrame({ proj'));
  for (const setter of SETTERS) {
    assert.ok(begun.includes(setter) || begun.includes(setter.replace(/^set/, '_')),
      `the bracket handles ${setter}`);
  }
  // every saved field is also restored
  const saved = [...begun.matchAll(/^\s{6}(\w+):/gm)].map((mm) => mm[1]).filter((k) => k !== 'rect');
  assert.ok(saved.length >= 24, `the bracket saves the whole surface (${saved.length} fields)`);
  for (const f of saved) {
    assert.ok(begun.includes(`s.${f}`), `${f} is saved AND restored`);
  }

  for (const f of ['src/ui/automapWindow.js', 'src/ui/exteriorAutomapWindow.js']) {
    const body = src(f);
    for (const setter of ['setScreenScissor', 'clearScreenScissor', 'setFog', 'setLighting', 'setMoonlight', 'setScreenOffset']) {
      const outside = new RegExp(`renderer\\.${setter}\\(`, 'g');
      const hits = [...body.matchAll(outside)];
      for (const h of hits) {
        const before = body.slice(0, h.index);
        assert.ok(before.lastIndexOf('setup:') > before.lastIndexOf('panelFrame('),
          `${f}: ${setter} is called outside the bracket's setup`);
      }
    }
    assert.equal(/renderer\.beginFrame\(/.test(body), false, `${f}: no window opens a raw frame any more`);
    assert.equal(/\.gl\b/.test(body), false, `${f}: no window touches raw GL`);
  }

  // the third copy is gone: worldModes' bank preview rides the bracket
  const wm = src('src/scenes/worldModes.js');
  assert.match(wm, /renderer\.panelFrame\(\{/, 'drawBankModelPreview is on the bracket');
  assert.equal(/getParameter\(gl\.COLOR_CLEAR_VALUE\)/.test(wm), false, 'the per-frame synchronous readback is gone');
  assert.equal(/gl\.scissor\(rect\.x/.test(wm), false, 'the hand-rolled scissor is gone');

  // and the dungeon window's own save/restore block is gone with it
  const aw = src('src/ui/automapWindow.js');
  assert.match(aw, /renderer\.panelFrame\(\{/);
  assert.equal(/const off = renderer\.screenOffset/.test(aw), false, 'the hand-rolled restore list is deleted');
  assert.match(aw, /AUTOMAP_PANEL_NATIVE_RECT/, 'and the 3D lands in DFU\'s render panel');
});
