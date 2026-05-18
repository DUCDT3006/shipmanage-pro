import pandas as pd
import os

files = [
    "01.Bao cao KQKD 2026.xlsx",
    "03.Theo doi tai chinh.xlsx",
    "Copy of THEO DÕI DẦU 2026.xlsx"
]

for file in files:
    print(f"\n--- {file} ---")
    try:
        xl = pd.ExcelFile(file)
        print(f"Sheets: {xl.sheet_names}")
        for sheet in xl.sheet_names:
            df = pd.read_excel(file, sheet_name=sheet, nrows=5)
            print(f"\nSheet: {sheet}")
            print(f"Columns: {df.columns.tolist()}")
            # print(df.head())
    except Exception as e:
        print(f"Error reading {file}: {e}")
