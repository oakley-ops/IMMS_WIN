#!/usr/bin/env python3
"""
Comparison Analysis: Cabinet-Only vs Full Internal Parts List
Shows the difference between using all sheets vs just cabinet worksheets
"""

import pandas as pd

def compare_results():
    """Compare cabinet-only results vs comprehensive results"""
    
    print("="*80)
    print("COMPARISON: CABINET-ONLY vs FULL INTERNAL PARTS LIST MATCHING")
    print("="*80)
    
    # Load cabinet-only results
    try:
        cabinet_matches = pd.read_excel('Cabinet_Only_Matches_20250924_123731.xlsx')
        print(f"✅ Cabinet-only matches loaded: {len(cabinet_matches)} matches")
    except FileNotFoundError:
        print("❌ Cabinet-only matches file not found")
        return
    
    # Load comprehensive results (with Full Internal parts list)
    try:
        comprehensive_matches = pd.read_excel('Comprehensive_Matched_Inventory_20250924_121317.xlsx')
        print(f"✅ Comprehensive matches loaded: {len(comprehensive_matches)} matches")
    except FileNotFoundError:
        print("❌ Comprehensive matches file not found")
        return
    
    print("\n" + "="*60)
    print("DETAILED COMPARISON")
    print("="*60)
    
    print(f"\n📊 VOLUME COMPARISON:")
    print(f"   Full Internal parts list matching: {len(comprehensive_matches):,} matches")
    print(f"   Cabinet-only matching:           {len(cabinet_matches):,} matches")
    print(f"   Difference:                      {len(comprehensive_matches) - len(cabinet_matches):,} matches")
    print(f"   Reduction factor:                {len(comprehensive_matches) / len(cabinet_matches):.1f}x fewer matches")
    
    print(f"\n📈 MATCH RATE COMPARISON:")
    # From previous analysis
    full_match_rate = 82.2  # From comprehensive analysis
    cabinet_match_rate = 0.6  # From cabinet-only analysis
    
    print(f"   Full Internal parts list:         {full_match_rate}% match rate")
    print(f"   Cabinet-only:                   {cabinet_match_rate}% match rate")
    print(f"   Impact:                         {full_match_rate - cabinet_match_rate:.1f} percentage point reduction")
    
    print(f"\n🎯 INVENTORY SCOPE COMPARISON:")
    print(f"   Full Internal parts list:         1,303 items processed")
    print(f"   Cabinet worksheets only:        676 items processed")
    print(f"   Scope reduction:                {1303 - 676:,} fewer items ({((1303-676)/1303)*100:.1f}% reduction)")
    
    print(f"\n🔍 CABINET-ONLY MATCHES BREAKDOWN:")
    if len(cabinet_matches) > 0:
        # Analyze cabinet-only matches
        exact_matches = len(cabinet_matches[cabinet_matches['Match_Type'] == 'Exact Part Number'])
        fuzzy_matches = len(cabinet_matches[cabinet_matches['Match_Type'] == 'Fuzzy Description'])
        alt_matches = len(cabinet_matches[cabinet_matches['Match_Type'] == 'Alternative Part Number'])
        
        print(f"   Exact part number matches:      {exact_matches}")
        print(f"   Fuzzy description matches:      {fuzzy_matches}")
        print(f"   Alternative part matches:       {alt_matches}")
        
        # Show breakdown by cabinet
        cabinet_sources = cabinet_matches['Cabinet_Source'].value_counts()
        print(f"\n   Matches by cabinet:")
        for cabinet, count in cabinet_sources.items():
            print(f"     {cabinet}: {count} matches")
        
        print(f"\n   Specific matches found:")
        for _, match in cabinet_matches.iterrows():
            print(f"     • {match['Cabinet_Part_Number']} ({match['Cabinet_Source']}) ↔ {match['ZZ110_Part_Number']}")
            print(f"       {match['Match_Type']} - Score: {match.get('Match_Score', 1.0):.3f}")
    
    print(f"\n💡 ANALYSIS INSIGHTS:")
    print(f"   ✅ Cabinet-only approach is much more targeted")
    print(f"   ✅ Focuses on physical inventory locations")
    print(f"   ✅ Eliminates bulk system inventory noise")
    print(f"   ⚠️  Significantly fewer matches found")
    print(f"   ⚠️  May miss legitimate cross-references")
    
    print(f"\n🎯 RECOMMENDATIONS:")
    print(f"   1. 🎯 Use cabinet-only for physical inventory reconciliation")
    print(f"   2. 📊 Use full list for comprehensive system integration")
    print(f"   3. 🔄 Consider hybrid approach: prioritize cabinet matches")
    print(f"   4. 📝 Manual review of unmatched cabinet items is more manageable")
    
    # Export comparison summary
    comparison_data = {
        'Metric': [
            'Items Processed (Parts Inventory 2025)',
            'Items Processed (ZZ110)',
            'Total Matches Found',
            'Exact Part Number Matches',
            'Fuzzy Description Matches', 
            'Alternative Part Matches',
            'Match Rate (%)',
            'Unmatched Cabinet/Parts Items',
            'Unmatched ZZ110 Items'
        ],
        'Full_Internal_List': [
            '1,303',
            '998',
            len(comprehensive_matches),
            '944',
            '2',
            '0',
            '82.2%',
            '357',
            '52'
        ],
        'Cabinet_Only': [
            '676',
            '998', 
            len(cabinet_matches),
            exact_matches,
            fuzzy_matches,
            alt_matches,
            '0.6%',
            '671',
            '993'
        ],
        'Difference': [
            f'-{1303-676}',
            '0',
            f'-{len(comprehensive_matches) - len(cabinet_matches)}',
            f'-{944 - exact_matches}',
            f'+{fuzzy_matches - 2}',
            f'+{alt_matches}',
            f'-{82.2 - 0.6:.1f}pp',
            f'+{671 - 357}',
            f'+{993 - 52}'
        ]
    }
    
    comparison_df = pd.DataFrame(comparison_data)
    comparison_filename = "Cabinet_vs_Full_Comparison_Analysis.xlsx"
    comparison_df.to_excel(comparison_filename, index=False)
    print(f"\n📁 Comparison analysis exported to: {comparison_filename}")
    
    print("\n" + "="*80)
    print("COMPARISON ANALYSIS COMPLETE")
    print("="*80)

if __name__ == "__main__":
    compare_results()
