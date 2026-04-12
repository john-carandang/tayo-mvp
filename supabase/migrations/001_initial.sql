-- Tayo V3 — Initial Schema Migration
-- Run this in your Supabase SQL Editor: Dashboard → SQL Editor → New Query → Paste → Run

-- ─── User Profiles ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  coach_id TEXT,
  warmup_data JSONB,
  consent_acknowledged BOOLEAN DEFAULT FALSE,
  consent_timestamp TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own profile"
  ON user_profiles FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── Sessions ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_number INTEGER,
  transcript TEXT,
  profile_json JSONB,
  commitments JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own sessions"
  ON sessions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── Dashboard Snapshots (versioned) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dashboard_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot_version INTEGER,
  chapter_cards JSONB,
  portrait_stats JSONB,
  scorecard JSONB,
  narrative_blurb TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE dashboard_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own snapshots"
  ON dashboard_snapshots FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── Assignments ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  description TEXT,
  type TEXT,
  due_date DATE,
  status TEXT DEFAULT 'pending',
  reflection TEXT,
  resources JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own assignments"
  ON assignments FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── Between-session Messages ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS check_in_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT,
  content TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE check_in_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own messages"
  ON check_in_messages FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
