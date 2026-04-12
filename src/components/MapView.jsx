import { useState, useCallback, useRef } from 'react'
import Map, { Source, Layer, NavigationControl, ScaleControl } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'

import { useHotspots }    from '../hooks/useHotspots'
import { usePlumes }      from '../hooks/usePlumes'
import { useUnepPlumes }  from '../hooks/useUnepPlumes'
import { LayerToggle }    from './LayerToggle'
import { PlumePopup }     from './PlumePopup'
import { UnepPlumePopup } from './unepPlumePopup'
import { SourcePanel, PANEL_WIDTH } from './sourcePanel'
import { YearSlider }     from './YearSlider'

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY
const MAP_STYLE    = `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${MAPTILER_KEY}`

// ── Hex polygon layers ────────────────────────────────────────────────────────
const hexFillLayer = {
  id:   'hex-fill',
  type: 'fill',
  paint: {
    'fill-color': [
      'case',
      ['==', ['get', 'ch4_anomaly'], null], 'rgba(0,0,0,0)',
      [
        'interpolate', ['linear'], ['get', 'ch4_anomaly'],
        -5,  '#1e3a5f',
        -2,  '#2563eb',
         0,  '#1e293b',
         1,  '#f59e0b',
         3,  '#ef4444',
         5,  '#7f1d1d',
      ]
    ],
    'fill-opacity': [
      'case',
      ['==', ['get', 'ch4_anomaly'], null], 0,
      0.75
    ],
  },
}

const hexOutlineLayer = {
  id:   'hex-outline',
  type: 'line',
  paint: {
    'line-color': [
      'case',
      ['>', ['get', 'ch4_anomaly'], 3], 'rgba(239,68,68,0.8)',
      'rgba(255,255,255,0.06)'
    ],
    'line-width': [
      'case',
      ['>', ['get', 'ch4_anomaly'], 3], 1.5,
      0.4
    ],
  },
}

const hexSelectedLayer = {
  id:   'hex-selected',
  type: 'line',
  paint: { 'line-color': '#fff', 'line-width': 2.5 },
}

// ── CarbonMapper plume layers ─────────────────────────────────────────────────
const plumeFillLayer = {
  id: 'plume-fill',
  type: 'fill',
  paint: { 'fill-color': 'transparent', 'fill-opacity': 0 },
}

const plumeOutlineLayer = {
  id: 'plume-outline',
  type: 'line',
  paint: { 'line-color': '#38bdf8', 'line-width': 1.5, 'line-opacity': 0.9 },
}

const plumeSelectedFillLayer = {
  id: 'plume-selected-fill',
  type: 'fill',
  paint: { 'fill-color': '#38bdf8', 'fill-opacity': 0.15 },
}

const plumeSelectedOutlineLayer = {
  id: 'plume-selected-outline',
  type: 'line',
  paint: { 'line-color': '#fff', 'line-width': 2, 'line-opacity': 1 },
}

// ── UNEP plume layers (point circles) ─────────────────────────────────────────
// Amber/gold colour to distinguish from CarbonMapper (sky blue)
const unepCircleLayer = {
  id:   'unep-circle',
  type: 'circle',
  paint: {
    'circle-radius': [
      'interpolate', ['linear'], ['zoom'],
      4,  4,
      8,  7,
      12, 12,
    ],
    'circle-color': [
      'interpolate', ['linear'],
      ['coalesce', ['get', 'ch4_fluxrate'], 0],
         0,  '#854d0e',   // dark amber — zero / unknown
      5000,  '#f59e0b',   // amber
     20000,  '#f97316',   // orange
     50000,  '#ef4444',   // red
    ],
    'circle-opacity': 0.85,
    'circle-stroke-width': 1.5,
    'circle-stroke-color': '#fbbf24',
    'circle-stroke-opacity': 0.6,
  },
}

// Invisible, larger hit-target circle for click detection
const unepHitLayer = {
  id:   'unep-hit',
  type: 'circle',
  paint: {
    'circle-radius': 14,
    'circle-opacity': 0,
    'circle-stroke-width': 0,
  },
}

// Highlight ring on selected UNEP point
const unepSelectedLayer = {
  id:   'unep-selected',
  type: 'circle',
  paint: {
    'circle-radius': [
      'interpolate', ['linear'], ['zoom'],
      4,  8,
      8,  12,
      12, 18,
    ],
    'circle-color':        'rgba(0,0,0,0)',
    'circle-stroke-width': 2.5,
    'circle-stroke-color': '#fff',
  },
}

// ── Layer definitions for toggle panel ───────────────────────────────────────
const LAYER_DEFS = [
  { id: 'hotspots', label: 'CH₄ Anomaly Grid (Sentinel-5P)',      color: '#ef4444', shape: 'square' },
  { id: 'plumes',   label: 'Plume Detections (CarbonMapper)',      color: '#38bdf8', shape: 'square' },
  { id: 'unep',     label: 'UNEP Sources (Spain)',                 color: '#f59e0b', shape: 'circle' },
]

function boundsToImageCoords(bounds) {
  const [minLon, minLat, maxLon, maxLat] = bounds
  return [
    [minLon, maxLat],
    [maxLon, maxLat],
    [maxLon, minLat],
    [minLon, minLat],
  ]
}

export function MapView() {
  const mapRef = useRef(null)

  const [year, setYear] = useState(2022)

  const { geojson: hotspotData,  loading: hotspotLoading } = useHotspots(year)
  const { geojson: plumeData,    loading: plumeLoading   } = usePlumes()
  const { geojson: unepData,     loading: unepLoading    } = useUnepPlumes('Spain')

  const [layerVisibility, setLayerVisibility] = useState({
    hotspots: true,
    plumes:   true,
    unep:     true,
  })

  const [selectedHex,      setSelectedHex]      = useState(null)
  const [selectedFeature,  setSelectedFeature]  = useState(null)   // CarbonMapper plume
  const [selectedUnep,     setSelectedUnep]     = useState(null)   // UNEP plume
  const [pngOverlay,       setPngOverlay]       = useState(null)
  const [panelOpen,        setPanelOpen]        = useState(true)

  const toggleLayer = useCallback((id) => {
    setLayerVisibility(prev => ({ ...prev, [id]: !prev[id] }))
  }, [])

  // Select a CarbonMapper plume
  const selectPlume = useCallback((feature) => {
    setSelectedFeature(feature)
    setSelectedHex(null)
    setSelectedUnep(null)

    const p = feature.properties
    const boundsRaw = p.plume_bounds_raw
    const png       = p.plume_png

    if (png && boundsRaw) {
      try {
        const bounds = JSON.parse(boundsRaw)
        setPngOverlay({ url: png, coordinates: boundsToImageCoords(bounds) })
        mapRef.current?.flyTo({
          center: [Number(p.lon), Number(p.lat)],
          zoom: 11, duration: 800,
          padding: { right: PANEL_WIDTH + 40 },
        })
      } catch {
        setPngOverlay(null)
      }
    } else {
      setPngOverlay(null)
      mapRef.current?.flyTo({
        center: [Number(p.lon), Number(p.lat)],
        zoom: 11, duration: 800,
        padding: { right: PANEL_WIDTH + 40 },
      })
    }
  }, [])

  // Select a UNEP plume point
  const selectUnepPlume = useCallback((feature) => {
    setSelectedUnep(feature)
    setSelectedFeature(null)
    setSelectedHex(null)
    setPngOverlay(null)
    mapRef.current?.flyTo({
      center: [Number(feature.properties.lon), Number(feature.properties.lat)],
      zoom: 10, duration: 800,
    })
  }, [])

  const handleMapClick = useCallback((e) => {
    const features = e.features || []

    // Priority: UNEP hit > CarbonMapper plume > hex
    const unepFeat = features.find(f => f.layer?.id === 'unep-hit')
    if (unepFeat) {
      selectUnepPlume(unepFeat)
      return
    }

    const plumeFeat = features.find(f => f.layer?.id === 'plume-fill')
    if (plumeFeat) {
      selectPlume(plumeFeat)
      return
    }

    const hexFeat = features.find(f => f.layer?.id === 'hex-fill')
    if (hexFeat) {
      setSelectedHex(hexFeat)
      setSelectedFeature(null)
      setSelectedUnep(null)
      setPngOverlay(null)
      return
    }

    // Clear all on empty click
    setSelectedHex(null)
    setSelectedFeature(null)
    setSelectedUnep(null)
    setPngOverlay(null)
  }, [selectPlume, selectUnepPlume])

  const handlePanelSelect = useCallback((feature) => {
    selectPlume(feature)
  }, [selectPlume])

  const selectedPlumeGeojson = selectedFeature
    ? { type: 'FeatureCollection', features: [selectedFeature] }
    : null

  const selectedHexGeojson = selectedHex
    ? { type: 'FeatureCollection', features: [selectedHex] }
    : null

  const selectedUnepGeojson = selectedUnep
    ? { type: 'FeatureCollection', features: [selectedUnep] }
    : null

  const layers        = LAYER_DEFS.map(l => ({ ...l, visible: layerVisibility[l.id] }))
  const plumeFeatures = plumeData?.features || []
  const isLoading     = hotspotLoading || plumeLoading || unepLoading

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', display: 'flex' }}>

      <div style={{
        flex: 1,
        marginRight: panelOpen ? PANEL_WIDTH : 0,
        transition: 'margin-right 0.2s ease',
        position: 'relative',
      }}>
        <Map
          ref={mapRef}
          initialViewState={{ longitude: -3.7, latitude: 40.4, zoom: 5 }}
          style={{ width: '100%', height: '100%' }}
          mapStyle={MAP_STYLE}
          onClick={handleMapClick}
          interactiveLayerIds={['hex-fill', 'plume-fill', 'unep-hit']}
          cursor="pointer"
        >
          <NavigationControl position="top-left" />
          <ScaleControl position="bottom-left" />

          {/* Hex anomaly grid */}
          {hotspotData && layerVisibility.hotspots && (
            <Source id="hotspots" type="geojson" data={hotspotData}>
              <Layer {...hexFillLayer} />
              <Layer {...hexOutlineLayer} />
            </Source>
          )}

          {/* Selected hex highlight */}
          {selectedHexGeojson && layerVisibility.hotspots && (
            <Source id="hex-selected" type="geojson" data={selectedHexGeojson}>
              <Layer {...hexSelectedLayer} />
            </Source>
          )}

          {/* CarbonMapper plume outlines */}
          {plumeData && layerVisibility.plumes && (
            <Source id="plumes" type="geojson" data={plumeData}>
              <Layer {...plumeFillLayer} />
              <Layer {...plumeOutlineLayer} />
            </Source>
          )}

          {/* Selected CarbonMapper plume highlight */}
          {selectedPlumeGeojson && layerVisibility.plumes && (
            <Source id="plume-selected" type="geojson" data={selectedPlumeGeojson}>
              <Layer {...plumeSelectedFillLayer} />
              <Layer {...plumeSelectedOutlineLayer} />
            </Source>
          )}

          {/* Plume PNG overlay */}
          {pngOverlay && (
            <Source id="plume-png" type="image" url={pngOverlay.url} coordinates={pngOverlay.coordinates}>
              <Layer id="plume-png-layer" type="raster" paint={{ 'raster-opacity': 0.85 }} />
            </Source>
          )}

          {/* UNEP Spain plumes — rendered on top */}
          {unepData && layerVisibility.unep && (
            <Source id="unep" type="geojson" data={unepData} cluster={false}>
              <Layer {...unepCircleLayer} />
              <Layer {...unepHitLayer} />
            </Source>
          )}

          {/* Selected UNEP highlight ring */}
          {selectedUnepGeojson && layerVisibility.unep && (
            <Source id="unep-selected" type="geojson" data={selectedUnepGeojson}>
              <Layer {...unepSelectedLayer} />
            </Source>
          )}

          {/* CarbonMapper popup */}
          <PlumePopup
            feature={selectedFeature}
            onClose={() => { setSelectedFeature(null); setPngOverlay(null) }}
          />

          {/* UNEP popup */}
          <UnepPlumePopup
            feature={selectedUnep}
            onClose={() => setSelectedUnep(null)}
          />
        </Map>

        {/* Layer toggles */}
        <LayerToggle
          layers={layers}
          onToggle={toggleLayer}
          panelOpen={panelOpen}
          onPanelToggle={() => setPanelOpen(p => !p)}
          plumeCount={plumeFeatures.length}
          year={year}
        />

        {/* Year slider */}
        <YearSlider year={year} onChange={setYear} />

        {/* Hex popup */}
        {selectedHex && (
          <HexPopup
            feature={selectedHex}
            onClose={() => setSelectedHex(null)}
          />
        )}

        {/* Loading indicator */}
        {isLoading && (
          <div style={{
            position: 'absolute', bottom: 120, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(15,20,30,0.85)', color: '#7dd3fc',
            padding: '8px 16px', borderRadius: 20, fontFamily: 'monospace', fontSize: 12,
            pointerEvents: 'none',
          }}>
            {hotspotLoading ? `Loading ${year} hex data…` : unepLoading ? 'Loading UNEP plumes…' : 'Loading plumes…'}
          </div>
        )}
      </div>

      {panelOpen && (
        <SourcePanel
          features={plumeFeatures}
          selectedId={selectedFeature?.properties?.id}
          onSelect={handlePanelSelect}
          onClose={() => setPanelOpen(false)}
        />
      )}
    </div>
  )
}

// ── Inline hex popup ──────────────────────────────────────────────────────────
function fmt(val, decimals = 2) {
  if (val === null || val === undefined) return '—'
  return Number(val).toFixed(decimals)
}

function HexPopup({ feature, onClose }) {
  const p = feature.properties

  const rows = [
    ['CH₄ Anomaly',   fmt(p.ch4_anomaly),   'ppb'],
    ['CH₄ Mean',      fmt(p.ch4_mean),       'ppb'],
    ['NDVI',          fmt(p.ndvi),           ''],
    ['NDBI',          fmt(p.ndbi),           ''],
    ['Elevation',     fmt(p.elevation, 0),   'm'],
    ['Slope',         fmt(p.slope),          '°'],
    ['Wind Speed',    fmt(p.wind_speed),     'm/s'],
    ['Dist. OGIM',    fmt(p.dist_ogim, 0),   'km'],
    ['Nightlights',   fmt(p.nightlights),    ''],
    ['Flux Proxy',    fmt(p.flux_proxy),     ''],
    ['Plume Mask',    fmt(p.plume_mask),     ''],
  ]

  return (
    <div style={{
      position: 'absolute',
      top: 16, left: 60,
      zIndex: 20,
      background: 'rgba(15, 20, 30, 0.92)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 10,
      padding: '14px 18px',
      fontFamily: 'monospace',
      fontSize: 12,
      color: '#fff',
      minWidth: 220,
      maxWidth: 260,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 10, color: '#7dd3fc', textTransform: 'uppercase', letterSpacing: 1 }}>Hex · {p.year}</div>
          <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>{p.hex_id}</div>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}
        >×</button>
      </div>

      <div style={{
        marginBottom: 12, padding: '6px 10px', borderRadius: 6,
        background: p.ch4_anomaly > 3 ? 'rgba(239,68,68,0.2)' : p.ch4_anomaly > 1 ? 'rgba(245,158,11,0.2)' : 'rgba(37,99,235,0.15)',
        border: `1px solid ${p.ch4_anomaly > 3 ? 'rgba(239,68,68,0.5)' : p.ch4_anomaly > 1 ? 'rgba(245,158,11,0.4)' : 'rgba(37,99,235,0.3)'}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontSize: 11, color: '#94a3b8' }}>CH₄ Anomaly</span>
        <span style={{
          fontSize: 15, fontWeight: 700,
          color: p.ch4_anomaly > 3 ? '#ef4444' : p.ch4_anomaly > 1 ? '#f59e0b' : '#60a5fa',
        }}>
          {fmt(p.ch4_anomaly)} ppb
        </span>
      </div>

      {rows.slice(1).map(([label, val, unit]) => (
        <div key={label} style={{
          display: 'flex', justifyContent: 'space-between',
          padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
        }}>
          <span style={{ color: '#64748b' }}>{label}</span>
          <span style={{ color: '#cbd5e1' }}>{val}{unit ? ` ${unit}` : ''}</span>
        </div>
      ))}
    </div>
  )
}