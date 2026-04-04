"""
clean_carbonmapper.py

Cleans the raw carbonmapper CSV before it enters the app.
Run this whenever you get a new export from CarbonMapper.

Usage:
    python scripts/clean_carbonmapper.py \
        --input  path/to/raw_carbonmapper.csv \
        --output src/data/carbonmapper.csv

What it fixes:
    1. Duplicate plume_id rows — keeps the row with the most complete data
    2. Missing emission_auto — logs how many rows are affected
    3. Malformed plume_bounds — drops rows where bounds can't be parsed
    4. Invalid datetime — logs rows with unparseable timestamps
"""

import argparse
import json
import csv
import sys
from datetime import datetime, timezone


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument('--input',  required=True, help='Raw carbonmapper CSV path')
    p.add_argument('--output', required=True, help='Cleaned output CSV path')
    return p.parse_args()


def fix_datetime(dt_str):
    """Normalise +00 → +00:00 and verify parseable."""
    if not dt_str:
        return None
    fixed = dt_str.strip()
    # Fix missing colon in timezone offset e.g. +00 → +00:00
    import re
    fixed = re.sub(r'([+-]\d{2})$', r'\1:00', fixed)
    try:
        datetime.fromisoformat(fixed)
        return fixed
    except ValueError:
        return None


def score_row(row):
    """Score completeness — higher = more fields filled in. Used for dedup."""
    fields = ['emission_auto', 'emission_uncertainty_auto', 'plume_png',
              'wind_speed_avg_auto', 'wind_direction_avg_auto', 'ipcc_sector']
    return sum(1 for f in fields if row.get(f, '').strip())


def main():
    args = parse_args()

    with open(args.input, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        fieldnames = reader.fieldnames

    print(f"Input rows: {len(rows)}")

    # --- 1. Deduplicate by plume_id, keep most complete row ---
    seen = {}
    duplicates = 0
    for row in rows:
        pid = row.get('plume_id', '').strip()
        if not pid:
            continue
        if pid not in seen or score_row(row) > score_row(seen[pid]):
            seen[pid] = row
        else:
            duplicates += 1

    clean = list(seen.values())
    print(f"Duplicates removed: {duplicates}")

    # --- 2. Drop rows with unparseable plume_bounds ---
    bad_bounds = 0
    valid = []
    for row in clean:
        bounds_str = row.get('plume_bounds', '').strip()
        try:
            bounds = json.loads(bounds_str)
            if len(bounds) != 4:
                raise ValueError("Expected 4 values")
            valid.append(row)
        except Exception:
            bad_bounds += 1
            print(f"  [DROP] bad plume_bounds on {row.get('plume_id')}: {bounds_str!r}")

    print(f"Dropped (bad bounds): {bad_bounds}")

    # --- 3. Log missing emission_auto (don't drop — IME may cover these) ---
    missing_emission = [r for r in valid if not r.get('emission_auto', '').strip()]
    print(f"Missing emission_auto (kept, IME may cover): {len(missing_emission)}")

    # --- 4. Fix and log bad datetimes ---
    bad_dt = 0
    for row in valid:
        original = row.get('datetime', '')
        fixed = fix_datetime(original)
        if fixed is None:
            bad_dt += 1
            print(f"  [WARN] unparseable datetime on {row.get('plume_id')}: {original!r}")
        else:
            row['datetime'] = fixed  # write back normalised value

    print(f"Datetime warnings: {bad_dt}")

    # --- Write output ---
    with open(args.output, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(valid)

    print(f"Output rows: {len(valid)}")
    print(f"Written to: {args.output}")


if __name__ == '__main__':
    main()