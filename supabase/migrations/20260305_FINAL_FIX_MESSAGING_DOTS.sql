-- FINAL FIX FOR MESSAGING AND ORDERS DOTS
BEGIN;

-- 1. Ensure the is_read column exists on messages
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(chat_id, is_read) WHERE is_read = FALSE;

-- 2. THIS IS THE MISSING PIECE: Allow messages to actually be updated to "read" by users
DROP POLICY IF EXISTS "Users can update messages in their chats" ON messages;
CREATE POLICY "Users can update messages in their chats"
  ON messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM chats
      WHERE chats.id = messages.chat_id
      AND (
        chats.consumer_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()) OR
        chats.specialist_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chats
      WHERE chats.id = messages.chat_id
      AND (
        chats.consumer_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()) OR
        chats.specialist_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
      )
    )
  );

-- 3. Clear ANY existing stuck dots that may be lingering in the database
UPDATE messages SET is_read = TRUE;

COMMIT;
