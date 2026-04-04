import { useState, useCallback, useRef } from 'react'
import Map, { Source, Layer, NavigationControl, ScaleControl } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'

import { useHotspots } from '../hooks/useHotspots'
import { usePlumes } from '../hooks/usePlumes'
import { LayerToggle } from './LayerToggle'
import { PlumePopup } from './PlumePopup'
import { SourcePanel, PANEL_WIDTH } from './sourcePanel'

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY
const MAP_STYLE = `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${MAPTILER_KEY}`

const hotspotHeatmapLayer = {
  id: 'hotspot-heatmap',
  type: 'heatmap',
  paint: {
    'heatmap-weight': ['interpolate', ['linear'], ['get', 'ch4'], 1700, 0, 2500, 1],
    'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 4, 1, 9, 3],
    'heatmap-color': [
      'interpolate', ['linear'], ['heatmap-density'],
      0,   'rgba(33,102,172,0)',
      0.2, 'rgba(103,169,207,0.6)',
      0.4, 'rgba(209,229,240,0.7)',
      0.6, 'rgba(253,219,199,0.8)',
      0.8, 'rgba(239,138,98,0.9)',
      1,   'rgba(178,24,43,1)',
    ],
    'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 4, 20, 9, 40],
    'heatmap-opacity': 0.85,
  },
}

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

const LAYER_DEFS = [
  { id: 'hotspots', label: 'CH4 Hotspots (Sentinel-5P)', color: '#ef4444', shape: 'circle' },
  { id: 'plumes',   label: 'Plume Detections (CarbonMapper)', color: '#38bdf8', shape: 'square' },
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
  const { geojson: hotspotData, loading: hotspotLoading } = useHotspots()
  const { geojson: plumeData,   loading: plumeLoading   } = usePlumes()

  const [layerVisibility, setLayerVisibility] = useState({ hotspots: true, plumes: true })
  const [selectedFeature, setSelectedFeature] = useState(null)
  const [pngOverlay, setPngOverlay]           = useState(null)
  const [panelOpen, setPanelOpen]             = useState(true)

  const toggleLayer = useCallback((id) => {
    setLayerVisibility(prev => ({ ...prev, [id]: !prev[id] }))
  }, [])

  // Shared logic: select a plume feature, set PNG overlay, fly map to it
  const selectPlume = useCallback((feature) => {
    setSelectedFeature(feature)

    const p = feature.properties
    const boundsRaw = p.plume_bounds_raw
    const png = p.plume_png

    if (png && boundsRaw) {
      try {
        const bounds = JSON.parse(boundsRaw)
        setPngOverlay({ url: png, coordinates: boundsToImageCoords(bounds) })

        // Fly map to plume center, offset left to account for panel width
        mapRef.current?.flyTo({
          center: [Number(p.lon), Number(p.lat)],
          zoom: 11,
          duration: 800,
          padding: { right: PANEL_WIDTH + 40 },
        })
      } catch {
        setPngOverlay(null)
      }
    } else {
      setPngOverlay(null)
      mapRef.current?.flyTo({
        center: [Number(p.lon), Number(p.lat)],
        zoom: 11,
        duration: 800,
        padding: { right: PANEL_WIDTH + 40 },
      })
    }
  }, [])

  const handleMapClick = useCallback((e) => {
    const features = e.features || []
    const plumeFeat = features.find(f => f.layer?.id === 'plume-fill')
    if (!plumeFeat) {
      setSelectedFeature(null)
      setPngOverlay(null)
      return
    }
    selectPlume(plumeFeat)
  }, [selectPlume])

  const handlePanelSelect = useCallback((feature) => {
    selectPlume(feature)
  }, [selectPlume])

  const selectedGeojson = selectedFeature
    ? { type: 'FeatureCollection', features: [selectedFeature] }
    : null

  const layers = LAYER_DEFS.map(l => ({ ...l, visible: layerVisibility[l.id] }))
  const plumeFeatures = plumeData?.features || []

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', display: 'flex' }}>

      {/* Map — shrinks when panel is open */}
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
          interactiveLayerIds={['plume-fill']}
          cursor="auto"
        >
          <NavigationControl position="top-left" />
          <ScaleControl position="bottom-left" />

          {hotspotData && layerVisibility.hotspots && (
            <Source id="hotspots" type="geojson" data={hotspotData}>
              <Layer {...hotspotHeatmapLayer} />
            </Source>
          )}

          {plumeData && layerVisibility.plumes && (
            <Source id="plumes" type="geojson" data={plumeData}>
              <Layer {...plumeFillLayer} />
              <Layer {...plumeOutlineLayer} />
            </Source>
          )}

          {selectedGeojson && layerVisibility.plumes && (
            <Source id="plume-selected" type="geojson" data={selectedGeojson}>
              <Layer {...plumeSelectedFillLayer} />
              <Layer {...plumeSelectedOutlineLayer} />
            </Source>
          )}

          {pngOverlay && (
            <Source id="plume-png" type="image" url={pngOverlay.url} coordinates={pngOverlay.coordinates}>
              <Layer id="plume-png-layer" type="raster" paint={{ 'raster-opacity': 0.85 }} />
            </Source>
          )}

          <PlumePopup
            feature={selectedFeature}
            onClose={() => { setSelectedFeature(null); setPngOverlay(null) }}
          />
        </Map>

        <LayerToggle
          layers={layers}
          onToggle={toggleLayer}
          panelOpen={panelOpen}
          onPanelToggle={() => setPanelOpen(p => !p)}
          plumeCount={plumeFeatures.length}
        />

        {(hotspotLoading || plumeLoading) && (
          <div style={{
            position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(15,20,30,0.85)', color: '#7dd3fc',
            padding: '8px 16px', borderRadius: 20, fontFamily: 'monospace', fontSize: 12,
          }}>
            Loading data…
          </div>
        )}
      </div>

      {/* Source panel */}
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