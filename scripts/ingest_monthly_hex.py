import argparse
import json
import os
import sys
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv
from supabase import create_client, Client
from tqdm import tqdm
load_dotenv()

SUPABASE_URL         = os.environ["VITE_SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["VITE_SUPABASE_SERVICE_KEY"]

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

TABLE = "monthly_hex_data"
BATCH_SIZE = 500   # rows per upsert call

# ── Batch definitions ─────────────────────────────────────────────────────────
# Add entries here as new CSVs arrive.
DATASETS = [
    {
        "file":    "Romania_Monthly_AugSept.csv",
        "country": "Romania",
        "year":    2025,
        # months are read from the `month` column in the CSV
    },
    {
        "file":    "Poland_Monthly_FebMarch.csv",
        "country": "Poland",
        "year":    2026,
    },
    {
        "file":    "Italy_Monthly_JuneJuly.csv",
        "country": "Italy",
        "year":    2025,
    },
]

# ── Column mapping: CSV column → DB column ────────────────────────────────────
COL_MAP = {
    "hex_id":               "hex_id",           # derived from system:index
    "CH4_mean_mean":        "ch4_mean",
    "CH4_zscore_mean":      "ch4_zscore",
    "CH4_persistence_mean": "ch4_persistence",
    "CH4_std_mean":         "ch4_std",
    "NDVI_mean":            "ndvi",
    "NDBI_mean":            "ndbi",
    "NDWI_mean":            "ndwi",
    "NDMI_mean":            "ndmi",
    "BSI_mean":             "bsi",
    "SWIR1_mean":           "swir1",
    "SWIR2_mean":           "swir2",
    "elevation_mean":       "elevation",
    "slope_mean":           "slope",
    "wind_speed_mean":      "wind_speed",
    "wind_direction_mean":  "wind_direction",
    "nightlights_mean":     "nightlights",
    "infra_distance_mean":  "infra_distance",
    "lat":                  "lat",
    "lon":                  "lon",
    "month":                "month",
    "year":                 "year",
}


def parse_geom_wkt(geo_str: str) -> str:
    """
    The .geo column is a JSON string like:
      {"type":"Polygon","coordinates":[[[lon,lat],...]]}
    Convert to WKT for PostGIS ST_GeomFromText, or return GeoJSON string
    for direct insertion via ST_SetSRID(ST_GeomFromGeoJSON(...), 4326).
    We return GeoJSON as-is; the INSERT uses ST_SetSRID(ST_GeomFromGeoJSON(geom_json), 4326).
    """
    if pd.isna(geo_str):
        return None
    if isinstance(geo_str, str):
        return geo_str.strip()
    return json.dumps(geo_str)


def load_csv(path: Path, country: str, year: int) -> pd.DataFrame:
    df = pd.read_csv(path)

    # hex_id comes from `system:index`
    if "system:index" in df.columns:
        df["hex_id"] = df["system:index"].astype(str)
    elif "hex_id" not in df.columns:
        raise ValueError("No hex_id or system:index column found.")

    # Geometry column
    geom_col = ".geo" if ".geo" in df.columns else "geo"
    if geom_col not in df.columns:
        raise ValueError(f"Geometry column '{geom_col}' not found.")
    df["geom_geojson"] = df[geom_col].apply(parse_geom_wkt)

    # Override year/country if not in CSV (they may be present already)
    df["country"] = country
    if "year" not in df.columns:
        df["year"] = year

    # month column must exist
    if "month" not in df.columns:
        raise ValueError("CSV must have a 'month' column.")

    return df


def df_to_records(df: pd.DataFrame) -> list[dict]:
    records = []
    for _, row in df.iterrows():
        rec = {db_col: None for db_col in COL_MAP.values()}
        for csv_col, db_col in COL_MAP.items():
            if csv_col in row.index:
                val = row[csv_col]
                rec[db_col] = None if pd.isna(val) else val

        rec["country"] = row["country"]
        rec["geom"]    = row["geom_geojson"]   # stored as text; cast in SQL
        records.append(rec)
    return records


def upsert_records(records: list[dict], dry_run: bool = False):
    """Upsert in batches using the conflict target (hex_id, country, year, month)."""
    total = len(records)
    for start in tqdm(range(0, total, BATCH_SIZE), desc="Upserting"):
        batch = records[start : start + BATCH_SIZE]

        # Supabase client can't call ST_ functions directly.
        # We use a raw SQL RPC instead:  insert_monthly_hex_batch(json[])
        # See migration file for that helper function.
        # If you prefer, use psycopg2 directly.
        if dry_run:
            print(f"[DRY RUN] Would upsert rows {start}–{start+len(batch)-1}")
            continue

        resp = supabase.rpc(
            "insert_monthly_hex_batch",
            {"rows": batch},
        ).execute()

        if hasattr(resp, "error") and resp.error:
            print(f"ERROR at batch {start}: {resp.error}", file=sys.stderr)
            sys.exit(1)

    print(f"✓ {total} rows processed.")


def ingest(file: str, country: str, year: int, dry_run: bool = False):
    path = Path(file)
    if not path.exists():
        print(f"File not found: {file}", file=sys.stderr)
        sys.exit(1)

    print(f"\n→ Loading  {file}  (country={country}, year={year})")
    df = load_csv(path, country, year)

    months = sorted(df["month"].unique().tolist())
    print(f"  Months found: {months}  |  Rows: {len(df)}")

    records = df_to_records(df)
    upsert_records(records, dry_run=dry_run)


def main():
    parser = argparse.ArgumentParser(description="Ingest monthly hex CSVs into Supabase.")
    parser.add_argument("--file",    help="CSV file path")
    parser.add_argument("--country", help="Country name (e.g. Romania)")
    parser.add_argument("--year",    type=int, help="Year override")
    parser.add_argument("--batch",   action="store_true", help="Run all DATASETS entries")
    parser.add_argument("--dry-run", action="store_true", help="Parse only, no DB writes")
    args = parser.parse_args()

    if args.batch:
        for ds in DATASETS:
            ingest(ds["file"], ds["country"], ds["year"], dry_run=args.dry_run)
    elif args.file and args.country:
        year = args.year or int(input("Year: "))
        ingest(args.file, args.country, year, dry_run=args.dry_run)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()