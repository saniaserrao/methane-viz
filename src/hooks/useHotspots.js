import { useState, useEffect } from 'react'
import { supabase } from './supaBaseClient'


const PAGE_SIZE = 1000

async function fetchAllRows(year) {
  let allRows = []
  let from = 0
  let done = false

  while (!done) {
    // Use ST_AsGeoJSON cast by calling a simple RPC that returns rows
    // PostgREST can't call ST_AsGeoJSON inline in .select(),
    // so we use a raw query via the rpc helper with a paged function
    const { data, error } = await supabase
      .rpc('get_hex_page', { p_year: year, p_from: from, p_limit: PAGE_SIZE })

    if (error) throw new Error(error.message)

    allRows = allRows.concat(data)

    if (data.length < PAGE_SIZE) {
      done = true
    } else {
      from += PAGE_SIZE
    }
  }

  return allRows
}

function rowsToGeojson(rows) {
  const features = rows.map(row => {
    const geometry = typeof row.geom_json === 'string'
      ? JSON.parse(row.geom_json)
      : row.geom_json

    return {
      type: 'Feature',
      geometry,
      properties: {
        hex_id:       row.hex_id,
        year:         row.year,
        lat:          row.lat,
        lon:          row.lon,
        ch4_anomaly:  row.ch4_anomaly_mean,
        ch4_mean:     row.ch4_mean_mean,
        ndvi:         row.ndvi_mean,
        ndbi:         row.ndbi_mean,
        ndwi:         row.ndwi_mean,
        elevation:    row.elevation_mean,
        slope:        row.slope_mean,
        wind_speed:   row.wind_speed_mean,
        dist_ogim:    row.dist_ogim_mean,
        nightlights:  row.nightlights_mean,
        flux_proxy:   row.flux_proxy_mean,
        plume_mask:   row.plume_mask_mean,
        swir_anomaly: row.swir_anomaly_mean,
      },
    }
  })

  return { type: 'FeatureCollection', features }
}

export function useHotspots(year = 2022) {
  const [geojson, setGeojson] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setGeojson(null)

    fetchAllRows(year)
      .then(rows => {
        if (cancelled) return
        setGeojson(rowsToGeojson(rows))
      })
      .catch(err => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [year])

  return { geojson, loading, error }
}