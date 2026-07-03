-- Fix for Messaging Issues in UNIGRAM
-- Issue 1: Add missing blocked_users table for block functionality
-- Issue 2: Add missing DELETE policy for messages table for permanent deletion

-- 1. Create blocked_users table
CREATE TABLE IF NOT EXISTS blocked_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  blocker_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  blocked_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(blocker_id, blocked_id)
);

-- Enable RLS on blocked_users
ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;

-- RLS Policies for blocked_users
DROP POLICY IF EXISTS "Users can view their own blocked list" ON blocked_users;
DROP POLICY IF EXISTS "Users can block other users" ON blocked_users;
DROP POLICY IF EXISTS "Users can unblock other users" ON blocked_users;
CREATE POLICY "Users can view their own blocked list" ON blocked_users FOR SELECT USING (auth.uid() = blocker_id OR auth.uid() = blocked_id);
CREATE POLICY "Users can block other users" ON blocked_users FOR INSERT WITH CHECK (auth.uid() = blocker_id);
CREATE POLICY "Users can unblock other users" ON blocked_users FOR DELETE USING (auth.uid() = blocker_id);

-- 2. Add INSERT and DELETE policies to messages table
-- This blocks users from sending messages if either participant has blocked the other
DROP POLICY IF EXISTS "Users can send messages" ON messages;
DROP POLICY IF EXISTS "Users can delete own messages" ON messages;
CREATE POLICY "Users can send messages" ON messages FOR INSERT WITH CHECK (
  auth.uid() = from_id AND
  NOT EXISTS (
    SELECT 1 FROM blocked_users WHERE blocker_id = from_id AND blocked_id = to_id
  ) AND
  NOT EXISTS (
    SELECT 1 FROM blocked_users WHERE blocker_id = to_id AND blocked_id = from_id
  )
);

CREATE POLICY "Users can delete own messages" ON messages FOR DELETE USING (
  auth.uid() = from_id OR auth.uid() = to_id
);

-- Create index for better performance on blocked_users queries
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocker_id ON blocked_users(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked_id ON blocked_users(blocked_id);
