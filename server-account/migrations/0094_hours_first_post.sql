-- HOURS-FIRST (2026-10-08, Mac: "for all the accounts here I want to grant them a unique different version of the aura,
-- a title named Hour's First, and each the gilded gun"): THE POST'S FIRST SEND - the thirteen accounts of the first
-- clear of an Abyss Dungeon (read off the first clear's claims by .github/workflows/sd-clears.yml), each sent a piece of
-- the server's post (0093) holding the Hourlock, the gilded gun, as its drop minted it (src/systems/gilded.js). Each
-- claims it into the online character they are playing, from the mailbox beside the hourglass in the pause menu. Their
-- title and aura are the config's list (server-account/wrangler.toml HOURS_FIRST_HANDLES, titles.js isHoursFirst).
-- AUDIT SERVER-POST: the names and the record here are FROZEN (tools/sendServerPost.mjs HOURS_FIRST, HOURS_FIRST_RECORD)
-- - an applied migration never runs again. A name added to the title's list later is sent the gun by
-- .github/workflows/server-post.yml with this send's name, `hours-first-hourlock`, item `hourlock`: once an account.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI), after 0093 lays the table.
-- And once a send an account besides: INSERT OR IGNORE over 0093's ux_server_post_batch. The statement is
-- tools/sendServerPost.mjs's own (`--migration hours-first` prints it), held to it by test/serverpost_send.test.js.
INSERT OR IGNORE INTO server_post (id, to_id, batch, sender, subject, body, item, sent_at)
SELECT lower(hex(randomblob(12))), p.id, 'hours-first-hourlock', 'The Developers', 'Hour''s First', 'You were among the first to break an Abyss Dungeon. The Hour remembers.

Your title, Hour''s First, and its aura, The First Hour, are yours to wear - choose them on your profile.

The Hourlock is enclosed. Claim it and it goes into the pack of the online character you are playing.

- The Developers', '{"group":"Weapons","templateIndex":560,"material":4,"flags":0,"variant":0,"message":0,"stackCount":1,"name":"The Hourlock","value":39740,"maxCondition":4800,"currentCondition":4800,"rarity":"gilded","gilded":"the-hourlock","affixes":[{"id":"damage","value":40},{"id":"stat","param":"agility","value":15},{"id":"skill","param":33,"value":30},{"id":"elemental","param":"shock","value":10}],"isIdentified":true}', CAST(strftime('%s', 'now') AS INTEGER)
FROM players p WHERE p.handle IS NOT NULL AND p.handle_lc IN ('aether', 'artemisgodfrey', 'cycled0se', 'duck', 'kobakk', 'mackywackydeejew', 'mayaamano', 'nirnroot', 'ofrizz', 'rosalina', 'shikix3', 'temegast', 'terra');
