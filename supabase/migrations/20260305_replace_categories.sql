-- Migration to replace existing categories with the new set from the screenshot
BEGIN;

-- 1. Temporarily disable foreign key checks if possible, or handle references
-- We'll create a "Miscellaneous" category first to reassign everything to
INSERT INTO categories (name, icon_material, icon_sf, display_order)
VALUES ('Miscellaneous', 'auto-awesome', 'sparkles', 99)
ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name;

-- 2. Get the id of the 'Miscellaneous' category
DO $$
DECLARE
    misc_id UUID;
BEGIN
    SELECT id INTO misc_id FROM categories WHERE name = 'Miscellaneous';

    -- 3. Reassign existing services to Miscellaneous
    UPDATE services SET category_id = misc_id;
    
    -- 4. Reassign existing profiles to Miscellaneous (if they had a category)
    UPDATE profiles SET category_id = misc_id WHERE category_id IS NOT NULL;
END $$;

-- 5. Delete all categories EXCEPT Miscellaneous
DELETE FROM categories WHERE name != 'Miscellaneous';

-- 6. Insert new categories from screenshot (with specific icons and order)
INSERT INTO categories (name, icon_material, icon_sf, display_order) VALUES
  ('Tutors', 'school', 'graduationcap.fill', 1),
  ('Repairmen', 'handyman', 'hammer.fill', 2),
  ('Beauty Masters', 'content-cut', 'scissors', 3),
  ('Freelancers', 'computer', 'desktopcomputer', 4),
  ('Accountants and lawyers', 'description', 'doc.text.fill', 5),
  ('Sports coaches', 'emoji-events', 'trophy.fill', 6),
  ('Artists', 'music-note', 'music.note', 7),
  ('Domestic staff', 'auto-awesome', 'sparkles', 8),
  ('Veterinarians', 'pets', 'pawprint.fill', 9),
  ('Driving instructors', 'directions-car', 'car.fill', 10);

-- 7. Update Miscellaneous to be the last item if it wasn't already
UPDATE categories SET display_order = 11 WHERE name = 'Miscellaneous';

COMMIT;
