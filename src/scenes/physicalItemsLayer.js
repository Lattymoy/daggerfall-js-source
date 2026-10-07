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
// THE RARITY DRESS (Mac: "the rarity treatment (like we do for the world boss)"): the tier's rim on a Magic-or-better
// picture (systems/physicalItems.js rarityRim) and the world boss's loot line out of the top of a Rare-or-better one
// (`finds` - scenes/lootLines.js, which leaves a presented item out of its body's own line).
//
// Not a DFU member. Ledger A (PI).
import {
  PHYSICAL_ITEMS_VENDOR, readPhysicalItemsSettings, showsOnCorpse, worldHeight, visibleBox, cropTo, artworkSize, colliderDepth,
  scatterOffset, proxyLaunch, makeBody, settleBody, flyBody, shoulder, rarityRim, presentItem, diedRecently, markDeath, PI_BODY,
  spiralDrop, PI_SPIRAL,
} from '../systems/physicalItems.js';
import { modSetting, modSettingsGeneration } from '../systems/modSettings.js';
import { registerEnemyDeathHandler } from './corpseMarker.js';
import { setBatchGlint } from '../systems/hitFlash.js';
import { lootCrown } from './lootLines.js';
import { RAY_DISTANCE, TREASURE_ACTIVATION_DISTANCE } from '../player/activate.js';
import { itemIconColor32 } from '../ui/itemIconColor32.js';
import { toColor32 } from '../formats/color32Order.js';
import { takeOneItem } from '../systems/quickLoot.js';
import { isMap, USE_TEXT } from '../systems/useItem.js';

/** The pseudo-archive the pictures go up under: past the large boat's 38151. */
export const PI_ICON_ARCHIVE = 38161;
/** A proxy's key on the ray - the pool's own vocabulary, so every host's ladder (the reach, the name, the plaque) reads it
 *  as the one-item pile it is. */
export const PI_KEY_PREFIX = 'droppedLoot:pi';
/** The press box's least half-width and height (a dagger lying flat is still a thing to aim at). */
export const PI_BOX_MIN_HALF = 0.2;
export const PI_BOX_MIN_H = 0.25;

// HandleEnemyDeath [IL_4790]: OnEnemyDeath, once for every layer - the death is noted, and the layer that meets the body
// throws its items out of it
registerEnemyDeathHandler('physical-items', (entity) => markDeath(entity));

/** The Morrowind picture door, loaded on first ask (fpArm.js is the hosts' own import; a lazy one keeps this layer's
 *  importers - the pool, the pins - off its module graph). Its stamp answers null until the module is in. */
let _fpArm = null, _fpArmLoading = null;
const fpArmOnce = () => (_fpArmLoading ??= import('../combat/fpArm.js').then((m) => { _fpArm = m.fpArm; return _fpArm; }).catch(() => null));
const defaultMw = {
  stamp: () => { if (!_fpArm) { fpArmOnce(); return null; } return _fpArm.mountPictureStamp(); },
  picture: (item) => fpArmOnce().then((a) => a?.mountPicture(item) ?? null),
};

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
  /** The host's half (attach): its collider, its bodies, the wearer the pack draws for, and the take's own hooks. */
  /** @type {any} */
  let host = { collider: () => null, corpses: () => [], identity: () => undefined, getQuest: null, took: null, say: () => {}, revealMap: null, taken: null, emptied: null };
  let _settings = null, _gen = -1;
  const settingsNow = () => {
    if (settings) return settings();
    const g = modSettingsGeneration();
    if (!_settings || g !== _gen) { _gen = g; _settings = readPhysicalItemsSettings(); }
    return _settings;
  };
  const on = () => { try { return !!enabled(); } catch { return false; } };

  let _nextId = 0;
  /** Every proxy: its id, its item, its backing ('corpse' - the body's `group` - or 'pile'), its body, its picture and batch. */
  const proxies = new Map();
  /** The bodies being presented, by entity: `{ entity, pos, items, proxies: Map(item -> proxy), seen }`. */
  const groups = new Map();
  /** The shift-drop piles being presented, by pile: proxy. */
  const pileProxies = new Map();
  /** The pictures up on the GPU, by record - freed with the layer. */
  const uploaded = new Map();
  let _stamp = null;

  // ---- the picture -------------------------------------------------------------------------------------------------
  function upload(record, w, h, colors) {
    if (!uploaded.has(record)) { renderer?.uploadTexture?.(PI_ICON_ARCHIVE, record, { width: w, height: h, colors }); uploaded.set(record, true); }
  }
  /** A color32 picture cut to its visible texels and up under its own record: `{ record, vw, vh }`. */
  function standPicture(key, width, height, colors) {
    const box = visibleBox(colors, width, height);
    const record = `${key}@${box.x},${box.y},${box.w},${box.h}`;
    if (!uploaded.has(record)) upload(record, box.w, box.h, cropTo(colors, width, box));
    return { record, vw: box.w, vh: box.h };
  }
  function askPicture(p) {
    p.pic = 'asked';
    const ask = p.ask = {};
    const stamp = _stamp;
    const classic = () => Promise.resolve().then(() => iconOf(p.item, host.identity?.())).then((img) => (img?.colors && img.width > 0 && img.height > 0 ? standPicture(`c:${img.key}`, img.width, img.height, img.colors) : null));
    const morrowind = () => (stamp == null ? Promise.resolve(null) : Promise.resolve().then(() => mw.picture(p.item)).then((pic) => {
      if (!pic?.image?.width || !pic.key) return null;
      const c = toColor32(pic.image);
      return standPicture(`m:${pic.key}`, c.width, c.height, c.colors);
    }));
    morrowind().catch(() => null).then((got) => got ?? classic()).then((got) => {
      if (p.ask !== ask || p.dead) return;   // asked again (a build landed), or gone
      p.pic = got ?? 'none';
      if (got) dress(p);
    }, () => { if (p.ask === ask) p.pic = 'none'; });
  }
  /** The proxy's size, box and batch off its picture (BuildVisual [IL_09b8]; the box's depth GetColliderDepth [IL_1a21]). */
  function dress(p) {
    const pic = p.pic;
    if (!pic || typeof pic !== 'object') return;
    const size = artworkSize(pic.vw, pic.vh, worldHeight(p.item, settingsNow()));
    p.size = size;
    p.body.half = [size.w / 2, colliderDepth(size.w, size.h) / 2];
    if (p.batch) renderer?.destroyBillboardBatch?.(p.batch);
    p.batch = null;
    try {
      p.batch = renderer?.createBillboardBatch?.(PI_ICON_ARCHIVE, pic.record, size, [[0, 0, 0]]) ?? null;
    } catch { p.batch = null; }
    if (!p.batch) return;
    p.batch.noShadow = true;   // F2: a thing lying on the ground is no standing card for the sun
    p.batch.origin = [...p.body.pos];
    setBatchGlint(p.batch, rarityRim(p.item));
  }

  // ---- the proxies -------------------------------------------------------------------------------------------------
  function mint(item, pos, vel, backing) {
    const p = { id: ++_nextId, item, backing, body: makeBody(pos, vel), pic: null, ask: null, batch: null, size: null, dead: false, floorY: pos[1] };
    p.body.settled = false;
    proxies.set(p.id, p);
    presentItem(item, true);
    askPicture(p);
    return p;
  }
  function retire(p) {
    if (p.dead) return;
    p.dead = true;
    presentItem(p.item, false);
    if (p.batch) renderer?.destroyBillboardBatch?.(p.batch);
    p.batch = null;
    proxies.delete(p.id);
  }

  /** ReconcileCorpseGroup [IL_4af8] over the host's bodies: each body's shown items have a proxy, and only they do. A new
   *  body met at its fall throws its items out (CreateCorpseProxy [IL_4f2e], fresh); met later, they are laid round it. */
  function reconcileBodies() {
    const s = settingsNow();
    const seen = new Set();
    let list = [];
    try { list = host.corpses?.() ?? []; } catch { list = []; }
    for (const c of list) {
      const entity = c?.entity;
      if (!entity || !Array.isArray(c.pos)) continue;
      seen.add(entity);
      let g = groups.get(entity);
      const fresh = !g && diedRecently(entity, now());
      if (!g) { g = { entity, pos: c.pos, key: c.key ?? null, proxies: new Map() }; groups.set(entity, g); }
      g.pos = c.pos; g.key = c.key ?? g.key;
      const items = Array.isArray(entity.items) ? entity.items : [];
      const want = new Set(items.filter((it) => showsOnCorpse(it, s)));
      for (const [it, p] of g.proxies) if (!want.has(it) || p.dead) { retire(p); g.proxies.delete(it); }
      for (const it of want) {
        if (g.proxies.has(it)) continue;
        const off = scatterOffset(rolls);
        const at = [g.pos[0] + off[0], g.pos[1] + off[1], g.pos[2] + off[2]];
        const vel = proxyLaunch([off[0], 0, off[2]], fresh, s.impulse, rolls);
        const p = mint(it, at, vel, { kind: 'corpse', group: g });
        p.floorY = g.pos[1];
        g.proxies.set(it, p);
      }
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
      if (p && p.item !== it) { retire(p); p = undefined; }
      if (!p) {
        p = mint(it, pile.pos, [0, 0, 0], { kind: 'pile', pile });   // PhysicalizeIndependent [IL_46fc]: StartDynamic(zero)
        p.floorY = pile.pos[1];
        if (pile.settled) settleBody(p.body);   // a restored pile lies where it was saved
        pileProxies.set(pile, p);
      }
    }
    for (const [pile, p] of pileProxies) if (!live.has(pile)) { retire(p); pileProxies.delete(pile); }
  }

  // ---- the flight --------------------------------------------------------------------------------------------------
  const DOWN = [0, -1, 0];
  function probes(p) {
    const col = (() => { try { return host.collider?.() ?? null; } catch { return null; } })();
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
    const moving = [];
    for (const p of proxies.values()) if (!p.body.settled) moving.push(p);
    if (!moving.length) return;
    for (const p of moving) {
      const { ground, wall } = probes(p);
      const what = flyBody(p.body, dt, ground, wall);
      if (what === 'rest' && p.backing.kind === 'pile') { const pile = p.backing.pile; pile.pos[0] = p.body.pos[0]; pile.pos[1] = p.body.pos[1]; pile.pos[2] = p.body.pos[2]; pile.settled = true; }
    }
    shoulder(moving.map((p) => p.body), Math.min(dt, PI_BODY.dt * 4));
  }

  // ---- the press ---------------------------------------------------------------------------------------------------
  const proxyFor = (key) => {
    if (typeof key !== 'string' || !key.startsWith(PI_KEY_PREFIX)) return null;
    const p = proxies.get(Number(key.slice(PI_KEY_PREFIX.length)));
    return p && !p.dead ? p : null;
  };
  /** The list a proxy's item lives in - the body's, or its pile's. */
  const listOf = (p) => (p.backing.kind === 'corpse' ? p.backing.group.entity.items : p.backing.pile.items);

  const _targets = [];
  return {
    PI_KEY_PREFIX,
    /** The host's half - any of `{ collider, corpses, identity, getQuest, took, say, revealMap, taken }` (and the pool's
     *  `emptied`), kept until replaced. `taken(backing)` hears every item that left its body or pile on a press. */
    attach(h = {}) { host = { ...host, ...h }; },
    /** Whether the mod is on (its Enabled key). Off, nothing stands and the piles wear their bags. */
    on,
    /** Whether a key is one of this layer's. */
    owns: (key) => typeof key === 'string' && key.startsWith(PI_KEY_PREFIX),
    /** Whether a shift-drop pile is presented as its item (its bag is then not drawn, nor its own target offered). */
    presents: (pile) => { const p = on() ? pileProxies.get(pile) : null; return !!p && p.pic !== 'none'; },
    /**
     * THE SHIFT-DROP'S LAYOUT (GetBatchSpreadCentre [IL_3fa4], GetBatchDropPosition [IL_4028]): where each of `items`
     * lands - the spiral round the point 1.1 m ahead of `anchor` (the player's feet) along `forward` (flat), each on the
     * floor the collider finds there with a clear way from the feet, clear of the drops already lying (the shift-drop
     * piles' own footprints, half their item's size). Answers a foot for each.
     */
    placeDrops(items, anchor, forward, lying = []) {
      const s = settingsNow();
      const col = (() => { try { return host.collider?.() ?? null; } catch { return null; } })();
      const fl = Math.hypot(forward?.[0] ?? 0, forward?.[2] ?? 0) || 1;
      const centre = [anchor[0] + ((forward?.[0] ?? 0) / fl) * PI_SPIRAL.ahead, anchor[1], anchor[2] + ((forward?.[2] ?? 1) / fl) * PI_SPIRAL.ahead];
      const floorAt = (pt) => {
        if (!col?.raycast) return anchor[1];
        const top = anchor[1] + 1.5, d = col.raycast([pt[0], top, pt[2]], DOWN, 4);
        return Number.isFinite(d) ? top - d : null;
      };
      const clear = (a, b) => {
        if (!col?.raycast) return true;
        const from = [a[0], a[1] + 0.3, a[2]], dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], l = Math.hypot(dx, dy, dz);
        return !(l > 1e-6) || !Number.isFinite(col.raycast(from, [dx / l, dy / l, dz / l], l));
      };
      const placed = lying.map((pile) => ({ pos: pile.pos, r: worldHeight(pile.items?.[0], s) / 2 }));
      const next = { i: 0 };
      return items.map((it) => {
        const r = worldHeight(it, s) / 2;
        const at = spiralDrop(anchor, centre, r, next, placed, floorAt, clear);
        placed.push({ pos: at, r });
        return [at[0], at[1] + PI_SPIRAL.lift, at[2]];
      });
    },
    /** One frame: the bodies and piles reconciled, the flights stepped, the batches moved, a build's change asked for. */
    frame(dt, piles = []) {
      if (!on()) { if (proxies.size) this.clear(); return; }
      let st = null;
      try { st = mw?.stamp?.() ?? null; } catch { st = null; }
      if (st !== _stamp) { _stamp = st; for (const p of proxies.values()) askPicture(p); }   // a build landed or went: every picture again
      reconcileBodies();
      reconcilePiles(piles);
      fly(dt);
      for (const p of proxies.values()) {
        if (p.batch) { p.batch.origin[0] = p.body.pos[0]; p.batch.origin[1] = p.body.pos[1]; p.batch.origin[2] = p.body.pos[2]; }
      }
    },
    batches: () => { const out = []; for (const p of proxies.values()) if (p.batch) out.push(p.batch); return out; },
    /** The proxies on the ray, as the piles are (droppedLoot.js lootTargets: the ray's reach, the treasure's beside it). */
    targets() {
      _targets.length = 0;
      for (const p of proxies.values()) {
        if (!p.batch || !p.size) continue;
        const [x, y, z] = p.body.pos, hw = Math.max(PI_BOX_MIN_HALF, p.body.half[0], p.body.half[1]), h = Math.max(PI_BOX_MIN_H, p.size.h);
        _targets.push({ key: `${PI_KEY_PREFIX}${p.id}`, aabb: { min: [x - hw, y, z - hw], max: [x + hw, y + h, z + hw] }, distance: RAY_DISTANCE, reach: TREASURE_ACTIVATION_DISTANCE });
      }
      return _targets;
    },
    /** What a proxy holds, for the plaque and the name (World Tooltips' lootPileName: a pile of one is its item's long
     *  name and stack - FormatWorldTooltip's "{0} ({1})" [IL_5d7f]). */
    contents: (key) => { const p = proxyFor(key); return p ? [p.item] : null; },
    /** LOOT11's finds: each presented item's crown and itself. */
    finds() { const out = []; for (const p of proxies.values()) if (p.batch && p.size) out.push({ root: lootCrown(p.body.pos, p.size), items: [p.item], own: true }); return out; },
    /**
     * THE PRESS (TryPickup [IL_847c]): the proxy's item into `playerEntity`'s pack through the pack's one-item door
     * (systems/quickLoot.js takeOneItem - planTake's summoned refusal, the quest click, the carry check, gold into the
     * purse), taken out of the body or the pile it lies for. A MAP is read and spent ([IL_84b6] RecordLocationFromMap,
     * then RemoveItem) through the host's reveal (`revealMap` - world.js revealLocation's 'readMap'); a host with none
     * takes it whole, as an item. Answers true when the press was this layer's (taken, or refused out loud).
     */
    pick(key, playerEntity) {
      const p = proxyFor(key);
      if (!p) return false;
      const list = listOf(p);
      if (!Array.isArray(list) || !list.includes(p.item)) { retire(p); return true; }
      const say = (l) => { try { host.say?.(l); } catch { /* the line is not the take's */ } };
      if (isMap(p.item) && typeof host.revealMap === 'function') {
        list.splice(list.indexOf(p.item), 1);
        let name = null;
        try { name = host.revealMap(); } catch { name = null; }
        if (!name) say(USE_TEXT.readMapFail);
      } else if (takeOneItem(playerEntity, list, p.item, say, { getQuest: host.getQuest ?? null, took: host.took ?? null }) === null && isMap(p.item)) {
        // no reveal here: the map comes into the pack as the item it is (the window's own arm would read it there)
        list.splice(list.indexOf(p.item), 1);
        (playerEntity.items ??= []).push(p.item);
      }
      if (!list.includes(p.item)) {
        retire(p);
        const b = p.backing.kind === 'corpse' ? { kind: 'corpse', key: p.backing.group.key, entity: p.backing.group.entity } : p.backing;
        try { host.taken?.(b); } catch (e) { console.warn('[physical-items] the host\'s word on a take failed', /** @type {any} */ (e)?.message ?? e); }   // the dungeon's room hears it
        host.emptied?.(p.backing);
      }
      return true;
    },
    /** AUDIT 17e F23: the floating origin moved - every body with it. */
    offsetAll([dx, dy, dz]) { for (const p of proxies.values()) { p.body.pos[0] += dx; p.body.pos[1] += dy; p.body.pos[2] += dz; p.floorY += dy; } },
    /** AUDIT LANDFORMS II G1: the ground moved under a box - what lies in it rides the move. */
    groundMoved(x0, z0, x1, z1, dy) {
      for (const p of proxies.values()) {
        const [x, , z] = p.body.pos;
        if (!(x >= x0 && x < x1 && z >= z0 && z < z1)) continue;
        const d = dy(x, z);
        if (d) { p.body.pos[1] += d; p.floorY += d; }
      }
    },
    /** Everything down: the proxies, their batches, the pictures. */
    clear() {
      for (const p of [...proxies.values()]) retire(p);
      groups.clear(); pileProxies.clear();
    },
    destroy() {
      this.clear();
      for (const record of uploaded.keys()) renderer?.releaseTexture?.(PI_ICON_ARCHIVE, record);
      uploaded.clear();
    },
    /** For the pins and the stats. */
    state: () => [...proxies.values()].map((p) => ({ id: p.id, kind: p.backing.kind, item: p.item, pos: [...p.body.pos], vel: [...p.body.vel], settled: p.body.settled, pic: typeof p.pic === 'object' && p.pic ? p.pic.record : p.pic, size: p.size, glint: p.batch?.glint ?? null })),
  };
}
