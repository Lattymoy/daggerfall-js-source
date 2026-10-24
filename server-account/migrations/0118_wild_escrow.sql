-- MAC'S DECISION (2026-10-14, "Yes, build it" - the two-phase handoff; bible/11-Multiplayer/Wild-Zone.md section 4,
-- bible/06-Systems/Integrity-Arc.md INT9).
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI).
--
-- THE KILLER'S WORN PIECE, HELD BY THE SERVICE. The fallen loses the piece its killer picked only once the killer has it:
-- a death at another player's hand in the open zone takes that piece off the fallen's record INTO THIS ROW, in the fall's
-- own batch (server-account/src/wild.js wildFall), and nowhere else; the killer's collect (the room's signed `g1`) moves
-- it into the killer's record, or - nobody collecting before the remains could have gone - the fallen's own tab takes it
-- back into its record (wildReclaim). Each end is the row's `state` moved from 'held' in the same batch as the record that
-- receives the piece, guarded to change exactly one row: the piece is in the fallen's record, this row, or one record -
-- never two of them, never none.
--   r        the fall's remains id (wild_falls.r)
--   player   the fallen's account        char_id  its realm character
--   killer   the killer's account (the fall's receipt's)
--   rec      the piece's record, as the fallen's record held it
--   at       when the fall took it       until_s  the last second a collect may be signed for it (the remains' latest end)
--   state    'held', 'collected' or 'returned'
--   to_char  the realm character it ended in   ended_at  when
CREATE TABLE IF NOT EXISTS wild_escrow (
  r TEXT PRIMARY KEY,
  player TEXT NOT NULL,
  char_id TEXT NOT NULL,
  killer TEXT NOT NULL,
  rec TEXT NOT NULL,
  at INTEGER NOT NULL,
  until_s INTEGER NOT NULL,
  state TEXT NOT NULL DEFAULT 'held' CHECK (state IN ('held', 'collected', 'returned')),
  to_char TEXT,
  ended_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_wild_escrow_char ON wild_escrow (char_id, state);
CREATE INDEX IF NOT EXISTS idx_wild_escrow_ended ON wild_escrow (ended_at);
