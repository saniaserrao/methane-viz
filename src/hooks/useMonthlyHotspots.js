import { useState, useEffect, useRef } from 'react'
import { supabase } from './supaBaseClient'

const PAGE_SIZE = 1000

// ---------------------------------------------------------------------------
// Fetcher — one country at a time, paginated
// ---------------------------------------------------------------------------

async function fetchCountryRows(country, year, month) {
  var allRows = []
  var from = 0
  var done = false

  while (!done) {
    var result = await supabase.rpc('get_monthly_hex_page', {
      p_country: country,
      p_year: year,
      p_month: month,
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

// ---------------------------------------------------------------------------
// GeoJSON builder
// ---------------------------------------------------------------------------

function rowsToGeojson(rows) {
  var features = []

  for (var i = 0; i < rows.length; i++) {
    var row = rows[i]
    if (!row.geom_json) continue

    var geometry
    try {
      geometry =
      typeof row.geom_json === 'string'
    ? JSON.parse(row.geom_json)
    : JSON.parse(JSON.stringify(row.geom_json))
    } catch (e) {
      continue
    }

    if (!geometry) continue

    features.push({
      type: 'Feature',
      geometry: geometry,
      properties: {
        hex_id: row.hex_id,
        country: row.country,
        year: row.year,
        month: row.month,
        lat: row.lat,
        lon: row.lon,
        ch4_anomaly: row.ch4_zscore,
        ch4_mean: row.ch4_mean,
        ch4_persistence: row.ch4_persistence,
        ch4_std: row.ch4_std,
        ndvi: row.ndvi,
        ndbi: row.ndbi,
        ndwi: row.ndwi,
        ndmi: row.ndmi,
        bsi: row.bsi,
        swir1: row.swir1,
        swir2: row.swir2,
        elevation: row.elevation,
        slope: row.slope,
        wind_speed: row.wind_speed,
        wind_direction: row.wind_direction,
        nightlights: row.nightlights,
        infra_distance: row.infra_distance,
      },
    })
  }

  return { type: 'FeatureCollection', features: features }
}

// ---------------------------------------------------------------------------
// useMonthlyHotspots
//
// Fetches hex data for ALL countries that have data for the given year+month.
// `available` is stabilised with a JSON key so the effect doesn't re-fire
// on every render when the parent passes a new array reference.
// ---------------------------------------------------------------------------

export function useMonthlyHotspots(year, month, available) {
  var [geojson, setGeojson] = useState(null)
  var [loading, setLoading] = useState(false)
  var [error, setError] = useState(null)

  // Stable string key from available — avoids infinite loop from new array ref
  var availableKey = JSON.stringify(
    (available || [])
      .filter(function (a) { return a.year === year && a.month === month })
      .map(function (a) { return a.country })
      .sort()
  )

  useEffect(
    function () {
      if (!year || !month) {
        setGeojson(null)
        setLoading(false)
        return
      }

      var countries
      try {
        countries = JSON.parse(availableKey)
      } catch (e) {
        countries = []
      }

      if (countries.length === 0) {
        setGeojson({ type: 'FeatureCollection', features: [] })
        setLoading(false)
        setError(null)
        return
      }

      var cancelled = false
      setLoading(true)
      setError(null)
      setGeojson(null)

      Promise.all(
        countries.map(function (country) {
          return fetchCountryRows(country, year, month).catch(function (err) {
            console.error('Hex fetch failed for ' + country + ':', err.message)
            return []
          })
        })
      )
        .then(function (results) {
          if (cancelled) return
          var allRows = []
          for (var i = 0; i < results.length; i++) {
            allRows = allRows.concat(results[i])
          }
          console.log(
            '[useMonthlyHotspots] fetched ' + allRows.length + ' rows for ' +
            year + '-' + month + ' countries=' + countries.join(',')
          )
          setGeojson(rowsToGeojson(allRows))
        })
        .catch(function (err) {
          if (!cancelled) {
            console.error('[useMonthlyHotspots] unexpected error:', err)
            setError(err.message)
          }
        })
        .finally(function () {
          if (!cancelled) setLoading(false)
        })

      return function () {
        cancelled = true
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [year, month, availableKey]
  )

  return { geojson: geojson, loading: loading, error: error }
}

// ---------------------------------------------------------------------------
// useAvailableMonths
// ---------------------------------------------------------------------------

export function useAvailableMonths() {
  var [available, setAvailable] = useState(FALLBACK_AVAILABLE)
  var [loading, setLoading] = useState(true)

  useEffect(function () {
    supabase
      .rpc('get_available_months')
      .then(function (result) {
        if (result.error) {
          console.error('useAvailableMonths:', result.error.message)
          setAvailable(FALLBACK_AVAILABLE)
        } else {
          setAvailable(
            result.data && result.data.length > 0
              ? result.data
              : FALLBACK_AVAILABLE
          )
        }
      })
      .catch(function (err) {
        console.error('useAvailableMonths error:', err.message)
        setAvailable(FALLBACK_AVAILABLE)
      })
      .finally(function () {
        setLoading(false)
      })
  }, [])

  return { available: available, loading: loading }
}

// ---------------------------------------------------------------------------
// Constants / helpers
// ---------------------------------------------------------------------------

export var FALLBACK_AVAILABLE = [
  { country: 'Romania', year: 2025, month: 8 },
  { country: 'Romania', year: 2025, month: 9 },
  { country: 'Poland', year: 2026, month: 2 },
  { country: 'Poland', year: 2026, month: 3 },
  { country: 'Italy', year: 2025, month: 6 },
  { country: 'Italy', year: 2025, month: 7 },
]

export var MONTH_NAMES = [
  '',
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec',
]

export function groupAvailable(available) {
  var result = {}
  var list = available || []
  for (var i = 0; i < list.length; i++) {
    var entry = list[i]
    var country = entry.country
    var year = entry.year
    var month = entry.month
    if (!result[country]) result[country] = {}
    if (!result[country][year]) result[country][year] = []
    result[country][year].push(month)
  }
  return result
}