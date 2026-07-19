-- Run this in Supabase SQL Editor after supabase_schema.sql
-- Adds Collab/Synapse tables, notifications, and message performance indexes

-- ─── Message indexes (scale) ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_messages_from_to_created
  ON messages (from_id, to_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_to_from_created
  ON messages (to_id, from_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_to_unread
  ON messages (to_id, created_at DESC)
  WHERE read = false;

-- ─── Synapse / Collab workspaces ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS synapse_workspaces (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  headline TEXT DEFAULT '',
  skills TEXT[] DEFAULT '{}',
  interests TEXT[] DEFAULT '{}',
  availability TEXT DEFAULT '',
  project_goals TEXT DEFAULT '',
  preferred_roles TEXT[] DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_synapse_workspaces_skills ON synapse_workspaces USING GIN (skills);
CREATE INDEX IF NOT EXISTS idx_synapse_workspaces_interests ON synapse_workspaces USING GIN (interests);

-- ─── Synapse outreach history ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS synapse_outreach (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  target_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  target_name TEXT,
  goal TEXT DEFAULT '',
  message TEXT DEFAULT '',
  needed_skills TEXT[] DEFAULT '{}',
  project_idea TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_synapse_outreach_user ON synapse_outreach (user_id, created_at DESC);

-- ─── Synapse manual achievements ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS synapse_achievements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  category TEXT DEFAULT 'Project',
  description TEXT DEFAULT '',
  proof_url TEXT DEFAULT '',
  image_url TEXT,
  certificate_url TEXT,
  achieved_at DATE,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_synapse_achievements_user ON synapse_achievements (user_id, achieved_at DESC);

-- ─── Notifications (replace multi-query assembly) ──────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  href TEXT,
  read BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications (user_id, created_at DESC)
  WHERE read = false;

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications (user_id, created_at DESC);

-- ─── RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE synapse_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE synapse_outreach ENABLE ROW LEVEL SECURITY;
ALTER TABLE synapse_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Workspaces: public read (for discovery), owner write
CREATE POLICY "Synapse workspaces are viewable by everyone"
  ON synapse_workspaces FOR SELECT USING (true);

CREATE POLICY "Users manage own synapse workspace"
  ON synapse_workspaces FOR ALL USING (auth.uid() = user_id);

-- Outreach: owner only
CREATE POLICY "Users view own outreach"
  ON synapse_outreach FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users manage own outreach"
  ON synapse_outreach FOR ALL USING (auth.uid() = user_id);

-- Achievements: public read, owner write
CREATE POLICY "Synapse achievements are viewable by everyone"
  ON synapse_achievements FOR SELECT USING (true);

CREATE POLICY "Users manage own synapse achievements"
  ON synapse_achievements FOR ALL USING (auth.uid() = user_id);

-- Notifications: recipient only
CREATE POLICY "Users view own notifications"
  ON notifications FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users update own notifications"
  ON notifications FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can insert notifications"
  ON notifications FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
