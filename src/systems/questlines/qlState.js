// @ts-check
// QL1 (bible/06-Systems/Questlines-Arc.md section 2.4): A STAMPED QUEST'S STATE - its one home, a leaf with no imports,
// because the quest itself (systems/quest/quest.js) saves and restores it and the quest must not pull the layer's
// world in behind it. The stamp's meaning, the switch and every reader of the state are systems/questlines/qlLaw.js's.

/** The one stamp this law knows. A save carrying another is read as unstamped - a later law's quest is not misread. */
export const QL_STAMP = 1;

/** A stamped quest's state, fresh: its tier (section 5.1, the bridge's at the start), the objectives opened, done and
 *  failed (ids - each latched: an objective the player has been shown stays shown), the branches' choices (branch id -> choice id), the outcome reached (id), whether its reward was paid and its
 *  standing moved, the acts it has heard (QL11: kind -> count since it started) and whether this copy was RECEIVED from a
 *  party member (receivedState). AUDIT QUESTLINES REWARD-15: no `offer` - declared, read and reset, never written: a
 *  reward's choice waits in the layer's offers (qlLayer.js), and `moved` is what says the outcome was settled.
 *  FIELD BUGS 2026-10-25i HEART-TAKEN (AUDIT FB1025i B4): `reread`, the mends this state has taken - a sheet's objective
 *  whose binding was mended names its mend, and a state that has not taken it reads that objective afresh once (qlLaw.js
 *  observe), so a latch an older build wrote under the old binding does not stand. */
export const freshState = () => ({ stamp: QL_STAMP, tier: 1, opened: [], done: [], failed: [], choices: {}, outcome: null, paid: false, moved: false, acts: {}, received: false, reread: [] });

const idList = (v) => (Array.isArray(v) ? [...new Set(v.filter((x) => typeof x === 'string' && x))] : []);
const strMap = (v) => (v && typeof v === 'object' && !Array.isArray(v)
  ? Object.fromEntries(Object.entries(v).filter(([k, x]) => typeof k === 'string' && typeof x === 'string' && x)) : {});
const countMap = (v) => (v && typeof v === 'object' && !Array.isArray(v)
  ? Object.fromEntries(Object.entries(v).filter(([, x]) => Number.isSafeInteger(x) && x > 0)) : {});

/** A save's `ql`, read back: a stamp this law knows and its fields each of its own kind, else null - a hand-edited or
 *  older envelope never throws a quest out of the load (machine.js restoreSaveData's per-quest catch is for DFU's
 *  removed-mod law, not for this). */
export function readState(data) {
  if (!data || typeof data !== 'object' || data.stamp !== QL_STAMP) return null;
  const tier = Number.isSafeInteger(data.tier) ? Math.min(4, Math.max(1, data.tier)) : 1;
  return {
    stamp: QL_STAMP, tier, opened: idList(data.opened), done: idList(data.done), failed: idList(data.failed), choices: strMap(data.choices),
    outcome: typeof data.outcome === 'string' && data.outcome ? data.outcome : null,
    paid: data.paid === true, moved: data.moved === true, acts: countMap(data.acts), received: data.received === true,
    reread: idList(data.reread),   // HEART-TAKEN (AUDIT FB1025i B4): an older save's is empty - its mends are taken at its first read
  };
}

/** The state written into a save: a deep copy, so a later change to the live quest never reaches a snapshot. */
export const writeState = (state) => (state ? structuredClone(state) : null);

/** QL1 (decision 7): A SHARED COPY'S STATE (QUEST1, quest/questShare.js). What the party did is the party's - the
 *  objectives done, the branches chosen, the outcome reached - and what the holder is paid is the holder's: a copy
 *  arrives with its reward unpaid, its standing unmoved and no acts heard (an act is this world's, as a kill's count is).
 *  AUDIT QUESTLINES REWARD-1: and its TIER is the holder's - the envelope's was the sender's (a level-21 member's town
 *  errand paid a level-1 member a tier-4 choice) and a hand-built envelope's any it liked: the copy arrives at the floor,
 *  and the machine sets the holder's own at the receipt, as the layer's stamp reads it (machine.js receiveSharedQuest).
 *  AUDIT QUESTLINES BRANCH-1: and it is marked `received` - while it is kept in step with a party, its `ask` is the
 *  sharer's to answer (qlActions.js QlAsk; record 10.2). `data` is the envelope's `ql`; answers the received copy's, or
 *  null for DFU's quest. */
export function receivedState(data) {
  const st = readState(data);
  return st ? { ...st, tier: 1, paid: false, moved: false, acts: {}, received: true } : null;
}

/** QL1 (decision 7): A RESYNC'S STATE (machine.js updateSharedQuest). Monotonic, as action completion is: an objective
 *  either copy saw done is done, a choice either copy made stands (this copy's first - the sharer's arrived with the
 *  receive), an outcome either copy reached stands; and what is the holder's own (paid, moved, the acts heard, the tier,
 *  whether it was received) is never the partner's. A copy that was DFU's stays DFU's. */
export function mergeSharedState(local, incoming) {
  if (!local) return null;
  const inc = readState(incoming);
  if (!inc) return local;
  const done = [...new Set([...local.done, ...inc.done])];
  return {
    ...local,
    opened: [...new Set([...local.opened, ...inc.opened])],
    done,
    failed: [...new Set([...local.failed, ...inc.failed])].filter((id) => !done.includes(id)),
    choices: { ...inc.choices, ...local.choices },
    outcome: local.outcome ?? inc.outcome,
  };
}
