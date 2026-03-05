-- 1. Ensure the is_read column exists first
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;

-- 2. Add indexes for performance on unread messages
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(chat_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(chat_id);

-- 3. Update existing messages to be "read" so we don't suddenly have a bunch of old dots
UPDATE messages SET is_read = TRUE;
