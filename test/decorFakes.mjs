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

export const settle = () => new Promise((r) => setTimeout(r, 0));
export const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;


/** A parsed RMB block holding one room with `models` (ids) and `flats` ([a, r] pairs). */
export const rmb = (models = [], flats = []) => ({
  rmbBlock: {
    subRecords: [{
      interior: {
        block3dObjectRecords: models.map((id) => ({ objectType: PROP_MODEL_TYPE, modelIdNum: id })),
        blockFlatObjectRecords: flats.map(([a, r]) => ({ textureArchive: a, textureRecord: r })),
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
 * taken out whole, given back there, never to the pack.
 */
export function toolRig({ room = { kind: 'house', where: 'Your house' }, gold = 1000, homeDecor = null, locked = true, touch = false, radius = () => 0.8 } = {}) {
  const doc = fakeDoc();
  const win = fakeWin();
  const entries = catalogue();
  const standing = [];
  const holds = new Set();
  const owned = new Map();   // DECOR2a: the owner's own items by piece id (scenes/decorRoom.js keepOwn and its kin)
  const pool = {
    put: (p) => { const i = standing.findIndex((x) => x.id === p.id); if (i >= 0) standing[i] = p; else standing.push(p); },
    remove: (id) => { const i = standing.findIndex((x) => x.id === id); if (i >= 0) standing.splice(i, 1); },
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
  const cpuModels = new Map(entries.filter((e) => e.model != null).map((e) => [e.model, { positions: new Float32Array([-0.5, -0.1, -0.5, 0.5, 0.9, 0.5]) }]));
  const draws = [];
  const renderer = {
    drawMesh: (gpu, m, remap) => draws.push({ gpu, m, remap }),
    createBillboardBatch: (a, r, size, centers) => ({ archive: a, record: r, size, centers, bounds: [0, 0, 0, 1] }),
    destroyBillboardBatch: (b) => { b.destroyed = true; },
    panelFrame: (opts, body) => { draws.push({ panel: opts }); body(); },
    setFog() {}, setLighting() {},
  };
  const state = { room, locked };
  const tool = createDecorTool({
    doc, win, touch, renderer, pool, names,
    canvas: { width: 1600, height: 900, getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 450 }) },
    room: () => state.room,
    scanDeps: () => ({
      blocks: fakeBlocks([{ type: TOWN, block: rmb([41000, 41000, 41001, 41811], [[210, 3], [209, 0]]) }, { type: TOWN, block: rmb([41000], [[209, 0]]) }]),
      isTownBlock: (t) => t === TOWN, modelRadius: radius, flatRadius: async () => 0.2,
    }),
    getGpuMesh: async (id) => ({ gpu: id }), cpuModels,
    getTexture: async () => ({ recordCount: 64, getSize: () => ({ width: 16, height: 32 }), getScale: () => ({ width: 0, height: 0 }) }),
    uploadRecord() {}, iconUrl: async () => null,
    collider: () => ({ raycastHit: (e, d, max, filter = null) => { rays.push(filter); return { dist: 2 }; } }), origin: () => [10, 0, 10], eye: () => [10, 1.6, 10],
    stick: () => hand.stick,
    actionOf: (e) => ACTIONS.get(e.code) ?? null,
    locked: () => state.locked, cursorOff: () => { cursorOff++; },
    wallet: () => ({ gold: w.gold, pay: (n) => { w.paid.push(n); w.gold -= n; }, credit: (n) => { w.credited.push(n); w.gold += n; } }),
    homeDecor, character: () => 'char-me', visit: () => visit,
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
    say: (l) => said.push(l), refusal: (word) => `refused: ${word}`, now: () => 0,
  });
  const cam = { pos: [10, 1.6, 10], yaw: 0, pitch: 0 };
  const frame = (over = {}) => tool.frame({ dt: 0.1, cam, overlayUp: false, interior: true, ...over });
  return {
    tool, doc, win, entries, standing, holds, owned, hand, rays, pack, furnishings, names, slots, said, w, cam, frame, draws, state,
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
