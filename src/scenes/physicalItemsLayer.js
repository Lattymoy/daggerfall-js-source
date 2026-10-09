// @ts-check
// PI1 (2026-10-07): PHYSICAL ITEMS IN THE SCENE - demifiend000's mod (vendor/physical-items; its law is
// systems/physicalItems.js, its record bible/06-Systems/Physical-Items.md) as one layer every host's ground-pile pool
// builds for itself (scenes/droppedLoot.js createDroppedLoot - THE ONE CONSTRUCTION SEAM: four hosts, one constructor),
// so its pictures, its ray targets, its plaque, its lines and its recentre ride the doors each host already calls on
// that pool.
//
// TWO KINDS OF BACKING, as the mod's PhysicalBackingKind:
// - A BODY'S ITEM (CorpseProxy): every item in a dead foe's list that its category shows stands round the body as itself.
//   The body KEEPS the item - the proxy is its picture - so the body's own window, quick loot and the online room's
//   record are untouched: a proxy whose item has left the list (the window took it) goes, and taking the proxy takes
//   the item out of the list through the pack's one-item door. Thrown out at the fall (systems/physicalItems.js
//   diedRecently), laid down gently for a body met later.
// - AN ITEM OF ITS OWN (Independent): the shift-drop's one-item pile (droppedLoot.js dropPhysical), which the pool keeps
//   and saves as it keeps every pile, wearing its item's picture where the pile's bag would stand.
//
// THE PICTURE, two ways (Mac: "This should work for both morrowind and the sprite system"): the item's Morrowind picture
// while a Morrowind build stands (combat/fpArm.js mountPicture - the ground mesh face-on, the decor room's own door), else
// the pack's own picture (ui/itemIconColor32.js - the classic art, a replacement, the item's dye). A build that lands or
// goes (fpArm.js mountPictureStamp) has every item ask again. Either is cut to its visible texels and stood at the mod's
// size (BuildVisual [IL_0982]).
//
// THE RARITY DRESS (Mac: "the rarity treatment (like we do for the world boss)"): the world boss's loot line out of the
// top of a Rare-or-better picture (`finds` - scenes/lootLines.js, which leaves a presented item out of its body's own
// line) and the port's own tier rim on a Magic-or-better one (systems/physicalItems.js rarityRim), both read every frame
// so the rarity row's switch reaches what already lies.
//
// AUDIT PI1 (2026-10-07, Mac: "Lets do a conprehensive audit and ensure this is perfection"): five readers, each one
// dimension (the IL, the hosts, this layer, the draw, the pins and the records); bible/01-Overview/Audit-PI1.md is the
// record, and every `AUDIT PI1 <id>` below names the finding it closes.
//
// Not a DFU member. Ledger A (PI).
import {
  PHYSICAL_ITEMS_VENDOR, readPhysicalItemsSettings, showsOnCorpse, worldHeight, visibleBox, cropTo, artworkSize, colliderDepth,
  scatterOffset, proxyLaunch, makeBody, settleBody, flyBody, shoulder, rarityRim, presentItem, diedRecently, markDeath,
  spiralDrop, PI_SPIRAL, PI_SCATTER, hasVisible, bleedEdges, constrainMove, itemLook, dropRadius, nearestFloor, PI_FLOOR_PROBE,
  PI_PATH, PI_REACH,
} from '../systems/physicalItems.js';
import { modSetting, modSettingsGeneration } from '../systems/modSettings.js';
import { registerEnemyDeathHandler } from './corpseMarker.js';
import { setBatchGlint } from '../systems/hitFlash.js';
import { lootCrown } from './lootLines.js';
import { RAY_DISTANCE } from '../player/activate.js';
import { itemIconColor32, itemIconKey } from '../ui/itemIconColor32.js';
import { inventoryItemImage } from '../systems/itemTemplates.js';
import { toColor32 } from '../formats/color32Order.js';
import { takeOneItem, quickLootSpend, tookItemText, QUICK_LOOT_REFUSED } from '../systems/quickLoot.js';
import { isMap, USE_TEXT } from '../systems/useItem.js';
import { isSummoned, takeOneInto } from '../systems/inventory.js';
import { racialSuppressInventory } from '../systems/lycanthropy.js';
import { silverFindAt } from '../systems/silverFinds.js';
import { CANNOT_REMOVE_ITEM_TEXT } from '../systems/createItem.js';

/** The pseudo-archive the pictures go up under: past the Hour's 38151 (the large boat's is 38171). */
export const PI_ICON_ARCHIVE = 38161;
/** A proxy's key on the ray - the pool's own vocabulary, so every host's ladder (the reach, the name, the plaque) reads it
 *  as the one-item pile it is. */
export const PI_KEY_PREFIX = 'droppedLoot:pi';
/** The press box's least half-width and height - the port's own (a dagger lying flat is still a thing to aim at; the
 *  mod's hitbox is the picture's own box, recorded on the page). */
export const PI_BOX_MIN_HALF = 0.2;
export const PI_BOX_MIN_H = 0.25;
/** AUDIT PI1 R2: the Morrowind picture's size, texels on its longer side - the classic icons' density, so the tier rim
 *  (two texels of the silhouette) reads as a rim, not a pixel's hair on a 256-texel render. */
export const PI_MW_PX = 64;
/** AUDIT PI1 L7/R9: a picture that did not come is asked again after 5 s, 10 s, 20 s - then never, until a build moves. */
export const PI_RETRY_MS = 5000;
export const PI_RETRY_MAX = 3;

// HandleEnemyDeath [IL_4790]: OnEnemyDeath, once for every layer - the death is noted, and the layer that meets the body
// throws its items out of it
registerEnemyDeathHandler('physical-items', (entity) => markDeath(entity));

/** The Morrowind picture door, loaded on first ask (fpArm.js is the hosts' own import; a lazy one keeps this layer's
 *  importers - the pool, the pins - off its module graph). Its stamp answers null until the module is in. */
let _fpArm = null, _fpArmLoading = null;
const fpArmOnce = () => (_fpArmLoading ??= import('../combat/fpArm.js').then((m) => { _fpArm = m.fpArm; return _fpArm; }).catch(() => null));
const defaultMw = {
  stamp: () => { if (!_fpArm) { fpArmOnce(); return null; } return _fpArm.mountPictureStamp(); },
  picture: (item) => fpArmOnce().then((a) => a?.mountPicture(item, { px: PI_MW_PX }) ?? null),
};

/**
 * AUDIT PI1 R1/H1/L1: THE PICTURES ARE THE RENDERER'S, COUNTED ONCE. Every pool's layer uploads under the one archive,
 * and the renderer's texture cache is one map, so a layer that freed what IT had asked for freed the street's and the
 * room's pictures with it (a dungeon's teardown left every Longsword in town invisible but pressable). A picture is held
 * by the proxies that stand in it, counted per renderer across every layer; it is uploaded when the cache lacks it and
 * freed when the last proxy lets go.
 */
const _held = new WeakMap();
function holdTexture(renderer, record, pic) {
  if (!renderer) return;
  let m = _held.get(renderer);
  if (!m) _held.set(renderer, (m = new Map()));
  const n = (m.get(record) ?? 0) + 1;
  m.set(record, n);
  const cached = renderer.textures?.has?.(`${PI_ICON_ARCHIVE}_${record}`);
  if (cached === false || (cached === undefined && n === 1)) renderer.uploadTexture?.(PI_ICON_ARCHIVE, record, { width: pic.vw, height: pic.vh, colors: pic.colors });
}
function letTexture(renderer, record) {
  const m = renderer ? _held.get(renderer) : null;
  if (!m || !m.has(record)) return;
  const n = /** @type {number} */ (m.get(record)) - 1;
  if (n > 0) { m.set(record, n); return; }
  m.delete(record);
  renderer.releaseTexture?.(PI_ICON_ARCHIVE, record);
}
/** For the pins: how many proxies hold a record on a renderer. */
export const heldTextureCount = (renderer, record) => _held.get(renderer)?.get(record) ?? 0;

/**
 * deps: `renderer`; `enabled()` the mod's switch (default its Enabled key); `settings()` its settings (default read
 * through modSettings, again when they change); `iconOf(item, identity)` the pack's picture (color32) and `mw`
 * `{ stamp(), picture(item) }` the Morrowind one - both injectable for the pins; `rolls` the scatter's dice; `now()`.
 * @param {{ renderer?: any, enabled?: () => any, settings?: (() => any)|null, iconOf?: (item: any, identity: any) => any,
 *   mw?: { stamp: () => any, picture: (item: any) => any }, rolls?: () => number, now?: () => number }} [deps]
 */
export function createPhysicalItems({
  renderer, enabled = () => modSetting(PHYSICAL_ITEMS_VENDOR, 'Enabled'), settings = null,
  iconOf = (item, identity) => itemIconColor32(item, { identity }), mw = defaultMw, rolls = Math.random, now = () => Date.now(),
} = {}) {
  /** The host's half (attach): its collider, its bodies, the wearer the pack draws for, the take's own hooks, whether its
   *  game is paused. */
  /** @type {any} */
  let host = { collider: () => null, corpses: () => [], identity: () => undefined, getQuest: null, took: null, say: () => {}, revealMap: null, taken: null, emptied: null, paused: () => false };
  let _settings = null, _gen = -1, _dressedGen = null;
  const settingsNow = () => {
    if (settings) return settings();
    const g = modSettingsGeneration();
    if (!_settings || g !== _gen) { _gen = g; _settings = readPhysicalItemsSettings(); }
    return _settings;
  };
  const on = () => { try { return !!enabled(); } catch { return false; } };
  const colliderNow = () => { try { return host.collider?.() ?? null; } catch { return null; } };

  let _nextId = 0;
  /** Every proxy: its id, its item, its backing ('corpse' - the body's `group` - or 'pile'), its body, its picture and batch. */
  const proxies = new Map();
  /** The bodies being presented, by entity: `{ entity, pos, key, silver, silvered, proxies: Map(item -> proxy) }`. */
  const groups = new Map();
  /** The shift-drop piles being presented, by pile: proxy. */
  const pileProxies = new Map();
  /** The pictures this layer has cut, by their source's key: `{ record, vw, vh, colors }` (AUDIT PI1 L12: cut once). */
  const pictures = new Map();
  let _stamp = null;

  // ---- the picture -------------------------------------------------------------------------------------------------
  /** A color32 picture cut to its visible texels, its edge bled (AUDIT PI1 R3): `{ record, vw, vh, colors }`, or null
   *  for a picture with nothing in it (AUDIT PI1 R7). */
  function standPicture(key, width, height, colors) {
    const had = pictures.get(key);
    if (had) return had;
    if (!hasVisible(colors)) return null;
    const box = visibleBox(colors, width, height);
    const cut = bleedEdges(cropTo(colors, width, box), box.w, box.h);
    const pic = { record: `${key}@${box.x},${box.y},${box.w},${box.h}`, vw: box.w, vh: box.h, colors: cut };
    pictures.set(key, pic);
    return pic;
  }
  /** The pack's picture's key before its picture (AUDIT PI1 R11: an item whose picture is cut already asks nothing). */
  function classicKey(item) {
    try { const img = inventoryItemImage(item, host.identity?.()); return img ? `c:${itemIconKey(img)}` : null; } catch { return null; }
  }
  function askPicture(p) {
    p.asking = true;
    p.retryAt = 0;
    const ask = p.ask = {};
    const stamp = _stamp;
    const classic = () => {
      const k = classicKey(p.item);
      if (k && pictures.has(k)) return Promise.resolve(pictures.get(k));
      return Promise.resolve().then(() => iconOf(p.item, host.identity?.())).then((img) => (img?.colors && img.width > 0 && img.height > 0 ? standPicture(`c:${img.key}`, img.width, img.height, img.colors) : null));
    };
    const morrowind = () => (stamp == null ? Promise.resolve(null) : Promise.resolve().then(() => mw.picture(p.item)).then((pic) => {
      if (!pic?.image?.width || !pic.key) return null;
      const had = pictures.get(`m:${pic.key}`);
      if (had) return had;
      const c = toColor32(pic.image);
      return standPicture(`m:${pic.key}`, c.width, c.height, c.colors);
    }));
    let mwMissed = false;
    morrowind().catch(() => null).then((got) => { mwMissed = stamp != null && !got; return got ?? classic(); }).catch(() => null).then((got) => {
      if (p.ask !== ask || p.dead) return;   // asked again (a build landed), or gone (retired - a clear, a teardown)
      p.asking = false;
      if (got) {
        p.tries = mwMissed ? p.tries : 0;
        if (got !== p.pic) { p.pic = got; dress(p); }
        // AUDIT PI1 R9: a Morrowind picture that would not come while a build stands is asked again (the classic one
        // stands meanwhile) - a lazy archive's first miss is not the item's for good
        if (mwMissed && p.tries < PI_RETRY_MAX) p.retryAt = now() + PI_RETRY_MS * 2 ** p.tries++;
      } else if (p.batch) {
        // AUDIT PI1 R6/L9: asked again and nothing came - the picture it stands in stays, and is asked for later
        if (p.tries < PI_RETRY_MAX) p.retryAt = now() + PI_RETRY_MS * 2 ** p.tries++;
      } else {
        // AUDIT PI1 R5/L7: no picture at all - the item is not presented (its body's line and its pile's bag stand for
        // it) and is asked for again
        p.pic = 'none';
        presentItem(p.item, false);
        if (p.tries < PI_RETRY_MAX) p.retryAt = now() + PI_RETRY_MS * 2 ** p.tries++;
      }
    }, () => { if (p.ask === ask) { p.asking = false; if (!p.batch) p.pic = 'none'; } });
  }
  /** The proxy's size, box and batch off its picture (BuildVisual [IL_09b8]; the box's depth GetColliderDepth [IL_1a21]);
   *  the item presented from here on. */
  function dress(p) {
    const pic = p.pic;
    if (!pic || typeof pic !== 'object' || p.dead) return;
    const size = artworkSize(pic.vw, pic.vh, worldHeight(p.item, settingsNow()));
    p.size = size;
    p.body.half = [size.w / 2, colliderDepth(size.w, size.h) / 2];
    p.body.h = size.h;
    if (p.held !== pic.record) {
      holdTexture(renderer, pic.record, pic);
      if (p.held) letTexture(renderer, p.held);
      p.held = pic.record;
    }
    if (p.batch) renderer?.destroyBillboardBatch?.(p.batch);
    p.batch = null;
    try {
      p.batch = renderer?.createBillboardBatch?.(PI_ICON_ARCHIVE, pic.record, size, [[0, 0, 0]]) ?? null;
    } catch { p.batch = null; }
    if (!p.batch) return;
    p.batch.noShadow = true;   // F2: a thing lying on the ground is no standing card for the sun
    p.batch.origin = [...p.body.pos];
    setBatchGlint(p.batch, rarityRim(p.item));
    presentItem(p.item, true);
  }

  // ---- the proxies -------------------------------------------------------------------------------------------------
  function mint(item, pos, vel, backing) {
    const H = worldHeight(item, settingsNow());
    const p = { id: ++_nextId, item, backing, body: makeBody(pos, vel, [H / 2, H / 2], H), pic: null, ask: null, asking: false, batch: null, size: null, held: null, dead: false, floorY: pos[1], tries: 0, retryAt: 0 };
    proxies.set(p.id, p);
    askPicture(p);
    return p;
  }
  function retire(p) {
    if (p.dead) return;
    p.dead = true;
    presentItem(p.item, false);
    if (p.batch) renderer?.destroyBillboardBatch?.(p.batch);
    p.batch = null;
    if (p.held) letTexture(renderer, p.held);
    p.held = null;
    proxies.delete(p.id);
  }

  /** The collider's ray with its face (`{ dist, normal }`), for ConstrainItemMovement - or null with no collider. */
  function rayHitOf() {
    const col = colliderNow();
    if (!col?.raycast) return null;
    return (from, dir, len) => {
      if (col.raycastHit) { const h = col.raycastHit(from, dir, len); return Number.isFinite(h?.dist) ? { dist: h.dist, normal: h.normal ?? undefined } : null; }
      const d = col.raycast(from, dir, len);
      return Number.isFinite(d) ? { dist: d } : null;
    };
  }
  /**
   * ReconcileCorpseGroup [IL_4af8] over the host's bodies: each body's shown items have a proxy, and only they do. A new
   * body met at its fall throws its items out (CreateCorpseProxy [IL_4f2e], fresh); met later, they are laid round it.
   * Each starts 0.65 m over the body and is moved out to its scatter point against the walls (AUDIT PI1 I1 -
   * ConstrainItemMovement). A list replaced with look-alikes hands each standing picture on (AUDIT PI1 L4); a body that
   * moves carries its items (AUDIT PI1 H5/L11 - a deck's dead).
   */
  function reconcileBodies() {
    const s = settingsNow();
    const seen = new Set();
    let list;
    try { list = host.corpses?.() ?? []; } catch { return; }   // AUDIT PI1 L15: a feed that threw is not "no bodies"
    const rayHit = rayHitOf();
    for (const c of list) {
      const entity = c?.entity;
      if (!entity || !Array.isArray(c.pos)) continue;
      seen.add(entity);
      let g = groups.get(entity);
      const fresh = !g && diedRecently(entity, now());
      if (!g) { g = { entity, pos: [...c.pos], key: c.key ?? null, silver: c.silver ?? c.entry ?? null, silvered: false, proxies: new Map() }; groups.set(entity, g); }
      const dx = c.pos[0] - g.pos[0], dy = c.pos[1] - g.pos[1], dz = c.pos[2] - g.pos[2];
      if (dx || dy || dz) {
        for (const p of g.proxies.values()) { p.body.pos[0] += dx; p.body.pos[1] += dy; p.body.pos[2] += dz; p.floorY += dy; }
        g.pos[0] = c.pos[0]; g.pos[1] = c.pos[1]; g.pos[2] = c.pos[2];
      }
      if (c.key != null) g.key = c.key;
      const items = Array.isArray(entity.items) ? entity.items : [];
      const want = items.filter((it) => showsOnCorpse(it, s));
      const wanted = new Set(want);
      const orphans = [];
      for (const [it, p] of g.proxies) {
        if (p.dead) { g.proxies.delete(it); continue; }
        if (!wanted.has(it)) orphans.push(it);
      }
      for (const it of want) {
        if (g.proxies.has(it)) continue;
        const look = itemLook(it);
        const oi = orphans.findIndex((o) => itemLook(o) === look);
        if (oi >= 0) {
          const o = orphans.splice(oi, 1)[0], p = g.proxies.get(o);
          g.proxies.delete(o);
          presentItem(o, false);
          p.item = it;
          if (p.batch) presentItem(it, true);
          g.proxies.set(it, p);
          continue;
        }
        const off = scatterOffset(rolls);
        const start = [g.pos[0], g.pos[1] + PI_SCATTER.up, g.pos[2]];
        const H = worldHeight(it, s);
        const at = constrainMove(start, [g.pos[0] + off[0], start[1], g.pos[2] + off[2]], H / 2, H, rayHit);
        const vel = proxyLaunch([at[0] - g.pos[0], 0, at[2] - g.pos[2]], fresh, s.impulse, rolls);
        const p = mint(it, at, vel, { kind: 'corpse', group: g });
        p.floorY = g.pos[1];
        g.proxies.set(it, p);
      }
      for (const o of orphans) { const p = g.proxies.get(o); g.proxies.delete(o); if (p) retire(p); }
    }
    for (const [entity, g] of groups) {
      if (seen.has(entity)) continue;
      for (const p of g.proxies.values()) retire(p);
      groups.delete(entity);
    }
  }
  /** The shift-drop's piles (Independent): each holding its item has a proxy at its foot; an emptied or gone one, none. */
  function reconcilePiles(piles) {
    const live = new Set();
    for (const pile of piles ?? []) {
      const it = pile.items?.[0];
      if (!it || pile.dead || pile.inactive) continue;
      live.add(pile);
      let p = pileProxies.get(pile);
      if (p && p.item !== it) { if (itemLook(p.item) === itemLook(it)) { presentItem(p.item, false); p.item = it; if (p.batch) presentItem(it, true); } else { retire(p); p = undefined; } }
      if (!p) {
        p = mint(it, pile.pos, [0, 0, 0], { kind: 'pile', pile });   // PhysicalizeIndependent [IL_46fc]: StartDynamic(zero)
        p.floorY = pile.pos[1];
        if (pile.settled) settleBody(p.body);   // a restored pile lies where it was saved (the mod's settles there 0.5 s on)
        pileProxies.set(pile, p);
      }
    }
    for (const [pile, p] of pileProxies) if (!live.has(pile)) { retire(p); pileProxies.delete(pile); }
  }

  // ---- the flight --------------------------------------------------------------------------------------------------
  const DOWN = [0, -1, 0];
  function probes(p, col) {
    // the floor under a point: the collider's, else (no collider, or nothing under) the floor the item came from
    const ground = (x, top, z) => {
      const d = col?.raycast ? col.raycast([x, top, z], DOWN, 64) : Infinity;
      if (Number.isFinite(d)) return top - d;
      return top >= p.floorY ? p.floorY : null;
    };
    const wall = col?.raycast ? (from, dir, len) => { const d = col.raycast(from, dir, len); return Number.isFinite(d) ? d : null; } : null;
    return { ground, wall };
  }
  function fly(dt) {
    if (!(dt > 0)) return;
    let any = false;
    const col = colliderNow();
    for (const p of proxies.values()) {
      if (p.body.settled) continue;
      any = true;
      const { ground, wall } = probes(p, col);
      const what = flyBody(p.body, dt, ground, wall);
      if (what === 'rest' && p.backing.kind === 'pile') { const pile = p.backing.pile; pile.pos[0] = p.body.pos[0]; pile.pos[1] = p.body.pos[1]; pile.pos[2] = p.body.pos[2]; pile.settled = true; }
    }
    if (any) shoulder([...proxies.values()].map((p) => p.body), Math.min(dt, 0.25));
  }

  // ---- the press ---------------------------------------------------------------------------------------------------
  const proxyFor = (key) => {
    if (typeof key !== 'string' || !key.startsWith(PI_KEY_PREFIX)) return null;
    const p = proxies.get(Number(key.slice(PI_KEY_PREFIX.length)));
    return p && !p.dead ? p : null;
  };
  /** The list a proxy's item lives in - the body's, or its pile's. */
  const listOf = (p) => (p.backing.kind === 'corpse' ? p.backing.group.entity.items : p.backing.pile.items);
  const backingOf = (p) => (p.backing.kind === 'corpse' ? { kind: 'corpse', key: p.backing.group.key, entity: p.backing.group.entity } : p.backing);

  const _targets = [];
  return {
    PI_KEY_PREFIX,
    /** The host's half - any of `{ collider, corpses, identity, getQuest, took, say, revealMap, taken, paused }` (and the
     *  pool's `emptied`), kept until replaced. `taken(backing)` hears every press that moved anything out of a body or a
     *  pile (AUDIT PI1 H2: a part of a stack too); `paused()` stops the flights (AUDIT PI1 L10 - FixedUpdate returns on
     *  IsGamePaused [IL_1eb6]). A corpse source is `{ entity, pos, key?, entry?, silver? }`: `silver` (or the pool's
     *  `entry`) the container its silver find is rolled for. */
    attach(h = {}) { host = { ...host, ...h }; },
    /** Whether the mod is on (its Enabled key). Off, nothing stands and the piles wear their bags. */
    on,
    /** Whether a key is one of this layer's. */
    owns: (key) => typeof key === 'string' && key.startsWith(PI_KEY_PREFIX),
    /** Whether a shift-drop pile is presented as its item - its picture drawn - so its bag is not drawn, nor its own target
     *  offered (AUDIT PI1 R5/L8: never while the picture is still on its way). */
    presents: (pile) => { const p = on() ? pileProxies.get(pile) : null; return !!p && p.batch != null; },
    /**
     * THE SHIFT-DROP'S LAYOUT (GetBatchSpreadCentre [IL_3fa4], GetBatchDropPosition [IL_4028]): where each of `items`
     * lands - the spiral round the point 1.1 m ahead of `anchor` (the player's feet) along `forward` (flat), each on the
     * floor TryProjectBatchPointToFloor [IL_4104] picks (2 m over the feet's height, 5 m down, a floor face, the one
     * nearest the feet's height) with HasClearBatchPath's [IL_4248] way from the feet, clear of every footprint
     * (FlushPendingDrops' max(0.2, 0.6 x its size) - AUDIT PI1 I3) - this click's and, the port's own, the shift-drops
     * already lying (the mod lays one window's drops at its close). Answers a foot for each.
     */
    placeDrops(items, anchor, forward, lying = []) {
      const s = settingsNow();
      const col = colliderNow();
      const fl = Math.hypot(forward?.[0] ?? 0, forward?.[2] ?? 0) || 1;
      const centre = [anchor[0] + ((forward?.[0] ?? 0) / fl) * PI_SPIRAL.ahead, anchor[1], anchor[2] + ((forward?.[2] ?? 1) / fl) * PI_SPIRAL.ahead];
      const floorAt = (pt) => {
        if (!col?.raycast) return anchor[1];
        // RaycastNonAlloc's hits, one at a time: each next ray starts just past the last face
        const hits = [];
        let top = anchor[1] + PI_FLOOR_PROBE.up, left = PI_FLOOR_PROBE.len;
        for (let k = 0; k < 8 && left > 0; k++) {
          const h = col.raycastHit ? col.raycastHit([pt[0], top, pt[2]], DOWN, left) : { dist: col.raycast([pt[0], top, pt[2]], DOWN, left), normal: [0, 1, 0] };
          if (!Number.isFinite(h?.dist)) break;
          hits.push({ y: top - h.dist, ny: h.normal ? h.normal[1] : 1 });
          top -= h.dist + 0.001; left -= h.dist + 0.001;
        }
        return nearestFloor(hits, anchor[1]);
      };
      const clear = (a, b) => {
        if (!col?.raycast) return true;
        const from = [a[0], a[1] + PI_PATH.lift, a[2]], dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], l = Math.hypot(dx, dy, dz);
        if (!(l > PI_PATH.skin)) return true;
        const d = col.raycast(from, [dx / l, dy / l, dz / l], l);
        return !(Number.isFinite(d) && d < l - PI_PATH.skin);
      };
      const placed = lying.map((pile) => ({ pos: pile.pos, r: dropRadius(worldHeight(pile.items?.[0], s)) }));
      const next = { i: 0 };
      return items.map((it) => {
        const r = dropRadius(worldHeight(it, s));
        const at = spiralDrop(anchor, centre, r, next, placed, floorAt, clear);
        placed.push({ pos: at, r });
        return [at[0], at[1] + PI_SPIRAL.lift, at[2]];
      });
    },
    /** One frame: the bodies and piles reconciled, the flights stepped (none while the game is paused), the batches moved
     *  and dressed (the rim read again, a size re-cut when the settings change - AUDIT PI1 R4), a build's change and a
     *  picture's retry asked for. */
    frame(dt, piles = []) {
      if (!on()) { if (proxies.size) this.clear(); return; }
      let st = null;
      try { st = mw?.stamp?.() ?? null; } catch { st = null; }
      if (st !== _stamp) { _stamp = st; for (const p of proxies.values()) { p.tries = 0; askPicture(p); } }   // a build landed or went: every picture again
      reconcileBodies();
      reconcilePiles(piles);
      let paused = false;
      try { paused = !!host.paused?.(); } catch { paused = false; }
      fly(paused ? 0 : dt);
      const t = now();
      settingsNow();
      const gen = settings ? 0 : _gen;   // injected settings (the pins') never move
      const redress = _dressedGen !== null && gen !== _dressedGen;
      _dressedGen = gen;
      for (const p of proxies.values()) {
        if (redress && p.batch) dress(p);
        if (p.retryAt && t >= p.retryAt && !p.asking) askPicture(p);
        if (!p.batch) continue;
        p.batch.origin[0] = p.body.pos[0]; p.batch.origin[1] = p.body.pos[1]; p.batch.origin[2] = p.body.pos[2];
        setBatchGlint(p.batch, rarityRim(p.item));
      }
    },
    batches: () => { const out = []; for (const p of proxies.values()) if (p.batch) out.push(p.batch); return out; },
    /** The proxies on the ray, as the piles are (droppedLoot.js lootTargets): the ray's reach to win the pick, and the
     *  mod's own 3 m to take (RaycastPhysicalItem [IL_5b54]) - the ladder says "too far" past it. */
    targets() {
      _targets.length = 0;
      for (const p of proxies.values()) {
        if (!p.batch || !p.size) continue;
        const [x, y, z] = p.body.pos, hw = Math.max(PI_BOX_MIN_HALF, p.body.half[0], p.body.half[1]), h = Math.max(PI_BOX_MIN_H, p.size.h);
        _targets.push({ key: `${PI_KEY_PREFIX}${p.id}`, aabb: { min: [x - hw, y, z - hw], max: [x + hw, y + h, z + hw] }, distance: RAY_DISTANCE, reach: PI_REACH });
      }
      return _targets;
    },
    /** What a proxy holds, for the plaque and the name (World Tooltips' lootPileName: a pile of one is its item's long
     *  name and stack - FormatWorldTooltip's "{0} ({1})" [IL_5d7f]). AUDIT PI1 L15: never an item that has left. */
    contents: (key) => { const p = proxyFor(key); return p && listOf(p)?.includes(p.item) ? [p.item] : null; },
    /** LOOT11's finds: each presented item's crown and itself. */
    finds() { const out = []; for (const p of proxies.values()) if (p.batch && p.size) out.push({ root: lootCrown(p.body.pos, p.size), items: [p.item], own: true }); return out; },
    /**
     * THE PRESS (TryPickup [IL_847c]): the proxy's item into `playerEntity`'s pack. The mod's order: a summoned item
     * refused, a map read and spent (RecordLocationFromMap, then RemoveItem - through the host's `revealMap`; with none,
     * the map comes into the pack as it is), the quest click, the WHOLE stack or nothing (CanCarryWholeStack - AUDIT PI1
     * I2), gold into the purse - the pack's one-item door (systems/quickLoot.js takeOneItem, `wholeStack`). The port's
     * own guards beside it: a transformed lycanthrope's paws take nothing (the pack's own refusal - AUDIT PI1 H7), an
     * armed quick-loot key is spent on this press (AUDIT PI1 H3 - WB9's own law for the spoils), a body's silver is
     * rolled at its first take (AUDIT PI1 H7 - SILVER-FINDS' door). Answers true when the press was this layer's.
     */
    pick(key, playerEntity) {
      const p = proxyFor(key);
      if (!p) return false;
      try { quickLootSpend(); } catch { /* the keys are not the take's */ }
      const list = listOf(p);
      if (!Array.isArray(list) || !list.includes(p.item)) { retire(p); return true; }
      const say = (l) => { try { host.say?.(l); } catch { /* the line is not the take's */ } };
      const beast = racialSuppressInventory(playerEntity);
      if (beast) { say(beast.text); return true; }
      // the summoned refusal first, in the mod's order (TryPickup [IL_8494] - "cannotRemoveItem"): ahead of the map arm,
      // so a summoned map is refused aloud, never read nor silently left
      if (isSummoned(p.item)) { say(CANNOT_REMOVE_ITEM_TEXT); return true; }
      const stack = p.item.stackCount ?? 1;
      let moved = false;
      if (isMap(p.item)) {
        if (typeof host.revealMap === 'function') {
          list.splice(list.indexOf(p.item), 1);
          let name = null;
          try { name = host.revealMap(); } catch { name = null; }
          if (!name) say(USE_TEXT.readMapFail);
        } else {
          takeOneInto(playerEntity, list, p.item);
          let shown = false;
          try { shown = host.took?.([{ item: p.item, count: stack }], playerEntity) === true; } catch { shown = false; }
          if (!shown) say(tookItemText(p.item));
        }
        moved = true;
      } else {
        const got = takeOneItem(playerEntity, list, p.item, say, { getQuest: host.getQuest ?? null, took: host.took ?? null, wholeStack: true });
        moved = got != null && got !== QUICK_LOOT_REFUSED;
      }
      if (moved) {
        const g = p.backing.kind === 'corpse' ? p.backing.group : null;
        if (g && !g.silvered) { g.silvered = true; if (g.silver != null) silverFindAt('corpse', g.silver); }
        try { host.taken?.(backingOf(p)); } catch (e) { console.warn('[physical-items] the host\'s word on a take failed', /** @type {any} */ (e)?.message ?? e); }   // the dungeon's room hears it
      }
      if (!list.includes(p.item)) {
        retire(p);
        if (p.backing.kind === 'pile') host.emptied?.(p.backing);
      }
      return true;
    },
    /** AUDIT 17e F23: the floating origin moved - every body with it, and the bodies' own places (so the move is not
     *  carried twice). */
    offsetAll([dx, dy, dz]) {
      for (const p of proxies.values()) { p.body.pos[0] += dx; p.body.pos[1] += dy; p.body.pos[2] += dz; p.floorY += dy; }
      for (const g of groups.values()) { g.pos[0] += dx; g.pos[1] += dy; g.pos[2] += dz; }
    },
    /** AUDIT LANDFORMS II G1: the ground moved under a box - what lies in it rides the move (the bodies' places with it, as
     *  their pools move them). */
    groundMoved(x0, z0, x1, z1, dy) {
      const inBox = (x, z) => x >= x0 && x < x1 && z >= z0 && z < z1;
      for (const p of proxies.values()) {
        const [x, , z] = p.body.pos;
        if (!inBox(x, z)) continue;
        const d = dy(x, z);
        if (d) { p.body.pos[1] += d; p.floorY += d; }
      }
      for (const g of groups.values()) if (inBox(g.pos[0], g.pos[2])) { const d = dy(g.pos[0], g.pos[2]); if (d) g.pos[1] += d; }
    },
    /** Everything down: the proxies, their batches, their hold on the pictures. */
    clear() {
      for (const p of [...proxies.values()]) retire(p);
      groups.clear(); pileProxies.clear();
    },
    /** The layer's end (a dungeon's teardown): everything down (a picture still on its way lands on a retired proxy and
     *  is dropped), and the cut pictures let go. */
    destroy() {
      this.clear();
      pictures.clear();
    },
    /** For the pins and the stats. */
    state: () => [...proxies.values()].map((p) => ({ id: p.id, kind: p.backing.kind, item: p.item, pos: [...p.body.pos], vel: [...p.body.vel], settled: p.body.settled, pic: typeof p.pic === 'object' && p.pic ? p.pic.record : p.pic, size: p.size, glint: p.batch?.glint ?? null, noShadow: p.batch?.noShadow ?? null })),
  };
}
