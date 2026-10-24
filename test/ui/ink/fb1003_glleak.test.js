// GL-LEAK (FIELD BUGS 2026-10-03, Swololo on Discord: "After long plays there are consistent GPU memory leaks that do
// not lower down even after closing the tab ... Closing the browser down completely clears the GPU memory ... Related to
// play length ... Might be related to some GL instances not being cleared through webgl ... Idling does not increase").
//
// Measured in the source, not guessed: the held map built a sheet per open and each sheet a WebGL2 context of its own
// (ui/ink/inkDungeonGL.js createDungeonInk: a paper-sized drawing buffer, its depth, a preserve copy and three paper-sized
// textures - 30-40 MB at 1080p) on every M in a dungeon or a building - never deleted, never lost, its canvas off the
// page and freed only when a collector reached it. And nothing let ANY context go as the page went. Over a fake WebGL2
// that counts what is made, what is deleted and what is lost.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDungeonInk, dungeonInkFor, disposeDungeonInk } from '../../../src/ui/ink/inkDungeonGL.js';
import { loseGlContext, onPageGone, releaseGlContexts } from '../../../src/render/glRelease.js';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');

/** A page whose canvases hand out counting WebGL2 contexts. `failLink` - every program refuses to link. */
function fakePage({ failLink = false } = {}) {
  const page = { contexts: [] };
  const makeGl = () => {
    const made = new Map(), deleted = new Map();
    let lost = false;
    const bump = (m, k) => m.set(k, (m.get(k) ?? 0) + 1);
    const base = {
      made, deleted,
      get lostOnce() { return lost; },
      isContextLost: () => lost,
      getExtension: (name) => (name === 'WEBGL_lose_context' ? { loseContext() { lost = true; } } : null),
      getProgramParameter: () => !failLink,
      getShaderParameter: () => true,
      getProgramInfoLog: () => 'refused',
      getShaderInfoLog: () => '',
      getUniformLocation: () => ({}), getAttribLocation: () => 0,
    };
    const gl = new Proxy(base, {
      get(t, k) {
        if (k in t) return t[k];
        if (typeof k !== 'string') return undefined;
        if (/^[A-Z0-9_]+$/.test(k)) return k;   // a constant: its own name
        if (k.startsWith('create')) return () => { bump(made, k.slice(6)); return { kind: k.slice(6) }; };
        if (k.startsWith('delete')) return (o) => { if (o) bump(deleted, k.slice(6)); };
        return () => undefined;
      },
    });
    page.contexts.push(gl);
    return gl;
  };
  page.doc = { createElement: () => ({ width: 0, height: 0, getContext: (kind) => (kind === 'webgl2' ? makeGl() : null) }) };
  return page;
}
const total = (m) => [...m.values()].reduce((a, b) => a + b, 0);

test('GL-LEAK ONE INK A PAGE: a hundred map opens ask for the ink a hundred times and make ONE context; a lost one is built anew and the old let go (mutants: an ink per open; a lost ink kept)', () => {
  disposeDungeonInk();
  const page = fakePage();
  const first = dungeonInkFor(page.doc);
  for (let i = 0; i < 99; i++) assert.equal(dungeonInkFor(page.doc), first, 'the same ink');
  assert.equal(page.contexts.length, 1, 'one WebGL2 context for every open (it was one an open)');
  page.contexts[0].getExtension('WEBGL_lose_context').loseContext();   // the browser takes it back
  const again = dungeonInkFor(page.doc);
  assert.notEqual(again, first, 'a lost ink is built anew');
  assert.equal(page.contexts.length, 2);
  assert.equal(total(page.contexts[0].deleted), total(page.contexts[0].made), 'the lost one\'s objects deleted with it');
  disposeDungeonInk();
  assert.equal(dungeonInkFor(null), null, 'no page, no ink');
});

test('GL-LEAK dispose: every object the ink made is deleted and its context lost at once - and a context whose programs would not link is lost before the null, not left for the collector (mutants: dispose deleting nothing; the failure path keeping the context)', () => {
  const page = fakePage();
  const ink = createDungeonInk(page.doc);
  ink.render({ paper: () => [0, 0, 0], depth: () => 0, clipY: 0, W: 64, H: 32 });   // sized: the textures have storage
  const gl = page.contexts[0];
  assert.ok(total(gl.made) >= 9, `made: ${[...gl.made]}`);
  ink.dispose();
  assert.deepEqual([...gl.deleted].sort(), [...gl.made].sort(), 'every shader, buffer, texture, framebuffer and program deleted');
  assert.equal(gl.lostOnce, true, 'and the context let go');
  assert.equal(ink.canvas.width, 0, 'the canvas holds no buffer');
  const failing = fakePage({ failLink: true });
  assert.equal(createDungeonInk(failing.doc), null, 'no programs, no ink');
  assert.equal(failing.contexts[0].lostOnce, true, 'and the context it took let go');
});

test('GL-LEAK the ink\'s mesh is the SHEET\'s: two sheets whose reveals count the same never draw each other\'s rows (mutant: the owner not in the key)', () => {
  disposeDungeonInk();
  const page = fakePage();
  const ink = dungeonInkFor(page.doc);
  const gl = page.contexts[0];
  const uploads = () => gl.made.get('Buffer');   // bufferData is not counted; the upload is read off rowMesh's walk below
  const a = {}, b = {};
  let walked = 0;
  const rows = () => new Proxy([], { get(t, k) { if (k === 'map') { walked++; return () => []; } return t[k]; } });
  ink.setMesh('3|2', rows(), a);
  ink.setMesh('3|2', rows(), a);
  assert.equal(walked, 1, 'the same sheet, the same reveal: no upload');
  ink.setMesh('3|2', rows(), b);
  assert.equal(walked, 2, 'another sheet with the same count: its own rows uploaded');
  assert.ok(uploads() > 0);
  disposeDungeonInk();
  // the sheet asks the page's ink, with its own rows' owner, and asks again when it was lost
  const sheet = rd('src/ui/automap/automapSheet.js');
  assert.match(sheet, /if \(glInk === undefined \|\| glInk\?\.lost\?\.\(\)\) glInk = dungeonInkFor\(ctx\?\.canvas\?\.ownerDocument \?\? null\);/);
  assert.match(sheet, /glInk\.setMesh\(`\$\{r\?\.revealed\?\.size \?\? 0\}\|\$\{f\.rows\.length\}`, rowsIn\(f\.model, r\?\.revealed \?\? null\), solids\);/);
  assert.doesNotMatch(sheet, /createDungeonInk\(/, 'no sheet makes an ink of its own');
});

test('GL-LEAK AS THE PAGE GOES: every seated context let go once, an unseated one not, one that throws keeping no other from it; main.js seats the game\'s own and runs them all on a pagehide the browser does not keep - the ink, the veil and the intro seat theirs (mutants: pagehide not wired; the back-forward page let go; the renderer not seated)', () => {
  const ran = [];
  onPageGone(() => ran.push('a'));
  const unseat = onPageGone(() => ran.push('b'));
  onPageGone(() => { throw new Error('gone'); });
  onPageGone(() => ran.push('c'));
  unseat();
  releaseGlContexts();
  assert.deepEqual(ran, ['a', 'c']);
  releaseGlContexts();
  assert.deepEqual(ran, ['a', 'c'], 'once');
  let lost = 0;
  loseGlContext({ getExtension: () => ({ loseContext: () => { lost++; } }) });
  loseGlContext(null); loseGlContext({ getExtension: () => null });
  assert.equal(lost, 1);
  const main = rd('src/main.js');
  assert.match(main, /addEventListener\('pagehide', \(e\) => \{ if \(!e\.persisted\) releaseGlContexts\(\); \}\);/);
  assert.match(main, /const renderer = new Renderer\(canvas\);\n\s*onPageGone\(\(\) => \{ pageGoing = true; loseGlContext\(renderer\.gl\); \}\);/);
  assert.match(main, /e\.preventDefault\(\);\n\s*if \(pageGoing\) return;/, 'no "context lost" banner over a closing tab');
  assert.match(main, /from '\.\/render\/glRelease\.js';/);
  assert.doesNotMatch(rd('src/render/glRelease.js'), /^\s*import\s/m, 'a leaf: the entry\'s static reach unchanged (BOOT1)');
  assert.match(rd('src/ui/ink/inkDungeonGL.js'), /if \(ink\) _shared = \{ doc, ink, unseat: onPageGone\(disposeDungeonInk\) \};/);
  assert.match(rd('src/ui/gate/gateVeil.js'), /unseat = onPageGone\(\(\) => loseGlContext\(gl\)\);/);
  assert.match(rd('src/ui/gate/gateVeil.js'), /loseGlContext\(veilGl\); unseat\?\.\(\);/, 'and its destroy lets it go');
  assert.match(rd('src/ui/intro/introLandscape.js'), /unseat\(\);\n\s*loseGlContext\(gl\);/);
});
