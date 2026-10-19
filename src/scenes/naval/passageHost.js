// @ts-check
// PASSAGE (2026-10-19, the owner: "Add the ability to buy and ride a friendly boat (if one is docked) at any port. You
// can have the ability to choose where you want to sail. A new form of immersive travel") - THE VOYAGE'S HOST HALF.
// The law is systems/naval/passage.js; the ship at her berth and her boat are scenes/naval/navalHost.js's (passageShip,
// charter); the voyage itself is the Overworld's crossing (OWS2, world.js travelViewRouteTo) - this module owns the
// booking and the passage's life, and the world host constructs it once and calls it (HOST-SPLIT: fishHost.js's shape).
//
//   offer(ship)  - Activate on a berth's friendly ship (navalHost.js activate): her master's ports, nearest first with
//                  their fares (a list picker), then the question with the purse beside the fare (a Yes/No box).
//   book(ship, d) - Yes: the purse, the journey's own gate (no foe near, no wall underfoot), then her boat (charter: her
//                  hull at her berth, the voyage's record on it), the helm taken, the journey begun to the port - and
//                  only then her ship let go (charterSailed) and the fare paid. A journey refused puts everything back: her boat gone,
//                  the player where they stood, nothing paid, she still at her berth.
//   frame(dt)    - the passage's life: aboard with no journey under way (a foe stopped it, a load put me at her helm),
//                  her master sails on (PASSAGE_FIRST_S, then PASSAGE_RESUME_S; PASSAGE_RESUMES at most); off her past
//                  PASSAGE_LEAVE_M and not aboard, it is over (end).
//   end(boat)    - what was put in her hold into the pack, her boat out of the world (Come Sail Away's LayUpBoat, and
//                  her number's hold let go), her sea-fight record forgotten; she stands out to sea.
//
//   deps = {   (LEGIBLE's ceilings: the world's own doors handed as they are, a wrapper only where one must be)
//     naval() -> navalHost | null     csa() -> Come Sail Away's runtime | null (the mod on)
//     ports() -> [{ key, name, px, py }]     here() -> the port I stand at | null     pixel() -> my map pixel { x, y }
//     ether(pixel) -> past the Veil     place(port) -> the travel map's summary of it | null (never discovered)
//     canGo() -> a journey may set out now (says why not)
//     route(summary, { voyage, noWay }) -> a journey begun to it (world.js travelViewRouteTo; says why not)
//     travel() -> the journey's runtime (Travel Options: isTravelActive, clearTravelDestination)
//     journeyTo() -> the pixel the journey under way goes to ('spot' for a spot on the Overworld) | null
//     standsOn(boat) -> her deck underfoot     busy() -> a world's move under way
//     player -> the motor (feetAt(), spawn(x, y, z), transportMode)     remount(mode) -> the player rides as they rode
//     talk -> the street's words (say(text), showOverlay(window))
//     gold() / pay(n) / pack() -> the purse and the pack - the player entity's own (court.js) unless handed
//   }
//
// Not a DFU member. Ledger A (PASSAGE).
import { ListPickerWindow } from '../../ui/listPicker.js';
import { YesNoBoxWindow } from '../../ui/yesNoBox.js';
import { addItem } from '../../systems/inventory.js';
import { hullBuild } from '../../systems/naval/navalShips.js';   // AUDIT PASSAGE A2: her hull's reach from her root
import { playerEntity, surfacePlayer } from '../../characters/playerEntity.js';
import { totalGoldAmount, deductGold } from '../../systems/court.js';   // the purse's own law: coins, then letters of credit
import {
  passageDestinations, charterRecord, PASSAGE_TEXT, PASSAGE_LEAVE_M, PASSAGE_OFF_S, PASSAGE_RESUME_S, PASSAGE_FIRST_S, PASSAGE_RESUMES, PASSAGE_SLOW,
} from '../../systems/naval/passage.js';

/** AUDIT PASSAGE A2: how far her hull reaches from her root (m) - bow or stern, the farther: a Carrack's helm stands 19.5
 *  m aft of it, and a player on her forecastle stood "off her" by her root's measure. */
export const hullReach = (hull) => { const b = hullBuild(hull); return Math.max(Math.abs(b.bowZ ?? 0), Math.abs(b.aftZ ?? 0)); };

/** @param {any} deps */
export function createPassageHost(deps) {
  const csa = () => deps.csa?.() ?? null;
  /** The voyage's own clock: how long aboard with no journey under way, the master's tries, what was last said, how long
   *  off her - and the boat it is the clock of (AUDIT PASSAGE A4: a load stands another boat, and her master's clock is
   *  hers, never the last voyage's). */
  let idle = 0, fails = 0, first = true, said = null, off = 0, clockOf = null;
  const resetClock = (boat, fresh) => { idle = 0; fails = 0; first = fresh; said = null; off = 0; clockOf = boat; };
  /** The boat my passage rides (one at a time), or null. */
  const charterBoat = () => csa()?.AllBoats?.find((b) => b?.charter) ?? null;
  const gold = () => Math.max(0, Math.floor(Number(deps.gold ? deps.gold() : totalGoldAmount(playerEntity)) || 0));
  const pay = (n) => { if (deps.pay) deps.pay(n); else { deductGold(playerEntity, n); surfacePlayer(); } };
  const pack = () => deps.pack?.() ?? (playerEntity.items ??= []);
  const say = (text) => deps.talk.say(text);
  const show = (win) => deps.talk.showOverlay(win);
  const feet = () => deps.player.feetAt();
  /** Aboard her: at her helm, her deck underfoot, or the boat I boarded another ship from while I fight on that one's
   *  deck (the naval host's boatInPlay - AUDIT PASSAGE B2: a boarding 16 m off her laid her up under me at sea). */
  const aboard = (b) => csa()?.state?.CurrentBoat === b || !!deps.standsOn?.(b) || deps.naval?.()?.boatInPlay?.() === b;
  const journeyLive = () => !!deps.travel?.()?.isTravelActive;
  const stopJourney = () => deps.travel?.()?.clearTravelDestination?.();

  /** Her master's ports. Answers whether the list went up. */
  function offer(ship) {
    if (!csa()) { say(PASSAGE_TEXT.noSail); return false; }
    if (charterBoat()) { say(PASSAGE_TEXT.booking); return false; }
    if (deps.ether?.(deps.pixel())) { say(PASSAGE_TEXT.ether); return false; }
    const list = passageDestinations(deps.ports?.() ?? [], deps.pixel(), { hereKey: deps.here?.()?.key ?? null, known: (p) => !!deps.place(p) });
    if (!list.length) { say(PASSAGE_TEXT.none); return false; }
    show(new ListPickerWindow({ items: list.map(PASSAGE_TEXT.row), onPick: (i) => { if (list[i]) ask(ship, list[i]); } }));
    return true;
  }
  /** The question: the port, the fare and the purse - nothing paid until Yes. */
  function ask(ship, d) {
    show(new YesNoBoxWindow({ rows: PASSAGE_TEXT.ask(ship.name, d.port.name, d.fare, gold()), onYes: () => book(ship, d) }));
  }
  /** Yes: the passage made, all of it or none of it. Answers whether she sails. */
  function book(ship, d) {
    const r = csa(), n = deps.naval?.();
    if (!r || !n) { say(PASSAGE_TEXT.noSail); return false; }
    if (charterBoat()) { say(PASSAGE_TEXT.booking); return false; }
    if (gold() < d.fare) { say(PASSAGE_TEXT.poor(d.fare)); return false; }
    const summary = deps.place(d.port);
    if (!summary || !deps.canGo()) return false;   // the journey's own gate says why
    const record = charterRecord({ to: { name: d.port.name, px: d.port.px, py: d.port.py }, ship: ship.name, captain: ship.captain, fare: d.fare });
    const stood = [...feet()], ride = deps.player.transportMode ?? null;   // AUDIT PASSAGE A7: the helm puts a rider on foot
    const boat = n.charter(ship.id, record);
    if (!boat) { say(PASSAGE_TEXT.gone); return false; }
    let helm = false, sails = false;
    try {
      r.StartSailing(boat);
      helm = r.isSailing() && r.state?.CurrentBoat === boat;
      sails = helm && deps.route(summary, { voyage: true, noWay: () => say(PASSAGE_TEXT.noWay) });   // the route says why it will not go
    } catch (err) { console.warn('[passage] her voyage would not begin', err); stopJourney(); }   // AUDIT PASSAGE A7: no journey left aimed at a boat taken back
    if (!sails) {   // refused: everything back as it was - her boat gone, the player where they stood (and riding as they rode), she at her berth
      try { if (r.isSailing()) r.StopSailing(); } catch (err) { console.warn('[passage] her helm would not be left', err); }
      deps.player.spawn(stood[0], stood[1], stood[2]);
      if (ride != null) deps.remount?.(ride);
      remove(boat);
      if (!helm) say(PASSAGE_TEXT.failed);
      return false;
    }
    n.charterSailed(ship.id);   // under way: her ship let go, her boat in her place
    pay(d.fare);
    resetClock(boat, false);
    say(PASSAGE_TEXT.booked(ship.name, ship.captain, d.fare, d.port.name));
    return true;
  }
  /** Her boat out of the world: Come Sail Away's laying up (her hold moved under her number, as it moves every ship's),
   *  then that hold - anything put in it - into the pack and her number's hold let go, her sea-fight record forgotten.
   *  False while she cannot go yet (at my helm, a player aboard): nothing has moved. AUDIT PASSAGE A5: the hold went into
   *  the pack first, so a laying up refused for a player aboard took it silently, and the word was never said. */
  function remove(boat) {
    const r = csa();
    if (!r || !boat) return false;
    if (!r.LayUpBoat(boat)) return false;
    const held = r.laidUpHold?.(boat.uid) ?? [];
    const goods = held.length > 0;
    if (goods) { const into = pack(); for (const it of held.splice(0)) addItem(into, it); }
    r.forgetHold?.(boat.uid);
    deps.naval?.()?.forgetBoat?.(boat.uid);
    if (goods) say(PASSAGE_TEXT.goods);
    return true;
  }
  /** The passage over: she stands out to sea. */
  function end(boat) {
    const name = boat.charter?.ship ?? null;
    if (!remove(boat)) return false;
    resetClock(null, true);
    say(PASSAGE_TEXT.ended(name));
    return true;
  }
  /** The passage's life, each frame (`paused`: nothing moves). */
  function frame(dt, paused = false) {
    const r = csa();
    const boat = r ? charterBoat() : null;
    if (!boat || paused || deps.busy?.()) return;   // AUDIT PASSAGE B2: nor through a world's move (a door, a jump) - its feet are not yet where it put them
    if (boat !== clockOf) resetClock(boat, true);   // AUDIT PASSAGE A4: a load's boat - her own clock, the first try soon
    boat.packable = false;   // never packed (a load stands her hull's own word again) - so the crossing plans no second launch
    if (!aboard(boat)) {
      // AUDIT PASSAGE A2: off her by her HULL's measure, and for PASSAGE_OFF_S together - a jump on her forecastle, a
      // fall through a hatch, a knock off her deck is no leaving; ashore, over the side, through a door, it is
      const f = feet(), p = boat.GameObject?.position;
      const far = !p || !f || Math.hypot(p[0] - f[0], p[2] - f[2]) > PASSAGE_LEAVE_M + hullReach(boat.hull);
      off = far ? off + Math.max(0, dt) : 0;
      if (off >= PASSAGE_OFF_S) end(boat);
      return;
    }
    off = 0;
    const rec = charterRecord(boat.charter);
    if (!rec) return;   // AUDIT PASSAGE A6: a record that reads as nothing sails nowhere - and ends only when I am off her
    if (journeyLive()) {
      // AUDIT PASSAGE B3: a journey from her helm aimed anywhere but her port - her master holds his course, and sails on
      // for it soon; a fare to the next port bought a crewed ship to sail where the passenger liked
      const to = deps.journeyTo?.();
      if (to && (to === 'spot' || to.x !== rec.to.px || to.y !== rec.to.py)) { stopJourney(); say(PASSAGE_TEXT.holds(rec.to.name)); idle = 0; first = true; return; }
      idle = 0;
      return;
    }
    idle += Math.max(0, dt);
    if (idle < (first ? PASSAGE_FIRST_S : fails >= PASSAGE_RESUMES ? PASSAGE_RESUME_S * PASSAGE_SLOW : PASSAGE_RESUME_S)) return;
    idle = 0;
    if (!r.isSailing() || r.state?.CurrentBoat !== boat) { if (said !== 'helm') { said = 'helm'; say(PASSAGE_TEXT.helm(rec.to.name)); } return; }
    first = false;
    const summary = deps.place({ name: rec.to.name, px: rec.to.px, py: rec.to.py });
    if (!summary || !deps.canGo()) return;   // AUDIT PASSAGE A3: a foe near is what she waits out - no try spent on it
    if (deps.route(summary, { voyage: true, noWay: () => {} })) { fails = 0; said = null; return; }
    if (++fails === PASSAGE_RESUMES) { said = 'stuck'; say(PASSAGE_TEXT.stuck(rec.to.name)); }   // said once a run of them
  }
  return { offer, book, frame, end, charterBoat };
}
