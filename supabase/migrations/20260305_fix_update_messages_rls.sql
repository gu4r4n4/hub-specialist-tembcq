BEGIN;

-- Ensure users can update messages to mark them as read
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

-- Just to be safe, mark ALL existing messages as read ONE MORE TIME so any stuck ones are gone
UPDATE messages SET is_read = TRUE;

COMMIT;
