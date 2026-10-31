// @ts-check
// DRAGON5b (2026-10-29, the owner: "If tamed, the dragon becomes a players mount they can summon, just like their
// horse/carriage. With the ability to name"; bible/11-Multiplayer/Dwarven-Dragon.md section 10): THE TAMED DRAGON IN THE
// WORLD, ON THIS SCREEN. Off its back it waits where it was left; called, it flies in and lands behind the player; sent
// away, it climbs off. It is drawn here, its press and its plaque answered, its word put on my foes frame and the
// others' dragons drawn off theirs. Its law is systems/dragon/dragonKeep.js; the dragon's sky host makes it
// (scenes/dragonHost.js createDragonSky), so every seam is in `deps` and it runs in Node. Not a DFU member.
import { playerEntity } from '../characters/playerEntity.js';
import { DWARVEN_DRAGON_ID, dragonArchiveOf } from '../characters/dwarvenDragonId.js';
import { stateAnims } from '../characters/mobile/mobileUnit.js';
import { mobileBillboardSize } from '../world/rmbFlats.js';
import { bossFrame } from '../world/gate/gateBoss.js';
import { DRAGON_BODY_R, DRAGON_BODY_H } from '../net/dragon/dragonBody.js';
import { dragonName } from '../systems/dragon/dragonWords.js';
import { dragonMountOf, dragonLookOfItem } from '../systems/dragon/dragonMount.js';
import {
  DRAGON_WHERE,
  DRAGON_WAIT_BACK_M,
  DRAGON_NEAR_M,
  DRAGON_NAME_MAX,
  DRAGON_BAGS_KG,
  DRAGON_KEEP_TEXT,
  DRAGON_KEEP_ROWS,
  freshDragonKeep,
  dragonKeepName,
  normalizeDragonName,
  keepRidden,
  keepLeft,
  keepCalled,
  keepSentAway,
  keepNotLast,
  keepShownAt,
  keepFlightAt,
  keepComing,
  dragonCallRefusal,
  setDragonKeepDoor,
} from '../systems/dragon/dragonKeep.js';
import { dragonKeepWireRecord, validDragonKeepRecord, dragonKeepRecordKey } from '../net/dragon/dragonKeepWire.js';
import { TRANSPORT_MODES, hasHorse, hasCart } from '../systems/transport.js';
import { ACTIVATE_MODE } from '../systems/horse/horseCartLaw.js';
import { rideModeNow, rideDragon } from '../player/dragonRide.js';
import { totalWeight } from '../systems/inventory.js';
import { InputMessageBoxWindow } from '../ui/inputMessageBox.js';
import { inventoryDoorReady } from '../ui/inventoryDoor.js';

/** Its press reaches from this far off its body's box (HCC's horse: 3.2), m; it is drawn within this of the eye, m. */
export const DRAGON_KEEP_REACH = 4;
export const DRAGON_KEEP_DRAW_R = 2500;
/** DRAGON-KEEP-SIZE (2026-10-31, the owner: "the dragon when in possession of a player is too large unmounted"): a tamed
 *  dragon off its back is drawn at the size it is ridden at - its sprite's own, as net/remotePlayers.js draws its rider -
 *  never at the boss's DRAGON_SCALE (scenes/dragonHost.js), which drew it 1.6 times its ridden self. */
export const DRAGON_KEEP_SCALE = 1;
/** "Already here": waiting within this of the player, a call is not needed, m. */
export const DRAGON_HERE_M = 40;
const MINE = 'dragonkeep:mine',
  PEER = 'dragonkeep:peer:';

/**
 * deps = { now, local(nx, nz) -> [x, z], native(x, z) -> [nx, nz], ground(x, z), feet(), eye(), street(), say(text),
 * renderer?, getTexture?, uploadRecordFrame?, townTalk? (its overlay), makeInventoryWindow? (the pack's door),
 * entity? (the player) }
 * @param {any} deps
 */
export function createDragonKeep(deps) {
  const entity = () => deps.entity ?? playerEntity;
  const items = () => entity()?.items ?? [];
  const dragonItem = () => dragonMountOf(items());
  /** The keep, made fresh for a dragon that has none; null with no dragon held. */
  const keep = () => {
    const e = entity();
    if (!e || !dragonItem()) return null;
    return (e.dragonKeep ??= freshDragonKeep());
  };
  const put = (k) => {
    const e = entity();
    if (e) e.dragonKeep = k;
  };
  const look = () => dragonLookOfItem(dragonItem());
  const name = () => dragonKeepName(keep());
  let lastFeet = null,
    heading = 0,
    wasRiding = false;
  const peers = new Map();
  const texs = new Map(),
    batches = new Map(),
    _out = [];
  let lastKey = '';

  /** The scene point `back` metres behind native spot `nx, nz` along `yaw`, `up` over the ground. */
  function scenePoint(nx, nz, yaw, back = 0, up = 0) {
    const [x0, z0] = deps.local(nx, nz);
    const x = x0 - Math.sin(yaw) * back,
      z = z0 - Math.cos(yaw) * back;
    const g = Number(deps.ground(x, z));
    return [x, (Number.isFinite(g) ? g : 0) + up, z];
  }
  const nearMine = (k, f) => {
    if (!k || !f || k.where !== DRAGON_WHERE.Waiting) return Infinity;
    const [x, z] = deps.local(k.nx, k.nz);
    return Math.hypot(x - f[0], z - f[2]);
  };
  /** The native spot behind the player, along the way they last moved. */
  function spotBehind(f) {
    const x = f[0] - Math.sin(heading) * DRAGON_WAIT_BACK_M,
      z = f[2] - Math.cos(heading) * DRAGON_WAIT_BACK_M;
    return deps.native(x, z);
  }

  /** ONE FRAME (online, any mode): the mount and the dismount seen, the player's way kept. */
  function tick() {
    const k = keep();
    if (!k) return;
    const mode = rideModeNow(),
      riding = mode === TRANSPORT_MODES.Dragon;
    if (deps.street()) {
      const f = deps.feet?.();
      if (f) {
        if (lastFeet && Math.hypot(f[0] - lastFeet[0], f[2] - lastFeet[2]) > 0.3)
          heading = Math.atan2(f[0] - lastFeet[0], f[2] - lastFeet[2]);
        if (!lastFeet || Math.hypot(f[0] - lastFeet[0], f[2] - lastFeet[2]) > 0.3) lastFeet = [f[0], f[1], f[2]];
      }
    }
    if (riding && k.where !== DRAGON_WHERE.Ridden) put(keepRidden(k));
    else if (!riding && k.where === DRAGON_WHERE.Ridden) {
      if (lastFeet && wasRiding) {
        const [nx, nz] = spotBehind(lastFeet);
        put(keepLeft(k, nx, nz, heading));
      } else put({ ...k, where: DRAGON_WHERE.Away, flight: null }); // a save read off its back with nowhere it was left
    }
    if (mode === TRANSPORT_MODES.Horse || mode === TRANSPORT_MODES.Cart) put(keepNotLast(keep()));
    wasRiding = riding;
  }

  /** The texture an archive's frames upload from, asked once. */
  function texture(archive) {
    const tex = texs.get(archive);
    if (tex && !(tex instanceof Promise)) return tex.failed ? null : tex;
    if (!tex && deps.getTexture)
      texs.set(
        archive,
        Promise.resolve()
          .then(() => deps.getTexture(archive))
          .then(
            (x) => {
              texs.set(archive, x ? { tex: x } : { failed: true });
            },
            () => {
              texs.set(archive, { failed: true });
            },
          ),
      );
    return null;
  }
  /** One dragon's body: its batch (by `id`), the frame its act shows the eye, at `feet`. */
  function body(id, feet, yaw, lk, moving, t) {
    const archive = dragonArchiveOf(lk),
      T = texture(archive),
      r = deps.renderer;
    if (!T || !r?.createBillboardBatch) return;
    const anims = stateAnims(moving ? 'move' : 'idle', DWARVEN_DRAGON_ID, true, false, false, true, false, false);
    const fr = bossFrame(
      /** @type {any} */ ({ anims, frame: Math.floor((t / 1000) * (anims[0]?.fps ?? 6)), loop: true }),
      yaw,
      feet,
      deps.eye?.() ?? feet,
      (rec) => T.tex.getFrameCount?.(rec) ?? 1,
    );
    const rkey = `${fr.record}#${fr.frame}`;
    if (!r.textures?.has?.(`${archive}_${rkey}`)) deps.uploadRecordFrame?.(archive, fr.record, fr.frame);
    const sz = mobileBillboardSize(T.tex, fr.record),
      k = DRAGON_KEEP_SCALE;
    let b = batches.get(id);
    if (b && b.keepArchive !== archive) {
      r.destroyBillboardBatch?.(b);
      b = null;
    }
    if (!b) {
      b = r.createBillboardBatch(archive, rkey, { w: sz.w * k, h: sz.h * k }, [[0, 0, 0]]);
      b.origin = [0, 0, 0];
      b.keepArchive = archive;
      batches.set(id, b);
    }
    b.record = rkey;
    b.size = { w: (fr.flip ? -sz.w : sz.w) * k, h: sz.h * k };
    if (b.bounds) b.bounds[3] = Math.hypot(sz.w, sz.h) * 0.5 * k;
    b.origin[0] = feet[0];
    b.origin[1] = feet[1];
    b.origin[2] = feet[2];
    _out.push(b);
  }
  const farFromEye = (p) => {
    const e = deps.eye?.();
    return !!e && Math.hypot(p[0] - e[0], p[2] - e[2]) > DRAGON_KEEP_DRAW_R;
  };
  /** My dragon as it shows now: `{ spot, feet, yaw, kind, age, moving }` (scene), or null. */
  function mineShown(t) {
    const k = keep(),
      s = k ? keepShownAt(k, t) : null;
    if (!k || !s) return null;
    return {
      spot: scenePoint(k.nx, k.nz, k.yaw),
      feet: scenePoint(k.nx, k.nz, k.yaw, s.back, s.up),
      yaw: k.yaw,
      kind: s.kind,
      age: s.age,
      moving: s.moving,
    };
  }
  /** A peer's as it shows at `t`: its flight run on from the age it was heard at. */
  function peerShown(p, t) {
    const age = p.kind ? p.age + (t - p.heardAt) : 0;
    const fl = p.kind ? keepFlightAt(p.kind, age) : null;
    if (p.kind === 'out' && !fl) return null;
    const back = fl?.back ?? 0,
      up = fl?.up ?? 0;
    const feet = [p.spot[0] - Math.sin(p.yaw) * back, p.spot[1] + up, p.spot[2] - Math.cos(p.yaw) * back];
    return { feet, moving: !!fl };
  }

  function frameBatches() {
    _out.length = 0;
    if (!deps.street()) return _out;
    const t = deps.now();
    const m = mineShown(t);
    const drawn = new Set();
    if (m && !farFromEye(m.feet)) {
      body(MINE, m.feet, m.yaw, look(), m.moving, t);
      drawn.add(MINE);
    }
    for (const [owner, p] of peers) {
      const s = peerShown(p, t);
      if (!s || farFromEye(s.feet)) continue;
      body(PEER + owner, s.feet, p.yaw, p.look, s.moving, t);
      drawn.add(PEER + owner);
    }
    for (const [id, b] of batches)
      if (!drawn.has(id)) {
        deps.renderer?.destroyBillboardBatch?.(b);
        batches.delete(id);
      }
    return _out;
  }

  /** Its box under the ray: mine waiting on the ground, and the others' (which yield, as another's team does). */
  const boxAt = (p) => ({
    min: [p[0] - DRAGON_BODY_R, p[1], p[2] - DRAGON_BODY_R],
    max: [p[0] + DRAGON_BODY_R, p[1] + DRAGON_BODY_H, p[2] + DRAGON_BODY_R],
  });
  function targets() {
    if (!deps.street()) return [];
    const out = [],
      t = deps.now(),
      m = mineShown(t);
    if (m && !m.moving) out.push({ key: MINE, aabb: boxAt(m.feet), reach: DRAGON_KEEP_REACH, noSurface: true });
    for (const [owner, p] of peers) {
      const s = peerShown(p, t);
      if (s && !s.moving)
        out.push({ key: PEER + owner, aabb: boxAt(s.feet), reach: DRAGON_KEEP_REACH, noSurface: true, yields: true });
    }
    return out;
  }
  /** The plaque's word: mine by its name, with its verbs; another's by its name and whose kind it is. */
  function hoverName(key) {
    if (key === MINE && keep()) {
      return {
        title: name(),
        actions: [
          { id: ACTIVATE_MODE.Grab, label: DRAGON_KEEP_ROWS.ride },
          { id: ACTIVATE_MODE.Steal, label: DRAGON_KEEP_ROWS.bags },
          { id: ACTIVATE_MODE.Talk, label: DRAGON_KEEP_ROWS.away },
          { id: ACTIVATE_MODE.Info, label: DRAGON_KEEP_ROWS.name },
        ],
      };
    }
    if (typeof key === 'string' && key.startsWith(PEER)) {
      const p = peers.get(key.slice(PEER.length));
      return p ? { title: p.name || dragonName(p.look) } : null;
    }
    return null;
  }
  const said = (ok, text) => {
    if (text) deps.say?.(text);
    return { ok, text };
  };

  /** Ride it: from its back's reach, else called to my side. */
  function ride() {
    const k = keep();
    if (!k) return said(false, DRAGON_KEEP_TEXT.none);
    if (k.where === DRAGON_WHERE.Ridden) return said(false, DRAGON_KEEP_TEXT.riding(name()));
    if (keepComing(k, deps.now())) return said(false, DRAGON_KEEP_TEXT.coming(name()));
    if (nearMine(k, deps.feet?.()) <= DRAGON_NEAR_M + DRAGON_BODY_R) {
      rideDragon();
      return { ok: true, text: '' };
    }
    return call();
  }
  /** Call it: it flies in and lands behind me. */
  function call() {
    const k = keep();
    if (!k) return said(false, DRAGON_KEEP_TEXT.none);
    if (keepComing(k, deps.now())) return said(false, DRAGON_KEEP_TEXT.coming(name()));
    const f = deps.feet?.();
    const why = dragonCallRefusal(k, {
      outdoors: deps.street() && !!f,
      aboard: !!deps.aboard?.(),
      riding: k.where === DRAGON_WHERE.Ridden,
      near: nearMine(k, f) <= DRAGON_HERE_M,
    });
    if (why) return said(false, why);
    const [nx, nz] = spotBehind(/** @type {number[]} */ (f));
    put(keepCalled(k, { nx, nz, yaw: heading, at: deps.now() }));
    return said(true, DRAGON_KEEP_TEXT.coming(name()));
  }
  /** Send it away: it climbs off, until it is called. */
  function sendAway() {
    const k = keep();
    if (!k) return said(false, DRAGON_KEEP_TEXT.none);
    if (k.where === DRAGON_WHERE.Ridden) return said(false, DRAGON_KEEP_TEXT.dismount(name()));
    if (k.where !== DRAGON_WHERE.Waiting) return said(false, DRAGON_KEEP_TEXT.alreadyAway(name()));
    put(keepSentAway(k, deps.now()));
    return said(true, DRAGON_KEEP_TEXT.away(name()));
  }
  /** Name it: an empty name keeps the one it has (HCC's ResolveHorseNameInput). */
  function rename(input) {
    const k = keep();
    if (!k) return said(false, DRAGON_KEEP_TEXT.none);
    const n = normalizeDragonName(input) || k.name;
    put({ ...k, name: n });
    return n ? { ok: true, text: DRAGON_KEEP_TEXT.named(n) } : { ok: false, text: DRAGON_KEEP_TEXT.nameless };
  }
  function openNamePrompt() {
    if (!deps.townTalk?.showOverlay || !keep()) return false;
    const box = new InputMessageBoxWindow({
      lines: [],
      label: DRAGON_KEEP_TEXT.nameLabel,
      value: keep()?.name ?? '',
      maxCharacters: DRAGON_NAME_MAX,
      onSubmit: (text) => {
        const r = rename(text);
        if (r.text) deps.say?.(r.text);
      },
    });
    deps.townTalk.showOverlay(box);
    return true;
  }
  /** Whether its bags are in reach: on its back, or beside it waiting. */
  const bagsNear = (k) =>
    !!k &&
    (k.where === DRAGON_WHERE.Ridden ||
      (!keepComing(k, deps.now()) && nearMine(k, deps.feet?.()) <= DRAGON_NEAR_M + DRAGON_BODY_R));
  /** Its saddlebags, a storage beside the pack (CARGO-ANYWHERE's door: scenes/holdDoor.js). */
  function openBags() {
    const k = keep();
    if (!k) return said(false, DRAGON_KEEP_TEXT.none);
    if (!bagsNear(k)) return said(false, DRAGON_KEEP_TEXT.tooFar(name()));
    if (!deps.makeInventoryWindow || !inventoryDoorReady()) return { ok: false, text: '' };
    const w = deps.makeInventoryWindow({
      loot: {
        items: () => keep()?.bags ?? [],
        storage: true,
        playerOwned: true,
        title: DRAGON_KEEP_TEXT.bagsOf(name()),
        capacity: () => ({ kg: DRAGON_BAGS_KG, name: name() }),
      },
    });
    if (w) deps.townTalk?.showOverlay?.(w);
    return { ok: !!w, text: '' };
  }
  /** The press on a dragon: mine by the plaque's row, else the interaction mode (HCC's horse: Info names, Talk commands). */
  function activate(key, distance, mode, row = null) {
    if (typeof key === 'string' && key.startsWith(PEER)) {
      const p = peers.get(key.slice(PEER.length));
      if (p) deps.say?.(p.name || dragonName(p.look));
      return true;
    }
    if (key !== MINE || !keep()) return false;
    if (distance > DRAGON_KEEP_REACH) {
      deps.say?.(DRAGON_KEEP_TEXT.tooFar(name()));
      return true;
    }
    const m = row ?? mode;
    if (m === ACTIVATE_MODE.Info) openNamePrompt();
    else if (m === ACTIVATE_MODE.Steal) openBags();
    else if (m === ACTIVATE_MODE.Talk) sendAway();
    else ride();
    return true;
  }

  /** My record now (null: none stands). */
  function record(toWire) {
    const t = deps.now(),
      m = deps.street() ? mineShown(t) : null;
    return m
      ? dragonKeepWireRecord(
          { spot: m.spot, yaw: m.yaw, kind: m.kind, age: m.age, look: look(), name: keep()?.name ?? '' },
          toWire,
        )
      : null;
  }
  /** My word on the foes frame: `dk` when it moved, or on a full frame (null: none stands). */
  function word(frame, full, toWire) {
    const rec = record(toWire),
      key = dragonKeepRecordKey(rec);
    if (full || key !== lastKey) {
      frame.dk = rec;
      lastKey = key;
    }
  }
  /** Another's word: their dragon kept in this scene's frame, its flight run on from the age it was heard at. */
  function peer(owner, raw, toScene = (p) => p) {
    const at = deps.now(); // this screen's clock, the flight's own
    if (typeof owner !== 'string' || !owner) return false;
    const r = raw == null ? null : validDragonKeepRecord(raw);
    if (!r) {
      peers.delete(owner);
      return raw == null;
    }
    peers.set(owner, { ...r, spot: toScene(r.spot), heardAt: at });
    return true;
  }

  /** The Stable page's card. */
  function model() {
    const k = keep();
    if (!k) return null;
    const t = deps.now(),
      coming = keepComing(k, t),
      d = nearMine(k, deps.feet?.());
    return {
      name: k.name,
      title: name(),
      where: k.where,
      coming,
      look: look(),
      near: bagsNear(k),
      far: Number.isFinite(d) ? Math.round(d) : null,
      bags: { count: k.bags.length, kg: totalWeight(k.bags), max: DRAGON_BAGS_KG },
    };
  }
  const door = {
    ride,
    call,
    sendAway,
    rename,
    openBags,
    model,
    /** DRAGON5c: its saddlebags' list (the upkeep feeds it from them). */
    bags: () => keep()?.bags ?? [],
    /** The summon key calls it first when it was the last ridden, or there is no horse and no wagon to call. */
    summonsFirst: () => {
      const k = keep();
      return !!k && (k.last || !(hasHorse(items()) || hasCart(items())));
    },
  };
  setDragonKeepDoor(door);
  return {
    tick,
    batches: frameBatches,
    targets,
    hoverName,
    activate,
    word,
    peer,
    door,
    clearPeers: () => peers.clear(),
  };
}
