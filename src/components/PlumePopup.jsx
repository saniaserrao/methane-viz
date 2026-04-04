import { Popup } from 'react-map-gl/maplibre'

function formatDate(dt) {
  if (!dt) return '—'
  const fixed = String(dt).replace(/([+-]\d{2})$/, '$1:00')
  const d = new Date(fixed)
  if (isNaN(d.getTime())) return String(dt)
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
  }) + ' UTC'
}

function fmt(val, decimals = 1) {
  return val != null ? Number(val).toFixed(decimals) : '—'
}

export function PlumePopup({ feature, onClose }) {
  if (!feature) return null
  const p = feature.properties
  const hasIme = p.has_ime === 1

  return (
    <Popup
      longitude={Number(p.lon)}
      latitude={Number(p.lat)}
      onClose={onClose}
      closeButton={true}
      closeOnClick={false}
      maxWidth="320px"
      style={{ zIndex: 20 }}
    >
      <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#0f172a', maxWidth: 300 }}>

        {/* Header */}
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: '#0369a1' }}>
          Methane Plume
        </div>

        {/* Core detection info */}
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <tbody>
            {[
              ['ID',       p.id],
              ['Sector',   p.sector || '—'],
              ['Detected', formatDate(p.datetime)],
              ['Platform', p.platform || '—'],
              ['Wind',     p.wind_speed != null ? `${fmt(p.wind_speed, 2)} m/s · ${fmt(p.wind_direction, 0)}°` : '—'],
            ].map(([label, value]) => (
              <tr key={label}>
                <td style={{ padding: '2px 8px 2px 0', color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap', verticalAlign: 'top' }}>{label}</td>
                <td style={{ padding: '2px 0', wordBreak: 'break-word' }}>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Divider */}
        <div style={{ borderTop: '1px solid #e2e8f0', margin: '8px 0' }} />

        {/* Emission comparison block */}
        <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Emission Estimates
        </div>

        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <tbody>
            {/* CarbonMapper matched filter estimate */}
            <tr>
              <td style={{ padding: '3px 8px 3px 0', color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                MFA (kg/hr)
              </td>
              <td style={{ padding: '3px 0' }}>
                {p.emission != null
                  ? <span>{fmt(p.emission)} <span style={{ color: '#94a3b8' }}>± {fmt(p.emission_uncertainty)}</span></span>
                  : '—'}
              </td>
            </tr>

            {/* IME flux estimate */}
            <tr>
              <td style={{ padding: '3px 8px 3px 0', color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                IME (t/hr)
              </td>
              <td style={{ padding: '3px 0' }}>
                {hasIme
                  ? <span>
                      {fmt(p.ime_flux_ton_hr)}
                      <span style={{ color: '#94a3b8' }}> ± {fmt(p.ime_uncertainty_ton_hr)}</span>
                      {p.ime_plume_count > 1 && (
                        <span style={{ color: '#94a3b8' }}> ({p.ime_plume_count} plumes)</span>
                      )}
                    </span>
                  : <span style={{ color: '#94a3b8' }}>no IME data</span>
                }
              </td>
            </tr>


          </tbody>
        </table>



        {p.plume_png && (
          <div style={{ marginTop: 6, fontSize: 11, color: '#94a3b8' }}>PNG overlay on map</div>
        )}
      </div>
    </Popup>
  )
}

