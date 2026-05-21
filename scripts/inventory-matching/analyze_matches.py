#!/usr/bin/env python3
"""
Analyze the quality and details of matches found
"""

import pandas as pd
import numpy as np

def analyze_match_quality():
    """Analyze the quality of fuzzy matches"""
    
    # Load the new matches
    df = pd.read_excel('New_Matches_Found_20250924_120401.xlsx')
    
    print("=== FUZZY MATCH QUALITY ANALYSIS ===\n")
    
    fuzzy_matches = df[df['Match_Type'].str.contains('Fuzzy')]
    exact_matches = df[df['Match_Type'].str.contains('Exact')]
    
    print(f"Total matches: {len(df)}")
    print(f"Exact matches: {len(exact_matches)}")
    print(f"Fuzzy matches: {len(fuzzy_matches)}\n")
    
    if len(fuzzy_matches) > 0:
        print("SCORE DISTRIBUTION:")
        score_ranges = [
            (0.95, 1.0, 'Excellent (95-100%)'),
            (0.85, 0.95, 'Very Good (85-94%)'), 
            (0.80, 0.85, 'Good (80-84%)'),
            (0.75, 0.80, 'Fair (75-79%)'),
            (0.0, 0.75, 'Below Threshold (<75%)')
        ]
        
        for min_score, max_score, label in score_ranges:
            if max_score == 1.0:
                count = len(fuzzy_matches[(fuzzy_matches['Match_Score'] >= min_score) & (fuzzy_matches['Match_Score'] <= max_score)])
            else:
                count = len(fuzzy_matches[(fuzzy_matches['Match_Score'] >= min_score) & (fuzzy_matches['Match_Score'] < max_score)])
            print(f"  {label}: {count} matches")
        
        print(f"\nSTATISTICS:")
        print(f"  Average match score: {fuzzy_matches['Match_Score'].mean():.3f}")
        print(f"  Median match score: {fuzzy_matches['Match_Score'].median():.3f}")
        print(f"  Min match score: {fuzzy_matches['Match_Score'].min():.3f}")
        print(f"  Max match score: {fuzzy_matches['Match_Score'].max():.3f}")
        print(f"  Standard deviation: {fuzzy_matches['Match_Score'].std():.3f}")
    
    print("\n=== MATCH CATEGORIES ===\n")
    
    # Categorize matches by type
    categories = {
        'Mounting & Brackets': ['MOUNTING', 'BRACKET', 'GRIPPER'],
        'Springs & Absorbers': ['SPRING', 'ABSORBER', 'SHOCK'],
        'Sensors & Electronics': ['SENSOR', 'REFLEX', 'REFLECTOR'],
        'Mechanical Parts': ['CYLINDER', 'SPACER', 'JAW', 'WHEEL'],
        'Fasteners': ['SCREW', 'CHEESE HEAD'],
        'Heating Elements': ['HEATING', 'ELEMENT'],
        'Support Components': ['SUPPORT', 'CARD']
    }
    
    for category, keywords in categories.items():
        matches_in_category = df[df['New_Inventory_Description'].str.upper().str.contains('|'.join(keywords), na=False) |
                               df['Unmatched_Description'].str.upper().str.contains('|'.join(keywords), na=False)]
        if len(matches_in_category) > 0:
            print(f"{category}: {len(matches_in_category)} matches")
            avg_score = matches_in_category['Match_Score'].mean()
            print(f"  Average score: {avg_score:.3f}")
            print(f"  Examples:")
            for _, row in matches_in_category.head(2).iterrows():
                print(f"    {row['New_Inventory_Part_Number']} -> {row['Unmatched_Part_Number']} (Score: {row['Match_Score']:.3f})")
            print()

def create_combined_report():
    """Create a combined report with all matches"""
    
    print("=== CREATING COMBINED REPORT ===\n")
    
    # Load existing matched inventory
    try:
        existing_matches = pd.read_excel('Matched_Inventory_20250919_102047.xlsx')
        print(f"Loaded {len(existing_matches)} existing matches")
    except FileNotFoundError:
        print("No existing matches file found")
        existing_matches = pd.DataFrame()
    
    # Load new matches
    new_matches = pd.read_excel('New_Matches_Found_20250924_120401.xlsx')
    print(f"Loaded {len(new_matches)} new matches")
    
    # Standardize column names for combining
    if not existing_matches.empty:
        # Map existing columns to standard format
        existing_standardized = existing_matches.copy()
        existing_standardized['Match_Source'] = 'Original Run'
        
        # Map columns to match new format
        column_mapping = {
            'Inventory1_Part_Number': 'First_Inventory_Part_Number',
            'Inventory1_Description': 'First_Inventory_Description', 
            'Inventory1_Quantity': 'First_Inventory_Quantity',
            'Inventory1_Location': 'First_Inventory_Location',
            'Inventory1_Source': 'First_Inventory_Source',
            'Inventory2_Part_Number': 'Second_Inventory_Part_Number',
            'Inventory2_Description': 'Second_Inventory_Description',
            'Inventory2_Quantity': 'Second_Inventory_Quantity', 
            'Inventory2_Location': 'Second_Inventory_Location',
            'Inventory2_Source': 'Second_Inventory_Source',
            'Inventory2_Cost': 'Second_Inventory_Cost',
            'Inventory2_Value': 'Second_Inventory_Value'
        }
        
        existing_standardized = existing_standardized.rename(columns=column_mapping)
    
    # Standardize new matches
    new_standardized = new_matches.copy()
    new_standardized['Match_Source'] = 'New Inventory Check'
    
    new_column_mapping = {
        'New_Inventory_Part_Number': 'First_Inventory_Part_Number',
        'New_Inventory_Description': 'First_Inventory_Description',
        'New_Inventory_Quantity': 'First_Inventory_Quantity', 
        'New_Inventory_Location': 'First_Inventory_Location',
        'New_Inventory_Source': 'First_Inventory_Source',
        'Unmatched_Part_Number': 'Second_Inventory_Part_Number',
        'Unmatched_Description': 'Second_Inventory_Description',
        'Unmatched_Quantity': 'Second_Inventory_Quantity',
        'Unmatched_Location': 'Second_Inventory_Location', 
        'Unmatched_Source': 'Second_Inventory_Source',
        'Unmatched_Cost': 'Second_Inventory_Cost',
        'Unmatched_Value': 'Second_Inventory_Value'
    }
    
    new_standardized = new_standardized.rename(columns=new_column_mapping)
    
    # Combine all matches
    if not existing_matches.empty:
        # Get common columns
        common_cols = set(existing_standardized.columns) & set(new_standardized.columns)
        combined_matches = pd.concat([
            existing_standardized[list(common_cols)],
            new_standardized[list(common_cols)]
        ], ignore_index=True)
    else:
        combined_matches = new_standardized
    
    # Export combined report
    from datetime import datetime
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    combined_filename = f"Combined_Inventory_Matches_{timestamp}.xlsx"
    
    with pd.ExcelWriter(combined_filename) as writer:
        combined_matches.to_excel(writer, sheet_name='All_Matches', index=False)
        
        # Summary statistics
        summary_data = {
            'Metric': [
                'Total Matches Found',
                'Original Run Matches', 
                'New Inventory Matches',
                'Exact Part Number Matches',
                'Fuzzy Description Matches',
                'Average Match Score (Fuzzy Only)',
                'Highest Match Score',
                'Lowest Match Score'
            ],
            'Value': [
                len(combined_matches),
                len(existing_matches) if not existing_matches.empty else 0,
                len(new_matches),
                len(combined_matches[combined_matches['Match_Type'].str.contains('Exact', na=False)]),
                len(combined_matches[combined_matches['Match_Type'].str.contains('Fuzzy', na=False)]),
                f"{combined_matches[combined_matches['Match_Type'].str.contains('Fuzzy', na=False)]['Match_Score'].mean():.3f}" if len(combined_matches[combined_matches['Match_Type'].str.contains('Fuzzy', na=False)]) > 0 else 'N/A',
                f"{combined_matches['Match_Score'].max():.3f}" if 'Match_Score' in combined_matches.columns else 'N/A',
                f"{combined_matches['Match_Score'].min():.3f}" if 'Match_Score' in combined_matches.columns else 'N/A'
            ]
        }
        
        summary_df = pd.DataFrame(summary_data)
        summary_df.to_excel(writer, sheet_name='Summary', index=False)
    
    print(f"Combined report exported to: {combined_filename}")
    print(f"Total matches in combined report: {len(combined_matches)}")
    
    return combined_filename

if __name__ == "__main__":
    analyze_match_quality()
    print("\n" + "="*60 + "\n")
    create_combined_report()
