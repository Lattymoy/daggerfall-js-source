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
/** One owner stands at most this many camps at once (the wire's bound too). FIELD BUGS 2026-10-04d CAMP-CAP: a placing
 *  at it is never refused - it strikes the owner's oldest (placeCampItem's `strike`, strikeCamp). */
export const CAMPS_PER_OWNER = 4;
export const CAMP_KIND = Object.freeze({ Tent: 'tent', Fire: 'fire' });

export const CAMP_TEXT = Object.freeze({
  noTentBelow: 'There is no room to pitch a tent down here. A fire will do.',
  inWater: 'You cannot make camp in the water.',
  noGround: 'There is no level ground here.',
  // FIELD BUGS 2026-10-04d CAMP-CAP: the cap's refusal ("You have enough camps standing already.") locked a character
  // out of camping for good with four left anywhere in the world - a placing at the cap strikes the oldest instead
  struckCamp: 'Your oldest camp is packed away.',
  struckFire: 'Your oldest Campfire is packed away.',
  struckOut: 'Your oldest fire is put out.',
  // DECK-CAMP: a camp of yours on a boat that is no more (packed, laid up, sailed off with her owner) - back in the pack
  packedWithBoat: 'Your camp aboard was struck and stowed in your pack.',
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
  seeOwnFire: 'You see your Campfire.',
  seeFire: 'You see a campfire.',
  seeOwnJar: 'You see your Ember Jar fire.',   // AUDIT REST III B5: as its hover names it (AUDIT REST II H13)
  seeJar: 'You see an Ember Jar fire.',
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
  menuPickUp: 'Pick up the Campfire',   // AUDIT REST II H13: the item's own name, as the hover and the card say it
  menuRelight: 'Relight the fire',
  pickedUp: 'You pick up your Campfire.',
  relit: 'You relight the fire.',
  noFuel: 'Your Campfire has no fuel left.',
  outOfFuel: 'Your Campfire burns the last of its fuel.',
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

// ---- DECK-CAMP (2026-10-04, from the field: "Campfires placed on a boat dont attach to a boat") --------------------
/**
 * A CAMP ON A BOAT'S DECK RIDES HER. Come Sail Away's boats stand in the world's collider (world.js csaSyncColliders), so
 * a camp's spot found her deck - and the camp kept the scene point it was stood at while she sailed on from under it.
 * A camp placed on a boat (the host's `deck.at`) carries `deck`: WHICH boat - `{ mine: true, uid }` one of this
 * player's own, `{ peer, uid }` another player's (their online id), by her number (the deed's UID: a boat object never
 * outlives a load, comeSailAway.js applySaveData) - and WHERE on her: `local`, the point in her deck's frame (her mesh
 * node's, navalDeck.js intoDeck - the swell's roll and pitch with it), and `yaw`, the camp's heading less hers. The
 * pool poses it off her each frame (scenes/camps.js ride). Sea ships and a boat with no number take none.
 */
/** The farthest a deck's point stands off her node (m) - a Carrack's half length and more, never the world's bounds. */
export const DECK_LOCAL_BOUND = 120;
export const DECK_LOCAL_Y_BOUND = 60;
const ID_OK = /^[A-Za-z0-9_:.-]{1,48}$/;
/** A deck address projected, or null - the save's and the restore's law (the wire's is validCampRecord's `d`). */
export function validDeck(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
  const mine = d.mine === true;
  if (!mine && !(typeof d.peer === 'string' && ID_OK.test(d.peer))) return null;
  if (!Number.isSafeInteger(d.uid) || d.uid < 1) return null;
  const l = d.local;
  if (!Array.isArray(l) || l.length !== 3 || !l.every(Number.isFinite)) return null;
  if (Math.abs(l[0]) > DECK_LOCAL_BOUND || Math.abs(l[2]) > DECK_LOCAL_BOUND || Math.abs(l[1]) > DECK_LOCAL_Y_BOUND) return null;
  if (!Number.isFinite(d.yaw)) return null;
  return { ...(mine ? { mine: true } : { peer: d.peer }), uid: d.uid, local: [l[0], l[1], l[2]], yaw: wrapAngle(d.yaw) };
}
/** A deck's heading (radians, the port's yaw: forward [sin, 0, cos]) off her node's matrix (column-major). */
export const deckYaw = (m) => Math.atan2(m[8], m[10]);

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

/** PROF9's Field Cook (Professions-Arc 3.3) under REST2: the charge a kit's lighting spent is a night's fuel now, so a
 *  Field Cook's night at their own Campfire spends none - a Campfire's alone (an Ember Jar's one night and a tent's
 *  wear spend as ever, as a tent's did), and an old save's kit fire (no fuel of its own) has none to keep. */
export const fieldCookKeeps = (camp) => camp?.kind === CAMP_KIND.Fire && !!camp.fuel && !camp.jar;

/** REST2: a night its owner slept at it spends one charge (a Campfire's fuel, a tent's wear). A Campfire whose last
 *  charge is spent goes cold. Answers { spent, empty, kept } - nothing at all for a camp with none to spend; `kept`
 *  for a Field Cook's own Campfire (`fieldCook`, fieldCookKeeps), which spends nothing. */
export function spendCampNight(camp, now, fieldCook = false) {
  if (!camp || (camp.wear | 0) <= 0) return { spent: false, empty: true };
  if (fieldCook && fieldCookKeeps(camp)) return { spent: false, empty: false, kept: true };
  camp.wear = (camp.wear | 0) - 1;
  const empty = camp.wear <= 0;
  if (empty) camp.litUntil = now;   // AUDIT REST F8: the last night leaves a tent cold too - nothing left to stoke
  return { spent: true, empty };
}

/**
 * USE the placeable off the pack: the decision, the item off `list`
 * with its uses riding the record (REST2: none spent), the record. `ctx` =
 * { now, owner, feet, yaw, probe, place, standing (this owner's count), id } - REST2 spends no charge on any placing
 *   (PROF9's Field Cook keeps a night's fuel instead: spendCampNight).
 * Returns { ok, text, camp, spent, strike } - `strike` (a placing that stands) how many of the owner's oldest camps
 *   go for it to stand (FIELD BUGS 2026-10-04d CAMP-CAP).
 */
export function placeCampItem(item, list, { now = 0, owner = null, feet = [0, 0, 0], yaw = 0, probe = null, place = {}, standing = 0, id = null } = {}) {
  const jar = isEmberJar(item);   // REST6: one night's fire, EMBER_JAR_MINUTES lit, never picked up
  const kind = isCampingEquipment(item) ? CAMP_KIND.Tent : isCampfireKit(item) || jar ? CAMP_KIND.Fire : null;
  if (!kind) return { ok: false, text: null, camp: null, spent: false };
  // FIELD BUGS 2026-10-04d CAMP-CAP: THE CAP IS NO REFUSAL. Refused here, four camps left anywhere refused every placing
  // after them for good (no camp burns away - REST2). A placing every rule below lets stand strikes the owner's oldest
  // (scenes/camps.js placeItem); one refused for any other reason strikes nothing.
  const strike = Math.max(0, (standing | 0) - CAMPS_PER_OWNER + 1);
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
    return { ok: true, text: REST_ITEM_TEXT.emberLit, camp, spent: true, strike };
  }
  if (kind === CAMP_KIND.Fire) camp.fuel = true;   // AUDIT REST F12: a Campfire's own fuel - cold, it stands (an old save's kit fire, none, is swept)
  const i = Array.isArray(list) ? list.indexOf(item) : -1;
  if (i >= 0) list.splice(i, 1);
  const text = kind === CAMP_KIND.Tent ? CAMP_TEXT.pitched : CAMP_TEXT.lit;
  return { ok: true, text, camp, spent: false, strike };
}

/** PACK a camp: the gear back with its wear (a tent) - REST2: and a Campfire back with its charges. Returns { item, text }. */
export function packCamp(camp) {
  const tent = camp?.kind === CAMP_KIND.Tent;
  if (!tent && (camp?.kind !== CAMP_KIND.Fire || !camp.fuel)) return { item: null, text: CAMP_TEXT.stamped };   // AUDIT REST-PARTY B5: a fire with no fuel of its own (a kit's, an Ember Jar's) is stamped out, never minted into a Campfire
  const item = createSurvivalItem(tent ? TEMPLATE.CampingEquipment : TEMPLATE.Campfire);
  if (item) item.currentCondition = Math.max(0, Math.min(item.maxCondition ?? camp.wear, camp.wear | 0));
  return { item, text: tent ? CAMP_TEXT.packed : CAMP_TEXT.pickedUp };
}

/** FIELD BUGS 2026-10-04d CAMP-CAP: STRIKE a camp where it stands - the owner's oldest, for a placing at the cap. The gear
 *  is packCamp's, as the menu's Pack gives it (the tent's Camping Equipment with its wear, a Campfire with its charges,
 *  a fire with no fuel of its own nothing); only the words are the strike's, one line. Returns { item, text }. */
export function strikeCamp(camp) {
  const { item } = packCamp(camp);
  return { item, text: !item ? CAMP_TEXT.struckOut : camp.kind === CAMP_KIND.Tent ? CAMP_TEXT.struckCamp : CAMP_TEXT.struckFire };
}

/** AUDIT REST II H5: the Campfires a save left standing in a dungeon the load does not enter - an online page wakes at
 *  the nearest temple instead (ONLINE-UNDERGROUND-LOAD1), and a dungeon this world cannot find or with no entrance here
 *  stands nothing - packed with their fuel, as packOwnFires' walk out packs them; never an Ember Jar's or an old save's
 *  kit fire (AUDIT REST-PARTY B5). `records` is the save's own (camps.snapshot: mine alone). */
export const packSavedFires = (records) => (Array.isArray(records) ? records : [])
  .filter((r) => r?.kind === CAMP_KIND.Fire)   // a fire alone, as packOwnFires; packCamp stamps out one with no fuel of its own
  .map((r) => packCamp(r).item).filter(Boolean);

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
  if (camp.jar) return mine ? CAMP_TEXT.seeOwnJar : CAMP_TEXT.seeJar;   // AUDIT REST III B5: an Ember Jar's is no Campfire, here as on its hover
  return mine ? CAMP_TEXT.seeOwnFire : CAMP_TEXT.seeFire;
}
/** The menu's rows: rest and cook at any camp; stoke a cold tent; REST2: relight your own cold Campfire while it has
 *  fuel; pack your tent, or pick your Campfire up. The keys are the plaque's action ids (REST2: the loot plaque's rows). */
export function campMenu(camp, now, mine, { online = false } = {}) {
  const rows = [{ key: 'rest', text: CAMP_TEXT.menuRest }, { key: 'cook', text: CAMP_TEXT.menuCook }];
  if (camp.kind === CAMP_KIND.Tent && mine && !fireLit(camp, now) && (camp.wear | 0) > 0) rows.push({ key: 'stoke', text: CAMP_TEXT.menuStoke });   // AUDIT REST III A2: my own - a friend's tent stoked here is stoked on my screen alone (its owner publishes it, camps.js act), and the owner's next frame (2 s) puts it out under the rest it promised
  if (camp.kind === CAMP_KIND.Fire && mine && !camp.jar && !fireLit(camp, now) && (camp.wear | 0) > 0) rows.push({ key: 'stoke', text: CAMP_TEXT.menuRelight });
  if (mine && !camp.jar && (camp.kind === CAMP_KIND.Tent || !!camp.fuel)) rows.push({ key: 'pack', text: camp.kind === CAMP_KIND.Tent ? CAMP_TEXT.menuPack : CAMP_TEXT.menuPickUp });   // AUDIT REST-PARTY B5: never an old save's kit fire (no fuel of its own: AUDIT REST F12 - it burns away as it always did; picked up, it was a second Campfire from nothing)
  // AUDIT REST II H12: online a cold camp is no rest point (restAct asks a LIT fire), so its Rest row only refused, with
  // the wrong words ("Find a fire or a bed to rest."): it goes, and the fire's own act - Relight, Stoke - leads, the row
  // a click takes. Offline any rest is DFU's, anywhere, and the list is as it was. AUDIT REST III A3: but my own cold
  // tent's Rest stays, after its Stoke - that rest stokes the tent first (camps.js act, SURV3's "a rest will") and was
  // never refused.
  if (online && !fireLit(camp, now)) {
    const stoke = rows.filter((r) => r.key === 'stoke');
    const restable = mine && camp.kind === CAMP_KIND.Tent && (camp.wear | 0) > 0;
    return [...stoke, ...rows.filter((r) => (r.key !== 'rest' || restable) && r.key !== 'stoke')];
  }
  return rows;
}

// ---- THE WIRE --------------------------------------------------------
const ID_RE = /^[A-Za-z0-9_:.-]{1,48}$/;
const q2 = (v) => Math.round(v * 100) / 100;
const q3 = (v) => Math.round(v * 1000) / 1000;
/** One camp as its owner says it: i the id, k the kind (0 tent, 1 fire), p the world frame's [x, y, z], y the yaw, u the minute its fire dies, w the wear.
 *  DECK-CAMP: and `d`, a camp on a boat - [her owner ('' the sender's own, else that player's id), her number, the
 *  deck's x, y, z, the yaw on her] - so every client poses it off the same hull.
 *  AUDIT 625 L4: and `j: 1`, an Ember Jar's fire (REST-LOOT opened the jar's use online; a peer saw a plain campfire). The
 *  relay reads none of the foes frame it rides, and a reader a build behind drops the field and sees the campfire it
 *  always saw. */
export const campWire = (camp, toWire = (p) => p) => {
  const p = toWire(camp.pos);
  const out = { i: camp.id, k: camp.kind === CAMP_KIND.Tent ? 0 : 1, p: [q2(p[0]), q2(p[1]), q2(p[2])], y: q3(camp.yaw), u: Number.isFinite(camp.litUntil) ? Math.round(camp.litUntil) : -1, w: camp.wear | 0 };
  const d = validDeck(camp.deck);
  if (d) out.d = [d.mine ? '' : d.peer, d.uid, q3(d.local[0]), q3(d.local[1]), q3(d.local[2]), q3(d.yaw)];
  if (camp.jar === true) out.j = 1;   // AUDIT 625 L4: an Ember Jar's fire says so - a peer's copy is the jar, never a plain campfire
  return out;
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
  if (r.j !== undefined && r.j !== 1) return null;   // AUDIT 625 L4: an Ember Jar's fire, 1 or nothing
  let d = null;
  if (r.d !== undefined) {   // DECK-CAMP: a deck's address, whole or the record refused
    const a = r.d;
    if (!Array.isArray(a) || a.length !== 6 || typeof a[0] !== 'string' || (a[0] !== '' && !ID_OK.test(a[0]))) return null;
    if (!validDeck({ ...(a[0] === '' ? { mine: true } : { peer: a[0] }), uid: a[1], local: [a[2], a[3], a[4]], yaw: a[5] })) return null;
    d = [a[0], a[1], a[2], a[3], a[4], wrapAngle(a[5])];
  }
  return { i: r.i, k: r.k, p: [r.p[0], r.p[1], r.p[2]], y: wrapAngle(r.y), u: r.u, w: r.w, ...(d ? { d } : {}), ...(r.j === 1 ? { j: 1 } : {}) };
}
/** A projected record as a camp of `owner`, in this scene's frame. DECK-CAMP: its boat read from where THIS player
 *  stands - the sender's own boat is that peer's, one named by `selfId` this player's own, any other that player's. */
export function campFromWire(r, owner, toScene = (p) => p, selfId = null) {
  const p = toScene(r.p);
  const camp = { id: r.i, owner, kind: r.k === 0 ? CAMP_KIND.Tent : CAMP_KIND.Fire, pos: [p[0], p[1], p[2]], yaw: r.y, litUntil: r.u < 0 ? null : r.u, wear: r.w, placedAt: null };
  if (r.j === 1 && camp.kind === CAMP_KIND.Fire) camp.jar = true;   // AUDIT 625 L4: an Ember Jar's fire is a jar on every copy
  if (r.d) {
    const [who, uid, x, y, z, yaw] = r.d;
    const ref = who === '' ? { peer: owner } : selfId != null && who === selfId ? { mine: true } : { peer: who };
    const d = validDeck({ ...ref, uid, local: [x, y, z], yaw });
    if (d) camp.deck = d;
  }
  return camp;
}
/** An owner's word replaces that owner's camps and no one else's; at most CAMPS_PER_OWNER of them. */
export function mergeOwnerCamps(camps, owner, records, toScene = (p) => p, selfId = null) {
  const kept = (camps ?? []).filter((c) => c.owner !== owner);
  const fresh = [];
  for (const raw of Array.isArray(records) ? records : []) {
    const r = validCampRecord(raw);
    if (!r || fresh.some((c) => c.id === r.i)) continue;
    fresh.push(campFromWire(r, owner, toScene, selfId));
    if (fresh.length >= CAMPS_PER_OWNER) break;
  }
  return [...kept, ...fresh];
}
