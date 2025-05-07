-- Add notes column to po_email_tracking table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'po_email_tracking' AND column_name = 'notes'
  ) THEN
    ALTER TABLE po_email_tracking ADD COLUMN notes TEXT;
  END IF;
END $$;

-- Add notes column to purchase_orders table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'purchase_orders' AND column_name = 'notes'
  ) THEN
    ALTER TABLE purchase_orders ADD COLUMN notes TEXT;
  END IF;
END $$; 