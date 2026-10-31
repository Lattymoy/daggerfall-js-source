// GUILD-SHOP (bible/11-Multiplayer/Guild-Shop.md): THE GUILD SAILCLOTH - a ship's sail in a pattern of two paints, her
// guild's arms on it; the cloth on her livery's one number past its four nibbles; the paint shop's paint a pair of arms
// at a time; the Fleet's paint panel shut until the account holds the ware, a cloth she flies kept through a repaint.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SAIL_PATTERNS, SAIL_SECOND_MAX, sailClothOf, sailClothCode, sailClothOfCode, sailSecond, clothPicture } from '../../../src/systems/naval/sailCloth.js';
import { liveryOf, liveryCode, liveryOfCode, PAINT_MAX } from '../../../src/systems/naval/shipLivery.js';
import { liveryArtOf, shadeCloth } from '../../../src/world/ships/shipLiveryArt.js';
import { GALLEON_ARCHIVE, TEX as GTEX, C } from '../../../src/world/ships/galleonArt.js';
import { createLiveryPaint, CLASSIC_SAIL } from '../../../src/scenes/comeSailAway/shipLiveryPaint.js';
import { noteGuildShop, guildWareHeld, setGuildStockReader, _resetGuildStock } from '../../../src/net/guild/guildStock.js';
import { createFleetHost } from '../../../src/scenes/fleetHost.js';
import { clothSvg, sailClothRows, SAILCLOTH_SHUT } from '../../../src/ui/sailClothPanel.js';
import { paintSvg } from '../../../src/ui/fleetPage.js';
import { scene, terrain } from '../../csaScene.mjs';
import { fleetShip, fleetBook, titleDeed, titleOf, _resetFleetForTests } from '../../../src/systems/fleet.js';
import { mintDeed, mintBoatItem } from '../../../src/systems/comeSailAway/comeSailAwayItems.js';

const pic = (w, h, fill) => { const data = new Uint8Array(w * h * 4); for (let i = 0; i < w * h; i++) { const c = fill(i); data.set([c[0], c[1], c[2], c[3] ?? 255], i * 4); } return { width: w, height: h, data }; };
const px = (p, x, y) => [...p.data.slice((y * p.width + x) * 4, (y * p.width + x) * 4 + 4)];
const tick = () => new Promise((r) => setTimeout(r, 0));
const ARMS = { heraldry: { field: 'crimson', device: 'tower', border: 'gold' }, logo: null };

test('GUILD-SHOP the sailcloth\'s law: eight patterns in a fixed order, a second paint no further than the livery\'s last, arms flown or not; plain without arms is none and a plain cloth shows no second; one byte - three bits, four, one - round trip for each (mutants: the door, the byte, the bounds)', () => {
  assert.deepEqual(SAIL_PATTERNS, ['plain', 'stripes', 'bands', 'quartered', 'chevron', 'cross', 'border', 'saltire'], 'a pattern\'s place is its number on the wire');
  assert.equal(SAIL_SECOND_MAX, PAINT_MAX, 'the second is one of the livery\'s paints');
  assert.equal(sailClothOf({ pattern: 'plain' }), null);
  assert.equal(sailClothOf({ pattern: 'plain', second: 4 }), null, 'a plain cloth without arms is none');
  assert.deepEqual(sailClothOf({ pattern: 'plain', second: 4, arms: true }), { pattern: 'plain', second: 0, arms: true });
  for (const bad of [{ pattern: 'tartan' }, { pattern: 'stripes', second: 15 }, { pattern: 'stripes', second: -1 }, { pattern: 'stripes', second: 1.5 }, 'stripes', null]) assert.equal(sailClothOf(bad), null, JSON.stringify(bad));
  assert.equal(sailClothOf({ pattern: 'stripes', second: 3, arms: 'yes' }).arms, false, 'arms flown only on true');
  for (const pattern of SAIL_PATTERNS) for (const second of [0, 7, 14]) for (const arms of [false, true]) {
    const c = sailClothOf({ pattern, second, arms });
    const code = sailClothCode({ pattern, second, arms });
    assert.ok(code >= 0 && code < 256);
    assert.deepEqual(sailClothOfCode(code), c, `${pattern} ${second} ${arms}`);
  }
  assert.equal(sailClothCode({ pattern: 'quartered', second: 5, arms: true }), 3 | (5 << 3) | 128);
  assert.deepEqual([sailClothOfCode(0), sailClothOfCode(256), sailClothOfCode(1.5), sailClothOfCode((15 << 3) | 1)], [null, null, null, null]);
});

test('GUILD-SHOP the livery carries her sailcloth: kept on a hull with a sail and dropped on one without, a livery of cloth alone a livery; its byte over the four nibbles, round trip; a number whose byte is no cloth refused whole; a build before reads her as built (mutants: the cloth\'s part, the code, the door)', () => {
  const cloth = { pattern: 'cross', second: 11, arms: true };
  assert.deepEqual(liveryOf({ sail: 3, cloth }, 2), { strake: 0, accent: 0, sail: 3, stain: 0, cloth: sailClothOf(cloth) });
  assert.equal(liveryOf({ cloth }, 0), null, 'the rowboat has no sail: her cloth none, and nothing else painted');
  assert.deepEqual(liveryOf({ cloth }, 2), { strake: 0, accent: 0, sail: 0, stain: 0, cloth: sailClothOf(cloth) }, 'a cloth on her canvas as built');
  const code = liveryCode({ strake: 4, sail: 3, cloth });
  assert.equal(code, 4 | (3 << 8) | (sailClothCode(cloth) << 16));
  assert.deepEqual(liveryOfCode(code), liveryOf({ strake: 4, sail: 3, cloth }));
  assert.equal(liveryOfCode(code | (1 << 24)), null, 'past three bytes');
  assert.equal(liveryOfCode(((15 << 3) | 1) << 16 | 4), null, 'a byte that is no cloth');
  assert.ok(code >= 1 << 16, 'a reader of four nibbles alone refuses it, and draws her as built');
});

test('GUILD-SHOP the cloth painted: each texel her sail\'s paint or the second as the pattern lays them, shaded as the cloth was; the arms over the middle a little above it, the cloth\'s light through them; a clear texel left clear; the canvas her cloth on a port hull, the classic sail\'s too (mutants: the pattern, the emblem, the art)', async () => {
  assert.deepEqual([sailSecond('stripes', 0.1, 0.5), sailSecond('stripes', 0.25, 0.5), sailSecond('bands', 0.5, 0.3), sailSecond('quartered', 0.2, 0.8), sailSecond('quartered', 0.2, 0.2)], [false, true, true, true, false]);
  assert.deepEqual([sailSecond('border', 0.05, 0.5), sailSecond('border', 0.5, 0.5), sailSecond('saltire', 0.5, 0.5), sailSecond('cross', 0.42, 0.1), sailSecond('plain', 0.5, 0.5)], [true, false, true, true, false]);
  const base = [200, 200, 200];
  const src = pic(12, 12, (i) => (i === 0 ? [0, 0, 0, 0] : i % 12 === 11 ? [100, 100, 100] : base));
  const out = clothPicture(src, [200, 0, 0], [0, 0, 200], { pattern: 'stripes', second: 1, arms: false }, base);
  assert.deepEqual(px(out, 0, 0), [0, 0, 0, 0], 'a clear texel clear');
  assert.deepEqual(px(out, 1, 5), [200, 0, 0, 255], 'the first stripe her sail\'s');
  assert.deepEqual(px(out, 2, 5), [0, 0, 200, 255], 'the second the second paint');
  assert.deepEqual(px(out, 11, 5), [0, 0, 100, 255], 'shaded as the cloth was');
  assert.deepEqual(px(src, 2, 5), [200, 200, 200, 255], 'the picture handed in untouched');
  const emblem = pic(2, 2, () => [0, 255, 0]);
  const armed = clothPicture(src, [200, 0, 0], [0, 0, 200], { pattern: 'plain', second: 0, arms: true }, base, emblem);
  assert.deepEqual(px(armed, 6, 4), [0, 255, 0, 255], 'the arms over the middle');
  assert.deepEqual(px(armed, 6, 10), [200, 0, 0, 255], 'and none below them');
  assert.deepEqual(px(clothPicture(src, [200, 0, 0], [0, 0, 200], { pattern: 'plain', second: 0, arms: false }, base, emblem), 6, 4), [200, 0, 0, 255], 'arms not flown: none');
  // her canvas on a port hull
  const canvas = pic(8, 8, () => C.canvas);
  const art = (lv, emb) => liveryArtOf(GALLEON_ARCHIVE, lv, emb).find((x) => x.record === GTEX.canvas)?.picture;
  const plain = art({ strake: 0, accent: 0, sail: 3, stain: 0 });
  assert.ok(plain, 'a painted sail');
  const clothed = art(liveryOf({ sail: 3, cloth: { pattern: 'stripes', second: 7 } }, 2));
  assert.notDeepEqual(clothed?.data, plain.data, 'her cloth\'s stripes on it');
  assert.ok(art(liveryOf({ cloth: { pattern: 'plain', arms: true } }, 2), pic(4, 4, () => [0, 255, 0])), 'a cloth on canvas as built is painted');
  assert.equal(shadeCloth(canvas, [10, 20, 30]).width, 8);
});

/** A renderer that keeps each upload's colours. */
function recordingRenderer() {
  const r = { up: new Map() };
  return Object.assign(r, { uploadTexture: (a, rec, c) => r.up.set(`${a}_${rec}`, c), uploadEmissionTexture() {} });
}
function classicPipeline() {
  const bitmap = { width: 4, height: 4, data: new Uint8Array(16).fill(9) };
  const file = { recordCount: 8, getDFBitmap: () => bitmap, getSize: () => ({ width: 4, height: 4 }), getScale: () => ({ width: 0, height: 0 }) };
  return { getTexture: async () => file, uploadRecord() {}, cpuModels: new Map(), palette: { getRed: (i) => i * 10, getGreen: (i) => i * 8, getBlue: (i) => i * 6 } };
}

test('GUILD-SHOP the paint shop: her paint is made once, and a sailcloth flying arms paints her canvas alone again a pair of arms at a time - two guilds\' ships two canvases, one guild\'s one, her strakes one picture for all; while the arms are painted she wears her paint without them; the classic sail is tinted alone, never patterned (AUDIT GUILD-SHOP N1-N3) (mutants: the slot, the base reused, the base meanwhile, the classic cloth)', async () => {
  const renderer = recordingRenderer();
  const shop = createLiveryPaint({ renderer, pipeline: classicPipeline(), portArchiveOf: (h) => (h === 2 ? GALLEON_ARCHIVE : null), log: { warn() {} } });
  const code = liveryCode({ strake: 4, sail: 3, cloth: { pattern: 'cross', second: 7, arms: true } });
  const other = { heraldry: { field: 'azure', device: 'star', border: 'gold' }, logo: null };
  const sail = `${GALLEON_ARCHIVE}_${GTEX.canvas}`, hull = `${GALLEON_ARCHIVE}_${GTEX.hullSide0}`;
  const at = (a, src = sail) => shop.remapOf(2, code, false, null, a)?.get(src);
  for (const a of [ARMS, other, null]) at(a);
  await tick(); await tick();
  const none = at(null);
  assert.ok(none, 'her paint made, the pattern alone');
  assert.equal(at(ARMS), none, 'while her arms are painted, her paint without them - never as built');
  at(other);
  await tick(); await tick();
  const [mine, theirs] = [ARMS, other].map((a) => at(a));
  assert.ok(mine && theirs);
  assert.notEqual(mine, theirs, 'two guilds\' arms, two canvases');
  assert.notEqual(mine, none, 'the arms a canvas of their own');
  assert.equal(at({ ...ARMS }), mine, 'one guild\'s arms one canvas');
  assert.equal(at(ARMS, hull), at(null, hull), 'her strakes one picture, painted once');
  const noArms = liveryCode({ sail: 3, cloth: { pattern: 'cross', second: 7 } });
  shop.remapOf(2, noArms, false, null, ARMS); await tick(); await tick();
  assert.equal(shop.remapOf(2, noArms, false, null, ARMS).get(sail), shop.remapOf(2, noArms, false, null, null).get(sail), 'a cloth flying no arms is one paint whoever sails her');
  const galley = liveryCode({ stain: 3, sail: 5, cloth: { pattern: 'bands', second: 2 } });
  shop.remapOf(3, galley, false, null); await tick(); await tick(); await tick();
  const classicSail = shop.remapOf(3, galley, false, null).get(`${CLASSIC_SAIL[0]}_${CLASSIC_SAIL[1]}`);
  assert.ok(classicSail, 'her classic sail in her sail\'s paint');
  const plain = liveryCode({ stain: 3, sail: 5 });
  shop.remapOf(3, plain, false, null); await tick(); await tick(); await tick();
  const plainSail = shop.remapOf(3, plain, false, null).get(`${CLASSIC_SAIL[0]}_${CLASSIC_SAIL[1]}`);
  const pixels = (key) => { const c = renderer.up.get(key); return [...(c?.colors ?? c?.data ?? c ?? [])].join(','); };
  assert.ok(pixels(plainSail).length > 100, 'its picture read');
  assert.equal(pixels(classicSail), pixels(plainSail), 'the same tint, no pattern on it');
  assert.equal(liveryOf({ cloth: { pattern: 'bands', second: 2 } }, 3), null, 'the galley takes no sailcloth');
});

test('GUILD-SHOP the ware held, as the shop last read it: unread asks once a read is wanted; the account\'s wares from its rows, the guild\'s not among them; a read that found no guild holds none (mutants: the held set, the none)', () => {
  _resetGuildStock();
  let asked = 0;
  setGuildStockReader(() => { asked++; });
  assert.equal(guildWareHeld('guildsails'), null);
  assert.equal(asked, 1);
  noteGuildShop({ wares: [{ key: 'guildsails', payer: 'account', held: true }, { key: 'insigniaarmlet', payer: 'account', held: false }, { key: 'banker', payer: 'guild', owned: 1 }] });
  assert.deepEqual([guildWareHeld('guildsails'), guildWareHeld('insigniaarmlet'), guildWareHeld('banker')], [true, false, false]);
  noteGuildShop(null, true);
  assert.equal(guildWareHeld('guildsails'), false);
  assert.equal(asked, 1, 'none read: nothing asked');
  noteGuildShop(null);
  assert.equal(guildWareHeld('guildsails'), null);
  _resetGuildStock();
});

test('GUILD-SHOP on the Fleet: her card says whether her sailcloth is to be had; a new cloth refused until the Guild Sailcloth is held, then painted; a cloth she flies kept through a repaint once it is not; the panel shut with why, then a pattern a button, a second paint and the arms; her picture wears it (mutants: the gate, the keep, the panel)', () => {
  _resetGuildStock();
  _resetFleetForTests();
  globalThis.document = undefined;
  const s = scene({ terrains: [terrain(10, 20)] });
  let uid = 7300;
  s.deps.items = { create: (t) => mintBoatItem(t, ++uid), addToPlayer() {}, player: () => [], titles: () => fleetBook(), retitle: (boat) => !!boat };
  s.deps.isPortTown = () => true;
  const host = createFleetHost({
    csa: () => s.rt, naval: () => null, pack: () => [], gold: () => 0, pay: () => {}, accounts: () => [], regionName: () => '',
    where: () => ({ inside: false, pixel: { X: 10, Y: 20 }, feet: [100, 34, 200] }), nearPort: () => true, nearestPort: () => null, terrainAt: () => s.terrains[0], changed() {},
  });
  titleDeed(mintDeed(2, 0, 51, 1000));
  s.rt.SummonBoat(51, titleOf(51), fleetBook(), [100, 34, 200], [0, 0, 1], s.terrains[0]);
  const card = () => host.model().ships.find((x) => x.uid === 51);
  assert.equal(card().cloth, null, 'unread');
  const cloth = { pattern: 'stripes', second: 4, arms: true };
  let r = host.act(51, 'livery', { sail: 3, cloth });
  assert.deepEqual([r.ok, r.text, fleetShip(51).livery], [false, SAILCLOTH_SHUT(), null]);
  noteGuildShop({ wares: [{ key: 'guildsails', payer: 'account', held: true }] });
  assert.equal(card().cloth, true);
  assert.equal(host.act(51, 'livery', { sail: 3, cloth }).ok, true);
  assert.deepEqual(fleetShip(51).livery.cloth, sailClothOf(cloth));
  noteGuildShop(null, true);
  assert.equal(host.act(51, 'livery', { sail: 5, cloth }).ok, true, 'the cloth she flies kept through a repaint');
  assert.equal(fleetShip(51).livery.sail, 5);
  assert.equal(host.act(51, 'livery', { sail: 5, cloth: { ...cloth, pattern: 'bands' } }).ok, false, 'another needs the ware');
  // the panel
  const el = (tag, cls, text) => {
    const n = { tag, children: [], attrs: {}, className: cls ?? '', _t: text == null ? '' : String(text), setAttribute(k, v) { n.attrs[k] = v; }, append(...c) { n.children.push(...c); } };
    Object.defineProperty(n, 'textContent', { get: () => n._t + n.children.map((c) => c.textContent ?? '').join('') });
    return n;
  };
  const button = (e, label, why, fn, cls) => { const b = e('button', cls, label); b.onclick = fn; b.why = why; return b; };
  const swatches = (e, word) => e('div', 'hld-pick', word);
  const chosen = [];
  assert.match(sailClothRows(el, null, (c) => chosen.push(c), { held: false, armed: true, swatches, button }).textContent, /Buy the Guild Sailcloth/);
  assert.match(sailClothRows(el, null, () => {}, { held: null, armed: true, swatches, button }).textContent, /Reading/);
  const open = sailClothRows(el, cloth, (c) => chosen.push(c), { held: true, armed: true, swatches, button });
  const buttons = [];
  const walk = (x) => { for (const c of x.children ?? []) { if (c.tag === 'button') buttons.push(c); walk(c); } };
  walk(open);
  assert.equal(buttons.length, SAIL_PATTERNS.length + 1, 'a button a pattern, and the arms');
  assert.match(open.textContent, /Second color/);
  buttons.find((b) => b.textContent === 'Bands').onclick();
  buttons.at(-1).onclick();
  assert.deepEqual(chosen, [{ pattern: 'bands', second: 4, arms: true }, { pattern: 'stripes', second: 4, arms: false }]);
  const shut = sailClothRows(el, { ...cloth, arms: false }, () => {}, { held: true, armed: false, swatches, button });
  assert.ok(shut.children.some((c) => c.tag === 'button' && c.why), 'the arms\' button says why where the guild has none');
  const down = sailClothRows(el, cloth, (c) => chosen.push(c), { held: true, armed: false, swatches, button });
  down.children.filter((c) => c.tag === 'button').at(-1).onclick();
  assert.equal(chosen.at(-1).arms, false, 'arms flown under a guild before are taken down without one (AUDIT GUILD-SHOP N5)');
  // her picture
  assert.equal(clothSvg(null, '#fff', null), '');
  assert.match(clothSvg(cloth, '#123456', ARMS.heraldry), /fill="#123456"[\s\S]*<svg/);
  assert.match(paintSvg(2, { sail: 3, cloth }, { heraldry: ARMS.heraldry }), /hld-cloth/);
  assert.doesNotMatch(paintSvg(2, { sail: 3 }), /hld-cloth/);
  _resetGuildStock();
  _resetFleetForTests();
});

test('AUDIT GUILD-SHOP S2 the Guild Sailcloth is the token\'s word: `sc` 1 or absent, held by its bit or an Admin\'s holding all; a peer\'s ship flies her sailcloth only on it, her paint whole either way (mutants: the claim unchecked; the cloth flown unclaimed; the paint dropped with it)', async () => {
  const { claimsValid } = await import('../../../src/net/identityToken.js');
  const { sailclothHeld } = await import('../../../server-account/src/titles.js');
  const { setPeerClothReader, peerHoldsCloth, _resetArmsBook } = await import('../../../src/net/guild/guildArmsBook.js');
  const base = { s: 'acct-a', n: 'Aldric', k: 'linked', i: 1000, e: 1100 };
  assert.equal(claimsValid({ ...base, sc: 1 }), true);
  assert.equal(claimsValid({ ...base, sc: 2 }), false);
  assert.equal(claimsValid(base), true);
  assert.equal(sailclothHeld({ handle: 'Aldric', guild_wares: 4 }, {}), 1, 'its bit');
  assert.equal(sailclothHeld({ handle: 'Aldric', guild_wares: 3 }, {}), undefined);
  assert.equal(sailclothHeld({ handle: 'Mac', guild_wares: 0 }, { DEVELOPER_HANDLES: 'Mac' }), 1, 'an Admin holds all');
  assert.equal(sailclothHeld({ guild_wares: 4 }, {}), undefined, 'a guest none');
  // a peer's boat
  const { flownLivery } = await import('../../../src/scenes/comeSailAway/comeSailAwayPeers.js');
  _resetArmsBook();
  const held = new Set(['p-buyer']);
  setPeerClothReader((id) => held.has(id));
  assert.deepEqual([peerHoldsCloth('p-buyer'), peerHoldsCloth('p-other')], [true, false]);
  const livery = { strake: 4, sail: 3, cloth: { pattern: 'cross', second: 7, arms: true } };
  assert.deepEqual([flownLivery('p-buyer', livery), flownLivery('p-other', livery)], [liveryCode(livery), liveryCode({ strake: 4, sail: 3 })], 'unclaimed: her paint whole, no cloth');
  _resetArmsBook();
});
