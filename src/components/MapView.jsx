import { useState, useCallback, useRef } from 'react'
import Map, { Source, Layer, NavigationControl, ScaleControl } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'

import { useMonthlyHotspots, useAvailableMonths, MONTH_NAMES } from '../hooks/useMonthlyHotspots'
import { useUnepPlumes } from '../hooks/useUnepPlumes'
import { LayerToggle } from './LayerToggle'
import { UnepPlumePopup } from './unepPlumePopup'
import { MonthYearPicker } from './MonthYearPicker'
import { LocationSearch } from './LocationSearch'



var MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY
var MAP_STYLE = MAPTILER_KEY
  ? 'https://api.maptiler.com/maps/dataviz-dark/style.json?key=' + MAPTILER_KEY
  : 'https://demotiles.maplibre.org/style.json'

// ---------------------------------------------------------------------------
// Hex layers
// ---------------------------------------------------------------------------

var hexFillLayer = {
  id: 'hex-fill',
  type: 'fill',
  paint: {
    'fill-color': [
      'case',
      ['!', ['has', 'ch4_mean']],
      'rgba(0,0,0,0)',
      [
        'interpolate', ['linear'], ['get', 'ch4_mean'],
        1800, '#1e3a5f',
        1840, '#2563eb',
        1875, '#1e293b',
        1900, '#f59e0b',
        1920, '#ef4444',
        1950, '#7f1d1d',
      ],
    ],
    'fill-opacity': [
      'case',
      ['!', ['has', 'ch4_mean']],
      0,
      0.75,
    ],
  },
}

var hexOutlineLayer = {
  id: 'hex-outline',
  type: 'line',
  paint: {
    'line-color': [
      'case',
      ['>', ['coalesce', ['get', 'ch4_mean'], 0], 1920],
      'rgba(239,68,68,0.8)',
      'rgba(255,255,255,0.06)',
    ],
    'line-width': [
      'case',
      ['>', ['coalesce', ['get', 'ch4_mean'], 0], 1920],
      1.5,
      0.4,
    ],
  },
}

var hexSelectedLayer = {
  id: 'hex-selected',
  type: 'line',
  paint: { 'line-color': '#fff', 'line-width': 2.5 },
}

// ---------------------------------------------------------------------------
// UNEP layers
// ---------------------------------------------------------------------------

var unepCircleLayer = {
  id: 'unep-circle',
  type: 'circle',
  paint: {
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 4, 8, 7, 12, 12],
    'circle-color': [
      'interpolate', ['linear'],
      ['coalesce', ['get', 'ch4_fluxrate'], 0],
      0,     '#0d0221',
      2000,  '#3b0764',
      8000,  '#7b2d8b',
      20000, '#d4548a',
      35000, '#f97316',
      60000, '#fde047',
    ],
    'circle-opacity': 0.85,
    'circle-stroke-width': 1.5,
    'circle-stroke-color': '#fbbf24',
    'circle-stroke-opacity': 0.6,
  },
}

var unepHitLayer = {
  id: 'unep-hit',
  type: 'circle',
  paint: { 'circle-radius': 14, 'circle-opacity': 0, 'circle-stroke-width': 0 },
}

var unepSelectedLayer = {
  id: 'unep-selected',
  type: 'circle',
  paint: {
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 8, 8, 12, 12, 18],
    'circle-color': 'rgba(0,0,0,0)',
    'circle-stroke-width': 2.5,
    'circle-stroke-color': '#fff',
  },
}

// ---------------------------------------------------------------------------
// Layer definitions
// ---------------------------------------------------------------------------

var LAYER_DEFS = [
  { id: 'hotspots', label: 'CH4 Concentration Grid', color: '#ef4444', shape: 'square' },
  { id: 'unep', label: 'Plumes and Sources', color: '#f59e0b', shape: 'circle' },
]

var DEFAULT_SELECTION = { year: 2025, month: 8 }

// ---------------------------------------------------------------------------
// MapView
// ---------------------------------------------------------------------------

export function MapView() {
  var mapRef = useRef(null)

  var [selection, setSelection] = useState(DEFAULT_SELECTION)
  var availResult = useAvailableMonths()
  var available = availResult.available

  var hotspotResult = useMonthlyHotspots(selection.year, selection.month, available)
  var hotspotData = hotspotResult.geojson
  var hotspotLoading = hotspotResult.loading
  var hotspotError = hotspotResult.error

  var unepResult = useUnepPlumes(selection.month)
  var unepData = unepResult.geojson
  var unepLoading = unepResult.loading

  var [layerVisibility, setLayerVisibility] = useState({ hotspots: true, unep: true })

  var toggleLayer = useCallback(function (id) {
    setLayerVisibility(function (prev) {
      var next = {}
      for (var k in prev) next[k] = prev[k]
      next[id] = !prev[id]
      return next
    })
  }, [])

  var [selectedHex, setSelectedHex] = useState(null)
  var [selectedUnep, setSelectedUnep] = useState(null)

  var selectUnepPlume = useCallback(function (feature) {
    setSelectedUnep(feature)
    setSelectedHex(null)
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: [Number(feature.properties.lon), Number(feature.properties.lat)],
        zoom: 10,
        duration: 800,
      })
    }
  }, [])

  var handleMapClick = useCallback(
    function (e) {
      var features = e.features || []
      var unepFeat = null
      var hexFeat = null
      for (var i = 0; i < features.length; i++) {
        if (features[i].layer && features[i].layer.id === 'unep-hit') {
          unepFeat = features[i]; break
        }
      }
      if (unepFeat) { selectUnepPlume(unepFeat); return }
      for (var j = 0; j < features.length; j++) {
        if (features[j].layer && features[j].layer.id === 'hex-fill') {
          hexFeat = features[j]; break
        }
      }
      if (hexFeat) { setSelectedHex(hexFeat); setSelectedUnep(null); return }
      setSelectedHex(null)
      setSelectedUnep(null)
    },
    [selectUnepPlume]
  )

  var handleLocationResult = useCallback(function (result) {
    var map = mapRef.current
    if (!map) return
    if (result.bbox) {
      map.fitBounds(
        [[result.bbox[0], result.bbox[1]], [result.bbox[2], result.bbox[3]]],
        { padding: 60, duration: 900, maxZoom: 14 }
      )
    } else {
      map.flyTo({ center: [result.longitude, result.latitude], zoom: 10, duration: 900 })
    }
  }, [])

  var selectedHexGeojson = selectedHex
    ? { type: 'FeatureCollection', features: [selectedHex] }
    : null
  var selectedUnepGeojson = selectedUnep
    ? { type: 'FeatureCollection', features: [selectedUnep] }
    : null

  var layers = LAYER_DEFS.map(function (l) {
    return Object.assign({}, l, { visible: layerVisibility[l.id] })
  })

  var isLoading = hotspotLoading || unepLoading
  if (hotspotError) console.error('[MapView] hotspot error:', hotspotError)

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>

      {/* ------------------------------------------------------------------ */}
      {/* Pill title bar — centered, floating                                 */}
      {/* ------------------------------------------------------------------ */}
      <div
        style={{
          position: 'absolute',
          top: 14,
          left: 0,
          right: 0,
          zIndex: 20,
          pointerEvents: 'none',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(10, 14, 22, 0.82)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 999,
            padding: '7px 28px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
          }}
        >
          {/* Logo — mix-blend-mode strips white background without needing a PNG with transparency */}
          <span
            style={{
              fontFamily: "'Nunito', 'Century Gothic', 'Futura', sans-serif",
              fontWeight: 300,
              fontSize: 16,
              letterSpacing: 7,
              textTransform: 'uppercase',
              color: '#e2e8f0',
              // Offset the letter-spacing on the last character so text is visually centred
              paddingLeft: 7,
            }}
          >
            Methara
          </span>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Map                                                                 */}
      {/* ------------------------------------------------------------------ */}
      <Map
        ref={mapRef}
        initialViewState={{ longitude: 20, latitude: 47, zoom: 4.5 }}
        style={{ width: '100%', height: '100%' }}
        mapStyle={MAP_STYLE}
        onClick={handleMapClick}
        interactiveLayerIds={['hex-fill', 'unep-hit']}
        cursor="pointer"
      >
        <NavigationControl position="top-left" />
        <ScaleControl position="bottom-left" />

        {hotspotData && layerVisibility.hotspots && (
          <Source id="hotspots" type="geojson" data={hotspotData}>
            <Layer {...hexFillLayer} />
            <Layer {...hexOutlineLayer} />
          </Source>
        )}

        {selectedHexGeojson && layerVisibility.hotspots && (
          <Source id="hex-selected" type="geojson" data={selectedHexGeojson}>
            <Layer {...hexSelectedLayer} />
          </Source>
        )}

        {unepData && layerVisibility.unep && (
          <Source id="unep" type="geojson" data={unepData} cluster={false}>
            <Layer {...unepCircleLayer} />
            <Layer {...unepHitLayer} />
          </Source>
        )}

        {selectedUnepGeojson && layerVisibility.unep && (
          <Source id="unep-selected" type="geojson" data={selectedUnepGeojson}>
            <Layer {...unepSelectedLayer} />
          </Source>
        )}

        <UnepPlumePopup feature={selectedUnep} onClose={function () { setSelectedUnep(null) }} />
      </Map>

      {/* Location search — top-left, beside nav controls */}
      <div style={{ position: 'absolute', top: 16, left: 52, zIndex: 10 }}>
        <LocationSearch onResult={handleLocationResult} />
      </div>

      {/* Month/year picker — bottom-left */}
      <div style={{ position: 'absolute', bottom: 40, left: 16, zIndex: 10 }}>
        <MonthYearPicker
          available={available}
          selection={selection}
          onChange={setSelection}
        />
      </div>

      {/* Layer toggles + legend — top-right */}
      <LayerToggle layers={layers} onToggle={toggleLayer} />

      {/* Hex popup */}
      {selectedHex && (
        <HexPopup feature={selectedHex} onClose={function () { setSelectedHex(null) }} />
      )}

      {/* Loading indicator */}
      {isLoading && (
        <div
          style={{
            position: 'absolute',
            bottom: 120,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(15,20,30,0.85)',
            color: '#7dd3fc',
            padding: '8px 16px',
            borderRadius: 20,
            fontFamily: 'monospace',
            fontSize: 12,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          {hotspotLoading
            ? 'Loading hex data for ' + MONTH_NAMES[selection.month] + ' ' + selection.year + '...'
            : 'Loading plumes...'}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// HexPopup
// ---------------------------------------------------------------------------

function fmt(val, decimals) {
  var d = decimals !== undefined ? decimals : 2
  if (val === null || val === undefined) return '--'
  return Number(val).toFixed(d)
}

var MONTH_NAMES_FULL = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function HexPopup(props) {
  var feature = props.feature
  var onClose = props.onClose
  var p = feature.properties

  var rows = [
    ['CH4 Z-Score',     fmt(p.ch4_anomaly),       'sigma'],
    ['CH4 Persistence', fmt(p.ch4_persistence),   ''],
    ['CH4 Std Dev',     fmt(p.ch4_std),           'ppb'],
    ['NDVI',            fmt(p.ndvi),              ''],
    ['NDBI',            fmt(p.ndbi),              ''],
    ['NDWI',            fmt(p.ndwi),              ''],
    ['BSI',             fmt(p.bsi),               ''],
    ['Elevation',       fmt(p.elevation, 0),      'm'],
    ['Slope',           fmt(p.slope),             'deg'],
    ['Wind Speed',      fmt(p.wind_speed),        'm/s'],
    ['Wind Dir',        fmt(p.wind_direction),    'deg'],
    ['Nightlights',     fmt(p.nightlights),       ''],
    ['Infra Distance',  fmt(p.infra_distance, 0), 'km'],
  ]

  var ch4ppb = p.ch4_mean
  var heroColor  = ch4ppb >= 1920 ? '#ef4444' : ch4ppb >= 1900 ? '#f59e0b' : '#60a5fa'
  var heroBg     = ch4ppb >= 1920 ? 'rgba(239,68,68,0.2)'  : ch4ppb >= 1900 ? 'rgba(245,158,11,0.2)'  : 'rgba(37,99,235,0.15)'
  var heroBorder = ch4ppb >= 1920 ? '1px solid rgba(239,68,68,0.5)' : ch4ppb >= 1900 ? '1px solid rgba(245,158,11,0.4)' : '1px solid rgba(37,99,235,0.3)'

  return (
    <div
      style={{
        position: 'absolute', top: 70, left: 60, zIndex: 20,
        background: 'rgba(15, 20, 30, 0.92)', backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
        padding: '14px 18px', fontFamily: 'monospace', fontSize: 12, color: '#fff',
        minWidth: 220, maxWidth: 260, maxHeight: 'calc(100vh - 160px)', overflowY: 'auto',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 10, color: '#7dd3fc', textTransform: 'uppercase', letterSpacing: 1 }}>
            {p.country ? p.country + ' - ' : ''}{MONTH_NAMES_FULL[p.month]} {p.year}
          </div>
          <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>{p.hex_id}</div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>
          x
        </button>
      </div>

      <div style={{ marginBottom: 12, padding: '6px 10px', borderRadius: 6, background: heroBg, border: heroBorder, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: '#94a3b8' }}>CH4 Mean</span>
        <span style={{ fontSize: 15, fontWeight: 700, color: heroColor }}>{fmt(ch4ppb, 1)} ppb</span>
      </div>

      {rows.map(function (row) {
        return (
          <div key={row[0]} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <span style={{ color: '#64748b' }}>{row[0]}</span>
            <span style={{ color: '#cbd5e1' }}>{row[1]}{row[2] ? ' ' + row[2] : ''}</span>
          </div>
        )
      })}
    </div>
  )
}