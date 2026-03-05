-- Migration to add read status tracking to orders
BEGIN;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_read_by_specialist BOOLEAN DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_read_by_consumer BOOLEAN DEFAULT TRUE; -- Start as true for consumer since they created it

-- Update existing orders to be "read" so we don't suddenly have a bunch of old dots
UPDATE orders SET is_read_by_specialist = TRUE, is_read_by_consumer = TRUE;

COMMIT;
