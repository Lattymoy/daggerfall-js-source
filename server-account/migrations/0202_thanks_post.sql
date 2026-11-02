-- THANKS-POST (2026-10-30, the owner: "every current player should be grant 500 free aurem on the update to their inbox and
-- a free arm armoury aura"; bible/06-Systems/Aurum.md section 3c): THE STOREFRONT UPDATE'S GIFT - every registered account
-- standing when this runs holds the gift `thanks` (src/net/giftLaw.js: 500 Aurum and the Crystal Spurs), a ledger line of
-- its Aurum, and a letter in the post naming it. An account made after it holds none. The gift's statement is the tool's
-- own (tools/sendServerPost.mjs `--migration thanks`), its words FROZEN there; test/tooling/serverpost_send.test.js holds
-- the two equal. Each write is once an account, run again: the gift's key, the ledger line's key, 0093's one-a-send index.
--   players.gifts      the gift keys an account holds, space-separated ('' none) - what each gives is giftLaw's
--   server_post.gift   the gift a letter names (NULL none) - drawn in the letter, nothing to claim
ALTER TABLE players ADD COLUMN gifts TEXT NOT NULL DEFAULT '';
ALTER TABLE server_post ADD COLUMN gift TEXT;
UPDATE players SET gifts = trim(gifts || ' ' || 'thanks')
WHERE handle IS NOT NULL AND instr(' ' || gifts || ' ', ' thanks ') = 0;
INSERT OR IGNORE INTO aurum_ledger (account, kind, ref, amount, day, at)
SELECT p.id, 'gift', 'thanks', 500, CAST(strftime('%s', 'now') AS INTEGER) / 86400, CAST(strftime('%s', 'now') AS INTEGER)
FROM players p WHERE p.handle IS NOT NULL;
INSERT OR IGNORE INTO server_post (id, to_id, batch, sender, subject, body, item, sent_at, gift)
SELECT lower(hex(randomblob(12))), p.id, 'thanks-aurum-spurs', 'The DFO Team', 'Thank you, from all of us', 'Through the good times and the bad, thank you for staying with us. None of this would be possible without your support.

As a thank-you, 500 Aurum and the Crystal Spurs are on your account now. The Spurs are an Aura Armory piece for your arms. Wear them from your profile.

Let''s continue our journey, together.

With love,
The DFO Team', NULL, CAST(strftime('%s', 'now') AS INTEGER), 'thanks'
FROM players p WHERE p.handle IS NOT NULL;
