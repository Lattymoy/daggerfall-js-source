// AUDIT ATTACH: THE WIDEST PLACE SOCKET, built over the real Room - shared by the tests that measure its attachment
// (test/net/auditattach.test.js) and any slice that gives a place socket a new arm, which must add its frame to
// placeFrames and its meter to PLACE_METER_FIELDS (or a field to PLACE_ATTACH_FIELDS) and be measured with the rest.
import { NAME_MAX, POSE_BOUND, POSE_Y_BOUND, CAST_DEST_SENDERS_MAX, POSE_RIDE, POSE_RIDE_SPRITES, PAGE_HEAD_MAX, PAGE_LINE_MAX, PAGE_LINES_MAX } from '../src/net/wire.js';
import { KILL_FX_HEIGHT_MAX, POSE_SEAT_TOP_MAX, POSE_RIDE_OFF_MAX, POSE_ABOARD_OWNER_MAX, POSE_ABOARD_SLOTS, POSE_ABOARD_LOCAL_MAX, POSE_GATHER_ACTS, POSE_GATHER_BEAT_MAX, POSE_GATHER_THROW_MAX, POSE_TS_MOD } from '../src/net/wire.js';
import { TITLES, GLYPHS, AURAS, ICONS, TOKEN_BODY_MAX, TOKEN_VILLAINY_MAX, titleClaimed, tokenBodyOf } from '../src/net/identityToken.js';
import { HOUSE_NAME_MAX, HOUSE_GIVEN_MAX, HOUSE_GEN_MAX } from '../src/net/houseLaw.js';
import { ARMORY_SLOTS, ARMORY_PIECES } from '../src/net/armoryLaw.js';
import { EFFECT_SLOTS, EFFECTS } from '../src/net/effectLaw.js';
import { ARMS_TOP_MAX } from '../src/net/siege/siegeRef.js';
import { fakeRoom } from './fakeRoom.mjs';
import { leaseKeyOf, mintLease } from '../src/net/roomLease.js';

export async function withClock(fn) {
  const realNow = Date.now; let clock = 1e12; Date.now = () => clock;
  try { await fn((ms) => { clock += ms; }); } finally { Date.now = realNow; }
}
/** An id at ID_RE's bound (forty characters), distinct by `n`; `c` fills it. */
export const long = (n, c = 'x') => `p${String(n).padStart(3, '0')}`.padEnd(40, c);
/** AUDIT CLIMB-ARC N7: the climb's fields too (CLIMB5's cl/cw, CLIMB6's move ck/cy/cd), at their widest.
 *  A pose at the wire's bounds, every float at seventeen significant digits and every counter at its widest - the
 *  mount too (RIDE's cart and last sprite set, DISC7's half-speed bit: the merge of main's world99 and world100). */
const WIDE_PLACE = Object.freeze([-(POSE_BOUND - 0.012345678901234), -(POSE_Y_BOUND - 0.0123456789012), -(POSE_BOUND - 0.098765432109876)]);
/** THE WIRE AUDIT (STOREFRONT): and every other field validPose admits, at its widest - a blow, a hurt and a kill with their
 *  places at the bounds (PEERFX1's, STOREFRONT's xk/xp/xh), the hands, a beast, the lights, a seat, a breach's piece, a
 *  deck, a gathering act and a send time. Left out, the widest pose was not the widest. */
const WIDE_REST = Object.freeze({
  lh: 1, ah: 1, wb: 2, hl: 1, lt: 127, lc: 1, cv: 7, st: POSE_SEAT_TOP_MAX,
  hk: 65535, hp: WIDE_PLACE, hb: 63, hq: 100, hu: 65535, uq: 100, xk: 65535, xp: WIDE_PLACE, xh: KILL_FX_HEIGHT_MAX,
  pl: [255, ...[0, 0, 0].map(() => -(POSE_RIDE_OFF_MAX - 0.01))], ab: ['a'.repeat(POSE_ABOARD_OWNER_MAX), POSE_ABOARD_SLOTS - 1, ...[0, 0, 0].map(() => -(POSE_ABOARD_LOCAL_MAX - 0.01))],
  ga: POSE_GATHER_ACTS, gb: POSE_GATHER_BEAT_MAX, gm: POSE_GATHER_THROW_MAX, ts: POSE_TS_MOD - 1,
});
export const WIDE_POSE = Object.freeze({ x: -(POSE_BOUND - 0.012345678901234), y: -(POSE_Y_BOUND - 0.0123456789012), z: -(POSE_BOUND - 0.098765432109876), yaw: -3.141592653589792, pitch: -1.2345678901234567, mv: 2, wd: 2, an: 65535, as: 6, am: 1, sr: 1, cn: 65535, cr: 4, ce: 4, ar: 65535, fk: 5, ...WIDE_REST, rd: POSE_RIDE.Cart, rv: POSE_RIDE_SPRITES - 1, hs: 1 , cl: 3, cw: -3.141592653589792, ck: 8, cy: -600, cd: 600});
const longest = (/** @type {ReadonlyArray<string>} */ l) => l.reduce((x, y) => (y.length > x.length ? y : x));
const kitOf = (/** @type {ReadonlyArray<string>} */ slots, /** @type {ReadonlyArray<{ slot: string, code: string }>} */ list) => slots.map((s) => list.find((p) => p.slot === s)?.code ?? '0').join('');
/** THE WIRE AUDIT (STOREFRONT): the worn claims a place attachment carries beside the badge - the aura and the icon at their
 *  longest, both kits full (ARMORY's `ak`, STOREFRONT's `fx`), a ribbon, the arms and the villain meter at their bounds. */
export const WIDE_WORN = Object.freeze({ au: longest(AURAS), pi: longest(ICONS), ak: kitOf(ARMORY_SLOTS, ARMORY_PIECES), fx: kitOf(EFFECT_SLOTS, EFFECTS), rb: [14, 15], wa: [ARMS_TOP_MAX, 1], vl: TOKEN_VILLAINY_MAX });
export const HEAL_SPELL = { name: 'H'.repeat(32), element: 4, rangeType: 1, effects: [{ type: 10, subType: 8, magnitudeBaseLow: 20, magnitudeBaseHigh: 20, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1, durationBase: 0, durationMod: 0, durationPerLevel: 1, chanceBase: 100, chanceMod: 0, chancePerLevel: 1 }] };
/** INSPECT1: a card the wire carries - its contents never touch the attachment, only its arm's meter does. */
export const WIDE_CARD = Object.freeze({ level: 999, attrs: [100, 100, 100, 100, 100, 100, 100, 100], vitals: [99999, 99999, 99999], look: { race: 'Nord', gender: 'male', faceIndex: 0, items: [] } });
/** JOURNAL1: the widest page the law admits - its words never touch the attachment either, only its arm's meter does. */
export const WIDE_PAGE = Object.freeze({ head: 'H'.repeat(PAGE_HEAD_MAX), lines: Array.from({ length: PAGE_LINES_MAX }, () => 'W'.repeat(PAGE_LINE_MAX)) });
export const PARTY_POSE = { px: 100, py: 200, loc: 'Daggerfall', in: 0, h: 50, hm: 60, f: 1000, fm: 2000, m: 10, mm: 20, race: 'Nord', gender: 'male', face: 2 };

/** Everything a place socket's attachment carries - what a wake must recompute, and nothing else. */
// CHAP4c: and a claimed title's `ts` (wire.js badged) - a seat's (SEAT1c) and a chapter's seat's ride the attachment with it,
// unmeasured until the widest title was a claimed one (PIN MOVED)
// LEASE1 (net/roomLease.js): and the hub's word on the socket - when the room's last word on its mute was said (`lt`),
// when the lease it hands on lapses (`ld`, epoch seconds; none for a build that hands on none), and a freeze (`fz`)
// PIN MOVED (STOREFRONT): the glyphs are stored as their mask, `gb` (server/src/index.js packAttach), read back as `glyphs`
// PIN MOVED (STOREFRONT, the wire audit): and the worn claims the widest token never carried - the hidden glyphs (`gx`), the
// aura, the icon, the ribbon, both kits (`ak`, `fx`), the arms (`wa`) and the villain meter (`vl`)
// PIN MOVED (AUDIT DRAGON-CELL): `at`, when the socket opened - Room.fetch has written it since AUDIT WB A1, and the fake
// room writes it now (the dragon's tell reads it), so the widest is measured with it
export const PLACE_ATTACH_FIELDS = Object.freeze(['key', 'at', 'id', 'sc', 'name', 'title', 'ts', 'gb', 'gx', 'au', 'pi', 'rb', 'ak', 'fx', 'wa', 'vl', 'sub', 'mu', 'lv', 'gi', 'gt', 'gm', 'hn', 'hc', 'hb', 'hg', 'ci', 'gio', 'pose', 'since', 'turn', 'kept', 'worldSeen', 'finalUsed', 'pk', 'lt', 'ld', 'fz']);   // HIBERNATE: `sc`, the id's secret, on the attachment so a wake can ask it without a storage read; WARDEN1: `pk`, whose parked team the socket last spoke for (24 hex - the town watch tells it of a throw); AUDIT RENOWN1 WIRE-4: `lv`, the Renown the token signed; GUILD1c: the guild it signed (`gi`, `gt`, `gm`) and when it was said (`gio`); LEGACY7: the house it signed (`hn`, `hc`, `hb`, `hg`); AUDIT LEGACY III O1: its realm character (`ci`), which the wed arm stamps
/** AUDIT FB1018D L4-4: a dungeon room's socket carries SEAT-LIVE's two stamps beside them (net/seatLive.js - when it came
 *  in, `hi`; when it was last heard, `hd`), which an interior's never writes. */
export const SEAT_ATTACH_FIELDS = Object.freeze(['hd', 'hi']);
/** Every meter a place socket's arms spend - the instance's. */
export const PLACE_METER_FIELDS = Object.freeze([
  'bucket', 'drops', 'wbucket', 'wdrops', 'sbucket', 'sdrops', 'pbucket', 'pdrops', 'tradeBucket', 'tdrops', 'tbytes', 'tinbucket',
  'castBucket', 'castDrops', 'cin', 'abucket', 'adrops', 'abytes', 'fbucket', 'fdrops', 'hbucket', 'cbucket', 'cdrops',
  'rollBucket', 'rollDrops', 'rbucket', 'rdrops', 'mbucket', 'mdrops', 'junk', 'cardBucket', 'cardDrops', 'parkBucket', 'parkDrops',
  'pageBucket', 'pageDrops',   // JOURNAL1
  'duelBucket', 'duelDrops', 'rnbucket', 'rndrops',   // AUDIT RENOWN1 WIRE-4: DUEL1's meter and RENOWN1's, which neither slice listed
  'gdbucket', 'gddrops',   // GUILD1c: the guild orders' one meter, both kinds
  'wedBucket', 'wedDrops',   // LEGACY7 part three: the wed frames' meter
  'lq',   // LEASE1: the lease frames' meter
]);
/** Every frame a place socket can send, once - the room's host, so its memory and its stream are its own. */
export const placeFrames = (other) => [
  { t: 'pose', p: WIDE_POSE }, { t: 'world', data: { a: 1 }, final: true }, { t: 'foes', data: { n: 1, f: [] } },
  { t: 'who', id: other }, { t: 'who', id: long(0) }, { t: 'trade', data: { to: other, k: 'ask', s: 'abcdef' } },
  { t: 'cast', data: { to: other, level: 5, spell: HEAL_SPELL } }, { t: 'act', data: { d: 1 } },
  { t: 'social', k: 'party.leave' }, { t: 'party', p: PARTY_POSE }, { t: 'chat', text: 'hello' },
  { t: 'roll', n: 1, m: 20, k: 0 }, { t: 'say', text: 'hello all' }, { t: 'mute', order: 'v1.a.b' },
  { t: 'card', data: { to: other, card: WIDE_CARD } },   // INSPECT1
  { t: 'page', data: { to: other, page: WIDE_PAGE } },   // JOURNAL1 (from a muted socket, as the widest is: the meter is spent, the page goes nowhere)
  { t: 'park', data: { c: 'c'.repeat(64), a: [1, 1] } },   // HCC-PARK (main's, merged): a character id at PARK_CHAR_RE's bound
  { t: 'duel', data: { to: other, k: 'ask', s: 'abcdef' } },   // DUEL1 (AUDIT RENOWN1 WIRE-4: its meter was never spent here)
  { t: 'renown', order: 'v1.a.b' },   // RENOWN1 (AUDIT RENOWN1 WIRE-4): the meter is spent, the order is refused unread
  { t: 'guild', order: 'v1.a.b' },   // GUILD1c: the guild orders' meter is spent, the order refused unread
  { t: 'wed', data: { to: other, k: 'no', s: 'abcdef', why: 'cancelled' } },   // LEGACY7 part three: the widest wed frame
];

/** The widest place socket and the eight senders filling its funnel, in a room of the widest key - a building's, or
 *  (AUDIT FB1018D L4-4) `key` another's, a dungeon instance's at its widest. */
export async function widestPlace(tick, key = 'interior:m4294967295.16777216') {
  const r = fakeRoom(key);   // a map id at ten digits, the building key's 1<<24 sentinel
  // PIN MOVED (HUNTERS-MARK): the widest title by what it puts on the attachment - its word and, claimed, its claim - since
  // the Masters' words outgrew the chapters' (masterprovisioning, eighteen letters, unclaimed); a claimed chapter's is still wider
  const wide = (/** @type {string} */ t) => t.length + (titleClaimed(t) ? JSON.stringify({ ts: [0xffffffff, 9999] }).length : 0);
  const title = TITLES.reduce((x, y) => (wide(y) > wide(x) ? y : x));   // CHAP4c: a chapter's seat's now - claimed, so it rides with its widest claim
  const claimsOf = (n, gx) => ({ s: long(n, 's'), n: 'N'.repeat(NAME_MAX), t: title, ...(titleClaimed(title) ? { ts: [0xffffffff, 9999] } : {}), g: [...GLYPHS], mu: Math.floor(Date.now() / 1000) + 3600, lv: 50, gi: `g${'z'.repeat(10)}`, gt: 'WWWW', gm: `m${'9'.repeat(15)}`, hn: 'H'.repeat(HOUSE_NAME_MAX), hc: 'G'.repeat(HOUSE_GIVEN_MAX), hb: 1, hg: HOUSE_GEN_MAX, rc: 1, ci: `r${'f'.repeat(20)}`, ...WIDE_WORN, ...(gx.length ? { gx } : {}) });   // AUDIT RENOWN1 WIRE-4: every RENOWN1 client's token carries a level; GUILD1c: and a guild, each at its shape's bound; AUDIT LEGACY III O1: and its realm character
  // THE WIRE AUDIT (STOREFRONT): and as many hidden glyphs, longest first, as the relay's bound on a token's body still takes.
  // BLOOD-OF-COLDHARBOUR: two characters short of it - the clock starts at 1e12 ms, so a later sender's `i` has a tenth
  // digit the first's lacks; a fill that ended on the bound's last character turned those senders away as 'bad token'
  const hidden = [];
  for (const g of [...GLYPHS].sort((a, b) => b.length - a.length)) if (tokenBodyOf(await r.token(long(0), claimsOf(0, [...hidden, g]))).length <= TOKEN_BODY_MAX - 2) hidden.push(g);
  const widest = async (ws, n) => {
    const tok = await r.token(long(n), claimsOf(n, hidden));
    return r.hello(ws, long(n), WIDE_POSE, { tok, name: 'N'.repeat(NAME_MAX), ls: 1 });   // LEASE1: a build that hands its hub's lease on
  };
  const me = r.connect(); await widest(me, 0);   // the first hello: this world room's host
  const others = [];
  for (let n = 1; n <= CAST_DEST_SENDERS_MAX; n++) { tick(337); const ws = r.connect(); await widest(ws, n); others.push(ws); }
  for (const ws of others) { tick(337); await r.raw(ws, JSON.stringify({ t: 'cast', data: { to: long(0), level: 5, spell: HEAL_SPELL } })); }
  await r.raw(others[0], JSON.stringify({ t: 'hit', data: { i: 0, dmg: 1, kind: 'melee' } }));   // a blow at the host
  await r.raw(others[0], JSON.stringify({ t: 'trade', data: { to: long(0), k: 'ask', s: 'abcdef' } }));   // a trade at me
  for (const f of placeFrames(long(1))) { tick(337); await r.raw(me, JSON.stringify(f)); }
  // LEASE1: last, the hub's lease - a mute and a freeze at their widest (the relay's secret set only now, so no arm above
  // read it)
  r.env.GATE_SIGNING_KEY = 'the relay secret';
  const nowS = Math.floor(Date.now() / 1000);
  const l = await mintLease({ s: long(0, 's'), mu: nowS + 3600, fz: nowS + 3600, at: nowS }, await leaseKeyOf(r.env.GATE_SIGNING_KEY, { subtle: crypto.subtle }), { subtle: crypto.subtle });
  tick(337); await r.raw(me, JSON.stringify({ t: 'lease', l }));
  return { r, me, others };
}
