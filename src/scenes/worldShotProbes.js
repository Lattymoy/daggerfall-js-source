// HOST-SPLIT: moved verbatim out of src/scenes/world.js's bootWorld (bible/01-Overview/Host-Split.md) by tools/hostMove.mjs.
// The host constructs it where the code stood. What it reads of the host's scope comes through `host`: the
// settled names by value at construction, every live one (a `let` someone writes, a `const` made below) read at its
// use as `host.<name>` - as the code read them where it was.
import { calculateCastCost } from '../systems/spellcost.js';
import { getPixelFromPixelID } from '../formats/mapsFile.js';
import { goldAmount } from '../systems/court.js';
import { hasDiscoveredLocationId } from '../systems/discovery.js';
import { playerEntity } from '../characters/playerEntity.js';
import { rangedDamageSpells } from '../systems/spellcast.js';
import { saveInfoOf, saveKeysOfCharacter } from '../systems/save/saveSlots.js';

/** @param {any} host */
export function createWorldShotProbes(host) {
  const {
    arrows,
    cam,
    exteriorFoes,
    installTownProbes,
    magic,
    mapDict,
    maps,
    modes,
    openTeleportMap,
    player,
    playerTicker,
    playerTravelPixel,
    shotMode,
    townTalk,
    walkMode,
    worldQuickLoad,
  } = host;
  if (shotMode) {
    modes.installShotProbes();
    installTownProbes();
  }
  if (shotMode) {
    // CASTLE1 probe surface (tools/castleProbe.mjs)
    window.__quickSave = (name) => modes.quickSaveNow(name); // the standing host's OWN composer (the dungeon's underground)
    window.__quickLoad = () => worldQuickLoad();
    window.__loadSave = (key) => worldQuickLoad({ key });
    window.__saveKeys = () =>
      JSON.stringify(
        saveKeysOfCharacter(playerEntity.name).map((key) => ({ key, name: saveInfoOf(key)?.saveName ?? null })),
      );
    window.__hudLines = () => JSON.stringify(townTalk._debug().hud ?? null);
  }
  if (shotMode)
    window.__magic = () =>
      JSON.stringify({
        mp: playerEntity.magicka,
        readied: magic.readied()?.name ?? null,
        armed: magic.spellArmed(),
        missiles: magic.missileCount(),
        mode: modes?.mode ?? 'exterior',
        book: (playerEntity.spells ?? []).map((sp) => ({ name: sp.name, range: sp.rangeType })),
      }); // M5 cast probe
  if (shotMode) {
    // F-slice probe surface: the travel state + the nearest real
    // destination at least two pixels out (the live probe types its
    // name into the real window).
    window.__travelProbe = () =>
      JSON.stringify({
        pixel: playerTravelPixel(),
        minutes: Math.floor(playerTicker.ownMinutes),
        gold: goldAmount(playerEntity),
      });
    // U42: the classic spellbook's live state. Its buttons are hit
    // rects painted into SPBK00I0, so a probe cannot see what it is
    // clicking - it reads the selection, the pushed box and the rows
    // back through here instead of sleeping and hoping.
    window.__spellbook = () =>
      JSON.stringify(
        host._spellbook && !host._spellbook.done
          ? {
              buyMode: host._spellbook.buyMode,
              selected: host._spellbook.selectedIndex,
              scroll: host._spellbook.scrollIndex,
              top: host._spellbook.top,
              name: host._spellbook.selected?.name ?? null,
              effects: [0, 1, 2].map((i) => host._spellbook.effectLabels(i)),
              rows: host._spellbook._rows.map((r) => ({ text: r.text, dim: r.dim })),
            }
          : null,
      );
    // U41: the art window's live state - which page is open, what the
    // label reads, which box or sub-window is up, and the popup's
    // numbers. The keyed stand-in could be driven blind; a click
    // surface cannot.
    // U61/MAP1: the enhanced held map carries its own probe surface
    // (globalThis.__heldMap); this one reads the CLASSIC window's
    // shape and answers null for the other skin rather than throwing
    // on fields it does not have.
    window.__travelMap = () =>
      JSON.stringify(
        host._travelMap && !host._travelMap.done && host._travelMap.regionLabelText
          ? {
              regionSelected: host._travelMap.regionSelected,
              region: host._travelMap.selectedRegion,
              label: host._travelMap.regionLabelText(),
              top: host._travelMap.top,
              picker: host._travelMap.picker ? host._travelMap.picker.items.length : 0,
              popUp: !!host._travelMap.popUp,
              identifying: host._travelMap.identifying,
              locationSelected: host._travelMap.locationSelected,
              find: host._travelMap.findBox?.value ?? '',
              days: host._travelMap.popUp?.countdownValueTravelTimeDays ?? null,
              cost: host._travelMap.popUp?.trip?.totalCost ?? null,
              // G5: the teleport arm's own state, which is deliberately NOT
              // the popUp field - see the note on the window's telePopUp.
              armed: host._travelMap.teleportationTravel,
              telePopUp: host._travelMap.telePopUp
                ? {
                    name: host._travelMap.telePopUp.destination.name,
                    pixel: host._travelMap.telePopUp.destination.pixel,
                  }
                : null,
              save: host._travelMap.getTravelMapSaveData(),
            }
          : null,
      );
    /** G5: open the travel map ARMED, the way the guild service does,
     *  and drive its teleport box - the map is the same map, so the
     *  probe reaches it through the host's own opener. */
    window.__openTeleportMap = () => {
      const win = openTeleportMap();
      if (!win) return null;
      host._travelMap = win;
      townTalk.showOverlay(win);
      return window.__travelMap();
    };
    window.__teleportAnswer = (yes) => {
      if (!host._travelMap?.telePopUp) return null;
      host._travelMap.telePopUp.input(yes ? 'KeyY' : 'KeyN');
      if (host._travelMap.telePopUp?.done) host._travelMap.telePopUp = null;
      return window.__travelMap();
    };
    window.__encounters = () =>
      JSON.stringify({
        active: exteriorFoes.activeCount(),
        foes: exteriorFoes.foes
          .filter((f) => !f.dead)
          .map((f) => ({ type: f.mobileType, dist: +f.ai._dist.toFixed(1), detected: f.ai.detected })),
      });
    window.__spawnEncounter = (type, dist = 10) => {
      const pf = walkMode && host.playerSpawned ? player.pos : cam.pos;
      return exteriorFoes.spawnFoe(type, [pf[0] + dist, pf[1] + 1, pf[2]]).then((f) => (f ? f.mobileType : null));
    };
    // X2/X3 probe surface: the live exterior-combat state
    window.__x23 = () =>
      JSON.stringify({
        hp: playerEntity.health,
        enemyArrows: arrows.arrows.filter((a) => !a.dead && a.enemy).length,
        missiles: magic.missileCount(),
        foes: exteriorFoes.foes
          .filter((f) => !f.dead)
          .map((f) => ({
            type: f.mobileType,
            dist: +f.ai._dist.toFixed(1),
            detected: f.ai.detected,
            bow: !!f.attack.rangedAttack,
            caster: !!f.caster,
            spells: f.entity.spells?.length ?? 0,
            mp: f.entity.magicka ?? 0,
          })),
      });
    window.__travelNearest = () => {
      const p0 = playerTravelPixel();
      let best = null,
        bd = Infinity;
      for (const summary of mapDict.values()) {
        // G8 made HIDDEN dungeons unfindable on the map; the probe's
        // nearest must honour the same gate or it names a place the
        // search cannot list. W1: that gate is now the window's own
        // checkLocationDiscovered - the baked flag OR the store.
        if (!summary.discovered && !hasDiscoveredLocationId(summary.id)) continue;
        const pixel = getPixelFromPixelID(summary.id);
        const d = Math.max(Math.abs(pixel.x - p0.x), Math.abs(pixel.y - p0.y));
        if (d >= 2 && d < bd) {
          bd = d;
          best = { summary, pixel };
        }
      }
      if (!best) return JSON.stringify(null);
      const region = maps.getRegion(best.summary.regionIndex);
      return JSON.stringify({
        name: region?.mapNames?.[best.summary.mapIndex] ?? '',
        region: maps.getRegionName(best.summary.regionIndex),
        pixel: best.pixel,
        type: best.summary.locationType,
        mapId: best.summary.mapID,
        discovered: true,
      });
    };
  }
  if (shotMode)
    window.__readyRanged = () => {
      const sp = rangedDamageSpells(host.spellsByIndex)
        .map((x) => [calculateCastCost(x, playerEntity).sp, x])
        .sort((a, b) => a[0] - b[0])[0]?.[1];
      magic.setReadied(sp);
      return sp ? `${sp.name}:${calculateCastCost(sp, playerEntity).sp}` : null;
    }; // M5: no classic starting set carries a missile spell - ready the cheapest flier for the flight leg (tools/castProbe.mjs); AUDIT ANTICHEAT A2: behind the shot gate, as exterior.js's twin always was
}
