// @ts-check
// WB14f (2026-10-19, Mac: "And whatever else you can cook up"; bible/11-Multiplayer/Breach-Portents.md section 7): THE CAPTIVE
// ON MY SCREEN - a knight of the Covenant (the day's own, net/gate/gateLaw.js captiveNameOf) on his knees at the Pen's heart,
// chained to his gaolers: the relay's host bodies of kind 7, seen, heard and struck as his host is (scenes/gate/gateHost.js).
// The last one down, the knight stands free in the Covenant's gold until his ward takes a Dagon's Reckoning (the relay's `cp`,
// net/gate/gateBrain.js wardTakes), then is gone back through the breach. Here: his body (world/gate/gateBoss.js knightLookOf,
// knightAct), his chains, his glow, the gold at his freeing and at his going, the warded Reckoning's telegraph in the ward's
// gold (`dress`), and the Captive's words. The Reckoning the ward takes is spared on my feet by the court's own judge
// (scenes/gate/gateCourt.js judge).
//
// Not a DFU member. Ledger A (WB).
import { ATTACKS, COURTS, FLOOR, HOST, HOST_GONE, captiveSpent, wardTakes } from '../../net/gate/gateBrain.js';
import { captiveIndexOf, captiveNameOf } from '../../net/gate/gateLaw.js';
import { CAPTIVE_DAMES } from '../../net/gate/gateMods.js';
import { attackColor, bossFrame, knightAct, knightLookOf, WARD_COLOR } from '../../world/gate/gateBoss.js';
import { courtToDungeon } from '../../world/gate/gateArena.js';
import { TELEGRAPH_KIND, TELEGRAPH_STYLE, TELEGRAPH_POOL, TELEGRAPH_EDGE_SAFE } from '../../render/gate/gateTelegraph.js';
import { mobileBillboardSize } from '../../world/rmbFlats.js';
import { t } from '../../systems/textManager.js';

/** The Captive's moments, said while they are news (the court's FED_LATE_MS's law). */
export const CAPTIVE_LATE_MS = 2000;
/** His ward spent, he stands this long in its gold, then is gone. */
export const CAPTIVE_GONE_MS = 1500;
/** His glow while he stands free: its reach (m) and its height over his feet. */
export const CAPTIVE_LIGHT_RANGE = 8;
export const CAPTIVE_LIGHT_Y = 1.4;
/** His chains on the floor: how wide, and how strong (they are what holds him, not what lands). */
export const CAPTIVE_CHAIN_HALF_W = 0.3;
export const CAPTIVE_CHAIN_ALPHA = 0.55;
/** The Captive's words - each the event and the order (WB13b), read through the text core (L10N4). */
export const CAPTIVE_TEXT = Object.freeze({
  chained: (name) => t('gate.captive.chained', '{name} of the Covenant lies chained in the Pen. Cut down the gaolers!', { name }),
  felled: (who, n) => t('gate.captive.felled', '{who} cuts down a gaoler. {n, plural, one {# stands} other {# stand}}.', { who: who || t('gate.host.someone', 'A challenger'), n }),
  freed: (name) => t('gate.captive.freed', '{name} is free! The Covenant\'s ward stands over the court.', { name }),
  ward: (name) => t('gate.captive.ward', '{name} raises the Covenant\'s ward against Dagon\'s Reckoning!', { name }),
  spent: (name) => t('gate.captive.spent', 'Dagon\'s Reckoning breaks on the Covenant\'s ward. {name} goes back through the breach.', { name }),
});

/** Where the knight kneels - the Pen's heart (the court's frame) - and his facing, toward the first court. */
export const CAPTIVE_AT = COURTS[FLOOR.pen];
export const CAPTIVE_YAW = Math.atan2(COURTS[FLOOR.first][0] - CAPTIVE_AT[0], COURTS[FLOOR.first][1] - CAPTIVE_AT[1]);
/** Is the knight on the floor at `now` - his gaolers risen, and not yet gone after his ward? Pure. */
export function captiveShown(s, now) {
  const K = s?.cp;
  if (!K || !(K.at > 0) || s.fell || s.wrath != null) return false;
  const spent = captiveSpent(K, s.atk, now);
  return !spent || now < (K.s > 0 ? K.s : s.atk?.at ?? now) + CAPTIVE_GONE_MS;
}

/**
 * THE CHAINS on the floor at `now`, in the telegraph pass's own shape (render/gate/gateTelegraph.js - the court's frame): from
 * each gaoler standing to the knight, in Dagon's crimson, while he is chained. At most `max`. Pure.
 * @param {any} s the court's state (net/gate/gateLink.js) @param {number} now @param {any[]} [out] refilled @param {number} [max]
 */
export function captiveChains(s, now, out = [], max = 4) {
  out.length = 0;
  const K = s?.cp;
  if (!K || !(K.at > 0) || K.f > 0 || s.fell || s.wrath != null) return out;
  const color = attackColor(ATTACKS.reckon, null), seethe = (now % 60_000) / 1000;
  let slots = CHAIN_SLOTS.get(out);
  if (!slots) CHAIN_SLOTS.set(out, (slots = []));
  for (const a of s.lg?.ads ?? []) {
    if (out.length >= max) break;
    if (a.k !== HOST.gaoler) continue;
    // AUDIT WB14 (SCREEN-10): each chain its slot, refilled whole (gateHost's law - AUDIT WB11 C8)
    const sh = (slots[out.length] ??= { kind: TELEGRAPH_KIND.lane, origin: [0, 0], yaw: 0, r: 0, halfArc: 0, body: 0, end: [CAPTIVE_AT[0], CAPTIVE_AT[1]], halfW: CAPTIVE_CHAIN_HALF_W,
      r0: 0, r1: 0, points: [], n: 0, t: 1, flash: 0, alpha: CAPTIVE_CHAIN_ALPHA, color, edge: color, court: FLOOR.pen, style: TELEGRAPH_STYLE.weight,
      since: 0, span: 1, after: -1, runS: 0, pool: TELEGRAPH_POOL.path });
    sh.origin[0] = a.x; sh.origin[1] = a.z; sh.color = color; sh.edge = color; sh.since = seethe;   // (a gaoler never walks)
    out.push(sh);
  }
  return out;
}
/** AUDIT WB14 (SCREEN-10): the chains' slots, by the list the court refills. */
const CHAIN_SLOTS = new WeakMap();

/**
 * @param {{ renderer?: any, getTexture?: any, uploadRecordFrame?: any, cam?: () => any, say?: (text: string) => void,
 *   burst?: (at: number[], t: number) => void }} deps
 *   the court's own doors: its sprites (the renderer, a texture by archive, a record's frame uploaded), its camera, its
 *   words, and a gold burst at a place (the dungeon's frame) from a moment (the relay's clock).
 */
export function createGateCaptive({ renderer = null, getTexture = null, uploadRecordFrame = null, cam = () => null, say = () => {}, burst = () => {} } = {}) {
  /** the fight this driver is on (its day); what it has said; its body - its look, its texture once loaded, its batch */
  let day = null, chainedSaid = false, freedSaid = false, spentSaid = false, wardSaid = -1;
  const goneSeen = new Set();
  let look = null, body = null, loading = null, batch = null, shown = false;
  const _batches = [], _lights = [], _shapes = [];
  const _light = { x: 0, y: 0, z: 0, range: CAPTIVE_LIGHT_RANGE, color: [0, 0, 0] };

  function reset(d) {
    day = d; chainedSaid = false; freedSaid = false; spentSaid = false; wardSaid = -1;
    goneSeen.clear();
    if (batch) { renderer?.destroyBillboardBatch?.(batch); batch = null; }
    shown = false;
    _batches.length = 0; _lights.length = 0; _shapes.length = 0;   // AUDIT WB14 (SCREEN-4): nothing of his handed on after the court - the host asks for them every frame, and no frame of the court's refills them once I have left
  }
  /** The knight's look for the day - a Dame drawn as Daggerfall's woman knight, her own archive. */
  function loadBody(d) {
    const want = knightLookOf(!!CAPTIVE_DAMES[captiveIndexOf(d)]);
    if (look && look.archive !== want.archive) { body = null; loading = null; if (batch) { renderer?.destroyBillboardBatch?.(batch); batch = null; } }
    look = want;
    if (body || loading || !getTexture || !uploadRecordFrame || !renderer?.createBillboardBatch || !look.archive) return;
    const archive = look.archive;
    loading = Promise.resolve().then(() => getTexture(archive)).then((tex) => {
      if (look?.archive === archive) body = tex ? { tex, archive } : { failed: true };
    }, () => { body = { failed: true }; });
  }
  function drawBody(s, now) {
    loadBody(s.day);
    if (!body?.tex) { shown = false; return; }
    const act = /** @type {any} */ (knightAct(s.cp.f > 0, now)), at = courtToDungeon(CAPTIVE_AT[0], 0, CAPTIVE_AT[1]), eye = cam() ?? at;   // (bossFrame reads an act's anims, frame and loop alone)
    const fr = bossFrame(act, CAPTIVE_YAW, at, eye, (r) => body.tex.getFrameCount?.(r) ?? 1);
    const rkey = `${fr.record}#${fr.frame}`;
    if (!renderer.textures?.has?.(`${body.archive}_${rkey}`)) uploadRecordFrame(body.archive, fr.record, fr.frame);
    const sz = mobileBillboardSize(body.tex, fr.record);
    if (!batch) { batch = renderer.createBillboardBatch(body.archive, rkey, { w: sz.w, h: sz.h }, [[0, 0, 0]]); batch.origin = [0, 0, 0]; }
    shown = true;
    batch.record = rkey;
    batch.size = { w: fr.flip ? -sz.w : sz.w, h: sz.h };
    if (batch.bounds) batch.bounds[3] = Math.hypot(sz.w, sz.h) * 0.5;
    batch.origin[0] = at[0]; batch.origin[1] = at[1]; batch.origin[2] = at[2];
  }
  /** The Captive's moments, said while they are news: his chains (as his gaolers rise), each gaoler cut down and how many
   *  stand, his freeing (and its gold), his ward taking a Reckoning, the Reckoning breaking on it (and his going). */
  function words(s, now) {
    const K = s.cp, name = captiveNameOf(s.day), live = !s.fell && s.wrath == null;
    if (!chainedSaid && K.at > 0) { chainedSaid = true; if (live && now - K.at <= CAPTIVE_LATE_MS) say(CAPTIVE_TEXT.chained(name)); }
    // a gaoler cut down: how many stand counted down as each falls (gateHost's law - AUDIT WB11 C3), the last one said by
    // his freeing instead
    let left = 0;
    for (const a of s.lg?.ads ?? []) if (a.k === HOST.gaoler) left++;
    const fresh = [];
    for (const g of s.lg?.gone ?? []) if (g.k === HOST.gaoler && g.w === HOST_GONE.slain && !goneSeen.has(`${g.i}@${g.at}`)) { goneSeen.add(`${g.i}@${g.at}`); fresh.push(g); }
    left += fresh.length;
    for (const g of fresh) { left--; if (live && left > 0 && now - g.at <= CAPTIVE_LATE_MS) say(CAPTIVE_TEXT.felled(g.n, left)); }
    if (!freedSaid && K.f > 0) {
      freedSaid = true;
      if (live && now - K.f <= CAPTIVE_LATE_MS) { say(CAPTIVE_TEXT.freed(name)); burst(courtToDungeon(CAPTIVE_AT[0], 1, CAPTIVE_AT[1]), K.f); }
    }
    if (wardTakes(K, s.atk) && wardSaid !== s.atk.i) { wardSaid = s.atk.i; if (live && now < s.atk.at) say(CAPTIVE_TEXT.ward(name)); }
    if (!spentSaid && captiveSpent(K, s.atk, now)) {
      spentSaid = true;
      const at = K.s > 0 ? K.s : s.atk?.at ?? now;
      if (live && now - at <= CAPTIVE_LATE_MS) { say(CAPTIVE_TEXT.spent(name)); burst(courtToDungeon(CAPTIVE_AT[0], 1, CAPTIVE_AT[1]), at); }
    }
  }

  return {
    /** One frame: the Captive's words, his body, his glow while free and his chains while held - none on a night without
     *  him. @param {any} s the court's state @param {number} now the relay's clock */
    frame(s, now) {
      _batches.length = 0; _lights.length = 0; _shapes.length = 0;
      if (!s || s.day === null || !s.cp) { if (day !== null) reset(null); return; }
      if (s.day !== day) reset(s.day);
      words(s, now);
      if (!captiveShown(s, now)) { shown = false; return; }
      drawBody(s, now);
      if (shown && batch) _batches.push(batch);
      if (s.cp.f > 0) {
        const k = 0.85 + 0.2 * Math.sin(now / 220);
        const [x, y, z] = courtToDungeon(CAPTIVE_AT[0], CAPTIVE_LIGHT_Y, CAPTIVE_AT[1]);
        _light.x = x; _light.y = y; _light.z = z;
        _light.color[0] = WARD_COLOR[0] * k; _light.color[1] = WARD_COLOR[1] * k; _light.color[2] = WARD_COLOR[2] * k;
        _lights.push(_light);
      }
      captiveChains(s, now, _shapes);
    },
    /** THE WARDED RECKONING drawn in the Covenant's gold - its fill the ward's, its line the safe edge: it lands on the ward.
     *  The court's shape for his attack in flight, changed in place (none changed but the Reckoning the ward takes). */
    dress(shape, s) {
      if (!shape || !wardTakes(s?.cp, s?.atk)) return shape;
      shape.color = WARD_COLOR; shape.edge = TELEGRAPH_EDGE_SAFE; shape.style = TELEGRAPH_STYLE.weight;
      return shape;
    },
    /** His body, his glow, his chains - for the court's billboard pass, its lights and its telegraph pass. */
    batches: () => _batches,
    lights: () => _lights,
    shapes: () => _shapes,
    /** What the driver holds, for the tests. */
    state: () => ({ day, shown, chainedSaid, freedSaid, spentSaid, wardSaid }),
    /** Out of the court: his body put away and the fight forgotten. */
    leave() { reset(null); },
  };
}
