// VULKAN-FLIP (2026-10-28, a player in #bug-reports: "Screen flips when opening an inventory UI while using the Vulkan").
// The desktop app on ANGLE's Vulkan backend drew the pack's backdrop blur upside down; a page whose own WebGL renderer
// names Vulkan, in the shell, drops every backdrop filter (src/ui/vulkanBackdrop.js, bible/01-Overview/Desktop-App.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

import { backdropFlips, guardBackdrops, VULKAN_BACKDROP_CSS, VULKAN_BACKDROP_STYLE_ID } from '../../src/ui/vulkanBackdrop.js';
import { codeHasOnce } from '../codeOnly.mjs';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
/** The renderer strings bible/01-Overview/Desktop-App.md recorded on the RTX 5080, one a backend. */
const VULKAN = 'ANGLE (NVIDIA, Vulkan 1.4.341 (NVIDIA NVIDIA GeForce RTX 5080 (0x00002C02)), NVIDIA)';
const D3D11 = 'ANGLE (NVIDIA, NVIDIA GeForce RTX 5080 (0x00002C02) Direct3D11 vs_5_0 ps_5_0, D3D11)';
const SHELL = { platform: 'win32' };

/** A document with a head, enough for the guard: it finds by id and appends. */
function fakeDoc() {
  const nodes = [];
  return {
    nodes,
    head: { append: (n) => nodes.push(n) },
    createElement: (tag) => ({ tag, id: '', textContent: '' }),
    getElementById: (id) => nodes.find((n) => n.id === id) ?? null,
  };
}

test('VULKAN-FLIP: the backdrop flips only in the desktop shell on a Vulkan renderer - D3D11, a browser on Vulkan and an unknown GPU keep their blur (mutants: the shell unasked; the renderer unread)', () => {
  assert.equal(backdropFlips(VULKAN, SHELL), true);
  assert.equal(backdropFlips(VULKAN.toLowerCase(), SHELL), true, 'any case');
  assert.equal(backdropFlips(D3D11, SHELL), false, 'the default backend draws it upright');
  assert.equal(backdropFlips(VULKAN, undefined), false, 'a browser: no shell, no report');
  assert.equal(backdropFlips(null, SHELL), false, 'a GPU that gave no name');
});

test('VULKAN-FLIP: the guard puts one style on the page, and only where the backdrop flips (mutants: a style each call; a style on D3D11)', () => {
  const doc = fakeDoc();
  assert.equal(guardBackdrops(doc, VULKAN, SHELL), true);
  assert.equal(guardBackdrops(doc, VULKAN, SHELL), true, 'a second call finds the first');
  assert.equal(doc.nodes.length, 1, 'once a page');
  assert.deepEqual([doc.nodes[0].tag, doc.nodes[0].id, doc.nodes[0].textContent], ['style', VULKAN_BACKDROP_STYLE_ID, VULKAN_BACKDROP_CSS]);
  const upright = fakeDoc();
  assert.equal(guardBackdrops(upright, D3D11, SHELL), false);
  assert.deepEqual(upright.nodes, [], 'D3D11 keeps the blur');
  assert.equal(guardBackdrops(null, VULKAN, SHELL), false, 'no document, nothing to guard');
});

test('VULKAN-FLIP: the rule clears both spellings on every element and its pseudo-elements, and no window\'s own backdrop filter is !important, so the guard\'s wins (mutants: !important dropped; the -webkit- spelling left; a pseudo-element left)', () => {
  assert.match(VULKAN_BACKDROP_CSS, /^\*, \*::before, \*::after \{/);
  assert.match(VULKAN_BACKDROP_CSS, /(?<!-webkit-)backdrop-filter: none !important;/);
  assert.match(VULKAN_BACKDROP_CSS, /-webkit-backdrop-filter: none !important;/);
  const important = [];
  for (const f of readdirSync(new URL('../../src/', import.meta.url), { recursive: true })) {
    if (!/\.(js|css)$/.test(f) || /vulkanBackdrop\.js$/.test(f)) continue;
    if (/backdrop-filter:[^;}]*!important/.test(read(`src/${f.replaceAll('\\', '/')}`))) important.push(f);
  }
  assert.deepEqual(important, [], 'a backdrop filter marked !important ties the guard\'s, and the more specific rule wins it');
});

test('VULKAN-FLIP: the entry runs the guard behind the shell\'s door, with the renderer\'s own GPU name - never on the static graph (BOOT2) (mutants: a static import; the door unasked; another name read)', () => {
  const main = read('src/main.js');
  assert.doesNotMatch(main, /^import .*vulkanBackdrop/m, 'off the entry\'s static graph');
  // the slice from the renderer's making to its first setting: after the renderer has read its GPU, before any window
  const from = main.indexOf('const renderer = new Renderer(canvas);');
  const to = main.indexOf('renderer.setRetroSource(', from);
  assert.ok(from > 0 && to > from, 're-read this pin: the renderer\'s making moved');
  codeHasOnce(main.slice(from, to), /if \(globalThis\.daggerShell\) import\('\.\/ui\/vulkanBackdrop\.js'\)\.then\(\(m\) => m\.guardBackdrops\(document, renderer\.gpuName, globalThis\.daggerShell\)\)/, 'the door, in the shell alone, with the page\'s renderer');
});
