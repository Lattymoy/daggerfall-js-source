// @ts-check
// THE FLEET'S HOST HALF (HOLDINGS, 2026-10-03 - bible/03-World/Holdings.md). The Fleet page (ui/fleetPage.js) reads a
// model and asks acts; this builds the one and carries out the other over the world host's runtimes - Come Sail Away's
// boats (the mod's own laws: SummonBoat, LayUpBoat, StartPlacing over the Fleet's book), the sea fight's state of each
// (scenes/navalHost.js fleetStatus, repairAway, refitBoat, the yard, the berths), and the ledger (systems/fleet.js).
// Built by scenes/world.js, the one host that stands Come Sail Away; the page is taken down with it.
//
//   deps = {
//     csa() -> Come Sail Away's runtime | null        naval() -> the naval host | null
//     pack() -> the player's items (live)              gold() -> the purse; pay(n)
//     accounts() -> the bank accounts                  regionName(i) -> a region's name
//     where() -> { inside, pixel: {X, Y}, feet: [x, y, z] }    the player as the page reads them
//     nearPort() -> bool                               nearestPort() -> { name, way } | null
//     terrainAt(pos) -> the terrain a summoned boat stands on (Come Sail Away's own arm), or null
//     changed() -> the word a rename or a refit owes (the boats' record said again)
//   }

import {
  fleetShip, fleetShips, fleetBook, titleOf, titleDeedsIn, knowShip, renameShip, addRefit, setShipPort, retitle, refitOf, loanOwed, settleCredit,
  shipLabel, upgradeCost, materialCount, takeMaterials, UPGRADE_LINES, UPGRADE_TIERS, MATERIALS, BOAT_PARTS_TEMPLATE,
} from '../systems/fleet.js';
import { HULL_NAMES, HULL_PRICES } from '../systems/comeSailAwayBoat.js';
import { mintDeed } from '../systems/comeSailAwayItems.js';
import { TERRAIN_EDGE } from '../systems/comeSailAway.js';
import { batteriesOf } from '../systems/naval/navalShips.js';
import { CREW_ORDERS, CREW_ROLES } from '../systems/naval/shipCrew.js';
import { MOBILE } from '../systems/naval/navalBoarding.js';
import { optionPath } from '../ui/settingsMap.js';   // ORG2: a switch named in a line says where it lives

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
  /** The boats of mine standing, by number. */
  const placed = () => (csa()?.AllBoats ?? []).filter((b) => b?.uid);
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
    const summon = !r ? 'Come Sail Away is not running.'
      : at.where === 'sailing' || at.where === 'here' ? 'She is already here.'
      : at.where === 'packed' ? 'She is in your pack - launch her from her parts.'
      : w.inside ? 'Call her from outdoors.'
      : sailing ? 'Not while you are at a helm.'
      : inFight ? 'Not while she is fighting.'
      : !atPort ? 'Your ships are brought round to a port - go to one.'
      : null;
    const away = !r ? 'Come Sail Away is not running.'
      : at.where === 'laidup' ? 'She is laid up already.'
      : at.where === 'packed' ? 'She is in your pack.'
      : at.where === 'sailing' ? 'Not while you are at her helm.'
      : inFight ? 'Not while she is fighting.'
      : !crewed && at.where !== 'here' ? 'She has no crew to sail her to a port - go to her.'
      : (deps.passengersAboard?.(at.boat) ?? 0) > 0 ? 'Another player is aboard her.'
      : null;
    const repair = !crewed ? 'She has no crew to make her repairs.'
      : at.where === 'packed' ? 'She is in your pack.'
      : !st ? 'Not here.'
      : st.crew <= 0 ? 'She has no hands aboard - hire them at a shipwright.'
      : !st.wants && !st.fire ? 'She needs no repairs.'
      : st.inFight ? 'Her hands are fighting her.'
      : null;
    const yard = !n ? `The shipwrights are not at work (Naval Combat, ${optionPath('feat:naval-combat')}).`   // ORG2
      : !atPort ? 'A shipwright works at a port.'
      : at.where === 'away' || at.where === 'packed' ? 'Bring her to this port first.'
      : inFight ? 'Not while she is fighting.'
      : null;
    const refit = loan ? `She was bought on the bank's credit: pay ${deps.regionName?.(loan.region) ?? 'the bank'}'s ${loan.owed} gold first.`
      : !atPort ? 'Ships are refitted at a port.'
      : at.where === 'away' || at.where === 'packed' ? 'Bring her to this port first.'
      : inFight ? 'Not while she is fighting.'
      : null;
    return { summon, away, repair, yard, refit, st, loan };
  }

  const n0 = () => naval();
  /** THE MODEL: a row a ship, the ones at hand first (sailing, here, laid up, away, packed), each by her name. */
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
        hands: CREWED_HULLS.includes(rec.hull) && at.boat ? (n0()?.crewHands?.(at.boat) ?? []).map((h) => ({ name: h.name, role: h.role, bard: h.mobile === MOBILE.Bard, fights: h.fights | 0 })) : [],
        can: { summon: why.summon, away: why.away, repair: why.repair, yard: why.yard, refit: why.refit },
      });
    }
    rows.sort((a, b) => order[a.where] - order[b.where] || a.label.localeCompare(b.label));
    return { ships: rows, gold: deps.gold?.() ?? 0, atPort: !!deps.nearPort?.() };
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
    const rows = UPGRADE_LINES.filter((l) => !l.guns || hasGuns(rec.hull)).map((l) => {
      const tier = Math.max(0, Math.min(UPGRADE_TIERS, rec.upgrades[l.id] | 0));
      const cost = upgradeCost(rec.hull, l.id, tier);
      const mats = cost ? cost.mats.map((m) => ({ kind: m.kind, label: MATERIALS[m.kind].label, hint: MATERIALS[m.kind].hint, n: m.n, have: materialCount(lists, m.kind) })) : [];
      const afford = !!cost && gold >= cost.gold && mats.every((m) => m.have >= m.n);
      return { id: l.id, label: l.label, what: l.what, per: l.per, tier, max: UPGRADE_TIERS, next: cost ? { gold: cost.gold, mats } : null, afford };
    });
    return { why, rows, gold };
  }

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
      return said(true, v.name ? `She is the ${v.name} now.` : `She is called by her hull again: ${shipLabel(rec)}.`);
    }
    if (verb === 'role') {
      // HOLDINGS: a hand of hers given a post (shipCrew.js assign) - wherever she lies; her First Mate answers for her
      if (!CREWED_HULLS.includes(rec.hull) || !at.boat) return said(false, 'She has no crew.');
      if (!arg || !(/** @type {readonly string[]} */ (CREW_ROLES).includes(arg.role) || arg.role === 'Bard')) return said(false, 'No such post aboard her.');
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
        if (!boat) return said(false, 'She could not be brought round.');
        return said(true, `${name} is brought round to ${berth.harbour ? `${berth.harbour}'s` : 'the'} quay and made fast.`);
      }
      // no berth known (the sea fight off, every one taken): the deed's own placing - the water clicked
      if (!title && at.where !== 'away') return said(false, 'She could not be brought round.');
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
      if (!r.LayUpBoat(at.boat)) return said(false, 'She could not be sent away.');
      setShipPort(uid, near ? { name: near.name } : null);
      return said(true, near ? `${name} sails for ${near.name}, and is laid up there.` : `${name} is laid up.`);
    }
    if (verb === 'repair') {
      if (why.repair) return said(false, why.repair);
      if (at.boat && at.boat === n?.boatInPlay?.()) {
        const o = n.giveOrder(at.boat, CREW_ORDERS.repair);   // the boat underfoot: her hands at it as her captain orders
        return said(!!o.ok, o.said ?? 'Her hands turn to.');
      }
      const out = n?.repairAway?.(at.boat) ?? { ok: false, text: 'Not here.' };
      return said(out.ok, out.text);
    }
    if (verb === 'yard') {
      if (why.yard) return said(false, why.yard);
      const boat = at.boat;
      return said(true, 'The shipwright looks her over.', () => !!n.openYard(boat));
    }
    if (verb === 'refit') {
      if (why.refit) return said(false, why.refit);
      const o = offer(uid);
      const row = o?.rows.find((x) => x.id === arg);
      if (!row || !row.next) return said(false, 'She has every refit of that kind.');
      if ((deps.gold?.() ?? 0) < row.next.gold) return said(false, `The shipwright asks ${row.next.gold} gold.`);
      const lists = [pack(), at.boat?.Cargo?.Items ?? []];
      for (const m of row.next.mats) if (materialCount(lists, m.kind) < m.n) return said(false, `The shipwright needs ${m.n} ${m.label} (you have ${m.have}).`);
      for (const m of row.next.mats) takeMaterials(lists, m.kind, m.n);
      deps.pay?.(row.next.gold);
      addRefit(uid, row.id);
      n?.refitBoat?.(at.boat);
      if (at.boat && r?.state?.CurrentBoat === at.boat) r.UpdateBoatCargoMod?.(at.boat);
      deps.changed?.();
      return said(true, `${name}'s ${row.label.toLowerCase()} is refitted (${['', 'I', 'II', 'III'][row.tier + 1]}).`);
    }
    return said(false, 'Not here.');
  }

  /** Her refits as Come Sail Away and the sea fight read them (systems/fleet.js refitOf), by her number. */
  const refit = (boat) => (boat?.uid ? refitOf(fleetShip(boat.uid)) : null);
  /** Her name, or '' (the boats' word, the hover's line). */
  const nameOf = (boat) => (boat?.uid ? fleetShip(boat.uid)?.name ?? '' : '');

  return { model, offer, act, sweep, refit, nameOf, whereIs };
}
