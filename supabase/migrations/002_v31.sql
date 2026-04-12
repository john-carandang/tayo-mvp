-- Tayo V3.1 — Incremental Migration
-- Run this in Supabase Dashboard → SQL Editor → New Query → Paste → Run

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS last_session_ended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS coach_voice_id TEXT;
