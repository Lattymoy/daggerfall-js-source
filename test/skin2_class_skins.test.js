// SKIN2 (2026-09-25, Mac, with an archive of Daggerfall's class sprites - ExistingClasses: "1. Implement these as new
// skin options 2. Reorganize the skin selector as 2 single panels for unmounted/mount that can be opened to view
// available skins").
//
// (1) Daggerfall's own classes - twenty sheets, the enemy-class layout (walk, attack, hurt, idle, ranged/spell, bow) -
// are on-foot skins 16..35, after Eye of the Beholder's sixteen, drawn through the one door every sprite reader uses
// (player/eotbSprite.js spriteFor): the body, the preload, the peers and the Skin card. (2) The card is two panels,
// ON FOOT and MOUNTED, each closed to the worn skin and opened on a press to the skins it offers.
//
// Driven through the real manifest and files on disk, the real spriteFor, the real settings store, the real look and
// wire door, the real walker layer and the real card against a fake document; the cascade read off ENHANCED_CSS.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import {
  CLASS_SKINS, EOTB_FOOT_SET_COUNT, FOOT_SKIN_COUNT, classSkinOf, classSkinLabel, classRecord, classFrame,
  CLASS_TABLE_BASE, CLASS_BOW_BASE,
} from '../src/player/classSkins.js';
import { spriteFor, tableKeys } from '../src/player/eotbSprite.js';
import { STATE_TABLES, frameCount, ORIENTATIONS, ARCHIVE_FOOT } from '../src/player/eotbBillboard.js';
import { MOD_SETTINGS, modSetting, setModSetting, _resetModSettings } from '../src/systems/modSettings.js';
import { composeLook } from '../src/net/remotePlayers.js';
import { validLook, FOOT_SKINS } from '../src/net/wire.js';
import { createPeerWalkers, createEotbArt } from '../src/net/peerRiders.js';
import { skinCard, skinSets, FOOT_GROUPS } from '../src/ui/skinCard.js';
import { ENHANCED_CSS } from '../src/ui/enhancedStyle.js';

const V = 'eye-of-the-beholder';
const png = (key) => new URL(`../vendor/class-skins/Textures/${key.split('_')[0]}/${key}.png`, import.meta.url);
const skin = (name, gender) => CLASS_SKINS.find((s) => s.name === name && s.gender === gender);
const indexOf = (s) => EOTB_FOOT_SET_COUNT + CLASS_SKINS.indexOf(s);

test('SKIN2: the twenty class sheets are vendored, and the manifest counts every record\'s frames off the files themselves', () => {
  assert.equal(CLASS_SKINS.length, 20);
  assert.equal(new Set(CLASS_SKINS.map((s) => s.archive)).size, 20, 'one archive a skin - a key names one picture');
  for (const s of CLASS_SKINS) {
    assert.ok(s.archive < ARCHIVE_FOOT, `${classSkinLabel(s)}: a Daggerfall archive, never one of the mod's (${s.archive})`);
    assert.equal(s.frames.length, s.bow ? 30 : 25, `${classSkinLabel(s)}: five groups, six with a bow`);
    const files = readdirSync(new URL(`../vendor/class-skins/Textures/${s.archive}/`, import.meta.url));
    assert.equal(files.length, s.frames.reduce((a, b) => a + b, 0), `${classSkinLabel(s)}: the manifest is the folder`);
    s.frames.forEach((n, rec) => {
      assert.ok(n >= 1, `${s.archive} record ${rec} has a frame`);
      for (let f = 0; f < n; f++) assert.ok(existsSync(png(`${s.archive}_${rec}-${f}`)), `${s.archive}_${rec}-${f}: numbered with no gap`);
      assert.ok(!existsSync(png(`${s.archive}_${rec}-${n}`)), `${s.archive} record ${rec}: no frame past the count`);
    });
  }
  // the pack is not uniform, and the manifest says so rather than assuming the layout
  assert.equal(skin('Healer', 'female').frames[20], 5, 'the female healer casts in five');
  assert.equal(skin('Bounty Hunter', 'male').frames[24], 2, 'the bounty hunter\'s last ranged record is two');
  assert.equal(skin('Pirate', 'male').frames[3], 4, 'the pirate\'s record 3 walks in four - its 3-1 shipped as `1529_3-1_.png`, an underscore that is a typo, not a withdrawn frame');
  assert.deepEqual(CLASS_SKINS.filter((s) => s.bow).map(classSkinLabel), ['Assassin (male)', 'Assassin (female)', 'Nightblade (male)', 'Nightblade (female)']);
  assert.equal(classSkinLabel(skin('Dark Acolyte', null)), 'Dark Acolyte', 'no sex named, none printed');
  assert.ok(Object.isFrozen(CLASS_SKINS) && Object.isFrozen(CLASS_SKINS[0].frames));
});

test('SKIN2: an index past the mod\'s sixteen is a class skin; the tables read the class sheet\'s groups, the bow where there is one', () => {
  assert.equal(EOTB_FOOT_SET_COUNT, 16);
  assert.equal(FOOT_SKIN_COUNT, 36);
  assert.equal(FOOT_SKINS, FOOT_SKIN_COUNT, 'the wire\'s literal (the relay imports no skin table) is the skin count');
  assert.equal(classSkinOf(15), null, 'the mod\'s own last set');
  assert.equal(classSkinOf(16), CLASS_SKINS[0]);
  assert.equal(classSkinOf(35), CLASS_SKINS[19]);
  assert.equal(classSkinOf(36), null, 'past the last: no skin (the mod\'s path draws its own)');
  assert.equal(classSkinOf(undefined), null);
  assert.equal(classSkinOf(16.5), null);
  assert.equal(classSkinOf('20'), null, 'a string is no index - CLASS_SKINS[\'4\'] would answer one');
  // every body table has a group; the ready stances stand in the idle, death in the hurt pose
  for (const t of Object.keys(STATE_TABLES).filter((t) => !t.endsWith('Horse') && !t.endsWith('Lycan'))) assert.ok(CLASS_TABLE_BASE[t] != null, t);
  const plain = skin('Acrobat', 'male'), bowman = skin('Assassin', 'male');
  assert.equal(classRecord(plain, 'Idle', 2), 17);
  assert.equal(classRecord(plain, 'Move', 0), 0);
  assert.equal(classRecord(plain, 'AttackMelee', 4), 9);
  assert.equal(classRecord(plain, 'Death', 1), 11);
  assert.equal(classRecord(plain, 'AttackSpell', 3), 23);
  assert.equal(classRecord(plain, 'AttackRanged', 0), 20, 'no bow: the throw');
  assert.equal(classRecord(bowman, 'AttackRanged', 0), CLASS_BOW_BASE, 'a bow: the bow');
  assert.equal(classRecord(bowman, 'AttackSpell', 0), 20, 'the bow is the loose only - the cast stays the cast');
  assert.equal(classRecord(plain, 'IdleHorse', 0), null, 'no class rides');
  // the class frames spread over the body's clip, in order, never past the record
  assert.deepEqual([0, 1, 2, 3].map((f) => classFrame(plain, 0, f, 4)), [0, 1, 2, 3], 'a four-frame walk under a four-frame walk');
  assert.deepEqual([0, 1].map((f) => classFrame(plain, 0, f, 2)), [0, 2], 'under a two-frame armed walk: frames 0 and 2');
  assert.deepEqual([0, 1].map((f) => classFrame(plain, 15, f, 2)), [0, 0], 'a one-frame idle held');
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((f) => classFrame(plain, 5, f, 6)), [0, 1, 2, 3, 4, 5], 'the six-frame swing');
  assert.deepEqual([0, 1, 2, 3].map((f) => classFrame(skin('Healer', 'female'), 20, f, 4)), [0, 1, 2, 3], 'five frames under four: never past');
  assert.deepEqual([0, 1, 2, 3].map((f) => classFrame(skin('Bounty Hunter', 'male'), 24, f, 4)), [0, 0, 1, 1]);
  assert.equal(classFrame(plain, 0, 9, 4), 3, 'a frame past the clip is its last');
  assert.equal(classFrame(plain, 0, -1, 4), 0);
});

test('SKIN2: spriteFor draws a class skin through the one door - the wheel and the mirror the mod\'s, the record and frame the sheet\'s', () => {
  const acro = indexOf(skin('Acrobat', 'male')), asn = indexOf(skin('Assassin', 'male'));
  for (let o = 0; o < ORIENTATIONS; o++) {
    const mod = spriteFor('Idle', o, 0, { onFoot: 0 });
    const cls = spriteFor('Idle', o, 0, { onFoot: acro });
    assert.equal(cls.archive, 1523);
    assert.equal(cls.record, 15 + (mod.record - STATE_TABLES.Idle.base), `orientation ${o}: the same offset into the class idle`);
    assert.equal(cls.mirror, mod.mirror, `orientation ${o}: the mod's mirror`);
    assert.equal(cls.key, `1523_${cls.record}-0`);
    assert.ok(existsSync(png(cls.key)), cls.key);
    assert.equal(cls.rec, `${cls.record}-0${cls.mirror ? 'm' : ''}`, 'the body\'s cache key tells a mirrored view apart');
    assert.equal(spriteFor('Idle', o, 0, { onFoot: acro }, { flip: true }).mirror, !cls.mirror);
  }
  // every table, orientation and frame of every class skin names a file that is there
  for (let i = EOTB_FOOT_SET_COUNT; i < FOOT_SKIN_COUNT; i++) {
    for (const t of Object.keys(CLASS_TABLE_BASE)) {
      for (let f = 0; f < frameCount(t); f++) for (const k of tableKeys(t, f, { onFoot: i })) assert.ok(existsSync(png(k)), `${i} ${t} ${f}: ${k}`);
    }
  }
  assert.equal(spriteFor('AttackRanged', 0, 2, { onFoot: asn }).key, '1536_25-2', 'the assassin looses the bow');
  assert.equal(spriteFor('AttackRanged', 0, 2, { onFoot: acro }).key, '1523_20-2', 'the acrobat throws');
  assert.equal(spriteFor('MoveMelee', 0, 1, { onFoot: acro }).key, '1523_0-2');
  // the saddle and the beast are the mod's whatever is worn on foot
  assert.equal(spriteFor('IdleHorse', 0, 0, { onFoot: acro, onHorse: 3 }).key, spriteFor('IdleHorse', 0, 0, { onFoot: 0, onHorse: 3 }).key);
  assert.equal(spriteFor('IdleLycan', 0, 0, { onFoot: acro }).key, spriteFor('IdleLycan', 0, 0, { onFoot: 0 }).key);
  // and the mod's own sets are drawn as they were
  assert.equal(spriteFor('Idle', 0, 0, { onFoot: 7 }).archive, ARCHIVE_FOOT + 7);
});

test('SKIN2: the setting offers them, the look sends them, the relay keeps them, and a peer in one is drawn in it', async () => {
  _resetModSettings();
  const foot = MOD_SETTINGS[V].keys['Graphics.OnFoot'];
  assert.equal(foot.max, FOOT_SKIN_COUNT - 1);
  assert.deepEqual(foot.labels.slice(EOTB_FOOT_SET_COUNT), CLASS_SKINS.map(classSkinLabel));
  const sorc = indexOf(skin('Sorcerer', 'female'));
  setModSetting(V, 'Graphics.OnFoot', sorc);
  assert.equal(modSetting(V, 'Graphics.OnFoot'), sorc, 'the store keeps an index past the mod\'s range');
  const look = composeLook({ race: 'Breton', gender: 'female', faceIndex: 1 });
  assert.equal(look.eo, sorc);
  assert.equal(validLook(look).eo, sorc, 'the relay\'s door passes it - not clamped to the mod\'s last set');
  assert.equal(validLook({ ...look, eo: 99 }).eo, FOOT_SKINS - 1);
  _resetModSettings();
  // the walker: the peer's look names the skin, and the batch is the class sheet's
  const renderer = {
    uploadTexture() {},
    createBillboardBatch: (archive, record, size) => ({ archive, record, size, origin: null }),
    destroyBillboardBatch() {},
  };
  const art = createEotbArt({ renderer, urlFor: (k) => `u:${k}`, decode: async () => ({ width: 50, height: 110, colors: new Uint32Array(50 * 110) }) });
  const w = createPeerWalkers({ art });
  const peer = { id: 'p1', look: { eo: sorc }, shown: { x: 4, y: 0, z: 9, yaw: 0, pitch: 0, mv: 1, wd: 0, an: 0, sr: 0, cn: 0, ar: 0 } };
  const at = { eye: [4, 1, 20], dt: 0.01 };
  w.sync([peer], (p) => [p.x, p.y, p.z], at);
  await new Promise((r) => setTimeout(r, 5));
  w.sync([peer], (p) => [p.x, p.y, p.z], at);
  assert.equal(w.isWalking('p1'), true);
  assert.equal(w.batches()[0].archive, 1541, 'the sorceress\'s own sheet');
});

// ── the card ────────────────────────────────────────────────────────────────────────────────────────────────────────
function fakeEl(tag) {
  let text = '';
  const n = {
    tag, children: [], className: '', title: '', attrs: {}, type: '', src: '', alt: '',
    get textContent() { return text; },
    set textContent(v) { text = v; n.children.length = 0; },
    append(...cs) { for (const c of cs) { n.children.push(c); c.parent = n; } },
    setAttribute(k, v) { n.attrs[k] = v; },
  };
  return n;
}
const doc = { createElement: fakeEl };
const find = (n, cls, out = []) => {
  if (typeof n.className === 'string' && n.className.split(/\s+/).includes(cls)) out.push(n);
  for (const c of n.children ?? []) find(c, cls, out);
  return out;
};
const text = (n) => n.textContent;

test('SKIN2: the card is two panels, closed to the skin worn - one opens at a time, and a choice wears it and closes', () => {
  _resetModSettings();
  const sets = skinSets();
  assert.equal(sets.foot.length, FOOT_SKIN_COUNT);
  assert.equal(sets.foot[16].key, '1523_15-0', 'a class skin\'s picture is its own front-on idle');
  const card = skinCard(doc);
  const panels = () => find(card.root, 'skinpanel');
  const heads = () => find(card.root, 'skinhead');
  const tiles = () => find(card.root, 'skintile');
  const panelOf = (h) => h.parent;
  assert.equal(panels().length, 2, 'two panels');
  assert.deepEqual(heads().map((h) => text(find(h, 'fieldlabel')[0])), ['On foot', 'Mounted']);
  assert.equal(tiles().length, 0, 'CLOSED: no grid down the profile');
  assert.deepEqual(heads().map((h) => text(find(h, 'skinname')[0])), ['Light Fighter (female)', 'Light Fighter (female)'], 'each closed to the skin worn');
  assert.deepEqual(heads().map((h) => h.attrs['aria-expanded']), ['false', 'false']);
  // open on foot: its skins, under the mod's heading and the classes'
  heads()[0].onclick();
  assert.deepEqual(heads().map((h) => h.attrs['aria-expanded']), ['true', 'false']);
  assert.ok(panels()[0].className.includes('open') && !panels()[1].className.includes('open'));
  assert.equal(tiles().length, FOOT_SKIN_COUNT, 'every on-foot skin');
  assert.deepEqual(find(card.root, 'skingroup').map(text), FOOT_GROUPS.map((g) => g.label));
  const grids = find(card.root, 'skingrid');
  assert.deepEqual(grids.map((g) => g.children.length), [EOTB_FOOT_SET_COUNT, CLASS_SKINS.length]);
  assert.equal(grids[1].attrs['aria-label'], 'Daggerfall classes');
  assert.ok(grids.every((g) => g.parent === grids[0].parent && panelOf(heads()[0]) === grids[0].parent.parent), 'inside the panel it opened');
  // open mounted: on foot closes - one at a time
  heads()[1].onclick();
  assert.deepEqual(heads().map((h) => h.attrs['aria-expanded']), ['false', 'true']);
  assert.equal(tiles().length, 5);
  assert.equal(find(card.root, 'skingroup').length, 0, 'one shelf, no heading');
  // pressing the open head closes it
  heads()[1].onclick();
  assert.equal(tiles().length, 0);
  // choose a class skin: worn, the panel closed on it, its picture in the head
  heads()[0].onclick();
  const monk = indexOf(skin('Monk', 'female'));
  tiles()[monk].onclick();
  assert.equal(modSetting(V, 'Graphics.OnFoot'), monk, 'the store the body reads and the look sends');
  assert.equal(tiles().length, 0, 'chosen: closed');
  const [footHead] = heads();
  assert.equal(text(find(footHead, 'skinname')[0]), 'Monk (female)');
  const art = find(footHead, 'skinart')[0];
  assert.equal(art, undefined, 'node has no bundle, so no URL - the name alone (the browser build draws the picture)');
  // reopened, the worn tile is the one marked
  heads()[0].onclick();
  assert.deepEqual(tiles().filter((t) => t.attrs['aria-pressed'] === 'true').map((t) => text(find(t, 'skinname')[0])), ['Monk (female)']);
  // the card's state survives a repaint (the window repaints it)
  card.paint();
  assert.equal(heads()[0].attrs['aria-expanded'], 'true');
  _resetModSettings();
});

test('SKIN2: the head carries the worn skin\'s picture - the same one its tile draws', () => {
  _resetModSettings();
  assert.ok(skinSets().foot.every((s) => s.url === null), 'node: no bundle (the browser build\'s glob is the only source of URLs)');
  const withUrls = () => { const s = skinSets(); for (const x of [...s.foot, ...s.horse]) x.url = `u:${x.key}`; return s; };
  const card = skinCard(doc, { sets: withUrls });
  const imgOf = (n) => find(n, 'skinart')[0];
  const heads = () => find(card.root, 'skinhead');
  assert.equal(imgOf(heads()[0]).src, 'u:112364_0-0', 'the worn set, front on');
  assert.equal(imgOf(heads()[0]).alt, '', 'the name beside it speaks');
  assert.equal(imgOf(heads()[1]).src, 'u:112382_0-0', 'the worn rider');
  assert.equal(heads()[0].title, 'Choose on foot skin');
  heads()[0].onclick();
  assert.equal(heads()[0].title, 'Close on foot skins');
  assert.equal(heads()[0].children.at(-1).textContent, '\u25b4', 'the chevron points up, open');
  assert.equal(heads()[1].children.at(-1).textContent, '\u25be');
  const tile = find(card.root, 'skintile')[16];
  assert.equal(imgOf(tile).src, 'u:1523_15-0');
  tile.onclick();
  assert.equal(imgOf(heads()[0]).src, 'u:1523_15-0', 'chosen: the head shows it');
  _resetModSettings();
});

test('SKIN2: the panels are styled as panels - a wide press closed, the brass edge open, the chevron saying which', () => {
  const rule = (sel) => {
    const m = ENHANCED_CSS.match(new RegExp(`(?:^|\\n)${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`));
    assert.ok(m, `${sel} is styled`);
    return m[1];
  };
  assert.match(rule('.card .skinpanel'), /border: 1px solid var\(--iron\);/);
  assert.match(rule('.card .skinpanel.open'), /border-color: var\(--brass\);/);
  assert.match(rule('.card button.skinhead'), /width: 100%;/);
  assert.match(rule('.card button.skinhead'), /display: flex;/);
  assert.match(rule('.card button.skinhead .skinart'), /height: 56px;/);
  assert.match(rule('.card .skinbody'), /border-top: 1px solid var\(--iron\);/);
  assert.match(rule('.card .skingroup'), /text-transform: uppercase;/);
});
