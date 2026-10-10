// @ts-check
// MWNPC10 (2026-10-09, the MW-NPC arc's tenth slice - bible/04-Characters/Morrowind-NPCs.md section 15): AN ACTOR FOR A
// POPULATION THAT KEEPS NO FOE RECORD. The gate's boss and host, the siege's people, a ship's crew are driven by a relay
// or a roster, not by a foe pool: no `_atkA` attack count, no hit flash marks, no entity. What their hosts DO change is a
// key a frame - the relay's attack time, the time a blow met them - so the actor keeps its own counts on the record,
// one more each time a key changes to a new value (a NaN is no key, and a held value never counts twice), and the
// lane's swing and recoil follow them as they follow a foe's. The look is the caller's (a creature's off its mobile,
// characters/creatureBodies.js; a person's).
import { rosterLook } from './foeBodies.js';
import { folkLookOf } from './folkBodies.js';
import { PEOPLE_WARDROBE } from './peopleBodies.js';
import { EQUIP_SLOTS } from '../systems/equip.js';
import { textSeed } from '../systems/livingWorld/seed.js';

/** A key a host changed: a finite number or a string is one; null, undefined and NaN are none. */
const keyOf = (k) => (typeof k === 'string' || Number.isFinite(k) ? k : null);

/**
 * The actor the lane stands for `rec`, one object a record rewritten each frame (characters/npcBodies.js `stand`):
 * `swingKey` a value that changes when it strikes (the relay's attack time), `hitKey` one that changes when it is hurt,
 * `dead` 0 standing or the death's roll + 1, `scale` its size over its body's (the gate's boss stands three times
 * a man). Drawn - these are fighters or stand like them - unless `drawn` says not (MWNPC10c: a resident in their
 * clothes carries nothing to draw).
 * @param {any} rec
 * @param {{ id: any, look: any, feet: number[], yaw: number, moving?: boolean, running?: boolean, swingKey?: any,
 *   hitKey?: any, dead?: number, scale?: number, drawn?: boolean }} o
 */
export function rosterActor(rec, { id, look, feet, yaw, moving = false, running = false, swingKey = null, hitKey = null, dead = 0, scale = 1, drawn = true }) {
  const a = rec._mwActor ??= { id, look: null, feet: null, yaw: 0, moving: false, running: false, drawn: true, swings: 0, strike: 1, casts: 0, castRange: 2, hits: 0, dead: 0, scale: 1 };
  a.id = id; a.look = look; a.feet = feet; a.yaw = Number.isFinite(yaw) ? yaw : 0; a.drawn = !!drawn;
  a.moving = !!moving; a.running = !!moving && !!running;
  const sk = keyOf(swingKey), hk = keyOf(hitKey);
  if (sk !== rec._mwSwingKey) { if (sk !== null) a.swings = (a.swings + 1) & 0xffff; rec._mwSwingKey = sk; }
  if (hk !== rec._mwHitKey) { if (hk !== null) a.hits = (a.hits + 1) & 0xffff; rec._mwHitKey = hk; }
  a.strike = 1 + (a.swings % 6);   // POSE_STRIKES 1..6, off the count as a foe's is
  a.dead = dead > 0 ? dead | 0 : 0;
  a.scale = scale > 0 ? scale : 1;
  return a;
}

/** MWNPC10c: what a still picture's kind wears (LW-LOOKS - systems/livingWorld/looks.js: a courtier at home in the
 *  palace, a priest at the temple's door, a stall-keeper at their stall); a beggar and the rest the street's outfit.
 *  Keyed by the resident's job - a street's still picture is their job's kind (looks.js stillRoleOf: a priest's, a
 *  stall's merchant's), a room's flat their job's too (world/travellerSprites.js). */
const STILL_WARDROBE = Object.freeze({ courtier: 'noble', priest: 'priest', keeper: 'merchant', merchant: 'merchant' });

/**
 * MWNPC10c (bible/04-Characters/Morrowind-NPCs.md section 15c): ONE OF THE LIVING WORLD'S PEOPLE AS THEIR SPRITE SHOWS
 * THEM (systems/livingWorld/census.js's resident, or a road's foe - world/travellerSprites.js draws both): in a class's
 * sprite (`cls` - an armed traveller, a guild's member, a foe) that class's look (foeBodies.js rosterLook) in their
 * own race and sex, a foe in the Bay's; a STILL picture their kind's garments (a courtier a noble's, in their dyes);
 * everyone else the street's outfit their own sprite wears (folkBodies.js folkLookOf: their archive and face - the
 * watch's plate on duty, his own clothes off it) - each off their own id's seed, so they are one person wherever they
 * are drawn (never a walker's per-spawn roll). `rec` keeps what it reads - the sprites ask once a body.
 * AUDIT MW-NPC II K1: what the sprite wears NOW is the caller's - `cls` the class it is armed in (default the
 * resident's own), `guard` the watch's uniform on (his own clothes off it), `still` a still picture.
 * @param {any} rec @param {any} res @param {{ still?: boolean, cls?: number|null, guard?: boolean }} [o]
 */
export function residentLook(rec, res, { still = false, cls = res.cls, guard = false } = {}) {
  const seed = textSeed(String(res.id));
  if (cls != null) return rosterLook(rec, { mobileType: cls, gender: res.sex === 'female' ? 'female' : 'male', seed, race: res.race });
  const kind = still ? STILL_WARDROBE[res.job] : undefined;
  if (kind) {
    const female = res.sex === 'female', gender = female ? 'female' : 'male', group = female ? 'WomensClothing' : 'MensClothing';
    const W = PEOPLE_WARDROBE[kind], outfit = W[gender], dye = (k) => W.dyes[((seed ^ k) >>> 0) % W.dyes.length];
    const items = /** @type {any[]} */ ([{ templateIndex: outfit[0], group, equipSlot: EQUIP_SLOTS.ChestClothes, dye: dye(0xd1) }]);
    if (outfit[1] != null) items.push({ templateIndex: outfit[1], group, equipSlot: EQUIP_SLOTS.LegsClothes, dye: dye(0xd2) });
    items.push({ templateIndex: outfit[2], group, equipSlot: EQUIP_SLOTS.Feet, dye: dye(0xd3) });
    return { race: res.race ?? 'Breton', gender, faceIndex: seed % 10, items };
  }
  return folkLookOf({ archive: guard ? res.archive : (res.civvies ?? res.archive), personFaceRecordId: res.face ?? 0, gender: res.gender ?? 0, guard }, res.race ?? 'Breton', seed);   // WATCH-DAY: on duty in the uniform, off it in his own clothes, as his sprite is
}

/**
 * AUDIT MW-NPC C4: A RESIDENT WALKING THE STREET - a pooled walker the living town dressed as one of its residents
 * (systems/livingWorld/livingTown.js _dress: `person.living.res`) - stands as that resident: their own id and
 * residentLook's look off it, never the pool row's spawn. folkActor seeded the look off the row (folkBodies.js
 * spawnOf's shell), so one resident wore other dyes on another row, another face indoors or on the road, and another
 * on another machine. Walking as the walker walks, facing its way, carrying what their sprite carries.
 *
 * AUDIT MW-NPC II K1: IN WHAT THE ROW WEARS NOW. The town dresses the row as the day goes (livingTown.js): the watch's
 * uniform on duty and his own clothes off it (`guard`), a guild's member or a priest in their class's gear (`cls`, the
 * one it is armed in - looks.js townClassOf), a still picture where they keep their place (`stillLook`, its kind
 * `stillRole`). The look was read once off the resident alone, so an on-duty watchman stood in his own clothes, a
 * knight of an order and a priest in a shirt, and a priest at the temple's door in no robes. Read again whenever the
 * dress changes. A BEGGAR's picture sits or lies at their pitch, and no body does: null - their picture stands.
 * @param {any} person @param {number[]} feet @returns {any} the actor, or null (the picture stands)
 */
export function residentWalkerActor(person, feet) {
  const res = person.living.res;
  const role = person.stillLook ? (person.stillRole ?? null) : null;
  if (role === 'beggar') return null;
  const cls = person.stillLook ? null : (person.cls ?? null);
  const guard = !!person.guard;
  const still = !!person.stillLook;
  let k = person._mwRes;
  if (!k || k.res !== res || k.cls !== cls || k.guard !== guard || k.still !== still) k = person._mwRes = { res, look: null, cls, guard, still };   // a compare a frame, no allocation
  k.look ??= residentLook(k, res, { still, cls, guard });
  return rosterActor(k, { id: `res:${res.id}`, look: k.look, feet, yaw: Number.isFinite(person.yaw) ? person.yaw : (person.facingYaw ?? 0),
    moving: person.state === 'move', drawn: cls != null });
}

