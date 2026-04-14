import { useMemo, useState } from 'react'
import { MONTH_NAMES } from '../hooks/useMonthlyHotspots'

var ACCENT = '#7dd3fc'
var BG_PANEL = 'rgba(15, 20, 30, 0.90)'
var BORDER = '1px solid rgba(255,255,255,0.10)'

var ALL_YEARS = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]
var ALL_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

export function MonthYearPicker(props) {
  var available = props.available
  var selection = props.selection
  var onChange = props.onChange

  var [noDataMsg, setNoDataMsg] = useState(null)

  var availableSet = useMemo(function () {
    var s = new Set()
    var list = available || []
    for (var i = 0; i < list.length; i++) {
      s.add(list[i].year + '-' + list[i].month)
    }
    return s
  }, [available])

  var activeYear = selection ? selection.year : null
  var activeMonth = selection ? selection.month : null

  function showToast(msg) {
    setNoDataMsg(msg)
    setTimeout(function () { setNoDataMsg(null) }, 2500)
  }

  function handleMonthClick(month) {
    if (!activeYear) return
    // Always update selection so the picker feels responsive —
    // useMonthlyHotspots will return an empty FeatureCollection for months
    // with no data, so no wasted backend calls happen.
    if (availableSet.has(activeYear + '-' + month)) {
      setNoDataMsg(null)
      onChange({ year: activeYear, month: month })
    } else {
      // Show toast but do NOT call onChange — no backend request fires
      showToast('No data for ' + MONTH_NAMES[month] + ' ' + activeYear)
    }
  }

  function handleYearClick(year) {
    var firstAvail = null
    for (var i = 0; i < ALL_MONTHS.length; i++) {
      if (availableSet.has(year + '-' + ALL_MONTHS[i])) {
        firstAvail = ALL_MONTHS[i]
        break
      }
    }
    if (firstAvail !== null) {
      setNoDataMsg(null)
      onChange({ year: year, month: firstAvail })
    } else {
      showToast('No data for ' + year)
    }
  }

  return (
    <div
      style={{
        background: BG_PANEL,
        backdropFilter: 'blur(8px)',
        border: BORDER,
        borderRadius: 10,
        padding: '12px 14px',
        fontFamily: 'monospace',
        fontSize: 12,
        color: '#fff',
        minWidth: 240,
        userSelect: 'none',
      }}
    >
      <div
        style={{
          fontWeight: 700, fontSize: 11, letterSpacing: 1,
          color: ACCENT, textTransform: 'uppercase', marginBottom: 10,
        }}
      >
        Data Selection
      </div>

      {/* Year buttons */}
      <div style={{ display: 'flex', gap: 3, marginBottom: 10, flexWrap: 'wrap' }}>
        {ALL_YEARS.map(function (y) {
          var isActive = activeYear === y
          return (
            <button
              key={y}
              onClick={function () { handleYearClick(y) }}
              style={{
                flex: '1 1 auto',
                padding: '3px 4px',
                borderRadius: 5,
                border: isActive
                  ? '1px solid ' + ACCENT
                  : '1px solid rgba(255,255,255,0.18)',
                background: isActive ? 'rgba(125,211,252,0.14)' : 'transparent',
                color: isActive ? ACCENT : '#94a3b8',
                cursor: 'pointer',
                fontSize: 10,
                fontFamily: 'monospace',
                fontWeight: isActive ? 700 : 400,
                transition: 'all 0.1s',
              }}
            >
              {y}
            </button>
          )
        })}
      </div>

      {/* Month grid 4x3 — all months look identical; only selected is highlighted */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
        {ALL_MONTHS.map(function (m) {
          var isSelected = activeMonth === m && activeYear === (selection ? selection.year : null)
          return (
            <button
              key={m}
              onClick={function () { handleMonthClick(m) }}
              style={{
                padding: '5px 0',
                borderRadius: 6,
                border: isSelected
                  ? '1.5px solid ' + ACCENT
                  : '1px solid rgba(255,255,255,0.18)',
                background: isSelected
                  ? 'rgba(125,211,252,0.20)'
                  : 'rgba(255,255,255,0.05)',
                color: isSelected ? ACCENT : '#cbd5e1',
                cursor: 'pointer',
                fontSize: 10,
                fontFamily: 'monospace',
                fontWeight: isSelected ? 700 : 400,
                transition: 'all 0.1s',
              }}
            >
              {MONTH_NAMES[m]}
            </button>
          )
        })}
      </div>

      {/* Toast */}
      {noDataMsg && (
        <div
          style={{
            marginTop: 10, padding: '5px 10px', borderRadius: 6,
            background: 'rgba(239,68,68,0.15)',
            border: '1px solid rgba(239,68,68,0.35)',
            color: '#fca5a5', fontSize: 10, textAlign: 'center',
          }}
        >
          {noDataMsg}
        </div>
      )}

      {/* Summary */}
      {selection && !noDataMsg && (
        <div
          style={{
            marginTop: 10, paddingTop: 8,
            borderTop: '1px solid rgba(255,255,255,0.08)',
            fontSize: 10, color: '#94a3b8', textAlign: 'center',
          }}
        >
          {MONTH_NAMES[selection.month]} {selection.year}
        </div>
      )}
    </div>
  )
}