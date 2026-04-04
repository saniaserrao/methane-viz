export function LayerToggle({ layers, onToggle, panelOpen, onPanelToggle, plumeCount }) {
  return (
    <div style={{
      position: 'absolute',
      top: 16,
      right: 16,
      zIndex: 10,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      fontFamily: 'monospace',
    }}>

      {/* Sources toggle button */}
      <button
        onClick={onPanelToggle}
        style={{
          background: 'rgba(15, 20, 30, 0.85)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 8,
          padding: '8px 14px',
          color: '#7dd3fc',
          fontFamily: 'monospace',
          fontSize: 12,
          cursor: 'pointer',
          textAlign: 'left',
          fontWeight: 700,
          letterSpacing: 0.5,
        }}
      >
        {panelOpen ? '✕ Close Sources' : `☰ Sources (${plumeCount})`}
      </button>

      {/* Layer toggles */}
      <div style={{
        background: 'rgba(15, 20, 30, 0.85)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 8,
        padding: '12px 16px',
        color: '#fff',
        fontSize: 13,
        minWidth: 220,
      }}>
        <div style={{ fontWeight: 700, marginBottom: 10, letterSpacing: 1, fontSize: 11, color: '#7dd3fc', textTransform: 'uppercase' }}>
          Layers
        </div>

        {layers.map(layer => (
          <label key={layer.id} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 8 }}>
            <input
              type="checkbox"
              checked={layer.visible}
              onChange={() => onToggle(layer.id)}
              style={{ accentColor: layer.color, width: 14, height: 14 }}
            />
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                width: 10, height: 10,
                borderRadius: layer.shape === 'circle' ? '50%' : 2,
                background: layer.color, display: 'inline-block', flexShrink: 0,
              }} />
              {layer.label}
            </span>
          </label>
        ))}

        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: 11, color: '#94a3b8' }}>
          Click a plume box to inspect
        </div>
      </div>

      {/* CH4 concentration legend for Sentinel-5P heatmap */}
      {layers.find(l => l.id === 'hotspots')?.visible && (
        <div style={{
          background: 'rgba(15, 20, 30, 0.85)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 8,
          padding: '12px 16px',
          color: '#fff',
          fontSize: 11,
          minWidth: 220,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 8, letterSpacing: 1, fontSize: 11, color: '#7dd3fc', textTransform: 'uppercase' }}>
            CH4 Concentration · Sentinel-5P
          </div>

          {/* Gradient bar */}
          <div style={{
            height: 10, borderRadius: 4, marginBottom: 6,
            background: 'linear-gradient(to right, rgba(33,102,172,0.8), rgba(103,169,207,0.9), rgba(209,229,240,1), rgba(253,219,199,1), rgba(239,138,98,1), rgba(178,24,43,1))',
          }} />

          {/* Labels */}
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: 10 }}>
            <span>1700</span>
            <span>1900</span>
            <span>2100</span>
            <span>2300</span>
            <span>2500+</span>
          </div>
          <div style={{ textAlign: 'center', color: '#64748b', fontSize: 10, marginTop: 4 }}>
            ppb (dry air, bias corrected)
          </div>
        </div>
      )}
    </div>
  )
}