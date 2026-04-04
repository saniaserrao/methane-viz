import { useState, useEffect } from 'react'
import Papa from 'papaparse'
import plumeCsv from '../data/carbonmapper.csv?raw'
import imeCsv from '../data/ime_flux.csv?raw'

function parseIme() {
  const result = Papa.parse(imeCsv, { header: true, skipEmptyLines: true, dynamicTyping: true })
  // Build a lookup: scene_id → { flux_kg_s, uncertainty_kg_s, flux_ton_hr, uncertainty_ton_hr }
  const lookup = {}
  for (const row of result.data) {
    if (!row.scene_id) continue
    // A scene can have multiple plume rows — sum fluxes across plume_id entries for the same scene
    if (!lookup[row.scene_id]) {
      lookup[row.scene_id] = {
        flux_kg_s: 0,
        uncertainty_kg_s: 0,
        flux_ton_hr: 0,
        uncertainty_ton_hr: 0,
        ime_plume_count: 0,
      }
    }
    lookup[row.scene_id].flux_kg_s         += row.flux_kg_s         || 0
    lookup[row.scene_id].uncertainty_kg_s  += row.uncertainty_kg_s  || 0
    lookup[row.scene_id].flux_ton_hr       += row.flux_ton_hr       || 0
    lookup[row.scene_id].uncertainty_ton_hr+= row.uncertainty_ton_hr|| 0
    lookup[row.scene_id].ime_plume_count   += 1
  }
  return lookup
}

export function usePlumes() {
  const [geojson, setGeojson] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    try {
      const imeLookup = parseIme()

      const result = Papa.parse(plumeCsv, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
      })

      const features = result.data
        .filter(row => row.plume_bounds)
        .map(row => {
          const bounds = JSON.parse(row.plume_bounds)
          const [minLon, minLat, maxLon, maxLat] = bounds

          const coordinates = [[
            [minLon, minLat],
            [maxLon, minLat],
            [maxLon, maxLat],
            [minLon, maxLat],
            [minLon, minLat],
          ]]

          // Join IME flux data by plume_id === scene_id
          const ime = imeLookup[row.plume_id] || null

          return {
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates },
            properties: {
              id:                   row.plume_id,
              lat:                  row.plume_latitude,
              lon:                  row.plume_longitude,
              datetime:             row.datetime,
              sector:               row.ipcc_sector,
              emission:             row.emission_auto,           // CarbonMapper kg/hr
              emission_uncertainty: row.emission_uncertainty_auto,
              wind_speed:           row.wind_speed_avg_auto,
              wind_direction:       row.wind_direction_avg_auto,
              platform:             row.platform,
              plume_png:            row.plume_png,
              plume_bounds_raw:     row.plume_bounds,
              // IME fields — null if no match
              has_ime:              ime ? 1 : 0,
              ime_flux_ton_hr:      ime ? ime.flux_ton_hr       : null,
              ime_flux_kg_s:        ime ? ime.flux_kg_s         : null,
              ime_uncertainty_ton_hr: ime ? ime.uncertainty_ton_hr : null,
              ime_plume_count:      ime ? ime.ime_plume_count   : null,
            },
          }
        })

      setGeojson({ type: 'FeatureCollection', features })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  return { geojson, loading, error }
}