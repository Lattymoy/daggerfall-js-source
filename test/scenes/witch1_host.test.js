// WITCH1 (2026-10-20, the owner: "players with housing can place an object on the outside in which players can give
// candy"; bible/06-Systems/Witches-Festival.md): THE WITCHES' FESTIVAL IN THE STREETS (src/scenes/witchesHost.js) - the
// town underfoot asked for its offerings and each stood at its home's kept spot as the pixel's own batch and lantern, a
// target in the street's ray named with its rows, taken from, filled and taken in; set out by the item's Use at one's
// own door; taken down offline or for another account; asked only while the festival is live or one's own stands there;
// the festival said once - and the four hosts' wiring that reaches it.
import { test, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createWitchesHost, offeringKey, OFFERING_LIGHT_DROP, OFFERING_SET_REACH } from '../../src/scenes/witchesHost.js';
import { _resetFestivalClientForTests } from '../../src/systems/festival/festivalClient.js';
import { HEARTH_OFFERING_TEMPLATE, hearthOffering } from '../../src/systems/festival/soulCake.js';
import { itemUseHandler } from '../../src/systems/item/itemTemplates.js';
import { FESTIVAL_ARCHIVE, FESTIVAL_ART } from '../../src/world/festivalArt.js';
import { SESSION_KEY } from '../../src/net/accountClient.js';
import { FESTIVALS } from '../../src/net/festivalLaw.js';
import { playerEntity } from '../../src/characters/playerEntity.js';
import { characterIdOf } from '../../src/systems/characterId.js';
import { RAY_DISTANCE, DEFAULT_ACTIVATION_DISTANCE } from '../../src/player/activate.js';

const MAP = 1234, MINE = 77, THEIRS = 78;
const store = new Map();
const mem = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => { store.set(k, String(v)); }, removeItem: (k) => { store.delete(k); } };
const settle = async () => { for (let i = 0; i < 8; i++) await new Promise((r) => setImmediate(r)); };
const frame = (x) => ({ at: [x, 0, -5], box: [x - 5, 0, -10, x + 5, 6, 0], rects: [], type: 17, faction: 0, door: { a: [x - 0.6, 0, 0], b: [x + 0.6, 2.4, 0] } });

let H, world;
function standWorld({ town } = {}) {
  const asked = [];
  const answer = (name, r) => async (...a) => { asked.push([name, ...a]); return typeof r === 'function' ? r(...a) : r; };
  const offerings = town ?? [{ buildingKey: MINE, stock: 3, owner: 'Alice', mine: true, taken: false }, { buildingKey: THEIRS, stock: 5, owner: 'Bobby', mine: false, taken: false }];
  const api = {
    mine: answer('mine', { ok: true, data: { cakes: 2 } }), find: answer('find', { ok: true, data: { found: 0, cakes: 2 } }),
    buy: answer('buy', { ok: false, error: 'cakes' }), town: answer('town', { ok: true, data: { mapId: MAP, offerings } }),
    set: answer('set', { ok: true, data: { ok: true, stock: 0 } }), fill: answer('fill', { ok: true, data: { stock: 13, cakes: 0, moved: 10 } }),
    takeIn: answer('takeIn', { ok: true, data: { ok: true, returned: 3, cakes: 5 } }), take: answer('take', { ok: true, data: { ok: true, cakes: 3, stock: 4 } }),
  };
  const entry = {
    px: 5, py: 6, homeTown: MAP, homeFrames: new Map([[MINE, frame(0)], [THEIRS, frame(20)]]),
    witchHomes: new Map([[MINE, [1.15, 0.2, 0.55]], [THEIRS, [21.1, 0.2, 0.6]]]), witchFloor: 0.2, batches: [], lights: [], placeHold: null,
  };
  const built = new Map([['5,6', entry]]);
  const made = [], destroyed = [], said = [], notices = [], overlays = [];
  const online = { status: 'open', id: 'me', glyphs: [], lv: 1 };
  const deps = {
    built,
    renderer: { createBillboardBatch: (a, r, size, centers) => { const b = { a, r, size, centers }; made.push(b); return b; }, destroyBatch: (b) => destroyed.push(b) },
    pipeline: { getTexture: async () => ({ archive: FESTIVAL_ARCHIVE, recordCount: 9, getSize: () => ({ width: 40, height: 56 }), getScale: () => ({ width: 0, height: 0 }), getFrameCount: () => 1 }), uploadRecord: () => {} },
    onlineHomes: { homeAt: (m, bk) => (m === MAP && bk === MINE ? { own: true, hall: null } : null), known: () => true, ensure: () => {} },
    townTalk: { say: (l) => said.push(l), showOverlay: (w) => overlays.push(w) },
    state: { current: { x: 5, y: 6 }, pixelTranslation: (x, y, out = [0, 0, 0]) => { out[0] = 100; out[1] = 0; out[2] = 200; return out; } },
    player: { feetAt: () => [101, 0.2, 201], riding: false },
    saveSoon: { changed: () => {} }, chatNotice: (l) => notices.push(l), eventNotice: (kind, l) => { assert.equal(kind, 'festival'); notices.push(l); }, mode: () => 'exterior', api,
    get online() { return online; },
  };
  return { host: createWitchesHost(deps), entry, built, made, destroyed, said, notices, overlays, asked, online, deps };
}

beforeEach(() => {
  globalThis.localStorage = mem;
  store.clear();
  store.set(SESSION_KEY, JSON.stringify({ secret: 'sekrit', id: 'acct-alice', name: 'Alice', kind: 'linked' }));
  mock.timers.enable({ apis: ['Date'], now: FESTIVALS[0].fromMs + 3600_000 });
  _resetFestivalClientForTests();
  world = standWorld();
  H = world.host;
});
afterEach(() => { mock.timers.reset(); _resetFestivalClientForTests(); delete globalThis.localStorage; });

const standUp = async () => { H.frame(); await settle(); H.frame(); await settle(); };

test('WITCH1 THE OFFERINGS STAND: the town underfoot asked, each offering at its home\'s kept spot - the pixel\'s own batch and lantern', async () => {
  await standUp();
  assert.ok(world.asked.some(([n, m]) => n === 'town' && m === MAP), 'the town asked');
  assert.equal(world.made.length, 2);
  assert.ok(world.made.every((b) => b.a === FESTIVAL_ARCHIVE && b.r === FESTIVAL_ART.offering));
  const [mine, theirs] = world.made;
  assert.deepEqual(mine.centers, [[1.15, 0.2, 0.55]], 'the build\'s kept spot');
  assert.deepEqual(theirs.centers, [[21.1, 0.2, 0.6]]);
  assert.deepEqual(world.entry.batches, world.made, 'on the pixel\'s own list: its frame walk draws them, destroyPixel frees them');
  assert.equal(world.entry.lights.length, 2);
  assert.ok(Math.abs(world.entry.lights[0][1] - (0.2 + 56 * 0.025 - OFFERING_LIGHT_DROP)) < 1e-9, 'the tallow lantern under the picture\'s top');
  assert.equal(world.notices.length, 1, 'the festival said once');
  H.frame(); await settle();
  assert.equal(world.made.length, 2, 'a frame with nothing new stands nothing again');
  // the next ask, a minute on, says what the last said: the bowls stand on, never torn down and built again
  mock.timers.setTime(Date.now() + 61_000);
  await standUp();
  assert.equal(world.asked.filter(([n]) => n === 'town').length, 2);
  assert.deepEqual([world.made.length, world.destroyed.length], [2, 0]);
});

test('WITCH1 A DRESSED TOWN STANDS A BOWL AT ITS KEPT SPOT ALONE: a home the build kept none for stands none (where it found no room); an undressed pixel (built after the festival) stands its owner\'s beside the door (AUDIT WITCH1 D2)', async () => {
  world.entry.witchHomes.delete(THEIRS);
  await standUp();
  assert.deepEqual(world.made.map((b) => b.centers[0]), [[1.15, 0.2, 0.55]]);
  world = standWorld({ town: [{ buildingKey: MINE, stock: 3, owner: 'Alice', mine: true, taken: false }] });
  world.entry.witchHomes = null;
  H = world.host;
  await standUp();
  assert.equal(world.made.length, 1);
  assert.equal(world.made[0].centers[0][1], 0.2, 'beside its door, on the street');
});

test('WITCH1 THE RAY AND THE PLAQUE: each offering a target at a door\'s reach; another\'s takes a cake, the owner\'s fills and takes in', async () => {
  await standUp();
  const targets = H.targets();
  assert.deepEqual(targets.map((t) => t.key), [offeringKey(MAP, MINE), offeringKey(MAP, THEIRS)]);
  assert.equal(targets[0].distance, RAY_DISTANCE);
  assert.equal(targets[0].reach, DEFAULT_ACTIVATION_DISTANCE);
  assert.equal(targets[0].aabb.min[0], 1.15 - 0.5 + 100, 'in the scene: the pixel\'s translation added - the ray\'s { min, max } (FB1020e OFFERING-RAY: the pick\'s own run is test/scenes/fb1020e_offeringray.test.js)');
  const own = H.hoverName(offeringKey(MAP, MINE));
  assert.equal(own.title, "Alice's Hearth Offering", 'named whole, so a language orders it as it reads');
  assert.deepEqual(own.actions.map((a) => a.id), ['fill', 'takeIn']);
  const theirs = H.hoverName(offeringKey(MAP, THEIRS));
  assert.deepEqual([theirs.title, theirs.subs], ["Bobby's Hearth Offering", ['5 Soul Cakes']]);
  assert.deepEqual(theirs.actions, [{ id: 'take', label: 'Take a Soul Cake', disabled: false }]);
  assert.equal(H.hoverName('witch:1:2'), null);
  assert.equal(H.hoverName('port:1'), null);
  // presses: another's take, the owner's fill and take in, steal refused, two presses queued and both asked
  H.activate(offeringKey(MAP, THEIRS), 'grab', 'take');
  H.activate(offeringKey(MAP, THEIRS), 'grab', 'take');
  H.activate(offeringKey(MAP, MINE), 'grab', null);
  H.activate(offeringKey(MAP, MINE), 'grab', 'takeIn');
  assert.equal(H.activate(offeringKey(MAP, THEIRS), 'steal', null), true);
  assert.equal(H.activate(offeringKey(MAP, THEIRS), 'info', null), true);
  await settle();
  const moves = world.asked.filter(([n]) => ['take', 'fill', 'takeIn'].includes(n));
  assert.deepEqual(moves.map(([n]) => n), ['take', 'take', 'fill', 'takeIn'], 'ASYNC NEVER DROPS: each press asked, in order');
  assert.deepEqual(moves[0][1], { mapId: MAP, buildingKey: THEIRS });
  assert.equal(moves[2][1].character, characterIdOf(playerEntity), 'the owner\'s moves name the character');
  assert.equal('character' in moves[0][1], false, 'a take names none');
  assert.ok(world.said.includes('+1 Soul Cake'));
  assert.ok(world.said.includes('The bowl holds 13 Soul Cakes.'));
  assert.ok(world.said.includes('The Wyrd watch over offerings.'));
  assert.ok(world.said.some((l) => l.includes("Bobby's Hearth Offering")), 'Info names it whole');
});

test('WITCH1 a cake taken today, an empty bowl, an account\'s other character\'s: each row says why', async () => {
  world = standWorld({ town: [{ buildingKey: THEIRS, stock: 5, owner: 'Bobby', mine: false, taken: true }, { buildingKey: MINE + 100, stock: 0, owner: 'Cara', mine: false, taken: false }] });
  world.entry.homeFrames.set(MINE + 100, frame(40));
  world.entry.witchHomes.set(MINE + 100, [41.1, 0.2, 0.6]);
  H = world.host;
  await standUp();
  assert.deepEqual(H.hoverName(offeringKey(MAP, THEIRS)).actions, [{ id: 'take', label: 'You already took a cake here today.', disabled: true }]);
  assert.deepEqual(H.hoverName(offeringKey(MAP, MINE + 100)).actions, [{ id: 'take', label: 'The bowl is empty.', disabled: true }]);
});

test('WITCH1 OFFLINE THE OFFERINGS GO - EVERY PIXEL\'S: their batches freed and their lanterns out, the player standing in the next pixel or not; another account signed in, the same; a pixel streamed out is forgotten (AUDIT WITCH1 D5)', async () => {
  await standUp();
  world.deps.state.current = { x: 9, y: 9 };   // stepped out of town, the town still built
  world.online.status = 'closed';
  H.frame();
  assert.deepEqual(world.destroyed, world.made);
  assert.deepEqual(world.entry.batches, []);
  assert.deepEqual(world.entry.lights, []);
  assert.deepEqual(H.targets(), []);
  world.online.status = 'open';
  world.deps.state.current = { x: 5, y: 6 };
  await standUp();
  const before = world.destroyed.length;
  store.set(SESSION_KEY, JSON.stringify({ secret: 'other', id: 'acct-bob', name: 'Bob', kind: 'linked' }));
  H.frame();
  assert.equal(world.destroyed.length, before + 2, 'another account: what the last one was shown goes');
  await standUp();
  world.built.delete('5,6');
  H.frame();
  assert.deepEqual(H.targets(), [], 'its batches went with it');
});

test('WITCH1 THE TOWN IS ASKED WHILE IT MATTERS: the festival live here, or one of the account\'s own standing in it - never a guest, never all year (AUDIT WITCH1 A5)', async () => {
  store.set(SESSION_KEY, JSON.stringify({ secret: 'g', id: 'acct-guest', name: 'Guest', kind: 'guest' }));
  await standUp();
  assert.equal(world.asked.filter(([n]) => n === 'town').length, 0, 'a guest asks nothing');
  store.set(SESSION_KEY, JSON.stringify({ secret: 'sekrit', id: 'acct-alice', name: 'Alice', kind: 'linked' }));
  mock.timers.setTime(FESTIVALS[0].toMs + 3600_000);
  await standUp();
  assert.equal(world.asked.filter(([n]) => n === 'town').length, 0, 'after the festival, no offering of mine here: nothing');
  world.deps.api.mine = async () => ({ ok: true, data: { cakes: 0, offerings: [{ mapId: MAP, buildingKey: MINE, character: 'c', stock: 3 }] } });
  world = { ...world };
  _resetFestivalClientForTests();
  world = standWorld();
  world.deps.api.mine = async () => ({ ok: true, data: { cakes: 0, offerings: [{ mapId: MAP, buildingKey: MINE, character: 'c', stock: 3 }] } });
  H = world.host;
  await standUp();
  assert.ok(world.asked.some(([n]) => n === 'town'), 'my own still stands here: asked, to take it in');
});

test('WITCH1 SETTING ONE OUT: the Hearth Offering\'s Use at the door of a home the playing character owns, on foot, within reach', async () => {
  const use = itemUseHandler(HEARTH_OFFERING_TEMPLATE);
  playerEntity.items = [hearthOffering()];
  // at my own home's door: under way, the window closed
  assert.deepEqual(use(playerEntity.items[0]), { kind: 'text', text: '', closesWindow: true });
  await settle();
  const set = world.asked.find(([n]) => n === 'set');
  assert.deepEqual([set[1].mapId, set[1].buildingKey], [MAP, MINE]);
  assert.ok(world.said.some((l) => l.startsWith('You set out your Hearth Offering.')));
  // too far from it, or riding: not here
  world.deps.player.feetAt = () => [100 + OFFERING_SET_REACH + 5, 0, 200];
  assert.equal(use(hearthOffering()).text, 'Set it out at your own home.');
  world.deps.player.feetAt = () => [101, 0.2, 201];
  world.deps.player.riding = true;
  assert.equal(use(hearthOffering()).text, 'Set it out at your own home.');
  world.deps.player.riding = false;
  // a door the build kept no spot by: no room there, said so
  world.entry.witchHomes.delete(MINE);
  assert.equal(use(hearthOffering()).text, 'There is no room for it by this door.');
  // a guest is told to link an account
  store.set(SESSION_KEY, JSON.stringify({ secret: 'g', id: 'acct-guest', name: 'Guest', kind: 'guest' }));
  assert.equal(use(hearthOffering()).text, 'Link an account to keep Soul Cakes.');
  playerEntity.items = [];
});

test('AUDIT STAR8 T1 A WYRD SISTER MET: her window opened is the act `wyrd-met`, once a press - Morwen\'s letter waits on it (QLTF01) - and a page with no window to open says nothing (mutants: the act unsaid; said with no window)', async () => {
  const { setActSink } = await import('../../src/systems/questlines/qlActs.js');
  const { withDom } = await import('../invdrag.mjs');
  const heard = [];
  setActSink((kind, n) => { heard.push([kind, n]); return 1; });
  try {
    assert.equal(H.shop(), false, 'no document: no window, and she talks instead');
    assert.deepEqual(heard, []);
    withDom(() => {
      assert.equal(H.shop(), true);
      assert.equal(world.overlays.length, 1, 'her window, in the host\'s slot');
      world.overlays[0].dispose();
    });
    assert.deepEqual(heard, [['wyrd-met', 1]]);
  } finally { setActSink(null); }
});

test('WITCH1 THE FOUR HOSTS: world.js makes the host and reads its frame, names and presses; worldModes presses a Wyrd Sister and an offering', () => {
  const world = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');
  const modes = readFileSync(new URL('../../src/scenes/worldModes.js', import.meta.url), 'utf8');
  const ext = readFileSync(new URL('../../src/scenes/exterior.js', import.meta.url), 'utf8');
  assert.match(world, /witches = createWitchesHost\(\{ built, renderer, pipeline, onlineHomes, townTalk, state, player, saveSoon, chatNotice, mode: _mode, get online\(\) \{ return online; \} \}\);/);
  assert.ok(world.indexOf('witches = createWitchesHost(') < world.indexOf('var modes = createWorldModes({'), 'made before the modes host reads it');
  assert.match(world, /\n {4}witches,   \/\/ WITCH1/);
  assert.match(world, /\(key\) => witches\?\.hoverName\(key\) \?\? null,/);
  assert.match(world, /\n {4}witches\?\.frame\(\);/);
  assert.match(world, /else if \(name === 'harvest'\) audio\.playOneShotId\(SPELL_CAST_SOUND\[2\], 1\);/);
  assert.match(modes, /if \(!info && pn\?\.witch && host\.witches\?\.shop\(\)\) return;/);
  assert.match(modes, /for \(const t of host\.witches\?\.targets\(\) \?\? \[\]\) targets\.push\(t\);/);
  assert.match(modes, /key\.startsWith\('witch:'\)\) \{[^\n]*\n\s+if \(_hitDist > _hitReach\) \{ setMidScreenText\(tooFarAwayText\(\)\); return true; \}\n\s+return host\.witches\?\.activate\(key, getInteractionMode\(\), plaqueActionFor\(key\)\) \?\? true;/);
  assert.match(modes, /\?\? \(pn\?\.witch \? vendorOffice\(\) : null\);/);
  assert.doesNotMatch(ext, /createWitchesHost|witchesDressing/, 'the bench stands no festival');
});
