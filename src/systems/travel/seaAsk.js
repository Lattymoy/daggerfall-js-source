// @ts-check
// ═══════════════════════════════════════════════════════════════════
// The Overworld's crossing's two asks of the planner (OWS2, bible/06-Systems/Travel-View.md "OWS - the sea"; moved out of
// scenes/world.js by PLAN-SLICES, HOST-SPLIT - the world host imports them by the same names).
// ═══════════════════════════════════════════════════════════════════

/** AUDIT OW5 S3 (the audit before the merge): A MOORED BOAT IS TAKEN ONLY WHERE THE ROUTE PUTS TO SEA. A boat moored in
 *  reach starts the search afloat (`start: 'sea'`), so a trip with no water on the way was begun at its helm - boarded,
 *  landed at once and packed (a crewed ship left moored), the bar saying "by sea" - before the walk began. A plan whose
 *  steps never sail is planned again on land (`replan`), and that one taken when there is one: the boat left where it
 *  lies. Null: keep the plan as it is. */
export function tvMooredDry(means, plan, replan) {
  if (!means || means.voyage) return null;
  // a boat to hand that finds no plan at all is planned again on foot - the search afloat and ashore
  // spent its count where the walk alone finds its way (Wayrest to Markarth, Daggerfall to Farrun, boat parts packed)
  if (!plan) return replan();
  if (means.how !== 'moored' || plan.kinds.includes('sea')) return null;
  return replan();
}
/** The planner's ask: where the traveller starts, whether a landfall packs the boat, where the journey ends - and
 *  PASSAGE: whether it is a booked ship's voyage (ashore at its port, never packed); the means' other fields ride
 *  along unread (travelRoute.js planRoute reads `start`, `again`, `goal` and `voyage`). */
export const tvSeaAsk = (means, goal) => (means ? { ...means, again: means.again && !means.voyage, goal } : null);
