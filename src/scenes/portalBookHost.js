// @ts-check
// PORTAL-BOOK (2026-10-31, systems/portalBook.js; bible/06-Systems/Portal-Stone.md PORTAL-BOOK): THE BOOK'S WINDOW - the
// kept spots, each opened with one Portal Stone (scenes/portalStoneHost.js openToSpot); inside a house, "keep this house";
// and a spot forgotten. A module the open world's host wires (HOST-SPLIT): the building's pack is that host's too, so the
// book opens indoors, where a spot is kept, and a portal opens outdoors, where the stone's door stands.
import { ChoiceWindow } from '../ui/talkWindow.js';
import { doorWorldNormal, closestDoorTo, EXIT_DOOR_OFFSET } from '../player/enterExit.js';
import { isPortalStone } from '../systems/gate/gateSpoils.js';
import { PORTAL_BOOK_TEXT as TEXT, PORTAL_BOOK_MAX, keepPortalSpot, forgetPortalSpot, portalSpotLabel, portalSpotOf, readPortalBook } from '../systems/portalBook.js';

/** A spot's key on the book's list: 1..9, then 0 for the tenth. */
const keyOf = (/** @type {number} */ i) => `Digit${(i + 1) % 10}`;
/** The Portal Stones a pack holds, every stack together. */
export const stonesIn = (/** @type {any[]} */ items) => (items ?? []).reduce((n, i) => n + (isPortalStone(i) ? (i.stackCount ?? 1) : 0), 0);

/**
 * THE HOUSE THE PLAYER STANDS IN, as the interior host reads it (worldModes portalBookHere): the visit's online home, a
 * Daggerfall deed's word, the building, its town's map id, the doors it was entered by and the player's feet. Answers the
 * house and the landing outside the front door nearest the feet (enterExit.js exteriorLanding's), facing out - or null.
 * A ship's cabin, a caravan and a rented room are no house to keep (`closed`).
 * @param {any} home @param {boolean} deed @param {any} building @param {number} mapId @param {any[] | null | undefined} siblings
 * @param {number[]} feet @param {boolean} closed
 */
export function bookHouseOf(home, deed, building, mapId, siblings, feet, closed) {
  if (closed || !building || !(home || deed) || !siblings?.length) return null;
  const door = closestDoorTo([feet[0], feet[1] + 1.8 * 0.65, feet[2]], siblings.map((e) => e.door));
  if (!door) return null;
  const n = doorWorldNormal(siblings[door.index].door);
  const landing = [door.pos[0] + n[0] * EXIT_DOOR_OFFSET, door.pos[1] + n[1] * EXIT_DOOR_OFFSET, door.pos[2] + n[2] * EXIT_DOOR_OFFSET];
  return { home, deed, mapId: mapId >>> 0, buildingKey: building.buildingKey >>> 0, landing, yaw: Math.atan2(n[0], n[2]) };
}

/**
 * host = { townTalk, playerEntity, mode() 'exterior' | 'interior' | 'dungeon', house() bookHouseOf's answer or null,
 *          pixel() the map pixel the player stands on, townName(pixel) its location's name, campToWire(scene) -> native,
 *          openToSpot(spot) the stone's door, saved() the save owed }
 * @param {any} host
 */
export function createPortalBookHost(host) {
  const say = (/** @type {string} */ line) => host.townTalk.say(line);
  const book = () => readPortalBook(host.playerEntity.portalBook);
  /** The spot of the house I stand in, or null. */
  function spotHere() {
    const h = host.mode() === 'interior' ? host.house() : null;
    if (!h) return null;
    const pixel = host.pixel();
    return portalSpotOf({ home: h.home, deed: h.deed, mapId: h.mapId, buildingKey: h.buildingKey, town: host.townName(pixel) ?? '', pixel, at: host.campToWire(h.landing), yaw: h.yaw });
  }
  function keep(spot) {
    const r = keepPortalSpot(host.playerEntity.portalBook, spot);
    if (r.refused) { say(r.refused === 'full' ? TEXT.full() : TEXT.noHouse()); return; }
    host.playerEntity.portalBook = r.book;
    host.saved?.();
    say((r.again ? TEXT.moved : TEXT.kept)(portalSpotLabel(spot)));
  }
  function go(spot) {
    if (host.mode() !== 'exterior') { say(TEXT.indoors()); return; }
    host.openToSpot(spot);
  }
  function forgetMenu() {
    const spots = book();
    host.townTalk.showOverlay(new ChoiceWindow({
      lines: [TEXT.forgetWhich()],
      options: [
        ...spots.map((s, i) => ({ code: keyOf(i), label: `${(i + 1) % 10} - ${portalSpotLabel(s)}`, action: () => {
          host.playerEntity.portalBook = forgetPortalSpot(spots, i);
          host.saved?.();
          say(TEXT.forgot(portalSpotLabel(s)));
        } })),
        { code: 'Escape', label: TEXT.close(), action: () => {} },
      ],
    }));
  }
  /** THE BOOK OPENED - the pack's Use or a hotbar press. Answers true: the window always stands. */
  function open() {
    const spots = book(), here = spotHere();
    const lines = [TEXT.title(), TEXT.stones(stonesIn(host.playerEntity.items)), ...(spots.length ? [] : [TEXT.empty()]),
      ...(host.mode() === 'interior' && !here ? [TEXT.noHouse()] : [])];
    host.townTalk.showOverlay(new ChoiceWindow({
      lines,
      options: [
        ...(here ? [{ code: 'KeyK', label: TEXT.keep(), action: () => keep(here) }] : []),
        ...spots.slice(0, PORTAL_BOOK_MAX).map((s, i) => ({ code: keyOf(i), label: `${(i + 1) % 10} - ${portalSpotLabel(s)}`, action: () => go(s) })),
        ...(spots.length ? [{ code: 'KeyF', label: TEXT.forget(), action: () => forgetMenu() }] : []),
        { code: 'Escape', label: TEXT.close(), action: () => {} },
      ],
    }));
    return true;
  }
  return { open, spotHere };
}
