// THE PENDING QUEST OFFER (AUDIT 58) - DaggerfallUI's half of
// GivePc's deferred hand-over, MIT Daggerfall Workshop.
//
// A `give pc _item_ notify 1234` / `... silently` line does not fire
// where the quest says so: GivePc.Update holds it until the player is
// in a town, outdoors, between 07:00 and 18:00, and then rolls a
// 40..500-tick walk-around delay so a bundle of offers does not all
// land in the same second (GivePc.cs:69-97). At the MOMENT that delay
// is rolled it raises a static event - `RaiseOnOfferPendingEvent(this)`
// (:96, delegate + event at :238-244) - and DaggerfallUI is the only
// subscriber in the tree: `Questing.Actions.GivePc.OnOfferPending +=
// GivePc_OnOfferPending;` in Awake (DaggerfallUI.cs:352), whose
// handler simply latches the sender (:1731-1735).
//
// The latch is then spent by TWO key presses, and by nothing else:
//
//   bool GiveOffer()                      (DaggerfallUI.cs:1717-1726)
//   {
//       if (lastPendingOfferSender != null)
//       {
//           lastPendingOfferSender.OfferImmediately();
//           lastPendingOfferSender = null;
//           return true;
//       }
//       return false;
//   }
//
// - FAST TRAVEL: `if (!GiveOffer())` sits between AreEnemiesNearby and
//   the sun-damage box (:612), so the press that would have opened the
//   travel map hands the item over instead and the map stays shut.
// - REST: `else if (!GiveOffer())` sits between the prevented-rest
//   message and the racial override (:680), so the press that would
//   have opened the rest window hands the item over instead.
//
// In both places the press is CONSUMED - one press, one offer, and the
// second press travels or rests normally. That is the whole law: a
// player walking into town with a letter pending gets it the moment
// they try to leave or sleep, rather than after the full tick delay.
//
// The latch is a UI-lifetime singleton because DFU's is: a static
// event on the action class, a plain field on the UI singleton. It is
// NOT saved - DaggerfallUI has no serializer for it - so a load starts
// with an empty latch and the pending offer waits out its delay, which
// is what DFU does too.

/** DaggerfallUI.lastPendingOfferSender - the GivePc action whose
 *  offer became eligible most recently, or null. */
let lastPendingOfferSender = null;

/** GivePc_OnOfferPending (DaggerfallUI.cs:1731-1735) - the whole
 *  handler: latch the sender. */
export function noteOfferPending(sender) {
  lastPendingOfferSender = sender ?? null;
}

/** GiveOffer (DaggerfallUI.cs:1717-1726). True when a pending offer
 *  was handed over, which means the press that asked is spent. */
export function giveOffer() {
  if (lastPendingOfferSender != null) {
    lastPendingOfferSender.offerImmediatelyNow();
    lastPendingOfferSender = null;
    return true;
  }
  return false;
}

/** Probe/teardown seam: the latch itself. */
export const pendingOfferSender = () => lastPendingOfferSender;
export function clearPendingOffer() { lastPendingOfferSender = null; }
