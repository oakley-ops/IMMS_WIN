#!/usr/bin/env python3
"""
Comprehensive Inventory Matcher
Runs fresh comparison between ZZ110-SparePartsInventory and Parts Inventory 2025 files
for maximum accuracy
"""

import pandas as pd
import numpy as np
from difflib import SequenceMatcher
import re
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

class ComprehensiveInventoryMatcher:
    def __init__(self):
        self.inventory1_data = []  # Parts Inventory 2025
        self.inventory2_data = []  # ZZ110 Spare Parts
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
    
    def load_parts_inventory_2025(self, file_path):
        """Load data from Parts Inventory 2025.2 (1).xlsx"""
        print(f"Loading Parts Inventory 2025: {file_path}")
        
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
            
        print(f"Loaded {len(self.inventory1_data)} items from Parts Inventory 2025")
    
    def load_zz110_inventory(self, file_path):
        """Load data from ZZ110-SparePartsInventory-09-18-2025.xls"""
        print(f"Loading ZZ110 Spare Parts Inventory: {file_path}")
        
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
                
        print(f"Loaded {len(self.inventory2_data)} items from ZZ110 Inventory")
    
    def find_matches_comprehensive(self):
        """Find matches between the two inventories with enhanced accuracy"""
        print("Finding matches with comprehensive accuracy checks...")
        
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
        
        # Phase 2: Enhanced fuzzy description matching
        print("Phase 2: Enhanced fuzzy description matching...")
        description_thresholds = [0.90, 0.85, 0.80, 0.75]  # Multiple threshold levels
        
        for threshold in description_thresholds:
            matches_this_round = 0
            
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
                    
                    # Additional checks for better accuracy
                    # Check if key words match
                    desc1_words = set(item1['Description'].split())
                    desc2_words = set(item2['Description'].split())
                    common_words = desc1_words & desc2_words
                    word_bonus = len(common_words) / max(len(desc1_words), len(desc2_words), 1) * 0.1
                    
                    # Adjusted score with word bonus
                    adjusted_score = min(1.0, desc_score + word_bonus)
                    
                    if adjusted_score > best_score and adjusted_score >= threshold:
                        best_score = adjusted_score
                        best_match = item2
                        best_j = j
                
                if best_match and best_score >= threshold:
                    self.matched_items.append({
                        'Match_Type': f'Fuzzy Description (≥{threshold*100:.0f}%)',
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
                    matches_this_round += 1
            
            print(f"  Threshold {threshold*100:.0f}%: Found {matches_this_round} additional matches")
        
        # Phase 3: Alternative part number matching (for Cabinet items)
        print("Phase 3: Alternative part number matching...")
        alt_matches = 0
        for i, item1 in enumerate(self.inventory1_data):
            if i in matched_inv1_indices:
                continue
            
            alt_part = item1.get('Alt_Part_Number', '')
            if not alt_part or pd.isna(alt_part):
                continue
                
            cleaned_alt = self.clean_part_number(alt_part)
            if not cleaned_alt:
                continue
                
            for j, item2 in enumerate(self.inventory2_data):
                if j in matched_inv2_indices:
                    continue
                    
                if cleaned_alt == item2['Part_Number']:
                    self.matched_items.append({
                        'Match_Type': 'Alternative Part Number',
                        'Match_Score': 1.0,
                        'Inventory1_Source': item1['Source'],
                        'Inventory1_Part_Number': item1['Original_Part_Number'],
                        'Inventory1_Description': item1['Original_Description'],
                        'Inventory1_Quantity': item1['Quantity'],
                        'Inventory1_Location': item1['Location'],
                        'Inventory1_Alt_Part': alt_part,
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
                    alt_matches += 1
                    break
        
        print(f"Found {alt_matches} alternative part number matches")
        
        # Collect unmatched items
        for i, item1 in enumerate(self.inventory1_data):
            if i not in matched_inv1_indices:
                self.unmatched_inventory1.append(item1)
        
        for j, item2 in enumerate(self.inventory2_data):
            if j not in matched_inv2_indices:
                self.unmatched_inventory2.append(item2)
        
        print(f"\nCOMPREHENSIVE MATCHING RESULTS:")
        print(f"Total matches found: {len(self.matched_items)}")
        print(f"Unmatched items in Parts Inventory 2025: {len(self.unmatched_inventory1)}")
        print(f"Unmatched items in ZZ110 Inventory: {len(self.unmatched_inventory2)}")
    
    def analyze_match_quality(self):
        """Analyze the quality and accuracy of matches"""
        print("\n" + "="*60)
        print("COMPREHENSIVE MATCH QUALITY ANALYSIS")
        print("="*60)
        
        # Overall statistics
        total_items = len(self.inventory1_data) + len(self.inventory2_data)
        match_rate = (len(self.matched_items) * 2) / total_items * 100
        
        print(f"Total items processed: {total_items:,}")
        print(f"Total matches found: {len(self.matched_items):,}")
        print(f"Overall match rate: {match_rate:.1f}%")
        
        # Break down by match type
        match_types = {}
        for match in self.matched_items:
            match_type = match['Match_Type']
            if match_type not in match_types:
                match_types[match_type] = []
            match_types[match_type].append(match['Match_Score'])
        
        print(f"\nMATCH TYPE BREAKDOWN:")
        for match_type, scores in match_types.items():
            count = len(scores)
            avg_score = np.mean(scores) if scores else 0
            print(f"  {match_type}: {count} matches (avg score: {avg_score:.3f})")
        
        # Quality distribution for fuzzy matches
        fuzzy_matches = [m for m in self.matched_items if 'Fuzzy' in m['Match_Type']]
        if fuzzy_matches:
            print(f"\nFUZZY MATCH QUALITY DISTRIBUTION:")
            scores = [m['Match_Score'] for m in fuzzy_matches]
            print(f"  Excellent (≥95%): {len([s for s in scores if s >= 0.95])}")
            print(f"  Very Good (85-94%): {len([s for s in scores if 0.85 <= s < 0.95])}")
            print(f"  Good (80-84%): {len([s for s in scores if 0.80 <= s < 0.85])}")
            print(f"  Fair (75-79%): {len([s for s in scores if 0.75 <= s < 0.80])}")
            print(f"  Average score: {np.mean(scores):.3f}")
            print(f"  Median score: {np.median(scores):.3f}")
    
    def export_results(self):
        """Export comprehensive results"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Export matched items
        if self.matched_items:
            df_matched = pd.DataFrame(self.matched_items)
            matched_filename = f"Comprehensive_Matched_Inventory_{timestamp}.xlsx"
            df_matched.to_excel(matched_filename, index=False)
            print(f"\nMatched inventory exported to: {matched_filename}")
        
        # Export unmatched items
        unmatched_filename = f"Comprehensive_Unmatched_Inventory_{timestamp}.xlsx"
        
        with pd.ExcelWriter(unmatched_filename) as writer:
            if self.unmatched_inventory1:
                df_unmatched1 = pd.DataFrame(self.unmatched_inventory1)
                df_unmatched1.to_excel(writer, sheet_name='Unmatched_Parts_Inventory_2025', index=False)
            
            if self.unmatched_inventory2:
                df_unmatched2 = pd.DataFrame(self.unmatched_inventory2)
                df_unmatched2.to_excel(writer, sheet_name='Unmatched_ZZ110_Inventory', index=False)
        
        print(f"Unmatched inventory exported to: {unmatched_filename}")
        
        return matched_filename, unmatched_filename

def main():
    matcher = ComprehensiveInventoryMatcher()
    
    # Load both inventories
    matcher.load_parts_inventory_2025("Parts Inventory 2025.2 (1).xlsx")
    matcher.load_zz110_inventory("ZZ110-SparePartsInventory-09-18-2025.xls")
    
    # Find matches with comprehensive accuracy
    matcher.find_matches_comprehensive()
    
    # Analyze match quality
    matcher.analyze_match_quality()
    
    # Export results
    matcher.export_results()

if __name__ == "__main__":
    main()
