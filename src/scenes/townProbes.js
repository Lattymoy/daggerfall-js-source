// HOST-SPLIT: moved verbatim out of src/scenes/world.js's bootWorld (bible/01-Overview/Host-Split.md) by tools/hostMove.mjs.
// The host constructs it where the code stood. What it reads of the host's scope comes through `host`: the
// settled names by value at construction, every live one (a `let` someone writes, a `const` made below) read at its
// use as `host.<name>` - as the code read them where it was.
import { addGold } from '../systems/court.js';
import { charSheetDoorReady } from '../ui/charSheetDoor.js';
import { isNight } from '../world/worldClock.js';
import { playerEntity } from '../characters/playerEntity.js';
import { partyAt } from '../systems/livingWorld/trips.js'; // WW7-7: the road's parties placed, for the probe
import { skyMinutes } from '../systems/worldTick.js';

/** @param {any} host */
export function createTownProbes(host) {
  const { _crimeResponse, built, cam, cityGuards, droppedLoot, livingRoadsOf, minuteNow, state, townTalk, weaponRig } =
    host;
  // T2: the townsfolk probe surface - aggregated over built pixels,
  // positions reported in WORLD space (through the live translation).
  // Installed AFTER the mode machine exists: modes.installShotProbes()
  // defines an interior __people hook, and the town surface must win
  // in this host exactly as it does in the exterior host (the probe
  // read a null __people for 300s before this ordering was learned).
  function installTownProbes() {
    window.__people = () => {
      const out = [];
      for (const p of built.values()) {
        if (!p.population) continue;
        const t = state.pixelTranslation(p.px, p.py);
        p.population.pool.forEach((it, i) => {
          if (!it.active) return;
          out.push({
            pixel: `${p.px},${p.py}`,
            i,
            visible: it.visible,
            pend: it.scheduleEnable,
            recyc: it.scheduleRecycle,
            archive: it.person.archive,
            state: it.person.state,
            moves: it.person.moveCount,
            seeks: it.person.seekCount,
            pos: [
              it.person.pos[0] + p.locOrigin[0] + t[0],
              it.person.pos[1] + t[1],
              it.person.pos[2] + p.locOrigin[2] + t[2],
            ].map((v) => Number(v.toFixed(2))),
          });
        });
      }
      return JSON.stringify(out);
    };
    window.__talk = () => JSON.stringify(townTalk._debug()); // T3b probe surface
    // WW7-7 probe surface (bible/03-World/World-Wide.md WW7-7): the road's parties the living world's roads layer has near,
    // each where its trip has it at the sky's minute - native, and in the scene - its kind and its two ends
    window.__livingRoads = () =>
      (livingRoadsOf?.()?.parties() ?? []).map((p) => {
        const at = partyAt(p.trip, skyMinutes());
        const placed = Number.isFinite(at.x) && Number.isFinite(at.z);
        return {
          id: p.trip.id,
          kind: p.trip.kind,
          from: p.trip.from?.name ?? null,
          to: p.trip.to?.name ?? null,
          home: [p.trip.from?.px, p.trip.from?.py],
          party: p.trip.party?.length ?? 1,
          phase: at.phase,
          camp: !!at.camp,
          native: placed ? [at.x, at.z] : null,
          scene: placed ? state.localFromWorld(at.x, at.z) : null,
        };
      });
    // HOVER-NAMES probe surface (tools/hoverNamesProbe.mjs): the road's people drawn on the ground as talk targets -
    // their names and their feet in the scene - the seats the plaque's person pick races
    window.__roadSeats = () =>
      (livingRoadsOf?.()?.talkSeats?.() ?? []).map((s) => ({ name: s.person?.nameNPC ?? null, pos: [...s.pos] }));
    // MAP3: the held pose's tuning door - `__heldPose()` reads the pose in
    // force while the map is up, `__heldPose({ bones: { 'left forearm':
    // [rx, ry, rz], ... }, paper: { width, forward, drop, tilt } })` re-places
    // the sheet on the live arm (bible/10-UI/Held-Map-Arc.md, MAP3)
    window.__heldPose = (spec) => (spec ? weaponRig?.setHeldPose?.(spec) : weaponRig?.heldPose?.());
    window.__chargenRace = () => townTalk._debug().overlayFlow?.race?.key ?? null; // U10 probe surface
    window.__chargenConfirm = () => townTalk._debug().overlayFlow?.raceConfirm ?? null; // U11 probe surface
    window.__chargenFlow = () => townTalk._debug().overlayFlow ?? null; // S3e probe surface
    window.__addGold = (n) => addGold(playerEntity, n); // U10 probe surface: gold through the real producer
    window.__guards = () => JSON.stringify(cityGuards._debug()); // G1 probe surface
    window.__droppedLoot = () =>
      JSON.stringify(
        droppedLoot._piles.map((pl) => ({
          n: pl.items.length,
          pos: pl.pos.map((v) => +v.toFixed(1)),
          record: pl.record,
          flat: !!pl.batch,
        })),
      ); // U8e probe surface
    window.__crime = () => _crimeResponse(); // G1: force the response without pickpocket RNG
    window.__guardDamage = (i, dmg) => cityGuards._damage(i, dmg); // G3: the real death path for loot probes
    window.__uiArt = () => JSON.stringify({ charsheet: charSheetDoorReady() }); // U8a probe surface; U52: the door, not the art alone
    window.__attack = () => weaponRig.clickAttack(); // G4: ClickToAttack for swing probes
    window.__townDebug = () => {
      const pixels = [];
      for (const p of built.values()) {
        if (!p.population) continue;
        const t = state.pixelTranslation(p.px, p.py);
        const local = [cam.pos[0] - t[0] - p.locOrigin[0], cam.pos[1] - t[1], cam.pos[2] - t[2] - p.locOrigin[2]];
        const [pgx, pgy] = p.population.nav.worldToNav(local[0], local[2]);
        pixels.push({
          pixel: `${p.px},${p.py}`,
          loc: p.location,
          pool: p.population.pool.length,
          max: p.population.maxPopulation,
          act: p.population.pool.filter((it) => it.active).length,
          vis: p.population.pool.filter((it) => it.visible).length,
          pgx,
          pgy,
          w: p.population.nav.weightAt(pgx, pgy),
          spawnTest: p.population.nav.getRandomSpawnPosition(pgx, pgy, 96, 10),
          origin: [p.locOrigin[0] + t[0], p.locOrigin[1] + t[1], p.locOrigin[2] + t[2]],
          navW: p.population.nav.width,
          navH: p.population.nav.height,
        });
      }
      return JSON.stringify({ night: isNight(minuteNow()), pixels });
    };
  }
  return { installTownProbes };
}
