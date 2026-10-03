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
// REALM P2.2: A REALM CHARACTER'S GOLD IS ITS RECORD'S. For a realm
// character (`realm`, the host's systems/realmSaves.js realmGoldAct) the
// service pays or credits the record in the act's own batch, so there is
// no order to choose: the purse is checkpointed, the purse pays at once
// (a founding, a deposit), the service moves both or neither, a refusal
// gives the gold back and a withdrawal's gold comes in on the answer. A
// lost answer is asked again; still lost, the session ends and a join
// reads the truth - the tab never guesses.
//
// Every act ends in a fresh look, so what the tab draws is always the
// service's word, never this client's guess.
//
// ═══ GUILD1c: AND THE ROOMS ARE TOLD ═══════════════════════════════
//
// The guild rides the identity token (the tag beside the name, the
// guild's chat in the hub), and a token is read once, at a hello. So
// the service signs what a membership is NOW on every look, and what a
// removal or a disbanding took on the act that did it; this hands them
// to the host (`onOrders`), which carries them to the rooms. A look's
// order goes only when the membership it reads differs from the last
// one handed on - the first look always, since this page cannot know
// what its rooms were told before it - so a tab left open does not
// send a frame down every socket each time it looks again.
// ═══════════════════════════════════════════════════════════════════
import { GUILD_FOUND_GOLD, guildGoldOk } from './guildLaw.js';
import { guildHallEntryOk } from './hallLaw.js';   // GUILD1d: who may walk into a hall
import { heraldryOf } from './heraldryLaw.js';   // GUILD1d: a heraldry chosen, in the law's shape
import { mintMarksRid } from './marksBook.js';   // GUILD1d: a heraldry changed burns Drakes - one request id a choice

/** A look older than this is taken again when the tab opens. */
export const GUILD_FRESH_MS = 30_000;

/** The answers that mean the request never landed as a change - the service's own refusal words, and a session there
 *  was none of. Anything else (`offline`, `server`, a word this build does not know) may have landed.
 *  AUDIT MERGE-PLUS A4: and the Worker's own words, said before any route runs - the account's rate (240 a minute,
 *  asked ahead of every route), a body it could not read or would not take, a path or a method it has not, no
 *  database. A deposit refused by the rate was read as "may have landed": the purse paid, the treasury never had it,
 *  and the tab told the player the gold might be there. */
const REFUSED = new Set([
  'no-session', 'guilds-need-account', 'guild-character', 'bad-gold', 'guild-rank', 'guild-rate', 'no-guild',
  'guild-treasury-full', 'auth',
  'rate', 'body', 'too-large', 'method', 'not-found', 'no-database', 'no-player',
]);
export const guildRefused = (error) => REFUSED.has(error);

/** What the tab says when a deposit's answer was lost. */
export const GUILD_DEPOSIT_UNSURE = 'The answer was lost. Read the ledger before you deposit again - the gold may already be in the treasury.';

/** GUILD1c: a membership as a key - the guild, its tag and the character's row in it; '' for none. */
export function guildBadgeKey(guild) {
  if (!guild || typeof guild !== 'object') return '';
  const you = Array.isArray(guild.members) ? guild.members.find((m) => m?.you)?.member ?? '' : '';
  return `${guild.id ?? ''}|${guild.tag ?? ''}|${you}`;
}

export class GuildBook {
  /**
   * @param {object} opts
   * @param {any} opts.door  net/accountClient.js accountGuilds - every answer `call`'s shape
   * @param {() => (string|null)} opts.character  the character playing, or null
   * @param {() => ({ gold: () => number, pay: (n: number) => void, credit: (n: number, o?: { letter?: boolean }) => void, paper?: (n: number) => boolean, region?: () => number })} opts.wallet
   *        the purse, then this region's bank account (`region`: which - REALM P2.2's record pays from the same one);
   *        GUILD-LETTER: `paper(n)` - n gold is past what the pack can carry - and `credit`'s `letter`, paid as a letter
   * @param {() => number} [opts.now]  ms
   * @param {((orders: { order?: string, outOrder?: string }) => void)|null} [opts.onOrders]  GUILD1c: the host carries them
   * @param {any} [opts.marks]  MARKS1: the account's Marks book (net/marksBook.js), or null
   * @param {any} [opts.profStores]  PROF6: the guild Stores' host - `{ writs, open, mine, name }`: the writs' book
   *        (net/writBook.js), whether the professions are this account's, the character's own Stores (a Map), a
   *        material's name for a count - or null
   * @param {{ act: (o: any) => Promise<any> } | null} [opts.realm]  REALM P2.2: a realm character's act on its record
   *        (systems/realmSaves.js realmGoldAct over the playing session), or null for any other character
   * @param {((mapId: number) => void)|null} [opts.onHall]  GUILD1d: a hall's town changed (bought, sold, opened, its
   *        heraldry) - the host reads that town's homes again, so its door and its banners say it now
   * @param {(() => void)|null} [opts.onRank]  AUDIT PROF-541 G1: a look found the character's guild, rank or hall moved
   *        (a keeper made or unmade) - the host reads the town again, so a hall's `keeper` follows
   */
  constructor({ door, character, wallet, now = () => Date.now(), onOrders = null, marks = null, profStores = null, realm = null, onHall = null, onRank = null }) {
    this.door = door;
    this.onHall = onHall;
    this.onRank = onRank;
    /** AUDIT PROF-541 G1: the `id|rank|hall` the last look found - '' (in no guild) before the first, so the first look
     *  that finds one tells it too (AUDIT GUILD1d A5: the plaque asked before the guild was known) */
    this._ranked = '';
    this.realm = realm;
    /** MARKS1: the account's Marks book (net/marksBook.js) - the Marks treasury moves through it; null offline */
    this.marks = marks;
    /** PROF6: the guild Stores and the Officers' writ budget (Professions-Arc 7, 28); null offline */
    this.profStores = profStores;
    this.character = character;
    this.wallet = wallet;
    this.now = now;
    this.onOrders = onOrders;
    /** GUILD1c: the membership the last order handed on said (`guildBadgeKey`), undefined before the first */
    this._carried = undefined;
    /** 'unknown' | 'signed-out' | 'guest' | 'ready' | 'error' */
    this.state = 'unknown';
    /** @type {string|null} */ this.error = null;
    /** @type {any} the guild as its member reads it (guilds.js viewOf), or null */ this.guild = null;
    /** @type {any[]} */ this.invites = [];
    this.version = 0;
    this.at = 0;
    this.busy = false;
    /** @type {Promise<any>|null} */ this._looking = null;
    /** @type {{key: string, rid: string}|null} GUILD1d: the heraldry change asked, and its one request id */ this._heraldryAsk = null;
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
    // MARKS1: the account's Marks looked at beside the guild - the tab's Marks treasury says what this account holds
    const [mine, inv] = await Promise.all([this.door.mine(character), this.door.invites(), this.marks?.refresh().catch(() => null)]);
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
    // GUILD1c: the membership as the service reads it now, to the rooms - when it moved since the last one handed on
    const key = guildBadgeKey(this.guild);
    if (key !== this._carried && typeof mine.data?.order === 'string') { this._carried = key; this._hand({ order: mine.data.order }); }
    // AUDIT PROF-541 G1 (GUILD-YARD C3 again): a rank moved is told here, at EVERY look - the Guild tab's, the seat Edicts',
    // a room's word that the guild went, an act's own - never only at the hall's plaque's (guildHall.info's), which a look
    // already taken by any of those left nothing to compare: a demoted Officer kept the yard's decorator a minute
    const ranked = this.guild ? `${this.guild.id}|${this.guild.rank}|${this.guild.hall ? 1 : 0}` : '';
    const moved = ranked !== this._ranked;
    this._ranked = ranked;
    if (moved) { try { this.onRank?.(); } catch (e) { console.warn('[guild] a rank moved, its town unread', e?.message ?? e); } }
    return { ok: true };
  }

  /** GUILD1c: orders to the host; a host that throws costs the rooms their news, never the tab its look. */
  _hand(orders) {
    try { this.onOrders?.(orders); } catch (e) { console.warn('[guild] carrying an order failed', e?.message ?? e); }
  }

  /** One act through the door, then a fresh look. Answers `{ ok, error?, data? }`. */
  async _act(run) {
    const character = this.character?.() ?? null;
    if (!character) return { ok: false, error: 'guild-character' };
    this.busy = true; this._changed();
    try {
      const r = await run(character);
      if (!r?.ok) this._whole(r?.error);
      // GUILD1c: a removal's or a disbanding's word goes to the hub now; the act's own membership rides the look below
      if (r?.ok && typeof r.data?.outOrder === 'string') this._hand({ outOrder: r.data.outOrder });
      return r?.ok ? { ok: true, data: r.data } : { ok: false, error: r?.error ?? 'server' };
    } finally {
      this.busy = false;
      // AUDIT MERGE-PLUS A5: a look already out read the guild BEFORE this act - `refresh` would have handed back that
      // look, and the tab (and the rooms, through its order) ended on the old membership: joined, and still "in no
      // guild", the rooms never told. It is waited out, and a look of the act's own taken after it.
      if (this._looking) await this._looking.catch(() => {});
      await this.refresh();
      this._changed();
    }
  }

  /** FOUND ONE: the service first, then the purse - or the guild goes again when the purse cannot pay. A realm character's
   *  record pays in the founding's own batch (REALM P2.2). */
  async found(name, tag) {
    if (this.wallet().gold() < GUILD_FOUND_GOLD) return { ok: false, error: 'gold' };
    if (this.realm) {
      return this._act((character) => {
        const w = this.wallet();
        return this.realm.act({
          reserve: () => { w.pay(GUILD_FOUND_GOLD); return () => w.credit(GUILD_FOUND_GOLD); },
          call: (/** @type {any} */ at) => this.door.found({ character, name, tag, realm: at, region: w.region?.() ?? null }),
        });
      });
    }
    return this._act(async (character) => {
      const r = await this.door.found({ character, name, tag });
      if (!r?.ok) return r;
      const w = this.wallet();
      if (w.gold() < GUILD_FOUND_GOLD) {   // the purse moved while the answer was out
        const gone = await this.door.disband(character);
        if (gone?.ok && typeof gone.data?.outOrder === 'string') this._hand({ outOrder: gone.data.outOrder });   // GUILD1c: a room that heard the founding hears it gone
        return { ok: false, error: 'gold' };
      }
      w.pay(GUILD_FOUND_GOLD);
      return r;
    });
  }

  /** PUT GOLD IN: the purse first; a refusal gives it back, a lost answer does not. A realm character's record pays in the
   *  treasury's own batch (REALM P2.2). */
  async deposit(gold) {
    if (!guildGoldOk(gold)) return { ok: false, error: 'bad-gold' };
    const w = this.wallet();
    if (w.gold() < gold) return { ok: false, error: 'gold' };
    if (this.realm) {
      return this._act((character) => this.realm.act({
        reserve: () => { w.pay(gold); return () => w.credit(gold); },
        call: (/** @type {any} */ at) => this.door.deposit(character, gold, at, w.region?.() ?? null),
      }));
    }
    return this._act(async (character) => {
      w.pay(gold);
      const r = await this.door.deposit(character, gold);
      if (r?.ok) return r;
      if (guildRefused(r?.error)) { w.credit(gold); return r; }
      return { ok: false, error: 'guild-unsure' };
    });
  }

  /** TAKE GOLD OUT: the treasury first, then the purse. A realm character's record takes it in the treasury's own batch,
   *  and the purse on the answer (REALM P2.2).
   *  GUILD-LETTER (FIELD BUGS 2026-09-30): GOLD THE PACK CANNOT CARRY COMES AS A LETTER OF CREDIT. It came as coin
   *  whatever it weighed - a move is up to a million, 2,500 kg - and the player could not walk. The wallet weighs it
   *  (`paper`, the trade window's sellProceeds) BEFORE the service is asked, so the record takes the same letter the
   *  pack does (`letter` on the answer: the tab says so). */
  async withdraw(gold) {
    if (!guildGoldOk(gold)) return { ok: false, error: 'bad-gold' };
    const letter = this.wallet().paper?.(gold) === true;
    const said = (/** @type {any} */ r) => (r.ok && letter ? { ...r, letter } : r);
    if (this.realm) {
      return said(await this._act((character) => this.realm.act({
        apply: () => this.wallet().credit(gold, { letter }),
        call: (/** @type {any} */ at) => this.door.withdraw(character, gold, at, letter),
      })));
    }
    return said(await this._act(async (character) => {
      const r = await this.door.withdraw(character, gold);
      if (r?.ok) this.wallet().credit(gold, { letter });
      return r;
    }));
  }

  /** MARKS1: THE MARKS TREASURY - in from the account's balance (any member) or out to it (the guildmaster's), through
   *  the Marks book; no purse moves, so nothing is paid back on a refusal. */
  moveMarks(marks, out = false) {
    if (!this.marks) return Promise.resolve({ ok: false, error: 'marks-closed' });
    return this._act(async (character) => {
      const r = await this.marks.moveGuild(character, marks, out);
      return r.ok ? { ok: true, data: r } : { ok: false, error: r.error };
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

  // ═══ GUILD1d (Seats-Arc 8) - THE HALL AND THE HERALDRY ═══════════════════════════════════════════════════════════
  // No purse moves: the treasury pays for the hall and takes its sale, the Drake treasury pays for a change of heraldry
  // - each on the service, in the act's own batch - so there is no order to keep here and nothing to give back.

  /** BUY A HALL - the building at its door (the guildmaster's), its `price` the home's own; the treasury pays half again.
   *  AUDIT PRE-MERGE 1003 WD1: `layout`, the layout its town stands in (systems/onlineHomes.js homeClaimLayout). */
  async buyHall({ mapId, buildingKey, region, price, layout = null }) {
    return this._hallTold(mapId, await this._act((c) => this.door.hallBuy({ character: c, mapId, buildingKey, region, price, layout })));
  }
  /** SELL THE HALL - the deed share and its pieces' half into the treasury. */
  async sellHall() {
    const mapId = this.guild?.hall?.mapId ?? null;
    return this._hallTold(mapId, await this._act((c) => this.door.hallSell(c)));
  }
  /** WHO MAY WALK INTO THE HALL - its members or anyone. */
  async setHallEntry(entry) {
    if (!guildHallEntryOk(entry)) return { ok: false, error: 'bad-entry' };
    return this._hallTold(this.guild?.hall?.mapId ?? null, await this._act((c) => this.door.hallEntry(c, entry)));
  }
  /** GUILD1d: a hall act that landed tells the host which town to read again; answers the act's answer. */
  _hallTold(mapId, r) {
    if (r?.ok && Number.isSafeInteger(mapId)) { try { this.onHall?.(mapId); } catch (e) { console.warn('[guild] telling the hall\'s town failed', e?.message ?? e); } }
    return r;
  }
  /** THE HERALDRY - the first free, a change after it paid from the Drake treasury. A change carries ONE request id while
   *  the same choice is asked (an answer lost and asked again is the line it made, never a second burn); a new choice, or
   *  an answer, lets it go. */
  setHeraldry(raw) {
    const h = heraldryOf(raw);
    if (!h) return Promise.resolve({ ok: false, error: 'bad-heraldry' });
    const key = JSON.stringify(h);
    if (this._heraldryAsk?.key !== key) this._heraldryAsk = { key, rid: mintMarksRid() };
    const { rid } = this._heraldryAsk;
    const mapId = this.guild?.hall?.mapId ?? null;
    return this._act(async (c) => {
      const r = await this.door.heraldry(c, h, rid);
      // AUDIT GUILD1d R14: only this ask's own id - an older answer landing after a newer choice leaves the newer's
      if ((r?.ok || guildRefused(r?.error) || HERALDRY_REFUSED.has(r?.error)) && this._heraldryAsk?.rid === rid) this._heraldryAsk = null;
      return r;
    }).then((r) => this._hallTold(mapId, r));   // the hall's door and banners wear it
  }
}

/** GUILD1d: the heraldry's own refusal words - nothing was burnt, so the next ask is a new request. */
const HERALDRY_REFUSED = new Set(['bad-heraldry', 'heraldry-same', 'heraldry-moved', 'heraldry-drakes', 'marks-closed', 'marks-rid']);
