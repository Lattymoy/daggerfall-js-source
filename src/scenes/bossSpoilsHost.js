// HOST-SPLIT: moved verbatim out of src/scenes/world.js's bootWorld (bible/01-Overview/Host-Split.md) by tools/hostMove.mjs.
// The host constructs it where the code stood. What it reads of the host's scope comes through `host`: the
// settled names by value at construction, every live one (a `let` someone writes, a `const` made below) read at its
// use as `host.<name>` - as the code read them where it was.
import { characterIdOf } from '../systems/characterId.js';
import { playerEntity } from '../characters/playerEntity.js';
import { RAID_SPOILS_TEXT, raidSpoilsDay, raidSpoilsList } from '../systems/raidSpoils.js';
import { readRaidReceipt } from '../net/raid/raidReceipt.js';
import { readReceipt } from '../net/gate/gateReceipt.js';
import { readSdReceipt } from '../net/superDungeon/sdReceipt.js';
import { readSerpentReceipt } from '../net/serpent/serpentReceipt.js';
import { SD_SPOILS_TEXT, sdSpoilsDay, sdSpoilsList } from '../systems/superDungeon/sdSpoils.js';
import { SERPENT_SPOILS_TEXT, serpentSpoilsDay, serpentSpoilsList } from '../systems/serpent/serpentSpoils.js';
import { serpentBossById } from '../net/serpent/serpentLaw.js';
import { SPOILS_TEXT, spoilsLevel, spoilsLock, spoilsList } from './spoilsPool.js';
import { weekBase, weekTop, bossTopDay } from '../net/bossWeek.js';   // PWR5: the week's finest
import { GATE_BOSSES } from '../net/gate/gateLaw.js';
import { t } from '../systems/textManager.js';

/** PWR5 (bible/05-Combat/Power-Arc.md section 8): THE WEEK'S FINEST'S WORDS - given (into the pack, or kept for the
 *  character that fought), and the week already taken: said for a kill the service counted now, never for one asked again. */
export const BOSS_WEEK_TEXT = Object.freeze({
  granted: (name) => t('bossWeek.granted', 'This week\'s finest from {name} is in your pack.', { name }),
  kept: (name, who) => t('bossWeek.kept', 'This week\'s finest from {name} waits for {who}.', { name, who: who || t('bossWeek.keptWho', 'the one who fought') }),
  taken: (name) => t('bossWeek.taken', '{name}\'s Legendary, set and Gilded pieces come once an arena week, and this week\'s are taken. Its gold, Marks and Embers still come.', { name }),
});

/** @param {any} host */
export function createBossSpoils(host) {
  const {
    raidSpoils, sdSpoilsPool, serpentSpoils, spoilsPool,
  } = host;
  /** AUDIT WB A2: THE SPOILS WITH NO FLOOR - a receipt that comes while this player is not in its court (cast out before
   *  the kill, gone, handed it by the hub's next hello) is its spoils straight into the pack; in its court the burst
   *  gives them. Once a receipt either way - the pool keeps which are spent. */
  function grantSpoilsOutside(r) {
    const c = readReceipt(r);
    if (!c || !spoilsPool || host.modes?.gateArenaDay?.() === c.d) return;
    spoilsLock(() => spoilsPool.grant({ day: c.d, seed: c.c, level: spoilsLevel(playerEntity.level ?? 1, c.l), acct: c.s, claims: c, text: c.x === 'rite' ? SPOILS_TEXT.rite : SPOILS_TEXT.granted }))   // AUDIT WBX S2: never past the level the fight admitted; WB12d: the rite's ember
      .catch((e) => console.warn('[gate] spoils', e?.message ?? e));
  }
  /** RAID4b: A TOWN'S THANKS, off a receipt the relay signed at the cleanse - AUDIT RAID R4: given when the account
   *  service says this claim is the (raid, account)'s (net/raid/raidClaims.js onSpoils: a second browser, a phone or a hub's
   *  hello handing the receipt again is answered no), rolled at the level the character fought at, straight into the
   *  pack when that character stands here - else kept on the device for it, as a crash's record is - once a receipt and
   *  account, one tab at a time. */
  function grantRaidSpoils(entry) {
    const c = readRaidReceipt(entry?.r);
    if (!c) return;
    const level = Math.max(1, Math.floor(Number(entry.lv) || playerEntity.level || 1));
    spoilsLock(() => raidSpoils.grant({ day: raidSpoilsDay(c.w), acct: c.s, roll: () => raidSpoilsList(c.c, level, c.y), text: RAID_SPOILS_TEXT.granted,
      owner: entry.ch, kept: RAID_SPOILS_TEXT.kept(entry.nm) }))
      .catch((e) => console.warn('[raid] spoils', e?.message ?? e));
  }
  /** SERPENT1: THE OLD COIL'S HOARD, off a receipt the relay signed at the kill - given when the account service says
   *  this claim is the (serpent, account)'s (net/serpent/serpentClaims.js onSpoils), rolled at the level the character fought at
   *  and by how it earned it, straight into the pack when that character stands here - else kept for it. */
  /** SD9e: MY HOUR RECEIPT'S SPOILS - one from my own realm, while I stand in it, is kept for the burst on the arena's
   *  floor (scenes/superDungeon/sdSpoils.js - SD_SPEW_AT_MS into the fall); any other (the hub's at a hello, a realm I have left) is
   *  its spoils straight into the pack, rolled at the level the fight admitted and mine, once a receipt and account, one
   *  tab at a time. */
  const _sdReceipts = new Map();
  function sdSpoilsReceipt(r, room) {
    const c = readSdReceipt(r);
    if (!c) return;
    // AUDIT SD II (L1 F4, L5 C2): a receipt for the Hour I stand in waits for its throw WHICHEVER link handed it - the
    // hub's (my realm's socket blinking at the kill) went straight into the pack, and the floor then said "No spoils"
    if (host.modes?.sdRealmSlot?.() === c.d) { _sdReceipts.set(c.d, r); return; }
    grantSdSpoils(c);
  }
  /** Its spoils straight into the pack - once a receipt and account (the pool refuses one already thrown or given). */
  function grantSdSpoils(c) {
    const level = spoilsLevel(playerEntity.level ?? 1, c.l);
    spoilsLock(() => sdSpoilsPool.grant({ day: sdSpoilsDay(c.d), acct: c.s, roll: () => weekBase(sdSpoilsList(c.c, level)), text: SD_SPOILS_TEXT.granted }))   // PWR5: never the week's finest
      .catch((e) => console.warn('[sd] spoils', e?.message ?? e));
  }
  /** AUDIT SD: OUT OF THE REALM, a receipt kept for a burst that never came (left before it - the way back, a death, the
   *  Hour's end) is its spoils straight into the pack, not a week's wait for the hub's next hello. */
  function sdReceiptsLeft() {
    for (const r of _sdReceipts.values()) { const c = readSdReceipt(r); if (c) grantSdSpoils(c); }
    _sdReceipts.clear();
  }
  function grantSerpentSpoils(entry, data = null) {
    const c = readSerpentReceipt(entry?.r);
    if (!c) return undefined;
    // AUDIT SERPENT D2: never past the level the fight admitted (the receipt's), nor the standing character's own
    const level = spoilsLevel(entry.ch === characterIdOf(playerEntity) ? playerEntity.level ?? 1 : Number(entry.lv) || c.l || 1, c.l);
    // AUDIT SERPENT D6: its promise is the carrier's - a grant that fails leaves the receipt unsettled, asked again
    const boss = serpentBossById(c.b);
    // PWR5: the hoard without the week's finest, then the week's own roll where the service says the week is this kill's
    return spoilsLock(() => serpentSpoils.grant({ day: serpentSpoilsDay(c.d), acct: c.s, roll: () => weekBase(serpentSpoilsList(c.c, level, c.x)), text: SERPENT_SPOILS_TEXT.granted(boss),
      owner: entry.ch, kept: SERPENT_SPOILS_TEXT.kept(entry.nm, boss) }))
      .then(() => grantWeek(serpentSpoils, { day: serpentSpoilsDay(c.d), acct: c.s, data, name: boss?.name ?? '', roll: (seed) => serpentSpoilsList(seed, level, c.x), owner: entry.ch, who: entry.nm }))
      .then((line) => { if (line) host.chatNotice(line); });   // PWR5: the week taken, in the chat with the claim's lines
  }
  /** PWR5 (bible/05-Combat/Power-Arc.md section 8; net/bossWeek.js): THE WEEK'S FINEST - where the service answered a kill's
   *  claim `top`, the receipt's spoils rolled again on the seed the claim's own draw made (`topSeed`), and its finest
   *  pieces alone given: into the pack, or (`owner` another character's) kept for it - once a kill, under the pool's own
   *  key for them (net/bossWeek.js bossTopDay). Answers the line to say: the week taken, for a kill counted now; else null
   *  (the pool says its own). */
  function grantWeek(pool, { day, acct, data, name, roll, owner = undefined, who = null }) {
    if (data?.top !== true) return Promise.resolve(data?.top === false && data.recorded === true ? BOSS_WEEK_TEXT.taken(name) : null);
    if (!Number.isSafeInteger(data.topSeed)) return Promise.resolve(null);
    const list = weekTop(roll(data.topSeed >>> 0));
    if (!list.length) return Promise.resolve(null);
    return spoilsLock(() => pool.grant({ day: bossTopDay(day), acct, roll: () => list, text: BOSS_WEEK_TEXT.granted(name), owner, kept: BOSS_WEEK_TEXT.kept(name, who) })).then(() => null);
  }
  /** PWR5: a Warden's kill's week, as the gate's claim answered it (net/gate/gateClaims.js onWeek) - never the rite's. */
  function gateWeek(r, data) {
    const c = readReceipt(r);
    if (!c || c.x === 'rite' || !spoilsPool) return null;
    const level = spoilsLevel(playerEntity.level ?? 1, c.l);
    const name = GATE_BOSSES.find((b) => b.id === c.b)?.name ?? '';
    return grantWeek(spoilsPool, { day: c.d, acct: c.s, data, name, roll: (seed) => spoilsList(seed, level, c) });
  }
  /** PWR5: a Brass Remnant's kill's week, as the Hour's claim answered it (net/superDungeon/sdClaims.js onWeek). */
  function sdWeek(r, data) {
    const c = readSdReceipt(r);
    if (!c || !sdSpoilsPool) return null;
    const level = spoilsLevel(playerEntity.level ?? 1, c.l);
    return grantWeek(sdSpoilsPool, { day: sdSpoilsDay(c.d), acct: c.s, data, name: t('bossWeek.remnant', 'the Brass Remnant'), roll: (seed) => sdSpoilsList(seed, level) });
  }
  return { _sdReceipts, grantRaidSpoils, grantSerpentSpoils, grantSpoilsOutside, sdReceiptsLeft, sdSpoilsReceipt, gateWeek, sdWeek };
}
