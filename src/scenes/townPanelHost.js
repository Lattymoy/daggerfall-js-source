// @ts-check
// NOTICE-PANEL (bible/01-Overview/bugs/Field-Bugs-2026-10-29g.md; the owner: "remove the notice board prop from all
// cities", its replacement "a detailed drop down from the compass ... always be present when inside a city and go away
// when leaving a city. This goes for any settlement"): THE TOWN PANEL AS THE WORLD HOST WIRES IT (HOST-SPLIT: the module
// the host wires, scenes/fishHost.js's shape). The view is ui/hud/townPanel.js; this says when it stands, what it says
// and what its two presses open - what a town's board props opened (worldModes.js's activateBulletinBoard, gone with them).
import { createTownPanel } from '../ui/hud/townPanel.js';
import { bulletinBoardRows } from '../systems/bulletinBoard.js';
import { tokenRows } from '../ui/messageBox.js';
import { ChoiceWindow } from '../ui/talkWindow.js';
import { getPref, setPref } from '../systems/uiPrefs.js';
import { LOCATION_TYPES } from '../formats/mapsFile.js';
import { CAPITALS, capitalCentrePixel, capitalPlaceId } from '../world/tamrielCapitals.js';
/** @typedef {{ mapId: number, px: number, py: number, name: string, shown: string, district?: string }} PanelTown a
 *  settlement: its map id (unsigned), its map pixel, its MAPS name, the name shown in the player's language and, in a
 *  capital over several pixels, the slice's own name shown as a line */

/** How often the panel's lines are read again while the player stays in one town, ms. */
export const TOWN_PANEL_READ_MS = 1000;
/** How often the Notice Board's heartbeat is told the town, ms (SCALE4c's stamp) - by the wall clock, never the frame's
 *  clamped dt (AUDIT SCALE B7: at four frames a second that "second" outran the heartbeat's live window). */
const STAMP_MS = 1000;

/** AUDIT FB1029g P2: a settlement is a city, a hamlet or a village (MAPS' three town types) - the owner's "any settlement,
 *  city or town". DFU's in-town test (nearbyObjects.js TOWN_LOCATION_TYPES) also takes farms, manors, lone taverns and
 *  temples; no board ever stood at one. */
export const PANEL_TOWN_TYPES = Object.freeze(
  new Set([LOCATION_TYPES.TownCity, LOCATION_TYPES.TownHamlet, LOCATION_TYPES.TownVillage]),
);

/**
 * The panel's town for the location the player stands in (`loc`, the world's: MAPS' or a place past the Bay) at map
 * pixel `at`, or null where it is no settlement. AUDIT FB1029g P7: a capital over several pixels is one town - its own
 * map id, name and centre pixel (one Notice Board, one Bounty Board), the slice's name a district line.
 * @param {any} loc @param {{ x: number, y: number } | null} at @param {(mapId: number, name: string) => string} shownOf
 * @returns {PanelTown | null}
 */
export function panelTownOf(loc, at, shownOf) {
  const mapId = loc?.mapTableData?.mapId;
  if (!at || !Number.isFinite(mapId) || !PANEL_TOWN_TYPES.has(loc.mapTableData.locationType)) return null;
  const name = String(loc.name ?? ''),
    k = loc.capital?.k,
    cap = Number.isInteger(k) ? CAPITALS[k] : null;
  const centre = cap ? capitalCentrePixel(k) : null;
  if (cap && centre) {
    const id = capitalPlaceId(k, 0),
      own = id === mapId >>> 0;
    return {
      mapId: id,
      px: centre.px,
      py: centre.py,
      name: cap.name,
      shown: shownOf(id, cap.name),
      ...(own ? {} : { district: shownOf(mapId, name) }),
    };
  }
  return { mapId: mapId >>> 0, px: at.x, py: at.y, name, shown: shownOf(mapId, name) };
}

/**
 * @param {{ town: () => (PanelTown|null), covered: () => boolean, panelLines?: (mapId: number) => string[],
 *   unseen?: (mapId: number) => number, news?: () => any, openNotice?: (town: any, rumour: string[]) => boolean,
 *   showBox?: (win: any) => void, bounty?: () => boolean, openBounty?: (town: { px: number, py: number, name: string }) => boolean,
 *   anchor?: () => ({ right: number, bottom: number } | null), now?: () => number, doc?: any }} host `covered`: a window, a
 *   pause, the hidden HUD, the travel view or a voyage; `panelLines`: townEcon.js panelLinesAt; `anchor`: hud.js's compass
 */
export function createTownPanelHost(host) {
  const now = host.now ?? (() => performance.now());
  /** @type {ReturnType<typeof createTownPanel> | null} */
  let panel = null;
  /** @type {PanelTown | null} */
  let shownFor = null;
  let readAt = -Infinity,
    placedAt = -Infinity;
  /** AUDIT FB1029g P3: the town the Notice Board's heartbeat reads, stamped from this frame - above the modal gate, so
   *  in a town's buildings too (it rode the exterior frame alone, and indoors the board was never read). */
  let stamp = /** @type {{ mapId: number | null, at: number } | null} */ (null);
  const here = () => {
    try {
      return host.town();
    } catch {
      return null;
    }
  };
  /** The Notice Board's press: online the town's Notice Board (NOTICE1), the same rumour pinned first; offline, or until
   *  the service says it is open, DFU's rumour box (PlayerActivate.cs:706-739) - the town's name over the mill's sign. */
  function openNotice() {
    const town = shownFor;
    if (!town) return;
    const rows = bulletinBoardRows(town.shown, host.news?.() ?? null, tokenRows);
    const notice = {
      mapId: town.mapId,
      px: town.px,
      py: town.py,
      name: town.name,
      bountyLine: host.bounty?.() === true,
    };
    if (
      host.openNotice?.(
        notice,
        rows.map((r) => r.text).filter((t, i) => !(i === 0 && t === town.shown)),
      )
    )
      return;
    host.showBox?.(new ChoiceWindow({ lines: rows.map((r) => r.text) }));
  }
  const openBounty = () => {
    if (shownFor) host.openBounty?.({ px: shownFor.px, py: shownFor.py, name: shownFor.name });
  };
  const made = () =>
    (panel ??= createTownPanel({
      doc: host.doc,
      onNotice: openNotice,
      onBounty: openBounty,
      folded: getPref('townPanelFolded') === true,
      onFold: (f) => setPref('townPanelFolded', f),
    }));
  return {
    /** The settlement the player is in, or null - the panel's town whether or not it is covered. */
    town: here,
    /** The town's map id for the Notice Board's heartbeat while the frames that stamp it are live (`liveMs`), else null. */
    boardTown(/** @type {number} */ liveMs) {
      return stamp && now() - stamp.at < liveMs ? stamp.mapId : null;
    },
    /** Shown, its lines read again, or taken down - once a frame. Made at the first frame, not the first town: the HUD's
     *  editor (ui/hud/hudLayout.js) stands it as a preview to move wherever the player is (Mac's HUD-PREVIEW). */
    frame() {
      const t = now();
      const town = here();
      if (!stamp || t - stamp.at >= STAMP_MS) stamp = { mapId: town ? town.mapId : null, at: t };
      if (!host.doc && typeof document === 'undefined') return;
      const view = made();
      if (t - placedAt >= TOWN_PANEL_READ_MS) {
        placedAt = t;
        view.place(host.anchor?.() ?? null);
      } // a layout read: once a second
      if (!town || host.covered()) {
        view.hide();
        if (!town) shownFor = null;
        return;
      }
      if (
        shownFor?.mapId === town.mapId &&
        shownFor.district === town.district &&
        view.shown &&
        t - readAt < TOWN_PANEL_READ_MS
      )
        return;
      shownFor = town;
      readAt = t;
      let lines = [];
      try {
        lines = host.panelLines?.(town.mapId) ?? [];
      } catch (e) {
        console.warn('[town panel] lines', e);
      }
      view.show({
        name: town.shown || town.name,
        lines: town.district ? [town.district, ...lines] : lines,
        unseen: host.unseen?.(town.mapId) ?? 0,
        bounty: host.bounty?.() === true,
      });
    },
    dispose() {
      panel?.dispose();
      panel = null;
      shownFor = null;
    },
  };
}
