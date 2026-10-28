-- TAMRIEL-POST (2026-10-28, the owner: "Send a heartfelt, non-ai like message to players in their inbox and attach 10
-- portal stones"): THE TAMRIEL UPDATE'S LETTER - every registered account standing when this runs is sent one piece of the
-- server's post (0093), a thank-you holding ten Portal Stones in one stack (src/systems/gate/gateSpoils.js portalStones).
-- Each claims them into the online character they are playing, from the mailbox beside the hourglass in the pause menu.
-- The words and the record are FROZEN in tools/sendServerPost.mjs (TAMRIEL_POST, TAMRIEL_POST_RECORD) - an applied
-- migration never runs again. An account made after it is not sent it. Applied once through the `d1_migrations` ledger,
-- which the deploy runs (ACC1-CI), and once a send an account besides: INSERT OR IGNORE over 0093's ux_server_post_batch.
-- The statement is the tool's own (`--migration tamriel` prints it), held to it by test/tooling/serverpost_send.test.js.
INSERT OR IGNORE INTO server_post (id, to_id, batch, sender, subject, body, item, sent_at)
SELECT lower(hex(randomblob(12))), p.id, 'tamriel-portal-stones', 'DFO Team', 'Thank you, and something for the road', 'Thank you for playing, and for sticking with us.

This update opens up the rest of Tamriel, past the Iliac Bay. It took a long time to build, and a lot of it was shaped by your bug reports and ideas.

There are ten Portal Stones in this letter. Go and see it: the ash on Red Mountain, the reeds of the Shadowfen, the vineyards of Summerset.

We''re really glad you''re here. See you out there.

- DFO Team', '{"group":"UselessItems2","templateIndex":572,"name":"Portal Stone","value":1250,"maxCondition":1000,"currentCondition":1000,"stackCount":10}', CAST(strftime('%s', 'now') AS INTEGER)
FROM players p WHERE p.handle IS NOT NULL;
