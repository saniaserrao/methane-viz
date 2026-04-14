import { useState, useRef, useCallback, useEffect } from 'react'

var NOMINATIM = 'https://nominatim.openstreetmap.org/search'
var ACCENT = '#7dd3fc'
var BG_PANEL = 'rgba(15, 20, 30, 0.92)'
var BORDER = '1px solid rgba(255,255,255,0.12)'

export function LocationSearch(props) {
  var onResult = props.onResult

  var [query, setQuery] = useState('')
  var [results, setResults] = useState([])
  var [loading, setLoading] = useState(false)
  var [focused, setFocused] = useState(false)
  var [errMsg, setErrMsg] = useState(null)

  var debounceRef = useRef(null)
  var inputRef = useRef(null)

  var geocode = useCallback(function (q) {
    if (!q.trim()) { setResults([]); return }
    setLoading(true)
    setErrMsg(null)
    var params = new URLSearchParams({ q: q, format: 'json', limit: 6, addressdetails: 1 })
    fetch(NOMINATIM + '?' + params, { headers: { 'User-Agent': 'MethaneMapApp/1.0' } })
      .then(function (res) {
        if (!res.ok) throw new Error('Nominatim ' + res.status)
        return res.json()
      })
      .then(function (data) { setResults(data) })
      .catch(function () { setErrMsg('Search unavailable'); setResults([]) })
      .finally(function () { setLoading(false) })
  }, [])

  useEffect(function () {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(function () { geocode(query) }, 400)
    return function () { clearTimeout(debounceRef.current) }
  }, [query, geocode])

  function selectResult(item) {
    var longitude = parseFloat(item.lon)
    var latitude = parseFloat(item.lat)
    var bbox = null
    if (item.boundingbox && item.boundingbox.length === 4) {
      var bb = item.boundingbox.map(Number)
      bbox = [bb[2], bb[0], bb[3], bb[1]]
    }
    onResult({ longitude: longitude, latitude: latitude, bbox: bbox })
    setQuery(item.display_name.split(',').slice(0, 2).join(', '))
    setResults([])
    if (inputRef.current) inputRef.current.blur()
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') { setResults([]); if (inputRef.current) inputRef.current.blur() }
    if (e.key === 'Enter' && results.length > 0) selectResult(results[0])
  }

  var showDropdown = focused && (results.length > 0 || loading || errMsg)

  return (
    <div style={{ position: 'relative', width: 280, fontFamily: 'monospace', fontSize: 13 }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: BG_PANEL, backdropFilter: 'blur(8px)',
          border: focused ? '1px solid ' + ACCENT : BORDER,
          borderRadius: 8, padding: '7px 12px', transition: 'border 0.15s',
        }}
      >
        <svg width="13" height="13" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
          <circle cx="8.5" cy="8.5" r="5.5" stroke={ACCENT} strokeWidth="2" />
          <line x1="13" y1="13" x2="18" y2="18" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          value={query}
          onChange={function (e) { setQuery(e.target.value) }}
          onFocus={function () { setFocused(true) }}
          onBlur={function () { setTimeout(function () { setFocused(false) }, 150) }}
          onKeyDown={handleKeyDown}
          placeholder="Search location..."
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: '#e2e8f0', fontFamily: 'monospace', fontSize: 12, minWidth: 0,
          }}
        />
        {loading && <span style={{ color: '#475569', fontSize: 10, flexShrink: 0 }}>...</span>}
        {query && (
          <button
            onMouseDown={function (e) { e.preventDefault(); setQuery(''); setResults([]) }}
            style={{
              background: 'none', border: 'none', color: '#475569',
              cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: 1, flexShrink: 0,
            }}
          >
            x
          </button>
        )}
      </div>

      {showDropdown && (
        <div
          style={{
            position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
            background: BG_PANEL, backdropFilter: 'blur(8px)', border: BORDER,
            borderRadius: 8, overflow: 'hidden', zIndex: 50,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}
        >
          {errMsg && (
            <div style={{ padding: '8px 12px', color: '#f87171', fontSize: 11 }}>{errMsg}</div>
          )}
          {results.map(function (item, i) {
            var parts = item.display_name.split(', ')
            var title = parts.slice(0, 2).join(', ')
            var sub = parts.slice(2, 4).join(', ')
            return (
              <div
                key={item.place_id != null ? item.place_id : i}
                onMouseDown={function () { selectResult(item) }}
                style={{
                  padding: '8px 12px', cursor: 'pointer',
                  borderTop: i > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                }}
                onMouseEnter={function (e) { e.currentTarget.style.background = 'rgba(125,211,252,0.08)' }}
                onMouseLeave={function (e) { e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{ color: '#e2e8f0', fontSize: 12, marginBottom: 2 }}>{title}</div>
                {sub && <div style={{ color: '#64748b', fontSize: 10 }}>{sub}</div>}
                <div style={{ color: '#374151', fontSize: 9, marginTop: 1 }}>
                  {item.type} - {parseFloat(item.lat).toFixed(3)}, {parseFloat(item.lon).toFixed(3)}
                </div>
              </div>
            )
          })}
          {results.length === 0 && !loading && !errMsg && query.trim() && (
            <div style={{ padding: '8px 12px', color: '#475569', fontSize: 11 }}>
              No results for "{query}"
            </div>
          )}
        </div>
      )}
    </div>
  )
}