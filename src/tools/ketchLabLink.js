// @ts-check
// KETCH-LOOK KL3 (bible/11-Multiplayer/Sky-Ketch-Look.md section 17, "How it is built"): THE LAB'S FAKE LINK - the ship's
// state as her room would say it, written by the lab's knobs. A whole state (`st`) made of the relay's own pieces - the
// Warden's brain's fight (net/ketch/ketchWarden.js newWardenFight, its fighters joined, wardenStateOf's word) and its blows
// begun as its beat begins them (labBlow - the brain's `begin` and `clockBlow` made of the same shapes; its test holds the
// two to one blow) - passed through the wire's own projection (net/wire.js validKetchOut) and folded as the page
// folds it (net/ketch/ketchLink.js foldKetch): the lab draws what the game draws, and a knob can shape nothing the room
// could not. Pure but for the clock it is handed (`now`, the lab's ms).
//
//   ?stage=0-5          the voyage's stage (KT_STAGE; a fight stands at the bridge, 4, unless a later one is asked)
//   ?cr=<6>  ?br=<2>    the cradles, the hold's and the bridge's: 1 charged, 0 just taken, else seconds until charged
//   ?bk=&nd=            the engine's banked cells and its need (its sockets the first `bk`)
//   ?lo=<id>:<s>,...    loose cells, each its seconds until it is lost, laid down the hold's aisle
//   ?carry=<n>          cells carried by the crew
//   ?wv=0-3             the Watch's wave
//   ?fight=<name>       the Warden's fight (KT_LAB_FIGHTS), with its companions: &age=<s> since it woke (fell, for
//                       `fell`); &wt=<share> of a blow's wind-up done; &rs=a,b,c,d the resonators (1 true); &da=<s> the
//                       Discord's mark this far off; &su=<s> stunned this much longer; &st=<s> the song this far in;
//                       &forks=<n>:<h,...> the forks raised, each its health of 100; &sec=<k>:<s>,... a section falling in
//                       s (gone -s ago); &left=<s> the fight's end this far off
//   ?sec=<k,k>&secAt=<s> ?forks   (KL0) the older words: sections fallen at the lab's second `secAt` (half a second ago
//                       without it), forks raised - at stage 4 each stands its fight (`sections`, `song`)
//
// A tools page's: nothing of it ships in the game's own entry. Ledger A (KETCH).
import { KT_STAGE } from '../net/ketch/ketchLaw.js';
import { KT_BRIDGE, KT_HOLD, KT_WARDEN_HOME } from '../net/ketch/ketchDeck.js';
import { newWardenFight, joinWarden, wardenStateOf, KW_BLOWS, KW_BODY, KW_FAST, KW_ID, KW_OPENING_MS, KW_SECTION_GONE_MS } from '../net/ketch/ketchWarden.js';
import { egBlowOf, egFloorWindup, shDisc, shLaneAt, shCone, shRing, shAll } from '../net/eliteGates/egShape.js';
import { KT_CRADLE_BACK_MS } from '../net/ketch/ketchBrain.js';
import { validKetchOut } from '../net/wire.js';
import { foldKetch, KT_EMPTY } from '../net/ketch/ketchLink.js';

/** The fights `?fight=` stands (section 17's knob table, in the fight's order). */
export const KT_LAB_FIGHTS = Object.freeze(['asleep', 'wake', 'keel', 'lash', 'ring', 'wave', 'discord', 'tuned', 'song', 'landed', 'broken', 'stun', 'sections', 'west', 'fell']);
/** The lab's crew (four fighters, the Warden's health theirs); the relay's clock at the lab's second 0 (ms - every time
 *  a knob writes stands after the voyage's own start, AGO before it). */
export const KT_LAB_CREW = 4;
export const KT_LAB_EPOCH = 1_000_000;
const AGO = 60_000;

const num = (v, d) => { const x = v == null || v === '' ? NaN : Number(v); return Number.isFinite(x) ? x : d; };
const list = (v) => (v ?? '').split(',').filter((x) => x !== '').map(Number).filter(Number.isFinite);
const pairs = (v) => (v ?? '').split(',').map((e) => e.split(':').map(Number)).filter((q) => q.length === 2 && q.every(Number.isFinite));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** A cradle's word: 1 charged; else the ms it is charged again (0 - just taken - a whole wait off). */
const spotAt = (v, now) => (v === 1 ? 1 : now + Math.round((v === 0 ? KT_CRADLE_BACK_MS / 1000 : clamp(v, 0, KT_CRADLE_BACK_MS / 1000)) * 1000));

/**
 * A BLOW OF THE WARDEN'S begun at `now` into fight `f`, as its beat begins one: its own (`keel`, `lash`, `ring` and the
 * ring's Tonal Wave - turned to `target`, its wind-up floored) or the whole bridge's (`discord`, `song`, `west`). The relay's
 * own code is its law (net/ketch/ketchWarden.js begin, clockBlow - a relay file a lab may not edit: every byte of it is a
 * deploy); the lab's test holds this to the blow the brain makes.
 * @param {any} f @param {keyof typeof KW_BLOWS} key @param {number} now @param {{ x: number, z: number } | null} target
 */
export function labBlow(f, key, now, target = null) {
  const A = /** @type {any} */ (KW_BLOWS[key]), W = f.wd;
  if (A.sh === 'all') { f.blows.push({ ...egBlowOf({ i: ++f.seq, o: 0, s: [shAll()], at: now + A.wu, wu: A.wu, p: A.p, b: A.b, el: A.el, nm: A.name, ch: 1 }), y: KT_BRIDGE.y, a: A.a }); return; }
  if (target) W.yw = Math.atan2(target.x - W.x, target.z - W.z);
  const s = A.sh === 'lane' ? [shLaneAt(W.x, W.z, W.yw, KW_BODY.r + A.len, A.w)] : A.sh === 'cone' ? [shCone(W.x, W.z, W.yw, A.r, A.arc)] : [shDisc(W.x, W.z, A.r)];
  const wu = egFloorWindup(Math.round(A.wu * (KW_FAST[f.phase - 1] ?? 1)), s);
  const blow = { ...egBlowOf({ i: ++f.seq, o: KW_ID, s, at: now + wu, wu, p: A.p, b: A.b, el: A.el, nm: A.name }), y: KT_BRIDGE.y, a: A.a };
  f.blows.push(blow);
  if (A.wave) { const V = A.wave; f.blows.push({ ...egBlowOf({ i: ++f.seq, o: KW_ID, s: [shRing(W.x, W.z, A.r, V.r1)], at: blow.at + V.after, wu: blow.wu + V.after, p: V.p, b: V.b, el: null, nm: V.name }), y: KT_BRIDGE.y, a: A.a, jp: 1 }); }
}

/** THE WARDEN'S FIGHT `name` as its brain would hold it at `now`, said as the wire says it (wardenStateOf). */
function labFight(p, name, now) {
  const age = Math.max(0, num(p.get('age'), 0)) * 1000, wt = clamp(num(p.get('wt'), 0.5), 0, 1);
  const op = name === 'asleep' ? now + KW_OPENING_MS * (1 - wt) : name === 'wake' ? now - age : now - AGO;
  const f = newWardenFight('kt:lab', 1, op - KW_OPENING_MS);
  for (let k = 0; k < KT_LAB_CREW; k++) joinWarden(f, `lab${k}`, `Lab ${k}`, 40, op - KW_OPENING_MS);
  const late = ['song', 'landed', 'broken', 'sections', 'west', 'fell'].includes(name), mid = ['discord', 'tuned', 'stun'].includes(name);
  f.phase = late ? 3 : mid ? 2 : 1;
  f.hp = f.max * (late ? 0.25 : mid ? 0.5 : 1);
  const rs = list(p.get('rs'));
  f.rs = rs.length === 4 ? rs.map((v) => (v ? 1 : 0)) : name === 'discord' ? [1, 0, 1, 0] : [1, 1, 1, 1];
  f.ward = name === 'discord';
  const target = { x: KT_BRIDGE.x, z: KT_WARDEN_HOME.z - 10 };
  /** a blow begun so that `share` of its wind-up is done at `now` */
  const blowAt = (key, share) => {
    const was = f.blows.length;
    labBlow(f, key, now, target);
    const mine = f.blows.slice(was), lead = mine[mine.length - 1];
    const shift = Math.round((1 - share) * lead.wu) - (lead.at - now);
    for (const b of mine) b.at += shift;
    return mine[0];
  };
  switch (name) {
    case 'keel': case 'lash': case 'ring': blowAt(name, wt); break;
    case 'wave': blowAt('ring', wt); break;   // the ring's Tonal Wave its lead: `wt` of the wave's wind-up done
    case 'discord': f.discordAt = now + Math.round(num(p.get('da'), 12) * 1000); break;
    case 'stun': f.stunUntil = now + Math.round(Math.max(0, num(p.get('su'), 4)) * 1000); break;
    case 'song': case 'landed': case 'broken': {
      const song = blowAt('song', 0);
      const st = p.has('st') ? num(p.get('st'), 0) * 1000 : name === 'landed' ? KW_BLOWS.song.wu + 500 : wt * KW_BLOWS.song.wu;
      song.at = now - Math.round(st) + KW_BLOWS.song.wu;
      const [n0, hs] = (p.get('forks') ?? '').split(':'), n = clamp(Math.round(num(n0, 3)), 1, 7), h = list(hs);
      const m = 100, c = Array.from({ length: n }, (_, j) => { const a = (j / n) * Math.PI * 2; return { x: Math.round((KT_BRIDGE.x + Math.sin(a) * 9) * 100) / 100, z: Math.round((KT_BRIDGE.z + Math.cos(a) * 9) * 100) / 100, h: name === 'broken' ? 0 : clamp(h[j] ?? m, 0, m) }; });
      f.songAt = song.at;
      f.fk = { i: song.i, at: song.at, m, c };
      break;
    }
    case 'west': blowAt('west', wt); f.endsAt = now + Math.round(Math.max(0, num(p.get('left'), 40)) * 1000); break;
    case 'fell': f.hp = 0; f.fell = { at: now - age, top: ['Lab 0', 'Lab 1', 'Lab 2'], n: KT_LAB_CREW }; break;
    default: break;
  }
  if (name === 'sections' || p.has('sec')) {
    const words = p.get('sec') || '1:2.2,2:-3', older = !words.includes(':');   // KL0's `k,k` at `secAt`, or `k:s` from now
    const secAt = p.has('secAt') ? KT_LAB_EPOCH + num(p.get('secAt'), 0) * 1000 : now - 500;
    f.sec = (older ? list(words).map((k) => [k, (secAt - now) / 1000]) : pairs(words)).map(([k, s]) => { const at = now + Math.round(s * 1000); return { k: clamp(Math.round(k), 0, 7), at, back: at + KW_SECTION_GONE_MS }; });
  }
  return wardenStateOf(f);
}

/**
 * THE ROOM'S WHOLE WORD the knobs of `search` say at `now` (the lab's ms): a `st` frame as net/ketch/ketchBrain.js sends it.
 * @param {string} search @param {number} now
 */
export function ketchLabWire(search, now) {
  const p = new URLSearchParams(search);
  let sg = clamp(Math.round(num(p.get('stage'), 0)), 0, KT_STAGE.vault);
  const asked = KT_LAB_FIGHTS.includes(p.get('fight') ?? '') ? /** @type {string} */ (p.get('fight')) : null;
  const fight = asked ?? (sg >= KT_STAGE.bridge && p.has('forks') ? 'song' : sg >= KT_STAGE.bridge && p.has('sec') ? 'sections' : null);
  if (fight && sg < KT_STAGE.bridge) sg = KT_STAGE.bridge;
  const now0 = Math.round(now);
  const cr = list(p.get('cr')), br = list(p.get('br'));
  const nd = clamp(Math.round(num(p.get('nd'), 5)), 0, 7);
  const bk = clamp(Math.round(num(p.get('bk'), sg > KT_STAGE.engine ? nd : sg === KT_STAGE.engine ? 3 : 0)), 0, nd);
  const lo = pairs(p.get('lo')).slice(0, 32).map(([id, s], j) => [clamp(Math.round(id), 1, 1e9), -3 + 2 * (j % 4), KT_HOLD.y, 114 + 3 * Math.floor(j / 4), now0 + Math.round(Math.max(0, s) * 1000)]);
  const carry = clamp(Math.round(num(p.get('carry'), 0)), 0, KT_LAB_CREW);
  const crew = Array.from({ length: KT_LAB_CREW }, (_, k) => [`lab${k}`, `Lab ${k}`]);
  const ws = fight ? labFight(p, fight, now0) : null;
  return {
    k: 'st', n: 1, sg, sga: Math.max(0, now0 - AGO), cr: crew, bd: [], mv: [], bl: [], wv: clamp(Math.round(num(p.get('wv'), 0)), 0, 3),
    cl: {
      cr: Array.from({ length: 6 }, (_, j) => spotAt(cr[j] ?? (j === 2 ? 10 : 1), now0)),
      br: Array.from({ length: 2 }, (_, j) => spotAt(br[j] ?? 1, now0)),
      lo, ca: crew.slice(0, carry).map(([sub], j) => [sub, 1000 + j]), bk, nd, sk: Array.from({ length: 7 }, (_, j) => (j < bk ? 1 : 0)),
    },
    br: sg >= KT_STAGE.bridge ? { at: now0 - AGO, by: 'Lab 0' } : null,
    ws, fell: ws?.fell ?? null,
  };
}

/** THE PAGE'S STATE the knobs of `search` say at `now` - the room's word projected and folded as the page holds it. */
export function ketchLabState(search, now) {
  return foldKetch(KT_EMPTY, validKetchOut(ketchLabWire(search, now)), Math.round(now));
}

/** A link the fight reads (scenes/ketch/ketchFight.js's `link`): its state the knobs' at the lab's clock, nothing owed. */
export function createKetchLabLink(search, clockMs) {
  return { state: () => ketchLabState(search, clockMs()), joined: () => true, owed: () => [], paid: () => {}, songBroken: () => false };
}
