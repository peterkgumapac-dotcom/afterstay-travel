-- Add blurhash column to moments table for instant image placeholders.
-- Nullable: existing rows will be NULL until backfilled server-side.
ALTER TABLE moments ADD COLUMN IF NOT EXISTS blurhash text;
