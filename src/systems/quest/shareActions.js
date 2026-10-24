// A shared save carries progress, not a replacement for the receiver's quest script.
// Every field is immutable unless explicitly listed below. New actions therefore fail closed.
const finite = (v) => Number.isFinite(v);
const count = (v) => Number.isSafeInteger(v) && v >= 0;
const bool = (v) => typeof v === 'boolean';
const location = (v) => Number.isInteger(v) && v >= 0 && v <= 0xffff;
const progress = {
  PlaySound: { lastTimePlayed: finite },
  PcAt: { textShown: bool },
  DroppedItemAtPlace: { textShown: bool },
  CreateFoe: {
    lastSpawnTime: finite, spawnCounter: count,
    msgMessageID: (v, own) => v === own || v === -1,
  },
  WhenPcEntersExits: { currentLocationType: location, previousLocationType: location },
  RunQuest: { questStarted: bool, questUId: (v) => v === null || count(v) },
};
// AUDIT QUESTLINES BRANCH-2: PROGRESS THAT IS THE HOLDER'S OWN - checked as progress is, never taken from the partner: a
// fresh copy keeps its own parse's, a resync the copy it holds (takeLocalActions' `live`). `ql act`'s `from` is where this
// copy's count of acts began (systems/questlines/qlActions.js QlAct), and an act is this world's (qlState.js
// receivedState: a copy arrives having heard none) - so the partner's number read against this holder's acts a count
// that never came, or one already met. Not listed, it failed the law closed: a step with `ql act` (25 of the 35 line
// scripts) could not be shared once its trigger had been asked, and every resync of a party's copy was refused.
const holders = {
  QlAct: { from: (v) => v === null || count(v) },
  // QUEST-AUDIT III GUARD-HOLDER: GUARD-ONLINE's watch is the holder's arrival at the hall (onlineGuard.js), never the
  // partner's - a member who left at the close sent `guardAway` and started the watch over for the one still in the hall
  DailyFrom: { guardAnchor: (v) => v === null || finite(v), guardAway: bool },
  // QUEST-AUDIT III CAST-SHARE: a `cast X spell do` action's classic effects are its spell's, read from the holder's own
  // ARENA2 at the parse - the receiver's reference parse is headless and holds none, so every share and resync of
  // N0B00Y08, N0B00Y16 and N0B40Y07 was refused as a forgery. The holder's own stand (actions.js CastSpellDo reads them
  // lazily); a partner's are only checked to be effects
  CastSpellDo: { classicEffects: (v, own) => (own == null ? v === null || Array.isArray(v) : same(v, own)) },
};

// Save fields may be absent rather than undefined after JSON transport. Key order is irrelevant.
const canonical = (value) => JSON.stringify(value, (_key, v) => v && typeof v === 'object' && !Array.isArray(v)
  ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]])) : v);
const same = (a, b) => canonical(a) === canonical(b);

/** AUDIT QA3 C1: what a copy parsed by an earlier build of the port writes otherwise - accepted, never taken (the
 *  receiver's own parse stands: takeLocalActions). QUEST-AUDIT III CLIMATE-NAMES read `climate desert2` and `climate
 *  mountainwoods` (Foraging's mining quests) as their own climates, 225 and 230; a copy begun before it holds 224 and 226,
 *  and every share and sync of it was refused as forged. */
const LEGACY_CLIMATES = Object.freeze({ 225: 224, 230: 226 });
const legacy = Object.freeze({
  Climate: { climate: (v, own) => v === LEGACY_CLIMATES[own] },   // ClimateCondition's typeName
});

/** Validate definitions against the local parse, allowing only bounded runtime progress. */
export function sharedActionMatches(own, incoming) {
  if (!incoming || incoming.type !== own.type || !bool(incoming.isComplete)
    || incoming.isTriggerCondition !== own.isTriggerCondition
    || incoming.isAlwaysOnTriggerCondition !== own.isAlwaysOnTriggerCondition) return false;
  const expected = own.actionSpecific, got = incoming.actionSpecific;
  if (expected == null) return got == null;
  if (!got || typeof got !== 'object' || Array.isArray(got)) return false;
  if (Object.keys(got).some((k) => !Object.hasOwn(expected, k))) return false;
  for (const [key, value] of Object.entries(expected)) {
    const received = got[key];
    if (same(value, received)) continue;
    // These two actions normalize a script argument once executed; accept only that exact result.
    if (own.type === 'StartQuest' && key === 'questName' && value === '' && expected.questIndex1 > 0
      && received === `S${String(expected.questIndex1).padStart(7, '0')}`) continue;
    if (own.type === 'WorldUpdate' && key === 'variant' && value === '-' && received === '') continue;
    const validate = progress[own.type]?.[key] ?? holders[own.type]?.[key] ?? legacy[own.type]?.[key];
    if (!validate || !validate(received, value)) return false;
  }
  return true;
}

/** Copy the checked progress over locally authored action definitions and diagnostic source. AUDIT QUESTLINES
 *  BRANCH-2: the holder's own progress (`holders`) is `live`'s - the copy a resync lands on, its action in the same
 *  place - or, for a fresh copy (no `live`), the local parse's. */
export function takeLocalActions(local, data, live = null) {
  const ref = local.getSaveData();
  const mine = live?.getSaveData?.() ?? null;
  return { ...data, tasks: data.tasks.map((task, i) => ({ ...task, actions: task.actions.map((action, j) => {
    const own = ref.tasks[i].actions[j];
    const specific = own.actionSpecific == null ? null : { ...own.actionSpecific };
    if (specific) for (const key of Object.keys(progress[own.type] ?? {})) {
      if (Object.hasOwn(action.actionSpecific, key)) specific[key] = action.actionSpecific[key];
    }
    const kept = mine?.tasks?.[i]?.actions?.[j];
    if (specific && kept?.type === own.type && kept.actionSpecific) for (const key of Object.keys(holders[own.type] ?? {})) {
      if (Object.hasOwn(kept.actionSpecific, key)) specific[key] = kept.actionSpecific[key];
    }
    return { ...own, isComplete: action.isComplete, actionSpecific: specific };
  }) })) };
}
