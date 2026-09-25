// @ts-check
// ═══════════════════════════════════════════════════════════════════
// GUILD1b (2026-09-25) - THE GUILD, AS THIS CLIENT HOLDS IT.
//
// Mac, of the holdings: "future ownership for online guilds"; asked,
// founding takes "Gold and Renown", a guild is joined "Per character",
// its ranks are "Four, renamed by the guildmaster", and the treasury is
// the "Guildmaster only" to take from. GUILD1a built the service
// (server-account/src/guilds.js) and its door (net/accountClient.js
// accountGuilds); this is what the Social panel's Guild tab reads and
// presses - the character's guild as the service last answered, the
// account's invitations, and every act, each one the door's and then a
// fresh look.
//
// ═══ THE GOLD IS THE SAVE'S, AND THE ORDER IS THE LAW ══════════════
//
// The service keeps the guild; the gold stays in the save. So each act
// that moves gold does it on the side of the answer that cannot make gold
// out of nothing:
//
// - FOUNDING: the service founds first, then the purse pays (HOME1's
//   order, net/../systems/onlineHomes.js buyOnlineHome) - and a founder
//   who can no longer pay disbands the guild it just founded, its
//   treasury being empty.
// - A DEPOSIT: the purse pays first, then the treasury is asked to hold
//   it. Refused - the service's own WORD - the gold comes back. A lost
//   answer (`offline`, `server`) is NOT a refusal: the service may have
//   taken it, and giving it back too would make gold. The ledger says
//   which, and the tab says to read it.
// - A WITHDRAWAL: the treasury gives first, then the purse takes it.
//
// Every act ends in a fresh look, so what the tab draws is always the
// service's word, never this client's guess.
// ═══════════════════════════════════════════════════════════════════
import { GUILD_FOUND_GOLD, guildGoldOk } from './guildLaw.js';

/** A look older than this is taken again when the tab opens. */
export const GUILD_FRESH_MS = 30_000;

/** The answers that mean the request never landed as a change - the service's own refusal words, and a session there
 *  was none of. Anything else (`offline`, `server`, a word this build does not know) may have landed. */
const REFUSED = new Set([
  'no-session', 'guilds-need-account', 'guild-character', 'bad-gold', 'guild-rank', 'guild-rate', 'no-guild',
  'guild-treasury-full', 'auth',
]);
export const guildRefused = (error) => REFUSED.has(error);

/** What the tab says when a deposit's answer was lost. */
export const GUILD_DEPOSIT_UNSURE = 'The answer was lost. Read the ledger before you deposit again - the gold may already be in the treasury.';

export class GuildBook {
  /**
   * @param {object} opts
   * @param {any} opts.door  net/accountClient.js accountGuilds - every answer `call`'s shape
   * @param {() => (string|null)} opts.character  the character playing, or null
   * @param {() => ({ gold: () => number, pay: (n: number) => void, credit: (n: number) => void })} opts.wallet
   *        the purse, then this region's bank account
   * @param {() => number} [opts.now]  ms
   */
  constructor({ door, character, wallet, now = () => Date.now() }) {
    this.door = door;
    this.character = character;
    this.wallet = wallet;
    this.now = now;
    /** 'unknown' | 'signed-out' | 'guest' | 'ready' | 'error' */
    this.state = 'unknown';
    /** @type {string|null} */ this.error = null;
    /** @type {any} the guild as its member reads it (guilds.js viewOf), or null */ this.guild = null;
    /** @type {any[]} */ this.invites = [];
    this.version = 0;
    this.at = 0;
    this.busy = false;
    /** @type {Promise<any>|null} */ this._looking = null;
  }

  _changed() { this.version++; }

  /** A refusal the whole tab answers to: no session, or a guest. True when it was one of those. */
  _whole(error) {
    if (error === 'no-session' || error === 'auth') { this.state = 'signed-out'; this.guild = null; this.invites = []; this.error = error; this._changed(); return true; }
    if (error === 'guilds-need-account') { this.state = 'guest'; this.guild = null; this.invites = []; this.error = error; this._changed(); return true; }
    return false;
  }

  /** Is a look due (the tab opening)? */
  stale(nowMs = this.now()) { return !this._looking && (this.at === 0 || nowMs - this.at >= GUILD_FRESH_MS); }

  /** LOOK: the character's guild and the account's invitations. One look at a time. */
  refresh() {
    if (this._looking) return this._looking;
    this._looking = this._refresh().finally(() => { this._looking = null; });
    return this._looking;
  }

  async _refresh() {
    this.at = this.now();
    const character = this.character?.() ?? null;
    if (!character) { this.state = 'error'; this.error = 'guild-character'; this._changed(); return { ok: false, error: 'guild-character' }; }
    const [mine, inv] = await Promise.all([this.door.mine(character), this.door.invites()]);
    this.at = this.now();
    for (const r of [mine, inv]) if (!r?.ok && this._whole(r?.error)) return { ok: false, error: r.error };
    if (!mine?.ok || !inv?.ok) {
      this.state = 'error'; this.error = (!mine?.ok ? mine?.error : inv?.error) ?? 'server'; this._changed();
      return { ok: false, error: this.error };
    }
    const was = JSON.stringify([this.state, this.guild, this.invites]);
    this.guild = mine.data?.guild ?? null;
    this.invites = Array.isArray(inv.data?.invites) ? inv.data.invites : [];
    this.state = 'ready';
    this.error = null;
    if (JSON.stringify([this.state, this.guild, this.invites]) !== was) this._changed();
    return { ok: true };
  }

  /** One act through the door, then a fresh look. Answers `{ ok, error?, data? }`. */
  async _act(run) {
    const character = this.character?.() ?? null;
    if (!character) return { ok: false, error: 'guild-character' };
    this.busy = true; this._changed();
    try {
      const r = await run(character);
      if (!r?.ok) this._whole(r?.error);
      return r?.ok ? { ok: true, data: r.data } : { ok: false, error: r?.error ?? 'server' };
    } finally {
      this.busy = false;
      await this.refresh();
      this._changed();
    }
  }

  /** FOUND ONE: the service first, then the purse - or the guild goes again when the purse cannot pay. */
  async found(name, tag) {
    if (this.wallet().gold() < GUILD_FOUND_GOLD) return { ok: false, error: 'gold' };
    return this._act(async (character) => {
      const r = await this.door.found({ character, name, tag });
      if (!r?.ok) return r;
      const w = this.wallet();
      if (w.gold() < GUILD_FOUND_GOLD) {   // the purse moved while the answer was out
        await this.door.disband(character);
        return { ok: false, error: 'gold' };
      }
      w.pay(GUILD_FOUND_GOLD);
      return r;
    });
  }

  /** PUT GOLD IN: the purse first; a refusal gives it back, a lost answer does not. */
  async deposit(gold) {
    if (!guildGoldOk(gold)) return { ok: false, error: 'bad-gold' };
    const w = this.wallet();
    if (w.gold() < gold) return { ok: false, error: 'gold' };
    return this._act(async (character) => {
      w.pay(gold);
      const r = await this.door.deposit(character, gold);
      if (r?.ok) return r;
      if (guildRefused(r?.error)) { w.credit(gold); return r; }
      return { ok: false, error: 'guild-unsure' };
    });
  }

  /** TAKE GOLD OUT: the treasury first, then the purse. */
  async withdraw(gold) {
    if (!guildGoldOk(gold)) return { ok: false, error: 'bad-gold' };
    return this._act(async (character) => {
      const r = await this.door.withdraw(character, gold);
      if (r?.ok) this.wallet().credit(gold);
      return r;
    });
  }

  invite(handle) { return this._act((c) => this.door.invite(c, handle)); }
  answer(guild, accept) { return this._act((c) => this.door.answer({ character: c, guild, accept: accept === true })); }
  leave() { return this._act((c) => this.door.leave(c)); }
  remove(member) { return this._act((c) => this.door.remove(c, member)); }
  rank(member, rank) { return this._act((c) => this.door.rank(c, member, rank)); }
  renameRanks(names) { return this._act((c) => this.door.ranks(c, names)); }
  handOver(member) { return this._act((c) => this.door.handOver(c, member)); }
  disband() { return this._act((c) => this.door.disband(c)); }
}
