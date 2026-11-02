// @ts-check
// HOME-MUTE (FIELD BUGS 2026-10-29f; #feature-feedback, "Housing feedback & suggestions after 20 hours of decorating",
// item 22: "Let us turn off the visibility of selected house decorations ... just come to someone's doors and turn off
// their HORRIBLE DESERT SHACK IN THE MIDDLE OF A NORTHERN CITY"). The town's vote hides a home for everyone; this hides
// one for me alone. At a stranger's door, "Hide its decorations" puts it on this device's list, and it stands for me as a
// shunned home does (net/homeVoteLaw.js homeDecorShown): its town's own paint, an empty yard, Daggerfall's own room. The
// list is keyed by the town, the building and its owner, so a new owner's home is seen again. Nothing reaches the service.
import { homeDecorShown } from '../../net/homeVoteLaw.js';
import { t, localizedTable } from '../textManager.js';
import { appStorage } from '../appStorage.js'; // the app's own storage - a browser's, or the desktop shell's

/** The device's list, and the most it keeps (the oldest let go past it). */
export const HOME_MUTE_STORE = 'dfo.homeMute.v1';
export const HOME_MUTE_MAX = 500;
/** The door's two rows. */
export const HOME_MUTE_VERB = Object.freeze({ hide: 'home-mute-hide', show: 'home-mute-show' });
/** Its words: the two rows, the door's line, and what a press says. */
export const HOME_MUTE_TEXT =
  /** @type {Readonly<{ hide: string, show: string, muted: string, done: string, undone: string }>} */ (
    localizedTable({
      hide: () => t('home.mute.hide', 'Hide its decorations (for you)'),
      show: () => t('home.mute.show', 'Show its decorations again'),
      muted: () => t('home.mute.muted', 'You hid its decorations. Only you see the change.'),
      done: () => t('home.mute.done', 'Its decorations are hidden for you.'),
      undone: () => t('home.mute.undone', 'Its decorations show for you again.'),
    })
  );

/** @type {Storage | null} */
let store = null;
try {
  store = appStorage() ?? null;
} catch {
  store = null;
}
/** @type {string[] | null} the keys, oldest first */
let list = null;

/** Tests: a store of their own (null: none - the list lives for the session). */
export function setHomeMuteStore(/** @type {Storage | null} */ s) {
  store = s;
  list = null;
}

function keys() {
  if (list) return list;
  list = [];
  try {
    const raw = JSON.parse(store?.getItem(HOME_MUTE_STORE) ?? '[]');
    if (Array.isArray(raw)) list = raw.filter((k) => typeof k === 'string' && k.length <= 200).slice(-HOME_MUTE_MAX);
  } catch {
    list = [];
  }
  return list;
}
function keep() {
  try {
    store?.setItem(HOME_MUTE_STORE, JSON.stringify(keys()));
  } catch {
    /* a full or blocked store: kept for the session */
  }
}

/** A home's key: its town, its building and whoever holds it. */
export const homeMuteKey = (mapId, home) => `${mapId}:${home?.buildingKey}:${home?.owner ?? ''}`;
/** Whether I may hide a home: anybody's but my account's own and a hall of my guild's - and never a knight's deed house. */
export const homeMutable = (home) =>
  !!home &&
  !home.own &&
  home.mine !== true &&
  home.deed !== true &&
  !(home.hall && (home.member === true || home.insider === true));
/** Whether I hid this home. */
export const homeMuted = (mapId, home) => homeMutable(home) && keys().includes(homeMuteKey(mapId, home));
/** HOME-VOTE's law, and mine: what a home shows to the player looking here. */
export const homeDecorShownHere = (home, mapId) => homeDecorShown(home) && !homeMuted(mapId, home);
/** Hide or show a home for me; answers whether the list changed. */
export function setHomeMuted(mapId, home, on) {
  if (!homeMutable(home)) return false;
  const k = homeMuteKey(mapId, home);
  const all = keys();
  const at = all.indexOf(k);
  if (on === at >= 0) return false;
  if (on) {
    all.push(k);
    if (all.length > HOME_MUTE_MAX) all.splice(0, all.length - HOME_MUTE_MAX);
  } else all.splice(at, 1);
  keep();
  return true;
}

/** The door's row for a home I may hide - hide it, or show it again. */
export const homeMuteRows = (home, mapId) =>
  homeMutable(home)
    ? [
        homeMuted(mapId, home)
          ? { id: HOME_MUTE_VERB.show, label: HOME_MUTE_TEXT.show }
          : { id: HOME_MUTE_VERB.hide, label: HOME_MUTE_TEXT.hide },
      ]
    : [];
/** The door's line under a home I hid. */
export const homeMuteLines = (home, mapId) => (homeMuted(mapId, home) ? [HOME_MUTE_TEXT.muted] : []);

/** A row pressed at the door: hide or show the home, the registry bumped so the town repaints it, and said. Answers
 *  whether the verb was this one's. `host.onlineHomes` the registry, `talk.say` the line. */
export function pressHomeMute(verb, mapId, home, host, talk) {
  if (verb !== HOME_MUTE_VERB.hide && verb !== HOME_MUTE_VERB.show) return false;
  const on = verb === HOME_MUTE_VERB.hide;
  if (setHomeMuted(mapId, home, on)) host?.onlineHomes?.bump?.();
  talk?.say?.(on ? HOME_MUTE_TEXT.done : HOME_MUTE_TEXT.undone);
  return true;
}
/** The Info press's box's choice (where no plaque is drawn): H, the door's own row. */
export const homeMuteOptions = (home, mapId, host, talk) =>
  homeMuteRows(home, mapId).map((row) => ({
    code: 'KeyH',
    label: `H - ${row.label}`,
    action: () => {
      pressHomeMute(row.id, mapId, home, host, talk);
    },
  }));
