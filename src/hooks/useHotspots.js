import { useState, useEffect } from 'react'
import Papa from 'papaparse'
import hotspotCsv from '../data/hotspot.csv?raw'

export function useHotspots() {
  const [geojson, setGeojson] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    try {
      const result = Papa.parse(hotspotCsv, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
      })

      const features = result.data
        .filter(row => row.latitude && row.longitude)
        .map(row => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [row.longitude, row.latitude], // GeoJSON is [lon, lat]
          },
          properties: {
            ch4: row['CH4_column_volume_mixing_ratio_dry_air_bias_corrected'],
            month: row.month,
            year: row.year,
            id: row['system:index'],
          },
        }))

      setGeojson({ type: 'FeatureCollection', features })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  return { geojson, loading, error }
}
