// @ts-check
// SEAT2b (2026-10-01, Mac: "Finish the seats"; "We need to do a comprehensive audit on everything and finish the not
// done"): A SEAT'S FORTIFICATIONS, ITS SIEGE WORKS AND ITS REVOLT - the law both ends read (bible/11-Multiplayer/
// Seats-Arc.md 6.2, 7.5, 7.7, 4.2's Siege Camp; Appendix B). Fortifications belong to the SEAT, not the guild: a
// project on the seat's board, its materials delivered by writs to the stockpile and its Marks paid from the
// treasury, standing 2, 4 or 7 days after its last delivery; each drops a tier when the seat changes hands and at a
// Season's end, and Season 0's end wipes them (18).
//
// THE MATERIALS (PROF0 section 4, net/professionLaw.js's keys): the table's "Cut Stone" `stone:cut`, "Oak Planks"
// `plank:oak` (and Pine, Cherry, Teak, Mahogany), "Iron/Steel/Mithril Ingots" `ingot:*`, "Pearls" `gem:pearl`.
// DECIDED: the table's bare "Silver" and "Gold" are the raw metals `metal:silver` and `metal:gold` - it names an ingot
// "Ingots" wherever it means one, and no gold ingot exists.
//
// Pure (it reads professionLaw.js's materials and its Builder). Not a DFU member: Daggerfall's towns have no player
// works. Ledger A (EVERY PALACE A SEAT's row).
import { fortificationStone, minedMaterial } from './professionLaw.js';

/** The days a tier stands after its last delivery (7.5): tier 1, 2, 3. */
export const FORT_TIER_DAYS = Object.freeze([2, 4, 7]);
const need = (...pairs) => Object.freeze(pairs.map(([k, n]) => Object.freeze([k, n])));
const tier = (marks, ...pairs) => Object.freeze({ marks, needs: need(...pairs) });

/**
 * THE WORKS (7.5), in the table's order: each `{ id, name, tiers: [{ marks, needs: [[material, units]] }], where }` -
 * `where` the seats that may raise it: 'any'; 'gate' (a crown's, or a palace whose Walls stand at tier 3 - "palace
 * seats with tier 3 Walls gain a gate of their own"); 'coast' (coastal seats only).
 */
export const FORT_WORKS = Object.freeze([
  Object.freeze({ id: 'walls', name: 'Walls', where: 'any', tiers: Object.freeze([
    tier(1000, ['stone:cut', 400], ['plank:oak', 100]), tier(3000, ['stone:cut', 800], ['ingot:iron', 200]), tier(8000, ['stone:cut', 1600], ['ingot:steel', 200])]) }),
  Object.freeze({ id: 'gatehouse', name: 'Gatehouse', where: 'gate', tiers: Object.freeze([
    tier(2000, ['stone:cut', 300], ['ingot:iron', 200]), tier(5000, ['stone:cut', 600], ['ingot:steel', 200]), tier(12000, ['stone:cut', 1000], ['ingot:mithril', 100])]) }),
  Object.freeze({ id: 'watchtowers', name: 'Watchtowers', where: 'any', tiers: Object.freeze([
    tier(800, ['stone:cut', 200], ['plank:pine', 200]), tier(2000, ['stone:cut', 400], ['ingot:iron', 100])]) }),
  Object.freeze({ id: 'barracks', name: 'Barracks', where: 'any', tiers: Object.freeze([
    tier(1500, ['plank:oak', 300], ['ingot:iron', 100]), tier(4000, ['plank:oak', 600], ['ingot:steel', 200]), tier(9000, ['plank:teak', 800], ['ingot:mithril', 100])]) }),
  Object.freeze({ id: 'market', name: 'Market Hall', where: 'any', tiers: Object.freeze([
    tier(1000, ['plank:oak', 200], ['stone:cut', 100]), tier(2500, ['plank:cherry', 400], ['stone:cut', 200]), tier(6000, ['plank:mahogany', 400], ['metal:gold', 50])]) }),
  Object.freeze({ id: 'shrine', name: 'Shrine', where: 'any', tiers: Object.freeze([
    tier(1000, ['stone:cut', 100], ['metal:silver', 20]), tier(3000, ['stone:cut', 200], ['gem:pearl', 10])]) }),
  Object.freeze({ id: 'forge', name: 'Forge', where: 'any', tiers: Object.freeze([
    tier(1000, ['stone:cut', 200], ['ingot:iron', 100]), tier(2500, ['stone:cut', 300], ['ingot:steel', 100])]) }),
  Object.freeze({ id: 'workshop', name: 'Workshop', where: 'any', tiers: Object.freeze([
    tier(1000, ['plank:oak', 200], ['ingot:iron', 50]), tier(2500, ['plank:teak', 300], ['ingot:steel', 50])]) }),
  Object.freeze({ id: 'apothecary', name: 'Apothecary', where: 'any', tiers: Object.freeze([
    tier(1000, ['stone:cut', 100], ['plank:oak', 100]), tier(2500, ['stone:cut', 200], ['gem:pearl', 20])]) }),
  Object.freeze({ id: 'harbour', name: 'Harbor', where: 'coast', tiers: Object.freeze([
    tier(2000, ['plank:oak', 400], ['stone:cut', 200]), tier(5000, ['plank:teak', 800], ['stone:cut', 400])]) }),
]);
const BY_ID = new Map(FORT_WORKS.map((w) => [/** @type {string} */ (w.id), w]));
/** Every material a work's tier asks - what a seat writ may ask for its stockpile or a Siege Camp (Professions-Arc 11:
 *  "A seat's writs build its fortifications"). */
export const FORT_MATERIALS = Object.freeze([...new Set(FORT_WORKS.flatMap((w) => w.tiers.flatMap((t) => t.needs.map(([k]) => k))))].sort());
export const fortMaterialOk = (key) => FORT_MATERIALS.includes(key);
/** A work by its id, or null. */
export const fortWork = (id) => (typeof id === 'string' ? BY_ID.get(id) ?? null : null);
/** A work's highest tier (2 or 3), or 0 for none. */
export const fortMaxTier = (id) => fortWork(id)?.tiers.length ?? 0;
/** Tier `t`'s row of a work (1-based), or null. */
export const fortTierRow = (id, t) => (Number.isSafeInteger(t) && t >= 1 ? fortWork(id)?.tiers[t - 1] ?? null : null);

/**
 * WHETHER A SEAT MAY RAISE A WORK (7.5): `seat` `{ tier: 'palace'|'crown', coastal, walls }` - its tier, whether its
 * town is coastal and its Walls' tier now. A Gatehouse at a crown, or at a palace whose Walls stand at tier 3; a
 * Harbour at a coastal seat; the rest anywhere.
 */
/** AUDIT SEATS-2 L5: the Apothecary's steps wait on Alchemy's, Cooking's and Jewelcrafting's stations - until they stand
 *  it is raised by no one (a holder's Drakes and stone paid for nothing). PROF12 (Mac: "2 and 4"): OPENED - the three
 *  stand (PROF9 the fire, PROF10 the jeweller's bench, PROF12 the alchemy station), and a step a tier is each one's
 *  (STATION_PROFESSIONS): a Jewelcrafting piece's quality step, a dish's XP half again (recipeLaw cookXp), a brew's Potent
 *  chance +10 (alchemyLaw potentChance). */
export const APOTHECARY_OPEN = true;
export function fortMayRaise(id, seat) {
  const w = fortWork(id);
  if (!w) return false;
  if (id === 'apothecary' && !APOTHECARY_OPEN) return false;
  if (w.where === 'gate') return seat?.tier === 'crown' || (seat?.tier === 'palace' && Number(seat?.walls ?? 0) >= 3);
  if (w.where === 'coast') return !!seat?.coastal;
  return true;
}

/** Whether a material is the stone a Builder saves: the Stores' stone family (Cut Stone; Rough Stone and Mortar should a
 *  work ever ask them) - professionLaw.js's own test, so the Builder has one law. */
const isStone = (key) => minedMaterial(key)?.family === 'stone';
/**
 * WHAT A PROJECT ASKS (7.5): tier `t` of a work, its needs as `[[material, units]]` - a Builder's (`builder`, Masonry 50,
 * Professions-Arc 3.3: "fortification projects need 10% less stone") stone a tenth less, rounded UP
 * (professionLaw.js fortificationStone, PROF11's) - and its Marks; or null for no such tier.
 */
export function fortNeeds(id, t, { builder = false } = {}) {
  const row = fortTierRow(id, t);
  if (!row) return null;
  return { marks: row.marks, needs: row.needs.map(([k, n]) => [k, isStone(k) ? fortificationStone(n, builder) : n]) };
}
/**
 * THE SIEGEWRIGHT'S DAY (Carpentry 100, Professions-Arc 3.3: "Rams +50% vitality; siege works a day sooner"). SEAT2b
 * part two DECIDED: the day is a WORK's - a project begun by a Siegewright stands a day sooner. Both records name the
 * Siege Camp's Ram Kits "siege works", but a kit is made at the bench at once and spent at the Turning; the only siege
 * work that waits days is 7.5's, a project's tier standing 2, 4 or 7 days after its last delivery. The Rams' half is the
 * battle's (ramVitality, a Siegewright on the attacking roster - the Fortifier's way).
 */
export const SIEGEWRIGHT_DAYS = 1;
/** When a project of tier `t` stands: its last delivery (s) and the tier's days (7.5) - a day fewer where a Siegewright
 *  began it - or null. */
export const fortStandsAt = (lastDeliveryS, t, { siegewright = false } = {}) => (Number.isFinite(lastDeliveryS) && t >= 1 && t <= 3
  ? lastDeliveryS + (FORT_TIER_DAYS[t - 1] - (siegewright ? SIEGEWRIGHT_DAYS : 0)) * 86400 : null);
/** How much of each need is still wanting, given what the project holds (`held`: material -> units). */
export const fortWanting = (needs, held) => (needs ?? []).map(([k, n]) => [k, Math.max(0, n - Math.max(0, Number(held?.get?.(k) ?? held?.[k] ?? 0)))]);
/** Whether every need is met. */
export const fortMet = (needs, held) => fortWanting(needs, held).every(([, n]) => n === 0);

// ─── THE DROPS (7.5, 9.1, 18) ─────────────────────────────────────────

/** A work's tier after a drop: one less, at least nought. */
export const fortDropped = (t) => Math.max(0, Math.floor(Number(t) || 0) - 1);
/**
 * THE CAPTURE'S DROP (6.8: "the fortifications, each one tier down"; Appendix A: "the Walls drop to tier 0") over a
 * seat's works (`{ [id]: tier }`): each a tier down - but the Walls kept where a Fortifier saved them (Masonry 100,
 * Professions-Arc 3.3: "once a Season a seat's Walls skip their drop on capture"). A building project falls with
 * the Charter (the new holder raises its own).
 */
export function fortsAfterCapture(forts, { fortifier = false } = {}) {
  const out = {};
  for (const [id, t] of Object.entries(forts ?? {})) out[id] = id === 'walls' && fortifier ? Math.max(0, Number(t) || 0) : fortDropped(t);
  return out;
}
/** A Season's end (9.1): every work a tier down. */
export const fortsAfterSeason = (forts) => Object.fromEntries(Object.entries(forts ?? {}).map(([id, t]) => [id, fortDropped(t)]));

// ─── WHAT A TIER DOES (7.5, "Effect per tier") ────────────────────────

/** The Walls: the defenders' respawn wave 3 s faster a tier, never under 5 s. */
export const WALLS_WAVE_STEP_MS = 3000;
export const WALLS_WAVE_MIN_MS = 5000;
export const defendersWaveMs = (baseMs, walls) => Math.max(WALLS_WAVE_MIN_MS, baseMs - WALLS_WAVE_STEP_MS * Math.max(0, Math.min(3, Number(walls) || 0)));
/** The Gatehouse (6.2): vitality 20,000, +50% a tier; a fighter's blow deals a tenth of its damage to it. */
export const GATEHOUSE = Object.freeze({ vitality: 20000, perTier: 0.5, blowShare: 0.1 });
export const gatehouseVitality = (t) => Math.round(GATEHOUSE.vitality * (1 + GATEHOUSE.perTier * Math.max(0, Math.min(3, Number(t) || 0))));
/** A Ram (6.2): vitality 3,000 (a Siegewright's +50%, Professions-Arc 3.3), 500 every 10 s to the Gatehouse while two
 *  of its side stand within 3 m; one a side at a time; a destroyed Ram is gone. */
export const RAM = Object.freeze({ vitality: 3000, damage: 500, everyMs: 10000, crew: 2, crewM: 3, siegewright: 0.5 });
export const ramVitality = (siegewright = false) => Math.round(RAM.vitality * (siegewright ? 1 + RAM.siegewright : 1));
/** The Watchtowers: the holder told when a challenger passes half its defence (tier 1), a quarter (tier 2). */
export const watchtowerShare = (t) => (t >= 2 ? 0.25 : t === 1 ? 0.5 : null);
/**
 * SEAT2b part two: WHAT THE WATCHTOWERS SEE (7.5) - the challengers whose week at the seat has passed the towers' share
 * of the holder's defence: `standings` each pledged guild's `{ guild, influence }` as the Seat tab shows it (a
 * challenger's risen in Unrest, its Legacy in - the number the Turning sets against the defence), `holder` the holder's
 * guild id, `defence` its defence now, `t` the Watchtowers' tier. Answers `[{ guild, influence, share }]`, the most
 * dangerous first - none without towers, without a defence, or for the holder itself. "Passes" is at or past (a
 * challenger level with the share has passed it). Pure.
 */
export function towersSee(standings, { holder, defence, t }) {
  const share = watchtowerShare(t);
  if (share == null || !(Number(defence) > 0)) return [];
  const line = Number(defence) * share;
  return (standings ?? []).filter((s) => s && s.guild !== holder && Number(s.influence) >= line)
    .map((s) => ({ guild: s.guild, influence: Number(s.influence), share }))
    .sort((a, b) => b.influence - a.influence || (a.guild < b.guild ? -1 : 1));
}
/** The holder's word from its Watchtowers: "The Watchtowers of Anticlere see the Iron Circle <IC> past half our defence." */
export const towersText = (seatName, guildName, share) => `The Watchtowers of ${seatName} see ${guildName} past ${share <= 0.25 ? 'a quarter' : 'half'} of our defense.`;
/** The Barracks: the relay-run town guards that fight for the holder - 2, 4, 6. */
export const barracksGuards = (t) => [0, 2, 4, 6][Math.max(0, Math.min(3, Number(t) || 0))];
/** The Market Hall: the town's boards list a quarter more a tier; the Tithe's cap a point more a tier. */
export const marketHallListings = (base, t) => Math.floor(base * (1 + 0.25 * Math.max(0, Math.min(3, Number(t) || 0))) + 1e-9);
export const marketHallTitheCap = (baseCap, t) => baseCap + Math.max(0, Math.min(3, Number(t) || 0));
/** The Shrine: Standing +1 a week a tier; each gate felled in the region +50 influence a tier to the holder. */
export const SHRINE_GATE_INFLUENCE = 50;
export const shrineStanding = (t) => Math.max(0, Math.min(2, Number(t) || 0));
export const shrineGateInfluence = (t) => SHRINE_GATE_INFLUENCE * shrineStanding(t);
/** The Forge, the Workshop and the Apothecary: a member crafting at the seat in their professions, +1 quality step a
 *  tier (PROF0 9.2's steps). */
export const STATION_PROFESSIONS = Object.freeze({
  forge: Object.freeze(['smithing']),
  workshop: Object.freeze(['carpentry', 'outfitting', 'masonry']),
  apothecary: Object.freeze(['alchemy', 'cooking', 'jewelcrafting']),
});
/** The steps a seat's works give a craft in `profession`, over its works' tiers (`{ [id]: tier }`). */
export function stationSteps(profession, forts) {
  let steps = 0;
  for (const [id, profs] of Object.entries(STATION_PROFESSIONS)) if (profs.includes(profession)) steps += Math.max(0, Number(forts?.[id] ?? 0) || 0);
  return steps;
}
/**
 * AUDIT PROF-541 R2-H1: THE STEPS MY GUILD'S HALL GIVES A CRAFT - `seat` (the town a station stands in, dressed in its
 * holder: world.js seatHere) where my guild (`guild`, the guild book's id) holds it: its works' steps in `profession`
 * (stationSteps), and the seat a craft names (null where no step stands - the service asks the Charter again,
 * professions.js seatStepsFor). One law for every station's line and the craft it sends, by profession.
 */
export function hallStepsFor(seat, guild, profession) {
  const steps = !!guild && seat?.holder?.guild?.id === guild ? stationSteps(profession, seat.forts ?? {}) : 0;
  return { steps, seat: steps > 0 ? seat.key ?? null : null };
}
/** The Harbour: a port for members (the Travel Options' port) at tier 1 or more. */
export const harbourPort = (t) => Number(t) >= 1;
/**
 * SEAT2b part two: WHETHER A TOWN IS COASTAL (7.5: "Harbour (coastal seats only)") - its own map pixel or one of the
 * eight about it water (`isWater(px, py)`, the host's sea test: ui/overworldModel.js isWaterPixel over CLIMATE.PAK's
 * Ocean and WOODS.WLD's sea level), or `port` (a harbour Travel Options or DFU already draws there stands on water).
 * DECIDED: part one asked the port flag alone, and a port is already Travel Options' port - its Harbour gave nothing. A
 * coast is the sea beside the town; the funding client's word, bounded as before (a lie spends the liar's treasury on a
 * harbour no ship can reach).
 */
export function coastalAt(px, py, isWater, port = false) {
  if (port) return true;
  if (!Number.isFinite(px) || !Number.isFinite(py) || typeof isWater !== 'function') return false;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (isWater(px + dx, py + dy)) return true;
  return false;
}
/** How far the map pixels round a town's are asked for the sea: the port law's ring (world/portSites.js - a port town is
 *  one the open sea bears on within it, its places' bearing read off it). FB1020c BERTH-RING: here, beside the coast's
 *  other law, so the berth's and a cargo's port (systems/naval/harbourBoard.js deliveryPort, which the account Worker
 *  bundles) read the one ring without the world's placement code; portSites.js re-exports both. */
export const SEA_RING = 2;
/** Whether the sea bears on a map pixel: a pixel of it (`isSea(x, y)`) within SEA_RING - the ring its bearing is read off
 *  (world/portSites.js seaBearing), so a town it bears on has a seaward edge to stand its places on. Pure. */
export function seaBears(px, py, isSea) {
  if (typeof isSea !== 'function') return false;
  for (let dy = -SEA_RING; dy <= SEA_RING; dy++) for (let dx = -SEA_RING; dx <= SEA_RING; dx++) if (isSea(px + dx, py + dy)) return true;
  return false;
}
/** SEAT2b part two: whether `seat` (the seats' list's - its holder and its works' tiers, `forts`) is a Travel Options port
 *  for a character of guild `guild`: a Harbour standing there and the guild its holder (7.5: "the town is a Travel
 *  Options port for members"). */
export const harbourPortFor = (seat, guild) => !!guild && seat?.holder?.guild?.id === guild && harbourPort(seat?.forts?.harbour ?? 0);

// ─── THE SIEGE CAMP (4.2, 5.2 step 7) ─────────────────────────────────

/** A Ram Kit as the Stores hold it (PROF0 4.8's 690, a siege work). */
export const RAM_KIT_KEY = 'work:ram';
/**
 * A CHALLENGER'S SIEGE CAMP AT THE TURNING (4.2: "its siege works (a Ram Kit) go to the siege it won, and everything
 * else is burnt; a camp that won no Right of Siege is burnt whole"): `camp` `[[material, units]]`, `won` whether its
 * guild won the Right there, `gated` whether the seat has a Gatehouse a Ram could strike (Appendix A: "no Ram - a
 * palace has no Gatehouse"). Answers `{ rams, burnt: [[material, units]] }`.
 */
export function campSpent(camp, { won = false, gated = false } = {}) {
  let rams = 0;
  const burnt = [];
  for (const [k, n] of camp ?? []) {
    const u = Math.max(0, Math.floor(Number(n) || 0));
    if (!u) continue;
    if (k === RAM_KIT_KEY && won && gated) rams += u;
    else burnt.push([k, u]);
  }
  return { rams, burnt };
}

// ─── THE REVOLT (7.7) ─────────────────────────────────────────────────

/** A seat at Standing 0 revolts at its next siege window: a Rebel Captain (vitality as a siege fighter of Renown 50)
 *  and 12 rebels at the palace door; the holder must fell the Captain inside the window's two hours - fail, and the
 *  Charter lapses; succeed, and Standing returns to 20 (townSeatLaw.js STANDING_CHANGES.revoltTo). */
export const REVOLT = Object.freeze({ captainRenown: 50, rebels: 12, windowMs: 2 * 3600 * 1000 });
/** Whether a seat revolts at its next window: its Standing at nought. */
export const revoltDue = (standing) => Number(standing) <= 0;

// ─── THE WORKS' WORDS (7.9: "the stockpile: every fortification project and what it still needs") ───

/** What a work's tier does, as the Seat tab says it. */
export const FORT_EFFECT_WORDS = Object.freeze({
  walls: (t) => `the defenders' wave ${(WALLS_WAVE_STEP_MS / 1000) * t} s faster`,
  gatehouse: (t) => `its vitality ${gatehouseVitality(t).toLocaleString('en-US')}`,
  watchtowers: (t) => `the holder is warned when a challenger gets past ${t >= 2 ? 'a quarter' : 'half'} of its defense`,
  barracks: (t) => `${barracksGuards(t)} town guards fight for the holder`,
  market: (t) => `the town's boards list ${25 * t}% more, the Tithe's cap ${t} ${t === 1 ? 'point' : 'points'} higher`,
  shrine: (t) => `Standing +${shrineStanding(t)} a week, +${shrineGateInfluence(t)} influence for each gate felled in the region`,
  forge: (t) => `members smithing here ${t === 1 ? 'a quality step' : `${t} quality steps`} better`,
  workshop: (t) => `members' carpentry, outfitting and masonry here ${t === 1 ? 'a quality step' : `${t} quality steps`} better`,
  // AUDIT PROF12 P1: a step each its own - a piece of jewellery's quality (the Forge's law), a dish's XP half again
  // (recipeLaw cookXp), a brew's Potent chance +10 (alchemyLaw POTENT.apothecary)
  apothecary: (t) => `members' jewelry here ${t === 1 ? 'a quality step' : `${t} quality steps`} better, their dishes ${t === 1 ? 'half again' : t === 2 ? 'twice' : `${(2 + t) / 2} times`} the XP, their brews +${10 * t}% Potent chance`,
  harbour: () => 'a port for the holder\'s members',
});
/**
 * A WORK'S LINE on the Seat tab - `w` its row as the service reads it (`{ tier, building, standsAt, needs, held }`):
 * "Walls: tier 1 - the defenders' wave 3 s faster. Raising tier 2: 320 Cut Stone, 200 Iron Ingots still wanted." -
 * `nameOf` a material's name for a count, `whenOf` a moment's words (ms).
 */
export function fortWorkLine(id, w, { nameOf = (k, n) => `${k}`, whenOf = (ms) => new Date(ms).toISOString(), seatTier = null } = {}) {
  const work = fortWork(id);
  if (!work) return '';
  const t = Math.max(0, Number(w?.tier ?? 0) || 0);
  // AUDIT SEATS-2 L3 (6.2: "a crown's Gatehouse stands from the first"): a crown's stands at tier 0, its vitality said
  const head = t > 0 ? `${work.name}: tier ${t} - ${FORT_EFFECT_WORDS[id](t)}.`
    : id === 'gatehouse' && seatTier === 'crown' ? `${work.name}: standing - ${FORT_EFFECT_WORDS.gatehouse(0)}.` : `${work.name}: none raised.`;
  if (w?.building == null) return head;
  if (w.standsAt != null) return `${head} Tier ${w.building} stands ${whenOf(Number(w.standsAt) * 1000)}.`;
  const held = new Map(w.held ?? []);
  const wanted = fortWanting(w.needs ?? [], held).filter(([, n]) => n > 0).map(([k, n]) => `${n.toLocaleString('en-US')} ${nameOf(k, n)}`);
  return `${head} Raising tier ${w.building}: ${wanted.length ? `${wanted.join(', ')} still wanted` : 'every need met'}.`;
}
