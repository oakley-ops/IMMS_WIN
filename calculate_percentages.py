#!/usr/bin/env python3
"""
Calculate exact percentages of matched and unmatched parts
"""

import pandas as pd

def calculate_percentages():
    """Calculate match/unmatch percentages for all approaches"""
    
    print("="*80)
    print("INVENTORY MATCHING PERCENTAGES ANALYSIS")
    print("="*80)
    
    # 1. CABINET-ONLY APPROACH
    print("\n🏗️ CABINET-ONLY APPROACH (Excluding Full Fiserv parts list)")
    print("-" * 60)
    
    try:
        cabinet_matches = pd.read_excel('Cabinet_Only_Matches_20250924_123731.xlsx')
        cabinet_unmatched = pd.read_excel('Cabinet_Only_Unmatched_20250924_123731.xlsx', sheet_name=None)
        
        # Cabinet data
        cabinet_items = 676  # From previous analysis
        zz110_items = 998   # From previous analysis
        cabinet_matches_count = len(cabinet_matches)
        
        unmatched_cabinet = len(cabinet_unmatched.get('Unmatched_Cabinet_Items', pd.DataFrame()))
        unmatched_zz110_cabinet = len(cabinet_unmatched.get('Unmatched_ZZ110_Items', pd.DataFrame()))
        
        print(f"📊 Total Cabinet Items: {cabinet_items:,}")
        print(f"📊 Total ZZ110 Items: {zz110_items:,}")
        print(f"✅ Matched Pairs: {cabinet_matches_count}")
        print(f"❌ Unmatched Cabinet Items: {unmatched_cabinet:,}")
        print(f"❌ Unmatched ZZ110 Items: {unmatched_zz110_cabinet:,}")
        
        # Calculate percentages for cabinet approach
        cabinet_matched_pct = (cabinet_matches_count / cabinet_items) * 100
        cabinet_unmatched_pct = (unmatched_cabinet / cabinet_items) * 100
        zz110_matched_cabinet_pct = (cabinet_matches_count / zz110_items) * 100
        zz110_unmatched_cabinet_pct = (unmatched_zz110_cabinet / zz110_items) * 100
        
        print(f"\n📈 CABINET ITEMS PERCENTAGES:")
        print(f"   ✅ Matched: {cabinet_matched_pct:.1f}% ({cabinet_matches_count}/{cabinet_items})")
        print(f"   ❌ Unmatched: {cabinet_unmatched_pct:.1f}% ({unmatched_cabinet}/{cabinet_items})")
        
        print(f"\n📈 ZZ110 ITEMS PERCENTAGES (vs Cabinet):")
        print(f"   ✅ Matched: {zz110_matched_cabinet_pct:.1f}% ({cabinet_matches_count}/{zz110_items})")
        print(f"   ❌ Unmatched: {zz110_unmatched_cabinet_pct:.1f}% ({unmatched_zz110_cabinet}/{zz110_items})")
        
    except Exception as e:
        print(f"❌ Error loading cabinet data: {e}")
    
    # 2. COMPREHENSIVE APPROACH (Including Full Fiserv parts list)
    print("\n\n🏢 COMPREHENSIVE APPROACH (Including Full Fiserv parts list)")
    print("-" * 60)
    
    try:
        comprehensive_matches = pd.read_excel('Comprehensive_Matched_Inventory_20250924_121317.xlsx')
        comprehensive_unmatched = pd.read_excel('Comprehensive_Unmatched_Inventory_20250924_121317.xlsx', sheet_name=None)
        
        # Comprehensive data
        parts_2025_items = 1303  # From previous analysis
        zz110_items = 998       # Same ZZ110 inventory
        comprehensive_matches_count = len(comprehensive_matches)
        
        unmatched_parts_2025 = len(comprehensive_unmatched.get('Unmatched_Parts_Inventory_2025', pd.DataFrame()))
        unmatched_zz110_comp = len(comprehensive_unmatched.get('Unmatched_ZZ110_Inventory', pd.DataFrame()))
        
        print(f"📊 Total Parts Inventory 2025 Items: {parts_2025_items:,}")
        print(f"📊 Total ZZ110 Items: {zz110_items:,}")
        print(f"✅ Matched Pairs: {comprehensive_matches_count:,}")
        print(f"❌ Unmatched Parts 2025 Items: {unmatched_parts_2025:,}")
        print(f"❌ Unmatched ZZ110 Items: {unmatched_zz110_comp:,}")
        
        # Calculate percentages for comprehensive approach
        parts_2025_matched_pct = (comprehensive_matches_count / parts_2025_items) * 100
        parts_2025_unmatched_pct = (unmatched_parts_2025 / parts_2025_items) * 100
        zz110_matched_comp_pct = (comprehensive_matches_count / zz110_items) * 100
        zz110_unmatched_comp_pct = (unmatched_zz110_comp / zz110_items) * 100
        
        print(f"\n📈 PARTS INVENTORY 2025 PERCENTAGES:")
        print(f"   ✅ Matched: {parts_2025_matched_pct:.1f}% ({comprehensive_matches_count:,}/{parts_2025_items:,})")
        print(f"   ❌ Unmatched: {parts_2025_unmatched_pct:.1f}% ({unmatched_parts_2025:,}/{parts_2025_items:,})")
        
        print(f"\n📈 ZZ110 ITEMS PERCENTAGES (vs Full Parts 2025):")
        print(f"   ✅ Matched: {zz110_matched_comp_pct:.1f}% ({comprehensive_matches_count:,}/{zz110_items:,})")
        print(f"   ❌ Unmatched: {zz110_unmatched_comp_pct:.1f}% ({unmatched_zz110_comp:,}/{zz110_items:,})")
        
    except Exception as e:
        print(f"❌ Error loading comprehensive data: {e}")
    
    # 3. ADDITIONAL MATCHES (Copy of Inventory)
    print("\n\n📋 ADDITIONAL MATCHES (Copy of Inventory vs Previously Unmatched)")
    print("-" * 60)
    
    try:
        additional_matches = pd.read_excel('New_Matches_Found_20250924_120401.xlsx')
        additional_matches_count = len(additional_matches)
        
        # Load updated unmatched to see remaining items
        updated_unmatched = pd.read_excel('Updated_Unmatched_Inventory_20250924_120401.xlsx', sheet_name=None)
        
        copy_inventory_items = 945  # From previous analysis
        still_unmatched_new = len(updated_unmatched.get('Still_Unmatched_New', pd.DataFrame()))
        
        print(f"📊 Copy of Inventory Items: {copy_inventory_items:,}")
        print(f"✅ Additional Matches Found: {additional_matches_count}")
        print(f"❌ Still Unmatched from Copy: {still_unmatched_new:,}")
        
        copy_matched_pct = (additional_matches_count / copy_inventory_items) * 100
        copy_unmatched_pct = (still_unmatched_new / copy_inventory_items) * 100
        
        print(f"\n📈 COPY OF INVENTORY PERCENTAGES:")
        print(f"   ✅ Matched: {copy_matched_pct:.1f}% ({additional_matches_count}/{copy_inventory_items:,})")
        print(f"   ❌ Unmatched: {copy_unmatched_pct:.1f}% ({still_unmatched_new:,}/{copy_inventory_items:,})")
        
    except Exception as e:
        print(f"❌ Error loading additional matches data: {e}")
    
    # 4. OVERALL SUMMARY
    print("\n\n🎯 OVERALL SUMMARY")
    print("=" * 60)
    
    total_matches = cabinet_matches_count + comprehensive_matches_count + additional_matches_count
    
    print(f"📊 TOTAL MATCHES ACROSS ALL APPROACHES: {total_matches:,}")
    print(f"   • Cabinet-only matches: {cabinet_matches_count}")
    print(f"   • Comprehensive matches: {comprehensive_matches_count:,}")
    print(f"   • Additional matches: {additional_matches_count}")
    
    print(f"\n🎯 APPROACH EFFECTIVENESS:")
    print(f"   • Cabinet-only: {cabinet_matched_pct:.1f}% of cabinet items matched")
    print(f"   • Comprehensive: {parts_2025_matched_pct:.1f}% of full inventory matched")
    print(f"   • Additional: {copy_matched_pct:.1f}% of copy inventory matched")
    
    # Export summary table
    summary_data = {
        'Approach': ['Cabinet-Only', 'Comprehensive (Full)', 'Additional (Copy)', 'Combined Total'],
        'Total_Items': [cabinet_items, parts_2025_items, copy_inventory_items, 'N/A'],
        'Matches_Found': [cabinet_matches_count, comprehensive_matches_count, additional_matches_count, total_matches],
        'Match_Percentage': [f'{cabinet_matched_pct:.1f}%', f'{parts_2025_matched_pct:.1f}%', f'{copy_matched_pct:.1f}%', 'N/A'],
        'Unmatched_Items': [unmatched_cabinet, unmatched_parts_2025, still_unmatched_new, 'N/A'],
        'Unmatch_Percentage': [f'{cabinet_unmatched_pct:.1f}%', f'{parts_2025_unmatched_pct:.1f}%', f'{copy_unmatched_pct:.1f}%', 'N/A']
    }
    
    summary_df = pd.DataFrame(summary_data)
    summary_filename = "Match_Percentage_Summary.xlsx"
    summary_df.to_excel(summary_filename, index=False)
    
    print(f"\n📁 Percentage summary exported to: {summary_filename}")
    
    print("\n" + "="*80)
    print("PERCENTAGE ANALYSIS COMPLETE")
    print("="*80)

if __name__ == "__main__":
    calculate_percentages()
