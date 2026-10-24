// @ts-check
// THE FLEET'S HOST HALF (HOLDINGS, 2026-10-03 - bible/03-World/Holdings.md). The Fleet page (ui/fleetPage.js) reads a
// model and asks acts; this builds the one and carries out the other over the world host's runtimes - Come Sail Away's
// boats (the mod's own laws: SummonBoat, LayUpBoat, StartPlacing over the Fleet's book), the sea fight's state of each
// (scenes/naval/navalHost.js fleetStatus, repairAway, refitBoat, the yard, the berths), and the ledger (systems/fleet.js).
// Built by scenes/world.js, the one host that stands Come Sail Away; the page is taken down with it.
//
//   deps = {
//     csa() -> Come Sail Away's runtime | null        naval() -> the naval host | null
//     pack() -> the player's items (live)              gold() -> the purse; pay(n)
//     accounts() -> the bank accounts                  regionName(i) -> a region's name
//     where() -> { inside, pixel: {X, Y}, feet: [x, y, z], sea }    the player as the page reads them (`sea`: the open sea
//                                                    a PvP zone - AUDIT FOE-KEEPS E3)
//     nearPort() -> bool                               nearestPort() -> { name, way } | null
//     terrainAt(pos) -> the terrain a summoned boat stands on (Come Sail Away's own arm), or null
//     veilApart(rec, boat) -> whether she lies on the other side of the Veil from the player (AUDIT CAPTAIN'S SEA P5)
//     changed() -> the word a rename or a refit owes (the boats' record said again)
//     openHold(uid) -> bool  CARGO-ANYWHERE: her hold's window, wherever she lies (scenes/holdDoor.js openShip)
//     guildArms() -> the player's guild's heraldry, or null   SHIP-COLOURS: "fly my guild's arms"
//     captain() -> the captain's ledger (systems/naval/captainLedger.js) | null   CAPTAIN-TREE / REFIT-ORES: her captain's
//                  level (the metal tiers' gate) and stars (her refits as the sea reads them)
//     openDeck(uid) -> bool   DECK-PROPS: the plan of her deck, her fittings set on it (scenes/deckPlanDoor.js)
//   }

import {
  fleetShip, fleetShips, fleetBook, titleOf, titleDeedsIn, knowShip, renameShip, addRefit, setShipPort, retitle, refitOf, loanOwed, settleCredit,
  shipLabel, upgradeCost, materialCount, UPGRADE_LINES, UPGRADE_TIERS, MATERIALS, BOAT_PARTS_TEMPLATE, setShipColours,
  REFIT_NUMERALS, meltCounts, materialsFor, takeAllMaterials, refitShare, setShipLivery, setShipCabin, setShipFittings, setShipPlaque,
} from '../systems/fleet.js';
import { captainRefit } from '../systems/naval/captainTree.js';   // CAPTAIN-TREE: her captain's stars over her refits
import { flagSizeOf } from '../systems/naval/shipFlag.js';   // SHIP-COLOURS: the hulls that fly a flag
import { liveryPartsOf, isPaint } from '../systems/naval/shipLivery.js';   // SHIP-LIVERY: the paints a hull takes
import { cabinShipType } from '../systems/sailingCabin.js';   // CABIN-LOOK: the hulls with a cabin below
import { SHIP_TYPES } from '../systems/banking.js';
import { HULL_NAMES, HULL_PRICES } from '../systems/comeSailAway/comeSailAwayBoat.js';
import { mintDeed } from '../systems/comeSailAway/comeSailAwayItems.js';
import { TERRAIN_EDGE } from '../systems/comeSailAway/comeSailAway.js';
import { batteriesOf } from '../systems/naval/navalShips.js';
import { CREW_ORDERS, CREW_ROLES } from '../systems/naval/shipCrew.js';
import { MOBILE } from '../systems/naval/navalBoarding.js';
import { optionPath } from '../ui/settings/settingsMap.js';   // ORG2: a switch named in a line says where it lives
import { holdsCargo } from './holdDoor.js';   // CARGO-ANYWHERE: the hulls that carry a hold
import { t } from '../systems/textManager.js';   // CARGO-ANYWHERE: the hold's words in the player's language
import { etherWildRingAt } from '../systems/wild/etherWild.js';   // AUDIT FOE-KEEPS E3: the open sea's PvP waters

/** The hulls whose prefab carries a live `Crewed` node (Come Sail Away's Small Ship, Large Galley and Carrack - the
 *  Rowboat's is inactive): a ship with hands, who sail her to a port and mend her where she lies. */
export const CREWED_HULLS = Object.freeze([2, 3, 4]);
/** Whether a hull carries great guns (a battery that is not the stern's fire barrels) - her Guns refit's own. */
export const hasGuns = (hull) => batteriesOf(hull).some((b) => b.gun !== 'barrel');
const COMPASS = Object.freeze(['east', 'north-east', 'north', 'north-west', 'west', 'south-west', 'south', 'south-east']);
/** Which way a map pixel lies from another, in a line's words (map y grows south). */
export function compassWay(dx, dy) {
  if (!dx && !dy) return null;
  const turn = Math.round(Math.atan2(-dy, dx) / (Math.PI / 4));
  return COMPASS[(turn + 8) % 8];
}

export function createFleetHost(deps) {
  const csa = () => deps.csa?.() ?? null;
  const naval = () => deps.naval?.() ?? null;
  const pack = () => deps.pack?.() ?? [];
  /** The boats of mine standing, by number - never a booked ship's (PASSAGE: her master's, no ship of the Fleet's). */
  const placed = () => (csa()?.AllBoats ?? []).filter((b) => b?.uid && !b.charter);
  const partsOf = (uid) => pack().find((it) => it?.templateIndex === BOAT_PARTS_TEMPLATE && it.UID === uid) ?? null;
  /** A laid-up ship's stand-in: what the sea fight's state and the yard read of a boat - her number, hull, whether she
   *  has hands, and her laid-up hold (Come Sail Away's PackedCargoes under her number, live). */
  const standIn = (rec) => ({ uid: rec.uid, hull: rec.hull, variant: rec.variant, crewed: CREWED_HULLS.includes(rec.hull), Cargo: { Items: csa()?.laidUpHold?.(rec.uid) ?? [] }, laidUp: true });

  /** Every deed in the pack entered in the book, and every boat of mine with a number known to the ledger. */
  function sweep() {
    titleDeedsIn(pack(), { except: csa()?.state?.placeItem ?? null });   // AUDIT HOLDINGS F2: never the deed a placing holds
    for (const b of placed()) knowShip(b.uid, b.hull, b.variant, b.itemValue);   // AUDIT HOLDINGS F3: her rig as she stands
    settleCredit(deps.accounts?.());   // AUDIT HOLDINGS F4: a claim whose bank is owed nothing now, cleared for good
    for (const it of pack()) if (it?.templateIndex === BOAT_PARTS_TEMPLATE && it.UID) knowShip(it.UID, Math.floor((it.message | 0) / 10), (it.message | 0) % 10, it.value);
  }

  /**
   * WHERE SHE IS, off the world: `sailing` (the boat at the helm), `here` (standing, shown - within a map pixel), `away`
   * (standing on another pixel), `packed` (her parts in the pack), `laidup` (her title in the book and nothing of her
   * standing), or `lost` (none of these: no row is drawn for her). With the boat or stand-in her state is read off.
   */
  function whereIs(rec) {
    const r = csa();
    const boat = placed().find((b) => b.uid === rec.uid) ?? null;
    if (boat) {
      const sailing = !!r?.isSailing?.() && r.state?.CurrentBoat === boat;
      return { where: sailing ? 'sailing' : boat.GameObject?.activeSelf ? 'here' : 'away', boat };
    }
    if (partsOf(rec.uid)) return { where: 'packed', boat: null };
    if (titleOf(rec.uid)) return { where: 'laidup', boat: standIn(rec) };
    return { where: 'lost', boat: null };
  }
  /** How far a standing boat lies, and which way: metres off the player while she is shown, else by the pixels. */
  function bearing(boat) {
    const w = deps.where?.() ?? null;
    if (!w || !boat) return { metres: null, way: null };
    if (boat.GameObject?.activeSelf && w.feet) {
      const p = boat.GameObject.position;
      return { metres: Math.round(Math.hypot(p[0] - w.feet[0], p[2] - w.feet[2])), way: null };
    }
    const mp = boat.MapPixel;
    if (!mp || !w.pixel) return { metres: null, way: null };
    const dx = mp.X - w.pixel.X, dy = mp.Y - w.pixel.Y;
    return { metres: Math.round(Math.hypot(dx, dy) * TERRAIN_EDGE), way: compassWay(dx, dy) };
  }

  /** What stands in her way to each act - a refusal's words, or null. */
  function refusals(rec, at) {
    const w = deps.where?.() ?? {};
    const r = csa(), n = naval();
    const st = at.boat ? n?.fleetStatus?.(at.boat) ?? null : null;
    const crewed = CREWED_HULLS.includes(rec.hull);
    const inFight = !!st?.inFight || (at.where !== 'laidup' && at.where !== 'packed' && !!n?.hostileNear?.());
    const atPort = !!deps.nearPort?.();
    const loan = loanOwed(rec, deps.accounts?.());
    const sailing = !!r?.isSailing?.();
    const apart = !!deps.veilApart?.(rec, at.boat ?? null);   // AUDIT CAPTAIN'S SEA P5: never across the Veil
    // AUDIT FOE-KEEPS E3 (the owner, 2026-10-24, asked: "Refuse on the open sea"): since FOE-KEEPS a death to a foe there
    // costs a tenth and rises at the nearest freeport, so a Summon after it was the sea's free hop for captain, ship and
    // hold past the waters where another captain takes a third of a boarded hold. No Fleet order moves a ship into, out
    // of or about the open sea while it is a PvP zone (`where().sea` - online, its relay refereeing): the player's waters
    // or hers past Veilhaven's peace. A laid-up ship is no ship in those waters.
    const openSea = !!w.sea && (etherWildRingAt(w.pixel?.X, w.pixel?.Y) > 0 || (!!at.boat?.MapPixel && etherWildRingAt(at.boat.MapPixel.X, at.boat.MapPixel.Y) > 0));
    const summon = !r ? 'Come Sail Away is not running.'
      : at.where === 'sailing' || at.where === 'here' ? 'This ship is already here.'
      : at.where === 'packed' ? 'This ship is in your pack. Launch it from its parts.'
      : w.inside ? 'Go outdoors to summon a ship.'
      : sailing ? 'Not while you are at a helm.'
      : inFight ? 'Not while the ship is in combat.'
      : apart ? 'This ship is on the other side of the Veil. Sail it across yourself.'
      : openSea ? t('naval.fleet.openSeaSummon', 'Not on the open sea. Sail the ship there yourself.')
      : !atPort ? 'Ships can only be summoned to a port. Go to one first.'
      : null;
    const away = !r ? 'Come Sail Away is not running.'
      : at.where === 'laidup' ? 'This ship is already laid up.'
      : at.where === 'packed' ? 'This ship is in your pack.'
      : at.where === 'sailing' ? 'Not while you are at the helm.'
      : inFight ? 'Not while the ship is in combat.'
      : !crewed && at.where !== 'here' ? 'This ship has no crew to sail it to port. Go to it yourself.'
      : apart ? 'This ship is on the other side of the Veil. The crew won\'t take it across without you.'
      : openSea ? t('naval.fleet.openSeaAway', 'Not on the open sea. The crew won\'t sail it through without you.')
      : (deps.passengersAboard?.(at.boat) ?? 0) > 0 ? 'Another player is aboard.'
      : null;
    const repair = !crewed ? 'This ship has no crew to make repairs.'
      : at.where === 'packed' ? 'This ship is in your pack.'
      : !st ? 'Not here.'
      : st.crew <= 0 ? 'This ship has no crew aboard. Hire crew at a shipwright.'
      : !st.wants && !st.fire ? 'This ship doesn\'t need repairs.'
      : st.inFight ? 'The crew is busy fighting.'
      : null;
    const yard = !n ? `Shipwrights need Naval Combat turned on (${optionPath('feat:naval-combat')}).`   // ORG2
      : !atPort ? 'A shipwright works at a port.'
      : at.where === 'away' || at.where === 'packed' ? 'Bring the ship to this port first.'
      : inFight ? 'Not while the ship is in combat.'
      : null;
    const refit = loan ? `This ship was bought on credit. Pay the ${loan.owed} gold owed to ${deps.regionName?.(loan.region) ?? 'the bank'} first.`
      : !atPort ? 'Ships are refitted at a port.'
      : at.where === 'away' || at.where === 'packed' ? 'Bring the ship to this port first.'
      : inFight ? 'Not while the ship is in combat.'
      : null;
    return { summon, away, repair, yard, refit, st, loan };
  }

  const n0 = () => naval();
  /** THE MODEL: a row a ship, the ones at hand first (sailing, here, laid up, away, packed), each by her name. */
  /** HOLDINGS: her named hands as the Crew panel reads them - CAPT-CREW: his boardings and the service he brought aboard
   *  (`prior`), his rank's other halves; AUDIT CAPTAIN'S SEA C2: a hand ashore with me (navalHost.js awayOf - none while I
   *  sail) is said so, and works no post. */
  function handsOf(boat) {
    const away = n0()?.awayOf?.(boat) ?? null;
    return (n0()?.crewHands?.(boat) ?? []).map((h, i) => ({ name: h.name, role: h.role, bard: h.mobile === MOBILE.Bard, fights: h.fights | 0, boardings: h.boardings | 0, prior: h.prior | 0, ashore: !!away?.has(i) }));
  }
  function model() {
    sweep();
    const order = { sailing: 0, here: 1, laidup: 2, away: 3, packed: 4 };
    const rows = [];
    for (const rec of fleetShips()) {
      const at = whereIs(rec);
      if (at.where === 'lost') continue;
      const why = refusals(rec, at);
      const b = at.where === 'away' || at.where === 'here' || at.where === 'sailing' ? bearing(at.boat) : { metres: null, way: null };
      rows.push({
        uid: rec.uid, hull: rec.hull, variant: rec.variant, hullName: HULL_NAMES[rec.hull], name: rec.name, label: shipLabel(rec),
        value: Number.isFinite(rec.value) ? rec.value : HULL_PRICES[rec.hull], where: at.where, metres: b.metres, way: b.way,
        port: rec.port?.name ?? null, crewed: CREWED_HULLS.includes(rec.hull), guns: hasGuns(rec.hull),
        // QUAYS: the port she lies made fast at - where she is shown, her own place (navalHost.js dockedAt); afar, the
        // last the Fleet heard of her
        docked: at.where === 'here' || at.where === 'sailing' ? n0()?.dockedAt?.(at.boat) ?? null : at.where === 'away' ? rec.port?.name ?? null : null,
        status: why.st, upgrades: { ...rec.upgrades }, loan: why.loan,
        // HOLDINGS: her named hands and their posts (a laid-up ship's signed on here), a Bard's calling his to keep
        hands: CREWED_HULLS.includes(rec.hull) && at.boat ? handsOf(at.boat) : [],
        hold: holdsCargo(rec.hull),   // CARGO-ANYWHERE: her Hold button - every hull but the Rowboat's
        flag: !!flagSizeOf(rec.hull), colours: rec.colours ?? null,   // SHIP-COLOURS: whether she flies a flag, and the one she flies
        paints: liveryPartsOf(rec.hull), livery: rec.livery ?? null,   // SHIP-LIVERY: the parts her paint takes, and her paint
        cabin: cabinShipType(rec.hull) !== SHIP_TYPES.None ? rec.cabin ?? 0 : null,   // CABIN-LOOK: her cabin's stain (null: she has no cabin)
        fittings: rec.deck?.length ?? 0,   // DECK-PROPS: how many fittings stand on her deck
        plaque: !!rec.plaque, named: !!rec.name,   // SHIP-PLAQUE: her name on her bows, and whether she has one to show
        can: { summon: why.summon, away: why.away, repair: why.repair, yard: why.yard, refit: why.refit },
      });
    }
    rows.sort((a, b) => order[a.where] - order[b.where] || a.label.localeCompare(b.label));
    return { ships: rows, gold: deps.gold?.() ?? 0, atPort: !!deps.nearPort?.(), guildArms: deps.guildArms?.() ?? null };   // SHIP-COLOURS: the arms her flag may fly
  }

  /** HER REFITS' OFFER: each line's tier, what the next costs and what the player holds of each (the pack and her hold
   *  both), and whether it can be bought now. */
  function offer(uid) {
    const rec = fleetShip(uid);
    if (!rec) return null;
    const at = whereIs(rec);
    const why = refusals(rec, at).refit;
    const lists = [pack(), at.boat?.Cargo?.Items ?? []];
    const gold = deps.gold?.() ?? 0;
    const level = captainLevel();
    const rows = UPGRADE_LINES.filter((l) => !l.guns || hasGuns(rec.hull)).map((l) => {
      const tier = Math.max(0, Math.min(UPGRADE_TIERS, rec.upgrades[l.id] | 0));
      const cost = upgradeCost(rec.hull, l.id, tier);
      // REFIT-ORES: a metal's count says how much of it a piece of plate or a blade melted down would give (`melt`)
      const melts = cost ? meltCounts(lists, cost.mats) : [];   // AUDIT 2: the stores taken together, as the act takes them
      const mats = cost ? cost.mats.map((m, i) => ({ kind: m.kind, label: MATERIALS[m.kind].label, hint: MATERIALS[m.kind].hint, n: m.n, have: materialCount(lists, m.kind), melt: melts[i] })) : [];
      const locked = !!cost && cost.level > level;   // REFIT-ORES: a metal tier asks her captain's level
      const afford = !!cost && !locked && gold >= cost.gold && materialsFor(lists, cost.mats);
      return {
        id: l.id, label: l.label, what: l.what, per: l.per, tier, max: UPGRADE_TIERS, share: refitShare(l.id, tier),   // REFIT-ORES: what she has of it now
        next: cost ? { gold: cost.gold, mats, level: cost.level, locked, share: refitShare(l.id, tier + 1) } : null, afford,
      };
    });
    return { why, rows, gold, level };
  }
  /** REFIT-ORES: her captain's level (captainTree.js levelOf off the log) - 1 with no ledger. */
  const captainLevel = () => deps.captain?.()?.captain?.().level ?? 1;

  /** A word for her, and the act's answer. */
  const said = (ok, text, door = null) => ({ ok, text, ...(door ? { door } : {}) });

  /** THE ACTS: `summon`, `away`, `repair`, `yard`, `refit` (arg: the line), `rename` (arg: the name). */
  function act(uid, verb, arg) {
    const rec = fleetShip(uid);
    if (!rec) return said(false, 'No such ship of yours.');
    const at = whereIs(rec);
    const why = refusals(rec, at);
    const r = csa(), n = naval();
    const name = shipLabel(rec);
    if (verb === 'rename') {
      const v = renameShip(uid, arg);
      if (!v.ok) return said(false, v.reason);
      deps.changed?.();
      return said(true, v.name ? `Ship renamed to ${v.name}.` : `Name cleared. The ship is shown as ${shipLabel(rec)}.`);
    }
    if (verb === 'plaque') {
      // SHIP-PLAQUE: her name shown on her bows, or taken down - wherever she lies, free; a named ship's alone
      if (!rec.name) return said(false, t('naval.plaque.unnamed', 'Give the ship a name first.'));
      if (!setShipPlaque(uid, arg)) return said(false, t('naval.plaque.bad', 'That\'s not a valid option.'));   // shown or not, nothing else
      deps.changed?.();
      return said(true, rec.plaque ? t('naval.plaque.shown', 'Ship name shown on the bow.') : t('naval.plaque.hidden', 'Ship name hidden.'));
    }
    if (verb === 'colours') {
      // SHIP-COLOURS: her flag hoisted (systems/naval/shipFlag.js's), or struck for the mod's pennant (null) - wherever she lies
      if (!flagSizeOf(rec.hull)) return said(false, t('naval.flag.noMast', 'This ship has no masthead for a flag.'));
      if (!setShipColours(uid, arg ?? null)) return said(false, t('naval.flag.bad', 'That flag can\'t be used.'));
      deps.changed?.();
      return said(true, arg ? t('naval.flag.hoisted', 'New flag raised.') : t('naval.flag.struck', 'Flag removed. The ship flies the default pennant.'));
    }
    if (verb === 'livery') {
      // SHIP-LIVERY: her paint (systems/naval/shipLivery.js's), or as built (null) - wherever she lies; her word said again
      if (!liveryPartsOf(rec.hull).length) return said(false, t('naval.paint.none', 'This ship can\'t be painted.'));
      // CABIN-LOOK: and her cabin's stain with it, where she has a cabin (made at her next visit below) - both read before
      // either is set, so a paint refused leaves her as she was
      const below = cabinShipType(rec.hull) !== SHIP_TYPES.None, cabin = arg?.cabin ?? 0;
      if ((below && !isPaint(cabin)) || !setShipLivery(uid, arg ?? null)) return said(false, t('naval.paint.bad', 'Unknown paint.'));
      if (below) setShipCabin(uid, cabin);
      deps.changed?.();
      return said(true, rec.livery || rec.cabin ? t('naval.paint.done', 'Ship painted. Other players will see it.') : t('naval.paint.bare', 'Paint removed. The ship is back to its original look.'));
    }
    if (verb === 'deck') {
      // DECK-PROPS: her fittings set (systems/naval/deckFittings.js's door) - wherever she lies; her word said again
      if (!setShipFittings(uid, arg ?? [])) return said(false, t('naval.deck.bad', 'Those fittings can\'t be placed on this ship.'));   // none clears her deck; a thing that is no list is refused
      deps.changed?.();
      return said(true, rec.deck.length ? t('naval.deck.set', 'Deck layout saved: {n, plural, one {# fitting} other {# fittings}}.', { n: rec.deck.length }) : t('naval.deck.clear', 'Deck cleared.'));
    }
    if (verb === 'deckPlan') {
      if (!deps.openDeck) return said(false, t('naval.hold.noSea', 'Come Sail Away is not running.'));
      return said(true, t('naval.deck.opened', 'Deck plan opened.'), () => !!deps.openDeck(uid));
    }
    if (verb === 'role') {
      // HOLDINGS: a hand of hers given a post (shipCrew.js assign) - wherever she lies; her First Mate answers for her
      if (!CREWED_HULLS.includes(rec.hull) || !at.boat) return said(false, 'This ship has no crew.');
      if (!arg || !(/** @type {readonly string[]} */ (CREW_ROLES).includes(arg.role) || arg.role === 'Bard')) return said(false, 'There\'s no such post on this ship.');
      const r2 = n?.assignRole?.(at.boat, arg.name, arg.role) ?? { ok: false, text: 'Not here.' };
      return said(r2.ok, r2.text);
    }
    if (verb === 'summon') {
      if (why.summon) return said(false, why.summon);
      setShipPort(uid, null);   // AUDIT HOLDINGS Q8: called away from where she lay - made fast at the quay, the docking says the port again
      const title = titleOf(uid);
      const berth = n?.freeBerth?.(rec.hull) ?? null;   // QUAYS: alongside its quay for her own hull - made fast at it
      if (berth) {
        const boat = r.SummonBoat(uid, title, fleetBook(), berth.position, berth.direction, deps.terrainAt?.(berth.position) ?? null);
        if (!boat) return said(false, 'The ship couldn\'t be brought here.');
        return said(true, `${name} is brought to ${berth.harbour ? `${berth.harbour}'s` : 'the'} quay and moored.`);
      }
      // no berth known (the sea fight off, every one taken): the deed's own placing - the water clicked
      if (!title && at.where !== 'away') return said(false, 'The ship couldn\'t be brought here.');
      return said(true, `Choose where ${name} lies: click the water near the quay.`, () => {
        // AUDIT HOLDINGS F2: her title placed from the book; a small boat afloat elsewhere (no title - spent on her
        // placing) from a deed of the moment in a list of its own, never minted into the book: a click on land, a fast
        // travel or a placing already under way left that title in the book while she stood
        const t = title ?? mintDeed(rec.hull, rec.variant, uid, rec.value);
        const list = title ? fleetBook() : [t];
        r.StartPlacing(t, () => list);
        return true;
      });
    }
    if (verb === 'away') {
      if (why.away) return said(false, why.away);
      const near = deps.nearestPort?.() ?? null;
      knowShip(uid, at.boat.hull, at.boat.variant, at.boat.itemValue);   // AUDIT HOLDINGS F3: her rig as she is sent away
      retitle(uid);   // a small boat's title, spent on her placing, made again: the book stands for her laid up
      if (!r.LayUpBoat(at.boat)) return said(false, 'The ship couldn\'t be laid up.');
      setShipPort(uid, near ? { name: near.name, ether: !!near.ether } : null);
      return said(true, near ? `${name} sails for ${near.name}, and is laid up there.` : `${name} is laid up.`);
    }
    if (verb === 'repair') {
      if (why.repair) return said(false, why.repair);
      if (at.boat && at.boat === n?.boatInPlay?.()) {
        const o = n.giveOrder(at.boat, CREW_ORDERS.repair);   // the boat underfoot: her hands at it as her captain orders
        return said(!!o.ok, o.said ?? 'The crew starts repairs.');
      }
      const out = n?.repairAway?.(at.boat) ?? { ok: false, text: 'Not here.' };
      return said(out.ok, out.text);
    }
    if (verb === 'hold') {
      // CARGO-ANYWHERE (bible/03-World/Naval-Refit.md): her hold, wherever she lies - here, away, laid up or packed - and
      // in a fight too; a Rowboat carries none (holdDoor.js HULL_HOLDS)
      if (!holdsCargo(rec.hull)) return said(false, t('naval.hold.rowboat', 'Rowboats have no hold.'));
      if (!deps.openHold) return said(false, t('naval.hold.noSea', 'Come Sail Away is not running.'));
      return said(true, t('naval.hold.opened', 'Hold opened.'), () => !!deps.openHold(uid));
    }
    if (verb === 'yard') {
      if (why.yard) return said(false, why.yard);
      const boat = at.boat;
      return said(true, 'The shipwright inspects the ship.', () => !!n.openYard(boat));
    }
    if (verb === 'refit') {
      if (why.refit) return said(false, why.refit);
      const o = offer(uid);
      const row = o?.rows.find((x) => x.id === arg);
      if (!row || !row.next) return said(false, 'This ship has every refit of that kind.');
      if (row.next.locked) return said(false, t('naval.refit.level', '{metal} refits need captain level {level}.', { metal: row.next.mats[0].label, level: row.next.level }));
      if ((deps.gold?.() ?? 0) < row.next.gold) return said(false, `The shipwright asks ${row.next.gold} gold.`);
      const lists = [pack(), at.boat?.Cargo?.Items ?? []];
      for (const m of row.next.mats) if (materialCount(lists, m.kind) < m.n) return said(false, `The shipwright needs ${m.n} ${m.label} (you have ${m.have}).`);
      if (!materialsFor(lists, row.next.mats)) return said(false, t('naval.refit.short', 'Not enough materials. One item cannot count for two requirements.'));   // REFIT-ORES: a steel ingot counted for Steel and Iron both
      takeAllMaterials(lists, row.next.mats);   // AUDIT 2: as materialsFor tried them
      deps.pay?.(row.next.gold);
      addRefit(uid, row.id);
      n?.refitBoat?.(at.boat);
      if (at.boat && r?.state?.CurrentBoat === at.boat) r.UpdateBoatCargoMod?.(at.boat);
      deps.changed?.();
      return said(true, `${name}'s ${row.label.toLowerCase()} is refitted (${REFIT_NUMERALS[row.tier + 1]}).`);
    }
    return said(false, 'Not here.');
  }

  /** Her refits as Come Sail Away and the sea fight read them (systems/fleet.js refitOf), by her number - CAPTAIN-TREE:
   *  and her captain's stars over them (captainTree.js captainRefit), a ship of mine's alone: a number the Fleet does not
   *  know (a peer's boat, a stranger's) reads her build's own. */
  const refit = (boat) => {
    if (!boat?.uid) return null;
    const rec = fleetShip(boat.uid);
    return rec ? captainRefit(refitOf(rec), deps.captain?.()?.stats?.() ?? null) : refitOf(null);
  };
  /** CAPTAIN-TREE: every ship of mine read again on her captain's stars, once a sky is accepted - the sea fight's state
   *  built on her new whole (her hurts the share of it they were, `refitBoat`), the helm's hold weighed again. AUDIT 2: a
   *  laid-up or packed ship's too - her state is kept by her number from the page's first read of her (fleetStatus), and
   *  a summons stands her on it: she sailed out on the stars given back. */
  function restat() {
    const n = naval(), r = csa();
    const standing = new Map(placed().map((b) => [b.uid, b]));
    for (const rec of fleetShips()) n?.refitBoat?.(standing.get(rec.uid) ?? { uid: rec.uid, hull: rec.hull });
    if (r?.state?.CurrentBoat) r.UpdateBoatCargoMod?.(r.state.CurrentBoat);
  }
  /** Her name, or '' (the boats' word, the hover's line). */
  const nameOf = (boat) => (boat?.uid ? fleetShip(boat.uid)?.name ?? '' : '');

  return { model, offer, act, sweep, refit, restat, nameOf, whereIs };
}
