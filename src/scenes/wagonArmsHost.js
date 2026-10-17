// @ts-check
// WAGON-ARMS PASS B (2026-10-16): THE POOL'S ARMS, WIRED WHERE THE GUILD BOOK IS READ. The pool draws a wagon's arms
// off a tag (systems/horse/horseCartWire.js `og`), and the tag's heraldry comes from behind the guild book's door - or,
// with no door, from the account service. The book refreshes under the wagon's pictures (which are built once), so the
// reader's own arms are a resolver, not a value, and the pool's fetcher is the book's door: a guild that changed
// mid-session paints when its heraldry is asked again. Seeding the owner's own tag paints without a round trip.
//
// HOST-SPLIT: this wiring lived in bootWorld beside the GuildBook's construction and the host had no room - three code
// lines over its ceiling. It reads nothing of the host but the book, so the host wires it here instead.
import { setWagonHeraldry } from '../world/wagonEmblem.js';   // WAGON-EMBLEM: the reader's guild arms on his open wagon's sides
import { setGuildArmsFetcher, seedGuildArms } from '../systems/guildArms.js';   // per-tag arms, cached by tag, rebuilt on its epoch
import { accountGuilds } from '../net/accountClient.js';
import { appStorage } from '../systems/appStorage.js';

/**
 * Wire the pool's arms to the guild book the host just built: the reader's own arms live, the pool's fetcher through
 * the book's door (the account service where there is none), and the owner's own tag seeded.
 * @param {any} guildBook
 */
export function wireWagonArms(guildBook) {
  setWagonHeraldry(() => guildBook?.guild?.heraldry ?? null);
  setGuildArmsFetcher((tags) => (guildBook?.door ?? null) ? guildBook.door.arms(tags) : accountGuilds({ fetch: (u, i) => globalThis.fetch(u, i), storage: appStorage() }).arms(tags));
  seedGuildArms(guildBook?.guild?.tag, guildBook?.guild?.heraldry);
}
