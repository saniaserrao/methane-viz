/**
 * useUnepPlumes.js
 *
 * Fetches UNEP detected plumes for a given country from Supabase.
 * Falls back to the bundled Spain GeoJSON if Supabase is unavailable.
 *
 * Usage:
 *   const { geojson, loading, error } = useUnepPlumes('Spain')
 */

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

const PAGE_SIZE = 1000

async function fetchAllUnepRows(country) {
  let allRows = []
  let from = 0
  let done = false

  while (!done) {
    const { data, error } = await supabase
      .rpc('get_unep_plumes_by_country', {
        p_country: country,
        p_from:    from,
        p_limit:   PAGE_SIZE,
      })

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
  const features = rows.map(row => ({
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [Number(row.lon), Number(row.lat)],
    },
    properties: {
      id:                   row.id_plume,
      source_name:          row.source_name,
      satellite:            row.satellite,
      tile_date:            row.tile_date,
      lat:                  row.lat,
      lon:                  row.lon,
      actionable:           row.actionable,
      country:              row.country,
      sector:               row.sector,
      detection_institution: row.detection_institution,
      ch4_fluxrate:         row.ch4_fluxrate,         // kg CH4/hr
      ch4_fluxrate_std:     row.ch4_fluxrate_std,
      wind_speed:           row.wind_speed,
      total_emission:       row.total_emission,
      total_emission_std:   row.total_emission_std,
    },
  }))

  return { type: 'FeatureCollection', features }
}

export function useUnepPlumes(country = 'Spain') {
  const [geojson,  setGeojson]  = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setGeojson(null)

    fetchAllUnepRows(country)
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
  }, [country])

  return { geojson, loading, error }
}