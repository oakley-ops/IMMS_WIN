#!/usr/bin/env python3
"""
Inventory Mapping Script
Maps parts between two inventory lists and creates output files for matched and unmatched items.
"""

import pandas as pd
import numpy as np
from difflib import SequenceMatcher
import re
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

class InventoryMapper:
    def __init__(self):
        self.inventory1_data = []
        self.inventory2_data = []
        self.matched_items = []
        self.unmatched_inventory1 = []
        self.unmatched_inventory2 = []
        
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
    
    def load_inventory1(self, file_path):
        """Load data from Parts Inventory 2025.2 (1).xlsx"""
        print("Loading Inventory 1: Parts Inventory 2025.2 (1).xlsx")
        
        # Load Full Fiserv parts list
        df_full = pd.read_excel(file_path, sheet_name='Full Fiserv parts list', skiprows=2)
        df_full.columns = ['ITEM_NUMB', 'ITEM_DESC1', 'Date', 'Col4', 'ITEM_DESC2', 'KIND_DESC', 'LOC', 'WHSE', 'OnHandQuantity'] + [f'Col{i}' for i in range(10, 14)]
        
        for _, row in df_full.iterrows():
            if pd.notna(row['ITEM_NUMB']) and str(row['ITEM_NUMB']).strip():
                self.inventory1_data.append({
                    'Source': 'Full Fiserv parts list',
                    'Part_Number': self.clean_part_number(row['ITEM_NUMB']),
                    'Description': self.clean_description(str(row['ITEM_DESC1']) + ' ' + str(row['ITEM_DESC2']) if pd.notna(row['ITEM_DESC2']) else str(row['ITEM_DESC1'])),
                    'Original_Part_Number': row['ITEM_NUMB'],
                    'Original_Description': str(row['ITEM_DESC1']) + (' ' + str(row['ITEM_DESC2']) if pd.notna(row['ITEM_DESC2']) else ''),
                    'Quantity': row.get('OnHandQuantity', ''),
                    'Location': row.get('LOC', ''),
                    'Warehouse': row.get('WHSE', '')
                })
        
        # Load Cabinet A
        try:
            df_cabinet_a = pd.read_excel(file_path, sheet_name='Cabinet A')
            df_cabinet_a = df_cabinet_a.dropna(subset=['Part Name ', 'Part #'], how='all')
            
            for _, row in df_cabinet_a.iterrows():
                if pd.notna(row['Part #']) and str(row['Part #']).strip():
                    self.inventory1_data.append({
                        'Source': 'Cabinet A',
                        'Part_Number': self.clean_part_number(row['Part #']),
                        'Description': self.clean_description(row['Part Name ']),
                        'Original_Part_Number': row['Part #'],
                        'Original_Description': row['Part Name '],
                        'Quantity': row.get('Qty. ', ''),
                        'Location': row.get('Location', ''),
                        'Alt_Part_Number': row.get('ALT Part #', '')
                    })
        except Exception as e:
            print(f"Error loading Cabinet A: {e}")
        
        # Load Cabinet D
        try:
            df_cabinet_d = pd.read_excel(file_path, sheet_name='Cabinet D')
            df_cabinet_d = df_cabinet_d.dropna(subset=['Part Name', 'Part #'], how='all')
            
            for _, row in df_cabinet_d.iterrows():
                if pd.notna(row['Part #']) and str(row['Part #']).strip():
                    self.inventory1_data.append({
                        'Source': 'Cabinet D',
                        'Part_Number': self.clean_part_number(row['Part #']),
                        'Description': self.clean_description(row['Part Name']),
                        'Original_Part_Number': row['Part #'],
                        'Original_Description': row['Part Name'],
                        'Quantity': row.get('Qty.', ''),
                        'Location': row.get('Location', ''),
                        'Alt_Part_Number': row.get('Alt Part #', '')
                    })
        except Exception as e:
            print(f"Error loading Cabinet D: {e}")
            
        print(f"Loaded {len(self.inventory1_data)} items from Inventory 1")
    
    def load_inventory2(self, file_path):
        """Load data from ZZ110-SparePartsInventory-09-18-2025.xls"""
        print("Loading Inventory 2: ZZ110-SparePartsInventory-09-18-2025.xls")
        
        # Load Sheet1
        df = pd.read_excel(file_path, sheet_name='Sheet1', skiprows=1)
        df.columns = ['ITEM_NUMB', 'ITEM_DESC1', 'ITEM_DESC2', 'KIND_DESC', 'LOC', 'WHSE', 'OnHandQuantity', 'Cost', 'Value']
        
        for _, row in df.iterrows():
            if pd.notna(row['ITEM_NUMB']) and str(row['ITEM_NUMB']).strip() and str(row['ITEM_NUMB']).strip() != 'ITEM_NUMB':
                self.inventory2_data.append({
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
                
        print(f"Loaded {len(self.inventory2_data)} items from Inventory 2")
    
    def find_matches(self):
        """Find matches between the two inventories"""
        print("Finding matches between inventories...")
        
        # Track which items have been matched
        matched_inv1_indices = set()
        matched_inv2_indices = set()
        
        # Phase 1: Exact part number matches
        print("Phase 1: Exact part number matching...")
        for i, item1 in enumerate(self.inventory1_data):
            for j, item2 in enumerate(self.inventory2_data):
                if i in matched_inv1_indices or j in matched_inv2_indices:
                    continue
                    
                if item1['Part_Number'] and item2['Part_Number'] and item1['Part_Number'] == item2['Part_Number']:
                    self.matched_items.append({
                        'Match_Type': 'Exact Part Number',
                        'Match_Score': 1.0,
                        'Inventory1_Source': item1['Source'],
                        'Inventory1_Part_Number': item1['Original_Part_Number'],
                        'Inventory1_Description': item1['Original_Description'],
                        'Inventory1_Quantity': item1['Quantity'],
                        'Inventory1_Location': item1['Location'],
                        'Inventory2_Source': item2['Source'],
                        'Inventory2_Part_Number': item2['Original_Part_Number'],
                        'Inventory2_Description': item2['Original_Description'],
                        'Inventory2_Quantity': item2['Quantity'],
                        'Inventory2_Location': item2['Location'],
                        'Inventory2_Cost': item2.get('Cost', ''),
                        'Inventory2_Value': item2.get('Value', '')
                    })
                    matched_inv1_indices.add(i)
                    matched_inv2_indices.add(j)
                    break
        
        print(f"Found {len(self.matched_items)} exact part number matches")
        
        # Phase 2: Fuzzy description matching for unmatched items
        print("Phase 2: Fuzzy description matching...")
        description_threshold = 0.75  # Minimum similarity score for description matching
        
        for i, item1 in enumerate(self.inventory1_data):
            if i in matched_inv1_indices:
                continue
                
            best_match = None
            best_score = 0.0
            best_j = -1
            
            for j, item2 in enumerate(self.inventory2_data):
                if j in matched_inv2_indices:
                    continue
                
                # Calculate description similarity
                desc_score = self.similarity_score(item1['Description'], item2['Description'])
                
                if desc_score > best_score and desc_score >= description_threshold:
                    best_score = desc_score
                    best_match = item2
                    best_j = j
            
            if best_match:
                self.matched_items.append({
                    'Match_Type': 'Fuzzy Description',
                    'Match_Score': best_score,
                    'Inventory1_Source': item1['Source'],
                    'Inventory1_Part_Number': item1['Original_Part_Number'],
                    'Inventory1_Description': item1['Original_Description'],
                    'Inventory1_Quantity': item1['Quantity'],
                    'Inventory1_Location': item1['Location'],
                    'Inventory2_Source': best_match['Source'],
                    'Inventory2_Part_Number': best_match['Original_Part_Number'],
                    'Inventory2_Description': best_match['Original_Description'],
                    'Inventory2_Quantity': best_match['Quantity'],
                    'Inventory2_Location': best_match['Location'],
                    'Inventory2_Cost': best_match.get('Cost', ''),
                    'Inventory2_Value': best_match.get('Value', '')
                })
                matched_inv1_indices.add(i)
                matched_inv2_indices.add(best_j)
        
        print(f"Found {len(self.matched_items) - len([m for m in self.matched_items if m['Match_Type'] == 'Exact Part Number'])} additional fuzzy description matches")
        
        # Collect unmatched items
        for i, item1 in enumerate(self.inventory1_data):
            if i not in matched_inv1_indices:
                self.unmatched_inventory1.append(item1)
        
        for j, item2 in enumerate(self.inventory2_data):
            if j not in matched_inv2_indices:
                self.unmatched_inventory2.append(item2)
        
        print(f"Total matches found: {len(self.matched_items)}")
        print(f"Unmatched items in Inventory 1: {len(self.unmatched_inventory1)}")
        print(f"Unmatched items in Inventory 2: {len(self.unmatched_inventory2)}")
    
    def export_results(self):
        """Export results to Excel files"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Export matched items
        if self.matched_items:
            df_matched = pd.DataFrame(self.matched_items)
            matched_filename = f"Matched_Inventory_{timestamp}.xlsx"
            df_matched.to_excel(matched_filename, index=False)
            print(f"Matched inventory exported to: {matched_filename}")
        
        # Export unmatched items
        unmatched_filename = f"Unmatched_Inventory_{timestamp}.xlsx"
        
        with pd.ExcelWriter(unmatched_filename) as writer:
            if self.unmatched_inventory1:
                df_unmatched1 = pd.DataFrame(self.unmatched_inventory1)
                df_unmatched1.to_excel(writer, sheet_name='Unmatched_Inventory1', index=False)
            
            if self.unmatched_inventory2:
                df_unmatched2 = pd.DataFrame(self.unmatched_inventory2)
                df_unmatched2.to_excel(writer, sheet_name='Unmatched_Inventory2', index=False)
        
        print(f"Unmatched inventory exported to: {unmatched_filename}")
        
        # Print summary statistics
        print("\n" + "="*60)
        print("INVENTORY MAPPING SUMMARY")
        print("="*60)
        print(f"Total items in Inventory 1: {len(self.inventory1_data)}")
        print(f"Total items in Inventory 2: {len(self.inventory2_data)}")
        print(f"Total matches found: {len(self.matched_items)}")
        print(f"  - Exact part number matches: {len([m for m in self.matched_items if m['Match_Type'] == 'Exact Part Number'])}")
        print(f"  - Fuzzy description matches: {len([m for m in self.matched_items if m['Match_Type'] == 'Fuzzy Description'])}")
        print(f"Unmatched items in Inventory 1: {len(self.unmatched_inventory1)}")
        print(f"Unmatched items in Inventory 2: {len(self.unmatched_inventory2)}")
        print(f"\nMatch rate: {len(self.matched_items)}/{len(self.inventory1_data) + len(self.inventory2_data)} ({(len(self.matched_items) / (len(self.inventory1_data) + len(self.inventory2_data)) * 100):.1f}%)")

def main():
    mapper = InventoryMapper()
    
    # Load both inventories
    mapper.load_inventory1("Parts Inventory 2025.2 (1).xlsx")
    mapper.load_inventory2("ZZ110-SparePartsInventory-09-18-2025.xls")
    
    # Find matches
    mapper.find_matches()
    
    # Export results
    mapper.export_results()

if __name__ == "__main__":
    main()

