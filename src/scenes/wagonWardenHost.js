// @ts-check
// WARDEN1 (systems/wagonWarden.js - the law; scenes/wagonWardenShow.js - the throw played; net/wire.js WARDEN1 - the
// cell's clock): THE TOWN WATCH IN THE STREETS' HOST.
//
// MY WAGON'S STAMP: every frame the save's parked wagon is read (the HCC runtime's view - its anchor, natives); a wagon
// parked somewhere new is stamped once the ground under it is built (`townAt` - undefined while its pixel is not: asked
// again the next frame) - its town (a city's, a hamlet's or a village's, read off the built pixel), whether it stands on
// the town's road (its box over the town's walk grid) and where a throw lands (out through the town's nearest edge).
// The stamp rides the save (WARDEN_VENDOR), so the offline clock outlives a load.
// THE WORD: my park word carries the stamp's fields (horseCartPool setWardenWord) - the cell throws on them.
// THE THROWS:
//   - The cell's word to me (`parkYeet`, online.js onParkYeet): my save moves to the landing (systems/horseCart.js
//     adoptYeet) and I am told; the throw is played where my wagon was drawn, within WARDEN_SHOW_REACH of the eye.
//   - The cell's word about another's team (a park word with a `y` it did not have - keptWord, called before the pool
//     moves the record): the throw is played from where their team was drawn, live or kept.
//   - OFFLINE (no online session at all): the road's rule on the stamp's clock (wagonWarden.js offlineDue) - my save
//     moves, I am told, and the throw is played as above. Online the cell alone throws (a relay before WARDEN_RELAY_MIN
//     throws nothing).
//
// THE FOUR HOSTS (bible/Home.md): scenes/world.js - WIRED (the stamp off its built towns, the word, the cell's two
// words, the offline clock, the show framed, drawn and on the flats' axis, ended at a re-anchor and a load).
// scenes/worldModes.js - its interiors park nothing, and a throw while the player is in one moves the save and is told,
// unplayed (`street()` false). scenes/dungeonContext.js - stands no street.
// scenes/exterior.js - FLAGGED: the single-town bench runs no town watch (its wagon is never stamped nor thrown).
// The streaming host is where towns are played and parked in, online and off.
//
// Not a DFU member. Ledger A (WARDEN1).
import { wardenStamp, validWardenStamp, stampFits, wardenWordOf, offlineDue, footprintRoadShare, landingOf, strayOf, WARDEN_ROAD_SHARE, WARDEN_TEXT } from '../systems/wagonWarden.js';
import { findTownPath, pathLine } from '../systems/livingWorld/townPaths.js';
import { NAV_CELL } from '../world/cityNavigation.js';
import { WAGON_MODE } from '../systems/horseCartLaw.js';

/** How far from the eye a throw is played, metres (past it the team is simply where it landed). */
export const WARDEN_SHOW_REACH = 200;
/** How far back into town the guard sets out from, metres, and how far round a blocked cell it looks for a street. */
export const WARDEN_APPROACH_FROM = 18;
export const WARDEN_CELL_SEARCH = 6;

/**
 * @param {{
 *   hcc: any, runtime: () => any, shows: any, online: () => any,
 *   toWire: (scene: number[]) => number[], toScene: (wire: number[]) => number[],
 *   townAt: (x: number, z: number) => ({ town: number, nav: any, local: number[], toScene: (u: number, v: number) => number[] }|null|undefined),
 *   townName?: (town: number) => string, wallNow?: () => number, eye?: () => (number[]|null), street?: () => boolean,
 *   notify?: (lines: string[]) => void,
 * }} deps  `hcc` the HCC pool; `runtime()` its runtime (adoptYeet, view); `shows` scenes/wagonWardenShow.js's;
 *   `online()` the session or null (offline); `toWire`/`toScene` the pose's frame and back; `townAt(x, z)` the scene's
 *   point in a built town: its map id, its walk grid and the point in its frame (null: built, no watch keeps it;
 *   undefined: not built); `wallNow` the wall clock (ms); `street()` whether the street is up (no throw is played
 *   indoors); `notify` the HUD's lines
 */
export function createWagonWarden({
  hcc, runtime, shows, online, toWire, toScene, townAt, townName = () => '', wallNow = () => Date.now(),
  eye = () => null, street = () => true, notify = () => {},
}) {
  /** @type {any} */
  let stamp = null;

  /** My parked wagon's anchor ([x, z] natives - the save's), or null while none is parked in the world. */
  function anchorOf() {
    const v = runtime()?.view?.();
    const st = v?.state;
    if (!st || v.persistence === false || st.Mode !== WAGON_MODE.Deployed) return null;
    const a = [st.WorldX, st.WorldZ];
    return a.every(Number.isFinite) ? a : null;
  }
  /** The stamp of my wagon parked at `a`, read off the town under it - or undefined while its ground is not built (or
   *  its parts not in). */
  function stampAt(a, now) {
    const st = runtime()?.view?.()?.state;
    const at = toScene([a[0], 0, a[1]]);
    const t = townAt(at[0], at[2]);
    if (t === undefined) return undefined;
    if (t === null) return wardenStamp(a, now);
    const box = hcc.parts?.box ?? null;
    if (!box) return undefined;
    const fl = Math.sqrt((st?.HeadingX ?? 0) ** 2 + (st?.HeadingZ ?? 1) ** 2) || 1;
    const fx = (st?.HeadingX ?? 0) / fl, fz = (st?.HeadingZ ?? 1) / fl;
    // the box's middle: across along the right (fz, -fx), along the forward
    const cx = (box[0] + box[3]) / 2, cz = (box[2] + box[5]) / 2;
    const mid = [t.local[0] + cx * fz + cz * fx, t.local[1] - cx * fx + cz * fz];
    const nav = t.nav;
    const share = footprintRoadShare((gx, gy) => nav.weightAt(gx, gy), nav.width, nav.height, NAV_CELL, mid, [fx, fz], [(box[3] - box[0]) / 2, (box[5] - box[2]) / 2]);
    const land = landingOf([0, 0, nav.width * NAV_CELL, nav.height * NAV_CELL], mid, strayOf(a));
    const s = t.toScene(land[0], land[1]);
    const w = toWire([s[0], 0, s[1]]);
    return wardenStamp(a, now, t.town, share >= WARDEN_ROAD_SHARE, [Math.round(w[0]), Math.round(w[2])]);
  }

  /** The guard's way to `lift` (the scene's [x, z]) from the town's inside (`away` the throw's way): the town's walk grid's,
   *  or null (a straight jog). */
  function approach(lift, away) {
    const t = townAt(lift[0], lift[1]);
    if (!t) return null;
    const nav = t.nav;
    const walkable = (gx, gy) => gx >= 0 && gy >= 0 && gx < nav.width && gy < nav.height && nav.weightAt(gx, gy) > 0;
    const near = (gx, gy) => {
      for (let r = 0; r <= WARDEN_CELL_SEARCH; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (walkable(gx + dx, gy + dy)) return [gx + dx, gy + dy];
      }
      return null;
    };
    const cellOf = (u, v) => [Math.floor(u / NAV_CELL), Math.floor(v / NAV_CELL)];
    const end = near(...cellOf(t.local[0], t.local[1]));
    const start = near(...cellOf(t.local[0] - away[0] * WARDEN_APPROACH_FROM, t.local[1] - away[1] * WARDEN_APPROACH_FROM));
    if (!end || !start) return null;
    const cells = findTownPath(nav, start, end, { maxExpansions: 6000 });
    if (!cells || cells.length < 2) return null;
    const pts = pathLine(cells).pts.map((p) => t.toScene(p[0], p[1]));
    pts.push([lift[0], lift[1]]);
    return pts;
  }

  const near = (at) => { const e = eye(); return !!e && !!at && Math.sqrt((e[0] - at[0]) ** 2 + (e[2] - at[2]) ** 2) <= WARDEN_SHOW_REACH; };
  /** The throw played over a team drawn under any of `owners` (the first drawn) - answers whether it began. */
  function play(key, owners, landing) {
    if (!street()) return false;
    let snap = null;
    for (const o of owners) { snap = hcc.teamSnapshot?.(o) ?? null; if (snap) break; }
    if (!snap || !near(snap.at)) return false;
    return shows.start({ key, owners, snap, origin: toWire(snap.at), landing, approach });
  }
  /** MY wagon thrown from `from` to `to` ([x, z] natives): played if drawn near, my save moved, and I am told. */
  function throwMine(from, to) {
    const rt = runtime();
    const town = stampFits(stamp, anchorOf()) && stamp.tw !== null ? townName(stamp.tw) : '';
    const snap = street() ? hcc.teamSnapshot?.('') ?? null : null;   // read before the save moves it
    if (!rt?.adoptYeet?.(from, to)) return false;
    if (snap && near(snap.at)) shows.start({ key: 'mine', owners: [''], snap, origin: toWire(snap.at), landing: to, approach });
    notify([WARDEN_TEXT.thrown(town), WARDEN_TEXT.fetch]);
    return true;
  }

  return {
    /** One frame: my wagon's stamp kept, and offline, the watch's road clock. */
    tick() {
      const a = anchorOf();
      if (!a) return;
      if (!stampFits(stamp, a)) { const s = stampAt(a, wallNow()); if (s) stamp = s; }
      if (!online() && offlineDue(stamp, a, wallNow())) throwMine(a, stamp.ly);
    },
    /** The park word's watch fields for my wagon parked at `anchor` (horseCartPool setWardenWord). */
    word: (/** @type {number[]} */ anchor) => wardenWordOf(stamp, anchor),
    /** The cell threw my team (online.js onParkYeet). */
    onParkYeet(/** @type {string} */ room, /** @type {{at: number, from: number[], to: number[]}} */ y) {
      if (!y) return false;
      return throwMine(y.from, y.to);
    },
    /** A cell's word about another's team, BEFORE the pool takes it (online.js onPark): a throw it had not said is played
     *  from where their team is drawn. */
    keptWord(/** @type {string} */ room, /** @type {any} */ e) {
      if (!e || typeof e.k !== 'string' || !Number.isFinite(e.y) || !Array.isArray(e.r?.ly)) return false;
      for (const x of hcc.kept?.values?.() ?? []) if (x.k === e.k && x.y === e.y) return false;   // said already
      const key = `kept:${e.k}`;
      if (shows.playing(key)) return false;
      return play(key, [e.id, hcc.keptOwner(e.k)], e.r.ly);
    },
    /** The save's record: the stamp (systems/modSaveData.js). */
    getSaveData: () => (stamp ? { a: [...stamp.a], at: stamp.at, tw: stamp.tw, rd: stamp.rd, ly: stamp.ly ? [...stamp.ly] : null } : null),
    restoreSaveData(/** @type {any} */ rec) { stamp = validWardenStamp(rec); },
    get stamp() { return stamp; },
  };
}
