// SURV3 - THE CAMP: a tent or a fire on the ground, PURE. What the
// mod had (Climates & Calories 1.7.1, read off the DLL: Camping.
// SetUpCamp / DeployTent / DestroyCamp / CampfireCook, the tent as
// model 41606 and the fire as TEXTURE.210 record 1) rebuilt on Mac's
// brief (2026-09-18): "For tents, they are shared world objects.
// Campfires in dungeons/outside + beds should act as the go-to rest
// options + adding a new campfire item players can buy and place."
//
// TWO KINDS. A TENT is Camping Equipment pitched: a model, a fire in
// front of it, and a wear counter (the gear's uses left) that comes
// back with the gear when it is packed. A FIRE is one light off a
// Campfire Kit: the same fire without the tent, and when it burns
// down it is gone - the kit's use is spent at the placing, not the
// packing. A tent's fire can be stoked (a rest stokes it); a kit's
// cannot.
//
// WHERE. Not in a building (the mod's "You cannot set up camp in
// here"), not in a town (its "It is illegal to camp in town" - and
// DFU's own rest law makes it a crime, restSession.js), not with
// enemies near (DFU's AreEnemiesNearby, the resting variant), not in
// water, and only where the ground answers a probe; a dungeon takes a
// fire and no tent (Mac: "Campfires in dungeons/outside").
//
// WHAT IT DOES. A lit fire within BY_FIRE_REACH is the needs law's
// `byFire` (survival/needs.js: fifteen degrees of warmth, drying,
// and the rest law's sleep at a camp - SURV4). Cooking turns a raw
// food into its cooked one, a stage nearer fresh, in COOK_MINUTES (a
// skillet halves it). Packing returns the gear with its wear.
//
// ONLINE. A camp is a record the host's pool carries; in a world room
// (a dungeon) it rides the act frame and the room's memory, in a cell
// (the open world) it rides its owner's foes frame and lives while
// the owner does - the cell's own law for everything its players
// stand. `validCampRecord` is the door every one of them comes in by.
import { wrapAngle } from '../../world/mat4.js';
import { POSE_BOUND, POSE_Y_BOUND } from '../../net/wire.js';
import { TEMPLATE, foodOf, foodStage, isFood } from './food.js';
import { createSurvivalItem, dressFood, isCampingEquipment, isCampfireKit, isSkillet, SURVIVAL_USE_TEXT } from './items.js';
import { isEmberJar, EMBER_JAR_MINUTES, REST_ITEM_TEXT } from '../restItems.js';   // REST6: the Ember Jar's one-night fire

/** The mod's tent (Camping.DeployTent: CreateDaggerfallMeshGameObject(41606)). */
export const TENT_MODEL = 41606;
/** The mod's fire: TEXTURE.210 record 1, the town brazier's flame, at the lights archive's 12 fps. */
export const FIRE_FLAT = Object.freeze({ archive: 210, record: 1 });
/** A fire's light: a town light's 18 is a street lamp; a campfire is a hearth. */
export const FIRE_LIGHT_RANGE = 12;
/** RegisterCustomActivation's reach, the default 3.2. */
export const CAMP_REACH = 3.2;
/** Within this of a lit fire you are BY it (the needs law's warmth and drying). */
export const BY_FIRE_REACH = 4;
/** The camp goes this far in front of the feet. */
export const PLACE_AHEAD = 2.5;
/** The tent stands this far behind its fire. */
export const TENT_BEHIND = 2.2;
/** The ground probe: from a unit up, this far down. */
export const GROUND_PROBE = 6;
/** A fire burns eight hours from the lighting or the last stoking. */
export const FIRE_MINUTES = 480;
/** Cooking one food, and with a skillet (SURVIVAL_USE_TEXT.skillet: "twice as fast"). */
export const COOK_MINUTES = 30;
export const SKILLET_COOK_MINUTES = 15;
/** One owner stands at most this many camps at once (the wire's bound too). */
export const CAMPS_PER_OWNER = 4;
export const CAMP_KIND = Object.freeze({ Tent: 'tent', Fire: 'fire' });

export const CAMP_TEXT = Object.freeze({
  noTentBelow: 'There is no room to pitch a tent down here. A fire will do.',
  inWater: 'You cannot make camp in the water.',
  noGround: 'There is no level ground here.',
  tooMany: 'You have enough camps standing already.',
  // CAMP-SILENT: the host could not say where the player is standing.
  // It should never happen; the point is that it cannot happen SILENTLY
  // (a player reported camping kits that "don't work", and a refusal
  // with no words is indistinguishable from a broken item).
  noSpot: 'You cannot find anywhere to make camp.',
  // AUDIT SURV-TIERS: with the arc Off a player's own camp could be
  // neither seen nor used (scenes/camps.js `seen`, `shown`), so none is
  // stood - and the refusal names the one thing that would change it,
  // CAMP-SILENT's law.
  arcOff: 'Turn Climates & Calories on to make camp.',
  pitched: 'You pitch your tent and light a fire.',
  lit: 'You light a campfire.',
  kitSpent: 'That was the last of your campfire kit.',
  packed: 'You pack up your camp.',
  stamped: 'You stamp out the fire.',
  notYours: 'This is not your camp to pack.',
  stoked: 'You stoke the fire.',
  cold: 'The fire has burned down to embers.',
  cooked: (name) => `You cook the ${name}.`,
  wornOut: 'Your camping equipment is worn out.',
  nothingToCook: 'You have nothing to cook.',
  seeOwnCamp: 'You see your camp.',
  seeCamp: 'You see a camp.',
  seeOwnFire: 'You see your campfire.',
  seeFire: 'You see a campfire.',
  seeEmbers: 'You see the embers of a fire.',
  seeHearth: 'You see a fire burning.',   // HEARTH1: the world's own, which is nobody's to pack
  menuRest: 'Rest here',
  // AUDIT SURV-TIERS (the third pass): the menu reaches further than the fire warms - the rest is the fire's
  restCloser: 'Move closer to the fire to rest here.',
  menuCook: 'Cook food',
  menuStoke: 'Stoke the fire',
  menuPack: 'Pack up the camp',
  menuStamp: 'Put out the fire',
  // REST2 (bible/06-Systems/Rest-Arc.md section 3): THE CAMPFIRE IS A TOOL, NOT A MATCH - placed free, its charges
  // spent by the nights its owner sleeps at it, picked back up, relit while it has fuel
  menuPickUp: 'Pick up the campfire',
  menuRelight: 'Relight the fire',
  pickedUp: 'You pick up your campfire.',
  relit: 'You relight the fire.',
  noFuel: 'Your campfire has no fuel left.',
  outOfFuel: 'Your campfire burns the last of its fuel.',
  embersOut: 'The embers die out.',   // AUDIT REST: an Ember Jar's one night
  carriedOut: 'You take your Campfire with you.',   // AUDIT REST F1: leaving a dungeon with yours standing
  campWorn: 'Your camping equipment wears through.',
  fuelLeft: (n) => `${n} ${n === 1 ? 'night' : 'nights'} of fuel`,
});

/**
 * Where a camp may go. `place` = { insideBuilding, insideDungeon,
 * inTown, enemiesNearby, inWater, ground } - `ground` the probe's
 * answer (a y, or null). Returns { ok, text }.
 */
export function campDecision(kind, place = {}) {
  if (place.insideBuilding) return { ok: false, text: SURVIVAL_USE_TEXT.campingIndoors };
  if (place.inTown) return { ok: false, text: SURVIVAL_USE_TEXT.campingTown };
  if (place.enemiesNearby) return { ok: false, text: SURVIVAL_USE_TEXT.campingFoes };
  if (kind === CAMP_KIND.Tent && place.insideDungeon) return { ok: false, text: CAMP_TEXT.noTentBelow };
  if (place.inWater) return { ok: false, text: CAMP_TEXT.inWater };
  if (!Number.isFinite(place.ground)) return { ok: false, text: CAMP_TEXT.noGround };
  return { ok: true, text: null };
}

/** The spot: PLACE_AHEAD in front of the feet along the yaw (the port's forward is [sin yaw, 0, cos yaw]), on the ground the probe finds. */
export function campSpot(feet, yaw, probe) {
  const x = feet[0] + Math.sin(yaw) * PLACE_AHEAD, z = feet[2] + Math.cos(yaw) * PLACE_AHEAD;
  const top = feet[1] + 1;
  const d = probe ? probe([x, top, z], [0, -1, 0], GROUND_PROBE) : null;
  const ground = Number.isFinite(d) && d <= GROUND_PROBE ? top - d : null;
  return { pos: [x, ground ?? feet[1], z], ground };
}

/** The tent's own spot: behind the fire, facing it. */
export const tentPos = (camp) => [camp.pos[0] - Math.sin(camp.yaw) * TENT_BEHIND, camp.pos[1], camp.pos[2] - Math.cos(camp.yaw) * TENT_BEHIND];

/** A fresh record. `wear` is the gear's uses left (a tent); a fire carries none. */
export function newCamp({ id, owner = null, kind = CAMP_KIND.Fire, pos, yaw = 0, now = 0, wear = 0 }) {
  return { id: String(id), owner, kind, pos: [pos[0], pos[1], pos[2]], yaw: wrapAngle(yaw), litUntil: now + FIRE_MINUTES, wear: wear | 0, placedAt: now };
}
export const fireLit = (camp, now) => Number.isFinite(camp?.litUntil) && now < camp.litUntil;
/** A tent's fire is stoked for FIRE_MINUTES past `from` (a rest's end). REST2: and a Campfire relit while it has
 *  fuel (a charge left) - a cold one with none waits for Firewood. */
export function stokeFire(camp, from) {
  if (!camp) return false;
  if ((camp.wear | 0) <= 0) return false;   // REST2: no fuel, no fire - AUDIT REST F8: and a worn-through tent's neither
  camp.litUntil = Math.max(camp.litUntil ?? 0, from) + FIRE_MINUTES;
  return true;
}
/** REST2: NO CAMP BURNS AWAY. A Campfire that burns down goes cold and stands, its charges intact, for its owner to
 *  relight or pick up; a tent stands cold as it always did. [SUPERSEDES SURV3's kit fire, gone at its minute.] A
 *  peer's camps still go with their owner (scenes/camps.js sweepOwners). */
export const campExpired = (camp, now) => camp?.kind === CAMP_KIND.Fire && !camp.fuel && !fireLit(camp, now);   // REST6: a fire with no fuel of its own - an Ember Jar's, AUDIT REST F12: an old save's kit fire - goes with its embers

/** REST2: a night its owner slept at it spends one charge (a Campfire's fuel, a tent's wear). A Campfire whose last
 *  charge is spent goes cold. Answers { spent, empty } - nothing at all for a camp with none to spend. */
export function spendCampNight(camp, now) {
  if (!camp || (camp.wear | 0) <= 0) return { spent: false, empty: true };
  camp.wear = (camp.wear | 0) - 1;
  const empty = camp.wear <= 0;
  if (empty) camp.litUntil = now;   // AUDIT REST F8: the last night leaves a tent cold too - nothing left to stoke
  return { spent: true, empty };
}

/**
 * USE the placeable off the pack: the decision, the item off `list`
 * with its uses riding the record (REST2: none spent), the record. `ctx` =
 * { now, owner, feet, yaw, probe, place, standing (this owner's count), id,
 *   keep (PROF9's Field Cook - a kit lit without its charge spent, Professions-Arc 3.3; REST2 spends no charge on any
 *   placing, so it changes nothing here - kept for its callers, the perk's meaning is Mac's to give again) }.
 * Returns { ok, text, camp, spent }.
 */
export function placeCampItem(item, list, { now = 0, owner = null, feet = [0, 0, 0], yaw = 0, probe = null, place = {}, standing = 0, id = null, keep = false } = {}) {   // `keep`: PROF9's, moot under REST2 (above)
  const jar = isEmberJar(item);   // REST6: one night's fire, EMBER_JAR_MINUTES lit, never picked up
  const kind = isCampingEquipment(item) ? CAMP_KIND.Tent : isCampfireKit(item) || jar ? CAMP_KIND.Fire : null;
  if (!kind) return { ok: false, text: null, camp: null, spent: false };
  if (standing >= CAMPS_PER_OWNER) return { ok: false, text: CAMP_TEXT.tooMany, camp: null, spent: false };
  const spot = campSpot(feet, yaw, probe);
  const d = campDecision(kind, { ...place, ground: spot.ground });
  if (!d.ok) return { ok: false, text: d.text, camp: null, spent: false };
  // REST2: placing spends nothing - a night slept at it does (spendCampNight). The item leaves the pack while it
  // stands, a Campfire as a tent always has, and comes back with its charges when it is picked up.
  // AUDIT SURV A: the fiftieth night was the last; a Campfire with no fuel waits for Firewood
  const uses = Math.max(0, item.currentCondition ?? 1);
  if (uses <= 0) return { ok: false, text: kind === CAMP_KIND.Fire ? CAMP_TEXT.noFuel : CAMP_TEXT.wornOut, camp: null, spent: false };
  const camp = newCamp({ id: id ?? `${owner ?? 'me'}:${now}`, owner, kind, pos: spot.pos, yaw, now, wear: jar ? 1 : uses });
  if (jar) {
    camp.jar = true; camp.litUntil = now + EMBER_JAR_MINUTES;
    if ((item.stackCount ?? 1) > 1) item.stackCount -= 1; else { const j = Array.isArray(list) ? list.indexOf(item) : -1; if (j >= 0) list.splice(j, 1); }
    return { ok: true, text: REST_ITEM_TEXT.emberLit, camp, spent: true };
  }
  if (kind === CAMP_KIND.Fire) camp.fuel = true;   // AUDIT REST F12: a Campfire's own fuel - cold, it stands (an old save's kit fire, none, is swept)
  const i = Array.isArray(list) ? list.indexOf(item) : -1;
  if (i >= 0) list.splice(i, 1);
  const text = kind === CAMP_KIND.Tent ? CAMP_TEXT.pitched : CAMP_TEXT.lit;
  return { ok: true, text, camp, spent: false };
}

/** PACK a camp: the gear back with its wear (a tent) - REST2: and a Campfire back with its charges. Returns { item, text }. */
export function packCamp(camp) {
  const tent = camp?.kind === CAMP_KIND.Tent;
  if (!tent && (camp?.kind !== CAMP_KIND.Fire || !camp.fuel)) return { item: null, text: CAMP_TEXT.stamped };   // AUDIT REST-PARTY B5: a fire with no fuel of its own (a kit's, an Ember Jar's) is stamped out, never minted into a Campfire
  const item = createSurvivalItem(tent ? TEMPLATE.CampingEquipment : TEMPLATE.Campfire);
  if (item) item.currentCondition = Math.max(0, Math.min(item.maxCondition ?? camp.wear, camp.wear | 0));
  return { item, text: tent ? CAMP_TEXT.packed : CAMP_TEXT.pickedUp };
}

/** The raw foods in a pack (the FOOD table's `cooks` column names what they become). */
export const cookables = (items) => (items ?? []).filter((it) => isFood(it) && foodOf(it)?.cooks != null);
export const hasSkillet = (items) => (items ?? []).some(isSkillet);
/**
 * COOK one: the cooked food minted a stage nearer fresh, one raw off
 * the pack, the cooked one in. Returns { item, minutes, text } or null.
 */
export function cookFood(item, list, { skillet = false } = {}) {
  const f = foodOf(item);
  if (!f?.cooks) return null;
  const rawName = item.name;   // AUDIT SURV E: the line names what went on the fire
  const cooked = createSurvivalItem(f.cooks, { foodStage: Math.max(0, foodStage(item) - 1) });
  if (!cooked) return null;
  dressFood(cooked);
  if (Array.isArray(list)) {
    if ((item.stackCount ?? 1) > 1) item.stackCount -= 1;
    else { const i = list.indexOf(item); if (i >= 0) list.splice(i, 1); }
    list.push(cooked);
  }
  return { item: cooked, minutes: skillet ? SKILLET_COOK_MINUTES : COOK_MINUTES, text: CAMP_TEXT.cooked(rawName) };
}

/** The nearest LIT fire within `reach` of `pos`, or null. */
export function nearestFire(camps, pos, now, reach = BY_FIRE_REACH) {
  let best = null, bestD = reach;
  for (const c of camps ?? []) {
    if (!fireLit(c, now)) continue;
    const d = Math.hypot(c.pos[0] - pos[0], c.pos[1] - pos[1], c.pos[2] - pos[2]);
    if (d <= bestD) { best = c; bestD = d; }
  }
  return best;
}
export const byFire = (camps, pos, now) => !!nearestFire(camps, pos, now);

/** What the eye sees (Info and Talk modes). */
export function campInfoText(camp, now, mine) {
  if (camp.kind === CAMP_KIND.Tent) return mine ? CAMP_TEXT.seeOwnCamp : CAMP_TEXT.seeCamp;
  if (!fireLit(camp, now)) return CAMP_TEXT.seeEmbers;
  return mine ? CAMP_TEXT.seeOwnFire : CAMP_TEXT.seeFire;
}
/** The menu's rows: rest and cook at any camp; stoke a cold tent; REST2: relight your own cold Campfire while it has
 *  fuel; pack your tent, or pick your Campfire up. The keys are the plaque's action ids (REST2: the loot plaque's rows). */
export function campMenu(camp, now, mine) {
  const rows = [{ key: 'rest', text: CAMP_TEXT.menuRest }, { key: 'cook', text: CAMP_TEXT.menuCook }];
  if (camp.kind === CAMP_KIND.Tent && !fireLit(camp, now) && (camp.wear | 0) > 0) rows.push({ key: 'stoke', text: CAMP_TEXT.menuStoke });
  if (camp.kind === CAMP_KIND.Fire && mine && !camp.jar && !fireLit(camp, now) && (camp.wear | 0) > 0) rows.push({ key: 'stoke', text: CAMP_TEXT.menuRelight });
  if (mine && !camp.jar && (camp.kind === CAMP_KIND.Tent || !!camp.fuel)) rows.push({ key: 'pack', text: camp.kind === CAMP_KIND.Tent ? CAMP_TEXT.menuPack : CAMP_TEXT.menuPickUp });   // AUDIT REST-PARTY B5: never an old save's kit fire (no fuel of its own: AUDIT REST F12 - it burns away as it always did; picked up, it was a second Campfire from nothing)
  return rows;
}

// ---- THE WIRE --------------------------------------------------------
const ID_RE = /^[A-Za-z0-9_:.-]{1,48}$/;
const q2 = (v) => Math.round(v * 100) / 100;
const q3 = (v) => Math.round(v * 1000) / 1000;
/** One camp as its owner says it: i the id, k the kind (0 tent, 1 fire), p the world frame's [x, y, z], y the yaw, u the minute its fire dies, w the wear. */
export const campWire = (camp, toWire = (p) => p) => {
  const p = toWire(camp.pos);
  return { i: camp.id, k: camp.kind === CAMP_KIND.Tent ? 0 : 1, p: [q2(p[0]), q2(p[1]), q2(p[2])], y: q3(camp.yaw), u: Number.isFinite(camp.litUntil) ? Math.round(camp.litUntil) : -1, w: camp.wear | 0 };
};
/** The record projected, or null: a field outside its law refuses the record WHOLE (wire.js's rule). */
export function validCampRecord(r) {
  if (!r || typeof r !== 'object' || Array.isArray(r)) return null;
  if (typeof r.i !== 'string' || !ID_RE.test(r.i)) return null;
  if (r.k !== 0 && r.k !== 1) return null;
  if (!Array.isArray(r.p) || r.p.length !== 3 || !r.p.every(Number.isFinite)) return null;
  if (Math.abs(r.p[0]) > POSE_BOUND || Math.abs(r.p[2]) > POSE_BOUND || Math.abs(r.p[1]) > POSE_Y_BOUND) return null;
  if (!Number.isFinite(r.y)) return null;
  if (!Number.isFinite(r.u) || r.u < -1 || r.u > 2 ** 31) return null;
  if (!Number.isInteger(r.w) || r.w < 0 || r.w > 255) return null;
  return { i: r.i, k: r.k, p: [r.p[0], r.p[1], r.p[2]], y: wrapAngle(r.y), u: r.u, w: r.w };
}
/** A projected record as a camp of `owner`, in this scene's frame. */
export function campFromWire(r, owner, toScene = (p) => p) {
  const p = toScene(r.p);
  return { id: r.i, owner, kind: r.k === 0 ? CAMP_KIND.Tent : CAMP_KIND.Fire, pos: [p[0], p[1], p[2]], yaw: r.y, litUntil: r.u < 0 ? null : r.u, wear: r.w, placedAt: null };
}
/** An owner's word replaces that owner's camps and no one else's; at most CAMPS_PER_OWNER of them. */
export function mergeOwnerCamps(camps, owner, records, toScene = (p) => p) {
  const kept = (camps ?? []).filter((c) => c.owner !== owner);
  const fresh = [];
  for (const raw of Array.isArray(records) ? records : []) {
    const r = validCampRecord(raw);
    if (!r || fresh.some((c) => c.id === r.i)) continue;
    fresh.push(campFromWire(r, owner, toScene));
    if (fresh.length >= CAMPS_PER_OWNER) break;
  }
  return [...kept, ...fresh];
}
