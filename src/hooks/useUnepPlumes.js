import { useState, useEffect } from 'react'
import { supabase } from './supaBaseClient'

const PAGE_SIZE = 1000
const COUNTRIES = ['Spain', 'Poland','Italy','Romania']

async function fetchAllUnepRows(country) {
  var allRows = []
  var from = 0
  var done = false

  while (!done) {
    var result = await supabase.rpc('get_unep_plumes_by_country', {
      p_country: country,
      p_from: from,
      p_limit: PAGE_SIZE,
    })

    if (result.error) {
      throw new Error('[' + country + '] ' + result.error.message)
    }

    var data = result.data || []
    allRows = allRows.concat(data)

    if (data.length < PAGE_SIZE) {
      done = true
    } else {
      from += PAGE_SIZE
    }
  }

  return allRows
}

function rowsToFeatures(rows, filterMonth) {
  var features = []

  for (var i = 0; i < rows.length; i++) {
    var row = rows[i]

    if (filterMonth !== null && filterMonth !== undefined) {
      if (!row.tile_date) continue
      var rowMonth = parseInt(row.tile_date.split('-')[1], 10)
      if (rowMonth !== filterMonth) continue
    }

    var tileDateStr = row.tile_date || ''
    var month = tileDateStr ? parseInt(tileDateStr.split('-')[1], 10) : null
    var year = tileDateStr ? parseInt(tileDateStr.split('-')[0], 10) : null

    features.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [Number(row.lon), Number(row.lat)],
      },
      properties: {
        id: row.id_plume,
        source_name: row.source_name,
        satellite: row.satellite,
        tile_date: row.tile_date,
        month: month,
        year: year,
        lat: row.lat,
        lon: row.lon,
        actionable: row.actionable,
        country: row.country,
        sector: row.sector,
        detection_institution: row.detection_institution,
        ch4_fluxrate: row.ch4_fluxrate,
        ch4_fluxrate_std: row.ch4_fluxrate_std,
        wind_speed: row.wind_speed,
        total_emission: row.total_emission,
        total_emission_std: row.total_emission_std,
      },
    })
  }

  return features
}

export function useUnepPlumes(month) {
  var [geojson, setGeojson] = useState(null)
  var [loading, setLoading] = useState(true)
  var [error, setError] = useState(null)

  useEffect(
    function () {
      var cancelled = false
      setLoading(true)
      setError(null)
      setGeojson(null)

      Promise.all(
        COUNTRIES.map(function (c) {
          return fetchAllUnepRows(c).catch(function (err) {
            console.error('Failed to fetch UNEP plumes for ' + c + ':', err.message)
            return []
          })
        })
      )
        .then(function (results) {
          if (cancelled) return
          var allFeatures = []
          for (var i = 0; i < results.length; i++) {
            var features = rowsToFeatures(results[i], month != null ? month : null)
            allFeatures = allFeatures.concat(features)
          }
          setGeojson({ type: 'FeatureCollection', features: allFeatures })
          setError(null)
        })
        .catch(function (err) {
          if (!cancelled) {
            console.error('Unexpected error in UNEP plumes fetch:', err.message)
            setError(err.message)
            setGeojson({ type: 'FeatureCollection', features: [] })
          }
        })
        .finally(function () {
          if (!cancelled) setLoading(false)
        })

      return function () {
        cancelled = true
      }
    },
    [month]
  )

  return { geojson: geojson, loading: loading, error: error }
}