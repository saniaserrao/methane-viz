export function LayerToggle(props) {
  var layers = props.layers
  var onToggle = props.onToggle

  return (
    <div
      style={{
        position: 'absolute', top: 16, right: 16, zIndex: 10,
        display: 'flex', flexDirection: 'column', gap: 8, fontFamily: 'monospace',
      }}
    >
      {/* Layer toggles */}
      <div
        style={{
          background: 'rgba(15, 20, 30, 0.85)', backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
          padding: '12px 16px', color: '#fff', fontSize: 13, minWidth: 230,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 10, letterSpacing: 1, fontSize: 11, color: '#7dd3fc', textTransform: 'uppercase' }}>
          Layers
        </div>

        {layers.map(function (layer) {
          return (
            <label
              key={layer.id}
              style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 8 }}
            >
              <input
                type="checkbox"
                checked={layer.visible}
                onChange={function () { onToggle(layer.id) }}
                style={{ accentColor: layer.color, width: 14, height: 14 }}
              />
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    width: 10, height: 10,
                    borderRadius: layer.shape === 'circle' ? '50%' : 2,
                    background: layer.color, display: 'inline-block', flexShrink: 0,
                  }}
                />
                {layer.label}
              </span>
            </label>
          )
        })}

        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: 11, color: '#94a3b8' }}>
          Click a hex or plume to inspect
        </div>
      </div>

      {/* CH4 concentration legend */}
      {layers.find(function (l) { return l.id === 'hotspots' }) &&
       layers.find(function (l) { return l.id === 'hotspots' }).visible && (
        <div
          style={{
            background: 'rgba(15, 20, 30, 0.85)', backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
            padding: '12px 16px', color: '#fff', fontSize: 11, minWidth: 230,
          }}
        >
          <div
            style={{
              fontWeight: 700, marginBottom: 8, letterSpacing: 1, fontSize: 11,
              color: '#7dd3fc', textTransform: 'uppercase',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            CH4 Concentration - Sentinel-5P
            <span
              title="Column-averaged methane concentration (ppb) measured by Sentinel-5P TROPOMI."
              style={{
                width: 14, height: 14, borderRadius: '50%',
                border: '1px solid #7dd3fc', color: '#7dd3fc',
                fontSize: 9, display: 'inline-flex', alignItems: 'center',
                justifyContent: 'center', cursor: 'default',
                flexShrink: 0, userSelect: 'none', lineHeight: 1,
              }}
            >
              i
            </span>
          </div>
          <div
            style={{
              height: 10, borderRadius: 4, marginBottom: 6,
              background: 'linear-gradient(to right, #1e3a5f, #2563eb, #1e293b, #f59e0b, #ef4444, #7f1d1d)',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: 10 }}>
            <span>1800</span>
            <span>1850</span>
            <span>1875</span>
            <span>1920</span>
            <span>1950+</span>
          </div>
          <div style={{ textAlign: 'center', color: '#64748b', fontSize: 10, marginTop: 4 }}>
            ppb (parts per billion)
          </div>
        </div>
      )}

      {/* UNEP CH4 flux legend */}
      {layers.find(function (l) { return l.id === 'unep' }) &&
       layers.find(function (l) { return l.id === 'unep' }).visible && (
        <div
          style={{
            background: 'rgba(15, 20, 30, 0.85)', backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
            padding: '12px 16px', color: '#fff', fontSize: 11, minWidth: 230,
          }}
        >
          <div
            style={{
              fontWeight: 700, marginBottom: 8, letterSpacing: 1, fontSize: 11,
              color: '#f97316', textTransform: 'uppercase',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            CH4 Flux - kg / hr
            <span
              title="Instantaneous methane emission rate estimated by UNEP IMEO MARS from satellite imagery."
              style={{
                width: 14, height: 14, borderRadius: '50%',
                border: '1px solid #f97316', color: '#f97316',
                fontSize: 9, display: 'inline-flex', alignItems: 'center',
                justifyContent: 'center', cursor: 'default',
                flexShrink: 0, userSelect: 'none', lineHeight: 1,
              }}
            >
              i
            </span>
          </div>
          <div
            style={{
              height: 10, borderRadius: 4, marginBottom: 6,
              background: 'linear-gradient(to right, #0d0221, #7b2d8b, #d4548a, #f97316, #fde047)',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: 10, marginBottom: 4 }}>
            <span>0</span><span>5k</span><span>20k</span><span>40k</span><span>60k+</span>
          </div>
        </div>
      )}
    </div>
  )
}