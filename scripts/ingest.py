"""
Methane Observations — Supabase Ingest Script
=============================================
Reads csv  into Supabase.

Usage:
    pip install psycopg2-binary pandas
    python ingest.py

Set your DATABASE_URL below before running.
"""

import json
import math
import pandas as pd
import psycopg2
from psycopg2.extras import execute_values

# ── CONFIG ────────────────────────────────────────────────────────────────────
CSV_PATH = "src/data/Spain_ALL_YEARS.csv"


DATABASE_URL = "postgresql://postgres.iutqrxugdzuseimabaiq:XSRQ9NE$hBK6uN,@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres"


CH4_CLIP_LOW  = -50.0
CH4_CLIP_HIGH =  50.0

BATCH_SIZE = 500
# ─────────────────────────────────────────────────────────────────────────────


def nan_to_none(value):
    """Convert float NaN to None so psycopg2 inserts NULL."""
    if value is None:
        return None
    if isinstance(value, float) and math.isnan(value):
        return None
    return value


def clip(value, low, high):
    """Clip value to [low, high], return None if NaN."""
    v = nan_to_none(value)
    if v is None:
        return None
    return max(low, min(high, v))


def parse_geo(geo_str):
    """
    Parse .geo GeoJSON string → WKT POLYGON string for PostGIS.
    Example input:  {"type":"Polygon","coordinates":[[[-4.34,41.32],...]]}
    Example output: POLYGON((-4.34 41.32, ...))
    """
    try:
        geo = json.loads(geo_str)
        coords = geo["coordinates"][0]
        points = ", ".join(f"{lon} {lat}" for lon, lat in coords)
        return f"POLYGON(({points}))"
    except Exception:
        return None


def build_row(row):
    """Map one CSV row to a tuple matching the INSERT column order."""
    return (
        row["hex_id"],
        int(row["year"]),
        parse_geo(row[".geo"]),                              # → WKT, wrapped below
        nan_to_none(row.get("lat")),
        nan_to_none(row.get("lon")),
        clip(row.get("CH4_anomaly_mean"), CH4_CLIP_LOW, CH4_CLIP_HIGH),
        nan_to_none(row.get("CH4_anomaly_stdDev")),
        nan_to_none(row.get("CH4_mean_mean")),
        nan_to_none(row.get("CH4_mean_stdDev")),
        nan_to_none(row.get("CH4_std_mean")),
        nan_to_none(row.get("CH4_std_stdDev")),
        nan_to_none(row.get("NDBI_mean")),
        nan_to_none(row.get("NDBI_stdDev")),
        nan_to_none(row.get("NDVI_mean")),
        nan_to_none(row.get("NDVI_stdDev")),
        nan_to_none(row.get("NDWI_mean")),
        nan_to_none(row.get("NDWI_stdDev")),
        nan_to_none(row.get("SWIR_anomaly_mean")),
        nan_to_none(row.get("SWIR_anomaly_stdDev")),
        nan_to_none(row.get("dist_ogim_mean")),
        nan_to_none(row.get("dist_ogim_stdDev")),
        nan_to_none(row.get("elevation_mean")),
        nan_to_none(row.get("elevation_stdDev")),
        nan_to_none(row.get("flux_proxy_mean")),
        nan_to_none(row.get("nightlights_mean")),
        nan_to_none(row.get("nightlights_stdDev")),
        nan_to_none(row.get("plume_mask_mean")),
        nan_to_none(row.get("slope_mean")),
        nan_to_none(row.get("slope_stdDev")),
        nan_to_none(row.get("wind_speed_mean")),
        nan_to_none(row.get("wind_speed_stdDev")),
    )


# geometry column (index 2) needs special handling — see insert loop below
INSERT_SQL = """
    INSERT INTO methane_observations (
        hex_id, year, geom, lat, lon,
        ch4_anomaly_mean, ch4_anomaly_std,
        ch4_mean_mean, ch4_mean_std,
        ch4_std_mean, ch4_std_std,
        ndbi_mean, ndbi_std,
        ndvi_mean, ndvi_std,
        ndwi_mean, ndwi_std,
        swir_anomaly_mean, swir_anomaly_std,
        dist_ogim_mean, dist_ogim_std,
        elevation_mean, elevation_std,
        flux_proxy_mean,
        nightlights_mean, nightlights_std,
        plume_mask_mean,
        slope_mean, slope_std,
        wind_speed_mean, wind_speed_std
    ) VALUES %s
    ON CONFLICT (hex_id, year) DO NOTHING
"""

# Template tells psycopg2 how to handle the geometry column
# ST_GeomFromText converts our WKT string into a PostGIS geometry
INSERT_TEMPLATE = """(
    %s, %s, ST_GeomFromText(%s, 4326), %s, %s,
    %s, %s, %s, %s, %s, %s,
    %s, %s, %s, %s, %s, %s, %s, %s,
    %s, %s, %s, %s, %s,
    %s, %s, %s,
    %s, %s, %s, %s
)"""


def ingest():
    print(f"Reading {CSV_PATH}...")
    df = pd.read_csv(CSV_PATH)
    print(f"  {len(df):,} rows, {df['year'].nunique()} years ({sorted(df['year'].unique())})")

    print("\nConnecting to Supabase...")
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    print("  Connected.\n")

    rows = [build_row(row) for _, row in df.iterrows()]
    total = len(rows)

    print(f"Inserting {total:,} rows in batches of {BATCH_SIZE}...")
    inserted = 0

    for i in range(0, total, BATCH_SIZE):
        batch = rows[i : i + BATCH_SIZE]
        execute_values(cur, INSERT_SQL, batch, template=INSERT_TEMPLATE, page_size=BATCH_SIZE)
        conn.commit()
        inserted += len(batch)
        pct = (inserted / total) * 100
        print(f"  {inserted:,} / {total:,}  ({pct:.0f}%)", end="\r")

    print(f"\n\nDone. {inserted:,} rows inserted.")

    # Sanity check
    cur.execute("SELECT year, COUNT(*) FROM methane_observations GROUP BY year ORDER BY year")
    print("\nRow counts by year in Supabase:")
    for year, count in cur.fetchall():
        print(f"  {year}: {count:,}")

    cur.close()
    conn.close()


if __name__ == "__main__":
    ingest()