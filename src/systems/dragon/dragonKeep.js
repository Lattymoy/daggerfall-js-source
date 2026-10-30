// @ts-check
// DRAGON5b (2026-10-29, the owner: "If tamed, the dragon becomes a players mount they can summon, just like their
// horse/carriage. With the ability to name"; bible/11-Multiplayer/Dwarven-Dragon.md section 10): THE TAMED DRAGON'S KEEP,
// PURE - where it is (ridden, waiting where it was left, away), how it comes and goes, its name and its saddlebags. The
// character holds it (playerEntity.dragonKeep, saved with it); scenes/dragonKeepHost.js draws it, says it to the cell and
// answers its presses. Not a DFU member: Daggerfall has no flying mount. Ledger A (DRAGON).
import { t } from '../textManager.js';

/** Where the dragon is. */
export const DRAGON_WHERE = Object.freeze({ Ridden: 'ridden', Waiting: 'waiting', Away: 'away' });
const WHERE = new Set(Object.values(DRAGON_WHERE));
/** HCC's own bound on a name (horseCartLaw.js HORSE_NAME_MAX). */
export const DRAGON_NAME_MAX = 31;
/** Its feet this far behind the rider it was left by, or lands behind, m - clear of its 4.5 m body. */
export const DRAGON_WAIT_BACK_M = 7;
/** A press, a mount or the saddlebags reach it from this near its feet, m. */
export const DRAGON_NEAR_M = 9;
/** Called, it comes in from this far and this high over this long; sent away, it climbs off as long. */
export const DRAGON_COME_FROM_M = 320;
export const DRAGON_COME_UP_M = 120;
export const DRAGON_COME_MS = 7000;
export const DRAGON_LEAVE_MS = 6000;
/** Its saddlebags' load, kg - between the Small Cart's 750 and the Open Wagon's 1,500 (systems/wagon/wagonKinds.js). */
export const DRAGON_BAGS_KG = 1000;

const finite = (v) => typeof v === 'number' && Number.isFinite(v);

/** A dragon's name as the keep holds it: trimmed, no control characters, at most DRAGON_NAME_MAX. */
export function normalizeDragonName(s) {
  if (typeof s !== 'string') return '';
  const v = s.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return v.length > DRAGON_NAME_MAX ? v.slice(0, DRAGON_NAME_MAX).trim() : v;
}

/** A tame's first keep: away, nameless, its bags empty. */
export const freshDragonKeep = () => ({
  where: DRAGON_WHERE.Away,
  nx: 0,
  nz: 0,
  yaw: 0,
  name: '',
  bags: [],
  last: false,
});

/** A keep read off a save, made whole: anything it does not know is the fresh keep's. Each piece in its bags through
 *  `itemIn` (the save's own repairs - save.js setItemFields). */
export function dragonKeepRestored(raw, itemIn = (it) => it) {
  const k = freshDragonKeep();
  if (!raw || typeof raw !== 'object') return k;
  const where = WHERE.has(raw.where) ? raw.where : DRAGON_WHERE.Away;
  const placed = finite(raw.nx) && finite(raw.nz);
  k.where = where === DRAGON_WHERE.Waiting && !placed ? DRAGON_WHERE.Away : where;
  if (placed) {
    k.nx = raw.nx;
    k.nz = raw.nz;
  }
  if (finite(raw.yaw)) k.yaw = raw.yaw;
  k.name = normalizeDragonName(raw.name);
  k.bags = Array.isArray(raw.bags) ? raw.bags.filter((it) => it && typeof it === 'object').map((it) => itemIn(it)) : [];
  k.last = raw.last === true;
  return k;
}
/** The keep as a save writes it - never its flight in or out (a save mid-flight is where the flight ends). */
export function dragonKeepSaved(k) {
  if (!k) return null;
  return {
    where: k.where,
    nx: k.nx,
    nz: k.nz,
    yaw: k.yaw,
    name: k.name,
    bags: (k.bags ?? []).map((it) => ({ ...it })),
    last: !!k.last,
  };
}

/** Its name or the dragon's. @param {any} k */
export const dragonKeepName = (k) => normalizeDragonName(k?.name) || t('dragon.keep.unnamed', 'Your dragon');

/** Mounted: ridden, and the last mount (the summon key calls it first). */
export const keepRidden = (k) => ({ ...k, where: DRAGON_WHERE.Ridden, flight: null, last: true });
/** Off its back: waiting at native `nx, nz`, facing `yaw`. */
export const keepLeft = (k, nx, nz, yaw) => ({ ...k, where: DRAGON_WHERE.Waiting, nx, nz, yaw, flight: null });
/** Called: it flies in to wait at `nx, nz` facing `yaw`, from `at` (ms) - along that facing, from behind it. */
export const keepCalled = (k, { nx, nz, yaw, at }) => ({
  ...k,
  where: DRAGON_WHERE.Waiting,
  nx,
  nz,
  yaw,
  flight: { kind: 'in', at },
});
/** Sent away from where it waits: it climbs off from `at`. */
export const keepSentAway = (k, at) => ({ ...k, where: DRAGON_WHERE.Away, flight: { kind: 'out', at } });
/** Another mount ridden: the summon key's word goes to the horse. */
export const keepNotLast = (k) => (k.last ? { ...k, last: false } : k);

const ease = (x) => x * x * (3 - 2 * x);
/**
 * A flight's shape at `age` ms into it, from the spot it waits on: `{ back, up, moving }` - `back` metres behind the spot
 * along its facing (negative ahead of it), `up` metres over the ground. In, it curves down onto the spot along its
 * facing; out, it climbs away ahead. Null when the flight is over. Pure: every screen draws a flight from its age.
 * @param {'in' | 'out'} kind @param {number} age
 */
export function keepFlightAt(kind, age) {
  if (kind === 'in' && age < DRAGON_COME_MS) {
    const e = ease(Math.max(0, age / DRAGON_COME_MS));
    return { back: DRAGON_COME_FROM_M * (1 - e), up: DRAGON_COME_UP_M * (1 - e) ** 2, moving: true };
  }
  if (kind === 'out' && age < DRAGON_LEAVE_MS) {
    const e = Math.max(0, age / DRAGON_LEAVE_MS) ** 2;
    return { back: -DRAGON_COME_FROM_M * e, up: DRAGON_COME_UP_M * e, moving: true };
  }
  return null;
}
/**
 * Where it shows at `at` (ms): `{ back, up, moving, kind, age }` from its spot, or null where nothing shows (ridden, or
 * away and gone). Pure.
 */
export function keepShownAt(k, at) {
  if (!k || (k.where !== DRAGON_WHERE.Waiting && k.where !== DRAGON_WHERE.Away)) return null;
  const f = k.flight,
    age = f ? at - f.at : Infinity;
  const fl = f ? keepFlightAt(f.kind, age) : null;
  if (k.where === DRAGON_WHERE.Waiting)
    return fl && f.kind === 'in' ? { ...fl, kind: 'in', age } : { back: 0, up: 0, moving: false, kind: null, age: 0 };
  return fl && f.kind === 'out' ? { ...fl, kind: 'out', age } : null;
}
/** Whether it is still in the air on its way in at `at`. */
export const keepComing = (k, at) =>
  k?.where === DRAGON_WHERE.Waiting && k.flight?.kind === 'in' && at - k.flight.at < DRAGON_COME_MS;

/** The words of the keep. */
export const DRAGON_KEEP_TEXT = Object.freeze({
  coming: (name) => t('dragon.keep.coming', '{name} is coming.', { name }),
  here: (name) => t('dragon.keep.here', '{name} is already here.', { name }),
  riding: (name) => t('dragon.keep.riding', 'You are riding {name}.', { name }),
  get outdoors() {
    return t('dragon.keep.outdoors', 'You can only call your dragon outdoors.');
  },
  get aboard() {
    return t('dragon.keep.aboard', 'Your dragon cannot land on a ship.');
  },
  get none() {
    return t('dragon.keep.none', 'You have no dragon.');
  },
  away: (name) => t('dragon.keep.away', '{name} flies off.', { name }),
  alreadyAway: (name) => t('dragon.keep.alreadyAway', '{name} is not here to send away.', { name }),
  dismount: (name) => t('dragon.keep.dismount', 'Get down from {name} first.', { name }),
  named: (name) => t('dragon.keep.named', 'Your dragon is called {name}.', { name }),
  get nameless() {
    return t('dragon.keep.nameless', 'Your dragon has no name. Give it one.');
  },
  get nameLabel() {
    return t('dragon.keep.nameLabel', 'Name your dragon:');
  },
  tooFar: (name) => t('dragon.keep.tooFar', 'Go closer to {name}.', { name }),
  get bags() {
    return t('dragon.keep.bags', 'Saddlebags');
  },
  bagsOf: (name) => t('dragon.keep.bagsOf', "{name}'s saddlebags", { name }),
});

/** DRAGON5c: its care's words (systems/upkeep/upkeepRuntime.js) - horse care's, said of the dragon. */
export const DRAGON_CARE_TEXT = Object.freeze({
  get winded() {
    return t(
      'dragon.care.winded',
      'Your dragon is winded. It will not gallop or take off until it has its breath back.',
    );
  },
  get rested() {
    return t('dragon.care.rested', 'Your dragon has its breath back.');
  },
  get hungry() {
    return t('dragon.care.hungry', 'Your dragon is hungry.');
  },
  get starving() {
    return t('dragon.care.starving', 'Your dragon is too weak to gallop. Feed it Dwarven Oil.');
  },
  ateOnTheRoad: (n) =>
    t(
      'dragon.care.ateOnTheRoad',
      '{n, plural, one {Your dragon drank a flask of Dwarven Oil from your packs.} other {Your dragon drank # flasks of Dwarven Oil from your packs.}}',
      { n },
    ),
  get none() {
    return DRAGON_KEEP_TEXT.none;
  },
  get notHere() {
    return t('dragon.care.notHere', 'Your dragon is not here to feed.');
  },
  get yourDragon() {
    return dragonKeepName(null);
  },
  feed: (n) => t('dragon.care.feed', 'Feed Dwarven Oil ({n})', { n }),
  get feedTip() {
    return t('dragon.care.feedTip', "A flask of Dwarven Oil, a day's food");
  },
  get full() {
    return t('dragon.care.full', 'It is not hungry');
  },
  get breath() {
    return t('dragon.care.breath', 'Breath');
  },
  get windedLine() {
    return t('dragon.care.windedLine', 'Winded. It will not gallop or take off until it has its breath back.');
  },
  get stats() {
    return t('dragon.care.stats', 'Stats');
  },
});

/** The Stable page's card (ui/holdingsPages.js): its state's chip and line, its acts, its look. */
export const DRAGON_KEEP_CARD = Object.freeze({
  get riding() {
    return t('dragon.card.riding', 'Riding');
  },
  get ridingLine() {
    return t('dragon.card.ridingLine', 'You are on its back.');
  },
  get coming() {
    return t('dragon.card.coming', 'Coming');
  },
  get comingLine() {
    return t('dragon.card.comingLine', 'It is flying to your side.');
  },
  get waiting() {
    return t('dragon.card.waiting', 'Waiting');
  },
  waitingLine: (far) =>
    far == null
      ? t('dragon.card.waitingHere', 'Waiting where you left it.')
      : t('dragon.card.waitingLine', 'Waiting where you left it, {far} m away.', { far }),
  get away() {
    return t('dragon.card.away', 'Away');
  },
  get awayLine() {
    return t('dragon.card.awayLine', 'Away. Call it, and it flies to your side.');
  },
  get call() {
    return t('dragon.card.call', 'Call');
  },
  get sendAway() {
    return DRAGON_KEEP_ROWS.away;
  },
  get bags() {
    return DRAGON_KEEP_ROWS.bags;
  },
  get rename() {
    return t('dragon.card.rename', 'Rename dragon');
  },
  get field() {
    return t('dragon.card.field', "Your dragon's name");
  },
  get setName() {
    return DRAGON_KEEP_ROWS.name;
  },
  get keepName() {
    return t('dragon.card.keepName', 'Keep');
  },
  get load() {
    return DRAGON_KEEP_TEXT.bags;
  },
  look: (b) =>
    b
      ? t('dragon.card.aether', 'An Aetherbright, blue as aetherium.')
      : t('dragon.card.brass', 'Brass and copper, made by the Dwemer.'),
  get foot() {
    return t(
      'dragon.card.foot',
      'Your dragon waits where you leave it. Call it from anywhere outdoors, and it flies to your side.',
    );
  },
});
/** The card's chip and line for a keep's model (scenes/dragonKeepHost.js model). Pure. */
export function dragonCardWords(m) {
  if (!m) return null;
  if (m.where === DRAGON_WHERE.Ridden)
    return { state: DRAGON_KEEP_CARD.riding, tone: '', line: DRAGON_KEEP_CARD.ridingLine };
  if (m.coming) return { state: DRAGON_KEEP_CARD.coming, tone: '', line: DRAGON_KEEP_CARD.comingLine };
  if (m.where === DRAGON_WHERE.Waiting)
    return { state: DRAGON_KEEP_CARD.waiting, tone: 'is-away', line: DRAGON_KEEP_CARD.waitingLine(m.far) };
  return { state: DRAGON_KEEP_CARD.away, tone: 'is-away', line: DRAGON_KEEP_CARD.awayLine };
}

/** The plaque's verbs over my waiting dragon (the interaction modes HCC's horse answers in - horseCartLaw.js
 *  hccActionRows): ride it, open its bags, send it away, name it. */
export const DRAGON_KEEP_ROWS = Object.freeze({
  get ride() {
    return t('dragon.keep.row.ride', 'Ride');
  },
  get bags() {
    return t('dragon.keep.row.bags', 'Open the saddlebags');
  },
  get away() {
    return t('dragon.keep.row.away', 'Send away');
  },
  get name() {
    return t('dragon.keep.row.name', 'Name');
  },
});

/** Why a call is refused, or null - `{ outdoors, aboard, riding, near }` the host's word now. */
export function dragonCallRefusal(k, { outdoors, aboard, riding, near }) {
  const name = dragonKeepName(k);
  if (!outdoors) return DRAGON_KEEP_TEXT.outdoors;
  if (aboard) return DRAGON_KEEP_TEXT.aboard;
  if (riding) return DRAGON_KEEP_TEXT.riding(name);
  if (near) return DRAGON_KEEP_TEXT.here(name);
  return null;
}

// THE ONE LIVE KEEP'S DOOR: the host that stands it registers here (scenes/dragonKeepHost.js), and the transport window
// (player/mountRig.js), the summon key (systems/horse/horseCart.js) and the Stable page (ui/holdingsPages.js) ask it.
/** @type {any} */
let _door = null;
/** @param {any} door */
export function setDragonKeepDoor(door) {
  _door = door ?? null;
}
/** The live keep's door, or null where no host stands one. */
export const dragonKeepDoor = () => _door;
