import pandas as pd

# Check available sheets
xls = pd.ExcelFile('Parts Inventory 2025.2 (1).xlsx')
print('Available sheets in Parts Inventory 2025:')
for sheet in xls.sheet_names:
    print(f'  - {sheet}')
