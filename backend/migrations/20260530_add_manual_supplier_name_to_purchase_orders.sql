-- Add a free-text supplier name for purchase orders that are not tied to a
-- supplier record (manual POs). Previously this was crammed into the notes
-- field as JSON, which the detail/list views could not display, so such POs
-- showed "No Supplier Name".
ALTER TABLE purchase_orders
ADD COLUMN IF NOT EXISTS manual_supplier_name VARCHAR(255);
