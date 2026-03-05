-- Migration to simplify and fix chat RLS policies
BEGIN;

-- 1. Redefine SELECT policy for chats to be more direct
DROP POLICY IF EXISTS "Users can view their own chats" ON chats;
CREATE POLICY "Users can view their own chats"
  ON chats FOR SELECT
  USING (
    consumer_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()) OR
    specialist_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- 2. Ensure INSERT policy is clear
DROP POLICY IF EXISTS "Consumers can create chats" ON chats;
CREATE POLICY "Consumers can create chats"
  ON chats FOR INSERT
  WITH CHECK (
    consumer_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid() AND role = 'consumer')
  );

-- 3. Simplify SELECT policy for messages
DROP POLICY IF EXISTS "Users can view messages in their chats" ON messages;
CREATE POLICY "Users can view messages in their chats"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chats
      WHERE chats.id = messages.chat_id
      AND (
        chats.consumer_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()) OR
        chats.specialist_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
      )
    )
  );

COMMIT;
