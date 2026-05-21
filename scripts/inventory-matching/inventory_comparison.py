#!/usr/bin/env python3
"""
Inventory Comparison Script
Compares Inventory-1.xlsx with inventory-2.xls and creates a matched inventory sheet with prices.
"""

import pandas as pd
import numpy as np
from difflib import SequenceMatcher
import re
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

class InventoryComparison:
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
    
    def has_tbd_part_number(self, crc_part_num):
        """Check if CRC Part Number contains TBD (indicating temporary/placeholder number)"""
        if pd.isna(crc_part_num):
            return False
        return 'TBD' in str(crc_part_num).upper()
    
    def load_inventory1(self, file_path):
        """Load data from Inventory-1.xlsx"""
        print("Loading Inventory-1.xlsx...")
        
        df = pd.read_excel(file_path, sheet_name='Inventory')
        
        for _, row in df.iterrows():
            # Use CRC Part # as primary, fall back to Manufacturer Part # if CRC Part # is empty
            primary_part = row.get('CRC Part #', '')
            if pd.isna(primary_part) or not str(primary_part).strip():
                primary_part = row.get('Manufacturer Part #', '')
            
            if pd.notna(primary_part) and str(primary_part).strip():
                self.inventory1_data.append({
                    'Source': 'Inventory-1',
                    'Part_Number': self.clean_part_number(primary_part),
                    'Description': self.clean_description(row.get('Description', '')),
                    'Name': row.get('Name', ''),
                    'CRC_Part_Number': row.get('CRC Part #', ''),
                    'Manufacturer_Part_Number': row.get('Manufacturer Part #', ''),
                    'Manufacturer': row.get('Manufacturer', ''),
                    'Location': row.get('Location', ''),
                    'Quantity': row.get('Quantity', ''),
                    'Min_Quantity': row.get('Min Quantity', ''),
                    'Cost': row.get('Cost', ''),
                    'Last_Ordered': row.get('Last Ordered', ''),
                    'Notes': row.get('Notes', ''),
                    'Status': row.get('Status', ''),
                    'Has_TBD': self.has_tbd_part_number(row.get('CRC Part #', ''))
                })
                
        print(f"Loaded {len(self.inventory1_data)} items from Inventory-1")
    
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
                    'Part_Number': self.clean_part_number(item_numb),
                    'Description': self.clean_description(full_desc),
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
    
    def find_matches(self):
        """Find matches between the two inventories using enhanced multi-field matching"""
        print("Finding matches between inventories using enhanced multi-field matching...")
        
        # Track which items have been matched
        matched_inv1_indices = set()
        matched_inv2_indices = set()
        
        # Phase 1: Exact part number matches (excluding TBD parts)
        print("Phase 1: Exact part number matching (excluding TBD parts)...")
        for i, item1 in enumerate(self.inventory1_data):
            for j, item2 in enumerate(self.inventory2_data):
                if i in matched_inv1_indices or j in matched_inv2_indices:
                    continue
                
                # Skip items with TBD part numbers for exact matching
                if item1.get('Has_TBD', False):
                    continue
                    
                if item1['Part_Number'] and item2['Part_Number'] and item1['Part_Number'] == item2['Part_Number']:
                    self.matched_items.append(self._create_match_record('Exact Part Number', 1.0, item1, item2))
                    matched_inv1_indices.add(i)
                    matched_inv2_indices.add(j)
                    break
        
        print(f"Found {len(self.matched_items)} exact part number matches")
        
        # Phase 2: Fuzzy part number matching (partial matches, excluding TBD parts)
        print("Phase 2: Fuzzy part number matching (excluding TBD parts)...")
        part_threshold = 0.6  # Lower threshold for part number similarity
        
        for i, item1 in enumerate(self.inventory1_data):
            if i in matched_inv1_indices:
                continue
            
            # Skip items with TBD part numbers for fuzzy part number matching
            if item1.get('Has_TBD', False):
                continue
                
            best_match = None
            best_score = 0.0
            best_j = -1
            match_type = ""
            
            for j, item2 in enumerate(self.inventory2_data):
                if j in matched_inv2_indices:
                    continue
                
                # Try matching with different part number fields from inventory 1
                inv1_parts = [
                    self.clean_part_number(item1['CRC_Part_Number']),
                    self.clean_part_number(item1['Manufacturer_Part_Number'])
                ]
                
                # Try matching with inventory 2 part number
                inv2_part = item2['Part_Number']
                
                for inv1_part in inv1_parts:
                    if inv1_part and inv2_part:
                        part_score = self.similarity_score(inv1_part, inv2_part)
                        if part_score > best_score and part_score >= part_threshold:
                            best_score = part_score
                            best_match = item2
                            best_j = j
                            match_type = "Fuzzy Part Number"
            
            if best_match:
                self.matched_items.append(self._create_match_record(match_type, best_score, item1, best_match))
                matched_inv1_indices.add(i)
                matched_inv2_indices.add(best_j)
        
        fuzzy_part_matches = len(self.matched_items) - len([m for m in self.matched_items if m['Match_Type'] == 'Exact Part Number'])
        print(f"Found {fuzzy_part_matches} fuzzy part number matches")
        
        # Phase 3: Multi-field description matching for remaining unmatched items
        print("Phase 3: Multi-field description matching...")
        description_threshold = 0.8  # Much higher threshold for better accuracy and prevent false matches
        
        for i, item1 in enumerate(self.inventory1_data):
            if i in matched_inv1_indices:
                continue
                
            best_match = None
            best_score = 0.0
            best_j = -1
            match_details = ""
            
            for j, item2 in enumerate(self.inventory2_data):
                if j in matched_inv2_indices:
                    continue
                
                # Prepare inventory 1 text fields for comparison
                inv1_texts = [
                    self.clean_description(item1['Name']),
                    self.clean_description(item1['Description'])
                ]
                
                # Prepare inventory 2 text fields for comparison
                inv2_texts = [
                    self.clean_description(item2['Item_Desc1']),
                    self.clean_description(item2['Item_Desc2']),
                    self.clean_description(item2['Original_Description']),
                    self.clean_description(item2['Kind_Desc'])
                ]
                
                # Calculate multiple scoring methods and use the best
                max_score = 0.0
                best_combination = ""
                
                # Method 1: Direct string similarity
                for inv1_text in inv1_texts:
                    if not inv1_text:
                        continue
                    for inv2_text in inv2_texts:
                        if not inv2_text:
                            continue
                        
                        score = self.similarity_score(inv1_text, inv2_text)
                        if score > max_score:
                            max_score = score
                            best_combination = f"String similarity: {score:.3f}"
                
                # Method 2: Word overlap scoring (more lenient for similar parts)
                word_overlap_score = self._calculate_word_overlap_score(inv1_texts, inv2_texts)
                if word_overlap_score > max_score:
                    max_score = word_overlap_score
                    best_combination = f"Word overlap: {word_overlap_score:.3f}"
                
                # Method 3: Key word matching (prioritize exact matches of important terms)
                key_word_score = self._calculate_key_word_score(inv1_texts, inv2_texts)
                if key_word_score > max_score:
                    max_score = key_word_score
                    best_combination = f"Key word match: {key_word_score:.3f}"
                
                if max_score > best_score and max_score >= description_threshold:
                    best_score = max_score
                    best_match = item2
                    best_j = j
                    match_details = best_combination
            
            if best_match:
                self.matched_items.append(self._create_match_record('Multi-field Description', best_score, item1, best_match))
                matched_inv1_indices.add(i)
                matched_inv2_indices.add(best_j)
        
        total_fuzzy_matches = len(self.matched_items) - len([m for m in self.matched_items if m['Match_Type'] == 'Exact Part Number'])
        print(f"Found {total_fuzzy_matches - fuzzy_part_matches} additional multi-field description matches")
        
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
    
    def _create_match_record(self, match_type, score, item1, item2):
        """Helper method to create a standardized match record"""
        return {
            'Match_Type': match_type,
            'Match_Score': score,
            # Inventory 1 data
            'Inv1_Name': item1['Name'],
            'Inv1_CRC_Part_Number': item1['CRC_Part_Number'],
            'Inv1_Manufacturer_Part_Number': item1['Manufacturer_Part_Number'],
            'Inv1_Manufacturer': item1['Manufacturer'],
            'Inv1_Description': item1['Description'],
            'Inv1_Location': item1['Location'],
            'Inv1_Quantity': item1['Quantity'],
            'Inv1_Min_Quantity': item1['Min_Quantity'],
            'Inv1_Cost': item1['Cost'],
            'Inv1_Last_Ordered': item1['Last_Ordered'],
            'Inv1_Notes': item1['Notes'],
            'Inv1_Status': item1['Status'],
            'Inv1_Has_TBD': item1.get('Has_TBD', False),
            # Inventory 2 data
            'Inv2_Part_Number': item2['Original_Part_Number'],
            'Inv2_Description': item2['Original_Description'],
            'Inv2_Item_Desc1': item2['Item_Desc1'],
            'Inv2_Item_Desc2': item2['Item_Desc2'],
            'Inv2_Kind_Desc': item2['Kind_Desc'],
            'Inv2_Location': item2['Location'],
            'Inv2_Warehouse': item2['Warehouse'],
            'Inv2_Quantity': item2['Quantity'],
            'Inv2_Cost': item2['Cost'],
            'Inv2_Value': item2['Value']
        }
    
    def _calculate_word_overlap_score(self, inv1_texts, inv2_texts):
        """Calculate score based on word overlap between text fields"""
        inv1_words = set()
        inv2_words = set()
        
        # Extract all words from inventory 1 texts
        for text in inv1_texts:
            if text:
                words = re.findall(r'\b\w{3,}\b', text.upper())  # Words with 3+ characters
                inv1_words.update(words)
        
        # Extract all words from inventory 2 texts
        for text in inv2_texts:
            if text:
                words = re.findall(r'\b\w{3,}\b', text.upper())  # Words with 3+ characters
                inv2_words.update(words)
        
        if not inv1_words or not inv2_words:
            return 0.0
        
        # Calculate Jaccard similarity (intersection over union)
        intersection = len(inv1_words.intersection(inv2_words))
        union = len(inv1_words.union(inv2_words))
        
        return intersection / union if union > 0 else 0.0
    
    def _calculate_key_word_score(self, inv1_texts, inv2_texts):
        """Calculate score based on matching key technical terms with strict model matching"""
        # Define important technical terms that should match exactly
        key_terms = {
            'AMPLIFIER', 'HEATING', 'ELEMENT', 'CYLINDER', 'ROLLER', 'PLATE', 'VALVE', 
            'MOTOR', 'SENSOR', 'SWITCH', 'CABLE', 'CONNECTOR', 'CIRCUIT', 'BOARD',
            'PUMP', 'FILTER', 'BEARING', 'SEAL', 'GASKET', 'SPRING', 'SCREW',
            'BOLT', 'NUT', 'WASHER', 'PIN', 'SHAFT', 'GEAR', 'BELT', 'CHAIN'
        }
        
        inv1_key_words = set()
        inv2_key_words = set()
        inv1_all_words = set()
        inv2_all_words = set()
        
        # Extract all words and key terms from inventory 1 texts
        for text in inv1_texts:
            if text:
                words = set(re.findall(r'\b\w{3,}\b', text.upper()))
                inv1_all_words.update(words)
                inv1_key_words.update(words.intersection(key_terms))
        
        # Extract all words and key terms from inventory 2 texts
        for text in inv2_texts:
            if text:
                words = set(re.findall(r'\b\w{3,}\b', text.upper()))
                inv2_all_words.update(words)
                inv2_key_words.update(words.intersection(key_terms))
        
        if not inv1_key_words or not inv2_key_words:
            return 0.0
        
        # Check for conflicting key terms (e.g., AMPLIFIER vs HEATING)
        conflicting_pairs = [
            ('AMPLIFIER', 'HEATING'), ('AMPLIFIER', 'ELEMENT'), 
            ('CYLINDER', 'AMPLIFIER'), ('MOTOR', 'AMPLIFIER'),
            ('SERVO', 'HEATING'), ('VALVE', 'AMPLIFIER')
        ]
        
        for term1, term2 in conflicting_pairs:
            if ((term1 in inv1_key_words and term2 in inv2_key_words) or 
                (term2 in inv1_key_words and term1 in inv2_key_words)):
                return 0.0  # Conflicting terms, no match
        
        # Calculate score based on key term matches
        intersection = len(inv1_key_words.intersection(inv2_key_words))
        union = len(inv1_key_words.union(inv2_key_words))
        
        # For specific technical parts, require more specific matching
        if 'AMPLIFIER' in inv1_key_words or 'AMPLIFIER' in inv2_key_words:
            # For amplifiers, require very high similarity in model numbers/specifications
            model_words_inv1 = inv1_all_words - key_terms
            model_words_inv2 = inv2_all_words - key_terms
            
            if model_words_inv1 and model_words_inv2:
                model_intersection = len(model_words_inv1.intersection(model_words_inv2))
                model_union = len(model_words_inv1.union(model_words_inv2))
                model_similarity = model_intersection / model_union if model_union > 0 else 0.0
                
                # Require at least 50% model similarity for amplifiers
                if model_similarity < 0.5:
                    return 0.0
        
        # Boost score if key terms match exactly
        if intersection > 0:
            base_score = intersection / union
            # Give extra weight to key term matches
            return min(1.0, base_score * 1.5)
        
        return 0.0
    
    def export_results(self):
        """Export results to Excel files"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Export matched items with prices
        if self.matched_items:
            df_matched = pd.DataFrame(self.matched_items)
            matched_filename = f"Matched_Inventory_with_Prices_{timestamp}.xlsx"
            
            # Reorder columns to show only the requested fields
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
                'Inv2_Value'
            ]
            
            df_matched = df_matched.reindex(columns=column_order)
            df_matched.to_excel(matched_filename, index=False)
            print(f"Matched inventory with prices exported to: {matched_filename}")
        
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
        print("\n" + "="*70)
        print("INVENTORY COMPARISON SUMMARY")
        print("="*70)
        print(f"Total items in Inventory-1.xlsx: {len(self.inventory1_data)}")
        print(f"Total items in inventory-2.xls: {len(self.inventory2_data)}")
        print(f"Total matches found: {len(self.matched_items)}")
        print(f"  - Exact part number matches: {len([m for m in self.matched_items if m['Match_Type'] == 'Exact Part Number'])}")
        print(f"  - Fuzzy description matches: {len([m for m in self.matched_items if m['Match_Type'] == 'Fuzzy Description'])}")
        print(f"Unmatched items in Inventory-1: {len(self.unmatched_inventory1)}")
        print(f"Unmatched items in Inventory-2: {len(self.unmatched_inventory2)}")
        
        if len(self.inventory1_data) > 0:
            match_rate_inv1 = (len(self.matched_items) / len(self.inventory1_data)) * 100
            print(f"\nMatch rate (Inventory-1 perspective): {len(self.matched_items)}/{len(self.inventory1_data)} ({match_rate_inv1:.1f}%)")
        
        if len(self.inventory2_data) > 0:
            match_rate_inv2 = (len(self.matched_items) / len(self.inventory2_data)) * 100
            print(f"Match rate (Inventory-2 perspective): {len(self.matched_items)}/{len(self.inventory2_data)} ({match_rate_inv2:.1f}%)")

def main():
    comparison = InventoryComparison()
    
    # Load both inventories
    comparison.load_inventory1("Inventory-1.xlsx")
    comparison.load_inventory2("inventory-2.xls")
    
    # Find matches
    comparison.find_matches()
    
    # Export results
    comparison.export_results()

if __name__ == "__main__":
    main()
