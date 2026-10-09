// @ts-check
// TIME3 (2026-10-01, Mac: "people have to wait insanely long" / "This needs to be perfect"): A QUEST'S STAMPS AND THE
// CLOCKS THEY STAND ON. Design: bible/06-Systems/Online-Time-Arc.md section 6.3.
//
// Online a quest reads three clocks where DFU's reads one (the machine's deps, quest/machine.js):
//   - THE CHARACTER'S (nowSeconds - LIVED1's own clock): every countdown and every interval. A Clock's sample, a
//     PlaySound's and a CreateFoe's last, a guard's arrival, a tombstone. A rest, a loiter or a journey spends them,
//     as in DFU; the world's time does not.
//   - THE SKY (skySeconds): an hour, a date, a season - read for "now", never stamped (TIME1).
//   - THE EVENT CLOCK (worldSeconds - WORLD5's): the journal's dates, shown on the sky's calendar.
// Offline the three are DFU's one clock. Before TIME3 every stamp stood on the event clock online, so a quest envelope
// says which it was taken on: TIME3's carries `ownSecondsAt` - the holder's own clock when it was taken - and one
// without it was taken on the event clock (online) or the one clock (offline). Pure: JSON and numbers in, out.

/** TIME3: the stamps on the CHARACTER's clock, in classic seconds (quest/clock.js, the saveShape of quest/actions.js's
 *  PlaySound, CreateFoe and DailyFrom, quest/quest.js). Zero is each one's "never" and stays zero. */
export const QUEST_OWN_SECOND_KEYS = Object.freeze(['lastWorldTimeSample', 'lastTimePlayed', 'lastSpawnTime', 'guardAnchor', 'questTombstoneTime', 'shelvedAt']);   // QUEST-SHELF: the second a quest was set aside, on the same clock
/** TIME3: ...and on the EVENT clock: a quest's start - with each logged step's `time` (activeLogMessages, too common
 *  a name to walk the tree by), the journal's dates (%qdt). */
export const QUEST_WORLD_SECOND_KEYS = Object.freeze(['questStartTime']);

/** The raised seconds since a sample: the session's count of raised time now (worldTick raisedMinutes, in seconds)
 *  less the count at the sample - 0 when either is unknown or the count went back (a new session started its own). */
export const raisedSince = (now, sample) => (Number.isFinite(now) && Number.isFinite(sample) && now >= sample ? now - sample : 0);

const isOwnMarked = (node) => Number.isFinite(node?.ownSecondsAt);

/**
 * Move stamps in a quest tree (a quest envelope, the machine's block, a save's quest block) by `deltaSeconds`, in
 * place. `world` moves the event clock's stamps; `own` the character's - `true` for every envelope, `'legacy'` for
 * those taken before TIME3 alone (no `ownSecondsAt`: their stamps stood on the event clock with the journal's).
 * @param {any} node
 * @param {number} deltaSeconds
 * @param {{ own?: boolean | 'legacy', world?: boolean }} which
 */
export function shiftQuestStamps(node, deltaSeconds, { own = false, world = false } = {}) {
  if (!deltaSeconds || !Number.isFinite(deltaSeconds)) return node;
  const walk = (n, ownHere) => {
    if (Array.isArray(n)) { for (const v of n) walk(v, ownHere); return; }
    if (!n || typeof n !== 'object') return;
    const ownBelow = own === 'legacy' ? ownHere && !isOwnMarked(n) : ownHere;
    for (const [k, v] of Object.entries(n)) {
      if (QUEST_OWN_SECOND_KEYS.includes(k)) { if (ownBelow && Number.isFinite(v) && v !== 0) n[k] = v + deltaSeconds; }
      else if (QUEST_WORLD_SECOND_KEYS.includes(k)) { if (world && Number.isFinite(v) && v !== 0) n[k] = v + deltaSeconds; }
      else if (k === 'activeLogMessages' && Array.isArray(v)) {
        if (world) for (const m of v) if (m && Number.isFinite(m.time) && m.time !== 0) m.time += deltaSeconds;
      } else if (v && typeof v === 'object') walk(v, ownBelow);
    }
  };
  walk(node, !!own);
  return node;
}

/** Every quest envelope in a tree (an object carrying `questName` and `questStartTime`, as Quest.getSaveData writes
 *  one) that says no clock is marked as taken on the character's at `ownSeconds` - its own stamps stand there now. */
export function markOwnClock(node, ownSeconds) {
  if (!Number.isFinite(ownSeconds)) return node;
  const walk = (n) => {
    if (Array.isArray(n)) { for (const v of n) walk(v); return; }
    if (!n || typeof n !== 'object') return;
    if ('questName' in n && 'questStartTime' in n && !isOwnMarked(n)) n.ownSecondsAt = ownSeconds;
    for (const v of Object.values(n)) if (v && typeof v === 'object') walk(v);
  };
  walk(node);
  return node;
}

/**
 * TIME3: a save's quest block on the clock it is loaded on. An online envelope (`worldMinutes` beside the character's
 * `classicMinutes`) whose quests were taken before TIME3 kept their countdowns on the world's clock; they move onto
 * the character's by the distance between the two at the save, once - a quest's three days stay three days - and are
 * marked. A TIME3 envelope, and any offline one (one clock), is already there. A copy; the snap is untouched.
 * @param {{ quest?: any, classicMinutes?: number, worldMinutes?: number } | null} snap
 */
export function questBlockOnOwnClock(snap) {
  const block = snap?.quest ?? null;
  const own = snap?.classicMinutes, world = snap?.worldMinutes;
  if (!block || typeof block !== 'object' || !Number.isFinite(own) || !Number.isFinite(world)) return block;
  const copy = JSON.parse(JSON.stringify(block));
  shiftQuestStamps(copy, (Math.floor(Number(own)) - Math.floor(Number(world))) * 60, { own: 'legacy' });
  return markOwnClock(copy, Math.floor(Number(own)) * 60);
}

/**
 * TIME3: one quest envelope from another holder (a party member's share or resync, quest/machine.js) on this
 * machine's clocks. Its countdowns stood on the sender's own clock - `ownSecondsAt` when it was taken - or, from a
 * build before TIME3, on the event clock the party shares; they move onto this character's by the distance, so a
 * three-day wait is three days for whoever holds the copy, on their own time. The journal's dates are the event
 * clock's and the party's both, and stay. A copy, marked as taken on this clock now.
 * @param {any} data
 * @param {number} nowSeconds this machine's quest clock (the character's own)
 * @param {number} worldSeconds this machine's event clock
 */
export function questDataOnThisClock(data, nowSeconds, worldSeconds) {
  if (!data || typeof data !== 'object' || !Number.isFinite(nowSeconds)) return data;
  const now = Math.floor(nowSeconds);   // whole seconds, as every countdown samples (quest/clock.js)
  const copy = JSON.parse(JSON.stringify(data));
  const from = isOwnMarked(copy) ? copy.ownSecondsAt : Math.floor(worldSeconds);
  if (Number.isFinite(from)) shiftQuestStamps(copy, now - from, { own: true });
  copy.ownSecondsAt = now;
  return copy;
}
