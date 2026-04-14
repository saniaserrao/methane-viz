import { useState, useCallback, useRef } from 'react'
import Map, { Source, Layer, NavigationControl, ScaleControl } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'

import { useMonthlyHotspots, useAvailableMonths, MONTH_NAMES } from '../hooks/useMonthlyHotspots'
import { useUnepPlumes } from '../hooks/useUnepPlumes'
import { LayerToggle } from './LayerToggle'
import { UnepPlumePopup } from './unepPlumePopup'
import { MonthYearPicker } from './MonthYearPicker'
import { LocationSearch } from './LocationSearch'

import demoGraph from '../assets/demo_graph.png'

var MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY
var MAP_STYLE = MAPTILER_KEY
  ? 'https://api.maptiler.com/maps/dataviz-dark/style.json?key=' + MAPTILER_KEY
  : 'https://demotiles.maplibre.org/style.json'

// The one special hex cell that supports trend view
var TREND_HEX_ID = '000000000000000008af'

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

var PICKER_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

// ---------------------------------------------------------------------------
// TrendMonthPicker — modal for selecting comparison month
// ---------------------------------------------------------------------------

function TrendMonthPicker(props) {
  var onConfirm = props.onConfirm
  var onClose = props.onClose

  var currentYear = new Date().getFullYear()
  var [pickerYear, setPickerYear] = useState(2025)
  var [pickerMonth, setPickerMonth] = useState(null) // 0-indexed

  function handleConfirm() {
    if (pickerMonth === null) return
    onConfirm({ year: pickerYear, month: pickerMonth + 1 })
  }

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(3px)',
      }}
      onClick={function (e) { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          background: 'rgba(12, 17, 27, 0.97)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 14,
          padding: '24px 28px',
          width: 320,
          boxShadow: '0 8px 40px rgba(0,0,0,0.7)',
          fontFamily: 'monospace',
          color: '#e2e8f0',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: 1 }}>View Trend</div>
            <div style={{ fontSize: 10, color: '#64748b', marginTop: 3 }}>Select comparison month</div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {/* Year row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <button
            onClick={function () { setPickerYear(function (y) { return y - 1 }); setPickerMonth(null) }}
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#94a3b8', cursor: 'pointer', width: 32, height: 32, fontSize: 16 }}
          >
            ‹
          </button>
          <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: 2 }}>{pickerYear}</span>
          <button
            onClick={function () { setPickerYear(function (y) { return y + 1 }); setPickerMonth(null) }}
            disabled={pickerYear >= currentYear}
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: pickerYear >= currentYear ? '#334155' : '#94a3b8', cursor: pickerYear >= currentYear ? 'default' : 'pointer', width: 32, height: 32, fontSize: 16 }}
          >
            ›
          </button>
        </div>

        {/* Month grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 20 }}>
          {PICKER_MONTHS.map(function (name, i) {
            var isSelected = pickerMonth === i
            return (
              <button
                key={name}
                onClick={function () { setPickerMonth(i) }}
                style={{
                  background: isSelected ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.04)',
                  border: isSelected ? '1px solid rgba(239,68,68,0.6)' : '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 7,
                  color: isSelected ? '#fca5a5' : '#94a3b8',
                  cursor: 'pointer',
                  padding: '7px 0',
                  fontSize: 11,
                  fontFamily: 'monospace',
                  transition: 'all 0.15s',
                }}
              >
                {name}
              </button>
            )
          })}
        </div>

        {/* Confirm */}
        <button
          onClick={handleConfirm}
          disabled={pickerMonth === null}
          style={{
            width: '100%',
            padding: '10px 0',
            borderRadius: 8,
            border: 'none',
            background: pickerMonth !== null ? 'rgba(239,68,68,0.8)' : 'rgba(255,255,255,0.06)',
            color: pickerMonth !== null ? '#fff' : '#475569',
            cursor: pickerMonth !== null ? 'pointer' : 'default',
            fontFamily: 'monospace',
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: 1,
            transition: 'all 0.15s',
          }}
        >
          {pickerMonth !== null
            ? 'Show trend for ' + PICKER_MONTHS[pickerMonth] + ' ' + pickerYear
            : 'Select a month'}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// TrendPanel — slides in from the right
// ---------------------------------------------------------------------------

function TrendPanel(props) {
  var open = props.open
  var onClose = props.onClose

  function handleDownload() {
    var a = document.createElement('a')
    a.href = demoGraph
    a.download = 'methara_trend_italy_jun_jul_2025.png'
    a.click()
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        zIndex: 30,
        width: 520,
        maxWidth: '90vw',
        background: 'rgba(10, 14, 22, 0.96)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderLeft: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.6)',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Panel header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '18px 20px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
        }}
      >
        <div>
          <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#7dd3fc', letterSpacing: 1, textTransform: 'uppercase' }}>
            CH₄ Trend Analysis
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#475569', marginTop: 3 }}>
            Italy · Jun – Jul 2025 · Hex 8af
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Download button */}
          <button
            onClick={handleDownload}
            title="Download graph as PNG"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 7,
              color: '#94a3b8',
              cursor: 'pointer',
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s',
            }}
            onMouseEnter={function (e) {
              e.currentTarget.style.background = 'rgba(255,255,255,0.12)'
              e.currentTarget.style.color = '#e2e8f0'
            }}
            onMouseLeave={function (e) {
              e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
              e.currentTarget.style.color = '#94a3b8'
            }}
          >
            {/* Download icon */}
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M7.5 1v9M4.5 7.5l3 3 3-3M2 12h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              fontSize: 20,
              lineHeight: 1,
              padding: '0 2px',
            }}
          >
            ×
          </button>
        </div>
      </div>

      {/* Graph image */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
          overflowY: 'auto',
        }}
      >
        <img
          src={demoGraph}
          alt="CH4 trend graph for Italy Jun–Jul 2025"
          style={{
            width: '100%',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.06)',
            display: 'block',
          }}
        />
      </div>
    </div>
  )
}

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

  // Trend feature state
  var [showTrendPicker, setShowTrendPicker] = useState(false)
  var [trendPanelOpen, setTrendPanelOpen] = useState(false)

  // Whether the "View Trend" button should appear:
  // only when the specific hex cell is selected AND we're on Jun 2025
  var isTrendHex = selectedHex &&
    selectedHex.properties &&
    selectedHex.properties.hex_id === TREND_HEX_ID &&
    selection.year === 2025 &&
    selection.month === 6

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

  function handleTrendConfirm(picked) {
    // Always show the panel regardless of what was picked (hardcoded POC)
    setShowTrendPicker(false)
    setTrendPanelOpen(true)
  }

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
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>

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
          <span
            style={{
              fontFamily: "'Nunito', 'Century Gothic', 'Futura', sans-serif",
              fontWeight: 300,
              fontSize: 16,
              letterSpacing: 7,
              textTransform: 'uppercase',
              color: '#e2e8f0',
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

      {/* ------------------------------------------------------------------ */}
      {/* View Trend button — bottom-center, only for the special hex         */}
      {/* ------------------------------------------------------------------ */}
      {isTrendHex && !trendPanelOpen && (
        <div
          style={{
            position: 'absolute',
            bottom: 40,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 25,
          }}
        >
          <button
            onClick={function () { setShowTrendPicker(true) }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 999,

              color: '#e2e8f0',
              cursor: 'pointer',
              fontFamily: 'monospace',
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: 1,
              padding: '10px 22px',
              
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              boxShadow: '0 6px 28px rgba(0,0,0,0.6)',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={function (e) {
              e.currentTarget.style.background = 'rgba(239,68,68,0.30)'
              e.currentTarget.style.color = '#ffffff'
            }}
            onMouseLeave={function (e) {
              e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
              e.currentTarget.style.color = '#e2e8f0'
            }}
          >
            {/* Sparkline icon */}
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <polyline points="1,10 4,6 7,8 10,3 13,5" stroke="#e2e8f0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </svg>
            View Trend
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Trend month picker modal                                            */}
      {/* ------------------------------------------------------------------ */}
      {showTrendPicker && (
        <TrendMonthPicker
          onConfirm={handleTrendConfirm}
          onClose={function () { setShowTrendPicker(false) }}
        />
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Trend side panel                                                    */}
      {/* ------------------------------------------------------------------ */}
      <TrendPanel
        open={trendPanelOpen}
        onClose={function () { setTrendPanelOpen(false) }}
      />

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