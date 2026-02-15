-- Add city column to services table
-- This allows services to have their own location independent of the specialist's profile location

ALTER TABLE services 
ADD COLUMN IF NOT EXISTS city TEXT;

-- Add index for faster city-based queries
CREATE INDEX IF NOT EXISTS idx_services_city ON services(city);

-- Add comment to document the column
COMMENT ON COLUMN services.city IS 'City/location where the service is offered';
