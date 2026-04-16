#!/usr/bin/env python3
"""
Database Parts Matcher
Since we can't access the database directly, we'll create a template for database parts
and then create a comprehensive matching script for when you have the database export
"""

import pandas as pd
import numpy as np
from difflib import SequenceMatcher
import re
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

class DatabasePartsmatcher:
    def __init__(self):
        self.db_parts_data = []
        self.zz110_data = []
        self.matched_items = []
        self.unmatched_db_parts = []
        self.unmatched_zz110 = []
        
    def clean_part_number(self, part_num):
        """Clean and standardize part numbers for comparison"""
        if pd.isna(part_num) or part_num is None:
            return ""
        
        # Convert to string and clean
        part_str = str(part_num).strip().upper()
        
        # Remove common prefixes/suffixes and special characters
        part_str = re.sub(r'[^\w\-]', '', part_str)
        
        return part_str
    
    def clean_description(self, desc):
        """Clean and standardize descriptions for comparison"""
        if pd.isna(desc) or desc is None:
            return ""
        
        # Convert to string and clean
        desc_str = str(desc).strip().upper()
        
        # Remove extra spaces and special characters
        desc_str = re.sub(r'\s+', ' ', desc_str)
        desc_str = re.sub(r'[^\w\s\-]', '', desc_str)
        
        return desc_str
    
    def similarity_score(self, str1, str2):
        """Calculate similarity score between two strings"""
        if not str1 or not str2:
            return 0.0
        return SequenceMatcher(None, str1, str2).ratio()
    
    def create_sample_db_export(self):
        """Create a sample database export template"""
        print("📝 Creating sample database parts export template...")
        
        # Create sample data structure based on database schema
        sample_data = [
            {
                'Part ID': 1,
                'Name': 'Sensor Assembly',
                'Description': 'Temperature sensor for main chamber',
                'Manufacturer Part Number': 'TEMP-001',
                'Internal Part Number': 'FS-TEMP-001',
                'Quantity': 5,
                'Minimum Quantity': 2,
                'Supplier': 'SensorTech Inc',
                'Unit Cost': 25.99,
                'Location': 'Main Storage',
                'Location Description': 'Primary parts storage area',
                'Stock Status': 'In Stock',
                'Notes': 'Check calibration monthly',
                'Created At': '2024-01-15',
                'Updated At': '2024-09-20'
            },
            {
                'Part ID': 2,
                'Name': 'Motor Bearing',
                'Description': 'Ball bearing for drive motor',
                'Manufacturer Part Number': 'SKF-6205',
                'Internal Part Number': 'FS-BEARING-001',
                'Quantity': 0,
                'Minimum Quantity': 4,
                'Supplier': 'SKF Industrial',
                'Unit Cost': 15.50,
                'Location': 'Cabinet A',
                'Location Description': 'Mechanical parts cabinet',
                'Stock Status': 'Out of Stock',
                'Notes': 'Order replacement ASAP',
                'Created At': '2024-02-01',
                'Updated At': '2024-09-18'
            },
            # Add more sample entries as needed
        ]
        
        # Create sample Excel file
        df_sample = pd.DataFrame(sample_data)
        sample_filename = "Sample_Database_Parts_Export.xlsx"
        df_sample.to_excel(sample_filename, index=False)
        
        print(f"✅ Sample database export created: {sample_filename}")
        print("📋 To get your actual database parts:")
        print("   1. Run a SQL query: SELECT * FROM parts LEFT JOIN part_locations ON parts.location_id = part_locations.location_id")
        print("   2. Export the results to Excel with the same column structure")
        print("   3. Use that file with this script")
        
        return sample_filename
    
    def load_database_parts(self, file_path):
        """Load database parts from Excel export"""
        print(f"Loading database parts from: {file_path}")
        
        try:
            df = pd.read_excel(file_path)
            print(f"📊 Loaded {len(df)} rows from database export")
            
            # Show available columns
            print(f"Available columns: {list(df.columns)}")
            
            # Map database export columns to standard format
            for _, row in df.iterrows():
                # Handle different possible column name variations
                part_id = row.get('Part ID') or row.get('part_id') or row.get('id')
                name = row.get('Name') or row.get('name') or row.get('part_name')
                description = row.get('Description') or row.get('description')
                mfg_part_num = row.get('Manufacturer Part Number') or row.get('manufacturer_part_number') or row.get('mfg_part_number')
                internal_part_num = row.get('Internal Part Number') or row.get('internal_part_number')
                quantity = row.get('Quantity') or row.get('quantity') or 0
                supplier = row.get('Supplier') or row.get('supplier')
                unit_cost = row.get('Unit Cost') or row.get('unit_cost') or 0
                location = row.get('Location') or row.get('location') or row.get('location_name')
                notes = row.get('Notes') or row.get('notes')
                
                # Skip rows without essential data
                if pd.isna(name) and pd.isna(mfg_part_num) and pd.isna(internal_part_num):
                    continue
                
                # Create combined description
                combined_desc = str(name or '') + ' ' + str(description or '')
                
                # Use the most specific part number available
                primary_part_num = internal_part_num or mfg_part_num or name
                
                self.db_parts_data.append({
                    'Source': 'Database',
                    'Part_ID': part_id,
                    'Part_Number': self.clean_part_number(primary_part_num),
                    'Description': self.clean_description(combined_desc),
                    'Original_Part_Number': primary_part_num,
                    'Original_Description': combined_desc.strip(),
                    'Manufacturer_Part_Number': mfg_part_num,
                    'Internal_Part_Number': internal_part_num,
                    'Quantity': quantity,
                    'Supplier': supplier,
                    'Unit_Cost': unit_cost,
                    'Location': location,
                    'Notes': notes
                })
            
            print(f"✅ Processed {len(self.db_parts_data)} database parts")
            
        except Exception as e:
            print(f"❌ Error loading database parts: {e}")
            return False
        
        return True
    
    def load_zz110_inventory(self, file_path):
        """Load data from ZZ110-SparePartsInventory-09-18-2025.xls"""
        print(f"Loading ZZ110 Spare Parts Inventory: {file_path}")
        
        # Load Sheet1
        df = pd.read_excel(file_path, sheet_name='Sheet1', skiprows=1)
        df.columns = ['ITEM_NUMB', 'ITEM_DESC1', 'ITEM_DESC2', 'KIND_DESC', 'LOC', 'WHSE', 'OnHandQuantity', 'Cost', 'Value']
        
        for _, row in df.iterrows():
            if pd.notna(row['ITEM_NUMB']) and str(row['ITEM_NUMB']).strip() and str(row['ITEM_NUMB']).strip() != 'ITEM_NUMB':
                self.zz110_data.append({
                    'Source': 'ZZ110 Inventory',
                    'Part_Number': self.clean_part_number(row['ITEM_NUMB']),
                    'Description': self.clean_description(str(row['ITEM_DESC1']) + ' ' + str(row['ITEM_DESC2']) if pd.notna(row['ITEM_DESC2']) else str(row['ITEM_DESC1'])),
                    'Original_Part_Number': row['ITEM_NUMB'],
                    'Original_Description': str(row['ITEM_DESC1']) + (' ' + str(row['ITEM_DESC2']) if pd.notna(row['ITEM_DESC2']) else ''),
                    'Quantity': row.get('OnHandQuantity', ''),
                    'Location': row.get('LOC', ''),
                    'Warehouse': row.get('WHSE', ''),
                    'Cost': row.get('Cost', ''),
                    'Value': row.get('Value', '')
                })
                
        print(f"✅ Loaded {len(self.zz110_data)} items from ZZ110 Inventory")
    
    def find_matches(self):
        """Find matches between database parts and ZZ110 inventory"""
        print("🔍 Finding matches between database parts and ZZ110 inventory...")
        
        # Track which items have been matched
        matched_db_indices = set()
        matched_zz110_indices = set()
        
        # Phase 1: Exact internal part number matches
        print("Phase 1: Exact internal part number matching...")
        for i, db_item in enumerate(self.db_parts_data):
            for j, zz110_item in enumerate(self.zz110_data):
                if i in matched_db_indices or j in matched_zz110_indices:
                    continue
                
                internal_part = self.clean_part_number(db_item.get('Internal_Part_Number', ''))
                if internal_part and internal_part == zz110_item['Part_Number']:
                    self.matched_items.append({
                        'Match_Type': 'Exact Internal Part Number',
                        'Match_Score': 1.0,
                        'DB_Part_ID': db_item['Part_ID'],
                        'DB_Part_Number': db_item['Original_Part_Number'],
                        'DB_Internal_Number': db_item.get('Internal_Part_Number', ''),
                        'DB_Manufacturer_Number': db_item.get('Manufacturer_Part_Number', ''),
                        'DB_Description': db_item['Original_Description'],
                        'DB_Quantity': db_item['Quantity'],
                        'DB_Location': db_item['Location'],
                        'DB_Supplier': db_item['Supplier'],
                        'DB_Unit_Cost': db_item['Unit_Cost'],
                        'ZZ110_Part_Number': zz110_item['Original_Part_Number'],
                        'ZZ110_Description': zz110_item['Original_Description'],
                        'ZZ110_Quantity': zz110_item['Quantity'],
                        'ZZ110_Location': zz110_item['Location'],
                        'ZZ110_Cost': zz110_item.get('Cost', ''),
                        'ZZ110_Value': zz110_item.get('Value', '')
                    })
                    matched_db_indices.add(i)
                    matched_zz110_indices.add(j)
                    break
        
        phase1_matches = len(self.matched_items)
        print(f"Found {phase1_matches} internal part number matches")
        
        # Phase 2: Exact manufacturer part number matches
        print("Phase 2: Exact manufacturer part number matching...")
        for i, db_item in enumerate(self.db_parts_data):
            if i in matched_db_indices:
                continue
                
            for j, zz110_item in enumerate(self.zz110_data):
                if j in matched_zz110_indices:
                    continue
                
                mfg_part = self.clean_part_number(db_item.get('Manufacturer_Part_Number', ''))
                if mfg_part and mfg_part == zz110_item['Part_Number']:
                    self.matched_items.append({
                        'Match_Type': 'Exact Manufacturer Part Number',
                        'Match_Score': 1.0,
                        'DB_Part_ID': db_item['Part_ID'],
                        'DB_Part_Number': db_item['Original_Part_Number'],
                        'DB_Internal_Number': db_item.get('Internal_Part_Number', ''),
                        'DB_Manufacturer_Number': db_item.get('Manufacturer_Part_Number', ''),
                        'DB_Description': db_item['Original_Description'],
                        'DB_Quantity': db_item['Quantity'],
                        'DB_Location': db_item['Location'],
                        'DB_Supplier': db_item['Supplier'],
                        'DB_Unit_Cost': db_item['Unit_Cost'],
                        'ZZ110_Part_Number': zz110_item['Original_Part_Number'],
                        'ZZ110_Description': zz110_item['Original_Description'],
                        'ZZ110_Quantity': zz110_item['Quantity'],
                        'ZZ110_Location': zz110_item['Location'],
                        'ZZ110_Cost': zz110_item.get('Cost', ''),
                        'ZZ110_Value': zz110_item.get('Value', '')
                    })
                    matched_db_indices.add(i)
                    matched_zz110_indices.add(j)
                    break
        
        phase2_matches = len(self.matched_items) - phase1_matches
        print(f"Found {phase2_matches} manufacturer part number matches")
        
        # Phase 3: Fuzzy description matching
        print("Phase 3: Fuzzy description matching...")
        description_threshold = 0.75
        
        for i, db_item in enumerate(self.db_parts_data):
            if i in matched_db_indices:
                continue
                
            best_match = None
            best_score = 0.0
            best_j = -1
            
            for j, zz110_item in enumerate(self.zz110_data):
                if j in matched_zz110_indices:
                    continue
                
                # Calculate description similarity
                desc_score = self.similarity_score(db_item['Description'], zz110_item['Description'])
                
                if desc_score > best_score and desc_score >= description_threshold:
                    best_score = desc_score
                    best_match = zz110_item
                    best_j = j
            
            if best_match:
                self.matched_items.append({
                    'Match_Type': 'Fuzzy Description',
                    'Match_Score': best_score,
                    'DB_Part_ID': db_item['Part_ID'],
                    'DB_Part_Number': db_item['Original_Part_Number'],
                    'DB_Internal_Number': db_item.get('Internal_Part_Number', ''),
                    'DB_Manufacturer_Number': db_item.get('Manufacturer_Part_Number', ''),
                    'DB_Description': db_item['Original_Description'],
                    'DB_Quantity': db_item['Quantity'],
                    'DB_Location': db_item['Location'],
                    'DB_Supplier': db_item['Supplier'],
                    'DB_Unit_Cost': db_item['Unit_Cost'],
                    'ZZ110_Part_Number': best_match['Original_Part_Number'],
                    'ZZ110_Description': best_match['Original_Description'],
                    'ZZ110_Quantity': best_match['Quantity'],
                    'ZZ110_Location': best_match['Location'],
                    'ZZ110_Cost': best_match.get('Cost', ''),
                    'ZZ110_Value': best_match.get('Value', '')
                })
                matched_db_indices.add(i)
                matched_zz110_indices.add(best_j)
        
        phase3_matches = len(self.matched_items) - phase1_matches - phase2_matches
        print(f"Found {phase3_matches} fuzzy description matches")
        
        # Collect unmatched items
        for i, item in enumerate(self.db_parts_data):
            if i not in matched_db_indices:
                self.unmatched_db_parts.append(item)
        
        for j, item in enumerate(self.zz110_data):
            if j not in matched_zz110_indices:
                self.unmatched_zz110.append(item)
        
        print(f"\n📊 DATABASE vs ZZ110 MATCHING RESULTS:")
        print(f"Total matches found: {len(self.matched_items)}")
        print(f"  - internal part number matches: {phase1_matches}")
        print(f"  - Manufacturer part number matches: {phase2_matches}")
        print(f"  - Fuzzy description matches: {phase3_matches}")
        print(f"Unmatched database parts: {len(self.unmatched_db_parts)}")
        print(f"Unmatched ZZ110 parts: {len(self.unmatched_zz110)}")
    
    def export_results(self):
        """Export results to Excel files"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Export matched items
        if self.matched_items:
            df_matched = pd.DataFrame(self.matched_items)
            matched_filename = f"Database_ZZ110_Matches_{timestamp}.xlsx"
            df_matched.to_excel(matched_filename, index=False)
            print(f"✅ Database matches exported to: {matched_filename}")
        
        # Export unmatched items
        unmatched_filename = f"Database_ZZ110_Unmatched_{timestamp}.xlsx"
        
        with pd.ExcelWriter(unmatched_filename) as writer:
            if self.unmatched_db_parts:
                df_unmatched_db = pd.DataFrame(self.unmatched_db_parts)
                df_unmatched_db.to_excel(writer, sheet_name='Unmatched_Database_Parts', index=False)
            
            if self.unmatched_zz110:
                df_unmatched_zz110 = pd.DataFrame(self.unmatched_zz110)
                df_unmatched_zz110.to_excel(writer, sheet_name='Unmatched_ZZ110_Parts', index=False)
        
        print(f"✅ Unmatched items exported to: {unmatched_filename}")
        
        # Calculate and display percentages
        total_db_parts = len(self.db_parts_data)
        total_zz110_parts = len(self.zz110_data)
        total_matches = len(self.matched_items)
        
        if total_db_parts > 0:
            db_match_rate = (total_matches / total_db_parts) * 100
            print(f"\n📈 DATABASE PARTS MATCH RATE: {db_match_rate:.1f}% ({total_matches}/{total_db_parts})")
        
        if total_zz110_parts > 0:
            zz110_match_rate = (total_matches / total_zz110_parts) * 100
            print(f"📈 ZZ110 PARTS MATCH RATE: {zz110_match_rate:.1f}% ({total_matches}/{total_zz110_parts})")
        
        return matched_filename, unmatched_filename

def main():
    matcher = DatabasePartsmatcher()
    
    print("🗄️ DATABASE PARTS MATCHING SYSTEM")
    print("=" * 50)
    
    # Check if database export file exists
    db_files = [
        "Database_Parts_Export_2025-09-24T20-06-56.xlsx",
        "Database_Parts_Export.xlsx",
        "Sample_Database_Parts_Export.xlsx"
    ]
    
    db_file = None
    for file in db_files:
        try:
            pd.read_excel(file)
            db_file = file
            print(f"📁 Found database parts file: {file}")
            break
        except:
            continue
    
    if not db_file:
        print("📝 No database parts file found. Creating sample template...")
        db_file = matcher.create_sample_db_export()
        print(f"\n🔄 To proceed with actual matching:")
        print(f"   1. Export your database parts to Excel using the sample format")
        print(f"   2. Replace '{db_file}' with your actual data")
        print(f"   3. Run this script again")
        return
    
    # Load database parts
    if not matcher.load_database_parts(db_file):
        print("❌ Failed to load database parts")
        return
    
    # Load ZZ110 inventory
    try:
        matcher.load_zz110_inventory("ZZ110-SparePartsInventory-09-18-2025.xls")
    except Exception as e:
        print(f"❌ Error loading ZZ110 inventory: {e}")
        return
    
    # Find matches
    matcher.find_matches()
    
    # Export results
    matcher.export_results()
    
    print("\n🎯 Database parts matching completed!")

if __name__ == "__main__":
    main()
