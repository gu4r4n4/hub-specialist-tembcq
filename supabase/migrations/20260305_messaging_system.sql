-- Migration to add simple messaging/chat functionality
BEGIN;

-- 1. Create chats table to represent a conversation between a consumer and a specialist for a specific service
CREATE TABLE IF NOT EXISTS chats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  consumer_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  specialist_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(consumer_profile_id, specialist_profile_id, service_id)
);

-- 2. Create messages table for individual text messages
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  sender_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Enable RLS
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for chats
-- Users can only see chats they are part of
CREATE POLICY "Users can view their own chats"
  ON chats FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id IN (consumer_profile_id, specialist_profile_id)
      AND profiles.user_id = auth.uid()
    )
  );

-- Consumers can initiate a chat
CREATE POLICY "Consumers can create chats"
  ON chats FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = consumer_profile_id
      AND profiles.user_id = auth.uid()
      AND profiles.role = 'consumer'
    )
  );

-- 5. RLS Policies for messages
-- Users can see messages in chats they are part of
CREATE POLICY "Users can view messages in their chats"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chats
      JOIN profiles cp ON chats.consumer_profile_id = cp.id
      JOIN profiles sp ON chats.specialist_profile_id = sp.id
      WHERE messages.chat_id = chats.id
      AND (cp.user_id = auth.uid() OR sp.user_id = auth.uid())
    )
  );

-- Users can insert messages in chats they are part of
CREATE POLICY "Users can send messages in their chats"
  ON messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chats
      JOIN profiles cp ON chats.consumer_profile_id = cp.id
      JOIN profiles sp ON chats.specialist_profile_id = sp.id
      WHERE messages.chat_id = chats.id
      AND (cp.user_id = auth.uid() OR sp.user_id = auth.uid())
      AND messages.sender_profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1)
    )
  );

-- 6. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_chats_consumer ON chats(consumer_profile_id);
CREATE INDEX IF NOT EXISTS idx_chats_specialist ON chats(specialist_profile_id);
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

COMMIT;
