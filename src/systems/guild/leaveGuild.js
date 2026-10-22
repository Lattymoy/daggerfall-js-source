// LEAVE-GUILD (2026-10-22): A MEMBER LEAVES A GUILD BY CHOICE.
//
// Daggerfall has no door out of a guild. DFU's one way out is GuildManager.RemoveMembership (GuildManager.cs:128-144),
// which it calls at an expulsion alone (Guild.UpdateRank) - and a character keeps one membership a guild group
// (guilds.js membershipKey: one temple, one knightly order), so a player who chose Mara's temple or the Knights of the
// Dragon could never take another. Players asked for a way out on the Discord (suggestions, "Leave Guild/Faction
// Option", from 2026-09-30): one ran their standing to -92 and the order still kept them. Standalone DFU answers with a
// mod, Leave Guild (Nexus, Daggerfall Unity mod 588): a button on the guild NPC's popup, with no penalty by default.
//
// The port takes the mod's shape (bible/06-Systems/Leave-Guild.md):
//   - a member of THIS guild (membershipOf: a priest of Arkay never offers to let a Mara priest go) sees a row on the
//     service popup, on either skin; a Yes/No box asks, and the Yes is leaveGuild - the membership dropped exactly as
//     an expulsion drops it, without an expulsion's consequences (no record 668, no squad sent after the player);
//   - the reputation stays, as the mod's default: the guild may be joined again at its door, at rank 0 (DFU's own Join;
//     the mod's remembered rank is not carried);
//   - the two underworld guilds are not left this way: they take nobody at the door (INVITATION_ONLY), and the mod's
//     author never tested them;
//   - online, a character holding one of the guild's chapter chairs (ranks 8 and 9, won at the Turning) does not leave
//     while it holds one. The chairs are the Roll's word, and a Roll not yet heard is not yet a no.
import { GUILD_GROUPS } from '../../formats/factionFile.js';
import { isJoinableByApplication, leaveGuild, membershipOf } from './guilds.js';
import { t } from '../textManager.js';   // the popup's words in the player's language, read when the box is made

/** The popup row's key on the classic skin - free among the guild popup's letters (DialogShortcuts' J T E and the
 *  services', and the port's own rows' H, F and L). */
export const LEAVE_KEY = 'KeyQ';

/** The row's words: a temple and a knightly order are not called guilds in their own halls. */
export function leaveRowLabel(guild) {
  if (guild?.guildGroup === GUILD_GROUPS.HolyOrder) return t('guild.leave.rowTemple', 'Leave Temple');
  if (guild?.guildGroup === GUILD_GROUPS.KnightlyOrder) return t('guild.leave.rowOrder', 'Leave Order');
  return t('guild.leave.rowGuild', 'Leave Guild');
}

/** The row stands: the player is a member of THIS guild, and it is one that takes members at its door. */
export const leaveOffered = (memberships, guild) => !!guild && isJoinableByApplication(guild) && !!membershipOf(memberships, guild);

/**
 * What a press of the row answers: 'ok', or why not - 'notMember' (no membership of this guild, or one the door cannot
 * give back), 'seated' (online, a chair of this guild held), 'unheard' (online, the Roll's word on the chairs not yet in).
 * `pace` is the host's rollPace for the guild (npcRollTracker.js rollPaceOf): null offline, where no chair is held.
 */
export function leaveDecision(memberships, guild, pace = null) {
  if (!leaveOffered(memberships, guild)) return 'notMember';
  if (pace && pace.seated === true) return 'seated';
  if (pace && pace.seated !== false) return 'unheard';
  return 'ok';
}

/** `the Mages Guild` mid-sentence (the faction file's name, a translation's where it has one); a guild the faction file
 *  does not name is `this guild`. */
const named = (name) => (typeof name === 'string' && name.trim() ? name.trim().replace(/^The /, 'the ') : t('guild.leave.thisGuild', 'this guild'));

/** The box's words, plain rows the popup stands as a box (healCurse.js's shape), read when the box is made. */
export const leaveGuildText = Object.freeze({
  ask: (name) => [
    t('guild.leave.ask', 'Do you wish to leave {guild}?', { guild: named(name) }),
    t('guild.leave.askRank', 'Your rank and everything it gives you here end today.'),
    t('guild.leave.askStanding', 'Your standing with them is not changed, so you may ask to join again.'),
  ],
  left: (name) => t('guild.leave.left', 'You are no longer a member of {guild}.', { guild: named(name) }),
  seated: (name) => t('guild.leave.seated', 'You hold a chair of {guild}. You cannot leave while you hold it.', { guild: named(name) }),
  unheard: () => t('guild.leave.unheard', 'The guild\'s roll has not answered yet. Try again in a moment.'),
  notMember: (name) => t('guild.leave.notMember', 'You are not a member of {guild}.', { guild: named(name) }),
});

const box = (lines, extra = {}) => ({ rows: (Array.isArray(lines) ? lines : [lines]).map((text) => ({ text, center: true })), ...extra });

/**
 * The popup's two hooks for a hall of `guild` (scenes/worldModes.js openGuildService): `leaveRow()` the row's words
 * while it stands, else null; `leave()` the box a press stands on the popup - the question, and on its Yes the
 * membership dropped and the farewell, which closes the popup. `memberships` the active book (the vampire-aware one),
 * `name` the guild's faction name, `pace()` the host's rollPace for the guild. Positional, so the host's one line of
 * wiring stays one (THE HOSTS DO NOT GROW).
 */
export function leaveGuildHooks(memberships, guild, name = null, pace = () => null) {
  return {
    leaveRow: () => (leaveOffered(memberships, guild) ? leaveRowLabel(guild) : null),
    leave: () => {
      const why = leaveDecision(memberships, guild, pace());
      if (why === 'notMember') return box(leaveGuildText.notMember(name));
      if (why === 'seated') return box(leaveGuildText.seated(name));
      if (why === 'unheard') return box(leaveGuildText.unheard());
      return box(leaveGuildText.ask(name), {
        buttons: 'YesNo',
        onYes: () => {
          // asked again at the Yes: a chair the Turning gave while the box stood is still a chair
          const now = leaveDecision(memberships, guild, pace());
          if (now !== 'ok') return box(now === 'seated' ? leaveGuildText.seated(name) : now === 'unheard' ? leaveGuildText.unheard() : leaveGuildText.notMember(name));
          leaveGuild(memberships, guild);
          return box(leaveGuildText.left(name), { closesWindow: true });
        },
      });
    },
  };
}
