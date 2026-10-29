// @ts-check
// NOTICE-PANEL (bible/01-Overview/bugs/Field-Bugs-2026-10-29e.md; the owner: "remove the notice board prop from all
// cities", its replacement "a detailed drop down from the compass ... always be present when inside a city and go away
// when leaving a city. This goes for any settlement"): THE TOWN PANEL AS THE WORLD HOST WIRES IT (HOST-SPLIT: the module
// the host wires, scenes/fishHost.js's shape). The view is ui/hud/townPanel.js; this says when it stands, what it says
// and what its two presses open - what a town's board props opened (worldModes.js's activateBulletinBoard, gone with them).
import { createTownPanel } from '../ui/hud/townPanel.js';
import { bulletinBoardRows } from '../systems/bulletinBoard.js';
import { tokenRows } from '../ui/messageBox.js';
import { ChoiceWindow } from '../ui/talkWindow.js';
import { unseenText } from '../net/boardLaw.js';
import { getPref, setPref } from '../systems/uiPrefs.js';
/** @typedef {{ mapId: number, px: number, py: number, name: string, shown: string }} PanelTown a settlement: its map id
 *  (unsigned), its map pixel, its MAPS name and the name shown in the player's language */

/** How often the panel's lines are read again while the player stays in one town, ms. */
export const TOWN_PANEL_READ_MS = 1000;

/**
 * @param {{ town: () => (PanelTown|null), covered: () => boolean, panelLines?: (mapId: number) => string[],
 *   unseen?: (mapId: number) => number, news?: () => any, openNotice?: (town: any, rumour: string[]) => boolean,
 *   showBox?: (win: any) => void, bounty?: () => boolean, openBounty?: (town: { px: number, py: number, name: string }) => boolean,
 *   now?: () => number, doc?: any }} host `town` the settlement the player is in, on its streets or in its buildings;
 *   `covered` whether a window, a pause, the hidden HUD, the travel view or a voyage covers the panel; `panelLines` its
 *   control and economy (townEcon.js panelLinesAt); `openNotice` the Notice Board online; `bounty` whether hunts are kept here
 */
export function createTownPanelHost(host) {
  const now = host.now ?? (() => performance.now());
  /** @type {ReturnType<typeof createTownPanel> | null} */
  let panel = null;
  /** @type {PanelTown | null} */
  let shownFor = null;
  let readAt = -Infinity;
  const here = () => { try { return host.town(); } catch { return null; } };
  /** The Notice Board's press: online the town's Notice Board (NOTICE1), the same rumour pinned first; offline, or until
   *  the service says it is open, DFU's rumour box (PlayerActivate.cs:706-739) - the town's name over the mill's sign. */
  function openNotice() {
    const town = shownFor;
    if (!town) return;
    const rows = bulletinBoardRows(town.shown, host.news?.() ?? null, tokenRows);
    const notice = { mapId: town.mapId, px: town.px, py: town.py, name: town.name, bountyLine: host.bounty?.() === true };
    if (host.openNotice?.(notice, rows.map((r) => r.text).filter((t, i) => !(i === 0 && t === town.shown)))) return;
    host.showBox?.(new ChoiceWindow({ lines: rows.map((r) => r.text) }));
  }
  const openBounty = () => { if (shownFor) host.openBounty?.({ px: shownFor.px, py: shownFor.py, name: shownFor.name }); };
  const made = () => (panel ??= createTownPanel({
    doc: host.doc, onNotice: openNotice, onBounty: openBounty,
    folded: getPref('townPanelFolded') === true, onFold: (f) => setPref('townPanelFolded', f),
  }));
  return {
    /** The settlement the player is in, or null - the panel's town whether or not it is covered (the heartbeat's board
     *  part reads it, so the town's notes are known before the panel is next seen). */
    town: here,
    /** Shown, its lines read again, or taken down - once a frame. Made at the first frame, not the first town: the HUD's
     *  editor (ui/hud/hudLayout.js) stands it as a preview to move wherever the player is (Mac's HUD-PREVIEW). */
    frame() {
      if (!host.doc && typeof document === 'undefined') return;
      const view = made();
      const town = here();
      if (!town || host.covered()) { view.hide(); if (!town) shownFor = null; return; }
      const t = now();
      if (shownFor?.mapId === town.mapId && view.shown && t - readAt < TOWN_PANEL_READ_MS) return;
      shownFor = town;
      readAt = t;
      let lines = [];
      try { lines = host.panelLines?.(town.mapId) ?? []; } catch (e) { console.warn('[town panel] lines', e); }
      view.show({ name: town.shown || town.name, lines, unseen: unseenText(host.unseen?.(town.mapId) ?? 0), bounty: host.bounty?.() === true });
    },
    dispose() { panel?.dispose(); panel = null; shownFor = null; },
  };
}
