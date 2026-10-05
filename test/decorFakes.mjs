// DECOR1e: THE DECORATOR PINS' FAKES - ONE home (fakeRoom.mjs's lesson, AUDIT WORLD D10: copies had to grow in
// lockstep, and a fake that lies makes a pin pass that production would fail). A parsed block's room, the blocks file,
// a document and a window headless enough for the three surfaces (ui/decorPanel.js), a small catalogue, the panel on
// its own, and the tool (scenes/decorTool.js) over fakes of every seam the host hands it - its pool the room's own
// shape (scenes/decorRoom.js: a piece put again by its id stands in its place; list, remove, holdsAny), its wallet
// the purse's (pay, and credit for what comes back), its stick the host's.
import assert from 'node:assert/strict';
import { createDecorPanel } from '../src/ui/decorPanel.js';
import { createDecorTool } from '../src/scenes/decorTool.js';
import { decorCatalogue, collectDecor } from '../src/systems/decorCatalogue.js';
import { DECOR_CAP, decorPrice } from '../src/net/decorLaw.js';
import { PROP_MODEL_TYPE } from '../src/world/interiorLayout.js';
import { isFurnishing } from '../src/systems/decorFurnish.js';
import { decorMatrix, decorKeyOf } from '../src/scenes/decorRoom.js';
import { localAabb } from '../src/render/frustum.js';
import { createHomeYards } from '../src/scenes/homeYards.js';
import { applyClimate, SEASON } from '../src/world/climateSwaps.js';
import { getWorldClimateSettings } from '../src/formats/mapsFile.js';
import { billboardSize } from '../src/world/rmbFlats.js';

export const settle = () => new Promise((r) => setTimeout(r, 0));
export const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;


/** A parsed RMB block holding one room with `models` (ids) and `flats` ([a, r] pairs) - HOME-DOORS: and `doors`, its
 *  door records' model indices; NUDE-DECOR: and `people`, the room's people ([a, r] pairs, its blockPeopleRecords). */
export const rmb = (models = [], flats = [], doors = [], people = []) => ({
  rmbBlock: {
    subRecords: [{
      interior: {
        block3dObjectRecords: models.map((id) => ({ objectType: PROP_MODEL_TYPE, modelIdNum: id })),
        blockFlatObjectRecords: flats.map(([a, r]) => ({ textureArchive: a, textureRecord: r })),
        blockDoorRecords: doors.map((i) => ({ doorModelIndex: i })),
        blockPeopleRecords: people.map(([a, r]) => ({ textureArchive: a, textureRecord: r })),
      },
    }],
  },
});
export const TOWN = 1;
export const DUNGEON = 2;
export function fakeBlocks(list) {
  return {
    count: list.length,
    getBlockType: (i) => list[i].type,
    getBlock: (i) => { if (list[i].throws) throw new Error('bad block'); return list[i].block; },
  };
}

export function fakeNode(tag, doc) {
  const n = {
    tag, doc, children: [], attrs: {}, style: {}, dataset: {}, listeners: {}, className: '', textContent: '', id: '', disabled: false, value: '',
    append(...cs) { for (const c of cs) if (c) n.children.push(c); },
    replaceChildren(...cs) { n.children = []; n.append(...cs); },
    setAttribute(k, v) { n.attrs[k] = String(v); }, getAttribute(k) { return n.attrs[k] ?? null; }, removeAttribute(k) { delete n.attrs[k]; },
    addEventListener(t, fn) { (n.listeners[t] ??= []).push(fn); },
    fire(t, ev = {}) { for (const fn of n.listeners[t] ?? []) fn({ stopPropagation() {}, preventDefault() {}, ...ev }); },
    focus() {}, remove() { n.removed = true; },
  };
  return n;
}
export function fakeDoc() {
  const doc = {};
  doc.createElement = (t) => fakeNode(t, doc);
  doc.head = fakeNode('head', doc); doc.body = fakeNode('body', doc);
  doc.getElementById = (id) => doc.head.children.find((c) => c.id === id) ?? null;
  return doc;
}
export function fakeWin() {
  const on = {};
  return {
    on,
    addEventListener(t, fn) { (on[t] ??= []).push(fn); },
    removeEventListener(t, fn) { on[t] = (on[t] ?? []).filter((f) => f !== fn); },
    /** Dispatch an event to the window's listeners; answers what they did to it. */
    fire(t, ev = {}) {
      const seen = { prevented: false, stopped: false };
      const e = { type: t, preventDefault() { seen.prevented = true; }, stopImmediatePropagation() { seen.stopped = true; }, stopPropagation() {}, ...ev };
      for (const fn of [...(on[t] ?? [])]) fn(e);
      return seen;
    },
  };
}
export const all = (n, cls, out = []) => { if (String(n.className).split(/\s+/).includes(cls)) out.push(n); for (const c of n.children ?? []) all(c, cls, out); return out; };
export const one = (n, cls) => all(n, cls)[0];
export const text = (n) => (n.textContent || '') + (n.children ?? []).map(text).join('');
export const chipNamed = (root, label) => all(root, 'dfdecor-chip').find((c) => c.textContent === label);

/** A small catalogue: two beds (models - rrRealism.js BED_MODELS), a chest (storage), a candle (a light flat), a book (a flat). */
export function catalogue() {
  const collected = collectDecor([rmb([41000, 41000, 41001, 41811], [[210, 3], [209, 0]]), rmb([41000], [[209, 0]])]);
  return decorCatalogue(collected);
}

export function panelRig({ gold = 1000, count = 0, ready = true, entries = catalogue() } = {}) {
  const doc = fakeDoc();
  const win = fakeWin();
  const placed = [];
  let closed = 0;
  const pointed = [];
  const radius = new Map(entries.map((e, i) => [e.key, 0.3 + i * 0.4]));
  const view = (over = {}) => ({
    where: 'Your house', entries, progress: 1, ready, gold, count, cap: DECOR_CAP,
    radiusOf: (e) => radius.get(e.key) ?? null, priceOf: (e) => (radius.has(e.key) ? decorPrice(radius.get(e.key), 1) : null), ...over,
  });
  const panel = createDecorPanel({
    doc, win, onPlace: (e) => placed.push(e), onClose: () => { closed++; }, onPoint: (e) => pointed.push(e?.key ?? null),
    thumbOf: async (e) => `data:${e.key}`,
  });
  return { doc, win, panel, view, placed, pointed, closed: () => closed, entries, radius };
}
export const rows = (root) => all(root, 'dfdecor-row');

/** The default bindings the rig's `actionOf` reads (systems/inputActions.js DEFAULT_BINDINGS, the ones a flight meets). */
export const ACTIONS = new Map([['KeyW', 'MoveForwards'], ['KeyS', 'MoveBackwards'], ['KeyA', 'MoveLeft'], ['KeyD', 'MoveRight'], ['Space', 'Jump'],
  ['KeyC', 'Crouch'], ['ShiftLeft', 'Run'], ['ArrowLeft', 'TurnLeft'], ['ArrowRight', 'TurnRight'], ['PageUp', 'FloatUp'],
  ['PageDown', 'FloatDown'], ['KeyE', 'Interact'], ['Escape', 'Escape'], ['KeyI', 'Status'], ['Enter', 'ActivateCursor']]);
/**
 * The tool over fakes of every seam the host hands it. The pool is the room's own shape (scenes/decorRoom.js): a piece
 * put again by its id stands in its place, `holds` the ids of the pieces holding something. The wallet pays from and
 * credits `w.gold`, `hand.stick` is the host's stickAxes reading (null: no stick in hand), and `rays` each eye ray's
 * bucket filter. `radius(model)` the scan's measure of a model (null: unread). DECOR2a: `pack` the items carried -
 * packTake moves one of a stack out (a copy of one; the whole item when it is the last), packGive puts one back.
 * DECOR2b: `furnishings` the furniture delivered - where a piece of furniture lives, as the host's decorHome has it:
 * taken out whole, given back there, never to the pack. DECOR2c: `state.normal` the surface's normal the eye's ray
 * answers (null: none, as before), and the renderer's decal pass and texture cache, faked - `decals` every batch made
 * (its writes, its draws, whether it was destroyed), an icon upload answering the `#ui` variant. MW-MOUNT: `mwPicture`
 * the host's Morrowind picture of a mount's item (null: none, as before), uploaded through `uploadTexture`.
 * DECOR-SHELL: `collider` a real room collider (player/collider.js) in place of the fake that meets a surface 2 m off.
 * AUDIT DYE-ICON 1: `iconUrl(a, r, dye, dyeTarget)` the host's picture door for the panel's thumbnails (none, as before).
 * AUDIT DECOR-SHELL 3: `getGpuMesh` the pipeline's mesh door (one that loads every model, as before), and `now` the
 * tool's clock (0, as before). AUDIT2 DECOR-SHELL 8: with a real `collider`, a model piece put stands SOLID in it as the
 * room stands it (scenes/decorRoom.js put) - its model's box, closed, under the piece's own matrix, in its own bucket.
 * HOME-DOORS: `doors` the door records the scan's second block holds (model indices: door model 9000 + each), a door
 * model's box a door's own (a metre wide along x from its hinge, 2.1 high, 10 cm thick); `doorsHere` the host's doors,
 * `walls` its walls' filter - neither unless a pin hands one. HOME-RENT: `rent` the host's rooms door (none unless handed).
 * HOME-LOOK: `look` the painter's door; HOME-YARD: `placeOk`, `lot` and `yardCap` - the lot's law (each none unless handed).
 * SEAT-HALL: `charterClear` the host's two metres from the court (none unless handed).
 * NUDE-DECOR: `extraPeople` the second block's room's people ([a, r] pairs - Vendors in the catalogue), and the texture
 * door's records sized by `recordSize(archive, record)` ({ width, height }; 16 x 32 for every record, as before).
 * AUDIT 05b A3: `scan` - scan deps of the pin's own over the rig's (`mods`, `modelRadius`, `flatRadius`; none, as before).
 * AUDIT 05b A5: `prepareModel` the host's law over a model the tool draws (none unless handed). AUDIT 05b A6: `getTexture`
 * the pipeline's texture door over the rig's, and `flatPicture` the host's picture door for a flat (none unless handed).
 */
export function toolRig({ room = { kind: 'house', where: 'Your house' }, gold = 1000, homeDecor = null, locked = true, touch = false, radius = () => 0.8, base = null, mwPicture = null, collider = null, iconUrl = async () => null, getGpuMesh = async (id) => ({ gpu: id }), now = () => 0, extraFlats = [], extraPeople = [], recordSize = () => ({ width: 16, height: 32 }), realm = null, doors = [], doorsHere = null, walls = null, rent = null, look = null, placeOk = null, lot = null, yardCap = null, charterClear = null, scan = {}, prepareModel = null, getTexture = null, flatPicture = null } = {}) {
  const doc = fakeDoc();
  const win = fakeWin();
  const entries = decorCatalogue(collectDecor([rmb([41000, 41000, 41001, 41811], [[210, 3], [209, 0]]), rmb([41000], [[209, 0]], doors, extraPeople)]));
  const standing = [];
  const holds = new Set();
  const owned = new Map();   // DECOR2a: the owner's own items by piece id (scenes/decorRoom.js keepOwn and its kin)
  const solid = (p) => {
    if (!collider?.addMesh) return;
    collider.removeBucket?.(decorKeyOf(p.id));
    const cpu = p.model != null ? cpuModels.get(p.model) : null;
    if (!cpu) return;
    const [x0, y0, z0, x1, y1, z1] = localAabb(cpu.positions);
    const at = new Float32Array([x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1]);
    const tris = new Uint32Array([0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 3, 2, 6, 3, 6, 7, 0, 3, 7, 0, 7, 4, 1, 5, 6, 1, 6, 2]);
    collider.addMesh(decorKeyOf(p.id), at, tris, decorMatrix(p, [10, 0, 10]));
  };
  const pool = {
    put: (p) => { const i = standing.findIndex((x) => x.id === p.id); if (i >= 0) standing[i] = p; else standing.push(p); solid(p); },
    remove: (id) => { const i = standing.findIndex((x) => x.id === id); if (i >= 0) standing.splice(i, 1); collider?.removeBucket?.(decorKeyOf(id)); },
    list: () => standing.map((p) => ({ ...p })),
    size: () => standing.length,
    holdsAny: (id) => holds.has(id),
    ownOf: (id) => owned.get(id) ?? null,
    keepOwn: (id, item) => { if (item) owned.set(id, item); },
    takeOwn: (id) => { const it = owned.get(id) ?? null; owned.delete(id); return it; },
    ownIds: () => [...owned.keys()],
  };
  const names = new Map();
  const slots = [];
  const said = [];
  const w = { gold, paid: [], credited: [] };
  const hand = { stick: null };
  const pack = [];   // DECOR2a: the items carried - packTake moves one of a stack out, as a drop does
  const furnishings = [];   // DECOR2b: the furniture delivered (worldModes.js decorHome)
  const homeOf = (item) => (isFurnishing(item) ? furnishings : pack);
  const rays = [];   // each eye ray's bucket filter (player/collider.js raycastHit's fourth), or null
  let visit = 1;
  let cursorOff = 0;
  const cpuModels = new Map(entries.filter((e) => e.model != null).map((e) => [e.model, { positions: new Float32Array(e.kind === 'door' ? [0, 0, -0.05, 1, 2.1, 0.05] : [-0.5, -0.1, -0.5, 0.5, 0.9, 0.5]) }]));
  const draws = [];
  const textures = new Map();   // DECOR2c: the renderer's cache, by the icon upload's key
  const decals = [];            // DECOR2c: every decal batch made
  const renderer = {
    textures,
    createDecalBatch: (cap) => { const b = { cap, writes: [], draws: 0, destroyed: false }; decals.push(b); return b; },
    writeDecalSlot: (b, slot, floats) => { b.writes.push([slot, Array.from(floats)]); return true; },
    drawDecals: (b, tex) => { b.draws++; draws.push({ decal: b, tex }); },
    destroyDecalBatch: (b) => { b.destroyed = true; },
    uploadTexture: (a, r, c, o = {}) => { const k = `${a}_${r}${o.variant ?? ''}`; if (!textures.has(k)) textures.set(k, `tex:${k}`); return textures.get(k); },   // MW-MOUNT
    drawMesh: (gpu, m, remap) => draws.push({ gpu, m, remap }),
    createBillboardBatch: (a, r, size, centers) => ({ archive: a, record: r, size, centers, bounds: [0, 0, 0, 1] }),
    destroyBillboardBatch: (b) => { b.destroyed = true; },
    panelFrame: (opts, body) => { draws.push({ panel: opts }); body(); },
    setFog() {}, setLighting() {},
  };
  const state = { room, locked, normal: null };
  const tool = createDecorTool({
    doc, win, touch, renderer, pool, names,
    canvas: { width: 1600, height: 900, getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 450 }) },
    room: () => state.room,
    base: () => base,   // BASE-HIDE: the room's own furniture (scenes/decorBase.js), none unless a pin hands one
    scanDeps: () => ({
      blocks: fakeBlocks([{ type: TOWN, block: rmb([41000, 41000, 41001, 41811], [[210, 3], [209, 0]]) }, { type: TOWN, block: rmb([41000], [[209, 0], ...extraFlats], doors, extraPeople) }]),   // DECOR-MODFLATS: `extraFlats`, a pin's own; HOME-DOORS: `doors`; NUDE-DECOR: `extraPeople`
      isTownBlock: (t) => t === TOWN, modelRadius: radius, flatRadius: async () => 0.2,
      ...scan,   // AUDIT 05b A3: a pin's own scan deps (the mods joined, its own measures)
    }),
    getGpuMesh, cpuModels,
    getTexture: getTexture ?? (async (a) => ({ recordCount: 64, getSize: (r) => recordSize(a, r), getScale: () => ({ width: 0, height: 0 }) })),   // NUDE-DECOR: `recordSize`; AUDIT 05b A6: a pin's own
    uploadRecord: (a, r, opts = {}) => {   // DECOR2c: the icon arm answers its variant, as dataPipeline.js's does
      if (opts.mips !== false) return undefined;
      textures.set(`${a}_${r}#ui`, `tex:${a}.${r}`);
      return '#ui';
    },
    iconUrl,   // AUDIT DYE-ICON 1: the DOM's picture door - none to be had unless a pin hands one
    mwPicture,   // MW-MOUNT
    collider: () => collider ?? ({ raycastHit: (e, d, max, filter = null) => { rays.push(filter); return { dist: 2, normal: state.normal }; } }), origin: () => [10, 0, 10], eye: () => [10, 1.6, 10],
    stick: () => hand.stick,
    actionOf: (e) => ACTIONS.get(e.code) ?? null,
    locked: () => state.locked, cursorOff: () => { cursorOff++; },
    wallet: () => ({ gold: w.gold, pay: (n) => { w.paid.push(n); w.gold -= n; }, credit: (n) => { w.credited.push(n); w.gold += n; } }),
    homeDecor, character: () => 'char-me', visit: () => visit,
    realm: () => realm,   // REALM P2.2b: a realm character's act on its record (systems/realmSaves.js realmGoldAct), none unless a pin hands one
    pack: () => pack, identity: () => null, furnishings: () => furnishings, packHas: (item) => homeOf(item).includes(item),
    packTake: (item) => {
      const list = homeOf(item);
      const i = list.indexOf(item);
      if (i < 0) return null;
      if (list === pack && (item.stackCount ?? 1) > 1) { item.stackCount -= 1; return { ...item, stackCount: 1 }; }
      list.splice(i, 1);
      return item;
    },
    packGive: (item) => { homeOf(item).push(item); },
    openSlot: (o) => slots.push(['open', o]), closeSlot: (o) => slots.push(['close', o]),
    say: (l) => said.push(l), refusal: (word) => `refused: ${word}`, now,
    ...(doorsHere ? { doorsHere } : {}), ...(walls ? { walls } : {}),   // HOME-DOORS
    ...(rent ? { rent } : {}),   // HOME-RENT
    ...(look ? { look } : {}), ...(placeOk ? { placeOk } : {}), ...(lot ? { lot } : {}), ...(yardCap ? { yardCap } : {}),   // HOME-LOOK; HOME-YARD
    ...(charterClear ? { charterClear } : {}),   // SEAT-HALL: the court's two metres
    ...(prepareModel ? { prepareModel } : {}),   // AUDIT 05b A5
    ...(flatPicture ? { flatPicture } : {}),   // AUDIT 05b A6
  });
  const cam = { pos: [10, 1.6, 10], yaw: 0, pitch: 0 };
  const frame = (over = {}) => tool.frame({ dt: 0.1, cam, overlayUp: false, interior: true, ...over });
  return {
    tool, doc, win, entries, standing, holds, owned, hand, rays, pack, furnishings, names, slots, said, w, cam, frame, draws, state, decals, textures, renderer,
    setVisit: (v) => { visit = v; }, cursorOffs: () => cursorOff,
  };
}
/** Open the panel, let the scan finish, choose `key` and press Place. */
export async function placeFrom(rig, key) {
  rig.frame();
  assert.equal(rig.tool.openPanel(), true);
  for (let i = 0; i < 6; i++) { rig.frame({ overlayUp: true }); await settle(); }
  const root = rig.doc.body.children.find((c) => c.className === 'dfdecor');
  rows(root).find((r) => r.dataset.key === key).fire('click');
  all(root, 'dfdecor-btn').find((b) => b.textContent === 'Place').fire('click');
  rig.frame();
  await settle();
  rig.frame();
  return root;
}

// ─── THE YARD (DECOR-OUTDOOR, DECOR-LPT) ─────────────────────────────────────────────────────────────────────────────

export const DESERT = getWorldClimateSettings(224).climateType;
export const WOODS = getWorldClimateSettings(231).climateType;
/** An archive the town's climate swaps (applyClimate's own answer) - found, never assumed. */
export const SWAPPED = [...Array(500).keys()].find((a) => applyClimate(a, 0, DESERT, SEASON.Summer) !== a && applyClimate(a, 0, DESERT, SEASON.Summer) !== applyClimate(a, 0, WOODS, SEASON.Summer));
export const yardPiece = (over = {}) => ({ id: 'p1', model: null, flat: [504, 12], pos: [8, 0, 2], rot: [0, 0, 0], scale: 2, light: null, storage: false, paid: 120, ...over });

/** The real yard host over a town pixel built in `season`, its town of `climate`, a home (300) holding `pieces` - `own`
 *  the player's, who stands on its lot - with the panel's picture door `iconUrl`. DECOR-LPT: `trees` the world's Low Poly
 *  Trees (`{ door, sway }`, scenes/yardNature.js), `sizes` a record's picture over its archive's (`'504.20': [w, h]`);
 *  `shift` is where the pixel stands in the scene (written in place, then `yards.rebase()` - a recentre). AUDIT 05b A4:
 *  `town.pieces` the service's answer for the home (written in place - another writer's), `clock.t` the host's clock (ms:
 *  the town asked again past YARD_TOWN_TTL_MS). AUDIT 05b A5: every model a metre's box (the pipeline's cpu copy - the
 *  decorator's ghost reads its box), and `meshDraws` each model drawn with the table it was drawn with, as it stood then. */
export function yardWorld({ pieces, season = SEASON.Summer, climate = WOODS, seasonal = null, own = false, iconUrl = async () => null, trees = null, sizes: own_sizes = {} } = {}) {
  const made = [];
  const uploads = [];
  const animated = [];
  const doc = fakeDoc();
  const win = fakeWin();
  const shift = [0, 0, 0];
  const town = { pieces };
  const clock = { t: 0 };
  const meshDraws = [];
  const box = { positions: new Float32Array([-0.5, 0, -0.5, 0.5, 1, 0.5]) };
  const pixel = (s) => ({
    px: 0, py: 0, homeTown: 7, homeRegion: 17, season: s, townClimate: climate,
    homeFrames: new Map([[300, { at: [10, 0, 10], box: [6, 0, 7, 14, 6, 13] }]]),
    texRemap: new Map(), forest: { base: 504, archive: s === SEASON.Winter ? 505 : 504 },
    flatAnims: { add: (b, a, n) => animated.push([b, a, n]), remove() {} },
  });
  const built = new Map([['0,0', pixel(season)]]);
  const sizes = { 504: [40, 120], 505: [44, 130], 201: [30, 20], ...own_sizes };
  const yards = createHomeYards({
    api: { yards: async () => ({ ok: true, data: { yards: [{ buildingKey: 300, pieces: town.pieces }] } }) },
    homes: { homeAt: (m, k) => (k === 300 ? { owner: 'Tomas', own, look: null } : null) },
    built: () => built, translation: () => shift, feet: () => (own ? [18, 0, 10] : [100, 0, 100]), outside: () => true, eye: () => (own ? [18, 1.6, 10] : [100, 1.6, 100]),
    collider: () => ({ addMesh() {}, removeBucket() {} }),
    meshes: { getGpuMesh: async (id) => ({ id, subMeshes: [{ textureArchive: SWAPPED, textureRecord: 0 }] }), cpuModels: { get: () => box } },
    renderer: {
      drawMesh: (gpu, m, remap) => meshDraws.push({ gpu, remap: remap ? new Map(remap) : null }),
      createBillboardBatch: (a, r, size, centers, opts = {}) => { const b = { a, r, size, centers, scales: opts.scales ?? null }; made.push(b); return b; },
      destroyBillboardBatch: (b) => { b.gone = true; }, uploadTexture: (a, k) => uploads.push(`${a}_${k}`),
    },
    getTexture: async (a) => ({ recordCount: 32, getSize: (r) => { const [w, h] = sizes[`${a}.${r}`] ?? sizes[a] ?? [16, 32]; return { width: w, height: h }; }, getScale: () => ({ width: 0, height: 0 }), getFrameCount: (r) => (a === 201 ? 4 : 1) }),
    uploadRecord() {}, uploadRecordFrame() {}, iconUrl,
    seasonal: () => seasonal,
    trees,
    scanDeps: () => ({ blocks: fakeBlocks([{ type: TOWN, block: rmb([41000]) }]), isTownBlock: (x) => x === TOWN, nature: true, modelRadius: () => 0.8, flatRadius: async () => 0.2 }),
    character: () => 'r0123456789abcdef0123', realm: () => null, wallet: () => ({ gold: 5000, pay() {}, credit() {} }), regionOf: () => 17,
    doc, win, canvas: null, touch: false, actionOf: (e) => ACTIONS.get(e.code) ?? null, locked: () => true, cursorOff() {}, stick: () => null,
    say() {}, refusal: (w) => w, openSlot() {}, now: () => clock.t,
  });
  const cam = own ? { pos: [18, 1.6, 10], yaw: Math.PI, pitch: -0.6 } : { pos: [100, 1.6, 100], yaw: 0, pitch: 0 };
  const run = async (n = 3, overlayUp = false) => { for (let i = 0; i < n; i++) { yards.frame({ dt: 1, cam, overlayUp }); await settle(); await settle(); } };
  return { yards, built, made, uploads, animated, pixel, run, doc, win, shift, town, clock, meshDraws };
}
export const live = (made) => made.filter((b) => !b.gone);
export const sized = (w, h, k = 1) => { const s = billboardSize({ getSize: () => ({ width: w, height: h }), getScale: () => ({ width: 0, height: 0 }) }, 0); return { w: s.w * k, h: s.h * k }; };
