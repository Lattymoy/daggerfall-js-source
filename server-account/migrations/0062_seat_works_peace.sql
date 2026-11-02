-- SEAT2b part two (2026-10-01, Mac: "Finish the seats"; "Let's pick up 482") - THE WORKS AT PEACE
-- (bible/11-Multiplayer/Seats-Arc.md 7.5; Professions-Arc 3.3): a project begun by a SIEGEWRIGHT (Carpentry 100: "siege
-- works a day sooner") stands a day sooner - kept on the project's row beside the Builder's stone, as its starter's own
-- (server-account/src/seatForts.js fundFort; src/net/fortLaw.js fortStandsAt). The Shrine, the Watchtowers, the crafting
-- halls and the Harbour keep nothing of their own: each is read off the works' tiers where it acts.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI).
ALTER TABLE town_seat_forts ADD COLUMN siegewright INTEGER NOT NULL DEFAULT 0 CHECK (siegewright IN (0, 1));
