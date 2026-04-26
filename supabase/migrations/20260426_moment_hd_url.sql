-- Add HD photo URL column to moments table
alter table moments add column if not exists hd_url text;
