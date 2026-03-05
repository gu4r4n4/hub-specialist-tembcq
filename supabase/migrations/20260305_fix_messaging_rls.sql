-- 1. Add UPDATE policy for chats
CREATE POLICY "Users can update their own chats"
  ON chats FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id IN (consumer_profile_id, specialist_profile_id)
      AND profiles.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id IN (consumer_profile_id, specialist_profile_id)
      AND profiles.user_id = auth.uid()
    )
  );

-- 2. Add UPDATE policy for messages
CREATE POLICY "Users can update messages in their chats"
  ON messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM chats
      JOIN profiles cp ON chats.consumer_profile_id = cp.id
      JOIN profiles sp ON chats.specialist_profile_id = sp.id
      WHERE messages.chat_id = chats.id
      AND (cp.user_id = auth.uid() OR sp.user_id = auth.uid())
    )
  )
  -- Allow updating is_read
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chats
      JOIN profiles cp ON chats.consumer_profile_id = cp.id
      JOIN profiles sp ON chats.specialist_profile_id = sp.id
      WHERE messages.chat_id = chats.id
      AND (cp.user_id = auth.uid() OR sp.user_id = auth.uid())
    )
  );
