// T1 towns: PopulationManager (DFU, MIT Daggerfall Workshop) - the
// wandering-NPC pool. Verbatim laws: 10 ticks/s; max population =
// clamp(totalBlocks/16, 1, 4) * 24; spawns on the navgrid within 96
// cells of the player; recycled past 150 world units, after 4 failed
// seeks, or at NIGHT (townsfolk are daytime-only); pop-in/pop-out is
// hidden - activation changes are allowed only beyond 120 units OR
// outside the player's 180-degree view; a spawned mobile stays
// INVISIBLE until its first completed tile move (the anti-skate
// rule); spawns only while the player is inside the location rect +
// 2500 classic units; identity (RandomiseNPC) re-rolls at EVERY
// spawn - 1/32 are guards (texture 399, male), the rest flip gender
// and draw one of four outfit variants. Race rides the climate's
// people (the scene passes the tables); the guard crime RESPONSE
// pends the crime system (they spawn and walk now).

import { PERSON_TEXTURES, GUARD_TEXTURE, MobilePerson } from '../characters/mobilePerson.js';
import { NAV_CELL } from '../world/cityNavigation.js';

export const POP_TICKS_PER_SECOND = 10;
export const POP_PER_16_BLOCKS = 24;           // populationIndexPer16Blocks
export const POP_SPAWN_RADIUS = 96;            // navGridSpawnRadius (cells)
export const POP_RECYCLE_DISTANCE = 150;       // recycleDistance
export const POP_VISIBLE_RANGE = 120;          // allowVisiblePopRange
export const POP_MAX_SEEKS = 4;
// maxPlayerDistanceOutsideRect: 2500 classic units past the location
// rect - beyond it no spawns happen at all (audit 2026-08-17).
export const POP_SPAWN_RANGE_OUTSIDE_RECT = 2500 * 0.025;   // 62.5
export const GUARD_CHANCE_DENOM = 32;          // Random.Range(0,32) == 0 -> a guard

export function maxPopulationFor(totalBlocks) {
  return Math.max(1, Math.min(4, Math.floor(totalBlocks / 16))) * POP_PER_16_BLOCKS;
}

export class TownPopulation {
  /**
   * @param nav CityNavigation
   * @param opts { totalBlocks, race, makePerson(archive, guard) ->
   *   MobilePerson (the scene owns textures/collider/ground), rand }
   */
  constructor(nav, { totalBlocks, race = 'Breton', makePerson, rand = Math.random } = {}) {
    this.nav = nav;
    this.race = race;
    this.makePerson = makePerson;
    this.rand = rand;
    this.maxPopulation = maxPopulationFor(totalBlocks);
    this.pool = [];   // { person, active, scheduleEnable, scheduleRecycle, visible }
    this._timer = 0;
  }

  _freeItem() {
    for (const item of this.pool) if (!item.active) return item;
    if (this.pool.length >= this.maxPopulation) return null;
    // Pool items are IDENTITY-LESS shells; RandomiseNPC rolls at every
    // spawn (audit 2026-08-17 - recycled walkers come back as someone
    // else, and 1/32 of them as guards).
    const item = { person: this.makePerson(GUARD_TEXTURE, false), active: false, scheduleEnable: false, scheduleRecycle: false, visible: false };
    this.pool.push(item);
    return item;
  }

  /** RandomiseNPC, verbatim: Random.Range(0,32)==0 -> a GUARD (male,
   *  variant 0 - texture 399); else gender flip (Range(0,2)==1 ->
   *  female) + one of the four outfit variants. */
  _randomiseNPC(person) {
    if (Math.floor(this.rand() * GUARD_CHANCE_DENOM) === 0) {
      person.setIdentity(GUARD_TEXTURE, true);
      return;
    }
    const tables = PERSON_TEXTURES[this.race] ?? PERSON_TEXTURES.Breton;
    const genderTable = Math.floor(this.rand() * 2) === 1 ? tables.female : tables.male;
    person.setIdentity(genderTable[Math.floor(this.rand() * genderTable.length)], false);
  }

  /** One 10Hz tick (SpawnAvailableMobile + UpdateMobiles). playerPos =
   *  world feet; viewYaw = the camera yaw for the 180-degree gate;
   *  isDay from the world clock. */
  _tick(playerPos, viewYaw, isDay) {
    // SpawnAvailableMobile: nothing spawns unless the player is inside
    // the location rect + 2500 classic units (62.5) - verbatim
    // maxPlayerDistanceOutsideRect (audit 2026-08-17). The rect IS the
    // navgrid extent in the pool's frame.
    const m = POP_SPAWN_RANGE_OUTSIDE_RECT;
    const inRange =
      playerPos[0] >= -m && playerPos[0] <= this.nav.width * NAV_CELL + m &&
      playerPos[2] >= -m && playerPos[2] <= this.nav.height * NAV_CELL + m;
    if (inRange) {
      const [pgx, pgy] = this.nav.worldToNav(playerPos[0], playerPos[2]);
      const item = this._freeItem();
      if (item) {
        const spawn = this.nav.getRandomSpawnPosition(pgx, pgy, POP_SPAWN_RADIUS, 10, this.rand);
        if (spawn) {
          this._randomiseNPC(item.person);   // identity re-rolls EVERY spawn
          item.person.place(spawn[0], spawn[1]);
          item.active = true;
          item.scheduleEnable = true;
          item.visible = false;
        }
      }
    }
    // Promote/recycle
    for (const it of this.pool) {
      if (!it.active) continue;
      const dx = it.person.pos[0] - playerPos[0], dz = it.person.pos[2] - playerPos[2];
      const dist = Math.hypot(dx, it.person.pos[1] - playerPos[1], dz);
      const allowChange = dist > POP_VISIBLE_RANGE || !this._inView(dx, dz, viewYaw);
      if (it.scheduleEnable && allowChange && isDay) { it.scheduleEnable = false; it.visible = true; }
      if (it.person.seekCount > POP_MAX_SEEKS || dist > POP_RECYCLE_DISTANCE || !isDay) it.scheduleRecycle = true;
      if (it.scheduleRecycle && allowChange) {
        it.person.release();
        it.active = false; it.scheduleEnable = false; it.scheduleRecycle = false; it.visible = false;
      }
    }
  }

  _inView(dx, dz, viewYaw) {
    // Within the 180-degree forward view (Vector3.Angle <= 90)
    const fx = Math.sin(viewYaw), fz = Math.cos(viewYaw);
    return dx * fx + dz * fz > 0;
  }

  /** Per-frame drive; ticks at 10Hz internally. Returns the LIVE
   *  renderable persons (active + visible + moveCount > 0 per the
   *  anti-skate rule; the person.update itself runs per frame). */
  update(dt, playerPos, viewYaw, cameraPos, isDay, wantsToStopFn = () => false) {
    // PopulationManager.Update verbatim: the timer RESETS to zero on
    // fire - at most ONE tick per frame, remainder dropped (audit
    // 2026-08-17: the accumulator catch-up burst was a departure - a
    // slow frame must not spawn a crowd).
    this._timer += dt;
    if (this._timer >= 1 / POP_TICKS_PER_SECOND) {
      this._timer = 0;
      this._tick(playerPos, viewYaw, isDay);
    }
    const out = [];
    for (const it of this.pool) {
      if (!it.active || !it.visible) continue;
      const frameOut = it.person.update(dt, cameraPos, wantsToStopFn(it.person));
      if (it.person.moveCount > 0) out.push({ person: it.person, out: frameOut });
    }
    return out;
  }
}
