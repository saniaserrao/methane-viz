import { useRef, useEffect } from 'react'

const PANEL_WIDTH = 320

function formatDate(dt) {
  if (!dt) return '—'
  const fixed = String(dt).replace(/([+-]\d{2})$/, '$1:00')
  const d = new Date(fixed)
  if (isNaN(d.getTime())) return String(dt)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

function fmt(val, decimals = 0) {
  if (val == null) return null
  const n = Number(val)
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return n.toFixed(decimals)
}

function Card({ feature, isSelected, onClick }) {
  const p = feature.properties
  const ref = useRef(null)

  // Scroll selected card into view
  useEffect(() => {
    if (isSelected && ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [isSelected])

  const emission = p.emission != null ? fmt(p.emission) : null
  const uncertainty = p.emission_uncertainty != null ? fmt(p.emission_uncertainty) : null
  const imeFlux = p.ime_flux_ton_hr != null ? fmt(p.ime_flux_ton_hr) : null
  const hasIme = p.has_ime === 1

  return (
    <div
      ref={ref}
      onClick={onClick}
      style={{
        display: 'flex',
        gap: 12,
        padding: '12px 14px',
        cursor: 'pointer',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: isSelected ? 'rgba(56,189,248,0.12)' : 'transparent',
        borderLeft: isSelected ? '3px solid #38bdf8' : '3px solid transparent',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
    >
      {/* Plume PNG thumbnail */}
      <div style={{
        width: 64, height: 64, flexShrink: 0,
        borderRadius: 6, overflow: 'hidden',
        background: 'rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {p.plume_png
          ? <img src={p.plume_png} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={e => { e.target.style.display = 'none' }} />
          : <span style={{ fontSize: 20 }}>🌫️</span>
        }
      </div>

      {/* Card content */}
      <div style={{ flex: 1, minWidth: 0 }}>

        {/* Title — sector */}
        <div style={{
          fontWeight: 700, fontSize: 13, color: '#f1f5f9',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          marginBottom: 2,
        }}>
          {p.sector || 'Unknown Sector'}
        </div>

        {/* Coords + date */}
        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>
          {Number(p.lat).toFixed(4)}, {Number(p.lon).toFixed(4)}
          <br />
          {formatDate(p.datetime)}
          {p.platform && <span style={{ marginLeft: 6, color: '#475569' }}>· {p.platform}</span>}
        </div>

        {/* Emission values */}
        {emission && (
          <div style={{ marginBottom: 2 }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: '#f1f5f9', letterSpacing: -0.5 }}>
              {emission}
            </span>
            {uncertainty && (
              <span style={{ fontSize: 12, color: '#64748b', marginLeft: 4 }}>+/- {uncertainty}</span>
            )}
            <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>MFA emission (kg CH4/hr)</div>
          </div>
        )}

        {/* IME flux if present and MFA missing */}
        {!emission && imeFlux && (
          <div style={{ marginBottom: 2 }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: '#f1f5f9', letterSpacing: -0.5 }}>
              {imeFlux}
            </span>
            <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>IME flux (t/hr)</div>
          </div>
        )}

     
      </div>
    </div>
  )
}

export function SourcePanel({ features, selectedId, onSelect, onClose }) {
  if (!features || features.length === 0) return null

  return (
    <div style={{
      position: 'absolute',
      top: 0, right: 0,
      width: PANEL_WIDTH,
      height: '100vh',
      background: 'rgba(10,15,25,0.92)',
      backdropFilter: 'blur(12px)',
      borderLeft: '1px solid rgba(255,255,255,0.08)',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'monospace',
      zIndex: 10,
    }}>

      {/* Header */}
      <div style={{
        padding: '14px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#f1f5f9' }}>Sources</div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
            {features.length} plume{features.length !== 1 ? 's' : ''} detected
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', color: '#64748b',
            cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4,
          }}
        >×</button>
      </div>

      {/* Scrollable list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {features.map(f => (
          <Card
            key={f.properties.id}
            feature={f}
            isSelected={f.properties.id === selectedId}
            onClick={() => onSelect(f)}
          />
        ))}
      </div>
    </div>
  )
}

export { PANEL_WIDTH }