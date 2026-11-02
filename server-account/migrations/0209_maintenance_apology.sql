-- MAINTENANCE-APOLOGY (2026-11-02, the owner: "Please grant all users 500 aurum and an apology for the maintence. Grant
-- MarioTheShiba 1000 aurum. In total 1500 for Mario"): every registered account standing when this runs holds the gift
-- `maintenance` (src/net/giftLaw.js: 500 Aurum), a ledger line of its Aurum, and a letter in the post naming it; the account
-- MarioTheShiba holds `maintenanceplus` besides (1000 Aurum, its own letter) - 1500 in all. An account made after holds none.
-- The statement is the tool's own (tools/sendServerPost.mjs `--migration maintenance`), its words FROZEN there;
-- test/server/maintenance_post.test.js holds the two equal. Each write is once an account, run again: the gift's key, the
-- ledger line's key (account, 'gift', ref), 0093's one-a-send index.
UPDATE players SET gifts = trim(gifts || ' ' || 'maintenance')
WHERE handle IS NOT NULL AND instr(' ' || gifts || ' ', ' maintenance ') = 0;
INSERT OR IGNORE INTO aurum_ledger (account, kind, ref, amount, day, at)
SELECT p.id, 'gift', 'maintenance', 500, CAST(strftime('%s', 'now') AS INTEGER) / 86400, CAST(strftime('%s', 'now') AS INTEGER)
FROM players p WHERE p.handle IS NOT NULL;
INSERT OR IGNORE INTO server_post (id, to_id, batch, sender, subject, body, item, sent_at, gift)
SELECT lower(hex(randomblob(12))), p.id, 'maintenance-apology', 'The DFO Team', 'Sorry for the downtime', 'We''re sorry for the maintenance and for the time it kept you out of the game. We know how frustrating it is to sit down to play and not be able to get in.

As an apology, 500 Aurum is on your account now. Spend it in the shop whenever you like.

Thank you for your patience, and for sticking with us.

With love,
The DFO Team', NULL, CAST(strftime('%s', 'now') AS INTEGER), 'maintenance'
FROM players p WHERE p.handle IS NOT NULL;
UPDATE players SET gifts = trim(gifts || ' ' || 'maintenanceplus')
WHERE handle IS NOT NULL AND handle_lc IN ('mariotheshiba') AND instr(' ' || gifts || ' ', ' maintenanceplus ') = 0;
INSERT OR IGNORE INTO aurum_ledger (account, kind, ref, amount, day, at)
SELECT p.id, 'gift', 'maintenanceplus', 1000, CAST(strftime('%s', 'now') AS INTEGER) / 86400, CAST(strftime('%s', 'now') AS INTEGER)
FROM players p WHERE p.handle IS NOT NULL AND p.handle_lc IN ('mariotheshiba');
INSERT OR IGNORE INTO server_post (id, to_id, batch, sender, subject, body, item, sent_at, gift)
SELECT lower(hex(randomblob(12))), p.id, 'maintenance-apology-plus', 'The DFO Team', 'A little extra, with thanks', 'On top of the 500 Aurum from our maintenance apology, an extra 1,000 Aurum is on your account now - 1,500 in all.

Thank you for everything you do for the game.

With love,
The DFO Team', NULL, CAST(strftime('%s', 'now') AS INTEGER), 'maintenanceplus'
FROM players p WHERE p.handle IS NOT NULL AND p.handle_lc IN ('mariotheshiba');
