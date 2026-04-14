export function YearSlider({ year, onChange }) {
  const MIN = 2019
  const MAX = 2025
  const pct = ((year - MIN) / (MAX - MIN)) * 100

  return (
    <div style={{
      position: 'absolute',
      bottom: 40,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 10,
      background: 'rgba(15, 20, 30, 0.85)',
      backdropFilter: 'blur(8px)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 12,
      padding: '12px 24px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 8,
      minWidth: 300,
      fontFamily: 'monospace',
    }}>
      {/* Label */}
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: '#7dd3fc', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>
          Year
        </span>
        <span style={{ fontSize: 20, color: '#fff', fontWeight: 700, letterSpacing: 2 }}>
          {year}
        </span>
      </div>

      {/* Slider */}
      <input
        type="range"
        min={MIN}
        max={MAX}
        step={1}
        value={year}
        onChange={e => onChange(Number(e.target.value))}
        style={{
          width: '100%',
          appearance: 'none',
          height: 4,
          borderRadius: 2,
          outline: 'none',
          cursor: 'pointer',
          background: `linear-gradient(to right, #38bdf8 ${pct}%, rgba(255,255,255,0.15) ${pct}%)`,
        }}
      />

      {/* Year labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
        {[2019, 2020, 2021, 2022, 2023, 2024, 2025].map(y => (
          <span
            key={y}
            onClick={() => onChange(y)}
            style={{
              fontSize: 10,
              color: y === year ? '#38bdf8' : '#475569',
              cursor: 'pointer',
              fontWeight: y === year ? 700 : 400,
              transition: 'color 0.2s',
            }}
          >
            {y}
          </span>
        ))}
      </div>
    </div>
  )
}