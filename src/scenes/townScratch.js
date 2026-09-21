// ═══════════════════════════════════════════════════════════════════
// PERF-TOWN1 (2026-09-20) - THE TOWN LOOP'S SCRATCH, for both outdoor
// hosts.
//
// Mac: "I noticed ingame the exterior is really heavy rn". The
// `?perf=cpu` line named it - `people` swinging 1.14 to 7.36 ms a
// frame against a `sim` steady at 2-3 - and a zone that varies
// fourfold frame to frame is not doing four times the work. It is
// minting garbage and meeting the collector. The loop minted THIRTEEN
// objects per person per frame, none of which outlived it.
//
// This is where they went. Every seat below is written through rather
// than replaced; the arithmetic above them is untouched.
//
// A MODULE, and not twenty lines in each host, for a reason that has
// nothing to do with tidiness: the two hosts are the most heavily
// CITED files in the port, and a block inserted in the middle of one
// moves every line number below it. The first cut of this change put
// the scratch inline and cost an afternoon of re-resolving comments
// that pointed at the wrong lines afterwards. A factory the host
// calls in three lines shifts almost nothing.
//
// `foes` is the host's own live pool - the streaming host joins its
// enchanted foes, the fixed-city host its exterior pool - so the
// politeness gate keeps asking each host its own question.
//
// It is a THUNK and both hosts wrap their pool in one, because the
// scratch is built near the top of a scene and the pools are declared
// hundreds of lines below it: handing the function over directly reads
// a `const` in its temporal dead zone and throws "Cannot access X
// before initialization" the moment the scene runs. Lint, the build
// and the whole suite pass on that; test/tdz.test.js is what catches
// it, and did.
// ═══════════════════════════════════════════════════════════════════
import { personWantsToStop } from '../characters/mobilePerson.js';

/**
 * @param {{ areEnemiesNearby: (pool:any) => boolean, foes: () => any }} deps
 */
export function createTownScratch({ areEnemiesNearby, foes }) {
  // where the camera is, in the pixel being walked - rewritten per
  // pixel, read by `update` and by the stop question, kept by neither
  const local = [0, 0, 0];
  // personWantsToStop's argument and its `enemiesNearby` closure, both
  // of which were minted per person per frame for a predicate that
  // reads them once
  const opts = {
    playerStandingStill: false, distanceToPlayer: Infinity, sheathed: false,
    invisible: false, inBeastForm: false,
    enemiesNearby: () => areEnemiesNearby(foes()),
  };
  // the {person, pos} rows the activation ray walks
  const seats = [];
  return {
    local,
    opts,
    /** The host fills the four terms that do not vary by person. They
     *  are written EVERY frame and not once at construction: a sheathed
     *  weapon or a beast form that changes has to be seen at once. */
    gate(playerStandingStill, sheathed, invisible, inBeastForm) {
      opts.playerStandingStill = playerStandingStill;
      opts.sheathed = sheathed;
      opts.invisible = invisible;
      opts.inBeastForm = inBeastForm;   // MobilePersonMotor.cs:222,224 - PlayerEntity.IsInBeastForm (PlayerEntity.cs:193)
    },
    /** The per-person callback `TownPopulation.update` calls. */
    stops(person) {
      // sqrt of the two squares rather than Math.hypot: hypot is
      // written to survive overflow at the extremes of the float range
      // and charges for it on every call, and these are two world
      // coordinates a few hundred units apart.
      const dx = person.pos[0] - local[0], dz = person.pos[2] - local[2];
      opts.distanceToPlayer = Math.sqrt(dx * dx + dz * dz);
      return personWantsToStop(opts);
    },
    /** Row `i` of the activation list, minted once and refilled. */
    seat(i) { return seats[i] ??= { person: null, pos: null }; },
  };
}

/**
 * The texture-cache probe's key, memoised on the three numbers it is
 * made of - it was a template string per person per frame.
 *
 * THE WHOLE WIN IS A CACHE HIT, so this must answer byte-for-byte the
 * key the uploader wrote: one differing by a separator would miss every
 * frame and re-upload every frame, which is slower than what it
 * replaced and invisible. The index packs 1024 frames to a record and
 * 4096 records to an archive - a classic archive has tens of records
 * and a handful of frames, three orders clear.
 */
export function createPersonTextureKeys() {
  const keys = new Map();
  return (archive, record, frame) => {
    const k = (archive * 4096 + record) * 1024 + frame;
    let v = keys.get(k);
    if (v === undefined) { v = `${archive}_${record}#${frame}`; keys.set(k, v); }
    return v;
  };
}
