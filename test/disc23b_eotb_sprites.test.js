// DISC23-B (2026-09-24, Gryphoth and Scratchie on Discord, "Eye of the Beholder third person sprites": "EOTB comes
// with 16 ground models and different mounted models, it would be nice to be able to change our models like in the
// original mod ... Also just a way to change our sprite in general instead of it defaulting depending on the class" /
// "The default EOTB has many different options for males and females but the game is not allowing us to choose
// between the different index slots").
//
// THE GAP, two of them. (1) The mod's two sprite sliders (Graphics.OnFoot 0-15, Graphics.OnHorse 0-4) were declared
// and read by the body, and on NO screen: the mod's own pane went with FT14's Mods pane and its curated list never
// named them, so every player was the first set. (2) Online, a peer with no Morrowind body on my screen stood as their
// CLASS's enemy sprite - the set they had chosen was on nobody's screen but their own.
//
// Driven through the real tile and drawer (enhancedMenu.js featureTile), the real settings store, the real look
// (remotePlayers.js composeLook, wire.js validLook) and the real walker layer (net/peerRiders.js createPeerWalkers)
// over the EOTB billboard tables; the host's wiring by source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { skinCard, skinSets } from '../src/ui/skinCard.js';
import { FEATURES, MOD_CURATED } from '../src/systems/features.js';
import { MOD_SETTINGS, modSetting, setModSetting, _resetModSettings } from '../src/systems/modSettings.js';
import { composeLook } from '../src/net/remotePlayers.js';
import { validLook, FOOT_SKINS } from '../src/net/wire.js';
import { EOTB_FOOT_SET_COUNT } from '../src/player/classSkins.js';
import { createPeerWalkers, createPeerRiders, createEotbArt, WALK_ONE_SHOTS } from '../src/net/peerRiders.js';
import { ARCHIVE_FOOT, frameCount } from '../src/player/eotbBillboard.js';

const V = 'eye-of-the-beholder';
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

function fakeEl(tag) {
  let text = '';
  const n = {
    tag, children: [], className: '', title: '', style: {}, dataset: {}, attrs: {},
    // the DOM's own law: setting textContent replaces the children (the card repaints through it)
    get textContent() { return text; },
    set textContent(v) { text = v; n.children.length = 0; },
    append(...cs) { for (const c of cs) { n.children.push(c); c.parent = n; } },
    setAttribute(k, v) { n.attrs[k] = v; },
    addEventListener() {}, removeEventListener() {},
  };
  return n;
}
function find(n, pred, out = []) {
  if (pred(n)) out.push(n);
  for (const c of n.children ?? []) find(c, pred, out);
  return out;
}
const hasClass = (cls) => (n) => typeof n.className === 'string' && n.className.split(/\s+/).includes(cls);
const withDoc = (fn) => {
  globalThis.document = { createElement: fakeEl, createTextNode: (t) => ({ textContent: t, children: [] }), querySelectorAll: () => [] };
  try { return fn(); } finally { delete globalThis.document; }
};

test('DISC23-B: the sets are NAMED - sixteen on foot, five in the saddle, the art\'s own - and they are NOT a Features dial', () => {
  const foot = MOD_SETTINGS[V].keys['Graphics.OnFoot'], horse = MOD_SETTINGS[V].keys['Graphics.OnHorse'];
  assert.equal(foot.labels.length, foot.max + 1, 'one name a set, and still the mod\'s own slider (0-15)');
  assert.equal(horse.labels.length, horse.max + 1);
  assert.equal(foot.labels.length, FOOT_SKINS, 'the wire\'s bound is the same count (SKIN2: the sixteen, and Daggerfall\'s classes after them)');
  assert.equal(EOTB_FOOT_SET_COUNT, 16, 'the mod\'s own sets are the first sixteen');
  // the mod's own preset titles, and the art's own rule: every even set a woman, every odd set a man
  const presets = JSON.parse(src('vendor/eye-of-the-beholder/modpresets.json'));
  for (const p of presets) {
    const i = Number(p.Values?.Graphics?.OnFoot);
    if (!Number.isInteger(i)) continue;
    const kind = p.Title.replace(/ \(Default\)$/, '').replace(/s$/, '').replace(/ [FM]$/, '');
    assert.ok(foot.labels[i].startsWith(kind), `${p.Title} is set ${i}: ${foot.labels[i]}`);
  }
  foot.labels.slice(0, EOTB_FOOT_SET_COUNT).forEach((l, i) => assert.match(l, i % 2 ? /\(male\)$/ : /\(female\)$/));
  // Mac: "make it a choosable skin system in the menu player profile system itself instead of it being hidden in the
  // feature menu"
  assert.ok(!MOD_CURATED[V].includes('Graphics.OnFoot') && !MOD_CURATED[V].includes('Graphics.OnHorse'), 'not a tile\'s dial');
});

test('DISC23-B2: the PROFILE carries the skin - every set as its own picture, the worn one marked, a press worn at once', () => {
  _resetModSettings();
  const sets = skinSets();
  assert.equal(sets.foot.length, FOOT_SKINS); assert.equal(sets.horse.length, 5);   // SKIN2: the mod's sixteen and the classes
  assert.deepEqual(sets.foot.map((s) => s.name), MOD_SETTINGS[V].keys['Graphics.OnFoot'].labels);
  // each tile is the set's own front-on standing sprite, out of the bundle the body draws from
  // (the URL is the build's - node has no bundle - so the pin reads the key the build indexes by, against the file)
  for (const s of [...sets.foot.slice(0, EOTB_FOOT_SET_COUNT), ...sets.horse]) {   // (the classes' art: skin2_class_skins)
    const [arch] = s.key.split('_');
    assert.ok(existsSync(new URL(`../vendor/eye-of-the-beholder/Textures/${arch}/${s.key}.png`, import.meta.url)), `${s.name}: ${s.key}`);
  }
  assert.equal(sets.foot[7].key, `${ARCHIVE_FOOT + 7}_0-0`, 'Mage (male)\'s own archive, front on and standing');
  assert.equal(sets.horse[3].key, '112385_0-0', 'the fourth rider, front on');
  withDoc(() => {
    // SKIN2: the grids live behind the two panels now (test/skin2_class_skins.test.js pins the panels themselves) -
    // open one to reach its tiles
    const card = skinCard(document);
    const heads = () => find(card.root, hasClass('skinhead'));
    const tiles = () => find(card.root, hasClass('skintile'));
    const worn = () => tiles().filter((t) => t.attrs['aria-pressed'] === 'true').map((t) => find(t, hasClass('skinname'))[0].textContent);
    const wornHeads = () => heads().map((h) => find(h, hasClass('skinname'))[0].textContent);
    assert.deepEqual(wornHeads(), ['Light Fighter (female)', 'Light Fighter (female)'], 'the first set on foot and in the saddle');
    assert.equal(find(card.root, hasClass('skinhint')).length, 1, 'until one is chosen, the others see the class - and the card says so');
    heads()[0].onclick();
    assert.equal(tiles().length, sets.foot.length);
    assert.deepEqual(worn(), ['Light Fighter (female)']);
    tiles()[11].onclick();   // Fighter Mage (male)
    assert.equal(modSetting(V, 'Graphics.OnFoot'), 11, 'the store the body reads and the look sends');
    assert.deepEqual(wornHeads(), ['Fighter Mage (male)', 'Light Fighter (female)']);
    assert.equal(find(card.root, hasClass('skinhint')).length, 0, 'chosen');
    assert.equal(composeLook({ race: 'Nord', gender: 'male' }).eo, 11, 'and the look carries it');
    heads()[1].onclick();
    tiles()[4].onclick();
    assert.equal(modSetting(V, 'Graphics.OnHorse'), 4);
    // the mod off: no panels to change nothing - the switch instead
    setModSetting(V, 'Enabled', false);
    card.paint();
    assert.equal(heads().length, 0);
    const on = find(card.root, (n) => n.textContent === 'Turn it on')[0];
    on.onclick();
    assert.equal(modSetting(V, 'Enabled'), true);
    assert.equal(heads().length, 2);
  });
  // the profile window draws it, under the account card
  assert.match(src('src/ui/enhancedMenu.js'), /body\.append\(accountBody\(\)\);\s*\n\s*body\.append\(skinCard\(document\)\.root\);/);
  _resetModSettings();
});

test('DISC23-B: the look carries the set a player CHOSE - not the mod\'s default, and nothing while the mod is off', () => {
  _resetModSettings();
  const me = { race: 'Nord', gender: 'male', faceIndex: 2, career: { name: 'Warrior' } };
  assert.equal('eo' in composeLook(me), false, 'never chosen: the class sprite as before - the mod ships on, and set 0 on everyone would be one woman in green');
  setModSetting(V, 'Graphics.OnFoot', 5);
  const look = composeLook(me);
  assert.equal(look.eo, 5);
  assert.equal(validLook(look).eo, 5, 'and the relay keeps it');
  setModSetting(V, 'Graphics.OnFoot', 0);
  assert.equal(composeLook(me).eo, 0, 'chosen back to the first set is still a choice');
  setModSetting(V, 'Enabled', false);
  assert.equal('eo' in composeLook(me), false, 'the mod off: no set');
  // the door: bounded, and an older look keeps its bytes
  assert.equal(validLook({ ...look, eo: FOOT_SKINS + 40 }).eo, FOOT_SKINS - 1, 'clamped at the door, as every field is (uint)');
  assert.equal(validLook({ ...look, eo: -1 }).eo, undefined, 'and a set that is no set is no key');
  assert.equal(validLook({ ...look, eo: 'x' }).eo, undefined);
  const old = { race: 'Nord', gender: 'male', faceIndex: 2, class: 'Warrior', items: [] };
  assert.equal(JSON.stringify(validLook(old)), JSON.stringify({ race: 'Nord', gender: 'male', faceIndex: 2, class: 'Warrior', items: [] }));
  _resetModSettings();
});

// ── the walker ──────────────────────────────────────────────────────────────────────────────────────────────────────
function rig() {
  const made = [], gone = [];
  const renderer = {
    uploadTexture() {},
    createBillboardBatch: (archive, record, size) => { const b = { archive, record, size, origin: null }; made.push(b); return b; },
    destroyBillboardBatch: (b) => gone.push(b),
  };
  const art = createEotbArt({ renderer, urlFor: (k) => `u:${k}`, decode: async () => ({ width: 50, height: 110, colors: new Uint32Array(50 * 110) }) });
  return { made, gone, renderer, art };
}
const settle = () => new Promise((r) => setTimeout(r, 5));
const toScene = (p) => [p.x, p.y, p.z];
const pose = (o = {}) => ({ x: 4, y: 0, z: 9, yaw: 0, pitch: 0, mv: 0, wd: 0, an: 0, sr: 0, cn: 0, ar: 0, ...o });

test('DISC23-B: a peer on foot stands as the set they chose - their own archive, the move bit walking it, the name at its top', async () => {
  const { art } = rig();
  const w = createPeerWalkers({ art });
  const peer = { id: 'p1', look: { eo: 7 }, shown: pose({ mv: 1 }) };
  w.sync([peer], toScene, { eye: [4, 1, 20], dt: 0.01 });
  assert.equal(w.isWalking('p1'), false, 'art not up yet - the class sprite still stands for them, never nothing');
  await settle();
  w.sync([peer], toScene, { eye: [4, 1, 20], dt: 0.01 });
  assert.equal(w.isWalking('p1'), true);
  const [b] = w.batches();
  assert.equal(b.archive, ARCHIVE_FOOT + 7, 'Mage (male) - their set, not the Mage monster');
  assert.equal(w.walkers.get('p1').table, 'Move');
  assert.ok(Math.abs(b.origin[0] - 4) < 1 && Math.abs(b.origin[2] - 9) < 1e-9, `at their feet: ${b.origin}`);
  assert.ok(w.heightOf('p1') > 1.5, 'the name rides the sprite\'s own top');
  // a drawn weapon stands them ready, a readied spell with the spell stance
  w.sync([{ ...peer, shown: pose({ wd: 1 }) }], toScene, { eye: [4, 1, 20], dt: 0.01 });
  assert.equal(w.walkers.get('p1').table, 'IdleMelee');
  w.sync([{ ...peer, shown: pose({ sr: 1, mv: 1 }) }], toScene, { eye: [4, 1, 20], dt: 0.01 });
  assert.equal(w.walkers.get('p1').table, 'MoveSpell');
});

test('DISC23-B: a swing, a loosed shaft and a cast each play their clip ONCE - and first sight is no swing', async () => {
  const { art } = rig();
  const w = createPeerWalkers({ art });
  const at = (o) => ({ id: 'p1', look: { eo: 2 }, shown: pose(o) });
  w.sync([at({ an: 41 })], toScene, { eye: [4, 1, 20], dt: 0 });
  assert.equal(w.walkers.get('p1').table, 'Idle', 'a peer met mid-session has a swing count of their own - not a swing');
  for (const o of WALK_ONE_SHOTS) {
    const before = { an: 41, ar: 0, cn: 0 };
    w.sync([at(before)], toScene, { eye: [4, 1, 20], dt: 0 });
    w.sync([at({ ...before, [o.field]: before[o.field] + 1 })], toScene, { eye: [4, 1, 20], dt: 0 });
    const r = w.walkers.get('p1');
    assert.equal(r.table, o.table, `${o.field} plays ${o.table}`);
    // the whole clip, then back to standing
    const n = frameCount(o.table);
    w.sync([at({ ...before, [o.field]: before[o.field] + 1 })], toScene, { eye: [4, 1, 20], dt: o.tick() * (n - 0.5) });
    assert.equal(r.table, o.table, 'still swinging on its last frame');
    w.sync([at({ ...before, [o.field]: before[o.field] + 1 })], toScene, { eye: [4, 1, 20], dt: o.tick() });
    assert.equal(r.table, 'Idle', 'and done');
    // put the counter back so the next one starts from the same place
    w.sync([at(before)], toScene, { eye: [4, 1, 20], dt: 0 });
    w.sync([at(before)], toScene, { eye: [4, 1, 20], dt: 10 });
  }
});

test('DISC23-B: who is NOT a walker - a Morrowind body on this screen, a rider, a beast, the dying, a look with no set, the card on the doll', async () => {
  const { art } = rig();
  let sprites = true;
  const w = createPeerWalkers({ art, enabled: () => sprites });
  const on = (o = {}, look = { eo: 1 }) => ({ id: 'p', look, shown: pose(o) });
  w.sync([on()], toScene, { eye: [0, 1, 0], dt: 0 }); await settle();
  const drawn = (peer, skip) => { w.sync([peer], toScene, { eye: [0, 1, 0], dt: 0, skip }); return w.isWalking('p'); };
  assert.equal(drawn(on()), true);
  assert.equal(drawn(on(), (id) => id === 'p'), false, 'the viewer\'s Morrowind body stands for them');
  assert.equal(drawn(on({ rd: 1 })), false, 'a rider is the riders\' layer\'s');
  assert.equal(drawn(on({ wb: 1 })), false, 'the beast is the beast\'s own sprite');
  assert.equal(drawn(on({ dd: 1 })), false, 'the fallen body is PCORPSE\'s');
  assert.equal(drawn(on({}, { class: 'Mage' })), false, 'no set chosen: their class, as before');
  assert.equal(drawn(on({}, null)), false);
  sprites = false;
  assert.equal(drawn(on()), false, 'the Other players card on the paperdoll: the doll');
  // one store for both layers - a rider's art and a walker's are asked once
  const riders = createPeerRiders({ art });
  assert.ok(riders);
});

test('DISC23-B: the host - one art store, the walkers after the bodies and skipping them, their height to the name pass, swept with the rest', () => {
  const w = src('src/scenes/world.js');
  assert.match(w, /const eotbArt = createEotbArt\(\{ renderer \}\);[^\n]*\n\s*peerRiders = createPeerRiders\(\{ renderer, art: eotbArt \}\);[^\n]*\n\s*peerWalkers = createPeerWalkers\(\{ renderer, art: eotbArt, enabled: \(\) => getPref\('peerClassSprites'\) !== false \}\);/);
  assert.match(w, /peerBodies\.sync\(afoot,[^\n]*\n(?:\s*\/\/[^\n]*\n)*\s*peerWalkers\.sync\(drawable, onlineToScene, \{ eye: cam\.pos, right: \[Math\.cos\(cam\.yaw\), 0, -Math\.sin\(cam\.yaw\)\], dt, skip: \(id\) => peerBodies\.heightOf\(id\) > 0, hurt: \(id\) => peerHurtAge\(id\) < PEER_FLINCH_S \}\);/);   // PEERFX3: and a class skin's hurt pose
  assert.match(w, /bodyHeight: \(id\) => peerRiders\.heightOf\(id\) \|\| peerBodies\.heightOf\(id\) \|\| peerWalkers\.heightOf\(id\),/);
  assert.match(w, /peerWalkers\?\.offsetAll\(r\.offset\);/);
  assert.match(w, /if \(peerWalkers\) for \(const b of peerWalkers\.batches\(\)\) \{ if \(!\(cullOn && billboardOutside\(b\)\)\) allBatches\.push\(b\); \}/);
});
