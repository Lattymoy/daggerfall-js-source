// @ts-check
// GUILD-LOGO (2026-10-30; bible/11-Multiplayer/Guild-Shop.md) - A GUILD'S OWN LOGO, REVIEWED ON DISCORD. The guildmaster
// sends a square picture; its review fee (GUILD_LOGO_FEE) leaves the silver treasury into an escrow in the same batch as
// the logo's row; the picture is kept in R2 under an id no one can guess. The minute's clock posts its card in the
// moderators' channel (safetyClock.js), with Approve and Turn down. Approved, the guild wears it in place of its device
// and the fee is burnt; turned down or withdrawn, the fee goes home. Each end of a review is one batch, guarded on the
// row moving from pending, so two moderators pressing at once decide it once. Discord is code: this file is the card.
import { accountKind, displayName, overRate } from './accounts.js';
import { marksOpenFor } from './marks.js';
import { guildActorOf, guildPowersOfRow } from './guilds.js';
import { sendCard, discordOn, md } from './discord.js';
import { mustChange } from './realm.js';
import { POST_SENDER } from '../../src/net/postLaw.js';
import { MARKS_RID_RE, MARKS_MAX, utcDay } from '../../src/net/marksLaw.js';
import { GUILD_OPS_MAX, GUILD_OPS_WINDOW_S, GUILD_RANK_MASTER, guildMay } from '../../src/net/guild/guildLaw.js';
import { guildPowerSql } from './guildPowerSql.js'; // GUILD-RANKS: the guild's powers, read in the statement
import { GUILD_LOGO_FEE } from '../../src/net/guild/guildShopLaw.js';
import {
  GUILD_LOGO_ID_RE,
  GUILD_LOGO_MAX_BYTES,
  GUILD_LOGO_GAP_S,
  guildLogoShapeOf,
  guildLogoUrl,
} from '../../src/net/guild/guildLogoLaw.js';
import { poiImageMetaOf } from '../../src/poi/poiImage.js';

const INSERT_LINE =
  'INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)';
/** Where a logo's picture is kept in the saves' bucket. */
export const logoObject = (/** @type {string} */ id) => `guild-logo/${id}`;
/** The cards the minute posts at most. */
const LOGO_POSTS_MAX = 5;
/** A press's custom id: the act and the logo. */
const LOGO_PRESS_RE = /^glogo:(ok|no|off):([0-9a-f]{32})$/; // AUDIT GUILD-SHOP D2: `off`, an approved logo taken down

/** A base64 body as bytes, or null. */
function bytesOf(/** @type {unknown} */ b64) {
  if (
    typeof b64 !== 'string' ||
    b64.length > Math.ceil(GUILD_LOGO_MAX_BYTES / 3) * 4 + 4 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(b64)
  )
    return null;
  try {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}
/** A fresh logo id: 32 hex. */
function mintLogoId(/** @type {(b: Uint8Array) => void} */ rand) {
  const b = new Uint8Array(16);
  rand(b);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/**
 * SEND ONE: `{ character, image, rid }` - `image` the picture in base64. The guildmaster's (GUILD_POWERS.logo), one review
 * at a time a guild. The picture is put first; the row and the fee's escrow are one batch written only where the
 * treasury holds the fee and nothing else is under review. Asked again, it answers the review it opened, `repeat`.
 * @param {{ db: any, nowS: number, rand: (b: Uint8Array) => void, env?: any, bucket?: any, self?: string }} ctx
 */
export async function submitGuildLogo(ctx, player, { character, image, rid } = {}) {
  const { db, nowS, rand, env, bucket } = ctx;
  if (accountKind(player) !== 'linked') return { error: 'guilds-need-account' };
  if (!marksOpenFor(player, env)) return { error: 'marks-closed' };
  if (typeof rid !== 'string' || !MARKS_RID_RE.test(rid)) return { error: 'bad-rid' };
  const a = await guildActorOf(db, player, character);
  if (a.error) return a;
  if (!guildMay(Number(a.me.rank), 'logo', a.powers)) return { error: 'guild-rank' };
  const g = a.me.guild_id;
  const had = await db
    .prepare('SELECT id FROM guild_logos WHERE by_player = ? AND rid = ?')
    .bind(player.id, rid)
    .first();
  if (had) return { ok: true, repeat: true, logo: had.id };
  const bytes = bytesOf(image);
  if (!bytes) return { error: 'logo-bytes' };
  const shape = guildLogoShapeOf(poiImageMetaOf(bytes), bytes.byteLength);
  if ('error' in shape) return shape;
  if (await db.prepare("SELECT 1 FROM guild_logos WHERE guild_id = ? AND state = 'pending'").bind(g).first())
    return { error: 'logo-pending' };
  // AUDIT GUILD-SHOP S3: one a GUILD_LOGO_GAP_S - a review withdrawn and sent again is a card each in the moderators' channel
  const last = Number(
    (await db.prepare('SELECT MAX(at) AS at FROM guild_logos WHERE guild_id = ?').bind(g).first())?.at ?? 0,
  );
  if (last && nowS < last + GUILD_LOGO_GAP_S) return { error: 'logo-soon', at: last + GUILD_LOGO_GAP_S };
  if (
    Number((await db.prepare('SELECT balance FROM guild_marks WHERE guild_id = ?').bind(g).first())?.balance ?? 0) <
    GUILD_LOGO_FEE
  )
    return { error: 'guild-marks-short' };
  if (!bucket) return { error: 'no-storage' };
  if (await overRate(ctx, `guild:${player.id}`, GUILD_OPS_MAX, GUILD_OPS_WINDOW_S)) return { error: 'guild-rate' };
  const id = mintLogoId(rand),
    obj = logoObject(id),
    src = guildLogoUrl(ctx.self ?? '', id) ?? '';
  await bucket.put(obj, bytes, { httpMetadata: { contentType: shape.type } });
  try {
    await db.batch([
      db
        .prepare(
          `INSERT INTO guild_logos (id, guild_id, state, obj, src, type, bytes, side, fee, by_player, by_name, rid, at, discord_state)
        SELECT ?1, ?2, 'pending', ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13
        WHERE COALESCE((SELECT balance FROM guild_marks WHERE guild_id = ?2), 0) >= ?8
          AND EXISTS (SELECT 1 FROM guild_members WHERE rowid = ?14 AND guild_id = ?2 AND player = ?9 AND ${guildPowerSql('logo', 'rank', '?2')})`,
        ) // GUILD-RANKS
        .bind(
          id,
          g,
          obj,
          src,
          shape.type,
          bytes.byteLength,
          shape.side,
          GUILD_LOGO_FEE,
          player.id,
          displayName(player),
          rid,
          nowS,
          discordOn(env) ? 'due' : 'off',
          Number(a.me.rid),
        ),
      db
        .prepare(
          `${INSERT_LINE} SELECT 'guild', guild_id, 'escrow', 'logo:' || id, 'logo-escrow', fee, ?2, at, by_player, by_name, rid || ':logo'
        FROM guild_logos WHERE id = ?1`,
        )
        .bind(id, utcDay(nowS)),
    ]);
  } catch {
    // AUDIT GUILD-SHOP S1/S11: a batch that landed and whose answer was lost is the review it opened, its picture kept
    if (await db.prepare('SELECT 1 FROM guild_logos WHERE id = ?').bind(id).first())
      return { ok: true, logo: id, fee: GUILD_LOGO_FEE };
    await bucket.delete(obj);
    return refusedLogo(db, player, rid, g, Number(a.me.rid));
  }
  if (!(await db.prepare('SELECT 1 FROM guild_logos WHERE id = ?').bind(id).first())) {
    await bucket.delete(obj);
    return refusedLogo(db, player, rid, g, Number(a.me.rid));
  }
  return { ok: true, logo: id, fee: GUILD_LOGO_FEE };
}
/** AUDIT GUILD-SHOP S7/S11: why a sending was not written, read after it - its own request's review (a twin that won), one
 *  under way, the rank gone, or the treasury short. */
async function refusedLogo(db, player, rid, g, memberRid) {
  const twin = await db
    .prepare('SELECT id FROM guild_logos WHERE by_player = ? AND rid = ?')
    .bind(player.id, rid)
    .first();
  if (twin) return { ok: true, repeat: true, logo: twin.id };
  if (await db.prepare("SELECT 1 FROM guild_logos WHERE guild_id = ? AND state = 'pending'").bind(g).first())
    return { error: 'logo-pending' };
  const still = await db
    .prepare(
      'SELECT m.rank, g.ranks, g.powers FROM guild_members m JOIN guilds g ON g.id = m.guild_id WHERE m.rowid = ? AND m.guild_id = ? AND m.player = ?',
    )
    .bind(memberRid, g, player.id)
    .first();
  if (!still || !guildMay(Number(still.rank), 'logo', guildPowersOfRow(still))) return { error: 'guild-rank' };
  return { error: 'guild-marks-short' };
}

/**
 * THE REVIEW ENDED: `state` approved, denied or withdrawn, by `by`. One batch, every statement guarded on the row moving
 * from pending in the first: approved - the guild wears it and the fee is burnt; else the fee home (what the treasury has
 * room for; any rest burnt). A letter to the guildmaster says how it went. Answers whether this call ended it.
 */
export async function endLogoReview(db, id, state, by, nowS, bucket = null) {
  if (!GUILD_LOGO_ID_RE.test(String(id)) || !['approved', 'denied', 'withdrawn'].includes(state)) return false;
  const row = await db.prepare("SELECT * FROM guild_logos WHERE id = ? AND state = 'pending'").bind(id).first();
  if (!row) return false;
  // AUDIT GUILD-SHOP S4: an approval retires the guild's logo before it - its picture served no more
  const replaced =
    state === 'approved'
      ? ((
          await db
            .prepare("SELECT id, obj FROM guild_logos WHERE guild_id = ? AND state = 'approved' AND id <> ?")
            .bind(row.guild_id, id)
            .all()
        )?.results ?? [])
      : [];
  const day = utcDay(nowS),
    esc = `logo:${id}`;
  // the fee home, as much as the treasury has room for, read now - the rest burnt (a full treasury's CHECK refuses the batch)
  const has = Number(
    (await db.prepare('SELECT balance FROM guild_marks WHERE guild_id = ?').bind(row.guild_id).first())?.balance ?? 0,
  );
  const back = Math.max(0, Math.min(Number(row.fee), MARKS_MAX - has)),
    rest = Number(row.fee) - back;
  const master = await db
    .prepare(`SELECT player FROM guild_members WHERE guild_id = ? AND rank = ${GUILD_RANK_MASTER}`)
    .bind(row.guild_id)
    .first();
  const ended = `FROM guild_logos WHERE id = ?1 AND state = '${state}' AND decided_at = ?4`;
  const money =
    state === 'approved'
      ? [
          db
            .prepare(
              `UPDATE guilds SET logo = ?1 WHERE id = (SELECT guild_id FROM guild_logos WHERE id = ?1 AND state = 'approved' AND decided_at = ?2)`,
            )
            .bind(id, nowS),
          db
            .prepare(
              `UPDATE guild_logos SET state = 'withdrawn', decided_at = ?2, decided_by = 'replaced'
        WHERE guild_id = (SELECT guild_id FROM guild_logos WHERE id = ?1 AND state = 'approved' AND decided_at = ?2) AND state = 'approved' AND id <> ?1`,
            )
            .bind(id, nowS),
          db
            .prepare(
              `${INSERT_LINE} SELECT 'escrow', ?2, 'burn', NULL, 'logo-fee', fee, ?3, ?4, by_player, by_name, rid || ':logo-end' ${ended} AND fee > 0`,
            )
            .bind(id, esc, day, nowS),
        ]
      : [
          db
            .prepare(
              `${INSERT_LINE} SELECT 'escrow', ?2, 'guild', guild_id, 'logo-return', ?5, ?3, ?4, by_player, by_name, rid || ':logo-end' ${ended} AND ?5 > 0`,
            )
            .bind(id, esc, day, nowS, back),
          db
            .prepare(
              `${INSERT_LINE} SELECT 'escrow', ?2, 'burn', NULL, 'logo-fee', ?5, ?3, ?4, by_player, by_name, rid || ':logo-rest' ${ended} AND ?5 > 0`,
            )
            .bind(id, esc, day, nowS, rest),
        ];
  const letter = master
    ? [
        db
          .prepare(
            `INSERT OR IGNORE INTO server_post (id, to_id, batch, sender, subject, body, item, sent_at, ware)
    VALUES (lower(hex(randomblob(12))), ?1, ?2, ?3, ?4, ?5, NULL, ?6, NULL)`,
          )
          .bind(master.player, `guild-logo-${id}`, POST_SENDER, ...logoLetter(state, row), nowS),
      ]
    : [];
  try {
    await db.batch([
      // THE DECISION: pending still - a second press, or a withdrawal racing a moderator, moves nothing
      // AUDIT GUILD-SHOP S3: a card never posted is never posted now - only one standing in the channel is redrawn
      db
        .prepare(
          `UPDATE guild_logos SET state = ?2, decided_at = ?3, decided_by = ?4,
          discord_state = CASE WHEN discord_msg IS NULL THEN 'off' ELSE 'due' END
        WHERE id = ?1 AND state = 'pending'`,
        )
        .bind(id, state, nowS, String(by ?? '').slice(0, 64)),
      mustChange(db),
      ...money,
      ...letter,
    ]);
  } catch {
    return false;
  }
  // AUDIT GUILD-SHOP S10: a picture nobody may wear is kept no more - turned down, withdrawn, or replaced
  for (const obj of state === 'approved' ? replaced.map((r) => r.obj) : [row.obj])
    await bucket?.delete?.(obj)?.catch?.(() => {});
  return true;
}
/** The guildmaster's letter for a review's end: its subject and body. Pure. */
export function logoLetter(/** @type {string} */ state, /** @type {any} */ row) {
  const fee = Number(row?.fee ?? 0).toLocaleString('en-US');
  if (state === 'approved')
    return [
      "Your guild's logo is approved",
      `The moderators approved your guild's logo. It now shows in place of the device on your arms.\n\n${fee} silver was paid for the review.\n\n- ${POST_SENDER}`,
    ];
  if (state === 'taken-down')
    return [
      "Your guild's logo was taken down",
      `A moderator took down your guild's logo. Your guild shows its device again.\n\nYou can send another from the Arms page.\n\n- ${POST_SENDER}`,
    ];
  if (state === 'denied')
    return [
      "Your guild's logo was turned down",
      `The moderators turned down your guild's logo. The ${fee} silver review fee is back in the treasury.\n\nYou can send another from the Arms page.\n\n- ${POST_SENDER}`,
    ];
  return [
    "Your guild's logo review is withdrawn",
    `The review was withdrawn. The ${fee} silver review fee is back in the treasury.\n\n- ${POST_SENDER}`,
  ];
}

/** WITHDRAW ONE: `{ character }` - the guildmaster's review under way, ended and its fee home. */
export async function withdrawGuildLogo(ctx, player, { character } = {}) {
  const { db, nowS } = ctx;
  const a = await guildActorOf(db, player, character);
  if (a.error) return a;
  if (!guildMay(Number(a.me.rank), 'logo', a.powers)) return { error: 'guild-rank' };
  const row = await db
    .prepare("SELECT id FROM guild_logos WHERE guild_id = ? AND state = 'pending'")
    .bind(a.me.guild_id)
    .first();
  if (!row) return { error: 'logo-none' };
  return (await endLogoReview(db, row.id, 'withdrawn', displayName(player), nowS, ctx.bucket))
    ? { ok: true, withdrawn: row.id }
    : { error: 'logo-none' };
}

/** THE LOGO TAKEN DOWN: `{ character }` - the guildmaster's. The guild wears its own device again; the picture is
 *  served no more. Its fee was spent when it was approved. */
export async function clearGuildLogo(ctx, player, { character } = {}) {
  const { db, nowS } = ctx;
  const a = await guildActorOf(db, player, character);
  if (a.error) return a;
  if (!guildMay(Number(a.me.rank), 'logo', a.powers)) return { error: 'guild-rank' };
  const g = await db.prepare('SELECT logo FROM guilds WHERE id = ?').bind(a.me.guild_id).first();
  if (!g?.logo) return { error: 'logo-none' };
  const obj = (await db.prepare('SELECT obj FROM guild_logos WHERE id = ?').bind(g.logo).first())?.obj ?? null;
  await db.batch([
    db
      .prepare(
        "UPDATE guild_logos SET state = 'withdrawn', decided_at = ?, decided_by = ? WHERE id = ? AND guild_id = ? AND state = 'approved'",
      )
      .bind(nowS, displayName(player), g.logo, a.me.guild_id),
    db.prepare('UPDATE guilds SET logo = NULL WHERE id = ? AND logo = ?').bind(a.me.guild_id, g.logo),
  ]);
  if (obj) await ctx.bucket?.delete?.(obj)?.catch?.(() => {}); // AUDIT GUILD-SHOP S10: its picture kept no more
  return { ok: true, cleared: g.logo };
}

/** AUDIT GUILD-SHOP D2: AN APPROVED LOGO TAKEN DOWN by a moderator - approved by mistake, or found wrong since. One batch:
 *  the row withdrawn (approved still), the guild's device back, a letter to its guildmaster; then its picture deleted. */
export async function takeDownLogo(db, id, by, nowS, bucket = null) {
  const row = await db.prepare("SELECT * FROM guild_logos WHERE id = ? AND state = 'approved'").bind(id).first();
  if (!row) return false;
  const master = await db
    .prepare(`SELECT player FROM guild_members WHERE guild_id = ? AND rank = ${GUILD_RANK_MASTER}`)
    .bind(row.guild_id)
    .first();
  try {
    await db.batch([
      db
        .prepare(
          `UPDATE guild_logos SET state = 'withdrawn', decided_at = ?2, decided_by = ?3, discord_state = CASE WHEN discord_msg IS NULL THEN 'off' ELSE 'due' END
        WHERE id = ?1 AND state = 'approved'`,
        )
        .bind(id, nowS, String(by ?? '').slice(0, 64)),
      mustChange(db),
      db.prepare('UPDATE guilds SET logo = NULL WHERE id = ? AND logo = ?').bind(row.guild_id, id),
      ...(master
        ? [
            db
              .prepare(
                `INSERT OR IGNORE INTO server_post (id, to_id, batch, sender, subject, body, item, sent_at, ware)
        VALUES (lower(hex(randomblob(12))), ?1, ?2, ?3, ?4, ?5, NULL, ?6, NULL)`,
              )
              .bind(master.player, `guild-logo-off-${id}`, POST_SENDER, ...logoLetter('taken-down', row), nowS),
          ]
        : []),
    ]);
  } catch {
    return false;
  }
  await bucket?.delete?.(row.obj)?.catch?.(() => {});
  return true;
}

/** A LOGO'S PICTURE, for anyone: the bytes and their type while it is under review or approved, else none. */
export async function guildLogoBytes({ db, bucket }, id) {
  if (!GUILD_LOGO_ID_RE.test(String(id))) return { error: 'no-logo' };
  // AUDIT GUILD-SHOP S4: an approved picture is served only while its guild wears it
  const row = await db
    .prepare(
      `SELECT obj, type, state FROM guild_logos l WHERE id = ? AND (state = 'pending'
    OR (state = 'approved' AND EXISTS (SELECT 1 FROM guilds WHERE id = l.guild_id AND logo = l.id)))`,
    )
    .bind(id)
    .first();
  if (!row) return { error: 'no-logo' };
  if (!bucket) return { error: 'no-storage' };
  const obj = await bucket.get(row.obj);
  if (!obj) return { error: 'no-logo' };
  return { bytes: await obj.arrayBuffer(), type: String(row.type), approved: row.state === 'approved' };
}

/** A REVIEW'S CARD - pure: the guild, who sent it, the picture, and the two buttons while it is pending (AUDIT GUILD-SHOP D2: Take down while it is worn). */
export function logoCard(/** @type {any} */ row, /** @type {any} */ guild) {
  const open = row.state === 'pending';
  const downed = row.state === 'withdrawn' && / \(Discord\)$/.test(String(row.decided_by ?? '')); // AUDIT GUILD-SHOP D2: a moderator's take-down
  const ended = downed
    ? 'Taken down'
    : { approved: 'Approved', denied: 'Turned down', withdrawn: 'Withdrawn by the guild' }[
        /** @type {'approved'} */ (row.state)
      ];
  const embed = {
    title: `Guild logo: ${md(guild?.name ?? '?')} <${md(guild?.tag ?? '?')}>`,
    description: open
      ? 'A guild sent this logo to wear in place of its device on its banners, shields, sails and armlets.'
      : `${ended}${row.decided_by ? ` by ${md(row.decided_by)}` : ''}.`,
    color: open ? 0x3070d0 : row.state === 'approved' ? 0x30a050 : 0x808080,
    fields: [
      { name: 'Sent by', value: `${md(row.by_name)} (\`${row.by_player}\`)`, inline: true },
      { name: 'Picture', value: `${row.side} px, ${Math.ceil(Number(row.bytes) / 1024)} KiB`, inline: true },
      { name: 'Fee', value: `${Number(row.fee).toLocaleString('en-US')} silver, held until you decide`, inline: true },
    ],
    image: { url: row.src },
  };
  const components = open
    ? [
        {
          type: 1,
          components: [
            { type: 2, style: 3, label: 'Approve', custom_id: `glogo:ok:${row.id}` },
            { type: 2, style: 4, label: 'Turn down', custom_id: `glogo:no:${row.id}` },
          ],
        },
      ]
    : row.state === 'approved'
      ? [{ type: 1, components: [{ type: 2, style: 4, label: 'Take down', custom_id: `glogo:off:${row.id}` }] }]
      : []; // AUDIT GUILD-SHOP D2
  return { embeds: [embed], components, allowed_mentions: { parse: [] } };
}
const cardFor = async (db, id) => {
  const row = await db.prepare('SELECT * FROM guild_logos WHERE id = ?').bind(id).first();
  if (!row) return null;
  return logoCard(row, await db.prepare('SELECT name, tag FROM guilds WHERE id = ?').bind(row.guild_id).first());
};

/** THE MINUTE'S LOGO CARDS: each review due posted or redrawn (safetyClock.js postCards' law). Answers how many. */
export async function postLogoCards(ctx, env, fetchFn) {
  // AUDIT GUILD-SHOP S12: a review sent while Discord was off goes up once it is on - else nobody could decide it
  await ctx.db
    .prepare("UPDATE guild_logos SET discord_state = 'due' WHERE state = 'pending' AND discord_state = 'off'")
    .run();
  const due =
    (
      await ctx.db
        .prepare("SELECT id, discord_msg FROM guild_logos WHERE discord_state = 'due' ORDER BY at LIMIT ?1")
        .bind(LOGO_POSTS_MAX)
        .all()
    )?.results ?? [];
  let n = 0;
  for (const r of due) {
    const card = await cardFor(ctx.db, r.id);
    if (!card) continue;
    const sent = await sendCard(env, fetchFn, card, r.discord_msg ?? null, { nonce: r.id.slice(0, 25) });
    if ('down' in sent) break;
    if ('gone' in sent) {
      await ctx.db.prepare('UPDATE guild_logos SET discord_msg = NULL WHERE id = ?1').bind(r.id).run();
      continue;
    }
    if ('refused' in sent) {
      await ctx.db.prepare("UPDATE guild_logos SET discord_state = 'failed' WHERE id = ?1").bind(r.id).run();
      continue;
    }
    await ctx.db
      .prepare("UPDATE guild_logos SET discord_msg = ?2, discord_state = 'posted' WHERE id = ?1")
      .bind(r.id, sent.id)
      .run();
    n++;
  }
  return n;
}

/** Whether a press is a logo card's. */
export const isLogoPress = (/** @type {any} */ body) => LOGO_PRESS_RE.test(String(body?.data?.custom_id ?? ''));
/** A LOGO CARD PRESSED by a moderator (discord.js discordInteraction, the actor already a moderator): the review ended
 *  and the card redrawn in place - one pressed after another moderator decided redraws what was decided. */
export async function onLogoPress(ctx, body, actor) {
  const m = LOGO_PRESS_RE.exec(String(body?.data?.custom_id ?? ''));
  if (!m) return null;
  if (m[1] === 'off')
    await takeDownLogo(ctx.db, m[2], `${displayName(actor)} (Discord)`, ctx.nowS, ctx.bucket); // AUDIT GUILD-SHOP D2
  else
    await endLogoReview(
      ctx.db,
      m[2],
      m[1] === 'ok' ? 'approved' : 'denied',
      `${displayName(actor)} (Discord)`,
      ctx.nowS,
      ctx.bucket,
    );
  await ctx.db
    .prepare("UPDATE guild_logos SET discord_state = 'posted' WHERE id = ?1 AND discord_msg IS NOT NULL")
    .bind(m[2])
    .run(); // the redraw below is the post
  const card = await cardFor(ctx.db, m[2]);
  return card ? { type: 7, data: card } : { type: 4, data: { content: 'That logo is gone.', flags: 64 } };
}
