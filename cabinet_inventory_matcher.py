#!/usr/bin/env python3
"""
Cabinet-Only Inventory Matcher
Matches only Cabinet worksheets from Parts Inventory 2025 against ZZ110-SparePartsInventory
Excludes the "Full Fiserv parts list" sheet for more targeted matching
"""

import pandas as pd
import numpy as np
from difflib import SequenceMatcher
import re
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

class CabinetInventoryMatcher:
    def __init__(self):
        self.cabinet_data = []  # Only cabinet worksheets from Parts Inventory 2025
        self.zz110_data = []   # ZZ110 Spare Parts
        self.matched_items = []
        self.unmatched_cabinet = []
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
    
    def load_cabinet_worksheets(self, file_path):
        """Load ONLY cabinet worksheets from Parts Inventory 2025.2 (1).xlsx"""
        print(f"Loading cabinet worksheets from: {file_path}")
        
        # Define cabinet sheets to load (excluding Full Fiserv parts list)
        cabinet_sheets = [
            'Sensor Cabinet',
            'Cabinet A', 
            'Cabinet B',
            'Cabinet C', 
            'Cabinet D',
            'C4 kurz , spartantics'
        ]
        
        for sheet_name in cabinet_sheets:
            try:
                print(f"  Loading {sheet_name}...")
                
                if sheet_name == 'Sensor Cabinet':
                    # Handle Sensor Cabinet format
                    df = pd.read_excel(file_path, sheet_name=sheet_name)
                    # Find columns that might contain part info
                    for _, row in df.iterrows():
                        # Look for any non-empty cells that might be part numbers
                        for col in df.columns:
                            if pd.notna(row[col]) and str(row[col]).strip():
                                cell_value = str(row[col]).strip()
                                # Skip obvious headers
                                if cell_value.upper() not in ['SENSOR CABINET', 'PART', 'NAME', 'QTY', 'QUANTITY']:
                                    self.cabinet_data.append({
                                        'Source': 'Sensor Cabinet',
                                        'Part_Number': self.clean_part_number(cell_value),
                                        'Description': self.clean_description(cell_value),
                                        'Original_Part_Number': cell_value,
                                        'Original_Description': cell_value,
                                        'Quantity': '',
                                        'Location': 'Sensor Cabinet'
                                    })
                
                elif sheet_name in ['Cabinet A', 'Cabinet B']:
                    # Handle Cabinet A and B format
                    df = pd.read_excel(file_path, sheet_name=sheet_name)
                    # Look for standard column names or first few columns
                    part_col = None
                    desc_col = None
                    qty_col = None
                    
                    for col in df.columns:
                        col_str = str(col).upper()
                        if 'PART' in col_str and '#' in col_str:
                            part_col = col
                        elif 'PART' in col_str and 'NAME' in col_str:
                            desc_col = col
                        elif 'QTY' in col_str:
                            qty_col = col
                    
                    # If standard columns not found, use positional
                    if part_col is None and len(df.columns) > 0:
                        part_col = df.columns[1] if len(df.columns) > 1 else df.columns[0]
                    if desc_col is None and len(df.columns) > 1:
                        desc_col = df.columns[0]
                    
                    for _, row in df.iterrows():
                        if pd.notna(row.get(part_col)) and str(row.get(part_col)).strip():
                            part_num = str(row.get(part_col)).strip()
                            if part_num.upper() not in ['PART #', 'PART NUMBER']:
                                desc = str(row.get(desc_col, '')) if pd.notna(row.get(desc_col)) else ''
                                self.cabinet_data.append({
                                    'Source': sheet_name,
                                    'Part_Number': self.clean_part_number(part_num),
                                    'Description': self.clean_description(desc),
                                    'Original_Part_Number': part_num,
                                    'Original_Description': desc,
                                    'Quantity': row.get(qty_col, '') if qty_col else '',
                                    'Location': sheet_name,
                                    'Alt_Part_Number': row.get('ALT Part #', '') if 'ALT Part #' in row else ''
                                })
                
                elif sheet_name in ['Cabinet C', 'Cabinet D']:
                    # Handle Cabinet C and D format
                    df = pd.read_excel(file_path, sheet_name=sheet_name)
                    
                    # Look for Part # and Part Name columns
                    for _, row in df.iterrows():
                        if pd.notna(row.get('Part #')) and str(row.get('Part #')).strip():
                            part_num = str(row.get('Part #')).strip()
                            if part_num.upper() not in ['PART #', 'PART NUMBER']:
                                desc = str(row.get('Part Name', '')) if pd.notna(row.get('Part Name')) else ''
                                self.cabinet_data.append({
                                    'Source': sheet_name,
                                    'Part_Number': self.clean_part_number(part_num),
                                    'Description': self.clean_description(desc),
                                    'Original_Part_Number': part_num,
                                    'Original_Description': desc,
                                    'Quantity': row.get('Qty.', ''),
                                    'Location': sheet_name,
                                    'Alt_Part_Number': row.get('Alt Part #', '')
                                })
                
                elif sheet_name == 'C4 kurz , spartantics':
                    # Handle C4 kurz format
                    df = pd.read_excel(file_path, sheet_name=sheet_name)
                    # This sheet might have a different format, handle flexibly
                    for _, row in df.iterrows():
                        for col in df.columns:
                            if pd.notna(row[col]) and str(row[col]).strip():
                                cell_value = str(row[col]).strip()
                                # Look for potential part numbers (alphanumeric with dashes)
                                if re.search(r'^[A-Z0-9\-]+$', cell_value.upper()) and len(cell_value) > 3:
                                    self.cabinet_data.append({
                                        'Source': 'C4 kurz , spartantics',
                                        'Part_Number': self.clean_part_number(cell_value),
                                        'Description': self.clean_description(cell_value),
                                        'Original_Part_Number': cell_value,
                                        'Original_Description': cell_value,
                                        'Quantity': '',
                                        'Location': 'C4 kurz , spartantics'
                                    })
                
                print(f"    Loaded items from {sheet_name}")
                
            except Exception as e:
                print(f"    Error loading {sheet_name}: {e}")
        
        print(f"Total cabinet items loaded: {len(self.cabinet_data)}")
        
        # Show breakdown by source
        sources = {}
        for item in self.cabinet_data:
            source = item['Source']
            sources[source] = sources.get(source, 0) + 1
        
        print("Breakdown by cabinet:")
        for source, count in sources.items():
            print(f"  {source}: {count} items")
    
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
                
        print(f"Loaded {len(self.zz110_data)} items from ZZ110 Inventory")
    
    def find_matches(self):
        """Find matches between cabinet data and ZZ110 inventory"""
        print("Finding matches between cabinet inventories and ZZ110...")
        
        # Track which items have been matched
        matched_cabinet_indices = set()
        matched_zz110_indices = set()
        
        # Phase 1: Exact part number matches
        print("Phase 1: Exact part number matching...")
        for i, cabinet_item in enumerate(self.cabinet_data):
            for j, zz110_item in enumerate(self.zz110_data):
                if i in matched_cabinet_indices or j in matched_zz110_indices:
                    continue
                    
                if cabinet_item['Part_Number'] and zz110_item['Part_Number'] and cabinet_item['Part_Number'] == zz110_item['Part_Number']:
                    self.matched_items.append({
                        'Match_Type': 'Exact Part Number',
                        'Match_Score': 1.0,
                        'Cabinet_Source': cabinet_item['Source'],
                        'Cabinet_Part_Number': cabinet_item['Original_Part_Number'],
                        'Cabinet_Description': cabinet_item['Original_Description'],
                        'Cabinet_Quantity': cabinet_item['Quantity'],
                        'Cabinet_Location': cabinet_item['Location'],
                        'ZZ110_Part_Number': zz110_item['Original_Part_Number'],
                        'ZZ110_Description': zz110_item['Original_Description'],
                        'ZZ110_Quantity': zz110_item['Quantity'],
                        'ZZ110_Location': zz110_item['Location'],
                        'ZZ110_Cost': zz110_item.get('Cost', ''),
                        'ZZ110_Value': zz110_item.get('Value', '')
                    })
                    matched_cabinet_indices.add(i)
                    matched_zz110_indices.add(j)
                    break
        
        print(f"Found {len(self.matched_items)} exact part number matches")
        
        # Phase 2: Alternative part number matching
        print("Phase 2: Alternative part number matching...")
        alt_matches = 0
        for i, cabinet_item in enumerate(self.cabinet_data):
            if i in matched_cabinet_indices:
                continue
            
            alt_part = cabinet_item.get('Alt_Part_Number', '')
            if not alt_part or pd.isna(alt_part):
                continue
                
            cleaned_alt = self.clean_part_number(alt_part)
            if not cleaned_alt:
                continue
                
            for j, zz110_item in enumerate(self.zz110_data):
                if j in matched_zz110_indices:
                    continue
                    
                if cleaned_alt == zz110_item['Part_Number']:
                    self.matched_items.append({
                        'Match_Type': 'Alternative Part Number',
                        'Match_Score': 1.0,
                        'Cabinet_Source': cabinet_item['Source'],
                        'Cabinet_Part_Number': cabinet_item['Original_Part_Number'],
                        'Cabinet_Description': cabinet_item['Original_Description'],
                        'Cabinet_Alt_Part': alt_part,
                        'Cabinet_Quantity': cabinet_item['Quantity'],
                        'Cabinet_Location': cabinet_item['Location'],
                        'ZZ110_Part_Number': zz110_item['Original_Part_Number'],
                        'ZZ110_Description': zz110_item['Original_Description'],
                        'ZZ110_Quantity': zz110_item['Quantity'],
                        'ZZ110_Location': zz110_item['Location'],
                        'ZZ110_Cost': zz110_item.get('Cost', ''),
                        'ZZ110_Value': zz110_item.get('Value', '')
                    })
                    matched_cabinet_indices.add(i)
                    matched_zz110_indices.add(j)
                    alt_matches += 1
                    break
        
        print(f"Found {alt_matches} alternative part number matches")
        
        # Phase 3: Fuzzy description matching
        print("Phase 3: Fuzzy description matching...")
        description_threshold = 0.80  # Higher threshold for cabinet matching
        fuzzy_matches = 0
        
        for i, cabinet_item in enumerate(self.cabinet_data):
            if i in matched_cabinet_indices:
                continue
                
            best_match = None
            best_score = 0.0
            best_j = -1
            
            for j, zz110_item in enumerate(self.zz110_data):
                if j in matched_zz110_indices:
                    continue
                
                # Calculate description similarity
                desc_score = self.similarity_score(cabinet_item['Description'], zz110_item['Description'])
                
                if desc_score > best_score and desc_score >= description_threshold:
                    best_score = desc_score
                    best_match = zz110_item
                    best_j = j
            
            if best_match:
                self.matched_items.append({
                    'Match_Type': 'Fuzzy Description',
                    'Match_Score': best_score,
                    'Cabinet_Source': cabinet_item['Source'],
                    'Cabinet_Part_Number': cabinet_item['Original_Part_Number'],
                    'Cabinet_Description': cabinet_item['Original_Description'],
                    'Cabinet_Quantity': cabinet_item['Quantity'],
                    'Cabinet_Location': cabinet_item['Location'],
                    'ZZ110_Part_Number': best_match['Original_Part_Number'],
                    'ZZ110_Description': best_match['Original_Description'],
                    'ZZ110_Quantity': best_match['Quantity'],
                    'ZZ110_Location': best_match['Location'],
                    'ZZ110_Cost': best_match.get('Cost', ''),
                    'ZZ110_Value': best_match.get('Value', '')
                })
                matched_cabinet_indices.add(i)
                matched_zz110_indices.add(best_j)
                fuzzy_matches += 1
        
        print(f"Found {fuzzy_matches} fuzzy description matches")
        
        # Collect unmatched items
        for i, item in enumerate(self.cabinet_data):
            if i not in matched_cabinet_indices:
                self.unmatched_cabinet.append(item)
        
        for j, item in enumerate(self.zz110_data):
            if j not in matched_zz110_indices:
                self.unmatched_zz110.append(item)
        
        print(f"\nCABINET-ONLY MATCHING RESULTS:")
        print(f"Total matches found: {len(self.matched_items)}")
        print(f"Unmatched cabinet items: {len(self.unmatched_cabinet)}")
        print(f"Unmatched ZZ110 items: {len(self.unmatched_zz110)}")
    
    def export_results(self):
        """Export results to Excel files"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Export matched items
        if self.matched_items:
            df_matched = pd.DataFrame(self.matched_items)
            matched_filename = f"Cabinet_Only_Matches_{timestamp}.xlsx"
            df_matched.to_excel(matched_filename, index=False)
            print(f"Cabinet matches exported to: {matched_filename}")
        
        # Export unmatched items
        unmatched_filename = f"Cabinet_Only_Unmatched_{timestamp}.xlsx"
        
        with pd.ExcelWriter(unmatched_filename) as writer:
            if self.unmatched_cabinet:
                df_unmatched_cabinet = pd.DataFrame(self.unmatched_cabinet)
                df_unmatched_cabinet.to_excel(writer, sheet_name='Unmatched_Cabinet_Items', index=False)
            
            if self.unmatched_zz110:
                df_unmatched_zz110 = pd.DataFrame(self.unmatched_zz110)
                df_unmatched_zz110.to_excel(writer, sheet_name='Unmatched_ZZ110_Items', index=False)
        
        print(f"Unmatched items exported to: {unmatched_filename}")
        
        # Print summary statistics
        print("\n" + "="*60)
        print("CABINET-ONLY INVENTORY MATCHING SUMMARY")
        print("="*60)
        print(f"Total cabinet items: {len(self.cabinet_data)}")
        print(f"Total ZZ110 items: {len(self.zz110_data)}")
        print(f"Total matches found: {len(self.matched_items)}")
        
        # Break down matches by type
        exact_matches = len([m for m in self.matched_items if m['Match_Type'] == 'Exact Part Number'])
        alt_matches = len([m for m in self.matched_items if m['Match_Type'] == 'Alternative Part Number'])
        fuzzy_matches = len([m for m in self.matched_items if m['Match_Type'] == 'Fuzzy Description'])
        
        print(f"  - Exact part number matches: {exact_matches}")
        print(f"  - Alternative part number matches: {alt_matches}")
        print(f"  - Fuzzy description matches: {fuzzy_matches}")
        
        print(f"Unmatched cabinet items: {len(self.unmatched_cabinet)}")
        print(f"Unmatched ZZ110 items: {len(self.unmatched_zz110)}")
        
        # Calculate match rate
        total_items = len(self.cabinet_data) + len(self.zz110_data)
        match_rate = (len(self.matched_items) * 2) / total_items * 100
        print(f"\nCabinet-ZZ110 match rate: {match_rate:.1f}%")
        
        return matched_filename, unmatched_filename

def main():
    matcher = CabinetInventoryMatcher()
    
    # Load cabinet worksheets only (excluding Full Fiserv parts list)
    matcher.load_cabinet_worksheets("Parts Inventory 2025.2 (1).xlsx")
    
    # Load ZZ110 inventory
    matcher.load_zz110_inventory("ZZ110-SparePartsInventory-09-18-2025.xls")
    
    # Find matches
    matcher.find_matches()
    
    # Export results
    matcher.export_results()

if __name__ == "__main__":
    main()
