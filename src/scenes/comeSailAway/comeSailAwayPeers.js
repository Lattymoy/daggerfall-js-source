// @ts-check
// COME SAIL AWAY - ANOTHER PLAYER'S BOAT (CSA-J, 2026-09-28). A peer's word (systems/comeSailAway/comeSailAwayWire.js, `sa` on
// their foes frame) stood as boats the others can see: each built as SpawnBoat builds one, into the pool's PEER list
// (scenes/comeSailAway/comeSailAwayPool.js) - drawn, baked, lit and collided with as a boat of mine (FIELD BUGS 2026-10-01b), a ray's
// hit or an activation only as CSA-K makes one (scenes/comeSailAway/comeSailAwayAboard.js: its deck stood on, its ladder and boxes pressed)
// because the host's loops read the pool's own `boats` - and posed every frame from the word, which stays
// in the wire frame and is converted each frame (the floating origin, AUDIT HCC O1). A step past twenty metres is a
// teleport and snaps; anything nearer is taken up (under way at SEA-GLIDE's bounded catch, lying still eased -
// horseCartWire.js easeToward, the team's law). The sails raise and stow
// as the owner's stand, through the mod's own Animator calls; the crew's idle and active objects follow the helm, the
// lanterns the owner's switch. The owner law is the camps' and the team's: an owner's word replaces theirs alone, and
// an owner gone from the room or quiet past the stale time takes their boats with them.
//
// AUDIT PRE-MERGE 0928 O3: A WORD IS KEPT, NEVER BUILT FROM. The socket's handler only stores it; the frame stands what
// it names - ONE boat a frame across every owner, and each owner's builds under a bucket (CSA_PEER_BUILD_BURST at once,
// one more every CSA_PEER_BUILD_REFILL_MS), so a peer swapping its hulls on every frame it sends cannot spend another
// player's frames on SpawnBoat. A boat the word moved to another place in its list (a place, a pack) is the same boat -
// matched by its hull, nearest first - and builds nothing. A place in the list not built yet stands nothing.
// AUDIT PRE-MERGE 0928 O1: a throw building or re-dressing a peer's boat costs that owner's word and boats, said once -
// never the frame (AUDIT MWBODY A1's law, net/peer/peerBodies.js).
// AUDIT PRE-MERGE 0928 O4: the owner's look is their boat's (AUDIT 0927 I-B's law, the cart pool's): the boat under a
// hidden owner at its helm (the classic lane) stands nowhere; under a concealed one (the enhanced lane) its crew and
// lanterns wear the owner's look while the hull draws whole; a moored boat is a boat in the world either way.
// CSA-K (SAIL-TOGETHER): A BOAT UNDER WAY IS LED, NOT CHASED. A word that says the boat's way (the wire's `m`) is
// carried along it: the boat moves on by its velocity and turn every frame, and eases the rest of the way to the word
// led from its arrival (up to CSA_PEER_LEAD_MAX seconds - a word late past that leads no further). So a deck someone
// walks moves as the owner's does, at an even speed, and not in five surges a second. Each boat's frame keeps the pose
// it had before it (`was`), and a step past the snap - a teleport, a new boat - is marked `jumped`: the host carries
// whoever stands on the deck by the pose's change, never across a jump.
// SAILING-CABINS: a below-deck owner keeps streaming their fleet. On owner loss,
// a locally occupied hull is retained stationary until its passenger steps off.
import { validCsaRecord, CSA_WIRE_BOATS_MAX } from '../../systems/comeSailAway/comeSailAwayWire.js';
import { liveryCode } from '../../systems/naval/shipLivery.js';   // SHIP-LIVERY: her paint, as the pool reads a peer's
import { Boat, boatAnimators, animatorOf, setLights } from '../../systems/comeSailAway/comeSailAwayBoat.js';
import { stowSail } from '../../systems/comeSailAway/comeSailAway.js';
import { easeToward } from '../../systems/horse/horseCartWire.js';
import { quatSlerp, quatMultiply, quatAngleAxis } from '../../world/quat.js';
import { FOES_FULL_MS } from '../../net/online.js';
import { farLife, farTreeStep } from './farLife.js';   // BOAT-FAR: her Animators' life by her range, navalHost's law (BOAT-OWN: her tree's)

/** How fast a peer's boat turns toward its word (per second, the ease's rate). */
export const CSA_PEER_TURN_RATE = 12;
/** A step past this is a teleport and snaps (the team's law, horseCartWire.js easeToward) - and carries nobody (CSA-K). */
export const CSA_PEER_SNAP_M = 20;
/** AUDIT SHIPS A7 (2026-10-06, Mac: "Audit everything"): ...or past what her word's way runs in this long (s), if farther
 *  (peerSnapM) - a hitch of a wire's seconds is no teleport at any way: at SAIL-FREE's ways a fixed 20 m snapped a
 *  Carrack at 19 m/s after a 1.75 s hitch (and put her passengers off), where HELM-WAY's 10 m/s took 3 s. */
export const CSA_PEER_SNAP_S = 2.5;
/** AUDIT SHIPS A7: the step (m) past which a boat whose word says way `v` (the scene's, m/s) snaps. */
export const peerSnapM = (v) => Math.max(CSA_PEER_SNAP_M, Math.hypot(v?.[0] ?? 0, v?.[2] ?? 0) * CSA_PEER_SNAP_S);
/** CSA-K: how long a word's way leads the boat past its arrival - a word late past that leads no further: the boat
 *  holds where the way took it until the next word. SEA-GLIDE (FIELD BUGS 2026-10-22d, Dahazed: "the boss fight turns into
 *  dodging friendly ships while they randomly speed up / warp in front of you"): two full frames' spacing (FOES_FULL_MS) -
 *  the full frame is the one word a crowded cell's relay always carries (FOES-FIRST drops a room's deltas past its
 *  budget), and FOES-HOLD may hold it for its turn. At CSA-K's 0.6 s a boat under way between two full frames stood still
 *  1.4 s, then the next word put her v x 1.4 ahead and the ease ran her there in a fifth of a second: 17 m at 84 m/s for a
 *  ship at 12. Measured on a replica of this law (the record's table): words on the full frames alone, each held up to
 *  1.5 s, stall no frame at 4 s and 1% at the sea's 2.5 (navalHost.js PREDICT_MAX_S). A boat that stops is led on until
 *  her stop's word comes, on the next full frame - up to v x 2 s plus its lateness past where she stopped, and glided
 *  back (AUDIT FB1022d C1, CSA_PEER_LED_SETTLE_M). */
export const CSA_PEER_LEAD_MAX = (2 * FOES_FULL_MS) / 1000;
/** SEA-GLIDE: what the word says a boat UNDER WAY is off by is taken up at CSA_PEER_CATCH a second, never faster than
 *  CSA_PEER_CATCH_MPS plus CSA_PEER_CATCH_SHARE of her way - the sea's PUPPET-GLIDE shape (navalHost.js PUPPET_CATCH,
 *  "Ai ships move very janky and quick", FIELD BUGS 2026-10-02d), so a word late or early is never drawn as a surge; she
 *  is led on her way meanwhile (CSA-K). AUDIT FB1022d C3: the share a quarter, not PUPPET-GLIDE's tenth - that was sized
 *  for a relay's jitter, and a boat whose words come on the full frames alone is left metres off by a hitch, a bumper's
 *  shove or a stop, which a tenth took 10-15 s to take up (a quarter: 4-7 s, drawn at most 1.27 times her way). A boat
 *  lying still eases onto her word as before, and a step past the snap still snaps. */
export const CSA_PEER_CATCH = 1;
export const CSA_PEER_CATCH_MPS = 0.3;
export const CSA_PEER_CATCH_SHARE = 0.25;
/** AUDIT FB1022d C1: the residual (m) under which a boat led at a way she no longer has is taken up - past it, her snap
 *  and the glide back are judged by the way she was led at (CSA-K's snap by the word's way alone teleported a boat
 *  that stopped between two full frames, and left a passenger on a still copy of her). */
export const CSA_PEER_LED_SETTLE_M = 1;
/** SEA-GLIDE: `shown` taken up toward `target` over `dt` by a way of `way` m/s - the level (y) eased as CSA-K's (rate 12,
 *  easeToward's), the water's plane at the bounded catch. Pure. @param {number[]} shown @param {number[]} target
 *  @param {number} dt @param {number} way */
export function glideToward(shown, target, dt, way) {
  const d = Math.max(0, dt);
  const ex = target[0] - shown[0], ez = target[2] - shown[2], off = Math.hypot(ex, ez);
  const take = off > 1e-9 ? Math.min(off * (1 - Math.exp(-CSA_PEER_CATCH * d)), (CSA_PEER_CATCH_MPS + CSA_PEER_CATCH_SHARE * way) * d) / off : 0;
  return [shown[0] + ex * take, shown[1] + (target[1] - shown[1]) * (1 - Math.exp(-12 * d)), shown[2] + ez * take];   // C7: the level's ease inline
}
/** AUDIT FB1022d C2: where a way `v` (a second's, in the wire frame) turning `turn` degrees a second carries her in `t`
 *  seconds, on the water's plane - along the turn's ARC, the heading turned as the helm turns it (Rotate(up * turn),
 *  quatAngleAxis's sense: x toward -z); straight when she does not turn. Led straight for CSA_PEER_LEAD_MAX, a boat
 *  circling at 10 degrees a second stood 12 m off her track with her hull 19 degrees off it (20 m at 20). Pure.
 *  @param {number[]} v @param {number} turn @param {number} t @returns {[number, number]} */
export function wayOver(v, turn, t) {
  const om = (turn * Math.PI) / 180;
  if (Math.abs(om * t) < 1e-9) return [v[0] * t, v[2] * t];
  const sn = Math.sin(om * t), cs = 1 - Math.cos(om * t);
  return [(v[0] * sn + v[2] * cs) / om, (-v[0] * cs + v[2] * sn) / om];
}
const V_UP = [0, 1, 0];
/** AUDIT PRE-MERGE 0928 O3: the builds an owner may spend at once - its whole list - and the time one more comes back in. */
export const CSA_PEER_BUILD_BURST = CSA_WIRE_BOATS_MAX;
export const CSA_PEER_BUILD_REFILL_MS = FOES_FULL_MS;
/** The distinct failures said to the console (a crafted stream is its own flood). */
const SAID_MAX = 16;

const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
/** NAV-H: a word's way in the scene, a second's - CSA-K's velocity (the wire frame's) carried through the frame as the
 *  lead carries it (the frame is affine: the way is the difference of two converted points); a word that says none
 *  (a boat not under way, an older build's) has none. */
const sceneWay = (w, toScene) => {
  const v = w.velocity;
  if (!v) return [0, 0, 0];
  const a = toScene(w.position), b = toScene([w.position[0] + v[0], w.position[1], w.position[2] + v[2]]);
  return [b[0] - a[0], 0, b[2] - a[2]];
};

/**
 * @param {{ pool: any, selfId?: () => (string | null), log?: any }} opts
 */
export function createComeSailAwayPeers({ pool, selfId = () => null, log = console }) {
  let enabled = true;
  /** @type {(boat: any) => boolean} */
  let keepAboard = () => false;
  // A disconnected owner cannot remove the deck under a passenger. Keep only
  // occupied local hulls, stationary, until that passenger steps off. These
  // safety copies are never published or made into owned/sailable boats.
  const retained = new Map();
  function retire(owner, slot, s) {
    if (enabled && keepAboard(s.boat)) {
      retained.set(s.boat, { owner, slot, boat: s.boat, hull: s.hull, variant: s.variant,
        position: [...s.boat.GameObject.position], rotation: [...s.boat.GameObject.rotation], wire: [...s.wire] });
    } else pool.remove(s.boat);
  }
  /** @type {((owner: string) => any) | null} 'hidden', a concealed look, or null (AUDIT PRE-MERGE 0928 O4) */
  let peerLook = null;
  /** owner -> { boats, toScene, at, dirty }: the live word, in the wire frame */
  const live = new Map();
  /** owner -> the word's places, each what stands for it or null while it waits for its build:
   *  { boat, hull, variant, wire, slot, shown, turn, helm, light } */
  const shown = new Map();
  /** owner -> { tokens }: the builds an owner may spend (AUDIT PRE-MERGE 0928 O3) - kept past a dropped word and a
   *  sweep, and forgotten only once it is full again, so a word refused or nulled, or an owner out of range and back,
   *  never hands the bucket back full */
  const buckets = new Map();
  let turn = 0;   // the owner the next build asks first
  let lifeSeq = 0;   // BOAT-FAR: each boat's frame of the far law's stride, in the order they stand
  const said = new Set();

  function drop(owner) {
    for (const [slot, s] of (shown.get(owner) ?? []).entries()) if (s) retire(owner, slot, s);
    shown.delete(owner);
  }
  /** AUDIT PRE-MERGE 0928 O1: a peer's boat that throws is that owner's loss alone - their word and boats, said once. */
  function fail(owner, e) {
    live.delete(owner);
    drop(owner);
    const text = `${e?.name ?? 'Error'}: ${e?.message ?? e}`;
    if (said.has(text) || said.size >= SAID_MAX) return;
    said.add(text);
    try { log?.warn?.(`[come-sail-away] a peer's boats stand down - ${text}`); } catch { /* a console is not the boat's problem */ }
  }
  /** The word's places matched with what stands: a boat of the same hull, nearest to its new place first (the same boat
   *  a place or a pack moved along the list), its variant set as SetBoatVariant sets it; the rest go. Builds nothing. */
  function realign(owner, l) {
    const held = [...retained.values()].filter((s) => s.owner === owner).map((s) => ({
      ...s, wire: [...s.wire], shown: [...s.position], turn: [...s.rotation], helm: false, light: !!s.boat.LightOn,
    }));
    const had = [...(shown.get(owner) ?? []).filter(Boolean), ...held];
    const next = new Array(l.boats.length).fill(null);
    const pairs = [];
    for (let i = 0; i < l.boats.length; i++) {
      for (let j = 0; j < had.length; j++) {
        if (had[j].hull !== l.boats[i].hull) continue;
        if (l.boats[i].uid && had[j].boat.uid && l.boats[i].uid !== had[j].boat.uid) continue;
        const d = dist2(had[j].wire, l.boats[i].position);
        if (keepAboard(had[j].boat) && dist2(had[j].boat.GameObject.position, l.toScene(l.boats[i].position)) > peerSnapM([Math.max(Math.hypot(...sceneWay(l.boats[i], l.toScene)), had[j].ledWay ?? 0), 0, 0]) ** 2) continue;   // AUDIT FB1022d C1: by the way she was led at, as her snap
        pairs.push([d, had[j].slot === i ? 0 : 1, i, j]);
      }
    }
    pairs.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2] || a[3] - b[3]);
    const taken = new Set();
    for (const [, , i, j] of pairs) if (!next[i] && !taken.has(j)) { next[i] = had[j]; taken.add(j); }
    for (let j = 0; j < had.length; j++) {
      if (taken.has(j)) retained.delete(had[j].boat);
      else if (!retained.has(had[j].boat)) retire(owner, had[j].slot, had[j]);
    }
    shown.set(owner, next);
    for (let i = 0; i < next.length; i++) {
      const s = next[i], w = l.boats[i];
      if (!s) continue;
      s.boat.uid = w.uid ?? 0;
      s.slot = i; s.wire = w.position;
      s.boat.livery = liveryCode(w.livery);   // SHIP-LIVERY: her paint, her owner's word (the pool's paint shop draws it)
      s.boat.fittings = w.fittings ?? [];   // DECK-PROPS: and her fittings (the pool stands them in her tree)
      s.boat.plaqueName = w.plaque ? w.name ?? '' : '';   // SHIP-PLAQUE: and her name on her bows, where she shows it
      if (s.variant !== w.variant) { pool.setVariant(s.boat, w.variant); s.variant = w.variant; }
    }
  }
  /** One build, across every owner: the first waiting place of the first owner (from `turn`) with a build to spend.
   *  Before the pool's models are in, nothing is built. */
  function buildOne() {
    if (!pool.ready?.()) return;
    const owners = [...live.keys()];
    for (let k = 0; k < owners.length; k++) {
      const owner = owners[(turn + k) % owners.length];
      const l = live.get(owner), list = shown.get(owner), b = buckets.get(owner);
      const i = list ? list.indexOf(null) : -1;
      if (!l || i < 0 || !b || b.tokens < 1) continue;
      turn = (turn + k + 1) % owners.length;
      b.tokens -= 1;
      const w = l.boats[i];
      try {
        const boat = pool.spawnPeerNow(new Boat(w.hull, w.variant));
        if (boat) { boat.peerKey = `${owner}:${i}`; boat.uid = w.uid ?? 0; boat.livery = liveryCode(w.livery); boat.fittings = w.fittings ?? []; boat.plaqueName = w.plaque ? w.name ?? '' : ''; }   // SHIP-LIVERY: and her paint; DECK-PROPS: her fittings   // LIVING CREW: whose, and which - her crew's seed (scenes/naval/navalCrew.js)
        if (boat) list[i] = { boat, hull: w.hull, variant: w.variant, wire: w.position, slot: i, shown: null, turn: null, helm: false, light: false };
      } catch (e) { fail(owner, e); }
      return;
    }
  }
  /** One boat's frame: eased toward its word, its sails, crew and lanterns as the word says, the owner's look, its
   *  Animators stepped. CSA-K: a word under way leads it - the boat carried on by its way this frame, then eased to
   *  the word led from its arrival (`age` seconds ago); the pose before the frame kept as `was`, a snap marked. */
  /** A boat's pose after a frame of `dt` on its word `age` seconds old - pure: the frame's own pose and a peek ahead
   *  (poseAhead) ask the same arithmetic. */
  function nextPose(s, w, toScene, dt, age) {
    const step = Math.max(0, dt);
    const lead = Math.min(Math.max(0, age), CSA_PEER_LEAD_MAX);
    const grow = lead - Math.min(Math.max(0, age - step), CSA_PEER_LEAD_MAX);   // the way's share of this frame: what the lead grew by (none past the cap)
    const v = w.velocity, turn = w.turn ?? 0;
    const led = v ? wayOver(v, turn, lead) : null;   // AUDIT FB1022d C2: along the turn's arc
    const at = led ? [w.position[0] + led[0], w.position[1], w.position[2] + led[1]] : w.position;
    const target = toScene(at);
    let shown = s.shown;
    if (shown && v && grow > 0) {   // on by the way, in the scene: the frame is affine, so the step is the difference
      const was = wayOver(v, turn, lead - grow);
      const a = toScene(w.position), b = toScene([w.position[0] + led[0] - was[0], w.position[1], w.position[2] + led[1] - was[1]]);
      shown = [shown[0] + b[0] - a[0], shown[1] + b[1] - a[1], shown[2] + b[2] - a[2]];
    }
    const way = sceneWay(w, toScene), speed = Math.hypot(way[0], way[2]);
    // AUDIT FB1022d C1: the way she was led at stands until what she is off by is taken up - a boat that stopped between
    // two full frames is judged, snapped and glided back by it, never by a word at rest she ran on past
    const ledWay = Math.max(speed, s.ledWay ?? 0);
    const snap = peerSnapM([ledWay, 0, 0]);   // AUDIT SHIPS A7: by her way
    const jumped = !shown || (target[0] - shown[0]) ** 2 + (target[1] - shown[1]) ** 2 + (target[2] - shown[2]) ** 2 > snap * snap;
    // SEA-GLIDE: under way, led on and taken up at the bounded catch; lying still, eased onto her word; past the snap, there
    const position = !jumped && ledWay > 0 ? glideToward(/** @type {number[]} */ (shown), target, step, ledWay) : easeToward(shown, target, dt, undefined, snap);
    const settled = jumped || Math.hypot(target[0] - position[0], target[2] - position[2]) < CSA_PEER_LED_SETTLE_M;
    const turnTo = turn ? quatMultiply(w.rotation, quatAngleAxis(turn * lead, V_UP)) : w.rotation;   // Rotate(up * turn) in the boat's own frame, as the helm turns it
    let turned = s.turn;
    if (turned && turn && grow > 0) turned = quatMultiply(turned, quatAngleAxis(turn * grow, V_UP));
    const rotation = turned ? quatSlerp(turned, turnTo, 1 - Math.exp(-CSA_PEER_TURN_RATE * step)) : [...turnTo];
    return { position, rotation, jumped, way, ledWay: settled ? speed : ledWay };
  }
  function pose(s, w, toScene, dt, look, age, eye) {
    s.was = s.shown && s.turn ? { position: [...s.shown], rotation: [...s.turn] } : null;
    const next = nextPose(s, w, toScene, dt, age);
    s.jumped = next.jumped;
    s.shown = next.position;
    s.turn = next.rotation;
    s.ledWay = next.ledWay;   // AUDIT FB1022d C1
    s.vel = next.way;   // NAV-H: her way over the water as her word says it - what a captain at sea leads his guns by (scenes/naval/navalHost.js contacts); C7: the pose's own
    s.boat.GameObject.position = s.shown;
    s.boat.GameObject.rotation = s.turn;
    for (let k = 0; k < s.boat.Sails.length; k++) {
      const a = animatorOf(s.boat.Sails[k]);
      const stowed = !((w.sails >> k) & 1);
      if (a && a.GetBool('Stowed') !== stowed) stowSail(a, stowed);
    }
    if (s.helm !== w.helm) { s.helm = w.helm; s.boat.IdleObject?.setActive(!w.helm); s.boat.ActiveObject?.setActive(w.helm); }
    if (s.light !== w.light) { s.light = w.light; setLights(s.boat, w.light); }
    // AUDIT PRE-MERGE 0928 O4: the boat under a hidden owner stands nowhere; a concealed one's crew and lanterns wear the look
    const hide = look === 'hidden' && w.helm;
    if (s.boat.GameObject.activeSelf === hide) s.boat.GameObject.setActive(!hide);
    s.boat.conceal = w.helm && look && look !== 'hidden' ? look : null;
    // SEA-TOWN (FIELD BUGS 2026-10-11c): her Animators as kept for her tree (boatAnimators), not walked out of it again
    // for every boat of every player on every frame - asked even standing nowhere, so each starts over when she stands.
    // BOAT-FAR: and by her range, as the sea's ships' are (scenes/comeSailAway/farLife.js) - past NEAR_LIFE_M of the eye
    // one frame in FAR_LIFE_EVERY, on the time she missed (up to eight boats a player, anywhere in some 3 km, every frame).
    // BOAT-OWN: her tree's (farTreeStep) - hidden or shown, her helm taken or let go, she lives that frame, so her
    // Animators start over or switch as her walk does, never up to three frames after it
    const lived = farTreeStep(s.life ??= farLife(lifeSeq++), dt, s.boat.GameObject, s.shown, eye);
    if (lived !== null) for (const a of boatAnimators(s.boat)) a.update(lived);
  }

  /** One frame: the builds' buckets refilled, each moved word matched to what stands, ONE build, then each boat posed.
   *  BOAT-FAR: `eye` the eye their Animators' range is read from - the pool's last frame's (null: every boat near). */
  function frame(dt, eye = pool.lifeEye?.() ?? null) {
    for (const [boat, s] of retained) {
      if (!enabled || !keepAboard(boat)) { retained.delete(boat); pool.remove(boat); continue; }
      boat.GameObject.position = [...s.position]; boat.GameObject.rotation = [...s.rotation];
    }
    const ms = Math.max(0, dt) * 1000;
    for (const l of live.values()) l.age += Math.max(0, dt);   // CSA-K: each word's age on the real clock, which leads it
    for (const [owner, b] of buckets) {
      b.tokens = Math.min(CSA_PEER_BUILD_BURST, b.tokens + ms / CSA_PEER_BUILD_REFILL_MS);
      if (b.tokens >= CSA_PEER_BUILD_BURST && !live.has(owner)) buckets.delete(owner);   // owes nothing: a newcomer's own
    }
    for (const [owner, l] of [...live]) {
      if (!l.dirty) continue;
      l.dirty = false;
      try { realign(owner, l); } catch (e) { fail(owner, e); }
    }
    buildOne();
    for (const [owner, l] of [...live]) {
      const list = shown.get(owner);
      if (!list) continue;
      const look = peerLook?.(owner) ?? null;
      try {
        for (let i = 0; i < list.length; i++) if (list[i]) pose(list[i], l.boats[i], l.toScene, dt, look, l.age, eye);
      } catch (e) { fail(owner, e); }
    }
  }

  /** Another's word through validCsaRecord; `null` (or an invalid record) drops theirs. Kept, never built from here. */
  function applyOwner(owner, raw, toScene = (p) => p, nowMs = 0) {
    if (!enabled) return false;
    if (typeof owner !== 'string' || !owner || owner === (selfId?.() ?? null)) return false;
    const r = raw == null ? null : validCsaRecord(raw);
    if (!r) { live.delete(owner); drop(owner); return raw == null; }
    if (!buckets.has(owner)) buckets.set(owner, { tokens: CSA_PEER_BUILD_BURST });
    live.set(owner, { boats: r.boats, cabin: !!r.cabin, toScene, at: nowMs, dirty: true, age: 0 });
    return true;
  }
  /** An owner gone from the room, or quiet past staleMs, takes their boats with them (its bucket stays until full). */
  function sweepOwners(alive, nowMs, staleMs = 0) {
    for (const [owner, l] of [...live]) {
      if (alive?.has?.(owner) && !(staleMs > 0 && nowMs - l.at > staleMs)) continue;
      live.delete(owner);
      drop(owner);
    }
  }
  /** Every transition, a room change, a fast travel: nobody's boats stand until their next word. */
  function clearPeers() {
    live.clear();
    buckets.clear();
    for (const owner of [...shown.keys()]) drop(owner);
    for (const [boat] of retained) if (!enabled || !keepAboard(boat)) { retained.delete(boat); pool.remove(boat); }
  }
  /** The floating origin moved: the eased places move with the world (the words are converted every frame anyway). */
  function rebase(offset) {
    for (const s of retained.values()) s.position = s.position.map((v, i) => v + offset[i]);
    for (const list of shown.values()) for (const s of list) if (s?.shown) s.shown = [s.shown[0] + offset[0], s.shown[1] + offset[1], s.shown[2] + offset[2]];
  }
  function setEnabled(v) { enabled = !!v; if (!enabled) clearPeers(); }

  return {
    applyOwner, sweepOwners, clearPeers, rebase, frame, setEnabled,
    setKeepAboard(fn) { keepAboard = typeof fn === 'function' ? fn : () => false; },
    boatByUid(owner, uid) {
      const l = live.get(owner), list = shown.get(owner);
      const wire = l?.boats.find((b) => b.uid === uid);
      // A network frame can reorder slots before the next render realigns them.
      // Resolve the shown hull's identity too; never borrow that slot's old boat.
      return wire ? list?.find((s) => s?.boat.uid === uid && s.hull === wire.hull)?.boat ?? null : null;
    },
    isBelowDeck: (owner) => !!live.get(owner)?.cabin,
    /** DECK-CAMP: whether an owner's word still names a boat of hers by number - stood or not (out of sight, a frame
     *  away) - so a camp on her waits for her rather than being packed away. */
    hasBoat: (owner, uid) => !!live.get(owner)?.boats?.some((b) => b.uid === uid),
    /** NAV-H: the boats other players stand at their helms, where each is and how it moves - the sea's contacts
     *  (scenes/naval/navalHost.js): a pirate hunts them as it hunts mine. A boat that stands nowhere (a hidden owner's) is
     *  nobody's contact. */
    helmBoats() {
      const out = [];
      for (const [owner, list] of shown) {
        for (const s of list) {
          if (!s?.helm || !s.shown || !s.boat.GameObject.activeSelf) continue;
          const vel = s.vel ?? [0, 0, 0];
          // AUDIT NAV1: her hull and heading too - the room a captain gives her and the side he comes up on
          const q = s.turn, yaw = q ? Math.atan2(2 * (q[0] * q[2] + q[3] * q[1]), 1 - 2 * (q[0] * q[0] + q[1] * q[1])) : null;
          out.push({ id: owner, pos: s.shown, vel, speed: Math.hypot(vel[0], vel[2]), hull: s.hull, yaw, boat: s.boat });   // AUDIT NAV1 (online): her hull, for the shots
        }
      }
      return out;
    },
    /** AUDIT PRE-MERGE 0928 O4: the host's word on each other player's look - 'hidden', a concealed visual, or null. */
    setPeerLook(fn) { peerLook = typeof fn === 'function' ? fn : null; },
    get enabled() { return enabled; },
    /** What stands, owner by owner, place by place (null: waiting for its build) - a probe's and the tests' reading. */
    shown: () => [...[...shown].map(([owner, list]) => ({ owner, boats: list.map((s) => (s ? { hull: s.hull, variant: s.variant, position: s.shown ? [...s.shown] : null, boat: s.boat } : null)) })),
      ...[...retained.values()].map((s) => ({ owner: s.owner, boats: [{ hull: s.hull, variant: s.variant, position: [...s.position], boat: s.boat }] }))],
    /** CSA-K: the boat standing for an owner's place in their word, or null. */
    boatAt: (owner, slot) => [...retained.values()].find((s) => s.owner === owner && s.slot === slot)?.boat ?? shown.get(owner)?.[slot]?.boat ?? null,
    /** HOLDINGS: the name another player gave her (their word's `n`, read through the ledger's law), or ''. */
    nameAt: (owner, slot) => live.get(owner)?.boats?.[slot]?.name ?? '',
    /** SHIP-COLOURS: every boat of another player's stood here that flies her captain's flag (their word's `f`, read
     *  through the flag's door) - `{ boat, flag }` (scenes/shipFlagHost.js). */
    flagged() {
      const out = [];
      for (const [owner, list] of shown) {
        const words = live.get(owner)?.boats ?? [];
        for (let i = 0; i < list.length; i++) if (list[i]?.boat && words[i]?.flag) out.push({ boat: list[i].boat, flag: words[i].flag });
      }
      return out;
    },
    /** CSA-K: where a boat of a peer's stands in their word - `{ owner, slot }` - or null (not a peer's, or gone). */
    placeOf(boat) {
      const held = retained.get(boat);
      if (held) return { owner: held.owner, slot: held.slot };
      for (const [owner, list] of shown) for (let i = 0; i < list.length; i++) if (list[i]?.boat === boat) return { owner, slot: i };
      return null;
    },
    /** CSA-K: the pose a boat of a peer's will stand at after the next frame of `dt` (a reader's online frame runs
     *  before the peers' frame, and places a passenger on the deck where it will be drawn) - or null. */
    poseAhead(boat, dt) {
      const held = retained.get(boat);
      if (held) return { position: [...held.position], rotation: [...held.rotation] };
      for (const [owner, list] of shown) {
        const l = live.get(owner);
        if (!l) continue;
        for (let i = 0; i < list.length; i++) {
          const s = list[i];
          if (s?.boat !== boat) continue;
          // FIELD BUGS 2026-10-09 #7: a word that came since the last frame is not yet matched to what stands (the frame's
          // realign does that) - a place it no longer names, or names for another hull, has no pose ahead: she stands where she is
          const w = l.boats[i];
          if (!w || w.hull !== s.hull) return null;
          const p = nextPose(s, w, l.toScene, dt, l.age + Math.max(0, dt));
          return { position: p.position, rotation: p.rotation };
        }
      }
      return null;
    },
    /** CSA-K: a boat's move this frame - its root's pose before the frame and after - or null where there is none to
     *  carry anyone by: a boat just built, a snap (a teleport), or no boat of a peer's. */
    moveOf(boat) {
      const held = retained.get(boat);
      if (held) {
        const pose = { position: [...held.position], rotation: [...held.rotation] };
        return { before: pose, after: pose };
      }
      for (const list of shown.values()) {
        for (const s of list) {
          if (s?.boat !== boat) continue;
          return s.was && !s.jumped ? { before: s.was, after: { position: [...s.shown], rotation: [...s.turn] } } : null;
        }
      }
      return null;
    },
  };
}
