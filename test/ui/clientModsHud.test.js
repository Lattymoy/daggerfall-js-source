import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clientMods } from '../../src/systems/clientMods.js';
import { drawHud, hideHudTextSurfaces } from '../../src/ui/hud/hud.js';
import { drawEnhancedHud, destroyEnhancedHud } from '../../src/ui/enhanced/enhancedHud.js';
import { _resetForTests } from '../../src/systems/settings/settings.js';
import initialize from '../../examples/client-mods/health-numbers/main.js';

const entity = () => ({ health: 41, maxHealth: 118, magicka: 20, maxMagicka: 20, fatigue: 6400, stats: { strength: 50, endurance: 50 }, items: [], equip: { slots: {} } });
test('native common HUD publishes duel health and clears it on the actual hide boundary', () => {
  _resetForTests(); let api;
  clientMods.start({ id: 'hud-test', apiVersion: 1, requires: ['player.health.read'] }, value => { api = value; });
  try {
    const renderer = { drawScreenQuad() {} }, canvas = { width: 320, height: 200 };
    drawHud(renderer, canvas, null, entity(), 0, 0);
    assert.deepEqual(api.player.health(), { current: 41, maximum: 118 });
    drawHud(renderer, canvas, null, entity(), 0, 0, { healthBar: { health: 7, maxHealth: 10 } });
    assert.deepEqual(api.player.health(), { current: 7, maximum: 10 });
    hideHudTextSurfaces(); assert.equal(api.player.health(), null);
    drawHud(renderer, canvas, null, entity(), 0, 0, { hudHidden: true });
    assert.equal(api.player.health(), null);
    drawHud(renderer, canvas, null, entity(), 0, 0); assert.equal(api.player.health().current, 41);
  } finally { clientMods.stop('hud-test'); _resetForTests(); }
});

// Record DOM writes only, following the existing HUD test harness; do not pretend to measure browser layout.
const element = () => ({
  className: '', textContent: '', children: [], dataset: {}, attrs: {},
  style: { setProperty(k, v) { this[k] = v; }, removeProperty(k) { delete this[k]; } },
  classList: { _s: new Set(), add(...c) { c.forEach(x => this._s.add(x)); }, remove(...c) { c.forEach(x => this._s.delete(x)); },
    toggle(c, on) { if (on) this._s.add(c); else this._s.delete(c); }, contains(c) { return this._s.has(c); } },
  setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'class') this.className = String(v); },
  getAttribute(k) { return this.attrs[k]; }, removeAttribute(k) { delete this.attrs[k]; }, remove() {},
  append(...c) { this.children.push(...c); }, appendChild(c) { this.children.push(c); return c; },
  replaceChildren(...c) { this.children = c; }, addEventListener() {},
});
const walk = (node, fn) => { fn(node); for (const child of node.children ?? []) walk(child, fn); };
test('example changes the existing native health label, then restores its percentage without extra UI', () => {
  const previous = globalThis.document;
  globalThis.document = { createElement: element, createElementNS: () => element(), getElementById: () => null, head: element(), body: element() };
  try {
    drawEnhancedHud(entity(), 0, 0);
    const initial = []; walk(document.body, node => initial.push(node));
    const healthLabel = initial.find(node => node.textContent === '35%'); assert.ok(healthLabel);
    clientMods.start({ id: 'health-numbers', apiVersion: 1, requires: ['hud.health-label'] }, initialize);
    drawEnhancedHud(entity(), 0, 0); assert.equal(healthLabel.textContent, '41/118');
    const matching = []; walk(document.body, node => { if (node.textContent === '41/118') matching.push(node); });
    assert.equal(matching.length, 1, 'exactly one numeric health label');
    assert.equal(matching[0], healthLabel, 'the original native label is reused');
    clientMods.stop('health-numbers'); drawEnhancedHud(entity(), 0, 0); assert.equal(healthLabel.textContent, '35%');
  } finally { clientMods.stop('health-numbers'); destroyEnhancedHud(); globalThis.document = previous; }
});
