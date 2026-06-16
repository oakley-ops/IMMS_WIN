-- SMS target for admin/purchasing users
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(32);
