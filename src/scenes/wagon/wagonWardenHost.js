// @ts-check
// WARDEN1 (systems/wagon/wagonWarden.js - the law; scenes/wagon/wagonWardenShow.js - the throw played; net/wire.js WARDEN1 - the
// cell's clock): THE TOWN WATCH IN THE STREETS' HOST.
//
// MY WAGON'S STAMP: every frame the save's parked wagon is read (the HCC runtime's view - its anchor, natives); a wagon
// parked somewhere new is stamped once the ground under it is built (`townAt` - undefined while its pixel is not: asked
// again the next frame) - its town (a city's, a hamlet's or a village's, read off the built pixel), whether it stands on
// the town's road (its box over the town's walk grid) and where a throw lands (out through the town's nearest edge).
// The stamp rides the save (WARDEN_VENDOR), so the offline clock outlives a load.
// THE WORD: my park word carries the stamp's fields (horseCartPool setWardenWord) - the cell throws on them.
// THE THROWS:
//   - The cell's word to me (`parkYeet`, online.js onParkYeet - of MY character's team, `k`): kept until the next street
//     frame (AUDIT WARDEN1 C4 - one that came in a door's load wiped the horse left at the door, and one in my caravan's
//     room let me out onto empty ground), then my save moves to the landing (systems/horse/horseCart.js adoptYeet) and I am
//     told; the throw is played where my wagon was drawn, within WARDEN_SHOW_REACH of the eye.
//   - The cell's word about another's team (a park word with a `y` it did not have - keptWord, called before the pool
//     moves the record): the throw is played from where their team was drawn - live where their live wagon stands on the
//     spot thrown from, else the cell's kept one (AUDIT WARDEN1 C9).
//   - OFFLINE (no online session at all): the road's rule on the stamp's clock (wagonWarden.js offlineDue) - my save
//     moves, I am told, and the throw is played as above. Online the cell alone throws (a relay before WARDEN_RELAY_MIN
//     throws nothing).
// A throw lifts the team the throw moves - the wagon, its horses in harness and a horse standing by it (horseThrownWith),
// never one following me or left further off (AUDIT WARDEN1 C2) - and ends at once when its team is no longer the one
// thrown (summoned, driven off or moved since - AUDIT WARDEN1 C7: a summoned wagon stayed held, drawn nowhere).
//
// THE FOUR HOSTS (bible/Home.md): scenes/world.js - WIRED (the stamp off its built towns, the word, the cell's two
// words, the offline clock, the show framed, drawn and on the flats' axis, ended at a re-anchor and a load).
// scenes/worldModes.js - its interiors park nothing; indoors online the player holds no socket on the wagon's cell, so a
// throw made then is told as they step out and re-say the spot (and played, on the street), and offline the clock runs
// on the street alone (AUDIT WARDEN1 D2). scenes/dungeonContext.js - stands no street.
// scenes/exterior.js - FLAGGED: the single-town bench runs no town watch (its wagon is never stamped nor thrown).
// The streaming host is where towns are played and parked in, online and off.
//
// Not a DFU member. Ledger A (WARDEN1).
import { wardenStamp, validWardenStamp, stampFits, wardenWordOf, offlineDue, footprintRoadShare, landingsOf, strayOf, horseThrownWith, WARDEN_ROAD_SHARE, WARDEN_SAME_NATIVES, WARDEN_TEXT } from '../../systems/wagon/wagonWarden.js';
import { findTownPath, pathLine } from '../../systems/livingWorld/townPaths.js';
import { NAV_CELL } from '../../world/city/cityNavigation.js';
import { WAGON_MODE, HORSE_MODE } from '../../systems/horse/horseCartLaw.js';
import { mapPixelOfWire, cellRoomOfWire, parkSpotOf } from '../../net/wire.js';

/** How far from the eye a throw is played, metres (past it the team is simply where it landed). */
export const WARDEN_SHOW_REACH = 200;
/** How far back into town the guard sets out from, metres, and how far round a blocked cell it looks for a street. */
export const WARDEN_APPROACH_FROM = 18;
export const WARDEN_CELL_SEARCH = 6;

/**
 * WARDEN1 x AUDIT WARDEN1 (D3): THE TOWN A WATCH KEEPS UNDER A SCENE POINT - the streaming host's built pixels (`built`, each
 * `{ px, py, wardenTown, locOrigin, population: { nav } }` as world.js builds them) placed by `translate(px, py)` (the
 * scene's corner of a pixel, `size` metres a side): `{ town, nav, local, toScene }` in a town a watch keeps - its map id,
 * its walk grid, the point in the location frame (the grid's) and that frame's point back in the scene; null on built
 * ground no watch keeps (or past the town's blocks); undefined where nothing is built. Pure.
 * @param {Iterable<any>} built @param {(px: number, py: number) => number[]} translate @param {number} size
 * @param {number} x @param {number} z
 */
export function wardenTownIn(built, translate, size, x, z) {
  let ground = false;
  for (const p of built) {
    const t = translate(p.px, p.py);
    if (x < t[0] || z < t[2] || x >= t[0] + size || z >= t[2] + size) continue;
    ground = true;
    const nav = p.wardenTown != null && p.locOrigin ? p.population?.nav : null;
    if (!nav) continue;
    const ox = t[0] + p.locOrigin[0], oz = t[2] + p.locOrigin[2], u = x - ox, v = z - oz;
    if (u < 0 || v < 0 || u >= nav.width * NAV_CELL || v >= nav.height * NAV_CELL) continue;
    return { town: p.wardenTown, nav, local: [u, v], toScene: (/** @type {number} */ a, /** @type {number} */ b) => [a + ox, b + oz] };
  }
  return ground ? null : undefined;
}

/**
 * @param {{
 *   hcc: any, runtime: () => any, shows: any, online: () => any,
 *   toWire: (scene: number[]) => number[], toScene: (wire: number[]) => number[],
 *   townAt: (x: number, z: number) => ({ town: number, nav: any, local: number[], toScene: (u: number, v: number) => number[] }|null|undefined),
 *   townName?: (town: number) => string, wallNow?: () => number, eye?: () => (number[]|null), street?: () => boolean,
 *   notify?: (lines: string[]) => void, myKey?: () => (string|null), thrown?: () => void,
 * }} deps  `hcc` the HCC pool; `runtime()` its runtime (adoptYeet, view); `shows` scenes/wagon/wagonWardenShow.js's;
 *   `online()` the session or null (offline); `toWire`/`toScene` the pose's frame and back; `townAt(x, z)` the scene's
 *   point in a built town (wardenTownIn): its map id, its walk grid and the point in its frame (null: built, no watch
 *   keeps it; undefined: not built); `wallNow` the wall clock (ms); `street()` whether the street is up (no throw is
 *   played indoors); `notify` the HUD's lines; `myKey()` my character's park key (net/wire.js parkKeyOf), or null while
 *   it is worked out
 */
export function createWagonWarden({
  hcc, runtime, shows, online, toWire, toScene, townAt, townName = () => '', wallNow = () => Date.now(),
  eye = () => null, street = () => true, notify = () => {}, myKey = () => null,
  thrown = () => {},   // WAGONS4: my wagon was thrown - the host's upkeep wears it (systems/wagon/wagonUpkeep.js THROWN_WEAR)
}) {
  /** @type {any} */
  let stamp = null;
  /** The cell's throws of my team not yet taken (C4): adopted at the next street frame (tick). @type {any[]} */
  const pending = [];

  /** My parked wagon's anchor ([x, z] natives - the save's), or null while none is parked in the world (or the Horse
   *  Cart and Cargo mod is off - AUDIT WARDEN1 C5: the offline watch threw a wagon the pool drew nowhere). */
  function anchorOf() {
    if (hcc.enabled === false) return null;
    const v = runtime()?.view?.();
    const st = v?.state;
    if (!st || v.persistence === false || st.Mode !== WAGON_MODE.Deployed) return null;
    const a = [st.WorldX, st.WorldZ];
    return a.every(Number.isFinite) ? a : null;
  }
  /** Whether my horse goes with my wagon parked at `a` (natives): one left standing by it (a horse in its shafts is the
   *  team's own - teamSnapshot's `hitched`). */
  function myHorseThrown(a) {
    const st = runtime()?.view?.()?.state;
    return !!st && st.HorseMode === HORSE_MODE.LooseStationary && horseThrownWith(a, [st.HorseWorldX, st.HorseWorldZ]);
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
    // AUDIT WARDEN1 R6: out through the nearest edge whose landing keeps the team in its own map pixel (a parked wagon
    // is drawn in its owner's pixel alone - systems/horse/horseCart.js), else in its own cell (a word from another cell's
    // ground drops the cell's record: the readers' team went as it landed), else the nearest
    const lands = landingsOf([0, 0, nav.width * NAV_CELL, nav.height * NAV_CELL], mid, strayOf(a)).map((l) => {
      const sc = t.toScene(l[0], l[1]), w = toWire([sc[0], 0, sc[1]]);
      return [Math.round(w[0]), Math.round(w[2])];
    });
    const px = mapPixelOfWire(a[0], a[1]), cell = cellRoomOfWire(a[0], a[1]);
    const ly = lands.find((l) => { const q = mapPixelOfWire(l[0], l[1]); return q[0] === px[0] && q[1] === px[1]; })
      ?? lands.find((l) => cellRoomOfWire(l[0], l[1]) === cell) ?? lands[0];
    return wardenStamp(a, now, t.town, share >= WARDEN_ROAD_SHARE, ly);
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
  /** Whether a snapshot's wagon (the scene's) stands on the spot `spot` ([x, z] natives) a throw names. */
  const onSpot = (snap, spot) => { if (!snap || !spot) return false; const w = toWire(snap.at); return Math.abs(w[0] - spot[0]) <= WARDEN_SAME_NATIVES && Math.abs(w[2] - spot[1]) <= WARDEN_SAME_NATIVES; };
  /** MY wagon thrown from `from` to `to` ([x, z] natives): played if drawn near, my save moved, and I am told. */
  function throwMine(from, to) {
    const rt = runtime();
    const was = anchorOf();
    const town = stampFits(stamp, was) && stamp.tw !== null ? townName(stamp.tw) : '';
    const snap = street() && was ? hcc.teamSnapshot?.('', myHorseThrown(was)) ?? null : null;   // read before the save moves it
    if (!rt?.adoptYeet?.(from, to)) return false;
    const landed = anchorOf();
    // C7: played while the save still parks it where the throw put it
    const alive = () => { const a = anchorOf(); return !!a && !!landed && Math.abs(a[0] - landed[0]) <= WARDEN_SAME_NATIVES && Math.abs(a[1] - landed[1]) <= WARDEN_SAME_NATIVES; };
    if (snap && near(snap.at)) shows.start({ key: 'mine', owners: [''], snap, origin: toWire(snap.at), landing: to, approach, alive });
    notify([WARDEN_TEXT.thrown(town), WARDEN_TEXT.fetch]);
    thrown();   // WAGONS4: a wagon thrown is a wagon knocked about
    return true;
  }

  return {
    /** One frame of the street (never under a load - the host's gate): my wagon's stamp kept, the cell's throws of my team
     *  taken, and offline, the watch's road clock. */
    tick() {
      while (pending.length) { const y = pending.shift(); throwMine(y.from, y.to); }
      const a = anchorOf();
      if (!a) return;
      if (!stampFits(stamp, a)) { const s = stampAt(a, wallNow()); if (s) stamp = s; }
      if (!online() && offlineDue(stamp, a, wallNow())) throwMine(a, stamp.ly);
    },
    /** The park word's watch fields for my wagon parked at `anchor` (horseCartPool setWardenWord). */
    word: (/** @type {number[]} */ anchor) => wardenWordOf(stamp, anchor),
    /** The cell threw my team (online.js onParkYeet): kept for the next street frame - one of another character's team
     *  (`k` not mine) is not mine to take. Answers whether it was kept. */
    onParkYeet(/** @type {string} */ room, /** @type {{at: number, from: number[], to: number[], k?: string|null}} */ y) {
      if (!y) return false;
      const k = myKey();
      if (y.k && k && y.k !== k) return false;
      if (pending.some((p) => p.at === y.at && p.from[0] === y.from[0] && p.from[1] === y.from[1])) return false;
      pending.push({ at: y.at, from: [y.from[0], y.from[1]], to: [y.to[0], y.to[1]] });
      return true;
    },
    /** A cell's word about another's team, BEFORE the pool takes it (online.js onPark): a throw it had not said is played
     *  from where their team is drawn - their live wagon where it stands on the spot thrown from, else the cell's kept one
     *  - and ends once the cell says it moved (its kept word thrown no more). */
    keptWord(/** @type {string} */ room, /** @type {any} */ e) {
      if (!e || typeof e.k !== 'string' || !Number.isFinite(e.y) || !Array.isArray(e.r?.ly) || !Array.isArray(e.r?.w)) return false;
      for (const x of hcc.kept?.values?.() ?? []) if (x.k === e.k && x.y === e.y) return false;   // said already
      const key = `kept:${e.k}`;
      if (shows.playing(key) || !street()) return false;
      const spot = parkSpotOf(e.r), horse = Array.isArray(e.r.h) && horseThrownWith(spot, [e.r.h[0], e.r.h[2]]);
      const live = typeof e.id === 'string' ? hcc.teamSnapshot?.(e.id, horse) ?? null : null;
      const kept = hcc.keptOwner(e.k);
      const [snap, owners] = onSpot(live, spot) ? [live, [e.id, kept]] : [hcc.teamSnapshot?.(kept, horse) ?? null, [kept]];
      if (!snap || !near(snap.at)) return false;
      const alive = () => { for (const x of hcc.kept?.values?.() ?? []) if (x.k === e.k && x.y === e.y) return true; return false; };
      return shows.start({ key, owners, snap, origin: toWire(snap.at), landing: e.r.ly, approach, alive });
    },
    /** The save's record: the stamp (systems/modSaveData.js). */
    getSaveData: () => (stamp ? { a: [...stamp.a], at: stamp.at, tw: stamp.tw, rd: stamp.rd, ly: stamp.ly ? [...stamp.ly] : null } : null),
    restoreSaveData(/** @type {any} */ rec) { stamp = validWardenStamp(rec); pending.length = 0; },
    get stamp() { return stamp; },
  };
}
