// What the decoration look may offer for the thing under the crosshair. One call, run at once: a later
// confirm/discard list can record the same action instead of performing it.
// A player piece that stores or crafts is still that player's decoration. The building's own furniture may
// only be taken out. A room's swing door (`intdoor:`) may be taken out, and nothing else. An exit, a chained
// door or a ladder is the building's structure.

import { t } from '../textManager.js';

const NONE = Object.freeze({ move: false, duplicate: false, remove: false, out: false });

/** Who may use a chest or a station, in the door's order: a press moves it on. */
export const DECOR_USE_MODES = Object.freeze(['private', 'friends', 'party', 'guild']);
/** The row's word, the door's shape: "Who may use: Me". */
export const DECOR_USE_WORDS = Object.freeze({ private: 'Me', friends: 'Friends', party: 'Party', guild: 'Guild' });
export const decorUseLabel = (mode) => t('decor.look.use', 'Who may use: {who}', { who: DECOR_USE_WORDS[mode] ?? DECOR_USE_WORDS.private });
export const decorUseNext = (mode) => DECOR_USE_MODES[(Math.max(0, DECOR_USE_MODES.indexOf(mode)) + 1) % DECOR_USE_MODES.length];
/** A hall chest is the guild's. A press moves the lowest rank that may open it, and every higher rank may too. */
export const HALL_USE_RANKS = Object.freeze([3, 2, 1, 0]);
export const HALL_USE_WORDS = Object.freeze({ 3: 'Everyone', 2: 'Members', 1: 'Officers', 0: 'Guildmaster' });
export const decorHallRankNext = (rank) => HALL_USE_RANKS[(Math.max(0, HALL_USE_RANKS.indexOf(rank)) + 1) % HALL_USE_RANKS.length];
export const decorHallUseLabel = (rank) => t('decor.look.hall', 'Who may use: {who}', { who: HALL_USE_WORDS[rank] ?? HALL_USE_WORDS[3] });
/** The handles a press on Friends or Party sends. Party leaves the owner out. */
export function decorUseCircle(social) {
  const friends = [];
  const party = [];
  if (social?.friends?.values) for (const r of social.friends.values()) if (typeof r?.name === 'string' && r.name) friends.push(r.name);
  const mine = social?.name;
  for (const m of social?.party?.members ?? []) if (typeof m?.name === 'string' && m.name && m.name !== mine) party.push(m.name);
  return { friends, party };
}

/** `decor` a placed piece, `container` or `station` one that does that, `door` a placed door, `roomdoor` one of
 *  the building's own swing doors, `base` the building's own furniture, `structural` an exit, a chained door or a ladder. */
export function decorAimKind(key, piece) {
  if (piece?.roomDoor) return 'roomdoor';
  if (piece) {
    if (piece.door) return 'door';
    if (piece.station) return 'station';
    if (piece.storage) return 'container';
    return 'decor';
  }
  if (typeof key !== 'string') return null;
  if (key.startsWith('intdoor:')) return 'roomdoor';
  if (key.startsWith('base:')) return 'base';
  if (key.startsWith('container:') || key.startsWith('shelf:')) return 'container';
  if (key.startsWith('exit:') || key.startsWith('act:') || key.startsWith('ladder:')) return 'structural';
  return null;
}

/**
 * Move, duplicate and remove, for one aim. Nothing for the building's own furniture or its structure, nor when
 * the player may not edit this room. A piece that holds anything is not removed. One's own thing is not copied.
 * @param {{ kind?: string, key?: string, piece?: any, holds?: boolean, mayEdit?: boolean } | null} aim
 */
export function decorLookOffers(aim) {
  if (!aim || aim.mayEdit === false) return { ...NONE };
  const kind = aim.kind ?? decorAimKind(aim.key, aim.piece);
  if (kind === 'roomdoor') return { move: false, duplicate: false, remove: true, out: false };
  if (kind === 'base') return { move: false, duplicate: false, remove: false, out: true };
  if (!aim.piece) return { ...NONE };
  if (kind !== 'decor' && kind !== 'container' && kind !== 'station' && kind !== 'door') return { ...NONE };
  const row = { move: true, duplicate: !aim.piece.item, remove: !aim.holds, out: false, rename: true };
  if (kind === 'container' || kind === 'station') row.access = true;
  return row;
}

const PLAQUE_LABEL = { move: 'Move', duplicate: 'Duplicate', remove: 'Remove', rename: 'Rename', out: t('decor.look.takeOut', 'Take out') };

/**
 * The hover plaque's title and its wheel list, for one aim while decorating. No list, the name the room already
 * had. A chair the room does not name on its own takes the catalogue's name.
 * @param {{ title?: string, subs?: any, actions?: any[] } | null} named
 * @param {{ kind?: string, key?: string, piece?: any, holds?: boolean, mayEdit?: boolean, name?: string } | null} aim
 */
export function decorPlaque(named, aim) {
  const offers = decorLookOffers(aim ? { ...aim, kind: aim.kind ?? decorAimKind(aim.key, aim.piece) } : null);
  const actions = [];
  if (offers.move) actions.push({ id: 'move', label: PLAQUE_LABEL.move });
  if (offers.duplicate) actions.push({ id: 'duplicate', label: PLAQUE_LABEL.duplicate });
  if (offers.remove) actions.push({ id: 'remove', label: PLAQUE_LABEL.remove });
  if (offers.rename) actions.push({ id: 'rename', label: PLAQUE_LABEL.rename });
  if (offers.access) actions.push({ id: 'access', label: aim.use || decorUseLabel('private') });
  if (offers.out) actions.push(aim?.holds
    ? { id: 'out', label: PLAQUE_LABEL.out, disabled: true, why: 'it holds something' }
    : { id: 'out', label: PLAQUE_LABEL.out });
  if (!actions.length) return named ?? null;
  return { ...(named && typeof named === 'object' ? named : {}), title: named?.title || aim?.name || 'Piece', actions };
}

/** A built-in piece while decorating: its name, and Take out alone. Not decorating, the name the room already had. */
export function decorBuiltInPlaque(title, entry, editing) {
  const name = title || 'Piece';
  if (!editing || !entry?.baseKey) return title ? { title } : null;
  const holds = Array.isArray(entry.items) && entry.items.length > 0;
  return decorPlaque({ title: name }, { key: entry.baseKey, kind: 'base', mayEdit: true, name, holds });
}
