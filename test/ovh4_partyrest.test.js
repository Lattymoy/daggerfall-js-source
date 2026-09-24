// OVH4 (2026-09-24, Mac: "How do we make it where it's not solo rest for other UI's" - and chose "A"): A PARTY'S REST
// IS AN ONLINE WINDOW, like the chat, the party panel and the player trade (OVH3) - the party card on either skin.
//
// THE BUG: ONLINE-REST1 gated the whole party rest on the enhanced skin, because classic's RestWindow carries none of
// the party's arms (a follower's Stop, the unrested close that frees the next vote, the stack's Tab close). Since
// OVH3 lets a player wear Classic or GrimoireUI online, that player's rest in a party was a SOLO rest: no vote, no
// mirror, the party slept apart. The door now opens the card for a party's rest on either skin, and the five skin
// gates in world.js are gone; a solo or offline rest on the classic skin keeps Daggerfall's own window.
//
// Driven through the real door (ui/restDoor.js) under a fake document and a real skin choice (the URL override);
// the hosts' wiring, which lives in world.js's closure, is pinned by its source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const mkEl = (tag) => ({
  tag, className: '', textContent: '', id: '', value: '', type: '', min: '', max: '', children: [], style: {}, attrs: {},
  setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return this.attrs[k]; },
  append(...c) { this.children.push(...c); }, remove() { this.removed = true; }, replaceChildren(...c) { this.children = c; },
  addEventListener() {}, removeEventListener() {}, focus() {},
  set innerHTML(v) { if (v === '') this.children = []; }, get innerHTML() { return ''; },
});

/** The door, asked under `skin` with `deps` - with a document (the game) or without one (a headless host). */
async function openDoor({ skin, deps, dom = true }) {
  const prev = { document: globalThis.document, window: globalThis.window, raf: globalThis.requestAnimationFrame, location: globalThis.location };
  const body = mkEl('body');
  if (dom) {
    globalThis.document = { createElement: mkEl, createTextNode: (t) => ({ text: t, className: '' }), getElementById: () => null, head: mkEl('head'), body,
      addEventListener() {}, removeEventListener() {}, pointerLockElement: null, exitPointerLock() {}, querySelector: () => null };
    globalThis.window = { addEventListener() {}, removeEventListener() {} };
    globalThis.requestAnimationFrame = () => 0;
  } else {
    delete globalThis.document;
  }
  globalThis.location = { search: `?skin=${skin}`, href: `http://localhost/play/?skin=${skin}` };
  try {
    const { createRestWindow } = await import('../src/ui/restDoor.js');
    const { RestWindow } = await import('../src/ui/restWindow.js');
    const win = createRestWindow(deps);
    return { win, body, RestWindow, card: body.children.some((c) => c.id === 'enhanced-rest') };
  } finally {
    for (const [k, v] of Object.entries({ document: prev.document, window: prev.window, requestAnimationFrame: prev.raf, location: prev.location })) {
      if (v === undefined) delete globalThis[k]; else globalThis[k] = v;
    }
  }
}

const baseDeps = (over = {}) => ({
  setResting() {}, setLoitering() {},
  vitals: () => ({ health: 10, maxHealth: 40, fatigue: 100, magicka: 5 }),
  tickVitals: () => false, fullyHealed: () => false, dead: () => false, enemiesNearby: () => false,
  advanceMinutes() {}, endLines: (id) => [`text ${id}`], say() {},
  ...over,
});

test('OVH4: on the CLASSIC skin, a party\'s rest opens the party card - the window with the party\'s arms - not Daggerfall\'s solo RestWindow', async () => {
  let unrested = 0;
  const { win, card, RestWindow } = await openDoor({ skin: 'classic', deps: baseDeps({ partyRest: () => true, onClosedUnrested: () => { unrested++; } }) });
  assert.ok(!(win instanceof RestWindow), 'a classic player in a party rested in the solo window - no vote, no mirror (the bug)');
  assert.ok(card, 'the card stands on the page, in its own host');
  assert.equal(typeof win.stopOrClose, 'function', 'the stack\'s Tab close and a mirror\'s Stop are the card\'s arm');
  assert.equal(win.isRestWindow, true, 'the hosts read the same shape off it');
  win.dispose();
  assert.equal(unrested, 1, 'PARTY-REST29 reaches a classic player: the window closed unrested frees the next vote');
});

test('OVH4: a SOLO rest on the classic skin keeps Daggerfall\'s own window, byte for byte - no party, or a tavern\'s bed, or a host that never says', async () => {
  for (const partyRest of [() => false, undefined, () => 'yes']) {
    const { win, card, RestWindow } = await openDoor({ skin: 'classic', deps: baseDeps(partyRest ? { partyRest } : {}) });
    assert.ok(win instanceof RestWindow, `classic's solo rest is RestWindow (partyRest ${partyRest ? partyRest() : 'absent'})`);
    assert.equal(card, false, '...and nothing is put on the page');
  }
});

test('OVH4: the enhanced skin is unchanged - its card for every rest, party or not', async () => {
  for (const partyRest of [() => true, () => false]) {
    const { win, card, RestWindow } = await openDoor({ skin: 'enhanced', deps: baseDeps({ partyRest }) });
    assert.ok(!(win instanceof RestWindow) && card);
    win.dispose();
  }
});

test('OVH4: with no document there is no card to open - a headless host rests in RestWindow even in a party', async () => {
  const { win, RestWindow } = await openDoor({ skin: 'classic', dom: false, deps: baseDeps({ partyRest: () => true }) });
  assert.ok(win instanceof RestWindow);
});

test('OVH4: world.js - ONLINE-REST1\'s classic arm is gone from all five party-rest seams, and every rest the party owns says so to the door', () => {
  const w = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  const body = (start) => { const i = w.indexOf(start); assert.ok(i >= 0, start); return w.slice(i, w.indexOf('\n  };\n', i)); };
  // the five seams read no skin: the pose's rest, the gate, the reset, the vote tally, the mirror
  const pose = w.slice(w.indexOf('const composePartyPose = () => {'), w.indexOf('const composePartyPose = () => {') + 3000);
  assert.match(pose, /const restWin = mode === 'interior' \? modes\?\.restState/, 'a classic leader\'s rest is broadcast - its followers mirror it');
  for (const seam of ['const partyRestGate = () => {', 'const markPartyRestSpent = () => {', 'const _partyRestVoteTrackTick = () => {']) {
    assert.doesNotMatch(body(seam), /isEnhanced\(\)/, `${seam} reads no skin`);
  }
  const follow = w.slice(w.indexOf('// OVH4: a mirror opens on either skin'), w.indexOf('const win = createRestWindow(partyRestMirrorDeps('));
  assert.ok(follow.length > 0 && !/isEnhanced\(\)/.test(follow), 'the follow tick opens a mirror on either skin');
  // the ONE question: a party, outside a tavern/temple/guild hall - the gate's own two
  assert.match(w, /const partyRestHere = \(\) => !!social\?\.party && !modes\?\.insidePartyRestExempt;/);
  assert.match(w, /const outdoorRestDeps = createRestDeps\(playerEntity, \{[^]*?partyRest: \(\) => partyRestHere\(\),/, 'the outdoor rest asks it');
  assert.match(body('const partyRestMirrorDeps = (restKind, targetAcct) => {'), /\.\.\.outdoorRestDeps,\s*\n\s*partyRest: \(\) => true,/, 'a mirror IS a party\'s rest');
  assert.match(w, /partyRestHere: \(\) => partyRestHere\(\),/, 'the mode machine is handed it');
});

test('OVH4: the building and the dungeon ask the same question through their hosts', () => {
  const m = readFileSync(new URL('../src/scenes/worldModes.js', import.meta.url), 'utf8');
  const d = readFileSync(new URL('../src/scenes/dungeonContext.js', import.meta.url), 'utf8');
  assert.match(m, /const interiorRestDeps = createRestDeps\(playerEntity, \{[^]*?partyRest: \(\) => host\.partyRestHere\?\.\(\) === true,/);
  assert.match(m, /partyRestHere: \(\) => host\.partyRestHere\?\.\(\) === true,/, 'forwarded into the dungeon');
  assert.match(d, /const _restDeps = createRestDeps\(playerEntity, \{[^]*?partyRest: \(\) => opts\.partyRestHere\?\.\(\) === true,/);
});
