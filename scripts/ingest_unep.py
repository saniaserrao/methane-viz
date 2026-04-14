import math
import pandas as pd
import psycopg2
from psycopg2.extras import execute_values

# ── CONFIG ────────────────────────────────────────────────────────────────────
CSV_PATH = "../src/data/unep_detected_plumes.csv"

DATABASE_URL = "postgresql://postgres.iutqrxugdzuseimabaiq:XSRQ9NE$hBK6uN,@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres"

BATCH_SIZE = 500
# ─────────────────────────────────────────────────────────────────────────────


def nan_to_none(value):
    """Convert float NaN to None so psycopg2 inserts NULL."""
    if value is None:
        return None
    if isinstance(value, float) and math.isnan(value):
        return None
    return value


def build_row(row):
    """Map one CSV row to a tuple matching the INSERT column order."""
    return (
        str(row["id_plume"]),
        nan_to_none(row.get("source_name")),
        nan_to_none(row.get("satellite")),
        nan_to_none(row.get("tile_date")),
        float(row["lat"]),
        float(row["lon"]),
        # geom is a generated column — omitted, Postgres computes it from lat/lon
        nan_to_none(row.get("actionable")),
        bool(row["notified"]) if pd.notna(row.get("notified")) else None,
        nan_to_none(row.get("country")),
        nan_to_none(row.get("sector")),
        nan_to_none(row.get("detection_institution")),
        nan_to_none(row.get("quantification_institution")),
        nan_to_none(row.get("tile")),
        nan_to_none(row.get("ch4_fluxrate")),
        nan_to_none(row.get("ch4_fluxrate_std")),
        nan_to_none(row.get("wind_u")),
        nan_to_none(row.get("wind_v")),
        nan_to_none(row.get("total_emission")),
        nan_to_none(row.get("total_emission_std")),
        nan_to_none(row.get("wind_speed")),
        nan_to_none(row.get("last_update")),
        nan_to_none(row.get("insert_date")),
    )


INSERT_SQL = """
    INSERT INTO unep_plumes (
        id_plume, source_name, satellite, tile_date,
        lat, lon,
        actionable, notified, country, sector,
        detection_institution, quantification_institution, tile,
        ch4_fluxrate, ch4_fluxrate_std,
        wind_u, wind_v,
        total_emission, total_emission_std,
        wind_speed, last_update, insert_date
    ) VALUES %s
    ON CONFLICT (id_plume) DO NOTHING
"""

# geom is excluded — it's a generated column, Postgres fills it automatically
INSERT_TEMPLATE = """(
    %s, %s, %s, %s,
    %s, %s,
    %s, %s, %s, %s,
    %s, %s, %s,
    %s, %s,
    %s, %s,
    %s, %s,
    %s, %s, %s
)"""


def ingest():
    print(f"Reading {CSV_PATH}...")
    df = pd.read_csv(CSV_PATH)
    print(f"  {len(df):,} rows, {df['country'].nunique()} countries")

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
    cur.execute("SELECT country, COUNT(*) FROM unep_plumes GROUP BY country ORDER BY COUNT(*) DESC LIMIT 10")
    print("\nTop 10 countries by row count in Supabase:")
    for country, count in cur.fetchall():
        print(f"  {country}: {count:,}")

    cur.close()
    conn.close()


if __name__ == "__main__":
    ingest()