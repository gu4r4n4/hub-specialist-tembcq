BEGIN;
UPDATE messages SET is_read = TRUE;
COMMIT;
