-- Create triggers for die tracking system

BEGIN;

-- Trigger to update dies.updated_at timestamp
CREATE OR REPLACE FUNCTION update_dies_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_dies_timestamp ON dies;
CREATE TRIGGER trigger_update_dies_timestamp
    BEFORE UPDATE ON dies
    FOR EACH ROW
    EXECUTE FUNCTION update_dies_timestamp();

-- Trigger to update die_sharpening_records.updated_at timestamp
CREATE OR REPLACE FUNCTION update_die_sharpening_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_die_sharpening_timestamp ON die_sharpening_records;
CREATE TRIGGER trigger_update_die_sharpening_timestamp
    BEFORE UPDATE ON die_sharpening_records
    FOR EACH ROW
    EXECUTE FUNCTION update_die_sharpening_timestamp();

-- Trigger to automatically generate die_number if not provided
CREATE OR REPLACE FUNCTION generate_die_number()
RETURNS TRIGGER AS $$
DECLARE
    new_number VARCHAR(50);
    current_year VARCHAR(4);
    sequence_num INTEGER;
BEGIN
    IF NEW.die_number IS NULL OR NEW.die_number = '' THEN
        current_year := TO_CHAR(CURRENT_DATE, 'YYYY');
        
        SELECT COALESCE(MAX(CAST(SUBSTRING(die_number FROM 9) AS INTEGER)), 0) + 1
        INTO sequence_num
        FROM dies
        WHERE die_number LIKE 'DIE-' || current_year || '%';
        
        new_number := 'DIE-' || current_year || '-' || LPAD(sequence_num::TEXT, 3, '0');
        NEW.die_number := new_number;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_generate_die_number ON dies;
CREATE TRIGGER trigger_generate_die_number
    BEFORE INSERT ON dies
    FOR EACH ROW
    EXECUTE FUNCTION generate_die_number();

COMMIT;
