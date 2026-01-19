#!/usr/bin/env python3
"""
Manufacturer Part Number Matching Script
Matches Inv1_Manufacturer_Part_Number against Inv2_Description and Inv2_Item_Desc1
"""

import pandas as pd
import numpy as np
from difflib import SequenceMatcher
import re
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

class ManufacturerPartMatcher:
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
        
        # Remove common prefixes/suffixes and special characters but keep alphanumeric and dashes
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
    
    def contains_part_number(self, part_num, description):
        """Check if part number is contained within description"""
        if not part_num or not description:
            return False
        
        # Clean both strings
        clean_part = self.clean_part_number(part_num)
        clean_desc = self.clean_description(description)
        
        if not clean_part or not clean_desc:
            return False
        
        # Check if part number is contained in description
        return clean_part in clean_desc
    
    def load_inventory1(self, file_path):
        """Load data from Inventory-1.xlsx"""
        print("Loading Inventory-1.xlsx...")
        
        df = pd.read_excel(file_path, sheet_name='Inventory')
        
        for _, row in df.iterrows():
            manufacturer_part = row.get('Manufacturer Part #', '')
            
            # Only include items that have a manufacturer part number
            if pd.notna(manufacturer_part) and str(manufacturer_part).strip():
                self.inventory1_data.append({
                    'Source': 'Inventory-1',
                    'Name': row.get('Name', ''),
                    'CRC_Part_Number': row.get('CRC Part #', ''),
                    'Manufacturer_Part_Number': manufacturer_part,
                    'Manufacturer': row.get('Manufacturer', ''),
                    'Description': row.get('Description', ''),
                    'Location': row.get('Location', ''),
                    'Quantity': row.get('Quantity', ''),
                    'Min_Quantity': row.get('Min Quantity', ''),
                    'Cost': row.get('Cost', ''),
                    'Last_Ordered': row.get('Last Ordered', ''),
                    'Notes': row.get('Notes', ''),
                    'Status': row.get('Status', '')
                })
                
        print(f"Loaded {len(self.inventory1_data)} items with manufacturer part numbers from Inventory-1")
    
    def load_inventory2(self, file_path):
        """Load data from inventory-2.xls"""
        print("Loading inventory-2.xls...")
        
        # Load with proper header handling
        df = pd.read_excel(file_path, sheet_name='Sheet1', skiprows=2)
        
        for _, row in df.iterrows():
            item_numb = row.get('ITEM_NUMB', '')
            if pd.notna(item_numb) and str(item_numb).strip() and str(item_numb).strip() != 'ITEM_NUMB':
                # Combine ITEM_DESC1 and ITEM_DESC2 for full description
                desc1 = str(row.get('ITEM_DESC1', '')) if pd.notna(row.get('ITEM_DESC1', '')) else ''
                desc2 = str(row.get('ITEM_DESC2', '')) if pd.notna(row.get('ITEM_DESC2', '')) else ''
                full_desc = (desc1 + ' ' + desc2).strip()
                
                self.inventory2_data.append({
                    'Source': 'Inventory-2',
                    'Original_Part_Number': item_numb,
                    'Original_Description': full_desc,
                    'Item_Desc1': desc1,
                    'Item_Desc2': desc2,
                    'Kind_Desc': row.get('KIND_DESC', ''),
                    'Location': row.get('LOC', ''),
                    'Warehouse': row.get('WHSE', ''),
                    'Quantity': row.get('OnHandQuantity', ''),
                    'Cost': row.get('Cost', ''),
                    'Value': row.get('Value', '')
                })
                
        print(f"Loaded {len(self.inventory2_data)} items from Inventory-2")
    
    def find_manufacturer_part_matches(self):
        """Find matches between Inv1_Manufacturer_Part_Number and Inv2_Description/Item_Desc1"""
        print("Finding matches between Manufacturer Part Numbers and Descriptions...")
        
        # Track which items have been matched
        matched_inv1_indices = set()
        matched_inv2_indices = set()
        
        # Phase 1: Exact matches - manufacturer part number contained in descriptions
        print("Phase 1: Exact containment matching...")
        for i, item1 in enumerate(self.inventory1_data):
            for j, item2 in enumerate(self.inventory2_data):
                if i in matched_inv1_indices or j in matched_inv2_indices:
                    continue
                
                manufacturer_part = item1['Manufacturer_Part_Number']
                
                # Check if manufacturer part number is contained in any of the description fields
                match_found = False
                match_field = ""
                
                if self.contains_part_number(manufacturer_part, item2['Original_Description']):
                    match_found = True
                    match_field = "Full Description"
                elif self.contains_part_number(manufacturer_part, item2['Item_Desc1']):
                    match_found = True
                    match_field = "Item_Desc1"
                elif self.contains_part_number(manufacturer_part, item2['Item_Desc2']):
                    match_found = True
                    match_field = "Item_Desc2"
                
                if match_found:
                    self.matched_items.append(self._create_match_record('Exact Containment', 1.0, item1, item2, match_field))
                    matched_inv1_indices.add(i)
                    matched_inv2_indices.add(j)
                    break
        
        print(f"Found {len(self.matched_items)} exact containment matches")
        
        # Phase 2: Fuzzy similarity matching
        print("Phase 2: Fuzzy similarity matching...")
        similarity_threshold = 0.8  # High threshold for manufacturer part numbers
        
        for i, item1 in enumerate(self.inventory1_data):
            if i in matched_inv1_indices:
                continue
                
            best_match = None
            best_score = 0.0
            best_j = -1
            best_field = ""
            
            manufacturer_part_clean = self.clean_part_number(item1['Manufacturer_Part_Number'])
            
            for j, item2 in enumerate(self.inventory2_data):
                if j in matched_inv2_indices:
                    continue
                
                # Test similarity against different description fields
                desc_fields = [
                    ('Full Description', item2['Original_Description']),
                    ('Item_Desc1', item2['Item_Desc1']),
                    ('Item_Desc2', item2['Item_Desc2'])
                ]
                
                for field_name, desc_value in desc_fields:
                    if not desc_value:
                        continue
                    
                    desc_clean = self.clean_description(desc_value)
                    
                    # Calculate similarity score
                    score = self.similarity_score(manufacturer_part_clean, desc_clean)
                    
                    # Also check if manufacturer part is a substring of description
                    if manufacturer_part_clean in desc_clean:
                        score = max(score, 0.9)  # Boost score for substring matches
                    
                    if score > best_score and score >= similarity_threshold:
                        best_score = score
                        best_match = item2
                        best_j = j
                        best_field = field_name
            
            if best_match:
                self.matched_items.append(self._create_match_record('Fuzzy Similarity', best_score, item1, best_match, best_field))
                matched_inv1_indices.add(i)
                matched_inv2_indices.add(best_j)
        
        fuzzy_matches = len(self.matched_items) - len([m for m in self.matched_items if m['Match_Type'] == 'Exact Containment'])
        print(f"Found {fuzzy_matches} additional fuzzy similarity matches")
        
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
    
    def _create_match_record(self, match_type, score, item1, item2, match_field):
        """Helper method to create a standardized match record"""
        # Calculate total dollar amount: Inv1_Quantity × Inv2_Cost
        inv1_qty = item1['Quantity']
        inv2_cost = item2['Cost']
        
        # Handle different data types and convert to numbers
        try:
            if pd.isna(inv1_qty) or inv1_qty == '':
                qty_num = 0
            else:
                qty_num = float(str(inv1_qty).replace(',', ''))
        except (ValueError, TypeError):
            qty_num = 0
        
        try:
            if pd.isna(inv2_cost) or inv2_cost == '':
                cost_num = 0
            else:
                cost_num = float(str(inv2_cost).replace(',', '').replace('$', ''))
        except (ValueError, TypeError):
            cost_num = 0
        
        total_dollar_amount = qty_num * cost_num
        
        return {
            'Match_Type': match_type,
            'Match_Score': score,
            'Match_Field': match_field,
            # Inventory 1 data
            'Inv1_Name': item1['Name'],
            'Inv1_CRC_Part_Number': item1['CRC_Part_Number'],
            'Inv1_Manufacturer_Part_Number': item1['Manufacturer_Part_Number'],
            'Inv1_Manufacturer': item1['Manufacturer'],
            'Inv1_Description': item1['Description'],
            'Inv1_Quantity': item1['Quantity'],
            'Inv1_Cost': item1['Cost'],
            # Inventory 2 data
            'Inv2_Part_Number': item2['Original_Part_Number'],
            'Inv2_Description': item2['Original_Description'],
            'Inv2_Item_Desc1': item2['Item_Desc1'],
            'Inv2_Item_Desc2': item2['Item_Desc2'],
            'Inv2_Kind_Desc': item2['Kind_Desc'],
            'Inv2_Quantity': item2['Quantity'],
            'Inv2_Cost': item2['Cost'],
            'Inv2_Value': item2['Value'],
            # Calculated fields
            'Total_Dollar_Amount': total_dollar_amount
        }
    
    def export_results(self):
        """Export results to Excel files with separate sheets for exact and fuzzy matches"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Export matched items with separate sheets
        if self.matched_items:
            df_all_matched = pd.DataFrame(self.matched_items)
            matched_filename = f"Manufacturer_Part_Matched_with_Totals_{timestamp}.xlsx"
            
            # Separate exact and fuzzy matches
            df_exact = df_all_matched[df_all_matched['Match_Type'] == 'Exact Containment'].copy()
            df_fuzzy = df_all_matched[df_all_matched['Match_Type'] == 'Fuzzy Similarity'].copy()
            
            # Reorder columns to show the requested fields plus total dollar amount
            column_order = [
                'Inv1_Name',
                'Inv1_CRC_Part_Number',
                'Inv1_Manufacturer_Part_Number',
                'Inv1_Manufacturer',
                'Inv1_Description',
                'Inv1_Quantity',
                'Inv1_Cost',
                'Inv2_Part_Number',
                'Inv2_Description',
                'Inv2_Item_Desc1',
                'Inv2_Item_Desc2',
                'Inv2_Kind_Desc',
                'Inv2_Quantity',
                'Inv2_Cost',
                'Inv2_Value',
                'Total_Dollar_Amount',
                'Match_Type',
                'Match_Score',
                'Match_Field'
            ]
            
            with pd.ExcelWriter(matched_filename) as writer:
                if len(df_exact) > 0:
                    df_exact_ordered = df_exact.reindex(columns=column_order)
                    df_exact_ordered.to_excel(writer, sheet_name='Exact_Matches', index=False)
                    
                    # Add summary row for exact matches
                    total_exact_value = df_exact['Total_Dollar_Amount'].sum()
                    summary_row = pd.DataFrame({
                        'Inv1_Name': ['TOTAL EXACT MATCHES'],
                        'Total_Dollar_Amount': [total_exact_value]
                    })
                    summary_row.to_excel(writer, sheet_name='Exact_Matches', 
                                       startrow=len(df_exact) + 2, index=False, header=False)
                
                if len(df_fuzzy) > 0:
                    df_fuzzy_ordered = df_fuzzy.reindex(columns=column_order)
                    df_fuzzy_ordered.to_excel(writer, sheet_name='Fuzzy_Matches', index=False)
                    
                    # Add summary row for fuzzy matches
                    total_fuzzy_value = df_fuzzy['Total_Dollar_Amount'].sum()
                    summary_row = pd.DataFrame({
                        'Inv1_Name': ['TOTAL FUZZY MATCHES'],
                        'Total_Dollar_Amount': [total_fuzzy_value]
                    })
                    summary_row.to_excel(writer, sheet_name='Fuzzy_Matches', 
                                       startrow=len(df_fuzzy) + 2, index=False, header=False)
                
                # Create summary sheet
                total_all_value = df_all_matched['Total_Dollar_Amount'].sum()
                summary_data = {
                    'Match_Type': ['Exact Containment', 'Fuzzy Similarity', 'GRAND TOTAL'],
                    'Count': [len(df_exact), len(df_fuzzy), len(df_all_matched)],
                    'Total_Dollar_Amount': [
                        df_exact['Total_Dollar_Amount'].sum() if len(df_exact) > 0 else 0,
                        df_fuzzy['Total_Dollar_Amount'].sum() if len(df_fuzzy) > 0 else 0,
                        total_all_value
                    ]
                }
                df_summary = pd.DataFrame(summary_data)
                df_summary.to_excel(writer, sheet_name='Summary', index=False)
            
            print(f"Manufacturer part matched inventory with totals exported to: {matched_filename}")
        
        # Export unmatched items
        unmatched_filename = f"Manufacturer_Part_Unmatched_{timestamp}.xlsx"
        
        with pd.ExcelWriter(unmatched_filename) as writer:
            if self.unmatched_inventory1:
                df_unmatched1 = pd.DataFrame(self.unmatched_inventory1)
                df_unmatched1.to_excel(writer, sheet_name='Unmatched_Inventory1', index=False)
            
            if self.unmatched_inventory2:
                df_unmatched2 = pd.DataFrame(self.unmatched_inventory2)
                df_unmatched2.to_excel(writer, sheet_name='Unmatched_Inventory2', index=False)
        
        print(f"Manufacturer part unmatched inventory exported to: {unmatched_filename}")
        
        # Print summary statistics with dollar amounts
        if self.matched_items:
            df_all = pd.DataFrame(self.matched_items)
            exact_matches = df_all[df_all['Match_Type'] == 'Exact Containment']
            fuzzy_matches = df_all[df_all['Match_Type'] == 'Fuzzy Similarity']
            
            total_exact_value = exact_matches['Total_Dollar_Amount'].sum()
            total_fuzzy_value = fuzzy_matches['Total_Dollar_Amount'].sum()
            total_all_value = df_all['Total_Dollar_Amount'].sum()
        else:
            total_exact_value = total_fuzzy_value = total_all_value = 0
        
        print("\n" + "="*80)
        print("MANUFACTURER PART NUMBER MATCHING SUMMARY WITH DOLLAR TOTALS")
        print("="*80)
        print(f"Total items with manufacturer part numbers in Inventory-1: {len(self.inventory1_data)}")
        print(f"Total items in Inventory-2: {len(self.inventory2_data)}")
        print(f"Total matches found: {len(self.matched_items)}")
        print(f"  - Exact containment matches: {len([m for m in self.matched_items if m['Match_Type'] == 'Exact Containment'])} (${total_exact_value:,.2f})")
        print(f"  - Fuzzy similarity matches: {len([m for m in self.matched_items if m['Match_Type'] == 'Fuzzy Similarity'])} (${total_fuzzy_value:,.2f})")
        print(f"Unmatched items in Inventory-1: {len(self.unmatched_inventory1)}")
        print(f"Unmatched items in Inventory-2: {len(self.unmatched_inventory2)}")
        print(f"\nTOTAL DOLLAR VALUE OF ALL MATCHES: ${total_all_value:,.2f}")
        
        if len(self.inventory1_data) > 0:
            match_rate_inv1 = (len(self.matched_items) / len(self.inventory1_data)) * 100
            print(f"\nMatch rate (Inventory-1 perspective): {len(self.matched_items)}/{len(self.inventory1_data)} ({match_rate_inv1:.1f}%)")

def main():
    matcher = ManufacturerPartMatcher()
    
    # Load both inventories
    matcher.load_inventory1("Inventory-1.xlsx")
    matcher.load_inventory2("inventory-2.xls")
    
    # Find matches based on manufacturer part numbers
    matcher.find_manufacturer_part_matches()
    
    # Export results
    matcher.export_results()

if __name__ == "__main__":
    main()
