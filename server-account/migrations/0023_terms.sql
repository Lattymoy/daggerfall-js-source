-- TERMS1 (2026-09-28) - WHAT A NEW ACCOUNT AGREED TO, AND WHEN.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the
-- deploy runs (ACC1-CI).
--
-- "Here is our terms of service and privacy policy. I wanna make sure
-- these need to be reviewed and checked off by players before creating
-- an account". The two routes that make an account - `/v1/auth/guest`
-- opens the row, `/v1/auth/register` gives it a name - refuse a request
-- that does not carry the versions this service holds
-- (src/net/legalLaw.js), and write them here with the moment they were
-- ticked. A version is its document's Last Updated date, so a row says
-- WHICH text its player agreed to - the thing a later revision would be
-- asked against.
--
-- Additive only, and NULL on every row made before it: those accounts
-- were never asked (new accounts only, by the same request's answer),
-- and NULL says so rather than inventing an agreement nobody gave.
ALTER TABLE players ADD COLUMN terms_version TEXT;
ALTER TABLE players ADD COLUMN privacy_version TEXT;
ALTER TABLE players ADD COLUMN legal_accepted_at INTEGER;
