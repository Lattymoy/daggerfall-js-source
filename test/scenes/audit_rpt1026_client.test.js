// AUDIT RPT1026 (lane K, the client): the audit of FIELD BUGS 2026-10-26r's RPT1026-CLIENT, each finding driven through
// the real modules (bible/01-Overview/bugs/Field-Bugs-2026-10-26r.md, RPT1026-CLIENT's AUDIT rows).
//   K1 - a Weir Key face thrown in one dungeon was still counted as lying on a body in the next (or the same one built
//        again) when no balance answer had landed outside between them: the pack one key short of the balance, no face
//        anywhere to take up. Driven through the real find (registerEgFind with the world host's own place door,
//        egFindPlace, and its throw, egFindThrow) and the real take (inventory.js takeOneInto).
//   K2 - the lost graphics context's report, the page's one way back, carried the new Dismiss: dismissed, the dead
//        canvas was left with nothing to say how to reload. Driven through main.js's own three statements.
//   K3 - the pins of PEER-SHAKE held neither an event's sky fire at its whole kick nor the Motion row's own values:
//        driven through the one cast engine (createPlayerMagic's skyFire) and the menu's own row (portPool).
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerEgFind, egFindThrow, egFindPlace } from '../../src/systems/eliteGates/egFind.js';
import { raiseEnemyDeath, registerEnemyDeathHandler } from '../../src/scenes/corpseMarker.js';
import { weirKeysHeld, restackWeirKeys, weirKeysLying, isWeirKey, _resetWeirKeyFacesForTests } from '../../src/systems/eliteGates/weirKey.js';
import { takeOneInto } from '../../src/systems/inventory.js';
import { createPlayerMagic } from '../../src/scenes/hostMagic.js';
import { betterAmbience } from '../../src/systems/betterAmbience.js';
import { getPref, setPref, _resetForTests as resetPrefs } from '../../src/systems/uiPrefs.js';
import { portPool } from '../../src/ui/enhanced/enhancedMenu.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const tick = () => new Promise((r) => setImmediate(r));

// ── K1: the Weir Key's faces, kept against the visit they were thrown in ─────────────────────────────────────────────

/** The world's modes as the world host's place door reads them (worldModes.js modesApi: `dungeonLocation`, the location
 *  the player stands in, and `dungeonCtx`, the context built at the entry), and the find registered as scenes/world.js
 *  registers it - its place door egFindPlace, its throw egFindThrow onto the player's pack. */
function rig() {
  _resetWeirKeyFacesForTests();
  const player = { items: [] };
  const S = { balance: 0, mode: 'dungeon', modes: { dungeonLocation: { hasDungeon: true, elite: true }, dungeonCtx: { entry: 1 } }, answers: [] };
  const find = registerEgFind({
    ask: () => new Promise((r) => S.answers.push(() => { S.balance++; r({ ok: true, data: { found: true, keys: S.balance, asks: 5 } }); })),
    placeNow: () => egFindPlace(S.mode, S.modes), selfId: () => 'me', online: () => true,
    throwKey: (e, n) => egFindThrow(e, player.items, n),
  });
  /** Out of the dungeon (worldModes.js exitDungeonNow: its context destroyed, its bodies with it) and into the next. */
  const walkOutAndIn = () => { S.mode = 'exterior'; S.modes = { dungeonLocation: null, dungeonCtx: null }; S.mode = 'dungeon'; S.modes = { dungeonLocation: { hasDungeon: true, elite: true }, dungeonCtx: { entry: 2 } }; };
  const kill = async (body) => { raiseEnemyDeath(body, { by: null }); await tick(); S.answers.shift()?.(); await tick(); };
  return { player, S, find, walkOutAndIn, kill, done: () => { find.dispose(); registerEnemyDeathHandler('eg-find', null); } };
}
const elite = () => ({ eliteFoe: true, items: [], mobileType: 1 });

test('AUDIT RPT1026 K1: the world host\'s place door is the dungeon\'s tier and the visit - its context, new at every entry - and the world registers the find with it', () => {
  const loc = { hasDungeon: true, elite: true }, ctx = {};
  assert.deepEqual(egFindPlace('dungeon', { dungeonLocation: loc, dungeonCtx: ctx }), { tier: 'elite', visit: ctx });
  assert.equal(egFindPlace('exterior', { dungeonLocation: loc, dungeonCtx: ctx }), null, 'outside a dungeon, no place');
  assert.equal(egFindPlace('dungeon', { dungeonLocation: null, dungeonCtx: null }), null);
  assert.match(read('src/scenes/world.js'), /registerEgFind\(\{[^]*?\n\s*placeNow: \(\) => egFindPlace\(_mode\(\), modes\),/, 'world.js hands the find its place, not the tier alone');
});

test('AUDIT RPT1026 K1: a face left on a body, out of the dungeon and into the next before any answer landed outside - the next answer gives the pack the whole balance, not one short', async () => {
  const R = rig();
  try {
    const a = elite();
    await R.kill(a);
    assert.deepEqual([R.S.balance, weirKeysHeld(R.player.items), weirKeysHeld(a.items)], [1, 0, 1], 'the find: a face on the body, the pack the balance less it');
    // the ten-minute ask lands while the player is still there: the face lies, the pack stands
    assert.equal(restackWeirKeys(R.player.items, R.S.balance), false);
    assert.equal(weirKeysLying(), 1);
    R.walkOutAndIn();   // no answer outside: nothing folded there
    restackWeirKeys(R.player.items, R.S.balance);   // the keys asked again, in the next dungeon
    assert.deepEqual([weirKeysHeld(R.player.items), weirKeysLying()], [1, 0], 'the whole balance in the pack, no face counted on a body this dungeon never had');
    assert.equal(weirKeysHeld(a.items), 0, 'and the face folded off the body left behind, as one away is');
  } finally { R.done(); }
});

test('AUDIT RPT1026 K1: in the next dungeon a find of its own still counts its own face, and its take-up makes the whole balance', async () => {
  const R = rig();
  try {
    const a = elite();
    await R.kill(a);
    R.walkOutAndIn();
    const b = elite();
    await R.kill(b);
    assert.deepEqual([R.S.balance, weirKeysHeld(R.player.items), weirKeysHeld(b.items), weirKeysLying()], [2, 1, 1, 1], 'the pack the balance less the one face here');
    for (const it of b.items.filter(isWeirKey)) takeOneInto(R.player, b.items, it);
    assert.equal(weirKeysHeld(R.player.items), 2);
    assert.equal(restackWeirKeys(R.player.items, R.S.balance), false, 'the next answer has nothing to change');
  } finally { R.done(); }
});

test('AUDIT RPT1026 K1: a find\'s answer that lands after the player went into another dungeon throws no face on the body left behind - the key is the pack\'s', async () => {
  const R = rig();
  try {
    const a = elite();
    raiseEnemyDeath(a, { by: null }); await tick();   // asked here...
    R.walkOutAndIn();
    R.S.answers.shift()(); await tick();              // ...answered there
    assert.deepEqual([R.S.balance, weirKeysHeld(R.player.items), weirKeysHeld(a.items), weirKeysLying()], [1, 1, 0, 0]);
  } finally { R.done(); }
});

test('AUDIT RPT1026 K1: a face the world\'s throw (egFindThrow) lays while the door says away is no face lying - the pack the whole balance', () => {
  const R = rig();
  try {
    R.S.mode = 'exterior'; R.S.modes = { dungeonLocation: null, dungeonCtx: null };
    const a = elite();
    egFindThrow(a, R.player.items, 2);
    assert.deepEqual([weirKeysHeld(R.player.items), weirKeysHeld(a.items), weirKeysLying()], [2, 0, 0], 'away, every face is folded - one kept against no visit too');
  } finally { R.done(); }
});

// ── K2: the lost graphics context's report keeps its way back ──────────────────────────────────────────────────────

const main = read('src/main.js');
/** The whole statement that starts at `needle` (balanced braces; a listener's call closes after its body). */
function statementAt(src, needle) {
  const at = src.indexOf(needle);
  assert.ok(at >= 0, `main.js still holds ${needle}`);
  let depth = 0;
  for (let i = at; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(at, src[i + 1] === ')' ? src.indexOf(';', i) + 1 : i + 1);
  }
  return assert.fail('unbalanced');
}
/** A page whose elements keep a real element's rules: textContent replaces the children, remove() takes an element out
 *  of its parent (or the page). */
function page() {
  const els = new Map();
  class El {
    constructor(tag) { this.tag = tag; this.style = {}; this.children = []; this._text = ''; this.parent = null; }
    get textContent() { return this._text + this.children.map((c) => c.textContent).join(''); }
    set textContent(v) { this._text = String(v); for (const c of this.children) c.parent = null; this.children = []; }
    appendChild(c) { this.children.push(c); c.parent = this; return c; }
    remove() { if (this.parent) { this.parent.children = this.parent.children.filter((c) => c !== this); this.parent = null; } else if (els.get(this.id) === this) els.delete(this.id); }
  }
  let lost = null, reloads = 0;
  const canvas = { addEventListener: (ev, fn) => { if (ev === 'webglcontextlost') lost = fn; } };
  const document = { getElementById: (id) => (id === 'c' ? canvas : els.get(id) ?? null), createElement: (tag) => new El(tag), body: { appendChild: (el) => els.set(el.id, el) } };
  const code = `${statementAt(main, 'function crashOverlay(msg) {')}\n${statementAt(main, 'function crashDismiss(el) {')}\n`
    + `${statementAt(main, "document.getElementById('c')?.addEventListener('webglcontextlost'")}\nreturn crashOverlay;`;
  const crashOverlay = new Function('document', 'location', 'pageGoing', code)(document, { reload: () => reloads++ }, false);
  return { els, crashOverlay, lose: () => lost({ preventDefault() {} }), reloads: () => reloads };
}
const buttons = (el) => el.children.filter((c) => c.tag === 'button');

test('AUDIT RPT1026 K2: a lost graphics context\'s report carries no Dismiss - nothing draws again on the page, and the report is its way back', () => {
  const P = page();
  P.lose();
  const el = P.els.get('crash');
  assert.match(el.textContent, /^CRASH\nthe graphics stopped/);
  assert.deepEqual(buttons(el), [], 'no Dismiss over the dead canvas');
  // a later throw on the dead page: its words, and still no Dismiss to take the way back away
  P.crashOverlay('TypeError: a frame on a lost context');
  assert.deepEqual(buttons(el), []);
  el.onclick();
  assert.equal(P.reloads(), 1, 'the report still reloads');
});

test('AUDIT RPT1026 K2: a report already up when the context goes loses its Dismiss; any other report keeps it', () => {
  const P = page();
  const el = P.crashOverlay('IndexSizeError: an arc of negative radius');
  assert.equal(buttons(el).length, 1, 'a throw the game runs on past: dismissible (RPT1026-CLIENT DISMISS)');
  P.lose();
  assert.equal(P.els.get('crash'), el);
  assert.deepEqual(buttons(el), [], 'the context gone: the report is kept');
});

// ── K3: an event's sky fire keeps its whole kick; the Motion row writes the shares the engine reads ──────────────────

afterEach(() => resetPrefs());

/** The engine with a wall across z = 3, my feet at the origin (test/scenes/rpt1026_client_peershake.test.js's). */
function engine() {
  const raycast = (pos, dir, max) => { const d = dir[2] > 0 ? (3 - pos[2]) / dir[2] : Infinity; return d >= 0 && d <= max ? d : Infinity; };
  const player = { isPlayer: true, level: 1, health: 50, maxHealth: 50, maxMagicka: 500, magicka: 500, skills: new Array(40).fill(50), skillUses: new Array(40).fill(0), stats: { intelligence: 50, willpower: 50, endurance: 50 }, career: {}, activeEffects: [] };
  const magic = createPlayerMagic({
    renderer: { createBillboardBatch: () => ({ origin: null }), destroyBillboardBatch: () => {} },
    audio: { playOneShot() {}, play3d() {}, playOneShotId() {}, play3dId() {} },
    getTexture: async () => ({ getSize: () => [16, 16], getScale: () => [0, 0] }),
    uploadRecord() {}, uploadRecordFrame() {},
    collider: { raycast },
    playerEntity: player,
    playerSinks: { hurt() {}, heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {}, say() {} },
    say() {}, surfacePlayer() {},
    foes: () => [],
    foeSinks: () => ({ hurt() {}, heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {} }),
    absorbCtx: () => ({ inside: true, day: false }),
    rolls: () => 0.99,
  });
  magic.update(0, [0, 0, 0]);
  const fly = (n = 30) => { for (let i = 0; i < n && magic.missileCount() > 0; i++) magic.update(1 / 30, [0, 0, 0]); };
  return { magic, fly };
}
function kicks(t) {
  const seen = [];
  t.mock.method(betterAmbience, 'weaponKick', (k) => { seen.push(k); });
  return seen;
}
const peerBolt = () => { const E = engine(); E.magic.spellVisual({ from: [0, 1, 0], dir: [0, 0, 1], element: 0, rangeType: 2, casterId: 'peer-1' }); E.fly(); };

test('AUDIT RPT1026 K3: an event\'s sky fire (drawn, no caster) keeps its whole kick whatever the other players\' share', (t) => {
  const seen = kicks(t);
  const sky = (share) => {
    if (share != null) setPref('peerSpellShake', share);
    const E = engine();
    assert.equal(E.magic.skyFire({ from: [0, 20, 2], to: [0, 0, 2] }), true);
    E.fly(150);
    assert.equal(E.magic.missileCount(), 0, 'landed');
  };
  sky(null);
  assert.equal(seen.length, 1, 'the fall kicks');
  sky(0);
  assert.equal(seen.length, 2, 'Off is the other players\' share: the sky\'s fire still kicks');
  assert.ok(Math.abs(seen[1] - seen[0]) < 1e-9, `at its whole strength (${seen[1]} against ${seen[0]})`);
});

/** A document just big enough for the menu's row builders (test/systems/org2_options.test.js's), the Motion row's main
 *  button pressed until the share stands at `want`. */
function portRow(want) {
  const make = (tag) => {
    const n = { tag, children: [], className: '', textContent: '', title: '', type: '', disabled: false, style: {}, dataset: {}, attrs: {},
      append(...cs) { n.children.push(...cs); }, prepend(...cs) { n.children.unshift(...cs); }, setAttribute(k, v) { n.attrs[k] = v; }, addEventListener() {}, querySelectorAll: () => [],
      classList: { add() {}, toggle() {}, contains: () => false } };
    return n;
  };
  globalThis.document = { createElement: make, createTextNode: (s) => ({ textContent: s }), querySelectorAll: () => [], getElementById: () => null };
  globalThis.window = { location: { search: '' }, navigator: { maxTouchPoints: 0 }, matchMedia: () => ({ matches: false }) };
  try {
    for (let i = 0; i < 3 && Number(getPref('peerSpellShake')) !== want; i++) {
      const row = portPool().get('peerSpellShake');
      assert.ok(row, 'the Motion row is in the port pool');
      row.children.find((c) => c.className === 'row-main').onclick();
    }
  } finally { delete globalThis.document; delete globalThis.window; }
  assert.equal(Number(getPref('peerSpellShake')), want, `the row reaches ${want}`);
}

test('AUDIT RPT1026 K3: the Motion row writes the shares the engine reads - pressed from Half to Off no kick, to Full the whole kick, back to Half half of it', (t) => {
  const seen = kicks(t);
  portRow(0);   // Half -> Off
  peerBolt();
  assert.equal(seen.length, 0, 'Off: none');
  portRow(1);   // Off -> Full
  peerBolt();
  assert.equal(seen.length, 1);
  const E = engine();
  E.magic.setReadied({ name: 'Firebolt', index: 91, element: 0, rangeType: 2, effects: [{ type: 4, subType: 0, magnitudeBaseLow: 5, magnitudeBaseHigh: 5, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1, durationBase: 0, durationMod: 0, durationPerLevel: 1, chanceBase: 0, chanceMod: 0, chancePerLevel: 1 }] });
  E.magic.castInput([0, 1, 0], [0, 0, 1]);
  E.fly();
  assert.ok(Math.abs(seen[0] - seen[1]) < 1e-9, 'Full: a peer\'s bolt kicks as my own');
  portRow(0.5);   // Full -> Half
  peerBolt();
  assert.ok(Math.abs(seen[2] - seen[0] / 2) < 1e-9, `Half: half the kick (${seen[2]} against ${seen[0]})`);
});
