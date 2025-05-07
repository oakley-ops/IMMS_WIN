import random

# Categories of parts
categories = [
    "Print Head", "Paper Roll", "Card Reader", "PIN Pad", "Power Supply",
    "Display", "Touch Screen", "Roller", "Network Card", "Memory Module",
    "Cassette", "Journal Printer", "Receipt Printer", "Cash Acceptor", "Check Scanner",
    "Biometric Reader", "Camera", "Lock", "Keypad", "Monitor"
]

# Manufacturers
manufacturers = ["Diebold", "NCR", "Wincor", "Fujitsu", "Glory", "OKI", "Epson", "HP"]

# Generate SQL file
with open('migrations/insert_1000_parts.sql', 'w') as f:
    # Start the insert statement
    f.write('INSERT INTO parts (name, fiserv_part_number, description, quantity, minimum_quantity, manufacturer_part_number) VALUES\n')
    
    # Generate 1000 parts
    counter = 1000  # Start from 1000 to ensure uniqueness
    for i in range(11, 1011):  # Start from 11 since we already have 10 parts
        category = random.choice(categories)
        manufacturer = random.choice(manufacturers)
        model = f"M{random.randint(100,999)}"
        
        name = f"{manufacturer} {category} {model}"
        fiserv_number = f"FSV-{manufacturer[:2].upper()}{counter:04d}"
        mfg_number = f"{manufacturer[:3].upper()}-{category[:3].upper()}-{model}"
        description = f"{manufacturer} {category} for ATM/ITM systems - Model {model}"
        quantity = 5
        min_quantity = random.randint(1, 3)
        
        # Add the values
        f.write(f"  ('{name}', '{fiserv_number}', '{description}', {quantity}, {min_quantity}, '{mfg_number}')")
        
        # Add comma if not last item
        if i < 1010:
            f.write(',\n')
        else:
            f.write(';\n')
            
        counter += 1

print("SQL file generated successfully!")
