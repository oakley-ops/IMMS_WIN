#!/usr/bin/env python3
"""
Inventory Matcher for Unmatched Items
Checks new inventory against previously unmatched items to find additional matches.
"""

import pandas as pd
import numpy as np
from difflib import SequenceMatcher
import re
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

class UnmatchedInventoryMatcher:
    def __init__(self):
        self.new_inventory_data = []
        self.unmatched_inventory1_data = []
        self.unmatched_inventory2_data = []
        self.new_matches = []
        self.still_unmatched_new = []
        self.still_unmatched_inv1 = []
        self.still_unmatched_inv2 = []
        
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
    
    def load_new_inventory(self, file_path):
        """Load data from Copy of Inventory list company.xlsx"""
        print(f"Loading new inventory: {file_path}")
        
        # Load the inventory with proper column handling
        df = pd.read_excel(file_path, sheet_name='Sheet1', skiprows=2)
        
        # Set proper column names based on the first row which contains headers
        if not df.empty:
            # Use the first row as column names if it contains 'ITEM_NUMB'
            if 'ITEM_NUMB' in str(df.iloc[0]).upper():
                # Extract column names from first row
                new_columns = []
                for i, col_val in enumerate(df.iloc[0]):
                    if pd.notna(col_val) and str(col_val).strip():
                        new_columns.append(str(col_val).strip())
                    else:
                        new_columns.append(f'Col{i}')
                
                # Set new column names and drop the header row
                df.columns = new_columns[:len(df.columns)]
                df = df.drop(df.index[0]).reset_index(drop=True)
        
        # If we still don't have proper columns, set them manually
        if 'ITEM_NUMB' not in df.columns:
            df.columns = ['ITEM_NUMB', 'ITEM_DESC1', 'ITEM_DESC2', 'KIND_DESC', 'LOC', 'WHSE', 'OnHandQuantity'] + [f'Col{i}' for i in range(7, len(df.columns))]
        
        print(f"Columns found: {df.columns.tolist()}")
        
        for _, row in df.iterrows():
            if pd.notna(row.get('ITEM_NUMB')) and str(row.get('ITEM_NUMB')).strip():
                # Skip if it's still a header row
                if str(row.get('ITEM_NUMB')).strip().upper() == 'ITEM_NUMB':
                    continue
                    
                desc1 = str(row.get('ITEM_DESC1', '')) if pd.notna(row.get('ITEM_DESC1')) else ''
                desc2 = str(row.get('ITEM_DESC2', '')) if pd.notna(row.get('ITEM_DESC2')) else ''
                combined_desc = (desc1 + ' ' + desc2).strip()
                
                self.new_inventory_data.append({
                    'Source': 'Copy of Inventory List Company',
                    'Part_Number': self.clean_part_number(row.get('ITEM_NUMB')),
                    'Description': self.clean_description(combined_desc),
                    'Original_Part_Number': row.get('ITEM_NUMB'),
                    'Original_Description': combined_desc,
                    'Quantity': row.get('OnHandQuantity', ''),
                    'Location': row.get('LOC', ''),
                    'Warehouse': row.get('WHSE', ''),
                    'Kind_Desc': row.get('KIND_DESC', '')
                })
                
        print(f"Loaded {len(self.new_inventory_data)} items from new inventory")
    
    def load_unmatched_inventories(self, unmatched_file_path):
        """Load previously unmatched inventory data"""
        print(f"Loading unmatched inventories: {unmatched_file_path}")
        
        # Load unmatched inventory 1
        try:
            df_unmatched1 = pd.read_excel(unmatched_file_path, sheet_name='Unmatched_Inventory1')
            self.unmatched_inventory1_data = df_unmatched1.to_dict('records')
            print(f"Loaded {len(self.unmatched_inventory1_data)} unmatched items from Inventory 1")
        except Exception as e:
            print(f"Error loading Unmatched_Inventory1: {e}")
        
        # Load unmatched inventory 2
        try:
            df_unmatched2 = pd.read_excel(unmatched_file_path, sheet_name='Unmatched_Inventory2')
            self.unmatched_inventory2_data = df_unmatched2.to_dict('records')
            print(f"Loaded {len(self.unmatched_inventory2_data)} unmatched items from Inventory 2")
        except Exception as e:
            print(f"Error loading Unmatched_Inventory2: {e}")
    
    def find_matches(self):
        """Find matches between new inventory and previously unmatched items"""
        print("Finding matches between new inventory and unmatched items...")
        
        # Track which items have been matched
        matched_new_indices = set()
        matched_inv1_indices = set()
        matched_inv2_indices = set()
        
        # Phase 1: Check new inventory against unmatched inventory 1
        print("Phase 1: Matching against unmatched Inventory 1...")
        for i, new_item in enumerate(self.new_inventory_data):
            for j, unmatched_item in enumerate(self.unmatched_inventory1_data):
                if i in matched_new_indices or j in matched_inv1_indices:
                    continue
                
                # Try exact part number match first
                if (new_item['Part_Number'] and 
                    unmatched_item.get('Part_Number') and 
                    new_item['Part_Number'] == self.clean_part_number(unmatched_item.get('Part_Number'))):
                    
                    self.new_matches.append({
                        'Match_Type': 'Exact Part Number (New vs Unmatched Inv1)',
                        'Match_Score': 1.0,
                        'New_Inventory_Source': new_item['Source'],
                        'New_Inventory_Part_Number': new_item['Original_Part_Number'],
                        'New_Inventory_Description': new_item['Original_Description'],
                        'New_Inventory_Quantity': new_item['Quantity'],
                        'New_Inventory_Location': new_item['Location'],
                        'Unmatched_Source': unmatched_item.get('Source', ''),
                        'Unmatched_Part_Number': unmatched_item.get('Original_Part_Number', ''),
                        'Unmatched_Description': unmatched_item.get('Original_Description', ''),
                        'Unmatched_Quantity': unmatched_item.get('Quantity', ''),
                        'Unmatched_Location': unmatched_item.get('Location', '')
                    })
                    matched_new_indices.add(i)
                    matched_inv1_indices.add(j)
                    continue
                
                # Try fuzzy description match
                desc_score = self.similarity_score(new_item['Description'], 
                                                 self.clean_description(unmatched_item.get('Original_Description', '')))
                
                if desc_score >= 0.75:  # 75% similarity threshold
                    self.new_matches.append({
                        'Match_Type': 'Fuzzy Description (New vs Unmatched Inv1)',
                        'Match_Score': desc_score,
                        'New_Inventory_Source': new_item['Source'],
                        'New_Inventory_Part_Number': new_item['Original_Part_Number'],
                        'New_Inventory_Description': new_item['Original_Description'],
                        'New_Inventory_Quantity': new_item['Quantity'],
                        'New_Inventory_Location': new_item['Location'],
                        'Unmatched_Source': unmatched_item.get('Source', ''),
                        'Unmatched_Part_Number': unmatched_item.get('Original_Part_Number', ''),
                        'Unmatched_Description': unmatched_item.get('Original_Description', ''),
                        'Unmatched_Quantity': unmatched_item.get('Quantity', ''),
                        'Unmatched_Location': unmatched_item.get('Location', '')
                    })
                    matched_new_indices.add(i)
                    matched_inv1_indices.add(j)
        
        # Phase 2: Check remaining new inventory against unmatched inventory 2
        print("Phase 2: Matching against unmatched Inventory 2...")
        for i, new_item in enumerate(self.new_inventory_data):
            if i in matched_new_indices:
                continue
                
            for j, unmatched_item in enumerate(self.unmatched_inventory2_data):
                if j in matched_inv2_indices:
                    continue
                
                # Try exact part number match first
                if (new_item['Part_Number'] and 
                    unmatched_item.get('Part_Number') and 
                    new_item['Part_Number'] == self.clean_part_number(unmatched_item.get('Part_Number'))):
                    
                    self.new_matches.append({
                        'Match_Type': 'Exact Part Number (New vs Unmatched Inv2)',
                        'Match_Score': 1.0,
                        'New_Inventory_Source': new_item['Source'],
                        'New_Inventory_Part_Number': new_item['Original_Part_Number'],
                        'New_Inventory_Description': new_item['Original_Description'],
                        'New_Inventory_Quantity': new_item['Quantity'],
                        'New_Inventory_Location': new_item['Location'],
                        'Unmatched_Source': unmatched_item.get('Source', ''),
                        'Unmatched_Part_Number': unmatched_item.get('Original_Part_Number', ''),
                        'Unmatched_Description': unmatched_item.get('Original_Description', ''),
                        'Unmatched_Quantity': unmatched_item.get('Quantity', ''),
                        'Unmatched_Location': unmatched_item.get('Location', ''),
                        'Unmatched_Cost': unmatched_item.get('Cost', ''),
                        'Unmatched_Value': unmatched_item.get('Value', '')
                    })
                    matched_new_indices.add(i)
                    matched_inv2_indices.add(j)
                    continue
                
                # Try fuzzy description match
                desc_score = self.similarity_score(new_item['Description'], 
                                                 self.clean_description(unmatched_item.get('Original_Description', '')))
                
                if desc_score >= 0.75:  # 75% similarity threshold
                    self.new_matches.append({
                        'Match_Type': 'Fuzzy Description (New vs Unmatched Inv2)',
                        'Match_Score': desc_score,
                        'New_Inventory_Source': new_item['Source'],
                        'New_Inventory_Part_Number': new_item['Original_Part_Number'],
                        'New_Inventory_Description': new_item['Original_Description'],
                        'New_Inventory_Quantity': new_item['Quantity'],
                        'New_Inventory_Location': new_item['Location'],
                        'Unmatched_Source': unmatched_item.get('Source', ''),
                        'Unmatched_Part_Number': unmatched_item.get('Original_Part_Number', ''),
                        'Unmatched_Description': unmatched_item.get('Original_Description', ''),
                        'Unmatched_Quantity': unmatched_item.get('Quantity', ''),
                        'Unmatched_Location': unmatched_item.get('Location', ''),
                        'Unmatched_Cost': unmatched_item.get('Cost', ''),
                        'Unmatched_Value': unmatched_item.get('Value', '')
                    })
                    matched_new_indices.add(i)
                    matched_inv2_indices.add(j)
        
        # Collect still unmatched items
        for i, item in enumerate(self.new_inventory_data):
            if i not in matched_new_indices:
                self.still_unmatched_new.append(item)
        
        for j, item in enumerate(self.unmatched_inventory1_data):
            if j not in matched_inv1_indices:
                self.still_unmatched_inv1.append(item)
        
        for j, item in enumerate(self.unmatched_inventory2_data):
            if j not in matched_inv2_indices:
                self.still_unmatched_inv2.append(item)
        
        print(f"Found {len(self.new_matches)} new matches!")
        print(f"Still unmatched from new inventory: {len(self.still_unmatched_new)}")
        print(f"Still unmatched from Inventory 1: {len(self.still_unmatched_inv1)}")
        print(f"Still unmatched from Inventory 2: {len(self.still_unmatched_inv2)}")
    
    def export_results(self):
        """Export results to Excel files"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Export new matches
        if self.new_matches:
            df_new_matches = pd.DataFrame(self.new_matches)
            new_matches_filename = f"New_Matches_Found_{timestamp}.xlsx"
            df_new_matches.to_excel(new_matches_filename, index=False)
            print(f"New matches exported to: {new_matches_filename}")
        
        # Export updated unmatched items
        updated_unmatched_filename = f"Updated_Unmatched_Inventory_{timestamp}.xlsx"
        
        with pd.ExcelWriter(updated_unmatched_filename) as writer:
            if self.still_unmatched_new:
                df_unmatched_new = pd.DataFrame(self.still_unmatched_new)
                df_unmatched_new.to_excel(writer, sheet_name='Still_Unmatched_New', index=False)
            
            if self.still_unmatched_inv1:
                df_unmatched1 = pd.DataFrame(self.still_unmatched_inv1)
                df_unmatched1.to_excel(writer, sheet_name='Still_Unmatched_Inv1', index=False)
            
            if self.still_unmatched_inv2:
                df_unmatched2 = pd.DataFrame(self.still_unmatched_inv2)
                df_unmatched2.to_excel(writer, sheet_name='Still_Unmatched_Inv2', index=False)
        
        print(f"Updated unmatched inventory exported to: {updated_unmatched_filename}")
        
        # Print summary statistics
        print("\n" + "="*60)
        print("NEW INVENTORY MATCHING SUMMARY")
        print("="*60)
        print(f"Items in new inventory: {len(self.new_inventory_data)}")
        print(f"Items in unmatched inventory 1: {len(self.unmatched_inventory1_data)}")
        print(f"Items in unmatched inventory 2: {len(self.unmatched_inventory2_data)}")
        print(f"NEW MATCHES FOUND: {len(self.new_matches)}")
        
        if self.new_matches:
            exact_matches = len([m for m in self.new_matches if 'Exact Part Number' in m['Match_Type']])
            fuzzy_matches = len([m for m in self.new_matches if 'Fuzzy Description' in m['Match_Type']])
            print(f"  - Exact part number matches: {exact_matches}")
            print(f"  - Fuzzy description matches: {fuzzy_matches}")
        
        print(f"Still unmatched from new inventory: {len(self.still_unmatched_new)}")
        print(f"Still unmatched from Inventory 1: {len(self.still_unmatched_inv1)}")
        print(f"Still unmatched from Inventory 2: {len(self.still_unmatched_inv2)}")

def main():
    matcher = UnmatchedInventoryMatcher()
    
    # Load new inventory
    matcher.load_new_inventory("Copy of Inventory list company.xlsx")
    
    # Load previously unmatched inventories
    matcher.load_unmatched_inventories("Unmatched_Inventory_20250919_102047.xlsx")
    
    # Find matches
    matcher.find_matches()
    
    # Export results
    matcher.export_results()

if __name__ == "__main__":
    main()
