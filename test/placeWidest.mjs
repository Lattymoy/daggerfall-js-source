// AUDIT ATTACH: THE WIDEST PLACE SOCKET, built over the real Room - shared by the tests that measure its attachment
// (test/auditattach.test.js) and any slice that gives a place socket a new arm, which must add its frame to
// placeFrames and its meter to PLACE_METER_FIELDS (or a field to PLACE_ATTACH_FIELDS) and be measured with the rest.
import { NAME_MAX, POSE_BOUND, POSE_Y_BOUND, CAST_DEST_SENDERS_MAX, POSE_RIDE, POSE_RIDE_SPRITES } from '../src/net/wire.js';
import { TITLES, GLYPHS } from '../src/net/identityToken.js';
import { fakeRoom } from './fakeRoom.mjs';

export async function withClock(fn) {
  const realNow = Date.now; let clock = 1e12; Date.now = () => clock;
  try { await fn((ms) => { clock += ms; }); } finally { Date.now = realNow; }
}
/** An id at ID_RE's bound (forty characters), distinct by `n`; `c` fills it. */
export const long = (n, c = 'x') => `p${String(n).padStart(3, '0')}`.padEnd(40, c);
/** A pose at the wire's bounds, every float at seventeen significant digits and every counter at its widest - the
 *  mount too (RIDE's cart and last sprite set, DISC7's half-speed bit: the merge of main's world99 and world100). */
export const WIDE_POSE = Object.freeze({ x: -(POSE_BOUND - 0.012345678901234), y: -(POSE_Y_BOUND - 0.0123456789012), z: -(POSE_BOUND - 0.098765432109876), yaw: -3.141592653589792, pitch: -1.2345678901234567, mv: 2, wd: 2, an: 65535, as: 6, am: 1, sr: 1, cn: 65535, cr: 4, ce: 4, ar: 65535, fk: 5, rd: POSE_RIDE.Cart, rv: POSE_RIDE_SPRITES - 1, hs: 1 });
export const HEAL_SPELL = { name: 'H'.repeat(32), element: 4, rangeType: 1, effects: [{ type: 10, subType: 8, magnitudeBaseLow: 20, magnitudeBaseHigh: 20, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1, durationBase: 0, durationMod: 0, durationPerLevel: 1, chanceBase: 100, chanceMod: 0, chancePerLevel: 1 }] };
/** INSPECT1: a card the wire carries - its contents never touch the attachment, only its arm's meter does. */
export const WIDE_CARD = Object.freeze({ level: 999, attrs: [100, 100, 100, 100, 100, 100, 100, 100], vitals: [99999, 99999, 99999], look: { race: 'Nord', gender: 'male', faceIndex: 0, items: [] } });
export const PARTY_POSE = { px: 100, py: 200, loc: 'Daggerfall', in: 0, h: 50, hm: 60, f: 1000, fm: 2000, m: 10, mm: 20, race: 'Nord', gender: 'male', face: 2 };

/** Everything a place socket's attachment carries - what a wake must recompute, and nothing else. */
export const PLACE_ATTACH_FIELDS = Object.freeze(['key', 'id', 'name', 'title', 'glyphs', 'sub', 'mu', 'pose', 'since', 'turn', 'kept', 'worldSeen', 'finalUsed']);
/** Every meter a place socket's arms spend - the instance's. */
export const PLACE_METER_FIELDS = Object.freeze([
  'bucket', 'drops', 'wbucket', 'wdrops', 'sbucket', 'sdrops', 'pbucket', 'pdrops', 'tradeBucket', 'tdrops', 'tbytes', 'tinbucket',
  'castBucket', 'castDrops', 'cin', 'abucket', 'adrops', 'abytes', 'fbucket', 'fdrops', 'hbucket', 'cbucket', 'cdrops',
  'rollBucket', 'rollDrops', 'rbucket', 'mbucket', 'junk', 'cardBucket', 'cardDrops', 'parkBucket', 'parkDrops',
]);
/** Every frame a place socket can send, once - the room's host, so its memory and its stream are its own. */
export const placeFrames = (other) => [
  { t: 'pose', p: WIDE_POSE }, { t: 'world', data: { a: 1 }, final: true }, { t: 'foes', data: { n: 1, f: [] } },
  { t: 'who', id: other }, { t: 'who', id: long(0) }, { t: 'trade', data: { to: other, k: 'ask', s: 'abcdef' } },
  { t: 'cast', data: { to: other, level: 5, spell: HEAL_SPELL } }, { t: 'act', data: { d: 1 } },
  { t: 'social', k: 'party.leave' }, { t: 'party', p: PARTY_POSE }, { t: 'chat', text: 'hello' },
  { t: 'roll', n: 1, m: 20, k: 0 }, { t: 'say', text: 'hello all' }, { t: 'mute', order: 'v1.a.b' },
  { t: 'card', data: { to: other, card: WIDE_CARD } },   // INSPECT1
  { t: 'park', data: { c: 'c'.repeat(64), a: [1, 1] } },   // HCC-PARK (main's, merged): a character id at PARK_CHAR_RE's bound
];

/** The widest place socket and the eight senders filling its funnel, in a room of the widest key. */
export async function widestPlace(tick) {
  const r = fakeRoom('interior:m4294967295.16777216');   // a map id at ten digits, the building key's 1<<24 sentinel
  const title = TITLES.reduce((x, y) => (y.length > x.length ? y : x));
  const widest = async (ws, n) => {
    const tok = await r.token(long(n), { s: long(n, 's'), n: 'N'.repeat(NAME_MAX), t: title, g: [...GLYPHS], mu: Math.floor(Date.now() / 1000) + 3600 });
    return r.hello(ws, long(n), WIDE_POSE, { tok, name: 'N'.repeat(NAME_MAX) });
  };
  const me = r.connect(); await widest(me, 0);   // the first hello: this world room's host
  const others = [];
  for (let n = 1; n <= CAST_DEST_SENDERS_MAX; n++) { tick(337); const ws = r.connect(); await widest(ws, n); others.push(ws); }
  for (const ws of others) { tick(337); await r.raw(ws, JSON.stringify({ t: 'cast', data: { to: long(0), level: 5, spell: HEAL_SPELL } })); }
  await r.raw(others[0], JSON.stringify({ t: 'hit', data: { i: 0, dmg: 1, kind: 'melee' } }));   // a blow at the host
  await r.raw(others[0], JSON.stringify({ t: 'trade', data: { to: long(0), k: 'ask', s: 'abcdef' } }));   // a trade at me
  for (const f of placeFrames(long(1))) { tick(337); await r.raw(me, JSON.stringify(f)); }
  return { r, me, others };
}
