/**
 * UnepPlumePopup.jsx
 * Anchored to the plume point via react-map-gl Popup.
 * Styled to match the dark monospace aesthetic of the app.
 */

import { Popup } from 'react-map-gl/maplibre'

function formatDate(dt) {
  if (!dt) return '—'
  const d = new Date(dt)
  if (isNaN(d.getTime())) return String(dt)
  return d.toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
  })
}

function fmt(val, decimals = 1) {
  return val != null ? Number(val).toFixed(decimals) : '—'
}

export function UnepPlumePopup({ feature, onClose }) {
  if (!feature) return null
  const p = feature.properties

 

  const fluxColor =
    p.ch4_fluxrate >= 60000 ? '#fde047' :   // yellow
    p.ch4_fluxrate >= 40000 ? '#f97316' :   // orange
    p.ch4_fluxrate >= 20000 ? '#d4548a' :   // magenta
    p.ch4_fluxrate >=  5000 ? '#7b2d8b' :   // deep purple
                              '#0d0221'      // near-black

  const rows = [
    ['Sector',      p.sector                || '—'],
    ['Date',        formatDate(p.tile_date)       ],
    ['Wind',        p.wind_speed != null ? `${fmt(p.wind_speed)} m/s` : '—'],
  ]

  return (
    <Popup
      longitude={Number(p.lon)}
      latitude={Number(p.lat)}
      onClose={onClose}
      closeButton={false}
      closeOnClick={false}
      anchor="bottom"
      offset={16}
      maxWidth="300px"
      style={{ zIndex: 20 }}
    >
      {/* Override maplibre popup chrome */}
      <style>{`
        .maplibregl-popup-content {
          background: rgba(15, 20, 30, 0.95) !important;
          backdrop-filter: blur(10px) !important;
          border: 1px solid rgba(255,255,255,0.1) !important;
          border-radius: 10px !important;
          padding: 0 !important;
          box-shadow: 0 8px 32px rgba(0,0,0,0.5) !important;
          font-family: monospace !important;
        }
        .maplibregl-popup-tip {
          border-top-color: rgba(15, 20, 30, 0.95) !important;
        }
      `}</style>

      <div style={{ padding: '14px 16px', minWidth: 240, maxWidth: 280 }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#f97316' }}>
              UNEP Plume · {p.country}
            </div>
            <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>
              {p.satellite || '—'}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={onClose}
              style={{
                background: 'none', border: 'none', color: '#94a3b8',
                cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0,
              }}
            >×</button>
          </div>
        </div>

        {/* Info rows */}
        {rows.map(([label, val]) => (
          <div key={label} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
            padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', gap: 12,
          }}>
            <span style={{ color: '#64748b', flexShrink: 0, fontSize: 11 }}>{label}</span>
            <span style={{ color: '#cbd5e1', textAlign: 'right', fontSize: 11, wordBreak: 'break-word' }}>{val}</span>
          </div>
        ))}

        {/* Divider + emission section */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', margin: '10px 0 8px' }} />

        <div style={{ fontSize: 9, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
          Emission Estimate (UNEP IMEO MARS)
        </div>

        {/* CH4 flux hero */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: '#64748b' }}>CH₄ flux (kg/hr)</span>
          <span style={{ fontSize: 18, fontWeight: 700, color: fluxColor }}>
            {p.ch4_fluxrate != null ? fmt(p.ch4_fluxrate, 0) : '—'}
            {p.ch4_fluxrate_std != null && (
              <span style={{ fontSize: 12, fontWeight: 400, color: '#64748b' }}>
                {' '}± {fmt(p.ch4_fluxrate_std, 0)}
              </span>
            )}
          </span>
        </div>

        {/* Total emission */}
        {p.total_emission != null && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 11, color: '#64748b' }}>Total emission</span>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>
              {fmt(p.total_emission, 0)}
              {p.total_emission_std != null && (
                <span style={{ color: '#64748b' }}> ± {fmt(p.total_emission_std, 0)}</span>
              )}
            </span>
          </div>
        )}
      </div>
    </Popup>
  )
}