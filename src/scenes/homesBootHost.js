// @ts-check
// ═══════════════════════════════════════════════════════════════════
// ONLINE HOMES AT THE BOOT - the account's homes put right once a boot,
// once the homes' towns land and the world stands with the character
// loaded (a realm act's checkpoint can write, and a hold names its
// building in its town's layout). HOST-SPLIT (bible/01-Overview/
// Host-Split.md, THE HOSTS DO NOT GROW): the streaming host
// (scenes/world.js bootWorld) builds it above the boot's first landing
// and calls both beside ARENA4b's move (moveArenaHomesOnline, still the
// host's); these were its own functions (holdRealmDeedsOnline) or its
// slice's (ACCOUNT-HOMES). The other three hosts boot no online page:
// scenes/worldModes.js, scenes/exterior.js and scenes/dungeonContext.js
// hold no deed and sweep no home.
//
//   holdDeeds - FIELD BUGS 2026-10-04d KNIGHT-HOUSE (the Discord: "Houses
//     earned through Knightly Orders still possibly purchaseable? ... I
//     don't want to risk my Knight House being bought out from under me"):
//     every deed the realm gave this character (a Knightly Order's house -
//     systems/online/onlineHomes.js realmDeedsOf) is held by the account
//     service, so no other player may claim its building. The service
//     reads the deed off the record the boot loaded. A house given before
//     the hold existed, and one whose hold at the grant was lost, are held
//     here; a hold made already answers `repeat`.
//   sweepGone - ACCOUNT-HOMES (2026-10-06, asked: "House ownership should
//     be account bound, not character bound"; bible/06-Systems/
//     Online-Arc.md ACCOUNT-HOMES): every home this character kept things
//     in that its account holds no more - sold by another of its
//     characters, or gone with the character that bought it - gives this
//     character's own things that stood in it back to the pack
//     (systems/online/onlineHomes.js homesGoneFrom, DECOR2a's "Back to
//     pack" as the seller's own come back at a sale) and is let go, off
//     the account's homes as the service lists them; a list that does not
//     come sweeps nothing and is asked at the next landing. The save that
//     holds the change is the next checkpoint's - until it lands the
//     record still holds the scene, and the next boot sweeps it again.
// ═══════════════════════════════════════════════════════════════════
import { holdRealmDeeds, homesGoneFrom, homesGoneLine } from '../systems/online/onlineHomes.js';
import { createSceneCache } from '../systems/sceneCache.js';

/** How long a step waits for the world to stand: a look every quarter second, five minutes of them. */
const STAND_LOOKS = 1200;
const STAND_LOOK_MS = 250;

/**
 * THE BOOT'S ONLINE HOMES - `{ holdDeeds, sweepGone }`, each once a boot (asked again at the next landing where the world
 * did not stand with the boot's own character). Each answers what it did, or null.
 * @param {{ homesApi: any, onlineHomes: any, realm: any, player: () => any, loaded: () => boolean, stands: () => boolean,
 *   giveOwn: (items: any[]) => void, say: (line: string) => void, wait?: (ms: number) => Promise<void> }} deps
 *   `loaded` the boot's own character is the one played (never its stand-in - characterIdOf mints one); `stands` the
 *   world's modes stand (the host declares them far below its boot's first landing)
 */
export function createHomesBoot({ homesApi, onlineHomes, realm, player, loaded, stands, giveOwn, say, wait = (ms) => new Promise((r) => { setTimeout(r, ms); }) }) {
  let deedsAsked = false, goneAsked = false;
  /** Once the world stands with the character loaded - false where it never did (the step asked again). */
  async function standing() {
    for (let i = 0; !(loaded() && stands()) && i < STAND_LOOKS; i++) await wait(STAND_LOOK_MS);
    return loaded();
  }
  async function holdDeeds() {
    if (deedsAsked || !onlineHomes) return null;
    deedsAsked = true;
    if (!await standing()) { deedsAsked = false; return null; }   // never the boot's stand-in character - asked again at the next landing
    try {
      const held = await holdRealmDeeds(onlineHomes, { houses: player().houses });
      for (const d of held) if (!d.r?.ok) console.warn(`[homes] the deed to house ${d.buildingKey} is not held: ${d.r?.error}`);
      return held;
    } catch (e) {
      console.warn('[homes] the deeds could not be held:', e?.message ?? e);
      return null;
    }
  }
  async function sweepGone() {
    if (goneAsked || !homesApi || !realm) return null;
    goneAsked = true;
    if (!await standing()) { goneAsked = false; return null; }   // never the boot's stand-in character - asked again at the next landing
    try {
      const r = await homesApi.mine();
      if (!r?.ok || !Array.isArray(r.data?.homes)) { goneAsked = false; return null; }   // unanswered: nothing swept on a list not read
      const p = player();
      const swept = homesGoneFrom(p.sceneCache ??= createSceneCache(), r.data.homes, { ownNow: (m, k) => !!onlineHomes?.homeAt(m, k)?.own });   // never one bought while the list was read
      if (swept.own.length) { giveOwn(swept.own); say(homesGoneLine(swept.own)); }   // the furniture among Your things, the rest to the pack
      for (const name of swept.gone) console.log(`[homes] ${name}: no longer the account's - let go`);
      return swept;
    } catch (e) {
      console.warn('[homes] the homes the account holds no more could not be swept:', e?.message ?? e);
      return null;
    }
  }
  return { holdDeeds, sweepGone };
}
